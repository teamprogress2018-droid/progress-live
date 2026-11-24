#!/usr/bin/env node
'use strict';
/**
 * Panel trenera (1280 × 900, Chromium, atrapa danych):
 * 1) czat odświeża się sam — nowe wiadomości z serwera trafiają do listy i otwartej rozmowy bez F5,
 *    bez duplikatów i bez utraty wpisywanego tekstu; pobieranie co 40 s tylko przy widocznej karcie;
 * 2) okno treningu klienta pokazuje wynik rozgrzewki (planSnapshot.warmup);
 * 3) komunikaty w trakcie treningu: „Ostatnia seria · po niej przerwa…”, „Ostatnia seria treningu”.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=chat-refresh';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    window._uid = 't1'; window._clientAppMode = false; window._tenantDataReady = true;
    window.persistById = async (c, o) => o; window._notes = []; window.notify = (m) => window._notes.push(m);
    window.CL.splice(0, window.CL.length, { id: 'c1', trainerId: 't1', name: 'Anna Nowak', status: 'active' });
    Object.keys(window.MSGS).forEach((k) => delete window.MSGS[k]);
    window.MSGS.c1 = [{ id: 'm1', clientId: 'c1', trainerId: 't1', out: false, text: 'Cześć', createdAt: '2026-11-24T05:00:00.000Z', time: '06:00' }];
    window.__server = [window.MSGS.c1[0]];
    window.__reads = 0;
    window.tenantRefreshMessages = async () => { window.__reads++; return msgMergeServerRows(JSON.parse(JSON.stringify(window.__server))); };
    goTo('inbox');
    openChat('c1');
  });
  await page.fill('#msg-inp', 'Piszę odpowiedź…');
  await page.focus('#msg-inp');
  await page.evaluate(() => { window.__server.push({ id: 'msg_v_abc123', clientId: 'c1', trainerId: 't1', out: false, text: '🎥 Film techniki: Przysiad goblet\nTrening: Nogi\n[film:v_abc123.mp4]', createdAt: '2026-11-24T05:20:00.000Z', time: '06:20' }); });
  const added = await page.evaluate(() => msgRefreshNow(true));
  let t = await page.evaluate(() => document.getElementById('msg-wrap').innerText);
  ok('nowa wiadomość (film) pojawia się w otwartej rozmowie bez F5', added === 1 && /Film techniki: Przysiad goblet/.test(t), t.slice(0, 300));
  ok('wpisywany tekst nie znika przy odświeżeniu', await page.evaluate(() => document.getElementById('msg-inp').value === 'Piszę odpowiedź…'));
  ok('krótka informacja o nowej wiadomości', await page.evaluate(() => window._notes.includes('Nowa wiadomość od klienta')));
  const again = await page.evaluate(() => msgRefreshNow(true));
  ok('bez duplikatów przy kolejnym odczycie', again === 0 && await page.evaluate(() => window.MSGS.c1.length === 2));
  const hidden = await page.evaluate(async () => {
    const before = window.__reads;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await msgRefreshNow();
    const r = window.__reads - before;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    return r;
  });
  ok('ukryta karta: brak pobierania w tle', hidden === 0, String(hidden));
  ok('automatyczne odświeżanie ustawione (co 40 s)', await page.evaluate(() => !!window._msgRefreshTimer && MSG_REFRESH_MS === 40000));
  ok('aplikacja klienta nie pobiera wiadomości trenera', await page.evaluate(async () => { window._clientAppMode = true; const r = await msgRefreshNow(true); window._clientAppMode = false; return r === 0; }));

  // ---------- Rozgrzewka w oknie treningu ----------
  t = await page.evaluate(() => {
    let host = document.getElementById('as-recorded-exercises-list');
    if (!host) { document.body.insertAdjacentHTML('beforeend', '<div id="as-recorded-exercises-list"></div>'); }
    const s = { id: 's1', clientId: 'c1', source: 'client', status: 'completed', date: todayYmd(), exercises: [],
      planSnapshot: { warmup: { items: ['Krążenia ramion', 'Mobilizacja bioder'], done: [true, false], skipped: false } } };
    window.SE.push(s); renderRecordedExercises(s);
    return document.getElementById('as-recorded-exercises-list').innerText;
  });
  ok('okno treningu: „Rozgrzewka: zrobione 1 z 2” z listą ćwiczeń', /Rozgrzewka: zrobione 1 z 2/.test(t) && /Krążenia ramion ✓/.test(t) && /Mobilizacja bioder —/.test(t), t.slice(0, 300));
  t = await page.evaluate(() => { const s = { id: 's2', clientId: 'c1', source: 'client', status: 'completed', exercises: [], planSnapshot: { warmup: { items: ['A'], done: [false], skipped: true } } }; renderRecordedExercises(s); return document.getElementById('as-recorded-exercises-list').innerText; });
  ok('okno treningu: pominięta rozgrzewka', /Rozgrzewka: pominięta/.test(t), t.slice(0, 200));

  // ---------- Komunikaty w trakcie treningu ----------
  const labels = await page.evaluate(() => {
    const cw = { exIdx: 0, exercises: [{ sets: [{ done: true }, { done: false }] }, { sets: [{ done: false }] }] };
    const a = csSetsLeftLabel(1, cw);
    cw.exercises[1].sets[0].done = true;
    return [a, csSetsLeftLabel(1, cw), csSetsLeftLabel(3, cw)];
  });
  ok('ostatnia seria: co dalej (przerwa i kolejne ćwiczenie / koniec treningu)', labels[0] === 'Ostatnia seria · po niej przerwa i kolejne ćwiczenie' && labels[1] === 'Ostatnia seria treningu' && labels[2] === 'Zostały 3 serie', JSON.stringify(labels));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Czat trenera bez F5, rozgrzewka w oknie treningu, komunikaty — OK');
})().catch((e) => { console.error(e); process.exit(1); });
