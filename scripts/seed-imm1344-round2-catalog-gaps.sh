#!/usr/bin/env bash
# Round 2 catalog additions for IMM 1344 — fills two gaps:
#  (1) Sponsor admissibility questions the round 1 mapping missed
#      (isAdult Q1, isCanadianOrPR Q2, priorSponsoredReceivedSocialAssistance
#      Q9, priorCosignedReceivedSocialAssistance Q10, inDefaultOfImmigrationLoan
#      Q12, inDefaultOfSupportOrder Q15) + the page-1 sponsorIneligibilityChoice
#      that comes BEFORE the rest of the form. 7 new sponsor questions.
#  (2) The full cosignataire section (Détails + Coordonnées + Déclaration
#      de résidence + Examen de l'admissibilité Q1-Q15 + admissibility
#      details textarea). 49 new cosigner-prefixed questions.
#
# Cosigner shares the sponsor's postal/residence address per IRCC form
# convention (no separate address fields). Cosigner phone-2 + fax skipped
# for consistency with the sponsor mapping (only phone-1 + email captured).
#
# Idempotent: upserts by externalId.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "questions": [
    {
      "externalId": "sponsorIneligibilityChoice",
      "label": "Si vous êtes non admissible comme répondant, que voulez-vous faire ?",
      "type": "select",
      "isRequired": false,
      "indication": "Vous ne devez répondre que si vous êtes non admissible. Sinon, laissez vide.",
      "options": [
        "Retirer mon parrainage — tous les frais de traitement moins les frais de parrainage seront remboursés.",
        "Poursuivre avec le traitement de la demande de résidence permanente — tous les droits de traitement seront retenus."
      ]
    },
    {
      "externalId": "isAdult",
      "label": "Êtes-vous âgé d'au moins 18 ans ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "isCanadianOrPR",
      "label": "Êtes-vous citoyen canadien ou résident permanent du Canada ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "priorSponsoredReceivedSocialAssistance",
      "label": "Une personne que vous avez déjà parrainée (ou les membres de sa famille) ont-ils reçu de l'aide sociale durant la durée de validité de l'engagement ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "priorCosignedReceivedSocialAssistance",
      "label": "Avez-vous déjà cosigné un engagement d'aide en faveur d'une personne ou des membres de sa famille qui ont reçu de l'aide sociale durant la durée de validité de l'engagement ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "inDefaultOfImmigrationLoan",
      "label": "Êtes-vous en retard pour le remboursement d'un emprunt d'immigration, d'une garantie de bonne exécution ou de tout autre montant que vous vous êtes engagé à payer en vertu de la législation canadienne en matière d'immigration, sans avoir pris de dispositions pour reporter les versements ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "inDefaultOfSupportOrder",
      "label": "Êtes-vous en défaut d'une ordonnance de la cour vous ordonnant de payer une pension alimentaire à votre époux, ex-époux, conjoint de fait, ex-conjoint de fait ou enfant ?",
      "type": "yes-no",
      "isRequired": false
    },

    {
      "externalId": "cosignerLastName",
      "label": "Cosignataire — nom de famille",
      "type": "text",
      "isRequired": false,
      "indication": "Exactement tel qu'indiqué sur le passeport ou titre de voyage du cosignataire."
    },
    {
      "externalId": "cosignerFirstName",
      "label": "Cosignataire — prénom(s)",
      "type": "text",
      "isRequired": false,
      "indication": "Exactement tel qu'indiqué sur le passeport ou titre de voyage du cosignataire."
    },
    {
      "externalId": "cosignerHasOtherNames",
      "label": "Le cosignataire a-t-il déjà utilisé un autre nom (surnom, nom de jeune fille, pseudonyme, etc.) ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerOtherNameLast",
      "label": "Cosignataire — autre nom de famille utilisé",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerOtherNameFirst",
      "label": "Cosignataire — autre prénom utilisé",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerGender",
      "label": "Cosignataire — genre",
      "type": "select",
      "isRequired": false,
      "options": ["Homme", "Femme", "Autre"]
    },
    {
      "externalId": "cosignerDateOfBirth",
      "label": "Cosignataire — date de naissance",
      "type": "date",
      "isRequired": false
    },
    {
      "externalId": "cosignerBirthCity",
      "label": "Cosignataire — ville/village de naissance",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerBirthCountry",
      "label": "Cosignataire — pays de naissance",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerCanadianStatus",
      "label": "Cosignataire — statut au Canada",
      "type": "select",
      "isRequired": false,
      "options": [
        "Citoyen canadien né au Canada",
        "Citoyen canadien naturalisé",
        "Résident permanent",
        "Indien inscrit au sens de la Loi sur les Indiens"
      ]
    },
    {
      "externalId": "cosignerCanadianStatusObtainedDate",
      "label": "Cosignataire — date d'obtention du statut",
      "type": "date",
      "isRequired": false,
      "indication": "Pour les résidents permanents et citoyens naturalisés, indiquez la date la plus récente."
    },
    {
      "externalId": "cosignerIucNumber",
      "label": "Cosignataire — IUC / ID client",
      "type": "text",
      "isRequired": false,
      "indication": "À remplir si résident permanent ou citoyen naturalisé."
    },
    {
      "externalId": "cosignerNameOnPRSame",
      "label": "Cosignataire — aviez-vous le même nom complet lorsque vous êtes devenu résident permanent ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerNameOnPRLastName",
      "label": "Cosignataire — nom de famille au moment de devenir résident permanent",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerNameOnPRFirstName",
      "label": "Cosignataire — prénom au moment de devenir résident permanent",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerRelationshipToSponsor",
      "label": "Cosignataire — lien avec le répondant",
      "type": "select",
      "isRequired": false,
      "indication": "Le cosignataire doit être l'époux ou conjoint de fait du répondant.",
      "options": ["Époux/épouse", "Conjoint(e) de fait", "Partenaire conjugal(e)", "Autre"]
    },
    {
      "externalId": "cosignerRelationshipToSponsorOther",
      "label": "Cosignataire — précisez le lien (si \"Autre\")",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerMaritalStatus",
      "label": "Cosignataire — état matrimonial actuel",
      "type": "select",
      "isRequired": false,
      "options": [
        "Célibataire",
        "Marié(e)",
        "Conjoint(e) de fait",
        "Divorcé(e)",
        "Séparé(e)",
        "Veuf/veuve",
        "Mariage annulé"
      ]
    },
    {
      "externalId": "cosignerMarriageDate",
      "label": "Cosignataire — date du mariage ou du début de l'union de fait",
      "type": "date",
      "isRequired": false
    },
    {
      "externalId": "cosignerSpouseLastName",
      "label": "Cosignataire — nom de famille de l'époux/conjoint de fait actuel",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerSpouseFirstName",
      "label": "Cosignataire — prénom de l'époux/conjoint de fait actuel",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerHasPreviousMarriage",
      "label": "Cosignataire — déjà marié(e) ou vécu dans une union de fait auparavant ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerExSpouseLastName",
      "label": "Cosignataire — nom de famille de l'ex-conjoint",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerExSpouseFirstName",
      "label": "Cosignataire — prénom de l'ex-conjoint",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerExSpouseDob",
      "label": "Cosignataire — date de naissance de l'ex-conjoint",
      "type": "date",
      "isRequired": false
    },
    {
      "externalId": "cosignerExSpouseUnionType",
      "label": "Cosignataire — type d'union avec l'ex-conjoint",
      "type": "select",
      "isRequired": false,
      "options": ["Mariage", "Union de fait", "Partenariat conjugal"]
    },
    {
      "externalId": "cosignerExSpouseUnionStartDate",
      "label": "Cosignataire — début de l'union précédente (Du)",
      "type": "date",
      "isRequired": false
    },
    {
      "externalId": "cosignerExSpouseUnionEndDate",
      "label": "Cosignataire — fin de l'union précédente (Au)",
      "type": "date",
      "isRequired": false
    },
    {
      "externalId": "cosignerPhone",
      "label": "Cosignataire — numéro de téléphone",
      "type": "text",
      "isRequired": false,
      "indication": "Incluez code pays + numéro complet."
    },
    {
      "externalId": "cosignerPhoneType",
      "label": "Cosignataire — type de téléphone",
      "type": "select",
      "isRequired": false,
      "options": ["Résidence", "Travail", "Cellulaire"]
    },
    {
      "externalId": "cosignerEmail",
      "label": "Cosignataire — adresse électronique",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "cosignerIsCanadianAbroad",
      "label": "Cosignataire — êtes-vous un citoyen canadien résidant exclusivement à l'extérieur du Canada ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerIntendedProvince",
      "label": "Cosignataire — province où vous comptez vivre une fois que vos enfants seront devenus résidents permanents",
      "type": "select",
      "isRequired": false,
      "options": [
        "Dans une province ou un territoire du Canada autre que le Québec",
        "Dans la province de Québec"
      ]
    },
    {
      "externalId": "cosignerIsAdult",
      "label": "Cosignataire — êtes-vous âgé d'au moins 18 ans ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerIsCanadianOrPR",
      "label": "Cosignataire — êtes-vous citoyen canadien ou résident permanent du Canada ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerCanadaSoleResidence",
      "label": "Cosignataire — le Canada est-il votre seul pays de résidence ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerOnSocialAssistance",
      "label": "Cosignataire — êtes-vous bénéficiaire d'assistance sociale autrement que pour cause d'invalidité ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerIsUndischargedBankrupt",
      "label": "Cosignataire — êtes-vous un failli non libéré aux termes de la Loi sur la faillite et l'insolvabilité ?",
      "type": "yes-no",
      "isRequired": false,
      "indication": "Les cosignataires résidant au Québec n'ont pas à répondre."
    },
    {
      "externalId": "cosignerPriorSponsoredReceivedSocialAssistance",
      "label": "Cosignataire — une personne que vous avez déjà parrainée (ou les membres de sa famille) ont-ils reçu de l'aide sociale durant la durée de validité de l'engagement ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerPriorCosignedReceivedSocialAssistance",
      "label": "Cosignataire — avez-vous déjà cosigné un engagement d'aide en faveur d'une personne ou des membres de sa famille qui ont reçu de l'aide sociale durant la durée de validité de l'engagement ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerOrderedToLeaveCanada",
      "label": "Cosignataire — avez-vous été sommé de quitter le Canada ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerInDefaultOfImmigrationLoan",
      "label": "Cosignataire — êtes-vous en retard pour le remboursement d'un emprunt d'immigration, d'une garantie de bonne exécution ou de tout autre montant que vous vous êtes engagé à payer en vertu de la législation canadienne en matière d'immigration, sans avoir pris de dispositions pour reporter les versements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerCurrentlyDetained",
      "label": "Cosignataire — êtes-vous actuellement détenu dans un pénitencier, une prison ou une maison de correction ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerConvictedOfSeriousOffence",
      "label": "Cosignataire — avez-vous déjà été déclaré coupable d'une infraction sexuelle, d'une infraction grave avec violence contre une personne ou d'une infraction causant des lésions corporelles contre un membre de votre parenté (ou tentative/menace) ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerInDefaultOfSupportOrder",
      "label": "Cosignataire — êtes-vous en défaut d'une ordonnance de la cour vous ordonnant de payer une pension alimentaire à votre époux, ex-époux, conjoint de fait, ex-conjoint de fait ou enfant ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerCitizenshipRevocation",
      "label": "Cosignataire — faites-vous l'objet d'une demande de révocation de votre citoyenneté canadienne ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerInadmissibilityReport",
      "label": "Cosignataire — faites-vous l'objet d'un rapport d'interdiction de territoire ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerChargedSeriousOffence",
      "label": "Cosignataire — avez-vous été accusé d'une infraction à une loi fédérale punissable d'un emprisonnement maximal d'au moins dix ans ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "cosignerAdmissibilityDetails",
      "label": "Cosignataire — si vous avez répondu Oui aux questions sur la détention, la révocation de citoyenneté, l'interdiction de territoire ou l'accusation, donnez les détails (date et lieu).",
      "type": "textarea",
      "isRequired": false
    }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run questions:seedCanonicalQuestions "$ARGS")
echo "[seed] round 2 catalog questions for IMM 1344 upserted (7 sponsor gap-fills + 49 cosigner)"
