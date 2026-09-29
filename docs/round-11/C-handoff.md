# C：模型配置与秘密

基线 `f1554a292b73dc255934d40e8e844a52e6d90220`，本轮未提交。配置持久化使用 B migration 中的 model_profiles，无额外 schema migration。

完整激活 DB Chat profile 优先于 env；保存不激活，显式禁用阻止 env 自动启用，移除覆盖才恢复完整 env。请求开始时取快照。Embedding provider/model/baseURL/2048 维首次冻结，Chat 改动不换向量空间，后台只允许独立 Key 替换。

Key 使用 AES-256-GCM，随机 nonce、AAD purpose/version、认证标签；服务器独立主密钥，API/props/内容导出不返回明文或密文。初始化、主密钥生成/轮换与备份说明见 [后台指南](../admin.md)。

测试与真实调用共用 HTTPS/443 精确主机批准列表、连接时 DNS 公网 IP 校验及禁用重定向；没有内网/TLS/生产测试绕过。连接测试固定短文本、10 秒、16 tokens、持久限速。测试以 SDK fake model 与浏览器测试接口拦截分层验证，不声称调用了真实供应商。

已验证 AES 篡改/AAD/version 失败、scrypt、SSRF 私网/回环/credentials/协议、实际 fetch 私网 DNS 拒绝、完整 profile 激活、显式禁用、Embedding 空间不变和读响应脱敏。后台模型设置浏览器验收通过，截图 [模型设置](screenshots/admin-model-settings.png)。

隔离恢复副本额外运行了真实 `rotate-master` CLI：旧 Key 拒绝、新 Key 可解密，原测试库未被轮换。生产 Compose 增加非 root worker、双网络确定性出口、日志轮转与 heartbeat；静态 env/Compose 校验通过。未执行生产部署、真实模型计费或生产数据操作。
