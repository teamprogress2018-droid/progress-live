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
const lin = run('linear', '8-10');
ok('linear: +1 rep a week at the same load, then back to start with more load', lin.w1.r === '8-10' && lin.w2.r === '9-11' && lin.w3.r === '10-12' && lin.w4.r === '11-13' && lin.w5.r === '8-10' && parseFloat(lin.w5.kg) > parseFloat(lin.w4.kg), keys.map(k => lin[k].r + '@' + lin[k].kg).join(' '));
const startPlan = { days: [{ exercises: [
  { name: 'Wyciskanie hantli na ławce skośnej dodatniej', muscleGroup: 'Klatka', reps: '7-9' },
  { name: 'Rozpiętka na wyciągu cross', muscleGroup: 'Klatka', reps: '9-11' },
  { name: 'Unoszenie hantli bokiem stojąc', muscleGroup: 'Barki (bok)', reps: '11-14' },
  { name: 'Wypychanie nóg na suwnicy', muscleGroup: 'Nogi', reps: '9-11' },
  { name: 'Plank', muscleGroup: 'Core', reps: '30s' }] }] };
c.aplNormalizeStartReps(startPlan);
const sr = startPlan.days[0].exercises.map(e => e.reps);
ok('start ranges: compounds 8-10, isolations 10-12, side delts with dumbbells capped to 9-12, time untouched', sr.join(',') === '8-10,10-12,9-12,8-10,30s', sr.join(','));
const timed = run('linear', '20s');
ok('timed sets untouched', keys.every(k => timed[k].r === '20s'));

const nat = c.aplVolumeTarget('zaawansowany', '60', '');
const enh = c.aplVolumeTarget('zaawansowany', '60', 'wspomagany');
const trt = c.aplVolumeTarget('zaawansowany', '60', 'TRT');
ok('advanced natural: 14–20 sets/week', nat.weekly === '14–20' && nat.weeklyMin === 12, JSON.stringify(nat));
ok('anabolic status alone does not increase volume', JSON.stringify(enh) === JSON.stringify(nat), JSON.stringify(enh));
ok('TRT alone does not increase volume', JSON.stringify(trt) === JSON.stringify(nat), JSON.stringify(trt));
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
ok('only back below the level-based minimum is flagged', checks.some(x => x.kind === 'volume-week' && /plecy 10/.test(x.text) && !/klatka/.test(x.text)), JSON.stringify(checks));
ok('plan check reports added sets', checks.some(x => x.kind === 'volume-topup' && /klatka \d+→\d+/.test(x.text)), JSON.stringify(checks));
// Realne skoki ciężaru: bez 60 → 60,3 kg; w fali powtórzeń ten sam ciężar, nowa fala = skok sprzętu.
const hypPh = c.aplPhasesForPlan('PPL', 8, keys, 'masa');
const runN = (name, kg, t) => { const ex = { name, sets: '4', reps: '8-10', rest: '90s', rpe: '8', kg }; c.aplComputeProgression(ex, keys, hypPh, t || 'linear'); return keys.map(k => parseFloat(ex[k].kg)); };
const db = runN('Wyciskanie hantli na ławce skośnej dodatniej', '26');
ok('hantle: tylko pełne kilogramy co 2 kg, fala bez zmian, potem +2 kg', db.slice(0, 4).every(v => v === 26) && db[4] === 28 && db.every(v => v % 2 === 0), db.join(' '));
const mach = runN('Wyciskanie na maszynie siedząc', '60');
ok('maszyna: 60 przez falę, potem 62,5', mach.slice(0, 4).every(v => v === 60) && mach[4] === 62.5 && mach.every(v => Math.abs(v / 2.5 - Math.round(v / 2.5)) < 1e-9), mach.join(' '));
const bar = runN('Wyciskanie sztangi leżąc', '80', 'double');
ok('sztanga (double): ciężary co 2,5 kg', bar.every(v => Math.abs(v / 2.5 - Math.round(v / 2.5)) < 1e-9), bar.join(' '));
ok('skok sprzętu: hantle 2 kg, sztanga 2,5, suwnica 120 kg → 5', c.aplLoadStep({ name: 'Uginanie hantlami' }, 14) === 2 && c.aplLoadStep({ name: 'Przysiad ze sztangą' }, 100) === 2.5 && c.aplLoadStep({ name: 'Wypychanie nóg na suwnicy' }, 120) === 5);
const oldPlan = { weekKeys: keys, phases: hypPh, days: [{ exercises: [{ name: 'Wyciskanie na maszynie siedząc', kg: '60' }, { name: 'Wiosłowanie hantlem', kg: '22' }] }] };
const oldW = ['8-10@60', '9-11@60.3', '10-12@60.6', '11-13@62.7', '8-10@64.6', '9-11@64.9', '10-12@65.9', '8-10@59.7'];
keys.forEach((k, i) => { const [r, kg] = oldW[i].split('@'); oldPlan.days[0].exercises[0][k] = { r, kg }; oldPlan.days[0].exercises[1][k] = { r, kg: String(22 + 2 * Math.floor(i / 4)) }; });
const nFix = c.aplRepairPlanLoads(oldPlan);
const fixed = keys.map(k => oldPlan.days[0].exercises[0][k].kg).join(' ');
ok('naprawa starego planu: 60 ×4, 65 ×3, deload niżej', nFix > 0 && fixed === '60 60 60 60 65 65 65 57.5', fixed);
ok('naprawa nie rusza ręcznych, równych ciężarów', keys.map(k => oldPlan.days[0].exercises[1][k].kg).join(' ') === '22 22 22 22 24 24 24 24');
ok('naprawa jest jednorazowa', c.aplRepairPlanLoads(oldPlan) === 0);
// Limit powtórzeń: maszyny i wyciągi maks. 15, wolne ciężary maks. 12, masa ciała bez limitu.
const repsOf = (name, reps) => { const ex = { name, sets: '3', reps, rest: '60s', rpe: '8', kg: '20' }; c.aplComputeProgression(ex, keys, hypPh, 'linear'); return keys.map(k => ex[k].r); };
const hiOf = r => +String(r).split(/[-–]/).pop();
const dbR = repsOf('Uginanie hantli na ławce skośnej', '10-12'), sqR = repsOf('Przysiad ze sztangą', '8-10'), fpR = repsOf('Face pull na wyciągu', '12-15'), mcR = repsOf('Prostowanie nóg na maszynie', '10-12'), bwR = repsOf('Unoszenie nóg w zwisie', '12-15');
ok('wolne ciężary: nigdy powyżej 12 powtórzeń', dbR.concat(sqR).every(r => hiOf(r) <= 12) && dbR[1] === '11-12' && dbR[2] === '12', dbR.join(' ') + ' | ' + sqR.join(' '));
ok('maszyny i wyciągi: nigdy powyżej 15 powtórzeń', fpR.concat(mcR).every(r => hiOf(r) <= 15) && fpR[3] === '15' && mcR[3] === '13-15', fpR.join(' ') + ' | ' + mcR.join(' '));
ok('masa ciała bez limitu', bwR[3] === '15-18', bwR.join(' '));
const capPlan = { weekKeys: ['w1', 'w2'], days: [{ exercises: [{ name: 'Uginanie hantli', reps: '12-15', w1: { r: '12-15' }, w2: { r: '13-16' } }, { name: 'Face pull na wyciągu', reps: '12-15', w1: { r: '12-15' }, w2: { r: '15-18' } }] }] };
ok('naprawa zapisanych planów: limit powtórzeń', c.aplRepairPlanRepCaps(capPlan) > 0 && capPlan.days[0].exercises[0].w2.r === '12' && capPlan.days[0].exercises[0].reps === '9-12' && capPlan.days[0].exercises[0].w1.r === '9-12' && capPlan.days[0].exercises[1].w2.r === '15' && c.aplRepairPlanRepCaps(capPlan) === 0, JSON.stringify(capPlan.days[0].exercises));
if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('\nAll periodization checks passed');
