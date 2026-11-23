#!/usr/bin/env node
'use strict';
/**
 * Zapis i synchronizacja treningu klienta (390 × 844, Chromium) na ATRAPIE Firestore w pamięci strony.
 * To nie jest dowód działania produkcyjnego Firebase — sprawdza logikę aplikacji:
 * brak internetu → zapis na telefonie i jasny komunikat, powrót internetu → synchronizacja,
 * błąd zapisu na serwerze → dane zostają lokalnie, konflikt (cudzy dokument) → dane zostają lokalnie,
 * zamknięcie i ponowne otwarcie aplikacji → wznowienie treningu i ponowna wysyłka.
 */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-sync';

// Atrapa Firestore: magazyn w localStorage (przetrwa „zamknięcie aplikacji” = przeładowanie strony),
// tryby awarii sterowane z testu. Żadnych prawdziwych danych ani sieci.
async function boot(page, { keepStorage } = {}) {
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((keep) => {
    if (!keep) { try { localStorage.clear(); } catch (e) {} }
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-sync' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    const KEY = '__fakeFs';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
    const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
    window.__fail = window.__fail || null; // null | 'write' | 'network'
    window.__writes = 0;
    window._doc = (_db, col, id) => ({ col, id });
    window._getDoc = async (ref) => {
      if (window.__fail === 'network') { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
      const d = load()[ref.col + '/' + ref.id];
      return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) };
    };
    window.persistById = async (col, o) => {
      window.__writes++;
      if (window.__fail) return null; // zapis nie potwierdzony (np. odmowa reguł, timeout)
      const s = load(); const copy = JSON.parse(JSON.stringify(o)); delete copy._fbId; s[col + '/' + o.id] = copy; save(s); return o;
    };
    window.__server = () => load();
    const today = todayYmd(); const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 3, 12, 18)] }] }];
    const fs = load();
    window.SE = Object.entries(fs).filter(([k]) => k.startsWith('sessions/')).map(([, v]) => v);
    window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, !!keepStorage);
  await page.waitForSelector('.cs-today');
}

async function saveSet(page, reps) {
  await page.evaluate(() => { if (window._cw && window._cw.phase !== 'exercise') { try { cwSkipRest(); } catch (e) {} if (window._cw.phase !== 'exercise') { window._cw.phase = 'exercise'; cwRender(); } } });
  await page.waitForTimeout(750); // blokada podwójnego dotknięcia po zapisie
  if (process.env.SYNC_DEBUG) console.log(await page.evaluate(() => [window._cw.phase, [...document.querySelectorAll('input[aria-label]')].map(i => i.getAttribute('aria-label') + (i.disabled ? '(d)' : ''))].join(' ')));
  await page.fill('input[aria-label^="Seria"][aria-label$="powtórzenia"]:not([disabled])', String(reps));
  await page.click('.cs-ex-foot [data-cs-primary="save"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => { try { clearInterval(window._cwRestTimer); } catch (e) {} });
}
const syncText = (page) => page.evaluate(() => { const e = document.querySelector('[data-cw-sync-visible]'); return e && e.offsetParent ? e.textContent : ''; });
const draft = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem(cwDraftKey()) || 'null'); } catch (e) { return null; } });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  try {
    await boot(page);
    await page.click('.cs-today .cs-btn-primary');
    await page.waitForSelector('.cs-ex');

    // 1. Brak internetu: seria zapisana na telefonie, komunikat „oczekuje na synchronizację”, nic nie idzie na serwer.
    await ctx.setOffline(true);
    const w0 = await page.evaluate(() => window.__writes);
    await saveSet(page, 10);
    await page.evaluate(() => cwSkipRestTap && cwSkipRestTap());
    await page.waitForTimeout(800);
    let d = await draft(page);
    const s1 = await page.evaluate(() => ({ sync: window._cw.syncState, writes: window.__writes, txt: cwSyncStateText(window._cw) }));
    ok('offline: seria zapisana lokalnie', d && d.state && d.state.exercises[0].sets[0].done === true && String(d.state.exercises[0].sets[0].reps) === '10', JSON.stringify(d && d.state && d.state.exercises[0].sets[0]));
    ok('offline: status „Zapisano na urządzeniu · oczekuje na synchronizację”', s1.sync === 'local' && /oczekuje na synchronizację/.test(s1.txt), JSON.stringify(s1));
    ok('offline: brak prób zapisu na serwer', s1.writes === w0, JSON.stringify(s1));

    // 2. Powrót internetu: automatyczna synchronizacja (zdarzenie „online”), dokument na serwerze ma serię.
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => window._cw && window._cw.syncState === 'synced', null, { timeout: 5000 }).catch(() => {});
    let srv = await page.evaluate(() => Object.values(window.__server()).find((x) => x.source === 'client'));
    ok('online: synchronizacja po powrocie internetu', await page.evaluate(() => window._cw.syncState) === 'synced' && srv && srv.confirmedSets === 1, JSON.stringify(srv && { c: srv.confirmedSets, st: srv.status }));
    ok('online: status „Zsynchronizowano”', /Zsynchronizowano/.test(await page.evaluate(() => cwSyncStateText(window._cw))));

    // 3. Błąd zapisu na serwerze (np. odmowa, timeout): seria zostaje na telefonie, status nie udaje synchronizacji.
    await page.evaluate(() => { window.__fail = 'write'; });
    await saveSet(page, 9);
    await page.evaluate(() => cwSkipRestTap && cwSkipRestTap());
    await page.waitForTimeout(800);
    d = await draft(page);
    const s3 = await page.evaluate(() => ({ sync: window._cw.syncState, txt: cwSyncStateText(window._cw) }));
    srv = await page.evaluate(() => Object.values(window.__server()).find((x) => x.source === 'client'));
    ok('błąd zapisu: dwie serie na telefonie, serwer ma nadal jedną', d.state.exercises[0].sets.filter((x) => x.done).length === 2 && srv.confirmedSets === 1, JSON.stringify({ local: d.state.exercises[0].sets.map((x) => x.done), srv: srv.confirmedSets }));
    ok('błąd zapisu: status „oczekuje na synchronizację”, nie „Zsynchronizowano”', s3.sync === 'local' && !/Zsynchronizowano/.test(s3.txt), JSON.stringify(s3));
    await page.evaluate(() => { try { cwSkipRest(); } catch (e) {} if (window._cw.phase !== 'exercise') { window._cw.phase = 'exercise'; } cwRender(); });
    const vis = await page.evaluate(() => { const e = document.querySelector('[data-cw-sync-visible]'); return { phase: window._cw.phase, has: !!e, shown: !!(e && e.offsetParent), t: e && e.textContent }; });
    ok('błąd zapisu: komunikat widoczny na ekranie ćwiczenia (poza zwiniętą listą)', vis.shown && /oczekuje na synchronizację/.test(vis.t), JSON.stringify(vis));

    // 4. „Zamknięcie aplikacji” (przeładowanie) przy wciąż niedziałającym serwerze: dane nie znikają, trening do wznowienia.
    await page.close();
    page = await ctx.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (dl) => dl.dismiss());
    await boot(page, { keepStorage: true });
    await page.evaluate(() => { window.__fail = 'write'; });
    d = await draft(page);
    const home = await page.evaluate(() => document.querySelector('.cs-today').innerText);
    ok('po zamknięciu: lokalny zapis istnieje (2 serie)', d && d.state.exercises[0].sets.filter((x) => x.done).length === 2);
    ok('po zamknięciu: „Trening w toku” z liczbą serii i „na telefonie”', /TRENING W TOKU/i.test(home) && /2 serie/.test(home) && /na telefonie/.test(home), home.slice(0, 300));

    // 5. Wznowienie po zamknięciu i naprawie serwera: te same serie, wysyłka zaległego zapisu bez duplikatu sesji.
    await page.evaluate(() => { window.__fail = null; });
    await page.evaluate(() => cwFlushLocal());
    await page.waitForTimeout(300);
    srv = await page.evaluate(() => Object.values(window.__server()).filter((x) => x.source === 'client'));
    ok('po naprawie: zaległy zapis wysłany, nadal jedna sesja (bez duplikatu)', srv.length === 1 && srv[0].confirmedSets === 2, JSON.stringify(srv.map((x) => [x.id, x.confirmedSets])));
    await page.click('.cs-today .cs-btn-primary');
    await page.waitForSelector('.cs-ex, .cw-overview, #clive-player:not([hidden])');
    const resumed = await page.evaluate(() => ({ id: window._cw.sessionId, done: window._cw.exercises[0].sets.filter((x) => x.done).length, notes: window._notes.join(' | ') }));
    ok('wznowienie: ta sama sesja i 2 zapisane serie', resumed.id === srv[0].id && resumed.done === 2, JSON.stringify(resumed));
    ok('wznowienie: komunikat o wznowieniu', /wznowiono trening/.test(resumed.notes), resumed.notes);

    // 6. Konflikt: na serwerze dokument o tym id należy do innego trenera — zapis odrzucony, dane zostają lokalnie.
    await page.evaluate(() => {
      const s = window.__server(); const k = Object.keys(s).find((x) => x.startsWith('sessions/'));
      s[k] = { ...s[k], trainerId: 'inny-trener' }; localStorage.setItem('__fakeFs', JSON.stringify(s));
    });
    const conflict = await page.evaluate(async () => { const r = await cwPersist(window._cw, 'in_progress'); return { r, sync: window._cw.syncState, local: !!localStorage.getItem(cwDraftKey()) }; });
    ok('konflikt: zapis odrzucony, dane lokalne zostają, brak „Zsynchronizowano”', conflict.r === false && conflict.local && conflict.sync !== 'synced', JSON.stringify(conflict));

    // 7. Brak pamięci telefonu (np. tryb prywatny / pełna pamięć): jasny błąd zamiast cichej utraty.
    const noStore = await page.evaluate(() => {
      const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
      const cw = { ...window._cw }; const r = cwWriteLocal(cw); Storage.prototype.setItem = orig;
      return { r, sync: cw.syncState, txt: cwSyncStateText(cw) };
    });
    ok('pełna pamięć: status „Nie potwierdzono zapisu”', noStore.r === false && noStore.sync === 'error' && /Nie potwierdzono zapisu/.test(noStore.txt), JSON.stringify(noStore));

    ok('bez błędów JS', !errors.length, errors.join(' | '));
  } finally { await browser.close(); }
  if (failed) { console.error(failed + ' błąd(ów)'); process.exit(1); }
  console.log('Zapis i synchronizacja treningu klienta (atrapa Firestore): OK');
})().catch((e) => { console.error(e); process.exit(1); });
