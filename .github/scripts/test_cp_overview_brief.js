#!/usr/bin/env node
/** Przegląd: Brief przed treningiem z istniejących faktów (bez AI, bez SYTUACJI). */
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
const briefSrc=extract(src08,'collectCpBriefItems');
const sit=extract(src08,'cpOverviewSituationHTML');

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('collect fn',/function collectCpBriefItems\(c\)/.test(src08));
ok('html helper',/function cpOverviewBriefHTML\(c\)/.test(src08));
ok('brief before situation',overview.indexOf('cpOverviewBriefHTML(c)')<overview.indexOf('cpOverviewSituationHTML(c)')&&overview.indexOf('cpOverviewBriefHTML(c)')>=0);
ok('situation helper intact',sit.includes('Na kolejny trening')&&sit.includes('cp-ov-situation')&&!sit.includes('collectCpBriefItems')&&!sit.includes('Przed treningiem'));
ok('no next-focus in brief',!/cpNextSessionFocusItems/.test(briefSrc));
ok('no AI',!/sendAICMsg|aplGenerate|openai/.test(briefSrc+extract(src08,'cpOverviewBriefHTML')));
ok('no persist',!/persistById/.test(briefSrc));
ok('no scoreCheckin',!/scoreCheckinAnswers/.test(briefSrc));
ok('no c.notes injury',!/c\.notes/.test(briefSrc)&&/c\.injuries/.test(briefSrc));
ok('no clientInjuriesText in brief',!/clientInjuriesText/.test(briefSrc));
ok('no adh copy',!/adh7|adh30|Adherencja/.test(briefSrc));
ok('no mass 30d',!/cpMassDelta30Fact/.test(briefSrc));
ok('garmin excluded',/source==='garmin'/.test(extract(src08,'cpBriefIsLogged')));
ok('planned excluded',/source==='planned'/.test(extract(src08,'cpBriefIsLogged')));
ok('css compact',css.includes('.cp-ov-brief-row')&&css.includes('.cp-ov-brief-kicker')&&!/cp-ov-brief-row\{[^}]*background:var\(--bg-card\)/.test(css.replace(/\n/g,' ')));
ok('injury watch',css.includes('.cp-ov-brief-row.is-watch')&&!css.includes('.cp-ov-brief-row.is-watch{background:'));
ok('cache 08/styles',html.includes('08-client-profile-extras.js?v=65')&&html.includes('styles.css?v=102'));
ok('ci unit',wf.includes('test_cp_overview_brief.js'));
ok('ci ui',wf.includes('test_cp_overview_brief_ui.js'));
ok('empty copy',src08.includes('Brak danych do briefu.'));
ok('kicker',src08.includes('Przed treningiem'));

const sandbox={
  window:{CL:[],SE:[],PL:[],CHECKINS:{},CLIENT_NOTES:{},TASKS:[]},
  Date,Math,Set,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
  todayYmd:()=>'2026-09-21',
  dashTodayYmd:()=>'2026-09-21',
  dashDaysBetween:(a,b)=>{
    const x=new Date(String(a).slice(0,10)+'T12:00:00').getTime();
    const y=new Date(String(b).slice(0,10)+'T12:00:00').getTime();
    return Math.round((y-x)/86400000);
  },
  latestClientPlan:(id)=>(sandbox.window.PL||[]).filter(p=>p&&p.clientId===id).slice(-1)[0]||null,
  cpAssignmentSessions:(id,opts)=>{
    const all=(sandbox.window.SE||[]).filter(s=>s&&s.clientId===id);
    if(opts&&opts.keepPlanned)return all;
    return all.filter(s=>s.source!=='planned');
  },
  sessionTitle:(s)=>s.type||s.title||'Trening',
  completedWorkouts:(id)=>(sandbox.window.SE||[]).filter(s=>s&&s.clientId===id&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework'))
    .slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))),
  isLoggedWorkout:(s)=>s&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework'),
  formatSetLoad:(kg,reps)=>kg+' kg × '+reps,
  exerciseLoggedSets:(ex)=>Array.isArray(ex.sets)?ex.sets:[],
  isWorkingSet:(s)=>!s||s.kind!=='warmup',
  isWeightLoadUnit:()=>true,
  exLoadUnit:()=>'kg',
  cpTlClip:(s,n)=>{
    const t=String(s||'').replace(/\s+/g,' ').trim();
    if(t.length<=n)return t;
    return t.slice(0,n-1).trim()+'…';
  },
  cpTlDayLabel:(raw)=>{
    const y=String(raw||'').slice(0,10);
    const p=y.split('-');
    return p.length===3?p[2]+'.'+p[1]:'';
  },
  cpTlSessionHighlight:(s)=>{
    const loads=sandbox.cpBriefTopLoads(s);
    if(!loads.length)return{fact:s.type||'Trening',extra:''};
    return{fact:loads[0].name+' · '+loads[0].load,extra:s._delta||''};
  },
  cpTlRecordEvents:(id)=>{
    return sandbox._recs||[];
  },
  clientOpenHomework:(id)=>(sandbox.window.TASKS||[]).filter(t=>t&&t.clientId===id&&t.status!=='done'&&t.kind==='homework'),
  homeworkCompletions:(id,days)=>(sandbox.window.TASKS||[]).filter(t=>t&&t.clientId===id&&t.status==='done'&&t.kind==='homework'),
  homeworkDoneYmd:(t)=>String(t.doneAt||'').slice(0,10),
  escHtml:(s)=>String(s??'')
};
['CL','SE','PL','CHECKINS','CLIENT_NOTES','TASKS'].forEach(k=>{
  sandbox[k]=sandbox.window[k];
  sandbox.window[k]=sandbox[k];
});

vm.runInNewContext(
  extract(src08,'cpBriefTodayYmd')+'\n'+
  extract(src08,'cpBriefDaysBetween')+'\n'+
  extract(src08,'cpBriefAgoLabel')+'\n'+
  extract(src08,'cpBriefIsLogged')+'\n'+
  extract(src08,'cpBriefTopLoads')+'\n'+
  extract(src08,'collectCpBriefItems')+'\n'+
  extract(src08,'cpOverviewBriefHTML')+'\n'+
  'window.collectCpBriefItems=collectCpBriefItems;window.cpOverviewBriefHTML=cpOverviewBriefHTML;',
  sandbox
);

function kinds(items){return items.map(x=>x.kind);}

sandbox.window.CL.push({id:'c1',name:'Anna',injuries:'kolano P — bez przysiadu ze sztangą',notes:'prywatna uwaga NIE do briefu'});
sandbox.window.PL.push({id:'p1',clientId:'c1',name:'PPL sila'});
sandbox.window.SE.push(
  {id:'s-today',clientId:'c1',date:'2026-09-21',time:'18:00',source:'planned',type:'Dzień B — Push',planId:'p1'},
  {id:'s-plan-future',clientId:'c1',date:'2026-09-23',source:'planned',type:'Dzień C'},
  {id:'s-live',clientId:'c1',date:'2026-09-18',source:'live',type:'FBW A',
    exercises:[{name:'Wyciskanie sztangi',sets:[{kg:80,reps:8,kind:'work'}]},{name:'Wiosłowanie',sets:[{kg:60,reps:10,kind:'work'}]}],
    _delta:'+2 powt.'},
  {id:'s-gar',clientId:'c1',date:'2026-09-20',source:'garmin',type:'Bieg 8 km'},
  {id:'s-draft',clientId:'c1',date:'2026-09-21',source:'live-draft',type:'Szkic'}
);
sandbox.window.CHECKINS.c1=[
  {id:'ci-p',status:'pending',date:'2026-09-20',answers:{energy:1,sleep:1}},
  {id:'ci-f',status:'filled',date:'2026-09-19',answers:{sleep:3,energy:2,stress:4,notes:'źle spałam'}}
];
sandbox.window.CLIENT_NOTES.c1=[{id:'n1',text:'Nie schodzić poniżej 90° w wyciskaniu',createdAt:'2026-09-18T10:00:00'}];
sandbox.window.TASKS.push({id:'t1',clientId:'c1',kind:'homework',status:'open',due:'2026-09-10',title:'Spacer 40 min'});
sandbox._recs=[{id:'tl_pr_c1_s-live_Wyciskanie_2026-09-18',date:'2026-09-18',fact:'Wyciskanie sztangi · 80 kg × 8'}];

const full=sandbox.collectCpBriefItems(sandbox.window.CL[0]);
ok('order session injury checkin workout',kinds(full).slice(0,4).join(',')==='session,injury,checkin,workout',kinds(full).join(','));
ok('has note and hw',kinds(full).includes('note')&&kinds(full).includes('homework'));
ok('today session not done',full.some(e=>e.kind==='session'&&/Dzień B/.test(e.fact)&&/18:00/.test(e.fact)&&e.label==='Dziś'));
ok('plan name extra',full.some(e=>e.kind==='session'&&/PPL/.test(e.extra)));
ok('injury from c.injuries',full.some(e=>e.kind==='injury'&&/kolano/.test(e.fact)&&e.tone==='watch'));
ok('not c.notes as injury',!full.some(e=>/prywatna uwaga/.test(e.fact+e.extra)));
ok('checkin filled /5',full.some(e=>e.kind==='checkin'&&/Sen 3\/5/.test(e.fact)&&/Energia 2\/5/.test(e.fact)&&/Stres 4\/5/.test(e.fact)&&!/\/10/.test(e.fact)));
ok('pending checkin hidden',!full.some(e=>e.kind==='checkin'&&/Energia 1\/5/.test(e.fact)));
ok('no invented energy 3',!full.some(e=>e.kind==='checkin'&&/Energia 3\/5/.test(e.fact)));
ok('checkin note',full.some(e=>e.kind==='checkin'&&/źle spałam/.test(e.extra)));
ok('last live not garmin',full.some(e=>e.kind==='workout'&&/FBW A/.test(e.fact)&&/Wyciskanie/.test(e.fact)&&!/Bieg/.test(e.fact)&&!/Szkic/.test(e.fact)&&!/Dzień B/.test(e.fact)));
ok('last has load',full.some(e=>e.kind==='workout'&&/80 kg × 8/.test(e.fact)));
ok('record on last only',full.some(e=>e.kind==='workout'&&/rekord/.test(e.extra)));
ok('hw late',full.some(e=>e.kind==='homework'&&/Spacer/.test(e.fact)&&/po terminie/.test(e.extra)));
ok('no recs as own line',!full.some(e=>e.kind==='rekord'));
ok('no adh line',!full.some(e=>/Adherencja|7d|30d/.test(e.label+e.fact)));

const htmlFull=sandbox.cpOverviewBriefHTML(sandbox.window.CL[0]);
ok('html kicker',/Przed treningiem/.test(htmlFull));
ok('html no placeholder rows',!/brak danych/.test(htmlFull.toLowerCase().replace('brak danych do briefu.','')));
ok('html injury watch class',/data-cp-brief="injury"[^>]*is-watch|is-watch[^>]*data-cp-brief="injury"/.test(htmlFull));

const emptyC={id:'c-empty',name:'Nowy',injuries:'',notes:'tajne'};
sandbox.window.CHECKINS['c-empty']=[];
sandbox.window.CLIENT_NOTES['c-empty']=[];
const empty=sandbox.collectCpBriefItems(emptyC);
ok('new client no items',empty.length===0,JSON.stringify(empty));
ok('notes not injury on empty',!empty.some(e=>e.kind==='injury'));
const emptyHtml=sandbox.cpOverviewBriefHTML(emptyC);
ok('empty one message',/Brak danych do briefu/.test(emptyHtml)&&emptyHtml.includes('data-cp-brief="empty"'));
ok('empty no fake rows',!/data-cp-brief="session"/.test(emptyHtml)&&!/data-cp-brief="injury"/.test(emptyHtml));

sandbox.window.SE.length=0;
sandbox.window.SE.push(
  {id:'s-gar2',clientId:'c2',date:'2026-09-20',source:'garmin',type:'Bieg',exercises:[{name:'Bieg',sets:[{kg:0,reps:0}]}]},
  {id:'s-pl2',clientId:'c2',date:'2026-09-21',source:'planned',type:'FBW B',exercises:[{name:'Przysiad',sets:[{kg:100,reps:5}]}]}
);
sandbox.window.PL.length=0;
sandbox.window.CHECKINS.c2=[];
sandbox.window.CLIENT_NOTES.c2=[];
sandbox.window.TASKS.length=0;
sandbox._recs=[];
const mixed=sandbox.collectCpBriefItems({id:'c2',injuries:''});
ok('planned is session not workout',mixed.some(e=>e.kind==='session'&&/FBW B/.test(e.fact))&&!mixed.some(e=>e.kind==='workout'),JSON.stringify(mixed));
ok('garmin not workout',!mixed.some(e=>e.kind==='workout'||/Bieg/.test(e.fact)));
ok('planned loads not as done',!mixed.some(e=>/100 kg/.test(e.fact+e.extra)));

const ciOnly=sandbox.collectCpBriefItems({id:'c3',injuries:''});
sandbox.window.CHECKINS.c3=[{id:'ci3',status:'filled',date:'2026-09-21',answers:{sleep:5}}];
const justCi=sandbox.collectCpBriefItems({id:'c3',injuries:''});
ok('checkin only sleep',justCi.filter(e=>e.kind==='checkin').length===1&&/Sen 5\/5/.test(justCi[0].fact)&&!/Energia/.test(justCi[0].fact)&&!/Odżywianie/.test(justCi[0].fact));

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-overview-brief checks passed');
