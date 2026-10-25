// UI: Biblioteka na telefonie i tablecie (audyt 18.10, pakiet C) — filtry pod przyciskiem „Filtry”,
// lista na całą szerokość, brak przesuwania strony w bok na tablecie, cele dotykowe 44 px.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

async function bootApp(browser, port, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  return { ctx, page, errors };
}

const SCREENS = ['library', 'programs', 'templates', 'tasks', 'forms', 'metrics'];

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });

  // 1. Telefon 390: lista na całą szerokość, filtry pod przyciskiem.
  {
    const { ctx, page, errors } = await bootApp(browser, port, { width: 390, height: 844 }, true);
    for (const s of SCREENS) {
      const r = await page.evaluate((s) => {
        localStorage.setItem('pl_library_wide_v1', '0'); goTo(s);
        const scr = document.getElementById('screen-' + s);
        const btn = scr.querySelector('.lib-filters-btn');
        const nav = scr.querySelector('.lib-split > .lib-filters');
        const items = [...nav.querySelectorAll('.ex-cat-nav-item,.prog-nav-item,.tpl-filter,.task-nav-item,.form-nav-item,.metric-group-nav')];
        const visibleItems = () => items.filter((el) => el.getBoundingClientRect().height > 0).length;
        const before = { btn: btn && btn.getBoundingClientRect().width > 0, items: visibleItems(), sw: document.documentElement.scrollWidth };
        btn.click();
        const after = { items: visibleItems(), expanded: btn.getAttribute('aria-expanded'), width: Math.round(nav.getBoundingClientRect().width) };
        btn.click();
        return { before, after, total: items.length };
      }, s);
      ok(s + ': filters button visible', r.before.btn, JSON.stringify(r));
      ok(s + ': filters hidden until opened', r.before.items === 0, JSON.stringify(r));
      ok(s + ': no sideways page', r.before.sw <= 390, JSON.stringify(r));
      ok(s + ': button opens full-width filters', (r.total === 0 || r.after.items > 0) && r.after.expanded === 'true' && r.after.width >= 380, JSON.stringify(r));
    }
    const search = await page.evaluate(() => {
      localStorage.setItem('pl_library_wide_v1', '0'); goTo('library');
      const r = document.getElementById('ex-search').getBoundingClientRect();
      const grid = document.getElementById('ex-grid-view').getBoundingClientRect();
      return { searchW: r.width, gridW: grid.width };
    });
    ok('library search stays visible', search.searchW > 300, JSON.stringify(search));
    ok('library list uses full width', search.gridW >= 380, JSON.stringify(search));

    await page.evaluate(() => goTo('programs'));
    await page.click('#screen-programs .lib-filters-btn');
    await page.click('#pn-sila');
    await page.waitForTimeout(100);
    const picked = await page.evaluate(() => ({
      open: document.getElementById('screen-programs').classList.contains('lib-open-filters'),
      active: document.getElementById('pn-sila').classList.contains('active')
    }));
    ok('picking a filter closes the panel', !picked.open && picked.active, JSON.stringify(picked));

    const aside = await page.evaluate(() => {
      goTo('metrics');
      const scr = document.getElementById('screen-metrics');
      const box = scr.querySelector('.lib-aside');
      const hidden = box.getBoundingClientRect().height === 0;
      scr.querySelectorAll('.lib-filters-btn')[1].click();
      const shown = box.getBoundingClientRect().width >= 380;
      return { hidden, shown };
    });
    ok('metrics quick entry under its own button', aside.hidden && aside.shown, JSON.stringify(aside));

    const vids = await page.evaluate(() => {
      localStorage.setItem('pl_library_wide_v1', '0'); goTo('library');
      setLibTab('videos');
      const hidden = document.getElementById('lib-filters-btn').getBoundingClientRect().width === 0;
      setLibTab('ex');
      return hidden;
    });
    ok('no filters button on Moje filmy', vids);

    // Domyślny tryb pełnego ekranu (pl_library_wide_v1 brak/1): „Filtry” musi pokazać kategorie.
    const wide = await page.evaluate(() => {
      localStorage.removeItem('pl_library_wide_v1'); goTo('library'); setLibTab('ex');
      if (typeof setLibraryWide === 'function') setLibraryWide(true, false);
      const scr = document.getElementById('screen-library');
      const btn = document.getElementById('lib-filters-btn');
      const cats = () => [...scr.querySelectorAll('.lib-split > .lib-filters .ex-cat-nav-item')].filter((el) => el.getBoundingClientRect().height > 0).length;
      const before = cats();
      btn.click();
      const opened = { cats: cats(), expanded: btn.getAttribute('aria-expanded') };
      btn.click();
      return { wide: scr.classList.contains('library-wide'), before, opened, closed: cats() };
    });
    ok('fullscreen library: Filtry shows categories on phone', wide.wide && wide.before === 0 && wide.opened.cats > 0 && wide.opened.expanded === 'true', JSON.stringify(wide));
    ok('fullscreen library: Filtry hides categories again', wide.closed === 0, JSON.stringify(wide));
    await page.click('#lib-filters-btn');
    await page.locator('#screen-library .lib-split > .lib-filters .ex-cat-nav-item').nth(1).click();
    await page.waitForTimeout(100);
    const wpick = await page.evaluate(() => ({ open: document.getElementById('screen-library').classList.contains('lib-open-filters') }));
    ok('fullscreen library: picking a category closes the panel', !wpick.open, JSON.stringify(wpick));
    await page.evaluate(() => { localStorage.setItem('pl_library_wide_v1', '0'); if (typeof setLibraryWide === 'function') setLibraryWide(false, false); });

    const touch = await page.evaluate(() => {
      goTo('programs');
      const h = (sel) => Math.round((document.querySelector(sel) || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height);
      document.querySelector('#screen-programs .lib-filters-btn').click();
      const r = { nav: h('#pn-all'), btn: h('#screen-programs .lib-filters-btn') };
      document.querySelector('#screen-programs .lib-filters-btn').click();
      return r;
    });
    ok('touch targets at least 44px', touch.nav >= 44 && touch.btn >= 44, JSON.stringify(touch));
    ok('no page errors (phone)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // 2. Tablet poziomo 1024: schowane panele szczegółów nie poszerzają strony.
  {
    const { ctx, page, errors } = await bootApp(browser, port, { width: 1024, height: 768 }, true);
    for (const s of ['programs', 'templates', 'forms']) {
      const r = await page.evaluate((s) => {
        goTo(s);
        window.scrollTo(400, 0);
        const res = { sx: window.scrollX, sw: document.documentElement.scrollWidth, iw: window.innerWidth };
        window.scrollTo(0, 0);
        return res;
      }, s);
      ok(s + ': tablet page does not scroll sideways', r.sx === 0 && r.sw <= 1024, JSON.stringify(r));
    }
    const det = await page.evaluate(() => {
      goTo('programs');
      openProgDetail(allPrograms()[0].id);
      const r = document.getElementById('prog-detail').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), filters: document.querySelector('#screen-programs .lib-filters').getBoundingClientRect().width };
    });
    await page.waitForTimeout(400);
    const det2 = await page.evaluate(() => {
      const r = document.getElementById('prog-detail').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });
    ok('tablet keeps side filters', det.filters === 200, JSON.stringify(det));
    ok('program detail opens inside the screen', det2.right <= 1024 && det2.left >= 0 && det2.left < 1024, JSON.stringify(det2));
    ok('no page errors (tablet)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('All lib phone/tablet UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
