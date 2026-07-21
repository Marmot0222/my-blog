import assert from "node:assert/strict";
import test from "node:test";

import type { ProjectMetadata } from "@ting-lab/content";

import { createProjectJsonLd, createProjectMetadata } from "./project-seo";
import { serializeJsonLd } from "./seo";

const project: ProjectMetadata = {
  slug: "ting-lab",
  title: "Ting Lab",
  summary: "可检索的技术内容系统",
  status: "active",
  featured: true,
  order: 10,
  startedAt: "2026-07",
  updatedAt: "2026-07-21",
  role: "独立设计与开发",
  stack: ["Next.js", "TypeScript"],
  repository: "https://github.com/Marmot0222/my-blog",
  published: true,
};

test("项目 Metadata 包含 canonical、OG 与技术关键词", () => {
  const metadata = createProjectMetadata(project);
  assert.equal(metadata.alternates?.canonical, "/projects/ting-lab");
  assert.equal(metadata.openGraph?.title, "Ting Lab");
  assert.deepEqual(metadata.keywords, ["Next.js", "TypeScript"]);
});

test("项目 JSON-LD 使用公开字段并安全序列化", () => {
  const serialized = serializeJsonLd(
    createProjectJsonLd({ ...project, title: "</script><script>" }),
  );
  assert.doesNotMatch(serialized, /<\/script>/i);
  assert.match(serialized, /CreativeWork/);
  assert.match(serialized, /codeRepository/);
});
