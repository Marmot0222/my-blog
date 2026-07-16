import { eq, inArray } from "drizzle-orm";

import { documentChunks, documents } from "./schema";
import type { DocumentState, IndexedChunk, IndexedDocument, TingLabDatabase } from "./types";

export async function listDocumentStates(db: TingLabDatabase): Promise<DocumentState[]> {
  return db
    .select({
      id: documents.id,
      slug: documents.slug,
      contentChecksum: documents.contentChecksum,
      isPublished: documents.isPublished,
    })
    .from(documents)
    .orderBy(documents.slug);
}

export async function replaceDocumentIndex(
  db: TingLabDatabase,
  document: IndexedDocument,
  chunks: readonly IndexedChunk[],
): Promise<void> {
  await db.transaction(async (transaction) => {
    const [stored] = await transaction
      .insert(documents)
      .values({ ...document, updatedAt: document.updatedAt ?? null, indexedAt: new Date() })
      .onConflictDoUpdate({
        target: documents.slug,
        set: {
          title: document.title,
          description: document.description,
          category: document.category,
          publishedAt: document.publishedAt,
          updatedAt: document.updatedAt ?? null,
          contentChecksum: document.contentChecksum,
          sourcePath: document.sourcePath,
          isPublished: document.isPublished,
          indexedAt: new Date(),
        },
      })
      .returning({ id: documents.id });

    if (!stored) {
      throw new Error("文档索引写入失败");
    }

    await transaction.delete(documentChunks).where(eq(documentChunks.documentId, stored.id));
    if (chunks.length > 0) {
      await transaction.insert(documentChunks).values(
        chunks.map((chunk) => ({
          ...chunk,
          heading: chunk.heading ?? null,
          anchor: chunk.anchor ?? null,
          documentId: stored.id,
        })),
      );
    }
  });
}

export async function deleteDocumentIndexes(
  db: TingLabDatabase,
  slugs: readonly string[],
): Promise<number> {
  if (slugs.length === 0) return 0;
  const deleted = await db
    .delete(documents)
    .where(inArray(documents.slug, [...slugs]))
    .returning({ id: documents.id });
  return deleted.length;
}
