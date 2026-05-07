import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getLegalDocumentsByIds = query({
  args: { ids: v.array(v.id("legalDocuments")) },
  handler: async (ctx, { ids }) => {
    const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return docs.filter(Boolean);
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
