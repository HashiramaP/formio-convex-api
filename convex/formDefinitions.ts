import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentFirm, requireFirmAccess, AuthError } from "./auth";

// All formDefinitions surfaces are dashboard-only (main-website). Form-website
// reads the form-question tree via `questions.getFormQuestions` once it has a
// formDefinitionId from the submission/client — it doesn't list or mutate.
//
// Mutations that take a formId (not firmId) check that the form belongs to the
// caller's firm via assertFormBelongsToCallerFirm.

async function assertFormBelongsToCallerFirm(
  ctx: Parameters<typeof requireCurrentFirm>[0],
  formId: import("./_generated/dataModel").Id<"formDefinitions">,
) {
  const firm = await requireCurrentFirm(ctx);
  const form = await ctx.db.get(formId);
  if (!form) throw new AuthError("Form not found");
  // Global forms (no firmId) are read-only catalog entries; mutations on them
  // are not permitted by any caller — only the team can promote new ones via
  // direct DB access during onboarding.
  if (!form.firmId || form.firmId !== firm._id) {
    throw new AuthError("Unauthorized: form not in caller's firm");
  }
  return { firm, form };
}

export const listGlobalForms = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentFirm(ctx);
    const all = await ctx.db.query("formDefinitions").collect();
    return all
      .filter(
        (f) =>
          !f.firmId &&
          !f.deletedAt &&
          !f.isBaseForm &&
          !f.isConsentForm,
      )
      .sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const listCustomForms = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const forms = await ctx.db
      .query("formDefinitions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    return forms
      .filter((f) => f.isCustom && !f.deletedAt && !f.isBaseForm)
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getFirmBaseForm = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const forms = await ctx.db
      .query("formDefinitions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const baseForm = forms.find((f) => f.isBaseForm && !f.deletedAt);
    if (!baseForm) return null;

    const allFirmForms = forms.filter(
      (f) => f.baseFormId === baseForm._id && !f.isBaseForm && !f.deletedAt,
    );

    return { ...baseForm, linkedCount: allFirmForms.length };
  },
});

export const listFormsForSendFlow = query({
  args: { firmId: v.optional(v.id("firms")) },
  handler: async (ctx, { firmId }) => {
    if (firmId) {
      await requireFirmAccess(ctx, firmId);
    } else {
      await requireCurrentFirm(ctx);
    }
    const all = await ctx.db.query("formDefinitions").collect();

    const globalForms = all
      .filter(
        (f) =>
          !f.firmId &&
          !f.deletedAt &&
          !f.isBaseForm &&
          !f.isConsentForm,
      )
      .sort((a, b) => a._creationTime - b._creationTime);

    if (!firmId) return globalForms;

    const firmCustom = all.filter(
      (f) =>
        f.firmId === firmId &&
        f.isCustom &&
        !f.deletedAt &&
        !f.isBaseForm,
    );

    const forkMap = new Map<string, { _id: string; name?: string }>();
    const originals: typeof firmCustom = [];

    for (const form of firmCustom) {
      if (form.sourceFormId) {
        forkMap.set(form.sourceFormId as string, {
          _id: form._id,
          name: form.name,
        });
      } else {
        originals.push(form);
      }
    }

    const result = globalForms.map((form) => {
      const fork = forkMap.get(form._id as string);
      if (fork) {
        return {
          ...form,
          _id: fork._id,
          name: fork.name ?? form.name,
        };
      }
      return form;
    });

    for (const orig of originals) {
      result.push(orig);
    }

    return result;
  },
});

export const listFormsForFirm = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmAccess(ctx, firmId);
    const all = await ctx.db.query("formDefinitions").collect();
    return all
      .filter(
        (f) =>
          (!f.firmId || f.firmId === firmId) && !f.deletedAt && !f.isBaseForm,
      )
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  },
});

export const createBlankForm = mutation({
  args: {
    firmId: v.id("firms"),
    name: v.string(),
    category: v.string(),
    isBaseForm: v.optional(v.boolean()),
  },
  handler: async (ctx, { firmId, name, category, isBaseForm }) => {
    await requireFirmAccess(ctx, firmId);
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    const id = await ctx.db.insert("formDefinitions", {
      name,
      category,
      slug,
      firmId,
      isCustom: true,
      isSelfContained: true,
      isBaseForm: isBaseForm ?? false,
      isConsentForm: false,
    });
    return id;
  },
});

export const renameForm = mutation({
  args: { formId: v.id("formDefinitions"), name: v.string() },
  handler: async (ctx, { formId, name }) => {
    await assertFormBelongsToCallerFirm(ctx, formId);
    await ctx.db.patch(formId, { name });
  },
});

export const deleteForm = mutation({
  args: { formId: v.id("formDefinitions") },
  handler: async (ctx, { formId }) => {
    await assertFormBelongsToCallerFirm(ctx, formId);
    const fqs = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) => q.eq("formDefinitionId", formId))
      .collect();
    for (const fq of fqs) {
      await ctx.db.delete(fq._id);
    }
    await ctx.db.delete(formId);
  },
});

export const getGlobalBaseForm = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentFirm(ctx);
    const forms = await ctx.db.query("formDefinitions").collect();
    return (
      forms.find((f) => !f.firmId && f.isBaseForm && !f.deletedAt) ?? null
    );
  },
});

export const updateFormDefinition = mutation({
  args: {
    formId: v.id("formDefinitions"),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      category: v.optional(v.string()),
      isBaseForm: v.optional(v.boolean()),
      baseFormId: v.optional(v.id("formDefinitions")),
      excludedBaseSections: v.optional(v.array(v.string())),
      isSelfContained: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { formId, updates }) => {
    await assertFormBelongsToCallerFirm(ctx, formId);
    await ctx.db.patch(formId, updates);
  },
});

export const linkBaseForm = mutation({
  args: {
    customFormId: v.id("formDefinitions"),
    baseFormId: v.optional(v.id("formDefinitions")),
  },
  handler: async (ctx, { customFormId, baseFormId }) => {
    await assertFormBelongsToCallerFirm(ctx, customFormId);
    if (baseFormId) {
      // Linking: clear self-contained, set base form, reset excluded sections
      await ctx.db.patch(customFormId, {
        baseFormId,
        isSelfContained: false,
        excludedBaseSections: [],
      });
    } else {
      // Unlinking: switch to self-contained
      await ctx.db.patch(customFormId, {
        baseFormId: undefined,
        isSelfContained: true,
        excludedBaseSections: [],
      });
    }
  },
});

export const setBaseSectionToggles = mutation({
  args: {
    customFormId: v.id("formDefinitions"),
    excludedBaseSections: v.array(v.string()),
  },
  handler: async (ctx, { customFormId, excludedBaseSections }) => {
    await assertFormBelongsToCallerFirm(ctx, customFormId);
    await ctx.db.patch(customFormId, { excludedBaseSections });
  },
});

export const forkForm = mutation({
  args: {
    sourceFormId: v.id("formDefinitions"),
    firmId: v.id("firms"),
    isBaseForm: v.optional(v.boolean()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { sourceFormId, firmId, isBaseForm, name }) => {
    // Fork target must be the caller's firm. Source can be a global form or
    // one of the caller's own — but never another firm's custom form.
    await requireFirmAccess(ctx, firmId);
    const source = await ctx.db.get(sourceFormId);
    if (!source) throw new Error("Source form not found");
    if (source.firmId && source.firmId !== firmId) {
      throw new AuthError("Unauthorized: cannot fork another firm's form");
    }

    const newName = name ?? `${source.name ?? "Formulaire"} (copie)`;
    const slug =
      newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    const newFormId = await ctx.db.insert("formDefinitions", {
      name: newName,
      description: source.description,
      slug,
      languageNames: source.languageNames,
      category: source.category,
      formGroup: source.formGroup,
      groupLabel: source.groupLabel,
      firmId,
      isCustom: true,
      sourceFormId: source._id,
      isSelfContained: true,
      isBaseForm: isBaseForm ?? false,
      isConsentForm: false,
    });

    // Copy all formQuestions
    const fqs = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) => q.eq("formDefinitionId", sourceFormId))
      .collect();

    for (const fq of fqs) {
      await ctx.db.insert("formQuestions", {
        formDefinitionId: newFormId,
        questionKey: fq.questionKey,
        orderIndex: fq.orderIndex,
        section: fq.section,
        sectionTranslations: fq.sectionTranslations,
        dependsOn: fq.dependsOn,
        labelOverride: fq.labelOverride,
        requiredOverride: fq.requiredOverride,
      });
    }

    return newFormId;
  },
});

export const deleteBaseForm = mutation({
  args: { formId: v.id("formDefinitions") },
  handler: async (ctx, { formId }) => {
    await assertFormBelongsToCallerFirm(ctx, formId);
    const all = await ctx.db.query("formDefinitions").collect();
    const linked = all.filter((f) => f.baseFormId === formId);
    for (const child of linked) {
      await ctx.db.patch(child._id, {
        baseFormId: undefined,
        excludedBaseSections: [],
      });
    }

    const fqs = await ctx.db
      .query("formQuestions")
      .withIndex("by_formDefinition", (q) => q.eq("formDefinitionId", formId))
      .collect();
    for (const fq of fqs) {
      await ctx.db.delete(fq._id);
    }

    await ctx.db.delete(formId);
    return { unlinked: linked.length };
  },
});

/**
 * Spike admin mutation — manual support path for when the AI form-import
 * feature fails (Word/PDF parsing breaks) and a consultant needs their
 * template added by hand to their firm's custom forms.
 *
 * Takes a firmId + a structured template (sections × questions) and
 * creates in one transaction:
 *   1. A new `formDefinitions` row (firm-scoped, isCustom=true,
 *      isSelfContained=true)
 *   2. Firm-scoped `questions` rows for each question (upsert by
 *      externalId; refuse cross-firm collisions)
 *   3. `formQuestions` rows linking the new form to each question with
 *      section + orderIndex
 *
 * NO AUTH — relies on the caller being on the local dev shell with the
 * deploy key. Wrap with requireAdmin before any prod deploy. If a form
 * with the same (firmId, name) already exists, refuses rather than
 * overwriting — caller must rename or manually delete first.
 */
export const adminCreateCustomFormFromTemplate = mutation({
  args: {
    firmId: v.id("firms"),
    name: v.string(),
    language: v.optional(v.string()),
    category: v.optional(v.string()),
    questions: v.array(
      v.object({
        externalId: v.string(),
        label: v.string(),
        type: v.string(),
        options: v.optional(v.any()),
        isRequired: v.optional(v.boolean()),
        indication: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        multiEntryFields: v.optional(v.any()),
        multiEntryAddLabel: v.optional(v.string()),
        section: v.optional(v.string()),
        dependsOn: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, { firmId, name, language, category, questions }) => {
    const firmForms = await ctx.db
      .query("formDefinitions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    const collision = firmForms.find(
      (f) => f.name === name && !f.deletedAt,
    );
    if (collision) {
      throw new Error(
        `formDefinition "${name}" already exists for firm ${firmId} (id=${collision._id}). Rename or delete first.`,
      );
    }

    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    // `language` arg accepted for API compat with newer schema (post-i18n
    // WIP) — silently dropped on prod schema (0.0.26) which doesn't have
    // the field yet. Hotfix path; main has the language field.
    void language;
    const formId = await ctx.db.insert("formDefinitions", {
      name,
      slug,
      firmId,
      category,
      isCustom: true,
      isSelfContained: true,
      isBaseForm: false,
      isConsentForm: false,
    });

    let orderIndex = 0;
    for (const q of questions) {
      const existing = await ctx.db
        .query("questions")
        .withIndex("by_externalId", (idx) => idx.eq("externalId", q.externalId))
        .unique();
      const questionPayload = {
        externalId: q.externalId,
        label: q.label,
        type: q.type,
        options: q.options,
        isRequired: q.isRequired,
        indication: q.indication,
        placeholder: q.placeholder,
        multiEntryFields: q.multiEntryFields,
        multiEntryAddLabel: q.multiEntryAddLabel,
        firmId,
      };
      if (existing) {
        if (existing.firmId && existing.firmId !== firmId) {
          throw new Error(
            `externalId "${q.externalId}" belongs to a different firm (${existing.firmId}) — pick a unique key`,
          );
        }
        if (!existing.firmId) {
          throw new Error(
            `externalId "${q.externalId}" is a canonical/global question — pick a firm-scoped name (e.g. prefix with "erar_alex_")`,
          );
        }
        const { externalId: _ignored, ...patch } = questionPayload;
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("questions", questionPayload);
      }
      await ctx.db.insert("formQuestions", {
        formDefinitionId: formId,
        questionKey: q.externalId,
        orderIndex: orderIndex++,
        section: q.section,
        dependsOn: q.dependsOn,
      });
    }

    return { formId, slug, questionsCreated: questions.length };
  },
});
