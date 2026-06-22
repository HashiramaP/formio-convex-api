import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireClientAccess,
  requireCurrentFirm,
  requireFirmAccess,
  AuthError,
} from "./auth";

// Form-website reads `getLegalDocumentsByIds`, `listGeneratedDocs`,
// `getGeneratedDocUrl`, `getLegalDocumentsByIds`, `listGeneratedDocsForClients`,
// `buildFillJobPayload` and writes `upsertGeneratedLegalDoc`. These all stay
// open because the URL (clientId / submissionId) is the bearer token.
// `deleteGeneratedDoc` and `setFieldMappings` are dashboard-only.

export const getLegalDocumentsByIds = query({
  args: { ids: v.array(v.id("legalDocuments")) },
  handler: async (ctx, { ids }) => {
    const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return docs.filter(Boolean);
  },
});

// The global canonical question universe — every distinct externalId any IMM's
// intake uses, enriched with its catalog label + type. This is the mapping
// target for the form-import audit: a firm's imported question maps to one of
// these canonical concepts, so its answer can pre-fill any IMM that uses it —
// independent of which IMMs are in the demande type.
export const getCanonicalQuestionUniverse = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("legalDocuments").collect();
    const ids = new Set<string>();
    for (const ld of all) {
      const m = ld.immQuestions as ImmIntakeMapping | undefined;
      if (!m || !Array.isArray(m.intakeQuestions)) continue;
      for (const q of m.intakeQuestions) if (q.externalId) ids.add(q.externalId);
    }
    const out = await Promise.all(
      Array.from(ids).map(async (ext) => {
        const c = await ctx.db
          .query("questions")
          .withIndex("by_externalId", (q) => q.eq("externalId", ext))
          .first();
        return {
          externalId: ext,
          label: (c?.shortLabel ?? c?.label ?? ext) as string,
          type: (c?.type ?? "text") as string,
        };
      }),
    );
    return out;
  },
});

export const listLegalDocuments = query({
  args: { language: v.optional(v.string()) },
  handler: async (ctx, { language }) => {
    if (language) {
      return await ctx.db
        .query("legalDocuments")
        .withIndex("by_language", (q) => q.eq("language", language))
        .collect();
    }
    return await ctx.db.query("legalDocuments").collect();
  },
});

export const listGeneratedDocsForClients = query({
  args: { clientIds: v.array(v.id("clients")) },
  handler: async (ctx, { clientIds }) => {
    const results: Record<
      string,
      Array<{ legalDocumentId: string; status: string }>
    > = {};

    for (const clientId of clientIds) {
      const docs = await ctx.db
        .query("generatedLegalDocs")
        .withIndex("by_client_doc", (q) => q.eq("clientId", clientId))
        .collect();

      if (docs.length > 0) {
        results[clientId] = docs.map((d) => ({
          legalDocumentId: d.legalDocumentId,
          status: d.status,
        }));
      }
    }

    return results;
  },
});

export const listGeneratedDocs = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    return await ctx.db
      .query("generatedLegalDocs")
      .withIndex("by_client_doc", (q) => q.eq("clientId", clientId))
      .collect();
  },
});

export const getGeneratedDocUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

export const deleteGeneratedDoc = mutation({
  args: {
    clientId: v.id("clients"),
    legalDocumentId: v.id("legalDocuments"),
  },
  handler: async (ctx, { clientId, legalDocumentId }) => {
    await requireClientAccess(ctx, clientId);
    const existing = await ctx.db
      .query("generatedLegalDocs")
      .withIndex("by_client_doc", (q) =>
        q.eq("clientId", clientId).eq("legalDocumentId", legalDocumentId),
      )
      .unique();

    if (existing) {
      if (existing.storageId) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.delete(existing._id);
    }
  },
});

// Slice 1 spike — stash the answer-key → XFA-leaf-name mapping on the
// legalDocuments row as a throwaway `v.any()` blob. Slice 2 replaces this
// with a proper `legalDocumentFields` table (see FormioInfra/ROADMAP.md).
//
// Expected shape:
//   {
//     template: "imm5710f",   // calibration filename stem
//     fields: [
//       { answerKey: "firstName",   calibrationName: "GivenName[0]" },
//       { answerKey: "dateOfBirth", calibrationName: "DOBDay[0]", transform: "dateDay" },
//       ...
//     ]
//   }
//
// Supported transforms: "dateYear" | "dateMonth" | "dateDay" (split ISO YYYY-MM-DD).
// Absent transform = identity (use the answer value as-is, coerced to string).
export const setFieldMappings = mutation({
  args: {
    legalDocumentId: v.id("legalDocuments"),
    fieldMappings: v.any(),
  },
  handler: async (ctx, { legalDocumentId, fieldMappings }) => {
    // Dashboard-only setup; legalDocuments rows are global catalog entries so
    // any authenticated firm member can edit them (matches existing behavior).
    // Tighten to admin-only once the catalog moves to admin-website.
    await requireCurrentFirm(ctx);
    await ctx.db.patch(legalDocumentId, { fieldMappings });
  },
});

function applyTransform(raw: unknown, transform?: string): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const s = String(raw);
  if (!transform) return s;
  // ISO YYYY-MM-DD splitters. Returns null on bad shape so the field is
  // omitted from the values dict (vs. typing garbage into the PDF).
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  if (transform === "dateYear") return m[1];
  if (transform === "dateMonth") return m[2];
  if (transform === "dateDay") return m[3];
  return null;
}

// Builds the Pub/Sub job payload for the IRCC fill worker. Reads the latest
// submission with non-empty answers for the given client and projects the
// fields declared in the legalDocument's `fieldMappings`.
//
// Returns null if no mapping exists or no submission with answers — caller
// (spike-publish script) surfaces the reason to the user.
export const buildFillJobPayload = query({
  args: {
    clientId: v.id("clients"),
    legalDocumentId: v.id("legalDocuments"),
  },
  handler: async (ctx, { clientId, legalDocumentId }) => {
    const legalDoc = await ctx.db.get(legalDocumentId);
    if (!legalDoc) return { error: "legalDocument not found" };
    const mapping = legalDoc.fieldMappings as
      | { template: string; fields: Array<{ answerKey: string; calibrationName: string; transform?: string }> }
      | undefined;
    if (!mapping || !mapping.template || !Array.isArray(mapping.fields)) {
      return { error: "legalDocument has no fieldMappings" };
    }

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const withAnswers = submissions.filter((s) => s.answers && Object.keys(s.answers).length > 0);
    if (withAnswers.length === 0) {
      return { error: "client has no submission with answers" };
    }
    withAnswers.sort((a, b) => b._creationTime - a._creationTime);
    const sub = withAnswers[0];
    const answers = sub.answers as Record<string, unknown>;

    const values: Record<string, string> = {};
    const skipped: Array<{ calibrationName: string; reason: string }> = [];
    for (const f of mapping.fields) {
      const raw = answers[f.answerKey];
      const out = applyTransform(raw, f.transform);
      if (out === null) {
        skipped.push({ calibrationName: f.calibrationName, reason: `answer "${f.answerKey}"=${raw === undefined ? "missing" : "empty/bad"}` });
        continue;
      }
      values[f.calibrationName] = out;
    }

    const jobId = `spike-${clientId.slice(-8)}-${legalDocumentId.slice(-8)}-${Date.now()}`;
    const sourcePdfPath = `C:\\Users\\adminuser\\Desktop\\adobe_fill\\${mapping.template}.pdf`;

    return {
      payload: {
        jobId,
        template: mapping.template,
        sourcePdfPath,
        values,
        uploadToConvex: true,
        clientId,
        legalDocumentId,
      },
      submissionId: sub._id,
      skipped,
    };
  },
});

export const upsertGeneratedLegalDoc = mutation({
  args: {
    clientId: v.id("clients"),
    legalDocumentId: v.id("legalDocuments"),
    storageId: v.optional(v.id("_storage")),
    status: v.string(),
  },
  handler: async (ctx, { clientId, legalDocumentId, storageId, status }) => {
    const existing = await ctx.db
      .query("generatedLegalDocs")
      .withIndex("by_client_doc", (q) =>
        q.eq("clientId", clientId).eq("legalDocumentId", legalDocumentId),
      )
      .unique();

    if (existing) {
      const update: Record<string, unknown> = { status };
      if (storageId !== undefined) update.storageId = storageId;
      await ctx.db.patch(existing._id, update);
      return existing._id;
    }

    return await ctx.db.insert("generatedLegalDocs", {
      clientId,
      legalDocumentId,
      storageId,
      status,
    });
  },
});

// IMM-indexed intake — Slice 2 path. The legacy XFA-dump in `immQuestions`
// is replaced with a structured shape that declares which intake questions
// (by externalId from the canonical `questions` catalog) the IMM consumes,
// plus which client-uploaded documents it requires. Firm-side and
// system-derived fields are tracked for documentation but are filled
// outside the intake flow (firm profile, computed at submission, etc.).
//
// Expected shape on `legalDocuments.immQuestions`:
//   {
//     intakeQuestions: [
//       { externalId: "lastName", label?: string, required?: boolean,
//         section?: string, page?: number, order?: number }
//     ],
//     requiredDocuments: [
//       { key: "passport", label?: string, required?: boolean }
//     ],
//     firmFields?: Array<{ label, page, section, ... }>,    // doc only
//     systemFields?: Array<{ label, kind: "signature"|"computed", ... }>  // doc only
//   }
type ImmIntakeMapping = {
  intakeQuestions: Array<{
    externalId: string;
    label?: string;
    required?: boolean;
    section?: string;
    page?: number;
    order?: number;
    // Per-form conditional visibility. Overrides the canonical question's
    // dependsOn for THIS form — so a question can be gated on one form and
    // unconditional on another (the canonical dependsOn leaks across all
    // forms). See INTAKE-REDUCTION-PLAN.md (Lever C).
    dependsOn?: unknown;
  }>;
  requiredDocuments: Array<{
    key: string;
    label?: string;
    required?: boolean;
  }>;
  firmFields?: unknown;
  systemFields?: unknown;
};

export const setImmQuestions = mutation({
  args: {
    legalDocumentId: v.id("legalDocuments"),
    immQuestions: v.any(),
  },
  handler: async (ctx, { legalDocumentId, immQuestions }) => {
    // Open during the Slice 2 spike so the seed can run via `convex run`
    // with just the admin key (no JWT). Wrap with `requireCurrentFirm`
    // once the dashboard catalog editor lands and the seed moves there.
    await ctx.db.patch(legalDocumentId, { immQuestions });
  },
});

// Slice 2 spike helper — attach IMMs to a client without going through
// `updateClient` (which requires a firmId arg + JWT auth). Used by the
// CLI seed scripts to wire test clients up to specific IMMs. Drop or
// wrap with auth once the dashboard's client editor exposes this.
export const attachLegalDocsForSpike = mutation({
  args: {
    clientId: v.id("clients"),
    legalDocuments: v.array(v.id("legalDocuments")),
  },
  handler: async (ctx, { clientId, legalDocuments }) => {
    await ctx.db.patch(clientId, { legalDocuments });
  },
});

// Dynamic intake generator — given a client, computes the union of intake
// questions and required documents from every IMM in their
// `clients.legalDocuments[]`. Each question is enriched from the canonical
// `questions` catalog so the frontend has full metadata (type, options,
// validationRules, etc.) without a second round-trip.
//
// Dedup rules: questions deduped by externalId, first IMM wins for source
// metadata (section/page/order). Required flag is the OR across IMMs.
// Documents deduped by key, required is OR.
//
// Open to the anonymous form-website (URL clientId is the bearer token).
// Shared bundle builder — the deduped, catalog-enriched, category-sorted union
// of intake questions + required documents for a set of IMMs. Pure read; no
// filtering or override logic. Used by getIntakeForClient (client-facing,
// filtered) and getIntakeCatalogForDemandeType (curation UI, annotated) so the
// two never drift. `firmId` scopes document catalog lookups to firm overrides.
async function buildIntakeUnion(
  ctx: QueryCtx,
  legalDocIds: Array<Id<"legalDocuments">>,
  firmId: Id<"firms"> | undefined,
) {
  const legalDocs = await Promise.all(legalDocIds.map((id) => ctx.db.get(id)));

  // Dedup buckets keyed by externalId / document key.
  const questionsByExt = new Map<
    string,
    { externalId: string; required: boolean; section?: string; page?: number; order?: number; sourcedFrom: string[]; formDependsOn?: unknown }
  >();
  const documentsByKey = new Map<
    string,
    { key: string; label?: string; required: boolean; sourcedFrom: string[] }
  >();

  // Raw field count before any reduction (powers the `stats` funnel).
  let totalIntakeFields = 0;

  for (const ld of legalDocs) {
    if (!ld) continue;
    const mapping = ld.immQuestions as ImmIntakeMapping | undefined;
    if (!mapping || !Array.isArray(mapping.intakeQuestions)) continue;

    for (const q of mapping.intakeQuestions) {
      const ext = q.externalId;
      if (!ext) continue;
      totalIntakeFields++;
      const existing = questionsByExt.get(ext);
      if (existing) {
        existing.required = existing.required || !!q.required;
        existing.sourcedFrom.push(ld.name ?? ld._id);
        // First IMM with an explicit per-form dependsOn wins (consistent with
        // section/page/order first-wins above).
        if (existing.formDependsOn === undefined && q.dependsOn !== undefined) {
          existing.formDependsOn = q.dependsOn;
        }
      } else {
        questionsByExt.set(ext, {
          externalId: ext,
          required: !!q.required,
          section: q.section,
          page: q.page,
          order: q.order,
          sourcedFrom: [ld.name ?? ld._id],
          formDependsOn: q.dependsOn,
        });
      }
    }

    const reqDocs = Array.isArray(mapping.requiredDocuments) ? mapping.requiredDocuments : [];
    for (const d of reqDocs) {
      const key = d.key;
      if (!key) continue;
      const existing = documentsByKey.get(key);
      if (existing) {
        existing.required = existing.required || !!d.required;
        existing.sourcedFrom.push(ld.name ?? ld._id);
      } else {
        documentsByKey.set(key, {
          key,
          label: d.label,
          required: !!d.required,
          sourcedFrom: [ld.name ?? ld._id],
        });
      }
    }
  }

  // Enrich question stubs with full catalog metadata. A missing entry means
  // the IMM mapping references an externalId that doesn't exist in the
  // questions table — surface it (missingFromCatalog) rather than silently
  // dropping the question.
  const enrichedQuestions = await Promise.all(
    Array.from(questionsByExt.values()).map(async (stub) => {
      const catalog = await ctx.db
        .query("questions")
        .withIndex("by_externalId", (q) => q.eq("externalId", stub.externalId))
        .first();
      return { ...stub, catalog: catalog ?? null, missingFromCatalog: !catalog };
    }),
  );

  // Category-based grouping: when a question has `catalog.category`, use the
  // canonical CATEGORY_ORDER to position it and override `section` with the
  // category's display title. Uncategorized questions fall back to the per-IMM
  // `section` and sort after categorized ones.
  const categoryIndex = new Map(
    CATEGORY_ORDER.map((c, i) => [c.key, { idx: i, title: c.title }]),
  );

  enrichedQuestions.sort((a, b) => {
    const aCat = a.catalog?.category as string | undefined;
    const bCat = b.catalog?.category as string | undefined;
    const aMeta = aCat ? categoryIndex.get(aCat) : undefined;
    const bMeta = bCat ? categoryIndex.get(bCat) : undefined;
    const aPos = aMeta ? aMeta.idx : Number.MAX_SAFE_INTEGER;
    const bPos = bMeta ? bMeta.idx : Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) return aPos - bPos;
    const aSort = (a.catalog?.categorySort as number | undefined) ?? Number.MAX_SAFE_INTEGER;
    const bSort = (b.catalog?.categorySort as number | undefined) ?? Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.externalId.localeCompare(b.externalId);
  });

  // Rewrite `section` for categorized questions to the category title; compute
  // effective dependsOn (per-form overrides the canonical question's).
  const finalQuestions = enrichedQuestions.map((q) => {
    const cat = q.catalog?.category as string | undefined;
    const meta = cat ? categoryIndex.get(cat) : undefined;
    const dependsOn = q.formDependsOn ?? q.catalog?.dependsOn ?? undefined;
    const base = { ...q, dependsOn };
    return meta ? { ...base, section: meta.title } : base;
  });

  // Enrich each required-document stub with the full catalog config.
  const enrichedDocuments = await Promise.all(
    Array.from(documentsByKey.values()).map(async (stub) => {
      const catalog = await resolveDocCatalog(ctx, stub.key, firmId);
      return { ...stub, catalog, missingFromCatalog: !catalog };
    }),
  );

  return { legalDocs, finalQuestions, enrichedDocuments, totalIntakeFields };
}

// Resolve a document key to its catalog config, preferring a firm-scoped
// override over the canonical (firmId undefined) entry.
async function resolveDocCatalog(
  ctx: QueryCtx,
  key: string,
  firmId: Id<"firms"> | undefined,
) {
  const candidates = await ctx.db
    .query("documents")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect();
  const firmScoped = firmId ? candidates.find((d) => d.firmId === firmId) : undefined;
  const canonical = candidates.find((d) => d.firmId === undefined);
  return firmScoped ?? canonical ?? null;
}

type DocOverride = {
  removed?: string[];
  added?: Array<{ key: string; label?: string; required?: boolean; custom?: boolean }>;
  descriptions?: Record<string, string>;
};

// Apply a firm's per-demande-type document overrides to the IMM-derived base
// list: drop `removed` keys, append `added` docs (catalog-enriched unless they
// are `custom` firm-defined labels with no OCR config), and attach the firm's
// per-doc `description` (shown under the doc name in the wizard).
async function applyDocOverrides<T extends { key: string }>(
  ctx: QueryCtx,
  baseDocs: T[],
  override: DocOverride | undefined,
  firmId: Id<"firms"> | undefined,
) {
  const removed = new Set(override?.removed ?? []);
  const descriptions = override?.descriptions ?? {};
  const docs: Array<Record<string, unknown>> = baseDocs.filter((d) => !removed.has(d.key));
  for (const a of override?.added ?? []) {
    if (docs.some((d) => d.key === a.key)) continue;
    const catalog = a.custom ? null : await resolveDocCatalog(ctx, a.key, firmId);
    docs.push({
      key: a.key,
      label: a.label ?? catalog?.name,
      required: a.required !== false,
      sourcedFrom: ["(ajouté par le cabinet)"],
      catalog,
      missingFromCatalog: !a.custom && !catalog,
      custom: !!a.custom,
      added: true,
    });
  }
  for (const d of docs) {
    const desc = descriptions[d.key as string];
    if (desc) d.description = desc;
  }
  return docs;
}

// Guidance fields that can be reworded per demande type (sparse override).
const GUIDANCE_FIELDS = [
  "shortLabel",
  "label",
  "indication",
  "example",
  "help",
  "placeholder",
  "whyImportantReason",
  "whyImportantConsequence",
  "successMessage",
  "options",
] as const;

type QuestionOverride = {
  labels?: Record<string, string>;
  required?: Record<string, boolean>;
  guidance?: Record<string, Record<string, unknown>>;
  dependsOn?: Record<string, unknown>;
  order?: string[];
  ocrFill?: Record<string, { docKey: string }>;
  added?: Array<{
    externalId: string;
    custom?: boolean;
    label?: string;
    type?: string;
    options?: unknown;
    required?: boolean;
  }>;
};

// Apply a firm's per-demande-type QUESTION edits: reword the display label,
// reword any guidance field (indication/example/help/…) per demande type,
// override required, and inject added questions. All sparse: a field not
// overridden falls back to the canonical Formio text. Composition, never
// definition — the canonical row is never mutated.
async function applyQuestionOverrides(
  ctx: QueryCtx,
  questions: any[],
  override: QuestionOverride | undefined,
) {
  const labels = override?.labels ?? {};
  const requiredOv = override?.required ?? {};
  const guidanceMap = override?.guidance ?? {};
  const dependsOnMap = override?.dependsOn ?? {};
  const out: any[] = questions.map((q) => {
    const ext = q.externalId as string;
    const lbl = labels[ext];
    const reqOv = requiredOv[ext];
    const g = guidanceMap[ext];
    const depOv = dependsOnMap[ext];
    let catalog = q.catalog as Record<string, unknown> | null;
    let originalLabel: string | undefined;
    const overriddenFields: string[] = [];
    const originals: Record<string, unknown> = {};

    if (catalog) {
      // Legacy quick-relabel sets both short + full label.
      if (lbl) {
        originalLabel = (catalog.shortLabel ?? catalog.label) as string | undefined;
        catalog = { ...catalog, label: lbl, shortLabel: lbl };
      }
      // Sparse per-field guidance overrides win over the canonical text.
      if (g) {
        const next = { ...catalog };
        for (const f of GUIDANCE_FIELDS) {
          if (g[f] !== undefined) {
            originals[f] = (catalog as Record<string, unknown>)[f];
            next[f] = g[f];
            overriddenFields.push(f);
          }
        }
        catalog = next;
      }
    }
    return {
      ...q,
      catalog,
      required: reqOv !== undefined ? reqOv : q.required,
      dependsOn: depOv !== undefined ? depOv : q.dependsOn,
      relabeled: !!lbl,
      overriddenFields,
      ...(Object.keys(originals).length ? { originalGuidance: originals } : {}),
      ...(originalLabel ? { originalLabel } : {}),
    };
  });

  // Merge a question's guidance override (indication, example, help, …) onto a
  // catalog object. Used for added questions so their edited guidance shows in
  // the wizard, exactly like base IMM questions.
  const mergeGuidance = (cat: any, ext: string) => {
    const g = guidanceMap[ext];
    if (!cat || !g) return cat;
    const next = { ...cat };
    for (const f of GUIDANCE_FIELDS) if (g[f] !== undefined) next[f] = g[f];
    return next;
  };

  const present = new Set(out.map((q) => q.externalId as string));
  for (const a of override?.added ?? []) {
    if (present.has(a.externalId)) continue;
    present.add(a.externalId);
    if (a.custom) {
      const base = {
        externalId: a.externalId,
        label: a.label ?? a.externalId,
        shortLabel: a.label ?? a.externalId,
        type: a.type ?? "text",
        options: a.options ?? undefined,
        isRequired: !!a.required,
      };
      out.push({
        externalId: a.externalId,
        required: !!a.required,
        section: "Questions ajoutées par le cabinet",
        sourcedFrom: ["(ajouté par le cabinet)"],
        catalog: mergeGuidance(base, a.externalId),
        missingFromCatalog: false,
        dependsOn: dependsOnMap[a.externalId] ?? undefined,
        added: true,
        custom: true,
        informational: true,
      });
    } else {
      const cat = await ctx.db
        .query("questions")
        .withIndex("by_externalId", (qq) => qq.eq("externalId", a.externalId))
        .first();
      out.push({
        externalId: a.externalId,
        required: a.required !== undefined ? !!a.required : !!cat?.isRequired,
        section: "Questions ajoutées par le cabinet",
        sourcedFrom: ["(ajouté par le cabinet)"],
        catalog: mergeGuidance(cat ?? null, a.externalId),
        missingFromCatalog: !cat,
        dependsOn: dependsOnMap[a.externalId] ?? cat?.dependsOn ?? undefined,
        added: true,
        custom: false,
      });
    }
  }
  return out;
}

// Apply the firm's custom ordering (full list of externalIds). Listed questions
// take their position; unlisted (e.g. newly added) keep their relative default
// order, appended after. Stable.
function applyQuestionOrder(questions: any[], order: string[] | undefined) {
  if (!order || order.length === 0) return questions;
  const idx = new Map(order.map((e, i) => [e, i]));
  return [...questions].sort((a, b) => {
    const ai = idx.has(a.externalId) ? (idx.get(a.externalId) as number) : Number.MAX_SAFE_INTEGER;
    const bi = idx.has(b.externalId) ? (idx.get(b.externalId) as number) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

// Inject firm OCR-fill wiring. Each entry {externalId → {docKey}} attaches a
// question to a document: the question itself becomes a new extracted field.
// At query time we (1) add a fill (sourceKey = externalId → fills the question)
// and (2) augment that document's OCR prompt with an instruction to extract the
// question (using its label). Scoped to this demande type — the canonical
// documents row is never modified. This lets firms add new extractable fields
// just by attaching a question to a document.
function applyOcrFillOverrides(
  documents: any[],
  ocrFill: Record<string, { docKey: string }> | undefined,
  labelOf: (externalId: string) => string,
) {
  if (!ocrFill || Object.keys(ocrFill).length === 0) return documents;
  const byDoc = new Map<string, string[]>(); // docKey → externalIds
  for (const [externalId, f] of Object.entries(ocrFill)) {
    if (!byDoc.has(f.docKey)) byDoc.set(f.docKey, []);
    byDoc.get(f.docKey)!.push(externalId);
  }
  return documents.map((d) => {
    const exts = byDoc.get(d.key);
    if (!exts) return d;
    const existingCat = d.catalog as any | null;
    const existing = (existingCat?.fills ?? []) as any[];
    const have = new Set(existing.map((f) => f.externalId));
    const fresh = exts.filter((e) => !have.has(e));
    if (fresh.length === 0) return d;

    const extraFills = fresh.map((ext) => ({
      sourceKey: ext, // Gemini returns this key (named after the question)
      externalId: ext,
      displayLabel: labelOf(ext),
      firmAdded: true,
    }));
    const docName = d.label ?? existingCat?.name ?? d.key;
    // Custom docs have no OCR config — synthesize a minimal one so the question
    // drives extraction. Known catalog docs keep their tailored prompt.
    const basePrompt =
      existingCat?.prompt ?? `Examine cette image de document (« ${docName} »).`;
    const lines = fresh.map((ext) => `- "${ext}": ${labelOf(ext)}`).join("\n");
    const augmentedPrompt =
      basePrompt +
      `\n\nEn plus, si le document contient ces renseignements, extrais-les et ` +
      `réponds avec EXACTEMENT ces clés JSON (valeur null si absent du document) :\n${lines}`;

    const baseCat =
      existingCat ?? {
        key: d.key,
        name: docName,
        expectedDocumentType: docName,
        skipNameVerification: true, // a custom doc isn't tied to the applicant's name
      };
    return {
      ...d,
      catalog: { ...baseCat, prompt: augmentedPrompt, fills: [...existing, ...extraFills] },
    };
  });
}

// Compute a compact, denormalized snapshot of the questions a client's intake
// currently shows — externalId + label + type + section + order + options. Run
// the SAME pipeline as getIntakeForClient (union → merge overrides → filter
// disabled → order) so the snapshot matches exactly what the client sees. Used
// by completeSubmission to freeze the intake at submit time, so the responses
// view never drifts when the demande type is edited afterward.
export async function computeClientIntakeSnapshot(
  ctx: QueryCtx,
  clientId: Id<"clients">,
): Promise<Array<Record<string, unknown>>> {
  const client = await ctx.db.get(clientId);
  if (!client) return [];
  const legalDocIds = client.legalDocuments ?? [];
  if (legalDocIds.length === 0 && !client.demandeTypeId) return [];

  const { finalQuestions } = await buildIntakeUnion(ctx, legalDocIds, client.firmId);
  const firm = client.firmId ? await ctx.db.get(client.firmId) : null;
  const demandeTypeId = client.demandeTypeId;
  const firmDisabled = new Set<string>(
    demandeTypeId ? firm?.intakeDisabledFields?.[demandeTypeId] ?? [] : [],
  );
  const overrides = (client.intakeFieldOverrides ?? {}) as Record<string, string>;
  const isDisabled = (ext: string) => {
    const o = overrides[ext];
    if (o === "ask") return false;
    if (o === "skip") return true;
    return firmDisabled.has(ext);
  };
  const qOverride = demandeTypeId
    ? (firm?.intakeQuestionOverrides?.[demandeTypeId] as QuestionOverride | undefined)
    : undefined;
  const merged = await applyQuestionOverrides(ctx, finalQuestions, qOverride);
  const shown = applyQuestionOrder(
    merged.filter((q: any) => !isDisabled(q.externalId)),
    qOverride?.order,
  );
  return shown.map((q: any) => {
    const cat = q.catalog ?? {};
    return {
      externalId: q.externalId,
      label: cat.shortLabel ?? cat.label ?? q.externalId,
      type: cat.type ?? "text",
      section: q.section ?? cat.section ?? "Autre",
      options: cat.options ?? undefined,
      multiEntryFields: cat.multiEntryFields ?? undefined,
      dependsOn: q.dependsOn ?? undefined,
    };
  });
}

// Dynamic intake generator — given a client, computes the union of intake
// questions and required documents from every IMM in their
// `clients.legalDocuments[]`, then filters out questions the firm/client
// disabled (intake curation) and applies the firm's question + document overrides.
//
// Open to the anonymous form-website (URL clientId is the bearer token).
export const getIntakeForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return { error: "client not found" as const };

    const legalDocIds = client.legalDocuments ?? [];
    // No IMMs AND no demande type → truly nothing to ask. (A demande type with
    // only firm-added custom questions still has an intake, so we must not bail
    // when demandeTypeId is set even if legalDocuments is empty.)
    if (legalDocIds.length === 0 && !client.demandeTypeId) {
      return { questions: [], documents: [], imms: [] };
    }

    const { legalDocs, finalQuestions, enrichedDocuments, totalIntakeFields } =
      await buildIntakeUnion(ctx, legalDocIds, client.firmId);

    // Effective disabled set: firm default (per demande type) overlaid with
    // per-client overrides. A client with no demande type has no firm default
    // → nothing disabled (everything asked).
    const firm = client.firmId ? await ctx.db.get(client.firmId) : null;
    const demandeTypeId = client.demandeTypeId;
    const firmDisabled = new Set<string>(
      demandeTypeId ? firm?.intakeDisabledFields?.[demandeTypeId] ?? [] : [],
    );
    const overrides = (client.intakeFieldOverrides ?? {}) as Record<string, string>;
    const isDisabled = (ext: string) => {
      const o = overrides[ext];
      if (o === "ask") return false;
      if (o === "skip") return true;
      return firmDisabled.has(ext);
    };
    // Question edits: reword/required-override + inject added (catalog/custom).
    const qOverride = demandeTypeId
      ? (firm?.intakeQuestionOverrides?.[demandeTypeId] as QuestionOverride | undefined)
      : undefined;
    // Merge first (IMM questions relabeled + firm-added custom/catalog questions),
    // THEN filter disabled — so a disabled CUSTOM question is dropped too (it's
    // injected by applyQuestionOverrides, after the IMM list, so filtering the
    // IMM list alone would miss it).
    const mergedQuestions = await applyQuestionOverrides(ctx, finalQuestions, qOverride);
    const shownQuestions = applyQuestionOrder(
      mergedQuestions.filter((q: any) => !isDisabled(q.externalId)),
      qOverride?.order,
    );
    const disabledCount = mergedQuestions.length - shownQuestions.length;

    // Documents: apply the firm's per-demande-type add/remove overrides.
    const docOverride = demandeTypeId
      ? (firm?.requiredDocOverrides?.[demandeTypeId] as DocOverride | undefined)
      : undefined;
    const labelOf = (ext: string) => {
      const q = shownQuestions.find((x: any) => x.externalId === ext);
      return (q?.catalog?.label ?? q?.catalog?.shortLabel ?? ext) as string;
    };
    const effectiveDocuments = applyOcrFillOverrides(
      await applyDocOverrides(ctx, enrichedDocuments, docOverride, client.firmId),
      qOverride?.ocrFill,
      labelOf,
    );

    // Intake-reduction funnel — computed on the questions the client actually
    // sees (post-disable). A question is removable when an uploaded document
    // OCR-fills it or it's conditional (`dependsOn`).
    const ocrFillIds = new Set<string>();
    for (const d of effectiveDocuments) {
      const fills = ((d.catalog as { fills?: Array<{ externalId?: string }> } | null)?.fills ?? []);
      for (const f of fills) if (f.externalId) ocrFillIds.add(f.externalId);
    }
    const ocrFillable = new Set(
      shownQuestions.filter((q) => ocrFillIds.has(q.externalId)).map((q) => q.externalId),
    );
    const conditional = new Set(
      shownQuestions.filter((q) => q.dependsOn).map((q) => q.externalId),
    );
    const removable = new Set([...ocrFillable, ...conditional]);
    const stats = {
      totalIntakeFields,
      uniqueAfterDedup: finalQuestions.length,
      dedupSaved: totalIntakeFields - finalQuestions.length,
      disabledCount,
      ocrFillable: ocrFillable.size,
      conditional: conditional.size,
      minClientAnswers: shownQuestions.length - removable.size,
      maxClientAnswers: shownQuestions.length,
    };

    return {
      questions: shownQuestions,
      documents: effectiveDocuments,
      imms: legalDocs.filter(Boolean).map((d) => ({
        _id: d!._id,
        name: d!.name,
        language: d!.language,
      })),
      stats,
    };
  },
});

// Curation source for the demande-type detail UI. Returns EVERY intake question
// in the bundle (not filtered) annotated with its `disabled` state, the
// effective required documents (after overrides), and the document catalog
// available to add. Dashboard-only → firm-scoped.
export const getIntakeCatalogForDemandeType = query({
  args: { firmId: v.id("firms"), demandeTypeId: v.id("demandeTypes") },
  handler: async (ctx, { firmId, demandeTypeId }) => {
    await requireFirmAccess(ctx, firmId);
    const dt = await ctx.db.get(demandeTypeId);
    if (!dt) return { error: "demandeType not found" as const };

    const { legalDocs, finalQuestions, enrichedDocuments } = await buildIntakeUnion(
      ctx,
      dt.legalDocumentIds,
      firmId,
    );

    const firm = await ctx.db.get(firmId);
    const firmDisabled = new Set<string>(
      firm?.intakeDisabledFields?.[demandeTypeId] ?? [],
    );
    // Editor gets the RAW union + the raw override (below) and merges client-
    // side — so relabel/required/added edits apply optimistically. The wizard
    // query is the one that returns the pre-merged view.
    const qOverride = firm?.intakeQuestionOverrides?.[demandeTypeId] as
      | QuestionOverride
      | undefined;
    const questions = finalQuestions.map((q) => ({
      ...q,
      disabled: firmDisabled.has(q.externalId),
    }));

    // Return the IMM-derived base + the saved override (not the computed
    // effective list): the editor reconstructs add/remove from these so a
    // removed base doc is still re-addable, and a base doc dropped by an
    // override is still visible to un-remove. (getIntakeForClient does the
    // collapsing for the wizard.)
    const docOverride = (firm?.requiredDocOverrides?.[demandeTypeId] as DocOverride | undefined) ?? {
      removed: [],
      added: [],
    };

    // Catalog of documents the firm can add (canonical + firm-scoped, deduped
    // by key, firm wins) — feeds the "+ Ajouter un document" picker.
    const allDocs = await ctx.db.query("documents").collect();
    const byKey = new Map<string, { key: string; name: string }>();
    for (const d of allDocs) {
      if (d.firmId !== undefined && d.firmId !== firmId) continue;
      const existing = byKey.get(d.key);
      if (!existing || d.firmId === firmId) byKey.set(d.key, { key: d.key, name: d.name });
    }

    // "Add from catalog" universe: every intake question any IMM asks, minus the
    // ones already in this type's list. Bounded + searchable; lets a firm pull
    // in a mapped question its bundle doesn't already cover.
    const presentIds = new Set(questions.map((q) => q.externalId as string));
    const universe = new Set<string>();
    const allLegal = await ctx.db.query("legalDocuments").collect();
    for (const ld of allLegal) {
      const m = ld.immQuestions as ImmIntakeMapping | undefined;
      if (!m || !Array.isArray(m.intakeQuestions)) continue;
      for (const iq of m.intakeQuestions) {
        if (iq.externalId && !presentIds.has(iq.externalId)) universe.add(iq.externalId);
      }
    }
    const questionCatalog = await Promise.all(
      Array.from(universe).map(async (ext) => {
        const c = await ctx.db
          .query("questions")
          .withIndex("by_externalId", (q) => q.eq("externalId", ext))
          .first();
        return {
          externalId: ext,
          label: (c?.shortLabel ?? c?.label ?? ext) as string,
          type: (c?.type ?? "text") as string,
        };
      }),
    );

    // Effective documents = IMM-derived + firm add/remove overrides (so a
    // document added in the ③ tab is usable as an OCR source here too).
    const effectiveDocsForOcr = await applyDocOverrides(
      ctx,
      enrichedDocuments,
      docOverride,
      firmId,
    );
    // Inject firm OCR-fill wiring so the indicator reflects firm-added fills too.
    const labelOf = (ext: string) => {
      const q = questions.find((x: any) => x.externalId === ext);
      return (q?.catalog?.label ?? q?.catalog?.shortLabel ?? ext) as string;
    };
    const docsWithOcr = applyOcrFillOverrides(effectiveDocsForOcr, qOverride?.ocrFill, labelOf);

    // OCR auto-fill map: which question externalId is filled by which document.
    // Read-only — surfaces "this question is auto-filled by [Passeport]".
    const ocrFilledBy: Record<string, string> = {};
    for (const d of docsWithOcr) {
      const cat = d.catalog as { name?: string; fills?: Array<{ externalId?: string }> } | null;
      const docName = d.label ?? cat?.name ?? d.key;
      for (const f of cat?.fills ?? []) {
        if (f.externalId && !ocrFilledBy[f.externalId]) ocrFilledBy[f.externalId] = docName;
      }
    }

    // OCR sources: every document in the bundle — catalog OR custom (extraction
    // is dynamic: the question's label is the instruction, and custom docs get a
    // synthesized prompt). The picker just lists these documents.
    const ocrSources = effectiveDocsForOcr.map((d) => ({
      docKey: d.key as string,
      docName: (d.label ?? (d.catalog as any)?.name ?? d.key) as string,
    }));

    return {
      demandeType: { _id: dt._id, name: dt.name },
      questions,
      // Raw disabled set (externalIds) so the editor seeds disabled state for
      // ALL questions — IMM AND firm-added custom (which aren't in `questions`).
      disabledExternalIds: [...firmDisabled],
      ocrFilledBy,
      ocrSources,
      questionOverride: {
        labels: qOverride?.labels ?? {},
        required: qOverride?.required ?? {},
        guidance: qOverride?.guidance ?? {},
        dependsOn: qOverride?.dependsOn ?? {},
        order: qOverride?.order ?? [],
        ocrFill: qOverride?.ocrFill ?? {},
        added: qOverride?.added ?? [],
      },
      questionCatalog,
      baseDocuments: enrichedDocuments.map((d) => ({
        key: d.key,
        label: d.label,
        required: d.required,
        catalogName: (d.catalog as { name?: string } | null)?.name,
        missingFromCatalog: d.missingFromCatalog,
      })),
      docOverride: {
        removed: docOverride.removed ?? [],
        added: docOverride.added ?? [],
        descriptions: docOverride.descriptions ?? {},
      },
      documentCatalog: Array.from(byKey.values()),
      imms: legalDocs
        .filter(Boolean)
        .map((d) => ({ _id: d!._id, name: d!.name, language: d!.language })),
    };
  },
});

// Canonical category order for the IMM-indexed wizard. Decouples wizard
// section ordering from per-IMM PDF structure: every catalog question gets
// tagged with `category` (one of these keys) + an optional `categorySort`
// for ordering within the bucket. New categories belong here; never let an
// IMM mapping invent its own.
const CATEGORY_ORDER: ReadonlyArray<{ key: string; title: string }> = [
  { key: "sponsorshipMeta",        title: "Mise en place de la demande" },
  { key: "sponsorIdentity",        title: "Identité du répondant" },
  { key: "sponsorStatus",          title: "Statut au Canada du répondant" },
  { key: "sponsorFamily",          title: "État civil du répondant" },
  { key: "sponsorContact",         title: "Coordonnées du répondant" },
  { key: "sponsorResidence",       title: "Résidence du répondant" },
  { key: "sponsorHistory",         title: "Antécédents du répondant" },
  { key: "sponsorAdmissibility",   title: "Admissibilité du répondant" },
  { key: "cosignerIdentity",       title: "Identité du cosignataire" },
  { key: "cosignerStatus",         title: "Statut au Canada du cosignataire" },
  { key: "cosignerFamily",         title: "État civil du cosignataire" },
  { key: "cosignerContact",        title: "Coordonnées du cosignataire" },
  { key: "cosignerResidence",      title: "Résidence du cosignataire" },
  { key: "cosignerAdmissibility",  title: "Admissibilité du cosignataire" },
  { key: "sponsoredIdentity",      title: "Identité de la personne parrainée" },
  { key: "sponsoredFamily",        title: "État civil de la personne parrainée" },
  { key: "sponsoredHistory",       title: "Antécédents de la personne parrainée" },
  { key: "relationshipNarrative",  title: "Récit de la relation" },
  { key: "relationshipEvidence",   title: "Preuves de la relation" },
];
