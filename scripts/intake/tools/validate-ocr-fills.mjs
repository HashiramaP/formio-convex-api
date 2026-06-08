// validate-ocr-fills.mjs — OCR-fill integrity check (Lever B guardrail).
// Every `documents.fills[].externalId` must resolve to a real question, else the
// OCR extraction is silently dropped at autofill time. Reports orphans.
//
//   npx convex export --path /tmp/snap.zip && unzip -o /tmp/snap.zip -d /tmp/snap
//   node validate-ocr-fills.mjs /tmp/snap
//
// Exit code 1 if any orphan is found (so it can gate a seed/CI step).
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node validate-ocr-fills.mjs <unzipped-convex-export-dir>'); process.exit(2); }
const rd = (t) => fs.readFileSync(path.join(dir, t, 'documents.jsonl'), 'utf8')
  .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

const questions = rd('questions');
const documents = rd('documents');
const qids = new Set(questions.map((q) => q.externalId));

const orphans = [];
for (const d of documents) {
  for (const f of (d.fills || [])) {
    if (f.externalId && !qids.has(f.externalId)) {
      orphans.push({ doc: d.key, externalId: f.externalId, sourceKey: f.sourceKey, firm: d.firmId ? 'firm' : 'canonical' });
    }
  }
}
if (orphans.length === 0) {
  console.log(`✅ OCR fills valid — every fill resolves to a question (${documents.length} docs checked).`);
  process.exit(0);
}
console.log(`⚠ ${orphans.length} ORPHAN fills (OCR autofill silently lost):`);
for (const o of orphans) console.log(`  ${o.doc} (${o.firm}) → ${o.externalId}  [sourceKey: ${o.sourceKey}]`);
process.exit(1);
