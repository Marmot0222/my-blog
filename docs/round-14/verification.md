# 第十四轮：后台布局与生活记录支持

基线为 `23e26b7`，在当前工作区继续实现，未回退源码。本轮未部署生产、未读取真实模型 Key、未启动索引 worker 或批量重试任务。

## 改动与依据

- 改前运行旧 production build，Chrome 1440×900 实测：Input/Select 顶部约 328.98px，筛选按钮顶部约 316.19px，相差 12.80px；清空链接高度约 25.59px。DOM 显示字段与无 label 操作共享 `align-items:center`。改为独立字段/操作组，容器底边对齐，共用 44px control-height，无坐标补丁。
- 后台“内容管理”标题、说明与新建/导出动作分层；侧栏保留三个模块，查看博客迁至顶部和移动菜单快捷区，用新标签页保留编辑状态。已有编辑器会忽略 `_blank` 链接，不需改变离开确认协议。
- 摘要列表采用 table/列头，小屏带字段名卡片。发布状态、更新时间、索引状态独立；索引失败可键盘展开，不归因为固定 Key 错误。仅一页隐藏分页，空结果提供清空。
- kind 集中到 content 的纯 `kinds` 子入口，扩展 journal；category 继续自由文本，配置建议为技术/生活。前后台形式、分类、标签与分页组合，公开分类只从全部 published snapshot 生成。首页最新内容和搜索/详情/AI 抽屉类型标识同步。
- 数据库仅扩展参数化摘要查询及元数据选项读取，未新增 schema；metadata 无 kind check/enum，故无 migration。原文章和历史修订不改写。新版本导出仍为 ting-lab-content-v1；旧程序不能读取 journal，完整数据恢复仍使用数据库备份。
- CLI 支持 journal 草稿；生活常用标签添加显式稳定 slug。所有虚构生活内容仅在临时 file fixture 或本机 *_test 数据库中创建。
- 前台 Playwright 明确 outputDir 为 test-results/public，与后台 test-results/admin 隔离，避免默认清理整个 test-results。

## 环境与证据

Windows / Node 22.23.2 / pnpm 9.15.9 / 本机 Chrome / Next.js production build。pnpm 原环境未提供，使用锁定版本的工作区忽略缓存。沙箱内 tsx 系统调用及数据库连接失败后，使用已通过自动审批的本机测试执行。初次并行回归暴露前台默认 outputDir 清理后台产物，修复目录隔离后重跑。

改前为本轮新采集的旧构建，而非历史截图复制：[列表](before/admin-list.png)、[几何](before/geometry.json)。改后 fixture 数量与旧库不同，对照用于布局，不比较内容数量。125% 使用 CSS zoom，不宣称浏览器菜单缩放或系统 DPI 实测。

## 验证结果

| 命令 / 范围                                                                                               | 结果                                                                          |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| pnpm format、pnpm format:check                                                                            | 通过                                                                          |
| pnpm content:check                                                                                        | 通过：6 篇文章、2 个项目；临时 fixture 已移除                                 |
| pnpm lint、pnpm typecheck                                                                                 | 通过：各 7 个 workspace 任务                                                  |
| pnpm test                                                                                                 | 通过：13 个任务；默认不连接数据库的集成项跳过                                 |
| pnpm build                                                                                                | 通过：7 个任务，完整 production build                                         |
| pnpm test:e2e                                                                                             | Chrome 全量 26/26 通过                                                        |
| pnpm test:admin                                                                                           | 本机隔离数据库 7/7 通过                                                       |
| node --env-file=.env.round11-test --import tsx --test packages/publishing/src/journal.integration.test.ts | 1/1 通过；不运行 worker、不调用模型                                           |
| Firefox headed：content-workflow + round13                                                                | 首跑 7/9；菜单矩阵重跑通过，阅读用例单独以 60s 超时复核通过；9 项均有通过记录 |

后台覆盖 1440/1280/390/360px 浅/深主题列表及生活文章/随记编辑器，无页面横向溢出。桌面 100% 控件高度 44px、125% CSS zoom 高度 55px（等效 44 CSS px）；同排顶部/底部差均为 0px。125% 时允许字段换行，操作组保持对齐。加载态按钮尺寸不变，提供连续三帧。失败索引测试只把新建 round14 fixture 的 pending 任务设置为 failed，保留已发布标记，使用键盘 Enter 展开说明，不触发重试。

行为回归包含：未提交筛选值清空、保留 pageSize、刷新与历史恢复；生活长文/生活随记/技术随记交叉筛选；新标签页不丢失未保存标题（桌面及移动）；随记保存和预览、撤稿和删除；搜索结果数组、RSS、sitemap 的公开隔离；SQL 摘要不含正文；公开 revision 不受 working revision 分类变化影响；导出两份修订及删除状态，并经 file/import 保留形式与分类。

初次前台动效用例因缺少 ffmpeg 未执行，安装工作区缓存后先单项通过，再全量 26/26 通过。新增后台测试修正了延迟网络拦截清理竞态，以及误把搜索响应的 query 回显当成结果泄漏的断言；最终全量 7/7 通过，没有删除产品行为断言。历史 round13 测试仍写 docs 的问题已修复为 test-results/round13，初次被覆盖的历史资产按 HEAD 精确恢复，最终历史目录无差异。

Firefox 实测使用 Playwright Firefox 151.0（v1532）headed 模式及工作区 PLAYWRIGHT_BROWSERS_PATH。命令为 CROSS_BROWSER=1 pnpm test:e2e e2e/content-workflow.spec.ts e2e/round13.spec.ts --project=firefox；失败项使用 --last-failed --timeout=60000 及单独阅读用例复核。首跑出现窗口 setViewportSize 超时和一次 Escape 后菜单未关闭；菜单矩阵原断言重跑通过，阅读用例第二次在驱动 click 阶段超时、第三次原断言 32.6s 通过。该阅读用例最终显式保留 60s 冷启动预算，未跳过真实页面或点击。不能把这些记录描述为 Firefox 首跑全绿；保留 Windows headed 驱动偶发停顿的环境限制。Firefox 新增随记组合筛选、草稿隔离、动效采样和原生滚动条锁定均通过。

## 交付证据

- 列表：[1440 浅色](after/list-1440-light.png)、[1280 浅色](after/list-1280-light.png)、[360 深色](after/list-360-dark.png)，其余矩阵保存在 after/。
- 编辑器：[生活长文桌面](after/editor-1-1440-light.png)、[随记移动深色](after/editor-2-360-dark.png)。
- 前台：[生活长文](after/public-1.png)、[随记](after/public-2.png)、[随记移动](after/public-2-mobile.png)。
- [移动快捷操作](after/mobile-shortcuts.png)、[几何测量](after/geometry.json)、[加载帧 0](after/pending-0.png)、[帧 1](after/pending-1.png)、[帧 2](after/pending-2.png)。
- 导航/浮层动效复核：[Chrome 录像](motion/interaction-chromium.webm)、[逐帧数值](motion/samples-chromium.json)、[Firefox 录像](motion/interaction-firefox.webm)、[Firefox 滚动坐标](after/scroll-firefox.json)。

静态截图使用 animations:disabled 固定有限动画终态；加载帧及 motion 录像使用真实运行状态。人工复核了桌面列表、窄屏深色编辑器、移动快捷菜单及生活内容阅读页。测试标题携带 round14 标记，用于隔离和长标题布局验证。

## 限制

本轮不验证生产模型、生产数据库或真实索引恢复。未在手机实机、macOS、WebKit 测试；跨浏览器范围以实际命令记录为准。没有部署或提交 Git。
