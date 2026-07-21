import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createContentRepository } from "./posts";

function projectSource(overrides: Readonly<Record<string, string>> = {}): string {
  const values = {
    slug: "ting-lab",
    title: "Ting Lab",
    summary: "个人技术博客与站内 AI 知识问答实验室",
    status: "active",
    featured: "true",
    order: "10",
    startedAt: "2026-07",
    updatedAt: "2026-07-21",
    role: "独立设计与开发",
    repository: "repository: https://github.com/Marmot0222/my-blog",
    published: "true",
    unknown: "",
    ...overrides,
  };
  return `---
slug: ${values.slug}
title: "${values.title}"
summary: "${values.summary}"
status: ${values.status}
featured: ${values.featured}
order: ${values.order}
startedAt: "${values.startedAt}"
updatedAt: "${values.updatedAt}"
role: "${values.role}"
stack:
  - Next.js
  - TypeScript
${values.repository}
published: ${values.published}
${values.unknown}
---

## 背景

使用 MDX、RAG 与流式回答构建可提问的技术内容系统。
`;
}

function withRepository(
  projects: Readonly<Record<string, string>>,
  assertion: (repository: ReturnType<typeof createContentRepository>) => void,
): void {
  const root = mkdtempSync(path.join(tmpdir(), "ting-lab-projects-"));
  const postsDirectory = path.join(root, "posts");
  const projectsDirectory = path.join(root, "projects");
  mkdirSync(postsDirectory);
  mkdirSync(projectsDirectory);
  try {
    for (const [filename, source] of Object.entries(projects)) {
      writeFileSync(path.join(projectsDirectory, filename), source, "utf8");
    }
    assertion(createContentRepository({ postsDirectory, projectsDirectory }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("解析、排序并通过公共 API 查询项目", () => {
  withRepository(
    {
      "later-order.mdx": projectSource({ slug: "later-order", title: "Later", order: "20" }),
      "ting-lab.mdx": projectSource(),
    },
    (repository) => {
      assert.deepEqual(
        repository.getPublishedProjects().map(({ slug }) => slug),
        ["ting-lab", "later-order"],
      );
      assert.equal(repository.getProjectBySlug("ting-lab")?.metadata.role, "独立设计与开发");
    },
  );
});

test("未发布项目不进入公开列表、slug 与搜索", () => {
  withRepository(
    { "draft.mdx": projectSource({ slug: "draft", published: "false" }) },
    (repository) => {
      assert.deepEqual(repository.getPublishedProjects(), []);
      assert.deepEqual(repository.getAllProjectSlugs(), []);
      assert.deepEqual(repository.getSearchDocuments(), []);
    },
  );
});

test("缺少字段和非法 slug、URL、状态、日期、未知字段均给出文件定位", () => {
  const cases = [
    projectSource().replace('title: "Ting Lab"\n', ""),
    projectSource({ slug: "INVALID SLUG" }),
    projectSource({ repository: "repository: javascript:alert(1)" }),
    projectSource({ status: "shipping" }),
    projectSource({ updatedAt: "2026-02-30" }),
    projectSource({ unknown: "unexpected: true" }),
  ];
  cases.forEach((source, index) =>
    withRepository({ [`invalid-${index}.mdx`]: source }, (repository) => {
      assert.throws(() => repository.validateProjects(), new RegExp(`invalid-${index}\\.mdx`));
    }),
  );
});

test("重复项目 slug 校验失败", () => {
  withRepository(
    {
      "first.mdx": projectSource({ slug: "duplicate" }),
      "second.mdx": projectSource({ slug: "duplicate" }),
    },
    (repository) => assert.throws(() => repository.validateProjects(), /重复项目 slug：duplicate/),
  );
});

test("项目搜索可命中标题、技术栈和正文且不泄露全文", () => {
  withRepository({ "ting-lab.mdx": projectSource() }, (repository) => {
    const [document] = repository.getSearchDocuments();
    assert.equal(document?.type, "project");
    assert.equal(document?.href, "/projects/ting-lab");
    assert.match(document?.searchableText ?? "", /RAG/);
  });
});
