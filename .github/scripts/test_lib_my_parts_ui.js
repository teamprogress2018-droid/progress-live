// Biblioteka → „Moje ćwiczenia”: podział na partie (sekcje + przyciski z liczbami) i wyszukiwanie w tej zakładce.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof exBodyPart === 'function');
  const parts = await page.evaluate(() => {
    const t = (name, cat, muscle) => exBodyPart({ name, cat: cat || 'Inne', muscle: muscle || '' });
    return {
      legExt: t('Prostowanie nóg na maszynie', 'Triceps', 'Triceps'), calf: t('Wspięcia na palce na suwnicy'), dead: t('Martwy robak'),
      pull: t('Ściąganie drążka wyciągu górnego'), face: t('Ściąganie do twarzy (face pull)'), ohp: t('Wyciskanie hantli siedząc'),
      bench: t('Wyciskanie hantli na ławce skośnej'), row: t('Wiosłowanie z podparciem klatki na ławce'), shrug: t('Szrugsy z hantlami'),
      curl: t('Uginanie na wyciągu'), legCurl: t('Uginanie nóg siedząc'), tri: t('Prostowanie linką'), hip: t('Mostek biodrowy'),
      bike: t('Airbike'), rdl: t('Rumuński martwy ciąg ze sztangą'), revfly: t('Odwrotne rozpiętki na maszynie'), unknown: t('Coś nowego', 'Inne', '')
    };
  });
  const want = { legExt: 'nogi', calf: 'nogi', dead: 'core', pull: 'plecy', face: 'barki', ohp: 'barki', bench: 'klatka', row: 'plecy', shrug: 'plecy',
    curl: 'biceps', legCurl: 'nogi', tri: 'triceps', hip: 'posladki', bike: 'kondycja', rdl: 'nogi', revfly: 'barki', unknown: 'inne' };
  const bad = Object.keys(want).filter(k => parts[k] !== want[k]).map(k => k + '=' + parts[k]);
  ok('partie z nazwy, mimo błędnej kategorii', !bad.length, bad.join(', '));
  const r = await page.evaluate(async () => {
    window.persistById = async (_c, o) => o; window.notify = () => {};
    ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
    window._uid = 't1'; window.CL = [];
    const lib = allExercises();
    const pick = re => (lib.find(e => re.test(e.name) && !/\(/.test(e.name)) || {}).name;
    const a = pick(/^Wiosłowanie hantlem/), b = pick(/^Wyciskanie hantli na ławce skośnej/), c = pick(/^Przysiad ze sztangą/);
    window.PL = [{ id: '1', updatedAt: '2026-11-01', days: [{ exercises: [{ name: a }, { name: b }, { name: c }] }] }, { id: '2', updatedAt: '2026-11-02', days: [{ exercises: [{ name: a }] }] }];
    goTo('library'); setExTab('own');
    await new Promise(r => setTimeout(r, 200));
    const secs = [...document.querySelectorAll('#lib-grid [data-ex-part-sec]')].map(s => s.dataset.exPartSec);
    const chips = [...document.querySelectorAll('#ex-cat-nav [data-ex-part]')].map(c => c.dataset.exPart + ':' + c.textContent.replace(/\D+/g, ''));
    const firstPlecy = (document.querySelector('[data-ex-part-sec="plecy"] .exl-name') || {}).textContent || '';
    setExGroup('plecy'); await new Promise(r => setTimeout(r, 100));
    const onlyPlecy = [...document.querySelectorAll('#lib-grid .exl-card .exl-name')].map(x => x.textContent);
    setExGroup('');
    const s = document.getElementById('ex-search'); s.value = 'przysiad'; s.dispatchEvent(new Event('input', { bubbles: true })); if (typeof renderLib === 'function') renderLib();
    await new Promise(r => setTimeout(r, 300));
    const found = [...document.querySelectorAll('#lib-grid .exl-card .exl-name')].map(x => x.textContent);
    return { a, b, c, secs, chips, firstPlecy, onlyPlecy, found };
  });
  ok('sekcje według partii', r.secs.includes('plecy') && r.secs.includes('klatka') && r.secs.includes('nogi'), JSON.stringify(r.secs));
  ok('przyciski partii z liczbami', r.chips.some(c => /^plecy:\d+/.test(c)) && r.chips.some(c => /^nogi:\d+/.test(c)), JSON.stringify(r.chips));
  ok('w sekcji najczęściej używane na górze', r.firstPlecy.trim().startsWith(r.a), r.firstPlecy);
  ok('filtr partii', r.onlyPlecy.length > 0 && r.onlyPlecy[0].startsWith(r.a), JSON.stringify(r.onlyPlecy.slice(0, 3)));
  ok('wyszukiwanie w „Moich ćwiczeniach”', r.found.length > 0 && r.found.every(n => /przysiad/i.test(n)) && r.found[0].startsWith(r.c), JSON.stringify(r.found.slice(0, 4)));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll library parts checks passed');
})().catch(e => { console.error(e); process.exit(1); });
