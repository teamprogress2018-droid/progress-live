#!/usr/bin/env node
'use strict';
/**
 * Przypomnienia o nawykach (habits.js + comms-app.js), 390 px, atrapa Firebase:
 * karta trenera (domyślnie wyłączone → woda 9–19 co 2 h, sen, własne z treścią, walidacja, zapis client.habits),
 * klient: przełącznik „Przypomnienia o nawykach” w Powiadomieniach tylko, gdy trener je włączył.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=habits';

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
      goal: 'Siła i lepsza kondycja', ...(o.habits ? { habits: o.habits } : {}), ...(o.health != null ? { consents: { privacy: { version: '2026-11-26', at: '2026-11-26T08:00:00Z' }, health: { granted: o.health, at: '2026-11-26T08:00:00Z' } } } : {}) }];
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
  ok('klient bez nawyków: brak przełącznika w Powiadomieniach', await page.evaluate(() => { setClientLiveScreen('notify'); return !/Przypomnienia o nawykach/.test(document.getElementById('clive-screen-content').innerText); }));

  const r = await page.evaluate(async () => {
    const host = document.createElement('div'); host.id = 'cp-body'; host.innerHTML = '<div id="pai-card"></div>'; document.body.appendChild(host);
    window.renderCPPlan(window.CL[0]);
    const out = { view: document.getElementById('hb-card').innerText };
    document.querySelector('#hb-card [data-act="hb-edit"]').click();
    out.edit = document.getElementById('hb-card').innerText;
    const set = (k, v) => { const el = document.querySelector(`#hb-card [data-hb="${k}"]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change')); };
    set('sleep.on', true); set('sleep.at', '22:30'); set('custom.on', true);
    document.querySelector('#hb-card [data-act="hb-save"]').click();
    await new Promise((res) => setTimeout(res, 50));
    out.err = (document.querySelector('#hb-card [role="alert"]') || {}).innerText || '';
    set('custom.text', 'Weź witaminę D');
    out.preview = document.querySelector('#hb-card [data-hb-preview]').innerText;
    document.querySelector('#hb-card [data-act="hb-save"]').click();
    await new Promise((res) => setTimeout(res, 100));
    out.saved = window.__fs['clients/c1'] && window.__fs['clients/c1'].habits;
    out.after = document.getElementById('hb-card').innerText;
    return out;
  });
  ok('karta trenera: domyślnie wyłączone', /Wyłączone/.test(r.view), r.view);
  ok('edycja: informacja o push, ciszy nocnej i limicie', /powiadomienie push/.test(r.edit) && /cisz/.test(r.edit) && /limitu/.test(r.edit), r.edit);
  ok('walidacja: własne bez treści', /treść własnego/.test(r.err), r.err);
  ok('podgląd godzin', /Woda: 09:00, 11:00, 13:00, 15:00, 17:00, 19:00/.test(r.preview) && /Sen: 22:30/.test(r.preview) && /Własne przypomnienie: 08:00/.test(r.preview), r.preview);
  const s = r.saved || {};
  const by = Object.fromEntries((s.items || []).map((i) => [i.id, i]));
  ok('zapis client.habits', s.on === true && by.water.on && by.water.everyH === 2 && by.sleep.on && by.sleep.at === '22:30' && by.custom.text === 'Weź witaminę D' && !by.steps.on, JSON.stringify(s));
  ok('po zapisie: podsumowanie godzin', /Sen: 22:30/.test(r.after), r.after);

  await page.evaluate(() => { setClientLiveScreen('notify'); });
  const tog = await page.evaluate(() => { const l = [...document.querySelectorAll('.comms-check')].find((x) => /nawykach/.test(x.innerText)); return l ? { t: l.innerText, k: l.querySelector('input').dataset.k, on: l.querySelector('input').checked } : null; });
  ok('klient: przełącznik „Przypomnienia o nawykach” (kategoria habits, domyślnie włączony)', tog && tog.k === 'habits' && tog.on, JSON.stringify(tog));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Przypomnienia o nawykach — OK');
})();
