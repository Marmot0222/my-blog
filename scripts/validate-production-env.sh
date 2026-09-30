#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="${1:-.env.production}"
MODE="${2:-}"
CONFIG_ONLY=0
if [[ "$MODE" == "--check-config-only" ]]; then
  CONFIG_ONLY=1
elif [[ -n "$MODE" ]]; then
  echo "用法: $0 [env-file] [--check-config-only]" >&2
  exit 2
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "环境变量文件不存在: $ENV_FILE" >&2
  exit 1
fi

declare -A ENV_VALUES=()
while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="${raw_line%$'\r'}"
  [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ ! "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    echo "环境变量文件包含无法解析的行（值未输出）。" >&2
    exit 1
  fi
  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  ENV_VALUES["$key"]="$value"
done < "$ENV_FILE"

errors=()
require_value() {
  local key="$1"
  [[ -n "${ENV_VALUES[$key]:-}" ]] || errors+=("缺少必填字段: $key")
}

for key in DOMAIN POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL CONTENT_SOURCE TRUST_PROXY NEXT_PUBLIC_SITE_URL SKIP_CONTENT_INDEX AI_ALLOWED_HOSTS BLOG_DB_USER BLOG_DB_PASSWORD MEDIA_DB_NAME MEDIA_DB_USER MEDIA_DB_PASSWORD MEDIA_DATABASE_URL MEDIA_SERVICE_URL MEDIA_SERVICE_TOKEN; do
  require_value "$key"
done

case "${ENV_VALUES[CONTENT_SOURCE]:-}" in
  database)
    for key in ADMIN_ORIGIN ADMIN_SESSION_SECRET CONFIG_MASTER_KEY CONFIG_KEY_VERSION; do require_value "$key"; done
    ;;
  file) ;;
  *) errors+=("CONTENT_SOURCE 必须是 file 或 database") ;;
esac

case "${ENV_VALUES[AI_PROVIDER]:-}" in
  openai) require_value OPENAI_API_KEY ;;
  openai-compatible)
    require_value OPENAI_COMPATIBLE_API_KEY
    require_value OPENAI_BASE_URL
    ;;
  google) require_value GOOGLE_GENERATIVE_AI_API_KEY ;;
  "") ;;
  *) errors+=("AI_PROVIDER 必须是 openai、openai-compatible 或 google") ;;
esac

case "${ENV_VALUES[EMBEDDING_PROVIDER]:-}" in
  openai)
    if [[ -z "${ENV_VALUES[EMBEDDING_API_KEY]:-${ENV_VALUES[OPENAI_API_KEY]:-}}" ]]; then
      errors+=("缺少 Embedding 密钥: EMBEDDING_API_KEY 或 OPENAI_API_KEY")
    fi
    ;;
  openai-compatible)
    if [[ -z "${ENV_VALUES[EMBEDDING_API_KEY]:-${ENV_VALUES[OPENAI_COMPATIBLE_API_KEY]:-}}" ]]; then
      errors+=("缺少 Embedding 密钥: EMBEDDING_API_KEY 或 OPENAI_COMPATIBLE_API_KEY")
    fi
    if [[ -z "${ENV_VALUES[EMBEDDING_BASE_URL]:-${ENV_VALUES[OPENAI_BASE_URL]:-}}" ]]; then
      errors+=("缺少 Embedding Base URL: EMBEDDING_BASE_URL 或 OPENAI_BASE_URL")
    fi
    ;;
  "") ;;
  *) errors+=("EMBEDDING_PROVIDER 必须是 openai 或 openai-compatible") ;;
esac

[[ -z "${ENV_VALUES[EMBEDDING_DIMENSIONS]:-}" || "${ENV_VALUES[EMBEDDING_DIMENSIONS]:-}" == "2048" ]] || errors+=("EMBEDDING_DIMENSIONS 必须为 2048")
[[ "${ENV_VALUES[TRUST_PROXY]:-}" == "true" ]] || errors+=("生产环境 TRUST_PROXY 必须为 true")
[[ "${ENV_VALUES[SKIP_CONTENT_INDEX]:-}" =~ ^[01]$ ]] || errors+=("SKIP_CONTENT_INDEX 必须为 0 或 1")

if (( CONFIG_ONLY == 0 )); then
  domain="${ENV_VALUES[DOMAIN]:-}"
  password="${ENV_VALUES[POSTGRES_PASSWORD]:-}"
  if [[ "$domain" == *example.com* || "$domain" == "localhost" || "$domain" != *.* ]]; then
    errors+=("DOMAIN 仍是示例值或不是有效公网域名")
  fi
  if (( ${#password} < 20 )) || [[ "$password" == *replace* || "$password" == *change-me* ]]; then
    errors+=("POSTGRES_PASSWORD 必须是至少 20 字符的非示例强密码")
  fi
  if [[ ! "$password" =~ ^[A-Za-z0-9._~-]+$ ]]; then
    errors+=("POSTGRES_PASSWORD 仅允许 URL 安全字符 A-Z a-z 0-9 . _ ~ -")
  fi

  expected_database_url="postgresql://${ENV_VALUES[BLOG_DB_USER]:-}:${ENV_VALUES[BLOG_DB_PASSWORD]:-}@db:5432/${ENV_VALUES[POSTGRES_DB]:-}"
  [[ "${ENV_VALUES[DATABASE_URL]:-}" == "$expected_database_url" ]] || errors+=("DATABASE_URL 必须使用独立 BLOG_DB_USER/BLOG_DB_PASSWORD")
  [[ "${ENV_VALUES[MEDIA_DATABASE_URL]:-}" == "postgresql://${ENV_VALUES[MEDIA_DB_USER]:-}:${ENV_VALUES[MEDIA_DB_PASSWORD]:-}@db:5432/${ENV_VALUES[MEDIA_DB_NAME]:-}" ]] || errors+=("MEDIA_DATABASE_URL 不一致")
  [[ "${ENV_VALUES[MEDIA_SERVICE_URL]:-}" == "http://media:3100" ]] || errors+=("生产媒体服务需使用内部地址 http://media:3100")
  for key in BLOG_DB_PASSWORD MEDIA_DB_PASSWORD MEDIA_SERVICE_TOKEN; do
    value="${ENV_VALUES[$key]:-}"
    (( ${#value} >= 32 )) && [[ "$value" != *replace* && "$value" =~ ^[A-Za-z0-9._~-]+$ ]] || errors+=("$key 需要至少 32 字符的独立 URL 安全随机值")
  done
  [[ "${ENV_VALUES[MEDIA_SERVICE_TOKEN]:-}" != "${ENV_VALUES[ADMIN_SESSION_SECRET]:-}" ]] || errors+=("媒体服务密钥不可复用会话密钥")
  [[ "${ENV_VALUES[NEXT_PUBLIC_SITE_URL]:-}" == "https://$domain" ]] || errors+=("NEXT_PUBLIC_SITE_URL 必须等于 https://DOMAIN")
  if [[ "${ENV_VALUES[CONTENT_SOURCE]:-}" == "database" ]]; then
    [[ "${ENV_VALUES[ADMIN_ORIGIN]:-}" == "https://$domain" ]] || errors+=("ADMIN_ORIGIN 必须等于 https://DOMAIN")
    session_secret="${ENV_VALUES[ADMIN_SESSION_SECRET]:-}"
    master_secret="${ENV_VALUES[CONFIG_MASTER_KEY]:-}"
    (( ${#session_secret} >= 32 )) && [[ "$session_secret" != *replace* ]] || errors+=("ADMIN_SESSION_SECRET 需独立生成且至少 32 字符")
    [[ "$master_secret" != "$session_secret" ]] || errors+=("主密钥不能复用会话密钥")
    master_bytes=$(printf '%s' "$master_secret" | base64 --decode 2>/dev/null | wc -c) || master_bytes=0
    [[ "$master_bytes" -eq 32 ]] || errors+=("CONFIG_MASTER_KEY 必须是 32 字节的 Base64 编码")
  fi

  for key in OPENAI_API_KEY OPENAI_COMPATIBLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY EMBEDDING_API_KEY; do
    value="${ENV_VALUES[$key]:-}"
    if [[ -n "$value" && ( "$value" == *replace-with* || "$value" == *example* ) ]]; then
      errors+=("$key 仍是示例值")
    fi
  done
fi

for key in POSTGRES_DB POSTGRES_USER BLOG_DB_USER MEDIA_DB_NAME MEDIA_DB_USER; do
  [[ "${ENV_VALUES[$key]:-}" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || errors+=("$key 不是安全数据库标识")
done
[[ "${ENV_VALUES[MEDIA_DB_NAME]:-}" != "${ENV_VALUES[POSTGRES_DB]:-}" ]] || errors+=("媒体与博客必须是独立数据库")
[[ "${ENV_VALUES[MEDIA_DB_USER]:-}" != "${ENV_VALUES[BLOG_DB_USER]:-}" && "${ENV_VALUES[MEDIA_DB_USER]:-}" != "${ENV_VALUES[POSTGRES_USER]:-}" && "${ENV_VALUES[BLOG_DB_USER]:-}" != "${ENV_VALUES[POSTGRES_USER]:-}" ]] || errors+=("数据库管理员、博客和媒体账号必须独立")

if (( ${#errors[@]} > 0 )); then
  printf '生产环境预检失败：\n' >&2
  printf '  - %s\n' "${errors[@]}" >&2
  exit 1
fi

if (( CONFIG_ONLY == 1 )); then
  echo "生产环境变量结构检查通过（仅配置静态校验）。"
else
  echo "生产环境变量严格预检通过。"
fi
