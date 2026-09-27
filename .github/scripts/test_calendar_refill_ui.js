// UI: manual calendar refill waits for confirmation, preserves sessions and supports retry.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const shotDir = process.env.CALENDAR_REFILL_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('node:os').tmpdir(), 'pl-calendar-refill'));
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
    let liveRequests = 0;
    await page.route('**://firestore.googleapis.com/**', route => { liveRequests++; return route.abort(); });
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.refillCalendarConfirmed === 'function' && typeof window.renderCalendarRefillState === 'function');
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      const clone = value => JSON.parse(JSON.stringify(value));
      const owner = 'calendar-refill-ui-owner', clientId = 'calendar-refill-ui-client', planId = 'calendar-refill-ui-plan';
      window._uid = owner;
      window.tenantSessionGeneration = 1;
      window._tenantDataReady = true;
      window._clientAppMode = false;
      window._clientPreviewMode = false;
      window._db = { fixture: true };
      const fixture = window._calendarRefillUi = {
        owner, clientId, planId, docs: {}, queries: [], transactions: 0, commits: 0,
        stagedIds: [], unexpectedWrites: [], notifications: [], pendingCommit: null, hold: true
      };
      const key = ref => ref.collection + '/' + ref.id;
      const snap = ref => ({
        id: ref.id, ref, exists: () => Object.prototype.hasOwnProperty.call(fixture.docs, key(ref)),
        data: () => clone(fixture.docs[key(ref)])
      });
      window._doc = (_db, collection, id) => ({ collection, id });
      window._col = (_db, collection) => ({ collection });
      window._where = (field, op, value) => ({ field, op, value });
      window._query = (ref, ...filters) => ({ ...ref, filters });
      window._getDoc = async ref => snap(ref);
      window._get = async query => {
        fixture.queries.push(clone(query));
        if (!['sessions', 'packages'].includes(query.collection)) throw new Error('Unexpected fixture collection ' + query.collection);
        const filters = query.filters || [];
        if (!filters.some(f => f.field === 'trainerId' && f.op === '==' && f.value === owner)) throw new Error('Missing trainer scope');
        if (!filters.some(f => f.field === 'clientId' && f.op === '==' && f.value === clientId)) throw new Error('Missing client scope');
        const rows = Object.entries(fixture.docs)
          .filter(([id, data]) => id.startsWith(query.collection + '/') && filters.every(f => f.op === '==' && data[f.field] === f.value))
          .map(([id]) => snap({ collection: query.collection, id: id.slice(query.collection.length + 1) }));
        return { docs: rows, empty: rows.length === 0, size: rows.length, forEach: callback => rows.forEach(callback) };
      };
      window._runTransaction = async (_db, callback) => {
        fixture.transactions++;
        const writes = [];
        const result = await callback({
          get: async ref => snap(ref),
          set: (ref, value, options) => writes.push({ ref, value: clone(value), options }),
          delete: ref => { fixture.unexpectedWrites.push({ delete: ref }); throw new Error('Refill must not delete'); }
        });
        fixture.stagedIds.push(writes.map(write => key(write.ref)).sort());
        const commit = () => {
          writes.forEach(write => {
            if (write.ref.collection !== 'sessions') throw new Error('Refill must not write ' + write.ref.collection);
            fixture.docs[key(write.ref)] = write.options && write.options.merge ? { ...(fixture.docs[key(write.ref)] || {}), ...write.value } : write.value;
          });
          fixture.commits++;
          return result;
        };
        if (!fixture.hold) return commit();
        return new Promise((resolve, reject) => {
          fixture.pendingCommit = {
            succeed: () => { fixture.pendingCommit = null; resolve(commit()); },
            fail: () => { fixture.pendingCommit = null; reject(Object.assign(new Error('Fixture connection interrupted'), { code: 'unavailable' })); }
          };
        });
      };
      window._setDoc = async (...args) => { fixture.unexpectedWrites.push({ setDoc: args }); throw new Error('Unexpected unconfirmed write'); };
      window._del = async (...args) => { fixture.unexpectedWrites.push({ deleteDoc: args }); throw new Error('Unexpected delete'); };
      window.persistById = async (collection, data) => { fixture.unexpectedWrites.push({ persistById: collection, id: data && data.id }); return null; };
      window.notify = message => fixture.notifications.push(String(message));
      window.CL = [{ id: clientId, trainerId: owner, name: 'Klient testowy', status: 'active', accessMode: 'trial', preferredWeekdays: [1] }];
      window.PL = [];
      window.SE = [];
      window.PACKAGES = [];
      window.TASKS = [];
      window.CHECKINS = {};
      window.PROGRESS_PHOTOS = [];
      window._afStateReady = false;
      fixture.docs['clients/' + clientId] = clone(window.CL[0]);
      fixture.plan = { id: planId, trainerId: owner, clientId, name: 'Plan testowy', days: [{ day: 'Poniedziałek', weekday: 1, exercises: [{ name: 'Przysiad', sets: 3, reps: '8' }] }] };
      ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('app-root').style.display = '';
      openClientProfile(clientId);
      setCPTab('training');
    });

    const button = page.locator('[data-calendar-refill-client="calendar-refill-ui-client"]');
    const status = page.locator('[data-calendar-refill-status="calendar-refill-ui-client"]');
    ok('no refill action without a usable plan', await button.count() === 0);
    await page.evaluate(() => {
      window.PL = [{ ...window._calendarRefillUi.plan, days: [{ rest: true }, { weekday: 1, exercises: [] }] }];
      renderCPTraining(window.CL[0]);
    });
    ok('no refill action for rest-only or empty training days', await button.count() === 0);
    await page.evaluate(() => {
      const f = window._calendarRefillUi;
      window.PL = [JSON.parse(JSON.stringify(f.plan))];
      f.docs['plans/' + f.planId] = JSON.parse(JSON.stringify(f.plan));
      renderCPTraining(window.CL[0]);
    });
    ok('refill available when the calendar is empty', await button.isVisible() && await button.innerText() === 'Dopełnij 4 tygodnie');
    ok('refill status is an accessible live region', await status.getAttribute('role') === 'status' && await status.getAttribute('aria-live') === 'polite');

    const original = await page.evaluate(() => {
      const f = window._calendarRefillUi;
      const base = { clientId: f.clientId, trainerId: f.owner, source: 'planned', planId: f.planId, dayIdx: 0, time: '18:00', duration: 60 };
      window.SE = [
        { ...base, id: 'legacy-skipped', date: '2026-09-28', type: 'Termin opuszczony', skipped: true, status: 'opuszczony' },
        { ...base, id: 'legacy-moved', date: '2026-10-06', type: 'Termin przesunięty ręcznie' },
        { ...base, id: 'legacy-distant', date: '2026-12-28', type: 'Odległy termin' }
      ];
      window.SE.forEach(session => { f.docs['sessions/' + session.id] = JSON.parse(JSON.stringify(session)); });
      const before = JSON.stringify(window.SE);
      renderCPOverview(window.CL[0]);
      renderCPTraining(window.CL[0]);
      return before;
    });
    const afterRender = await page.evaluate(() => ({ sessions: JSON.stringify(window.SE), writes: window._calendarRefillUi.unexpectedWrites }));
    ok('rendering overview and training preserves manually moved dates without writes', afterRender.sessions === original && afterRender.writes.length === 0, afterRender);

    await button.click();
    await page.waitForFunction(() => !!window._calendarRefillUi.pendingCommit);
    ok('refill button stays disabled until confirmation', await button.isDisabled() && /Zapisywanie/.test(await button.innerText()));
    ok('pending status is visible beside the calendar', await status.isVisible() && /zapis|sprawdz|potwierdz|oczek/i.test(await status.innerText()));
    const pending = await page.evaluate(() => ({ sessions: JSON.stringify(window.SE), commits: window._calendarRefillUi.commits, writes: window._calendarRefillUi.unexpectedWrites }));
    ok('no optimistic calendar change before acknowledgement', pending.sessions === original && pending.commits === 0 && pending.writes.length === 0, pending);
    await page.evaluate(() => renderCPTraining(window.CL[0]));
    ok('rerender preserves disabled state and pending status', await button.isDisabled() && /zapis|sprawdz|potwierdz|oczek/i.test(await status.innerText()));
    await page.evaluate(() => window._calendarRefillUi.pendingCommit.fail());
    await page.waitForFunction(() => document.querySelector('[data-calendar-refill-client]')?.textContent.trim() === 'Ponów dopełnienie');
    ok('failed commit shows an enabled retry action', await button.isEnabled() && await status.isVisible() && /nie|błąd|ponów/i.test(await status.innerText()));
    const failed = await page.evaluate(() => ({ sessions: JSON.stringify(window.SE), commits: window._calendarRefillUi.commits }));
    ok('failed commit preserves every existing session', failed.sessions === original && failed.commits === 0, failed);

    await button.click();
    await page.waitForFunction(() => !!window._calendarRefillUi.pendingCommit);
    const retryIds = await page.evaluate(() => window._calendarRefillUi.stagedIds);
    ok('retry reuses the original occurrence IDs', retryIds.length === 2 && retryIds[0].length > 0 && JSON.stringify(retryIds[0]) === JSON.stringify(retryIds[1]), retryIds);
    await page.evaluate(() => window._calendarRefillUi.pendingCommit.succeed());
    await page.waitForFunction(() => !document.querySelector('[data-calendar-refill-client]')?.disabled && document.querySelector('[data-calendar-refill-client]')?.textContent.trim() === 'Dopełnij 4 tygodnie');
    const saved = await page.evaluate(() => {
      const f = window._calendarRefillUi;
      return { sessions: window.SE, commits: f.commits, unexpectedWrites: f.unexpectedWrites, remote: Object.values(f.docs).filter(d => d.source === 'planned'), status: document.querySelector('[data-calendar-refill-status]').innerText };
    });
    ok('successful retry publishes confirmed sessions once', saved.commits === 1 && saved.sessions.length > 3 && new Set(saved.sessions.map(s => s.id)).size === saved.sessions.length, saved);
    const preserved = saved.sessions.filter(s => s.id.startsWith('legacy-')).map(({ _fbId, ...data }) => data);
    ok('refill preserves skipped, moved and distant session data', JSON.stringify(preserved) === original);
    ok('success is visible only after confirmed commit', /dodano|zapisano|dopełniono|uzupełniono/i.test(saved.status), saved.status);
    ok('refill uses no destructive or unconfirmed writes', saved.unexpectedWrites.length === 0, saved.unexpectedWrites);
    await page.screenshot({ path: path.join(shotDir, 'calendar_refill_confirmed.png') });

    await page.evaluate(() => { window._calendarRefillUi.hold = false; });
    await button.click();
    await page.waitForFunction(() => !document.querySelector('[data-calendar-refill-client]')?.disabled);
    const repeated = await page.evaluate(() => ({ ids: window.SE.map(s => s.id).sort(), status: document.querySelector('[data-calendar-refill-status]').innerText }));
    ok('repeated refill does not duplicate calendar sessions', JSON.stringify(repeated.ids) === JSON.stringify(saved.sessions.map(s => s.id).sort()), repeated);
    ok('repeated refill reports that existing dates were preserved', /brak|już|zachowan|uzupełniony/i.test(repeated.status), repeated.status);

    const beforeBlocked = await page.evaluate(() => {
      // Reset only this in-memory fixture to exercise the real payment gate for missing dates.
      const f = window._calendarRefillUi;
      Object.keys(f.docs).filter(id => id.startsWith('sessions/calfill_')).forEach(id => { delete f.docs[id]; });
      window.SE = window.SE.filter(s => s.id.startsWith('legacy-'));
      window.CL[0].accessMode = 'standard';
      f.docs['clients/' + f.clientId].accessMode = 'standard';
      const pkg = { id: 'fixture-unpaid', trainerId: f.owner, clientId: f.clientId, title: 'Pakiet testowy', payStatus: 'pending', sessions: 10, sessionsUsed: 0 };
      window.PACKAGES = [pkg];
      f.docs['packages/' + pkg.id] = JSON.parse(JSON.stringify(pkg));
      renderCPTraining(window.CL[0]);
      return { sessions: JSON.stringify(window.SE), commits: f.commits };
    });
    await button.click();
    await page.waitForFunction(() => document.querySelector('[data-calendar-refill-client]')?.textContent.trim() === 'Ponów dopełnienie');
    const blocked = await page.evaluate(() => ({ sessions: JSON.stringify(window.SE), commits: window._calendarRefillUi.commits, status: document.querySelector('[data-calendar-refill-status]').innerText }));
    ok('unpaid package blocks missing calendar dates without a commit', blocked.sessions === beforeBlocked.sessions && blocked.commits === beforeBlocked.commits && /pakiet|płatno/i.test(blocked.status), blocked);
    await page.evaluate(() => {
      const f = window._calendarRefillUi;
      window.CL[0].accessMode = 'trial';
      f.docs['clients/' + f.clientId].accessMode = 'trial';
    });
    await button.click();
    await page.waitForFunction(() => !document.querySelector('[data-calendar-refill-client]')?.disabled && document.querySelector('[data-calendar-refill-client]')?.textContent.trim() === 'Dopełnij 4 tygodnie');
    const trial = await page.evaluate(() => ({ sessions: window.SE.length, commits: window._calendarRefillUi.commits, writes: window._calendarRefillUi.unexpectedWrites }));
    ok('confirmed Trial access permits the pending refill', trial.commits === beforeBlocked.commits + 1 && trial.sessions > 3 && trial.writes.length === 0, trial);
    ok('test made no live Firestore requests', liveRequests === 0, liveRequests);
    console.log('\n' + passed + ' calendar-refill UI checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
