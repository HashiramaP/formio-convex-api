import { type FunctionReference, anyApi } from "convex/server";
import { type GenericId as Id } from "convex/values";

export const api: PublicApiType = anyApi as unknown as PublicApiType;
export const internal: InternalApiType = anyApi as unknown as InternalApiType;

export type PublicApiType = {
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
      { firmId: Id<"firms">; firstName: string; lastName: string },
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
    getCredits: FunctionReference<
      "query",
      "public",
      { firmId: Id<"firms"> },
      any
    >;
    decrementCredits: FunctionReference<
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
  };
  questions: {
    getFormQuestions: FunctionReference<
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
          externalId: string;
          label: string;
          shortLabel?: string;
          type: string;
          options?: any;
          isRequired?: boolean;
          multiEntryFields?: any;
          indication?: string;
          help?: string;
          placeholder?: string;
          example?: string;
          whyImportantReason?: string;
          whyImportantConsequence?: string;
          firmId?: Id<"firms">;
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
          questionKey: string;
          orderIndex: number;
          section?: string;
          sectionTranslations?: any;
          dependsOn?: any;
          labelOverride?: string;
          requiredOverride?: boolean;
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
    initSubmission: FunctionReference<
      "mutation",
      "public",
      {
        clientId: Id<"clients">;
        firmId: Id<"firms">;
        formType?: string;
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
    getGlobalBaseForm: FunctionReference<
      "query",
      "public",
      Record<string, never>,
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
    updateFormDefinition: FunctionReference<
      "mutation",
      "public",
      {
        formId: Id<"formDefinitions">;
        updates: {
          name?: string;
          description?: string;
          category?: string;
          isBaseForm?: boolean;
          baseFormId?: Id<"formDefinitions">;
          excludedBaseSections?: Array<string>;
          isSelfContained?: boolean;
        };
      },
      any
    >;
    linkBaseForm: FunctionReference<
      "mutation",
      "public",
      {
        customFormId: Id<"formDefinitions">;
        baseFormId?: Id<"formDefinitions">;
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
        sourceFormId: Id<"formDefinitions">;
        firmId: Id<"firms">;
        isBaseForm?: boolean;
        name?: string;
      },
      any
    >;
    deleteForm: FunctionReference<
      "mutation",
      "public",
      { formId: Id<"formDefinitions"> },
      any
    >;
    deleteBaseForm: FunctionReference<
      "mutation",
      "public",
      { formId: Id<"formDefinitions"> },
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
