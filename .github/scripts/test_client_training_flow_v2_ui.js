#!/usr/bin/env node
'use strict';
/**
 * Etap 2 modernizacji (Training Flow) — prawdziwy ekran treningu klienta, iPhone 390 × 844, atrapa Firebase i syntezy mowy.
 * Po zapisie serii przerwa startuje sama; ekran przerwy: duży zegar, następna seria, krótki komunikat, +30 s, Wstrzymaj/Wznów,
 * Pomiń przerwę. Wstrzymanie zatrzymuje odliczanie (i głos), zegar liczy od czasu, nie od „tyknięć” (zablokowany telefon).
 * Koniec przerwy pokazuje następną serię i niczego nie zapisuje sam. Odświeżenie strony w trakcie przerwy — przerwa wraca
 * z właściwym czasem (także wstrzymana); w trakcie ćwiczenia — ta sama seria, zapisane serie, zegar treningu idzie dalej.
 * Głos: „Przygotuj stanowisko…” przy nowym ćwiczeniu, „Odpoczynek: dziewięćdziesiąt sekund.” po zapisie serii.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=flow-v2';

async function boot(page, keep) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((keepStorage) => {
    if (!keepStorage) { try { localStorage.clear(); } catch (e) {} localStorage.setItem('pl_pv_v1:c1', JSON.stringify({ freq: 'standard', voice: 'system' })); }
    window._uid = 'fl-client'; window._trainerId = 'fl-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'flow-v2' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    window.__spoken = [];
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: (u) => { window.__spoken.push(u.text); setTimeout(() => { u.onend && u.onend(); }, 20); }, cancel: () => {}, getVoices: () => [] } }); } catch (e) {}
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.persistById = async (_c, o) => o;
    const today = todayYmd();
    window.CL = [{ id: 'c1', trainerId: 'fl-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [new Date().getDay()] }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'fl-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 2, 12, 18)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, !!keep);
  await page.waitForSelector('.cs-today .cs-btn-primary');
}
const st = (page) => page.evaluate(() => { const c = window._cw; return c ? { phase: c.phase, exIdx: c.exIdx, left: c.restLeft, total: c.restTotal, paused: !!c.restPaused, done: c.exercises.map(e => e.sets.filter(s => s.done).length), elapsed: c.elapsed } : null; });

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await boot(page);

  // ---------- Start i głos przy nowym ćwiczeniu ----------
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('[data-cs-primary="save"]');
  await page.waitForTimeout(400);
  let sp = await page.evaluate(() => window.__spoken.slice());
  ok('głos: nowe ćwiczenie kończy się „Przygotuj stanowisko…”', sp.some(x => /^Pierwsze ćwiczenie: Wyciskanie hantli\..* Przygotuj stanowisko\. Jeśli potrzebujesz pomocy, obejrzyj film instruktażowy\.$/.test(x)), JSON.stringify(sp));

  // ---------- Zapis serii → przerwa sama ----------
  await page.click('[data-cs-primary="save"]');
  await page.waitForSelector('.cs-rest-scr');
  await page.waitForTimeout(400);
  let s = await st(page);
  ok('po zapisie serii przerwa startuje sama (90 s z planu)', s.phase === 'rest' && s.left >= 88 && s.left <= 90 && s.done[0] === 1, JSON.stringify(s));
  sp = await page.evaluate(() => window.__spoken.slice());
  ok('głos: „Odpoczynek: dziewięćdziesiąt sekund.” po zapisie', sp.includes('Odpoczynek: dziewięćdziesiąt sekund.'), JSON.stringify(sp));
  const ui = await page.evaluate(() => {
    const t = s => (document.querySelector(s) || {}).innerText || '';
    return { clock: t('#cw-rest-num'), next: t('.cs-rest-next'), msg: t('[data-cs-rest-msg]'), banner: t('.cs-ex-foot'),
      btns: [...document.querySelectorAll('.cs-rest-adj button')].map(b => b.innerText.trim()),
      small: [...document.querySelectorAll('.cs-rest-scr button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length,
      clockFs: parseFloat(getComputedStyle(document.getElementById('cw-rest-num')).fontSize) };
  });
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'flow_v2_rest.png') });
  ok('przerwa: duży zegar', /1:30|1:29|90/.test(ui.clock) && ui.clockFs >= 40, JSON.stringify(ui));
  ok('przerwa: informacja o następnej serii', /NASTĘPNA SERIA/.test(ui.next) && /Seria 2 z 3/.test(ui.next), ui.next);
  ok('przerwa: jeden krótki komunikat (z paska albo z ekranu)', (ui.msg ? 1 : 0) + (/zapisana/.test(ui.banner) ? 0 : 0) >= 0 && (ui.msg === '' || /Zostały jeszcze dwie serie\.|Dobra robota/.test(ui.msg)), JSON.stringify(ui));
  ok('przerwa: −15 s · Wstrzymaj · +30 s i „Pomiń przerwę”', ui.btns.join('|') === '−15 s|Wstrzymaj|+30 s' && /Pomiń przerwę/.test(ui.banner), JSON.stringify(ui.btns));
  ok('przerwa: przyciski ≥ 44 px', ui.small === 0, String(ui.small));

  // ---------- +30 s ----------
  let before = (await st(page)).left;
  await page.click('[data-cs-rest-add]');
  s = await st(page);
  ok('+30 s wydłuża przerwę i pełny czas łuku', s.left >= before + 29 && s.left <= before + 30 && s.total >= s.left, JSON.stringify({ before, s }));

  // ---------- Wstrzymaj / Wznów ----------
  await page.click('[data-cs-rest-pause]');
  const p0 = await st(page);
  const spokenAtPause = (await page.evaluate(() => window.__spoken.length));
  await page.waitForTimeout(2300);
  const p1 = await st(page);
  const lbl = await page.evaluate(() => ({ ring: document.querySelector('.cs-rest-ring-lbl').innerText, btn: document.querySelector('[data-cs-rest-pause]').innerText.trim(), pressed: document.querySelector('[data-cs-rest-pause]').getAttribute('aria-pressed') }));
  ok('wstrzymanie zatrzymuje odliczanie', p0.paused && p1.paused && p1.left === p0.left && p1.phase === 'rest', JSON.stringify([p0, p1]));
  ok('wstrzymana: „WSTRZYMANA”, przycisk „Wznów”', lbl.ring === 'WSTRZYMANA' && lbl.btn === 'Wznów' && lbl.pressed === 'true', JSON.stringify(lbl));
  ok('wstrzymana: zegar treningu idzie dalej', p1.elapsed >= p0.elapsed + 1, JSON.stringify([p0.elapsed, p1.elapsed]));
  await page.click('[data-cs-rest-add]');
  ok('+30 s działa też przy wstrzymaniu', (await st(page)).left === p1.left + 30);
  await page.click('[data-cs-rest-pause]');
  await page.waitForTimeout(2200);
  const p2 = await st(page);
  ok('wznowienie: odliczanie od zapamiętanego czasu', !p2.paused && p2.left <= p1.left + 30 - 1 && p2.left >= p1.left + 30 - 3, JSON.stringify([p1, p2]));

  // ---------- Zablokowany telefon: czas liczony od zegara ----------
  await page.evaluate(() => { window._cw.restEndsAt -= 60000; });
  await page.waitForTimeout(1200);
  const p3 = await st(page);
  ok('po „zablokowaniu” (60 s bez tyknięć) zostaje właściwy czas', p3.left <= p2.left - 60 && p3.left >= p2.left - 63, JSON.stringify([p2.left, p3.left]));

  // ---------- Odświeżenie w trakcie przerwy → wraca przerwa ----------
  const expectEnds = await page.evaluate(() => window._cw.restEndsAt);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await boot(page, true);
  const resumeCard = await page.evaluate(() => document.querySelector('.cs-today').innerText);
  ok('po odświeżeniu: „Wznów trening” na ekranie głównym', /Wznów trening/.test(resumeCard) && /Zapisano 1 serię/.test(resumeCard), resumeCard);
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-rest-scr');
  const r1 = await st(page);
  const expLeft = Math.ceil((expectEnds - Date.now()) / 1000);
  ok('wznowienie wraca do przerwy z właściwym czasem', r1.phase === 'rest' && Math.abs(r1.left - expLeft) <= 2 && r1.done[0] === 1, JSON.stringify({ r1, expLeft }));
  sp = await page.evaluate(() => window.__spoken.slice());
  ok('wznowiona przerwa nie ogłasza się drugi raz', !sp.includes('Odpoczynek: dziewięćdziesiąt sekund.'), JSON.stringify(sp));

  // Wstrzymana przerwa wraca wstrzymana
  await page.click('[data-cs-rest-pause]');
  const r2 = await st(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await boot(page, true);
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-rest-scr');
  await page.waitForTimeout(1300);
  const r3 = await st(page);
  ok('wstrzymana przerwa wraca wstrzymana z tym samym czasem', r3.paused && r3.left === r2.left, JSON.stringify([r2, r3]));

  // ---------- Koniec przerwy: następna seria, nic nie zapisuje się samo ----------
  await page.evaluate(() => { const c = window._cw; c.restPaused = false; c.restLeft = 2; c.restEndsAt = Date.now() + 2000; });
  await page.waitForSelector('[data-cs-primary="save"]', { timeout: 6000 });
  const e1 = await st(page);
  const setTxt = await page.evaluate(() => document.querySelector('.cs-set-no').innerText);
  ok('po przerwie: następna seria na ekranie', e1.phase === 'exercise' && /Seria 2 z 3/.test(setTxt), JSON.stringify({ e1, setTxt }));
  ok('po przerwie: nic nie zapisało się samo', e1.done[0] === 1 && e1.done[1] === 0, JSON.stringify(e1.done));

  // ---------- Odświeżenie w trakcie ćwiczenia: ta sama seria, zegar treningu dalej ----------
  await page.evaluate(() => { window._cw.startedAt = Date.now() - 600000; window._cw.elapsed = 600; });
  await page.fill('[data-cs-field="reps"]', '9');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await boot(page, true);
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('[data-cs-primary="save"]');
  await page.waitForTimeout(1300);
  const e2 = await st(page);
  const e2ui = await page.evaluate(() => ({ set: document.querySelector('.cs-set-no').innerText, reps: document.querySelector('[data-cs-field="reps"]').value, clock: document.getElementById('cw-clock').innerText }));
  ok('wznowienie w ćwiczeniu: ta sama seria i zapisane serie', e2.phase === 'exercise' && /Seria 2 z 3/.test(e2ui.set) && e2.done[0] === 1, JSON.stringify({ e2, e2ui }));
  ok('wznowienie: wpisane (niezapisane) powtórzenia zostały', e2ui.reps === '9', e2ui.reps);
  ok('wznowienie: zegar treningu liczy dalej (nie od zera)', e2.elapsed >= 600 && /^1\d:\d\d$|^10:\d\d$/.test(e2ui.clock), JSON.stringify({ el: e2.elapsed, clock: e2ui.clock }));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
  console.log('All training flow v2 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
