// UI: katalog bloków — tytuł 4–16, chipy czasu, podświetlenie, bez tygodniówki.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.PROG_CATALOG_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-prog-catalog'));
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
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr' }];
    if (typeof goTo === 'function') goTo('programs');
  });

  await page.waitForSelector('#screen-programs.screen.active, #screen-programs');
  await page.waitForSelector('.prog-card');

  const intro = await page.evaluate(() => {
    const title = (document.querySelector('#screen-programs .topbar-title') || {}).textContent || '';
    const chips = [...document.querySelectorAll('#prog-dur-chips .wl-filter-chip')].map((el) => ({
      dur: el.getAttribute('data-dur') || '',
      text: (el.textContent || '').trim(),
      active: el.classList.contains('active')
    }));
    const names = [...document.querySelectorAll('.prog-card-title')].map((el) => el.textContent.trim());
    return { title, chips, names, fazy: /Fazy/.test(document.body.innerText || '') };
  });
  await page.screenshot({ path: path.join(shotDir, 'prog_catalog_all.png') });
  ok('title 4-16', /Bloki 4–16 tygodni/.test(intro.title), intro.title);
  ok('no 1-tyg chip', intro.chips.every((c) => c.dur !== '1' && c.text !== '1 tyg.'), JSON.stringify(intro.chips));
  ok('chips 4/6/8/10+', intro.chips.map((c) => c.dur).join(',') === ',4,6,8,10+', JSON.stringify(intro.chips));
  ok('all active by default', intro.chips[0].active && intro.chips.slice(1).every((c) => !c.active));
  ok('has 4-week card', intro.names.some((n) => /FBW Początkujący — 4 tygodnie/.test(n)), intro.names.slice(0, 4).join(' | '));
  ok('has 6-week card', intro.names.some((n) => /EMOM/.test(n) && /6/.test(n)) || intro.names.some((n) => /6 tygod/.test(n)));
  ok('no Cardio Start', intro.names.every((n) => !/Cardio Start/.test(n)));
  ok('fazy label', intro.fazy);

  await page.click('#prog-dur-chips [data-dur="4"]');
  const four = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#prog-dur-chips .wl-filter-chip')].map((el) => ({
      dur: el.getAttribute('data-dur') || '',
      active: el.classList.contains('active')
    }));
    const names = [...document.querySelectorAll('.prog-card-title')].map((el) => el.textContent.trim());
    return { chips, names };
  });
  await page.screenshot({ path: path.join(shotDir, 'prog_catalog_4w.png') });
  ok('4 tyg chip active', four.chips.find((c) => c.dur === '4').active && !four.chips.find((c) => c.dur === '').active, JSON.stringify(four.chips));
  ok('4 tyg only 4-week cards', four.names.length > 0 && four.names.every((n) => /4 tygod/.test(n)), JSON.stringify(four.names));

  await page.click('#prog-dur-chips [data-dur="6"]');
  const six = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#prog-dur-chips .wl-filter-chip')].map((el) => ({
      dur: el.getAttribute('data-dur') || '',
      active: el.classList.contains('active')
    }));
    const names = [...document.querySelectorAll('.prog-card-title')].map((el) => el.textContent.trim());
    return { chips, names };
  });
  await page.screenshot({ path: path.join(shotDir, 'prog_catalog_6w.png') });
  ok('6 tyg chip active not 4', six.chips.find((c) => c.dur === '6').active && !six.chips.find((c) => c.dur === '4').active, JSON.stringify(six.chips));
  ok('6 tyg cards', six.names.length > 0 && six.names.every((n) => /6 tyg/.test(n)), JSON.stringify(six.names));

  await page.click('#prog-dur-chips [data-dur="10+"]');
  const long = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.prog-card-title')].map((el) => el.textContent.trim());
    const active = [...document.querySelectorAll('#prog-dur-chips .wl-filter-chip')].find((el) => el.classList.contains('active'));
    return { names, dur: active ? active.getAttribute('data-dur') : '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'prog_catalog_10plus.png') });
  ok('10+ chip active', long.dur === '10+');
  ok('10+ has 12-week 5x5', long.names.some((n) => /Siła 5×5 — 12 tygodni/.test(n)), JSON.stringify(long.names.slice(0, 5)));
  ok('10+ excludes 4-week FBW', !long.names.some((n) => /FBW Początkujący — 4 tygodnie/.test(n)));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll prog-catalog UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
