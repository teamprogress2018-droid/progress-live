'use strict';

// Exercise the production check-in functions without a browser or Firebase SDK.
// The transaction double separates a committed write from its acknowledgement.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const portalSource = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const NOW = '2026-09-26T12:00:00.000Z';

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'Production helper block exists: ' + start);
  return source.slice(from, to);
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(options = {}) {
  const store = new Map();
  const effects = { sync: [], fire: [], emit: [], notice: [], toast: [], render: [], refresh: [] };
  const committed = [];
  const reads = [];
  const modes = [];
  let tail = Promise.resolve();
  let transactions = 0;
  let sequence = 0;
  const clients = ['client-a', 'client-b'].map(id => ({ id, trainerId: 'trainer-a', name: id, weight: 70 }));
  clients.forEach(c => store.set('clients/' + c.id, clone(c)));
  const pending = {
    id: 'checkin-a', trainerId: 'trainer-a', clientId: 'client-a',
    date: '2026-09-25', createdAt: '2026-09-25T10:00:00.000Z',
    status: 'pending', source: 'manual', score: null, answers: {}
  };
  const initial = options.pending === false ? null : { ...pending, ...(options.pending || {}) };
  if (initial) store.set('checkins/' + (initial._fbId || initial.id), clone(initial));
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return Date.parse(NOW); }
  }
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Date: Clock,
    setTimeout, clearTimeout, Promise, Map, Set,
    _db: { fixture: true }, _uid: 'trainer-a', _clientAppMode: false,
    tenantSessionGeneration: 1, CL: clone(clients), PL: [], SETTINGS: {},
    CHECKINS: { 'client-a': initial ? [clone(initial)] : [], 'client-b': [] },
    ciActiveClient: 'client-a', cpClientId: null,
    newId: prefix => prefix + '-' + (++sequence),
    dateStr: d => d.toISOString().slice(0, 10), todayYmd: () => NOW.slice(0, 10),
    escHtml: value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    notify: (...args) => effects.toast.push(clone(args)),
    addNotification: (...args) => effects.notice.push(clone(args)),
    fireIntEvent: (...args) => effects.fire.push(clone(args)),
    emitAppEvent: (...args) => effects.emit.push(clone(args)),
    renderCIDetail: (...args) => effects.render.push(['detail', ...args]),
    renderCheckinSummary: (...args) => effects.render.push(['summary', ...args]),
    renderCheckinClientList: (...args) => effects.render.push(['list', ...args]),
    refreshDashOps: (...args) => effects.refresh.push(args),
    // A separate pending write is the old race this suite must reject.
    persistById: async () => { throw new Error('Unexpected non-transactional check-in write'); },
    _doc: (db, collection, id) => ({ path: collection + '/' + id, id, collection }),
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    tenantSessionIsCurrent: session => !!session && !!ctx._uid &&
      session.uid === ctx._uid && session.generation === ctx.tenantSessionGeneration
  };
  ctx.window = ctx;
  ctx._runTransaction = (db, callback) => {
    transactions++;
    const mode = modes.shift() || {};
    const run = async () => {
      const writes = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'Firestore transaction reads precede writes');
          reads.push(ref.path);
          const value = clone(store.get(ref.path));
          return { id: ref.id, exists: () => value !== undefined, data: () => clone(value) };
        },
        set: (ref, data, config = {}) => writes.push({ path: ref.path, data: clone(data), config })
      };
      const result = await callback(tx);
      if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
      if (mode.rejectBefore) throw new Error('Simulated network failure before commit');
      for (const write of writes) {
        const previous = store.get(write.path);
        store.set(write.path, write.config.merge ? { ...(previous || {}), ...write.data } : write.data);
        committed.push(clone(write));
      }
      if (mode.rejectAfter) throw new Error('Simulated lost acknowledgement after commit');
      return result;
    };
    const result = tail.then(run);
    tail = result.catch(() => {});
    return result;
  };
  vm.createContext(ctx);
  vm.runInContext(section(coreSource, 'function withTrainer', 'window.withTrainer=withTrainer;'), ctx);
  vm.runInContext(section(portalSource, 'function ensureCheckins', 'function setCIFilter'), ctx);
  vm.runInContext(section(portalSource, 'function ciFillDraft', 'function sendCheckinTo'), ctx);
  ctx.syncClientFromCheckin = ci => { effects.sync.push(clone(ci)); return { changed: true }; };
  const answer = { energy: 5, sleep: 4, stress: 2, nutrition: 4, workouts: 0, weight: '72.4', notes: 'Odpowiedzi kontrolne' };
  function open(id = 'client-a', values = answer) {
    ctx.ciActiveClient = id;
    ctx.openCIFill(id);
    Object.assign(ctx.ciFillDraft(id), values);
    return ctx.ciFillDraft(id);
  }
  function gate(mode = {}) {
    const value = { entered: deferred(), release: deferred() };
    modes.push({ ...mode, gate: value });
    return value;
  }
  return { ctx, store, effects, committed, reads, modes, initial, open, gate,
    transactions: () => transactions,
    filled: () => [...store.entries()].filter(([key, value]) => key.startsWith('checkins/') && value.status === 'filled') };
}

function noSuccess(f) {
  for (const key of ['sync', 'fire', 'emit', 'notice']) assert.equal(f.effects[key].length, 0, key + ' waits for confirmed save');
}

function oneSuccess(f) {
  for (const key of ['sync', 'fire', 'emit', 'notice']) assert.equal(f.effects[key].length, 1, key + ' occurs once');
}

const tests = [];
function test(name, body) { tests.push({ name, body }); }

test('pending save does not optimistically mutate the record or report success', async () => {
  const f = fixture();
  const draft = f.open();
  const before = clone(f.ctx.CHECKINS);
  const wait = f.gate();
  const saving = f.ctx.saveCheckinFill('client-a');
  await wait.entered.promise;
  assert.deepEqual(clone(f.ctx.CHECKINS), before);
  assert.equal(f.ctx._ciFillOpen, 'client-a');
  assert.equal(f.ctx.ciFillSaveState('client-a').saving, true);
  assert.deepEqual(clone(f.ctx.ciFillDraft('client-a')), clone(draft));
  assert.equal(f.committed.length, 0);
  noSuccess(f);
  wait.release.resolve();
  assert.equal(await saving, true);
  assert.equal(f.committed.length, 1);
  const stored = f.store.get('checkins/checkin-a');
  assert.equal(stored.status, 'filled');
  assert.equal(stored.trainerId, 'trainer-a');
  assert.equal(stored.clientId, 'client-a');
  assert.equal(stored.filledBy, 'trainer');
  assert.equal(stored.answers.workouts, 0, 'zero workouts is a valid answer');
  assert.equal(stored.answers.notes, 'Odpowiedzi kontrolne');
  assert.equal(stored.score, 85);
  assert.equal(stored.date, f.initial.date);
  assert.equal(stored.source, f.initial.source);
  assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'filled');
  assert.equal(f.ctx._ciFillOpen, null);
  assert.ok(!f.ctx._ciFillDraft['client-a'], 'successful draft is cleared');
  oneSuccess(f);
});

test('failure preserves pending record and answers, then retries the same candidate', async () => {
  const f = fixture();
  f.open();
  f.modes.push({ rejectBefore: true });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'pending');
  assert.equal(f.ctx.ciFillDraft('client-a').notes, 'Odpowiedzi kontrolne');
  const state = f.ctx.ciFillSaveState('client-a');
  assert.equal(state.saving, false);
  assert.ok(state.error);
  assert.ok(state.candidate);
  const candidate = clone(state.candidate);
  assert.equal(f.committed.length, 0);
  noSuccess(f);
  f.ctx.ciFillPick('client-a', 'energy', 1);
  assert.equal(f.ctx.ciFillDraft('client-a').energy, 5, 'candidate answers remain frozen');
  assert.match(f.ctx.ciFillFormHtml('client-a'), /<fieldset\b[^>]*\bdisabled\b/i);
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  const stored = f.filled()[0][1];
  assert.equal(stored.id, candidate.id);
  assert.equal(stored.filledAt, candidate.filledAt);
  assert.deepEqual(stored.answers, candidate.answers);
  assert.equal(f.committed.length, 1);
  oneSuccess(f);
});

test('new manual report makes only one filled write with a stable retry ID', async () => {
  const f = fixture({ pending: false });
  f.open();
  f.modes.push({ rejectBefore: true });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.deepEqual(clone(f.ctx.CHECKINS['client-a']), []);
  const candidate = clone(f.ctx.ciFillSaveState('client-a').candidate);
  assert.ok(candidate.id);
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.committed.length, 1, 'no separate pending document or pending write');
  assert.equal(f.committed[0].data.status, 'filled');
  assert.equal(f.filled().length, 1);
  assert.equal(f.filled()[0][1].id, candidate.id);
  assert.equal(f.ctx.CHECKINS['client-a'].length, 1);
  oneSuccess(f);
});

for (const outcome of ['confirmed', 'unconfirmed']) {
  test('the real pending-create path settles before completing its report: ' + outcome, async () => {
    const f = fixture({ pending: false });
    f.open();
    const releasePending = deferred();
    const ordering = [];
    let pendingCalls = 0;
    f.ctx.persistById = async (collection, record) => {
      pendingCalls++;
      assert.equal(collection, 'checkins');
      assert.equal(record.status, 'pending');
      // Capture the exact old payload that a delayed setDoc would eventually send.
      const payload = clone(record);
      const key = 'checkins/' + (record._fbId || record.id);
      ordering.push('pending-start');
      await releasePending.promise;
      if (outcome === 'unconfirmed') {
        ordering.push('pending-unconfirmed');
        return null;
      }
      f.store.set(key, payload);
      ordering.push('pending-committed');
      return record;
    };
    const transaction = f.ctx._runTransaction;
    f.ctx._runTransaction = (db, callback) => {
      ordering.push('filled-transaction');
      return transaction(db, callback);
    };
    // Use the production functions, including their otherwise unawaited call.
    const requested = f.ctx.ensurePendingCheckin('client-a');
    assert.equal(pendingCalls, 1);
    assert.ok(f.ctx._ciPendingWrites[requested.id]);
    const saving = f.ctx.saveCheckinFill('client-a');
    for (let i = 0; i < 4; i++) await Promise.resolve();
    assert.equal(f.transactions(), 0, 'completion must not race the older pending write');
    assert.equal(f.committed.length, 0);
    assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'pending');
    assert.equal(f.ctx.ciFillSaveState('client-a').saving, true);
    noSuccess(f);
    releasePending.resolve();
    assert.equal(await saving, true);
    assert.deepEqual(ordering, ['pending-start', 'pending-' + (outcome === 'confirmed' ? 'committed' : 'unconfirmed'), 'filled-transaction']);
    assert.equal(pendingCalls, 1);
    assert.equal(f.transactions(), 1);
    assert.equal(f.committed.length, 1);
    assert.equal(f.filled().length, 1);
    assert.equal(f.store.get('checkins/' + requested.id).status, 'filled');
    assert.equal(f.store.get('checkins/' + requested.id).answers.notes, 'Odpowiedzi kontrolne');
    assert.equal(f.ctx.CHECKINS['client-a'].length, 1);
    assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'filled');
    assert.ok(!f.ctx._ciPendingWrites[requested.id], 'settled pending promise is released');
    oneSuccess(f);
  });
}

test('a session change while awaiting the earlier pending write prevents the filled transaction', async () => {
  const f = fixture({ pending: false });
  f.open();
  const releasePending = deferred();
  f.ctx.persistById = async () => { await releasePending.promise; return null; };
  f.ctx.ensurePendingCheckin('client-a');
  const saving = f.ctx.saveCheckinFill('client-a');
  assert.equal(f.transactions(), 0);
  f.ctx.tenantSessionGeneration++;
  releasePending.resolve();
  assert.equal(await saving, false);
  assert.equal(f.transactions(), 0);
  assert.equal(f.committed.length, 0);
  noSuccess(f);
});

test('double click shares one in-flight save', async () => {
  const f = fixture();
  f.open();
  const wait = f.gate();
  const first = f.ctx.saveCheckinFill('client-a');
  await wait.entered.promise;
  const second = f.ctx.saveCheckinFill('client-a');
  assert.equal(f.transactions(), 1);
  wait.release.resolve();
  await Promise.all([first, second]);
  assert.equal(f.committed.length, 1);
  oneSuccess(f);
});

test('saves for different clients do not share a global lock', async () => {
  const f = fixture();
  f.open();
  const wait = f.gate();
  const first = f.ctx.saveCheckinFill('client-a');
  await wait.entered.promise;
  f.open('client-b', { energy: 2, notes: 'Drugi klient' });
  const second = f.ctx.saveCheckinFill('client-b');
  assert.equal(f.transactions(), 2);
  wait.release.resolve();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(f.filled().length, 2);
  assert.equal(f.filled().find(([, ci]) => ci.clientId === 'client-b')[1].answers.notes, 'Drugi klient');
});

for (const change of ['uid', 'generation']) {
  test('a stale ' + change + ' cannot update the next session after await', async () => {
    const f = fixture();
    f.open();
    const wait = f.gate();
    const saving = f.ctx.saveCheckinFill('client-a');
    await wait.entered.promise;
    if (change === 'uid') f.ctx._uid = 'trainer-b';
    else f.ctx.tenantSessionGeneration++;
    f.ctx.CHECKINS = { 'client-a': [{ id: 'new-session-record', status: 'pending' }] };
    f.ctx._ciFillDraft = { 'client-a': { notes: 'New session draft' } };
    f.ctx._ciFillOpen = 'client-a';
    const renders = f.effects.render.length;
    wait.release.resolve();
    assert.equal(await saving, false);
    assert.equal(f.ctx.CHECKINS['client-a'][0].id, 'new-session-record');
    assert.equal(f.ctx._ciFillDraft['client-a'].notes, 'New session draft');
    assert.equal(f.ctx._ciFillOpen, 'client-a');
    assert.equal(f.effects.render.length, renders);
    noSuccess(f);
  });
}

test('finishing one client preserves another client form opened during the request', async () => {
  const f = fixture();
  f.open();
  const wait = f.gate();
  const saving = f.ctx.saveCheckinFill('client-a');
  await wait.entered.promise;
  f.open('client-b', { notes: 'Unsaved client B answer' });
  wait.release.resolve();
  assert.equal(await saving, true);
  assert.equal(f.ctx._ciFillOpen, 'client-b');
  assert.equal(f.ctx.ciFillDraft('client-b').notes, 'Unsaved client B answer');
  assert.equal(f.filled()[0][1].clientId, 'client-a');
});

test('lost acknowledgement retries idempotently without overwriting or a second write', async () => {
  const f = fixture();
  f.open();
  f.modes.push({ rejectAfter: true });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.equal(f.committed.length, 1);
  assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'pending');
  const committed = clone(f.filled()[0][1]);
  noSuccess(f);
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.committed.length, 1);
  assert.deepEqual(f.filled()[0][1], committed);
  assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'filled');
  oneSuccess(f);
});

test('a concurrently completed remote report is not overwritten', async () => {
  const f = fixture();
  f.open();
  const foreignCompletion = { ...clone(f.initial), status: 'filled', filledBy: 'client', filledAt: '2026-09-26T11:59:00.000Z', answers: { energy: 1, notes: 'Answered in client app' } };
  f.store.set('checkins/checkin-a', foreignCompletion);
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.deepEqual(f.store.get('checkins/checkin-a'), foreignCompletion);
  assert.equal(f.committed.length, 0);
  assert.ok(f.ctx.ciFillSaveState('client-a').error);
  assert.equal(f.ctx.ciFillSaveState('client-a').conflict, true);
  assert.equal(f.ctx.CHECKINS['client-a'][0].answers.notes, 'Answered in client app');
  assert.equal(f.ctx.ciFillDraft('client-a').notes, 'Odpowiedzi kontrolne');
  const attempts = f.transactions();
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.equal(f.transactions(), attempts, 'conflict cannot be blindly retried');
  noSuccess(f);
  f.ctx.ciFillStartNew('client-a');
  assert.equal(f.ctx.ciFillSaveState('client-a').conflict, false);
  assert.ok(!f.ctx.ciFillSaveState('client-a').candidate);
  assert.equal(f.ctx.ciFillDraft('client-a').notes, 'Odpowiedzi kontrolne');
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.filled().length, 2, 'explicit new-report action retains the prior completed report');
  assert.deepEqual(f.store.get('checkins/checkin-a'), foreignCompletion);
  assert.equal(f.committed.length, 1);
  assert.notEqual(f.committed[0].data.id, foreignCompletion.id);
  oneSuccess(f);
});

test('close and reopen preserves an unconfirmed candidate instead of making a duplicate', async () => {
  const f = fixture({ pending: false });
  f.open();
  f.modes.push({ rejectAfter: true });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  const candidate = clone(f.ctx.ciFillSaveState('client-a').candidate);
  f.ctx.closeCIFill('client-a');
  assert.equal(f.ctx._ciFillOpen, null);
  f.ctx.openCIFill('client-a');
  assert.deepEqual(clone(f.ctx.ciFillSaveState('client-a').candidate), candidate);
  assert.equal(f.ctx.ciFillDraft('client-a').notes, 'Odpowiedzi kontrolne');
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.committed.length, 1);
  assert.equal(f.filled().length, 1);
  oneSuccess(f);
});

test('the same answers at a different completion time are a conflict, not a replay', async () => {
  const f = fixture();
  f.open();
  f.modes.push({ rejectBefore: true });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  const candidate = clone(f.ctx.ciFillSaveState('client-a').candidate);
  const other = { ...candidate, filledAt: '2026-09-26T11:59:00.000Z' };
  f.store.set('checkins/checkin-a', other);
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.equal(f.ctx.ciFillSaveState('client-a').conflict, true);
  assert.deepEqual(f.store.get('checkins/checkin-a'), other);
  assert.equal(f.committed.length, 0);
  noSuccess(f);
});

test('transaction completion preserves newer authoritative request metadata', async () => {
  const f = fixture();
  f.open();
  Object.assign(f.store.get('checkins/checkin-a'), {
    source: 'auto', date: '2026-09-26', createdAt: '2026-09-26T10:00:00.000Z', requestNote: 'Changed by trainer in another tab'
  });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  const stored = f.store.get('checkins/checkin-a');
  assert.equal(stored.source, 'auto');
  assert.equal(stored.date, '2026-09-26');
  assert.equal(stored.requestNote, 'Changed by trainer in another tab');
  assert.equal(f.ctx.CHECKINS['client-a'][0].source, 'auto');
  oneSuccess(f);
});

test('_fbId selects the actual remote document while preserving its owner and metadata', async () => {
  const f = fixture({ pending: { _fbId: 'actual-checkin-document' } });
  f.open();
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.committed[0].path, 'checkins/actual-checkin-document');
  assert.equal(f.store.has('checkins/checkin-a'), false);
  assert.ok(!('_fbId' in f.committed[0].data), 'local Firestore mapping metadata is not persisted');
  assert.equal(f.ctx.CHECKINS['client-a'][0]._fbId, 'actual-checkin-document');
  oneSuccess(f);
});

for (const field of ['trainerId', 'clientId']) {
  test('remote ' + field + ' mismatch is rejected before writing', async () => {
    const f = fixture();
    f.open();
    f.store.get('checkins/checkin-a')[field] = 'foreign';
    assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
    assert.equal(f.committed.length, 0);
    noSuccess(f);
  });
}

for (const invalid of ['signed-out', 'client-mode', 'preview-mode', 'foreign-client', 'foreign-local-checkin', 'offline']) {
  test(invalid + ' cannot submit a trainer report', async () => {
    const f = fixture();
    f.open();
    if (invalid === 'signed-out') f.ctx._uid = null;
    if (invalid === 'client-mode') { f.ctx._clientAppMode = true; f.ctx._trainerId = 'trainer-a'; f.ctx._clientId = 'client-a'; }
    if (invalid === 'preview-mode') f.ctx._clientPreviewMode = true;
    if (invalid === 'foreign-client') f.ctx.CL[0].trainerId = 'trainer-b';
    if (invalid === 'foreign-local-checkin') f.ctx.CHECKINS['client-a'][0].trainerId = 'trainer-b';
    if (invalid === 'offline') f.ctx._db = null;
    assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
    assert.equal(f.committed.length, 0);
    noSuccess(f);
  });
}

for (const remoteClient of ['missing', 'foreign']) {
  test('a ' + remoteClient + ' authoritative client blocks a locally owned report', async () => {
    const f = fixture();
    f.open();
    if (remoteClient === 'missing') f.store.delete('clients/client-a');
    else f.store.get('clients/client-a').trainerId = 'trainer-b';
    assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
    assert.equal(f.committed.length, 0);
    noSuccess(f);
  });
}

test('a new login under the same UID discards the prior session draft and candidate', async () => {
  const f = fixture();
  f.open();
  f.modes.push({ rejectBefore: true });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), false);
  assert.ok(f.ctx.ciFillSaveState('client-a').candidate);
  f.ctx.tenantSessionGeneration++;
  f.ctx.openCIFill('client-a');
  assert.ok(!f.ctx.ciFillSaveState('client-a').candidate);
  assert.equal(f.ctx.ciFillDraft('client-a').notes, '');
  assert.equal(f.ctx.ciFillSaveState('client-a').session.generation, 2);
  noSuccess(f);
});

test('transaction callback re-execution retains one candidate and one final commit', async () => {
  const f = fixture({ pending: false });
  f.open();
  const original = f.ctx._runTransaction;
  let discarded;
  f.ctx._runTransaction = (db, callback) => original(db, async tx => {
    const staged = [];
    await callback({ get: tx.get, set: (ref, data) => staged.push({ path: ref.path, data: clone(data) }) });
    discarded = staged[0];
    return callback(tx);
  });
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.committed.length, 1);
  assert.equal(f.committed[0].path, discarded.path);
  assert.deepEqual(f.committed[0].data, discarded.data);
  oneSuccess(f);
});

test('a follow-up synchronization exception does not turn a committed save into a retry', async () => {
  const f = fixture();
  f.open();
  f.ctx.syncClientFromCheckin = () => { throw new Error('Simulated measurement refresh failure'); };
  assert.equal(await f.ctx.saveCheckinFill('client-a'), true);
  assert.equal(f.committed.length, 1);
  assert.equal(f.ctx.CHECKINS['client-a'][0].status, 'filled');
  assert.equal(f.effects.fire.length, 1);
  assert.equal(f.effects.emit.length, 1);
  assert.equal(f.effects.notice.length, 1);
  assert.ok(!f.ctx._ciFillDraft['client-a']);
});

async function run() {
  let passed = 0;
  for (const item of tests) {
    // Timeout belongs to the harness: a regression must fail CI, not hang it.
    let timer;
    try {
      await Promise.race([item.body(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Scenario timed out')), 5000);
      })]);
      passed++;
      console.log('PASS ' + item.name);
    } catch (error) {
      error.message = item.name + ': ' + error.message;
      throw error;
    } finally { clearTimeout(timer); }
  }
  console.log(passed + ' trainer check-in confirmed-write scenarios passed');
  return { passed };
}

module.exports = { run };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
