// UI: Live — max 3 zamienniki, reszta po „Więcej opcji”.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_ALT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-alts'));
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
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Adrian Ciszewski' }];
    window.SE = [];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-exercises-panel');

  await page.evaluate(() => {
    window.liveClientId = 'c1';
    window.liveExercises = [{
      name: 'Wyciskanie na skosie dodatnim — maszyna lub suwnica Smitha',
      done: false,
      collapsed: false,
      alts: [
        'Wyciskanie hantli na ławce skośnej',
        'Wyciskanie hantli leżąc',
        'Wyciskanie sztangi leżąc',
        'Wyciskanie hantli',
        'Rozpiętki na bramie na ławce skośnej',
        'Wyciskanie hantli w mostku na ławce',
        'Rozpiętki hantlami',
        'Pullover hantlem'
      ],
      sets: [{ setNo: 1, kg: '40', reps: '8', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises();
  });

  const folded = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#live-ex-0 .live-alt-chip')].map((el) => (el.textContent || '').replace(/^↻\s*/, '').trim());
    const more = document.querySelector('#live-ex-0 .live-alts-more');
    return {
      chips,
      more: more ? (more.textContent || '').trim() : '',
      expanded: more ? more.getAttribute('aria-expanded') : null
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_alts_max3.png') });
  ok('max 3 chips', folded.chips.length === 3, JSON.stringify(folded.chips));
  ok('first three visible', folded.chips[0] === 'Wyciskanie hantli na ławce skośnej' && folded.chips[2] === 'Wyciskanie sztangi leżąc', JSON.stringify(folded.chips));
  ok('more options btn', /Więcej opcji · 5/.test(folded.more) && folded.expanded === 'false', folded.more);

  await page.click('#live-ex-0 .live-alts-more');
  await page.waitForTimeout(200);
  const open = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#live-ex-0 .live-alt-chip')].map((el) => (el.textContent || '').replace(/^↻\s*/, '').trim());
    const more = document.querySelector('#live-ex-0 .live-alts-more');
    return {
      chips,
      more: more ? (more.textContent || '').trim() : '',
      expanded: more ? more.getAttribute('aria-expanded') : null
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_alts_expanded.png') });
  ok('expanded shows rest', open.chips.length === 8 && open.chips.includes('Pullover hantlem'), JSON.stringify(open.chips));
  ok('zwin label', open.more === 'Zwiń' && open.expanded === 'true', open.more);

  await page.locator('#live-ex-0 .live-alt-chip', { hasText: 'Rozpiętki na bramie na ławce skośnej' }).click();
  await page.waitForTimeout(200);
  const swapped = await page.evaluate(() => ({
    name: (window.liveExercises[0] && window.liveExercises[0].name) || '',
    expanded: !!(window.liveExercises[0] && window.liveExercises[0].altsExpanded),
    chips: [...document.querySelectorAll('#live-ex-0 .live-alt-chip')].length
  }));
  await page.screenshot({ path: path.join(shotDir, 'live_alts_picked_extra.png') });
  ok('pick extra alt', swapped.name === 'Rozpiętki na bramie na ławce skośnej', JSON.stringify(swapped));
  ok('swap collapses list', swapped.expanded === false && swapped.chips <= 3, JSON.stringify(swapped));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nLive alts collapse UI OK. Shots: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
