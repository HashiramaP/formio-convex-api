#!/usr/bin/env bash
# Slice 2 spike — seed IMM 5476 FR's `legalDocuments.immQuestions` with the
# 6-question intake mapping agreed during the IMM-indexed intake design pass.
# Idempotent: subsequent runs overwrite the blob.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMM5476_FR_ID="k57cmkw07as757ybxk0217y1nx86nqag"

read -r -d '' ARGS <<'JSON' || true
{
  "legalDocumentId": "k57cmkw07as757ybxk0217y1nx86nqag",
  "immQuestions": {
    "intakeQuestions": [
      { "externalId": "lastName",    "label": "1. Family name",   "required": true,  "section": "Section A", "page": 1, "order": 1 },
      { "externalId": "firstName",   "label": "1. Given name(s)", "required": false, "section": "Section A", "page": 1, "order": 2 },
      { "externalId": "dateOfBirth", "label": "2. Date of birth", "required": true,  "section": "Section A", "page": 1, "order": 3 },
      { "externalId": "email",       "label": "3. Email",         "required": false, "section": "Section A", "page": 1, "order": 4 },
      { "externalId": "phone",       "label": "3. Phone",         "required": false, "section": "Section A", "page": 1, "order": 5 },
      { "externalId": "iucNumber",   "label": "5. UCI",           "required": false, "section": "Section A", "page": 1, "order": 6 }
    ],
    "requiredDocuments": []
  }
}
JSON

(cd "$CONVEX_DIR" && npx convex run legalDocuments:setImmQuestions "$ARGS")
echo "[seed] immQuestions set on legalDocuments/$IMM5476_FR_ID"
