import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createPostDraft } from "./new-post";
import { createContentRepository } from "./posts";
import { queryPosts, relatedPosts, POSTS_PAGE_SIZE } from "./queries";
import type { PostMetadata } from "./types";

const post = (slug: string, overrides: Partial<PostMetadata> = {}): PostMetadata => ({
  slug,
  title: slug,
  description: "测试",
  date: "2026-09-01",
  tags: ["React"],
  category: "前端",
  published: true,
  featured: false,
  kind: "article",
  readingTime: "约 1 分钟阅读",
  ...overrides,
});

test("CLI 入口缺少参数时清晰报错并非零退出", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/new.ts"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--slug/);
});

test("CLI 生成合法草稿，正确序列化中文/引号/冒号/换行且不会覆盖", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ting-workflow-"));
  try {
    const title = '中文："引号"\n第二行';
    for (const kind of ["article", "note"]) {
      const args = ["--", "--kind", kind, "--slug", kind, "--title", title];
      const target = createPostDraft(directory, args);
      const before = readFileSync(target, "utf8");
      assert.throws(() => createPostDraft(directory, args), /未覆盖/);
      assert.equal(readFileSync(target, "utf8"), before);
      assert.equal(
        createContentRepository({ postsDirectory: directory }).getPostBySlug(kind)?.metadata.title,
        title,
      );
    }
    for (const slug of ["../outside", "a/b", "A", "con", "", "C:\\outside"]) {
      assert.throws(() =>
        createPostDraft(directory, ["--kind", "article", "--slug", slug, "--title", "测试"]),
      );
    }
    assert.throws(() => createPostDraft(directory, ["--kind", "unknown"]));
    assert.throws(() => createPostDraft(directory, ["--kind", "article", "--slug", "missing"]));
    assert.throws(() => createPostDraft(directory, ["--output", "elsewhere"]));
    assert.equal(readdirSync(directory).length, 2);
    const repo = createContentRepository({ postsDirectory: directory });
    assert.equal(repo.validate().length, 2);
    assert.deepEqual(repo.getPublishedPosts(), []);
    assert.deepEqual(repo.getAllPostSlugs(), []);
    assert.deepEqual(repo.getSearchDocuments(), []);
    assert.deepEqual(repo.getAllTags(), []);
    assert.deepEqual(repo.queryPosts().posts, []);
    assert.deepEqual(repo.getRelatedPosts("article"), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("归档组合筛选、稳定分页与边界输入", () => {
  const posts = Array.from({ length: 12 }, (_, i) =>
    post(`post-${String(i).padStart(2, "0")}`),
  ).reverse();
  posts.push(
    post("note", { kind: "note", tags: ["TypeScript"] }),
    post("draft", { published: false }),
  );
  assert.equal(queryPosts(posts).total, 13);
  assert.equal(queryPosts(posts).posts.length, POSTS_PAGE_SIZE);
  assert.equal(queryPosts(posts, { page: "2" }).posts[0].slug, "post-04");
  assert.deepEqual(
    queryPosts(posts, { kind: "note", tag: "typescript" }).posts.map((p) => p.slug),
    ["note"],
  );
  assert.equal(queryPosts(posts, { kind: "note", tag: "react" }).total, 0);
  assert.equal(queryPosts(posts, { tag: "unknown", page: "999" }).page, 1);
  for (const page of ["-1", "0", "NaN", "1.5", "1e2", "9999999999999999999999"])
    assert.equal(queryPosts(posts, { page }).page, 1);
  assert.equal(queryPosts(posts, { page: "999" }).page, 3);
  assert.equal(queryPosts(posts, { kind: "bad" }).total, 13);
  assert.deepEqual(queryPosts(posts).posts, queryPosts([...posts].reverse()).posts);
});

test("相关阅读按标签 2 分/分类 1 分排序，排除自身、草稿、重复与无关联", () => {
  const posts = [
    post("source"),
    post("b"),
    post("a"),
    post("a"),
    post("draft", { published: false }),
    post("c", { tags: ["TypeScript"] }),
    post("unrelated", { tags: ["AI 编程"], category: "其他" }),
  ];
  assert.deepEqual(
    relatedPosts(posts, "source").map((p) => p.slug),
    ["a", "b", "c"],
  );
  assert.deepEqual(relatedPosts(posts, "draft"), []);
  assert.deepEqual(relatedPosts(posts, "unrelated"), []);
});
