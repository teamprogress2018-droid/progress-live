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
    window.CL = CLIENTS.map(c => ({ id: c.id, trainerId: window._uid, name: c.name, goal: c.goal, level: c.level, status: 'active', notes: c.limits || '' }));
    window.PL = CLIENTS.map(c => ({ id: c.plan, trainerId: window._uid, clientId: c.id, name: 'Plan ' + c.name, goal: c.goal, level: c.level, days: c.days }));
    window.SE = []; window.TASKS = []; window.__store.set('packages/pkB', { id: 'pkB', trainerId: window._uid, clientId: 'cB', title: '10 wejść', payStatus: 'paid', status: 'active', sessions: 10, sessionsUsed: 0 });
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
  ok('pending queue never sends another trainer\'s workout', !reload.foreign && reload.kept === 1, JSON.stringify(reload));

  ok('no page errors during the journey', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll client journey checks passed');
})().catch(e => { console.error(e); process.exit(1); });
