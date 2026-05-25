#!/usr/bin/env bash
# Seed canonical catalog questions for IMM 5532 (Renseignements relatifs à la
# relation). 44 single-instance + 11 multi-entry questions covering the
# sponsor's history, the sponsored person's history, and the relationship
# narrative (first meeting, cohabitation, ceremonies, etc.).
#
# Catalog reuse from existing seeds: lastName, firstName, dateOfBirth,
# iucNumber, sponsoredLastName, sponsoredFirstName, sponsoredDateOfBirth,
# hasPreviousMarriage — referenced directly by the 5532 mapping.
#
# Multi-entry pattern: `type: "multi-entry"` + `multiEntryFields: [...]` —
# rendered by formioform UnifiedWizard as a repeatable subform. Subfield
# types limited to text/select/date per MultiEntryFieldDef.
#
# Idempotent: upserts by externalId, safe to re-run after edits.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "questions": [
    {
      "externalId": "sponsoredIucNumber",
      "label": "Quel est l'identifiant client (UCI) de la personne parrainée ?",
      "type": "text",
      "isRequired": false,
      "indication": "Si vous le connaissez."
    },

    {
      "externalId": "employmentHistory",
      "label": "Antécédents professionnels — listez les emplois occupés (les plus récents en premier).",
      "type": "multi-entry",
      "isRequired": false,
      "indication": "Pour chaque emploi : dates, employeur (nom, adresse, téléphone), poste et revenu mensuel brut.",
      "multiEntryAddLabel": "Ajouter un emploi",
      "multiEntryFields": [
        { "key": "dateFrom", "label": "De (AAAA-MM)", "type": "date" },
        { "key": "dateTo", "label": "À (AAAA-MM)", "type": "date" },
        { "key": "employer", "label": "Employeur (nom, adresse complète, téléphone)", "type": "text", "colSpan": 2 },
        { "key": "occupation", "label": "Profession / Poste", "type": "text" },
        { "key": "monthlySalary", "label": "Salaire / Revenu mensuel brut ($)", "type": "text" }
      ]
    },

    {
      "externalId": "hasOtherSponsorships",
      "label": "Avez-vous parrainé, dans le passé, ou parrainez-vous actuellement d'autres membres de votre famille dans une demande différente ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "otherSponsorships",
      "label": "Autres parrainages — détails sur chaque personne parrainée.",
      "type": "multi-entry",
      "isRequired": false,
      "indication": "À remplir si vous avez répondu Oui à la question précédente.",
      "multiEntryAddLabel": "Ajouter un parrainage",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "dateOfBirth", "label": "Date de naissance", "type": "date" },
        { "key": "sponsorOrCosignerRole", "label": "Étiez-vous répondant ou cosignataire ?", "type": "select", "options": [
          { "code": "repondant", "name": "Répondant" },
          { "code": "cosignataire", "name": "Cosignataire" }
        ] }
      ]
    },

    {
      "externalId": "financialDependents",
      "label": "Autres personnes financièrement à votre charge (non incluses ailleurs dans la demande).",
      "type": "multi-entry",
      "isRequired": false,
      "multiEntryAddLabel": "Ajouter une personne à charge",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "dateOfBirth", "label": "Date de naissance", "type": "date" }
      ]
    },

    {
      "externalId": "highestEducationLevel",
      "label": "Quel est le niveau de scolarité le plus élevé que vous avez atteint ?",
      "type": "select",
      "isRequired": true,
      "options": [
        "École élémentaire / primaire",
        "Études secondaires",
        "Collège / Université",
        "Études supérieures"
      ]
    },
    {
      "externalId": "yearsElementary",
      "label": "École élémentaire / primaire — nombre d'années terminées",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "yearsSecondary",
      "label": "Études secondaires — nombre d'années terminées",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "yearsCollege",
      "label": "Collège / Université — nombre d'années terminées",
      "type": "text",
      "isRequired": false
    },
    {
      "externalId": "yearsGraduate",
      "label": "Études supérieures — nombre d'années terminées",
      "type": "text",
      "isRequired": false
    },

    {
      "externalId": "addressHistory",
      "label": "Historique des adresses des 5 dernières années (les plus récentes en premier).",
      "type": "multi-entry",
      "isRequired": true,
      "indication": "Aucune case postale acceptée — adresse civique uniquement.",
      "multiEntryAddLabel": "Ajouter une adresse",
      "multiEntryFields": [
        { "key": "dateFrom", "label": "De (AAAA-MM)", "type": "date" },
        { "key": "dateTo", "label": "À (AAAA-MM)", "type": "date" },
        { "key": "street", "label": "Rue et numéro", "type": "text", "colSpan": 2 },
        { "key": "city", "label": "Ville", "type": "text" },
        { "key": "provinceState", "label": "Province, État ou district", "type": "text" },
        { "key": "postalCode", "label": "Code postal", "type": "text" },
        { "key": "country", "label": "Pays", "type": "text" }
      ]
    },

    {
      "externalId": "livesInCanadaNow",
      "label": "Habitez-vous au Canada maintenant ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "lastTimeLivedInCanada",
      "label": "Quand avez-vous vécu au Canada la dernière fois ?",
      "type": "text",
      "isRequired": false,
      "indication": "À remplir si vous n'habitez pas au Canada actuellement."
    },
    {
      "externalId": "plannedReturnToCanada",
      "label": "Quand comptez-vous revenir vivre au Canada de façon permanente ?",
      "type": "text",
      "isRequired": false,
      "indication": "À remplir si vous n'habitez pas au Canada actuellement."
    },
    {
      "externalId": "intendedResidenceOnReturn",
      "label": "Où avez-vous l'intention de vivre lorsque vous reviendrez au Canada ?",
      "type": "text",
      "isRequired": false,
      "indication": "À remplir si vous n'habitez pas au Canada actuellement."
    },

    {
      "externalId": "sponsorPreviousRelationships",
      "label": "Relations conjugales antérieures du répondant (mariages, unions de fait, concubinages).",
      "type": "multi-entry",
      "isRequired": false,
      "indication": "À remplir si vous avez déjà été marié ou en union de fait. Une ligne par relation antérieure.",
      "multiEntryAddLabel": "Ajouter une relation antérieure",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "dateOfBirth", "label": "Date de naissance", "type": "date" },
        { "key": "relationStart", "label": "De (AAAA-MM)", "type": "date" },
        { "key": "relationEnd", "label": "À (AAAA-MM)", "type": "date" },
        { "key": "divorceDate", "label": "Date du divorce / décès / séparation (AAAA-MM)", "type": "date" }
      ]
    },

    {
      "externalId": "sponsorConsentDisclosureFraud",
      "label": "Si vous faites l'objet d'une enquête concernant un mariage frauduleux, consentez-vous à ce qu'IRCC et l'ASFC divulguent les résultats de l'enquête à votre époux ou conjoint ?",
      "type": "yes-no",
      "isRequired": true
    },

    {
      "externalId": "sponsoredHadPriorLinkWithSponsor",
      "label": "Avant la relation actuelle, aviez-vous quelque lien que ce soit avec votre répondant ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "sponsoredPriorLinks",
      "label": "Liens antérieurs entre le demandeur principal et le répondant (parenté, amitié, etc.).",
      "type": "multi-entry",
      "isRequired": false,
      "indication": "À remplir si vous avez répondu Oui à la question précédente.",
      "multiEntryAddLabel": "Ajouter un lien antérieur",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "dateOfBirth", "label": "Date de naissance", "type": "date" },
        { "key": "relationship", "label": "Lien de parenté", "type": "text" }
      ]
    },

    {
      "externalId": "sponsoredRelativesInCanada",
      "label": "Parenté du demandeur principal qui vit au Canada.",
      "type": "multi-entry",
      "isRequired": false,
      "multiEntryAddLabel": "Ajouter un parent au Canada",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "dateOfBirth", "label": "Date de naissance", "type": "date" },
        { "key": "birthPlace", "label": "Lieu de naissance", "type": "text" },
        { "key": "maritalStatus", "label": "État matrimonial", "type": "text" },
        { "key": "relationship", "label": "Lien de parenté", "type": "text" },
        { "key": "currentAddress", "label": "Adresse actuelle", "type": "text", "colSpan": 2 }
      ]
    },

    {
      "externalId": "sponsoredHasPreviousMarriage",
      "label": "Le demandeur principal a-t-il déjà été marié ou vécu dans une union de fait / concubinage auparavant ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "sponsoredPreviousRelationships",
      "label": "Relations conjugales antérieures du demandeur principal.",
      "type": "multi-entry",
      "isRequired": false,
      "indication": "À remplir si le demandeur principal a déjà été marié ou en union de fait.",
      "multiEntryAddLabel": "Ajouter une relation antérieure",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "dateOfBirth", "label": "Date de naissance", "type": "date" },
        { "key": "relationStart", "label": "De (AAAA-MM)", "type": "date" },
        { "key": "relationEnd", "label": "À (AAAA-MM)", "type": "date" },
        { "key": "divorceDate", "label": "Date du divorce / décès / séparation (AAAA-MM)", "type": "date" }
      ]
    },

    {
      "externalId": "sponsoredConsentDisclosureFraud",
      "label": "Si vous faites l'objet d'une enquête concernant un mariage frauduleux, consentez-vous à ce qu'IRCC et l'ASFC divulguent les résultats de l'enquête à votre répondant ?",
      "type": "yes-no",
      "isRequired": true
    },

    {
      "externalId": "firstMeetingDate",
      "label": "Quand vous êtes-vous rencontrés en personne pour la première fois ?",
      "type": "date",
      "isRequired": true
    },
    {
      "externalId": "firstMeetingPlace",
      "label": "Où vous êtes-vous rencontrés en personne pour la première fois ?",
      "type": "text",
      "isRequired": true
    },
    {
      "externalId": "firstMeetingCircumstances",
      "label": "Décrivez les circonstances de votre première rencontre.",
      "type": "textarea",
      "isRequired": true
    },
    {
      "externalId": "wasIntroducedByThirdParty",
      "label": "Quelqu'un vous a-t-il présentés l'un à l'autre ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "firstMeetingIntroducerName",
      "label": "Qui a fait les présentations ?",
      "type": "text",
      "isRequired": false,
      "indication": "À remplir si quelqu'un vous a présentés."
    },

    {
      "externalId": "hadPriorContactBeforeMeeting",
      "label": "Avez-vous été en contact avant de vous rencontrer en personne ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "priorContactDetails",
      "label": "Donnez des détails sur ce premier contact (qui a initié, quand, par quel moyen).",
      "type": "textarea",
      "isRequired": false,
      "indication": "À remplir si vous avez répondu Oui à la question précédente."
    },

    {
      "externalId": "currentlyLivingTogether",
      "label": "Habitez-vous ensemble actuellement ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "cohabitationDetails",
      "label": "Détails sur la cohabitation — si oui, depuis combien de temps ; si non, expliquez pourquoi.",
      "type": "textarea",
      "isRequired": true
    },

    {
      "externalId": "hasVisitedDuringRelationship",
      "label": "Si vous ne vivez pas ensemble, vous êtes-vous rendu visite pendant votre relation ?",
      "type": "yes-no",
      "isRequired": false,
      "indication": "À remplir si vous ne cohabitez pas."
    },
    {
      "externalId": "noVisitsExplanation",
      "label": "Si vous ne vous êtes pas rendu visite, expliquez pourquoi.",
      "type": "textarea",
      "isRequired": false
    },
    {
      "externalId": "relationshipVisits",
      "label": "Visites en personne pendant la relation — une ligne par visite.",
      "type": "multi-entry",
      "isRequired": false,
      "multiEntryAddLabel": "Ajouter une visite",
      "multiEntryFields": [
        { "key": "dateFrom", "label": "De (AAAA-MM)", "type": "date" },
        { "key": "dateTo", "label": "À (AAAA-MM)", "type": "date" },
        { "key": "whoTraveled", "label": "Qui a voyagé pour rendre visite à l'autre ?", "type": "text" },
        { "key": "stayedTogether", "label": "Avez-vous séjourné ensemble au même endroit ?", "type": "select", "options": [
          { "code": "oui", "name": "Oui" },
          { "code": "non", "name": "Non" }
        ] },
        { "key": "stayLocation", "label": "Où avez-vous séjourné ?", "type": "text", "colSpan": 2 }
      ]
    },

    {
      "externalId": "communicationLanguages",
      "label": "Quelle(s) langue(s) utilisez-vous pour communiquer ensemble ?",
      "type": "textarea",
      "isRequired": true
    },
    {
      "externalId": "communicationFrequencyAndMethods",
      "label": "À quelle fréquence communiquez-vous quand vous n'êtes pas ensemble, et de quelle façon ?",
      "type": "textarea",
      "isRequired": true
    },

    {
      "externalId": "othersAwareOfRelationship",
      "label": "Vos amis proches, votre famille et vos enfants sont-ils au courant de votre relation ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "othersAwareExplanation",
      "label": "Si non, expliquez pourquoi.",
      "type": "textarea",
      "isRequired": false
    },
    {
      "externalId": "peopleAwareOfRelationship",
      "label": "Personnes au courant de votre relation — une ligne par personne.",
      "type": "multi-entry",
      "isRequired": false,
      "multiEntryAddLabel": "Ajouter une personne",
      "multiEntryFields": [
        { "key": "lastName", "label": "Nom de famille", "type": "text" },
        { "key": "firstName", "label": "Prénom(s)", "type": "text" },
        { "key": "relativeToCouple", "label": "Lien de parenté avec le répondant ou le demandeur ?", "type": "select", "options": [
          { "code": "oui", "name": "Oui" },
          { "code": "non", "name": "Non" }
        ] },
        { "key": "relationshipDescription", "label": "Nature de la relation avec le répondant ou le demandeur", "type": "text" },
        { "key": "dateMet", "label": "Date à laquelle ils ont rencontré le couple", "type": "date" }
      ]
    },

    {
      "externalId": "wasMarriageArranged",
      "label": "Votre mariage a-t-il été arrangé ?",
      "type": "yes-no",
      "isRequired": false,
      "indication": "À remplir si vous êtes mariés."
    },
    {
      "externalId": "arrangedMarriageDetails",
      "label": "Décrivez comment le mariage a été arrangé (par qui, quand et où).",
      "type": "textarea",
      "isRequired": false
    },

    {
      "externalId": "hasOfficialCeremonies",
      "label": "Des cérémonies ou des événements officiels ont-ils été organisés pour reconnaître ou célébrer votre union ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "noOfficialCeremoniesExplanation",
      "label": "Si non, expliquez pourquoi.",
      "type": "textarea",
      "isRequired": false
    },
    {
      "externalId": "relationshipCeremonies",
      "label": "Cérémonies ou événements officiels organisés — une ligne par cérémonie.",
      "type": "multi-entry",
      "isRequired": false,
      "multiEntryAddLabel": "Ajouter une cérémonie",
      "multiEntryFields": [
        { "key": "date", "label": "Date (AAAA-MM-JJ)", "type": "date" },
        { "key": "description", "label": "Description de la cérémonie ou de l'événement", "type": "text", "colSpan": 2 },
        { "key": "location", "label": "Lieu", "type": "text" },
        { "key": "guestCount", "label": "Nombre d'invités", "type": "text" },
        { "key": "officiant", "label": "Qui a célébré la cérémonie, le cas échéant ?", "type": "text", "colSpan": 2 }
      ]
    },
    {
      "externalId": "ceremoniesParentsOfApplicant",
      "label": "Les parents du demandeur principal ont-ils participé à l'un des événements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "ceremoniesChildrenOfApplicant",
      "label": "Les enfants du demandeur principal ont-ils participé à l'un des événements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "ceremoniesOtherRelativesOfApplicant",
      "label": "D'autres membres de la famille du demandeur principal ont-ils participé à l'un des événements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "ceremoniesParentsOfSponsor",
      "label": "Les parents du répondant ont-ils participé à l'un des événements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "ceremoniesChildrenOfSponsor",
      "label": "Les enfants du répondant ont-ils participé à l'un des événements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "ceremoniesOtherRelativesOfSponsor",
      "label": "D'autres membres de la famille du répondant ont-ils participé à l'un des événements ?",
      "type": "yes-no",
      "isRequired": false
    },
    {
      "externalId": "ceremoniesAbsenceExplanation",
      "label": "Si l'une des personnes mentionnées n'a pas participé, expliquez pourquoi.",
      "type": "textarea",
      "isRequired": false
    },

    {
      "externalId": "isCurrentlyPregnant",
      "label": "Êtes-vous enceinte ou votre conjointe est-elle enceinte ?",
      "type": "yes-no",
      "isRequired": true
    },
    {
      "externalId": "pregnancyDueDate",
      "label": "Quelle est la date prévue de l'accouchement ?",
      "type": "date",
      "isRequired": false
    },

    {
      "externalId": "additionalRelationshipInfo",
      "label": "Y a-t-il d'autres renseignements que vous aimeriez ajouter à l'appui de votre relation ?",
      "type": "textarea",
      "isRequired": false
    }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run questions:seedCanonicalQuestions "$ARGS")
echo "[seed] canonical catalog questions for IMM 5532 upserted (44 single + 11 multi-entry)"
