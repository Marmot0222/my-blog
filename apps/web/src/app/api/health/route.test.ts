import assert from "node:assert/strict";
import test from "node:test";

import { createHealthPayload } from "./health";
import { GET } from "./route";

test("健康信息只返回稳定且非敏感的运行字段", async () => {
  const now = new Date("2026-07-16T08:00:00.000Z");
  const payload = createHealthPayload(
    {
      APP_VERSION: "abc1234",
      DATABASE_URL: "postgresql://secret",
      OPENAI_API_KEY: "secret-key",
    },
    now,
  );

  assert.deepEqual(payload, {
    status: "ok",
    version: "abc1234",
    timestamp: now.toISOString(),
  });
  assert.doesNotMatch(JSON.stringify(payload), /secret/);

  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("未注入版本时使用 unknown", () => {
  assert.equal(createHealthPayload({}, new Date(0)).version, "unknown");
});
