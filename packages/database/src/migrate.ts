import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "./client";

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = createDatabase();

try {
  await migrate(runtime.db, { migrationsFolder: path.join(packageDirectory, "migrations") });
  console.info("数据库 migration 已完成。");
} finally {
  await runtime.close();
}
