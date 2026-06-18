import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { isAdmin, requireAdmin, requireWorkosUserId, AuthError } from "./auth";

// Admin-only functions. Every handler calls `requireAdmin(ctx)` which checks
// (a) the request carries a valid WorkOS JWT and (b) the JWT's `sub` claim is
// in the ADMIN_WORKOS_USER_IDS Convex env var. The previous version trusted
// the admin-website client to filter by email — bypassable from the browser
// console.
//
// `attachWorkosUserToFirm` is the one exception: a brand-new user has to claim
// their pending firm before they have any role, so it requires only auth.

export const listAllFirms = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const firms = await ctx.db.query("firms").collect();
    return firms.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getFirm = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(firmId);
  },
});

export const updateFirm = mutation({
  args: {
    firmId: v.id("firms"),
    updates: v.object({
      displayName: v.optional(v.string()),
      membershipStatus: v.optional(v.string()),
      subscriptionStartDate: v.optional(v.union(v.number(), v.null())),
      subscriptionEndDate: v.optional(v.union(v.number(), v.null())),
      monthlyClientsRemaining: v.optional(v.union(v.number(), v.null())),
      monthlyClientLimit: v.optional(v.union(v.number(), v.null())),
      apiKey: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { firmId, updates }) => {
    await requireAdmin(ctx);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      // Convex `null` clears optional fields; pass through.
      patch[key] = value;
    }
    await ctx.db.patch(firmId, patch);
    return await ctx.db.get(firmId);
  },
});

// Invitation flow:
// 1. createPendingFirm — admin creates a firm row keyed by pendingEmail.
// 2. (admin website) calls WorkOS sendInvitation, then attachInvitationToFirm.
// 3. User accepts invitation, signs in via main-website. AuthContext calls
//    attachWorkosUserToFirm, which claims the pending firm by email.
// A firm is "pending" iff workosUserId is unset.

const normalizeEmail = (email: string) => email.toLowerCase().trim();

export const createPendingFirm = mutation({
  args: {
    pendingEmail: v.string(),
    displayName: v.optional(v.string()),
    membershipStatus: v.string(),
    subscriptionEndDate: v.optional(v.number()),
    monthlyClientLimit: v.optional(v.number()),
    monthlyClientsRemaining: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const email = normalizeEmail(args.pendingEmail);

    const existingPending = await ctx.db
      .query("firms")
      .withIndex("by_pendingEmail", (q) => q.eq("pendingEmail", email))
      .first();
    if (existingPending) {
      throw new Error(
        `A firm is already pending invitation for ${email}`,
      );
    }

    return await ctx.db.insert("firms", {
      pendingEmail: email,
      displayName: args.displayName,
      membershipStatus: args.membershipStatus,
      subscriptionEndDate: args.subscriptionEndDate,
      monthlyClientLimit: args.monthlyClientLimit,
      monthlyClientsRemaining: args.monthlyClientsRemaining,
    });
  },
});

export const attachInvitationToFirm = mutation({
  args: {
    firmId: v.id("firms"),
    workosInvitationId: v.string(),
    invitationSentAt: v.number(),
  },
  handler: async (ctx, { firmId, workosInvitationId, invitationSentAt }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(firmId, { workosInvitationId, invitationSentAt });
    return await ctx.db.get(firmId);
  },
});

export const attachWorkosUserToFirm = mutation({
  args: {
    pendingEmail: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, { pendingEmail, workosUserId }) => {
    // Self-claim only: a freshly-signed-in user attaching themselves to their
    // pending firm. Anything else (admin claiming on behalf of someone) goes
    // through createPendingFirm + attachInvitationToFirm.
    const callerWorkosId = await requireWorkosUserId(ctx);
    if (callerWorkosId !== workosUserId) {
      throw new AuthError(
        "Unauthorized: workosUserId arg must match the JWT subject (self-claim only)",
      );
    }
    const email = normalizeEmail(pendingEmail);

    // Idempotent: if the user already owns a firm, return it.
    const owned = await ctx.db
      .query("firms")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
      .first();
    if (owned) return owned;

    const pending = await ctx.db
      .query("firms")
      .withIndex("by_pendingEmail", (q) => q.eq("pendingEmail", email))
      .first();
    if (!pending) return null;

    await ctx.db.patch(pending._id, {
      workosUserId,
      pendingEmail: undefined,
    });
    return await ctx.db.get(pending._id);
  },
});

export const cancelPendingFirm = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireAdmin(ctx);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    if (firm.workosUserId) {
      throw new Error(
        "Cannot cancel: firm is already attached to a WorkOS user",
      );
    }
    await ctx.db.delete(firmId);
  },
});

export const deleteFirm = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(firmId);
  },
});

export const listAllClients = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const clients = await ctx.db.query("clients").collect();
    return clients.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listAllSubmissions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db.query("submissions").collect();
    return submissions.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listAllErrorLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("errorLogs").collect();
    const sorted = all.sort((a, b) => b._creationTime - a._creationTime);
    return limit ? sorted.slice(0, limit) : sorted;
  },
});

// Admin: per-firm submission counts bucketed by formType + period.
// Returns the same shape the legacy Supabase RPC produced so the existing
// dashboard tables can read it without rewriting.
export const getAllFirmsSubmissionStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const firms = await ctx.db.query("firms").collect();
    const submissions = await ctx.db.query("submissions").collect();

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const dayAgo = now - dayMs;
    const weekAgo = now - 7 * dayMs;
    const monthAgo = now - 30 * dayMs;

    return firms.map((firm) => {
      const firmSubs = submissions.filter((s) => s.firmId === firm._id);
      const byType = (type: string) =>
        firmSubs.filter((s) => (s.formType ?? "") === type);
      const inRange = (subs: typeof firmSubs, since: number) =>
        subs.filter((s) => s._creationTime >= since).length;

      const arrima = byType("ARRIMA");
      const imm = firmSubs.filter((s) => (s.formType ?? "") !== "ARRIMA");

      return {
        firmId: firm._id,
        displayName: firm.displayName ?? null,
        arrima_day: inRange(arrima, dayAgo),
        arrima_week: inRange(arrima, weekAgo),
        arrima_month: inRange(arrima, monthAgo),
        arrima_total: arrima.length,
        imm_day: inRange(imm, dayAgo),
        imm_week: inRange(imm, weekAgo),
        imm_month: inRange(imm, monthAgo),
        imm_total: imm.length,
        grand_total: firmSubs.length,
      };
    });
  },
});

// Admin: global submission counts (sum across all firms).
export const getGlobalSubmissionStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db.query("submissions").collect();

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const dayAgo = now - dayMs;
    const weekAgo = now - 7 * dayMs;
    const monthAgo = now - 30 * dayMs;

    const arrima = submissions.filter((s) => (s.formType ?? "") === "ARRIMA");
    const imm = submissions.filter((s) => (s.formType ?? "") !== "ARRIMA");

    const inRange = (subs: typeof submissions, since: number) =>
      subs.filter((s) => s._creationTime >= since).length;

    return {
      arrima_day: inRange(arrima, dayAgo),
      arrima_week: inRange(arrima, weekAgo),
      arrima_month: inRange(arrima, monthAgo),
      arrima_total: arrima.length,
      imm_day: inRange(imm, dayAgo),
      imm_week: inRange(imm, weekAgo),
      imm_month: inRange(imm, monthAgo),
      imm_total: imm.length,
      grand_total: submissions.length,
    };
  },
});

// Admin: per-firm AI cost aggregates from aiUsageLogs.
// Pricing is computed client-side (see lib/modelPricing.ts) — this returns the
// raw token usage grouped by firm + model so the dashboard can multiply.
export const getAiUsageByFirm = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const logs = await ctx.db.query("aiUsageLogs").collect();

    const byFirm: Record<
      string,
      Array<{
        modelName: string;
        promptTokens: number;
        completionTokens: number;
        createdAt: number;
      }>
    > = {};

    for (const log of logs) {
      const key = log.firmId as string;
      if (!byFirm[key]) byFirm[key] = [];
      byFirm[key].push({
        modelName: log.modelName,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        createdAt: log._creationTime,
      });
    }

    return byFirm;
  },
});

// Admin: clients with submissions + legal docs joined, scoped to one firm.
// Replaces the old fetchUserClients RPC; powers the UserDetail clients table.
export const getFirmClientsDetail = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireAdmin(ctx);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    return await Promise.all(
      clients.map(async (client) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect();

        const latestSubmission =
          submissions.sort((a, b) => b._creationTime - a._creationTime)[0] ??
          null;

        const legalDocs = await ctx.db
          .query("generatedLegalDocs")
          .filter((q) => q.eq(q.field("clientId"), client._id))
          .collect();

        let formDefinitionName: string | null = null;
        if (client.primaryFormDefinitionId) {
          const def = await ctx.db.get(client.primaryFormDefinitionId);
          formDefinitionName = def?.name ?? null;
        }

        const answerCount = latestSubmission?.answers
          ? Object.keys(latestSubmission.answers as Record<string, unknown>)
              .length
          : 0;

        const lastActivity = latestSubmission
          ? latestSubmission._creationTime
          : client._creationTime;
        const daysSinceActivity = Math.floor(
          (Date.now() - lastActivity) / (1000 * 60 * 60 * 24),
        );

        return {
          _id: client._id,
          firstName: client.firstName ?? null,
          lastName: client.lastName ?? null,
          email: client.email ?? null,
          status: client.status ?? null,
          formDefinitionName,
          createdAt: client._creationTime,
          submissionId: latestSubmission?._id ?? null,
          submissionStatus: latestSubmission?.status ?? null,
          submissionFormType: latestSubmission?.formType ?? null,
          answerCount,
          preferredLanguage: latestSubmission?.preferredLanguage ?? "fr",
          hasTranslatedAnswers: !!latestSubmission?.translatedAnswers,
          lastActivity,
          daysSinceActivity,
          isStuck:
            daysSinceActivity >= 7 &&
            latestSubmission?.status === "in_progress",
          legalDocsAssigned: legalDocs.length,
          legalDocsGenerated: legalDocs.filter(
            (d) => d.status === "generated" && d.storageId,
          ).length,
          legalDocsPending: legalDocs.filter((d) => d.status !== "generated")
            .length,
        };
      }),
    );
  },
});

// Exposes the admin allowlist check as a Convex query so the admin-website
// client can gate its UI off the same source of truth as the server. Set
// ADMIN_WORKOS_USER_IDS on the Convex deployment via `npx convex env set`.
// Misconfig propagates as AuthError.
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => isAdmin(ctx),
});

// Admin: form-feedback rows with the client/submission context flattened.
// The legacy admin Analytics page reads form_feedback joined with applications;
// here we flatten submissions + clients onto each feedback row.
export const listAllFormFeedback = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("feedback").collect();
    const formRatings = all.filter((f) => f.type === "form_rating");

    return await Promise.all(
      formRatings
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (f) => {
          const submission = f.submissionId
            ? await ctx.db.get(f.submissionId)
            : null;
          const client = submission?.clientId
            ? await ctx.db.get(submission.clientId)
            : null;
          const firmId =
            submission?.firmId ?? f.firmId ?? client?.firmId ?? null;

          return {
            _id: f._id,
            createdAt: f._creationTime,
            submissionId: f.submissionId ?? null,
            firmId,
            formType: submission?.formType ?? null,
            clientName: client
              ? [client.firstName, client.lastName].filter(Boolean).join(" ") ||
                null
              : null,
            rating: f.rating ?? null,
            nps: f.nps ?? null,
            easeOfUse: f.easeOfUse ?? null,
            device: f.device ?? null,
            comment: f.message ?? null,
          };
        }),
    );
  },
});

// Staging cleanup: keeps only ~20 most recent clients per firm, cascades delete
// all related data (submissions, documents, errors, logs, etc.). Admin-only.
export const cleanupStagingData = mutation({
  args: {
    samplesPerFirm: v.number(),
  },
  handler: async (ctx, { samplesPerFirm }) => {
    await requireAdmin(ctx);

    const firms = await ctx.db.query("firms").collect();
    const report = {
      totalDeleted: 0,
      firmDetails: [] as Array<{
        firmId: string;
        displayName?: string;
        deleted: number;
      }>,
    };

    for (const firm of firms) {
      const clients = await ctx.db
        .query("clients")
        .withIndex("by_firm", (q) => q.eq("firmId", firm._id))
        .collect();

      // Sort by creation time descending (newest first), keep first N
      const clientsToKeep = clients
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, samplesPerFirm);
      const keepIds = new Set(clientsToKeep.map((c) => c._id));

      const clientsToDelete = clients.filter((c) => !keepIds.has(c._id));

      for (const client of clientsToDelete) {
        await ctx.scheduler.runAfter(
          0,
          internal.admin.deleteClientWithCascades,
          { clientId: client._id },
        );
      }

      report.totalDeleted += clientsToDelete.length;
      report.firmDetails.push({
        firmId: firm._id,
        displayName: firm.displayName,
        deleted: clientsToDelete.length,
      });
    }

    return report;
  },
});

// Internal mutation: cascade-delete a client and all related data
// (submissions, submission documents, supplement requests, generated legal docs,
// error logs, feedback, AI usage logs).
export const deleteClientWithCascades = internalMutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return { success: false, reason: "client not found" };

    // Phase 1: collect all submissions for this client
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const submissionIds = submissions.map((s) => s._id);

    // Phase 2: delete all submission documents
    for (const submissionId of submissionIds) {
      const docs = await ctx.db
        .query("submissionDocuments")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }

    // Phase 3: delete all supplement requests and related entities for each submission
    for (const submissionId of submissionIds) {
      // Supplement requests
      const supps = await ctx.db
        .query("supplementRequests")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .collect();
      for (const supp of supps) {
        await ctx.db.delete(supp._id);
      }

      // Feedback entries
      const feedbacks = await ctx.db
        .query("feedback")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .collect();
      for (const fb of feedbacks) {
        await ctx.db.delete(fb._id);
      }

      // AI usage logs (no index on submissionId, use filter)
      const aiLogs = await ctx.db
        .query("aiUsageLogs")
        .filter((q) => q.eq(q.field("submissionId"), submissionId))
        .collect();
      for (const log of aiLogs) {
        await ctx.db.delete(log._id);
      }

      // Error logs related to this submission
      const errorLogs = await ctx.db
        .query("errorLogs")
        .filter((q) => q.eq(q.field("submissionId"), submissionId))
        .collect();
      for (const log of errorLogs) {
        await ctx.db.delete(log._id);
      }
    }

    // Phase 4: delete all submissions
    for (const submissionId of submissionIds) {
      await ctx.db.delete(submissionId);
    }

    // Phase 5: delete all generated legal documents for this client
    const legalDocs = await ctx.db
      .query("generatedLegalDocs")
      .filter((q) => q.eq(q.field("clientId"), clientId))
      .collect();
    for (const doc of legalDocs) {
      await ctx.db.delete(doc._id);
    }

    // Phase 6: delete all error logs for this client (not yet deleted by submission)
    const clientErrorLogs = await ctx.db
      .query("errorLogs")
      .filter((q) => q.eq(q.field("clientId"), clientId))
      .collect();
    for (const log of clientErrorLogs) {
      await ctx.db.delete(log._id);
    }

    // Phase 7: finally, delete the client
    await ctx.db.delete(clientId);

    return {
      success: true,
      clientId,
      submissionsDeleted: submissionIds.length,
    };
  },
});
