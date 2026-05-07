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
