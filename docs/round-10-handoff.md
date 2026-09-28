# 第十轮交付记录

## 基线与范围

基于 `master` 的 `01a8b71882b489297910afd0cc39133b05d1ab08`，没有回退、提交或部署。开始时仅有未跟踪的第十轮修订提示词；执行根格式化命令后其 Markdown 表格被整理，任务语义未改动。

实现范围：草稿创建、显式开发预览、文章归档筛选和分页、相关阅读、发布与维护文档。技术雷达继续暂缓，未引入新的业务系统、数据库迁移或模型调用。

## 改动文件

- `packages/content/src/new.ts`、`new-post.ts`：CLI 入口、参数校验、模板与独占写入；根目录及 content 包的 `package.json` 注册命令。
- `packages/content/src/queries.ts`、`posts.ts`、`types.ts`、`index.ts`、`utils.ts`：公开查询 API、筛选分页、推荐与稳定排序。
- `apps/web/src/app/posts/page.tsx`、`page.module.scss`：URL 筛选、状态、空结果、分页及索引策略。
- `apps/web/src/app/posts/[slug]/page.tsx`、`page.module.scss`，`components/article/PostList.tsx`、`PostList.module.scss`：相关阅读，复用列表并支持正确的三级标题。
- `apps/web/src/app/preview/posts/[slug]/page.tsx`、`lib/content-preview.ts`、`turbo.json`：仅开发可用的预览和环境变量透传。
- `packages/content/src/workflow.test.ts`、`packages/retrieval/src/indexer.test.ts`、`apps/web/src/lib/content-preview.test.ts`、Web/content 包测试命令、`e2e/content-workflow.spec.ts`、`playwright.config.ts`：行为与隔离验证；生产 E2E 显式携带预览开关以验证其无效。
- `AGENTS.md`、`README.md`、`docs/content-workflow.md`、`docs/product-roadmap.md` 及本记录：操作说明、边界与交接。

## 重要取舍

采用 Server Component 和原生 GET 表单，URL 保存状态，每页 5 篇；筛选提交回到第一页。非法类型回全部、未知标签空结果、非法页码回 1、超界夹到末页。带参数的归档 noindex/follow，canonical 为 `/posts`。

推荐共同标签每项 2 分、同分类 1 分，同分依次比较日期和 slug，最多 3 篇且不补零分内容。预览独立于公开详情，复用正文编译，不改变任何公开内容读取边界。

生产索引失败可能留下部分已更新索引，取消发布需要页面部署及索引清理都完成；完整说明见 [内容工作流](content-workflow.md)。没有修改 AI 协议、共享状态或生产部署网络配置。

## 实际验证（2026-09-28）

| 命令/检查            | 结果                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm format`        | 通过                                                                                            |
| `pnpm format:check`  | 通过                                                                                            |
| `pnpm content:check` | 通过：6 篇文章、2 个项目                                                                        |
| `pnpm lint`          | 6 个 workspace 任务通过                                                                         |
| `pnpm typecheck`     | 6 个 workspace 任务通过                                                                         |
| `pnpm test`          | 83 项通过、1 项跳过，无失败                                                                     |
| `pnpm build`         | 6 个 workspace 任务通过，32 个静态页面生成；最终构建已消除本轮 CSS 兼容性提示                   |
| `pnpm test:e2e`      | 最终 12 项全部通过，包括现有 AI 单回答/共享会话/抽屉、搜索、主题及新增阅读流程                  |
| CLI 与开发预览       | 实际创建中文标题草稿；`CONTENT_PREVIEW=1` + `pnpm dev` 下预览 200、公开详情 404                 |
| 生产草稿边界         | 草稿存在于构建输入时未进入静态路由；生产详情与预览均 404；搜索/RSS/sitemap/索引输入隔离测试通过 |
| 视觉检查             | 检查桌面归档和 360px 深色阅读截图，代码及表格局部滚动，无页面横向溢出                           |

首轮 E2E 的两处失败来自新增测试的定位和断言：改为按 combobox 可访问名称定位标签，搜索只断言 `results`，不误判正常回显的查询词。修正后重跑全套通过。临时草稿及 E2E 草稿均已删除，公开内容未增加或改写。

依赖最初缺失，沙箱内网络及 Windows 用户信息查询受限；通过授权执行安装锁定依赖与验证后解决。1 项数据库集成测试因未配置 `TEST_DATABASE_URL` 按原逻辑跳过，没有连接生产数据库或真实模型。生产部署、Caddy 公网流式行为不在本次本地验收范围。

E2E 沿用既有 `next start` 配置，Next 会提示 standalone 启动方式，并在部分未知静态文章请求时输出 `NoFallbackError` 日志；实际 HTTP 404 与隔离断言通过。本轮没有为消除日志改变既有静态路由策略。

## 作者验收与后续

按 [内容工作流](content-workflow.md) 创建自己的草稿、预览、填写真实内容并校验；在 `/posts` 验证筛选、翻页和浏览器历史恢复，再打开相关阅读。发布由作者审查后在部署环境执行。后续优先用真实写作检验流程，RAG 评估与按需系列导航见 [产品路线](product-roadmap.md)。
