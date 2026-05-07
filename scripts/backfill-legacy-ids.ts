import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = "https://phjcuyflvepnbdfrtmaf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;
if (!SUPABASE_KEY) {
  console.error("Set SUPABASE_SECRET_KEY env var before running");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FIRM_IDS = [
  "5b4ea565-a5a0-40af-8103-49bb44a1e0a8",
  "1dc36654-fbe6-4075-acae-2e859e490641",
  "89fe2abc-37f7-4f5d-82c5-8449ba35f105",
  "891dc00b-e3fb-48c0-b880-477c5e92d217",
];

function convexRun(fn: string, args: any): any {
  const argsJson = JSON.stringify(args);
  const tmpFile = `/tmp/convex-backfill-${Date.now()}.json`;
  writeFileSync(tmpFile, argsJson);
  try {
    const result = execSync(
      `npx convex run ${fn} "$(cat ${tmpFile})"`,
      { cwd: resolve(__dirname, ".."), maxBuffer: 50 * 1024 * 1024, encoding: "utf-8" }
    );
    unlinkSync(tmpFile);
    return result.trim() ? JSON.parse(result.trim()) : {};
  } catch (e: any) {
    try { unlinkSync(tmpFile); } catch {}
    throw new Error(`convex run ${fn} failed: ${e.message}`);
  }
}

async function main() {
  console.log("[Backfill] Fetching Supabase clients (ORDER BY created_at)...");
  const { data: supabaseClients, error } = await supabase
    .from("clients")
    .select("id, firm_id, first_name, last_name")
    .in("firm_id", FIRM_IDS)
    .order("created_at");

  if (error) throw error;
  console.log(`[Backfill] Found ${supabaseClients!.length} Supabase clients`);

  console.log("[Backfill] Fetching Convex clients (insertion order)...");
  const convexClients: { _id: string; firstName?: string; lastName?: string }[] =
    convexRun("migrations:getClients", {});
  console.log(`[Backfill] Found ${convexClients.length} Convex clients`);

  if (convexClients.length !== supabaseClients!.length) {
    console.error(
      `Count mismatch: ${convexClients.length} Convex vs ${supabaseClients!.length} Supabase`
    );
    process.exit(1);
  }

  const mismatches: string[] = [];
  const mappings: { convexClientId: string; supabaseUuid: string }[] = [];

  for (let i = 0; i < convexClients.length; i++) {
    const cc = convexClients[i];
    const sc = supabaseClients![i];

    if (cc.firstName !== sc.first_name || cc.lastName !== sc.last_name) {
      mismatches.push(
        `[${i}] Convex: "${cc.firstName} ${cc.lastName}" vs Supabase: "${sc.first_name} ${sc.last_name}"`
      );
    }

    mappings.push({ convexClientId: cc._id, supabaseUuid: sc.id });
  }

  if (mismatches.length > 0) {
    console.error(`Found ${mismatches.length} name mismatches:`);
    for (const m of mismatches) console.error(`  ${m}`);
    console.error("Aborting — positional matching failed.");
    process.exit(1);
  }

  console.log(`[Backfill] All ${mappings.length} names verified. Running backfill...`);

  const BATCH = 50;
  let totalUpdated = 0;
  for (let i = 0; i < mappings.length; i += BATCH) {
    const batch = mappings.slice(i, i + BATCH);
    const result = convexRun("migrations:backfillLegacyClientIds", { mappings: batch });
    totalUpdated += result.updated ?? batch.length;
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${batch.length} clients`);
  }

  console.log(`[Backfill] Done: ${totalUpdated} clients updated with legacyId.`);
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
