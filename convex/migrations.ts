import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const insertFirms = internalMutation({
  args: {
    rows: v.array(
      v.object({
        supabaseId: v.string(),
        workosUserId: v.string(),
        displayName: v.optional(v.string()),
        apiKey: v.optional(v.string()),
        membershipStatus: v.string(),
        subscriptionStartDate: v.optional(v.number()),
        subscriptionEndDate: v.optional(v.number()),
        monthlyClientsRemaining: v.optional(v.number()),
        monthlyClientLimit: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { rows }) => {
    const mapping: Record<string, string> = {};
    for (const { supabaseId, ...data } of rows) {
      const id = await ctx.db.insert("firms", data);
      mapping[supabaseId] = id;
    }
    return mapping;
  },
});

export const insertLegalDocuments = internalMutation({
  args: {
    rows: v.array(
      v.object({
        supabaseId: v.string(),
        name: v.optional(v.string()),
        url: v.optional(v.string()),
        immQuestions: v.optional(v.any()),
        documentCoverage: v.optional(v.any()),
        screeningQuestions: v.optional(v.any()),
        language: v.string(),
      })
    ),
  },
  handler: async (ctx, { rows }) => {
    const mapping: Record<string, string> = {};
    for (const { supabaseId, ...data } of rows) {
      const id = await ctx.db.insert("legalDocuments", data);
      mapping[supabaseId] = id;
    }
    return mapping;
  },
});

export const insertQuestionTemplates = internalMutation({
  args: {
    rows: v.array(
      v.object({
        templateId: v.string(),
        label: v.string(),
        type: v.string(),
        indication: v.optional(v.string()),
        help: v.optional(v.string()),
        example: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        isRequired: v.boolean(),
        options: v.optional(v.any()),
        documentConfig: v.optional(v.any()),
        validationRules: v.optional(v.any()),
        multiEntryFields: v.optional(v.any()),
        multiEntryAddLabel: v.optional(v.string()),
        category: v.optional(v.string()),
        sortOrder: v.number(),
      })
    ),
  },
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      await ctx.db.insert("questionTemplates", row);
    }
  },
});

export const insertFormDefinitions = internalMutation({
  args: {
    rows: v.array(
      v.object({
        supabaseId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        languageNames: v.optional(v.any()),
        category: v.optional(v.string()),
        formGroup: v.optional(v.string()),
        groupLabel: v.optional(v.string()),
        firmId: v.optional(v.string()),
        isCustom: v.boolean(),
        sourceFormId: v.optional(v.string()),
        isSelfContained: v.boolean(),
        deletedAt: v.optional(v.number()),
        isBaseForm: v.boolean(),
        baseFormId: v.optional(v.string()),
        excludedBaseSections: v.optional(v.array(v.string())),
        legalDocumentId: v.optional(v.string()),
        isConsentForm: v.boolean(),
      })
    ),
    firmIdMap: v.any(),
    legalDocIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, legalDocIdMap }) => {
    const mapping: Record<string, string> = {};
    for (const { supabaseId, firmId, sourceFormId, baseFormId, legalDocumentId, ...data } of rows) {
      const id = await ctx.db.insert("formDefinitions", {
        ...data,
        firmId: firmId ? (firmIdMap as any)[firmId] : undefined,
        sourceFormId: undefined,
        baseFormId: undefined,
        legalDocumentId: legalDocumentId ? (legalDocIdMap as any)[legalDocumentId] : undefined,
      });
      mapping[supabaseId] = id;
    }
    // Second pass: resolve self-references
    for (const row of rows) {
      const convexId = mapping[row.supabaseId];
      const updates: any = {};
      if (row.sourceFormId && mapping[row.sourceFormId]) {
        updates.sourceFormId = mapping[row.sourceFormId];
      }
      if (row.baseFormId && mapping[row.baseFormId]) {
        updates.baseFormId = mapping[row.baseFormId];
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(convexId as any, updates);
      }
    }
    return mapping;
  },
});

export const insertQuestionsBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        externalId: v.string(),
        label: v.string(),
        shortLabel: v.optional(v.string()),
        type: v.string(),
        indication: v.optional(v.string()),
        help: v.optional(v.string()),
        example: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        isRequired: v.optional(v.boolean()),
        requiresConfirmation: v.optional(v.boolean()),
        confirmationText: v.optional(v.string()),
        successMessage: v.optional(v.string()),
        whyImportantReason: v.optional(v.string()),
        whyImportantConsequence: v.optional(v.string()),
        options: v.optional(v.any()),
        documentConfig: v.optional(v.any()),
        validationRules: v.optional(v.any()),
        multiEntryFields: v.optional(v.any()),
        multiEntryAddLabel: v.optional(v.string()),
        hasDetailsBox: v.optional(v.boolean()),
        detailsBoxLabel: v.optional(v.string()),
        translations: v.optional(v.any()),
        firmId: v.optional(v.string()),
      })
    ),
    firmIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap }) => {
    for (const { firmId, ...data } of rows) {
      await ctx.db.insert("questions", {
        ...data,
        firmId: firmId ? (firmIdMap as any)[firmId] : undefined,
      });
    }
  },
});

export const insertFormQuestionsBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        formDefinitionId: v.string(),
        questionKey: v.string(),
        orderIndex: v.number(),
        section: v.optional(v.string()),
        sectionTranslations: v.optional(v.any()),
        dependsOn: v.optional(v.any()),
        labelOverride: v.optional(v.string()),
        requiredOverride: v.optional(v.boolean()),
      })
    ),
    formDefIdMap: v.any(),
  },
  handler: async (ctx, { rows, formDefIdMap }) => {
    for (const { formDefinitionId, ...data } of rows) {
      const convexFormId = (formDefIdMap as any)[formDefinitionId];
      if (!convexFormId) continue;
      await ctx.db.insert("formQuestions", {
        ...data,
        formDefinitionId: convexFormId,
      });
    }
  },
});

export const insertClients = internalMutation({
  args: {
    rows: v.array(
      v.object({
        supabaseId: v.string(),
        firmId: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        email: v.optional(v.string()),
        phoneNumber: v.optional(v.string()),
        notes: v.optional(v.any()),
        primaryFormDefinitionId: v.optional(v.string()),
        status: v.optional(v.string()),
        legalDocumentIds: v.optional(v.array(v.string())),
        emailConsentAt: v.optional(v.number()),
        emailUnsubscribedAt: v.optional(v.number()),
      })
    ),
    firmIdMap: v.any(),
    formDefIdMap: v.any(),
    legalDocIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, formDefIdMap, legalDocIdMap }) => {
    const mapping: Record<string, string> = {};
    for (const { supabaseId, firmId, primaryFormDefinitionId, legalDocumentIds, ...data } of rows) {
      const convexFirmId = (firmIdMap as any)[firmId];
      if (!convexFirmId) continue;
      const legalDocs = legalDocumentIds
        ?.map((id: string) => (legalDocIdMap as any)[id])
        .filter(Boolean);
      const id = await ctx.db.insert("clients", {
        ...data,
        firmId: convexFirmId,
        primaryFormDefinitionId: primaryFormDefinitionId
          ? (formDefIdMap as any)[primaryFormDefinitionId]
          : undefined,
        legalDocuments: legalDocs && legalDocs.length > 0 ? legalDocs : undefined,
      });
      mapping[supabaseId] = id;
    }
    return mapping;
  },
});

export const insertSubmissions = internalMutation({
  args: {
    rows: v.array(
      v.object({
        supabaseId: v.string(),
        firmId: v.string(),
        clientId: v.optional(v.string()),
        formDefinitionId: v.optional(v.string()),
        title: v.string(),
        formType: v.optional(v.string()),
        status: v.string(),
        answers: v.optional(v.any()),
        translatedAnswers: v.optional(v.any()),
        metadata: v.optional(v.any()),
        skippedSections: v.optional(v.any()),
        preferredLanguage: v.optional(v.string()),
        documentOnly: v.optional(v.boolean()),
        groupId: v.optional(v.string()),
      })
    ),
    firmIdMap: v.any(),
    clientIdMap: v.any(),
    formDefIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, clientIdMap, formDefIdMap }) => {
    const mapping: Record<string, string> = {};
    for (const { supabaseId, firmId, clientId, formDefinitionId, ...data } of rows) {
      const convexFirmId = (firmIdMap as any)[firmId];
      if (!convexFirmId) continue;
      const id = await ctx.db.insert("submissions", {
        ...data,
        firmId: convexFirmId,
        clientId: clientId ? (clientIdMap as any)[clientId] : undefined,
        formDefinitionId: formDefinitionId ? (formDefIdMap as any)[formDefinitionId] : undefined,
      });
      mapping[supabaseId] = id;
    }
    return mapping;
  },
});

export const insertSubmissionDocuments = internalMutation({
  args: {
    rows: v.array(
      v.object({
        submissionId: v.string(),
        name: v.string(),
        fileType: v.optional(v.string()),
      })
    ),
    submissionIdMap: v.any(),
  },
  handler: async (ctx, { rows, submissionIdMap }) => {
    for (const { submissionId, ...data } of rows) {
      const convexSubId = (submissionIdMap as any)[submissionId];
      if (!convexSubId) continue;
      await ctx.db.insert("submissionDocuments", {
        ...data,
        submissionId: convexSubId,
      });
    }
  },
});

export const insertGeneratedLegalDocs = internalMutation({
  args: {
    rows: v.array(
      v.object({
        clientId: v.string(),
        legalDocumentId: v.string(),
        status: v.string(),
      })
    ),
    clientIdMap: v.any(),
    legalDocIdMap: v.any(),
  },
  handler: async (ctx, { rows, clientIdMap, legalDocIdMap }) => {
    for (const { clientId, legalDocumentId, ...data } of rows) {
      const cId = (clientIdMap as any)[clientId];
      const ldId = (legalDocIdMap as any)[legalDocumentId];
      if (!cId || !ldId) continue;
      await ctx.db.insert("generatedLegalDocs", {
        ...data,
        clientId: cId,
        legalDocumentId: ldId,
      });
    }
  },
});

export const insertAiUsageLogs = internalMutation({
  args: {
    rows: v.array(
      v.object({
        firmId: v.string(),
        modelName: v.string(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        formType: v.optional(v.string()),
        submissionId: v.optional(v.string()),
      })
    ),
    firmIdMap: v.any(),
    submissionIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, submissionIdMap }) => {
    for (const { firmId, submissionId, ...data } of rows) {
      const fId = (firmIdMap as any)[firmId];
      if (!fId) continue;
      await ctx.db.insert("aiUsageLogs", {
        ...data,
        firmId: fId,
        submissionId: submissionId ? (submissionIdMap as any)[submissionId] : undefined,
      });
    }
  },
});

export const insertUploadedForms = internalMutation({
  args: {
    rows: v.array(
      v.object({
        firmId: v.string(),
        name: v.optional(v.string()),
        formType: v.optional(v.string()),
        status: v.string(),
        batchId: v.optional(v.string()),
        legalDocumentName: v.optional(v.string()),
        error: v.optional(v.string()),
      })
    ),
    firmIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap }) => {
    for (const { firmId, ...data } of rows) {
      const fId = (firmIdMap as any)[firmId];
      if (!fId) continue;
      await ctx.db.insert("uploadedForms", { ...data, firmId: fId });
    }
  },
});

export const insertFeedback = internalMutation({
  args: {
    rows: v.array(
      v.object({
        type: v.string(),
        firmId: v.optional(v.string()),
        submissionId: v.optional(v.string()),
        title: v.optional(v.string()),
        email: v.optional(v.string()),
        message: v.optional(v.string()),
        rating: v.optional(v.number()),
        nps: v.optional(v.number()),
        easeOfUse: v.optional(v.number()),
        device: v.optional(v.string()),
      })
    ),
    firmIdMap: v.any(),
    submissionIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, submissionIdMap }) => {
    for (const { firmId, submissionId, ...data } of rows) {
      await ctx.db.insert("feedback", {
        ...data,
        firmId: firmId ? (firmIdMap as any)[firmId] : undefined,
        submissionId: submissionId ? (submissionIdMap as any)[submissionId] : undefined,
      });
    }
  },
});

export const insertSupplementRequests = internalMutation({
  args: {
    rows: v.array(
      v.object({
        submissionId: v.string(),
        clientId: v.string(),
        firmId: v.string(),
        requestedSections: v.optional(v.array(v.string())),
        requestedQuestions: v.optional(v.array(v.string())),
        status: v.string(),
        answers: v.optional(v.any()),
        metadata: v.optional(v.any()),
      })
    ),
    firmIdMap: v.any(),
    clientIdMap: v.any(),
    submissionIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, clientIdMap, submissionIdMap }) => {
    for (const { firmId, clientId, submissionId, ...data } of rows) {
      const fId = (firmIdMap as any)[firmId];
      const cId = (clientIdMap as any)[clientId];
      const sId = (submissionIdMap as any)[submissionId];
      if (!fId || !cId || !sId) continue;
      await ctx.db.insert("supplementRequests", {
        ...data,
        firmId: fId,
        clientId: cId,
        submissionId: sId,
      });
    }
  },
});

export const insertErrorLogs = internalMutation({
  args: {
    rows: v.array(
      v.object({
        source: v.string(),
        context: v.string(),
        message: v.optional(v.string()),
        details: v.optional(v.any()),
        submissionId: v.optional(v.string()),
        clientId: v.optional(v.string()),
        firmId: v.optional(v.string()),
      })
    ),
    firmIdMap: v.any(),
    clientIdMap: v.any(),
    submissionIdMap: v.any(),
  },
  handler: async (ctx, { rows, firmIdMap, clientIdMap, submissionIdMap }) => {
    for (const { firmId, clientId, submissionId, ...data } of rows) {
      await ctx.db.insert("errorLogs", {
        ...data,
        firmId: firmId ? (firmIdMap as any)[firmId] : undefined,
        clientId: clientId ? (clientIdMap as any)[clientId] : undefined,
        submissionId: submissionId ? (submissionIdMap as any)[submissionId] : undefined,
      });
    }
  },
});

export const getFirms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query("firms").collect();
    return firms.map((f) => ({
      _id: f._id,
      workosUserId: f.workosUserId,
    }));
  },
});

export const getClients = internalMutation({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    return clients.map((c) => ({
      _id: c._id,
      firmId: c.firmId,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
    }));
  },
});

export const backfillLegacyClientIds = internalMutation({
  args: {
    mappings: v.array(
      v.object({
        convexClientId: v.string(),
        supabaseUuid: v.string(),
      })
    ),
  },
  handler: async (ctx, { mappings }) => {
    let updated = 0;
    for (const { convexClientId, supabaseUuid } of mappings) {
      await ctx.db.patch(convexClientId as any, { legacyId: supabaseUuid });
      updated++;
    }
    return { updated };
  },
});

// One-shot: backfill firms.emailSettings from the Supabase `firm_email_settings`
// table that migrate-prod.ts originally skipped. Matches firms by workosUserId.
export const backfillFirmEmailSettings = internalMutation({
  args: {
    rows: v.array(
      v.object({
        workosUserId: v.string(),
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
      })
    ),
  },
  handler: async (ctx, { rows }) => {
    let patched = 0;
    const missing: string[] = [];
    for (const { workosUserId, settings } of rows) {
      const firm = await ctx.db
        .query("firms")
        .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
        .first();
      if (!firm) {
        missing.push(workosUserId);
        continue;
      }
      await ctx.db.patch(firm._id, { emailSettings: settings });
      patched++;
    }
    return { patched, total: rows.length, missing };
  },
});

// One-shot migration: rename aiCreditsRemaining → monthlyClientsRemaining,
// maxClientSlots → monthlyClientLimit, and drop clientRollback.
// Run once with `schemaValidation: false` in schema.ts, then re-enable validation.
export const migrateFirmsSchema = internalMutation({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query("firms").collect();
    let updated = 0;
    for (const firm of firms as any[]) {
      const hasOld =
        "aiCreditsRemaining" in firm ||
        "maxClientSlots" in firm ||
        "clientRollback" in firm;
      if (!hasOld) continue;

      const patch: Record<string, unknown> = {
        aiCreditsRemaining: undefined,
        maxClientSlots: undefined,
        clientRollback: undefined,
      };
      if (typeof firm.aiCreditsRemaining === "number" && firm.monthlyClientsRemaining === undefined) {
        patch.monthlyClientsRemaining = firm.aiCreditsRemaining;
      }
      if (typeof firm.maxClientSlots === "number" && firm.monthlyClientLimit === undefined) {
        patch.monthlyClientLimit = firm.maxClientSlots;
      }

      await ctx.db.patch(firm._id, patch as any);
      updated++;
    }
    return { updated, total: firms.length };
  },
});

/**
 * Idempotency helper for one-off seed scripts (e.g. seedParrainageEnfant.ts).
 * Returns whether a formDefinition with the given slug already exists, plus
 * its _id so callers can abort cleanly instead of double-inserting.
 */
export const findFormDefinitionBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const form = await ctx.db
      .query("formDefinitions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    return { found: form !== null, id: form ? (form._id as string) : null };
  },
});

/**
 * One-off, idempotent migration: sets isGroupPrimary=true on the parrainage
 * familial Demandeur principal form. Required so getDistinctSections and
 * getFormQuestions can identify the single primary sub-form in a formGroup
 * that should inherit base sections (Répondant and Couple do not).
 *
 * Run once: `npx convex run migrations:setGroupPrimaries`.
 * Safe to re-run: only patches forms where the flag isn't already true.
 */
export const setGroupPrimaries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const PRIMARY_SLUGS = ["parrainage-demandeur"];
    const updated: string[] = [];
    const skipped: string[] = [];
    const notFound: string[] = [];

    for (const slug of PRIMARY_SLUGS) {
      const forms = await ctx.db
        .query("formDefinitions")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .collect();

      if (forms.length === 0) {
        notFound.push(slug);
        continue;
      }

      for (const form of forms) {
        if (form.isGroupPrimary === true) {
          skipped.push(`${slug} (${form._id}) — already primary`);
          continue;
        }
        await ctx.db.patch(form._id, { isGroupPrimary: true });
        updated.push(`${slug} (${form._id})`);
      }
    }

    return { updated, skipped, notFound };
  },
});

// Returns rows of a table with the identifier fields used by scripts/migrate-prod.ts to
// recover Supabase -> Convex _id mappings after `npx convex import`. Default sort is by
// _creationTime ascending — same order we wrote in the JSONL — so callers can pair
// positionally with their Supabase source array.
export const getRowsForMapping = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, { tableName }) => {
    const docs = await ctx.db.query(tableName as any).collect();
    return docs.map((d: any) => ({
      _id: d._id,
      _creationTime: d._creationTime,
      workosUserId: d.workosUserId,
      legacyId: d.legacyId,
      externalId: d.externalId,
      templateId: d.templateId,
    }));
  },
});

// Returns rows with storage-related fields. Used by scripts/migrate-storage.ts to
// pair Convex rows with Supabase storage objects (positional by _creationTime, then
// to skip rows that already have a storageId on resume).
export const getStorageRows = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, { tableName }) => {
    const docs = await ctx.db.query(tableName as any).collect();
    return docs.map((d: any) => ({
      _id: d._id,
      _creationTime: d._creationTime,
      storageId: d.storageId,
      status: d.status,
      name: d.name,
    }));
  },
});

// Specialized helper for submissionDocuments — also returns submissionId so the
// storage script can match Convex docs to Supabase rows by (parent submission's legacyId, name)
// instead of fragile positional matching (Convex has post-migration live uploads).
export const getSubmissionDocsForStorage = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("submissionDocuments").collect();
    return docs.map((d) => ({
      _id: d._id,
      storageId: d.storageId,
      name: d.name,
      submissionId: d.submissionId,
    }));
  },
});

// Used by scripts/migrate-storage.ts to attach a freshly-uploaded Convex storage
// object to a row. table is restricted to the 3 storage-bearing tables.
export const patchStorageId = internalMutation({
  args: {
    table: v.union(
      v.literal("submissionDocuments"),
      v.literal("generatedLegalDocs"),
      v.literal("uploadedForms")
    ),
    convexId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { convexId, storageId }) => {
    await ctx.db.patch(convexId as any, { storageId });
  },
});

// For generatedLegalDocs whose Supabase file_path references a missing storage object
// (pre-existing Supabase breakage — file deleted but row kept). Sets status='error' so
// the frontend (DashboardClientDetail.tsx) stops showing them as 'generating' forever.
export const markGenLegalDocError = internalMutation({
  args: { convexId: v.string() },
  handler: async (ctx, { convexId }) => {
    await ctx.db.patch(convexId as any, { status: "error" });
  },
});

// One-shot fix for the prod migration that wrote French status strings on clients.
// Maps Supabase numeric IDs were translated as nouveau_mandat/en_cours/soumis but the
// frontend (DashboardHome.tsx, DashboardClients.tsx, etc.) compares against new/in_progress/submitted.
// Idempotent: rows that are already in the target form are skipped.
export const remapClientStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const remap: Record<string, string> = {
      nouveau_mandat: "new",
      en_cours: "in_progress",
      soumis: "submitted",
    };
    const clients = await ctx.db.query("clients").collect();
    let updated = 0;
    const counts: Record<string, number> = {};
    for (const c of clients) {
      const target = c.status ? remap[c.status] : undefined;
      if (target && target !== c.status) {
        await ctx.db.patch(c._id, { status: target });
        updated++;
        counts[target] = (counts[target] ?? 0) + 1;
      }
    }
    return { updated, total: clients.length, counts };
  },
});

// Second pass for formDefinitions self-references (sourceFormId, baseFormId).
// migrate-prod.ts imports formDefinitions with these fields blank, builds the
// supabaseFormId -> Convex _id map, then calls this with already-resolved Convex IDs.
export const patchFormDefinitionRefs = internalMutation({
  args: {
    patches: v.array(
      v.object({
        convexId: v.string(),
        sourceFormId: v.optional(v.string()),
        baseFormId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { patches }) => {
    let updated = 0;
    for (const { convexId, sourceFormId, baseFormId } of patches) {
      const update: Record<string, unknown> = {};
      if (sourceFormId) update.sourceFormId = sourceFormId;
      if (baseFormId) update.baseFormId = baseFormId;
      if (Object.keys(update).length === 0) continue;
      await ctx.db.patch(convexId as any, update as any);
      updated++;
    }
    return { updated, total: patches.length };
  },
});

export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "errorLogs", "supplementRequests", "feedback", "uploadedForms",
      "aiUsageLogs", "generatedLegalDocs", "submissionDocuments",
      "submissions", "clients", "formQuestions", "questions",
      "formDefinitions", "questionTemplates", "legalDocuments", "firms",
    ] as const;
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      counts[table] = docs.length;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }
    return counts;
  },
});

// ===== Prune helpers used by scripts/sync-dev-from-prod.ts =====
// All `internalMutation` / `internalQuery` — unreachable from public clients
// without the admin key. Safe to leave in prod.

// Returns the fields needed for stratified sampling on the caller side.
export const pruneListSubmissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("submissions").collect();
    return docs.map((d) => ({
      _id: d._id as string,
      status: d.status,
      firmId: d.firmId as string,
      clientId: (d.clientId as string | undefined) ?? null,
    }));
  },
});

// Deletes every submissionDocument row tied to one of these submissionIds, plus
// its underlying _storage blob. Caller should chunk to ~30 submission IDs per
// invocation so writes stay well under the per-mutation budget.
export const pruneDeleteSubmissionDocsFor = internalMutation({
  args: { submissionIds: v.array(v.string()) },
  handler: async (ctx, { submissionIds }) => {
    let docsDeleted = 0;
    let filesDeleted = 0;
    for (const sid of submissionIds) {
      const docs = await ctx.db
        .query("submissionDocuments")
        .withIndex("by_submission", (q) => q.eq("submissionId", sid as any))
        .collect();
      for (const doc of docs) {
        if (doc.storageId) {
          try {
            await ctx.storage.delete(doc.storageId);
            filesDeleted++;
          } catch {
            // storage entry already gone — keep going
          }
        }
        await ctx.db.delete(doc._id);
        docsDeleted++;
      }
    }
    return { processed: submissionIds.length, docsDeleted, filesDeleted };
  },
});

// Deletes every generatedLegalDocs row whose clientId is in the supplied list,
// plus the underlying _storage blob (status='error' rows have no storage).
export const pruneDeleteGenLegalDocsFor = internalMutation({
  args: { clientIds: v.array(v.string()) },
  handler: async (ctx, { clientIds }) => {
    let docsDeleted = 0;
    let filesDeleted = 0;
    for (const cid of clientIds) {
      const docs = await ctx.db
        .query("generatedLegalDocs")
        .withIndex("by_client_doc", (q) => q.eq("clientId", cid as any))
        .collect();
      for (const doc of docs) {
        if (doc.storageId) {
          try {
            await ctx.storage.delete(doc.storageId);
            filesDeleted++;
          } catch {
            // storage already gone
          }
        }
        await ctx.db.delete(doc._id);
        docsDeleted++;
      }
    }
    return { processed: clientIds.length, docsDeleted, filesDeleted };
  },
});

// Deletes submissions by raw _id. Chunk to ~200 per call.
export const pruneDeleteSubmissionsByIds = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    let deleted = 0;
    for (const id of ids) {
      try {
        await ctx.db.delete(id as any);
        deleted++;
      } catch {
        // already deleted
      }
    }
    return { deleted, total: ids.length };
  },
});

// Deletes clients by raw _id.
export const pruneDeleteClientsByIds = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    let deleted = 0;
    for (const id of ids) {
      try {
        await ctx.db.delete(id as any);
        deleted++;
      } catch {
        // already deleted
      }
    }
    return { deleted, total: ids.length };
  },
});

// Clears a single table in chunks. Also deletes the _storage blob if the row has
// a storageId. Returns `hasMore: true` if it stopped at chunkSize.
export const pruneClearTableChunked = internalMutation({
  args: { table: v.string(), chunkSize: v.optional(v.number()) },
  handler: async (ctx, { table, chunkSize = 1000 }) => {
    const docs = await ctx.db.query(table as any).take(chunkSize);
    let deleted = 0;
    let filesDeleted = 0;
    for (const doc of docs) {
      const storageId = (doc as any).storageId;
      if (storageId) {
        try {
          await ctx.storage.delete(storageId);
          filesDeleted++;
        } catch {
          // already gone
        }
      }
      await ctx.db.delete(doc._id);
      deleted++;
    }
    return { deleted, filesDeleted, hasMore: docs.length === chunkSize };
  },
});

// Deletes uploadedForms rows that lack a storageId (the 96 broken-as-imported
// rows in prod). Idempotent: re-running it returns deleted=0 once clean.
export const pruneDeleteUploadedFormsWithoutStorage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("uploadedForms").collect();
    let deleted = 0;
    for (const doc of docs) {
      if (doc.storageId) continue;
      await ctx.db.delete(doc._id);
      deleted++;
    }
    return { deleted, kept: docs.length - deleted };
  },
});

// Returns a temporary signed URL for a storage object. Used by the dev sync
// script to download prod file bytes for re-upload into dev storage.
export const getStorageDownloadUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

// Returns rows from one of the file-bearing tables that still carry a
// non-null storageId (the rows whose files we need to re-upload into dev).
export const listRowsNeedingStorageTransfer = internalQuery({
  args: {
    table: v.union(
      v.literal("submissionDocuments"),
      v.literal("generatedLegalDocs"),
      v.literal("uploadedForms")
    ),
  },
  handler: async (ctx, { table }) => {
    const docs = await ctx.db.query(table).collect();
    return docs
      .filter((d: any) => !!d.storageId)
      .map((d: any) => ({
        _id: d._id as string,
        storageId: d.storageId as string,
        // Pass through a mime hint where available; submissionDocuments has
        // fileType, the other two are always PDF in this codebase.
        mimeType: d.fileType ?? "application/pdf",
      }));
  },
});
