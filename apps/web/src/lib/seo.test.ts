import assert from "node:assert/strict";
import test from "node:test";

import type { PostMetadata } from "@ting-lab/content";

import { createRobots, createRss, createSitemap, escapeXml, serializeJsonLd } from "./seo";

function post(overrides: Partial<PostMetadata> = {}): PostMetadata {
  return {
    slug: "hello",
    title: "中文 & <Hello>",
    description: `描述含有 \"双引号\"、'单引号' & 符号`,
    date: "2026-07-01",
    updatedAt: "2026-07-02",
    tags: [],
    category: "工程化",
    published: true,
    featured: false,
    kind: "article",
    readingTime: "约 1 分钟阅读",
    ...overrides,
  };
}

test("robots 禁止 API 并输出规范 sitemap", () => {
  const robots = createRobots("https://example.com/");
  assert.deepEqual(robots.rules, { userAgent: "*", allow: "/", disallow: ["/api/"] });
  assert.equal(robots.sitemap, "https://example.com/sitemap.xml");
});

test("sitemap 排除草稿、使用内容更新时间且 URL 无重复", () => {
  const sitemap = createSitemap(
    "https://example.com/",
    [post(), post({ slug: "draft", published: false })],
    [{ label: "React", slug: "react", count: 1 }],
  );
  assert.equal(
    sitemap.some(({ url }) => url.includes("draft")),
    false,
  );
  assert.equal(new Set(sitemap.map(({ url }) => url)).size, sitemap.length);
  assert.equal(sitemap.find(({ url }) => url.endsWith("/posts/hello"))?.lastModified, "2026-07-02");
});

test("RSS 转义特殊字符、支持中文空标签和 updatedAt，且只输出公开内容", () => {
  const xml = createRss(
    "https://example.com",
    { name: "Ting & Lab", description: "<记录>", language: "zh-CN" },
    [post(), post({ slug: "draft", published: false })],
  );
  assert.match(xml, /Ting &amp; Lab/);
  assert.match(xml, /中文 &amp; &lt;Hello&gt;/);
  assert.doesNotMatch(xml, /draft/);
  assert.doesNotMatch(xml, /<category><\/category>/);
  assert.equal(escapeXml(`&<>\"'`), "&amp;&lt;&gt;&quot;&apos;");
});

test("JSON-LD 序列化不会闭合 script", () => {
  assert.doesNotMatch(serializeJsonLd({ value: "</script><script>" }), /<\/script>/i);
});
