// ETAP 3: cały obieg trenera dla 3 klientów — karta → plan → Live → zapis → historia → progres → następny trening → rekomendacja.
// Prawdziwy kod aplikacji w przeglądarce, Firestore zastąpiony pamięcią strony; żadnych zapisów produkcyjnych.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const shotDir = process.env.JOURNEY_SHOT_DIR || path.join(os.tmpdir(), 'pl-client-journey');
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

// Trzy profile z planu produkcji.
const CLIENTS = [
  { id: 'cA', name: 'Anna Początkująca', goal: 'redukcja', level: 'poczatkujacy', plan: 'plA',
    days: [{ day: 'FBW A', exercises: [
      { name: 'Przysiad goblet', sets: '3', reps: '10-12', kg: '12', rir: '3', rest: '90s' },
      { name: 'Wiosłowanie hantlem', sets: '3', reps: '10-12', kg: '10', rir: '3', rest: '90s' }] }],
    // reps rosną w zakresie, potem górny zakres przy RIR 3 → DODAJ
    sessions: [
      { date: '2026-09-07', ex: [[12, [10, 10, 10], 3], [10, [10, 10, 10], 3]] },
      { date: '2026-09-14', ex: [[12, [11, 11, 11], 3], [10, [11, 11, 11], 3]] },
      { date: '2026-09-21', ex: [[12, [12, 12, 12], 3], [10, [12, 12, 12], 3]] }] },
  { id: 'cB', name: 'Bartek Średni', goal: 'hipertrofia', level: 'sredni', plan: 'plB',
    days: [{ day: 'Push', exercises: [
      { name: 'Wyciskanie sztangi na ławce płaskiej', sets: '3', reps: '8-10', kg: '80', rir: '2', rest: '120s' }] }],
    sessions: [
      { date: '2026-09-08', ex: [[80, [10, 10, 9], 1]] },
      { date: '2026-09-15', ex: [[80, [10, 10, 10], 2]] },
      { date: '2026-09-22', ex: [[80, [10, 10, 10], 2]] }] },
  { id: 'cC', name: 'Celina Ograniczenia', goal: 'zdrowie', level: 'sredni', plan: 'plC', limits: 'ból barku — bez wyciskania nad głowę',
    days: [{ day: 'Góra', exercises: [
      { name: 'Wyciskanie hantli nad głowę', sets: '3', reps: '10', kg: '8', rir: '3', rest: '90s' }] }],
    // zamiennik od pierwszego treningu: Landmine press
    swap: 'Wyciskanie landmine',
    sessions: [
      { date: '2026-09-09', ex: [[15, [10, 10, 10], 3]] },
      { date: '2026-09-16', ex: [[15, [10, 10, 10], 3]] },
      { date: '2026-09-23', ex: [[15, [10, 10, 10], 3]] }] }
];

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.route('**://firestore.googleapis.com/**', r => r.abort());
  await page.clock.setFixedTime(new Date('2026-09-07T09:00:00'));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof liveSelectPlan === 'function' && typeof renderLiveExercises === 'function');

  await page.evaluate(({ CLIENTS }) => {
    window._uid = 'journey-trainer';
    window._clientAppMode = false;
    window.tenantSessionGeneration = 1;
    window._tenantDataReady = true;
    window._db = { fixture: 'journey' };
    const store = window.__store = new Map();
    window.__writes = [];
    window._doc = (_db, collection, id) => ({ collection, id });
    window._setDoc = async (ref, data, opts) => {
      if (window.__failNextSessionWrite && ref.collection === 'sessions') { window.__failNextSessionWrite = false; throw Object.assign(new Error('offline'), { code: 'unavailable' }); }
      if (data.trainerId && data.trainerId !== window._uid) throw Object.assign(new Error('foreign'), { code: 'permission-denied' });
      const key = ref.collection + '/' + ref.id, prev = store.get(key);
      store.set(key, JSON.parse(JSON.stringify(opts && opts.merge ? { ...prev, ...data } : data)));
      window.__writes.push(key);
    };
    window._runTransaction = async (_db, fn) => {
      if (window.__failNextSessionWrite) { window.__failNextSessionWrite = false; throw Object.assign(new Error('offline'), { code: 'unavailable' }); }
      const staged = [];
      const tx = {
        get: async ref => { const row = store.get(ref.collection + '/' + ref.id); return { exists: () => !!row, data: () => JSON.parse(JSON.stringify(row)) }; },
        set: (ref, data, opts) => staged.push(() => { const k = ref.collection + '/' + ref.id, prev = store.get(k); store.set(k, JSON.parse(JSON.stringify(opts && opts.merge ? { ...prev, ...data } : data))); }),
        update: (ref, patch) => staged.push(() => { const k = ref.collection + '/' + ref.id, prev = store.get(k); if (!prev) throw new Error('missing ' + k); store.set(k, { ...prev, ...patch }); })
      };
      const out = await fn(tx);
      if (window.__failNextCommit) { window.__failNextCommit = false; throw Object.assign(new Error('commit lost'), { code: 'unavailable' }); }
      staged.forEach(w => w());
      if (window.__failNextCommitAfterApply) { window.__failNextCommitAfterApply = false; throw Object.assign(new Error('ack lost'), { code: 'unavailable' }); }
      return out;
    };
    window.confirm = () => true;
    window.__notes = [];
    window.notify = m => window.__notes.push(String(m));
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    CLIENTS.forEach(c => store.set('plans/' + c.plan, { id: c.plan, trainerId: window._uid, clientId: c.id, name: 'Plan ' + c.name, days: c.days }));
    window.CL = CLIENTS.map(c => ({ id: c.id, trainerId: window._uid, name: c.name, goal: c.goal, level: c.level, status: 'active', notes: c.limits || '' }));
    window.PL = CLIENTS.map(c => ({ id: c.plan, trainerId: window._uid, clientId: c.id, name: 'Plan ' + c.name, goal: c.goal, level: c.level, days: c.days }));
    window.SE = []; window.TASKS = [];
    window.__seedMetrics = true; window.__store.set('packages/pkB', { id: 'pkB', trainerId: window._uid, clientId: 'cB', title: '10 wejść', payStatus: 'paid', status: 'active', sessions: 10, sessionsUsed: 0 });
    window.PACKAGES = [{ id: 'pkB', trainerId: window._uid, clientId: 'cB', title: '10 wejść', payStatus: 'paid', status: 'active', sessions: 10, sessionsUsed: 0, expiresDate: '2027-12-31' }]; window.CHECKINS = {}; window.METRIC_ENTRIES = [];
    if (typeof goTo === 'function') goTo('live');
  }, { CLIENTS });

  // Jeden trening przez prawdziwe funkcje Live: klient → plan → serie ✓ → Zakończ.
  async function runSession(c, s, idx) {
    await page.clock.setFixedTime(new Date(s.date + 'T09:00:00'));
    return page.evaluate(({ c, s, idx }) => {
      liveClientSetField(c.id, c.name, false, 0);
      liveSelectPlan(c.plan, 0);
      const st = { ex: window.liveExercises.map(e => ({ name: e.name, kg: e.sets.map(x => x.kg), reps: e.sets.map(x => x.reps) })) };
      const strip = [...document.querySelectorAll('#live-exercises-panel .live-ex-cue')].map(el => el.innerText);
      if (c.swap) liveSwapEx(0, c.swap, 0);
      s.ex.forEach(([kg, reps, rir], ei) => {
        const ex = window.liveExercises[ei];
        while (ex.sets.length < reps.length && typeof liveAddSet === 'function') liveAddSet(ei, 0);
        reps.forEach((r, si) => { liveSetKg(ei, si, String(kg), 0); liveSetReps(ei, si, String(r), 0); liveSetRir(ei, si, String(rir), 0); liveToggleSet(ei, si, 0); });
      });
      if (typeof liveStopRest === 'function') try { liveStopRest(0); } catch (e) {}
      liveAskEndSession(0); liveConfirmEnd();
      const saved = window.SE.filter(x => x.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date));
      return { before: st, strip, saved: saved.map(x => ({ id: x.id, date: x.date, planId: x.planId, ex: x.exercises.map(e => ({ name: e.name, n: e.sets.length, kg: e.sets.map(z => z.kg), reps: e.sets.map(z => z.reps), rir: e.sets.map(z => z.rir) })) })) };
    }, { c, s, idx });
  }

  const results = {};
  for (const c of CLIENTS) {
    results[c.id] = [];
    for (let i = 0; i < c.sessions.length; i++) results[c.id].push(await runSession(c, c.sessions[i], i));
  }

  // --- Zapis i historia
  for (const c of CLIENTS) {
    const last = results[c.id][c.sessions.length - 1];
    ok(c.id + ': 3 sessions saved', last.saved.length === 3, JSON.stringify(last.saved.map(x => x.date)));
    ok(c.id + ': session dates follow the calendar', last.saved.map(x => x.date).join() === c.sessions.map(x => x.date).join(), JSON.stringify(last.saved.map(x => x.date)));
    ok(c.id + ': session tied to plan', last.saved.every(x => x.planId === c.plan));
    const lastSaved = last.saved[2];
    const want = c.sessions[2].ex;
    ok(c.id + ': logged sets match what was done', want.every(([kg, reps, rir], ei) => lastSaved.ex[ei] && lastSaved.ex[ei].n === reps.length &&
      lastSaved.ex[ei].kg.every(k => Number(k) === kg) && lastSaved.ex[ei].reps.map(Number).join() === reps.join() && lastSaved.ex[ei].rir.every(r => String(r) === String(rir))), JSON.stringify(lastSaved.ex));
  }
  await page.waitForTimeout(100);
  const pkgOnline = await page.evaluate(() => ({ used: window.PACKAGES[0].sessionsUsed, db: (window.__store.get('packages/pkB') || {}).sessionsUsed,
    ticks: [...window.__store.entries()].filter(([k, v]) => k.startsWith('sessions/') && v.clientId === 'cB' && v.pkgTick).length }));
  ok('B: every Bartek workout saved with its package tick in one write', pkgOnline.ticks === 3);
  ok('B: package counts 3 confirmed workouts', pkgOnline.used === 3 && pkgOnline.db === 3 && pkgOnline.ticks === 3, JSON.stringify(pkgOnline));
  const stored = await page.evaluate(() => [...window.__store.keys()].filter(k => k.startsWith('sessions/')).length);
  ok('all 9 sessions reached the database', stored === 9, String(stored));

  // --- Następny trening: OSTATNIO / DZISIAJ / SUGESTIA po trzech treningach
  async function nextCue(c, date) {
    await page.clock.setFixedTime(new Date(date + 'T09:00:00'));
    return page.evaluate(({ c }) => {
      liveClientSetField(c.id, c.name, false, 0);
      liveSelectPlan(c.plan, 0);
      if (c.swap && window.liveExercises[0].name !== c.swap) liveSwapEx(0, c.swap, 0);
      renderLiveExercises(0);
      const cards = [...document.querySelectorAll('#live-exercises-panel .live-ex-card')];
      const out = cards.map(card => ({
        name: (card.querySelector('.live-ex-title') || {}).innerText || '',
        last: (card.querySelector('[data-cue="last"]') || {}).innerText || '',
        today: (card.querySelector('[data-cue="today"]') || {}).innerText || '',
        suggest: (card.querySelector('[data-cue="suggest"]') || {}).innerText || '',
        why: (card.querySelector('[data-cue="why"]') || {}).innerText || '',
        kg: [...card.querySelectorAll('.live-set-row .live-kg-input')].filter((_, i) => i % 2 === 0).map(x => x.value)
      }));
      return out;
    }, { c });
  }
  const cueA = await nextCue(CLIENTS[0], '2026-09-28');
  await page.screenshot({ path: path.join(shotDir, 'journey_A_next.png') });
  const cueB = await nextCue(CLIENTS[1], '2026-09-29');
  await page.screenshot({ path: path.join(shotDir, 'journey_B_next.png') });
  const cueC = await nextCue(CLIENTS[2], '2026-09-30');
  await page.screenshot({ path: path.join(shotDir, 'journey_C_next.png') });
  console.log('A', JSON.stringify(cueA)); console.log('B', JSON.stringify(cueB)); console.log('C', JSON.stringify(cueC));

  ok('A: OSTATNIO shows last session 12 kg × 12', /12 kg × 12/.test(cueA[0].last), cueA[0].last);
  ok('A: top of range with RIR 3 → DODAJ', /DODAJ/.test(cueA[0].suggest), cueA[0].suggest + ' | ' + cueA[0].why);
  ok('B: OSTATNIO only Bartek 80 kg', /80 kg × 10/.test(cueB[0].last) && !/12 kg/.test(cueB[0].last), cueB[0].last);
  ok('B: 10/10/10 @ RIR 2 twice → DODAJ 2,5 KG → 82,5 kg', /DODAJ 2,5 KG/.test(cueB[0].suggest) && /82,5 kg/.test(cueB[0].suggest), cueB[0].suggest + ' | ' + cueB[0].why);
  for (const [who, list] of [['A', cueA], ['B', cueB], ['C', cueC]]) for (const card of list) {
    const m = /→ (\d+(?:,\d+)?) kg/.exec(card.suggest);
    const today = /Dzisiaj:\s*(\d+(?:[.,]\d+)?) kg/.exec(card.today);
    if (m && today) ok(who + ': ' + card.name + ' — prefilled kg equals suggested target', Number(m[1].replace(',', '.')) === Number(today[1].replace(',', '.')), card.today + ' | ' + card.suggest);
  }
  ok('A: goblet steps by 2 kg (12 → 14)', /DODAJ 2 KG → 14 kg/.test(cueA[0].suggest), cueA[0].suggest);
  ok('C: swapped exercise keeps its own history', /15 kg × 10/.test(cueC[0].last), JSON.stringify(cueC[0]));
  ok('C: planned overhead load (8 kg) not shown as history', !/8 kg × 10/.test(cueC[0].last), cueC[0].last);

  // --- ETAP 4: monitoring — „wymaga uwagi” zamiast ściany liczb
  const monitor = await page.evaluate(() => {
    window.METRIC_ENTRIES = [
      { id: 'm1', trainerId: window._uid, clientId: 'cA', groupId: 'mg1', date: '2026-09-07', values: { m1: 80.0 } },
      { id: 'm2', trainerId: window._uid, clientId: 'cA', groupId: 'mg1', date: '2026-09-14', values: { m1: 79.9 } },
      { id: 'm3', trainerId: window._uid, clientId: 'cA', groupId: 'mg1', date: '2026-09-28', values: { m1: 79.8 } }
    ];
    const recsOf = id => (cpOverviewRecs((window.CL || []).find(c => c.id === id)) || []).map(r => ({ kind: r.kind, title: r.title, reason: r.reason }));
    const out = { A: recsOf('cA'), B: recsOf('cB'), C: recsOf('cC') };
    // Live: ostrzeżenie przy ćwiczeniu sprzecznym z ograniczeniem, znika po zamianie.
    liveClientSetField('cC', 'Celina Ograniczenia', false, 0);
    liveSelectPlan('plC', 0);
    out.limitBefore = (document.querySelector('#live-ex-0 [data-cue="limit"]') || {}).innerText || '';
    liveSwapEx(0, 'Wyciskanie landmine', 0); renderLiveExercises(0);
    out.limitAfter = (document.querySelector('#live-ex-0 [data-cue="limit"]') || {}).innerText || '';
    openClientProfile('cC');
    return out;
  });
  await page.waitForTimeout(200);
  const closeStart = page.getByRole('button', { name: 'Zamknij' });
  if (await closeStart.count()) await closeStart.first().click().catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(shotDir, 'journey_C_overview.png') });
  console.log('monitor', JSON.stringify(monitor));
  ok('max 3 attention items per client', ['A', 'B', 'C'].every(k => monitor[k].length <= 3));
  ok('A: weight not dropping on reduction is flagged with numbers', monitor.A.some(r => r.kind === 'massgoal' && /−0,2 kg w 3 tyg\. \(80 → 79,8 kg\)/.test(r.reason)), JSON.stringify(monitor.A));
  ok('C: plan exercise conflicting with shoulder limit is flagged first', monitor.C[0] && monitor.C[0].kind === 'limit' && /Wyciskanie hantli nad głowę/.test(monitor.C[0].reason), JSON.stringify(monitor.C));
  ok('B: no limit or weight-goal noise without data', !monitor.B.some(r => r.kind === 'limit' || r.kind === 'massgoal'), JSON.stringify(monitor.B));
  ok('Live warns about the conflicting exercise', /Ograniczenie \(bark\)/.test(monitor.limitBefore), monitor.limitBefore);
  ok('Live warning disappears after swapping to a safe exercise', monitor.limitAfter === '', monitor.limitAfter);

  // --- ETAP 5: progres per ćwiczenie i zmiana ciężaru w planie po zatwierdzeniu
  const openProgress = id => page.evaluate(id => { openClientProfile(id); const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Zamknij'); if (b) b.click(); setCPTab('progress'); }, id);
  await openProgress('cB');
  await page.waitForTimeout(200);
  const pd = await page.evaluate(() => { const r = document.querySelector('.cp-pd-row'); return r ? { text: r.innerText, btn: (r.querySelector('[data-pd-apply]') || {}).innerText || '' } : null; });
  await page.screenshot({ path: path.join(shotDir, 'journey_B_progress.png'), fullPage: true });
  console.log('progress', JSON.stringify(pd));
  ok('B: progress row shows history, suggestion and plan load', pd && /80×10,10,9 @1 → 80×10,10,10 @2 → 80×10,10,10 @2/.test(pd.text) && /DODAJ 2,5 KG/.test(pd.text) && /w planie: 80 kg/.test(pd.text), pd && pd.text);
  ok('B: one-click proposal to set 82,5 kg in the plan', pd && /Ustaw w planie: 82,5 kg/.test(pd.btn), pd && pd.btn);
  const planBefore = await page.evaluate(() => JSON.stringify(window.__store.get('plans/plB').days));
  ok('nothing changes in the plan before the trainer clicks', /"kg":"80"/.test(planBefore), planBefore);
  await page.click('[data-pd-apply]');
  await page.waitForTimeout(150);
  const applied = await page.evaluate(() => ({ db: window.__store.get('plans/plB').days[0].exercises[0].kg, local: window.PL.find(p => p.id === 'plB').days[0].exercises[0].kg,
    undo: !!document.querySelector('[data-pd-undo]'), done: (document.querySelector('.cp-pd-done') || {}).innerText || '' }));
  ok('apply writes 82.5 kg to the plan (database + screen)', applied.db === '82.5' && applied.local === '82.5' && /80 kg → 82,5 kg/.test(applied.done) && applied.undo, JSON.stringify(applied));
  await page.click('[data-pd-undo]');
  await page.waitForTimeout(150);
  const undone = await page.evaluate(() => ({ db: window.__store.get('plans/plB').days[0].exercises[0].kg, local: window.PL.find(p => p.id === 'plB').days[0].exercises[0].kg }));
  ok('undo restores 80 kg', undone.db === '80' && undone.local === '80', JSON.stringify(undone));
  const conflict = await page.evaluate(async () => {
    const row = window.__store.get('plans/plB'); row.days[0].exercises[0].kg = '85';
    const btn = document.querySelector('[data-pd-apply]');
    await cpApplyPlanKg(btn);
    return { db: window.__store.get('plans/plB').days[0].exercises[0].kg, msg: (btn.closest('[data-pd-status]') || {}).textContent || '', retry: !btn.disabled && btn.isConnected };
  });
  ok('plan edited elsewhere → no overwrite, clear message, button stays', conflict.db === '85' && /zmienił się/.test(conflict.msg) && conflict.retry, JSON.stringify(conflict));
  await page.evaluate(() => { const row = window.__store.get('plans/plB'); row.days[0].exercises[0].kg = '80'; });
  // Ten sam ruch w dwóch dniach z różnym ciężarem + tygodniowe nadpisania: zmienia się tylko wystąpienie z ciężarem z sugestii.
  const multi = await page.evaluate(async () => {
    const days = [
      { day: 'Push', exercises: [{ name: 'Wyciskanie sztangi na ławce płaskiej', sets: '3', reps: '8-10', kg: '80', rir: '2', w1: { kg: '80' }, w2: { kg: '80' } }] },
      { day: 'Push lekki', exercises: [{ name: 'Wyciskanie sztangi na ławce płaskiej', sets: '3', reps: '8-10', kg: '70' }] }];
    const remote = window.__store.get('plans/plB'); remote.days = JSON.parse(JSON.stringify(days)); remote.weekKeys = ['w1', 'w2']; remote.currentWeek = 'w1';
    const local = window.PL.find(p => p.id === 'plB'); local.days = JSON.parse(JSON.stringify(days)); local.weekKeys = ['w1', 'w2']; local.currentWeek = 'w1';
    openClientProfile('cB'); const z = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Zamknij'); if (z) z.click();
    setCPTab('progress');
    const btn = document.querySelector('[data-pd-apply]');
    const label = btn ? btn.innerText : '';
    if (btn) await cpApplyPlanKg(btn);
    const d = window.__store.get('plans/plB').days;
    const after = { label, d0: d[0].exercises[0].kg, w1: d[0].exercises[0].w1.kg, w2: d[0].exercises[0].w2.kg, d1: d[1].exercises[0].kg };
    const undoBtn = document.querySelector('[data-pd-undo]');
    if (undoBtn) await cpApplyPlanKg(undoBtn, true);
    const u = window.__store.get('plans/plB').days;
    after.undo = { d0: u[0].exercises[0].kg, w1: u[0].exercises[0].w1.kg, d1: u[1].exercises[0].kg };
    return after;
  });
  ok('multi-day plan: only the 80 kg day and its current/later week loads change', multi.d0 === '82.5' && multi.w2 === '82.5' && multi.d1 === '70', JSON.stringify(multi));
  ok('multi-day plan: undo restores 80 kg there, 70 kg day untouched', multi.undo.d0 === '80' && multi.undo.w1 === '80' && multi.undo.d1 === '70', JSON.stringify(multi));
  const fromEmpty = await page.evaluate(async () => {
    const days = [{ day: 'Push', exercises: [{ name: 'Wyciskanie sztangi na ławce płaskiej', sets: '3', reps: '8-10', kg: '' }] }];
    for (const p of [window.__store.get('plans/plB'), window.PL.find(x => x.id === 'plB')]) { p.days = JSON.parse(JSON.stringify(days)); delete p.weekKeys; delete p.currentWeek; }
    setCPTab('progress');
    const btn = document.querySelector('[data-pd-apply]'); if (btn) await cpApplyPlanKg(btn);
    const set = window.__store.get('plans/plB').days[0].exercises[0].kg;
    const undoBtn = document.querySelector('[data-pd-undo]'); if (undoBtn) await cpApplyPlanKg(undoBtn, true);
    const back = window.__store.get('plans/plB').days[0].exercises[0].kg;
    for (const p of [window.__store.get('plans/plB'), window.PL.find(x => x.id === 'plB')]) p.days[0].exercises[0].kg = '80';
    return { set, back };
  });
  ok('plan without kg: apply sets it, undo clears it again', fromEmpty.set === '82.5' && fromEmpty.back === '', JSON.stringify(fromEmpty));
  await openProgress('cA');
  await page.waitForTimeout(200);
  const pdA = await page.evaluate(() => [...document.querySelectorAll('.cp-pd-row')].map(r => ({ name: r.dataset.pdEx, btn: (r.querySelector('[data-pd-apply]') || {}).innerText || '' })));
  ok('A: goblet proposal uses the 2 kg step (14 kg)', pdA.some(r => /goblet/i.test(r.name) && /Ustaw w planie: 14 kg/.test(r.btn)), JSON.stringify(pdA));

  // --- Profil klienta: historia i progres widzą treningi
  const prof = await page.evaluate(() => {
    const out = {};
    for (const id of ['cA', 'cB', 'cC']) {
      if (typeof openClientProfile === 'function') openClientProfile(id);
      const hist = typeof exerciseLoadHistory === 'function' ? exerciseLoadHistory(id, id === 'cB' ? 'Wyciskanie sztangi na ławce płaskiej' : id === 'cA' ? 'Przysiad goblet' : 'Wyciskanie landmine', [], { limit: 8 }) : [];
      out[id] = { hist: (hist || []).length, drawer: !!document.querySelector('#cp-drawer.open') };
    }
    return out;
  });
  ok('history per client has 3 entries', prof.cA.hist === 3 && prof.cB.hist === 3 && prof.cC.hist === 3, JSON.stringify(prof));

  // --- Zapis przy braku sieci: sukces dopiero po potwierdzeniu, trening nie ginie
  await page.clock.setFixedTime(new Date('2026-10-01T09:00:00'));
  const offline = await page.evaluate(() => {
    window.__notes = [];
    window.__failNextSessionWrite = true;
    const before = window.SE.length;
    liveClientSetField('cB', 'Bartek Średni', false, 0);
    liveSelectPlan('plB', 0);
    liveSetKg(0, 0, '82.5', 0); liveSetReps(0, 0, '9', 0); liveSetRir(0, 0, '2', 0); liveToggleSet(0, 0, 0);
    liveAskEndSession(0); liveConfirmEnd();
    return new Promise(res => setTimeout(() => res({ notes: window.__notes.slice(), seAdded: window.SE.length - before,
      stored: [...window.__store.keys()].filter(k => k.startsWith('sessions/')).length,
      pending: JSON.parse(localStorage.getItem('pl_live_pending_sessions_v1') || '[]').length }), 300));
  });
  console.log('offline', JSON.stringify(offline));
  ok('offline save: no success message before the database confirms', !offline.notes.some(n => /Sesja zapisana/.test(n)), JSON.stringify(offline.notes));
  ok('offline save: trainer told the workout is kept', offline.notes.some(n => /zachowany na tym urządzeniu/.test(n)), JSON.stringify(offline.notes));
  const pkgOffline = await page.evaluate(() => window.PACKAGES[0].sessionsUsed);
  ok('offline save: package not counted before the workout is saved', pkgOffline === 3, String(pkgOffline));
  ok('offline save: workout queued on the device', offline.pending === 1 && offline.seAdded === 1 && offline.stored === 9, JSON.stringify(offline));
  const back = await page.evaluate(async () => {
    window.__notes = [];
    await window.liveFlushPendingSessions();
    return { stored: [...window.__store.keys()].filter(k => k.startsWith('sessions/')).length,
      pending: JSON.parse(localStorage.getItem('pl_live_pending_sessions_v1') || '[]').length, notes: window.__notes.slice() };
  });
  const pkgBack = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 50)); return { used: window.PACKAGES[0].sessionsUsed, db: (window.__store.get('packages/pkB') || {}).sessionsUsed }; });
  ok('back online: package counted once for the recovered workout', pkgBack.used === 4 && pkgBack.db === 4, JSON.stringify(pkgBack));
  ok('back online: queued workout saved once and queue cleared', back.stored === 10 && back.pending === 0 && back.notes.some(n => /Zapisano 1 trening/.test(n)), JSON.stringify(back));
  // Zgubione potwierdzenie: transakcja zapisała się, ale odpowiedź nie dotarła → ponowienie nie odlicza drugi raz.
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  const lost = await page.evaluate(async () => {
    window.__notes = [];
    const before = (window.__store.get('packages/pkB') || {}).sessionsUsed;
    window.__failNextCommitAfterApply = true;
    liveClientSetField('cB', 'Bartek Średni', false, 0);
    liveSelectPlan('plB', 0);
    liveSetKg(0, 0, '82.5', 0); liveSetReps(0, 0, '10', 0); liveSetRir(0, 0, '2', 0); liveToggleSet(0, 0, 0);
    liveAskEndSession(0); liveConfirmEnd();
    await new Promise(r => setTimeout(r, 100));
    const queued = JSON.parse(localStorage.getItem('pl_live_pending_sessions_v1') || '[]').length;
    await Promise.all([window.liveFlushPendingSessions(), window.liveFlushPendingSessions()]);
    return { before, after: (window.__store.get('packages/pkB') || {}).sessionsUsed, local: window.PACKAGES[0].sessionsUsed, queued,
      left: JSON.parse(localStorage.getItem('pl_live_pending_sessions_v1') || '[]').length };
  });
  ok('lost confirmation: retry charges the package once', lost.after === lost.before + 1 && lost.local === lost.after && lost.queued === 1 && lost.left === 0, JSON.stringify(lost));
  const reload = await page.evaluate(async () => {
    // Inny trener na tym samym urządzeniu nie wysyła cudzych treningów.
    localStorage.setItem('pl_live_pending_sessions_v1', JSON.stringify([{ id: 'foreign-s', trainerId: 'someone-else', clientId: 'x', date: '2026-10-01', exercises: [] }]));
    await window.liveFlushPendingSessions();
    return { foreign: window.__store.has('sessions/foreign-s'), kept: JSON.parse(localStorage.getItem('pl_live_pending_sessions_v1') || '[]').length };
  });
  // --- ETAP 7: raport 4-tygodniowy
  await page.clock.setFixedTime(new Date('2026-10-01T18:00:00'));
  const rep = await page.evaluate(() => {
    const b = window.CL.find(c => c.id === 'cB'); b.createdAt = '2026-08-01T10:00:00';
    window.METRIC_ENTRIES.push(
      { id: 'c1', trainerId: window._uid, clientId: 'cB', groupId: 'mg2', date: '2026-09-02', values: { m2: 90 } },
      { id: 'c2', trainerId: window._uid, clientId: 'cB', groupId: 'mg2', date: '2026-09-29', values: { m2: 87 } });
    const sum = clientReportSummary('cB', '2026-09-04', '2026-10-01');
    const due = (cpOverviewRecs(b) || []).find(r => r.kind === 'report');
    openReportForClient('cB', 28);
    const from = document.getElementById('rep-from').value, to = document.getElementById('rep-to').value;
    generateReport();
    const doc = (document.querySelector('#report-container [data-rep-summary]') || {}).innerText || '';
    return { sum: { training: sum.training.text, regularity: sum.regularity, strength: sum.strength.map(s => s.name + ' ' + s.first + '→' + s.last), circ: sum.circ.map(c => c.label + ' ' + c.delta), mass: sum.mass }, due: due && due.title, from, to, doc };
  });
  await page.waitForTimeout(100);
  const repAfter = await page.evaluate(() => ({ hist: (window.REP_HISTORY || []).filter(r => r.clientId === 'cB').length, due: !!(cpOverviewRecs(window.CL.find(c => c.id === 'cB')) || []).find(r => r.kind === 'report'),
    stored: [...window.__store.keys()].filter(k => k.startsWith('reportHistory/')).length }));
  await page.screenshot({ path: path.join(shotDir, 'journey_B_report.png') });
  console.log('report', JSON.stringify(rep), JSON.stringify(repAfter));
  ok('report: 4-week window preset (28 days)', rep.from === '2026-09-04' && rep.to === '2026-10-01', rep.from + '..' + rep.to);
  ok('report: training done vs plan', rep.sum.training === '4/4 wykonanych' && rep.sum.regularity === 100, JSON.stringify(rep.sum));
  ok('report: strength change from real sets', rep.sum.strength.some(s => /Wyciskanie sztangi na ławce płaskiej 80→82.5/.test(s)), JSON.stringify(rep.sum.strength));
  ok('report: circumference change', rep.sum.circ.includes('talia -3'), JSON.stringify(rep.sum.circ));
  ok('report: document shows the 5-part summary', /Trening[\s\S]*4\/4 wykonanych[\s\S]*Siła[\s\S]*\+2,5 kg[\s\S]*Obwody[\s\S]*talia −3 cm[\s\S]*Regularność[\s\S]*100%/i.test(rep.doc), rep.doc);
  ok('reminder: 4-week report due before, gone after generating', !!rep.due && repAfter.hist === 1 && repAfter.stored === 1 && !repAfter.due, JSON.stringify({ due: rep.due, ...repAfter }));

  ok('pending queue never sends another trainer\'s workout', !reload.foreign && reload.kept === 1, JSON.stringify(reload));

  ok('no page errors during the journey', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll client journey checks passed');
})().catch(e => { console.error(e); process.exit(1); });
