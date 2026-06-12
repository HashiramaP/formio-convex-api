#!/usr/bin/env bash
# IMM 5707 fr (Renseignements supplémentaires sur la famille). The whole form
# (spouse / mother / father / children / siblings, ~82 fields) collapses to ONE
# multi-entry question `familyMembers`. Idempotent. Targets .env.local.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; D="$SCRIPT_DIR/data"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
run(){ (cd "$CONVEX_DIR" && npx convex run "$1" "$(cat "$2")"); }
run questions:seedCanonicalQuestions "$D/imm5707fr-gaps.json" >/dev/null
run legalDocuments:setImmQuestions   "$D/imm5707fr-immquestions.json" >/dev/null
echo "[done] IMM 5707 fr enriched (familyMembers multi-entry)."
