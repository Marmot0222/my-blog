import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { createPublishingStore } from "@ting-lab/database";
import { contentSource, sessionHash, verifyPassword } from "@ting-lab/publishing";

export class AdminError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertAdminEnabled() {
  if (contentSource() !== "database")
    throw new AdminError(503, "文件演示模式不开放后台写入，请配置 database 模式。");
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32)
    throw new AdminError(503, "后台会话尚未配置。");
}
export async function adminSession() {
  assertAdminEnabled();
  return getIronSession<{ id?: string }>(await cookies(), {
    cookieName: "ting_lab_admin",
    password: process.env.ADMIN_SESSION_SECRET!,
    ttl: 8 * 60 * 60,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    },
  });
}
export async function requireAdmin() {
  const session = await adminSession();
  if (
    !session.id ||
    !/^[a-f0-9]{64}$/.test(session.id) ||
    !(await createPublishingStore().sessionValid(sessionHash(session.id)))
  )
    throw new AdminError(401, "请重新登录。");
  return session;
}
export function assertSameOrigin(request: Request) {
  const expected =
    process.env.ADMIN_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (
    request.headers.get("origin") !== new URL(expected).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AdminError(403, "请求来源不受信任。");
}
export async function readAdminJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AdminError(415, "请求必须是 JSON。");
  if (Number(request.headers.get("content-length")) > 300_000)
    throw new AdminError(413, "请求内容过大。");
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError(400, "请求为空。");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    total += item.value.byteLength;
    if (total > 300_000) {
      await reader.cancel();
      throw new AdminError(413, "请求内容过大。");
    }
    chunks.push(item.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AdminError(400, "JSON 格式无效。");
  }
}
export async function login(password: string) {
  const session = await adminSession(),
    store = createPublishingStore();
  // Single administrator: a durable global bucket cannot be evaded with spoofed proxy IPs.
  if (!(await store.rateLimit("login", 10, 900)))
    throw new AdminError(429, "尝试过于频繁，请稍后再试。");
  const hash = await store.credentials();
  if (!hash || !(await verifyPassword(password, hash)))
    throw new AdminError(401, "登录失败，请检查凭据。");
  if (session.id) await store.revokeSession(sessionHash(session.id));
  session.id = randomBytes(32).toString("hex");
  await store.createSession(sessionHash(session.id), new Date(Date.now() + 8 * 60 * 60 * 1000));
  await session.save();
}
