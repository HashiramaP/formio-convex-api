import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

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

export const getMonthlyClientQuota = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return { remaining: null, limit: null };
    return {
      remaining: firm.monthlyClientsRemaining ?? null,
      limit: firm.monthlyClientLimit ?? null,
    };
  },
});

export const decrementMonthlyClients = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const current = firm.monthlyClientsRemaining;
    if (typeof current === "number" && current > 0) {
      await ctx.db.patch(firmId, { monthlyClientsRemaining: current - 1 });
    }
  },
});

// Resets every firm's `monthlyClientsRemaining` back to its `monthlyClientLimit`.
// Scheduled by `crons.ts` on the 1st of each month. Firms with no limit set are
// left untouched (treated as unlimited).
export const resetMonthlyClientQuotas = internalMutation({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query("firms").collect();
    let resetCount = 0;
    for (const firm of firms) {
      if (typeof firm.monthlyClientLimit !== "number") continue;
      await ctx.db.patch(firm._id, {
        monthlyClientsRemaining: firm.monthlyClientLimit,
      });
      resetCount++;
    }
    return { resetCount, totalFirms: firms.length };
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
