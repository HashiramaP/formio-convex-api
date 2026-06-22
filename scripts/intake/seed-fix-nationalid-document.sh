#!/usr/bin/env bash
# Fix the nationalIdDocument OCR config so its fills resolve to real questions.
# Before: it extracted a single "validity" string → `nationalIdValidity`, which
# is NOT a question (orphan fill → autofill silently dropped). After: it extracts
# issueDate + expiryDate separately → nationalIdIssueDate / nationalIdExpiryDate.
# Idempotent (setDocumentConfig upserts by key). Targets .env.local (dev).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[fix] updating nationalIdDocument fills → nationalIdIssueDate / nationalIdExpiryDate…"
(cd "$CONVEX_DIR" && npx convex run documents:setDocumentConfig "$(cat "$SCRIPT_DIR/data/nationalid-document.json")") >/dev/null
echo "[done] nationalIdDocument fixed."
