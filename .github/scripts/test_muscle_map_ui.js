// Mapa mięśni na iPhonie (390 × 844): ćwiczenie bez filmu → mapa i „Jak wykonać” w „Technice”,
// ćwiczenie z filmem → zwinięty przycisk „Które mięśnie pracują”, dotknięcie mięśnia pokazuje nazwę, bez przewijania w poziomie.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const shotDir = process.env.CLIENT_SIMPLE_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-muscle-map');
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

const noOverflow = page => page.evaluate(() => {
  const els = [document.documentElement, ...document.querySelectorAll('.cs-sheet, .cs-sheet *')];
  return els.filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden' && getComputedStyle(e).overflowX !== 'clip' && e.clientWidth > 0)
    .map(e => (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName).slice(0, 5);
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, r => r.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=muscle-map', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const picked = await page.evaluate(() => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'muscle-map' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    // Ćwiczenie z biblioteki bez filmu i obrazu, z rozpoznanymi mięśniami i opisem.
    const noMedia = DEF_EX.find(e => {
      if (!e.tip || !muscleMapData(e)) return false;
      const m = resolveCoachMedia({ name: e.name });
      return !m.video && !m.videoEmbed && !m.gif && !(m.img && !isDecorativeExAsset(m.img));
    });
    const today = todayYmd(); const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Piotr Urbaniak', status: 'active', preferredWeekdays: [wd] }];
    const ex = (n, extra) => Object.assign({ name: n, sets: '3', reps: '10', kg: '20', rest: '90s' }, extra || {});
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', exercises: [ex(noMedia.name), ex('Przysiad ze sztangą', { video: 'https://www.youtube.com/watch?v=ultWZbUMPL8' })] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] };
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
    return { name: noMedia.name, tip: noMedia.tip, data: muscleMapData(noMedia) };
  });
  await page.waitForSelector('.cs-today');
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');

  // 1. Ćwiczenie bez filmu: mapa w miejscu mediów + „Jak wykonać”.
  await page.tap('.cs-tech-btn');
  await page.waitForSelector('.cs-sheet');
  let s = await page.evaluate(() => {
    const sh = document.querySelector('.cs-sheet');
    const svg = sh.querySelector('[data-cs-mm] svg.mm-svg');
    const b = svg && svg.getBoundingClientRect();
    return { text: sh.innerText, svg: !!svg, aria: svg && svg.getAttribute('aria-label'), w: b && b.width, vw: innerWidth,
      primary: sh.querySelectorAll('[data-cs-mm] .mm-p').length, details: !!sh.querySelector('[data-cs-mm-more]'), missing: !!sh.querySelector('.cw-media-missing') };
  });
  await page.screenshot({ path: path.join(shotDir, 'mm_no_film_390.png') });
  ok('bez filmu: mapa w „Technice” (' + picked.name + ')', s.svg && s.primary > 0 && !s.details, JSON.stringify(s).slice(0, 300));
  ok('bez filmu: „Jak wykonać” z pola tip', /Jak wykonać/.test(s.text) && s.text.includes(picked.tip.slice(0, 30)), s.text.slice(0, 300));
  ok('bez filmu: brak komunikatu „Brak materiału instruktażowego”', !s.missing);
  ok('aria-label: „Główne: …”', /^Główne: /.test(s.aria || ''), s.aria);
  ok('lista partii: główne / pomocnicze', /główne:/.test(s.text) && (!picked.data.secondary.length || /pomocnicze:/.test(s.text)));
  ok('mapa mieści się w szerokości ekranu', s.w > 150 && s.w <= s.vw, JSON.stringify({ w: s.w, vw: s.vw }));
  let over = await noOverflow(page);
  ok('bez przewijania w poziomie (bez filmu)', over.length === 0, JSON.stringify(over));

  // Dotknięcie mięśnia pokazuje nazwę.
  await page.tap('[data-cs-mm] .mm-p >> nth=0');
  const pick = await page.evaluate(() => ({ t: document.querySelector('[data-cs-mm] .mm-pick').innerText, on: document.querySelectorAll('[data-cs-mm] .mm-on').length }));
  ok('dotknięcie mięśnia pokazuje nazwę i podświetla go', /— główny/.test(pick.t) && pick.on > 0, JSON.stringify(pick));
  await page.tap('.cs-sheet >> text=Wróć do serii');

  // 2. Ćwiczenie z filmem: zwinięty przycisk „Które mięśnie pracują” pod filmem.
  await page.evaluate(() => { window._cw.exIdx = 1; cwRender(); });
  await page.waitForSelector('.cs-ex');
  await page.tap('.cs-tech-btn');
  await page.waitForSelector('.cs-sheet');
  s = await page.evaluate(() => {
    const sh = document.querySelector('.cs-sheet');
    const d = sh.querySelector('[data-cs-mm-more]');
    const sum = d && d.querySelector('summary');
    const media = sh.querySelector('.cs-media');
    return { d: !!d, open: d && d.open, h: sum && sum.getBoundingClientRect().height, label: sum && sum.innerText.trim(),
      below: !!(media && d && (media.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING)), inline: !!sh.querySelector('[data-cs-mm]') };
  });
  await page.screenshot({ path: path.join(shotDir, 'mm_film_390.png') });
  ok('z filmem: zwinięte „Które mięśnie pracują” pod filmem', s.d && s.open === false && s.below && !s.inline && /Które mięśnie pracują/.test(s.label || ''), JSON.stringify(s));
  ok('z filmem: przycisk co najmniej 44 px', s.h >= 44 - 0.5, String(s.h));
  await page.tap('[data-cs-mm-more] summary');
  const opened = await page.evaluate(() => { const d = document.querySelector('[data-cs-mm-more]'); return d.open && !!d.querySelector('svg.mm-svg'); });
  ok('po dotknięciu rozwija mapę', opened);
  over = await noOverflow(page);
  ok('bez przewijania w poziomie (z filmem)', over.length === 0, JSON.stringify(over));
  await page.screenshot({ path: path.join(shotDir, 'mm_film_open_390.png') });

  // 3. Karta w bibliotece trenera: mała mapa obok opisu.
  const lib = await page.evaluate(n => { const e = DEF_EX.find(x => x.name === n); const h = exdPreviewHtml(e); return { row: /data-exd-mm/.test(h), compact: /mm-compact/.test(h), desc: /exd-preview-desc/.test(h) }; }, picked.name);
  ok('biblioteka: mała mapa obok opisu', lib.row && lib.compact && lib.desc, JSON.stringify(lib));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' błąd(ów)'); process.exit(1); }
  console.log('Wszystkie testy UI mapy mięśni przeszły.');
})().catch(e => { console.error(e); process.exit(1); });
