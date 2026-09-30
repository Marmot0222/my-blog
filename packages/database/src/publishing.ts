import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { createDatabase } from "./client";
import type { DatabaseRuntime } from "./types";

export type RevisionInput = Readonly<{
  slug: string;
  metadata: Record<string, unknown>;
  body: string;
  checksum: string;
  mediaIds?: readonly string[];
}>;
export type ArticleRecord = {
  id: string;
  slug: string;
  version: number;
  working_revision: number;
  published_revision: number | null;
  ever_published: boolean;
  deleted_at: Date | null;
  import_checksum: string | null;
  embedding_fingerprint: string | null;
  modified_at: Date;
  metadata: Record<string, unknown>;
  body: string;
  checksum: string;
  index_status?: string;
  index_error?: string | null;
};
export class PublishingConflict extends Error {
  constructor(public readonly code: "conflict" | "slug-locked" | "not-found" | "deleted") {
    super(code);
  }
}

export function createPublishingStore(runtime: DatabaseRuntime = createDatabase()) {
  const { pool } = runtime;
  async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
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
  const joined = `SELECT a.*, r.metadata, r.body, r.checksum,
    (SELECT status FROM publishing_tasks t WHERE t.article_id=a.id ORDER BY CASE WHEN t.revision=a.published_revision AND t.fingerprint=a.embedding_fingerprint AND t.operation='index' THEN 0 ELSE 1 END,created_at DESC LIMIT 1) AS index_status,
    (SELECT error_code FROM publishing_tasks t WHERE t.article_id=a.id ORDER BY CASE WHEN t.revision=a.published_revision AND t.fingerprint=a.embedding_fingerprint AND t.operation='index' THEN 0 ELSE 1 END,created_at DESC LIMIT 1) AS index_error
    FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=`;
  async function read(id: string, client: Pick<PoolClient, "query"> = pool) {
    const result = await client.query<ArticleRecord>(`${joined}a.working_revision WHERE a.id=$1`, [
      id,
    ]);
    if (!result.rows[0]) throw new PublishingConflict("not-found");
    return result.rows[0];
  }
  async function revision(client: PoolClient, id: string, number: number, input: RevisionInput) {
    await client.query(
      "INSERT INTO article_revisions(article_id,revision,metadata,body,checksum) VALUES($1,$2,$3,$4,$5)",
      [id, number, input.metadata, input.body, input.checksum],
    );
    for (const mediaId of input.mediaIds ?? [])
      await client.query(
        "INSERT INTO article_media_references(article_id,revision,media_id) VALUES($1,$2,$3)",
        [id, number, mediaId],
      );
  }
  async function enqueue(
    client: PoolClient,
    id: string,
    rev: number,
    operation: string,
    fingerprint: string,
  ) {
    await client.query(
      `INSERT INTO publishing_tasks(article_id,revision,operation,fingerprint) VALUES($1,$2,$3,$4)
      ON CONFLICT(article_id,revision,operation,fingerprint) DO UPDATE SET status='pending',attempts=0,lease_token=NULL,lease_until=NULL,available_at=now(),error_code=NULL`,
      [id, rev, operation, fingerprint],
    );
  }
  async function create(client: PoolClient, input: RevisionInput, importChecksum?: string) {
    const id = randomUUID();
    await client.query("INSERT INTO articles(id,slug,import_checksum) VALUES($1,$2,$3)", [
      id,
      input.slug,
      importChecksum ?? null,
    ]);
    await revision(client, id, 1, input);
    return id;
  }
  return {
    read,
    async mediaAccessStates(ids: readonly string[]) {
      return (
        await pool.query<{ media_id: string; published: boolean }>(
          `SELECT r.media_id,BOOL_OR(r.revision=a.published_revision AND a.deleted_at IS NULL) IS TRUE AS published
         FROM article_media_references r JOIN articles a ON a.id=r.article_id WHERE r.media_id=ANY($1::uuid[]) GROUP BY r.media_id`,
          [ids],
        )
      ).rows;
    },
    async mediaReferences(id: string) {
      return (
        await pool.query<{
          article_id: string;
          revision: number;
          working: boolean;
          published: boolean;
        }>(
          `SELECT r.article_id,r.revision,r.revision=a.working_revision AS working,
        (r.revision=a.published_revision AND a.deleted_at IS NULL) AS published
        FROM article_media_references r JOIN articles a ON a.id=r.article_id WHERE r.media_id=$1`,
          [id],
        )
      ).rows;
    },
    async mediaIsPublished(id: string) {
      return Boolean(
        (
          await pool.query(
            `SELECT 1 FROM article_media_references r JOIN articles a ON a.id=r.article_id
         WHERE r.media_id=$1 AND r.revision=a.published_revision AND a.deleted_at IS NULL LIMIT 1`,
            [id],
          )
        ).rowCount,
      );
    },
    async querySummaries(input: {
      q?: string;
      kind?: string;
      category?: string;
      tag?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    }) {
      const q = (input.q ?? "").trim().slice(0, 120);
      const kind = input.kind ?? "";
      const category = input.category ?? "";
      const tag = input.tag ?? "";
      const status = ["published", "draft", "deleted"].includes(input.status ?? "")
        ? input.status!
        : "";
      const pageSize = [10, 20, 50].includes(Number(input.pageSize)) ? Number(input.pageSize) : 20;
      const requested =
        /^\d+$/.test(input.page ?? "") && Number.isSafeInteger(Number(input.page))
          ? Math.max(1, Number(input.page))
          : 1;
      const where = ` FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=a.working_revision
        WHERE ($1='' OR strpos(lower(r.metadata->>'title'),lower($1))>0)
        AND ($2='' OR r.metadata->>'kind'=$2)
        AND ($4='' OR r.metadata->>'category'=$4)
        AND ($5='' OR (r.metadata->'tags') ? $5)
        AND (CASE WHEN $3='deleted' THEN a.deleted_at IS NOT NULL ELSE a.deleted_at IS NULL END)
        AND ($3 NOT IN ('published','draft') OR ($3='published' AND a.published_revision IS NOT NULL) OR ($3='draft' AND a.published_revision IS NULL))`;
      return transaction(async (client) => {
        await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
        const count = await client.query<{ total: string }>(`SELECT COUNT(*) AS total${where}`, [
          q,
          kind,
          status,
          category,
          tag,
        ]);
        const total = Number(count.rows[0].total);
        const pageCount = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(requested, pageCount);
        const result = await client.query<
          Pick<
            ArticleRecord,
            | "id"
            | "slug"
            | "version"
            | "working_revision"
            | "published_revision"
            | "deleted_at"
            | "modified_at"
            | "index_status"
          > & { title: string; kind: string; category: string }
        >(
          `SELECT a.id,a.slug,a.version,a.working_revision,a.published_revision,a.deleted_at,a.modified_at,
          r.metadata->>'title' AS title,r.metadata->>'kind' AS kind,r.metadata->>'category' AS category,
          (SELECT status FROM publishing_tasks t WHERE t.article_id=a.id ORDER BY CASE WHEN t.revision=a.published_revision AND t.fingerprint=a.embedding_fingerprint AND t.operation='index' THEN 0 ELSE 1 END,t.created_at DESC,t.id LIMIT 1) AS index_status
          ${where} ORDER BY a.modified_at DESC,a.id LIMIT $6 OFFSET $7`,
          [q, kind, status, category, tag, pageSize, (page - 1) * pageSize],
        );
        const facets = await client.query<{ category: string; tags: string[] }>(
          `SELECT DISTINCT r.metadata->>'category' AS category,r.metadata->'tags' AS tags
           FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=a.working_revision
           WHERE a.deleted_at IS NULL`,
        );
        const categories = [...new Set(facets.rows.map((row) => row.category))].sort();
        const tags = [...new Set(facets.rows.flatMap((row) => row.tags))].sort();
        return {
          rows: result.rows,
          total,
          page,
          pageCount,
          pageSize,
          q,
          kind,
          status,
          category,
          tag,
          categories,
          tags,
        };
      });
    },
    async exportContent() {
      const result = await pool.query<{
        id: string;
        slug: string;
        version: number;
        working_revision: number;
        published_revision: number | null;
        deleted_at: Date | null;
        revision: number;
        metadata: Record<string, unknown>;
        body: string;
        checksum: string;
      }>(
        "SELECT a.id,a.slug,a.version,a.working_revision,a.published_revision,a.deleted_at,r.revision,r.metadata,r.body,r.checksum FROM articles a JOIN article_revisions r ON r.article_id=a.id ORDER BY a.slug,r.revision",
      );
      return result.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        version: row.version,
        workingRevision: row.working_revision,
        publishedRevision: row.published_revision,
        deleted: !!row.deleted_at,
        revision: row.revision,
        checksum: row.checksum,
        mdx: `---\n${JSON.stringify({ ...row.metadata, published: row.published_revision === row.revision && !row.deleted_at }, null, 2)}\n---\n\n${row.body}\n`,
      }));
    },
    async list() {
      return (
        await pool.query<ArticleRecord>(
          `${joined}a.working_revision ORDER BY a.modified_at DESC,a.id`,
        )
      ).rows;
    },
    async published() {
      return (
        await pool.query<ArticleRecord>(
          `${joined}a.published_revision WHERE a.deleted_at IS NULL ORDER BY a.slug`,
        )
      ).rows;
    },
    async create(input: RevisionInput) {
      return transaction(async (client) => read(await create(client, input), client));
    },
    async save(id: string, version: number, input: RevisionInput) {
      return transaction(async (client) => {
        await client.query("SELECT id FROM articles WHERE id=$1 FOR UPDATE", [id]);
        const row = await read(id, client);
        if (row.version !== version) throw new PublishingConflict("conflict");
        if (row.deleted_at) throw new PublishingConflict("deleted");
        if (row.ever_published && row.slug !== input.slug)
          throw new PublishingConflict("slug-locked");
        await revision(client, id, row.working_revision + 1, input);
        await client.query(
          "UPDATE articles SET slug=$2,working_revision=working_revision+1,version=version+1,modified_at=now() WHERE id=$1",
          [id, input.slug],
        );
        return read(id, client);
      });
    },
    async change(
      id: string,
      version: number,
      action: "publish" | "unpublish" | "delete" | "restore",
      fingerprint: string,
    ) {
      return transaction(async (client) => {
        await client.query("SELECT id FROM articles WHERE id=$1 FOR UPDATE", [id]);
        const row = await read(id, client);
        if (row.version !== version) throw new PublishingConflict("conflict");
        if (row.deleted_at && action !== "restore") throw new PublishingConflict("deleted");
        const published = action === "publish" ? row.working_revision : null;
        await client.query(
          `UPDATE articles SET version=version+1,published_revision=$2,
          ever_published=ever_published OR $3,deleted_at=CASE WHEN $4 THEN now() ELSE NULL END,
          embedding_fingerprint=$5,modified_at=now() WHERE id=$1`,
          [
            id,
            published,
            action === "publish",
            action === "delete",
            published ? fingerprint : null,
          ],
        );
        if (action !== "restore")
          await enqueue(
            client,
            id,
            row.working_revision,
            published ? "index" : "remove",
            fingerprint,
          );
        return read(id, client);
      });
    },
    async importBatch(
      inputs: readonly (RevisionInput & { published: boolean })[],
      apply: boolean,
      fingerprint: string,
    ) {
      return transaction(async (client) => {
        // Lock serializes imports; each batch either fully commits or does nothing.
        await client.query("SELECT pg_advisory_xact_lock(711102)");
        const report: {
          slug: string;
          checksum: string;
          status: "new" | "unchanged" | "conflict";
        }[] = [];
        for (const input of inputs) {
          const found = await client.query<ArticleRecord>(
            "SELECT * FROM articles WHERE slug=$1 FOR UPDATE",
            [input.slug],
          );
          const old = found.rows[0];
          report.push({
            slug: input.slug,
            checksum: input.checksum,
            status: !old
              ? "new"
              : old.import_checksum === input.checksum && old.working_revision === 1
                ? "unchanged"
                : "conflict",
          });
        }
        if (apply && !report.some((item) => item.status === "conflict")) {
          for (const [index, input] of inputs.entries()) {
            if (report[index].status !== "new") continue;
            const id = await create(client, input, input.checksum);
            if (input.published) {
              await client.query(
                "UPDATE articles SET published_revision=1,ever_published=true,embedding_fingerprint=$2 WHERE id=$1",
                [id, fingerprint],
              );
              await enqueue(client, id, 1, "index", fingerprint);
            }
          }
        }
        return report;
      });
    },
    async retry(id: string) {
      return (
        await pool.query(
          "UPDATE publishing_tasks SET status='pending',attempts=0,available_at=now(),error_code=NULL WHERE article_id=$1 AND status='failed' RETURNING id",
          [id],
        )
      ).rowCount;
    },
    async credentials() {
      return (
        await pool.query<{ password_hash: string }>(
          "SELECT password_hash FROM admin_credentials WHERE id=1",
        )
      ).rows[0]?.password_hash;
    },
    async setPassword(hash: string, onlyIfMissing = false) {
      return transaction(async (client) => {
        const result = await client.query(
          onlyIfMissing
            ? "INSERT INTO admin_credentials(id,password_hash) VALUES(1,$1) ON CONFLICT(id) DO NOTHING"
            : "INSERT INTO admin_credentials(id,password_hash) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET password_hash=$1,updated_at=now()",
          [hash],
        );
        if (result.rowCount === 0) return false;
        await client.query("DELETE FROM admin_sessions");
        return true;
      });
    },
    async createSession(idHash: string, expires: Date) {
      await pool.query("INSERT INTO admin_sessions(id_hash,expires_at) VALUES($1,$2)", [
        idHash,
        expires,
      ]);
    },
    async sessionValid(idHash: string) {
      return Boolean(
        (
          await pool.query(
            "SELECT id_hash FROM admin_sessions WHERE id_hash=$1 AND expires_at>now()",
            [idHash],
          )
        ).rowCount,
      );
    },
    async revokeSession(idHash: string) {
      await pool.query("DELETE FROM admin_sessions WHERE id_hash=$1", [idHash]);
    },
    async rateLimit(bucket: string, limit: number, seconds: number) {
      const result = await pool.query<{ count: number }>(
        `INSERT INTO admin_rate_limits(bucket,count,expires_at) VALUES($1,1,now()+$2*interval '1 second')
        ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN admin_rate_limits.expires_at<now() THEN 1 ELSE admin_rate_limits.count+1 END,
        expires_at=CASE WHEN admin_rate_limits.expires_at<now() THEN now()+$2*interval '1 second' ELSE admin_rate_limits.expires_at END RETURNING count`,
        [bucket, seconds],
      );
      return result.rows[0].count <= limit;
    },
  };
}
