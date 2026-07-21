import assert from "node:assert/strict";
import test from "node:test";

import { createContentSearchIndex, normalizeSearchText } from "./search";
import type { SearchDocument } from "./types";

type PostSearchDocument = Extract<SearchDocument, { type: "post" }>;

function document(overrides: Partial<PostSearchDocument> = {}): PostSearchDocument {
  return {
    id: "next-concurrency",
    type: "post",
    kind: "article",
    title: "理解 Next.js 的并发渲染机制",
    description: "解释 React 并发渲染。",
    excerpt: "安全摘要",
    date: "2026-07-10",
    category: "前端开发",
    tags: ["Next.js", "React"],
    href: "/posts/next-concurrency",
    searchableText: "并发渲染让更新可以被中断和恢复。",
    ...overrides,
  };
}

test("统一处理中英文大小写、全角字符、标点与空白", () => {
  assert.equal(normalizeSearchText("  ＮＥＸＴ．JS，  并发\n渲染 "), "next js 并发 渲染");
});

test("查询采用 AND 语义并按标题、标签、分类、描述、正文加权", () => {
  const index = createContentSearchIndex([
    document(),
    document({
      id: "react-only",
      title: "React 状态",
      description: "局部状态管理。",
      tags: ["React"],
      category: "前端开发",
      searchableText: "组件状态应靠近使用位置。",
      href: "/posts/react-only",
    }),
  ]);

  assert.deepEqual(
    index.search("Next.js 并发").map(({ id }) => id),
    ["next-concurrency"],
  );
  assert.deepEqual(index.search("不存在 React"), []);
});

test("同分结果按日期、标题和 URL 稳定排序，并限制结果数量", () => {
  const index = createContentSearchIndex([
    document({ id: "b", title: "缓存 B", date: "2026-07-01", href: "/posts/b" }),
    document({ id: "a", title: "缓存 A", date: "2026-07-02", href: "/posts/a" }),
  ]);
  assert.deepEqual(
    index.search("缓存", { limit: 1 }).map(({ id }) => id),
    ["a"],
  );
});

test("公开结果不泄露内部 searchableText", () => {
  const [result] = createContentSearchIndex([document()]).search("并发");
  assert.equal(Object.hasOwn(result ?? {}, "searchableText"), false);
});

test("项目可通过标题、技术栈和正文检索并返回项目路由", () => {
  const project: SearchDocument = {
    id: "project:dialogue-flow",
    type: "project",
    kind: "project",
    title: "可配置 AI 对话流",
    description: "Schema 驱动的交互实验",
    excerpt: "安全摘要",
    date: "2026-07-21",
    category: "项目",
    tags: ["Vue 3", "SSE", "Fastify"],
    href: "/projects/dialogue-flow",
    searchableText: "组件注册表负责将结构化消息映射到安全组件。",
  };
  const index = createContentSearchIndex([project]);
  for (const query of ["可配置", "Fastify", "组件注册表"]) {
    const [result] = index.search(query);
    assert.equal(result?.type, "project");
    assert.equal(result?.href, "/projects/dialogue-flow");
    assert.equal(Object.hasOwn(result ?? {}, "searchableText"), false);
  }
});
