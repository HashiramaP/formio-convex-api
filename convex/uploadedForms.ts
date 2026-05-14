import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentFirm, requireFirmAccess, AuthError } from "./auth";

// uploadedForms is dashboard-only (main-website bulk upload). All firm-scoped.

export const insertUploadedForm = mutation({
  args: {
    firmId: v.id("firms"),
    name: v.optional(v.string()),
    formType: v.optional(v.string()),
    status: v.string(),
    batchId: v.optional(v.string()),
    legalDocumentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFirmAccess(ctx, args.firmId);
    return await ctx.db.insert("uploadedForms", args);
  },
});

export const listUploadedForms = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const forms = await ctx.db
      .query("uploadedForms")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    return forms.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listActiveUploads = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const forms = await ctx.db
      .query("uploadedForms")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    return forms
      .filter((f) => !!f.batchId)
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const updateUploadStatus = mutation({
  args: {
    id: v.id("uploadedForms"),
    updates: v.object({
      status: v.optional(v.string()),
      error: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
    }),
  },
  handler: async (ctx, { id, updates }) => {
    const firm = await requireCurrentFirm(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.firmId !== firm._id) {
      throw new AuthError("Unauthorized: upload not in caller's firm");
    }
    await ctx.db.patch(id, updates);
  },
});

export const deleteBatch = mutation({
  args: { firmId: v.id("firms"), batchId: v.string() },
  handler: async (ctx, { firmId, batchId }) => {
    await requireFirmAccess(ctx, firmId);
    const forms = await ctx.db
      .query("uploadedForms")
      .withIndex("by_firm_batch", (q) =>
        q.eq("firmId", firmId).eq("batchId", batchId),
      )
      .collect();

    for (const form of forms) {
      if (form.storageId) {
        await ctx.storage.delete(form.storageId);
      }
      await ctx.db.delete(form._id);
    }
  },
});
