// extract-imm-xfa.mjs — render an IRCC XFA IMM form to a clean structured field
// list using pdf.js (headless, no Adobe). Output: JSON to stdout.
//
//   node extract-imm-xfa.mjs <pdf-path-or-url> [--pdfjs <dirWithPdfjsInNodeModules>]
//
// pdf.js (pdfjs-dist) is not a dependency of this repo; by default we borrow it
// from the sibling `Formio` app's node_modules. Override with --pdfjs or the
// PDFJS_DIR env var. The XFA "allXfaHtml" tree carries every field's aria-label
// (full question text incl. section + Q-number), name, type, and select options
// — strictly more complete than AcroForm field extraction. See README.md.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const _warn = console.warn, _log = console.log;
console.warn = () => {}; console.log = () => {}; // silence pdf.js polyfill noise

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const src = args[0];
if (!src) { _log('usage: node extract-imm-xfa.mjs <pdf-path-or-url> [--pdfjs <dir>]'); process.exit(1); }
const pdfjsDir = (() => {
  const i = args.indexOf('--pdfjs');
  if (i >= 0) return args[i + 1];
  if (process.env.PDFJS_DIR) return process.env.PDFJS_DIR;
  return path.resolve(here, '../../../../Formio'); // sibling repo default
})();
const pdfjs = createRequire(pdfjsDir + '/')('pdfjs-dist/legacy/build/pdf.js');

async function loadBytes(s) {
  if (/^https?:\/\//.test(s)) { const r = await fetch(s); if (!r.ok) throw new Error('fetch ' + r.status); return new Uint8Array(await r.arrayBuffer()); }
  return new Uint8Array(fs.readFileSync(s));
}
const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
const txt = (n) => (n && typeof n.value === 'string') ? n.value : '';
function gatherText(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (txt(node).trim()) out.push(txt(node).trim());
  (node.children || []).forEach((c) => gatherText(c, out));
  return out;
}
function extractFields(pageNode, page, acc) {
  let lastCaption = '';
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    const a = node.attributes || {}; const name = node.name;
    if (name === 'label' || name === 'p' || name === 'span') {
      const t = gatherText(node).join(' ').replace(/\s+/g, ' ').trim();
      if (t) lastCaption = t;
    }
    if (FIELD_TAGS.has(name)) {
      const label = (a['aria-label'] || a.title || lastCaption || '').replace(/\s+/g, ' ').trim();
      const field = {
        page, order: acc.length, tag: name,
        type: a.type || (name === 'select' ? 'select' : name),
        xfaName: a.name || a.fieldId || null, label,
        required: a.required === 'required' || a['aria-required'] === 'true' || undefined,
      };
      if (name === 'select') {
        const opts = [];
        (function opt(n) { if (!n || typeof n !== 'object') return; if (n.name === 'option') { const t = gatherText(n).join(' ').trim(); if (t) opts.push(t); } (n.children || []).forEach(opt); })(node);
        if (opts.length) field.options = opts;
      }
      if (a.type === 'radio') field.radioGroup = a.name;
      acc.push(field);
    }
    (node.children || []).forEach(walk);
  })(pageNode);
}

const data = await loadBytes(src);
const doc = await pdfjs.getDocument({ data, enableXfa: true }).promise;
const xfa = await doc.allXfaHtml; // null for non-XFA (AcroForm/static) PDFs
const pages = ((xfa && xfa.children) || []).filter((c) => String((c.attributes || {}).class || '').includes('xfaPage'));
const fields = [];
pages.forEach((p, i) => extractFields(p, i + 1, fields));
const pageText = [];
for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const tc = await pg.getTextContent(); pageText.push(tc.items.map((x) => x.str).join(' ').trim().length); }

const out = {
  source: src, numPages: doc.numPages, xfaPages: pages.length, fieldCount: fields.length,
  staticTextCharsPerPage: pageText,
  needsFallback: pages.length === 0 && pageText.every((c) => c < 50), // truly-dynamic XFA with no static text → needs Adobe/Playwright fallback
  fields,
};
console.log = _log; console.warn = _warn;
process.stdout.write(JSON.stringify(out, null, 2));
