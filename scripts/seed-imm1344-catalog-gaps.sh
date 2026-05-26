#!/usr/bin/env bash
# Slice 2 spike — seed the canonical catalog questions that IMM 1344 needs
# but aren't yet in `questions` (~25 questions). Once these exist, the
# IMM 1344 mapping can reference them and the dynamic intake generator
# will surface them to clients with parrainage IMMs.
#
# Idempotent: upserts by externalId, safe to re-run after edits.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "questions": [
    {
      "externalId": "correspondenceLanguage",
      "label": "Dans quelle langue préférez-vous correspondre avec IRCC ?",
      "type": "select",
      "isRequired": true,
      "options": [
        { "code": "fr", "name": "Français" },
        { "code": "en", "name": "Anglais" }
      ]
    },
    {
      "externalId": "hasCosigner",
      "label": "Y a-t-il un cosignataire sur cette demande de parrainage ?",
      "type": "yes-no",
      "isRequired": true,
      "indication": "Le cosignataire doit être votre époux ou conjoint de fait."
    },
    {
      "externalId": "sponsoredFirstName",
      "label": "Quel est le prénom de la personne que vous parrainez ?",
      "type": "text",
      "isRequired": false,
      "indication": "Tel qu'indiqué sur son passeport ou titre de voyage."
    },
    {
      "externalId": "sponsoredLastName",
      "label": "Quel est le nom de famille de la personne que vous parrainez ?",
      "type": "text",
      "isRequired": true,
      "indication": "Tel qu'indiqué sur son passeport ou titre de voyage."
    },
    {
      "externalId": "sponsoredDateOfBirth",
      "label": "Quelle est la date de naissance de la personne que vous parrainez ?",
      "type": "date",
      "isRequired": true
    },
    {
      "externalId": "sponsoredRelationship",
      "label": "Quel est votre lien avec la personne que vous parrainez ?",
      "type": "select",
      "isRequired": true,
      "options": [
        { "code": "epoux", "name": "Époux/épouse" },
        { "code": "conjoint_fait", "name": "Conjoint(e) de fait" },
        { "code": "partenaire_conjugal", "name": "Partenaire conjugal(e)" },
        { "code": "enfant_charge", "name": "Enfant à charge" },
        { "code": "parent", "name": "Père/mère" },
        { "code": "grand_parent", "name": "Grand-père/grand-mère" },
        { "code": "frere_soeur_etc", "name": "Frère/sœur, neveu/nièce, petit-enfant orphelin" },
        { "code": "autre", "name": "Autre" }
      ]
    },
    {
      "externalId": "sponsoredRelationshipOther",
      "label": "Précisez le lien (si \"Autre\")",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "relationshipStartDate",
      "label": "Quelle est la date du début de votre relation conjugale ?",
      "type": "date",
      "isRequired": false,
      "indication": "Si vous êtes dans une relation conjugale avec la personne parrainée."
    },
    {
      "externalId": "canadianStatus",
      "label": "Quel est votre statut au Canada ?",
      "type": "select",
      "isRequired": true,
      "options": [
        { "code": "citoyen_ne", "name": "Citoyen canadien né au Canada" },
        { "code": "citoyen_naturalise", "name": "Citoyen canadien naturalisé" },
        { "code": "resident_permanent", "name": "Résident permanent" },
        { "code": "indien_inscrit", "name": "Indien inscrit au sens de la Loi sur les Indiens" }
      ]
    },
    {
      "externalId": "canadianStatusObtainedDate",
      "label": "À quelle date avez-vous obtenu ce statut ?",
      "type": "date",
      "isRequired": false,
      "indication": "Pour les résidents permanents et citoyens naturalisés, indiquez la date la plus récente."
    },
    {
      "externalId": "nameOnPRSame",
      "label": "Aviez-vous le même nom complet lorsque vous êtes devenu résident permanent ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "nameOnPRLastName",
      "label": "Nom de famille au moment de devenir résident permanent",
      "type": "text",
      "isRequired": false,
      "indication": "Si différent du nom actuel."
    },
    {
      "externalId": "nameOnPRFirstName",
      "label": "Prénom au moment de devenir résident permanent",
      "type": "text",
      "isRequired": false,
      "indication": "Si différent du prénom actuel."
    },
    {
      "externalId": "hasPreviousMarriage",
      "label": "Avez-vous déjà été marié(e) ou vécu dans une union de fait ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "exSpouseUnionType",
      "label": "Quel type d'union aviez-vous avec votre ex-conjoint(e) ?",
      "type": "select",
      "isRequired": false,
      "options": [
        { "code": "mariage", "name": "Mariage" },
        { "code": "union_fait", "name": "Union de fait" },
        { "code": "partenariat_conjugal", "name": "Partenariat conjugal" }
      ]
    },
    {
      "externalId": "isCanadianAbroad",
      "label": "Êtes-vous un citoyen canadien résidant exclusivement à l'extérieur du Canada ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "sponsoringFamilyCategory",
      "label": "Parrainez-vous un membre de la catégorie du regroupement familial ou de la catégorie des époux et conjoints de fait au Canada ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "canadaSoleResidence",
      "label": "Le Canada est-il votre seul pays de résidence ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "becamePRViaSponsorship5y",
      "label": "Dans les cinq années qui précèdent cette demande, êtes-vous devenu résident permanent après avoir été parrainé en tant qu'époux, conjoint de fait ou partenaire conjugal ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "priorPendingApplication",
      "label": "Avez-vous soumis une demande antérieure pour la personne parrainée pour laquelle une décision finale n'a pas été prise ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "onSocialAssistance",
      "label": "Êtes-vous bénéficiaire d'assistance sociale autrement que pour cause d'invalidité ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "isUndischargedBankrupt",
      "label": "Êtes-vous un failli non libéré aux termes de la Loi sur la faillite et l'insolvabilité ?",
      "type": "yes-no",
      "isRequired": false,
      "indication": "Les répondants résidant au Québec n'ont pas à répondre."
    },
    {
      "externalId": "citizenshipRevocation",
      "label": "Faites-vous l'objet d'une demande de révocation de votre citoyenneté canadienne ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "inadmissibilityReport",
      "label": "Faites-vous l'objet d'un rapport d'interdiction de territoire ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "chargedSeriousOffence",
      "label": "Avez-vous été accusé d'une infraction à une loi fédérale punissable d'un emprisonnement maximal d'au moins dix ans ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "admissibilityDetails",
      "label": "Si vous avez répondu Oui à une question d'admissibilité (détention, révocation, interdiction de territoire, accusation), donnez les détails y compris la date et le lieu.",
      "type": "textarea",
      "isRequired": false
    }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run questions:seedCanonicalQuestions "$ARGS")
echo "[seed] canonical catalog questions for IMM 1344 upserted"
