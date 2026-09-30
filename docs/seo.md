# SEO 与站点检查

## 路由矩阵（第十五轮）

| 路由                            | HTTP                           | 索引             | canonical            | 标题/描述               | 结构化数据  | sitemap              |
| ------------------------------- | ------------------------------ | ---------------- | -------------------- | ----------------------- | ----------- | -------------------- |
| `/`                             | 200                            | 是               | `/`                  | 站点配置                | 保留现有    | 是                   |
| `/posts`                        | 200                            | 是               | `/posts`             | 文章归档                | 无          | 是                   |
| `/posts?page=2`                 | 200                            | 是               | 实际页码自引用       | 标题包含页码            | 无          | 否，由分页链接发现   |
| `/posts?kind=note` 等筛选       | 200                            | noindex/follow   | 规范化筛选与实际页码 | 文章归档                | 无          | 否                   |
| `/posts/[slug]`                 | 200                            | 是               | 文章自身             | 同一公开修订的标题/描述 | BlogPosting | 是                   |
| 不存在/未公开文章               | 404                            | noindex          | 无有效文章 canonical | 内容未找到              | 无          | 否                   |
| `/tags`、已存在标签页           | 200                            | 是               | 自身                 | 标签标题/描述           | 保留现有    | 是                   |
| `/projects`、公开项目、`/about` | 200                            | 是               | 自身                 | 页面/项目 metadata      | 保留现有    | 是                   |
| `/ai`、`/ai?post=`              | 200                            | noindex/follow   | `/ai`                | AI 问答                 | 无          | 否                   |
| `/admin/*`                      | 鉴权/重定向                    | noindex/nofollow | 不作为公开入口       | 后台 metadata           | 无          | 否                   |
| `/preview/*`                    | 生产 404                       | noindex          | 不作为公开入口       | 无                      | 无          | 否                   |
| `/api/*`                        | 接口定义                       | 禁止索引         | 不适用               | 不适用                  | 无          | 否                   |
| 内容源故障                      | 500 或流式响应开始后的错误边界 | 不作为有效内容   | 不提供成功空内容     | 可重试错误              | 无          | 不生成成功空 sitemap |

重复参数取首值；无效 kind 回全部，无效页码回 1，超界页码夹到末页。canonical 与查询后的真实结果一致，page=1 省略。未知分类/标签保留筛选并 noindex，空结果页码为 1。跟踪及未知参数从 canonical 移除，不改变无筛选页面的索引资格。不会为任意查询组合生成 sitemap 链接。

详情在读取公开快照并检查存在性后，才以 Suspense 输出正文骨架。没有在 `/posts` 祖先添加覆盖详情的 loading.tsx，从而避免把已知不存在的详情提前流式输出成 200。正文编译失败发生于响应头发出之后时，HTTP 无法再改成 500；客户端显示可重试错误。不得把这种限制描述成完整 HTTP 错误码覆盖。

## 部署前后检查

1. `.env.production` 中 `NEXT_PUBLIC_SITE_URL` 必须是实际控制的 HTTPS origin；运行既有生产预检。站点配置集中在 `site.ts`，路径无尾斜杠遵循 Next 默认规范。不要为未知域名添加 DNS 或代理规则。
2. 检查 `curl -I https://DOMAIN/posts/SLUG`、`curl https://DOMAIN/robots.txt`、`curl https://DOMAIN/sitemap.xml`、`curl https://DOMAIN/feed.xml`。检查不存在的 slug 为 404、含 noindex；故障不能伪装成空 sitemap。
3. 保存原始 HTML，检查单个 canonical、一次标题后缀、description、作者、可解析 BlogPosting 和服务端正文。对 `/posts?page=2`、筛选、跟踪参数、`/ai?post=` 分别验证。使用普通浏览器 UA 与 `Twitterbot/1.0` 对照；Next 对 HTML 限制爬虫阻塞 metadata，对普通请求可流式发送，内容必须一致。
4. 用浏览器 Network 检查 HTML/RSC 首包和后续块。仓库 Caddy 配置不在本轮改变；生产代理是否另有缓冲必须在线实测，不能用本机结果代替。
5. 如果确实控制一个已配置的别名域名，可在其 Caddy 站点块使用 `redir https://PRIMARY{uri} permanent`，一次跳到主域并保留路径/query。先确认 DNS、证书、主域 origin 和重定向环路，再部署；本轮没有配置任何别名或执行部署。

## 站长平台（用户手工完成）

- Google Search Console：添加真实域名属性；按平台给出的 DNS TXT 验证域名所有权。验证后提交 `https://DOMAIN/sitemap.xml`。用 URL 检查测试首页、文章、第 2 页及一个 noindex 筛选页，查看 Google 选择的 canonical；只对真实公开且可索引的新内容申请编入索引。
- Bing Webmaster Tools：添加站点或按界面允许的方式导入已验证属性，使用实际提供的 DNS/文件/meta 验证值，提交同一 sitemap，使用 URL 检查查看抓取与索引状态。
- 没有验证值时不写 verification token；本轮不登录、不提交站点。上线后观察抓取、索引覆盖和错误，代码正确不等于立即收录，也不承诺排名。

robots 控制抓取，不能代替鉴权或确保去索引。公开 noindex 筛选和 AI 页面允许爬虫访问以读取指令。已下载到用户浏览器的内容无法远程收回；公开读取仍每次验证当前发布快照，本轮没有增加内容跨请求缓存。

参考：[Next 15 useLinkStatus](https://nextjs.org/docs/15/app/api-reference/functions/use-link-status)、[Next 15 loading/streaming](https://nextjs.org/docs/15/app/api-reference/file-conventions/loading)、[Google canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)。
