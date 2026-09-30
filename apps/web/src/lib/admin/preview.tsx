"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { createPublishingStore } from "@ting-lab/database";
import { compileMdxContent } from "@/components/mdx/MdxContent";
import { requireAdmin, assertSameOrigin, AdminError } from "./auth";

let compiling = false;
const schema = z
  .object({
    title: z.string().max(200),
    description: z.string().max(1000),
    category: z.string().max(100),
    date: z.string().max(30),
    body: z.string().max(200000),
  })
  .strict();
export async function previewDraft(value: unknown) {
  let acquired = false;
  try {
    await requireAdmin();
    assertSameOrigin(new Request("http://preview", { headers: await headers() }));
    if (Buffer.byteLength(JSON.stringify(value)) > 300000)
      throw new AdminError(413, "预览内容过大");
    const input = schema.parse(value);
    if (compiling || !(await createPublishingStore().rateLimit("markdown-preview", 30, 60)))
      throw new AdminError(429, "预览繁忙，请稍后重试");
    compiling = true;
    acquired = true;
    const { content } = await compileMdxContent(input.body);
    return {
      content: (
        <article>
          <h1>{input.title || "未命名草稿"}</h1>
          <p>
            {input.date} · {input.category}
          </p>
          <p>{input.description}</p>
          {content}
        </article>
      ),
      error: null,
    };
  } catch (error) {
    return {
      content: null,
      error:
        error instanceof AdminError
          ? error.message
          : "无法预览，请检查 Markdown 安全规则或稍后重试。",
    };
  } finally {
    if (acquired) compiling = false;
  }
}
