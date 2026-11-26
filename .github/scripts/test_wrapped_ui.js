#!/usr/bin/env node
'use strict';
/**
 * Progress Wrapped (wrapped.js) na ekranie Postępy (iPhone 390 × 844, atrapa Firebase):
 * przycisk w „Podsumowaniu miesiąca” → okno z liczbami, wiadomością trenera i kolejnym celem; przełączanie okresu;
 * „Zapisz jako grafikę” = PNG 1080 × 1350; karta trenera zapisuje wiadomość na karcie klienta.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-wrapped';

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  const ym = await page.evaluate(() => {
    const t = todayYmd(); const ymd = (n) => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    for (let i = 0; i < 6; i++) {
      window.SE.push({ id: 'w' + i, clientId: 'c1', trainerId: 'cs-trainer', source: 'client', status: 'completed', date: ymd(i * 3), duration: '45', planId: 'p1', dayIdx: 0, type: 'Dzień 1',
        exercises: [{ name: 'Przysiad', sets: [{ setNo: 1, kg: String(60 - i * 2.5), reps: '8', kind: 'work' }] }] });
    }
    const ref = typeof pwDefaultRef === 'function' ? pwDefaultRef() : t;
    window.CL[0].wrappedNotes = { [ref.slice(0, 7)]: 'Świetny miesiąc, tak trzymaj!' };
    setClientLiveScreen('progress');
    return ref.slice(0, 7);
  });
  await page.waitForSelector('[data-pw-open]');
  await page.tap('[data-pw-open]');
  await page.waitForSelector('#pw-sheet');
  const m = await page.evaluate(() => ({ t: document.getElementById('pw-sheet').innerText, facts: document.querySelectorAll('#pw-sheet .pw-fact').length,
    small: [...document.querySelectorAll('#pw-sheet button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.innerText) }));
  ok('okno: okres, liczby, wiadomość trenera, kolejny cel', /TEAM PROGRESS/.test(m.t) && m.facts >= 3 && /Świetny miesiąc, tak trzymaj!/.test(m.t) && /Kolejny cel/i.test(m.t), m.t.slice(0, 400));
  ok('okno: informacja o prywatności', /nie ma masy ciała, pomiarów ani zdjęć/.test(m.t));
  ok('przyciski ≥ 44 px', !m.small.length, JSON.stringify(m.small));
  await page.tap('#pw-sheet [data-pw-kind="year"]');
  const yr = await page.evaluate(() => ({ t: document.querySelector('#pw-sheet h2').innerText, on: document.querySelector('#pw-sheet [data-pw-kind="year"]').getAttribute('aria-pressed') }));
  ok('przełączenie na rok', /^Rok \d{4}$/.test(yr.t) && yr.on === 'true', JSON.stringify(yr));
  await page.tap('#pw-sheet [data-pw-kind="month"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('#pw-sheet [data-pw-save]')]);
  const name = dl.suggestedFilename();
  const size = await page.evaluate(() => window._pwLast && window._pwLast.size);
  const dims = await page.evaluate(() => { const cv = pwDraw(window.CL[0], 'month'); return cv ? [cv.width, cv.height] : null; });
  ok('grafika PNG 1080 × 1350 do zapisania', /^team-progress-podsumowanie-\d{4}-\d{2}\.png$/.test(name) && size > 10000 && dims && dims[0] === 1080 && dims[1] === 1350, JSON.stringify({ name, size, dims }));
  await page.keyboard.press('Escape');
  ok('Escape zamyka okno', !(await page.$('#pw-sheet')));

  const card = await page.evaluate(async () => {
    const host = document.createElement('div'); host.id = 'cp-body'; host.innerHTML = '<div id="pj-card"></div>'; document.body.appendChild(host);
    window._pwEdit = null; window.CL[0].wrappedNotes = null;
    host.insertAdjacentHTML('beforeend', pwTrainerCardHTML(window.CL[0]));
    const out = { view: document.getElementById('pw-card').innerText };
    document.querySelector('#pw-card [data-act="pw-edit"]').click();
    const ta = document.querySelector('#pw-card [data-pw-note]'); ta.value = 'Brawo za regularność!'; ta.dispatchEvent(new Event('input'));
    document.querySelector('#pw-card [data-act="pw-save"]').click();
    await new Promise((r) => setTimeout(r, 100));
    out.saved = window.__fs['clients/c1'] && window.__fs['clients/c1'].wrappedNotes; out.key = ta.dataset.pwNote;
    out.after = document.getElementById('pw-card').innerText;
    return out;
  });
  ok('trener: liczby bieżącego miesiąca', /\d+ trening/.test(card.view), card.view);
  ok('trener: wiadomość zapisana na karcie klienta', card.saved && card.saved[card.key] === 'Brawo za regularność!' && /Brawo za regularność!/.test(card.after), JSON.stringify(card.saved));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Wrapped — OK');
})();
