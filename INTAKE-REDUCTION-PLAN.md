# Intake Reduction Plan — answer-once, ask-only-what's-unknown

**North star:** a client should never re-type anything Formio can already know. The
number of IRCC fields on a form is fixed by law; the number of questions a *client
answers* is a product decision. This plan turns "reduce client questions" from a
per-form effort into a **repeatable, measurable system** that scales to all forms.

> The unit of work is NOT a form. It is a **client + their bundle** (`demandeType`
> → several IMMs). We optimize questions per client-journey, not per form.

---

## 1. The metric (build this first — you can't scale what you can't see)

For every client bundle, instrument the funnel from total fields → fields the client
actually types:

```
TOTAL fields in bundle
  − deduped across forms (shared externalId asked once)   [Lever A — built]
  − auto-filled by uploaded documents (OCR)               [Lever B — built, under-fed]
  − hidden by conditional logic (dependsOn)               [Lever C — supported, not wired]
  − (known from client profile / returning clients        [Lever D — DEFERRED, not now])
  − deferred (non-blocking → supplementRequest)           [built]
  = NET QUESTIONS TYPED   ← the number we drive down
```

Emit these counts from `getIntakeForClient` (it already computes the union; add the
breakdown). Target: **median net questions per bundle**, tracked over time. No change
ships unless this number moves or holds while coverage grows.

---

## 2. The four reduction levers, as systematic capabilities

Each lever is a *catalog/model capability*, not a per-form hack. Enrichment populates
them; the reduction engine consumes them.

### Lever A — Canonical semantic catalog (answer-once key) — FOUNDATION, mostly built
- Every question is a canonical semantic `externalId` (`firstName`, not `imm_<slug>`).
  Same ID across forms ⇒ asked once, reused everywhere.
- **Discipline:** never map to the ~691 legacy `imm_<frenchSlug>` IDs. Reuse-first;
  only create a gap when no semantic ID fits. (Verified: all enriched forms use 100%
  semantic IDs.)
- Action: keep the catalog clean; consider deprecating/migrating the `imm_` rows.

### Lever B — OCR autofill graph — built, UNDER-FED
- `documents.fills` maps an uploaded doc's extracted fields → `externalId`s. Passport
  fills 11 fields, national ID 3, marriage cert 2.
- **Bidirectional invariant:** every catalog question that *can* come from a document
  MUST be linked, and every `fills.externalId` MUST exist as a question. A validator
  enforces this (caught a live bug: `nationalIdDocument.fills` → `nationalIdValidity`,
  but the questions are `nationalIdIssueDate`/`ExpiryDate` — mismatch = no autofill).
- **Growth path:** expand the document catalog to cover more sections — work permit,
  LMIA/job-offer letter, diploma, employment-attestation, study permit. Each new
  OCR-able doc deletes a whole manual section across *every* form that uses those IDs.

### Lever C — Conditional graph (`dependsOn`) — supported, NOT wired ← biggest untapped win
- `questions.dependsOn = { questionId, value }` already exists and `getIntakeForClient`
  can honor it. Today's blobs don't set it, so every conditional shows unconditionally.
- **Auto-extractable:** XFA labels literally state the gate ("Si vous avez répondu Oui
  à la question 2A…"). ~28/254 fields on 5710 self-describe their parent; 22 yes/no
  gates open subtrees. A simple applicant skips 30–40 questions once wired.
- Action: enrichment parses `dependsOn` from labels → human reviews → store on the
  canonical question (so it applies on every form that reuses the ID).

### Lever D — Profile vs application scope — DEFERRED (not needed right now)
- Reuse a person's answers across *separate cases over time* (returning client starts a
  new application pre-filled). Same answer-once principle as Lever A, but across cases
  instead of within one bundle.
- **Out of scope for now** (decided 2026-06). Levers A–C deliver the bulk of the
  reduction within a single intake; profile-across-cases is a later add. Revisit once
  A–C are in place and returning-client volume justifies it.

---

## 3. The enrichment pipeline (the scalable engine) — productionize the 5710 proof

The 5710 run proved the mechanics. Turn it into a committed, repeatable SOP so any
form is a single command, and the output is **reduction-aware metadata**, not a flat
list. Scripts live in `scripts/intake/` (promote from the `/tmp` spike).

**Per-form recipe (replicable, ~same cost each, EN variants near-free):**
1. `extract-imm-xfa.mjs <url|pdf>` → labelled XFA fields (headless pdf.js, no Adobe).
2. `clean.mjs` → drop noise, collapse date triplets + repeating tables → multi-entry.
3. **Map (Claude-in-session):** each field → canonical `externalId`, **reuse-first**;
   emit `section`, `order`, `required`, **`dependsOn`** (from labels), **`ocrFillSource`**,
   **`scope`**. Flag gaps.
4. **Validate** (script gate, blocks the write):
   - every reuse ID exists & is canonical (no `imm_`, no firm-scope clobber)
   - every gap has a real `type` + options; multi-entry has fields
   - every `dependsOn.questionId` resolves to a question in the bundle
   - every `ocrFillSource` matches a `documents.fills` entry (bidirectional)
5. `seedCanonicalQuestions` (gaps) → `setImmQuestions` (blob w/ `requiredDocuments`).
6. Re-read & assert counts; record net-question metric for a synthetic simple applicant.

EN variant = reuse the FR IDs verbatim, translate only `label`/`section`. The catalog
and all four levers are language-independent (keyed by `externalId`).

---

## 4. Reduction engine (`getIntakeForClient` evolution)

Render set for a client =
```
( profile questions not yet known for this client )
  ∪ ( application questions for every IMM in the bundle, deduped by externalId )
  − ( questions an uploaded/expected document will OCR-fill )
  − ( questions hidden because their dependsOn parent isn't satisfied )
```
Plus: surface a **document-first step** ("upload passport, national ID…") *before*
questions, so OCR runs first and the question list is already pruned when shown.
Non-blocking leftovers → `supplementRequest` (defer, don't front-load).

---

## 5. Phased rollout (each phase is shippable and measured)

- **Phase 0 — Foundation (no client-visible change).**
  Confirm `dependsOn`/`ocrFill` plumbing in `getIntakeForClient`. Build the metric +
  breakdown. Commit pipeline to `scripts/intake/`. Add the OCR-fill bidirectional
  validator (fix the national-ID mismatch). *Exit: metric dashboard live; pipeline
  reproducible by command.*

- **Phase 1 — Prove on ONE full bundle (not one form).**
  Pick a real `demandeType` (e.g. a work-permit bundle). Enrich every IMM in it with
  Levers A–C. Measure net-questions for a synthetic simple applicant before/after.
  *Exit: documented ≥X% reduction on a real bundle; the recipe is unchanged per form.*

- **Phase 2 — Scale the catalog + OCR coverage.**
  Backfill the remaining ~37 forms via the pipeline (FR first, then EN reuse). Expand the
  document catalog so more sections become upload-instead-of-type. *Exit: all forms
  enriched + reduction-aware; OCR covers the high-frequency sections.*

- **Phase 3 — Continuous.**
  Every new IMM is one pipeline run; the metric guards against regressions; new OCR docs
  ratchet the number down further.

- **(Later — Lever D, deferred)** Profile reuse for returning clients across separate
  cases. Out of scope until A–C land and volume justifies it.

---

## 6. Guardrails / principles
- Legally-required IRCC fields are never dropped — only **deduped, auto-filled, hidden
  when N/A, or deferred**. The 96 is an upper bound nobody should hit.
- Semantic-ID discipline; reuse-first; validation gates block bad writes.
- Human review stays on the two judgment-heavy outputs: `dependsOn` correctness and new
  gap-question wording. Everything mechanical is automated.
- Optimize the **client-journey** metric (net questions per bundle), never per-form vanity.

---

### Status anchor (2026-06)
- IMM 5710 fr enriched end-to-end (96 intake Qs, 53 gap seeds, 5 required docs) — proves
  the pipeline mechanics. 6/44 forms enriched.
- **COUNTER BUILT (Phase 0 metric, live on dev).** `getIntakeForClient` now returns a
  `stats` object: `{ totalIntakeFields, uniqueAfterDedup, dedupSaved, ocrFillable,
  conditional, minClientAnswers, maxClientAnswers }` — the funnel, computed from data
  already fetched (no extra queries). Offline replica: `scripts/intake/counter.mjs`.
- **Finding from the counter:** sponsorship forms ALREADY have `dependsOn` populated
  (a real parrainage bundle hides ~82–95 questions via conditionals), so Lever C is
  partly done *for sponsorship*. The work-permit forms (5710) have almost none — so
  Lever C work is form-specific, and the counter shows exactly where it's missing.
- Live baseline examples: parrainage bundle (5 forms) 284→151 net; a real 3-form client
  (5476+1344+5532) 176→69 (simplest) … 162 (all shown); IMM 5710 solo 96→77.
- Next: Phase 1 — author `dependsOn` on a chosen bundle (auto-extract from XFA labels),
  re-measure `minClientAnswers` drop. See `legalDocuments.immQuestions` / `questions`.
