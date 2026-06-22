#!/usr/bin/env bash
# IMM 5257 en — English variant of IMM 5257 fr. Mirror structure (258 fields),
# reuses the SAME externalIds, so NO gaps and NO new dependsOn: just one
# setImmQuestions with English labels. Demonstrates near-zero cost for EN variants.
# Idempotent. Targets .env.local (dev).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[1/1] setting immQuestions (84 intake questions, English labels)…"
(cd "$CONVEX_DIR" && npx convex run legalDocuments:setImmQuestions "$(cat "$SCRIPT_DIR/data/imm5257en-immquestions.json")") >/dev/null
echo "[done] IMM 5257 en enriched."
