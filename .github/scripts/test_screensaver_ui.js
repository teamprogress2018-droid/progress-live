// UI: wygaszacz z logo — podgląd, dismiss, ustawienia Marka, kiosk ?ss=1.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-ss'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

function bypassAuth() {
  return () => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    window.CL = [{ id: 'c1', name: 'Piotr Urbaniak' }];
  };
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(bypassAuth());

  const mounted = await page.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    const img = el && el.querySelector('.pl-ss-logo');
    return {
      exists: !!el,
      on: !!(el && el.classList.contains('on')),
      src: img ? img.getAttribute('src') : ''
    };
  });
  ok('overlay in DOM', mounted.exists);
  ok('hidden by default', mounted.on === false);
  ok('default logo src', /progress-logo\.jpg/.test(mounted.src));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('settings');
  });
  await page.waitForTimeout(300);
  const brand = await page.evaluate(() => {
    const content = document.getElementById('settings-content');
    const text = (content && content.innerText) || '';
    return {
      hasWygaszacz: /Wygaszacz/.test(text),
      hasPreview: !!(content && content.querySelector('button[onclick="previewScreensaver()"]')),
      idle: (document.getElementById('set-ss-idle') || {}).value || ''
    };
  });
  ok('settings brand has wygaszacz', brand.hasWygaszacz);
  ok('preview button', brand.hasPreview);
  ok('idle default 3', brand.idle === '3');

  await page.click('button[onclick="previewScreensaver()"]');
  await page.waitForTimeout(400);
  const shown = await page.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    const img = el && el.querySelector('.pl-ss-logo');
    const clock = document.getElementById('pl-ss-clock');
    const box = el && el.getBoundingClientRect();
    return {
      on: !!(el && el.classList.contains('on')),
      aria: el && el.getAttribute('aria-hidden'),
      src: img ? img.getAttribute('src') : '',
      clock: (clock && clock.textContent) || '',
      color: clock ? getComputedStyle(clock).color : '',
      w: box ? box.width : 0,
      h: box ? box.height : 0
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'screensaver_preview.png') });
  ok('preview shows overlay', shown.on && shown.aria === 'false');
  ok('logo visible src', /progress-logo\.jpg/.test(shown.src));
  ok('clock text', shown.clock.length >= 4);
  ok('clock color red', /rgb\(\s*255\s*,\s*59\s*,\s*48\s*\)/.test(shown.color), shown.color);
  ok('covers viewport', shown.w >= 1400 && shown.h >= 850);

  const layout = await page.evaluate(() => {
    const date = document.getElementById('pl-ss-date');
    const hint = document.querySelector('.pl-ss-hint');
    const dr = date && date.getBoundingClientRect();
    const hr = hint && hint.getBoundingClientRect();
    return {
      dateBottom: dr ? dr.bottom : 0,
      hintTop: hr ? hr.top : 0,
      hintBottom: hr ? hr.bottom : 0,
      vh: window.innerHeight
    };
  });
  ok('hint below date', layout.hintTop > layout.dateBottom + 8, JSON.stringify(layout));
  ok('hint near viewport bottom', layout.hintBottom > layout.vh - 80, JSON.stringify(layout));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const hidden = await page.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    return !!(el && el.classList.contains('on'));
  });
  ok('click dismisses', hidden === false);

  await page.evaluate(() => { if (typeof previewScreensaver === 'function') previewScreensaver(); });
  await page.waitForTimeout(300);
  const shown2 = await page.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    return !!(el && el.classList.contains('on'));
  });
  ok('preview again', shown2);
  await page.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    if (el) el.click();
  });
  await page.waitForTimeout(200);
  const hidden2 = await page.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    return !!(el && el.classList.contains('on'));
  });
  ok('overlay click dismisses', hidden2 === false);

  await page.evaluate(() => {
    if (window.SETTINGS && window.SETTINGS.screensaver) window.SETTINGS.screensaver.enabled = false;
    if (typeof hideScreensaver === 'function') hideScreensaver();
  });
  const skipped = await page.evaluate(() => typeof showScreensaver === 'function' && showScreensaver(false));
  ok('disabled skips idle show', skipped === false);

  const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page2.goto('http://localhost:' + port + '/index.html?ss=1', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(900);
  const kiosk = await page2.evaluate(() => {
    const el = document.getElementById('pl-screensaver');
    return !!(el && el.classList.contains('on'));
  });
  await page2.screenshot({ path: path.join(shotDir, 'screensaver_kiosk.png') });
  ok('kiosk ?ss=1 shows', kiosk);
  await page2.close();

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll screensaver UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
