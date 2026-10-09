#!/usr/bin/env bash
#
# Guardrail §3.4 — the service-role key never reaches a browser.
#
# Fails if a secret is exposed through a NEXT_PUBLIC_ variable, read outside a
# server-only module, referenced from a client component, or committed as a literal.
#
# Usage:
#   guard-secrets.sh              scan all tracked files (CI mode)
#   guard-secrets.sh FILE...      scan only the given files (used by test-guards.sh)
#
# Docs, these guard scripts, and the violation fixtures are exempt in CI mode:
# they must be able to name the patterns they forbid.
set -uo pipefail

fail=0
note() {
  printf 'GUARD FAIL (§3.4): %s\n' "$1" >&2
  fail=1
}

explicit=0
if [ "$#" -gt 0 ]; then
  explicit=1
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
  echo "guard-secrets: no files to scan"
  exit 0
fi

# 1. No NEXT_PUBLIC_ variable may carry a secret-shaped name.
hits=$(grep -nEI 'NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET|PASSKEY|PRIVATE_KEY|CONSUMER_SECRET)' \
  "${SCAN[@]}" 2>/dev/null || true)
if [ -n "$hits" ]; then
  note "a NEXT_PUBLIC_ variable is named like a secret; it would be inlined into the client bundle"
  printf '%s\n' "$hits" >&2
fi

# 2. The service-role key may only be read from server-only locations.
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  case "$file" in
    supabase/functions/*|*/server-only/*|*.server.ts|*/supabase/admin.ts|*.env.example) continue ;;
  esac
  note "SUPABASE_SERVICE_ROLE_KEY referenced outside a server-only module: $line"
done < <(grep -nI 'SUPABASE_SERVICE_ROLE_KEY' "${SCAN[@]}" 2>/dev/null || true)

# 3. No client component may reference a service role at all.
for f in "${SCAN[@]}"; do
  case "$f" in
    *.ts|*.tsx|*.ts.fixture|*.tsx.fixture) ;;
    *) continue ;;
  esac
  if head -5 "$f" | grep -qI "^['\"]use client['\"]" 2>/dev/null; then
    if grep -qIE 'SERVICE_ROLE|serviceRole' "$f" 2>/dev/null; then
      note "client component references a service role: $f"
    fi
  fi
done

# 4. No committed secret literals. A JWT begins with the base64 of {"alg": — eyJ.
hits=$(grep -nIE 'eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}' "${SCAN[@]}" 2>/dev/null || true)
if [ -n "$hits" ]; then
  note "what looks like a committed JWT / API key literal"
  printf '%s\n' "$hits" >&2
fi

# 5. A real .env must never be tracked. Only meaningful over the whole tree.
if [ "$explicit" -eq 0 ]; then
  for f in "${ALL[@]}"; do
    case "$f" in
      *.env|*.env.local|*.env.production) note "an environment file is tracked in git: $f" ;;
    esac
  done
fi

if [ "$fail" -eq 0 ]; then
  echo "guard-secrets: OK (${#SCAN[@]} files scanned)"
fi
exit "$fail"
