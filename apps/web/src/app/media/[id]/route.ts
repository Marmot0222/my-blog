import { z } from "zod";
import { createPublishingStore } from "@ting-lab/database";
import { mediaRequest } from "@ting-lab/media/client";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };
  try {
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    const published =
      process.env.CONTENT_SOURCE === "database" &&
      (await createPublishingStore().mediaIsPublished(id));
    if (!published) await requireAdmin();
    const response = await mediaRequest(`/assets/${id}/bytes`);
    if (!response.ok) return new Response(null, { status: response.status, headers });
    const etag = response.headers.get("etag") ?? "";
    // Always re-authorize before a conditional response; caches must revalidate.
    const output = {
      ...headers,
      "Cache-Control": published ? "public, max-age=0, must-revalidate" : "private, no-store",
      ETag: etag,
    };
    if (published && request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers: output });
    return new Response(response.body, {
      headers: {
        ...output,
        "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
        "Content-Length": response.headers.get("content-length") ?? "0",
      },
    });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
