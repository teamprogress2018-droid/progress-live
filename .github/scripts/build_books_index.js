#!/usr/bin/env node
/**
 * Baza wiedzy z książek: czyta knowledge/books/*.json (jeden plik = jedna książka)
 * i zapisuje knowledge/books-index.json — spłaszczone reguły, które aplikacja
 * podaje AI przy generowaniu planu (books-kb.js).
 *
 * Nowa książka = nowy plik w knowledge/books/ + `node .github/scripts/build_books_index.js`
 * (workflow books-index.yml robi to sam po wypchnięciu pliku na main).
 *
 * Tryb sprawdzający: `--check` kończy się błędem, gdy indeks jest nieaktualny.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const BOOKS_DIR = path.join(ROOT, 'knowledge', 'books');
const OUT = path.join(ROOT, 'knowledge', 'books-index.json');

const MAX_TEXT = 700;
/** Sekcje, które nie są regułami (metadane, pokrycie, braki). */
const SKIP_SECTIONS = new Set(['meta', 'coverage', 'sourceReferences', 'gaps']);
/** Sekcje z innej dziedziny niż trening — trafiają do AI tylko w swoim trybie. */
const SECTION_DOMAIN = {
  nutritionRules: 'nutrition', recipes: 'nutrition', lifestyleRules: 'nutrition',
  communicationRules: 'coaching', communicationParameters: 'coaching', communicationTemplates: 'coaching',
  clientArchetypes: 'coaching', adherenceRules: 'coaching', behaviorRules: 'coaching',
  psychologyRules: 'coaching', techniqueMap: 'coaching',
  marketingRules: 'marketing'
};
const TRAINING_SECTIONS = ['exerciseRules', 'progressionRules', 'planTemplates'];
const STATUS_OK = new Set(['zrodlo', 'wniosek', 'poza_zrodlem', 'zrodlo+wniosek', 'zrodlo+poza_zrodlem']);
/** Pola pomijane w tekście reguły (identyfikatory, statusy pól, tłumaczenia oryginału). */
const SKIP_FIELDS = new Set(['id', 'sources', 'status', 'nameFr', 'summaryStatus', 'trainerUseStatus', 'relevance']);

function bookIdFromFile(file) {
  return file.replace(/\.json$/i, '').replace(/-baza-wiedzy$/i, '');
}

function firstRef(data) {
  return Array.isArray(data.sourceReferences) && data.sourceReferences[0] && typeof data.sourceReferences[0] === 'object'
    ? data.sourceReferences[0] : {};
}

function str(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ');
  if (typeof v === 'object' && 'value' in v) return str(v.value);
  return String(v);
}

function bookMeta(file, data) {
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const ref = firstRef(data);
  const title = str(meta.titlePl || ref.titlePl || meta.title || ref.title || data.title || ref.titleAsLabelled) || bookIdFromFile(file);
  const author = str(meta.author || meta.authors || meta.editors || ref.author || ref.bookAuthor || data.author || data.editors);
  const year = str(meta.year || ref.year || data.year);
  return { title: title.replace(/^Baza wiedzy Progress Live:\s*/i, ''), author, year };
}

/** Dziedzina książki: trening, chyba że reguły innej dziedziny przeważają nad treningowymi. */
function bookDomain(data) {
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  if (meta.domain) return String(meta.domain);
  const count = k => (Array.isArray(data[k]) ? data[k].length : 0);
  const training = TRAINING_SECTIONS.reduce((n, k) => n + count(k), 0);
  const other = {};
  Object.keys(data).forEach(k => { if (SECTION_DOMAIN[k]) other[SECTION_DOMAIN[k]] = (other[SECTION_DOMAIN[k]] || 0) + count(k); });
  let best = 'training', bestN = training;
  Object.keys(other).forEach(d => { if (other[d] > bestN) { best = d; bestN = other[d]; } });
  return best;
}

/** Tekst reguły: "pole: wartość; ..." bez identyfikatorów i źródeł. */
function flatten(v, depth) {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.map(x => flatten(x, depth + 1)).filter(Boolean).join(', ');
  const parts = [];
  for (const k of Object.keys(v)) {
    if (SKIP_FIELDS.has(k)) continue;
    const val = flatten(v[k], depth + 1);
    if (!val) continue;
    parts.push(depth > 2 ? val : k + ': ' + val);
  }
  return depth ? '{' + parts.join('; ') + '}' : parts.join('; ');
}

function collectSources(v, out) {
  if (!v || typeof v !== 'object') return out;
  if (Array.isArray(v)) { v.forEach(x => collectSources(x, out)); return out; }
  if (Array.isArray(v.sources)) v.sources.forEach(s => { if (s && typeof s === 'object') out.push(s); });
  Object.keys(v).forEach(k => { if (k !== 'sources') collectSources(v[k], out); });
  return out;
}

function pagesOf(sources) {
  const seen = new Set();
  const pages = [];
  sources.forEach(s => {
    const p = str(s.pages || s.page || s.pdfPages);
    if (p && !seen.has(p)) { seen.add(p); pages.push(p); }
  });
  return pages.slice(0, 3).join('; ');
}

function topStatus(o) {
  if (o.status) return String(o.status);
  /* Reguły z polami {value,status}: najsłabszy status wśród pól. */
  const found = new Set();
  (function walk(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x.status === 'string') found.add(x.status);
    Object.keys(x).forEach(k => walk(x[k]));
  })(o);
  if (found.has('zrodlo') && found.size === 1) return 'zrodlo';
  if (found.has('zrodlo') || found.has('wniosek')) return 'wniosek';
  if (found.has('poza_zrodlem')) return 'poza_zrodlem';
  if (found.has('brak_w_zrodle')) return 'brak_w_zrodle';
  return 'wniosek';
}

function buildIndex(dir) {
  const files = fs.readdirSync(dir).filter(f => /\.json$/i.test(f)).sort();
  const books = [];
  const chunks = [];
  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const id = bookIdFromFile(file);
    const meta = bookMeta(file, data);
    const domain = bookDomain(data);
    const bi = books.length;
    let n = 0;
    Object.keys(data).forEach(section => {
      if (SKIP_SECTIONS.has(section) || !Array.isArray(data[section])) return;
      data[section].forEach((rule, ri) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return;
        const status = topStatus(rule);
        if (!STATUS_OK.has(status)) return; // brak_w_zrodle = książka tego nie mówi
        let text = flatten(rule, 0).replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT - 1).trimEnd() + '…';
        chunks.push({
          b: bi,
          s: section,
          id: String(rule.id || rule.n || section + '-' + (ri + 1)),
          st: status.split('+')[0],
          d: SECTION_DOMAIN[section] || domain,
          p: pagesOf(collectSources(rule, [])),
          t: text
        });
        n++;
      });
    });
    books.push({ id, file: 'knowledge/books/' + file, title: meta.title, author: meta.author, year: meta.year, domain, rules: n });
  });
  return { version: 1, books, chunks };
}

function serialize(index) {
  /* Jedna reguła w linii — czytelny diff przy dodaniu książki. */
  const lines = ['{"version":' + index.version + ',', '"books":['];
  index.books.forEach((b, i) => lines.push(JSON.stringify(b) + (i < index.books.length - 1 ? ',' : '')));
  lines.push('],', '"chunks":[');
  index.chunks.forEach((c, i) => lines.push(JSON.stringify(c) + (i < index.chunks.length - 1 ? ',' : '')));
  lines.push(']}', '');
  return lines.join('\n');
}

if (require.main === module) {
  const out = serialize(buildIndex(BOOKS_DIR));
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== out) {
      console.error('knowledge/books-index.json jest nieaktualny — uruchom: node .github/scripts/build_books_index.js');
      process.exit(1);
    }
    console.log('OK   knowledge/books-index.json aktualny');
  } else {
    fs.writeFileSync(OUT, out);
    const idx = JSON.parse(out);
    console.log('Zapisano knowledge/books-index.json: ' + idx.books.length + ' książek, ' + idx.chunks.length + ' reguł, ' + Math.round(out.length / 1024) + ' KB');
    idx.books.forEach(b => console.log('  - ' + b.id + ' [' + b.domain + '] ' + b.rules + ' reguł — ' + b.title));
  }
}

module.exports = { buildIndex, serialize, bookDomain, flatten, topStatus };
