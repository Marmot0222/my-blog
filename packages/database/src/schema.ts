import {
  boolean,
  date,
  halfvec,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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

// Business records are authoritative and must be backed up. They are not part
// of the disposable documents/document_chunks retrieval index.
export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  version: integer("version").default(1).notNull(),
  workingRevision: integer("working_revision").default(1).notNull(),
  publishedRevision: integer("published_revision"),
  everPublished: boolean("ever_published").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  importChecksum: text("import_checksum"),
  embeddingFingerprint: text("embedding_fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).defaultNow().notNull(),
});

export const articleRevisions = pgTable(
  "article_revisions",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id),
    revision: integer("revision").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    body: text("body").notNull(),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.revision] })],
);

export const publishingTasks = pgTable(
  "publishing_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id),
    revision: integer("revision").notNull(),
    operation: text("operation").notNull(),
    fingerprint: text("fingerprint").notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("publishing_task_identity").on(
      table.articleId,
      table.revision,
      table.operation,
      table.fingerprint,
    ),
  ],
);

export const adminCredentials = pgTable("admin_credentials", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const adminSessions = pgTable("admin_sessions", {
  idHash: text("id_hash").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const adminRateLimits = pgTable("admin_rate_limits", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const modelProfiles = pgTable("model_profiles", {
  name: text("name").primaryKey(),
  version: integer("version").default(1).notNull(),
  // profile never contains plaintext credentials; key envelopes are separate.
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull(),
  keyEnvelope: jsonb("key_envelope").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    embedding: halfvec("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("document_chunks_document_chunk_unique").on(table.documentId, table.chunkIndex),
    index("document_chunks_document_id_idx").on(table.documentId),
    index("document_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops"),
    ),
  ],
);
