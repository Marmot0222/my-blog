import { z } from "zod";
import { mediaRequest, assetSchema } from "@ting-lab/media/client";
import { createPublishingStore } from "@ting-lab/database";
import { AdminError, assertSameOrigin, requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
type Context = { params: Promise<{ path?: string[] }> };
let uploadsInFlight = 0;
async function handle(request: Request, { params }: Context) {
  let admitted = false;
  try {
    await requireAdmin();
    if (request.method !== "GET") assertSameOrigin(request);
    const parts = (await params).path ?? [];
    if (parts.length > 2) throw new AdminError(404, "入口不存在");
    const id = parts[0] ? z.string().uuid().parse(parts[0]) : undefined;
    if (parts[1] && parts[1] !== "references") throw new AdminError(404, "入口不存在");
    if (request.method === "POST" && id) throw new AdminError(405, "不支持此操作");
    if (request.method === "DELETE" && !id) throw new AdminError(405, "请选择图片");
    const store = createPublishingStore();
    if (request.method === "GET" && parts[1] === "references" && id)
      return Response.json(await store.mediaReferences(id), { headers });
    if (request.method === "DELETE" && id && (await store.mediaReferences(id)).length)
      throw new AdminError(409, "图片被文章修订引用，不能删除");
    let body: Buffer | undefined;
    const forwarded = new Headers();
    if (request.method === "POST") {
      if (uploadsInFlight >= 2) throw new AdminError(429, "上传繁忙，请稍后重试");
      uploadsInFlight++;
      admitted = true;
      if (!(await store.rateLimit("media-upload", 30, 60)))
        throw new AdminError(429, "上传过于频繁，请稍后重试");
      const max = Math.min(
        20 * 1024 * 1024,
        Number(process.env.MEDIA_MAX_BYTES ?? 10 * 1024 * 1024),
      );
      if (!Number.isFinite(max) || max < 1024) throw new AdminError(503, "上传限制配置无效");
      if (Number(request.headers.get("content-length")) > max)
        throw new AdminError(413, "图片超过上传大小限制");
      const reader = request.body?.getReader();
      if (!reader) throw new AdminError(400, "文件为空");
      const chunks: Uint8Array[] = [];
      let total = 0;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        void reader.cancel();
      }, 30000);
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          total += item.value.byteLength;
          if (total > max) {
            await reader.cancel();
            throw new AdminError(413, "图片超过上传大小限制");
          }
          chunks.push(item.value);
        }
      } finally {
        clearTimeout(timeout);
        reader.releaseLock();
      }
      if (timedOut) throw new AdminError(408, "上传超时，请重试");
      body = Buffer.concat(chunks);
      forwarded.set(
        "x-upload-session",
        z.string().uuid().parse(request.headers.get("x-upload-session")),
      );
      forwarded.set("x-filename", (request.headers.get("x-filename") ?? "image").slice(0, 1000));
      forwarded.set("content-type", "application/octet-stream");
    }
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(new URL(request.url).searchParams.get("page") ?? 1);
    const response = await mediaRequest(id ? `/assets/${id}` : `/assets?page=${page}`, {
      method: request.method,
      headers: forwarded,
      body: body ? new Uint8Array(body) : undefined,
    });
    if (request.method === "GET" && response.ok && !id) {
      const data = z
        .object({ items: z.array(assetSchema), hasNext: z.boolean(), page: z.number() })
        .parse(await response.json());
      const states = await store.mediaAccessStates(data.items.map((asset) => asset.id));
      return Response.json(
        {
          ...data,
          items: data.items.map((asset) => ({
            ...asset,
            access: states.find((row) => row.media_id === asset.id)?.published
              ? "public"
              : "private",
          })),
        },
        { headers },
      );
    }
    return new Response(await response.text(), {
      status: response.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof AdminError ? error.message : "媒体服务暂不可用，请稍后重试" },
      {
        status:
          error instanceof AdminError ? error.status : error instanceof z.ZodError ? 400 : 503,
        headers,
      },
    );
  } finally {
    if (admitted) uploadsInFlight--;
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
