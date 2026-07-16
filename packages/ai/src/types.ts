import type { LanguageModel } from "ai";

export const AI_PROVIDERS = ["openai", "openai-compatible", "google"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiConfig = Readonly<{
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseURL?: string;
  maxOutputTokens: number;
  requestTimeoutMs: number;
}>;

export type AiRuntime = Readonly<{
  config: AiConfig;
  model: LanguageModel;
  systemPrompt: string;
}>;

export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "UPSTREAM_AUTH_ERROR"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

export type PublicAiError = Readonly<{
  code: AiErrorCode;
  message: string;
  retryable: boolean;
}>;
