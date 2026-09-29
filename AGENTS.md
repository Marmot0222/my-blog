# Ting Lab 协作指南

## 项目定位与视觉方向

Ting Lab 是一个用于沉淀文章、项目与实验性数字产品的个人实验室。视觉上保持安静、克制、编辑感与内容优先：使用清晰排版、充足留白、温和中性色和少量有意图的动效，避免模板化的 SaaS 观感与装饰堆叠。

## Monorepo 目录职责

- `apps/web`：唯一的 Next.js App Router Web 应用与页面组合层。
- `packages/*`：可复用领域能力、共享 UI 与工具配置；不得放页面路由。
- `content/posts`：file 模式文章源、首次导入与开发 fixture；database 模式文章唯一权威源是 PostgreSQL。
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
- `@ting-lab/publishing`：服务端异步内容适配、发布配置、秘密生命周期、持久任务 worker 与管理 CLI；组合 content/database/ai/retrieval，不依赖 web。
- `@ting-lab/typescript-config`：共享 TypeScript 严格模式配置。
- `@ting-lab/eslint-config`：共享 ESLint flat config。

## 允许的依赖方向

- `apps/web` 可以依赖所有业务包与 `@ting-lab/ui`，负责最终组合。
- `@ting-lab/retrieval` 可以依赖 `@ting-lab/content`、`@ting-lab/database`、`@ting-lab/ai`。
- `@ting-lab/publishing` 可以依赖 content/database/ai/retrieval；这些包不得反向依赖 publishing。
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
- 按需维护 shadcn/ui Radix 源码的 SCSS Modules 适配版，保留 `packages/ui/LICENSE.shadcn.md`、`UPSTREAM.md` 来源和版本；不用官方 CLI 覆盖本地适配，不混用 Base UI。
- 优先使用 CSS 自定义属性承载颜色、间距、字号与动效 token，避免散落魔法值。
- 响应式设计从窄屏开始，避免固定页面宽度与不必要的绝对定位。
- 动效必须服务于层级或反馈，并尊重 `prefers-reduced-motion`。
- 保持编辑感排版、克制色彩、清晰层级和充足留白。

## 内容、数据库、AI、RAG 的边界

- `CONTENT_SOURCE=file|database` 显式选择文章源，默认 file 演示且禁用后台写入；database 故障禁止回退仓库文件。项目继续只从 `content/projects` 读取，解析和校验属于 content。
- `content/projects` 是项目唯一事实来源。项目 Front Matter 使用严格 Schema 校验 `slug`、状态、顺序、年月/日期、技术栈、可选 HTTP(S) URL 与发布状态；未知字段、重复 slug/技术项均失败。`published: false` 不得进入公开列表、详情静态参数、搜索或 sitemap。
- 项目只通过 `ContentRepository` 的 `getPublishedProjects`、`getFeaturedProjects`、`getProjectBySlug`、`getAllProjectSlugs` 等公共 API 读取；排序依次为 featured、order、updatedAt、slug。Web 禁止直接扫描 `content/projects` 或跨包导入读取器。
- `/projects`、`/projects/[slug]`、`/about` 均为 Server Component。项目业务组件位于 `apps/web/src/components/projects`，路由样式就近放置；项目正文复用 `compileMdxContent`，禁止创建第二套 MDX 解析与高亮流程。
- 公开项目进入本地搜索与 sitemap，并在搜索结果中标识为“项目”；RSS 默认仍只包含文章。
- 数据库访问只在 `@ting-lab/database`；其他包不得直接创建数据库连接。
- 模型 SDK、提示词和生成逻辑只在 `@ting-lab/ai`；不得从 UI 组件直接调用模型。
- 模型 SDK 只能出现在 `@ting-lab/ai` 与服务端 Route Handler 中；Key、模型名、Base URL 和供应商选择不得进入客户端。
- AI 配置只能在真实请求或显式配置检查时解析；AI 未配置不能阻塞静态博客构建与阅读。
- AI 测试必须使用配置 fixture、fake model 或自有边界，不得访问真实模型 API。
- 向量化、索引、检索与上下文编排只在 `@ting-lab/retrieval`；它通过公共 API 组合 content、database 与 ai。
- database 模式中 articles/article_revisions 是文章权威数据；管理员、会话、配置和发布任务同样必须备份。只有 documents/document_chunks 是派生索引。
- 公开文章统一通过 `getContentRepository` 异步请求快照读取：首页、详情、标签、搜索、RSS、sitemap、SEO 和 AI 抽屉均须使用公开修订。禁止永久内存索引、构建期数据库连接和旧页面缓存导致撤稿泄露。
- 保存草稿仅创建 working revision；发布原子切换 published revision 并入队。稳定 UUID、唯一安全 slug、乐观锁和发布后 slug 只读不可绕过；软删除恢复不能自动发布。
- 正文与管理员预览共用安全 Markdown 校验及 format:md 编译，不执行 HTML、JSX、MDX 导入或表达式。禁止服务器任意抓取远端图片。
- 所有后台页面、API、预览、导出、索引重试和配置入口均服务端鉴权。写 API 必须验证固定 ADMIN_ORIGIN、JSON schema 和请求体上限；后台 no-store/noindex；禁止用隐藏菜单代替授权。
- iron-session Cookie 必须 HttpOnly/SameSite、生产 Secure，并查数据库撤销与过期状态。密码只通过安全环境注入 CLI，使用 scrypt；重置撤销旧会话。不得增加默认密码或公开注册。
- Chat 已激活完整 DB profile 优先于完整 env，不逐字段混用、不在 DB 故障时回退。Embedding 空间首次冻结，后台只允许独立 Key 替换。API Key 用 AES-256-GCM 存储，主密钥与会话密钥分离；任何读接口、props、日志和内容导出不得包含明文或密文。
- 连接测试和真实模型调用共用 HTTPS 主机批准列表、连接时 DNS 公网地址检查和禁止重定向的出站边界。AI 浏览器错误只从 `@ting-lab/ai/errors` 公共入口导入，禁止导入服务端网络能力。
- 发布任务采用 PostgreSQL outbox/lease/有限重试，worker 受 Compose 监督。旧 lease、旧公开 revision 和不同 embedding fingerprint 不能覆盖当前索引。送入模型的片段必须先校验当前公开 revision 与 fingerprint。
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
- `apps/web/src/lib/search.ts` 从请求级内容快照创建本地全文索引；`GET /api/search?q=` 不调用 Embedding/RAG，不返回内部全文字段，响应 no-store，源不可用返回受控 503。
- 搜索弹层位于 `apps/web/src/components/search`，Header 的客户端交互位于 `components/navigation`。必须保留 200ms debounce、AbortController、旧请求保护、焦点圈定/归还、Escape、方向键与 Enter 操作；高亮必须输出 React 文本节点，禁止 `dangerouslySetInnerHTML`。
- 主题只允许 `light`/`dark`/`system`；默认 system。`apps/web/src/lib/theme.ts` 是存储 Key、解析与首屏初始化脚本的单一来源。初始化脚本必须在 hydration 前设置 `<html data-theme>` 和 `color-scheme`；仅 system 状态监听媒体查询。
- 所有核心表面和文本颜色使用 `apps/web/src/styles/tokens.scss` 的语义 Token。Shiki 同时生成 light/dark 变量；不得用反色滤镜破坏代码语义色。
- `apps/web/src/lib/site.ts` 是名称、作者、origin 与 URL 归一化的单一来源；无部署 env 时回退本地地址，生产预检继续要求 `NEXT_PUBLIC_SITE_URL=https://DOMAIN`。
- canonical、robots、sitemap、RSS、OG、manifest 与 JSON-LD 只能由上述站点配置和公开内容生成。`/ai?post=` canonical 固定为 `/ai`；API 不索引；JSON-LD 必须使用 `serializeJsonLd` 防止 script 闭合。
- E2E 使用根目录 `playwright.config.ts` 与 `e2e/`；fake AI 只能通过浏览器路由拦截提供 UI Message Stream，不得增加生产测试后门或访问真实 AI/数据库。
- `compose.prod.yml` 要求 Docker Compose 2.33.1+。app/indexer 同时连接 backend/frontend 时，frontend 必须保持最高 `gw_priority` 作为确定性公网出口；backend 保持 internal，db/migrate 不获得公网入口。所有服务保留 json-file 日志轮转。

## 内容创作与阅读闭环

- `pnpm content:new -- --kind article|note --slug <slug> --title <title>` 调用 content 包 CLI，固定写 `content/posts`，默认草稿，独占写入禁止覆盖；Windows 保留文件名也拒绝。复用 Front Matter schema 与 YAML 序列化。
- `ContentRepository.queryPosts` 负责公开内容组合筛选与分页，每页 5 篇，日期倒序、slug 升序。`/posts?kind=note&tag=react&page=2` 使用标签 slug；非法 kind 回全部，未知标签空结果，无效页码回 1，超界夹到末页。GET 表单切换条件重置分页；重复参数取首值。
- 带查询参数的归档 noindex/follow，canonical 固定 `/posts`，sitemap 不列组合 URL；保留 `/tags`。
- `getRelatedPosts` 共同标签每项 2 分、同分类 1 分，日期/slug 打破同分，排除自身、草稿、重复和零分，最多 3 篇。
- 只有 `NODE_ENV=development` 且 `CONTENT_PREVIEW=1` 开放 `/preview/posts/[slug]`，复用 MDX 编译与目录。生产始终 404，不修改公开读取边界；静态参数、搜索、RSS、sitemap、RAG 不包含草稿。
- `packages/content/src/workflow.test.ts` 用临时目录测试 CLI/查询；Web 预览边界测试及 `e2e/content-workflow.spec.ts` 覆盖生产隔离、URL 恢复、阅读流程。完整发布操作见 `docs/content-workflow.md`。

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

首次启用后台使用 `bash scripts/deploy.sh --init`，显式执行独立备份、migration、导入 dry-run/apply 和仅缺失时的管理员初始化。普通部署不得自动导入或重置密码。初始化重跑保留已有凭据与会话，导入冲突停止；回归使用 `bash scripts/deploy.test.sh` 的隔离 mock，不访问生产。

## 禁止事项

- 禁止引入 Nx、Tailwind、CMS、Redis 或完整 UI 组件库。
- 禁止在没有明确需求时提前实现博客、数据库、AI 或 RAG 业务。
- 禁止跨 package 的 `src` 深路径导入、循环依赖和 `apps` 反向依赖。
- 禁止提交密钥、`.env`、生成目录、缓存或 `node_modules`。
- 禁止把向量表充当文章主表、每次索引清空全库、部署自动覆盖后台编辑，或把模型生成的链接显示为博客来源。
- 禁止绕过 lint、类型检查或 production build 来交付变更。
- 禁止用客户端组件替代本可由 Server Component 完成的实现。
- 禁止在 AI 对话渲染层按相邻消息、文本或索引粗暴去重来掩盖协议错误；必须修复消息产生根因。
- 禁止在首页 compact 面板与 `/ai` 工作区之间复制聊天协议与状态逻辑；必须复用共享聊天内核。
- 禁止在部署脚本中执行 `down -v`、清库、自动回滚、全局镜像清理或无确认的生产恢复。
- 禁止将数据库端口发布到公网、把 secret 写入 Docker build args/镜像层，或在日志中输出密钥与连接密码。
