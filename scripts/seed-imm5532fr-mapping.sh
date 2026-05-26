#!/usr/bin/env bash
# IMM 5532 FR (Renseignements relatifs à la relation) intake mapping.
# 63 intake questions: 8 reused from the existing catalog (sponsor + sponsored
# basics, hasPreviousMarriage) + 55 added by seed-imm5532-catalog-gaps.sh.
#
# Includes 11 multi-entry tables: employmentHistory, otherSponsorships,
# financialDependents, addressHistory, sponsorPreviousRelationships,
# sponsoredPriorLinks, sponsoredRelativesInCanada,
# sponsoredPreviousRelationships, relationshipVisits,
# peopleAwareOfRelationship, relationshipCeremonies.
#
# Signatures (Partie A Q9, Partie B Q5, Partie C Q12-14) NOT mapped here —
# handled at the PDF-fill stage, same convention as IMM 1344.
#
# Catalog dependency: scripts/seed-imm5532-catalog-gaps.sh must have run first.
# Idempotent: overwrites the blob on re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMM5532_FR_ID="k57be84khbj9871av1t784azys86myab"

read -r -d '' ARGS <<'JSON' || true
{
  "legalDocumentId": "k57be84khbj9871av1t784azys86myab",
  "immQuestions": {
    "intakeQuestions": [
      { "externalId": "lastName",                              "label": "Renseignements personnels du répondant — Nom de famille",      "required": true,  "section": "Renseignements personnels du répondant",                                 "page": 1, "order": 1 },
      { "externalId": "firstName",                             "label": "Renseignements personnels du répondant — Prénom(s)",           "required": true,  "section": "Renseignements personnels du répondant",                                 "page": 1, "order": 2 },
      { "externalId": "dateOfBirth",                           "label": "Renseignements personnels du répondant — Date de naissance",   "required": true,  "section": "Renseignements personnels du répondant",                                 "page": 1, "order": 3 },
      { "externalId": "iucNumber",                             "label": "Renseignements personnels du répondant — UCI (si connu)",      "required": false, "section": "Renseignements personnels du répondant",                                 "page": 1, "order": 4 },

      { "externalId": "sponsoredLastName",                     "label": "Renseignements personnels du demandeur principal — Nom de famille","required": true,"section": "Renseignements personnels du demandeur principal",                       "page": 1, "order": 5 },
      { "externalId": "sponsoredFirstName",                    "label": "Renseignements personnels du demandeur principal — Prénom(s)", "required": false, "section": "Renseignements personnels du demandeur principal",                       "page": 1, "order": 6 },
      { "externalId": "sponsoredDateOfBirth",                  "label": "Renseignements personnels du demandeur principal — Date de naissance","required": true,"section": "Renseignements personnels du demandeur principal",                  "page": 1, "order": 7 },
      { "externalId": "sponsoredIucNumber",                    "label": "Renseignements personnels du demandeur principal — UCI (si connu)","required": false,"section": "Renseignements personnels du demandeur principal",                   "page": 1, "order": 8 },

      { "externalId": "employmentHistory",                     "label": "Partie A Q1: Antécédents professionnels du répondant",         "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 1, "order": 10 },
      { "externalId": "hasOtherSponsorships",                  "label": "Partie A Q2: Autres parrainages — actuels ou passés?",         "required": true,  "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 1, "order": 11 },
      { "externalId": "otherSponsorships",                     "label": "Partie A Q2: Autres parrainages — détails",                    "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 1, "order": 12 },

      { "externalId": "financialDependents",                   "label": "Partie A Q3: Autres personnes financièrement à charge",        "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 13 },
      { "externalId": "highestEducationLevel",                 "label": "Partie A Q4: Niveau de scolarité le plus élevé",               "required": true,  "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 14 },
      { "externalId": "yearsElementary",                       "label": "Partie A Q4: Années — élémentaire/primaire",                   "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 15 },
      { "externalId": "yearsSecondary",                        "label": "Partie A Q4: Années — secondaires",                            "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 16 },
      { "externalId": "yearsCollege",                          "label": "Partie A Q4: Années — collège/université",                     "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 17 },
      { "externalId": "yearsGraduate",                         "label": "Partie A Q4: Années — études supérieures",                     "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 18 },
      { "externalId": "addressHistory",                        "label": "Partie A Q5: Historique des adresses (5 dernières années)",    "required": true,  "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 19 },
      { "externalId": "livesInCanadaNow",                      "label": "Partie A Q6: Habitez-vous au Canada maintenant?",              "required": true,  "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 20 },
      { "externalId": "lastTimeLivedInCanada",                 "label": "Partie A Q6: Dernière fois vécu au Canada",                    "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 21 },
      { "externalId": "plannedReturnToCanada",                 "label": "Partie A Q6: Date prévue de retour au Canada",                 "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 22 },
      { "externalId": "intendedResidenceOnReturn",             "label": "Partie A Q6: Lieu prévu de résidence au retour",               "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 23 },
      { "externalId": "hasPreviousMarriage",                   "label": "Partie A Q7: Déjà marié ou en union de fait?",                 "required": true,  "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 24 },
      { "externalId": "sponsorPreviousRelationships",          "label": "Partie A Q7: Relations conjugales antérieures du répondant",   "required": false, "section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 2, "order": 25 },

      { "externalId": "sponsorConsentDisclosureFraud",         "label": "Partie A Q8: Consentement divulgation enquête mariage frauduleux","required": true,"section": "Partie A — Évaluation du parrainage et renseignements concernant le répondant","page": 3, "order": 26 },

      { "externalId": "sponsoredHadPriorLinkWithSponsor",      "label": "Partie B Q1: Lien antérieur avec le répondant?",               "required": true,  "section": "Partie B — Renseignements concernant le demandeur principal",            "page": 3, "order": 30 },
      { "externalId": "sponsoredPriorLinks",                   "label": "Partie B Q1: Liens antérieurs — détails",                      "required": false, "section": "Partie B — Renseignements concernant le demandeur principal",            "page": 3, "order": 31 },
      { "externalId": "sponsoredRelativesInCanada",            "label": "Partie B Q2: Parenté du demandeur principal au Canada",        "required": false, "section": "Partie B — Renseignements concernant le demandeur principal",            "page": 3, "order": 32 },
      { "externalId": "sponsoredHasPreviousMarriage",          "label": "Partie B Q3: Demandeur déjà marié ou en union de fait?",       "required": true,  "section": "Partie B — Renseignements concernant le demandeur principal",            "page": 3, "order": 33 },
      { "externalId": "sponsoredPreviousRelationships",        "label": "Partie B Q3: Relations conjugales antérieures du demandeur",   "required": false, "section": "Partie B — Renseignements concernant le demandeur principal",            "page": 3, "order": 34 },
      { "externalId": "sponsoredConsentDisclosureFraud",       "label": "Partie B Q4: Consentement divulgation enquête mariage frauduleux","required": true,"section": "Partie B — Renseignements concernant le demandeur principal",         "page": 4, "order": 35 },

      { "externalId": "firstMeetingDate",                      "label": "Partie C Q1: Date de la première rencontre en personne",       "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 40 },
      { "externalId": "firstMeetingPlace",                     "label": "Partie C Q1: Endroit de la première rencontre",                "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 41 },
      { "externalId": "firstMeetingCircumstances",             "label": "Partie C Q1: Circonstances de la première rencontre",          "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 42 },
      { "externalId": "wasIntroducedByThirdParty",             "label": "Partie C Q1: Présentés par quelqu'un?",                        "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 43 },
      { "externalId": "firstMeetingIntroducerName",            "label": "Partie C Q1: Qui a fait les présentations?",                   "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 44 },
      { "externalId": "hadPriorContactBeforeMeeting",          "label": "Partie C Q2: Contact avant la rencontre en personne?",         "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 45 },
      { "externalId": "priorContactDetails",                   "label": "Partie C Q2: Détails du premier contact",                      "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 46 },
      { "externalId": "currentlyLivingTogether",               "label": "Partie C Q3: Habitez-vous ensemble?",                          "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 47 },
      { "externalId": "cohabitationDetails",                   "label": "Partie C Q3: Détails sur la cohabitation",                     "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 48 },
      { "externalId": "hasVisitedDuringRelationship",          "label": "Partie C Q4: Visites en personne?",                            "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 49 },
      { "externalId": "noVisitsExplanation",                   "label": "Partie C Q4: Explication absence de visites",                  "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 50 },
      { "externalId": "relationshipVisits",                    "label": "Partie C Q4: Visites — détails",                               "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 5, "order": 51 },

      { "externalId": "communicationLanguages",                "label": "Partie C Q5: Langue(s) de communication",                      "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 52 },
      { "externalId": "communicationFrequencyAndMethods",      "label": "Partie C Q6: Fréquence et moyens de communication",            "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 53 },
      { "externalId": "othersAwareOfRelationship",             "label": "Partie C Q7: Famille/amis au courant de la relation?",         "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 54 },
      { "externalId": "othersAwareExplanation",                "label": "Partie C Q7: Explication si non au courant",                   "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 55 },
      { "externalId": "peopleAwareOfRelationship",             "label": "Partie C Q7: Personnes au courant — détails",                  "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 56 },
      { "externalId": "wasMarriageArranged",                   "label": "Partie C Q8: Mariage arrangé?",                                "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 57 },
      { "externalId": "arrangedMarriageDetails",               "label": "Partie C Q8: Détails de l'arrangement du mariage",             "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 58 },
      { "externalId": "hasOfficialCeremonies",                 "label": "Partie C Q9: Cérémonies/événements officiels organisés?",      "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 59 },
      { "externalId": "noOfficialCeremoniesExplanation",       "label": "Partie C Q9: Explication absence de cérémonies",               "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 6, "order": 60 },

      { "externalId": "relationshipCeremonies",                "label": "Partie C Q9: Cérémonies/événements — détails",                 "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 61 },
      { "externalId": "ceremoniesParentsOfApplicant",          "label": "Partie C Q9a: Parents du demandeur ont participé?",            "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 62 },
      { "externalId": "ceremoniesChildrenOfApplicant",         "label": "Partie C Q9b: Enfants du demandeur ont participé?",            "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 63 },
      { "externalId": "ceremoniesOtherRelativesOfApplicant",   "label": "Partie C Q9c: Autres membres famille du demandeur?",           "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 64 },
      { "externalId": "ceremoniesParentsOfSponsor",            "label": "Partie C Q9d: Parents du répondant ont participé?",            "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 65 },
      { "externalId": "ceremoniesChildrenOfSponsor",           "label": "Partie C Q9e: Enfants du répondant ont participé?",            "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 66 },
      { "externalId": "ceremoniesOtherRelativesOfSponsor",     "label": "Partie C Q9f: Autres membres famille du répondant?",           "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 67 },
      { "externalId": "ceremoniesAbsenceExplanation",          "label": "Partie C Q9: Explication absence de personnes",                "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 68 },
      { "externalId": "isCurrentlyPregnant",                   "label": "Partie C Q10: Grossesse en cours?",                            "required": true,  "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 69 },
      { "externalId": "pregnancyDueDate",                      "label": "Partie C Q10: Date prévue de l'accouchement",                  "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 70 },
      { "externalId": "additionalRelationshipInfo",            "label": "Partie C Q11: Autres renseignements à l'appui",                "required": false, "section": "Partie C — Renseignements concernant la relation",                       "page": 7, "order": 71 }
    ],
    "requiredDocuments": [
      { "key": "sponsoredPassport", "label": "Passeport de la personne parrainée", "required": true }
    ]
  }
}
JSON

(cd "$CONVEX_DIR" && npx convex run legalDocuments:setImmQuestions "$ARGS")
echo "[seed] immQuestions set on legalDocuments/$IMM5532_FR_ID (63 intake questions, 11 multi-entry tables)"
