import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import type * as schema from "./schema";

export const EMBEDDING_DIMENSIONS = 2048;

export type TingLabDatabase = NodePgDatabase<typeof schema>;

export type DatabaseRuntime = Readonly<{
  db: TingLabDatabase;
  pool: Pool;
  close(): Promise<void>;
}>;

export type DocumentState = Readonly<{
  id: string;
  slug: string;
  contentChecksum: string;
  isPublished: boolean;
}>;

export type IndexedDocument = Readonly<{
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  contentChecksum: string;
  sourcePath: string;
  isPublished: boolean;
}>;

export type IndexedChunk = Readonly<{
  chunkIndex: number;
  heading?: string;
  anchor?: string;
  content: string;
  contentHash: string;
  tokenCount: number;
  embedding: number[];
}>;

export type ChunkSearchResult = Readonly<{
  chunkId: string;
  documentSlug: string;
  title: string;
  heading?: string;
  anchor?: string;
  content: string;
  similarity: number;
}>;
