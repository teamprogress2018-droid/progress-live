#!/usr/bin/env node
/**
 * Nowe badania — pobiera świeże publikacje z PubMed (E-utilities) wg kategorii
 * z research_queries.json i dopisuje je do research-feed.json (repo root, GitHub Pages).
 *
 * Bez zależności (Node 20+, globalny fetch). Uruchamiane przez .github/workflows/research-feed.yml.
 *
 * ENV:
 *   LOOKBACK_DAYS      ile dni wstecz (data dodania do PubMed), domyślnie 14
 *   NCBI_API_KEY       opcjonalnie — 10 zapytań/s zamiast 3/s
 *   NCBI_EMAIL         opcjonalnie — NCBI prosi o kontakt przy automatach
 *   ANTHROPIC_API_KEY  opcjonalnie — streszczenie + wniosek po polsku dla nowych pozycji
 *   ANTHROPIC_MODEL    opcjonalnie — domyślnie claude-haiku-4-5-20251001
 *   AI_MAX             ile pozycji streszczać w jednym uruchomieniu (domyślnie 40)
 *   FEED_PATH          ścieżka pliku wyjściowego (domyślnie research-feed.json)
 *   MAX_ITEMS          limit pozycji w pliku (domyślnie 400, najstarsze wypadają)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';

const EVIDENCE_WEIGHT = { guideline: 5, meta: 5, sr: 4, rct: 3, review: 1, other: 0 };
const EVIDENCE_LABEL = {
  guideline: 'Stanowisko / wytyczne', meta: 'Metaanaliza', sr: 'Przegląd systematyczny',
  rct: 'RCT', review: 'Przegląd', other: 'Inne'
};

// ─────────────────────────── helpers ───────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
/** Tekst elementu XML bez znaczników wewnętrznych (<i>, <sup>…). */
function cleanText(xml) {
  return decodeEntities(String(xml || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}
function firstMatch(src, re) {
  const m = re.exec(src);
  return m ? m[1] : '';
}

function classifyEvidence(pubTypes, title) {
  const t = (pubTypes || []).map((x) => String(x).toLowerCase());
  const has = (s) => t.some((x) => x === s);
  if (has('practice guideline') || has('guideline') || has('consensus development conference')) return 'guideline';
  if (/\b(position stand|position statement|consensus statement|expert consensus)\b/i.test(String(title || ''))) return 'guideline';
  if (has('meta-analysis')) return 'meta';
  if (has('systematic review')) return 'sr';
  if (has('randomized controlled trial')) return 'rct';
  if (has('review')) return 'review';
  return 'other';
}

// ─────────────────────────── PubMed XML ───────────────────────────
function parseArticle(block) {
  const citation = firstMatch(block, /<MedlineCitation\b[^>]*>([\s\S]*?)<\/MedlineCitation>/) || block;
  const pmid = firstMatch(citation, /<PMID\b[^>]*>(\d+)<\/PMID>/);
  if (!pmid) return null;

  const title = cleanText(firstMatch(citation, /<ArticleTitle\b[^>]*>([\s\S]*?)<\/ArticleTitle>/));

  const absXml = firstMatch(citation, /<Abstract>([\s\S]*?)<\/Abstract>/);
  const parts = [];
  const absRe = /<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText>/g;
  let m;
  while ((m = absRe.exec(absXml))) {
    const label = firstMatch(m[1], /Label="([^"]*)"/);
    const txt = cleanText(m[2]);
    if (txt) parts.push(label ? label.toUpperCase() + ': ' + txt : txt);
  }
  const abstract = parts.join('\n');

  const journalXml = firstMatch(citation, /<Journal>([\s\S]*?)<\/Journal>/);
  const journal = cleanText(firstMatch(journalXml, /<Title>([\s\S]*?)<\/Title>/));
  const journalAbbr = cleanText(firstMatch(journalXml, /<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/))
    || cleanText(firstMatch(citation, /<MedlineTA>([\s\S]*?)<\/MedlineTA>/));
  const pubDateXml = firstMatch(journalXml, /<PubDate>([\s\S]*?)<\/PubDate>/);
  let year = firstMatch(pubDateXml, /<Year>(\d{4})<\/Year>/) || firstMatch(pubDateXml, /<MedlineDate>(\d{4})/);
  const artDate = firstMatch(citation, /<ArticleDate\b[^>]*>([\s\S]*?)<\/ArticleDate>/);
  if (!year) year = firstMatch(artDate, /<Year>(\d{4})<\/Year>/);

  let doi = firstMatch(citation, /<ELocationID\b[^>]*EIdType="doi"[^>]*>([\s\S]*?)<\/ELocationID>/);
  if (!doi) {
    const pubmedData = firstMatch(block, /<PubmedData>([\s\S]*?)<\/PubmedData>/);
    const idList = firstMatch(pubmedData, /<ArticleIdList>([\s\S]*?)<\/ArticleIdList>/); // pierwsza lista = artykuł, nie referencje
    doi = firstMatch(idList, /<ArticleId\b[^>]*IdType="doi"[^>]*>([\s\S]*?)<\/ArticleId>/);
  }
  doi = cleanText(doi);

  const pubTypes = [];
  const ptRe = /<PublicationType\b[^>]*>([\s\S]*?)<\/PublicationType>/g;
  while ((m = ptRe.exec(citation))) pubTypes.push(cleanText(m[1]));

  const authors = [];
  const auRe = /<Author\b[^>]*>([\s\S]*?)<\/Author>/g;
  while ((m = auRe.exec(firstMatch(citation, /<AuthorList\b[^>]*>([\s\S]*?)<\/AuthorList>/)))) {
    const last = cleanText(firstMatch(m[1], /<LastName>([\s\S]*?)<\/LastName>/));
    const init = cleanText(firstMatch(m[1], /<Initials>([\s\S]*?)<\/Initials>/));
    const coll = cleanText(firstMatch(m[1], /<CollectiveName>([\s\S]*?)<\/CollectiveName>/));
    if (last) authors.push(init ? last + ' ' + init : last);
    else if (coll) authors.push(coll);
  }
  const authorsShort = authors.length ? authors[0] + (authors.length > 1 ? ' i in.' : '') : '';

  const evidence = classifyEvidence(pubTypes, title);
  return {
    pmid, doi, title, abstract, journal, journalAbbr,
    year: year || '', authors: authorsShort, authorCount: authors.length,
    pubTypes, evidence, evidenceLabel: EVIDENCE_LABEL[evidence],
    url: 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/'
  };
}

function parsePubmedXml(xml) {
  const out = [];
  const re = /<PubmedArticle\b[^>]*>([\s\S]*?)<\/PubmedArticle>/g;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const a = parseArticle(m[1]);
    if (a) out.push(a);
  }
  return out;
}

// ─────────────────────────── scoring / merge ───────────────────────────
function isTopJournal(item, cfg) {
  const list = (cfg.topJournals || []).map((j) => j.toLowerCase());
  return list.includes(String(item.journalAbbr || '').toLowerCase());
}
function scoreItem(item) {
  let s = EVIDENCE_WEIGHT[item.evidence] || 0;
  if (item.topJournal) s += 1;
  if (item.ai && Number.isFinite(item.ai.relevance)) s += item.ai.relevance - 3;
  if (!item.abstract) s -= 1;
  return s;
}

/**
 * Łączy stary feed z nowymi pozycjami. Klucz: PMID. Tematy się sumują,
 * zachowane są firstSeen i streszczenie AI. Zwraca posortowaną listę (najnowsze, potem najlepsze).
 */
function mergeFeed(oldItems, fresh, opts) {
  opts = opts || {};
  const now = opts.now || new Date().toISOString();
  const byId = new Map();
  (oldItems || []).forEach((it) => byId.set(String(it.pmid), { ...it }));
  (fresh || []).forEach((it) => {
    const key = String(it.pmid);
    const prev = byId.get(key);
    if (prev) {
      const topics = Array.from(new Set([...(prev.topics || []), ...(it.topics || [])]));
      byId.set(key, { ...prev, ...it, topics, firstSeen: prev.firstSeen || now, ai: prev.ai || it.ai });
    } else {
      byId.set(key, { ...it, topics: Array.from(new Set(it.topics || [])), firstSeen: now });
    }
  });
  const items = Array.from(byId.values()).map((it) => ({ ...it, score: scoreItem(it) }));
  items.sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)) || b.score - a.score || Number(b.pmid) - Number(a.pmid));
  const max = opts.maxItems || 400;
  return items.slice(0, max);
}

function buildTerm(cat, cfg) {
  const types = cat.publicationTypes || cfg.defaultPublicationTypes;
  const pt = '(' + types.map((t) => '"' + t + '"[pt]').join(' OR ') + ')';
  return '(' + cat.query + ') AND ' + pt + ' AND ' + cfg.humansFilter + ' AND ' + cfg.languageFilter;
}

// ─────────────────────────── AI (opcjonalnie) ───────────────────────────
function parseAiJson(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  let o;
  try { o = JSON.parse(clean.slice(start, end + 1)); } catch (e) { return null; }
  const rel = Math.max(1, Math.min(5, Math.round(Number(o.istotnosc))));
  if (!o.wniosek && !o.streszczenie) return null;
  return {
    titlePl: String(o.tytul_pl || '').trim(),
    summary: String(o.streszczenie || '').trim(),
    takeaway: String(o.wniosek || '').trim(),
    population: String(o.populacja || '').trim(),
    limits: String(o.ograniczenia || '').trim(),
    relevance: Number.isFinite(rel) ? rel : 3
  };
}

const AI_SYSTEM = `Jesteś asystentem trenera personalnego (trening siłowy, hipertrofia, regeneracja, żywienie, redukcja, prehab).
Dostajesz tytuł i abstrakt badania z PubMed. Odpowiadasz WYŁĄCZNIE obiektem JSON, bez komentarza i bez \`\`\`:
{"tytul_pl": "krótki tytuł po polsku", "streszczenie": "2–3 zdania po polsku: kto, co porównano, główny wynik z liczbami jeśli są", "wniosek": "1 zdanie: co trener może zmienić w praktyce (albo że wynik niczego nie zmienia)", "populacja": "np. wytrenowani mężczyźni 18–35, n=40", "ograniczenia": "najważniejsze ograniczenie w kilku słowach", "istotnosc": 1-5}
istotnosc = przydatność dla trenera personalnego pracującego z typowymi klientami na siłowni (5 = zmienia praktykę, 1 = bez znaczenia / populacja kliniczna daleka od siłowni).
Nie dopowiadaj wyników, których nie ma w abstrakcie.`;

async function aiSummarize(item, env) {
  const body = {
    model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: AI_SYSTEM,
    messages: [{ role: 'user', content: 'TYTUŁ: ' + item.title + '\nTYP: ' + item.evidenceLabel + '\nCZASOPISMO: ' + item.journal + ' ' + item.year + '\n\nABSTRAKT:\n' + String(item.abstract || '').slice(0, 6000) }]
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Anthropic HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const data = await r.json();
  const text = (data.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('');
  return parseAiJson(text);
}

// ─────────────────────────── HTTP (NCBI) ───────────────────────────
async function ncbi(endpoint, params, env, method) {
  const p = new URLSearchParams({ ...params, tool: 'progress-live' });
  if (env.NCBI_EMAIL) p.set('email', env.NCBI_EMAIL);
  if (env.NCBI_API_KEY) p.set('api_key', env.NCBI_API_KEY);
  const url = EUTILS + endpoint;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = method === 'POST'
      ? await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p.toString() })
      : await fetch(url + '?' + p.toString());
    if (r.ok) return r.text();
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * attempt); continue; }
    throw new Error('NCBI ' + endpoint + ' HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  }
  throw new Error('NCBI ' + endpoint + ': zbyt wiele prób');
}

// ─────────────────────────── main ───────────────────────────
async function main() {
  const env = process.env;
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'research_queries.json'), 'utf8'));
  const feedPath = path.join(ROOT, env.FEED_PATH || 'research-feed.json');
  const lookback = Math.max(1, parseInt(env.LOOKBACK_DAYS || '14', 10) || 14);
  const gap = env.NCBI_API_KEY ? 120 : 400;

  let old = { items: [] };
  if (fs.existsSync(feedPath)) {
    try { old = JSON.parse(fs.readFileSync(feedPath, 'utf8')); } catch (e) { console.warn('Uszkodzony feed — zaczynam od zera'); }
  }
  const known = new Set((old.items || []).map((x) => String(x.pmid)));

  // 1) esearch per kategoria
  const topicsByPmid = new Map();
  for (const cat of cfg.categories) {
    const term = buildTerm(cat, cfg);
    const json = JSON.parse(await ncbi('esearch.fcgi', {
      db: 'pubmed', term, retmode: 'json', retmax: String(cat.max || cfg.defaultMax || 15),
      sort: 'relevance', datetype: 'edat', reldate: String(lookback)
    }, env));
    const ids = (json.esearchresult && json.esearchresult.idlist) || [];
    console.log(`[${cat.id}] ${ids.length} wyników (łącznie w PubMed: ${json.esearchresult ? json.esearchresult.count : '?'})`);
    ids.forEach((id) => {
      if (!topicsByPmid.has(id)) topicsByPmid.set(id, new Set());
      topicsByPmid.get(id).add(cat.id);
    });
    await sleep(gap);
  }

  // 2) efetch tylko nowych (znane dostają nowe tematy przez merge bez ponownego pobierania)
  const allIds = Array.from(topicsByPmid.keys());
  const newIds = allIds.filter((id) => !known.has(id));
  const fresh = [];
  for (let i = 0; i < newIds.length; i += 150) {
    const chunk = newIds.slice(i, i + 150);
    const xml = await ncbi('efetch.fcgi', { db: 'pubmed', id: chunk.join(','), retmode: 'xml', rettype: 'abstract' }, env, 'POST');
    parsePubmedXml(xml).forEach((a) => {
      a.topics = Array.from(topicsByPmid.get(a.pmid) || []);
      a.topJournal = isTopJournal(a, cfg);
      fresh.push(a);
    });
    await sleep(gap);
  }
  // znane PMID z nowymi tematami
  const topicUpdates = allIds.filter((id) => known.has(id)).map((id) => {
    const prev = old.items.find((x) => String(x.pmid) === id);
    return { ...prev, topics: Array.from(new Set([...(prev.topics || []), ...topicsByPmid.get(id)])) };
  });

  let items = mergeFeed(old.items || [], fresh.concat(topicUpdates), { maxItems: parseInt(env.MAX_ITEMS || '400', 10) });

  // 3) AI po polsku (opcjonalnie)
  if (env.ANTHROPIC_API_KEY) {
    const todo = items.filter((x) => !x.ai && x.abstract).sort((a, b) => b.score - a.score).slice(0, parseInt(env.AI_MAX || '40', 10));
    let done = 0;
    for (const it of todo) {
      try {
        const ai = await aiSummarize(it, env);
        if (ai) { it.ai = ai; done++; }
      } catch (e) {
        console.warn('AI pominięte dla ' + it.pmid + ': ' + e.message);
        if (/HTTP 4(01|03)/.test(e.message)) break; // zły klucz — nie ma sensu próbować dalej
      }
      await sleep(300);
    }
    console.log(`AI: streszczono ${done}/${todo.length}`);
    items = items.map((it) => ({ ...it, score: scoreItem(it) }));
  } else {
    console.log('AI: brak ANTHROPIC_API_KEY — pomijam streszczenia (feed działa bez nich)');
  }

  const changed = JSON.stringify(items) !== JSON.stringify(old.items || []);
  const out = {
    version: 1,
    generatedAt: changed ? new Date().toISOString() : (old.generatedAt || new Date().toISOString()),
    lookbackDays: lookback,
    categories: cfg.categories.map((c) => ({ id: c.id, label: c.label })),
    items
  };
  fs.writeFileSync(feedPath, JSON.stringify(out, null, 1) + '\n');
  console.log(`Nowe: ${fresh.length} · razem w feedzie: ${items.length} · ${changed ? 'zapisano zmiany' : 'bez zmian'}`);
}

module.exports = { parsePubmedXml, parseArticle, classifyEvidence, mergeFeed, scoreItem, buildTerm, parseAiJson, cleanText, isTopJournal };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
