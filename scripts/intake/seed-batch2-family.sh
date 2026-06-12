#!/usr/bin/env bash
# Family-information forms — IMM 5406, 5645 (renseignements sur la famille) and
# 0008DEP (personnes à charge additionnelles). Each collapses to the single
# `familyMembers` multi-entry (seeded by seed-imm5707fr.sh), so these only set
# immQuestions — no new gaps. Idempotent. Targets .env.local.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; D="$SCRIPT_DIR/data"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
for f in imm5406fr imm5645fr imm0008depfr; do
  (cd "$CONVEX_DIR" && npx convex run legalDocuments:setImmQuestions "$(cat "$D/${f}-immquestions.json")") >/dev/null
  echo "[ok] $f"
done
echo "[done] family forms (5406/5645/0008DEP) → familyMembers."
