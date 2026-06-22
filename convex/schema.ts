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
    // Per-firm template for naming documents downloaded for a client. Tokens
    // like {nom} {prenom} {typeDocument} {dateUpload} {date} {courriel} are
    // substituted at download time. Unset/empty = default naming. Opt-in: the
    // feature is inert until a firm configures a template.
    documentNamingTemplate: v.optional(v.string()),
    // Intake curation — per demande type, the externalIds the firm chose NOT to
    // ask the client (everything else is asked). Keyed by demandeTypeId. Absent
    // type / absent id = asked. See INTAKE-CURATION-PLAN.md.
    intakeDisabledFields: v.optional(
      v.record(v.string(), v.array(v.string())),
    ),
    // Intake curation — per demande type, document add/remove overrides on top
    // of the IMM-derived required-document list. `removed` drops a doc key the
    // IMMs declared; `added` appends one (from the `documents` catalog, or a
    // `custom` firm-defined label with no OCR). Keyed by demandeTypeId.
    requiredDocOverrides: v.optional(
      v.record(
        v.string(),
        v.object({
          removed: v.array(v.string()),
          added: v.array(
            v.object({
              key: v.string(),
              label: v.optional(v.string()),
              required: v.optional(v.boolean()),
              custom: v.optional(v.boolean()),
            }),
          ),
          // Per-document short description (what's accepted / format), shown
          // under the doc name in the wizard. Keyed by doc key. AI-generated on
          // add; firm can edit. Per demande type — canonical docs untouched.
          descriptions: v.optional(v.record(v.string(), v.string())),
        }),
      ),
    ),
    // Intake curation — per demande type, edits to the QUESTIONS (composition,
    // never definition of a mapped field). `labels`: reword a question's display
    // text only (externalId/type/mapping unchanged). `required`: per-question
    // required override. `added`: questions added on top of the IMM union —
    // either a canonical catalog question (custom=false, externalId is real) or
    // a firm-defined informational question (custom=true, never feeds a PDF).
    intakeQuestionOverrides: v.optional(
      v.record(
        v.string(),
        v.object({
          labels: v.optional(v.record(v.string(), v.string())),
          required: v.optional(v.record(v.string(), v.boolean())),
          added: v.optional(
            v.array(
              v.object({
                externalId: v.string(),
                custom: v.optional(v.boolean()),
                label: v.optional(v.string()),
                type: v.optional(v.string()),
                options: v.optional(v.any()),
                // Sub-field config for `type: "multi-entry"` custom questions
                // (key/label/type per column). Free-form to mirror the wizard's
                // MultiEntryFieldDef without coupling the schema to it.
                multiEntryFields: v.optional(v.any()),
                required: v.optional(v.boolean()),
              }),
            ),
          ),
          // Firm's custom ordering for this demande type — the full list of
          // externalIds in the desired order. Questions not listed keep their
          // default (category) position, appended after. Applied by the wizard.
          order: v.optional(v.array(v.string())),
          // OCR auto-fill wiring: question externalId → the document that should
          // extract & fill it. The question itself (its label) is the extraction
          // instruction — at query time we add it to that document's effective
          // fills AND augment its OCR prompt (scoped to this demande type; the
          // canonical documents row is never modified). Lets firms add new
          // extracted fields just by attaching a question to a document.
          ocrFill: v.optional(
            v.record(v.string(), v.object({ docKey: v.string() })),
          ),
          // Per-question conditional visibility override, keyed by externalId.
          // Shape mirrors a question's dependsOn ({questionId, value} single,
          // value array for multi-value, or array of conditions for OR). When
          // set, it overrides the effective dependsOn for THIS demande type.
          dependsOn: v.optional(v.record(v.string(), v.any())),
          // Sparse per-question guidance overrides: only the fields the firm
          // actually reworded are stored; everything else falls back to the
          // canonical Formio text. Keyed by externalId. The wizard renders the
          // merged result (catalog ⊕ guidance). Never mutates the canonical row.
          guidance: v.optional(
            v.record(
              v.string(),
              v.object({
                shortLabel: v.optional(v.string()),
                label: v.optional(v.string()),
                indication: v.optional(v.string()),
                example: v.optional(v.string()),
                help: v.optional(v.string()),
                placeholder: v.optional(v.string()),
                whyImportantReason: v.optional(v.string()),
                whyImportantConsequence: v.optional(v.string()),
                successMessage: v.optional(v.string()),
                options: v.optional(v.any()),
              }),
            ),
          ),
        }),
      ),
    ),
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
    // Which demande type this client was created from (set by
    // attachDemandeToClient). Drives which firm curation config applies. Unset
    // = client assembled manually → no firm default → everything asked.
    demandeTypeId: v.optional(v.id("demandeTypes")),
    // Per-client intake overrides on top of the firm's per-demande-type
    // default: externalId → "ask" (force-show) | "skip" (force-hide). Absent =
    // follow the firm default. See INTAKE-CURATION-PLAN.md.
    intakeFieldOverrides: v.optional(v.record(v.string(), v.string())),
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
    // Frozen snapshot of the intake questions the client saw, captured at submit
    // time (externalId/label/type/section/order). The responses view renders
    // from this so it never drifts when the demande type is edited afterward.
    intakeSnapshot: v.optional(v.any()),
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

  // A firm's imported intake form, stored as its MAPPING only (no file kept).
  // Reusable: apply it as the intake of any demande type without re-uploading.
  importedForms: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    questions: v.array(
      v.object({
        externalId: v.union(v.string(), v.null()), // canonical match, or null
        label: v.string(),
        type: v.string(),
      }),
    ),
    documents: v.array(
      v.object({
        docKey: v.union(v.string(), v.null()), // canonical doc key, or null
        label: v.string(),
      }),
    ),
  }).index("by_firm", ["firmId"]),

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
