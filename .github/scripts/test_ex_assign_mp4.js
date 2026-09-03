#!/usr/bin/env node
'use strict';
/** Assign an MP4 (paste / own video / YouCan filename) to the selected library exercise. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01 v64', html.includes('01-core.js?v=64'));
ok('cache 06 v47', html.includes('06-inbox-exercises-ai-programs.js?v=47'));
ok('ci unit', wf.includes('test_ex_assign_mp4.js'));
ok('ci ui', wf.includes('test_ex_assign_mp4_ui.js'));
ok('openExDetail includes assign panel', /exDetailAssignHtml\(e\)/.test(six));
ok('assign panel ids', /id="exd-assign"/.test(six) && /id="exd-mp4-url"/.test(six) && /id="exd-mp4-file"/.test(six));
ok('uses currentExDetail', /assignExTechniqueFromPaste\(currentExDetail\)/.test(six));
ok('own videos dropdown', /id="exd-mp4-own"/.test(six));

const documentStub = {
  querySelectorAll: () => [],
  getElementById: (id) => documentStub._els[id] || null,
  addEventListener() {},
  _els: {}
};
const windowObj = {
  addEventListener() {},
  EX: [],
  DEF_EX: [{ name: 'Butterfly (peck deck)', cat: 'Klatka piersiowa', eq: 'Maszyna' }],
  EX_GIF_MANIFEST: {
    bench: 'https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@d7dcf95c296ad18b00ec9dc076ba80a6b343ad1e/Wyciskanie%20sztangi.mp4'
  },
  EX_GIF_REMOTE: {},
  COACH_VIDEOS: [
    { id: 'cv1', name: 'Motyl pec deck', url: 'https://cdn.example.com/filmy/pec-deck.mp4' }
  ],
  document: documentStub,
  _uid: 'trainer-1',
  _db: {},
  _docs: [],
  _doc: (_db, col, id) => ({ col, id }),
  _setDoc: async (ref, data) => { windowObj._docs.push({ ref, data }); }
};
windowObj.window = windowObj;
documentStub._els['exd-mp4-url'] = { value: '' };
documentStub._els['exd-mp4-own'] = { value: 'cv1' };
documentStub._els['exd-assign-msg'] = { style: { display: 'none', color: '' }, textContent: '' };

const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  location: { hostname: 'localhost' },
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined, Promise
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

ctx.notify = function notify(m) { windowObj.__notices = windowObj.__notices || []; windowObj.__notices.push(String(m)); };
ctx.findCustomEx = function findCustomEx() { return null; };
ctx.renderLib = function renderLib() { windowObj.__renderLib = true; };
ctx.openExDetail = function openExDetail(name) { windowObj.__opened = name; };
ctx.currentExDetail = 'Butterfly (peck deck)';
ctx.persistById = async function persistById() {};
ctx.allExercises = function allExercises() { return (windowObj.EX || []).concat(windowObj.DEF_EX || []); };

const start = six.indexOf('function normalizeImportedMediaUrl');
const end = six.indexOf('function matchGifFileToExercise');
ok('extract assign helpers', start >= 0 && end > start);
vm.runInContext(six.slice(start, end), ctx);

ok('cdn from youcan filename', ctx.cdnUrlFromVideoFilename('Rozpiętki na maszynie (motyl) (Machine Chest Fly).mp4').indexOf('https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@d7dcf95') === 0);
ok('plain filename not auto-cdn', ctx.cdnUrlFromVideoFilename('bench.mp4') === '');
ok('windows duplicate not auto-cdn', ctx.cdnUrlFromVideoFilename('film (1).mp4') === '');
ok('copy suffix not auto-cdn', ctx.cdnUrlFromVideoFilename('motyl (copy).mp4') === '');
ok('bare filename detected', ctx.isBareMediaFilename('fly-peck-deck.mp4') === true);
ok('assets path not bare', ctx.isBareMediaFilename('assets/ex/gifs/butterfly-peck-deck.gif') === false);
ok('https not bare', ctx.isBareMediaFilename('https://cdn.example.com/x.mp4') === false);
ok('bare not safe url', ctx.isSafeMediaUrl('fly-peck-deck.mp4') === false);

const htmlPanel = ctx.exDetailAssignHtml(windowObj.DEF_EX[0]);
ok('panel html has paste field', /id="exd-mp4-url"/.test(htmlPanel));
ok('panel html has own videos', /id="exd-mp4-own"/.test(htmlPanel) && /Motyl pec deck/.test(htmlPanel));
ok('panel html has status', /id="exd-assign-msg"/.test(htmlPanel));
ok('panel mentions cors', /CORS Storage/.test(htmlPanel));

(async () => {
  const localWin = 'D:/progress-live-video-assets/POGRUPOWANE/Klatka piersiowa/Rozpiętki na maszynie (motyl) (Machine Chest Fly).mp4';
  const saved = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', localWin);
  ok('save local assets path', saved === true);
  const pecKey = ctx.exerciseMediaKey('Butterfly (peck deck)');
  const remote = windowObj.EX_GIF_REMOTE[pecKey] || '';
  ok('remote pec deck is cdn', /cdn\.jsdelivr\.net/.test(remote) && decodeURIComponent(remote).indexOf('Machine Chest Fly') >= 0, remote);
  ok('firestore wrote pec deck', windowObj._docs.some((d) => d.data && d.data.exerciseName === 'Butterfly (peck deck)'), JSON.stringify(windowObj._docs[0]));
  ok('reopened detail', windowObj.__opened === 'Butterfly (peck deck)');

  const desk = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', 'D:/Desktop/x.mp4');
  ok('desktop path rejected', desk === false);

  documentStub._els['exd-mp4-url'].value = 'https://cdn.example.com/filmy/pec-deck.mp4';
  await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('paste https saved', windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/pec-deck.mp4');

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  await ctx.assignExTechniqueFromOwn('Butterfly (peck deck)');
  ok('own video saved', windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/pec-deck.mp4');
  ok('own video linked to exercise', windowObj.COACH_VIDEOS[0].exName === 'Butterfly (peck deck)');
  const dupMedia = ctx.resolveCoachMedia({ name: 'Butterfly (peck deck)' });
  ok('own assign keeps technique mp4', dupMedia.gif === 'https://cdn.example.com/filmy/pec-deck.mp4', JSON.stringify(dupMedia));
  ok('own assign does not duplicate video', !dupMedia.video, JSON.stringify(dupMedia));

  documentStub._els['exd-mp4-url'].value = '';
  windowObj.__notices = [];
  const empty = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('empty paste rejected', empty === false, 'empty=' + empty);
  ok('empty paste explains', /wklej pełną ścieżkę/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

  ctx.location = { hostname: 'teamprogress2018-droid.github.io' };
  windowObj._uploaded = false;
  windowObj._storage = {};
  windowObj._storageRef = () => ({});
  windowObj._uploadBytes = async () => { windowObj._uploaded = true; };
  windowObj._getDownloadURL = async () => 'https://firebasestorage.googleapis.com/v0/b/x/o/fly-peck-deck.mp4';
  documentStub._els['exd-mp4-url'].value = '';
  windowObj.__notices = [];
  await ctx.assignExTechniqueFromFile('Butterfly (peck deck)', { files: [{ name: 'fly-peck-deck.mp4' }] });
  ok('github.io skips storage', windowObj._uploaded === false);
  ok('github.io fills filename', documentStub._els['exd-mp4-url'].value === 'fly-peck-deck.mp4');
  ok('github.io cors hint', /CORS/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

  const beforeBare = windowObj.EX_GIF_REMOTE[pecKey];
  documentStub._els['exd-mp4-url'].value = 'fly-peck-deck.mp4';
  windowObj.__notices = [];
  const bareSave = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('bare filename rejected', bareSave === false);
  ok('bare filename not persisted', windowObj.EX_GIF_REMOTE[pecKey] === beforeBare, windowObj.EX_GIF_REMOTE[pecKey]);
  ok('bare filename hint', /sama nazwa pliku/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

  ctx.location = { hostname: 'localhost' };
  delete windowObj._storage;
  delete windowObj._storageRef;
  delete windowObj._uploadBytes;
  delete windowObj._getDownloadURL;
  windowObj.__notices = [];
  await ctx.assignExTechniqueFromFile('Butterfly (peck deck)', { files: [{ name: 'x.mp4' }] });
  ok('localhost missing storage not cors', /Firebase Storage jest niedostępny/i.test((windowObj.__notices || []).join(' ')) && !/GitHub Pages/.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

  windowObj._setDoc = async () => { throw new Error('permission-denied'); };
  const cloudFail = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', 'https://cdn.example.com/filmy/ok.mp4');
  ok('firestore throw still local', cloudFail === true && windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/ok.mp4');

  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll exercise MP4 assign tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
