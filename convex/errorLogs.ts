import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const logError = mutation({
  args: {
    source: v.string(),
    context: v.string(),
    message: v.optional(v.string()),
    details: v.optional(v.any()),
    submissionId: v.optional(v.id("submissions")),
    clientId: v.optional(v.id("clients")),
    firmId: v.optional(v.id("firms")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("errorLogs", args);
  },
});
