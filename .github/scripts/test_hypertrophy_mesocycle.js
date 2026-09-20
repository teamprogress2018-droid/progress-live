#!/usr/bin/env node
'use strict';
/** Generator AI: 8-tyg. mezocykl hipertrofii (RIR, bez faz 1–3 powt.). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild() {} })
};
const windowObj = { addEventListener() {}, CL: [], PL: [], SE: [], EX: [], WO: [], METRIC_ENTRIES: [], document };
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, setTimeout, clearTimeout, isNaN, Infinity, undefined,
  fetch: async () => ({ ok: true, json: async () => ({}) })
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
vm.runInContext(src03, ctx);

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 03 v39', html.includes('03-ai-plangen-bizstats-aicoach.js?v=40'));
ok('CI', wf.includes('test_hypertrophy_mesocycle.js'));
ok('prompt mezocycle fields', /mezocycle_overview/.test(src03) && /weekly_progression_schema/.test(src03) && /workout_plan/.test(src03));
ok('prompt bans 1-3 for masa', /ZAKAZ faz siły maksymalnej/.test(src03) && /Akumulacja I/.test(src03) && /Pik objętości/.test(src03));
ok('prompt rest ranges', /90–180/.test(src03) && /60–90/.test(src03));
ok('prompt drop-set acc II', /drop-set lub rest-pause/.test(src03));
ok('ui schema mount', src03.includes('id="apl-week-schema"') && src03.includes('id="apl-adaptation-notes"'));
ok('pdf mezocycle', /Mezocykl/.test(src03) && /Progresja tygodniowa/.test(src03));

ok('masa is hypertrophy', ctx.aplIsHypertrophyGoal('masa') === true);
ok('hipertrofia string', ctx.aplIsHypertrophyGoal('hipertrofia / siła') === true);
ok('sila is not hypertrophy-only', ctx.aplIsHypertrophyGoal('sila') === false);

const keys = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'];
const hyp = ctx.aplPhasesForPlan('PPL', 8, keys, 'masa');
ok('8w acc I', hyp.w1 === 'Akumulacja I' && hyp.w3 === 'Akumulacja I');
ok('8w acc II', hyp.w4 === 'Akumulacja II' && hyp.w6 === 'Akumulacja II');
ok('8w peak then deload', hyp.w7 === 'Pik objętości' && hyp.w8 === 'Deload');
ok('no strength phase on masa', !Object.values(hyp).some(v => /siła/i.test(v)));

const sila = ctx.aplPhasesForPlan('PPL', 8, keys, 'sila');
ok('sila 8w keeps Siła', sila.w6 === 'Siła');

const schema = ctx.aplDefaultHypertrophySchema(8, keys);
ok('schema 8 rows', schema.length === 8 && schema[0].rir === '2–3' && schema[6].rir === '0–1' && schema[7].rir === '3–4');

const ex = { name: 'Hack squat', sets: '4', reps: '10', rest: '120s', rpe: '7', kg: '80' };
ctx.aplComputeProgression(ex, keys, hyp, 'block');
ok('w1 rir acc I', parseFloat(ex.w1.rir) >= 2 && parseFloat(ex.w1.rir) <= 3);
ok('w6 rir acc II', parseFloat(ex.w6.rir) >= 1 && parseFloat(ex.w6.rir) <= 2);
ok('w7 rir peak', parseFloat(ex.w7.rir) <= 1);
ok('w8 rir deload', parseFloat(ex.w8.rir) >= 3);
ok('w8 volume ~50%', parseInt(ex.w8.s, 10) === 2);
ok('w7 volume up', parseInt(ex.w7.s, 10) >= 4);

const parsed = ctx.aplParsePlanJson('{"mezocycle_overview":"8 tyg. hipertrofii","workout_plan":[{"dayName":"Push","exercises":[{"name":"Wyciskanie"}]}]}');
ok('parse workout_plan', parsed.days[0].dayName === 'Push' && /hipertrofii/.test(parsed.summary));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nHypertrophy mesocycle tests passed');
