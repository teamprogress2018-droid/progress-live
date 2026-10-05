// ETAP 9: płatności — zaległości, wykorzystane/kończące się/wygasające pakiety, przypomnienie i odnowienie.
'use strict';
const path = require('path'), os = require('os'), fs = require('fs');
const { chromium } = require('playwright');
const shotDir = path.join(os.tmpdir(), 'pl-pay-actions'); fs.mkdirSync(shotDir, { recursive: true });
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
  await page.waitForFunction(() => typeof payActionItems === 'function' && typeof renderDashOps === 'function');
  const out = await page.evaluate(() => {
    window._uid = 'pay-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window.tenantSessionGeneration = 1; window._db = { fixture: 1 };
    window.__writes = []; window.persistById = async (c, o) => { window.__writes.push({ c, o: JSON.parse(JSON.stringify(o)) }); return o; };
    window.notify = () => {}; window.confirm = () => false; window.__msgs = []; window.pushMsg = (id, m) => window.__msgs.push({ id, m });
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    const T = window._uid;
    window.CL = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, trainerId: T, name: 'Klient ' + id.toUpperCase(), status: 'active' }));
    const pk = (id, clientId, o) => Object.assign({ id, trainerId: T, clientId, clientName: 'Klient ' + clientId.toUpperCase(), title: '10 wejść', type: 'sessions', sessions: 10, sessionsUsed: 3, price: 1500, payStatus: 'paid', status: 'active', date: '2026-09-01', expiresDate: '2026-12-01' }, o);
    window.PACKAGES = [
      pk('p-over', 'a', { payStatus: 'pending', date: '2026-09-24', paymentRequestedAt: '2026-10-01T10:00:00' }),
      pk('p-used', 'b', { sessionsUsed: 10 }),
      pk('p-low', 'c', { sessionsUsed: 9 }),
      pk('p-exp', 'd', { expiresDate: '2026-10-09', date: '2026-07-11' }),
      pk('p-ok', 'e', {}),
      pk('p-fresh', 'f', { payStatus: 'pending', date: '2026-10-05' }),
      pk('p-noprice', 'e', { price: undefined, sessions: 0, sessionsUsed: 0, title: 'Stary pakiet' })];
    window.INVOICES = []; window.SE = []; window.TASKS = []; window.CHECKINS = {}; window.METRIC_ENTRIES = [];
    if (typeof goTo === 'function') goTo('dashboard');
    if (typeof invalidateOpsEventsCache === 'function') invalidateOpsEventsCache();
    renderDashOps();
    if (typeof toggleDashListExpand === 'function' && document.querySelector('#d-ops-expiring .dash-list-more')) toggleDashListExpand('dash-expiring');
    const dash = [...document.querySelectorAll('#d-ops-expiring [data-pay-action]')].map(r => ({ kind: r.dataset.payAction, text: r.innerText.replace(/\s+/g, ' ') }));
    goTo('payments'); if (typeof setPayTab === 'function') try { setPayTab('overview'); } catch (e) {}
    let overviewErr = '';
    try { renderPayOverview(); renderPayPackages(); } catch (e) { overviewErr = String(e && e.message); }
    const pay = [...document.querySelectorAll('#pay-alerts-list [data-pay-action]')].map(r => ({ kind: r.dataset.payAction, id: r.dataset.pkgId, text: r.innerText.replace(/\s+/g, ' ') }));
    const ovA = (cpOverviewRecs(window.CL[0], { all: true }) || []).find(r => r.kind === 'payment');
    return { dash, pay, overviewErr, ovA: ovA && ovA.title };
  });
  console.log(JSON.stringify(out).slice(0, 2000));
  ok('dashboard: overdue first, then used up, low, expiring — each package once', out.dash.map(d => d.kind).join() === 'overdue,usedup,low,expiring', JSON.stringify(out.dash.map(d => d.kind)));
  ok('overdue shows days and last request', /Zaległość 12 dni/.test(out.dash[0].text) && /prośba wysłana 5 dni temu/.test(out.dash[0].text), out.dash[0].text);
  ok('fresh unpaid package is not an overdue alarm', !out.dash.some(d => /Klient F/.test(d.text)), JSON.stringify(out.dash));
  ok('payments screen renders with a package without price', !out.overviewErr, out.overviewErr);
  ok('payments alerts: same order + fresh unpaid listed last as „Do zapłaty”', out.pay.map(p => p.kind).join() === 'overdue,usedup,low,expiring,pending', JSON.stringify(out.pay.map(p => p.kind)));
  ok('client overview flags the overdue payment', /Zaległa płatność — zaległość 12 dni/.test(out.ovA || ''), out.ovA);

  const remind = await page.evaluate(async () => {
    window.__writes = []; window.__msgs = [];
    document.querySelector('#pay-alerts-list [data-pay-remind="p-over"]').click();
    await new Promise(r => setTimeout(r, 50));
    const w = window.__writes.find(x => x.c === 'packages');
    const btn = document.querySelector('#pay-alerts-list [data-pkg-id="p-over"] button');
    return { msg: window.__msgs.length, keys: w ? Object.keys(w.o).sort() : [], btn: btn ? btn.innerText + (btn.disabled ? ':disabled' : '') : '', text: (document.querySelector('#pay-alerts-list [data-pkg-id="p-over"]') || {}).innerText || '' };
  });
  ok('Przypomnij: message to client, only paymentRequestedAt written', remind.msg === 1 && remind.keys.includes('paymentRequestedAt') && !remind.keys.includes('payStatus'), JSON.stringify(remind));
  ok('after reminding: „prośba wysłana dziś”, button disabled (no spam)', /prośba wysłana dziś/.test(remind.text) && /Przypomniano:disabled/.test(remind.btn), JSON.stringify(remind));

  const renew = await page.evaluate(() => {
    document.querySelector('#pay-alerts-list [data-pay-renew="p-exp"]').click();
    const v = id => (document.getElementById(id) || {}).value;
    const modal = document.getElementById('m-package');
    const bar = document.getElementById('pkg-onboard-banner');
    return { open: !!(modal && (modal.classList.contains('show') || modal.classList.contains('open') || getComputedStyle(modal).display !== 'none')),
      client: v('pkg-client'), title: v('pkg-title'), sessions: v('pkg-sessions'), price: v('pkg-price'), validity: v('pkg-validity'), date: v('pkg-date'), pay: v('pkg-pay-status'),
      banner: bar ? bar.style.display : '', onboard: window._onboardResumeAfterPackage };
  });
  await page.screenshot({ path: path.join(shotDir, 'pay_renew.png') });
  ok('Odnów: new package form prefilled from the old one', renew.open && renew.client === 'd' && renew.title === '10 wejść' && renew.sessions === '10' && renew.price === '1500' && renew.validity === '90' && renew.date === '2026-10-06' && renew.pay === 'pending', JSON.stringify(renew));
  const draft = await page.evaluate(() => {
    if (typeof closeM === 'function') closeM('m-package');
    packageSaveDrafts.set('b', { values: { client: 'b', title: 'Niedokończony', sessions: '8' }, client: { id: 'b' } });
    document.getElementById('pkg-title').value = 'X';
    payRenewPackage('p-used');
    const t = document.getElementById('pkg-title').value; packageSaveDrafts.delete('b');
    const bar = document.getElementById('pkg-onboard-banner');
    return t + '|' + (bar ? bar.style.display : '');
  });
  ok('Odnów keeps an unfinished package save for that client, no onboarding banner', !draft.startsWith('10 wejść|') && draft.endsWith('|none'), draft);
  ok('Odnów: no onboarding banner or resume', renew.banner === 'none' && !renew.onboard, JSON.stringify(renew));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll payment action checks passed');
})().catch(e => { console.error(e); process.exit(1); });
