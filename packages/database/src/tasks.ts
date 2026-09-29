import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { createDatabase } from "./client";
import type { ArticleRecord } from "./publishing";
import type { ChunkSearchResult, DatabaseRuntime, IndexedChunk, IndexedDocument } from "./types";

export type PublishingTask = {
  id: string;
  article_id: string;
  revision: number;
  operation: "index" | "remove";
  fingerprint: string;
  lease_token: string;
  attempts: number;
};
export const taskSource = (task: Pick<PublishingTask, "article_id" | "revision" | "fingerprint">) =>
  `database:${task.article_id}:${task.revision}:${task.fingerprint}`;
export function createTaskStore(runtime: DatabaseRuntime = createDatabase()) {
  const { pool } = runtime;
  async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    async claim(): Promise<PublishingTask | undefined> {
      return transaction(async (client) => {
        await client.query(
          "UPDATE publishing_tasks SET status='failed',error_code='LEASE_EXPIRED',lease_token=NULL WHERE status='running' AND lease_until<now() AND attempts>=3",
        );
        const result = await client.query<PublishingTask>(
          `UPDATE publishing_tasks SET status='running',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '5 minutes'
          WHERE id=(SELECT id FROM publishing_tasks WHERE attempts<3 AND ((status='pending' AND available_at<=now()) OR (status='running' AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
          [randomUUID()],
        );
        return result.rows[0];
      });
    },
    async read(task: PublishingTask) {
      return (
        await pool.query<ArticleRecord>(
          `SELECT a.*,r.metadata,r.body,r.checksum FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=$2
        WHERE a.id=$1 AND a.published_revision=$2 AND a.embedding_fingerprint=$3 AND a.deleted_at IS NULL`,
          [task.article_id, task.revision, task.fingerprint],
        )
      ).rows[0];
    },
    async indexed(task: PublishingTask, checksum: string) {
      return Boolean(
        (
          await pool.query(
            "SELECT id FROM documents WHERE source_path LIKE $1 AND content_checksum=$2 AND is_published=true",
            [`database:${task.article_id}:%:${task.fingerprint}`, checksum],
          )
        ).rowCount,
      );
    },
    async finish(
      task: PublishingTask,
      index?: { document: IndexedDocument; chunks: readonly IndexedChunk[] },
      reuseChecksum?: string,
    ) {
      return transaction(async (client) => {
        // All writers lock article before task; lease token rejects late workers.
        const row = (
          await client.query<ArticleRecord>("SELECT * FROM articles WHERE id=$1 FOR UPDATE", [
            task.article_id,
          ])
        ).rows[0];
        const lease = await client.query(
          "SELECT id FROM publishing_tasks WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now() FOR UPDATE",
          [task.id, task.lease_token],
        );
        if (!lease.rowCount) return false;
        const eligible =
          row &&
          !row.deleted_at &&
          row.published_revision === task.revision &&
          row.embedding_fingerprint === task.fingerprint;
        if (task.operation === "remove" && row?.published_revision === null)
          await client.query("DELETE FROM documents WHERE slug=$1", [row.slug]);
        if (task.operation === "index" && eligible && reuseChecksum)
          await client.query(
            "UPDATE documents SET source_path=$1,indexed_at=now() WHERE slug=$2 AND content_checksum=$3 AND source_path LIKE $4",
            [
              taskSource(task),
              row.slug,
              reuseChecksum,
              `database:${task.article_id}:%:${task.fingerprint}`,
            ],
          );
        if (task.operation === "index" && eligible && index) {
          const d = index.document;
          const document = (
            await client.query<{ id: string }>(
              `INSERT INTO documents(slug,title,description,category,published_at,updated_at,content_checksum,source_path,is_published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)
            ON CONFLICT(slug) DO UPDATE SET title=$2,description=$3,category=$4,published_at=$5,updated_at=$6,content_checksum=$7,source_path=$8,is_published=true,indexed_at=now() RETURNING id`,
              [
                row.slug,
                d.title,
                d.description,
                d.category,
                d.publishedAt,
                d.updatedAt ?? null,
                d.contentChecksum,
                taskSource(task),
              ],
            )
          ).rows[0];
          await client.query("DELETE FROM document_chunks WHERE document_id=$1", [document.id]);
          for (const c of index.chunks)
            await client.query(
              "INSERT INTO document_chunks(document_id,chunk_index,heading,anchor,content,content_hash,token_count,embedding) VALUES($1,$2,$3,$4,$5,$6,$7,$8::halfvec)",
              [
                document.id,
                c.chunkIndex,
                c.heading ?? null,
                c.anchor ?? null,
                c.content,
                c.contentHash,
                c.tokenCount,
                JSON.stringify(c.embedding),
              ],
            );
        }
        await client.query(
          "UPDATE publishing_tasks SET status='succeeded',error_code=$3,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",
          [
            task.id,
            task.lease_token,
            eligible || task.operation === "remove" ? null : "SUPERSEDED",
          ],
        );
        return true;
      });
    },
    async fail(task: PublishingTask) {
      await pool.query(
        `UPDATE publishing_tasks SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,
      error_code='INDEX_UNAVAILABLE',available_at=now()+interval '30 seconds',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND status='running'`,
        [task.id, task.lease_token],
      );
    },
    async search(
      embedding: readonly number[],
      options: { limit: number; similarityThreshold: number },
      fingerprint: string,
    ): Promise<ChunkSearchResult[]> {
      if (embedding.length !== 2048 || embedding.some((value) => !Number.isFinite(value)))
        throw new Error("Invalid query vector");
      const rows = await pool.query<ChunkSearchResult>(
        `SELECT c.id AS "chunkId",d.slug AS "documentSlug",d.title,c.heading,c.anchor,c.content,1-(c.embedding <=> $1::halfvec) AS similarity
        FROM document_chunks c JOIN documents d ON d.id=c.document_id JOIN articles a ON a.slug=d.slug
        WHERE a.deleted_at IS NULL AND a.published_revision IS NOT NULL AND a.embedding_fingerprint=$2 AND d.is_published=true
        AND d.source_path='database:'||a.id::text||':'||a.published_revision::text||':'||a.embedding_fingerprint
        AND 1-(c.embedding <=> $1::halfvec)>=$3 ORDER BY similarity DESC,d.slug,c.chunk_index LIMIT $4`,
        [JSON.stringify(embedding), fingerprint, options.similarityThreshold, options.limit],
      );
      return rows.rows;
    },
    async enqueuePublished(fingerprint: string) {
      return transaction(async (client) => {
        const rows = await client.query<{ id: string; published_revision: number }>(
          "SELECT id,published_revision FROM articles WHERE published_revision IS NOT NULL AND deleted_at IS NULL FOR UPDATE",
        );
        for (const row of rows.rows) {
          await client.query("UPDATE articles SET embedding_fingerprint=$2 WHERE id=$1", [
            row.id,
            fingerprint,
          ]);
          await client.query(
            "INSERT INTO publishing_tasks(article_id,revision,operation,fingerprint) VALUES($1,$2,'index',$3) ON CONFLICT(article_id,revision,operation,fingerprint) DO UPDATE SET status='pending',attempts=0,available_at=now(),lease_token=NULL,lease_until=NULL",
            [row.id, row.published_revision, fingerprint],
          );
        }
        return rows.rowCount;
      });
    },
  };
}
