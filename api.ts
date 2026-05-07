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
    getQuestionsByExternalIds: FunctionReference<
      "query",
      "public",
      { externalIds: Array<string> },
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
    completeSupplementSubmission: FunctionReference<
      "mutation",
      "public",
      { supplementId: Id<"supplementRequests">; translatedValues?: any },
      any
    >;
  };
};
export type InternalApiType = {};
