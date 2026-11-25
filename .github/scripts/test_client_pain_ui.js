#!/usr/bin/env node
'use strict';
/**
 * „Zgłoś ból” w trakcie treningu (client-pain.js), iPhone 390 × 844, atrapa Firebase:
 * panel z ostrzeżeniem (112), miejsce i siła bólu wymagane; „Mocno” = bez „kontynuuj”, tylko pomiń / zakończ;
 * zgłoszenie trafia do treningu (cw.issues) i jako wiadomość do trenera (kolejka telefonu, także bez sieci);
 * „Wyślij i pomiń ćwiczenie” pomija ćwiczenie z powodem „Ból”.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-pain';

async function boot(page, opts = {}) {
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((o) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-flow' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    window._vib = []; try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window._vib.push(p); return true; } }); } catch (e) {}
    const fs = {};
    window.__fs = fs; window.__offline = false;
    window._doc = (_db, col, id) => ({ col, id });
    window._getDoc = async (ref) => {
      if (window.__offline) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
      const d = fs[ref.col + '/' + ref.id];
      return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) };
    };
    window.persistById = async (col, obj) => {
      if (window.__offline) return null;
      const c = JSON.parse(JSON.stringify(obj)); delete c._fbId; fs[col + '/' + obj.id] = c; return obj;
    };
    const today = todayYmd(); const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd], injuries: 'Ból barku przy unoszeniu ręki',
      warmup: o.warmup ? { items: [{ name: 'Krążenia ramion', dose: '2 × 10' }, { name: 'Mobilizacja bioder', dose: '30 s' }], note: 'Spokojnie, bez bólu' } : null }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 2, 12, 18), ex('Przysiad goblet', 2, 10, 16), ex('Plank', 1, 30, 0)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, opts);
  await page.waitForSelector('.cs-today');
}
const inner = (page) => page.evaluate(() => document.getElementById('clive-player-inner').innerText);
async function saveSet(page) {
  await page.evaluate(() => { if (window._cw.phase === 'rest') cwSkipRest(); });
  await page.waitForTimeout(720);
  await page.click('.cs-ex-foot [data-cs-primary="save"]');
  await page.waitForTimeout(80);
  await page.evaluate(() => { if (window._cwRestTimer) { clearInterval(window._cwRestTimer); window._cwRestTimer = null; } if (window._cw.phase === 'rest') cwSkipRest(); });
}


(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  await page.evaluate(() => cwReportProblem());
  await page.waitForSelector('#cs-pain');
  const t = await page.innerText('#cs-pain');
  ok('panel: ćwiczenie, ostrzeżenie z 112, prywatność', /Wyciskanie hantli/.test(t) && /112/.test(t) && /tylko Twój trener/.test(t), t);
  ok('bez prompt(): panel w aplikacji', !(await page.evaluate(() => window.__prompted)));

  await page.tap('#cs-pain [data-pain-send="skip"]');
  ok('bez miejsca bólu: komunikat, nic nie wysłane', /Zaznacz, gdzie boli/.test(await page.innerText('#cs-pain-err')) && await page.evaluate(() => csOutboxRead().length === 0 && !(window._cw.issues || []).length));
  await page.tap('#cs-pain [data-pain-area="bark"]');
  await page.tap('#cs-pain [data-pain-send="skip"]');
  ok('bez siły bólu: komunikat', /jak mocno/.test(await page.innerText('#cs-pain-err')));
  await page.tap('#cs-pain [data-pain-level="silny"]');
  const strong = await page.evaluate(() => ({ t: document.getElementById('cs-pain').innerText, cont: !!document.querySelector('#cs-pain [data-pain-send="continue"]'), fin: !!document.querySelector('#cs-pain [data-pain-send="finish"]'), area: document.querySelector('[data-pain-area="bark"]').getAttribute('aria-pressed') }));
  ok('„Mocno”: nie kontynuuj, jest „zakończ trening”, wybór miejsca zachowany', /nie kontynuuj/.test(strong.t) && !strong.cont && strong.fin && strong.area === 'true', JSON.stringify(strong));
  const sizes = await page.evaluate(() => [...document.querySelectorAll('#cs-pain button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.innerText));
  ok('przyciski ≥ 44 px', !sizes.length, JSON.stringify(sizes));

  await page.tap('#cs-pain [data-pain-level="sredni"]');
  await page.fill('#cs-pain-note', 'przy opuszczaniu');
  await page.tap('#cs-pain [data-pain-send="skip"]');
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const cw = window._cw; const msgs = Object.entries(window.__fs).filter(([k]) => k.startsWith('messages/')).map(([, v]) => v);
    return { issue: cw.issues && cw.issues[0], skipped: cw.exercises[0].skipped, reason: cw.exercises[0].skipReason, idx: cw.exIdx, msgs, sheet: !!document.getElementById('cs-pain'), notes: window._notes }; });
  ok('zgłoszenie zapisane w treningu (miejsce, siła, opis, decyzja)', r.issue && r.issue.area === 'bark' && r.issue.level === 'sredni' && r.issue.note === 'przy opuszczaniu' && r.issue.decision === 'skip' && r.issue.exerciseName === 'Wyciskanie hantli', JSON.stringify(r.issue));
  ok('ćwiczenie pominięte z powodem „Ból”, przejście dalej', r.skipped === true && r.reason === 'Ból' && r.idx === 1 && !r.sheet, JSON.stringify(r));
  const m = r.msgs[0] || {};
  ok('wiadomość do trenera w czacie', r.msgs.length === 1 && /^Zgłoszenie bólu: Bark · średnio \(4–6\)/.test(m.text) && /Ćwiczenie: Wyciskanie hantli/.test(m.text) && /Opis: przy opuszczaniu/.test(m.text) && /pominąłem/.test(m.text) && m.out === false && /^msg_pain_/.test(m.id), JSON.stringify(m));
  ok('klient dostaje potwierdzenie', r.notes.some((x) => /Trener dostał zgłoszenie/.test(x)), JSON.stringify(r.notes));

  // Bez sieci: zgłoszenie czeka w telefonie, a trening idzie dalej.
  await page.evaluate(() => { window.__offline = true; try { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); } catch (e) {} });
  await page.evaluate(() => cwReportProblem());
  await page.tap('#cs-pain [data-pain-area="kolano"]');
  await page.tap('#cs-pain [data-pain-level="lekki"]');
  await page.tap('#cs-pain [data-pain-send="continue"]');
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => ({ out: csOutboxRead().map((x) => x.text), issues: window._cw.issues.length, skipped: !!window._cw.exercises[1].skipped, notes: window._notes.slice(-1)[0] }));
  ok('bez sieci: zgłoszenie w kolejce telefonu, ćwiczenie nie pominięte', off.out.length === 1 && /Kolano · lekko/.test(off.out[0]) && /kontynuuję ostrożnie/.test(off.out[0]) && off.issues === 2 && !off.skipped && /gdy wróci internet/.test(off.notes), JSON.stringify(off));
  await page.evaluate(async () => { window.__offline = false; try { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); } catch (e) {} await csOutboxFlush(); });
  const back = await page.evaluate(() => ({ out: csOutboxRead().length, msgs: Object.keys(window.__fs).filter((k) => k.startsWith('messages/')).length }));
  ok('po powrocie sieci: wysłane, kolejka pusta', back.out === 0 && back.msgs === 2, JSON.stringify(back));

  // Escape zamyka panel bez wysyłania.
  await page.evaluate(() => cwReportProblem());
  await page.keyboard.press('Escape');
  ok('Escape zamyka panel', !(await page.$('#cs-pain')));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Zgłoś ból — OK');
})();
