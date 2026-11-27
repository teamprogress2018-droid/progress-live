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
  ok('RIR in plain words', /2–3 powtórzenia w zapasie/.test(txt) && !/RIR/.test(txt));
  await page.click('[data-cs-rir-toggle]');
  ok('RIR answers (after opening the optional question)', (await page.locator('.cs-rir-opts button').allInnerTexts()).join('|') === '0|1|2|3|4+');
  ok('„Historia” w nagłówku i „Jak wykonać ćwiczenie?”', /Historia/.test(txt) && /Jak wykonać ćwiczenie\?/.test(txt) && !/Pomoc \/ Technika/.test(txt));
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
    const next = document.querySelector('.cs-rest-next'); const skip = [...document.querySelectorAll('#clive-player-inner button')].find((b) => /Pomiń przerwę/.test(b.textContent));
    const cs = getComputedStyle(next);
    return { next: next.innerText.replace(/\s*\n\s*/g, ' | ').trim(), fs: parseFloat(cs.fontSize), color: cs.color, skipPrimary: skip.classList.contains('cs-btn-primary') || skip.classList.contains('cap-btn-primary'), skipSecondary: skip.classList.contains('cs-btn-secondary'),
      timer: document.getElementById('cw-rest-num').getAttribute('role'), live: document.getElementById('cw-rest-num').getAttribute('aria-live'), polite: document.getElementById('cw-rest-live').getAttribute('aria-live') };
  });
  ok('rest: next set with exercise, set, reps, kg', rest.next === 'NASTĘPNA SERIA | Wyciskanie hantli | Seria 2 z 4 · 10 powt. · 70 kg', rest.next);
  ok('rest: 17 px dark text', rest.fs >= 17 && rest.color === 'rgb(32, 36, 43)', JSON.stringify(rest));
  ok('rest: "Pomiń przerwę" is secondary', rest.skipSecondary && !rest.skipPrimary);
  ok('rest: role=timer, no per-second announcements', rest.timer === 'timer' && rest.live !== 'assertive' && rest.polite === 'polite');
  const ann = await page.evaluate(() => { cwRestAnnounce(11); const a = document.getElementById('cw-rest-live').textContent; cwRestAnnounce(10); const b = document.getElementById('cw-rest-live').textContent; return [a, b]; });
  ok('rest: announces at 10 s only', ann[0] === '' && /10 sekund/.test(ann[1]), JSON.stringify(ann));
  // Cel trenera oddzielony od wyniku, poprzedni wynik nad polami (gdy jest historia), przerwa ±15 s i pasek przerwy na ekranie ćwiczenia.
  const adj = await page.evaluate(() => { const before = window._cw.restLeft; window._cwRestTimer = setInterval(() => {}, 1e6); cwRestAdd(30); const up = window._cw.restLeft; cwRestAdd(-30); cwRestAdd(-999); return { before, up, min: window._cw.restLeft, txt: document.getElementById('cw-rest-num').textContent, btns: [...document.querySelectorAll('.cs-rest-adj button')].map(b => b.innerText) }; });
  ok('rest: −15 s / Wstrzymaj / +30 s change the countdown (min 5 s)', adj.up === adj.before + 30 && adj.min === 5 && adj.txt === '5 s' && adj.btns.join('|') === '−15 s|Wstrzymaj|+30 s', JSON.stringify(adj));
  await page.click('.cs-rest-edit');
  const bar = await page.evaluate(() => { const b = document.querySelector('.cs-restbar'); return { phase: window._cw.phase, bar: !!b, text: b && b.innerText.replace(/\s+/g, ' '), input: !!document.querySelector('input[aria-label="Seria 2: ciężar"]'), result: (document.querySelector('.cs-result-h') || {}).textContent || '' }; });
  ok('rest → edit next set: exercise screen with rest bar, fields editable', bar.phase === 'exercise' && bar.bar && /Przerwa 5 s/.test(bar.text) && bar.input, JSON.stringify(bar));
  ok('result fields labelled „Twój wynik”', /^Twój wynik/.test(bar.result), bar.result);
  await page.waitForTimeout(800); // blokada podwójnego dotknięcia po zapisie (700 ms)
  await page.click('.cs-restbar-btn >> text=Koniec');
  ok('rest bar „Koniec” ends the rest', await page.evaluate(() => !window._cwRestTimer && !document.querySelector('.cs-restbar') && window._cw.phase === 'exercise'));
  await page.evaluate(() => { window._cw.exercises[0].lastSets = [{ reps: '9', kg: '67.5' }]; cwRender(); });
  // Wariant C: plan jest wpisany w pola, ostatni trening — pod „Historia” (bez powielonych kafelków nad polami).
  const gp = await page.evaluate(() => ({ tiles: !!document.querySelector('.cs-ex [data-cs-prev], .cs-ex .cs-goal-prev') }));
  await page.click('[data-cs-history]');
  const hl = await page.evaluate(() => (document.querySelector('.cs-sheet [data-cs-hist-last]') || {}).innerText || '');
  ok('last workout in „Historia”, not duplicated above the fields', !gp.tiles && /Ostatni trening/.test(hl) && /9 × 67,5 kg/.test(hl), JSON.stringify({ gp, hl }));
  await page.click('.cs-sheet [data-cs-sheet-first]');

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
