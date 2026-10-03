#!/usr/bin/env node
'use strict';
/** UI: Usuń duplikaty + na ≤1200px Szczegóły/Usuń zostają, chowa się wskazówka. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.EX_DEDUP_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-ex-dedup'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window._uid = 'trainer-1';
    window._db = {};
    window._del = async () => {};
    window._doc = (_db, col, id) => ({ col, id });
    window._setDoc = async () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr' }];
    window.EX = [
      { id: 'ex-floor', name: 'Floor press', video: 'https://cdn.example.com/floor.mp4', cat: 'Klatka piersiowa', eq: 'Sztanga' }
    ];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    if (typeof setExView === 'function') setExView('list');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Wyciskanie z podłogi';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-list-row');

  const ui = await page.evaluate(() => {
    const btn = document.getElementById('lib-sweep-dups');
    const row = [...document.querySelectorAll('.ex-list-row')].find((el) => /Wyciskanie z podłogi/.test(el.textContent || ''));
    const tip = row && row.querySelector('.ex-list-tip');
    const actions = row && row.querySelector('.ex-list-actions');
    const sz = actions && [...actions.querySelectorAll('button')].find((b) => /Szczegóły/.test(b.textContent || ''));
    const del = actions && [...actions.querySelectorAll('button')].find((b) => /Usuń/.test(b.textContent || ''));
    const cs = (el) => (el ? getComputedStyle(el).display : '');
    return {
      btn: !!(btn && /Usuń duplikaty/.test(btn.textContent || '')),
      row: !!row,
      tipDisplay: cs(tip),
      actionsDisplay: cs(actions),
      szDisplay: cs(sz),
      delDisplay: cs(del),
      width: window.innerWidth
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_list_1100.png') });
  ok('viewport 1100', ui.width === 1100, String(ui.width));
  ok('sweep button', ui.btn);
  ok('list row', ui.row);
  ok('tip hidden', ui.tipDisplay === 'none', ui.tipDisplay);
  ok('actions visible', ui.actionsDisplay !== 'none', ui.actionsDisplay);
  ok('Szczegóły visible', ui.szDisplay !== 'none', ui.szDisplay);
  ok('Usuń visible', ui.delDisplay !== 'none', ui.delDisplay);

  page.once('dialog', (d) => d.accept());
  const sweep = await page.evaluate(async () => {
    const before = (window.EX || []).some((e) => e.name === 'Floor press');
    await removeImportedCatalogDuplicates();
    const after = (window.EX || []).some((e) => e.name === 'Floor press');
    const key = typeof exerciseMediaKey === 'function' ? exerciseMediaKey('Wyciskanie z podłogi') : 'wyciskanie z podłogi';
    return {
      before,
      after,
      remote: (window.EX_GIF_REMOTE || {})[key] || ''
    };
  });
  ok('had floor import', sweep.before);
  ok('import removed', !sweep.after);
  ok('film on polish card', /floor\.mp4/.test(sweep.remote), sweep.remote);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Wyciskanie z podłogi';
    if (typeof renderLib === 'function') renderLib();
  });
  const wide = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.ex-list-row')].find((el) => /Wyciskanie z podłogi/.test(el.textContent || ''));
    const tip = row && row.querySelector('.ex-list-tip');
    return tip ? getComputedStyle(tip).display : '';
  });
  ok('tip visible on wide', wide !== 'none', wide);

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll ex-import-dedupe UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
