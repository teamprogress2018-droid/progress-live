#!/usr/bin/env node
/** Baza badań (serwer): walidacja kart i odpowiedzi, brak zmyślonych cytowań, błędy API i cache. Offline. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const rb = require('./build_research_base.js');

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL', name); failed++; } else console.log('OK  ', name);
}

const ABSTRACT = 'Twenty-four trained men (n = 24) performed 10 or 20 weekly sets for 8 weeks. Muscle thickness increased 5.2% vs 2.8% (p = 0.03).';

/* 1. Karta: liczby tylko z abstraktu. */
const goodSynth = { tytul_pl: 'Objętość a grubość mięśni', co_zbadano: 'Porównano 10 i 20 serii tygodniowo przez 8 tygodni.', co_znaleziono: 'Grubość mięśnia wzrosła o 5,2% vs 2,8%.', dla_trenera: 'Więcej serii może pomóc wytrenowanym.', czego_nie_dowodzi: 'Nie dotyczy kobiet ani początkujących.', populacja: 'wytrenowani mężczyźni', liczebnosc: 24, uzytecznosc: 'wysoka', pewnosc: 'mocne' };
const s1 = rb.validateSynth(goodSynth, ABSTRACT, 'rct');
ok('synth: poprawna karta przechodzi', s1 && s1.coZnaleziono.includes('5,2%'));
ok('synth: liczebność z abstraktu', s1 && s1.liczebnosc === 24);
ok('synth: RCT nie może mieć „mocnych” dowodów', s1 && s1.pewnosc === 'umiarkowane');
const invented = rb.validateSynth({ ...goodSynth, co_znaleziono: 'Grubość wzrosła o 17% (n=310).' }, ABSTRACT, 'meta');
ok('synth: wynik z liczbą spoza abstraktu jest odrzucany', invented === null);
const badN = rb.validateSynth({ ...goodSynth, liczebnosc: 310 }, ABSTRACT, 'meta');
ok('synth: liczebność spoza abstraktu → null', badN && badN.liczebnosc === null);
ok('synth: śmieci z AI → null', rb.validateSynth('nie wiem', ABSTRACT, 'rct') === null);
ok('synth: metaanaliza może mieć mocne dowody', rb.validateSynth(goodSynth, ABSTRACT, 'meta').pewnosc === 'mocne');

/* 2. Odpowiedź: tylko znane źródła, każda kluczowa część ma źródło. */
const rawAnswer = {
  krotko: 'Nie zawsze; więcej serii pomaga do pewnego progu [S1] [S9].',
  dlaczego: 'Zależność dawka–odpowiedź słabnie przy dużej objętości [S2]. Według Smitha 2019 (DOI 10.9999/fake) ... [K7]',
  praktyka: ['Zacznij od 10 serii tygodniowo [K1].', 'Dokładaj serie przy zastoju [S1].'],
  dla_kogo: 'Dla średnio zaawansowanych [S1].',
  ostroznie: 'Przy złej regeneracji [K1].',
  ksiazka_vs_badania: 'Książka podaje 10–20 serii [K1], badania podobnie [S2].',
  pytanie_kontrolne: { pytanie: 'Czy 40 serii jest lepsze niż 20?', odpowiedz: 'Nie ma na to dowodów [S2].' },
  porownanie: { ksiazka: 'x [K1]', badania: 'y [S1]', wspolne: 'z', roznice: 'w', rekomendacja: 'r [S2]' },
  pewnosc: 'mocne'
};
const ans = rb.validateAnswer(rawAnswer, ['S1', 'S2'], ['K1']);
ok('answer: przechodzi z poprawnymi źródłami', !!ans);
ok('answer: nieznane [S9] i [K7] usunięte', ans && !/S9|K7/.test(JSON.stringify(ans)));
ok('answer: lista użytych źródeł', ans && ans.refs.join(',') === 'K1,S1,S2');
const noRefs = rb.validateAnswer({ ...rawAnswer, krotko: 'Tak.', dlaczego: 'Bo tak.', praktyka: ['Rób więcej.'] }, ['S1'], []);
ok('answer: bez źródeł → odrzucona', noRefs === null);
const onlyFake = rb.validateAnswer({ ...rawAnswer, krotko: 'Tak [S7].', dlaczego: 'Bo [S8].', praktyka: ['Rób [S9].'] }, ['S1'], []);
ok('answer: same zmyślone klucze → odrzucona', onlyFake === null);
const capped = rb.capAnswerCertainty(rb.validateAnswer(rawAnswer, ['S1', 'S2'], ['K1']), { S1: { evidence: 'rct', synth: { pewnosc: 'umiarkowane' } }, S2: { evidence: 'other', synth: null } });
ok('answer: pewność nie wyższa niż najlepsze badanie', capped.pewnosc === 'umiarkowane');

/* 3. Zapytanie PubMed: filtry typów, ludzi, języka; stanowiska osobno. */
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'research_base_queries.json'), 'utf8'));
const term = rb.buildTerm('creatine[tiab]', cfg);
ok('term: typy badań', term.includes('"Meta-Analysis"[pt]') && term.includes('"Randomized Controlled Trial"[pt]'));
ok('term: ludzie bez AND NOT', term.includes(' NOT (animals[mh] NOT humans[mh])') && !term.includes('AND NOT'));
ok('term: stanowiska', rb.buildTerm('creatine[tiab]', cfg, { guidelines: true }).includes('"position stand"[ti]'));
ok('config: 9 kategorii z Academy', cfg.categories.map((c) => c.id).join(',') === 'hipertrofia,sila,cardio,hiit,zywienie,anatomia,funkcjonalny,regeneracja,bezpieczenstwo');
const ids = cfg.categories.flatMap((c) => c.questions.map((q) => q.id));
ok('config: unikalne id pytań', new Set(ids).size === ids.length);
ok('config: przykłady Piotra są w bazie', ['Czy większa objętość zawsze zwiększa hipertrofię?', 'Czy HIIT jest dobry dla początkującego z nadwagą?', 'Jak łączyć cardio z treningiem siłowym?', 'Jakie przerwy stosować przy treningu siłowym?', 'Czy trening do upadku jest konieczny?'].every((q) => cfg.categories.some((c) => c.questions.some((x) => x.q === q))));

/* 4. Ranking: metaanaliza przed RCT, brak abstraktu na końcu. */
const ranked = rb.rankCandidates([
  { pmid: '1', rank: 0, study: { evidence: 'rct', year: '2024', hasAbstract: true } },
  { pmid: '2', rank: 5, study: { evidence: 'meta', year: '2021', hasAbstract: true } },
  { pmid: '3', rank: 1, study: { evidence: 'meta', year: '2023', hasAbstract: false } }
], 2026);
ok('ranking: metaanaliza z abstraktem pierwsza', ranked[0].pmid === '2');
ok('ranking: bez abstraktu za RCT', ranked.map((x) => x.pmid).indexOf('3') > ranked.map((x) => x.pmid).indexOf('1'));

/* 4b. Temat: wynik z innej dziedziny (np. „tapering” leków) odpada. */
const st = { 1: { title: 'Sleep loss and performance' }, 2: { title: 'Guideline for rheumatoid arthritis' }, 3: { title: 'Sleep extension in athletes' }, 4: { title: 'Sleep hygiene' }, 5: { title: 'Caffeine position stand' } };
const topic = rb.onTopic([{ pmid: '1' }, { pmid: '2', guide: true }, { pmid: '3' }, { pmid: '4' }], ['sleep'], st).map((c) => c.pmid);
ok('temat: niepasujące stanowisko odcięte', topic.join(',') === '1,3,4');
const few = rb.onTopic([{ pmid: '1' }, { pmid: '2', guide: true }, { pmid: '5' }], ['sleep'], st).map((c) => c.pmid);
ok('temat: lepiej mniej wyników niż wyniki z innego tematu', few.join(',') === '1');
const clin = rb.onTopic([{ pmid: '1' }, { pmid: '6' }], ['sleep'], { ...st, 6: { title: 'Sleep after stroke rehabilitation' } }, ['stroke']).map((c) => c.pmid);
ok('temat: populacje kliniczne (excludeTitle) odrzucone', clin.join(',') === '1');

/* 5. Pełny przebieg z atrapami: błędy API, wynik bez DOI, cache. */
const XML = (pmid, doi, abs, types) => `<PubmedArticle><MedlineCitation><PMID>${pmid}</PMID><Article><Journal><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue><Title>Sports Medicine</Title><ISOAbbreviation>Sports Med</ISOAbbreviation></Journal><ArticleTitle>Training volume study ${pmid}</ArticleTitle>${abs ? `<Abstract><AbstractText>${abs}</AbstractText></Abstract>` : ''}<AuthorList><Author><LastName>Kowalski</LastName><Initials>J</Initials></Author><Author><LastName>Nowak</LastName><Initials>A</Initials></Author></AuthorList>${doi ? `<ELocationID EIdType="doi">${doi}</ELocationID>` : ''}<PublicationTypeList>${types.map((t) => `<PublicationType>${t}</PublicationType>`).join('')}</PublicationTypeList></Article></MedlineCitation></PubmedArticle>`;
const mini = { ...cfg, categories: [{ ...cfg.categories[0], questions: cfg.categories[0].questions.slice(0, 2) }] };
function fakeClients(log) {
  return {
    async pubmedSearch(term) {
      log.search++;
      if (term.includes('muscle failure')) throw new Error('PubMed HTTP 503');
      if (term.includes('position stand')) return [];
      return term.includes('training volume') ? ['111', '222', '333'] : ['222'];
    },
    async pubmedFetch(ids) {
      log.fetched.push(...ids);
      return ids.map((id) => ({
        111: { pmid: '111', doi: '10.1000/a1', abstract: ABSTRACT, evidence: 'meta', types: ['Meta-Analysis'] },
        222: { pmid: '222', doi: '', abstract: ABSTRACT, evidence: 'rct', types: ['Randomized Controlled Trial'] },
        333: { pmid: '333', doi: '10.1000/fake', abstract: '', evidence: 'sr', types: ['Systematic Review'] }
      }[id])).map((x) => require('./fetch_research_feed.js').parsePubmedXml(XML(x.pmid, x.doi, x.abstract, x.types))[0]);
    },
    async europePmc() { throw new Error('Europe PMC HTTP 503'); },
    async crossref(doi) { log.crossref.push(doi); return doi === '10.1000/fake' ? { ok: false } : { ok: true, journal: 'Sports Med' }; }
  };
}
const fakeAi = (log) => ({
  label: 'test',
  async synth() { log.synth++; return rb.validateSynth(goodSynth, ABSTRACT, 'meta'); },
  async answer(prompt, sk, bk) { log.answer++; log.prompt = prompt; return rb.validateAnswer(rawAnswer, sk, bk); }
});
(async () => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rb-')), 'research-base.json');
  const log = { search: 0, fetched: [], crossref: [], synth: 0, answer: 0 };
  const books = () => [{ cite: 'Głuchowski, Zaplanuj swój trening, s. 95', status: 'zrodlo', text: '10–20 serii', ref: 'g 1' }];
  const base = await rb.main({ env: {}, cfg: mini, basePath: tmp, clients: fakeClients(log), ai: fakeAi(log), books, now: new Date('2026-10-19T00:00:00Z') });
  const q1 = base.questions.find((q) => q.id === 'h-objetosc');
  ok('flow: pytanie ma wybrane badania', q1 && q1.studyIds.length === 3);
  ok('flow: błąd PubMed jednego pytania nie zatrzymuje bazy', base.sources.pubmed === 'czesciowo' && base.questions.length === 1);
  ok('flow: Europe PMC niedostępne → baza i tak zapisana', base.sources.europepmc === 'niedostepne' && fs.existsSync(tmp));
  ok('flow: wynik bez DOI zostaje (tylko PubMed)', base.studies['222'] && base.studies['222'].doi === '');
  ok('flow: nieistniejący DOI nie jest zweryfikowany', base.studies['333'] && base.studies['333'].doiVerified === false);
  ok('flow: DOI z Crossref zweryfikowany', base.studies['111'].doiVerified === true);
  ok('flow: bez abstraktu nie ma karty AI', base.studies['333'].synth === null && base.studies['333'].hasAbstract === false);
  ok('flow: abstraktów nie zapisujemy', !JSON.stringify(base).includes('Twenty-four trained men'));
  ok('flow: odpowiedź ma źródła z bazy', q1.answer && q1.answer.sources.S.every((id) => base.studies[id]));
  ok('flow: prompt zawiera regułę z książki', /\[K1\] Głuchowski/.test(log.prompt));
  ok('flow: odpowiedź bez zmyślonych kluczy', !/\[S9\]|\[K7\]/.test(JSON.stringify(q1.answer)));

  /* Cache: drugi przebieg nie pobiera ponownie kart ani odpowiedzi. */
  const log2 = { search: 0, fetched: [], crossref: [], synth: 0, answer: 0 };
  const base2 = await rb.main({ env: {}, cfg: mini, basePath: tmp, clients: fakeClients(log2), ai: fakeAi(log2), books, now: new Date('2026-10-26T00:00:00Z') });
  ok('cache: znane badania z kartą nie są pobierane ponownie', !log2.fetched.includes('111') && !log2.fetched.includes('222'));
  ok('cache: bez nowych kart AI', log2.synth === 0);
  ok('cache: odpowiedź nie jest generowana ponownie', log2.answer === 0 && base2.questions[0].answer);

  /* AI niedostępne: baza powstaje z metadanymi, bez kart i odpowiedzi. */
  const tmp2 = tmp.replace('research-base.json', 'b2.json');
  const base3 = await rb.main({ env: {}, cfg: mini, basePath: tmp2, clients: fakeClients({ search: 0, fetched: [], crossref: [] }), ai: null, books, now: new Date('2026-10-19T00:00:00Z') });
  ok('bez AI: metadane są, karty i odpowiedzi nie', Object.keys(base3.studies).length > 0 && Object.values(base3.studies).every((s) => !s.synth) && base3.questions.every((q) => !q.answer) && base3.sources.ai === 'brak');

  /* 6. Plik bazy w repo (jeśli już jest): żadna odpowiedź nie odwołuje się do badania spoza bazy. */
  const real = path.join(__dirname, '..', '..', 'knowledge', 'research-base.json');
  if (fs.existsSync(real)) {
    const b = JSON.parse(fs.readFileSync(real, 'utf8'));
    const bad = (b.questions || []).filter((q) => q.answer && (q.answer.sources.S || []).some((id) => !b.studies[id]));
    ok('research-base.json: źródła odpowiedzi istnieją w bazie', bad.length === 0);
    ok('research-base.json: każdy PMID jest liczbą', Object.keys(b.studies || {}).every((id) => /^\d+$/.test(id) && b.studies[id].pmid === id));
    ok('research-base.json: bez abstraktów', Object.values(b.studies || {}).every((s) => !('abstract' in s)));
  }

  if (failed) { console.error(`\n${failed} test(ów) nie przeszło`); process.exit(1); }
  console.log('\nWszystkie testy bazy badań przeszły.');
})().catch((e) => { console.error(e); process.exit(1); });
