'use strict';

// Real baseline helper/service against an in-memory Firestore transaction model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function section(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'bounded production block: ' + start);
  return text.slice(a, b);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const docs = new Map(), commits = [], transactions = [], modes = [], unexpected = [];
  const owner = 'trainer-a';
  const initial = { id: 'client-a', trainerId: owner, name: 'Klient A', status: 'active', goal: 'masa', custom: { keep: true } };
  docs.set('clients/client-a', clone(initial));
  docs.set('clients/client-b', { id: 'client-b', trainerId: owner, name: 'Klient B', status: 'active' });
  docs.set('clients/foreign', { id: 'foreign', trainerId: 'trainer-b', status: 'active' });
  let sequence = 0, serial = Promise.resolve();
  const ctx = {
    window: null, Promise, Map, Set, Date,
    console: { log() {}, warn() {}, error() {} },
    _db: {}, _uid: owner, tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false,
    CL: [clone(initial), clone(docs.get('clients/client-b'))], METRIC_ENTRIES: [],
    todayYmd: () => '2026-09-28',
    newId: prefix => prefix + '-' + (++sequence),
    withTrainer: entry => ({ ...entry, trainerId: ctx._uid }),
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    tenantSessionIsCurrent: auth => !!auth && auth.uid === ctx._uid && auth.generation === ctx.tenantSessionGeneration,
    persistById: (...args) => { unexpected.push(['persistById', ...clone(args)]); throw Error('No optimistic persistence'); },
    _setDoc: (...args) => { unexpected.push(['setDoc', ...clone(args)]); throw Error('No direct write'); },
    _doc: (_db, collection, id) => ({ collection, id, path: collection + '/' + id })
  };
  ctx.window = ctx;
  ctx._runTransaction = (_db, callback) => {
    const mode = modes.shift() || {};
    const work = async () => {
      const writes = [], reads = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'transaction reads must precede writes');
          reads.push(ref.path);
          const value = clone(docs.get(ref.path));
          return { id: ref.id, exists: () => value !== undefined, data: () => clone(value) };
        },
        set: (ref, value, options = {}) => writes.push({ path: ref.path, method: 'set', value: clone(value), options }),
        update: (ref, value) => writes.push({ path: ref.path, method: 'update', value: clone(value), options: { merge: true } }),
        delete: ref => { unexpected.push(['delete', ref.path]); throw Error('Baseline cannot delete records'); }
      };
      const result = await callback(tx);
      transactions.push({ reads, writes: clone(writes) });
      if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
      if (mode.before) throw Error('Before commit: simulated outage');
      for (const write of writes) {
        docs.set(write.path, write.options.merge ? { ...docs.get(write.path), ...write.value } : write.value);
        commits.push(clone(write));
      }
      if (mode.after) throw Error('After commit: lost acknowledgement');
      return result;
    };
    const result = serial.then(work);
    serial = result.catch(() => {});
    return result;
  };
  vm.createContext(ctx);
  vm.runInContext(section(source, 'const confirmedBaselineWrites=', '/** Zapis baseline'), ctx);
  function gate() { const g = { entered: deferred(), release: deferred() }; modes.push({ gate: g }); return g; }
  const remoteMetrics = () => [...docs.entries()].filter(([key]) => key.startsWith('metricEntries/')).map(([key, value]) => [key, clone(value)]);
  return { ctx, docs, commits, transactions, modes, unexpected, gate, remoteMetrics, initial };
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const fields = () => ({ date: '2026-09-28', weight: '81.2', bf: '18.5', circ: { m1: '101', m14: '88.5' }, notes: 'Pomiar startowy' });
function checkAtomicWrite(f, count = 2) {
  assert.equal(f.remoteMetrics().length, count);
  const tx = f.transactions.at(-1);
  assert.deepEqual(tx.reads, ['clients/client-a'], 'first attempt reads fresh client only');
  assert.equal(tx.writes.length, count + 1);
  assert.equal(tx.writes.filter(w => w.path === 'clients/client-a').length, 1);
  assert.equal(f.unexpected.length, 0);
  const after = f.docs.get('clients/client-a');
  assert.equal(after.baselineDone, true);
  assert.equal(after.baselineAt, fields().date);
  assert.equal(after.weight, 81.2);
  assert.ok(after.baselineWriteId);
  assert.equal(after.goal, f.initial.goal);
  assert.deepEqual(after.custom, f.initial.custom);
  for (const [, record] of f.remoteMetrics()) {
    assert.equal(record.trainerId, 'trainer-a');
    assert.equal(record.clientId, 'client-a');
    assert.equal(record.date, fields().date);
  }
}

test('helper builds two validated metric groups without writing', () => {
  const f = fixture();
  const entries = clone(f.ctx.buildClientBaselineEntries('client-a', fields(), 'trainer-a'));
  assert.deepEqual(entries.map(e => e.groupId), ['mg1', 'mg2']);
  assert.deepEqual(entries[0].values, { m1: 81.2, m2: 18.5 });
  assert.deepEqual(entries[1].values, { m1: 101, m14: 88.5 });
  assert.equal(f.commits.length, 0);
  assert.equal(f.ctx.METRIC_ENTRIES.length, 0);
});

test('pending write leaves local state and remote records untouched until acknowledgement', async () => {
  const f = fixture(), gate = f.gate(), beforeClient = clone(f.ctx.CL), op = {};
  const first = f.ctx.saveClientBaselineConfirmed('client-a', fields(), op);
  await gate.entered.promise;
  const second = f.ctx.saveClientBaselineConfirmed('client-a', fields(), op);
  assert.ok(op.promise, 'same operation keeps the active promise');
  assert.deepEqual(clone(f.ctx.CL), beforeClient);
  assert.equal(f.ctx.METRIC_ENTRIES.length, 0);
  assert.equal(f.remoteMetrics().length, 0);
  assert.equal(f.transactions.length, 1);
  gate.release.resolve();
  const result = clone(await first);
  assert.deepEqual(clone(await second), result);
  assert.equal(result.length, 2);
  checkAtomicWrite(f);
  assert.equal(f.ctx.METRIC_ENTRIES.length, 2);
  assert.equal(f.ctx.CL[0].baselineDone, true);
});

test('failure before commit rejects and exact retry uses same metric ids', async () => {
  const f = fixture(), op = {}, before = clone(f.ctx.CL), input = fields();
  f.modes.push({ before: true });
  await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', input, op));
  const ids = f.transactions[0].writes.filter(w => w.path.startsWith('metricEntries/')).map(w => w.path);
  const firstWrites = clone(f.transactions[0].writes);
  assert.equal(f.commits.length, 0);
  assert.deepEqual(clone(f.ctx.CL), before);
  assert.equal(f.ctx.METRIC_ENTRIES.length, 0);
  input.weight = '200'; input.date = '2026-10-02'; input.circ.m1 = '150';
  await f.ctx.saveClientBaselineConfirmed('client-a', input, op);
  assert.deepEqual(f.transactions[1].writes.filter(w => w.path.startsWith('metricEntries/')).map(w => w.path), ids);
  assert.deepEqual(f.transactions[1].writes, firstWrites, 'retry keeps the frozen candidate');
  checkAtomicWrite(f);
});

test('automatic same-input retry retains the original ids without an explicit operation', async () => {
  const f = fixture();
  f.modes.push({ before: true });
  await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', fields()));
  const first = clone(f.transactions[0].writes);
  await f.ctx.saveClientBaselineConfirmed('client-a', fields());
  assert.deepEqual(f.transactions[1].writes, first);
  assert.equal(f.remoteMetrics().length, 2);
  assert.equal(f.commits.length, 3);
});

test('lost acknowledgement reads exact receipt records and preserves later edits', async () => {
  const f = fixture(), op = {};
  f.modes.push({ after: true });
  await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', fields(), op));
  const ids = f.remoteMetrics().map(([key]) => key);
  assert.equal(ids.length, 2);
  assert.equal(f.ctx.METRIC_ENTRIES.length, 0);
  assert.equal(f.ctx.CL[0].baselineDone, undefined);
  const edited = f.docs.get(ids[0]); edited.values.m1 = 79; edited.notes = 'Późniejsza korekta';
  const before = clone(f.remoteMetrics());
  const result = clone(await f.ctx.saveClientBaselineConfirmed('client-a', fields(), op));
  assert.deepEqual(f.remoteMetrics(), before);
  assert.equal(f.commits.length, 3, 'receipt replay does not write');
  assert.equal(f.transactions[1].writes.length, 0);
  assert.ok(ids.every(id => f.transactions[1].reads.includes(id)));
  assert.equal(result.find(e => e.id === edited.id).values.m1, 79);
  assert.equal(f.ctx.METRIC_ENTRIES.find(e => e.id === edited.id).values.m1, 79);
});

test('different receipt after failed attempt rejects instead of replaying duplicate metrics', async () => {
  const f = fixture(), op = {};
  f.modes.push({ before: true });
  await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', fields(), op));
  f.docs.get('clients/client-a').baselineWriteId = 'other-operation';
  await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', fields(), op));
  assert.equal(f.commits.length, 0);
  assert.equal(f.remoteMetrics().length, 0);
  assert.equal(f.ctx.METRIC_ENTRIES.length, 0);
});

test('fresh server ownership and archive state stop a stale local client', async () => {
  for (const patch of [{ trainerId: 'trainer-b' }, { status: 'archived' }, { archived: true }]) {
    const f = fixture(); Object.assign(f.docs.get('clients/client-a'), patch);
    await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', fields(), {}));
    assert.equal(f.commits.length, 0);
    assert.equal(f.remoteMetrics().length, 0);
  }
});

test('trainer session gates reject before any transaction', async () => {
  for (const change of [
    f => { f.ctx._uid = null; },
    f => { f.ctx._clientAppMode = true; },
    f => { f.ctx._clientPreviewMode = true; },
    f => { f.ctx._tenantDataReady = false; },
    f => { f.ctx.CL[0].archived = true; }
  ]) {
    const f = fixture(); change(f);
    await assert.rejects(f.ctx.saveClientBaselineConfirmed('client-a', fields(), {}));
    assert.equal(f.transactions.length, 0);
    assert.equal(f.commits.length, 0);
  }
});

test('auth generation change while awaiting commit cannot update next account local data', async () => {
  const f = fixture(), gate = f.gate();
  const saving = f.ctx.saveClientBaselineConfirmed('client-a', fields(), {});
  await gate.entered.promise;
  f.ctx.tenantSessionGeneration++;
  f.ctx.CL = [{ id: 'next-account', trainerId: 'trainer-b' }];
  f.ctx.METRIC_ENTRIES = [{ id: 'next-metric', trainerId: 'trainer-b' }];
  gate.release.resolve();
  await assert.rejects(saving);
  assert.deepEqual(clone(f.ctx.CL), [{ id: 'next-account', trainerId: 'trainer-b' }]);
  assert.deepEqual(clone(f.ctx.METRIC_ENTRIES), [{ id: 'next-metric', trainerId: 'trainer-b' }]);
});

test('empty baseline performs no write or completion flag', async () => {
  const f = fixture();
  assert.deepEqual(clone(await f.ctx.saveClientBaselineConfirmed('client-a', { date: '2026-09-28' }, {})), []);
  assert.equal(f.transactions.length, 0);
  assert.equal(f.ctx.CL[0].baselineDone, undefined);
  assert.equal(f.docs.get('clients/client-a').baselineDone, undefined);
});

test('invalid date and measurement values reject before a transaction', async () => {
  const invalid = [
    { date: '2026-02-30', weight: '80' }, { date: '2026-13-01', weight: '80' },
    { date: '2026-09-28', weight: '0' }, { date: '2026-09-28', weight: '-2' },
    { date: '2026-09-28', weight: 'Infinity' }, { date: '2026-09-28', bf: '101' },
    { date: '2026-09-28', weight: 'NaN' }, { date: '2026-09-28', bf: 'Infinity' },
    { date: '2026-09-28', bf: '-1' }, { date: '2026-09-28', bmi: '0' },
    { date: '2026-09-28', muscleMass: '-2' }, { date: '2026-09-28', circ: { m1: '0' } },
    { date: '2026-09-28', circ: { m1: '-1' } }, { date: '2026-02-29', circ: { m1: '100' } }
  ];
  for (const input of invalid) {
    const f = fixture();
    await assert.rejects(Promise.resolve().then(() => f.ctx.saveClientBaselineConfirmed('client-a', input, {})), JSON.stringify(input));
    assert.equal(f.transactions.length, 0);
    assert.equal(f.ctx.METRIC_ENTRIES.length, 0);
  }
});

function pipelineFixture() {
  const f = fixture(), events = [];
  const ctx = f.ctx;
  ctx.clientEmailValid = () => true;
  ctx.PLAN_TEMPLATES = [{ id: 'starter-template', name: 'Plan startowy', weeks: 4,
    days_detail: [{ name: 'PON', exercises: [{ n: 'Przysiad', s: 3, r: 8 }] }] }];
  ctx.PL = [];
  ctx.clientHasAssignedPlan = () => false;
  ctx.clientHasCalendarOrSession = () => false;
  ctx.normalizePreferredWeekdays = () => [1];
  ctx.persistById = async (collection, value) => {
    events.push(collection);
    assert.equal(collection, 'plans', 'pipeline fixture skips initial client write');
    return clone(value);
  };
  ctx.refillCalendarConfirmed = async (clientId, opts) => {
    events.push('calendar');
    assert.equal(clientId, 'client-a');
    assert.ok(opts.planId);
    return { status: 'saved', added: 4 };
  };
  vm.runInContext(section(coreSource, 'const assignedClientPlanWrites=', '/** Status startu współpracy'), ctx);
  const client = ctx.CL[0];
  const options = baseline => ({ baseline, templateId: 'starter-template', persist: false,
    runFlow: false, notify: false, fireEvent: false, schedule: true });
  return { ...f, events, client, options };
}

test('pipeline waits for confirmed measurements before creating plan or calendar dates', async () => {
  const f = pipelineFixture(), gate = f.gate();
  const result = f.ctx.assignClientPipeline(f.client, f.options(fields()));
  await gate.entered.promise;
  assert.deepEqual(f.events, []);
  assert.equal(f.ctx.PL.length, 0);
  assert.equal(f.remoteMetrics().length, 0);
  gate.release.resolve();
  const completed = clone(await result);
  assert.equal(completed.ok, true);
  assert.deepEqual(completed.parts, ['karta', 'pomiary', 'plan', 'kalendarz']);
  assert.deepEqual(f.events, ['plans', 'calendar']);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.remoteMetrics().length, 2);
});

test('baseline rejection stops downstream plan and calendar work', async () => {
  const f = pipelineFixture();
  f.modes.push({ before: true });
  const result = clone(await f.ctx.assignClientPipeline(f.client, f.options(fields())));
  assert.equal(result.ok, false);
  assert.deepEqual(result.parts, ['karta']);
  assert.deepEqual(f.events, []);
  assert.equal(f.ctx.PL.length, 0);
  assert.equal(f.remoteMetrics().length, 0);
});

test('empty baseline adds no completion part yet allows downstream plan and calendar', async () => {
  const f = pipelineFixture();
  const result = clone(await f.ctx.assignClientPipeline(f.client, f.options({ date: '2026-09-28' })));
  assert.equal(result.ok, true);
  assert.deepEqual(result.parts, ['karta', 'plan', 'kalendarz']);
  assert.deepEqual(f.events, ['plans', 'calendar']);
  assert.equal(f.transactions.length, 0);
  assert.equal(f.ctx.CL[0].baselineDone, undefined);
});

(async () => {
  for (const { name, run } of tests) {
    await run();
    console.log('OK ' + name);
  }
  console.log('\n' + tests.length + ' baseline confirmation checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
