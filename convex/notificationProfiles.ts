import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireFirmAccess } from "./auth";

// Notification profiles — firm-scoped contacts (name + email) that can be
// attached to a client (case) so that case's notification emails go to them
// instead of the firm's general notification email. Dashboard-only; every
// function is firm-scoped via requireFirmAccess.

export const listNotificationProfiles = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    return await ctx.db
      .query("notificationProfiles")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
  },
});

export const createNotificationProfile = mutation({
  args: {
    firmId: v.id("firms"),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { firmId, name, email }) => {
    await requireFirmAccess(ctx, firmId);
    const id = await ctx.db.insert("notificationProfiles", {
      firmId,
      name,
      email,
    });
    return await ctx.db.get(id);
  },
});

export const updateNotificationProfile = mutation({
  args: {
    firmId: v.id("firms"),
    profileId: v.id("notificationProfiles"),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { firmId, profileId, updates }) => {
    await requireFirmAccess(ctx, firmId);
    // requireFirmAccess proves the caller owns firmId; re-check the profile
    // belongs to that firm to prevent cross-firm edits.
    const profile = await ctx.db.get(profileId);
    if (!profile || profile.firmId !== firmId) return null;
    await ctx.db.patch(profileId, updates);
    return await ctx.db.get(profileId);
  },
});

export const deleteNotificationProfile = mutation({
  args: {
    firmId: v.id("firms"),
    profileId: v.id("notificationProfiles"),
  },
  handler: async (ctx, { firmId, profileId }) => {
    await requireFirmAccess(ctx, firmId);
    const profile = await ctx.db.get(profileId);
    if (!profile || profile.firmId !== firmId) return false;
    // Detach the profile from any clients that reference it so they fall back
    // to the firm's general notification email (resolver also handles a missing
    // profile gracefully, but keep the data clean).
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    for (const client of clients) {
      if (client.notificationProfileId === profileId) {
        await ctx.db.patch(client._id, { notificationProfileId: undefined });
      }
    }
    await ctx.db.delete(profileId);
    return true;
  },
});
