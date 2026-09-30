import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const base = process.env.TEST_MEDIA_SERVICE_URL;
(base ? test : test.skip)(
  "media HTTP: trusted identity, normalization, validation, metadata and protected deletion",
  async () => {
    const url = new URL(base!);
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    assert.ok(process.env.TEST_MEDIA_DATABASE_URL?.endsWith("_test"));
    const headers = {
      authorization: `Bearer ${process.env.MEDIA_SERVICE_TOKEN}`,
      "x-media-app": "ting-lab",
      "x-media-owner": "admin",
    };
    assert.equal((await fetch(`${base}/assets`)).status, 401);
    assert.equal(
      (await fetch(`${base}/assets`, { headers: { ...headers, "x-media-owner": "other" } })).status,
      403,
    );
    const upload = {
      ...headers,
      "x-filename": "fixture.png",
      "x-upload-session": randomUUID(),
      "content-type": "image/png",
    };
    assert.equal(
      (await fetch(`${base}/assets`, { method: "POST", headers: upload, body: "<svg/>" })).status,
      415,
    );
    const png = await sharp({ create: { width: 80, height: 40, channels: 3, background: "white" } })
      .png()
      .toBuffer();
    const response = await fetch(`${base}/assets`, {
      method: "POST",
      headers: upload,
      body: new Uint8Array(png),
    });
    assert.equal(response.status, 201);
    const asset = (await response.json()) as { id: string; bytes: number; checksum: string };
    const bytes = await fetch(`${base}/assets/${asset.id}/bytes`, { headers });
    assert.equal(bytes.status, 200);
    assert.equal(bytes.headers.get("content-type"), "image/png");
    assert.equal(Number(bytes.headers.get("content-length")), asset.bytes);
    assert.equal((await bytes.arrayBuffer()).byteLength, asset.bytes);
    const list = (await (await fetch(`${base}/assets`, { headers })).json()) as {
      items: Record<string, unknown>[];
    };
    assert.ok(list.items.every((item) => !("data" in item)));
    const pin = () =>
      fetch(`${base}/references`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ ids: [asset.id], operation: asset.checksum }),
      });
    assert.equal((await pin()).status, 200);
    assert.equal((await pin()).status, 200);
    assert.equal(
      (await fetch(`${base}/assets/${asset.id}`, { method: "DELETE", headers })).status,
      409,
    );
    const large = await sharp({
      create: { width: 4000, height: 4000, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const concurrent = await Promise.all(
      Array.from({ length: 3 }, () =>
        fetch(`${base}/assets`, { method: "POST", headers: upload, body: new Uint8Array(large) }),
      ),
    );
    assert.ok(concurrent.some((result) => result.status === 201));
    assert.ok(concurrent.some((result) => result.status === 429));
    assert.ok(concurrent.every((result) => [201, 429].includes(result.status)));
    await Promise.all(concurrent.map((result) => result.arrayBuffer()));
  },
);
