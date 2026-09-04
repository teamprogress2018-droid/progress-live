#!/usr/bin/env node
'use strict';
/** Biblioteka: Usuń ćwiczenie także dla DEF_EX (ukrycie + persist). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 06 v61', html.includes('06-inbox-exercises-ai-programs.js?v=61'));
ok('ci unit', wf.includes('test_lib_del_ex.js'));
ok('detail always has delete', /id="exd-del"/.test(six) && /Usuń ćwiczenie/.test(six));
ok('header delete sticky', html.includes('id="exd-del-hdr"') && /exd-del-hdr/.test(six));
ok('edit still custom-only', /findCustomEx\(e\.name\)\?`<button[^>]*editEx/.test(six));
ok('list row has Usuń', /delEx\('\$\{e\.name/.test(six) && (six.match(/>Usuń<\/button>/g) || []).length >= 2);
ok('card has Usuń', /function exCardHtml[\s\S]*?delEx\('\$\{e\.name/.test(six));
ok('restore control', html.includes('lib-restore-hidden') && /function restoreHiddenExercises/.test(six));
ok('helpers', /function hiddenExNames/.test(six) && /function persistHiddenExercises/.test(six));
ok('busy guard', /window\._delExBusy/.test(six) && /function refreshLibAfterDel/.test(six));
ok('allExercises hides only defaults', /hidden\.has\(e\.name\)/.test(six) && /const custom=window\.EX/.test(six));

const start = six.indexOf('function hiddenExNames');
const end = six.indexOf('function exerciseSearchNorm');
ok('slice', start > 0 && end > start);
const notifyCalls = [];
const persisted = [];
const document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const windowObj = {
  SETTINGS: {},
  EX: [{ name: 'Moje wyciskanie', id: 'ex-own', cat: 'Klatka piersiowa' }],
  DEF_EX: [
    { name: 'Wyciskanie sztangi leżąc', cat: 'Klatka piersiowa' },
    { name: 'Pompki', cat: 'Klatka piersiowa' }
  ],
  persistSettingsDoc() { persisted.push((windowObj.SETTINGS.hiddenExercises || []).slice()); },
  confirm: () => true,
  document
};
windowObj.window = windowObj;
function persistSettingsDoc() { return windowObj.persistSettingsDoc(); }
const ctx = {
  window: windowObj,
  document,
  EX: windowObj.EX,
  DEF_EX: windowObj.DEF_EX,
  SETTINGS: windowObj.SETTINGS,
  persistSettingsDoc,
  console,
  confirm: () => true,
  notify(msg) { notifyCalls.push(msg); }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  six.slice(start, end) +
  '\nfunction findCustomEx(name){return (window.EX||[]).find(e=>e.name===name);}\n' +
  six.slice(six.indexOf('function refreshLibAfterDel'), six.indexOf('async function saveEx')),
  ctx
);

ok('listed before hide', ctx.allExercises().map((e) => e.name).includes('Pompki'));
ctx.delEx('Pompki');
ok('hidden after del', !ctx.allExercises().map((e) => e.name).includes('Pompki'));
ok('pompki still in DEF_EX', windowObj.DEF_EX.some((e) => e.name === 'Pompki'));
ok('settings persisted', (windowObj.SETTINGS.hiddenExercises || []).includes('Pompki'));
ok('custom still listed', ctx.allExercises().some((e) => e.name === 'Moje wyciskanie'));

windowObj.EX.push({ name: 'Pompki', id: 'ex-pompki-own', cat: 'Klatka piersiowa' });
ok('custom pompki listed while def hidden', ctx.allExercises().some((e) => e.name === 'Pompki' && e.id === 'ex-pompki-own'));
windowObj.EX = windowObj.EX.filter((e) => e.id !== 'ex-pompki-own');
windowObj.window.EX = windowObj.EX;

let finishDel;
windowObj._db = {};
windowObj._doc = () => ({ id: 'ex-own' });
windowObj._del = () => new Promise((resolve) => { finishDel = resolve; });
const firstDel = ctx.delEx('Moje wyciskanie');
ok('custom gone before firestore', !windowObj.EX.some((e) => e.name === 'Moje wyciskanie'));
ctx.delEx('Moje wyciskanie');
ok('in-flight second click did not hide', !(windowObj.SETTINGS.hiddenExercises || []).includes('Moje wyciskanie'));
finishDel();
ok('custom removed', !ctx.allExercises().some((e) => e.name === 'Moje wyciskanie') && !windowObj.EX.some((e) => e.name === 'Moje wyciskanie'));
ctx.restoreHiddenExercises();
ok('restore pompki', ctx.allExercises().some((e) => e.name === 'Pompki'));
ok('hidden cleared', !(windowObj.SETTINGS.hiddenExercises || []).length);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll lib-del-ex tests passed');
