import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireFirmAccess, requireAdmin } from "./auth";

// saveFeedback + hasFeedback are called from form-website (post-submission
// rating panel) — anonymous. Everything else is dashboard-only.
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

export const insertDashboardFeedback = mutation({
  args: {
    firmId: v.id("firms"),
    title: v.string(),
    type: v.string(),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFirmAccess(ctx, args.firmId);
    return await ctx.db.insert("feedback", args);
  },
});

export const insertMonthlyFeedback = mutation({
  args: {
    firmId: v.id("firms"),
    rating: v.number(),
    formCount: v.number(),
    selectedOptions: v.optional(v.array(v.string())),
    otherFeedback: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { firmId, rating, formCount, selectedOptions, otherFeedback },
  ) => {
    await requireFirmAccess(ctx, firmId);
    const message = selectedOptions?.length
      ? `Options: ${selectedOptions.join(", ")}${otherFeedback ? `. Other: ${otherFeedback}` : ""}`
      : otherFeedback ?? undefined;

    return await ctx.db.insert("feedback", {
      type: "feedback",
      firmId,
      title: `Monthly Rating: ${rating}/5 @${formCount}`,
      message,
      rating,
    });
  },
});

// Admin-only: called by main-website DashboardAdmin (unscoped, all firms).
export const listAllFeedback = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("feedback").collect();
    const filtered = all
      .filter((f) => f.type === "feedback")
      .sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      filtered.map(async (f) => {
        const firm = f.firmId ? await ctx.db.get(f.firmId) : null;
        return {
          ...f,
          firmDisplayName: firm?.displayName ?? null,
        };
      }),
    );
  },
});

export const getFeedbackStats = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const all = await ctx.db
      .query("feedback")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    const filtered = all
      .filter((f) => f.type === "feedback")
      .sort((a, b) => b._creationTime - a._creationTime);

    let lastFormCount: number | null = null;
    const lastTitle = filtered[0]?.title;
    if (lastTitle) {
      const match = lastTitle.match(/@(\d+)$/);
      if (match) lastFormCount = parseInt(match[1], 10);
    }

    return {
      count: filtered.length,
      lastFeedbackTime: filtered[0]?._creationTime ?? null,
      lastFormCount,
    };
  },
});
