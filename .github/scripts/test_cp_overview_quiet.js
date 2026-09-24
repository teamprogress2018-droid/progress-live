#!/usr/bin/env node
/** Przegląd: jedno źródło statusu, uczciwe próbki, pasek zaproszenia, brakujące dane. */
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

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('status truth helper',/function cpClientStatusTruth\(c\)/.test(src08));
ok('alert helper',/function cpOverviewAlertHTML\(c\)/.test(src08));
ok('missing helper',/function cpOverviewMissingHTML\(c\)/.test(src08));
ok('overview order',overview.indexOf('cpOverviewAlertHTML(c)')<overview.indexOf('cpOverviewBriefHTML(c)')&&overview.indexOf('cpOverviewBriefHTML(c)')<overview.indexOf('cpOverviewSituationHTML(c)'));
ok('one status stack',overview.includes('cp-ov-status-stack')&&overview.includes('cpOverviewCoopHTML(c)'));
ok('no dane osobowe card',!overview.includes('cp-ov-edit-cta'));
ok('no straznik banner',!overview.includes('cp-bmi-banner')&&!overview.includes('Podsumowania klienta'));
ok('plan chips not red',overview.includes('cp-ov-week-wd')&&!/rgba\(230,0,0,0\.12\)/.test(overview));
ok('invite copy',src08.includes('nie ma jeszcze dostępu do aplikacji')&&src08.includes('Wyślij zaproszenie')&&src08.includes('Zobacz kroki'));
ok('invite cta not primary red',extract(src08,'cpOverviewAlertHTML').includes('cp-ov-alert-cta')&&!extract(src08,'cpOverviewAlertHTML').includes('btn-primary'));
ok('thin copy',src08.includes('Za mało danych')&&src08.includes('brak pomiaru wagi'));
ok('no score 0 label',!/Werdykt: \$\{esc\(verdict\)\}\$\{v&&v\.score!=null/.test(src08));
ok('thin verdict helper',/function cpOverviewVerdictIsThin\(c,v\)/.test(src08)&&src08.includes('Za mało danych do werdyktu'));
ok('early headline',src08.includes('Za wcześnie na ocenę')&&src08.includes('cp-ov-situation-headline')&&src08.includes('Wiarygodną analizę pokażemy po 4 tygodniach lub 4 pomiarach.'));
ok('rec engine',src08.includes('function cpOverviewRecs')&&src08.includes('Wszystko w porządku — brak pilnych działań.')&&src08.includes('Otwórz plan')&&!src08.includes('Skróć plan'));
ok('cache 08/styles',html.includes('08-client-profile-extras.js?v=82')&&html.includes('styles.css?v=114'));
ok('level labels helper',/Początkujący/.test(extract(src08,'cpProfileSubtext')));
ok('css alert+missing',css.includes('.cp-ov-alert')&&css.includes('.cp-ov-missing')&&css.includes('.cp-ov-day-chip')&&css.includes('.cp-ov-alert-cta'));
ok('css no card red bar',css.includes('.cp-ov-card::after,.cp-ov-rail-card::after{display:none;}'));
ok('css tabs gray + red underline',/\.cp-tab\{[^}]*color:var\(--text-secondary\)/.test(css)&&/\.cp-tab\.active\{[^}]*border-bottom-color:var\(--accent\)/.test(css));
ok('header labels 07',fs.readFileSync(path.join(root,'07-forms-metrics-calculator.js'),'utf8').includes('cpProfileSubtext'));
ok('ci unit',wf.includes('test_cp_overview_quiet.js'));

const sandbox={
  window:{CL:[],SE:[],PL:[],CHECKINS:{},CLIENT_NOTES:{},METRIC_ENTRIES:[],PROGRESS_PHOTOS:[]},
  Date,Math,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
  latestClientPlan:(id)=>(sandbox.window.PL||[]).filter(p=>p&&p.clientId===id).slice(-1)[0]||null,
  getClientOnboard:(c)=>sandbox._ob,
  clientSituationSnapshot:(id)=>sandbox._snap||{facts:{adh30:{assigned:0,logged:0,pct:0}}},
  cpClientPulseStatus:()=>sandbox._pulse||{tone:'good',label:'Na czas',hint:'Ostatni wpis 1 d. temu'},
  cpMetricLatest:(id,g,m)=>{
    const list=(sandbox.window.METRIC_ENTRIES||[]).filter(e=>e.clientId===id&&e.groupId===g&&e.values&&e.values[m]!=null);
    return list[0]||null;
  },
  cpGarminWeekAvg:()=>({n:0}),
  ppListFor:()=>[],
  cpLatestPhysique:()=>null,
  clientInjuriesText:(c)=>c&&c.injuries||'',
  bmFeatureOn:()=>true,
  ppFeatureOn:()=>true,
  escHtml:(s)=>String(s??'')
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;
sandbox.PL=sandbox.window.PL;
vm.runInNewContext(
  'const CP_OV_ADH_MIN=4;const CP_OV_SLEEP_MIN=4;const CP_OV_MASS_TREND_MIN=2;\n'+
  extract(src08,'cpProfileSubtext')+'\n'+
  extract(src08,'cpClientHasPlanDays')+'\n'+
  extract(src08,'cpAdhSampleOk')+'\n'+
  extract(src08,'cpOverviewFirstName')+'\n'+
  extract(src08,'cpClientStatusTruth')+'\n'+
  extract(src08,'cpOverviewHasApp')+'\n'+
  extract(src08,'cpOverviewHasLastName')+'\n'+
  'window.CHECKINS=window.CHECKINS||{};\n'+
  extract(src08,'cpOverviewAlertHTML')+'\n'+
  extract(src08,'cpOverviewMissingItems')+'\n'+
  extract(src08,'cpOverviewMissingHTML')+'\n'+
  extract(src08,'cpOverviewVerdictIsThin')+'\n',
  sandbox
);

const jan={id:'c-jan',name:'Jan Kowalski',goal:'masa',level:'poczatkujacy',email:'teamprogress2018@gmail.com',status:'active'};
sandbox.CL.push(jan);
sandbox.PL.push({id:'pl1',clientId:'c-jan',days:[{day:'Pon'},{day:'Śr'},{day:'Pt'}]});
sandbox._ob={invite:false,baseline:false,schedule:false,plan:true,calendar:true,session:true,package:false,done:3,total:6,complete:false};
sandbox._pulse={tone:'good',label:'Na czas',hint:'Ostatni wpis 2 d. temu'};
sandbox._snap={facts:{adh30:{assigned:2,logged:1,pct:50}}};

const truth=sandbox.cpClientStatusTruth(jan);
ok('invite beats green pulse',truth.reason==='invite'&&truth.tone==='warn'&&/Brak dostępu/.test(truth.label),JSON.stringify(truth));
ok('plan days count as schedule',truth.scheduleOk===true);
const alert=sandbox.cpOverviewAlertHTML(jan);
ok('invite alert html',/data-cp-alert="invite"/.test(alert)&&/Wyślij zaproszenie/.test(alert)&&/Zobacz kroki/.test(alert)&&/Jan nie ma jeszcze dostępu/.test(alert)&&!/Brak dni treningowych/.test(alert));
ok('invite hides stabilnie',sandbox.cpOverviewVerdictIsThin(jan,{verdict:'stabilnie',score:2,stats:{adh30:{assigned:0,logged:1,pct:100}}})===true);

sandbox._ob.invite=true;sandbox._ob.done=4;
const truth2=sandbox.cpClientStatusTruth(jan);
ok('onboard after invite',truth2.reason==='onboard'&&!/dni treningowe/.test(truth2.hint),JSON.stringify(truth2));

ok('level diacritics',sandbox.cpProfileSubtext(jan)==='Budowa masy · Początkujący');
const missing=sandbox.cpOverviewMissingItems(jan);
ok('missing has checkin+garmin in client group',missing.client.some(x=>x.id==='checkin')&&missing.client.some(x=>x.id==='garmin'),JSON.stringify(missing.client.map(x=>x.id)));
ok('invite not in missing',!missing.client.some(x=>x.id==='invite')&&!missing.trainer.some(x=>x.id==='invite')&&!missing.items.some(x=>x.id==='invite'));
ok('notes not in missing',!missing.trainer.some(x=>x.id==='notes')&&!missing.client.some(x=>x.id==='notes'));
jan.inviteSent=true;
const missHtml=sandbox.cpOverviewMissingHTML(jan);
ok('has-app missing heading',/Uzupełni klient/.test(missHtml)&&!/Uzupełni klient po zaproszeniu/.test(missHtml));
ok('ask all once',(missHtml.match(/Poproś o wszystko/g)||[]).length===1);
ok('no per-item poproś',!/>Poproś</.test(missHtml));
delete jan.inviteSent;
sandbox._ob.complete=true;sandbox._ob.done=6;
ok('thin sample hides stabilnie',sandbox.cpOverviewVerdictIsThin(jan,{verdict:'stabilnie',score:2,stats:{adh30:{assigned:2,logged:1,pct:50}}})===true);
ok('enough data keeps progres',sandbox.cpOverviewVerdictIsThin(jan,{verdict:'progres',score:4,stats:{adh30:{assigned:8,logged:7,pct:88}}})===false);

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-overview-quiet checks passed');
