#!/usr/bin/env node
'use strict';
/** UI: ekran „Dzisiaj” klienta — kafelek „Spotkanie z trenerem” (termin z kalendarza, bez nazwy dnia i mięśni),
 *  kolejność: trening → spotkanie → pakiet do opłacenia → tydzień; brak pustej karty; nie wchodzi pod dolny pasek. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=meet-card', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate((o) => {
    window._uid = 'mc-client'; window._trainerId = 'mc-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'meet-card' };
    window.persistById = async (_c, x) => x; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const wd = new Date().getDay();
    const ymd = (add) => { const d = new Date(); d.setDate(d.getDate() + add); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
    window.CL = [{ id: 'c1', trainerId: 'mc-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'mc-trainer', name: 'Plan', weekKeys: ['w1'], currentWeek: 'w1', startDate: todayYmd(),
      days: [{ day: 'Push + Legs', muscles: 'barki, klatka, czworogłowe', exercises: [{ name: 'Wyciskanie hantli', sets: '3', reps: '10', kg: '8', rest: '90s' }] }] }];
    const base = { clientId: 'c1', trainerId: 'mc-trainer', type: 'Push + Legs — barki, klatka, czworogłowe', notes: 'Z planu: Plan · barki', duration: 60, source: 'planned', planId: 'p1', dayIdx: 0 };
    window.SE = (o.meetings || []).map((m, i) => Object.assign({ id: 's' + i }, base, { date: ymd(m.day), time: m.time, status: m.status }, m.duration ? { duration: m.duration } : {}));
    window.TASKS = []; window.MSGS = { c1: [] };
    window.PACKAGES = o.unpaid ? [{ id: 'pk1', clientId: 'c1', trainerId: 'mc-trainer', title: '8 treningów', price: 960, payStatus: 'pending', status: 'active', paymentRequestedAt: new Date().toISOString() }] : [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, payments: { bankAccount: '12 3456 7890 1234 5678 9012 3456', currency: 'zł' } };
    enterClientLiveShell();
  }, o);
  await page.waitForSelector('.cs-today');
  return { ctx, page };
}
const info = (page) => page.evaluate(() => {
  const m = document.querySelector('.cs-today .cs-meet');
  const kids = [...document.querySelector('.cs-today').children].map((e) => e.classList.contains('cs-meet') ? 'meet' : e.classList.contains('cs-pay') ? 'pay' : e.classList.contains('cs-week') ? 'week' : e.classList.contains('cs-card') ? 'train' : e.tagName.toLowerCase());
  return { has: !!m, text: m ? m.innerText.replace(/\s+/g, ' ').trim() : '', title: m && m.querySelector('h2') ? m.querySelector('h2').textContent : '',
    icon: !!(m && m.querySelector('svg')), order: kids, notes: document.querySelectorAll('.cs-today .cs-note').length, todayText: document.querySelector('.cs-today').innerText };
});

(async () => {
  const browser = await chromium.launch();
  try {
    // Spotkanie dziś (23:59 — nie kończy się przed północą) + pakiet do opłacenia
    let { ctx, page } = await open(browser, { unpaid: true, meetings: [{ day: 0, time: '23:59' }] });
    let r = await info(page);
    ok('meeting card shown with title', r.has && r.title === 'Spotkanie z trenerem', JSON.stringify(r.text));
    ok('meeting card has calendar icon', r.icon);
    ok('today meeting reads „Dzisiaj · HH:MM”', /Dzisiaj · \d{1,2}:\d{2}$/.test(r.text.replace('Spotkanie z trenerem ', '')), r.text);
    ok('meeting card without day name / muscles', !/Push|Legs|barki|klatka|ćwicze/i.test(r.text), r.text);
    ok('order: training → meeting → pay → week', JSON.stringify(r.order.filter((x) => x !== 'header')) === JSON.stringify(['train', 'meet', 'pay', 'week']), JSON.stringify(r.order));
    ok('old meeting line under payment removed', r.notes === 0 && (r.todayText.match(/Spotkanie z trenerem/g) || []).length === 1);
    const box = await page.$eval('.cs-meet', (e) => { const s = getComputedStyle(e); return { h: e.getBoundingClientRect().height, bg: s.backgroundColor, rad: parseFloat(s.borderTopLeftRadius), sh: s.boxShadow }; });
    ok('meeting card short (<110 px), white, rounded, shadow', box.h < 110 && box.rad >= 16 && box.sh !== 'none', JSON.stringify(box));
    const train = await page.$eval('.cs-today .cs-card', (e) => getComputedStyle(e).backgroundColor);
    ok('meeting card background matches other cards', box.bg === train, box.bg + ' vs ' + train);
    await ctx.close();

    // Jutro + telefon 360: po przewinięciu kafelek nie wchodzi pod dolny pasek
    ({ ctx, page } = await open(browser, { w: 360, h: 640, unpaid: true, meetings: [{ day: 1, time: '07:30' }] }));
    r = await info(page);
    ok('tomorrow meeting reads „Jutro · 7:30”', /Jutro · 7:30$/.test(r.text), r.text);
    await page.$eval('.cs-meet', (e) => e.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(100);
    const clash = await page.evaluate(() => { const m = document.querySelector('.cs-meet').getBoundingClientRect(); const n = document.querySelector('#clive-nav').getBoundingClientRect(); return { mb: m.bottom, nt: n.top }; });
    ok('meeting card not under bottom nav', clash.mb <= clash.nt + 0.5, JSON.stringify(clash));
    const last = await page.evaluate(() => { const c = document.querySelector('.clive-content'); if (c) c.scrollTop = 1e6; window.scrollTo(0, 1e6); const w = document.querySelector('.cs-today').lastElementChild.getBoundingClientRect(); return { b: w.bottom, nt: document.querySelector('#clive-nav').getBoundingClientRect().top }; });
    ok('last section clears bottom nav', last.b <= last.nt + 0.5, JSON.stringify(last));
    await ctx.close();

    // Dalszy termin: nazwa dnia i data; najbliższy wybrany
    ({ ctx, page } = await open(browser, { meetings: [{ day: 5, time: '18:00' }, { day: 3, time: '9:15' }] }));
    r = await info(page);
    ok('later meeting shows weekday + date, nearest first', /^Spotkanie z trenerem \S+, \d{1,2} \S+ · 9:15$/.test(r.text), r.text);
    await ctx.close();

    // Brak spotkania / odwołane / dzisiejsze już zakończone → brak karty
    for (const [name, meetings] of [['no meeting', []], ['cancelled', [{ day: 1, time: '18:00', status: 'cancelled' }]], ['ended today', [{ day: 0, time: '00:00', duration: 1 }]], ['past day', [{ day: -1, time: '18:00' }]]]) {
      ({ ctx, page } = await open(browser, { unpaid: true, meetings }));
      r = await info(page);
      ok('no empty meeting card: ' + name, !r.has && r.notes === 0 && !/Spotkanie z trenerem/.test(r.todayText), JSON.stringify(r.order));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
  console.log('All meeting card checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
