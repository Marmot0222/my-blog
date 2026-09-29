import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublishingStore, createProfileStore, PublishingConflict } from "@ting-lab/database";
import {
  parseDraft,
  sessionHash,
  publishFingerprint,
  settingsSummary,
  saveChat,
  activateChat,
  replaceEmbeddingKey,
  testProfile,
} from "@ting-lab/publishing";
import { AdminError, assertSameOrigin, login, readAdminJson, requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
type Context = { params: Promise<{ path: string[] }> };
const actionSchema = z
  .object({
    action: z.enum(["save", "publish", "unpublish", "delete", "restore", "retry"]),
    version: z.number().int().positive(),
    draft: z.unknown().optional(),
  })
  .strict();
function failure(error: unknown) {
  if (error instanceof AdminError)
    return NextResponse.json({ message: error.message }, { status: error.status, headers });
  if (error instanceof PublishingConflict)
    return NextResponse.json(
      {
        message:
          error.code === "conflict"
            ? "内容已在其他页面更新。请复制当前编辑，再刷新页面。"
            : "操作失败：文章不存在、已删除或发布后的 slug 不可修改。",
      },
      { status: error.code === "not-found" ? 404 : 409, headers },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { message: "字段格式无效，请检查必填项、日期和类型。" },
      { status: 400, headers },
    );
  if (error && typeof error === "object" && "code" in error && error.code === "23505")
    return NextResponse.json({ message: "slug 已被使用。" }, { status: 409, headers });
  return NextResponse.json({ message: "服务暂时不可用，输入已保留。" }, { status: 503, headers });
}
export async function GET(_request: Request, { params }: Context) {
  try {
    await requireAdmin();
    const parts = (await params).path,
      store = createPublishingStore();
    if (parts.join("/") === "settings")
      return NextResponse.json(await settingsSummary(), { headers });
    if (parts.join("/") === "export") {
      const rows = await store.exportContent();
      return NextResponse.json(
        {
          format: "ting-lab-content-v1",
          articles: rows,
        },
        {
          headers: {
            ...headers,
            "Content-Disposition": "attachment; filename=ting-lab-content.json",
          },
        },
      );
    }
    return NextResponse.json({ message: "入口不存在" }, { status: 404, headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const parts = (await params).path;
    if (parts.join("/") === "login") {
      const input = z
        .object({ password: z.string().min(1).max(256) })
        .strict()
        .parse(await readAdminJson(request));
      await login(input.password);
      return NextResponse.json({ ok: true }, { headers });
    }
    const session = await requireAdmin(),
      store = createPublishingStore();
    if (parts.join("/") === "logout") {
      await store.revokeSession(sessionHash(session.id!));
      session.destroy();
      return NextResponse.json({ ok: true }, { headers });
    }
    const input = await readAdminJson(request);
    if (parts[0] === "settings") {
      if (parts[1] === "save") {
        try {
          return NextResponse.json(await saveChat(input), { headers });
        } catch (error) {
          if (error instanceof PublishingConflict) throw error;
          throw new AdminError(
            400,
            "配置保存失败：请检查主机批准列表、主密钥；切换供应商或地址必须替换 Key。",
          );
        }
      }
      const data = z
        .object({
          version: z.number().int().positive().optional(),
          value: z.string().max(4096).optional(),
          kind: z.enum(["chat", "embedding"]).optional(),
        })
        .strict()
        .parse(input);
      if (parts[1] === "activate") {
        await activateChat(z.number().int().positive().parse(data.version));
        return NextResponse.json({ ok: true }, { headers });
      }
      if (parts[1] === "remove") {
        await createProfileStore().removeChatOverride();
        return NextResponse.json({ ok: true }, { headers });
      }
      if (parts[1] === "embedding") {
        await replaceEmbeddingKey(z.string().min(1).parse(data.value));
        return NextResponse.json({ ok: true }, { headers });
      }
      if (parts[1] === "test") {
        if (!(await store.rateLimit("connection-test", 5, 60)))
          throw new AdminError(429, "连接测试过于频繁，请一分钟后再试。");
        return NextResponse.json(await testProfile(data.kind ?? "chat", data.version), { headers });
      }
    }
    if (parts.join("/") === "posts") {
      let draft;
      try {
        draft = parseDraft(input);
      } catch {
        throw new AdminError(400, "文章格式无效：检查元数据与正文安全规则。");
      }
      return NextResponse.json(await store.create(draft), { status: 201, headers });
    }
    if (parts[0] === "posts" && parts.length === 2) {
      const id = z.string().uuid().parse(parts[1]);
      const data = actionSchema.parse(input);
      if (data.action === "save") {
        let draft;
        try {
          draft = parseDraft(data.draft);
        } catch {
          throw new AdminError(400, "文章格式无效：检查元数据与正文安全规则。");
        }
        return NextResponse.json(await store.save(id, data.version, draft), { headers });
      }
      if (data.action === "retry") {
        await store.retry(id);
        return NextResponse.json({ ok: true }, { headers });
      }
      // Configuration service supplies the immutable embedding-space fingerprint.
      return NextResponse.json(
        await store.change(
          id,
          data.version,
          data.action,
          data.action === "publish" ? await publishFingerprint() : "invalidated",
        ),
        {
          headers,
        },
      );
    }
    return NextResponse.json({ message: "入口不存在" }, { status: 404, headers });
  } catch (error) {
    return failure(error);
  }
}
