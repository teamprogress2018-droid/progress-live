// Generator AI: w jednej jednostce max 1 ćwiczenie na wzorzec ruchowy (2 przy specjalizacji trenera).
// Regresja: Pull-up + Lat Pulldown + Close-Grip Pulldown w jednym dniu = redundancja.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '../..');
const d = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), head: { appendChild() {} }, body: { appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } } } };
const w = { addEventListener() {}, CL: [], PL: [], SE: [], EX: [], WO: [], METRIC_ENTRIES: [], document: d, localStorage: { getItem() { return null; }, setItem() {} } }; w.window = w;
const c = { window: w, document: d, console, Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON, RegExp, Map, Set, setTimeout, clearTimeout, isNaN, Infinity, undefined, fetch: async () => ({}), localStorage: w.localStorage, navigator: { userAgent: 'node' } };
c.globalThis = c; vm.createContext(c);
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const lib = src06.slice(src06.indexOf('function exBiomechNorm'), src06.indexOf('function findStaffSubstitutes'));
vm.runInContext(lib, c);
const defStart = src06.indexOf('const DEF_EX=[') >= 0 ? src06.indexOf('const DEF_EX=[') : src06.indexOf('DEF_EX=[');
let DEF = [];
try { const m = /DEF_EX\s*=\s*\[/.exec(src06); const start = m.index + m[0].length - 1; let depth = 0, i = start; for (; i < src06.length; i++) { const ch = src06[i]; if (ch === '[') depth++; else if (ch === ']') { depth--; if (!depth) break; } } DEF = vm.runInContext('(' + src06.slice(start, i + 1) + ')', c); } catch (e) { DEF = []; }
c.allExercises = () => DEF;
const s03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
vm.runInContext(s03.slice(s03.indexOf('const APL_PATTERN_INFO='), s03.indexOf('window.aplExercisePatternKey=')), c);
let failed = 0;
const ok = (n, x, e) => { if (!x) { console.error('FAIL ' + n + (e ? ' — ' + e : '')); failed++; } else console.log('OK   ' + n); };
const day = (...names) => ({ dayName: 'Dzień 1 — Pull', exercises: names.map(n => ({ name: n, muscleGroup: 'Plecy' })) });
ok('library loaded for name/alias lookup', DEF.length > 500, String(DEF.length));

const bad = c.aplDayPatternRedundancy(day('Podciąganie nachwytem', 'Lat Pulldown szerokim chwytem', 'Close-Grip Pulldown', 'DB Row', 'Face Pull'), {});
ok('Pull-up + Lat Pulldown + Close-Grip Pulldown → 3× vertical pull flagged', bad.length === 1 && bad[0].key === 'vertical_pull' && bad[0].names.length === 3 && bad[0].allowed === 1, JSON.stringify(bad));
ok('row and face pull are not counted as vertical pull', !bad.some(r => r.names.includes('DB Row') || r.names.includes('Face Pull')));

const two = c.aplDayPatternRedundancy(day('Podciąganie na drążku', 'Ściąganie drążka wyciąg', 'Wiosłowanie hantlem'), {});
ok('pull-up + lat pulldown (2) already redundant by default', two.length === 1 && two[0].key === 'vertical_pull', JSON.stringify(two));

const good = c.aplDayPatternRedundancy(day('Podciąganie na drążku', 'Wiosłowanie hantlem', 'Ściąganie do twarzy (face pull)', 'Ściąganie prostymi rękami', 'Uginanie ramion ze sztangą'), {});
ok('functionally varied back day passes', good.length === 0, JSON.stringify(good));

const press = c.aplDayPatternRedundancy({ exercises: [{ name: 'Wyciskanie hantli na ławce płaskiej', muscleGroup: 'Klatka' }, { name: 'Wyciskanie sztangi na ławce płaskiej', muscleGroup: 'Klatka' }, { name: 'Rozpiętki na bramie', muscleGroup: 'Klatka' }] }, {});
ok('flat DB press + flat BB press → redundant (same pattern, different tool)', press.length === 1 && press[0].key === 'press_flat', JSON.stringify(press));
const chest = c.aplDayPatternRedundancy({ exercises: [{ name: 'Wyciskanie sztangi na ławce płaskiej', muscleGroup: 'Klatka' }, { name: 'Wyciskanie hantli na ławce skośnej', muscleGroup: 'Klatka' }, { name: 'Rozpiętki na bramie', muscleGroup: 'Klatka' }] }, {});
ok('flat press + incline press + fly → varied, passes', chest.length === 0, JSON.stringify(chest));
const legs = c.aplDayPatternRedundancy({ exercises: ['Hack squat', 'Przysiad bułgarski', 'Wyprosty nóg na maszynie', 'Uginanie nóg leżąc', 'Martwy ciąg rumuński', 'Hip thrust', 'Wspięcia na palce stojąc'].map(n => ({ name: n, muscleGroup: 'Nogi' })) }, {});
ok('leg day squat/lunge/extension/curl/hinge/thrust/calf passes', legs.length === 0, JSON.stringify(legs));
const legs2 = c.aplDayPatternRedundancy({ exercises: ['Hack squat', 'Leg press', 'Przysiad ze sztangą'].map(n => ({ name: n, muscleGroup: 'Nogi' })) }, {});
ok('hack squat + leg press + squat → redundant', legs2.length === 1 && legs2[0].key === 'knee_bilateral', JSON.stringify(legs2));

const spec = c.aplDayPatternRedundancy(day('Podciąganie na drążku', 'Ściąganie drążka wyciąg', 'Wiosłowanie hantlem'), { notes: 'specjalizacja: szerokość pleców' });
ok('trainer specialization for back allows 2 vertical pulls', spec.length === 0, JSON.stringify(spec));
const spec3 = c.aplDayPatternRedundancy(day('Podciąganie nachwytem', 'Lat Pulldown szerokim chwytem', 'Close-Grip Pulldown'), { notes: 'specjalizacja plecy' });
ok('even with specialization 3 vertical pulls are flagged', spec3.length === 1 && spec3[0].allowed === 2, JSON.stringify(spec3));
const specOther = c.aplDayPatternRedundancy(day('Podciąganie na drążku', 'Ściąganie drążka wyciąg'), { notes: 'specjalizacja klatka' });
ok('specialization of another muscle does not excuse back redundancy', specOther.length === 1, JSON.stringify(specOther));

ok('classifier fixes: face pull, straight-arm, close-grip pulldown, leg curl', c.exerciseBiomech({ name: 'Ściąganie do twarzy (face pull)', cat: 'Plecy' }).pattern === 'scapular_rear_delt' && c.exerciseBiomech({ name: 'Ściąganie prostymi rękami', cat: 'Plecy' }).pattern === 'shoulder_extension' && c.exerciseBiomech({ name: 'Close-Grip Pulldown', cat: '' }).pattern === 'vertical_pull' && c.exerciseBiomech({ name: 'Uginanie nóg leżąc', cat: 'Nogi' }).pattern === 'knee_flexion');
ok('prompt tells AI to pick by pattern first, 1 per pattern', /DOBÓR ĆWICZEŃ WG WZORCA/.test(s03) && /2c\. WZORCE/.test(s03));
ok('generator retries once with the redundancy list', /redundancyHint=aplPatternRedundancyText\(redundant\)/.test(s03) && /redundancyTries<1/.test(s03));
if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('\nAll pattern redundancy checks passed');
