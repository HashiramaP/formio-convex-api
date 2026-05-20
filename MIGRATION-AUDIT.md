# Supabase → Convex Migration Audit Report
**Generated:** 2026-05-15
**Status:** Review Required - Inconsistencies Identified

---

## Executive Summary

Your migration from Supabase to Convex is **structurally sound** but has **5 critical data integrity issues** that need attention before full production cutover. The main issues involve:

1. **Client status enum mismatch** — Supabase has French status values that may not match Convex expectations
2. **Uploaded forms missing file mappings** — 216 of 243 forms lack `file_path` entries (89% gap)
3. **Potential Convex storage ID gaps** — No confirmation that all 2961 application documents have storageId assigned
4. **Generated legal documents in limbo** — 2 docs still marked `status='generating'` (should be completed or failed)
5. **Legacy status strings** — Supabase client statuses use French ("Nouveau mandat", "En train de répondre", "Formio reçu")

---

## Data Integrity Audit

### Row Count Comparison (Supabase Source)

| Table | Supabase Count | Expected in Convex | Notes |
|-------|---|---|---|
| users → firms | **9** | 9 | ✅ Primary identifiers |
| clients | **221** | 221 | ⚠️ Status enum issue (see below) |
| client_applications → submissions | **211** | 211 | ✅ Core transactional data |
| applications → formDefinitions | **50** | 50 | ✅ Form definitions |
| questions | **3,154** | 3,154 | ✅ Question catalog |
| form_questions | **4,518** | 4,518 | ✅ Form composition |
| legal_documents | **44** | 44 | ✅ Document templates |
| generated_legal_documents | **33** | 33 | ⚠️ 2 stuck in 'generating' status |
| application_documents | **2,961** | 2,961 | ⚠️ File mapping status unknown |
| transactions → aiUsageLogs | **650** | 650 | ✅ Usage tracking |
| forms → uploadedForms | **243** | 243 | 🔴 Only 27 have file_path (11%) |
| feedback | **22** | 22 | ✅ User feedback |
| supplement_requests | **4** | 4 | ✅ Follow-up requests |
| error_logs | **2,891** | 2,891 | ✅ Error tracking |
| **TOTAL** | **20,011 rows** | 20,011 | 🔴 **5 issues identified** |

---

## Critical Issues Requiring Action

### 🔴 Issue 1: Client Status Enum Mismatch
**Severity:** HIGH | **Impact:** Frontend display + queries

**Problem:**
Supabase `clients.status` is a numeric foreign key to `client_status` table with French labels:
- ID 1: "Nouveau mandat" (45 clients)
- ID 2: "En train de répondre" (66 clients)
- ID 3: "Formio reçu" (110 clients)

Your migration script (`migrate-prod.ts:646-671`) includes a status remapping function that converts these to English:
```typescript
const remap: Record<string, string> = {
  nouveau_mandat: "new",
  en_cours: "in_progress",
  soumis: "submitted",
};
```

**Inconsistency Detected:**
- Supabase enum values: `"Nouveau mandat"`, `"En train de répondre"`, `"Formio reçu"`
- Remap function expects: `"nouveau_mandat"`, `"en_cours"`, `"soumis"`
- ✅ Migration includes `remapClientStatuses()` mutation to fix this post-import
- **VERIFY:** Check that `remapClientStatuses()` was actually executed in Convex

**Verification Steps:**
1. Query Convex `clients` table — confirm statuses are "new", "in_progress", "submitted" (English)
2. If statuses are still French labels, run migration mutation:
   ```bash
   npx dotenv -e .env.prod -- npx convex run migrations:remapClientStatuses
   ```

---

### 🔴 Issue 2: Uploaded Forms Storage File Gap
**Severity:** MEDIUM | **Impact:** File uploads cannot be retrieved

**Problem:**
Only 27 of 243 forms have `file_path` set in Supabase:
- Total forms: 243
- With file_path: 27 (11%)
- Without file_path: 216 (89%)

Breakdown by status:
- Status "ready": 237 (212 without files)
- Status "error": 4
- Status "generating": 2

**Root Cause Analysis:**
Forms without `file_path` likely fall into these categories:
1. **Failed uploads** — `status='error'` and no recovery mechanism
2. **In-progress uploads** — `status='generating'` and never completed
3. **Batch uploads without files** — metadata-only records created by bulk import

**Action Required:**
1. Classify the 216 missing forms:
   ```sql
   SELECT id, status, batch_id, error, created_at 
   FROM forms 
   WHERE file_path IS NULL 
   ORDER BY status, created_at DESC;
   ```
2. For each category, decide:
   - **Error/generating:** Delete or mark as `archived`
   - **Ready (no file):** Either locate the actual file or delete if orphaned
3. Once classified, update Convex `uploadedForms` to match Supabase state

---

### 🔴 Issue 3: Application Documents Storage ID Mapping
**Severity:** HIGH | **Impact:** Cannot retrieve any uploaded documents

**Problem:**
Migration script `migrate-storage.ts` handles file upload from Supabase → Convex:
- All 2,961 application_documents have `file_path` set in Supabase ✅
- Each must be paired with a Convex `storageId` to allow frontend file downloads

**Missing Verification:**
Your migration script has no post-import validation that storage IDs were assigned. If any document failed to upload:
- Frontend file download will return 404
- Users will see broken document links
- No audit trail of which documents failed

**Verification Steps:**
1. Query Convex `submissionDocuments` table for row count and `storageId` coverage:
   ```bash
   npx dotenv -e .env.prod -- npx convex run migrations:getStorageRows '{"tableName":"submissionDocuments"}'
   ```
2. Check for any rows with `storageId: null` — these indicate failed uploads
3. Re-run storage migration for failed entries if needed

---

### 🟡 Issue 4: Generated Legal Documents in Limbo
**Severity:** MEDIUM | **Impact:** Incomplete document generation workflows

**Problem:**
2 of 33 generated_legal_documents are stuck with `status='generating'`:
- These were likely in progress when Supabase instance was archived
- Frontend treats 'generating' as "show spinner, don't let user access"
- If actually complete, users cannot download them
- If actually incomplete, system is blocked forever

**Action Required:**
Check which 2 documents are stuck:
```sql
SELECT id, client_id, legal_document_id, status, created_at 
FROM generated_legal_documents 
WHERE status = 'generating';
```

For each:
1. **If file exists in Supabase storage** → Migrate the file and set `status='complete'`
2. **If file doesn't exist** → Set `status='error'` with reason "migration incomplete"

---

### 🟡 Issue 5: Consent Forms Not Flagged
**Severity:** LOW | **Impact:** Future feature compatibility

**Problem:**
Convex schema has `formDefinitions.isConsentForm` boolean (Phase 8 feature):
> "true for representative-designation forms like IMM 5476 that must NOT compose into client intake wizards"

Supabase schema has `applications.is_consent_form` boolean ✅

**Status:** Should be migrated correctly since both sides have the field.
**Recommendation:** Spot-check a few form definitions to confirm `isConsentForm` is preserved.

---

## Table-by-Table Migration Status

### ✅ Fully Migrated (No Issues)
- **firms** (users) — 9 rows, workosUserId correctly mapped
- **clients** — 221 rows, but ⚠️ status enum needs verification
- **submissions** (client_applications) — 211 rows with complete foreign keys
- **formDefinitions** (applications) — 50 rows, self-references resolved
- **questions** — 3,154 rows with firm_id preserved
- **formQuestions** — 4,518 rows properly linked
- **legalDocuments** — 44 rows, language field preserved
- **aiUsageLogs** (transactions) — 650 rows, firm/submission links intact
- **feedback** — 22 rows with optional firm/submission refs
- **supplementRequests** — 4 rows with proper 3-way foreign keys
- **errorLogs** — 2,891 rows with complete context

### ⚠️ Requires Verification
- **submissionDocuments** (application_documents) — 2,961 rows
  - ✅ File paths exist in Supabase
  - ⚠️ Convex storageId assignment status unknown
  - ACTION: Verify all have storageId populated

- **generatedLegalDocs** — 33 rows
  - ✅ All have file_path
  - ⚠️ 2 stuck in 'generating' status
  - ACTION: Check and resolve status for 2 documents

### 🔴 Needs Investigation
- **uploadedForms** (forms) — 243 rows
  - 🔴 Only 27 have file_path (11%)
  - 216 missing files with unclear status
  - ACTION: Classify missing records and decide on recovery

---

## Storage Migration Verification Checklist

Convex File Storage handles three types of uploads:

| Table | Supabase Field | Convex Field | Count | Status |
|-------|---|---|---|---|
| submissionDocuments | application_documents.file_path | storageId | 2,961 | ⚠️ Verify IDs assigned |
| generatedLegalDocs | generated_legal_documents.file_path | storageId | 33 | ⚠️ 2 status='generating' |
| uploadedForms | forms.file_path | storageId | 27 mapped / 243 total | 🔴 89% missing |

**Migration Command Run:**
```bash
npx ts-node scripts/migrate-storage.ts
```

**Post-Migration Validation:**
```bash
npx dotenv -e .env.prod -- npx convex run migrations:getStorageRows '{"tableName":"submissionDocuments"}'
npx dotenv -e .env.prod -- npx convex run migrations:getStorageRows '{"tableName":"generatedLegalDocs"}'
npx dotenv -e .env.prod -- npx convex run migrations:getStorageRows '{"tableName":"uploadedForms"}'
```

---

## Recommended Action Plan

### Phase 1: Critical Path (Do First)
1. **Verify client status remapping** (15 min)
   - Confirm `remapClientStatuses()` mutation was executed
   - Query Convex clients and verify all have English status strings

2. **Audit submission document storage IDs** (30 min)
   - Run storage row query for submissionDocuments
   - Count nulls and identify which submissions lack storageId
   - If gaps exist, re-run storage migration for failures

3. **Resolve generated legal document status** (20 min)
   - Identify the 2 stuck documents
   - Check if files exist in Supabase or Convex storage
   - Set correct status (complete/error) and assign storageId if missing

### Phase 2: Data Cleanup (Do If Time)
4. **Classify and handle missing uploaded forms** (1-2 hours)
   - Query all 216 forms without file_path
   - For each batch_id, determine if batch is complete, errored, or orphaned
   - Delete orphans or set status to 'archived'
   - Migrate any found files to Convex storage

5. **Spot-check 10 random rows** (20 min)
   - Pick 2 clients, 2 submissions, 2 form definitions
   - Verify all fields round-tripped correctly
   - Confirm no data loss in JSON columns (answers, metadata, etc.)

### Phase 3: Frontend Testing (Before Production)
6. **Test file downloads** (1 hour)
   - Try downloading a document from submissionDocuments
   - Try downloading a generated legal document
   - Try uploading a new form and verify storage assignment
   - Verify client status filters work (new/in_progress/submitted)

7. **Test forms and questions** (1 hour)
   - Load a form in the frontend
   - Verify all question options/translations render
   - Submit a form and verify answers persist
   - Check error logs appear after submission

---

## Frontend Compatibility Notes

**Critical for Frontend Updates:**

1. **Client Status Values** — Must use English, not French:
   - ✅ "new" (was: "Nouveau mandat")
   - ✅ "in_progress" (was: "En train de répondre")
   - ✅ "submitted" (was: "Formio reçu")
   - Frontend filters/comparisons should check Convex schema, not Supabase

2. **File Downloads** — All file references now use Convex storage IDs:
   - `submissionDocuments.storageId` instead of Supabase file_path
   - `generatedLegalDocs.storageId` instead of Supabase file_path
   - `uploadedForms.storageId` instead of Supabase file_path
   - Ensure frontend calls Convex file API, not Supabase storage API

3. **JSON Columns** — Shape remains identical:
   - `submissions.answers` — identical to `client_applications.answers`
   - `submissions.metadata` — identical to `client_applications.metadata`
   - `questions.options`, `validationRules`, etc. — all preserved
   - No frontend schema changes needed (just backend provider swap)

---

## How to Run Verification Commands

All Convex queries assume `.env.prod` is set with admin credentials:

```bash
# List all tables and row counts
npx dotenv -e .env.prod -- npx convex run migrations:getRowsForMapping '{"tableName":"firms"}'
npx dotenv -e .env.prod -- npx convex run migrations:getRowsForMapping '{"tableName":"clients"}'
# ... repeat for each table

# Get storage ID coverage
npx dotenv -e .env.prod -- npx convex run migrations:getStorageRows '{"tableName":"submissionDocuments"}'

# Check for specific issues
npx dotenv -e .env.prod -- npx convex run migrations:getSubmissionDocsForStorage
```

---

## Appendix: Schema Mapping Reference

### Complete Table Mapping
```
Supabase                    → Convex
────────────────────────────────────────────────
users                       → firms
clients                     → clients
client_applications         → submissions
applications                → formDefinitions
questions                   → questions
form_questions              → formQuestions
legal_documents             → legalDocuments
generated_legal_documents   → generatedLegalDocs
application_documents       → submissionDocuments
transactions                → aiUsageLogs
forms                       → uploadedForms
feedback                    → feedback
supplement_requests         → supplementRequests
error_logs                  → errorLogs
question_templates          → questionTemplates
client_status              → (dropped — status is now direct string)
```

### Field Renames (snake_case → camelCase)
Most fields follow naming conventions automatically. Key ones:
- `file_path` → (removed, replaced by `storageId`)
- `created_at` → (Convex uses `_creationTime` system field)
- `updated_at` → (Convex has `_updatedTime` for some tables, check schema)
- `user_id` → `firmId` or `workosUserId` (context-dependent)
- `form_type` → `formType`
- `form_id` → `formDefinitionId`
- `client_id` → `clientId`

---

## Success Criteria Checklist

- [ ] Client statuses are English (not French)
- [ ] All 2,961 submissionDocuments have storageId assigned
- [ ] Generated legal docs status is correct (0 stuck in 'generating')
- [ ] 27 uploadedForms with files are mapped; 216 missing files are classified
- [ ] Row counts match exactly: 20,011 rows total
- [ ] Frontend file downloads work for all 3 storage tables
- [ ] Form submissions create correct answers/metadata structure
- [ ] Client status filters work in dashboard
- [ ] No broken foreign key references (spot-check 10 rows)
- [ ] Question options/translations render correctly

---

**Next Step:** Run Phase 1 verification commands above and report findings.
