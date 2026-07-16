# Ting Lab

Ting Lab 是一个基于 pnpm workspace、Turborepo 与 Next.js App Router 的个人技术博客。文章来自仓库内 MDX 文件，首页 AI 面板支持可选的服务端流式对话；未配置 AI 时静态博客仍可正常浏览。

## 项目结构

```text
apps/web/                    Next.js 页面、Chat Route 与交互 UI
packages/content/            MDX 读取、校验和内容查询
packages/ai/                 服务端 AI 配置、供应商、Prompt 与错误边界
packages/database/           数据持久化边界（当前未实现业务）
packages/retrieval/          RAG 编排边界（当前未实现业务）
packages/ui/                 轻量共享 UI 基础
content/posts/               MDX 文章源内容
```

## 启动

需要 Node.js 20+ 与 pnpm 9。

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Web 应用默认运行于 `http://localhost:3000`。`.env.local` 仅用于本地环境，不要提交真实 Key。

## AI 配置

共同配置：

```dotenv
AI_PROVIDER=openai
AI_MODEL=你的服务端模型名
AI_MAX_OUTPUT_TOKENS=1200
AI_REQUEST_TIMEOUT_MS=60000
```

三种 provider：

- `openai`：设置 `OPENAI_API_KEY`；需要代理时可选设置 `OPENAI_BASE_URL`。
- `openai-compatible`：设置 `OPENAI_COMPATIBLE_API_KEY`、`OPENAI_BASE_URL` 和兼容 Chat Completions 的模型名。
- `google`：设置 `GOOGLE_GENERATIVE_AI_API_KEY` 和 Gemini 模型名。

供应商、模型名、Base URL 和 Key 只在服务端读取。AI 未配置时，`/api/chat` 返回安全的 `AI_NOT_CONFIGURED` 错误，首页、文章和标签仍可使用。

内存限流默认使用匿名共享桶。仅当部署在会覆盖客户端 `x-forwarded-for` 的可信反向代理后方时，才设置 `TRUST_PROXY=true`。该方案仅适用于单实例，不支持分布式限流。

## 验证

```bash
pnpm format
pnpm format:check
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ting-lab/ai test
pnpm --filter @ting-lab/web build
```
