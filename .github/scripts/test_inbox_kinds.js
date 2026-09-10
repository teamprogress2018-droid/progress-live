#!/usr/bin/env node
'use strict';
/** Inbox: kind direct | system | broadcast, strip tagów, filtry czatu. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src10 = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=93'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=74'));
ok('cache 10', html.includes('10-client-app.js?v=37'));
ok('kind bar html', html.includes('id="chat-kind-bar"') && html.includes("setChatKindFilter('system')"));
ok('kind helpers', /function normalizeMsgKind/.test(core) && /function msgDisplayText/.test(core));
ok('pushMsg opts', /function pushMsg\(clientId,text,opts\)/.test(core) && /kind:opts\.kind/.test(core));
ok('broadcast sets kind', /pushMsg\(c\.id,text,\{kind:'broadcast'/.test(src06));
ok('sendMsg direct', /pushMsg\(curChat,txt,\{kind:'direct'\}\)/.test(src06));
ok('group broadcast', /kind:'broadcast',broadcast:true/.test(src06));
ok('filter helper', /function setChatKindFilter/.test(src06) && /chatKindFilter/.test(src06));
ok('openChat filters', /data-kind=/.test(src06) && /msgDisplayText/.test(src06));
ok('list strips tags', /msgDisplayText/.test(src06) && /normalizeMsgKind\(last\)/.test(src06));
ok('client chat kind', /kind:'direct'/.test(src10));
ok('CI unit', wf.includes('test_inbox_kinds.js'));
ok('CI ui', wf.includes('test_inbox_kinds_ui.js'));

function extract(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const msgs = {};
const sandbox = {
  window: { MSGS: msgs, persistById() {} },
  MSGS: msgs,
  persistById() {},
  withTrainer: o => o,
  newId: p => p + '-1',
  Date,
  String,
  console
};
sandbox.window.MSGS = msgs;
vm.createContext(sandbox);
vm.runInContext(
  extract(core, 'normalizeMsgKind') + '\n' +
  extract(core, 'msgDisplayText') + '\n' +
  extract(core, 'msgKindLabel') + '\n' +
  extract(core, 'pushMsg') + '\n' +
  'window.normalizeMsgKind=normalizeMsgKind;window.msgDisplayText=msgDisplayText;window.msgKindLabel=msgKindLabel;',
  sandbox
);

ok('explicit kind', sandbox.normalizeMsgKind({ kind: 'broadcast', text: 'hej' }) === 'broadcast');
ok('od tag system', sandbox.normalizeMsgKind({ text: '[od:ow2]\n🏠 Zadanie domowe' }) === 'system');
ok('odprog system', sandbox.normalizeMsgKind({ text: '[odprog:op2]\nProgram' }) === 'system');
ok('invite system', sandbox.normalizeMsgKind({ text: '📱 Zaproszenie do Progress Live:\nhttp://x' }) === 'system');
ok('plain direct', sandbox.normalizeMsgKind({ text: 'Jak było na sali?' }) === 'direct');
ok('incoming client', sandbox.normalizeMsgKind({ text: 'Hej!', out: false }) === 'direct');
ok('strip od', sandbox.msgDisplayText({ text: '[od:ow2]\n🏠 HIIT 20 min' }) === '🏠 HIIT 20 min');
ok('label', sandbox.msgKindLabel('system') === 'System' && sandbox.msgKindLabel('broadcast') === 'Broadcast');

const saved = sandbox.pushMsg('c1', 'Hej Justyna', { kind: 'direct' });
ok('push stores kind', saved && saved.kind === 'direct' && msgs.c1[0].kind === 'direct');
const bc = sandbox.pushMsg('c1', 'Siłownia jutro zamknięta', { kind: 'broadcast', broadcast: true });
ok('push broadcast flag', bc.kind === 'broadcast' && bc.broadcast === true);
const sys = sandbox.pushMsg('c1', '[od:ow9]\n🏠 Box breathing');
ok('push infers system', sys.kind === 'system');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll inbox-kinds tests passed');
