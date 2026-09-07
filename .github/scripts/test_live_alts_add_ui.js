// UI: Live — pole zamiennika i nazwa przy nowym ćwiczeniu.
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
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Adam Znamiec' }];
    window.SE = [];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-exercises-panel');

  await page.evaluate(() => {
    window.liveClientId = 'c1';
    window.liveExercises = [{
      name: 'Wyciskanie hantli leżąc',
      done: false,
      collapsed: false,
      sets: [{ setNo: 1, kg: '20', reps: '8', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises();
  });

  const search = await page.evaluate(() => {
    const inp = document.getElementById('live-alt-search-0-0');
    const btn = document.querySelector('.live-alts-add .btn');
    return {
      hasSearch: !!(inp),
      placeholder: inp ? inp.placeholder : '',
      altFor: inp && inp.dataset ? inp.dataset.altFor : '',
      hasBtn: !!(btn)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_alt_search.png') });
  ok('alt search present', search.hasSearch && search.hasBtn, JSON.stringify(search));
  ok('alt search placeholder kit', /sztanga|hantle|brama|ławka/i.test(search.placeholder), search.placeholder);

  await page.click('#live-alt-search-0-0');
  await page.waitForTimeout(200);
  const dd = await page.evaluate(() => {
    const el = document.querySelector('#live-alt-search-0-0')?.closest('.ex-ac-wrap')?.querySelector('.ex-ac-dropdown');
    const items = [...(el ? el.querySelectorAll('.ex-ac-item .ex-ac-name') : [])].map((n) => (n.textContent || '').trim());
    const hdr = el ? (el.textContent || '') : '';
    return { display: el ? el.style.display : 'missing', hdr: hdr.slice(0, 140), items: items.slice(0, 6), first: items[0] || '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_alt_dropdown.png') });
  ok('focus shows studio alts', /sztanga \/ hantle \/ brama \/ ławka/i.test(dd.hdr) && dd.items.length > 0, JSON.stringify(dd));
  ok('alts not another machine first', !/maszyn|smith|peck deck/i.test(dd.first), dd.first);

  await page.fill('#live-alt-search-0-0', 'Wyciskanie sztangi leżąc');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const inp = document.getElementById('live-alt-search-0-0');
    if (typeof exAcPick === 'function') exAcPick(inp, 'Wyciskanie sztangi leżąc');
  });
  const swapped = await page.evaluate(() => ({
    name: (window.liveExercises[0] && window.liveExercises[0].name) || '',
    title: (document.querySelector('#live-ex-0') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'live_alt_swapped.png') });
  ok('pick swaps live exercise', swapped.name === 'Wyciskanie sztangi leżąc', JSON.stringify(swapped));

  await page.click('button:has-text("+ Dodaj ćwiczenie")');
  await page.waitForSelector('#live-ex-name-0-1');
  const named = await page.evaluate(() => {
    const inp = document.getElementById('live-ex-name-0-1');
    return {
      hasName: !!(inp),
      placeholder: inp ? inp.placeholder : '',
      focused: document.activeElement === inp,
      emptyName: window.liveExercises[1] && window.liveExercises[1].name === ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_add_ex_name.png') });
  ok('new exercise has name search', named.hasName && /bibliotece|wpisz/i.test(named.placeholder), JSON.stringify(named));
  ok('new exercise name focused', named.focused && named.emptyName, JSON.stringify(named));

  await page.evaluate(() => {
    const inp = document.getElementById('live-ex-name-0-1');
    if (typeof liveSetExName === 'function') liveSetExName(1, 'Pompki');
  });
  const afterName = await page.evaluate(() => ({
    name: window.liveExercises[1] && window.liveExercises[1].name,
    inputGone: !document.getElementById('live-ex-name-0-1'),
    title: ((document.getElementById('live-ex-1') || {}).innerText || '').slice(0, 80)
  }));
  ok('typed name sticks', afterName.name === 'Pompki' && afterName.inputGone, JSON.stringify(afterName));

  await page.evaluate(() => {
    window.liveExercises.push({
      name: 'Nowe ćwiczenie',
      done: false,
      collapsed: false,
      sets: [{ setNo: 1, kg: '', reps: '10', done: false }]
    });
    if (typeof renderLiveExercises === 'function') renderLiveExercises();
  });
  await page.waitForSelector('#live-ex-name-0-2');
  const stub = await page.evaluate(() => ({
    hasBox: !!(document.querySelector('#live-ex-2 .live-ex-name-box')),
    label: (document.querySelector('#live-ex-2 .live-ex-name-box .live-alts-lbl') || {}).textContent || '',
    staticNew: ((document.querySelector('#live-ex-2') || {}).innerText || '').includes('Wybierz ćwiczenie')
  }));
  await page.screenshot({ path: path.join(shotDir, 'live_stub_nowe_cwiczenie.png') });
  ok('legacy Nowe ćwiczenie shows name field', stub.hasBox && /Nazwa ćwiczenia/i.test(stub.label) && stub.staticNew, JSON.stringify(stub));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nLive add-alt UI OK. Shots: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
