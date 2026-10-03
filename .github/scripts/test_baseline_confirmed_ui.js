// Browser coverage for the real baseline modal and confirmed transaction boundary.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    page.setDefaultTimeout(20000);
    await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
    let liveRequests = 0;
    await page.route('**://firestore.googleapis.com/**', route => { liveRequests++; return route.abort(); });
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' +
      (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.saveClientBaselineConfirmed === 'function' &&
      typeof window.openClientBaselineModal === 'function' && typeof window.saveClientBaselineModal === 'function');
    await page.evaluate(() => {
      const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const f = window._baselineConfirmedUi = {
        owner: 'baseline-owner', a: 'baseline-a', b: 'baseline-b', docs: {}, pending: [],
        transactions: [], commits: [], unexpected: [], notifications: []
      };
      const key = ref => ref.collection + '/' + ref.id;
      window._db = { fixture: true };
      window._doc = (_db, collection, id) => ({ collection, id });
      window._uid = f.owner;
      window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true;
      window._clientAppMode = false;
      window._clientPreviewMode = false;
      window.CL = [
        { id: f.a, trainerId: f.owner, name: 'Klient Alfa', status: 'active', goal: 'masa' },
        { id: f.b, trainerId: f.owner, name: 'Klient Beta', status: 'active', goal: 'redukcja' }
      ];
      window.METRIC_ENTRIES = [];
      f.docs['clients/' + f.a] = clone(window.CL[0]);
      f.docs['clients/' + f.b] = clone(window.CL[1]);
      window.persistById = (...args) => { f.unexpected.push(['persistById', args[0]]); throw Error('Unexpected optimistic write'); };
      window._setDoc = (...args) => { f.unexpected.push(['setDoc', args[1]]); throw Error('Unexpected direct write'); };
      window.renderDash = () => {};
      window.renderClients = () => {};
      const notify = window.notify;
      window.notify = message => { f.notifications.push(String(message)); notify(message); };
      window._runTransaction = async (_db, callback) => {
        const reads = [], writes = [];
        const tx = {
          get: async ref => {
            if (writes.length) throw Error('Read after write');
            reads.push(key(ref));
            const exists = Object.prototype.hasOwnProperty.call(f.docs, key(ref));
            const data = exists ? clone(f.docs[key(ref)]) : null;
            return { id: ref.id, exists: () => exists, data: () => clone(data) };
          },
          set: (ref, value, options = {}) => writes.push({ ref, value: clone(value), options }),
          update: (ref, value) => writes.push({ ref, value: clone(value), options: { merge: true } }),
          delete: ref => { f.unexpected.push(['delete', key(ref)]); throw Error('Unexpected delete'); }
        };
        const result = await callback(tx);
        const transaction = { reads, writes: writes.map(w => key(w.ref)) };
        f.transactions.push(transaction);
        return new Promise((resolve, reject) => {
          f.pending.push({
            transaction,
            fail() { f.pending.shift(); reject(Error('Fixture connection interrupted')); },
            complete(lostAck = false) {
              f.pending.shift();
              for (const write of writes) {
                f.docs[key(write.ref)] = write.options.merge
                  ? { ...(f.docs[key(write.ref)] || {}), ...clone(write.value) }
                  : clone(write.value);
                f.commits.push(key(write.ref));
              }
              if (lostAck) reject(Error('Fixture lost acknowledgement'));
              else resolve(result);
            }
          });
        });
      };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
      window.goTo('clients');
    });

    const modal = page.locator('#m-baseline');
    const save = page.locator('#bl-save-btn');
    const status = page.locator('#bl-save-status');
    const open = cid => page.evaluate(cid => openClientBaselineModal(cid, false), cid);
    const pending = count => page.waitForFunction(count => window._baselineConfirmedUi.pending.length === count, count);
    const release = mode => page.evaluate(mode => {
      const p = window._baselineConfirmedUi.pending[0];
      if (mode === 'fail') p.fail(); else p.complete(mode === 'loseAck');
    }, mode);
    const state = () => page.evaluate(() => {
      const f = window._baselineConfirmedUi;
      return { client: window._baselineClientId, local: window.CL.map(c => ({ ...c })),
        metrics: window.METRIC_ENTRIES.map(e => ({ ...e })), transactions: f.transactions,
        commits: f.commits, docs: JSON.parse(JSON.stringify(f.docs)), unexpected: f.unexpected,
        notifications: f.notifications };
    });
    const fill = async () => {
      await page.locator('#bl-date').fill('2026-09-28');
      await page.locator('#bl-weight').fill('81.2');
      await page.locator('#bl-bf').fill('18.5');
      await page.locator('#bl-circ-m1').fill('101');
    };
    const remoteMetrics = s => Object.keys(s.docs).filter(k => k.startsWith('metricEntries/'));
    let passed = 0;
    const ok = (name, condition, detail) => { assert.ok(condition, name + (detail ? ': ' + JSON.stringify(detail) : '')); passed++; console.log('OK ' + name); };

    await open('baseline-a');
    ok('real baseline modal opens for first client', await modal.isVisible() && /ALFA/.test(await page.locator('#m-baseline-title').innerText()));
    await fill();
    const before = await state();
    await save.click();
    await pending(1);
    let s = await state();
    ok('pending save has no local or remote baseline', s.metrics.length === 0 && remoteMetrics(s).length === 0 &&
      !s.local[0].baselineDone && !s.docs['clients/baseline-a'].baselineDone, s);
    ok('save locks pending inputs and announces progress', await save.isDisabled() && await page.locator('#bl-weight').isDisabled() &&
      await status.isVisible() && await status.getAttribute('aria-live') === 'polite');
    await page.evaluate(() => { window._baselineDuplicate = saveClientBaselineModal(); });
    ok('double click does not queue a second transaction', (await state()).transactions.length === 1);
    await release('fail');
    await page.waitForFunction(() => !document.getElementById('bl-save-btn').disabled);
    s = await state();
    ok('failed save keeps modal open, values, and incomplete state', await modal.isVisible() &&
      await page.locator('#bl-weight').inputValue() === '81.2' &&
      s.metrics.length === 0 && !s.local[0].baselineDone && remoteMetrics(s).length === 0);
    ok('failed save shows inline retry feedback', await status.isVisible() &&
      /zachowaliśmy wartości do ponowienia/i.test(await status.innerText()));
    const firstIds = s.transactions[0].writes.filter(k => k.startsWith('metricEntries/'));
    await modal.locator('.modal-close').click();
    await open('baseline-a');
    ok('same client reopens with frozen retry values', await page.locator('#bl-weight').inputValue() === '81.2' &&
      await page.locator('#bl-bf').inputValue() === '18.5' && await page.locator('#bl-weight').isDisabled());
    await save.click(); await pending(1);
    s = await state();
    assert.deepEqual(s.transactions[1].writes.filter(k => k.startsWith('metricEntries/')), firstIds);
    ok('retry targets exact metric ids', firstIds.length === 2);
    await release('loseAck');
    await page.waitForFunction(() => !document.getElementById('bl-save-btn').disabled);
    s = await state();
    ok('lost acknowledgement leaves local completion pending', !s.local[0].baselineDone && s.metrics.length === 0 && remoteMetrics(s).length === 2);
    await save.click(); await pending(1);
    s = await state();
    ok('receipt retry reads exact records and issues no writes', firstIds.every(id => s.transactions[2].reads.includes(id)) && s.transactions[2].writes.length === 0);
    await release('succeed');
    await page.waitForFunction(() => window.CL[0].baselineDone === true);
    s = await state();
    ok('acknowledgement closes modal and loads confirmed metrics', !(await modal.isVisible()) &&
      s.metrics.length === 2 && s.local[0].baselineDone && !s.local[1].baselineDone && remoteMetrics(s).length === 2);
    ok('no optimistic path or Firebase network used', s.unexpected.length === 0 && liveRequests === 0, s.unexpected);

    const transactionsAfterA = s.transactions.length;
    await open('baseline-a');
    ok('reopening a saved baseline preserves its receipt and frozen values', await modal.isVisible() &&
      await page.locator('#bl-weight').inputValue() === '81.2' &&
      await page.locator('#bl-weight').isDisabled() && await save.isDisabled() &&
      await page.locator('#bl-new-btn').isVisible() && (await state()).transactions.length === transactionsAfterA);
    await page.locator('#bl-new-btn').click();
    ok('explicit new measurement starts an editable draft', await page.locator('#bl-weight').isEnabled() &&
      await save.isEnabled() && !(await page.locator('#bl-new-btn').isVisible()));
    await modal.locator('.modal-close').click();

    await open('baseline-b'); await fill();
    await save.click(); await pending(1);
    await open('baseline-a');
    const aTitle = await page.locator('#m-baseline-title').innerText();
    await release('succeed');
    await page.waitForFunction(() => window.CL[1].baselineDone === true);
    s = await state();
    ok('late other-client completion cannot close or replace current modal', await modal.isVisible() &&
      await page.locator('#m-baseline-title').innerText() === aTitle && s.client === 'baseline-a' &&
      s.notifications.some(message => /Beta/.test(message)));

    await page.evaluate(() => {
      const f = window._baselineConfirmedUi;
      const next = { id: 'baseline-c', trainerId: f.owner, name: 'Klient Gamma', status: 'active' };
      window.CL.push(next);
      f.docs['clients/' + next.id] = { ...next };
      openClientOnboardChecklist(next.id);
      openClientBaselineModal(next.id, true);
    });
    await fill();
    await save.click(); await pending(1);
    await modal.locator('.modal-close').click();
    await page.waitForFunction(() => document.getElementById('m-client-onboard').classList.contains('show') &&
      window._onboardClientId === 'baseline-c');
    const baselineRow = page.locator('#client-onboard-steps > div').filter({ hasText: 'Pomiary startowe (baseline)' });
    ok('checklist reopened while baseline confirmation is pending', await baselineRow.isVisible() &&
      !(await baselineRow.innerText()).includes('GOTOWE') && !(await modal.isVisible()));
    await page.evaluate(() => {
      const f = window._baselineConfirmedUi;
      f.checklistRefreshes = 0;
      f.opensAfterClose = [];
      const original = window.renderClientOnboardChecklist;
      window.renderClientOnboardChecklist = (...args) => { f.checklistRefreshes++; return original(...args); };
      const open = window.openM;
      window.openM = (...args) => { f.opensAfterClose.push(args[0]); return open(...args); };
    });
    await release('succeed');
    await page.waitForFunction(() => window.CL.find(c => c.id === 'baseline-c')?.baselineDone &&
      window._baselineConfirmedUi.checklistRefreshes > 0);
    ok('late acknowledgement refreshes only the visible matching checklist', await baselineRow.isVisible() &&
      (await baselineRow.innerText()).includes('GOTOWE') && !(await modal.isVisible()) &&
      (await page.evaluate(() => window._baselineConfirmedUi.opensAfterClose)).length === 0);
    console.log('\n' + passed + ' baseline modal confirmation UI checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
