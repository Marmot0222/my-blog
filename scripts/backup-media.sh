#!/usr/bin/env bash
# Explicit maintenance window: fail closed and leave writers stopped on failure.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.prod.yml)
read_value() { sed -nE "s/^[[:space:]]*$1=(.*)$/\1/p" "$ENV_FILE" | tail -1 | tr -d '\r\"'; }
admin="$(read_value POSTGRES_USER)"
blog="$(read_value POSTGRES_DB)"
media="$(read_value MEDIA_DB_NAME)"
for value in "$admin" "$blog" "$media"; do [[ "$value" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || exit 2; done
umask 077
mkdir -p backups
target="$(mktemp -d backups/paired-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX)"
echo 'Stopping blog, worker and media for a consistent pair of backups.'
"${COMPOSE[@]}" stop app worker media
trap 'echo "Backup failed; writers remain stopped. Inspect the partial backup and resume services explicitly." >&2' ERR
for database in "$blog" "$media"; do
  "${COMPOSE[@]}" exec -T db pg_dump -U "$admin" -d "$database" --format=custom --no-owner --no-privileges > "$target/$database.dump"
  test -s "$target/$database.dump"
done
printf 'blog=%s\nmedia=%s\n' "$blog" "$media" > "$target/manifest.txt"
sha256sum "$target/"*.dump > "$target/SHA256SUMS"
"${COMPOSE[@]}" up -d media app worker
echo "Paired backup complete: $target. Secrets must be backed up separately. No automatic pruning."
