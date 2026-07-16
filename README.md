# Ting Lab

Ting Lab 是一个基于 pnpm workspace、Turborepo 和 Next.js App Router 的个人技术博客。文章以仓库内 MDX 为唯一事实来源；PostgreSQL + pgvector 仅保存可重建的检索索引，首页 AI 面板通过服务端 RAG 返回带可信博客来源的流式回答。

## 项目结构

```text
apps/web/                    Next.js 页面、Chat Route 与交互 UI
packages/content/            MDX 读取、校验和内容查询
packages/database/           Drizzle Schema、migration 和 pgvector 查询
packages/retrieval/          AST 分块、Embedding、增量索引与 RAG
packages/ai/                 Chat 模型配置、Provider 与安全错误边界
packages/ui/                 轻量共享 UI 基础
content/posts/               MDX 文章唯一内容源
compose.dev.yml              本地 PostgreSQL + pgvector
```

## 本地启动

需要 Node.js 20+、pnpm 9；启用知识库还需要 Docker Compose。

```powershell
pnpm install
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm db:up
pnpm db:migrate
pnpm db:check
pnpm content:index
pnpm dev
```

Web 默认运行于 `http://localhost:3000`。`.env.local` 仅供本地使用，禁止提交真实 Key、数据库密码或连接字符串。

## Chat 与 Embedding

Chat 和 Embedding 完全独立，可以使用不同供应商：

- Chat：`AI_PROVIDER=openai | openai-compatible | google`。
- Embedding：`EMBEDDING_PROVIDER=openai | openai-compatible`。
- OpenAI-compatible Embedding 必须使用合法 Base URL；可设置 `EMBEDDING_BASE_URL`，或复用服务端 `OPENAI_BASE_URL`。
- `EMBEDDING_API_KEY` 未设置时，会按 Embedding provider 安全复用对应服务端 Key。
- `EMBEDDING_DIMENSIONS` 固定为 `1536`；修改维度必须新增 migration。

没有数据库或 Embedding 配置时，静态博客仍能构建和浏览，Chat 会降级为通用回答，并明确显示本次未使用博客知识库。

## 数据库与索引

```bash
pnpm db:up                  # 启动本地 pgvector，不删除已有 volume
pnpm db:down                # 停止服务，不删除 volume
pnpm db:generate            # 根据 Schema 生成新 migration
pnpm db:migrate             # 应用已提交 migration
pnpm db:check               # 检查 PostgreSQL 与 pgvector
pnpm content:index          # 增量索引已发布 MDX
pnpm content:index -- --dry-run
pnpm content:search -- "Next.js 并发渲染是什么？"
```

索引通过文章内容、检索相关 Front Matter、分块算法版本及 Embedding 配置计算 checksum。内容未变化时跳过 Embedding；删除或取消发布的文章会从索引中清理。需要完整重建时，应先人工清理 `documents` 表，再运行 `pnpm content:index`；MDX 文件始终是可恢复索引的唯一来源。

Schema 变化必须通过 `pnpm db:generate` 生成并审查 migration，不使用 `drizzle-kit push` 代替部署 migration。

## 验证

```bash
pnpm format
pnpm format:check
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ting-lab/web build
```
