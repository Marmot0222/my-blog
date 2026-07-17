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
compose.prod.yml             VPS 完整生产栈（Web、pgvector、Caddy）
deploy/Caddyfile             自动 HTTPS 与流式反向代理
scripts/                     生产预检、部署与数据库备份
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
- `EMBEDDING_DIMENSIONS` 固定为 `2048`；使用 `halfvec` 保留 HNSW 索引，修改维度必须新增 migration。

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

向量维度 migration 只清理 PostgreSQL 中可由 MDX 重建的 `documents`/`document_chunks` 检索索引，不会修改 `content/posts`；同一次生产部署必须继续执行 indexer 完成重建。当前 schema 使用 `halfvec(2048)`，以兼容方舟原生 2048 维输出和 pgvector 的 HNSW 维度限制。

## VPS 生产部署

推荐 Ubuntu 24.04 LTS 或 Debian 12、至少 2 vCPU / 2 GB 内存（构建阶段建议 4 GB 或配置 swap），并安装 [Docker Engine 与 Compose v2](https://docs.docker.com/engine/install/)。`compose.dev.yml` 只启动本地依赖；`compose.prod.yml` 才是包含 Web、pgvector 与 Caddy 的完整生产栈。

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

部署脚本会严格预检配置，构建锁定依赖的镜像，等待数据库健康，依次执行 migration 和增量索引，再启动应用与 Caddy 并通过公网 HTTPS 健康检查。必须显式使用 `SKIP_CONTENT_INDEX=1` 才会跳过索引；正常重复部署不会删除 volume，checksum 未变化的内容不会重复生成 embedding。Caddy 会自动申请并续期证书，其 data/config 保存在命名 volume。

常用运维命令均显式读取生产 env：

```bash
docker compose --env-file .env.production -f compose.prod.yml ps
docker compose --env-file .env.production -f compose.prod.yml logs -f --tail=200 app caddy
./scripts/deploy.sh                       # 拉取代码后重复部署
docker compose --env-file .env.production -f compose.prod.yml stop
./scripts/backup-db.sh                    # 写入 ./backups，默认保留最近 7 份
BACKUP_RETENTION=14 ./scripts/backup-db.sh
```

证书签发失败时，先检查 DNS 是否已传播、A/AAAA 是否都能从公网到达、80/443 是否开放，以及 Caddy 日志。不要删除 `caddy_data` 来“重试”，这会丢失证书状态并可能触发 CA 频率限制。

### 数据库恢复（人工确认）

恢复会覆盖目标数据，必须先停止写入、确认目标 Compose 项目与数据库名，并先运行 `./scripts/backup-db.sh` 保存当前状态。确认无误后，再由运维人员执行类似命令：

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
```
