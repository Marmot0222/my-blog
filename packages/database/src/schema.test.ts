import assert from "node:assert/strict";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import { documentChunks, documents } from "./schema";
import { EMBEDDING_DIMENSIONS } from "./types";

test("Schema 固定向量维度并声明关键索引与外键", () => {
  const documentConfig = getTableConfig(documents);
  const chunkConfig = getTableConfig(documentChunks);
  assert.equal(EMBEDDING_DIMENSIONS, 1536);
  assert.ok(documentConfig.indexes.some((entry) => entry.config.name === "documents_slug_unique"));
  assert.ok(
    chunkConfig.indexes.some((entry) => entry.config.name === "document_chunks_embedding_hnsw_idx"),
  );
  assert.ok(chunkConfig.foreignKeys.length > 0);
});
