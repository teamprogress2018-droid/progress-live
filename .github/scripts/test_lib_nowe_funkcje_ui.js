// UI: Biblioteka – nowe funkcje (audyt 18.10, pakiet F): gwiazdka i filtr „Ulubione”,
// „Ostatnio używane” z planów, „Duplikuj” plan dla innego klienta.
const { chromium } = require('playwright');

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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.persistSettingsDoc = async () => {};
    window._uid = 't1';
    window._builderNavigationConfirmed = true;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Anna Kowalska', trainerId: 't1' }, { id: 'c2', name: 'Jan Nowak', trainerId: 't1' }];
    window.SETTINGS = window.SETTINGS || {};
    window.SETTINGS.favoriteExercises = [];
    window.PL = [{ id: 'p_src', name: 'Plan Anny', clientId: 'c1', clientName: 'Anna Kowalska', trainerId: 't1', createdAt: '2026-10-10T10:00:00Z', duration: 4, method: 'FBW',
      days: [{ day: 'PON', muscles: 'FBW', rest: false, exercises: [{ name: 'Wiosłowanie sztangą', sets: '4', reps: '8' }, { name: 'Przysiad ze sztangą', sets: '4', reps: '6' }] }] }];
    goTo('library');
    setExView('grid');
  });

  // 1. Gwiazdka → filtr Ulubione.
  await page.fill('#ex-search', 'Pompki diamentowe');
  await page.waitForTimeout(400);
  await page.locator('.ex-card', { hasText: 'Pompki diamentowe' }).first().locator('.ex-fav-btn').click();
  const fav = await page.evaluate(() => {
    const btn = document.querySelector('.ex-card[data-ex-name="Pompki diamentowe"] .ex-fav-btn');
    const count = document.getElementById('ex-nav-count-fav').textContent;
    document.getElementById('ex-search').value = '';
    exCatFilter = '__fav';
    renderLib();
    const names = [...document.querySelectorAll('#lib-grid .ex-card-name')].map((el) => el.textContent);
    return { on: btn && btn.classList.contains('is-on') && btn.textContent === '★', count, names, saved: SETTINGS.favoriteExercises.slice(), detail: document.querySelector('.ex-card.selected') === null };
  });
  ok('star marks favourite', fav.on && fav.count === '1', JSON.stringify(fav));
  ok('star does not open detail', fav.detail, JSON.stringify(fav));
  ok('Ulubione lists it', fav.names.length === 1 && fav.names[0] === 'Pompki diamentowe', JSON.stringify(fav));
  ok('favourite saved in settings', fav.saved.join() === 'Pompki diamentowe', JSON.stringify(fav));
  const unfav = await page.evaluate(() => {
    toggleFavEx('Pompki diamentowe', null);
    return document.querySelector('#lib-grid').textContent;
  });
  ok('empty favourites explain the star', /Kliknij ☆/.test(unfav), unfav.slice(0, 80));

  // 2. Ostatnio używane – z planów, od najnowszego.
  const rec = await page.evaluate(() => {
    exCatFilter = '__recent';
    renderLib();
    return [...document.querySelectorAll('#lib-grid .ex-card-name')].map((el) => el.textContent);
  });
  ok('recent from plans in order', rec.join('|') === 'Wiosłowanie sztangą|Przysiad ze sztangą', rec.join('|'));

  // 3. Duplikuj plan → kopia bez klienta w kreatorze; zapis dla innego klienta nie rusza oryginału.
  const dup = await page.evaluate(async () => {
    exCatFilter = 'Wszystkie';
    goTo('plans');
    renderPlans();
    const btn = document.querySelector('button[onclick*="duplicatePlan(\'p_src\')"]');
    const hasBtn = !!btn;
    const copy = await duplicatePlan('p_src');
    const screen = document.querySelector('.screen.active').id;
    return { hasBtn, screen, copyName: copy.name, copyClient: copy.clientId || '', editing: window._editingPlanId === copy.id, builderName: document.getElementById('b-name').value, origClient: PL.find((p) => p.id === 'p_src').clientId, count: PL.length, exs: copy.days[0].exercises.length };
  });
  ok('plan card has Duplikuj', dup.hasBtn, JSON.stringify(dup));
  ok('copy opens in builder', dup.screen === 'screen-builder' && dup.editing && dup.builderName === 'Plan Anny (kopia)', JSON.stringify(dup));
  ok('copy has no client, original untouched', dup.copyClient === '' && dup.origClient === 'c1' && dup.count === 2 && dup.exs === 2, JSON.stringify(dup));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('All lib new-feature UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
