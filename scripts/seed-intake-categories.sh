#!/usr/bin/env bash
# Tag every catalog question used by the IMM-indexed intake (IMM 5476 +
# 1344 + 5532) with a `category` + `categorySort`. `getIntakeForClient`
# then groups + sorts by category, overriding the per-IMM `section` with
# the canonical title from CATEGORY_ORDER (defined in convex/legalDocuments.ts).
#
# This decouples wizard section structure from IRCC PDF structure: identity
# questions live together regardless of which IMM declared them, etc.
#
# categorySort assigns positions 1..N within each bucket. Gaps (10, 20, 30)
# would be nicer for future inserts, but the seed pattern uses tight
# numbering for clarity — re-run after edits, the upsert is idempotent.
#
# Categories not yet present in the catalog (e.g. for future IMMs) just need
# their questions seeded with the right `category` key — no schema change.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "questions": [
    { "externalId": "sponsorIneligibilityChoice",                   "label": "Si vous êtes non admissible comme répondant, que voulez-vous faire ?", "type": "select", "category": "sponsorshipMeta", "categorySort": 1 },
    { "externalId": "correspondenceLanguage",                       "label": "Dans quelle langue préférez-vous correspondre avec IRCC ?", "type": "select", "category": "sponsorshipMeta", "categorySort": 2 },
    { "externalId": "hasCosigner",                                  "label": "Y a-t-il un cosignataire sur cette demande de parrainage ?", "type": "yes-no", "category": "sponsorshipMeta", "categorySort": 3 },

    { "externalId": "lastName",                                     "label": "Quel est votre nom de famille ?", "type": "text", "category": "sponsorIdentity", "categorySort": 1 },
    { "externalId": "firstName",                                    "label": "Quel est votre prénom ?", "type": "text", "category": "sponsorIdentity", "categorySort": 2 },
    { "externalId": "otherNames",                                   "label": "Avez-vous déjà utilisé un autre nom (surnom, nom de jeune fille, pseudonyme, etc.) ?", "type": "text", "category": "sponsorIdentity", "categorySort": 3 },
    { "externalId": "gender",                                       "label": "Quel est votre genre ?", "type": "select", "category": "sponsorIdentity", "categorySort": 4 },
    { "externalId": "dateOfBirth",                                  "label": "Quelle est votre date de naissance ?", "type": "date", "category": "sponsorIdentity", "categorySort": 5 },
    { "externalId": "birthCity",                                    "label": "Dans quelle ville êtes-vous né ?", "type": "text", "category": "sponsorIdentity", "categorySort": 6 },
    { "externalId": "birthCountry",                                 "label": "Dans quel pays êtes-vous né ?", "type": "select", "category": "sponsorIdentity", "categorySort": 7 },

    { "externalId": "canadianStatus",                               "label": "Quel est votre statut au Canada ?", "type": "select", "category": "sponsorStatus", "categorySort": 1 },
    { "externalId": "canadianStatusObtainedDate",                   "label": "À quelle date avez-vous obtenu ce statut ?", "type": "date", "category": "sponsorStatus", "categorySort": 2 },
    { "externalId": "iucNumber",                                    "label": "Quel est votre numéro IUC / ID client ?", "type": "text", "category": "sponsorStatus", "categorySort": 3 },
    { "externalId": "nameOnPRSame",                                 "label": "Aviez-vous le même nom complet lorsque vous êtes devenu résident permanent ?", "type": "yes-no", "category": "sponsorStatus", "categorySort": 4 },
    { "externalId": "nameOnPRLastName",                             "label": "Nom de famille au moment de devenir résident permanent", "type": "text", "category": "sponsorStatus", "categorySort": 5 },
    { "externalId": "nameOnPRFirstName",                            "label": "Prénom au moment de devenir résident permanent", "type": "text", "category": "sponsorStatus", "categorySort": 6 },

    { "externalId": "maritalStatus",                                "label": "Quel est votre état matrimonial actuel ?", "type": "select", "category": "sponsorFamily", "categorySort": 1 },
    { "externalId": "marriageDate",                                 "label": "Quelle est la date du mariage ou du début de l'union de fait ?", "type": "date", "category": "sponsorFamily", "categorySort": 2 },
    { "externalId": "spouseFullName",                               "label": "Quel est le nom complet de votre époux/conjoint de fait actuel ?", "type": "text", "category": "sponsorFamily", "categorySort": 3 },
    { "externalId": "hasPreviousMarriage",                          "label": "Avez-vous déjà été marié(e) ou vécu dans une union de fait ?", "type": "yes-no", "category": "sponsorFamily", "categorySort": 4 },
    { "externalId": "exSpouseName",                                 "label": "Nom de l'ex-conjoint", "type": "text", "category": "sponsorFamily", "categorySort": 5 },
    { "externalId": "exSpouseDob",                                  "label": "Date de naissance de l'ex-conjoint", "type": "date", "category": "sponsorFamily", "categorySort": 6 },
    { "externalId": "exSpouseUnionType",                            "label": "Type d'union avec l'ex-conjoint", "type": "select", "category": "sponsorFamily", "categorySort": 7 },
    { "externalId": "exSpouseUnionStartDate",                       "label": "Début de l'union précédente (Du)", "type": "date", "category": "sponsorFamily", "categorySort": 8 },
    { "externalId": "exSpouseUnionEndDate",                         "label": "Fin de l'union précédente (Au)", "type": "date", "category": "sponsorFamily", "categorySort": 9 },
    { "externalId": "sponsorPreviousRelationships",                 "label": "Relations conjugales antérieures du répondant", "type": "multi-entry", "category": "sponsorFamily", "categorySort": 10 },

    { "externalId": "postalAddress",                                "label": "Quelle est votre adresse postale actuelle ?", "type": "text", "category": "sponsorContact", "categorySort": 1 },
    { "externalId": "samePostalAddress",                            "label": "Votre adresse domiciliaire est-elle la même que votre adresse postale ?", "type": "yes-no", "category": "sponsorContact", "categorySort": 2 },
    { "externalId": "residenceAddress",                             "label": "Quelle est votre adresse domiciliaire ?", "type": "text", "category": "sponsorContact", "categorySort": 3 },
    { "externalId": "phone",                                        "label": "Quel est votre numéro de téléphone ?", "type": "text", "category": "sponsorContact", "categorySort": 4 },
    { "externalId": "phoneType",                                    "label": "Quel est le type de téléphone (résidence, travail, cellulaire) ?", "type": "select", "category": "sponsorContact", "categorySort": 5 },
    { "externalId": "email",                                        "label": "Quelle est votre adresse électronique ?", "type": "text", "category": "sponsorContact", "categorySort": 6 },

    { "externalId": "isCanadianAbroad",                             "label": "Êtes-vous un citoyen canadien résidant exclusivement à l'extérieur du Canada ?", "type": "yes-no", "category": "sponsorResidence", "categorySort": 1 },
    { "externalId": "intendedProvince",                             "label": "Une fois la résidence permanente accordée, dans quelle province comptez-vous vivre ?", "type": "select", "category": "sponsorResidence", "categorySort": 2 },
    { "externalId": "livesInCanadaNow",                             "label": "Habitez-vous au Canada maintenant ?", "type": "yes-no", "category": "sponsorResidence", "categorySort": 3 },
    { "externalId": "lastTimeLivedInCanada",                        "label": "Quand avez-vous vécu au Canada la dernière fois ?", "type": "text", "category": "sponsorResidence", "categorySort": 4 },
    { "externalId": "plannedReturnToCanada",                        "label": "Quand comptez-vous revenir vivre au Canada de façon permanente ?", "type": "text", "category": "sponsorResidence", "categorySort": 5 },
    { "externalId": "intendedResidenceOnReturn",                    "label": "Où avez-vous l'intention de vivre lorsque vous reviendrez au Canada ?", "type": "text", "category": "sponsorResidence", "categorySort": 6 },

    { "externalId": "employmentHistory",                            "label": "Antécédents professionnels du répondant", "type": "multi-entry", "category": "sponsorHistory", "categorySort": 1 },
    { "externalId": "highestEducationLevel",                        "label": "Quel est le niveau de scolarité le plus élevé que vous avez atteint ?", "type": "select", "category": "sponsorHistory", "categorySort": 2 },
    { "externalId": "yearsElementary",                              "label": "École élémentaire / primaire — années terminées", "type": "text", "category": "sponsorHistory", "categorySort": 3 },
    { "externalId": "yearsSecondary",                               "label": "Études secondaires — années terminées", "type": "text", "category": "sponsorHistory", "categorySort": 4 },
    { "externalId": "yearsCollege",                                 "label": "Collège / Université — années terminées", "type": "text", "category": "sponsorHistory", "categorySort": 5 },
    { "externalId": "yearsGraduate",                                "label": "Études supérieures — années terminées", "type": "text", "category": "sponsorHistory", "categorySort": 6 },
    { "externalId": "addressHistory",                               "label": "Historique des adresses des 5 dernières années", "type": "multi-entry", "category": "sponsorHistory", "categorySort": 7 },
    { "externalId": "hasOtherSponsorships",                         "label": "Avez-vous parrainé, dans le passé, ou parrainez-vous actuellement d'autres membres de votre famille ?", "type": "yes-no", "category": "sponsorHistory", "categorySort": 8 },
    { "externalId": "otherSponsorships",                            "label": "Autres parrainages — détails", "type": "multi-entry", "category": "sponsorHistory", "categorySort": 9 },
    { "externalId": "financialDependents",                          "label": "Autres personnes financièrement à votre charge", "type": "multi-entry", "category": "sponsorHistory", "categorySort": 10 },

    { "externalId": "isAdult",                                      "label": "Êtes-vous âgé d'au moins 18 ans ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 1 },
    { "externalId": "isCanadianOrPR",                               "label": "Êtes-vous citoyen canadien ou résident permanent du Canada ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 2 },
    { "externalId": "sponsoringFamilyCategory",                     "label": "Parrainez-vous un membre de la catégorie du regroupement familial (époux/conjoint de fait au Canada) ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 3 },
    { "externalId": "canadaSoleResidence",                          "label": "Le Canada est-il votre seul pays de résidence ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 4 },
    { "externalId": "becamePRViaSponsorship5y",                     "label": "Dans les 5 années précédentes, êtes-vous devenu résident permanent après avoir été parrainé comme époux, conjoint de fait ou partenaire conjugal ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 5 },
    { "externalId": "priorPendingApplication",                      "label": "Avez-vous soumis une demande antérieure pour la personne parrainée pour laquelle une décision finale n'a pas été prise ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 6 },
    { "externalId": "onSocialAssistance",                           "label": "Êtes-vous bénéficiaire d'assistance sociale (autrement que pour cause d'invalidité) ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 7 },
    { "externalId": "isUndischargedBankrupt",                       "label": "Êtes-vous un failli non libéré aux termes de la Loi sur la faillite et l'insolvabilité ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 8 },
    { "externalId": "priorSponsoredReceivedSocialAssistance",       "label": "Une personne que vous avez déjà parrainée (ou sa famille) a-t-elle reçu de l'aide sociale pendant la validité de l'engagement ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 9 },
    { "externalId": "priorCosignedReceivedSocialAssistance",        "label": "Avez-vous déjà cosigné un engagement où la personne (ou sa famille) a reçu de l'aide sociale pendant la validité ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 10 },
    { "externalId": "pr_024",                                       "label": "Avez-vous été sommé de quitter le Canada ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 11 },
    { "externalId": "inDefaultOfImmigrationLoan",                   "label": "Êtes-vous en retard pour le remboursement d'un emprunt d'immigration ou autre montant dû en vertu de la législation canadienne ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 12 },
    { "externalId": "pr_028",                                       "label": "Êtes-vous actuellement détenu dans un pénitencier, une prison ou une maison de correction ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 13 },
    { "externalId": "pr_020",                                       "label": "Avez-vous déjà été déclaré coupable d'une infraction sexuelle, grave avec violence, ou causant des lésions corporelles ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 14 },
    { "externalId": "inDefaultOfSupportOrder",                      "label": "Êtes-vous en défaut d'une ordonnance de pension alimentaire ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 15 },
    { "externalId": "citizenshipRevocation",                        "label": "Faites-vous l'objet d'une demande de révocation de votre citoyenneté canadienne ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 16 },
    { "externalId": "inadmissibilityReport",                        "label": "Faites-vous l'objet d'un rapport d'interdiction de territoire ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 17 },
    { "externalId": "chargedSeriousOffence",                        "label": "Avez-vous été accusé d'une infraction à une loi fédérale punissable d'au moins 10 ans d'emprisonnement ?", "type": "yes-no", "category": "sponsorAdmissibility", "categorySort": 18 },
    { "externalId": "admissibilityDetails",                         "label": "Si vous avez répondu Oui à une question d'admissibilité, donnez les détails (date et lieu).", "type": "textarea", "category": "sponsorAdmissibility", "categorySort": 19 },

    { "externalId": "cosignerLastName",                             "label": "Cosignataire — nom de famille", "type": "text", "category": "cosignerIdentity", "categorySort": 1 },
    { "externalId": "cosignerFirstName",                            "label": "Cosignataire — prénom(s)", "type": "text", "category": "cosignerIdentity", "categorySort": 2 },
    { "externalId": "cosignerHasOtherNames",                        "label": "Le cosignataire a-t-il déjà utilisé un autre nom ?", "type": "yes-no", "category": "cosignerIdentity", "categorySort": 3 },
    { "externalId": "cosignerOtherNameLast",                        "label": "Cosignataire — autre nom de famille", "type": "text", "category": "cosignerIdentity", "categorySort": 4 },
    { "externalId": "cosignerOtherNameFirst",                       "label": "Cosignataire — autre prénom", "type": "text", "category": "cosignerIdentity", "categorySort": 5 },
    { "externalId": "cosignerGender",                               "label": "Cosignataire — genre", "type": "select", "category": "cosignerIdentity", "categorySort": 6 },
    { "externalId": "cosignerDateOfBirth",                          "label": "Cosignataire — date de naissance", "type": "date", "category": "cosignerIdentity", "categorySort": 7 },
    { "externalId": "cosignerBirthCity",                            "label": "Cosignataire — ville de naissance", "type": "text", "category": "cosignerIdentity", "categorySort": 8 },
    { "externalId": "cosignerBirthCountry",                         "label": "Cosignataire — pays de naissance", "type": "text", "category": "cosignerIdentity", "categorySort": 9 },

    { "externalId": "cosignerCanadianStatus",                       "label": "Cosignataire — statut au Canada", "type": "select", "category": "cosignerStatus", "categorySort": 1 },
    { "externalId": "cosignerCanadianStatusObtainedDate",           "label": "Cosignataire — date d'obtention du statut", "type": "date", "category": "cosignerStatus", "categorySort": 2 },
    { "externalId": "cosignerIucNumber",                            "label": "Cosignataire — numéro IUC / ID client", "type": "text", "category": "cosignerStatus", "categorySort": 3 },
    { "externalId": "cosignerNameOnPRSame",                         "label": "Cosignataire — aviez-vous le même nom complet lors de la PR ?", "type": "yes-no", "category": "cosignerStatus", "categorySort": 4 },
    { "externalId": "cosignerNameOnPRLastName",                     "label": "Cosignataire — nom de famille à la PR", "type": "text", "category": "cosignerStatus", "categorySort": 5 },
    { "externalId": "cosignerNameOnPRFirstName",                    "label": "Cosignataire — prénom à la PR", "type": "text", "category": "cosignerStatus", "categorySort": 6 },

    { "externalId": "cosignerRelationshipToSponsor",                "label": "Cosignataire — lien avec le répondant", "type": "select", "category": "cosignerFamily", "categorySort": 1 },
    { "externalId": "cosignerRelationshipToSponsorOther",           "label": "Cosignataire — précisez le lien (si Autre)", "type": "text", "category": "cosignerFamily", "categorySort": 2 },
    { "externalId": "cosignerMaritalStatus",                        "label": "Cosignataire — état matrimonial actuel", "type": "select", "category": "cosignerFamily", "categorySort": 3 },
    { "externalId": "cosignerMarriageDate",                         "label": "Cosignataire — date du mariage ou du début de l'union de fait", "type": "date", "category": "cosignerFamily", "categorySort": 4 },
    { "externalId": "cosignerSpouseLastName",                       "label": "Cosignataire — nom de famille de l'époux/conjoint de fait actuel", "type": "text", "category": "cosignerFamily", "categorySort": 5 },
    { "externalId": "cosignerSpouseFirstName",                      "label": "Cosignataire — prénom de l'époux/conjoint de fait actuel", "type": "text", "category": "cosignerFamily", "categorySort": 6 },
    { "externalId": "cosignerHasPreviousMarriage",                  "label": "Cosignataire — déjà marié(e) ou en union de fait auparavant ?", "type": "yes-no", "category": "cosignerFamily", "categorySort": 7 },
    { "externalId": "cosignerExSpouseLastName",                     "label": "Cosignataire — nom de l'ex-conjoint", "type": "text", "category": "cosignerFamily", "categorySort": 8 },
    { "externalId": "cosignerExSpouseFirstName",                    "label": "Cosignataire — prénom de l'ex-conjoint", "type": "text", "category": "cosignerFamily", "categorySort": 9 },
    { "externalId": "cosignerExSpouseDob",                          "label": "Cosignataire — date de naissance de l'ex-conjoint", "type": "date", "category": "cosignerFamily", "categorySort": 10 },
    { "externalId": "cosignerExSpouseUnionType",                    "label": "Cosignataire — type d'union précédente", "type": "select", "category": "cosignerFamily", "categorySort": 11 },
    { "externalId": "cosignerExSpouseUnionStartDate",               "label": "Cosignataire — début de l'union précédente (Du)", "type": "date", "category": "cosignerFamily", "categorySort": 12 },
    { "externalId": "cosignerExSpouseUnionEndDate",                 "label": "Cosignataire — fin de l'union précédente (Au)", "type": "date", "category": "cosignerFamily", "categorySort": 13 },

    { "externalId": "cosignerPhone",                                "label": "Cosignataire — numéro de téléphone", "type": "text", "category": "cosignerContact", "categorySort": 1 },
    { "externalId": "cosignerPhoneType",                            "label": "Cosignataire — type de téléphone", "type": "select", "category": "cosignerContact", "categorySort": 2 },
    { "externalId": "cosignerEmail",                                "label": "Cosignataire — adresse électronique", "type": "text", "category": "cosignerContact", "categorySort": 3 },

    { "externalId": "cosignerIsCanadianAbroad",                     "label": "Cosignataire — êtes-vous un citoyen canadien résidant exclusivement hors Canada ?", "type": "yes-no", "category": "cosignerResidence", "categorySort": 1 },
    { "externalId": "cosignerIntendedProvince",                     "label": "Cosignataire — province où vous comptez vivre après l'obtention de la RP", "type": "select", "category": "cosignerResidence", "categorySort": 2 },

    { "externalId": "cosignerIsAdult",                              "label": "Cosignataire — êtes-vous âgé d'au moins 18 ans ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 1 },
    { "externalId": "cosignerIsCanadianOrPR",                       "label": "Cosignataire — êtes-vous citoyen canadien ou résident permanent ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 2 },
    { "externalId": "cosignerCanadaSoleResidence",                  "label": "Cosignataire — le Canada est-il votre seul pays de résidence ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 3 },
    { "externalId": "cosignerOnSocialAssistance",                   "label": "Cosignataire — êtes-vous bénéficiaire d'assistance sociale (sauf invalidité) ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 4 },
    { "externalId": "cosignerIsUndischargedBankrupt",               "label": "Cosignataire — êtes-vous un failli non libéré ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 5 },
    { "externalId": "cosignerPriorSponsoredReceivedSocialAssistance", "label": "Cosignataire — une personne déjà parrainée a-t-elle reçu de l'aide sociale pendant la validité de l'engagement ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 6 },
    { "externalId": "cosignerPriorCosignedReceivedSocialAssistance",  "label": "Cosignataire — avez-vous déjà cosigné un engagement où la personne a reçu de l'aide sociale ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 7 },
    { "externalId": "cosignerOrderedToLeaveCanada",                 "label": "Cosignataire — avez-vous été sommé de quitter le Canada ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 8 },
    { "externalId": "cosignerInDefaultOfImmigrationLoan",           "label": "Cosignataire — êtes-vous en retard pour le remboursement d'un emprunt d'immigration ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 9 },
    { "externalId": "cosignerCurrentlyDetained",                    "label": "Cosignataire — êtes-vous actuellement détenu ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 10 },
    { "externalId": "cosignerConvictedOfSeriousOffence",            "label": "Cosignataire — avez-vous été déclaré coupable d'une infraction sexuelle, grave avec violence ou causant des lésions corporelles ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 11 },
    { "externalId": "cosignerInDefaultOfSupportOrder",              "label": "Cosignataire — êtes-vous en défaut d'une ordonnance de pension alimentaire ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 12 },
    { "externalId": "cosignerCitizenshipRevocation",                "label": "Cosignataire — faites-vous l'objet d'une demande de révocation de citoyenneté ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 13 },
    { "externalId": "cosignerInadmissibilityReport",                "label": "Cosignataire — faites-vous l'objet d'un rapport d'interdiction de territoire ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 14 },
    { "externalId": "cosignerChargedSeriousOffence",                "label": "Cosignataire — avez-vous été accusé d'une infraction à une loi fédérale punissable d'au moins 10 ans d'emprisonnement ?", "type": "yes-no", "category": "cosignerAdmissibility", "categorySort": 15 },
    { "externalId": "cosignerAdmissibilityDetails",                 "label": "Cosignataire — si vous avez répondu Oui à une question d'admissibilité, donnez les détails.", "type": "textarea", "category": "cosignerAdmissibility", "categorySort": 16 },

    { "externalId": "sponsoredLastName",                            "label": "Quel est le nom de famille de la personne parrainée ?", "type": "text", "category": "sponsoredIdentity", "categorySort": 1 },
    { "externalId": "sponsoredFirstName",                           "label": "Quel est le prénom de la personne parrainée ?", "type": "text", "category": "sponsoredIdentity", "categorySort": 2 },
    { "externalId": "sponsoredDateOfBirth",                         "label": "Quelle est la date de naissance de la personne parrainée ?", "type": "date", "category": "sponsoredIdentity", "categorySort": 3 },
    { "externalId": "sponsoredIucNumber",                           "label": "Quel est l'IUC / ID client de la personne parrainée ?", "type": "text", "category": "sponsoredIdentity", "categorySort": 4 },

    { "externalId": "sponsoredHasPreviousMarriage",                 "label": "La personne parrainée a-t-elle déjà été mariée ou vécu dans une union de fait auparavant ?", "type": "yes-no", "category": "sponsoredFamily", "categorySort": 1 },
    { "externalId": "sponsoredPreviousRelationships",               "label": "Relations conjugales antérieures de la personne parrainée", "type": "multi-entry", "category": "sponsoredFamily", "categorySort": 2 },

    { "externalId": "sponsoredHadPriorLinkWithSponsor",             "label": "Avant la relation actuelle, la personne parrainée avait-elle un lien quelconque avec le répondant ?", "type": "yes-no", "category": "sponsoredHistory", "categorySort": 1 },
    { "externalId": "sponsoredPriorLinks",                          "label": "Liens antérieurs entre la personne parrainée et le répondant", "type": "multi-entry", "category": "sponsoredHistory", "categorySort": 2 },
    { "externalId": "sponsoredRelativesInCanada",                   "label": "Parenté de la personne parrainée qui vit au Canada", "type": "multi-entry", "category": "sponsoredHistory", "categorySort": 3 },

    { "externalId": "sponsoredRelationship",                        "label": "Quel est votre lien avec la personne parrainée ?", "type": "select", "category": "relationshipNarrative", "categorySort": 1 },
    { "externalId": "sponsoredRelationshipOther",                   "label": "Précisez le lien (si Autre)", "type": "text", "category": "relationshipNarrative", "categorySort": 2 },
    { "externalId": "relationshipStartDate",                        "label": "Quelle est la date du début de votre relation conjugale ?", "type": "date", "category": "relationshipNarrative", "categorySort": 3 },
    { "externalId": "firstMeetingDate",                             "label": "Quand vous êtes-vous rencontrés en personne pour la première fois ?", "type": "date", "category": "relationshipNarrative", "categorySort": 4 },
    { "externalId": "firstMeetingPlace",                            "label": "Où vous êtes-vous rencontrés en personne pour la première fois ?", "type": "text", "category": "relationshipNarrative", "categorySort": 5 },
    { "externalId": "firstMeetingCircumstances",                    "label": "Décrivez les circonstances de votre première rencontre.", "type": "textarea", "category": "relationshipNarrative", "categorySort": 6 },
    { "externalId": "wasIntroducedByThirdParty",                    "label": "Quelqu'un vous a-t-il présentés l'un à l'autre ?", "type": "yes-no", "category": "relationshipNarrative", "categorySort": 7 },
    { "externalId": "firstMeetingIntroducerName",                   "label": "Qui a fait les présentations ?", "type": "text", "category": "relationshipNarrative", "categorySort": 8 },
    { "externalId": "hadPriorContactBeforeMeeting",                 "label": "Avez-vous été en contact avant de vous rencontrer en personne ?", "type": "yes-no", "category": "relationshipNarrative", "categorySort": 9 },
    { "externalId": "priorContactDetails",                          "label": "Donnez des détails sur ce premier contact (qui a initié, quand, par quel moyen).", "type": "textarea", "category": "relationshipNarrative", "categorySort": 10 },
    { "externalId": "currentlyLivingTogether",                      "label": "Habitez-vous ensemble actuellement ?", "type": "yes-no", "category": "relationshipNarrative", "categorySort": 11 },
    { "externalId": "cohabitationDetails",                          "label": "Détails sur la cohabitation — depuis combien de temps, ou pourquoi pas.", "type": "textarea", "category": "relationshipNarrative", "categorySort": 12 },
    { "externalId": "hasVisitedDuringRelationship",                 "label": "Si vous ne vivez pas ensemble, vous êtes-vous rendu visite pendant votre relation ?", "type": "yes-no", "category": "relationshipNarrative", "categorySort": 13 },
    { "externalId": "noVisitsExplanation",                          "label": "Si vous ne vous êtes pas rendu visite, expliquez pourquoi.", "type": "textarea", "category": "relationshipNarrative", "categorySort": 14 },
    { "externalId": "relationshipVisits",                           "label": "Visites en personne pendant la relation", "type": "multi-entry", "category": "relationshipNarrative", "categorySort": 15 },
    { "externalId": "communicationLanguages",                       "label": "Quelle(s) langue(s) utilisez-vous pour communiquer ensemble ?", "type": "textarea", "category": "relationshipNarrative", "categorySort": 16 },
    { "externalId": "communicationFrequencyAndMethods",             "label": "À quelle fréquence communiquez-vous quand vous n'êtes pas ensemble, et de quelle façon ?", "type": "textarea", "category": "relationshipNarrative", "categorySort": 17 },

    { "externalId": "othersAwareOfRelationship",                    "label": "Vos amis proches, votre famille et vos enfants sont-ils au courant de votre relation ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 1 },
    { "externalId": "othersAwareExplanation",                       "label": "Si non, expliquez pourquoi.", "type": "textarea", "category": "relationshipEvidence", "categorySort": 2 },
    { "externalId": "peopleAwareOfRelationship",                    "label": "Personnes au courant de votre relation", "type": "multi-entry", "category": "relationshipEvidence", "categorySort": 3 },
    { "externalId": "wasMarriageArranged",                          "label": "Votre mariage a-t-il été arrangé ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 4 },
    { "externalId": "arrangedMarriageDetails",                      "label": "Décrivez comment le mariage a été arrangé.", "type": "textarea", "category": "relationshipEvidence", "categorySort": 5 },
    { "externalId": "hasOfficialCeremonies",                        "label": "Des cérémonies ou des événements officiels ont-ils été organisés pour célébrer votre union ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 6 },
    { "externalId": "noOfficialCeremoniesExplanation",              "label": "Si non, expliquez pourquoi.", "type": "textarea", "category": "relationshipEvidence", "categorySort": 7 },
    { "externalId": "relationshipCeremonies",                       "label": "Cérémonies / événements officiels organisés", "type": "multi-entry", "category": "relationshipEvidence", "categorySort": 8 },
    { "externalId": "ceremoniesParentsOfApplicant",                 "label": "Les parents de la personne parrainée ont-ils participé à l'un des événements ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 9 },
    { "externalId": "ceremoniesChildrenOfApplicant",                "label": "Les enfants de la personne parrainée ont-ils participé ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 10 },
    { "externalId": "ceremoniesOtherRelativesOfApplicant",          "label": "D'autres membres de la famille de la personne parrainée ont-ils participé ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 11 },
    { "externalId": "ceremoniesParentsOfSponsor",                   "label": "Les parents du répondant ont-ils participé ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 12 },
    { "externalId": "ceremoniesChildrenOfSponsor",                  "label": "Les enfants du répondant ont-ils participé ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 13 },
    { "externalId": "ceremoniesOtherRelativesOfSponsor",            "label": "D'autres membres de la famille du répondant ont-ils participé ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 14 },
    { "externalId": "ceremoniesAbsenceExplanation",                 "label": "Si l'une des personnes mentionnées n'a pas participé, expliquez pourquoi.", "type": "textarea", "category": "relationshipEvidence", "categorySort": 15 },
    { "externalId": "isCurrentlyPregnant",                          "label": "Êtes-vous enceinte ou votre conjointe est-elle enceinte ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 16 },
    { "externalId": "pregnancyDueDate",                             "label": "Quelle est la date prévue de l'accouchement ?", "type": "date", "category": "relationshipEvidence", "categorySort": 17 },
    { "externalId": "additionalRelationshipInfo",                   "label": "Y a-t-il d'autres renseignements que vous aimeriez ajouter à l'appui de votre relation ?", "type": "textarea", "category": "relationshipEvidence", "categorySort": 18 },
    { "externalId": "sponsorConsentDisclosureFraud",                "label": "Consentez-vous à ce qu'IRCC / ASFC divulguent les résultats d'une enquête sur un mariage frauduleux à votre époux ou conjoint ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 19 },
    { "externalId": "sponsoredConsentDisclosureFraud",              "label": "Personne parrainée — consentez-vous à ce qu'IRCC / ASFC divulguent les résultats d'une enquête sur un mariage frauduleux à votre répondant ?", "type": "yes-no", "category": "relationshipEvidence", "categorySort": 20 }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run questions:seedCanonicalQuestions "$ARGS")
echo "[seed] category + categorySort tagged on all intake catalog questions"
