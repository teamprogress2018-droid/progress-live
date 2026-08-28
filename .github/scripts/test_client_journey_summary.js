#!/usr/bin/env node
'use strict';
/** Client journey: onboard summary (plan+survey+macros) + progress/regress monitor. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const eight = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const seven = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('estimateClientMacros', /function estimateClientMacros/.test(eight));
ok('buildMonitorVerdict', /function buildMonitorVerdict/.test(eight));
ok('buildClientJourneySummary', /function buildClientJourneySummary/.test(eight));
ok('renderClientJourneyHTML', /function renderClientJourneyHTML/.test(eight));
ok('open helpers', /openClientOnboardSummary/.test(eight) && /openClientMonitorSummary/.test(eight));
ok('calc persists macros', /c\.macros\s*=/.test(seven) && /persistById\('clients'/.test(seven));
ok('cp menu onboard', html.includes('openClientOnboardSummary(cpClientId)'));
ok('cp menu monitor', html.includes('openClientMonitorSummary(cpClientId)'));
ok('report modal shortcuts', html.includes('Start: plan + ankieta + makro') && html.includes('Monitoring: progres / regres'));
ok('no duplicate core script', (html.match(/01-core\.js\?v=/g) || []).length === 1);
ok('cache 07/08', html.includes('07-forms-metrics-calculator.js?v=29') && html.includes('08-client-profile-extras.js?v=35'));
ok('css journey', css.includes('.client-journey') && css.includes('.cj-verdict') && css.includes('var(--bg-card)') && css.includes('.cj-sig-bad'));
ok('dark report container', /id="report-container"[^>]*background:\s*var\(--bg\)/.test(html) || html.includes('id="report-container"') && html.includes('background:var(--bg)'));

const start = eight.indexOf('// ════════════════════════════════════════\n// PODSUMOWANIE START + MONITORING PROGRESU');
ok('module slice', start > 0);
const slice = eight.slice(start);
const sandbox = {
  window: {},
  console,
  CL: [{
    id: 'c1', name: 'Ada Test', goal: 'redukcja', level: 'sredni',
    weight: 70, height: 165, age: 30, gender: 'K', activityLevel: 'moderate',
    trainingFreq: 3
  }],
  PL: [{ id: 'p1', clientId: 'c1', name: 'PPL T1', method: 'PPL', duration: 4, days: [
    { d: 'PON', focus: 'Push', exercises: [{}, {}, {}] },
    { d: 'WT', focus: 'Pull', exercises: [{}, {}] }
  ] }],
  SE: [
    { clientId: 'c1', date: '2026-08-20', source: 'client', exercises: [{}] },
    { clientId: 'c1', date: '2026-08-18', source: 'live', exercises: [{}] }
  ],
  METRIC_ENTRIES: [
    { clientId: 'c1', groupId: 'mg1', date: '2026-08-01', values: { m1: 72 } },
    { clientId: 'c1', groupId: 'mg1', date: '2026-08-20', values: { m1: 70 } }
  ],
  CHECKINS: { c1: [] },
  TASKS: [],
  FORM_SENDS: [],
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON, isFinite, undefined
};
sandbox.window = sandbox;
sandbox.clientIntakeFormState = () => ({ filled: false, pending: null, sent: false });
sandbox.latestClientPlan = (id) => sandbox.PL.find((p) => p.clientId === id) || null;
sandbox.cpMetricDeltaPct = (cid, gid, mid) => {
  const list = sandbox.METRIC_ENTRIES.filter((e) => e.clientId === cid && e.groupId === gid)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (list.length < 2) return null;
  const cur = list[0].values[mid];
  const prev = list[1].values[mid];
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
};
sandbox.cpClientAdherence = () => ({ assigned: 4, logged: 3, pct: 75 });
sandbox.cpCheckinTrendPoints = () => [];
sandbox.clientWeeklyVolumeStats = () => null;
sandbox.buildClientInsight = () => [];
sandbox.escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
sandbox.clientBmiStatus = (w, h) => {
  const bmi = +(w / ((h / 100) * (h / 100))).toFixed(1);
  return { bmi, overweight: bmi >= 25, obese: bmi >= 30, tips: ['Siła 3× w tygodniu.'], label: 'Nadwaga' };
};

vm.createContext(sandbox);
vm.runInContext(slice, sandbox);

const mac = sandbox.estimateClientMacros(sandbox.CL[0]);
ok('macros estimate', mac && mac.targetKcal > 1000 && mac.proteinG > 50);
const onboard = sandbox.buildClientJourneySummary('c1', 'onboard');
ok('onboard summary', onboard && onboard.mode === 'onboard' && onboard.plan.hasPlan && onboard.next.length > 0);
const mon = sandbox.buildClientJourneySummary('c1', 'monitor');
ok('monitor summary', mon && mon.mode === 'monitor' && mon.monitor && mon.monitor.verdict);
const htmlOn = sandbox.renderClientJourneyHTML(onboard);
ok('onboard html', /Ankieta wstępna/.test(htmlOn) && /Makro/.test(htmlOn) && /Co dalej/.test(htmlOn));
const htmlMon = sandbox.renderClientJourneyHTML(mon);
ok('monitor html', /Werdykt monitoringu/.test(htmlMon) && /Sygnały/.test(htmlMon));
ok('overweight next', mon.monitor.next.some((t) => /Nadwaga/.test(t)));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll client-journey tests passed');
