import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabase } from "./client";
import { deleteDocumentIndexes, replaceDocumentIndex } from "./documents";
import { searchDocumentChunks } from "./search";

const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? test : test.skip;

integration("文档替换、级联删除与相似度排序", async () => {
  assert.ok(testUrl);
  const runtime = createDatabase({ DATABASE_URL: testUrl, DATABASE_POOL_MAX: "1" });
  const migrationFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../migrations",
  );
  const vectorA = Array.from({ length: 2048 }, (_, index) => (index === 0 ? 1 : 0));
  const vectorB = Array.from({ length: 2048 }, (_, index) => (index === 1 ? 1 : 0));

  try {
    await migrate(runtime.db, { migrationsFolder: migrationFolder });
    await runtime.db.execute(sql`delete from documents where slug like 'integration-%'`);
    await replaceDocumentIndex(
      runtime.db,
      {
        slug: "integration-vector",
        title: "Integration",
        description: "test",
        category: "test",
        publishedAt: "2026-07-16",
        contentChecksum: "checksum",
        sourcePath: "fixture.mdx",
        isPublished: true,
      },
      [
        { chunkIndex: 0, content: "near", contentHash: "a", tokenCount: 1, embedding: vectorA },
        { chunkIndex: 1, content: "far", contentHash: "b", tokenCount: 1, embedding: vectorB },
      ],
    );
    const results = await searchDocumentChunks(runtime.db, vectorA, {
      limit: 4,
      similarityThreshold: 0.5,
    });
    assert.equal(results[0]?.content, "near");
    assert.ok(results.every((result) => result.similarity >= 0.5));
    assert.equal(await deleteDocumentIndexes(runtime.db, ["integration-vector"]), 1);
    assert.equal(
      Number(
        (
          await runtime.db.execute<{ count: string }>(
            sql`select count(*) from document_chunks dc join documents d on d.id = dc.document_id where d.slug = 'integration-vector'`,
          )
        ).rows[0]?.count ?? "0",
      ),
      0,
    );
  } finally {
    await runtime.close();
  }
});
