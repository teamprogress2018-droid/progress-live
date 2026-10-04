#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n?/g, '\n');
const core = read('01-core.js'), source = read('05-clients-builder-plans-calendar.js');
const clone = value => JSON.parse(JSON.stringify(value));
function extract(src, name) {
  const start = src.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  assert(start >= 0, name + ' exists');
  const tail = src.slice(start), line = tail.split('\n')[0];
  return line.endsWith('}') ? line : tail.slice(0, tail.indexOf('\n}') + 2);
}
const authCode = ['assignmentSession', 'assignmentSessionCurrent', 'assertAssignmentSession'].map(n => extract(core, n)).join('\n');
function context() {
  const c = { console, _uid: 'skip-owner', tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false, _db: {},
    CL: [{ id: 'skip-a', _fbId: 'doc-a', trainerId: 'skip-owner', name: 'Klient Alfa', status: 'active',
      notes: 'Original note', legacy: { keep: true } },
    { id: 'skip-b', trainerId: 'skip-owner', name: 'Klient Beta', status: 'active' }] };
  c.window = c; vm.createContext(c); vm.runInContext(authCode, c); return c;
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function service() {
  const ctx = context(), calls = { transactions: [], writes: [] };
  let remote = clone(ctx.CL[0]);
  ctx._doc = (_db, collection, id) => ({ collection, id });
  ctx.persistById = () => { throw Error('Full client persistence is forbidden'); };
  ctx._runTransaction = async (_db, execute) => {
    const gate = deferred(), readGate = deferred(), entry = { gate, readGate, staged: [] }; calls.transactions.push(entry);
    const result = await execute({
      get: async ref => { assert.deepEqual(clone(ref), { collection: 'clients', id: 'doc-a' }); await readGate.promise;
        return { exists: () => remote !== null, data: () => clone(remote) }; },
      update: (ref, patch) => { entry.staged.push(clone(patch)); calls.writes.push(clone(patch)); }
    });
    await gate.promise;
    for (const patch of entry.staged) remote = { ...remote, ...patch };
    return result;
  };
  vm.runInContext(read('client-card-save.js'), ctx);
  const operation = { auth: ctx.assignmentSession() }, client = clone(ctx.CL[0]);
  return { ctx, calls, client, operation, remote: () => clone(remote), setRemote: value => { remote = clone(value); },
    save: (field = 'inviteSkipped', candidate = client, op = operation) => ctx.saveClientOnboardSkipConfirmed(candidate, field, op),
    read: async (n = 0) => { await tick(); calls.transactions[n].readGate.resolve(); await tick(); },
    ack: async (n = 0) => { calls.transactions[n].gate.resolve(); await tick(); } };
}
function element(attrs = {}) {
  const classes = new Set();
  return { disabled: false, hidden: false, textContent: '', innerHTML: '', style: {},
    getAttribute: key => attrs[key], classList: { contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k) } };
}
function ui() {
  const ctx = context(), calls = { saves: [], pending: [], renders: [], notices: [], resume: [], close: [] };
  const buttons = ['inviteSkipped', 'packageSkipped'].map(field => element({ 'data-onboard-skip-client': 'skip-a',
    'data-onboard-skip-field': field, 'data-onboard-skip-action': 'skip' }));
  const statuses = ['inviteSkipped', 'packageSkipped'].map(field => element({ 'data-onboard-skip-client': 'skip-a', 'data-onboard-skip-status': field }));
  const elements = Object.fromEntries(['m-invite', 'inv-skip-btn', 'inv-skip-status', 'inv-send-btn', 'inv-name', 'inv-email',
    'inv-avatar', 'inv-link', 'm-client-onboard'].map(id => [id, element()]));
  elements['m-invite'].querySelectorAll = () => [elements['inv-send-btn']];
  ctx.document = { getElementById: id => elements[id] || null,
    querySelector: () => null,
    querySelectorAll: selector => selector.includes('#m-invite') ? [elements['inv-send-btn']] : selector.includes('button[data-onboard-skip-client]') ? buttons : selector.includes('data-onboard-skip-status') ? statuses : [] };
  ctx._onboardClientId = 'skip-a';
  ctx.renderClientOnboardChecklist = () => calls.renders.push({ id: ctx._onboardClientId, local: clone(ctx.CL) });
  ctx.renderDash = () => {}; ctx.renderClients = () => {}; ctx.notify = message => calls.notices.push(message);
  ctx.persistById = () => { throw Error('Optimistic persistence is forbidden'); };
  ctx.openM = id => elements[id].classList.add('show');
  ctx.closeM = id => { elements[id].classList.remove('show'); calls.close.push(id); };
  ctx.maybeResumeOnboard = id => calls.resume.push(id);
  ctx.defaultInviteMethod = () => 'email'; ctx.getInit = () => 'KA';
  ctx.paintInviteMethodButtons = () => {}; ctx.updateInvitePreview = () => {};
  ctx.ensureClientInvite = async () => 'https://example.test/invite/fixture';
  ctx.saveClientOnboardSkipConfirmed = (candidate, field, operation) => {
    const gate = deferred(); calls.saves.push({ candidate: clone(candidate), field, operation }); calls.pending.push(gate);
    return gate.promise;
  };
  vm.runInContext([extract(source, 'onboardScheduleClone'), extract(source, 'onboardScheduleFreeze'),
    source.slice(source.indexOf('const onboardSkipStates'), source.indexOf('function clientNextStartStep')),
    extract(source, 'skipClientPackage')].join('\n'), ctx);
  const invites = read('09-posture-kb-invites-private.js');
  vm.runInContext('var inviteClientId=null,inviteMethod=null;\n' + ['clearInviteSkipView', 'inviteSkipViewIsCurrent',
    'renderInviteSkipState', 'openInviteModal', 'closeInviteModal'].map(n => extract(invites, n)).join('\n'), ctx);
  return { ctx, calls, elements, buttons, statuses,
    save: field => ctx.saveOnboardSkip('skip-a', field || 'inviteSkipped'),
    ack: (n = 0, extra = {}) => calls.pending[n].resolve({ ...clone(calls.saves[n].candidate), ...extra, [calls.saves[n].field]: true }),
    open: async (id = 'skip-a') => { ctx._onboardResumeAfterInvite = id; await ctx.openInviteModal(id); } };
}
let count = 0;
async function test(label, run) { await run(); count++; console.log('OK ' + label); }
(async () => {
  for (const field of ['inviteSkipped', 'packageSkipped']) await test(field + ' uses a marker-only transaction and waits for ACK', async () => {
    const h = service(), local = clone(h.ctx.CL), first = h.save(field), duplicate = h.save(field);
    assert.equal(first, duplicate); await h.read(); assert.deepEqual(h.calls.writes, [{ [field]: true }]);
    let finished = false; first.then(() => { finished = true; }); await tick(); assert(!finished); assert.deepEqual(clone(h.ctx.CL), local);
    h.setRemote({ ...h.remote(), name: 'Concurrent name', notes: 'Concurrent note', extra: [3] });
    await h.ack(); const saved = await first; assert.equal(saved[field], true); assert.equal(h.remote().notes, 'Concurrent note');
    assert.equal(h.remote().name, 'Concurrent name'); assert.deepEqual(h.remote().extra, [3]); assert.deepEqual(clone(h.ctx.CL), local);
    await h.save(field); assert.equal(h.calls.transactions.length, 1);
  });
  await test('lost ACK retries the original snapshot and confirms an already true remote marker without writing', async () => {
    const h = service(), first = h.save(); await h.read();
    h.setRemote({ ...h.remote(), inviteSkipped: true, notes: 'Committed in another callback' });
    h.calls.transactions[0].gate.reject(Error('Lost ACK')); await assert.rejects(first, /Lost ACK/);
    h.client.notes = 'mutated'; h.operation.auth.uid = 'mutated';
    const retry = h.save(); await h.read(1); assert.deepEqual(h.calls.transactions[1].staged, []);
    await h.ack(1); const saved = await retry; assert.equal(saved.id, 'skip-a'); assert.equal(saved.inviteSkipped, true);
    assert.equal(saved.packageSkipped, undefined); assert.equal(saved.notes, 'Committed in another callback');
  });
  for (const phase of ['pending', 'cached']) await test('operation cannot be reused for another client, document or field while ' + phase, async () => {
    const h = service(), first = h.save(); await h.read();
    if (phase === 'cached') { await h.ack(); await first; }
    for (const [candidate, field] of [[{ ...h.client, id: 'skip-b' }, 'inviteSkipped'], [{ ...h.client, _fbId: 'doc-other' }, 'inviteSkipped'], [h.client, 'packageSkipped']])
      await assert.rejects(h.save(field, candidate), /zmienił/);
    assert.equal(h.calls.transactions.length, 1);
    if (phase === 'pending') { await h.ack(); await first; }
  });
  for (const invalid of ['status', 'inviteSent', '', null]) await test('rejects unsupported marker ' + invalid, async () => {
    const h = service(); await assert.rejects(h.save(invalid)); assert.equal(h.calls.transactions.length, 0);
  });
  for (const mutation of ['deleted', 'archived', 'reowned', 'identity', 'missing']) await test('server ' + mutation + ' prevents marker write', async () => {
    const h = service(), first = h.save();
    h.setRemote(mutation === 'missing' ? null : { ...h.remote(), ...(mutation === 'deleted' ? { deleted: true } :
      mutation === 'archived' ? { status: 'archived' } : mutation === 'reowned' ? { trainerId: 'other' } : { id: 'different' }) });
    await h.read(); await assert.rejects(first); assert.deepEqual(h.calls.writes, []);
  });
  for (const phase of ['before-read', 'before-ACK']) await test('session change ' + phase + ' prevents a successful receipt', async () => {
    const h = service(), first = h.save(); await tick();
    if (phase === 'before-ACK') await h.read();
    h.ctx.tenantSessionGeneration++; if (phase === 'before-read') await h.read(); else await h.ack();
    await assert.rejects(first); if (phase === 'before-read') assert.deepEqual(h.calls.writes, []);
  });
  for (const field of ['inviteSkipped', 'packageSkipped']) await test(field + ' UI locks, dedupes, retries same operation, and applies only after ACK', async () => {
    const h = ui(), original = clone(h.ctx.CL), first = h.save(field); assert.equal(first, h.save(field)); await tick();
    const idx = field === 'inviteSkipped' ? 0 : 1; assert(h.buttons[idx].disabled); assert.match(h.statuses[idx].textContent, /potwierdzenie/);
    assert.deepEqual(clone(h.ctx.CL), original); assert.equal(h.calls.notices.length, 0); assert.equal(h.calls.saves.length, 1);
    h.calls.pending[0].reject(Error('Offline')); assert.equal(await first, false);
    assert.deepEqual(clone(h.ctx.CL), original); assert(!h.buttons[idx].disabled); assert.match(h.buttons[idx].textContent, /Ponów/);
    const retry = h.save(field); await tick(); assert.equal(h.calls.saves[1].operation, h.calls.saves[0].operation);
    assert.deepEqual(h.calls.saves[1].candidate, h.calls.saves[0].candidate);
    h.ctx.CL[0].notes = 'Concurrent local edit'; h.ack(1, { notes: 'Old server note' }); assert.equal(await retry, true);
    assert.equal(h.ctx.CL[0][field], true); assert.equal(h.ctx.CL[0].notes, 'Concurrent local edit'); assert.deepEqual(clone(h.ctx.CL[1]), original[1]);
  });
  await test('unacknowledged listener marker is masked in checklist input during pending and failed save', async () => {
    const h = ui(), first = h.save(); await tick(); h.ctx.CL[0].inviteSkipped = true;
    assert.equal(h.ctx.clientForOnboardSkip(h.ctx.CL[0]).inviteSkipped, undefined);
    assert.equal(h.ctx.CL[0].inviteSkipped, true); h.calls.pending[0].reject(Error('Lost ACK')); await first;
    assert.equal(h.ctx.clientForOnboardSkip(h.ctx.CL[0]).inviteSkipped, undefined);
    const retry = h.save(); await tick(); h.ack(1); await retry; assert.equal(h.ctx.clientForOnboardSkip(h.ctx.CL[0]).inviteSkipped, true);
  });
  await test('central onboarding status masks listener markers until service confirmation', async () => {
    const h = ui();
    h.ctx.CLIENT_ONBOARD_STEPS = ['invite', 'intake', 'baseline', 'schedule', 'plan', 'calendar', 'package'].map(id => ({ id, missing: id }));
    h.ctx.clientOnboardHasBaseline = () => false; h.ctx.clientHasSchedulePrefs = () => false;
    h.ctx.clientHasAssignedPlan = () => false; h.ctx.clientHasCalendarOrSession = () => false;
    h.ctx.clientHasPackage = c => !!c.packageSkipped;
    vm.runInContext(extract(core, 'clientOnboardStatus'), h.ctx);
    const first = h.save('packageSkipped'); await tick(); h.ctx.CL[0].packageSkipped = true;
    assert.equal(h.ctx.clientOnboardStatus(h.ctx.CL[0]).package, false);
    assert.equal(h.ctx.clientOnboardStatus(h.ctx.CL[0]).done, 0);
    h.calls.pending[0].reject(Error('Lost ACK')); await first;
    assert.equal(h.ctx.clientOnboardStatus(h.ctx.CL[0]).package, false);
    const retry = h.save('packageSkipped'); await tick(); h.ack(1); await retry;
    assert.equal(h.ctx.clientOnboardStatus(h.ctx.CL[0]).package, true);
    assert.equal(h.ctx.clientOnboardStatus(h.ctx.CL[0]).done, 1);
  });
  for (const mode of ['session', 'removed', 'archived', 'reowned', 'document']) await test('late UI ACK after ' + mode + ' cannot mutate the current list', async () => {
    const h = ui(), first = h.save(); await tick();
    if (mode === 'session') { h.ctx._uid = 'new-owner'; h.ctx.tenantSessionGeneration++; h.ctx.clearOnboardSkipStates(); }
    if (mode === 'removed') h.ctx.CL.shift();
    if (mode === 'archived') h.ctx.CL[0].status = 'archived';
    if (mode === 'reowned') h.ctx.CL[0].trainerId = 'other';
    if (mode === 'document') h.ctx.CL[0]._fbId = 'different-doc';
    const before = clone(h.ctx.CL); h.ack(); assert.equal(await first, false); assert.deepEqual(clone(h.ctx.CL), before);
    assert(!h.calls.notices.some(message => /pominięte\.$/.test(message)));
  });
  await test('invite modal stays open on rejection, then closes and resumes only after successful retry', async () => {
    const h = ui(); await h.open(); const first = h.ctx.closeInviteModal(true); await tick();
    assert(h.elements['m-invite'].classList.contains('show')); assert(h.elements['inv-skip-btn'].disabled); assert(h.elements['inv-send-btn'].disabled);
    assert.equal(h.calls.resume.length, 0); h.calls.pending[0].reject(Error('Offline')); await first;
    assert(h.elements['m-invite'].classList.contains('show')); assert.match(h.elements['inv-skip-status'].textContent, /Ponów/);
    const retry = h.ctx.closeInviteModal(true); await tick(); h.ack(1); await retry;
    assert(!h.elements['m-invite'].classList.contains('show')); assert.deepEqual(h.calls.resume, ['skip-a']);
  });
  for (const target of ['closed', 'same-client-reopened', 'other-client']) await test('late invite ACK preserves ' + target + ' view and does not resume old checklist', async () => {
    const h = ui(); await h.open(); const first = h.ctx.closeInviteModal(true); await tick();
    await h.ctx.closeInviteModal(false); if (target !== 'closed') await h.open(target === 'other-client' ? 'skip-b' : 'skip-a');
    const view = h.ctx._inviteModalView, resumes = h.calls.resume.length, closes = h.calls.close.length;
    h.ack(); await first; assert.equal(h.calls.resume.length, resumes); assert.equal(h.calls.close.length, closes);
    assert.equal(h.ctx._inviteModalView, view); assert.equal(h.ctx.CL[0].inviteSkipped, true);
    if (target !== 'closed') assert(h.elements['m-invite'].classList.contains('show'));
  });
  for (const target of ['checklist', 'invite-direct', 'invite-onboard']) await test('opening ' + target + ' cancels actual delayed resume of client A', async () => {
    const h = ui(), timers = new Map(); let seq = 0;
    h.ctx.setTimeout = fn => { timers.set(++seq, fn); return seq; }; h.ctx.clearTimeout = id => timers.delete(id);
    h.ctx.getClientOnboard = () => ({ complete: false });
    vm.runInContext(['maybeResumeOnboard', 'openClientOnboardChecklist', 'openInviteFromOnboard'].map(n => extract(source, n)).join('\n'), h.ctx);
    await h.open(); await h.ctx.closeInviteModal(false); assert.equal(timers.size, 1);
    if (target === 'checklist') h.ctx.openClientOnboardChecklist('skip-b');
    if (target === 'invite-direct') await h.open('skip-b');
    if (target === 'invite-onboard') h.ctx.openInviteFromOnboard('skip-b');
    await tick(); assert.equal(timers.size, 0); assert.equal(h.ctx._onboardResumeTimer, null);
    if (target === 'checklist') assert.equal(h.ctx._onboardClientId, 'skip-b');
    else assert.equal(h.ctx._inviteModalView.clientId, 'skip-b');
  });
  console.log('PASS confirmed onboarding skip: ' + count + ' scenarios');
})().catch(error => { console.error(error); process.exitCode = 1; });
