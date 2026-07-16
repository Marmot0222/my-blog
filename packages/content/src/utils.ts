const safeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const knownTagSlugs = new Map<string, string>([
  ["Next.js", "nextjs"],
  ["React", "react"],
  ["TypeScript", "typescript"],
  ["系统设计", "system-design"],
  ["性能优化", "performance"],
  ["AI 编程", "ai-coding"],
  ["工程化", "engineering"],
  ["数据结构与算法", "data-structures-and-algorithms"],
  ["前端工程", "frontend-engineering"],
]);

export function isSafeSlug(value: string): boolean {
  return safeSlugPattern.test(value);
}

export function tagToSlug(label: string): string {
  const knownSlug = knownTagSlugs.get(label);

  if (knownSlug) {
    return knownSlug;
  }

  const fallback = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!isSafeSlug(fallback)) {
    throw new Error(`标签“${label}”无法生成安全 slug，请在标签映射中显式配置。`);
  }

  return fallback;
}

export function comparePostsByDate<T extends { date: string }>(left: T, right: T): number {
  return right.date.localeCompare(left.date);
}
