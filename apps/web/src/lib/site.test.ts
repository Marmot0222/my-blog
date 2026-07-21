import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSiteOrigin } from "./site";

test("站点 origin 去除路径和尾斜杠", () => {
  assert.equal(normalizeSiteOrigin("https://example.com/blog/"), "https://example.com");
});

test("缺失或不安全 URL 使用稳定本地回退", () => {
  assert.equal(normalizeSiteOrigin(undefined), "http://localhost:3000");
  assert.equal(normalizeSiteOrigin("javascript:alert(1)"), "http://localhost:3000");
  assert.equal(normalizeSiteOrigin("not-a-url"), "http://localhost:3000");
});
