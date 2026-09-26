#!/usr/bin/env node
'use strict';
/** Importy w EX, które dublują katalog DEF_EX: nazwa / aka / (1), bez sklejania wariantów. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 06 v76', html.includes('06-inbox-exercises-ai-programs.js?v=85'));
ok('cache styles v88', html.includes('styles.css?v=118'));
ok('ci unit', wf.includes('test_ex_import_dedupe.js'));
ok('ci ui', wf.includes('test_ex_import_dedupe_ui.js'));
ok('button markup', html.includes('id="lib-sweep-dups"') && html.includes('Usuń duplikaty'));
ok('login sweep', /sweepImportedCatalogDuplicates\(\{silent:true\}\)/.test(html));
ok('narrow hides tip only', /max-width:\s*1200px[\s\S]*ex-list-tip\{display:none/.test(css.replace(/\s+/g, '')));
ok('narrow keeps actions', !/max-width:\s*860px[\s\S]*ex-list-row\s*>\s*\*:nth-child\(5\)\{display:none/.test(css.replace(/\s+/g, '')));
ok('list row classes', /ex-list-tip/.test(six) && /ex-list-actions/.test(six));

const m = six.match(/const DEF_EX=\[([\s\S]*?)\];\nwindow\.DEF_EX=DEF_EX;/);
ok('DEF_EX block', !!m);
const start = six.indexOf('function catalogDedupeKey');
const end = six.indexOf('async function saveEx');
ok('slice', start > 0 && end > start);

const deleted = [];
const persistedGifs = [];
const notifies = [];
const documentStub = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const windowObj = {
  EX: [],
  DEF_EX: [],
  EX_GIF_REMOTE: {},
  document: documentStub,
  _uid: 'trainer-1',
  _db: {},
  _doc: (_db, col, id) => ({ col, id }),
  _del: async (ref) => { deleted.push(ref); },
  _setDoc: async () => {}
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined, Promise, Map, Set,
  confirm: () => true,
  notify(msg) { notifies.push(String(msg || '')); },
  exerciseMediaKey(name) { return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim(); },
  isSafeMediaUrl(url) { return /^https?:\/\//i.test(String(url || '')); },
  isVideoMediaUrl(url) { return /\.(mp4|webm)(\?|#|$)/i.test(String(url || '')); },
  isLocalDiskMediaPath() { return false; },
  normalizeImportedMediaUrl(u) { return String(u || '').trim(); },
  async persistExerciseGifUrl(name, url) {
    const key = ctx.exerciseMediaKey(name);
    windowObj.EX_GIF_REMOTE[key] = url;
    persistedGifs.push({ name, url });
    return true;
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInNewContext('const DEF_EX=[' + m[1] + ']; window.DEF_EX=DEF_EX;', { window: windowObj });
windowObj.DEF_EX = windowObj.DEF_EX;
ctx.DEF_EX = windowObj.DEF_EX;
vm.runInContext(six.slice(start, end), ctx);

function card(name) {
  return ctx.catalogCardForImport(name, windowObj.DEF_EX);
}

ok('floor press aka', card('Floor press') && card('Floor press').name === 'Wyciskanie z podłogi');
ok('floor press case', card('FLOOR PRESS').name === 'Wyciskanie z podłogi');
ok('floor press (1)', card('Floor press (1)').name === 'Wyciskanie z podłogi');
ok('pl copy (1)', card('Wyciskanie z podłogi (1)').name === 'Wyciskanie z podłogi');
ok('diamond stays own card', card('Pompki diamentowe').name === 'Pompki diamentowe');
ok('knees stays own card', card('Pompki na kolanach').name === 'Pompki na kolanach');
ok('handles stays own card', card('Pompki na rączkach').name === 'Pompki na rączkach');
ok('diamond not pompki', card('Diamond Push Ups').name === 'Pompki diamentowe');
ok('pompki (1) is pompki', card('Pompki (1)').name === 'Pompki');
ok('weighted dip own', card('Dipy z obciążeniem').name === 'Dipy z obciążeniem');
ok('weighted aka', card('Weighted dip').name === 'Dipy z obciążeniem');
ok('crossover high-low', card('Krzyżowanie wyciągów góra–dół').name === 'Krzyżowanie wyciągów góra–dół');
ok('crossover low-high', card('Krzyżowanie wyciągów dół–góra').name === 'Krzyżowanie wyciągów dół–góra');
ok('crossovers distinct', card('Krzyżowanie wyciągów góra–dół') !== card('Krzyżowanie wyciągów dół–góra'));
ok('skos+ own', card('Wyciskanie sztangi skos+').name === 'Wyciskanie sztangi skos+');
ok('skos− own', card('Wyciskanie sztangi skos−').name === 'Wyciskanie sztangi skos−');
ok('skos distinct', card('Wyciskanie sztangi skos+') !== card('Wyciskanie sztangi skos−'));
ok('unique custom stays', !card('Moje wyciskanie smoka'));

(async () => {
  const film = 'https://cdn.example.com/floor-press.mp4';
  windowObj.EX = [
    { id: 'ex-floor', name: 'Floor press', video: film, cat: 'Klatka piersiowa' },
    { id: 'ex-floor-1', name: 'Floor press (1)', gif: '', cat: 'Klatka piersiowa' },
    { id: 'ex-pl-1', name: 'wyciskanie z podłogi', cat: 'Klatka piersiowa' },
    { id: 'ex-diamond', name: 'Pompki diamentowe', cat: 'Klatka piersiowa' },
    { id: 'ex-knees', name: 'Pompki na kolanach', cat: 'Klatka piersiowa' },
    { id: 'ex-handles', name: 'Pompki na rączkach', cat: 'Klatka piersiowa' },
    { id: 'ex-wdip', name: 'Dipy z obciążeniem', cat: 'Klatka piersiowa' },
    { id: 'ex-hi', name: 'Krzyżowanie wyciągów góra–dół', cat: 'Klatka piersiowa' },
    { id: 'ex-lo', name: 'Krzyżowanie wyciągów dół–góra', cat: 'Klatka piersiowa' },
    { id: 'ex-plus', name: 'Wyciskanie sztangi skos+', cat: 'Klatka piersiowa' },
    { id: 'ex-minus', name: 'Wyciskanie sztangi skos−', cat: 'Klatka piersiowa' },
    { id: 'ex-own', name: 'Moje wyciskanie smoka', cat: 'Klatka piersiowa' }
  ];
  const r = await ctx.sweepImportedCatalogDuplicates({ silent: true });
  ok('removed import dups', r.removed >= 3, String(r.removed));
  ok('copied floor film', persistedGifs.some((g) => g.name === 'Wyciskanie z podłogi' && g.url === film), JSON.stringify(persistedGifs));
  ok('firestore deleted floor', deleted.some((d) => d && d.id === 'ex-floor'));
  ok('own custom kept', windowObj.EX.some((e) => e.name === 'Moje wyciskanie smoka'));
  ok('variants still distinct cards', ['Pompki diamentowe', 'Pompki na kolanach', 'Pompki na rączkach', 'Dipy z obciążeniem', 'Krzyżowanie wyciągów góra–dół', 'Krzyżowanie wyciągów dół–góra', 'Wyciskanie sztangi skos+', 'Wyciskanie sztangi skos−'].every((n) => windowObj.DEF_EX.some((e) => e.name === n)));
  const namesLeft = windowObj.EX.map((e) => e.name);
  ok('floor imports gone', !namesLeft.some((n) => /floor press/i.test(n)) && !namesLeft.some((n) => /wyciskanie z podłogi/i.test(n)));
  ok('variant imports also catalog dups removed', !namesLeft.includes('Pompki diamentowe'));
  ok('silent still notifies when removed', notifies.some((m) => /Usunięto/.test(m)), notifies.join(' | '));

  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll ex-import-dedupe tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
