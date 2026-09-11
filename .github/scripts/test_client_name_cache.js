#!/usr/bin/env node
'use strict';
/** Po zmianie imienia — cache clientName na planach / pakietach / fakturach / onboardingu. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src01 = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

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

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK  ', name);
}

ok('helper in core', src01.includes('function syncClientNameCache'));
ok('saveCPEdit hooks sync', /persistById\('clients',c\);\s*try\{if\(typeof syncClientNameCache/.test(src09));
ok('saveClient edit hooks sync', src05.includes("syncClientNameCache(c.id,c.name)"));
ok('cache 01', html.includes('01-core.js?v=101'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=57'));
ok('cache 09', html.includes('09-posture-kb-invites-private.js?v=41'));
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
console.log('\nAll client-name-cache tests passed');
