import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
