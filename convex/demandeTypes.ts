import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireFirmAccess } from "./auth";

// Firm-safe slug from a preset name (accent-stripped, kebab-cased).
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "preset"
  );
}

// Demande presets — a named bundle of IMMs (legalDocuments) that get
// attached to a client together when a consultant picks a demande type.
// Multiplier for setup: pick "parrainage-époux au Canada" once, the right
// IMMs land on the client and the dynamic intake generator does the rest.
//
// Auth: open during the Slice 2 spike so seed scripts + CLI tests work
// with just the admin key. Wrap with `requireCurrentFirm` once the
// dashboard catalog editor lands. firmId optional for canonical presets
// shared across all firms; per-firm overrides come later.

export const setDemandeType = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    legalDocumentIds: v.array(v.id("legalDocuments")),
    firmId: v.optional(v.id("firms")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("demandeTypes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("demandeTypes", args);
  },
});

export const listDemandeTypes = query({
  args: { category: v.optional(v.string()), firmId: v.optional(v.id("firms")) },
  handler: async (ctx, { category, firmId }) => {
    // Pull canonical (no firmId) plus the firm's own presets when firmId is
    // provided. Frontend filters/sorts; we just supply the union.
    const canonical = await ctx.db
      .query("demandeTypes")
      .withIndex("by_firm", (q) => q.eq("firmId", undefined))
      .collect();
    const firmOwned = firmId
      ? await ctx.db
          .query("demandeTypes")
          .withIndex("by_firm", (q) => q.eq("firmId", firmId))
          .collect()
      : [];
    const all = [...canonical, ...firmOwned];
    return category ? all.filter((d) => d.category === category) : all;
  },
});

export const getDemandeType = query({
  args: { id: v.id("demandeTypes") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getDemandeTypeBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    await ctx.db
      .query("demandeTypes")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
});

// Attach a demande type to a client — resolves the preset's legalDocumentIds
// and writes them onto `clients.legalDocuments`. Replaces existing IMMs (v1
// behavior); future evolution can merge / extend / remove.
export const attachDemandeToClient = mutation({
  args: {
    clientId: v.id("clients"),
    demandeTypeId: v.id("demandeTypes"),
  },
  handler: async (ctx, { clientId, demandeTypeId }) => {
    const dt = await ctx.db.get(demandeTypeId);
    if (!dt) throw new Error(`demandeType ${demandeTypeId} not found`);
    // Record the demande type too so the intake curation knows which firm
    // config applies for this client (see getIntakeForClient).
    await ctx.db.patch(clientId, {
      legalDocuments: dt.legalDocumentIds,
      demandeTypeId,
    });
    return { clientId, legalDocumentIds: dt.legalDocumentIds, demandeName: dt.name };
  },
});

// ── Firm-owned presets ──────────────────────────────────────────────────────
// A cabinet builds its own presets (name + chosen IMMs). Firm-scoped via
// requireFirmAccess; canonical presets (firmId undefined) are never editable
// by a firm. listDemandeTypes already returns canonical + the firm's own.

export const createFirmDemandeType = mutation({
  args: {
    firmId: v.id("firms"),
    name: v.string(),
    legalDocumentIds: v.array(v.id("legalDocuments")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { firmId, name, legalDocumentIds, description }) => {
    await requireFirmAccess(ctx, firmId);
    // Firm-scoped slug so two firms can use the same preset name.
    const slug = `${slugify(name)}-${firmId}`;
    const id = await ctx.db.insert("demandeTypes", {
      firmId,
      name,
      legalDocumentIds,
      description,
      slug,
    });
    return await ctx.db.get(id);
  },
});

// Branch a demande type into a firm-owned, editable copy. Source can be a
// canonical (Formio) template or another firm type. Copies the IMM bundle and
// — so the branch is a true fork — any curation the firm already did on the
// source (disabled questions + document overrides) onto the new id.
export const branchDemandeType = mutation({
  args: {
    firmId: v.id("firms"),
    sourceDemandeTypeId: v.id("demandeTypes"),
  },
  handler: async (ctx, { firmId, sourceDemandeTypeId }) => {
    await requireFirmAccess(ctx, firmId);
    const src = await ctx.db.get(sourceDemandeTypeId);
    if (!src) throw new Error("source demandeType not found");

    const name = `${src.name} (copie)`;
    const base = `${slugify(name)}-${firmId}`;
    const existing = await ctx.db
      .query("demandeTypes")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    let slug = base;
    let n = 1;
    while (existing.some((e) => e.slug === slug)) slug = `${base}-${n++}`;

    const newId = await ctx.db.insert("demandeTypes", {
      firmId,
      name,
      slug,
      legalDocumentIds: src.legalDocumentIds,
      description: src.description,
    });

    // Carry over the firm's curation for the source id, if any.
    const firm = await ctx.db.get(firmId);
    if (firm) {
      const disabled = firm.intakeDisabledFields ?? {};
      const docs = firm.requiredDocOverrides ?? {};
      const patch: Record<string, unknown> = {};
      if (disabled[sourceDemandeTypeId]) {
        patch.intakeDisabledFields = { ...disabled, [newId]: disabled[sourceDemandeTypeId] };
      }
      if (docs[sourceDemandeTypeId]) {
        patch.requiredDocOverrides = { ...docs, [newId]: docs[sourceDemandeTypeId] };
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch(firmId, patch);
    }

    return newId;
  },
});

export const updateFirmDemandeType = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
    updates: v.object({
      name: v.optional(v.string()),
      legalDocumentIds: v.optional(v.array(v.id("legalDocuments"))),
      description: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { firmId, demandeTypeId, updates }) => {
    await requireFirmAccess(ctx, firmId);
    const dt = await ctx.db.get(demandeTypeId);
    // Only the owning firm may edit; canonical presets (firmId undefined) can't.
    if (!dt || dt.firmId !== firmId) return null;
    await ctx.db.patch(demandeTypeId, updates);
    return await ctx.db.get(demandeTypeId);
  },
});

export const deleteFirmDemandeType = mutation({
  args: {
    firmId: v.id("firms"),
    demandeTypeId: v.id("demandeTypes"),
  },
  handler: async (ctx, { firmId, demandeTypeId }) => {
    await requireFirmAccess(ctx, firmId);
    const dt = await ctx.db.get(demandeTypeId);
    if (!dt || dt.firmId !== firmId) return false;
    await ctx.db.delete(demandeTypeId);
    return true;
  },
});
