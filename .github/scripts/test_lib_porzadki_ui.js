// UI: Biblioteka – porządki (audyt 18.10, pakiet D): Karty/Lista z dobrym stanem i pamięcią,
// wyszukiwarka bez kolejności słów, sortowanie w widoku „Wszystkie”, Ukryj vs Usuń, menu Zadań.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

async function bootApp(page, port) {
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
    window.CL = [{ id: 'c1', name: 'Anna Kowalska' }];
  });
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await bootApp(page, port);

  // 1. Karty/Lista: stan zgodny z widokiem, wybór zapamiętany po odświeżeniu.
  const v1 = await page.evaluate(() => {
    goTo('library');
    const gb = document.getElementById('ex-view-grid-btn');
    return { gridShown: getComputedStyle(document.getElementById('ex-grid-view')).display !== 'none', gridBtn: gb.classList.contains('btn-primary'), listBtn: document.getElementById('ex-view-list-btn').classList.contains('btn-primary') };
  });
  ok('start: Karty shown and highlighted', v1.gridShown && v1.gridBtn && !v1.listBtn, JSON.stringify(v1));
  await page.evaluate(() => setExView('list'));
  await bootApp(page, port);
  const v2 = await page.evaluate(() => {
    goTo('library');
    return { listShown: getComputedStyle(document.getElementById('ex-list-view')).display !== 'none', listBtn: document.getElementById('ex-view-list-btn').classList.contains('btn-primary'), rows: document.querySelectorAll('#ex-list-body .ex-list-row').length };
  });
  ok('reload keeps Lista', v2.listShown && v2.listBtn && v2.rows > 0, JSON.stringify(v2));
  await page.evaluate(() => setExView('grid'));

  // 2. Wyszukiwarka: słowa w dowolnej kolejności, z podwójną spacją.
  await page.fill('#ex-search', 'lezac  sztangi wyciskanie');
  await page.waitForTimeout(400);
  const found = await page.evaluate(() => [...document.querySelectorAll('#lib-grid .ex-card-name')].map((el) => el.textContent));
  ok('search any word order', found.includes('Wyciskanie sztangi leżąc'), found.slice(0, 5).join(' | '));

  // 3. Sortowanie „Sprzęt” działa w widoku „Wszystkie”.
  const sorted = await page.evaluate(() => {
    document.getElementById('ex-search').value = '';
    const sel = document.getElementById('ex-sort');
    const opts = [...sel.options].map((o) => o.value);
    sel.value = 'eq';
    renderLib();
    const first = document.querySelector('#lib-grid .ex-cat-section');
    const eqs = [...first.querySelectorAll('.ex-card')].map((c) => c.querySelectorAll('.ex-card-tags .pill')[1].textContent);
    sel.value = 'az';
    renderLib();
    return { opts, eqs };
  });
  const isSorted = sorted.eqs.every((e, i, arr) => i === 0 || arr[i - 1].localeCompare(e, 'pl') <= 0);
  ok('sort options without Kategoria', sorted.opts.join(',') === 'az,eq', sorted.opts.join(','));
  ok('equipment sort inside category', sorted.eqs.length > 3 && isSorted, sorted.eqs.slice(0, 8).join(','));

  // 4. Ukryj (katalog) vs Usuń (własne), przycisk duplikatów tylko gdy są.
  const labels = await page.evaluate(() => {
    window.EX.push({ id: 'ex_own', name: 'Moje ćwiczenie testowe', cat: 'Nogi', eq: 'Bez sprzętu', tip: '' });
    renderLib();
    const card = (n) => [...document.querySelectorAll('#lib-grid .ex-card')].find((c) => c.querySelector('.ex-card-name').textContent === n);
    const btn = (n) => [...card(n).querySelectorAll('button')].map((b) => b.textContent.trim()).pop();
    const sweep = document.getElementById('lib-sweep-dups');
    openExDetail('Moje ćwiczenie testowe');
    const hdrOwn = document.getElementById('exd-del-hdr').textContent;
    openExDetail('Wyciskanie sztangi leżąc');
    const hdrCat = document.getElementById('exd-del-hdr').textContent;
    return { own: btn('Moje ćwiczenie testowe'), cat: btn('Wyciskanie sztangi leżąc'), sweep: getComputedStyle(sweep).display, hdrOwn, hdrCat };
  });
  ok('catalog card says Ukryj', labels.cat === 'Ukryj', JSON.stringify(labels));
  ok('own card says Usuń', labels.own === 'Usuń', JSON.stringify(labels));
  ok('detail header matches', /Usuń/.test(labels.hdrOwn) && /Ukryj/.test(labels.hdrCat), JSON.stringify(labels));
  ok('no dedupe button without duplicates', labels.sweep === 'none', JSON.stringify(labels));

  // 5. Zamknięcie szczegółów nie przebudowuje siatki.
  const kept = await page.evaluate(() => {
    const first = document.querySelector('#lib-grid .ex-card');
    closeExDetail();
    return document.querySelector('#lib-grid .ex-card') === first && !document.querySelector('#lib-grid .ex-card.selected');
  });
  ok('close detail keeps cards', kept);

  // 6. Jeden import, „+ Ćwiczenie” jako główna akcja.
  const top = await page.evaluate(() => ({
    imports: [...document.querySelectorAll('#screen-library button')].filter((b) => /Import GIF/.test(b.textContent) && b.getBoundingClientRect().width > 0).length,
    add: document.getElementById('lib-add-ex').classList.contains('btn-primary')
  }));
  ok('single visible import, + Ćwiczenie primary', top.imports === 1 && top.add, JSON.stringify(top));

  // 7. Menu: podświetlona pozycja zgodna z filtrem zadań.
  const fly = await page.evaluate(() => {
    const act = () => [...document.querySelectorAll('.nav-flyout-item.active')].map((b) => b.textContent.trim());
    goToHomeworkQueue();
    const hw = act();
    goTo('tasks');
    setTaskFilter('all');
    const all = act();
    return { hw, all };
  });
  ok('homework highlights Zadania domowe', fly.hw.join() === 'Zadania domowe', JSON.stringify(fly));
  ok('all tasks highlights Wszystkie zadania', fly.all.join() === 'Wszystkie zadania', JSON.stringify(fly));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('All lib clean-up UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
