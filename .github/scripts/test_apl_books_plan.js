#!/usr/bin/env node
/** Generator AI: reguły ze wszystkich książek w prompcie, liczby objętości z książek, sprawdzanie oznaczeń [K…] w planie. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '../..');
const d = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {}, appendChild() {} }) };
const w = { addEventListener() {}, CL: [], PL: [], SE: [], EX: [], WO: [], METRIC_ENTRIES: [], document: d }; w.window = w;
const c = { window: w, document: d, console, Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON, Set, Map, setTimeout, clearTimeout, isNaN, Infinity, undefined, fetch: async () => ({}) };
c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), c);
vm.runInContext(fs.readFileSync(path.join(root, 'books-kb.js'), 'utf8'), c);
// W przeglądarce window === global; tu kopiujemy API książek do globalnego kontekstu.
Object.keys(w).filter(n => /^booksKb|^PLAN_ANCHORS$/.test(n)).forEach(n => { c[n] = w[n]; });
vm.runInContext(fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8'), c);
c.booksKbSetData(JSON.parse(fs.readFileSync(path.join(root, 'knowledge', 'books-index.json'), 'utf8')));
let failed = 0;
const ok = (n, x, e) => { if (!x) { console.error('FAIL ' + n + (e !== undefined ? ' — ' + JSON.stringify(e) : '')); failed++; } else console.log('OK   ' + n); };

const ctx = c.aplBooksContext({ goal: 'masa', level: 'sredni', method: 'PPL', days: '4', progression: 'dup', equipment: [], intensify: [], notes: '', injuries: 'ból barku', age: '52', gender: 'mężczyzna', weight: '90', height: '180' });
ok('kontekst: blok reguł z książek z oznaczeniami', /PODSTAWA PLANU/.test(ctx.all) && /\[K1\]/.test(ctx.all));
ok('kontekst: te same reguły w kolejnych częściach planu', ctx.training === ctx.all);
ok('kontekst: wszystkie książki treningowe', ctx.sel.books.length === ctx.sel.trainingBooks.length, ctx.sel.books.length + '/' + ctx.sel.trainingBooks.length);
ok('kontekst: oznaczenie reguły-kotwicy', /^\[K\d+\]$/.test(ctx.key('hipertrofia-schoenfeld P2')) && ctx.key('nie-ma-takiej X1') === '');
ok('kontekst: źródła do „Dlaczego taki plan?”', ctx.sources.length >= ctx.sel.books.length);
ok('progresja DUP: oznaczenia reguł z książek', /Podstawa w książkach: \[K\d+\]/.test(c.aplProgressionBookNote(ctx, 'dup', 'PPL')));
ok('Smolov i 5/3/1: oznaczone jako spoza książek', /spoza bazy książek/.test(c.aplProgressionBookNote(ctx, 'smolov', 'Smolov')) && /spoza bazy książek/.test(c.aplProgressionBookNote(ctx, 'linear', '531')));

const beg = c.aplVolumeTarget('poczatkujacy', '60', ''), mid = c.aplVolumeTarget('sredni', '60', ''), adv = c.aplVolumeTarget('zaawansowany', '60', '');
ok('objętość początkujący 10–12 (Helms R1)', beg.weekly === '10–12' && beg.weeklyMin === 10 && beg.sets === '3', beg);
ok('objętość średni 10–20 (Schoenfeld P2, Helms P4)', mid.weekly === '10–20' && mid.weeklyMin === 10, mid);
ok('objętość zaawansowany 14–20', adv.weekly === '14–20', adv);
ok('objętość: odnośniki do reguł z książek', beg.refs.includes('piramida-treningu-helms R1') && mid.refs.includes('hipertrofia-schoenfeld P2'));

const k = ref => ctx.key(ref).slice(1, -1);
const plan = {
  summary: 'Objętość 10–20 serii [' + k('hipertrofia-schoenfeld P2') + '] i [K9999].',
  rationale: { reasoning: ['RIR 1–2 [' + k('hipertrofia-schoenfeld P5') + ']'], sources: ['[K8888]', ''] },
  days: [{ dayName: 'Push', exercises: [{ name: 'Wyciskanie', notes: 'Przerwa 2 min [' + k('hipertrofia-schoenfeld P2') + ']' }] }]
};
c.aplApplyBookRefs(plan, ctx);
ok('plan: czytelne etykiety zamiast [K…]', plan.summary.includes('[Schoenfeld P2]') && plan.days[0].exercises[0].notes.includes('[Schoenfeld P2]') && plan.rationale.reasoning[0].includes('[Schoenfeld P5]'), plan);
ok('plan: wymyślone oznaczenia usunięte', !/K9999|K8888/.test(JSON.stringify(plan)) && plan.bookCoverage.removedRefs === 2, plan.bookCoverage);
ok('plan: puste źródła usunięte', plan.rationale.sources.length === 0, plan.rationale.sources);
ok('plan: lista użytych reguł z cytatem', plan.bookRules.length === 2 && plan.bookRules.every(r => r.cite && r.label && r.text), plan.bookRules);
ok('plan: pokrycie książek', plan.bookCoverage.used === 1 && plan.bookCoverage.total === ctx.sel.trainingBooks.length);
const html = c.aplPlanWhyHTML(plan);
ok('„Dlaczego taki plan?”: reguły z książek i pokrycie', /Reguły z książek użyte w planie/.test(html) && /Schoenfeld P2/.test(html) && /Usunięto 2 oznaczeń/.test(html) && /Książki z bazy wiedzy podane AI/.test(html));
const empty = { rationale: {} }; c.aplApplyBookRefs(empty, ctx);
ok('„Dlaczego taki plan?”: ostrzeżenie, gdy AI nie cytuje książek', /nie powołało się na żadną regułę/.test(c.aplPlanWhyHTML(empty)));

if (failed) { console.error(failed + ' test(ów) nie przeszło'); process.exit(1); }
console.log('\nGenerator planu opiera się na książkach — testy przeszły.');
