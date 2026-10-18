// UI: pilne błędy Biblioteki z audytu 18.10 — menu na telefonie, checkboxy, pole klienta,
// cudzysłów i HTML w nazwie ćwiczenia, karty widoczne po kliknięciu.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

async function bootApp(page, port) {
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Anna Kowalska' }, { id: 'c2', name: 'Jan Nowak' }];
  });
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const errors = [];

  // 1. Telefon: podmenu Biblioteki da się stuknąć.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    await bootApp(page, port);
    await page.click('#mobile-menu-btn');
    await page.waitForTimeout(300);
    await page.click('#nav-library-btn');
    await page.waitForTimeout(300);
    const item = page.locator('#nav-library-flyout .nav-flyout-item[data-screen="plans"]');
    const hit = await item.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top));
    });
    ok('mobile flyout item is on top', hit);
    await item.tap();
    await page.waitForTimeout(300);
    const active = await page.evaluate(() => (document.querySelector('.screen.active') || {}).id);
    ok('mobile tap Treningi opens plans', active === 'screen-plans', active);
    await ctx.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await bootApp(page, port);

  // 2. Checkboxy w oknie „Zadanie domowe” są widoczne.
  const cb = await page.evaluate(() => {
    if (typeof openAssignHomeworkModal === 'function') openAssignHomeworkModal();
    const el = document.querySelector('#m-assign-homework .ahw-cid') || document.querySelector('#m-assign-homework input[type=checkbox]');
    const r = el ? el.getBoundingClientRect() : { width: 0, height: 0 };
    if (typeof closeM === 'function') closeM('m-assign-homework');
    return { found: !!el, w: r.width, h: r.height };
  });
  ok('homework checkbox visible', cb.found && cb.w > 0 && cb.h > 0, JSON.stringify(cb));

  // 3. Pole klienta: zmiana tekstu bez kliknięcia nie zostawia poprzedniego klienta.
  const pick = await page.evaluate(() => {
    goTo('programs');
    const p = allPrograms()[0];
    openAssignProg(p.id);
    assignProgSetClientField('c1', 'Anna Kowalska');
    const vis = document.getElementById('assign-prog-client-search');
    vis.value = 'Jan';
    assignProgClientSearchInput();
    const afterPartial = document.getElementById('assign-prog-client').value;
    vis.value = 'Jan Nowak';
    assignProgClientSearchInput();
    const afterFull = document.getElementById('assign-prog-client').value;
    closeM('m-assign-prog');
    return { afterPartial, afterFull };
  });
  ok('partial retype clears previous client', pick.afterPartial === '', JSON.stringify(pick));
  ok('full name selects typed client', pick.afterFull === 'c2', JSON.stringify(pick));

  // 4. Ćwiczenie z cudzysłowem i HTML w nazwie: otwiera się, kod się nie wykonuje.
  await page.evaluate(() => {
    window.__xss = 0;
    window.EX = window.EX || [];
    window.EX.push({ id: 'ex_q', name: 'Box jump 30"', cat: 'Nogi', eq: 'Bez sprzętu', tip: '' });
    window.EX.push({ id: 'ex_x', name: 'Zz <img src=x onerror="window.__xss++">', cat: 'Nogi', eq: 'Bez sprzętu', tip: '<b onmouseover=1>t</b>' });
    goTo('library');
    setExView('grid');
    const inp = document.getElementById('ex-search');
    inp.value = 'Box jump 30';
    renderLib();
  });
  await page.waitForSelector('.ex-card');
  await page.locator('.ex-card', { hasText: 'Box jump 30"' }).first().click();
  await page.waitForTimeout(200);
  const title = await page.evaluate(() => (document.getElementById('exd-title') || {}).textContent);
  ok('quote name opens detail', title === 'Box jump 30"', title);

  await page.evaluate(() => {
    document.getElementById('ex-search').value = 'Zz';
    renderLib();
  });
  await page.waitForTimeout(400);
  const xss = await page.evaluate(() => ({ n: window.__xss, imgs: document.querySelectorAll('#lib-grid .ex-card-name img').length }));
  ok('html in name is not executed', xss.n === 0 && xss.imgs === 0, JSON.stringify(xss));

  // 5. Klik w ćwiczenie nie chowa kart na dole listy.
  await page.evaluate(() => {
    document.getElementById('ex-search').value = '';
    renderLib();
    const view = document.getElementById('ex-grid-view');
    view.scrollTop = view.scrollHeight / 2;
  });
  await page.waitForTimeout(500);
  const vis = await page.evaluate(async () => {
    const view = document.getElementById('ex-grid-view');
    const vr = view.getBoundingClientRect();
    const inView = () => [...document.querySelectorAll('#lib-grid .ex-card')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > vr.top && r.top < vr.bottom;
    });
    const target = inView()[2];
    target.click();
    await new Promise((r) => setTimeout(r, 700));
    const cards = inView();
    const shown = cards.filter((el) => Number(getComputedStyle(el).opacity) > 0.9).length;
    return { total: cards.length, shown, selected: target.classList.contains('selected') };
  });
  ok('cards stay visible after click', vis.total > 0 && vis.shown === vis.total, JSON.stringify(vis));
  ok('clicked card is highlighted', vis.selected, JSON.stringify(vis));

  // 6. Pusta grupa pomiarów nie pokazuje kodu.
  const metricTxt = await page.evaluate(() => {
    goTo('metrics');
    return document.getElementById('screen-metrics').innerText;
  });
  ok('metrics show no template code', !metricTxt.includes('${'), metricTxt.slice(0, 120));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('All lib urgent-bug UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
