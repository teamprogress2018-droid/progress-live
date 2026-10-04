// Real DOM tests: fixtures never send invitations or write to live Firebase.
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
    await page.waitForFunction(() => typeof window.saveClientOnboardSkipConfirmed === 'function' &&
      typeof window.clearOnboardSkipStates === 'function' && typeof window.renderInviteSkipState === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => JSON.parse(JSON.stringify(value));
      const f = window._skipUi = { owner: 'skip-ui-owner', saves: [], pending: [], notices: [], resume: [], unexpected: [], allUnexpected: [] };
      window._db = { fixture: true };
      for (const method of ['persistById', '_setDoc', '_runTransaction', 'sendInvitation', 'pushMsg', 'openInviteEmailComposer']) {
        window[method] = () => { f.unexpected.push(method); f.allUnexpected.push(method); throw Error('Unexpected live action: ' + method); };
      }
      window.ensureClientInvite = async c => 'https://example.test/invite/' + c.id;
      window.renderClients = () => {}; window.renderDash = () => {};
      window.notify = message => f.notices.push(String(message));
      f.realResume = window.maybeResumeOnboard;
      f.fixtureResume = id => { f.resume.push(id); openClientOnboardChecklist(id); };
      window.maybeResumeOnboard = f.fixtureResume;
      window.saveClientOnboardSkipConfirmed = (candidate, field, operation) => {
        const previous = f.saves.find(row => row.operation === operation);
        f.saves.push({ candidate: clone(candidate), field, operation, sameOperation: !!previous });
        return new Promise((resolve, reject) => f.pending.push({
          success() { f.pending.shift(); resolve({ ...clone(candidate), [field]: true, notes: 'Stale server note' }); },
          failure() { f.pending.shift(); reject(Error('Fixture connection interrupted')); }
        }));
      };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
    });
    const reset = () => page.evaluate(() => {
      if (window._onboardResumeTimer) { clearTimeout(window._onboardResumeTimer); window._onboardResumeTimer = null; }
      document.querySelectorAll('.modal-ov.show').forEach(el => el.classList.remove('show'));
      clearOnboardSkipStates();
      const f = window._skipUi; window.maybeResumeOnboard = f.fixtureResume;
      window._uid = f.owner; window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true; window._clientAppMode = false; window._clientPreviewMode = false;
      window._onboardClientId = 'skip-a'; window._onboardResumeAfterInvite = null;
      window.CL = [{ id: 'skip-a', trainerId: f.owner, name: 'Klient Alfa', status: 'active',
        email: 'alfa@example.test', notes: 'Original note', legacy: { keep: true } },
      { id: 'skip-b', trainerId: f.owner, name: 'Klient Beta', status: 'active', email: 'beta@example.test' }];
      for (const key of ['PL', 'SE', 'PACKAGES', 'METRIC_ENTRIES', 'FORM_SENDS', 'FORUM_GROUPS']) window[key] = [];
      window.ONBOARDING_FLOW = {};
      f.saves = []; f.pending = []; f.notices = []; f.resume = []; f.unexpected = [];
    });
    const state = () => page.evaluate(() => ({ local: JSON.parse(JSON.stringify(CL)), clientId: _onboardClientId,
      saves: _skipUi.saves.map(s => ({ candidate: s.candidate, field: s.field, sameOperation: s.sameOperation })),
      pending: _skipUi.pending.length, notices: _skipUi.notices, resume: _skipUi.resume, unexpected: _skipUi.unexpected }));
    const openChecklist = (id = 'skip-a') => page.evaluate(id => openClientOnboardChecklist(id), id);
    const openInvite = (id = 'skip-a') => page.evaluate(id => { window._onboardResumeAfterInvite = id; return openInviteModal(id); }, id);
    const pending = () => page.waitForFunction(() => _skipUi.pending.length === 1);
    const release = (mode = 'success') => page.evaluate(mode => _skipUi.pending[0][mode](), mode);
    const settle = (id = 'skip-a', field = 'inviteSkipped') => page.waitForFunction(({ id, field }) =>
      !getOnboardSkipState(id, field)?.pending, { id, field });
    const flush = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    const checklist = page.locator('#m-client-onboard'), invite = page.locator('#m-invite');
    const skipInvite = page.locator('#inv-skip-btn'), inviteStatus = page.locator('#inv-skip-status');
    const row = field => page.locator('#client-onboard-steps > div').filter({ hasText: field === 'inviteSkipped' ? 'Wyślij zaproszenie' : 'Pakiet / płatność' });
    const skipButton = field => checklist.locator('button[data-onboard-skip-client="skip-a"][data-onboard-skip-field="' + field + '"][data-onboard-skip-action="skip"]');
    const status = field => checklist.locator('[data-onboard-skip-status="' + field + '"][data-onboard-skip-client="skip-a"]');
    let passed = 0;
    const ok = (label, condition, detail) => { assert.ok(condition, label + (detail ? ': ' + JSON.stringify(detail) : '')); passed++; console.log('OK ' + label); };

    for (const field of ['inviteSkipped', 'packageSkipped']) {
      await reset(); await openChecklist(); const before = await state();
      await skipButton(field).click(); await pending(); let s = await state();
      assert.deepEqual(s.local, before.local);
      ok(field + ' pending does not mark GOTOWE or mutate CL', !((await row(field).innerText()).includes('GOTOWE')) &&
        await skipButton(field).isDisabled() && s.notices.length === 0 && s.resume.length === 0, s);
      ok(field + ' pending status is accessible', await status(field).getAttribute('aria-live') === 'polite' &&
        (await status(field).innerText()).includes('potwierdzenie'));
      await page.evaluate(field => { saveOnboardSkip('skip-a', field); }, field);
      ok(field + ' duplicate submission shares one write', (await state()).saves.length === 1);
      await release('failure'); await settle('skip-a', field); s = await state(); assert.deepEqual(s.local, before.local);
      ok(field + ' rejection keeps retry available and row incomplete', await skipButton(field).isEnabled() &&
        (await skipButton(field).innerText()).includes('Ponów') && !((await row(field).innerText()).includes('GOTOWE')));
      await skipButton(field).click(); await pending(); s = await state();
      assert.deepEqual(s.saves[1].candidate, s.saves[0].candidate); ok(field + ' retry uses same operation', s.saves[1].sameOperation);
      await page.evaluate(() => { CL[0].notes = 'Concurrent local note'; });
      await release(); await settle('skip-a', field); s = await state();
      ok(field + ' confirmed ACK alone marks row complete and preserves concurrent data', s.local[0][field] === true &&
        s.local[0].notes === 'Concurrent local note' && (await row(field).innerText()).includes('GOTOWE'), s);
      assert.deepEqual(s.local[1], before.local[1]); assert.deepEqual(s.local[0].legacy, before.local[0].legacy);
    }

    await reset(); await openChecklist(); await skipButton('packageSkipped').click(); await pending();
    await page.evaluate(() => { CL[0].packageSkipped = true; renderClientOnboardChecklist(); });
    ok('listener marker remains visually unconfirmed pending ACK', !((await row('packageSkipped').innerText()).includes('GOTOWE')) &&
      await skipButton('packageSkipped').isDisabled());
    await release('failure'); await settle('skip-a', 'packageSkipped');
    ok('failed listener marker remains incomplete on checklist and dashboard status', !((await row('packageSkipped').innerText()).includes('GOTOWE')) &&
      await page.evaluate(() => clientOnboardStatus(CL[0]).package === false));

    await reset(); await openInvite(); await skipInvite.click(); await pending(); let s = await state();
    ok('invitation pending keeps modal open with locked skip/send/method controls', await invite.isVisible() &&
      await skipInvite.isDisabled() && await page.locator('#inv-send-btn').isDisabled() &&
      await invite.locator('.modal-body button').evaluateAll(buttons => buttons.length > 0 && buttons.every(button => button.disabled)) &&
      s.local[0].inviteSkipped === undefined && s.resume.length === 0, s);
    ok('invitation confirmation status is accessible', await inviteStatus.getAttribute('role') === 'status' &&
      await inviteStatus.getAttribute('aria-live') === 'polite');
    await release('failure'); await settle();
    ok('invitation failure stays visible with retry status', await invite.isVisible() && await skipInvite.isEnabled() && await inviteStatus.isVisible() &&
      (await inviteStatus.innerText()).includes('Ponów'));
    await skipInvite.click(); await pending(); await release(); await settle(); await flush(); s = await state();
    ok('invitation retry closes modal and resumes confirmed checklist exactly once', !(await invite.isVisible()) &&
      await checklist.isVisible() && s.local[0].inviteSkipped === true && JSON.stringify(s.resume) === JSON.stringify(['skip-a']) &&
      (await row('inviteSkipped').innerText()).includes('GOTOWE'), s);

    for (const target of ['closed', 'same-client-reopened', 'other-client']) {
      await reset(); await openInvite(); await skipInvite.click(); await pending();
      await page.evaluate(() => closeInviteModal(false));
      await page.evaluate(() => closeM('m-client-onboard'));
      if (target !== 'closed') await openInvite(target === 'other-client' ? 'skip-b' : 'skip-a');
      await page.evaluate(() => { _skipUi.viewBefore = _inviteModalView; _skipUi.resumeBefore = _skipUi.resume.length; });
      await release(); await settle(); await flush(); s = await state();
      ok('late invitation ACK preserves ' + target + ' view', await page.evaluate(() => _inviteModalView === _skipUi.viewBefore &&
        _skipUi.resume.length === _skipUi.resumeBefore) && (target === 'closed' ? !(await invite.isVisible()) : await invite.isVisible()) &&
        s.local[0].inviteSkipped === true && s.local[1].inviteSkipped === undefined, s);
      if (target !== 'closed') ok(target + ' current invitation identity stays intact', await page.locator('#inv-name').innerText() ===
        (target === 'other-client' ? 'Klient Beta' : 'Klient Alfa'));
    }

    await reset(); await openChecklist(); await skipButton('packageSkipped').click(); await pending(); await openChecklist('skip-b');
    await page.evaluate(() => { _skipUi.bodyBefore = document.getElementById('client-onboard-steps').innerHTML; });
    await release(); await settle('skip-a', 'packageSkipped'); s = await state();
    ok('background package ACK updates only A and preserves B checklist DOM', s.local[0].packageSkipped === true &&
      s.local[1].packageSkipped === undefined && s.clientId === 'skip-b' && await page.evaluate(() =>
      _skipUi.bodyBefore === document.getElementById('client-onboard-steps').innerHTML), s);

    await reset(); await page.evaluate(() => { window.maybeResumeOnboard = _skipUi.realResume; });
    await openInvite(); await page.evaluate(() => closeInviteModal(false)); await openChecklist('skip-b');
    await page.waitForTimeout(550);
    ok('close A then open B cancels actual 450ms resume callback', await checklist.isVisible() &&
      await page.evaluate(() => _onboardClientId === 'skip-b' && !window._onboardResumeTimer) &&
      (await page.locator('#client-onboard-intro').innerText()).includes('Klient Beta'));

    await reset(); await openInvite(); await skipInvite.click(); await pending();
    await page.evaluate(() => { window._uid = 'new-owner'; window.tenantSessionGeneration++; clearOnboardSkipStates();
      window.CL = [{ id: 'skip-a', trainerId: 'new-owner', name: 'Nowy klient', status: 'active' }]; _skipUi.localBefore = JSON.stringify(CL); });
    await release(); await flush(); await flush(); s = await state();
    ok('old tenant ACK cannot mutate list, show success, close current modal or resume', await page.evaluate(() =>
      JSON.stringify(CL) === _skipUi.localBefore) && s.notices.length === 0 && s.resume.length === 0 && await invite.isVisible(), s);
    ok('skip scenarios perform no live database writes or invitation sends', await page.evaluate(() => _skipUi.allUnexpected.length === 0) && liveRequests === 0, { unexpected: s.unexpected, liveRequests });
    console.log('PASS confirmed onboarding skip UI: ' + passed + ' checks');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
