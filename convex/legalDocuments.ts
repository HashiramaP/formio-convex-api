import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
