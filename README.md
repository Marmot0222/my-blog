# Ting Lab

Ting Lab 是一个基于 pnpm workspace 与 Turborepo 的 Monorepo。当前只包含应用与领域包的基础边界，不包含博客、数据库、AI 或 RAG 业务实现。

## 项目结构

```text
apps/web/                    Next.js App Router 应用
packages/ui/                 共享 UI 基础
packages/content/            内容读取与转换边界
packages/database/           数据持久化边界
packages/ai/                 模型供应商与生成能力边界
packages/retrieval/          检索与 RAG 编排边界
packages/typescript-config/  共享 TypeScript 配置
packages/eslint-config/      共享 ESLint 配置
content/posts/               文章源内容
content/projects/            项目源内容
```

## 启动

需要 Node.js 20+ 与 pnpm 9。

```bash
pnpm install
pnpm dev
```

Web 应用默认运行于 `http://localhost:3000`。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ting-lab/web build
```
