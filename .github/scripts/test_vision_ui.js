#!/usr/bin/env node
'use strict';
/**
 * Vision (pilotaż): zgoda klienta przy wysyłce filmu (domyślnie wyłączona, widoczna linia w wiadomości),
 * przycisk „Analiza AI (pilot)” tylko u trenera i tylko przy zgodzie, zapytanie z 4 klatkami przez pośrednika AI,
 * wynik (dobrze / do poprawy z klatką / wskazówka / ograniczenia), „Wstaw wskazówkę do wiadomości”, brak zgody = brak analizy.
 * Atrapy: Storage, Firestore, pośrednik AI i wycinanie klatek (window.viFramesOverride).
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=vision';
const PROXY = 'https://anthropic-proxy.teamprogress2018.workers.dev/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-video' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    const fs = {}; window.__fs = fs;
    window._doc = (_db, col, id) => ({ col, id });
    window._getDoc = async (ref) => { if (window.__netFail) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; } const d = fs[ref.col + '/' + ref.id]; return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) }; };
    window.persistById = async (col, obj) => { if (window.__netFail) return null; const c = JSON.parse(JSON.stringify(obj)); delete c._fbId; fs[col + '/' + obj.id] = c; return obj; };
    // Atrapa Storage: zapis pod ścieżką, odczyt tylko przez getBlob (jak SDK), opcjonalna awaria sieci i odmowa dostępu.
    const st = {}; window.__st = st; window.__uploads = 0;
    window._storage = { fake: true };
    window._storageRef = (_s, path) => ({ fullPath: path });
    window._uploadBytes = async (ref, file, meta) => { window.__uploads++; if (window.__netFail) { const e = new Error('network'); e.code = 'storage/retry-limit-exceeded'; throw e; } st[ref.fullPath] = { blob: file, meta }; return { ref }; };
    window._getBlob = async (ref) => { if (window.__denyRead) { const e = new Error('denied'); e.code = 'storage/unauthorized'; throw e; } const o = st[ref.fullPath]; if (!o) { const e = new Error('nf'); e.code = 'storage/object-not-found'; throw e; } return o.blob; };
    window._deleteObject = async (ref) => { if (!st[ref.fullPath]) { const e = new Error('nf'); e.code = 'storage/object-not-found'; throw e; } delete st[ref.fullPath]; };
    window._getDownloadURL = async () => { window.__publicUrlRequested = true; return 'https://example.invalid/public'; };
    const today = todayYmd();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [new Date().getDay()] }];
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Nogi', exercises: [{ name: 'Przysiad goblet', sets: '3', reps: '10', kg: '16', rest: '90s' }] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.METRIC_ENTRIES = [];
    Object.keys(window.MSGS).forEach((k) => { delete window.MSGS[k]; }); window.MSGS.c1 = [];
    window.SETTINGS = { profile: { name: 'Piotr Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    window.getTrainerName = () => 'Piotr Trener';
    enterClientLiveShell();
  });
  await page.waitForSelector('.cs-today');
  const sent = [];
  await page.route(PROXY, async (r) => {
    sent.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      dobrze: ['Stopy stabilnie na ziemi'], poprawa: [{ co: 'Kolana uciekają do środka', klatka: 3, jak: 'Wypychaj kolana na zewnątrz' }],
      wskazowka: 'Przy schodzeniu myśl o rozpychaniu podłogi stopami na boki.', pewnosc: 'średnia', ograniczenia: 'Kamera tylko z przodu.' }) }] }) });
  });

  // Klient: zgoda przy wysyłce
  const cl = await page.evaluate(async () => {
    const file = new File([new Uint8Array(2048)], 'film.mp4', { type: 'video/mp4' });
    window._cvSend = { status: 'preview', file, url: '', exName: 'Przysiad goblet', dayName: 'Nogi', date: todayYmd(), duration: 12, type: cvFileType(file) };
    cvRender();
    const cb = document.getElementById('cv-ai');
    const out = { has: !!cb, checked: cb && cb.checked, txt: (document.querySelector('[data-cv-ai-ok]') || {}).innerText || '', h: cb ? cb.closest('label').getBoundingClientRect().height : 0 };
    cb.checked = true;
    await cvSend();
    const m = window.MSGS.c1[window.MSGS.c1.length - 1];
    out.status = window._cvSend && window._cvSend.status; out.text = m && m.text; out.display = m && msgDisplayText(m);
    return out;
  });
  ok('podgląd: zgoda na analizę AI — opcjonalna, domyślnie wyłączona, ≥ 44 px', cl.has && !cl.checked && /Anthropic/.test(cl.txt) && /Opcjonalnie/.test(cl.txt) && cl.h >= 44, JSON.stringify(cl));
  ok('wysłano: zgoda jako widoczna linia w wiadomości', cl.status === 'sent' && /🤖 Zgoda na analizę AI: tak/.test(cl.text) && /Zgoda na analizę AI/.test(cl.display), JSON.stringify(cl));

  // Trener: przycisk tylko przy zgodzie
  const tr = await page.evaluate(() => {
    const m = window.MSGS.c1[window.MSGS.c1.length - 1];
    const noAi = { ...m, id: 'msg_x', text: m.text.replace(/\n🤖 Zgoda na analizę AI: tak/, '') };
    window.MSGS.c1.push(noAi);
    const host = document.createElement('div'); host.id = 'vi-host';
    host.innerHTML = '<div id="a">' + cvChatCardHTML(m, { viewer: 'trainer', clientId: 'c1' }) + '</div><div id="b">' + cvChatCardHTML(noAi, { viewer: 'trainer', clientId: 'c1' }) + '</div>'
      + cvChatCardHTML(m, { viewer: 'client' }).replace('data-cv-card', 'data-cv-client-card') + '<textarea id="msg-inp"></textarea>';
    document.body.appendChild(host);
    window.viFramesOverride = async () => ['AAAA', 'BBBB', 'CCCC', 'DDDD'];
    return { withAi: !!document.querySelector('#a [data-act="cv-ai"]'), noAi: !!document.querySelector('#b [data-act="cv-ai"]'), client: /Analiza AI/.test(cvChatCardHTML(m, { viewer: 'client' })) };
  });
  ok('trener: „Analiza AI (pilot)” tylko przy zgodzie, klient go nie widzi', tr.withAi && !tr.noAi && !tr.client, JSON.stringify(tr));
  await page.evaluate(() => document.querySelector('#a [data-act="cv-ai"]').click());
  await page.waitForSelector('#a [data-vi-result]');
  const res = await page.evaluate(() => ({ t: document.querySelector('#a [data-vi-result]').innerText, frames: document.querySelectorAll('#a .vi-frame').length }));
  ok('wynik: dobrze, do poprawy z numerem klatki, wskazówka, ograniczenia, 4 klatki', /Stopy stabilnie/.test(res.t) && /Kolana uciekają do środka/.test(res.t) && /klatka 3/.test(res.t) && /rozpychaniu podłogi/.test(res.t) && /Kamera tylko z przodu/.test(res.t) && res.frames === 4, JSON.stringify(res));
  ok('wynik: informacja, że nic nie zapisano ani nie wysłano klientowi', /Nic nie zostało zapisane ani wysłane klientowi/.test(res.t));
  const b = sent[0] || {};
  const imgs = ((b.messages || [])[0] || {}).content || [];
  ok('zapytanie: 4 obrazy JPEG + ćwiczenie, model i limit tokenów', imgs.filter((x) => x.type === 'image' && x.source.media_type === 'image/jpeg').length === 4 && imgs.some((x) => x.type === 'text' && /Przysiad goblet/.test(x.text)) && b.max_tokens === 900 && /Nie diagnozujesz/.test(b.system), JSON.stringify(Object.keys(b)));
  await page.evaluate(() => document.querySelector('#a [data-act="vi-insert"]').click());
  ok('„Wstaw wskazówkę do wiadomości” wkleja szkic do pola wiadomości', await page.evaluate(() => /rozpychaniu podłogi/.test(document.getElementById('msg-inp').value)));
  const nb = sent.length;
  await page.evaluate(() => { document.querySelector('#a [data-act="vi-hide"]').click(); document.querySelector('#a [data-act="cv-ai"]').click(); });
  ok('ponowne otwarcie: wynik z pamięci, bez drugiego zapytania', await page.evaluate(() => !!document.querySelector('#a [data-vi-result]')) && sent.length === nb);
  const denied = await page.evaluate(async () => { const r = await viAnalyze({ cid: 'c1', file: 'x.mp4', mid: 'msg_x', tid: 't' }); return r.error || ''; });
  ok('bez zgody klienta analiza jest odrzucana', /nie zgodził się/.test(denied) || /Film/.test(denied), denied);
  const parsed = await page.evaluate(() => [viParse('```json\n{"dobrze":["a"],"poprawa":[],"wskazowka":"w","pewnosc":"wysoka","ograniczenia":""}\n```').ok, viParse('zwykły tekst').ok]);
  ok('odpowiedź w bloku ```json i zwykły tekst — obsłużone', parsed[0] === true && parsed[1] === false, JSON.stringify(parsed));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Vision — OK');
})();
