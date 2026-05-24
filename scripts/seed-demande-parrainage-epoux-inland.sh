#!/usr/bin/env bash
# Slice 2 — seed the canonical "Parrainage époux/conjoint au Canada" demande
# preset. Bundles the IMMs mapped so far (IMM 5476, IMM 1344 FR). Re-run
# after mapping more IMMs (5532, 0008, 5406, 5669) to extend the bundle.
# Idempotent: upserts by slug.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "slug": "parrainage-epoux-inland",
  "name": "Parrainage époux/conjoint au Canada",
  "category": "parrainage",
  "description": "Catégorie des époux et conjoints de fait au Canada (demande in-Canada). Inclut les formulaires de parrainage requis par IRCC.",
  "legalDocumentIds": [
    "k57cmkw07as757ybxk0217y1nx86nqag",
    "k57606cb40jpvkvx7qxghw8sdd86mp70"
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run demandeTypes:setDemandeType "$ARGS")
echo "[seed] demandeType 'parrainage-epoux-inland' upserted (2 IMMs bundled: 5476, 1344)"
