#!/usr/bin/env bash
#
# Guardrail §3.1 — never invent Juleb API surface.
#
# Juleb publishes no public API documentation. Until a real specification and
# sandbox credentials exist, no hardcoded Juleb host, path, or endpoint may appear
# in source. All access goes through the JulebClient port, whose HTTP driver throws
# JulebSpecUnavailableError. See docs/integrations/juleb.md.
#
# Usage:
#   guard-juleb.sh              scan all tracked files (CI mode)
#   guard-juleb.sh FILE...      scan only the given files (used by test-guards.sh)
set -uo pipefail

fail=0
note() {
  printf 'GUARD FAIL (§3.1): %s\n' "$1" >&2
  fail=1
}

if [ "$#" -gt 0 ]; then
  SCAN=("$@")
else
  mapfile -d '' -t ALL < <(git ls-files -z)
  SCAN=()
  for f in "${ALL[@]}"; do
    case "$f" in
      docs/*|prompts/*|scripts/guard-*.sh|scripts/__fixtures__/*|*.md) continue ;;
    esac
    [ -f "$f" ] && SCAN+=("$f")
  done
fi

if [ ${#SCAN[@]} -eq 0 ]; then
  echo "guard-juleb: no files to scan"
  exit 0
fi

# 1. No hardcoded Juleb hostname. The real base URL comes from JULEB_BASE_URL.
hits=$(grep -nIE '(https?://)?[A-Za-z0-9.-]*juleb\.(com|sa|io)' "${SCAN[@]}" 2>/dev/null || true)
if [ -n "$hits" ]; then
  note "hardcoded Juleb hostname in source; the base URL must come from JULEB_BASE_URL"
  printf '%s\n' "$hits" >&2
fi

# 2. No invented endpoint paths attributed to Juleb.
hits=$(grep -nIEi "juleb[A-Za-z]*(Url|Path|Endpoint|Route)[[:space:]]*[:=][[:space:]]*['\"]/" \
  "${SCAN[@]}" 2>/dev/null || true)
if [ -n "$hits" ]; then
  note "an invented Juleb endpoint path"
  printf '%s\n' "$hits" >&2
fi

# 3. No network call may name juleb inline.
hits=$(grep -nIEi "(fetch|axios|got|request)\([^)]*juleb" "${SCAN[@]}" 2>/dev/null || true)
if [ -n "$hits" ]; then
  note "a network call referencing Juleb outside the port's HTTP driver"
  printf '%s\n' "$hits" >&2
fi

# 4. The HTTP driver, once it exists, must still throw until the spec lands.
driver="packages/juleb/src/drivers/http.ts"
if [ -f "$driver" ]; then
  if ! grep -qI 'JulebSpecUnavailableError' "$driver"; then
    note "$driver exists but never throws JulebSpecUnavailableError — the spec has not landed"
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "guard-juleb: OK (${#SCAN[@]} files scanned)"
fi
exit "$fail"
