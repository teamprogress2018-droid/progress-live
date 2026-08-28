// UI: nadwaga w asystencie buildera + baner profilu.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.WATCH_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-watch'));
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
    window.CL = [{
      id: 'c-justyna', name: 'Justyna Test', age: 34, weight: 80, height: 170,
      goal: 'redukcja', level: 'sredni', gender: 'kobieta', status: 'active'
    }];
    window.SE = [];
    window.PL = [];
    window.TASKS = [];
    window.METRIC_ENTRIES = [];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    const sel = document.getElementById('b-client');
    if (sel) {
      sel.value = 'c-justyna';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof updatePeriod === 'function') updatePeriod();
    if (typeof refreshBuilderAiCoachCard === 'function') refreshBuilderAiCoachCard();
  });
  await page.waitForTimeout(400);
  const card = await page.evaluate(() => {
    const el = document.getElementById('ai-watch-card');
    return {
      hidden: !el || el.hidden || el.getAttribute('hidden') != null && el.innerHTML === '',
      text: el ? el.innerText : '',
      display: el ? getComputedStyle(el).display : 'none'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ai_watch_builder.png') });
  ok('builder card visible', card.display !== 'none' && /Nadwaga|BMI/i.test(card.text), JSON.stringify(card).slice(0, 400));
  ok('builder card has training advice', /siła|strefa 2|maszyn/i.test(card.text), card.text.slice(0, 300));

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-justyna');
  });
  await page.waitForTimeout(500);
  const banner = await page.evaluate(() => {
    const el = document.querySelector('.cp-bmi-banner');
    return { text: el ? el.innerText : '', has: !!el };
  });
  await page.screenshot({ path: path.join(shotDir, 'ai_watch_profile.png') });
  ok('profile banner', banner.has && /Nadwaga|BMI|Asystent/i.test(banner.text), JSON.stringify(banner).slice(0, 400));
  const rail = await page.evaluate(() => {
    const el = document.querySelector('.cp-ov-rail');
    return el ? (el.innerText || '') : '';
  });
  ok('no Aktualizacje on overview', !/Aktualizacje/.test(rail), rail.slice(0, 400));

  const ctx = await page.evaluate(() => {
    const s = typeof clientSafetyContextForAI === 'function' ? clientSafetyContextForAI('c-justyna') : '';
    const m = typeof clientMonitorContextForAI === 'function' ? clientMonitorContextForAI('c-justyna') : '';
    return { s, m };
  });
  ok('safety context nadwaga', /NADWAGA/.test(ctx.s));
  ok('monitor context', /STRAŻNIK POSTĘPÓW/.test(ctx.m));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll AI BMI watchdog UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
