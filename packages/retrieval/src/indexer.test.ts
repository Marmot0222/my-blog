import assert from "node:assert/strict";
import test from "node:test";

import type { Post } from "@ting-lab/content";

import { createDocumentChecksum } from "./checksum";
import { createIndexPlan } from "./indexer";
import type { EmbeddingConfig } from "./types";

const embedding: EmbeddingConfig = {
  provider: "openai",
  model: "fixture",
  dimensions: 1536,
  apiKey: "fixture",
  batchSize: 32,
  maxRetries: 0,
};
const post: Post = {
  metadata: {
    slug: "kept",
    title: "Kept",
    description: "fixture",
    date: "2026-07-16",
    tags: ["test"],
    category: "test",
    published: true,
    featured: false,
    kind: "article",
    readingTime: "约 1 分钟阅读",
  },
  content: "content",
};

test("未变化文档跳过 Embedding，并规划删除失效文档", () => {
  const checksum = createDocumentChecksum(post, embedding);
  const plan = createIndexPlan(
    [post],
    [
      { id: "1", slug: "kept", contentChecksum: checksum, isPublished: true },
      { id: "2", slug: "removed", contentChecksum: "old", isPublished: true },
    ],
    embedding,
  );
  assert.equal(plan.items[0]?.action, "skip");
  assert.deepEqual(plan.deleteSlugs, ["removed"]);
});

test("内容变化只规划对应文章更新", () => {
  const plan = createIndexPlan(
    [post, { ...post, metadata: { ...post.metadata, slug: "new" } }],
    [{ id: "1", slug: "kept", contentChecksum: "old", isPublished: true }],
    embedding,
  );
  assert.deepEqual(
    plan.items.map((item) => item.action),
    ["update", "add"],
  );
});
