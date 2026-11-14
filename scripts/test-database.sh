#!/usr/bin/env bash
set -euo pipefail
# Always targets this dedicated disposable LOCAL database. Never accepts a remote URL.
cd "$(dirname "$0")/.."
pgbin="${PG_BIN_DIR:-/opt/homebrew/Cellar/postgresql@17/17.12/bin}"
export PSQL_BIN="$pgbin/psql"
"$pgbin/dropdb" -h 127.0.0.1 -p 55432 --if-exists unlock_repair_test
"$pgbin/createdb" -h 127.0.0.1 -p 55432 unlock_repair_test
"$PSQL_BIN" -X -h 127.0.0.1 -p 55432 -d unlock_repair_test -v ON_ERROR_STOP=1 -f tests/supabase-shim.sql >/dev/null
bootstrap_sql="$(mktemp)"
trap 'rm -f "$bootstrap_sql"' EXIT
python3 scripts/build-bootstrap.py > "$bootstrap_sql"
"$PSQL_BIN" -X -h 127.0.0.1 -p 55432 -d unlock_repair_test -v ON_ERROR_STOP=1 -f "$bootstrap_sql" >/dev/null
python3 tests/database-repairs.py
