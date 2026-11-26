#!/usr/bin/env node
'use strict';
/**
 * Progress Academy dla klienta (academy-client.js), iPhone 390 × 844, atrapa Firebase:
 * bez przypisania nic nie widać; z przypisaniem — jedna wskazówka na „Dzisiaj”, lekcja (pytanie, zadanie, „Przerobione”),
 * kolejna wskazówka, karta w „Trener”; karta trenera — zaznaczenie lekcji, własna lekcja, zapis.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-academy';

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
      ...(o.academy ? { academy: { assigned: ['ac_sen', 'ac_rir'] } } : {}), ...(o.noHealth ? { consents: { privacy: { version: '2026-01-01', at: '2026-01-01T00:00:00Z' }, health: { granted: false, at: '2026-01-01T00:00:00Z' } } } : {}) }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 2, 12, 18), ex('Przysiad goblet', 2, 10, 16), ex('Plank', 1, 30, 0)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, opts);
  await page.waitForSelector('.cs-today');
}



(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  ok('bez przypisania: brak wskazówki', !(await page.$('[data-ac-tip]')));
  await boot(page, { academy: true });
  const t = await page.evaluate(() => ({ tips: document.querySelectorAll('.cs-today [data-ac-tip]').length, txt: (document.querySelector('[data-ac-tip]') || {}).innerText || '', primaries: document.querySelectorAll('.cs-today .cs-btn-primary').length }));
  ok('„Dzisiaj”: jedna wskazówka, nadal jedna główna akcja', t.tips === 1 && /Sen a efekty treningu/.test(t.txt) && t.primaries === 1, JSON.stringify(t));
  await page.tap('[data-ac-tip]');
  await page.waitForSelector('#ac-sheet');
  await page.tap('#ac-sheet [data-ac-opt="2"]');
  const q = await page.evaluate(() => ({ fb: document.querySelector('#ac-sheet [data-ac-fb]').innerText, good: document.querySelector('#ac-sheet [data-ac-opt="0"]').classList.contains('is-good'),
    small: [...document.querySelectorAll('#ac-sheet button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.innerText) }));
  ok('pytanie: podpowiedź i poprawna odpowiedź', /^Prawie\./.test(q.fb) && q.good, JSON.stringify(q));
  ok('przyciski ≥ 44 px', !q.small.length, JSON.stringify(q.small));
  await page.tap('#ac-sheet [data-ac-done]');
  await page.waitForTimeout(200);
  const t2 = await page.evaluate(() => ({ sheet: !!document.getElementById('ac-sheet'), txt: (document.querySelector('[data-ac-tip]') || {}).innerText || '' }));
  ok('„Przerobione”: arkusz zamknięty, kolejna wskazówka', !t2.sheet && /Zapas powtórzeń/.test(t2.txt), JSON.stringify(t2));
  await page.evaluate(() => setClientLiveScreen('trainer'));
  await page.waitForSelector('[data-ac-hub]');
  const hub = await page.evaluate(() => document.querySelector('[data-ac-hub]').innerText);
  ok('„Trener”: Academy 1 z 2', /ACADEMY · 1 Z 2 PRZEROBIONYCH/i.test(hub) && /przerobione ✓/.test(hub), hub);

  const card = await page.evaluate(async () => {
    window.CL[0].academy = null;
    const host = document.createElement('div'); host.id = 'cp-body'; host.innerHTML = '<div id="pw-card"></div>'; document.body.appendChild(host);
    window._acEdit = null;
    host.insertAdjacentHTML('beforeend', acTrainerCardHTML(window.CL[0]));
    const out = { view: document.getElementById('ac-card').innerText };
    document.querySelector('#ac-card [data-act="ac-edit"]').click();
    const cb = document.querySelector('#ac-card [data-ac-pick="ac_bialko"]'); cb.checked = true; cb.dispatchEvent(new Event('change'));
    const set = (k, v) => { const el = document.querySelector(`#ac-card [data-ac-new="${k}"]`); el.value = v; };
    set('title', 'Stopy w przysiadzie'); set('text', 'Stopy na szerokość bioder.\n\nKolana nad palcami.'); set('video', 'https://youtu.be/abcdEFG1234'); set('task', 'Zrób 5 przysiadów przed lustrem');
    document.querySelector('#ac-card [data-act="ac-add"]').click();
    out.list = document.getElementById('ac-card').innerText;
    document.querySelector('#ac-card [data-act="ac-save"]').click();
    await new Promise((r) => setTimeout(r, 100));
    out.saved = window.__fs['clients/c1'] && window.__fs['clients/c1'].academy;
    return out;
  });
  ok('trener: bez przypisania — informacja', /Brak przypisanych lekcji/.test(card.view));
  ok('trener: własna lekcja na liście', /Stopy w przysiadzie/.test(card.list));
  const sv = card.saved || {};
  ok('trener: zapis przypisania i własnej lekcji', JSON.stringify(sv.assigned) === '["ac_bialko"]' && sv.custom && sv.custom[0].title === 'Stopy w przysiadzie' && sv.custom[0].video === 'https://youtu.be/abcdEFG1234', JSON.stringify(sv));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Academy (klient) — OK');
})();
