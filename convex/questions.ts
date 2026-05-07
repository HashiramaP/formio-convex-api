import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

    // Path 1: Self-contained — only this form's questions
    if (formDef.isSelfContained) {
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

    return [...baseQuestions, ...ownQuestions].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
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
