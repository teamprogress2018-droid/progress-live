// Both payment surfaces use the real service; only fictitious, staged Firebase is injected.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    page.setDefaultTimeout(20000);
    let liveRequests = 0;
    await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
    await page.route('**://firestore.googleapis.com/**', r => { liveRequests++; return r.abort(); });
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' +
      (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof markPackagePaidConfirmed === 'function' && typeof clearPackagePaidUiStates === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => JSON.parse(JSON.stringify(value));
      const f = window._paidUi = { data: {}, pending: [], transactions: [], queries: [], notices: [], events: [], unexpected: [], commits: [] };
      for (const name of ['persistById', '_setDoc', 'pushMsg', 'requestPayment']) window[name] = () => {
        f.unexpected.push(name); throw Error('Unexpected action: ' + name);
      };
      window._db = { fixture: true };
      window._doc = (_db, col, id) => ({ col, id }); window._col = (_db, col) => col;
      window._where = (key, op, value) => { if (op !== '==') throw Error('Unexpected query operator'); return { key, value }; };
      window._query = (col, ...filters) => ({ col, filters });
      window._getDocsFromServer = async query => {
        if (query.col !== 'invoices' || !query.filters.some(q => q.key === 'trainerId' && q.value === _uid))
          throw Error('Unexpected or unowned query');
        f.queries.push(clone(query));
        return { metadata: { hasPendingWrites: false }, docs: Object.entries(f.data)
          .filter(([key, row]) => key.startsWith(query.col + '/') && query.filters.every(q => row[q.key] === q.value))
          .map(([key, row]) => ({ id: key.split('/')[1], data: () => clone(row) })) };
      };
      window._runTransaction = async (_db, run) => {
        const entry = { reads: [], writes: [] }; f.transactions.push(entry);
        const result = await run({
          get: async ref => {
            if (entry.writes.length) throw Error('Read after staged write');
            entry.reads.push(ref.col + '/' + ref.id);
            const row = f.data[ref.col + '/' + ref.id];
            return { exists: () => !!row, data: () => clone(row) };
          },
          update: (ref, patch) => {
            if (!['packages', 'invoices'].includes(ref.col) || Object.keys(patch).some(key =>
              !['payStatus', 'status', 'paymentWriteId'].includes(key))) throw Error('Unexpected replacement update');
            entry.writes.push({ key: ref.col + '/' + ref.id, patch: clone(patch) });
          },
          set: () => { throw Error('Payment must update existing records only'); }
        });
        if (entry.writes.length) {
          await new Promise((resolve, reject) => f.pending.push({ resolve, reject }));
          const next = clone(f.data);
          entry.writes.forEach(write => { next[write.key] = { ...next[write.key], ...write.patch }; });
          f.data = next;
          f.commits.push({ writes: clone(entry.writes), packageStatus: next['packages/package-doc-a'].payStatus,
            invoiceStatuses: Object.values(next).filter(row => row.pkgId === 'pkg-a').map(row => row.status) });
        }
        return result;
      };
      window.notify = message => f.notices.push(String(message));
      window.fireIntEvent = (event, payload) => { f.events.push({ event, payload: clone(payload) }); return Promise.resolve(); };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
    });
    const reset = (options = {}) => page.evaluate(options => {
      clearPackagePaidUiStates(); if (typeof clearPackageSaveDrafts === 'function') clearPackageSaveDrafts();
      document.querySelectorAll('.modal-ov.show').forEach(el => el.classList.remove('show'));
      closeClientProfile();
      window._uid = 'paid-fixture-owner'; window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true; window._clientAppMode = false; window._clientPreviewMode = false;
      const invoiceId = options.legacy ? 'legacy-invoice-doc' : 'a1111111-1111-4111-8111-111111111111';
      const payStatus = options.status || 'pending';
      window.CL = [{ id: 'client-a', _fbId: 'owned-client-a', trainerId: _uid, name: 'Klient Alfa', status: 'active' },
        { id: 'client-b', trainerId: _uid, name: 'Klient Beta', status: 'active' }];
      window.PACKAGES = [{ id: 'pkg-a', _fbId: 'package-doc-a', trainerId: _uid, clientId: 'client-a', clientName: 'Klient Alfa',
        title: 'Pakiet testowy', type: 'trening', sessions: 10, sessionsUsed: 3, price: 500, payStatus,
        invoiceId: 'INV-LEGACY-42', ...(options.legacy ? {} : { invoiceDocId: invoiceId }),
        date: '2026-10-04', expiresDate: '2035-12-31', notes: 'Original package note' }];
      window.INVOICES = [{ id: invoiceId, _fbId: invoiceId, trainerId: _uid, pkgId: 'pkg-a', clientId: 'client-a',
        clientName: 'Klient Alfa', nr: 'INV-LEGACY-42', status: payStatus, amount: 500, date: '2026-10-04', method: 'transfer' }];
      for (const key of ['PL', 'SE', 'METRIC_ENTRIES', 'FORM_SENDS']) window[key] = [];
      window.SETTINGS = { company: { invoice_prefix: 'INV' } };
      const f = _paidUi; f.data = { 'clients/owned-client-a': { ...CL[0] }, 'clients/client-b': { ...CL[1] },
        'packages/package-doc-a': { ...PACKAGES[0] }, ['invoices/' + invoiceId]: { ...INVOICES[0] } };
      f.pending = []; f.transactions = []; f.queries = []; f.notices = []; f.events = []; f.commits = [];
      window._onboardResumeAfterProfile = null;
      goTo('payments'); setPayTab('packages'); openClientProfile('client-a', { tab: 'payments' });
    }, options);
    const state = () => page.evaluate(() => ({ packages: JSON.parse(JSON.stringify(PACKAGES)), invoices: JSON.parse(JSON.stringify(INVOICES)),
      remote: JSON.parse(JSON.stringify(_paidUi.data)), pending: _paidUi.pending.length,
      transactions: _paidUi.transactions, commits: _paidUi.commits, notices: _paidUi.notices,
      events: _paidUi.events, unexpected: _paidUi.unexpected, clientId: cpClientId, tab: cpTab }));
    const cpButton = page.locator('#cp-body [data-package-paid="pkg-a"]');
    const gridButton = page.locator('#pay-pkg-grid [data-package-paid="pkg-a"]');
    const cpStatus = page.locator('#cp-body [data-package-paid-status="pkg-a"]');
    const gridStatus = page.locator('#pay-pkg-grid [data-package-paid-status="pkg-a"]');
    const start = async () => { await cpButton.click(); await page.waitForFunction(() => _paidUi.pending.length === 1); };
    const release = (fail = false) => page.evaluate(fail => {
      const gate = _paidUi.pending.shift(); if (fail) gate.reject(Error('Fixture payment offline')); else gate.resolve();
    }, fail);
    const settled = () => page.waitForFunction(() => !packagePaidUiStates.get('pkg-a')?.pending);
    const stabilize = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    let passed = 0;
    const ok = (label, value, detail) => { assert.ok(value, label + (detail ? ': ' + JSON.stringify(detail) : '')); passed++; console.log('OK ' + label); };
    const same = (label, actual, expected) => { assert.deepEqual(actual, expected, label); passed++; console.log('OK ' + label); };

    await reset(); const before = await state(); await start(); let s = await state();
    same('pending leaves both local caches unchanged', [s.packages, s.invoices], [before.packages, before.invoices]);
    same('pending leaves remote records unchanged', s.remote, before.remote);
    ok('both payment surfaces lock the same pending package', await cpButton.isDisabled() && await gridButton.isDisabled());
    ok('pending status is visible and accessible in both surfaces', await cpStatus.isVisible() && await gridStatus.isVisible() &&
      await cpStatus.getAttribute('role') === 'status' && await gridStatus.getAttribute('aria-live') === 'polite' &&
      (await cpStatus.innerText()).includes('Potwierdzanie') && (await gridStatus.innerText()).includes('Potwierdzanie'));
    same('pending keeps both rendered payment pills unpaid', [await page.locator('#cp-body .card-sm .pill').innerText(),
      await page.locator('#pay-pkg-grid .pkg-card[data-pkg-id="pkg-a"] .pill').innerText()], ['OCZEKUJĄCY', 'OCZEKUJĄCY']);
    ok('no payment success or integration event occurs before ACK', s.notices.length === 0 && s.events.length === 0 && s.commits.length === 0, s);
    same('real service stages one atomic pair of payment patches', s.transactions.map(tx => tx.writes.map(w =>
      [w.key, Object.keys(w.patch).sort()])), [[['packages/package-doc-a', ['payStatus', 'paymentWriteId']],
      ['invoices/a1111111-1111-4111-8111-111111111111', ['paymentWriteId', 'status']]]]);
    same('transaction reads package, owned client and UUID invoice before staging', s.transactions[0].reads,
      ['packages/package-doc-a', 'clients/owned-client-a', 'invoices/a1111111-1111-4111-8111-111111111111']);
    await page.evaluate(() => { markPaid('pkg-a'); });
    same('duplicate action from another surface shares one pending transaction', (await state()).transactions.length, 1);
    await release(true); await settled(); s = await state();
    same('rejection preserves package and invoice statuses and caches', [s.packages, s.invoices], [before.packages, before.invoices]);
    same('failure keeps both rendered payment pills unpaid', [await page.locator('#cp-body .card-sm .pill').innerText(),
      await page.locator('#pay-pkg-grid .pkg-card[data-pkg-id="pkg-a"] .pill').innerText()], ['OCZEKUJĄCY', 'OCZEKUJĄCY']);
    same('failed transaction commits nothing', s.commits, []);
    ok('failure paints a relevant retry error in both existing surfaces', (await cpStatus.innerText()).includes('Fixture payment offline') &&
      (await gridStatus.innerText()).includes('Fixture payment offline') && await cpButton.isEnabled() && await gridButton.isEnabled());
    ok('failure emits no payment success or integration event', s.notices.length === 0 && s.events.length === 0);
    await start(); s = await state();
    same('retry retains payment receipt for safe confirmation', s.transactions[1].writes.map(w => w.patch.paymentWriteId),
      s.transactions[0].writes.map(w => w.patch.paymentWriteId));
    await page.evaluate(() => { PACKAGES[0].sessionsUsed = 5; PACKAGES[0].notes = 'Concurrent local note';
      _paidUi.data['packages/package-doc-a'].sessionsUsed = 7; _paidUi.data['packages/package-doc-a'].notes = 'Concurrent remote note'; });
    await release(); await settled(); s = await state();
    ok('one atomic ACK confirms both local and remote payment statuses', s.packages[0].payStatus === 'paid' && s.invoices[0].status === 'paid' &&
      s.remote['packages/package-doc-a'].payStatus === 'paid' && s.remote['invoices/' + s.invoices[0].id].status === 'paid' &&
      s.commits.length === 1 && s.commits[0].writes.length === 2 && s.commits[0].invoiceStatuses[0] === 'paid', s);
    same('payment preserves current local usage and note', [s.packages[0].sessionsUsed, s.packages[0].notes], [5, 'Concurrent local note']);
    same('payment patches preserve current server usage and note', [s.remote['packages/package-doc-a'].sessionsUsed,
      s.remote['packages/package-doc-a'].notes], [7, 'Concurrent remote note']);
    ok('both rendered surfaces show paid and remove the mark-paid action', await cpButton.count() === 0 && await gridButton.count() === 0 &&
      (await page.locator('#cp-body .card-sm .pill').innerText()) === 'OPŁACONY' &&
      (await page.locator('#pay-pkg-grid .pkg-card[data-pkg-id="pkg-a"] .pill').innerText()) === 'OPŁACONY');
    same('successful duplicate and retry flow emits one success notice', s.notices.length, 1);
    same('successful duplicate and retry flow emits one package-paid event', s.events.map(e => e.event), ['package.paid']);
    same('payment event identifies the confirmed package and client', [s.events[0].payload.package.id, s.events[0].payload.package.clientId], ['pkg-a', 'client-a']);
    const writeCount = s.transactions.reduce((n, tx) => n + tx.writes.length, 0);
    await page.evaluate(() => markPaid('pkg-a')); s = await state();
    same('already-paid confirmation creates no additional updates', s.transactions.reduce((n, tx) => n + tx.writes.length, 0), writeCount);
    same('already-paid confirmation creates no extra integration event or success', [s.events.length, s.notices.length], [1, 1]);

    for (const target of ['other-client', 'other-tab']) {
      await reset(); await start();
      await page.evaluate(target => { if (target === 'other-client') openClientProfile('client-b', { tab: 'payments' }); else setCPTab('notes'); }, target);
      await stabilize();
      await page.evaluate(() => { const body = document.getElementById('cp-body'); _paidUi.body = body.innerHTML;
        _paidUi.child = body.firstElementChild; _paidUi.header = document.getElementById('cp-name').textContent; });
      await release(); await settled(); s = await state();
      ok('background ACK keeps current drawer DOM and identity for ' + target, await page.evaluate(() => {
        const body = document.getElementById('cp-body'); return body.innerHTML === _paidUi.body && body.firstElementChild === _paidUi.child &&
          document.getElementById('cp-name').textContent === _paidUi.header;
      }), { clientId: s.clientId, tab: s.tab });
      same('background ACK preserves current client/tab for ' + target, [s.clientId, s.tab],
        target === 'other-client' ? ['client-b', 'payments'] : ['client-a', 'notes']);
      ok('background ACK applies only confirmed payment fields for ' + target, s.packages[0].payStatus === 'paid' &&
        s.invoices[0].status === 'paid' && s.packages[0].sessionsUsed === 3 && s.events.length === 1, s);
    }

    await reset(); await start();
    await page.evaluate(() => { tenantSessionGeneration++; window._uid = 'next-owner'; clearPackagePaidUiStates();
      window.CL = [{ id: 'next-client', trainerId: _uid, name: 'Następny klient', status: 'active' }];
      window.PACKAGES = [{ id: 'next-package', trainerId: _uid, clientId: 'next-client', payStatus: 'pending', sessionsUsed: 8 }];
      window.INVOICES = [{ id: 'next-invoice', trainerId: _uid, status: 'pending' }];
      _paidUi.nextCache = JSON.stringify([PACKAGES, INVOICES]); });
    await release(); await page.waitForFunction(() => _paidUi.pending.length === 0); await stabilize(); s = await state();
    ok('old tenant ACK cannot replace next account payment caches', await page.evaluate(() => JSON.stringify([PACKAGES, INVOICES]) === _paidUi.nextCache), s);
    ok('old tenant ACK emits no success or integration event', s.notices.length === 0 && s.events.length === 0, s);

    await reset({ status: 'partial' });
    ok('partial package can be marked paid from both payment surfaces', await cpButton.isEnabled() && await gridButton.isEnabled());
    same('partial package has no request for its full original price in either surface', await page.locator(
      '#cp-body button[onclick*="requestPayment"],#pay-pkg-grid .pkg-card[data-pkg-id="pkg-a"] button[onclick*="requestPayment"]').count(), 0);
    await start(); await release(); await settled(); s = await state();
    same('partial payment confirms both package and invoice without resetting usage', [s.packages[0].payStatus, s.invoices[0].status,
      s.packages[0].sessionsUsed], ['paid', 'paid', 3]);

    await reset({ legacy: true }); await start(); s = await state();
    ok('legacy invoice display number resolves to its owned existing document', s.transactions[0].reads.includes('invoices/legacy-invoice-doc') &&
      !s.transactions[0].reads.includes('invoices/INV-LEGACY-42'), s.transactions[0]);
    await release(); await settled(); s = await state();
    same('legacy invoice confirmation preserves its document ID and display number', [s.invoices[0].id, s.invoices[0].nr,
      s.invoices[0].status, s.packages[0].invoiceId], ['legacy-invoice-doc', 'INV-LEGACY-42', 'paid', 'INV-LEGACY-42']);
    same('no direct persistence, messages or payment requests were used', s.unexpected, []);
    same('no request reached live Firestore', liveRequests, 0);
    console.log('PASS confirmed package-paid DOM: ' + passed + ' assertions');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
