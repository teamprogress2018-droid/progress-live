#!/usr/bin/env node
'use strict';
/** Po zmianie imienia — cache clientName na planach / pakietach / fakturach / onboardingu. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '../..');
const src01 = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

function extract(src, name) {
  const at = src.indexOf('function ' + name);
  if (at < 0) throw new Error('missing ' + name);
  const start = src.slice(at - 6, at) === 'async ' ? at - 6 : at;
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK  ', name);
}

ok('helper in core', src01.includes('function syncClientNameCache'));
const inlineSave = extract(src09, 'saveCPEdit');
ok('saveCPEdit syncs caches after confirmed service acknowledgement',
  inlineSave.includes('await saveClientCardConfirmed') && inlineSave.includes('syncClientNameCache(c.id,c.name)') &&
  inlineSave.indexOf('await saveClientCardConfirmed') < inlineSave.indexOf('syncClientNameCache(c.id,c.name)') &&
  !inlineSave.includes('persistById') && !inlineSave.includes('_setDoc'));
ok('saveClient edit hooks sync', src05.includes("syncClientNameCache(c.id,c.name)"));
ok('cache 01', html.includes('01-core.js?v=126'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=82'));
ok('cache 09', html.includes('09-posture-kb-invites-private.js?v=54'));
ok('CI', wf.includes('test_client_name_cache.js'));

const persist = [];
const sandbox = {
  window: {
    PACKAGES: [
      { id: 'pk1', clientId: 'c1', clientName: 'Anna', title: '8 sesji' },
      { id: 'pk2', clientId: 'c2', clientName: 'Bartek', title: 'Inny' }
    ],
    PL: [
      { id: 'p1', clientId: 'c1', clientName: 'Anna', name: 'FBW' },
      { id: 'p2', clientId: 'c2', clientName: 'Bartek', name: 'PPL' }
    ],
    INVOICES: [
      { id: 'inv1', pkgId: 'pk1', clientName: 'Anna', amount: 800 },
      { id: 'inv2', pkgId: 'pk2', clientName: 'Bartek', amount: 100 },
      { id: 'inv3', clientId: 'c1', clientName: 'Anna', amount: 50 }
    ],
    ONBOARDING_FLOW: {
      history: [
        { clientId: 'c1', clientName: 'Anna', parts: 'ankieta' },
        { clientId: 'c2', clientName: 'Bartek', parts: 'plan' }
      ]
    }
  },
  persistById: (col, rec) => persist.push({ col, id: rec && rec.id, name: rec && rec.clientName }),
  console
};
sandbox.window.persistById = sandbox.persistById;
vm.runInNewContext(extract(src01, 'syncClientNameCache') + '\nwindow.syncClientNameCache=syncClientNameCache;', sandbox);

const r0 = sandbox.syncClientNameCache('', 'X');
ok('skip empty id', r0.updated === 0);

const r1 = sandbox.syncClientNameCache('c1', 'Anna Kowalska');
ok('updated count', r1.updated === 5, 'got ' + r1.updated);
ok('package name', sandbox.window.PACKAGES[0].clientName === 'Anna Kowalska');
ok('other package untouched', sandbox.window.PACKAGES[1].clientName === 'Bartek');
ok('plan name', sandbox.window.PL[0].clientName === 'Anna Kowalska');
ok('invoice via pkgId', sandbox.window.INVOICES[0].clientName === 'Anna Kowalska');
ok('other invoice untouched', sandbox.window.INVOICES[1].clientName === 'Bartek');
ok('invoice via clientId', sandbox.window.INVOICES[2].clientName === 'Anna Kowalska');
ok('onboard history', sandbox.window.ONBOARDING_FLOW.history[0].clientName === 'Anna Kowalska');
ok('other history untouched', sandbox.window.ONBOARDING_FLOW.history[1].clientName === 'Bartek');
ok('persisted packages+plans+invoices+flow', persist.some(p => p.col === 'packages') && persist.some(p => p.col === 'plans') && persist.some(p => p.col === 'invoices') && persist.some(p => p.col === 'onboardingFlows'));

persist.length = 0;
const r2 = sandbox.syncClientNameCache('c1', 'Anna Kowalska');
ok('idempotent', r2.updated === 0 && persist.length === 0);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
// Exercise the actual inline save function without a browser. Rendering has
// browser coverage; these checks enforce the CL/cache acknowledgement boundary.
const clone = value => JSON.parse(JSON.stringify(value));
function profileHarness(raw) {
  const calls = { service: [], pending: [], notices: [], renders: [], cacheWrites: [], stateRenders: [] };
  const base = raw || { id: 'c1', trainerId: 'trainer-a', name: 'Anna', email: 'anna@example.test',
    phone: '123456789', age: 40, gender: 'K', weight: 70, height: 170, status: 'active',
    goal: 'masa', trainingFreq: 2, preferredWeekdays: [2, 4], notes: 'Oryginalna notatka' };
  const controls = {};
  const fieldIds = { name: 'cpe-name', email: 'cpe-email', phone: 'cpe-phone', age: 'cpe-age',
    gender: 'cpe-gender', weight: 'cpe-weight', height: 'cpe-height', status: 'cpe-status',
    activityLevel: 'cpe-activity', sportNotes: 'cpe-sport-notes', notes: 'cpe-notes' };
  for (const [key, id] of Object.entries(fieldIds)) {
    let value = base[key];
    if (key === 'gender') value = value === 'female' || value === 'K' ? 'K' : 'M';
    else if (key === 'activityLevel') value = value || 'moderate';
    controls[id] = { value: value == null ? '' : String(value) };
  }
  const ctx = { console, Map, Object, JSON, Promise, parseFloat, parseInt,
    _uid: 'trainer-a', tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false, CL: [clone(base)], cpClientId: base.id, cpTab: 'overview',
    PACKAGES: [{ id: 'pk1', clientId: base.id, clientName: base.name }],
    PL: [{ id: 'p1', clientId: base.id, clientName: base.name }],
    INVOICES: [{ id: 'i1', pkgId: 'pk1', clientName: base.name }],
    ONBOARDING_FLOW: { history: [{ clientId: base.id, clientName: base.name }] },
    document: { getElementById: id => controls[id] || null },
    normalizeClientEmail: value => value.trim().toLowerCase(),
    clientEmailValid: value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    normalizeClientGender: value => value === 'female' || value === 'K' ? 'K' : 'M',
    persistById: (collection, record) => {
      assert.notEqual(collection, 'clients', 'inline edits never use optimistic client persistence');
      calls.cacheWrites.push({ collection, record: clone(record) });
    },
    notify: text => calls.notices.push(text),
    renderClients: () => calls.renders.push('clients'), renderDash: () => calls.renders.push('dash'),
    renderCPOverview: () => calls.renders.push('overview'),
    renderCPEditSaveState: state => calls.stateRenders.push({ pending: state.pending, saved: state.saved, message: state.message }),
    cpEditIsCurrent: state => ctx.current && ctx._cpEditState === state && ctx.assignmentSessionCurrent(state.auth),
    current: true,
    saveClientCardConfirmed: (candidate, operation) => {
      calls.service.push({ candidate: clone(candidate), base: clone(operation.base), operation });
      return new Promise((resolve, reject) => calls.pending.push({
        success: () => resolve({ ...clone(candidate), _fbId: candidate.id }),
        failure: remote => reject(Object.assign(Error('Fixture connection interrupted'), remote ?
          { code: 'client-card-conflict', remote: clone(remote) } : {}))
      }));
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const constants = src08.match(/const cpEditFieldIds=[^\n]+/)[0];
  const code = [constants, extract(src08, 'cpEditClone'), extract(src08, 'cpEditFields'),
    ...['assignmentSession', 'assignmentSessionCurrent', 'assertAssignmentSession', 'syncClientNameCache'].map(name => extract(src01, name)),
    inlineSave].join('\n');
  vm.runInContext(code, ctx, { filename: 'profile-confirmation-fixture.js' });
  const auth = ctx.assignmentSession(), original = clone(base);
  const state = ctx._cpEditState = { clientId: base.id, auth, base: original, fields: clone(original),
    displayBase: ctx.cpEditFields(), card: {}, open: true, operation: { auth, edit: true, base: original } };
  ctx._cpEditingClientId = base.id;
  return { ctx, calls, controls, state, base: clone(base),
    caches: () => [ctx.PL[0].clientName, ctx.PACKAGES[0].clientName, ctx.INVOICES[0].clientName,
      ctx.ONBOARDING_FLOW.history[0].clientName] };
}
let scenarios = 0;
async function scenario(label, run) { await run(); scenarios++; console.log('OK  ', label); }
(async () => {
  await scenario('pending/rejected profile rename leaves CL and caches untouched; retry confirms once', async () => {
    const h = profileHarness(), before = clone(h.ctx.CL), caches = h.caches();
    h.controls['cpe-name'].value = 'Anna Kowalska';
    h.controls['cpe-notes'].value = 'Zachowaj tę notatkę';
    const save = h.ctx.saveCPEdit('c1');
    assert.deepEqual(clone(h.ctx.CL), before); assert.deepEqual(h.caches(), caches);
    assert.equal(h.state.pending, true); assert.equal(h.calls.notices.length, 0); assert.equal(h.calls.cacheWrites.length, 0);
    await h.ctx.saveCPEdit('c1'); assert.equal(h.calls.service.length, 1);
    h.calls.pending[0].failure(); await save;
    assert.deepEqual(clone(h.ctx.CL), before); assert.deepEqual(h.caches(), caches);
    assert.match(h.state.message, /Ponów zapis/); assert.equal(h.state.pending, false);
    h.controls['cpe-name'].value = 'Accidental programmatic modification';
    const retry = h.ctx.saveCPEdit('c1');
    assert.equal(h.calls.service[1].operation, h.calls.service[0].operation);
    assert.deepEqual(h.calls.service[1].candidate, h.calls.service[0].candidate);
    assert.deepEqual(h.calls.service[1].base, before[0]);
    h.calls.pending[1].success(); await retry;
    assert.equal(h.ctx.CL[0].name, 'Anna Kowalska'); assert.equal(h.ctx.CL[0].notes, 'Zachowaj tę notatkę');
    assert(h.caches().every(value => value === 'Anna Kowalska'));
    assert.equal(h.calls.cacheWrites.length, 4); assert.equal(h.state.saved, true);
    await h.ctx.saveCPEdit('c1'); assert.equal(h.calls.service.length, 2);
  });
  await scenario('name-only profile edit preserves raw fields and absent defaults', async () => {
    const raw = { id: 'c1', trainerId: 'trainer-a', name: 'Historyczna Anna', email: 'history@example.test',
      status: 'active', gender: 'female', age: null, weight: '81.2', trainingFreq: null,
      goal: 'legacy-goal', preferredWeekdays: ['2', '4'], priorSports: ['running'], notes: 'Historia',
      legacyField: { retain: true } };
    const h = profileHarness(raw); h.controls['cpe-name'].value = 'Anna po edycji';
    const save = h.ctx.saveCPEdit('c1');
    assert.deepEqual(h.calls.service[0].candidate, { ...raw, name: 'Anna po edycji' });
    assert.deepEqual(h.calls.service[0].base, raw);
    h.calls.pending[0].success(); await save;
  });
  await scenario('missing intake controls never clear unrelated intake or sport data', async () => {
    const raw = { id: 'c1', trainerId: 'trainer-a', name: 'Anna', email: 'anna@example.test', status: 'active',
      goal: 'redukcja', level: 'legacy-level', trainingFreq: null, preferredTrainTime: 'custom-time',
      preferredWeekdays: ['2'], injuries: 'Kolano', priorSports: ['running'], activityLevel: 'legacy-activity',
      additional_activities: [{ sport: 'running', frequency_per_week: 2 }], physiquePriority: ['back'] };
    const h = profileHarness(raw); h.controls['cpe-name'].value = 'Anna z nazwiskiem';
    const save = h.ctx.saveCPEdit('c1');
    assert.deepEqual(h.calls.service[0].candidate, { ...raw, name: 'Anna z nazwiskiem' });
    h.calls.pending[0].success(); await save;
  });
  await scenario('edit base stays the entry snapshot when live CL changes before save', async () => {
    const h = profileHarness(); h.controls['cpe-name'].value = 'Moja zmiana';
    h.ctx.CL[0].notes = 'Nowsza lokalna wersja';
    const local = clone(h.ctx.CL), save = h.ctx.saveCPEdit('c1');
    assert.deepEqual(h.calls.service[0].base, h.base);
    assert.deepEqual(h.calls.service[0].candidate, { ...h.base, name: 'Moja zmiana' });
    h.calls.pending[0].failure(); await save;
    assert.deepEqual(clone(h.ctx.CL), local);
  });
  for (const result of ['success', 'failure']) await scenario('tenant change suppresses old profile ' + result + ' effects', async () => {
    const h = profileHarness(), local = clone(h.ctx.CL), caches = h.caches();
    h.controls['cpe-name'].value = 'Stara sesja'; const save = h.ctx.saveCPEdit('c1');
    h.ctx._uid = 'trainer-b'; h.ctx.tenantSessionGeneration++;
    h.calls.pending[0][result](); await save;
    assert.deepEqual(clone(h.ctx.CL), local); assert.deepEqual(h.caches(), caches);
    assert.equal(h.calls.notices.length, 0); assert.equal(h.calls.renders.length, 0); assert.equal(h.calls.cacheWrites.length, 0);
  });
  for (const mode of ['removed', 'archived', 'other-owner', 'different-document']) await scenario('late ACK cannot overwrite a locally ' + mode + ' client', async () => {
    const h = profileHarness(); h.controls['cpe-name'].value = 'Spóźniona zmiana';
    const save = h.ctx.saveCPEdit('c1');
    if (mode === 'removed') h.ctx.CL = [];
    else if (mode === 'archived') h.ctx.CL[0].status = 'archived';
    else if (mode === 'different-document') h.ctx.CL[0]._fbId = 'replacement-document';
    else h.ctx.CL[0].trainerId = 'trainer-b';
    const local = clone(h.ctx.CL), caches = h.caches(); h.calls.pending[0].success(); await save;
    assert.deepEqual(clone(h.ctx.CL), local); assert.deepEqual(h.caches(), caches);
    assert.equal(h.state.saved, true); assert.equal(h.calls.cacheWrites.length, 0);
    assert(!h.calls.notices.some(text => text.includes('zaktualizowany')));
    await h.ctx.saveCPEdit('c1'); assert.equal(h.calls.service.length, 1);
  });
  await scenario('background ACK updates saved data without rendering over another client or tab', async () => {
    const h = profileHarness(); h.controls['cpe-name'].value = 'Potwierdzona Anna';
    const save = h.ctx.saveCPEdit('c1'); h.ctx.current = false;
    h.ctx.cpClientId = 'c2'; h.ctx.cpTab = 'training';
    h.calls.pending[0].success(); await save;
    assert.equal(h.ctx.CL[0].name, 'Potwierdzona Anna'); assert(h.caches().every(value => value === 'Potwierdzona Anna'));
    assert(!h.calls.renders.includes('overview'));
    assert.equal(h.calls.notices.length, 1); assert.match(h.calls.notices[0], /Potwierdzona Anna.*zaktualizowany/);
    assert.equal(h.ctx.cpClientId, 'c2'); assert.equal(h.ctx.cpTab, 'training');
  });
  await scenario('conflict retains candidate and original caches without permitting blind retry', async () => {
    const h = profileHarness(), before = clone(h.ctx.CL), caches = h.caches();
    h.controls['cpe-name'].value = 'Moja zmiana'; const save = h.ctx.saveCPEdit('c1');
    const remote = { ...h.base, name: 'Zdalna Anna', phone: '555666777' };
    h.calls.pending[0].failure(remote); await save;
    assert.deepEqual(clone(h.ctx.CL), before); assert.deepEqual(h.caches(), caches);
    assert.deepEqual(clone(h.state.conflict), remote); assert.equal(h.state.candidate.name, 'Moja zmiana');
    assert.match(h.state.message, /Wczytaj aktualne dane/); assert.equal(h.calls.cacheWrites.length, 0);
    await h.ctx.saveCPEdit('c1'); assert.equal(h.calls.service.length, 1);
  });
  await scenario('inactive profile status changes only after confirmed acknowledgement', async () => {
    const h = profileHarness(); h.controls['cpe-status'].value = 'inactive'; const save = h.ctx.saveCPEdit('c1');
    assert.equal(h.ctx.CL[0].status, 'active'); assert.equal(h.calls.service[0].candidate.status, 'inactive');
    h.calls.pending[0].success(); await save; assert.equal(h.ctx.CL[0].status, 'inactive');
  });
  console.log('\nAll client-name-cache tests and ' + scenarios + ' inline confirmed-save scenarios passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
