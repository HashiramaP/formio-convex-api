// Validates WorkOS AuthKit access tokens (RS256, JWKS at /sso/jwks/<clientId>).
// Two issuer entries cover both shapes WorkOS has used — the bare host and the
// user_management variant — so JWTs from either token version verify.
//
// Requires Convex env var WORKOS_CLIENT_ID. Set per deployment with:
//   npx dotenv -e .env.local -- npx convex env set WORKOS_CLIENT_ID client_xxx
//   npx dotenv -e .env.prod  -- npx convex env set WORKOS_CLIENT_ID client_xxx
const clientId = process.env.WORKOS_CLIENT_ID;
if (!clientId) {
  // Surfaces during convex push if missing, instead of silently letting every
  // JWT verify-attempt fail at runtime.
  throw new Error(
    "WORKOS_CLIENT_ID env var must be set in Convex deployment (npx convex env set WORKOS_CLIENT_ID <id>)",
  );
}

export default {
  providers: [
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
};
