#!/usr/bin/env node
/** Przegląd: Analiza współpracy — fakty → interpretacja → opcje (AI na żądanie). */
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
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('helpers',/function cpCoopCollectSignals\(c\)/.test(src08)&&/function cpOverviewCoopHTML\(c\)/.test(src08)&&/function runCpCoopAnalysis\(/.test(src08));
ok('after situation',overview.indexOf('cpOverviewSituationHTML(c)')<overview.indexOf('cpOverviewCoopHTML(c)')&&overview.indexOf('cpOverviewCoopHTML(c)')>0);
ok('brief still first',overview.indexOf('cpOverviewBriefHTML(c)')<overview.indexOf('cpOverviewSituationHTML(c)'));
ok('situation untouched',sit.includes('Na kolejny trening')&&sit.includes('cp-ov-situation')&&!sit.includes('cpOverviewCoopHTML')&&!sit.includes('Przeanalizuj współpracę'));
ok('brief untouched',brief.includes('Przed treningiem')&&!brief.includes('Przeanalizuj współpracę')&&!brief.includes('runCpCoopAnalysis'));
ok('cta copy',src08.includes('Przeanalizuj współpracę')&&!/Co by zmieniło AI\?/.test(coopSrc));
ok('no monitor.next in html helper',!/v\.next|monitor\.next/.test(extract(src08,'cpOverviewCoopHTML')));
ok('no persist',!/persistById/.test(coopSrc));
ok('no scoreCheckin',!/scoreCheckinAnswers/.test(coopSrc));
ok('injuries field',/c\.injuries/.test(extract(src08,'cpCoopContextForAI')));
ok('css',css.includes('.cp-ov-coop')&&css.includes('.cp-ov-coop-sh'));
ok('cache 08/styles',html.includes('08-client-profile-extras.js?v=73')&&html.includes('styles.css?v=105'));
ok('ci unit',wf.includes('test_cp_overview_coop.js'));
ok('ci ui',wf.includes('test_cp_overview_coop_ui.js'));
ok('gate two signals',src08.includes('found.length>=2'));
ok('gate copy exact',src08.includes('Za mało danych do analizy — potrzebne minimum 2 niezależne źródła.'));
ok('calendar not a source',!/clientAdherenceStats/.test(extract(src08,'cpCoopCollectSignals'))&&!/id:'adherence'/.test(extract(src08,'cpCoopCollectSignals')));
ok('request wrapper gates fetch',/length<2/.test(extract(src08,'cpCoopRequestAnalysis'))&&/await fetch\(/.test(extract(src08,'cpCoopRequestAnalysis')));
ok('on demand fetch',!/fetch\(/.test(extract(src08,'cpOverviewCoopHTML'))&&/cpCoopRequestAnalysis/.test(extract(src08,'runCpCoopAnalysis')));

const sandbox={
  window:{CL:[],SE:[],PL:[],CHECKINS:{},CLIENT_NOTES:{},TASKS:[],METRIC_ENTRIES:[],PROGRESS_PHOTOS:[],_cpCoopCache:{},_cpCoopBusy:{}},
  Date,Math,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
  todayYmd:()=>'2026-09-21',
  dashTodayYmd:()=>'2026-09-21',
  completedWorkouts:(id)=>(sandbox.window.SE||[]).filter(s=>s&&s.clientId===id&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework')),
  isLoggedWorkout:(s)=>s&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework'),
  clientAdherenceStats:(id,days)=>{
    const se=(sandbox.window.SE||[]).filter(s=>s&&s.clientId===id);
    const assigned=se.filter(s=>s.source==='planned').length;
    const logged=se.filter(s=>s.source==='live'||s.source==='client').length;
    const denom=assigned||logged;
    return{assigned,logged,pct:denom?Math.round(logged/denom*100):0};
  },
  cpMetricDeltaPct:(id,g,m)=>{
    const key=g+'/'+m;
    const map=sandbox._deltas||{};
    return Object.prototype.hasOwnProperty.call(map,key)?map[key]:null;
  },
  cpSleepTrendFact:(id)=>sandbox._sleep||null,
  clientOpenHomework:(id)=>(sandbox.window.TASKS||[]).filter(t=>t&&t.clientId===id&&t.status!=='done'&&t.kind==='homework'),
  homeworkCompletions:(id)=>(sandbox._hwDone&&sandbox._hwDone[id])||[],
  ppListFor:(id)=>(sandbox.window.PROGRESS_PHOTOS||[]).filter(p=>p&&p.clientId===id),
  buildMonitorVerdict:(c)=>sandbox._mon||{verdict:'ryzyko stagnacji',verdictTone:'warn',score:-1,signals:[
    {tone:'bad',label:'Adherencja 30 dni',text:'48% (6/13) — ryzyko regresu przez brak bodźca.'},
    {tone:'warn',label:'Ostatni tydzień',text:'0 z 3 zaplanowanych — krótki kontakt.'},
    {tone:'neutral',label:'Masa ciała',text:'Za mało pomiarów masy (potrzeba ≥2).'},
    {tone:'good',label:'Check-in',text:'Samopoczucie ↑'}
  ],next:['Skróć objętość o ~20–30% na 7–10 dni i wróć do MEV.']},
  clientSituationSnapshot:(id)=>({clientId:id,facts:{adh7:{logged:1,assigned:3,pct:33},adh30:{logged:6,assigned:13,pct:48},lastWorkout:{date:'2026-09-18',title:'FBW',source:'live',daysSince:3},checkinStatus:'done',lastCheckin:{date:'2026-09-19',daysSince:2},mass:{value:80,deltaPct:null,date:'2026-09-01'},sleep:{value:7,date:'2026-09-20'},homework:{open:0,late:0}}}),
  latestClientPlan:(id)=>(sandbox.window.PL||[]).filter(p=>p&&p.clientId===id)[0]||null,
  clientSafetyContextForAI:()=>'',
  escHtml:(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  cpBriefTopLoads:()=>[{name:'Przysiad',load:'100 kg × 5'}],
  sessionTitle:(s)=>s.type||'Trening'
};
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

vm.runInNewContext(coopSrc,sandbox);

const sila={id:'c-sila',name:'Adam',goal:'sila',level:'sredni',injuries:'',notes:'tajne notes'};
sandbox.CL.push(sila);
sandbox.SE.push(
  {id:'s1',clientId:'c-sila',date:'2026-09-18',source:'live',type:'FBW A',feedback:4},
  {id:'s-plan',clientId:'c-sila',date:'2026-09-20',source:'planned',type:'FBW B'}
);
sandbox.CHECKINS['c-sila']=[{id:'ci1',status:'filled',date:'2026-09-19',answers:{sleep:3,energy:2}}];
sandbox._deltas={};

const gateSila=sandbox.cpCoopCollectSignals(sila);
ok('sila workout+checkin without mass',gateSila.ok&&gateSila.found.some(s=>s.id==='training')&&gateSila.found.some(s=>s.id==='checkin')&&!gateSila.found.some(s=>s.id==='body')&&!gateSila.found.some(s=>s.id==='adherence'),JSON.stringify(gateSila.found));
ok('sila mass not required',!gateSila.missing.includes('dwa pomiary masy'),gateSila.missing.join(','));

const htmlSila=sandbox.cpOverviewCoopHTML(sila);
ok('cta present when 2+ signals',/Przeanalizuj współpracę/.test(htmlSila)&&/data-cp-coop-cta="run"/.test(htmlSila));
ok('no volume order in idle card',!/20–30%|20-30%|Skróć objętość/.test(htmlSila));
ok('max 3 signals', (htmlSila.match(/data-cp-coop-sig=/g)||[]).length<=3);
ok('kicker',/Analiza współpracy/.test(htmlSila));
ok('footer decision',/Decyzję podejmujesz Ty/.test(htmlSila));
ok('not brief kicker',!/Przed treningiem/.test(htmlSila));
ok('not next list',!/Na kolejny trening/.test(htmlSila));

const thin={id:'c-thin',name:'Nowy',goal:'sila',injuries:'',notes:'ukryte'};
sandbox.CL.push(thin);
sandbox.CHECKINS['c-thin']=[];
const gateThin=sandbox.cpCoopCollectSignals(thin);
ok('thin blocked',!gateThin.ok&&gateThin.found.length<2,JSON.stringify(gateThin));
const htmlThin=sandbox.cpOverviewCoopHTML(thin);
ok('thin no fetch cta',/Za mało danych do analizy — potrzebne minimum 2 niezależne źródła/.test(htmlThin)&&!/data-cp-coop-cta="run"/.test(htmlThin)&&/data-cp-coop-cta="blocked"/.test(htmlThin));
ok('thin blocked button',/disabled/.test(htmlThin)&&/opacity:\.45/.test(htmlThin));

const masaOnly={id:'c-masa1',name:'Ewa',goal:'masa',injuries:''};
sandbox.METRIC_ENTRIES.push({clientId:'c-masa1',groupId:'mg1',date:'2026-09-01',values:{m1:70}});
const gateMasa1=sandbox.cpCoopCollectSignals(masaOnly);
ok('single body metric not enough',!gateMasa1.ok&&gateMasa1.found.filter(s=>s.id==='body').length===1&&gateMasa1.found.length===1,JSON.stringify(gateMasa1.found));

sandbox.CHECKINS['c-masa1']=[{id:'ci-m',status:'filled',date:'2026-09-10',answers:{sleep:4}}];
const gateMasa2=sandbox.cpCoopCollectSignals(masaOnly);
ok('body+checkin enough without workout',gateMasa2.ok&&gateMasa2.found.some(s=>s.id==='body')&&gateMasa2.found.some(s=>s.id==='checkin'));

const silaMass={id:'c-sm',name:'Bartek',goal:'sila',injuries:''};
sandbox.METRIC_ENTRIES.push({clientId:'c-sm',groupId:'mg1',date:'2026-09-01',values:{m1:80}});
sandbox.CHECKINS['c-sm']=[];
sandbox.SE=sandbox.SE.filter(s=>s.clientId!=='c-sm');
sandbox.window.SE=sandbox.SE;
const gateSilaMass=sandbox.cpCoopCollectSignals(silaMass);
ok('sila body-only still blocked',!gateSilaMass.ok,JSON.stringify(gateSilaMass.found));

const parsed=sandbox.cpCoopParseReply(`1. Interpretacja
Adherencja i słabszy check-in mogą oznaczać, że plan jest za ciężki albo życie poza salą przeszkadza.

2. Do rozważenia
- Dopytać o sen i stres
- Rozważyć krótsze sesje przez tydzień
- Poczekać na kolejny pomiar siły

3. Sprawdź przed decyzją
- Czy klient realnie ma czas na 4 dni?
- Brak drugiego pomiaru siły`);
ok('parse three sections',parsed.ok&&/Adherencja/.test(parsed.interp)&&parsed.consider.length===3&&parsed.check.length===2,JSON.stringify(parsed));

const ctx=sandbox.cpCoopContextForAI(sila);
ok('ctx has facts not orders',/Werdykt monitora/.test(ctx)&&!/Skróć objętość o ~20/.test(ctx)&&!/Jak zrobić, żeby było dobrze/.test(ctx));
ok('ctx no notes as injury',!/tajne notes/.test(ctx));
ok('ctx checkin /5',/Sen 3\/5/.test(ctx)&&!/\/10/.test(ctx));
ok('ctx rating 4 not missing',/Ocena ostatniego treningu: 4\/5/.test(ctx));
ok('prompt forbids orders',/nie podejmujesz decyzji/i.test(sandbox.cpCoopSystemPrompt())&&/skróć objętość/.test(sandbox.cpCoopSystemPrompt()));

const jan={id:'c-jan',name:'Jan Kowalski',goal:'sila',injuries:'',weight:0,age:0};
sandbox.CL.push(jan);
sandbox.SE.push({id:'s-jan',clientId:'c-jan',date:'2026-09-18',source:'live',type:'FBW',feedback:0});
sandbox.CHECKINS['c-jan']=[{id:'ci-jan',status:'filled',date:'2026-09-19',answers:{sleep:0,energy:3}}];
const ctxJan=sandbox.cpCoopContextForAI(jan);
ok('missing rating is brak not 0/5',/Ocena ostatniego treningu: brak \(nie 0\/5\)/.test(ctxJan)&&!/Ocena ostatniego treningu: 0\/5/.test(ctxJan));
ok('zero weight not sent',!/Waga \(karta\): 0/.test(ctxJan)&&!/Wiek: 0/.test(ctxJan));
ok('checkin 0 skipped, 3 kept',!/Sen 0\/5/.test(ctxJan)&&/Energia 3\/5/.test(ctxJan));

const planOnly={id:'c-plan',name:'Małgosia',goal:'kondycja',injuries:''};
sandbox.CL.push(planOnly);
sandbox.SE.push(
  {id:'s-mal-live',clientId:'c-plan',date:'2026-09-18',source:'live',type:'Bieg'},
  {id:'s-mal-plan',clientId:'c-plan',date:'2026-09-22',source:'planned',type:'Interwał'}
);
sandbox.CHECKINS['c-plan']=[];
const gatePlan=sandbox.cpCoopCollectSignals(planOnly);
ok('training+calendar is one source',!gatePlan.ok&&gatePlan.found.length===1&&gatePlan.found[0].id==='training',JSON.stringify(gatePlan.found));
const htmlPlan=sandbox.cpOverviewCoopHTML(planOnly);
ok('training+calendar blocked copy',/Za mało danych do analizy — potrzebne minimum 2 niezależne źródła/.test(htmlPlan)&&/data-cp-coop-cta="blocked"/.test(htmlPlan)&&!/data-cp-coop-cta="run"/.test(htmlPlan));

sandbox.TASKS.push({id:'t-open',clientId:'c-plan',kind:'homework',status:'open',title:'HIIT'});
ok('open homework does not unlock',!sandbox.cpCoopCollectSignals(planOnly).ok);
sandbox.TASKS.push({id:'t-done',clientId:'c-plan',kind:'homework',status:'done',title:'HIIT',doneAt:'2026-09-18'});
sandbox._hwDone={'c-plan':[{id:'t-done',status:'done'}]};
ok('done homework is second source',sandbox.cpCoopCollectSignals(planOnly).ok&&sandbox.cpCoopCollectSignals(planOnly).found.some(s=>s.id==='homework'));

const md=sandbox.cpCoopParseReply(`1. Interpretacja
**Słabszy tydzień** może oznaczać zmęczenie.

2. Do rozważenia
- *Dopytać o sen*
- ---
- Rozważyć krótsze sesje

3. Sprawdź przed decyzją
- Brak drugiego źródła`);
const mdHtml=sandbox.cpCoopResultHTML(md,false);
ok('markdown markers stripped',md.ok&&!/\*\*/.test(md.interp+md.consider.join('')+mdHtml)&&!/(^|[^*])\*[^*]/.test(md.interp)&&!/---/.test(mdHtml));
ok('markdown text kept',/Słabszy tydzień/.test(md.interp)&&/Dopytać o sen/.test(mdHtml));
ok('empty hr not a consider item',md.consider.length<=3&&!md.consider.some(x=>x==='---'||x==='*'));

const htmlGatedRun=extract(src08,'runCpCoopAnalysis');
ok('run respects gate',/if\(!gate\.ok\)/.test(htmlGatedRun));
ok('no auto on html',!/runCpCoopAnalysis\(/.test(extract(src08,'cpOverviewCoopHTML').replace(/onclick="runCpCoopAnalysis[^"]+"/,'')));

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-overview-coop checks passed');
