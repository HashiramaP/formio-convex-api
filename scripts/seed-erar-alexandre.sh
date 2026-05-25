#!/usr/bin/env bash
# Manual support: create the ERAR (Examen des risques avant renvoi) custom
# form for Alexandre's firm (Giroux-O'Connor) after the AI form-import
# feature failed on his Word/PDF upload. Calls the spike admin mutation
# `formDefinitions:adminCreateCustomFormFromTemplate` which builds the
# formDefinition + firm-scoped questions + formQuestions in one tx.
#
# Source template: /Users/parsahomayouni/Downloads/ERAR template.docx
# Firm: jn7923gpfz7sk1dvagpmr08ec186nda7 (workosUserId user_01KQZP...)
# Form name: "Demande d'examen des risques avant renvoi (ERAR)"
# Language: fr
#
# Idempotent caveat: refuses if a form with the same (firmId, name) already
# exists. To re-run, delete the existing form first via the dashboard.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "firmId": "jn7923gpfz7sk1dvagpmr08ec186nda7",
  "name": "Demande d'examen des risques avant renvoi (ERAR)",
  "language": "fr",
  "category": "ERAR",
  "questions": [
    { "externalId": "erarAlex_correspondenceLanguage", "label": "Langue de préférence pour la correspondance et le service", "type": "select", "isRequired": true, "section": "Préférences de communication", "options": [{"code":"fr","name":"Français"},{"code":"en","name":"Anglais"}] },
    { "externalId": "erarAlex_needsInterpreter", "label": "Avez-vous besoin d'un interprète si une audience est nécessaire ?", "type": "yes-no", "isRequired": true, "section": "Préférences de communication" },
    { "externalId": "erarAlex_interpreterLanguage", "label": "Si oui, précisez la langue", "type": "text", "isRequired": false, "section": "Préférences de communication" },

    { "externalId": "erarAlex_priorAsylumClaim", "label": "Avez-vous déjà présenté une demande d'asile au Canada ?", "type": "yes-no", "isRequired": true, "section": "Antécédents de demandes" },
    { "externalId": "erarAlex_priorErarClaim", "label": "Avez-vous déjà présenté une demande d'ERAR ?", "type": "yes-no", "isRequired": true, "section": "Antécédents de demandes" },

    { "externalId": "erarAlex_lastName", "label": "Nom de famille", "type": "text", "isRequired": true, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_firstName", "label": "Prénoms", "type": "text", "isRequired": true, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_otherNames", "label": "Autres noms utilisés (nom de jeune fille, surnoms, noms d'emprunt)", "type": "text", "isRequired": false, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_gender", "label": "Genre", "type": "select", "isRequired": true, "section": "A. Renseignements personnels", "options": [{"code":"f","name":"Féminin"},{"code":"m","name":"Masculin"},{"code":"x","name":"X / un autre genre"}] },
    { "externalId": "erarAlex_dateOfBirth", "label": "Date de naissance", "type": "date", "isRequired": true, "section": "A. Renseignements personnels", "indication": "Format AAAA-MM-JJ" },
    { "externalId": "erarAlex_birthPlace", "label": "Lieu de naissance (ville, village, état/province, pays)", "type": "text", "isRequired": true, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_citizenship1", "label": "Citoyenneté 1", "type": "text", "isRequired": true, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_citizenship2", "label": "Citoyenneté 2 (si applicable)", "type": "text", "isRequired": false, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_height", "label": "Taille", "type": "text", "isRequired": false, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_weight", "label": "Poids", "type": "text", "isRequired": false, "section": "A. Renseignements personnels" },
    { "externalId": "erarAlex_eyeColor", "label": "Couleur des yeux", "type": "text", "isRequired": false, "section": "A. Renseignements personnels" },

    { "externalId": "erarAlex_maritalStatus", "label": "État matrimonial", "type": "select", "isRequired": true, "section": "A. Renseignements personnels", "options": [{"code":"single","name":"Célibataire (jamais marié(e))"},{"code":"married","name":"Marié(e)"},{"code":"widowed","name":"Veuf(ve)"},{"code":"separated","name":"Séparé(e)"},{"code":"divorced","name":"Divorcé(e)"},{"code":"annulled","name":"Mariage annulé"}] },

    { "externalId": "erarAlex_currentAddress", "label": "Adresse actuelle complète", "type": "textarea", "isRequired": true, "section": "A. Coordonnées" },
    { "externalId": "erarAlex_currentPostalCode", "label": "Code postal (adresse actuelle)", "type": "text", "isRequired": false, "section": "A. Coordonnées" },
    { "externalId": "erarAlex_homePhone", "label": "Numéro de téléphone à domicile (incluant indicatif régional)", "type": "text", "isRequired": false, "section": "A. Coordonnées" },
    { "externalId": "erarAlex_postalSameAsCurrent", "label": "Votre adresse postale est-elle la même que votre adresse actuelle ?", "type": "yes-no", "isRequired": true, "section": "A. Coordonnées" },
    { "externalId": "erarAlex_postalAddress", "label": "Adresse postale (si différente)", "type": "textarea", "isRequired": false, "section": "A. Coordonnées" },
    { "externalId": "erarAlex_messagePhone", "label": "Numéro de téléphone où laisser des messages (incluant indicatif régional)", "type": "text", "isRequired": false, "section": "A. Coordonnées" },
    { "externalId": "erarAlex_bestTimeToCall", "label": "À quelle heure est-il préférable de vous téléphoner ? (préciser am/pm)", "type": "text", "isRequired": false, "section": "A. Coordonnées" },

    { "externalId": "erarAlex_dependents", "label": "Membres à charge de votre famille au Canada", "type": "multi-entry", "isRequired": false, "section": "A. Membres à charge au Canada", "indication": "Une ligne par membre à charge.", "multiEntryAddLabel": "Ajouter un membre à charge", "multiEntryFields": [
      {"key":"lastName","label":"Nom de famille","type":"text"},
      {"key":"firstName","label":"Prénom","type":"text"},
      {"key":"otherFirstName","label":"Autre(s) prénom(s)","type":"text"},
      {"key":"gender","label":"Genre","type":"select","options":[{"code":"f","name":"Féminin"},{"code":"m","name":"Masculin"},{"code":"x","name":"X / autre"}]},
      {"key":"dateOfBirth","label":"Date de naissance","type":"date"},
      {"key":"maritalStatus","label":"Situation de famille","type":"select","options":[{"code":"single","name":"Jamais marié(e)"},{"code":"married","name":"Marié(e)"},{"code":"divorced","name":"Divorcé(e)"},{"code":"commonLaw","name":"Conjoint de fait"},{"code":"widowed","name":"Veuf(ve)"},{"code":"annulled","name":"Mariage annulé"},{"code":"separated","name":"Séparé(e) légalement"}]},
      {"key":"relationship","label":"Lien de parenté","type":"text"},
      {"key":"iucNumber","label":"Numéro d'identification du client (si applicable)","type":"text"},
      {"key":"citizenship","label":"Citoyenneté","type":"text"}
    ] },

    { "externalId": "erarAlex_familyMembers", "label": "Q15: Membres de votre famille (époux/conjoint, enfants, parents, grands-parents, frères/sœurs)", "type": "multi-entry", "isRequired": false, "section": "A. Q15 — Membres de la famille", "indication": "Inclure tous les membres mentionnés, qu'ils soient au Canada ou non.", "multiEntryAddLabel": "Ajouter un membre de la famille", "multiEntryFields": [
      {"key":"lastName","label":"Nom de famille","type":"text"},
      {"key":"firstName","label":"Prénom","type":"text"},
      {"key":"dateOfBirth","label":"Date de naissance","type":"date"},
      {"key":"citizenship","label":"Citoyenneté","type":"text"},
      {"key":"relationship","label":"Lien de parenté","type":"text"},
      {"key":"isInCanada","label":"Cette personne est-elle au Canada ?","type":"select","options":[{"code":"yes","name":"Oui"},{"code":"no","name":"Non"}]},
      {"key":"detailsIfUnavailable","label":"Détails si décédée, lieu inconnu, ne répond pas à l'immigration","type":"text","colSpan":2}
    ] },

    { "externalId": "erarAlex_residences10y", "label": "Q16: Résidences des 10 dernières années", "type": "multi-entry", "isRequired": true, "section": "B. Q16 — Résidences (10 dernières années)", "indication": "Pays, statut, dates. Une ligne par pays / période.", "multiEntryAddLabel": "Ajouter une résidence", "multiEntryFields": [
      {"key":"country","label":"Pays","type":"text"},
      {"key":"status","label":"Statut (résident permanent, citoyen, clandestin, touriste, etc.)","type":"text","colSpan":2},
      {"key":"from","label":"De (AAAA-MM)","type":"date"},
      {"key":"to","label":"À (AAAA-MM)","type":"date"}
    ] },

    { "externalId": "erarAlex_priorCanadaVisits", "label": "Q17: Êtes-vous déjà venu(e) au Canada ?", "type": "yes-no", "isRequired": true, "section": "B. Q17 — Visites antérieures au Canada" },
    { "externalId": "erarAlex_canadaVisits", "label": "Q17: Précisions sur les trois dernières visites", "type": "multi-entry", "isRequired": false, "section": "B. Q17 — Visites antérieures au Canada", "multiEntryAddLabel": "Ajouter une visite", "multiEntryFields": [
      {"key":"from","label":"De (AAAA-MM)","type":"date"},
      {"key":"to","label":"À (AAAA-MM)","type":"date"},
      {"key":"purpose","label":"Objet de la visite","type":"text","colSpan":2}
    ] },

    { "externalId": "erarAlex_warCrimes", "label": "Q18: En période de paix ou de guerre, avez-vous déjà participé à un crime de guerre, un crime contre l'humanité, ou des actes inhumains contre des civils/prisonniers (assassinat, torture, esclavage, déportation, etc.) ?", "type": "yes-no", "isRequired": true, "section": "B. Q18 — Crimes de guerre / contre l'humanité" },

    { "externalId": "erarAlex_militaryService", "label": "Q19: Avez-vous déjà servi dans l'armée ou appartenu à une organisation paramilitaire ?", "type": "yes-no", "isRequired": true, "section": "B. Q19 — Service militaire / paramilitaire" },
    { "externalId": "erarAlex_militaryPeriods", "label": "Q19: Détails des périodes militaires / paramilitaires", "type": "multi-entry", "isRequired": false, "section": "B. Q19 — Service militaire / paramilitaire", "multiEntryAddLabel": "Ajouter une période", "multiEntryFields": [
      {"key":"from","label":"De (AAAA-MM)","type":"date"},
      {"key":"to","label":"À (AAAA-MM)","type":"date"},
      {"key":"orgName","label":"Nom de l'organisation / armée","type":"text","colSpan":2},
      {"key":"location","label":"Lieu","type":"text"},
      {"key":"position","label":"Poste occupé","type":"text"}
    ] },

    { "externalId": "erarAlex_armedConflict", "label": "Q20: Avez-vous déjà participé à un conflit armé ?", "type": "yes-no", "isRequired": true, "section": "B. Q20 — Participation à un conflit armé" },
    { "externalId": "erarAlex_armedConflictPeriods", "label": "Q20: Détails des conflits armés", "type": "multi-entry", "isRequired": false, "section": "B. Q20 — Participation à un conflit armé", "multiEntryAddLabel": "Ajouter une période", "multiEntryFields": [
      {"key":"from","label":"De (AAAA-MM)","type":"date"},
      {"key":"to","label":"À (AAAA-MM)","type":"date"},
      {"key":"location","label":"Lieu","type":"text"},
      {"key":"role","label":"Décrivez brièvement votre rôle","type":"text","colSpan":2}
    ] },

    { "externalId": "erarAlex_govChiefOfState", "label": "Q21a: Avez-vous été chef d'État ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govCabinet", "label": "Q21b: Avez-vous été membre d'un cabinet ou gouverneur en conseil ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govSeniorAdvisor", "label": "Q21c: Avez-vous été conseiller principal d'une personne visée aux points 1 ou 2 ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govSeniorOfficial", "label": "Q21d: Avez-vous été fonctionnaire haut gradé ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govSeniorMilitary", "label": "Q21e: Avez-vous été cadre supérieur militaire, de la sécurité interne ou du renseignement ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govAmbassador", "label": "Q21f: Avez-vous été ambassadeur ou diplomate agréé ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govJudiciary", "label": "Q21g: Avez-vous été membre du contentieux ou de l'appareil judiciaire ?", "type": "yes-no", "isRequired": true, "section": "B. Q21 — Fonctions gouvernementales" },
    { "externalId": "erarAlex_govPositionDetails", "label": "Q21: Si vous avez occupé un de ces postes, précisez votre travail, vos tâches, vos responsabilités.", "type": "textarea", "isRequired": false, "section": "B. Q21 — Fonctions gouvernementales" },

    { "externalId": "erarAlex_criminalRecord", "label": "Q22: Avez-vous déjà été accusé(e) ou trouvé(e) coupable d'une infraction ou d'un crime dans n'importe quel pays ?", "type": "yes-no", "isRequired": true, "section": "B. Q22 — Infractions criminelles" },
    { "externalId": "erarAlex_criminalOffences", "label": "Q22: Détails des infractions", "type": "multi-entry", "isRequired": false, "section": "B. Q22 — Infractions criminelles", "multiEntryAddLabel": "Ajouter une infraction", "multiEntryFields": [
      {"key":"convictionOrCharge","label":"Condamnation / accusation","type":"text","colSpan":2},
      {"key":"date","label":"Date (AAAA-MM-JJ)","type":"date"},
      {"key":"where","label":"Où (ville et pays)","type":"text"},
      {"key":"penalty","label":"Peine et/ou disposition","type":"text","colSpan":2}
    ] },
    { "externalId": "erarAlex_criminalCircumstances", "label": "Q22: Précisez les circonstances des infractions", "type": "textarea", "isRequired": false, "section": "B. Q22 — Infractions criminelles" },

    { "externalId": "erarAlex_arrivalDate", "label": "Q23: Date d'arrivée au Canada (AAAA-MM-JJ)", "type": "date", "isRequired": true, "section": "C. Q23 — Arrivée au Canada" },
    { "externalId": "erarAlex_arrivalPlace", "label": "Q23: Lieu d'arrivée au Canada", "type": "text", "isRequired": true, "section": "C. Q23 — Arrivée au Canada" },
    { "externalId": "erarAlex_entryPoint", "label": "Q23: Point d'entrée", "type": "text", "isRequired": true, "section": "C. Q23 — Arrivée au Canada" },
    { "externalId": "erarAlex_arrivalProvince", "label": "Q23: Province", "type": "text", "isRequired": true, "section": "C. Q23 — Arrivée au Canada" },

    { "externalId": "erarAlex_routeStages", "label": "Q24: Itinéraire vers le Canada — étapes du voyage", "type": "multi-entry", "isRequired": true, "section": "C. Q24 — Itinéraire vers le Canada", "indication": "Du point de départ jusqu'à l'arrivée au Canada.", "multiEntryAddLabel": "Ajouter une étape", "multiEntryFields": [
      {"key":"country","label":"Pays","type":"text"},
      {"key":"status","label":"Statut dans ce pays (en transit, touriste, résident, citoyen, en situation irrégulière, etc.)","type":"text","colSpan":2},
      {"key":"transportMode","label":"Mode de transport","type":"text"},
      {"key":"companyName","label":"Nom de la compagnie","type":"text"},
      {"key":"arrivalDate","label":"Date d'arrivée (AAAA-MM-JJ)","type":"date"},
      {"key":"departureDate","label":"Date de départ (AAAA-MM-JJ)","type":"date"}
    ] },

    { "externalId": "erarAlex_arrivalImmigrantVisa", "label": "Q25: À votre arrivée, aviez-vous un visa canadien d'immigrant dont vous étiez le titulaire légitime ?", "type": "yes-no", "isRequired": true, "section": "C. Q25 — Visa canadien d'immigrant" },
    { "externalId": "erarAlex_arrivalImmigrantVisaIssuePlace", "label": "Q25: Si oui, endroit où le visa a été délivré", "type": "text", "isRequired": false, "section": "C. Q25 — Visa canadien d'immigrant" },

    { "externalId": "erarAlex_intendedStayDuration", "label": "Q26: Durée prévue du séjour au Canada", "type": "select", "isRequired": true, "section": "C. Q26 — Durée prévue du séjour", "options": [{"code":"indefinite","name":"Une période indéterminée (pour établir résidence)"},{"code":"temporary","name":"Une période temporaire"}] },
    { "externalId": "erarAlex_intendedStayEndDate", "label": "Q26: Si temporaire, jusqu'à quelle date ? (AAAA-MM-JJ)", "type": "date", "isRequired": false, "section": "C. Q26 — Durée prévue du séjour" },

    { "externalId": "erarAlex_arrivalLegalAdmission", "label": "Q27: À votre arrivée — j'ai été admis(e) légalement au Canada comme visiteur (incluant étudiants et titulaires d'un permis de travail)", "type": "yes-no", "isRequired": false, "section": "C. Q27 — À mon arrivée" },
    { "externalId": "erarAlex_arrivalTRP", "label": "Q27: J'étais titulaire d'un permis de séjour temporaire", "type": "yes-no", "isRequired": false, "section": "C. Q27 — À mon arrivée" },
    { "externalId": "erarAlex_arrivalFraudulent", "label": "Q27: Je suis venu(e) au Canada sur la foi de documents frauduleux, en recourant à un moyen frauduleux ou par suite de fausses déclarations", "type": "yes-no", "isRequired": false, "section": "C. Q27 — À mon arrivée" },

    { "externalId": "erarAlex_fakeDocument", "label": "Q28: Suis venu(e) au Canada sur la foi d'un document faux ou obtenu irrégulièrement (visa ou autre) — précisez", "type": "textarea", "isRequired": false, "section": "C. Q28 — Documents faux / moyen frauduleux / fausses déclarations" },
    { "externalId": "erarAlex_fakeDocumentLocation", "label": "Q28: Où est ce document en ce moment ?", "type": "text", "isRequired": false, "section": "C. Q28 — Documents faux / moyen frauduleux / fausses déclarations" },
    { "externalId": "erarAlex_fraudulentMeans", "label": "Q28: Si moyen frauduleux/irrégulier, précisez comment", "type": "textarea", "isRequired": false, "section": "C. Q28 — Documents faux / moyen frauduleux / fausses déclarations" },
    { "externalId": "erarAlex_falseDeclarations", "label": "Q28: Si fausses déclarations, précisez sur quels faits", "type": "textarea", "isRequired": false, "section": "C. Q28 — Documents faux / moyen frauduleux / fausses déclarations" },

    { "externalId": "erarAlex_presentedDocs", "label": "Q29: Documents présentés à l'arrivée au Canada", "type": "multi-entry", "isRequired": false, "section": "C. Q29 — Documents présentés à l'arrivée", "multiEntryAddLabel": "Ajouter un document", "multiEntryFields": [
      {"key":"type","label":"Genre de document","type":"text"},
      {"key":"country","label":"Pays de délivrance","type":"text"},
      {"key":"issueDate","label":"Date de délivrance (AAAA-MM-JJ)","type":"date"},
      {"key":"expiryDate","label":"Date d'expiration (AAAA-MM-JJ)","type":"date"},
      {"key":"serialNumber","label":"Numéro de série","type":"text"}
    ] },

    { "externalId": "erarAlex_appliedForPassportToLeave", "label": "Q30: Avez-vous présenté une demande de passeport ou de titre de voyage pour quitter votre pays ?", "type": "yes-no", "isRequired": true, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_passportIssuedToLeave", "label": "Q31: Si oui, vous a-t-on délivré un passeport ou un titre de voyage ?", "type": "yes-no", "isRequired": false, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_needsExitVisa", "label": "Q32: Avez-vous besoin d'un visa ou permis de sortie pour quitter votre pays ?", "type": "yes-no", "isRequired": true, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_appliedForExitVisa", "label": "Q33: Si oui, avez-vous présenté une demande de visa ou permis de sortie ?", "type": "yes-no", "isRequired": false, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_exitVisaIssued", "label": "Q34: Si oui, vous a-t-on délivré un visa ou permis de sortie ?", "type": "yes-no", "isRequired": false, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_hadCanadianImmigrantVisa", "label": "Q35: À votre arrivée au Canada, aviez-vous un visa canadien d'immigrant ?", "type": "yes-no", "isRequired": true, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_hadCanadianVisitorVisa", "label": "Q36: À votre arrivée au Canada, aviez-vous un visa canadien de visiteur ?", "type": "yes-no", "isRequired": true, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },
    { "externalId": "erarAlex_noApplicationExplanation", "label": "Q37: Si vous avez répondu non aux questions 30 et/ou 33, expliquez pourquoi vous n'avez pas présenté de demande", "type": "textarea", "isRequired": false, "section": "C. Q30-37 — Passeport, visas, permis de sortie" },

    { "externalId": "erarAlex_issuedDocs", "label": "Q38: Détails des documents délivrés (Q31, 34, 35 ou 36 = Oui). Inclure aussi tous documents faux ou pas à votre nom.", "type": "multi-entry", "isRequired": false, "section": "C. Q38 — Détails des documents délivrés", "multiEntryAddLabel": "Ajouter un document", "multiEntryFields": [
      {"key":"type","label":"Genre de document","type":"text"},
      {"key":"number","label":"Numéro du document (si connu)","type":"text"},
      {"key":"country","label":"Pays de délivrance","type":"text"},
      {"key":"issueDate","label":"Date de délivrance (AAAA-MM-JJ)","type":"date"},
      {"key":"expiryDate","label":"Date d'expiration (AAAA-MM-JJ)","type":"date"},
      {"key":"currentLocation","label":"Où est le document en ce moment ? (soyez précis)","type":"text","colSpan":2},
      {"key":"wasFraudulent","label":"Faux ou pas à votre nom ?","type":"select","options":[{"code":"yes","name":"Oui"},{"code":"no","name":"Non"}]}
    ] },

    { "externalId": "erarAlex_noDocsExplanation", "label": "Q39: Si vous avez répondu non aux questions 31, 34, 35 et/ou 36, expliquez pourquoi les documents ne vous ont pas été délivrés", "type": "textarea", "isRequired": false, "section": "C. Q39 — Explications documents non délivrés" },

    { "externalId": "erarAlex_otherDocsForTravel", "label": "Q40: Autres documents authentiques ou faux utilisés pour vous rendre au Canada (inclure les faux ou pas à votre nom même si déjà mentionnés)", "type": "multi-entry", "isRequired": false, "section": "C. Q40 — Autres documents utilisés", "multiEntryAddLabel": "Ajouter un document", "multiEntryFields": [
      {"key":"type","label":"Type de document","type":"text"},
      {"key":"number","label":"Numéro du document","type":"text"},
      {"key":"country","label":"Pays de délivrance","type":"text"},
      {"key":"issueDate","label":"Date de délivrance (AAAA-MM-JJ)","type":"date"},
      {"key":"wasFraudulent","label":"Faux ou sous un autre nom ?","type":"select","options":[{"code":"yes","name":"Oui"},{"code":"no","name":"Non"}]}
    ] },

    { "externalId": "erarAlex_identityDocs", "label": "Q41: Titres de voyage et pièces d'identité actuellement en votre possession (passeport, certificat de naissance, diplôme, permis de conduire, etc.)", "type": "multi-entry", "isRequired": false, "section": "C. Q41 — Pièces d'identité actuelles", "indication": "Veuillez joindre une copie de chaque document.", "multiEntryAddLabel": "Ajouter un document", "multiEntryFields": [
      {"key":"type","label":"Type de document","type":"text"},
      {"key":"number","label":"Numéro du document (si connu)","type":"text"},
      {"key":"country","label":"Pays de délivrance","type":"text"},
      {"key":"issueDate","label":"Date de délivrance (AAAA-MM-JJ)","type":"date"}
    ] },

    { "externalId": "erarAlex_renewedDocsForTravel", "label": "Q42: Avez-vous renouvelé un document après votre arrivée au Canada pour voyager à l'extérieur ?", "type": "yes-no", "isRequired": true, "section": "C. Q42 — Documents renouvelés après arrivée" },
    { "externalId": "erarAlex_renewedDocs", "label": "Q42: Si oui, détails des documents renouvelés", "type": "multi-entry", "isRequired": false, "section": "C. Q42 — Documents renouvelés après arrivée", "multiEntryAddLabel": "Ajouter un document", "multiEntryFields": [
      {"key":"type","label":"Type de document","type":"text"},
      {"key":"number","label":"Numéro du document (si connu)","type":"text"},
      {"key":"country","label":"Pays de délivrance","type":"text"},
      {"key":"issueDate","label":"Date de délivrance (AAAA-MM-JJ)","type":"date"}
    ] },

    { "externalId": "erarAlex_stayedOutsideHomeCountry5y", "label": "Q43: Avant votre séjour actuel au Canada, avez-vous séjourné à l'extérieur de votre pays de citoyenneté/résidence au cours des 5 dernières années ?", "type": "yes-no", "isRequired": true, "section": "C. Q43 — Séjours hors pays d'origine (5 ans)" },
    { "externalId": "erarAlex_stayedOutsideHomeCountryDetails", "label": "Q43: Si oui, donnez les détails", "type": "textarea", "isRequired": false, "section": "C. Q43 — Séjours hors pays d'origine (5 ans)" },

    { "externalId": "erarAlex_riskCountries", "label": "Q44: Dans quel(s) pays risquez-vous : persécution, torture, traitements/peines cruels ou inusités, menaces à votre vie ?", "type": "textarea", "isRequired": true, "section": "D. Q44 — Pays à risque" },

    { "externalId": "erarAlex_wantedByAuthorities", "label": "Q45: Avez-vous déjà été recherché(e) par la police, les autorités militaires ou toute autre autorité ?", "type": "yes-no", "isRequired": true, "section": "D. Q45 — Recherché par autorités" },
    { "externalId": "erarAlex_wantedCountries", "label": "Q45: Dans quel(s) pays ?", "type": "text", "isRequired": false, "section": "D. Q45 — Recherché par autorités" },

    { "externalId": "erarAlex_priorRefugeeClaimAbroad", "label": "Q46A: Avez-vous déjà revendiqué le statut de réfugié auprès d'autorités canadiennes à l'étranger ?", "type": "yes-no", "isRequired": true, "section": "D. Q46 — Revendications statut réfugié antérieures" },
    { "externalId": "erarAlex_priorRefugeeClaimAbroadDetails", "label": "Q46A: Si oui, précisez", "type": "textarea", "isRequired": false, "section": "D. Q46 — Revendications statut réfugié antérieures" },
    { "externalId": "erarAlex_priorRefugeeOrErarInCanada", "label": "Q46B: Avez-vous déjà revendiqué le statut de réfugié ou présenté une demande d'ERAR au Canada ?", "type": "yes-no", "isRequired": true, "section": "D. Q46 — Revendications statut réfugié antérieures" },
    { "externalId": "erarAlex_priorRefugeeOrErarInCanadaDetails", "label": "Q46B: Si oui, précisez", "type": "textarea", "isRequired": false, "section": "D. Q46 — Revendications statut réfugié antérieures" },

    { "externalId": "erarAlex_refugeeClaimsOtherCountries", "label": "Q47: Avez-vous déjà revendiqué le statut de réfugié au sens de la Convention dans un autre pays ?", "type": "yes-no", "isRequired": true, "section": "D. Q47 — Revendications réfugié hors Canada" },
    { "externalId": "erarAlex_refugeeClaimsConvention", "label": "Q47: Détails des demandes", "type": "multi-entry", "isRequired": false, "section": "D. Q47 — Revendications réfugié hors Canada", "multiEntryAddLabel": "Ajouter une demande", "multiEntryFields": [
      {"key":"countryClaimed","label":"Pays où la demande a été présentée","type":"text"},
      {"key":"countryFled","label":"Pays fui","type":"text"},
      {"key":"claimDate","label":"Date de la demande (AAAA-MM-JJ)","type":"date"},
      {"key":"result","label":"Résultat","type":"text","colSpan":2},
      {"key":"docIssueDate","label":"Date de délivrance du document (si applicable)","type":"date"},
      {"key":"docSerialNumber","label":"Numéro de série du document","type":"text"}
    ] },

    { "externalId": "erarAlex_unhcrRefugeeClaim", "label": "Q48: Avez-vous déjà revendiqué le statut de réfugié auprès du HCR (Haut Commissariat des Nations Unies pour les réfugiés) ?", "type": "yes-no", "isRequired": true, "section": "D. Q48 — Revendication HCR" },
    { "externalId": "erarAlex_unhcrCountry", "label": "Q48: Si oui, pays où la demande a été faite", "type": "text", "isRequired": false, "section": "D. Q48 — Revendication HCR" },
    { "externalId": "erarAlex_unhcrRecognized", "label": "Q48: Le statut de réfugié au sens de la Convention a-t-il été reconnu ?", "type": "yes-no", "isRequired": false, "section": "D. Q48 — Revendication HCR" },
    { "externalId": "erarAlex_unhcrHasDocument", "label": "Q48: Avez-vous un document qui le confirme ?", "type": "yes-no", "isRequired": false, "section": "D. Q48 — Revendication HCR", "indication": "Joindre une copie du document." },

    { "externalId": "erarAlex_erarFamilyApplications", "label": "Q49: Membres de la famille ou parents qui ont déjà présenté une demande d'ERAR au Canada", "type": "multi-entry", "isRequired": false, "section": "D. Q49 — Demandes ERAR famille", "multiEntryAddLabel": "Ajouter une personne", "multiEntryFields": [
      {"key":"fullName","label":"Nom complet","type":"text","colSpan":2},
      {"key":"relationship","label":"Lien de parenté","type":"text"},
      {"key":"applicationDate","label":"Date de la demande (AAAA-MM-JJ)","type":"date"},
      {"key":"countryClaimed","label":"Pays où la demande a été présentée","type":"text"},
      {"key":"countryFled","label":"Pays fui","type":"text"},
      {"key":"result","label":"Résultat","type":"text","colSpan":2}
    ] },

    { "externalId": "erarAlex_sameReasonsAsPrincipal", "label": "Section E: Les raisons de votre demande d'ERAR sont-elles les mêmes que celles du demandeur principal ? (Si oui, passez directement à la question 52.)", "type": "yes-no", "isRequired": true, "section": "E. Raisons de la demande" },

    { "externalId": "erarAlex_riskNarrative", "label": "Q50: Expliquez, en ordre chronologique, les événements importants qui vous ont poussé(e) à chercher une protection à l'extérieur de votre pays (mesures contre vous, contre votre famille, contre toute autre personne dans une situation semblable).", "type": "textarea", "isRequired": false, "section": "E. Raisons de la demande" },
    { "externalId": "erarAlex_protectionAttempted", "label": "Q51: Quelle protection avez-vous tentée d'obtenir des autorités de votre pays ? Si vous n'avez pas tenté, expliquez pourquoi.", "type": "textarea", "isRequired": false, "section": "E. Raisons de la demande" },

    { "externalId": "erarAlex_evidenceDocs", "label": "Q52: Liste des documents joints comme éléments de preuve à l'appui de votre demande d'ERAR", "type": "multi-entry", "isRequired": false, "section": "E. Q52 — Éléments de preuve à l'appui", "indication": "Inclure seulement les documents pertinents à votre situation personnelle. Si vous avez déjà présenté une demande d'asile/ERAR, soumettre uniquement de NOUVEAUX éléments de preuve.", "multiEntryAddLabel": "Ajouter un document de preuve", "multiEntryFields": [
      {"key":"type","label":"Type de document","type":"text"},
      {"key":"howItSupports","label":"Comment ce document appuie votre demande de protection","type":"text","colSpan":2}
    ] }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run formDefinitions:adminCreateCustomFormFromTemplate "$ARGS")
echo "[seed] ERAR custom form created for Alexandre's firm"
