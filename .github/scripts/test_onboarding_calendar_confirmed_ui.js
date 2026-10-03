// UI: onboarding calendar buttons wait for confirmed writes and keep retries scoped.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const shotDir = process.env.ONBOARDING_CALENDAR_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('node:os').tmpdir(), 'pl-onboarding-calendar'));
fs.mkdirSync(shotDir, { recursive: true });
let passed = 0;
function ok(name, condition, detail) {
  assert.ok(condition, name + (detail ? ': ' + JSON.stringify(detail) : ''));
  passed++;
  console.log('OK ' + name);
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    await page.clock.setFixedTime(new Date('2026-09-28T10:00:00.000Z'));
    page.setDefaultTimeout(20000);
    await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
    let liveRequests = 0;
    await page.route('**://firestore.googleapis.com/**', route => { liveRequests++; return route.abort(); });
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.refillCalendarConfirmed === 'function' && typeof window.scheduleClientPlanToCalendar === 'function' && typeof window.openClientOnboardChecklist === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => JSON.parse(JSON.stringify(value));
      const f = window._onboardingCalendarUi = {
        owner: 'onboarding-calendar-owner', a: 'onboarding-client-a', b: 'onboarding-client-b',
        docs: {}, queries: [], transactions: [], commits: [], pending: {},
        unexpected: [], notifications: [], planClientSnapshot: null
      };
      const key = ref => ref.collection + '/' + ref.id;
      const snapshot = ref => {
        const exists = Object.prototype.hasOwnProperty.call(f.docs, key(ref));
        const value = exists ? clone(f.docs[key(ref)]) : null;
        return { id: ref.id, ref, exists: () => exists, data: () => clone(value) };
      };
      window._db = { fixture: true };
      window._doc = (_db, collection, id) => ({ collection, id });
      window._col = (_db, collection) => ({ collection });
      window._where = (field, op, value) => ({ field, op, value });
      window._query = (ref, ...filters) => ({ ...ref, filters });
      window._getDoc = async ref => snapshot(ref);
      window._get = async query => {
        f.queries.push(clone(query));
        if (!['sessions', 'packages'].includes(query.collection)) throw new Error('Unexpected calendar collection: ' + query.collection);
        const filters = query.filters || [];
        const client = filters.find(q => q.field === 'clientId' && q.op === '==');
        if (!client || ![f.a, f.b].includes(client.value)) throw new Error('Missing client query scope');
        if (!filters.some(q => q.field === 'trainerId' && q.op === '==' && q.value === f.owner)) throw new Error('Missing trainer query scope');
        const rows = Object.entries(f.docs)
          .filter(([id, data]) => id.startsWith(query.collection + '/') && filters.every(q => q.op === '==' && data[q.field] === q.value))
          .map(([id]) => snapshot({ collection: query.collection, id: id.slice(query.collection.length + 1) }));
        return { docs: rows, empty: !rows.length, size: rows.length, forEach: callback => rows.forEach(callback) };
      };
      window._runTransaction = async (_db, callback) => {
        const reads = [], writes = [];
        const result = await callback({
          get: async ref => {
            if (writes.length) throw new Error('All transaction reads must precede writes');
            reads.push(key(ref));
            return snapshot(ref);
          },
          set: (ref, value, options) => {
            if (ref.collection !== 'sessions') {
              f.unexpected.push({ transactionWrite: key(ref) });
              throw new Error('Onboarding calendar may only create sessions');
            }
            writes.push({ ref, value: clone(value), options });
          },
          delete: ref => { f.unexpected.push({ transactionDelete: key(ref) }); throw new Error('Calendar must retain existing appointments'); }
        });
        const clients = reads.filter(id => id.startsWith('clients/'));
        if (clients.length !== 1) throw new Error('Expected one fresh client read');
        const cid = clients[0].slice('clients/'.length);
        if (![f.a, f.b].includes(cid)) throw new Error('Unexpected transaction client');
        if (writes.some(w => w.value.clientId !== cid || w.value.trainerId !== f.owner)) throw new Error('Cross-client transaction');
        f.transactions.push({ cid, reads, ids: writes.map(w => key(w.ref)).sort() });
        if (f.pending[cid]) throw new Error('Duplicate pending calendar transaction');
        const commit = () => {
          for (const write of writes) {
            f.docs[key(write.ref)] = write.options && write.options.merge ? { ...(f.docs[key(write.ref)] || {}), ...write.value } : clone(write.value);
            f.commits.push({ cid, id: key(write.ref), value: clone(write.value) });
          }
          return result;
        };
        return new Promise((resolve, reject) => {
          const gate = {
            succeed() { delete f.pending[cid]; resolve(commit()); },
            fail() { delete f.pending[cid]; reject(Object.assign(new Error('Fixture connection interrupted'), { code: 'unavailable' })); },
            loseAck() { delete f.pending[cid]; commit(); reject(Object.assign(new Error('Fixture lost acknowledgement'), { code: 'unavailable' })); }
          };
          f.pending[cid] = gate;
        });
      };
      window._setDoc = async (...args) => { f.unexpected.push({ setDoc: args }); throw new Error('Unexpected direct write'); };
      window._del = async (...args) => { f.unexpected.push({ deleteDoc: args }); throw new Error('Unexpected delete'); };
      window.persistById = async (collection, data) => { f.unexpected.push({ persistById: collection, id: data && data.id }); return null; };
      window.schedulePlanToCalendar = () => { f.unexpected.push({ legacyCalendar: true }); throw new Error('Do not rebuild the calendar'); };
      window.maybeSchedulePlanToCalendar = () => { f.unexpected.push({ legacyMaybeCalendar: true }); throw new Error('Do not use the optimistic calendar path'); };
      window.notify = message => f.notifications.push(String(message));
      f.originalPlanClients = () => clone(Object.fromEntries(Object.entries(f.docs).filter(([id]) => /^(clients|plans)\//.test(id))));
      f.addPlan = (clientId, id, weekday, createdAt) => {
        const plan = { id, trainerId: f.owner, clientId, name: 'Plan testowy ' + id, duration: '4', createdAt,
          days: [{ day: weekday === 1 ? 'PON' : 'ŚR', weekday, rest: false, exercises: [{ name: 'Przysiad testowy', sets: '3', reps: '8' }] }] };
        window.PL.push(clone(plan));
        f.docs['plans/' + id] = clone(plan);
        return plan;
      };
      f.reset = () => {
        if (Object.keys(f.pending).length) throw new Error('Resolve pending fixture transactions before reset');
        window._uid = f.owner;
        window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
        window._tenantDataReady = true;
        window._clientAppMode = false;
        window._clientPreviewMode = false;
        window._afStateReady = false;
        f.docs = {}; f.queries = []; f.transactions = []; f.commits = []; f.notifications = [];
        window.CL = [
          { id: f.a, trainerId: f.owner, name: 'Klient Alfa', status: 'active', accessMode: 'trial', preferredWeekdays: [1], inviteSkipped: true, packageSkipped: true },
          { id: f.b, trainerId: f.owner, name: 'Klient Beta', status: 'active', accessMode: 'trial', preferredWeekdays: [1], inviteSkipped: true, packageSkipped: true }
        ];
        window.PL = []; window.SE = []; window.PACKAGES = []; window.TASKS = [];
        window.CHECKINS = {}; window.PROGRESS_PHOTOS = []; window.METRIC_ENTRIES = []; window.FORM_SENDS = [];
        window.ONBOARDING_FLOW = null;
        window.CL.forEach(client => { f.docs['clients/' + client.id] = clone(client); });
        f.addPlan(f.a, 'onboarding-plan-a', 1, '2026-09-01T12:00:00Z');
        f.addPlan(f.b, 'onboarding-plan-b', 1, '2026-09-01T12:00:00Z');
        f.planClientSnapshot = f.originalPlanClients();
        openClientOnboardChecklist(f.a);
      };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
      goTo('clients');
      f.reset();
    });

    const modal = page.locator('#m-client-onboard');
    const row = page.locator('[data-onboard-step="calendar"]');
    const button = row.locator('button[onclick*="scheduleClientPlanToCalendar"]');
    const status = row.locator('[role="status"]');
    const pending = cid => page.waitForFunction(cid => !!window._onboardingCalendarUi.pending[cid], cid);
    const release = (cid, mode) => page.evaluate(({ cid, mode }) => window._onboardingCalendarUi.pending[cid][mode](), { cid, mode });
    const values = () => page.evaluate(() => {
      const f = window._onboardingCalendarUi;
      return {
        queries: f.queries, transactions: f.transactions, commits: f.commits,
        sessions: window.SE.map(s => ({ ...s })), remoteSessions: Object.values(f.docs).filter(s => s.source === 'planned'),
        modalClient: window._onboardClientId,
        aDone: getClientOnboard(window.CL.find(c => c.id === f.a)).calendar,
        bDone: getClientOnboard(window.CL.find(c => c.id === f.b)).calendar,
        currentDocs: f.originalPlanClients(), originalDocs: f.planClientSnapshot
      };
    });
    const cidA = 'onboarding-client-a', cidB = 'onboarding-client-b';
    const rowDone = () => row.evaluate(el => /\bGOTOWE\b/.test(el.innerText) && el.textContent.includes('✓'));

    ok('onboarding opens an actual client modal', await modal.isVisible() && /Klient Alfa/.test(await page.locator('#client-onboard-intro').innerText()));
    ok('first calendar action is visible before any dates exist', await button.isVisible() && /Dodaj terminy na 4 tygodnie/.test(await button.innerText()) && !(await rowDone()));
    const progressBefore = await page.locator('#client-onboard-progress').innerText();
    await button.click();
    await pending(cidA);
    let v = await values();
    ok('calendar transaction remains invisible in local and remote data until acknowledgement', v.sessions.length === 0 && v.remoteSessions.length === 0 && v.commits.length === 0, v);
    ok('pending calendar does not award a checkmark or onboarding progress', !v.aDone && !(await rowDone()) && await page.locator('#client-onboard-progress').innerText() === progressBefore);
    ok('pending button is disabled and status is accessible', await button.isDisabled() && await status.isVisible() && await status.getAttribute('aria-live') === 'polite');
    await page.evaluate(() => { window._onboardingDuplicate = scheduleClientPlanToCalendar(window._onboardingCalendarUi.a); });
    ok('a queued double click shares the current calendar operation', (await values()).transactions.length === 1);
    await page.evaluate(() => renderClientOnboardChecklist());
    ok('rerender preserves pending state without a premature checkmark', await button.isDisabled() && !(await rowDone()));
    await page.evaluate(() => {
      const f = window._onboardingCalendarUi;
      window.SE = [{ id: 'optimistic-listener-session', clientId: f.a, trainerId: f.owner, source: 'planned', planId: 'onboarding-plan-a', date: '2026-09-28' }];
      renderClientOnboardChecklist();
    });
    ok('optimistic listener data cannot award a checkmark before acknowledgement', !(await rowDone()) && await button.isDisabled() && await page.locator('#client-onboard-progress').innerText() === progressBefore);
    await page.evaluate(() => { window.SE = []; renderClientOnboardChecklist(); });
    const firstIds = v.transactions[0].ids;
    await release(cidA, 'fail');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-onboard-step="calendar"] button[onclick*="scheduleClientPlanToCalendar"]');
      return el && !el.disabled && /Ponów/i.test(el.textContent);
    });
    v = await values();
    ok('failed calendar retains the incomplete step and unchanged appointments', !v.aDone && v.sessions.length === 0 && v.remoteSessions.length === 0 && !(await rowDone()), v);
    ok('failure shows the implementation error prefix beside retry', await status.isVisible() && /^Nie udało się potwierdzić zapisu\./.test((await status.innerText()).trim()) && /Ponów zapis terminów/.test(await button.innerText()));
    await page.screenshot({ path: path.join(shotDir, 'onboarding_calendar_retry.png') });

    await button.click();
    await pending(cidA);
    v = await values();
    assert.deepEqual(v.transactions[1].ids, firstIds);
    ok('retry targets exactly the same four calendar records', firstIds.length === 4);
    assert.deepEqual(v.currentDocs, v.originalDocs);
    ok('retry never edits the plan or client document', true);
    await release(cidA, 'succeed');
    await page.waitForFunction(() => {
      const row = document.querySelector('[data-onboard-step="calendar"]');
      return row && /\bGOTOWE\b/.test(row.innerText);
    });
    v = await values();
    ok('only confirmed success marks the calendar step done', v.aDone && !v.bDone && v.sessions.length === 4 && v.remoteSessions.length === 4 && await rowDone(), v);
    ok('confirmed step exposes the second calendar action', await button.isVisible() && /Dopełnij terminy najnowszego planu/.test(await button.innerText()));

    await page.evaluate(() => {
      const f = window._onboardingCalendarUi;
      f.addPlan(f.a, 'onboarding-plan-a-newest', 3, '2026-09-29T12:00:00Z');
      f.planClientSnapshot = f.originalPlanClients();
      renderClientOnboardChecklist();
    });
    const originalSessions = (await values()).sessions;
    await button.click();
    await pending(cidA);
    v = await values();
    ok('second action uses the newest plan with different training days', v.transactions[2].reads.includes('plans/onboarding-plan-a-newest') && v.transactions[2].ids.length === 4, v.transactions[2]);
    assert.deepEqual(v.sessions, originalSessions);
    ok('second action preserves every existing appointment while pending', await button.isDisabled());
    const newestIds = v.transactions[2].ids;
    await release(cidA, 'loseAck');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-onboard-step="calendar"] button[onclick*="scheduleClientPlanToCalendar"]');
      return el && !el.disabled && /Ponów/i.test(el.textContent);
    });
    v = await values();
    ok('lost acknowledgement does not claim the new calendar dates locally', v.sessions.length === 4 && v.remoteSessions.length === 8 && v.aDone && await rowDone(), v);
    await button.click();
    await pending(cidA);
    v = await values();
    ok('lost-ack retry reads the original target records instead of adding duplicates', newestIds.every(id => v.transactions[3].reads.includes(id)) && v.transactions[3].ids.length === 0, v.transactions[3]);
    await release(cidA, 'succeed');
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-onboard-step="calendar"] button[onclick*="scheduleClientPlanToCalendar"]');
      return window.SE.length === 8 && button && !button.disabled && /Dopełnij terminy najnowszego planu/.test(button.innerText);
    });
    v = await values();
    ok('unchanged confirmation merges all eight dates and reenables the second action', v.sessions.length === 8 && v.remoteSessions.length === 8 && v.commits.length === 8 && await button.isEnabled() && /Dopełnij terminy najnowszego planu/.test(await button.innerText()), v);
    for (const previous of originalSessions) assert.deepEqual(v.sessions.find(s => s.id === previous.id), previous);
    assert.deepEqual(v.currentDocs, v.originalDocs);
    ok('retry preserves existing session contents and all plan/client fields', true);

    await page.evaluate(() => window._onboardingCalendarUi.reset());
    await button.click();
    await pending(cidA);
    await page.evaluate(() => openClientOnboardChecklist(window._onboardingCalendarUi.b));
    ok('another client can open their own checklist while the first request is pending', /Klient Beta/.test(await page.locator('#client-onboard-intro').innerText()) && await button.isEnabled() && !(await rowDone()));
    await button.click();
    await pending(cidB);
    const betaView = await page.locator('#client-onboard-body').innerHTML();
    await release(cidA, 'succeed');
    await page.waitForFunction(() => window.SE.some(s => s.clientId === window._onboardingCalendarUi.a));
    await page.evaluate(() => getOnboardCalendarState(window._onboardingCalendarUi.a).promise);
    v = await values();
    ok('first client completion cannot complete the second client calendar', v.aDone && !v.bDone && v.modalClient === cidB && !(await rowDone()), v);
    ok('stale completion cannot replace or unlock the other client modal', await page.locator('#client-onboard-body').innerHTML() === betaView && await button.isDisabled());
    await release(cidB, 'fail');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-onboard-step="calendar"] button[onclick*="scheduleClientPlanToCalendar"]');
      return el && !el.disabled && /Ponów/i.test(el.textContent);
    });
    ok('retry remains attached to the visible second client', /Klient Beta/.test(await page.locator('#client-onboard-intro').innerText()) && !(await rowDone()));
    await button.click();
    await pending(cidB);
    const betaRetry = (await values()).transactions.at(-1);
    ok('second client retry reads only their own client and plan', betaRetry.cid === cidB && betaRetry.reads.includes('plans/onboarding-plan-b') && !betaRetry.reads.includes('clients/' + cidA), betaRetry);
    await release(cidB, 'succeed');
    await page.waitForFunction(() => {
      const row = document.querySelector('[data-onboard-step="calendar"]');
      return row && /\bGOTOWE\b/.test(row.innerText);
    });
    v = await values();
    ok('independent confirmations give each client four dates', v.sessions.filter(s => s.clientId === cidA).length === 4 && v.sessions.filter(s => s.clientId === cidB).length === 4 && v.aDone && v.bDone, v);

    await page.evaluate(() => window._onboardingCalendarUi.reset());
    await button.click();
    await pending(cidA);
    await modal.locator('.modal-close').click();
    ok('modal can be closed during confirmation', !(await modal.isVisible()));
    await release(cidA, 'succeed');
    await page.waitForFunction(() => window.SE.length === 4);
    await page.evaluate(() => getOnboardCalendarState(window._onboardingCalendarUi.a).promise);
    ok('late success does not reopen a dismissed onboarding modal', !(await modal.isVisible()));
    await page.evaluate(() => openClientOnboardChecklist(window._onboardingCalendarUi.a));
    ok('reopened checklist reflects confirmed calendar data', await rowDone() && await button.isEnabled() && /Dopełnij terminy najnowszego planu/.test(await button.innerText()));

    await page.evaluate(() => window._onboardingCalendarUi.reset());
    await button.click();
    await pending(cidA);
    await modal.locator('.modal-close').click();
    await page.evaluate(() => openClientOnboardChecklist(window._onboardingCalendarUi.a));
    ok('same-client checklist can reopen before calendar acknowledgement', await modal.isVisible() && /Klient Alfa/.test(await page.locator('#client-onboard-intro').innerText()));
    ok('reopened checklist stays pending and incomplete before acknowledgement', await button.isDisabled() && !(await rowDone()));
    await release(cidA, 'succeed');
    await page.waitForFunction(() => {
      const row = document.querySelector('[data-onboard-step="calendar"]');
      const button = row && row.querySelector('button[onclick*="scheduleClientPlanToCalendar"]');
      return row && /\bGOTOWE\b/.test(row.innerText) && button && !button.disabled;
    });
    ok('confirmation refreshes and unlocks the reopened same-client checklist', await modal.isVisible() && await rowDone() && await button.isEnabled());
    ok('all persistence uses confirmed calendar transactions only', await page.evaluate(() => window._onboardingCalendarUi.unexpected.length === 0));
    ok('UI fixture never contacts live Firestore', liveRequests === 0, liveRequests);
    console.log('\n' + passed + ' onboarding calendar confirmation UI checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
