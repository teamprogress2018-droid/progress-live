#!/usr/bin/env node
/** Academy „Badania” (przeglądarka): klasyfikacja, wyszukiwanie, linki, XSS, stany błędów, cache, zapis. Offline (vm). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL', name); failed++; } else console.log('OK  ', name);
}
const text = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const cfg = JSON.parse(read('.github/scripts/research_base_queries.json'));
const synth = (o) => ({ titlePl: 'Tytuł PL', coZbadano: 'Porównano 10 i 20 serii.', coZnaleziono: 'Większy przyrost przy 20 seriach.', dlaTrenera: 'Dokładaj serie stopniowo.', czegoNieDowodzi: 'Nie dotyczy początkujących.', populacja: 'wytrenowani mężczyźni', liczebnosc: 24, uzytecznosc: 'wysoka', pewnosc: 'mocne', ...o });
const BASE = {
  version: 1, generatedAt: '2026-10-19T05:00:00Z', sources: { pubmed: 'ok' },
  categories: cfg.categories.map((c) => ({ id: c.id, label: c.label, keywords: c.keywords })),
  studies: {
    '101': { pmid: '101', doi: '10.1007/s40279-022-01234-5', doiVerified: true, pmcid: 'PMC9000001', openAccess: true, title: 'Resistance training volume and muscle hypertrophy: a meta-analysis', journal: 'Sports Medicine', journalAbbr: 'Sports Med', year: '2023', authors: 'Pelland J, Remmert J, Robinson Z i in.', evidence: 'meta', categories: ['hipertrofia'], hasAbstract: true, synth: synth({ titlePl: 'Objętość treningu a hipertrofia – metaanaliza' }) },
    '102': { pmid: '102', doi: '', doiVerified: false, pmcid: '', openAccess: false, title: 'Training to failure and hypertrophy: randomized trial', journal: 'J Strength Cond Res', year: '2019', authors: 'Kowalski J', evidence: 'rct', categories: ['hipertrofia'], hasAbstract: true, synth: synth({ titlePl: 'Trening do upadku a przyrost mięśni', pewnosc: 'umiarkowane', uzytecznosc: 'srednia' }) },
    '103': { pmid: '103', doi: '10.9999/not-real', doiVerified: false, pmcid: '', openAccess: false, title: 'Sets per week: systematic review <script>alert(1)</script>', journal: 'Eur J Sport Sci', year: '2025', authors: 'Nowak A', evidence: 'sr', categories: ['hipertrofia'], hasAbstract: false, synth: null },
    '201': { pmid: '201', doi: '10.1186/s12970-017-0177-8', doiVerified: true, title: 'ISSN position stand: protein and exercise', journal: 'J Int Soc Sports Nutr', year: '2017', authors: 'Jäger R i in.', evidence: 'guideline', categories: ['zywienie'], hasAbstract: true, synth: synth({ titlePl: 'Stanowisko ISSN: białko i wysiłek', coZbadano: 'Przegląd dowodów o białku.', coZnaleziono: 'Zalecenia dotyczące białka.', dlaTrenera: 'Białko rozkładaj na posiłki.' }) },
    '301': { pmid: '301', doi: '', title: 'HIIT in adults with obesity: meta-analysis', journal: 'Obes Rev', year: '2026', authors: 'Lee K i in.', evidence: 'meta', categories: ['hiit', 'cardio'], hasAbstract: true, synth: synth({ titlePl: 'HIIT u dorosłych z otyłością', coZbadano: 'HIIT vs ciągły wysiłek u osób z otyłością.', coZnaleziono: 'Podobny spadek tkanki tłuszczowej.', dlaTrenera: 'Zacznij od spokojnego cardio, HIIT po zbudowaniu bazy.' }) }
  },
  questions: [
    { id: 'h-objetosc', category: 'hipertrofia', q: 'Czy większa objętość zawsze zwiększa hipertrofię?', studyIds: ['101', '102', '103'], answer: {
      krotko: 'Nie zawsze: przyrost rośnie z objętością, ale coraz wolniej [S1] [S7].',
      dlaczego: 'Metaanaliza pokazuje malejące korzyści [S1]. Książka zaleca 10–20 serii [K1].',
      praktyka: ['Zacznij od umiarkowanej liczby serii [K1].', 'Dokładaj serie przy zastoju [S1].'],
      dlaKogo: 'Dla trenujących regularnie [S1].', ostroznie: 'Przy słabej regeneracji [S2].',
      ksiazkaVsBadania: 'Zgodne [K1] [S1].', pytanie: { q: 'Czy 40 serii zawsze da więcej niż 20?', a: 'Nie ma na to dowodów [S1].' },
      porownanie: { ksiazka: '10–20 serii [K1]', badania: 'Malejące korzyści [S1]', wspolne: 'Objętość ma znaczenie', roznice: 'Górna granica niepewna', rekomendacja: 'Zwiększaj stopniowo [S1]' },
      pewnosc: 'mocne', refs: ['K1', 'S1', 'S2'],
      sources: { S: ['101', '102', '103'], K: [{ cite: 'Głuchowski, Zaplanuj swój trening, s. 95', status: 'zrodlo' }] }
    } },
    { id: 'h-upadek', category: 'hipertrofia', q: 'Czy trening do upadku jest konieczny?', studyIds: ['102'], answer: null },
    { id: 'z-bialko', category: 'zywienie', q: 'Ile białka potrzebuje osoba trenująca siłowo?', studyIds: ['201'], answer: null },
    { id: 'i-poczatkujacy', category: 'hiit', q: 'Czy HIIT jest dobry dla początkującego z nadwagą?', studyIds: ['301'], answer: null }
  ],
  recent: { hiit: ['301'] }
};

function makeCtx(fetchImpl) {
  const screen = { innerHTML: '' };
  const inputs = {};
  const notes = [];
  const ctx = { console, URL, setTimeout, clearTimeout, AbortController, Date, KB: [], CL: [], notify: (m) => notes.push(m) };
  ctx.window = ctx;
  ctx.document = { getElementById: (id) => (id === 'screen-academy' ? screen : inputs[id] || null), querySelectorAll: () => [] };
  ctx.fetch = fetchImpl || (async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(BASE)) }));
  vm.createContext(ctx);
  vm.runInContext(read('11-progress-academy.js'), ctx);
  vm.runInContext(read('research-academy.js'), ctx);
  return { ctx, screen, inputs, notes };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  /* 1. Klasyfikacja kategorii. */
  const { ctx, screen, inputs, notes } = makeCtx();
  const RA = ctx.ResearchAcademy;
  const cats = BASE.categories;
  const top = (q) => (RA.classify(q, cats)[0] || {}).id;
  ok('klasyfikacja: objętość → hipertrofia', top('Czy większa objętość zawsze zwiększa hipertrofię?') === 'hipertrofia');
  ok('klasyfikacja: HIIT → HIIT i Tabata', top('Czy HIIT jest dobry dla początkującego z nadwagą?') === 'hiit');
  ok('klasyfikacja: Tabata → HIIT i Tabata', top('Czym różni się Tabata od zwykłego HIIT?') === 'hiit');
  ok('klasyfikacja: cardio + siła → cardio', RA.classify('Jak łączyć cardio z treningiem siłowym?', cats).map((c) => c.id).includes('cardio'));
  ok('klasyfikacja: przerwy → trening siłowy', top('Jakie przerwy stosować przy treningu siłowym?') === 'sila');
  ok('klasyfikacja: białko → żywienie', top('Ile białka na redukcji?') === 'zywienie');
  ok('klasyfikacja: ból krzyża → bezpieczeństwo', top('Klient zgłasza ból krzyża przy martwym ciągu') === 'bezpieczenstwo');
  ok('klasyfikacja: sen → regeneracja', top('Czy brak snu obniża siłę?') === 'regeneracja');
  ok('klasyfikacja: maszyny → anatomia i dobór ćwiczeń', top('Maszyny czy wolne ciężary na start?') === 'anatomia');
  ok('klasyfikacja: równowaga → funkcjonalny', top('Ćwiczenia równowagi dla seniora') === 'funkcjonalny');
  ok('klasyfikacja: bez słów kluczowych → brak kategorii', RA.classify('Jaka jest pogoda?', cats).length === 0);

  /* 2. Linki: tylko https, znane serwisy, DOI po weryfikacji, pełny tekst tylko open access. */
  ok('link: javascript: odrzucony', RA.safeHref('javascript:alert(1)') === '');
  ok('link: http odrzucony', RA.safeHref('http://pubmed.ncbi.nlm.nih.gov/1/') === '');
  ok('link: obca domena odrzucona', RA.safeHref('https://evil.example/pubmed') === '');
  ok('link: PubMed dozwolony', RA.safeHref('https://pubmed.ncbi.nlm.nih.gov/101/') !== '');
  const l101 = RA.studyLinks(BASE.studies['101']).map((l) => l.label + ' ' + l.href).join('|');
  ok('link: PubMed + DOI + pełny tekst open access', /PubMed https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/101\//.test(l101) && l101.includes('https://doi.org/10.1007/s40279-022-01234-5') && l101.includes('europepmc.org/article/PMC/PMC9000001'));
  const l102 = RA.studyLinks(BASE.studies['102']);
  ok('bez DOI: tylko PubMed', l102.length === 1 && l102[0].label === 'PubMed');
  ok('niezweryfikowany DOI nie jest linkowany', !RA.studyLinks(BASE.studies['103']).some((l) => l.label === 'DOI'));
  ok('PMID z niecyfrowym id nie tworzy linku', RA.studyLinks({ pmid: '1"><script>', doi: '' }).length === 0);

  /* 3. Renderowanie kart: XSS, brak abstraktu, zewnętrzne linki. */
  const card = RA.renderCard(BASE.studies['103'], 'S3');
  ok('karta: tytuł escapowany (XSS)', !card.includes('<script>') && card.includes('&lt;script&gt;'));
  ok('karta: bez abstraktu tylko metadane', card.includes('Brak opracowania') && !card.includes('Co znaleziono?'));
  const card1 = RA.renderCard(BASE.studies['101'], 'S1');
  ok('karta: wszystkie sekcje', ['Co zbadano?', 'Co znaleziono?', 'Co to oznacza dla trenera?', 'Czego to badanie nie dowodzi?'].every((s) => card1.includes(s)));
  ok('karta: typ, pewność, użyteczność, populacja, n', card1.includes('Metaanaliza') && card1.includes('Mocne dowody') && card1.includes('Użyteczność: Wysoka') && card1.includes('n = 24'));
  ok('karta: linki w nowej karcie z noopener', (card1.match(/target="_blank" rel="noopener noreferrer"/g) || []).length === 3);
  const evil = RA.renderCard({ ...BASE.studies['102'], synth: synth({ coZnaleziono: '<img src=x onerror=alert(1)>' }) }, 'S1');
  ok('karta: treść AI escapowana', !evil.includes('<img') && evil.includes('&lt;img'));

  /* 4. Brak zmyślonych cytowań: przypisy tylko do istniejących źródeł. */
  const ans = RA.renderAnswer(BASE.questions[0].answer, BASE.studies);
  ok('odpowiedź: 8 części', ['Krótka odpowiedź', 'Dlaczego', 'Co zrobić w praktyce', 'Dla kogo', 'Kiedy nie stosować', 'Źródła z datą publikacji', 'Książka a nowsze badania', 'Pytanie kontrolne'].every((s) => ans.includes(s)));
  ok('odpowiedź: [S7] spoza listy usunięty', !ans.includes('S7') && ans.includes('href="#research-src-S1"'));
  ok('odpowiedź: źródła z rokiem i linkiem', ans.includes('(2023)') && ans.includes('https://pubmed.ncbi.nlm.nih.gov/101/'));
  ok('odpowiedź: reguła z książki opisana jako z książki', ans.includes('Głuchowski') && ans.includes('z książki'));
  const fakeOnly = RA.refsHtml('Wynik [S9] i [K4].', new Set(['S1']));
  ok('przypisy: nieznane klucze znikają', !/S9|K4/.test(fakeOnly));
  const noSrc = RA.renderAnswer({ ...BASE.questions[0].answer, sources: { S: ['999'], K: [] } }, BASE.studies);
  ok('odpowiedź: źródło spoza bazy nie jest pokazywane', !noSrc.includes('999') && !noSrc.includes('research-src-S1'));

  /* 5. Wyszukiwanie: opracowane pytanie, 3–5 wyników, sortowanie, cache. */
  ctx.ResearchAcademy.setData(JSON.parse(JSON.stringify(BASE)));
  const r1 = RA.search(ctx.ResearchAcademy.state.data, 'czy wieksza objetosc zawsze zwieksza hipertrofie', { limit: 3 });
  ok('szukaj: dopasowane opracowane pytanie', r1.matched && r1.matched.id === 'h-objetosc');
  ok('szukaj: najwyżej 3 karty domyślnie', r1.studies.length <= 3 && r1.studies.length >= 1);
  ok('szukaj: jakość → metaanaliza pierwsza', r1.studies[0].pmid === '101');
  const r5 = RA.search(RA.state.data, 'Czy większa objętość zawsze zwiększa hipertrofię?', { limit: 9 });
  ok('szukaj: limit nie przekracza 5', r5.studies.length <= 5);
  const newest = RA.search(RA.state.data, 'objętość serie hipertrofia', { sort: 'newest', limit: 5 });
  ok('szukaj: sortowanie najnowsze', newest.studies.map((s) => Number(s.year)).every((y, i, a) => i === 0 || a[i - 1] >= y));
  const again = RA.search(RA.state.data, 'czy wieksza objetosc zawsze zwieksza hipertrofie', { limit: 3 });
  ok('cache: drugie identyczne wyszukiwanie z pamięci', again === r1);
  const hiit = RA.search(RA.state.data, 'HIIT dla początkującego z nadwagą', { limit: 3 });
  ok('szukaj: HIIT → badanie o HIIT', hiit.studies.length && hiit.studies[0].pmid === '301');
  const none = RA.search(RA.state.data, 'najlepsza pogoda na wakacje', { limit: 3 });
  ok('szukaj: brak wyników dla pytania spoza bazy', none.studies.length === 0);

  /* 6. Widok: ładowanie → wynik → karta → wniosek → zapis do własnych źródeł. */
  const fresh = makeCtx();
  fresh.ctx.academySetLevel('research');
  ok('widok: stan ładowania', fresh.screen.innerHTML.includes('Wczytuję bazę badań'));
  await flush(); await flush();
  ok('widok: zakładka „Badania” w Academy', fresh.screen.innerHTML.includes('>Badania</button>'));
  ok('widok: kategorie Piotra', ['Hipertrofia', 'Trening siłowy', 'Cardio i wydolność', 'HIIT i Tabata', 'Żywienie', 'Anatomia, biomechanika i dobór ćwiczeń', 'Trening funkcjonalny i motoryka', 'Regeneracja, sen i zmęczenie', 'Ból, bezpieczeństwo i granice kompetencji trenera'].every((c) => text(fresh.screen.innerHTML).includes(c)));
  fresh.inputs['academy-research-q'] = { value: 'Czy większa objętość zawsze zwiększa hipertrofię?' };
  fresh.ctx.academyResearchSubmit({ preventDefault() {} });
  const page = fresh.screen.innerHTML;
  ok('przepływ: odpowiedź Academy', page.includes('Odpowiedź Academy') && page.includes('Krótka odpowiedź'));
  ok('przepływ: karty z kluczami S1…', page.includes('id="research-src-S1"'));
  ok('przepływ: praktyczny wniosek', page.includes('Co to oznacza dla trenera?'));
  fresh.ctx.academyResearchCompare();
  ok('porównaj źródła: 5 pól', ['Książka / notatka trenera', 'Najnowsze badania', 'Wspólny wniosek', 'Różnice lub niepewność', 'Rekomendacja praktyczna dla trenera'].every((s) => fresh.screen.innerHTML.includes(s)));
  /* Zapis bez logowania nie udaje sukcesu. */
  await fresh.ctx.academyResearchSave('101');
  ok('zapis: bez połączenia komunikat i brak wpisu', fresh.notes.some((n) => /Zaloguj/.test(n)) && fresh.ctx.KB.length === 0);
  const persisted = [];
  fresh.ctx._db = {};
  fresh.ctx.persistById = async (col, obj) => { persisted.push([col, obj]); return { ...obj, _fbId: obj.id }; };
  await fresh.ctx.academyResearchSave('101');
  const entry = persisted[0] && persisted[0][1];
  ok('zapis: kolekcja kb, model „evidence”', persisted.length === 1 && persisted[0][0] === 'kb' && entry.kind === 'evidence');
  ok('zapis: metadane i status „do przeczytania”', entry.pmid === '101' && entry.doi === '10.1007/s40279-022-01234-5' && entry.year === '2023' && entry.researchStatus === 'do_przeczytania' && entry.reliability === 'mocne');
  ok('zapis: nie trafia od razu do planowania AI', entry.useInPlanning === false);
  ok('zapis: link DOI jako źródło', entry.sourceUrl === 'https://doi.org/10.1007/s40279-022-01234-5');
  ok('zapis: brak danych klienta w rekordzie', !Object.keys(entry).some((k) => /client/i.test(k)));
  ok('zapis: karta pokazuje „W moich źródłach”', fresh.screen.innerHTML.includes('W moich źródłach'));
  await fresh.ctx.academyResearchSave('101');
  ok('zapis: duplikat nie jest zapisywany drugi raz', persisted.length === 1);

  /* 7. Dane klienta: pytanie z imieniem i nazwiskiem klienta jest zatrzymane. */
  fresh.ctx.CL = [{ id: 'c1', name: 'Anna Kowalska' }];
  fresh.inputs['academy-research-q'] = { value: 'Anna Kowalska ma nadciśnienie, czy może robić HIIT?' };
  fresh.ctx.academyResearchSubmit({ preventDefault() {} });
  ok('dane klienta: ostrzeżenie i brak wyszukiwania', fresh.screen.innerHTML.includes('nie przyjmuje danych klientów') && !fresh.screen.innerHTML.includes('Odpowiedź Academy'));

  /* 8. Błędy źródła: Academy działa dalej. */
  const down = makeCtx(async () => { throw new Error('network'); });
  down.ctx.academySetLevel('research');
  await flush(); await flush();
  ok('błąd: komunikat „źródło chwilowo niedostępne”', down.screen.innerHTML.includes('Źródło chwilowo niedostępne') && down.screen.innerHTML.includes('Spróbuj ponownie'));
  down.ctx.academySetLevel('quick');
  ok('błąd: inne zakładki Academy działają', down.screen.innerHTML.includes('Objętość') && down.screen.innerHTML.includes('academy-tabs'));
  const missing = makeCtx(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  missing.ctx.academySetLevel('research');
  await flush(); await flush();
  ok('brak pliku bazy: stan „budowana”', missing.screen.innerHTML.includes('jest jeszcze budowana'));
  const broken = makeCtx(async () => ({ ok: true, status: 200, json: async () => ({ studies: 'x' }) }));
  broken.ctx.academySetLevel('research');
  await flush(); await flush();
  ok('uszkodzony plik: błąd zamiast awarii', broken.screen.innerHTML.includes('niepoprawny format'));
  const limited = makeCtx(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  limited.ctx.academySetLevel('research');
  await flush(); await flush();
  ok('limit (429): czytelny błąd', limited.screen.innerHTML.includes('Źródło chwilowo niedostępne'));

  /* 9. Prawdziwa baza w repo (gdy już zbudowana). */
  const realPath = path.join(root, 'knowledge/research-base.json');
  if (fs.existsSync(realPath)) {
    const real = JSON.parse(fs.readFileSync(realPath, 'utf8'));
    const v = makeCtx(async () => ({ ok: true, status: 200, json: async () => real }));
    v.ctx.ResearchAcademy.setData(real);
    const examples = ['Czy większa objętość zawsze zwiększa hipertrofię?', 'Czy HIIT jest dobry dla początkującego z nadwagą?', 'Jak łączyć cardio z treningiem siłowym?', 'Jakie przerwy stosować przy treningu siłowym?', 'Czy trening do upadku jest konieczny?'];
    examples.forEach((q) => {
      const r = v.ctx.ResearchAcademy.search(real, q, { limit: 5 });
      ok('baza: „' + q + '” ma 1–5 kart', r.studies.length >= 1 && r.studies.length <= 5);
    });
    const allIds = new Set(Object.keys(real.studies));
    ok('baza: odpowiedzi cytują tylko badania z bazy', real.questions.every((q) => !q.answer || q.answer.sources.S.every((id) => allIds.has(id))));
  }

  if (failed) { console.error(`\n${failed} test(ów) nie przeszło`); process.exit(1); }
  console.log('\nWszystkie testy zakładki Badania przeszły.');
})().catch((e) => { console.error(e); process.exit(1); });
