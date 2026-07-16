import { sql } from "drizzle-orm";

import { createDatabase } from "./client";

const runtime = createDatabase();
try {
  const result = await runtime.db.execute<{ vectorVersion: string }>(
    sql`select extversion as "vectorVersion" from pg_extension where extname = 'vector'`,
  );
  const version = result.rows[0]?.vectorVersion;
  if (!version) throw new Error("数据库尚未安装 pgvector extension，请先运行 pnpm db:migrate");
  console.info(`PostgreSQL 连接正常，pgvector ${version}。`);
} finally {
  await runtime.close();
}
