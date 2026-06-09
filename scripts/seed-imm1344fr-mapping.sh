#!/usr/bin/env bash
# IMM 1344 FR (Demande de parrainage et engagement) — complete intake mapping.
# 105 intake questions covering sponsor (Part 1 + Détails + Coordonnées +
# Déclaration de résidence + Examen d'admissibilité Q1-18) AND cosignataire
# (Détails + Coordonnées + Déclaration de résidence + Examen d'admissibilité
# Q1-15). Page-header fields (Nom du demandeur + Date de naissance repeated
# on pages 2-5) are NOT mapped — they're derived from sponsoredLastName +
# sponsoredFirstName + sponsoredDateOfBirth and filled at the PDF stage.
#
# Signatures + dates de signature: NOT mapped (handled at PDF-fill stage,
# same convention as IMM 5532).
#
# Catalog dependencies (must run first, both idempotent):
#   - scripts/seed-imm1344-catalog-gaps.sh        (round 1, 26 questions)
#   - scripts/seed-imm1344-round2-catalog-gaps.sh (round 2, 56 questions:
#     7 sponsor gap-fills + 49 cosigner)
#
# setImmQuestions overwrites the entire blob, so this is the full mapping.
# Idempotent: safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMM1344_FR_ID="k57606cb40jpvkvx7qxghw8sdd86mp70"

read -r -d '' ARGS <<'JSON' || true
{
  "legalDocumentId": "k57606cb40jpvkvx7qxghw8sdd86mp70",
  "immQuestions": {
    "intakeQuestions": [
      { "externalId": "sponsorIneligibilityChoice", "label": "Part 1 Q1: Choix si non admissible comme répondant",     "required": false, "section": "Part 1 — Engagement",          "page": 1, "order": 0 },
      { "externalId": "correspondenceLanguage",     "label": "Part 1 Q2: Langue de correspondance",                  "required": true,  "section": "Part 1 — Engagement",          "page": 1, "order": 1 },
      { "externalId": "hasCosigner",                "label": "Part 1 Q3: Cosignataire?",                             "required": true,  "section": "Part 1 — Engagement",          "page": 1, "order": 2 },
      { "externalId": "sponsoredLastName",          "label": "Part 1 Q4: Nom famille personne parrainée",             "required": true, "section": "Part 1 — Engagement",          "page": 1, "order": 3 },
      { "externalId": "sponsoredFirstName",         "label": "Part 1 Q4: Prénom personne parrainée",                 "required": false, "section": "Part 1 — Engagement",          "page": 1, "order": 4 },
      { "externalId": "sponsoredDateOfBirth",       "label": "Part 1 Q5: DOB personne parrainée",                    "required": true,  "section": "Part 1 — Engagement",          "page": 1, "order": 5 },
      { "externalId": "sponsoredRelationship",      "label": "Part 1 Q6a: Lien avec personne parrainée",             "required": true,  "section": "Part 1 — Engagement",          "page": 1, "order": 6 },
      { "externalId": "sponsoredRelationshipOther", "label": "Part 1 Q6b: Autre lien (précisez)",                    "required": false, "section": "Part 1 — Engagement",          "page": 1, "order": 7 },
      { "externalId": "relationshipStartDate",      "label": "Part 1 Q6c: Date début relation conjugale",            "required": false, "section": "Part 1 — Engagement",          "page": 1, "order": 8 },

      { "externalId": "lastName",                   "label": "Détails répondant Q1: Nom de famille",                 "required": true,  "section": "Détails du répondant",         "page": 1, "order": 10 },
      { "externalId": "firstName",                  "label": "Détails répondant Q1: Prénom",                         "required": false, "section": "Détails du répondant",         "page": 1, "order": 11 },
      { "externalId": "otherNames",                 "label": "Détails répondant Q2: Autre nom utilisé",              "required": false, "section": "Détails du répondant",         "page": 1, "order": 12 },
      { "externalId": "gender",                     "label": "Détails répondant Q3: Genre",                          "required": true,  "section": "Détails du répondant",         "page": 1, "order": 13 },
      { "externalId": "dateOfBirth",                "label": "Détails répondant Q4: Date de naissance",              "required": true,  "section": "Détails du répondant",         "page": 1, "order": 14 },
      { "externalId": "birthCity",                  "label": "Détails répondant Q5: Ville de naissance",             "required": true,  "section": "Détails du répondant",         "page": 1, "order": 15 },
      { "externalId": "birthCountry",               "label": "Détails répondant Q5: Pays de naissance",              "required": true,  "section": "Détails du répondant",         "page": 1, "order": 16 },
      { "externalId": "canadianStatus",             "label": "Détails répondant Q6: Statut au Canada",               "required": true,  "section": "Détails du répondant",         "page": 1, "order": 17 },
      { "externalId": "canadianStatusObtainedDate", "label": "Détails répondant Q7a: Date statut",                   "required": false, "section": "Détails du répondant",         "page": 1, "order": 18 },
      { "externalId": "iucNumber",                  "label": "Détails répondant Q7b: IUC",                           "required": false, "section": "Détails du répondant",         "page": 1, "order": 19, "dependsOn": { "questionId": "canadianStatus", "value": ["citoyen_naturalise", "resident_permanent"] } },
      { "externalId": "nameOnPRSame",               "label": "Détails répondant Q7c: Même nom à PR?",                "required": false, "section": "Détails du répondant",         "page": 1, "order": 20 },
      { "externalId": "nameOnPRLastName",           "label": "Détails répondant Q7c: Nom famille à PR",              "required": false, "section": "Détails du répondant",         "page": 1, "order": 21 },
      { "externalId": "nameOnPRFirstName",          "label": "Détails répondant Q7c: Prénom à PR",                   "required": false, "section": "Détails du répondant",         "page": 1, "order": 22 },
      { "externalId": "maritalStatus",              "label": "Détails répondant Q8a: État matrimonial",              "required": true,  "section": "Détails du répondant",         "page": 1, "order": 23 },
      { "externalId": "marriageDate",               "label": "Détails répondant Q8b: Date mariage/union",            "required": false, "section": "Détails du répondant",         "page": 1, "order": 24 },
      { "externalId": "spouseFullName",             "label": "Détails répondant Q8c: Nom époux actuel",              "required": false, "section": "Détails du répondant",         "page": 1, "order": 25 },
      { "externalId": "hasPreviousMarriage",        "label": "Détails répondant Q9: Déjà marié?",                    "required": true,  "section": "Détails du répondant",         "page": 1, "order": 26 },
      { "externalId": "exSpouseName",               "label": "Détails répondant Q9: Nom ex-conjoint",                "required": false, "section": "Détails du répondant",         "page": 2, "order": 27 },
      { "externalId": "exSpouseDob",                "label": "Détails répondant Q9: DOB ex-conjoint",                "required": false, "section": "Détails du répondant",         "page": 2, "order": 28 },
      { "externalId": "exSpouseUnionType",          "label": "Détails répondant Q9: Type d'union",                   "required": false, "section": "Détails du répondant",         "page": 2, "order": 29 },
      { "externalId": "exSpouseUnionStartDate",     "label": "Détails répondant Q9: Du",                             "required": false, "section": "Détails du répondant",         "page": 2, "order": 30 },
      { "externalId": "exSpouseUnionEndDate",       "label": "Détails répondant Q9: Au",                             "required": false, "section": "Détails du répondant",         "page": 2, "order": 31 },

      { "externalId": "postalAddress",              "label": "Coordonnées Q1: Adresse postale",                      "required": true,  "section": "Coordonnées du répondant",     "page": 2, "order": 40 },
      { "externalId": "samePostalAddress",          "label": "Coordonnées Q2: Adresse domiciliaire = postale?",      "required": true,  "section": "Coordonnées du répondant",     "page": 2, "order": 41 },
      { "externalId": "residenceAddress",           "label": "Coordonnées Q2: Adresse domiciliaire",                 "required": false, "section": "Coordonnées du répondant",     "page": 2, "order": 42 },
      { "externalId": "phone",                      "label": "Coordonnées Q3: Numéro de téléphone",                  "required": false, "section": "Coordonnées du répondant",     "page": 2, "order": 43 },
      { "externalId": "phoneType",                  "label": "Coordonnées Q3: Type de téléphone",                    "required": false, "section": "Coordonnées du répondant",     "page": 2, "order": 44 },
      { "externalId": "email",                      "label": "Coordonnées Q6: Adresse électronique",                 "required": false, "section": "Coordonnées du répondant",     "page": 2, "order": 45 },

      { "externalId": "isCanadianAbroad",           "label": "Déclaration: Citoyen canadien hors Canada?",           "required": true,  "section": "Déclaration de résidence du répondant", "page": 2, "order": 50 },
      { "externalId": "intendedProvince",           "label": "Déclaration: Province d'installation",                 "required": false, "section": "Déclaration de résidence du répondant", "page": 2, "order": 51 },

      { "externalId": "isAdult",                                    "label": "Admissibilité Q1: 18 ans ou plus?",            "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 60 },
      { "externalId": "isCanadianOrPR",                             "label": "Admissibilité Q2: Citoyen ou RP?",             "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 61 },
      { "externalId": "sponsoringFamilyCategory",                   "label": "Admissibilité Q3: Catégorie regroupement?",    "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 62 },
      { "externalId": "canadaSoleResidence",                        "label": "Admissibilité Q4: Canada seul pays?",          "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 63 },
      { "externalId": "becamePRViaSponsorship5y",                   "label": "Admissibilité Q5: PR via parrainage <5y?",     "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 64 },
      { "externalId": "priorPendingApplication",                    "label": "Admissibilité Q6: Demande antérieure?",        "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 65 },
      { "externalId": "onSocialAssistance",                         "label": "Admissibilité Q7: Aide sociale?",              "required": true,  "section": "Examen d'admissibilité du répondant", "page": 2, "order": 66 },
      { "externalId": "isUndischargedBankrupt",                     "label": "Admissibilité Q8: Failli non libéré?",         "required": false, "section": "Examen d'admissibilité du répondant", "page": 2, "order": 67 },
      { "externalId": "priorSponsoredReceivedSocialAssistance",     "label": "Admissibilité Q9: Personne parrainée a reçu aide sociale?", "required": false, "section": "Examen d'admissibilité du répondant", "page": 3, "order": 68 },
      { "externalId": "priorCosignedReceivedSocialAssistance",      "label": "Admissibilité Q10: Cosigné engagement où aide sociale reçue?","required": false, "section": "Examen d'admissibilité du répondant", "page": 3, "order": 69 },
      { "externalId": "pr_024",                                     "label": "Admissibilité Q11: Sommé de quitter?",         "required": true,  "section": "Examen d'admissibilité du répondant", "page": 3, "order": 70 },
      { "externalId": "inDefaultOfImmigrationLoan",                 "label": "Admissibilité Q12: En retard emprunt immigration?", "required": true, "section": "Examen d'admissibilité du répondant", "page": 3, "order": 71 },
      { "externalId": "pr_028",                                     "label": "Admissibilité Q13: Détenu actuellement?",      "required": true,  "section": "Examen d'admissibilité du répondant", "page": 3, "order": 72 },
      { "externalId": "pr_020",                                     "label": "Admissibilité Q14: Coupable infraction?",      "required": true,  "section": "Examen d'admissibilité du répondant", "page": 3, "order": 73 },
      { "externalId": "inDefaultOfSupportOrder",                    "label": "Admissibilité Q15: Défaut pension alimentaire?", "required": false, "section": "Examen d'admissibilité du répondant", "page": 3, "order": 74 },
      { "externalId": "citizenshipRevocation",                      "label": "Admissibilité Q16: Révocation citoyenneté?",   "required": true,  "section": "Examen d'admissibilité du répondant", "page": 3, "order": 75 },
      { "externalId": "inadmissibilityReport",                      "label": "Admissibilité Q17: Interdiction territoire?",  "required": true,  "section": "Examen d'admissibilité du répondant", "page": 3, "order": 76 },
      { "externalId": "chargedSeriousOffence",                      "label": "Admissibilité Q18: Accusé 10+ ans?",           "required": true,  "section": "Examen d'admissibilité du répondant", "page": 3, "order": 77 },
      { "externalId": "admissibilityDetails",                       "label": "Admissibilité: Détails (textarea)",            "required": false, "section": "Examen d'admissibilité du répondant", "page": 3, "order": 78 },

      { "externalId": "cosignerLastName",                           "label": "Cosignataire Q1: Nom de famille",              "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 100 },
      { "externalId": "cosignerFirstName",                          "label": "Cosignataire Q1: Prénom",                      "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 101 },
      { "externalId": "cosignerHasOtherNames",                      "label": "Cosignataire Q2: Autre nom utilisé?",          "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 102 },
      { "externalId": "cosignerOtherNameLast",                      "label": "Cosignataire Q2: Autre nom famille",           "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 103 },
      { "externalId": "cosignerOtherNameFirst",                     "label": "Cosignataire Q2: Autre prénom",                "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 104 },
      { "externalId": "cosignerGender",                             "label": "Cosignataire Q3: Genre",                       "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 105 },
      { "externalId": "cosignerDateOfBirth",                        "label": "Cosignataire Q4: Date de naissance",           "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 106 },
      { "externalId": "cosignerBirthCity",                          "label": "Cosignataire Q5: Ville naissance",             "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 107 },
      { "externalId": "cosignerBirthCountry",                       "label": "Cosignataire Q5: Pays naissance",              "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 108 },
      { "externalId": "cosignerCanadianStatus",                     "label": "Cosignataire Q6: Statut au Canada",            "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 109 },
      { "externalId": "cosignerCanadianStatusObtainedDate",         "label": "Cosignataire Q7a: Date statut",                "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 110 },
      { "externalId": "cosignerIucNumber",                          "label": "Cosignataire Q7b: IUC",                        "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 111 },
      { "externalId": "cosignerNameOnPRSame",                       "label": "Cosignataire Q7c: Même nom à PR?",             "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 112 },
      { "externalId": "cosignerNameOnPRLastName",                   "label": "Cosignataire Q7c: Nom famille à PR",           "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 113 },
      { "externalId": "cosignerNameOnPRFirstName",                  "label": "Cosignataire Q7c: Prénom à PR",                "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 114 },
      { "externalId": "cosignerRelationshipToSponsor",              "label": "Cosignataire Q8a: Lien avec répondant",        "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 115 },
      { "externalId": "cosignerRelationshipToSponsorOther",         "label": "Cosignataire Q8b: Autre lien (précisez)",      "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 116 },
      { "externalId": "cosignerMaritalStatus",                      "label": "Cosignataire Q8c: État matrimonial actuel",    "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 117 },
      { "externalId": "cosignerMarriageDate",                       "label": "Cosignataire Q8d: Date mariage/union",         "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 118 },
      { "externalId": "cosignerSpouseLastName",                     "label": "Cosignataire Q8e: Nom famille époux actuel",   "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 119 },
      { "externalId": "cosignerSpouseFirstName",                    "label": "Cosignataire Q8e: Prénom époux actuel",        "required": false, "section": "Détails du cosignataire",       "page": 3, "order": 120 },
      { "externalId": "cosignerHasPreviousMarriage",                "label": "Cosignataire Q9: Déjà marié?",                 "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 121 },
      { "externalId": "cosignerExSpouseLastName",                   "label": "Cosignataire Q9: Nom famille ex-conjoint",     "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 122 },
      { "externalId": "cosignerExSpouseFirstName",                  "label": "Cosignataire Q9: Prénom ex-conjoint",          "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 123 },
      { "externalId": "cosignerExSpouseDob",                        "label": "Cosignataire Q9: DOB ex-conjoint",             "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 124 },
      { "externalId": "cosignerExSpouseUnionType",                  "label": "Cosignataire Q9: Type d'union",                "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 125 },
      { "externalId": "cosignerExSpouseUnionStartDate",             "label": "Cosignataire Q9: Du",                          "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 126 },
      { "externalId": "cosignerExSpouseUnionEndDate",               "label": "Cosignataire Q9: Au",                          "required": false, "section": "Détails du cosignataire",       "page": 4, "order": 127 },

      { "externalId": "cosignerPhone",                              "label": "Cosignataire — téléphone",                     "required": false, "section": "Coordonnées du cosignataire",   "page": 4, "order": 140 },
      { "externalId": "cosignerPhoneType",                          "label": "Cosignataire — type de téléphone",             "required": false, "section": "Coordonnées du cosignataire",   "page": 4, "order": 141 },
      { "externalId": "cosignerEmail",                              "label": "Cosignataire — adresse électronique",          "required": false, "section": "Coordonnées du cosignataire",   "page": 4, "order": 142 },

      { "externalId": "cosignerIsCanadianAbroad",                   "label": "Cosignataire — citoyen canadien hors Canada?", "required": false, "section": "Déclaration de résidence du cosignataire", "page": 4, "order": 150 },
      { "externalId": "cosignerIntendedProvince",                   "label": "Cosignataire — province d'installation",       "required": false, "section": "Déclaration de résidence du cosignataire", "page": 4, "order": 151 },

      { "externalId": "cosignerIsAdult",                            "label": "Cosignataire admissibilité Q1: 18+?",          "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 160 },
      { "externalId": "cosignerIsCanadianOrPR",                     "label": "Cosignataire admissibilité Q2: Citoyen ou RP?","required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 161 },
      { "externalId": "cosignerCanadaSoleResidence",                "label": "Cosignataire admissibilité Q3: Canada seul pays?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 162 },
      { "externalId": "cosignerOnSocialAssistance",                 "label": "Cosignataire admissibilité Q4: Aide sociale?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 163 },
      { "externalId": "cosignerIsUndischargedBankrupt",             "label": "Cosignataire admissibilité Q5: Failli non libéré?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 164 },
      { "externalId": "cosignerPriorSponsoredReceivedSocialAssistance", "label": "Cosignataire admissibilité Q6: Parrainage antérieur aide sociale?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 165 },
      { "externalId": "cosignerPriorCosignedReceivedSocialAssistance", "label": "Cosignataire admissibilité Q7: Cosigné engagement aide sociale?",   "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 166 },
      { "externalId": "cosignerOrderedToLeaveCanada",               "label": "Cosignataire admissibilité Q8: Sommé de quitter?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 167 },
      { "externalId": "cosignerInDefaultOfImmigrationLoan",         "label": "Cosignataire admissibilité Q9: Défaut emprunt immigration?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 168 },
      { "externalId": "cosignerCurrentlyDetained",                  "label": "Cosignataire admissibilité Q10: Détenu actuellement?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 169 },
      { "externalId": "cosignerConvictedOfSeriousOffence",          "label": "Cosignataire admissibilité Q11: Coupable infraction?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 170 },
      { "externalId": "cosignerInDefaultOfSupportOrder",            "label": "Cosignataire admissibilité Q12: Défaut pension alimentaire?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 171 },
      { "externalId": "cosignerCitizenshipRevocation",              "label": "Cosignataire admissibilité Q13: Révocation citoyenneté?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 172 },
      { "externalId": "cosignerInadmissibilityReport",              "label": "Cosignataire admissibilité Q14: Interdiction territoire?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 173 },
      { "externalId": "cosignerChargedSeriousOffence",              "label": "Cosignataire admissibilité Q15: Accusé 10+ ans?", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 4, "order": 174 },
      { "externalId": "cosignerAdmissibilityDetails",               "label": "Cosignataire admissibilité: Détails (textarea)", "required": false, "section": "Examen d'admissibilité du cosignataire", "page": 5, "order": 175 }
    ],
    "requiredDocuments": [
      { "key": "passportDocument",   "label": "Passeport du répondant",    "required": true },
      { "key": "marriageCertificate", "label": "Acte de mariage",           "required": false },
      { "key": "cosignerPassport",   "label": "Passeport du cosignataire", "required": false }
    ]
  }
}
JSON

(cd "$CONVEX_DIR" && npx convex run legalDocuments:setImmQuestions "$ARGS")
echo "[seed] immQuestions set on legalDocuments/$IMM1344_FR_ID (105 intake questions: 57 sponsor + 48 cosigner)"
