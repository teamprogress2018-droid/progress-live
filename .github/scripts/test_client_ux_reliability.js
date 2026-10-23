#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const live = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const plans = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'theme.css'), 'utf8');

let failed = 0;
function ok(name, condition) {
  if (condition) console.log('OK  ', name);
  else { console.error('FAIL', name); failed++; }
}

const writeLocalSource = live.match(/function cwWriteLocal\(cw,preserveSyncState\)\{[\s\S]*?\n\}/);
const syncTextSource = live.match(/function cwSyncStateText\(cw\)\{[\s\S]*?\n\}/);
ok('local draft and sync status helpers exist', !!writeLocalSource && !!syncTextSource);
if (writeLocalSource && syncTextSource) {
  const storage = { value: '', setItem(key, value) { this.value = value; } };
  const window = { localStorage: storage };
  const context = vm.createContext({ window, localStorage: storage, cwDraftKey: () => 'draft', JSON, Date });
  vm.runInContext(writeLocalSource[0] + '\n' + syncTextSource[0], context);
  const savedDraft = { syncState: 'synced', exercises: [], phase: 'exercise' };
  ok('successful device save confirms local status', context.cwWriteLocal(savedDraft) && savedDraft.syncState === 'local' && JSON.parse(storage.value).state.syncState === 'local');
  const failingStorage = { setItem() { throw new Error('quota'); } };
  context.window.localStorage = failingStorage;
  context.localStorage = failingStorage;
  const failedDraft = { syncState: 'synced', exercises: [], phase: 'exercise' };
  ok('failed device save reports error', context.cwWriteLocal(failedDraft) === false && failedDraft.syncState === 'error' && context.cwSyncStateText(failedDraft) === 'Nie potwierdzono zapisu');
  failedDraft.syncState = 'synced';
  context.window.localStorage = storage;
  context.localStorage = storage;
  ok('confirmed server status survives local cache write', context.cwWriteLocal(failedDraft, true) && failedDraft.syncState === 'synced');
}

const latestPlan = plans.match(/function latestClientPlan\(clientId\)\{[\s\S]*?\n\}/);
if (latestPlan) {
  const context = vm.createContext({ window: { PL: [
    { id: 'archived-new', clientId: 'c1', updatedAt: '2026-10-20', status: 'archived' },
    { id: 'active-old', clientId: 'c1', updatedAt: '2026-10-10' },
    { id: 'other-client', clientId: 'c2', updatedAt: '2026-10-22' }
  ] } });
  vm.runInContext(latestPlan[0], context);
  ok('archived plan is never returned as active', context.latestClientPlan('c1')?.id === 'active-old');
} else ok('active plan selector exists', false);

ok('check-in list excludes archived clients and prioritizes overdue items', /!c\.archived&&!c\.deleted&&c\.status!=='archived'/.test(portal) && /statusRank\[getCIStatus\(a\.id\)\]/.test(portal));
ok('set confirmation requires entered reps or duration', /Wpisz liczbę powtórzeń lub czas przed zatwierdzeniem serii/.test(live));
ok('failed chat send retains draft and confirms server write', /if\(sent\)inp\.value='';/.test(live) && /clientConfirmWrite\('messages',msg/.test(live));
ok('generator keeps advanced methods available behind disclosure', /apl-methods-more/.test(html) && /apl-progression-more/.test(html));
ok('mobile generator uses one page scroll', /#screen-aiplangen \.apl-form \{ width: 100%; max-height: none; overflow: visible; \}/.test(theme));
ok('client labels and touch targets are enlarged', /#clive-player-inner \.cw-set-row input,[\s\S]*?min-height: 44px/.test(theme) && /\.cw-rir-help/.test(theme));

if (failed) process.exit(1);
console.log('\nAll client UX reliability tests passed.');
