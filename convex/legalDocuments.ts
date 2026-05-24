import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireClientAccess, requireCurrentFirm, AuthError } from "./auth";

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
export const getIntakeForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return { error: "client not found" as const };

    const legalDocIds = client.legalDocuments ?? [];
    if (legalDocIds.length === 0) {
      return { questions: [], documents: [], imms: [] };
    }

    const legalDocs = await Promise.all(legalDocIds.map((id) => ctx.db.get(id)));

    // Dedup buckets keyed by externalId / document key.
    const questionsByExt = new Map<
      string,
      { externalId: string; required: boolean; section?: string; page?: number; order?: number; sourcedFrom: string[] }
    >();
    const documentsByKey = new Map<
      string,
      { key: string; label?: string; required: boolean; sourcedFrom: string[] }
    >();

    for (const ld of legalDocs) {
      if (!ld) continue;
      const mapping = ld.immQuestions as ImmIntakeMapping | undefined;
      if (!mapping || !Array.isArray(mapping.intakeQuestions)) continue;

      for (const q of mapping.intakeQuestions) {
        const ext = q.externalId;
        if (!ext) continue;
        const existing = questionsByExt.get(ext);
        if (existing) {
          existing.required = existing.required || !!q.required;
          existing.sourcedFrom.push(ld.name ?? ld._id);
        } else {
          questionsByExt.set(ext, {
            externalId: ext,
            required: !!q.required,
            section: q.section,
            page: q.page,
            order: q.order,
            sourcedFrom: [ld.name ?? ld._id],
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

    // Enrich question stubs with full catalog metadata. A missing entry
    // means the IMM mapping references an externalId that doesn't exist in
    // the questions table — surface it so the consultant can fix the
    // catalog gap rather than silently dropping the question.
    const enrichedQuestions = await Promise.all(
      Array.from(questionsByExt.values()).map(async (stub) => {
        const catalog = await ctx.db
          .query("questions")
          .withIndex("by_externalId", (q) => q.eq("externalId", stub.externalId))
          .first();
        return {
          ...stub,
          catalog: catalog ?? null,
          missingFromCatalog: !catalog,
        };
      }),
    );

    // Preserve declared order where present, fallback to externalId for
    // determinism.
    enrichedQuestions.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.externalId.localeCompare(b.externalId);
    });

    return {
      questions: enrichedQuestions,
      documents: Array.from(documentsByKey.values()),
      imms: legalDocs.filter(Boolean).map((d) => ({
        _id: d!._id,
        name: d!.name,
        language: d!.language,
      })),
    };
  },
});
