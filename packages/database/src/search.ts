import { cosineDistance, desc, eq, gte, sql } from "drizzle-orm";

import { documentChunks, documents } from "./schema";
import { EMBEDDING_DIMENSIONS, type ChunkSearchResult, type TingLabDatabase } from "./types";

export async function searchDocumentChunks(
  db: TingLabDatabase,
  embedding: readonly number[],
  options: Readonly<{ limit: number; similarityThreshold: number }>,
): Promise<ChunkSearchResult[]> {
  if (
    embedding.length !== EMBEDDING_DIMENSIONS ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`查询向量必须包含 ${EMBEDDING_DIMENSIONS} 个有限数值`);
  }

  const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, [...embedding])})`;
  const rows = await db
    .select({
      chunkId: documentChunks.id,
      documentSlug: documents.slug,
      title: documents.title,
      heading: documentChunks.heading,
      anchor: documentChunks.anchor,
      content: documentChunks.content,
      similarity,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(sql`${documents.isPublished} = true and ${gte(similarity, options.similarityThreshold)}`)
    .orderBy(desc(similarity), documents.slug, documentChunks.chunkIndex)
    .limit(options.limit);

  return rows.map((row) => ({
    ...row,
    heading: row.heading ?? undefined,
    anchor: row.anchor ?? undefined,
    similarity: Number(row.similarity),
  }));
}
