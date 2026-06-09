#!/usr/bin/env bash
# IMM 5257 fr (Demande de visa de résident temporaire). Reduction-aware intake.
# 84 questions, 85% reused from the catalog (incl. IMM 5710's questions) — only
# 13 new gaps. Idempotent. Targets .env.local (dev).
#
# PREREQUISITE: run ./seed-fix-iucnumber-gate.sh first (clears a leaking global
# dependsOn that would otherwise hide the UCI field on this form).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
run() { (cd "$CONVEX_DIR" && npx convex run "$1" "$(cat "$2")"); }

echo "[1/3] seeding 13 canonical gap questions…"
run questions:seedCanonicalQuestions    "$DATA_DIR/imm5257fr-gaps.json"         >/dev/null
echo "[2/3] setting immQuestions (84 intake questions + 4 required documents)…"
run legalDocuments:setImmQuestions       "$DATA_DIR/imm5257fr-immquestions.json" >/dev/null
echo "[3/3] wiring 6 new dependsOn rules…"
run questions:setQuestionDependsOnBatch  "$DATA_DIR/imm5257fr-dependson.json"    >/dev/null
echo "[done] IMM 5257 fr enriched."
