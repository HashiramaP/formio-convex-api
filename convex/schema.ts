import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  firms: defineTable({
    workosUserId: v.optional(v.string()),
    pendingEmail: v.optional(v.string()),
    workosInvitationId: v.optional(v.string()),
    invitationSentAt: v.optional(v.number()),
    displayName: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    membershipStatus: v.string(),
    subscriptionStartDate: v.optional(v.number()),
    subscriptionEndDate: v.optional(v.number()),
    monthlyClientsRemaining: v.optional(v.number()),
    monthlyClientLimit: v.optional(v.number()),
    // Max notification profiles a firm may create (admin-set, manual).
    // Unset/undefined = unlimited.
    notificationProfileLimit: v.optional(v.number()),
    emailSettings: v.optional(
      v.object({
        generalNotificationEmail: v.optional(v.string()),
        physicalMailingAddress: v.optional(v.string()),
        remindersEnabled: v.boolean(),
        reminderCadence: v.object({
          firstAfterDays: v.number(),
          repeatEveryDays: v.number(),
          maxReminders: v.number(),
        }),
      })
    ),
    emailOverrides: v.optional(v.record(v.string(), v.string())),
  })
    .index("by_workosUserId", ["workosUserId"])
    .index("by_pendingEmail", ["pendingEmail"])
    .index("by_apiKey", ["apiKey"]),

  clients: defineTable({
    firmId: v.id("firms"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    notes: v.optional(v.any()),
    primaryFormDefinitionId: v.optional(v.id("formDefinitions")),
    status: v.optional(v.string()),
    legalDocuments: v.optional(v.array(v.id("legalDocuments"))),
    // Notification profile that receives this case's emails (else the firm's
    // general notification email). See notificationProfiles table.
    notificationProfileId: v.optional(v.id("notificationProfiles")),
    emailConsentAt: v.optional(v.number()),
    emailUnsubscribedAt: v.optional(v.number()),
    legacyId: v.optional(v.string()),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_legacyId", ["legacyId"]),

  submissions: defineTable({
    firmId: v.id("firms"),
    clientId: v.optional(v.id("clients")),
    formDefinitionId: v.optional(v.id("formDefinitions")),
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
    .index("by_client", ["clientId"])
    .index("by_firm", ["firmId"])
    .index("by_group", ["groupId"]),

  formDefinitions: defineTable({
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
    languageNames: v.optional(v.any()),
    language: v.optional(v.string()),
    category: v.optional(v.string()),
    formGroup: v.optional(v.string()),
    groupLabel: v.optional(v.string()),
    isGroupPrimary: v.optional(v.boolean()),
    firmId: v.optional(v.id("firms")),
    isCustom: v.boolean(),
    sourceFormId: v.optional(v.id("formDefinitions")),
    isSelfContained: v.boolean(),
    deletedAt: v.optional(v.number()),
    isBaseForm: v.boolean(),
    baseFormId: v.optional(v.id("formDefinitions")),
    excludedBaseSections: v.optional(v.array(v.string())),
    legalDocumentId: v.optional(v.id("legalDocuments")),
    isConsentForm: v.boolean(),
  })
    .index("by_firm", ["firmId"])
    .index("by_slug", ["slug"]),

  questions: defineTable({
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
    firmId: v.optional(v.id("firms")),
    // IMM-indexed intake categorization — decouples wizard section ordering
    // from per-IMM PDF structure. `category` is the canonical bucket
    // (e.g. "sponsorIdentity"); `categorySort` orders questions within a
    // bucket. When set, getIntakeForClient groups + sorts by category and
    // overrides the per-IMM `section` with the category's display title.
    category: v.optional(v.string()),
    categorySort: v.optional(v.number()),
    // Conditional visibility carried on the canonical question itself (e.g.
    // { questionId: "hasCosigner", value: "oui" }). The IMM-indexed intake
    // generates the wizard from the questions catalog (not formQuestions), so
    // the dependency must live here too, not only on formQuestions.
    dependsOn: v.optional(v.any()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_firm", ["firmId"]),

  formQuestions: defineTable({
    formDefinitionId: v.id("formDefinitions"),
    questionKey: v.string(),
    orderIndex: v.number(),
    section: v.optional(v.string()),
    sectionTranslations: v.optional(v.any()),
    dependsOn: v.optional(v.any()),
    labelOverride: v.optional(v.string()),
    requiredOverride: v.optional(v.boolean()),
  })
    .index("by_formDefinition", ["formDefinitionId"]),

  submissionDocuments: defineTable({
    submissionId: v.id("submissions"),
    name: v.string(),
    storageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
  })
    .index("by_submission", ["submissionId"]),

  legalDocuments: defineTable({
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    immQuestions: v.optional(v.any()),
    documentCoverage: v.optional(v.any()),
    screeningQuestions: v.optional(v.any()),
    language: v.string(),
    // Slice 1 spike — answer key → XFA leaf name mapping for the fill worker.
    // Replaced by `legalDocumentFields` table in Slice 2 (ROADMAP).
    fieldMappings: v.optional(v.any()),
  })
    .index("by_language", ["language"]),

  generatedLegalDocs: defineTable({
    clientId: v.id("clients"),
    legalDocumentId: v.id("legalDocuments"),
    storageId: v.optional(v.id("_storage")),
    status: v.string(),
  })
    .index("by_client_doc", ["clientId", "legalDocumentId"]),

  // Demande presets — a named bundle of IMMs that go together for a given
  // demande type (e.g. "parrainage-époux au Canada" = [IMM1344, IMM5532,
  // IMM5491, IMM0008, ...]). Picking a preset is the consultant-facing
  // shortcut to attach all the right IMMs to a client in one click.
  // firmId optional: undefined = canonical (shared across all firms);
  // per-firm overrides are a future evolution.
  demandeTypes: defineTable({
    name: v.string(),
    slug: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    legalDocumentIds: v.array(v.id("legalDocuments")),
    firmId: v.optional(v.id("firms")),
  })
    .index("by_slug", ["slug"])
    .index("by_firm", ["firmId"])
    .index("by_category", ["category"]),

  // Notification profiles — a firm-scoped person + email that can be attached
  // to a client (case). When the case's form is submitted, this profile is
  // emailed; otherwise the firm's general notification email is used.
  notificationProfiles: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    email: v.string(),
  }).index("by_firm", ["firmId"]),

  // OCR-capable document catalog — canonical source of truth for which docs
  // we can extract data from + which answer keys each doc fills. Today the
  // configs live in formioform's `passport-ocr.ts` / `document-ocr-configs.ts`;
  // this table replaces that, with formioform fetching configs at render time
  // (separate slice). `fills.externalId` accepts arbitrary answer keys —
  // doesn't have to match a `questions` row, since many OCR-only fields
  // (passportNumber, expiryDate, ...) are stored on submissions without
  // ever being asked as wizard questions.
  // firmId optional: undefined = canonical (shared); per-firm overrides
  // are a future evolution.
  documents: defineTable({
    key: v.string(),
    name: v.string(),
    expectedDocumentType: v.string(),
    prompt: v.string(),
    fills: v.array(
      v.object({
        sourceKey: v.string(),
        externalId: v.string(),
        displayLabel: v.string(),
        // Transform name resolved client-side via a registry (parseDate,
        // icaoToIso2, mapGender, etc.). String, not a function, so configs
        // can travel JSON-only.
        transform: v.optional(v.string()),
      }),
    ),
    skipNameVerification: v.optional(v.boolean()),
    firmId: v.optional(v.id("firms")),
  })
    .index("by_key", ["key"])
    .index("by_firm", ["firmId"]),

  aiUsageLogs: defineTable({
    firmId: v.id("firms"),
    modelName: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    formType: v.optional(v.string()),
    submissionId: v.optional(v.id("submissions")),
  })
    .index("by_firm", ["firmId"]),

  uploadedForms: defineTable({
    firmId: v.id("firms"),
    name: v.optional(v.string()),
    formType: v.optional(v.string()),
    status: v.string(),
    storageId: v.optional(v.id("_storage")),
    batchId: v.optional(v.string()),
    legalDocumentName: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_batch", ["firmId", "batchId"]),

  feedback: defineTable({
    type: v.string(),
    firmId: v.optional(v.id("firms")),
    submissionId: v.optional(v.id("submissions")),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
    rating: v.optional(v.number()),
    nps: v.optional(v.number()),
    easeOfUse: v.optional(v.number()),
    device: v.optional(v.string()),
  })
    .index("by_firm", ["firmId"])
    .index("by_submission", ["submissionId"]),

  supplementRequests: defineTable({
    submissionId: v.id("submissions"),
    clientId: v.id("clients"),
    firmId: v.id("firms"),
    requestedSections: v.optional(v.array(v.string())),
    requestedQuestions: v.optional(v.array(v.string())),
    status: v.string(),
    answers: v.optional(v.any()),
    metadata: v.optional(v.any()),
  })
    .index("by_submission", ["submissionId"])
    .index("by_firm_status", ["firmId", "status"]),

  errorLogs: defineTable({
    source: v.string(),
    context: v.string(),
    message: v.optional(v.string()),
    details: v.optional(v.any()),
    submissionId: v.optional(v.id("submissions")),
    clientId: v.optional(v.id("clients")),
    firmId: v.optional(v.id("firms")),
  })
    .index("by_firm", ["firmId"])
    .index("by_submission", ["submissionId"]),

  questionTemplates: defineTable({
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
  }),
});
