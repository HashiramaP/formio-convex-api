import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireFirmAccess } from "./auth";

// `getClient`, `getClientByLegacyId`, and `recordEmailConsent` are called by
// form-website (anonymous) using the clientId from the URL. URL-as-token model:
// leave open. Everything else is dashboard-scoped and requires firm membership.
export const getClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return null;

    let formDefinitionName: string | undefined;
    let formDefinitionLanguage: string | undefined;
    if (client.primaryFormDefinitionId) {
      const formDef = await ctx.db.get(client.primaryFormDefinitionId);
      formDefinitionName = formDef?.name ?? undefined;
      formDefinitionLanguage = formDef?.language ?? undefined;
    }

    return { ...client, formDefinitionName, formDefinitionLanguage };
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
    let formDefinitionLanguage: string | undefined;
    if (client.primaryFormDefinitionId) {
      const formDef = await ctx.db.get(client.primaryFormDefinitionId);
      formDefinitionName = formDef?.name ?? undefined;
      formDefinitionLanguage = formDef?.language ?? undefined;
    }

    return { ...client, formDefinitionName, formDefinitionLanguage };
  },
});

export const listClients = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
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

export const getClientForFirm = query({
  args: { firmId: v.id("firms"), clientId: v.id("clients") },
  handler: async (ctx, { firmId, clientId }) => {
    await requireFirmAccess(ctx, firmId);
    const client = await ctx.db.get(clientId);
    if (!client || client.firmId !== firmId) return null;

    let formDefinitionName: string | undefined;
    if (client.primaryFormDefinitionId) {
      const formDef = await ctx.db.get(client.primaryFormDefinitionId);
      formDefinitionName = formDef?.name ?? undefined;
    }

    return { ...client, formDefinitionName };
  },
});

export const listClientsWithActiveRevisions = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const supplements = await ctx.db
      .query("supplementRequests")
      .withIndex("by_firm_status", (q) => q.eq("firmId", firmId))
      .collect();

    const active = supplements.filter(
      (s) => s.status === "pending" || s.status === "in_progress",
    );
    return Array.from(new Set(active.map((s) => s.clientId as string)));
  },
});

export const insertClient = mutation({
  args: {
    firmId: v.id("firms"),
    firstName: v.string(),
    lastName: v.string(),
    notificationProfileId: v.optional(v.id("notificationProfiles")),
  },
  handler: async (ctx, { firmId, firstName, lastName, notificationProfileId }) => {
    await requireFirmAccess(ctx, firmId);
    const id = await ctx.db.insert("clients", {
      firmId,
      firstName,
      lastName,
      email: "",
      phoneNumber: "",
      notes: {},
      status: "new",
      ...(notificationProfileId ? { notificationProfileId } : {}),
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
      // null = clear the association (back to the firm's general email).
      notificationProfileId: v.optional(
        v.union(v.id("notificationProfiles"), v.null()),
      ),
    }),
  },
  handler: async (ctx, { firmId, clientId, updates }) => {
    await requireFirmAccess(ctx, firmId);
    const client = await ctx.db.get(clientId);
    if (!client || client.firmId !== firmId) return null;
    // Convex clears an optional field when patched with `undefined`. Pull
    // notificationProfileId out so an explicit `null` (clear) maps to undefined,
    // while an absent key leaves it unchanged.
    const { notificationProfileId, ...rest } = updates;
    await ctx.db.patch(clientId, {
      ...rest,
      ...(notificationProfileId !== undefined
        ? { notificationProfileId: notificationProfileId ?? undefined }
        : {}),
    });
    return await ctx.db.get(clientId);
  },
});

export const deleteClient = mutation({
  args: {
    firmId: v.id("firms"),
    clientId: v.id("clients"),
  },
  handler: async (ctx, { firmId, clientId }) => {
    await requireFirmAccess(ctx, firmId);
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
