import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// OCR-capable document catalog. Replaces the per-doc-type configs that
// today live in formioform/src/lib/document-ocr-configs.ts. See
// schema.ts `documents` table for shape + rationale.
//
// Mutations are open spike-style (no auth) during the IMM-indexed intake
// build-out — wrap before any prod deploy.

const fillsValidator = v.array(
  v.object({
    sourceKey: v.string(),
    externalId: v.string(),
    displayLabel: v.string(),
    transform: v.optional(v.string()),
  }),
);

const docConfigShape = v.object({
  key: v.string(),
  name: v.string(),
  expectedDocumentType: v.string(),
  prompt: v.string(),
  fills: fillsValidator,
  skipNameVerification: v.optional(v.boolean()),
  firmId: v.optional(v.id("firms")),
});

async function upsertOne(
  ctx: { db: { query: any; patch: any; insert: any } },
  doc: {
    key: string;
    name: string;
    expectedDocumentType: string;
    prompt: string;
    fills: Array<{
      sourceKey: string;
      externalId: string;
      displayLabel: string;
      transform?: string;
    }>;
    skipNameVerification?: boolean;
    firmId?: any;
  },
) {
  const { key, firmId, ...rest } = doc;
  const candidates = await ctx.db
    .query("documents")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .collect();
  const existing = candidates.find((d: any) => d.firmId === firmId);
  if (existing) {
    await ctx.db.patch(existing._id, { ...rest, firmId });
    return { key, action: "updated" as const };
  }
  await ctx.db.insert("documents", { key, firmId, ...rest });
  return { key, action: "inserted" as const };
}

/**
 * Upsert a single document config by `key`. Canonical (firmId omitted)
 * configs are shared across all firms; firm-scoped configs override on a
 * per-key basis.
 */
export const setDocumentConfig = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    expectedDocumentType: v.string(),
    prompt: v.string(),
    fills: fillsValidator,
    skipNameVerification: v.optional(v.boolean()),
    firmId: v.optional(v.id("firms")),
  },
  handler: async (ctx, args) => upsertOne(ctx, args),
});

/**
 * Batch upsert — mirrors `seedCanonicalQuestions`. Used by the seed script
 * to install the canonical document catalog (passport, nationalId, etc.)
 * in one call.
 */
export const seedCanonicalDocuments = mutation({
  args: { documents: v.array(docConfigShape) },
  handler: async (ctx, { documents }) => {
    const results = [];
    for (const doc of documents) {
      results.push(await upsertOne(ctx, doc));
    }
    return results;
  },
});

/**
 * List all documents the given firm can use: firm-scoped configs override
 * canonical ones for the same key. When `firmId` is omitted, returns only
 * canonical configs.
 */
export const listDocuments = query({
  args: { firmId: v.optional(v.id("firms")) },
  handler: async (ctx, { firmId }) => {
    const canonical = await ctx.db
      .query("documents")
      .withIndex("by_firm", (q) => q.eq("firmId", undefined))
      .collect();
    if (!firmId) return canonical;
    const firmScoped = await ctx.db
      .query("documents")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    // Firm-scoped wins over canonical on key collisions.
    const byKey = new Map<string, (typeof canonical)[number]>();
    for (const d of canonical) byKey.set(d.key, d);
    for (const d of firmScoped) byKey.set(d.key, d);
    return Array.from(byKey.values());
  },
});

/**
 * Fetch document configs by their keys. Used by `getIntakeForClient` to
 * enrich the per-IMM requiredDocuments stubs with full extraction config.
 * Returns one entry per key; missing keys are simply omitted.
 */
export const getDocumentsByKeys = query({
  args: {
    keys: v.array(v.string()),
    firmId: v.optional(v.id("firms")),
  },
  handler: async (ctx, { keys, firmId }) => {
    const results = await Promise.all(
      keys.map(async (key) => {
        const candidates = await ctx.db
          .query("documents")
          .withIndex("by_key", (q) => q.eq("key", key))
          .collect();
        // Prefer firm-scoped, fall back to canonical.
        const firmScoped = firmId
          ? candidates.find((d) => d.firmId === firmId)
          : undefined;
        const canonical = candidates.find((d) => d.firmId === undefined);
        return firmScoped ?? canonical ?? null;
      }),
    );
    return results.filter(Boolean);
  },
});
