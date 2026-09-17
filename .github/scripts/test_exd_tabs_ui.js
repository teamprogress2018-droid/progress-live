#!/usr/bin/env node
'use strict';
/** UI: zakładki Podgląd / Biomechanika / Zarządzanie w panelu ćwiczenia. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.EXD_TABS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-exd-tabs'));
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
  await page.waitForSelector('#ex-detail');
  await page.waitForTimeout(300);

  const preview = await page.evaluate(() => {
    const tab = document.getElementById('exd-tab-preview');
    const panel = document.getElementById('exd-panel-preview');
    const biomech = document.getElementById('exd-panel-biomech');
    const manage = document.getElementById('exd-panel-manage');
    const cta = panel && panel.querySelector('.exd-preview-cta, .btn-primary');
    const pills = panel ? panel.querySelectorAll('.pill').length : 0;
    return {
      tabSelected: tab ? tab.getAttribute('aria-selected') : '',
      previewHidden: panel ? panel.hasAttribute('hidden') : true,
      biomechHidden: biomech ? biomech.hasAttribute('hidden') : true,
      manageHidden: manage ? manage.hasAttribute('hidden') : true,
      cta: cta ? cta.textContent.trim() : '',
      pills,
      title: (document.getElementById('exd-title') || {}).textContent || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'exd_tab_preview.png') });
  ok('default tab preview', preview.tabSelected === 'true' && !preview.previewHidden && preview.biomechHidden && preview.manageHidden, JSON.stringify(preview));
  ok('preview cta', /Użyj w builderze/.test(preview.cta), preview.cta);
  ok('preview without chaotic pills', preview.pills === 0, String(preview.pills));

  await page.click('#exd-tab-biomech');
  await page.waitForTimeout(200);
  const biomech = await page.evaluate(() => {
    const panel = document.getElementById('exd-panel-biomech');
    const box = document.getElementById('exd-subs-box');
    const rows = box ? [...box.querySelectorAll('.exd-biomech-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()) : [];
    const aiAcc = document.getElementById('exd-acc-ai');
    const justAcc = document.getElementById('exd-acc-justify');
    const ask = document.getElementById('exd-ask-biomech');
    const list = document.getElementById('exd-subs-list');
    return {
      hidden: panel ? panel.hasAttribute('hidden') : true,
      selected: (document.getElementById('exd-tab-biomech') || {}).getAttribute('aria-selected'),
      rowCount: rows.length,
      hasPlane: rows.some((t) => /Płaszczyzna/i.test(t)),
      hasProfile: rows.some((t) => /Profil oporu/i.test(t)),
      hasSfr: rows.some((t) => /\bSFR\b/.test(t)),
      aiOpen: !!(aiAcc && aiAcc.open),
      listHas: !!(list && list.innerText.trim()),
      justExists: !!justAcc,
      justOpen: !!(justAcc && justAcc.open),
      askText: ask ? ask.textContent.trim() : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'exd_tab_biomech.png') });
  ok('biomech tab shown', biomech.selected === 'true' && !biomech.hidden, JSON.stringify(biomech));
  ok('biomech labeled block', biomech.rowCount >= 5 && biomech.hasPlane && biomech.hasProfile && biomech.hasSfr, JSON.stringify(biomech));
  ok('ai accordion collapsed', biomech.aiOpen === false, JSON.stringify(biomech));
  ok('justify accordion present collapsed', !biomech.listHas || (biomech.justExists && biomech.justOpen === false), JSON.stringify(biomech));

  await page.click('#exd-acc-ai > summary');
  await page.waitForTimeout(150);
  const aiOpen = await page.evaluate(() => {
    const acc = document.getElementById('exd-acc-ai');
    const ask = document.getElementById('exd-ask-biomech');
    return {
      open: !!(acc && acc.open),
      askShown: !!(ask && getComputedStyle(ask).display !== 'none' && ask.getBoundingClientRect().height > 0)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'exd_tab_biomech_ai.png') });
  ok('ai accordion opens', aiOpen.open && aiOpen.askShown, JSON.stringify(aiOpen));

  await page.click('#exd-tab-manage');
  await page.waitForTimeout(200);
  const manage = await page.evaluate(() => {
    const panel = document.getElementById('exd-panel-manage');
    const assign = document.getElementById('exd-assign');
    const del = document.getElementById('exd-del');
    const preview = document.getElementById('exd-panel-preview');
    return {
      hidden: panel ? panel.hasAttribute('hidden') : true,
      selected: (document.getElementById('exd-tab-manage') || {}).getAttribute('aria-selected'),
      assignShown: !!(assign && assign.getBoundingClientRect().height > 0),
      delText: del ? del.textContent.trim() : '',
      previewHidden: preview ? preview.hasAttribute('hidden') : false
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'exd_tab_manage.png') });
  ok('manage tab shown', manage.selected === 'true' && !manage.hidden && manage.previewHidden, JSON.stringify(manage));
  ok('manage has upload+delete', manage.assignShown && /Usuń ćwiczenie/.test(manage.delText), JSON.stringify(manage));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#exd-tab-preview');
  await page.waitForTimeout(200);
  const mobile = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.exd-tab')].map((el) => {
      const r = el.getBoundingClientRect();
      return { t: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const cta = document.querySelector('#exd-panel-preview .exd-preview-cta, #exd-panel-preview .btn-primary');
    const ctaR = cta ? cta.getBoundingClientRect() : null;
    return { tabs, ctaH: ctaR ? Math.round(ctaR.height) : 0, title: (document.getElementById('exd-title') || {}).textContent || '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'exd_tab_preview_mobile.png') });
  ok('mobile tabs tappable', mobile.tabs.length === 3 && mobile.tabs.every((t) => t.h >= 40 && t.w >= 70), JSON.stringify(mobile.tabs));
  ok('mobile cta tall enough', mobile.ctaH >= 40, String(mobile.ctaH));

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll exd-tabs UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
