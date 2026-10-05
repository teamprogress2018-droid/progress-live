// ETAP 6: plan z kreatora AI — kontrola planu, potwierdzony zapis z progresją tygodniową, przejście do Live.
// Odpowiedź AI z fixture (bez wywołań API), baza w pamięci strony.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.route('**/anthropic-proxy**', r => r.abort());
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00'));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof aplSavePlan === 'function' && typeof aplBuildSavedPlan === 'function' && typeof aplPlanChecks === 'function');

  const out = await page.evaluate(async () => {
    window._uid = 'apl-trainer'; window._clientAppMode = false; window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'apl' };
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    window.__notes = []; window.notify = m => window.__notes.push(String(m)); window.confirm = () => false;
    const store = window.__store = new Map(); let failNext = 1;
    window.persistById = async (col, obj) => { if (failNext > 0) { failNext--; return null; } store.set(col + '/' + obj.id, JSON.parse(JSON.stringify(obj))); return obj; };
    window.CL = [{ id: 'cK', trainerId: 'apl-trainer', name: 'Kasia Kolano', goal: 'hipertrofia', level: 'sredni', injuries: 'ból kolana — łąkotka' }];
    window.PL = []; window.SE = [];
    if (typeof goTo === 'function') goTo('aiplangen');
    const sel = document.getElementById('apl-client');
    if (sel) { sel.innerHTML = '<option value="cK">Kasia Kolano</option>'; sel.value = 'cK'; }
    const b45 = document.querySelector('#apl-duration [data-val="45"]'); if (b45) aplToggleOpt(b45, 'apl-duration');
    const inj = document.getElementById('apl-injuries'); if (inj) inj.value = '';
    // Odpowiedź AI (fixture) przechodzi przez tę samą obróbkę co w aplGenerate.
    const weekKeys = ['w1', 'w2', 'w3', 'w4'];
    const phases = { w1: 'Akumulacja I', w2: 'Akumulacja II', w3: 'Pik objętości', w4: 'Deload' };
    const plan = { planName: 'Hipertrofia 4 tyg.', summary: 'Test', method: 'Upper/Lower', weeks: 4, progression: 'double', weekKeys, phases, currentWeek: 'w1',
      rationale: { reasoning: ['Kolano: bez skoków'] },
      days: [
        { dayName: 'Dół', focus: 'nogi', exercises: [
          { name: 'Wykroki chodzone', sets: '3', reps: '10-12', rest: '90s', rir: '2', rpe: '8', kg: '20' },
          { name: 'Leg press', sets: '4', reps: '8-12', rest: '120s', rir: '2', rpe: '8', kg: '120' }] },
        { dayName: 'Góra', focus: 'klatka, plecy', exercises: [
          { name: 'Wyciskanie sztangi na ławce płaskiej', sets: '4', reps: '6-10', rest: '3 min', rir: '2', rpe: '8', kg: '70' },
          { name: 'Wiosłowanie sztangą', sets: '4', reps: '8-10', rest: '3 min', rir: '2', rpe: '8', kg: '60' },
          { name: 'Ściąganie drążka', sets: '4', reps: '10-12', rest: '3 min', rir: '2', rpe: '8', kg: '50' },
          { name: 'Rozpiętki', sets: '4', reps: '', rest: '3 min', rir: '', rpe: '', kg: '12' }] }] };
    plan.days.forEach(d => d.exercises.forEach(ex => aplComputeProgression(ex, weekKeys, phases, 'double')));
    window.aplLastPlan = plan;
    try { aplLastPlan = plan; } catch (e) {}
    aplRenderPlan(plan, window.CL[0], 'masa', 'Upper/Lower', 2, 4);
    const checks = [...document.querySelectorAll('[data-apl-check]')].map(li => ({ kind: li.dataset.aplCheck, text: li.textContent }));
    const box = (document.querySelector('[data-apl-checks]') || {}).innerText || '';

    const r1 = await aplSavePlan();
    const after1 = { saved: !!r1, pl: window.PL.length, btn: (document.getElementById('apl-save-btn') || {}).textContent, notes: window.__notes.slice(-1)[0] };
    const r2 = await aplSavePlan();
    const planDocs = () => [...store.keys()].filter(k => k.startsWith('plans/')).length;
    const doc = store.get('plans/' + (r2 && r2.id)) || {};
    const after2 = { saved: !!r2, pl: window.PL.length, docs: planDocs(), btn: (document.getElementById('apl-save-btn') || {}).textContent, id: r2 && r2.id };
    const r3 = await aplSavePlan();
    const after3 = { pl: window.PL.length, docs: planDocs(), note: window.__notes.slice(-1)[0] };
    plan.days[1].exercises[0].w1.kg = '72.5';
    aplEditExercise(1, 1);
    const rirInput = document.getElementById('apl-edit-rir-1-1');
    let edited = null;
    if (rirInput) { rirInput.value = '8'; aplSaveExerciseEdit(1, 1); edited = { rir: plan.days[1].exercises[1].w1.rir, rpe: plan.days[1].exercises[1].w1.rpe }; }
    const r4 = await aplSavePlan();
    const row = r4 && r4.days[1].exercises[1];
    const weekly = typeof exerciseForPlanWeek === 'function' && r4 ? { w1: exerciseForPlanWeek(r4.days[1].exercises[0], r4, 0).rir, w4: exerciseForPlanWeek(r4.days[1].exercises[0], r4, 3).rir } : null;
    const after4 = { edited, savedRow: row && { rir: row.rir, rpe: row.rpe, w1: row.w1 }, weekly, pl: window.PL.length, docs: planDocs(), sameId: r4 && r2 && r4.id === r2.id, kg: (r4 && r4.days[1].exercises[0].kg), note: window.__notes.slice(-1)[0] };
    const bench = doc.days && doc.days[1].exercises[0];
    // Live: zapisany plan prowadzi trening tym samym celem RIR i tygodniową progresją.
    goTo('live');
    liveClientSetField('cK', 'Kasia Kolano', false, 0);
    liveSelectPlan(r4.id, 0);
    const liveEx = (window.liveExercises || []).map(e => ({ name: e.name, rir: e.rir, kg: (e.sets || []).map(s => s.kg)[0] }));
    return { checks, box, after1, after2, after3, after4, doc: { weekKeys: doc.weekKeys, currentWeek: doc.currentWeek, progression: doc.progression, phases: doc.phases, bench }, liveEx };
  });
  console.log(JSON.stringify(out).slice(0, 2500));
  ok('checks: knee-unsafe lunge flagged before saving', out.checks.some(c => c.kind === 'limit' && /Wykroki chodzone/.test(c.text) && !/Leg press/.test(c.text)), JSON.stringify(out.checks));
  ok('checks: too-long session flagged with minutes', out.checks.some(c => c.kind === 'time' && /Góra: ok\. \d+ min przy założonych 45 min/.test(c.text)), JSON.stringify(out.checks));
  ok('checks: exercise without rep range flagged', out.checks.some(c => c.kind === 'fields' && /Rozpiętki/.test(c.text)), JSON.stringify(out.checks));
  ok('checks: progression rule named', /Zasada progresji: podwójna/.test(out.box), out.box);
  ok('save offline: no success, plan not added, retry offered', !out.after1.saved && out.after1.pl === 0 && /Zapisz ponownie/.test(out.after1.btn) && /nie został zapisany/.test(out.after1.notes), JSON.stringify(out.after1));
  ok('retry: plan saved once', out.after2.saved && out.after2.pl === 1 && out.after2.docs === 1 && /Zapisany/.test(out.after2.btn), JSON.stringify(out.after2));
  ok('third click: no duplicate', out.after3.pl === 1 && out.after3.docs === 1 && /już zapisany/.test(out.after3.note), JSON.stringify(out.after3));
  ok('edit after save: same plan updated, not duplicated', out.after4.pl === 1 && out.after4.docs === 1 && out.after4.sameId && out.after4.kg === '72.5', JSON.stringify(out.after4));
  ok('edit: RPE 8 typed in the plan editor becomes RIR 2 (and is saved)', out.after4.edited && out.after4.edited.rir === '2' && out.after4.edited.rpe === '8' && out.after4.savedRow && out.after4.savedRow.rir === '2', JSON.stringify(out.after4));
  ok('Live follows weekly RIR (deload week differs from week 1)', out.after4.weekly && out.after4.weekly.w1 !== out.after4.weekly.w4 && out.after4.weekly.w4 === '3.5', JSON.stringify(out.after4.weekly));
  ok('saved plan keeps week progression and rule', JSON.stringify(out.doc.weekKeys) === '["w1","w2","w3","w4"]' && out.doc.currentWeek === 'w1' && out.doc.progression === 'double' && out.doc.phases && out.doc.phases.w4 === 'Deload', JSON.stringify(out.doc));
  ok('RIR stays RIR (not RPE 8)', out.doc.bench && out.doc.bench.rir !== '8' && out.doc.bench.rpe === String(out.doc.bench.rpe) && out.doc.bench.w2 && out.doc.bench.w4, JSON.stringify(out.doc.bench));
  ok('Live uses the saved plan with RIR target', out.liveEx.length >= 2 && out.liveEx.every(e => String(e.rir || '') !== '8'), JSON.stringify(out.liveEx));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll AI plan save checks passed');
})().catch(e => { console.error(e); process.exit(1); });
