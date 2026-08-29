// UI: profil klienta → Pomiary → Obwody ciała → formularz cm (taśma).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CIRC_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-circ'));
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
      id: 'c-justyna', name: 'Justyna Chylińska', age: 35, weight: 68, height: 168,
      goal: 'redukcja', level: 'początkujący', gender: 'kobieta', status: 'active'
    }];
    window.SE = [];
    window.PL = [];
    window.TASKS = [];
    window.METRIC_ENTRIES = [];
    window.METRIC_GROUPS = [];
  });

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-justyna');
    if (typeof setCPTab === 'function') setCPTab('metrics');
    if (typeof setCPMetricGroup === 'function') setCPMetricGroup('c-justyna', 'mg2');
  });
  await page.waitForTimeout(400);

  const tab = await page.evaluate(() => {
    const body = document.getElementById('cp-body');
    return body ? (body.innerText || '') : '';
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_metrics_circ_empty.png') });
  ok('obwody tab visible', /Obwody ciała/i.test(tab), tab.slice(0, 300));
  ok('empty circ prompt', /centymetr/i.test(tab), tab.slice(0, 400));
  ok('kondycja still listed', /Kondycja/.test(tab));

  await page.evaluate(() => {
    if (typeof openMetricEntryForClient === 'function') openMetricEntryForClient('c-justyna', 'mg2');
  });
  await page.waitForSelector('#m-metric-entry.show');
  const form = await page.evaluate(() => {
    const fields = document.getElementById('me-fields');
    const ids = [...(fields ? fields.querySelectorAll('input') : [])].map((el) => el.id);
    return {
      text: fields ? (fields.innerText || '') : '',
      ids,
      hint: /taśm|centymetr/i.test(fields ? fields.innerText : '')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_metrics_circ_form.png') });
  ok('form has cm hint', form.hint, form.text.slice(0, 200));
  ['mef-m1', 'mef-m2', 'mef-m3', 'mef-m4', 'mef-m5', 'mef-m6', 'mef-m8', 'mef-m10', 'mef-m11'].forEach((id) => {
    ok('field ' + id, form.ids.includes(id), form.ids.join(','));
  });
  ok('labels szyja klatka talia biodra ramie udo lydka',
    /Szyja/.test(form.text) && /Klatka/.test(form.text) && /Talia/.test(form.text) && /Biodra/.test(form.text)
    && /Ramię/.test(form.text) && /Udo/.test(form.text) && /Łydka/.test(form.text),
    form.text.slice(0, 400));
  ok('units cm', /\(cm\)/.test(form.text));

  const saved = await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('mef-m6', '33.5');
    set('mef-m1', '92');
    set('mef-m2', '74');
    set('mef-m3', '98');
    set('mef-m5', '28');
    set('mef-m4', '56');
    set('mef-m10', '35');
    if (typeof saveMetricEntry === 'function') saveMetricEntry();
    const e = (window.METRIC_ENTRIES || []).filter((x) => x.clientId === 'c-justyna' && x.groupId === 'mg2');
    return { n: e.length, values: e[0] && e[0].values };
  });
  ok('saved mg2 entry', saved.n === 1, JSON.stringify(saved));
  ok('saved tape values', saved.values && saved.values.m6 === 33.5 && saved.values.m2 === 74 && saved.values.m10 === 35, JSON.stringify(saved.values));

  await page.evaluate(() => {
    if (typeof setCPMetricGroup === 'function') setCPMetricGroup('c-justyna', 'mg2');
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (document.getElementById('cp-body') || {}).innerText || '');
  await page.screenshot({ path: path.join(shotDir, 'cp_metrics_circ_saved.png') });
  ok('history shows values', /92/.test(after) && /74/.test(after) && /Szyja/.test(after), after.slice(0, 500));

  await page.evaluate(() => {
    if (typeof setCPMetricGroup === 'function') setCPMetricGroup('c-justyna', 'mg4');
  });
  await page.waitForTimeout(200);
  const kond = await page.evaluate(() => (document.getElementById('cp-body') || {}).innerText || '');
  ok('kondycja still empty ok', /Kondycja/.test(kond) && /brak wpisów|Brak pomiarów/i.test(kond), kond.slice(0, 300));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll circ-metrics UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
