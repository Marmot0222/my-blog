import { normalizeAiError, type PublicAiError } from "@ting-lab/ai";

export type ChatErrorCode =
  | "INVALID_REQUEST"
  | "AI_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "UPSTREAM_AUTH_ERROR"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

export type PublicChatError = Readonly<{
  code: ChatErrorCode;
  message: string;
  retryable: boolean;
}>;

export class ChatRequestError extends Error {
  readonly publicError: PublicChatError;

  constructor(message: string) {
    super(message);
    this.name = "ChatRequestError";
    this.publicError = { code: "INVALID_REQUEST", message, retryable: false };
  }
}

export function toPublicChatError(error: unknown): PublicChatError {
  if (error instanceof ChatRequestError) {
    return error.publicError;
  }
  return normalizeAiError(error) satisfies PublicAiError;
}

export function chatErrorResponse(
  error: PublicChatError,
  status: number,
  headers?: HeadersInit,
): Response {
  return Response.json(error, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export function parseClientChatError(error: Error): PublicChatError {
  try {
    const parsed = JSON.parse(error.message) as Partial<PublicChatError>;
    if (typeof parsed.code === "string" && typeof parsed.message === "string") {
      return {
        code: parsed.code as ChatErrorCode,
        message: parsed.message,
        retryable: parsed.retryable === true,
      };
    }
  } catch {
    // The transport can surface plain network failures. Keep the browser-facing
    // fallback stable and do not display raw server or provider text.
  }

  return {
    code: "UPSTREAM_ERROR",
    message: "AI 服务暂时不可用，请稍后重试。",
    retryable: true,
  };
}
