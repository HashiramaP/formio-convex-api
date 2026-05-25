#!/usr/bin/env bash
# Seed the canonical OCR document catalog into Convex `documents` table.
# Mirrors the 12 configs currently hardcoded in
# `formioform/src/lib/document-ocr-configs.ts` (passport, nationalId,
# marriageCertificate, spousePassport, divorceDocument, empAttestationCurrent,
# diploma1-6). Slice 1 of the doc-fill mapping: data layer only — formioform
# still reads its local configs at runtime, no behavior change yet.
#
# `transform` field references a name (parseDate/icaoToIso2/mapGender) that
# the formioform-side registry will dispatch — strings only, configs stay
# JSON-portable.
#
# Idempotent: upserts by (key, firmId). Canonical configs (firmId omitted)
# are shared across all firms. Per-firm overrides are a future slice.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "documents": [
    {
      "key": "passportDocument",
      "name": "Passeport",
      "expectedDocumentType": "un passeport",
      "prompt": "Extract the following fields from this passport image. Read the visual text fields on the passport page, not just the MRZ zone.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"firstName\": \"Given names (properly capitalized)\",\n  \"lastName\": \"Surname / family name (properly capitalized)\",\n  \"dateOfBirth\": \"YYYY-MM-DD format\",\n  \"gender\": \"M or F\",\n  \"nationality\": \"3-letter ICAO country code (e.g. FRA, CAN, MAR)\",\n  \"passportNumber\": \"Passport document number\",\n  \"passportExpiryDate\": \"YYYY-MM-DD format\",\n  \"passportIssueDate\": \"YYYY-MM-DD format (date of issue / date de délivrance)\",\n  \"issuingCountry\": \"3-letter ICAO country code of the issuing country\",\n  \"birthCity\": \"City/place of birth as written on the passport\",\n  \"birthCountry\": \"3-letter ICAO country code of the country of birth\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "firstName",          "externalId": "firstName",          "displayLabel": "Prénom" },
        { "sourceKey": "lastName",           "externalId": "lastName",           "displayLabel": "Nom de famille" },
        { "sourceKey": "dateOfBirth",        "externalId": "dateOfBirth",        "displayLabel": "Date de naissance",     "transform": "parseDate" },
        { "sourceKey": "gender",             "externalId": "gender",             "displayLabel": "Sexe",                  "transform": "mapGender" },
        { "sourceKey": "nationality",        "externalId": "nationality",        "displayLabel": "Nationalité",           "transform": "icaoToIso2" },
        { "sourceKey": "passportNumber",     "externalId": "passportNumber",     "displayLabel": "Numéro de passeport" },
        { "sourceKey": "passportExpiryDate", "externalId": "passportExpiryDate", "displayLabel": "Date d'expiration",     "transform": "parseDate" },
        { "sourceKey": "passportIssueDate",  "externalId": "passportIssueDate",  "displayLabel": "Date de délivrance",    "transform": "parseDate" },
        { "sourceKey": "issuingCountry",     "externalId": "passportCountry",    "displayLabel": "Pays de délivrance",    "transform": "icaoToIso2" },
        { "sourceKey": "birthCity",          "externalId": "birthCity",          "displayLabel": "Ville de naissance" },
        { "sourceKey": "birthCountry",       "externalId": "birthCountry",       "displayLabel": "Pays de naissance",     "transform": "icaoToIso2" }
      ]
    },
    {
      "key": "nationalIdDocument",
      "name": "Carte nationale d'identité",
      "expectedDocumentType": "une carte nationale d'identité",
      "prompt": "Extract the following fields from this national identity card image.\nRead both sides if visible.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"idNumber\": \"The national identity card number\",\n  \"issuingCountry\": \"3-letter ICAO country code of the issuing country (e.g. FRA, MAR, DZA, TUN)\",\n  \"validity\": \"Validity period as text, e.g. '01/01/2020 - 01/01/2030'\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "idNumber",       "externalId": "nationalIdNumber",   "displayLabel": "Numéro de la pièce" },
        { "sourceKey": "issuingCountry", "externalId": "nationalIdCountry",  "displayLabel": "Pays de délivrance", "transform": "icaoToIso2" },
        { "sourceKey": "validity",       "externalId": "nationalIdValidity", "displayLabel": "Dates de validité" }
      ]
    },
    {
      "key": "marriageCertificate",
      "name": "Acte de mariage",
      "expectedDocumentType": "un acte de mariage ou certificat d'union civile",
      "prompt": "Extract the following fields from this marriage certificate or civil union document.\nThe document may be in French, English, Arabic, or another language.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"marriageDate\": \"YYYY-MM-DD format (date of the marriage or civil union)\",\n  \"spouseFullName\": \"Full name of the spouse (the other person on the certificate)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "marriageDate",   "externalId": "marriageDate",   "displayLabel": "Date du mariage", "transform": "parseDate" },
        { "sourceKey": "spouseFullName", "externalId": "spouseFullName", "displayLabel": "Nom du conjoint(e)" }
      ]
    },
    {
      "key": "spousePassport",
      "name": "Passeport du conjoint",
      "expectedDocumentType": "un passeport",
      "skipNameVerification": true,
      "prompt": "Extract the following fields from this passport image (this is the applicant's spouse's passport).\nRead the visual text fields on the passport page, not just the MRZ zone.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"fullName\": \"Full name (surname followed by given names, properly capitalized)\",\n  \"gender\": \"M or F\",\n  \"dateOfBirth\": \"YYYY-MM-DD format\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "fullName",    "externalId": "spouseFullName",    "displayLabel": "Nom du conjoint(e)" },
        { "sourceKey": "gender",      "externalId": "spouseGender",      "displayLabel": "Sexe du conjoint(e)",      "transform": "mapGender" },
        { "sourceKey": "dateOfBirth", "externalId": "spouseDateOfBirth", "displayLabel": "Date de naissance du conjoint(e)", "transform": "parseDate" }
      ]
    },
    {
      "key": "divorceDocument",
      "name": "Jugement de divorce",
      "expectedDocumentType": "un jugement de divorce ou acte de dissolution d'union",
      "skipNameVerification": true,
      "prompt": "Extract the following fields from this divorce decree or dissolution of union document.\nThe document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"exSpouseName\": \"Full name of the ex-spouse\",\n  \"exSpouseDob\": \"YYYY-MM-DD format (date of birth of the ex-spouse, if visible)\",\n  \"unionPeriod\": \"The period of the union as text, e.g. '06/2010 - 03/2018'\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "exSpouseName", "externalId": "exSpouseName",        "displayLabel": "Nom de l'ex-conjoint(e)" },
        { "sourceKey": "exSpouseDob",  "externalId": "exSpouseDob",         "displayLabel": "Date de naissance de l'ex-conjoint(e)", "transform": "parseDate" },
        { "sourceKey": "unionPeriod",  "externalId": "exSpouseUnionPeriod", "displayLabel": "Période de l'union" }
      ]
    },
    {
      "key": "empAttestationCurrent",
      "name": "Attestation d'emploi actuelle",
      "expectedDocumentType": "une attestation d'emploi ou lettre d'employeur",
      "prompt": "Extract the following fields from this employment attestation or employment letter.\nRead all visible text including letterhead and body.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"jobTitle\": \"The employee's job title or position\",\n  \"startDate\": \"YYYY-MM-DD format (employment start date)\",\n  \"companyName\": \"Name of the employer or company\",\n  \"companyAddress\": \"City and country of the company\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "jobTitle",       "externalId": "empJobTitle",       "displayLabel": "Titre de poste" },
        { "sourceKey": "startDate",      "externalId": "empStartDate",      "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "companyName",    "externalId": "empCompanyName",    "displayLabel": "Nom de l'entreprise" },
        { "sourceKey": "companyAddress", "externalId": "empCompanyAddress", "displayLabel": "Adresse de l'entreprise" }
      ]
    },
    {
      "key": "diploma1Document",
      "name": "Diplôme #1",
      "expectedDocumentType": "un diplôme ou certificat scolaire",
      "prompt": "Extract the following fields from this diploma or degree certificate image.\nRead all visible text on the document. The document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"diplomaName\": \"Name/type of the degree or diploma (e.g. Baccalauréat, Master, Licence, DEC)\",\n  \"field\": \"Field of study or specialization\",\n  \"school\": \"Full name of the educational institution\",\n  \"location\": \"City and country of the institution (e.g. Paris, France)\",\n  \"startDate\": \"YYYY-MM-DD format (start of studies, if visible)\",\n  \"endDate\": \"YYYY-MM-DD format (graduation or completion date)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "diplomaName", "externalId": "diploma1Name",      "displayLabel": "Nom du diplôme" },
        { "sourceKey": "field",       "externalId": "diploma1Field",     "displayLabel": "Domaine d'études" },
        { "sourceKey": "school",      "externalId": "diploma1School",    "displayLabel": "Établissement" },
        { "sourceKey": "location",    "externalId": "diploma1Location",  "displayLabel": "Lieu" },
        { "sourceKey": "startDate",   "externalId": "diploma1StartDate", "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "endDate",     "externalId": "diploma1EndDate",   "displayLabel": "Date de fin",   "transform": "parseDate" }
      ]
    },
    {
      "key": "diploma2Document",
      "name": "Diplôme #2",
      "expectedDocumentType": "un diplôme ou certificat scolaire",
      "prompt": "Extract the following fields from this diploma or degree certificate image.\nRead all visible text on the document. The document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"diplomaName\": \"Name/type of the degree or diploma (e.g. Baccalauréat, Master, Licence, DEC)\",\n  \"field\": \"Field of study or specialization\",\n  \"school\": \"Full name of the educational institution\",\n  \"location\": \"City and country of the institution (e.g. Paris, France)\",\n  \"startDate\": \"YYYY-MM-DD format (start of studies, if visible)\",\n  \"endDate\": \"YYYY-MM-DD format (graduation or completion date)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "diplomaName", "externalId": "diploma2Name",      "displayLabel": "Nom du diplôme" },
        { "sourceKey": "field",       "externalId": "diploma2Field",     "displayLabel": "Domaine d'études" },
        { "sourceKey": "school",      "externalId": "diploma2School",    "displayLabel": "Établissement" },
        { "sourceKey": "location",    "externalId": "diploma2Location",  "displayLabel": "Lieu" },
        { "sourceKey": "startDate",   "externalId": "diploma2StartDate", "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "endDate",     "externalId": "diploma2EndDate",   "displayLabel": "Date de fin",   "transform": "parseDate" }
      ]
    },
    {
      "key": "diploma3Document",
      "name": "Diplôme #3",
      "expectedDocumentType": "un diplôme ou certificat scolaire",
      "prompt": "Extract the following fields from this diploma or degree certificate image.\nRead all visible text on the document. The document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"diplomaName\": \"Name/type of the degree or diploma (e.g. Baccalauréat, Master, Licence, DEC)\",\n  \"field\": \"Field of study or specialization\",\n  \"school\": \"Full name of the educational institution\",\n  \"location\": \"City and country of the institution (e.g. Paris, France)\",\n  \"startDate\": \"YYYY-MM-DD format (start of studies, if visible)\",\n  \"endDate\": \"YYYY-MM-DD format (graduation or completion date)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "diplomaName", "externalId": "diploma3Name",      "displayLabel": "Nom du diplôme" },
        { "sourceKey": "field",       "externalId": "diploma3Field",     "displayLabel": "Domaine d'études" },
        { "sourceKey": "school",      "externalId": "diploma3School",    "displayLabel": "Établissement" },
        { "sourceKey": "location",    "externalId": "diploma3Location",  "displayLabel": "Lieu" },
        { "sourceKey": "startDate",   "externalId": "diploma3StartDate", "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "endDate",     "externalId": "diploma3EndDate",   "displayLabel": "Date de fin",   "transform": "parseDate" }
      ]
    },
    {
      "key": "diploma4Document",
      "name": "Diplôme #4",
      "expectedDocumentType": "un diplôme ou certificat scolaire",
      "prompt": "Extract the following fields from this diploma or degree certificate image.\nRead all visible text on the document. The document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"diplomaName\": \"Name/type of the degree or diploma (e.g. Baccalauréat, Master, Licence, DEC)\",\n  \"field\": \"Field of study or specialization\",\n  \"school\": \"Full name of the educational institution\",\n  \"location\": \"City and country of the institution (e.g. Paris, France)\",\n  \"startDate\": \"YYYY-MM-DD format (start of studies, if visible)\",\n  \"endDate\": \"YYYY-MM-DD format (graduation or completion date)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "diplomaName", "externalId": "diploma4Name",      "displayLabel": "Nom du diplôme" },
        { "sourceKey": "field",       "externalId": "diploma4Field",     "displayLabel": "Domaine d'études" },
        { "sourceKey": "school",      "externalId": "diploma4School",    "displayLabel": "Établissement" },
        { "sourceKey": "location",    "externalId": "diploma4Location",  "displayLabel": "Lieu" },
        { "sourceKey": "startDate",   "externalId": "diploma4StartDate", "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "endDate",     "externalId": "diploma4EndDate",   "displayLabel": "Date de fin",   "transform": "parseDate" }
      ]
    },
    {
      "key": "diploma5Document",
      "name": "Diplôme #5",
      "expectedDocumentType": "un diplôme ou certificat scolaire",
      "prompt": "Extract the following fields from this diploma or degree certificate image.\nRead all visible text on the document. The document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"diplomaName\": \"Name/type of the degree or diploma (e.g. Baccalauréat, Master, Licence, DEC)\",\n  \"field\": \"Field of study or specialization\",\n  \"school\": \"Full name of the educational institution\",\n  \"location\": \"City and country of the institution (e.g. Paris, France)\",\n  \"startDate\": \"YYYY-MM-DD format (start of studies, if visible)\",\n  \"endDate\": \"YYYY-MM-DD format (graduation or completion date)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "diplomaName", "externalId": "diploma5Name",      "displayLabel": "Nom du diplôme" },
        { "sourceKey": "field",       "externalId": "diploma5Field",     "displayLabel": "Domaine d'études" },
        { "sourceKey": "school",      "externalId": "diploma5School",    "displayLabel": "Établissement" },
        { "sourceKey": "location",    "externalId": "diploma5Location",  "displayLabel": "Lieu" },
        { "sourceKey": "startDate",   "externalId": "diploma5StartDate", "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "endDate",     "externalId": "diploma5EndDate",   "displayLabel": "Date de fin",   "transform": "parseDate" }
      ]
    },
    {
      "key": "diploma6Document",
      "name": "Diplôme #6",
      "expectedDocumentType": "un diplôme ou certificat scolaire",
      "prompt": "Extract the following fields from this diploma or degree certificate image.\nRead all visible text on the document. The document may have multiple pages.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"diplomaName\": \"Name/type of the degree or diploma (e.g. Baccalauréat, Master, Licence, DEC)\",\n  \"field\": \"Field of study or specialization\",\n  \"school\": \"Full name of the educational institution\",\n  \"location\": \"City and country of the institution (e.g. Paris, France)\",\n  \"startDate\": \"YYYY-MM-DD format (start of studies, if visible)\",\n  \"endDate\": \"YYYY-MM-DD format (graduation or completion date)\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "diplomaName", "externalId": "diploma6Name",      "displayLabel": "Nom du diplôme" },
        { "sourceKey": "field",       "externalId": "diploma6Field",     "displayLabel": "Domaine d'études" },
        { "sourceKey": "school",      "externalId": "diploma6School",    "displayLabel": "Établissement" },
        { "sourceKey": "location",    "externalId": "diploma6Location",  "displayLabel": "Lieu" },
        { "sourceKey": "startDate",   "externalId": "diploma6StartDate", "displayLabel": "Date de début", "transform": "parseDate" },
        { "sourceKey": "endDate",     "externalId": "diploma6EndDate",   "displayLabel": "Date de fin",   "transform": "parseDate" }
      ]
    }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run documents:seedCanonicalDocuments "$ARGS")
echo "[seed] 12 canonical document configs upserted"
