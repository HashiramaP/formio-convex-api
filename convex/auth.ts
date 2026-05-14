import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Auth helpers for server-side authorization. Use these instead of trusting the
// caller's `firmId` argument — the JWT-verified WorkOS user ID is the source of
// truth.
//
// Functions called from form-website (the anonymous client-filling flow) MUST
// NOT use these helpers — that surface is unauthenticated by design and relies
// on Convex IDs in the URL acting as bearer tokens.

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

type Ctx = QueryCtx | MutationCtx;

// Returns the WorkOS user ID from the JWT subject claim, or throws if no valid
// JWT was passed by the client.
export async function requireWorkosUserId(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError("Unauthorized: no auth identity (missing or invalid JWT)");
  }
  // For WorkOS AuthKit, `subject` is the workosUserId (e.g. "user_01ABC...").
  return identity.subject;
}

// Returns the firm row owned by the currently authenticated WorkOS user, or
// throws if no firm is attached (incomplete onboarding / cancelled invitation).
export async function requireCurrentFirm(ctx: Ctx): Promise<Doc<"firms">> {
  const workosUserId = await requireWorkosUserId(ctx);
  const firm = await ctx.db
    .query("firms")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
    .first();
  if (!firm) {
    throw new AuthError(
      "Unauthorized: authenticated user has no firm attached",
    );
  }
  return firm;
}

// Throws if the caller's firm doesn't match the requested firmId. Use for any
// function that takes a `firmId` arg and reads/writes firm-scoped data.
export async function requireFirmAccess(
  ctx: Ctx,
  firmId: Id<"firms">,
): Promise<Doc<"firms">> {
  const firm = await requireCurrentFirm(ctx);
  if (firm._id !== firmId) {
    throw new AuthError("Unauthorized: firm mismatch");
  }
  return firm;
}

// WorkOS AuthKit JWTs don't populate the standard OIDC `email` claim —
// the user's email lands in the actor-subject (`act.sub`) claim instead. We
// check both: prefer the standard claim if a future WorkOS version emits it,
// fall back to `act.sub` which is what AuthKit 0.16.x actually issues.
function extractEmail(identity: { email?: string }): string | null {
  if (identity.email) return identity.email.toLowerCase();
  const actSub = (identity as Record<string, unknown>)["act.sub"];
  if (typeof actSub === "string" && actSub.includes("@")) {
    return actSub.toLowerCase();
  }
  return null;
}

// Throws unless the caller's WorkOS-account email is in the ADMIN_EMAILS env
// var (comma-separated, case-insensitive). This is the server-side gate for
// admin-dashboard queries — the admin-website already checks the same allowlist
// client-side to gate the UI, but that check is bypassable.
export async function requireAdmin(ctx: Ctx): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError("Unauthorized: admin access requires authentication");
  }
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) {
    throw new AuthError(
      "Server misconfigured: ADMIN_EMAILS env var is empty (set with `npx convex env set ADMIN_EMAILS a@x.com,b@y.com`)",
    );
  }
  const email = extractEmail(identity);
  if (!email || !allowlist.includes(email)) {
    throw new AuthError("Unauthorized: not in admin allowlist");
  }
}

// Verifies the caller owns the client (via firmId match). Useful for client-
// scoped mutations that take a clientId but where the client's firmId IS the
// authoritative tenant boundary, not a separately-passed firmId.
export async function requireClientAccess(
  ctx: Ctx,
  clientId: Id<"clients">,
): Promise<{ firm: Doc<"firms">; client: Doc<"clients"> }> {
  const firm = await requireCurrentFirm(ctx);
  const client = await ctx.db.get(clientId);
  if (!client || client.firmId !== firm._id) {
    throw new AuthError("Unauthorized: client not in caller's firm");
  }
  return { firm, client };
}

// Verifies the caller owns the submission (via the parent's firmId).
export async function requireSubmissionAccess(
  ctx: Ctx,
  submissionId: Id<"submissions">,
): Promise<{ firm: Doc<"firms">; submission: Doc<"submissions"> }> {
  const firm = await requireCurrentFirm(ctx);
  const submission = await ctx.db.get(submissionId);
  if (!submission || submission.firmId !== firm._id) {
    throw new AuthError("Unauthorized: submission not in caller's firm");
  }
  return { firm, submission };
}
