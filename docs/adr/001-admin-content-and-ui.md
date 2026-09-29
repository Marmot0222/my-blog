# ADR 001：文章数据库、发布修订与 SCSS 组件适配

日期：2026-09-28。基线：`f1554a292b73dc255934d40e8e844a52e6d90220`。

## 决策

根据第十一轮的新需求，`CONTENT_SOURCE=database` 下 PostgreSQL 是文章/笔记唯一权威源。`file` 用于离线演示和开发，禁用后台内容写入。数据库故障不回退文件。项目与关于仍按现有文件方式维护，不建立同一篇文章的双向同步。

文章维护 working revision 与 published revision；保存编辑不会改变访客读取，发布在事务内切换版本并写索引 outbox。撤稿与软删除先从公开读取和 RAG eligibility 中撤销，清理任务可以随后完成。索引表是派生数据，文章、修订、管理员、配置不能删除重建。

新增服务端组合包组织异步内容读取、配置和持久任务，database 负责持久化，content 保持纯规则与文件适配，AI/retrieval 接收显式配置/输入。Web 不创建数据库连接、不写容器内容文件、不调用 Git 或 Docker socket。

UI 采用 shadcn/ui Radix 源码的 SCSS Modules 适配版，保留许可证与来源记录；沿用语义 Token，不引入 Tailwind、不替换全站主题。详见 `packages/ui/UPSTREAM.md`。

后台采用 iron-session 封装安全 cookie，服务端数据库保存可撤销会话；密码使用 Node 成熟 scrypt 实现，秘密配置使用 AES-256-GCM，主密钥和会话密钥分别由环境注入。每个管理入口独立鉴权与同源校验，不能依赖页面或 middleware 隐藏入口。

## 原因与后果

容器仓库文件不是可靠在线存储，Git 推送需要额外凭证和部署耦合。数据库支持事务、修订隔离、乐观锁和持久 outbox；代价是 database 模式的公开文章读取依赖数据库可用性，必须备份和演练恢复。

初版优先请求时读取当前公开版本，避免永久进程内搜索索引和无效的缓存失效承诺。配置按请求解析完整 profile，不把不同供应商的 Key 和地址逐字段混合。Embedding 空间冻结，只允许替换独立 Key，换模型需运维重建。

参考：[Next.js 服务端鉴权指南](https://nextjs.org/docs/app/guides/authentication)、[iron-session](https://github.com/vvo/iron-session)、[shadcn 手动安装](https://ui.shadcn.com/docs/installation/manual)。实现和验证状态逐里程碑记录，本文不是已完成测试的声明。
