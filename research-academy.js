/* Progress Academy — zakładka „Badania”.
 * Dane: knowledge/research-base.json, budowany na serwerze (.github/scripts/build_research_base.js,
 * workflow research-base.yml). Przeglądarka nie zna kluczy API i nie odpytuje PubMed bezpośrednio.
 * Karty i odpowiedzi to opracowania abstraktów; każde zdanie odpowiedzi wskazuje źródło [S1]/[K1],
 * a odwołania do źródeł spoza bazy są usuwane przed wyświetleniem. Moduł nie zapisuje danych klientów. */
(function(root){
  'use strict';
  const BASE_URL='knowledge/research-base.json';
  const LOAD_TIMEOUT_MS=10000;
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const norm=s=>String(s||'').toLocaleLowerCase('pl').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l');
  const state={status:'idle',data:null,error:'',sub:'search',query:'',category:'all',sort:'quality',limit:3,compare:false,warning:'',saving:{},editing:'',saved:{type:'all',category:'all',status:'all'},ai:{status:'idle',question:'',answer:null,error:''}};
  const resultCache=new Map();

  const EVIDENCE_WEIGHT={guideline:6,meta:6,sr:5,rct:3,review:1,other:0};
  const EVIDENCE_LABEL={guideline:'Stanowisko / wytyczne',meta:'Metaanaliza',sr:'Przegląd systematyczny',rct:'Badanie randomizowane (RCT)',review:'Przegląd',other:'Badanie obserwacyjne / inne'};
  const CERTAINTY_LABEL={mocne:'Mocne dowody',umiarkowane:'Umiarkowane dowody',wstepne:'Wstępne dane',brak:'Brak jasnego wniosku'};
  const CERTAINTY_RANK={brak:0,wstepne:1,umiarkowane:2,mocne:3};
  const USEFULNESS_LABEL={wysoka:'Wysoka',srednia:'Średnia',niska:'Niska'};
  const USEFULNESS_RANK={niska:0,srednia:1,wysoka:2};
  const SORTS=[['quality','Jakość dowodów'],['newest','Najnowsze'],['relevance','Trafność']];
  const STOP=new Set('czy jak jaki jaka jakie jakich ile kiedy gdzie dla przy oraz albo lub jest sa sie nie tak to ten ta te tym tego jego ich mam ma moze mozna zawsze bardzo jesli czym co sens dobry dobra dobre lepsze lepszy lepiej najlepiej stosowac robic zrobic trzeba warto daje dac klient klienta klientem klienci osoba osoby osob mojego mojej moj moja przed po od do na we w z ze za o u i a'.split(' '));
  /* Słowa trenera → słowa z tytułów i opracowań (EN z PubMed + PL z kart). */
  const SYNONYMS={
    objet:['volume','sets'],serie:['sets','volume'],serii:['sets','volume'],hiper:['hypertrophy','muscle growth','muscle thickness'],mies:['muscle'],
    upade:['failure'],upadk:['failure','falls'],przer:['rest interval','rest period','rest'],odpoc:['rest'],sila:['strength'],silo:['strength'],
    powto:['repetition'],ciez:['load'],czest:['frequency'],zakre:['range of motion'],cardi:['aerobic','endurance','concurrent'],kardi:['aerobic','endurance','concurrent'],
    aerob:['aerobic'],tleno:['aerobic','oxygen'],wydol:['fitness','vo2','cardiorespiratory'],hiit:['high-intensity interval','hiit','interval'],interw:['interval'],
    tabat:['tabata','sprint interval','supramaximal'],nadwa:['overweight','obesity'],otyl:['obesity','obese'],poczat:['untrained','sedentary','novice','beginner'],
    lacze:['concurrent','combined'],laczy:['concurrent','combined'],bialk:['protein'],kreat:['creatine'],kofei:['caffeine'],reduk:['weight loss','fat loss','deficit','energy restriction'],
    defic:['deficit','energy restriction'],posil:['meal','timing'],okno:['timing','window'],sen:['sleep'],snu:['sleep'],spani:['sleep'],regen:['recovery'],zakwa:['soreness','doms'],doms:['soreness','doms'],
    zimn:['cold'],deloa:['deload','detraining'],przet:['overtraining','overreaching'],zmecz:['fatigue'],krzyz:['low back'],ledzw:['low back','lumbar'],bol:['pain'],bolu:['pain'],
    ciaz:['pregnan'],ciazy:['pregnan'],scieg:['tendon','tendinopathy'],konto:['injury'],kontu:['injury'],uraz:['injury'],nadci:['hypertension','blood pressure'],cisni:['blood pressure'],
    senio:['older','elderly'],starsz:['older','elderly'],rowno:['balance'],plyom:['plyometric','jump'],skocz:['jump'],szybk:['sprint','speed'],core:['core','trunk'],rozci:['stretching','lengthened'],
    maszy:['machine'],wolne:['free weight'],wiel:['multi-joint'],wielo:['multi-joint','compound'],izolo:['single-joint','isolation'],kroki:['steps'],kroko:['steps'],perio:['periodization','periodized'],
    autor:['autoregulation'],rir:['repetitions in reserve','rir'],rpe:['rpe','perceived exertion'],dlugo:['length','lengthened'],wari:['variation','variety'],zmien:['variation'],
    tetno:['heart rate'],bezpi:['safety','adverse']
  };

  function tokens(q){return norm(q).split(/[^a-z0-9%]+/).filter(w=>w.length>=3&&!STOP.has(w));}
  function stems(q){return Array.from(new Set(tokens(q).map(w=>w.slice(0,5))));}
  function synonymTerms(q){
    const out=new Set();
    tokens(q).forEach(w=>{Object.keys(SYNONYMS).forEach(k=>{if(w.indexOf(k)===0)SYNONYMS[k].forEach(x=>out.add(x));});});
    return Array.from(out);
  }

  /** Kategorie pytania: trafienia słów kluczowych na początku wyrazu. */
  function classify(question,categories){
    const t=' '+norm(question).replace(/[^a-z0-9%]+/g,' ')+' ';
    return (categories||[]).map(c=>{
      const score=(c.keywords||[]).reduce((n,k)=>n+(t.indexOf(' '+norm(k))>=0?1:0),0);
      return {id:c.id,label:c.label,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  }

  /** Bezpieczny link: tylko https i znane serwisy z publikacjami. */
  const ALLOWED_HOSTS=['pubmed.ncbi.nlm.nih.gov','www.ncbi.nlm.nih.gov','pmc.ncbi.nlm.nih.gov','doi.org','europepmc.org'];
  function safeHref(value){
    try{const u=new URL(String(value||''));return u.protocol==='https:'&&ALLOWED_HOSTS.includes(u.hostname)?u.href:'';}catch(e){return '';}
  }
  /** Linki budujemy z identyfikatorów (nie z zapisanych adresów); DOI tylko po weryfikacji w Crossref. */
  function studyLinks(s){
    const links=[];
    if(/^\d+$/.test(String(s&&s.pmid||'')))links.push({label:'PubMed',href:safeHref('https://pubmed.ncbi.nlm.nih.gov/'+s.pmid+'/')});
    if(s&&s.doi&&s.doiVerified&&/^10\.\d{4,9}\/\S+$/.test(s.doi))links.push({label:'DOI',href:safeHref('https://doi.org/'+encodeURI(s.doi))});
    if(s&&s.openAccess&&/^PMC\d+$/.test(String(s.pmcid||'')))links.push({label:'Pełny tekst (otwarty dostęp)',href:safeHref('https://europepmc.org/article/PMC/'+s.pmcid)});
    return links.filter(l=>l.href);
  }
  function linkHtml(l,cls){return `<a class="${cls||'btn btn-ghost btn-sm'}" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`;}

  function studyText(s){const y=s.synth||{};return norm([s.title,y.titlePl,y.coZbadano,y.coZnaleziono,y.dlaTrenera,y.populacja].join(' '));}
  function qualityScore(s){const y=s.synth||{};return (EVIDENCE_WEIGHT[s.evidence]||0)*10+(CERTAINTY_RANK[y.pewnosc]||0)*4+(USEFULNESS_RANK[y.uzytecznosc]||0)*2+(y.coZbadano?1:0);}
  function sortStudies(list,sort){
    const by={
      quality:(a,b)=>qualityScore(b.study)-qualityScore(a.study)||b.score-a.score,
      newest:(a,b)=>(Number(b.study.year)||0)-(Number(a.study.year)||0)||qualityScore(b.study)-qualityScore(a.study),
      relevance:(a,b)=>b.score-a.score||qualityScore(b.study)-qualityScore(a.study)
    }[sort]||((a,b)=>b.score-a.score);
    return list.slice().sort(by);
  }

  /** Dopasowanie pytania trenera do opracowanych pytań bazy. */
  function matchQuestions(data,question){
    const qs=stems(question),nq=norm(question).replace(/[^a-z0-9]+/g,' ').trim();
    return (data.questions||[]).map(x=>{
      const xs=stems(x.q);
      if(norm(x.q).replace(/[^a-z0-9]+/g,' ').trim()===nq)return {question:x,score:1};
      const hit=xs.filter(s=>qs.includes(s)).length;
      return {question:x,score:hit/Math.max(2,xs.length),hits:hit};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  }

  /**
   * Wyszukiwanie w bazie: kategoria → opracowane pytanie → badania. Zwraca 3–5 najlepszych kart.
   * Wynik jest zapamiętywany (cache) dla tej samej treści pytania, kategorii, sortowania i limitu.
   */
  function search(data,question,opts){
    opts=opts||{};
    const sort=opts.sort||'quality',limit=Math.max(1,Math.min(5,opts.limit||3)),cat=opts.category||'all';
    const key=[norm(question).trim(),cat,sort,limit,data&&data.generatedAt].join('|');
    if(resultCache.has(key))return resultCache.get(key);
    const studies=(data&&data.studies)||{};
    const categories=classify(question,data&&data.categories);
    const topCat=cat!=='all'?cat:(categories[0]&&categories[0].id)||'';
    const matches=question?matchQuestions(data||{},question):[];
    const best=matches[0]&&(matches[0].score===1||(matches[0].score>=0.5&&matches[0].hits>=2))?matches[0].question:null;
    const near=new Set();matches.slice(0,3).forEach(m=>(m.question.studyIds||[]).forEach(id=>near.add(id)));
    const words=stems(question),en=synonymTerms(question);
    let list=Object.values(studies).map(s=>{
      const t=studyText(s);
      let score=words.filter(w=>t.indexOf(w)>=0).length+en.filter(w=>t.indexOf(w)>=0).length*1.2;
      if(topCat&&(s.categories||[]).includes(topCat))score+=1;
      if(best&&(best.studyIds||[]).includes(s.pmid))score+=6;
      else if(near.has(s.pmid))score+=1.5;
      return {study:s,score};
    });
    if(cat!=='all')list=list.filter(x=>(x.study.categories||[]).includes(cat));
    list=question?list.filter(x=>x.score>=3||(best&&(best.studyIds||[]).includes(x.study.pmid))):list;
    const total=list.length;
    /* Najpierw wybieramy najtrafniejsze, dopiero potem sortujemy wg wyboru trenera. */
    const pool=question?sortStudies(list,'relevance').slice(0,Math.max(limit,8)):list;
    const shown=sortStudies(pool,sort).slice(0,limit);
    const result={question,categories,category:topCat,matched:best,suggestions:matches.filter(m=>m.question!==best).slice(0,3).map(m=>m.question),studies:shown.map(x=>x.study),total};
    resultCache.set(key,result);
    return result;
  }

  /** Odwołania [S1]/[K1] → przypisy; klucze spoza listy źródeł znikają. */
  function refsHtml(text,known){
    return esc(text).replace(/\[(S|K)(\d+)\]/g,(m,t,n)=>{
      const k=t+n;
      if(!known.has(k))return '';
      return t==='S'?`<a class="research-ref" href="#research-src-${k}" title="Źródło ${k}">${k}</a>`:`<span class="research-ref research-ref-book" title="Reguła z książki ${k}">${k}</span>`;
    }).replace(/\s*\[\?\]/g,' <span class="research-check" title="Kontrola AI: źródło potwierdza to zdanie tylko częściowo. Sprawdź w karcie.">do sprawdzenia</span>').replace(/\s+([.,;])/g,'$1');
  }

  function metaLine(s){
    const y=s.synth||{};
    const n=y.liczebnosc?`n = ${y.liczebnosc}`:'';
    return [s.authors,s.year,s.journalAbbr||s.journal].filter(Boolean).map(esc).join(' · ')+(y.populacja||n?`<div class="research-pop">Populacja: ${esc([y.populacja,n].filter(Boolean).join(', '))}</div>`:'<div class="research-pop">Populacja i liczebność: brak w abstrakcie</div>');
  }
  function savedEntry(s){return (root.KB||[]).find(k=>k&&((s.pmid&&String(k.pmid||'')===String(s.pmid))||(s.doi&&k.doi===s.doi)))||null;}
  function section(label,body){return body?`<div class="research-sec"><b>${label}</b><p>${body}</p></div>`:'';}

  /** Karta badania. Bez opracowania (brak abstraktu) pokazuje tylko metadane i link do źródła. */
  function renderCard(s,key){
    const y=s.synth;
    const links=studyLinks(s);
    const saved=savedEntry(s);
    const pid=esc(JSON.stringify(String(s.pmid)));
    const cert=y?y.pewnosc:'brak';
    const body=y
      ?section('Co zbadano?',esc(y.coZbadano))+section('Co znaleziono?',esc(y.coZnaleziono))+section('Co to oznacza dla trenera?',esc(y.dlaTrenera||'Źródło nie daje praktycznego wniosku.'))+section('Czego to badanie nie dowodzi?',esc(y.czegoNieDowodzi||'Abstrakt nie opisuje ograniczeń — sprawdź pełny tekst.'))
      :`<p class="research-nosynth">${s.hasAbstract===false?'Brak opracowania: PubMed nie udostępnia abstraktu tej publikacji.':'Ta karta nie ma jeszcze opracowania.'} Pokazujemy tylko metadane i link — przeczytaj źródło, zanim wyciągniesz wnioski.</p>`;
    return `<article class="research-card"${key?` id="research-src-${esc(key)}"`:''}>
      <div class="research-card-pills">${key?`<span class="research-key">${esc(key)}</span>`:''}<span class="research-pill research-ev-${esc(s.evidence)}">${esc(EVIDENCE_LABEL[s.evidence]||s.evidenceLabel||'Badanie')}</span>${y?`<span class="research-pill research-cert-${esc(cert)}">${esc(CERTAINTY_LABEL[cert])}</span><span class="research-pill">Użyteczność: ${esc(USEFULNESS_LABEL[y.uzytecznosc]||'—')}</span>`:''}${s.openAccess?'<span class="research-pill research-oa">Otwarty dostęp</span>':''}</div>
      <h3>${esc(y&&y.titlePl?y.titlePl:s.title)}</h3>
      ${y&&y.titlePl?`<div class="research-orig" lang="en">${esc(s.title)}</div>`:''}
      <div class="research-meta">${metaLine(s)}</div>
      ${body}
      <div class="research-actions">${saved?`<span class="research-saved">✓ W moich źródłach</span>`:`<button type="button" class="btn btn-primary btn-sm" onclick="academyResearchSave(${pid})"${state.saving[s.pmid]?' disabled':''}>Zapisz do „Do przeczytania”</button>`}${links.map(l=>linkHtml(l)).join('')}</div>
      ${saved?trainerBlock(saved):''}
    </article>`;
  }

  function sourceLine(s,key){
    const links=studyLinks(s);
    return `<li id="research-srcline-${esc(key)}"><b>${esc(key)}</b> ${esc([s.authors,s.year?'('+s.year+')':''].filter(Boolean).join(' '))}. ${esc(s.title)} <i>${esc(s.journalAbbr||s.journal||'')}</i>. ${esc(EVIDENCE_LABEL[s.evidence]||'')}${links.length?' · '+links.map(l=>linkHtml(l,'research-inline-link')).join(' · '):''}</li>`;
  }

  /** Odpowiedź Academy w 8 częściach (+ tryb „Porównaj źródła”). */
  const CONFLICT_LABEL={nowsze_badania:'Nowsze badania mają mocniejsze dowody',zalezy_od_kontekstu:'Zależy od kontekstu — obie strony mogą mieć rację',nierozstrzygniete:'Nierozstrzygnięte'};
  /** Sekcja tylko wtedy, gdy AI wskazało sprzeczność popartą i [K#], i [S#] (sprawdza research-answer.js). */
  function conflictsHtml(list,r){
    if(!Array.isArray(list)||!list.length)return '';
    return `<section class="research-conflicts" aria-label="Książka mówi co innego niż badania"><b>Książka mówi co innego niż badania</b>${list.map(c=>`<div class="research-conflict"><p class="research-conflict-topic">${esc(c.temat)} <span class="research-pill">${esc(CONFLICT_LABEL[c.ocena]||CONFLICT_LABEL.nierozstrzygniete)}</span></p><p><span class="research-conflict-side">Książka:</span> ${r(c.ksiazka)}</p><p><span class="research-conflict-side">Badania:</span> ${r(c.badania)}</p></div>`).join('')}</section>`;
  }
  /** Wynik samokontroli odpowiedzi (drugi przebieg AI). Starsze odpowiedzi bez kontroli nie mają notki. */
  function checkNote(a){
    if(a.sprawdzone===true){
      const parts=['Każde zdanie z wnioskiem sprawdzone z kartami.'];
      if(a.usunieteZdania)parts.push(`Usunięto ${a.usunieteZdania} niepotwierdzon${a.usunieteZdania===1?'e zdanie':'ych zdań'}.`);
      if(a.doSprawdzenia)parts.push('Zdania z oznaczeniem „do sprawdzenia” źródło potwierdza tylko częściowo.');
      return `<p class="research-check-note">${esc(parts.join(' '))}</p>`;
    }
    if(a.sprawdzone===false)return `<p class="research-check-note research-check-warn">Automatyczna kontrola zdań nie powiodła się. Czytaj tę odpowiedź razem z kartami badań.</p>`;
    return '';
  }
  function renderAnswer(answer,studies){
    if(!answer)return '';
    const keyed={};(answer.sources&&answer.sources.S||[]).forEach((id,i)=>{if(studies[id])keyed['S'+(i+1)]=studies[id];});
    const books=(answer.sources&&answer.sources.K)||[];
    const known=new Set(Object.keys(keyed).concat(books.map((_,i)=>'K'+(i+1))));
    const r=t=>refsHtml(t,known);
    const cmp=answer.porownanie||{};
    const compare=state.compare?`<div class="research-compare" aria-label="Porównanie źródeł">
      <div><b>Książka / notatka trenera</b><p>${r(cmp.ksiazka||'Brak reguły w bazie książek.')}</p>${notesForQuestion().map(n=>`<p class="research-note-hit">Twoja notatka: <i>${esc(n.title)}</i></p>`).join('')}</div>
      <div><b>Najnowsze badania</b><p>${r(cmp.badania||'—')}</p></div>
      <div><b>Wspólny wniosek</b><p>${r(cmp.wspolne||'Źródła tego nie rozstrzygają.')}</p></div>
      <div><b>Różnice lub niepewność</b><p>${r(cmp.roznice||'—')}</p></div>
      <div class="research-compare-wide"><b>Rekomendacja praktyczna dla trenera</b><p>${r(cmp.rekomendacja||'—')}</p></div>
    </div>`:'';
    return `<section class="research-answer" aria-label="Odpowiedź Academy">
      <div class="research-answer-head"><span class="academy-eyebrow">Odpowiedź Academy</span><span class="research-pill research-cert-${esc(answer.pewnosc)}">${esc(CERTAINTY_LABEL[answer.pewnosc]||CERTAINTY_LABEL.brak)}</span></div>
      <ol class="research-steps">
        <li><b>Krótka odpowiedź</b><p>${r(answer.krotko)}</p></li>
        <li><b>Dlaczego</b><p>${r(answer.dlaczego)}</p></li>
        <li><b>Co zrobić w praktyce z klientem</b><ul>${(answer.praktyka||[]).map(x=>`<li>${r(x)}</li>`).join('')}</ul></li>
        <li><b>Dla kogo to ma sens</b><p>${r(answer.dlaKogo||'Źródła tego nie rozstrzygają.')}</p></li>
        <li><b>Kiedy nie stosować lub zachować ostrożność</b><p>${r(answer.ostroznie||'Źródła tego nie opisują — przy bólu, chorobie lub ciąży skonsultuj klienta z lekarzem lub fizjoterapeutą.')}</p></li>
        <li><b>Źródła z datą publikacji</b><ul class="research-sources">${Object.keys(keyed).map(k=>sourceLine(keyed[k],k)).join('')}${books.map((b,i)=>`<li><b>K${i+1}</b> ${esc(b.cite)} <span class="research-book-status">(${esc(b.status==='zrodlo'?'z książki':b.status==='wniosek'?'wniosek z książki':'reguła ostrożności')})</span></li>`).join('')}</ul></li>
        <li><b>Książka a nowsze badania</b><p>${r(answer.ksiazkaVsBadania||'Brak reguły w bazie książek.')}</p></li>
        ${answer.pytanie?`<li><b>Pytanie kontrolne</b><details class="research-quiz"><summary>${esc(answer.pytanie.q)}</summary><p>${r(answer.pytanie.a)}</p></details></li>`:''}
      </ol>
      ${conflictsHtml(answer.sprzecznosci,r)}
      ${checkNote(answer)}
      <div class="research-answer-foot"><button type="button" class="btn btn-ghost btn-sm" aria-pressed="${state.compare}" onclick="academyResearchCompare()">${state.compare?'Ukryj porównanie':'Porównaj źródła'}</button><small>Opracowanie abstraktów i reguł z książek, nie pełnych tekstów. Nie zastępuje oceny klienta ani konsultacji medycznej.</small></div>
      ${compare}
    </section>`;
  }

  /** Własne notatki i książki trenera pasujące do pytania (tylko tytuły; treść zostaje prywatna). */
  function notesForQuestion(){
    const w=stems(state.query);
    if(!w.length)return [];
    return (root.KB||[]).filter(k=>k&&(k.academyBook||k.kind==='note'||k.kind==='principle')&&k.text).filter(k=>{const t=norm(k.title+' '+k.text);return w.filter(x=>t.indexOf(x)>=0).length>=2;}).slice(0,3);
  }

  /** Bez opracowanej odpowiedzi: praktyczne wnioski z kart, każdy z odwołaniem. */
  function cardsSummary(list){
    const withSynth=list.filter(s=>s.synth&&s.synth.dlaTrenera);
    if(!withSynth.length)return '';
    return `<section class="research-answer research-answer-lite"><div class="research-answer-head"><span class="academy-eyebrow">Co wynika z kart</span></div><p class="research-lite-note">Dla tego pytania nie ma jeszcze pełnej odpowiedzi Academy. Poniżej praktyczne wnioski z najlepiej dopasowanych badań — każdy prowadzi do karty.</p><ul>${list.map((s,i)=>s.synth&&s.synth.dlaTrenera?`<li>${esc(s.synth.dlaTrenera)} <a class="research-ref" href="#research-src-S${i+1}">S${i+1}</a></li>`:'').join('')}</ul></section>`;
  }

  /** Czy pytanie zawiera imię i nazwisko klienta — moduł badań nie przyjmuje danych klientów. */
  function mentionsClient(q){
    const t=' '+norm(q).replace(/[^a-z0-9]+/g,' ')+' ';
    return (root.CL||[]).some(c=>{
      const parts=norm(c&&c.name||'').split(/\s+/).filter(p=>p.length>=3);
      return parts.length>=2&&parts.every(p=>t.indexOf(' '+p+' ')>=0);
    });
  }

  async function load(force){
    if(state.status==='loading'||(state.status==='ok'&&!force))return;
    state.status='loading';state.error='';
    const ctrl=typeof AbortController==='function'?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),LOAD_TIMEOUT_MS):null;
    try{
      const r=await root.fetch(BASE_URL+'?d='+new Date().toISOString().slice(0,10),ctrl?{signal:ctrl.signal}:undefined);
      if(r.status===404){state.status='empty';return;}
      if(!r.ok)throw new Error('HTTP '+r.status);
      setData(await r.json());
    }catch(e){
      state.status='error';state.error=e&&e.name==='AbortError'?'Baza badań nie odpowiada.':'Nie udało się wczytać bazy badań.';
    }finally{
      if(timer)clearTimeout(timer);
      rerender();
    }
  }
  function setData(json){
    const ok=json&&typeof json==='object'&&json.studies&&typeof json.studies==='object'&&Array.isArray(json.questions);
    state.data=ok?json:null;
    state.status=ok?(Object.keys(json.studies).length?'ok':'empty'):'error';
    if(!ok)state.error='Plik bazy badań ma niepoprawny format.';
    resultCache.clear();
  }
  function rerender(){if(typeof root.renderProgressAcademy==='function')root.renderProgressAcademy();}

  function categoryChips(){
    const cats=(state.data&&state.data.categories)||[];
    return `<div class="research-chips" role="group" aria-label="Kategorie badań"><button type="button" class="academy-chip${state.category==='all'?' is-active':''}" aria-pressed="${state.category==='all'}" onclick="academyResearchCategory('all')">Wszystkie</button>${cats.map(c=>`<button type="button" class="academy-chip${state.category===c.id?' is-active':''}" aria-pressed="${state.category===c.id}" onclick='academyResearchCategory(${esc(JSON.stringify(c.id))})'>${esc(c.label)}</button>`).join('')}</div>`;
  }
  function questionList(){
    const qs=((state.data&&state.data.questions)||[]).filter(q=>state.category==='all'||q.category===state.category);
    const list=state.category==='all'?qs.filter((q,i)=>qs.findIndex(x=>x.category===q.category)===i):qs;
    return `<div class="academy-examples research-examples"><b>${state.category==='all'?'Przykładowe pytania z każdej kategorii':'Opracowane pytania w tej kategorii'}</b><div>${list.map(q=>`<button type="button" class="academy-chip" onclick='academyResearchAsk(${esc(JSON.stringify(q.q))})'>${esc(q.q)}${q.answer?'':' <span class="research-chip-note">(tylko karty)</span>'}</button>`).join('')}</div></div>`;
  }
  function sortBar(res){
    return `<div class="research-toolbar"><div class="research-sort" role="group" aria-label="Sortowanie">Sortuj: ${SORTS.map(([k,l])=>`<button type="button" class="research-sort-btn${state.sort===k?' is-active':''}" aria-pressed="${state.sort===k}" onclick="academyResearchSort('${k}')">${l}</button>`).join('')}</div><span class="research-count">${res.studies.length} z ${res.total} pasujących${res.total>res.studies.length&&state.limit<5?` · <button type="button" class="research-link-btn" onclick="academyResearchMore()">pokaż 5</button>`:''}</span></div>`;
  }

  function statusBox(){
    if(state.status==='idle'||state.status==='loading')return '<div class="research-state" role="status" aria-live="polite"><span class="research-spinner" aria-hidden="true"></span> Wczytuję bazę badań…</div>';
    if(state.status==='error')return `<div class="research-state research-state-error" role="alert"><b>Źródło chwilowo niedostępne.</b> ${esc(state.error)} Pozostałe zakładki Academy działają normalnie. <button type="button" class="btn btn-ghost btn-sm" onclick="academyResearchReload()">Spróbuj ponownie</button></div>`;
    if(state.status==='empty')return '<div class="research-state">Baza badań jest jeszcze budowana na serwerze (PubMed, Europe PMC, Crossref). Zajrzyj tu za chwilę.</div>';
    return '';
  }

  /* ── Status, notatka i wniosek trenera przy zapisanym badaniu ── */
  const RESEARCH_STATUS=[['do_przeczytania','Do przeczytania'],['przeczytane','Przeczytane'],['do_sprawdzenia','Do sprawdzenia'],['wykorzystane','Wykorzystane w Academy']];
  const statusLabel=k=>(RESEARCH_STATUS.find(x=>x[0]===k)||[,'Do przeczytania'])[1];
  function trainerBlock(e){
    const id=esc(JSON.stringify(String(e.id)));
    const chips=`<div class="research-status" role="group" aria-label="Status badania">${RESEARCH_STATUS.map(([k,l])=>`<button type="button" class="research-sort-btn${(e.researchStatus||'do_przeczytania')===k?' is-active':''}" aria-pressed="${(e.researchStatus||'do_przeczytania')===k}" onclick='academyResearchSetStatus(${id},${esc(JSON.stringify(k))})'>${l}</button>`).join('')}</div>`;
    if(state.editing===e.id)return `<form class="research-note-form" onsubmit='academyResearchSaveNote(event,${id})'>${chips}<label class="form-lbl" for="research-note-${esc(e.id)}">Moja notatka</label><textarea id="research-note-${esc(e.id)}" class="form-textarea" rows="3" maxlength="3000" placeholder="Co warto zapamiętać, pytania do sprawdzenia w pełnym tekście.">${esc(e.trainerNote||'')}</textarea><label class="form-lbl" for="research-concl-${esc(e.id)}">Mój wniosek dla klientów</label><textarea id="research-concl-${esc(e.id)}" class="form-textarea" rows="2" maxlength="1500" placeholder="Jak to zmieni moją pracę (albo dlaczego nie zmieni).">${esc(e.trainerConclusion||'')}</textarea><div class="research-note-actions"><button class="btn btn-primary btn-sm" type="submit">Zapisz notatkę</button><button class="btn btn-ghost btn-sm" type="button" onclick="academyResearchEdit('')">Anuluj</button></div></form>`;
    return `<div class="research-trainer">${chips}${e.trainerNote?`<p><b>Moja notatka:</b> ${esc(e.trainerNote)}</p>`:''}${e.trainerConclusion?`<p><b>Mój wniosek:</b> ${esc(e.trainerConclusion)}</p>`:''}<button type="button" class="research-link-btn" onclick='academyResearchEdit(${id})'>${e.trainerNote||e.trainerConclusion?'Edytuj notatkę i wniosek':'+ Dodaj notatkę i własny wniosek'}</button></div>`;
  }
  async function updateEntry(id,patch){
    const list=root.KB||[];
    const i=list.findIndex(k=>k&&k.id===id);
    if(i<0)return null;
    if(!root._db||typeof root.persistById!=='function'){notifySafe('Zaloguj się i sprawdź połączenie, aby zapisać zmiany');return null;}
    const next={...list[i],...patch,updatedAt:new Date().toISOString()};
    let saved=null;
    try{saved=await root.persistById('kb',next);}catch(e){saved=null;}
    if(!saved){notifySafe('Nie udało się zapisać — spróbuj ponownie');return null;}
    list[i]=saved;
    rerender();
    return saved;
  }

  /* ── Nowe badania: publikacje z ostatnich 12 miesięcy w kategoriach ── */
  function recentStudies(data,category,now){
    const year=(now||new Date()).getFullYear();
    const seen=new Set(),out=[];
    Object.keys(data.recent||{}).forEach(cat=>{
      if(category!=='all'&&cat!==category)return;
      (data.recent[cat]||[]).forEach(id=>{const s=data.studies[id];if(s&&!seen.has(id)&&Number(s.year)>=year-1){seen.add(id);out.push(s);}});
    });
    return out.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||qualityScore(b)-qualityScore(a));
  }
  function newView(){
    const list=recentStudies(state.data,state.category);
    const labels=Object.fromEntries((state.data.categories||[]).map(c=>[c.id,c.label]));
    const cards=list.slice(0,state.category==='all'?12:8).map(s=>renderCard(s,'').replace('<h3>',`<div class="research-cats">${(s.categories||[]).map(c=>labels[c]?`<span>${esc(labels[c])}</span>`:'').join('')}</div><h3>`)).join('');
    return `<div class="research-sub-intro">Publikacje z ostatnich 12 miesięcy (metaanalizy, przeglądy, stanowiska, RCT), przypisane do kategorii. Zapisz badanie do „Do przeczytania”, dodaj notatkę i własny wniosek, a potem oznacz je jako przeczytane, do sprawdzenia albo wykorzystane w Academy.</div>${categoryChips()}${list.length?`<div class="research-cards">${cards}</div>`:'<div class="research-state">Brak nowych publikacji w tej kategorii w ostatnich 12 miesiącach.</div>'}`;
  }

  /* ── Zapisane źródła: książki, notatki, badania i własne wnioski trenera ── */
  const SAVED_TYPES=[['all','Wszystkie'],['ksiazka','Moje książki'],['notatka','Moje notatki'],['badanie','Zapisane badania'],['wniosek','Moje wnioski']];
  function entryType(k){return k.academyBook?'ksiazka':k.kind==='evidence'?'badanie':'notatka';}
  function reliabilityLabel(k){
    const t=entryType(k);
    if(t==='badanie')return CERTAINTY_LABEL[k.reliability]||'Pewność nieoceniona — przeczytaj źródło';
    if(t==='ksiazka')return 'Książka — sprawdź wydanie i autora';
    return 'Własna notatka — niezweryfikowana';
  }
  function anyHttps(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.href:'';}catch(e){return '';}}
  function savedEntries(){
    const f=state.saved;
    return (root.KB||[]).filter(k=>k&&k.title&&!k.builtinId).filter(k=>{
      const t=entryType(k);
      if(f.type==='wniosek'){if(!k.trainerConclusion)return false;}
      else if(f.type!=='all'&&t!==f.type)return false;
      if(f.category!=='all'&&!(k.topics||[]).includes(f.category))return false;
      if(f.status!=='all'&&(t!=='badanie'||(k.researchStatus||'do_przeczytania')!==f.status))return false;
      return true;
    }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }
  function savedRow(k){
    const t=entryType(k);
    const labels=Object.fromEntries(((state.data&&state.data.categories)||[]).map(c=>[c.id,c.label]));
    const href=t==='badanie'?safeHref(k.sourceUrl):anyHttps(k.sourceUrl);
    const date=k.createdAt?new Date(k.createdAt).toLocaleDateString('pl-PL'):'—';
    const tags=(k.topics||[]).map(c=>labels[c]).filter(Boolean).concat((k.tags||[]).filter(x=>typeof x==='string').slice(0,3));
    const idArg=esc(JSON.stringify(String(k.id||'')));
    return `<article class="research-saved-row research-type-${t}">
      <div class="research-card-pills"><span class="research-pill">${esc({ksiazka:'Książka',notatka:'Notatka',badanie:'Badanie'}[t])}</span>${t==='badanie'?`<span class="research-pill">${esc(statusLabel(k.researchStatus))}</span>`:''}<span class="research-pill research-cert-${esc(k.reliability||'brak')}">${esc(reliabilityLabel(k))}</span></div>
      <h3>${esc(k.title)}</h3>
      <div class="research-meta">${esc(k.citation||[k.bookAuthor].filter(Boolean).join(' ')||'Bez opisu źródła')} · dodano ${esc(date)}</div>
      ${tags.length?`<div class="research-cats">${tags.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
      ${t!=='badanie'&&k.text?`<p class="research-saved-text">${esc(String(k.text).slice(0,220))}${String(k.text).length>220?'…':''}</p>`:''}
      ${t==='badanie'?trainerBlock(k):(k.trainerConclusion?`<p class="research-saved-text"><b>Mój wniosek:</b> ${esc(k.trainerConclusion)}</p>`:'')}
      <div class="research-actions">${href?linkHtml({label:t==='badanie'?'Źródło':'Link',href}):''}${t==='ksiazka'?`<button type="button" class="btn btn-ghost btn-sm" onclick='academyLearnBook(${idArg})'>Ucz się z notatek</button>`:''}</div>
    </article>`;
  }
  function savedView(){
    const f=state.saved;
    const list=savedEntries();
    const cats=(state.data&&state.data.categories)||[];
    const chip=(group,k,l)=>`<button type="button" class="academy-chip${f[group]===k?' is-active':''}" aria-pressed="${f[group]===k}" onclick='academyResearchSavedFilter(${esc(JSON.stringify(group))},${esc(JSON.stringify(k))})'>${esc(l)}</button>`;
    return `<div class="research-sub-intro">Wszystko, na czym opierasz decyzje: własne książki, notatki, zapisane badania i własne wnioski. Dane są prywatne (Twoja Baza wiedzy) i nie zawierają danych klientów.</div>
      <div class="research-chips" role="group" aria-label="Rodzaj źródła">${SAVED_TYPES.map(([k,l])=>chip('type',k,l)).join('')}</div>
      <div class="research-chips" role="group" aria-label="Kategoria">${chip('category','all','Każda kategoria')}${cats.map(c=>chip('category',c.id,c.label)).join('')}</div>
      ${f.type==='badanie'||f.type==='all'?`<div class="research-chips" role="group" aria-label="Status badania">${chip('status','all','Każdy status')}${RESEARCH_STATUS.map(([k,l])=>chip('status',k,l)).join('')}</div>`:''}
      ${list.length?`<div class="research-cards">${list.map(savedRow).join('')}</div>`:'<div class="research-state">Brak źródeł dla tego filtra. Zapisz badanie z wyszukiwania lub z „Nowych badań”, a książki dodasz w zakładce „Moje książki”.</div>'}`;
  }

  /* ── Odpowiedź AI dla pytania spoza opracowanych (proxy aplikacji, bez kluczy w przeglądarce) ── */
  const AI_CACHE_KEY='pl_research_ai_v2';
  const AI_TTL_MS=7*24*3600*1000;
  const aiMemory=new Map();
  function strHash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36);}
  function aiCacheGet(key){
    if(aiMemory.has(key))return aiMemory.get(key);
    try{const all=JSON.parse(root.localStorage.getItem(AI_CACHE_KEY)||'{}');const hit=all[key];if(hit&&Date.now()-hit.at<AI_TTL_MS){aiMemory.set(key,hit.answer);return hit.answer;}}catch(e){}
    return null;
  }
  function aiCacheSet(key,answer){
    aiMemory.set(key,answer);
    try{const all=JSON.parse(root.localStorage.getItem(AI_CACHE_KEY)||'{}');all[key]={at:Date.now(),answer};const keys=Object.keys(all).sort((a,b)=>all[b].at-all[a].at).slice(0,40);const keep={};keys.forEach(k=>keep[k]=all[k]);root.localStorage.setItem(AI_CACHE_KEY,JSON.stringify(keep));}catch(e){}
  }
  function proxyUrl(){try{if(typeof W==='string'&&W)return W;}catch(e){}return 'https://anthropic-proxy.teamprogress2018.workers.dev/';}
  /** Samokontrola odpowiedzi na żywo: drugi przebieg AI ocenia każde zdanie; błąd kontroli nie blokuje odpowiedzi. */
  async function verifyLive(RA,answer,studies,books){
    if(!answer)return answer;
    const v=RA.buildVerifyPrompt(answer,studies,books);
    const ctrl=typeof AbortController==='function'?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),30000):null;
    try{
      const r=await root.fetch(proxyUrl(),{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl?ctrl.signal:undefined,body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,system:RA.VERIFY_SYSTEM,messages:[{role:'user',content:v.prompt}]})});
      if(!r.ok)return Object.assign(answer,{sprawdzone:false});
      const data=await r.json();
      return RA.applyVerification(answer,(data.content||[]).map(b=>b&&b.type==='text'?b.text:'').join(''),v.items);
    }catch(e){return Object.assign(answer,{sprawdzone:false});}
    finally{if(timer)clearTimeout(timer);}
  }
  async function aiAnswer(question,studies){
    const RA=root.ResearchAnswer;
    if(!RA)throw new Error('Moduł odpowiedzi nie jest wczytany.');
    const usable=studies.filter(s=>s&&s.synth);
    if(!usable.length)throw new Error('Karty nie mają opracowania — AI nie ma na czym oprzeć odpowiedzi.');
    const key=strHash(norm(question).trim()+'|'+usable.map(s=>s.pmid+(s.synthAt||'')).join(','));
    const cached=aiCacheGet(key);
    if(cached)return cached;
    if(typeof root.booksKbLoad==='function'){try{await root.booksKbLoad();}catch(e){}}
    const cat=(classify(question,state.data.categories)[0]||{}).id;
    const books=typeof root.booksKbSelect==='function'?(root.booksKbSelect({mode:cat==='zywienie'?'nutrition':'training',query:question,maxChars:2600,perBook:2})||[]).slice(0,4):[];
    const studyKeys=usable.map((_,i)=>'S'+(i+1)),bookKeys=books.map((_,i)=>'K'+(i+1));
    const ctrl=typeof AbortController==='function'?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),45000):null;
    let r;
    try{
      r=await root.fetch(proxyUrl(),{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl?ctrl.signal:undefined,body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2600,system:RA.ANSWER_SYSTEM,messages:[{role:'user',content:RA.buildAnswerPrompt(question,'',usable,books)}]})});
    }catch(e){throw new Error(e&&e.name==='AbortError'?'AI nie odpowiedziało w czasie.':'Brak połączenia z AI.');}
    finally{if(timer)clearTimeout(timer);}
    if(r.status===429)throw new Error('Limit zapytań AI na dziś — spróbuj później.');
    if(r.status===401||r.status===403)throw new Error('Zaloguj się ponownie, aby korzystać z AI.');
    if(!r.ok)throw new Error('AI chwilowo niedostępne.');
    const data=await r.json();
    const text=(data.content||[]).map(b=>b&&b.type==='text'?b.text:'').join('');
    const answer=RA.capAnswerCertainty(await verifyLive(RA,RA.validateAnswer(text,studyKeys,bookKeys),usable,books),Object.fromEntries(usable.map((s,i)=>[studyKeys[i],s])));
    if(!answer)throw new Error('AI nie oparło odpowiedzi na źródłach, więc jej nie pokazujemy. Skorzystaj z kart poniżej.');
    answer.sources={S:usable.map(s=>s.pmid),K:books.map(b=>({cite:b.cite,status:b.status,text:String(b.text||'').slice(0,400)}))};
    answer.live=true;
    aiCacheSet(key,answer);
    return answer;
  }
  async function runAi(){
    const q=state.query;
    if(!q||state.ai.status==='loading')return;
    if(mentionsClient(q))return;
    const res=search(state.data,q,{category:state.category,sort:'relevance',limit:5});
    state.ai={status:'loading',question:q,answer:null,error:''};rerender();
    try{
      const answer=await aiAnswer(q,res.studies);
      if(state.query!==q)return;
      state.ai={status:'ok',question:q,answer,error:''};
    }catch(e){
      if(state.query!==q)return;
      state.ai={status:'error',question:q,answer:null,error:e.message||'AI chwilowo niedostępne.'};
    }
    rerender();
  }
  function aiBlock(){
    const a=state.ai;
    if(a.question===state.query&&a.status==='loading')return '<div class="research-state" role="status" aria-live="polite"><span class="research-spinner" aria-hidden="true"></span> Opracowuję odpowiedź z kart badań i reguł z książek…</div>';
    if(a.question===state.query&&a.status==='error')return `<div class="research-state research-state-error" role="alert"><b>Odpowiedź AI niedostępna.</b> ${esc(a.error)} Karty badań poniżej działają normalnie. <button type="button" class="btn btn-ghost btn-sm" onclick="academyResearchAi()">Spróbuj ponownie</button></div>`;
    return `<div class="research-ai-cta"><button type="button" class="btn btn-primary btn-sm" onclick="academyResearchAi()">Opracuj pełną odpowiedź z tych badań</button><small>AI użyje tylko kart poniżej i reguł z Twoich książek; każde zdanie dostanie źródło.</small></div>`;
  }

  function subTabs(){
    const tabs=[['search','Szukaj'],['new','Nowe badania'],['saved','Zapisane źródła']];
    return `<div class="research-subtabs" role="tablist" aria-label="Badania">${tabs.map(([k,l])=>`<button type="button" role="tab" aria-selected="${state.sub===k}" class="research-subtab${state.sub===k?' is-active':''}" onclick="academyResearchSub('${k}')">${l}</button>`).join('')}</div>`;
  }

  function view(){
    if(state.status==='idle')load();
    const intro=`<div class="research-intro"><div><span class="academy-eyebrow">Baza badań</span><h2>Zadaj pytanie, zobacz najlepsze dowody i co z nich wynika dla klienta.</h2><p>Priorytet mają metaanalizy, przeglądy systematyczne i stanowiska organizacji, potem badania randomizowane. Pokazujemy najwyżej 5 publikacji. Karty powstają z abstraktów z PubMed — pełne teksty otwierasz w źródle.</p></div></div>`;
    const form=`<form class="academy-question research-question" onsubmit="academyResearchSubmit(event)"><label class="form-lbl" for="academy-research-q">Pytanie</label><div><input id="academy-research-q" class="form-input" maxlength="300" autocomplete="off" value="${esc(state.query)}" placeholder="np. Czy trening do upadku jest konieczny?"><button class="btn btn-primary" type="submit">Szukaj</button></div><small class="academy-help">Pytaj ogólnie (np. „kobieta 45 lat z nadwagą”), bez imion i danych zdrowotnych klientów — moduł badań ich nie zapisuje.</small></form>`;
    const box=statusBox();
    if(state.sub==='saved')return `<section class="research">${intro}${subTabs()}${savedView()}</section>`;
    if(box)return `<section class="research">${intro}${subTabs()}${state.sub==='search'?form:''}${box}</section>`;
    if(state.sub==='new')return `<section class="research">${intro}${subTabs()}${newView()}</section>`;
    const meta=`<div class="research-updated">Baza: ${Object.keys(state.data.studies).length} publikacji · aktualizacja ${esc(new Date(state.data.generatedAt).toLocaleDateString('pl-PL'))}${state.data.sources&&state.data.sources.pubmed!=='ok'?' · część źródeł była chwilowo niedostępna':''}</div>`;
    let content='';
    if(state.warning)content=`<div class="research-state research-state-warn" role="alert">${esc(state.warning)}</div>`;
    else if(!state.query)content=questionList()+(state.category!=='all'?resultsBlock(search(state.data,'',{category:state.category,sort:state.sort,limit:state.limit})):'');
    else content=resultsBlock(search(state.data,state.query,{category:state.category,sort:state.sort,limit:state.limit}));
    return `<section class="research">${intro}${subTabs()}${form}${categoryChips()}${meta}${content}</section>`;
  }

  function resultsBlock(res){
    const topCats=res.categories.filter(c=>c.score===res.categories[0].score).slice(0,2);
    const catLabel=topCats.length?`<div class="research-detected">Rozpoznana kategoria: ${topCats.map(c=>`<b>${esc(c.label)}</b>`).join(', ')}</div>`:'';
    if(!res.studies.length){
      return catLabel+`<div class="research-state">Brak wyników w bazie badań dla tego pytania.${res.suggestions.length?' Może chodziło o:':' Spróbuj innych słów albo wybierz kategorię.'}</div>${res.suggestions.length?`<div class="academy-examples research-examples"><div>${res.suggestions.map(q=>`<button type="button" class="academy-chip" onclick='academyResearchAsk(${esc(JSON.stringify(q.q))})'>${esc(q.q)}</button>`).join('')}</div></div>`:''}`;
    }
    const studies=state.data.studies;
    let answer='';
    let keys;
    const live=!res.matched&&state.ai.status==='ok'&&state.ai.question===state.query?state.ai.answer:null;
    const given=res.matched&&res.matched.answer||live;
    if(given){
      const src=given.sources&&given.sources.S||[];
      /* Karty pod odpowiedzią mają te same klucze S1… co odpowiedź. */
      const ordered=src.map(id=>studies[id]).filter(Boolean);
      const shown=sortStudies(ordered.map(s=>({study:s,score:0})),state.sort).slice(0,state.limit).map(x=>x.study);
      keys=new Map(src.map((id,i)=>[id,'S'+(i+1)]));
      answer=(live?`<div class="research-matched">Odpowiedź opracowana teraz przez AI wyłącznie z kart poniżej i reguł z książek — sprawdź źródła.</div>`:`<div class="research-matched">Opracowane pytanie: <b>${esc(res.matched.q)}</b></div>`)+renderAnswer(given,studies);
      res={...res,studies:shown,total:ordered.length};
    }else{
      keys=new Map(res.studies.map((s,i)=>[s.pmid,'S'+(i+1)]));
      answer=cardsSummary(res.studies)+aiBlock();
    }
    const sugg=!res.matched&&res.suggestions.length?`<div class="academy-examples research-examples"><b>Podobne opracowane pytania</b><div>${res.suggestions.map(q=>`<button type="button" class="academy-chip" onclick='academyResearchAsk(${esc(JSON.stringify(q.q))})'>${esc(q.q)}</button>`).join('')}</div></div>`:'';
    return catLabel+answer+sugg+sortBar(res)+`<div class="research-cards">${res.studies.map(s=>renderCard(s,keys.get(s.pmid))).join('')}</div>`;
  }

  /** Zapis badania do prywatnej Bazy wiedzy (kolekcja kb, ten sam model co „Nowe badania”). */
  function entryFromStudy(s,status){
    const y=s.synth||{};
    const text=y.coZbadano?[y.coZbadano,y.coZnaleziono,y.dlaTrenera?'Dla trenera: '+y.dlaTrenera:'',y.czegoNieDowodzi?'Czego nie dowodzi: '+y.czegoNieDowodzi:''].filter(Boolean).join('\n'):'Brak abstraktu w PubMed — przeczytaj źródło.';
    const links=studyLinks(s);
    return {
      id:(typeof root.newId==='function'?root.newId('kb'):'kb_'+Date.now().toString(36)),kind:'evidence',academyResearch:true,
      title:y.titlePl||s.title,text,citation:[s.authors,s.year?'('+s.year+')':'',s.journalAbbr||s.journal,'· '+(EVIDENCE_LABEL[s.evidence]||'')].filter(Boolean).join(' '),
      sourceUrl:(links.find(l=>l.label==='DOI')||links[0]||{}).href||'',pmid:String(s.pmid||''),doi:s.doi||'',topics:s.categories||[],evidenceLevel:s.evidence||'',
      originalTitle:s.title,year:String(s.year||''),journal:s.journal||'',authors:s.authors||'',
      researchStatus:status||'do_przeczytania',reliability:y.pewnosc||'nieoceniona',trainerNote:'',trainerConclusion:'',useInPlanning:false,tags:[],
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
  }
  async function saveStudy(pmid){
    const s=state.data&&state.data.studies[String(pmid)];
    if(!s)return null;
    if(savedEntry(s)){notifySafe('To badanie jest już w Twoich źródłach');return savedEntry(s);}
    if(!root._db||typeof root.persistById!=='function'){notifySafe('Zaloguj się i sprawdź połączenie, aby zapisać badanie');return null;}
    state.saving[s.pmid]=true;rerender();
    let saved=null;
    try{saved=await root.persistById('kb',typeof root.withTrainer==='function'?root.withTrainer(entryFromStudy(s)):entryFromStudy(s));}catch(e){saved=null;}
    delete state.saving[s.pmid];
    if(!saved){notifySafe('Nie udało się zapisać badania — spróbuj ponownie');rerender();return null;}
    root.KB=root.KB||[];root.KB.push(saved);
    notifySafe('✓ Zapisano w „Do przeczytania”');
    rerender();
    return saved;
  }
  function notifySafe(m){if(typeof root.notify==='function')root.notify(m);}

  function ask(q){
    state.query=String(q||'').trim().slice(0,300);state.limit=3;state.warning='';state.sub='search';
    if(state.query&&mentionsClient(state.query)){state.warning='Pytanie zawiera imię i nazwisko klienta. Moduł badań nie przyjmuje danych klientów — zapytaj ogólnie, np. „mężczyzna 50 lat po przerwie w treningu”.';state.query='';}
    rerender();
  }

  root.academyResearchView=view;
  root.academyResearchSubmit=e=>{if(e&&e.preventDefault)e.preventDefault();ask((root.document.getElementById('academy-research-q')||{}).value||'');};
  root.academyResearchAsk=q=>ask(q);
  root.academyResearchCategory=c=>{state.category=c||'all';state.limit=3;rerender();};
  root.academyResearchSort=s=>{state.sort=SORTS.some(x=>x[0]===s)?s:'quality';rerender();};
  root.academyResearchMore=()=>{state.limit=5;rerender();};
  root.academyResearchCompare=()=>{state.compare=!state.compare;rerender();};
  root.academyResearchReload=()=>load(true);
  root.academyResearchSave=pmid=>saveStudy(pmid);
  root.academyResearchSub=k=>{state.sub=['search','new','saved'].includes(k)?k:'search';state.editing='';if(state.sub==='saved'&&typeof root.booksKbLoad==='function'){try{root.booksKbLoad();}catch(e){}}rerender();};
  root.academyResearchAi=()=>runAi();
  root.academyResearchEdit=id=>{state.editing=id||'';rerender();};
  root.academyResearchSetStatus=(id,status)=>updateEntry(id,{researchStatus:RESEARCH_STATUS.some(x=>x[0]===status)?status:'do_przeczytania'});
  root.academyResearchSaveNote=async(e,id)=>{
    if(e&&e.preventDefault)e.preventDefault();
    const val=x=>String(((root.document.getElementById(x)||{}).value)||'').trim();
    const saved=await updateEntry(id,{trainerNote:val('research-note-'+id).slice(0,3000),trainerConclusion:val('research-concl-'+id).slice(0,1500)});
    if(saved){state.editing='';notifySafe('✓ Notatka zapisana');rerender();}
  };
  root.academyResearchSavedFilter=(group,v)=>{if(['type','category','status'].includes(group)){state.saved[group]=v||'all';rerender();}};
  root.ResearchAcademy={classify,search,matchQuestions,safeHref,studyLinks,renderCard,renderAnswer,refsHtml,setData,load,saveStudy,entryFromStudy,mentionsClient,recentStudies,savedEntries,updateEntry,aiAnswer,state,_cache:resultCache,_aiMemory:aiMemory};
})(typeof window!=='undefined'?window:globalThis);
