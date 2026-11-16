// Trening Live: podgląd pod nazwą ćwiczenia = 5 ostatnich treningów (też z innych planów), wiersz na trening.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof liveExPopupHistory === 'function' && typeof exerciseLoadHistory === 'function');
  const r = await page.evaluate(() => {
    window.CL = [{ id: 'c1', name: 'Piotr' }];
    const mk = (i, plan, kg) => ({ id: 's' + i, clientId: 'c1', date: '2026-10-' + String(10 + i).padStart(2, '0'), source: 'live', status: 'done', planId: plan,
      exercises: [{ name: 'Rozpiętki na maszynie (Pec Deck)', sets: [{ kg, reps: 10, done: true }, { kg, reps: 10, done: true }] }] });
    window.SE = [mk(1, 'p1', 40), mk(2, 'p2', 42.5), mk(3, 'p1', 45), mk(4, 'p2', 45), mk(5, 'p1', 47.5), mk(6, 'p1', 50), mk(7, 'p2', 50)];
    const planOnly = exerciseLoadHistory('c1', 'Rozpiętki na maszynie (Pec Deck)', [], { limit: 8, planId: 'p1' });
    const pop = liveExPopupHistory({ name: 'Rozpiętki na maszynie (Pec Deck)' }, 'c1', planOnly);
    const html = liveExHistCompactHtml(pop);
    const div = document.createElement('div'); div.innerHTML = html;
    return { planOnly: planOnly.length, n: pop.length, dates: pop.map(h => h.date), rows: div.querySelectorAll('tbody tr').length, first: div.querySelector('tbody tr').textContent.replace(/\s+/g, ' ').trim() };
  });
  ok('5 ostatnich treningów, najnowszy pierwszy', r.n === 5 && r.dates[0] === '2026-10-17' && r.dates[4] === '2026-10-13', JSON.stringify(r.dates));
  ok('także z innych planów (plan bieżący ma ' + r.planOnly + ')', r.planOnly < r.n && r.dates.includes('2026-10-14'), JSON.stringify(r));
  ok('jeden wiersz na trening z seriami i objętością', r.rows === 5 && /17\.10\.26/.test(r.first) && /50 × 10 · 50 × 10/.test(r.first) && /1000 kg/.test(r.first), r.first);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll live last-5 history checks passed');
})().catch(e => { console.error(e); process.exit(1); });
