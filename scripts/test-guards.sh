#!/usr/bin/env bash
#
# Regression test for the §3.1 and §3.4 guards.
#
# A guard that never fires is theatre. This asserts each guard still detects the
# violation class it exists to catch, using the fixtures in scripts/__fixtures__.
# If someone weakens a guard pattern, this fails.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

fail=0
F=scripts/__fixtures__/violations

expect_detected() {
  local guard="$1" fixture="$2" label="$3"
  if bash "$guard" "$fixture" >/dev/null 2>&1; then
    printf 'TEST FAIL: %s did not detect %s\n' "$guard" "$label" >&2
    fail=1
  else
    printf 'ok: %s detects %s\n' "$(basename "$guard")" "$label"
  fi
}

expect_clean() {
  local guard="$1" file="$2"
  if bash "$guard" "$file" >/dev/null 2>&1; then
    printf 'ok: %s passes clean file %s\n' "$(basename "$guard")" "$file"
  else
    printf 'TEST FAIL: %s flagged clean file %s\n' "$guard" "$file" >&2
    fail=1
  fi
}

expect_detected scripts/guard-secrets.sh "$F/public-prefixed-service-role.ts.fixture" \
  'a NEXT_PUBLIC_-prefixed service-role key'
expect_detected scripts/guard-secrets.sh "$F/client-component-service-role.ts.fixture" \
  'a client component reading a service role'
expect_detected scripts/guard-juleb.sh "$F/hardcoded-juleb-host.ts.fixture" \
  'a hardcoded Juleb hostname'

# Negative controls: real source must not trip either guard.
expect_clean scripts/guard-secrets.sh apps/web/lib/supabase/server.ts
expect_clean scripts/guard-juleb.sh apps/web/lib/supabase/server.ts

if [ "$fail" -eq 0 ]; then
  echo "test-guards: all guard assertions passed"
fi
exit "$fail"
