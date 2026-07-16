import path from "node:path";

import { createContentRepository } from "@ting-lab/content";
import { createIsolatedDatabase } from "@ting-lab/database";

import { parseEmbeddingConfig } from "./config";
import { createEmbeddingService } from "./embedding";
import { indexPublishedPosts } from "./indexer";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const postsDirectory = path.resolve(
  args.find((argument) => !argument.startsWith("--")) ?? "content/posts",
);
const dryRun = args.includes("--dry-run");
const environment = { ...process.env };
const database = createIsolatedDatabase(environment);

try {
  const embeddingConfig = parseEmbeddingConfig(environment);
  const stats = await indexPublishedPosts({
    repository: createContentRepository({ postsDirectory }),
    postsDirectory,
    database,
    embeddingConfig,
    embeddingService: dryRun ? undefined : createEmbeddingService(embeddingConfig),
    dryRun,
  });
  console.info(
    `${dryRun ? "索引计划" : "索引完成"}：新增 ${stats.added}，更新 ${stats.updated}，删除 ${stats.deleted}，跳过 ${stats.skipped}。`,
  );
} finally {
  await database.close();
}
