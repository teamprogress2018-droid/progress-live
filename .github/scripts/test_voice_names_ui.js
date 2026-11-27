#!/usr/bin/env node
'use strict';
/**
 * Imię klienta głosem trenera (voice-names-app.js + client-voice.js), atrapy Firebase i funkcji voiceNameClips:
 * karta trenera z propozycją wołacza, walidacja, zapis client.voiceName + wywołanie funkcji, stan nagrań, błąd serwera,
 * „Nie używaj imienia”; silnik mówi „Cześć, Anno!” tylko z nagraniem (głos trenera).
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=voice-names';

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
      goal: 'Siła i lepsza kondycja', ...(o.voiceName ? { voiceName: o.voiceName } : {}), ...(o.health != null ? { consents: { privacy: { version: '2026-11-26', at: '2026-11-26T08:00:00Z' }, health: { granted: o.health, at: '2026-11-26T08:00:00Z' } } } : {}) }];
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
  const r = await page.evaluate(async () => {
    window.CL[0].name = 'Anna Kowalska';
    window.__calls = [];
    window._voiceNamesCall = async (d) => { window.__calls.push(d); if (window.__fail) { const e = new Error('Dzisiejszy limit nagrań imion jest wykorzystany. Spróbuj jutro.'); e.code = 'functions/resource-exhausted'; throw e; } return { data: { name: window.CL[0].voiceName, count: 4, generated: 4 } }; };
    const host = document.createElement('div'); host.id = 'cp-body'; host.innerHTML = '<div id="hb-card"></div>'; document.body.appendChild(host);
    window.renderCPPlan(window.CL[0]);
    await new Promise((res) => setTimeout(res, 50));
    const card = () => document.getElementById('vn-card');
    const out = { view: card().innerText, val: card().querySelector('[data-vn-name]').value };
    const inp = card().querySelector('[data-vn-name]');
    inp.value = '<b>'; card().querySelector('[data-act="vn-record"]').click();
    await new Promise((res) => setTimeout(res, 50));
    out.bad = (card().querySelector('[role="alert"]') || {}).innerText || ''; out.badCalls = window.__calls.length;
    card().querySelector('[data-vn-name]').value = 'Aniu';
    card().querySelector('[data-act="vn-record"]').click();
    await new Promise((res) => setTimeout(res, 150));
    out.saved = window.__fs['clients/c1'] && window.__fs['clients/c1'].voiceName; out.calls = JSON.stringify(window.__calls);
    out.after = card().innerText;
    window.__fail = true;
    card().querySelector('[data-act="vn-record"]').click();
    await new Promise((res) => setTimeout(res, 150));
    out.err = (card().querySelector('[role="alert"]') || {}).innerText || '';
    card().querySelector('[data-act="vn-clear"]').click();
    await new Promise((res) => setTimeout(res, 150));
    out.cleared = window.__fs['clients/c1'].voiceName;
    return out;
  });
  ok('karta: propozycja wołacza „Anno” i podgląd zwrotów', r.val === 'Anno' && /Cześć, Anno!/.test(r.view) && /ElevenLabs/.test(r.view) && /prywatne/.test(r.view), JSON.stringify(r));
  ok('walidacja: znaki specjalne odrzucone, bez wywołania serwera', /wołaczu/.test(r.bad) && r.badCalls === 0, r.bad);
  ok('zapis client.voiceName = „Aniu” + wywołanie voiceNameClips({clientId})', r.saved === 'Aniu' && r.calls === JSON.stringify([{ clientId: 'c1' }]), JSON.stringify(r));
  ok('stan: „Nagrane Twoim głosem: Aniu (4 zwroty)”', /Nagrane Twoim głosem: Aniu \(4 zwroty\)/.test(r.after), r.after);
  ok('błąd serwera pokazany trenerowi', /limit nagrań imion/.test(r.err), r.err);
  ok('„Nie używaj imienia” czyści pole', r.cleared === '', JSON.stringify(r.cleared));

  const eng = await page.evaluate(() => {
    window.CL[0].voiceName = 'Anno';
    localStorage.setItem('pl_pv_v1:c1', JSON.stringify({ voice: 'trainer' }));
    const a = pvNameLine(0);
    PV.clientPack = { 'Cześć, Anno!': 'blob:test' };
    const b = pvNameLine(0);
    return { a, b, src: JSON.stringify(PV.pack ? pvPackSource({ text: 'Cześć, Anno!' }) : 'blob:test') };
  });
  ok('silnik: bez nagrania imienia — nic; z nagraniem — „Cześć, Anno!” z prywatnego pliku', eng.a === '' && eng.b === 'Cześć, Anno!' && /blob:test/.test(eng.src), JSON.stringify(eng));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Imię klienta głosem trenera — OK');
})();
