#!/usr/bin/env bash
# Fix: iucNumber had a global dependsOn { canadianStatus: [citoyen_naturalise,
# resident_permanent] } set by the sponsorship (IMM 1344) work. Because dependsOn
# lives on the canonical question, it LEAKED onto every other form that asks
# iucNumber but not canadianStatus (5710, 5532, 5476, 5257) — silently HIDING the
# UCI field there. UCI is an optional field not actually tied to Canadian status,
# so the correct fix is to make it unconditional everywhere.
#
# Proper long-term fix: per-form dependsOn (carry it on the immQuestions entry and
# let getIntakeForClient override the canonical). See INTAKE-REDUCTION-PLAN.md.
# Idempotent. Targets .env.local (dev).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[fix] clearing iucNumber global dependsOn (un-hides UCI on 5710/5532/5476/5257)…"
(cd "$CONVEX_DIR" && npx convex run questions:setQuestionDependsOnBatch '{"items":[{"externalId":"iucNumber","dependsOn":null}]}') >/dev/null
echo "[done] iucNumber is now unconditional."
