import { writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import matter from "gray-matter";
import { postFrontMatterSchema } from "./schema";
import { isSafeSlug } from "./utils";

export function createPostDraft(postsDirectory: string, args: string[], now = new Date()): string {
  const { values } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: { kind: { type: "string" }, slug: { type: "string" }, title: { type: "string" } },
    strict: true,
  });
  const { kind, slug, title } = values;
  if (!slug || !isSafeSlug(slug) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(slug)) {
    throw new Error("--slug 必须是 URL 安全的小写英文 slug，且不能是 Windows 保留文件名");
  }
  if ((kind !== "article" && kind !== "note") || !title?.trim()) {
    throw new Error("请提供 --kind article|note 和非空 --title");
  }
  const metadata = postFrontMatterSchema.parse({
    title,
    kind,
    description: "待补充：用一句话概括本文。",
    date: now.toISOString().slice(0, 10),
    tags: ["工程化"],
    category: "工程实践",
    published: false,
    featured: false,
  });
  const sections =
    kind === "article"
      ? ["问题背景", "约束", "尝试", "方案", "验证", "局限"]
      : ["问题", "记录", "下一步"];
  const body = sections
    .map((heading) => `## ${heading}\n\n待填写：${heading}相关的真实记录。`)
    .join("\n\n");
  const target = path.join(postsDirectory, `${slug}.mdx`);
  try {
    writeFileSync(target, matter.stringify(body, metadata), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`目标已存在，未覆盖：${target}`);
    }
    throw error;
  }
  return target;
}
