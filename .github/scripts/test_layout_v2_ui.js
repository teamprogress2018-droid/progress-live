#!/usr/bin/env node
'use strict';
/** UI: Układ 2.0 — menu wysuwane (mysz, klik, klawiatura), panel widoków klientów, telefon. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function openApp(browser, viewport) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    try { localStorage.removeItem('pl_sidebar_collapsed'); localStorage.removeItem('pl_clients_hidden_cols'); localStorage.removeItem('pl_clients_subnav'); } catch (e) {}
    window.persistById = async (_c, o) => o;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = 'flex';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL.length = 0;
    window.CL.push({ id: 'u1', name: 'Anna Nowak', email: 'a@x.pl', status: 'active', goal: 'redukcja' },
      { id: 'u2', name: 'Jan Kowalski', email: '', status: 'inactive', goal: 'sila' });
    goTo('clients');
  });
  await page.waitForTimeout(200);
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  let page = await openApp(browser, { width: 1440, height: 900 });

  ok('second column visible', await page.locator('#cl-subnav').isVisible());
  ok('title counts clients', (await page.locator('#clients-segment-title').textContent()).replace(/\s+/g, ' ').trim() === 'Wszyscy klienci (2)');
  ok('Klienci active in sidebar', await page.locator('#nav-clients-btn.active').count() === 1);

  await page.hover('#nav-clients-btn');
  await page.waitForTimeout(150);
  ok('hover opens dark flyout', await page.locator('#nav-clients-flyout').isVisible());
  ok('trigger reports expanded', await page.getAttribute('#nav-clients-btn', 'aria-expanded') === 'true');
  const bg = await page.locator('#nav-clients-flyout').evaluate((el) => getComputedStyle(el).backgroundColor);
  ok('flyout is dark', bg === 'rgb(22, 24, 29)', bg);
  await page.click('#nav-clients-flyout [data-client-seg="inactive"]');
  await page.waitForTimeout(150);
  ok('flyout picks a view', (await page.locator('#clients-segment-title').textContent()).includes('Nieaktywni klienci (1)'));
  ok('view highlighted in second column', (await page.locator('#client-filter-list .cl-seg-item.active').textContent()).includes('Nieaktywni'));
  ok('flyout closed after pick', await page.locator('#nav-clients-flyout').isHidden());

  await page.mouse.move(900, 600);
  await page.waitForTimeout(350);
  await page.click('#nav-library-btn');
  await page.waitForTimeout(150);
  ok('library stays open after hover + click', await page.locator('#nav-library-flyout').isVisible());
  await page.click('#nav-library-flyout .nav-flyout-item[data-screen="plans"]');
  await page.waitForTimeout(150);
  ok('library item navigates', await page.locator('#screen-plans.active').count() === 1 && await page.locator('#nav-library-btn.active').count() === 1);

  await page.mouse.move(900, 600);
  await page.waitForTimeout(350);
  await page.focus('#nav-business-btn');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  ok('ArrowRight opens group', await page.locator('#nav-business-flyout').isVisible());
  ok('focus moves into menu', await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim() === 'Płatności'));
  await page.keyboard.press('ArrowDown');
  ok('ArrowDown moves focus', await page.evaluate(() => document.activeElement.textContent.trim() === 'Statystyki'));
  await page.keyboard.press('Escape');
  ok('Escape closes and returns focus', await page.locator('#nav-business-flyout').isHidden() && await page.evaluate(() => document.activeElement.id === 'nav-business-btn'));

  await page.evaluate(() => goTo('bizstats'));
  ok('group of the screen is highlighted', await page.locator('#nav-business-btn.active').count() === 1);

  await page.click('#sidebar-collapse-btn');
  await page.waitForTimeout(250);
  const w = await page.locator('#app-sidebar').evaluate((el) => el.getBoundingClientRect().width);
  ok('sidebar collapses to icons', w < 90, String(w));
  ok('collapsed icons keep accessible names', await page.locator('#app-sidebar .nav-item[data-screen="inbox"]').evaluate((el) => el.innerText.trim() === '' || getComputedStyle(el.querySelector('.nav-lbl')).display !== 'none') && (await page.getByRole('button', { name: 'Wiadomości' }).count()) >= 1);
  ok('collapse remembered', await page.evaluate(() => localStorage.getItem('pl_sidebar_collapsed') === '1'));
  await page.click('#sidebar-collapse-btn');

  await page.evaluate(() => goTo('clients'));
  await page.click('#cl-subnav-toggle');
  ok('panel toggle hides second column', await page.locator('#cl-subnav').isHidden());
  await page.click('#cl-subnav-toggle');
  await page.click('#cl-add-caret');
  ok('add-client menu opens', await page.locator('#cl-add-menu').isVisible());
  await page.keyboard.press('Escape');
  ok('Escape closes add-client menu', await page.locator('#cl-add-menu').isHidden());
  await page.click('#cl-cols-btn');
  await page.locator('#cl-cols-menu label', { hasText: 'Cel' }).locator('input').uncheck();
  const hdrCells = await page.locator('.cl-everfit-hdr span:visible').count();
  ok('column can be hidden', hdrCells === 6, String(hdrCells)); // 8 kolumn − pusta kolumna wiadomości − Cel
  const aligned = await page.evaluate(() => {
    const h = document.querySelector('.cl-everfit-hdr').children[7].getBoundingClientRect().left;
    const r = document.querySelector('.cl-everfit-row').children[7].getBoundingClientRect().left;
    return Math.abs(h - r) < 2;
  });
  ok('header and rows stay aligned', aligned);
  await page.close();

  page = await openApp(browser, { width: 390, height: 844 });
  ok('phone hides second column', await page.locator('#cl-subnav').isHidden());
  const overflow = await page.evaluate(() => {
    const box = document.getElementById('cl-everfit');
    return box.scrollWidth - box.clientWidth;
  });
  ok('phone list without horizontal scroll', overflow <= 1, String(overflow));
  ok('phone filters reachable', await page.locator('#client-status-filter').isVisible());
  await page.click('#mobile-menu-btn');
  await page.waitForTimeout(300);
  await page.click('#nav-ondemand-btn');
  await page.waitForTimeout(150);
  ok('tap opens group on phone', await page.locator('#nav-ondemand-flyout').isVisible());
  await page.click('#nav-ondemand-flyout .nav-flyout-item[data-screen="resources"]');
  await page.waitForTimeout(150);
  ok('phone flyout item navigates', await page.locator('#screen-resources.active').count() === 1);

  await browser.close();
  if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
  console.log('\nAll layout-v2 UI tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
