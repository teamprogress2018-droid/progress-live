#!/usr/bin/env node
/** Progress Academy: pełne reguły z książek i blok „Najpierw bezpieczeństwo” przy pytaniach o zdrowie. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

const screen={innerHTML:''};
const inputs={};
const ctx={console,URL,setTimeout,notify(){},goTo(){}};
ctx.window=ctx;
ctx.document={getElementById:id=>id==='screen-academy'?screen:(inputs[id]||null),querySelectorAll:()=>[]};
vm.createContext(ctx);
vm.runInContext(read('books-kb.js'),ctx);
ctx.booksKbSetData(JSON.parse(read('knowledge/books-index.json')));
const ex=read('06-inbox-exercises-ai-programs.js');
const exStart=ex.indexOf('const DEF_EX=[');
vm.runInContext(ex.slice(exStart,ex.indexOf('\n];',exStart)+3).replace('const DEF_EX','window.DEF_EX'),ctx);
vm.runInContext(read('11-progress-academy.js'),ctx);

const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');
function ask(q){
  ctx.academySetLevel('learn');
  inputs['academy-question']={value:q};
  ctx.academyAskBooks({preventDefault(){}});
  return screen.innerHTML;
}
function learnNote(noteText){
  ctx.KB=[{id:'kb_t1',academyBook:true,title:'Notatka testowa',bookAuthor:'',text:noteText,useInLearning:true}];
  ctx.academyLearnBook('kb_t1');
  const html=screen.innerHTML;
  ctx.KB=[];
  ctx.academyClearSelectedBook();
  return html;
}
function section(html,label){
  const m=html.match(new RegExp('<b>'+label+'</b><p>([\\s\\S]*?)</p>'));
  return m?text(m[1]):'';
}

/* 1. Reguła nie jest ucinana na pierwszym średniku. */
const valsalva=learnNote('trigger: wstrzymywanie oddechu; action: Valsalva tylko krótko; >2–4 s → zawroty i omdlenie; przy chorobach serca, nadciśnieniu, po udarze – unikaj; priority: warning');
const action=section(valsalva,'Sedno zasady');
ok('action keeps text after semicolons',/Valsalva tylko krótko/i.test(action)&&/po udarze – unikaj/.test(action));
ok('priority is not shown as part of action',!/priority/.test(action));
ok('warning rule is labelled as safety rule',/academy-learning-card is-safety/.test(valsalva)&&/reguła bezpieczeństwa/.test(valsalva));
ok('safety rule has no reassuring template',!/To nie jest zasada „zawsze”/.test(valsalva)&&/To reguła bezpieczeństwa/.test(valsalva));

/* 2. Puste pola z bazy (brak_w_zrodle) nie wyglądają jak „brak przeciwwskazań”. */
const empty=learnNote('goal: zdrowie; contraindications: {}; rule: Trening 2–3× w tygodniu całego ciała.');
ok('empty field hidden in card and raw source',!/contraindications: \{\}/.test(text(empty)));
ok('rule still shown',/Trening 2–3× w tygodniu całego ciała/.test(section(empty,'Sedno zasady')));

/* 3. Ból: czerwone flagi, skierowanie, bez progresji obciążenia i bez listy ćwiczeń. */
const knee=ask('ból kolana przysiad');
ok('pain shows safety block',/Najpierw bezpieczeństwo/.test(knee)&&/skieruj do lekarza/.test(knee)&&/fizjoterapeuty/.test(knee));
ok('pain hides exercise example',!/Przykład doboru ćwiczeń/.test(knee));
ok('pain hides load progression',!/\+2,5 kg/.test(text(knee))&&!/\+5 kg/.test(text(ask('ból pleców martwy ciąg'))));

/* 4. Ciąża: objawy przerwania treningu i tylko karty o ciąży. */
const preg=ask('ciąża trening');
ok('pregnancy shows warning signs',/krwawienie z dróg rodnych/.test(preg)&&/zgody lekarza/.test(preg));
const cards=preg.split('<article class="academy-learning-card').slice(1);
ok('pregnancy cards mention pregnancy',cards.length>0&&cards.every(c=>/ciąż/i.test(c)));

/* 5. Choroby i RED-S. */
const bp=ask('nadciśnienie');
ok('hypertension shows termination threshold',/220 mmHg/.test(bp)&&/105 mmHg/.test(bp));
ok('diabetes shows hypoglycemia procedure',/70 mg\/dl/.test(ask('cukrzyca')));
ok('missing period shows RED-S referral',/RED-S/.test(ask('brak miesiączki'))&&/dietetykiem/.test(ask('brak miesiączki')));

/* 6. Zwykłe pytanie treningowe bez bloku bezpieczeństwa. */
const chest=ask('hipertrofia klatki');
ok('training question has no safety block',!/Najpierw bezpieczeństwo/.test(chest)&&/academy-learning-card/.test(chest));
ok('word inside another word does not trigger pregnancy',!/Najpierw bezpieczeństwo/.test(ask('progresja obciążenia')));

/* 7. Karta nauki (pakiet C): bez ogólnej formułki, uczciwe „Dlaczego”, statusy po polsku, poprawni autorzy. */
const paired=learnNote('trigger: klient zgłasza spadek siły trzy sesje z rzędu; action: Zrób tydzień lżejszy: połowa serii przy podobnym ciężarze.; appliesTo: średniozaawansowani');
ok('paired rule shows condition and action as core',/Gdy klient zgłasza spadek siły trzy sesje z rzędu – zrób tydzień lżejszy/.test(section(paired,'Sedno zasady')));
ok('no generic placeholder',!/Dopasuj decyzję do warunku klienta/.test(paired));
ok('generic category replaced by condition in title',/<h3>Klient zgłasza spadek siły/.test(paired));
ok('for whom shown',/średniozaawansowani/.test(section(paired,'Dla kogo')));
ok('recall question has answer',/<details class="academy-recall"><summary><b>Pytanie sprawdzające<\/b>Co robisz, gdy klient zgłasza/.test(paired)&&/połowa serii/.test(paired.split('academy-recall')[1]||''));
ok('honest why when note has none',/Notatka nie podaje uzasadnienia/.test(section(paired,'Dlaczego')));
const kneeCard=ask('objętość treningowa hipertrofia');
ok('book status in Polish',!/<span>(zrodlo|wniosek|poza_zrodlem)<\/span>/.test(kneeCard)&&/<span>(reguła bezpieczeństwa · )?(z książki|wniosek z książki|reguła ostrożności Progress Live)<\/span>/.test(kneeCard));
const sel=ctx.booksKbSelect({mode:'training',query:'trening ciąża',safetyQuery:'ciąża',maxChars:20000,perBook:10});
const nsca=sel.find(r=>r.book==='nsca-essentials-personal-training');
ok('NSCA cited as editors',!!nsca&&/^Schoenfeld, Snarr \(red\.\) — /.test(nsca.cite));
const outside=ctx.booksKbSelect({mode:'training',query:'nadciśnienie ciśnienie endoproteza',safetyQuery:'nadciśnienie ciśnienie endoproteza',maxChars:40000,perBook:20}).filter(r=>r.status==='poza_zrodlem');
ok('rule outside source has no page',outside.length>0&&outside.every(r=>/^Progress Live, reguła ostrożności/.test(r.cite)&&!/, s\. /.test(r.cite)));

/* 8. Wyszukiwanie i dobór ćwiczeń (pakiet D). */
const exBlock=html=>{const m=html.match(/Przykład doboru ćwiczeń: ([^<]+)<\/b>[\s\S]*?<\/ul>/);return m?m[0]:'';};
const chestEx=exBlock(chest);
ok('chest query lists chest exercises, not lats',/klatka piersiowa/.test(chestEx)&&!/najszersze/.test(chestEx)&&/Wyciskanie/.test(chestEx));
const backEx=exBlock(ask('hipertrofia pleców najszerszy'));
ok('back query prefers pulls',/Podciąganie|Ściąganie|Wiosłowanie/.test(backEx));
ok('biomechanics records are not cited as evidence',!/Biomechanika:/.test(chest));
ok('creatine searches nutrition books',/kreatyn/i.test(ask('kreatyna'))&&/Dietetyka sportowa/.test(ask('kreatyna')));
const none=ask('xyzqw');
ok('empty result explains what to type and offers examples',/Nie znalazłem w książkach z bazy/.test(none)&&/academyAskExample\(0\)/.test(none));
ctx.academyAskExample(2);
ok('example question runs a search',/Deload|deload/.test(screen.innerHTML)&&/academy-learning-card/.test(screen.innerHTML));

ctx.builderEduCtx=()=>({clientId:'c1',clientName:'Ania',goal:'masa',method:'PPL'});
ctx.GOAL_WHY={masa:{label:'Budowa masy (hipertrofia)'}};
ctx.buildMethodRationale=()=>({tips:['Sygnał 1','Sygnał 2','Sygnał 3']});
ctx.academySetLevel('context');
const plan=text(screen.innerHTML);
ok('my plan shows goal label and no null days',/Budowa masy \(hipertrofia\)/.test(plan)&&!/null/.test(plan)&&/Dni —/.test(plan));
ok('my plan shows several signals',/Sygnał 1/.test(plan)&&/Sygnał 3/.test(plan));

const css=read('styles.css');
ok('safety css present',css.includes('.academy-safety{')&&css.includes('.academy-learning-card.is-safety'));

if(failed){console.error('\n'+failed+' test(s) failed');process.exit(1);}
console.log('\nAll academy safety tests passed');
