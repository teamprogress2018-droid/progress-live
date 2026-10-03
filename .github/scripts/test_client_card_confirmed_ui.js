// Real browser coverage for client-card drafts and the confirmed-save UI boundary.
// The service's transaction/receipt semantics have separate unit coverage.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

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
      typeof window.openClientModal === 'function' && typeof window.saveClient === 'function' &&
      typeof window.assignmentSession === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const f = window._clientCardUi = { owner: 'card-ui-owner', calls: [], pending: [],
        pipelines: [], pipelinePending: [], notifications: [], checklist: [], unexpected: [], profileRenders: [] };
      window._db = { fixture: true };
      window.persistById = (...args) => { f.unexpected.push(['persistById', args[0]]); throw Error('Unexpected optimistic persistence'); };
      window._setDoc = () => { f.unexpected.push(['setDoc']); throw Error('Unexpected direct persistence'); };
      window.renderAll = () => {};
      window.renderClients = () => {};
      window.renderDash = () => {};
      window.syncClientNameCache = () => {};
      window.aplRefreshFromSavedClient = () => {};
      window.renderCPOverview = client => {
        f.profileRenders.push(client.id);
        document.getElementById('cp-body').textContent = 'Fixture overview rendered';
      };
      const notify = window.notify;
      window.notify = message => { f.notifications.push(String(message)); notify(message); };
      const checklist = window.openClientOnboardChecklist;
      window.openClientOnboardChecklist = id => { f.checklist.push(id); return checklist(id); };
      window.saveClientCardConfirmed = (candidate, operation) => {
        f.calls.push({ candidate: clone(candidate), edit: operation.edit, base: clone(operation.base),
          sameOperation: f.lastOperation === operation });
        f.lastOperation = operation;
        return new Promise((resolve, reject) => {
          f.pending.push({
            succeed() { f.pending.shift(); resolve({ ...clone(candidate), _fbId: candidate.id }); },
            fail(conflict) {
              f.pending.shift();
              const error = Error('Fixture connection interrupted');
              if (conflict) { error.code = 'client-card-conflict'; error.remote = clone(conflict); }
              reject(error);
            }
          });
        });
      };
      window.assignClientPipeline = (client, options) => {
        f.pipelines.push({ id: client.id, options: clone(options), localAtStart: clone(window.CL) });
        return new Promise((resolve, reject) => {
          f.pipelinePending.push({
            finish(mode) {
              f.pipelinePending.shift();
              if (mode === 'throw') reject(Error('Fixture startup interrupted'));
              else resolve(mode === 'fail' ? { ok: false, error: 'Fixture startup interrupted' } : { ok: true });
            }
          });
        });
      };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
    });

    const modal = page.locator('#m-client');
    const save = page.locator('#ac-save-btn');
    const status = page.locator('#ac-save-status');
    const name = page.locator('#ac-name');
    const reset = () => page.evaluate(() => {
      const f = window._clientCardUi;
      document.querySelectorAll('.modal-ov.show').forEach(el => el.classList.remove('show'));
      window._clientModalState = null;
      window._editingClientId = null;
      window._uid = f.owner;
      window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true;
      window._clientAppMode = false;
      window._clientPreviewMode = false;
      window._afStateReady = false;
      window.SETTINGS = { ...(window.SETTINGS || {}), notifications: {
        ...((window.SETTINGS || {}).notifications || {}), weeklyCheckin: false } };
      window.cpClientId = null;
      window.cpTab = 'overview';
      window._cpEditingClientId = null;
      window._onboardClientId = null;
      window.CL = [
        { id: 'card-a', trainerId: f.owner, name: 'Klient Alfa', email: 'alfa@example.test', phone: '123456789',
          gender: 'K', status: 'active', goal: 'redukcja', trainingFreq: 4, preferredWeekdays: [2, 4],
          priorSports: ['running'], additional_activities: [{ sport: 'running', frequency_per_week: 2,
            intensity: 'high', notes: 'Bieg w niedzielę' }], activityLevel: 'active', sportNotes: 'Maratony', notes: 'Oryginalna notatka' },
        { id: 'card-b', trainerId: f.owner, name: 'Klient Beta', email: 'beta@example.test', status: 'active', goal: 'masa' }
      ];
      window.PL = []; window.SE = []; window.PACKAGES = []; window.TASKS = [];
      window.METRIC_ENTRIES = []; window.CHECKINS = {}; window.FORM_SENDS = [];
      f.calls = []; f.pending = []; f.pipelines = []; f.pipelinePending = [];
      f.notifications = []; f.checklist = []; f.unexpected = []; f.lastOperation = null; f.profileRenders = [];
    });
    const open = id => page.evaluate(id => {
      closeM('m-client-onboard');
      if (id) openClientModal(id); else openM('m-client');
    }, id);
    const fill = async (value = 'Nowy Klient') => {
      await name.fill(value);
      await page.locator('#ac-email').fill('new@example.test');
      await page.locator('#ac-phone').fill('987654321');
      await page.locator('#ac-notes').fill('Zachowaj tę notatkę');
    };
    const pending = (kind = 'pending') => page.waitForFunction(kind => window._clientCardUi[kind].length === 1, kind);
    const settled = () => page.waitForFunction(() => window._clientModalState && !window._clientModalState.pending);
    const release = (mode = 'success', remote = null) => page.evaluate(({ mode, remote }) => {
      const p = window._clientCardUi.pending[0];
      if (mode === 'success') p.succeed(); else p.fail(remote);
    }, { mode, remote });
    const finishPipeline = mode => page.evaluate(mode => window._clientCardUi.pipelinePending[0].finish(mode), mode);
    const state = () => page.evaluate(() => {
      const f = window._clientCardUi, draft = window._clientModalState;
      return { local: JSON.parse(JSON.stringify(window.CL)), calls: f.calls, pipelines: f.pipelines,
        notifications: f.notifications, checklist: f.checklist, unexpected: f.unexpected, profileRenders: f.profileRenders,
        editId: window._editingClientId, draftId: draft?.candidate?.id,
        saved: !!draft?.saved, pending: !!draft?.pending };
    });
    let passed = 0;
    const ok = (label, condition, detail) => {
      assert.ok(condition, label + (detail ? ': ' + JSON.stringify(detail) : ''));
      passed++; console.log('OK ' + label);
    };
    const closeOverlay = () => modal.click({ position: { x: 5, y: 5 } });

    await reset();
    await open('card-a');
    let s = await state();
    ok('edit entry preserves client identity, title and sport controls', s.editId === 'card-a' &&
      await modal.locator('.modal-title').innerText() === 'EDYTUJ KLIENTA' &&
      await name.inputValue() === 'Klient Alfa' &&
      await page.locator('#ac-prior-sports [data-sport="running"]').getAttribute('class').then(c => c.includes('active')) &&
      await page.locator('#ac-addl-acts .addl-act-freq').inputValue() === '2' &&
      await page.locator('#ac-addl-acts .addl-act-int').inputValue() === 'high');
    await open();
    ok('direct openM client entry creates a blank new form after an edit', (await state()).editId === null &&
      await name.inputValue() === '' && await page.locator('#ac-email').inputValue() === '' &&
      await modal.locator('.modal-title').innerText() === 'NOWY KLIENT' &&
      await page.locator('#ac-prior-sports .active').count() === 0);
    await fill();
    const beforeCreate = (await state()).local;
    await save.click(); await pending();
    s = await state();
    assert.deepEqual(s.local, beforeCreate);
    ok('pending create locks every form control and leaves CL and pipeline untouched', await modal.isVisible() &&
      await save.isDisabled() && await modal.locator('.modal-body input, .modal-body select, .modal-body textarea, .modal-body button')
        .evaluateAll(els => els.length > 15 && els.every(el => el.disabled)) &&
      s.pipelines.length === 0 && s.notifications.length === 0 && await status.getAttribute('aria-live') === 'polite');
    await page.evaluate(() => { window._clientDuplicate = saveClient(); });
    ok('reentrant save during a pending create shares one service operation', (await state()).calls.length === 1);
    await release('fail'); await settled();
    s = await state();
    assert.deepEqual(s.local, beforeCreate);
    const candidateId = s.calls[0].candidate.id;
    ok('rejected create retains form and retry feedback without a local client', await modal.isVisible() &&
      await name.inputValue() === 'Nowy Klient' && await page.locator('#ac-notes').inputValue() === 'Zachowaj tę notatkę' &&
      await save.isEnabled() && /Ponów zapis/.test(await status.innerText()) && s.pipelines.length === 0);
    await modal.locator('.modal-close').click(); await open();
    ok('X close and reopen preserves the failed candidate and frozen form', await name.inputValue() === 'Nowy Klient' &&
      await name.isDisabled() && (await state()).draftId === candidateId);
    await closeOverlay(); await open();
    ok('overlay close and reopen preserves the same retry draft', await page.locator('#ac-phone').inputValue() === '987654321' &&
      (await state()).draftId === candidateId);
    await save.click(); await pending();
    s = await state();
    assert.deepEqual(s.calls[1].candidate, s.calls[0].candidate);
    ok('retry reuses the exact candidate ID and service operation', s.calls[1].candidate.id === candidateId && s.calls[1].sameOperation);
    await release(); await pending('pipelinePending');
    s = await state();
    ok('only client acknowledgement applies CL before starting the pipeline', s.local.length === 3 &&
      s.local.at(-1).id === candidateId && s.pipelines.length === 1 &&
      s.pipelines[0].options.persist === false &&
      s.pipelines[0].localAtStart.some(c => c.id === candidateId) && await modal.isVisible() && await save.isDisabled() &&
      s.checklist.length === 0 && !s.notifications.some(n => n.includes('✅')));
    await finishPipeline('success'); await settled();
    s = await state();
    ok('completed pipeline closes the current modal and opens the matching checklist', !(await modal.isVisible()) &&
      s.checklist.length === 1 && s.checklist[0] === candidateId && s.notifications.some(n => n.includes('✅')));

    for (const mode of ['fail', 'throw']) {
      await reset(); await open(); await fill('Start ' + mode);
      await save.click(); await pending(); await release(); await pending('pipelinePending');
      await finishPipeline(mode); await settled();
      s = await state();
      ok('startup ' + mode + ' retains an acknowledged client and prevents duplicate create', s.local.length === 3 && s.saved &&
        s.calls.length === 1 && s.pipelines.length === 1 && s.notifications.some(n => /Klient.*zapisany|Klient zapisany/.test(n)));
      if (!(await modal.isVisible())) await open();
      await page.evaluate(() => { window._clientDuplicate = saveClient(); });
      s = await state();
      ok('startup ' + mode + ' cannot resubmit its saved draft', s.calls.length === 1 && s.local.length === 3 &&
        s.pipelines.length === 1 && await save.isDisabled() && await page.locator('#ac-new-btn').isVisible());
    }

    await reset(); await open('card-a');
    const beforeEdit = (await state()).local;
    await name.fill('Alfa po edycji');
    await page.locator('#ac-sport-notes').fill('Nowe tło sportowe');
    await save.click(); await pending();
    assert.deepEqual((await state()).local, beforeEdit);
    await release('fail'); await settled();
    s = await state();
    assert.deepEqual(s.local, beforeEdit);
    ok('rejected edit preserves the original CL and modified form', await modal.isVisible() &&
      await name.inputValue() === 'Alfa po edycji' && await page.locator('#ac-sport-notes').inputValue() === 'Nowe tło sportowe' &&
      s.editId === 'card-a' && s.calls[0].edit && s.pipelines.length === 0);
    await closeOverlay(); await open('card-a');
    await save.click(); await pending(); await release(); await settled();
    s = await state();
    assert.deepEqual(s.local[1], beforeEdit[1]);
    ok('confirmed edit updates the same client only and never runs create startup', s.local.length === 2 &&
      s.local[0].id === 'card-a' && s.local[0].name === 'Alfa po edycji' &&
      s.local[0].sportNotes === 'Nowe tło sportowe' && s.pipelines.length === 0 && s.checklist.length === 0 && !(await modal.isVisible()));

    await reset();
    const raw = await page.evaluate(() => {
      const client = { id: 'card-a', trainerId: window._uid, status: 'active', name: 'Dane historyczne',
        email: 'history@example.test', gender: 'female', goal: 'legacy-goal', trainingFreq: null,
        age: null, weight: '81.2', preferredWeekdays: ['2', '4'], priorSports: ['running'],
        notes: 'Historyczna notatka', legacyField: { retain: true } };
      window.CL[0] = client;
      return client;
    });
    await open('card-a');
    ok('historical data renders normalized controls and notes fallback', await page.locator('#ac-gender').inputValue() === 'K' &&
      await page.locator('#ac-injuries').inputValue() === raw.notes && await page.locator('#ac-goal').inputValue() === '');
    await name.fill('Zmienione tylko imię');
    await modal.locator('.modal-close').click(); await open('card-a');
    await save.click(); await pending();
    s = await state();
    assert.deepEqual(s.calls[0].candidate, { ...raw, name: 'Zmienione tylko imię' });
    ok('name-only edit preserves raw types, absent fields and sport data after reopening',
      !Object.hasOwn(s.calls[0].candidate, 'injuries') && !Object.hasOwn(s.calls[0].candidate, 'additional_activities') &&
      !Object.hasOwn(s.calls[0].candidate, 'height') && s.calls[0].candidate.trainingFreq === null);
    await release(); await settled();

    for (const unavailable of ['removed', 'archived', 'other-owner']) {
      await reset(); await open('card-a'); await name.fill('Spóźniona edycja'); await save.click(); await pending();
      const afterRemoval = await page.evaluate(mode => {
        if (mode === 'removed') window.CL = window.CL.filter(c => c.id !== 'card-a');
        else if (mode === 'archived') window.CL[0].status = 'archived';
        else window.CL[0].trainerId = 'different-owner';
        return JSON.parse(JSON.stringify(window.CL));
      }, unavailable);
      await release(); await settled();
      s = await state();
      assert.deepEqual(s.local, afterRemoval);
      ok('late edit ACK cannot restore or overwrite an unavailable ' + unavailable + ' client', s.saved &&
        await modal.isVisible() && await save.isDisabled() && /niedostępny/.test(await status.innerText()) &&
        s.pipelines.length === 0 && s.checklist.length === 0 && !s.notifications.some(n => n.includes('Zaktualizowano')));
      await page.evaluate(() => { window._clientDuplicate = saveClient(); });
      ok('unavailable ' + unavailable + ' client receipt cannot resubmit its acknowledged edit', (await state()).calls.length === 1);
    }

    for (const view of ['other-tab', 'profile-form', 'other-modal', 'overview']) {
      await reset();
      await page.evaluate(view => {
        window.cpClientId = 'card-a';
        window.cpTab = view === 'other-tab' ? 'training' : 'overview';
        window._cpEditingClientId = view === 'profile-form' ? 'card-a' : null;
        document.getElementById('cp-body').innerHTML = '<input id="fixture-profile-draft" value="Niezapisana treść profilu">';
      }, view);
      await open('card-a'); await name.fill('Alfa potwierdzona'); await save.click(); await pending();
      if (view === 'other-modal') await open('card-b');
      await release();
      await page.waitForFunction(() => window._clientCardUi.notifications.some(n => n.includes('Zaktualizowano')));
      s = await state();
      if (view === 'overview') {
        ok('foreground overview refreshes after a confirmed matching edit', s.profileRenders.length === 1 &&
          await page.locator('#cp-body').innerText() === 'Fixture overview rendered');
      } else {
        ok('confirmed edit preserves current profile content for ' + view, s.profileRenders.length === 0 &&
          await page.locator('#fixture-profile-draft').inputValue() === 'Niezapisana treść profilu');
      }
    }

    await reset(); await open(); await fill('Klient w tle');
    await save.click(); await pending(); await open('card-b');
    const bTitle = await modal.locator('.modal-title').innerText();
    await release(); await pending('pipelinePending');
    ok('late create acknowledgement keeps another client editable', await modal.isVisible() && await name.inputValue() === 'Klient Beta' &&
      await name.isEnabled() && (await state()).editId === 'card-b');
    await finishPipeline('success');
    await page.waitForFunction(() => window._clientCardUi.notifications.some(n => n.includes('✅')));
    s = await state();
    ok('late startup completion cannot close client B or open client A checklist', await modal.isVisible() &&
      await modal.locator('.modal-title').innerText() === bTitle && await name.inputValue() === 'Klient Beta' &&
      s.editId === 'card-b' && s.checklist.length === 0);
    await modal.locator('.modal-close').click(); await open();
    s = await state();
    ok('background successful create reopens its saved receipt with an explicit next action', await name.inputValue() === 'Klient w tle' &&
      await save.isDisabled() && await name.isDisabled() && await page.locator('#ac-new-btn').isVisible() && s.saved);
    await page.evaluate(() => { window._clientDuplicate = saveClient(); });
    ok('reopening the background receipt cannot create a duplicate', (await state()).calls.length === 1 && (await state()).local.length === 3);
    await page.locator('#ac-new-btn').click();
    ok('explicit Add next begins a blank editable draft', await name.inputValue() === '' && await name.isEnabled() &&
      await save.isEnabled() && !(await page.locator('#ac-new-btn').isVisible()) && !(await state()).draftId);

    for (const mode of ['success', 'fail']) {
      await reset(); await open(); await fill('Stara sesja'); await save.click(); await pending();
      const oldLocal = (await state()).local;
      await page.evaluate(() => {
        window._uid = 'card-ui-next-owner';
        window.tenantSessionGeneration++;
        openM('m-client');
      });
      await release(mode);
      // The old invocation's finally block resolves before its own promise settles.
      await page.waitForFunction(() => window._clientCardUi.pending.length === 0);
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
      s = await state();
      assert.deepEqual(s.local, oldLocal);
      ok('auth switch discards old ' + mode + ' completion without local writes or notices', s.notifications.length === 0 &&
        s.pipelines.length === 0 && s.checklist.length === 0 && await modal.isVisible() && await name.inputValue() === '' && await name.isEnabled());
    }

    await reset(); await open('card-a');
    const original = (await state()).local;
    await name.fill('Moja niepotwierdzona zmiana'); await save.click(); await pending();
    const remote = { ...original[0], name: 'Alfa z serwera', phone: '555666777', sportNotes: 'Zdalna zmiana',
      gender: 'female', weight: '81.2', trainingFreq: null,
      priorSports: ['cycling'], additional_activities: [{ sport: 'cycling', frequency_per_week: 3, intensity: 'low', notes: 'Rower' }] };
    await release('conflict', remote); await settled();
    s = await state();
    assert.deepEqual(s.local, original);
    ok('edit conflict retains form and offers reload instead of overwriting remote data', await name.inputValue() === 'Moja niepotwierdzona zmiana' &&
      await save.isDisabled() && await page.locator('#ac-reload-btn').isVisible() && /Wczytaj aktualne dane/.test(await status.innerText()));
    await page.locator('#ac-reload-btn').click();
    ok('conflict reload replaces fields and sports with the remote editable snapshot', await name.inputValue() === 'Alfa z serwera' &&
      await page.locator('#ac-phone').inputValue() === '555666777' && await page.locator('#ac-sport-notes').inputValue() === 'Zdalna zmiana' &&
      await page.locator('#ac-injuries').inputValue() === remote.notes &&
      await page.locator('#ac-prior-sports [data-sport="cycling"]').getAttribute('class').then(c => c.includes('active')) &&
      await page.locator('#ac-addl-acts .addl-act-freq').inputValue() === '3' && await name.isEnabled() && await save.isEnabled() &&
      (await state()).editId === 'card-a');
    await name.fill('Alfa po ponownej edycji'); await save.click(); await pending();
    s = await state();
    assert.deepEqual(s.calls[1].base, remote);
    assert.deepEqual(s.calls[1].candidate, { ...remote, name: 'Alfa po ponownej edycji' });
    ok('notes-only conflict reload displays the fallback without persisting a new injuries field',
      !Object.hasOwn(s.calls[1].candidate, 'injuries') && s.calls[1].candidate.notes === remote.notes);
    ok('save after reload uses the remote edit base and original client identity', s.calls[1].edit &&
      s.calls[1].candidate.id === 'card-a' && s.calls[1].candidate.phone === '555666777' && !s.calls[1].sameOperation);
    await release(); await settled();
    s = await state();
    ok('confirmed conflict resolution updates that client without create startup', s.local.length === 2 &&
      s.local[0].name === 'Alfa po ponownej edycji' && s.local[0].phone === '555666777' && s.pipelines.length === 0);
    ok('fixture never uses optimistic persistence or Firebase network', s.unexpected.length === 0 && liveRequests === 0, s.unexpected);
    console.log('\n' + passed + ' client card confirmation UI checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
