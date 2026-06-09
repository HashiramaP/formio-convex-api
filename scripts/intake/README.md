# Intake enrichment pipeline (`scripts/intake/`)

Turns a blank IRCC IMM PDF into reduction-aware `immQuestions` on its
`legalDocuments` row — headless, no Adobe. See `../../INTAKE-REDUCTION-PLAN.md`
for the why (north-star + the four reduction levers).

## Per-form recipe

```
1. EXTRACT   tools/extract-imm-xfa.mjs <url|pdf>  > fields.json
             pdf.js (enableXfa) → every field with its full label, type, options,
             XFA name. ~milliseconds. (Falls back-flag set if a form is truly
             dynamic-XFA with no static text — rare; would need Playwright/Adobe.)
2. CLEAN     drop reset/validation/page-header noise; collapse date Jour/Mois/Année
             triplets → one date; fold "Rangée N" / "Emploi 1/2/3" repeats → multi-entry.
3. MAP       Claude-in-session: each field → canonical questions.externalId,
             REUSE-FIRST (never the legacy imm_<slug> IDs; prefer OCR-linked IDs so
             the section becomes upload-instead-of-type). Emit section/order/required,
             and the reduction metadata: dependsOn (from "Si vous avez répondu Oui à
             Qn" labels), ocrFillSource, scope. New concepts → gap questions.
4. VALIDATE  - every reuse ID exists & is canonical
             - every dependsOn child co-occurs with its parent in every form (global!)
             - tools/validate-ocr-fills.mjs: every documents.fills target resolves
5. SEED      seedCanonicalQuestions (gaps) → setImmQuestions (blob) →
             setQuestionDependsOnBatch (conditionals).
6. MEASURE   getIntakeForClient returns `stats` (the reduction funnel). Re-read,
             confirm the net-question count dropped.
```

EN variants reuse the FR externalIds verbatim — translate only label/section.

## Files

- `seed-imm5710fr.sh` — applies IMM 5710 fr (work permit): 96 Qs, 53 gaps, 26 dependsOn.
- `seed-imm5257fr.sh` — applies IMM 5257 fr (TRV): 84 Qs, **85% reused**, 13 gaps, 6 dependsOn.
- `seed-fix-nationalid-document.sh` — fixes the nationalIdDocument OCR fills (orphan → real fields).
- `seed-fix-iucnumber-gate.sh` — clears a leaking global dependsOn that hid UCI on 4 forms.
- `data/*.json` — the reviewed payloads each seed applies (diff-able).
- `tools/extract-imm-xfa.mjs` — the headless XFA extractor (step 1).
- `tools/validate-ocr-fills.mjs` — OCR-fill integrity check (step 4 guardrail).

## Running

Seeds target the deployment in `.env.local` (dev). From this directory:

```bash
./seed-fix-nationalid-document.sh
./seed-imm5710fr.sh
```

All mutations upsert — safe to re-run after editing `data/*.json`.
