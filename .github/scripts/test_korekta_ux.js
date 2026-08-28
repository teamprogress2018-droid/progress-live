#!/usr/bin/env node
'use strict';
/** Korekty UX ze screenów: Więcej portal, zwijany sidebar, rationale client/sources. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('cp more menu fixed portal', css.includes('.cp-tabs-more-menu') && /position:\s*fixed/.test(css.slice(css.indexOf('.cp-tabs-more-menu'), css.indexOf('.cp-tabs-more-menu') + 200)));
ok('positionCpMoreMenu', src09.includes('function _positionCpMoreMenu') && src09.includes('document.body.appendChild(el)'));
ok('builder sidebar scroll wrap', html.includes('builder-sidebar-scroll') && css.includes('.builder-sidebar-scroll'));
ok('builder sidebar collapse', src05.includes('function toggleBuilderSidebar') && html.includes('builder-sidebar-expand') && html.includes('Zwiń'));
ok('period card reachable', html.includes('id="builder-period-card"') && html.includes('period-sched'));
ok('client talk + details sources', core.includes('Jak wytłumaczyć klientowi') && /<details class="mr-sources[^"]*">/.test(core) && core.includes('clientTalk'));
ok('weight tips in rationale', /weight>=95|Waga ~/.test(core) || core.includes("Waga ~"));
ok('volume by tenure', core.includes('VOLUME_BY_LEVEL') && core.includes('Serie na partię wg stażu') && css.includes('.mr-vol-table'));
ok('cache bumps', html.includes('styles.css?v=51') && html.includes('01-core.js?v=47') && html.includes('05-clients-builder-plans-calendar.js?v=34') && html.includes('09-posture-kb-invites-private.js?v=34'));
ok('CI', wf.includes('test_korekta_ux.js'));

const sandbox = { window: {}, console };
vm.createContext(sandbox);
const start = core.indexOf('// ════════════════════════════════════════\n// UZASADNIENIE METODYCZNE');
const end = core.indexOf('window.normalizeRationaleMethod=normalizeRationaleMethod;') + 'window.normalizeRationaleMethod=normalizeRationaleMethod;'.length;
ok('slice', start >= 0 && end > start);
vm.runInContext(core.slice(start, end) + '\nwindow.buildMethodRationale=buildMethodRationale;window.renderMethodRationaleHTML=renderMethodRationaleHTML;', sandbox);
const r = sandbox.buildMethodRationale({ method: 'PPL', goal: 'redukcja', level: 'zaawansowany', daysPerWeek: 4, weight: 100 });
ok('clientTalk present', r.clientTalk && /Trenujemy Push/.test(r.clientTalk) && /schudnąć bez gubienia/.test(r.clientTalk) && !/MEV|MRV|bro-split|RPE 7/.test(r.clientTalk));
ok('clientTalk short', r.clientTalk.length < 520);
ok('weight tip', r.tips.some(t => /100 kg|Wyższa masa/.test(t)));
const htmlR = sandbox.renderMethodRationaleHTML(r);
ok('html details sources', /<details class="mr-sources[^"]*">/.test(htmlR) && /Jak wytłumaczyć klientowi/.test(htmlR));
ok('html volume table', /mr-vol-table/.test(htmlR) && /Serie na partię wg stażu/.test(htmlR) && r.levelVolumeParts.Klatka === '12–20');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll korekta-ux tests passed');
