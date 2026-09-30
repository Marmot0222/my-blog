import { Pool } from "pg";
import { randomUUID } from "node:crypto";

export type MediaAsset = {
  id: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  checksum: string;
  filename: string;
  created_at: Date;
  upload_session: string;
  protected: boolean;
};
const columns =
  "a.id,a.mime,a.width,a.height,a.bytes,a.checksum,a.filename,a.created_at,a.upload_session,EXISTS(SELECT 1 FROM media_pins p WHERE p.asset_id=a.id) AS protected";
/** Separate database, separate login; never uses the blog database accessor. */
export function createMediaStore(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  async function transaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    close: () => pool.end(),
    health: async () => {
      await pool.query("SELECT id FROM media_assets LIMIT 0");
    },
    async put(
      app: string,
      owner: string,
      input: Omit<MediaAsset, "id" | "created_at" | "protected">,
      data: Buffer,
    ) {
      const id = randomUUID();
      await transaction(async (client) => {
        await client.query(
          "INSERT INTO media_assets(id,app,owner,mime,width,height,bytes,checksum,filename,upload_session) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            id,
            app,
            owner,
            input.mime,
            input.width,
            input.height,
            input.bytes,
            input.checksum,
            input.filename,
            input.upload_session,
          ],
        );
        await client.query("INSERT INTO media_binary(asset_id,data) VALUES($1,$2)", [id, data]);
      });
      return id;
    },
    async list(app: string, owner: string, page: number) {
      const result = await pool.query<MediaAsset>(
        `SELECT ${columns} FROM media_assets a WHERE a.app=$1 AND a.owner=$2 ORDER BY a.created_at DESC,a.id LIMIT 21 OFFSET $3`,
        [app, owner, (page - 1) * 20],
      );
      return { items: result.rows.slice(0, 20), hasNext: result.rows.length > 20, page };
    },
    async metadata(app: string, owner: string, id: string) {
      return (
        await pool.query<MediaAsset>(
          `SELECT ${columns} FROM media_assets a WHERE a.app=$1 AND a.owner=$2 AND a.id=$3`,
          [app, owner, id],
        )
      ).rows[0];
    },
    async bytes(app: string, owner: string, id: string) {
      return (
        await pool.query<{ data: Buffer }>(
          "SELECT b.data FROM media_binary b JOIN media_assets a ON a.id=b.asset_id WHERE a.app=$1 AND a.owner=$2 AND a.id=$3",
          [app, owner, id],
        )
      ).rows[0]?.data;
    },
    async pins(app: string, owner: string, id: string) {
      return (
        await pool.query<{ operation: string }>(
          "SELECT p.operation FROM media_pins p JOIN media_assets a ON a.id=p.asset_id WHERE a.app=$1 AND a.owner=$2 AND a.id=$3 ORDER BY p.operation",
          [app, owner, id],
        )
      ).rows;
    },
    /** Monotonic prepare phase. A failed blog commit can leave a conservative pin, never public access. */
    async pin(app: string, owner: string, operation: string, ids: string[]) {
      return transaction(async (client) => {
        const rows = await client.query(
          "SELECT id FROM media_assets WHERE app=$1 AND owner=$2 AND id=ANY($3::uuid[]) ORDER BY id FOR UPDATE",
          [app, owner, ids],
        );
        if (rows.rowCount !== ids.length) throw new Error("missing-asset");
        for (const id of ids)
          await client.query(
            "INSERT INTO media_pins(asset_id,operation) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [id, operation],
          );
      });
    },
    async remove(app: string, owner: string, id: string) {
      return transaction(async (client) => {
        const asset = await client.query(
          "SELECT id FROM media_assets WHERE app=$1 AND owner=$2 AND id=$3 FOR UPDATE",
          [app, owner, id],
        );
        if (!asset.rowCount) return false;
        const pins = await client.query(
          "SELECT asset_id FROM media_pins WHERE asset_id=$1 LIMIT 1",
          [id],
        );
        if (pins.rowCount) return false;
        await client.query("DELETE FROM media_assets WHERE id=$1", [id]);
        return true;
      });
    },
  };
}
