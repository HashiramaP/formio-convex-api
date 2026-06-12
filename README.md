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
npx convex login     # log in to the Formio team (project: formio-db)
npm run dev          # provisions your personal cloud dev deployment + writes .env.local
```

Deploys use two more env files (gitignored — see `.env.example`):

- `.env.staging` — `CONVEX_DEPLOY_KEY` minted from the **staging** cloud deployment
- `.env.prod` — `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY` for the **self-hosted** prod backend

Get the self-hosted prod admin key from its backend VM (one-time — adjust instance/project to your prod VM):

```bash
gcloud compute ssh <prod-convex-vm> --tunnel-through-iap --project <prod-project> \
  --command "docker compose -f /mnt/data/convex/docker-compose.yml exec backend ./generate_admin_key.sh"
```

## Daily workflow

```bash
npm run dev          # watches convex/, pushes to your cloud dev deployment, regenerates _generated/
npm run gen:api      # rebuilds api.ts from your dev deployment's public surface
npm run typecheck
```

After changing schema or any public function:

1. `npm run dev` (leave running) — pushes the change, refreshes `_generated/`
2. `npm run gen:api` — rewrites `api.ts`
3. Commit both `_generated/` and `api.ts`
4. Promote through staging → prod (see "Deploying" and "Cutting a release")

## Environments

| Env     | Convex backend                                       | Deploy with              |
| ------- | ---------------------------------------------------- | ------------------------ |
| dev     | your personal **cloud dev** deployment (`formio-db`) | `npm run dev` (watch)    |
| staging | shared **cloud** `staging` deployment (`formio-db`)  | `npm run deploy:staging` |
| prod    | **self-hosted** backend (Canada)                     | `npm run deploy:prod`    |

`formio-db`'s default cloud prod deployment is reserved for the future Convex-Canada
migration — never deploy to it. `deploy:staging` refuses to run unless
`CONVEX_DEPLOY_KEY` is set in `.env.staging`, so a bare `convex deploy` can't reach it.

> ⚠️ Cloud dev + staging have no Canada region — that's why prod is self-hosted.
> Never put real client PII on them; seed with the synthetic `scripts/seed-*.sh` data only.

## Deploying

```bash
npm run deploy:staging   # cloud staging (reads CONVEX_DEPLOY_KEY from .env.staging)
npm run deploy:prod      # self-hosted prod (reads .env.prod)
```

Your dev deployment stays in sync via `npm run dev`'s watch mode — no separate dev deploy needed.

## Cutting a release

Releases regenerate `api.ts` from the **staging** deployment, so deploy there first:

```bash
npm run deploy:staging   # push the new code to staging, then verify it
npm run release:patch    # 0.0.0 → 0.0.1   (also release:minor / release:major)
```

Each `release:*` runs `npm version`, whose hook regenerates `api.ts` from staging,
typechecks, bumps `package.json`, commits + tags `vX.Y.Z`, deploys to **prod**
(self-hosted), then pushes. Frontends pin to that tag.

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
VITE_CONVEX_URL=https://<your-dev-deployment>.convex.cloud   # staging/prod URLs differ per env
```

Wrap the app with `<ConvexProvider client={convex}>…</ConvexProvider>`.

## Bumping the API in consumers

Update the pinned tag in `package.json`, then `npm install`. New types flow
through immediately — TS errors at compile time will flag any caller that broke.
