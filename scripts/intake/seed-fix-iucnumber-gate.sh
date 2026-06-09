#!/usr/bin/env bash
# Fix: iucNumber had a global dependsOn { canadianStatus: [citoyen_naturalise,
# resident_permanent] } set by the sponsorship (IMM 1344) work. Because dependsOn
# lives on the canonical question, it LEAKED onto every other form that asks
# iucNumber but not canadianStatus (5710, 5532, 5476, 5257) — silently HIDING the
# UCI field there. UCI is an optional field not actually tied to Canadian status,
# so the correct fix is to make it unconditional everywhere.
#
# DONE: per-form dependsOn is now implemented (getIntakeForClient uses
# `formDependsOn ?? catalog.dependsOn`). The sponsorship gate for iucNumber lives
# per-form in scripts/seed-imm1344fr-mapping.sh (on the iucNumber entry), so it
# applies on IMM 1344 only. This script just keeps the CANONICAL question
# unconditional so the gate can't leak onto other forms again.
# Idempotent. Targets .env.local (dev).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[fix] clearing iucNumber global dependsOn (un-hides UCI on 5710/5532/5476/5257)…"
(cd "$CONVEX_DIR" && npx convex run questions:setQuestionDependsOnBatch '{"items":[{"externalId":"iucNumber","dependsOn":null}]}') >/dev/null
echo "[done] iucNumber is now unconditional."
