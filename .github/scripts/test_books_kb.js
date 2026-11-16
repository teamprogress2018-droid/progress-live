#!/usr/bin/env node
/** Baza wiedzy z książek: indeks aktualny, dobór reguł pod klienta, cytaty, podpięcie w generatorze planu. */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./build_books_index.js');

const root = path.join(__dirname, '..', '..');
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); failed++; }
  else console.log('OK  ', name);
}

const booksDir = path.join(root, 'knowledge', 'books');
const built = B.serialize(B.buildIndex(booksDir));
const onDisk = fs.readFileSync(path.join(root, 'knowledge', 'books-index.json'), 'utf8');
ok('books-index.json aktualny (node .github/scripts/build_books_index.js)', built === onDisk);

const index = JSON.parse(onDisk);
const files = fs.readdirSync(booksDir).filter(f => f.endsWith('.json'));
ok('każdy plik książki jest w indeksie', index.books.length === files.length, { books: index.books.length, files: files.length });
ok('brak reguł brak_w_zrodle w indeksie', index.chunks.every(c => c.st !== 'brak_w_zrodle'));
ok('każda reguła ma tekst i książkę', index.chunks.every(c => c.t && index.books[c.b]));

// Nowa książka w innym formacie (meta + reguły z polami {value,status}) — wystarczy wrzucić plik.
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'books-'));
fs.writeFileSync(path.join(tmp, 'testowa-ksiazka-baza-wiedzy.json'), JSON.stringify({
  meta: { title: 'Testowa książka', author: 'Jan Testowy', year: 2026 },
  principles: [{ id: 'P1', title: 'Objętość', rule: 'Hipertrofia: 12 serii na partię', status: 'zrodlo', sources: [{ ref: 'x', pages: '10' }] }],
  progressionRules: [{ id: 'R1', goal: 'hipertrofia', sets: { value: 3, status: 'wniosek' } }],
  safetyRules: [{ id: 'S1', trigger: 'ból kolana', action: 'skróć zakres', status: 'brak_w_zrodle' }],
  nutritionRules: [{ id: 'N1', rule: 'Białko 2 g/kg', status: 'zrodlo' }]
}));
const small = B.buildIndex(tmp);
ok('nowa książka: tytuł i autor z meta', small.books[0].title === 'Testowa książka' && small.books[0].author === 'Jan Testowy', small.books[0]);
ok('nowa książka: reguły bez brak_w_zrodle', small.chunks.map(c => c.id).join(',') === 'P1,R1,N1', small.chunks.map(c => c.id));
ok('status wniosek z pól {value,status}', small.chunks.find(c => c.id === 'R1').st === 'wniosek');
ok('nutritionRules w książce treningowej → dziedzina żywienie', small.chunks.find(c => c.id === 'N1').d === 'nutrition');
ok('strony w cytacie', small.chunks.find(c => c.id === 'P1').p === '10');

const K = require(path.join(root, 'books-kb.js'));
K.booksKbSetData(index);
const sel = K.booksKbSelect({ mode: 'training', query: 'masa początkujący FBW 3 dni', safetyQuery: 'ból kolana', maxChars: 9000 });
ok('dobór: są reguły treningowe', sel.length >= 8, sel.length);
ok('dobór: tylko dziedzina trening', sel.every(r => { const b = index.books.find(x => x.id === r.book); return b && b.domain !== 'marketing' && b.domain !== 'coaching'; }));
ok('dobór: reguła bezpieczeństwa pod kolano', sel.some(r => /safety|ifThen|specialPopulation/.test(r.section) && /kolan/i.test(r.text)));
ok('dobór: limit znaków', sel.reduce((n, r) => n + r.text.length + 120, 0) <= 9000);
ok('dobór: każda reguła ma cytat książki', sel.every(r => r.cite && r.ref));

const ctx = K.booksKbContext({ mode: 'training', reset: true, query: 'masa', maxChars: 4000 });
ok('kontekst: nagłówek i oznaczenia reguł', /WIEDZA Z KSIĄŻEK TRENERA \(trening\)/.test(ctx) && /\[[a-z0-9-]+ [^\]|]+\|(źródło|wniosek|poza źródłem)\]/.test(ctx));
ok('kontekst: źródła do uzasadnienia planu', K.booksKbUsedSources().length > 0);
ok('tryb dev bez książek', K.booksKbContext({ mode: 'dev', query: 'masa' }) === '');
ok('pytanie o białko → żywienie', /\(żywienie\)/.test(K.booksKbContext({ mode: 'coach', query: 'ile białka na masie' })));
ok('tryb business → marketing', /\(marketing\)/.test(K.booksKbContext({ mode: 'business', query: 'pozycjonowanie marki kategoria' })));

const gen = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
ok('generator ładuje książki przed promptem', /await booksKbLoad\(\)/.test(gen) && gen.indexOf('aplBooksContext({') < gen.indexOf('const systemPrompt='));
ok('generator: książki w kolejnych częściach planu', gen.includes('`+bookCtx.training+'));
ok('generator: zapis źródeł z książek w planie', /plan\.rationale\.bookSources=bookCtx\.sources/.test(gen) && /aplApplyBookRefs\(plan,bookCtx\)/.test(gen));
ok('generator: reguły z książek przed ustawieniami aplikacji', /KOLEJNOŚĆ WAŻNOŚCI/.test(gen) && /DOMYŚLNE USTAWIENIA APLIKACJI \(nie z książek\)/.test(gen));
ok('generator: bez tabeli MEV/MAV/MRV spoza książek', !/MEV 10 \/ MAV/.test(gen) && /OBJĘTOŚĆ Z KSIĄŻEK/.test(gen));
ok('generator: Smolov i 5/3/1 oznaczone jako spoza książek', /Metoda spoza bazy książek/.test(gen));

// Generator: reguły ze wszystkich książek treningowych, kotwice liczb, oznaczenia [K…].
const trainingBooks = index.books.filter((b, i) => index.chunks.some(c => c.b === i && c.d === 'training')).map(b => b.id);
Object.entries(K.PLAN_ANCHORS).forEach(([topic, refs]) => refs.forEach(ref => {
  const [book, id] = ref.split(' ');
  const bi = index.books.findIndex(b => b.id === book);
  ok('kotwica ' + topic + ' istnieje: ' + ref, bi >= 0 && index.chunks.some(c => c.b === bi && c.id === id));
}));
const cases = [
  { query: 'masa średnio zaawansowany PPL 4 dni pełna siłownia', progression: 'dup', level: 'sredni', safetyQuery: 'ból kolana' },
  { query: 'redukcja początkujący FBW 3 dni', progression: 'linear', level: 'poczatkujacy', safetyQuery: 'starsi wiek osoby starsze otyłość' },
  { query: 'siła zaawansowany Blokowa 4 dni', progression: 'block', level: 'zaawansowany', safetyQuery: '' },
  { query: 'kondycja Obwodowy 3 dni', progression: 'wave', level: 'sredni', safetyQuery: 'ból kręgosłupa' }
];
cases.forEach(c => {
  const p = K.booksKbPlanSelect(Object.assign({ nutritionQuery: 'białko kalorie' }, c));
  const books = new Set(p.rules.filter(r => r.topic !== 'żywienie').map(r => r.book));
  ok('plan [' + c.query + ']: reguły z każdej książki treningowej', trainingBooks.every(b => books.has(b)), trainingBooks.filter(b => !books.has(b)));
  ok('plan [' + c.query + ']: kotwice progresji ' + c.progression, K.PLAN_ANCHORS[c.progression].every(ref => p.rules.some(r => r.ref === ref)));
  ok('plan [' + c.query + ']: oznaczenia K1…Kn bez dziur', p.rules.every((r, i) => r.key === 'K' + (i + 1)));
  ok('plan [' + c.query + ']: etykiety jednoznaczne', new Set(p.rules.map(r => r.label)).size === p.rules.length);
  ok('plan [' + c.query + ']: są reguły żywieniowe', p.rules.some(r => r.topic === 'żywienie'));
});
const planSel = K.booksKbPlanSelect({ query: 'masa', progression: 'double', level: 'sredni' });
const prompt = K.booksKbPlanPrompt(planSel);
ok('prompt: oznaczenia [K1] i zasada cytowania', /\[K1\] \(/.test(prompt) && /WYŁĄCZNIE oznaczeń z tej listy/.test(prompt));
const k1 = planSel.rules[0], k2 = planSel.rules[1];
const plan = {
  summary: 'Objętość 10–20 serii [K1], RIR [K2, K999].',
  periodization: 'Wg [' + k2.ref + '] i [K4040]. Zakres [8-12] zostaje.',
  days: [{ exercises: [{ name: 'Przysiad', notes: 'Technika [K1]' }] }],
  rationale: { sources: ['[K77]', 'Objętość [K1]'] }
};
const check = K.booksKbValidatePlanRefs(plan, planSel);
ok('walidacja: prawidłowe [K1] → czytelna etykieta', plan.summary.includes('[' + k1.label + ']') && plan.days[0].exercises[0].notes.includes('[' + k1.label + ']'));
ok('walidacja: pełny ref też rozpoznany', plan.periodization.includes('[' + k2.label + ']'));
ok('walidacja: wymyślone oznaczenia usunięte', !/K999|K4040|K77/.test(JSON.stringify(plan)) && check.removed === 3, { removed: check.removed, plan });
ok('walidacja: zwykłe nawiasy zostają', plan.periodization.includes('[8-12]'));
ok('walidacja: lista użytych reguł', check.used.map(r => r.key).join(',') === 'K1,K2');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('index.html ładuje books-kb.js', /<script src="books-kb\.js\?v=\d+"><\/script>/.test(html));

if (failed) { console.error(failed + ' test(ów) nie przeszło'); process.exit(1); }
console.log('Wszystkie testy bazy wiedzy z książek przeszły.');
