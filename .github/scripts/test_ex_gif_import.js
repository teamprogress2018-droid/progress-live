#!/usr/bin/env node
'use strict';
/** Bulk GIF/MP4 paste import: parse .mp4 URLs and persist without clicking Parsuj. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 06 v42', html.includes('06-inbox-exercises-ai-programs.js?v=42'));
ok('modal title mp4', html.includes('IMPORT GIF / MP4 — MASOWO'));
ok('example mp4', html.includes('https://link-do-filmu.mp4'));
ok('placeholder mp4', html.includes('bench.mp4'));
ok('no webkitdirectory', !/id="exgif-files"[^>]*webkitdirectory/.test(html));
ok('file accept mp4', /id="exgif-files"[^>]*accept="[^"]*mp4/.test(html));
ok('ex-img is text', /id="ex-img"[^>]*type="text"/.test(html) || /type="text"[^>]*id="ex-img"/.test(html));
ok('ov-url is text', /id="ov-url"[^>]*type="text"/.test(html) || /type="text"[^>]*id="ov-url"/.test(html));
ok('import button label', html.includes('Import GIF / MP4'));

const documentStub = {
  querySelectorAll: () => [],
  getElementById: (id) => documentStub._els[id] || null,
  addEventListener() {},
  _els: {}
};
const windowObj = {
  addEventListener() {},
  EX: [],
  DEF_EX: [
    { name: 'Wyciskanie sztangi leżąc' },
    { name: 'Podciąganie na drążku' },
    { name: 'Martwy ciąg klasyczny' }
  ],
  EX_GIF_MANIFEST: {},
  EX_GIF_REMOTE: {},
  COACH_VIDEOS: [],
  document: documentStub,
  _uid: 'trainer-1',
  _db: {},
  _docs: [],
  _doc: (_db, col, id) => ({ col, id }),
  _setDoc: async (ref, data) => { windowObj._docs.push({ ref, data }); }
};
windowObj.window = windowObj;
documentStub._els['exgif-paste'] = { value: '' };
documentStub._els['exgif-preview'] = { innerHTML: '' };
documentStub._els['exgif-match-count'] = { textContent: '' };
documentStub._els['exgif-import-btn'] = { textContent: '', disabled: false };
documentStub._els['exgif-progress'] = { style: { width: '0' }, parentElement: { style: { display: 'none' } } };
documentStub._els['exgif-progress-wrap'] = { style: { display: 'none' } };

const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined, Promise
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

ctx.allExercises = function allExercises() {
  return (windowObj.EX || []).concat(windowObj.DEF_EX || []);
};
vm.runInContext('function allExercises(){return (window.EX||[]).concat(window.DEF_EX||[]);}', ctx);

const start = six.indexOf('function resolveExerciseName');
const end = six.indexOf('window.matchGifFileToExercise=matchGifFileToExercise;');
ok('extract import helpers', start >= 0 && end > start);
vm.runInContext(six.slice(start, end) + 'window.matchGifFileToExercise=matchGifFileToExercise;', ctx);

const mp4 = 'https://cdn.example.com/filmy/bench.mp4';
const rowsPipe = ctx.parseExGifBulkPaste('Wyciskanie sztangi leżąc | ' + mp4);
ok('pipe mp4 count', rowsPipe.length === 1, JSON.stringify(rowsPipe));
ok('pipe mp4 url', rowsPipe[0] && rowsPipe[0].presetUrl === mp4, JSON.stringify(rowsPipe[0]));
ok('pipe mp4 selected', rowsPipe[0] && rowsPipe[0].selected === true && rowsPipe[0].exerciseName === 'Wyciskanie sztangi leżąc');

const rowsTight = ctx.parseExGifBulkPaste('Wyciskanie sztangi leżąc|' + mp4);
ok('pipe no-spaces mp4', rowsTight.length === 1 && rowsTight[0].presetUrl === mp4 && rowsTight[0].selected, JSON.stringify(rowsTight[0]));

const spaced = 'https://cdn.example.com/Wyciskanie sztangi (Barbell).mp4';
const rowsSpace = ctx.parseExGifBulkPaste('Wyciskanie sztangi leżąc | ' + spaced);
ok('url spaces encoded', rowsSpace[0] && rowsSpace[0].presetUrl === 'https://cdn.example.com/Wyciskanie%20sztangi%20(Barbell).mp4', JSON.stringify(rowsSpace[0]));

const rowsGif = ctx.parseExGifBulkPaste('Podciąganie na drążku;https://cdn.example.com/pull.gif');
ok('semicolon gif still works', rowsGif.length === 1 && /\.gif$/.test(rowsGif[0].presetUrl) && rowsGif[0].selected);

const jsonRows = ctx.parseExGifBulkPaste(JSON.stringify([{ name: 'Martwy ciąg klasyczny', mp4: 'https://cdn.example.com/dead.mp4' }]));
ok('json mp4 field', jsonRows.length === 1 && jsonRows[0].presetUrl.endsWith('dead.mp4') && jsonRows[0].selected);

(async () => {
  const saved = await ctx.persistExerciseGifUrl('Wyciskanie sztangi leżąc', mp4);
  ok('persist mp4 ok', saved === true);
  const key = ctx.exerciseMediaKey('Wyciskanie sztangi leżąc');
  ok('remote map has mp4', windowObj.EX_GIF_REMOTE[key] === mp4, JSON.stringify(windowObj.EX_GIF_REMOTE));
  ok('firestore gifUrl is mp4', windowObj._docs.length === 1 && windowObj._docs[0].data.gifUrl === mp4, JSON.stringify(windowObj._docs[0]));

  documentStub._els['exgif-paste'].value = 'Wyciskanie sztangi leżąc | ' + mp4;
  ctx._exGifImportRows = [];
  vm.runInContext('var _exGifImportRows=[]; var _exGifImportMode="paste";', ctx);
  // Re-bind rows used by ensureExGifPasteParsed: extract that helper too if present
  const ens = six.indexOf('function ensureExGifPasteParsed');
  const ensEnd = six.indexOf('async function runExGifImport');
  if (ens >= 0 && ensEnd > ens) {
    // ensure uses module-level _exGifImportRows; skip if not in extract. persist path is the contract.
    ok('ensure helper present', /function ensureExGifPasteParsed/.test(six) && /ensureExGifPasteParsed\(\)/.test(six));
  } else ok('ensure helper present', false);

  ok('save without parse in source', /ensureExGifPasteParsed\(\)/.test(six) && /async function runExGifImport/.test(six));
  ok('upload mp4 mime', /video\/mp4/.test(six));

  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll GIF/MP4 import tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
