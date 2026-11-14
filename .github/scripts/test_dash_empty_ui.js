#!/usr/bin/env node
'use strict';
/** UI (Etap 1 UX): pusty pulpit = jedna karta „Pierwszy krok” z jednym czerwonym przyciskiem; z klientami układ bez zmian. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function openDash(browser, viewport, clients) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((list) => {
    window.persistById = async (_c, o) => o;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = 'flex';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL.length = 0;
    list.forEach((c) => window.CL.push(c));
    goTo('dashboard');
    renderDash();
  }, clients);
  await page.waitForTimeout(250);
  return page;
}

const visiblePrimary = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#screen-dashboard .btn-primary')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()));

(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const tag = vp.width + 'px';
    let page = await openDash(browser, vp, []);
    ok(tag + ' empty: dash-empty class', await page.locator('#screen-dashboard.dash-empty').count() === 1);
    const prim = await visiblePrimary(page);
    ok(tag + ' empty: exactly one red button "Dodaj klienta"', prim.length === 1 && prim[0] === 'Dodaj klienta', JSON.stringify(prim));
    ok(tag + ' empty: three steps', await page.locator('#dash-next-action .dash-first-steps li').count() === 3);
    for (const sel of ['#dash-ops-attention', '#dash-ops-today', '#dash-getting-started', '#dash-profile-setup', '.dash3-qa-grid', '#dash-qa-btn', '#dash-simple-toggle']) {
      ok(tag + ' empty: hidden ' + sel, await page.locator(sel).first().isHidden());
    }
    ok(tag + ' empty: "Twój dzień" visible', await page.locator('.dash3-day').isVisible());
    const addCount = await page.evaluate(() => [...document.querySelectorAll('#screen-dashboard button')]
      .filter((b) => b.offsetParent !== null && /Dodaj klienta|Nowy klient/.test(b.textContent)).length);
    ok(tag + ' empty: "Dodaj klienta" appears once', addCount === 1, String(addCount));
    await page.click('#dash-next-action .btn-primary');
    await page.waitForTimeout(150);
    ok(tag + ' empty: button opens client form', await page.locator('#m-client').isVisible());
    await page.close();

    page = await openDash(browser, vp, [{ id: 'u1', name: 'Anna Nowak', email: 'a@x.pl', status: 'active', goal: 'redukcja' }]);
    ok(tag + ' with client: no dash-empty', await page.locator('#screen-dashboard.dash-empty').count() === 0);
    ok(tag + ' with client: attention + today back', await page.locator('#dash-ops-attention').isVisible() && await page.locator('#dash-ops-today').isVisible());
    ok(tag + ' with client: no first-steps list', await page.locator('#dash-next-action .dash-first-steps').count() === 0);
    if (vp.width > 900) {
      ok(tag + ' with client: quick actions back', await page.locator('.dash3-qa-grid').isVisible());
      ok(tag + ' toggle label shows state', /^Widok: (prosty|pełny)$/.test((await page.locator('#dash-simple-toggle').textContent()).trim()));
    }
    await page.close();
  }
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('All empty dashboard UI tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
