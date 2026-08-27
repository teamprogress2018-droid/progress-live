// UI: builder autocomplete finds cardio (liny, pajacyki, rower, airbike, wioślarz).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CARDIO_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cardio'));
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
    window.CL = [{ id: 'c1', name: 'Justyna' }];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    const day = document.querySelector('.builder-day');
    if (day && typeof addRow === 'function') addRow(day.id);
  });
  await page.waitForSelector('.ex-row [data-f="name"]');

  async function acFor(q) {
    const input = page.locator('.ex-row [data-f="name"]').first();
    await input.fill('');
    await input.fill(q);
    await page.waitForTimeout(250);
    return page.evaluate(() => {
      const row = document.querySelector('.ex-row');
      const dd = row && row.querySelector('.ex-ac-dropdown');
      const empty = dd && dd.querySelector('.ex-ac-empty');
      const nameEl = dd && dd.querySelector('.ex-ac-name');
      const items = [...(dd ? dd.querySelectorAll('.ex-ac-item .ex-ac-name') : [])].map((el) => (el.textContent || '').trim());
      return {
        items,
        empty: empty ? (empty.textContent || '').trim() : '',
        nameW: nameEl ? Math.round(nameEl.getBoundingClientRect().width) : 0,
        nameH: nameEl ? Math.round(nameEl.getBoundingClientRect().height) : 0,
        nameText: nameEl ? (nameEl.textContent || '').trim() : '',
        ddW: dd ? Math.round(dd.getBoundingClientRect().width) : 0
      };
    });
  }

  const liny = await acFor('liny');
  await page.locator('.ex-row .ex-ac-dropdown').first().screenshot({ path: path.join(shotDir, 'cardio_ac_liny.png') }).catch(() => {});
  await page.screenshot({ path: path.join(shotDir, 'cardio_ac_liny_full.png') });
  ok('liny finds Liny treningowe', liny.items.includes('Liny treningowe'), JSON.stringify(liny));
  ok('liny not empty state', !liny.empty, liny.empty);
  ok('liny name visible width', liny.nameW >= 80 && liny.nameText === 'Liny treningowe', JSON.stringify(liny));

  const paj = await acFor('pajacyki');
  ok('pajacyki finds Pajacyki', paj.items.includes('Pajacyki'), JSON.stringify(paj));

  const rower = await acFor('rower');
  await page.screenshot({ path: path.join(shotDir, 'cardio_ac_rower.png') });
  ok('rower finds Rower stacjonarny', rower.items.includes('Rower stacjonarny'), JSON.stringify(rower));
  ok('rower finds Airbike', rower.items.includes('Airbike'), JSON.stringify(rower));

  const air = await acFor('airbike');
  ok('airbike finds Airbike', air.items.includes('Airbike'), JSON.stringify(air));

  const wios = await acFor('wioslarz');
  ok('wioslarz ascii finds Wioślarz', wios.items.includes('Wioślarz'), JSON.stringify(wios));

  const wios2 = await acFor('wioślarz');
  await page.screenshot({ path: path.join(shotDir, 'cardio_ac_wioslarz.png') });
  ok('wioślarz finds Wioślarz', wios2.items.includes('Wioślarz'), JSON.stringify(wios2));
  ok('wioślarz name visible', wios2.nameW >= 80, JSON.stringify(wios2));

  await page.locator('.ex-row .ex-ac-item').filter({ hasText: 'Wioślarz' }).first().click();
  const picked = await page.locator('.ex-row [data-f="name"]').first().inputValue();
  ok('click fills Wioślarz', picked === 'Wioślarz', picked);

  const rzut = await acFor('rzut');
  await page.screenshot({ path: path.join(shotDir, 'cardio_ac_rzut.png') });
  ok('rzut finds Rzut piłką o ścianę', rzut.items.includes('Rzut piłką o ścianę'), JSON.stringify(rzut));
  ok('rzut finds Rzut piłką o podłogę', rzut.items.includes('Rzut piłką o podłogę'), JSON.stringify(rzut));
  ok('rzut not empty', !rzut.empty, rzut.empty);

  const pilka = await acFor('pilka');
  ok('pilka finds Rzut piłką o ścianę', pilka.items.includes('Rzut piłką o ścianę'), JSON.stringify(pilka));

  const wall = await acFor('wall ball');
  ok('wall ball finds Rzut piłką o ścianę', wall.items.includes('Rzut piłką o ścianę'), JSON.stringify(wall));

  await page.locator('.ex-row .ex-ac-item').filter({ hasText: 'Rzut piłką o ścianę' }).first().click();
  const pickedRzut = await page.locator('.ex-row [data-f="name"]').first().inputValue();
  ok('click fills Rzut piłką o ścianę', pickedRzut === 'Rzut piłką o ścianę', pickedRzut);

  const zarzut = await acFor('zarzut');
  ok('zarzut finds Zarzut siłowy', zarzut.items.includes('Zarzut siłowy'), JSON.stringify(zarzut));
  ok('zarzut finds Zarzut', zarzut.items.includes('Zarzut'), JSON.stringify(zarzut));

  const wykrok = await acFor('wykrok');
  ok('wykrok finds Wykrok chodzony', wykrok.items.includes('Wykrok chodzony'), JSON.stringify(wykrok));
  ok('wykrok finds Wykrok wsteczny', wykrok.items.includes('Wykrok wsteczny'), JSON.stringify(wykrok));

  const biez = await acFor('bieznia');
  await page.screenshot({ path: path.join(shotDir, 'cardio_ac_bieznia.png') });
  ok('bieznia finds Bieżnia', biez.items.includes('Bieżnia'), JSON.stringify(biez));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('#ex-search');
  await page.fill('#ex-search', 'liny');
  await page.evaluate(() => { if (typeof renderLib === 'function') renderLib(); });
  await page.waitForTimeout(200);
  const lib = await page.evaluate(() => (document.getElementById('lib-grid') || {}).innerText || '');
  ok('library search liny', /Liny treningowe/.test(lib), lib.slice(0, 200));

  await page.fill('#ex-search', 'rzut');
  await page.evaluate(() => { if (typeof renderLib === 'function') renderLib(); });
  await page.waitForTimeout(200);
  const libRzut = await page.evaluate(() => (document.getElementById('lib-grid') || {}).innerText || '');
  ok('library search rzut wall ball', /Rzut piłką o ścianę/.test(libRzut), libRzut.slice(0, 240));
  ok('library search rzut slam', /Rzut piłką o podłogę/.test(libRzut), libRzut.slice(0, 240));

  await page.fill('#ex-search', 'zarzut');
  await page.evaluate(() => { if (typeof renderLib === 'function') renderLib(); });
  await page.waitForTimeout(200);
  const libZ = await page.evaluate(() => (document.getElementById('lib-grid') || {}).innerText || '');
  ok('library search zarzut', /Zarzut siłowy/.test(libZ), libZ.slice(0, 240));

  const cats = await page.evaluate(() => (document.getElementById('ex-cat-nav') || {}).innerText || '');
  ok('library nav olimpijskie', /Olimpijskie/.test(cats), cats.slice(0, 300));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cardio autocomplete UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
