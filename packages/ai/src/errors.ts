import { APICallError, RetryError } from "ai";

import { AiConfigurationError } from "./config";
import type { PublicAiError } from "./types";

const messages = {
  AI_NOT_CONFIGURED: "AI 服务尚未配置，请稍后再试。",
  UPSTREAM_AUTH_ERROR: "AI 服务认证失败，请联系站点维护者。",
  UPSTREAM_RATE_LIMITED: "AI 服务当前请求过多，请稍后重试。",
  UPSTREAM_TIMEOUT: "AI 服务响应超时，请重试。",
  UPSTREAM_ERROR: "AI 服务暂时不可用，请稍后重试。",
} as const;

export function normalizeAiError(error: unknown): PublicAiError {
  if (error instanceof AiConfigurationError) {
    return { code: error.code, message: messages.AI_NOT_CONFIGURED, retryable: false };
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return {
        code: "UPSTREAM_AUTH_ERROR",
        message: messages.UPSTREAM_AUTH_ERROR,
        retryable: false,
      };
    }
    if (error.statusCode === 429) {
      return {
        code: "UPSTREAM_RATE_LIMITED",
        message: messages.UPSTREAM_RATE_LIMITED,
        retryable: true,
      };
    }
  }

  if (
    (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) ||
    (error instanceof Error && error.name === "TimeoutError") ||
    (RetryError.isInstance(error) && error.reason === "abort")
  ) {
    return { code: "UPSTREAM_TIMEOUT", message: messages.UPSTREAM_TIMEOUT, retryable: true };
  }

  return { code: "UPSTREAM_ERROR", message: messages.UPSTREAM_ERROR, retryable: true };
}
