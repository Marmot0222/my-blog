import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createContentRepository } from "./posts";

type FixtureOptions = Readonly<{
  title?: string;
  date?: string;
  published?: boolean;
  tags?: string[];
  kind?: "article" | "note";
}>;

function fixtureSource(options: FixtureOptions = {}): string {
  const {
    title = "测试文章",
    date = "2026-07-10",
    published = true,
    tags = ["React"],
    kind = "article",
  } = options;

  return `---
title: "${title}"
description: "用于验证内容仓库行为的文章。"
date: "${date}"
tags:
${tags.map((tag) => `  - "${tag}"`).join("\n")}
category: "测试"
published: ${published}
featured: false
kind: "${kind}"
---

# 正文

这是一段用于计算阅读时间的测试内容。
`;
}

function withRepository(
  fixtures: Readonly<Record<string, string>>,
  assertion: (repository: ReturnType<typeof createContentRepository>) => void,
): void {
  const directory = mkdtempSync(path.join(tmpdir(), "ting-lab-content-"));

  try {
    for (const [filename, source] of Object.entries(fixtures)) {
      writeFileSync(path.join(directory, filename), source, "utf8");
    }
    assertion(createContentRepository({ postsDirectory: directory }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("解析有效 Front Matter 并生成阅读时间", () => {
  withRepository({ "valid-post.mdx": fixtureSource() }, (repository) => {
    const post = repository.getPostBySlug("valid-post");
    assert.equal(post?.metadata.title, "测试文章");
    assert.match(post?.metadata.readingTime ?? "", /read/);
    assert.match(post?.content ?? "", /用于计算阅读时间/);
  });
});

test("无效日期包含文件路径并抛出错误", () => {
  withRepository({ "invalid-date.mdx": fixtureSource({ date: "2026-02-30" }) }, (repository) => {
    assert.throws(() => repository.validate(), /invalid-date\.mdx/);
  });
});

test("缺失 title 时校验失败", () => {
  withRepository(
    { "missing-title.mdx": fixtureSource().replace('title: "测试文章"\n', "") },
    (repository) => assert.throws(() => repository.validate(), /missing-title\.mdx/),
  );
});

test("过滤未发布内容", () => {
  withRepository(
    {
      "published.mdx": fixtureSource(),
      "draft.mdx": fixtureSource({ published: false }),
    },
    (repository) => assert.deepEqual(repository.getAllPostSlugs(), ["published"]),
  );
});

test("文章按日期从新到旧排序", () => {
  withRepository(
    {
      "older.mdx": fixtureSource({ date: "2026-01-01" }),
      "newer.mdx": fixtureSource({ date: "2026-07-10" }),
    },
    (repository) =>
      assert.deepEqual(
        repository.getPublishedPosts().map((post) => post.slug),
        ["newer", "older"],
      ),
  );
});

test("按 slug 查询文章", () => {
  withRepository({ "target-post.mdx": fixtureSource() }, (repository) => {
    assert.equal(repository.getPostBySlug("target-post")?.metadata.slug, "target-post");
    assert.equal(repository.getPostBySlug("missing-post"), undefined);
  });
});

test("聚合标签并统计数量", () => {
  withRepository(
    {
      "first.mdx": fixtureSource({ tags: ["React", "TypeScript"] }),
      "second.mdx": fixtureSource({ tags: ["React"] }),
    },
    (repository) => {
      assert.deepEqual(repository.getAllTags(), [
        { label: "React", slug: "react", count: 2 },
        { label: "TypeScript", slug: "typescript", count: 1 },
      ]);
    },
  );
});

test("未知中文标签无法安全映射时抛出错误", () => {
  withRepository({ "unknown-tag.mdx": fixtureSource({ tags: ["未知话题"] }) }, (repository) => {
    assert.throws(() => repository.validate(), /无法生成安全 slug/);
  });
});

test("只返回 kind 为 note 的已发布笔记", () => {
  withRepository(
    {
      "article.mdx": fixtureSource(),
      "note.mdx": fixtureSource({ kind: "note" }),
    },
    (repository) =>
      assert.deepEqual(
        repository.getLatestNotes().map((post) => post.slug),
        ["note"],
      ),
  );
});
