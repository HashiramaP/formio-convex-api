import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const logOcrTransaction = mutation({
  args: {
    firmId: v.id("firms"),
    modelName: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    formType: v.optional(v.string()),
    submissionId: v.optional(v.id("submissions")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsageLogs", args);
  },
});
