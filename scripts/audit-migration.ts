/**
 * Migration Audit Script
 * Compares Supabase prod data with Convex prod deployment
 * to verify data integrity after the migration.
 */

import { ConvexClient } from "convex/browser";
import { api } from "../api";

const client = new ConvexClient(
  process.env.CONVEX_URL || "https://api-convex-prod.formio.ca"
);

// Set the admin token
if (process.env.CONVEX_SELF_HOSTED_ADMIN_KEY) {
  client.setAuth(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY);
}

interface AuditResult {
  table: string;
  supabaseCount: number;
  convexCount: number;
  status: "OK" | "MISMATCH" | "ERROR";
  details?: string;
}

const results: AuditResult[] = [];

async function auditTable(
  sbTable: string,
  convexTable: string,
  supabaseCount: number
): Promise<AuditResult> {
  try {
    const convexCount = await client.query(api.migrations.getRowsForMapping, {
      tableName: convexTable,
    });

    const count = (convexCount as any[]).length;

    return {
      table: `${sbTable} → ${convexTable}`,
      supabaseCount,
      convexCount: count,
      status: count === supabaseCount ? "OK" : "MISMATCH",
      details:
        count !== supabaseCount
          ? `Expected ${supabaseCount}, found ${count} (difference: ${Math.abs(supabaseCount - count)})`
          : undefined,
    };
  } catch (error) {
    return {
      table: `${sbTable} → ${convexTable}`,
      supabaseCount,
      convexCount: 0,
      status: "ERROR",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("🔍 Starting Migration Audit...\n");

  const mappings = [
    { sb: "users", convex: "firms", count: 9 },
    { sb: "clients", convex: "clients", count: 221 },
    { sb: "client_applications", convex: "submissions", count: 211 },
    { sb: "applications", convex: "formDefinitions", count: 50 },
    { sb: "questions", convex: "questions", count: 3154 },
    { sb: "form_questions", convex: "formQuestions", count: 4518 },
    { sb: "legal_documents", convex: "legalDocuments", count: 44 },
    { sb: "generated_legal_documents", convex: "generatedLegalDocs", count: 33 },
    { sb: "application_documents", convex: "submissionDocuments", count: 2961 },
    { sb: "transactions", convex: "aiUsageLogs", count: 650 },
    { sb: "forms", convex: "uploadedForms", count: 243 },
    { sb: "feedback", convex: "feedback", count: 22 },
    { sb: "supplement_requests", convex: "supplementRequests", count: 4 },
    { sb: "error_logs", convex: "errorLogs", count: 2891 },
  ];

  for (const mapping of mappings) {
    const result = await auditTable(
      mapping.sb,
      mapping.convex,
      mapping.count
    );
    results.push(result);
  }

  console.log("📊 AUDIT RESULTS:\n");
  console.log("Table Migration Status:");
  console.log("═".repeat(80));

  let passCount = 0;
  let mismatchCount = 0;
  let errorCount = 0;

  for (const result of results) {
    const statusIcon =
      result.status === "OK" ? "✅" : result.status === "MISMATCH" ? "⚠️" : "❌";
    console.log(`${statusIcon} ${result.table}`);
    console.log(
      `   Supabase: ${result.supabaseCount} rows | Convex: ${result.convexCount} rows`
    );
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    console.log();

    if (result.status === "OK") passCount++;
    else if (result.status === "MISMATCH") mismatchCount++;
    else errorCount++;
  }

  console.log("═".repeat(80));
  console.log(
    `\n📈 Summary: ${passCount} passed, ${mismatchCount} mismatches, ${errorCount} errors`
  );

  if (mismatchCount > 0 || errorCount > 0) {
    console.log("\n⚠️  ACTION REQUIRED: Data integrity issues detected");
    process.exit(1);
  } else {
    console.log("\n✅ All tables migrated successfully!");
  }
}

main().catch(console.error);
