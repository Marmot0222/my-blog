# 内容创作与阅读流程

文章用于完整的问题分析、取舍和验证；笔记用于短小的排错记录或观察；项目用于持续维护的作品与案例，遵循 [项目维护指南](content-projects.md)。MDX 是唯一内容源，数据库只保存可重建的检索索引。

## 创建与编辑

在仓库根目录运行（Windows PowerShell 同样适用）：

```powershell
pnpm content:new -- --kind article --slug my-first-post --title "我的第一篇文章"
pnpm content:new -- --kind note --slug debugging-note --title "一次问题定位记录"
```

文件固定写入 `content/posts/<slug>.mdx`，默认 `published: false`；重复文件、非法 slug、Windows 保留名称、缺少参数会非零退出，不覆盖。命令不接收输出目录，不调用 AI，不提交 Git。标题由 YAML 序列化处理，模板中的“待填写”仅是写作提示。

编辑标题、摘要、日期、分类、标签及正文。默认日期是创建时的 UTC 日期，发布前核对实际日期。`kind` 为 `article` 或 `note`；`updatedAt` 可选；日期必须为 `YYYY-MM-DD` 字符串。默认标签“工程化”和分类“工程实践”应按真实内容修改。中文标签沿用 `packages/content/src/utils.ts` 中显式映射，新增不能自动生成安全 slug 的标签时需维护映射。`featured: true` 必须同时填写合法 `visual`。不要把模板提示直接发布成作者经历。

## 本地预览与检查

不需要数据库或模型即可阅读和预览。默认不开放草稿预览，PowerShell 显式启用：

```powershell
$env:CONTENT_PREVIEW = "1"
pnpm dev
```

访问 `http://localhost:3000/preview/posts/my-first-post`。macOS/Linux 可用 `CONTENT_PREVIEW=1 pnpm dev`。关闭开发服务器后，PowerShell 用 `Remove-Item Env:CONTENT_PREVIEW` 清除开关。

预览复用正文编译器、代码高亮和目录，页面标注草稿且 noindex。仅 `NODE_ENV=development` 且开关为 `1` 时有效；生产即便设置开关也返回 404。公开 `/posts/<slug>` 始终拒绝草稿，公开列表、静态参数、搜索、标签、RSS、sitemap 与 RAG 索引输入均不包含草稿。MDX 属于受信任仓库代码，不接收访客上传并执行；当前编译流程按 Markdown 格式处理内容。

```powershell
pnpm content:check
```

在窄屏和深色主题下检查目录、长代码、表格与链接。确认正文真实完整后改为 `published: true`，运行仓库全部验证命令，再审查 diff 并由作者提交代码：

```powershell
pnpm format
pnpm format:check
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## 发布与索引

在 VPS 更新到已审查代码，使用未提交的真实 `.env.production`，运行 `pnpm deploy:prod` 或 `./scripts/deploy.sh`。脚本依次预检、构建镜像、启动数据库、迁移、增量索引、启动应用/Caddy、HTTPS 检查；不会自动拉取 Git。不要用示例占位符上线。

静态页面构建和 RAG 索引是两个环节：修改 MDX 不会自动热更新已有生产镜像。构建成功不等于知识库已更新；索引成功也不等于页面版本已切换。

索引 checksum 包含内容、检索元数据、算法版本和 Embedding 配置；未变化文章跳过 Embedding，变化文章逐篇更新。取消发布或删除的文章在成功索引末尾清理。索引不是整个站点的单一事务；中途失败可能保留部分更新，旧索引清理也可能尚未发生。部署脚本此时停止，不会自动回滚，旧应用可能仍运行。修复配置/连通性后重新执行部署，幂等索引会跳过已完成的内容。不要在日志或工单中粘贴密钥。

`pnpm content:index -- --dry-run` 可在正确配置的开发环境检查计划（仍需连接数据库，不调用 Embedding）；`pnpm content:index` 会写索引并可能调用真实 Embedding，只由操作者在明确环境中运行。生产单独重试索引使用：

```bash
docker compose --env-file .env.production -f compose.prod.yml run --rm indexer
```

`SKIP_CONTENT_INDEX=1` 是显式跳过机制，会保留旧知识库，不应用于要求撤下旧内容的发布。取消发布后必须完成新镜像构建/部署与索引清理；旧部署、已有浏览器内容和 RSS 缓存不会即时消失。既有备份及人工恢复流程见 README，恢复前核实目标并备份；不要为重试执行清库或删除 volume。完整索引重建应按 README 人工维护流程执行，不能自动恢复或自动清空。

## 阅读发现与验收

`/posts?kind=note&tag=react&page=2` 使用标签 slug。每页 5 篇，日期倒序、slug 升序；GET 筛选表单不带页码，提交即回到第一页。非法类型回退全部，未知标签返回空结果，负数/非数字/非安全整数页码回到 1，超范围夹到末页，空结果为第 1/1 页。重复参数使用第一个值。页面显示规范化后的实际条件。

筛选及分页 URL 统一 canonical `/posts`，带查询参数时 noindex/follow；sitemap 不生成组合 URL，原 `/tags` 路由保留。相关阅读共同标签每项 2 分、相同分类 1 分，同分按日期倒序及 slug 升序；排除自身、草稿、重复项及零分项，最多 3 篇。

验收顺序：创建草稿并预览 → 内容校验 → 筛选文章/笔记和标签 → 翻页、刷新、前进后退 → 打开相关阅读 → 确认生产预览 404。单元测试使用临时目录，浏览器测试使用现有公开内容，不添加虚构公开文章；AI 回归只使用 fake stream。
