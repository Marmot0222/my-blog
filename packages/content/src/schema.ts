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
