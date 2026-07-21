import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const requiredText = z.string().trim().min(1);
const isoDate = z.string().refine(isValidIsoDate, "必须是有效的 YYYY-MM-DD 日期");
const yearMonth = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "必须是有效的 YYYY-MM 月份");
const publicUrl = z
  .string()
  .url("必须是有效 URL")
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "只允许 HTTP(S) URL");

export const postFrontMatterSchema = z
  .object({
    title: requiredText,
    description: requiredText,
    date: isoDate,
    updatedAt: isoDate.optional(),
    tags: z.array(requiredText).min(1),
    category: requiredText,
    published: z.boolean(),
    featured: z.boolean().default(false),
    kind: z.enum(["article", "note"]),
    visual: z.enum(["interface", "system", "code"]).optional(),
  })
  .strict();

export type PostFrontMatter = z.infer<typeof postFrontMatterSchema>;

export const projectFrontMatterSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "必须是 URL 安全的小写英文 slug"),
    title: requiredText,
    summary: requiredText,
    status: z.enum(["active", "maintained", "archived", "concept"]),
    featured: z.boolean().default(false),
    order: z.number().int().nonnegative(),
    startedAt: yearMonth,
    updatedAt: isoDate,
    role: requiredText,
    stack: z.array(requiredText).min(1).max(20),
    cover: z
      .string()
      .regex(/^\/[^\s]+$/, "必须是站内绝对路径")
      .optional(),
    repository: publicUrl.optional(),
    demo: publicUrl.optional(),
    published: z.boolean(),
  })
  .strict();

export type ProjectFrontMatter = z.infer<typeof projectFrontMatterSchema>;
