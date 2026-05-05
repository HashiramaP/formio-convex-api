# @formio/convex-api

Single source of truth for the Formio Convex backend — schema, queries,
mutations, actions — and the public API surface that every frontend imports
for end-to-end type safety.

Frontend repos consume this package directly from GitHub, so any schema or
function change goes through here.

## Layout

```
convex-api/
├── convex/              # Convex functions + schema (deployed by `convex dev`)
│   ├── schema.ts
│   ├── messages.ts      # example query + mutation
│   └── _generated/      # committed; produced by `convex dev`
├── api.ts               # public API surface for consumers (regen via gen:api)
├── index.ts             # package entry: re-exports api + Doc/Id types
└── package.json
```

`_generated/` is committed because consumers need `Doc<>` / `Id<>` types from
`dataModel.ts`. `api.ts` is the deployment-decoupled public surface generated
by `convex-helpers ts-api-spec` — that's what frontends actually call.

## First-time setup

```bash
npm install
cp .env.example .env.local   # paste CONVEX_SELF_HOSTED_ADMIN_KEY
```

Get the admin key from the dev VM (one-time):

```bash
gcloud compute ssh convex-dev --tunnel-through-iap --project formio-dev \
  --command "docker compose -f /mnt/data/convex/docker-compose.yml exec backend ./generate_admin_key.sh"
```

## Daily workflow

```bash
npm run dev          # watches convex/, pushes to dev deployment, regenerates _generated/
npm run gen:api      # rebuilds api.ts from the live deployment's public surface
npm run typecheck
```

After changing schema or any public function:

1. `npm run dev` (leave running) — pushes the change, refreshes `_generated/`
2. `npm run gen:api` — rewrites `api.ts`
3. Commit both `_generated/` and `api.ts`
4. Push to `main` — frontends pick up the new types on their next `npm install`

## Deploying

```bash
npm run deploy       # pushes to whatever deployment .env.local points at
```

For prod, swap `.env.local` to use `https://api-convex-prod.formio.ca` and
that deployment's admin key, then `npm run deploy`.

## Consuming from a frontend

In each frontend repo's `package.json`:

```json
{
  "dependencies": {
    "@formio/convex-api": "github:HashiramaP/convex-api",
    "convex": "^1.17.0"
  }
}
```

Pin to a commit SHA for reproducibility (recommended once stable):

```json
"@formio/convex-api": "github:HashiramaP/convex-api#<sha>"
```

Then in app code:

```tsx
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from "convex/react";
import { api, type Doc, type Id } from "@formio/convex-api";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function MessagesView() {
  const messages = useQuery(api.messages.list);   // fully typed
  const send     = useMutation(api.messages.send);
  // ...
}
```

Each frontend's `.env`:

```sh
VITE_CONVEX_URL=https://api-convex-dev.formio.ca
```

Wrap the app with `<ConvexProvider client={convex}>…</ConvexProvider>`.

## Bumping the API in consumers

`npm update @formio/convex-api` re-fetches the latest `main` (or the pinned
sha). New types flow through immediately — TS errors at compile time will
flag any caller that broke.
