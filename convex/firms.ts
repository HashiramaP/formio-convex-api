import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireFirmAccess, requireWorkosUserId, AuthError } from "./auth";

// `getFirmDisplayName` is called by form-website (anonymous client form) to
// show "submitting to <firm>" — leave open.
export const getFirmDisplayName = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.displayName ?? null;
  },
});

// Used by admin-website's `/api/status` and `/api/generateArrimaData` routes
// as the auth handshake for external API customers (firm API key auth model,
// not WorkOS). Returns just `{_id, displayName}` so a brute-forced apiKey
// can't disclose subscription details or email overrides. The apiKey itself
// must be guessed (~82 bits of entropy from crypto-random alphabet).
export const getFirmByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    if (!apiKey) return null;
    const firm = await ctx.db
      .query("firms")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();
    if (!firm) return null;
    return { _id: firm._id, displayName: firm.displayName ?? null };
  },
});

// Bootstrap query: AuthContext runs this on every sign-in to resolve which
// firm the user owns. Self-lookup only — the JWT subject must match the
// requested workosUserId, so a user can't enumerate other firms' membership.
export const getFirmByWorkosUserId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    const callerWorkosId = await requireWorkosUserId(ctx);
    if (callerWorkosId !== workosUserId) {
      throw new AuthError("Unauthorized: self-lookup only");
    }
    return await ctx.db
      .query("firms")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
      .first();
  },
});

export const getApiKey = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    return firm?.apiKey ?? null;
  },
});

export const generateApiKey = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    // crypto.getRandomValues is required: Math.random() is predictable enough that
    // a sibling tab seeing one issued key could narrow guesses for adjacent keys.
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let key = "";
    for (let i = 0; i < bytes.length; i++) {
      key += chars[bytes[i] % chars.length];
    }
    await ctx.db.patch(firmId, { apiKey: key });
    return key;
  },
});

export const getMonthlyClientQuota = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
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
    await requireFirmAccess(ctx, firmId);
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
    await requireFirmAccess(ctx, firmId);
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
    await requireFirmAccess(ctx, firmId);
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
    await requireFirmAccess(ctx, firmId);
    await ctx.db.patch(firmId, { emailSettings: settings });
  },
});

export const getEmailOverrides = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
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
    await requireFirmAccess(ctx, firmId);
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
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const overrides = { ...(firm.emailOverrides ?? {}) };
    delete overrides[formDefinitionId as string];
    await ctx.db.patch(firmId, { emailOverrides: overrides });
  },
});
