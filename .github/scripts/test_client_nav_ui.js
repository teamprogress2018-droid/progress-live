#!/usr/bin/env node
'use strict';
/** UI (Etap 10 UX): aplikacja klienta — pasek Dzisiaj, Trening, Czat, Postępy, Więcej; plakietka na Czacie;
 *  safe area; tekst w rem; pasek „Brak internetu”; karta „Pakiet do opłacenia”. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const css = fs.readFileSync(path.join(__dirname, '..', '..', 'client-simple.css'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

ok('client-simple.css: no px font sizes', !/font-size:\s*\d+(\.\d+)?px/.test(css) && !/font:[^;]*\d+px/.test(css));
ok('client-simple.css: nav respects safe area', /\.clive-nav \{[^}]*padding-bottom: max\(8px, var\(--cs-sab\)\)/.test(css) && /\.clive-nav \{[^}]*var\(--cs-sal\)/.test(css));

async function open(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-nav', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate((o) => {
    window._uid = 'cn-client'; window._trainerId = 'cn-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-nav' };
    window.persistById = async (_c, x) => x; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cn-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cn-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: todayYmd(),
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [{ name: 'Przysiad goblet', sets: '3', reps: '10', kg: '20', rest: '90s' }] }] }];
    window.SE = []; window.TASKS = []; window.MSGS = { c1: [] };
    window.PACKAGES = o.unpaid ? [{ id: 'pk1', clientId: 'c1', trainerId: 'cn-trainer', title: '8 treningów', price: 960, payStatus: 'pending', status: 'active', paymentRequestedAt: new Date().toISOString() }] : [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, payments: { bankAccount: '12 3456 7890 1234 5678 9012 3456', currency: 'zł' } };
    if (o.unread) window.clientHasUnreadFromTrainer = () => true;
    enterClientLiveShell();
  }, opts || {});
  await page.waitForSelector('.cs-today');
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  try {
    let { ctx, page } = await open(browser, { unread: true });
    const nav = await page.evaluate(() => [...document.querySelectorAll('#clive-nav .clive-nav-btn')].map((b) => b.children[1].textContent.trim()));
    ok('bottom nav: Dzisiaj, Trening, Czat, Postępy, Więcej', JSON.stringify(nav) === JSON.stringify(['Dzisiaj', 'Trening', 'Czat', 'Postępy', 'Więcej']), JSON.stringify(nav));
    const badge = await page.evaluate(() => {
      const chat = document.querySelector('#clive-bn-messages .clive-nav-badge');
      const more = document.querySelector('#clive-bn-more .clive-nav-badge');
      return { chat: !!chat && getComputedStyle(chat).display !== 'none', sr: chat ? chat.textContent.trim() : '', more: !!more && getComputedStyle(more).display !== 'none' };
    });
    ok('unread badge on Czat (with text for screen readers), not on Więcej', badge.chat && badge.sr === ', nowe' && !badge.more, JSON.stringify(badge));
    const sizes = await page.$$eval('#clive-nav .clive-nav-btn', (els) => els.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]));
    ok('nav buttons ≥44×44', sizes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(sizes));
    await page.click('#clive-bn-more');
    const sheet = await page.evaluate(() => [...document.querySelectorAll('#clive-more-sheet .clive-nav-btn')].map((b) => b.innerText.trim()));
    ok('Plan moved to Więcej', sheet[0] === 'Plan' && !sheet.includes('Czat'), JSON.stringify(sheet));
    await page.click('#clive-more-sheet #clive-bn-plan');
    ok('Plan opens from Więcej', await page.evaluate(() => window._clientLiveScreen === 'plan'));
    await page.click('#clive-bn-messages');
    ok('Czat opens from bar', await page.evaluate(() => window._clientLiveScreen === 'messages'));

    // Safe area (symulacja wycięcia i paska gestów)
    await page.evaluate(() => { const r = document.documentElement.style; r.setProperty('--cs-sab', '34px'); r.setProperty('--cs-sal', '20px'); r.setProperty('--cs-sar', '20px'); });
    const pad = await page.$eval('#clive-nav', (e) => { const s = getComputedStyle(e); return [s.paddingBottom, s.paddingLeft, s.paddingRight]; });
    ok('nav padding follows safe area', pad[0] === '34px' && pad[1] === '24px' && pad[2] === '24px', JSON.stringify(pad));

    // Brak internetu
    ok('offline bar hidden when online', !(await page.isVisible('#clive-offline')));
    await ctx.setOffline(true);
    await page.waitForTimeout(150);
    ok('offline bar shown without internet', await page.isVisible('#clive-offline') && (await page.textContent('#clive-offline')).includes('Brak internetu'));
    ok('no second (trainer) offline banner in client app', !(await page.isVisible('#net-banner')));
    await ctx.setOffline(false);
    await page.waitForTimeout(150);
    ok('offline bar hides when back online', !(await page.isVisible('#clive-offline')));
    ok('no payment card without unpaid package', await page.evaluate(() => { setClientLiveScreen('home'); return !document.querySelector('.cs-pay'); }));
    await ctx.close();

    ({ ctx, page } = await open(browser, { unpaid: true }));
    const pay = await page.evaluate(() => {
      const card = document.querySelector('.cs-today .cs-pay');
      return card ? { text: card.innerText, primary: card.querySelectorAll('.cs-btn-primary').length, btns: [...card.querySelectorAll('button')].map((b) => b.innerText.trim()),
        allPrimary: document.querySelectorAll('.cs-today .cs-btn-primary').length } : null;
    });
    ok('payment card on Dzisiaj', !!pay && /Pakiet do opłacenia/.test(pay.text) && /8 treningów/.test(pay.text) && /960 zł/.test(pay.text), pay && pay.text);
    ok('payment buttons secondary, one red action on screen', !!pay && pay.primary === 0 && pay.allPrimary === 1 && pay.btns.includes('Zapłaciłem') && pay.btns.includes('Kopiuj przelew') && /12 3456/.test(pay.text), JSON.stringify(pay));
    const more = await page.evaluate(() => { const b = document.querySelector('#clive-bn-more .clive-nav-badge'); return !!b && getComputedStyle(b).display !== 'none'; });
    ok('unpaid package marks Więcej', more);
    await ctx.close();
  } catch (e) {
    console.error('FAIL exception — ' + (e && e.stack || e));
    failed++;
  } finally {
    await browser.close();
  }
  if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
  console.log('\nAll client nav tests passed');
})();
