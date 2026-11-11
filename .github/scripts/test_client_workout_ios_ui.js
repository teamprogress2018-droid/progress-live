// Ekran treningu klienta na iPhonie: safe area (Dynamic Island / pasek gestów), „‹ Wróć do treningu”, menu „…”,
// widoczne „← Poprzednie / Następne →” z pytaniem o niedokończone serie, „Zapisz serię X z Y” + „Cofnij”,
// „Ćwiczenie ukończone”, prosty RIR, pominięcie z powodem, swipe tylko jako skrót w pustej części ekranu.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const shotDir = process.env.CLIENT_SIMPLE_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-client-ios');
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

const PHONES = [
  { name: 'iPhone SE (mały)', w: 375, h: 667, sat: 20, sab: 0 },
  { name: 'iPhone 15 Pro Max (duży)', w: 430, h: 932, sat: 59, sab: 34 },
  { name: 'iPhone SE 1. gen (najmniejszy)', w: 320, h: 568, sat: 20, sab: 0 }
];

async function setup(browser, ph) {
  const ctx = await browser.newContext({ viewport: { width: ph.w, height: ph.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=cw-ios', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(ph => {
    document.documentElement.style.setProperty('--cs-sat', ph.sat + 'px');
    document.documentElement.style.setProperty('--cs-sab', ph.sab + 'px');
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'cw-ios' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const today = todayYmd(); const wd = new Date().getDay();
    const add = (y, n) => { const d = new Date(y + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Piotr Urbaniak', status: 'active', preferredWeekdays: [wd] }];
    const ex = (n, s, r, kg, rir) => ({ name: n, sets: String(s), reps: String(r), kg: kg ? String(kg) : '', rest: '90s', rir: rir || '', note: 'Kontroluj zakres — nie szarp; klatka na podparciu. Łopatki ściągnięte przez cały ruch.' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: add(today, -30),
      days: [{ day: 'Dzień 1', exercises: [ex('Wiosłowanie na maszynie Hammer (siedząc)', 4, 8, 70, '2-3'), ex('Wyciskanie hantli na ławce płaskiej', 3, 10, 16), ex('Przysiad goblet', 3, 10, 20), ex('Martwy ciąg rumuński', 3, 10, 28), ex('Wyciskanie hantli nad głowę siedząc', 3, 10, 10), ex('Plank', 3, '40', 0)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] };
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, ph);
  await page.waitForSelector('.cs-today');
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  return { ctx, page, errors };
}

const geom = (page, ph) => page.evaluate(ph => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height, w: b.width }; };
  const btns = [...document.querySelectorAll('.cs-ex-top button, .cs-ex-foot button, .cs-tech-btn, .cs-rir-opts button')].filter(b => b.offsetParent).map(b => ({ t: b.innerText.trim() || b.getAttribute('aria-label'), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width }));
  return { vw: innerWidth, vh: innerHeight, back: r('.cs-back-btn'), more: r('.cs-more-btn'), head: r('.cs-set-head'), foot: r('.cs-ex-foot'), primary: r('.cs-ex-foot .cs-btn-primary'), tech: r('.cs-tech-btn'),
    overflowX: document.querySelector('.cs-ex-scroll').scrollWidth > document.querySelector('.cs-ex-scroll').clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
    small: btns.filter(b => b.h < 44 - 0.5 || b.w < 44 - 0.5), text: document.querySelector('.cs-ex').innerText };
}, ph);

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const ph of PHONES) {
    const { ctx, page, errors } = await setup(browser, ph);
    const g = await geom(page, ph);
    await page.screenshot({ path: path.join(shotDir, 'cw_ios_' + ph.w + '.png') });
    ok(ph.name + ': „‹ Wróć do treningu” pod Dynamic Island / zegarem', g.back && g.back.t >= ph.sat && /Wróć do treningu/.test(g.text), JSON.stringify(g.back));
    ok(ph.name + ': „Seria 1 z 4” nie nachodzi na pasek statusu', g.head && g.head.t >= ph.sat + 40, JSON.stringify(g.head));
    ok(ph.name + ': dolny pasek CTA nad paskiem gestów', g.foot && g.foot.b <= g.vh + 0.5 && g.primary.b <= g.vh - ph.sab - 8, JSON.stringify({ foot: g.foot, primary: g.primary, vh: g.vh }));
    ok(ph.name + ': wszystkie przyciski min. 44 × 44', g.small.length === 0, JSON.stringify(g.small));
    ok(ph.name + ': bez przewijania w poziomie', !g.overflowX);
    ok(ph.name + ': film tylko jako mały przycisk „Technika”', g.tech && g.tech.h <= 48, JSON.stringify(g.tech));
    ok(ph.name + ': domyślnie: ćwiczenie X z Y, nazwa, wskazówka, plan serii, zapis', /Ćwiczenie 1 z 6/.test(g.text) && /Wiosłowanie na maszynie Hammer/.test(g.text) && /Kontroluj zakres/.test(g.text) && /8 powtórzeń · 70 kg · cel RIR 2–3/.test(g.text) && /Zapisz serię 1 z 4/.test(g.text), g.text.slice(0, 300));
    ok(ph.name + ': szczegóły schowane pod „Pomoc / Technika / Więcej”', !/HISTORIA|Pomiń ćwiczenie|INNE WARIANTY/.test(g.text) && /Pomoc \/ Technika \/ Więcej/.test(g.text));
    ok(ph.name + ': widoczne „← Poprzednie” i „Następne →”', /← Poprzednie/.test(g.text) && /Następne →/.test(g.text));
    if (ph.w === 375) {
      // RIR prostym językiem
      ok('RIR: pytanie i opcje 0 / 1–2 / 3–4 / Nie wiem', /Ile powtórzeń zostało Ci w zapasie\?/.test(g.text) && await page.locator('.cs-rir-opts button').allInnerTexts().then(t => t.join('|') === '0|1–2|3–4|Nie wiem'));
      await page.tap('.cs-rir-opts [data-rir="1-2"]');
      ok('RIR zapisany jako 1-2', await page.evaluate(() => window._cw.exercises[0].sets[0].rir === '1-2'));

      // Zapis serii + Cofnij
      await page.tap('[data-cs-primary="save"]');
      await page.waitForSelector('.cw-rest');
      let t = await page.evaluate(() => document.getElementById('clive-player-inner').innerText);
      ok('po zapisie: „Seria 1 z 4 zapisana ✓” z „Cofnij”', /Seria 1 z 4 zapisana/.test(t) && /Cofnij/.test(t), t.slice(0, 120));
      await page.tap('.cs-saved-undo');
      t = await page.evaluate(() => ({ text: document.querySelector('.cs-ex').innerText, done: window._cw.exercises[0].sets[0].done, rest: !!document.querySelector('.cw-rest') }));
      ok('„Cofnij”: seria znowu do zrobienia, bez przerwy', !t.done && !t.rest && /Zapisz serię 1 z 4/.test(t.text), JSON.stringify(t).slice(0, 200));

      // Następne → przy niedokończonych seriach
      await page.tap('[data-cs-nav="next"]');
      t = await page.evaluate(() => document.querySelector('.cs-sheet') ? document.querySelector('.cs-sheet').innerText : '');
      ok('„Następne →”: „Zostały 4 serie. Przejść do następnego ćwiczenia?”', /Zostały 4 serie\./.test(t) && /Przejść do następnego ćwiczenia\?/.test(t) && /Wróć do serii/.test(t) && /Przejdź dalej/.test(t), t);
      await page.tap('text=Wróć do serii');
      ok('„Wróć do serii” zostaje na ćwiczeniu', await page.evaluate(() => window._cw.exIdx === 0 && !document.querySelector('.cs-sheet')));

      // Wpisane dane nie giną po zmianie ćwiczenia
      await page.fill('input[aria-label="Seria 1: ciężar"]', '72,5');
      await page.tap('[data-cs-nav="next"]');
      await page.tap('text=Przejdź dalej');
      ok('„Przejdź dalej” → ćwiczenie 2', await page.evaluate(() => window._cw.exIdx === 1 && /Ćwiczenie 2 z 6/.test(document.querySelector('.cs-ex').innerText)));
      await page.tap('[data-cs-nav="prev"]');
      ok('„← Poprzednie” bez pytania; wpisany ciężar został (72.5)', await page.evaluate(() => window._cw.exIdx === 0 && document.querySelector('input[aria-label="Seria 1: ciężar"]').value === '72.5'));

      // Wyjście z niezapisanymi danymi → dolny panel
      await page.tap('.cs-back-btn');
      t = await page.evaluate(() => document.querySelector('.cs-sheet') ? document.querySelector('.cs-sheet').innerText : '');
      ok('„‹ Wróć do treningu” z niezapisanymi danymi → Zapisz i wyjdź / Kontynuuj trening / Wyjdź bez zapisu', /Zapisz i wyjdź/.test(t) && /Kontynuuj trening/.test(t) && /Wyjdź bez zapisu/.test(t), t);
      const sheetBtns = await page.evaluate(() => [...document.querySelectorAll('.cs-sheet button')].map(b => b.getBoundingClientRect().height));
      ok('przyciski panelu min. 44 pt', sheetBtns.every(h => h >= 44), JSON.stringify(sheetBtns));
      await page.tap('text=Kontynuuj trening');
      ok('„Kontynuuj trening” zamyka panel, dane zostają', await page.evaluate(() => !document.querySelector('.cs-sheet') && window._cw.exercises[0].sets[0].kg === '72.5' && window._cw.phase === 'exercise'));
      await page.tap('.cs-back-btn');
      await page.tap('text=Wyjdź bez zapisu');
      ok('„Wyjdź bez zapisu”: wartości wracają do planu, lista treningu', await page.evaluate(() => window._cw.exercises[0].sets[0].kg === '70' && window._cw.phase === 'overview' && /TWÓJ TRENING/.test(document.getElementById('clive-player-inner').innerText)));
      await page.tap('.cs-ov .cs-btn-primary');
      await page.fill('input[aria-label="Seria 1: powtórzenia"]', '9');
      await page.tap('.cs-back-btn');
      await page.tap('text=Zapisz i wyjdź');
      ok('„Zapisz i wyjdź”: seria zapisana (9 powt.), lista treningu', await page.evaluate(() => { const s = window._cw.exercises[0].sets[0]; return s.done && s.reps === '9' && window._cw.phase === 'overview'; }));
      await page.tap('.cs-ov .cs-btn-primary');

      // Ostatnia seria → „Ćwiczenie ukończone”, dopiero wtedy przejście dalej
      for (let i = 0; i < 3; i++) {
        await page.tap('[data-cs-primary="save"]');
        if (await page.$('.cw-rest')) await page.evaluate(() => cwSkipRest());
      }
      t = await page.evaluate(() => ({ text: document.querySelector('.cs-ex').innerText, idx: window._cw.exIdx }));
      ok('po ostatniej serii: „Ćwiczenie ukończone” i „Przejdź do następnego ćwiczenia”', t.idx === 0 && /Ćwiczenie ukończone/.test(t.text) && /Przejdź do następnego ćwiczenia/.test(t.text) && !/Zapisz serię/.test(t.text), t.text.slice(0, 300));
      await page.tap('[data-cs-nav="next"]');
      ok('„Następne →” po ukończeniu — bez pytania', await page.evaluate(() => window._cw.exIdx === 1 && !document.querySelector('.cs-sheet')));

      // Menu „…”: Zakończ trening, pominięcie z powodem
      await page.tap('.cs-more-btn');
      t = await page.evaluate(() => document.querySelector('.cs-sheet').innerText);
      ok('menu „…”: Pomiń ćwiczenie, Zgłoś ból, Zakończ trening', /Pomiń ćwiczenie/.test(t) && /Zgłoś ból/.test(t) && /Zakończ trening/.test(t), t);
      await page.tap('.cs-sheet >> text=Pomiń ćwiczenie');
      t = await page.evaluate(() => document.querySelector('.cs-sheet').innerText);
      ok('pominięcie: Brak czasu / Ból / Sprzęt zajęty / Inne', ['Brak czasu', 'Ból', 'Sprzęt zajęty', 'Inne'].every(x => t.includes(x)), t);
      await page.tap('.cs-sheet >> text=Sprzęt zajęty');
      ok('pominięte z powodem „Sprzęt zajęty”, następne ćwiczenie', await page.evaluate(() => window._cw.exercises[1].skipped && window._cw.exercises[1].skipReason === 'Sprzęt zajęty' && window._cw.exIdx === 2));

      // Swipe: pionowy ruch i pola nie zmieniają ćwiczenia; poziomy w pustej części — tak (z pytaniem)
      const swipe = (sel, dx, dy) => page.evaluate(({ sel, dx, dy }) => {
        const el = document.querySelector(sel); const area = document.querySelector('.cs-ex-scroll');
        const b = el.getBoundingClientRect(); const x0 = b.left + Math.min(40, b.width / 2), y0 = b.top + Math.min(10, b.height / 2);
        const T = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [T(x0, y0)], changedTouches: [T(x0, y0)] }));
        for (let i = 1; i <= 6; i++) el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [T(x0 + dx * i / 6, y0 + dy * i / 6)], changedTouches: [T(x0 + dx * i / 6, y0 + dy * i / 6)] }));
        const hint = document.querySelector('.cs-swipe-hint'); const shown = hint && hint.classList.contains('is-on') ? hint.textContent : '';
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [T(x0 + dx, y0 + dy)] }));
        return { shown, idx: window._cw.exIdx, sheet: document.querySelector('.cs-sheet') ? document.querySelector('.cs-sheet').innerText : '' };
      }, { sel, dx, dy });
      let sw = await swipe('.cs-ex-name', -40, -200);
      ok('swipe: pionowe przewijanie nie zmienia ćwiczenia', sw.idx === 2 && !sw.sheet, JSON.stringify(sw));
      sw = await swipe('input[aria-label="Seria 1: ciężar"]', -220, 0);
      ok('swipe: nie działa na polu ciężaru', sw.idx === 2 && !sw.sheet, JSON.stringify(sw));
      sw = await swipe('.cs-ex-name', -220, 4);
      ok('swipe w pustej części: podgląd następnego ćwiczenia i pytanie o serie', /Następne: Martwy ciąg rumuński/.test(sw.shown) && /Zostały 3 serie/.test(sw.sheet) && sw.idx === 2, JSON.stringify(sw));
      await page.tap('text=Wróć do serii');
      sw = await swipe('.cs-ex-name', 220, 4);
      ok('swipe w prawo → poprzednie ćwiczenie', sw.idx === 1, JSON.stringify(sw));

      // Zakończ trening z menu
      await page.tap('.cs-more-btn');
      await page.tap('.cs-sheet >> text=Zakończ trening');
      ok('„Zakończ trening” z menu → pytanie o niewykonane serie', await page.evaluate(() => window._cw.phase === 'finish' && /ZAKOŃCZYĆ TRENING\?/.test(document.getElementById('clive-player-inner').innerText)));
      const fin = await page.evaluate(() => { const r = document.querySelector('#clive-player-inner .cs-back-btn').getBoundingClientRect(); return { t: r.top, h: r.height }; });
      ok('ekran końca: „‹ Wróć” zamiast ×, pod paskiem statusu', fin.t >= 20 && fin.h >= 44, JSON.stringify(fin));
    }
    ok(ph.name + ': brak błędów strony', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll iOS workout screen checks passed');
})().catch(e => { console.error(e); process.exit(1); });
