// UI: zakładka Plan → Edytuj otwiera kreator z dniami Fitebo D1 (A)/(B).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '../..');
const shotDir = process.env.PLAN_EDIT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts')
  ? '/opt/cursor/artifacts'
  : path.join(require('os').tmpdir(), 'pl-plan-edit'));
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
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
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
    window.CL = [{
      id: 'c-rad',
      name: 'Radosław Jarząb',
      goal: 'masa',
      level: 'sredni',
      status: 'active'
    }];
    window.PL = [{
      id: 'p-fb-cont',
      clientId: 'c-rad',
      name: 'Kontynuacja Fitebo — 8 tyg.',
      method: 'Custom',
      source: 'fitebo-continue',
      fromFitebo: true,
      duration: 8,
      weekKeys: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'],
      currentWeek: 'w3',
      days: [
        {
          day: 'D1 (A)',
          muscles: 'Trening',
          exercises: [
            { name: 'Ściąganie drążka wyciągu górnego do klatki na szerokość barków (nachwyt)', sets: '4', reps: '8', kg: '96' },
            { name: 'Wiosłowanie sztangą w opadzie tułowia (podchwyt)', sets: '4', reps: '8', kg: '49.5' }
          ]
        },
        {
          day: 'D1 (B)',
          muscles: 'Barki, Biceps, Klatka piersiowa',
          exercises: [
            { name: 'Wyciskanie na ławce płaskiej', sets: '4', reps: '8', kg: '59.5' },
            { name: 'Przysiad', sets: '4', reps: '8', kg: '57' }
          ]
        }
      ]
    }];
    window.SE = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-rad', { tab: 'plan' });
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.waitForSelector('button:has-text("Edytuj")');
  await page.screenshot({ path: path.join(shotDir, 'plan_tab_before_edit.png') });
  await page.click('#cp-body button:has-text("Edytuj")');
  await page.waitForSelector('#screen-builder.active');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shotDir, 'plan_edit_builder.png') });

  const builder = await page.evaluate(() => {
    const days = [...document.querySelectorAll('#builder-days .builder-day')].map(de => ({
      day: (de.querySelector('.builder-day-select') || {}).value || '',
      muscles: (de.querySelector('.builder-day-focus') || {}).value || '',
      names: [...de.querySelectorAll('[data-f="name"]')].map(i => i.value)
    }));
    return {
      active: !!(document.getElementById('screen-builder') || {}).classList.contains('active'),
      drawer: !!(document.getElementById('cp-drawer') || {}).classList.contains('open'),
      title: ((document.querySelector('#screen-builder .topbar-title') || {}).textContent || ''),
      method: ((document.getElementById('b-method') || {}).value) || '',
      client: ((document.getElementById('b-client') || {}).value) || '',
      editing: window._editingPlanId || '',
      days
    };
  });
  ok('builder screen active', builder.active && !builder.drawer, JSON.stringify({ active: builder.active, drawer: builder.drawer }));
  ok('editing this plan', builder.editing === 'p-fb-cont' && /Edytuj plan/.test(builder.title), builder.title);
  ok('client selected', builder.client === 'c-rad');
  ok('Custom method becomes Własna', builder.method === 'Własna', builder.method);
  ok('keeps D1 (A)', builder.days[0] && builder.days[0].day === 'D1 (A)', JSON.stringify(builder.days[0]));
  ok('keeps D1 (B)', builder.days[1] && builder.days[1].day === 'D1 (B)', JSON.stringify(builder.days[1]));
  ok('loads pull exercises', (builder.days[0] && builder.days[0].names || []).some(n => /Ściąganie drążka/.test(n)));
  ok('loads bench', (builder.days[1] && builder.days[1].names || []).some(n => /Wyciskanie na ławce płaskiej/.test(n)));

  await page.click('#screen-builder button:has-text("Anuluj")');
  await page.waitForSelector('#cp-drawer.open');
  const back = await page.evaluate(() => ({
    drawer: !!(document.getElementById('cp-drawer') || {}).classList.contains('open'),
    planTab: !!(document.getElementById('cpt-plan') || {}).classList.contains('active'),
    body: ((document.getElementById('cp-body') || {}).innerText || '')
  }));
  await page.screenshot({ path: path.join(shotDir, 'plan_edit_back.png') });
  ok('cancel returns to client plan', back.drawer && back.planTab && /D1 \(A\)/.test(back.body), back.body.slice(0, 180));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll plan-edit-from-profile UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
