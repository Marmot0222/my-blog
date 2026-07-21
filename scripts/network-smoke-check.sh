#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env.production.example}"
COMPOSE="docker compose --env-file $ENV_FILE -f compose.prod.yml"

echo "检查 indexer 双网络中的内部数据库 DNS 与外部 Provider DNS……"
$COMPOSE run --rm --no-deps indexer node -e '
const dns = require("node:dns").promises;
const raw = process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
let provider;
try { provider = new URL(raw).hostname; } catch { throw new Error("Embedding Base URL 无法解析为合法 URL"); }
Promise.all([dns.lookup("db"), dns.lookup(provider)]).then(([database, external]) => {
  console.log(`db DNS: ${database.address}`);
  console.log(`provider DNS (${provider}): ${external.address}`);
}).catch((error) => {
  console.error(`网络 DNS smoke-check 失败: ${error.message}`);
  process.exit(1);
});'
