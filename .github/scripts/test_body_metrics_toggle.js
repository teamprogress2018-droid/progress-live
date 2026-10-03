#!/usr/bin/env node
'use strict';
/** bodyMetrics client setting gates masa/obwody/Garmin in Progress (like progressPhoto). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('bmFeatureOn helper', /function\s+bmFeatureOn\s*\(/.test(core));
ok('bmFeatureOn exported', core.includes('window.bmFeatureOn=bmFeatureOn'));
ok('portal gates metricsOn', portal.includes('bmFeatureOn(c)') && portal.includes('const metricsOn='));
ok('progress notice when off', portal.includes('Pomiary ciała (masa, obwody, Garmin) są wyłączone'));
ok('masa card gated', /metricsOn\?`<div class="cap-stat-card"[\s\S]*?Masa ciała/.test(portal));
ok('obwody gated', portal.includes('metricsOn&&lastMeas'));
ok('garmin steps gated', portal.includes('metricsOn&&stepsPts'));
ok('home garmin gated', /bmFeatureOn\(c\)\)return ''/.test(portal));
ok('settings row bodyMetrics', extras.includes("key:'bodyMetrics'") && extras.includes('Masa, obwody i Garmin'));
ok('defaults include bodyMetrics', extras.includes('bodyMetrics:true'));
ok('onboarding KPIs not fake', !onboarding.includes('completed+8') && !onboarding.includes('4.2,'));

function extractFunction(src, name) {
  const re = new RegExp(
    `(?:^|\\n)(function\\s+${name}\\s*\\()`,
    'm'
  );
  const m = re.exec(src);
  if (!m) throw new Error('Function ' + name + ' not found');
  let i = m.index + (m[0].startsWith('\n') ? 1 : 0);
  while (i < src.length && src[i] !== '{') i++;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index + (m[0].startsWith('\n') ? 1 : 0), j + 1);
    }
  }
  throw new Error('Unbalanced braces for ' + name);
}

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(extractFunction(core, 'bmFeatureOn'), sandbox);
const { bmFeatureOn } = sandbox;

ok('default on empty client', bmFeatureOn({}) === true);
ok('default on empty settings', bmFeatureOn({ clientSettings: {} }) === true);
ok('explicit true', bmFeatureOn({ clientSettings: { bodyMetrics: true } }) === true);
ok('explicit false', bmFeatureOn({ clientSettings: { bodyMetrics: false } }) === false);
ok('null client on', bmFeatureOn(null) === true);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll body-metrics-toggle tests passed');
