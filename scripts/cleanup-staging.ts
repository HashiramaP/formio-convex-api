/**
 * Staging Data Cleanup Script
 * Deletes excess client data from staging to reduce Convex storage usage.
 * Keeps only ~20 most recent clients per firm with smart cascade deletion.
 *
 * Usage:
 *   npx tsx scripts/cleanup-staging.ts [samplesPerFirm] [deploymentUrl] [adminToken]
 *
 * Examples:
 *   npx tsx scripts/cleanup-staging.ts 20                              # Uses staging env vars
 *   npx tsx scripts/cleanup-staging.ts 15 https://staging.convex.url admin-key
 */

import { ConvexClient } from "convex/browser";
import { api } from "../api";

const samplesPerFirm = parseInt(process.argv[2] ?? "20");
const deploymentUrl =
  process.argv[3] ?? process.env.CONVEX_URL ?? "https://staging.convex.url";
const adminToken =
  process.argv[4] ?? process.env.CONVEX_ADMIN_TOKEN ?? process.env.CONVEX_DEPLOYMENT_KEY;

if (!adminToken) {
  console.error(
    "ERROR: CONVEX_ADMIN_TOKEN or CONVEX_DEPLOYMENT_KEY not set and not provided as argument 4"
  );
  process.exit(1);
}

if (!deploymentUrl || deploymentUrl === "https://staging.convex.url") {
  console.error("ERROR: CONVEX_URL not set and not provided as argument 3");
  process.exit(1);
}

const client = new ConvexClient(deploymentUrl);
client.setAuth(adminToken);

async function cleanupStagingData() {
  console.log(`🧹 Cleaning up staging data...`);
  console.log(`   Deployment: ${deploymentUrl}`);
  console.log(`   Keeping: ${samplesPerFirm} clients per firm`);
  console.log("");

  try {
    const result = await client.mutation(api.admin.cleanupStagingData, {
      samplesPerFirm,
    });

    console.log(`✅ Cleanup complete!\n`);
    console.log(`Total clients deleted: ${result.totalDeleted}`);
    console.log(`\nDetails by firm:`);

    for (const firm of result.firmDetails) {
      const firmName = firm.displayName || `(ID: ${firm.firmId})`;
      console.log(`  • ${firmName}: ${firm.deleted} clients removed`);
    }

    console.log("");
    console.log(
      "💡 Tip: This may take a few minutes to sync to Convex billing."
    );
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }
}

cleanupStagingData();
