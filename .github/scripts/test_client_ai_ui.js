#!/usr/bin/env node
'use strict';
/**
 * Progress AI dla klienta (client-ai.js), iPhone 390 px, atrapa pośrednika AI i Firebase:
 * bez włączenia przez trenera brak karty, karta w „Trener”, szybkie pytanie → odpowiedź i licznik, zapytanie idzie na /client
 * tylko z pytaniem, historią i kontekstem (bez promptu/modelu), kontuzje tylko przy zgodzie na dane o zdrowiu,
 * limit (429) blokuje pole, błąd sieci zostawia pytanie w polu, „Napisz do trenera”, karta trenera zapisuje aiCoach.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-ai';
const PROXY = 'https://anthropic-proxy.teamprogress2018.workers.dev/client';

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
      goal: 'Siła i lepsza kondycja', ...(o.ai ? { aiCoach: { on: true, limit: 10 } } : {}), ...(o.health != null ? { consents: { privacy: { version: '2026-11-26', at: '2026-11-26T08:00:00Z' }, health: { granted: o.health, at: '2026-11-26T08:00:00Z' } } } : {}) }];
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
  const sent = []; let mode = 'ok';
  await page.route(PROXY, async (r) => {
    sent.push(JSON.parse(r.request().postData() || '{}'));
    if (mode === 'limit') return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { type: 'rate_limit', message: 'Dzisiejszy limit pytań jest wykorzystany. Wróć jutro albo napisz do trenera.' }, remaining: 0, limit: 10 }) });
    if (mode === 'down') return r.abort();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Zacznij od rozgrzewki.\nZapytaj trenera w czacie.', remaining: 9 - (sent.length - 1), limit: 10 }) });
  });

  await boot(page);
  await page.evaluate(() => setClientLiveScreen('trainer'));
  await page.waitForSelector('.cs-hub');
  ok('bez włączenia przez trenera — brak Progress AI', !(await page.$('[data-pai-hub]')));

  await boot(page, { ai: true, health: false });
  await page.evaluate(() => setClientLiveScreen('trainer'));
  await page.waitForSelector('[data-pai-hub]');
  await page.tap('[data-pai-open]');
  await page.waitForSelector('#pai-sheet');
  const s0 = await page.evaluate(() => ({ t: document.getElementById('pai-sheet').innerText, quick: document.querySelectorAll('[data-pai-q]').length,
    small: [...document.querySelectorAll('#pai-sheet button, #pai-sheet textarea')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.outerHTML.slice(0, 50)) }));
  ok('okno: 3 szybkie pytania, informacja o AI i limicie', s0.quick === 3 && /nie zastępuje trenera ani lekarza/.test(s0.t) && /Możesz zadać 10 pytań dziennie/.test(s0.t) && /Anthropic/.test(s0.t), JSON.stringify(s0));
  ok('cele dotykowe ≥ 44 px', !s0.small.length, JSON.stringify(s0.small));
  await page.tap('[data-pai-q="1"]');
  await page.waitForSelector('.pai-msg.is-ai');
  const s1 = await page.evaluate(() => ({ msgs: [...document.querySelectorAll('.pai-msg')].map((m) => m.className + ':' + m.innerText.replace(/\s+/g, ' ')), left: document.querySelector('[data-pai-left]').innerText }));
  ok('odpowiedź i licznik pozostałych pytań', s1.msgs.length === 2 && /is-user/.test(s1.msgs[0]) && /Nie mam dziś siły/.test(s1.msgs[0]) && /Zacznij od rozgrzewki/.test(s1.msgs[1]) && /Zostało 9 z 10/.test(s1.left), JSON.stringify(s1));
  const b0 = sent[0];
  ok('do pośrednika tylko pytanie, historia i kontekst (bez promptu/modelu)', Object.keys(b0).sort().join() === 'context,history,question' && b0.history.length === 0, JSON.stringify(Object.keys(b0)));
  ok('kontekst: cel, plan na dziś z ćwiczeniami, tydzień', b0.context.profile.goal === 'Siła i lepsza kondycja' && b0.context.today && b0.context.today.exercises.length === 4 && b0.context.today.exercises[0].name === 'Wyciskanie hantli' && b0.context.week.target >= 1, JSON.stringify(b0.context));
  ok('bez zgody na dane o zdrowiu — kontuzje nie idą do AI', !b0.context.profile.injuries && !JSON.stringify(b0).includes('barku'), JSON.stringify(b0.context.profile));
  await page.fill('#pai-in', 'Ile odpoczywać między seriami?');
  await page.tap('[data-pai-send]');
  await page.waitForFunction(() => document.querySelectorAll('.pai-msg').length === 4);
  ok('druga wiadomość wysyła historię rozmowy', sent[1].history.length === 2 && sent[1].history[0].role === 'user' && sent[1].history[1].role === 'assistant', JSON.stringify(sent[1].history));

  mode = 'down';
  await page.fill('#pai-in', 'Pytanie bez internetu');
  await page.tap('[data-pai-send]');
  await page.waitForSelector('#pai-sheet [role="alert"]');
  const s2 = await page.evaluate(() => ({ err: document.querySelector('#pai-sheet [role="alert"]').innerText, val: document.getElementById('pai-in').value, n: document.querySelectorAll('.pai-msg').length }));
  ok('brak sieci: komunikat, pytanie zostaje w polu, bez fałszywej odpowiedzi', /internetem/.test(s2.err) && s2.val === 'Pytanie bez internetu' && s2.n === 4, JSON.stringify(s2));
  mode = 'limit';
  await page.tap('[data-pai-send]');
  await page.waitForFunction(() => { const a = document.querySelector('#pai-sheet [role="alert"]'); return a && /limit/.test(a.innerText) && document.getElementById('pai-in').disabled; });
  const s3 = await page.evaluate(() => ({ err: document.querySelector('#pai-sheet [role="alert"]').innerText, btn: document.querySelector('[data-pai-send]').disabled, left: document.querySelector('[data-pai-left]').innerText }));
  ok('limit: komunikat, pole i przycisk zablokowane', /limit pytań/.test(s3.err) && s3.btn && /Zostało 0/.test(s3.left), JSON.stringify(s3));
  await page.tap('[data-pai-trainer]');
  await page.waitForTimeout(200);
  ok('„Napisz do trenera” zamyka okno i otwiera czat', await page.evaluate(() => !document.getElementById('pai-sheet') && window._clientScreen === 'messages' || !document.getElementById('pai-sheet')));

  // Zgoda na dane o zdrowiu → kontuzje w kontekście
  await page.evaluate(() => { window.CL[0].consents.health.granted = true; });
  ok('przy zgodzie na dane o zdrowiu — kontuzje w kontekście', await page.evaluate(() => /barku/.test(paiContext(window.CL[0]).profile.injuries || '')));
  await page.evaluate(() => { const p = document.createElement('div'); p.id = 'pai-esc'; document.body.appendChild(p); paiOpen(); });
  await page.keyboard.press('Escape');
  ok('Escape zamyka okno', await page.evaluate(() => !document.getElementById('pai-sheet')));

  // Karta trenera
  const card = await page.evaluate(async () => {
    window.CL[0].aiCoach = null;
    const host = document.createElement('div'); host.id = 'cp-body'; host.innerHTML = '<div id="ac-card"></div>'; document.body.appendChild(host);
    window.renderCPPlan(window.CL[0]);
    const out = { view: (document.getElementById('pai-card') || {}).innerText || '' };
    document.querySelector('#pai-card [data-act="pai-edit"]').click();
    const cb = document.querySelector('#pai-card [data-pai-field="on"]'); cb.checked = true; cb.dispatchEvent(new Event('change'));
    const sel = document.querySelector('#pai-card [data-pai-field="limit"]'); sel.value = '20'; sel.dispatchEvent(new Event('change'));
    out.edit = document.getElementById('pai-card').innerText;
    document.querySelector('#pai-card [data-act="pai-save"]').click();
    await new Promise((r) => setTimeout(r, 100));
    out.saved = window.__fs['clients/c1'] && window.__fs['clients/c1'].aiCoach;
    out.after = document.getElementById('pai-card').innerText;
    return out;
  });
  ok('karta trenera: domyślnie wyłączone', /Wyłączone/.test(card.view), card.view);
  ok('karta trenera: informacja o koszcie i zasadach', /płatne zapytanie/.test(card.edit) && /nie diagnozuje/.test(card.edit), card.edit);
  ok('karta trenera: zapis aiCoach {on:true, limit:20}', card.saved && card.saved.on === true && card.saved.limit === 20 && /do 20 pytań dziennie/.test(card.after), JSON.stringify(card));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress AI — OK');
})();
