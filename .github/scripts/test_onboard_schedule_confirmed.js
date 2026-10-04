#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8').replace(/\r\n?/g, '\n');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8').replace(/\r\n?/g, '\n');
function extract(src, name) {
  const start = src.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  assert(start >= 0, name + ' exists');
  const tail = src.slice(start), line = tail.split('\n')[0];
  return line.endsWith('}') ? line : tail.slice(0, tail.indexOf('\n}') + 2);
}
const clone = value => JSON.parse(JSON.stringify(value));
function element() {
  const classes = new Set();
  return { disabled: false, hidden: false, textContent: '', innerHTML: '', style: {},
    classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c),
      toggle(c, force) { const on = force === undefined ? !classes.has(c) : force; if (on) classes.add(c); else classes.delete(c); return on; } } };
}
function harness() {
  const calls = { saves: [], pending: [], notices: [], resume: [], render: [], closed: [], opened: [], unexpected: [] };
  const elements = {};
  for (const id of ['m-onboard-schedule', 'm-client-onboard', 'sched-onboard-banner', 'ob-sched-name',
    'ob-sched-save-btn', 'ob-sched-save-status', 'ob-sched-reload-btn', 'ob-sched-discard-btn']) elements[id] = element();
  const chips = [1, 2, 3, 4, 5, 6, 0].map(day => ({ ...element(), dataset: { wd: String(day) } }));
  const weekdays = elements['ob-sched-preferred-weekdays'] = element();
  weekdays.querySelectorAll = selector => selector.includes('.active') ? chips.filter(chip => chip.classList.contains('active')) : chips;
  elements['m-onboard-schedule'].querySelectorAll = selector => selector.includes('preferred-weekday-chip') ? chips :
    [...chips, elements['ob-sched-save-btn'], elements['ob-sched-reload-btn'], elements['ob-sched-discard-btn']];
  const ctx = { console, Map, Set, Object, JSON, Promise, parseInt, Date,
    _uid: 'schedule-owner', tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false,
    CL: [{ id: 'sched-a', trainerId: 'schedule-owner', name: 'Klient Alfa', status: 'active', preferredWeekdays: [1, 3],
      email: 'alfa@example.test', gender: 'female', weight: '81.2', trainingFreq: null, notes: 'Historyczna notatka', legacyField: { keep: true } },
      { id: 'sched-b', trainerId: 'schedule-owner', name: 'Klient Beta', status: 'active', preferredWeekdays: [2, 4] }],
    PL: [{ id: 'p-a', trainerId: 'schedule-owner', clientId: 'sched-a', days: [{ weekday: 1 }, { weekday: 3 }] }],
    SE: [{ id: 's-a', trainerId: 'schedule-owner', clientId: 'sched-a', date: '2026-10-10', source: 'planned' }],
    _onboardClientId: 'sched-a',
    document: { getElementById: id => elements[id] || null,
      querySelector: () => ctx.otherModalVisible ? element() : null,
      querySelectorAll: selector => selector.includes('preferred-weekday-chip') ? chips : elements['m-onboard-schedule'].querySelectorAll(selector) },
    escHtml: value => String(value == null ? '' : value),
    persistById: () => { calls.unexpected.push('persistById'); throw Error('Unexpected optimistic persistence'); },
    _setDoc: () => { calls.unexpected.push('setDoc'); throw Error('Unexpected direct persistence'); },
    renderDash: () => calls.render.push('dash'), renderClients: () => calls.render.push('clients'),
    renderClientOnboardChecklist: () => calls.render.push('checklist'),
    maybeResumeOnboard: id => calls.resume.push({ id, local: clone(ctx.CL) }),
    notify: message => calls.notices.push(String(message)),
    openM: id => { elements[id].classList.add('show'); calls.opened.push(id); },
    closeM: id => {
      if (id === 'm-onboard-schedule' && typeof ctx.captureOnboardScheduleDraft === 'function') ctx.captureOnboardScheduleDraft();
      elements[id].classList.remove('show'); calls.closed.push(id);
    },
    saveClientCardConfirmed: (candidate, operation) => {
      calls.saves.push({ candidate: clone(candidate), base: clone(operation.base), operation, edit: operation.edit });
      return new Promise((resolve, reject) => calls.pending.push({
        success: () => resolve({ ...clone(operation.base), ...clone(candidate), _fbId: candidate.id, clientCardWriteId: 'fixture-receipt' }),
        failure: remote => reject(Object.assign(Error('Fixture save interrupted'), remote ?
          { code: 'client-card-conflict', remote: clone(remote) } : {}))
      }));
    }
  };
  ctx.window = ctx;
  const blockStart = source.indexOf('const onboardScheduleDrafts');
  assert(blockStart >= 0, 'schedule draft store exists');
  const block = source.slice(blockStart, source.indexOf('function latestClientPlan', blockStart));
  const weekdayOptions = core.match(/const WEEKDAY_TRAIN_OPTIONS=[\s\S]*?\n\];/);
  assert(weekdayOptions, 'weekday options exist');
  vm.createContext(ctx);
  vm.runInContext([weekdayOptions[0], ...['assignmentSession', 'assignmentSessionCurrent', 'assertAssignmentSession',
    'normalizePreferredWeekdays', 'readPreferredWeekdaysFrom', 'setPreferredWeekdayChips', 'initPreferredWeekdaysForm'].map(name => extract(core, name)),
    block].join('\n'), ctx, { filename: 'schedule-confirmed-fixture.js' });
  return { ctx, calls, elements, chips,
    open: (id = 'sched-a') => ctx.openClientScheduleFromOnboard(id),
    choose: days => ctx.setPreferredWeekdayChips('ob-sched', days),
    selected: () => clone(ctx.readPreferredWeekdaysFrom('ob-sched')),
    local: () => clone(ctx.CL),
    state: () => ctx._onboardScheduleState,
    save: () => ctx.saveClientScheduleFromOnboard() };
}
let count = 0;
async function test(label, run) { await run(); count++; console.log('OK ' + label); }
(async () => {
  await test('pending/rejected schedule preserves CL, plans, sessions and original edit base; retry confirms once', async () => {
    const h = harness(); h.open(); h.choose([2, 5]);
    const before = h.local(), plans = clone(h.ctx.PL), sessions = clone(h.ctx.SE);
    const first = h.save(); assert.deepEqual(h.local(), before);
    assert.deepEqual(clone(h.ctx.PL), plans); assert.deepEqual(clone(h.ctx.SE), sessions);
    assert.equal(h.calls.resume.length, 0); assert.equal(h.calls.render.length, 0); assert.equal(h.calls.notices.length, 0);
    assert(h.state().pending); assert(h.elements['ob-sched-save-btn'].disabled); assert(h.chips.every(chip => chip.disabled));
    await h.save(); assert.equal(h.calls.saves.length, 1);
    h.calls.pending[0].failure(); await first; assert.deepEqual(h.local(), before);
    assert.match(h.state().message, /Ponów/); assert(!h.elements['ob-sched-save-btn'].disabled);
    assert(h.elements['m-onboard-schedule'].classList.contains('show'));
    h.choose([0]); const retry = h.save();
    assert.deepEqual(h.calls.saves[1].candidate, h.calls.saves[0].candidate);
    assert.equal(h.calls.saves[1].operation, h.calls.saves[0].operation);
    assert.deepEqual(h.calls.saves[1].base, before[0]); assert.equal(h.calls.saves[1].edit, true);
    h.calls.pending[1].success(); await retry;
    assert.deepEqual(clone(h.ctx.CL[0].preferredWeekdays), [2, 5]); assert.deepEqual(h.local()[1], before[1]);
    assert.equal(h.ctx.CL[0].clientCardWriteId, 'fixture-receipt');
    assert.deepEqual(clone(h.ctx.PL), plans); assert.deepEqual(clone(h.ctx.SE), sessions);
    assert.equal(h.calls.resume.length, 1); assert.equal(h.calls.resume[0].id, 'sched-a');
    assert.deepEqual(h.calls.resume[0].local[0].preferredWeekdays, [2, 5]);
    assert(!h.elements['m-onboard-schedule'].classList.contains('show')); assert.equal(h.calls.unexpected.length, 0);
  });
  await test('editable, pending and failed schedule drafts survive modal close and reopen', async () => {
    const h = harness(); h.open(); h.choose([0, 6]); h.ctx.closeScheduleOnboardModal(); h.open();
    assert.deepEqual(h.selected(), [6, 0]);
    const first = h.save(); const operation = h.calls.saves[0].operation;
    h.ctx.closeScheduleOnboardModal(); h.open(); assert.deepEqual(h.selected(), [6, 0]); assert(h.chips.every(chip => chip.disabled));
    h.calls.pending[0].failure(); await first; h.ctx.closeScheduleOnboardModal(); h.open();
    assert.deepEqual(h.selected(), [6, 0]); assert(h.chips.every(chip => chip.disabled));
    const retry = h.save(); assert.equal(h.calls.saves[1].operation, operation);
    h.calls.pending[1].success(); await retry;
    assert(!h.elements['m-onboard-schedule'].classList.contains('show'));
  });
  await test('candidate contains only weekday edits while operation base preserves raw unrelated fields', async () => {
    const h = harness(), base = h.local()[0]; h.open(); h.choose([4]); const save = h.save();
    assert.deepEqual(h.calls.saves[0].candidate, { id: base.id, trainerId: base.trainerId, preferredWeekdays: [4] });
    assert.deepEqual(h.calls.saves[0].base, base); assert.equal(h.calls.saves[0].base.trainingFreq, null);
    h.calls.pending[0].success(); await save;
  });
  await test('schedule ACK cannot overwrite unrelated local fields changed during confirmation', async () => {
    const h = harness(); h.open(); h.choose([2]); const save = h.save();
    h.ctx.CL[0].notes = 'Nowa lokalna notatka'; h.ctx.CL[0].weight = 77;
    h.calls.pending[0].success(); await save;
    assert.equal(h.ctx.CL[0].notes, 'Nowa lokalna notatka'); assert.equal(h.ctx.CL[0].weight, 77);
    assert.deepEqual(clone(h.ctx.CL[0].preferredWeekdays), [2]);
  });
  for (const mode of ['success', 'failure']) await test('background ' + mode + ' cannot replace client B modal or resume client A checklist', async () => {
    const h = harness(); h.open(); h.choose([6]); const save = h.save();
    h.open('sched-b'); h.choose([0]); const b = h.state();
    const resumeBefore = h.calls.resume.length;
    h.calls.pending[0][mode](); await save;
    assert.equal(h.state(), b); assert.deepEqual(h.selected(), [0]); assert(h.chips.every(chip => !chip.disabled));
    assert(h.elements['m-onboard-schedule'].classList.contains('show')); assert.equal(h.calls.resume.length, resumeBefore);
    assert.equal(h.elements['ob-sched-name'].textContent, 'Klient Beta');
    assert.deepEqual(clone(h.ctx.CL[1].preferredWeekdays), [2, 4]);
    if (mode === 'success') { assert.deepEqual(clone(h.ctx.CL[0].preferredWeekdays), [6]); assert(h.calls.notices.some(text => /Klient Alfa/.test(text))); }
    else { h.open(); assert.deepEqual(h.selected(), [6]); assert(!h.elements['ob-sched-save-btn'].disabled); }
  });
  for (const mode of ['success', 'failure']) await test('tenant change suppresses all old schedule ' + mode + ' local effects', async () => {
    const h = harness(); h.open(); h.choose([2]); const save = h.save(), before = h.local();
    h.ctx._uid = 'other-owner'; h.ctx.tenantSessionGeneration++; h.ctx.clearOnboardScheduleDrafts();
    h.calls.pending[0][mode](); await save;
    assert.deepEqual(h.local(), before); assert.equal(h.calls.resume.length, 0); assert.equal(h.calls.render.length, 0);
    assert.equal(h.calls.notices.length, 0);
  });
  for (const mode of ['removed', 'archived', 'foreign-owner', 'different-document']) await test('late ACK cannot restore or update a locally ' + mode + ' client', async () => {
    const h = harness(); h.open(); h.choose([2]); const save = h.save();
    if (mode === 'removed') h.ctx.CL = h.ctx.CL.filter(client => client.id !== 'sched-a');
    else if (mode === 'archived') h.ctx.CL[0].status = 'archived';
    else if (mode === 'foreign-owner') h.ctx.CL[0].trainerId = 'other-owner';
    else h.ctx.CL[0]._fbId = 'replacement';
    const local = h.local(); h.calls.pending[0].success(); await save; assert.deepEqual(h.local(), local);
    assert(h.state().saved); assert(h.elements['ob-sched-save-btn'].disabled); assert.equal(h.calls.resume.length, 0);
    assert(!h.calls.notices.some(text => text.startsWith('Dni treningowe klienta')));
    await h.save(); assert.equal(h.calls.saves.length, 1);
  });
  await test('conflict reload adopts remote edit base and requires an explicit new save', async () => {
    const h = harness(); h.open(); h.choose([6]); const original = h.local(), save = h.save();
    const remote = { ...original[0], name: 'Alfa z serwera', preferredWeekdays: [2, 4], notes: 'Zdalna notatka' };
    h.calls.pending[0].failure(remote); await save; assert.deepEqual(h.local(), original); assert.deepEqual(h.selected(), [6]);
    assert(h.elements['ob-sched-save-btn'].disabled); assert(!h.elements['ob-sched-reload-btn'].hidden);
    await h.save(); assert.equal(h.calls.saves.length, 1);
    h.ctx.reloadOnboardScheduleDraft(); assert.deepEqual(h.selected(), [2, 4]); assert(!h.elements['ob-sched-save-btn'].disabled);
    h.choose([3]); const retry = h.save();
    assert.deepEqual(h.calls.saves[1].base, remote);
    assert.deepEqual(h.calls.saves[1].candidate, { id: remote.id, trainerId: remote.trainerId, preferredWeekdays: [3] });
    assert.notEqual(h.calls.saves[1].operation, h.calls.saves[0].operation);
    h.calls.pending[1].success(); await retry;
  });
  await test('empty weekday selection validates without persistence or checklist completion', async () => {
    const h = harness(); h.open(); h.choose([]); await h.save();
    assert.equal(h.calls.saves.length, 0); assert.equal(h.calls.resume.length, 0); assert(h.calls.notices.some(text => /dzień/.test(text)));
  });
  await test('generic modal close preserves draft and prevents late ACK from resuming or reopening it', async () => {
    const h = harness(); h.open(); h.choose([6]); const save = h.save(); h.ctx.closeM('m-onboard-schedule');
    h.calls.pending[0].success(); await save;
    assert.equal(h.calls.resume.length, 0); assert(!h.elements['m-onboard-schedule'].classList.contains('show'));
    assert.deepEqual(clone(h.ctx.CL[0].preferredWeekdays), [6]);
    await h.save(); assert.equal(h.calls.saves.length, 1);
  });
  for (const mode of ['success', 'failure']) await test('schedule behind another visible modal receives ' + mode + ' feedback without stealing navigation', async () => {
    const h = harness(); h.open(); h.choose([6]); const save = h.save(); h.ctx.otherModalVisible = true;
    h.calls.pending[0][mode](); await save;
    assert(h.elements['m-onboard-schedule'].classList.contains('show')); assert.equal(h.calls.resume.length, 0);
    assert.equal(h.elements['ob-sched-save-btn'].disabled, mode === 'success');
    if (mode === 'failure') assert.match(h.elements['ob-sched-save-status'].textContent, /Ponów/);
  });
  await test('base and candidate remain immutable snapshots when live CL changes before first save', async () => {
    const h = harness(); h.open(); const original = h.local()[0];
    h.ctx.CL[0].notes = 'Nowa notatka'; h.ctx.CL[0].preferredWeekdays = [6]; h.choose([2]); const save = h.save();
    assert.deepEqual(h.calls.saves[0].base, original); assert(Object.isFrozen(h.state().base));
    assert(Object.isFrozen(h.state().candidate)); assert(Object.isFrozen(h.state().candidate.preferredWeekdays));
    h.calls.pending[0].failure(); await save;
    assert.equal(h.ctx.CL[0].notes, 'Nowa notatka'); assert.deepEqual(clone(h.ctx.CL[0].preferredWeekdays), [6]);
  });
  for (const kind of ['not-ready', 'foreign-owner', 'archived', 'client-mode']) await test('open rejects unauthorized ' + kind + ' schedule data before creating a draft', async () => {
    const h = harness();
    if (kind === 'not-ready') h.ctx._tenantDataReady = false;
    else if (kind === 'foreign-owner') h.ctx.CL[0].trainerId = 'other-owner';
    else if (kind === 'archived') h.ctx.CL[0].status = 'archived'; else h.ctx._clientAppMode = true;
    h.open(); assert(!h.state()); assert.equal(h.calls.saves.length, 0); assert.equal(h.calls.opened.length, 0);
  });
  await test('untouched legacy weekdays preserve raw types, while absent weekdays explicitly save rendered defaults', async () => {
    const h = harness(); h.ctx.CL[0].preferredWeekdays = ['2', '4']; h.open(); const save = h.save();
    assert.deepEqual(h.calls.saves[0].candidate.preferredWeekdays, ['2', '4']);
    h.calls.pending[0].success(); await save;
    const fresh = harness(); delete fresh.ctx.CL[0].preferredWeekdays; fresh.open(); const defaults = fresh.save();
    assert.deepEqual(fresh.calls.saves[0].candidate.preferredWeekdays, [1, 3, 5]);
    assert(!Object.hasOwn(fresh.calls.saves[0].base, 'preferredWeekdays'));
    fresh.calls.pending[0].success(); await defaults;
  });
  for (const next of ['sched-a', 'sched-b']) await test('quick reopen for ' + next + ' cancels the real delayed checklist resume callback', async () => {
    const h = harness(), timers = new Map(); let sequence = 0;
    h.ctx.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
    h.ctx.clearTimeout = id => timers.delete(id);
    h.ctx.getClientOnboard = () => ({ complete: false });
    h.ctx.openClientOnboardChecklist = id => { h.calls.resume.push({ id }); h.elements['m-client-onboard'].classList.add('show'); };
    vm.runInContext(extract(source, 'maybeResumeOnboard'), h.ctx);
    h.open(); h.choose([6]); h.ctx.closeScheduleOnboardModal();
    assert.equal(timers.size, 1); assert.equal([...timers.values()][0].delay, 450);
    h.open(next); assert.equal(timers.size, 0); assert.equal(h.ctx._onboardResumeTimer, null);
    for (const timer of [...timers.values()]) timer.callback();
    assert.equal(h.calls.resume.length, 0); assert(!h.elements['m-client-onboard'].classList.contains('show'));
    assert(h.elements['m-onboard-schedule'].classList.contains('show'));
    h.choose([2]); const save = h.save(); assert.equal(h.calls.saves.length, 1, 'stale checklist must not block the new schedule save');
    h.calls.pending[0].success(); await save;
  });
  for (const mode of ['unsent', 'conflict', 'pending', 'uncertain']) await test('discard handles ' + mode + ' schedule drafts safely', async () => {
    const h = harness(); h.open(); h.choose([6]); const state = h.state(), original = h.local();
    if (mode !== 'unsent') state.candidate = { ...original[0], preferredWeekdays: [6] };
    if (mode === 'conflict') state.conflict = original[0]; if (mode === 'pending') state.pending = true;
    h.ctx.discardOnboardScheduleDraft(); const safe = mode === 'unsent' || mode === 'conflict';
    assert.equal(h.state() === null, safe); assert.deepEqual(h.local(), original); assert.equal(h.calls.saves.length, 0);
    if (safe) { h.open(); assert.deepEqual(h.selected(), [1, 3]); }
  });
  console.log('\n' + count + ' confirmed schedule scenarios passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
