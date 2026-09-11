// UI: profil klienta → Treningi — plan ≠ zapis; ✓ Odbył się tworzy sesję sala.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_LOG_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-log'));
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
  const host = process.env.LAYOUT_HOST || '127.0.0.1';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('dialog', d => d.accept());
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const today = typeof todayYmd === 'function' ? todayYmd() : '';
    const d = new Date();
    const dow = d.getDay();
    const mondayOff = dow === 0 ? -6 : 1 - dow;
    const mon = typeof ymdAdd === 'function' ? ymdAdd(today, mondayOff) : today;
    const wed = typeof ymdAdd === 'function' ? ymdAdd(mon, 2) : today;
    window.CL = [{
      id: 'c-justyna',
      name: 'Justyna Chylińska',
      goal: 'redukcja',
      level: 'poczatkujacy',
      age: 35,
      status: 'active'
    }];
    window.PL = [{
      id: 'pl-justyna',
      clientId: 'c-justyna',
      name: 'Obwód A/B',
      days: [{ exercises: [{ name: 'Przysiad goblet' }, { name: 'Wyciskanie' }] }]
    }];
    window.SE = [
      { id: 'p-mon', clientId: 'c-justyna', date: mon, source: 'planned', type: 'PON — OBWÓD A PLAN', planId: 'pl-justyna', dayIdx: 0 },
      { id: 'p-wed', clientId: 'c-justyna', date: wed, source: 'planned', type: 'ŚR — OBWÓD B PLAN', planId: 'pl-justyna', dayIdx: 0 }
    ];
    window.PACKAGES = [{
      id: 'pk-justyna', clientId: 'c-justyna', title: '10 sesji', payStatus: 'paid',
      sessions: 10, sessionsUsed: 3, expiresDate: '2027-01-01'
    }];
    window.METRIC_ENTRIES = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-justyna');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cpt-training');
  await page.waitForSelector('.cp-no-logged-banner');
  const before = await page.evaluate(() => {
    const body = (document.getElementById('cp-body') || {}).innerText || '';
    const btns = [...document.querySelectorAll('.cp-mark-done')].map(b => (b.textContent || '').trim());
    const logged = typeof completedWorkouts === 'function' ? completedWorkouts('c-justyna').length : 0;
    return { body, btns, logged, banner: !!document.querySelector('.cp-no-logged-banner') };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_training_no_log.png') });
  ok('banner when only plan', before.banner && /Brak zapisu treningu/.test(before.body));
  ok('zrobione 0', before.logged === 0 && /\b0\b/.test(before.body), 'logged=' + before.logged);
  ok('two mark-done buttons', before.btns.length === 2, JSON.stringify(before.btns));
  ok('button label', before.btns.every(t => /Odbył się/.test(t)));

  await page.click('.cp-mark-done');
  await page.waitForSelector('#sala-done-save');
  const modal = await page.evaluate(() => {
    const m = document.getElementById('m-sala-done');
    const rates = [...document.querySelectorAll('.sala-rate-btn')].map(b => b.getAttribute('data-rate'));
    return { shown: !!(m && m.classList.contains('show')), rates, min: (document.getElementById('sala-done-min') || {}).value };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_sala_done_modal.png') });
  ok('rating modal shown', modal.shown && modal.rates.join(',') === '1,2,3,4,5', JSON.stringify(modal));
  await page.click('.sala-rate-btn[data-rate="4"]');
  await page.fill('#sala-done-min', '55');
  await page.click('#sala-done-save');
  await page.click('#cpt-training');
  await page.waitForSelector('.cp-sess-done');
  const after = await page.evaluate(() => {
    const body = (document.getElementById('cp-body') || {}).innerText || '';
    const sala = (window.SE || []).filter(s => s && s.source === 'sala');
    const logged = typeof completedWorkouts === 'function' ? completedWorkouts('c-justyna') : [];
    const btns = document.querySelectorAll('.cp-mark-done').length;
    return {
      body,
      salaN: sala.length,
      loggedN: logged.length,
      salaDate: sala[0] && sala[0].date,
      feedback: sala[0] && sala[0].feedback,
      duration: sala[0] && sala[0].duration,
      ex: ((sala[0] && sala[0].exercises) || []).map(e => e.name),
      btns,
      banner: !!document.querySelector('.cp-no-logged-banner'),
      doneClass: !!document.querySelector('.cp-sess-done'),
      pkgUsed: ((window.PACKAGES || [])[0] || {}).sessionsUsed,
      pkgTick: !!(sala[0] && sala[0].pkgTick)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_training_sala_logged.png') });
  ok('sala session saved', after.salaN === 1 && after.loggedN === 1, JSON.stringify(after));
  ok('sala ticks paid package', after.pkgTick === true && after.pkgUsed === 4, JSON.stringify({ tick: after.pkgTick, used: after.pkgUsed }));
  ok('sala rating and duration', after.feedback === 4 && after.duration === 55, JSON.stringify(after));
  ok('zrobione 1 in kpi', after.loggedN === 1);
  ok('copied exercises', after.ex.includes('Przysiad goblet') && after.ex.includes('Wyciskanie'), JSON.stringify(after.ex));
  ok('one card still pending', after.btns === 1);
  ok('banner gone after one log', !after.banner);
  ok('done class on fulfilled card', after.doneClass);
  ok('no planned duplicate on logged day', !/×2/.test(after.body), after.body.slice(0, 400));

  await page.click('button[onclick="cpMpTab(\'c-justyna\',\'history\')"]');
  await page.waitForTimeout(200);
  const hist = await page.evaluate(() => (document.getElementById('cp-mp-content') || {}).innerText || '');
  await page.screenshot({ path: path.join(shotDir, 'cp_training_history.png') });
  ok('history shows sala session', /Sala/i.test(hist) && /OBWÓD A PLAN/.test(hist), hist.slice(0, 400));
  ok('history hides unlogged plan day', !/OBWÓD B PLAN/.test(hist), hist.slice(0, 400));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cal-log-done UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
