# 第十二轮：界面一致性与后台交互

基线：`6d3b689c3c79d6617efd8c4d432a9ad9a2ceb6b7`。本轮只修改已有前后台界面、公开导航与相关查询/测试，不部署生产、不访问真实模型。

## 问题与修复

| 问题                  | 根因与改动                                                                                                       | 证据                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 首页错误选中文章      | 删除 home→posts 映射，桌面/移动统一路径段匹配，tags 归文章                                                       | navigation 单元测试、首页 E2E                                                                                  |
| 搜索只覆盖 Header     | Header backdrop-filter 形成定位包含块，搜索迁入共享 Dialog Portal                                                | Overlay 1440×900 完整视口；实际截图                                                                            |
| 弹层横向抖动          | html overflow-x:clip 阻止 body 锁滚动正常作用于视口，库仍补偿滚动条；移除根 overflow 设置，仅 Radix 补偿         | [geometry-chromium.json](geometry-chromium.json)：真实 15px 经典滚动条，Header 1425px、main x=248.5px 开关不变 |
| 搜索旧结果/Enter/重试 | 新输入立即失效旧请求与结果；统一取消生命周期；Enter 仅输入处理且排除 IME；router.push                            | 新旧查询、IME、重试关闭、原 AI 会话跨搜索导航测试                                                              |
| 主题状态分散          | 根 ThemeProvider、DropdownMenu 单选菜单、storage 容错与同步                                                      | 桌面/移动、刷新、storage 不可用测试                                                                            |
| 后台导航/导出混杂     | 224px 侧栏、顶栏主题/退出、移动 Sheet，导出移至列表工具栏                                                        | [后台列表](screenshots/admin-list.png)、[移动 Sheet](screenshots/admin-sheet-mobile.png)                       |
| 后台全量正文分页      | 独立 querySummaries，参数化 SQL COUNT/LIMIT/OFFSET，repeatable-read 一致快照                                     | 45 条隔离集成与 E2E；返回对象无 body/metadata/checksum                                                         |
| 导出无状态            | 确认、准备、下载已发起、失败/过期；验证附件与格式；Blob URL 释放                                                 | 实际下载事件、500/401 不下载、重复点击保护                                                                     |
| 编辑与配置覆盖输入    | 原始标签字符串、服务端规范化快照、pending 禁止输入、字段错误、离开 Dialog、有限索引轮询；Chat/Embedding 独立状态 | 保存失败/冲突保留、完整发布流程、fake 连接测试                                                                 |

嵌套 Dialog/Select 使用真正共享组件，测试专用 HTML 在 Playwright 路由内构建，不新增生产测试入口。内层 Escape 不解锁外层，最终关闭恢复焦点、pointer-events 与长页 scrollY。

## 测试环境与过程

- Node 22.23.2、pnpm 9.15.9；Windows、系统 Chrome。经典滚动条测试显式移除 Chromium `--hide-scrollbars`，并断言 innerWidth 大于 clientWidth。
- 后台只使用 `.env.round11-test` 的本机 `_test` 数据库。globalSetup 校验地址后恢复测试密码，避免发布集成测试的凭据生命周期测试影响后续登录；不打印密码、不录制 trace。
- 最初 tsx 在沙箱内因 `uv_os_get_passwd ENOMEM` 失败，正常权限下相同命令通过。前台 Playwright 沙箱运行完成断言后无法结束服务器进程，最终验证改用正常权限运行并等待命令结束。
- 旧窄屏测试要求 scrollWidth 必须等于 innerWidth，无法兼容经典滚动条；改为验证不溢出。旧搜索结果 link 与主题 radio 定位随实际 button/menuitemradio 语义更新。
- 迭代中修正标签输入仍写旧状态、顶栏退出按钮被挤成竖排。截图取自修复后的运行结果，不接受旧错误截图作为基线。
- Firefox 自动化 `page.reload()` 在 pushState 后增加重复历史条目；history 调用记录显示应用没有额外 push。改用浏览器原生 `location.reload()` 后条目数保持 4，前后退恢复筛选。文章冷启动响应超过旧 7 秒断言期限，因此此处明确允许 20 秒，保留真实跳转和标题断言。
- 新建保存后的 `replace` 与 `refresh` 竞争会打断紧接着的预览；新建仅 replace，并保持 pending 到页面切换，已有文章直接采用服务端返回快照。后台回归同时检查保存冲突、离开取消及确认。
- Embedding 测试 fixture 显式初始化冻结空间，Key 为不会发送的 fake 值；测试不再因未配置而跳过该断言。Firefox 使用覆盖式滚动条，经典滚动条断言仅对 Chromium 强制执行，两种环境均记录坐标。

## 验证边界

- 没有生产部署、生产内容导出、真实模型计费请求或手机实机测试。
- 320/375/768/1440 与 200% CSS zoom 用浏览器自动化覆盖；CSS zoom 不等同于操作系统缩放或手机键盘实机验证。
- 站内链接离开有确认，刷新/关闭保留 beforeunload；浏览器同文档历史前后退不在链接拦截范围，文档明确先保存后操作。
- 后台 fixture 保留在隔离库，不作为公开生产内容。完整数据库备份仍属于运维流程，内容导出未扩展该契约。

## 验证命令

| 命令                                                                                                                                              | 结果                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm format` / `pnpm format:check`                                                                                                               | 通过                                                               |
| `pnpm content:check`                                                                                                                              | 通过，6 篇文章、2 个项目                                           |
| `pnpm lint` / `pnpm typecheck`                                                                                                                    | 通过，各 7 个 workspace 任务                                       |
| `pnpm test`                                                                                                                                       | 通过，13 个任务；默认跳过需要数据库环境的集成项，Web 35 项通过     |
| `pnpm build`                                                                                                                                      | 7 个构建任务完成，生产路由生成成功                                 |
| `pnpm --filter @ting-lab/publishing exec tsx --env-file=D:/wtx/code_projects/my-blog/.env.round11-test --test src/publishing.integration.test.ts` | 隔离数据库集成通过，包含 45 条分页、末页删除夹取、非法参数与空结果 |

Windows 通过临时 Corepack shim 调用 `pnpm.cmd`；环境文件保持忽略且未提交。浏览器最终汇总及里程碑提交见下方。

- 设置 `CROSS_BROWSER=1` 和本机 `PLAYWRIGHT_BROWSERS_PATH` 后执行 `pnpm test:e2e`：**40/40 通过**，Chromium 与 Firefox 各 20 项，退出码 0。
- `pnpm test:admin`：**6/6 通过**，退出码 0；包含完整发布闭环与本轮后台交互。并行测试时首次预览初始化超过原 10 秒期限，改为该断言单独允许 30 秒；最终串行完整重跑通过。
- `pnpm build` 最终退出码 0。构建、Lint、类型和单元测试均针对最终业务代码执行。
- [Chromium 经典滚动条坐标](geometry-chromium.json)与[Firefox 覆盖式滚动条坐标](geometry-firefox.json)分别留档；嵌套弹层测试额外检查长页 scrollY、焦点、pointer-events 和外层锁定。

## 真实里程碑提交

| 阶段 | Commit    | 内容                                                                   |
| ---- | --------- | ---------------------------------------------------------------------- |
| A    | `b0c142f` | 导航匹配、搜索 Portal 与竞态、唯一滚动补偿、主题共享基础、跨浏览器回归 |
| B    | `7451d21` | 后台侧栏/顶栏/移动 Sheet、统一 Select 与 Button、模型表单独立状态      |
| C    | `3ae6a7e` | SQL 摘要分页、导出反馈、编辑保存/离开/错误状态、后台与隔离数据库测试   |

共享弹层与主题基础随 A 提交以满足其依赖；Button 默认类型和表单调用点一起随 B 提交。此文档及截图作为随后独立的验收提交，不将中间失败说成最终通过。

## 视觉验收

实际浏览器截图逐项检查：搜索蒙层覆盖 Header 和全视口，菜单与输入对齐，后台顶栏账户横排，桌面列表密度与移动卡片清晰，弹窗文字不截断。关键截图：

- [首页搜索](screenshots/search-home.png)、[文章 Select](screenshots/posts-select.png)、[深色移动搜索](screenshots/search-dark-mobile.png)
- [后台列表](screenshots/admin-list.png)、[移动列表](screenshots/admin-list-mobile.png)、[移动 Sheet](screenshots/admin-sheet-mobile.png)
- [编辑器冲突反馈](screenshots/editor.png)、[模型配置](screenshots/model-settings.png)、[导出确认](screenshots/export-dialog.png)
