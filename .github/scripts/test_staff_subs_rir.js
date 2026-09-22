#!/usr/bin/env node
'use strict';
/** Zamienniki biomechaniczne + kalkulator obciążenia RIR (port ze sztabu). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
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

ok('cache 06 v80', html.includes('06-inbox-exercises-ai-programs.js?v=84'));
ok('cache styles v91', html.includes('styles.css?v=104'));
ok('cache 07 v39', html.includes('07-forms-metrics-calculator.js?v=40'));
ok('CI unit', wf.includes('test_staff_subs_rir.js'));
ok('CI ui', wf.includes('test_staff_subs_rir_ui.js'));
ok('rir tab markup', html.includes('id="calc-tab-rir"') && html.includes('Obciążenie RIR') && html.includes('id="rir-weight"'));
ok('myo tab markup', html.includes('id="calc-tab-myo"') && html.includes('id="calc-myo-layout"') && html.includes('id="myo-blocks"') && html.includes('id="myo-detail"'));
ok('lib substitutes markup', /exd-subs-box/.test(six) && /Uzasadnij ten zamiennik/.test(six));
ok('biomech labeled rows', /exd-biomech-row/.test(six) && /Wzorzec/.test(six) && /Profil oporu/.test(six) && /Przyciąganie pionowe/.test(six));
ok('drawer css 480', css.includes('width:min(480px,100vw)') && css.includes('.exd-ai-h') && css.includes('.exd-biomech-row'));
ok('no tiny biomech header', !/font-size:9px;font-family:'DM Mono',monospace;color:var\(--accent\);margin-bottom:8px/.test(html));
ok('keep catalog alts', /Zamienniki z karty/.test(six));
ok('exd tabs markup', html.includes('id="exd-tab-preview"') && html.includes('Podgląd') && html.includes('Biomechanika') && html.includes('Zarządzanie'));
ok('exd accordions', html.includes('id="exd-acc-ai"') && /Uzasadnienia zamienników/.test(six));
ok('exd tab css', css.includes('.exd-tab') && css.includes('.exd-acc'));
ok('no 12-ex replace', !/db-incline-lateral/.test(six));

const start = six.indexOf('const EX_PROFILE_LABELS=');
const end = six.indexOf('window.askExStaffJustify=askExStaffJustify;');
ok('slice', start > 0 && end > start);
const slice = six.slice(start, end + 'window.askExStaffJustify=askExStaffJustify;'.length);

const lib = [
  { name: 'Unoszenie hantli bokiem — ławka skośna 30°', cat: 'Barki', eq: 'Hantle', muscle: 'Naramienny (środkowy), Naramienny przedni, Kapturowy górny' },
  { name: 'Unoszenie hantli bokiem — stojąc', cat: 'Barki', eq: 'Hantle', muscle: 'Naramienny (środkowy), Kapturowy górny' },
  { name: 'Unoszenie na wyciągu dolnym bokiem', cat: 'Barki', eq: 'Wyciąg', muscle: 'Naramienny (środkowy), Kapturowy górny' },
  { name: 'Przysiad Goblet', cat: 'Nogi', eq: 'Hantle', muscle: 'Czworogłowy uda, Pośladkowy wielki' },
  { name: 'Wyciskanie nogami na prasie', cat: 'Nogi', eq: 'Maszyna', muscle: 'Czworogłowy uda, Pośladkowy wielki' },
  { name: 'Rozpiętki na ławce płaskiej', cat: 'Klatka piersiowa', eq: 'Hantle', muscle: 'Klatka piersiowa, Naramienny przedni' }
];
const documentStub = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const windowObj = { EX: [], DEF_EX: lib, document: documentStub };
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  allExercises() { return lib.slice(); },
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(slice, ctx);

const { exerciseBiomech, findStaffSubstitutes } = windowObj;
const incline = lib[0];
const standing = lib[1];
const cable = lib[2];
const goblet = lib[3];
const press = lib[4];
const fly = lib[5];

ok('incline lat abduction', exerciseBiomech(incline).pattern === 'shoulder_abduction');
ok('incline lat frontal', exerciseBiomech(incline).plane === 'frontal');
ok('incline lat bell', exerciseBiomech(incline).profile === 'bell-shaped');
ok('standing lat ascending', exerciseBiomech(standing).profile === 'ascending');
ok('cable lat constant', exerciseBiomech(cable).profile === 'constant');
ok('goblet knee', exerciseBiomech(goblet).pattern === 'knee_dominant' && exerciseBiomech(goblet).joints.includes('knee'));
ok('leg press no shoulder', !exerciseBiomech(press).joints.includes('shoulder') && exerciseBiomech(press).joints.includes('knee'));
ok('fly descending', exerciseBiomech(fly).profile === 'descending');

const subs = findStaffSubstitutes(incline, { limit: 3 });
ok('lat substitutes exist', subs.length >= 2);
ok('lat only same pattern', subs.length >= 2 && subs.every((s) => exerciseBiomech(s.ex).pattern === 'shoulder_abduction'));
ok('score order', subs[0].score >= subs[subs.length - 1].score);

const noShoulder = findStaffSubstitutes(incline, { blacklistedJoints: ['shoulder'] });
ok('shoulder blacklist empty', noShoulder.length === 0);

const kneeAlts = findStaffSubstitutes(goblet, { blacklistedJoints: ['shoulder'] });
ok('goblet keeps knee alts', kneeAlts.some((s) => s.ex.name === 'Wyciskanie nogami na prasie'));
const noKnee = findStaffSubstitutes(goblet, { blacklistedJoints: ['knee'] });
ok('knee blacklist empty', noKnee.length === 0);

const noHantle = findStaffSubstitutes(incline, { unavailableEquipment: ['Hantle'] });
ok('eq filter drops hantle', noHantle.every((s) => s.ex.eq !== 'Hantle') && noHantle.some((s) => /wyciąg/i.test(s.ex.eq)));

const rirStart = src07.indexOf('function suggestLoad');
const rirEnd = src07.indexOf('window.suggestLoad=suggestLoad;');
ok('rir slice', rirStart > 0 && rirEnd > rirStart);
vm.runInContext(src07.slice(rirStart, rirEnd + 'window.suggestLoad=suggestLoad;'.length), ctx);
const { suggestLoad } = windowObj;
ok('rir easier = more load', suggestLoad({ weight: 100, rir: 3, targetRir: 2, isIncline: false }).newWeight === 105);
ok('rir harder = less load', suggestLoad({ weight: 8, rir: 1, targetRir: 2, isIncline: true }).newWeight === 7.8);
ok('incline smaller step', suggestLoad({ weight: 100, rir: 3, targetRir: 2, isIncline: true }).newWeight === 102.5);

const myoStart = src07.indexOf('const MYO_SESSION_DEFAULT=');
const myoEnd = src07.indexOf('window.askMyoStaffPain=askMyoStaffPain;');
ok('myo slice', myoStart > 0 && myoEnd > myoStart);
vm.runInContext(src07.slice(myoStart, myoEnd + 'window.askMyoStaffPain=askMyoStaffPain;'.length), ctx);
const {
  MYO_SESSION_DEFAULT,
  myoFormatClock,
  myoInitProgress,
  myoLogMini,
  myoDoneCount
} = windowObj;
ok('myo clock', myoFormatClock(20) === '00:20' && myoFormatClock(75) === '01:15');
ok('myo 5 blocks', MYO_SESSION_DEFAULT.blocks.length === 5);
ok('myo live library names', MYO_SESSION_DEFAULT.blocks.every((b) => [
  'Przysiad Goblet',
  'Wyciskanie hantli na ławce skośnej',
  'Wiosłowanie hantlem',
  'Unoszenie bokiem',
  'Ściąganie drążka wyciąg'
].includes(b.exercise)));
ok('myo no demo ids', !src07.includes('db-incline-lateral') && !six.includes('db-incline-lateral'));
ok('myo keeps RP', /ex-kind-btn rp/.test(fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8')) && /Rest-pause: 1–2 dogrywki/.test(fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8')));
const prog = myoInitProgress(MYO_SESSION_DEFAULT.blocks);
ok('myo progress zero', myoDoneCount(prog) === 0);
const one = myoLogMini(prog, 'b2', 3);
ok('myo log +1', one.b2 === 1 && prog.b2 === 0);
const cap = myoLogMini(myoLogMini(myoLogMini(one, 'b2', 3), 'b2', 3), 'b2', 3);
ok('myo cap 3', cap.b2 === 3);
ok('myo caution on press+laterals', MYO_SESSION_DEFAULT.blocks.filter((b) => b.caution).map((b) => b.exercise).join('|') === 'Wyciskanie hantli na ławce skośnej|Unoszenie bokiem');
ok('myo staff button', /askMyoStaffPain/.test(src07) && /dev','biomechanika/.test(src07));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll staff-subs/RIR tests passed');
