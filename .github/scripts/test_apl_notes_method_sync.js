#!/usr/bin/env node
'use strict';
/** Auto-struktura PPL w apl-notes znika przy zmianie metody/dni. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('strip helper', /function aplStripAutoStructureNotes/.test(src03));
ok('sync helper', /function aplSyncAutoStructureNotes/.test(src03));
ok('toggle syncs methods/days', /groupId==='apl-methods'[\s\S]{0,120}aplSyncAutoStructureNotes/.test(src03));
ok('preset uses marker', /APL-AUTO-STRUCT/.test(src03) && /aplAutoStructureNoteBlock/.test(src03));
ok('ui hint', /Auto-struktura dni/.test(html) && html.includes('id="apl-notes"'));
ok('cache 03', html.includes('03-ai-plangen-bizstats-aicoach.js?v=25'));
ok('CI', wf.includes('test_apl_notes_method_sync.js'));

const start = src03.indexOf('function aplStripAutoStructureNotes');
const end = src03.indexOf('window.aplApplyHypertrophy3DayPreset=aplApplyHypertrophy3DayPreset;') + 'window.aplApplyHypertrophy3DayPreset=aplApplyHypertrophy3DayPreset;'.length;
ok('slice', start >= 0 && end > start);
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src03.slice(start, end), sandbox);

const stale = 'Wolę maszyny.\nSTRUKTURA 3 DNI: D1 Push+czworogłowe; D2 Pull+dwugłowe; D3 Upper (klatka+plecy+barki+ramiona). Priorytet sylwetkowy na start sesji.';
const cleaned = sandbox.aplStripAutoStructureNotes(stale);
ok('strips struktura line', /Wolę maszyny/.test(cleaned) && !/STRUKTURA 3 DNI/.test(cleaned));

const withMarker = 'Ręcznie\n' + sandbox.aplAutoStructureNoteBlock() + '\nKoniec';
const markedClean = sandbox.aplStripAutoStructureNotes(withMarker);
ok('marker strip keeps manual', /Ręcznie/.test(markedClean) && /Koniec/.test(markedClean) && !/Push\+czworogłowe/.test(markedClean));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll apl-notes-method-sync tests passed');
