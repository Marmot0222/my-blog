import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { parseDatabaseConfig } from "./config";
import * as schema from "./schema";
import type { DatabaseRuntime } from "./types";

const globalDatabase = globalThis as typeof globalThis & {
  __tingLabDatabase?: DatabaseRuntime;
};

function buildDatabase(env: NodeJS.ProcessEnv): DatabaseRuntime {
  const config = parseDatabaseConfig(env);
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle({ client: pool, schema });
  return { db, pool, close: () => pool.end() };
}

export function createDatabase(env: NodeJS.ProcessEnv = process.env): DatabaseRuntime {
  if (process.env.NODE_ENV === "production" || env !== process.env) {
    return buildDatabase(env);
  }
  globalDatabase.__tingLabDatabase ??= buildDatabase(env);
  return globalDatabase.__tingLabDatabase;
}
