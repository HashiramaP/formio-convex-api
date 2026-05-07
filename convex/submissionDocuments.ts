import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerDocument = mutation({
  args: {
    submissionId: v.id("submissions"),
    name: v.string(),
    storageId: v.id("_storage"),
    fileType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("submissionDocuments", args);
  },
});

export const listDocuments = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const docs = await ctx.db
      .query("submissionDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .collect();

    return await Promise.all(
      docs.map(async (d) => ({
        ...d,
        url: d.storageId ? await ctx.storage.getUrl(d.storageId) : null,
      })),
    );
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("submissionDocuments") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return;
    if (doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }
    await ctx.db.delete(documentId);
  },
});

export const getDocumentUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
