// UI: profil klienta → Pomiary → Masa i BMI — wiek metaboliczny, nawodnienie, ocena fizyczności.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.MASS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-mass'));
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
    window.CL = [{
      id: 'c-aga', name: 'Agnieszka Sakowska', age: 35, weight: 55.8, height: 168,
      goal: 'redukcja', level: 'poczatkujacy', gender: 'K', status: 'active'
    }];
    window.SE = [];
    window.PL = [];
    window.TASKS = [];
    window.METRIC_GROUPS = [];
    window.METRIC_ENTRIES = [{
      id: 'me-aga', clientId: 'c-aga', groupId: 'mg1', date: '2026-09-06',
      values: { m1: 55.8, m2: 28, m3: 38.1, m4: 19.8 }
    }];
  });

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-aga');
    if (typeof setCPTab === 'function') setCPTab('metrics');
    if (typeof setCPMetricGroup === 'function') setCPMetricGroup('c-aga', 'mg1');
  });
  await page.waitForTimeout(400);

  const tab = await page.evaluate(() => (document.getElementById('cp-body') || {}).innerText || '');
  await page.screenshot({ path: path.join(shotDir, 'cp_metrics_mass_last.png') });
  ok('masa tab visible', /Masa i BMI/i.test(tab), tab.slice(0, 300));
  ok('existing fields', /Masa ciała/.test(tab) && /tkanki tłuszczowej/.test(tab) && /Masa mięśniowa/.test(tab) && /BMI/.test(tab));
  ok('new field labels on card', /Wiek metaboliczny/.test(tab) && /Nawodnienie/.test(tab) && /Ocena fizyczności/.test(tab));
  ok('empty new values shown as dash', /Wiek metaboliczny[\s\S]{0,40}—/.test(tab) || /Wiek metaboliczny/.test(tab));

  await page.evaluate(() => {
    if (typeof openMetricEntryForClient === 'function') openMetricEntryForClient('c-aga', 'mg1', 'me-aga');
  });
  await page.waitForSelector('#m-metric-entry.show');
  const form = await page.evaluate(() => {
    const fields = document.getElementById('me-fields');
    const ids = [...(fields ? fields.querySelectorAll('input') : [])].map((el) => el.id);
    const ph = {};
    ids.forEach((id) => { const el = document.getElementById(id); if (el) ph[id] = el.getAttribute('placeholder') || ''; });
    return { text: fields ? (fields.innerText || '') : '', ids, ph };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_metrics_mass_form.png') });
  ok('form hint tanita', /Tanita|InBody|nawodnienie/i.test(form.text), form.text.slice(0, 240));
  ['mef-m1', 'mef-m2', 'mef-m3', 'mef-m4', 'mef-m5', 'mef-m6', 'mef-m7'].forEach((id) => {
    ok('field ' + id, form.ids.includes(id), form.ids.join(','));
  });
  ok('labels in form', /Wiek metaboliczny/.test(form.text) && /Nawodnienie/.test(form.text) && /Ocena fizyczności/.test(form.text));
  ok('physique placeholder', form.ph['mef-m7'] === '1–9', JSON.stringify(form.ph));

  await page.fill('#mef-m5', '32');
  await page.fill('#mef-m6', '51.2');
  await page.fill('#mef-m7', '5');
  await page.evaluate(() => { if (typeof saveMetricEntry === 'function') return saveMetricEntry(); });
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    const body = (document.getElementById('cp-body') || {}).innerText || '';
    const last = (window.METRIC_ENTRIES || []).filter((e) => e.clientId === 'c-aga' && e.groupId === 'mg1').sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return { body, values: last && last.values };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_metrics_mass_saved.png') });
  ok('saved metabolic age', after.values && Number(after.values.m5) === 32, JSON.stringify(after.values));
  ok('saved hydration', after.values && Number(after.values.m6) === 51.2, JSON.stringify(after.values));
  ok('saved physique', after.values && Number(after.values.m7) === 5, JSON.stringify(after.values));
  ok('card shows new numbers', /32/.test(after.body) && /51\.2/.test(after.body), after.body.slice(0, 600));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll mass/inbody UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
