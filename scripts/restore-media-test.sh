#!/usr/bin/env bash
# Restore only into fresh local *_test databases; never overwrites or drops a database.
set -Eeuo pipefail
[[ $# == 2 ]] || { echo 'Usage: restore-media-test.sh BLOG.dump MEDIA.dump'; exit 2; }
[[ "${PGHOST:-}" == localhost || "${PGHOST:-}" == 127.0.0.1 ]] || { echo 'Local host required'; exit 2; }
for name in "${RESTORE_BLOG_DB:-}" "${RESTORE_MEDIA_DB:-}"; do
  [[ "$name" =~ ^[a-z][a-z0-9_]*_test$ ]] || { echo 'Fresh *_test databases required'; exit 2; }
done
[[ "$RESTORE_BLOG_DB" != "$RESTORE_MEDIA_DB" ]] || exit 2
createdb "$RESTORE_BLOG_DB"
createdb "$RESTORE_MEDIA_DB"
pg_restore --exit-on-error --no-owner --no-privileges --dbname "$RESTORE_BLOG_DB" "$1"
pg_restore --exit-on-error --no-owner --no-privileges --dbname "$RESTORE_MEDIA_DB" "$2"
psql -v ON_ERROR_STOP=1 -d "$RESTORE_MEDIA_DB" -c 'SELECT count(*) AS assets,sum(bytes) AS bytes FROM media_assets; SELECT count(*) AS binaries FROM media_binary;'
psql -v ON_ERROR_STOP=1 -d "$RESTORE_BLOG_DB" -c 'SELECT count(*) AS references FROM article_media_references;'
echo 'Restore complete. Run isolated media integration and HTTP permission checks before any production restore.'
