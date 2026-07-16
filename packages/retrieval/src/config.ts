import { EMBEDDING_DIMENSIONS } from "@ting-lab/database";
import { z } from "zod";

import type { EmbeddingConfig, RetrievalConfig } from "./types";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .url()
    .refine((url) => url.startsWith("http://") || url.startsWith("https://"))
    .optional(),
);

const embeddingSchema = z.object({
  EMBEDDING_PROVIDER: z.enum(["openai", "openai-compatible"]),
  EMBEDDING_MODEL: z.string().trim().min(1),
  EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .refine((value) => value === EMBEDDING_DIMENSIONS),
  EMBEDDING_API_KEY: optionalText,
  EMBEDDING_BASE_URL: optionalUrl,
  OPENAI_API_KEY: optionalText,
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_COMPATIBLE_API_KEY: optionalText,
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(128).default(32),
  EMBEDDING_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

const retrievalSchema = z.object({
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  RAG_MAX_CONTEXT_CHARS: z.coerce.number().int().min(1000).max(30_000).default(12_000),
});

export class EmbeddingConfigurationError extends Error {
  readonly code = "KNOWLEDGE_BASE_NOT_CONFIGURED" as const;

  constructor() {
    super("Embedding 服务尚未配置");
    this.name = "EmbeddingConfigurationError";
  }
}

export function parseEmbeddingConfig(env: NodeJS.ProcessEnv): EmbeddingConfig {
  const result = embeddingSchema.safeParse(env);
  if (!result.success) throw new EmbeddingConfigurationError();
  const value = result.data;
  const apiKey =
    value.EMBEDDING_API_KEY ??
    (value.EMBEDDING_PROVIDER === "openai"
      ? value.OPENAI_API_KEY
      : value.OPENAI_COMPATIBLE_API_KEY);
  const baseURL =
    value.EMBEDDING_BASE_URL ??
    (value.EMBEDDING_PROVIDER === "openai-compatible" ? value.OPENAI_BASE_URL : undefined);
  if (!apiKey || (value.EMBEDDING_PROVIDER === "openai-compatible" && !baseURL)) {
    throw new EmbeddingConfigurationError();
  }
  return {
    provider: value.EMBEDDING_PROVIDER,
    model: value.EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    apiKey,
    baseURL,
    batchSize: value.EMBEDDING_BATCH_SIZE,
    maxRetries: value.EMBEDDING_MAX_RETRIES,
  };
}

export function parseRetrievalConfig(env: NodeJS.ProcessEnv): RetrievalConfig {
  const result = retrievalSchema.safeParse(env);
  if (!result.success) throw new EmbeddingConfigurationError();
  return {
    topK: result.data.RAG_TOP_K,
    similarityThreshold: result.data.RAG_SIMILARITY_THRESHOLD,
    maxContextChars: result.data.RAG_MAX_CONTEXT_CHARS,
  };
}
