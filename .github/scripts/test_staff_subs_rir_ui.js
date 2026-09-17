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
    if (typeof setExdTab === 'function') setExdTab('biomech');
  });
  await page.waitForTimeout(400);
  const libUi = await page.evaluate(() => {
    const box = document.getElementById('exd-subs-box');
    const list = document.getElementById('exd-subs-list');
    const sh = document.getElementById('exd-sub-shoulder');
    const panel = document.getElementById('ex-detail');
    const h = document.querySelector('#ex-detail .exd-ai-h');
    const q = document.getElementById('exd-ai-q');
    const justify = list && [...list.querySelectorAll('button')].some((b) => /Uzasadnij/.test(b.textContent || ''));
    return {
      box: !!(box && getComputedStyle(box).display !== 'none'),
      chips: box ? /Wzorzec|Płaszczyzna|Profil oporu|Stawy|SFR/i.test(box.innerText) : false,
      rows: box ? box.querySelectorAll('.exd-biomech-row').length : 0,
      panelW: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
      headFs: h ? parseFloat(getComputedStyle(h).fontSize) : 0,
      inputFs: q ? parseFloat(getComputedStyle(q).fontSize) : 0,
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
  ok('biomech chips', libUi.chips && libUi.rows >= 5, JSON.stringify(libUi));
  ok('drawer wider', libUi.panelW >= 450, JSON.stringify(libUi));
  ok('biomech footer readable', libUi.headFs >= 12 && libUi.inputFs >= 13, JSON.stringify(libUi));
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

  await page.evaluate(() => {
    if (typeof setCalcTool === 'function') setCalcTool('myo');
  });
  await page.waitForTimeout(300);
  const myo = await page.evaluate(() => {
    const tab = document.getElementById('calc-tab-myo');
    const lay = document.getElementById('calc-myo-layout');
    const rir = document.getElementById('calc-rir-layout');
    const blocks = [...document.querySelectorAll('#myo-blocks [data-myo-id]')].map((b) => b.getAttribute('data-myo-id'));
    const names = (document.getElementById('myo-blocks') || {}).innerText || '';
    const pain = document.getElementById('myo-staff-pain');
    const log = document.getElementById('myo-log-btn');
    const clock = document.getElementById('myo-clock');
    return {
      tabOn: !!(tab && tab.classList.contains('btn-primary')),
      myoShown: lay ? getComputedStyle(lay).display !== 'none' : false,
      rirHidden: rir ? getComputedStyle(rir).display === 'none' : false,
      blocks: blocks.join(','),
      names,
      pain: !!(pain && /ból/i.test(pain.textContent || '')),
      log: !!(log && /mini-serię/i.test(log.textContent || '')),
      clock: clock ? clock.textContent : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'myo_reps_session.png') });
  ok('myo tab active', myo.tabOn && myo.myoShown && myo.rirHidden, JSON.stringify(myo));
  ok('myo 5 blocks', myo.blocks === 'b1,b2,b3,b4,b5', myo.blocks);
  ok('myo library names', /Przysiad Goblet/.test(myo.names) && /Wyciskanie hantli na ławce skośnej/.test(myo.names) && /Unoszenie bokiem/.test(myo.names));
  ok('myo no shoulder pain on squat', myo.pain === false, JSON.stringify(myo));
  ok('myo clock 00:20', myo.clock === '00:20', myo.clock);

  await page.click('#myo-log-btn');
  await page.waitForTimeout(200);
  const afterLog = await page.evaluate(() => (document.getElementById('myo-done-chip') || {}).textContent);
  ok('myo logged mini', /1\/15/.test(afterLog || ''), afterLog);

  await page.click('[data-myo-id="b2"]');
  await page.waitForTimeout(200);
  const caution = await page.evaluate(() => {
    const pain = document.getElementById('myo-staff-pain');
    const warn = /bark/i.test((document.getElementById('myo-detail') || {}).innerText || '');
    return { pain: !!(pain && /ból/i.test(pain.textContent || '')), warn };
  });
  ok('myo caution staff', caution.pain && caution.warn, JSON.stringify(caution));

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
