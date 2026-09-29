import { createHash } from "node:crypto";
import {
  createContentRepository,
  postFrontMatterSchema,
  isSafeSlug,
  tagToSlug,
  validateMarkdown,
  type Post,
  type ContentRepositoryOptions,
} from "@ting-lab/content";
import { createPublishingStore, type ArticleRecord } from "@ting-lab/database";
import { z } from "zod";

export function contentSource(env: NodeJS.ProcessEnv = process.env): "file" | "database" {
  const value = env.CONTENT_SOURCE ?? "file";
  if (value !== "file" && value !== "database")
    throw new Error("CONTENT_SOURCE must be file or database");
  return value;
}
export const draftSchema = z
  .object({
    slug: z.string().max(100).refine(isSafeSlug, "slug 必须是小写英文、数字和连字符"),
    metadata: postFrontMatterSchema,
    body: z.string().max(200_000),
  })
  .strict();
export function parseDraft(value: unknown) {
  const input = draftSchema.parse(value);
  if (
    input.metadata.title.length > 200 ||
    input.metadata.description.length > 1000 ||
    input.metadata.category.length > 100 ||
    input.metadata.tags.length > 20 ||
    input.metadata.tags.some((tag) => tag.length > 100)
  )
    throw new Error("元数据超过长度上限");
  if (input.metadata.featured && !input.metadata.visual) throw new Error("精选内容必须配置 visual");
  input.metadata.tags.forEach(tagToSlug);
  validateMarkdown(input.body);
  const checksum = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return { ...input, checksum };
}
export function recordToPost(row: ArticleRecord, published = true): Post {
  const metadata = postFrontMatterSchema.parse({ ...row.metadata, published });
  validateMarkdown(row.body);
  return {
    metadata: {
      ...metadata,
      slug: row.slug,
      readingTime: `约 ${Math.max(1, Math.ceil(row.body.length / 700))} 分钟阅读`,
    },
    content: row.body,
  };
}
export async function getContentSnapshot(options: ContentRepositoryOptions) {
  if (contentSource() === "file") return createContentRepository(options);
  const records = await createPublishingStore().published();
  return createContentRepository({
    ...options,
    postEntries: records.map((row) => recordToPost(row)),
  });
}
