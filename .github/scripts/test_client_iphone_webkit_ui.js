#!/usr/bin/env node
'use strict';
/**
 * Aplikacja klienta na silniku Safari (Playwright WebKit, profil „iPhone 13”).
 * UWAGA: to EMULACJA silnika WebKit na Linuksie, nie prawdziwy iPhone. Nie sprawdza instalacji PWA
 * na ekranie początkowym, powiadomień, klawiatury iOS ani VoiceOver — do tego jest instrukcja ręcznego testu
 * (docs/pilotaz-test-reczny.md). Sprawdza: PWA (manifest, ikony, meta), cele dotykowe ≥ 44 pt, nazwy dostępne
 * przycisków i pól (to, co czyta VoiceOver), kolejność fokusu, błąd pod polem, obrót ekranu, wyjście
 * i powrót do treningu, brak internetu. Dane: atrapa w pamięci strony, bez Firebase.
 * Domyślnie WebKit; BROWSER=chromium uruchamia ten sam scenariusz w Chromium (dla porównania).
 */
const pw = require('playwright');

const ENGINE = process.env.BROWSER || 'webkit';
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=iphone-webkit';

(async () => {
  const browser = await pw[ENGINE].launch();
  const device = { ...pw.devices['iPhone 13'] };
  if (ENGINE !== 'webkit') { delete device.defaultBrowserType; }
  const ctx = await browser.newContext({ ...device, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  try {
    // PWA: to, czego Safari potrzebuje do „Do ekranu początkowego”.
    const pwa = await page.evaluate(async () => {
      const man = document.querySelector('link[rel="manifest"]');
      let json = null; try { json = await (await fetch(man.href)).json(); } catch (e) {}
      return { manifest: !!man, display: json && json.display, icons: json && (json.icons || []).length,
        appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
        capable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"],meta[name="mobile-web-app-capable"]'),
        viewportFit: /viewport-fit=cover/.test((document.querySelector('meta[name="viewport"]') || {}).content || '') };
    });
    ok('PWA: manifest (standalone), ikony, apple-touch-icon, tryb aplikacji, viewport-fit=cover',
      pwa.manifest && /standalone|fullscreen/.test(pwa.display || '') && pwa.icons > 0 && pwa.appleIcon && pwa.capable && pwa.viewportFit, JSON.stringify(pwa));

    await page.evaluate(() => {
      window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
      window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'iphone' };
      window._notes = []; window.notify = (m) => window._notes.push(m);
      window._doc = (_d, col, id) => ({ col, id });
      window._getDoc = async () => ({ exists: () => false, data: () => null });
      window.persistById = async (_c, o) => o;
      try { localStorage.clear(); } catch (e) {}
      const today = todayYmd(); const wd = new Date().getDay();
      window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
      const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
      window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
        days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli leżąc na ławce poziomej', 3, 10, 20), ex('Wiosłowanie hantlem', 3, 12, 18)] }] }];
      window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
      window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
      enterClientLiveShell();
    });
    await page.waitForSelector('.cs-today');

    // Cele dotykowe i nazwy dostępne na ekranie Dzisiaj (dolny pasek i główna akcja).
    const audit = (root) => page.evaluate((sel) => {
      const r = document.querySelector(sel) || document.body;
      const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const name = (e) => (e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].innerText) || e.innerText || e.value || e.title || '').trim();
      const els = [...r.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role="button"]')].filter(vis);
      return { n: els.length,
        small: els.filter((e) => { const b = e.getBoundingClientRect(); return (e.matches('button, [role="button"], a.cs-btn') && (b.height < 44 || b.width < 44)); })
          .map((e) => (name(e) || e.className).slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)),
        unnamed: els.filter((e) => !name(e)).map((e) => e.outerHTML.slice(0, 80)) };
    }, root);
    let a = await audit('.cs-today');
    ok('Dzisiaj: każdy przycisk i pole ma nazwę dla VoiceOver', a.n > 0 && !a.unnamed.length, a.unnamed.join(' | '));
    ok('Dzisiaj: przyciski co najmniej 44 × 44 pt', !a.small.length, a.small.join(' | '));
    const nav = await page.evaluate(() => [...document.querySelectorAll('.cs-nav button, .cs-nav a, nav button')].filter((e) => e.offsetParent).map((e) => ({ t: (e.getAttribute('aria-label') || e.innerText).trim(), h: e.getBoundingClientRect().height, cur: e.getAttribute('aria-current') })));
    ok('dolny pasek: nazwy, 44 pt i zaznaczona bieżąca zakładka', nav.length >= 4 && nav.every((x) => x.t && x.h >= 44) && nav.some((x) => x.cur), JSON.stringify(nav).slice(0, 300));

    // Trening: start, nazwy pól serii, błąd pod polem, zapis serii.
    await page.tap('.cs-today .cs-btn-primary');
    await page.waitForSelector('.cs-ex');
    a = await audit('#clive-player-inner');
    ok('ćwiczenie: każdy przycisk i pole ma nazwę dla VoiceOver', !a.unnamed.length, a.unnamed.join(' | '));
    ok('ćwiczenie: przyciski co najmniej 44 × 44 pt', !a.small.length, a.small.join(' | '));
    // Kolejność fokusu: najpierw nagłówek (powrót), potem treść, na końcu zapis serii.
    const order = await page.evaluate(() => {
      const r = document.getElementById('clive-player-inner');
      const els = [...r.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
        .filter((e) => e.offsetParent && !e.disabled);
      const lbl = (e) => (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const idx = (re) => els.findIndex((e) => re.test(lbl(e)));
      return { first: lbl(els[0] || document.body), reps: idx(/powtórzenia/), save: idx(/^Zapisz serię/), back: idx(/Wróć|Wyjdź|Lista ćwiczeń/), positive: [...r.querySelectorAll('[tabindex]')].filter((e) => +e.getAttribute('tabindex') > 0).length };
    });
    ok('kolejność fokusu: powrót → pola serii → „Zapisz serię”, bez dodatnich tabindex', order.back === 0 && order.reps > order.back && order.save > order.reps && !order.positive, JSON.stringify(order));

    await page.fill('input[aria-label="Seria 1: powtórzenia"]', '');
    await page.dispatchEvent('input[aria-label="Seria 1: powtórzenia"]', 'input');
    await page.tap('.cs-ex-foot [data-cs-primary="save"]');
    await page.waitForTimeout(150);
    const err = await page.evaluate(() => { const e = document.getElementById('cs-set-err'); const i = document.querySelector('input[aria-label="Seria 1: powtórzenia"]'); return { role: e && e.getAttribute('role'), t: e && e.textContent, inv: i && i.getAttribute('aria-invalid'), desc: i && i.getAttribute('aria-describedby') }; });
    ok('błąd pod polem: role=alert, aria-invalid i powiązanie z polem', err.role === 'alert' && /Wpisz liczbę powtórzeń/.test(err.t || '') && err.inv === 'true' && /cs-set-err/.test(err.desc || ''), JSON.stringify(err));

    // Brak internetu: zapis serii na telefonie z jasnym komunikatem.
    await ctx.setOffline(true);
    await page.fill('input[aria-label="Seria 1: powtórzenia"]', '10');
    await page.tap('.cs-ex-foot [data-cs-primary="save"]');
    await page.waitForTimeout(300);
    const off = await page.evaluate(() => ({ done: window._cw.exercises[0].sets[0].done, sync: window._cw.syncState, local: !!localStorage.getItem(cwDraftKey()) }));
    ok('offline: seria zapisana na telefonie (stan „oczekuje na synchronizację”)', off.done && off.sync === 'local' && off.local, JSON.stringify(off));
    await ctx.setOffline(false);
    await page.evaluate(() => { try { clearInterval(window._cwRestTimer); cwSkipRest(); } catch (e) {} });
    await page.waitForTimeout(750);

    // Obrót ekranu (poziomo): bez przewijania w bok, przycisk zapisu w zasięgu.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    const land = await page.evaluate(() => { const b = document.querySelector('.cs-ex-foot [data-cs-primary]'); const r = b && b.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, btn: !!b, inView: !!r && r.bottom <= innerHeight + 1 && r.top >= 0, h: r && Math.round(r.height) }; });
    ok('poziomo: bez przewijania w bok, przycisk zapisu widoczny', !land.overflow && land.btn && land.inView, JSON.stringify(land));
    await page.setViewportSize({ width: 390, height: 664 });
    await page.waitForTimeout(300);

    // Wyjście i powrót do treningu (np. po przejściu do innej aplikacji).
    await page.evaluate(() => cwClose(true));
    await page.waitForTimeout(300);
    const home = await page.evaluate(() => document.querySelector('.cs-today') && document.querySelector('.cs-today').innerText);
    ok('po wyjściu: „Trening w toku” i „Wznów trening”', /TRENING W TOKU/i.test(home || '') && /Wznów trening/.test(home || ''), (home || '').slice(0, 200));
    await page.tap('.cs-today .cs-btn-primary');
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => ({ active: !!(window._cw && window._cw.active), done: window._cw && window._cw.exercises[0].sets.filter((s) => s.done).length }));
    ok('wznowienie: ten sam trening z zapisaną serią', res.active && res.done === 1, JSON.stringify(res));

    ok('bez błędów JS (' + ENGINE + ')', !errors.length, errors.join(' | '));
  } finally { await browser.close(); }
  if (failed) { console.error(failed + ' błąd(ów)'); process.exit(1); }
  console.log('Aplikacja klienta na ' + ENGINE + ' (emulacja iPhone 13): OK');
})().catch((e) => { console.error(e); process.exit(1); });
