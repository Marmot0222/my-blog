import { createIsolatedDatabase } from "@ting-lab/database";

export async function failJournalFixtureIndex(id: string) {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_test"))
    throw new Error("Only isolated local test databases are allowed");
  const runtime = createIsolatedDatabase({ ...process.env, DATABASE_URL: url.href });
  try {
    const result = await runtime.pool.query(
      `UPDATE publishing_tasks SET status='failed',error_code='INDEX_UNAVAILABLE'
       WHERE article_id=$1 AND status='pending'
       AND article_id IN (SELECT id FROM articles WHERE slug LIKE 'round14-%')`,
      [id],
    );
    if (result.rowCount !== 1) throw new Error("Expected one pending round14 fixture task");
  } finally {
    await runtime.close();
  }
}
