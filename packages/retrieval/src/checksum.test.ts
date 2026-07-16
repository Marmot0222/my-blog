import assert from "node:assert/strict";
import test from "node:test";

import type { Post } from "@ting-lab/content";

import { CHUNK_ALGORITHM_VERSION, createDocumentChecksum } from "./checksum";
import type { EmbeddingConfig } from "./types";

const post: Post = {
  metadata: {
    slug: "fixture",
    title: "Fixture",
    description: "Description",
    date: "2026-07-16",
    tags: ["Test"],
    category: "Test",
    published: true,
    featured: false,
    kind: "article",
    readingTime: "约 1 分钟阅读",
  },
  content: "## Heading\n\nContent",
};
const embedding: EmbeddingConfig = {
  provider: "openai",
  model: "embedding-model",
  dimensions: 1536,
  apiKey: "fixture-key",
  batchSize: 32,
  maxRetries: 2,
};

test("checksum 稳定且内容、模型和算法输入会影响结果", () => {
  const checksum = createDocumentChecksum(post, embedding);
  assert.equal(checksum, createDocumentChecksum(post, embedding));
  assert.notEqual(
    checksum,
    createDocumentChecksum({ ...post, content: `${post.content}!` }, embedding),
  );
  assert.notEqual(checksum, createDocumentChecksum(post, { ...embedding, model: "other-model" }));
  assert.match(CHUNK_ALGORITHM_VERSION, /^mdast-/);
});
