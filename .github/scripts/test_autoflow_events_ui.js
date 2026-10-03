// UI: Autoflow triggers and quota recovery use the real browser queue helpers.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.AF_EVENT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-af-events'));
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
  // This suite only uses fixtures. Never allow a regression to contact live Firestore.
  await page.route('**://firestore.googleapis.com/**', route => route.abort());
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const ui = await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    if (typeof goTo === 'function') goTo('automation');
    if (typeof setAutoTab === 'function') setAutoTab('autoflow');
    if (typeof openM === 'function') openM('m-autoflow-builder');
    const typeSel = document.getElementById('af-type');
    if (typeSel) {
      typeSel.value = 'trigger';
      typeSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof updateAfBuilderUi === 'function') updateAfBuilderUi();
    const wrap = document.getElementById('af-trigger-wrap');
    const sel = document.getElementById('af-trigger');
    const opts = sel ? [...sel.options].map(o => ({ value: o.value, label: (o.textContent || '').trim() })) : [];
    if (sel) sel.value = 'package.expired';
    const afterPkg = sel && sel.value;
    if (sel) sel.value = 'checkin.submitted';
    const afterCi = sel && sel.value;
    const map = typeof autoflowTriggerForEvent === 'function' ? {
      pkg: autoflowTriggerForEvent('package.expired'),
      ci: autoflowTriggerForEvent('checkin.submitted'),
      idle: autoflowTriggerForEvent('client.inactive'),
      soon: autoflowTriggerForEvent('session.soon')
    } : {};
    return {
      opts,
      map,
      hasSel: !!sel,
      wrapDisplay: wrap ? wrap.style.display : '',
      afterPkg,
      afterCi,
      modalShow: !!(document.getElementById('m-autoflow-builder') || {}).classList.contains('show')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'autoflow_triggers.png') });
  ok('trigger options', ui.opts.some((o) => o.value === 'package.expired') && ui.opts.some((o) => o.value === 'checkin.submitted'), JSON.stringify(ui.opts));
  ok('legacy triggers', ['inactivity', 'session_today', 'new_client'].every((v) => ui.opts.some((o) => o.value === v)), JSON.stringify(ui.opts));
  ok('builder opens', ui.modalShow && ui.wrapDisplay === 'block', JSON.stringify({ modal: ui.modalShow, wrap: ui.wrapDisplay }));
  ok('can select package', ui.afterPkg === 'package.expired');
  ok('can select checkin', ui.afterCi === 'checkin.submitted');
  ok('event map', ui.map.pkg === 'package.expired' && ui.map.ci === 'checkin.submitted' && ui.map.idle === 'inactivity' && ui.map.soon === 'session_today', JSON.stringify(ui.map));

  const quotaEmpty = await page.evaluate(() => {
    closeM('m-autoflow-builder');
    const owner = 'autoflow-quota-ui-owner';
    window._uid = owner;
    window._clientAppMode = false;
    window._clientPreviewMode = false;
    window._afStateReady = true;
    window._afStateDocId = owner;
    window._afQueueRunning = null;
    window._afRetryRunning = null;
    window._afStateSave = null;
    window._afQuotaUntil = {};
    window._afOutboxRestoredState = null;
    window._db = { fixture: true };
    window._quotaUiCalls = { writes: 0, transactions: 0, notifications: [] };
    window._doc = (_db, collection, id) => ({ collection, id });
    window._setDoc = async () => { window._quotaUiCalls.writes++; };
    window._runTransaction = async () => {
      window._quotaUiCalls.transactions++;
      throw Object.assign(new Error('fixture quota'), { code: 'resource-exhausted' });
    };
    window.notify = message => window._quotaUiCalls.notifications.push(message);
    window.CL = [];
    window.AUTOFLOWS = [];
    window.PACKAGES = [];
    window.SE = [];
    window.TASKS = [];
    window.MSGS = {};
    window.AF_STATE = { trainerId: owner, enrollments: {}, executed: {}, lastFired: {}, logs: [], pending: {} };
    const paused = afPauseForQuota({ code: 'resource-exhausted' }, afQueueSession());
    renderAutoflowLog();
    return { paused, until: afQuotaPauseUntil(), logs: window.AF_STATE.logs.length, pending: Object.keys(window.AF_STATE.pending).length };
  });
  const banner = page.locator('#autoflow-log [role="status"]');
  ok('quota banner visible with empty history and queue', quotaEmpty.paused && quotaEmpty.logs === 0 && quotaEmpty.pending === 0 && await banner.isVisible());
  ok('quota banner explains deferral without claiming completion', /limit bazy/.test(await banner.innerText()) && /Kolejna próba po/.test(await banner.innerText()) && /nie oznaczono ich jako wykonane/.test(await banner.innerText()));

  const queuedBefore = await page.evaluate(() => {
    const owner = window._uid, clientId = 'quota-ui-client', afId = 'quota-ui-flow';
    const step = { type: 'task', day: 1, text: 'Fixture awaiting confirmed write' };
    const id = 'af_' + encodeURIComponent(JSON.stringify([owner, afId, clientId, '0']));
    window.CL = [{ id: clientId, trainerId: owner, name: 'Klient testowy', status: 'active' }];
    window.AUTOFLOWS = [{ id: afId, trainerId: owner, name: 'Automatyzacja testowa', status: 'active', scope: 'all', type: 'trigger', trigger: 'new_client', steps: [step] }];
    window.AF_STATE.enrollments[afId] = { [clientId]: new Date().toISOString().slice(0, 10) };
    window.AF_STATE.executed[afId] = { [clientId]: {} };
    window.AF_STATE.lastFired[afId] = { [clientId]: {} };
    window.AF_STATE.pending[id] = {
      id, owner, afId, clientId, afDocId: afId, clientDocId: clientId, mark: '0', si: 0, oneShot: true, step,
      createdAt: new Date().toISOString(), attempts: 2, nextRetry: 0, status: 'error', retryRequestId: 'existing-retry-generation'
    };
    window.AF_STATE.serverStatus = { [id]: { status: 'exhausted', attempts: 5, afId, clientId, checkedAt: Date.now() } };
    window._quotaUiJobId = id;
    renderAutoflows();
    renderAutoflowLog();
    return JSON.stringify(window.AF_STATE.pending[id]);
  });
  const pausedSnapshot = () => page.evaluate(async () => {
    await Promise.resolve();
    if (window._afQueueRunning) await window._afQueueRunning;
    if (window._afRetryRunning) await window._afRetryRunning;
    return {
      ...window._quotaUiCalls,
      job: JSON.stringify(window.AF_STATE.pending[window._quotaUiJobId]),
      logs: window.AF_STATE.logs.length,
      effects: window.TASKS.length + Object.values(window.MSGS).reduce((n, rows) => n + rows.length, 0),
      until: afQuotaPauseUntil()
    };
  });
  await page.getByRole('button', { name: 'Sprawdź teraz', exact: true }).click();
  const afterCheck = await pausedSnapshot();
  ok('check now makes no Firestore request during quota pause', afterCheck.writes === 0 && afterCheck.transactions === 0, JSON.stringify(afterCheck));
  ok('check now preserves pending attempts and retry generation', afterCheck.job === queuedBefore && afterCheck.logs === 0 && afterCheck.effects === 0);
  ok('check now reports quota pause instead of success', afterCheck.notifications.length === 1 && /limit bazy/.test(afterCheck.notifications[0]));

  await page.getByRole('button', { name: 'Ponów nieudane zapisy', exact: true }).click();
  const afterRetry = await pausedSnapshot();
  ok('manual retry makes no Firestore request during quota pause', afterRetry.writes === 0 && afterRetry.transactions === 0, JSON.stringify(afterRetry));
  ok('manual retry does not reset exhausted server job or local attempts', afterRetry.job === queuedBefore && afterRetry.logs === 0 && afterRetry.effects === 0);
  ok('manual actions do not extend or bypass the existing quota pause', afterRetry.until === quotaEmpty.until && await banner.isVisible());
  ok('manual retry reports that work is deferred', afterRetry.notifications.length === 2 && /limit bazy/.test(afterRetry.notifications[1]));
  await page.screenshot({ path: path.join(shotDir, 'autoflow_quota_pause.png') });

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll autoflow-events UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
