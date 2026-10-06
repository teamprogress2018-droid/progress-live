// Generator AI: powtórzenia zmieniają się z tygodnia na tydzień wg metody progresji; objętość wg stażu i statusu farmakologicznego.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '../..');
const d = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {}, appendChild() {} }) };
const w = { addEventListener() {}, CL: [], PL: [], SE: [], EX: [], WO: [], METRIC_ENTRIES: [], document: d }; w.window = w;
const c = { window: w, document: d, console, Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON, setTimeout, clearTimeout, isNaN, Infinity, undefined, fetch: async () => ({}) };
c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), c);
const src = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
vm.runInContext(src, c);
let failed = 0;
const ok = (n, x, e) => { if (!x) { console.error('FAIL ' + n + (e ? ' — ' + e : '')); failed++; } else console.log('OK   ' + n); };
const keys = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'];
const ph = c.aplPhasesForPlan('PPL', 8, keys, 'masa');
const run = (t, reps) => { const ex = { sets: '4', reps, rest: '90s', rpe: '8', rir: '2', kg: '100' }; c.aplComputeProgression(ex, keys, ph, t); return ex; };
for (const t of ['wave', 'dup', 'linear', 'block', 'double']) {
  const ex = run(t, '8-12');
  const reps = keys.slice(0, 7).map(k => ex[k].r);
  const changes = reps.slice(1).filter((r, i) => r !== reps[i]).length;
  ok(t + ': reps change week to week (not one range for 7 weeks)', changes >= 5, reps.join(' '));
  ok(t + ': hypertrophy floor — never below 6 reps', reps.every(r => parseInt(r, 10) >= 6), reps.join(' '));
  ok(t + ': deload returns to the base range', ex.w8.r === '8-12', ex.w8.r);
  const kgs = keys.slice(0, 7).map(k => parseFloat(ex[k].kg));
  ok(t + ': load stays sane (max +20% over 7 weeks)', Math.max(...kgs) <= 120 && Math.min(...kgs) >= 95, kgs.join(' '));
}
const wave = run('wave', '8-12');
ok('wave: lighter high-rep week, heavier low-rep week', wave.w2.r === '10-14' && wave.w4.r === '6-10' && parseFloat(wave.w4.kg) > parseFloat(wave.w2.kg));
const dbl = run('double', '8-12');
ok('double: lower bound climbs, then resets with more load', dbl.w2.r === '9-12' && dbl.w4.r === '11-12' && dbl.w5.r === '8-12' && parseFloat(dbl.w5.kg) > parseFloat(dbl.w1.kg));
const noPh = {}; keys.forEach(k => { noPh[k] = k === 'w8' ? 'Deload' : 'Siła'; });
for (const t of ['linear', 'dup', 'block', 'double', 'wave']) {
  const ex = { sets: '4', reps: '8-12', rest: '120s', rpe: '8', kg: '100' }; c.aplComputeProgression(ex, keys, noPh, t);
  const kgs = keys.slice(0, 7).map(k => parseFloat(ex[k].kg));
  ok(t + ' (strength path): one load rule, max +20% over 7 weeks', Math.max(...kgs) <= 120, kgs.join(' '));
  const lo = k => parseInt(ex[k].r, 10);
  const inverted = keys.slice(0, 7).some(a => keys.slice(0, 7).some(b => lo(a) < lo(b) && parseFloat(ex[a].kg) < parseFloat(ex[b].kg) && keys.indexOf(a) > keys.indexOf(b) && Math.floor(keys.indexOf(a) / 4) === Math.floor(keys.indexOf(b) / 4)));
  ok(t + ' (strength path): within a wave fewer reps never means less load', !inverted, keys.slice(0, 7).map(k => ex[k].r + '@' + ex[k].kg).join(' '));
  if (t === 'wave') ok('wave (strength path): high-rep week lighter than low-rep week', ex.w2.r === '10-14' && ex.w4.r === '6-10' && parseFloat(ex.w2.kg) < parseFloat(ex.w4.kg), ex.w2.r + '@' + ex.w2.kg + ' ' + ex.w4.r + '@' + ex.w4.kg);
}
const timed = run('linear', '20s');
ok('timed sets untouched', keys.every(k => timed[k].r === '20s'));

const nat = c.aplVolumeTarget('zaawansowany', '60', '');
const enh = c.aplVolumeTarget('zaawansowany', '60', 'wspomagany');
const trt = c.aplVolumeTarget('zaawansowany', '60', 'TRT');
ok('advanced natural: 14–20 sets/week', nat.weekly === '14–20' && nat.weeklyMin === 12, JSON.stringify(nat));
ok('advanced enhanced: ~+30% (18–26), 3–5 sets', enh.weekly === '18–26' && enh.weeklyMin >= 16 && enh.sets === '3–5' && /wspomagany/.test(enh.label), JSON.stringify(enh));
ok('TRT between natural and enhanced', trt.weeklyMin > nat.weeklyMin && trt.weeklyMin < enh.weeklyMin, JSON.stringify(trt));
ok('prompt cites the volume research', /Schoenfeld/.test(src) && /Baz-Valle/.test(src) && /Pelland/.test(src) && /Bhasin/.test(src));

const plan = { days: [
  { exercises: [{ name: 'Wyciskanie na ławce', muscleGroup: 'Klatka', sets: '3' }, { name: 'Rozpiętki', muscleGroup: 'Klatka', sets: '3' }, { name: 'Wiosłowanie', muscleGroup: 'Plecy', sets: '4' }] },
  { exercises: [{ name: 'Wyciskanie skos', muscleGroup: 'Klatka', sets: '3' }, { name: 'Ściąganie drążka', muscleGroup: 'Plecy', sets: '4' }, { name: 'Plank', muscleGroup: 'Core', sets: '3' }] }] };
const top = c.aplEnforceWeeklyVolume(plan, enh);
const sum = cat => plan.days.flatMap(x => x.exercises).filter(e => e.muscleGroup === cat).reduce((a, e) => a + +e.sets, 0);
const capped = cat => plan.days.flatMap(x => x.exercises).filter(e => e.muscleGroup === cat).every(e => +e.sets === 5);
ok('enforce: chest and back raised to the minimum or every exercise at 5 sets', (sum('Klatka') >= enh.weeklyMin || capped('Klatka')) && (sum('Plecy') >= enh.weeklyMin || capped('Plecy')) && plan.days.flatMap(x => x.exercises).every(e => +e.sets <= 5) && top.some(t => t.cat === 'klatka'), JSON.stringify(top));
ok('enforce: core untouched', plan.days[1].exercises[2].sets === '3');
const checks = c.aplPlanChecks(Object.assign({ progression: 'wave', volumeTopUp: top, volumeTarget: { label: enh.label } }, plan), { level: 'zaawansowany', duration: '60', pharma: 'wspomagany' });
ok('still below minimum after cap → flagged as low weekly volume', checks.some(x => x.kind === 'volume-week' && /klatka 15/.test(x.text)), JSON.stringify(checks));
ok('plan check reports added sets', checks.some(x => x.kind === 'volume-topup' && /klatka \d+→\d+/.test(x.text)), JSON.stringify(checks));
if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('\nAll periodization checks passed');
