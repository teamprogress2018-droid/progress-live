// UI: poprawki aplikacji klienta na telefonie (przegląd 17.11.2026) — 360, 390 i 430 px.
// Nagłówek (bez „Wyloguj” — jest na ekranie Trener; „Panel trenera” tylko dla trenera), brak przewijania w poziomie,
// cele dotykowe >= 44 px, kontrast tekstu >= 4,5:1, ekran Technika bez zepsutego obrazka,
// polskie liczby w „Więcej statystyk” i karta „Kontynuuj program” na ekranie On-demand.
// Bez Firebase i bez zapisu do produkcji: logowanie podstawione jak w test_client_simple_ui.js.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.CLIENT_MOBILE_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-client-mobile-fixes');
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function fixture(page) {
  await page.evaluate(() => {
    window._uid = 'mf-client'; window._trainerId = 'mf-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'mobile-fixes' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const today = todayYmd();
    const add = (n) => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    window.CL = [{ id: 'c1', trainerId: 'mf-trainer', name: 'Piotr Urbaniak', status: 'active', preferredWeekdays: [new Date().getDay()] }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '60s' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'mf-trainer', name: 'Full Body', startDate: add(-30),
      days: [{ day: 'Dzień 1', muscles: 'Całe ciało', exercises: [ex('Przysiad goblet', 3, 10, 20), ex('Wyciskanie hantli na ławce płaskiej', 3, 10, 16)] }] }];
    window.SE = [{ id: 's1', clientId: 'c1', trainerId: 'mf-trainer', planId: 'p1', dayIdx: 0, date: add(-7), source: 'client', status: 'completed', type: 'Full Body', duration: 40, volume: 2400,
      exercises: [{ name: 'Przysiad goblet', sets: [{ kg: 18, reps: 10, done: true }, { kg: 18, reps: 10, done: true }] }] }];
    window.TASKS = [{ id: 't1', clientId: 'c1', trainerId: 'mf-trainer', kind: 'homework', odWorkoutId: 'ow2', title: 'HIIT w domu', done: false, createdAt: new Date().toISOString() }];
    window.PACKAGES = []; window.CHECKINS = {};
    window.METRIC_ENTRIES = [{ clientId: 'c1', groupId: 'mg1', date: add(-40), values: { m1: 85.8 } }, { clientId: 'c1', groupId: 'mg1', date: add(-3), values: { m1: 84.2 } }];
    window.OD_PROGRESS = [{ id: 'odpr_c1_op2', clientId: 'c1', programId: 'op2', done: ['op2:0:0'], updatedAt: new Date().toISOString() }];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: { ondemand: true, resources: true, homework: true, bodyWeight: true } },
      contact: { name: 'P&P Progress', phone: '+48 692 535 692', address: 'Owczarska 64, 54-020 Wrocław-Leśnica', website: 'https://teamprogress.pl/' } };
    if (typeof DEMO_RESOURCES !== 'undefined') window.USER_RESOURCES = DEMO_RESOURCES.map((r) => Object.assign({}, r));
    if (typeof ensureODWorkouts === 'function') ensureODWorkouts();
    if (typeof ensureODPrograms === 'function') ensureODPrograms();
    enterClientLiveShell();
  });
  await page.waitForSelector('.cs-today');
}

// Elementy klikalne mniejsze niż 44 px w danym kontenerze.
const smallTargets = (page, sel) => page.evaluate((sel) => {
  const out = [];
  document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('[hidden]')) return;
    if (r.width < 44 || r.height < 44) out.push(Math.round(r.width) + '×' + Math.round(r.height) + ' ' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30));
  });
  return out;
}, sel);

// Tekst o kontraście poniżej 4,5:1 (kolor tła złożony z przodków).
const lowContrast = (page, sel) => page.evaluate((sel) => {
  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const bgOf = (el) => { const st = []; let e = el; while (e) { const cs = getComputedStyle(e); const b = parse(cs.backgroundColor); if (cs.backgroundImage !== 'none') return null; if (b && b.a > 0) st.push(b); if (b && b.a >= 1) break; e = e.parentElement; } let c = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) c = blend(st[i], c); return c; };
  const out = [];
  document.querySelectorAll(sel + ' *').forEach((el) => {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') return;
    const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) return;
    const f = blend(fg, bg); const L1 = lum(f), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5) out.push(el.textContent.trim().slice(0, 30) + ' ' + ratio.toFixed(2));
  });
  return out;
}, sel);

const noHScroll = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const w = vp.width;
    const context = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.dismiss());
    await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
    // Zdjęcia techniki z GitHuba „nie wczytują się” (jak offline).
    await page.route(/raw\.githubusercontent\.com|githubusercontent|jsdelivr/, (r) => r.abort());
    await page.goto('http://localhost:' + port + '/index.html?nocache=mobile-fixes-' + w, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await fixture(page);

    // 1–2. Nagłówek klienta
    const head = await page.evaluate(() => {
      const top = document.querySelector('.clive-top');
      const r = top.getBoundingClientRect();
      return { left: r.left, right: r.right, vw: innerWidth, logout: /Wyloguj/.test(top.innerText), trainerBtn: !!document.getElementById('clive-trainer-switch'), trainerText: /Panel trenera/.test(document.getElementById('screen-clientlive').innerHTML) };
    });
    await page.screenshot({ path: path.join(shotDir, 'header_client_' + w + '.png') });
    ok(w + ': nagłówek w oknie, bez „Wyloguj” (jest na ekranie Trener)', head.left >= 0 && head.right <= head.vw && !head.logout, JSON.stringify(head));
    ok(w + ': klient nie ma „Panel trenera” w DOM', !head.trainerBtn && !head.trainerText);
    ok(w + ': Dzisiaj bez przewijania w poziomie', await noHScroll(page));

    // Konto z rolą trenera (podgląd swojego testowego klienta): przycisk jest i nadal się mieści.
    const trainer = await page.evaluate(async () => {
      window._doc = (_db, col, id) => ({ col, id });
      window._getDoc = async (ref) => ({ exists: () => ref.col === 'trainerRoles' && ref.id === window._uid, data: () => ({ uid: window._uid, role: 'trainer', enabled: true }) });
      const res = await clientLiveSyncTrainerSwitch();
      const btn = document.getElementById('clive-trainer-switch');
      const out = (btn || document.querySelector('.clive-top')).getBoundingClientRect();
      return { res, btn: !!btn, right: out.right, vw: innerWidth, sw: document.scrollingElement.scrollWidth };
    });
    await page.screenshot({ path: path.join(shotDir, 'header_trainer_' + w + '.png') });
    ok(w + ': trener widzi „Panel trenera” w całości w oknie', trainer.res === true && trainer.btn && trainer.right <= trainer.vw && trainer.sw <= trainer.vw + 1, JSON.stringify(trainer));
    // Konto bez roli: przycisk znika.
    const plain = await page.evaluate(async () => {
      window._getDoc = async () => ({ exists: () => false, data: () => null });
      await clientLiveSyncTrainerSwitch();
      return !!document.getElementById('clive-trainer-switch');
    });
    ok(w + ': konto bez roli trenera — przycisku nie ma', !plain);
    await page.evaluate(() => { delete window._getDoc; delete window._doc; });

    // 3. Kontrast + 5. cele dotykowe na Zadaniach domowych
    await page.evaluate(() => setClientLiveScreen('homework'));
    ok(w + ': Zadania domowe — kontrast tekstu >= 4,5:1', (await lowContrast(page, '#clive-screen-content')).length === 0, JSON.stringify(await lowContrast(page, '#clive-screen-content')));
    ok(w + ': Zadania domowe — przyciski >= 44 px', (await smallTargets(page, '#clive-screen-content button')).length === 0, JSON.stringify(await smallTargets(page, '#clive-screen-content button')));
    ok(w + ': Zadania domowe bez przewijania w poziomie', await noHScroll(page));

    // 6. Postępy, pełny widok: liczby po polsku, kontrast
    await page.evaluate(() => { setClientLiveScreen('progress'); csProgressFull(true); });
    const prog = await page.evaluate(() => document.getElementById('clive-screen-content').innerText);
    await page.screenshot({ path: path.join(shotDir, 'progress_full_' + w + '.png') });
    ok(w + ': Postępy — przecinek w liczbach (84,2 kg)', /84,2/.test(prog) && !/\b84\.2\b/.test(prog) && /−1,6 kg od /.test(prog), prog.slice(0, 300));
    ok(w + ': Postępy — bez „/—” i „2t kg”', !/\/—/.test(prog) && !/\dt kg/.test(prog), prog.slice(0, 300));
    ok(w + ': Postępy — kontrast tekstu >= 4,5:1', (await lowContrast(page, '#clive-screen-content')).length === 0, JSON.stringify(await lowContrast(page, '#clive-screen-content')));
    ok(w + ': Postępy bez przewijania w poziomie', await noHScroll(page));

    // 5. Zasoby i Kontakt
    await page.evaluate(() => setClientLiveScreen('resources'));
    ok(w + ': Zasoby — „Otwórz →” >= 44 px', (await smallTargets(page, '#clive-screen-content a.cap-res-open')).length === 0 && await page.$('#clive-screen-content a.cap-res-open') !== null, JSON.stringify(await smallTargets(page, '#clive-screen-content a.cap-res-open')));
    ok(w + ': Zasoby bez przewijania w poziomie', await noHScroll(page));
    await page.evaluate(() => setClientLiveScreen('contact'));
    ok(w + ': Kontakt — telefon i strona >= 44 px', (await smallTargets(page, '#clive-screen-content .cs-kv a')).length === 0 && (await page.$$('#clive-screen-content .cs-kv a')).length >= 2, JSON.stringify(await smallTargets(page, '#clive-screen-content .cs-kv a')));

    // On-demand: karta „Kontynuuj program” i program z dużymi celami
    await page.evaluate(() => setClientLiveScreen('ondemand'));
    const od = await page.evaluate(() => ({ card: !!document.querySelector('#clive-screen-content [data-od-continue]'), text: document.getElementById('clive-screen-content').innerText }));
    await page.screenshot({ path: path.join(shotDir, 'ondemand_' + w + '.png') });
    ok(w + ': On-demand — karta „Kontynuuj program” na górze', od.card && /Kontynuuj program/i.test(od.text));
    ok(w + ': On-demand — opis pisany do klienta', !/Klient sam wybiera/.test(od.text));
    await page.evaluate(() => openODProgramClient('op2'));
    await page.waitForTimeout(200);
    ok(w + ': program On-demand — przyciski >= 44 px', (await smallTargets(page, '#clive-screen-content .cap-od-check, #clive-screen-content .cap-od-day, #clive-screen-content .cap-od-play')).length === 0 && (await page.$$('#clive-screen-content .cap-od-check')).length > 0,
      JSON.stringify(await smallTargets(page, '#clive-screen-content .cap-od-check, #clive-screen-content .cap-od-day, #clive-screen-content .cap-od-play')));
    ok(w + ': program On-demand bez przewijania w poziomie', await noHScroll(page));

    // 5. Trening: − / + i „Cofnij”
    await page.evaluate(() => { setClientLiveScreen('home'); csStart('p1', 0); });
    await page.waitForSelector('.cs-ex');
    ok(w + ': trening — „−” i „+” >= 44 px', (await smallTargets(page, '.cs-step')).length === 0, JSON.stringify(await smallTargets(page, '.cs-step')));
    await page.click('.cs-ex-foot [data-cs-primary="save"]');
    await page.evaluate(() => { if (typeof cwSkipRest === 'function') cwSkipRest(); });
    await page.click('.cs-hist summary');
    ok(w + ': trening — „Cofnij” w historii >= 44 px', (await smallTargets(page, '.cs-hist .cs-mini')).length === 0 && (await page.$$('.cs-hist .cs-mini')).length > 0, JSON.stringify(await smallTargets(page, '.cs-hist .cs-mini')));
    ok(w + ': trening bez przewijania w poziomie', await noHScroll(page));

    // 4. Technika: zdjęcie się nie wczytało — czytelny komunikat zamiast zepsutego obrazka
    await page.evaluate(() => { const b = document.querySelector('#clive-player .cs-tech-btn'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    const tech = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('#clive-player img')];
      const broken = imgs.filter((i) => { const r = i.getBoundingClientRect(); return i.complete && i.naturalWidth === 0 && r.width > 0 && r.height > 0; });
      const fb = document.querySelector('#clive-player .cw-technique-media-fallback');
      return { broken: broken.length, fallback: fb ? fb.innerText : '' };
    });
    await page.screenshot({ path: path.join(shotDir, 'technique_' + w + '.png') });
    ok(w + ': Technika — brak zepsutego obrazka', tech.broken === 0, JSON.stringify(tech));
    ok(w + ': Technika — komunikat dla klienta', /nie wczytało/.test(tech.fallback), tech.fallback);
    ok(w + ': Technika — kontrast komunikatu >= 4,5:1', (await lowContrast(page, '#clive-player .cw-technique-media-fallback')).length === 0, JSON.stringify(await lowContrast(page, '#clive-player .cw-technique-media-fallback')));

    ok(w + ': brak błędów JS', !errors.length, errors.join(' | '));
    await context.close();
  }
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll client mobile fixes UI checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
