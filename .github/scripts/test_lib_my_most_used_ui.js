// Biblioteka → „Moje ćwiczenia”: najczęściej przypisywane do planów na górze (z licznikiem), potem własne nieużyte.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    window.persistById = async (_c, o) => o; window.notify = () => {};
    ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
    window._uid = 't1'; window.CL = [{ id: 'c1', name: 'Anna' }];
    try { localStorage.removeItem('pl_ex_usage_match_v1'); } catch (e) {}
    const lib = allExercises();
    const pickName = re => (lib.find(e => re.test(e.name) && !/\(/.test(e.name)) || {}).name;
    const a = pickName(/^Wiosłowanie hantlem/), b = pickName(/^Wyciskanie hantli na ławce skośnej/);
    EX.push({ name: 'Mój wyskok testowy', cat: 'Nogi', eq: 'Bez sprzętu', muscle: 'nogi', tip: '' });
    const mk = (id, names) => ({ id, clientId: 'c1', name: 'P' + id, updatedAt: '2026-11-0' + id, days: [{ day: 'A', exercises: names.map(n => ({ name: n })) }] });
    window.PL = [mk('1', [a, b + ' (30°)']), mk('2', [a]), mk('3', [a, a + ' — jednorącz'])];
    goTo('library'); setExTab('own');
    await new Promise(r => setTimeout(r, 300));
    const usageOf = n => { const c = [...document.querySelectorAll('#lib-grid .exl-card')].find(x => (x.querySelector('.exl-name') || x).textContent.trim() === n); return c ? ((c.querySelector('[data-ex-usage]') || {}).textContent || '') : ''; };
    // Kolejność z listy (na ekranie karty są dodatkowo w sekcjach partii).
    const cards = myExercisesList(allExercises()).map(e => ({ name: e.name, usage: usageOf(e.name) }));
    return { a, b, cards: cards.slice(0, 4), count: document.getElementById('ex-results-count').textContent, tab: (document.querySelector('[data-tab="own"]') || {}).textContent || '', hasOwn: cards.some(c => /Mój wyskok testowy/.test(c.name)), ownIdx: cards.findIndex(c => /Mój wyskok testowy/.test(c.name)) };
  });
  ok('najczęściej używane pierwsze z licznikiem', r.cards[0] && r.cards[0].name.startsWith(r.a) && /w 3 planach/.test(r.cards[0].usage), JSON.stringify(r.cards));
  ok('nazwa z planu z dopiskiem „(…)” liczy się do ćwiczenia z biblioteki', r.cards[1] && r.cards[1].name.startsWith(r.b) && /w 1 planie/.test(r.cards[1].usage), JSON.stringify(r.cards));
  ok('własne nieużyte ćwiczenia po używanych', r.hasOwn && r.ownIdx >= 2, String(r.ownIdx));
  ok('opis listy', /najczęściej używane w planach na górze/.test(r.count), r.count);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll library most-used checks passed');
})().catch(e => { console.error(e); process.exit(1); });
