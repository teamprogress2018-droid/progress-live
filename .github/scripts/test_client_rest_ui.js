#!/usr/bin/env node
'use strict';
/** UI (Etap 6 UX): przerwa i koniec treningu klienta w prostym stylu, pola serii z ramką, błąd pod polem, wibracja po przerwie. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(20000);
  page.on('dialog', (d) => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-rest', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-rest' };
    window.persistById = async (_c, o) => o; window._notes = []; window.notify = (m) => window._notes.push(m);
    window._vib = []; try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window._vib.push(p); return true; } }); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    const today = todayYmd(); const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 4, 10, 70), ex('Wiosłowanie', 3, 12, 18)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  });
  await page.waitForSelector('.cs-today');
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');

  const txt = await page.textContent('.cs-ex');
  ok('RIR in plain words', /zostaw w zapasie 2–3 powtórzenia/.test(txt) && !/cel RIR/.test(txt));
  ok('RIR answers', (await page.locator('.cs-rir-opts button').allInnerTexts()).join('|') === 'Ledwo (0)|1–2|3–4|Nie wiem');
  ok('"Wskazówki i historia" link', /Wskazówki i historia/.test(txt) && !/Pomoc \/ Technika/.test(txt));
  const inp = await page.$eval('input[aria-label="Seria 1: powtórzenia"]', (e) => { const cs = getComputedStyle(e); return { h: e.getBoundingClientRect().height, bw: cs.borderTopWidth, bc: cs.borderTopColor }; });
  // Chromium zaokrągla obramowanie w getComputedStyle do pełnych px, więc 1,5 px sprawdzamy w arkuszu stylów.
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'client-simple.css'), 'utf8');
  ok('set field: 64 px with full frame #6b7280', inp.h >= 64 && parseFloat(inp.bw) >= 1 && inp.bc === 'rgb(107, 114, 128)' && /\.cs-num input \{ min-height: 64px;[^}]*border: 1\.5px solid var\(--border-strong/.test(css), JSON.stringify(inp));

  await page.fill('input[aria-label="Seria 1: powtórzenia"]', '');
  await page.dispatchEvent('input[aria-label="Seria 1: powtórzenia"]', 'input');
  await page.click('.cs-ex-foot [data-cs-primary="save"]');
  await page.waitForTimeout(100);
  const err = await page.evaluate(() => { const e = document.getElementById('cs-set-err'); const i = document.querySelector('input[aria-label="Seria 1: powtórzenia"]'); return { text: e && e.textContent, role: e && e.getAttribute('role'), inv: i.getAttribute('aria-invalid') }; });
  ok('missing reps: error stays under the field', err.role === 'alert' && /Wpisz liczbę powtórzeń/.test(err.text || '') && err.inv === 'true', JSON.stringify(err));
  await page.fill('input[aria-label="Seria 1: powtórzenia"]', '10');
  ok('typing clears the error', await page.locator('#cs-set-err').count() === 0);

  await page.click('.cs-ex-foot [data-cs-primary="save"]');
  await page.waitForSelector('.cw-rest');
  await page.evaluate(() => clearInterval(window._cwRestTimer));
  const rest = await page.evaluate(() => {
    const next = document.querySelector('.cs-rest-next'); const skip = [...document.querySelectorAll('.cw-rest button')].find((b) => /Pomiń przerwę/.test(b.textContent));
    const cs = getComputedStyle(next);
    return { next: next.textContent.trim(), fs: parseFloat(cs.fontSize), color: cs.color, skipPrimary: skip.classList.contains('cs-btn-primary') || skip.classList.contains('cap-btn-primary'), skipSecondary: skip.classList.contains('cs-btn-secondary'),
      timer: document.getElementById('cw-rest-num').getAttribute('role'), live: document.getElementById('cw-rest-num').getAttribute('aria-live'), polite: document.getElementById('cw-rest-live').getAttribute('aria-live') };
  });
  ok('rest: "Następna: exercise, set, kg"', rest.next === 'Następna: Wyciskanie hantli, seria 2 z 4, 70 kg', rest.next);
  ok('rest: 17 px dark text', rest.fs >= 17 && rest.color === 'rgb(17, 24, 39)', JSON.stringify(rest));
  ok('rest: "Pomiń przerwę" is secondary', rest.skipSecondary && !rest.skipPrimary);
  ok('rest: role=timer, no per-second announcements', rest.timer === 'timer' && rest.live !== 'assertive' && rest.polite === 'polite');
  const ann = await page.evaluate(() => { cwRestAnnounce(11); const a = document.getElementById('cw-rest-live').textContent; cwRestAnnounce(10); const b = document.getElementById('cw-rest-live').textContent; return [a, b]; });
  ok('rest: announces at 10 s only', ann[0] === '' && /10 sekund/.test(ann[1]), JSON.stringify(ann));
  await page.evaluate(() => { window._cw.restLeft = 1; window._cwRestTimer = setInterval(() => {}, 1e6); clearInterval(window._cwRestTimer); cwStartRest(1); });
  await page.waitForTimeout(1300);
  ok('rest end: vibration', await page.evaluate(() => window._vib.length > 0), await page.evaluate(() => JSON.stringify(window._vib)));
  ok('rest end: back to exercise', await page.evaluate(() => window._cw.phase === 'exercise'));

  await page.evaluate(() => { const c = window._cw; c.phase = 'finish'; c.finishPrompt = true; cwRender(); });
  await page.waitForTimeout(100);
  const fin = await page.textContent('#clive-player-inner');
  ok('finish prompt: sentence case and "Zakończ teraz"', /Zakończyć trening\?/.test(fin) && !/ZAKOŃCZYĆ/.test(fin) && /Zakończ teraz/.test(fin) && !/częściowo wykonany/.test(fin), fin.slice(0, 200));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('All client rest UX tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
