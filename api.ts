import { type FunctionReference, anyApi } from "convex/server";
import { type GenericId as Id } from "convex/values";

export const api: PublicApiType = anyApi as unknown as PublicApiType;
export const internal: InternalApiType = anyApi as unknown as InternalApiType;

export type PublicApiType = {
  admin: {
    listAllFirms: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getFirm: FunctionReference<"query", "public", { firmId: Id<"firms"> }, any>;
    updateFirm: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        updates: {
          apiKey?: string;
          displayName?: string;
          membershipStatus?: string;
          monthlyClientLimit?: number | null;
          monthlyClientsRemaining?: number | null;
          notificationProfileLimit?: number | null;
          subscriptionEndDate?: number | null;
          subscriptionStartDate?: number | null;
        };
      },
      any
    >;
    createPendingFirm: FunctionReference<
      "mutation",
      "public",
      {
        displayName?: string;
        membershipStatus: string;
        monthlyClientLimit?: number;
        monthlyClientsRemaining?: number;
        pendingEmail: string;
        subscriptionEndDate?: number;
      },
      any
    >;
    attachInvitationToFirm: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        invitationSentAt: number;
        workosInvitationId: string;
      },
      any
    >;
    attachWorkosUserToFirm: FunctionReference<
      "mutation",
      "public",
      { pendingEmail: string; workosUserId: string },
      any
    >;
    cancelPendingFirm: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    deleteFirm: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    listAllClients: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    listAllSubmissions: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    listAllErrorLogs: FunctionReference<
      "query",
      "public",
      { limit?: number },
      any
    >;
    getAllFirmsSubmissionStats: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getGlobalSubmissionStats: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getAiUsageByFirm: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getFirmClientsDetail: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    isCurrentUserAdmin: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    listAllFormFeedback: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
  };
  aiUsageLogs: {
    logOcrTransaction: FunctionReference<
      "mutation",
      "public",
      {
        completionTokens: number;
        firmId: Id<"firms">;
        formType?: string;
        modelName: string;
        promptTokens: number;
        submissionId?: Id<"submissions">;
        totalTokens: number;
      },
      any
    >;
    listForFirm: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getFormStats: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    listAll: FunctionReference<"query", "public", Record<string, never>, any>;
  };
  clients: {
    getClient: FunctionReference<
      "query",
      "public",
      { clientId: Id<"clients"> },
      any
    >;
    setIntakeFieldOverride: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        externalId: string;
        state: "ask" | "skip" | "default";
      },
      any
    >;
    getClientByLegacyId: FunctionReference<
      "query",
      "public",
      { legacyId: string },
      any
    >;
    listClients: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getClientForFirm: FunctionReference<
      "query",
      "public",
      { clientId: Id<"clients">; firmId: Id<"firms"> },
      any
    >;
    listClientsWithActiveRevisions: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    insertClient: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        firstName: string;
        lastName: string;
        notificationProfileId?: Id<"notificationProfiles">;
      },
      any
    >;
    updateClient: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        firmId: Id<"firms">;
        updates: {
          email?: string;
          firstName?: string;
          lastName?: string;
          legalDocuments?: Array<Id<"legalDocuments">>;
          notes?: any;
          notificationProfileId?: Id<"notificationProfiles"> | null;
          phoneNumber?: string;
          primaryFormDefinitionId?: Id<"formDefinitions">;
          status?: string;
        };
      },
      any
    >;
    deleteClient: FunctionReference<
      "mutation",
      "public",
      { clientId: Id<"clients">; firmId: Id<"firms"> },
      any
    >;
    recordEmailConsent: FunctionReference<
      "mutation",
      "public",
      { clientId: Id<"clients"> },
      any
    >;
  };
  demandeTypes: {
    setDemandeType: FunctionReference<
      "mutation",
      "public",
      {
        category?: string;
        description?: string;
        firmId?: Id<"firms">;
        legalDocumentIds: Array<Id<"legalDocuments">>;
        name: string;
        slug: string;
      },
      any
    >;
    listDemandeTypes: FunctionReference<
      "query",
      "public",
      { category?: string; firmId?: Id<"firms"> },
      any
    >;
    getDemandeType: FunctionReference<
      "query",
      "public",
      { id: Id<"demandeTypes"> },
      any
    >;
    getDemandeTypeBySlug: FunctionReference<
      "query",
      "public",
      { slug: string },
      any
    >;
    attachDemandeToClient: FunctionReference<
      "mutation",
      "public",
      { clientId: Id<"clients">; demandeTypeId: Id<"demandeTypes"> },
      any
    >;
    createFirmDemandeType: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        firmId: Id<"firms">;
        legalDocumentIds: Array<Id<"legalDocuments">>;
        name: string;
      },
      any
    >;
    branchDemandeType: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms">; sourceDemandeTypeId: Id<"demandeTypes"> },
      any
    >;
    updateFirmDemandeType: FunctionReference<
      "mutation",
      "public",
      {
        demandeTypeId: Id<"demandeTypes">;
        firmId: Id<"firms">;
        updates: {
          description?: string;
          legalDocumentIds?: Array<Id<"legalDocuments">>;
          name?: string;
        };
      },
      any
    >;
    deleteFirmDemandeType: FunctionReference<
      "mutation",
      "public",
      { demandeTypeId: Id<"demandeTypes">; firmId: Id<"firms"> },
      any
    >;
  };
  documents: {
    setDocumentConfig: FunctionReference<
      "mutation",
      "public",
      {
        expectedDocumentType: string;
        fills: Array<{
          displayLabel: string;
          externalId: string;
          sourceKey: string;
          transform?: string;
        }>;
        firmId?: Id<"firms">;
        key: string;
        name: string;
        prompt: string;
        skipNameVerification?: boolean;
      },
      any
    >;
    seedCanonicalDocuments: FunctionReference<
      "mutation",
      "public",
      {
        documents: Array<{
          expectedDocumentType: string;
          fills: Array<{
            displayLabel: string;
            externalId: string;
            sourceKey: string;
            transform?: string;
          }>;
          firmId?: Id<"firms">;
          key: string;
          name: string;
          prompt: string;
          skipNameVerification?: boolean;
        }>;
      },
      any
    >;
    listDocuments: FunctionReference<
      "query",
      "public",
      { firmId?: Id<"firms"> },
      any
    >;
    getDocumentsByKeys: FunctionReference<
      "query",
      "public",
      { firmId?: Id<"firms">; keys: Array<string> },
      any
    >;
  };
  errorLogs: {
    logError: FunctionReference<
      "mutation",
      "public",
      {
        clientId?: Id<"clients">;
        context: string;
        details?: any;
        firmId?: Id<"firms">;
        message?: string;
        source: string;
        submissionId?: Id<"submissions">;
      },
      any
    >;
  };
  feedback: {
    saveFeedback: FunctionReference<
      "mutation",
      "public",
      { comment?: string; rating?: number; submissionId: Id<"submissions"> },
      any
    >;
    hasFeedback: FunctionReference<
      "query",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
    insertDashboardFeedback: FunctionReference<
      "mutation",
      "public",
      {
        email?: string;
        firmId: Id<"firms">;
        message?: string;
        title: string;
        type: string;
      },
      any
    >;
    insertMonthlyFeedback: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        formCount: number;
        otherFeedback?: string;
        rating: number;
        selectedOptions?: Array<string>;
      },
      any
    >;
    listAllFeedback: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getFeedbackStats: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
  };
  firms: {
    getFirmDisplayName: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getFirmByApiKey: FunctionReference<
      "query",
      "public",
      { apiKey: string },
      any
    >;
    getFirmByWorkosUserId: FunctionReference<
      "query",
      "public",
      { workosUserId: string },
      any
    >;
    getApiKey: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    generateApiKey: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getMonthlyClientQuota: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    decrementMonthlyClients: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getSubscriptionInfo: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getEmailSettings: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    updateEmailSettings: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        settings: {
          generalNotificationEmail?: string;
          physicalMailingAddress?: string;
          reminderCadence: {
            firstAfterDays: number;
            maxReminders: number;
            repeatEveryDays: number;
          };
          remindersEnabled: boolean;
        };
      },
      any
    >;
    getEmailOverrides: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    setDocumentNamingTemplate: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms">; template: string },
      any
    >;
    setIntakeDisabledFields: FunctionReference<
      "mutation",
      "public",
      {
        demandeTypeId: Id<"demandeTypes">;
        externalIds: Array<string>;
        firmId: Id<"firms">;
      },
      any
    >;
    setRequiredDocOverrides: FunctionReference<
      "mutation",
      "public",
      {
        added: Array<{
          custom?: boolean;
          key: string;
          label?: string;
          required?: boolean;
        }>;
        demandeTypeId: Id<"demandeTypes">;
        firmId: Id<"firms">;
        removed: Array<string>;
      },
      any
    >;
    setIntakeQuestionOverrides: FunctionReference<
      "mutation",
      "public",
      {
        added: Array<{
          custom?: boolean;
          externalId: string;
          label?: string;
          options?: any;
          required?: boolean;
          type?: string;
        }>;
        demandeTypeId: Id<"demandeTypes">;
        firmId: Id<"firms">;
        labels: Record<string, string>;
        required: Record<string, boolean>;
      },
      any
    >;
    setIntakeQuestionGuidance: FunctionReference<
      "mutation",
      "public",
      {
        demandeTypeId: Id<"demandeTypes">;
        externalId: string;
        firmId: Id<"firms">;
        patch: {
          example?: string;
          help?: string;
          indication?: string;
          label?: string;
          options?: any;
          placeholder?: string;
          shortLabel?: string;
          successMessage?: string;
          whyImportantConsequence?: string;
          whyImportantReason?: string;
        };
      },
      any
    >;
    setIntakeQuestionDependsOn: FunctionReference<
      "mutation",
      "public",
      {
        demandeTypeId: Id<"demandeTypes">;
        dependsOn?: any;
        externalId: string;
        firmId: Id<"firms">;
      },
      any
    >;
    setIntakeQuestionOrder: FunctionReference<
      "mutation",
      "public",
      {
        demandeTypeId: Id<"demandeTypes">;
        externalIds: Array<string>;
        firmId: Id<"firms">;
      },
      any
    >;
    setIntakeQuestionOcrFill: FunctionReference<
      "mutation",
      "public",
      {
        demandeTypeId: Id<"demandeTypes">;
        externalId: string;
        fill: { docKey: string } | null;
        firmId: Id<"firms">;
      },
      any
    >;
    upsertEmailOverride: FunctionReference<
      "mutation",
      "public",
      {
        email: string;
        firmId: Id<"firms">;
        formDefinitionId: Id<"formDefinitions">;
      },
      any
    >;
    deleteEmailOverride: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms">; formDefinitionId: Id<"formDefinitions"> },
      any
    >;
  };
  formDefinitions: {
    listGlobalForms: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    listCustomForms: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getFirmBaseForm: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    listFormsForSendFlow: FunctionReference<
      "query",
      "public",
      { firmId?: Id<"firms"> },
      any
    >;
    listFormsForFirm: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    createBlankForm: FunctionReference<
      "mutation",
      "public",
      {
        category: string;
        firmId: Id<"firms">;
        isBaseForm?: boolean;
        language?: string;
        name: string;
      },
      any
    >;
    renameForm: FunctionReference<
      "mutation",
      "public",
      { formId: Id<"formDefinitions">; name: string },
      any
    >;
    deleteForm: FunctionReference<
      "mutation",
      "public",
      { formId: Id<"formDefinitions"> },
      any
    >;
    getGlobalBaseForm: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    updateFormDefinition: FunctionReference<
      "mutation",
      "public",
      {
        formId: Id<"formDefinitions">;
        updates: {
          baseFormId?: Id<"formDefinitions">;
          category?: string;
          description?: string;
          excludedBaseSections?: Array<string>;
          isBaseForm?: boolean;
          isSelfContained?: boolean;
          language?: string;
          name?: string;
        };
      },
      any
    >;
    linkBaseForm: FunctionReference<
      "mutation",
      "public",
      {
        baseFormId?: Id<"formDefinitions">;
        customFormId: Id<"formDefinitions">;
      },
      any
    >;
    setBaseSectionToggles: FunctionReference<
      "mutation",
      "public",
      {
        customFormId: Id<"formDefinitions">;
        excludedBaseSections: Array<string>;
      },
      any
    >;
    forkForm: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        isBaseForm?: boolean;
        name?: string;
        sourceFormId: Id<"formDefinitions">;
      },
      any
    >;
    deleteBaseForm: FunctionReference<
      "mutation",
      "public",
      { formId: Id<"formDefinitions"> },
      any
    >;
    adminCreateCustomFormFromTemplate: FunctionReference<
      "mutation",
      "public",
      {
        category?: string;
        firmId: Id<"firms">;
        language?: string;
        name: string;
        questions: Array<{
          dependsOn?: any;
          externalId: string;
          indication?: string;
          isRequired?: boolean;
          label: string;
          multiEntryAddLabel?: string;
          multiEntryFields?: any;
          options?: any;
          placeholder?: string;
          section?: string;
          type: string;
        }>;
      },
      any
    >;
  };
  legalDocuments: {
    getLegalDocumentsByIds: FunctionReference<
      "query",
      "public",
      { ids: Array<Id<"legalDocuments">> },
      any
    >;
    listLegalDocuments: FunctionReference<
      "query",
      "public",
      { language?: string },
      any
    >;
    listGeneratedDocsForClients: FunctionReference<
      "query",
      "public",
      { clientIds: Array<Id<"clients">> },
      any
    >;
    listGeneratedDocs: FunctionReference<
      "query",
      "public",
      { clientId: Id<"clients"> },
      any
    >;
    getGeneratedDocUrl: FunctionReference<
      "query",
      "public",
      { storageId: Id<"_storage"> },
      any
    >;
    deleteGeneratedDoc: FunctionReference<
      "mutation",
      "public",
      { clientId: Id<"clients">; legalDocumentId: Id<"legalDocuments"> },
      any
    >;
    setFieldMappings: FunctionReference<
      "mutation",
      "public",
      { fieldMappings: any; legalDocumentId: Id<"legalDocuments"> },
      any
    >;
    buildFillJobPayload: FunctionReference<
      "query",
      "public",
      { clientId: Id<"clients">; legalDocumentId: Id<"legalDocuments"> },
      any
    >;
    upsertGeneratedLegalDoc: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        legalDocumentId: Id<"legalDocuments">;
        status: string;
        storageId?: Id<"_storage">;
      },
      any
    >;
    setImmQuestions: FunctionReference<
      "mutation",
      "public",
      { immQuestions: any; legalDocumentId: Id<"legalDocuments"> },
      any
    >;
    attachLegalDocsForSpike: FunctionReference<
      "mutation",
      "public",
      { clientId: Id<"clients">; legalDocuments: Array<Id<"legalDocuments">> },
      any
    >;
    getIntakeForClient: FunctionReference<
      "query",
      "public",
      { clientId: Id<"clients"> },
      any
    >;
    getIntakeCatalogForDemandeType: FunctionReference<
      "query",
      "public",
      { demandeTypeId: Id<"demandeTypes">; firmId: Id<"firms"> },
      any
    >;
  };
  notificationProfiles: {
    listNotificationProfiles: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    getNotificationProfileLimit: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    createNotificationProfile: FunctionReference<
      "mutation",
      "public",
      { email: string; firmId: Id<"firms">; name: string },
      any
    >;
    updateNotificationProfile: FunctionReference<
      "mutation",
      "public",
      {
        firmId: Id<"firms">;
        profileId: Id<"notificationProfiles">;
        updates: { email?: string; name?: string };
      },
      any
    >;
    deleteNotificationProfile: FunctionReference<
      "mutation",
      "public",
      { firmId: Id<"firms">; profileId: Id<"notificationProfiles"> },
      any
    >;
  };
  questionTemplates: {
    listTemplates: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
  };
  questions: {
    getFormQuestions: FunctionReference<
      "query",
      "public",
      { formDefinitionId: Id<"formDefinitions"> },
      any
    >;
    getOwnFormQuestions: FunctionReference<
      "query",
      "public",
      { formDefinitionId: Id<"formDefinitions"> },
      any
    >;
    getDistinctSections: FunctionReference<
      "query",
      "public",
      { formDefinitionId: Id<"formDefinitions"> },
      any
    >;
    seedCanonicalQuestions: FunctionReference<
      "mutation",
      "public",
      {
        questions: Array<{
          category?: string;
          categorySort?: number;
          example?: string;
          externalId: string;
          help?: string;
          indication?: string;
          isRequired?: boolean;
          label: string;
          multiEntryAddLabel?: string;
          multiEntryFields?: any;
          options?: any;
          placeholder?: string;
          shortLabel?: string;
          type: string;
          validationRules?: any;
        }>;
      },
      any
    >;
    setQuestionDependsOnBatch: FunctionReference<
      "mutation",
      "public",
      { items: Array<{ dependsOn: any; externalId: string }> },
      any
    >;
    getQuestionsByExternalIds: FunctionReference<
      "query",
      "public",
      { externalIds: Array<string> },
      any
    >;
    upsertQuestionsBatch: FunctionReference<
      "mutation",
      "public",
      {
        questions: Array<{
          example?: string;
          externalId: string;
          firmId?: Id<"firms">;
          help?: string;
          indication?: string;
          isRequired?: boolean;
          label: string;
          multiEntryFields?: any;
          options?: any;
          placeholder?: string;
          shortLabel?: string;
          type: string;
          whyImportantConsequence?: string;
          whyImportantReason?: string;
        }>;
      },
      any
    >;
    replaceFormQuestions: FunctionReference<
      "mutation",
      "public",
      {
        formDefinitionId: Id<"formDefinitions">;
        rows: Array<{
          dependsOn?: any;
          labelOverride?: string;
          orderIndex: number;
          questionKey: string;
          requiredOverride?: boolean;
          section?: string;
          sectionTranslations?: any;
        }>;
      },
      any
    >;
  };
  submissionDocuments: {
    generateUploadUrl: FunctionReference<"mutation", "public", any, any>;
    registerDocument: FunctionReference<
      "mutation",
      "public",
      {
        fileType?: string;
        name: string;
        storageId: Id<"_storage">;
        submissionId: Id<"submissions">;
      },
      any
    >;
    listDocuments: FunctionReference<
      "query",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
    deleteDocument: FunctionReference<
      "mutation",
      "public",
      { documentId: Id<"submissionDocuments"> },
      any
    >;
    getDocumentUrl: FunctionReference<
      "query",
      "public",
      { storageId: Id<"_storage"> },
      any
    >;
  };
  submissions: {
    getSubmission: FunctionReference<
      "query",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
    initGroupedSubmissions: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        firmId: Id<"firms">;
        formGroup: string;
        forms: Array<{
          formDefinitionId: Id<"formDefinitions">;
          formType?: string;
        }>;
        preferredLanguage?: string;
        title: string;
      },
      any
    >;
    initSubmission: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        firmId: Id<"firms">;
        formType?: string;
        preferredLanguage?: string;
        title: string;
      },
      any
    >;
    markStarted: FunctionReference<
      "mutation",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
    saveAnswer: FunctionReference<
      "mutation",
      "public",
      {
        questionId: string;
        submissionId: Id<"submissions">;
        translatedValue?: any;
        value: any;
      },
      any
    >;
    saveInitialAnswers: FunctionReference<
      "mutation",
      "public",
      { answers: any; submissionId: Id<"submissions">; translatedValues?: any },
      any
    >;
    completeSubmission: FunctionReference<
      "mutation",
      "public",
      { startedAt?: string; submissionId: Id<"submissions"> },
      any
    >;
    listClientSubmissions: FunctionReference<
      "query",
      "public",
      { clientId: Id<"clients">; firmId: Id<"firms"> },
      any
    >;
    updateSubmissionFromDashboard: FunctionReference<
      "mutation",
      "public",
      {
        submissionId: Id<"submissions">;
        updates: {
          answers?: any;
          metadata?: any;
          skippedSections?: any;
          status?: string;
          title?: string;
        };
      },
      any
    >;
    deleteSubmission: FunctionReference<
      "mutation",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
    checkGroupCompletion: FunctionReference<
      "query",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
  };
  supplementRequests: {
    getSupplementRequest: FunctionReference<
      "query",
      "public",
      { id: Id<"supplementRequests"> },
      any
    >;
    saveSupplementAnswer: FunctionReference<
      "mutation",
      "public",
      {
        questionId: string;
        supplementId: Id<"supplementRequests">;
        value: any;
      },
      any
    >;
    createSupplementRequest: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        firmId: Id<"firms">;
        requestedQuestions: Array<string>;
        requestedSections: Array<string>;
        submissionId: Id<"submissions">;
      },
      any
    >;
    listForSubmission: FunctionReference<
      "query",
      "public",
      { submissionId: Id<"submissions"> },
      any
    >;
    deleteSupplementRequest: FunctionReference<
      "mutation",
      "public",
      { removeAnswers?: boolean; supplementId: Id<"supplementRequests"> },
      any
    >;
    completeSupplementSubmission: FunctionReference<
      "mutation",
      "public",
      { supplementId: Id<"supplementRequests">; translatedValues?: any },
      any
    >;
  };
  uploadedForms: {
    insertUploadedForm: FunctionReference<
      "mutation",
      "public",
      {
        batchId?: string;
        firmId: Id<"firms">;
        formType?: string;
        legalDocumentName?: string;
        name?: string;
        status: string;
      },
      any
    >;
    listUploadedForms: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    listActiveUploads: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    updateUploadStatus: FunctionReference<
      "mutation",
      "public",
      {
        id: Id<"uploadedForms">;
        updates: {
          error?: string;
          status?: string;
          storageId?: Id<"_storage">;
        };
      },
      any
    >;
    deleteBatch: FunctionReference<
      "mutation",
      "public",
      { batchId: string; firmId: Id<"firms"> },
      any
    >;
  };
};
export type InternalApiType = {};
