import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { EMBEDDING_DIMENSIONS } from "./types";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    publishedAt: date("published_at").notNull(),
    updatedAt: date("updated_at"),
    contentChecksum: text("content_checksum").notNull(),
    sourcePath: text("source_path").notNull(),
    isPublished: boolean("is_published").notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("documents_slug_unique").on(table.slug)],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    heading: text("heading"),
    anchor: text("anchor"),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("document_chunks_document_chunk_unique").on(table.documentId, table.chunkIndex),
    index("document_chunks_document_id_idx").on(table.documentId),
    index("document_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
