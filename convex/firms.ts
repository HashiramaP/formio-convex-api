import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getFirmDisplayName = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.displayName ?? null;
  },
});

export const getFirmByWorkosUserId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    return await ctx.db
      .query("firms")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
      .first();
  },
});

export const getApiKey = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.apiKey ?? null;
  },
});

export const generateApiKey = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i < 16; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    await ctx.db.patch(firmId, { apiKey: key });
    return key;
  },
});

export const getCredits = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return { credits: null, limit: null };
    return {
      credits: firm.aiCreditsRemaining ?? null,
      limit: firm.maxClientSlots ?? null,
    };
  },
});

export const decrementCredits = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const current = firm.aiCreditsRemaining;
    if (typeof current === "number" && current > 0) {
      await ctx.db.patch(firmId, { aiCreditsRemaining: current - 1 });
    }
  },
});

export const getSubscriptionInfo = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return null;
    return {
      subscriptionStartDate: firm.subscriptionStartDate ?? null,
      subscriptionEndDate: firm.subscriptionEndDate ?? null,
      membershipStatus: firm.membershipStatus,
    };
  },
});

export const getEmailSettings = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.emailSettings ?? null;
  },
});

export const updateEmailSettings = mutation({
  args: {
    firmId: v.id("firms"),
    settings: v.object({
      generalNotificationEmail: v.optional(v.string()),
      physicalMailingAddress: v.optional(v.string()),
      remindersEnabled: v.boolean(),
      reminderCadence: v.object({
        firstAfterDays: v.number(),
        repeatEveryDays: v.number(),
        maxReminders: v.number(),
      }),
    }),
  },
  handler: async (ctx, { firmId, settings }) => {
    await ctx.db.patch(firmId, { emailSettings: settings });
  },
});

export const getEmailOverrides = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.emailOverrides ?? {};
  },
});

export const upsertEmailOverride = mutation({
  args: {
    firmId: v.id("firms"),
    formDefinitionId: v.id("formDefinitions"),
    email: v.string(),
  },
  handler: async (ctx, { firmId, formDefinitionId, email }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const overrides = { ...(firm.emailOverrides ?? {}) };
    overrides[formDefinitionId as string] = email;
    await ctx.db.patch(firmId, { emailOverrides: overrides });
  },
});

export const deleteEmailOverride = mutation({
  args: {
    firmId: v.id("firms"),
    formDefinitionId: v.id("formDefinitions"),
  },
  handler: async (ctx, { firmId, formDefinitionId }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const overrides = { ...(firm.emailOverrides ?? {}) };
    delete overrides[formDefinitionId as string];
    await ctx.db.patch(firmId, { emailOverrides: overrides });
  },
});
