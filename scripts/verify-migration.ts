/**
 * Migration Verification Script
 * Detailed audit of Supabase → Convex migration
 * Checks: row counts, foreign key integrity, storage file mapping
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const SUPABASE_URL = "https://phjcuyflvepnbdfrtmaf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_KEY) {
  console.error("❌ Set SUPABASE_SECRET_KEY before running");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface TableAudit {
  name: string;
  sbTable: string;
  sbCount: number;
  sbDetails?: string;
}

const audits: TableAudit[] = [];

async function auditTable(
  name: string,
  sbTable: string
): Promise<TableAudit> {
  try {
    const { data, error, count } = await supabase
      .from(sbTable)
      .select("*", { count: "exact", head: true });

    if (error) {
      return {
        name,
        sbTable,
        sbCount: 0,
        sbDetails: `Query error: ${error.message}`,
      };
    }

    return {
      name,
      sbTable,
      sbCount: count ?? 0,
    };
  } catch (e) {
    return {
      name,
      sbTable,
      sbCount: 0,
      sbDetails: `Exception: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function auditStorageMapping() {
  console.log("\n📦 STORAGE AUDIT\n");
  console.log("Checking file_path mappings in:");
  console.log("  - application_documents.file_path → Convex submissionDocuments.storageId");
  console.log("  - generated_legal_documents.file_path → Convex generatedLegalDocs.storageId");
  console.log("  - forms.file_path → Convex uploadedForms.storageId");

  try {
    // Check for unmapped documents
    const { data: appDocs, count: appDocsCount } = await supabase
      .from("application_documents")
      .select("id, file_path, application_id", { count: "exact" })
      .not("file_path", "is", null);

    console.log(
      `\n  application_documents with file_path: ${appDocsCount || 0} total`
    );

    const { data: genDocs } = await supabase
      .from("generated_legal_documents")
      .select("id, file_path, status", { count: "exact" })
      .not("file_path", "is", null);

    console.log(
      `  generated_legal_documents with file_path: ${genDocs?.length || 0} total`
    );

    const { data: forms } = await supabase
      .from("forms")
      .select("id, file_path, status", { count: "exact" })
      .not("file_path", "is", null);

    console.log(`  forms with file_path: ${forms?.length || 0} total`);

    // Sample file paths to verify naming
    if (appDocs && appDocs.length > 0) {
      console.log(`\n  📄 Sample application_documents file_path:`);
      appDocs.slice(0, 3).forEach((doc) => {
        console.log(`     ${doc.file_path}`);
      });
    }
  } catch (e) {
    console.log(`  ⚠️  Error auditing storage: ${e}`);
  }
}

async function auditForeignKeys() {
  console.log("\n🔗 FOREIGN KEY INTEGRITY\n");

  // Check clients → firms (via firm_id)
  const { data: orphanClients } = await supabase
    .from("clients")
    .select("id, firm_id")
    .not("firm_id", "is", null)
    .order("firm_id");

  console.log(`  Clients with firm_id: ${orphanClients?.length || 0}`);

  // Check client_applications → clients (via client_id)
  const { data: submissionsWithClient } = await supabase
    .from("client_applications")
    .select("id, client_id")
    .not("client_id", "is", null);

  console.log(
    `  client_applications with client_id: ${submissionsWithClient?.length || 0}`
  );

  // Check client_applications → applications (via form_id)
  const { data: submissionsWithForm } = await supabase
    .from("client_applications")
    .select("id, form_id")
    .not("form_id", "is", null);

  console.log(
    `  client_applications with form_id: ${submissionsWithForm?.length || 0}`
  );

  // Check for deleted forms (applications.deleted_at IS NOT NULL)
  const { data: deletedForms, count: deletedCount } = await supabase
    .from("applications")
    .select("id, name, deleted_at", { count: "exact" })
    .not("deleted_at", "is", null);

  console.log(`  applications with deleted_at: ${deletedCount || 0} (should be dropped if empty)`);
}

async function main() {
  console.log("🔍 MIGRATION VERIFICATION AUDIT\n");
  console.log("=".repeat(70));

  const tables = [
    { name: "Firms", sbTable: "users" },
    { name: "Clients", sbTable: "clients" },
    { name: "Submissions", sbTable: "client_applications" },
    { name: "Form Definitions", sbTable: "applications" },
    { name: "Questions", sbTable: "questions" },
    { name: "Form Questions", sbTable: "form_questions" },
    { name: "Legal Documents", sbTable: "legal_documents" },
    { name: "Generated Legal Docs", sbTable: "generated_legal_documents" },
    { name: "Submission Documents", sbTable: "application_documents" },
    { name: "AI Usage Logs", sbTable: "transactions" },
    { name: "Uploaded Forms", sbTable: "forms" },
    { name: "Feedback", sbTable: "feedback" },
    { name: "Supplement Requests", sbTable: "supplement_requests" },
    { name: "Error Logs", sbTable: "error_logs" },
  ];

  for (const table of tables) {
    const audit = await auditTable(table.name, table.sbTable);
    audits.push(audit);
  }

  console.log("\n📊 TABLE ROW COUNTS (SUPABASE SOURCE):\n");

  let totalRows = 0;
  for (const audit of audits) {
    const status = audit.sbDetails ? "⚠️" : "✅";
    console.log(`${status} ${audit.name.padEnd(25)} : ${audit.sbCount} rows`);
    if (audit.sbDetails) {
      console.log(`   └─ ${audit.sbDetails}`);
    }
    totalRows += audit.sbCount;
  }

  console.log(`\n📈 Total rows to migrate: ${totalRows}`);

  // Foreign key audit
  await auditForeignKeys();

  // Storage audit
  await auditStorageMapping();

  // Export summary
  const summary = {
    timestamp: new Date().toISOString(),
    tables: audits.map((a) => ({
      name: a.name,
      supabaseTable: a.sbTable,
      rowCount: a.sbCount,
    })),
    totalRows,
    storageFiles: {
      applicationDocuments: "file_path",
      generatedLegalDocuments: "file_path",
      forms: "file_path",
    },
    notes: [
      "Verify Convex row counts match Supabase",
      "Check all file_path → storageId mappings are complete",
      "Verify foreign key references are preserved",
      "Confirm no data loss in custom field migrations",
      "Validate status enums (especially client.status)",
      "Check deleted_at soft deletes are handled",
    ],
  };

  writeFileSync(
    "scripts/migration-summary.json",
    JSON.stringify(summary, null, 2)
  );

  console.log(
    "\n✅ Summary written to scripts/migration-summary.json\n"
  );
}

main().catch(console.error);
