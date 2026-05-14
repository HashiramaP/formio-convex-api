import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const SUPABASE_URL = "https://phjcuyflvepnbdfrtmaf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;
if (!SUPABASE_KEY) {
  console.error("Set SUPABASE_SECRET_KEY env var before running");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "uploads";

// Load Convex creds from .env.prod (no need for dotenv-cli — read directly).
function loadEnv(): { url: string; adminKey: string } {
  const raw = readFileSync(resolve(ROOT, ".env.prod"), "utf-8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=['"]?([^'"\n]+)['"]?$/);
    if (m) env[m[1]] = m[2];
  }
  return { url: env.CONVEX_SELF_HOSTED_URL, adminKey: env.CONVEX_SELF_HOSTED_ADMIN_KEY };
}
const { url: CONVEX_URL, adminKey: CONVEX_ADMIN_KEY } = loadEnv();
const CONCURRENCY = 10;

const FIRM_IDS = [
  "5b4ea565-a5a0-40af-8103-49bb44a1e0a8",
  "1dc36654-fbe6-4075-acae-2e859e490641",
  "89fe2abc-37f7-4f5d-82c5-8449ba35f105",
  "891dc00b-e3fb-48c0-b880-477c5e92d217",
];

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function convexCall(path: string, args: any): Promise<any> {
  const slashPath = path.replace(":", "/");
  const res = await fetch(`${CONVEX_URL}/api/run/${slashPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${CONVEX_ADMIN_KEY}`,
    },
    body: JSON.stringify({ args, format: "json" }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Convex ${path} failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const json: any = await res.json();
  if (json.status !== "success") {
    throw new Error(`Convex ${path} returned ${json.status}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.value;
}

async function selectAll<T = any>(build: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(`paginated select failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Bounded concurrency map.
async function pMap<T, R>(items: T[], fn: (item: T, i: number) => Promise<R>, concurrency: number): Promise<R[]> {
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

type Outcome = "uploaded" | "skipped-existing" | "skipped-no-path" | "error-missing-file" | "failed";

async function downloadFromSupabase(path: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) {
    // 404 / Object not found
    if (/not found|does not exist/i.test(error.message)) return null;
    throw error;
  }
  if (!data) return null;
  const arrayBuf = await data.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function uploadToConvex(bytes: Buffer, mimeType: string): Promise<string> {
  const url: string = await convexCall("submissionDocuments:generateUploadUrl", {});
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    body: bytes,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Convex upload failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

async function migrateOne(args: {
  table: "submissionDocuments" | "uploadedForms" | "generatedLegalDocs";
  convexId: string;
  filePath: string | null;
  mimeType: string | null;
  alreadyHasStorageId: boolean;
  isGenLegalDoc: boolean;
}): Promise<Outcome> {
  if (args.alreadyHasStorageId) return "skipped-existing";
  if (!args.filePath) return "skipped-no-path";

  let bytes: Buffer | null = null;
  try {
    bytes = await downloadFromSupabase(args.filePath);
  } catch (e: any) {
    console.error(`  [${args.table}/${args.convexId}] download error: ${e.message}`);
    return "failed";
  }
  if (!bytes) {
    if (args.isGenLegalDoc) {
      // Pre-existing Supabase breakage — file is gone but row exists. Mark error so the
      // frontend doesn't keep the doc in 'generating' forever.
      try {
        await convexCall("migrations:markGenLegalDocError", { convexId: args.convexId });
      } catch (e: any) {
        console.error(`  [${args.table}/${args.convexId}] markError failed: ${e.message}`);
      }
      return "error-missing-file";
    }
    console.error(`  [${args.table}/${args.convexId}] missing file: ${args.filePath}`);
    return "failed";
  }

  let storageId: string;
  try {
    storageId = await uploadToConvex(bytes, args.mimeType || "application/octet-stream");
  } catch (e: any) {
    console.error(`  [${args.table}/${args.convexId}] upload error: ${e.message}`);
    return "failed";
  }
  try {
    await convexCall("migrations:patchStorageId", {
      table: args.table,
      convexId: args.convexId,
      storageId,
    });
  } catch (e: any) {
    console.error(`  [${args.table}/${args.convexId}] patch error: ${e.message}`);
    return "failed";
  }
  return "uploaded";
}

function summarize(outcomes: Outcome[]): string {
  const counts: Record<string, number> = {};
  for (const o of outcomes) counts[o] = (counts[o] ?? 0) + 1;
  return Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ");
}

// ---------- Per-table flows ----------

async function migrateSubmissionDocuments() {
  log("=== submissionDocuments ===");

  // Need: Convex submissionDocuments → which Supabase application_documents row to fetch.
  // Pair by (submission's Supabase legacyId, name) since names include a timestamp suffix
  // and are unique within a submission. Supabase has 2915 in-scope; Convex has more (live
  // uploads after migration that already have storageId — those just skip via the
  // alreadyHasStorageId check). Positional matching is unsafe here because Convex got
  // post-migration inserts.
  // submissions don't have legacyId (we used positional matching at data migration time
  // and discarded the mapping). Both Convex and Supabase have grown since migration —
  // re-derive the mapping by exact timestamp match: Convex._creationTime was explicitly
  // set to Supabase created_at_ms during the data migration. Dedupe may have bumped some
  // by 1ms — try a small window if the exact lookup misses.
  const supSubmissions = await selectAll<any>(() =>
    supabase
      .from("client_applications")
      .select("id, created_at")
      .in("firm_id", FIRM_IDS)
      .order("created_at")
  );
  const convexSubmissions: Array<{ _id: string; _creationTime: number }> = await convexCall(
    "migrations:getRowsForMapping",
    { tableName: "submissions" }
  );
  log(`  Convex submissions: ${convexSubmissions.length} (Supabase in scope: ${supSubmissions.length})`);

  const supByCreatedMs: Map<number, any> = new Map();
  for (const s of supSubmissions) {
    supByCreatedMs.set(new Date(s.created_at).getTime(), s);
  }
  const subIdToLegacy: Record<string, string> = {};
  let mappedSubs = 0;
  for (const c of convexSubmissions) {
    let sup = supByCreatedMs.get(c._creationTime);
    for (let bump = 1; !sup && bump <= 10; bump++) {
      sup = supByCreatedMs.get(c._creationTime - bump);
    }
    if (sup) {
      subIdToLegacy[c._id] = sup.id;
      mappedSubs++;
    }
  }
  log(`  ${mappedSubs} of ${convexSubmissions.length} Convex submissions mapped to Supabase`);

  const subLegacyIds = Object.values(subIdToLegacy);
  const supRows = await selectAll<any>(() =>
    supabase
      .from("application_documents")
      .select("id, application_id, name, file_path, file_type, created_at")
      .in("application_id", subLegacyIds)
      .order("created_at")
  );
  log(`  Supabase rows in scope: ${supRows.length}`);

  // Index supabase rows by (application_id|name).
  const supByKey: Map<string, any> = new Map();
  for (const r of supRows) {
    supByKey.set(`${r.application_id}|${r.name}`, r);
  }

  // Fetch Convex submissionDocuments and look up each via its parent's legacyId + name.
  // Need submissionId on each row to do the lookup — extend the helper to return it.
  const convexRows: Array<{
    _id: string;
    storageId?: string;
    name?: string;
    submissionId?: string;
  }> = await convexCall("migrations:getSubmissionDocsForStorage", {});
  log(`  Convex submissionDocuments: ${convexRows.length}`);

  let unmatched = 0;
  let alreadyDone = 0;
  const tasks: Parameters<typeof migrateOne>[0][] = [];
  for (const c of convexRows) {
    if (c.storageId) {
      alreadyDone++;
      continue;
    }
    const parentLegacyId = c.submissionId ? subIdToLegacy[c.submissionId] : undefined;
    if (!parentLegacyId) {
      unmatched++;
      continue;
    }
    const sup = supByKey.get(`${parentLegacyId}|${c.name}`);
    if (!sup) {
      unmatched++;
      continue;
    }
    tasks.push({
      table: "submissionDocuments",
      convexId: c._id,
      filePath: sup.file_path,
      mimeType: sup.file_type || null,
      alreadyHasStorageId: false,
      isGenLegalDoc: false,
    });
  }
  log(`  To migrate: ${tasks.length}  already-done: ${alreadyDone}  unmatched: ${unmatched}`);

  let done = 0;
  const start = Date.now();
  const outcomes = await pMap(
    tasks,
    async (t) => {
      const o = await migrateOne(t);
      done++;
      if (done % 50 === 0 || done === tasks.length) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`  progress ${done}/${tasks.length} (${elapsed}s)`);
      }
      return o;
    },
    CONCURRENCY
  );
  log(`  Result: ${summarize(outcomes)}`);
}

async function migrateUploadedForms() {
  log("=== uploadedForms ===");
  const supRows = await selectAll<any>(() =>
    supabase
      .from("forms")
      .select("id, name, file_path, created_at, user_id")
      .in("user_id", FIRM_IDS)
      .order("created_at")
  );
  log(`  Supabase rows in scope: ${supRows.length}`);

  const convexRows: Array<{ _id: string; _creationTime: number; storageId?: string; name?: string }> =
    await convexCall("migrations:getStorageRows", { tableName: "uploadedForms" });
  log(`  Convex rows: ${convexRows.length}`);

  if (supRows.length !== convexRows.length) {
    throw new Error(
      `Count mismatch for uploadedForms: Supabase=${supRows.length} Convex=${convexRows.length}`
    );
  }

  const tasks = convexRows.map((c, i) => ({
    table: "uploadedForms" as const,
    convexId: c._id,
    filePath: supRows[i].file_path as string | null,
    mimeType: "application/pdf",
    alreadyHasStorageId: !!c.storageId,
    isGenLegalDoc: false,
  }));

  const outcomes = await pMap(tasks, migrateOne, CONCURRENCY);
  log(`  Result: ${summarize(outcomes)}`);
}

async function migrateGeneratedLegalDocs() {
  log("=== generatedLegalDocs ===");

  // Get migrated clients to know their Supabase UUIDs (legacyId).
  const clients: Array<{ _id: string; legacyId?: string }> = await convexCall(
    "migrations:getRowsForMapping",
    { tableName: "clients" }
  );
  const clientLegacyIds = clients.map((c) => c.legacyId).filter((x): x is string => !!x);

  const supRows = await selectAll<any>(() =>
    supabase
      .from("generated_legal_documents")
      .select("id, client_id, legal_document_id, file_path, status, created_at")
      .in("client_id", clientLegacyIds)
      .order("created_at")
  );
  log(`  Supabase rows in scope: ${supRows.length}`);

  const convexRows: Array<{ _id: string; _creationTime: number; storageId?: string; status?: string }> =
    await convexCall("migrations:getStorageRows", { tableName: "generatedLegalDocs" });
  log(`  Convex rows: ${convexRows.length}`);

  if (supRows.length !== convexRows.length) {
    throw new Error(
      `Count mismatch for generatedLegalDocs: Supabase=${supRows.length} Convex=${convexRows.length}`
    );
  }

  const tasks = convexRows.map((c, i) => ({
    table: "generatedLegalDocs" as const,
    convexId: c._id,
    filePath: supRows[i].file_path as string | null,
    mimeType: "application/pdf",
    alreadyHasStorageId: !!c.storageId,
    isGenLegalDoc: true,
  }));

  const outcomes = await pMap(tasks, migrateOne, CONCURRENCY);
  log(`  Result: ${summarize(outcomes)}`);
}

async function main() {
  log(`Storage migration to ${CONVEX_URL}`);
  log(`Concurrency: ${CONCURRENCY}`);
  await migrateSubmissionDocuments();
  await migrateUploadedForms();
  await migrateGeneratedLegalDocs();
  log("=== Done ===");
}

main().catch((e) => {
  console.error("Storage migration failed:", e);
  process.exit(1);
});
