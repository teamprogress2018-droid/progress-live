#!/usr/bin/env node
/**
 * Baza badań Progress Academy — buduje knowledge/research-base.json po stronie serwera (GitHub Actions).
 *
 * Dla każdego pytania z research_base_queries.json:
 *   1. PubMed (E-utilities): metaanalizy, przeglądy systematyczne, RCT oraz stanowiska/wytyczne.
 *   2. Europe PMC: PMCID, czy pełny tekst jest legalnie otwarty (open access), liczba cytowań.
 *   3. Crossref: sprawdza, czy DOI istnieje (link DOI pokazujemy tylko po weryfikacji).
 *   4. AI opracowuje kartę badania WYŁĄCZNIE z abstraktu; liczby spoza abstraktu są odrzucane.
 *   5. AI pisze odpowiedź Academy tylko z kart badań i reguł z książek; odwołania do
 *      nieistniejących źródeł są usuwane, a odpowiedź bez źródeł jest odrzucana.
 * Pełnych tekstów ani abstraktów nie zapisujemy — tylko metadane, identyfikatory i własną syntezę.
 * Plik działa jak cache: badania z gotową kartą i niezmienione odpowiedzi nie są liczone ponownie.
 *
 * ENV (wszystkie opcjonalne):
 *   NCBI_API_KEY, NCBI_EMAIL   limity NCBI (10/s z kluczem, 3/s bez)
 *   CROSSREF_MAILTO            adres do „polite pool” Crossref (domyślnie NCBI_EMAIL)
 *   ANTHROPIC_API_KEY          AI bezpośrednio; bez klucza: proxy aplikacji (AI_PROXY_URL)
 *   ANTHROPIC_MODEL            model kart badań (domyślnie claude-haiku-4-5-20251001)
 *   ANSWER_MODELS              modele odpowiedzi po przecinku, próbowane po kolei
 *   AI_MAX                     limit nowych kart AI w jednym uruchomieniu (domyślnie 400)
 *   ONLY_QUESTIONS             id pytań po przecinku (szybki test)
 *   BASE_PATH                  plik wyjściowy (domyślnie knowledge/research-base.json)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const feed = require('./fetch_research_feed.js');

const ROOT = path.join(__dirname, '..', '..');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const EUROPEPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const CROSSREF = 'https://api.crossref.org/works/';

const EVIDENCE_WEIGHT = { guideline: 6, meta: 6, sr: 5, rct: 3, review: 1, other: 0 };
const CERTAINTY = ['brak', 'wstepne', 'umiarkowane', 'mocne'];
/** Najwyższy poziom pewności, jaki może dostać dany typ badania (AI może go tylko obniżyć). */
const CERTAINTY_CAP = { guideline: 'mocne', meta: 'mocne', sr: 'mocne', rct: 'umiarkowane', review: 'wstepne', other: 'wstepne' };
const USEFULNESS = ['niska', 'srednia', 'wysoka'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => crypto.createHash('sha1').update(String(s || '')).digest('hex').slice(0, 12);

// ─────────────────────────── walidacja (eksportowana do testów) ───────────────────────────

/** Liczby z tekstu w jednej postaci: „0,5” → „0.5”, „1 200” → „1200”, „12%” → „12”. */
function numbersIn(text) {
  const out = [];
  const re = /\d+(?:[  ]\d{3})*(?:[.,]\d+)?/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[0].replace(/[  ]/g, '').replace(',', '.'));
  return out;
}
/** Czy każda liczba z pola występuje w abstrakcie (lub w tytule / roku). Chroni przed dopisanymi wynikami. */
function numbersGrounded(field, abstract) {
  const allowed = new Set(numbersIn(abstract));
  return numbersIn(field).every((n) => allowed.has(n) || allowed.has(n.replace(/\.0+$/, '')) || (/^\d+$/.test(n) && Number(n) <= 4));
}
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

/**
 * Karta badania z odpowiedzi AI. Pola z liczbami spoza abstraktu są zerowane, a karta bez
 * „co zbadano” i „co znaleziono” jest odrzucana (wtedy aplikacja pokazuje tylko metadane).
 */
function validateSynth(raw, abstract, evidence) {
  const o = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  if (!o || typeof o !== 'object') return null;
  const field = (k, max) => {
    const v = str(o[k], max);
    return v && numbersGrounded(v, abstract) ? v : '';
  };
  const s = {
    titlePl: str(o.tytul_pl, 220),
    coZbadano: field('co_zbadano'),
    coZnaleziono: field('co_znaleziono'),
    dlaTrenera: field('dla_trenera'),
    czegoNieDowodzi: field('czego_nie_dowodzi'),
    populacja: field('populacja', 300),
    liczebnosc: null,
    uzytecznosc: USEFULNESS.includes(asciiKey(o.uzytecznosc)) ? asciiKey(o.uzytecznosc) : 'srednia',
    pewnosc: capCertainty(evidence, asciiKey(o.pewnosc))
  };
  const n = Number(o.liczebnosc);
  if (Number.isInteger(n) && n > 0 && numbersIn(abstract).includes(String(n))) s.liczebnosc = n;
  if (!s.coZbadano || !s.coZnaleziono) return null;
  return s;
}

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
  const hasRef = (t) => /\[(S|K)\d+\]/.test(t);
  const practice = (Array.isArray(o.praktyka) ? o.praktyka : [o.praktyka]).map((x) => clean(x, 400)).filter(Boolean).slice(0, 6);
  const quiz = o.pytanie_kontrolne && typeof o.pytanie_kontrolne === 'object' ? o.pytanie_kontrolne : {};
  const cmp = o.porownanie && typeof o.porownanie === 'object' ? o.porownanie : {};
  const a = {
    krotko: clean(o.krotko, 500),
    dlaczego: clean(o.dlaczego),
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
    pewnosc: CERTAINTY.includes(asciiKey(o.pewnosc)) ? asciiKey(o.pewnosc) : 'brak'
  };
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

function buildTerm(query, cfg, opts) {
  opts = opts || {};
  const types = opts.types || cfg.defaultPublicationTypes;
  const filter = opts.guidelines ? cfg.guidelineFilter : '(' + types.map((t) => '"' + t + '"[pt]').join(' OR ') + ')';
  const humans = String(cfg.humansFilter || '').trim();
  const population = humans ? (/^NOT\s/i.test(humans) ? ' ' : ' AND ') + humans : '';
  return '((' + query + ') AND ' + filter + population + ') AND ' + cfg.languageFilter;
}

/** Ranking kandydatów do pytania: typ dowodu > trafność PubMed > świeżość > cytowania. */
function rankCandidates(cands, nowYear) {
  return cands.map((c) => {
    const s = c.study;
    const age = nowYear - (Number(s.year) || nowYear - 20);
    const score = (EVIDENCE_WEIGHT[s.evidence] || 0) * 10
      + Math.max(0, 15 - c.rank)
      + (age <= 5 ? 4 : age <= 10 ? 2 : 0)
      + Math.min(4, Math.log10(1 + (s.citedBy || 0)) * 1.5)
      + (s.synth ? 1 : 0)
      - (s.hasAbstract ? 0 : 35);
    return { ...c, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Odcina wyniki spoza tematu: publikacja musi mieć w tytule jedno ze słów pytania (titleAny).
 * Gdy takich jest mniej niż 3, dobieramy zwykłe wyniki wyszukiwania, ale nigdy niepasujące stanowiska.
 */
function onTopic(list, titleAny, studies, exclude) {
  const lower = (c) => String(studies[c.pmid].title || '').toLowerCase();
  const ex = (exclude || []).map((w) => String(w).toLowerCase());
  list = list.filter((c) => !ex.some((w) => lower(c).includes(w)));
  if (!Array.isArray(titleAny) || !titleAny.length) return list;
  const hit = (c) => titleAny.some((w) => lower(c).includes(String(w).toLowerCase()));
  const good = list.filter(hit);
  return good.length >= 3 ? good : good.concat(list.filter((c) => !hit(c) && !c.guide));
}

/** Usuwa z bazy badania, których nie używa żadne pytanie ani panel „Nowe badania”. */
function pruneStudies(base) {
  const used = new Set();
  (base.questions || []).forEach((q) => (q.studyIds || []).forEach((id) => used.add(id)));
  Object.values(base.recent || {}).forEach((ids) => (ids || []).forEach((id) => used.add(id)));
  const out = {};
  Object.keys(base.studies || {}).forEach((id) => { if (used.has(id)) out[id] = base.studies[id]; });
  base.studies = out;
  return base;
}

// ─────────────────────────── źródła zewnętrzne ───────────────────────────

function makeClients(env, fetchImpl) {
  const f = fetchImpl || fetch;
  const gap = env.NCBI_API_KEY ? 120 : 400;
  async function getWithRetry(url, init, label) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      let r;
      try { r = await f(url, init); } catch (e) {
        if (attempt === 4) throw new Error(label + ': ' + e.message);
        await sleep(1000 * attempt); continue;
      }
      if (r.ok) return r;
      if (r.status === 404) return r;
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * attempt); continue; }
      throw new Error(label + ' HTTP ' + r.status);
    }
    throw new Error(label + ': limit zapytań lub serwer niedostępny');
  }
  async function ncbi(endpoint, params, method) {
    const p = new URLSearchParams({ ...params, tool: 'progress-live' });
    if (env.NCBI_EMAIL) p.set('email', env.NCBI_EMAIL);
    if (env.NCBI_API_KEY) p.set('api_key', env.NCBI_API_KEY);
    const url = EUTILS + endpoint;
    const r = method === 'POST'
      ? await getWithRetry(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p.toString() }, 'PubMed')
      : await getWithRetry(url + '?' + p.toString(), undefined, 'PubMed');
    await sleep(gap);
    if (!r.ok) throw new Error('PubMed HTTP ' + r.status);
    return r.text();
  }
  async function pubmedSearch(term, extra) {
    const json = JSON.parse(await ncbi('esearch.fcgi', { db: 'pubmed', term, retmode: 'json', sort: 'relevance', retmax: '12', ...(extra || {}) }));
    return (json.esearchresult && json.esearchresult.idlist) || [];
  }
  async function pubmedFetch(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 150) {
      const xml = await ncbi('efetch.fcgi', { db: 'pubmed', id: ids.slice(i, i + 150).join(','), retmode: 'xml', rettype: 'abstract' }, 'POST');
      out.push(...feed.parsePubmedXml(xml));
    }
    return out;
  }
  /** PMID → {pmcid, openAccess, license, citedBy}. Brak odpowiedzi = pusta mapa (karta i tak działa). */
  async function europePmc(pmids) {
    const map = new Map();
    for (let i = 0; i < pmids.length; i += 50) {
      const chunk = pmids.slice(i, i + 50);
      const p = new URLSearchParams({ query: 'SRC:MED AND (' + chunk.map((id) => 'EXT_ID:' + id).join(' OR ') + ')', format: 'json', resultType: 'lite', pageSize: '100' });
      const r = await getWithRetry(EUROPEPMC + '?' + p.toString(), undefined, 'Europe PMC');
      if (!r.ok) continue;
      const data = await r.json();
      ((data.resultList && data.resultList.result) || []).forEach((x) => {
        if (!x || !x.pmid) return;
        map.set(String(x.pmid), {
          pmcid: /^PMC\d+$/.test(String(x.pmcid || '')) ? x.pmcid : '',
          openAccess: x.isOpenAccess === 'Y' && /^PMC\d+$/.test(String(x.pmcid || '')),
          citedBy: Number(x.citedByCount) || 0
        });
      });
      await sleep(200);
    }
    return map;
  }
  /** Czy DOI istnieje w Crossref. null = nie udało się sprawdzić (nie oznacza błędu DOI). */
  async function crossref(doi) {
    const mail = env.CROSSREF_MAILTO || env.NCBI_EMAIL || '';
    const url = CROSSREF + encodeURIComponent(doi) + (mail ? '?mailto=' + encodeURIComponent(mail) : '');
    const r = await getWithRetry(url, { headers: { 'user-agent': 'progress-live research base' + (mail ? ' (mailto:' + mail + ')' : '') } }, 'Crossref');
    await sleep(120);
    if (r.status === 404) return { ok: false };
    if (!r.ok) return null;
    const msg = (await r.json()).message || {};
    const title = Array.isArray(msg['container-title']) ? msg['container-title'][0] : '';
    return { ok: true, journal: str(title, 200), license: Array.isArray(msg.license) && msg.license[0] ? str(msg.license[0].URL, 200) : '' };
  }
  return { pubmedSearch, pubmedFetch, europePmc, crossref };
}

// ─────────────────────────── AI ───────────────────────────

const SYNTH_SYSTEM = `Opracowujesz kartę badania dla trenera personalnego. Dostajesz WYŁĄCZNIE tytuł, typ i abstrakt z PubMed.
Zasady: pisz po polsku, spokojnie i konkretnie, bez obietnic efektów. Używaj tylko informacji z abstraktu. Każda liczba w odpowiedzi musi dosłownie występować w abstrakcie. Jeśli czegoś nie ma w abstrakcie, wpisz pusty tekst lub null.
Odpowiadasz WYŁĄCZNIE obiektem JSON:
{"tytul_pl":"krótki tytuł po polsku",
"co_zbadano":"1–2 zdania: kogo, jaką interwencję z czym porównano, jaki wynik mierzono",
"co_znaleziono":"1–3 zdania: główny wynik, z liczbami z abstraktu",
"dla_trenera":"1–2 zdania: co rozsądnie wynika dla pracy z klientem (lub że wynik niczego nie zmienia)",
"czego_nie_dowodzi":"1–2 zdania: ograniczenia, na kogo nie można przenosić wyniku, czego badanie nie sprawdzało",
"populacja":"np. wytrenowani mężczyźni 18–35 lat; pusty, jeśli brak",
"liczebnosc": liczba uczestników z abstraktu albo null,
"uzytecznosc":"wysoka|srednia|niska",
"pewnosc":"mocne|umiarkowane|wstepne|brak"}
uzytecznosc = przydatność dla trenera pracującego z typowymi klientami siłowni. pewnosc = siła dowodów według abstraktu (pojedyncze RCT co najwyżej „umiarkowane”, małe lub krótkie badania „wstepne”, sprzeczne wyniki „brak”).`;

const ANSWER_SYSTEM = `Jesteś Progress Academy – edukujesz trenera personalnego. Odpowiadasz po polsku, spokojnie, konkretnie, bez pseudonauki i bez obietnic efektów.
Dostajesz pytanie, karty badań [S1]…[S5] (opracowane z abstraktów) i reguły z książek trenera [K1]…
Zasady:
- Opieraj się WYŁĄCZNIE na tych kartach i regułach. Po każdym zdaniu z wnioskiem dopisz klucz źródła w nawiasie kwadratowym, np. [S2] albo [K1]. Nie wymyślaj badań, autorów, liczb ani DOI.
- Jeśli źródła się różnią albo są słabe, powiedz to wprost. Jeśli czegoś w źródłach nie ma, napisz „źródła tego nie rozstrzygają”.
- Trener nie diagnozuje i nie leczy: przy bólu, chorobie, ciąży lub lekach wskaż konsultację z lekarzem lub fizjoterapeutą.
- Gdy nie ma reguł z książek, w polach o książkach napisz „Brak reguły w bazie książek”.
Odpowiadasz WYŁĄCZNIE obiektem JSON:
{"krotko":"1–2 zdania",
"dlaczego":"2–4 zdania o mechanizmie i dowodach",
"praktyka":["2–5 konkretnych kroków z klientem"],
"dla_kogo":"dla kogo to ma sens",
"ostroznie":"kiedy nie stosować lub zachować ostrożność",
"ksiazka_vs_badania":"czym wiedza z książek różni się od nowszych badań (lub że są zgodne)",
"pytanie_kontrolne":{"pytanie":"pytanie sprawdzające zrozumienie","odpowiedz":"krótka poprawna odpowiedź"},
"porownanie":{"ksiazka":"co mówią książki/notatki","badania":"co mówią badania","wspolne":"wspólny wniosek","roznice":"różnice lub niepewność","rekomendacja":"praktyczna rekomendacja dla trenera"},
"pewnosc":"mocne|umiarkowane|wstepne|brak"}`;

function aiClient(env, fetchImpl) {
  const f = fetchImpl || fetch;
  const conn = feed.aiConnection(env);
  if (!conn) return null;
  async function call(model, system, user, maxTokens) {
    const r = await f(conn.url, { method: 'POST', headers: conn.headers, body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }) });
    if (!r.ok) {
      const err = new Error(conn.label + ' HTTP ' + r.status + ' (' + model + '): ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 160));
      err.status = r.status;
      throw err;
    }
    const data = await r.json();
    return (data.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('');
  }
  /* Proxy aplikacji może przepuszczać tylko wybrane modele — przy 400/403/404 próbujemy następnego. */
  const list = (v, d) => String(v || d).split(',').map((x) => x.trim()).filter(Boolean);
  const studyModels = list(env.ANTHROPIC_MODEL, 'claude-haiku-4-5-20251001,claude-sonnet-4-20250514');
  const answerModels = list(env.ANSWER_MODELS, 'claude-sonnet-4-5-20250929,claude-sonnet-4-20250514,claude-haiku-4-5-20251001');
  let studyModel = null;
  let answerModel = null;
  async function withModels(models, pinned, run) {
    let lastErr = null;
    for (const model of pinned ? [pinned] : models) {
      try { return { model, value: await run(model) }; } catch (e) {
        lastErr = e;
        if (!pinned && (e.status === 400 || e.status === 403 || e.status === 404)) continue;
        throw e;
      }
    }
    throw lastErr || new Error('brak modelu');
  }
  return {
    label: conn.label,
    async synth(study, abstract) {
      const user = 'TYTUŁ: ' + study.title + '\nTYP: ' + study.evidenceLabel + '\nCZASOPISMO: ' + study.journal + ' ' + study.year + '\n\nABSTRAKT:\n' + String(abstract || '').slice(0, 7000);
      const r = await withModels(studyModels, studyModel, async (model) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const s = validateSynth(await call(model, SYNTH_SYSTEM, user, 900), abstract, study.evidence);
          if (s) return s;
        }
        return null;
      });
      studyModel = r.model;
      return r.value;
    },
    async answer(prompt, studyKeys, bookKeys) {
      const r = await withModels(answerModels, answerModel, async (model) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const a = validateAnswer(await call(model, ANSWER_SYSTEM, prompt, 2600), studyKeys, bookKeys);
          if (a) { a.model = model; return a; }
        }
        return null;
      });
      answerModel = r.model;
      return r.value;
    }
  };
}

// ─────────────────────────── książki ───────────────────────────

function loadBooks() {
  try {
    const ctx = { console, window: {} };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'books-kb.js'), 'utf8'), ctx);
    ctx.booksKbSetData(JSON.parse(fs.readFileSync(path.join(ROOT, 'knowledge/books-index.json'), 'utf8')));
    return (query, category) => ctx.booksKbSelect({ mode: category === 'zywienie' ? 'nutrition' : 'training', query, maxChars: 2600, perBook: 2 }) || [];
  } catch (e) {
    console.warn('Książki niedostępne: ' + e.message);
    return () => [];
  }
}

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

// ─────────────────────────── main ───────────────────────────

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item); }
  });
  await Promise.all(workers);
}

async function main(opts) {
  opts = opts || {};
  const env = opts.env || process.env;
  const clients = opts.clients || makeClients(env, opts.fetch);
  const ai = opts.ai !== undefined ? opts.ai : aiClient(env, opts.fetch);
  const cfg = opts.cfg || JSON.parse(fs.readFileSync(path.join(__dirname, 'research_base_queries.json'), 'utf8'));
  const basePath = opts.basePath || path.join(ROOT, env.BASE_PATH || 'knowledge/research-base.json');
  const selectBooks = opts.books || loadBooks();
  const now = opts.now || new Date();
  const nowYear = now.getUTCFullYear();
  const only = String(env.ONLY_QUESTIONS || '').split(',').map((x) => x.trim()).filter(Boolean);

  let old = { studies: {}, questions: [], recent: {} };
  if (fs.existsSync(basePath)) {
    try { old = JSON.parse(fs.readFileSync(basePath, 'utf8')); } catch (e) { console.warn('Uszkodzona baza — zaczynam od zera'); }
  }
  const studies = { ...(old.studies || {}) };
  const oldQuestions = new Map((old.questions || []).map((q) => [q.id, q]));
  const status = { pubmed: 'ok', europepmc: 'ok', crossref: 'ok', ai: ai ? 'ok' : 'brak' };
  const errors = [];
  const dateFilter = ' AND ("' + (nowYear - (cfg.yearsBack || 16)) + '"[dp] : "3000"[dp])';

  // 1) Wyszukiwanie — kandydaci na pytanie i najnowsze publikacje w kategorii.
  const candidates = new Map(); // questionId → [{pmid, rank}]
  const recentCands = {};
  const categoriesOf = new Map();
  const tagCat = (pmid, cat) => { if (!categoriesOf.has(pmid)) categoriesOf.set(pmid, new Set()); categoriesOf.get(pmid).add(cat); };
  for (const cat of cfg.categories) {
    for (const q of cat.questions) {
      if (only.length && !only.includes(q.id)) continue;
      try {
        const main = await clients.pubmedSearch(buildTerm(q.query, cfg) + dateFilter);
        const guide = await clients.pubmedSearch(buildTerm(q.query, cfg, { guidelines: true }) + dateFilter, { retmax: '4' });
        const list = [];
        main.forEach((pmid, i) => list.push({ pmid, rank: i }));
        guide.forEach((pmid, i) => { if (!main.includes(pmid)) list.push({ pmid, rank: i + 2, guide: true }); });
        list.forEach((c) => tagCat(c.pmid, cat.id));
        candidates.set(q.id, list);
        console.log(`[${q.id}] ${list.length} kandydatów`);
      } catch (e) {
        status.pubmed = 'czesciowo';
        errors.push(q.id + ': ' + e.message);
        console.warn(`[${q.id}] ${e.message} — zostawiam poprzednie wyniki`);
      }
    }
    if (only.length) continue;
    try {
      const ids = await clients.pubmedSearch(buildTerm(cat.recentQuery, cfg), { retmax: '40', datetype: 'pdat', reldate: '365' });
      ids.forEach((pmid) => tagCat(pmid, cat.id));
      recentCands[cat.id] = ids.map((pmid, i) => ({ pmid, rank: i }));
    } catch (e) {
      status.pubmed = 'czesciowo';
      errors.push('nowe/' + cat.id + ': ' + e.message);
    }
  }

  // 2) Szczegóły nowych publikacji (znane mają już metadane i kartę).
  const allIds = new Set();
  candidates.forEach((l) => l.forEach((c) => allIds.add(c.pmid)));
  Object.values(recentCands).forEach((l) => l.forEach((c) => allIds.add(c.pmid)));
  const toFetch = Array.from(allIds).filter((id) => !studies[id] || (!studies[id].synth && studies[id].hasAbstract));
  const abstracts = new Map();
  if (toFetch.length) {
    try {
      const fetched = await clients.pubmedFetch(toFetch);
      fetched.filter((a) => !feed.isLikelyNonHumanStudy(a)).forEach((a) => {
        abstracts.set(a.pmid, a.abstract);
        const prev = studies[a.pmid] || {};
        const authorList = a.authorList || [];
        studies[a.pmid] = {
          pmid: a.pmid,
          doi: /^10\.\d{4,9}\/\S+$/.test(a.doi) ? a.doi : '',
          doiVerified: prev.doi === a.doi ? !!prev.doiVerified : false,
          pmcid: prev.pmcid || '',
          openAccess: !!prev.openAccess,
          citedBy: prev.citedBy || 0,
          title: a.title,
          journal: a.journal,
          journalAbbr: a.journalAbbr,
          year: a.year,
          authors: authorList.length ? authorList.slice(0, 3).join(', ') + (a.authorCount > 3 ? ' i in.' : '') : a.authors,
          authorCount: a.authorCount,
          pubTypes: a.pubTypes,
          evidence: a.evidence,
          evidenceLabel: a.evidenceLabel,
          hasAbstract: !!a.abstract,
          abstractHash: a.abstract ? hash(a.abstract) : '',
          categories: prev.categories || [],
          synth: prev.abstractHash === hash(a.abstract) ? prev.synth || null : null,
          synthAt: prev.abstractHash === hash(a.abstract) ? prev.synthAt || null : null
        };
      });
    } catch (e) {
      status.pubmed = 'czesciowo';
      errors.push('efetch: ' + e.message);
    }
  }
  categoriesOf.forEach((cats, pmid) => {
    if (studies[pmid]) studies[pmid].categories = Array.from(new Set([...(studies[pmid].categories || []), ...cats]));
  });

  // 3) Europe PMC i Crossref dla nowych pozycji.
  const fresh = toFetch.filter((id) => studies[id]);
  if (fresh.length) {
    try {
      const epmc = await clients.europePmc(fresh);
      epmc.forEach((v, pmid) => { if (studies[pmid]) Object.assign(studies[pmid], v); });
    } catch (e) { status.europepmc = 'niedostepne'; errors.push('Europe PMC: ' + e.message); }
    for (const id of fresh) {
      const s = studies[id];
      if (!s.doi || s.doiVerified) continue;
      try {
        const cr = await clients.crossref(s.doi);
        if (cr === null) continue;
        s.doiVerified = !!cr.ok;
        if (!cr.ok) console.warn(`DOI ${s.doi} (PMID ${id}) nie istnieje w Crossref — link DOI ukryty`);
        if (cr.ok && !s.journal && cr.journal) s.journal = cr.journal;
      } catch (e) { status.crossref = 'czesciowo'; }
    }
  }

  // 4) Karty badań (AI z abstraktu), tylko dla wybranych do pytań i panelu „Nowe badania”.
  const questions = [];
  const recent = {};
  for (const cat of cfg.categories) {
    for (const q of cat.questions) {
      const prev = oldQuestions.get(q.id) || {};
      const list = candidates.get(q.id);
      if (!list) { if (prev.id) questions.push({ ...prev, q: q.q, category: cat.id, hint: q.hint || '' }); continue; }
      const ranked = rankCandidates(onTopic(list.filter((c) => studies[c.pmid]), q.titleAny, studies, cfg.excludeTitle).map((c) => ({ ...c, study: studies[c.pmid] })), nowYear);
      questions.push({ id: q.id, category: cat.id, q: q.q, hint: q.hint || '', studyIds: ranked.slice(0, cfg.perQuestion || 5).map((c) => c.pmid), answer: prev.answer || null, answerKey: prev.answerKey || '', answeredAt: prev.answeredAt || null });
    }
    if (recentCands[cat.id]) {
      const topical = onTopic(recentCands[cat.id].filter((c) => studies[c.pmid]), cat.recentTitleAny, studies, cfg.excludeTitle);
      const ranked = rankCandidates(topical.map((c) => ({ ...c, study: studies[c.pmid] })), nowYear);
      recent[cat.id] = ranked.slice(0, cfg.recentPerCategory || 8).map((c) => c.pmid);
    } else if (old.recent && old.recent[cat.id]) recent[cat.id] = old.recent[cat.id];
  }
  const needed = new Set();
  questions.forEach((q) => (q.studyIds || []).forEach((id) => needed.add(id)));
  Object.values(recent).forEach((ids) => ids.forEach((id) => needed.add(id)));
  if (ai) {
    const todo = Array.from(needed).filter((id) => studies[id] && !studies[id].synth && abstracts.get(id)).slice(0, parseInt(env.AI_MAX || '400', 10));
    let done = 0;
    let stop = false;
    await pool(todo, 3, async (id) => {
      if (stop) return;
      try {
        const s = await ai.synth(studies[id], abstracts.get(id));
        if (s) { studies[id].synth = s; studies[id].synthAt = now.toISOString(); done++; }
      } catch (e) {
        status.ai = 'czesciowo';
        if (e.status === 401 || e.status === 403) stop = true;
        errors.push('AI karta ' + id + ': ' + e.message);
      }
    });
    console.log(`Karty AI (${ai.label}): ${done}/${todo.length}`);
  }

  // 5) Odpowiedzi Academy — tylko gdy zmienił się zestaw badań, kart lub reguł z książek.
  if (ai) {
    for (const q of questions) {
      if (only.length && !only.includes(q.id)) continue;
      const list = (q.studyIds || []).map((id) => studies[id]).filter((s) => s && s.synth);
      if (!list.length) { q.answer = null; continue; }
      const books = selectBooks(q.q, q.category).slice(0, 4);
      const studyKeys = list.map((_, i) => 'S' + (i + 1));
      const bookKeys = books.map((_, i) => 'K' + (i + 1));
      const key = hash(JSON.stringify([q.q, q.hint, list.map((s) => s.pmid + s.synthAt), books.map((b) => b.ref)]));
      if (q.answer && q.answerKey === key) continue;
      const prompt = 'PYTANIE TRENERA: ' + q.q + (q.hint ? '\nDODATKOWE WYMAGANIA: ' + q.hint : '')
        + '\n\nKARTY BADAŃ:\n' + list.map((s, i) => studyForPrompt(studyKeys[i], s)).join('\n\n')
        + '\n\nREGUŁY Z KSIĄŻEK TRENERA:\n' + (books.length ? books.map((b, i) => '[' + bookKeys[i] + '] ' + b.cite + ': ' + str(b.text, 500)).join('\n') : 'brak');
      try {
        const answer = capAnswerCertainty(await ai.answer(prompt, studyKeys, bookKeys), Object.fromEntries(list.map((s, i) => [studyKeys[i], s])));
        if (answer) {
          answer.sources = { S: list.map((s) => s.pmid), K: books.map((b) => ({ cite: b.cite, status: b.status, text: str(b.text, 400) })) };
          q.answer = answer; q.answerKey = key; q.answeredAt = now.toISOString();
          console.log(`[${q.id}] odpowiedź gotowa (${answer.model})`);
        } else {
          console.warn(`[${q.id}] odpowiedź odrzucona przez walidację źródeł`);
          q.answer = null; q.answerKey = '';
        }
      } catch (e) {
        status.ai = 'czesciowo';
        errors.push('AI odpowiedź ' + q.id + ': ' + e.message);
      }
    }
  }

  const base = pruneStudies({
    version: 1,
    generatedAt: now.toISOString(),
    sources: status,
    note: 'Metadane z PubMed, Europe PMC i Crossref. Karty i odpowiedzi to opracowania abstraktów, nie pełnych tekstów.',
    problems: Array.from(new Set(errors.map((e) => e.replace(/\b\d{6,9}\b/g, '…')))).slice(0, 8),
    categories: cfg.categories.map((c) => ({ id: c.id, label: c.label, keywords: c.keywords })),
    questions,
    recent,
    studies
  });
  fs.mkdirSync(path.dirname(basePath), { recursive: true });
  fs.writeFileSync(basePath, JSON.stringify(base, null, 1) + '\n');
  console.log(`Badania: ${Object.keys(base.studies).length} · pytania z odpowiedzią: ${questions.filter((q) => q.answer).length}/${questions.length}`);
  if (errors.length) console.warn('Problemy (' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
  return base;
}

module.exports = {
  numbersIn, numbersGrounded, capCertainty, validateSynth, validateAnswer, capAnswerCertainty, keepKnownRefs,
  buildTerm, rankCandidates, onTopic, pruneStudies, makeClients, aiClient, main
};

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
