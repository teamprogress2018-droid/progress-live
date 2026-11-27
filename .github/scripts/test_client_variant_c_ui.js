// UI: ekran ćwiczenia klienta — Progress Clean, wariant C (etap 1 modernizacji).
// Nagłówek: ‹ · nazwa · głośnik · „Historia” (bez „…” i bez małej miniatury). Duży poziomy film bez autoodtwarzania.
// Numery serii (bieżąca / ✓ zrobiona / do zrobienia), Ciężar | Powtórzenia, „✓ Zapisz serię”.
// Bez kafelków „Ostatni trening” i „Dzisiaj” — historia w panelu; zamknięcie panelu nie zmienia wpisanych wartości.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.CLIENT_SIMPLE_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-variant-c');
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function openWorkout(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=variant-c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window._uid = 'vc-client'; window._trainerId = 'vc-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'variant-c' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const today = todayYmd();
    const add = (y, n) => { const d = new Date(y + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    window.CL = [{ id: 'c1', trainerId: 'vc-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [new Date().getDay()] }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: kg ? String(kg) : '', rest: '90s' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'vc-trainer', name: 'Full Body A', weekKeys: ['w1'], currentWeek: 'w1', startDate: add(today, -40),
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie sztangi na ławce płaskiej', 4, 11, 57.5), ex('Przysiad goblet', 3, '10-12', 20)] }] }];
    const sess = (d, kg, r) => ({ id: 's' + (-d), clientId: 'c1', trainerId: 'vc-trainer', planId: 'p1', dayIdx: 0, date: add(today, d), source: 'client', status: 'completed',
      exercises: [{ name: 'Wyciskanie sztangi na ławce płaskiej', sets: [1, 2, 3, 4].map(i => ({ reps: String(r - (i > 2 ? 1 : 0)), kg: String(kg), done: true })) }] });
    window.SE = [sess(-21, 52.5, 10), sess(-14, 55, 11), sess(-7, 55, 12)];
    window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} } };
    enterClientLiveShell();
  });
  await page.waitForSelector('.cs-today .cs-btn-primary');
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex [data-cs-primary="save"]');
  return { page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });

  // ---------- Układ (iPhone 390 × 844) ----------
  let { page, errors } = await openWorkout(browser, 390, 844);
  const lay = await page.evaluate(() => {
    const top = document.querySelector('#clive-player .cs-ex-top');
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
    const order = [...top.children].filter(e => e.offsetParent).map(e => e.matches('.cs-back-btn') ? 'back' : e.matches('.cs-ex-name') ? 'name' : e.matches('[data-pv-mute]') ? 'voice' : e.matches('[data-cs-history]') ? 'history' : e.className);
    const vid = document.querySelector('[data-cs-video]');
    return {
      order, name: (top.querySelector('.cs-ex-name') || {}).innerText || '',
      more: !!document.querySelector('.cs-ex .cs-more-btn'), thumb: !!document.querySelector('.cs-ex-media'),
      tiles: !!document.querySelector('.cs-ex [data-cs-prev], .cs-ex .cs-goal-prev'),
      text: document.querySelector('.cs-ex').innerText,
      vid: r('[data-cs-video]'), vidLandscape: vid ? vid.querySelector('.cs-video-frame') && vid.querySelector('.cs-video-frame').getBoundingClientRect().width > vid.querySelector('.cs-video-frame').getBoundingClientRect().height : false,
      videos: document.querySelectorAll('.cs-ex video').length, autoplay: document.querySelectorAll('.cs-ex video[autoplay], .cs-ex iframe').length,
      dots: [...document.querySelectorAll('.cs-set .cs-dots span')].map(s => s.className + ':' + s.textContent),
      kg: r('[data-cs-box="kg"]'), reps: r('[data-cs-box="reps"]'),
      kgVal: document.querySelector('[data-cs-field="kg"]').value, repsVal: document.querySelector('[data-cs-field="reps"]').value,
      save: r('[data-cs-primary="save"]'), saveText: document.querySelector('[data-cs-primary="save"]').innerText.trim(),
      saveIcon: !!document.querySelector('[data-cs-primary="save"] svg'),
      hist: r('[data-cs-history]'), voice: r('[data-pv-mute]'), back: r('.cs-ex-top .cs-back-btn'), help: !!document.querySelector('[data-cs-help]'),
      vh: innerHeight
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'variant_c_390.png') });
  ok('nagłówek: ‹ · nazwa · głośnik · Historia', JSON.stringify(lay.order) === JSON.stringify(['back', 'name', 'voice', 'history']), JSON.stringify(lay.order));
  ok('nazwa ćwiczenia w nagłówku', /Wyciskanie sztangi na ławce płaskiej/.test(lay.name), lay.name);
  ok('bez „…” na ekranie ćwiczenia', !lay.more);
  ok('bez małej miniatury ćwiczenia', !lay.thumb);
  ok('bez kafelków „Ostatni trening” i „Dzisiaj”', !lay.tiles && !/Ostatni trening/.test(lay.text) && !/Dzisiaj:/.test(lay.text), lay.text.slice(0, 200));
  ok('duży poziomy film na całą szerokość', lay.vid && lay.vid.w >= 340 && lay.vidLandscape, JSON.stringify(lay.vid));
  ok('film nie gra sam (bez <video> i iframe na ekranie)', lay.videos === 0 && lay.autoplay === 0);
  ok('numery serii 1–4: bieżąca + do zrobienia', lay.dots.length === 4 && /is-now:1/.test(lay.dots[0]) && lay.dots.slice(1).every(d => /^:\d/.test(d)), JSON.stringify(lay.dots));
  ok('Ciężar po lewej, Powtórzenia po prawej, równe kafelki', lay.kg && lay.reps && lay.kg.r <= lay.reps.l && Math.abs(lay.kg.w - lay.reps.w) <= 2 && Math.abs(lay.kg.t - lay.reps.t) <= 2, JSON.stringify([lay.kg, lay.reps]));
  ok('wartości z planu trenera wpisane (57,5 kg × 11)', lay.kgVal === '57,5' && lay.repsVal === '11', lay.kgVal + ' × ' + lay.repsVal);
  ok('„✓ Zapisz serię” z ikoną', /^Zapisz serię$/.test(lay.saveText) && lay.saveIcon, lay.saveText);
  ok('kluczowe elementy bez przewijania (do −/+ i zapisu)', lay.kg.b <= lay.save.t && lay.save.b <= lay.vh, JSON.stringify({ kg: lay.kg, save: lay.save, vh: lay.vh }));
  ok('cele dotykowe nagłówka ≥ 44 px', [lay.back, lay.voice, lay.hist].every(b => b && b.w >= 44 && b.h >= 44), JSON.stringify([lay.back, lay.voice, lay.hist]));
  ok('„Pomoc i opcje” zamiast „…”', lay.help);

  // ---------- Historia: najpierw ostatni trening, zamknięcie nie zmienia wartości ----------
  await page.fill('[data-cs-field="kg"]', '52,5');
  await page.fill('[data-cs-field="reps"]', '9');
  await page.click('[data-cs-history]');
  await page.waitForSelector('.cs-sheet-wrap[data-cs-sheet="history"]');
  const hs = await page.evaluate(() => {
    const sh = document.querySelector('.cs-sheet');
    const secs = [...sh.querySelectorAll('h3')].map(h => h.innerText);
    return { text: sh.innerText, secs, last: (sh.querySelector('[data-cs-hist-last]') || {}).innerText || '', prog: (sh.querySelector('[data-cs-hist-prog]') || {}).innerText || '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'variant_c_history.png') });
  ok('historia: pierwszy jest ostatni trening z datą', /^Ostatni trening · \S+/.test(hs.secs[0] || ''), JSON.stringify(hs.secs));
  ok('historia: każda seria ostatniego treningu', /Seria 1\s+12 × 55 kg/.test(hs.last) && /Seria 4\s+11 × 55 kg/.test(hs.last), hs.last);
  ok('historia: progresja z prawdziwych danych', /o 1 powtórzenie więcej/.test(hs.prog), hs.prog);
  ok('historia: wcześniejsze treningi', /Wcześniejsze treningi/.test(hs.text) && /10 × 52,5 kg/.test(hs.text), hs.text);
  ok('historia: bez trwającego treningu i bez pustej listy „Dzisiaj”', !/do zrobienia/.test(hs.text));
  await page.click('.cs-sheet [data-cs-sheet-first]');
  await page.waitForSelector('.cs-sheet-wrap', { state: 'detached' });
  const kept = await page.evaluate(() => ({ kg: document.querySelector('[data-cs-field="kg"]').value, reps: document.querySelector('[data-cs-field="reps"]').value, set: document.querySelector('.cs-set-no').innerText }));
  ok('zamknięcie historii nie zmienia wpisanych wartości ani serii', kept.kg === '52,5' && kept.reps === '9' && /Seria 1 z 4/.test(kept.set), JSON.stringify(kept));

  // ---------- Zapis: jeden dotyk, podwójne dotknięcie = jedna seria ----------
  await page.evaluate(() => { const b = document.querySelector('[data-cs-primary="save"]'); b.click(); b.click(); });
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => ({ done: window._cw.exercises[0].sets.filter(s => s.done).length, first: window._cw.exercises[0].sets[0], rest: !!document.querySelector('.cw-rest, .cs-restbar') }));
  ok('podwójne dotknięcie zapisuje jedną serię', saved.done === 1, JSON.stringify(saved));
  ok('zapisane faktyczne wartości (52,5 × 9)', String(saved.first.kg).replace(',', '.') === '52.5' && String(saved.first.reps) === '9', JSON.stringify(saved.first));
  ok('przerwa startuje sama po zapisie', saved.rest);
  await page.evaluate(() => { if (typeof cwSkipRest === 'function') cwSkipRest(); });
  await page.waitForSelector('[data-cs-primary="save"]');
  const after = await page.evaluate(() => ({ dots: [...document.querySelectorAll('.cs-set .cs-dots span')].map(s => s.className + ':' + s.textContent), label: document.querySelector('.cs-set .cs-dots').getAttribute('aria-label') }));
  ok('zrobiona seria = ✓ (nie tylko kolor), następna bieżąca', /is-done:✓/.test(after.dots[0]) && /is-now:2/.test(after.dots[1]), JSON.stringify(after.dots));
  ok('numery serii opisane dla czytnika', /zrobione: 1/.test(after.label || ''), after.label);
  await page.click('[data-cs-history]');
  const todayHist = await page.evaluate(() => document.querySelector('.cs-sheet').innerText);
  ok('historia: dzisiejsza seria z „Cofnij”', /Dzisiaj\s+1 z 4/.test(todayHist) && /52,5 kg/.test(todayHist) && /Cofnij/.test(todayHist), todayHist);
  await page.click('.cs-sheet [data-cs-sheet-first]');

  // ---------- Głośnik: jedno dotknięcie, pamiętane, nie zatrzymuje timera ----------
  const v0 = await page.getAttribute('[data-pv-mute]', 'aria-pressed');
  await page.click('[data-pv-mute]');
  const v1 = await page.evaluate(() => ({ pressed: document.querySelector('[data-pv-mute]').getAttribute('aria-pressed'), enabled: typeof pvSettings === 'function' ? pvSettings().enabled : null }));
  ok('głośnik: jedno dotknięcie wycisza (przekreślona ikona)', v0 === 'false' && v1.pressed === 'true' && v1.enabled === false, JSON.stringify([v0, v1]));
  await page.waitForTimeout(800); // blokada podwójnego dotknięcia po poprzednim zapisie (700 ms)
  await page.click('[data-cs-primary="save"]');
  await page.waitForTimeout(1300);
  const timer = await page.evaluate(() => ({ done: window._cw.exercises[0].sets.filter(s => s.done).length, running: !!window._cwRestTimer, left: window._cw.restLeft }));
  ok('wyciszenie nie zatrzymuje timera przerwy', timer.done === 2 && timer.running && timer.left > 0 && timer.left < 90, JSON.stringify(timer));

  // ---------- Pomoc i opcje: funkcje z dawnego „…” dalej dostępne ----------
  await page.evaluate(() => { if (typeof cwSkipRest === 'function') cwSkipRest(); });
  await page.waitForSelector('[data-cs-help]');
  await page.click('[data-cs-help]');
  const menu = await page.evaluate(() => document.querySelector('.cs-sheet').innerText);
  ok('pomoc: pomiń, film do trenera, lista, ból, zakończ', /Pomoc i opcje/.test(menu) && /Pomiń ćwiczenie/.test(menu) && /Lista ćwiczeń/.test(menu) && /Zgłoś ból/.test(menu) && /Zakończ trening/.test(menu), menu);
  ok('bez błędów JS (390)', errors.length === 0, errors.join(' | '));
  await page.close();

  // ---------- Zakres powtórzeń z planu: linia „Plan: 10–12 powt.” ----------
  ({ page, errors } = await openWorkout(browser, 360, 740));
  await page.evaluate(() => cwGoEx(1));
  await page.waitForSelector('[data-cs-target]');
  const pl = await page.evaluate(() => document.querySelector('[data-cs-target]').innerText);
  ok('zakres z planu pokazany raz („Plan: 10–12 powt.”)', /^Plan: 10–12 powt\.$/.test(pl), pl);
  await page.close();

  // ---------- Małe ekrany i duża czcionka ----------
  for (const [w, h] of [[360, 740], [375, 667], [320, 568]]) {
    ({ page, errors } = await openWorkout(browser, w, h));
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const kg = r('[data-cs-box="kg"]'), save = r('[data-cs-primary="save"]');
      const sc = document.querySelector('#clive-player .cs-ex-scroll');
      return { kgBottom: Math.round(kg.bottom), saveTop: Math.round(save.top), saveBottom: Math.round(save.bottom), vh: innerHeight, hOverflow: document.documentElement.scrollWidth > innerWidth + 1, scroll: sc.scrollHeight > sc.clientHeight };
    });
    await page.screenshot({ path: path.join(shotDir, 'variant_c_' + w + 'x' + h + '.png') });
    const fits = m.kgBottom <= m.saveTop && m.saveBottom <= m.vh;
    if (w >= 360) ok(w + '×' + h + ': pola i „Zapisz serię” bez przewijania', fits, JSON.stringify(m));
    else ok(w + '×' + h + ': przycisk zapisu zawsze widoczny (reszta może się przewijać)', m.saveBottom <= m.vh && (fits || m.scroll), JSON.stringify(m));
    ok(w + '×' + h + ': bez przewijania w poziomie', !m.hOverflow);
    await page.close();
  }
  ({ page, errors } = await openWorkout(browser, 390, 844));
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await page.waitForTimeout(200);
  const big = await page.evaluate(() => {
    const sc = document.querySelector('#clive-player .cs-ex-scroll');
    const name = document.querySelector('.cs-ex-top .cs-ex-name');
    const save = document.querySelector('[data-cs-primary="save"]').getBoundingClientRect();
    return { canScroll: sc.scrollHeight > sc.clientHeight && getComputedStyle(sc).overflowY !== 'hidden', saveVisible: save.bottom <= innerHeight, hOverflow: document.documentElement.scrollWidth > innerWidth + 1, nameTitle: name.getAttribute('title') };
  });
  await page.screenshot({ path: path.join(shotDir, 'variant_c_bigfont.png') });
  ok('duża czcionka: treść przewija się zamiast ucinać, zapis widoczny', big.canScroll && big.saveVisible && !big.hOverflow, JSON.stringify(big));
  ok('pełna nazwa ćwiczenia dostępna mimo skrócenia w nagłówku', /Wyciskanie sztangi na ławce płaskiej/.test(big.nameTitle || ''));
  await page.close();

  await browser.close();
  if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
  console.log('All variant C checks passed');
})().catch(e => { console.error(e); process.exit(1); });
