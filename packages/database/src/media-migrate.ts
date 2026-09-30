import { Pool } from "pg";
import { readFile } from "node:fs/promises";

const connectionString = process.env.MEDIA_DATABASE_URL;
if (!connectionString) throw new Error("MEDIA_DATABASE_URL required");
const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(711116)");
  await client.query("CREATE TABLE IF NOT EXISTS media_migrations(version integer PRIMARY KEY)");
  if (!(await client.query("SELECT version FROM media_migrations WHERE version=1")).rowCount) {
    await client.query(
      await readFile(new URL("../media-migrations/0001_media.sql", import.meta.url), "utf8"),
    );
    await client.query("INSERT INTO media_migrations VALUES(1)");
  }
  await client.query("COMMIT");
  console.info("Media migration complete");
} catch {
  await client.query("ROLLBACK");
  console.error("Media migration failed; check database access and migration state");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
