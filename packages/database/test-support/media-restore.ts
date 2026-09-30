import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import assert from "node:assert/strict";

const blog = new URL(process.env.TEST_DATABASE_URL ?? ""),
  media = new URL(process.env.TEST_MEDIA_DATABASE_URL ?? "");
for (const url of [blog, media]) {
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.match(url.pathname, /_test$/);
}
assert.equal(blog.host, media.host);
const container = process.env.TEST_DB_CONTAINER;
assert.ok(container && /^[a-z0-9-]+test$/.test(container));
const stamp = Date.now(),
  targets = [`restore_blog_${stamp}_test`, `restore_media_${stamp}_test`];
const admin = decodeURIComponent(blog.username),
  output = `test-results/round16/restore-${stamp}`;
mkdirSync(output, { recursive: true });
const pool = new Pool({ connectionString: blog.toString() });
try {
  // No application writers should be running during this isolated restore exercise.
  for (const [index, url] of [blog, media].entries()) {
    const file = `/tmp/round16-${stamp}-${index}.dump`;
    execFileSync("docker", [
      "exec",
      container,
      "pg_dump",
      "-U",
      admin,
      "-d",
      url.pathname.slice(1),
      "-Fc",
      "--no-owner",
      "--no-privileges",
      "-f",
      file,
    ]);
    execFileSync("docker", [
      "cp",
      `${container}:${file}`,
      `${output}/${index === 0 ? "blog" : "media"}.dump`,
    ]);
    await pool.query(`CREATE DATABASE "${targets[index]}"`);
    execFileSync("docker", [
      "exec",
      container,
      "pg_restore",
      "-U",
      admin,
      "-d",
      targets[index],
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      file,
    ]);
  }
  const restored = targets.map((name) => {
    const url = new URL(blog);
    url.pathname = `/${name}`;
    return new Pool({ connectionString: url.toString() });
  });
  const sourceMedia = new Pool({ connectionString: media.toString() });
  try {
    const source = await sourceMedia.query(
      "SELECT a.id,a.checksum,md5(b.data) AS binary_hash FROM media_assets a JOIN media_binary b ON b.asset_id=a.id ORDER BY a.id",
    );
    const copy = await restored[1].query(
      "SELECT a.id,a.checksum,md5(b.data) AS binary_hash FROM media_assets a JOIN media_binary b ON b.asset_id=a.id ORDER BY a.id",
    );
    assert.deepEqual(copy.rows, source.rows);
    const query = `SELECT r.article_id,r.revision,r.media_id,(r.revision=a.published_revision AND a.deleted_at IS NULL) IS TRUE AS published FROM article_media_references r JOIN articles a ON a.id=r.article_id ORDER BY r.article_id,r.revision,r.media_id`;
    assert.deepEqual((await restored[0].query(query)).rows, (await pool.query(query)).rows);
    assert.deepEqual(
      (await restored[1].query("SELECT * FROM media_pins ORDER BY asset_id,operation")).rows,
      (await sourceMedia.query("SELECT * FROM media_pins ORDER BY asset_id,operation")).rows,
    );
    console.info(
      `Restore verified: ${source.rowCount} binary checksums, revision permissions and pins match. Artifacts: ${output}`,
    );
  } finally {
    await sourceMedia.end();
    await Promise.all(restored.map((value) => value.end()));
  }
} finally {
  await pool.end();
}
