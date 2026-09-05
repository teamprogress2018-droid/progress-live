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
ok('saves progression', /plan\.progression=progression/.test(src03));
ok('cache', html.includes('03-ai-plangen-bizstats-aicoach.js?v=29') && html.includes('styles.css?v=60'));
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

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll plan-pdf tests passed');
