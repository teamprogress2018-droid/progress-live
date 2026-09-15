#!/usr/bin/env node
'use strict';
/** UI: tryby Sztab / Dev w AI Coach + etykiety agentów przy sekwencyjnych odpowiedziach. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.STAFF_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-staff'));
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

  await page.route('https://anthropic-proxy.teamprogress2018.workers.dev/**', async (route) => {
    const post = route.request().postDataJSON() || {};
    const sys = String(post.system || '');
    let text = 'Ogólna odpowiedź AI Coach.';
    if (/\[BIOMECHANIKA\]/.test(sys)) text = 'Odpowiedź biomechaniki o wektorach i profilu oporu.';
    else if (/\[DEV\]/.test(sys)) text = 'Odpowiedź dev o module vanilla JS.';
    else if (/\[BIZNES/.test(sys)) text = 'Odpowiedź biznes o cenniku pakietu.';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    });
  });

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
    window.CL = [{ id: 'c1', name: 'Piotr', goal: 'masa', level: 'sredni' }];
    window.SE = [];
    window.PL = [];
    window.TASKS = [];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('aicoach');
    if (typeof initAICoach === 'function') initAICoach();
  });
  await page.waitForTimeout(400);

  const modes = await page.evaluate(() => {
    const ids = ['aicm-coach', 'aicm-sztab', 'aicm-dev', 'aicm-exercise', 'aicm-business'];
    const map = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      map[id] = el ? { text: el.textContent.trim(), display: getComputedStyle(el).display } : null;
    });
    return map;
  });
  ok('sztab visible', !!(modes['aicm-sztab'] && modes['aicm-sztab'].display !== 'none' && /Sztab/.test(modes['aicm-sztab'].text)), JSON.stringify(modes['aicm-sztab']));
  ok('dev visible', !!(modes['aicm-dev'] && /Dev/.test(modes['aicm-dev'].text)), JSON.stringify(modes['aicm-dev']));

  await page.click('#aicm-sztab');
  await page.waitForTimeout(200);
  const sztabActive = await page.evaluate(() => document.getElementById('aicm-sztab').classList.contains('active'));
  ok('sztab active', sztabActive);
  const quick = await page.evaluate(() => (document.getElementById('aic-quick-qs') || {}).innerText || '');
  ok('sztab quick qs', /Profil oporu|Zamienniki|wycenić/i.test(quick), quick.slice(0, 200));

  await page.fill('#aic-input', 'ból barku przy unoszeniu bokiem');
  await page.evaluate(() => { if (typeof sendAICMsg === 'function') sendAICMsg(); });
  await page.waitForFunction(() => [...document.querySelectorAll('.aic-msg[data-agent]')].length >= 1, null, { timeout: 15000 });
  const one = await page.evaluate(() => {
    const agents = [...document.querySelectorAll('.aic-msg[data-agent]')].map((el) => el.getAttribute('data-agent'));
    const text = document.getElementById('aic-msgs').innerText;
    return { agents, text };
  });
  ok('keyword routes biomech only', one.agents.join(',') === 'biomechanika', JSON.stringify(one.agents));
  ok('biomech label', /BIOMECHANIKA/.test(one.text) && /wektor/i.test(one.text), one.text.slice(0, 300));
  await page.screenshot({ path: path.join(shotDir, 'staff_sztab_biomech.png') });

  await page.evaluate(() => { if (typeof aicNewSession === 'function') aicNewSession(); });
  await page.click('#aicm-sztab');
  await page.fill('#aic-input', 'hej, opowiedz krótko');
  await page.evaluate(() => { if (typeof sendAICMsg === 'function') sendAICMsg(); });
  await page.waitForFunction(() => [...document.querySelectorAll('.aic-msg[data-agent]')].length >= 3, null, { timeout: 15000 });
  const all = await page.evaluate(() => [...document.querySelectorAll('.aic-msg[data-agent]')].map((el) => el.getAttribute('data-agent')));
  ok('no-match all three', all.join(',') === 'biomechanika,dev,biznes', JSON.stringify(all));
  await page.screenshot({ path: path.join(shotDir, 'staff_sztab_all.png') });

  await page.evaluate(() => { if (typeof goTo === 'function') goTo('library'); });
  const biomechBtn = await page.evaluate(() => {
    const el = document.getElementById('exd-ask-biomech');
    return el ? el.textContent.trim() : '';
  });
  ok('library biomech button', /Zapytaj Biomechanika/.test(biomechBtn), biomechBtn);

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll staff-agent UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
