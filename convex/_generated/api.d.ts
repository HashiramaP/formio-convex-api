/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiUsageLogs from "../aiUsageLogs.js";
import type * as clients from "../clients.js";
import type * as errorLogs from "../errorLogs.js";
import type * as feedback from "../feedback.js";
import type * as firms from "../firms.js";
import type * as formDefinitions from "../formDefinitions.js";
import type * as http from "../http.js";
import type * as legalDocuments from "../legalDocuments.js";
import type * as migrations from "../migrations.js";
import type * as questionTemplates from "../questionTemplates.js";
import type * as questions from "../questions.js";
import type * as submissionDocuments from "../submissionDocuments.js";
import type * as submissions from "../submissions.js";
import type * as supplementRequests from "../supplementRequests.js";
import type * as uploadedForms from "../uploadedForms.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiUsageLogs: typeof aiUsageLogs;
  clients: typeof clients;
  errorLogs: typeof errorLogs;
  feedback: typeof feedback;
  firms: typeof firms;
  formDefinitions: typeof formDefinitions;
  http: typeof http;
  legalDocuments: typeof legalDocuments;
  migrations: typeof migrations;
  questionTemplates: typeof questionTemplates;
  questions: typeof questions;
  submissionDocuments: typeof submissionDocuments;
  submissions: typeof submissions;
  supplementRequests: typeof supplementRequests;
  uploadedForms: typeof uploadedForms;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
