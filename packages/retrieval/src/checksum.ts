import { createHash } from "node:crypto";

import type { Post } from "@ting-lab/content";

import type { EmbeddingConfig } from "./types";

export const CHUNK_ALGORITHM_VERSION = "mdast-h2-h3-v1";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createDocumentChecksum(post: Post, embedding: EmbeddingConfig): string {
  return sha256(
    JSON.stringify({
      slug: post.metadata.slug,
      title: post.metadata.title,
      description: post.metadata.description,
      date: post.metadata.date,
      updatedAt: post.metadata.updatedAt,
      category: post.metadata.category,
      tags: [...post.metadata.tags],
      published: post.metadata.published,
      content: post.content,
      chunkAlgorithm: CHUNK_ALGORITHM_VERSION,
      embedding: {
        provider: embedding.provider,
        model: embedding.model,
        dimensions: embedding.dimensions,
      },
    }),
  );
}
