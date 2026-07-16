export type FeaturedArticle = Readonly<{
  id: string;
  title: string;
  category: string;
  date: string;
  description: string;
  visual: "interface" | "system" | "code";
}>;

export type LatestNote = Readonly<{
  title: string;
  date: string;
}>;

export const featuredArticles: readonly FeaturedArticle[] = [
  {
    id: "nextjs-concurrent-rendering",
    title: "理解 Next.js 15 的并发渲染机制",
    category: "前端开发",
    date: "2026.07.10",
    description: "深入剖析并发渲染的工作原理，以及它如何改善应用响应性与用户体验。",
    visual: "interface",
  },
  {
    id: "cache-system-from-scratch",
    title: "从零实现一个缓存系统",
    category: "系统设计",
    date: "2026.07.06",
    description: "从一次实际需求出发，设计具有淘汰策略、并发控制和持久化能力的缓存系统。",
    visual: "system",
  },
  {
    id: "ai-coding-partner",
    title: "让 AI 真正帮你写代码",
    category: "AI 与开发",
    date: "2026.07.01",
    description: "探索 AI 编程助手的边界与协作方式，让工具真正提升代码开发效率。",
    visual: "code",
  },
];

export const latestNotes: readonly LatestNote[] = [
  { title: "为什么我放弃了 Redux", date: "07.12" },
  { title: "用一个中间件理解 Koa 的洋葱模型", date: "07.08" },
  { title: "CSS 容器查询实战指南", date: "07.03" },
];

export const topics = [
  "Next.js",
  "React",
  "TypeScript",
  "系统设计",
  "性能优化",
  "AI 编程",
  "工程化",
  "数据结构与算法",
] as const;
