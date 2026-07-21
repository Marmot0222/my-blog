# 项目内容维护

`content/projects` 是项目作品的唯一事实来源。每个项目使用一个 MDX 文件；文件名与 `slug` 建议保持一致，公开 URL 为 `/projects/<slug>`。Web 应用只能通过 `@ting-lab/content` 的公共仓库 API 读取项目，不得直接扫描该目录。

## Front Matter

```yaml
slug: ting-lab
title: "Ting Lab"
summary: "一句公开摘要"
status: active # active | maintained | archived | concept
featured: true
order: 10
startedAt: "2026-07"
updatedAt: "2026-07-21"
role: "独立设计与开发"
stack:
  - Next.js
repository: https://github.com/example/project # 可选，仅 HTTP(S)
demo: https://example.com # 可选，仅 HTTP(S)
cover: /images/projects/example.webp # 可选，站内绝对路径
published: true
```

字段由严格 Zod Schema 校验，未知字段、重复 slug、重复技术项、非法日期、枚举、URL 或 slug 都会使 `pnpm content:check` 失败。`published: false` 的项目不会进入公开列表、详情静态参数、搜索或 sitemap。

## 正文与排序

Front Matter 后使用现有 MDX 能力编写背景、核心能力、技术决策、问题处理和当前状态。项目详情复用文章已有的安全链接、GFM、标题 slug 与 Shiki 代码高亮，不维护第二套 MDX 编译器。

公开项目依次按以下规则排序：

1. `featured: true` 优先。
2. `order` 从小到大。
3. `updatedAt` 从新到旧。
4. `slug` 稳定兜底。

项目会进入本地站内搜索与 sitemap；RSS 仍然只发布文章。没有可靠仓库或演示地址时省略字段，页面不会渲染假按钮。

## 校验

```bash
pnpm content:check
pnpm --filter @ting-lab/content test
pnpm test:e2e
```
