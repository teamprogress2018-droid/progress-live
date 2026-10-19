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
  vm.runInContext(read('research-answer.js'), ctx);
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

  /* 9a. Nowe badania: tylko ostatnie 12 miesięcy, kategorie, zapis i statusy. */
  const nb = makeCtx();
  nb.ctx.ResearchAcademy.setData(JSON.parse(JSON.stringify({ ...BASE, recent: { hiit: ['301'], hipertrofia: ['101', '102'] } })));
  const recent = nb.ctx.ResearchAcademy.recentStudies(nb.ctx.ResearchAcademy.state.data, 'all', new Date('2026-10-19'));
  ok('nowe badania: bez publikacji starszych niż 12 miesięcy', recent.every((st) => Number(st.year) >= 2025) && recent.map((st) => st.pmid).includes('301') && !recent.map((st) => st.pmid).includes('102'));
  nb.ctx.academySetLevel('research');
  nb.ctx.academyResearchSub('new');
  ok('nowe badania: panel z kategoriami', nb.screen.innerHTML.includes('ostatnich 12 miesięcy') && nb.screen.innerHTML.includes('HIIT i Tabata'));
  nb.ctx._db = {};
  const nbSaved = [];
  nb.ctx.persistById = async (c, o) => { nbSaved.push(JSON.parse(JSON.stringify(o))); return { ...o }; };
  await nb.ctx.academyResearchSave('301');
  ok('nowe badania: zapis do „Do przeczytania”', nbSaved.length === 1 && nbSaved[0].researchStatus === 'do_przeczytania');
  ok('nowe badania: po zapisie statusy przy karcie', ['Przeczytane', 'Do sprawdzenia', 'Wykorzystane w Academy'].every((x) => nb.screen.innerHTML.includes(x)));
  const savedId = nb.ctx.KB[0].id;
  await nb.ctx.academyResearchSetStatus(savedId, 'wykorzystane');
  ok('status: „wykorzystane w Academy” zapisany', nbSaved[1] && nbSaved[1].researchStatus === 'wykorzystane' && nb.ctx.KB[0].researchStatus === 'wykorzystane');
  await nb.ctx.academyResearchSetStatus(savedId, '<script>');
  ok('status: nieznana wartość → do przeczytania', nbSaved[2].researchStatus === 'do_przeczytania');
  nb.ctx.academyResearchEdit(savedId);
  nb.inputs['research-note-' + savedId] = { value: 'Sprawdzić protokół <b>HIIT</b>' };
  nb.inputs['research-concl-' + savedId] = { value: 'Najpierw baza tlenowa.' };
  await nb.ctx.academyResearchSaveNote({ preventDefault() {} }, savedId);
  ok('notatka i własny wniosek zapisane', nbSaved[3].trainerNote.includes('Sprawdzić') && nbSaved[3].trainerConclusion === 'Najpierw baza tlenowa.');
  ok('notatka escapowana w widoku', nb.screen.innerHTML.includes('&lt;b&gt;HIIT') && !nb.screen.innerHTML.includes('<b>HIIT'));

  /* 9b. Zapisane źródła: książki, notatki, badania, wnioski; tagi, data, wiarygodność. */
  nb.ctx.KB.push({ id: 'kb_b1', academyBook: true, kind: 'note', title: 'Zaplanuj swój trening', bookAuthor: 'Głuchowski', text: 'Moje notatki', createdAt: '2026-10-01T10:00:00Z', sourceUrl: 'javascript:alert(1)' });
  nb.ctx.KB.push({ id: 'kb_n1', kind: 'note', title: 'Moja zasada rozgrzewki', text: 'Zawsze 10 minut', tags: ['rozgrzewka'], createdAt: '2026-10-05T10:00:00Z' });
  nb.ctx.academyResearchSub('saved');
  const sv = nb.screen.innerHTML;
  ok('zapisane: książka, notatka i badanie na liście', sv.includes('Zaplanuj swój trening') && sv.includes('Moja zasada rozgrzewki') && sv.includes('HIIT u dorosłych'));
  ok('zapisane: data dodania i status wiarygodności', sv.includes('dodano') && sv.includes('Mocne dowody') && sv.includes('Własna notatka — niezweryfikowana') && sv.includes('Książka — sprawdź'));
  ok('zapisane: tag kategorii', sv.includes('HIIT i Tabata') && sv.includes('rozgrzewka'));
  ok('zapisane: link javascript: nie jest renderowany', !sv.includes('javascript:'));
  nb.ctx.academyResearchSavedFilter('type', 'wniosek');
  ok('zapisane: filtr „Moje wnioski”', nb.screen.innerHTML.includes('Najpierw baza tlenowa') && !nb.screen.innerHTML.includes('Moja zasada rozgrzewki'));
  nb.ctx.academyResearchSavedFilter('type', 'ksiazka');
  ok('zapisane: filtr książek', nb.screen.innerHTML.includes('Zaplanuj swój trening') && !nb.screen.innerHTML.includes('HIIT u dorosłych'));
  nb.ctx.academyResearchSavedFilter('type', 'all');
  nb.ctx.academyResearchSavedFilter('status', 'do_przeczytania');
  ok('zapisane: filtr statusu', nb.screen.innerHTML.includes('HIIT u dorosłych') && !nb.screen.innerHTML.includes('Zaplanuj swój trening'));

  /* 9c. Odpowiedź AI dla pytania spoza opracowanych: tylko źródła z kart, cache, błędy. */
  let aiCalls = 0;
  let lastBody = null;
  const aiReply = (payload, status) => async (url, init) => {
    if (String(url).includes('research-base.json')) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(BASE)) };
    aiCalls++; lastBody = JSON.parse(init.body);
    return { ok: status === 200, status, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }) };
  };
  const goodAi = { krotko: 'Zacznij od spokojnego cardio, HIIT później [S1].', dlaczego: 'HIIT i ciągły wysiłek dały podobny efekt [S1]. Wg badania Smitha (2020) [S4] ...', praktyka: ['Sprawdź tolerancję wysiłku i RPE [S1].'], dla_kogo: 'Początkujący z nadwagą [S1].', ostroznie: 'Przy chorobach serca konsultacja [S1].', ksiazka_vs_badania: 'Brak reguły w bazie książek.', pytanie_kontrolne: { pytanie: 'Od czego zacząć?', odpowiedz: 'Od spokojnego cardio [S1].' }, porownanie: {}, pewnosc: 'mocne' };
  const ai = makeCtx(aiReply(goodAi, 200));
  ai.ctx.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };
  ai.ctx.academySetLevel('research');
  await flush(); await flush();
  ai.ctx.academyResearchAsk('Od czego zacząć HIIT z osobą otyłą?');
  ok('AI: przycisk „Opracuj pełną odpowiedź”', ai.screen.innerHTML.includes('Opracuj pełną odpowiedź'));
  await ai.ctx.academyResearchAi();
  ok('AI: odpowiedź z 8 częściami', ai.screen.innerHTML.includes('Odpowiedź opracowana teraz przez AI') && ai.screen.innerHTML.includes('Krótka odpowiedź'));
  ok('AI: zmyślone [S4] usunięte', !ai.screen.innerHTML.includes('S4'));
  ok('AI: prompt bez danych klienta i z kartą', lastBody && lastBody.messages[0].content.includes('[S1]') && !/Anna|Kowalsk/.test(lastBody.messages[0].content));
  ai.ctx.ResearchAcademy._aiMemory.clear();
  ai.ctx.academyResearchAsk('Jak ustawić HIIT dla osoby z otyłością?');
  ai.ctx.academyResearchAsk('Od czego zacząć HIIT z osobą otyłą?');
  const before = aiCalls;
  await ai.ctx.academyResearchAi();
  ok('AI: cache (localStorage) — bez drugiego zapytania', aiCalls === before && ai.screen.innerHTML.includes('Krótka odpowiedź'));
  const noRef = makeCtx(aiReply({ ...goodAi, krotko: 'Tak.', dlaczego: 'Bo tak.', praktyka: ['Rób HIIT.'] }, 200));
  noRef.ctx.academySetLevel('research'); await flush(); await flush();
  noRef.ctx.academyResearchAsk('Od czego zacząć HIIT z osobą otyłą?');
  await noRef.ctx.academyResearchAi();
  ok('AI: odpowiedź bez źródeł nie jest pokazywana', noRef.screen.innerHTML.includes('nie oparło odpowiedzi na źródłach') && !noRef.screen.innerHTML.includes('Krótka odpowiedź'));
  ok('AI: karty działają mimo błędu AI', noRef.screen.innerHTML.includes('research-card'));
  const limit = makeCtx(aiReply(goodAi, 429));
  limit.ctx.academySetLevel('research'); await flush(); await flush();
  limit.ctx.academyResearchAsk('Od czego zacząć HIIT z osobą otyłą?');
  await limit.ctx.academyResearchAi();
  ok('AI: limit 429 → czytelny komunikat', limit.screen.innerHTML.includes('Limit zapytań AI'));

  /* 9d. Samokontrola na żywo: drugi przebieg AI ocenia zdania — „brak” znika, „czesciowo” dostaje etykietę. */
  const checked = { krotko: 'Zacznij od spokojnego cardio [S1].', dlaczego: 'HIIT daje identyczny efekt u wszystkich [S1]. Ciągły wysiłek łatwiej dawkować [S1].', praktyka: ['Kontroluj RPE [S1].'], dla_kogo: 'Początkujący [S1].', ostroznie: 'Choroby serca: lekarz [S1].', pewnosc: 'umiarkowane' };
  const verdicts = { oceny: [{ nr: 1, ocena: 'pokryte' }, { nr: 2, ocena: 'brak' }, { nr: 3, ocena: 'czesciowo' }, { nr: 4, ocena: 'pokryte' }] };
  let verifyBody = null;
  const twoPass = (verifyStatus) => async (url, init) => {
    if (String(url).includes('research-base.json')) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(BASE)) };
    const b = JSON.parse(init.body);
    const isVerify = /Sprawdzasz odpowiedź/.test(b.system);
    if (isVerify) verifyBody = b;
    const st = isVerify ? verifyStatus : 200;
    return { ok: st === 200, status: st, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(isVerify ? verdicts : checked) }] }) };
  };
  const ver = makeCtx(twoPass(200));
  ver.ctx.academySetLevel('research'); await flush(); await flush();
  ver.ctx.academyResearchAsk('Od czego zacząć HIIT z osobą otyłą?');
  await ver.ctx.academyResearchAi();
  const vh = ver.screen.innerHTML;
  ok('kontrola: drugi przebieg dostaje ponumerowane zdania i kartę [S1]', verifyBody && /1\. Zacznij od spokojnego cardio \[S1\]/.test(verifyBody.messages[0].content) && verifyBody.messages[0].content.includes('[S1] '));
  ok('kontrola: zdanie „brak” usunięte', vh.includes('Krótka odpowiedź') && !vh.includes('identyczny efekt'));
  ok('kontrola: zdanie „częściowo” ma etykietę „do sprawdzenia”', /łatwiej dawkować[^<]*<a[^>]*>S1<\/a>\.? ?<span class="research-check"/.test(vh) || (vh.includes('łatwiej dawkować') && vh.includes('class="research-check"')));
  ok('kontrola: notka o wyniku kontroli', vh.includes('Usunięto 1 niepotwierdzone zdanie'));
  const verFail = makeCtx(twoPass(500));
  verFail.ctx.academySetLevel('research'); await flush(); await flush();
  verFail.ctx.academyResearchAsk('Od czego zacząć HIIT z osobą otyłą?');
  await verFail.ctx.academyResearchAi();
  ok('kontrola: błąd drugiego przebiegu → odpowiedź z ostrzeżeniem', verFail.screen.innerHTML.includes('Krótka odpowiedź') && verFail.screen.innerHTML.includes('kontrola zdań nie powiodła się'));

  /* 9e. Sprzeczności książka–badania: tylko z [K#] i [S#], osobna sekcja tylko gdy coś jest. */
  const RAx = ver.ctx.ResearchAnswer;
  const withConflict = RAx.validateAnswer({ ...checked, sprzecznosci: [
    { temat: 'Przerwy na masę', ksiazka: 'Książka: 60–90 s [K1]', badania: 'Dłuższe przerwy dały więcej mięśni [S1]', ocena: 'nowsze_badania' },
    { temat: 'Bez książki', ksiazka: 'coś bez źródła', badania: 'x [S1]', ocena: 'nowsze_badania' },
    { temat: '<img src=x onerror=alert(1)>', ksiazka: 'a [K1]', badania: 'b [S1]', ocena: 'cokolwiek' }
  ] }, ['S1'], ['K1']);
  ok('sprzeczności: wpis bez [K#] odrzucony, zła ocena → nierozstrzygnięte', withConflict.sprzecznosci.length === 2 && withConflict.sprzecznosci[1].ocena === 'nierozstrzygniete');
  withConflict.sources = { S: [Object.keys(BASE.studies)[0]], K: [{ cite: 'Głuchowski, s. 95', status: 'zrodlo' }] };
  const ch = ver.ctx.ResearchAcademy.renderAnswer(withConflict, BASE.studies);
  ok('sprzeczności: sekcja „Książka mówi co innego niż badania”', ch.includes('Książka mówi co innego niż badania') && ch.includes('Przerwy na masę') && ch.includes('Nowsze badania mają mocniejsze dowody'));
  ok('sprzeczności: XSS w temacie zneutralizowany', !ch.includes('<img src=x'));
  const noConflict = RAx.validateAnswer(checked, ['S1'], []);
  noConflict.sources = { S: [Object.keys(BASE.studies)[0]], K: [] };
  ok('sprzeczności: bez sprzeczności sekcji nie ma', !ver.ctx.ResearchAcademy.renderAnswer(noConflict, BASE.studies).includes('research-conflicts'));
  ok('kontrola: zdanie z wnioskiem bez własnego źródła usunięte', RAx.validateAnswer({ ...checked, dlaczego: 'Mechanizm A [S1]. Zawsze rób 40 serii. Źródła tego nie rozstrzygają.' }, ['S1'], []).dlaczego === 'Mechanizm A [S1]. Źródła tego nie rozstrzygają.');

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
