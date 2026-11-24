#!/usr/bin/env node
'use strict';
/**
 * Etap 3 modernizacji (390 × 844, atrapa danych): Postępy pokazują postęp siłowy z prawdziwych treningów klienta
 * (najczęściej robione ćwiczenie, najcięższa seria w każdym treningu, wykres + „+N kg od …”) i „Twoje rekordy”.
 * Bez treningów: zachęta zamiast pustego wykresu. Ekran Trener: niższe wiersze, „Napisz do trenera” na górze.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const BASE = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=strength';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const boot = (withSessions) => page.evaluate((withSessions) => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = {}; window.notify = () => {};
    window.persistById = async (c, o) => o;
    const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    const ses = (n, kg, reps, squat) => ({ id: 's' + n, clientId: 'c1', source: 'client', status: 'completed', date: d(n), exercises: [
      { name: 'Ściąganie wyciągu szerokim chwytem', loadUnit: 'kg', sets: [{ kg: kg - 5, reps: 10, kind: 'warmup' }, { kg, reps }, { kg, reps: reps - 1 }] },
      { name: 'Przysiad ze sztangą', loadUnit: 'kg', sets: squat ? [{ kg: squat, reps: 8 }] : [] },
      { name: 'Plank', loadUnit: 'sec', sets: [{ kg: '', reps: 40 }] }] });
    window.PL = []; window.SE = withSessions ? [ses(21, 70, 7, 60), ses(14, 75, 7, 0), ses(7, 75, 8, 65), ses(2, 80, 7, 0)] : [];
    window.TASKS = []; window.PACKAGES = []; window.METRIC_ENTRIES = []; window.MSGS = { c1: [] };
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell(); setClientLiveScreen('progress');
  }, withSessions);

  await boot(false);
  await page.waitForTimeout(300);
  const empty = await page.evaluate(() => ({ chart: !!document.querySelector('.cs-chart'), txt: (document.querySelector('[data-cs-strength]') || {}).innerText || '' }));
  ok('bez treningów: zachęta, bez wykresu', !empty.chart && /Po 2 treningach/.test(empty.txt), JSON.stringify(empty));

  await boot(true);
  await page.waitForTimeout(300);
  const p = await page.evaluate(() => {
    const s = document.querySelector('.cs-strength');
    const r = document.querySelector('[data-cs-records]');
    return { txt: s ? s.innerText : '', pts: document.querySelectorAll('.cs-chart .cs-ch-dot').length, aria: (document.querySelector('.cs-chart') || { getAttribute: () => '' }).getAttribute('aria-label'),
      rec: r ? r.innerText : '', overflow: document.documentElement.scrollWidth > innerWidth };
  });
  ok('wykres: najczęściej robione ćwiczenie (4 treningi), 4 punkty', /Ściąganie wyciągu/.test(p.txt) && p.pts === 4, JSON.stringify(p));
  ok('rozgrzewka pominięta, najcięższa seria: 70 → 80 kg, „+10 kg od …”', /70 → 80 kg/.test(p.txt) && /\+10 kg od/.test(p.txt), p.txt);
  ok('wykres ma opis dla czytnika', /Ciężar w kolejnych treningach/.test(p.aria || ''), p.aria);
  ok('rekordy: ściąganie 80 kg × 7, przysiad 65 kg × 8, bez planka (sekundy)', /80 kg × 7/.test(p.rec) && /65 kg × 8/.test(p.rec) && !/Plank/.test(p.rec), p.rec);
  ok('bez przewijania w poziomie', !p.overflow);

  await page.evaluate(() => setClientLiveScreen('trainer'));
  await page.waitForTimeout(300);
  const h = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cs-hub .cs-row')].map((b) => Math.round(b.getBoundingClientRect().height));
    const cta = document.querySelector('[data-cs-hub-chat] .cs-btn-primary');
    return { rows, cta: cta ? cta.innerText.trim() : '', ctaTop: cta ? cta.getBoundingClientRect().top : 9999 };
  });
  ok('Trener: „Napisz do trenera” na górze ekranu', /Napisz do trenera/.test(h.cta) && h.ctaTop < 500, JSON.stringify(h));
  ok('Trener: wiersze niższe (≤ 72 px, ≥ 44 px; bez podpisu ≤ 56 px)', h.rows.length > 2 && h.rows.every((x) => x >= 44 && x <= 72) && h.rows.slice(1).every((x) => x <= 56), JSON.stringify(h.rows));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Postępy: wykres siły i rekordy; Trener zwięzły — OK');
})();
