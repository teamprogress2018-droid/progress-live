// UI: Kontynuuj plan z Fitebo kopiuje ćwiczenia i pokazuje zmianę serii/powt. po tygodniach.
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
  await page.click('button:has-text("Kontynuuj plan z Fitebo")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotDir, 'cp_fitebo_continue_w1.png') });

  const after = await page.evaluate(() => {
    const body = (document.getElementById('cp-body') || {}).innerText || '';
    const cont = (window.PL || []).find(p => p.source === 'fitebo-continue');
    const names = cont ? cont.days.flatMap(d => (d.exercises || []).map(e => e.name)) : [];
    const w1 = cont && cont.days[0].exercises[0].w1;
    const w3 = cont && cont.days[0].exercises[0].w3;
    return {
      body,
      onPlan: /Kontynuacja Fitebo/.test(body),
      weeks: (body.match(/Adaptacja|Hipertrofia/g) || []).length,
      names,
      w1, w3,
      gen: !!window.__aplGenCalled,
      stillDrawer: !!document.querySelector('#cp-drawer.open')
    };
  });
  ok('stayed on client plan', after.stillDrawer && after.onPlan, after.body.slice(0, 250));
  ok('did not call AI generate', !after.gen);
  ok('copied fitebo names only', after.names.join('|') === 'Wyciskanie hantli|Ściąganie drążka|Hack squat', JSON.stringify(after.names));
  ok('week chips shown', /Hipertrofia/.test(after.body) && !/Adaptacja/.test(after.body));
  ok('w1 load shown', /Wyciskanie hantli/.test(after.body) && /×/.test(after.body));

  await page.click('button:has-text("3. Hipertrofia II")');
  await page.waitForTimeout(200);
  const w3view = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#cp-body div')].map(el => (el.textContent || '').trim()).filter(t => /Wyciskanie hantli/.test(t));
    return { rows, body: (document.getElementById('cp-body') || {}).innerText || '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_fitebo_continue_w3.png') });
  ok('week 3 still same exercise', w3view.rows.some(t => /Wyciskanie hantli/.test(t)));
  ok('week 3 sets/reps differ from w1', after.w1 && after.w3 && (after.w1.s !== after.w3.s || after.w1.r !== after.w3.r), JSON.stringify({ w1: after.w1, w3: after.w3 }));

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
