# Ting Lab 协作指南

## 项目定位与视觉方向

Ting Lab 是一个用于沉淀文章、项目与实验性数字产品的个人实验室。视觉上保持安静、克制、编辑感与内容优先：使用清晰排版、充足留白、温和中性色和少量有意图的动效，避免模板化的 SaaS 观感与装饰堆叠。

## Monorepo 目录职责

- `apps/web`：唯一的 Next.js App Router Web 应用与页面组合层。
- `packages/*`：可复用领域能力、共享 UI 与工具配置；不得放页面路由。
- `content/posts`：文章源文件目录。
- `content/projects`：项目源文件目录。
- 根目录：workspace、Turborepo、统一命令和仓库级文档。

## workspace 包职责

- `@ting-lab/web`：路由、页面组合、Metadata、服务端/客户端组件边界和 Web 入口。
- `@ting-lab/ui`：轻量、可复用、无业务语义的 React UI 基础；不发展为完整组件库。
- `@ting-lab/content`：读取、校验和转换 `content` 下的源内容；不负责渲染页面。
- `@ting-lab/database`：数据库客户端、schema、迁移和持久化访问边界。
- `@ting-lab/ai`：模型供应商适配、提示词与生成调用边界。
- `@ting-lab/retrieval`：切分、索引、检索和 RAG 编排边界。
- `@ting-lab/typescript-config`：共享 TypeScript 严格模式配置。
- `@ting-lab/eslint-config`：共享 ESLint flat config。

## 允许的依赖方向

- `apps/web` 可以依赖所有业务包与 `@ting-lab/ui`，负责最终组合。
- `@ting-lab/retrieval` 可以依赖 `@ting-lab/content`、`@ting-lab/database`、`@ting-lab/ai`。
- `@ting-lab/content`、`@ting-lab/database`、`@ting-lab/ai` 默认彼此独立；确有需要时通过类型明确的公共 API 协作。
- `@ting-lab/ui` 不得依赖业务包或 `apps/web`。
- 所有 TypeScript workspace 可以依赖共享 TypeScript 与 ESLint 配置。
- `packages/*` 不得反向依赖 `apps/*`；禁止循环依赖和跨包深路径导入。

## Next.js 与 React 编码规范

- 使用 App Router、TypeScript 严格模式和函数组件。
- 默认使用 Server Component；只有浏览器 API、事件处理或客户端状态确有需要时才添加 `"use client"`。
- 页面负责组合，领域逻辑进入对应 workspace 包；复用代码通过包的公开入口导入。
- 为 props 与边界数据提供明确类型，避免 `any`、非必要类型断言和重复状态。
- 使用 Next.js Metadata API、`next/image` 与 `next/link` 处理相应能力。
- 保持语义 HTML、键盘操作、可见焦点与合理的 heading 层级。

## SCSS 和视觉实现规范

- 组件局部样式使用 `*.module.scss`；仅 reset、主题 token 与真正全局规则进入全局 SCSS。
- 不引入 Tailwind、CSS-in-JS 或完整 UI 组件库。
- 优先使用 CSS 自定义属性承载颜色、间距、字号与动效 token，避免散落魔法值。
- 响应式设计从窄屏开始，避免固定页面宽度与不必要的绝对定位。
- 动效必须服务于层级或反馈，并尊重 `prefers-reduced-motion`。
- 保持编辑感排版、克制色彩、清晰层级和充足留白。

## 内容、数据库、AI、RAG 的边界

- 内容源只进入 `content/posts` 与 `content/projects`；解析和校验只在 `@ting-lab/content`。
- 数据库访问只在 `@ting-lab/database`；其他包不得直接创建数据库连接。
- 模型 SDK、提示词和生成逻辑只在 `@ting-lab/ai`；不得从 UI 组件直接调用模型。
- 向量化、索引、检索与上下文编排只在 `@ting-lab/retrieval`；它通过公共 API 组合 content、database 与 ai。
- 密钥只通过环境变量注入，不写入源码、内容文件、日志或客户端 bundle。

## 必须执行的验证命令

提交仓库级变更前必须全部执行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

仅验证 Web 的 production build 时使用：

```bash
pnpm --filter @ting-lab/web build
```

本地开发命令为：

```bash
pnpm dev
```

## 禁止事项

- 禁止引入 Nx、Tailwind、CMS、Redis 或完整 UI 组件库。
- 禁止在没有明确需求时提前实现博客、数据库、AI 或 RAG 业务。
- 禁止跨 package 的 `src` 深路径导入、循环依赖和 `apps` 反向依赖。
- 禁止提交密钥、`.env`、生成目录、缓存或 `node_modules`。
- 禁止绕过 lint、类型检查或 production build 来交付变更。
- 禁止用客户端组件替代本可由 Server Component 完成的实现。
