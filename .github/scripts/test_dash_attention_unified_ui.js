// Pulpit = to samo źródło spraw co ekran „Klienci”: ta sama liczba, czerwień tylko dla pilnych,
// osoba z „Najważniejsze teraz” nie powtarza się na liście, długi opis partii schowany w „Szczegóły”.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    window.persistById = async (_c, o) => o; window.notify = () => {};
    ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
    window._uid = 'u1';
    const ymd = todayYmd();
    const add = n => { const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); return dateStrLocal(d); };
    const names = ['Adam Znamiec', 'Krzysztof Wałęsa', 'Tomasz Owsiany', 'Ewa Nowak', 'Marta Kowal', 'Jan Lis'];
    window.CL = names.map((n, i) => ({ id: 'c' + i, name: n, status: 'active', email: 'k' + i + '@x.pl' }));
    window.PL = [0, 1, 2, 3].map(i => ({ id: 'pl' + i, clientId: 'c' + i, name: 'Plan', days: [{ day: 'Dzień 3' }] }));
    window.CHECKINS = { c0: [{ id: 'ci0', status: 'pending', date: add(-63), sentAt: add(-63) + 'T10:00:00' }] };
    window.SE = [{ id: 's1', clientId: 'c1', date: ymd, time: '23:30', duration: 60, source: 'planned',
      type: 'Dzień 3 · Legs (nogi na maszynach) — Nogi: czworogłowe, tył uda, pośladki' }];
    if (typeof invalidateOpsEventsCache === 'function') invalidateOpsEventsCache();
    goTo('dashboard');
    if (typeof renderDashOps === 'function') renderDashOps();
    if (typeof renderDashToday === 'function') renderDashToday();
    const need = CL.filter(c => clientNeedsAction(clientIssues(c))).length;
    const people = dashAttentionPeople();
    const next = dashNextAction();
    const rows = [...document.querySelectorAll('#d-ops-attention .dash-att-row')].map(el => ({ id: el.dataset.dashAtt, cls: el.className }));
    const all = document.querySelector('[data-dash-att-all]');
    const meta = (document.querySelector('#d-today-sessions .dash-today-meta') || {}).textContent || '';
    const parts = (document.querySelector('#d-today-sessions [data-dash-parts]') || {}).textContent || '';
    return { need, n: people.length, next, rows, all: all ? all.dataset.dashAttAll : null, meta, parts,
      reportIssue: clientIssues(CL[0]).map(i => i.key) };
  });
  ok('zaległy raport jest sprawą na ekranie Klienci', r.reportIssue.includes('report'), r.reportIssue.join());
  ok('pulpit liczy tyle samo osób co „Wymaga uwagi” w Klientach', r.n === r.need && r.need > 0, r.n + ' vs ' + r.need);
  ok('najważniejsze teraz = zaległy raport, ton pomarańczowy (nie czerwony)', /Adam Znamiec — raport zaległy/.test(r.next.title) && r.next.tone === 'watch' && r.next.clientId === 'c0', JSON.stringify(r.next));
  ok('osoba z „Najważniejsze teraz” nie powtarza się na liście', r.rows.length && !r.rows.some(x => x.id === 'c0'), JSON.stringify(r.rows));
  ok('bez czerwonych kropek, gdy nic nie jest pilne', !r.rows.some(x => /dash-att-urgent/.test(x.cls)), JSON.stringify(r.rows));
  ok('„Zobacz wszystkich” pokazuje pełną liczbę', r.all === String(r.need), r.all);
  ok('nazwa treningu bez opisu partii', /^Dzień 3 · Legs \(nogi na maszynach\) · 60 min$/.test(r.meta.trim()), r.meta);
  ok('opis partii w „Szczegóły”', /Nogi: czworogłowe/.test(r.parts), r.parts);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll dash attention unified checks passed');
})().catch(e => { console.error(e); process.exit(1); });
