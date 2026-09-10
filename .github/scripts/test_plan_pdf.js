// PDF planu AI: czerwień Progress, granat, różowe komórki tygodni.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('no purple pdf accent', !/accent='#7c3aed'/.test(src03) && /class="plan-pdf"/.test(src03));
ok('css red navy pink', css.includes('--pdf-red:#e11f2e') && css.includes('--pdf-navy:#16181f') && css.includes('--pdf-pink:#fde8ea'));
ok('css priorytet + week cell', css.includes('.plan-pdf-pri') && css.includes('.plan-pdf-wk') && css.includes('.plan-pdf-day-h'));
ok('export helper', /window\.buildPlanPDFHTML=buildPlanPDFHTML/.test(src03));
ok('saved plan mapper', /function planToPdfModel\(/.test(src03) && /window\.planToPdfModel=planToPdfModel/.test(src03));
ok('saved plan export', /function exportSavedPlanPDF\(/.test(src03) && /window\.exportSavedPlanPDF=exportSavedPlanPDF/.test(src03));
ok('saves progression', /plan\.progression=progression/.test(src03));
ok('cache', html.includes('03-ai-plangen-bizstats-aicoach.js?v=34') && html.includes('styles.css?v=77'));
ok('CI', wf.includes('test_plan_pdf.js') && wf.includes('test_plan_pdf_ui.js'));

const slice = src03.match(/function planPdfEsc[\s\S]*?^function aplReset/m);
if (!slice) {
  console.error('Could not extract PDF helpers');
  process.exit(1);
}
const ctx = { window: {}, console, Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON, isNaN };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(slice[0].replace(/\nfunction aplReset[\s\S]*$/, '\n'), ctx);

const plan = {
  planName: 'Masa 6 tyg.',
  daysPerWeek: 3,
  weeks: 6,
  progression: 'linear',
  periodization: 'Progresja liniowa 2.5kg/tyg na wielostawach. Deload w tyg. 6.',
  warmup: '5 min rower stacjonarny + mobilizacja.',
  weekKeys: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
  phases: { w1: 'Adaptacja', w2: 'Hipertrofia I', w3: 'Hipertrofia I', w4: 'Hipertrofia II', w5: 'Siła', w6: 'Deload' },
  days: [{
    dayName: 'Dzień 1 — Push + czworogłowe',
    focus: 'Push+Czworogłowe',
    exercises: [{
      name: 'Hack squat',
      notes: 'Pauza 1-2s w rozciągnięciu',
      rest: '90s',
      sets: '3',
      reps: '10',
      rir: '7',
      w1: { s: '3', r: '10', rpe: '7', kg: '80' },
      w2: { s: '3', r: '10', rpe: '7', kg: '82.5' },
      w3: { s: '3', r: '10', rpe: '8', kg: '85' },
      w4: { s: '4', r: '8', rpe: '8', kg: '87.5' },
      w5: { s: '4', r: '6', rpe: '9', kg: '90' },
      w6: { s: '2', r: '8', rpe: '5', kg: '60' }
    }]
  }]
};
const out = ctx.buildPlanPDFHTML(plan, { name: 'Piotr Test' });
ok('title', /PLAN TRENINGOWY/.test(out) && /class="plan-pdf"/.test(out));
ok('split red', /Push\+Czworogłowe/.test(out) && /plan-pdf-kpi-val is-red/.test(out));
ok('sessions 3', />3</.test(out) && /Sesje/.test(out));
ok('weeks 6', />6</.test(out));
ok('linear', />linear</.test(out));
ok('rules + warmup', /Zasady progresji/.test(out) && /Rozgrzewka/.test(out) && /rower stacjonarny/.test(out));
ok('navy day header', /plan-pdf-day-h/.test(out) && /DZIEŃ 1/.test(out));
ok('week cells', /plan-pdf-wk/.test(out) && /3×10/.test(out) && /RPE 7/.test(out));
ok('arrows', /plan-pdf-arrow-up/.test(out) && /plan-pdf-arrow-dn/.test(out));
ok('priorytet', /plan-pdf-pri/.test(out) && /PRIORYTET/.test(out));
ok('no old purple', !/#7c3aed/.test(out));
ok('logo', /progress-logo\.jpg/.test(out));

const saved = ctx.planToPdfModel({
  name: 'FBW Oli',
  method: 'FBW',
  duration: 8,
  progression: 'linear',
  clientId: 'c1',
  days: [
    { day: 'PON', muscles: 'Całe ciało', exercises: [
      { name: 'Hack squat', sets: '4', reps: '8', kg: '80', rir: '2', rest: '120s', note: 'Głęboko' }
    ]},
    { day: 'WT', rest: true, exercises: [] },
    { day: 'ŚR', muscles: 'Całe ciało', exercises: ['Wyciskanie 3x10 @40kg'] }
  ]
});
ok('saved name', saved.planName === 'FBW Oli');
ok('saved weeks duration', saved.weeks === 8);
ok('saved skips rest', saved.days.length === 2 && /PON/.test(saved.days[0].dayName) && /ŚR/.test(saved.days[1].dayName));
ok('saved week cell', saved.weekKeys[0] === 'w1' && saved.days[0].exercises[0].w1.s === '4' && saved.days[0].exercises[0].w1.r === '8');
ok('saved string ex', saved.days[1].exercises[0].name === 'Wyciskanie' && saved.days[1].exercises[0].w1.s === '3');
const savedHtml = ctx.buildPlanPDFHTML(saved, { name: 'Ola' });
ok('saved html', /FBW Oli/.test(savedHtml) && /Hack squat/.test(savedHtml) && /4×8/.test(savedHtml) && /Ola/.test(savedHtml) && /RPE 8/.test(savedHtml));

const multi = ctx.planToPdfModel({
  name: 'Kontynuacja Fitebo',
  duration: 4,
  weekKeys: ['w1', 'w2', 'w3', 'w4'],
  phases: { w1: 'Adaptacja', w2: 'Hipertrofia I', w3: 'Hipertrofia I', w4: 'Deload' },
  days: [{ day: 'Push', muscles: 'Klatka', exercises: [{
    name: 'Wyciskanie', sets: '3', reps: '10', kg: '40',
    w1: { s: '3', r: '10', kg: '40', rpe: '7' },
    w2: { s: '3', r: '10', kg: '42.5', rpe: '8' },
    w3: { s: '4', r: '8', kg: '45', rpe: '8' },
    w4: { s: '2', r: '8', kg: '30', rpe: '5' }
  }]}]
});
const multiHtml = ctx.buildPlanPDFHTML(multi, { name: 'Radek' });
ok('multi weeks', multi.weekKeys.length === 4 && /Tydzień 4/.test(multiHtml) && /plan-pdf-arrow-up/.test(multiHtml) && /plan-pdf-arrow-dn/.test(multiHtml));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll plan-pdf tests passed');
