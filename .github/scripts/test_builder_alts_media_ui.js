// UI: zamienniki wysuwane + miniatura techniki przy nazwie (bez pustego boxa filmu).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.BUILDER_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-builder'));
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
    window.CL = [{ id: 'c1', name: 'Piotr Urbaniak' }];
  });
  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    const day = document.querySelector('.builder-day');
    if (day && typeof addRow === 'function') addRow(day.id);
  });
  await page.waitForSelector('.ex-row [data-f="name"]');
  await page.fill('.ex-row [data-f="name"]', 'Rozpiętki na maszynie (Pec-Deck) — środek klatki');
  await page.waitForTimeout(400);

  const state = await page.evaluate(() => {
    const row = document.querySelector('.ex-row');
    const thumb = row && row.querySelector('.builder-ex-thumb');
    const altBox = row && row.querySelector('.builder-alt-box');
    const toggle = row && row.querySelector('.builder-alt-toggle');
    const emptyFilm = (row && row.innerText || '').includes('Brak filmu techniki');
    const media = typeof resolveCoachMedia === 'function'
      ? resolveCoachMedia({ name: 'Rozpiętki na maszynie (Pec-Deck) — środek klatki' })
      : {};
    return {
      hasThumbBtn: !!(thumb),
      thumbHidden: !!(thumb && thumb.hidden),
      thumbHasImg: !!(thumb && thumb.querySelector('img,video')),
      thumbSrc: (thumb && ((thumb.querySelector('video') || thumb.querySelector('img') || {}).src)) || '',
      altHidden: !!(altBox && altBox.hasAttribute('hidden')),
      hasToggle: !!(toggle),
      emptyFilm,
      mediaImg: media.img || media.gif || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_ex_thumb.png') });
  ok('thumb button present', state.hasThumbBtn);
  ok('thumb visible after pec-deck name', !state.thumbHidden && state.thumbHasImg, JSON.stringify(state));
  ok('thumb uses real technique media', /free-exercise-db|githubusercontent|jsdelivr|video-assets|Pec(?:%20|[- ])?Deck|Butterfly|\.mp4/i.test(state.thumbSrc + state.mediaImg), state.thumbSrc);
  ok('alts panel hidden by default', state.altHidden);
  ok('zamienniki toggle present', state.hasToggle);
  ok('no duplicate empty film box', !state.emptyFilm);

  await page.click('.builder-alt-toggle');
  const opened = await page.evaluate(() => {
    const box = document.querySelector('.builder-alt-box');
    const chips = [...document.querySelectorAll('.builder-alt-chip')].map((el) => el.textContent.trim());
    return { hidden: !!(box && box.hasAttribute('hidden')), chips, openClass: document.querySelector('.ex-row').classList.contains('alts-open') };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_alts_open.png') });
  ok('alts panel slides open', !opened.hidden && opened.openClass);
  ok('alts chips from library', opened.chips.some((c) => /Rozpiętki hantlami/i.test(c)), opened.chips.join(' | '));

  await page.click('.builder-ex-thumb');
  await page.waitForSelector('#builder-ex-media-pop:not([hidden])');
  const pop = await page.evaluate(() => {
    const el = document.getElementById('builder-ex-media-pop');
    return {
      open: !!(el && !el.hidden),
      hasMedia: !!(el && el.querySelector('img,video,iframe'))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_media_pop.png') });
  ok('thumb opens technique popover', pop.open && pop.hasMedia);

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nBuilder alts/media UI OK. Shots: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
