import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return null;

    let formDefinitionName: string | undefined;
    if (client.primaryFormDefinitionId) {
      const formDef = await ctx.db.get(client.primaryFormDefinitionId);
      formDefinitionName = formDef?.name ?? undefined;
    }

    return { ...client, formDefinitionName };
  },
});

export const getClientByLegacyId = query({
  args: { legacyId: v.string() },
  handler: async (ctx, { legacyId }) => {
    const client = await ctx.db
      .query("clients")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
      .first();
    if (!client) return null;

    let formDefinitionName: string | undefined;
    if (client.primaryFormDefinitionId) {
      const formDef = await ctx.db.get(client.primaryFormDefinitionId);
      formDefinitionName = formDef?.name ?? undefined;
    }

    return { ...client, formDefinitionName };
  },
});

export const recordEmailConsent = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await ctx.db.patch(clientId, { emailConsentAt: Date.now() });
  },
});
