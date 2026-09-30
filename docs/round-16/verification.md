# 第十六轮验收

基于 `d49cb8d`（第十五轮）继续实现，保留用户提供的提示词文件。代码未部署到 VPS，未读取生产数据库，未访问真实模型；原有模型 Key/索引故障未处理。

## 实现

- 独立媒体 HTTP 应用、独立 PostgreSQL database/runtime role；元信息与 bytea 分表。新增博客 SQL migration `0005_media_references` 和独立媒体 migration。
- 同源管理员上传，签名/解码/像素/体积校验、EXIF 旋转与去除、解码并发限制；无远端下载代理。
- AST 受管引用、幂等准备 pin、博客事务内修订引用；匿名图片按当前公开 revision 实时授权，历史引用保留删除保护。没有依赖 AI 任务的媒体权限同步。
- 原生 textarea 工具栏、串行上传锚点、混合粘贴、失败重试/取消、媒体库、未保存 RSC 预览；共享代码复制和图片 Dialog。
- Compose/角色初始化/预检/部署、停写成对备份和全新本机数据库恢复脚本；详细取舍见 [媒体服务](../media-service.md) 与 [编辑器](../markdown-editor.md)。

## 验证记录

环境：Windows，Node 22.23.2、pnpm 9.15.9、Next production build，Playwright Chrome channel。截图使用 CSS viewport 1440×900、390×850、360×850，DPR 1、100% 浏览器缩放，不以图片后期缩放冒充浏览器缩放。浅色、深色、reduced-motion 均有实际页面断言。录屏从登录后开始，不记录密码或 Cookie。

通过：`pnpm format`、`pnpm format:check`、`pnpm content:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 和 Web production build。公开 `pnpm test:e2e` 31/31；后台 `pnpm test:admin` 10/10。本轮追加用例覆盖多图混合粘贴、原生撤销、上传期间输入及删除锚点、真实未保存预览、草稿匿名 404/发布 200/ETag 304/撤稿后 404、引用图片禁止删除与逐字复制。

显式隔离集成套件 5/5：database、publishing、journal、media store、media HTTP。为避免既有 E2E outbox 干扰“恰好一次 fake embedding”计数，使用全新本机 `_test` 博客数据库串行运行；Turborepo 默认环境过滤下跳过的集成测试不计作已执行。

数据库角色/媒体 migration 重复执行成功，已有密码保留；双向跨库连接拒绝。媒体服务进程重新创建 store 后二进制仍可读。真实 `pg_dump`/`pg_restore` 到全新的两个 `_test` 库后，二进制 MD5、应用 checksum、修订公开标记和 pin 完全一致。部署脚本 7 个隔离 mock 用例及示例 env/Compose 静态校验通过。

本轮发现并修复：Server Action 返回阅读客户端岛时缺少编辑页模块入口；工具栏读取旧选区；媒体读取误占上传解码并发名额。未通过的中间日志保留在临时验收目录，最终结果以对应 final/all 日志为准。

## 证据与范围

实际截图及登录后 WebM 保存在 `test-results/round16/evidence`；命令日志为 `test-results/round16-*.log`，恢复 dump 在 `test-results/round16/restore-*`。这些是本机验收产物，未覆盖 `docs/round-12` 至 `docs/round-15` 的历史证据，数据库 dump 不提交 Git。

本轮没有实测生产 VPS、生产 Docker 镜像构建/容器重建、线上 Caddy/TLS、Firefox/Safari、真实系统剪贴板多图来源及真实中文 IME。多图粘贴通过浏览器 ClipboardEvent/File fixture 驱动；原生 textarea 没有拦截普通按键，上传完成会等待 composition 结束。资源限制和大图并发拒绝有回归，但未将配置上限等同于 VPS 峰值内存压测结论。

本机 Docker 构建已尝试，Docker Hub `auth.docker.io` token 请求连接超时，未进入镜像构建阶段；不能将 Node production build 当作 Docker 镜像验收。`.dockerignore` 已补充任意层级 `.env`、test-results、Playwright 报告与 dump 排除规则。1600 万像素图片的 3 请求并发回归验证服务接受一个处理请求、其余以 429 拒绝；没有记录或推测生产峰值 RSS。

上线前新增独立 BLOG_DB、MEDIA_DB 和 MEDIA_SERVICE 配置，先按文档备份，再走标准 migration/init/health 门禁。首次升级不自动修改已有数据库账号密码；失败 pin 保守保留，不会自动公开或自动删除资产。
