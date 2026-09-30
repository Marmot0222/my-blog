import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { createMediaStore } from "./media";
import { createPublishingStore } from "./publishing";
import { createIsolatedDatabase } from "./client";

const url = process.env.TEST_MEDIA_DATABASE_URL,
  blogUrl = process.env.TEST_DATABASE_URL;
(url && blogUrl ? test : test.skip)(
  "isolated media: binary persistence, pins, current publication, sharing and stale actions",
  async () => {
    for (const value of [url!, blogUrl!]) {
      const parsed = new URL(value);
      assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
      assert.match(parsed.pathname, /_test$/);
    }
    const media = createMediaStore(url!),
      runtime = createIsolatedDatabase({ DATABASE_URL: blogUrl }),
      blog = createPublishingStore(runtime);
    const data = Buffer.from([0, 1, 2, 255]),
      checksum = createHash("sha256").update(data).digest("hex");
    try {
      const id = await media.put(
        "ting-lab",
        "admin",
        {
          mime: "image/png",
          width: 1,
          height: 1,
          bytes: data.length,
          checksum,
          filename: "fixture",
          upload_session: randomUUID(),
        },
        data,
      );
      assert.equal(await media.metadata("other", "admin", id), undefined);
      assert.deepEqual(await media.bytes("ting-lab", "admin", id), data);
      const listed = await media.list("ting-lab", "admin", 1);
      assert.ok(listed.items.every((item) => !("data" in item)));
      await media.pin("ting-lab", "admin", checksum, [id]);
      await media.pin("ting-lab", "admin", checksum, [id]);
      assert.equal((await media.pins("ting-lab", "admin", id)).length, 1);
      assert.equal(await media.remove("ting-lab", "admin", id), false);
      assert.equal(await blog.mediaIsPublished(id), false);
      const draft = {
        slug: `media-${randomUUID()}`,
        metadata: { title: "fixture" },
        body: `![fixture](/media/${id})`,
        checksum,
        mediaIds: [id],
      };
      const a = await blog.create(draft),
        b = await blog.create({ ...draft, slug: `media-${randomUUID()}` });
      const publishedA = await blog.change(a.id, a.version, "publish", "fake");
      const publishedB = await blog.change(b.id, b.version, "publish", "fake");
      assert.equal(await blog.mediaIsPublished(id), true);
      await blog.change(a.id, publishedA.version, "unpublish", "invalidated");
      assert.equal(await blog.mediaIsPublished(id), true);
      await assert.rejects(blog.change(a.id, publishedA.version, "publish", "fake"));
      await blog.change(b.id, publishedB.version, "unpublish", "invalidated");
      assert.equal(await blog.mediaIsPublished(id), false);
      assert.equal((await blog.mediaReferences(id)).length, 2);
      assert.equal(await media.remove("ting-lab", "admin", id), false);
      const orphan = await media.put(
        "ting-lab",
        "admin",
        {
          mime: "image/png",
          width: 1,
          height: 1,
          bytes: data.length,
          checksum,
          filename: "orphan",
          upload_session: randomUUID(),
        },
        data,
      );
      assert.equal(await media.remove("other", "admin", orphan), false);
      assert.equal(await media.remove("ting-lab", "admin", orphan), true);
      const restart = createMediaStore(url!);
      try {
        assert.deepEqual(await restart.bytes("ting-lab", "admin", id), data);
      } finally {
        await restart.close();
      }
      // Media account cannot connect to the blog DB after explicit role initialization.
      const cross = new URL(url!);
      cross.pathname = new URL(blogUrl!).pathname;
      const denied = new Pool({
        connectionString: cross.toString(),
        connectionTimeoutMillis: 2000,
      });
      try {
        await assert.rejects(denied.query("SELECT 1"));
      } finally {
        await denied.end();
      }
      if (process.env.BLOG_DB_USER && process.env.BLOG_DB_PASSWORD) {
        const crossBlog = new URL(url!);
        crossBlog.username = process.env.BLOG_DB_USER;
        crossBlog.password = process.env.BLOG_DB_PASSWORD;
        const deniedBlog = new Pool({
          connectionString: crossBlog.toString(),
          connectionTimeoutMillis: 2000,
        });
        try {
          await assert.rejects(deniedBlog.query("SELECT 1"));
        } finally {
          await deniedBlog.end();
        }
      }
    } finally {
      await media.close();
      await runtime.close();
    }
  },
);
