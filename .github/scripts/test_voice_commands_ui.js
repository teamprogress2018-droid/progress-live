#!/usr/bin/env node
'use strict';
/**
 * Komendy głosowe (voice-commands.js) w prawdziwym ekranie treningu, iPhone 320/390, atrapa rozpoznawania mowy i Firebase:
 * domyślnie brak mikrofonu, włączenie w Profilu, mikrofon ≥ 44 px i nagłówek się mieści, „60 kilo 10 powtórzeń zapisz” zapisuje serię
 * i zaczyna przerwę, „pomiń przerwę” wraca do serii, brak zgody na mikrofon = komunikat.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=voice-commands';

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
  await ctx.addInitScript(() => {
    window.__recs = [];
    const R = function () { this.started = false; window.__recs.push(this); };
    R.prototype.start = function () { this.started = true; };
    R.prototype.stop = function () { this.onend && this.onend(); };
    window.webkitSpeechRecognition = R; window.SpeechRecognition = R;
    window.__say = (alts) => { const r = window.__recs[window.__recs.length - 1]; const res = alts.map((t) => ({ transcript: t })); r.onresult && r.onresult({ results: [res] }); r.onend && r.onend(); };
    window.__fail = (error) => { const r = window.__recs[window.__recs.length - 1]; r.onerror && r.onerror({ error }); r.onend && r.onend(); };
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await page.evaluate(() => { localStorage.setItem('pl_pv_v1:c1', JSON.stringify({ voice: 'system' })); });

  // Domyślnie wyłączone: brak mikrofonu
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  ok(W + ' px: domyślnie brak mikrofonu', await page.evaluate(() => !document.querySelector('[data-vc-mic]')));
  await page.evaluate(() => cwClose(true));

  // Włączenie w Profilu
  await page.evaluate(() => setClientLiveScreen('profile'));
  await page.waitForSelector('[data-vc-settings]');
  const card = await page.evaluate(() => { const c = document.querySelector('[data-vc-settings]'); const t = c.querySelector('[data-vc-toggle]'); const row = t.closest('.pv-row');
    return { t: c.innerText, checked: t.checked, h: row.getBoundingClientRect().height }; });
  ok(W + ' px: Profil — karta „Komendy głosowe”, wyłączona, ≥ 44 px', /Komendy głosowe/.test(card.t) && /nie zapisuje nagrań/.test(card.t) && !card.checked && card.h >= 44, JSON.stringify(card));
  await page.click('[data-vc-toggle]');
  ok(W + ' px: włączenie zapisane na telefonie', await page.evaluate(() => JSON.parse(localStorage.getItem('pl_vc_v1:c1')).on === true));

  // Trening z mikrofonem
  await page.evaluate(() => setClientLiveScreen('today'));
  await page.waitForSelector('.cs-today');
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  const hdr = await page.evaluate(() => { const b = document.querySelector('.cs-ex-top [data-vc-mic]'); const top = document.querySelector('.cs-ex-top'); const r = b && b.getBoundingClientRect();
    return { has: !!b, h: r && r.height, w: r && r.width, fits: top.scrollWidth <= top.clientWidth + 1 }; });
  ok(W + ' px: mikrofon w nagłówku, ≥ 44 px, nagłówek się mieści', hdr.has && hdr.h >= 44 && hdr.w >= 44 && hdr.fits, JSON.stringify(hdr));
  await page.waitForTimeout(750);
  await page.click('.cs-ex-top [data-vc-mic]');
  const lis = await page.evaluate(() => ({ started: window.__recs.length && window.__recs[window.__recs.length - 1].started, lang: window.__recs[window.__recs.length - 1].lang, pressed: document.querySelector('[data-vc-mic]').getAttribute('aria-pressed') }));
  ok(W + ' px: dotknięcie = słuchanie po polsku (aria-pressed)', lis.started && lis.lang === 'pl-PL' && lis.pressed === 'true', JSON.stringify(lis));
  await page.evaluate(() => window.__say(['60 kilo 10 powtórzeń zapisz']));
  await page.waitForTimeout(150);
  const saved = await page.evaluate(() => { const s = window._cw.exercises[0].sets[0]; return { done: !!s.done, kg: String(s.kg), reps: String(s.reps), phase: window._cw.phase, note: window._notes.slice(-1)[0], mic: document.querySelector('[data-vc-mic]') && document.querySelector('[data-vc-mic]').getAttribute('aria-pressed') }; });
  ok(W + ' px: „60 kilo 10 powtórzeń zapisz” zapisuje serię 1 i zaczyna przerwę', saved.done && saved.kg === '60' && saved.reps === '10' && saved.phase === 'rest', JSON.stringify(saved));
  ok(W + ' px: potwierdzenie i mikrofon wyłączony po zdaniu', /Seria 1 zapisana/.test(saved.note) && saved.mic === 'false', JSON.stringify(saved));
  ok(W + ' px: mikrofon także na przerwie', await page.evaluate(() => !!document.querySelector('.cs-rest-scr [data-vc-mic]')));
  await page.click('.cs-rest-scr [data-vc-mic]');
  await page.evaluate(() => window.__say(['pomiń przerwę']));
  await page.waitForTimeout(150);
  ok(W + ' px: „pomiń przerwę” wraca do ćwiczenia', await page.evaluate(() => window._cw.phase === 'exercise'));
  await page.click('.cs-ex-top [data-vc-mic]');
  await page.evaluate(() => window.__fail('not-allowed'));
  ok(W + ' px: brak zgody na mikrofon = jasny komunikat', await page.evaluate(() => /zgody na mikrofon/.test(window._notes.slice(-1)[0] || '')));
  await page.click('.cs-ex-top [data-vc-mic]');
  await page.evaluate(() => window.__say(['która jest godzina']));
  ok(W + ' px: niezrozumiałe zdanie nic nie zmienia', await page.evaluate(() => !window._cw.exercises[0].sets[1].done && /Nie rozpoznano/.test(window._notes.slice(-1)[0] || '')));
  ok(W + ' px: bez błędów JS', !errors.length, errors.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const W of [320, 390]) await run(browser, W);
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Komendy głosowe — OK');
})();
