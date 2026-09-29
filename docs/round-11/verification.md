# 第十一轮最终验收

日期：2026-09-28。基线：`f1554a292b73dc255934d40e8e844a52e6d90220`。A/B/C 已在当前工作区实现，尚未创建 Git commit。架构决策见 [ADR](../adr/001-admin-content-and-ui.md)，初始化和上线顺序见 [后台指南](../admin.md)。

## 已执行的检查

| 检查                                                   | 结果                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `pnpm format`、`pnpm format:check`                     | 通过                                                                |
| `pnpm content:check`                                   | 6 篇文章、2 个项目通过                                              |
| `pnpm lint`、`pnpm typecheck`                          | 7 个 workspace 通过                                                 |
| `pnpm test`                                            | 91 通过、2 个数据库集成测试默认跳过；无失败                         |
| 隔离库下显式执行两个集成测试                           | 2/2 通过，模型/Embedding 使用 fake                                  |
| `pnpm build`、最终 `pnpm --filter @ting-lab/web build` | 通过                                                                |
| database 模式 + 不可达 DB 地址构建                     | 通过，构建无需访问运行数据库                                        |
| `pnpm test:e2e`                                        | Chromium 14/14 通过                                                 |
| `pnpm test:admin`                                      | Chromium 3/3 通过，使用本地隔离库                                   |
| 生产 env 静态预检、Compose config                      | 通过                                                                |
| standalone 运行产物                                    | database 模式启动成功；健康检查、文章列表、文章详情、后台登录均 200 |
| `git diff --check`                                     | 通过                                                                |

浏览器回归覆盖即时筛选、快速连续选择、分页清理、刷新与历史恢复、键盘与 Escape、主题、搜索、共享 AI 消息协议、文章抽屉、未发布内容隔离及原有项目页面。后台覆盖未登录拒绝、固定 Origin、登录/退出、草稿预览、发布、修改草稿不改变公开版、重新发布、撤稿、公开搜索/RSS/sitemap/标签同步、内容导出、配置保存/测试反馈/激活和秘密脱敏。

最终截图保存在 [screenshots](screenshots/)。已查看桌面筛选、深色窄屏筛选、后台桌面、深色 375px 编辑器与模型设置截图。后台复用现有 ThemeControl，不引入第二套主题状态。

回归期间发现：动态页面测试仅等待 URL，可能在新页面挂载前操作；已增加实际详情 heading 就绪断言。内容边界测试会写入/删除共享 fixture，整个前台套件改为串行。一次旧构建下的历史导航检查仍失败，重新构建后专项 3/3、最终完整 14/14 通过；保留这一过程说明，不将中间失败记录为通过。

## 数据、任务与恢复

仅使用本机 `127.0.0.1:54329` 的独立容器 `ting-lab-round11-test`，数据库为 `ting_lab_round11_test` 与 `ting_lab_round11_restore_test`。正式 SQL migrations 已在测试库执行。未访问生产数据库。

真实仓库 6 篇 MDX 已完成 dry-run → apply → 再次 apply，第二次均为 unchanged。集成测试检查不可变修订、乐观锁冲突、发布与 outbox 事务、旧 revision/lease token、过期 lease 接管、重复 checksum 复用向量、撤稿后 RAG 排除、导入不覆盖后台编辑以及会话撤销。

备份使用 PostgreSQL `pg_dump -Fc`，恢复到新建的第二个隔离库。备份时两端均为 10 articles、13 revisions、3 profiles、12 tasks，按 article_id/revision 排序的 revision checksum 聚合 MD5 均为 `ba0e711ad591836e8bd4ca9e0c15db39`。后续测试继续向原测试库添加 fixture，因此当前行数可能大于该快照。

恢复库使用原主密钥成功解密配置；随后只在恢复库执行 `rotate-master`，新主密钥/版本可解密，旧主密钥拒绝。原测试库密钥未轮换。秘密保留在被 Git 忽略的本地 env，文档、截图和内容导出不包含明文或密文。

## 验证边界

- 没有执行生产部署、生产导入或真实模型计费请求。连接 UI 使用浏览器路由 fake；SDK 层使用 fake model，实际 DNS 私网拒绝另有测试。
- 未构建/运行 Linux 生产 Docker 镜像，未执行生产公网 network smoke；已做 Compose 静态验证及本机 standalone 冒烟，不能替代目标 VPS 验证。
- 视口覆盖 320/375/768/1440，200% 使用 CSS zoom；未宣称手机实机或浏览器工具栏缩放验证。
- 本地测试库保留测试文章、修订与任务，不能用于生产。没有配置真实 Embedding，浏览器发布流程中的任务可能保持 pending；worker 成功/失败/重试使用 fake 集成验证。
- 后台适合单作者博客规模，内容管理列表当前在服务端取数据后筛选；不是多租户 CMS。
