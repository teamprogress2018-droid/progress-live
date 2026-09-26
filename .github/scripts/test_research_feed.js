#!/usr/bin/env node
/** Feed "Nowe badania": parser PubMed XML, klasyfikacja dowodu, merge/dedupe, parser JSON AI, podpięcie w UI. */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('./fetch_research_feed.js');

const root = path.join(__dirname, '..', '..');
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); failed++; }
  else console.log('OK  ', name);
}

const XML = `<?xml version="1.0" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2025//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_250101.dtd">
<PubmedArticleSet>
<PubmedArticle>
 <MedlineCitation Status="PubMed-not-MEDLINE" Owner="NLM">
  <PMID Version="1">41000001</PMID>
  <Article PubModel="Print-Electronic">
   <Journal>
    <JournalIssue CitedMedium="Internet"><PubDate><Year>2026</Year><Month>Sep</Month></PubDate></JournalIssue>
    <Title>Sports medicine (Auckland, N.Z.)</Title>
    <ISOAbbreviation>Sports Med</ISOAbbreviation>
   </Journal>
   <ArticleTitle>Effects of Training to Failure on Muscle Hypertrophy: A <i>Systematic</i> Review &amp; Meta-Analysis.</ArticleTitle>
   <ELocationID EIdType="doi" ValidYN="Y">10.1007/s40279-026-00001-x</ELocationID>
   <Abstract>
    <AbstractText Label="BACKGROUND" NlmCategory="BACKGROUND">Proximity to failure (RIR &lt; 3) is debated.</AbstractText>
    <AbstractText Label="RESULTS" NlmCategory="RESULTS">Hypertrophy was similar (SMD = 0.12; 95% CI&#x2009;−0.05 to 0.29).</AbstractText>
   </Abstract>
   <AuthorList CompleteYN="Y">
    <Author ValidYN="Y"><LastName>Kowalski</LastName><ForeName>Jan</ForeName><Initials>J</Initials></Author>
    <Author ValidYN="Y"><LastName>Smith</LastName><ForeName>Anna</ForeName><Initials>A</Initials></Author>
   </AuthorList>
   <PublicationTypeList>
    <PublicationType UI="D016428">Journal Article</PublicationType>
    <PublicationType UI="D017418">Meta-Analysis</PublicationType>
    <PublicationType UI="D000078182">Systematic Review</PublicationType>
   </PublicationTypeList>
  </Article>
  <MedlineJournalInfo><MedlineTA>Sports Med</MedlineTA></MedlineJournalInfo>
 </MedlineCitation>
 <PubmedData>
  <ArticleIdList><ArticleId IdType="pubmed">41000001</ArticleId></ArticleIdList>
  <ReferenceList><Reference><ArticleIdList><ArticleId IdType="doi">10.9999/reference-not-me</ArticleId><ArticleId IdType="pubmed">123</ArticleId></ArticleIdList></Reference></ReferenceList>
 </PubmedData>
</PubmedArticle>
<PubmedArticle>
 <MedlineCitation Status="In-Process" Owner="NLM">
  <PMID Version="1">41000002</PMID>
  <Article PubModel="Electronic">
   <Journal>
    <JournalIssue><PubDate><MedlineDate>2026 Aug-Sep</MedlineDate></PubDate></JournalIssue>
    <Title>Journal of the International Society of Sports Nutrition</Title>
    <ISOAbbreviation>J Int Soc Sports Nutr</ISOAbbreviation>
   </Journal>
   <ArticleTitle>International society of sports nutrition position stand: creatine in women.</ArticleTitle>
   <AuthorList><Author><CollectiveName>ISSN Working Group</CollectiveName></Author></AuthorList>
   <PublicationTypeList><PublicationType UI="D016428">Journal Article</PublicationType><PublicationType UI="D016454">Review</PublicationType></PublicationTypeList>
  </Article>
 </MedlineCitation>
 <PubmedData>
  <ArticleIdList><ArticleId IdType="pubmed">41000002</ArticleId><ArticleId IdType="doi">10.1080/15502783.2026.2</ArticleId></ArticleIdList>
 </PubmedData>
</PubmedArticle>
</PubmedArticleSet>`;

const items = F.parsePubmedXml(XML);
ok('parses 2 articles', items.length === 2, items.length);
const a = items[0], b = items[1];
ok('pmid', a.pmid === '41000001');
ok('title strips inner tags + entities', a.title === 'Effects of Training to Failure on Muscle Hypertrophy: A Systematic Review & Meta-Analysis.', a.title);
ok('structured abstract with labels', a.abstract.startsWith('BACKGROUND: Proximity to failure (RIR < 3)') && a.abstract.includes('\nRESULTS: '), a.abstract);
ok('numeric entity decoded', a.abstract.includes('CI\u2009−0.05') || a.abstract.includes('CI −0.05'), a.abstract);
ok('doi from ELocationID', a.doi === '10.1007/s40279-026-00001-x', a.doi);
ok('year', a.year === '2026');
ok('authors short', a.authors === 'Kowalski J i in.' && a.authorCount === 2, a.authors);
ok('evidence meta', a.evidence === 'meta' && a.evidenceLabel === 'Metaanaliza');
ok('url', a.url === 'https://pubmed.ncbi.nlm.nih.gov/41000001/');
ok('doi from first ArticleIdList, not references', b.doi === '10.1080/15502783.2026.2', b.doi);
ok('MedlineDate year', b.year === '2026');
ok('collective author', b.authors === 'ISSN Working Group');
ok('position stand -> guideline', b.evidence === 'guideline', b.evidence);
ok('no abstract ok', b.abstract === '');

ok('classify rct', F.classifyEvidence(['Journal Article', 'Randomized Controlled Trial']) === 'rct');
ok('classify other', F.classifyEvidence(['Journal Article']) === 'other');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'research_queries.json'), 'utf8'));
ok('top journal Sports Med', F.isTopJournal(a, cfg));
ok('categories have id/label/query', cfg.categories.length >= 10 && cfg.categories.every((c) => c.id && c.label && c.query));
ok('category ids unique', new Set(cfg.categories.map((c) => c.id)).size === cfg.categories.length);
const term = F.buildTerm(cfg.categories[0], cfg);
ok('term has pt + humans + language filter', term.includes('"Meta-Analysis"[pt]') && term.includes('humans[mh]') && term.includes('english[la]'), term);
const guide = cfg.categories.find((c) => c.id === 'stanowiska');
ok('guideline category overrides pt', F.buildTerm(guide, cfg).includes('"Practice Guideline"[pt]'));
ok('balanced parentheses in every query', cfg.categories.every((c) => {
  let d = 0; for (const ch of c.query) { if (ch === '(') d++; if (ch === ')') d--; if (d < 0) return false; } return d === 0;
}));

// merge
const t1 = '2026-09-01T04:00:00.000Z', t2 = '2026-09-08T04:00:00.000Z';
let feed = F.mergeFeed([], [{ ...a, topics: ['hipertrofia'] }], { now: t1 });
feed = F.mergeFeed(feed, [{ ...a, topics: ['programowanie'] }, { ...b, topics: ['suplementy'] }], { now: t2 });
ok('dedupe by pmid', feed.length === 2, feed.length);
const ma = feed.find((x) => x.pmid === a.pmid);
ok('topics union', ma.topics.includes('hipertrofia') && ma.topics.includes('programowanie'), ma.topics);
ok('firstSeen kept', ma.firstSeen === t1);
ok('newest first', feed[0].pmid === b.pmid);
ok('score present', typeof ma.score === 'number');
const withAi = F.mergeFeed([{ ...ma, ai: { takeaway: 'x', relevance: 5 } }], [{ ...a, topics: ['hipertrofia'] }], { now: t2 });
ok('ai summary preserved on merge', withAi[0].ai && withAi[0].ai.takeaway === 'x');
ok('max items cap', F.mergeFeed(feed, [], { maxItems: 1 }).length === 1);

// AI JSON
const ai = F.parseAiJson('```json\n{"tytul_pl":"Trening do upadku","streszczenie":"S.","wniosek":"W.","populacja":"P","ograniczenia":"O","istotnosc":"7"}\n```');
ok('ai json parsed + relevance clamped', ai && ai.takeaway === 'W.' && ai.relevance === 5, ai);
ok('ai garbage -> null', F.parseAiJson('nie wiem') === null);
const directAi = F.aiConnection({ ANTHROPIC_API_KEY: 'test-key' });
ok('AI prefers direct key', directAi && directAi.label === 'Anthropic' && directAi.headers['x-api-key'] === 'test-key');
const proxyAi = F.aiConnection({});
ok('AI translates through app proxy without a separate key', proxyAi && proxyAi.label === 'proxy aplikacji' && /workers\.dev/.test(proxyAi.url));

// repo wiring
const feedFile = path.join(root, 'research-feed.json');
ok('research-feed.json exists + valid', fs.existsSync(feedFile) && Array.isArray(JSON.parse(fs.readFileSync(feedFile, 'utf8')).items));
const wf = fs.readFileSync(path.join(root, '.github/workflows/research-feed.yml'), 'utf8');
ok('workflow scheduled + manual', /schedule:/.test(wf) && /workflow_dispatch:/.test(wf) && /contents:\s*write/.test(wf));
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('UI loads research-feed.json', src09.includes("research-feed.json"));
ok('UI feed panel in KB screen', html.includes('id="kb-feed"'));
ok('UI accept/dismiss handlers', /function kbFeedAccept\(/.test(src09) && /function kbFeedDismiss\(/.test(src09));
ok('saved entry keeps pmid', src09.includes('_kbPendingMeta'));

if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('\nAll research feed checks passed');
