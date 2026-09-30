import { z } from "zod";

export const assetSchema = z.object({
  access: z.enum(["public", "private"]).optional(),
  id: z.string().uuid(),
  mime: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  checksum: z.string(),
  filename: z.string(),
  created_at: z.string(),
  upload_session: z.string().uuid(),
  protected: z.boolean(),
});
export type Asset = z.infer<typeof assetSchema>;
/** Server-only transport. Identity is fixed by the trusted application, never browser input. */
export async function mediaRequest(path: string, init: RequestInit = {}) {
  const base = process.env.MEDIA_SERVICE_URL;
  const secret = process.env.MEDIA_SERVICE_TOKEN;
  if (!base || !secret || secret.length < 32) throw new Error("Media unavailable");
  const response = await fetch(new URL(path, base), {
    ...init,
    redirect: "error",
    cache: "no-store",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(35000)])
      : AbortSignal.timeout(35000),
    headers: {
      ...Object.fromEntries(new Headers(init.headers)),
      authorization: `Bearer ${secret}`,
      "x-media-app": "ting-lab",
      "x-media-owner": "admin",
    },
  });
  return response;
}
export async function prepareMedia(ids: readonly string[], operation: string) {
  if (!ids.length) return;
  const response = await mediaRequest("/references", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, operation }),
  });
  if (!response.ok) throw new Error("Media references unavailable");
}
