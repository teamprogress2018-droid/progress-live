#!/usr/bin/env node
'use strict';
/** Jedno pole weekday: nazwa w nawiasie > preferencje klienta. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extract(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const root = path.join(__dirname, '../..');
const src01 = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

ok('ci', wf.includes('test_plan_day_weekday.js'));
ok('cache 01/05', html.includes('01-core.js?v=126') && html.includes('05-clients-builder-plans-calendar.js?v=81'));
ok('helpers', /function planDayWeekday/.test(src01) && /function hydratePlanDaysWeekdays/.test(src01) && /function parsePlanWeekdayFromText/.test(src01));
ok('schedule uses day object', /resolvePlanDayWeekday\(d,trainI,preferred\)/.test(src05.replace(/\s+/g, '')));
ok('canonical weekday first', /typeof planDayWeekday==='function'/.test(src05.slice(src05.indexOf('function resolvePlanDayWeekday'), src05.indexOf('function scheduleTimeFromClient'))));

const sandbox = {
  window: { SE: [], CL: [], PL: [] },
  Date, Math, Number, String, Array, Set, isFinite, isNaN, parseInt, parseFloat, console,
  dateStrLocal: (d) => {
    const x = d instanceof Date ? d : new Date(d);
    const p = n => String(n).padStart(2, '0');
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
  },
  todayYmd: () => '2026-09-24',
  ymdAdd: (ymd, days) => {
    const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + (Number(days) || 0));
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },
  normalizePreferredWeekdays: (a) => (a || []).map(Number).filter(n => n >= 0 && n <= 6),
  persistById: () => {},
  persistSessionIfPossible: () => {},
  persistPlanIfPossible: () => {},
  sessionIsSkipped: () => false,
  sessionHappened: () => false,
  uniqueWeekdaysForTrainDays: (n, pref) => {
    const out = [];
    const used = new Set();
    (pref || []).forEach(d => { if (out.length < n && !used.has(d)) { used.add(d); out.push(d); } });
    [1, 2, 3, 4, 5, 6, 0].forEach(d => { if (out.length < n && !used.has(d)) { used.add(d); out.push(d); } });
    return out;
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
[
  'foldPlanWeekdayText', 'parsePlanWeekdayToken', 'parsePlanWeekdayFromText', 'normalizePlanWeekday',
  'stripPlanDayWeekdayName', 'planDayRawLabel', 'planDayDisplayName', 'planDayShortName',
  'planDayWeekdayLabel', 'planDayWeekday', 'hydratePlanDaysWeekdays', 'mondayOfYmd',
  'ymdForWeekdayInWeek', 'syncFuturePlannedToPlanWeekdays'
].forEach(n => vm.runInContext(extract(src01, n), sandbox));

ok('paren wtorek', sandbox.parsePlanWeekdayFromText('Dzień 2 — FBW B (Wtorek)') === 2);
ok('paren czwartek', sandbox.parsePlanWeekdayFromText('Dzień 3 — FBW C (Czwartek)') === 4);
ok('builder PON', sandbox.parsePlanWeekdayFromText('PON') === 1);
ok('diacritics piątek', sandbox.parsePlanWeekdayFromText('FBW D (Piątek)') === 5);
ok('strip paren', sandbox.stripPlanDayWeekdayName('Dzień 2 — FBW B (Wtorek)') === 'Dzień 2 — FBW B');
ok('short FBW A', sandbox.planDayShortName({ day: 'Dzień 1 — FBW A (Poniedziałek)' }, 0) === 'FBW A');

const plan = {
  id: 'pl1', clientId: 'c1',
  days: [
    { day: 'Dzień 1 — FBW A (Poniedziałek)', exercises: [{ name: 'x' }] },
    { day: 'Dzień 2 — FBW B (Wtorek)', exercises: [{ name: 'x' }] },
    { day: 'Dzień 3 — FBW C (Czwartek)', exercises: [{ name: 'x' }] },
    { day: 'Dzień 4 — FBW D (Piątek)', exercises: [{ name: 'x' }] }
  ]
};
ok('name beats preferred', sandbox.planDayWeekday(plan.days[1], 1, [1, 3, 5, 0]) === 2);
ok('hydrate writes field', sandbox.hydratePlanDaysWeekdays(plan, [1, 3, 5, 0]) === true && plan.days[2].weekday === 4);
ok('hydrate idempotent', sandbox.hydratePlanDaysWeekdays(plan, [1, 3, 5, 0]) === false);

sandbox.window.SE = [
  { id: 's1', clientId: 'c1', planId: 'pl1', source: 'planned', dayIdx: 0, date: '2026-09-21' },
  { id: 's2', clientId: 'c1', planId: 'pl1', source: 'planned', dayIdx: 1, date: '2026-09-23' },
  { id: 's3', clientId: 'c1', planId: 'pl1', source: 'planned', dayIdx: 2, date: '2026-09-25' },
  { id: 's4', clientId: 'c1', planId: 'pl1', source: 'planned', dayIdx: 3, date: '2026-09-27' }
];
const moved = sandbox.syncFuturePlannedToPlanWeekdays(plan);
ok('realigns current week to names', moved === 3, 'moved=' + moved);
ok('day2 tue', sandbox.window.SE.find(s => s.id === 's2').date === '2026-09-22');
ok('day3 thu', sandbox.window.SE.find(s => s.id === 's3').date === '2026-09-24');
ok('day4 fri', sandbox.window.SE.find(s => s.id === 's4').date === '2026-09-25');
ok('day1 stays mon', sandbox.window.SE.find(s => s.id === 's1').date === '2026-09-21');

if (failed) process.exit(1);
console.log('\nAll plan-day-weekday tests passed');
