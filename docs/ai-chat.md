# AI 对话与 UI Message Stream 协议

本文件记录 AI 对话体验的架构约束与流协议不变量，供后续模型独立接手。`AGENTS.md` 提供仓库级总览，这里补充实现细节。

## 入口与共享内核

AI 对话有两个入口，复用同一聊天能力，不得复制逻辑：

- 首页 compact 侧栏：`apps/web/src/components/home/AiPanel.tsx`（可收起 client 组件），内含 `<AiChat mode="compact">`。
- 全页面工作区：`apps/web/src/app/ai/page.tsx`（Server Component）→ `apps/web/src/components/ai/AiWorkspace.tsx`（client），内含 `<AiChat mode="workspace">`。

共享聊天状态由 `apps/web/src/components/ai/chat-provider.tsx` 提供：在 root `layout.tsx` 持有唯一 `Chat<TingLabUIMessage>` 实例（来自 `@ai-sdk/react`），通过 Context 暴露 `useSharedChat()`。`AiChat` 调 `useChat({ chat, experimental_throttle: 60 })` 复用该实例，因此首页与 `/ai` 之间切换路由、展开收起侧栏、打开关闭抽屉都不会丢失会话或终止生成。展示模式（`compact`/`workspace`）只控制布局与视觉，不参与协议与状态管理。

不要把 API Key、provider、模型名或服务端配置放入客户端 store；客户端只持有 UI message 与轻量 UI 状态。

## UI Message Stream 协议不变量

一次用户提交必须严格对应：一次 `POST /api/chat`、一次 RAG 检索、一次模型生成、至多一条 assistant message。服务端协议实现位于 `apps/web/src/lib/chat/stream.ts`（`buildChatStream`/`handleChatRequest`/`ChatStreamDeps`），由 `apps/web/src/app/api/chat/route.ts` 的 `POST` 调用。`route.ts` 是 Next.js Route Handler，只允许导出 HTTP 方法与路由配置字段，因此协议函数与类型必须放在 `lib/chat/stream.ts`：

- `buildChatStream(messages, deps, abortSignal)`：协议核心，依赖注入边界（`ChatStreamDeps` 含 `model`/`systemPrompt`/`config`/`retrieve`），便于测试用 `MockLanguageModelV3`（`ai/test`）与 fake `retrieve` 驱动。
- `handleChatRequest(chat, deps, abortSignal)`：组装 `createUIMessageStreamResponse`。
- `POST`（`route.ts`）：解析请求、限流、`validateChatRequest`、`createAiRuntime()`、委托 `handleChatRequest`。

关键不变量：

- 外层 `createUIMessageStream` 只承载一轮 assistant message 生命周期。RAG `data-ragStatus`、`data-sources`、`source-url` 与正文 `text-*` 都归属同一条消息。
- 合并 `streamText` 的 token 流时必须使用 `result.toUIMessageStream({ sendStart: false })`。**这是“回答两次”的根因修复**：若开启模型流的 message-start（默认 `sendStart: true`），它会携带一个服务端生成的新 `messageId`；由于客户端 `ReactChatState.replaceMessage` 使用 `structuredClone`（破坏对象引用），RAG data 部件先以客户端 id 落账、随后被服务端 id 覆盖，导致客户端 `pushMessage` 出第二条空 assistant 消息（表现为“回答已停止”幽灵气泡 + 真正回答两条）。关闭 `sendStart` 后，客户端在提交时生成的单一 message id 贯穿整轮，data 与正文归并到同一条消息。
- 不要通过渲染层按相邻消息、文本内容或索引粗暴去重来掩盖协议错误；必须修复消息产生的根因。
- `consumeSseStream` 用于保持流式响应在运行时被正确消费，不会导致第二次模型调用。

## 客户端提交锁

`AiChat` 用 `submittingRef` 保证同一事件循环内点击与 Enter 共用唯一 `submitQuestion` 入口只发一次：

- `submittingRef.current` 在 `sendMessage` 前置 true，`.finally` 中复位；`isGenerating` 兜底。
- IME 组合输入期间 Enter 不发送（`AiComposer` 判断 `event.nativeEvent.isComposing`）。
- `stop` 只终止当前请求，不创建新 assistant message；`regenerate` 替换目标回答，不追加重复回答。
- 异常路径不会让锁永久卡死。

## 文章抽屉

RAG 来源是服务端可信结果（`PublicRagSource`，`url` 形如 `/posts/<slug>#<anchor>`）。点击来源在当前 AI 页面右侧抽屉打开，不离开对话：

- `/ai` Server Component 读取 `searchParams.post`（slug），用 `contentRepository.getPostBySlug(slug)` 读取；未发布或非法 slug 返回 `not_found` 状态，否则 `compilePostMdx(content)` 编译后把 `{ metadata, content, headings }` 传给 `AiWorkspace`。
- `ArticleDrawer`（`apps/web/src/components/ai/ArticleDrawer.tsx`）直接渲染服务端传入的 MDX ReactNode，**复用文章详情的 MDX 渲染、shiki 代码高亮与排版，不建第二套解析器**。
- 数据安全边界：只允许读取 `@ting-lab/content` 中已发布文章；slug 经 `getPostBySlug` 内部 `isSafeSlug` 校验；客户端不能提交任意文件路径或外部 URL；不暴露源文件绝对路径或数据库内部 id。
- 打开/关闭抽屉通过 `router.push('/ai?post=slug#anchor')` 与 `router.push('/ai')` 改变 searchParams，触发服务端重渲染。由于 `AiChat` 使用共享 Chat 实例且不加 `key`（保持挂载），searchParams 变化只重渲染、不卸载聊天，因此打开/关闭/切换文章不重置对话、不重新请求模型、不改变正在流式的消息。浏览器后退自然关闭抽屉。
- 抽屉实现 `role="dialog"`/`aria-modal`、focus trap、Escape/遮罩关闭、背景滚动锁定、anchor 定位与高亮（`decodeURIComponent` + `CSS.escape`）、404 状态，并尊重 `prefers-reduced-motion`。
- 首页 compact 面板中的来源点击统一跳转 `/ai?post=<slug>` 打开抽屉（与共享状态架构一致，最少惊讶）。

## 首页可收起侧栏

`AiPanel` 为 client 组件：默认展开，SSR 与首次客户端渲染一致输出展开态，挂载后从 `localStorage`（`tinglab:ai-panel-collapsed`）同步偏好以避免 hydration mismatch。折叠通过 CSS 隐藏完整面板而非卸载，`AiChat` 保持挂载，生成不被终止。桌面端保留窄 rail 与展开按钮；小屏改为可关闭的移动入口。`data-ai-collapsed` 属性驱动 `page.module.scss` 的 grid 在折叠时扩展主内容列。

## 测试

`apps/web/src/app/api/chat/route.test.ts` 覆盖 UI Message Stream 解析边界：用真实 `Chat`（`@ai-sdk/react`）+ 自定义 transport 驱动 `buildChatStream`（`MockLanguageModelV3` + fake `retrieve`），断言一次提交只形成一条 assistant 消息、正文/来源/RAG 状态同属一条、无文本时不产生第二条空消息、regenerate 不并存两份、原始 chunk 序列不含 `message-start`。

测试用 `tsx --test`（Node 内置 test runner）运行，文件在 `apps/web/package.json` 的 `test` 脚本中显式列举；新增测试文件必须手动加入该脚本。

## 生产流式代理

生产环境使用 Caddy 反向代理 `/api/chat` 的流式响应。任何变更不得启用响应缓冲（`flush_interval`/`buffering` 必须保持关闭），否则流式回答会退化为一次返回。本地无法完整验证 Caddy 行为，部署后需手工确认流是逐步输出。

## 关键文件位置

- 协议与服务端：`apps/web/src/lib/chat/stream.ts`（`buildChatStream`/`handleChatRequest`/`ChatStreamDeps`）、`apps/web/src/app/api/chat/route.ts`（`POST`）、`apps/web/src/app/api/chat/route.test.ts`
- 客户端聊天内核：`apps/web/src/components/ai/AiChat.tsx`、`AiMessage.tsx`、`AiComposer.tsx`、`chat-ui.ts`、`chat-provider.tsx`
- 工作区与抽屉：`apps/web/src/components/ai/AiWorkspace.tsx`、`ArticleDrawer.tsx`、对应 `.module.scss`
- 首页侧栏：`apps/web/src/components/home/AiPanel.tsx`、`AiPanel.module.scss`
- `/ai` 路由：`apps/web/src/app/ai/page.tsx`
- 文章渲染复用：`apps/web/src/components/mdx/MdxContent.tsx`（`compilePostMdx`）、`apps/web/src/components/article/ArticleToc.tsx`
- 聊天领域边界：`apps/web/src/lib/chat/{types,validation,rag,errors,rate-limit}.ts`
