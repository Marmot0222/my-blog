import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
sharp.cache({ memory: 16, files: 0, items: 10 });
sharp.concurrency(1);

export const mediaConfigSchema = z.object({
  MEDIA_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  MEDIA_MAX_PIXELS: z.coerce.number().int().min(1).max(40_000_000).default(20_000_000),
  MEDIA_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  MEDIA_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(30000),
});
export type MediaLimits = z.infer<typeof mediaConfigSchema>;
export class MediaError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readLimitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new MediaError(413, "图片超过上传大小限制");
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError(400, "文件为空");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new MediaError(413, "图片超过上传大小限制");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function normalizeImage(data: Buffer, limits: MediaLimits) {
  if (!data.length || data.length > limits.MEDIA_MAX_BYTES)
    throw new MediaError(413, "图片为空或超过上传大小限制");
  const signature = data.subarray(0, 12);
  const format = signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : signature[0] === 255 && signature[1] === 216 && signature[2] === 255
      ? "jpeg"
      : signature.toString("ascii", 0, 4) === "RIFF" &&
          signature.toString("ascii", 8, 12) === "WEBP"
        ? "webp"
        : null;
  if (!format) throw new MediaError(415, "仅支持真实 JPEG、PNG、WebP 图片");
  try {
    // Some decoder builds flatten APNG rather than reporting multiple pages.
    // Reject animation control chunks before decoding, including single-frame animation.
    if (format === "png")
      for (let offset = 8; offset + 12 <= data.length;) {
        if (data.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("animation");
        offset += 12 + data.readUInt32BE(offset);
      }
    if (format === "webp")
      for (let offset = 12; offset + 8 <= data.length;) {
        const chunk = data.toString("ascii", offset, offset + 4);
        if (chunk === "ANIM" || chunk === "ANMF") throw new Error("animation");
        const size = data.readUInt32LE(offset + 4);
        offset += 8 + size + (size % 2);
      }
    const image = sharp(data, {
      limitInputPixels: limits.MEDIA_MAX_PIXELS,
      failOn: "warning",
      animated: true,
    });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error("animation");
    const { data: output, info } = await image
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .toFormat(format, format === "png" ? { compressionLevel: 6 } : { quality: 90 })
      .timeout({ seconds: Math.max(1, Math.floor(limits.MEDIA_TIMEOUT_MS / 1000)) })
      .toBuffer({ resolveWithObject: true });
    if (output.length > limits.MEDIA_MAX_BYTES)
      throw new MediaError(413, "标准化后的图片超过大小限制");
    return {
      data: output,
      mime: `image/${format}`,
      width: info.width,
      height: info.height,
      bytes: output.length,
      checksum: createHash("sha256").update(output).digest("hex"),
    };
  } catch (error) {
    if (error instanceof MediaError) throw error;
    throw new MediaError(422, "图片无法解码、像素超限或属于动画图片");
  }
}
