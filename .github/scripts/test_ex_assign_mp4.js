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

ok('cache 01 v69', html.includes('01-core.js?v=71'));
ok('cache 06 v57', html.includes('06-inbox-exercises-ai-programs.js?v=57'));
ok('ci unit', wf.includes('test_ex_assign_mp4.js'));
ok('ci ui', wf.includes('test_ex_assign_mp4_ui.js'));
ok('openExDetail includes assign panel', /exDetailAssignHtml\(e\)/.test(six));
const openEx = six.slice(six.indexOf('function openExDetail'), six.indexOf('window.EX=window.EX||[]'));
ok('assign panel before technique guide', openEx.indexOf('exDetailAssignHtml(e)') >= 0 && openEx.indexOf('exDetailAssignHtml(e)') < openEx.indexOf('exTechniqueGuideHtml(e)'));
ok('assign panel ids', /id="exd-assign"/.test(six) && /id="exd-mp4-url"/.test(six) && /id="exd-mp4-file"/.test(six) && /id="exd-mp4-player"/.test(six));
ok('uses currentExDetail', /assignExTechniqueFromPaste\(currentExDetail\)/.test(six));
ok('own videos dropdown', /id="exd-mp4-own"/.test(six));
ok('card film badge', /▶ FILM/.test(six));

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
documentStub._els['exd-mp4-url'] = { value: '', focus() {}, select() {} };
documentStub._els['exd-mp4-own'] = { value: '' };
documentStub._els['exd-mp4-file'] = { files: [], value: '' };
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
ok('flat chest fly maps to pec deck cdn', decodeURIComponent(ctx.cdnUrlFromVideoFilename('Rozpiętki na maszynie (motyl) (Machine Chest Fly).mp4')).indexOf('Machine Chest Fly (Pec Deck)') >= 0);
ok('bad jsdelivr normalized', decodeURIComponent(ctx.normalizeVideoAssetsCdnUrl('https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@main/Rozpi%C4%99tki%20na%20maszynie%20(motyl)%20(Machine%20Chest%20Fly).mp4')).indexOf('Machine Chest Fly (Pec Deck)') >= 0);
ok('plain filename not auto-cdn', ctx.cdnUrlFromVideoFilename('bench.mp4') === '');
ok('windows duplicate not auto-cdn', ctx.cdnUrlFromVideoFilename('film (1).mp4') === '');
ok('copy suffix not auto-cdn', ctx.cdnUrlFromVideoFilename('motyl (copy).mp4') === '');
const winCopy = 'Rozpiętki na maszynie (motyl) (Machine Chest Fly (Pec Deck)) (2).mp4';
ok('windows (2) nested youcan is youcan', ctx.isYouCanVideoFilename(winCopy) === true);
ok('windows (2) nested canonical', ctx.canonicalYouCanBasename(winCopy) === 'Rozpiętki na maszynie (motyl) (Machine Chest Fly (Pec Deck)).mp4');
const winCopyCdn = ctx.cdnUrlFromVideoFilename(winCopy);
ok('windows (2) nested to cdn', winCopyCdn.indexOf('https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@d7dcf95') === 0);
ok('windows (2) nested keeps pec deck', decodeURIComponent(winCopyCdn).indexOf('Machine Chest Fly (Pec Deck)') >= 0 && decodeURIComponent(winCopyCdn).indexOf('(2)') < 0, winCopyCdn);
const cableNested = 'Rozpiętki na wyciągu górnym (stojąc) (Standing Cable Fly (High Pulley Cable Crossover2)).mp4';
ok('nested cable fly is youcan', ctx.isYouCanVideoFilename(cableNested) === true);
ok('nested cable fly to cdn', ctx.cdnUrlFromVideoFilename(cableNested).indexOf('https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@') === 0);
ok('bare filename detected', ctx.isBareMediaFilename('fly-peck-deck.mp4') === true);
ok('assets path not bare', ctx.isBareMediaFilename('assets/ex/gifs/butterfly-peck-deck.gif') === false);
ok('https not bare', ctx.isBareMediaFilename('https://cdn.example.com/x.mp4') === false);
ok('bare not safe url', ctx.isSafeMediaUrl('fly-peck-deck.mp4') === false);

const htmlPanel = ctx.exDetailAssignHtml(windowObj.DEF_EX[0]);
ok('panel html has paste field', /id="exd-mp4-url"/.test(htmlPanel));
ok('placeholder not fake path', /placeholder="[^"]*Opcjonalnie wklej/.test(htmlPanel) && !/placeholder="D:\//.test(htmlPanel));
ok('own select previews', /onchange="previewAssignedExOwnVideo\(\)"/.test(htmlPanel));
ok('panel suggest pec deck path', /id="exd-mp4-suggest"/.test(htmlPanel) && /Wstaw ścieżkę motyl/.test(htmlPanel));
ok('stretch panel has no pec deck suggest', !/id="exd-mp4-suggest"/.test(ctx.exDetailAssignHtml({ name: 'Rozciąganie butterfly' })));
ok('panel html has status', /id="exd-assign-msg"/.test(htmlPanel));
ok('panel player autoplay', /id="exd-mp4-player"/.test(six) && /autoplay loop muted/.test(six));
ok('panel copy-as-path hint', /Kopiuj jako ścieżkę/.test(htmlPanel) && /Shift\+PPM/.test(htmlPanel));
ok('panel save label', /Dopasuj i zapisz przy tym ćwiczeniu/.test(htmlPanel));
ok('suggested pec deck path', /Machine Chest Fly \(Pec Deck\)\)\.mp4$/.test(ctx.suggestedAssignPathForExercise('Butterfly (peck deck)')));
ok('suggested other path is folder', ctx.suggestedAssignPathForExercise('Bench press') === 'D:/progress-live-video-assets/POGRUPOWANE/');
ok('suggested stretch butterfly is folder', ctx.suggestedAssignPathForExercise('Rozciąganie butterfly') === 'D:/progress-live-video-assets/POGRUPOWANE/');
ok('suggested butterfly stretch aka is folder', ctx.suggestedAssignPathForExercise('Butterfly stretch') === 'D:/progress-live-video-assets/POGRUPOWANE/');
ok('pec deck matcher', ctx.isPecDeckAssignExercise('Butterfly (peck deck)') === true && ctx.isPecDeckAssignExercise('Rozciąganie butterfly') === false);
ok('truncated https detected', ctx.isTruncatedAssignUrl('https://cdn.jsdelivr.net/gh/teamprogress20') === true);
ok('full mp4 https not truncated', ctx.isTruncatedAssignUrl('https://cdn.example.com/filmy/pec-deck.mp4') === false);
ok('local path not truncated', ctx.isTruncatedAssignUrl('D:/progress-live-video-assets/x.mp4') === false);
ok('empty pec deck how-to', /Wstaw ścieżkę motyl/.test(ctx.exAssignEmptyPathMsg('Butterfly (peck deck)')) && /Kopiuj jako ścieżkę/.test(ctx.exAssignEmptyPathMsg('Butterfly (peck deck)')));
ok('empty other how-to', /Kopiuj jako ścieżkę/.test(ctx.exAssignEmptyPathMsg('Bench press')) && !/Wstaw ścieżkę motyl/.test(ctx.exAssignEmptyPathMsg('Bench press')));

(async () => {
  windowObj.__notices = [];
  const trunc = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', 'https://cdn.jsdelivr.net/gh/teamprogress20');
  ok('truncated https rejected', trunc === false);
  ok('truncated https not persisted', !windowObj.EX_GIF_REMOTE[ctx.exerciseMediaKey('Butterfly (peck deck)')], JSON.stringify(windowObj.EX_GIF_REMOTE));
  ok('truncated https hint', /ucięty/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

  ctx.fillSuggestedExAssignPath();
  ok('suggest fills pec deck path', /Machine Chest Fly \(Pec Deck\)\)\.mp4$/.test(documentStub._els['exd-mp4-url'].value), documentStub._els['exd-mp4-url'].value);

  const quoted = '"D:/progress-live-video-assets/POGRUPOWANE/Klatka piersiowa/Rozpiętki na maszynie (motyl) (Machine Chest Fly (Pec Deck)).mp4"';
  const savedQuoted = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', quoted);
  ok('save quoted local path', savedQuoted === true);
  ok('quoted path is pec deck cdn', /cdn\.jsdelivr\.net/.test(windowObj.EX_GIF_REMOTE[ctx.exerciseMediaKey('Butterfly (peck deck)')] || '') && decodeURIComponent(windowObj.EX_GIF_REMOTE[ctx.exerciseMediaKey('Butterfly (peck deck)')] || '').indexOf('Machine Chest Fly (Pec Deck)') >= 0);
  windowObj.EX_GIF_REMOTE[ctx.exerciseMediaKey('Butterfly (peck deck)')] = '';
  windowObj._docs = [];
  windowObj.__opened = '';

  const localWin = 'D:/progress-live-video-assets/POGRUPOWANE/Klatka piersiowa/Rozpiętki na maszynie (motyl) (Machine Chest Fly).mp4';
  const saved = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', localWin);
  ok('save local assets path', saved === true);
  const pecKey = ctx.exerciseMediaKey('Butterfly (peck deck)');
  const remote = windowObj.EX_GIF_REMOTE[pecKey] || '';
  ok('remote pec deck is cdn', /cdn\.jsdelivr\.net/.test(remote) && decodeURIComponent(remote).indexOf('Machine Chest Fly (Pec Deck)') >= 0, remote);
  ok('firestore wrote pec deck', windowObj._docs.some((d) => d.data && d.data.exerciseName === 'Butterfly (peck deck)'), JSON.stringify(windowObj._docs[0]));
  ok('reopened detail', windowObj.__opened === 'Butterfly (peck deck)');

  const desk = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', 'D:/Desktop/x.mp4');
  ok('desktop path rejected', desk === false);

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  const winCopyPath = 'D:/progress-live-video-assets/POGRUPOWANE/Klatka piersiowa/' + winCopy;
  const savedCopy = await ctx.saveAssignedExTechnique('Butterfly (peck deck)', winCopyPath);
  ok('save windows copy path', savedCopy === true);
  const remoteCopy = windowObj.EX_GIF_REMOTE[pecKey] || '';
  ok('windows copy path is canonical cdn', /cdn\.jsdelivr\.net/.test(remoteCopy) && decodeURIComponent(remoteCopy).indexOf('Machine Chest Fly (Pec Deck)') >= 0 && decodeURIComponent(remoteCopy).indexOf('(2)') < 0, remoteCopy);

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  documentStub._els['exd-mp4-url'].value = winCopy;
  const pastedCopy = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('paste windows copy basename', pastedCopy === true);
  const pastedRemote = windowObj.EX_GIF_REMOTE[pecKey] || '';
  ok('paste windows copy is canonical cdn', /cdn\.jsdelivr\.net/.test(pastedRemote) && decodeURIComponent(pastedRemote).indexOf('Machine Chest Fly (Pec Deck)') >= 0 && decodeURIComponent(pastedRemote).indexOf('(2)') < 0, pastedRemote);

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  documentStub._els['exd-mp4-url'].value = cableNested;
  windowObj.__notices = [];
  const nestedPaste = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('paste nested cable basename', nestedPaste === true);
  ok('paste nested cable is cdn', /cdn\.jsdelivr\.net/.test(windowObj.EX_GIF_REMOTE[pecKey] || ''), windowObj.EX_GIF_REMOTE[pecKey]);

  documentStub._els['exd-mp4-url'].value = 'https://cdn.example.com/filmy/pec-deck.mp4';
  await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('paste https saved', windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/pec-deck.mp4');

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  documentStub._els['exd-mp4-own'].value = 'cv1';
  await ctx.assignExTechniqueFromOwn('Butterfly (peck deck)');
  ok('own video saved', windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/pec-deck.mp4');
  ok('own video linked to exercise', windowObj.COACH_VIDEOS[0].exName === 'Butterfly (peck deck)');
  const dupMedia = ctx.resolveCoachMedia({ name: 'Butterfly (peck deck)' });
  ok('own assign keeps technique mp4', dupMedia.gif === 'https://cdn.example.com/filmy/pec-deck.mp4', JSON.stringify(dupMedia));
  ok('own assign does not duplicate video', !dupMedia.video, JSON.stringify(dupMedia));

  documentStub._els['exd-mp4-own'].value = '';
  documentStub._els['exd-mp4-url'].value = '';
  windowObj.__notices = [];
  const keepPicked = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('empty save keeps picked film', keepPicked === true);
  ok('empty save does not revert pec deck cdn', windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/pec-deck.mp4', windowObj.EX_GIF_REMOTE[pecKey]);
  ok('empty save keep hint', /już zapisany|nie zmienia/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  documentStub._els['exd-mp4-url'].value = '';
  documentStub._els['exd-mp4-own'].value = 'cv1';
  const fromList = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('red save uses list selection', fromList === true && windowObj.EX_GIF_REMOTE[pecKey] === 'https://cdn.example.com/filmy/pec-deck.mp4', windowObj.EX_GIF_REMOTE[pecKey]);

  windowObj.EX_GIF_REMOTE[pecKey] = '';
  documentStub._els['exd-mp4-own'].value = '';
  documentStub._els['exd-mp4-url'].value = '';
  windowObj.__notices = [];
  const emptyPec = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('empty pec deck auto-saves', emptyPec === true);
  ok('empty pec deck uses suggested cdn', /cdn\.jsdelivr\.net/.test(windowObj.EX_GIF_REMOTE[pecKey] || '') && decodeURIComponent(windowObj.EX_GIF_REMOTE[pecKey] || '').indexOf('Machine Chest Fly (Pec Deck)') >= 0, windowObj.EX_GIF_REMOTE[pecKey]);

  documentStub._els['exd-mp4-url'].value = '';
  windowObj.__notices = [];
  const emptyOther = await ctx.assignExTechniqueFromPaste('Bench press');
  ok('empty other rejected', emptyOther === false, 'empty=' + emptyOther);
  ok('empty other explains', /Kopiuj jako ścieżkę/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

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

  windowObj._uploaded = false;
  windowObj.EX_GIF_REMOTE[pecKey] = '';
  windowObj.__notices = [];
  await ctx.assignExTechniqueFromFile('Butterfly (peck deck)', { files: [{ name: winCopy }] });
  ok('github.io youcan copy skips storage', windowObj._uploaded === false);
  const fileCopyRemote = windowObj.EX_GIF_REMOTE[pecKey] || '';
  ok('github.io youcan copy uses cdn', /cdn\.jsdelivr\.net/.test(fileCopyRemote) && decodeURIComponent(fileCopyRemote).indexOf('Machine Chest Fly (Pec Deck)') >= 0 && decodeURIComponent(fileCopyRemote).indexOf('(2)') < 0, fileCopyRemote);

  const beforeBare = windowObj.EX_GIF_REMOTE[pecKey];
  documentStub._els['exd-mp4-url'].value = 'fly-peck-deck.mp4';
  windowObj.__notices = [];
  const bareSave = await ctx.assignExTechniqueFromPaste('Butterfly (peck deck)');
  ok('bare filename rejected', bareSave === false);
  ok('bare filename not persisted', windowObj.EX_GIF_REMOTE[pecKey] === beforeBare, windowObj.EX_GIF_REMOTE[pecKey]);
  ok('bare filename hint', /tylko nazwa pliku|bez folderu/i.test((windowObj.__notices || []).join(' ')), (windowObj.__notices || []).join(' | '));

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
