# Intake-reduction progress

Status of the intake-reduction effort (see `../../INTAKE-REDUCTION-PLAN.md` for the
strategy, this dir's `README.md` for the pipeline). Numbers are net-question floors
from `getIntakeForClient.stats` (simplest applicant: conditionals collapse, docs
uploaded).

## Features shipped
- **Counter** — `getIntakeForClient` returns `stats` (total → dedup → OCR → conditional → net). Live.
- **Per-form `dependsOn`** — a question can be gated on one form, unconditional on another (`formDependsOn ?? catalog.dependsOn`).
- **Multi-parent `dependsOn`** — OR across gates (`[{questionId,value},…]`), evaluated in formioform `UnifiedWizard` + Formio `formSections.isFieldVisible`.
- **OCR-fill validator** (`tools/validate-ocr-fills.mjs`) + the headless XFA extractor (`tools/extract-imm-xfa.mjs`, now AcroForm-aware).

## Forms enriched: 22 / 44 — ALL FR IRCC forms done

(Table below lists the first batch; later batches: 5708, 5257en, batch1 (1294/1295/
5475/5562), 5707 + family forms (5406/5645/0008DEP → one `familyMembers` multi-entry),
batch3 (5646/5444/5481/5604/5409). See `seed-*.sh` + `data/`.)

| Form | Q | net | notes |
|---|---|---|---|
| IMM 1344 fr | 107 | — | pre-existing (sponsorship) |
| IMM 0008 fr | 70 | — | pre-existing |
| IMM 5532 fr | 63 | — | pre-existing |
| IMM 5669 fr | 38 | — | pre-existing |
| IMM 5476 fr | 6 | — | pre-existing |
| IMM 5710 fr | 96 | 57 | work-permit extension (first full pipeline run) |
| IMM 5257 fr | 84 | 42 | TRV — 85% reuse |
| IMM 5257 en | 84 | 42 | EN variant — 0 new gaps |
| IMM 5708 fr | 86 | 43 | visitor extension — clone of 5257, 1 gap |
| IMM 1294 fr | 98 | 57 | study permit |
| IMM 1295 fr | 90 | 49 | work permit — 89/90 reuse |
| IMM 5475 fr | 12 | 12 | authorize release of info |
| IMM 5562 fr | 5 | 3 | travel history |

Seed scripts: `seed-imm{5710,5257,5708}fr.sh`, `seed-imm5257en.sh`, `seed-batch1-permits.sh`,
plus fixes `seed-fix-nationalid-document.sh`, `seed-fix-iucnumber-gate.sh`. All idempotent, target dev (`.env.local`).

## Remaining
- **FR IRCC: none** — all enriched.
- **2 PEQ (Québec) forms** — handled by Parsa directly in the forms section (custom forms), not the legalDocuments immQuestions path.
- **EN variants (~20):** parked. Each is near-free — reuse the FR externalIds, translate label/section (see seed-imm5257en.sh).
- **AcroForm note:** 5645/5604/5409 were non-XFA; mapped from the PDF static text (5645 → familyMembers; 5604/5409 = short declarations). No general AcroForm extractor was needed.

## Known issues / TODO
- **Catalog duplicates** from prior work: `ptv_014`≈`familyMemberDisorder`, `ptv_018`≈`overstayedStatus`, `hasGreenCard`≈`hasUsPrCard`, `empJobTitle` (current job) vs `jobTitle` (intended). Worth a dedup/cleanup pass so future mappings have one obvious id per concept.
- **11 orphan OCR fills** remain (sponsoredPassport×5, cosignerPassport×5, divorceDocument×1) — dead config (no form asks those fields); cleanup only, no reduction.
- **Subagent/parallel mapping: ditched.** Mechanically worked but agents drift on reuse (address explosion, synonym ids) → needs as much reconciliation as mapping in-session. Keep mapping in-session.
- **EN variants:** parked (focus FR). Each is near-free (reuse FR ids, translate labels).
- **fieldMappings (PDF fill / Slice 2):** separate track; not addressed here.

## To resume
`npx convex export` for a fresh catalog snapshot; `tools/extract-imm-xfa.mjs <url>` →
clean → map in-session (reuse-first, single-field addresses, verified option codes)
→ `seedCanonicalQuestions` + `setImmQuestions` → measure with the counter.
