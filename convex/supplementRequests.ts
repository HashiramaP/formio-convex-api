import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireFirmAccess, requireSubmissionAccess, AuthError } from "./auth";

// `getSupplementRequest`, `saveSupplementAnswer`, `completeSupplementSubmission`
// are called from form-website (anonymous follow-up flow). The supplementId in
// the URL is the bearer token. Leave open.
//
// `createSupplementRequest`, `listForSubmission`, `deleteSupplementRequest`
// are dashboard-only — firm-scoped.

export const getSupplementRequest = query({
  args: { id: v.id("supplementRequests") },
  handler: async (ctx, { id }) => {
    const supplement = await ctx.db.get(id);
    if (!supplement) return null;

    const submission = await ctx.db.get(supplement.submissionId);
    const client = submission?.clientId
      ? await ctx.db.get(submission.clientId)
      : null;

    return {
      ...supplement,
      submission: submission
        ? {
            _id: submission._id,
            clientId: submission.clientId,
            firmId: submission.firmId,
            formDefinitionId: submission.formDefinitionId,
            answers: submission.answers,
            translatedAnswers: submission.translatedAnswers,
            preferredLanguage: submission.preferredLanguage,
            skippedSections: submission.skippedSections,
            documentOnly: submission.documentOnly,
            status: submission.status,
            metadata: submission.metadata,
          }
        : null,
      client: client
        ? {
            _id: client._id,
            primaryFormDefinitionId: client.primaryFormDefinitionId,
          }
        : null,
    };
  },
});

export const saveSupplementAnswer = mutation({
  args: {
    supplementId: v.id("supplementRequests"),
    questionId: v.string(),
    value: v.any(),
  },
  handler: async (ctx, { supplementId, questionId, value }) => {
    const supplement = await ctx.db.get(supplementId);
    if (!supplement) throw new Error("Supplement request not found");

    const answers = {
      ...((supplement.answers as Record<string, unknown>) ?? {}),
    };
    answers[questionId] = value;

    await ctx.db.patch(supplementId, {
      answers,
      status: "in_progress",
    });
  },
});

export const createSupplementRequest = mutation({
  args: {
    submissionId: v.id("submissions"),
    clientId: v.id("clients"),
    firmId: v.id("firms"),
    requestedSections: v.array(v.string()),
    requestedQuestions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const firm = await requireFirmAccess(ctx, args.firmId);
    // Cross-check parents belong to the same firm — defends against a malicious
    // caller passing their own firmId but someone else's clientId/submissionId.
    const submission = await ctx.db.get(args.submissionId);
    const client = await ctx.db.get(args.clientId);
    if (!submission || submission.firmId !== firm._id) {
      throw new AuthError("Unauthorized: submission not in caller's firm");
    }
    if (!client || client.firmId !== firm._id) {
      throw new AuthError("Unauthorized: client not in caller's firm");
    }
    const id = await ctx.db.insert("supplementRequests", {
      ...args,
      status: "pending",
      answers: {},
      metadata: { created_at: new Date().toISOString() },
    });
    // Move client to "in_progress"
    await ctx.db.patch(args.clientId, { status: "in_progress" });
    return id;
  },
});

export const listForSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    await requireSubmissionAccess(ctx, submissionId);
    const requests = await ctx.db
      .query("supplementRequests")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .collect();
    return requests.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const deleteSupplementRequest = mutation({
  args: {
    supplementId: v.id("supplementRequests"),
    removeAnswers: v.optional(v.boolean()),
  },
  handler: async (ctx, { supplementId, removeAnswers }) => {
    const supplement = await ctx.db.get(supplementId);
    if (!supplement) return;
    // Dashboard-only delete — confirm caller owns the firm that owns this
    // supplement. The form-website "complete" path goes through
    // completeSupplementSubmission, not delete.
    await requireFirmAccess(ctx, supplement.firmId);

    const submission = await ctx.db.get(supplement.submissionId);
    if (submission) {
      const supplementAnswers =
        (supplement.answers as Record<string, unknown>) ?? {};
      const answerKeys = Object.keys(supplementAnswers);

      const currentAnswers =
        (submission.answers as Record<string, unknown>) ?? {};
      const currentSkipped =
        (submission.skippedSections as string[] | null) ?? [];
      const requestedSections = supplement.requestedSections ?? [];

      if (removeAnswers && answerKeys.length > 0) {
        const cleaned = { ...currentAnswers };
        for (const key of answerKeys) {
          delete cleaned[key];
        }
        const newSkipped = Array.from(
          new Set([...currentSkipped, ...requestedSections]),
        );
        await ctx.db.patch(submission._id, {
          answers: cleaned,
          skippedSections: newSkipped,
        });
      } else if (!removeAnswers && answerKeys.length > 0) {
        const merged = { ...currentAnswers, ...supplementAnswers };
        const newSkipped = currentSkipped.filter(
          (s) => !requestedSections.includes(s),
        );
        await ctx.db.patch(submission._id, {
          answers: merged,
          skippedSections: newSkipped.length > 0 ? newSkipped : undefined,
        });
      }
    }

    await ctx.db.delete(supplementId);

    // Restore client status if no remaining active supplements
    const clientId = supplement.clientId;
    const remaining = await ctx.db
      .query("supplementRequests")
      .withIndex("by_firm_status", (q) => q.eq("firmId", supplement.firmId))
      .collect();
    const activeForClient = remaining.filter(
      (r) =>
        r.clientId === clientId &&
        (r.status === "pending" || r.status === "in_progress"),
    );
    if (activeForClient.length === 0) {
      await ctx.db.patch(clientId, { status: "submitted" });
    }
  },
});

export const completeSupplementSubmission = mutation({
  args: {
    supplementId: v.id("supplementRequests"),
    translatedValues: v.optional(v.any()),
  },
  handler: async (ctx, { supplementId, translatedValues }) => {
    const supplement = await ctx.db.get(supplementId);
    if (!supplement) throw new Error("Supplement request not found");

    const submission = await ctx.db.get(supplement.submissionId);
    if (!submission) throw new Error("Original submission not found");

    const supplementAnswers =
      (supplement.answers as Record<string, unknown>) ?? {};
    const existingAnswers =
      (submission.answers as Record<string, unknown>) ?? {};
    const mergedAnswers = { ...existingAnswers, ...supplementAnswers };

    const skippedSections =
      (submission.skippedSections as string[] | null) ?? [];
    const requestedSections = supplement.requestedSections ?? [];
    const updatedSkipped = skippedSections.filter(
      (s) => !requestedSections.includes(s),
    );

    const existingTranslated =
      (submission.translatedAnswers as Record<string, unknown>) ?? {};
    const mergedTranslated = translatedValues
      ? {
          ...existingTranslated,
          ...(translatedValues as Record<string, unknown>),
        }
      : existingTranslated;

    await ctx.db.patch(submission._id, {
      answers: mergedAnswers,
      skippedSections: updatedSkipped.length > 0 ? updatedSkipped : undefined,
      translatedAnswers:
        Object.keys(mergedTranslated).length > 0 ? mergedTranslated : undefined,
    });

    const metadata = (supplement.metadata as Record<string, unknown>) ?? {};
    await ctx.db.patch(supplementId, {
      status: "submitted",
      metadata: {
        ...metadata,
        submitted_at: new Date().toISOString(),
      },
    });
  },
});
