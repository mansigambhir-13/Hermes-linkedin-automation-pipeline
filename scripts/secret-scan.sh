#!/usr/bin/env bash
# Fail if a secret looks committed. High-signal patterns only (low false-positive).
# Run locally: bash scripts/secret-scan.sh   ·   also runs in CI on every push/PR.
set -uo pipefail

fail=0

# 1) .env (and real env files) must never be tracked.
for f in .env .env.local .env.production; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    echo "::error::'$f' is tracked by git — it must be gitignored (secrets live only in the host env)."
    fail=1
  fi
done

# 2) Known secret shapes in tracked files (exclude this script, the template, and the lockfile).
patterns='(xox[baprs]-[0-9A-Za-z-]{8,}|xapp-[0-9]-[0-9A-Za-z-]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|service_role.*eyJ[A-Za-z0-9_-]{20,})'
if matches=$(git grep -nIE "$patterns" -- ':!scripts/secret-scan.sh' ':!*.example' ':!pnpm-lock.yaml' 2>/dev/null); then
  echo "::error::possible committed secret(s) — rotate them and purge from history:"
  echo "$matches"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "Secret scan FAILED."
  exit 1
fi
echo "Secret scan passed: no tracked env files, no high-signal secret patterns."
