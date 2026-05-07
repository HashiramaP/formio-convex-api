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

export const listClients = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    return await Promise.all(
      clients.map(async (client) => {
        let formDefinitionName: string | undefined;
        if (client.primaryFormDefinitionId) {
          const formDef = await ctx.db.get(client.primaryFormDefinitionId);
          formDefinitionName = formDef?.name ?? undefined;
        }

        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect();

        return {
          ...client,
          formDefinitionName,
          submissions: submissions.map((s) => ({
            _id: s._id,
            _creationTime: s._creationTime,
            status: s.status,
            metadata: s.metadata,
          })),
        };
      }),
    );
  },
});

export const insertClient = mutation({
  args: {
    firmId: v.id("firms"),
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (ctx, { firmId, firstName, lastName }) => {
    const id = await ctx.db.insert("clients", {
      firmId,
      firstName,
      lastName,
      email: "",
      phoneNumber: "",
      notes: {},
      status: "new",
    });
    const client = await ctx.db.get(id);
    return client;
  },
});

export const updateClient = mutation({
  args: {
    firmId: v.id("firms"),
    clientId: v.id("clients"),
    updates: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      notes: v.optional(v.any()),
      primaryFormDefinitionId: v.optional(v.id("formDefinitions")),
      status: v.optional(v.string()),
      legalDocuments: v.optional(v.array(v.id("legalDocuments"))),
    }),
  },
  handler: async (ctx, { firmId, clientId, updates }) => {
    const client = await ctx.db.get(clientId);
    if (!client || client.firmId !== firmId) return null;
    await ctx.db.patch(clientId, updates);
    return await ctx.db.get(clientId);
  },
});

export const deleteClient = mutation({
  args: {
    firmId: v.id("firms"),
    clientId: v.id("clients"),
  },
  handler: async (ctx, { firmId, clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client || client.firmId !== firmId) return false;
    await ctx.db.delete(clientId);
    return true;
  },
});

export const recordEmailConsent = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await ctx.db.patch(clientId, { emailConsentAt: Date.now() });
  },
});
