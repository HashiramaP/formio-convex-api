import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireFirmAccess, requireWorkosUserId, AuthError } from "./auth";

// `getFirmDisplayName` is called by form-website (anonymous client form) to
// show "submitting to <firm>" — leave open.
export const getFirmDisplayName = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.displayName ?? null;
  },
});

// Used by admin-website's `/api/status` and `/api/generateArrimaData` routes
// as the auth handshake for external API customers (firm API key auth model,
// not WorkOS). Returns just `{_id, displayName}` so a brute-forced apiKey
// can't disclose subscription details or email overrides. The apiKey itself
// must be guessed (~82 bits of entropy from crypto-random alphabet).
export const getFirmByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    if (!apiKey) return null;
    const firm = await ctx.db
      .query("firms")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();
    if (!firm) return null;
    return { _id: firm._id, displayName: firm.displayName ?? null };
  },
});

// Bootstrap query: AuthContext runs this on every sign-in to resolve which
// firm the user owns. Self-lookup only — the JWT subject must match the
// requested workosUserId, so a user can't enumerate other firms' membership.
export const getFirmByWorkosUserId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    const callerWorkosId = await requireWorkosUserId(ctx);
    if (callerWorkosId !== workosUserId) {
      throw new AuthError("Unauthorized: self-lookup only");
    }
    return await ctx.db
      .query("firms")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
      .first();
  },
});

export const getApiKey = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    return firm?.apiKey ?? null;
  },
});

export const generateApiKey = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    // crypto.getRandomValues is required: Math.random() is predictable enough that
    // a sibling tab seeing one issued key could narrow guesses for adjacent keys.
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let key = "";
    for (let i = 0; i < bytes.length; i++) {
      key += chars[bytes[i] % chars.length];
    }
    await ctx.db.patch(firmId, { apiKey: key });
    return key;
  },
});

export const getMonthlyClientQuota = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return { remaining: null, limit: null };
    return {
      remaining: firm.monthlyClientsRemaining ?? null,
      limit: firm.monthlyClientLimit ?? null,
    };
  },
});

export const decrementMonthlyClients = mutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const current = firm.monthlyClientsRemaining;
    if (typeof current === "number" && current > 0) {
      await ctx.db.patch(firmId, { monthlyClientsRemaining: current - 1 });
    }
  },
});

// Resets every firm's `monthlyClientsRemaining` back to its `monthlyClientLimit`.
// Scheduled by `crons.ts` on the 1st of each month. Firms with no limit set are
// left untouched (treated as unlimited).
export const resetMonthlyClientQuotas = internalMutation({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query("firms").collect();
    let resetCount = 0;
    for (const firm of firms) {
      if (typeof firm.monthlyClientLimit !== "number") continue;
      await ctx.db.patch(firm._id, {
        monthlyClientsRemaining: firm.monthlyClientLimit,
      });
      resetCount++;
    }
    return { resetCount, totalFirms: firms.length };
  },
});

export const getSubscriptionInfo = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return null;
    return {
      subscriptionStartDate: firm.subscriptionStartDate ?? null,
      subscriptionEndDate: firm.subscriptionEndDate ?? null,
      membershipStatus: firm.membershipStatus,
    };
  },
});

export const getEmailSettings = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    return firm?.emailSettings ?? null;
  },
});

export const updateEmailSettings = mutation({
  args: {
    firmId: v.id("firms"),
    settings: v.object({
      generalNotificationEmail: v.optional(v.string()),
      physicalMailingAddress: v.optional(v.string()),
      remindersEnabled: v.boolean(),
      reminderCadence: v.object({
        firstAfterDays: v.number(),
        repeatEveryDays: v.number(),
        maxReminders: v.number(),
      }),
    }),
  },
  handler: async (ctx, { firmId, settings }) => {
    await requireFirmAccess(ctx, firmId);
    await ctx.db.patch(firmId, { emailSettings: settings });
  },
});

export const getEmailOverrides = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    return firm?.emailOverrides ?? {};
  },
});

// Set (or clear) the firm's custom document-naming template. Passing an empty/
// whitespace-only template clears it and restores the default naming.
export const setDocumentNamingTemplate = mutation({
  args: {
    firmId: v.id("firms"),
    template: v.string(),
  },
  handler: async (ctx, { firmId, template }) => {
    await requireFirmAccess(ctx, firmId);
    const trimmed = template.trim();
    await ctx.db.patch(firmId, {
      documentNamingTemplate: trimmed === "" ? undefined : trimmed,
    });
  },
});

// Intake curation — set the disabled (not-asked) externalIds for one demande
// type. Replaces the whole list for that type (the UI sends the full set on
// save). Empty array clears it (everything asked again).
export const setIntakeDisabledFields = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    externalIds: v.array(v.string()),
  },
  handler: async (ctx, { firmId, demandeTypeId, externalIds }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const map = { ...(firm.intakeDisabledFields ?? {}) };
    if (externalIds.length === 0) {
      delete map[demandeTypeId];
    } else {
      map[demandeTypeId] = externalIds;
    }
    await ctx.db.patch(firmId, { intakeDisabledFields: map });
  },
});

// Intake curation — set the document add/remove overrides for one demande
// type. Replaces the override for that type. Empty removed+added clears it.
export const setRequiredDocOverrides = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    removed: v.array(v.string()),
    added: v.array(
      v.object({
        key: v.string(),
        label: v.optional(v.string()),
        required: v.optional(v.boolean()),
        custom: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { firmId, demandeTypeId, removed, added }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const map = { ...(firm.requiredDocOverrides ?? {}) };
    if (removed.length === 0 && added.length === 0) {
      delete map[demandeTypeId];
    } else {
      map[demandeTypeId] = { removed, added };
    }
    await ctx.db.patch(firmId, { requiredDocOverrides: map });
  },
});

// Intake curation — set the per-demande-type question edits (relabel, required
// override, added catalog/custom questions). Full-replace for that type; clears
// when everything is empty.
export const setIntakeQuestionOverrides = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    labels: v.record(v.string(), v.string()),
    required: v.record(v.string(), v.boolean()),
    added: v.array(
      v.object({
        externalId: v.string(),
        custom: v.optional(v.boolean()),
        label: v.optional(v.string()),
        type: v.optional(v.string()),
        options: v.optional(v.any()),
        required: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { firmId, demandeTypeId, labels, required, added }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const map = { ...(firm.intakeQuestionOverrides ?? {}) };
    const empty =
      Object.keys(labels).length === 0 &&
      Object.keys(required).length === 0 &&
      added.length === 0;
    if (empty) {
      delete map[demandeTypeId];
    } else {
      map[demandeTypeId] = { labels, required, added };
    }
    await ctx.db.patch(firmId, { intakeQuestionOverrides: map });
  },
});

// Sparse guidance override for ONE question within a demande type. `patch`
// carries only the fields being changed; a field set to "" (after trim) is
// removed (reverts to the canonical Formio text). When a question's override
// becomes empty it's pruned; when the whole guidance map empties it's dropped.
export const setIntakeQuestionGuidance = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    externalId: v.string(),
    patch: v.object({
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
  },
  handler: async (ctx, { firmId, demandeTypeId, externalId, patch }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const all = { ...(firm.intakeQuestionOverrides ?? {}) };
    const forType = { ...(all[demandeTypeId] ?? {}) };
    const guidance = { ...((forType.guidance as Record<string, any>) ?? {}) };
    const current = { ...(guidance[externalId] ?? {}) };

    for (const [k, v0] of Object.entries(patch)) {
      // options is a non-string field; everything else is text.
      if (k === "options") {
        if (v0 === undefined || v0 === null) delete current[k];
        else current[k] = v0;
        continue;
      }
      const trimmed = typeof v0 === "string" ? v0.trim() : v0;
      if (trimmed === undefined || trimmed === "") delete current[k];
      else current[k] = trimmed;
    }

    if (Object.keys(current).length === 0) {
      delete guidance[externalId];
    } else {
      guidance[externalId] = current;
    }

    if (Object.keys(guidance).length === 0) {
      delete (forType as any).guidance;
    } else {
      (forType as any).guidance = guidance;
    }

    const typeEmpty =
      Object.keys(forType.labels ?? {}).length === 0 &&
      Object.keys(forType.required ?? {}).length === 0 &&
      (forType.added?.length ?? 0) === 0 &&
      Object.keys((forType.guidance as Record<string, any>) ?? {}).length === 0;
    if (typeEmpty) {
      delete all[demandeTypeId];
    } else {
      all[demandeTypeId] = forType;
    }
    await ctx.db.patch(firmId, { intakeQuestionOverrides: all });
  },
});

// Per-question conditional-visibility override for one demande type. Passing
// dependsOn=null/undefined clears it (question becomes unconditional, or falls
// back to the canonical/per-form condition). Prunes empty entries.
export const setIntakeQuestionDependsOn = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    externalId: v.string(),
    dependsOn: v.optional(v.any()),
  },
  handler: async (ctx, { firmId, demandeTypeId, externalId, dependsOn }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const all = { ...(firm.intakeQuestionOverrides ?? {}) };
    const forType = { ...(all[demandeTypeId] ?? {}) };
    const dep = { ...((forType.dependsOn as Record<string, any>) ?? {}) };

    const empty =
      dependsOn === undefined ||
      dependsOn === null ||
      (Array.isArray(dependsOn) && dependsOn.length === 0);
    if (empty) delete dep[externalId];
    else dep[externalId] = dependsOn;

    if (Object.keys(dep).length === 0) delete (forType as any).dependsOn;
    else (forType as any).dependsOn = dep;

    const typeEmpty =
      Object.keys(forType.labels ?? {}).length === 0 &&
      Object.keys(forType.required ?? {}).length === 0 &&
      (forType.added?.length ?? 0) === 0 &&
      Object.keys((forType.guidance as Record<string, any>) ?? {}).length === 0 &&
      Object.keys((forType.dependsOn as Record<string, any>) ?? {}).length === 0;
    if (typeEmpty) delete all[demandeTypeId];
    else all[demandeTypeId] = forType;
    await ctx.db.patch(firmId, { intakeQuestionOverrides: all });
  },
});

// Set the firm's custom question ordering for one demande type. The UI sends
// the full ordered list of externalIds. Empty array clears it.
export const setIntakeQuestionOrder = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    externalIds: v.array(v.string()),
  },
  handler: async (ctx, { firmId, demandeTypeId, externalIds }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const all = { ...(firm.intakeQuestionOverrides ?? {}) };
    const forType = { ...(all[demandeTypeId] ?? {}) };
    if (externalIds.length === 0) delete (forType as any).order;
    else (forType as any).order = externalIds;

    const typeEmpty =
      Object.keys(forType.labels ?? {}).length === 0 &&
      Object.keys(forType.required ?? {}).length === 0 &&
      (forType.added?.length ?? 0) === 0 &&
      Object.keys((forType.guidance as Record<string, any>) ?? {}).length === 0 &&
      Object.keys((forType.dependsOn as Record<string, any>) ?? {}).length === 0 &&
      ((forType.order as string[] | undefined)?.length ?? 0) === 0;
    if (typeEmpty) delete all[demandeTypeId];
    else all[demandeTypeId] = forType;
    await ctx.db.patch(firmId, { intakeQuestionOverrides: all });
  },
});

// Wire (or unwire) OCR auto-fill for one question in a demande type. `fill`
// names the document + extracted source field that pre-fills the question;
// null clears it. Prunes empty. Only meaningful for sourceKeys the document
// already extracts (enforced by the UI menu, which lists extractable fields).
export const setIntakeQuestionOcrFill = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    externalId: v.string(),
    fill: v.union(v.object({ docKey: v.string() }), v.null()),
  },
  handler: async (ctx, { firmId, demandeTypeId, externalId, fill }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const all = { ...(firm.intakeQuestionOverrides ?? {}) };
    const forType = { ...(all[demandeTypeId] ?? {}) };
    const map = { ...((forType.ocrFill as Record<string, any>) ?? {}) };
    if (fill === null) delete map[externalId];
    else map[externalId] = fill;
    if (Object.keys(map).length === 0) delete (forType as any).ocrFill;
    else (forType as any).ocrFill = map;

    const typeEmpty =
      Object.keys(forType.labels ?? {}).length === 0 &&
      Object.keys(forType.required ?? {}).length === 0 &&
      (forType.added?.length ?? 0) === 0 &&
      Object.keys((forType.guidance as Record<string, any>) ?? {}).length === 0 &&
      Object.keys((forType.dependsOn as Record<string, any>) ?? {}).length === 0 &&
      ((forType.order as string[] | undefined)?.length ?? 0) === 0 &&
      Object.keys((forType.ocrFill as Record<string, any>) ?? {}).length === 0;
    if (typeEmpty) delete all[demandeTypeId];
    else all[demandeTypeId] = forType;
    await ctx.db.patch(firmId, { intakeQuestionOverrides: all });
  },
});

// Apply an imported (and AI-mapped) form to a demande type — turns the firm's
// own form into the type's intake. For each question: a mapped one already in
// the type's IMMs is relabeled with the firm's wording; a mapped one not yet
// present is added (canonical → pre-fills IMMs); an unmapped one is added as a
// custom info question. Documents map to the catalog or become custom. Merges
// into the existing overrides (doesn't clobber other curation).
export const applyImportedForm = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
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
  },
  handler: async (ctx, { firmId, demandeTypeId, questions, documents }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    const dt = await ctx.db.get(demandeTypeId);
    if (!firm || !dt) return;

    // externalIds the type's IMMs already ask (relabel vs add).
    const present = new Set<string>();
    for (const id of dt.legalDocumentIds) {
      const ld = await ctx.db.get(id);
      const m = (ld as any)?.immQuestions;
      if (m?.intakeQuestions)
        for (const q of m.intakeQuestions) if (q.externalId) present.add(q.externalId);
    }
    const slug = (s: string) =>
      `custom:${s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}`;

    // ── Questions → intakeQuestionOverrides (merge) ──
    const allQ = { ...(firm.intakeQuestionOverrides ?? {}) };
    const ft: any = { ...(allQ[demandeTypeId] ?? {}) };
    const labels: Record<string, string> = { ...(ft.labels ?? {}) };
    const added: any[] = [...(ft.added ?? [])];
    const addedIds = new Set(added.map((a) => a.externalId));
    for (const q of questions) {
      if (q.externalId) {
        if (present.has(q.externalId)) {
          labels[q.externalId] = q.label; // relabel the existing IMM question
        } else if (!addedIds.has(q.externalId)) {
          added.push({ externalId: q.externalId, custom: false, label: q.label });
          addedIds.add(q.externalId);
        }
      } else {
        const key = slug(q.label);
        if (!addedIds.has(key)) {
          added.push({ externalId: key, custom: true, label: q.label, type: q.type });
          addedIds.add(key);
        }
      }
    }
    ft.labels = labels;
    ft.added = added;
    allQ[demandeTypeId] = ft;
    await ctx.db.patch(firmId, { intakeQuestionOverrides: allQ });

    // ── Documents → requiredDocOverrides (merge) ──
    const allD = { ...(firm.requiredDocOverrides ?? {}) };
    const prevD: any = allD[demandeTypeId] ?? {};
    const dft: any = { removed: prevD.removed ?? [], added: prevD.added ?? [] };
    const docAdded: any[] = [...(dft.added ?? [])];
    const docKeys = new Set(docAdded.map((d) => d.key));
    for (const d of documents) {
      const key = d.docKey ?? slug(d.label);
      if (docKeys.has(key)) continue;
      docAdded.push(
        d.docKey
          ? { key: d.docKey, label: d.label, required: true }
          : { key, label: d.label, required: true, custom: true },
      );
      docKeys.add(key);
    }
    dft.added = docAdded;
    allD[demandeTypeId] = dft;
    await ctx.db.patch(firmId, { requiredDocOverrides: allD });

    return { questionsApplied: questions.length, documentsApplied: documents.length };
  },
});

export const upsertEmailOverride = mutation({
  args: {
    firmId: v.id("firms"),
    formDefinitionId: v.id("formDefinitions"),
    email: v.string(),
  },
  handler: async (ctx, { firmId, formDefinitionId, email }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const overrides = { ...(firm.emailOverrides ?? {}) };
    overrides[formDefinitionId as string] = email;
    await ctx.db.patch(firmId, { emailOverrides: overrides });
  },
});

export const deleteEmailOverride = mutation({
  args: {
    firmId: v.id("firms"),
    formDefinitionId: v.id("formDefinitions"),
  },
  handler: async (ctx, { firmId, formDefinitionId }) => {
    await requireFirmAccess(ctx, firmId);
    const firm = await ctx.db.get(firmId);
    if (!firm) return;
    const overrides = { ...(firm.emailOverrides ?? {}) };
    delete overrides[formDefinitionId as string];
    await ctx.db.patch(firmId, { emailOverrides: overrides });
  },
});
