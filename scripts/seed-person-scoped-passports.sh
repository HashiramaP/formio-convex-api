#!/usr/bin/env bash
# Slice 2e — person-scoped passport doc types for the IMM-indexed flow.
# The original `passportDocument` config (in seed-canonical-documents.sh)
# fills sponsor/répondant identity fields (firstName, lastName, etc.). For
# parrainage demandes we also need to OCR the sponsored person's passport
# AND the cosignataire's passport — each fills a different person-scoped
# set of catalog externalIds.
#
# Both new configs set skipNameVerification: true because we can't reliably
# cross-check these passports against a single "applicant name" (sponsored
# and cosigner have their own names, separate from the répondant who fills
# the wizard).
#
# Idempotent: upserts by key.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read -r -d '' ARGS <<'JSON' || true
{
  "documents": [
    {
      "key": "sponsoredPassport",
      "name": "Passeport de la personne parrainée",
      "expectedDocumentType": "un passeport (de la personne parrainée)",
      "skipNameVerification": true,
      "prompt": "Extract the following fields from this passport image (this is the SPONSORED person's passport — the applicant being parrainé, not the sponsor). Read the visual text fields on the passport page, not just the MRZ zone.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"firstName\": \"Given names (properly capitalized)\",\n  \"lastName\": \"Surname / family name (properly capitalized)\",\n  \"dateOfBirth\": \"YYYY-MM-DD format\",\n  \"gender\": \"M or F\",\n  \"nationality\": \"3-letter ICAO country code (e.g. FRA, CAN, MAR)\",\n  \"passportNumber\": \"Passport document number\",\n  \"passportExpiryDate\": \"YYYY-MM-DD format\",\n  \"passportIssueDate\": \"YYYY-MM-DD format (date of issue / date de délivrance)\",\n  \"issuingCountry\": \"3-letter ICAO country code of the issuing country\",\n  \"birthCity\": \"City/place of birth as written on the passport\",\n  \"birthCountry\": \"3-letter ICAO country code of the country of birth\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "firstName",          "externalId": "sponsoredFirstName",          "displayLabel": "Prénom de la personne parrainée" },
        { "sourceKey": "lastName",           "externalId": "sponsoredLastName",           "displayLabel": "Nom de famille de la personne parrainée" },
        { "sourceKey": "dateOfBirth",        "externalId": "sponsoredDateOfBirth",        "displayLabel": "Date de naissance de la personne parrainée", "transform": "parseDate" },
        { "sourceKey": "gender",             "externalId": "sponsoredGender",             "displayLabel": "Sexe de la personne parrainée",              "transform": "mapGender" },
        { "sourceKey": "nationality",        "externalId": "sponsoredNationality",        "displayLabel": "Nationalité de la personne parrainée",       "transform": "icaoToIso2" },
        { "sourceKey": "passportNumber",     "externalId": "sponsoredPassportNumber",     "displayLabel": "Numéro de passeport de la personne parrainée" },
        { "sourceKey": "passportExpiryDate", "externalId": "sponsoredPassportExpiryDate", "displayLabel": "Date d'expiration du passeport",             "transform": "parseDate" },
        { "sourceKey": "passportIssueDate",  "externalId": "sponsoredPassportIssueDate",  "displayLabel": "Date de délivrance du passeport",            "transform": "parseDate" },
        { "sourceKey": "issuingCountry",     "externalId": "sponsoredPassportCountry",    "displayLabel": "Pays de délivrance du passeport",            "transform": "icaoToIso2" },
        { "sourceKey": "birthCity",          "externalId": "sponsoredBirthCity",          "displayLabel": "Ville de naissance de la personne parrainée" },
        { "sourceKey": "birthCountry",       "externalId": "sponsoredBirthCountry",       "displayLabel": "Pays de naissance de la personne parrainée", "transform": "icaoToIso2" }
      ]
    },
    {
      "key": "cosignerPassport",
      "name": "Passeport du cosignataire",
      "expectedDocumentType": "un passeport (du cosignataire)",
      "skipNameVerification": true,
      "prompt": "Extract the following fields from this passport image (this is the COSIGNER's passport — the spouse/partner of the sponsor who is cosigning the sponsorship undertaking). Read the visual text fields on the passport page, not just the MRZ zone.\n\nReturn ONLY a JSON object with these exact keys (use null for any field you cannot read):\n{\n  \"firstName\": \"Given names (properly capitalized)\",\n  \"lastName\": \"Surname / family name (properly capitalized)\",\n  \"dateOfBirth\": \"YYYY-MM-DD format\",\n  \"gender\": \"M or F\",\n  \"nationality\": \"3-letter ICAO country code (e.g. FRA, CAN, MAR)\",\n  \"passportNumber\": \"Passport document number\",\n  \"passportExpiryDate\": \"YYYY-MM-DD format\",\n  \"passportIssueDate\": \"YYYY-MM-DD format (date of issue / date de délivrance)\",\n  \"issuingCountry\": \"3-letter ICAO country code of the issuing country\",\n  \"birthCity\": \"City/place of birth as written on the passport\",\n  \"birthCountry\": \"3-letter ICAO country code of the country of birth\"\n}\n\nReturn ONLY the JSON, no markdown, no explanation.",
      "fills": [
        { "sourceKey": "firstName",          "externalId": "cosignerFirstName",          "displayLabel": "Prénom du cosignataire" },
        { "sourceKey": "lastName",           "externalId": "cosignerLastName",           "displayLabel": "Nom de famille du cosignataire" },
        { "sourceKey": "dateOfBirth",        "externalId": "cosignerDateOfBirth",        "displayLabel": "Date de naissance du cosignataire", "transform": "parseDate" },
        { "sourceKey": "gender",             "externalId": "cosignerGender",             "displayLabel": "Sexe du cosignataire",              "transform": "mapGender" },
        { "sourceKey": "nationality",        "externalId": "cosignerNationality",        "displayLabel": "Nationalité du cosignataire",       "transform": "icaoToIso2" },
        { "sourceKey": "passportNumber",     "externalId": "cosignerPassportNumber",     "displayLabel": "Numéro de passeport du cosignataire" },
        { "sourceKey": "passportExpiryDate", "externalId": "cosignerPassportExpiryDate", "displayLabel": "Date d'expiration du passeport",    "transform": "parseDate" },
        { "sourceKey": "passportIssueDate",  "externalId": "cosignerPassportIssueDate",  "displayLabel": "Date de délivrance du passeport",   "transform": "parseDate" },
        { "sourceKey": "issuingCountry",     "externalId": "cosignerPassportCountry",    "displayLabel": "Pays de délivrance du passeport",   "transform": "icaoToIso2" },
        { "sourceKey": "birthCity",          "externalId": "cosignerBirthCity",          "displayLabel": "Ville de naissance du cosignataire" },
        { "sourceKey": "birthCountry",       "externalId": "cosignerBirthCountry",       "displayLabel": "Pays de naissance du cosignataire", "transform": "icaoToIso2" }
      ]
    }
  ]
}
JSON

(cd "$CONVEX_DIR" && npx convex run documents:seedCanonicalDocuments "$ARGS")
echo "[seed] sponsoredPassport + cosignerPassport doc configs upserted"
