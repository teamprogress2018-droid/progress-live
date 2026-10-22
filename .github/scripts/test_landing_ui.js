#!/usr/bin/env node
'use strict';
/** UI: strona startowa — ruchome kafelki z wynikami, okno logowania i zaproszenia, telefon, prefers-reduced-motion. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const base = 'http://localhost:' + (process.env.LANDING_PORT || '8080') + '/index.html';

async function open(browser, opts, query) {
  const ctx = await browser.newContext({ viewport: opts.viewport, reducedMotion: opts.reducedMotion || 'no-preference' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(base + (query || ''), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#auth-screen .pl-land-stat');
  await page.waitForTimeout(600);
  return { ctx, page };
}
const trackY = (page, i) => page.evaluate((n) => {
  const t = document.querySelectorAll('#auth-screen .pl-land-track')[n];
  return new DOMMatrixReadOnly(getComputedStyle(t).transform).m42;
}, i);
const trackX = (page, i) => page.evaluate((n) => {
  const t = document.querySelectorAll('#auth-screen .pl-land-track')[n];
  return new DOMMatrixReadOnly(getComputedStyle(t).transform).m41;
}, i);

(async () => {
  const browser = await chromium.launch();
  try {
    // Komputer
    let { ctx, page } = await open(browser, { viewport: { width: 1440, height: 900 } });
    ok('landing visible', await page.isVisible('#pl-land-title'));
    ok('16 stat tiles in two tracks', (await page.locator('#auth-screen .pl-land-stat').count()) === 16);
    ok('example data note visible', await page.isVisible('#pl-land-stats-note'));
    const valueSize = await page.$eval('#auth-screen .pl-land-stat-value', (e) => parseFloat(getComputedStyle(e).fontSize));
    ok('big numbers on tiles', valueSize >= 34, String(valueSize));
    const darkContrast = await page.$eval('#auth-screen .pl-land-stat--dark .pl-land-stat-text', (e) => [getComputedStyle(e).color, getComputedStyle(e.parentElement).backgroundColor]);
    ok('dark tile text is light on dark', darkContrast[0] === 'rgb(201, 201, 201)' && darkContrast[1] === 'rgb(22, 22, 22)', darkContrast.join(' on '));
    const y1 = await trackY(page, 0); const y2 = await trackY(page, 1);
    await page.waitForTimeout(1200);
    const y1b = await trackY(page, 0); const y2b = await trackY(page, 1);
    ok('first column moves up', y1b < y1, y1 + ' → ' + y1b);
    ok('second column moves down', y2b > y2, y2 + ' → ' + y2b);
    const titleSize = await page.$eval('#pl-land-title', (e) => parseFloat(getComputedStyle(e).fontSize));
    ok('big headline', titleSize >= 56, String(titleSize));
    ok('dialog hidden at start', !(await page.isVisible('#auth-card')));

    await page.fill('#pl-land-email', 'trener@przyklad.pl');
    await page.click('#pl-land-start-btn');
    ok('start opens login dialog', await page.isVisible('#auth-card') && await page.isVisible('#auth-login-btn'));
    ok('email carried into login', (await page.inputValue('#auth-email')) === 'trener@przyklad.pl');
    await page.waitForTimeout(100);
    ok('focus on password', await page.evaluate(() => document.activeElement && document.activeElement.id === 'auth-password'));
    await page.keyboard.press('Escape');
    ok('Escape closes dialog', !(await page.isVisible('#auth-card')));

    await page.click('#pl-land-login-top');
    ok('top button opens login', await page.isVisible('#auth-login-btn'));
    await page.click('.pl-auth-backdrop', { position: { x: 10, y: 10 } });
    ok('backdrop closes dialog', !(await page.isVisible('#auth-card')));

    await page.click('.pl-land-link');
    ok('invite link opens register form', await page.isVisible('#auth-reg-btn') && !(await page.isVisible('#auth-login-btn')));
    await page.click('#auth-register-view button[onclick="authShowLoginFromClient()"]');
    ok('back to login inside dialog', await page.isVisible('#auth-login-btn') && await page.isVisible('#auth-card'));
    await page.click('#auth-login-view button[onclick="authShowReset()"]');
    ok('password reset inside dialog', await page.isVisible('#auth-reset-view') && await page.isVisible('#auth-card'));
    await page.click('.pl-auth-close');
    ok('close button closes dialog', !(await page.isVisible('#auth-card')));
    await ctx.close();

    // Link z zaproszeniem od razu pokazuje formularz klienta
    ({ ctx, page } = await open(browser, { viewport: { width: 1280, height: 800 } }, '?invite=abc123'));
    await page.waitForTimeout(300);
    ok('invite URL opens register dialog', await page.isVisible('#auth-reg-btn'));
    ok('invite token filled', (await page.inputValue('#auth-reg-token')) === 'abc123');
    await ctx.close();

    // Telefon
    ({ ctx, page } = await open(browser, { viewport: { width: 390, height: 844 } }));
    const noHScroll = await page.evaluate(() => {
      const s = document.getElementById('auth-screen');
      return s.scrollWidth <= s.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1;
    });
    ok('phone: no horizontal scroll', noHScroll);
    ok('phone: login button visible on first screen', await page.isVisible('#pl-land-start-btn') && (await page.$eval('#pl-land-start-btn', (e) => e.getBoundingClientRect().bottom)) <= 844);
    ok('phone: invite button in header hidden', !(await page.isVisible('.pl-land-top-invite')));
    const x1 = await trackX(page, 0); const x2 = await trackX(page, 1);
    await page.waitForTimeout(1200);
    ok('phone: tile rows move sideways in opposite directions', (await trackX(page, 0)) < x1 && (await trackX(page, 1)) > x2);
    await page.click('#pl-land-login-top');
    const box = await page.$eval('#auth-card', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    ok('phone: dialog fits screen', box.l >= 0 && box.r <= 390, JSON.stringify(box));
    await ctx.close();

    // Bez ruchu
    ({ ctx, page } = await open(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }));
    const anim = await page.$eval('#auth-screen .pl-land-track', (e) => getComputedStyle(e).animationName);
    const r1 = await trackY(page, 0);
    await page.waitForTimeout(800);
    ok('reduced motion: no animation', anim === 'none' && (await trackY(page, 0)) === r1, anim);
    await ctx.close();
  } catch (e) {
    console.error('FAIL exception — ' + (e && e.stack || e));
    failed++;
  } finally {
    await browser.close();
  }
  if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
  console.log('\nAll landing UI tests passed');
})();
