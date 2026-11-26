#!/usr/bin/env node
'use strict';
/**
 * Progress Express (express.js), iPhone 390 × 844, atrapa Firebase:
 * bez zgody trenera brak linku; z regułą trenera „Mniej czasu?” → 3 warianty z czasem → Express startuje od razu
 * (1 ćwiczenie × 2 serie), wariant w zapisie sesji i w wiadomości dla trenera; karta trenera: włącz, reguła, podgląd, zapis.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-express';

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
      ...(o.express ? { express: { on: true, short: { ex: 2, sets: 0 }, express: { ex: 1, sets: 2 } } } : {}), ...(o.noHealth ? { consents: { privacy: { version: '2026-01-01', at: '2026-01-01T00:00:00Z' }, health: { granted: false, at: '2026-01-01T00:00:00Z' } } } : {}) }];
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
  ok('bez zgody trenera: brak „Mniej czasu?”', !(await page.$('[data-xp-open]')));

  await boot(page, { express: true });
  const t = await page.evaluate(() => ({ link: !!document.querySelector('.cs-today [data-xp-open]'), primaries: document.querySelectorAll('.cs-today .cs-btn-primary').length }));
  ok('z regułą trenera: link „Mniej czasu?”, nadal jedna główna akcja', t.link && t.primaries === 1, JSON.stringify(t));
  await page.tap('[data-xp-open]');
  await page.waitForSelector('#xp-sheet');
  const sh = await page.evaluate(() => [...document.querySelectorAll('#xp-sheet .xp-opt')].map((b) => ({ k: b.dataset.xpKind, t: b.innerText.replace(/\s+/g, ' '), h: b.getBoundingClientRect().height })));
  ok('3 warianty z czasem i ćwiczeniami', sh.length === 3 && sh[0].k === 'full' && sh[1].k === 'short' && sh[2].k === 'express' && sh.every((x) => /ok\. \d+ min/.test(x.t)) && /1 ćwiczenie · maks\. 2 serie/.test(sh[2].t), JSON.stringify(sh));
  ok('przyciski ≥ 44 px', sh.every((x) => x.h >= 44));
  await page.tap('#xp-sheet [data-xp-kind="express"]');
  await page.waitForSelector('.cs-ex');
  await page.waitForTimeout(400);
  const w = await page.evaluate(() => ({ phase: window._cw.phase, n: window._cw.exercises.length, sets: window._cw.exercises[0].sets.filter((s) => s.kind !== 'warmup').length, v: window._cw.variant,
    snap: (Object.entries(window.__fs).find(([k]) => k.startsWith('sessions/')) || [])[1] }));
  ok('Express startuje od razu: 1 ćwiczenie × 2 serie', w.phase === 'exercise' && w.n === 1 && w.sets === 2, JSON.stringify({ phase: w.phase, n: w.n, sets: w.sets }));
  ok('wariant w zapisie sesji', w.snap && w.snap.planSnapshot && w.snap.planSnapshot.variant && w.snap.planSnapshot.variant.kind === 'express' && w.snap.planSnapshot.variant.omitted.length === 3, JSON.stringify(w.snap && w.snap.planSnapshot && w.snap.planSnapshot.variant));
  ok('wiadomość dla trenera: „Wariant: Progress Express”', await page.evaluate(() => /Wariant: Progress Express \(ok\. \d+ min\) · maks\. 2 serie na ćwiczenie · pominięte zgodnie z ustaleniem trenera: Wiosłowanie/.test(csTrainerNoticeText(window._cw))));

  // Karta trenera (ta sama strona, render do kontenera, zapis przez persistById)
  const card = await page.evaluate(async () => {
    window.CL[0].express = null;
    const host = document.createElement('div'); host.id = 'cp-body'; document.body.appendChild(host);
    const c = window.CL[0];
    host.innerHTML = '<div id="wu-card"></div>';
    window._xpEdit = null;
    host.insertAdjacentHTML('beforeend', xpCardHTML(c));
    const r = { off: /Wyłączone/.test(document.getElementById('xp-card').innerText) };
    document.querySelector('#xp-card [data-act="xp-edit"]').click();
    const box = document.querySelector('#xp-card [data-xp-field="on"]'); box.checked = true; box.dispatchEvent(new Event('change'));
    r.preview = (document.querySelector('#xp-card .xp-prev') || {}).innerText || '';
    document.querySelector('#xp-card [data-act="xp-save"]').click();
    await new Promise((res) => setTimeout(res, 100));
    r.saved = window.__fs['clients/c1'] && window.__fs['clients/c1'].express;
    r.after = document.getElementById('xp-card').innerText;
    return r;
  });
  ok('trener: domyślnie wyłączone', card.off);
  ok('trener: podgląd dni z czasem wariantów', /Pełny/.test(card.preview) && /Express/.test(card.preview) && /ok\. \d+ min/.test(card.preview), card.preview.slice(0, 200));
  ok('trener: zapis reguły na karcie klienta', card.saved && card.saved.on === true && card.saved.express.ex === 2 && card.saved.express.sets === 2 && card.saved.short.ex === 4, JSON.stringify(card.saved));
  ok('trener: po zapisie „Włączone”', /Włączone/.test(card.after), card.after);
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Express — OK');
})();
