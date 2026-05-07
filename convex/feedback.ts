import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const saveFeedback = mutation({
  args: {
    submissionId: v.id("submissions"),
    rating: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { submissionId, rating, comment }) => {
    const existing = await ctx.db
      .query("feedback")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: rating ?? existing.rating,
        message: comment ?? existing.message,
      });
      return existing._id;
    }

    return await ctx.db.insert("feedback", {
      type: "form_rating",
      submissionId,
      rating,
      message: comment,
    });
  },
});

export const hasFeedback = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .first();
    return feedback !== null;
  },
});
