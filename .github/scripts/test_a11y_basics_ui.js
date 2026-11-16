#!/usr/bin/env node
'use strict';
/** UI (Etap 8 UX): dostępność — link „Przejdź do treści”, h1 na ekranach, okna jako dialog z pułapką fokusu i Esc,
 *  nazwa ćwiczenia jako osobny przycisk, etykiety pól wyboru, zegar przerwy bez „assertive”, obrys fokusu, mniej ruchu. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'theme.css'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

// Znaczniki
ok('skip link first in app', /<div class="app" id="app-root"[^>]*>\r?\n<a class="skip-link" href="#main">Przejdź do treści<\/a>/.test(html));
ok('main landmark', html.includes('<div class="main" id="main" role="main" tabindex="-1">'));
ok('screen titles are h1', !html.includes('<div class="topbar-title"') && (html.match(/<h1 class="topbar-title"/g) || []).length >= 28);
ok('select labels', html.includes('id="tmpl-client-sel" aria-label=') && html.includes('id="cap-client-sel" aria-label=') && html.includes('id="lib-filters-btn" onclick="toggleExFilters()" aria-label="Filtry ćwiczeń"'));
ok('rest timers not assertive', !/live-(b-)?rest-timer" aria-live="assertive"/.test(html) && html.includes('id="live-rest-timer" role="timer" aria-live="off"') && html.includes('id="live-rest-sr" aria-live="polite"') && html.includes('id="live-b-rest-sr" aria-live="polite"'));
ok('rest announced only at 10, 3, 0', /liveRestPaint\(n,phase\);\r?\n    liveRestAnnounce\(n,left\);/.test(live));
ok('focus ring 3px dark', theme.includes('html[data-theme] :focus-visible { outline: 3px solid var(--text-primary) !important;'));
ok('global reduced motion', /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0\.01ms !important;/.test(theme));

async function open(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: (opts && opts.reducedMotion) || 'no-preference' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = 'flex';
    const l = document.getElementById('app-loading'); if (l) l.style.display = 'none';
    window.CL.length = 0; window.CL.push({ id: 'u1', name: 'Anna Nowak', email: 'a@x.pl', status: 'active' });
    goTo('dashboard');
  });
  await page.waitForTimeout(250);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  try {
    let { ctx, page } = await open(browser);
    // Skip link
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Tab');
    ok('first Tab shows skip link', await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('skip-link')));
    const top = await page.$eval('.skip-link', (e) => e.getBoundingClientRect().top);
    ok('skip link visible on focus', top >= 0, String(top));
    const ring = await page.$eval('.skip-link', (e) => getComputedStyle(e).outlineWidth);
    ok('focus ring is 3px', ring === '3px', ring);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    ok('skip link moves focus to main', await page.evaluate(() => document.activeElement && document.activeElement.id === 'main'));
    ok('dashboard has one visible h1', await page.evaluate(() => [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length === 1));

    // Okno: dialog, fokus w środku, Tab zostaje w oknie, Esc zamyka i wraca fokus
    await page.evaluate(() => { const b = document.createElement('button'); b.id = 'a11y-opener'; b.textContent = 'Otwórz'; b.onclick = () => openM('m-broadcast'); document.getElementById('main').prepend(b); });
    await page.focus('#a11y-opener');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const dlg = await page.$eval('#m-broadcast .modal', (e) => [e.getAttribute('role'), e.getAttribute('aria-modal'), (document.getElementById(e.getAttribute('aria-labelledby')) || {}).textContent || '']);
    ok('modal is labelled dialog', dlg[0] === 'dialog' && dlg[1] === 'true' && dlg[2].length > 3, JSON.stringify(dlg));
    ok('focus moved into modal', await page.evaluate(() => document.getElementById('m-broadcast').contains(document.activeElement)));
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    ok('Tab stays inside modal', await page.evaluate(() => document.getElementById('m-broadcast').contains(document.activeElement)));
    await page.keyboard.press('Shift+Tab');
    ok('Shift+Tab stays inside modal', await page.evaluate(() => document.getElementById('m-broadcast').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    ok('Escape closes modal', !(await page.evaluate(() => document.getElementById('m-broadcast').classList.contains('show'))));
    ok('focus returns to opener', await page.evaluate(() => document.activeElement && document.activeElement.id === 'a11y-opener'));

    // Biblioteka: nazwa ćwiczenia jest przyciskiem, karta nie
    await page.evaluate(() => goTo('library'));
    await page.waitForSelector('#lib-grid .exl-card');
    const card = await page.$eval('#lib-grid .exl-card', (c) => ({ role: c.getAttribute('role'), tab: c.getAttribute('tabindex'), btn: c.querySelector('button.exl-name') ? c.querySelector('button.exl-name').textContent : '' }));
    ok('card is not a button, name is', card.role === null && card.tab === null && card.btn.length > 2, JSON.stringify(card));
    await page.focus('#lib-grid button.exl-name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    ok('Enter on name opens details', await page.evaluate((n) => (document.getElementById('exd-title') || {}).textContent === n, card.btn));
    const nested = await page.evaluate(() => [...document.querySelectorAll('#lib-grid [role="button"] button, #lib-grid button button')].length);
    ok('no nested interactive in library', nested === 0, String(nested));

    // Ogłoszenia przerwy
    const txt = await page.evaluate(() => [10, 9, 3, 1, 0].map((n) => window.liveRestAnnounceText(n)));
    ok('rest announcements text', txt[0] === 'Zostało 10 sekund przerwy' && txt[1] === '' && txt[2] === 'Zostały 3 sekundy' && txt[3] === '' && txt[4] === 'Koniec przerwy', JSON.stringify(txt));
    await ctx.close();

    ({ ctx, page } = await open(browser, { reducedMotion: 'reduce' }));
    const dur = await page.$eval('.nav-item', (e) => getComputedStyle(e).transitionDuration);
    ok('reduced motion: transitions off', dur.split(',').every((d) => parseFloat(d) <= 0.0001), dur);
    await ctx.close();
  } catch (e) {
    console.error('FAIL exception — ' + (e && e.stack || e));
    failed++;
  } finally {
    await browser.close();
  }
  if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
  console.log('\nAll a11y basics tests passed');
})();
