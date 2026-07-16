import { createAiRuntime } from "@ting-lab/ai";
import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";

import { chatErrorResponse, toPublicChatError } from "@/lib/chat/errors";
import { prepareChatRag } from "@/lib/chat/rag";
import { chatRateLimiter, getClientRateLimitKey } from "@/lib/chat/rate-limit";
import type { TingLabUIMessage } from "@/lib/chat/types";
import { validateChatRequest } from "@/lib/chat/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rateLimit = chatRateLimiter.check(getClientRateLimitKey(request, process.env));
  if (!rateLimit.allowed) {
    return chatErrorResponse(
      {
        code: "RATE_LIMITED",
        message: "请求过于频繁，请稍后再试。",
        retryable: true,
      },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return chatErrorResponse(
      { code: "INVALID_REQUEST", message: "请求必须是有效 JSON。", retryable: false },
      400,
    );
  }

  try {
    const chat = await validateChatRequest(body);
    const runtimeConfig = createAiRuntime();
    const rag = await prepareChatRag(chat.messages);
    const modelMessages = await convertToModelMessages(chat.messages);
    const stream = createUIMessageStream<TingLabUIMessage>({
      execute: ({ writer }) => {
        writer.write({ type: "data-ragStatus", id: "rag-status", data: rag.result.status });
        writer.write({ type: "data-sources", id: "rag-sources", data: rag.sources });
        for (const source of rag.sources) {
          writer.write({
            type: "source-url",
            sourceId: source.id,
            url: source.url,
            title: source.heading ? `${source.title} · ${source.heading}` : source.title,
          });
        }
        const result = streamText({
          model: runtimeConfig.model,
          system: runtimeConfig.systemPrompt + rag.systemAddon,
          messages: modelMessages,
          maxOutputTokens: runtimeConfig.config.maxOutputTokens,
          abortSignal: request.signal,
          timeout: { totalMs: runtimeConfig.config.requestTimeoutMs },
        });
        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => JSON.stringify(toPublicChatError(error)),
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { "Cache-Control": "no-store" },
      consumeSseStream: ({ stream }) => consumeStream({ stream }),
    });
  } catch (error) {
    const publicError = toPublicChatError(error);
    const status =
      publicError.code === "INVALID_REQUEST"
        ? 400
        : publicError.code === "AI_NOT_CONFIGURED"
          ? 503
          : 502;
    return chatErrorResponse(publicError, status);
  }
}
