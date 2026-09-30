# 第十五轮：SEO 架构与文章导航

基线 `17483ab`；Next 锁定实际版本 15.5.20，未升级依赖。保留用户提供的第十五轮提示词。未部署、未访问生产数据库、未调用真实模型或索引 worker。

## 实现

- 首页精选、卡片、最新内容、归档、相关阅读与搜索结果共用 LinkPending。保留 Next Link/href，由 useLinkStatus 驱动当前链接的指示器，150ms 后显示；预留尺寸，reduced-motion 不旋转。没有全局路由劫持或假百分比。
- 搜索结果从按钮改为真实链接；键盘 Enter 触发相同链接，导航完成后关闭 Dialog，Ctrl 新标签不关闭原搜索。保留 debounce、请求取消、焦点与既有 Portal。
- 归档使用局部 Suspense；详情先检查公开文章再流式输出正文骨架，不新增会包住不存在详情的祖先 loading.tsx。正文布局复用实际宽度。编译前用 scheduler.yield 主动让出一次事件循环，使同步 CPU 工作不阻塞骨架输出；没有定时 sleep 或最短加载时长。错误边界明确可重试，refresh + reset 确保重新请求服务端数据。
- Shiki 原有 singleton 默认加载全部语法，改为 langs:[]/lazy，遇到未知语法回退 text。仅共享语法资源，不增加编译结果或页面缓存。详情通过请求内 React cache 复用已解析 post，确保 file 模式 metadata/body 也使用同一对象；数据库原有请求快照不变。
- canonical 区分分页、筛选、跟踪参数；page=1/无效/超界按实际查询归一化。有效无筛选分页可索引且标题含页码；筛选 noindex/self-canonical。/ai noindex 并移出 sitemap。sitemap 汇总最大真实文章日期；作者统一，BlogPosting 补 mainEntityOfPage，移除没有依据的 Organization publisher。
- 路由矩阵与站长平台手工步骤见 [SEO 指南](../seo.md)。AGENTS 已替换旧归档规则。

## 性能证据与边界

Windows、Node 22.23.2、pnpm 9.15.9、本机 Chrome、production build/start，file 模式 6 篇文章/2 个项目。桌面 1440×900，移动视口 390×900，100% CSS 像素；不是手机实机。网络为 localhost，未人为限速的基线与延迟回归分别记录。

原构建首次进程文章导航标题/正文约 8511/8515ms；改后首次约 883/886ms。每个只有一个进程冷导航样本，不能据此宣称可靠 P95 或线上提速比例。独立 Markdown/Shiki 编译另做 3 个新进程、每进程 4 次：默认冷编译中位 8480ms，按需加载 435ms；同机同期进程负载影响绝对值，热编译仍约 13–23ms。改后真实服务器首个正文 validate 17.1ms、compile 271.8ms，后续约 1–5ms/5–14ms。

归档→详情，每组 3 个浏览器上下文，表中为标题/正文中位毫秒：

| 视口 | 条件         | 首访前→后         | 同上下文再访前→后 |
| ---- | ------------ | ----------------- | ----------------- |
| 1440 | 框架默认预取 | 153/157 → 180/185 | 67/71 → 106/109   |
| 390  | 框架默认预取 | 121/125 → 175/178 | 110/113 → 60/64   |
| 1440 | 拦截预取请求 | 168/184 → 184/204 | 152/160 → 116/130 |
| 390  | 拦截预取请求 | 173/179 → 185/190 | 127/131 → 118/123 |

“首访”是新浏览器上下文，不代表每次服务器冷进程。拦截预取可能触发 Next 整页后备导航，不能等同于正常 prefetch=false；原始数据保留此实验条件。热导航没有一致改善；收益证据集中在高亮冷初始化和可见等待反馈，不把骨架出现更早等同服务器更快。原始 RSC Resource Timing 包含 TTFB、下载时间、transferSize；localhost 与浏览器缓存为零的条目不解读为线上网络成本。

现有 getContentRepository 的 React cache 保留。数据库全量 published snapshot 仍是待测扩展瓶颈：本机隔离 *_test 连接不可用，Docker daemon 也未运行，未取得数据库读取指标，因此没有按猜测改造查询层。CONTENT_TIMING=1 可在受控环境输出数据库读取/校验与 Markdown 校验/编译耗时，不含内容、连接或 Key。file 读取器按访问重新解析，详情已用请求内缓存消除 metadata/body 重复解析，其他读取未贸然引入永久缓存。

Caddy 仓库配置仍保留 /api/chat 的 flush_interval -1，页面走原 reverse_proxy。未实测生产代理缓冲或线上 TTFB，不归因用户线上慢导航为网络、数据库或某个唯一原因。

补充改后路径测量，每组 3 次；默认框架预取，延迟组对每个 RSC 请求增加 800ms（可能有多次请求，不能把总延迟直接视为服务端时间）：

| 视口/延迟    | 首页→详情 标题/正文 | 相关阅读 标题/正文 | 列表→详情 标题/正文 | 返回列表 |
| ------------ | ------------------- | ------------------ | ------------------- | -------- |
| 1440 / 0ms   | 182/190             | 89/96              | 58/64               | 33       |
| 390 / 0ms    | 142/145             | 53/356             | 54/60               | 45       |
| 1440 / 800ms | 961/968             | 1682/2000          | 863/869             | 32       |
| 390 / 800ms  | 982/988             | 1692/2013          | 868/875             | 41       |

延迟组首次可见局部指示器中位约 154–163ms；快速组多数在指示器显示前已完成，未采到可见 spinner。这里只记录“可见指示器”，不冒充点击 pressed 或屏幕阅读器时间。首页/相关阅读/返回列表未补做旧版本同路径基线，不声称这些路径已有前后提速证据。RSC 可能包含框架预取与导航请求，原始 Resource Timing 保留累计条目，不把条目数直接当数据库查询次数。详情 metadata/body 的已解析 post 现在请求内复用，未引入强制全文预取。

可复现入口：`node scripts/navigation-benchmark.mjs before|after`（服务在 3200）、`node scripts/navigation-paths.mjs`、`node scripts/markdown-benchmark.mjs [--lazy]`；隔离数据库计时用 `node --env-file=<本机测试环境> --import tsx packages/publishing/test-support/content-benchmark.ts`，脚本校验 localhost 与 *_test 后才连接。

## 验证记录

最终构建显示 `/posts/[slug]` route JS 849B / First Load JS 107kB，归档 4.71kB / 148kB，共享 103kB；没有把正文移到客户端解析，也没有按缺乏证据的 bundle 假设改动共享聊天或字体。该数值是构建报告，不能等同于每次导航的实际网络下载量。

| 命令                               | 最终结果                                           |
| ---------------------------------- | -------------------------------------------------- |
| `pnpm format`、`pnpm format:check` | 通过                                               |
| `pnpm content:check`               | 通过，6 篇文章、2 个项目                           |
| `pnpm lint`、`pnpm typecheck`      | 各 7 个任务通过                                    |
| `pnpm test`                        | 13 个任务通过；默认数据库集成项跳过，Web 37 项通过 |
| `pnpm build`                       | 7 个任务通过，Next production build 完成           |
| `pnpm test:e2e`                    | Chrome 31/31 通过，2.0 分钟                        |
| 本机数据库计时                     | 未取得结果：隔离测试库不可用                       |

tsx 在沙箱内调用 uv_os_get_passwd 失败，内容校验/单元测试和浏览器测试通过自动审批后在本机沙箱外运行；没有启用真实模型或生产数据库。最初完整 E2E 因 Windows 进程清理未正常退出而中止，后续沙箱外全量执行正常退出（code 0）。测试中预期的无效内容错误会出现在服务端日志，最终恢复重试断言通过。所有临时 round15 fixture 已清理。

首次回归暴露并修复错误页 reset 不刷新服务端数据；搜索旧用例改为链接定位并等待 Dialog 的真实退出。延迟测试最初主动 abort 预取导致整页后备导航，已改为只延迟真实 RSC；返回位置必须记录第二次点击前的滚动位置，而非浏览器自动滚到第二链接前的位置。这些修正保留了原行为断言。

未增加跨请求内容缓存，故不需要新的发布失效协议；原草稿隔离、file 随记组合筛选、共享聊天状态、抽屉和搜索回归仍运行。已下载内容不能远程收回。

## 证据

- [改前导航数据](evidence/navigation-before.json)、[初次优化后导航数据](evidence/navigation-after.json)、[最终路径采样](evidence/paths.json)、[独立冷/热编译](evidence/markdown-repeated.jsonl)。
- 2s 受控延迟连续帧：[点击前](evidence/before.png)、[等待](evidence/pending.png)、[完成](evidence/complete.png)。真实运行截图，未禁用动画；该用例启用 reduced-motion，因此 spinner 保持静态。
- [390px 阅读](evidence/390-home.png)、[1440px 相关阅读目标](evidence/1440-related.png)、[桌面归档](evidence/1440-archive.png)。人工检查排版、可读性和边界；截图使用浏览器 100% 与对应 viewport，非系统缩放模拟。

未运行手机实机、WebKit、本轮 Firefox 或生产数据库测试。用户后续手工完成真实域名配置与 Google/Bing 所有权验证、sitemap 提交，步骤见 SEO 指南；没有伪造 verification token 或代用户提交。
