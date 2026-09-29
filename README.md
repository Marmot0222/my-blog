# Ting Lab

Ting Lab 是一个基于 pnpm workspace、Turborepo 和 Next.js App Router 的个人实验室。`CONTENT_SOURCE=database` 时 PostgreSQL 是文章/笔记的唯一权威源，提供单管理员编辑发布与模型配置；`file` 保留离线 MDX 演示。项目继续从仓库读取。AI 通过服务端 RAG 返回可信文章来源。

## 项目结构

```text
apps/web/                    Next.js 页面、Chat Route 与交互 UI
packages/content/            MDX 读取、校验和内容查询
packages/database/           Drizzle Schema、migration 和 pgvector 查询
packages/retrieval/          AST 分块、Embedding、增量索引与 RAG
packages/ai/                 Chat 模型配置、Provider 与安全错误边界
packages/ui/                 轻量共享 UI 基础
packages/publishing/         异步文章适配、配置服务、发布任务与管理 CLI
content/posts/               file 模式文章源、首次导入与 fixture
content/projects/            MDX 项目作品唯一内容源
compose.dev.yml              本地 PostgreSQL + pgvector
compose.prod.yml             VPS 完整生产栈（Web、pgvector、Caddy）
deploy/Caddyfile             自动 HTTPS 与流式反向代理
scripts/                     生产预检、部署与数据库备份
```

## 本地启动

需要 Node.js 22.9+、pnpm 9；启用后台或知识库还需要 PostgreSQL/pgvector，可使用 Docker Compose。仅浏览演示可直接 `pnpm install`、`pnpm dev`，不需要数据库或模型。

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

页面支持浅色、深色和跟随系统三种主题；点击 Header 主题按钮切换。站内搜索可点击放大镜打开，也可在非输入区域按 `Ctrl/Cmd+K` 或 `/` 打开。RSS 地址为 `/feed.xml`。

`/projects` 展示经过校验和确定性排序的公开项目，`/projects/[slug]` 提供可分享的项目案例正文；`/about` 说明作者的技术方向、工作方式和公开联系入口。项目也会进入站内搜索与 sitemap，但不会进入文章 RSS。

新增项目时，在 `content/projects` 创建 MDX 文件，填写严格 Front Matter 和项目叙事；没有可靠公开地址时不要填写 `repository` 或 `demo`。完整字段、排序与公开边界见 [`docs/content-projects.md`](docs/content-projects.md)，完成后运行 `pnpm content:check`。

## 内容创作与阅读

database 模式访问 `/admin/login`，在后台新建草稿、预览、发布、撤稿和恢复；保存草稿不改变线上版本。初始化、首次导入、主密钥和运维步骤见 [后台指南](docs/admin.md)。项目不由后台管理。

file 模式使用 `pnpm content:new -- --kind article --slug my-first-post --title "我的第一篇文章"` 创建草稿，短笔记使用 `--kind note`。显式设置 `CONTENT_PREVIEW=1` 后 `pnpm dev`，访问 `/preview/posts/<slug>`；该旧开发入口在生产始终 404，管理员预览另有鉴权。

`/posts` 支持文章/笔记、标签筛选与每页 5 篇的 URL 分页，详情提供最多 3 篇相关阅读。创建、校验、发布、取消发布和索引失败处理见 [内容工作流](docs/content-workflow.md)，后续范围见 [产品路线](docs/product-roadmap.md)。

## Chat 与 Embedding

Chat 和 Embedding 完全独立，可以使用不同供应商：

- Chat：`AI_PROVIDER=openai | openai-compatible | google`。
- Embedding：`EMBEDDING_PROVIDER=openai | openai-compatible`。
- OpenAI-compatible Embedding 必须使用合法 Base URL；可设置 `EMBEDDING_BASE_URL`，或复用服务端 `OPENAI_BASE_URL`。
- `EMBEDDING_API_KEY` 未设置时，会按 Embedding provider 安全复用对应服务端 Key。
- `EMBEDDING_DIMENSIONS` 固定为 `2048`；使用 `halfvec` 保留 HNSW 索引，修改维度必须新增 migration。

file 模式没有数据库也能构建和阅读；database 模式构建不连接数据库，但运行时文章读取依赖数据库，故障不回退文件。Embedding 不可用时 Chat 可降级，明确显示未使用知识库。Chat 激活配置完整覆盖 env；Embedding 首次冻结，后台只能替换独立 Key，详见后台指南。

AI 对话有两个入口，共享同一会话：首页右侧可收起的 AI 侧栏，以及导航中“AI 问答”指向的 `/ai` 全页面工作区。一次提问只产生一条助手回答；RAG 命中的关联文章会作为来源展示，点击后在 `/ai` 右侧抽屉打开正文（复用文章渲染），不离开对话。架构与流协议约束见 `AGENTS.md` 与 `docs/ai-chat.md`。

## 数据库与索引

```bash
pnpm db:up                  # 启动本地 pgvector，不删除已有 volume
pnpm db:down                # 停止服务，不删除 volume
pnpm db:generate            # 根据 Schema 生成新 migration
pnpm db:migrate             # 应用已提交 migration
pnpm db:check               # 检查 PostgreSQL 与 pgvector
pnpm content:index          # file: 增量索引；database: 公开修订入队
pnpm content:index -- --dry-run
pnpm content:search -- "Next.js 并发渲染是什么？"
```

索引通过内容、检索元数据、分块算法和 Embedding 配置计算 checksum，未变化时跳过 Embedding。database 模式发布在事务中入队，worker 按 revision/fingerprint 写入；撤稿即时失去检索资格，随后清理索引。仅 `documents`/`document_chunks` 可重建，文章、修订和配置不可当作缓存删除。不要为了重试清库。

Schema 变化必须通过 `pnpm db:generate` 生成并审查 migration，不使用 `drizzle-kit push` 代替部署 migration。

旧向量维度 migration 仅涉及派生索引。新增业务 migration `0004_publishing.sql` 建立独立文章/修订/会话/配置/outbox 表，不覆盖现有文章文件。当前向量仍为 `halfvec(2048)`，更换模型空间必须受控重建，不能直接复用同维旧索引。

## VPS 生产部署

推荐 Ubuntu 24.04 LTS 或 Debian 12、至少 2 vCPU / 2 GB 内存（构建阶段建议 4 GB 或配置 swap），并安装 [Docker Engine](https://docs.docker.com/engine/install/) 与 **Docker Compose 2.33.1 或更高版本**。生产配置使用 `gw_priority` 明确 app/indexer 的公网默认出口，旧版 Compose 无法正确解析该契约。`compose.dev.yml` 只启动本地依赖；`compose.prod.yml` 才是包含 Web、pgvector 与 Caddy 的完整生产栈。

部署前先完成以下外部准备：

1. 将域名 A 记录指向 VPS；只有 IPv6 可达时才添加 AAAA 记录。
2. 在云防火墙和主机防火墙开放 TCP 80/443，并为 HTTP/3 开放 UDP 443。
3. 确保宿主机没有其他服务占用 80/443。使用外部反向代理时，应移除或覆盖 `caddy` 服务及端口映射，并由外部代理转发到受保护的应用网络；不要同时启动两个入口代理。

最短上线路径：

```bash
git clone https://github.com/Marmot0222/my-blog.git ting-lab
cd ting-lab
cp .env.production.example .env.production
# 编辑 .env.production，填入域名、强数据库密码及真实 Chat/Embedding 配置
./scripts/deploy.sh
```

首次上线必须先完成 [后台指南的切换步骤](docs/admin.md#首次生产切换顺序)：备份、migration、导入 dry-run/apply、核对、初始化管理员和主密钥，再启用 database 模式与 worker。`deploy:prod` 不代替首次初始化。普通部署预检、构建、迁移并启动 app/worker/Caddy；database 模式不自动导入、不覆盖后台文章、不重复入队。file 模式保留增量 indexer 与显式 `SKIP_CONTENT_INDEX`。Caddy 证书仍保存在命名 volume。

常用运维命令均显式读取生产 env：

```bash
docker compose --env-file .env.production -f compose.prod.yml ps
docker compose --env-file .env.production -f compose.prod.yml logs -f --tail=200 app caddy
./scripts/deploy.sh                       # 拉取代码后重复部署
docker compose --env-file .env.production -f compose.prod.yml stop
./scripts/backup-db.sh                    # 写入 ./backups，默认保留最近 7 份
BACKUP_RETENTION=14 ./scripts/backup-db.sh
./scripts/network-smoke-check.sh .env.production # 验证 db 与外部 Provider DNS，不调用 API
```

证书签发失败时，先检查 DNS 是否已传播、A/AAAA 是否都能从公网到达、80/443 是否开放，以及 Caddy 日志。不要删除 `caddy_data` 来“重试”，这会丢失证书状态并可能触发 CA 频率限制。

### 数据库恢复（人工确认）

数据库现包含不可由 Git 重建的文章、修订、管理员和配置密文。主密钥必须单独备份。先在新建隔离数据库演练恢复并核对公开修订/checksum；正式恢复前停止 app/worker 写入，确认目标并保存当前备份，再由运维执行恢复。不要直接向正在服务的数据库导入：

```bash
gunzip -c backups/ting-lab-YYYYMMDDTHHMMSSZ.sql.gz | \
  docker compose --env-file .env.production -f compose.prod.yml exec -T db \
  psql --username ting_lab --dbname ting_lab --single-transaction
```

用户名和数据库名应替换为 `.env.production` 的实际非敏感标识。仓库刻意不提供自动清库或一键覆盖式恢复脚本。

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
pnpm test:e2e
```
