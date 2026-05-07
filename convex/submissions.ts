import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) return null;

    const client = submission.clientId
      ? await ctx.db.get(submission.clientId)
      : null;
    const formDefinition = submission.formDefinitionId
      ? await ctx.db.get(submission.formDefinitionId)
      : null;

    return {
      ...submission,
      client: client
        ? {
            _id: client._id,
            firstName: client.firstName,
            lastName: client.lastName,
            firmId: client.firmId,
            primaryFormDefinitionId: client.primaryFormDefinitionId,
          }
        : null,
      formDefinition: formDefinition
        ? { _id: formDefinition._id, name: formDefinition.name }
        : null,
    };
  },
});

export const initSubmission = mutation({
  args: {
    clientId: v.id("clients"),
    firmId: v.id("firms"),
    title: v.string(),
    formType: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, firmId, title, formType }) => {
    const submitted = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .filter((q) => q.eq(q.field("status"), "submitted"))
      .first();

    if (submitted) {
      return { alreadySubmitted: true as const, submissionId: submitted._id };
    }

    const inProgress = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .order("desc")
      .first();

    if (inProgress) {
      return {
        alreadySubmitted: false as const,
        submissionId: inProgress._id,
        answers: inProgress.answers,
        skippedSections: inProgress.skippedSections,
        documentOnly: inProgress.documentOnly,
        metadata: inProgress.metadata,
        preferredLanguage: inProgress.preferredLanguage,
      };
    }

    const id = await ctx.db.insert("submissions", {
      clientId,
      firmId,
      title,
      formType,
      status: "in_progress",
      answers: {},
      metadata: {},
    });

    return {
      alreadySubmitted: false as const,
      submissionId: id,
      answers: {},
      skippedSections: undefined,
      documentOnly: undefined,
      metadata: {},
      preferredLanguage: undefined,
    };
  },
});

export const markStarted = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) return;

    const metadata = (submission.metadata as Record<string, unknown>) ?? {};
    await ctx.db.patch(submissionId, {
      metadata: { ...metadata, started_at: new Date().toISOString() },
    });
  },
});

export const saveAnswer = mutation({
  args: {
    submissionId: v.id("submissions"),
    questionId: v.string(),
    value: v.any(),
    translatedValue: v.optional(v.any()),
  },
  handler: async (ctx, { submissionId, questionId, value, translatedValue }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found");

    const answers = { ...((submission.answers as Record<string, unknown>) ?? {}) };
    answers[questionId] = value;

    const update: Record<string, unknown> = { answers };

    if (translatedValue !== undefined) {
      const translated = {
        ...((submission.translatedAnswers as Record<string, unknown>) ?? {}),
      };
      translated[questionId] = translatedValue;
      update.translatedAnswers = translated;
    }

    await ctx.db.patch(submissionId, update);
  },
});

export const saveInitialAnswers = mutation({
  args: {
    submissionId: v.id("submissions"),
    answers: v.any(),
    translatedValues: v.optional(v.any()),
  },
  handler: async (ctx, { submissionId, answers: newAnswers, translatedValues }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found");

    const existing = (submission.answers as Record<string, unknown>) ?? {};
    const merged = { ...existing, ...(newAnswers as Record<string, unknown>) };

    const update: Record<string, unknown> = { answers: merged };

    if (translatedValues) {
      const existingTranslated =
        (submission.translatedAnswers as Record<string, unknown>) ?? {};
      update.translatedAnswers = {
        ...existingTranslated,
        ...(translatedValues as Record<string, unknown>),
      };
    }

    await ctx.db.patch(submissionId, update);
  },
});

export const completeSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    startedAt: v.optional(v.string()),
  },
  handler: async (ctx, { submissionId, startedAt }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found");

    const metadata = (submission.metadata as Record<string, unknown>) ?? {};
    await ctx.db.patch(submissionId, {
      status: "submitted",
      metadata: {
        ...metadata,
        started_at: startedAt ?? null,
        submitted_at: new Date().toISOString(),
      },
    });
  },
});

export const checkGroupCompletion = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission?.groupId) return { allSubmitted: true, groupId: null };

    const groupSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_group", (q) => q.eq("groupId", submission.groupId))
      .collect();

    const allSubmitted = groupSubmissions.every((s) => s.status === "submitted");

    return {
      allSubmitted,
      groupId: submission.groupId,
      submissions: groupSubmissions.map((s) => ({
        _id: s._id,
        status: s.status,
      })),
    };
  },
});
