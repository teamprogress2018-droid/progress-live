#!/usr/bin/env node
'use strict';
/**
 * Progress Voice 1.0 (client-voice.js) w prawdziwym ekranie treningu, iPhone 320/390, atrapa syntezy mowy i Firebase:
 * powitanie i pierwsze ćwiczenie po „Rozpocznij trening”, odliczanie 5…1 + „Seria druga z …” po przerwie,
 * mała ikona głośnika (≥ 44 px, nagłówek się mieści), wyciszenie = cisza, ustawienia w Profilu, brak mowy po wyjściu.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-voice';

async function boot(page, opts = {}) {
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((o) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-flow' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    window.__spoken = [];
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: (u) => { window.__spoken.push(u.text); setTimeout(() => { u.onend && u.onend(); }, 30); }, cancel: () => {}, getVoices: () => [] } }); } catch (e) {}
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
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

async function run(browser, W) {
  const ctx = await browser.newContext({ viewport: { width: W, height: W === 320 ? 640 : 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await page.evaluate(() => { localStorage.setItem('pl_pv_v1:c1', JSON.stringify({ freq: 'standard', voice: 'system' })); });
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  await page.waitForTimeout(400);
  let sp = await page.evaluate(() => window.__spoken.slice());
  ok(W + ' px: po starcie — pierwsze ćwiczenie słownie', sp.some((x) => /^Pierwsze ćwiczenie: Wyciskanie hantli\. Trzy serie\. Zaplanowano dziesięć powtórzeń\. Zaplanowane obciążenie: dwadzieścia kilogramów\.$/.test(x)), JSON.stringify(sp));
  const hdr = await page.evaluate(() => { const b = document.querySelector('.cs-ex-top [data-pv-mute]'); const top = document.querySelector('.cs-ex-top'); const r = b && b.getBoundingClientRect();
    return { has: !!b, h: r && r.height, w: r && r.width, fits: top.scrollWidth <= top.clientWidth + 1, label: b && b.getAttribute('aria-label') }; });
  ok(W + ' px: ikona głośnika w nagłówku, ≥ 44 px, nagłówek się mieści', hdr.has && hdr.h >= 44 && hdr.w >= 44 && hdr.fits && /Wycisz asystenta/.test(hdr.label), JSON.stringify(hdr));

  // Zapis serii → przerwa → odliczanie → „Seria druga z trzech.”
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.waitForTimeout(750);
  await page.click('.cs-ex-foot [data-cs-primary="save"]');
  await page.waitForTimeout(150);
  const restHdr = await page.evaluate(() => ({ phase: window._cw.phase, mute: !!document.querySelector('.cs-rest-scr [data-pv-mute]') }));
  ok(W + ' px: przerwa z ikoną głośnika', restHdr.phase === 'rest' && restHdr.mute, JSON.stringify(restHdr));
  await page.evaluate(() => { const c = window._cw; c.restEndsAt = Date.now() + 5600; c.restLeft = 6; });
  await page.waitForTimeout(7200);
  sp = await page.evaluate(() => window.__spoken.slice());
  const cd = ['pięć', 'cztery', 'trzy', 'dwa', 'jeden'].every((w) => sp.includes(w));
  ok(W + ' px: odliczanie pięć…jeden', cd, JSON.stringify(sp));
  ok(W + ' px: po przerwie „Seria druga z trzech.” (bez „start”)', sp.includes('Seria druga z trzech.') && !sp.includes('start') && sp.indexOf('Seria druga z trzech.') > sp.indexOf('jeden'), JSON.stringify(sp));
  ok(W + ' px: nic dwa razy', new Set(sp).size === sp.length, JSON.stringify(sp));

  // Wyciszenie
  await page.click('.cs-ex-top [data-pv-mute]');
  const muted = await page.evaluate(() => ({ p: document.querySelector('[data-pv-mute]').getAttribute('aria-pressed'), s: JSON.parse(localStorage.getItem('pl_pv_v1:c1')).enabled }));
  ok(W + ' px: wyciszenie zapamiętane', muted.p === 'true' && muted.s === false, JSON.stringify(muted));
  await page.evaluate(() => { window.__spoken.length = 0; pvEmit('PAIN_REPORTED'); pvEnqueue({ text: 'test' }); });
  ok(W + ' px: wyciszony — cisza', await page.evaluate(() => window.__spoken.length === 0));
  await page.click('.cs-ex-top [data-pv-mute]');

  // Wyjście z treningu → cisza
  await page.evaluate(() => { cwClose(true); window.__spoken.length = 0; pvEnqueue({ text: 'po wyjściu' }); pvEmit('EXERCISE_START', { exIdx: 1, name: 'X', sets: 2 }); });
  ok(W + ' px: po wyjściu z treningu — cisza', await page.evaluate(() => window.__spoken.length === 0));

  // Ustawienia w Profilu
  await page.evaluate(() => setClientLiveScreen('profile'));
  await page.waitForSelector('[data-pv-settings]');
  const set = await page.evaluate(() => { const c = document.querySelector('[data-pv-settings]');
    return { t: c.innerText, sw: c.querySelectorAll('input[type="checkbox"]').length, sel: c.querySelectorAll('select').length, range: !!c.querySelector('input[type="range"]'),
      small: [...c.querySelectorAll('select,button,.pv-row')].filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.outerHTML.slice(0, 60)) }; });
  ok(W + ' px: Profil — Progress Voice: włącznik, głos, styl, częstotliwość, głośność, 5 przełączników, test', /Progress Voice/.test(set.t) && set.sw === 6 && set.sel === 3 && set.range && /Odsłuchaj przykładowy komunikat/.test(set.t) && /Progress Support/.test(set.t) && /Głos Twojego trenera/.test(set.t) && /Standardowa/.test(set.t), JSON.stringify(set));
  ok(W + ' px: cele dotykowe ≥ 44 px', !set.small.length, JSON.stringify(set.small));
  await page.selectOption('[data-pv-set="style"]', 'calm');
  await page.selectOption('[data-pv-set="freq"]', 'extended');
  await page.click('[data-pv-set="motivation"]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pl_pv_v1:c1')));
  ok(W + ' px: ustawienia zapisane dla klienta', saved.style === 'calm' && saved.freq === 'extended' && saved.motivation === false, JSON.stringify(saved));
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.click('.pv-test');
  await page.waitForTimeout(100);
  ok(W + ' px: przykładowy komunikat', await page.evaluate(() => /^Seria druga z czterech\./.test(window.__spoken[0] || '')));
  ok(W + ' px: bez błędów JS', !errors.length, errors.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const W of [320, 390]) await run(browser, W);
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Voice — OK');
})();
