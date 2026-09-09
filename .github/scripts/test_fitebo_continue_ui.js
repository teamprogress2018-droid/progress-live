// UI: zakładka Plan — Kontynuuj plan z Fitebo otwiera generator z logami i progresją.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.FITEBO_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-fitebo'));
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
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    window.aplGenerate = function () { window.__aplGenCalled = true; };
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
      level: 'poczatkujacy',
      status: 'active',
      trainingFreq: 3
    }];
    window.PL = [{
      id: 'p-fb',
      clientId: 'c-rad',
      name: 'Plan z Fitebo',
      method: 'PPL',
      source: 'fitebo',
      fromFitebo: true,
      duration: 4,
      days: [
        { day: 'Push', muscles: 'Klatka', exercises: [{ name: 'Wyciskanie hantli', sets: '4', reps: '4-6', kg: '22.5' }] },
        { day: 'Pull', muscles: 'Plecy', exercises: [{ name: 'Ściąganie drążka', sets: '4', reps: '6-8', kg: '50' }] },
        { day: 'Legs', muscles: 'Nogi', exercises: [{ name: 'Hack squat', sets: '4', reps: '6-8', kg: '60' }] }
      ]
    }];
    window.SE = [{
      id: 's-fb', clientId: 'c-rad', date: '2026-09-08', type: 'Push', source: 'fitebo',
      notes: 'Zaimportowano z Fitebo',
      exercises: [{ name: 'Wyciskanie hantli', kg: 22.5 }]
    }];
    window.TASKS = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-rad');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cpt-plan');
  await page.waitForSelector('button:has-text("Kontynuuj plan z Fitebo")');
  await page.screenshot({ path: path.join(shotDir, 'cp_plan_fitebo.png') });
  const planTab = await page.evaluate(() => ({
    btn: !![...document.querySelectorAll('button')].find(b => /Kontynuuj plan z Fitebo/.test(b.textContent || '')),
    planName: (document.getElementById('cp-body') || {}).innerText || ''
  }));
  ok('continue button on plan tab', planTab.btn);
  ok('fitebo plan listed', /Plan z Fitebo/.test(planTab.planName), planTab.planName.slice(0, 200));

  await page.click('button:has-text("Kontynuuj plan z Fitebo")');
  await page.waitForTimeout(400);
  const gen = await page.evaluate(() => ({
    screen: !!(document.getElementById('screen-aiplangen') && document.getElementById('screen-aiplangen').classList.contains('active')),
    client: (document.getElementById('apl-client') || {}).value,
    notes: (document.getElementById('apl-notes') || {}).value || '',
    prog: (typeof aplGetVal === 'function' ? aplGetVal('apl-progression') : ''),
    method: (typeof aplGetVal === 'function' ? aplGetVal('apl-methods') : ''),
    generated: !!window.__aplGenCalled,
    ctx: !!(window._aplFiteboContinue && window._aplFiteboContinue.context)
  }));
  await page.screenshot({ path: path.join(shotDir, 'apl_fitebo_continue.png') });
  ok('opened AI generator', gen.screen, JSON.stringify(gen));
  ok('client prefilled', gen.client === 'c-rad');
  ok('notes have fitebo log', /KONTYNUACJA FITEBO/.test(gen.notes) && /Wyciskanie hantli/.test(gen.notes));
  ok('double progression', gen.prog === 'double');
  ok('PPL method', gen.method === 'PPL');
  ok('generate kicked off', gen.generated);
  ok('continue flag set', gen.ctx);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll fitebo-continue UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
