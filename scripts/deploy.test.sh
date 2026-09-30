#!/usr/bin/env bash
# Exercise orchestration with fake executables; never run real Docker or HTTP.
set -Eeuo pipefail
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_PARENT="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
TEST_ROOT="$(mktemp -d "$TEST_PARENT/ting-deploy-test-XXXXXXXX")"
cleanup() {
  local resolved
  resolved="$(cd "$TEST_ROOT" && pwd -P)" || return
  case "$resolved" in
    "$TEST_PARENT"/ting-deploy-test-*) rm -rf -- "$resolved" ;;
    *) echo 'Refusing cleanup outside the test directory' >&2 ;;
  esac
}
trap cleanup EXIT
mkdir -p "$TEST_ROOT/scripts" "$TEST_ROOT/bin" "$TEST_ROOT/content"
cp "$SOURCE_ROOT"/scripts/{deploy,backup-db,validate-production-env}.sh "$TEST_ROOT/scripts/"
cat > "$TEST_ROOT/.env.production" <<'ENV'
DOMAIN=blog.test.invalid
POSTGRES_DB=fixture
POSTGRES_USER=fixture
POSTGRES_PASSWORD=fixture-password-not-real-123456
BLOG_DB_USER=fixture_blog
BLOG_DB_PASSWORD=fixture-blog-password-not-real-123456
MEDIA_DB_NAME=fixture_media
MEDIA_DB_USER=fixture_media
MEDIA_DB_PASSWORD=fixture-media-password-not-real-123456
MEDIA_SERVICE_URL=http://media:3100
MEDIA_SERVICE_TOKEN=fixture-media-token-not-real-123456
MEDIA_DATABASE_URL=postgresql://fixture_media:fixture-media-password-not-real-123456@db:5432/fixture_media
DATABASE_URL=postgresql://fixture_blog:fixture-blog-password-not-real-123456@db:5432/fixture
CONTENT_SOURCE=database
ADMIN_ORIGIN=https://blog.test.invalid
ADMIN_SESSION_SECRET=fixture-session-never-production-123456789
CONFIG_MASTER_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
CONFIG_KEY_VERSION=1
AI_ALLOWED_HOSTS=api.openai.com
TRUST_PROXY=true
NEXT_PUBLIC_SITE_URL=https://blog.test.invalid
SKIP_CONTENT_INDEX=0
ENV
cat > "$TEST_ROOT/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
echo "$*" >> "$CALLS"
case "$*" in
  *"version --short"*) echo 2.33.1 ;;
  *"pg_dump"*) [[ "${FAIL_AT:-}" != backup ]] || exit 7; echo '-- fixture dump' ;;
  *"SELECT EXISTS"*) echo "${ADMIN_EXISTS:-f}" ;;
  *"src/cli.ts import"*) [[ "${FAIL_AT:-}" != import ]] || exit 8 ;;
  *"password --if-missing"*) [[ "${ADMIN_PASSWORD:-}" == fixture-admin-password-123 ]] ;;
  *"build app"*) [[ -z "${ADMIN_PASSWORD:-}" ]] ;;
  *"ps -q"*) echo fixture-container ;;
  inspect*) echo healthy ;;
esac
MOCK
cat > "$TEST_ROOT/bin/curl" <<'MOCK'
#!/usr/bin/env bash
echo curl >> "$CALLS"
MOCK
chmod +x "$TEST_ROOT/bin/"*
export PATH="$TEST_ROOT/bin:$PATH"
export CALLS="$TEST_ROOT/calls"
run_case() {
  : > "$CALLS"
  bash "$TEST_ROOT/scripts/deploy.sh" "$@" > "$TEST_ROOT/output" 2>&1
}
has() { grep -q -- "$1" "$CALLS"; }
lacks() { ! has "$1"; }
export ADMIN_PASSWORD=fixture-admin-password-123
run_case --init
has pg_dump; has 'import --apply'; has 'password --if-missing'; has 'up -d app caddy worker'
! grep -q "$ADMIN_PASSWORD" "$TEST_ROOT/output"
dump_line=$(grep -n pg_dump "$CALLS" | head -1 | cut -d: -f1)
migrate_line=$(grep -n 'run --rm migrate' "$CALLS" | head -1 | cut -d: -f1)
(( dump_line < migrate_line ))
export ADMIN_EXISTS=t
run_case --init
lacks 'password --if-missing'; has 'import --apply'
run_case
lacks pg_dump; lacks 'src/cli.ts import'; lacks 'password --if-missing'; has 'up -d app caddy worker'
export FAIL_AT=backup
if run_case --init; then echo 'Backup failure was ignored' >&2; exit 1; fi
lacks 'run --rm migrate'; lacks 'up -d app caddy worker'
export FAIL_AT=import
if run_case --init; then echo 'Import failure was ignored' >&2; exit 1; fi
lacks 'import --apply'; lacks 'up -d app caddy worker'
unset FAIL_AT
export ADMIN_EXISTS=f ADMIN_PASSWORD=short
if run_case --init; then echo 'Short password was accepted' >&2; exit 1; fi
lacks 'import --apply'; lacks 'password --if-missing'
if run_case --unknown; then echo 'Unknown option was accepted' >&2; exit 1; fi
test ! -s "$CALLS"
echo 'deploy orchestration: 7 cases passed (mock Docker/HTTP only)'
