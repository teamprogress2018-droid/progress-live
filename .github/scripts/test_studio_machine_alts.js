#!/usr/bin/env node
'use strict';
/** Zamienniki gdy nie ma maszyny: dopasowanie nazw AI + Live swap. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=89'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=49'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=48'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=72'));
ok('cache 03', html.includes('03-ai-plangen-bizstats-aicoach.js?v=31'));
ok('apl swap altFor', src03.includes('dataset.altFor') && src03.includes('sztanga / hantle / brama / ławka'));
ok('live swap helper', /function liveSwapEx\(/.test(live) && live.includes('Zamienniki (gdy nie ma maszyny)'));
ok('live chips css', css.includes('.live-alt-chip') && css.includes('.live-alts'));
ok('live alts collapse', /const LIVE_ALT_MAX=3/.test(live) && /function liveToggleAlts\(/.test(live) && css.includes('.live-alts-more'));
ok('live add alt search', live.includes('live-alt-search') && live.includes('data-live-swap-ei') && /function liveConfirmAltSearch\(/.test(live));
ok('live add exercise name', live.includes('data-live-name-ei') && live.includes('Szukaj w bibliotece') && /function liveSetExName\(/.test(live) && /function liveConfirmExName\(/.test(live));
ok('builder label', src05.includes('Zamienniki gdy nie ma maszyny'));
ok('builder count on btn', src05.includes("Zamienniki · '"));
ok('ac alt group', six.includes('Zamienniki — sztanga / hantle / brama / ławka') && /function exAcAltItems\(/.test(six));
ok('CI', wf.includes('test_studio_machine_alts.js'));
ok('CI collapse', wf.includes('test_live_alts_collapse.js'));

const m = six.match(/const DEF_EX=\[([\s\S]*?)\];\nwindow\.DEF_EX=DEF_EX;/);
ok('DEF_EX', !!m);
const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = { addEventListener() {}, EX: [], DEF_EX: [], document };
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext('const DEF_EX=[' + m[1] + ']; window.DEF_EX=DEF_EX;', ctx);
windowObj.DEF_EX = ctx.DEF_EX || windowObj.DEF_EX;
vm.runInContext(core, ctx);
ctx.CAT_COLORS_EX = {};
windowObj.CAT_COLORS_EX = {};
vm.runInContext(`
function allExercises(){const defs=window.DEF_EX||[];const seen=new Set();return defs.filter(e=>{if(!e||!e.name||seen.has(e.name))return false;seen.add(e.name);return true;});}
window.allExercises=allExercises;
`, ctx);
const searchStart = six.indexOf('function exerciseSearchNorm');
const searchEnd = six.indexOf('function exAcFilter');
ok('search slice', searchStart >= 0 && searchEnd > searchStart);
vm.runInContext(six.slice(searchStart, searchEnd), ctx);
const altStart = six.indexOf('function exAcShouldShowAlts');
const altEnd = six.indexOf('function exAcRender');
ok('alt slice', altStart >= 0 && altEnd > altStart);
vm.runInContext(six.slice(altStart, altEnd), ctx);

const row = ctx.libExerciseByName('Wiosłowanie na maszynie siedząc (Cable Row / maszyna)');
ok('row lib hit', row && row.name === 'Wiosłowanie na maszynie', row && row.name);
const curl = ctx.libExerciseByName('Uginanie ramion na maszynie (Biceps Curl Machine)');
ok('curl lib hit', curl && curl.name === 'Uginanie na maszynie', curl && curl.name);
const alts = ctx.altsForExercise('Wiosłowanie na maszynie siedząc (Cable Row / maszyna)');
ok('row alts cable/db', alts.some((a) => /wyciągiem siedząc/.test(a)) && alts.some((a) => /hantlem/.test(a)), alts.join(', '));
const curlAlts = ctx.altsForExercise('Uginanie ramion na maszynie (Biceps Curl Machine)');
ok('curl alts free weight', curlAlts.some((a) => /hantlami|wyciągu|modlitewniku/.test(a)), curlAlts.join(', '));

const namesOf = (q) => ctx.exercisesGroupedByCat(q).flatMap((g) => g.items.map((e) => e.name));
ok('search long AI row', namesOf('Wiosłowanie na maszynie siedząc (Cable Row / maszyna)').includes('Wiosłowanie na maszynie'));
ok('search long AI curl', namesOf('Uginanie ramion na maszynie (Biceps Curl Machine)').includes('Uginanie na maszynie'));
ok('floor press still', ctx.libExerciseByName('Floor press')?.name === 'Wyciskanie z podłogi');
ok('no false hamstring', ctx.libExerciseByName('Uginanie ramion na maszynie (Biceps Curl Machine)')?.name !== 'Uginanie nóg maszyna');
const hack = ctx.libExerciseByName('Przysiad na suwnicy (Hack Squat / maszyna)');
ok('hack lib hit', hack && /hack/i.test(hack.name), hack && hack.name);
ok('hack alts', (ctx.altsForExercise('Przysiad na suwnicy (Hack Squat / maszyna)') || []).some((a) => /przysiad/i.test(a)));
const pecAlts = ctx.altsForExercise('Rozpiętki na maszynie (Pec-Deck) — środek klatki') || [];
ok('pec deck studio alts', pecAlts.some((a) => /hantlami|wyciągu|bramie/i.test(a)), pecAlts.join(', '));
ok('pec deck first is fly', /rozpiętk/i.test(pecAlts[0] || ''), pecAlts.join(', '));
ok('pec deck not another machine', !(ctx.altsForExercise('Butterfly (peck deck)') || []).some((a) => /peck deck|maszynie|hack|nogami/i.test(a)));
ok('chest press studio alts', (ctx.altsForExercise('Wyciskanie na maszynie') || []).some((a) => /hantli leżąc|sztangi leżąc/i.test(a)));
ok('empty query no alts', (ctx.exAcAltItems('') || []).length === 0);
ok('swap-from empty shows alts', (ctx.exAcAltItems('', { dataset: { altFor: 'Wiosłowanie na maszynie siedząc (Cable Row / maszyna)' } }) || []).some((a) => /wyciągiem|hantlem/i.test(a)));
ok('short liny no ac alts', (ctx.exAcAltItems('liny') || []).length === 0);
ok('AI row still ac alts', (ctx.exAcAltItems('Wiosłowanie na maszynie siedząc (Cable Row / maszyna)') || []).some((a) => /wyciągiem|hantlem/i.test(a)));

if (failed) process.exit(1);
console.log('\nAll studio-machine-alts tests passed');
