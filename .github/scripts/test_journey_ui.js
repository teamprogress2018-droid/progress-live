#!/usr/bin/env node
'use strict';
/**
 * Progress Journey + Rewards (journey.js) na ekranie Postępy (iPhone 390 × 844, atrapa Firebase):
 * „Twoja droga” i „Odznaki” liczone z treningów, nagroda trenera po zdobyciu odznaki, karta trenera (nagroda + cel) z zapisem.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-journey';

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
  await page.evaluate(() => {
    const add = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    for (let i = 0; i < 12; i++) {
      const kg = i < 3 ? 40 : i < 6 ? 45 : i < 9 ? 50 : 55;
      window.SE.push({ id: 'j' + i, clientId: 'c1', trainerId: 'cs-trainer', source: 'client', status: 'completed', date: add(-7 * (11 - i) - 1), planId: 'p1', dayIdx: 0, type: 'Dzień 1',
        exercises: [{ name: 'Przysiad', sets: [{ setNo: 1, kg: String(kg), reps: '8', kind: 'work' }, { setNo: 2, kg: String(kg), reps: '8', kind: 'work' }] }] });
    }
    window.CL[0].rewards = { regularity: { prize: 'Koszulka Team Progress' }, elite: { prize: 'Bonus do pakietu' } };
    setClientLiveScreen('progress');
  });
  await page.waitForSelector('[data-pj-journey]');
  const r = await page.evaluate(() => ({ j: document.querySelector('[data-pj-journey]').innerText, b: document.querySelector('[data-pj-badges]').innerText,
    done: document.querySelectorAll('[data-pj-journey] .pj-item.is-done').length, next: document.querySelectorAll('[data-pj-journey] .pj-item.is-next').length,
    bar: !!document.querySelector('[data-pj-journey] [role="progressbar"]'), on: document.querySelectorAll('[data-pj-badges] .pj-badge.is-on').length,
    over: document.documentElement.scrollWidth > window.innerWidth + 1,
    order: [...document.querySelectorAll('.cpg > section, .cpg > div, .cpg > details')].map((e) => e.dataset.pjJourney !== undefined ? 'journey' : e.dataset.pjBadges !== undefined ? 'badges' : e.className.split(' ')[0]).slice(0, 5) }));
  ok('„Twoja droga”: zdobyte etapy z datą + następny z paskiem', /Pierwszy trening/.test(r.j) && /10 treningów/.test(r.j) && /Pierwszy rekord osobisty/.test(r.j) && r.done >= 4 && r.next === 1 && r.bar && /12 z 30 treningów/.test(r.j), r.j.slice(0, 300));
  ok('„Odznaki”: zdobyte i podpowiedzi', /Odznaki\s*\d+ z 8/.test(r.b) && r.on >= 4 && /Regularność/.test(r.b) && /Jeszcze 13 treningów/.test(r.b), r.b.slice(0, 300));
  ok('nagroda trenera po zdobyciu odznaki, niezdobyta ukryta', /Nagroda od trenera: Koszulka Team Progress/.test(r.b) && !/Bonus do pakietu/.test(r.b));
  ok('bez poziomego przewijania (390 px)', !r.over);
  ok('kolejność: cel tygodnia → droga → odznaki', r.order.indexOf('journey') > 0 && r.order.indexOf('badges') === r.order.indexOf('journey') + 1, JSON.stringify(r.order));

  const card = await page.evaluate(async () => {
    window.CL[0].rewards = null;
    const host = document.createElement('div'); host.id = 'cp-body'; host.innerHTML = '<div id="wu-card"></div>'; document.body.appendChild(host);
    window._pjEdit = null;
    host.insertAdjacentHTML('beforeend', pjTrainerCardHTML(window.CL[0]));
    const out = { view: document.getElementById('pj-card').innerText };
    document.querySelector('#pj-card [data-act="pj-edit"]').click();
    const sel = document.querySelector('#pj-card [data-pj-prize="regularity"]'); sel.value = 'Koszulka Team Progress'; sel.dispatchEvent(new Event('change'));
    const own = document.querySelector('#pj-card [data-pj-prize="record"]'); own.value = '__own'; own.dispatchEvent(new Event('change'));
    const inp = document.querySelector('#pj-card [data-pj-own="record"]'); inp.value = 'Trening w parze gratis'; inp.dispatchEvent(new Event('input'));
    const g = document.querySelector('#pj-card [data-pj-goal]'); g.value = '10 pompek bez kolan'; g.dispatchEvent(new Event('change'));
    const given = document.querySelector('#pj-card [data-pj-given="regularity"]'); if (given) { given.checked = true; given.dispatchEvent(new Event('change')); }
    document.querySelector('#pj-card [data-act="pj-save"]').click();
    await new Promise((res) => setTimeout(res, 100));
    out.saved = window.__fs['clients/c1'];
    out.after = document.getElementById('pj-card').innerText;
    return out;
  });
  ok('trener: podsumowanie drogi', /12 treningów · kamienie milowe: \d+ · odznaki: \d+ z 8/.test(card.view), card.view);
  const sv = card.saved || {};
  ok('trener: zapis nagród (lista + własna) i celu', sv.rewards && sv.rewards.regularity.prize === 'Koszulka Team Progress' && sv.rewards.record.prize === 'Trening w parze gratis' && sv.journeyGoal && sv.journeyGoal.text === '10 pompek bez kolan', JSON.stringify({ r: sv.rewards, g: sv.journeyGoal }));
  ok('trener: wręczenie zapisane z datą', !!(sv.rewards && sv.rewards.regularity.givenAt));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Journey + Rewards — OK');
})();
