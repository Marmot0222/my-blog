import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeImage, mediaConfigSchema, MediaError, readLimitedBody } from "./index";
const limits = mediaConfigSchema.parse({});
test("decodes real images, removes EXIF and preserves readable PNG", async () => {
  const data = await sharp({ create: { width: 30, height: 20, channels: 3, background: "white" } })
    .png()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await normalizeImage(data, limits);
  assert.equal(result.mime, "image/png");
  assert.equal(result.width, 20);
  assert.equal(result.height, 30);
  assert.equal((await sharp(result.data).metadata()).exif, undefined);
  assert.equal(result.bytes, result.data.length);
});
test("rejects forged MIME, SVG, corrupt data, excessive pixels and bytes", async () => {
  for (const bytes of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from([255, 216, 255, 0, 0]),
  ])
    await assert.rejects(normalizeImage(bytes, limits), MediaError);
  const data = await sharp({ create: { width: 50, height: 50, channels: 3, background: "red" } })
    .jpeg()
    .toBuffer();
  await assert.rejects(normalizeImage(data, { ...limits, MEDIA_MAX_PIXELS: 10 }), MediaError);
  await assert.rejects(normalizeImage(data, { ...limits, MEDIA_MAX_BYTES: 10 }), MediaError);
});
test("streaming body limit does not trust content-length", async () => {
  await assert.rejects(
    readLimitedBody(new Request("http://fixture", { method: "POST", body: "too large" }), 3),
    (error) => error instanceof MediaError && error.status === 413,
  );
});
