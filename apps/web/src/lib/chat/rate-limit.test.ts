import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryRateLimiter, getClientRateLimitKey } from "./rate-limit";

test("固定窗口按 key 计数并返回 Retry-After", () => {
  const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.check("client", 0).allowed, true);
  assert.equal(limiter.check("client", 1).allowed, true);
  const rejected = limiter.check("client", 2);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfterSeconds, 60);
});

test("窗口过期后重置并清理旧 key", () => {
  const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });
  limiter.check("old", 0);
  assert.equal(limiter.check("old", 500).allowed, false);
  assert.equal(limiter.check("new", 1001).allowed, true);
  assert.equal(limiter.size(), 1);
});

test("默认不信任客户端 forwarded header", () => {
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "203.0.113.8" },
  });
  assert.equal(getClientRateLimitKey(request, {}), "anonymous");
  assert.equal(getClientRateLimitKey(request, { TRUST_PROXY: "true" }), "ip:203.0.113.8");
});
