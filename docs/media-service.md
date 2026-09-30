# 独立数据库媒体服务

`apps/media` 是内部 Node HTTP 服务，`packages/media` 处理图片标准化和服务端传输，所有 SQL 位于 `packages/database`。媒体使用独立 PostgreSQL database/login；`media_assets` 保存元信息，`media_binary.data` 使用 bytea，管理分页不读取二进制。服务不接收管理员 Cookie 或会话密钥。

浏览器只访问同源 `/api/admin/media` 和 `/media/<uuid>`。博客校验会话、固定 Origin、大小和频率，再以服务端凭据及固定 `ting-lab/admin` 身份调用媒体服务。服务端凭据不会放入 Markdown 或页面 props。没有公开上传、远程抓图或 URL 覆盖接口。

## 一致性与删除

保存之前由 Markdown AST 提取 inline/reference 图片，调用 `POST /references` 验证归属及存在性，并以正文 checksum 创建幂等、单调增加的保护记录。媒体行锁让关联与删除互斥。随后博客事务写入 revision 及 `article_media_references`，发布事务仍原子切换 published revision。

这不是跨库事务：准备成功但文章事务失败会留下保守的 pin。重试不会重复 pin；这个状态不使图片公开，也不会回收图片。第一版有 pin 的图片不能通过 UI 物理删除，即使该 pin 来自一次失败保存。运维只可在停止相关写入、核对全部修订后人工处理；不要自动释放 pin。

匿名图片读取每次查询博客当前公开引用，只有至少一篇未删除文章的 published revision 引用该图片才允许返回二进制。媒体服务本身不开放匿名读取。因此撤稿不等待异步消息，无旧事件回写问题，不依赖 AI outbox 成功。工作及历史修订保留删除保护，不带来公开权限。数据库/媒体故障关闭访问。

上传成功但插入失败会留下带 upload_session 的未关联资源，媒体库显示“未关联上传”，允许确认后手动删除；取消编辑仅取消浏览器请求，不自动删除已上传图片。删除仍检查所有修订及服务端 pin，避免和其他操作竞争。第一版无自动清理任务。

公开响应是 `max-age=0, must-revalidate`，先检查当前引用再处理 ETag/304。私有响应 no-store。已发送给浏览器、截图或下载的图片无法远程收回，正在进行中的已授权响应可能完成。

## 接口与限制

内部接口：`POST/GET /assets`、`GET/DELETE /assets/:id`、`GET /assets/:id/bytes`、`GET /assets/:id/references`、`POST /references`。所有业务接口验证 Bearer token、app 和 owner；`GET /health` 只检查数据库表可用。

默认单图 10MiB、2000 万像素、上传解码并发 1、30 秒超时，配置为 `MEDIA_MAX_BYTES`、`MEDIA_MAX_PIXELS`、`MEDIA_CONCURRENCY`、`MEDIA_TIMEOUT_MS`。博客入口最多同时接收 2 个文件体，服务 metadata/读取不占用解码名额。签名加 sharp 实际解码，仅 JPEG/PNG/WebP，拒绝动画。按 EXIF 旋转后剥离 metadata，最大边 4096；PNG 无损压缩，JPEG/WebP 质量 90。只保存一个标准化版本，不做全局 checksum 去重。Caddy 硬上限 21MB，应用可配置上限不超过 20MiB；默认限制留有余量。媒体容器默认 512MiB，sharp 缓存 16MiB/单原生线程；提高解码并发须同时评估容器内存。

## 初始化与部署

先备份旧博客数据库及秘密配置。新增配置见 `.env.production.example`：`BLOG_DB_USER/PASSWORD`、`MEDIA_DB_NAME/USER/PASSWORD`、`MEDIA_DATABASE_URL`、`MEDIA_SERVICE_URL=http://media:3100`、独立 `MEDIA_SERVICE_TOKEN`。`POSTGRES_USER` 保留原 bootstrap 管理员，`DATABASE_URL` 改用 BLOG_DB_USER。不要改变已有 POSTGRES_PASSWORD。

标准部署先执行博客 migration，再 `media-init`、`media-migrate`，媒体健康后切换应用。初始化在既有 volume 上可重复，已有账号不改密码，密码不匹配或运行角色权限过大时失败。blog/runtime 只获博客表 CRUD；media 只获独立媒体库；media 容器只注入媒体连接和服务凭据。迁移仍使用 bootstrap 管理员。

```bash
docker compose --env-file .env.production -f compose.prod.yml run --rm migrate
docker compose --env-file .env.production -f compose.prod.yml run --rm media-init
docker compose --env-file .env.production -f compose.prod.yml run --rm media-migrate
docker compose --env-file .env.production -f compose.prod.yml up -d media
```

不在生产自动恢复、清库或回滚。新表是增量变更；应用回退到旧版本前须先停止媒体写入，旧版本不会服务 `/media` 图片，含受管图片的文章需要维护窗口处理。保留两库、角色及备份，不删除新表。

## 成对备份与隔离恢复

内容 JSON 仅包含文章修订文本，不包含图片。旧 `backup-db.sh` 仅备份博客库；有媒体后使用 `bash scripts/backup-media.sh`，它显式停止 app/worker/media（等待在途操作结束），为两库生成同一静止状态的 custom-format dump 和校验和，然后恢复服务。失败时保持写服务停止，留待人工排查。这会造成维护窗口，两个运行中的独立 dump 不等于原子备份。

```bash
bash scripts/backup-media.sh
# 在隔离机器或本机测试实例，安全注入 PGUSER/PGPASSWORD：
PGHOST=127.0.0.1 PGPORT=54329 \
RESTORE_BLOG_DB=restore_blog_test RESTORE_MEDIA_DB=restore_media_test \
bash scripts/restore-media-test.sh backups/paired-.../ting_lab.dump backups/paired-.../ting_media.dump
```

恢复脚本只接受 localhost/127.0.0.1 和全新 `_test` 数据库，不覆盖、不删除现有库。恢复后需验证公开/私有 HTTP 读取、引用保护、数量与 checksum，再决定正式恢复。主密钥、会话密钥和媒体凭据单独加密备份。

二进制使数据库、WAL 和备份同时增长。至少预留数据库加两份完整备份及 WAL 的空间，监控剩余磁盘；成对备份不自动裁剪，运维验证离机副本后按保留策略删除完整的一对，建议每日 7 份、每周 4 份。不要只删除其中一个 dump。
