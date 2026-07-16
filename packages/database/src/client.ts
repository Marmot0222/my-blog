import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { parseDatabaseConfig } from "./config";
import * as schema from "./schema";
import type { DatabaseRuntime } from "./types";

const globalDatabase = globalThis as typeof globalThis & {
  __tingLabDatabase?: DatabaseRuntime;
};

export type DatabaseRuntimeFactory = (env: NodeJS.ProcessEnv) => DatabaseRuntime;

export function buildDatabase(env: NodeJS.ProcessEnv): DatabaseRuntime {
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

export function createDatabaseAccessor(
  factory: DatabaseRuntimeFactory = buildDatabase,
): (env?: NodeJS.ProcessEnv) => DatabaseRuntime {
  let runtime: DatabaseRuntime | undefined;
  return (env = process.env) => {
    runtime ??= factory(env);
    return runtime;
  };
}

export function createDatabase(env: NodeJS.ProcessEnv = process.env): DatabaseRuntime {
  globalDatabase.__tingLabDatabase ??= buildDatabase(env);
  return globalDatabase.__tingLabDatabase;
}

export function createIsolatedDatabase(env: NodeJS.ProcessEnv = process.env): DatabaseRuntime {
  return buildDatabase(env);
}

export async function withIsolatedDatabase<T>(
  operation: (runtime: DatabaseRuntime) => Promise<T>,
  env: NodeJS.ProcessEnv = process.env,
  factory: DatabaseRuntimeFactory = buildDatabase,
): Promise<T> {
  const runtime = factory(env);
  try {
    return await operation(runtime);
  } finally {
    await runtime.close();
  }
}
