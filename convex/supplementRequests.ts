import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
