import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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

export const listForFirm = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const logs = await ctx.db
      .query("aiUsageLogs")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    return logs.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getFormStats = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const total = submissions.length;
    const submitted = submissions.filter((s) => s.status === "submitted").length;
    const inProgress = submissions.filter((s) => s.status === "in_progress").length;

    return { total, submitted, inProgress };
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("aiUsageLogs").collect();
    return await Promise.all(
      logs.map(async (log) => {
        const firm = await ctx.db.get(log.firmId);
        return {
          ...log,
          firmDisplayName: firm?.displayName ?? null,
        };
      }),
    );
  },
});
