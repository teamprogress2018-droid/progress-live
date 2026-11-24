#!/usr/bin/env node
'use strict';
/**
 * Film techniki od klienta do trenera (Chromium, ATRAPA Storage i Firestore w pamięci strony — bez prawdziwych danych).
 * Prawdziwe reguły dostępu (inny trener, niezalogowany, limit 75 MB, brak listowania) sprawdza emulator:
 * server/automation/test-storage-rules.cjs (workflow tenant-isolation-check.yml).
 * Tu: przycisk na ekranie ćwiczenia, podgląd i potwierdzenie przed wysyłką, odbiorca i zgoda na udostępnienie,
 * niedozwolony format / za duży / za długi film, błąd sieci i ponowienie, brak połączenia → wysyłka po powrocie,
 * karta filmu z nazwą ćwiczenia w czacie trenera i klienta, odtwarzanie przez getBlob (bez publicznego adresu), usuwanie.
 */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-video';

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
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-set-head');

  // ---------- Wejście z ekranu ćwiczenia ----------
  ok('ekran ćwiczenia: „Wyślij film trenerowi”', await page.locator('.cs-ex [data-cv-open]').count() === 1);
  await page.click('.cs-ex [data-cv-open]');
  await page.waitForSelector('[data-cv-sheet="pick"]');
  let t = await page.evaluate(() => document.getElementById('cv-root').innerText);
  ok('okno: nazwa ćwiczenia, trening, odbiorca i zgoda na udostępnienie', /Przysiad goblet/.test(t) && /Nogi/.test(t) && /Film zobaczy tylko Twój trener: Piotr Trener/.test(t) && /udostępniony/.test(t), t);
  ok('okno: nagranie (aparat) albo wybór z telefonu, limit widoczny', await page.locator('[data-cv-capture][capture="environment"]').count() === 1 && await page.locator('[data-cv-file]').count() === 1 && /Do 60 s i 75 MB/.test(t));
  ok('nic nie zostało wysłane przed wyborem i potwierdzeniem', await page.evaluate(() => window.__uploads === 0 && !Object.keys(window.__fs).some((k) => k.startsWith('messages/'))));

  // ---------- Niedozwolony format / za duży / za długi ----------
  await page.setInputFiles('[data-cv-file]', { name: 'trening.avi', mimeType: 'video/x-msvideo', buffer: Buffer.from('xx') });
  await page.waitForSelector('[data-cv-error]');
  t = await page.textContent('[data-cv-error]');
  ok('niedozwolony format: jasny komunikat i „Wybierz inny film”', /format nie jest obsługiwany/.test(t) && await page.locator('text=Wybierz inny film').count() === 1, t);
  const big = await page.evaluate(() => cvValidate({ name: 'a.mp4', type: 'video/mp4', size: 76 * 1024 * 1024 }));
  ok('za duży plik (76 MB > 75 MB): komunikat z rozmiarem i podpowiedzią', /76 MB, a limit to 75 MB/.test(big) && /krótszy/.test(big), big);
  ok('dozwolone: MP4, MOV z iPhone’a (także bez typu), WebM', await page.evaluate(() => !cvValidate({ name: 'a.mp4', type: 'video/mp4', size: 10 }) && !cvValidate({ name: 'IMG_1.MOV', type: 'video/quicktime', size: 10 }) && !cvValidate({ name: 'IMG_2.mov', type: '', size: 10 }) && !cvValidate({ name: 'a.webm', type: 'video/webm', size: 10 })));
  // Prawdziwy krótki film WebM (z płótna), żeby podgląd i długość działały jak na telefonie.
  const webm = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(10), { mimeType: 'video/webm' }); const parts = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; }); rec.start();
    let i = 0; const iv = setInterval(() => { g.fillStyle = i++ % 2 ? '#f00' : '#00f'; g.fillRect(0, 0, 64, 64); }, 50);
    await new Promise((r) => setTimeout(r, 700)); clearInterval(iv); rec.stop(); await done;
    const b = new Blob(parts, { type: 'video/webm' }); return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  const webmBuf = Buffer.from(webm);
  await page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration'); window.__durDesc = d; Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get() { return 75; } }); });
  await page.setInputFiles('[data-cv-file]', { name: 'dlugi.webm', mimeType: 'video/webm', buffer: webmBuf });
  await page.waitForSelector('[data-cv-error]');
  t = await page.textContent('[data-cv-error]');
  ok('za długi film (75 s > 60 s): komunikat, bez wysyłki', /trwa 75 s, a limit to 60 s/.test(t) && await page.evaluate(() => window.__uploads === 0), t);
  await page.evaluate(() => Object.defineProperty(HTMLMediaElement.prototype, 'duration', window.__durDesc));

  // ---------- Podgląd i potwierdzenie ----------
  await page.setInputFiles('[data-cv-file]', { name: 'przysiad.webm', mimeType: 'video/webm', buffer: webmBuf });
  await page.waitForSelector('[data-cv-sheet="preview"]');
  t = await page.evaluate(() => document.getElementById('cv-root').innerText);
  ok('podgląd: film, kontekst, opcjonalna wiadomość, odbiorca, przycisk „Wyślij film trenerowi”', await page.locator('video.cv-preview').count() === 1 && /Przysiad goblet/.test(t) && /opcjonalnie/.test(t) && /Piotr Trener/.test(t) && await page.locator('[data-cv-send]').count() === 1);
  ok('podgląd: nadal nic nie wysłano', await page.evaluate(() => window.__uploads === 0));
  await page.fill('#cv-note', 'Czy kolana idą dobrze?');

  // ---------- Błąd sieci i ponowienie ----------
  await page.evaluate(() => { window.__netFail = true; });
  await page.click('[data-cv-send]');
  await page.waitForSelector('[data-cv-status="error"]');
  t = await page.textContent('[data-cv-status="error"]');
  ok('błąd sieci: czytelny komunikat i „Spróbuj ponownie”', /Nie udało się wysłać filmu/.test(t) && await page.locator('[data-cv-retry]').count() === 1, t);
  ok('błąd sieci: brak wiadomości w czacie', await page.evaluate(() => !Object.keys(window.__fs).some((k) => k.startsWith('messages/'))));
  await page.evaluate(() => { window.__netFail = false; });
  await page.click('[data-cv-retry]');
  await page.waitForSelector('[data-cv-status="sent"]');
  t = await page.evaluate(() => document.getElementById('cv-root').innerText);
  ok('ponowienie: „Wysłano”, bez udawania powiadomienia push', /Wysłano/.test(t) && /Powiadomienie na telefon dostanie tylko wtedy, gdy włączył je u siebie/.test(t), t);
  const sent = await page.evaluate(() => {
    const files = Object.keys(window.__st); const msgs = Object.values(window.__fs).filter((v) => v && v.text && /Film techniki/.test(v.text));
    return { files, meta: files[0] && window.__st[files[0]].meta, msg: msgs[0], n: msgs.length, publicUrl: !!window.__publicUrlRequested };
  });
  ok('plik w prywatnej ścieżce client-videos/{trener}/{klient}/', sent.files.length === 1 && /^client-videos\/cs-trainer\/c1\/v_[A-Za-z0-9_-]+\.webm$/.test(sent.files[0]) && sent.meta.contentType === 'video/webm', JSON.stringify(sent.files));
  ok('wiadomość w istniejącym czacie: ćwiczenie, trening, notatka, znacznik pliku; jedna', sent.n === 1 && /Przysiad goblet/.test(sent.msg.text) && /Trening: Nogi/.test(sent.msg.text) && /Czy kolana idą dobrze\?/.test(sent.msg.text) && /\[film:v_[^\]]+\.webm\]/.test(sent.msg.text) && sent.msg.clientId === 'c1' && sent.msg.trainerId === 'cs-trainer' && sent.msg.out === false, JSON.stringify(sent.msg));
  ok('bez publicznego adresu: brak getDownloadURL i brak http w wiadomości', !sent.publicUrl && !/https?:/.test(sent.msg.text));
  ok('wiadomość ma tylko pola dozwolone w regułach czatu', Object.keys(sent.msg).every((k) => ['id', 'trainerId', 'clientId', 'text', 'out', 'kind', 'time', 'createdAt'].includes(k)), Object.keys(sent.msg).join());
  await page.click('#cv-root .cs-btn-primary');

  // ---------- Brak połączenia → wysyłka po powrocie ----------
  await page.evaluate(() => cvOpen());
  await page.setInputFiles('[data-cv-file]', { name: 'drugi.webm', mimeType: 'video/webm', buffer: webmBuf });
  await page.waitForSelector('[data-cv-send]');
  await ctx.setOffline(true);
  await page.click('[data-cv-send]');
  await page.waitForSelector('[data-cv-status="waiting"]');
  ok('offline: „Oczekuje na połączenie”, nic nie wysłane', /Oczekuje na połączenie/.test(await page.textContent('[data-cv-status="waiting"]')) && await page.evaluate(() => Object.keys(window.__st).length === 1));
  await ctx.setOffline(false);
  await page.waitForSelector('[data-cv-status="sent"]');
  ok('po powrocie sieci film wysłał się sam (klient już potwierdził)', await page.evaluate(() => Object.keys(window.__st).length === 2 && Object.values(window.__fs).filter((v) => v && /Film techniki/.test(v.text || '')).length === 2));
  await page.click('#cv-root .cs-btn-primary');

  // ---------- Czat klienta ----------
  await page.evaluate(() => { cwClose(true); setClientLiveScreen('messages'); });
  await page.waitForTimeout(200);
  t = await page.evaluate(() => document.getElementById('screen-clientlive').innerText);
  ok('czat klienta: tekst bez znacznika, karta filmu z „Usuń film”', /Film techniki: Przysiad goblet/.test(t) && !/\[film:/.test(t) && await page.locator('#screen-clientlive .cv-card [data-act="cv-del"]').count() === 2, t.slice(0, 400));

  // ---------- Widok trenera ----------
  await page.evaluate(() => {
    window._clientAppMode = false; window._uid = 'cs-trainer';
    document.getElementById('clive-player').hidden = true;
    const scr = document.getElementById('screen-inbox'); document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); if (scr) scr.classList.add('active');
    document.body.insertAdjacentHTML('beforeend', '<div id="cv-host" style="position:fixed;inset:0;overflow:auto;z-index:99999;background:#fff;padding:8px"></div>');
    openChat('c1');
    const wrap = document.getElementById('msg-wrap'); document.getElementById('cv-host').appendChild(wrap);
  });
  t = await page.evaluate(() => document.getElementById('msg-wrap').innerText);
  ok('czat trenera: film z nazwą ćwiczenia i treningiem, bez znacznika', /Film techniki: Przysiad goblet/.test(t) && /Trening: Nogi/.test(t) && !/\[film:/.test(t) && await page.locator('#msg-wrap .cv-card').count() === 2, t.slice(0, 400));
  await page.click('#msg-wrap .cv-card >> nth=0 >> [data-act="cv-play"]');
  await page.waitForTimeout(300);
  if (process.env.CV_DEBUG) console.log(await page.evaluate(() => document.querySelector('#msg-wrap .cv-card').outerHTML));
  await page.waitForSelector('#msg-wrap .cv-card video', { state: 'attached' });
  ok('trener odtwarza film przez getBlob (adres blob: w pamięci, nie publiczny URL)', await page.evaluate(() => /^blob:/.test(document.querySelector('#msg-wrap .cv-card video').src) && !window.__publicUrlRequested));
  await page.evaluate(() => { window.__denyRead = true; window._cvUrls = {}; });
  await page.click('#msg-wrap .cv-card >> nth=1 >> [data-act="cv-play"]');
  await page.waitForSelector('#msg-wrap .cv-card >> nth=1 >> .cv-err');
  ok('odmowa dostępu (inne konto): „Brak dostępu do tego filmu”, bez odtwarzania', /Brak dostępu/.test(await page.textContent('#msg-wrap .cv-card >> nth=1 >> .cv-err')));
  await page.evaluate(() => { window.__denyRead = false; });
  ok('trener odpowiada w istniejącym czacie (pole wiadomości obecne)', await page.locator('#msg-inp').count() === 1);

  // ---------- Usuwanie ----------
  await page.click('#msg-wrap .cv-card >> nth=0 >> [data-act="cv-del"]');
  ok('usuwanie: najpierw potwierdzenie', /Usunąć ten film\?/.test(await page.textContent('#msg-wrap .cv-card >> nth=0')) && await page.evaluate(() => Object.keys(window.__st).length === 2));
  await page.click('#msg-wrap [data-sure="1"]');
  await page.waitForTimeout(150);
  ok('usuwanie: plik usunięty, karta „Film został usunięty”', await page.evaluate(() => Object.keys(window.__st).length === 1 && /Film został usunięty/.test(document.getElementById('msg-wrap').innerText)));
  await page.evaluate(() => { delete window.__st[Object.keys(window.__st)[0]]; window._cvDeleted = {}; window._cvUrls = {}; openChat('c1'); const wrap = document.getElementById('msg-wrap'); document.getElementById('cv-host').appendChild(wrap); });
  await page.click('#msg-wrap .cv-card >> nth=1 >> [data-act="cv-play"]');
  await page.waitForTimeout(150);
  ok('film usunięty po drugiej stronie: przy odtwarzaniu „Film został usunięty”', await page.evaluate(() => (document.getElementById('msg-wrap').innerText.match(/Film został usunięty/g) || []).length >= 1));
  ok('nazwy plików z bazy bez onclick (data-act)', await page.evaluate(() => !/onclick="[^"]*v_/.test(document.getElementById('msg-wrap').innerHTML)));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Film techniki od klienta do trenera (atrapa Storage) — OK');
})().catch((e) => { console.error(e); process.exit(1); });
