import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireFirmAccess, requireClientAccess } from "./auth";

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

// Intake curation — per-client override of one intake field on top of the
// firm's per-demande-type default. state "ask" force-shows, "skip" force-hides,
// "default" clears the override (follow the firm default again).
export const setIntakeFieldOverride = mutation({
  args: {
    clientId: v.id("clients"),
    externalId: v.string(),
    state: v.union(v.literal("ask"), v.literal("skip"), v.literal("default")),
  },
  handler: async (ctx, { clientId, externalId, state }) => {
    await requireClientAccess(ctx, clientId);
    const client = await ctx.db.get(clientId);
    if (!client) return;
    const overrides = { ...(client.intakeFieldOverrides ?? {}) };
    if (state === "default") {
      delete overrides[externalId];
    } else {
      overrides[externalId] = state;
    }
    await ctx.db.patch(clientId, { intakeFieldOverrides: overrides });
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
    // Notify the assignee out-of-band when a profile is set at creation.
    if (notificationProfileId) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.sendAssignmentNotification,
        { clientId: id, profileId: notificationProfileId },
      );
    }
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
    // Notify the new assignee only when the profile actually changes to a real
    // one (skip re-saves with the same profile, and clears to general email).
    if (
      notificationProfileId &&
      notificationProfileId !== client.notificationProfileId
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.sendAssignmentNotification,
        { clientId, profileId: notificationProfileId },
      );
    }
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

export const searchClients = query({
  args: { firmId: v.id("firms"), searchName: v.string() },
  handler: async (ctx, { firmId, searchName }) => {
    await requireFirmAccess(ctx, firmId);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const lowerSearch = searchName.toLowerCase();
    return clients.filter((client) => {
      const firstName = client.firstName?.toLowerCase() || "";
      const lastName = client.lastName?.toLowerCase() || "";
      return (
        firstName.includes(lowerSearch) || lastName.includes(lowerSearch)
      );
    });
  },
});
