#!/usr/bin/env bash
# IMM 5708 fr (Extend stay / restore status as a VISITOR). Sibling of 5710/5257 —
# 86 questions, reuses the catalog; 1 new gap (visitorRequestType). Idempotent.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; D="$SCRIPT_DIR/data"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
run(){ (cd "$CONVEX_DIR" && npx convex run "$1" "$(cat "$2")"); }
run questions:seedCanonicalQuestions "$D/imm5708fr-gaps.json" >/dev/null
run legalDocuments:setImmQuestions   "$D/imm5708fr-immquestions.json" >/dev/null
echo "[done] IMM 5708 fr enriched."
