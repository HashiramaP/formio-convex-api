import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

const WORKOS_MAP: Record<string, string> = {
  "5b4ea565-a5a0-40af-8103-49bb44a1e0a8": "user_01KQZPMR0MKJG73YQWSXE10PGQ", // Blouin Avocats
  "1dc36654-fbe6-4075-acae-2e859e490641": "user_01KQZPSNNR4KFKFWSBHZXN2XHQ", // Me Moubarak Baba Body
  "89fe2abc-37f7-4f5d-82c5-8449ba35f105": "user_01KQZPVX4288YZHPG7JGSYSJHZ", // Me Krishna Gagné
  "891dc00b-e3fb-48c0-b880-477c5e92d217": "user_01KQZPXA5RGX1BJH6MPV7BN2X9", // Giroux O'Connor
};
const FIRM_IDS = Object.keys(WORKOS_MAP);

// Frontend compares against English values (DashboardHome.tsx STATUS_NEW/STATUS_IN_PROGRESS/STATUS_SUBMITTED).
const STATUS_MAP: Record<number, string> = {
  1: "new",
  2: "in_progress",
  3: "submitted",
};

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function toMs(val: string | null | undefined): number | undefined {
  if (!val) return undefined;
  return new Date(val).getTime();
}

// Strictly monotonic _creationTime ordering. Convex breaks ties by random _id, so if two rows
// share a millisecond the post-import sort order is undefined — bumping by 1ms keeps positional
// matching deterministic. Drift cap is tiny (a few ms in pathological bulk-insert cases).
function dedupeCreationTimes<T extends { _creationTime?: number }>(rows: T[]): T[] {
  let prev = -1;
  for (const r of rows) {
    let t = r._creationTime ?? Date.now();
    if (t <= prev) t = prev + 1;
    r._creationTime = t;
    prev = t;
  }
  return rows;
}

function writeJsonl(table: string, rows: any[]): string {
  const path = `/tmp/convex-prod-${table}.jsonl`;
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n"));
  return path;
}

function importJsonl(table: string, file: string) {
  execSync(
    `npx dotenv -e .env.prod -- npx convex import --replace --table ${table} --yes ${file}`,
    { cwd: ROOT, stdio: "inherit" }
  );
}

type MappingRow = {
  _id: string;
  _creationTime: number;
  workosUserId?: string;
  legacyId?: string;
  externalId?: string;
  templateId?: string;
};

function getRows(tableName: string): MappingRow[] {
  const out = execSync(
    `npx dotenv -e .env.prod -- npx convex run migrations:getRowsForMapping '${JSON.stringify({tableName})}'`,
    { cwd: ROOT, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );
  return JSON.parse(out.trim());
}

// Supabase PostgREST caps a single response at 1000 rows. For tables with more than
// that we paginate via .range() chunks. The caller must hand us a builder factory so
// every chunk gets a fresh query (range can only be applied once per builder).
async function selectAll<T = any>(
  build: () => any,
  pageSize = 1000
): Promise<T[]> {
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

function convexRun(fn: string, args: any): any {
  const tmp = `/tmp/convex-prod-args-${Date.now()}.json`;
  writeFileSync(tmp, JSON.stringify(args));
  const out = execSync(
    `npx dotenv -e .env.prod -- npx convex run '${fn}' "$(cat ${tmp})"`,
    { cwd: ROOT, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );
  return out.trim() ? JSON.parse(out.trim()) : {};
}

// ---------- Phase 1 ----------

async function migrateFirms(): Promise<Record<string, string>> {
  log("Migrating firms...");
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .in("id", FIRM_IDS)
    .order("created_at");
  if (error) throw new Error(`Supabase users query failed: ${error.message}`);
  if (!users) throw new Error("No users returned");
  log(`  Found ${users.length} firms in Supabase`);

  const rows = dedupeCreationTimes(
    users.map((u) => ({
      _creationTime: toMs(u.created_at),
      workosUserId: WORKOS_MAP[u.id],
      displayName: u.display_name || undefined,
      apiKey: u.api_key || undefined,
      membershipStatus: u.membership_status || "trial",
      subscriptionStartDate: toMs(u.subscription_start_date),
      subscriptionEndDate: toMs(u.subscription_end_date),
      monthlyClientsRemaining: u.client_credits ?? undefined,
      monthlyClientLimit: u.client_amount ?? undefined,
    }))
  );
  importJsonl("firms", writeJsonl("firms", rows));

  // Lookup via existing workosUserId — no positional match needed.
  const firmDocs = getRows("firms");
  const workosToConvex: Record<string, string> = {};
  for (const f of firmDocs) {
    if (f.workosUserId) workosToConvex[f.workosUserId] = f._id;
  }
  const supabaseToConvex: Record<string, string> = {};
  for (const supId of FIRM_IDS) {
    const cid = workosToConvex[WORKOS_MAP[supId]];
    if (!cid) throw new Error(`Firm ${supId} -> ${WORKOS_MAP[supId]} not found in Convex after import`);
    supabaseToConvex[supId] = cid;
  }
  log(`  Inserted ${rows.length} firms`);
  return supabaseToConvex;
}

async function migrateLegalDocuments(): Promise<Record<string, string>> {
  log("Migrating legalDocuments...");
  // legal_documents has no created_at column — order by bigint id (auto-increment preserves
  // insertion order). _creationTime gets synthesized as monotonic Date.now()+i by dedupe.
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, name, url, imm_questions, document_coverage, screening_questions, language")
    .order("id");
  if (error) throw new Error(`legal_documents query failed: ${error.message}`);
  const supabaseSorted = data!;

  const rows = dedupeCreationTimes(
    supabaseSorted.map((d) => ({
      _creationTime: undefined,
      name: d.name || undefined,
      url: d.url || undefined,
      immQuestions: d.imm_questions || undefined,
      documentCoverage: d.document_coverage || undefined,
      screeningQuestions: d.screening_questions || undefined,
      language: d.language,
    }))
  );
  importJsonl("legalDocuments", writeJsonl("legalDocuments", rows));

  const convexDocs = getRows("legalDocuments");
  if (convexDocs.length !== supabaseSorted.length) {
    throw new Error(
      `legalDocuments count mismatch: Convex=${convexDocs.length}, Supabase=${supabaseSorted.length}`
    );
  }
  const mapping: Record<string, string> = {};
  for (let i = 0; i < convexDocs.length; i++) {
    mapping[String(supabaseSorted[i].id)] = convexDocs[i]._id;
  }
  log(`  Inserted ${rows.length} legalDocuments (positional mapping built)`);
  return mapping;
}

async function migrateQuestionTemplates(): Promise<void> {
  log("Migrating questionTemplates...");
  const { data, error } = await supabase
    .from("question_templates")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(`question_templates query failed: ${error.message}`);

  const rows = dedupeCreationTimes(
    data!.map((d) => ({
      _creationTime: toMs(d.created_at),
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
    }))
  );
  importJsonl("questionTemplates", writeJsonl("questionTemplates", rows));
  log(`  Inserted ${rows.length} questionTemplates`);
}

// ---------- Phase 2 ----------

async function migrateFormDefinitions(
  firmIdMap: Record<string, string>,
  legalDocIdMap: Record<string, string>
): Promise<Record<string, string>> {
  log("Migrating formDefinitions...");
  // applications has no created_at column — order by bigint id (preserves insertion order).
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .or(`firm_id.is.null,firm_id.in.(${FIRM_IDS.join(",")})`)
    .is("deleted_at", null)
    .order("id");
  if (error) throw new Error(`applications query failed: ${error.message}`);
  const supabaseSorted = data!;

  // Pass 1: import without self-references resolved.
  const rows = dedupeCreationTimes(
    supabaseSorted.map((d) => ({
      _creationTime: undefined,
      name: d.name || undefined,
      description: d.description || undefined,
      slug: d.slug || undefined,
      languageNames:
        d.language_names && Object.keys(d.language_names).length > 0
          ? d.language_names
          : undefined,
      category: d.category || undefined,
      formGroup: d.form_group || undefined,
      groupLabel: d.group_label || undefined,
      firmId: d.firm_id ? firmIdMap[d.firm_id] : undefined,
      isCustom: d.is_custom,
      sourceFormId: undefined,
      isSelfContained: d.is_self_contained,
      deletedAt: undefined,
      isBaseForm: d.is_base_form,
      baseFormId: undefined,
      excludedBaseSections:
        d.excluded_base_sections?.length > 0 ? d.excluded_base_sections : undefined,
      legalDocumentId: d.legal_document_id
        ? legalDocIdMap[String(d.legal_document_id)]
        : undefined,
      isConsentForm: d.is_consent_form,
    }))
  );
  importJsonl("formDefinitions", writeJsonl("formDefinitions", rows));

  const convexDocs = getRows("formDefinitions");
  if (convexDocs.length !== supabaseSorted.length) {
    throw new Error(
      `formDefinitions count mismatch: Convex=${convexDocs.length}, Supabase=${supabaseSorted.length}`
    );
  }
  const mapping: Record<string, string> = {};
  for (let i = 0; i < convexDocs.length; i++) {
    mapping[String(supabaseSorted[i].id)] = convexDocs[i]._id;
  }

  // Pass 2: patch self-references via mutation.
  const patches: Array<{ convexId: string; sourceFormId?: string; baseFormId?: string }> = [];
  for (let i = 0; i < supabaseSorted.length; i++) {
    const d = supabaseSorted[i];
    const convexId = convexDocs[i]._id;
    const patch: { convexId: string; sourceFormId?: string; baseFormId?: string } = { convexId };
    let any = false;
    if (d.source_form_id) {
      const ref = mapping[String(d.source_form_id)];
      if (ref) {
        patch.sourceFormId = ref;
        any = true;
      }
    }
    if (d.base_form_id) {
      const ref = mapping[String(d.base_form_id)];
      if (ref) {
        patch.baseFormId = ref;
        any = true;
      }
    }
    if (any) patches.push(patch);
  }
  if (patches.length > 0) {
    const result = convexRun("migrations:patchFormDefinitionRefs", { patches });
    log(`  Patched ${result.updated ?? patches.length} formDefinitions self-refs`);
  }
  log(`  Inserted ${rows.length} formDefinitions`);
  return mapping;
}

async function migrateQuestions(firmIdMap: Record<string, string>): Promise<void> {
  log("Migrating questions...");
  const data = await selectAll<any>(() =>
    supabase
      .from("questions")
      .select("*")
      .or(`firm_id.is.null,firm_id.in.(${FIRM_IDS.join(",")})`)
      .order("created_at")
  );
  log(`  Found ${data.length} questions`);

  const rows = dedupeCreationTimes(
    data.map((d) => ({
      _creationTime: toMs(d.created_at),
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
      translations:
        d.translations && Object.keys(d.translations).length > 0 ? d.translations : undefined,
      firmId: d.firm_id ? firmIdMap[d.firm_id] : undefined,
    }))
  );
  importJsonl("questions", writeJsonl("questions", rows));
  log(`  Inserted ${rows.length} questions`);
}

async function migrateFormQuestions(formDefIdMap: Record<string, string>): Promise<void> {
  log("Migrating formQuestions...");
  const formIds = Object.keys(formDefIdMap);
  // form_questions has no created_at — order by (form_id, order_index) so post-import sort
  // groups questions within their form in display order.
  const data = await selectAll<any>(() =>
    supabase
      .from("form_questions")
      .select("*")
      .in("form_id", formIds.map(Number))
      .order("form_id")
      .order("order_index")
  );
  log(`  Found ${data.length} formQuestions`);

  const rows = dedupeCreationTimes(
    data
      .map((d) => {
        const convexFormId = formDefIdMap[String(d.form_id)];
        if (!convexFormId) return null; // skip orphans
        return {
          _creationTime: undefined,
          formDefinitionId: convexFormId,
          questionKey: d.question_id,
          orderIndex: d.order_index,
          section: d.section || undefined,
          sectionTranslations:
            d.section_translations && Object.keys(d.section_translations).length > 0
              ? d.section_translations
              : undefined,
          dependsOn: d.depends_on || undefined,
          labelOverride: d.label_override || undefined,
          requiredOverride: d.required_override ?? undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("formQuestions", writeJsonl("formQuestions", rows));
  log(`  Inserted ${rows.length} formQuestions`);
}

// ---------- Phase 3 ----------

async function migrateClients(
  firmIdMap: Record<string, string>,
  formDefIdMap: Record<string, string>,
  legalDocIdMap: Record<string, string>
): Promise<Record<string, string>> {
  log("Migrating clients...");
  const supabaseSorted = await selectAll<any>(() =>
    supabase.from("clients").select("*").in("firm_id", FIRM_IDS).order("created_at")
  );

  let skipped = 0;
  const rows = dedupeCreationTimes(
    supabaseSorted
      .map((d) => {
        const convexFirmId = firmIdMap[d.firm_id];
        if (!convexFirmId) {
          skipped++;
          return null;
        }
        const legalDocs = (d.legal_documents || [])
          .map((id: any) => legalDocIdMap[String(id)])
          .filter(Boolean);
        return {
          _creationTime: toMs(d.created_at),
          legacyId: d.id, // existing schema field — directly written so post-import lookup is trivial
          firmId: convexFirmId,
          firstName: d.first_name || undefined,
          lastName: d.last_name || undefined,
          email: d.email || undefined,
          phoneNumber: d.phone_number || undefined,
          notes: d.notes || undefined,
          primaryFormDefinitionId: d.application
            ? formDefIdMap[String(d.application)]
            : undefined,
          status: d.status ? STATUS_MAP[d.status] || undefined : undefined,
          legalDocuments: legalDocs.length > 0 ? legalDocs : undefined,
          emailConsentAt: toMs(d.email_consent_at),
          emailUnsubscribedAt: toMs(d.email_unsubscribed_at),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("clients", writeJsonl("clients", rows));
  if (skipped > 0) log(`  Skipped ${skipped} clients (firm not in scope)`);

  const convexDocs = getRows("clients");
  if (convexDocs.length !== rows.length) {
    throw new Error(
      `clients count mismatch: Convex=${convexDocs.length}, JSONL=${rows.length}`
    );
  }
  const mapping: Record<string, string> = {};
  for (const c of convexDocs) {
    if (c.legacyId) mapping[c.legacyId] = c._id;
  }
  log(`  Inserted ${rows.length} clients (mapped via legacyId)`);
  return mapping;
}

async function migrateSubmissions(
  firmIdMap: Record<string, string>,
  clientIdMap: Record<string, string>,
  formDefIdMap: Record<string, string>
): Promise<Record<string, string>> {
  log("Migrating submissions...");
  const data = await selectAll<any>(() =>
    supabase.from("client_applications").select("*").in("firm_id", FIRM_IDS).order("created_at")
  );

  let skipped = 0;
  const supabaseKept: any[] = [];
  const rowsBuilt: any[] = [];
  for (const d of data) {
    const convexFirmId = firmIdMap[d.firm_id];
    if (!convexFirmId) {
      skipped++;
      continue;
    }
    supabaseKept.push(d);
    rowsBuilt.push({
      _creationTime: toMs(d.created_at),
      firmId: convexFirmId,
      clientId: d.client_id ? clientIdMap[d.client_id] : undefined,
      formDefinitionId: d.form_id ? formDefIdMap[String(d.form_id)] : undefined,
      title: d.name || "Untitled",
      formType: d.form_type || undefined,
      status: d.status || "draft",
      answers: d.answers && Object.keys(d.answers).length > 0 ? d.answers : undefined,
      translatedAnswers:
        d.translated_answers && Object.keys(d.translated_answers).length > 0
          ? d.translated_answers
          : undefined,
      metadata: d.metadata && Object.keys(d.metadata).length > 0 ? d.metadata : undefined,
      skippedSections:
        d.skipped_sections && (d.skipped_sections as any[]).length > 0
          ? d.skipped_sections
          : undefined,
      preferredLanguage: d.preferred_language || undefined,
      documentOnly: d.document_only ?? undefined,
      groupId: d.group_id || undefined,
    });
  }
  const rows = dedupeCreationTimes(rowsBuilt);
  importJsonl("submissions", writeJsonl("submissions", rows));
  if (skipped > 0) log(`  Skipped ${skipped} submissions (firm not in scope)`);

  const convexDocs = getRows("submissions");
  if (convexDocs.length !== rows.length) {
    throw new Error(
      `submissions count mismatch: Convex=${convexDocs.length}, JSONL=${rows.length}`
    );
  }
  const mapping: Record<string, string> = {};
  for (let i = 0; i < convexDocs.length; i++) {
    mapping[supabaseKept[i].id] = convexDocs[i]._id;
  }
  log(`  Inserted ${rows.length} submissions (positional mapping built)`);
  return mapping;
}

// ---------- Phase 4 ----------

async function migrateSubmissionDocuments(
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating submissionDocuments...");
  const submissionIds = Object.keys(submissionIdMap);
  if (submissionIds.length === 0) return;
  const data = await selectAll<any>(() =>
    supabase
      .from("application_documents")
      .select("*")
      .in("application_id", submissionIds)
      .order("created_at")
  );
  if (data.length === 0) {
    log("  No documents to migrate");
    return;
  }
  log(`  Found ${data.length} documents`);

  const rows = dedupeCreationTimes(
    data
      .map((d) => {
        const convexSubId = submissionIdMap[d.application_id];
        if (!convexSubId) return null;
        return {
          _creationTime: toMs(d.created_at),
          submissionId: convexSubId,
          name: d.name,
          fileType: d.file_type || undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("submissionDocuments", writeJsonl("submissionDocuments", rows));
  log(`  Inserted ${rows.length} submissionDocuments`);
}

async function migrateGeneratedLegalDocs(
  clientIdMap: Record<string, string>,
  legalDocIdMap: Record<string, string>
): Promise<void> {
  log("Migrating generatedLegalDocs...");
  const clientIds = Object.keys(clientIdMap);
  if (clientIds.length === 0) return;
  const { data, error } = await supabase
    .from("generated_legal_documents")
    .select("*")
    .in("client_id", clientIds)
    .order("created_at");
  if (error) throw new Error(`generated_legal_documents query failed: ${error.message}`);
  if (!data || data.length === 0) {
    log("  No generated docs to migrate");
    return;
  }

  const rows = dedupeCreationTimes(
    data
      .map((d) => {
        const cId = clientIdMap[d.client_id];
        const ldId = legalDocIdMap[String(d.legal_document_id)];
        if (!cId || !ldId) return null;
        return {
          _creationTime: toMs(d.created_at),
          clientId: cId,
          legalDocumentId: ldId,
          status: d.status || "generating",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("generatedLegalDocs", writeJsonl("generatedLegalDocs", rows));
  log(`  Inserted ${rows.length} generatedLegalDocs`);
}

async function migrateAiUsageLogs(
  firmIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating aiUsageLogs...");
  const data = await selectAll<any>(() =>
    supabase
      .from("transactions")
      .select("*, ai_models(model_name)")
      .in("user_id", FIRM_IDS)
      .order("created_at")
  );
  if (data.length === 0) {
    log("  No AI usage logs to migrate");
    return;
  }

  const rows = dedupeCreationTimes(
    data
      .map((d: any) => {
        const fId = firmIdMap[d.user_id];
        if (!fId) return null;
        return {
          _creationTime: toMs(d.created_at),
          firmId: fId,
          modelName: d.ai_models?.model_name || "unknown",
          promptTokens: d.prompt_tokens,
          completionTokens: d.completion_tokens,
          totalTokens: d.total_tokens,
          formType: d.form_type || undefined,
          submissionId: d.client_application_id
            ? submissionIdMap[d.client_application_id]
            : undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("aiUsageLogs", writeJsonl("aiUsageLogs", rows));
  log(`  Inserted ${rows.length} aiUsageLogs`);
}

async function migrateUploadedForms(firmIdMap: Record<string, string>): Promise<void> {
  log("Migrating uploadedForms...");
  const data = await selectAll<any>(() =>
    supabase.from("forms").select("*").in("user_id", FIRM_IDS).order("created_at")
  );
  if (data.length === 0) {
    log("  No uploaded forms to migrate");
    return;
  }

  const rows = dedupeCreationTimes(
    data
      .map((d) => {
        const fId = firmIdMap[d.user_id];
        if (!fId) return null;
        return {
          _creationTime: toMs(d.created_at),
          firmId: fId,
          name: d.name || undefined,
          formType: d.form_type || undefined,
          status: d.status || "ready",
          batchId: d.batch_id || undefined,
          legalDocumentName: d.legal_document_name || undefined,
          error: d.error || undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("uploadedForms", writeJsonl("uploadedForms", rows));
  log(`  Inserted ${rows.length} uploadedForms`);
}

async function migrateFeedback(
  firmIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating feedback...");

  const { data: firmFeedback } = await supabase
    .from("feedback")
    .select("*")
    .in("user_id", FIRM_IDS)
    .order("created_at");

  const submissionIds = Object.keys(submissionIdMap);
  const { data: formFeedback } = await supabase
    .from("form_feedback")
    .select("*")
    .in("client_application_id", submissionIds.length > 0 ? submissionIds : ["__none__"])
    .order("created_at");

  const built: any[] = [];
  for (const d of firmFeedback || []) {
    built.push({
      _creationTime: toMs(d.created_at),
      type: d.type === "bug" ? "firmBug" : "firmRating",
      firmId: d.user_id ? firmIdMap[d.user_id] : undefined,
      title: d.title || undefined,
      email: d.email || undefined,
      message: d.message || undefined,
    });
  }
  for (const d of formFeedback || []) {
    built.push({
      _creationTime: toMs(d.created_at),
      type: "clientFormRating",
      submissionId: d.client_application_id
        ? submissionIdMap[d.client_application_id]
        : undefined,
      rating: d.rating ?? undefined,
      nps: d.nps ?? undefined,
      easeOfUse: d.ease_of_use ?? undefined,
      device: d.device || undefined,
      message: d.comment || undefined,
    });
  }
  if (built.length === 0) {
    log("  No feedback to migrate");
    return;
  }
  // Sort by _creationTime so dedupe + post-import order are coherent (two source tables merged).
  built.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0));
  const rows = dedupeCreationTimes(built);
  importJsonl("feedback", writeJsonl("feedback", rows));
  log(
    `  Inserted ${rows.length} feedback (${firmFeedback?.length || 0} firm + ${
      formFeedback?.length || 0
    } form)`
  );
}

async function migrateSupplementRequests(
  firmIdMap: Record<string, string>,
  clientIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating supplementRequests...");
  const { data, error } = await supabase
    .from("supplement_requests")
    .select("*")
    .in("firm_id", FIRM_IDS)
    .order("created_at");
  if (error) throw new Error(`supplement_requests query failed: ${error.message}`);
  if (!data || data.length === 0) {
    log("  No supplement requests to migrate");
    return;
  }

  const rows = dedupeCreationTimes(
    data
      .map((d) => {
        const fId = firmIdMap[d.firm_id];
        const cId = clientIdMap[d.client_id];
        const sId = submissionIdMap[d.client_application_id];
        if (!fId || !cId || !sId) return null;
        return {
          _creationTime: toMs(d.created_at),
          firmId: fId,
          clientId: cId,
          submissionId: sId,
          requestedSections:
            d.requested_sections?.length > 0 ? d.requested_sections : undefined,
          requestedQuestions:
            d.requested_questions?.length > 0 ? d.requested_questions : undefined,
          status: d.status || "pending",
          answers: d.answers && Object.keys(d.answers).length > 0 ? d.answers : undefined,
          metadata: d.metadata && Object.keys(d.metadata).length > 0 ? d.metadata : undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  );
  importJsonl("supplementRequests", writeJsonl("supplementRequests", rows));
  log(`  Inserted ${rows.length} supplementRequests`);
}

async function migrateErrorLogs(
  firmIdMap: Record<string, string>,
  clientIdMap: Record<string, string>,
  submissionIdMap: Record<string, string>
): Promise<void> {
  log("Migrating errorLogs...");
  const { data, error } = await supabase
    .from("error_logs")
    .select("*")
    .in("user_id", FIRM_IDS)
    .order("created_at", { ascending: false }) // 500 most recent
    .limit(500);
  if (error) throw new Error(`error_logs query failed: ${error.message}`);
  if (!data || data.length === 0) {
    log("  No error logs to migrate");
    return;
  }
  // Reverse to chronological order so _creationTime is monotonic.
  const ordered = data.slice().reverse();

  const rows = dedupeCreationTimes(
    ordered.map((d) => ({
      _creationTime: toMs(d.created_at),
      source: d.source,
      context: d.context,
      message: d.message || undefined,
      details: d.details && Object.keys(d.details).length > 0 ? d.details : undefined,
      submissionId: d.client_application_id
        ? submissionIdMap[d.client_application_id]
        : undefined,
      clientId: d.client_id ? clientIdMap[d.client_id] : undefined,
      firmId: d.user_id ? firmIdMap[d.user_id] : undefined,
    }))
  );
  importJsonl("errorLogs", writeJsonl("errorLogs", rows));
  log(`  Inserted ${rows.length} errorLogs`);
}

// ---------- Main ----------

async function main() {
  log("=== Starting Supabase → Convex PROD migration ===");
  log(`Target: ${process.env.CONVEX_SELF_HOSTED_URL || ".env.prod"}`);
  log(`Migrating ${FIRM_IDS.length} firms`);

  // Phase 1
  const firmIdMap = await migrateFirms();
  const legalDocIdMap = await migrateLegalDocuments();
  await migrateQuestionTemplates();

  // Phase 2
  const formDefIdMap = await migrateFormDefinitions(firmIdMap, legalDocIdMap);
  await migrateQuestions(firmIdMap);
  await migrateFormQuestions(formDefIdMap);

  // Phase 3
  const clientIdMap = await migrateClients(firmIdMap, formDefIdMap, legalDocIdMap);
  const submissionIdMap = await migrateSubmissions(firmIdMap, clientIdMap, formDefIdMap);

  // Phase 4
  await migrateSubmissionDocuments(submissionIdMap);
  await migrateGeneratedLegalDocs(clientIdMap, legalDocIdMap);
  await migrateAiUsageLogs(firmIdMap, submissionIdMap);
  await migrateUploadedForms(firmIdMap);
  await migrateFeedback(firmIdMap, submissionIdMap);
  await migrateSupplementRequests(firmIdMap, clientIdMap, submissionIdMap);
  await migrateErrorLogs(firmIdMap, clientIdMap, submissionIdMap);

  log("=== Migration complete ===");
  log(
    `ID mappings: ${Object.keys(firmIdMap).length} firms, ${
      Object.keys(legalDocIdMap).length
    } legalDocs, ${Object.keys(formDefIdMap).length} formDefs, ${
      Object.keys(clientIdMap).length
    } clients, ${Object.keys(submissionIdMap).length} submissions`
  );
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
