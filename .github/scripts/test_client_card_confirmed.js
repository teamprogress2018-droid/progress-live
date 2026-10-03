'use strict';

// Run the production service and session guards against independently controlled
// persistence acknowledgements. The fixture models storage, never save policy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'client-card-save.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const guardsStart = core.indexOf('function assignmentSession()');
const guardsEnd = core.indexOf('// Retry bookkeeping', guardsStart);
assert.ok(guardsStart >= 0 && guardsEnd > guardsStart, 'production assignment session guards exist');
const guards = core.slice(guardsStart, guardsEnd);
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function gate() { return { entered: deferred(), release: deferred() }; }
function snapshot(id, value) {
  const saved = clone(value);
  return { id, exists: () => saved !== undefined, data: () => clone(saved) };
}

function fixture() {
  const initial = { id: 'client-a', trainerId: 'trainer-a', status: 'active', name: 'Anna',
    email: 'anna@example.test', phone: '111', trainingFreq: 3, preferredWeekdays: [1, 3],
    notes: 'Historia klienta', custom: { keep: true }, baselineDone: true };
  const docs = new Map([['clients/client-a', clone(initial)]]);
  const calls = { persist: [], queries: [], transactions: [], commits: [], unexpected: [] };
  const modes = { persist: [], query: [], transaction: [] };
  let serial = Promise.resolve(), sequence = 0;
  const ctx = {
    window: null, console: { log() {}, warn() {}, error() {} }, Promise, Date, Map, Set,
    crypto: require('node:crypto').webcrypto,
    _db: {}, _uid: 'trainer-a', tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false, CL: [clone(initial)],
    newId: prefix => prefix + '-' + (++sequence),
    withTrainer: value => ({ ...value, trainerId: ctx._uid }),
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    tenantSessionIsCurrent: auth => !!auth && auth.uid === ctx._uid && auth.generation === ctx.tenantSessionGeneration,
    _doc: (_db, collection, id) => ({ collection, id, path: collection + '/' + id }),
    _col: (_db, collection) => ({ collection }),
    _where: (field, op, value) => ({ field, op, value }),
    _query: (collection, ...filters) => ({ ...collection, filters }),
    mapFbDoc: (doc, collection) => ({ ...doc.data(), id: doc.id, _fbId: doc.id }),
    _getDoc: () => { calls.unexpected.push('getDoc'); throw Error('Recovery must use an owner-scoped server query'); },
    _get: () => { calls.unexpected.push('get'); throw Error('Recovery cannot use cache'); },
    _setDoc: () => { calls.unexpected.push('setDoc'); throw Error('Unexpected direct write'); }
  };
  ctx.window = ctx;
  ctx.persistById = async (collection, value) => {
    const mode = modes.persist.shift() || {};
    const record = clone(value);
    calls.persist.push({ collection, value: record });
    if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
    if (mode.before) throw Error('Persistence failed before commit');
    if (mode.commit !== false) {
      const key = collection + '/' + (record._fbId || record.id);
      docs.set(key, { ...docs.get(key), ...record });
      calls.commits.push({ path: key, value: record, method: 'persist' });
    }
    if (mode.after) throw Error('Persistence acknowledgement lost');
    return mode.null ? null : clone(record);
  };
  ctx._getDocsFromServer = async query => {
    const mode = modes.query.shift() || {};
    calls.queries.push(clone(query));
    assert.equal(query.collection, 'clients');
    assert.ok(query.filters.some(f => f.field === 'trainerId' && f.op === '==' && f.value === ctx._uid),
      'recovery query is constrained to the authenticated owner');
    assert.ok(query.filters.some(f => f.field === 'id' && f.op === '==' && f.value === 'client-new'),
      'recovery query is constrained to the original client ID');
    if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
    if (mode.reject) throw Error('Server query unavailable');
    const rows = [...docs].filter(([key, value]) => key.startsWith(query.collection + '/') &&
      query.filters.every(f => f.op === '==' && value[f.field] === f.value))
      .map(([key, value]) => snapshot(key.split('/').at(-1), value));
    if (mode.extra) rows.push(snapshot(mode.extra.id, mode.extra.value));
    return { docs: rows, empty: rows.length === 0, size: rows.length, forEach: fn => rows.forEach(fn) };
  };
  ctx._runTransaction = (_db, callback) => {
    const mode = modes.transaction.shift() || {};
    const run = async () => {
      const reads = [], writes = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'transaction reads precede writes');
          reads.push(ref.path);
          if (mode.readGate) { mode.readGate.entered.resolve(); await mode.readGate.release.promise; }
          return snapshot(ref.id, docs.get(ref.path));
        },
        set: (ref, value, options = {}) => writes.push({ path: ref.path, method: 'set', value: clone(value), merge: !!options.merge }),
        update: (ref, value) => writes.push({ path: ref.path, method: 'update', value: clone(value), merge: true }),
        delete: () => { calls.unexpected.push('delete'); throw Error('Client-card save cannot delete records'); }
      };
      const result = await callback(tx);
      calls.transactions.push({ reads, writes: clone(writes) });
      if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
      if (mode.before) throw Error('Transaction failed before commit');
      for (const write of writes) {
        docs.set(write.path, write.merge ? { ...docs.get(write.path), ...write.value } : write.value);
        calls.commits.push(clone(write));
      }
      if (mode.after) throw Error('Transaction acknowledgement lost');
      return result;
    };
    const result = serial.then(run);
    serial = result.catch(() => {});
    return result;
  };
  vm.createContext(ctx);
  vm.runInContext(guards, ctx, { filename: '01-core-client-card-guards.js' });
  vm.runInContext(source, ctx, { filename: 'client-card-save.js' });
  assert.equal(typeof ctx.saveClientCardConfirmed, 'function', 'public confirmed-save service');
  const op = edit => ({ auth: ctx.assignmentSession(), edit: !!edit, base: edit ? clone(initial) : null });
  const create = () => ({ id: 'client-new', trainerId: 'trainer-a', status: 'active', name: 'Ewa',
    email: 'ewa@example.test', phone: '222', trainingFreq: null });
  const edit = changes => ({ ...clone(initial), ...changes });
  const switchSession = () => { ctx._uid = 'trainer-b'; ctx.tenantSessionGeneration++; ctx.CL = []; };
  return { ctx, docs, initial, calls, modes, op, create, edit, switchSession };
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
function localUnchanged(f, before = [f.initial]) {
  assert.deepEqual(clone(f.ctx.CL), clone(before), 'the service never applies an optimistic or confirmed local card');
  assert.deepEqual(f.calls.unexpected, []);
}
function onlyClient(f) { return [...f.docs.keys()].filter(key => key.startsWith('clients/client-new')); }

test('create waits for acknowledgement and coalesces duplicate submissions without touching CL', async () => {
  const f = fixture(), hold = gate(), operation = f.op(false), candidate = f.create();
  f.modes.persist.push({ gate: hold });
  const first = f.ctx.saveClientCardConfirmed(candidate, operation);
  const firstOutcome = Promise.resolve(first);
  await hold.entered.promise;
  const second = f.ctx.saveClientCardConfirmed(candidate, operation);
  assert.strictEqual(second, first, 'duplicate submit returns the in-flight promise');
  assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.commits.length, 0);
  assert.equal(f.docs.has('clients/client-new'), false); localUnchanged(f);
  hold.release.resolve();
  const saved = clone(await firstOutcome);
  assert.deepEqual(clone(await second), saved);
  assert.equal(saved.id, candidate.id); assert.equal(saved.name, 'Ewa');
  assert.ok(saved.clientCardWriteId, 'confirmed card carries its operation receipt');
  assert.deepEqual(onlyClient(f), ['clients/client-new']); localUnchanged(f);
});

test('create failure before commit retries the same frozen ID and receipt after server absence', async () => {
  const f = fixture(), operation = f.op(false), candidate = f.create();
  f.modes.persist.push({ before: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(candidate, operation));
  const submitted = clone(f.calls.persist[0].value);
  assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  candidate.id = 'different'; candidate.name = 'Changed while retrying';
  const saved = clone(await f.ctx.saveClientCardConfirmed(candidate, operation));
  assert.equal(f.calls.queries.length, 1, 'retry checks committed state on the server before writing');
  assert.deepEqual(f.calls.persist[1].value, submitted, 'retry preserves the original submission');
  assert.equal(saved.id, 'client-new'); assert.equal(saved.clientCardWriteId, submitted.clientCardWriteId);
  assert.equal(f.docs.has('clients/different'), false); assert.equal(onlyClient(f).length, 1); localUnchanged(f);
});

test('create lost acknowledgement recovers server card and preserves subsequent remote changes', async () => {
  const f = fixture(), operation = f.op(false), candidate = f.create();
  f.modes.persist.push({ after: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(candidate, operation));
  const remote = f.docs.get('clients/client-new');
  remote.name = 'Ewa po zmianie'; remote.phone = '999'; remote.notes = 'Inny edytor'; remote.custom = { newer: true };
  const originalCreateReceipt = remote.clientCardCreateId;
  assert.ok(originalCreateReceipt, 'create receipt survives later edits');
  remote.clientCardWriteId = 'a-later-edit-receipt';
  localUnchanged(f);
  const saved = clone(await f.ctx.saveClientCardConfirmed(candidate, operation));
  assert.equal(f.calls.persist.length, 1, 'matching receipt avoids a second write');
  assert.equal(f.calls.queries.length, 1); assert.equal(f.calls.commits.length, 1);
  assert.deepEqual(saved.custom, { newer: true }); assert.equal(saved.phone, '999'); assert.equal(saved.name, 'Ewa po zmianie');
  assert.equal(saved.clientCardCreateId, originalCreateReceipt); assert.equal(saved.clientCardWriteId, 'a-later-edit-receipt');
  assert.equal(saved.notes, 'Inny edytor'); localUnchanged(f);
});

test('null persistence result is unconfirmed and remains retryable', async () => {
  const f = fixture(), operation = f.op(false);
  f.modes.persist.push({ null: true, commit: false });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  assert.equal(f.docs.has('clients/client-new'), false); localUnchanged(f);
  const saved = await f.ctx.saveClientCardConfirmed(f.create(), operation);
  assert.equal(saved.id, 'client-new'); assert.equal(f.calls.persist.length, 2); localUnchanged(f);
});

test('failed recovery query prevents a retry write', async () => {
  const f = fixture(), operation = f.op(false);
  f.modes.persist.push({ before: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  f.modes.query.push({ reject: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.commits.length, 0); localUnchanged(f);
});

test('create recovery refuses a card with a different operation receipt', async () => {
  const f = fixture(), operation = f.op(false);
  f.modes.persist.push({ before: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  f.docs.set('clients/client-new', { ...f.create(), clientCardCreateId: 'someone-elses-save', clientCardWriteId: 'someone-elses-save', phone: 'remote' });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  assert.equal(f.calls.persist.length, 1); assert.equal(f.docs.get('clients/client-new').phone, 'remote'); localUnchanged(f);
});

test('edit reads current server card and patches only fields changed from the form base', async () => {
  const f = fixture(), operation = f.op(true), candidate = f.edit({ name: 'Anna Nowa' });
  f.docs.set('clients/client-a', { ...clone(f.initial), phone: 'remote-phone', notes: 'remote-notes',
    trainingFreq: 5, custom: { remote: true }, onboardingDone: true });
  const saved = clone(await f.ctx.saveClientCardConfirmed(candidate, operation));
  assert.equal(f.calls.persist.length, 0, 'edit uses an atomic transaction');
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.commits.length, 1);
  const write = f.calls.commits[0];
  assert.equal(write.path, 'clients/client-a'); assert.equal(write.merge, true);
  assert.equal(write.value.name, 'Anna Nowa');
  for (const field of ['phone', 'email', 'trainingFreq', 'notes', 'custom', 'baselineDone', 'onboardingDone']) {
    assert.equal(Object.hasOwn(write.value, field), false, 'unchanged field excluded: ' + field);
  }
  assert.equal(saved.name, 'Anna Nowa'); assert.equal(saved.phone, 'remote-phone'); assert.equal(saved.trainingFreq, 5);
  assert.equal(saved.notes, 'remote-notes'); assert.deepEqual(saved.custom, { remote: true });
  assert.equal(saved.onboardingDone, true); assert.equal(saved.baselineDone, true); localUnchanged(f);
});

test('profile status edit persists only active or inactive and retains unrelated server changes', async () => {
  const f = fixture();
  f.docs.get('clients/client-a').phone = 'server-phone';
  const saved = await f.ctx.saveClientCardConfirmed(f.edit({ status: 'inactive' }), f.op(true));
  assert.equal(saved.status, 'inactive'); assert.equal(saved.phone, 'server-phone');
  assert.deepEqual(Object.keys(f.calls.commits[0].value).sort(), ['clientCardWriteId', 'status']);
  localUnchanged(f);
  const operation = { auth: f.ctx.assignmentSession(), edit: true, base: clone(saved) };
  const active = await f.ctx.saveClientCardConfirmed({ ...saved, status: 'active' }, operation);
  assert.equal(active.status, 'active'); localUnchanged(f);
});

test('an unchanged form status preserves a newer server status', async () => {
  const f = fixture();
  f.docs.get('clients/client-a').status = 'inactive';
  const saved = await f.ctx.saveClientCardConfirmed(f.edit({ name: 'Anna Nowa' }), f.op(true));
  assert.equal(saved.status, 'inactive');
  assert.equal(Object.hasOwn(f.calls.commits[0].value, 'status'), false); localUnchanged(f);
});

test('concurrent profile status change raises a conflict without overwriting it', async () => {
  const f = fixture();
  f.docs.get('clients/client-a').status = 'paused';
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ status: 'inactive' }), f.op(true)),
    error => error.code === 'client-card-conflict' && error.remote.status === 'paused');
  assert.equal(f.calls.commits.length, 0); localUnchanged(f);
});

for (const status of ['archived', 'deleted', 'unknown', null, undefined]) {
  test('profile status save rejects unsupported transition: ' + String(status), async () => {
    const f = fixture();
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ status }), f.op(true)),
      error => error.code === 'client-card-status');
    assert.equal(f.calls.transactions.length, 0); assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  });
}

test('pending edit and duplicate submit leave local and remote cards untouched', async () => {
  const f = fixture(), operation = f.op(true), hold = gate(), candidate = f.edit({ phone: '333' });
  f.modes.transaction.push({ gate: hold });
  const first = f.ctx.saveClientCardConfirmed(candidate, operation);
  await hold.entered.promise;
  const second = f.ctx.saveClientCardConfirmed(candidate, operation);
  assert.strictEqual(second, first); assert.equal(f.calls.transactions.length, 1);
  assert.deepEqual(f.docs.get('clients/client-a'), f.initial); localUnchanged(f);
  hold.release.resolve();
  assert.equal((await first).phone, '333'); assert.equal((await second).phone, '333');
  assert.equal(f.calls.commits.length, 1); localUnchanged(f);
});

test('edit detects concurrent changes to the same field without overwriting remote data', async () => {
  const f = fixture();
  f.docs.get('clients/client-a').name = 'Remote Anna';
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ name: 'Form Anna' }), f.op(true)));
  assert.equal(f.calls.commits.length, 0); assert.equal(f.docs.get('clients/client-a').name, 'Remote Anna'); localUnchanged(f);
});

test('edit accepts a field already changed to the submitted value without erasing other changes', async () => {
  const f = fixture();
  Object.assign(f.docs.get('clients/client-a'), { phone: '333', name: 'Remote Anna' });
  const saved = await f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), f.op(true));
  assert.equal(saved.phone, '333'); assert.equal(saved.name, 'Remote Anna');
  assert.equal(Object.hasOwn(f.calls.commits[0].value, 'phone'), false); localUnchanged(f);
});

test('edit compares arrays by value and preserves fresh remote values of unchanged arrays', async () => {
  const f = fixture();
  f.docs.get('clients/client-a').preferredWeekdays = [2, 4, 6];
  const saved = clone(await f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), f.op(true)));
  assert.deepEqual(saved.preferredWeekdays, [2, 4, 6]);
  assert.equal(Object.hasOwn(f.calls.commits[0].value, 'preferredWeekdays'), false); localUnchanged(f);
  const g = fixture();
  g.docs.get('clients/client-a').preferredWeekdays = [2, 4];
  await assert.rejects(g.ctx.saveClientCardConfirmed(g.edit({ preferredWeekdays: [5] }), g.op(true)));
  assert.equal(g.calls.commits.length, 0); localUnchanged(g);
});

test('edit ignores stale onboarding fields outside the card form', async () => {
  const f = fixture();
  Object.assign(f.docs.get('clients/client-a'), { baselineDone: false, custom: { changed: true }, planAssigned: true });
  const saved = clone(await f.ctx.saveClientCardConfirmed(f.edit({ phone: '333', baselineDone: true,
    custom: { malicious: true }, planAssigned: false }), f.op(true)));
  assert.equal(saved.baselineDone, false); assert.equal(saved.planAssigned, true);
  assert.deepEqual(saved.custom, { changed: true }); localUnchanged(f);
});

test('explicit training frequency clearing writes null while preserving other remote fields', async () => {
  const f = fixture();
  f.docs.get('clients/client-a').phone = 'latest-phone';
  const saved = clone(await f.ctx.saveClientCardConfirmed(f.edit({ trainingFreq: null }), f.op(true)));
  assert.equal(saved.trainingFreq, null); assert.equal(f.docs.get('clients/client-a').trainingFreq, null);
  assert.equal(f.calls.commits[0].value.trainingFreq, null); assert.equal(saved.phone, 'latest-phone'); localUnchanged(f);
});

test('edit failure before commit retries the original field change without duplicating the write', async () => {
  const f = fixture(), operation = f.op(true), candidate = f.edit({ phone: '333' });
  f.modes.transaction.push({ before: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(candidate, operation));
  const firstWrite = clone(f.calls.transactions[0].writes[0]);
  candidate.phone = '444'; candidate.name = 'Later form'; operation.base.phone = 'corrupted';
  assert.deepEqual(f.docs.get('clients/client-a'), f.initial); localUnchanged(f);
  const saved = await f.ctx.saveClientCardConfirmed(candidate, operation);
  assert.equal(saved.phone, '333'); assert.equal(saved.name, 'Anna');
  assert.deepEqual(f.calls.transactions[1].writes[0], firstWrite);
  assert.equal(f.calls.commits.length, 1); localUnchanged(f);
});

test('edit lost acknowledgement recovers receipt without overwriting newer changes', async () => {
  const f = fixture(), operation = f.op(true), candidate = f.edit({ name: 'Submitted Anna', trainingFreq: null });
  f.modes.transaction.push({ after: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(candidate, operation));
  const receipt = f.docs.get('clients/client-a').clientCardWriteId;
  assert.ok(receipt); localUnchanged(f);
  f.docs.get('clients/client-a').name = 'More recent Anna';
  f.docs.get('clients/client-a').trainingFreq = 6;
  f.docs.get('clients/client-a').custom = { afterCommit: true };
  const saved = clone(await f.ctx.saveClientCardConfirmed(candidate, operation));
  assert.equal(saved.name, 'More recent Anna'); assert.equal(saved.trainingFreq, 6);
  assert.deepEqual(saved.custom, { afterCommit: true }); assert.equal(saved.clientCardWriteId, receipt);
  assert.equal(f.calls.commits.length, 1, 'receipt recovery performs no additional write'); localUnchanged(f);
});

for (const unavailable of [null, { trainerId: 'trainer-b' }, { status: 'archived' }, { archived: true }, { deleted: true }]) {
  test('edit rejects unavailable remote card: ' + JSON.stringify(unavailable), async () => {
    const f = fixture();
    if (unavailable === null) f.docs.delete('clients/client-a');
    else Object.assign(f.docs.get('clients/client-a'), unavailable);
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), f.op(true)));
    assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  });
}

test('edit addresses the stored Firestore ID independently of the logical client ID', async () => {
  const f = fixture(), base = { ...clone(f.initial), _fbId: 'stored-client-a' };
  f.docs.delete('clients/client-a'); f.docs.set('clients/stored-client-a', clone(f.initial)); f.ctx.CL = [clone(base)];
  const operation = { auth: f.ctx.assignmentSession(), edit: true, base };
  const saved = await f.ctx.saveClientCardConfirmed({ ...clone(base), phone: '333' }, operation);
  assert.equal(saved.id, 'client-a'); assert.equal(saved._fbId, 'stored-client-a');
  assert.equal(f.calls.commits[0].path, 'clients/stored-client-a'); localUnchanged(f, [base]);
});

test('edit rejects mismatched remote logical identity', async () => {
  const f = fixture(); f.docs.get('clients/client-a').id = 'client-b';
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), f.op(true)));
  assert.equal(f.calls.commits.length, 0); localUnchanged(f);
});

test('create refuses an existing local card before persistence', async () => {
  const f = fixture(), existing = { ...f.create(), phone: 'existing' };
  f.ctx.CL.push(existing);
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), f.op(false)));
  assert.equal(f.calls.persist.length, 0); localUnchanged(f, [f.initial, existing]);
});

test('create retry rejects ambiguous duplicate server records', async () => {
  const f = fixture(), operation = f.op(false);
  f.modes.persist.push({ after: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  f.docs.set('clients/duplicate', clone(f.docs.get('clients/client-new')));
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.commits.length, 1); localUnchanged(f);
});

for (const unavailable of [{ trainerId: 'trainer-b' }, { status: 'archived' }, { archived: true }, { deleted: true }]) {
  test('create recovery validates returned card availability: ' + JSON.stringify(unavailable), async () => {
    const f = fixture(), operation = f.op(false);
    f.modes.persist.push({ before: true });
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
    f.modes.query.push({ extra: { id: 'client-new', value: { ...f.create(), ...unavailable,
      clientCardCreateId: operation.clientCardWriteId, clientCardWriteId: operation.clientCardWriteId } } });
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
    assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  });
}

test('successful operation can be submitted again without repeating persistence', async () => {
  const f = fixture(), operation = f.op(false), candidate = f.create();
  const first = clone(await f.ctx.saveClientCardConfirmed(candidate, operation));
  candidate.name = 'Different';
  assert.deepEqual(clone(await f.ctx.saveClientCardConfirmed(candidate, operation)), first);
  assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.queries.length, 0); localUnchanged(f);
});

test('foreign form owner or changed document identity fails before persistence', async () => {
  for (const edit of [false, true]) {
    const f = fixture(), operation = f.op(edit), candidate = edit ? f.edit({ phone: '333' }) : f.create();
    candidate.trainerId = 'trainer-b';
    await assert.rejects(f.ctx.saveClientCardConfirmed(candidate, operation));
    assert.equal(f.calls.commits.length, 0); assert.equal(f.calls.persist.length, 0); localUnchanged(f);
  }
  const f = fixture();
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ _fbId: 'another-card' }), f.op(true)));
  assert.equal(f.calls.transactions.length, 0); localUnchanged(f);
});

test('session switch during create acknowledgement suppresses old success and retry', async () => {
  const f = fixture(), operation = f.op(false), hold = gate();
  f.modes.persist.push({ gate: hold });
  const pending = f.ctx.saveClientCardConfirmed(f.create(), operation);
  const rejected = assert.rejects(pending);
  await hold.entered.promise; f.switchSession(); hold.release.resolve(); await rejected;
  assert.deepEqual(clone(f.ctx.CL), []);
  const before = f.calls.persist.length;
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  assert.equal(f.calls.persist.length, before); assert.equal(f.calls.queries.length, 0);
});

test('session switch during create recovery query prevents a retry write and old success', async () => {
  const f = fixture(), operation = f.op(false), hold = gate();
  f.modes.persist.push({ before: true });
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
  f.modes.query.push({ gate: hold });
  const pending = f.ctx.saveClientCardConfirmed(f.create(), operation), rejected = assert.rejects(pending);
  await hold.entered.promise; f.switchSession(); hold.release.resolve(); await rejected;
  assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.commits.length, 0); assert.deepEqual(clone(f.ctx.CL), []);
});

test('session switch during transaction read prevents staging an old-session edit', async () => {
  const f = fixture(), hold = gate(), operation = f.op(true);
  f.modes.transaction.push({ readGate: hold });
  const pending = f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), operation), rejected = assert.rejects(pending);
  await hold.entered.promise; f.switchSession(); hold.release.resolve(); await rejected;
  assert.equal(f.calls.commits.length, 0); assert.deepEqual(f.docs.get('clients/client-a'), f.initial);
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), operation));
  assert.deepEqual(clone(f.ctx.CL), []);
});

test('session switch during transaction acknowledgement suppresses old confirmed result', async () => {
  const f = fixture(), hold = gate(), operation = f.op(true);
  f.modes.transaction.push({ gate: hold });
  const pending = f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), operation), rejected = assert.rejects(pending);
  await hold.entered.promise; f.switchSession(); hold.release.resolve(); await rejected;
  assert.deepEqual(clone(f.ctx.CL), []);
  const commits = f.calls.commits.length;
  await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), operation));
  assert.equal(f.calls.commits.length, commits);
});

for (const flag of ['_tenantDataReady', '_clientAppMode', '_clientPreviewMode']) {
  test('invalid trainer context prevents all writes: ' + flag, async () => {
    const f = fixture(), operation = f.op(false);
    f.ctx[flag] = flag !== '_tenantDataReady';
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
    assert.equal(f.calls.persist.length, 0); assert.equal(f.calls.transactions.length, 0); localUnchanged(f);
  });
}

for (const helper of ['assignmentSessionCurrent', 'assertAssignmentSession', '_db', 'persistById', 'crypto']) {
  test('missing create helper fails closed: ' + helper, async () => {
    const f = fixture(), operation = f.op(false); f.ctx[helper] = undefined;
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
    assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  });
}
for (const helper of ['_runTransaction', '_doc']) {
  test('missing edit helper fails closed: ' + helper, async () => {
    const f = fixture(), operation = f.op(true); f.ctx[helper] = undefined;
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.edit({ phone: '333' }), operation));
    assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  });
}
for (const helper of ['_getDocsFromServer', '_query', '_col', '_where']) {
  test('missing server recovery helper prevents retry writes: ' + helper, async () => {
    const f = fixture(), operation = f.op(false);
    f.modes.persist.push({ before: true });
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
    f.ctx[helper] = undefined;
    await assert.rejects(f.ctx.saveClientCardConfirmed(f.create(), operation));
    assert.equal(f.calls.persist.length, 1); assert.equal(f.calls.commits.length, 0); localUnchanged(f);
  });
}

(async () => {
  let passed = 0;
  for (const { name, run } of tests) {
    await run(); passed++; console.log('PASS ' + name);
  }
  console.log('Client-card confirmed service: ' + passed + ' tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
