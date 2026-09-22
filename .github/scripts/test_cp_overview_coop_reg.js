#!/usr/bin/env node
/** Etap 5 — pełna regresja Analizy współpracy (bramka, prompt, mock AI, cache). */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

function extract(src,name){
  const start=src.indexOf('function '+name);
  if(start<0)throw new Error('missing '+name);
  let i=start,depth=0,begun=false;
  for(;i<src.length;i++){
    if(src[i]==='{'){depth++;begun=true;}
    else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
  }
  return src.slice(start,i);
}

const root=path.join(__dirname,'../..');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github','workflows','check.yml'),'utf8');
const overview=src08.slice(src08.indexOf('function renderCPOverview'),src08.indexOf('function renderCPPlan'));
const sit=extract(src08,'cpOverviewSituationHTML');
const brief=extract(src08,'cpOverviewBriefHTML')+extract(src08,'collectCpBriefItems');
const coopStart=src08.indexOf('function cpCoopLoggedWorkouts');
const coopEnd=src08.indexOf('function renderCPOverview');
const coopSrc=src08.slice(coopStart,coopEnd);

let failed=0;
const rows=[];
function ok(name,cond,extra){
  if(!cond){
    console.error('FAIL',name,extra||'');
    failed++;
    rows.push({name,pass:false,extra:String(extra||'')});
  }else{
    console.log('OK  ',name);
    rows.push({name,pass:true,extra:''});
  }
}

const GOOD=`1. Interpretacja
Adherencja i słabszy check-in mogą oznaczać, że plan jest za ciężki.

2. Do rozważenia
- Dopytać o sen
- Rozważyć krótsze sesje
- Poczekać na pomiar siły

3. Sprawdź przed decyzją
- Czy klient ma czas na 4 dni?`;

function makeSandbox(){
  const sandbox={
    window:{CL:[],SE:[],PL:[],CHECKINS:{},CLIENT_NOTES:{},TASKS:[],METRIC_ENTRIES:[],PROGRESS_PHOTOS:[],_cpCoopCache:{},_cpCoopBusy:{},cpClientId:null},
    Date,Math,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
    Promise,Error,undefined,setTimeout,clearTimeout,
    todayYmd:()=>'2026-09-21',
    dashTodayYmd:()=>'2026-09-21',
    completedWorkouts:(id)=>(sandbox.window.SE||[]).filter(s=>s&&s.clientId===id&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework')),
    isLoggedWorkout:(s)=>s&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework'),
    clientAdherenceStats:(id)=>{
      const se=(sandbox.window.SE||[]).filter(s=>s&&s.clientId===id);
      const assigned=se.filter(s=>s.source==='planned').length;
      const logged=se.filter(s=>s.source==='live'||s.source==='client').length;
      const denom=assigned||logged;
      return{assigned,logged,pct:denom?Math.round(logged/denom*100):0};
    },
    cpMetricDeltaPct:(id,g,m)=>{
      const map=sandbox._deltas&&sandbox._deltas[id]||{};
      const key=g+'/'+m;
      return Object.prototype.hasOwnProperty.call(map,key)?map[key]:null;
    },
    cpSleepTrendFact:(id)=>(sandbox._sleep&&sandbox._sleep[id])||null,
    clientOpenHomework:(id)=>(sandbox.window.TASKS||[]).filter(t=>t&&t.clientId===id&&t.status!=='done'&&t.kind==='homework'),
    homeworkCompletions:(id)=>(sandbox._hwDone&&sandbox._hwDone[id])||[],
    ppListFor:(id)=>(sandbox.window.PROGRESS_PHOTOS||[]).filter(p=>p&&p.clientId===id),
    buildMonitorVerdict:(c)=>sandbox._mon||{verdict:'ryzyko stagnacji',verdictTone:'warn',score:-1,signals:[
      {tone:'bad',label:'Adherencja 30 dni',text:'48% (6/13).'},
      {tone:'warn',label:'Ostatni tydzień',text:'0 z 3.'},
      {tone:'neutral',label:'Masa ciała',text:'Za mało pomiarów masy (potrzeba ≥2).'},
      {tone:'good',label:'Check-in',text:'Samopoczucie ↑'}
    ],next:['Skróć objętość o ~20–30% na 7–10 dni i wróć do MEV.','Zmień plan na PPL.']},
    clientSituationSnapshot:(id)=>({clientId:id,facts:{
      adh7:{logged:0,assigned:0,pct:0},adh30:{logged:0,assigned:0,pct:0},
      lastWorkout:null,checkinStatus:'none',lastCheckin:null,
      mass:{value:null,deltaPct:null,date:''},sleep:{value:null,date:''},
      homework:{open:0,late:0}
    }}),
    latestClientPlan:(id)=>(sandbox.window.PL||[]).filter(p=>p&&p.clientId===id)[0]||null,
    clientSafetyContextForAI:()=>'',
    escHtml:(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    cpBriefTopLoads:(s)=>{
      const ex=(s&&s.exercises||[])[0];
      if(!ex)return[];
      const st=(ex.sets||[])[0];
      if(!st)return[];
      return[{name:ex.name,load:st.kg+' kg × '+st.reps}];
    },
    sessionTitle:(s)=>s.type||'Trening',
    persistById:(...a)=>{sandbox._persist.push(a);return a[1];},
    notify:()=>{},
    staffWorkerUrl:()=>'https://mock.invalid/ai',
    staffReplyText:(data)=>Array.isArray(data&&data.content)?data.content.map(b=>(b&&b.text)||'').join('\n').trim():'',
    _deltas:{},
    _sleep:{},
    _hwDone:{},
    _persist:[],
    _renders:0,
    _fetchN:0,
    _lastFetch:null
  };
  sandbox.renderCPOverview=(c)=>{sandbox._renders++;sandbox._lastHtml=sandbox.cpOverviewCoopHTML?sandbox.cpOverviewCoopHTML(c):'';};
  ['CL','SE','PL','CHECKINS','CLIENT_NOTES','TASKS','METRIC_ENTRIES'].forEach(k=>{
    sandbox[k]=sandbox.window[k];
  });
  sandbox.window.CL=sandbox.CL;
  sandbox.window.SE=sandbox.SE;
  sandbox.window.PL=sandbox.PL;
  sandbox.window.CHECKINS=sandbox.CHECKINS;
  sandbox.window.TASKS=sandbox.TASKS;
  sandbox.window.METRIC_ENTRIES=sandbox.METRIC_ENTRIES;
  sandbox.window.PROGRESS_PHOTOS=sandbox.window.PROGRESS_PHOTOS||[];
  sandbox.window.persistById=sandbox.persistById;
  vm.runInNewContext(coopSrc,sandbox);
  sandbox.window.cpCoopCacheGet=sandbox.cpCoopCacheGet;
  return sandbox;
}

ok('helpers exist',/function cpCoopCollectSignals\(c\)/.test(src08)&&/function runCpCoopAnalysis\(/.test(src08));
ok('overview order brief-sit-coop',overview.indexOf('cpOverviewBriefHTML(c)')<overview.indexOf('cpOverviewSituationHTML(c)')&&overview.indexOf('cpOverviewSituationHTML(c)')<overview.indexOf('cpOverviewCoopHTML(c)'));
ok('situation helper frozen',sit.includes('Na kolejny trening')&&sit.includes('cp-ov-situation')&&!sit.includes('runCpCoopAnalysis')&&!sit.includes('Przeanalizuj współpracę'));
ok('brief helper frozen',brief.includes('Przed treningiem')&&!brief.includes('Przeanalizuj współpracę')&&!brief.includes('runCpCoopAnalysis'));
ok('html helper no monitor.next',!/v\.next|monitor\.next/.test(extract(src08,'cpOverviewCoopHTML')));
ok('coop no persistById',!/persistById/.test(coopSrc));
ok('html helper no fetch',!/fetch\(/.test(extract(src08,'cpOverviewCoopHTML')));
ok('run has fetch',/await fetch\(/.test(extract(src08,'cpCoopRequestAnalysis')));
ok('busy guard',/if\(window\._cpCoopBusy\[id\]\)return/.test(extract(src08,'runCpCoopAnalysis')));
ok('gate before fetch',extract(src08,'cpCoopRequestAnalysis').indexOf('length<2')<extract(src08,'cpCoopRequestAnalysis').indexOf('await fetch'));
ok('run calls request helper',/cpCoopRequestAnalysis\(c\)/.test(extract(src08,'runCpCoopAnalysis')));
ok('ci files',wf.includes('test_cp_overview_coop.js')&&wf.includes('test_cp_overview_coop_reg.js')&&wf.includes('test_cp_overview_coop_ui.js'));
ok('cache pins',html.includes('08-client-profile-extras.js?v=71')&&html.includes('styles.css?v=104'));
ok('css card',css.includes('.cp-ov-coop')&&css.includes('.cp-ov-coop-err'));

const sb=makeSandbox();

const zero={id:'c-zero',name:'Nowy',goal:'sila',injuries:'',notes:'ukryte notes',phone:'500600700',email:'a@b.c',secret:'XYZ'};
sb.CL.push(zero);
sb.CHECKINS['c-zero']=[];
const g0=sb.cpCoopCollectSignals(zero);
ok('0 signals blocked',!g0.ok&&g0.found.length===0,JSON.stringify(g0));
const h0=sb.cpOverviewCoopHTML(zero);
ok('0 signals copy',/Za mało danych do analizy — potrzebne minimum 2 niezależne źródła/.test(h0)&&!/data-cp-coop-cta="run"/.test(h0)&&/data-cp-coop-cta="blocked"/.test(h0));
ok('0 signals blocked btn',/disabled/.test(h0));

const one={id:'c-one',name:'Ola',goal:'kondycja',injuries:''};
sb.CL.push(one);
sb.SE.push({id:'s-one',clientId:'c-one',date:'2026-09-18',source:'live',type:'Bieg'});
sb.CHECKINS['c-one']=[];
const g1=sb.cpCoopCollectSignals(one);
ok('1 signal is only training',g1.found.length===1&&g1.found[0].id==='training'&&!g1.ok,JSON.stringify(g1.found));
const h1=sb.cpOverviewCoopHTML(one);
ok('1 signal no CTA',/Za mało danych do analizy — potrzebne minimum 2 niezależne źródła/.test(h1)&&!/data-cp-coop-cta="run"/.test(h1)&&/data-cp-coop-cta="blocked"/.test(h1));

const pair={id:'c-pair',name:'Adam',goal:'sila',level:'sredni',injuries:'kolano',notes:'tajne notes',weight:82,height:180};
sb.CL.push(pair);
sb.SE.push({id:'s-pair',clientId:'c-pair',date:'2026-09-18',source:'live',type:'FBW A',feedback:4,
  exercises:[{name:'Przysiad',sets:[{kg:100,reps:5,kind:'work'}]}]});
sb.CHECKINS['c-pair']=[{id:'ci-pair',status:'filled',date:'2026-09-19',answers:{sleep:3,energy:2,stress:4,notes:'źle spałem'}}];
sb.PL.push({id:'pl-fat',clientId:'c-pair',name:'Siła FBW',method:'FBW',days:[
  {label:'A',exercises:[{name:'Wymyslone cwiczenie sekret',kg:999,reps:1}]},
  {label:'B',exercises:[{name:'Inne sekretne',sets:[{kg:777,reps:3}]}]}
]});
const g2=sb.cpCoopCollectSignals(pair);
ok('training+checkin no mass allowed',g2.ok&&g2.found.some(s=>s.id==='training')&&g2.found.some(s=>s.id==='checkin')&&!g2.found.some(s=>s.id==='body')&&!g2.found.some(s=>s.id==='adherence')&&g2.found.length===2,JSON.stringify(g2.found));
ok('sila missing mass not listed',!g2.missing.includes('dwa pomiary masy'));
const h2=sb.cpOverviewCoopHTML(pair);
ok('2 signals CTA',/Przeanalizuj współpracę/.test(h2)&&/data-cp-coop-cta="run"/.test(h2));
ok('idle no monitor.next orders',!/20–30%|Skróć objętość|Zmień plan na PPL/.test(h2));
ok('max 3 visible signals',((h2.match(/data-cp-coop-sig=/g)||[]).length<=3));
ok('coop not duplicating brief/next',!/Przed treningiem/.test(h2)&&!/Na kolejny trening/.test(h2));

const massOnly={id:'c-mass',name:'Ewa',goal:'masa',injuries:''};
sb.CL.push(massOnly);
sb.METRIC_ENTRIES.push(
  {clientId:'c-mass',groupId:'mg1',date:'2026-09-01',values:{m1:70}},
  {clientId:'c-mass',groupId:'mg1',date:'2026-09-18',values:{m1:71.2}}
);
sb.CHECKINS['c-mass']=[];
const gm=sb.cpCoopCollectSignals(massOnly);
ok('body metrics is one source',gm.found.length===1&&gm.found[0].id==='body'&&!gm.ok,JSON.stringify(gm.found));
ok('zero body value ignored',(()=>{
  const z={id:'c-zero-kg',name:'Zero',goal:'masa'};
  sb.CL.push(z);
  sb.METRIC_ENTRIES.push({clientId:'c-zero-kg',groupId:'mg1',date:'2026-09-01',values:{m1:0}});
  const gz=sb.cpCoopCollectSignals(z);
  return gz.found.length===0;
})());

const silaMass={id:'c-sm',name:'Bartek',goal:'sila',injuries:''};
sb.CL.push(silaMass);
sb.METRIC_ENTRIES.push({clientId:'c-sm',groupId:'mg1',date:'2026-09-01',values:{m1:80}});
sb.CHECKINS['c-sm']=[];
const gsm=sb.cpCoopCollectSignals(silaMass);
ok('sila body-only blocked',!gsm.ok&&gsm.found.filter(s=>s.id==='body').length===1);

const ctx=sb.cpCoopContextForAI(pair);
ok('ctx has DANE NIEOBECNE',/DANE NIEOBECNE:/.test(ctx)&&/SYGNAŁY OBECNE:/.test(ctx));
ok('ctx no monitor.next',!/Skróć objętość o ~20/.test(ctx)&&!/Zmień plan na PPL/.test(ctx)&&!/Jak zrobić, żeby było dobrze/.test(ctx));
ok('ctx no notes/phone/email/secret',!/tajne notes/.test(ctx)&&!/500600700/.test(ctx)&&!/a@b\.c/.test(ctx)&&!/XYZ/.test(ctx));
ok('ctx no full plan exercises',!/Wymyslone cwiczenie/.test(ctx)&&!/sekretne/.test(ctx)&&!/999/.test(ctx)&&!/777/.test(ctx));
ok('ctx no JSON dump of client',!/"phone"/.test(ctx)&&!/"id":"c-pair"/.test(ctx)&&!/"secret"/.test(ctx));
ok('ctx injuries field only',/Ograniczenia \(pole injuries\): kolano/.test(ctx));
ok('ctx checkin /5 not /10',/Sen 3\/5/.test(ctx)&&!/\/10/.test(ctx));
ok('ctx last load from session not invented',/Przysiad/.test(ctx)&&/100 kg/.test(ctx));
ok('ctx plan name only',/Plan: Siła FBW/.test(ctx)&&/metoda FBW/.test(ctx));
ok('ctx forbids extra numbers',/Nie wolno używać liczb, kg, procentów ani ćwiczeń, których nie ma powyżej/.test(ctx));
ok('ctx rating recorded',/Ocena ostatniego treningu: 4\/5/.test(ctx));

const jan={id:'c-jan',name:'Jan Kowalski',goal:'sila',weight:0,height:0,age:0,injuries:''};
sb.CL.push(jan);
sb.SE.push({id:'s-jan',clientId:'c-jan',date:'2026-09-18',source:'live',type:'FBW',feedback:0});
sb.CHECKINS['c-jan']=[{id:'ci-jan',status:'filled',date:'2026-09-19',answers:{sleep:0,energy:'',stress:4}}];
sb.clientSituationSnapshot=(id)=>{
  if(id==='c-jan')return{clientId:id,facts:{adh7:{logged:1,assigned:3,pct:33},adh30:{logged:1,assigned:4,pct:25},lastWorkout:{date:'2026-09-18',title:'FBW',source:'live',daysSince:3},checkinStatus:'done',lastCheckin:{date:'2026-09-19',daysSince:2},mass:{value:0,deltaPct:null,date:'2026-09-01'},sleep:{value:0,date:'2026-09-20'},homework:{open:0,late:0}}};
  return{clientId:id,facts:{adh7:{logged:0,assigned:0,pct:0},adh30:{logged:0,assigned:0,pct:0},lastWorkout:null,checkinStatus:'none',lastCheckin:null,mass:{value:null,deltaPct:null,date:''},sleep:{value:null,date:''},homework:{open:0,late:0}}};
};
const ctxJan=sb.cpCoopContextForAI(jan);
ok('jan rating brak not 0/5',/Ocena ostatniego treningu: brak \(nie 0\/5\)/.test(ctxJan)&&!/Ocena ostatniego treningu: 0\/5/.test(ctxJan));
ok('jan no 0 kg / 0 age',!/Waga \(karta\): 0/.test(ctxJan)&&!/Wzrost: 0/.test(ctxJan)&&!/Wiek: 0/.test(ctxJan));
ok('jan checkin 0 skipped',!/Sen 0\/5/.test(ctxJan)&&/Stres 4\/5/.test(ctxJan));
ok('jan mass 0 is brak',/Masa: value=brak/.test(ctxJan)&&/Sen \(pomiar\): value=brak/.test(ctxJan));

const mal={id:'c-mal',name:'Małgosia',goal:'kondycja',injuries:''};
sb.CL.push(mal);
sb.SE.push(
  {id:'s-mal-l',clientId:'c-mal',date:'2026-09-18',source:'live',type:'Bieg'},
  {id:'s-mal-p',clientId:'c-mal',date:'2026-09-22',source:'planned',type:'Interwał'}
);
sb.CHECKINS['c-mal']=[];
const gMal=sb.cpCoopCollectSignals(mal);
ok('malgosia training+plan blocked',!gMal.ok&&gMal.found.length===1&&gMal.found[0].id==='training'&&!gMal.found.some(s=>s.id==='adherence'),JSON.stringify(gMal.found));
sb.TASKS.push({id:'hw-open',clientId:'c-mal',kind:'homework',status:'open',title:'HIIT'});
ok('open homework not a source',!sb.cpCoopCollectSignals(mal).ok);
sb._hwDone['c-mal']=[{id:'hw-done',status:'done',kind:'homework',doneAt:'2026-09-18'}];
ok('completed homework unlocks',sb.cpCoopCollectSignals(mal).ok&&sb.cpCoopCollectSignals(mal).found.some(s=>s.id==='homework'));

sb.SE.push({id:'s-gar-only',clientId:'c-gar1',date:'2026-09-18',source:'garmin',type:'Bieg 8 km'});
sb.METRIC_ENTRIES.push({clientId:'c-gar1',groupId:'mg6',date:'2026-09-18',source:'garmin',values:{m1:8000}});
sb.CL.push({id:'c-gar1',name:'Garmin One',goal:'kondycja'});
ok('garmin alone blocked',!sb.cpCoopCollectSignals({id:'c-gar1',name:'G',goal:'kondycja'}).ok);
sb.window.PROGRESS_PHOTOS.push({clientId:'c-gar1',date:'2026-09-10',photos:{front:'data:image/jpeg;base64,xx'}});
ok('garmin+photo unlocks',sb.cpCoopCollectSignals({id:'c-gar1'}).ok&&sb.cpCoopCollectSignals({id:'c-gar1'}).found.some(s=>s.id==='garmin')&&sb.cpCoopCollectSignals({id:'c-gar1'}).found.some(s=>s.id==='photos'));

const md=sb.cpCoopParseReply(`1. Interpretacja
**Słabszy tydzień** *może* oznaczać zmęczenie.
---
2. Do rozważenia
- **Dopytać o sen**
- ---
- Rozważyć krótsze sesje
- *Czwarta która zniknie*

3. Sprawdź przed decyzją
- Brak trendu siły`);
const mdHtml=sb.cpCoopResultHTML(md,false);
ok('md parse keeps 3 sections',md.ok&&md.consider.length===3);
ok('md markers gone',!/\*\*/.test(md.interp)&&!/\*\*/.test(mdHtml)&&!/\*/.test(md.interp)&&!/---/.test(mdHtml)&&!/\*\*/.test(md.consider.join(' ')));
ok('md wording kept',/Słabszy tydzień/.test(md.interp)&&/Dopytać o sen/.test(mdHtml)&&/może oznaczać/.test(md.interp));

const sys=sb.cpCoopSystemPrompt();
ok('prompt FACTS model',/FAKTY → INTERPRETACJA → OPCJE → DECYZJA TRENERA/.test(sys));
ok('prompt no invent kg/%/dates/ex/diag',/nie wymyślaj danych, dat, kg, procentów, 1RM, makro, diagnoz medycznych/.test(sys));
ok('prompt no certain decisions',/nie przedstawiaj sugestii jako pewnych decyzji/.test(sys)&&/nie podejmujesz decyzji/i.test(sys));
ok('prompt no volume order phrasing',/skróć objętość o/.test(sys)&&/należy, musisz, wdróż, zdiagnozowano/.test(sys));
ok('prompt three headers',/1\. Interpretacja/.test(sys)&&/2\. Do rozważenia/.test(sys)&&/3\. Sprawdź przed decyzją/.test(sys));
ok('prompt no duplicate sections',/nie powtarzaj Briefu, SYTUACJI/.test(sys));

const parsed=sb.cpCoopParseReply(GOOD);
ok('parse 3 sections',parsed.ok&&parsed.consider.length===3&&parsed.check.length>=1&&/Adherencja/.test(parsed.interp));
const four=sb.cpCoopParseReply(`1. Interpretacja\nX.\n\n2. Do rozważenia\n- a\n- b\n- c\n- d\n\n3. Sprawdź przed decyzją\n- z`);
ok('consider capped at 3',four.ok&&four.consider.length===3&&four.consider[2]==='c',JSON.stringify(four.consider));
const bad=sb.cpCoopParseReply('Lorem ipsum bez nagłówków <script>alert(1)</script>');
ok('malformed not ok',!bad.ok&&/Lorem/.test(bad.raw));
const badHtml=sb.cpCoopResultHTML(bad,false);
ok('malformed does not break markup',/Odpowiedź poza schematem/.test(badHtml)&&!/<script>/.test(badHtml)&&/&lt;script&gt;/.test(badHtml));
ok('malformed no 3 sections',!/data-cp-coop-sec="interp"/.test(badHtml));
const goodHtml=sb.cpCoopResultHTML(parsed,false);
ok('good html 3 secs',/data-cp-coop-sec="interp"/.test(goodHtml)&&/data-cp-coop-sec="consider"/.test(goodHtml)&&/data-cp-coop-sec="check"/.test(goodHtml));
ok('good html legal',/To nie jest decyzja/.test(goodHtml));
ok('good html 3 options',(goodHtml.match(/<li>/g)||[]).length===4);

async function withFetch(sandbox,impl){
  sandbox._fetchN=0;
  sandbox._lastFetch=null;
  sandbox.fetch=async(url,opts)=>{
    sandbox._fetchN++;
    sandbox._lastFetch={url,opts};
    return impl(url,opts);
  };
}

(async()=>{
  const s=makeSandbox();
  const c={id:'c-run',name:'Adam',goal:'sila',injuries:'',notes:'nie zapisuj'};
  s.CL.push(c);
  s.window.cpClientId='c-run';
  s.SE.push({id:'s',clientId:'c-run',date:'2026-09-18',source:'live',type:'FBW'});
  s.CHECKINS['c-run']=[{id:'ci',status:'filled',date:'2026-09-19',answers:{sleep:3}}];

  await withFetch(s,async()=>{throw new Error('should not fetch yet');});
  ok('open overview 0 fetch',s._fetchN===0);
  const htmlIdle=s.cpOverviewCoopHTML(c);
  ok('idle still 0 fetch',s._fetchN===0&&/Przeanalizuj współpracę/.test(htmlIdle));

  s._fetchN=0;
  await s.runCpCoopAnalysis('c-zero-missing');
  ok('unknown client no fetch',s._fetchN===0);

  const oneC={id:'c-run-one',name:'Ola',goal:'sila',injuries:''};
  s.CL.push(oneC);
  s.SE.push({id:'s1',clientId:'c-run-one',date:'2026-09-18',source:'live',type:'FBW'});
  s._fetchN=0;
  await s.runCpCoopAnalysis('c-run-one');
  ok('1 signal run does not fetch',s._fetchN===0);
  ok('1 signal persist unused',s._persist.length===0);

  const reqBlocked=await s.cpCoopRequestAnalysis(oneC);
  ok('api wrapper blocks 1 source',reqBlocked.blocked===true&&reqBlocked.fetched===false&&s._fetchN===0&&/minimum 2 niezależne źródła/.test(reqBlocked.error));

  const calOnly={id:'c-cal',name:'Kalendarz',goal:'sila',injuries:''};
  s.CL.push(calOnly);
  s.SE.push({id:'s-cal',clientId:'c-cal',date:'2026-09-22',source:'planned',type:'FBW'});
  s._fetchN=0;
  await s.runCpCoopAnalysis('c-cal');
  ok('calendar-only run does not fetch',s._fetchN===0);
  const reqCal=await s.cpCoopRequestAnalysis(calOnly);
  ok('api wrapper blocks calendar',reqCal.blocked&&!reqCal.fetched&&s._fetchN===0);

  let release;
  const hold=new Promise(r=>{release=r;});
  s._fetchN=0;
  s.fetch=async(url,opts)=>{
    s._fetchN++;
    s._lastFetch={url,body:JSON.parse(opts.body)};
    await hold;
    return{json:async()=>({content:[{text:GOOD}]})};
  };
  const p1=s.runCpCoopAnalysis('c-run');
  await new Promise(r=>setTimeout(r,20));
  const p2=s.runCpCoopAnalysis('c-run');
  const p3=s.runCpCoopAnalysis('c-run');
  ok('in-flight extra clicks 1 fetch',s._fetchN===1,String(s._fetchN));
  ok('busy flag set',!!s.window._cpCoopBusy['c-run']);
  release();
  await p1;await p2;await p3;
  ok('exactly 1 request after click',s._fetchN===1,String(s._fetchN));
  ok('cache stored in session',!!s.window._cpCoopCache['c-run']&&s.window._cpCoopCache['c-run'].parsed&&s.window._cpCoopCache['c-run'].parsed.ok);
  ok('no persistById after success',s._persist.length===0,JSON.stringify(s._persist));
  ok('client object not stamped with analysis',c.analysis==null&&c.coop==null&&c.ai==null&&c.notes==='nie zapisuj');

  const body=s._lastFetch.body;
  const sysSent=String(body.system||'');
  ok('request mocked url',/mock\.invalid/.test(s._lastFetch.url));
  ok('max_tokens 500',body.max_tokens===500);
  ok('prompt in system',/FAKTY → INTERPRETACJA/.test(sysSent)&&/DANE NIEOBECNE/.test(sysSent));
  ok('request no monitor.next',!/Skróć objętość o ~20/.test(sysSent)&&!/Zmień plan na PPL/.test(JSON.stringify(body)));
  ok('request no notes leak',!/nie zapisuj/.test(sysSent));

  const after=s.cpOverviewCoopHTML(c);
  ok('result 3 sections UI',/data-cp-coop-sec="interp"/.test(after)&&/data-cp-coop-sec="consider"/.test(after)&&/data-cp-coop-sec="check"/.test(after));
  ok('rerun label',/Ponów analizę/.test(after));
  ok('clear button',/data-cp-coop-cta="clear"/.test(after)&&/Wyczyść/.test(after));

  s._fetchN=0;
  s.fetch=async()=>{s._fetchN++;return{json:async()=>({content:[{text:GOOD}]})};};
  await s.runCpCoopAnalysis('c-run');
  ok('ponow does new request',s._fetchN===1,String(s._fetchN));

  s.clearCpCoopAnalysis('c-run');
  ok('clear drops session cache',!s.window._cpCoopCache['c-run']);
  const cleared=s.cpOverviewCoopHTML(c);
  ok('clear back to idle CTA',/Przeanalizuj współpracę/.test(cleared)&&!/data-cp-coop-sec="interp"/.test(cleared)&&!/Wyczyść/.test(cleared));

  s.fetch=async()=>{s._fetchN++;throw new Error('network');};
  s._fetchN=0;
  await s.runCpCoopAnalysis('c-run');
  ok('error 1 fetch',s._fetchN===1);
  ok('error message',s.window._cpCoopCache['c-run']&&s.window._cpCoopCache['c-run'].error==='Nie udało się połączyć z AI.');
  const errHtml=s.cpOverviewCoopHTML(c);
  ok('error UI + retry',/Nie udało się połączyć z AI/.test(errHtml)&&/Ponów analizę/.test(errHtml)&&/data-cp-coop-state="error"/.test(errHtml));

  s.fetch=async()=>({json:async()=>({content:[{text:'bez struktury <b>x</b>'}]})});
  await s.runCpCoopAnalysis('c-run');
  const rawHtml=s.cpOverviewCoopHTML(c);
  ok('bad format safe UI',/Odpowiedź poza schematem/.test(rawHtml)&&!/data-cp-coop-sec="interp"/.test(rawHtml)&&/cp-ov-coop/.test(rawHtml));

  s.fetch=async()=>({json:async()=>({content:[{text:GOOD}]})});
  await s.runCpCoopAnalysis('c-run');
  ok('still no persist after all runs',s._persist.length===0);

  if(failed){
    console.error('\n'+failed+' failed');
    process.exit(1);
  }
  console.log('\nAll cp-overview-coop-reg checks passed ('+rows.length+' assertions)');
})().catch(e=>{
  console.error(e);
  process.exit(1);
});
