// Real DOM coverage for onboarding weekday drafts and confirmed acknowledgement.
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
      typeof window.openClientScheduleFromOnboard === 'function' && typeof window.clearOnboardScheduleDrafts === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const f = window._scheduleUi = { owner: 'schedule-ui-owner', saves: [], pending: [], notices: [], resume: [], checklist: [], unexpected: [] };
      window._db = { fixture: true };
      window.persistById = () => { f.unexpected.push('persistById'); throw Error('Unexpected optimistic persistence'); };
      window._setDoc = () => { f.unexpected.push('setDoc'); throw Error('Unexpected direct persistence'); };
      window._runTransaction = () => { f.unexpected.push('transaction'); throw Error('Unexpected service bypass'); };
      window.renderClients = () => {}; window.renderDash = () => {};
      window.renderClientOnboardChecklist = () => f.checklist.push(window._onboardClientId);
      f.realResume = window.maybeResumeOnboard;
      window.maybeResumeOnboard = id => f.resume.push({ id, local: clone(window.CL) });
      const notify = window.notify;
      window.notify = message => { f.notices.push(String(message)); notify(message); };
      window.saveClientCardConfirmed = (candidate, operation) => {
        f.saves.push({ candidate: clone(candidate), base: clone(operation.base), edit: operation.edit,
          sameOperation: f.lastOperation === operation }); f.lastOperation = operation;
        return new Promise((resolve, reject) => f.pending.push({
          success() { f.pending.shift(); resolve({ ...clone(operation.base), ...clone(candidate), _fbId: candidate.id, clientCardWriteId: 'fixture-receipt' }); },
          failure(remote) { f.pending.shift(); reject(Object.assign(Error('Fixture connection interrupted'), remote ?
            { code: 'client-card-conflict', remote: clone(remote) } : {})); }
        }));
      };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
    });
    const modal = page.locator('#m-onboard-schedule');
    const save = page.locator('#ob-sched-save-btn'), status = page.locator('#ob-sched-save-status');
    const reload = page.locator('#ob-sched-reload-btn'), discard = page.locator('#ob-sched-discard-btn');
    const chips = modal.locator('.preferred-weekday-chip');
    const reset = () => page.evaluate(() => {
      document.querySelectorAll('.modal-ov.show').forEach(el => el.classList.remove('show'));
      clearOnboardScheduleDrafts();
      const f = window._scheduleUi;
      window._uid = f.owner; window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true; window._clientAppMode = false; window._clientPreviewMode = false;
      window._onboardClientId = 'sched-a';
      window.CL = [
        { id: 'sched-a', trainerId: f.owner, name: 'Klient Alfa', status: 'active', preferredWeekdays: [1, 3],
          email: 'alfa@example.test', gender: 'female', weight: '81.2', trainingFreq: null,
          notes: 'Historyczna notatka', legacyField: { keep: true } },
        { id: 'sched-b', trainerId: f.owner, name: 'Klient Beta', status: 'active', preferredWeekdays: [2, 4] }
      ];
      window.PL = [{ id: 'plan-a', trainerId: f.owner, clientId: 'sched-a', days: [{ weekday: 1 }, { weekday: 3 }] }];
      window.SE = [{ id: 'session-a', trainerId: f.owner, clientId: 'sched-a', date: '2026-10-10', source: 'planned' }];
      f.saves = []; f.pending = []; f.notices = []; f.resume = []; f.checklist = []; f.unexpected = []; f.lastOperation = null;
    });
    const open = (id = 'sched-a') => page.evaluate(id => openClientScheduleFromOnboard(id), id);
    const selected = () => page.evaluate(() => readPreferredWeekdaysFrom('ob-sched'));
    const choose = async days => {
      for (let day = 0; day < 7; day++) {
        const button = modal.locator('.preferred-weekday-chip[data-wd="' + day + '"]');
        const active = (await button.getAttribute('class')).includes('active');
        if (active !== days.includes(day)) await button.click();
      }
    };
    const pending = () => page.waitForFunction(() => window._scheduleUi.pending.length === 1);
    const settle = () => page.waitForFunction(() => window._onboardScheduleState && !window._onboardScheduleState.pending);
    const release = (mode = 'success', remote = null) => page.evaluate(({ mode, remote }) => window._scheduleUi.pending[0][mode](remote), { mode, remote });
    const flush = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    const state = () => page.evaluate(() => {
      const f = window._scheduleUi, s = window._onboardScheduleState;
      return { local: JSON.parse(JSON.stringify(window.CL)), plans: JSON.parse(JSON.stringify(window.PL)),
        sessions: JSON.parse(JSON.stringify(window.SE)), saves: f.saves, notices: f.notices,
        resume: f.resume, checklist: f.checklist, unexpected: f.unexpected, saved: !!s?.saved,
        clientId: window._onboardScheduleClientId, draftId: s?.clientId };
    });
    let passed = 0;
    const ok = (label, condition, detail) => { assert.ok(condition, label + (detail ? ': ' + JSON.stringify(detail) : '')); passed++; console.log('OK ' + label); };

    await reset(); await open(); await choose([2, 5]); const original = await state();
    await save.click(); await pending(); let s = await state();
    assert.deepEqual(s.local, original.local); assert.deepEqual(s.plans, original.plans); assert.deepEqual(s.sessions, original.sessions);
    ok('pending save locks weekday controls without checklist or local writes', await modal.isVisible() && await save.isDisabled() &&
      await discard.isDisabled() && await chips.evaluateAll(els => els.length === 7 && els.every(el => el.disabled)) &&
      s.resume.length === 0 && s.checklist.length === 0 && s.notices.length === 0 && await status.getAttribute('aria-live') === 'polite');
    await page.evaluate(() => { window._duplicateSchedule = saveClientScheduleFromOnboard(); });
    ok('duplicate invocation shares one confirmed service request', (await state()).saves.length === 1);
    await release('failure'); await settle(); s = await state(); assert.deepEqual(s.local, original.local);
    ok('rejection retains selected days and immutable retry feedback', JSON.stringify(await selected()) === '[2,5]' &&
      await save.isEnabled() && await discard.isDisabled() && /Ponów/.test(await status.innerText()) && s.checklist.length === 0);
    await modal.locator('.modal-close').click(); await open();
    ok('X close and reopen preserve the failed draft with frozen chips', JSON.stringify(await selected()) === '[2,5]' &&
      await chips.evaluateAll(els => els.every(el => el.disabled)) && await save.isEnabled());
    await modal.click({ position: { x: 5, y: 5 } }); await open();
    ok('overlay close and reopen preserve the same retry selection', JSON.stringify(await selected()) === '[2,5]');
    await save.click(); await pending(); s = await state();
    assert.deepEqual(s.saves[1].candidate, s.saves[0].candidate); assert.deepEqual(s.saves[1].base, original.local[0]);
    assert.deepEqual(s.saves[1].candidate, { id: 'sched-a', trainerId: original.local[0].trainerId, preferredWeekdays: [2, 5] });
    ok('retry keeps raw edit base, identity and service operation', s.saves[1].sameOperation && s.saves[1].edit &&
      !Object.hasOwn(s.saves[1].candidate, 'height') && s.saves[1].base.trainingFreq === null);
    await release(); await flush(); s = await state();
    assert.deepEqual(s.plans, original.plans); assert.deepEqual(s.sessions, original.sessions);
    ok('ACK applies weekdays before returning to the matching checklist', !await modal.isVisible() &&
      JSON.stringify(s.local[0].preferredWeekdays) === '[2,5]' && s.resume.at(-1).id === 'sched-a' &&
      JSON.stringify(s.resume.at(-1).local[0].preferredWeekdays) === '[2,5]' && s.local[0].clientCardWriteId === 'fixture-receipt');

    await reset(); await open(); await choose([0, 6]); await modal.locator('.modal-close').click(); await open();
    ok('unsent selections survive close and reopen', JSON.stringify(await selected()) === '[6,0]' && await save.isEnabled());
    await save.click(); await pending(); await modal.locator('.modal-close').click(); await open();
    ok('pending selection reopens locked without another request', await save.isDisabled() && (await state()).saves.length === 1);
    await release(); await flush();
    ok('matching pending ACK after reopening closes the acknowledged modal', !await modal.isVisible());

    await reset(); await open(); await choose([6]);
    const timerWasScheduled = await page.evaluate(() => {
      window.maybeResumeOnboard = window._scheduleUi.realResume;
      closeScheduleOnboardModal();
      const scheduled = !!window._onboardResumeTimer;
      openClientScheduleFromOnboard('sched-a');
      return scheduled;
    });
    await page.waitForTimeout(550);
    ok('quick reopen cancels the real delayed checklist timer and keeps schedule editable', timerWasScheduled &&
      await modal.isVisible() && !(await page.locator('#m-client-onboard').isVisible()) &&
      JSON.stringify(await selected()) === '[6]' && await save.isEnabled() &&
      await page.evaluate(() => window._onboardResumeTimer === null));
    await page.evaluate(() => { const f = window._scheduleUi; window.maybeResumeOnboard = id =>
      f.resume.push({ id, local: JSON.parse(JSON.stringify(window.CL)) }); });

    for (const mode of ['success', 'failure']) {
      await reset(); await open(); await choose([6]); await save.click(); await pending();
      await open('sched-b'); await choose([0]);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const beforeB = await page.evaluate(() => { window._scheduleUi.chipNodes = [...document.querySelectorAll('#ob-sched-preferred-weekdays button')]; return document.getElementById('m-onboard-schedule').innerHTML; });
      const resumeBefore = (await state()).resume.length;
      await release(mode); await flush(); s = await state();
      const afterB = await page.evaluate(() => ({ html: document.getElementById('m-onboard-schedule').innerHTML,
        sameNodes: [...document.querySelectorAll('#ob-sched-preferred-weekdays button')].every((button, i) => button === window._scheduleUi.chipNodes[i]) }));
      ok('background ' + mode + ' preserves B modal nodes, selection and checklist context', afterB.html === beforeB && afterB.sameNodes &&
        await modal.isVisible() && JSON.stringify(await selected()) === '[0]' && await save.isEnabled() &&
        await page.locator('#ob-sched-name').innerText() === 'Klient Beta' && s.clientId === 'sched-b' && s.resume.length === resumeBefore,
        { mode, sameNodes: afterB.sameNodes, htmlEqual: afterB.html === beforeB, state: s });
      if (mode === 'success') ok('background ACK saves only A and names that client', JSON.stringify(s.local[0].preferredWeekdays) === '[6]' &&
        JSON.stringify(s.local[1].preferredWeekdays) === '[2,4]' && s.notices.some(text => text.includes('Klient Alfa')));
      else { await open(); ok('returning to background failure restores A retry draft', JSON.stringify(await selected()) === '[6]' &&
        await save.isEnabled() && await chips.evaluateAll(els => els.every(el => el.disabled))); }
    }

    for (const mode of ['success', 'failure']) {
      await reset(); await open(); await choose([6]); await save.click(); await pending(); const before = await state();
      await page.evaluate(() => { window._uid = 'next-owner'; window.tenantSessionGeneration++; clearOnboardScheduleDrafts(); });
      await release(mode); await flush(); s = await state(); assert.deepEqual(s.local, before.local);
      ok('auth switch ignores old ' + mode + ' outcome and notices', s.resume.length === 0 && s.notices.length === 0 && s.checklist.length === 0);
    }
    for (const unavailable of ['removed', 'archived', 'foreign-owner']) {
      await reset(); await open(); await choose([6]); await save.click(); await pending();
      const local = await page.evaluate(mode => {
        if (mode === 'removed') window.CL = window.CL.filter(client => client.id !== 'sched-a');
        else if (mode === 'archived') window.CL[0].status = 'archived'; else window.CL[0].trainerId = 'other-owner';
        return JSON.parse(JSON.stringify(window.CL));
      }, unavailable);
      await release(); await settle(); s = await state(); assert.deepEqual(s.local, local);
      ok('ACK cannot recreate or overwrite a locally ' + unavailable + ' client', s.saved && await save.isDisabled() &&
        s.resume.length === 0 && /niedostępny/.test(await status.innerText()));
      await page.evaluate(() => { window._duplicateSchedule = saveClientScheduleFromOnboard(); });
      ok('acknowledged unavailable draft cannot submit again for ' + unavailable, (await state()).saves.length === 1);
    }

    await reset(); await open(); await choose([]); await save.click();
    ok('empty weekdays do not save or complete the checklist', (await state()).saves.length === 0 && (await state()).resume.length === 0);
    await choose([6]); await discard.click(); await open();
    ok('explicit unsent draft discard restores confirmed weekdays', JSON.stringify(await selected()) === '[1,3]' && await save.isEnabled());
    await choose([6]); await save.click(); await pending(); const beforeConflict = await state();
    const remote = { ...beforeConflict.local[0], name: 'Alfa z serwera', preferredWeekdays: [2, 4], notes: 'Zdalna notatka' };
    await release('failure', remote); await settle(); s = await state(); assert.deepEqual(s.local, beforeConflict.local);
    ok('conflict retains selection and requires explicit remote reload', JSON.stringify(await selected()) === '[6]' &&
      await save.isDisabled() && await reload.isVisible() && await discard.isEnabled() && /Wczytaj/.test(await status.innerText()));
    await reload.click();
    ok('reload shows remote weekdays in editable controls', JSON.stringify(await selected()) === '[2,4]' && await save.isEnabled());
    await choose([3]); await save.click(); await pending(); s = await state();
    assert.deepEqual(s.saves[1].base, remote); assert.deepEqual(s.saves[1].candidate,
      { id: remote.id, trainerId: remote.trainerId, preferredWeekdays: [3] });
    ok('post-conflict save uses remote base and a fresh operation', !s.saves[1].sameOperation);
    await release(); await flush();
    ok('fixture performs no optimistic persistence or Firebase network', (await state()).unexpected.length === 0 && liveRequests === 0);
    console.log('\n' + passed + ' confirmed schedule UI checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
