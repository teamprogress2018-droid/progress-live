// UI: zasoby YouTube + karta Garmin „Działa dziś” + import CSV.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.GARMIN_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-garmin'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const SAMPLE_CSV = [
  'Activity Type,Date,Title,Distance,Calories,Time,Avg HR,Steps',
  'Running,2024-03-12 18:30:00,Morning Run,5.23,412,00:32:15,148,8432'
].join('\n');

(async () => {
  const port = process.env.GARMIN_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.GARMIN_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate((csv) => {
    window.__garminCsv = csv;
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c-anna', name: 'Anna Nowak' }];
    window.SE = [];
    window.METRIC_ENTRIES = [];
    window.USER_RESOURCES = (typeof DEMO_RESOURCES !== 'undefined' ? DEMO_RESOURCES : []).map((r) => Object.assign({}, r));
    window.INT_CONNECTIONS = {};
  }, SAMPLE_CSV);

  await page.evaluate(() => {
    goTo('resources');
    if (typeof renderResources === 'function') renderResources();
  });
  await page.waitForSelector('.res-card');
  const res = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.res-card')];
    const urls = [...document.querySelectorAll('.res-card-url')].map((el) => (el.textContent || '').trim());
    return {
      count: cards.length,
      urls,
      names: [...document.querySelectorAll('.res-card-title')].map((el) => (el.textContent || '').trim()),
      text: (document.getElementById('screen-resources') || {}).innerText || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'resources_youtube.png') });
  ok('resource cards rendered', res.count >= 8, 'count=' + res.count);
  ok('no spotify domains on cards', res.urls.every((u) => !/spotify/i.test(u)), res.urls.join(','));
  ok('youtube domains on cards', res.urls.some((u) => /youtube\.com/i.test(u)), res.urls.slice(0, 5).join(','));
  ok('huberman visible', res.names.some((n) => /Huberman/i.test(n)));

  await page.evaluate(() => {
    if (typeof sendResourceSetClientField === 'function') sendResourceSetClientField('c-anna', 'Anna Nowak');
    window.sendResourceId = 'r8';
    if (typeof confirmSendResource === 'function') confirmSendResource();
  });
  const sent = await page.evaluate(() => {
    const msgs = (window.MSGS && window.MSGS['c-anna']) || [];
    const last = msgs[msgs.length - 1] || {};
    return { n: msgs.length, text: last.text || last.body || JSON.stringify(last) };
  });
  ok('sent youtube podcast to client', /Huberman|youtube/i.test(String(sent.text)), JSON.stringify(sent).slice(0, 300));

  await page.evaluate(() => {
    goTo('integrations');
    if (typeof renderIntegrations === 'function') renderIntegrations();
  });
  await page.waitForSelector('[data-int="garmin"]');
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-int="garmin"]');
    return { text: (el && el.innerText) || '', daily: !!(el && /Działa dziś/i.test(el.innerText || '')) };
  });
  ok('garmin card daily badge', card.daily, card.text.slice(0, 200));

  await page.evaluate(() => openIntDetail('garmin'));
  await page.waitForSelector('#int-garmin-client');
  const detail = await page.evaluate(() => ({
    body: (document.getElementById('int-detail-body') || {}).innerText || '',
    title: (document.getElementById('int-detail-title') || {}).textContent || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'garmin_csv_panel.png') });
  ok('garmin drawer title', /Garmin/i.test(detail.title));
  ok('garmin drawer has csv import', /Wczytaj CSV/i.test(detail.body));
  ok('garmin drawer says no firestore secrets', /nie zbieramy tu secretów do Firestore/i.test(detail.body));
  ok('garmin drawer is daily not server', /Działa dziś/i.test(detail.body) && !/Wymaga własnego serwera/i.test(detail.body));

  const imported = await page.evaluate(() => {
    const sel = document.getElementById('int-garmin-client');
    if (sel) sel.value = 'c-anna';
    return intGarminImportFor('c-anna', window.__garminCsv);
  });
  ok('ui import ok', imported && imported.ok && imported.metrics === 1, JSON.stringify(imported));
  const after = await page.evaluate(() => ({
    metrics: (window.METRIC_ENTRIES || []).filter((e) => e.source === 'garmin' && e.groupId === 'mg6'),
    sessions: (window.SE || []).filter((s) => s.source === 'garmin'),
    connected: !!(window.INT_CONNECTIONS && window.INT_CONNECTIONS.garmin && window.INT_CONNECTIONS.garmin.connected),
    last: (document.getElementById('int-garmin-last') || {}).textContent || '',
    card: (document.querySelector('[data-int="garmin"]') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'garmin_imported.png') });
  ok('ui metric stored', after.metrics.length === 1 && after.metrics[0].values.m2 === 412);
  ok('ui session stored', after.sessions.length === 1 && after.sessions[0].duration === 32);
  ok('garmin auto-connected', after.connected);
  ok('last import shown', /1 pomiar/i.test(after.last) || /Ostatni import/i.test(after.last), after.last);

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' test(s) failed');
    process.exit(1);
  }
  console.log('\nUI zasoby + Garmin: OK. Screenshoty: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
