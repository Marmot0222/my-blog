#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.prod.yml)

[[ -f "$ENV_FILE" ]] || { echo "缺少 $ENV_FILE。" >&2; exit 1; }
[[ "$BACKUP_RETENTION" =~ ^[1-9][0-9]*$ ]] || { echo "BACKUP_RETENTION 必须为正整数。" >&2; exit 1; }
docker compose version >/dev/null || { echo "需要 Docker Compose v2。" >&2; exit 1; }

read_env_value() {
  local key="$1"
  sed -nE "s/^[[:space:]]*$key=(.*)$/\1/p" "$ENV_FILE" | tail -n 1 | tr -d '\r\"'
}

POSTGRES_USER="$(read_env_value POSTGRES_USER)"
POSTGRES_DB="$(read_env_value POSTGRES_DB)"
[[ -n "$POSTGRES_USER" && -n "$POSTGRES_DB" ]] || { echo "POSTGRES_USER 或 POSTGRES_DB 缺失。" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/ting-lab-$timestamp.sql.gz"
temporary="$target.tmp"
trap 'rm -f "$temporary"' EXIT

"${COMPOSE[@]}" exec -T db pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=plain --no-owner --no-privileges | gzip -9 > "$temporary"
test -s "$temporary"
mv "$temporary" "$target"

mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ting-lab-*.sql.gz' -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
if (( ${#backups[@]} > BACKUP_RETENTION )); then
  printf '%s\0' "${backups[@]:BACKUP_RETENTION}" | xargs -0 --no-run-if-empty rm --
fi

echo "数据库备份完成: $target"
