import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
        aiCreditsRemaining: v.optional(v.number()),
        maxClientSlots: v.optional(v.number()),
        clientRollback: v.optional(v.boolean()),
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
