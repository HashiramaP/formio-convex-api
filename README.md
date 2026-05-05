# @formio/convex-api

Single source of truth for the Formio Convex backend — schema, queries,
mutations, actions — and the public API surface that every frontend imports
for end-to-end type safety.

Frontend repos consume this package directly from GitHub, so any schema or
function change goes through here.

## Layout

```
convex-api/
├── convex/           # Convex functions + schema (deployed by `convex dev`)
│   ├── schema.ts
│   ├── messages.ts   # example query + mutation
│   └── _generated/   # committed; produced by `convex dev`
├── api.ts            # public API surface for consumers (regen via gen:api)
├── index.ts          # package entry: re-exports api + Doc/Id types
└── package.json
```

`_generated/` is committed because consumers need `Doc<>` / `Id<>` types from
`dataModel.ts`. `api.ts` is the deployment-decoupled public surface generated
by `convex-helpers ts-api-spec` — that's what frontends actually call.

## First-time setup

```bash
npm install
cp .env.example .env.dev    # paste dev admin key
cp .env.example .env.prod   # paste prod URL + admin key (only if deploying to prod)
```

Get an admin key from a deployment VM (one-time):

```bash
gcloud compute ssh convex-dev --tunnel-through-iap --project formio-dev \
  --command "docker compose -f /mnt/data/convex/docker-compose.yml exec backend ./generate_admin_key.sh"
```

## Daily workflow

```bash
npm run dev          # watches convex/, pushes to dev, regenerates _generated/
npm run gen:api      # rebuilds api.ts from the dev deployment's public surface
npm run typecheck
```

After changing schema or any public function:

1. `npm run dev` (leave running) — pushes the change, refreshes `_generated/`
2. `npm run gen:api` — rewrites `api.ts`
3. Commit both `_generated/` and `api.ts`
4. `npm run release:patch` (or `:minor` / `:major`) — see below

## Deploying

```bash
npm run deploy   # → api-convex-prod.formio.ca (reads .env.prod)
```

Dev stays in sync via `npm run dev`'s watch mode — no separate dev deploy needed.

## Cutting a release

```bash
npm run release:patch   # 0.0.0 → 0.0.1
npm run release:minor   # 0.0.0 → 0.1.0
npm run release:major   # 0.0.0 → 1.0.0
```

Each script regenerates `api.ts`, typechecks, bumps `package.json`, commits +
tags `vX.Y.Z`, deploys to prod, then pushes. Frontends pin to that tag.

Requires a clean working tree to start (commit your changes first).

## Consuming from a frontend

In each frontend's `package.json`, pin to a release tag:

```json
{
  "dependencies": {
    "@formio/convex-api": "github:HashiramaP/convex-api#v0.0.1",
    "convex": "^1.17.0"
  }
}
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

Update the pinned tag in `package.json`, then `npm install`. New types flow
through immediately — TS errors at compile time will flag any caller that broke.
