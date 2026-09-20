#!/usr/bin/env node
'use strict';
/** UI: Nordic walking 3× + piłka w niedzielę w modalu klienta. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.ADDL_ACT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-addl-act'));
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = 'flex';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
  });
  await page.evaluate(() => {
    if (typeof openClientModal === 'function') openClientModal();
    else if (typeof openM === 'function') openM('m-client');
  });
  await page.waitForSelector('#ac-prior-sports');
  await page.click('#ac-prior-sports [data-sport="nordic_walking"]');
  await page.click('#ac-prior-sports [data-sport="football"]');
  await page.waitForSelector('#ac-addl-acts .addl-act-row[data-sport="nordic_walking"]');
  await page.selectOption('#ac-addl-acts .addl-act-row[data-sport="nordic_walking"] .addl-act-freq', '3');
  await page.selectOption('#ac-addl-acts .addl-act-row[data-sport="nordic_walking"] .addl-act-int', 'medium');
  await page.fill('#ac-addl-acts .addl-act-row[data-sport="nordic_walking"] .addl-act-notes', 'długie dystanse po 8-10 km');
  await page.selectOption('#ac-addl-acts .addl-act-row[data-sport="football"] .addl-act-freq', '1');
  await page.selectOption('#ac-addl-acts .addl-act-row[data-sport="football"] .addl-act-int', 'high');
  await page.fill('#ac-addl-acts .addl-act-row[data-sport="football"] .addl-act-notes', 'mecz w każdą niedzielę');

  const bg = await page.evaluate(() => (typeof readSportBackgroundFrom === 'function' ? readSportBackgroundFrom('ac') : null));
  const ai = await page.evaluate((acts) => {
    if (typeof clientSportProfileForAI !== 'function') return '';
    return clientSportProfileForAI({ additional_activities: acts, activityLevel: 'active', goal: 'sila', trainingFreq: 3 });
  }, bg && bg.additional_activities);

  await page.screenshot({ path: path.join(shotDir, 'addl_activities_client_modal.png') });
  ok('read two sports', bg && bg.priorSports && bg.priorSports.includes('nordic_walking') && bg.priorSports.includes('football'), JSON.stringify(bg));
  const nw = (bg.additional_activities || []).find((a) => a.sport === 'nordic_walking');
  const fb = (bg.additional_activities || []).find((a) => a.sport === 'football');
  ok('nw 3× medium 8-10km', nw && nw.frequency_per_week === 3 && nw.intensity === 'medium' && /8-10/.test(nw.notes));
  ok('football 1× high Sunday', fb && fb.frequency_per_week === 1 && fb.intensity === 'high' && /niedziel/.test(fb.notes));
  ok('analyzer from form', /adaptation_notes/.test(ai) && /Nordic walking/.test(ai) && /niedziel/.test(ai));

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll additional-activities UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
