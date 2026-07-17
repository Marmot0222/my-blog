import assert from "node:assert/strict";
import test from "node:test";

import { Chat } from "@ai-sdk/react";
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import type { RagResult } from "@ting-lab/retrieval";
import { simulateReadableStream, type UIMessageChunk } from "ai";
import { MockLanguageModelV3 } from "ai/test";

import type { ChatStreamDeps } from "./route";
import { buildChatStream } from "./route";
import type { TingLabUIMessage } from "@/lib/chat/types";
import type { ChatTransport } from "ai";

/**
 * 这些测试覆盖 UI Message Stream 的实际解析边界：用真实 @ai-sdk/react Chat 实例
 * 驱动 buildChatStream（通过自定义 transport 直接返回 UIMessageChunk 流），
 * 验证“一次提交 → 单一 assistant message 生命周期”的不变量。
 *
 * 根因回顾：若模型流发出携带新 messageId 的 message-start（sendStart 默认 true），
 * 客户端会在 RAG data 部件已通过 replaceMessage(structuredClone) 落账后，
 * 因 message id 被覆盖而 pushMessage 出第二条空 assistant 消息。
 * 修复：toUIMessageStream({ sendStart: false })。
 */

const usedRag: RagResult = {
  status: { status: "used", sourceCount: 1 },
  sources: [
    {
      id: "blog-source-1",
      index: 1,
      title: "文章 A",
      heading: "小节",
      url: "/posts/article-a#section",
      similarity: 0.9,
    },
  ],
  chunks: [
    {
      chunkId: "c1",
      documentSlug: "article-a",
      title: "文章 A",
      heading: "section",
      content: "内容",
      similarity: 0.9,
    },
  ],
  context: '<source index="1">内容</source>',
};

const noMatchRag: RagResult = {
  status: { status: "no_match", sourceCount: 0 },
  sources: [],
  chunks: [],
  context: "",
};

type ModelChunk = LanguageModelV3StreamPart;

function textChunks(text: string): ModelChunk[] {
  return [
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: text },
    { type: "text-end", id: "text-1" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
    },
  ];
}

function emptyFinishChunks(): ModelChunk[] {
  return [
    {
      type: "finish",
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 0, text: 0, reasoning: undefined },
      },
    },
  ];
}

function createModel(chunks: ModelChunk[]): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) }),
  });
}

function createDeps(
  model: MockLanguageModelV3,
  retrieve: (query: string) => Promise<RagResult>,
): ChatStreamDeps {
  return {
    model,
    systemPrompt: "system",
    config: { maxOutputTokens: 100, requestTimeoutMs: 10000 },
    retrieve,
  };
}

function createChat(deps: ChatStreamDeps): {
  chat: Chat<TingLabUIMessage>;
  getSendCount(): number;
} {
  let sendCount = 0;
  let counter = 0;
  const transport: ChatTransport<TingLabUIMessage> = {
    sendMessages: async ({ messages, abortSignal }) => {
      sendCount += 1;
      return buildChatStream(
        messages,
        deps,
        abortSignal ?? new AbortController().signal,
      ) as Promise<ReadableStream<UIMessageChunk>>;
    },
    reconnectToStream: async () => null,
  };
  const chat = new Chat<TingLabUIMessage>({
    id: "test-chat",
    generateId: () => `id-${++counter}`,
    transport,
  });
  return { chat, getSendCount: () => sendCount };
}

function assistantMessages(chat: Chat<TingLabUIMessage>): TingLabUIMessage[] {
  return (chat.messages as TingLabUIMessage[]).filter((m) => m.role === "assistant");
}

function messageText(message: TingLabUIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

function messageSources(message: TingLabUIMessage): unknown[] {
  const part = message.parts.find((p) => p.type === "data-sources") as
    { data: unknown[] } | undefined;
  return part?.data ?? [];
}

function messageRagStatus(message: TingLabUIMessage): unknown {
  const part = message.parts.find((p) => p.type === "data-ragStatus") as
    { data: unknown } | undefined;
  return part?.data;
}

async function collectChunks(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader();
  const chunks: UIMessageChunk[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

test("一次带 RAG 数据和文本的流最终只有一个 assistant message，且同属一条消息", async () => {
  const { chat, getSendCount } = createChat(
    createDeps(createModel(textChunks("这是答案。")), async () => usedRag),
  );

  await chat.sendMessage({ text: "问题" });

  assert.equal(getSendCount(), 1, "transport 只应被调用一次");
  const assistants = assistantMessages(chat);
  assert.equal(assistants.length, 1, "只应形成一条 assistant 消息");
  assert.equal(messageText(assistants[0]), "这是答案。");
  assert.equal(messageSources(assistants[0]).length, 1, "来源应与正文同属一条消息");
  assert.deepEqual(messageRagStatus(assistants[0]), { status: "used", sourceCount: 1 });
});

test("无文本响应（仅 finish）也只形成一条 assistant 消息，不产生第二条空消息", async () => {
  const { chat } = createChat(createDeps(createModel(emptyFinishChunks()), async () => usedRag));

  await chat.sendMessage({ text: "问题" });

  const assistants = assistantMessages(chat);
  assert.equal(assistants.length, 1, "无文本时不应追加第二条空 assistant 消息");
  assert.equal(messageText(assistants[0]), "");
  // 来源仍归属于这一条消息
  assert.equal(messageSources(assistants[0]).length, 1);
});

test("RAG 无匹配时正常回答，无假来源", async () => {
  const { chat } = createChat(
    createDeps(createModel(textChunks("通用回答。")), async () => noMatchRag),
  );

  await chat.sendMessage({ text: "问题" });

  const assistants = assistantMessages(chat);
  assert.equal(assistants.length, 1);
  assert.equal(messageText(assistants[0]), "通用回答。");
  assert.equal(messageSources(assistants[0]).length, 0);
  assert.deepEqual(messageRagStatus(assistants[0]), { status: "no_match", sourceCount: 0 });
});

test("regenerate 替换目标回答，不并存两份", async () => {
  const model = createModel(textChunks("第一次回答。"));
  const { chat } = createChat(createDeps(model, async () => usedRag));

  await chat.sendMessage({ text: "问题" });
  assert.equal(assistantMessages(chat).length, 1);

  await chat.regenerate();
  const assistants = assistantMessages(chat);
  assert.equal(assistants.length, 1, "regenerate 不应保留旧回答并存");
});

test("协议不变量：模型流不得发出携带新 messageId 的 message-start", async () => {
  // 直接检查 buildChatStream 产出的原始 chunk 序列，确保 sendStart 已关闭。
  const messages: TingLabUIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "问题" }] },
  ];
  const stream = await buildChatStream(
    messages,
    createDeps(createModel(textChunks("答案")), async () => usedRag),
    new AbortController().signal,
  );
  const chunks = await collectChunks(stream as ReadableStream<UIMessageChunk>);

  const starts = chunks.filter((c) => c.type === "start");
  assert.equal(starts.length, 0, "不得发出 message-start 部件");
  // RAG data 部件应先于正文出现，并与正文归属同一轮
  const types = chunks.map((c) => c.type);
  assert.ok(types.includes("data-ragStatus"));
  assert.ok(types.includes("data-sources"));
  assert.ok(types.includes("text-delta"));
});
