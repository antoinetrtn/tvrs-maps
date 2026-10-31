#!/usr/bin/env bash
# Runs the Conquête SQL tests on a throwaway database.
# Usage: PGHOST=… PGUSER=… scripts/test-conquest-sql.sh   (needs psql + a superuser)
set -euo pipefail
DB="${CONQUEST_TEST_DB:-conquest_test}"
cd "$(dirname "$0")/.."
psql -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/conquest_stub.sql
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null
done
psql -v ON_ERROR_STOP=1 -q -o /dev/null -d "$DB" -f supabase/tests/conquest_test.sql
echo "Conquest SQL tests passed"
