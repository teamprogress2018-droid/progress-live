#!/usr/bin/env node
/** Dashboard calendar refill + progress photo follow-up. */
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
const src01=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src10=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

if(!html.includes('id="dash-cal-refill"')||!html.includes('id="dash-photo-followup"')){
  console.error('FAIL missing dash slots');process.exit(1);
}
if(!src04.includes('function renderDashCalRefillFollowup')||!src04.includes('function renderDashPhotoFollowup')){
  console.error('FAIL missing render helpers');process.exit(1);
}
if(!src05.includes('function refillClientCalendar')){console.error('FAIL missing refillClientCalendar');process.exit(1);}
if(!src10.includes('renderDashPhotoFollowup')){console.error('FAIL ppSave missing photo dash refresh');process.exit(1);}

const sandbox={
  window:{
    CL:[
      {id:'c1',name:'Anna',status:'active'},
      {id:'c2',name:'Bartek',status:'active'},
      {id:'c3',name:'Arch',status:'archived'}
    ],
    PL:[
      {id:'p1',clientId:'c1',name:'PPL',updatedAt:'2026-08-20',days:[{day:'Pn',exercises:[{name:'Squat'}]},{rest:true}]},
      {id:'p2',clientId:'c2',name:'FBW',updatedAt:'2026-08-21',days:[{day:'Wt',exercises:[{name:'Press'}]}]},
      {id:'p3',clientId:'c3',name:'Old',days:[{day:'Śr',exercises:[{name:'Row'}]}]}
    ],
    SE:[
      {clientId:'c1',source:'planned',date:'2026-08-26',planId:'p1'},
      {clientId:'c2',source:'planned',date:'2026-09-20',planId:'p2'},
      {clientId:'c3',source:'planned',date:'2026-08-25',planId:'p3'}
    ],
    PROGRESS_PHOTOS:[
      {id:'pp1',clientId:'c1',source:'client',date:'2026-08-22',createdAt:'2026-08-22T10:00:00.000Z',photos:{front:'x'}},
      {id:'pp2',clientId:'c1',source:'trainer',date:'2026-08-23',createdAt:'2026-08-23T10:00:00.000Z',photos:{front:'y'}},
      {id:'pp3',clientId:'c3',source:'client',date:'2026-08-23',createdAt:'2026-08-23T11:00:00.000Z',photos:{front:'z'}},
      {id:'pp4',clientId:'c2',source:'client',date:'2026-07-01',createdAt:'2026-07-01T10:00:00.000Z',photos:{front:'old'}}
    ]
  },
  CL:null,PL:null,SE:null,
  todayYmd:()=>'2026-08-24',
  console
};
sandbox.CL=sandbox.window.CL;
sandbox.PL=sandbox.window.PL;
sandbox.SE=sandbox.window.SE;
sandbox.window.CL=sandbox.CL;
sandbox.window.PL=sandbox.PL;
sandbox.window.SE=sandbox.SE;
sandbox.window.PROGRESS_PHOTOS=sandbox.window.PROGRESS_PHOTOS;

vm.runInNewContext(
  extract(src01,'ymdAdd')+'\n'+
  extract(src01,'clientHasAssignedPlan')+'\n'+
  extract(src01,'clientLastPlannedYmd')+'\n'+
  extract(src01,'clientPlanForCalendar')+'\n'+
  extract(src01,'clientNeedsCalendarRefill')+'\n'+
  extract(src01,'clientsNeedingCalendarRefill')+'\n'+
  extract(src01,'recentClientProgressPhotos')+'\n'+
  'window.ymdAdd=ymdAdd;window.clientLastPlannedYmd=clientLastPlannedYmd;'+
  'window.clientPlanForCalendar=clientPlanForCalendar;window.clientNeedsCalendarRefill=clientNeedsCalendarRefill;'+
  'window.clientsNeedingCalendarRefill=clientsNeedingCalendarRefill;window.recentClientProgressPhotos=recentClientProgressPhotos;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('last planned c1',sandbox.clientLastPlannedYmd('c1'),'2026-08-26');
eq('c1 needs refill soon',!!sandbox.clientNeedsCalendarRefill(sandbox.CL[0],7),true);
eq('c2 ok far ahead',sandbox.clientNeedsCalendarRefill(sandbox.CL[1],7),false);
eq('list only c1',sandbox.clientsNeedingCalendarRefill(7).map(r=>r.client.id),['c1']);
eq('archived skipped',sandbox.clientsNeedingCalendarRefill(7).some(r=>r.client.id==='c3'),false);

eq('photos client only recent',sandbox.recentClientProgressPhotos(14).map(p=>p.id),['pp1']);
eq('photos skip trainer+old+arch',sandbox.recentClientProgressPhotos(14).length,1);

// empty planned
sandbox.SE=sandbox.SE.filter(s=>s.clientId!=='c1');
sandbox.window.SE=sandbox.SE;
eq('empty planned needs refill',sandbox.clientNeedsCalendarRefill(sandbox.CL[0],7).urgency,'empty');

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll cal refill / photo follow-up tests passed');
