import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import {
  createDatabase,
  createPublishingStore,
  createTaskStore,
  createProfileStore,
} from "@ting-lab/database";
import type { EmbeddingConfig } from "@ting-lab/retrieval";
import { parseDraft, recordToPost } from "./content";
import { runNextTask } from "./index-task";
import {
  embeddingFingerprint,
  saveChat,
  activateChat,
  effectiveChat,
  effectiveEmbedding,
  settingsSummary,
  freezeEmbedding,
} from "./config";
import { hashPassword, sessionHash } from "./secrets";

const url = process.env.TEST_DATABASE_URL;
(url ? test : test.skip)(
  "isolated publishing: revisions, conflict, outbox, stale worker, revocation, import and config",
  async () => {
    assert.ok(url);
    const parsed = new URL(url);
    assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
    assert.match(parsed.pathname, /_test$/);
    process.env.DATABASE_URL = url;
    process.env.CONTENT_SOURCE = "database";
    const runtime = createDatabase(),
      store = createPublishingStore(runtime),
      tasks = createTaskStore(runtime);
    // Settle only leftovers created by this test, retaining business records so
    // repeated local runs do not embed an earlier run's published fixture.
    await runtime.pool.query(
      "UPDATE publishing_tasks SET status='succeeded' WHERE article_id IN (SELECT id FROM articles WHERE slug LIKE 'test-%' OR slug LIKE 'import-%')",
    );
    const slug = `test-${randomUUID()}`,
      config: EmbeddingConfig = {
        provider: "openai",
        model: "fixture-embedding",
        dimensions: 2048,
        apiKey: "fake-never-sent",
        batchSize: 32,
        maxRetries: 0,
      },
      fingerprint = embeddingFingerprint(config);
    const input = parseDraft({
      slug,
      metadata: {
        title: "Fixture",
        description: "Description",
        date: "2026-09-28",
        tags: ["Test"],
        category: "Test",
        kind: "article",
        published: false,
        featured: false,
      },
      body: "## Original\n\nPublic version.",
    });
    const vector = Array.from({ length: 2048 }, (_, i) => (i === 0 ? 1 : 0));
    let calls = 0;
    const deps = {
      store: tasks,
      configuration: async () => config,
      embedding: () => ({
        embedMany: async (values: readonly string[]) => {
          calls++;
          return values.map(() => vector);
        },
        embedOne: async () => vector,
      }),
    };
    try {
      let row = await store.create(input);
      assert.equal(
        (await runtime.pool.query("SELECT id FROM publishing_tasks WHERE article_id=$1", [row.id]))
          .rowCount,
        0,
      );
      row = await store.change(row.id, row.version, "publish", fingerprint);
      assert.equal((await store.published()).find((post) => post.id === row.id)?.body, input.body);
      // Claim only this test's tasks; test databases are isolated and freshly migrated.
      while (await runNextTask(deps)) {
        /* drain durable queue using fake embedding only */
      }
      assert.equal(calls, 1);
      assert.ok(
        (await tasks.search(vector, { limit: 100, similarityThreshold: 0.5 }, fingerprint)).some(
          (chunk) => chunk.documentSlug === slug,
        ),
      );
      const updated = parseDraft({
        slug,
        metadata: input.metadata,
        body: "## Revised\n\nNext public version.",
      });
      const oldVersion = row.version;
      row = await store.save(row.id, row.version, updated);
      await assert.rejects(() => store.save(row.id, oldVersion, updated), /conflict/);
      assert.equal((await store.published()).find((post) => post.id === row.id)?.body, input.body);
      row = await store.change(row.id, row.version, "publish", fingerprint);
      const stale = await tasks.claim();
      assert.ok(stale);
      row = await store.change(row.id, row.version, "unpublish", fingerprint);
      assert.ok(
        !(await tasks.search(vector, { limit: 100, similarityThreshold: 0.5 }, fingerprint)).some(
          (chunk) => chunk.documentSlug === slug,
        ),
      );
      await tasks.finish(stale, {
        document: {
          slug,
          title: "stale",
          description: "stale",
          category: "test",
          publishedAt: "2026-09-28",
          sourcePath: "unused",
          contentChecksum: "stale",
          isPublished: true,
        },
        chunks: [
          {
            chunkIndex: 0,
            content: "stale secret body",
            contentHash: "s",
            tokenCount: 1,
            embedding: vector,
          },
        ],
      });
      assert.ok(!(await store.published()).some((post) => post.id === row.id));
      while (await runNextTask(deps)) {
        /* cleanup task */
      }
      row = await store.change(row.id, row.version, "publish", fingerprint);
      while (await runNextTask(deps)) {
        /* new revision */
      }
      assert.equal(calls, 2);
      row = await store.change(row.id, row.version, "publish", fingerprint);
      while (await runNextTask(deps)) {
        /* checksum unchanged */
      }
      assert.equal(calls, 2, "unchanged checksum never re-embeds");
      row = await store.change(row.id, row.version, "delete", fingerprint);
      row = await store.change(row.id, row.version, "restore", fingerprint);
      assert.equal(row.published_revision, null);
      assert.equal(row.deleted_at, null);
      const imported = { ...input, slug: `import-${randomUUID()}`, published: false };
      assert.equal((await store.importBatch([imported], false, fingerprint))[0].status, "new");
      assert.equal((await store.importBatch([imported], true, fingerprint))[0].status, "new");
      assert.equal((await store.importBatch([imported], true, fingerprint))[0].status, "unchanged");
      const importedRow = (await store.list()).find((item) => item.slug === imported.slug)!;
      await store.save(importedRow.id, importedRow.version, { ...imported, body: "Admin edits" });
      assert.equal((await store.importBatch([imported], true, fingerprint))[0].status, "conflict");
      assert.equal((await store.read(importedRow.id)).body, "Admin edits");
      // A crashed lease can be reclaimed; late owners cannot finish it.
      row = await store.change(row.id, row.version, "publish", fingerprint);
      const lease = await tasks.claim();
      assert.ok(lease);
      await runtime.pool.query(
        "UPDATE publishing_tasks SET lease_until=now()-interval '1 second' WHERE id=$1",
        [lease.id],
      );
      const reclaimed = await tasks.claim();
      assert.ok(reclaimed);
      assert.equal(reclaimed.id, lease.id);
      assert.notEqual(reclaimed.lease_token, lease.lease_token);
      assert.equal(await tasks.finish(lease), false);
      await tasks.fail(reclaimed);
      await runtime.pool.query("UPDATE publishing_tasks SET status='failed' WHERE id=$1", [
        reclaimed.id,
      ]);
      assert.equal(await store.retry(reclaimed.article_id), 1);
      await runtime.pool.query("DELETE FROM admin_credentials WHERE id=1");
      assert.equal(
        await store.setPassword(await hashPassword("fixture-password-never-production"), true),
        true,
      );
      const sid = sessionHash(randomUUID());
      await store.createSession(sid, new Date(Date.now() + 60000));
      assert.equal(await store.sessionValid(sid), true);
      const originalHash = await store.credentials();
      assert.equal(
        await store.setPassword(await hashPassword("another-fixture-password"), true),
        false,
      );
      assert.equal(await store.credentials(), originalHash);
      assert.equal(await store.sessionValid(sid), true);
      await store.revokeSession(sid);
      assert.equal(await store.sessionValid(sid), false);
      const expired = sessionHash(randomUUID());
      await store.createSession(expired, new Date(Date.now() - 1000));
      assert.equal(await store.sessionValid(expired), false);
      const bucket = randomUUID();
      assert.equal(await store.rateLimit(bucket, 1, 60), true);
      assert.equal(await store.rateLimit(bucket, 1, 60), false);
      // Start with an env profile whose embedding key/address inherit chat env.
      await runtime.pool.query("DELETE FROM model_profiles");
      Object.assign(process.env, {
        CONFIG_MASTER_KEY: randomBytes(32).toString("base64"),
        CONFIG_KEY_VERSION: "fixture",
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "old-chat",
        OPENAI_COMPATIBLE_API_KEY: "fixture-old-key",
        OPENAI_BASE_URL: "https://api.openai.com/v1",
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_MODEL: "frozen-space",
        EMBEDDING_DIMENSIONS: "2048",
      });
      await freezeEmbedding();
      const frozen = embeddingFingerprint(await effectiveEmbedding());
      const profile = {
        enabled: true,
        provider: "openai-compatible",
        model: "new-chat",
        baseURL: "https://api.openai.com/v1",
        requestTimeoutMs: 10000,
        maxOutputTokens: 100,
      };
      const draft = await saveChat({
        version: 0,
        profile,
        key: { mode: "replace", value: "fixture-new-secret" },
      });
      assert.equal((await effectiveChat()).model, "old-chat");
      await activateChat(draft.version);
      assert.equal((await effectiveChat()).model, "new-chat");
      assert.equal(embeddingFingerprint(await effectiveEmbedding()), frozen);
      const summary = JSON.stringify(await settingsSummary());
      assert.ok(!summary.includes("fixture-new-secret"));
      assert.ok(!summary.includes("ciphertext"));
      assert.ok(!summary.includes("nonce"));
      await assert.rejects(() =>
        saveChat({
          version: draft.version,
          profile: { ...profile, provider: "openai" },
          key: { mode: "keep" },
        }),
      );
      const disabled = await saveChat({
        version: draft.version,
        profile: { ...profile, enabled: false },
        key: { mode: "keep" },
      });
      await activateChat(disabled.version);
      await assert.rejects(() => effectiveChat());
      const stored = await createProfileStore().read("chat.active");
      assert.ok(stored?.key_envelope);
      await runtime.pool.query(
        "UPDATE model_profiles SET key_envelope=jsonb_set(key_envelope,'{tag}','\"invalid\"') WHERE name='chat.active'",
      );
      await runtime.pool.query(
        "UPDATE model_profiles SET profile=jsonb_set(profile,'{enabled}','true') WHERE name='chat.active'",
      );
      await assert.rejects(() => effectiveChat());
      assert.equal(recordToPost(await store.read(row.id), false).metadata.published, false);
      // Restore test-only configuration for the subsequent browser workflow.
      await runtime.pool.query("DELETE FROM model_profiles");
    } finally {
      await runtime.close();
    }
  },
);
