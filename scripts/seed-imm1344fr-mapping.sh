#!/usr/bin/env bash
# Slice 2 — IMM 1344 FR (Demande de parrainage et engagement) intake mapping.
# Sponsor + sponsored-basic only; cosignataire is conditional & mirrors the
# sponsor shape, deferred to round 2 to keep this seed reviewable.
#
# Catalog dependency: scripts/seed-imm1344-catalog-gaps.sh must have run
# first (creates ~26 canonical questions that this mapping references).
# Idempotent: overwrites the blob on re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMM1344_FR_ID="k57606cb40jpvkvx7qxghw8sdd86mp70"

read -r -d '' ARGS <<'JSON' || true
{
  "legalDocumentId": "k57606cb40jpvkvx7qxghw8sdd86mp70",
  "immQuestions": {
    "intakeQuestions": [
      { "externalId": "correspondenceLanguage",     "label": "Part 1 Q2: Langue de correspondance",     "required": true,  "section": "Part 1 — Engagement",     "page": 1, "order": 1 },
      { "externalId": "hasCosigner",                "label": "Part 1 Q3: Cosignataire?",                "required": true,  "section": "Part 1 — Engagement",     "page": 1, "order": 2 },
      { "externalId": "sponsoredLastName",          "label": "Part 1 Q4: Nom famille personne parrainée","required": true, "section": "Part 1 — Engagement",     "page": 1, "order": 3 },
      { "externalId": "sponsoredFirstName",         "label": "Part 1 Q4: Prénom personne parrainée",    "required": false, "section": "Part 1 — Engagement",     "page": 1, "order": 4 },
      { "externalId": "sponsoredDateOfBirth",       "label": "Part 1 Q5: DOB personne parrainée",       "required": true,  "section": "Part 1 — Engagement",     "page": 1, "order": 5 },
      { "externalId": "sponsoredRelationship",      "label": "Part 1 Q6a: Lien avec personne parrainée","required": true,  "section": "Part 1 — Engagement",     "page": 1, "order": 6 },
      { "externalId": "sponsoredRelationshipOther", "label": "Part 1 Q6b: Autre lien (précisez)",       "required": false, "section": "Part 1 — Engagement",     "page": 1, "order": 7 },
      { "externalId": "relationshipStartDate",      "label": "Part 1 Q6c: Date début relation conjugale","required": false,"section": "Part 1 — Engagement",     "page": 1, "order": 8 },

      { "externalId": "lastName",                   "label": "Détails répondant Q1: Nom de famille",     "required": true,  "section": "Détails du répondant",    "page": 1, "order": 10 },
      { "externalId": "firstName",                  "label": "Détails répondant Q1: Prénom",             "required": false, "section": "Détails du répondant",    "page": 1, "order": 11 },
      { "externalId": "otherNames",                 "label": "Détails répondant Q2: Autre nom utilisé",  "required": false, "section": "Détails du répondant",    "page": 1, "order": 12 },
      { "externalId": "gender",                     "label": "Détails répondant Q3: Genre",              "required": true,  "section": "Détails du répondant",    "page": 1, "order": 13 },
      { "externalId": "dateOfBirth",                "label": "Détails répondant Q4: Date de naissance",  "required": true,  "section": "Détails du répondant",    "page": 1, "order": 14 },
      { "externalId": "birthCity",                  "label": "Détails répondant Q5: Ville de naissance", "required": true,  "section": "Détails du répondant",    "page": 1, "order": 15 },
      { "externalId": "birthCountry",               "label": "Détails répondant Q5: Pays de naissance",  "required": true,  "section": "Détails du répondant",    "page": 1, "order": 16 },
      { "externalId": "canadianStatus",             "label": "Détails répondant Q6: Statut au Canada",   "required": true,  "section": "Détails du répondant",    "page": 1, "order": 17 },
      { "externalId": "canadianStatusObtainedDate", "label": "Détails répondant Q7a: Date statut",       "required": false, "section": "Détails du répondant",    "page": 1, "order": 18 },
      { "externalId": "iucNumber",                  "label": "Détails répondant Q7b: IUC",               "required": false, "section": "Détails du répondant",    "page": 1, "order": 19 },
      { "externalId": "nameOnPRSame",               "label": "Détails répondant Q7c: Même nom à PR?",    "required": false, "section": "Détails du répondant",    "page": 1, "order": 20 },
      { "externalId": "nameOnPRLastName",           "label": "Détails répondant Q7c: Nom famille à PR",  "required": false, "section": "Détails du répondant",    "page": 1, "order": 21 },
      { "externalId": "nameOnPRFirstName",          "label": "Détails répondant Q7c: Prénom à PR",       "required": false, "section": "Détails du répondant",    "page": 1, "order": 22 },
      { "externalId": "maritalStatus",              "label": "Détails répondant Q8a: État matrimonial",  "required": true,  "section": "Détails du répondant",    "page": 1, "order": 23 },
      { "externalId": "marriageDate",               "label": "Détails répondant Q8b: Date mariage/union","required": false, "section": "Détails du répondant",    "page": 1, "order": 24 },
      { "externalId": "spouseFullName",             "label": "Détails répondant Q8c: Nom époux actuel",  "required": false, "section": "Détails du répondant",    "page": 1, "order": 25 },
      { "externalId": "hasPreviousMarriage",        "label": "Détails répondant Q9: Déjà marié?",        "required": true,  "section": "Détails du répondant",    "page": 1, "order": 26 },
      { "externalId": "exSpouseName",               "label": "Détails répondant Q9: Nom ex-conjoint",    "required": false, "section": "Détails du répondant",    "page": 2, "order": 27 },
      { "externalId": "exSpouseDob",                "label": "Détails répondant Q9: DOB ex-conjoint",    "required": false, "section": "Détails du répondant",    "page": 2, "order": 28 },
      { "externalId": "exSpouseUnionType",          "label": "Détails répondant Q9: Type d'union",       "required": false, "section": "Détails du répondant",    "page": 2, "order": 29 },
      { "externalId": "exSpouseUnionStartDate",     "label": "Détails répondant Q9: Du",                 "required": false, "section": "Détails du répondant",    "page": 2, "order": 30 },
      { "externalId": "exSpouseUnionEndDate",       "label": "Détails répondant Q9: Au",                 "required": false, "section": "Détails du répondant",    "page": 2, "order": 31 },

      { "externalId": "postalAddress",              "label": "Coordonnées Q1: Adresse postale",          "required": true,  "section": "Coordonnées du répondant","page": 2, "order": 40 },
      { "externalId": "samePostalAddress",          "label": "Coordonnées Q2: Adresse domiciliaire = postale?", "required": true, "section": "Coordonnées du répondant","page": 2, "order": 41 },
      { "externalId": "residenceAddress",           "label": "Coordonnées Q2: Adresse domiciliaire",     "required": false, "section": "Coordonnées du répondant","page": 2, "order": 42 },
      { "externalId": "phone",                      "label": "Coordonnées Q3: Numéro de téléphone",      "required": false, "section": "Coordonnées du répondant","page": 2, "order": 43 },
      { "externalId": "phoneType",                  "label": "Coordonnées Q3: Type de téléphone",        "required": false, "section": "Coordonnées du répondant","page": 2, "order": 44 },
      { "externalId": "email",                      "label": "Coordonnées Q6: Adresse électronique",     "required": false, "section": "Coordonnées du répondant","page": 2, "order": 45 },

      { "externalId": "isCanadianAbroad",           "label": "Déclaration: Citoyen canadien hors Canada?","required": true, "section": "Déclaration de résidence","page": 2, "order": 50 },
      { "externalId": "intendedProvince",           "label": "Déclaration: Province d'installation",     "required": false, "section": "Déclaration de résidence","page": 2, "order": 51 },

      { "externalId": "sponsoringFamilyCategory",   "label": "Admissibilité Q3: Catégorie regroupement?","required": true,  "section": "Examen d'admissibilité",  "page": 2, "order": 60 },
      { "externalId": "canadaSoleResidence",        "label": "Admissibilité Q4: Canada seul pays?",      "required": true,  "section": "Examen d'admissibilité",  "page": 2, "order": 61 },
      { "externalId": "becamePRViaSponsorship5y",   "label": "Admissibilité Q5: PR via parrainage <5y?", "required": true,  "section": "Examen d'admissibilité",  "page": 2, "order": 62 },
      { "externalId": "priorPendingApplication",    "label": "Admissibilité Q6: Demande antérieure?",    "required": true,  "section": "Examen d'admissibilité",  "page": 2, "order": 63 },
      { "externalId": "onSocialAssistance",         "label": "Admissibilité Q7: Aide sociale?",          "required": true,  "section": "Examen d'admissibilité",  "page": 2, "order": 64 },
      { "externalId": "isUndischargedBankrupt",     "label": "Admissibilité Q8: Failli non libéré?",     "required": false, "section": "Examen d'admissibilité",  "page": 2, "order": 65 },
      { "externalId": "pr_024",                     "label": "Admissibilité Q11: Sommé de quitter?",     "required": true,  "section": "Examen d'admissibilité",  "page": 3, "order": 66 },
      { "externalId": "pr_028",                     "label": "Admissibilité Q13: Détenu actuellement?",  "required": true,  "section": "Examen d'admissibilité",  "page": 3, "order": 67 },
      { "externalId": "pr_020",                     "label": "Admissibilité Q14: Coupable infraction?",  "required": true,  "section": "Examen d'admissibilité",  "page": 3, "order": 68 },
      { "externalId": "citizenshipRevocation",      "label": "Admissibilité Q16: Révocation citoyenneté?","required": true, "section": "Examen d'admissibilité",  "page": 3, "order": 69 },
      { "externalId": "inadmissibilityReport",      "label": "Admissibilité Q17: Interdiction territoire?","required": true,"section": "Examen d'admissibilité",  "page": 3, "order": 70 },
      { "externalId": "chargedSeriousOffence",      "label": "Admissibilité Q18: Accusé 10+ ans?",       "required": true,  "section": "Examen d'admissibilité",  "page": 3, "order": 71 },
      { "externalId": "admissibilityDetails",       "label": "Admissibilité: Détails (textarea)",        "required": false, "section": "Examen d'admissibilité",  "page": 3, "order": 72 }
    ],
    "requiredDocuments": []
  }
}
JSON

(cd "$CONVEX_DIR" && npx convex run legalDocuments:setImmQuestions "$ARGS")
echo "[seed] immQuestions set on legalDocuments/$IMM1344_FR_ID (50 intake questions, sponsor + sponsored basic)"
