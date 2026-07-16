import { createDatabase } from "@ting-lab/database";

import { parseEmbeddingConfig, parseRetrievalConfig } from "./config";
import { createEmbeddingService } from "./embedding";
import { retrieveRelevantChunks } from "./retrieve";

const query = process.argv
  .slice(2)
  .filter((argument) => argument !== "--")
  .join(" ")
  .trim();
if (!query) throw new Error('请提供查询，例如 pnpm content:search -- "Next.js 静态生成"');

const environment = { ...process.env };
const database = createDatabase(environment);
try {
  const result = await retrieveRelevantChunks({
    query,
    config: parseRetrievalConfig(environment),
    embedding: createEmbeddingService(parseEmbeddingConfig(environment)),
    db: database.db,
  });
  if (result.chunks.length === 0) {
    console.info("没有达到相似度阈值的博客内容。");
  } else {
    for (const chunk of result.chunks) {
      const preview = chunk.content.replaceAll("\n", " ").slice(0, 180);
      console.info(
        `${chunk.title}${chunk.heading ? ` / ${chunk.heading}` : ""} | ${chunk.similarity.toFixed(3)}\n${preview}`,
      );
    }
  }
} finally {
  await database.close();
}
