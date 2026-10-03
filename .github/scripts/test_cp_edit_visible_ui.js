// Browser coverage for inline profile drafts and the confirmed-save boundary.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const shotDir = process.env.CP_EDIT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ?
  '/opt/cursor/artifacts' : path.join(require('node:os').tmpdir(), 'pl-cp-edit'));
fs.mkdirSync(shotDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    page.setDefaultTimeout(20000);
    let liveRequests = 0;
    await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
    await page.route('**://firestore.googleapis.com/**', route => { liveRequests++; return route.abort(); });
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' +
      (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.saveClientCardConfirmed === 'function' &&
      typeof window.saveCPEdit === 'function' && typeof window.assignmentSession === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const f = window._cpEditUi = { owner: 'profile-ui-owner', calls: [], pending: [],
        notifications: [], unexpected: [], cacheCalls: [], cacheWrites: [] };
      window._db = { fixture: true };
      window.persistById = (collection, record) => {
        if (collection === 'clients') { f.unexpected.push(collection); throw Error('Unexpected optimistic client persistence'); }
        f.cacheWrites.push({ collection, record: clone(record) });
        return Promise.resolve(record);
      };
      window._setDoc = () => { f.unexpected.push('setDoc'); throw Error('Unexpected direct persistence'); };
      window.renderClients = () => {};
      window.renderDash = () => {};
      const sync = window.syncClientNameCache;
      window.syncClientNameCache = (id, name) => { f.cacheCalls.push({ id, name }); return sync(id, name); };
      const notify = window.notify;
      window.notify = message => { f.notifications.push(String(message)); notify(message); };
      window.saveClientCardConfirmed = (candidate, operation) => {
        f.calls.push({ candidate: clone(candidate), edit: operation.edit, base: clone(operation.base),
          sameOperation: f.lastOperation === operation });
        f.lastOperation = operation;
        return new Promise((resolve, reject) => {
          f.pending.push({
            succeed() { f.pending.shift(); resolve({ ...clone(candidate), _fbId: candidate.id }); },
            fail(remote) {
              f.pending.shift();
              const error = Error('Fixture connection interrupted');
              if (remote) { error.code = 'client-card-conflict'; error.remote = clone(remote); }
              reject(error);
            }
          });
        });
      };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
    });
    let passed = 0;
    const ok = (label, condition, detail) => {
      assert.ok(condition, label + (detail ? ': ' + JSON.stringify(detail) : ''));
      passed++; console.log('OK ' + label);
    };
    const reset = () => page.evaluate(() => {
      closeClientProfile();
      clearCPEditDrafts();
      const f = window._cpEditUi;
      window._uid = f.owner;
      window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true;
      window._clientAppMode = false;
      window._clientPreviewMode = false;
      window._afStateReady = false;
      window.CL = [
        { id: 'c-aga', trainerId: f.owner, name: 'Agnieszka', email: 'agnieszka@example.test',
          phone: '123456789', gender: 'K', age: 50, height: 168, weight: 62,
          goal: 'masa', level: 'poczatkujacy', status: 'active', trainingFreq: 2,
          preferredTrainTime: 'Rano (6-10)', preferredWeekdays: [2, 4], priorSports: ['running'],
          additional_activities: [{ sport: 'running', frequency_per_week: 2, intensity: 'high', notes: 'Bieganie' }],
          notes: 'Oryginalna notatka' },
        { id: 'c-beta', trainerId: f.owner, name: 'Klient Beta', email: 'beta@example.test', status: 'active', goal: 'masa' }
      ];
      window.SE = []; window.TASKS = []; window.METRIC_ENTRIES = [];
      window.PL = [{ id: 'pl-aga', clientId: 'c-aga', clientName: 'Agnieszka', name: 'FBW' }];
      window.PACKAGES = [{ id: 'pk-aga', clientId: 'c-aga', clientName: 'Agnieszka', title: '10 sesji' }];
      window.INVOICES = [{ id: 'inv-aga', pkgId: 'pk-aga', clientName: 'Agnieszka', amount: 1200 }];
      window.ONBOARDING_FLOW = { history: [{ clientId: 'c-aga', clientName: 'Agnieszka', parts: 'ankieta' }] };
      f.calls = []; f.pending = []; f.notifications = []; f.unexpected = [];
      f.cacheCalls = []; f.cacheWrites = []; f.lastOperation = null;
    });
    const open = (id = 'c-aga') => page.evaluate(id => openClientProfile(id), id);
    const edit = (id = 'c-aga') => page.evaluate(id => startCPEdit(id), id);
    const save = page.locator('#cpe-save-btn');
    const name = page.locator('#cpe-name');
    const status = page.locator('#cpe-save-status');
    const pending = () => page.waitForFunction(() => window._cpEditUi.pending.length === 1);
    const settled = () => page.waitForFunction(() => window._cpEditState && !window._cpEditState.pending);
    const release = (mode = 'success', remote = null) => page.evaluate(({ mode, remote }) => {
      const p = window._cpEditUi.pending[0];
      if (mode === 'success') p.succeed(); else p.fail(remote);
    }, { mode, remote });
    const flush = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    const state = () => page.evaluate(() => {
      const f = window._cpEditUi, draft = window._cpEditState;
      return { local: JSON.parse(JSON.stringify(window.CL)), calls: f.calls, notices: f.notifications,
        unexpected: f.unexpected, cacheCalls: f.cacheCalls, cacheWrites: f.cacheWrites,
        caches: [window.PL[0].clientName, window.PACKAGES[0].clientName, window.INVOICES[0].clientName,
          window.ONBOARDING_FLOW.history[0].clientName], saved: !!draft?.saved, pending: !!draft?.pending,
        clientId: window.cpClientId, tab: window.cpTab, header: document.getElementById('cp-name').textContent };
    });

    await reset(); await open();
    ok('header edit action is visible and overview keeps its profile rows', await page.locator('#cp-edit-data-btn').isVisible() &&
      await page.locator('.cp-ov-edit-cta').count() === 0 && await page.locator('.cp-ov-profile-rows').count() > 0);
    ok('form stays hidden until edit opens it', await name.count() === 0 && (await state()).header === 'Agnieszka');
    await page.screenshot({ path: path.join(shotDir, 'cp_edit_overview.png') });
    await page.locator('#cp-edit-data-btn').click();
    ok('personal data form has an explicit full name label', await name.inputValue() === 'Agnieszka' &&
      /imię i nazwisko/i.test(await page.locator('label[for="cpe-name"]').innerText()));
    await name.fill('Agnieszka Kowalska');
    await page.locator('#cpe-notes').fill('Zachowaj mój szkic');
    const before = await state();
    await page.screenshot({ path: path.join(shotDir, 'cp_edit_form.png') });
    await save.click(); await pending();
    let s = await state();
    assert.deepEqual(s.local, before.local);
    assert.deepEqual(s.caches, before.caches);
    ok('pending save leaves CL, header and all name caches unchanged', s.header === before.header &&
      s.cacheCalls.length === 0 && s.cacheWrites.length === 0 && s.notices.length === 0);
    ok('pending form locks input and exposes accessible feedback', await name.isDisabled() && await save.isDisabled() &&
      await page.locator('#cpe-notes').isDisabled() && await status.getAttribute('aria-live') === 'polite');
    await page.evaluate(() => { window._cpDuplicate = saveCPEdit('c-aga'); });
    ok('duplicate pending invocation creates one confirmed operation', (await state()).calls.length === 1);
    await release('fail'); await settled();
    s = await state(); assert.deepEqual(s.local, before.local); assert.deepEqual(s.caches, before.caches);
    ok('failure retains the form and retry feedback without cache writes', await name.inputValue() === 'Agnieszka Kowalska' &&
      await page.locator('#cpe-notes').inputValue() === 'Zachowaj mój szkic' && await save.isEnabled() &&
      /Ponów zapis/.test(await status.innerText()) && s.cacheWrites.length === 0);
    await page.evaluate(() => closeClientProfile()); await open(); await edit();
    ok('failed draft survives closing and reopening with its frozen candidate', await name.inputValue() === 'Agnieszka Kowalska' &&
      await page.locator('#cpe-notes').inputValue() === 'Zachowaj mój szkic' && await name.isDisabled());
    await save.click(); await pending();
    s = await state(); assert.deepEqual(s.calls[1].candidate, s.calls[0].candidate); assert.deepEqual(s.calls[1].base, before.local[0]);
    ok('retry reuses the exact snapshot, identity and operation', s.calls[1].sameOperation && s.calls[1].edit);
    await release(); await flush();
    s = await state();
    ok('acknowledgement updates the matching client and closes the foreground form', s.local[0].name === 'Agnieszka Kowalska' &&
      s.local[0].notes === 'Zachowaj mój szkic' && s.header === 'Agnieszka Kowalska' && await name.count() === 0);
    assert.deepEqual(s.local[1], before.local[1]);
    ok('acknowledged rename updates all caches once', s.caches.every(value => value === 'Agnieszka Kowalska') &&
      s.cacheCalls.length === 1 && s.cacheWrites.length === 4);
    await page.screenshot({ path: path.join(shotDir, 'cp_edit_saved.png') });

    await reset(); await open(); await edit(); await name.fill('Niezapisana edycja');
    await page.evaluate(() => setCPTab('training')); await page.evaluate(() => setCPTab('overview')); await edit();
    ok('editable draft survives tab changes before save', await name.inputValue() === 'Niezapisana edycja' && await name.isEnabled());
    await page.evaluate(() => closeClientProfile()); await open(); await edit();
    ok('editable draft survives drawer close before save', await name.inputValue() === 'Niezapisana edycja' && await name.isEnabled());
    await save.click(); await pending();
    await page.evaluate(() => closeClientProfile()); await open(); await edit();
    ok('pending draft reopens with disabled controls and no duplicate request', await name.inputValue() === 'Niezapisana edycja' &&
      await name.isDisabled() && await save.isDisabled() && (await state()).calls.length === 1);
    await release(); await flush();

    await reset(); await open(); await edit();
    await page.locator('#cpe-status').selectOption('inactive');
    await save.click(); await pending();
    s = await state();
    ok('status change is part of the confirmed candidate while local status stays active',
      s.calls[0].candidate.status === 'inactive' && s.local[0].status === 'active');
    await release(); await flush();
    ok('inactive status applies after acknowledgement', (await state()).local[0].status === 'inactive');

    for (const view of ['other-client', 'other-tab', 'closed']) {
      await reset(); await open(); await edit(); await name.fill('Potwierdzona w tle'); await save.click(); await pending();
      if (view === 'other-client') {
        await open('c-beta'); await edit('c-beta'); await name.fill('Szkic klienta Beta');
      } else if (view === 'other-tab') {
        await page.evaluate(() => setCPTab('training'));
      } else await page.evaluate(() => closeClientProfile());
      const otherView = await page.locator('#cp-body').innerHTML();
      await release(); await flush(); s = await state();
      ok('background ACK applies only client A for ' + view, s.local[0].name === 'Potwierdzona w tle' &&
        s.local[1].name === 'Klient Beta' && s.cacheCalls.length === 1);
      ok('background ACK preserves the current drawer content for ' + view,
        await page.locator('#cp-body').innerHTML() === otherView &&
        (view !== 'other-client' || (await name.inputValue() === 'Szkic klienta Beta' && await name.isEnabled())) &&
        (view !== 'other-tab' || s.tab === 'training') &&
        (view !== 'closed' || !(await page.locator('#cp-drawer').getAttribute('class')).includes('open')));
      await open();
      await page.evaluate(() => { window._cpDuplicate = saveCPEdit('c-aga'); });
      ok('reopening the overview cannot resubmit an acknowledged draft for ' + view, (await state()).calls.length === 1);
    }

    await reset(); await open(); await edit(); await name.fill('Szkic Alfa do ponowienia');
    await save.click(); await pending(); await open('c-beta'); await edit('c-beta'); await name.fill('Szkic Beta');
    await release('fail'); await flush();
    ok('background failure preserves the foreground client B draft', await name.inputValue() === 'Szkic Beta' &&
      await name.isEnabled() && (await state()).clientId === 'c-beta' && (await state()).cacheWrites.length === 0);
    await open(); await edit();
    ok('returning to failed client A restores its immutable retry draft', await name.inputValue() === 'Szkic Alfa do ponowienia' &&
      await name.isDisabled() && await save.isEnabled() && /Ponów zapis/.test(await status.innerText()));
    await save.click(); await pending(); s = await state();
    assert.deepEqual(s.calls[1].candidate, s.calls[0].candidate);
    ok('background failed draft retries the same operation after changing clients', s.calls[1].sameOperation);
    await release(); await flush();

    for (const mode of ['success', 'fail']) {
      await reset(); await open(); await edit(); await name.fill('Stara sesja'); await save.click(); await pending();
      const old = await state();
      await page.evaluate(() => { window._uid = 'profile-ui-next-owner'; window.tenantSessionGeneration++; clearCPEditDrafts(); });
      await release(mode); await flush(); s = await state();
      assert.deepEqual(s.local, old.local); assert.deepEqual(s.caches, old.caches);
      ok('auth switch discards old ' + mode + ' completion and all local effects', s.cacheCalls.length === 0 && s.notices.length === 0);
    }

    for (const unavailable of ['removed', 'archived', 'other-owner']) {
      await reset(); await open(); await edit(); await name.fill('Spóźniona zmiana'); await save.click(); await pending();
      const afterRemoval = await page.evaluate(mode => {
        if (mode === 'removed') window.CL = window.CL.filter(c => c.id !== 'c-aga');
        else if (mode === 'archived') window.CL[0].status = 'archived';
        else window.CL[0].trainerId = 'different-owner';
        return JSON.parse(JSON.stringify(window.CL));
      }, unavailable);
      await release(); await settled(); s = await state(); assert.deepEqual(s.local, afterRemoval);
      ok('late ACK cannot overwrite an unavailable ' + unavailable + ' client', s.saved && await save.isDisabled() &&
        /niedostępny/.test(await status.innerText()) && s.cacheCalls.length === 0 && s.cacheWrites.length === 0);
      await page.evaluate(() => { window._cpDuplicate = saveCPEdit('c-aga'); });
      ok('acknowledged unavailable ' + unavailable + ' draft cannot submit again', (await state()).calls.length === 1);
    }

    await reset();
    const raw = await page.evaluate(() => {
      const client = { id: 'c-aga', trainerId: window._uid, status: 'active', name: 'Dane historyczne',
        email: 'history@example.test', gender: 'female', goal: 'legacy-goal', trainingFreq: null, age: null,
        weight: '81.2', preferredWeekdays: ['2', '4'], priorSports: ['running'], notes: 'Notatka historyczna',
        legacyField: { retain: true } };
      window.CL[0] = client; return client;
    });
    await open(); await edit(); await name.fill('Zmienione tylko imię');
    await page.evaluate(() => closeClientProfile()); await open(); await edit(); await save.click(); await pending();
    s = await state(); assert.deepEqual(s.calls[0].base, raw);
    assert.deepEqual(s.calls[0].candidate, { ...raw, name: 'Zmienione tylko imię' });
    ok('name-only save preserves raw legacy types and absent default fields',
      !Object.hasOwn(s.calls[0].candidate, 'height') && !Object.hasOwn(s.calls[0].candidate, 'phone') &&
      !Object.hasOwn(s.calls[0].candidate, 'injuries') && !Object.hasOwn(s.calls[0].candidate, 'additional_activities') &&
      !Object.hasOwn(s.calls[0].candidate, 'activityLevel') && s.calls[0].candidate.trainingFreq === null);
    await release(); await flush();

    await reset(); await open(); await edit();
    const original = (await state()).local;
    await name.fill('Moja zmiana'); await save.click(); await pending();
    const remote = { ...original[0], name: 'Agnieszka z serwera', phone: '555666777', gender: 'female',
      weight: '81.2', trainingFreq: null, notes: 'Zdalna notatka', priorSports: ['cycling'],
      additional_activities: [{ sport: 'cycling', frequency_per_week: 3, intensity: 'low', notes: 'Rower' }] };
    await release('conflict', remote); await settled(); s = await state(); assert.deepEqual(s.local, original);
    ok('conflict preserves unsaved text and offers explicit remote reload', await name.inputValue() === 'Moja zmiana' &&
      await save.isDisabled() && await page.locator('#cpe-reload-btn').isVisible() &&
      /Wczytaj aktualne dane/.test(await status.innerText()) && s.cacheWrites.length === 0);
    await page.locator('#cpe-reload-btn').click();
    ok('reload displays the latest editable remote values', await name.inputValue() === remote.name &&
      await page.locator('#cpe-phone').inputValue() === remote.phone &&
      await page.locator('#cpe-notes').inputValue() === remote.notes && await name.isEnabled() && await save.isEnabled());
    await name.fill('Agnieszka po ponownej edycji'); await save.click(); await pending(); s = await state();
    assert.deepEqual(s.calls[1].base, remote);
    assert.deepEqual(s.calls[1].candidate, { ...remote, name: 'Agnieszka po ponownej edycji' });
    ok('save after reload uses a new operation with remote base and same client identity', !s.calls[1].sameOperation &&
      s.calls[1].edit && s.calls[1].candidate.id === 'c-aga');
    await release(); await flush();
    ok('fixture never performs optimistic client writes or Firebase network', (await state()).unexpected.length === 0 && liveRequests === 0);
    console.log('\n' + passed + ' cp-edit-visible confirmation UI checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
