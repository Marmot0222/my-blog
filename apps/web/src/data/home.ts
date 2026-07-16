export type FeaturedArticle = Readonly<{
  id: string;
  slug: string;
  title: string;
  category: string;
  date: string;
  description: string;
  visual: "interface" | "system" | "code";
}>;

export type LatestNote = Readonly<{
  title: string;
  slug: string;
  date: string;
}>;

export type Topic = Readonly<{
  label: string;
  slug: string;
}>;

export type PostPageData = Readonly<{
  slug: string;
  title: string;
  category: string;
  date: string;
  description: string;
}>;

export const featuredArticles: readonly FeaturedArticle[] = [
  {
    id: "nextjs-concurrent-rendering",
    slug: "nextjs-concurrent-rendering",
    title: "理解 Next.js 15 的并发渲染机制",
    category: "前端开发",
    date: "2026-07-10",
    description: "深入剖析并发渲染的工作原理，以及它如何改善应用响应性与用户体验。",
    visual: "interface",
  },
  {
    id: "cache-system-from-scratch",
    slug: "cache-system-from-scratch",
    title: "从零实现一个缓存系统",
    category: "系统设计",
    date: "2026-07-06",
    description: "从一次实际需求出发，设计具有淘汰策略、并发控制和持久化能力的缓存系统。",
    visual: "system",
  },
  {
    id: "ai-coding-partner",
    slug: "ai-coding-partner",
    title: "让 AI 真正帮你写代码",
    category: "AI 与开发",
    date: "2026-07-01",
    description: "探索 AI 编程助手的边界与协作方式，让工具真正提升代码开发效率。",
    visual: "code",
  },
];

export const latestNotes: readonly LatestNote[] = [
  { title: "为什么我放弃了 Redux", slug: "why-i-left-redux", date: "2026-07-12" },
  { title: "用一个中间件理解 Koa 的洋葱模型", slug: "koa-onion-model", date: "2026-07-08" },
  { title: "CSS 容器查询实战指南", slug: "css-container-query-guide", date: "2026-07-03" },
];

export const topics: readonly Topic[] = [
  { label: "Next.js", slug: "nextjs" },
  { label: "React", slug: "react" },
  { label: "TypeScript", slug: "typescript" },
  { label: "系统设计", slug: "system-design" },
  { label: "性能优化", slug: "performance" },
  { label: "AI 编程", slug: "ai-coding" },
  { label: "工程化", slug: "engineering" },
  { label: "数据结构与算法", slug: "data-structures-and-algorithms" },
];

export function formatFullDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}

export function getFeaturedArticleBySlug(slug: string): FeaturedArticle | undefined {
  return featuredArticles.find((article) => article.slug === slug);
}

export function getLatestNoteBySlug(slug: string): LatestNote | undefined {
  return latestNotes.find((note) => note.slug === slug);
}

export function getTopicBySlug(slug: string): Topic | undefined {
  return topics.find((topic) => topic.slug === slug);
}

export function getPostBySlug(slug: string): PostPageData | undefined {
  const article = getFeaturedArticleBySlug(slug);

  if (article) {
    return article;
  }

  const note = getLatestNoteBySlug(slug);

  if (note) {
    return {
      ...note,
      category: "最新笔记",
      description: "这篇笔记尚在整理中，完整内容将在后续内容系统接入后发布。",
    };
  }
}
