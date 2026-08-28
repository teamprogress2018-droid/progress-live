#!/usr/bin/env node
'use strict';
/** Nadwaga w asystencie trenera + strażnik progres/regres. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src10 = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('bmi helper', /function clientBmiStatus/.test(src07) && /window\.clientBmiStatus/.test(src07));
ok('nadwaga copy', /NADWAGA — jak ma wyglądać trening/.test(src07) && /strefa 2/.test(src07));
ok('builder askAI safety+watch', /clientSafetyContextForAI/.test(src06) && /clientMonitorContextForAI/.test(src06) && /refreshBuilderAiCoachCard/.test(src06));
ok('builder card html', html.includes('id="ai-watch-card"'));
ok('updatePeriod refreshes card', /refreshBuilderAiCoachCard/.test(src05));
ok('aic injects safety+watch', /clientSafetyContextForAI/.test(src03) && /clientMonitorContextForAI/.test(src03) && /STRAŻNIK POSTĘPÓW/.test(src03));
ok('live+client watchdog', /trainerWatchdogAfterSession/.test(src02) && /trainerWatchdogAfterSession/.test(src10));
ok('dash + auto notifs', /Regres/.test(src04) && /maybeNotifyTrainerMonitor/.test(src04) && /Rada AI/.test(src04));
ok('monitor context', /function clientMonitorContextForAI/.test(src08) && /function maybeNotifyTrainerMonitor/.test(src08));
ok('profile banner', /cp-bmi-banner/.test(src08) && css.includes('.ai-watch-card') && css.includes('.cp-bmi-banner'));
ok('cache', html.includes('07-forms-metrics-calculator.js?v=29') && html.includes('08-client-profile-extras.js?v=34') && html.includes('06-inbox-exercises-ai-programs.js?v=33') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('04-client-portal.js?v=34') && html.includes('styles.css?v=51'));
ok('cache', html.includes('07-forms-metrics-calculator.js?v=29') && html.includes('08-client-profile-extras.js?v=35') && html.includes('06-inbox-exercises-ai-programs.js?v=33') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('04-client-portal.js?v=35') && html.includes('styles.css?v=51'));
ok('CI', wf.includes('test_ai_bmi_watchdog.js') && wf.includes('test_ai_bmi_watchdog_ui.js'));

const document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const windowObj = {
  addEventListener() {},
  CL: [],
  NOTIFICATIONS: [],
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, isNaN, isFinite, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);

const safetySlice = src07.match(/\/\*\* BMI \+ zasady bezpieczeństwa[\s\S]*?window\.clientSafetyContextForAI=clientSafetyContextForAI;/);
ok('safety slice', !!safetySlice);
vm.runInContext(safetySlice[0], ctx);

const stN = ctx.clientBmiStatus(80, 170);
ok('bmi 27 nadwaga', stN && stN.overweight && !stN.obese && stN.cls === 'nadwaga' && stN.bmi === 27.7);
ok('nadwaga tips', stN.tips.some((t) => /strefa 2/i.test(t)));
const bodyN = ctx.clientBodyLoadContextForAI(80, 170);
ok('nadwaga prompt', /NADWAGA/.test(bodyN) && /strefa 2/.test(bodyN) && !/OBOWIĄZKOWE przy doborze ćwiczeń/.test(bodyN.split('\n')[1] || ''));

const stOk = ctx.clientBmiStatus(62, 170);
ok('norma no overload', stOk && !stOk.overweight && stOk.cls === 'norma' && stOk.tips.length === 0);
ok('norma body no NADWAGA', !/NADWAGA/.test(ctx.clientBodyLoadContextForAI(62, 170)));

const stFat = ctx.clientBmiStatus(122.5, 175);
ok('otyłość tips', stFat && stFat.obese && /maszyn/i.test(stFat.tips.join(' ')) && /skok/.test(stFat.tips.join(' ')));
ok('otyłość prompt', /BMI ~40/.test(ctx.clientBodyLoadContextForAI(122.5, 175)) && /maszyny/.test(ctx.clientBodyLoadContextForAI(122.5, 175)));

const start = src08.indexOf('function buildMonitorVerdict');
const end = src08.indexOf('window.trainerWatchdogAfterSession=');
ok('monitor slice', start > 0 && end > start);
const monSrc = src08.slice(start, src08.indexOf('\nfunction buildClientJourneySummary'));
vm.runInContext(
  monSrc +
    '\nwindow.buildMonitorVerdict=buildMonitorVerdict;\nwindow.clientMonitorContextForAI=clientMonitorContextForAI;\nwindow.maybeNotifyTrainerMonitor=maybeNotifyTrainerMonitor;',
  ctx
);

windowObj.CL = [{ id: 'c1', name: 'Justyna', goal: 'redukcja', weight: 80, height: 170 }];
windowObj.PL = [];
windowObj.SE = [];
windowObj.METRIC_ENTRIES = [];
ctx.cpMetricDeltaPct = () => null;
ctx.cpClientAdherence = () => ({ assigned: 0, logged: 0, pct: 0 });
ctx.cpCheckinTrendPoints = () => [];
ctx.clientWeeklyVolumeStats = () => null;
ctx.buildClientInsight = () => [];
ctx.clientLatestMetricWeight = () => 80;
ctx.addNotification = (type, title, body, action, id) => {
  windowObj.NOTIFICATIONS.push({ id, type, title, body, action, autoKey: id });
};
ctx.allNotifs = () => windowObj.NOTIFICATIONS;

const v = ctx.buildMonitorVerdict(windowObj.CL[0]);
ok('verdict has bmi next', v && v.next.some((t) => /Nadwaga/.test(t) && /BMI/.test(t)));
const txt = ctx.clientMonitorContextForAI('c1');
ok('watch context', /STRAŻNIK POSTĘPÓW/.test(txt) && /Werdykt/.test(txt) && /dobrą czy złą/.test(txt));

windowObj.CL[0].goal = 'redukcja';
windowObj.SE = [];
ctx.cpClientAdherence = () => ({ assigned: 8, logged: 1, pct: 12 });
const vBad = ctx.buildMonitorVerdict(windowObj.CL[0]);
ok('regres or risk', vBad && (vBad.verdict === 'regres' || vBad.verdict === 'ryzyko stagnacji'));
windowObj.NOTIFICATIONS = [];
ctx.maybeNotifyTrainerMonitor('c1', 'auto');
ok('notifies bad direction', windowObj.NOTIFICATIONS.length === 1 && /Regres|stagnacji/.test(windowObj.NOTIFICATIONS[0].title));
ctx.maybeNotifyTrainerMonitor('c1', 'auto');
ok('no duplicate notif same week', windowObj.NOTIFICATIONS.length === 1);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll AI BMI watchdog tests passed');
