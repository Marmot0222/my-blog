import assert from "node:assert/strict";
import test from "node:test";

import type { TingLabDatabase } from "@ting-lab/database";

import { retrieveRelevantChunks, selectContextChunks } from "./retrieve";
import type { EmbeddingService, RetrievedChunk, RetrievalConfig } from "./types";

const config: RetrievalConfig = { topK: 3, similarityThreshold: 0.55, maxContextChars: 1000 };
const rows: RetrievedChunk[] = [
  { chunkId: "1", documentSlug: "a", title: "A", content: "A1", similarity: 0.9 },
  { chunkId: "2", documentSlug: "a", title: "A", content: "A2", similarity: 0.8 },
  { chunkId: "3", documentSlug: "a", title: "A", content: "A3", similarity: 0.7 },
  { chunkId: "4", documentSlug: "b", title: "B", content: "B1", similarity: 0.6 },
];

test("结果按相似度排序并限制单篇文章占比", () => {
  assert.deepEqual(
    selectContextChunks(rows, config).map((row) => row.chunkId),
    ["1", "2", "4"],
  );
});

test("fake Embedding 与查询返回 used/no_match，不访问真实服务", async () => {
  const embedding: EmbeddingService = {
    embedMany: async () => [],
    embedOne: async () => Array.from({ length: 2048 }, () => 0),
  };
  const db = {} as TingLabDatabase;
  const used = await retrieveRelevantChunks({
    query: "test",
    config,
    embedding,
    db,
    search: async () => rows,
  });
  assert.equal(used.status.status, "used");
  const noMatch = await retrieveRelevantChunks({
    query: "test",
    config,
    embedding,
    db,
    search: async () => [],
  });
  assert.equal(noMatch.status.status, "no_match");
});
