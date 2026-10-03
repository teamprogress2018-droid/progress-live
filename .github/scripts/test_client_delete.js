#!/usr/bin/env node
/** Archive transactions, profile-save races, restore and permanent delete. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8').replace(/\r\n?/g, '\n');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8').replace(/\r\n?/g, '\n');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8').replace(/\r\n?/g, '\n');
function extract(source, name) {
  const start = source.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  assert(start >= 0, 'missing helper ' + name);
  const tail = source.slice(start), line = tail.split('\n')[0];
  const code = line.endsWith('}') ? line : tail.slice(0, tail.indexOf('\n}') + 2);
  const declarations = code.match(/^(?:(?:async )?function\s+[\w$]+|(?:var|let|const|class)\s+[\w$]+|window\.[\w$]+)/gm) || [];
  assert.deepEqual(declarations, [(line.startsWith('async ') ? 'async ' : '') + 'function ' + name],
    'helper extraction must include exactly one top-level declaration');
  return code;
}
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function harness(options = {}) {
  const calls = { confirms: [], notices: [], deletes: [], persisted: [], transactions: 0, updates: [], closed: [], renders: [], cache: [] };
  const docs = new Map();
  const committed = deferred();
  const a = { id: 'c1', trainerId: 'trainer-a', name: 'Ada', status: 'active', email: 'ada@example.test', notes: 'Stara notatka' };
  const ctx = { console, Map, Object, JSON, Promise, parseFloat, parseInt,
    _uid: 'trainer-a', tenantSessionGeneration: 1, _tenantDataReady: true, _clientAppMode: false, _clientPreviewMode: false,
    CL: [clone(a), { id: 'c2', trainerId: 'trainer-a', name: 'Bartek', status: 'active' },
      { id: 'c3', trainerId: 'trainer-a', name: 'Celina', status: 'archived' }],
    _db: {}, cpClientId: null, cpTab: 'overview',
    _doc: (_db, collection, id) => ({ collection, id }),
    _del: ref => Promise.resolve(calls.deletes.push(ref)),
    persistById: (collection, record) => { calls.persisted.push({ collection, record: clone(record) }); return record; },
    confirm: message => { calls.confirms.push(String(message)); return options.confirm !== false; },
    notify: message => calls.notices.push(String(message)),
    syncClientNameCache: (id, name) => calls.cache.push({ id, name }),
    renderClients: () => calls.renders.push('clients'), renderClientFilters: () => calls.renders.push('filters'), renderDash: () => {},
    closeClientProfile: () => { calls.closed.push(ctx.cpClientId); ctx.cpClientId = null; },
    document: { getElementById: () => ({ textContent: '', style: {} }) },
    _runTransaction: async (_db, execute) => {
      calls.transactions++;
      if (options.beforeRead) await options.beforeRead.promise;
      const writes = [];
      const saved = await execute({
        get: async ref => { const value = docs.get(ref.id); return { exists: () => !!value, data: () => clone(value) }; },
        update: (ref, patch) => { calls.updates.push({ ref: clone(ref), patch: clone(patch) }); writes.push({ ref, patch }); },
        set: () => { throw Error('Archive must never replace the full client document'); }
      });
      if (options.fail) throw Error('Fixture transaction interrupted');
      for (const { ref, patch } of writes) docs.set(ref.id, { ...docs.get(ref.id), ...clone(patch) });
      committed.resolve();
      if (options.afterCommit) await options.afterCommit.promise;
      return saved;
    }
  };
  ctx.window = ctx;
  for (const client of ctx.CL) docs.set(client.id, clone(client));
  vm.createContext(ctx);
  const code = [
    ...['assignmentSession', 'assignmentSessionCurrent', 'assertAssignmentSession'].map(name => extract(core, name)),
    'const clientArchiveWrites=new Map();',
    ...['clientArchiveWriteFor', 'archiveClient', 'restoreClient', 'deleteClientPermanently', 'refreshClientProfileRemoveActions'].map(name => extract(src, name))
  ].join('\n');
  vm.runInContext(code, ctx, { filename: 'client-archive-fixture.js' });
  const profile = () => {
    const controls = { 'cpe-name': { value: 'Ada po edycji' } };
    ctx.document.getElementById = id => controls[id] || null;
    ctx.cpClientId = 'c1';
    ctx.cpEditIsCurrent = state => ctx._cpEditState === state && ctx.cpClientId === 'c1' && ctx.assignmentSessionCurrent(state.auth);
    ctx.renderCPEditSaveState = () => {};
    ctx.renderCPOverview = () => calls.renders.push('overview');
    ctx.syncClientNameCache = () => calls.renders.push('cache');
    const receipt = deferred();
    ctx.saveClientCardConfirmed = candidate => {
      docs.set('c1', clone(candidate)); // Server commit precedes the deferred profile receipt.
      return receipt.promise;
    };
    vm.runInContext([extras.match(/const cpEditFieldIds=[^\n]+/)[0], extract(extras, 'cpEditClone'),
      extract(extras, 'cpEditFields'), extract(src, 'saveCPEdit')].join('\n'), ctx);
    const auth = ctx.assignmentSession(), base = clone(ctx.CL[0]);
    const state = ctx._cpEditState = { auth, clientId: 'c1', base, displayBase: { name: base.name },
      card: {}, open: true, operation: { auth, edit: true, base } };
    return { state, receipt, controls };
  };
  return { ctx, calls, docs, profile, committed };
}
let passed = 0;
async function test(label, run) { await run(); passed++; console.log('OK ' + label); }
(async () => {
  await test('archive applies only its status patch and waits for transaction ACK before local changes', async () => {
    const gate = deferred(), h = harness({ afterCommit: gate }), before = clone(h.ctx.CL);
    h.ctx.cpClientId = 'c1'; const save = h.ctx.archiveClient('c1'); await tick();
    assert.deepEqual(clone(h.ctx.CL), before); assert.equal(h.calls.closed.length, 0);
    assert(!h.calls.notices.some(text => text.startsWith('✓'))); assert.equal(h.calls.persisted.length, 0);
    assert.equal(h.calls.cache.length, 0);
    assert.deepEqual(h.calls.updates.map(call => call.patch), [{ status: 'archived' }]);
    gate.resolve(); await save;
    assert.equal(h.ctx.CL[0].status, 'archived'); assert.deepEqual(h.calls.closed, ['c1']);
    assert(h.calls.notices.some(text => /Ada.*zarchiwizowany/.test(text)));
    assert.deepEqual(h.calls.cache, [{ id: 'c1', name: 'Ada' }]);
    h.ctx.restoreClient('c1'); assert.equal(h.ctx.CL[0].status, 'active');
    assert.equal(h.calls.persisted.at(-1).record.status, 'active');
  });
  await test('duplicate pending archive shares one transaction and restore cannot race it', async () => {
    const gate = deferred(), h = harness({ beforeRead: gate });
    const first = h.ctx.archiveClient('c1'), duplicate = h.ctx.archiveClient('c1'); await tick();
    h.ctx.restoreClient('c1');
    assert.equal(h.calls.transactions, 1); assert.equal(h.calls.confirms.length, 1); assert.equal(h.calls.persisted.length, 0);
    assert.equal(h.ctx.CL[0].status, 'active');
    gate.resolve(); await Promise.all([first, duplicate]); assert.equal(h.calls.updates.length, 1);
    assert.equal(h.calls.notices.filter(text => text.startsWith('✓')).length, 1);
  });
  await test('archive failure retains CL and blocks restore until archive retry confirms', async () => {
    const options = { fail: true }, h = harness(options), before = clone(h.ctx.CL);
    await h.ctx.archiveClient('c1'); assert.deepEqual(clone(h.ctx.CL), before);
    assert.match(h.calls.notices.at(-1), /Nie potwierdzono archiwizacji/);
    h.ctx.restoreClient('c1'); assert.equal(h.calls.persisted.length, 0);
    options.fail = false; await h.ctx.archiveClient('c1'); assert.equal(h.ctx.CL[0].status, 'archived');
    h.ctx.restoreClient('c1'); assert.equal(h.ctx.CL[0].status, 'active');
  });
  await test('lost archive ACK can be confirmed after the tenant stream already marks the local client archived', async () => {
    const gate = deferred(), options = { afterCommit: gate }, h = harness(options);
    h.docs.get('c1').name = 'Ada z potwierdzonego profilu';
    const first = h.ctx.archiveClient('c1'); await h.committed.promise;
    assert.equal(h.docs.get('c1').status, 'archived');
    h.ctx.CL[0] = clone(h.docs.get('c1'));
    gate.reject(Error('Fixture lost acknowledgement')); await first;
    h.ctx.restoreClient('c1'); assert.equal(h.calls.persisted.length, 0); assert.equal(h.calls.cache.length, 0);
    options.afterCommit = null; await h.ctx.archiveClient('c1');
    assert.equal(h.calls.transactions, 2); assert.equal(h.calls.updates.length, 1, 'confirmation retry only reads the already archived document');
    assert.equal(h.ctx.clientArchiveWriteFor('c1'), undefined);
    assert.deepEqual(h.calls.cache, [{ id: 'c1', name: 'Ada z potwierdzonego profilu' }]);
    h.ctx.restoreClient('c1'); assert.equal(h.ctx.CL[0].status, 'active'); assert.equal(h.calls.persisted.length, 1);
  });
  for (const remote of ['missing', 'foreign-owner', 'deleted', 'wrong-id']) await test('archive rejects a ' + remote + ' server document', async () => {
    const h = harness(), before = clone(h.ctx.CL);
    if (remote === 'missing') h.docs.delete('c1');
    else if (remote === 'foreign-owner') h.docs.get('c1').trainerId = 'trainer-b';
    else if (remote === 'deleted') h.docs.get('c1').deleted = true;
    else h.docs.get('c1').id = 'c-foreign';
    await h.ctx.archiveClient('c1'); assert.deepEqual(clone(h.ctx.CL), before);
    assert.equal(h.calls.updates.length, 0); assert.equal(h.calls.persisted.length, 0);
    assert(!h.calls.notices.some(text => text.startsWith('✓')));
  });
  await test('archive patch preserves newer server fields while CL still holds old profile data', async () => {
    const h = harness(); const remote = { ...h.docs.get('c1'), name: 'Ada z serwera', notes: 'Nowa notatka', phone: '555666777' };
    h.docs.set('c1', remote); await h.ctx.archiveClient('c1');
    assert.deepEqual(h.docs.get('c1'), { ...remote, status: 'archived' });
    assert.equal(h.ctx.CL[0].name, remote.name); assert.equal(h.ctx.CL[0].notes, remote.notes);
    assert.deepEqual(h.calls.updates.map(call => call.patch), [{ status: 'archived' }]);
  });
  for (const change of ['removed', 'foreign-owner', 'different-document', 'tenant']) await test('late archive ACK cannot overwrite a locally changed ' + change + ' view', async () => {
    const gate = deferred(), h = harness({ afterCommit: gate });
    const save = h.ctx.archiveClient('c1'); await tick();
    if (change === 'removed') h.ctx.CL = h.ctx.CL.filter(client => client.id !== 'c1');
    else if (change === 'foreign-owner') h.ctx.CL[0].trainerId = 'trainer-b';
    else if (change === 'different-document') h.ctx.CL[0]._fbId = 'replacement';
    else { h.ctx._uid = 'trainer-b'; h.ctx.tenantSessionGeneration++; }
    h.ctx.cpClientId = 'c2'; const local = clone(h.ctx.CL);
    gate.resolve(); await save; assert.deepEqual(clone(h.ctx.CL), local);
    assert.equal(h.calls.closed.length, 0); assert(!h.calls.notices.some(text => text.startsWith('✓')));
    if (change === 'tenant') assert.equal(h.calls.notices.length, 0);
  });
  await test('archive completion keeps another client drawer open', async () => {
    const gate = deferred(), h = harness({ afterCommit: gate });
    h.ctx.cpClientId = 'c1'; const save = h.ctx.archiveClient('c1'); await tick(); h.ctx.cpClientId = 'c2';
    gate.resolve(); await save;
    assert.equal(h.ctx.CL[0].status, 'archived'); assert.equal(h.ctx.cpClientId, 'c2'); assert.equal(h.calls.closed.length, 0);
  });
  for (const first of ['archive', 'profile']) await test(first + ' ACK first cannot replace the confirmed profile with stale archive data', async () => {
    const h = harness(), p = h.profile();
    const saveProfile = h.ctx.saveCPEdit('c1');
    const committed = clone(h.docs.get('c1'));
    assert.equal(committed.name, 'Ada po edycji'); assert.equal(h.ctx.CL[0].name, 'Ada');
    if (first === 'profile') { p.receipt.resolve(committed); await saveProfile; }
    await h.ctx.archiveClient('c1');
    if (first === 'archive') { p.receipt.resolve(committed); await saveProfile; }
    assert.equal(h.ctx.CL[0].status, 'archived'); assert.equal(h.ctx.CL[0].name, 'Ada po edycji');
    assert.deepEqual(h.docs.get('c1'), { ...committed, status: 'archived' });
    assert.deepEqual(h.calls.updates.map(call => call.patch), [{ status: 'archived' }]);
    assert.equal(h.calls.persisted.length, 0); assert.equal(p.state.saved, true);
  });
  await test('cancelled archive and cancelled permanent delete preserve clients', async () => {
    const h = harness({ confirm: false }), before = clone(h.ctx.CL);
    await h.ctx.archiveClient('c1'); h.ctx.deleteClientPermanently('c1');
    assert.deepEqual(clone(h.ctx.CL), before); assert.equal(h.calls.transactions, 0); assert.equal(h.calls.deletes.length, 0);
  });
  await test('permanent delete requires two confirmations and deletes only its client document', async () => {
    const h = harness(), before = h.ctx.CL.length;
    h.ctx.deleteClientPermanently('c2');
    assert.equal(h.ctx.CL.some(client => client.id === 'c2'), false); assert.equal(h.ctx.CL.length, before - 1);
    assert.equal(h.calls.confirms.length, 2); assert.deepEqual(h.calls.deletes, [{ collection: 'clients', id: 'c2' }]);
  });
  console.log('\n' + passed + ' client delete/archive scenarios passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
