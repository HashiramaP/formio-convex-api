#!/usr/bin/env bash
# Batch 1 — IMM 1294 (study permit), 1295 (work permit), 5475 (authorize release
# of info), 5562 (travel history). 27 shared gap questions then each form's blob.
# Drafted in parallel by subagents, then reconciled by hand (address collapse +
# id remaps to canonical). Idempotent. Targets .env.local (dev).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; D="$SCRIPT_DIR/data"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
run(){ (cd "$CONVEX_DIR" && npx convex run "$1" "$(cat "$2")"); }
echo "[gaps] seeding 27 canonical gap questions…"
run questions:seedCanonicalQuestions "$D/batch1-permits-gaps.json" >/dev/null
for k in imm1294f imm1295f imm5475f imm5562f; do
  echo "[form] $k…"
  run legalDocuments:setImmQuestions "$D/${k}r-immquestions.json" >/dev/null
done
echo "[done] batch 1 (1294/1295/5475/5562) enriched."
