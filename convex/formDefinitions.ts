import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listGlobalForms = query({
  args: {},
  handler: async (ctx) => {
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
    await ctx.db.patch(formId, { name });
  },
});

export const deleteForm = mutation({
  args: { formId: v.id("formDefinitions") },
  handler: async (ctx, { formId }) => {
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
    await ctx.db.patch(formId, updates);
  },
});

export const linkBaseForm = mutation({
  args: {
    customFormId: v.id("formDefinitions"),
    baseFormId: v.optional(v.id("formDefinitions")),
  },
  handler: async (ctx, { customFormId, baseFormId }) => {
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
    const source = await ctx.db.get(sourceFormId);
    if (!source) throw new Error("Source form not found");

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
