# Ting Lab 协作指南

## 项目定位与视觉方向

Ting Lab 是一个用于沉淀文章、项目与实验性数字产品的个人实验室。视觉上保持安静、克制、编辑感与内容优先：使用清晰排版、充足留白、温和中性色和少量有意图的动效，避免模板化的 SaaS 观感与装饰堆叠。

## Monorepo 目录职责

- `apps/web`：唯一的 Next.js App Router Web 应用与页面组合层。
- `packages/*`：可复用领域能力、共享 UI 与工具配置；不得放页面路由。
- `content/posts`：文章源文件目录。
- `content/projects`：项目源文件目录。
- 根目录：workspace、Turborepo、统一命令和仓库级文档。
- `compose.prod.yml` 与 `deploy/`：VPS 生产服务编排、HTTPS 和反向代理配置。
- `scripts/`：生产环境预检、幂等部署与宿主机数据库备份入口。

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
- 模型 SDK 只能出现在 `@ting-lab/ai` 与服务端 Route Handler 中；Key、模型名、Base URL 和供应商选择不得进入客户端。
- AI 配置只能在真实请求或显式配置检查时解析；AI 未配置不能阻塞静态博客构建与阅读。
- AI 测试必须使用配置 fixture、fake model 或自有边界，不得访问真实模型 API。
- 向量化、索引、检索与上下文编排只在 `@ting-lab/retrieval`；它通过公共 API 组合 content、database 与 ai。
- MDX 是文章唯一事实来源；PostgreSQL 中的文档和分块仅是可删除、可重建的检索索引。
- 数据库 Schema 变化必须创建并提交 SQL migration，不允许用 `drizzle-kit push` 代替 migration。
- Embedding 列固定为 `halfvec(2048)`；改变维度或存储类型必须新增 migration，不能在运行时改变列定义。
- 内容索引必须增量、幂等；checksum 未变化时禁止重复调用 Embedding。
- RAG 来源只能由服务器检索结果生成；不得信任模型或客户端提供的来源 URL。
- 数据库与 RAG 测试不得连接生产数据库，模型测试不得访问真实模型 API。
- 密钥只通过环境变量注入，不写入源码、内容文件、日志或客户端 bundle。

## AI 对话体验与 UI Message Stream 协议

AI 对话有两个入口，必须复用同一聊天内核，不得在首页与 `/ai` 之间复制逻辑：

- 首页可收起 compact 侧栏：`apps/web/src/components/home/AiPanel.tsx`。
- 全页面工作区 `/ai`：`apps/web/src/app/ai/page.tsx` + `apps/web/src/components/ai/AiWorkspace.tsx`。导航中“AI 问答”统一指向 `/ai`。
- 共享聊天状态在 `apps/web/src/components/ai/chat-provider.tsx`（root layout 持有唯一 `Chat` 实例），`AiChat` 通过 `useChat({ chat })` 复用。展示模式 `compact`/`workspace` 只控制布局，不参与协议与状态管理。

UI Message Stream 协议不变量（实现于 `apps/web/src/lib/chat/stream.ts`，由 `apps/web/src/app/api/chat/route.ts` 的 `POST` 调用；详见 `docs/ai-chat.md`）：

- 一次提交 = 一次 `POST /api/chat` = 一次 RAG 检索 = 一次模型生成 = 至多一条 assistant message。RAG `data-ragStatus`/`data-sources`/`source-url` 与正文 `text-*` 归属同一条消息。
- 合并 `streamText` token 流时必须使用 `result.toUIMessageStream({ sendStart: false })`，避免模型流再次发出 message-start 导致“回答两次”（根因：客户端 `replaceMessage` 的 `structuredClone` 破坏引用 + 服务端 start 覆盖 message id，触发第二条空 assistant 消息）。
- 禁止在渲染层按相邻消息、文本或索引粗暴去重来掩盖协议错误；必须修复根因。
- `route.ts` 是 Next.js Route Handler，只允许导出 HTTP 方法与路由配置字段（`runtime`/`dynamic` 等）；协议函数与类型（`buildChatStream`/`handleChatRequest`/`ChatStreamDeps`）必须放在 `lib/chat/stream.ts`，否则构建期类型校验失败。
- 协议层有回归测试：`apps/web/src/app/api/chat/route.test.ts`（用真实 `Chat` + `MockLanguageModelV3` 驱动 `buildChatStream`，断言单一 assistant message）。

文章抽屉：来源点击在 `/ai` 右侧抽屉打开，不离开对话。`/ai` Server Component 用 `contentRepository.getPostBySlug` 校验已发布文章后 `compilePostMdx` 编译，把 MDX ReactNode 传入客户端抽屉，复用文章详情渲染，不建第二套解析器。只允许读取已发布文章；slug 经 `isSafeSlug` 校验；客户端不能提交任意路径/外部 URL。打开/关闭抽屉通过 searchParams 变化触发服务端重渲染，`AiChat` 不加 key 保持挂载，因此不重置聊天、不重新请求模型。首页 compact 来源点击统一跳转 `/ai?post=<slug>`。

生产环境使用 Caddy 流式代理 `/api/chat`；变更不得启用响应缓冲，流式回答必须逐步输出。

## 搜索、主题与站点发现

- 公开搜索文档、确定性评分与安全摘要属于 `@ting-lab/content`；搜索采用规范化后的 AND 语义，标题、标签、分类、描述、正文依次降权，稳定同分排序。只允许已发布内容进入索引。
- `apps/web/src/lib/search.ts` 在服务端模块初始化时创建只读本地索引；`GET /api/search?q=` 只负责校验和序列化，不接数据库、Embedding 或 RAG，也不得返回内部全文字段。
- 搜索弹层位于 `apps/web/src/components/search`，Header 的客户端交互位于 `components/navigation`。必须保留 200ms debounce、AbortController、旧请求保护、焦点圈定/归还、Escape、方向键与 Enter 操作；高亮必须输出 React 文本节点，禁止 `dangerouslySetInnerHTML`。
- 主题只允许 `light`/`dark`/`system`；默认 system。`apps/web/src/lib/theme.ts` 是存储 Key、解析与首屏初始化脚本的单一来源。初始化脚本必须在 hydration 前设置 `<html data-theme>` 和 `color-scheme`；仅 system 状态监听媒体查询。
- 所有核心表面和文本颜色使用 `apps/web/src/styles/tokens.scss` 的语义 Token。Shiki 同时生成 light/dark 变量；不得用反色滤镜破坏代码语义色。
- `apps/web/src/lib/site.ts` 是名称、作者、origin 与 URL 归一化的单一来源；无部署 env 时回退本地地址，生产预检继续要求 `NEXT_PUBLIC_SITE_URL=https://DOMAIN`。
- canonical、robots、sitemap、RSS、OG、manifest 与 JSON-LD 只能由上述站点配置和公开内容生成。`/ai?post=` canonical 固定为 `/ai`；API 不索引；JSON-LD 必须使用 `serializeJsonLd` 防止 script 闭合。
- E2E 使用根目录 `playwright.config.ts` 与 `e2e/`；fake AI 只能通过浏览器路由拦截提供 UI Message Stream，不得增加生产测试后门或访问真实 AI/数据库。
- `compose.prod.yml` 要求 Docker Compose 2.33.1+。app/indexer 同时连接 backend/frontend 时，frontend 必须保持最高 `gw_priority` 作为确定性公网出口；backend 保持 internal，db/migrate 不获得公网入口。所有服务保留 json-file 日志轮转。

## 必须执行的验证命令

提交仓库级变更前必须全部执行：

```bash
pnpm format
pnpm format:check
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

数据库与索引相关命令：

```bash
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm content:index
pnpm content:index -- --dry-run
pnpm content:search -- "查询"
```

仅验证 Web 的 production build 时使用：

```bash
pnpm --filter @ting-lab/web build
```

本地开发命令为：

```bash
pnpm dev
```

生产配置静态校验和标准部署入口为：

```bash
bash scripts/validate-production-env.sh .env.production.example --check-config-only
docker compose --env-file .env.production.example -f compose.prod.yml config
bash scripts/network-smoke-check.sh .env.production.example
pnpm deploy:prod
```

`pnpm deploy:prod` 与 `./scripts/deploy.sh` 等价。真实部署必须使用未提交的 `.env.production`；禁止把示例占位符用于上线。

## 禁止事项

- 禁止引入 Nx、Tailwind、CMS、Redis 或完整 UI 组件库。
- 禁止在没有明确需求时提前实现博客、数据库、AI 或 RAG 业务。
- 禁止跨 package 的 `src` 深路径导入、循环依赖和 `apps` 反向依赖。
- 禁止提交密钥、`.env`、生成目录、缓存或 `node_modules`。
- 禁止把数据库改成文章主数据源、每次索引清空全库，或把模型生成的链接显示为博客来源。
- 禁止绕过 lint、类型检查或 production build 来交付变更。
- 禁止用客户端组件替代本可由 Server Component 完成的实现。
- 禁止在 AI 对话渲染层按相邻消息、文本或索引粗暴去重来掩盖协议错误；必须修复消息产生根因。
- 禁止在首页 compact 面板与 `/ai` 工作区之间复制聊天协议与状态逻辑；必须复用共享聊天内核。
- 禁止在部署脚本中执行 `down -v`、清库、自动回滚、全局镜像清理或无确认的生产恢复。
- 禁止将数据库端口发布到公网、把 secret 写入 Docker build args/镜像层，或在日志中输出密钥与连接密码。
