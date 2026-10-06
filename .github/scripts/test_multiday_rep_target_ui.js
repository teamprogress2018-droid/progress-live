// To samo ćwiczenie w kilku dniach planu z różnymi zakresami: analiza bierze zakres z dnia ostatniego treningu.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.clock.setFixedTime(new Date('2026-10-06T09:00:00'));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof composeClientNextSessionBrief === 'function' && typeof progressRecOptsForItem === 'function');
  const out = await page.evaluate(() => {
    window._uid = 'md-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window._db = { fixture: 1 };
    const T = window._uid;
    window.CL = [{ id: 'm', trainerId: T, name: 'Marek Multi', status: 'active' }];
    window.PL = [{ id: 'pm', trainerId: T, clientId: 'm', name: 'FBW', days: [
      { day: 'A', exercises: [{ name: 'Przysiad', sets: '3', reps: '8-12', kg: '80' }] },
      { day: 'B', exercises: [{ name: 'Przysiad', sets: '3', reps: '3-5', kg: '100' }] }] }];
    const sess = (id, date, dayIdx, kg, reps) => ({ id, trainerId: T, clientId: 'm', date, source: 'live', planId: 'pm', dayIdx, createdAt: date + 'T10:00:00',
      exercises: [{ name: 'Przysiad', sets: [1, 2, 3].map(() => ({ kg: String(kg), reps: String(reps), rir: '2', kind: 'work', done: true })) }] });
    const run = list => {
      window.SE = list; window._cpExerciseProgress = null;
      const b = composeClientNextSessionBrief('m');
      const it = b.pack.items[0];
      const o = progressRecOptsForItem(it, { planId: 'pm' });
      const kgs = ((it.series && it.series.snapshots) || []).map(s => s.topSet && s.topSet.kg);
      return { repMax: o && o.target && o.target.repMax, action: b.recs[0] && b.recs[0].action, kgs, day: it.planDayIdx };
    };
    // Ostatnio dzień B (3-5): 5 powt. = górna granica → dodaj ciężar.
    const heavy = run([sess('s1', '2026-09-28', 0, 80, 10), sess('s2', '2026-10-01', 1, 100, 5), sess('s3', '2026-10-03', 0, 80, 11), sess('s4', '2026-10-05', 1, 100, 5)]);
    // Ostatnio dzień A (8-12): zakres 12.
    const light = run([sess('s1', '2026-09-28', 1, 100, 5), sess('s2', '2026-10-05', 0, 80, 10)]);
    // Tylko dzień B: profil nie każe dokładać powtórzeń ponad 5 i mówi to samo co Live dnia B.
    const onlyB = run([sess('s1', '2026-10-01', 1, 100, 5), sess('s2', '2026-10-05', 1, 100, 5)]);
    window._cpExerciseProgress = null;
    const liveB = composeClientNextSessionBrief('m', { planId: 'pm', dayIdx: 1 }).recs[0];
    onlyB.live = liveB && liveB.action;
    // Brak dayIdx w sesji → bez zgadywania.
    const unknown = run([Object.assign(sess('s1', '2026-10-05', 1, 100, 5), { dayIdx: undefined })]);
    // Live z wybranym dniem nadal wygrywa.
    window.SE = [sess('s2', '2026-10-05', 0, 80, 10)]; window._cpExerciseProgress = null;
    const b = composeClientNextSessionBrief('m', { planId: 'pm', dayIdx: 1 });
    const liveDay = (progressRecOptsForItem(b.pack.items[0], { planId: 'pm', dayIdx: 1 }) || {}).target;
    return { heavy, onlyB, light, unknown, liveDay: liveDay && liveDay.repMax };
  });
  console.log(JSON.stringify(out));
  ok('last workout on heavy day B → target 5 reps', out.heavy.repMax === 5, JSON.stringify(out.heavy));
  ok('mixed heavy/light history: only heavy-day sessions compared', JSON.stringify(out.heavy.kgs) === '[100,100]' && out.heavy.day === 1, JSON.stringify(out.heavy));
  ok('mixed history gives the same call as heavy-day-only history (no false „OBSERWUJ”)', out.heavy.action === out.onlyB.action && out.heavy.action !== 'OBSERWUJ', JSON.stringify([out.heavy.action, out.onlyB.action]));
  ok('light day last → only light-day sessions', JSON.stringify(out.light.kgs) === '[80]', JSON.stringify(out.light));
  ok('heavy day only: no „add reps” above 5, same as Live day B', out.onlyB.repMax === 5 && !/POWT/i.test(out.onlyB.action || '') && out.onlyB.action === out.onlyB.live, JSON.stringify(out.onlyB));
  ok('last workout on day A → target 12 reps', out.light.repMax === 12, JSON.stringify(out.light));
  ok('session without day: no guessed target', out.unknown.repMax == null, JSON.stringify(out.unknown));
  ok('explicit Live day still decides', out.liveDay === 5, String(out.liveDay));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll multi-day rep target checks passed');
})().catch(e => { console.error(e); process.exit(1); });
