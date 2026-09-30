import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDatabase, createPublishingStore } from "@ting-lab/database";
import { createContentRepository } from "@ting-lab/content";
import { parseDraft, recordToPost } from "./content";
const url = process.env.TEST_DATABASE_URL;
(url ? test : test.skip)(
  "journal SQL facets, revision isolation and export/file/import round trip",
  async () => {
    assert.ok(url);
    const parsed = new URL(url);
    assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
    assert.ok(parsed.pathname.endsWith("_test"));
    process.env.DATABASE_URL = url;
    const runtime = createDatabase(),
      store = createPublishingStore(runtime);
    const prefix = "journal-test-" + randomUUID();
    const directory = mkdtempSync(path.join(tmpdir(), "journal-roundtrip-"));
    const ids: string[] = [];
    try {
      const draft = parseDraft({
        slug: prefix,
        metadata: {
          title: prefix,
          description: "生活与技术独立于形式",
          date: "2026-09-30",
          kind: "journal",
          category: "生活",
          tags: ["旅行"],
          published: false,
          featured: false,
        },
        body: "## 记录\n\n随记正文。",
      });
      let row = await store.create(draft);
      ids.push(row.id);
      assert.ok(!(await store.published()).some((item) => item.id === row.id));
      row = await store.change(row.id, row.version, "publish", "fake-no-worker");
      const revised = parseDraft({
        slug: draft.slug,
        metadata: { ...draft.metadata, category: "技术" },
        body: "未发布修改",
      });
      row = await store.save(row.id, row.version, revised);
      const publicRow = (await store.published()).find((item) => item.id === row.id)!;
      assert.equal(recordToPost(publicRow).metadata.category, "生活");
      assert.equal(recordToPost(publicRow).content, draft.body);
      const result = await store.querySummaries({
        q: prefix,
        kind: "journal",
        category: "技术",
        tag: "旅行",
        pageSize: "10",
      });
      assert.equal(result.total, 1);
      assert.equal(result.rows[0].category, "技术");
      assert.ok(!("body" in result.rows[0]));
      assert.equal((await store.querySummaries({ q: prefix, category: "生活" })).total, 0);
      const exported = (await store.exportContent()).filter((item) => item.id === row.id);
      assert.equal(exported.length, 2);
      assert.equal(exported[0].publishedRevision, 1);
      for (const item of exported) {
        const slug = prefix + "-revision-" + item.revision;
        writeFileSync(path.join(directory, slug + ".mdx"), item.mdx);
      }
      const repo = createContentRepository({ postsDirectory: directory });
      const posts = repo.getAllPosts();
      assert.equal(posts.length, 2);
      assert.ok(posts.every((item) => item.kind === "journal"));
      assert.equal(repo.getPublishedPosts()[0].category, "生活");
      const recovered = repo.getPostBySlug(prefix + "-revision-2")!;
      const { slug: _slug, readingTime: _readingTime, ...metadata } = recovered.metadata;
      void _slug;
      void _readingTime;
      const imported = parseDraft({ slug: prefix + "-import", metadata, body: recovered.content });
      assert.equal(
        (await store.importBatch([{ ...imported, published: false }], true, "fake-no-worker"))[0]
          .status,
        "new",
      );
      const importedRow = (await store.list()).find((item) => item.slug === imported.slug)!;
      ids.push(importedRow.id);
      assert.equal(recordToPost(importedRow, false).metadata.kind, "journal");
      assert.equal(recordToPost(importedRow, false).metadata.category, "技术");
      row = await store.change(row.id, row.version, "unpublish", "invalidated");
      assert.ok(!(await store.published()).some((item) => item.id === row.id));
      row = await store.change(row.id, row.version, "delete", "invalidated");
      assert.equal((await store.querySummaries({ q: prefix, status: "deleted" })).total, 1);
      const deleted = (await store.exportContent()).filter((item) => item.id === row.id);
      assert.ok(deleted.every((item) => item.deleted && item.publishedRevision === null));
      row = await store.change(row.id, row.version, "restore", "invalidated");
      assert.equal(row.published_revision, null);
    } finally {
      // Remove only this test's UUID-scoped records from the verified local test database.
      await runtime.pool.query("DELETE FROM publishing_tasks WHERE article_id=ANY($1::uuid[])", [
        ids,
      ]);
      await runtime.pool.query("DELETE FROM article_revisions WHERE article_id=ANY($1::uuid[])", [
        ids,
      ]);
      await runtime.pool.query("DELETE FROM articles WHERE id=ANY($1::uuid[])", [ids]);
      await runtime.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
