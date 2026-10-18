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
ok('generator: książki w kolejnych częściach planu', gen.includes('`+bookCtx.training;'));
ok('generator: zapis źródeł z książek w planie', /plan\.rationale\.bookSources=bookCtx\.sources/.test(gen));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('index.html ładuje books-kb.js', /<script src="books-kb\.js\?v=\d+"><\/script>/.test(html));

if (failed) { console.error(failed + ' test(ów) nie przeszło'); process.exit(1); }
console.log('Wszystkie testy bazy wiedzy z książek przeszły.');
