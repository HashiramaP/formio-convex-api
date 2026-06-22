#!/usr/bin/env bash
# Batch 3 — IMM 5646 (custodianship), 5444 (PR travel doc / residency obligation),
# 5481 (sponsorship financial evaluation), 5604 (non-accompanying parent decl),
# 5409 (statutory declaration of common-law union). 12 shared gaps then each blob.
# Idempotent. Targets .env.local.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; D="$SCRIPT_DIR/data"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
run(){ (cd "$CONVEX_DIR" && npx convex run "$1" "$(cat "$2")"); }
run questions:seedCanonicalQuestions "$D/batch3-gaps.json" >/dev/null
for f in imm5646fr imm5444fr imm5481fr imm5604fr imm5409fr; do
  run legalDocuments:setImmQuestions "$D/${f}-immquestions.json" >/dev/null; echo "[ok] $f"
done
echo "[done] batch 3 (5646/5444/5481/5604/5409)."
