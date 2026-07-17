import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type UIMessageChunk,
} from "ai";

import { toPublicChatError } from "@/lib/chat/errors";
import { prepareChatRag, type RetrieveKnowledge } from "@/lib/chat/rag";
import type { TingLabUIMessage } from "@/lib/chat/types";
import type { ValidatedChatRequest } from "@/lib/chat/validation";

/**
 * 依赖注入边界：让协议层可在测试中用 MockLanguageModelV3 与 fake retrieve 驱动，
 * 不访问真实模型或数据库。POST 处理器仍负责在运行时解析真实配置。
 *
 * 注意：这些导出刻意放在 route.ts 之外，因为 Next.js Route Handler 只允许
 * HTTP 方法与路由配置字段（runtime/dynamic 等）作为导出。
 */
export type ChatStreamDeps = Readonly<{
  model: LanguageModel;
  systemPrompt: string;
  config: Readonly<{ maxOutputTokens: number; requestTimeoutMs: number }>;
  retrieve?: RetrieveKnowledge;
}>;

/**
 * 构建单轮对话的 UI message 流。这是协议不变量的核心：
 *
 * - 外层 createUIMessageStream 只承载一轮 assistant message 生命周期；
 *   RAG 状态、来源与正文都归属于同一条消息。
 * - 合并 streamText 的 token 流时使用 `sendStart: false`，避免模型流再次发出
 *   携带新 messageId 的 message-start。否则客户端会在 RAG data 部件已落账后
 *   因 message id 被覆盖而追加第二条空 assistant 消息（“回答两次”根因）。
 * - 一次调用只执行一次 RAG 检索与一次模型生成。
 */
export async function buildChatStream(
  messages: readonly TingLabUIMessage[],
  deps: ChatStreamDeps,
  abortSignal: AbortSignal,
): Promise<ReadableStream<UIMessageChunk>> {
  const rag = await prepareChatRag(messages, deps.retrieve);
  const modelMessages = await convertToModelMessages([...messages]);

  return createUIMessageStream<TingLabUIMessage>({
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
        model: deps.model,
        system: deps.systemPrompt + rag.systemAddon,
        messages: modelMessages,
        maxOutputTokens: deps.config.maxOutputTokens,
        abortSignal,
        timeout: { totalMs: deps.config.requestTimeoutMs },
      });
      // 关键：关闭模型流的 message-start，使外层单一消息生命周期不被覆盖。
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
    onError: (error) => JSON.stringify(toPublicChatError(error)),
  });
}

/** 由 POST 处理器调用，组装最终 SSE 响应；抽出便于在边界测试中复用。 */
export async function handleChatRequest(
  chat: ValidatedChatRequest,
  deps: ChatStreamDeps,
  abortSignal: AbortSignal,
): Promise<Response> {
  const stream = await buildChatStream(chat.messages, deps, abortSignal);
  return createUIMessageStreamResponse({
    stream,
    headers: { "Cache-Control": "no-store" },
    consumeSseStream: ({ stream: consumeStreamArg }) => consumeStream({ stream: consumeStreamArg }),
  });
}
