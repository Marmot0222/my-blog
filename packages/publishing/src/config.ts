import { createHash } from "node:crypto";
import { z } from "zod";
import { createProfileStore, createPublishingStore, type StoredProfile } from "@ting-lab/database";
import {
  parseAiConfig,
  approvedProviderUrl,
  AiConfigurationError,
  testAiConnection,
  type AiConfig,
} from "@ting-lab/ai";
import {
  parseEmbeddingConfig,
  createEmbeddingService,
  type EmbeddingConfig,
} from "@ting-lab/retrieval";
import { contentSource } from "./content";
import { encryptKey, decryptKey, type KeyEnvelope } from "./secrets";

export const chatProfileSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.enum(["openai", "openai-compatible", "google"]),
    model: z.string().trim().min(1).max(200),
    baseURL: z.string().url().max(2000),
    requestTimeoutMs: z.number().int().min(1000).max(120000),
    maxOutputTokens: z.number().int().min(1).max(8192),
  })
  .strict();
const keyAction = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("keep") }).strict(),
  z
    .object({
      mode: z.literal("replace"),
      value: z
        .string()
        .trim()
        .min(1)
        .max(4096)
        .refine((value) => !/^\*+$/.test(value)),
    })
    .strict(),
]);
export const saveChatSchema = z
  .object({ version: z.number().int().nonnegative(), profile: chatProfileSchema, key: keyAction })
  .strict();
const envelopeSchema = z
  .object({ version: z.string(), nonce: z.string(), tag: z.string(), ciphertext: z.string() })
  .strict();
function open(row: StoredProfile, purpose: string) {
  if (!row.key_envelope) throw new AiConfigurationError();
  return decryptKey(envelopeSchema.parse(row.key_envelope), purpose);
}
const chatURL = (config: AiConfig) =>
  config.baseURL ??
  (config.provider === "google"
    ? "https://generativelanguage.googleapis.com/v1beta"
    : "https://api.openai.com/v1");
function publicChat(config: AiConfig) {
  return {
    enabled: true,
    provider: config.provider,
    model: config.model,
    baseURL: chatURL(config),
    requestTimeoutMs: config.requestTimeoutMs,
    maxOutputTokens: config.maxOutputTokens,
  };
}
export function embeddingFingerprint(
  config: Pick<EmbeddingConfig, "provider" | "model" | "baseURL" | "dimensions">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        config.provider,
        config.model,
        config.baseURL ?? "https://api.openai.com/v1",
        config.dimensions,
      ]),
    )
    .digest("hex");
}

export async function freezeEmbedding(initializeUnconfigured = false) {
  const store = createProfileStore(),
    existing = await store.read("embedding.frozen");
  if (existing && (!initializeUnconfigured || existing.profile.configured)) return;
  let config: EmbeddingConfig;
  try {
    config = parseEmbeddingConfig(process.env);
  } catch {
    await store.save("embedding.frozen", 0, { configured: false }, null);
    return;
  }
  const { apiKey, ...profile } = config;
  await store.save(
    "embedding.frozen",
    existing?.version ?? 0,
    { ...profile, configured: true },
    encryptKey(apiKey, "embedding"),
  );
}
export async function effectiveEmbedding(): Promise<EmbeddingConfig> {
  if (contentSource() === "file") return parseEmbeddingConfig(process.env);
  const row = await createProfileStore().read("embedding.frozen");
  if (!row) return parseEmbeddingConfig(process.env);
  if (!row.profile.configured) throw new AiConfigurationError();
  return parseEmbeddingConfig({
    NODE_ENV: process.env.NODE_ENV ?? "development",
    EMBEDDING_PROVIDER: String(row.profile.provider),
    EMBEDDING_MODEL: String(row.profile.model),
    EMBEDDING_DIMENSIONS: "2048",
    EMBEDDING_BASE_URL: row.profile.baseURL ? String(row.profile.baseURL) : undefined,
    EMBEDDING_API_KEY: open(row, "embedding"),
    EMBEDDING_BATCH_SIZE: String(row.profile.batchSize),
    EMBEDDING_MAX_RETRIES: String(row.profile.maxRetries),
  });
}
export async function effectiveChat(): Promise<AiConfig> {
  if (contentSource() === "file") return parseAiConfig(process.env);
  const active = await createProfileStore().read("chat.active");
  if (!active) return parseAiConfig(process.env);
  const profile = chatProfileSchema.parse(active.profile);
  if (!profile.enabled) throw new AiConfigurationError();
  approvedProviderUrl(profile.baseURL);
  return { ...profile, apiKey: open(active, "chat") };
}
export async function publishFingerprint() {
  await freezeEmbedding();
  const row = await createProfileStore().read("embedding.frozen");
  if (!row?.profile.configured) return "unconfigured";
  return embeddingFingerprint({
    provider: row.profile.provider as EmbeddingConfig["provider"],
    model: String(row.profile.model),
    baseURL: typeof row.profile.baseURL === "string" ? row.profile.baseURL : undefined,
    dimensions: 2048,
  });
}
export async function saveChat(value: unknown) {
  const input = saveChatSchema.parse(value);
  approvedProviderUrl(input.profile.baseURL);
  await freezeEmbedding();
  if (!(await createPublishingStore().credentials())) throw new AiConfigurationError();
  const store = createProfileStore();
  const previous = (await store.read("chat.draft")) ?? (await store.read("chat.active"));
  let key: string | undefined;
  if (input.key.mode === "replace") key = input.key.value;
  else if (previous) {
    if (
      previous.profile.provider !== input.profile.provider ||
      previous.profile.baseURL !== input.profile.baseURL
    )
      throw new Error("切换供应商或地址必须提供新 Key");
    if (previous.key_envelope) key = open(previous, "chat");
  } else {
    let envConfig: AiConfig | undefined;
    try {
      envConfig = parseAiConfig(process.env);
    } catch {
      /* Unset env is not an error for an explicitly disabled profile. */
    }
    if (envConfig) {
      if (
        envConfig.provider !== input.profile.provider ||
        chatURL(envConfig) !== input.profile.baseURL
      )
        throw new Error("切换供应商或地址必须提供新 Key");
      key = envConfig.apiKey;
    }
  }
  if (input.profile.enabled && !key) throw new Error("启用 Chat 必须配置 Key");
  const row = await store.save(
    "chat.draft",
    input.version,
    input.profile,
    key ? encryptKey(key, "chat") : null,
  );
  return { version: row.version };
}
export async function activateChat(version: number) {
  const row = await createProfileStore().read("chat.draft");
  if (!row || row.version !== version) throw new Error("配置版本冲突");
  const profile = chatProfileSchema.parse(row.profile);
  approvedProviderUrl(profile.baseURL);
  if (profile.enabled) open(row, "chat");
  await createProfileStore().activate(version);
}
export async function testProfile(kind: "chat" | "embedding", version?: number) {
  const started = Date.now();
  try {
    if (kind === "chat") {
      const row = await createProfileStore().read("chat.draft");
      if (!row || row.version !== version) throw new AiConfigurationError();
      const profile = chatProfileSchema.parse(row.profile);
      if (!profile.enabled) throw new AiConfigurationError();
      await testAiConnection({ ...profile, apiKey: open(row, "chat") });
    } else {
      await createEmbeddingService(
        await effectiveEmbedding(),
        AbortSignal.timeout(10_000),
      ).embedOne("Connection check.");
    }
    return { ok: true, durationMs: Date.now() - started, code: "CONNECTED" };
  } catch {
    return { ok: false, durationMs: Date.now() - started, code: "CONNECTION_UNAVAILABLE" };
  }
}
export async function replaceEmbeddingKey(value: string) {
  const key = z.string().trim().min(1).max(4096).parse(value);
  await freezeEmbedding();
  const store = createProfileStore(),
    row = await store.read("embedding.frozen");
  if (!row?.profile.configured)
    throw new Error("Embedding 尚未初始化，需先在服务器配置并冻结向量空间");
  await store.save(row.name, row.version, row.profile, encryptKey(key, "embedding"));
}
export async function settingsSummary() {
  const store = createProfileStore();
  const [active, draft, embedding] = await Promise.all([
    store.read("chat.active"),
    store.read("chat.draft"),
    store.read("embedding.frozen"),
  ]);
  let envChat: AiConfig | undefined;
  try {
    envChat = parseAiConfig(process.env);
  } catch {
    /* unset */
  }
  let envEmbedding: EmbeddingConfig | undefined;
  try {
    envEmbedding = parseEmbeddingConfig(process.env);
  } catch {
    /* unset */
  }
  const selected = draft ?? active;
  const profile = selected
    ? chatProfileSchema.parse(selected.profile)
    : envChat
      ? publicChat(envChat)
      : {
          enabled: false,
          provider: "openai" as const,
          model: "",
          baseURL: "https://api.openai.com/v1",
          requestTimeoutMs: 60000,
          maxOutputTokens: 1200,
        };
  return {
    profile,
    draftVersion: draft?.version ?? 0,
    hasKey: selected ? !!selected.key_envelope : !!envChat,
    source: active ? "database" : envChat ? "environment" : "unset",
    enabled: active ? active.profile.enabled === true : !!envChat,
    pending:
      !!draft &&
      (JSON.stringify(draft.profile) !== JSON.stringify(active?.profile) ||
        JSON.stringify(draft.key_envelope) !== JSON.stringify(active?.key_envelope)),
    updatedAt: active?.updated_at.toISOString() ?? null,
    embedding: embedding
      ? {
          configured: !!embedding.profile.configured,
          provider: String(embedding.profile.provider ?? ""),
          model: String(embedding.profile.model ?? ""),
          baseURL: String(embedding.profile.baseURL ?? "https://api.openai.com/v1"),
          dimensions: 2048,
          hasKey: !!embedding.key_envelope,
          frozen: true,
        }
      : envEmbedding
        ? {
            configured: true,
            provider: envEmbedding.provider,
            model: envEmbedding.model,
            baseURL: envEmbedding.baseURL ?? "https://api.openai.com/v1",
            dimensions: 2048,
            hasKey: true,
            frozen: false,
          }
        : {
            configured: false,
            provider: "",
            model: "",
            baseURL: "",
            dimensions: 2048,
            hasKey: false,
            frozen: false,
          },
  };
}
export function rotateEnvelope(row: StoredProfile, nextEnv: NodeJS.ProcessEnv): KeyEnvelope | null {
  if (!row.key_envelope) return null;
  const purpose = row.name.startsWith("embedding") ? "embedding" : "chat";
  return encryptKey(open(row, purpose), purpose, nextEnv);
}
