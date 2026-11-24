#!/usr/bin/env node
'use strict';
/** UI: aplikacja klienta — pasek Dzisiaj, Trening, Postępy, Trener (Progress Clean); plakietka na Trenerze; pakiet: ile treningów zostało, bez numeru konta;
 *  safe area; tekst w rem; pasek „Brak internetu”; karta „Pakiet do opłacenia” (także gdy pakiet się skończył);
 *  długie nazwy bez ucinania (bez nowrap) i bez stałej wysokości 150 px. */
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
function rule(sel) { const m = css.match(new RegExp('(^|\\n)' + sel.replace(/[.]/g, '\\.') + ' \\{([^}]*)\\}')); return m ? m[2] : ''; }
['.cs-card-title', '.cs-row-title', '.cs-ex-meta', '.cs-ov-st'].forEach((sel) => ok('client-simple.css: ' + sel + ' wraps (no nowrap/ellipsis/line-clamp)', rule(sel) && !/nowrap|ellipsis|line-clamp/.test(rule(sel)), rule(sel)));
ok('client-simple.css: media button has no fixed 150px height', /min-height: clamp\(/.test(rule('.cs-media-btn')) && !/(^|[^-])height: 150px/.test(rule('.cs-media-btn')), rule('.cs-media-btn'));
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
    if (o.longName) window.PL[0].days[0].muscles = 'Trening całego ciała z naciskiem na stabilizację tułowia i mobilność bioder';
    window.PACKAGES = o.active ? [{ id: 'pk2', clientId: 'c1', trainerId: 'cn-trainer', title: '8 treningów', price: 960, payStatus: 'paid', status: 'active', sessions: 8, sessionsUsed: 3, expiresDate: '2099-12-31' }] : o.ended ? [{ id: 'pk0', clientId: 'c1', trainerId: 'cn-trainer', title: '8 treningów', price: 960, payStatus: 'paid', status: 'active', sessions: 8, sessionsUsed: 8 }] : o.unpaid ? [{ id: 'pk1', clientId: 'c1', trainerId: 'cn-trainer', title: '8 treningów', price: 960, sessions: 8, sessionsUsed: 0, payStatus: 'pending', status: 'active', paymentRequestedAt: new Date().toISOString() }] : [];
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
    ok('bottom nav: Dzisiaj, Trening, Postępy, Trener', JSON.stringify(nav) === JSON.stringify(['Dzisiaj', 'Trening', 'Postępy', 'Trener']), JSON.stringify(nav));
    const badge = await page.evaluate(() => {
      const chat = document.querySelector('#clive-bn-trainer .clive-nav-badge');
      return { chat: !!chat && getComputedStyle(chat).display !== 'none', sr: chat ? chat.textContent.trim() : '', more: !!document.getElementById('clive-bn-more') };
    });
    ok('unread badge on Trener (with text for screen readers), no Więcej', badge.chat && badge.sr === ', nowe' && !badge.more, JSON.stringify(badge));
    const sizes = await page.$$eval('#clive-nav .clive-nav-btn', (els) => els.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]));
    ok('nav buttons ≥44×44', sizes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(sizes));
    await page.click('#clive-bn-trainer');
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-cs-hub-row]')].map((b) => b.dataset.csHubRow));
    ok('Plan and Kontakt on Trener screen', rows.includes('plan') && rows.includes('contact') && !rows.includes('messages'), JSON.stringify(rows));
    await page.click('[data-cs-hub-row="plan"]');
    ok('Plan opens from Trener', await page.evaluate(() => window._clientLiveScreen === 'plan'));
    await page.click('#clive-bn-trainer');
    await page.click('[data-cs-hub-chat] .cs-btn-primary');
    ok('Czat opens from Trener', await page.evaluate(() => window._clientLiveScreen === 'messages'));

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
    ok('payment buttons secondary, one red action on screen', !!pay && pay.primary === 0 && pay.allPrimary === 1 && JSON.stringify(pay.btns) === '["Zapłaciłem"]', JSON.stringify(pay));
    ok('payment card: no bank account / transfer title', !!pay && !/12 3456|Konto|Tytuł przelewu|numeru konta/.test(pay.text), pay && pay.text);
    ok('payment card: trainings left', !!pay && /Zostało\s*8 z 8 treningów/.test(pay.text), pay && pay.text);
    const more = await page.evaluate(() => { const b = document.querySelector('#clive-bn-trainer .clive-nav-badge'); return !!b && getComputedStyle(b).display !== 'none'; });
    ok('unpaid package marks Trener', more);
    await ctx.close();

    ({ ctx, page } = await open(browser, { active: true }));
    const act = await page.evaluate(() => { const card = document.querySelector('.cs-today .cs-pay.is-active'); return card ? { text: card.innerText, btns: card.querySelectorAll('button').length, on: card.querySelectorAll('.cs-pkg-bar span.is-on').length, all: card.querySelectorAll('.cs-pkg-bar span').length } : null; });
    ok('paid package: „Twój pakiet” with trainings left until the end', !!act && /Twój pakiet/.test(act.text) && /Zostało\s*5 z 8 treningów/.test(act.text) && /ważny do 31 grudnia/.test(act.text) && act.on === 5 && act.all === 8 && act.btns === 0, JSON.stringify(act));
    await ctx.close();

    ({ ctx, page } = await open(browser, { ended: true, longName: true }));
    const ended = await page.evaluate(() => {
      const card = document.querySelector('.cs-today .cs-pay.is-ended');
      return card ? { text: card.innerText, primary: card.querySelectorAll('.cs-btn-primary').length, btns: [...card.querySelectorAll('button')].map((b) => b.innerText.trim()),
        allPrimary: document.querySelectorAll('.cs-today .cs-btn-primary').length } : null;
    });
    ok('ended package card on Dzisiaj', !!ended && /Pakiet do opłacenia/.test(ended.text) && /8 treningów/.test(ended.text) && /się skończył/.test(ended.text) && /wykorzystane/.test(ended.text), ended && ended.text);
    ok('ended package: one secondary "Napisz do trenera", one red action on screen', !!ended && ended.primary === 0 && ended.allPrimary === 1 && JSON.stringify(ended.btns) === '["Napisz do trenera"]', JSON.stringify(ended));
    const cut = await page.evaluate(() => [...document.querySelectorAll('.cs-card-title, .cs-row-title')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).whiteSpace === 'nowrap').map((e) => e.textContent));
    ok('long names are not cut off', cut.length === 0, JSON.stringify(cut));
    ok('no horizontal scroll at 390 px', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
    await page.click('.cs-today .cs-pay.is-ended button');
    ok('"Napisz do trenera" opens Czat', await page.evaluate(() => window._clientLiveScreen === 'messages'));
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
