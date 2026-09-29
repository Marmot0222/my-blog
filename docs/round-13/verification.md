# 第十三轮：视觉细节与交互动效

基线为 `95489cb`。本轮只调整既有前后台 UI、导航宿主和浏览器回归；未改变数据库 schema、AI 协议、生产数据或配置。

## 问题、依据与实现

| 问题                              | 依据                                                         | 改动与验证                                                                                                        |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 短导航下划线超出文字              | 源码：min-width 点击区域承担伪元素宽度                       | label 独立居中，单一装饰条测量 label；100%/125% CSS zoom 下左右误差不超过 1px                                     |
| 跨页没有连续指示条                | 源码：各 Server Page 重复挂载 Header                         | 根布局保留 Server Header slot，由 PublicHeader 按路径隐藏后台；公开页面仍是 Server Component，ChatProvider 未移动 |
| 分段与 Select 外框不齐            | 源码：分段外层 padding 叠加子项 min-height                   | 44px 控件 token，分段扣除 padding/border，浏览器比较真实高度                                                      |
| 文章首屏留白过多                  | 设计改进，并由实际截图复核                                   | 仅归档页缩小顶部间距、标题和列表前空白；保留衬线标题与阅读节奏                                                    |
| 按钮、浮层反馈不连续              | 源码：缺失 pressed、退出动画                                 | 统一 160/240/140ms token；hover 仅悬停设备；Radix Presence 保留退出，独立 translate 不覆盖定位 transform          |
| 分段切换跳变                      | 源码：checked 独立背景                                       | 一个装饰背景移动，URL 状态为选中依据；pending 意图用虚线标记，旧结果不清空                                        |
| 抽屉手写 body overflow 和焦点圈定 | 源码确认                                                     | 迁入共享 Dialog，右侧进入/退出，保留已展示内容直到退出完成；新 not-found 响应优先，不显示旧文章                   |
| 长菜单无可拖动滚动条              | 安装版本源码：Radix SelectViewport 注入 scrollbar-width:none | 局部覆盖该默认值，恢复原生滚动条；页面保持平台默认宽度，颜色继承语义 token                                        |
| 关闭长页搜索可能跳回顶部          | 源码：focus() 默认滚动到 Header                              | 搜索和共享 Dialog 恢复焦点使用 preventScroll，回归比较 scrollY 与 Header/main 坐标                                |

粉色悬浮图标：源码关键词与当前页面检查未确认项目内对应元素；未删除未知第三方元素，也未由截图推定用户系统缩放。

## 动效与滚动约束

- 指示条只在选择、ResizeObserver、字体就绪和窗口尺寸变化时测量；不逐帧读布局。仅装饰元素过渡 transform/局部 width，初次定位不飞入；首页无选中项时隐藏。
- Overlay 淡入淡出；居中 Dialog 采用独立 translate 小幅位移，Sheet/文章抽屉按左右方向进入。关闭时保持 Portal Presence，内层菜单完成退出后再处理外层焦点归还。
- ThemeProvider 首屏初始化后才启用核心表面颜色过渡；主题仍只有一个状态源和 system 监听责任。
- 原生 scrollbar-color 从根继承，WebKit 回退限定实际滚动区域。forced-colors 使用原生颜色。没有新增滚动包装层、wheel 拦截、根 stable gutter 或手写补偿。
- reduced-motion 禁用滑动/缩放动画，状态立即可辨；聊天正文和 token 流不添加动画。

## 实测环境与证据来源

Windows，Node 22.23.2、pnpm 9.15.9，production build。Chromium 使用系统 Chrome 并移除 `--hide-scrollbars`，Firefox 使用 Playwright 安装版本 151.0 的 headed 模式。后台仅连接已有本机 `_test` fixture，模型连接由路由 fake 返回。

Firefox 环境修正：最小独立页面确认 headless 模式把普通 `overflow:auto; scrollbar-width:auto` 元素的 computed width 也强制变成 none；CSS 优先级和行内声明均不能改变。因此没有削弱产品断言，而是用 headed 模式重新生成全部 Firefox 截图/录像，并实测原生滚动条。相关上游背景见 [Mozilla 自动化滚动条讨论](https://bugzilla.mozilla.org/show_bug.cgi?id=1989011)。

改前：[第十二轮归档 Select 截图](before/posts-select-1440.png)复用上一轮保存的 1440×900 实测资产，**不是本轮新跑的改前录像**。本地旧 `.next` 混有开发/生产产物，启动返回 500；重建当前代码后验证正常。临时覆盖工作区重建基线的方案未获自动审批，未执行。没有为获取对照回滚或覆盖工作区。

改后：`after/` 截图与 `motion/` 录像由本轮同一生产构建生成；桌面录像和对应导航截图均为 1440×900。响应式矩阵为 1440/1280/390/360，浅/深主题和默认/reduced-motion。125% 测试使用 CSS zoom，不冒充浏览器菜单缩放、操作系统 DPI 或实机验证。

## 自动化与观察

- 导航：四栏目、详情、标签、首页、历史返回、持久 DOM 身份与 label 两侧几何。
- 筛选：快速连续意图、最后选择、旧列表保持、单一分段装饰块最终对齐。
- 浮层：实测中间位置/透明度，不只检查 transition 类；退出结束移除，焦点恢复；上一轮嵌套 Dialog/Select 继续运行。
- 滚动：Chrome/Firefox 经典滚动条、长页与无滚动短页，开关前中后正文/Header 坐标及 scrollY。长页实测 gutter 分别为 15/17 CSS px；Chrome 坐标误差为 0，Firefox 最大约 0.2px；关闭后 scrollY 均保持 400。真实 macOS 覆盖式滚动条未验证。
- 回归资产输出到 test-results，避免新一轮运行覆盖已提交的第十二轮视觉基线。

### 命令结果

| 命令                                                | 结果                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm format`、`pnpm format:check`                  | 通过                                                                                                     |
| `pnpm content:check`                                | 通过：6 篇文章、2 个项目                                                                                 |
| `pnpm lint`、`pnpm typecheck`                       | 通过：各 7 个 workspace 任务                                                                             |
| `pnpm test`                                         | 通过：13 个任务；数据库独立集成用例默认跳过 2 项，未连接生产                                             |
| `pnpm build`                                        | 通过：7 个任务，完整 production build                                                                    |
| `CROSS_BROWSER=1 pnpm test:e2e` 及分浏览器复核      | Chrome 25 项通过；Firefox headed 全量 23 项通过，2 项请求超时在保留原断言的 `--last-failed` 重跑中均通过 |
| `CROSS_BROWSER=1 pnpm test:e2e e2e/round13.spec.ts` | 最终截图/录像重新生成，10/10 通过                                                                        |
| `pnpm test:admin`                                   | 6/6 通过；隔离本机数据库和 fake 模型                                                                     |

首次回归暴露并修复了快速 Escape → Ctrl/Cmd+K 时焦点仍在退出中输入框、导致快捷键被 editable 判断拦截的问题。Ctrl/Cmd+K 现在始终可调用，只有 `/` 在编辑输入时忽略。移动菜单测试改用精确按钮语义定位，避免与退出 Presence 中同名 Dialog 混淆。

### 视觉与动态证据

人工复核桌面归档、窄屏浅/深主题、四栏目导航、AI 工作区、文章抽屉、主题菜单、移动 Sheet 和后台截图。44px 控件外框对齐；归档首屏能看到首篇标题、描述和标签；移动工具栏换行且无横向溢出；抽屉正文和长 Select 的原生滚动条可见。最终静态截图使用 `animations: disabled` 固定有限动画终态；动态证据仍用真实动画运行，不以静态截图宣称动效通过。

- 改前：[归档 Select](before/posts-select-1440.png)。改后：[同视口 Select](after/select-light-chromium.png)、[深色窄屏](after/posts-360-dark-no-preference-chromium.png)。
- 浮层：[搜索](after/search-chromium.png)、[移动 Sheet](after/sheet-dark-chromium.png)、[文章抽屉](after/drawer-chromium.png)。
- 后台：[文章列表](after/admin-list.png)、[编辑器](after/editor.png)、[模型设置](after/model-settings.png)、[移动管理菜单](after/admin-sheet-mobile.png)。
- 动态：[Chrome 录像](motion/interaction-chromium.webm)、[Firefox 录像](motion/interaction-firefox.webm)；[Chrome 逐帧数值](motion/samples-chromium.json)、[Firefox 逐帧数值](motion/samples-firefox.json)。导航采样包含多个中间位置，退出透明度包含 0 与 1 之间的中间值，并断言最终移除；reduced-motion 下无对应活动动画。录像同时记录打开/关闭搜索和文章抽屉。
- 几何：[Chrome 滚动锁坐标](after/scroll-chromium.json)、[Firefox 滚动锁坐标](after/scroll-firefox.json)。导航在 100%/125% CSS zoom 下两侧误差不超过 1px。

### 提交

1. `e7359c2` — 几何和视觉基础：导航、控件、归档节奏、滚动条。
2. `c994b44` — 交互状态和动效：持久导航/分段指示、浮层/抽屉、主题与 pending。
3. 验收修正与文档提交包含本文件、浏览器回归、证据和 AGENTS/UI 来源更新；最终哈希见 Git 历史。

## 未覆盖环境

未在生产部署；没有访问真实模型 API。WebKit 未安装，未运行；macOS、iOS/Android 实机、系统高对比实机和操作系统缩放未验证。forced-colors 仅做浏览器模拟。浏览器原生滚动条外观遵循平台，不承诺跨系统像素一致。Firefox 冷启动曾出现两项请求超时，重跑通过，保留此限制供后续 CI 观察。
