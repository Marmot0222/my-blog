import path from "node:path";

import type { ContentRepository, Post } from "@ting-lab/content";
import type { DatabaseRuntime, DocumentState } from "@ting-lab/database";
import {
  deleteDocumentIndexes,
  listDocumentStates,
  replaceDocumentIndex,
} from "@ting-lab/database";

import { chunkMarkdown } from "./chunker";
import { createDocumentChecksum } from "./checksum";
import type { EmbeddingConfig, EmbeddingService } from "./types";

export type IndexPlanItem = Readonly<{
  post: Post;
  checksum: string;
  action: "add" | "update" | "skip";
}>;
export type IndexPlan = Readonly<{ items: IndexPlanItem[]; deleteSlugs: string[] }>;

export function createIndexPlan(
  posts: readonly Post[],
  stored: readonly DocumentState[],
  embedding: EmbeddingConfig,
): IndexPlan {
  const storedBySlug = new Map(stored.map((document) => [document.slug, document]));
  const publishedSlugs = new Set(posts.map((post) => post.metadata.slug));
  const items = posts.map((post): IndexPlanItem => {
    const checksum = createDocumentChecksum(post, embedding);
    const previous = storedBySlug.get(post.metadata.slug);
    return {
      post,
      checksum,
      action: !previous ? "add" : previous.contentChecksum === checksum ? "skip" : "update",
    };
  });
  return {
    items,
    deleteSlugs: stored
      .filter((entry) => !publishedSlugs.has(entry.slug))
      .map((entry) => entry.slug),
  };
}

export async function indexPublishedPosts(
  options: Readonly<{
    repository: ContentRepository;
    postsDirectory: string;
    database: DatabaseRuntime;
    embeddingConfig: EmbeddingConfig;
    embeddingService?: EmbeddingService;
    dryRun: boolean;
  }>,
): Promise<{ added: number; updated: number; deleted: number; skipped: number }> {
  const metadata = options.repository.getPublishedPosts();
  const posts = metadata
    .map((item) => options.repository.getPostBySlug(item.slug))
    .filter((post): post is Post => Boolean(post));
  const states = await listDocumentStates(options.database.db);
  const plan = createIndexPlan(posts, states, options.embeddingConfig);
  const stats = {
    added: plan.items.filter((item) => item.action === "add").length,
    updated: plan.items.filter((item) => item.action === "update").length,
    deleted: plan.deleteSlugs.length,
    skipped: plan.items.filter((item) => item.action === "skip").length,
  };

  if (options.dryRun) return stats;
  if (!options.embeddingService && plan.items.some((item) => item.action !== "skip")) {
    throw new Error("执行索引需要 Embedding service");
  }

  for (const item of plan.items) {
    if (item.action === "skip") continue;
    const chunks = chunkMarkdown({ title: item.post.metadata.title, content: item.post.content });
    const embeddings = await options.embeddingService!.embedMany(
      chunks.map((chunk) => chunk.content),
    );
    console.info(
      `${item.action === "add" ? "新增" : "更新"}文章索引：${item.post.metadata.slug}，${chunks.length} chunks`,
    );
    await replaceDocumentIndex(
      options.database.db,
      {
        slug: item.post.metadata.slug,
        title: item.post.metadata.title,
        description: item.post.metadata.description,
        category: item.post.metadata.category,
        publishedAt: item.post.metadata.date,
        updatedAt: item.post.metadata.updatedAt,
        contentChecksum: item.checksum,
        sourcePath: path.join(options.postsDirectory, `${item.post.metadata.slug}.mdx`),
        isPublished: true,
      },
      chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index]! })),
    );
  }
  await deleteDocumentIndexes(options.database.db, plan.deleteSlugs);
  return stats;
}
