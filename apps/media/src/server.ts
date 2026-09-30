import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createMediaStore } from "@ting-lab/database";
import { normalizeImage, mediaConfigSchema, MediaError } from "@ting-lab/media";
import { z } from "zod";

const limits = mediaConfigSchema.parse(process.env);
const secret = process.env.MEDIA_SERVICE_TOKEN;
if (!secret || secret.length < 32 || !process.env.MEDIA_DATABASE_URL)
  throw new Error("Media configuration missing");
const expected = Buffer.from(`Bearer ${secret}`);
const store = createMediaStore(process.env.MEDIA_DATABASE_URL);
let active = 0;
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const json = (value: unknown, status = 200) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  let admitted = false;
  try {
    const url = new URL(req.url ?? "/", "http://media");
    if (url.pathname === "/health" && req.method === "GET") {
      await store.health();
      json({ ok: true });
      return;
    }
    const provided = Buffer.from(req.headers.authorization ?? "");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
      throw new MediaError(401, "Unauthorized");
    if (req.headers["x-media-app"] !== "ting-lab" || req.headers["x-media-owner"] !== "admin")
      throw new MediaError(403, "Identity rejected");
    const app = "ting-lab",
      owner = "admin";
    if (req.method === "POST" && url.pathname === "/assets") {
      if (active >= limits.MEDIA_CONCURRENCY) throw new MediaError(429, "媒体服务繁忙，请稍后重试");
      active++;
      admitted = true;
    }
    async function body(max: number) {
      if (Number(req.headers["content-length"]) > max)
        throw new MediaError(413, "图片超过上传大小限制");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        const data = Buffer.from(chunk);
        size += data.length;
        if (size > max) throw new MediaError(413, "图片超过上传大小限制");
        chunks.push(data);
      }
      return Buffer.concat(chunks);
    }
    if (url.pathname === "/assets" && req.method === "POST") {
      const session = z.string().uuid().parse(req.headers["x-upload-session"]);
      const filename = decodeURIComponent(String(req.headers["x-filename"] ?? "image")).slice(
        0,
        200,
      );
      const normalized = await normalizeImage(await body(limits.MEDIA_MAX_BYTES), limits);
      const id = await store.put(
        app,
        owner,
        { ...normalized, filename, upload_session: session },
        normalized.data,
      );
      json(await store.metadata(app, owner, id), 201);
      return;
    }
    if (url.pathname === "/assets" && req.method === "GET") {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(url.searchParams.get("page") ?? 1);
      json(await store.list(app, owner, page));
      return;
    }
    if (url.pathname === "/references" && req.method === "POST") {
      const input = z
        .object({
          ids: z.array(z.string().uuid()).max(100),
          operation: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
        .parse(JSON.parse((await body(20000)).toString()));
      try {
        await store.pin(app, owner, input.operation, [...new Set(input.ids)].sort());
      } catch {
        throw new MediaError(409, "图片不存在或不可关联");
      }
      json({ ok: true });
      return;
    }
    const match = /^\/assets\/([^/]+)(?:\/(bytes|references))?$/.exec(url.pathname);
    if (!match) throw new MediaError(404, "Not found");
    const id = z.string().uuid().parse(match[1]);
    const asset = await store.metadata(app, owner, id);
    if (!asset) throw new MediaError(404, "Not found");
    if (req.method === "DELETE" && !match[2]) {
      if (!(await store.remove(app, owner, id)))
        throw new MediaError(409, "图片已有关联保护，不能删除");
      json({ ok: true });
      return;
    }
    if (req.method !== "GET") throw new MediaError(405, "Method not allowed");
    if (match[2] === "references") {
      json(await store.pins(app, owner, id));
      return;
    }
    if (match[2] === "bytes") {
      const data = await store.bytes(app, owner, id);
      if (!data) throw new MediaError(404, "Not found");
      res.setHeader("Content-Type", asset.mime);
      res.setHeader("Content-Length", data.length);
      res.setHeader("ETag", `"${asset.checksum}"`);
      res.end(data);
      return;
    }
    json(asset);
  } catch (error) {
    if (!res.headersSent) res.setHeader("Connection", "close");
    if (!res.headersSent)
      json(
        { message: error instanceof MediaError ? error.message : "媒体服务暂不可用" },
        error instanceof MediaError ? error.status : error instanceof z.ZodError ? 400 : 503,
      );
    else res.destroy();
  } finally {
    if (admitted) active--;
  }
});
server.requestTimeout = limits.MEDIA_TIMEOUT_MS;
server.headersTimeout = Math.min(10000, limits.MEDIA_TIMEOUT_MS);
server.setTimeout(limits.MEDIA_TIMEOUT_MS, (socket) => socket.destroy());
server.maxConnections = 16;
server.listen(Number(process.env.MEDIA_PORT ?? 3100), "0.0.0.0");
process.on("SIGTERM", () => {
  server.close(() => {
    void store.close().then(() => process.exit(0));
  });
});
