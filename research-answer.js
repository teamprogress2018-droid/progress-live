/* Progress Academy — odpowiedź z bazy badań: wspólna walidacja dla serwera (build_research_base.js)
 * i przeglądarki (research-academy.js). Odpowiedź może cytować tylko przekazane źródła [S1]…/[K1]…;
 * nieznane klucze są usuwane, zdania z wnioskiem bez źródła wypadają, a odpowiedź bez źródeł
 * w kluczowych częściach jest odrzucana. Drugi przebieg AI (VERIFY_SYSTEM) sprawdza każde zdanie
 * z kartami: „brak” usuwa zdanie, „częściowo” dopisuje znacznik [?] („do sprawdzenia”). */
(function(root, factory){
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResearchAnswer = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
'use strict';
const CERTAINTY = ['brak', 'wstepne', 'umiarkowane', 'mocne'];
/** Najwyższy poziom pewności, jaki może dostać dany typ badania (AI może go tylko obniżyć). */
const CERTAINTY_CAP = { guideline: 'mocne', meta: 'mocne', sr: 'mocne', rct: 'umiarkowane', review: 'wstepne', other: 'wstepne' };
function capCertainty(evidence, level) {
  const cap = CERTAINTY_CAP[evidence] || 'wstepne';
  const want = CERTAINTY.includes(level) ? level : 'brak';
  return CERTAINTY.indexOf(want) > CERTAINTY.indexOf(cap) ? cap : want;
}
function parseJsonObject(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(clean.slice(start, end + 1)); } catch (e) { return null; }
}
const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 700);
const asciiKey = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim();

const REF_RE = /\[(S\d+|K\d+)\]/g;
/** Usuwa odwołania do źródeł spoza listy. Zwraca tekst i użyte klucze. */
function keepKnownRefs(text, known) {
  const used = new Set();
  const out = String(text || '').replace(REF_RE, (m, k) => {
    if (known.has(k)) { used.add(k); return m; }
    return '';
  }).replace(/\s+([.,;])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return { text: out, used };
}
/** Podział na zdania; klucze źródeł stojące po kropce zostają przy swoim zdaniu. */
const SENTENCE_SPLIT = /(?<=[.!?](?:\s*\[(?:S|K)\d+\])*)\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„„"(])/u;
/* Skróty („np. Smith”, „wg ACSM”, „s. 95”) nie kończą zdania. */
const ABBREV = /(^|[^\p{L}])(np|ok|tzw|tj|wg|ang|tab|ryc|ew|dr|prof|al|vs|min|maks|max|nr|m\.in|s|r|n)\./giu;
function splitSentences(text) {
  return String(text || '').replace(ABBREV, '$1$2\u0001').split(SENTENCE_SPLIT)
    .map((x) => x.replace(/\u0001/g, '.').trim()).filter(Boolean);
}
const hasRef = (t) => /\[(S|K)\d+\]/.test(t);
/** Zdania bez źródła wolno zostawić tylko, gdy niczego nie twierdzą (niepewność, odesłanie do specjalisty). */
const HEDGE_RE = /nie rozstrzyga|nie opisuj|brak (reguły|danych|badań|dowodów)|za mało (danych|badań)|skonsultuj|lekarz|fizjoterapeut/i;
/** Każde zdanie z wnioskiem musi mieć własne źródło — pozostałe są usuwane. */
function keepReferencedSentences(text) {
  const all = splitSentences(text);
  const kept = all.filter((x) => hasRef(x) || HEDGE_RE.test(x));
  return { text: kept.join(' '), dropped: all.length - kept.length };
}
const CONFLICT_RATING = ['nowsze_badania', 'zalezy_od_kontekstu', 'nierozstrzygniete'];
/** Sprzeczność książka–badania liczy się tylko, gdy strona książki cytuje [K#], a strona badań [S#]. */
function validateConflicts(list, clean) {
  return (Array.isArray(list) ? list : []).map((c) => {
    if (!c || typeof c !== 'object') return null;
    const x = { temat: str(c.temat, 120), ksiazka: clean(c.ksiazka, 500), badania: clean(c.badania, 500), ocena: asciiKey(c.ocena).replace(/\s+/g, '_') };
    if (!CONFLICT_RATING.includes(x.ocena)) x.ocena = 'nierozstrzygniete';
    return x.temat && /\[K\d+\]/.test(x.ksiazka) && /\[S\d+\]/.test(x.badania) ? x : null;
  }).filter(Boolean).slice(0, 4);
}

/**
 * Odpowiedź Academy (8 części + porównanie źródeł). Każde zdanie opiera się na kluczach S1…/K1…
 * z przekazanej listy; nieznane klucze są usuwane, a odpowiedź bez źródła w częściach
 * „krótko”, „dlaczego” i „praktyka” jest odrzucana.
 */
function validateAnswer(raw, studyKeys, bookKeys) {
  const o = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  if (!o || typeof o !== 'object') return null;
  const known = new Set([...(studyKeys || []), ...(bookKeys || [])]);
  const used = new Set();
  const clean = (v, max) => {
    const r = keepKnownRefs(str(v, max || 900), known);
    r.used.forEach((k) => used.add(k));
    return r.text;
  };
  let dropped = 0;
  const claims = (v, max) => { const r = keepReferencedSentences(clean(v, max)); dropped += r.dropped; return r.text; };
  const practice = (Array.isArray(o.praktyka) ? o.praktyka : [o.praktyka]).map((x) => claims(x, 400)).filter(Boolean).slice(0, 6);
  const quiz = o.pytanie_kontrolne && typeof o.pytanie_kontrolne === 'object' ? o.pytanie_kontrolne : {};
  const cmp = o.porownanie && typeof o.porownanie === 'object' ? o.porownanie : {};
  const a = {
    krotko: claims(o.krotko, 500),
    dlaczego: claims(o.dlaczego),
    praktyka: practice,
    dlaKogo: clean(o.dla_kogo, 600),
    ostroznie: clean(o.ostroznie, 700),
    ksiazkaVsBadania: clean(o.ksiazka_vs_badania, 700),
    pytanie: { q: str(quiz.pytanie, 300), a: clean(quiz.odpowiedz, 500) },
    porownanie: {
      ksiazka: clean(cmp.ksiazka, 700),
      badania: clean(cmp.badania, 700),
      wspolne: clean(cmp.wspolne, 600),
      roznice: clean(cmp.roznice, 600),
      rekomendacja: clean(cmp.rekomendacja, 600)
    },
    sprzecznosci: validateConflicts(o.sprzecznosci, clean),
    pewnosc: CERTAINTY.includes(asciiKey(o.pewnosc)) ? asciiKey(o.pewnosc) : 'brak'
  };
  a.bezZrodla = dropped;
  if (!a.krotko || !a.dlaczego || !practice.length) return null;
  if (!hasRef(a.krotko + a.dlaczego) || !practice.some(hasRef)) return null;
  if (!a.pytanie.q) a.pytanie = null;
  a.refs = Array.from(used).sort();
  return a;
}

/** Odpowiedź nie może deklarować większej pewności niż najlepsze cytowane badanie. */
function capAnswerCertainty(answer, studiesByKey) {
  if (!answer) return answer;
  const best = answer.refs.filter((k) => k[0] === 'S').map((k) => studiesByKey[k]).filter(Boolean)
    .map((s) => (s.synth && s.synth.pewnosc) || capCertainty(s.evidence, 'wstepne'))
    .reduce((m, c) => (CERTAINTY.indexOf(c) > CERTAINTY.indexOf(m) ? c : m), 'brak');
  if (CERTAINTY.indexOf(answer.pewnosc) > CERTAINTY.indexOf(best)) answer.pewnosc = best;
  return answer;
}

const ANSWER_SYSTEM = `Jesteś Progress Academy – edukujesz trenera personalnego. Odpowiadasz po polsku, spokojnie, konkretnie, bez pseudonauki i bez obietnic efektów.
Dostajesz pytanie, karty badań [S1]…[S5] (opracowane z abstraktów) i reguły z książek trenera [K1]…
Zasady:
- Opieraj się WYŁĄCZNIE na tych kartach i regułach. Po każdym zdaniu z wnioskiem dopisz klucz źródła w nawiasie kwadratowym, np. [S2] albo [K1]. Nie wymyślaj badań, autorów, liczb ani DOI.
- Jeśli źródła się różnią albo są słabe, powiedz to wprost. Jeśli czegoś w źródłach nie ma, napisz „źródła tego nie rozstrzygają”.
- Trener nie diagnozuje i nie leczy: przy bólu, chorobie, ciąży lub lekach wskaż konsultację z lekarzem lub fizjoterapeutą.
- Gdy nie ma reguł z książek, w polach o książkach napisz „Brak reguły w bazie książek”.
- „sprzecznosci” wypełnij tylko wtedy, gdy reguła z książki [K#] mówi co innego niż karta badania [S#]; w przeciwnym razie zostaw pustą listę. Ocena: nowsze_badania (badania są nowsze i mocniejsze), zalezy_od_kontekstu (obie strony mają rację w innych warunkach), nierozstrzygniete.
Odpowiadasz WYŁĄCZNIE obiektem JSON:
{"krotko":"1–2 zdania",
"dlaczego":"2–4 zdania o mechanizmie i dowodach",
"praktyka":["2–5 konkretnych kroków z klientem"],
"dla_kogo":"dla kogo to ma sens",
"ostroznie":"kiedy nie stosować lub zachować ostrożność",
"ksiazka_vs_badania":"czym wiedza z książek różni się od nowszych badań (lub że są zgodne)",
"pytanie_kontrolne":{"pytanie":"pytanie sprawdzające zrozumienie","odpowiedz":"krótka poprawna odpowiedź"},
"porownanie":{"ksiazka":"co mówią książki/notatki","badania":"co mówią badania","wspolne":"wspólny wniosek","roznice":"różnice lub niepewność","rekomendacja":"praktyczna rekomendacja dla trenera"},
"sprzecznosci":[{"temat":"krótko czego dotyczy","ksiazka":"co mówi książka [K#]","badania":"co mówią badania [S#]","ocena":"nowsze_badania|zalezy_od_kontekstu|nierozstrzygniete"}],
"pewnosc":"mocne|umiarkowane|wstepne|brak"}`;

function studyForPrompt(key, s) {
  const syn = s.synth || {};
  return [
    '[' + key + '] ' + (syn.titlePl || s.title) + ' — ' + [s.authors, s.year, s.journalAbbr || s.journal, s.evidenceLabel].filter(Boolean).join(', '),
    syn.populacja ? 'Populacja: ' + syn.populacja + (syn.liczebnosc ? ' (n=' + syn.liczebnosc + ')' : '') : '',
    syn.coZbadano ? 'Co zbadano: ' + syn.coZbadano : '',
    syn.coZnaleziono ? 'Co znaleziono: ' + syn.coZnaleziono : '',
    syn.czegoNieDowodzi ? 'Ograniczenia: ' + syn.czegoNieDowodzi : '',
    'Pewność: ' + (syn.pewnosc || 'brak')
  ].filter(Boolean).join('\n');
}

/** Prompt odpowiedzi: pytanie, karty badań [S…] i reguły z książek [K…]. Bez danych klientów. */
function buildAnswerPrompt(question, hint, studies, books) {
  return 'PYTANIE TRENERA: ' + question + (hint ? '\nDODATKOWE WYMAGANIA: ' + hint : '')
    + '\n\nKARTY BADAŃ:\n' + studies.map((s, i) => studyForPrompt('S' + (i + 1), s)).join('\n\n')
    + '\n\nREGUŁY Z KSIĄŻEK TRENERA:\n' + (books.length ? books.map((b, i) => '[K' + (i + 1) + '] ' + b.cite + ': ' + str(b.text, 500)).join('\n') : 'brak');
}

const VERIFY_SYSTEM = `Sprawdzasz odpowiedź Academy dla trenera personalnego. Dostajesz ponumerowane zdania i źródła [S#]/[K#], na które się powołują.
Dla każdego zdania oceń, czy jego treść wynika z przytoczonych źródeł:
- "pokryte": źródło mówi to samo (wolno parafrazować),
- "czesciowo": źródło mówi coś podobnego, ale zdanie uogólnia, dodaje liczbę, grupę lub warunek, których w źródle nie ma,
- "brak": źródło tego nie mówi albo mówi coś innego.
Oceniaj surowo i tylko na podstawie podanych źródeł. Odpowiadasz WYŁĄCZNIE obiektem JSON:
{"oceny":[{"nr":1,"ocena":"pokryte|czesciowo|brak"}]}`;
const VERIFY_PARTS = ['krotko', 'dlaczego', 'praktyka'];
/** Zdania do sprawdzenia: kolejno z części „krótko”, „dlaczego” i każdego kroku „praktyki”. */
function answerSentences(a) {
  const out = [];
  VERIFY_PARTS.forEach((part) => {
    const texts = part === 'praktyka' ? (a.praktyka || []) : [a[part]];
    texts.forEach((t, item) => splitSentences(t).forEach((sentence) => out.push({ part, item, sentence })));
  });
  return out;
}
/** Prompt kontroli: zdania + pełna treść kart i reguł, na które się powołują. */
function buildVerifyPrompt(a, studies, books) {
  const items = answerSentences(a);
  const used = new Set(items.flatMap((x) => (x.sentence.match(/\[(S|K)\d+\]/g) || []).map((m) => m.slice(1, -1))));
  const src = studies.map((s, i) => ['S' + (i + 1), s]).filter(([k]) => used.has(k)).map(([k, s]) => studyForPrompt(k, s))
    .concat((books || []).map((b, i) => ['K' + (i + 1), b]).filter(([k]) => used.has(k)).map(([k, b]) => '[' + k + '] ' + b.cite + ': ' + str(b.text, 500)));
  return { items, prompt: 'ZDANIA:\n' + items.map((x, i) => (i + 1) + '. ' + x.sentence).join('\n') + '\n\nŹRÓDŁA:\n' + src.join('\n\n') };
}
/**
 * Wynik kontroli: „brak” usuwa zdanie, „czesciowo” (oraz zdanie bez oceny) dostaje znacznik [?].
 * Gdy po kontroli zabraknie krótkiej odpowiedzi, uzasadnienia albo praktyki — odpowiedź jest odrzucana.
 */
function applyVerification(a, raw, items) {
  const o = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const list = o && Array.isArray(o.oceny) ? o.oceny : null;
  if (!a || !list) return a ? Object.assign(a, { sprawdzone: false }) : a;
  const verdict = {};
  list.forEach((v) => { const n = Number(v && v.nr); if (n >= 1) verdict[n - 1] = asciiKey(v.ocena); });
  const parts = { krotko: [[]], dlaczego: [[]], praktyka: (a.praktyka || []).map(() => []) };
  let removed = 0, partial = 0;
  items.forEach((x, i) => {
    const v = verdict[i];
    if (v === 'brak') { removed++; return; }
    if (v !== 'pokryte') partial++;
    parts[x.part][x.item].push(v === 'pokryte' ? x.sentence : x.sentence + ' [?]');
  });
  a.krotko = parts.krotko[0].join(' ');
  a.dlaczego = parts.dlaczego[0].join(' ');
  a.praktyka = parts.praktyka.map((p) => p.join(' ')).filter(Boolean);
  if (!a.krotko || !a.dlaczego || !a.praktyka.length) return null;
  const { refs, ...rest } = a;
  a.refs = Array.from(new Set((JSON.stringify(rest).match(/\[(S|K)\d+\]/g) || []).map((m) => m.slice(1, -1)))).sort();
  return Object.assign(a, { sprawdzone: true, usunieteZdania: removed, doSprawdzenia: partial });
}

return { CERTAINTY, CERTAINTY_CAP, capCertainty, parseJsonObject, str, asciiKey, keepKnownRefs, validateAnswer, capAnswerCertainty, ANSWER_SYSTEM, studyForPrompt, buildAnswerPrompt, splitSentences, keepReferencedSentences, validateConflicts, VERIFY_SYSTEM, answerSentences, buildVerifyPrompt, applyVerification };
});
