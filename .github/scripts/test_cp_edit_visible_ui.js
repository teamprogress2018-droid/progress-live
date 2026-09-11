// UI: profil klienta — widoczna edycja imienia i nazwiska.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CP_EDIT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cp-edit'));
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
    window.CL = [{
      id: 'c-aga',
      name: 'Agnieszka',
      email: 'agnieszka@example.com',
      phone: '',
      age: 50,
      height: 168,
      weight: 62,
      goal: 'masa',
      level: 'poczatkujacy',
      gender: 'K',
      status: 'active',
      trainingFreq: 2,
      preferredTrainTime: 'Rano (6-10)'
    }];
    window.SE = [];
    window.PL = [{ id: 'pl-aga', clientId: 'c-aga', clientName: 'Agnieszka', name: 'FBW' }];
    window.PACKAGES = [{ id: 'pk-aga', clientId: 'c-aga', clientName: 'Agnieszka', title: '10 sesji' }];
    window.INVOICES = [{ id: 'inv-aga', pkgId: 'pk-aga', clientName: 'Agnieszka', amount: 1200 }];
    window.ONBOARDING_FLOW = { history: [{ clientId: 'c-aga', clientName: 'Agnieszka', parts: 'ankieta' }] };
    window.TASKS = [];
    window.METRIC_ENTRIES = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-aga');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.waitForSelector('#cp-edit-data-btn');
  const before = await page.evaluate(() => ({
    headerBtn: !!(document.getElementById('cp-edit-data-btn')),
    headerBtnVisible: (() => {
      const el = document.getElementById('cp-edit-data-btn');
      if (!el) return false;
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
    })(),
    cta: !!document.querySelector('.cp-ov-edit-cta'),
    form: !!document.getElementById('cpe-name'),
    name: (document.getElementById('cp-name') || {}).textContent || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'cp_edit_overview.png') });
  ok('header Edytuj dane visible', before.headerBtn && before.headerBtnVisible, JSON.stringify(before));
  ok('overview CTA visible', before.cta, JSON.stringify(before));
  ok('form hidden until click', !before.form);
  ok('header shows Agnieszka', /Agnieszka/.test(before.name));

  await page.click('#cp-edit-data-btn');
  await page.waitForSelector('#cpe-name');
  const opened = await page.evaluate(() => ({
    form: !!document.getElementById('cp-edit-card'),
    value: (document.getElementById('cpe-name') || {}).value || '',
    label: ((document.querySelector('label[for="cpe-name"]') || {}).textContent || '')
  }));
  await page.screenshot({ path: path.join(shotDir, 'cp_edit_form.png') });
  ok('edit form opened', opened.form);
  ok('name field has Agnieszka', opened.value === 'Agnieszka', opened.value);
  ok('label imię i nazwisko', /imię i nazwisko/i.test(opened.label));

  await page.fill('#cpe-name', 'Agnieszka Kowalska');
  await page.click('button[onclick="saveCPEdit(\'c-aga\')"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    header: (document.getElementById('cp-name') || {}).textContent || '',
    client: (window.CL.find((x) => x.id === 'c-aga') || {}).name || '',
    formGone: !document.getElementById('cpe-name'),
    rail: (document.querySelector('.cp-ov-rail') || {}).innerText || '',
    planName: ((window.PL[0] || {}).clientName) || '',
    pkgName: ((window.PACKAGES[0] || {}).clientName) || '',
    invName: ((window.INVOICES[0] || {}).clientName) || '',
    onbName: ((((window.ONBOARDING_FLOW || {}).history || [])[0] || {}).clientName) || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'cp_edit_saved.png') });
  ok('header updated with surname', after.header === 'Agnieszka Kowalska', after.header);
  ok('CL name updated', after.client === 'Agnieszka Kowalska', after.client);
  ok('form closed after save', after.formGone);
  ok('rail shows full name', /Agnieszka Kowalska/.test(after.rail), after.rail.slice(0, 200));
  ok('plan cache renamed', after.planName === 'Agnieszka Kowalska', after.planName);
  ok('package cache renamed', after.pkgName === 'Agnieszka Kowalska', after.pkgName);
  ok('invoice cache renamed', after.invName === 'Agnieszka Kowalska', after.invName);
  ok('onboard history renamed', after.onbName === 'Agnieszka Kowalska', after.onbName);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-edit-visible UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
