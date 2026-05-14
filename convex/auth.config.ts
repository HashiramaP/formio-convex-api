// Validates WorkOS AuthKit access tokens. Two issuer entries cover both JWT
// shapes WorkOS issues — the bare host and the user_management variant.
//
// Requires Convex env var WORKOS_CLIENT_ID. Set per deployment:
//   npx convex env set WORKOS_CLIENT_ID client_xxx
const clientId = process.env.WORKOS_CLIENT_ID;
if (!clientId) {
  throw new Error(
    "WORKOS_CLIENT_ID env var must be set in Convex deployment (npx convex env set WORKOS_CLIENT_ID <id>)",
  );
}

const jwks = `https://api.workos.com/sso/jwks/${clientId}`;

const authConfig = {
  providers: [
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks,
      applicationID: clientId,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks,
    },
  ],
};

export default authConfig;
