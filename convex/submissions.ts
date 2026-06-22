import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireFirmAccess, requireSubmissionAccess } from "./auth";
import { computeClientIntakeSnapshot } from "./legalDocuments";

// Keep `clients.status` in sync with the client's submissions. Historically the
// submission flow never patched it, so filtering by client.status stranded
// submitted clients in "new". Derivation (matches the dashboard): submitted only
// when every submission is submitted; in_progress if any is started; else new.
async function syncClientStatus(
  ctx: any,
  clientId: import("./_generated/dataModel").Id<"clients"> | undefined,
) {
  if (!clientId) return;
  const subs = await ctx.db
    .query("submissions")
    .withIndex("by_client", (q: any) => q.eq("clientId", clientId))
    .collect();
  let status = "new";
  if (subs.length > 0) {
    if (subs.every((s: any) => s.status === "submitted")) status = "submitted";
    else if (subs.some((s: any) => s.status === "submitted" || s.status === "in_progress"))
      status = "in_progress";
  }
  const client = await ctx.db.get(clientId);
  if (client && client.status !== status) await ctx.db.patch(clientId, { status });
}

// Most submission functions are called by form-website (anonymous) using
// submissionId from the URL. URL-as-token model: leave open. Dashboard-only
// surfaces (listClientSubmissions, updateSubmissionFromDashboard,
// deleteSubmission) require firm membership.
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
        ? {
            _id: formDefinition._id,
            name: formDefinition.name,
            language: formDefinition.language,
          }
        : null,
    };
  },
});

/**
 * Init multiple linked submissions for a grouped form (e.g. Parrainage Couple
 * splits into Couple + Demandeur + Répondant). Each gets its own row but
 * shares the same groupId, so the dashboard can render them as a single
 * client case with multiple links.
 */
export const initGroupedSubmissions = mutation({
  args: {
    clientId: v.id("clients"),
    firmId: v.id("firms"),
    title: v.string(),
    formGroup: v.string(),
    forms: v.array(
      v.object({
        formDefinitionId: v.id("formDefinitions"),
        formType: v.optional(v.string()),
      }),
    ),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, firmId, title, formGroup, forms, preferredLanguage }) => {
    // Idempotency: if grouped submissions already exist for this client with
    // matching formGroup metadata, return them rather than creating duplicates.
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const existingGroup = existing.find(
      (s) => s.groupId && s.metadata && (s.metadata as any).formGroup === formGroup,
    );
    if (existingGroup?.groupId) {
      const groupSubs = existing.filter((s) => s.groupId === existingGroup.groupId);
      if (preferredLanguage) {
        for (const sub of groupSubs) {
          if (sub.preferredLanguage !== preferredLanguage) {
            await ctx.db.patch(sub._id, { preferredLanguage });
          }
        }
      }
      return {
        alreadyExists: true as const,
        groupId: existingGroup.groupId,
        submissions: groupSubs.map((s) => ({
          submissionId: s._id,
          formDefinitionId: s.formDefinitionId,
          formType: s.formType,
        })),
      };
    }

    const groupId = crypto.randomUUID();
    const submissions = [];
    for (const f of forms) {
      const id = await ctx.db.insert("submissions", {
        clientId,
        firmId,
        title,
        formType: f.formType,
        formDefinitionId: f.formDefinitionId,
        status: "in_progress",
        answers: {},
        metadata: { formGroup },
        groupId,
        preferredLanguage,
      });
      submissions.push({
        submissionId: id,
        formDefinitionId: f.formDefinitionId,
        formType: f.formType,
      });
    }
    await syncClientStatus(ctx, clientId);

    return { alreadyExists: false as const, groupId, submissions };
  },
});

export const initSubmission = mutation({
  args: {
    clientId: v.id("clients"),
    firmId: v.id("firms"),
    title: v.string(),
    formType: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, firmId, title, formType, preferredLanguage }) => {
    const submitted = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .filter((q) => q.eq(q.field("status"), "submitted"))
      .first();

    if (submitted) {
      return { alreadySubmitted: true as const, submissionId: submitted._id };
    }

    // Resolve formDefinitionId from the client so the wizard knows which form
    // to render when the link is /app/{submissionId} (otherwise it falls back
    // to static base questions and never asks the form-specific questions).
    const client = await ctx.db.get(clientId);
    const formDefinitionId = client?.primaryFormDefinitionId;

    const inProgress = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .order("desc")
      .first();

    if (inProgress) {
      const patch: Record<string, unknown> = {};
      // Backfill formDefinitionId on legacy in_progress submissions that were
      // created before this field was tracked here.
      if (!inProgress.formDefinitionId && formDefinitionId) {
        patch.formDefinitionId = formDefinitionId;
      }
      if (preferredLanguage && inProgress.preferredLanguage !== preferredLanguage) {
        patch.preferredLanguage = preferredLanguage;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(inProgress._id, patch);
      }
      return {
        alreadySubmitted: false as const,
        submissionId: inProgress._id,
        answers: inProgress.answers,
        skippedSections: inProgress.skippedSections,
        documentOnly: inProgress.documentOnly,
        metadata: inProgress.metadata,
        preferredLanguage: preferredLanguage ?? inProgress.preferredLanguage,
      };
    }

    const id = await ctx.db.insert("submissions", {
      clientId,
      firmId,
      title,
      formType,
      formDefinitionId,
      status: "in_progress",
      answers: {},
      metadata: {},
      preferredLanguage,
    });
    await syncClientStatus(ctx, clientId);

    return {
      alreadySubmitted: false as const,
      submissionId: id,
      answers: {},
      skippedSections: undefined,
      documentOnly: undefined,
      metadata: {},
      preferredLanguage,
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
    // Freeze the intake questions the client saw, so the responses view never
    // drifts if the demande type is edited later. Empty for legacy form clients.
    const snapshot = submission.clientId
      ? await computeClientIntakeSnapshot(ctx, submission.clientId)
      : [];
    await ctx.db.patch(submissionId, {
      status: "submitted",
      ...(snapshot.length > 0 ? { intakeSnapshot: snapshot } : {}),
      metadata: {
        ...metadata,
        started_at: startedAt ?? null,
        submitted_at: new Date().toISOString(),
      },
    });
    await syncClientStatus(ctx, submission.clientId);

    // Notify the firm out-of-band (case's notification profile, else the firm's
    // general email). Scheduled so a Resend failure never blocks the submission.
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.sendSubmissionNotification,
      { submissionId },
    );
  },
});

export const listClientSubmissions = query({
  args: { firmId: v.id("firms"), clientId: v.id("clients") },
  handler: async (ctx, { firmId, clientId }) => {
    await requireFirmAccess(ctx, firmId);
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const filtered = submissions.filter((s) => s.firmId === firmId);

    return await Promise.all(
      filtered.map(async (s) => {
        const formDef = s.formDefinitionId
          ? await ctx.db.get(s.formDefinitionId)
          : null;
        return {
          ...s,
          formDefinitionName: formDef?.name ?? null,
        };
      }),
    );
  },
});

export const updateSubmissionFromDashboard = mutation({
  args: {
    submissionId: v.id("submissions"),
    updates: v.object({
      status: v.optional(v.string()),
      answers: v.optional(v.any()),
      metadata: v.optional(v.any()),
      skippedSections: v.optional(v.any()),
      title: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { submissionId, updates }) => {
    await requireSubmissionAccess(ctx, submissionId);
    await ctx.db.patch(submissionId, updates);
  },
});

export const deleteSubmission = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    await requireSubmissionAccess(ctx, submissionId);
    await ctx.db.delete(submissionId);
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
