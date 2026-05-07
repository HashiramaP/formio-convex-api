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
