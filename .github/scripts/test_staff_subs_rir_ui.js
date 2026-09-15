#!/usr/bin/env node
'use strict';
/** UI: zamienniki w panelu ćwiczenia + kalkulator RIR. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SUBS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-subs'));
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
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
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    const name = (window.DEF_EX && window.DEF_EX[0] && window.DEF_EX[0].name) || 'Wyciskanie sztangi leżąc';
    if (typeof openExDetail === 'function') openExDetail(name);
  });
  await page.waitForTimeout(400);
  const libUi = await page.evaluate(() => {
    const box = document.getElementById('exd-subs-box');
    const list = document.getElementById('exd-subs-list');
    const sh = document.getElementById('exd-sub-shoulder');
    const justify = list && [...list.querySelectorAll('button')].some((b) => /Uzasadnij/.test(b.textContent || ''));
    return {
      box: !!(box && getComputedStyle(box).display !== 'none'),
      chips: box ? /profil:|staw:|SFR:/i.test(box.innerText) : false,
      listHas: !!(list && list.innerText.trim()),
      shoulder: !!(sh && /Ból barku/.test(sh.textContent || '')),
      justify
    };
  });
  await page.evaluate(() => {
    const box = document.getElementById('exd-subs-box');
    if (box) box.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(shotDir, 'subs_library_biomech.png') });
  ok('subs box', libUi.box);
  ok('biomech chips', libUi.chips, JSON.stringify(libUi));
  ok('scored list', libUi.listHas);
  ok('shoulder filter', libUi.shoulder);
  ok('justify btn', libUi.justify);

  await page.click('#exd-sub-shoulder');
  await page.waitForTimeout(200);
  const filtered = await page.evaluate(() => (document.getElementById('exd-subs-list') || {}).innerText || '');
  ok('shoulder filter runs', /Brak dopasowania|\/97/.test(filtered), filtered.slice(0, 180));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('calculator');
    if (typeof setCalcTool === 'function') setCalcTool('rir');
  });
  await page.waitForTimeout(300);
  const rir = await page.evaluate(() => {
    const tab = document.getElementById('calc-tab-rir');
    const kg = document.getElementById('rir-out-kg');
    const lay = document.getElementById('calc-rir-layout');
    const tdee = document.getElementById('calc-tdee-layout');
    return {
      tabOn: !!(tab && tab.classList.contains('btn-primary')),
      kg: kg ? kg.textContent : '',
      rirShown: lay ? getComputedStyle(lay).display !== 'none' : false,
      tdeeHidden: tdee ? getComputedStyle(tdee).display === 'none' : false
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'rir_load_calculator.png') });
  ok('rir tab active', rir.tabOn && rir.rirShown && rir.tdeeHidden, JSON.stringify(rir));
  ok('rir default 7.8', rir.kg === '7.8', rir.kg);

  await page.fill('#rir-weight', '100');
  await page.fill('#rir-reported', '3');
  await page.evaluate(() => {
    window.rirIncline = false;
    if (typeof renderRirLoad === 'function') renderRirLoad();
  });
  const kg2 = await page.evaluate(() => (document.getElementById('rir-out-kg') || {}).textContent);
  ok('rir 100/RIR3 → 105', kg2 === '105', kg2);

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll staff-subs/RIR UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
