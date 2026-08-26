// Panel analityczny klienta: adherencja, check-in, nawyki, chipy, wykresy.
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
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const progressFn=src08.slice(src08.indexOf('function renderCPProgress'),src08.indexOf('window.renderCPProgress'));

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('analytics title',/ANALITYKA KLIENTA/.test(progressFn));
ok('panel chips',/setCPProgressPanel/.test(progressFn)&&/data-cp-panel-chip/.test(progressFn));
ok('adherence kpi',/Adherencja 30 dni/.test(progressFn)&&/cpClientAdherence/.test(src08));
ok('checkin chart',/Samopoczucie \(check-in\)/.test(progressFn)&&/cpCheckinTrendPoints/.test(src08));
ok('habits chart',/Adherencja nawyków/.test(progressFn)&&/cpHabitAdherenceWeekly/.test(src08));
ok('photos strip',/Zdjęcia postępów/.test(progressFn)&&/data-cp-panel="photos"/.test(progressFn));
ok('training charts kept',/Tonaż tygodniowy/.test(progressFn)&&/Rekordy z treningów/.test(progressFn));
ok('no photos tab jump',!/setCPTab\('photos'\)/.test(progressFn));
ok('chip css',css.includes('.cp-analytics-chip')&&css.includes('.cp-analytics-chips'));
ok('pct bar chart',src08.includes('function cpPctBarChart'));
ok('client app adherence',/Adherencja 30d/.test(src04)&&/cpHabitAdherenceWeekly/.test(src04));
ok('cache bumps',html.includes('08-client-profile-extras.js?v=30')&&html.includes('04-client-portal.js?v=32')&&html.includes('styles.css?v=43'));

const today=new Date();
today.setHours(12,0,0,0);
function ymd(d){
  const x=new Date(d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
}
const d0=ymd(today);
const d3=ymd(new Date(today.getTime()-3*86400000));
const d10=ymd(new Date(today.getTime()-10*86400000));

const sandbox={
  window:{
    SE:[
      {id:'s1',clientId:'c1',date:d0,source:'planned'},
      {id:'s2',clientId:'c1',date:d0,source:'client',exercises:[{name:'Squat'}]},
      {id:'s3',clientId:'c1',date:d3,source:'planned'},
      {id:'s4',clientId:'c1',date:d10,source:'live',exercises:[{name:'Press'}]}
    ],
    TASKS:[
      {id:'h1',clientId:'c1',kind:'habit',title:'Woda',doneDates:[d0,d3]},
      {id:'h2',clientId:'c1',kind:'habit',title:'Sen',doneDates:[d0]}
    ],
    CHECKINS:{
      c1:[
        {id:'ci1',status:'filled',date:d10,answers:{energy:4,sleep:3,stress:2,nutrition:4}},
        {id:'ci2',status:'filled',date:d0,answers:{energy:5,sleep:4,stress:2,nutrition:5}}
      ]
    }
  },
  console
};
sandbox.window.SE=sandbox.window.SE;
sandbox.SE=sandbox.window.SE;
sandbox.TASKS=sandbox.window.TASKS;
sandbox.window.TASKS=sandbox.TASKS;
sandbox.window.CHECKINS=sandbox.window.CHECKINS;

vm.runInNewContext(
  'function completedWorkouts(clientId,sessions){return (sessions||window.SE||[]).filter(s=>s.clientId===clientId&&(s.source==="client"||s.source==="live"||(s.exercises&&s.exercises.length)));}\n'+
  'function isHabit(t){return !!(t&&(t.kind==="habit"||t.repeat==="daily"));}\n'+
  'function habitDoneOn(t,ymd){return !!(t&&ymd&&(t.doneDates||[]).includes(ymd));}\n'+
  'function habitStreak(){return 2;}\n'+
  'function scoreCheckinAnswers(a){if(!a)return 0;const keys=["energy","sleep","stress","nutrition"];let s=0,n=0;keys.forEach(k=>{if(a[k]!=null){s+=Number(a[k]);n++;}});return n?Math.round((s/(n*5))*100):0;}\n'+
  'function escHtml(s){return String(s??"");}\n'+
  extract(src08,'cpClientAdherence')+'\n'+
  extract(src08,'cpCheckinTrendPoints')+'\n'+
  extract(src08,'cpHabitAdherenceWeekly')+'\n'+
  extract(src08,'cpPctBarChart')+'\n'+
  'window.cpClientAdherence=cpClientAdherence;window.cpCheckinTrendPoints=cpCheckinTrendPoints;'+
  'window.cpHabitAdherenceWeekly=cpHabitAdherenceWeekly;window.cpPctBarChart=cpPctBarChart;'+
  'window.completedWorkouts=completedWorkouts;window.isHabit=isHabit;window.habitDoneOn=habitDoneOn;window.scoreCheckinAnswers=scoreCheckinAnswers;',
  sandbox
);

const adh=sandbox.cpClientAdherence('c1',30);
ok('adherence counts',adh.assigned>=2&&adh.logged>=2&&adh.pct>0);
const ci=sandbox.cpCheckinTrendPoints('c1');
ok('checkin points',ci.length===2&&ci.every(p=>p.v>0));
const hw=sandbox.cpHabitAdherenceWeekly('c1',4);
ok('habit weeks',hw.length===4&&hw.some(w=>w.due>0));
const svg=sandbox.cpPctBarChart([{l:'T1',pct:50},{l:'T2',pct:80}]);
ok('pct svg',/cp-chart-svg/.test(svg)&&/50%/.test(svg));

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-analytics-panel tests passed');
