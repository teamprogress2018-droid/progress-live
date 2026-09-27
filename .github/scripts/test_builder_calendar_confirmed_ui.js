// UI: plan and calendar confirmations are separate; retry never saves the plan twice.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const shotDir = process.env.BUILDER_CALENDAR_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('node:os').tmpdir(), 'pl-builder-calendar'));
fs.mkdirSync(shotDir, { recursive: true });
let passed = 0;
function ok(name, value, detail) {
  assert.ok(value, name + (detail ? ': ' + JSON.stringify(detail) : ''));
  passed++;
  console.log('OK ' + name);
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    await page.clock.setFixedTime(new Date('2026-09-28T10:00:00.000Z'));
    page.setDefaultTimeout(20000);
    let liveRequests = 0;
    await page.route('**://firestore.googleapis.com/**', route => { liveRequests++; return route.abort(); });
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.refillCalendarConfirmed === 'function' && typeof window.builderRetryCalendar === 'function' && typeof window.builderFinishSavedPlan === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const clone = value => JSON.parse(JSON.stringify(value));
      const f = window._builderCalendarUi = {
        owner: 'builder-calendar-owner', clientId: 'builder-calendar-client', docs: {},
        queries: [], transactions: [], commits: [], unexpected: [], notifications: [], leaves: [], onboard: [],
        holdPlans: false, holdCalendar: false, pending: null
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
        if (!['sessions', 'packages'].includes(query.collection)) throw new Error('Unexpected calendar query: ' + query.collection);
        const filters = query.filters || [];
        if (!filters.some(q => q.field === 'trainerId' && q.op === '==' && q.value === f.owner)) throw new Error('Missing trainer query scope');
        if (!filters.some(q => q.field === 'clientId' && q.op === '==' && q.value === f.clientId)) throw new Error('Missing client query scope');
        const rows = Object.entries(f.docs)
          .filter(([id, data]) => id.startsWith(query.collection + '/') && filters.every(q => q.op === '==' && data[q.field] === q.value))
          .map(([id]) => snapshot({ collection: query.collection, id: id.slice(query.collection.length + 1) }));
        return { docs: rows, empty: !rows.length, size: rows.length, forEach: callback => rows.forEach(callback) };
      };
      window._runTransaction = async (_db, callback) => {
        const reads = [], writes = [];
        const result = await callback({
          get: async ref => {
            if (writes.length) throw new Error('Transaction must read before writing');
            reads.push(key(ref));
            return snapshot(ref);
          },
          set: (ref, value, options) => writes.push({ ref, value: clone(value), options }),
          delete: ref => { f.unexpected.push({ delete: key(ref) }); throw new Error('Calendar must not delete appointments'); }
        });
        const kind = reads.some(ref => ref.startsWith('sessions/')) ? 'calendar' : 'plans';
        if (writes.some(w => w.ref.collection !== (kind === 'calendar' ? 'sessions' : 'plans'))) throw new Error('Unexpected transaction write');
        f.transactions.push({ kind, reads, ids: writes.map(w => key(w.ref)).sort() });
        const commit = () => {
          for (const write of writes) {
            f.docs[key(write.ref)] = write.options && write.options.merge ? { ...(f.docs[key(write.ref)] || {}), ...write.value } : clone(write.value);
            f.commits.push({ kind, id: key(write.ref), value: clone(write.value) });
          }
          return result;
        };
        if (!(kind === 'plans' ? f.holdPlans : f.holdCalendar)) return commit();
        if (f.pending) throw new Error('Overlapping transaction during held confirmation');
        return new Promise((resolve, reject) => {
          const gate = {
            kind,
            succeed() { if (f.pending === gate) f.pending = null; resolve(commit()); },
            fail() { if (f.pending === gate) f.pending = null; reject(Object.assign(new Error('Fixture connection interrupted'), { code: 'unavailable' })); }
          };
          f.pending = gate;
        });
      };
      window._setDoc = async (...args) => { f.unexpected.push({ setDoc: args }); throw new Error('Unexpected direct write'); };
      window._del = async (...args) => { f.unexpected.push({ deleteDoc: args }); throw new Error('Unexpected delete'); };
      window.persistById = async (collection, data) => { f.unexpected.push({ persistById: collection, id: data && data.id }); return null; };
      window.notify = message => f.notifications.push(String(message));
      window.maybeResumeOnboard = clientId => f.onboard.push(clientId);
      const leave = window.builderLeaveToCaller;
      window.builderLeaveToCaller = opts => { f.leaves.push(clone(opts || {})); return leave(opts); };
      f.reset = options => {
        options = options || {};
        if (f.pending) throw new Error('Finish the previous transaction before resetting the fixture');
        window._uid = f.owner;
        window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
        window._tenantDataReady = true;
        window._clientAppMode = false;
        window._clientPreviewMode = false;
        window._afStateReady = false;
        f.docs = {}; f.queries = []; f.transactions = []; f.commits = []; f.notifications = []; f.leaves = []; f.onboard = [];
        f.holdPlans = !!options.holdPlans; f.holdCalendar = !!options.holdCalendar;
        window.CL = [{ id: f.clientId, trainerId: f.owner, name: 'Klient testowy', status: 'active', accessMode: 'trial', preferredWeekdays: [1], level: 'sredni', goal: 'masa' }];
        window.PL = []; window.SE = []; window.PACKAGES = []; window.TASKS = []; window.CHECKINS = {}; window.PROGRESS_PHOTOS = [];
        window._builderReturnClientId = null; window._builderReturnTab = null; window._builderBack = options.library ? 'plans' : 'clients';
        window._onboardResumeAfterBuilder = null;
        f.docs['clients/' + f.clientId] = clone(window.CL[0]);
        if (options.edit) {
          const plan = { id: 'existing-plan', trainerId: f.owner, clientId: f.clientId, name: 'Plan przed edycją', method: 'FBW', duration: '4', progression: 'off', createdAt: '2026-09-01T12:00:00Z', customMetadata: { preserve: true }, days: [{ day: 'PON', weekday: 1, muscles: 'Nogi', rest: false, exercises: [{ name: 'Przysiad testowy', sets: '3', reps: '8', kg: '40' }], sets: 3 }] };
          window.PL = [clone(plan)]; f.docs['plans/' + plan.id] = clone(plan);
          editPlanFromProfile(plan.id, f.clientId);
        } else if (options.library) {
          goTo('builder');
          addDay(); addRow(document.querySelector('.builder-day').id);
        } else {
          openBuilderForClient(f.clientId, !!options.onboard);
          addDay();
          if (options.rest) {
            const day = document.querySelector('.builder-day'); day.querySelector('.rc').checked = true; toggleR(day.id);
          } else addRow(document.querySelector('.builder-day').id);
        }
        f.leaves = [];
      };
      ['auth-screen', 'app-loading'].forEach(id => { const node = document.getElementById(id); if (node) node.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
      f.reset({ holdPlans: true, holdCalendar: true, onboard: true });
    });

    const save = page.locator('#b-save-btn');
    const status = page.locator('#builder-save-status');
    const retry = page.locator('#b-calendar-retry');
    const proceed = page.locator('#b-calendar-continue');
    const activeBuilder = () => page.locator('#screen-builder').evaluate(el => el.classList.contains('active'));
    const values = () => page.evaluate(() => {
      const f = window._builderCalendarUi;
      return {
        plans: window.PL.length, sessions: window.SE.length, commits: f.commits,
        transactions: f.transactions, queries: f.queries.length, leaves: f.leaves.length, onboard: f.onboard.length,
        remotePlans: Object.keys(f.docs).filter(id => id.startsWith('plans/')).length,
        remoteSessions: Object.keys(f.docs).filter(id => id.startsWith('sessions/')).length,
        planSaved: !!(window._builderSaveState && window._builderSaveState.saved),
        stateCalendar: window._builderSaveState && window._builderSaveState.calendar && window._builderSaveState.calendar.status
      };
    });
    const fill = async (name, rest = false) => {
      await page.locator('#b-name').fill(name);
      await page.locator('#b-method').selectOption('FBW');
      await page.locator('#b-duration').selectOption('4');
      if (!rest) {
        await page.locator('.builder-day .ex-row [data-f="name"]').first().fill('Przysiad testowy');
        await page.locator('.builder-day .ex-row [data-f="sets"]').first().fill('3');
        await page.locator('.builder-day .ex-row [data-f="reps"]').first().fill('8');
      }
    };
    const waitPending = kind => page.waitForFunction(kind => window._builderCalendarUi.pending && window._builderCalendarUi.pending.kind === kind, kind);
    const release = mode => page.evaluate(mode => window._builderCalendarUi.pending[mode](), mode);
    const reset = options => page.evaluate(options => window._builderCalendarUi.reset(options), options);

    await fill('Plan z potwierdzeniem terminów');
    await save.click();
    await waitPending('plans');
    let v = await values();
    ok('plan stays unpublished until its transaction confirms', v.plans === 0 && v.remotePlans === 0 && v.sessions === 0 && v.commits.length === 0, v);
    ok('calendar and navigation wait for the plan confirmation', v.queries === 0 && v.leaves === 0 && v.onboard === 0 && await activeBuilder(), v);
    ok('plan save locks its form and save button', await save.isDisabled() && await page.locator('#b-name').isDisabled() && await page.locator('.ex-row [data-f="name"]').first().isDisabled());
    await page.evaluate(() => savePlan());
    ok('queued double save cannot start another plan transaction', (await values()).transactions.length === 1);

    await release('succeed');
    await waitPending('calendar');
    v = await values();
    ok('confirmed plan is retained while calendar confirmation is pending', v.planSaved && v.plans === 1 && v.remotePlans === 1 && v.sessions === 0 && v.remoteSessions === 0, v);
    ok('calendar pending neither leaves nor resumes onboarding', v.leaves === 0 && v.onboard === 0 && await activeBuilder(), v);
    ok('saved plan fields remain locked during calendar completion', await save.isDisabled() && await page.locator('#b-name').isDisabled());
    ok('calendar progress is visible in an accessible live region', await status.isVisible() && /plan.*zapis|zapis.*plan/i.test(await status.innerText()) && /kalendarz/i.test(await status.innerText()) && await status.getAttribute('role') === 'status' && await status.getAttribute('aria-live') === 'polite');
    const firstIds = v.transactions.find(t => t.kind === 'calendar').ids;
    await release('fail');
    await retry.waitFor({ state: 'visible' });
    v = await values();
    ok('calendar failure clearly preserves the saved plan', v.planSaved && v.plans === 1 && v.remotePlans === 1 && v.sessions === 0 && v.remoteSessions === 0 && v.leaves === 0, v);
    ok('calendar error offers retry and continue without claiming complete success', /plan.*zapis/i.test(await status.innerText()) && /nie.*potwierdz/i.test(await status.innerText()) && await retry.isEnabled() && await proceed.isVisible() && await proceed.isEnabled());
    ok('calendar retry uses a distinct action from saving the plan', await retry.innerText() === 'Ponów dopełnienie kalendarza' && await proceed.innerText() === 'Kontynuuj bez dopełnienia' && await save.isDisabled());
    await page.screenshot({ path: path.join(shotDir, 'builder_calendar_retry.png') });
    await page.evaluate(() => savePlan());
    ok('savePlan cannot re-save after calendar failure', (await values()).transactions.filter(t => t.kind === 'plans').length === 1);

    await retry.click();
    await waitPending('calendar');
    v = await values();
    ok('retry only starts another calendar transaction', v.transactions.filter(t => t.kind === 'plans').length === 1 && v.transactions.filter(t => t.kind === 'calendar').length === 2, v);
    assert.deepEqual(v.transactions.filter(t => t.kind === 'calendar')[1].ids, firstIds);
    ok('retry preserves the exact calendar target IDs', true);
    ok('retry and continue cannot overlap a pending calendar confirmation', await retry.isDisabled() && await proceed.isDisabled());
    await page.evaluate(() => { window._duplicateCalendarRetry = builderRetryCalendar(); });
    ok('queued retry is deduplicated while pending', (await values()).transactions.filter(t => t.kind === 'calendar').length === 2);
    await release('succeed');
    await page.waitForFunction(() => !document.getElementById('screen-builder').classList.contains('active'));
    v = await values();
    ok('success publishes four confirmed dates and leaves exactly once', v.sessions === 4 && v.remoteSessions === 4 && v.leaves === 1 && v.onboard === 1, v);
    ok('new client plan returns to the clients screen', await page.locator('#screen-clients').evaluate(el => el.classList.contains('active')));
    ok('successful calendar retry still has exactly one plan write', v.commits.filter(c => c.kind === 'plans').length === 1 && v.commits.filter(c => c.kind === 'calendar').length === 4, v);

    await reset({ edit: true, holdCalendar: true });
    await fill('Plan po edycji');
    await page.locator('#b-duration').selectOption('8');
    await save.click();
    await waitPending('calendar');
    v = await values();
    ok('edited eight-week plan requests eight calendar dates', v.transactions.find(t => t.kind === 'calendar').ids.length === 8, v);
    await release('fail');
    await proceed.waitFor({ state: 'visible' });
    const failedEdit = await values();
    await proceed.click();
    await page.waitForFunction(() => !document.getElementById('screen-builder').classList.contains('active'));
    v = await values();
    ok('continue leaves the saved plan intact without retrying either write', v.remotePlans === 1 && v.remoteSessions === 0 && v.transactions.length === failedEdit.transactions.length && v.queries === failedEdit.queries && v.leaves === 1, v);
    ok('edit returns to the original client plan tab', await page.evaluate(() => window.cpClientId === window._builderCalendarUi.clientId && document.getElementById('screen-clients').classList.contains('active') && document.getElementById('cp-body').textContent.includes('Plan po edycji')));
    ok('edit preserves plan identity and custom fields', await page.evaluate(() => window.PL[0].id === 'existing-plan' && window.PL[0].customMetadata.preserve === true));

    await reset({ library: true });
    ok('fresh builder does not inherit previous calendar retry actions', await page.locator('#builder-calendar-actions').evaluate(el => el.hidden) && !(await status.isVisible()));
    await fill('Plan do biblioteki');
    await save.click();
    await page.waitForFunction(() => !document.getElementById('screen-builder').classList.contains('active'));
    v = await values();
    ok('library plan skips client calendar and returns to library', v.remotePlans === 1 && v.queries === 0 && v.transactions.length === 1 && await page.locator('#screen-plans').evaluate(el => el.classList.contains('active')), v);

    await reset({ rest: true });
    await fill('Plan regeneracyjny', true);
    await save.click();
    await page.waitForFunction(() => !document.getElementById('screen-builder').classList.contains('active'));
    v = await values();
    ok('rest-only plan is saved without creating calendar appointments', v.remotePlans === 1 && v.queries === 0 && v.sessions === 0 && v.transactions.length === 1, v);

    await reset({ holdCalendar: true });
    await fill('Plan przed zmianą ekranu');
    await save.click();
    await waitPending('calendar');
    await page.locator('#screen-builder .topbar button[onclick="builderGoBack()"]') .click();
    const afterBack = await values();
    ok('trainer can leave while calendar confirmation is pending', !(await activeBuilder()));
    await page.evaluate(() => {
      const f = window._builderCalendarUi;
      f.oldCalendar = f.pending;
      f.pending = null;
      f.holdPlans = true;
      openBuilderForClient(window._builderCalendarUi.clientId);
      addDay(); addRow(document.querySelector('.builder-day').id);
    });
    await fill('Nowy niezapisany szkic');
    await save.click();
    await waitPending('plans');
    await page.evaluate(() => window._builderCalendarUi.oldCalendar.succeed());
    await page.waitForTimeout(100);
    v = await values();
    ok('late calendar result never navigates away from a newer builder', await activeBuilder() && v.leaves === afterBack.leaves, v);
    ok('late calendar result cannot unlock a newer pending plan save', await page.locator('#b-name').inputValue() === 'Nowy niezapisany szkic' && await page.locator('#b-name').isDisabled() && await save.isDisabled() && /Zapisywanie planu/.test(await status.innerText()) && !(await page.locator('#builder-calendar-actions').isVisible()));
    await release('fail');
    await page.waitForFunction(() => !document.getElementById('b-save-btn').disabled);
    ok('new plan failure retains its own draft and retry instead of old calendar status', await page.locator('#b-name').inputValue() === 'Nowy niezapisany szkic' && await save.innerText() === 'Ponów zapis' && !(await page.locator('#builder-calendar-actions').isVisible()));

    await reset({ holdCalendar: true });
    await fill('Plan poprzedniej sesji');
    await save.click();
    await waitPending('calendar');
    await page.evaluate(() => {
      window._uid = 'different-ui-owner';
      window.tenantSessionGeneration++;
      resetTenantRuntimeData();
      window._tenantDataReady = true;
      goTo('builder');
      document.getElementById('b-name').value = 'Szkic nowego konta';
    });
    await release('succeed');
    await page.waitForTimeout(100);
    ok('old account completion does not leak plan or dates into the new account', await page.evaluate(() => window.PL.length === 0 && window.SE.length === 0));
    ok('old account completion cannot overwrite or close the new draft', await activeBuilder() && await page.locator('#b-name').inputValue() === 'Szkic nowego konta' && await save.isEnabled() && !(await status.isVisible()));
    ok('all writes use the confirmed transaction paths', await page.evaluate(() => window._builderCalendarUi.unexpected.length === 0));
    ok('UI fixture never contacts a live Firestore database', liveRequests === 0, liveRequests);
    console.log('\n' + passed + ' builder/calendar confirmation UI checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
