import assert from "node:assert/strict";
import test from "node:test";

import { XMLValidator } from "fast-xml-parser";

import { GET } from "./route";

test("RSS Route 返回可由标准 XML parser 解析的 RSS 2.0 与缓存头", async () => {
  const response = GET();
  const xml = await response.text();

  assert.match(response.headers.get("content-type") ?? "", /^application\/rss\+xml/);
  assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/);
  assert.equal(XMLValidator.validate(xml), true);
  assert.match(xml, /<rss version="2\.0">/);
});
