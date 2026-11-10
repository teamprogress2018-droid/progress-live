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
    setExMediaOnly(false);
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

  // 1. Domyślnie „Baza Progress”: 40 kompaktowych kart w 7 szybkich kategoriach, filtry zwinięte.
  const v1 = await page.evaluate(() => {
    localStorage.setItem('pl_library_wide_v1', '0'); goTo('library');
    return {
      tab: (document.querySelector('#lib2-tabs .lib2-tab.is-on') || {}).getAttribute('data-tab'),
      cards: document.querySelectorAll('#lib-grid .exl-card').length,
      sections: document.querySelectorAll('#lib-grid .lib2-sec').length,
      chips: document.querySelectorAll('#ex-cat-nav .lib2-chip').length,
      filtersHidden: document.getElementById('lib2-filters').hidden,
      mediaOnly: exMediaOnly
    };
  });
  ok('start: Baza Progress, 40 cards in 7 groups', v1.tab === 'base' && v1.cards === 40 && v1.sections === 7 && v1.chips === 8, JSON.stringify(v1));
  ok('filters folded, film filter off', v1.filtersHidden && v1.mediaOnly === false, JSON.stringify(v1));

  // 2. Wyszukiwarka: słowa w dowolnej kolejności, z podwójną spacją.
  await page.fill('#ex-search', 'lezac  sztangi wyciskanie');
  await page.waitForTimeout(400);
  const found = await page.evaluate(() => [...document.querySelectorAll('#lib-grid .exl-name')].map((el) => el.textContent));
  ok('search any word order', found.includes('Wyciskanie sztangi leżąc'), found.slice(0, 5).join(' | '));
  ok('Baza Progress result first', found[0] === 'Wyciskanie sztangi leżąc', found.slice(0, 3).join(' | '));

  // 3. Szybka kategoria zawęża Bazę Progress.
  const grp = await page.evaluate(() => {
    document.getElementById('ex-search').value = '';
    setExGroup('core');
    const names = [...document.querySelectorAll('#lib-grid .exl-name')].map((el) => el.textContent);
    setExGroup('');
    return names;
  });
  ok('quick group Core', grp.length === 6 && grp.includes('Deska') && grp.includes('Martwy robak'), grp.join(' | '));

  // 4. Ukryj (katalog) vs Usuń (własne) — w nagłówku panelu; duplikaty tylko w menu „⋯”.
  const labels = await page.evaluate(() => {
    window.EX.push({ id: 'ex_own', name: 'Moje ćwiczenie testowe', cat: 'Nogi', eq: 'Bez sprzętu', tip: '' });
    if (typeof invalidateExerciseCatalogCache === 'function') invalidateExerciseCatalogCache();
    renderLib();
    const sweep = document.getElementById('lib-sweep-dups');
    openExDetail('Moje ćwiczenie testowe');
    const hdrOwn = document.getElementById('exd-del-hdr').textContent;
    openExDetail('Wyciskanie sztangi leżąc');
    const hdrCat = document.getElementById('exd-del-hdr').textContent;
    const ownTab = (document.querySelector('#lib2-tabs [data-tab="own"] .lib2-tab-n') || {}).textContent;
    return { sweep: getComputedStyle(sweep).display, hdrOwn, hdrCat, ownTab };
  });
  ok('detail header matches', /Usuń/.test(labels.hdrOwn) && /Ukryj/.test(labels.hdrCat), JSON.stringify(labels));
  ok('own exercise counted in Moje ćwiczenia', labels.ownTab === '1', JSON.stringify(labels));
  ok('no dedupe button without duplicates', labels.sweep === 'none', JSON.stringify(labels));

  // 5. Zamknięcie szczegółów nie przebudowuje siatki.
  const kept = await page.evaluate(() => {
    const first = document.querySelector('#lib-grid .ex-card');
    closeExDetail();
    return document.querySelector('#lib-grid .ex-card') === first && !document.querySelector('#lib-grid .ex-card.selected');
  });
  ok('close detail keeps cards', kept);

  // 6. Import i narzędzia w menu „⋯”, nie na górnym pasku.
  const top = await page.evaluate(() => {
    const visibleImports = () => [...document.querySelectorAll('#screen-library button')].filter((b) => /Import GIF/.test(b.textContent) && b.getBoundingClientRect().width > 0).length;
    const before = visibleImports();
    toggleLibMoreMenu();
    const after = visibleImports();
    closeLibMoreMenu();
    return { before, after, add: !!document.getElementById('lib-add-ex') };
  });
  ok('import hidden in ⋯ menu', top.before === 0 && top.after === 1 && top.add, JSON.stringify(top));

  // 7. „Wszystkie ćwiczenia” ładuje się partiami.
  const all = await page.evaluate(() => {
    setExTab('all');
    const n = document.querySelectorAll('#lib-grid .exl-card').length;
    const total = allExercises().length;
    setExTab('base');
    return { n, total };
  });
  ok('full catalogue rendered in pages', all.total > 900 && all.n > 0 && all.n <= 90, JSON.stringify(all));

  // 8. Menu: podświetlona pozycja zgodna z filtrem zadań.
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

  // Tryb pełnoekranowy (od 23.10) jest domyślny: bez menu aplikacji, ale wyszukiwarka i „Filtry” zawsze na górze.
  const wide = await page.evaluate(() => {
    localStorage.removeItem('pl_library_wide_v1');
    goTo('dashboard'); goTo('library');
    const vis = (el) => !!el && el.offsetHeight > 0;
    const before = { wide: document.getElementById('screen-library').classList.contains('library-wide'), menu: vis(document.getElementById('app-sidebar')), search: vis(document.getElementById('ex-search')), lbl: !!document.getElementById('lib-filters-lbl') };
    toggleLibraryFilters();
    const after = { panel: vis(document.getElementById('lib2-filters')) };
    toggleExFilters();
    toggleLibraryWide();
    const normal = { menu: vis(document.getElementById('app-sidebar')), search: vis(document.getElementById('ex-search')), saved: localStorage.getItem('pl_library_wide_v1') };
    return { before, after, normal };
  });
  ok('wide library by default hides app menu, keeps search', wide.before.wide && !wide.before.menu && wide.before.search && wide.before.lbl, JSON.stringify(wide));
  ok('Filtry opens the filter panel', wide.after.panel, JSON.stringify(wide));
  ok('normal view brings back menu, remembered', wide.normal.menu && wide.normal.search && wide.normal.saved === '0', JSON.stringify(wide));
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
