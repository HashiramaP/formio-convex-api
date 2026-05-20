/**
 * Sync Convex DEV from PROD.
 *
 * Two-phase strategy:
 *   PHASE A (fast):     export prod data only (no file storage) → import dev
 *                       with --replace-all → sample → prune unwanted rows.
 *                       After this phase, dev mirrors prod's row data BUT all
 *                       storageId fields on the kept rows point to prod
 *                       _storage IDs that do not exist on dev.
 *   PHASE B (targeted): for each kept submissionDocument / generatedLegalDoc /
 *                       uploadedForm row with a storageId, download the file
 *                       from prod storage, re-upload to dev storage, patch the
 *                       row's storageId. Bounded scope: ~750 files instead of
 *                       3000+ that --include-file-storage would have pulled.
 *
 * Keeps:
 *   - firms, formDefinitions, questions, formQuestions, legalDocuments,
 *     questionTemplates  (full copies)
 *   - SAMPLE_SIZE submissions (stratified across firm + status)
 *   - clients referenced by sampled submissions
 *   - submissionDocuments + files for sampled submissions
 *   - generatedLegalDocs + files for kept clients
 *   - uploadedForms rows that have a storageId (drops the 96 broken-as-imported)
 *
 * Drops:
 *   - aiUsageLogs, errorLogs, feedback, supplementRequests
 *
 * Pre-requisite: prune helpers in convex/migrations.ts must be deployed to dev,
 * and getStorageDownloadUrl must be deployed to prod.
 */

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, rmSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const SNAPSHOT = "/tmp/convex-prod-snapshot.zip";
const SAMPLE_SIZE = 50;
const FILE_TRANSFER_CONCURRENCY = 10;

const DEV_URL = "https://api-convex-dev.formio.ca";
const DEV_KEY =
  "convex-self-hosted|01fd461710c6f12f8bea3c96c2c7e3e035d4e60ad176d065d3b8f8431c87bcd99b2b81b7b7";
const PROD_URL = "https://api-convex-prod.formio.ca";
const PROD_KEY =
  "convex-self-hosted|0127e46540a0478d3591d298333c128a6677924db58e1246367d586d1cd2274dbfe6214723";

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function convexCall(
  baseUrl: string,
  adminKey: string,
  path: string,
  args: any
): Promise<any> {
  const slashPath = path.replace(":", "/");
  const res = await fetch(`${baseUrl}/api/run/${slashPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({ args, format: "json" }),
  });
  const json: any = await res.json();
  if (json.status !== "success") {
    throw new Error(`${path} failed: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json.value;
}

const dev = (path: string, args: any = {}) => convexCall(DEV_URL, DEV_KEY, path, args);
const prod = (path: string, args: any = {}) => convexCall(PROD_URL, PROD_KEY, path, args);

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type SubRef = { _id: string; status: string; firmId: string; clientId: string | null };

function stratifiedSample(submissions: SubRef[], size: number): string[] {
  const byFirm = new Map<string, SubRef[]>();
  for (const s of submissions) {
    if (!byFirm.has(s.firmId)) byFirm.set(s.firmId, []);
    byFirm.get(s.firmId)!.push(s);
  }
  const firms = [...byFirm.keys()];
  if (firms.length === 0) return [];

  const perFirm = Math.floor(size / firms.length);
  const remainder = size - perFirm * firms.length;
  const sample: string[] = [];

  for (let f = 0; f < firms.length; f++) {
    const firmSubs = byFirm.get(firms[f])!;
    const wanted = perFirm + (f < remainder ? 1 : 0);

    const byStatus = new Map<string, SubRef[]>();
    for (const s of firmSubs) {
      if (!byStatus.has(s.status)) byStatus.set(s.status, []);
      byStatus.get(s.status)!.push(s);
    }
    for (const [k, v] of byStatus) byStatus.set(k, shuffle(v));
    const statusKeys = shuffle([...byStatus.keys()]);

    let added = 0;
    let i = 0;
    while (added < wanted && statusKeys.length > 0) {
      const sk = statusKeys[i % statusKeys.length];
      const bucket = byStatus.get(sk)!;
      if (bucket.length > 0) {
        sample.push(bucket.shift()!._id);
        added++;
        i++;
      } else {
        statusKeys.splice(i % statusKeys.length, 1);
      }
    }
  }
  return sample;
}

async function loopMutation(
  path: string,
  args: any,
  doneIf: (r: any) => boolean
): Promise<void> {
  for (let iter = 1; iter <= 60; iter++) {
    const r = await dev(path, args);
    log(`    ${path} iter ${iter}: ${JSON.stringify(r)}`);
    if (doneIf(r)) return;
  }
  throw new Error(`${path} did not converge after 60 iterations`);
}

async function chunkedCall<T>(
  ids: T[],
  chunkSize: number,
  caller: (chunk: T[]) => Promise<any>
): Promise<void> {
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const r = await caller(chunk);
    log(`    chunk ${i / chunkSize + 1}/${Math.ceil(ids.length / chunkSize)}: ${JSON.stringify(r)}`);
  }
}

async function getDevCount(table: string): Promise<number> {
  const docs = await dev("migrations:getRowsForMapping", { tableName: table });
  return (docs as any[]).length;
}

// Bounded-concurrency map.
async function pMap<T, R>(
  items: T[],
  fn: (item: T, i: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (true) {
          const i = cursor++;
          if (i >= items.length) return;
          results[i] = await fn(items[i], i);
        }
      })()
    );
  }
  await Promise.all(workers);
  return results;
}

async function transferOneFile(
  table: "submissionDocuments" | "generatedLegalDocs" | "uploadedForms",
  convexId: string,
  prodStorageId: string,
  mimeType: string
): Promise<"ok" | "missing-on-prod" | "failed"> {
  // 1. Get prod signed URL.
  let downloadUrl: string | null;
  try {
    downloadUrl = await prod("migrations:getStorageDownloadUrl", {
      storageId: prodStorageId,
    });
  } catch (e: any) {
    console.error(`  [${table}/${convexId}] prod getUrl error: ${e.message}`);
    return "failed";
  }
  if (!downloadUrl) return "missing-on-prod";

  // 2. Download bytes from prod.
  const dlRes = await fetch(downloadUrl);
  if (!dlRes.ok) {
    console.error(`  [${table}/${convexId}] download HTTP ${dlRes.status}`);
    return "failed";
  }
  const buf = Buffer.from(await dlRes.arrayBuffer());

  // 3. Get dev upload URL.
  const uploadUrl: string = await dev("submissionDocuments:generateUploadUrl", {});

  // 4. Upload to dev.
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: buf,
  });
  if (!upRes.ok) {
    console.error(`  [${table}/${convexId}] dev upload HTTP ${upRes.status}`);
    return "failed";
  }
  const { storageId: devStorageId } = (await upRes.json()) as { storageId: string };

  // 5. Patch row's storageId on dev to the new ID.
  await dev("migrations:patchStorageId", {
    table,
    convexId,
    storageId: devStorageId,
  });
  return "ok";
}

async function main() {
  log("=== sync dev from prod (data + targeted file transfer) ===");
  log(`Prod:        ${PROD_URL}`);
  log(`Dev:         ${DEV_URL}`);
  log(`Sample size: ${SAMPLE_SIZE} submissions`);

  // -------- Phase A1: export prod (data only) --------
  log("");
  log("[1/9] Exporting prod (data only, no file storage)...");
  if (existsSync(SNAPSHOT)) rmSync(SNAPSHOT);
  execSync(`npx dotenv -e .env.prod -- npx convex export --path ${SNAPSHOT}`, {
    cwd: ROOT,
    stdio: "inherit",
  });

  // -------- Phase A2: import to dev --------
  log("");
  log("[2/9] Importing to dev (--replace-all, wipes existing dev data)...");
  execSync(`npx convex import --replace-all --yes ${SNAPSHOT}`, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      CONVEX_SELF_HOSTED_URL: DEV_URL,
      CONVEX_SELF_HOSTED_ADMIN_KEY: DEV_KEY,
    },
  });

  // -------- Phase A3: stratified sample --------
  log("");
  log("[3/9] Reading submissions from dev to build sample...");
  const submissions: SubRef[] = await dev("migrations:pruneListSubmissions", {});
  log(`  found ${submissions.length} submissions on dev`);
  const keepSubIds = stratifiedSample(submissions, SAMPLE_SIZE);
  const keepSubSet = new Set(keepSubIds);
  log(`  selected ${keepSubIds.length} sample submission IDs`);

  const sampledRows = submissions.filter((s) => keepSubSet.has(s._id));
  const byStatus: Record<string, number> = {};
  const byFirm: Record<string, number> = {};
  for (const r of sampledRows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byFirm[r.firmId] = (byFirm[r.firmId] ?? 0) + 1;
  }
  log(`  sample by status: ${JSON.stringify(byStatus)}`);
  log(`  sample by firm: ${JSON.stringify(byFirm)}`);

  const keepClientIds = new Set<string>();
  for (const s of sampledRows) {
    if (s.clientId) keepClientIds.add(s.clientId);
  }
  log(`  derived ${keepClientIds.size} kept client IDs`);

  const deleteSubIds = submissions.filter((s) => !keepSubSet.has(s._id)).map((s) => s._id);
  log(`  will delete ${deleteSubIds.length} submissions`);

  // -------- Phase A4: prune orphan child rows + their (dead) storage --------
  log("");
  log("[4/9] Deleting orphan submissionDocuments (storage refs are already dead)...");
  await chunkedCall(deleteSubIds, 25, (chunk) =>
    dev("migrations:pruneDeleteSubmissionDocsFor", { submissionIds: chunk })
  );

  log("");
  log("[5/9] Deleting orphan generatedLegalDocs...");
  const allClients = await dev("migrations:getRowsForMapping", { tableName: "clients" });
  const deleteClientIds: string[] = (allClients as any[])
    .map((c) => c._id as string)
    .filter((id) => !keepClientIds.has(id));
  log(`  scanning ${deleteClientIds.length} non-kept clients for generated docs`);
  await chunkedCall(deleteClientIds, 50, (chunk) =>
    dev("migrations:pruneDeleteGenLegalDocsFor", { clientIds: chunk })
  );

  // -------- Phase A5: delete non-kept submissions and clients --------
  log("");
  log("[6/9] Deleting non-kept submissions and clients...");
  await chunkedCall(deleteSubIds, 200, (chunk) =>
    dev("migrations:pruneDeleteSubmissionsByIds", { ids: chunk })
  );
  await chunkedCall(deleteClientIds, 200, (chunk) =>
    dev("migrations:pruneDeleteClientsByIds", { ids: chunk })
  );

  // -------- Phase A6: clear aux tables + orphan uploadedForms --------
  log("");
  log("[7/9] Clearing aux tables (aiUsageLogs, errorLogs, feedback, supplementRequests)...");
  for (const t of ["aiUsageLogs", "errorLogs", "feedback", "supplementRequests"]) {
    log(`  clearing ${t}`);
    await loopMutation(
      "migrations:pruneClearTableChunked",
      { table: t, chunkSize: 1000 },
      (r) => r.hasMore === false
    );
  }
  log("  pruning uploadedForms without storageId (the 96 broken rows)");
  const ufResult = await dev("migrations:pruneDeleteUploadedFormsWithoutStorage", {});
  log(`  uploadedForms: ${JSON.stringify(ufResult)}`);

  // -------- Phase B: targeted file transfer for kept rows --------
  log("");
  log("[8/9] Transferring file bytes from prod to dev for kept rows...");

  for (const table of ["submissionDocuments", "generatedLegalDocs", "uploadedForms"] as const) {
    const needs: Array<{ _id: string; storageId: string; mimeType: string }> = await dev(
      "migrations:listRowsNeedingStorageTransfer",
      { table }
    );
    log(`  ${table}: ${needs.length} rows need a file transfer`);
    if (needs.length === 0) continue;

    let done = 0;
    const start = Date.now();
    const outcomes = await pMap(
      needs,
      async (n) => {
        const o = await transferOneFile(table, n._id, n.storageId, n.mimeType);
        done++;
        if (done % 25 === 0 || done === needs.length) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          log(`    ${table}: ${done}/${needs.length} (${elapsed}s)`);
        }
        return o;
      },
      FILE_TRANSFER_CONCURRENCY
    );
    const summary: Record<string, number> = {};
    for (const o of outcomes) summary[o] = (summary[o] ?? 0) + 1;
    log(`    ${table} result: ${JSON.stringify(summary)}`);
  }

  // -------- Final counts --------
  log("");
  log("[9/9] Final counts on dev:");
  const tables = [
    "firms",
    "clients",
    "submissions",
    "formDefinitions",
    "questions",
    "formQuestions",
    "legalDocuments",
    "submissionDocuments",
    "uploadedForms",
    "generatedLegalDocs",
    "questionTemplates",
    "aiUsageLogs",
    "errorLogs",
    "feedback",
    "supplementRequests",
  ];
  for (const t of tables) {
    log(`  ${t.padEnd(22)}: ${await getDevCount(t)}`);
  }

  log("");
  log("=== dev sync complete ===");
}

main().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
