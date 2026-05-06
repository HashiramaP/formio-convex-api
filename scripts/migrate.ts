import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
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

// WorkOS user ID mapping (Supabase UUID → WorkOS ID)
const WORKOS_MAP: Record<string, string> = {
  "5b4ea565-a5a0-40af-8103-49bb44a1e0a8": "user_01KQZPMR0MKJG73YQWSXE10PGQ", // Blouin Avocats
  "1dc36654-fbe6-4075-acae-2e859e490641": "user_01KQZPSNNR4KFKFWSBHZXN2XHQ", // Me Moubarak Baba Body
  "89fe2abc-37f7-4f5d-82c5-8449ba35f105": "user_01KQZPVX4288YZHPG7JGSYSJHZ", // Me Krishna Gagné
  "891dc00b-e3fb-48c0-b880-477c5e92d217": "user_01KQZPXA5RGX1BJH6MPV7BN2X9", // Giroux O'Connor
};

const FIRM_IDS = Object.keys(WORKOS_MAP);

// Client status mapping (Supabase bigint → string)
const STATUS_MAP: Record<number, string> = {
  1: "nouveau_mandat",
  2: "en_cours",
  3: "soumis",
};

function convexRun(fn: string, args: any): any {
  const argsJson = JSON.stringify(args);
  const tmpFile = `/tmp/convex-migrate-${Date.now()}.json`;
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

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function toTimestamp(val: string | null): number | undefined {
  if (!val) return undefined;
  return new Date(val).getTime();
}

async function migrateFirms(): Promise<Record<string, string>> {
  log("Migrating firms...");
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .in("id", FIRM_IDS);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  if (!users) throw new Error("No users returned from Supabase");
  log(`  Found ${users.length} firms in Supabase`);

  const rows = users.map((u) => ({
    supabaseId: u.id,
    workosUserId: WORKOS_MAP[u.id],
    displayName: u.display_name || undefined,
    apiKey: u.api_key || undefined,
    membershipStatus: u.membership_status || "trial",
    subscriptionStartDate: toTimestamp(u.subscription_start_date),
    subscriptionEndDate: toTimestamp(u.subscription_end_date),
    aiCreditsRemaining: u.client_credits ?? undefined,
    maxClientSlots: u.client_amount ?? undefined,
    clientRollback: u.client_rollback ?? undefined,
  }));

  const mapping = convexRun("migrations:insertFirms", { rows });
  log(`  Inserted ${rows.length} firms`);
  return mapping;
}

async function migrateLegalDocuments(): Promise<Record<string, string>> {
  log("Migrating legalDocuments...");
  const { data } = await supabase
    .from("legal_documents")
    .select("id, name, url, imm_questions, document_coverage, screening_questions, language")
    .order("id");

  const rows = data!.map((d) => ({
    supabaseId: String(d.id),
    name: d.name || undefined,
    url: d.url || undefined,
    immQuestions: d.imm_questions || undefined,
    documentCoverage: d.document_coverage || undefined,
    screeningQuestions: d.screening_questions || undefined,
    language: d.language,
  }));

  const mapping = convexRun("migrations:insertLegalDocuments", { rows });
  log(`  Inserted ${rows.length} legalDocuments`);
  return mapping;
}

async function migrateQuestionTemplates(): Promise<void> {
  log("Migrating questionTemplates...");
  const { data } = await supabase
    .from("question_templates")
    .select("*")
    .order("sort_order");

  const rows = data!.map((d) => ({
    templateId: d.id,
    label: d.label,
    type: d.type,
    indication: d.indication || undefined,
    help: d.help || undefined,
    example: d.example || undefined,
    placeholder: d.placeholder || undefined,
    isRequired: d.is_required,
    options: d.options || undefined,
    documentConfig: d.document_config || undefined,
    validationRules: d.validation_rules || undefined,
    multiEntryFields: d.multi_entry_fields || undefined,
    multiEntryAddLabel: d.multi_entry_add_label || undefined,
    category: d.category || undefined,
    sortOrder: d.sort_order,
  }));

  convexRun("migrations:insertQuestionTemplates", { rows });
  log(`  Inserted ${rows.length} questionTemplates`);
}

async function migrateFormDefinitions(
  firmIdMap: Record<string, string>,
  legalDocIdMap: Record<string, string>
): Promise<Record<string, string>> {
  log("Migrating formDefinitions...");
  // Global forms + forms for our 4 firms
  const { data } = await supabase
    .from("applications")
    .select("*")
    .or(`firm_id.is.null,firm_id.in.(${FIRM_IDS.join(",")})`)
    .is("deleted_at", null)
    .order("id");

  const rows = data!.map((d) => ({
    supabaseId: String(d.id),
    name: d.name || undefined,
    description: d.description || undefined,
    slug: d.slug || undefined,
    languageNames: d.language_names && Object.keys(d.language_names).length > 0 ? d.language_names : undefined,
    category: d.category || undefined,
    formGroup: d.form_group || undefined,
    groupLabel: d.group_label || undefined,
    firmId: d.firm_id || undefined,
    isCustom: d.is_custom,
    sourceFormId: d.source_form_id ? String(d.source_form_id) : undefined,
    isSelfContained: d.is_self_contained,
    deletedAt: undefined,
    isBaseForm: d.is_base_form,
    baseFormId: d.base_form_id ? String(d.base_form_id) : undefined,
    excludedBaseSections: d.excluded_base_sections?.length > 0 ? d.excluded_base_sections : undefined,
    legalDocumentId: d.legal_document_id ? String(d.legal_document_id) : undefined,
    isConsentForm: d.is_consent_form,
  }));

  const mapping = convexRun("migrations:insertFormDefinitions", {
    rows,
    firmIdMap,
    legalDocIdMap,
  });
  log(`  Inserted ${rows.length} formDefinitions`);
  return mapping;
}

async function migrateQuestions(firmIdMap: Record<string, string>): Promise<void> {
  log("Migrating questions...");
  // Global questions + firm-specific for our 4 firms
  const { data, count } = await supabase
    .from("questions")
    .select("*", { count: "exact" })
    .or(`firm_id.is.null,firm_id.in.(${FIRM_IDS.join(",")})`)
    .order("id");

  log(`  Found ${count ?? data!.length} questions, batching...`);
  const BATCH = 200;
  for (let i = 0; i < data!.length; i += BATCH) {
    const batch = data!.slice(i, i + BATCH);
    const rows = batch.map((d) => ({
      externalId: d.id,
      label: d.label,
      shortLabel: d.short_label || undefined,
      type: d.type,
      indication: d.indication || undefined,
      help: d.help || undefined,
      example: d.example || undefined,
      placeholder: d.placeholder || undefined,
      isRequired: d.is_required ?? undefined,
      requiresConfirmation: d.requires_confirmation ?? undefined,
      confirmationText: d.confirmation_text || undefined,
      successMessage: d.success_message || undefined,
      whyImportantReason: d.why_important_reason || undefined,
      whyImportantConsequence: d.why_important_consequence || undefined,
      options: d.options || undefined,
      documentConfig: d.document_config || undefined,
      validationRules: d.validation_rules || undefined,
      multiEntryFields: d.multi_entry_fields || undefined,
      multiEntryAddLabel: d.multi_entry_add_label || undefined,
      hasDetailsBox: d.has_details_box ?? undefined,
      detailsBoxLabel: d.details_box_label || undefined,
      translations: d.translations && Object.keys(d.translations).length > 0 ? d.translations : undefined,
      firmId: d.firm_id || undefined,
    }));

    convexRun("migrations:insertQuestionsBatch", { rows, firmIdMap });
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${rows.length} questions`);
  }
}

async function migrateFormQuestions(formDefIdMap: Record<string, string>): Promise<void> {
  log("Migrating formQuestions...");
  const formIds = Object.keys(formDefIdMap);
  // Query formQuestions for all migrated form definitions
  const { data } = await supabase
    .from("form_questions")
    .select("*")
    .in("form_id", formIds.map(Number))
    .order("form_id")
    .order("order_index");

  log(`  Found ${data!.length} formQuestions, batching...`);
  const BATCH = 300;
  for (let i = 0; i < data!.length; i += BATCH) {
    const batch = data!.slice(i, i + BATCH);
    const rows = batch.map((d) => ({
      formDefinitionId: String(d.form_id),
      questionKey: d.question_id,
      orderIndex: d.order_index,
      section: d.section || undefined,
      sectionTranslations: d.section_translations && Object.keys(d.section_translations).length > 0 ? d.section_translations : undefined,
      dependsOn: d.depends_on || undefined,
      labelOverride: d.label_override || undefined,
      requiredOverride: d.required_override ?? undefined,
    }));

    convexRun("migrations:insertFormQuestionsBatch", { rows, formDefIdMap });
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${rows.length} formQuestions`);
  }
}

async function migrateClients(
  firmIdMap: Record<string, string>,
  formDefIdMap: Record<string, string>,
  legalDocIdMap: Record<string, string>
): Promise<Record<string, string>> {
  log("Migrating clients...");
  const { data } = await supabase
    .from("clients")
    .select("*")
    .in("firm_id", FIRM_IDS)
    .order("created_at");

  const rows = data!.map((d) => ({
    supabaseId: d.id,
    firmId: d.firm_id,
    firstName: d.first_name || undefined,
    lastName: d.last_name || undefined,
    email: d.email || undefined,
    phoneNumber: d.phone_number || undefined,
    notes: d.notes || undefined,
    primaryFormDefinitionId: d.application ? String(d.application) : undefined,
    status: d.status ? STATUS_MAP[d.status] || undefined : undefined,
    legalDocumentIds: d.legal_documents?.map(String) || undefined,
    emailConsentAt: toTimestamp(d.email_consent_at),
    emailUnsubscribedAt: toTimestamp(d.email_unsubscribed_at),
  }));

  const mapping = convexRun("migrations:insertClients", {
    rows,
    firmIdMap,
    formDefIdMap,
    legalDocIdMap,
  });
  log(`  Inserted ${rows.length} clients`);
  return mapping;
}

async function migrateSubmissions(
  firmIdMap: Record<string, string>,
  clientIdMap: Record<string, string>,
  formDefIdMap: Record<string, string>
): Promise<Record<string, string>> {
  log("Migrating submissions...");
  const { data } = await supabase
    .from("client_applications")
    .select("*")
    .in("firm_id", FIRM_IDS)
    .order("created_at");

  const allMappings: Record<string, string> = {};
  const BATCH = 50;

  for (let i = 0; i < data!.length; i += BATCH) {
    const batch = data!.slice(i, i + BATCH);
    const rows = batch.map((d) => ({
      supabaseId: d.id,
      firmId: d.firm_id,
      clientId: d.client_id || undefined,
      formDefinitionId: d.form_id ? String(d.form_id) : undefined,
      title: d.name || "Untitled",
      formType: d.form_type || undefined,
      status: d.status || "draft",
      answers: d.answers && Object.keys(d.answers).length > 0 ? d.answers : undefined,
      translatedAnswers: d.translated_answers && Object.keys(d.translated_answers).length > 0 ? d.translated_answers : undefined,
      metadata: d.metadata && Object.keys(d.metadata).length > 0 ? d.metadata : undefined,
      skippedSections: d.skipped_sections && (d.skipped_sections as any[]).length > 0 ? d.skipped_sections : undefined,
      preferredLanguage: d.preferred_language || undefined,
      documentOnly: d.document_only ?? undefined,
      groupId: d.group_id || undefined,
    }));

    const mapping = convexRun("migrations:insertSubmissions", {
      rows,
      firmIdMap,
      clientIdMap,
      formDefIdMap,
    });
    Object.assign(allMappings, mapping);
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${rows.length} submissions`);
  }

  log(`  Total: ${data!.length} submissions`);
  return allMappings;
}

async function migrateSubmissionDocuments(submissionIdMap: Record<string, string>): Promise<void> {
  log("Migrating submissionDocuments...");
  const submissionIds = Object.keys(submissionIdMap);
  if (submissionIds.length === 0) return;

  const { data } = await supabase
    .from("application_documents")
    .select("*")
    .in("application_id", submissionIds)
    .order("created_at");

  if (!data || data.length === 0) {
    log("  No documents to migrate");
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const rows = batch.map((d) => ({
      submissionId: d.application_id,
      name: d.name,
      fileType: d.file_type || undefined,
    }));
    convexRun("migrations:insertSubmissionDocuments", { rows, submissionIdMap });
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${rows.length} documents`);
  }
}

async function migrateGeneratedLegalDocs(
  clientIdMap: Record<string, string>,
  legalDocIdMap: Record<string, string>
): Promise<void> {
  log("Migrating generatedLegalDocs...");
  const clientIds = Object.keys(clientIdMap);
  if (clientIds.length === 0) return;

  const { data } = await supabase
    .from("generated_legal_documents")
    .select("*")
    .in("client_id", clientIds);

  if (!data || data.length === 0) {
    log("  No generated docs to migrate");
    return;
  }

  const rows = data.map((d) => ({
    clientId: d.client_id,
    legalDocumentId: String(d.legal_document_id),
    status: d.status || "generating",
  }));

  convexRun("migrations:insertGeneratedLegalDocs", { rows, clientIdMap, legalDocIdMap });
  log(`  Inserted ${rows.length} generatedLegalDocs`);
}

async function migrateAiUsageLogs(
  firmIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating aiUsageLogs...");
  const { data } = await supabase
    .from("transactions")
    .select("*, ai_models(model_name)")
    .in("user_id", FIRM_IDS)
    .order("created_at");

  if (!data || data.length === 0) {
    log("  No AI usage logs to migrate");
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const rows = batch.map((d) => ({
      firmId: d.user_id,
      modelName: (d as any).ai_models?.model_name || "unknown",
      promptTokens: d.prompt_tokens,
      completionTokens: d.completion_tokens,
      totalTokens: d.total_tokens,
      formType: d.form_type || undefined,
      submissionId: d.client_application_id || undefined,
    }));

    convexRun("migrations:insertAiUsageLogs", { rows, firmIdMap, submissionIdMap });
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${rows.length} logs`);
  }
}

async function migrateUploadedForms(firmIdMap: Record<string, string>): Promise<void> {
  log("Migrating uploadedForms...");
  const { data } = await supabase
    .from("forms")
    .select("*")
    .in("user_id", FIRM_IDS)
    .order("created_at");

  if (!data || data.length === 0) {
    log("  No uploaded forms to migrate");
    return;
  }

  const rows = data.map((d) => ({
    firmId: d.user_id,
    name: d.name || undefined,
    formType: d.form_type || undefined,
    status: d.status || "ready",
    batchId: d.batch_id || undefined,
    legalDocumentName: d.legal_document_name || undefined,
    error: d.error || undefined,
  }));

  convexRun("migrations:insertUploadedForms", { rows, firmIdMap });
  log(`  Inserted ${rows.length} uploadedForms`);
}

async function migrateFeedback(
  firmIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating feedback...");

  // Firm feedback (from feedback table)
  const { data: firmFeedback } = await supabase
    .from("feedback")
    .select("*")
    .in("user_id", FIRM_IDS);

  // Form feedback (from form_feedback table, linked via submissions)
  const submissionIds = Object.keys(submissionIdMap);
  const { data: formFeedback } = await supabase
    .from("form_feedback")
    .select("*")
    .in("client_application_id", submissionIds.length > 0 ? submissionIds : ["__none__"]);

  const rows: any[] = [];

  for (const d of firmFeedback || []) {
    rows.push({
      type: d.type === "bug" ? "firmBug" : "firmRating",
      firmId: d.user_id || undefined,
      title: d.title || undefined,
      email: d.email || undefined,
      message: d.message || undefined,
    });
  }

  for (const d of formFeedback || []) {
    rows.push({
      type: "clientFormRating",
      submissionId: d.client_application_id || undefined,
      rating: d.rating ?? undefined,
      nps: d.nps ?? undefined,
      easeOfUse: d.ease_of_use ?? undefined,
      device: d.device || undefined,
      message: d.comment || undefined,
    });
  }

  if (rows.length === 0) {
    log("  No feedback to migrate");
    return;
  }

  convexRun("migrations:insertFeedback", { rows, firmIdMap, submissionIdMap });
  log(`  Inserted ${rows.length} feedback (${firmFeedback?.length || 0} firm + ${formFeedback?.length || 0} form)`);
}

async function migrateSupplementRequests(
  firmIdMap: Record<string, string>,
  clientIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating supplementRequests...");
  const { data } = await supabase
    .from("supplement_requests")
    .select("*")
    .in("firm_id", FIRM_IDS);

  if (!data || data.length === 0) {
    log("  No supplement requests to migrate");
    return;
  }

  const rows = data.map((d) => ({
    submissionId: d.client_application_id,
    clientId: d.client_id,
    firmId: d.firm_id,
    requestedSections: d.requested_sections?.length > 0 ? d.requested_sections : undefined,
    requestedQuestions: d.requested_questions?.length > 0 ? d.requested_questions : undefined,
    status: d.status || "pending",
    answers: d.answers && Object.keys(d.answers).length > 0 ? d.answers : undefined,
    metadata: d.metadata && Object.keys(d.metadata).length > 0 ? d.metadata : undefined,
  }));

  convexRun("migrations:insertSupplementRequests", {
    rows,
    firmIdMap,
    clientIdMap,
    submissionIdMap,
  });
  log(`  Inserted ${rows.length} supplementRequests`);
}

async function migrateErrorLogs(
  firmIdMap: Record<string, string>,
  clientIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating errorLogs...");
  const { data } = await supabase
    .from("error_logs")
    .select("*")
    .in("user_id", FIRM_IDS)
    .order("created_at")
    .limit(500);

  if (!data || data.length === 0) {
    log("  No error logs to migrate");
    return;
  }

  const BATCH = 100;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const rows = batch.map((d) => ({
      source: d.source,
      context: d.context,
      message: d.message || undefined,
      details: d.details && Object.keys(d.details).length > 0 ? d.details : undefined,
      submissionId: d.client_application_id || undefined,
      clientId: d.client_id || undefined,
      firmId: d.user_id || undefined,
    }));

    convexRun("migrations:insertErrorLogs", {
      rows,
      firmIdMap,
      clientIdMap,
      submissionIdMap,
    });
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${rows.length} errorLogs`);
  }
}

async function main() {
  log("=== Starting Supabase → Convex migration (dev) ===");
  log(`Migrating ${FIRM_IDS.length} firms to Convex dev deployment`);

  // Phase 1: Base tables (no dependencies)
  const firmIdMap = await migrateFirms();
  const legalDocIdMap = await migrateLegalDocuments();
  await migrateQuestionTemplates();

  // Phase 2: Form structure
  const formDefIdMap = await migrateFormDefinitions(firmIdMap, legalDocIdMap);
  await migrateQuestions(firmIdMap);
  await migrateFormQuestions(formDefIdMap);

  // Phase 3: Client data
  const clientIdMap = await migrateClients(firmIdMap, formDefIdMap, legalDocIdMap);
  const submissionIdMap = await migrateSubmissions(firmIdMap, clientIdMap, formDefIdMap);

  // Phase 4: Dependent data
  await migrateSubmissionDocuments(submissionIdMap);
  await migrateGeneratedLegalDocs(clientIdMap, legalDocIdMap);
  await migrateAiUsageLogs(firmIdMap, submissionIdMap);
  await migrateUploadedForms(firmIdMap);
  await migrateFeedback(firmIdMap, submissionIdMap);
  await migrateSupplementRequests(firmIdMap, clientIdMap, submissionIdMap);
  await migrateErrorLogs(firmIdMap, clientIdMap, submissionIdMap);

  log("=== Migration complete ===");
  log(`ID mappings: ${Object.keys(firmIdMap).length} firms, ${Object.keys(legalDocIdMap).length} legalDocs, ${Object.keys(formDefIdMap).length} formDefs, ${Object.keys(clientIdMap).length} clients, ${Object.keys(submissionIdMap).length} submissions`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
