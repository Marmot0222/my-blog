import { z } from "zod";

import type { AiConfig } from "./types";

const httpUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"));

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), httpUrl.optional());

const baseEnvironmentSchema = z.object({
  AI_PROVIDER: z.enum(["openai", "openai-compatible", "google"]),
  AI_MODEL: z.string().trim().min(1),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_COMPATIBLE_API_KEY: z.string().trim().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().trim().optional(),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(8192).default(1200),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
});

export class AiConfigurationError extends Error {
  readonly code = "AI_NOT_CONFIGURED" as const;

  constructor() {
    super("AI 服务尚未配置");
    this.name = "AiConfigurationError";
  }
}

function configurationError(): never {
  throw new AiConfigurationError();
}

export function parseAiConfig(env: NodeJS.ProcessEnv): AiConfig {
  const result = baseEnvironmentSchema.safeParse(env);

  if (!result.success) {
    return configurationError();
  }

  const values = result.data;
  const common = {
    provider: values.AI_PROVIDER,
    model: values.AI_MODEL,
    maxOutputTokens: values.AI_MAX_OUTPUT_TOKENS,
    requestTimeoutMs: values.AI_REQUEST_TIMEOUT_MS,
  } as const;

  if (values.AI_PROVIDER === "openai") {
    if (!values.OPENAI_API_KEY) {
      return configurationError();
    }
    return {
      ...common,
      apiKey: values.OPENAI_API_KEY,
      baseURL: values.OPENAI_BASE_URL,
    };
  }

  if (values.AI_PROVIDER === "openai-compatible") {
    if (!values.OPENAI_COMPATIBLE_API_KEY || !values.OPENAI_BASE_URL) {
      return configurationError();
    }
    return {
      ...common,
      apiKey: values.OPENAI_COMPATIBLE_API_KEY,
      baseURL: values.OPENAI_BASE_URL,
    };
  }

  if (!values.GOOGLE_GENERATIVE_AI_API_KEY) {
    return configurationError();
  }

  return { ...common, apiKey: values.GOOGLE_GENERATIVE_AI_API_KEY };
}
