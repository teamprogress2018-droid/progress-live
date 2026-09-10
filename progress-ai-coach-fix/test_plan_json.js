// Parser planu AI — typowe błędy JSON z modelu.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFns(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('function extractJsonObject');
  const end = html.indexOf('async function callAPI');
  if (start < 0 || end < 0 || end <= start) throw new Error('Nie znaleziono parsera w ' + htmlPath);
  const parser = html.slice(start, end);
  const pStart = html.indexOf('function getPlanPhases');
  const pEnd = html.indexOf('function buildPlanPrompt');
  if (pStart < 0 || pEnd < 0 || pEnd <= pStart) throw new Error('Nie znaleziono progresji w ' + htmlPath);
  const progression = html.slice(pStart, pEnd);
  const ctx = { console, JSON, String, Number, Math, parseInt, parseFloat, Array, Object, isNaN };
  vm.createContext(ctx);
  vm.runInContext(parser + '\n' + progression, ctx);
  return ctx;
}

const ctx = loadFns(path.join(__dirname, 'index.html'));
const { parseAIJson, applyLocalProgression, getPlanPhases } = ctx;
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const valid = parseAIJson('{"planTitle":"FBW","sessions":[{"sessionName":"A","exercises":[{"name":"Przysiad","w1":{"s":4,"r":"8"}}]}]}');
ok('plain json', valid.planTitle === 'FBW' && valid.sessions[0].exercises[0].name === 'Przysiad');

const fenced = parseAIJson('```json\n{"planTitle":"PPL","sessions":[]}\n```');
ok('markdown fence', fenced.planTitle === 'PPL');

const trailing = parseAIJson('{"sessions":[{"sessionName":"A"},{"sessionName":"B"},]}');
ok('trailing comma in array', trailing.sessions.length === 2 && trailing.sessions[1].sessionName === 'B');

const trailingObj = parseAIJson('{"planTitle":"X","sessionsPerWeek":3,}');
ok('trailing comma in object', trailingObj.planTitle === 'X' && trailingObj.sessionsPerWeek === 3);

const missing = parseAIJson('{"sessions":[{"sessionName":"A"}{"sessionName":"B"}]}');
ok('missing comma between objects', missing.sessions.length === 2 && missing.sessions[1].sessionName === 'B');

const truncated = parseAIJson('{"planTitle":"FBW","sessions":[{"sessionName":"A","exercises":[{"name":"Przysiad"');
ok('truncated object closed', truncated.planTitle === 'FBW' && truncated.sessions[0].exercises[0].name === 'Przysiad');

const smart = parseAIJson('{“planTitle”:“Masa”,“sessions”:[]}');
ok('smart quotes', smart.planTitle === 'Masa');

const extraText = parseAIJson('Oto plan:\n{"planTitle":"HIIT","sessions":[]}\nKoniec.');
ok('surrounding prose', extraText.planTitle === 'HIIT');

const innerQuotes = parseAIJson('{"planTitle":"Test","philosophy":"Utrzymaj \\"core\\" napięty","sessions":[]}');
ok('escaped inner quotes', innerQuotes.planTitle === 'Test' && innerQuotes.philosophy.includes('core'));

const rawInnerQuotes = parseAIJson('{"planTitle":"Plan","philosophy":"Opis z cudzysłowem "w środku" tekstu","split":"PPL","sessions":[]}');
ok('unescaped inner quotes repaired', rawInnerQuotes.planTitle === 'Plan' && rawInnerQuotes.philosophy.includes('w środku'));

const dblComma = parseAIJson('{"planTitle":"Test",, "sessions":[]}');
ok('double comma', dblComma.planTitle === 'Test');

// Reprodukcja błędu ze zrzutu: "Expected ',' or '}' after property value" przez cudzysłów w notes
const notesQuote = parseAIJson('{"planTitle":"PPL 8 tyg","sessions":[{"sessionName":"Push","exercises":[{"name":"Wyciskanie","notes":"Utrzymaj "łopatki" ściągnięte","w1":{"s":4,"r":"8","rest":"90s","rpe":"7","kg":"60"}}]}]}');
ok('notes with inner quotes', notesQuote.sessions[0].exercises[0].notes.includes('łopatki') && notesQuote.sessions[0].exercises[0].w1.kg === '60');

const pad = 'x'.repeat(16000);
const longBroken = '{"planTitle":"' + pad + '","philosophy":"trzymaj "core" napięty","sessions":[{"sessionName":"A","exercises":[{"name":"Przysiad","w1":{"s":3,"r":"10"}}]}]}';
const longParsed = parseAIJson(longBroken);
ok('long json with inner quotes near 16k', longParsed.philosophy.includes('core') && longParsed.sessions[0].exercises[0].name === 'Przysiad');

const salvage = parseAIJson('{"planTitle":"X","sessions":[{"sessionName":"A","exercises":[{"name":"Przysiad","w1":{"s":3,"r":"10"}},{"name":"RDL"');
ok('salvage last complete exercise', salvage.sessions[0].exercises[0].name === 'Przysiad');

const phases = getPlanPhases(8);
ok('8-week phases', phases.w1 === 'Adaptacja' && phases.w7 === 'Deload' && phases.w8 === 'Szczyt');

const plan = {
  sessions: [{
    sessionName: 'Push',
    exercises: [{ name: 'Wyciskanie', w1: { s: 4, r: '8', rest: '90s', rpe: '7', kg: '60' } }]
  }]
};
applyLocalProgression(plan, ['w1','w2','w3','w4','w5','w6','w7','w8'], phases, 'linear');
ok('local w2 kg', plan.sessions[0].exercises[0].w2 && Number(plan.sessions[0].exercises[0].w2.kg) === 62.5);
ok('local deload w7', Number(plan.sessions[0].exercises[0].w7.s) === 2);
ok('phases overwritten', plan.phases.w8 === 'Szczyt');

const cardio = {
  sessions: [{
    sessionName: 'Cardio LISS',
    exercises: [{ name: 'Marsz', w1: { s: 1, r: '30 min', rest: '—', rpe: '5', kg: '60-65% HRmax' } }]
  }]
};
applyLocalProgression(cardio, ['w1','w2'], {w1:'Adaptacja',w2:'Adaptacja'}, 'linear');
ok('cardio kg not mangled', cardio.sessions[0].exercises[0].w2.kg === '60-65% HRmax');

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
ok('index asks only w1', /Podaj wartości TYLKO dla tygodnia 1/.test(indexSrc));
ok('index no empty-weeks throw', !/Pusta odpowiedź dla tygodni/.test(indexSrc));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nParser planu AI OK.');
