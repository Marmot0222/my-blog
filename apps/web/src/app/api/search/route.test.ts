import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route";

test("空查询返回空数组并声明公共缓存", async () => {
  const response = GET(new Request("http://localhost/api/search?q="));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { query: "", results: [] });
  assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/);
  assert.equal(response.headers.get("vary"), "Accept-Encoding");
});

test("搜索仅返回安全的已发布内容字段", async () => {
  const response = GET(
    new Request(`http://localhost/api/search?q=${encodeURIComponent("Next.js 并发")}`),
  );
  const body = (await response.json()) as { results: Array<Record<string, unknown>> };
  assert.equal(response.status, 200);
  assert.ok(body.results.length > 0);
  assert.equal(Object.hasOwn(body.results[0] ?? {}, "searchableText"), false);
  assert.match(String(body.results[0]?.href), /^\/posts\//);
});

test("拒绝超长查询", async () => {
  const response = GET(new Request(`http://localhost/api/search?q=${"a".repeat(121)}`));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "INVALID_QUERY",
    message: "搜索词不能超过 120 个字符。",
  });
});
