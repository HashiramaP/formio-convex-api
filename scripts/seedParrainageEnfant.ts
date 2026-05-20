/**
 * Seeder for the "Parrainage familial (Enfant du demandeur principal)" form.
 *
 * Reads ./parrainage-enfant-source.json (frozen copy of forms.app extraction),
 * transforms it into Convex `formDefinitions` + `questions` + `formQuestions`
 * rows, and inserts via the existing internalMutations in convex/migrations.ts.
 *
 * Flags:
 *   --dry-run   Print payloads to /tmp/parrainage-enfant-dryrun.json; no Convex calls.
 *   --prod      Target the production deployment (appends --prod to convex run).
 *   --force     Skip the slug-already-exists abort.
 *
 * Usage:
 *   npx tsx scripts/seedParrainageEnfant.ts --dry-run
 *   npx tsx scripts/seedParrainageEnfant.ts            # dev
 *   npx tsx scripts/seedParrainageEnfant.ts --prod     # prod
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SLUG = "parrainage-enfant";
const SUPABASE_PLACEHOLDER = "local-enfant";

// ─── CLI parsing ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const FLAG_DRY = argv.includes("--dry-run");
const FLAG_PROD = argv.includes("--prod");
const FLAG_FORCE = argv.includes("--force");

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function convexRun(fn: string, args: any, prod = false): any {
  const argsJson = JSON.stringify(args);
  const tmpFile = `/tmp/convex-seed-pe-${Date.now()}.json`;
  writeFileSync(tmpFile, argsJson);
  try {
    const prodFlag = prod ? " --prod" : "";
    const result = execSync(
      `npx convex run${prodFlag} ${fn} "$(cat ${tmpFile})"`,
      { cwd: resolve(__dirname, ".."), maxBuffer: 50 * 1024 * 1024, encoding: "utf-8" }
    );
    unlinkSync(tmpFile);
    return result.trim() ? JSON.parse(result.trim()) : {};
  } catch (e: any) {
    try { unlinkSync(tmpFile); } catch { /* noop */ }
    throw new Error(`convex run ${fn} failed: ${e.message}`);
  }
}

// ─── Pure transform helpers ──────────────────────────────────────────────────

function stripBBCode(s: string): string {
  if (!s) return "";
  return s.replace(/\[(\/)?(u|b|i|color[^\]]*)\]/gi, "").trim();
}

function slugifyCode(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

function dedupOptions(opts: Array<{ code: string; name: string }>): Array<{ code: string; name: string }> {
  const seen = new Set<string>();
  const out: Array<{ code: string; name: string }> = [];
  for (const o of opts) {
    if (seen.has(o.code)) continue;
    seen.add(o.code);
    out.push(o);
  }
  return out;
}

// ─── Per-question planner metadata (hardcoded, per the plan) ─────────────────
//
// Keyed by forms.app `displayOrder`. Each entry holds the Convex external id
// (or two, for the fullname split at DO 0), short label, indication, help, and
// example for `text`/`number`/`date` types. Sections come from PLAN's table.

type Section =
  | "Identité de l'enfant"
  | "Statut familial"
  | "Documents personnels"
  | "Statut au Canada"
  | "Antécédents et sécurité"
  | "Scolarité"
  | "Voyages"
  | "Adresses";

interface QMetaSingle {
  externalId: string;
  shortLabel?: string;
  indication?: string;
  help?: string;
  example?: string;
  section: Section;
  hasDetailsBox?: boolean;
  detailsBoxLabel?: string;
  multiEntryAddLabel?: string;
}

const META: Record<number, QMetaSingle | QMetaSingle[]> = {
  0: [
    {
      externalId: "pe_001_prenom",
      shortLabel: "Prénom enfant",
      indication: "Indiquez le ou les prénoms de l'enfant, exactement comme sur son acte de naissance ou son passeport.",
      help: "N'utilisez pas de surnom. Incluez tous les prénoms s'il y en a plusieurs.",
      example: "Léa",
      section: "Identité de l'enfant",
    },
    {
      externalId: "pe_001_nom",
      shortLabel: "Nom enfant",
      indication: "Indiquez le nom de famille de l'enfant, exactement comme sur son acte de naissance ou son passeport.",
      help: "Si l'enfant porte un nom composé, incluez les deux parties.",
      example: "Benali",
      section: "Identité de l'enfant",
    },
  ],
  1: {
    externalId: "pe_002",
    shortLabel: "Âge majeur",
    indication: "Confirmez si l'enfant est âgé de 18 ans ou plus en date d'aujourd'hui.",
    help: "L'âge détermine si certains documents (ex. : certificat de police) sont requis.",
    section: "Statut familial",
  },
  2: {
    externalId: "pe_003",
    shortLabel: "A des enfants",
    indication: "Indiquez si l'enfant parrainé a lui-même des enfants.",
    help: "Répondez Oui même si les enfants ne vivent pas avec lui.",
    section: "Statut familial",
  },
  3: {
    externalId: "pe_004",
    shortLabel: "Enfants",
    indication: "Listez tous les enfants de la personne parrainée (qu'ils vous accompagnent ou non).",
    help: "Utilisez le bouton + pour ajouter un enfant. Faites défiler à droite pour remplir toutes les colonnes.",
    multiEntryAddLabel: "+ Ajouter un enfant",
    section: "Statut familial",
  },
  4: {
    externalId: "pe_005",
    shortLabel: "Parents",
    indication: "Renseignez les informations sur les deux parents biologiques de l'enfant parrainé.",
    help: "Si un parent est décédé, indiquez Décédé dans le champ Adresse de résidence.",
    multiEntryAddLabel: "+ Ajouter un parent",
    section: "Statut familial",
  },
  5: {
    externalId: "pe_006",
    shortLabel: "Famille au Canada",
    indication: "Indiquez si l'enfant a d'autres membres de famille (oncle, tante, cousin, etc.) qui vivent au Canada.",
    help: "Excluez les parents et frères/sœurs déjà listés ci-dessus.",
    section: "Statut familial",
  },
  6: {
    externalId: "pe_007",
    shortLabel: "Famille au Canada",
    indication: "Listez les membres de la famille étendue qui vivent au Canada.",
    help: "Précisez le lien de parenté pour chaque membre.",
    multiEntryAddLabel: "+ Ajouter un membre",
    section: "Statut familial",
  },
  7: {
    externalId: "pe_008",
    shortLabel: "Acte naissance",
    indication: "Téléversez l'acte ou certificat de naissance de l'enfant, ou les papiers d'adoption / garde complète si applicable.",
    help: "Formats acceptés : PDF, JPG, PNG, HEIC. Taille maximale : 10 Mo par fichier.",
    section: "Documents personnels",
  },
  8: {
    externalId: "pe_009",
    shortLabel: "Certificat police",
    indication: "Téléversez un certificat de police pour chaque pays où l'enfant a vécu 6 mois ou plus depuis ses 18 ans.",
    help: "Requis seulement si l'enfant a plus de 18 ans. Sinon, laissez vide.",
    section: "Documents personnels",
  },
  9: {
    externalId: "pe_010",
    shortLabel: "Anciennes relations",
    indication: "Indiquez les anciennes relations maritales officielles de l'enfant (mariage ou union de fait d'au moins 1 an), si applicable.",
    help: "Pour chaque relation : prénom et nom de la personne, date de naissance, et date de rupture.",
    example: "Yacine Hamadi, 1998-04-12, séparation 2022-09.",
    section: "Documents personnels",
  },
  10: {
    externalId: "pe_011",
    shortLabel: "Statuts Canada",
    indication: "Listez chaque statut migratoire que l'enfant a détenu au Canada, du plus ancien au plus récent.",
    help: "Inclut : visa visiteur, permis d'études, permis de travail, résidence permanente, etc.",
    multiEntryAddLabel: "+ Ajouter un statut",
    section: "Statut au Canada",
  },
  11: {
    externalId: "pe_012",
    shortLabel: "Crime Canada",
    indication: "Indiquez si l'enfant a déjà été reconnu coupable d'un crime ou d'une infraction au Canada.",
    section: "Antécédents et sécurité",
  },
  12: {
    externalId: "pe_013",
    shortLabel: "Crime autre pays",
    indication: "Indiquez si l'enfant a déjà été reconnu coupable, accusé ou jugé pour un crime ou une infraction dans un autre pays que le Canada.",
    section: "Antécédents et sécurité",
  },
  13: {
    externalId: "pe_014",
    shortLabel: "Demande asile",
    indication: "Indiquez si l'enfant a déjà présenté une demande d'asile au Canada ou ailleurs.",
    section: "Antécédents et sécurité",
  },
  14: {
    externalId: "pe_015",
    shortLabel: "Demande refusée",
    indication: "Indiquez si l'enfant a déjà soumis sans succès une demande de RP, visa visiteur ou résident temporaire.",
    section: "Antécédents et sécurité",
  },
  15: {
    externalId: "pe_016",
    shortLabel: "Ordre quitter",
    indication: "Indiquez si l'enfant a déjà reçu l'ordre de quitter le Canada ou tout autre pays.",
    section: "Antécédents et sécurité",
  },
  16: {
    externalId: "pe_017",
    shortLabel: "Crime contre humanité",
    indication: "Indiquez si l'enfant a déjà participé à un acte de génocide, de crime de guerre ou de crime contre l'humanité.",
    section: "Antécédents et sécurité",
  },
  17: {
    externalId: "pe_018",
    shortLabel: "Violence groupe armé",
    indication: "Indiquez si l'enfant a déjà utilisé ou prôné la violence, ou appartenu à un groupe armé.",
    section: "Antécédents et sécurité",
  },
  18: {
    externalId: "pe_019",
    shortLabel: "Organisation criminelle",
    indication: "Indiquez si l'enfant a déjà été membre d'une organisation criminelle.",
    section: "Antécédents et sécurité",
  },
  19: {
    externalId: "pe_020",
    shortLabel: "Détention",
    indication: "Indiquez si l'enfant a déjà été détenu, incarcéré ou emprisonné.",
    section: "Antécédents et sécurité",
  },
  20: {
    externalId: "pe_021",
    shortLabel: "Maladie grave",
    indication: "Indiquez si l'enfant a déjà souffert d'une maladie grave ou d'un trouble physique ou mental.",
    section: "Antécédents et sécurité",
  },
  21: {
    externalId: "pe_022",
    shortLabel: "Détails antécédents",
    indication: "Si vous avez répondu Oui à une des questions précédentes sur les antécédents, fournissez les détails ici.",
    help: "Précisez la date, le lieu, la nature de l'infraction ou de la situation, et l'issue.",
    section: "Antécédents et sécurité",
  },
  22: {
    externalId: "pe_023",
    shortLabel: "Charge publique",
    indication: "Indiquez si l'enfant a déjà travaillé pour une charge publique officielle.",
    help: "Si oui, précisez dans le champ commentaire la date, le pays, la sphère d'activité, le service et le poste.",
    section: "Antécédents et sécurité",
    hasDetailsBox: true,
    detailsBoxLabel: "Si oui, précisez date, pays, sphère, service, poste",
  },
  23: {
    externalId: "pe_024",
    shortLabel: "Service militaire",
    indication: "Indiquez si l'enfant a déjà fait un service militaire ou paramilitaire.",
    help: "Si oui, précisez dans le champ commentaire la date, le secteur, l'unité, les commandants, le grade, les dates et lieux de combats, et la raison de la fin du service.",
    section: "Antécédents et sécurité",
    hasDetailsBox: true,
    detailsBoxLabel: "Si oui, précisez date, secteur, unité, commandants, grade, combats, fin du service",
  },
  24: {
    externalId: "pe_025",
    shortLabel: "Niveau scolarité",
    indication: "Indiquez le niveau de scolarité le plus élevé complété par l'enfant.",
    help: "Exemples : études secondaires, DEP, DEC, baccalauréat, maîtrise, doctorat.",
    example: "Baccalauréat en informatique",
    section: "Scolarité",
  },
  25: {
    externalId: "pe_026",
    shortLabel: "Années études",
    indication: "Indiquez le nombre total d'années d'études complétées par l'enfant.",
    help: "Comptez à partir de la première année primaire. Minimum 1.",
    example: "14",
    section: "Scolarité",
  },
  26: {
    externalId: "pe_027",
    shortLabel: "CSQ",
    indication: "Indiquez si l'enfant détient déjà un Certificat de sélection du Québec (CSQ).",
    section: "Statut au Canada",
  },
  27: {
    externalId: "pe_028",
    shortLabel: "Fichier CSQ",
    indication: "Téléversez le CSQ de l'enfant.",
    help: "Formats acceptés : PDF, JPG, PNG, HEIC. Maximum 3 fichiers.",
    section: "Statut au Canada",
  },
  28: {
    externalId: "pe_029",
    shortLabel: "Date demande CSQ",
    indication: "Indiquez la date à laquelle la demande de CSQ a été présentée.",
    help: "Format : AAAA-MM-JJ.",
    example: "2024-06-15",
    section: "Statut au Canada",
  },
  29: {
    externalId: "pe_030",
    shortLabel: "Voyages 10 ans",
    indication: "Indiquez si l'enfant a effectué des voyages hors de son pays d'origine ou de résidence au cours des 10 dernières années.",
    section: "Voyages",
  },
  30: {
    externalId: "pe_031",
    shortLabel: "Liste voyages",
    indication: "Listez chaque voyage effectué au cours des 10 dernières années.",
    help: "Utilisez le bouton + pour ajouter un voyage. Faites défiler à droite pour remplir toutes les colonnes.",
    multiEntryAddLabel: "+ Ajouter un voyage",
    section: "Voyages",
  },
  31: {
    externalId: "pe_032",
    shortLabel: "Preuves voyages",
    indication: "Téléversez des preuves des voyages des 10 dernières années.",
    help: "Exemples : billet d'avion, preuve de réservation, captures d'écran de l'itinéraire.",
    section: "Voyages",
  },
  32: {
    externalId: "pe_033",
    shortLabel: "Adresses 10 ans",
    indication: "Listez toutes les adresses de résidence de l'enfant au cours des 10 dernières années.",
    help: "Utilisez le bouton + pour ajouter une adresse. Faites défiler à droite pour remplir toutes les colonnes.",
    multiEntryAddLabel: "+ Ajouter une adresse",
    section: "Adresses",
  },
  // 33, 34: termsandconditions — SKIP
  // 35: drawing — SKIP
};

// Fixed labels for the fullname split at DO 0 (override stripBBCode of the source).
const FULLNAME_LABELS = {
  prenom: "Prénom de l'enfant du demandeur principal",
  nom: "Nom de famille de l'enfant du demandeur principal",
};

// ─── Type mapping for forms.app columns inside grids ─────────────────────────
type GridColumn = {
  name: string;
  type: "text" | "date" | "dropdown";
  required?: boolean;
  options?: Array<{ text: string }>;
};

function mapGridColumn(col: GridColumn): any {
  const key = slugifyCode(col.name);
  if (col.type === "text") return { key, label: col.name, type: "text" };
  if (col.type === "date") return { key, label: col.name, type: "date" };
  if (col.type === "dropdown") {
    const opts = (col.options ?? []).map((o) => ({
      code: slugifyCode(o.text),
      name: o.text.trim(),
    }));
    return { key, label: col.name, type: "select", options: dedupOptions(opts) };
  }
  // Fallback: treat unknown as text
  return { key, label: col.name, type: "text" };
}

function successMessageFor(type: string): string {
  if (type === "document") return "Documents reçus";
  if (type === "multi-entry") return "Réponses enregistrées";
  return "Réponse enregistrée";
}

// ─── Build payloads ──────────────────────────────────────────────────────────
interface QuestionRow {
  externalId: string;
  label: string;
  shortLabel?: string;
  type: string;
  indication?: string;
  help?: string;
  example?: string;
  isRequired: boolean;
  successMessage?: string;
  options?: any;
  documentConfig?: any;
  multiEntryFields?: any;
  multiEntryAddLabel?: string;
  hasDetailsBox?: boolean;
  detailsBoxLabel?: string;
}

interface FormQuestionRow {
  formDefinitionId: string;
  questionKey: string;
  orderIndex: number;
  section?: string;
  dependsOn?: { questionId: string; value: string } | null;
}

interface BuildResult {
  questions: QuestionRow[];
  formQuestions: FormQuestionRow[];
  warnings: string[];
}

function buildPayloads(source: any): BuildResult {
  const warnings: string[] = [];
  const questions: QuestionRow[] = [];
  const formQuestions: FormQuestionRow[] = [];

  const sorted = [...source.questions].sort((a: any, b: any) => a.displayOrder - b.displayOrder);

  // forms.app source `_id` → Convex externalId, used to wire dependsOn.
  const sourceIdToExternal: Record<string, string> = {};

  let orderIndex = 1;

  for (const q of sorted) {
    const meta = META[q.displayOrder];
    const labelRaw = stripBBCode(q.question || "");

    // Skips ─ termsandconditions, drawing
    if (q.questionType === "termsandconditions") {
      warnings.push(`DO ${q.displayOrder}: skipped termsandconditions`);
      continue;
    }
    if (q.questionType === "drawing") {
      warnings.push(`DO ${q.displayOrder}: skipped drawing (signature)`);
      continue;
    }

    if (!meta) {
      warnings.push(`DO ${q.displayOrder}: no metadata for type=${q.questionType} — skipped`);
      continue;
    }

    // Fullname split → two questions
    if (q.questionType === "fullname" && Array.isArray(meta)) {
      const [prenomMeta, nomMeta] = meta;
      const prenomRow: QuestionRow = {
        externalId: prenomMeta.externalId,
        label: FULLNAME_LABELS.prenom,
        shortLabel: prenomMeta.shortLabel,
        type: "text",
        indication: prenomMeta.indication,
        help: prenomMeta.help,
        example: prenomMeta.example,
        isRequired: true,
        successMessage: successMessageFor("text"),
      };
      const nomRow: QuestionRow = {
        externalId: nomMeta.externalId,
        label: FULLNAME_LABELS.nom,
        shortLabel: nomMeta.shortLabel,
        type: "text",
        indication: nomMeta.indication,
        help: nomMeta.help,
        example: nomMeta.example,
        isRequired: true,
        successMessage: successMessageFor("text"),
      };
      questions.push(prenomRow, nomRow);
      formQuestions.push({
        formDefinitionId: SUPABASE_PLACEHOLDER,
        questionKey: prenomRow.externalId,
        orderIndex: orderIndex++,
        section: prenomMeta.section,
      });
      formQuestions.push({
        formDefinitionId: SUPABASE_PLACEHOLDER,
        questionKey: nomRow.externalId,
        orderIndex: orderIndex++,
        section: nomMeta.section,
      });
      sourceIdToExternal[q._id] = prenomRow.externalId; // pe_001_prenom is a reasonable anchor
      warnings.push(`DO 0: fullname split into ${prenomRow.externalId} + ${nomRow.externalId}`);
      continue;
    }

    if (Array.isArray(meta)) {
      throw new Error(`DO ${q.displayOrder}: unexpected array meta for type=${q.questionType}`);
    }

    // Build one Convex question row
    const row: QuestionRow = {
      externalId: meta.externalId,
      label: labelRaw,
      shortLabel: meta.shortLabel,
      type: "text",
      indication: meta.indication,
      help: meta.help,
      isRequired: true,
      successMessage: "Réponse enregistrée",
    };

    if (q.questionType === "choice" && q.choice?.subType === "yesno") {
      row.type = "yes-no";
    } else if (q.questionType === "choice") {
      row.type = "select";
      const opts = (q.choice?.options ?? []).map((o: any) => ({
        code: slugifyCode(o.text),
        name: o.text.trim(),
      }));
      row.options = dedupOptions(opts);
    } else if (q.questionType === "grid") {
      row.type = "multi-entry";
      row.multiEntryFields = (q.grid?.columns ?? []).map(mapGridColumn);
      row.multiEntryAddLabel = meta.multiEntryAddLabel ?? "+ Ajouter";
    } else if (q.questionType === "fileupload") {
      row.type = "document";
      row.documentConfig = {
        acceptedFormats: ["application/pdf", "image/jpeg", "image/png", "image/heic"],
        maxSizeMB: 10,
      };
    } else if (q.questionType === "text") {
      row.type = q.text?.subType === "longtext" ? "textarea" : "text";
      if (meta.example) row.example = meta.example;
    } else if (q.questionType === "number") {
      row.type = "number";
      if (meta.example) row.example = meta.example;
    } else if (q.questionType === "date") {
      row.type = "date";
      if (meta.example) row.example = meta.example;
    } else {
      throw new Error(`DO ${q.displayOrder}: unsupported type=${q.questionType}`);
    }

    row.successMessage = successMessageFor(row.type);

    if (meta.hasDetailsBox) {
      row.hasDetailsBox = true;
      row.detailsBoxLabel = meta.detailsBoxLabel;
    }

    questions.push(row);
    formQuestions.push({
      formDefinitionId: SUPABASE_PLACEHOLDER,
      questionKey: row.externalId,
      orderIndex: orderIndex++,
      section: meta.section,
    });
    sourceIdToExternal[q._id] = row.externalId;
  }

  // ─── Wire dependsOn from forms.app conditions ──────────────────────────────
  // Wizard supports { questionId, value } where `value` can be string or array
  // (array → "matches ANY"). It does NOT support cross-question OR, so the
  // pe_022 multi-trigger condition gets a single representative trigger
  // (Q11 = pe_012 = Oui). We document this as a deviation: in the rare case
  // a user has Oui on Q12..Q20 but Non on Q11, pe_022 won't auto-show. To
  // mitigate, we ALSO leave pe_022 unconditional so it's always reachable —
  // see "âge-majeur hide cascade" treatment below.
  //
  // For pe_022 specifically we OMIT dependsOn entirely (always show). For the
  // other 6 conditions, we encode them straight.
  //
  // The hide cascade on Q1 (âge majeur = Oui hides voyages + others) is a
  // forms.app authoring quirk — adults still travel. We OMIT the cascade.
  const conditions = source.conditions ?? [];
  let dependsApplied = 0;
  for (const cond of conditions) {
    const actions = cond.actions ?? [];
    const triggers = cond.triggers ?? [];
    for (const action of actions) {
      if (action.action !== "show") continue; // skip "hide" cascades

      const targetExternal = sourceIdToExternal[action.targetQuestionId];
      if (!targetExternal) continue;

      // For pe_022 (détails antécédents) we leave it always visible.
      if (targetExternal === "pe_022") continue;

      // Use the first trigger only. This works for all single-trigger conditions
      // (pe_004, pe_007, pe_028, pe_029, pe_031, pe_032).
      const firstTrigger = triggers[0];
      if (!firstTrigger) continue;
      const sourceTriggerExternal = sourceIdToExternal[firstTrigger.questionId];
      if (!sourceTriggerExternal) continue;

      // forms.app encodes the answer as an OPTION _id; the trigger references
      // the Oui-option id by convention. We hard-encode "Oui"/"Non" based on
      // which option id matches the source's yesno options. Since the source
      // uses "Oui"/"Non" text consistently, we look it up via the source
      // question's choice.options array.
      const sourceTriggerQ = source.questions.find((q: any) => q._id === firstTrigger.questionId);
      const triggerAnswerId = Array.isArray(firstTrigger.answer) ? firstTrigger.answer[0] : firstTrigger.answer;
      const opt = (sourceTriggerQ?.choice?.options ?? []).find((o: any) => o._id === triggerAnswerId);
      const value = opt?.text ?? "Oui";

      const link = formQuestions.find((f) => f.questionKey === targetExternal);
      if (!link) continue;
      link.dependsOn = { questionId: sourceTriggerExternal, value };
      dependsApplied++;
    }
  }

  warnings.push(`dependsOn applied to ${dependsApplied} formQuestions rows`);
  warnings.push("pe_022 (détails antécédents) intentionally left always-visible — wizard dependsOn shape doesn't support cross-question OR");
  warnings.push("Q1 (âge majeur) hide-cascade intentionally omitted — adult applicants still travel/have antécédents");

  return { questions, formQuestions, warnings };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const sourcePath = resolve(__dirname, "parrainage-enfant-source.json");
  log(`Loading source from ${sourcePath}`);
  const source = JSON.parse(readFileSync(sourcePath, "utf-8"));

  const formDef = {
    supabaseId: SUPABASE_PLACEHOLDER,
    name: "Parrainage familial (Enfant du demandeur principal)",
    description:
      "Formulaire de collecte d'informations pour l'enfant du demandeur principal dans le cadre d'une demande de parrainage familial",
    slug: SLUG,
    category: "Résidence permanente",
    formGroup: "parrainage-couple",
    groupLabel: "Parrainage familial",
    isCustom: false,
    isSelfContained: true,
    isBaseForm: false,
    isConsentForm: false,
  };

  const { questions, formQuestions, warnings } = buildPayloads(source);

  // ─── Summary table ──────────────────────────────────────────────────────────
  const sectionCounts: Record<string, number> = {};
  for (const fq of formQuestions) {
    const s = fq.section ?? "(none)";
    sectionCounts[s] = (sectionCounts[s] ?? 0) + 1;
  }
  const depCount = formQuestions.filter((f) => !!f.dependsOn).length;

  log("─── Build summary ───");
  log(`  Total questions: ${questions.length}`);
  log(`  Total formQuestions: ${formQuestions.length}`);
  log(`  dependsOn rows: ${depCount}`);
  log(`  Sections:`);
  for (const [s, c] of Object.entries(sectionCounts)) {
    log(`    ${c.toString().padStart(2)} × ${s}`);
  }
  for (const w of warnings) log(`  · ${w}`);

  const target = FLAG_PROD ? "PROD" : FLAG_DRY ? "DRY-RUN" : "DEV";
  log(`Target: ${target}`);

  // ─── Dry run ────────────────────────────────────────────────────────────────
  if (FLAG_DRY) {
    const dryOut = {
      formDefinitions: { rows: [formDef], firmIdMap: {}, legalDocIdMap: {} },
      questions: { rows: questions, firmIdMap: {} },
      formQuestions: {
        rows: formQuestions,
        formDefIdMap: { [SUPABASE_PLACEHOLDER]: "<would-be-convex-id>" },
      },
      summary: { sectionCounts, dependsOnCount: depCount, warnings },
    };
    const outPath = "/tmp/parrainage-enfant-dryrun.json";
    writeFileSync(outPath, JSON.stringify(dryOut, null, 2));
    log(`DRY RUN: wrote payloads to ${outPath}`);
    log("Exiting without touching Convex.");
    return;
  }

  // ─── Idempotency check ─────────────────────────────────────────────────────
  log(`Checking slug "${SLUG}" against ${target}…`);
  const pre = convexRun("migrations:findFormDefinitionBySlug", { slug: SLUG }, FLAG_PROD);
  if (pre?.found && !FLAG_FORCE) {
    console.error(
      `Slug "${SLUG}" already exists (_id=${pre.id}). Aborting. Re-run with --force to override.`
    );
    process.exit(1);
  }
  if (pre?.found && FLAG_FORCE) {
    log(`WARN: --force set, proceeding even though slug already exists (_id=${pre.id})`);
  }

  // ─── Step 1: insert formDefinition ─────────────────────────────────────────
  log("Step 1/3: inserting formDefinitions…");
  const formMapping = convexRun(
    "migrations:insertFormDefinitions",
    { rows: [formDef], firmIdMap: {}, legalDocIdMap: {} },
    FLAG_PROD
  );
  const convexFormId = formMapping[SUPABASE_PLACEHOLDER];
  if (!convexFormId) {
    throw new Error(`insertFormDefinitions did not return a mapping for ${SUPABASE_PLACEHOLDER}`);
  }
  log(`  Inserted formDefinition _id=${convexFormId}`);

  // ─── Step 2: insert questions ──────────────────────────────────────────────
  log(`Step 2/3: inserting ${questions.length} questions…`);
  convexRun(
    "migrations:insertQuestionsBatch",
    { rows: questions, firmIdMap: {} },
    FLAG_PROD
  );
  log(`  Inserted ${questions.length} questions`);

  // ─── Step 3: insert formQuestions ──────────────────────────────────────────
  log(`Step 3/3: inserting ${formQuestions.length} formQuestions…`);
  convexRun(
    "migrations:insertFormQuestionsBatch",
    {
      rows: formQuestions,
      formDefIdMap: { [SUPABASE_PLACEHOLDER]: convexFormId },
    },
    FLAG_PROD
  );
  log(`  Inserted ${formQuestions.length} formQuestions`);

  // ─── Final summary ─────────────────────────────────────────────────────────
  const logPath = `/tmp/seedParrainageEnfant-${Date.now()}.log`;
  const finalSummary = [
    `Seed complete (${target})`,
    `formDefinition _id: ${convexFormId}`,
    `Questions inserted: ${questions.length}`,
    `formQuestions inserted: ${formQuestions.length}`,
    `Sections: ${Object.keys(sectionCounts).length}`,
    `dependsOn rows: ${depCount}`,
    "",
    "Section distribution:",
    ...Object.entries(sectionCounts).map(([s, c]) => `  ${c} × ${s}`),
    "",
    "Warnings / notes:",
    ...warnings.map((w) => `  · ${w}`),
  ].join("\n");
  writeFileSync(logPath, finalSummary);
  log("═══════════════════════════════════════════");
  log(finalSummary);
  log("═══════════════════════════════════════════");
  log(`Log file: ${logPath}`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
