#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.production"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.prod.yml)
CURRENT_STAGE="初始化"

redact_logs() {
  sed -E \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._~+\/-]+/\1[REDACTED]/Ig' \
    -e 's/((API[_-]?KEY|PASSWORD|DATABASE_URL)[=:][[:space:]]*)[^[:space:]]+/\1[REDACTED]/Ig' \
    -e 's#(postgres(ql)?://[^:[:space:]]+:)[^@[:space:]]+#\1[REDACTED]#Ig'
}

show_failure_context() {
  local exit_code=$?
  echo "部署在阶段「$CURRENT_STAGE」失败（退出码 $exit_code）。" >&2
  if docker compose version >/dev/null 2>&1 && [[ -f "$ENV_FILE" ]]; then
    "${COMPOSE[@]}" logs --no-color --tail=120 db migrate indexer app caddy 2>&1 | redact_logs >&2 || true
  fi
  exit "$exit_code"
}
trap show_failure_context ERR

wait_for_healthy() {
  local service="$1"
  local attempts="${2:-60}"
  local container_id status
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    container_id="$("${COMPOSE[@]}" ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      [[ "$status" == "healthy" ]] && return 0
      [[ "$status" == "unhealthy" || "$status" == "exited" ]] && return 1
    fi
    sleep 2
  done
  return 1
}

CURRENT_STAGE="检查运行环境"
command -v docker >/dev/null || { echo "未找到 Docker。" >&2; exit 1; }
docker info >/dev/null || { echo "Docker daemon 不可用。" >&2; exit 1; }
docker compose version >/dev/null || { echo "需要 Docker Compose v2。" >&2; exit 1; }
COMPOSE_VERSION="$(docker compose version --short | sed 's/^v//')"
if [[ "$(printf '%s\n' "2.33.1" "$COMPOSE_VERSION" | sort -V | head -n 1)" != "2.33.1" ]]; then
  echo "需要 Docker Compose 2.33.1+（当前 $COMPOSE_VERSION），以支持 gw_priority。" >&2
  exit 1
fi
[[ -f "$ENV_FILE" ]] || { echo "缺少 $ENV_FILE；请从 .env.production.example 复制并填写。" >&2; exit 1; }
bash scripts/validate-production-env.sh "$ENV_FILE"

COMMIT_SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || printf unknown)"
export APP_VERSION="$COMMIT_SHA"
echo "开始部署 Ting Lab，版本: $COMMIT_SHA"

CURRENT_STAGE="构建生产镜像"
"${COMPOSE[@]}" build app migrate indexer

CURRENT_STAGE="启动数据库"
"${COMPOSE[@]}" up -d db
wait_for_healthy db 60

CURRENT_STAGE="执行数据库迁移"
"${COMPOSE[@]}" run --rm migrate

CURRENT_STAGE="执行增量内容索引"
"${COMPOSE[@]}" run --rm indexer

CURRENT_STAGE="启动应用与 HTTPS 代理"
"${COMPOSE[@]}" up -d app caddy
wait_for_healthy app 60

CURRENT_STAGE="HTTPS 冒烟检查"
DOMAIN="$(sed -nE 's/^[[:space:]]*DOMAIN=(.*)$/\1/p' "$ENV_FILE" | tail -n 1 | tr -d '\r\"')"
for attempt in {1..12}; do
  if curl --fail --silent --show-error --max-time 15 "https://$DOMAIN/api/health" >/dev/null; then
    echo "部署成功: https://$DOMAIN"
    echo "健康检查通过，版本: $COMMIT_SHA"
    exit 0
  fi
  sleep 5
done

echo "HTTPS 健康检查在限定次数内未通过。" >&2
false
