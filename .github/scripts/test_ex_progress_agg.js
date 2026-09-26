#!/usr/bin/env node
'use strict';
/** Etap 7A: agregat progresu klienta — przypadki 1–20 ze specyfikacji. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const client = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const aggStart = coreSrc.indexOf('function aggregateClientProgress');
const aggEnd = coreSrc.indexOf('window.aggregateClientProgress');
const aggSrc = aggStart >= 0 && aggEnd > aggStart ? coreSrc.slice(aggStart, aggEnd) : '';
const classifySrc = coreSrc.slice(
  coreSrc.indexOf('function classifyExerciseProgress'),
  coreSrc.indexOf('window.classifyExerciseProgress')
);
const rememberSrc = coreSrc.slice(
  coreSrc.indexOf('function rememberClientExerciseProgress'),
  coreSrc.indexOf('window.rememberClientExerciseProgress')
);
const progressFn = extras.slice(extras.indexOf('function renderCPProgress'), extras.indexOf('window.renderCPProgress'));
const capFn = portal.slice(portal.indexOf('function capClientProgressScreenHTML'), portal.indexOf('window.capClientProgressScreenHTML'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=126'));
ok('CI', wf.includes('test_ex_progress_agg.js'));
ok('agg helper', /function aggregateClientProgress/.test(coreSrc));
ok('agg stays in core', !/function aggregateClientProgress/.test(extras)
  && !/function aggregateClientProgress/.test(portal)
  && !/aggregateClientProgress/.test(client)
  && !/aggregateClientProgress/.test(live)
  && !/aggregateClientProgress/.test(builder)
  && !/aggregateClientProgress/.test(html));
ok('no UI wiring', !/aggregateClientProgress/.test(progressFn)
  && !/aggregateClientProgress/.test(capFn)
  && !/aggregateClientProgress/.test(rememberSrc));
ok('no kg/reps recs', !/recommendKg|recommendReps|rekomendacj/.test(aggSrc));
ok('does not reclassify', !/classifyExerciseProgress/.test(aggSrc)
  && !/exerciseProgressSeries/.test(aggSrc)
  && !/window\.SE/.test(aggSrc)
  && !/exerciseProgressClass\(/.test(aggSrc));
ok('6D classifier unchanged labels', /ZA MAŁO DANYCH/.test(classifySrc)
  && /label==='PROGRES'/.test(classifySrc)
  && /consecutiveDown>=2/.test(classifySrc)
  && /function scoreExerciseProgress/.test(coreSrc) === false);
ok('client app untouched by agg', !/aggregateClientProgress/.test(client));

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [{ id: 'poison', clientId: 'c1' }], EX: [], DEF_EX: [], WO: [],
  METRIC_ENTRIES: [],
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Map, Set, setTimeout, clearTimeout, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(coreSrc, ctx);

const { aggregateClientProgress, classifyExerciseProgress } = ctx;

let classifyCalls = 0;
const origClassify = ctx.classifyExerciseProgress;
ctx.classifyExerciseProgress = function wrappedClassify() {
  classifyCalls++;
  return origClassify.apply(this, arguments);
};
windowObj.classifyExerciseProgress = ctx.classifyExerciseProgress;

function item(name, label, confidence, extra) {
  extra = extra || {};
  return {
    name: name,
    exerciseId: extra.exerciseId != null ? extra.exerciseId : '',
    classification: {
      label: label,
      plateau: extra.plateau === true,
      flags: extra.flags || [],
      confidence: confidence,
      reasons: extra.reasons || ['stub 6D']
    }
  };
}
function pack(items, clientId) {
  return { clientId: clientId || 'c1', items: items };
}
function attNames(got) {
  return (got.attention || []).map(a => a.name);
}
function attWhy(got, name) {
  const row = (got.attention || []).find(a => a.name === name);
  return row ? row.why.slice() : null;
}
function thinNames(got) {
  return (got.thin || []).map(t => t.name);
}

function expectCase(got, want) {
  const checks = [];
  function add(k, cond, extra) {
    checks.push({ k: k, pass: !!cond, extra: extra });
  }
  add('trend', got.trend === want.trend, got.trend);
  add('confidence', got.confidence === want.confidence, got.confidence);
  add('spread', got.regresSpread === want.regresSpread, got.regresSpread);
  if (want.counts) {
    Object.keys(want.counts).forEach(k => {
      add('counts.' + k, got.counts[k] === want.counts[k], got.counts[k]);
    });
  }
  if (want.nRegresSolid != null) add('nRegresSolid', got.nRegresSolid === want.nRegresSolid, got.nRegresSolid);
  if (want.nProgresSolid != null) add('nProgresSolid', got.nProgresSolid === want.nProgresSolid, got.nProgresSolid);
  if (want.nStableSolid != null) add('nStableSolid', got.nStableSolid === want.nStableSolid, got.nStableSolid);
  if (want.attentionNames) {
    add('attention names', JSON.stringify(attNames(got)) === JSON.stringify(want.attentionNames), attNames(got));
  }
  if (want.attentionSet) {
    const gotSet = attNames(got).slice().sort().join(',');
    const wantSet = want.attentionSet.slice().sort().join(',');
    add('attention set', gotSet === wantSet, attNames(got));
  }
  if (want.why) {
    Object.keys(want.why).forEach(name => {
      add('why ' + name, JSON.stringify(attWhy(got, name)) === JSON.stringify(want.why[name]), attWhy(got, name));
    });
  }
  if (want.thin) {
    add('thin', JSON.stringify(thinNames(got)) === JSON.stringify(want.thin), thinNames(got));
  }
  add('reasons', Array.isArray(got.reasons) && got.reasons.length > 0 && got.reasons.every(r => typeof r === 'string' && r.length));
  add('clientId', want.clientId == null || got.clientId === want.clientId, got.clientId);
  return checks;
}

const cases = [
  {
    n: 1,
    title: 'pusta lista',
    pack: pack([]),
    want: {
      trend: 'ZA MAŁO DANYCH', confidence: 'low', regresSpread: 'brak',
      counts: { total: 0, progres: 0, stabilnie: 0, regres: 0, zaMalo: 0, credible: 0, solid: 0, plateau: 0, lowConfidence: 0 },
      nRegresSolid: 0, nProgresSolid: 0, nStableSolid: 0,
      attentionNames: [], thin: []
    }
  },
  {
    n: 2,
    title: '3× ZA MAŁO DANYCH',
    pack: pack([
      item('A', 'ZA MAŁO DANYCH', 'low'),
      item('B', 'ZA MAŁO DANYCH', 'low'),
      item('C', 'ZA MAŁO DANYCH', 'low')
    ]),
    want: {
      trend: 'ZA MAŁO DANYCH', confidence: 'low', regresSpread: 'brak',
      counts: { total: 3, progres: 0, stabilnie: 0, regres: 0, zaMalo: 3, credible: 0, solid: 0, plateau: 0, lowConfidence: 0 },
      nRegresSolid: 0, attentionNames: [], thin: ['A', 'B', 'C']
    }
  },
  {
    n: 3,
    title: '1× PROGRES high + 2× ZA MAŁO',
    pack: pack([
      item('Wyciskanie', 'PROGRES', 'high'),
      item('Deska', 'ZA MAŁO DANYCH', 'low'),
      item('Face pull', 'ZA MAŁO DANYCH', 'low')
    ]),
    want: {
      trend: 'ZA MAŁO DANYCH', confidence: 'low', regresSpread: 'brak',
      counts: { total: 3, progres: 1, stabilnie: 0, regres: 0, zaMalo: 2, credible: 1, solid: 1, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 1, nRegresSolid: 0, attentionNames: [], thin: ['Deska', 'Face pull']
    }
  },
  {
    n: 4,
    title: '1× REGRES high',
    pack: pack([item('Martwy', 'REGRES', 'high')]),
    want: {
      trend: 'ZA MAŁO DANYCH', confidence: 'low', regresSpread: 'pojedynczy',
      counts: { total: 1, progres: 0, stabilnie: 0, regres: 1, zaMalo: 0, credible: 1, solid: 1, plateau: 0, lowConfidence: 0 },
      nRegresSolid: 1, attentionNames: ['Martwy'], why: { Martwy: ['regres'] }, thin: []
    }
  },
  {
    n: 5,
    title: '2× PROGRES low',
    pack: pack([
      item('A', 'PROGRES', 'low'),
      item('B', 'PROGRES', 'low')
    ]),
    want: {
      trend: 'ZA MAŁO DANYCH', confidence: 'low', regresSpread: 'brak',
      counts: { total: 2, progres: 2, stabilnie: 0, regres: 0, zaMalo: 0, credible: 2, solid: 0, plateau: 0, lowConfidence: 2 },
      nProgresSolid: 0, nRegresSolid: 0, attentionNames: [], thin: []
    }
  },
  {
    n: 6,
    title: '4× PROGRES high',
    pack: pack([
      item('A', 'PROGRES', 'high'),
      item('B', 'PROGRES', 'high'),
      item('C', 'PROGRES', 'high'),
      item('D', 'PROGRES', 'high')
    ]),
    want: {
      trend: 'WZROST', confidence: 'high', regresSpread: 'brak',
      counts: { total: 4, progres: 4, stabilnie: 0, regres: 0, zaMalo: 0, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 4, nRegresSolid: 0, attentionNames: [], thin: []
    }
  },
  {
    n: 7,
    title: '3× PROGRES medium + 1× STABILNIE high',
    pack: pack([
      item('A', 'PROGRES', 'medium'),
      item('B', 'PROGRES', 'medium'),
      item('C', 'PROGRES', 'medium'),
      item('D', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'WZROST', confidence: 'high', regresSpread: 'brak',
      counts: { total: 4, progres: 3, stabilnie: 1, regres: 0, zaMalo: 0, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 3, nStableSolid: 1, nRegresSolid: 0, attentionNames: [], thin: []
    }
  },
  {
    n: 8,
    title: '2× PROGRES high + 2× STABILNIE high (1 plateau)',
    pack: pack([
      item('A', 'PROGRES', 'high'),
      item('B', 'PROGRES', 'high'),
      item('C', 'STABILNIE', 'high', { plateau: true, flags: ['reserveAvailable'] }),
      item('D', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'WZROST', confidence: 'high', regresSpread: 'brak',
      counts: { total: 4, progres: 2, stabilnie: 2, regres: 0, zaMalo: 0, credible: 4, solid: 4, plateau: 1, lowConfidence: 0 },
      nProgresSolid: 2, nStableSolid: 2, nRegresSolid: 0,
      attentionNames: ['C'], why: { C: ['plateau'] }, thin: []
    }
  },
  {
    n: 9,
    title: '4× STABILNIE high, 2× plateau+reserveAvailable',
    pack: pack([
      item('A', 'STABILNIE', 'high', { plateau: true, flags: ['reserveAvailable'] }),
      item('B', 'STABILNIE', 'high', { plateau: true, flags: ['reserveAvailable'] }),
      item('C', 'STABILNIE', 'high'),
      item('D', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'STABILNIE', confidence: 'high', regresSpread: 'brak',
      counts: { total: 4, progres: 0, stabilnie: 4, regres: 0, zaMalo: 0, credible: 4, solid: 4, plateau: 2, lowConfidence: 0 },
      nStableSolid: 4, nRegresSolid: 0,
      attentionNames: ['A', 'B'],
      why: { A: ['plateau'], B: ['plateau'] }, thin: []
    }
  },
  {
    n: 10,
    title: '3× STABILNIE high plateau+nearLimit',
    pack: pack([
      item('A', 'STABILNIE', 'high', { plateau: true, flags: ['nearLimit'] }),
      item('B', 'STABILNIE', 'high', { plateau: true, flags: ['nearLimit'] }),
      item('C', 'STABILNIE', 'high', { plateau: true, flags: ['nearLimit'] })
    ]),
    want: {
      trend: 'STABILNIE', confidence: 'medium', regresSpread: 'brak',
      counts: { total: 3, progres: 0, stabilnie: 3, regres: 0, zaMalo: 0, credible: 3, solid: 3, plateau: 3, lowConfidence: 0 },
      nStableSolid: 3, nRegresSolid: 0,
      attentionNames: ['A', 'B', 'C'],
      why: { A: ['nearLimit', 'plateau'], B: ['nearLimit', 'plateau'], C: ['nearLimit', 'plateau'] }, thin: []
    }
  },
  {
    n: 11,
    title: '4× PROGRES high + 1× REGRES high',
    pack: pack([
      item('A', 'PROGRES', 'high'),
      item('B', 'PROGRES', 'high'),
      item('C', 'PROGRES', 'high'),
      item('D', 'PROGRES', 'high'),
      item('E', 'REGRES', 'high')
    ]),
    want: {
      trend: 'WZROST', confidence: 'high', regresSpread: 'pojedynczy',
      counts: { total: 5, progres: 4, stabilnie: 0, regres: 1, zaMalo: 0, credible: 5, solid: 5, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 4, nRegresSolid: 1,
      attentionNames: ['E'], why: { E: ['regres'] }, thin: []
    }
  },
  {
    n: 12,
    title: '1× PROGRES high + 3× STABILNIE high',
    pack: pack([
      item('A', 'PROGRES', 'high'),
      item('B', 'STABILNIE', 'high'),
      item('C', 'STABILNIE', 'high'),
      item('D', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'STABILNIE', confidence: 'high', regresSpread: 'brak',
      counts: { total: 4, progres: 1, stabilnie: 3, regres: 0, zaMalo: 0, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 1, nStableSolid: 3, nRegresSolid: 0, attentionNames: [], thin: []
    }
  },
  {
    n: 13,
    title: '2× PROGRES high + 2× REGRES high',
    pack: pack([
      item('A', 'PROGRES', 'high'),
      item('B', 'PROGRES', 'high'),
      item('C', 'REGRES', 'high'),
      item('D', 'REGRES', 'high')
    ]),
    want: {
      trend: 'NIERÓWNY', confidence: 'high', regresSpread: 'wielu',
      counts: { total: 4, progres: 2, stabilnie: 0, regres: 2, zaMalo: 0, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 2, nRegresSolid: 2,
      attentionNames: ['C', 'D'], why: { C: ['regres'], D: ['regres'] }, thin: []
    }
  },
  {
    n: 14,
    title: '3× REGRES high + 1× PROGRES high',
    pack: pack([
      item('A', 'REGRES', 'high'),
      item('B', 'REGRES', 'high'),
      item('C', 'REGRES', 'high'),
      item('D', 'PROGRES', 'high')
    ]),
    want: {
      trend: 'COFANIE', confidence: 'high', regresSpread: 'wielu',
      counts: { total: 4, progres: 1, stabilnie: 0, regres: 3, zaMalo: 0, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 1, nRegresSolid: 3,
      attentionNames: ['A', 'B', 'C'], why: { A: ['regres'], B: ['regres'], C: ['regres'] }, thin: []
    }
  },
  {
    n: 15,
    title: '3× REGRES high + 1× STABILNIE high',
    pack: pack([
      item('A', 'REGRES', 'high'),
      item('B', 'REGRES', 'high'),
      item('C', 'REGRES', 'high'),
      item('D', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'COFANIE', confidence: 'high', regresSpread: 'wielu',
      counts: { total: 4, progres: 0, stabilnie: 1, regres: 3, zaMalo: 0, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 0, nStableSolid: 1, nRegresSolid: 3,
      attentionNames: ['A', 'B', 'C'], why: { A: ['regres'], B: ['regres'], C: ['regres'] }, thin: []
    }
  },
  {
    n: 16,
    title: '1× PROGRES + 1× REGRES + 1× STABILNIE high',
    pack: pack([
      item('A', 'PROGRES', 'high'),
      item('B', 'REGRES', 'high'),
      item('C', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'NIERÓWNY', confidence: 'medium', regresSpread: 'pojedynczy',
      counts: { total: 3, progres: 1, stabilnie: 1, regres: 1, zaMalo: 0, credible: 3, solid: 3, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 1, nStableSolid: 1, nRegresSolid: 1,
      attentionNames: ['B'], why: { B: ['regres'] }, thin: []
    }
  },
  {
    n: 17,
    title: '3× PROGRES high z grind',
    pack: pack([
      item('A', 'PROGRES', 'high', { flags: ['grind', 'effortHarder'] }),
      item('B', 'PROGRES', 'high', { flags: ['grind'] }),
      item('C', 'PROGRES', 'high', { flags: ['grind'] })
    ]),
    want: {
      trend: 'WZROST', confidence: 'medium', regresSpread: 'brak',
      counts: { total: 3, progres: 3, stabilnie: 0, regres: 0, zaMalo: 0, credible: 3, solid: 3, plateau: 0, lowConfidence: 0 },
      nProgresSolid: 3, nRegresSolid: 0,
      attentionNames: ['A', 'B', 'C'],
      why: { A: ['grind'], B: ['grind'], C: ['grind'] }, thin: []
    }
  },
  {
    n: 18,
    title: '4× STABILNIE high (2 mixed) + 2× ZA MAŁO',
    pack: pack([
      item('A', 'STABILNIE', 'high', { flags: ['mixed'] }),
      item('B', 'STABILNIE', 'high', { flags: ['mixed'] }),
      item('C', 'STABILNIE', 'high'),
      item('D', 'STABILNIE', 'high'),
      item('E', 'ZA MAŁO DANYCH', 'low'),
      item('F', 'ZA MAŁO DANYCH', 'low')
    ]),
    want: {
      trend: 'STABILNIE', confidence: 'high', regresSpread: 'brak',
      counts: { total: 6, progres: 0, stabilnie: 4, regres: 0, zaMalo: 2, credible: 4, solid: 4, plateau: 0, lowConfidence: 0 },
      nStableSolid: 4, nRegresSolid: 0,
      attentionNames: ['A', 'B'],
      why: { A: ['mixed'], B: ['mixed'] },
      thin: ['E', 'F']
    }
  },
  {
    n: 19,
    title: '3× REGRES low + 1× PROGRES high + 1× STABILNIE high',
    pack: pack([
      item('R1', 'REGRES', 'low'),
      item('R2', 'REGRES', 'low'),
      item('R3', 'REGRES', 'low'),
      item('P1', 'PROGRES', 'high'),
      item('S1', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'NIERÓWNY', confidence: 'medium', regresSpread: 'wielu',
      counts: { total: 5, progres: 1, stabilnie: 1, regres: 3, zaMalo: 0, credible: 5, solid: 2, plateau: 0, lowConfidence: 3 },
      nProgresSolid: 1, nStableSolid: 1, nRegresSolid: 0,
      attentionNames: ['R1', 'R2', 'R3'],
      why: { R1: ['regres'], R2: ['regres'], R3: ['regres'] }, thin: []
    }
  },
  {
    n: 20,
    title: '2× STABILNIE high',
    pack: pack([
      item('A', 'STABILNIE', 'high'),
      item('B', 'STABILNIE', 'high')
    ]),
    want: {
      trend: 'STABILNIE', confidence: 'medium', regresSpread: 'brak',
      counts: { total: 2, progres: 0, stabilnie: 2, regres: 0, zaMalo: 0, credible: 2, solid: 2, plateau: 0, lowConfidence: 0 },
      nStableSolid: 2, nRegresSolid: 0, attentionNames: [], thin: []
    }
  }
];

ok('20 cases defined', cases.length === 20);

const rows = [];
cases.forEach(c => {
  const seBefore = JSON.stringify(windowObj.SE);
  const got = aggregateClientProgress(c.pack);
  const seAfter = JSON.stringify(windowObj.SE);
  const checks = expectCase(got, c.want);
  if (seBefore !== seAfter) {
    checks.push({ k: 'SE untouched', pass: false, extra: 'mutated' });
  }
  const pass = checks.every(x => x.pass);
  if (!pass) {
    failed++;
    console.error('FAIL case ' + c.n + ' ' + c.title);
    checks.filter(x => !x.pass).forEach(x => {
      console.error('  ' + x.k + ' got=' + JSON.stringify(x.extra));
    });
    console.error('  got trend=' + got.trend + ' conf=' + got.confidence + ' spread=' + got.regresSpread);
    console.error('  counts=' + JSON.stringify(got.counts));
    console.error('  solid votes P/S/R=' + [got.nProgresSolid, got.nStableSolid, got.nRegresSolid].join('/'));
    console.error('  attention=' + JSON.stringify(got.attention));
    console.error('  reasons=' + JSON.stringify(got.reasons));
  } else {
    console.log('OK   case ' + c.n);
  }
  rows.push({ n: c.n, title: c.title, want: c.want, got: got, pass: pass });
});

ok('aggregator did not call classifyExerciseProgress', classifyCalls === 0);
ok('direct classify still works', classifyExerciseProgress({ snapshots: [] }).label === 'ZA MAŁO DANYCH');

const missing = aggregateClientProgress(null);
ok('missing pack → ZA MAŁO', missing.trend === 'ZA MAŁO DANYCH' && missing.counts.total === 0 && missing.clientId === '');

const unknown = aggregateClientProgress(pack([
  item('X', 'NIEZNANA', 'high'),
  { name: 'Y' },
  item('Z', 'PROGRES', 'wat')
]));
ok('unknown label/conf → thin/low', unknown.counts.zaMalo === 2 && unknown.counts.progres === 1
  && unknown.counts.solid === 0 && unknown.trend === 'ZA MAŁO DANYCH');

const isolated = aggregateClientProgress(pack([
  item('S1', 'STABILNIE', 'high'),
  item('S2', 'STABILNIE', 'high'),
  item('R', 'REGRES', 'high')
]));
ok('isolated solid REGRES stays STABILNIE', isolated.trend === 'STABILNIE'
  && isolated.nRegresSolid === 1 && isolated.nProgresSolid === 0
  && isolated.counts.regres === 1
  && attNames(isolated).join(',') === 'R');

const anna = aggregateClientProgress(pack([
  item('Wyciskanie sztangi', 'PROGRES', 'high', { flags: ['effortHarder', 'doseDecreased'] }),
  item('Przysiad', 'STABILNIE', 'high', { plateau: true, flags: ['reserveAvailable'] }),
  item('Martwy ciąg', 'PROGRES', 'medium', { flags: ['effortHarder'] }),
  item('Wiosłowanie', 'STABILNIE', 'medium', { flags: ['doseIncreased'] }),
  item('Rozpiętki', 'STABILNIE', 'low', { flags: ['mixed'] }),
  item('Deska', 'ZA MAŁO DANYCH', 'low')
], 'anna'));
ok('Anna trend WZROST', anna.trend === 'WZROST' && anna.confidence === 'high' && anna.clientId === 'anna');
eq('Anna counts', anna.counts, {
  total: 6, progres: 2, stabilnie: 3, regres: 0, zaMalo: 1,
  credible: 5, solid: 4, plateau: 1, lowConfidence: 1
});
ok('Anna spread brak', anna.regresSpread === 'brak' && anna.nRegresSolid === 0);
eq('Anna attention names', attNames(anna), ['Rozpiętki', 'Przysiad']);
eq('Anna why Rozpiętki', attWhy(anna, 'Rozpiętki'), ['mixed']);
eq('Anna why Przysiad', attWhy(anna, 'Przysiad'), ['plateau']);
eq('Anna thin', thinNames(anna), ['Deska']);
ok('effortHarder/dose/reserveAvailable not why', !attWhy(anna, 'Przysiad').includes('reserveAvailable'));

ok('effortHarder alone is not attention', attNames(aggregateClientProgress(pack([
  item('A', 'PROGRES', 'high', { flags: ['effortHarder'] }),
  item('B', 'PROGRES', 'high')
]))).length === 0);

const lowThenSolidRegres = aggregateClientProgress(pack([
  item('Low', 'REGRES', 'low'),
  item('Solid', 'REGRES', 'high'),
  item('P1', 'PROGRES', 'high'),
  item('P2', 'PROGRES', 'high')
]));
ok('solid REGRES before low in attention', attNames(lowThenSolidRegres)[0] === 'Solid'
  && attNames(lowThenSolidRegres)[1] === 'Low');

console.log('\n===== 7A przypadki 1–20 =====');
console.log('nr  oczekiwany                                      wynik                                             PASS/FAIL');
rows.forEach(r => {
  const a = r.want.trend + ' / ' + r.want.confidence + ' / ' + r.want.regresSpread;
  const b = r.got.trend + ' / ' + r.got.confidence + ' / ' + r.got.regresSpread;
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(String(r.n).padStart(2) + '  ' + a.padEnd(48) + '  ' + b.padEnd(48) + '  ' + mark);
});
const nPass = rows.filter(r => r.pass).length;
console.log('\n' + nPass + '/' + rows.length + ' PASS');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nAgregat progresu klienta: OK.');
process.exit(0);
