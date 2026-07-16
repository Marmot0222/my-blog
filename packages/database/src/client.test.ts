import assert from "node:assert/strict";
import test from "node:test";

import { createDatabaseAccessor, withIsolatedDatabase } from "./client";
import type { DatabaseRuntime } from "./types";

test("Web 数据库 accessor 在同一进程只惰性创建一个 runtime", async () => {
  let created = 0;
  let closed = 0;
  const fixture = {
    db: {},
    pool: {},
    close: async () => {
      closed += 1;
    },
  } as DatabaseRuntime;
  const getDatabase = createDatabaseAccessor(() => {
    created += 1;
    return fixture;
  });

  assert.equal(created, 0);
  assert.equal(getDatabase(), fixture);
  assert.equal(getDatabase({ DATABASE_URL: "postgresql://ignored/second" }), fixture);
  assert.equal(created, 1);
  assert.equal(closed, 0);
});

test("隔离数据库任务在成功与异常路径都会关闭 runtime", async () => {
  let closed = 0;
  const fixture = {
    db: {},
    pool: {},
    close: async () => {
      closed += 1;
    },
  } as DatabaseRuntime;
  const factory = () => fixture;

  const value = await withIsolatedDatabase(async () => "done", process.env, factory);
  assert.equal(value, "done");
  assert.equal(closed, 1);

  await assert.rejects(
    withIsolatedDatabase(
      async () => {
        throw new Error("fixture failure");
      },
      process.env,
      factory,
    ),
    /fixture failure/,
  );
  assert.equal(closed, 2);
});
