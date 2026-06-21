import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireCurrentFirm, AuthError } from "./auth";

// `getFormQuestions`, `getDistinctSections`, `getQuestionsByExternalIds` are
// read by form-website (anonymous) when rendering the form for clients. Leave
// open. Mutations are dashboard-only (main-website form editor).

export const getFormQuestions = query({
  args: { formDefinitionId: v.id("formDefinitions") },
  handler: async (ctx, { formDefinitionId }) => {
    const formDef = await ctx.db.get(formDefinitionId);
    if (!formDef) return [];

    async function loadFormQuestions(fdId: Id<"formDefinitions">) {
      const fqs = await ctx.db
        .query("formQuestions")
        .withIndex("by_formDefinition", (q) => q.eq("formDefinitionId", fdId))
        .collect();

      return Promise.all(
        fqs.map(async (fq) => {
          const question = await ctx.db
            .query("questions")
            .withIndex("by_externalId", (q) => q.eq("externalId", fq.questionKey))
            .unique();
          return { ...fq, question: question ?? undefined };
        }),
      );
    }

    // Grouped sub-form that is NOT the group primary → only its own questions.
    // Mirrors the same rule in getDistinctSections so the dashboard SectionToggle
    // count and the client wizard render the same set of questions.
    if (formDef.formGroup && !formDef.isGroupPrimary) {
      const questions = await loadFormQuestions(formDefinitionId);
      return questions.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    // Path 1: Self-contained — only this form's questions.
    // A form is truly self-contained only when isSelfContained=true AND no
    // baseFormId is set. If baseFormId is present, the consultant explicitly
    // linked a base form and we must merge it even if isSelfContained was not
    // cleared (e.g. migrated data, or forkForm default).
    if (formDef.isSelfContained && !formDef.baseFormId) {
      const questions = await loadFormQuestions(formDefinitionId);
      return questions.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    // Path 2/3: Find the base form (explicit or by lookup)
    let baseFormId = formDef.baseFormId;

    if (!baseFormId) {
      const baseForms = await ctx.db
        .query("formDefinitions")
        .filter((q) => q.eq(q.field("isBaseForm"), true))
        .collect();

      const baseForm =
        baseForms.find((f) => f.firmId === formDef.firmId) ??
        baseForms.find((f) => !f.firmId);

      baseFormId = baseForm?._id;
    }

    const ownQuestions = await loadFormQuestions(formDefinitionId);

    if (!baseFormId) {
      return ownQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    let baseQuestions = await loadFormQuestions(baseFormId);

    const excluded = new Set(formDef.excludedBaseSections ?? []);
    if (excluded.size > 0) {
      baseQuestions = baseQuestions.filter(
        (q) => !q.section || !excluded.has(q.section),
      );
    }

    // Order base sections first (sorted by their own orderIndex), then own
    // questions (sorted by their orderIndex). Merging the two arrays before
    // sorting interleaves them because both use orderIndex 1..N.
    baseQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    ownQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    return [...baseQuestions, ...ownQuestions];
  },
});

/**
 * Returns ONLY the form's own questions (no base form merge). Used by the
 * admin form editor to display what the form itself contains, separate from
 * the base sections that get merged in at render time for the client wizard.
 */
export const getOwnFormQuestions = query({
  args: { formDefinitionId: v.id("formDefinitions") },
  handler: async (ctx, { formDefinitionId }) => {
    const formDef = await ctx.db.get(formDefinitionId);
    if (!formDef) return [];

    const fqs = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) =>
        q.eq("formDefinitionId", formDefinitionId),
      )
      .collect();

    const withQuestions = await Promise.all(
      fqs.map(async (fq) => {
        const question = await ctx.db
          .query("questions")
          .withIndex("by_externalId", (q) => q.eq("externalId", fq.questionKey))
          .unique();
        return { ...fq, question: question ?? undefined };
      }),
    );
    return withQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
  },
});

export const getDistinctSections = query({
  args: { formDefinitionId: v.id("formDefinitions") },
  handler: async (ctx, { formDefinitionId }) => {
    const formDef = await ctx.db.get(formDefinitionId);
    if (!formDef) {
      return { baseSections: [], demandeSections: [] };
    }

    const ownFqs = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) =>
        q.eq("formDefinitionId", formDefinitionId),
      )
      .collect();
    ownFqs.sort((a, b) => a.orderIndex - b.orderIndex);

    const uniqueSections = (rows: typeof ownFqs) =>
      Array.from(
        new Set(rows.map((r) => r.section).filter((s): s is string => !!s)),
      );

    // Grouped sub-form that is NOT the group primary → never inherit base sections.
    // Only the primary sub-form in a formGroup gets base sections merged. Set by
    // the one-off `migrations:setGroupPrimaries` for Demandeur principal.
    if (formDef.formGroup && !formDef.isGroupPrimary) {
      return {
        baseSections: [],
        demandeSections: uniqueSections(ownFqs),
      };
    }

    if (formDef.isSelfContained && !formDef.baseFormId) {
      return {
        baseSections: [],
        demandeSections: uniqueSections(ownFqs),
      };
    }

    let baseFormId = formDef.baseFormId;
    if (!baseFormId) {
      const baseForms = await ctx.db
        .query("formDefinitions")
        .filter((q) => q.eq(q.field("isBaseForm"), true))
        .collect();
      const baseForm =
        baseForms.find((f) => f.firmId === formDef.firmId) ??
        baseForms.find((f) => !f.firmId);
      baseFormId = baseForm?._id;
    }

    if (!baseFormId) {
      return {
        baseSections: [],
        demandeSections: uniqueSections(ownFqs),
      };
    }

    const baseFqs = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) =>
        q.eq("formDefinitionId", baseFormId),
      )
      .collect();
    baseFqs.sort((a, b) => a.orderIndex - b.orderIndex);

    return {
      baseSections: uniqueSections(baseFqs),
      demandeSections: uniqueSections(ownFqs),
    };
  },
});

// Slice 2 spike — seed canonical (global, no firmId) questions into the
// catalog. `upsertQuestionsBatch` deliberately refuses global writes so
// firms can't pollute the shared catalog; this mutation is the back-door
// for catalog admin operations during the IMM-indexed intake build-out.
// Open during the spike so the seed script runs with just the admin key.
// Drop or auth-wrap once the admin tooling lands.
export const seedCanonicalQuestions = mutation({
  args: {
    questions: v.array(
      v.object({
        externalId: v.string(),
        label: v.string(),
        shortLabel: v.optional(v.string()),
        type: v.string(),
        options: v.optional(v.any()),
        isRequired: v.optional(v.boolean()),
        indication: v.optional(v.string()),
        help: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        example: v.optional(v.string()),
        validationRules: v.optional(v.any()),
        multiEntryFields: v.optional(v.any()),
        multiEntryAddLabel: v.optional(v.string()),
        category: v.optional(v.string()),
        categorySort: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { questions: newQuestions }) => {
    const results: Array<{ externalId: string; action: "inserted" | "updated" }> = [];
    for (const q of newQuestions) {
      const existing = await ctx.db
        .query("questions")
        .withIndex("by_externalId", (idx) => idx.eq("externalId", q.externalId))
        .unique();
      if (existing) {
        if (existing.firmId) {
          // Refuse to clobber a firm-scoped question with a canonical one —
          // surface the conflict so the caller picks a different externalId.
          throw new Error(
            `externalId "${q.externalId}" is firm-scoped; cannot overwrite as canonical`,
          );
        }
        await ctx.db.patch(existing._id, q);
        results.push({ externalId: q.externalId, action: "updated" });
      } else {
        await ctx.db.insert("questions", { ...q, firmId: undefined });
        results.push({ externalId: q.externalId, action: "inserted" });
      }
    }
    return results;
  },
});

// Set `dependsOn` (conditional visibility) on canonical catalog questions by
// externalId. Admin-key seed helper (no JWT) — mirrors seedCanonicalQuestions'
// canonical-only safety: refuses firm-scoped rows. Pass dependsOn:null to clear.
// dependsOn is GLOBAL (applies on every form using the externalId); callers must
// validate that every form containing a child also contains its parent question.
// See INTAKE-REDUCTION-PLAN.md (Lever C).
export const setQuestionDependsOnBatch = mutation({
  args: {
    items: v.array(v.object({ externalId: v.string(), dependsOn: v.any() })),
  },
  handler: async (ctx, { items }) => {
    const results: Array<{
      externalId: string;
      action: "updated" | "missing" | "firm-scoped";
    }> = [];
    for (const { externalId, dependsOn } of items) {
      const rows = await ctx.db
        .query("questions")
        .withIndex("by_externalId", (idx) => idx.eq("externalId", externalId))
        .collect();
      const canonical = rows.find((r) => !r.firmId);
      if (!canonical) {
        results.push({ externalId, action: rows.length ? "firm-scoped" : "missing" });
        continue;
      }
      await ctx.db.patch(canonical._id, { dependsOn: dependsOn ?? undefined });
      results.push({ externalId, action: "updated" });
    }
    return results;
  },
});

export const getQuestionsByExternalIds = query({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, { externalIds }) => {
    const questions = await Promise.all(
      externalIds.map((id) =>
        ctx.db
          .query("questions")
          .withIndex("by_externalId", (q) => q.eq("externalId", id))
          .unique(),
      ),
    );
    return questions.filter(Boolean);
  },
});

// For each externalId, whether the canonical question already has meaningful
// guidance (an indication or a "why important" reason). Used after a form import
// to decide which applied questions need AI-generated guidance. A custom key
// (not in the catalog) → false (always needs guidance). Returns a plain map.
export const getGuidancePresence = query({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, { externalIds }) => {
    const out: Record<string, boolean> = {};
    await Promise.all(
      externalIds.map(async (id) => {
        const q = await ctx.db
          .query("questions")
          .withIndex("by_externalId", (idx) => idx.eq("externalId", id))
          .unique();
        out[id] = !!(
          (q?.indication && String(q.indication).trim()) ||
          (q?.whyImportantReason && String(q.whyImportantReason).trim())
        );
      }),
    );
    return out;
  },
});

/**
 * Bulk upsert questions by externalId. Used by the form editor to:
 * - Insert new template-based questions (id starts with "tpl_")
 * - Update existing questions (label, type, options, etc.)
 */
export const upsertQuestionsBatch = mutation({
  args: {
    questions: v.array(
      v.object({
        externalId: v.string(),
        label: v.string(),
        shortLabel: v.optional(v.string()),
        type: v.string(),
        options: v.optional(v.any()),
        isRequired: v.optional(v.boolean()),
        multiEntryFields: v.optional(v.any()),
        indication: v.optional(v.string()),
        help: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        example: v.optional(v.string()),
        whyImportantReason: v.optional(v.string()),
        whyImportantConsequence: v.optional(v.string()),
        firmId: v.optional(v.id("firms")),
      }),
    ),
  },
  handler: async (ctx, { questions }) => {
    const firm = await requireCurrentFirm(ctx);
    // Each question's firmId (when provided) must match the caller's firm.
    // `undefined` firmId means a global/catalog question — only admins should
    // write those; we forbid the unauthenticated path entirely.
    for (const q of questions) {
      if (q.firmId && q.firmId !== firm._id) {
        throw new AuthError(
          "Unauthorized: question firmId must match caller's firm",
        );
      }
      if (!q.firmId) {
        throw new AuthError(
          "Cannot write global/catalog questions from the dashboard",
        );
      }
      const existing = await ctx.db
        .query("questions")
        .withIndex("by_externalId", (idx) => idx.eq("externalId", q.externalId))
        .unique();
      if (existing) {
        // Block tenant cross-writes: if the existing row is global (no firmId)
        // or belongs to another firm, refuse the update.
        if (existing.firmId && existing.firmId !== firm._id) {
          throw new AuthError(
            "Unauthorized: question belongs to a different firm",
          );
        }
        if (!existing.firmId) {
          throw new AuthError(
            "Cannot overwrite catalog questions from the dashboard",
          );
        }
        const { externalId: _ignored, ...updates } = q;
        await ctx.db.patch(existing._id, updates);
      } else {
        await ctx.db.insert("questions", q);
      }
    }
  },
});

/**
 * Atomically replace all formQuestions for a form definition.
 * Used by the form editor: delete-all-then-insert-all is the simplest
 * way to handle reorders, section moves, and removals in one save.
 */
export const replaceFormQuestions = mutation({
  args: {
    formDefinitionId: v.id("formDefinitions"),
    rows: v.array(
      v.object({
        questionKey: v.string(),
        orderIndex: v.number(),
        section: v.optional(v.string()),
        sectionTranslations: v.optional(v.any()),
        dependsOn: v.optional(v.any()),
        labelOverride: v.optional(v.string()),
        requiredOverride: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { formDefinitionId, rows }) => {
    const firm = await requireCurrentFirm(ctx);
    const form = await ctx.db.get(formDefinitionId);
    if (!form) throw new AuthError("Form not found");
    if (!form.firmId || form.firmId !== firm._id) {
      throw new AuthError("Unauthorized: form not in caller's firm");
    }
    const existing = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) =>
        q.eq("formDefinitionId", formDefinitionId),
      )
      .collect();
    for (const fq of existing) {
      await ctx.db.delete(fq._id);
    }
    for (const row of rows) {
      await ctx.db.insert("formQuestions", {
        formDefinitionId,
        ...row,
      });
    }
  },
});
