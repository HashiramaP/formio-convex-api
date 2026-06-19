# Deploy & data-ops runbook

Detailed procedures, gotchas, and history for deploying `convex-api` and running
data operations. `../CLAUDE.md` carries the short must-know summary and links
here; `../README.md` has the baseline command reference. This file is the place
for the blow-by-blow detail and dated incident history.

## Environments

| Env     | Backend                                              | Deploy / push           | Notes |
|---------|------------------------------------------------------|-------------------------|-------|
| dev     | personal **cloud** deployment (`formio-db`)          | `npm run dev` (watch)   | `.env.local` pins `CONVEX_DEPLOYMENT=dev:…`. No separate deploy — the watcher pushes the working tree. |
| staging | shared **cloud** `brainy-lyrebird-141` (`formio-db`) | `npm run deploy:staging`| Needs `CONVEX_DEPLOY_KEY` in `.env.staging`. Deploy key is **deploy-only** (no `ViewData`). |
| prod    | **self-hosted** Canada `api-convex-prod.formio.ca`   | `npm run deploy:prod`   | Self-hosted creds in `.env.prod` (`CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY`). |

`formio-db`'s default cloud prod deployment is **reserved** for the future
Convex-Canada migration — never deploy to it. Git promotion: feature → `staging`
→ `main` (prod). "dev" is a deployment, not a branch.

## Gotcha: `.env.local` conflicts with self-hosted prod deploy/run

`.env.local` pins `CONVEX_DEPLOYMENT=dev:…`, and the Convex CLI re-reads that
*file* from the project dir. With the self-hosted vars also set (from `.env.prod`),
any `convex deploy` / `convex run` against prod aborts:

```
✖ CONVEX_DEPLOYMENT must not be set when CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY are set
```

`env -u CONVEX_DEPLOYMENT` does **not** fix it — the CLI reads the file, not just
the process env. The reliable fix is to move `.env.local` aside for the command,
with a `trap` so it's always restored even on failure:

```bash
cd convex-api
trap "mv -f .env.local.bak .env.local 2>/dev/null && echo '[.env.local restored]'" EXIT
mv .env.local .env.local.bak
npm run deploy:prod
# data ops against prod, same pattern:
# ./node_modules/.bin/dotenv -e .env.prod -- ./node_modules/.bin/convex run migrations:<fn>
```

Call the **local** binaries (`./node_modules/.bin/dotenv`, `./node_modules/.bin/convex`):
a bare `dotenv` on PATH resolves to the Python one, which rejects `-e <file>`
with `'.env.prod' is not a valid boolean`.

## Cutting a prod release (`release:patch`)

`release:patch` = `npm version patch && npm run deploy:prod && git push --follow-tags`.
`npm version` fires the `version` hook (`npm run gen:api && npm run typecheck && git add api.ts`),
then commits the bump and tags `vX.Y.Z`.

Procedure:
1. Promote `staging → main` (fast-forward) and be on `main` with a clean tree.
2. Run `npm run release:patch`.
3. **It will fail at `deploy:prod`** on the `.env.local` conflict above. That's
   expected today. The version commit + tag have **already landed** — do NOT
   re-run `npm version` (that double-bumps).
4. Finish the deploy manually with `.env.local` moved aside (snippet above), then
   `git push --follow-tags origin main`.

A permanent fix would wrap `deploy:prod` to move `.env.local` aside itself; not
done yet.

## Gotcha: `gen:api` introspects the DEV deployment

`gen:api` (`convex-helpers ts-api-spec --output-file api.ts`) reads a **live**
deployment via env vars; with no override the CLI loads `.env.local` → **dev**.
The `version` hook runs it, so `release:*` bakes **whatever is currently deployed
on dev** into the published `api.ts` — not `main`, not staging.

Because `npm run dev` continuously pushes your working tree to dev, treat dev as
**frozen between `npm run deploy:staging` and the cut release tag**. Don't start
the next feature's `npm run dev` until the tag is cut, or that feature's API
surface leaks into the release.

Staging can't be used as the introspection source: `.env.staging`'s deploy key
lacks `ViewData`, so `ts-api-spec` against it fails with a permission error. The
old `gen:api:staging` mitigation was removed for that reason. (Alternative not
taken: re-mint the staging key with `ViewData`.)

## Staging data ops need the logged-in session

`.env.staging`'s `CONVEX_DEPLOY_KEY` is deploy-only (no `ViewData`/`ViewBackups`),
so `convex run` / `convex data` / `convex import` against staging fail under it.
Run those under your `~/.convex` login instead, with `CONVEX_DEPLOYMENT` and
`CONVEX_DEPLOY_KEY` unset, targeting the deployment by name:

```bash
env -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOY_KEY \
  npx convex run migrations:<fn> --deployment brainy-lyrebird-141
```

## Migrations

- `migrations:backfillClientStatusesFromSubmissions` — recomputes every client's
  pipeline status (`new` / `in_progress` / `submitted`) from its submissions
  (and active supplement requests). Idempotent: only patches rows that change.
  Run it after deploying changes to the status logic so existing rows reconcile.

## Compliance

Cloud dev + staging are **not** in a Canada region (that's why prod is
self-hosted). Never copy real client PII there — firm-only records are fine.
Delete any local export zips afterward.

## History

- **2026-06-09 — v0.0.27 `api.ts` polluted by dev.** Release introspected dev
  while dev ran an unmerged feature branch; `api.ts` wrongly included
  `notificationProfile*` and dropped `searchClients`. Root of the "freeze dev
  during release" rule above.
- **2026-06-15 — staging↔prod data sync.** Established `convex export`→`import`
  flow; hit the deploy-only-key and `.env.local` issues. A 4.4 GB
  `--include-file-storage` import wedged (only cancellable from the dashboard) —
  prefer data-only export, sync file storage separately.
- **2026-06-19 — client-status sync fix shipped to prod (v0.0.28).** Dashboard
  columns read `client.status`, which had drifted from submission state
  (finished forms stuck in "En cours"). Added `recomputeClientStatus` + the
  backfill migration; later refined so a client is only "En cours" after the
  first answer. Promotion: staging → main, `release:patch` (hit the `.env.local`
  conflict, recovered per above), prod backfill recomputed **147/358** clients
  (104→submitted, 43→in_progress). Confirmed `env -u CONVEX_DEPLOYMENT` does not
  work for self-hosted deploy/run — move `.env.local` aside.
