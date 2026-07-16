import assert from "node:assert/strict";
import test from "node:test";

import type { RagResult } from "@ting-lab/retrieval";

import { prepareChatRag } from "./rag";
import type { TingLabUIMessage } from "./types";
import { validateChatRequest } from "./validation";

const messages: TingLabUIMessage[] = [
  { id: "user-1", role: "user", parts: [{ type: "text", text: "Next.js 是什么？" }] },
];

test("有检索结果时注入上下文并移除客户端不需要的 similarity", async () => {
  const result: RagResult = {
    status: { status: "used", sourceCount: 1 },
    sources: [{ id: "source-1", index: 1, title: "文章", url: "/posts/article", similarity: 0.88 }],
    chunks: [
      {
        chunkId: "internal",
        documentSlug: "article",
        title: "文章",
        content: "内容",
        similarity: 0.88,
      },
    ],
    context: '<source index="1">内容</source>',
  };
  const prepared = await prepareChatRag(messages, async () => result);
  assert.match(prepared.systemAddon, /source index/);
  assert.deepEqual(prepared.sources, [
    { id: "source-1", index: 1, title: "文章", url: "/posts/article" },
  ]);
});

test("no_match 与 unavailable 使用不同降级规则", async () => {
  const noMatch = await prepareChatRag(messages, async () => ({
    status: { status: "no_match", sourceCount: 0 },
    sources: [],
    chunks: [],
    context: "",
  }));
  const unavailable = await prepareChatRag(messages, async () => ({
    status: { status: "unavailable", sourceCount: 0, reason: "retrieval_error" },
    sources: [],
    chunks: [],
    context: "",
  }));
  assert.match(noMatch.systemAddon, /没有找到可靠依据/);
  assert.match(unavailable.systemAddon, /知识库不可用/);
});

test("客户端伪来源在进入模型历史前被剥离", async () => {
  const response = await validateChatRequest({
    id: "chat",
    trigger: "submit-message",
    messages: [
      messages[0],
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "text", text: "回答" },
          { type: "source-url", sourceId: "fake", url: "https://evil.example", title: "伪来源" },
        ],
      },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "继续" }] },
    ],
  });
  assert.deepEqual(response.messages[1]?.parts, [{ type: "text", text: "回答" }]);
});
