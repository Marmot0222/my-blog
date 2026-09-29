# B：管理员与数据库文章

基线仍为 `f1554a292b73dc255934d40e8e844a52e6d90220`，修改未提交。新增正式 migration `0004_publishing.sql` 及 Drizzle snapshot；表为 articles、article_revisions、publishing_tasks、admin_credentials、admin_sessions、admin_rate_limits、model_profiles。现有向量表保持派生用途和 halfvec(2048)。

新增 publishing 服务包组合异步 file/database 内容快照。首页、列表、详情、新 slug、标签、相关内容、搜索、RSS、sitemap、Metadata 和 AI 抽屉读取公开修订；database 构建不访问 DB，运行故障不回退文件。搜索/RSS no-store，后台 no-store/noindex。

后台采用 iron-session + 数据库撤销会话、scrypt、固定 Origin 校验、JSON schema/请求体上限与持久登录限速。创建、保存、预览、发布、撤稿、软删除、恢复、乐观锁、只读已发布 slug、导入/所有修订导出均已实现。安全 Markdown 与公开正文共用编译器。

outbox 与发布同事务；worker 5 分钟 lease、3 次尝试、迟到 token/revision/fingerprint 校验；RAG SQL 在正文进入 prompt 前排除过期/撤稿片段。失败重试和索引状态在管理列表/编辑器显示。

隔离库 `ting_lab_round11_test`（本机 54329、独立容器）已应用 migrations。真实 6 篇 MDX dry-run/apply/再次 apply，第二次全部 unchanged。集成测试覆盖版本隔离、冲突、旧任务、lease 恢复、撤稿检索、重复 checksum、不覆盖后台编辑和会话撤销；与原向量测试一起 2/2 通过，模型使用 fake。

后台浏览器流程 3/3 通过，包含完整发布→保存草稿保留旧公开版→再发布→撤稿 404。首轮“新建后仍找旧页面提示”的测试断言失败已修正为检查新编辑页保存的数据。备份恢复细节见 [最终验收](verification.md)。未访问生产。

接手重点：对照 [后台指南](../admin.md) 做首次上线，不直接运行旧 file indexer，不把数据库当缓存删掉。后台分页初版从服务器读取内容后筛选，适合个人博客规模；大规模数据可随后改数据库分页。
