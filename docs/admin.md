# 单管理员后台

入口 `/admin/login`。文章/笔记来自 PostgreSQL，项目仍来自仓库。`CONTENT_SOURCE=file` 是默认离线演示模式，不开放后台写入；切换为 `database` 后，数据库故障不会回退旧文件。公开页面请求时读取，内容发布不需要重建镜像。

## 本地初始化

使用 Node.js 22.9+、pnpm 9 和 PostgreSQL/pgvector。复制 `apps/web/.env.example` 为未提交的 `.env.local`，配置本地数据库，执行 `pnpm db:up`、`pnpm db:migrate`。不要复用生产数据库。

生成秘密文件（不覆盖已有文件，不打印秘密）：

```bash
pnpm --filter @ting-lab/publishing exec tsx src/cli.ts secrets ../../.env.admin-secrets
```

将该文件中的三个字段安全复制到 `.env.local`，设置 `CONTENT_SOURCE=database`、`ADMIN_ORIGIN=http://localhost:3000`。主密钥是 Base64 编码的 32 个随机字节，会话密钥独立生成。秘密文件与数据库备份分别保管，不提交 Git。

通过终端安全环境注入 `ADMIN_PASSWORD`（至少 12 字符，不放命令参数或命令历史；也可临时放入权限受控且被 Git 忽略的本地 env 文件），执行 `pnpm admin:password`。完成后删除该环境值。初始化和重置使用同一命令；重置撤销所有旧会话。没有默认密码或公开注册。

```bash
pnpm content:import             # 默认 dry-run，报告 slug、checksum、冲突
pnpm content:import -- --apply  # 显式整批事务导入
pnpm dev
```

无效 Markdown/元数据阻止导入；同一批不会部分写入。相同 checksum 的未编辑导入项会跳过；后台保存过的内容报告冲突，不覆盖。中断后重新 dry-run，再 apply。导入草稿不会发布。`content:new` 仅供 file 模式使用。

## 编辑与发布

在“文章与笔记”新建草稿，填写元数据和 Markdown，保存后可进入受保护的草稿预览。精选必须选择 visual。首次发布后 slug 只读；正文和标题仍可编辑。

保存已发布文章的修改只更新 working revision，访客仍读 published revision。“发布”才原子切换公开版本并入队索引；有未保存修改时先保存。冲突时复制当前编辑再刷新，失败不会清空输入。离开未保存编辑有提醒。

取消发布和软删除立即从后续公开读取、搜索、RSS、sitemap、文章抽屉和 RAG 检索资格中排除；已打开页面和用户已下载内容无法收回。恢复只恢复为未发布内容。没有永久删除入口。

导出入口需要登录，返回包含所有修订的 MDX 与元数据 JSON；包含草稿和回收站内容，不包含管理员、会话或配置秘密。每个修订单独标识，working/published 不会混淆。完整灾难恢复仍使用 PostgreSQL 备份。

## 模型设置

`/admin/settings/ai` 的操作为保存草稿 → 可选主动测试 → 激活。激活在数据库事务内完成，界面处理期间显示进度；下一次请求读取新 profile，正在输出的请求保持开始时的配置。已激活 DB profile 完整覆盖 env；显式禁用不因 env 有 Key 而重新启用。移除数据库覆盖会恢复完整 env 配置，有确认提示。

Key 输入永不预填，明确区分保持和替换。切换供应商或 Base URL 必须提供新 Key；空字符串不代表删除。保存后清空输入。任何读接口只返回已配置/来源/更新时间，不返回明文或密文。

首次后台配置/发布会冻结解析后的 Embedding 独立配置（包含旧 env 的继承结果）。provider/model/baseURL/2048 维只读，后台只能换 Key。若初始没有 Embedding，配置完整服务器 env 后显式运行：

```bash
pnpm --filter @ting-lab/publishing exec tsx --env-file=../../apps/web/.env.local src/cli.ts freeze-embedding
pnpm content:index             # database 模式只把公开修订入队
pnpm worker
```

该初始化命令不会覆盖已冻结的向量空间。更换空间需要停 worker、备份、制定新 fingerprint 的全量重建与切换方案，首版没有网页按钮。

连接测试由管理员主动确认，可能产生少量费用；固定短文本、最多 16 输出 token、10 秒超时、每分钟至多 5 次，Embedding 不写索引。测试和真实调用都只允许 `AI_ALLOWED_HOSTS` 中的 HTTPS 主机、443 端口，拒绝 credentials、私网/回环/metadata 地址与重定向，在实际 DNS 连接时再次检查地址。兼容供应商需由运维把精确域名加入 env 列表，不支持网页绕过或本地 HTTP 模型。

## worker 与故障

Compose worker 非 root、自动重启，连接 internal backend 和具有最高 gw_priority 的 frontend。任务有 pending/running/succeeded/failed、最多 3 次尝试、5 分钟 lease、30 秒重试间隔；模型工作有 3 分钟总期限。崩溃后的过期 lease 可被另一 worker 接管。正文发布不等待 Embedding，索引失败不会回滚发布，列表显示状态并允许重试。

tools 镜像将 pnpm 预装到共享 `COREPACK_HOME=/opt/corepack`，非 root 用户使用同一缓存；运行时禁止 Corepack 下载，构建时以 `node` 用户在断网步骤验证版本。若旧镜像在 migrate 启动时提示下载 pnpm，更新 Dockerfile 后重新构建并重跑部署；不要为此给 migrate 开放公网或改为 root。

完成时持有文章锁并检查 lease token、revision 和 fingerprint。检索 SQL 在组装 prompt 前也做相同资格检查，旧向量尚未清理不影响撤稿边界。相同内容 checksum 和空间复用已有向量，不重复调用 Embedding。

登录采用全局持久限速（15 分钟 10 次），不信任客户端提供的代理 IP。CSRF 只信任固定 `ADMIN_ORIGIN`；反向代理 Host/Origin 配置必须与其一致。生产 Cookie 为 Secure，后台必须走 HTTPS。数据库断开时页面显示受控错误，搜索/RSS/API 返回 503，不显示连接串。

主密钥丢失后旧密文不能解密，需恢复单独备份的密钥；没有恢复备份则需要管理员重新输入所有 Key。不要覆盖密文来“修复”。轮换：停止 app/worker 写入并备份，安全注入旧 `CONFIG_*` 与新的 `NEXT_CONFIG_MASTER_KEY`/`NEXT_CONFIG_KEY_VERSION`，运行 `src/cli.ts rotate-master`；全批事务重加密成功后同步更新 app/worker env 并重启。保留旧库与旧密钥配对备份，验证后再按保留策略处置。Cookie 密钥轮换会使旧登录失效。

## 首次生产切换顺序

服务器同步最新代码后，只需修改根目录 `.env.production`，补齐 `CONTENT_SOURCE=database`、固定 HTTPS `ADMIN_ORIGIN`、独立会话密钥/主密钥及 `AI_ALLOWED_HOSTS`，核对 Chat/Embedding 配置。主密钥只生成一次，后续更新保留。然后执行：

```bash
bash scripts/deploy.sh --init
```

脚本自动执行生产预检 → 构建 → 启动数据库 → 备份 → migration → 文章导入 dry-run → apply → 初始化管理员 → 启动 app/worker/Caddy → HTTPS 健康检查。没有管理员时，终端提示输入两次后台密码（12–256 字符）；自动化环境可安全注入 `ADMIN_PASSWORD`，不要把密码写进命令参数。已有管理员不会重新设置密码或撤销会话。

备份在 `backups/before-admin-XXXXXXXX/`，包括数据库、仓库内容和 `.env.production`，使用私有权限创建。它包含秘密配置，应安全保管并另行备份主密钥。备份失败不会执行 migration；导入校验或冲突失败不会继续切换应用。中途失败修正后可重跑 `--init`，相同导入跳过，不覆盖后台编辑。显式 `--init` 即授权导入，不再额外逐条确认。

完成后访问 `/admin/login`，核对文章数、公开 slug、索引状态及模型配置。脚本不会生成/轮换主密钥，不清库、不恢复备份，也不自动回滚。

容器命令使用 `docker compose --env-file .env.production -f compose.prod.yml run --rm migrate` 应用迁移；工具命令用 `run --rm --entrypoint pnpm indexer --filter @ting-lab/publishing exec tsx src/cli.ts import`（加 `--apply` 才写入）。初始化密码通过 `--env ADMIN_PASSWORD` 转发已安全注入的环境值，不能把值写在参数中。

普通 `bash scripts/deploy.sh` 或 `pnpm deploy:prod` 只部署代码、迁移并监督 worker，不执行首次备份/导入/密码初始化；database 模式 indexer 不重复入队。新文章无需部署。禁止 `down -v`、清库或自动回滚。回退旧程序不等于数据回退；后台产生的新内容必须先备份/导出，不能直接切回 Git 文件宣称无损。

## 验证与备份

数据库全量备份包含文章、不可变修订、管理员、会话、配置密文及任务。主密钥另外安全备份；恢复后建议重置管理员密码撤销历史会话。先在**新建隔离数据库**恢复，不覆盖生产库，核对文章/修订数量与 checksum、配置解密和公开修订，再由运维制定正式恢复窗口。

`pnpm test` 不连接真实模型；设置本机 `TEST_DATABASE_URL` 且数据库名以 `_test` 结尾才能执行 publishing 集成测试。后台 E2E 读取未提交 `.env.round11-test`，需初始化隔离库和随机管理员后运行 `pnpm test:admin`。该流程关闭 trace，避免密码和 Key 请求体进入测试录制；只保存提交后脱敏页面截图。模型 UI 测试拦截连接测试接口，SDK 层使用 fake model，均不访问真实供应商。
