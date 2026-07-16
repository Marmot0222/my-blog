import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseConfigurationError, parseDatabaseConfig } from "./config";

test("DATABASE_URL 仅接受 PostgreSQL URL，并使用保守连接池默认值", () => {
  assert.throws(() => parseDatabaseConfig({}), DatabaseConfigurationError);
  assert.throws(
    () => parseDatabaseConfig({ DATABASE_URL: "https://example.com/key" }),
    DatabaseConfigurationError,
  );
  const config = parseDatabaseConfig({ DATABASE_URL: "postgresql://user:secret@localhost/db" });
  assert.equal(config.poolMax, 5);
  assert.equal(config.connectionString, "postgresql://user:secret@localhost/db");
});

test("配置错误不包含连接字符串", () => {
  const secret = "should-not-leak";
  assert.throws(
    () => parseDatabaseConfig({ DATABASE_URL: secret }),
    (error: unknown) => error instanceof Error && !error.message.includes(secret),
  );
});
