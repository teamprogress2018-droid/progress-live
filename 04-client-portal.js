// ════════════════════════════════════════
// CLIENT APP — WIDOK KLIENTA
// ════════════════════════════════════════
var capScreen='home';var capDevice='phone';var capTab='preview';
var capClientId=null;

const CAP_ACCENT='#e60000';
const CAP_BG='#1a1a1a';
const CAP_S1='#121212';
const CAP_S2='#252525';
const CAP_S3='rgba(255,255,255,0.07)';
const CAP_TEXT='#f5f5f5';
const CAP_MUTED='rgba(255,255,255,0.4)';

function initClientApp(){
  const sel=document.getElementById('cap-client-sel');
  if(sel){
    sel.innerHTML='<option value="">Wybierz klienta...</option>'+CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
    if(!capClientId&&CL.length)capClientId=CL[0].id;
    if(capClientId)sel.value=capClientId;
  }
  const title=document.querySelector('#screen-clientapp .topbar-title');
  if(title)title.textContent='Aplikacja klienta — podgląd (mock)';
  let banner=document.getElementById('cap-mock-banner');
  if(!banner){
    const top=document.querySelector('#screen-clientapp .topbar');
    if(top&&top.nextElementSibling){
      banner=document.createElement('div');
      banner.id='cap-mock-banner';
      banner.style.cssText='margin:0 16px 8px;padding:10px 14px;background:rgba(201,123,63,0.12);border:1px solid rgba(201,123,63,0.35);border-radius:8px;font-size:12px;color:var(--orange);';
      banner.textContent='To jest podgląd UI. Prawdziwe logowanie klienta jest w linku z zaproszenia.';
      top.parentNode.insertBefore(banner,top.nextElementSibling);
    }
  }
  renderClientApp();
}

function renderClientApp(){
  const sel=document.getElementById('cap-client-sel');
  if(sel&&sel.value)capClientId=sel.value;
  setCapScreen(capScreen,null);
  renderCapInfo();
  if(capTab==='customize')renderCapCustomize();
  if(capTab==='access')renderCapAccess();
}

function setCapTab(t){
  capTab=t;
  ['preview','customize','access'].forEach(x=>{
    const el=document.getElementById('cap-'+x+'-tab');
    if(el)el.style.display=x===t?'flex':'none';
    document.getElementById('cap-tab-'+x+'')?.classList.toggle('active',x===t);
  });

  if(t==='customize')renderCapCustomize();
  if(t==='access')renderCapAccess();
}

function setCapDevice(dev,btn){
  capDevice=dev;
  document.querySelectorAll('#cap-dev-phone,#cap-dev-android,#cap-dev-tablet').forEach(b=>b?.classList.remove('active'));
  btn?.classList.add('active');
  const frame=document.getElementById('cap-phone-frame');
  if(!frame)return;
  if(dev==='phone'){frame.style.width='375px';frame.style.height='812px';frame.style.borderRadius='50px';}
  else if(dev==='android'){frame.style.width='360px';frame.style.height='780px';frame.style.borderRadius='30px';}
  else{frame.style.width='768px';frame.style.height='600px';frame.style.borderRadius='20px';}
}

function setCapScreen(scr,btn){
  capScreen=scr;
  // update nav items
  document.querySelectorAll('.cap-nav-item').forEach(el=>el.classList.remove('active'));
  const nb=document.getElementById('capn-'+scr);if(nb)nb.classList.add('active');
  // update bottom nav
  ['home','plan','progress','messages','profile'].forEach(s=>{
    const bn=document.getElementById('cap-bn-'+s);
    if(bn){
      const isActive=s===scr;
      bn.style.opacity=isActive?'1':'0.5';
      const span=bn.querySelectorAll('span')[1];
      if(span)span.style.color=isActive?CAP_ACCENT:CAP_MUTED;
    }
  });
  const c=CL.find(x=>x.id===capClientId)||{name:'Jan Kowalski',goal:'masa',level:'sredni',weight:83,height:180,age:28};
  const content=document.getElementById('cap-screen-content');
  if(!content)return;
  content.innerHTML=capScreenHTML(scr,c);
  renderCapInfo();
}

function capIsLiveClient(){return !!window._clientAppMode;}

function capClientSectionVisible(id){
  const vs=(window.SETTINGS&&window.SETTINGS.clientApp&&window.SETTINGS.clientApp.visibleSections)||{};
  if(vs[id]===false)return false;
  return true;
}

function capLiveNavScreens(){
  return [
    {id:'home',label:'Dziś',icon:'🏠'},
    {id:'plan',label:'Plan',icon:'📋'},
    {id:'homework',label:'Domowe',icon:'🏡'},
    {id:'progress',label:'Postępy',icon:'📈'},
    {id:'checkin',label:'Check-in',icon:'✅'},
    {id:'ondemand',label:'On-demand',icon:'▶️'},
    {id:'resources',label:'Zasoby',icon:'📚'},
    {id:'forum',label:'Forum',icon:'👥'},
    {id:'messages',label:'Czat',icon:'💬'},
    {id:'profile',label:'Profil',icon:'👤'}
  ].filter(s=>capClientSectionVisible(s.id));
}

function capOdMsgId(text){
  const m=String(text||'').match(/\[od:([^\]]+)\]/);
  return m?m[1]:null;
}
function capOdProgMsgId(text){
  const m=String(text||'').match(/\[odprog:([^\]]+)\]/);
  return m?m[1]:null;
}
function capStripOdTags(text){
  return String(text||'').replace(/\[od(?:prog)?:[^\]]+\]\s*/g,'').trim();
}
function capSetOdTab(tab){
  window._capOdTab=tab;
  if(typeof capGoScreen==='function')capGoScreen('ondemand');
}
window.capOdProgMsgId=capOdProgMsgId;
window.capStripOdTags=capStripOdTags;
window.capSetOdTab=capSetOdTab;
window.capClientSectionVisible=capClientSectionVisible;
window.capLiveNavScreens=capLiveNavScreens;
window.capOdMsgId=capOdMsgId;

function capHomeworkWorkoutCard(w,accent,live,opts){
  opts=opts||{};
  const thumb=typeof odThumbUrl==='function'?odThumbUrl(w):'';
  const struct=typeof odWorkoutStructureText==='function'?odWorkoutStructureText(w):'';
  const mats=typeof odWorkoutMaterialsText==='function'?odWorkoutMaterialsText(w):'';
  const chips=typeof odWorkoutMetaChipsHTML==='function'?odWorkoutMetaChipsHTML(w):'';
  const playBtn=opts.taskId&&live
    ?`onclick="clientStartHomework('${escHtml(opts.taskId)}')"`
    :live?`onclick="openODWorkout('${escHtml(w.id)}')"`
    :`onclick="notify('Podgląd — klient odpala trening w apce')"`;
  return `<div style="background:${opts.done?'rgba(62,207,178,0.08)':CAP_S2};border:1px solid ${opts.done?'rgba(62,207,178,0.35)':CAP_S3};border-radius:16px;padding:14px;margin-bottom:12px;">
    ${thumb?`<div style="height:88px;border-radius:12px;background:#000 url('${escHtml(thumb)}') center/cover no-repeat;margin-bottom:10px;"></div>`:''}
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px;">
      <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};">${escHtml(w.emoji||'🏠')} ${escHtml(w.name||'')}</div>
      ${opts.done?`<span style="font-size:10px;color:var(--teal);">✓ Zrobione</span>`:''}
    </div>
    ${opts.trainerNote?`<div style="font-size:11px;color:${accent};margin-bottom:6px;line-height:1.5;">💬 ${escHtml(opts.trainerNote)}</div>`:''}
    <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:8px;line-height:1.5;">${escHtml(w.desc||'')}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${chips}</div>
    ${struct?`<div style="font-size:11px;color:${CAP_TEXT};margin-bottom:4px;"><strong>Plan:</strong> ${escHtml(struct)}</div>`:''}
    ${w&&w.structure&&w.structure.when&&w.format==='breath'?`<div style="font-size:11px;color:${CAP_MUTED};margin-bottom:4px;"><strong>Kiedy:</strong> ${escHtml(w.structure.when)}</div>`:''}
    ${mats?`<div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;"><strong>Materiały:</strong> ${escHtml(mats)}</div>`:''}
    ${opts.due?`<div style="font-size:10px;color:${CAP_MUTED};margin-bottom:10px;">Termin: ${escHtml(opts.due)}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" class="cap-btn-primary" style="flex:1;padding:11px;font-size:13px;" ${playBtn}>▶ Start treningu</button>
      ${opts.taskId&&live&&!opts.done?`<button type="button" class="cap-btn-primary" style="padding:11px;font-size:13px;background:${CAP_S3};" onclick="clientCompleteHomework('${escHtml(opts.taskId)}')">✓ Zrobione</button>`:''}
    </div>
  </div>`;
}
window.capHomeworkWorkoutCard=capHomeworkWorkoutCard;

function openODProgramClient(id){
  const p=(typeof allODPrograms==='function'?allODPrograms():(window.OD_PROGRAMS||[])).find(x=>x.id===id);
  if(!p){if(typeof notify==='function')notify('Nie znaleziono programu');return;}
  window._cliveOdProgId=id;
  window._capOdTab='programs';
  if(typeof capGoScreen==='function')capGoScreen('odprogram');
  else if(typeof setCapScreen==='function')setCapScreen('odprogram');
}
window.openODProgramClient=openODProgramClient;

function toggleODProgramDay(progId,weekIdx,dayIdx){
  if(!capIsLiveClient()){
    if(typeof notify==='function')notify('Podgląd — klient odhacza dni w swojej apce');
    return;
  }
  const cid=window._clientId||(window.CL[0]&&window.CL[0].id);
  if(!cid||!progId)return;
  if(typeof ensureODPrograms==='function')ensureODPrograms();
  window.OD_PROGRESS=window.OD_PROGRESS||[];
  let rec=typeof odProgramProgressFor==='function'?odProgramProgressFor(cid,progId):null;
  if(!rec){
    const docId=typeof odProgramProgressDocId==='function'?odProgramProgressDocId(cid,progId):((typeof newId==='function'?newId('odpr'):('odpr_'+Date.now())));
    rec=(typeof withTrainer==='function'?withTrainer:x=>x)({
      id:docId,
      clientId:cid,programId:progId,done:[],updatedAt:new Date().toISOString()
    });
    window.OD_PROGRESS.push(rec);
  }
  const key=typeof odProgramSessionKey==='function'?odProgramSessionKey(progId,weekIdx,dayIdx):(progId+':'+weekIdx+':'+dayIdx);
  rec.done=rec.done||[];
  const i=rec.done.indexOf(key);
  let markedDone=false;
  if(i>=0)rec.done.splice(i,1);
  else{rec.done.push(key);markedDone=true;}
  rec.updatedAt=new Date().toISOString();
  if(typeof persistById==='function')persistById('odProgress',rec);
  if(markedDone&&typeof odProgramNotifyAfterToggle==='function')odProgramNotifyAfterToggle(cid,progId,weekIdx,true);
  if(window._clientAppMode){
    if(typeof renderClientLive==='function')renderClientLive();
  }else if(typeof setCapScreen==='function'){
    setCapScreen('odprogram');
  }
}
window.toggleODProgramDay=toggleODProgramDay;

function openODProgramContinue(clientId){
  const cid=clientId||window._clientId||(window.CL[0]&&window.CL[0].id);
  const cont=typeof odProgramContinueForClient==='function'?odProgramContinueForClient(cid):null;
  if(!cont){
    if(typeof notify==='function')notify('Brak programu do kontynuacji');
    return;
  }
  window._cliveOdProgId=cont.prog.id;
  window._capOdTab='programs';
  if(cont.workout&&typeof openODWorkout==='function')openODWorkout(cont.workout.id);
  else if(typeof openODProgramClient==='function')openODProgramClient(cont.prog.id);
}
window.openODProgramContinue=openODProgramContinue;

function capClientPlan(c){
  return (window.PL||[])
    .filter(p=>p.clientId===c.id)
    .slice()
    .sort((a,b)=>{
      const ak=String(a.updatedAt||a.createdAt||a.id||'');
      const bk=String(b.updatedAt||b.createdAt||b.id||'');
      return bk.localeCompare(ak);
    })[0]||null;
}

function capTodaySlot(c){
  const plan=capClientPlan(c);
  const today=typeof todayYmd==='function'?todayYmd():(new Date().toISOString().slice(0,10));
  const sessions=(window.SE||[]).filter(s=>s.clientId===c.id);
  const doneToday=sessions.find(s=>s.date===today&&(s.source==='client'||s.source==='live'));
  const inPerson=sessions.filter(s=>s.date===today&&s.source!=='client');
  if(!plan)return{kind:'noplan',inPerson,plan:null,day:null,dayIdx:0};
  const days=plan.days||[];
  let dayIdx=typeof suggestedPlanDayIdx==='function'?suggestedPlanDayIdx(c.id,plan):0;
  if(doneToday&&doneToday.dayIdx!=null)dayIdx=doneToday.dayIdx;
  const day=days[dayIdx]||days[0]||null;
  const isRest=!day||day.rest||!(day.exercises||[]).length;
  if(doneToday)return{kind:'done',plan,day,dayIdx,session:doneToday,inPerson};
  if(typeof isClientTrainingDay==='function'&&!isClientTrainingDay(c.id,today,c)){
    const wds=typeof clientPreferredWeekdays==='function'?clientPreferredWeekdays(c):null;
    const labels=wds&&typeof preferredWeekdaysLabels==='function'?preferredWeekdaysLabels(wds).join('/'):'';
    const nextYmd=typeof nextClientTrainingDayYmd==='function'?nextClientTrainingDayYmd(c.id,today):null;
    return{kind:'rest',plan,day,dayIdx,inPerson,scheduleRest:true,scheduleLabels:labels,nextTrainingYmd:nextYmd};
  }
  if(days.length===7&&isRest)return{kind:'rest',plan,day,dayIdx,inPerson};
  const trainN=typeof planTrainingDayIdxs==='function'?planTrainingDayIdxs(plan).length:days.filter(d=>d&&!d.rest).length;
  const weekStart=typeof mondayYmd==='function'?mondayYmd():today;
  const weekDates=new Set(sessions.filter(s=>s.date>=weekStart&&s.date<=today&&(s.source==='client'||s.source==='live')).map(s=>s.date));
  if(trainN&&weekDates.size>=trainN)return{kind:'rest',plan,day,dayIdx,inPerson,weekComplete:true};
  if(isRest)return{kind:'rest',plan,day,dayIdx,inPerson};
  return{kind:'workout',plan,day,dayIdx,inPerson};
}

function capTodayExercises(c){
  const slot=capTodaySlot(c);
  const raw=(slot.day&&slot.day.exercises)||[];
  const parsed=raw.map(ex=>typeof parsePlanExercise==='function'?parsePlanExercise(ex):{name:ex.name||ex.n||String(ex),sets:ex.sets||'3',reps:ex.reps||'10',rest:ex.rest||'90s'});
  if(typeof applySsLabels==='function')applySsLabels(parsed);
  return parsed.map((p,i)=>{
    const coach=typeof resolveCoachMedia==='function'?resolveCoachMedia(p):{note:p.note||'',libTip:'',video:p.video||''};
    let sets=(p.sets&&p.reps)?(p.sets+'×'+p.reps):(p.sets||p.reps||'—');
    if(p.pct1rm&&typeof weightFromPct1RM==='function'){
      const w=weightFromPct1RM(c.id,p.name,p.pct1rm);
      sets+=w&&w.kg?` @${p.pct1rm}% → ${w.kg}kg`:` @${p.pct1rm}%`;
    }else if(p.kg){
      sets+=' @'+p.kg+'kg';
    }
    if(typeof isEmomExercise==='function'&&isEmomExercise(p))sets+=' · EMOM';
    const tag=typeof formatSetKindTag==='function'?formatSetKindTag(p):'';
    if(tag)sets+=' · '+tag;
    return{
      name:p.name,
      ssLabel:p.ssLabel||'',
      sets,
      rest:p.rest||'90s',
      note:coach.note||coach.libTip||'',
      video:coach.video||'',
      icons:typeof coachMediaIcons==='function'?coachMediaIcons(p):'',
      done:slot.kind==='done'
    };
  });
}

function capDayLabel(day,idx){
  if(!day)return 'Dzień '+(idx+1);
  return day.day||day.dayName||day.focus||day.muscles||('Dzień '+(idx+1));
}

function capSessionSetsText(e){
  if(!e)return '—';
  if(Array.isArray(e.sets)&&e.sets.length&&typeof e.sets[0]==='object'){
    return e.sets.map((st,i)=>(st.setNo||(i+1))+': '+(st.kg||0)+' kg × '+(st.reps||0)).join(' · ');
  }
  if(e.sets&&e.reps)return e.sets+'×'+e.reps+(e.kg?' @'+e.kg+'kg':'');
  if(typeof e.sets==='string')return e.sets;
  return '—';
}

function capWorkoutHistoryList(c,list,live,accent){
  if(!list||!list.length){
    return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:16px;text-align:center;color:${CAP_MUTED};font-size:12px;">Brak zapisanych treningów. Po skończonej sesji ocena i serie pojawią się tutaj.</div>`;
  }
  return list.map(s=>{
    const emoji=typeof sessionRatingEmoji==='function'?sessionRatingEmoji(s.feedback):'';
    const n=(s.exercises||[]).length;
    const sets=typeof sessionSetsCount==='function'?sessionSetsCount(s):n;
    return `<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-bottom:8px;cursor:pointer;" onclick="clientOpenSession('${escHtml(s.id)}')">
      <div style="font-size:22px;width:36px;text-align:center;flex-shrink:0;">${emoji||'🏋️'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};">${escHtml(s.type||s.title||'Trening')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-top:2px;">${escHtml(s.date||'')} · ${s.duration||'—'} min${n?' · '+n+' ćw.':''}${sets?' · '+sets+' serii':''}</div>
      </div>
      <span style="font-size:11px;color:${accent};">Szczegóły →</span>
    </button>`;
  }).join('');
}

function capGarminEntries(c){
  const cid=c&&c.id;
  return (window.METRIC_ENTRIES||[])
    .filter(e=>e&&e.source==='garmin'&&e.clientId===cid)
    .slice()
    .sort((a,b)=>((b.date||'')+' '+(b.createdAt||'')).localeCompare((a.date||'')+' '+(a.createdAt||'')));
}
function capLastGarmin(c){
  return capGarminEntries(c)[0]||null;
}
function capGarminSessions(c){
  const cid=c&&c.id;
  return (window.SE||[])
    .filter(s=>s&&s.source==='garmin'&&s.clientId===cid)
    .slice()
    .sort((a,b)=>((b.date||'')+'T'+(b.time||'')).localeCompare((a.date||'')+'T'+(a.time||'')));
}
function capResourceDomain(url){
  try{
    return new URL(url).hostname.replace(/^www\./i,'');
  }catch(e){
    const m=String(url||'').match(/https?:\/\/([^\/]+)/i);
    return m?m[1].replace(/^www\./i,''):'';
  }
}
function capIsYoutubeUrl(url){
  return /youtube\.com|youtu\.be/i.test(String(url||''));
}
function capYoutubeResources(){
  const list=typeof allResources==='function'?allResources():(window.USER_RESOURCES||[]);
  return list.filter(r=>capIsYoutubeUrl(r&&r.url));
}
function capClientResourceList(filter){
  const list=(typeof allResources==='function'?allResources():(window.USER_RESOURCES||[])).slice();
  const yt=[],rest=[];
  list.forEach(r=>(capIsYoutubeUrl(r&&r.url)?yt:rest).push(r));
  let ordered=yt.concat(rest);
  if(filter==='podcast')ordered=ordered.filter(r=>r&&(r.type==='podcast'||r.coll==='podcasts'));
  if(filter==='music')ordered=ordered.filter(r=>r&&(r.coll==='music'||r.cat==='muzyka'));
  return ordered;
}
function capSetResFilter(f){
  window._capResFilter=f||'all';
  if(typeof capGoScreen==='function')capGoScreen('resources');
  else if(typeof setCapScreen==='function')setCapScreen('resources');
}
window.capGarminEntries=capGarminEntries;
window.capLastGarmin=capLastGarmin;
window.capGarminSessions=capGarminSessions;
window.capResourceDomain=capResourceDomain;
window.capIsYoutubeUrl=capIsYoutubeUrl;
window.capYoutubeResources=capYoutubeResources;
window.capClientResourceList=capClientResourceList;
window.capSetResFilter=capSetResFilter;

function capMetricEntries(c,groupId){
  return(window.METRIC_ENTRIES||[]).filter(e=>e&&e.clientId===c.id&&(!groupId||e.groupId===groupId))
    .slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
}
function capSparklineSVG(points,color,w,h){
  const pts=(points||[]).filter(p=>p&&p.v>0);
  if(pts.length<2)return'';
  const W=w||320;const H=h||72;const pad={l:8,r:8,t:12,b:18};
  const iW=W-pad.l-pad.r;const iH=H-pad.t-pad.b;
  const minV=Math.min(...pts.map(p=>p.v))*0.98;
  const maxV=Math.max(...pts.map(p=>p.v))*1.02;
  const range=maxV-minV||1;
  const xs=pts.map((_,i)=>pad.l+(i/(pts.length-1||1))*iW);
  const ys=pts.map(p=>pad.t+iH-(((p.v-minV)/range)*iH));
  const path='M'+xs.map((x,i)=>x+','+ys[i]).join('L');
  const area=path+' L'+xs[xs.length-1]+','+(pad.t+iH)+' L'+xs[0]+','+(pad.t+iH)+' Z';
  const col=color||CAP_ACCENT;
  const dots=xs.map((x,i)=>'<circle cx="'+x+'" cy="'+ys[i]+'" r="3.5" fill="'+col+'" stroke="'+CAP_BG+'" stroke-width="1.5"><title>'+escHtml(String(pts[i].d||''))+': '+pts[i].v+'</title></circle>').join('');
  const xLab=(d,i)=>{if(i!==0&&i!==pts.length-1&&i!==Math.floor(pts.length/2))return'';const x=xs[i];return '<text x="'+x+'" y="'+(H-4)+'" text-anchor="middle" font-size="8" fill="'+CAP_MUTED+'">'+escHtml(String(d||'').slice(5))+'</text>';};
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" class="cap-chart-svg" style="width:100%;display:block;">'+
    '<defs><linearGradient id="capGrad'+String(col).replace(/[^a-z0-9]/gi,'')+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="'+col+'" stop-opacity="0.28"/><stop offset="100%" stop-color="'+col+'" stop-opacity="0.02"/></linearGradient></defs>'+
    '<path d="'+area+'" fill="url(#capGrad'+String(col).replace(/[^a-z0-9]/gi,'')+')"/>'+
    '<path d="'+path+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'+
    dots+pts.map((p,i)=>xLab(p.d,i)).join('')+
  '</svg>';
}
function capBarChartSVG(data,color,w,h){
  const rows=(data||[]).filter(d=>d);
  if(!rows.length)return'';
  const W=w||320;const H=h||88;const pad=24;
  const max=Math.max(...rows.map(d=>d.v||0),1);
  const bw=Math.floor((W-pad*2)/rows.length)-3;
  const col=color||CAP_ACCENT;
  const bars=rows.map((d,i)=>{
    const bh=Math.round(((d.v||0)/max)*(H-28));
    const x=pad+i*(bw+3);const y=H-16-bh;
    return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="4" fill="'+col+'" opacity="'+(d.v?0.88:0.15)+'"/>'+
      '<text x="'+(x+bw/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8" fill="'+CAP_MUTED+'">'+escHtml(String(d.l||''))+'</text>'+
      (d.v?'<text x="'+(x+bw/2)+'" y="'+(y-3)+'" text-anchor="middle" font-size="7" fill="'+col+'">'+d.v+'</text>':'');
  }).join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" class="cap-chart-svg" style="width:100%;display:block;">'+bars+'</svg>';
}
function capWeeklyVolume(clientId,weeks){
  const logged=typeof completedWorkouts==='function'?completedWorkouts(clientId):[];
  const now=new Date();const buckets=[];
  for(let i=(weeks||8)-1;i>=0;i--){
    const end=new Date(now);end.setDate(end.getDate()-i*7);
    const start=new Date(end);start.setDate(start.getDate()-6);
    const ds=start.toISOString().slice(0,10);const de=end.toISOString().slice(0,10);
    let vol=0,sessions=0,sets=0;
    logged.forEach(s=>{
      const d=s.date;if(!d||d<ds||d>de)return;
      sessions++;vol+=Number(s.volume)||0;
      sets+=typeof sessionSetsCount==='function'?sessionSetsCount(s):0;
    });
    buckets.push({l:'T'+(weeks-i),vol:Math.round(vol),sessions,sets});
  }
  return buckets;
}
function capClientProgressScreenHTML(c,accent){
  const live=capIsLiveClient();
  const w=typeof ppLatestWeight==='function'?ppLatestWeight(c):(c.weight||'—');
  const logged=typeof completedWorkouts==='function'?completedWorkouts(c.id):(window.SE||[]).filter(s=>s.clientId===c.id);
  const avg=typeof avgSessionRating==='function'?avgSessionRating(logged):0;
  const prs=typeof clientExercisePRs==='function'?clientExercisePRs(c.id).slice(0,10):[];
  const photosOn=typeof ppFeatureOn==='function'?ppFeatureOn(c):true;
  const massEntries=capMetricEntries(c,'mg1');
  const firstMass=massEntries[0]&&massEntries[0].values&&massEntries[0].values.m1;
  const lastMass=massEntries.length&&massEntries[massEntries.length-1].values&&massEntries[massEntries.length-1].values.m1;
  const massDiff=firstMass&&lastMass?(Math.round((lastMass-firstMass)*10)/10):null;
  const massPts=massEntries.map(e=>({d:e.date,v:parseFloat(e.values&&e.values.m1)||0})).filter(p=>p.v>0);
  const volWeeks=capWeeklyVolume(c.id,8);
  const totalVol=logged.reduce((s,x)=>s+(Number(x.volume)||0),0);
  const totalSets=logged.reduce((s,x)=>s+(typeof sessionSetsCount==='function'?sessionSetsCount(x):0),0);
  const days30=Date.now()-30*86400000;
  const sess30=logged.filter(s=>s.date&&new Date(s.date).getTime()>=days30).length;
  const checkins=(window.CHECKINS&&window.CHECKINS[c.id])||[];
  const ciFilled=checkins.filter(x=>x.status==='filled'&&x.answers).slice(-8);
  const ciPts=ciFilled.map(x=>({d:x.date,v:typeof scoreCheckinAnswers==='function'?scoreCheckinAnswers(x.answers):0})).filter(p=>p.v>0);
  const measureEntries=capMetricEntries(c,'mg2');
  const lastMeas=measureEntries[measureEntries.length-1];
  const mv=lastMeas&&lastMeas.values||{};
  const garmin=capGarminEntries(c);
  const stepsPts=garmin.slice(0,14).reverse().map(e=>({d:e.date,v:parseFloat(e.values&&e.values.m1)||0})).filter(p=>p.v>0);
  const maxPr=prs.length?Math.max(...prs.map(p=>p.epley||0),1):1;
  return `
    <div class="cap-section cap-progress-panel" style="padding-bottom:90px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-top:8px;gap:8px;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;">MOJE POSTĘPY</div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="capGoScreen('calendar')">📅 Kalendarz</button>
      </div>
      <div class="cap-stat-kpi-row" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">
        <div class="cap-stat-card" style="background:${CAP_S2};border-radius:16px;padding:14px;border:1px solid ${CAP_S3};">
          <div style="font-size:10px;color:${CAP_MUTED};font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:6px;">⚖️ Masa ciała</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${CAP_TEXT};line-height:1;">${escHtml(String(w))}<span style="font-size:12px;color:${CAP_MUTED};"> kg</span></div>
          ${massDiff!=null?'<div style="font-size:11px;margin-top:4px;color:'+(massDiff<=0?'#3ecfb2':'#ff8c42')+';">'+(massDiff>0?'+':'')+massDiff+' kg od startu</div>':''}
        </div>
        <div class="cap-stat-card" style="background:${CAP_S2};border-radius:16px;padding:14px;border:1px solid ${CAP_S3};">
          <div style="font-size:10px;color:${CAP_MUTED};font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:6px;">🏋️ Sesje (30 dni)</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${accent};line-height:1;">${sess30}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-top:4px;">łącznie ${logged.length} · ocena ${avg?avg+'/5':'—'}</div>
        </div>
        <div class="cap-stat-card" style="background:${CAP_S2};border-radius:16px;padding:14px;border:1px solid ${CAP_S3};">
          <div style="font-size:10px;color:${CAP_MUTED};font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:6px;">📦 Tonaż</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:${CAP_TEXT};line-height:1;">${totalVol>=1000?(Math.round(totalVol/100)/10)+'t':Math.round(totalVol)}<span style="font-size:11px;color:${CAP_MUTED};"> kg</span></div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-top:4px;">objętość (kg × powt.)</div>
        </div>
        <div class="cap-stat-card" style="background:${CAP_S2};border-radius:16px;padding:14px;border:1px solid ${CAP_S3};">
          <div style="font-size:10px;color:${CAP_MUTED};font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:6px;">🔢 Serie</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${CAP_TEXT};line-height:1;">${totalSets}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-top:4px;">zapisane serie robocze</div>
        </div>
      </div>
      ${massPts.length>=2?`<div class="cap-chart-card" style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">Trend masy ciała</div>
        <div style="font-size:10px;color:${CAP_MUTED};margin-bottom:10px;">Pomiary od trenera · ostatnie ${massPts.length} wpisów</div>
        ${capSparklineSVG(massPts,accent,340,80)}
      </div>`:''}
      <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:14px;">
        <div class="cap-chart-card" style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;">
          <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">Tonaż tygodniowy</div>
          <div style="font-size:10px;color:${CAP_MUTED};margin-bottom:10px;">Suma kg × powt. z zapisanych treningów</div>
          ${capBarChartSVG(volWeeks.map(wk=>({l:wk.l,v:wk.vol})),accent,340,92)}
        </div>
        ${ciPts.length>=2?`<div class="cap-chart-card" style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;">
          <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">Samopoczucie (check-in)</div>
          <div style="font-size:10px;color:${CAP_MUTED};margin-bottom:10px;">Energia · sen · stres · odżywianie</div>
          ${capSparklineSVG(ciPts,'#0055a4',340,72)}
        </div>`:''}
      </div>
      ${lastMeas?`<div class="cap-chart-card" style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">📏 Ostatnie obwody</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${[{k:'m1',l:'Klatka'},{k:'m2',l:'Talia'},{k:'m3',l:'Biodra'},{k:'m4',l:'Udo'},{k:'m5',l:'Ramię'}].map(x=>{
            const v=mv[x.k];if(!v)return'';
            return '<div style="background:'+CAP_S1+';border-radius:12px;padding:10px;text-align:center;border:1px solid '+CAP_S3+';"><div style="font-size:9px;color:'+CAP_MUTED+';text-transform:uppercase;">'+x.l+'</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:22px;color:'+CAP_TEXT+';">'+escHtml(String(v))+'<span style="font-size:10px;color:'+CAP_MUTED+';"> cm</span></div></div>';
          }).join('')}
        </div>
        <div style="font-size:10px;color:${CAP_MUTED};margin-top:8px;">${escHtml(lastMeas.date||'')}</div>
      </div>`:''}
      ${stepsPts.length>=2?`<div class="cap-chart-card" style="background:linear-gradient(135deg,rgba(0,124,195,0.15),rgba(0,124,195,0.04));border:1px solid rgba(0,124,195,0.35);border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:#5ec8ff;text-transform:uppercase;margin-bottom:6px;">⌚ Kroki (Garmin)</div>
        ${capSparklineSVG(stepsPts,'#5ec8ff',340,72)}
      </div>`:''}
      <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin:4px 0 10px;">🏆 Rekordy siłowe</div>
      ${prs.length?`<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">${prs.map(p=>{
        const est=typeof roundToPlate==='function'?roundToPlate(p.epley):Math.round(p.epley);
        const pct=Math.round(((p.epley||0)/maxPr)*100);
        return '<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:'+CAP_S2+';border:1px solid '+CAP_S3+';border-radius:14px;padding:12px 14px;cursor:pointer;" onclick="clientOpenExercise('+escHtml(JSON.stringify(p.name))+')">'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
          '<div style="font-size:16px;">🏆</div>'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:13px;font-weight:700;color:'+CAP_TEXT+';">'+escHtml(p.name)+'</div>'+
            '<div style="font-size:11px;color:'+CAP_MUTED+';margin-top:2px;">'+escHtml(formatSetLoad(p.kg,p.reps))+(est?' · 1RM ~'+escHtml(String(est))+' kg':'')+'</div>'+
            '<div style="height:4px;background:'+CAP_S3+';border-radius:99px;margin-top:8px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,'+accent+',#ff8c42);"></div></div>'+
          '</div>'+
          '<span style="font-size:10px;color:'+accent+';">→</span>'+
        '</div></button>';
      }).join('')}</div>`:`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:16px;text-align:center;color:${CAP_MUTED};font-size:12px;margin-bottom:14px;">Po zapisanych seriach tu wpadną rekordy (najlepszy kg × powt.).</div>`}
      ${photosOn&&typeof ppBlockHTML==='function'?ppBlockHTML(c,{live,accent}):''}
      <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin:16px 0 10px;">Historia treningów</div>
      ${capWorkoutHistoryList(c,logged.slice(0,20),live,accent)}
    </div>`;
}
window.capMetricEntries=capMetricEntries;
window.capSparklineSVG=capSparklineSVG;
window.capBarChartSVG=capBarChartSVG;
window.capWeeklyVolume=capWeeklyVolume;
window.capClientProgressScreenHTML=capClientProgressScreenHTML;

function capScreenHTML(scr,c){
  const accent=window.SETTINGS?.brand?.accentColor||CAP_ACCENT;
  const trainerName=getTrainerName();
  const sessions=(window.SE||[]).filter(s=>s.clientId===c.id);
  const plans=(window.PL||[]).filter(p=>p.clientId===c.id);
  const isH=typeof isHabit==='function'?isHabit:()=>false;
  const isC=typeof isChallenge==='function'?isChallenge:()=>false;
  const habits=(window.TASKS||[]).filter(t=>t.clientId===c.id&&isH(t));
  const challenges=(window.TASKS||[]).filter(t=>t.clientId===c.id&&isC(t)&&(typeof challengeVisible!=='function'||challengeVisible(t)));
  const isHw=typeof isHomework==='function'?isHomework:()=>false;
  const tasks=(window.TASKS||[]).filter(t=>t.clientId===c.id&&!isH(t)&&!isC(t)&&!isHw(t)&&t.status!=='done');
  const homeworkOpen=(window.TASKS||[]).filter(t=>t.clientId===c.id&&isHw(t)&&t.status!=='done');
  const packages=capIsLiveClient()
    ?(window.PACKAGES||[]).filter(p=>p.clientId===c.id)
    :(window.PACKAGES||[]).concat(window.PACKAGES?.length?[]:[{title:'10 sesji personalnych',sessions:10,sessionsUsed:4,price:1500,expiresDate:'2025-08-30'}]);

  const h=(html)=>html; // passthrough

  if(scr==='home'){
    const slot=capTodaySlot(c);
    const live=capIsLiveClient();
    const today=typeof todayYmd==='function'?todayYmd():'';
    const openTasks=tasks.filter(t=>t.status!=='done');
    const todayTasks=openTasks.filter(t=>!t.due||t.due<=today);
    const showTasks=todayTasks.length?todayTasks:openTasks.slice(0,5);
    const startBtn=(planId,dayIdx)=>live
      ?`onclick="cwOpen('${escHtml(planId)}',${dayIdx})"`
      :`onclick="notify('Podgląd — klient startuje trening w swojej apce')"`;
    const hero=(()=>{
      if(slot.kind==='noplan'){
        return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:22px 16px;margin-bottom:14px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">📋</div>
          <div style="font-size:15px;font-weight:700;color:${CAP_TEXT};margin-bottom:6px;">Brak planu na dziś</div>
          <div style="font-size:12px;color:${CAP_MUTED};line-height:1.6;">Twój trener wkrótce przypisze trening. Możesz napisać na czacie.</div>
        </div>`;
      }
      if(slot.kind==='done'){
        const n=((slot.session&&slot.session.exercises)||[]).length;
        const emoji=typeof sessionRatingEmoji==='function'?sessionRatingEmoji(slot.session.feedback):'';
        const sid=slot.session&&slot.session.id;
        return `<div style="background:linear-gradient(135deg,rgba(62,207,178,0.18),rgba(62,207,178,0.05));border:1px solid rgba(62,207,178,0.35);border-radius:18px;padding:18px;margin-bottom:14px;text-align:center;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--teal);text-transform:uppercase;margin-bottom:8px;">✓ ZROBIONE</div>
          <div style="font-size:18px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(capDayLabel(slot.day,slot.dayIdx))}</div>
          <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:12px;">${n?n+' ćwiczeń · ':''}${escHtml(String(slot.session.duration||''))} min · ${emoji?escHtml(emoji)+' ':''}ocena ${escHtml(String(slot.session.feedback||'—'))}/5</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${sid?`<button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;background:${CAP_S3};" onclick="clientOpenSession('${escHtml(sid)}')">Szczegóły treningu</button>`:''}
            <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;" ${startBtn(slot.plan.id,slot.dayIdx)}>↺ Powtórz trening</button>
          </div>
        </div>`;
      }
      if(slot.kind==='rest'){
        const other=(slot.plan.days||[]).map((d,i)=>({d,i})).filter(x=>!x.d.rest&&(x.d.exercises||[]).length);
        const restMsg=slot.scheduleRest
          ?('Dziś nie masz treningu w harmonogramie'+(slot.scheduleLabels?' ('+escHtml(slot.scheduleLabels)+')':'')+'.'+(slot.nextTrainingYmd&&typeof formatTrainingDayShortPl==='function'?' Następny: '+escHtml(formatTrainingDayShortPl(slot.nextTrainingYmd))+'.':''))
          :(slot.weekComplete?'W tym tygodniu plan jest odhaczony.':'Dziś regeneracja — sen, spacer, białko.');
        return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:22px 16px;margin-bottom:14px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">😴</div>
          <div style="font-size:16px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">Dzień wolny</div>
          <div style="font-size:12px;color:${CAP_MUTED};line-height:1.6;margin-bottom:12px;">${restMsg}</div>
          ${other.length?`<div style="font-size:11px;color:${CAP_MUTED};margin-bottom:8px;">${slot.scheduleRest?'Chcesz i tak trenować? Wybierz dzień planu:':'Albo odpal inny dzień planu:'}</div>
          <div style="display:flex;flex-direction:column;gap:6px;">${other.map(x=>`<button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;background:${CAP_S3};" ${startBtn(slot.plan.id,x.i)}>${escHtml(capDayLabel(x.d,x.i))}</button>`).join('')}</div>`:''}
        </div>`;
      }
      const list=capTodayExercises(c);
      return `<div style="background:linear-gradient(135deg,${accent}22,${accent}08);border:1px solid ${accent}44;border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:${accent};text-transform:uppercase;margin-bottom:6px;">📅 DZIŚ</div>
        <div style="font-size:20px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(capDayLabel(slot.day,slot.dayIdx))}</div>
        <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:12px;">${list.length} ćwiczeń · ${escHtml(slot.plan.name||'Plan')}</div>
        ${list.slice(0,4).map(ex=>`<div style="padding:8px 0;border-top:1px solid ${CAP_S3};">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
            <span style="color:${CAP_TEXT};">${ex.ssLabel?escHtml(ex.ssLabel)+' ':''}${escHtml(ex.name)}${ex.icons||''}</span>
            <span style="color:${CAP_MUTED};white-space:nowrap;">${escHtml(ex.sets)}</span>
          </div>
          ${ex.note?`<div style="font-size:11px;color:${CAP_MUTED};line-height:1.5;margin-top:4px;">${escHtml(ex.note)}</div>`:''}
          ${ex.video?`<div style="margin-top:6px;"><a href="${escHtml(ex.video)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:${accent};text-decoration:none;">▶ Film techniki</a></div>`:''}
        </div>`).join('')}
        ${list.length>4?`<div style="font-size:11px;color:${CAP_MUTED};padding-top:6px;">+${list.length-4} kolejnych</div>`:''}
        <button type="button" class="cap-btn-primary" style="margin-top:14px;padding:14px;font-size:15px;" ${startBtn(slot.plan.id,slot.dayIdx)}>▶ Start treningu</button>
      </div>`;
    })();
    const inPerson=slot.inPerson||[];
    return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="margin-bottom:18px;padding-top:8px;">
        <div style="font-size:13px;color:${CAP_MUTED};margin-bottom:2px;">Dzień dobry 👋</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;color:${CAP_TEXT};">${escHtml((c.name||'').split(' ')[0].toUpperCase())}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-top:2px;">${escHtml(trainerName)}</div>
      </div>
      ${hero}
      ${(()=>{
        const g=capLastGarmin(c);
        if(!g)return '';
        const v=g.values||{};
        return `<div style="background:linear-gradient(135deg,rgba(0,124,195,0.22),rgba(0,124,195,0.06));border:1px solid rgba(0,124,195,0.4);border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:#5ec8ff;text-transform:uppercase;margin-bottom:6px;">⌚ GARMIN</div>
          <div style="font-size:15px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(g.notes||'Aktywność')}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">${escHtml(g.date||'')}${v.m1?' · '+v.m1+' kroków':''}${v.m2?' · '+v.m2+' kcal':''}</div>
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;background:#007cc3;" onclick="capGoScreen('progress')">Zobacz pomiary Garmin</button>
        </div>`;
      })()}
      ${(()=>{
        const pods=capYoutubeResources().filter(r=>r.type==='podcast'||r.coll==='podcasts').slice(0,2);
        if(!pods.length)return '';
        return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">🎧 Podcasty YouTube (za darmo)</div>
          ${pods.map(r=>`<a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:8px 0;border-top:1px solid ${CAP_S3};text-decoration:none;">
            <div style="font-size:12px;color:${CAP_TEXT};">${escHtml(r.name)}</div>
            <div style="font-size:10px;color:${CAP_MUTED};margin-top:2px;">${escHtml(capResourceDomain(r.url)||'youtube.com')}</div>
          </a>`).join('')}
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;margin-top:10px;background:${CAP_S3};" onclick="capGoScreen('resources')">Więcej zasobów</button>
        </div>`;
      })()}
      ${(()=>{
        if(!capClientSectionVisible('ondemand'))return '';
        const cont=typeof odProgramContinueForClient==='function'?odProgramContinueForClient(c.id):null;
        if(cont&&cont.pct>0){
          const w=cont.workout;
          const thumb=w&&typeof odThumbUrl==='function'?odThumbUrl(w):'';
          return `<div style="background:linear-gradient(135deg,rgba(225,31,46,0.22),rgba(225,31,46,0.08));border:1px solid rgba(225,31,46,0.45);border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:${accent};text-transform:uppercase;margin-bottom:6px;">▶ KONTYNUUJ PROGRAM</div>
          <div style="font-size:15px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(cont.prog.name||'Program')}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">${escHtml(cont.next.day.label||(w&&w.name)||'Następny trening')} · ${cont.pct}% ukończone</div>
          <div style="height:4px;background:${CAP_S3};border-radius:99px;overflow:hidden;margin-bottom:12px;"><div style="height:100%;width:${cont.pct}%;background:${accent};"></div></div>
          ${thumb?`<div style="height:72px;border-radius:12px;background:#000 url('${escHtml(thumb)}') center/cover no-repeat;margin-bottom:10px;"></div>`:''}
          <button type="button" class="cap-btn-primary" style="padding:12px;font-size:14px;width:100%;margin-bottom:8px;" onclick="openODProgramContinue('${escHtml(c.id)}')">▶ Kontynuuj trening</button>
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;width:100%;background:${CAP_S3};" onclick="openODProgramClient('${escHtml(cont.prog.id)}')">Cały program</button>
        </div>`;
        }
        const progList=(typeof allODPrograms==='function'?allODPrograms():(window.OD_PROGRAMS||[])).filter(p=>(typeof odProgramWorkoutCount==='function'?odProgramWorkoutCount(p)>0:p.status==='active')&&p.status!=='draft').slice(0,2);
        if(!progList.length)return '';
        return `<div style="background:linear-gradient(135deg,rgba(225,31,46,0.18),rgba(225,31,46,0.05));border:1px solid rgba(225,31,46,0.35);border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:${accent};text-transform:uppercase;margin-bottom:6px;">▶ ON-DEMAND</div>
          <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">Programy YouTube (za darmo)</div>
          ${progList.map(p=>`<button type="button" onclick="openODProgramClient('${escHtml(p.id)}')" style="width:100%;text-align:left;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer;color:inherit;">
              <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};">${escHtml(p.emoji||'📋')} ${escHtml(p.name)}</div>
              <div style="font-size:10px;color:${CAP_MUTED};margin-top:4px;line-height:1.4;">${escHtml(p.desc||'')}</div>
            </button>`).join('')}
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;" onclick="capGoScreen('ondemand')">Wszystkie programy</button>
        </div>`;
      })()}
      ${(()=>{
        if(!capClientSectionVisible('homework')||!homeworkOpen.length)return '';
        const t=homeworkOpen[0];
        const w=(typeof allODWorkouts==='function'?allODWorkouts():[]).find(x=>x.id===t.odWorkoutId);
        if(!w)return '';
        return `<div style="background:linear-gradient(135deg,rgba(0,85,164,0.22),rgba(0,85,164,0.06));border:1px solid rgba(0,85,164,0.4);border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:#5ec8ff;text-transform:uppercase;margin-bottom:6px;">🏡 ZADANIE DOMOWE</div>
          <div style="font-size:15px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(t.title||w.name)}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">${escHtml(typeof odWorkoutStructureText==='function'?odWorkoutStructureText(w):'')}${homeworkOpen.length>1?' · +'+(homeworkOpen.length-1)+' kolejne':''}</div>
          <button type="button" class="cap-btn-primary" style="padding:12px;font-size:14px;width:100%;" onclick="capGoScreen('homework')">Otwórz zadania domowe →</button>
        </div>`;
      })()}
      ${inPerson.length?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:16px;padding:16px;margin-bottom:14px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:${accent};text-transform:uppercase;margin-bottom:8px;">SALA Z TRENEREM</div>
        ${inPerson.map(s=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${accent};line-height:1;">${escHtml(s.time||'—')}</div>
          <div><div style="font-size:14px;font-weight:700;color:${CAP_TEXT};">${escHtml(s.type||'Trening personalny')}</div>
          <div style="font-size:11px;color:${CAP_MUTED};">${escHtml(String(s.duration||60))} min</div></div>
        </div>`).join('')}
        <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;" ${live?'onclick="clientConfirmAttendance()"':''}>✓ Potwierdzam obecność</button>
      </div>`:''}
      ${(()=>{
        if(!live||typeof pendingCheckin!=='function')return '';
        const pend=pendingCheckin(c.id);
        if(!pend)return '';
        return `<div style="background:linear-gradient(135deg,rgba(62,207,178,0.18),rgba(62,207,178,0.05));border:1px solid rgba(62,207,178,0.35);border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--teal);text-transform:uppercase;margin-bottom:6px;">✅ CHECK-IN</div>
          <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">Check-in tygodniowy czeka</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">Zajmie ok. 2 minuty — energia, sen, treningi.</div>
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;" onclick="setClientLiveScreen('checkin')">Wypełnij teraz</button>
        </div>`;
      })()}
      ${(()=>{
        const pend=typeof pendingFormSends==='function'?pendingFormSends(c.id):[];
        if(!pend.length)return '';
        return `<div style="background:linear-gradient(135deg,rgba(157,124,244,0.18),rgba(157,124,244,0.05));border:1px solid rgba(157,124,244,0.35);border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--purple);text-transform:uppercase;margin-bottom:6px;">📋 FORMULARZ</div>
          <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${pend.length===1?escHtml(pend[0].formName||'Formularz do wypełnienia'):pend.length+' formularze do wypełnienia'}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">Trener czeka na Twoje odpowiedzi.</div>
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;" onclick="${pend.length===1?`clientOpenForm('${escHtml(pend[0].id)}')`:`setClientLiveScreen('forms')`}">${pend.length===1?'Wypełnij teraz':'Zobacz listę'}</button>
        </div>`;
      })()}
      ${habits.length?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">🔥 Nawyki</div>
        ${habits.map(t=>{
          const done=typeof habitDoneOn==='function'&&today?habitDoneOn(t,today):false;
          const streak=typeof habitStreak==='function'&&today?habitStreak(t,today):0;
          return `<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:8px 0;" ${live?`onclick="clientToggleTask('${escHtml(t.id)}')"`:''}>
          <div class="cap-check-circle">${done?'✓':''}</div>
          <div style="flex:1;"><div style="font-size:12px;color:${CAP_TEXT};">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:${CAP_MUTED};">${streak?'🔥 '+streak+' '+(streak===1?'dzień':'dni')+' z rzędu':'Odhacz na dziś'}</div>
          </div>
        </button>`;
        }).join('')}
      </div>`:''}
      ${challenges.length?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">🏆 Wyzwania</div>
        ${challenges.map(t=>{
          const done=typeof habitDoneOn==='function'&&today?habitDoneOn(t,today):false;
          const st=typeof challengeStatusText==='function'?challengeStatusText(t,today):'';
          const bar=typeof challengeBarHtml==='function'?challengeBarHtml(t,today):'';
          const p=typeof challengeProgress==='function'?challengeProgress(t,today):null;
          const tick=done||(p&&p.won&&!p.active);
          const can=typeof challengeCanCheck==='function'?challengeCanCheck(t,today,today):true;
          return `<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:none;border:none;cursor:${can?'pointer':'default'};padding:8px 0;" ${live&&can?`onclick="clientToggleTask('${escHtml(t.id)}')"`:''}>
          <div class="cap-check-circle">${tick?'✓':''}</div>
          <div style="flex:1;"><div style="font-size:12px;color:${CAP_TEXT};">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:${p&&p.won?'var(--teal)':CAP_MUTED};">${escHtml(st)}</div>
          ${bar}
          </div>
        </button>`;
        }).join('')}
      </div>`:''}
      ${showTasks.length?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">Zadania na dziś</div>
        ${showTasks.map(t=>`<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:8px 0;" ${live?`onclick="clientToggleTask('${escHtml(t.id)}')"`:''}>
          <div class="cap-check-circle">${t.status==='done'?'✓':''}</div>
          <div style="flex:1;"><div style="font-size:12px;color:${CAP_TEXT};">${escHtml(t.title)}</div>
          ${t.due?`<div style="font-size:10px;color:${CAP_MUTED};">Do: ${escHtml(t.due)}</div>`:''}
          </div>
        </button>`).join('')}
      </div>`:''}
      ${(()=>{
        if(!live||typeof ppFeatureOn!=='function'||!ppFeatureOn(c))return '';
        const n=(typeof ppListFor==='function'?ppListFor(c.id):[]).length;
        if(n)return '';
        return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">📸 Zdjęcia startowe</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">Przód, bok i tył — potem porównasz efekty.</div>
          <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;" onclick="setClientLiveScreen('progress');setTimeout(()=>ppOpenDraft(),50)">Zrób zdjęcia</button>
        </div>`;
      })()}
    </div>`;
  }

  if(scr==='plan') return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:16px;padding-top:8px;">MÓJ PLAN</div>
      ${(()=>{
        const plan=capClientPlan(c);
        if(!plan)return `
        <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:20px;text-align:center;margin-bottom:14px;">
          <div style="font-size:32px;margin-bottom:8px;">📋</div>
          <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};margin-bottom:6px;">Brak planu</div>
          <div style="font-size:11px;color:${CAP_MUTED};">Twój trener wkrótce przypisze Ci plan treningowy.</div>
        </div>`;
        const p=plan;
        return `
        <div style="background:linear-gradient(135deg,${accent}22,${accent}08);border:1px solid ${accent}44;border-radius:18px;padding:16px;margin-bottom:14px;">
          <div style="font-size:15px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(p.name)}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:12px;">${escHtml(p.method||'')} · ${escHtml(String(p.duration||''))} tygodni</div>
        </div>
        ${(p.days||[]).map((d,i)=>{
          const rest=d.rest||!(d.exercises||[]).length;
          const live=capIsLiveClient();
          const detailHtml=rest?'':(d.exercises||[]).map(ex=>{
            const parsed=typeof parsePlanExercise==='function'?parsePlanExercise(ex):(typeof ex==='string'?{name:ex}:ex||{});
            const coach=typeof resolveCoachMedia==='function'?resolveCoachMedia(parsed):{note:parsed.note||'',libTip:'',video:parsed.video||''};
            const icons=typeof coachMediaIcons==='function'?coachMediaIcons(parsed):'';
            return `<div style="padding:8px 0;border-top:1px solid ${CAP_S3};">
              <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
                <span style="color:${CAP_TEXT};">${escHtml(parsed.name||'Ćwiczenie')}${icons}</span>
                <span style="color:${CAP_MUTED};white-space:nowrap;">${escHtml((parsed.sets&&parsed.reps)?(parsed.sets+'×'+parsed.reps):(parsed.sets||parsed.reps||'—'))}</span>
              </div>
              ${coach.note?`<div style="font-size:11px;color:${CAP_MUTED};line-height:1.5;margin-top:4px;">${escHtml(coach.note)}</div>`:''}
              ${!coach.note&&coach.libTip?`<div style="font-size:11px;color:${CAP_MUTED};line-height:1.5;margin-top:4px;">${escHtml(coach.libTip)}</div>`:''}
              ${coach.video?`<div style="margin-top:6px;"><a href="${escHtml(coach.video)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:${accent};text-decoration:none;">▶ Film techniki</a></div>`:''}
            </div>`;
          }).join('');
          return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div>
                <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};">${escHtml(capDayLabel(d,i))}${rest?' · rest':''}</div>
                <div style="font-size:11px;color:${CAP_MUTED};">${rest?'Odpoczynek':((d.exercises||[]).length+' ćwiczeń')}</div>
              </div>
              ${rest?'':`<button type="button" class="btn btn-primary btn-sm" ${live?`onclick="cwOpen('${escHtml(p.id)}',${i})"`:`onclick="notify('Podgląd')"`}>▶ Start</button>`}
            </div>
            ${detailHtml?`<div style="margin-top:10px;">${detailHtml}</div>`:''}
          </div>`;
        }).join('')}
      `;
      })()}
    </div>`;

  if(scr==='calendar'){
    const live=capIsLiveClient();
    const now=new Date();
    const cal=window._cliveCal||{y:now.getFullYear(),m:now.getMonth()};
    window._cliveCal=cal;
    const monthNames=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const first=new Date(cal.y,cal.m,1);
    const startDow=(first.getDay()+6)%7;
    const dim=new Date(cal.y,cal.m+1,0).getDate();
    const today=typeof todayYmd==='function'?todayYmd():'';
    const logged=typeof completedWorkouts==='function'?completedWorkouts(c.id):sessions.filter(s=>s.source==='client'||s.source==='live');
    const garminSess=capGarminSessions(c);
    const garminDates=new Set(garminSess.map(s=>s.date).concat(capGarminEntries(c).map(e=>e.date)));
    const doneDates=new Set(logged.map(s=>s.date));
    const upcoming=sessions.filter(s=>s.date&&s.date>=today&&s.source!=='client'&&s.source!=='live'&&s.source!=='garmin').sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(0,5);
    const cells=[];
    for(let i=0;i<startDow;i++)cells.push('<div></div>');
    for(let d=1;d<=dim;d++){
      const ymd=cal.y+'-'+String(cal.m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const isToday=ymd===today;
      const has=doneDates.has(ymd);
      const hasG=garminDates.has(ymd);
      const sid=has?(logged.find(s=>s.date===ymd)||{}).id:(hasG?(garminSess.find(s=>s.date===ymd)||{}).id:'');
      const bg=isToday?accent:has?accent+'22':hasG?'rgba(0,124,195,0.28)':'transparent';
      const col=isToday?'#000':has?accent:hasG?'#5ec8ff':CAP_MUTED;
      cells.push(`<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:12px;background:${bg};color:${col};font-weight:${isToday||has||hasG?700:400};${sid?'cursor:pointer;':''}" ${sid?`onclick="clientOpenSession('${escHtml(sid)}')"`:''}>${d}</div>`);
    }
    return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:16px;padding-top:8px;">KALENDARZ</div>
      <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <button type="button" style="background:none;border:none;color:${CAP_MUTED};font-size:18px;cursor:pointer;" onclick="clientCalNav(-1)">‹</button>
          <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};">${monthNames[cal.m]} ${cal.y}</div>
          <button type="button" style="background:none;border:none;color:${CAP_MUTED};font-size:18px;cursor:pointer;" onclick="clientCalNav(1)">›</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;margin-bottom:8px;">
          ${['P','W','Ś','C','P','S','N'].map(d=>`<div style="font-size:9px;color:${CAP_MUTED};padding:4px 0;">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">${cells.join('')}</div>
        <div style="display:flex;gap:12px;margin-top:10px;font-size:10px;color:${CAP_MUTED};">
          <span>● zrobiony trening</span>
          ${garminDates.size?`<span style="color:#5ec8ff;">● Garmin</span>`:''}
        </div>
      </div>
      ${upcoming.length?`<div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">Nadchodzące z trenerem</div>
      ${upcoming.map(s=>`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;">
        <div style="background:${accent}22;border-radius:10px;padding:8px 12px;text-align:center;flex-shrink:0;">
          <div style="font-size:11px;color:${accent};font-family:'DM Mono',monospace;">${escHtml((s.date||'').slice(5,7)||'—')}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${accent};line-height:1;">${escHtml((s.date||'').slice(8,10)||'—')}</div>
        </div>
        <div><div style="font-size:13px;font-weight:700;color:${CAP_TEXT};">${escHtml(s.type||'Sesja')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};">⏰ ${escHtml(s.time||'')} · z ${escHtml(trainerName)}</div></div>
      </div>`).join('')}`:''}
      ${garminSess.length?`<div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin:14px 0 10px;">Z zegarka Garmin</div>
      ${garminSess.slice(0,8).map(s=>`<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:${CAP_S2};border:1px solid rgba(0,124,195,0.35);border-radius:14px;padding:14px;margin-bottom:8px;cursor:pointer;display:flex;gap:12px;align-items:center;" onclick="clientOpenSession('${escHtml(s.id)}')">
        <div style="background:rgba(0,124,195,0.22);border-radius:10px;padding:8px 12px;text-align:center;flex-shrink:0;">
          <div style="font-size:11px;color:#5ec8ff;font-family:'DM Mono',monospace;">${escHtml((s.date||'').slice(5,7)||'—')}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#5ec8ff;line-height:1;">${escHtml((s.date||'').slice(8,10)||'—')}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};">⌚ ${escHtml(typeof sessionTitle==='function'?sessionTitle(s):(s.notes||s.type||'Garmin'))}</div>
          <div style="font-size:11px;color:${CAP_MUTED};">${escHtml(s.time||'')} · ${escHtml(String(s.duration||'—'))} min · import CSV</div>
        </div>
      </button>`).join('')}`:''}
      <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin:14px 0 10px;">Ostatnie treningi</div>
      ${capWorkoutHistoryList(c,logged.slice(0,8),live,accent)}
    </div>`;
  }

  if(scr==='progress'){
    return capClientProgressScreenHTML(c,accent);
  }

  if(scr==='session'){
    const live=capIsLiveClient();
    const s=(window.SE||[]).find(x=>x.id===window._cliveSessionId&&x.clientId===c.id);
    if(!s){
      return `<div class="cap-section" style="padding-bottom:90px;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="capGoScreen('progress')">← Postępy</button>
        <div style="text-align:center;padding:40px;color:${CAP_MUTED};font-size:12px;">Nie znaleziono treningu.</div>
      </div>`;
    }
    const src=s.source==='garmin'?'Garmin':s.source==='client'?'Ty w apce':s.source==='live'?'Z trenerem (live)':'Sesja';
    const title=typeof sessionTitle==='function'?sessionTitle(s):(s.notes||s.type||s.title||'Trening');
    const gMetric=s.source==='garmin'?capGarminEntries(c).find(e=>e.date===s.date&&(e.notes||'')===(s.notes||'')):null;
    const gv=gMetric&&gMetric.values||{};
    return `<div class="cap-section" style="padding-bottom:90px;">
      <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="capGoScreen('progress')">← Postępy</button>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:4px;">${escHtml(title)}</div>
      <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:14px;">${escHtml(s.date||'')} ${escHtml(s.time||'')} · ${escHtml(src)}${s.duration?' · '+escHtml(String(s.duration))+' min':''}</div>
      ${s.source==='garmin'?`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid rgba(0,124,195,0.35);">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#5ec8ff;">${escHtml(String(gv.m1||'—'))}</div>
          <div style="font-size:10px;color:${CAP_MUTED};">kroków</div>
        </div>
        <div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid rgba(0,124,195,0.35);">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#5ec8ff;">${escHtml(String(gv.m2||s.duration||'—'))}</div>
          <div style="font-size:10px;color:${CAP_MUTED};">${gv.m2?'kcal':'min'}</div>
        </div>
        <div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid rgba(0,124,195,0.35);">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${CAP_TEXT};">${escHtml(String(gv.m3||gv.m5||'—'))}</div>
          <div style="font-size:10px;color:${CAP_MUTED};">${gv.m3?'tętno':gv.m5?'km':'Garmin'}</div>
        </div>
      </div>`:`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid ${CAP_S3};">
          <div style="font-size:20px;">${escHtml(sessionRatingEmoji(s.feedback)||'—')}</div>
          <div style="font-size:10px;color:${CAP_MUTED};margin-top:4px;">${escHtml((SESSION_RATING[Number(s.feedback)]||{}).label||'Brak oceny')}</div>
        </div>
        <div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid ${CAP_S3};">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${accent};">${(s.exercises||[]).length}</div>
          <div style="font-size:10px;color:${CAP_MUTED};">ćwiczeń</div>
        </div>
        <div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid ${CAP_S3};">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${CAP_TEXT};">${s.volume||sessionSetsCount(s)}</div>
          <div style="font-size:10px;color:${CAP_MUTED};">${s.volume?'kg obj.':'serii'}</div>
        </div>
      </div>`}
      ${(s.exercises||[]).length?(s.exercises||[]).map(e=>`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:12px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(e.name||'')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};font-family:'DM Mono',monospace;">${escHtml(capSessionSetsText(e))}</div>
      </div>`).join(''):(s.source==='garmin'?`<div style="background:${CAP_S2};border:1px solid rgba(0,124,195,0.35);border-radius:14px;padding:16px;text-align:center;color:${CAP_MUTED};font-size:12px;">Import CSV z Garmin Connect — bez serii siłowych.</div>`:`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:16px;text-align:center;color:${CAP_MUTED};font-size:12px;">Brak zapisanych serii.</div>`)}
      ${s.note||s.notes?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-top:6px;">
        <div style="font-size:10px;color:${CAP_MUTED};text-transform:uppercase;margin-bottom:6px;">Komentarz</div>
        <div style="font-size:13px;color:${CAP_TEXT};line-height:1.5;">${escHtml(s.note||s.notes||'')}</div>
      </div>`:''}
      ${!live?'<div style="font-size:11px;color:'+CAP_MUTED+';margin-top:12px;text-align:center;">Podgląd — klient otwiera to w swojej apce</div>':''}
    </div>`;
  }

  if(scr==='exercise'){
    const live=capIsLiveClient();
    const name=window._cliveExerciseName||'';
    const pr=typeof exercisePR==='function'?exercisePR(c.id,name):null;
    const days=typeof exerciseHistoryByDay==='function'?exerciseHistoryByDay(c.id,name).slice(0,16):[];
    const est=pr&&typeof roundToPlate==='function'?roundToPlate(pr.epley):'';
    const back=live?"setClientLiveScreen('progress')":"setCapScreen('progress')";
    return `<div class="cap-section" style="padding-bottom:90px;">
      <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="${back}">← Postępy</button>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:4px;">${escHtml(name||'Ćwiczenie')}</div>
      <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:14px;">Historia serii — jak w Everfit: ostatnio i rekord.</div>
      ${pr?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:16px;padding:16px;margin-bottom:14px;text-align:center;">
        <div style="font-size:11px;color:${CAP_MUTED};text-transform:uppercase;margin-bottom:6px;">🏆 Rekord</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${accent};">${escHtml(formatSetLoad(pr.kg,pr.reps))}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-top:4px;">${escHtml(pr.date||'')}${est?' · szac. 1RM '+escHtml(String(est))+' kg':''}</div>
      </div>`:`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:16px;text-align:center;color:${CAP_MUTED};font-size:12px;margin-bottom:14px;">Brak zapisanych serii tego ćwiczenia.</div>`}
      ${days.map(d=>`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:12px;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:6px;">${escHtml(d.date)}</div>
        <div style="font-size:11px;color:${CAP_MUTED};font-family:'DM Mono',monospace;">${(d.sets||[]).slice().reverse().map(st=>escHtml(formatSetLoad(st.kg,st.reps))).join(' · ')}</div>
      </div>`).join('')}
      ${!live?'<div style="font-size:11px;color:'+CAP_MUTED+';margin-top:12px;text-align:center;">Podgląd — klient otwiera to w swojej apce</div>':''}
    </div>`;
  }

  if(scr==='checkin'){
    const st=window._cliveCheckin||{};
    const live=capIsLiveClient();
    if(live&&typeof filledThisWeek==='function'&&filledThisWeek(c.id)&&!(typeof pendingCheckin==='function'&&pendingCheckin(c.id))){
      const last=filledThisWeek(c.id);
      return `<div class="cap-section" style="padding-bottom:90px;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:8px;padding-top:8px;">CHECK-IN</div>
        <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:20px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">✓</div>
          <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};margin-bottom:6px;">W tym tygodniu już wysłane</div>
          <div style="font-size:12px;color:${CAP_MUTED};">Score ${escHtml(String(last.score||'—'))}% · ${escHtml(last.date||'')}</div>
        </div>
      </div>`;
    }
    const qrow=(field,label,emoji)=>{
      const selected=st[field]!=null?st[field]:(live?null:2);
      return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:10px;">
        <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:10px;">${label}</div>
        <div style="display:flex;justify-content:space-between;">
          ${emoji.map((e,i)=>`<button type="button" class="clive-check-opt${selected===i+1?' on':''}" ${live?`onclick="capPickCheckin('${field}',${i+1})"`:''}>${e}</button>`).join('')}
        </div>
      </div>`;
    };
    return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:4px;padding-top:8px;">CHECK-IN TYGODNIOWY</div>
      <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:20px;">${live?'Wypełnij i wyślij do trenera':'Podgląd formularza'}</div>
      ${qrow('energy','Poziom energii',['😴','😪','😐','😊','⚡'])}
      ${qrow('sleep','Jakość snu',['😴','😪','😐','😊','🌟'])}
      ${qrow('stress','Poziom stresu (1=niski)',['🧘','😌','😐','😰','🤯'])}
      ${qrow('nutrition','Odżywianie',['🍕','🌮','😐','🥗','💪'])}
      <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:10px;">
        <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:10px;">Ile treningów wykonałeś/aś?</div>
        <div style="display:flex;justify-content:space-between;">
          ${[0,1,2,3,4,5].map(n=>`<button type="button" class="clive-check-opt${st.workouts===n?' on':''}" style="font-family:'Bebas Neue',sans-serif;font-size:20px;" ${live?`onclick="capPickCheckin('workouts',${n})"`:''}>${n}</button>`).join('')}
        </div>
      </div>
      ${live?`
      <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:10px;">
        <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:8px;">Masa ciała (opcjonalnie)</div>
        <input type="number" inputmode="decimal" class="form-input" value="${escHtml(st.weight||'')}" oninput="window._cliveCheckin=window._cliveCheckin||{};window._cliveCheckin.weight=this.value" placeholder="kg" style="font-size:16px;">
      </div>
      <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:8px;">Komentarz dla trenera</div>
        <textarea class="form-textarea" rows="3" oninput="window._cliveCheckin=window._cliveCheckin||{};window._cliveCheckin.notes=this.value" placeholder="Jak minął tydzień?">${escHtml(st.notes||'')}</textarea>
      </div>
      <button type="button" class="cap-btn-primary" onclick="clientSubmitCheckin()">✓ Wyślij check-in</button>`
      :`<button class="cap-btn-primary">✓ Wyślij check-in</button>`}
    </div>`;
  }

  if(scr==='messages'){
    const realMsgs=(typeof MSGS!=='undefined'&&MSGS[c.id])?MSGS[c.id].slice(-20):[];
    const fmtMsg=(m)=>{
      const raw=String(m.text||'');
      const odId=capOdMsgId(raw);
      const odProgId=capOdProgMsgId(raw);
      const display=escHtml(capStripOdTags(raw));
      return {out:!!m.out,text:display,time:m.time||'',odId,odProgId};
    };
    const msgs=realMsgs.length?realMsgs.map(fmtMsg):[
      {out:false,text:escHtml('Hej! Napisz do mnie, gdy będziesz miał pytanie o trening 💪'),time:'',odId:null}
    ];
    const liveOd=capIsLiveClient()&&capClientSectionVisible('ondemand');
    return `
    <div style="display:flex;flex-direction:column;height:100%;padding-bottom:80px;">
      <div style="padding:12px 16px;border-bottom:1px solid ${CAP_S3};display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <div style="width:36px;height:36px;border-radius:50%;background:${accent}22;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:${accent};">${escHtml(getInit(trainerName))}</div>
        <div><div style="font-size:13px;font-weight:700;color:${CAP_TEXT};">${escHtml(trainerName)}</div>
        <div style="font-size:10px;color:var(--teal);">Trener</div></div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:14px 12px;">
        ${msgs.map(m=>`<div style="margin-bottom:10px;${!m.out?'text-align:right;':''}">
          <div style="display:inline-block;max-width:80%;padding:10px 14px;border-radius:${!m.out?'16px 4px 16px 16px':'4px 16px 16px 16px'};background:${!m.out?accent:CAP_S2};color:${!m.out?'#000':CAP_TEXT};font-size:12px;line-height:1.5;border:${!m.out?'none':'1px solid '+CAP_S3};white-space:pre-wrap;">${m.text}${m.odProgId&&liveOd?`<div style="margin-top:10px;"><button type="button" class="cap-btn-primary" style="padding:8px 12px;font-size:12px;width:100%;background:${CAP_S3};" onclick="openODProgramClient('${escHtml(m.odProgId)}')">📋 Otwórz program</button></div>`:''}${m.odId&&liveOd?`<div style="margin-top:10px;"><button type="button" class="cap-btn-primary" style="padding:8px 12px;font-size:12px;width:100%;" onclick="openODWorkout('${escHtml(m.odId)}')">▶ Odtwórz trening</button></div>`:''}</div>
          <div style="font-size:9px;color:${CAP_MUTED};margin-top:3px;">${escHtml(m.time)}</div>
        </div>`).join('')}
      </div>
      <div style="padding:10px 12px;background:${CAP_S1};border-top:1px solid ${CAP_S3};display:flex;gap:8px;align-items:center;">
        ${capIsLiveClient()?`
        <input id="clive-chat-input" class="form-input" placeholder="Napisz do trenera..." style="flex:1;font-size:16px;border-radius:20px;" onkeydown="if(event.key==='Enter'){event.preventDefault();clientSendChat();}">
        <button type="button" class="btn btn-primary btn-sm" onclick="clientSendChat()">Wyślij</button>`
        :`<div style="flex:1;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:20px;padding:10px 14px;font-size:12px;color:${CAP_MUTED};">Podgląd — odpowiedź w panelu trenera</div>`}
      </div>
    </div>`;
  }

  if(scr==='homework'){
    const live=capIsLiveClient();
    const filter=window._capHwFilter||'all';
    const hwTasks=(window.TASKS||[]).filter(t=>t.clientId===c.id&&typeof isHomework==='function'&&isHomework(t));
    const openHw=hwTasks.filter(t=>t.status!=='done').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    const doneHw=hwTasks.filter(t=>t.status==='done').slice(0,5);
    const allW=(typeof allODWorkouts==='function'?allODWorkouts():(window.OD_WORKOUTS||[]));
    const fmtMatch=(w,f)=>{
      if(f==='all')return true;
      if(f==='dom')return w.coll==='dom'||w.equipment==='none';
      if(f==='mobilnosc')return w.coll==='mobilnosc'||w.format==='mobility'||w.format==='stretch';
      if(f==='hiit')return w.format==='hiit'||w.coll==='hiit';
      if(f==='tabata')return w.format==='tabata';
      if(f==='cardio')return w.format==='hiit'||w.format==='tabata'||w.format==='cardio';
      if(f==='oddech')return w.coll==='oddech'||w.format==='breath';
      return w.format===f||w.coll===f;
    };
    const lib=allW.filter(w=>fmtMatch(w,filter));
    const pill=(id,label)=>`<button type="button" class="btn ${filter===id?'btn-primary':'btn-ghost'} btn-sm" onclick="window._capHwFilter='${id}';capGoScreen('homework')">${label}</button>`;
    const resolveW=t=>(allW.find(x=>x.id===t.odWorkoutId)||null);
    return `<div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:4px;padding-top:8px;">ZADANIA DOMOWE</div>
      <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:14px;line-height:1.6;">Treningi w domu + metody oddychania (box, 4-7-8, przeponowy) — czas, cykle wdech/wydech i materiały.</div>
      ${openHw.length?`<div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:10px;">📌 Od trenera (${openHw.length})</div>
        ${openHw.map(t=>{const w=resolveW(t);if(!w)return `<div style="font-size:12px;color:${CAP_MUTED};margin-bottom:8px;">${escHtml(t.title)} — brak powiązanego filmu</div>`;
          return capHomeworkWorkoutCard(w,accent,live,{taskId:t.id,due:t.due,trainerNote:t.desc,done:false});
        }).join('')}`:`<div style="background:${CAP_S2};border:1px dashed ${CAP_S3};border-radius:14px;padding:16px;text-align:center;margin-bottom:16px;font-size:12px;color:${CAP_MUTED};">Brak aktywnych zadań domowych od trenera. Poniżej masz gotowe treningi do wyboru.</div>`}
      <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin:8px 0 10px;">📚 Gotowe treningi</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
        ${pill('all','Wszystkie')}
        ${pill('dom','🏠 Dom')}
        ${pill('hiit','🔥 HIIT')}
        ${pill('tabata','⏱ Tabata')}
        ${pill('mobilnosc','🧘 Mobilność')}
        ${pill('oddech','🌬 Oddech')}
        ${pill('strength','💪 Siła')}
      </div>
      ${lib.length?lib.map(w=>capHomeworkWorkoutCard(w,accent,live,{})).join(''):`<div style="text-align:center;padding:32px;color:${CAP_MUTED};font-size:12px;">Brak treningów w tej kategorii.</div>`}
      ${capClientSectionVisible('ondemand')?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-top:8px;">
        <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">📅 Pełne programy wielotygodniowe?</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;line-height:1.5;">Zakładka <strong>On-demand</strong> to plany 4+ tygodni z harmonogramem dni — klient sam wybiera tempo. Tu masz pojedyncze treningi „na dziś”.</div>
        <button type="button" class="cap-btn-primary" style="padding:10px;font-size:13px;background:${CAP_S3};" onclick="capGoScreen('ondemand')">Przejdź do On-demand →</button>
      </div>`:''}
      ${doneHw.length?`<div style="font-size:12px;font-weight:700;color:${CAP_MUTED};margin:16px 0 8px;">Ostatnio zrobione</div>${doneHw.map(t=>{const w=resolveW(t);if(!w)return '';return capHomeworkWorkoutCard(w,accent,live,{taskId:t.id,done:true});}).join('')}`:''}
    </div>`;
  }

  if(scr==='ondemand'){
    const progList=(typeof allODPrograms==='function'?allODPrograms():(window.OD_PROGRAMS||[])).filter(p=>typeof odProgramWorkoutCount==='function'?odProgramWorkoutCount(p)>0:p.status==='active');
    const programCards=!progList.length?`<div style="text-align:center;padding:40px;color:${CAP_MUTED};font-size:12px;">Brak programów z filmami YouTube.</div>`:
      progList.map(p=>{
        const n=typeof odProgramWorkoutCount==='function'?odProgramWorkoutCount(p):0;
        const pct=typeof odProgramProgressPct==='function'?odProgramProgressPct(c.id,p):0;
        const catLabel=p.category==='mobilnosc'?'🧘 Mobilność':p.category==='dom'?'🏠 Dom bez sprzętu':p.category==='oddech'?'🌬 Oddech i relaks':p.category==='fbw'?'⚡ Full Body':'';
        return `<button type="button" onclick="openODProgramClient('${escHtml(p.id)}')" style="width:100%;text-align:left;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:14px;margin-bottom:12px;cursor:pointer;color:inherit;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div>
              <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};">${escHtml(p.emoji||'📋')} ${escHtml(p.name)}</div>
              <div style="font-size:11px;color:${CAP_MUTED};margin-top:4px;line-height:1.4;">${escHtml(p.desc||'')}</div>
            </div>
            <span style="font-size:9px;font-family:'DM Mono',monospace;color:${accent};white-space:nowrap;">${escHtml(p.duration||'')}</span>
          </div>
          <div style="font-size:10px;color:${CAP_MUTED};margin-top:8px;">${catLabel?escHtml(catLabel)+' · ':''}${n?n+' treningów YouTube · ':''}${escHtml(typeof LEVEL_MAP!=='undefined'&&p.level?(LEVEL_MAP[p.level]||p.level):p.level||'')}${pct?' · '+pct+'% zrobione':''}</div>
          ${pct?`<div style="height:4px;background:${CAP_S3};border-radius:99px;margin-top:8px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${accent};"></div></div>`:''}
        </button>`;
      }).join('');
    return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:8px;padding-top:8px;">ON-DEMAND</div>
      <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:14px;line-height:1.6;">Wielotygodniowe programy z filmami YouTube (mobilność, dom bez sprzętu, FBW). Klient sam wybiera dzień i tempo — to biblioteka planów, nie pojedyncze zadania od trenera. Pojedyncze treningi → zakładka <strong>Zadania domowe</strong>.</div>
      ${programCards}
    </div>`;
  }

  if(scr==='odprogram'){
    const p=(typeof allODPrograms==='function'?allODPrograms():(window.OD_PROGRAMS||[])).find(x=>x.id===window._cliveOdProgId);
    if(!p){
      return `<div class="cap-section" style="padding-bottom:90px;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="capGoScreen('ondemand')">← On-demand</button>
        <div style="text-align:center;padding:40px;color:${CAP_MUTED};font-size:12px;">Nie znaleziono programu.</div>
      </div>`;
    }
    const weeks=p.weeks||[];
    const live=capIsLiveClient();
    const done=typeof odProgramDoneSet==='function'?odProgramDoneSet(c.id,p.id):new Set();
    const pct=typeof odProgramProgressPct==='function'?odProgramProgressPct(c.id,p):0;
    const total=typeof odProgramSessionTotal==='function'?odProgramSessionTotal(p):0;
    return `<div class="cap-section" style="padding-bottom:90px;">
      <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="capGoScreen('ondemand')">← On-demand</button>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:4px;">${escHtml(p.emoji||'')} ${escHtml(p.name||'Program')}</div>
      <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:12px;line-height:1.5;">${escHtml(p.desc||'')}${p.duration?' · '+escHtml(p.duration):''}</div>
      ${total?`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:12px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:${CAP_MUTED};margin-bottom:6px;"><span>Postęp</span><span>${pct}%</span></div>
        <div style="height:6px;background:${CAP_S3};border-radius:99px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${accent};"></div></div>
      </div>`:''}
      ${!weeks.length?`<div style="text-align:center;padding:32px;color:${CAP_MUTED};font-size:12px;">Program bez przypisanych filmów YouTube.</div>`:weeks.map((wk,wi)=>`<div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};margin-bottom:8px;">${escHtml(wk.label||'Tydzień')}</div>
        ${(wk.days||[]).map((d,di)=>{
          if(d.rest)return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:12px;padding:12px;margin-bottom:6px;font-size:12px;color:${CAP_MUTED};">🧘 ${escHtml(d.label||'Odpoczynek')}</div>`;
          const wo=(typeof allODWorkouts==='function'?allODWorkouts():(window.OD_WORKOUTS||[])).find(x=>x.id===d.workoutId);
          const key=typeof odProgramSessionKey==='function'?odProgramSessionKey(p.id,wi,di):(p.id+':'+wi+':'+di);
          const isDone=done.has(key);
          if(!wo)return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:12px;padding:12px;margin-bottom:6px;font-size:12px;color:${CAP_MUTED};">${escHtml(d.label||'Trening')} — brak wideo</div>`;
          return `<div style="background:${CAP_S2};border:1px solid ${isDone?'rgba(62,207,178,0.45)':CAP_S3};border-radius:12px;padding:12px;margin-bottom:6px;display:flex;gap:10px;align-items:center;">
            <button type="button" class="cap-check-circle" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:1px solid ${isDone?'var(--teal)':CAP_S3};background:${isDone?'rgba(62,207,178,0.25)':'transparent'};color:${isDone?'var(--teal)':CAP_MUTED};" onclick="toggleODProgramDay('${escHtml(p.id)}',${wi},${di})">${isDone?'✓':''}</button>
            <button type="button" onclick="openODWorkout('${escHtml(wo.id)}')" style="flex:1;text-align:left;background:none;border:none;cursor:pointer;color:inherit;padding:0;">
              <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};">${escHtml(d.label||wo.name)}</div>
              <div style="font-size:10px;color:${CAP_MUTED};margin-top:2px;">${escHtml(wo.name)} · ${wo.time||'?'} min · YouTube</div>
            </button>
            <span style="color:${accent};font-size:18px;cursor:pointer;" onclick="openODWorkout('${escHtml(wo.id)}')">▶</span>
          </div>`;
        }).join('')}
      </div>`).join('')}
      ${!live?'<div style="font-size:11px;color:'+CAP_MUTED+';margin-top:8px;text-align:center;">Podgląd — klient odhacza dni w swojej apce</div>':''}
    </div>`;
  }

  if(scr==='resources'){
    const filter=window._capResFilter||'all';
    const resList=capClientResourceList(filter).slice(0,20);
    const pill=(id,label)=>`<button type="button" class="btn ${filter===id?'btn-primary':'btn-ghost'} btn-sm" onclick="capSetResFilter('${id}')">${label}</button>`;
    return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:8px;padding-top:8px;">ZASOBY</div>
      <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:12px;">Darmowe na YouTube — bez Spotify Premium.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        ${pill('all','Wszystkie')}
        ${pill('podcast','Podcasty')}
        ${pill('music','Muzyka')}
      </div>
      ${!resList.length?`<div style="text-align:center;padding:40px;color:${CAP_MUTED};font-size:12px;">Brak zasobów.</div>`:
      resList.map(r=>{
        const domain=capResourceDomain(r.url);
        return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:700;color:${CAP_TEXT};">${escHtml(r.name)}</div>
        <div style="font-size:10px;color:${CAP_MUTED};margin-top:2px;">${escHtml(domain||r.cat||r.type||'')}${r.cat?' · '+escHtml(r.cat):''}</div>
        ${r.url?`<a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;color:${accent};">Otwórz →</a>`:''}
      </div>`;
      }).join('')}
    </div>`;
  }

  if(scr==='forum'){
    const posts=(typeof visibleForumPosts==='function'?visibleForumPosts():[]).slice().sort((a,b)=>{
      if(a.pinned&&!b.pinned)return -1;if(!a.pinned&&b.pinned)return 1;
      return (b.createdAt||b.date||'').localeCompare(a.createdAt||a.date||'');
    });
    const openId=typeof forumActivePost!=='undefined'?forumActivePost:null;
    const open=openId&&posts.find(p=>p.id===openId);
    if(open){
      const comments=typeof getPostComments==='function'?getPostComments(open.id):[];
      const me=typeof forumActor==='function'?forumActor():{};
      const myReact=(open.reactedBy||{})[me.uid];
      return `<div class="cap-section" style="padding-bottom:90px;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="forumActivePost=null;renderClientLive()">← Wróć do feedu</button>
        <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:16px;padding:14px;margin-bottom:12px;">
          <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:4px;">${escHtml(open.authorName||'')} · ${typeof forumFormatWhen==='function'?forumFormatWhen(open):''}</div>
          <div style="font-size:16px;font-weight:700;color:${CAP_TEXT};margin-bottom:8px;">${escHtml(open.title||'')}</div>
          <div style="font-size:13px;color:${CAP_MUTED};line-height:1.6;white-space:pre-line;">${escHtml(open.body||'')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">
            ${Object.entries(REACTIONS_MAP).map(([r,icon])=>`<button class="forum-reaction-btn${myReact===r?' active':''}" onclick="reactToPost('${escHtml(open.id)}','${r}')">${icon} ${(open.reactions||{})[r]||''}</button>`).join('')}
          </div>
        </div>
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Komentarze (${comments.length})</div>
        ${comments.length?comments.map(cm=>`<div style="background:${CAP_S2};border-radius:12px;padding:10px 12px;margin-bottom:8px;">
          <div style="font-size:11px;font-weight:700;color:${CAP_TEXT};">${escHtml(cm.authorName||'')} ${cm.authorRole==='trener'?'<span style="color:var(--accent);font-size:9px;">TRENER</span>':''}</div>
          <div style="font-size:12px;color:${CAP_MUTED};margin-top:4px;white-space:pre-line;">${escHtml(cm.body||'')}</div>
        </div>`).join(''):`<div style="font-size:12px;color:${CAP_MUTED};margin-bottom:10px;">Napisz pierwszy komentarz.</div>`}
        <textarea id="new-comment-${escHtml(open.id)}" rows="3" placeholder="Twój komentarz..." style="width:100%;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:12px;padding:10px;color:${CAP_TEXT};font-size:13px;margin-bottom:8px;"></textarea>
        <button class="btn btn-primary" style="width:100%;" onclick="addComment('${escHtml(open.id)}')">Wyślij</button>
      </div>`;
    }
    return `<div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin:8px 0 6px;">SPOŁECZNOŚĆ</div>
      <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:14px;">Grupa Twojego trenera — nie jest to publiczne forum.</div>
      <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:16px;padding:12px;margin-bottom:14px;">
        <input id="clive-fp-title" class="form-input" placeholder="Tytuł posta" style="margin-bottom:8px;background:${CAP_S3};border:1px solid ${CAP_S3};">
        <textarea id="clive-fp-body" rows="3" placeholder="Napisz do grupy..." style="width:100%;background:${CAP_S3};border:1px solid ${CAP_S3};border-radius:8px;padding:8px;color:${CAP_TEXT};font-size:13px;margin-bottom:8px;"></textarea>
        <button class="btn btn-primary btn-sm" style="width:100%;" onclick="clientSaveForumPost()">Opublikuj</button>
      </div>
      ${posts.length?posts.map(p=>`<div onclick="openForumPost('${escHtml(p.id)}')" style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:12px;margin-bottom:10px;cursor:pointer;">
        ${p.pinned?'<div style="font-size:10px;color:var(--orange);margin-bottom:4px;">📌 Przypięty</div>':''}
        <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};">${escHtml(p.title||'')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin:4px 0 6px;">${escHtml(p.authorName||'')} · ${typeof forumFormatWhen==='function'?forumFormatWhen(p):''}</div>
        <div style="font-size:12px;color:${CAP_MUTED};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(p.body||'')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-top:8px;">💬 ${(typeof getPostComments==='function'?getPostComments(p.id).length:0)} · ❤️ ${typeof forumReactionScore==='function'?forumReactionScore(p):(p.likes||0)}</div>
      </div>`).join(''):`<div style="text-align:center;padding:28px 12px;color:${CAP_MUTED};font-size:12px;">Brak postów. Napisz pierwszy albo poczekaj na ogłoszenie trenera.</div>`}
    </div>`;
  }

  if(scr==='profile') return `
    <div class="cap-section" style="padding-bottom:90px;">
      <div style="padding-top:8px;text-align:center;margin-bottom:20px;">
        <div style="width:80px;height:80px;border-radius:50%;background:${accent}22;border:3px solid ${accent};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:32px;color:${accent};margin:0 auto 10px;">${getInit(c.name)}</div>
        <div style="font-size:20px;font-weight:700;color:${CAP_TEXT};">${c.name}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-top:3px;">${{masa:'💪 Budowa masy',sila:'🏋️ Wzrost siły',redukcja:'🔥 Redukcja',kondycja:'🏃 Kondycja'}[c.goal]||c.goal||'Brak celu'}</div>
      </div>
      <!-- stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px;">
        ${[
          {label:'Sesji',val:sessions.length,col:accent},
          {label:'Planów',val:plans.length,col:'var(--blue)'},
          {label:'Zadań',val:TASKS.filter(t=>t.clientId===c.id&&(typeof isOneShot==='function'?isOneShot(t):!isHabit(t))&&t.status==='done').length,col:'var(--teal)'},
        ].map(s=>`<div style="background:${CAP_S2};border-radius:14px;padding:12px;text-align:center;border:1px solid ${CAP_S3};">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:${s.col};line-height:1;">${s.val}</div>
          <div style="font-size:10px;color:${CAP_MUTED};font-family:'DM Mono',monospace;text-transform:uppercase;margin-top:2px;">${s.label}</div>
        </div>`).join('')}
      </div>
      <!-- dane -->
      <div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:${CAP_TEXT};margin-bottom:12px;">Dane osobowe</div>
        ${[['Wiek',c.age?c.age+' lat':'—'],['Waga',c.weight?c.weight+' kg':'—'],['Wzrost',c.height?c.height+' cm':'—'],['Poziom',{poczatkujacy:'Początkujący',sredni:'Średniozaawansowany',zaawansowany:'Zaawansowany'}[c.level]||'—']].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${CAP_S3};font-size:12px;">
          <span style="color:${CAP_MUTED};">${l}</span><span style="color:${CAP_TEXT};font-weight:600;">${v}</span>
        </div>`).join('')}
      </div>
      <!-- aktywny pakiet -->
      ${(()=>{
        const pkgs=(typeof allPackages==='function'?allPackages():(window.PACKAGES||[])).filter(p=>p.clientId===c.id&&p.status!=='expired'&&p.payStatus!=='expired');
        const p=pkgs[0];
        if(!p)return `<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:18px;padding:16px;margin-bottom:12px;text-align:center;color:${CAP_MUTED};font-size:12px;">Brak aktywnego pakietu</div>`;
        const left=Math.max(0,(p.sessions||0)-(p.sessionsUsed||0));
        const pct=p.sessions?Math.round((p.sessionsUsed||0)/p.sessions*100):0;
        return `<div style="background:linear-gradient(135deg,${accent}22,${accent}08);border:1px solid ${accent}44;border-radius:18px;padding:16px;margin-bottom:12px;">
        <div style="font-size:10px;color:${accent};font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:8px;">Aktywny pakiet</div>
        <div style="font-size:14px;font-weight:700;color:${CAP_TEXT};margin-bottom:4px;">${escHtml(p.title||'Pakiet')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:10px;">${left}/${p.sessions||0} sesji pozostało${p.expiresDate?' · Ważny do '+p.expiresDate:''}</div>
        <div style="height:6px;background:${CAP_S3};border-radius:99px;overflow:hidden;">
          <div style="height:100%;background:${accent};width:${pct}%;border-radius:99px;"></div>
        </div>
      </div>`;
      })()}
      <button type="button" class="cap-btn-secondary" style="margin-bottom:8px;" onclick="setClientLiveScreen('forms')">📋 Moje formularze</button>
      ${capIsLiveClient()?'':`<button class="cap-btn-secondary">⚙ Ustawienia konta</button>`}
      <button type="button" class="cap-btn-secondary" style="color:var(--red);border-color:rgba(255,77,77,0.2);" ${capIsLiveClient()?'onclick="doSignOut()"':''}>Wyloguj się</button>
    </div>`;

  if(scr==='forms'||scr==='formfill'){
    const live=capIsLiveClient();
    const sends=(window.FORM_SENDS||[]).filter(s=>s.clientId===c.id)
      .slice().sort((a,b)=>(b.sentAtIso||b.createdAt||'').localeCompare(a.sentAtIso||a.createdAt||''));
    const pending=sends.filter(s=>s.status!=='filled');
    const filled=sends.filter(s=>s.status==='filled');
    if(scr==='formfill'){
      const send=sends.find(s=>s.id===window._cliveFormSendId)||pending[0];
      if(!send){
        return `<div class="cap-section" style="padding-bottom:90px;">
          <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="setClientLiveScreen('forms')">← Formularze</button>
          <div style="text-align:center;padding:40px;color:${CAP_MUTED};font-size:12px;">Brak formularza do wypełnienia.</div>
        </div>`;
      }
      const qs=formQuestionsForSend(send);
      const draft=(window._cliveFormAnswers&&window._cliveFormAnswers[send.id])||formSendAnswersMap(send);
      const done=send.status==='filled';
      return `<div class="cap-section" style="padding-bottom:90px;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin:8px 0 12px;" onclick="setClientLiveScreen('forms')">← Formularze</button>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:4px;">${escHtml(send.formName||'Formularz')}</div>
        <div style="font-size:11px;color:${CAP_MUTED};margin-bottom:16px;">${done?'Wysłane odpowiedzi':(live?'Odpowiedz i wyślij do trenera':'Podgląd — klient wypełnia w swojej apce')}</div>
        ${qs.map((q,i)=>`<div style="background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:16px;padding:14px;margin-bottom:10px;">
          <div style="font-size:12px;color:${CAP_MUTED};margin-bottom:10px;">${i+1}. ${escHtml(q.text||'')}${q.required?'<span style="color:var(--red);"> *</span>':''}</div>
          ${capFormQControl(send.id,q,draft[q.id],live&&!done)}
        </div>`).join('')}
        ${done?`<div style="text-align:center;font-size:12px;color:var(--teal);padding:12px;">✓ Wysłane ${escHtml((send.filledAt||'').slice(0,10))}</div>`
        :live?`<button type="button" class="cap-btn-primary" onclick="clientSubmitForm('${escHtml(send.id)}')">✓ Wyślij do trenera</button>`
        :`<button class="cap-btn-primary">✓ Wyślij do trenera</button>`}
      </div>`;
    }
    return `<div class="cap-section" style="padding-bottom:90px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin:8px 0 16px;padding-top:8px;">FORMULARZE</div>
      ${!sends.length?`<div style="text-align:center;padding:40px;color:${CAP_MUTED};font-size:12px;">Brak formularzy. Gdy trener wyśle ankietę, pojawi się tutaj.</div>`:''}
      ${pending.length?`<div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--purple);text-transform:uppercase;margin-bottom:8px;">Do wypełnienia</div>
        ${pending.map(s=>`<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-bottom:8px;cursor:pointer;" onclick="clientOpenForm('${escHtml(s.id)}')">
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:${CAP_TEXT};">${escHtml(s.formName||'Formularz')}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-top:3px;">${escHtml(s.sentAt||'')} · ${formQuestionsForSend(s).length} pytań</div></div>
          <span style="font-size:11px;color:var(--orange);">Wypełnij →</span>
        </button>`).join('')}`:''}
      ${filled.length?`<div style="font-size:10px;font-family:'DM Mono',monospace;color:${CAP_MUTED};text-transform:uppercase;margin:16px 0 8px;">Wysłane</div>
        ${filled.map(s=>`<button type="button" class="cap-list-item" style="width:100%;text-align:left;background:${CAP_S2};border:1px solid ${CAP_S3};border-radius:14px;padding:14px;margin-bottom:8px;cursor:pointer;" onclick="clientOpenForm('${escHtml(s.id)}')">
          <div style="flex:1;"><div style="font-size:13px;font-weight:600;color:${CAP_TEXT};">${escHtml(s.formName||'Formularz')}</div>
          <div style="font-size:11px;color:${CAP_MUTED};margin-top:3px;">${escHtml((s.filledAt||s.sentAt||'').slice(0,10))}</div></div>
          <span style="color:var(--teal);font-size:12px;">✓</span>
        </button>`).join('')}`:''}
    </div>`;
  }

  return `<div style="padding:40px;text-align:center;color:${CAP_MUTED};">Brak tego ekranu</div>`;
}

function capFormQControl(sendId,q,val,live){
  const sid=JSON.stringify(sendId);
  const qid=JSON.stringify(q.id);
  if(q.type==='text'){
    return `<textarea class="form-textarea" rows="3" ${live?`oninput="clientFormSetAnswer(${sid},${qid},this.value)"`:'disabled'} placeholder="Twoja odpowiedź">${escHtml(val||'')}</textarea>`;
  }
  if(q.type==='number'){
    return `<input type="number" inputmode="decimal" class="form-input" value="${escHtml(val==null?'':val)}" ${live?`oninput="clientFormSetAnswer(${sid},${qid},this.value)"`:'disabled'} placeholder="Liczba" style="font-size:16px;">`;
  }
  if(q.type==='scale'){
    return `<div class="fd-scale">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button type="button" class="fd-scale-btn${String(val)===String(n)?' sel':''}" ${live?`onclick="clientFormPick(${sid},${qid},${JSON.stringify(String(n))})"`:'disabled'}>${n}</button>`).join('')}</div>`;
  }
  if(q.type==='yesno'){
    return `<div class="fd-yn">
      <button type="button" class="fd-yn-btn${val==='tak'?' sel':''}" ${live?`onclick="clientFormPick(${sid},${qid},'tak')"`:'disabled'}>✓ Tak</button>
      <button type="button" class="fd-yn-btn${val==='nie'?' sel':''}" ${live?`onclick="clientFormPick(${sid},${qid},'nie')"`:'disabled'}>✗ Nie</button>
    </div>`;
  }
  if(q.type==='choice'){
    return `<div style="display:flex;flex-direction:column;gap:8px;">${(q.options||[]).map(opt=>`<button type="button" class="fd-yn-btn${String(val)===String(opt)?' sel':''}" style="text-align:left;" ${live?`onclick="clientFormPick(${sid},${qid},${JSON.stringify(opt)})"`:'disabled'}>${escHtml(opt)}</button>`).join('')}</div>`;
  }
  return `<input class="form-input" value="${escHtml(val||'')}" ${live?`oninput="clientFormSetAnswer(${sid},${qid},this.value)"`:'disabled'}>`;
}

const CAP_SCREEN_INFO={
  home:{title:'🏠 Dziś',desc:'Jeden ekran na dzień: trening do odpalenia (Start), dzień wolny, nawyki, wyzwania, formularze od trenera, zadania i check-in jeśli czeka. Klient nie zgaduje, co ma zrobić.'},
  plan:{title:'📋 Mój plan treningowy',desc:'Lista dni planu z wskazówkami i filmem techniki. Start odhacza serie. W kreatorze: SS, EMOM, WU/DROP/AMRAP.'},
  calendar:{title:'📅 Kalendarz',desc:'Prawdziwy miesiąc z zaznaczonymi treningami, sesje z trenerem i aktywności z zegarka Garmin (import CSV, bez OAuth).'},
  progress:{title:'📈 Moje postępy',desc:'Masa, Garmin (kroki/kcal z CSV), zdjęcia, rekordy i historia sesji. Import z zegarka widać tu po wczytaniu pliku przez trenera.'},
  session:{title:'🏋️ Szczegóły treningu',desc:'Ocena 1–5 albo pomiary Garmin (CSV). Sesje z zegarka mają etykietę Garmin — bez live HRV/snu.'},
  exercise:{title:'🏆 Historia ćwiczenia',desc:'Rekord (Epley) i lista serii po datach. Player podpowiada „Ostatnio” i „Rekord”; nowy rekord to toast 🏆.'},
  checkin:{title:'✅ Check-in tygodniowy',desc:'Interaktywny formularz check-inu — emoji skale, liczba treningów, waga. Wysłany check-in trafia bezpośrednio do Twojego panelu.'},
  forms:{title:'📋 Formularze',desc:'Ankiety wysłane przez Ciebie (wstępna, zdrowie, postępy). Klient wypełnia w apce, odpowiedzi wracają do karty klienta i podglądu formularza.'},
  messages:{title:'💬 Wiadomości',desc:'Czat z trenerem w czasie rzeczywistym. Klient widzi historię rozmów, może pisać i odbierać wiadomości. Możesz wysyłać zdjęcia, pliki i linki.'},
  ondemand:{title:'▶️ On-demand',desc:'Wielotygodniowe programy YouTube (harmonogram tygodni i dni). Klient sam wybiera tempo — biblioteka planów, nie zadania od trenera. Pojedyncze treningi domowe → Zadania domowe.'},
  homework:{title:'🏡 Zadania domowe',desc:'Treningi w domu od trenera + gotowa biblioteka: HIIT, tabata, interwały, mobilność, bez sprzętu. Czas, obwody/serie i materiały widoczne od razu — bez szukania.'},
  odprogram:{title:'📋 Program on-demand',desc:'Plan tygodniowy z filmami YouTube — klient odpala każdy dzień z listy.'},
  resources:{title:'📚 Zasoby',desc:'Najpierw darmowe podcasty i muzyka na YouTube — bez Spotify Premium. Klient otwiera link w przeglądarce.'},
  profile:{title:'👤 Mój profil',desc:'Dane osobowe klienta, statystyki aktywności, aktywny pakiet z paskiem postępu, ustawienia konta.'},
};

function renderCapInfo(){
  const el=document.getElementById('cap-screen-info');if(!el)return;
  const info=CAP_SCREEN_INFO[capScreen]||{title:'Ekran',desc:''};
  const c=CL.find(x=>x.id===capClientId);
  el.innerHTML=`
    <div style="background:var(--adim);border:1px solid rgba(225,31,46,0.15);border-radius:10px;padding:12px;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${info.title}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.6;">${info.desc}</div>
    </div>
    ${c?`<div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Dane klienta</div>
    <div style="display:flex;flex-direction:column;gap:5px;">
      ${[['Klient',c.name],['Cel',{masa:'Masa',sila:'Siła',redukcja:'Redukcja',kondycja:'Kondycja'}[c.goal]||'—'],['Poziom',{poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'}[c.level]||'—'],['Sesji',SE.filter(s=>s.clientId===c.id).length],['Planów',PL.filter(p=>p.clientId===c.id).length]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">${l}</span><span style="font-weight:600;">${v}</span></div>`).join('')}
    </div>`:'<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px;">Wybierz klienta z listy powyżej</div>'}
    <div style="margin-top:14px;">
      <button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:6px;" onclick="shareAppLink()">📱 Wyślij link do aplikacji</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="goTo('clientapp');setCapTab('access')">🔑 Zarządzaj dostępem</button>
    </div>`;
}

function renderCapCustomize(){
  const el=document.getElementById('cap-customize-content');if(!el)return;
  const accent=window.SETTINGS?.brand?.accentColor||'#e60000';
  const appName=window.SETTINGS?.brand?.appName||'PROGRESS LIVE';
  el.innerHTML=`
    <div class="settings-card">
      <div class="settings-card-title">🎨 Kolor marki w aplikacji klienta</div>
      <div class="settings-card-desc">Główny kolor akcentu widoczny przez klienta w przyciskach, postępach i elementach aktywnych.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${['#e60000','#4d9fff','#ff8c42','#9d7cf4','#3ecfb2','#ff4d4d','#f59e0b','#ec4899'].map(c=>`<div style="width:36px;height:36px;border-radius:10px;background:${c};cursor:pointer;border:3px solid ${c===accent?'white':'transparent'};" onclick="setAccentColor('${c}');renderCapCustomize()"></div>`).join('')}
        <input type="color" value="${accent}" oninput="setAccentColor(this.value);renderCapCustomize()" style="width:36px;height:36px;border-radius:10px;cursor:pointer;border:none;padding:2px;">
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-title">📱 Nazwa aplikacji</div>
      <div class="settings-card-desc">Nazwa widoczna na ekranie głównym klienta i w powiadomieniach push.</div>
      <input type="text" class="form-input" value="${appName}" id="cap-app-name" style="font-size:13px;">
    </div>
    <div class="settings-card">
      <div class="settings-card-title">👁 Widoczne sekcje dla klienta</div>
      <div class="settings-card-desc">Wybierz które sekcje są dostępne w aplikacji klienta.</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${(()=>{
          const vs=(window.SETTINGS&&window.SETTINGS.clientApp&&window.SETTINGS.clientApp.visibleSections)||{};
          const rows=[['home','🏠 Strona główna'],['plan','📋 Mój plan'],['homework','🏡 Zadania domowe'],['calendar','📅 Kalendarz'],['progress','📈 Postępy'],['checkin','✅ Check-in'],['messages','💬 Wiadomości'],['ondemand','▶️ On-demand'],['resources','📚 Zasoby']];
          return rows.map(([id,label])=>`<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;">
          <span style="font-size:13px;">${label}</span>
          <input type="checkbox" data-cap-section="${id}" ${vs[id]!==false?'checked':''} style="accent-color:var(--accent);width:18px;height:18px;">
        </label>`).join('');
        })()}
      </div>
    </div>
    <button class="btn btn-primary" onclick="saveCapAppSettings()">Zapisz ustawienia</button>`;
}

function saveCapAppSettings(){
  const S=window.SETTINGS||(window.SETTINGS={});
  if(!S.clientApp)S.clientApp={};
  const nameEl=document.getElementById('cap-app-name');
  if(nameEl)S.clientApp.appName=nameEl.value.trim()||S.clientApp.appName||'Progress Live';
  S.clientApp.visibleSections=S.clientApp.visibleSections||{};
  document.querySelectorAll('#cap-customize-content input[data-cap-section]').forEach(cb=>{
    const id=cb.getAttribute('data-cap-section');
    if(id)S.clientApp.visibleSections[id]=cb.checked;
  });
  withTrainer(S);
  if(window._db){
    const sid=window._settingsDocId||window._uid||'default';
    window._setDoc(window._doc(window._db,'settings',sid),S,{merge:true}).then(()=>{window._settingsDocId=sid;}).catch(e=>console.warn('Firebase cap settings:',e));
  }
  notify('✓ Ustawienia aplikacji klienta zapisane');
}
window.saveCapAppSettings=saveCapAppSettings;

function capShowQr(){
  const url='https://app.progresslive.pl/client/'+encodeURIComponent((window.SETTINGS?.profile?.name||'trener').toLowerCase().replace(/\s+/g,'-'));
  const q='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url);
  let m=document.getElementById('m-cap-qr');
  if(!m){
    m=document.createElement('div');m.id='m-cap-qr';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:320px;text-align:center;">
      <div class="modal-title">QR do aplikacji</div>
      <img id="cap-qr-img" alt="QR" style="width:200px;height:200px;margin:12px auto;display:block;border-radius:8px;background:#fff;padding:8px;">
      <div style="font-size:11px;color:var(--muted);word-break:break-all;margin-bottom:12px;" id="cap-qr-url"></div>
      <button class="btn btn-ghost btn-sm" onclick="closeM('m-cap-qr')">Zamknij</button>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
  }
  document.getElementById('cap-qr-img').src=q;
  document.getElementById('cap-qr-url').textContent=url;
  openM('m-cap-qr');
}
window.capShowQr=capShowQr;

function renderCapAccess(){
  const el=document.getElementById('cap-access-content');if(!el)return;
  el.innerHTML=`
    <div class="settings-card" style="margin-bottom:16px;">
      <div class="settings-card-title">📩 Wyślij zaproszenie</div>
      <div class="settings-card-desc">Wyślij klientowi link do aplikacji mobilnej i kod dostępu.</div>
      <div class="form-grid">
        <div class="form-field"><label class="form-lbl">Klient</label>
          <select class="form-select" id="cap-inv-client" style="font-size:13px;">
            <option value="">Wybierz klienta...</option>
            ${CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field"><label class="form-lbl">Metoda</label>
          <select class="form-select" id="cap-inv-method" style="font-size:13px;">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="sendAppInvite()">📤 Wyślij zaproszenie</button>
    </div>

    <div class="settings-card" style="margin-bottom:16px;">
      <div class="settings-card-title">🔑 Link do aplikacji</div>
      <div class="settings-card-desc">Udostępnij ten link klientom — mogą zainstalować aplikację lub otworzyć ją w przeglądarce.</div>
      <div style="background:var(--s3);border-radius:8px;padding:12px;font-size:12px;font-family:'DM Mono',monospace;color:var(--muted);word-break:break-all;margin-bottom:8px;">${escHtml(typeof clientAppUrl==='function'?clientAppUrl(): (location.origin+location.pathname))}?invite=…</div>
      <div class="settings-card-desc" style="margin-bottom:8px;">Każdy klient dostaje własny link z zaproszenia (Klienci → zaproszenie). Tam ustawia hasło i widzi swój plan.</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="copyWebhook('https://app.progresslive.pl/client/piotr-urbaniak')">📋 Kopiuj link</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="capShowQr()">📲 QR Code</button>
      </div>
    </div>

    <div class="settings-card">
      <div class="settings-card-title">👥 Status dostępu klientów</div>
      <div style="margin-top:10px;">
        <div style="display:grid;grid-template-columns:1fr 80px 80px 80px;gap:8px;padding:8px 0;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--border);">
          <span>Klient</span><span>Status</span><span>Ostatnio</span><span></span>
        </div>
        ${CL.slice(0,8).map((c)=>{
          const lastMsg=(typeof MSGS!=='undefined'&&MSGS[c.id]&&MSGS[c.id].length)?MSGS[c.id][MSGS[c.id].length-1]:null;
          const joined=!!c.appJoined;
          const invited=!!c.inviteSentAt||!!c.appInvited||!!c.inviteToken;
          const st=joined?'active':invited?(lastMsg?'active':'invited'):'never';
          const lastLabel=joined?'w apce':lastMsg?(lastMsg.createdAt?new Date(lastMsg.createdAt).toLocaleDateString('pl'):'niedawno'):(invited?'zaproszony':'—');
          return `<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);font-size:12px;align-items:center;">
            <div style="font-weight:600;">${c.name}</div>
            <span class="pill ${st==='active'?'pill-green':st==='invited'?'pill-orange':'pill-muted'}" style="font-size:9px;">${joined?'W apce':st==='invited'?'Zaproszony':'Brak'}</span>
            <span style="font-size:10px;color:var(--muted);">${lastLabel}</span>
            <button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="inviteClientToApp('${c.id}')">Wyślij</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function shareAppLink(){
  const c=CL.find(x=>x.id===capClientId);
  if(!c){notify('Wybierz klienta!');return;}
  const go=async()=>{
    const link=typeof ensureClientInvite==='function'?await ensureClientInvite(c):buildClientInviteLink(c);
    pushMsg(c.id,'📱 Aplikacja Progress Live:\n\n'+link+'\n\nOtwórz link, ustaw hasło i zobaczysz swój plan.');
    if(navigator.clipboard){try{navigator.clipboard.writeText(link);}catch(e){}}
    notify('✓ Link do aplikacji skopiowany i zapisany w wiadomościach');
  };
  go();
}

function buildClientInviteLink(c){
  if(c&&c.inviteToken&&typeof clientAppUrl==='function')return clientAppUrl()+'?invite='+encodeURIComponent(c.inviteToken);
  const base=(location.origin+location.pathname).replace(/index\.html$/,'');
  return base+'?invite='+encodeURIComponent(c.inviteToken||c.id);
}

function inviteClientToApp(cid){
  const c=CL.find(x=>x.id===cid);if(!c){notify('Nie znaleziono klienta');return;}
  const go=async()=>{
    const link=typeof ensureClientInvite==='function'?await ensureClientInvite(c):buildClientInviteLink(c);
    c.appInvited=true;c.inviteSent=true;c.inviteSentAt=new Date().toISOString();
    persistById('clients',c);
    pushMsg(c.id,'📱 Zaproszenie do Progress Live:\n'+link+'\n\nOtwórz link, ustaw hasło (e-mail: '+(c.email||'z karty klienta')+') i wejdź do swojej aplikacji.');
    if(navigator.clipboard){try{navigator.clipboard.writeText(link);}catch(e){}}
    notify('✓ Zaproszenie zapisane w czacie + link skopiowany');
    if(typeof renderClientApp==='function')renderClientApp();
    if(typeof maybeResumeOnboard==='function')maybeResumeOnboard(c.id);
  };
  go();
}

function sendAppInvite(){
  const cid=document.getElementById('cap-inv-client').value;
  const method=document.getElementById('cap-inv-method').value;
  if(!cid){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===cid);
  if(!c){notify('Nie znaleziono klienta');return;}
  if(method==='email'||method==='sms'||method==='whatsapp'){
    inviteClientToApp(cid);
    notify('E-mail / SMS / WhatsApp nie są jeszcze podłączone — wysłano wiadomość w Inbox i skopiowano link.');
    return;
  }
  inviteClientToApp(cid);
}
var intTab='all';var intCat='all';var intDetailId=null;

const INTEGRATIONS=[
  // PAYMENTS
  {
    id:'stripe',cat:'payments',name:'Stripe',icon:'💳',color:'#635bff',
    status:'available',
    shortDesc:'Płatności online — wymaga własnego serwera (nie zbieramy sk_live)',
    desc:'Stripe wymaga backendu (Checkout + webhook). Z tej statycznej strony nie łączymy Stripe i nie zapisujemy klucza tajnego. Gotówka i przelew są w Płatnościach.',
    features:[
      {name:'Płatności kartą (Visa, Mastercard, Amex)',on:true},
      {name:'BLIK i Apple/Google Pay',on:true},
      {name:'Automatyczne faktury PDF',on:true},
      {name:'Subskrypcje i płatności cykliczne',on:true},
      {name:'Zwroty i reklamacje z panelu',on:true},
      {name:'Webhook — powiadomienia o płatnościach',on:true},
      {name:'Raportowanie i eksport transakcji',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://stripe.com/docs'
  },
  {
    id:'przelewy24',cat:'payments',name:'Przelewy24',icon:'🏦',color:'#d52b1e',
    status:'available',
    shortDesc:'Polskie przelewy bankowe i BLIK',
    desc:'Przelewy24 to najpopularniejsza polska bramka płatności. Obsługuje wszystkie polskie banki, BLIK, karty. Idealna dla klientów preferujących polskie płatności.',
    features:[
      {name:'Wszystkie polskie banki (200+)',on:true},
      {name:'BLIK (natychmiastowy)',on:true},
      {name:'Karty kredytowe i debetowe',on:true},
      {name:'Płatności cykliczne',on:false},
      {name:'Panel transakcji w PLN',on:true},
      {name:'Automatyczne powiadomienia',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://developers.przelewy24.pl'
  },
  // CALENDAR
  {
    id:'google_calendar',cat:'calendar',name:'Google Calendar',icon:'📅',color:'#4285f4',
    status:'available',
    shortDesc:'Plik ICS do importu w Google Calendar (bez logowania Google)',
    desc:'Pobierz plik .ics ze sesjami i zaimportuj w Google Calendar (Ustawienia → Importuj). Dwukierunkowa sync OAuth wymagałaby serwera — stąd tego nie ma.',
    features:[
      {name:'Dwukierunkowa sync sesji',on:true},
      {name:'Automatyczne zaproszenia dla klientów',on:true},
      {name:'Przypomnienia email i push',on:true},
      {name:'Spotkania Google Meet z linkiem',on:true},
      {name:'Blokowanie zajętych terminów',on:true},
      {name:'Strefy czasowe (auto-detect)',on:true},
    ],
    config:[
      {key:'cal_name',label:'Nazwa w pliku ICS (opcjonalnie)',placeholder:'Progress Live'},
    ],
    webhook:null,
    logs:[],
    docs:'https://developers.google.com/calendar'
  },
  {
    id:'calendly',cat:'calendar',name:'Calendly',icon:'🗓',color:'#006bff',
    status:'available',
    shortDesc:'Publiczny link — kopiuj, otwórz, wyślij w czat',
    desc:'Zapisz publiczny URL wydarzenia Calendly. Otwierasz go, kopiujesz albo wysyłasz klientowi w wiadomościach. API Calendly / OAuth — nie, bo nie ma serwera.',
    features:[
      {name:'Link do samodzielnego umawiania',on:true},
      {name:'Bufory czasowe między sesjami',on:true},
      {name:'Potwierdzenia i przypomnienia SMS/email',on:true},
      {name:'Integracja z Google/Outlook Calendar',on:true},
      {name:'Przyjmowanie płatności przy rezerwacji',on:false},
      {name:'Strona rezerwacji z brandingiem',on:true},
    ],
    config:[
      {key:'event_url',label:'Publiczny link do wydarzenia',placeholder:'https://calendly.com/twoj-nick/sesja-60min'},
    ],
    webhook:null,
    logs:[],
    docs:'https://developer.calendly.com'
  },
  {
    id:'outlook',cat:'calendar',name:'Microsoft Outlook',icon:'📧',color:'#0078d4',
    status:'available',
    shortDesc:'Ten sam plik ICS — import w Outlook',
    desc:'Pobierz .ics i otwórz w Outlook (Plik → Otwórz i wyeksportuj → Importuj). Logowanie Microsoft / Teams z tej strony nie działa.',
    features:[
      {name:'Sync z Outlook Calendar',on:true},
      {name:'Linki do spotkań Microsoft Teams',on:true},
      {name:'Zaproszenia email przez Outlook',on:true},
      {name:'Dostępność przez Microsoft 365',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://docs.microsoft.com/graph'
  },
  // COMMUNICATION
  {
    id:'whatsapp',cat:'communication',name:'WhatsApp Business',icon:'💬',color:'#25d366',
    status:'available',
    shortDesc:'Przypomnienia wa.me na telefon klienta (sesje na dziś)',
    desc:'Otwiera WhatsApp Web / aplikację z gotową wiadomością (wa.me). Potrzebny numer w karcie klienta. API Meta Business nie jest podłączone — nie zbieramy tokenów.',
    features:[
      {name:'Automatyczne przypomnienia o sesjach',on:true},
      {name:'Powiadomienia o check-inach',on:true},
      {name:'Broadcast do grup klientów',on:true},
      {name:'Szablony wiadomości (pre-approved)',on:true},
      {name:'Odpowiedzi klientów → Inbox',on:true},
      {name:'Media: zdjęcia, PDFy, linki',on:true},
    ],
    config:[
      {key:'template',label:'Treść przypomnienia',placeholder:'Cześć {imie}! Dziś trening o {godzina}.'},
    ],
    webhook:null,
    logs:[],
    docs:'https://developers.facebook.com/docs/whatsapp'
  },
  {
    id:'sms',cat:'communication',name:'SMS (Twilio)',icon:'📱',color:'#f22f46',
    status:'available',
    shortDesc:'Wysyłaj SMS z przypomnieniami o sesjach',
    desc:'Automatyczne SMS-y przez Twilio. Idealne dla klientów, którzy nie używają WhatsApp. Wysokie wskaźniki otwarć.',
    features:[
      {name:'Przypomnienia o sesjach SMS',on:true},
      {name:'Dwukierunkowe SMS (odpowiedzi)',on:true},
      {name:'Szablony wiadomości PL/EN',on:true},
      {name:'Harmonogram wysyłania',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://www.twilio.com/docs/sms'
  },
  {
    id:'email',cat:'communication',name:'Mailchimp / Resend',icon:'✉️',color:'#ffe01b',
    status:'available',
    shortDesc:'Przypomnienia mailto — Twój program pocztowy',
    desc:'Otwiera e-mail z gotową treścią (mailto). Masowa wysyłka Mailchimp/Resend wymaga serwera — nie zapisujemy API key.',
    features:[
      {name:'Automatyczne emaile po dodaniu klienta',on:true},
      {name:'Newsletter miesięczny z postępami',on:true},
      {name:'Szablony HTML branded',on:true},
      {name:'Statystyki otwarć i kliknięć',on:true},
      {name:'Segmentacja klientów (cel, poziom)',on:true},
    ],
    config:[
      {key:'from_email',label:'Twój e-mail (widoczny w mailto)',placeholder:getTrainerEmail()||'twoj@email.pl'},
    ],
    webhook:null,
    logs:[],
    docs:'https://resend.com/docs'
  },
  // FITNESS
  {
    id:'myfitnesspal',cat:'fitness',name:'MyFitnessPal',icon:'🥗',color:'#0097d5',
    status:'available',
    shortDesc:'Synchronizacja danych żywieniowych klientów',
    desc:'Automatycznie pobieraj dane żywieniowe klientów z MyFitnessPal. Sprawdzaj czy trzymają się diety bez pytania.',
    features:[
      {name:'Dziennik kalorii → Progress Live',on:true},
      {name:'Makroskładniki (białko/tłuszcze/węgle)',on:true},
      {name:'Alerty gdy klient nie loguje jedzenia',on:false},
      {name:'Historia diety w profilu klienta',on:true},
      {name:'Porównanie z kalkulatorem TDEE',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://www.myfitnesspal.com/api'
  },
  {
    id:'garmin',cat:'fitness',name:'Garmin Connect',icon:'⌚',color:'#007cc3',
    status:'available',
    shortDesc:'Import CSV z Garmin Connect → pomiary i kalendarz (bez OAuth)',
    desc:'Żywy sync OAuth (HRV, sen, Body Battery) wymaga sekretu API na serwerze — nie zbieramy go do Firestore. Dziś działa import CSV z Garmin Connect (Aktywności → Export): pomiary grupy Garmin i sesje w kalendarzu.',
    features:[
      {name:'Import CSV aktywności z Garmin Connect',on:true},
      {name:'Pomiary: kroki, kcal, tętno, czas, dystans',on:true},
      {name:'Sesje w kalendarzu z treningów Garmin',on:true},
      {name:'Działa ze strony, bez subskrypcji i bez sekretów',on:true},
      {name:'Live OAuth: HRV, sen, Body Battery',on:false},
      {name:'Client secret / API key w Firestore',on:false},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://connect.garmin.com'
  },
  {
    id:'apple_health',cat:'fitness',name:'Apple Health',icon:'🍎',color:'#ff3b30',
    status:'available',
    shortDesc:'Dane zdrowotne z iPhone klientów',
    desc:'Importuj dane zdrowotne klientów z Apple Health — waga, aktywność, sen, tętno. Działa przez aplikację mobilną Progress Live.',
    features:[
      {name:'Waga i BMI (auto-sync)',on:true},
      {name:'Aktywność i kcal',on:true},
      {name:'Tętno i SpO2',on:true},
      {name:'Sen (przez aplikację mobilną)',on:true},
      {name:'Wymaga iOS 14+',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://developer.apple.com/health-fitness/'
  },
  {
    id:'polar',cat:'fitness',name:'Polar Flow',icon:'🔴',color:'#d0021b',
    status:'available',
    shortDesc:'Dane z urządzeń Polar (tętno, trening)',
    desc:'Integracja z Polar Flow API. Pobieraj dane treningowe, tętno i obciążenie treningowe z zegarków Polar.',
    features:[
      {name:'Dane treningowe z zegarków',on:true},
      {name:'Tętno i strefy HR',on:true},
      {name:'Obciążenie treningowe (Training Load)',on:true},
      {name:'Regeneracja (Recovery Pro)',on:false},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://www.polar.com/accesslink-api'
  },
  // ANALYTICS
  {
    id:'google_analytics',cat:'analytics',name:'Google Analytics 4',icon:'📊',color:'#e37400',
    status:'available',
    shortDesc:'Analityka użycia aplikacji i zachowań',
    desc:'Śledź jak klienci używają aplikacji — które sekcje odwiedzają, jak długo, co ich angażuje. Optymalizuj doświadczenie.',
    features:[
      {name:'Śledzenie ekranów i sesji',on:true},
      {name:'Zdarzenia niestandardowe',on:true},
      {name:'Konwersje (zakup pakietu)',on:true},
      {name:'Raporty użytkowników',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://developers.google.com/analytics'
  },
  {
    id:'mixpanel',cat:'analytics',name:'Mixpanel',icon:'📈',color:'#7856ff',
    status:'available',
    shortDesc:'Zaawansowana analityka produktowa',
    desc:'Mixpanel daje szczegółowe insighty o zachowaniu klientów — lejki, kohortyt, retencja. Dowiedz się dlaczego klienci odchodzą.',
    features:[
      {name:'Śledzenie zdarzeń produktowych',on:true},
      {name:'Analiza lejków (płatności, onboarding)',on:true},
      {name:'Kohorty i retencja klientów',on:true},
      {name:'A/B testing',on:false},
      {name:'Powiadomienia push z segmentów',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://developer.mixpanel.com'
  },
  // AUTOMATION
  {
    id:'zapier',cat:'automation',name:'Zapier',icon:'⚡',color:'#ff4a00',
    status:'available',
    shortDesc:'Catch Hook — POST przy kliencie, sesji, check-inie, formularzu…',
    desc:'Wklej URL Catch Hook z Zapiera. Wysyłamy POST przy: nowy klient, zaproszenie, sesja, pakiet opłacony, check-in wypełniony, formularz wypełniony, import Garmin. Jeśli Zapier zablokuje CORS, i tak wyślemy w trybie no-cors.',
    features:[
      {name:'Trigger: Nowy klient dodany',on:true},
      {name:'Trigger: Zaproszenie wysłane',on:true},
      {name:'Trigger: Sesja zapisana',on:true},
      {name:'Trigger: Płatność otrzymana',on:true},
      {name:'Trigger: Check-in wypełniony',on:true},
      {name:'Trigger: Formularz wypełniony',on:true},
      {name:'Trigger: Import Garmin CSV',on:true},
      {name:'Action: Dodaj do Google Sheets',on:true},
      {name:'Action: Wyślij email przez Gmail',on:true},
      {name:'Action: Utwórz zadanie w Notion/Trello',on:true},
      {name:'Action: Powiadom na Slack/Discord',on:true},
      {name:'5000+ integracji w katalogu Zapier',on:true},
    ],
    config:[
      {key:'webhook_url',label:'Catch Hook URL (Zapier)',placeholder:'https://hooks.zapier.com/hooks/catch/...'},
    ],
    webhook:null,
    logs:[],
    docs:'https://zapier.com/apps/progress-live'
  },
  {
    id:'make',cat:'automation',name:'Make (Integromat)',icon:'🔧',color:'#6d00cc',
    status:'available',
    shortDesc:'Catch Hook Make — te same eventy co Zapier',
    desc:'Wklej Webhook URL z Make. Te same zdarzenia co Zapier: klient, zaproszenie, sesja, pakiet, check-in, formularz, Garmin.',
    features:[
      {name:'Wizualny builder scenariuszy',on:true},
      {name:'Te same trigger-y co Zapier (check-in, form, Garmin…)',on:true},
      {name:'Transformacje danych (JSON, XML)',on:true},
      {name:'Iteratory i agregatory',on:true},
      {name:'Webhooks i HTTP moduły',on:true},
      {name:'Harmonogramy i warunki',on:true},
    ],
    config:[
      {key:'webhook_url',label:'Webhook URL (Make)',placeholder:'https://hook.eu1.make.com/...'},
    ],
    webhook:null,
    logs:[],
    docs:'https://www.make.com/en/integrations'
  },
  {
    id:'notion',cat:'automation',name:'Notion',icon:'📝',color:'#000000',
    status:'available',
    shortDesc:'Synchronizuj dane klientów z Notion',
    desc:'Automatycznie synchronizuj listę klientów, postępy i zadania z bazą danych Notion. Prowadź notatki i plany w Notion, widz wyniki w Progress Live.',
    features:[
      {name:'Sync klientów → baza Notion',on:true},
      {name:'Plany treningowe jako strony Notion',on:true},
      {name:'Zadania ↔ Notion Tasks',on:true},
      {name:'Dwukierunkowa synchronizacja',on:false},
      {name:'Raporty jako strony Notion',on:true},
    ],
    config:[],
    webhook:null,
    logs:[],
    docs:'https://developers.notion.com'
  },
];

window.INTEGRATIONS=INTEGRATIONS;
window.INT_CONNECTIONS={}; // integrationId -> {id: firestoreDocId, integrationId, connected, config}
window.INT_EVENT_LOG=window.INT_EVENT_LOG||[];
const INT_DAILY_IDS=['google_calendar','outlook','calendly','whatsapp','email','zapier','make','garmin'];
const INT_REQUIRED_CFG={calendly:'event_url',zapier:'webhook_url',make:'webhook_url'};
/** Eventy POST na Catch Hook Zapier/Make (pole `event` w body). */
const INT_WEBHOOK_EVENTS=[
  {id:'client.created',label:'Nowy klient'},
  {id:'invite.sent',label:'Zaproszenie'},
  {id:'session.created',label:'Sesja'},
  {id:'package.paid',label:'Pakiet opłacony'},
  {id:'checkin.completed',label:'Check-in'},
  {id:'form.submitted',label:'Formularz'},
  {id:'garmin.imported',label:'Import Garmin'},
  {id:'test',label:'Test ręczny'}
];
window.INT_WEBHOOK_EVENTS=INT_WEBHOOK_EVENTS;

function intWorksNow(id){return INT_DAILY_IDS.includes(id);}
function intDocId(integrationId){return (window._uid||'local')+'_'+integrationId;}
function getIntConn(id){return window.INT_CONNECTIONS[id];}
function intCfg(id,key){return (getIntConn(id)?.config||{})[key]||'';}

function splitGarminCsvLine(line,delim){
  const out=[];
  let cur='';
  let inQ=false;
  const d=delim||',';
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(inQ){
      if(ch==='"'){
        if(line[i+1]==='"'){cur+='"';i++;}
        else inQ=false;
      }else cur+=ch;
    }else if(ch==='"')inQ=true;
    else if(ch===d){out.push(cur);cur='';}
    else cur+=ch;
  }
  out.push(cur);
  return out;
}
function normGarminHeader(h){
  return String(h||'').replace(/^\ufeff/,'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function garminHeaderKey(h){
  const n=normGarminHeader(h);
  if(!n)return '';
  if((/max/.test(n)||/maks/.test(n))&&(/hr/.test(n)||/tetno/.test(n)))return '';
  if(/siedzac/.test(n)||/sedentary/.test(n)||/lightly active/.test(n)||/lekko aktyw/.test(n)||n==='goal'||/floors/.test(n)||/pietra/.test(n))return '';
  if(/^(date|data|start time|dzien)$/.test(n)||n.indexOf('start time')===0)return 'date';
  if(n==='date'||n==='data')return 'date';
  if(/typ aktywnosc/.test(n)||n==='activity type'||n==='sport')return 'type';
  if(n==='title'||n==='tytul'||n==='nazwa'||n==='activity name')return 'title';
  if(/kalorie/.test(n)||/calorie/.test(n)||n==='kcal')return 'calories';
  if(/intensity min/.test(n)||/active min/.test(n)||/fairly active/.test(n)||/very active/.test(n)||/minuty intens/.test(n)||/minuty aktyw/.test(n)||/czas trwania/.test(n)||/moving time/.test(n)||/elapsed time/.test(n)||/czas ruchu/.test(n)||n==='duration'||n==='czas'||n==='time')return 'duration';
  if(/resting heart/.test(n)||/tetno spoczynk/.test(n)||/avg hr/.test(n)||/average hr/.test(n)||/avg heart/.test(n)||/sr\.? tetno/.test(n)||/srednie tetno/.test(n)||n==='tetno'||n==='heart rate')return 'hr';
  if(/^dystans/.test(n)||/^distance/.test(n))return 'distance';
  if(/steps/.test(n)||/kroki/.test(n))return 'steps';
  return '';
}
function parseGarminDuration(raw){
  const s=String(raw||'').trim();
  if(!s||s==='--')return 0;
  if(/^\d+([.,]\d+)?$/.test(s))return Math.round(parseFloat(s.replace(',','.'))||0);
  const parts=s.split(':').map(n=>parseInt(n,10)||0);
  if(parts.length===3)return parts[0]*60+parts[1]+(parts[2]>=30?1:0);
  if(parts.length===2){
    if(parts[0]>23)return parts[0]+Math.round(parts[1]/60);
    return parts[0]*60+parts[1];
  }
  return 0;
}
function parseGarminDistance(raw){
  const s=String(raw||'').trim().toLowerCase();
  if(!s||s==='--')return 0;
  const num=parseFloat(s.replace(',','.').replace(/[^\d.]/g,''));
  if(!num)return 0;
  if(/\bm\b/.test(s)&&!/km/.test(s))return Math.round(num/10)/100;
  if(num>=1000)return Math.round(num/10)/100;
  return Math.round(num*100)/100;
}
function parseGarminDateTime(raw){
  const s=String(raw||'').trim();
  if(!s)return {date:'',time:'12:00'};
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if(m)return {date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]?String(m[4]).padStart(2,'0')+':'+m[5]:'12:00'};
  m=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(m){
    const dd=String(m[1]).padStart(2,'0');
    const mm=String(m[2]).padStart(2,'0');
    return {date:m[3]+'-'+mm+'-'+dd,time:m[4]?String(m[4]).padStart(2,'0')+':'+m[5]:'12:00'};
  }
  return {date:'',time:'12:00'};
}
function parseGarminNumber(raw){
  const s=String(raw||'').trim();
  if(!s||s==='--')return 0;
  const n=parseFloat(s.replace(',','.').replace(/[^\d.-]/g,''));
  return n&&isFinite(n)?n:0;
}
function parseGarminCsv(text){
  const raw=String(text||'').replace(/^\ufeff/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
  if(!raw)return [];
  const lines=raw.split('\n').filter(l=>l.trim());
  if(!lines.length)return [];
  const headerLine=lines[0];
  const delim=(headerLine.split(';').length>headerLine.split(',').length)?';':',';
  const headers=splitGarminCsvLine(headerLine,delim).map(garminHeaderKey);
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cells=splitGarminCsvLine(lines[i],delim);
    const rec={date:'',time:'12:00',type:'',title:'',calories:0,minutes:0,hr:0,distance:0,steps:0};
    headers.forEach((key,idx)=>{
      if(!key)return;
      const val=cells[idx]==null?'':cells[idx];
      if(key==='date'){
        const dt=parseGarminDateTime(val);
        rec.date=dt.date;if(dt.time&&dt.time!=='12:00')rec.time=dt.time;
      }else if(key==='type')rec.type=String(val).trim();
      else if(key==='title')rec.title=String(val).trim();
      else if(key==='calories')rec.calories=Math.round(parseGarminNumber(val));
      else if(key==='duration')rec.minutes+=parseGarminDuration(val);
      else if(key==='hr')rec.hr=Math.round(parseGarminNumber(val));
      else if(key==='distance')rec.distance=parseGarminDistance(val);
      else if(key==='steps')rec.steps=Math.round(parseGarminNumber(val));
    });
    rec.activity=!!(rec.type||rec.title);
    if(rec.date)rows.push(rec);
  }
  return rows;
}
function importGarminCsvForClient(clientId,text){
  if(!clientId)return {ok:false,error:'Wybierz klienta',metrics:0,sessions:0,skipped:0,rows:0};
  const parsed=parseGarminCsv(text);
  if(!parsed.length)return {ok:false,error:'Brak wierszy w CSV — sprawdź nagłówki Date/Data',metrics:0,sessions:0,skipped:0,rows:0};
  window.METRIC_ENTRIES=window.METRIC_ENTRIES||[];
  window.SE=window.SE||[];
  let metrics=0,sessions=0,skipped=0;
  parsed.forEach(row=>{
    const notes=row.title||row.type||'Garmin';
    const dup=window.METRIC_ENTRIES.some(e=>e.source==='garmin'&&e.clientId===clientId&&e.date===row.date&&(e.notes||'')===notes);
    if(dup){skipped++;return;}
    const values={};
    if(row.steps)values.m1=row.steps;
    if(row.calories)values.m2=row.calories;
    if(row.hr)values.m3=row.hr;
    if(row.minutes)values.m4=row.minutes;
    if(row.distance)values.m5=row.distance;
    if(!Object.keys(values).length){skipped++;return;}
    const entry=(typeof withTrainer==='function'?withTrainer:x=>x)({
      id:(typeof newId==='function'?newId('gme'):('gme_'+Date.now())),
      clientId,groupId:'mg6',date:row.date,values,notes,source:'garmin',
      createdAt:new Date().toISOString()
    });
    window.METRIC_ENTRIES.push(entry);
    if(typeof persistById==='function')persistById('metricEntries',entry);
    metrics++;
    const sessDup=window.SE.some(s=>s.source==='garmin'&&s.clientId===clientId&&s.date===row.date&&s.time===(row.time||'12:00')&&(s.notes||'')===notes);
    if(!sessDup&&row.minutes>0&&row.activity){
      const sess=(typeof withTrainer==='function'?withTrainer:x=>x)({
        id:(typeof newId==='function'?newId('gs'):('gs_'+Date.now())),
        clientId,date:row.date,time:row.time||'12:00',type:row.type||'Trening',
        notes,duration:row.minutes,source:'garmin',createdAt:new Date().toISOString()
      });
      window.SE.push(sess);
      if(typeof persistById==='function')persistById('sessions',sess);
      sessions++;
    }
  });
  const preview=window.METRIC_ENTRIES.filter(e=>e.source==='garmin'&&e.clientId===clientId)
    .slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5)
    .map(e=>({date:e.date,notes:e.notes,values:e.values}));
  return {ok:true,metrics,sessions,skipped,rows:parsed.length,preview};
}
function ensureGarminConnected(extraConfig){
  const prev=getIntConn('garmin')||{};
  const config=Object.assign({},prev.config||{},extraConfig||{});
  const docId=intDocId('garmin');
  const rec=(typeof withTrainer==='function'?withTrainer:x=>x)({
    id:docId,integrationId:'garmin',connected:true,config,
    configuredAt:prev.configuredAt||new Date().toISOString(),
    lastSync:new Date().toISOString()
  });
  window.INT_CONNECTIONS=window.INT_CONNECTIONS||{};
  window.INT_CONNECTIONS.garmin=rec;
  if(typeof persistById==='function')persistById('integrationConfigs',rec);
  return rec;
}
function garminCsvPanelHtml(conn){
  const last=conn&&conn.config&&conn.config.lastImport;
  const clients=window.CL||[];
  const lastCid=last&&last.clientId;
  const lastTxt=last
    ?('Ostatni import: '+(last.at?new Date(last.at).toLocaleString('pl'):'—')+' · '+(last.metrics||0)+' '+((last.metrics||0)===1?'pomiar':(last.metrics||0)<5&&(last.metrics||0)>1?'pomiary':'pomiarów')+', '+(last.sessions||0)+' '+((last.sessions||0)===1?'sesja':(last.sessions||0)<5&&(last.sessions||0)>1?'sesje':'sesji')+(last.skipped?(' · pominięto '+last.skipped):''))
    :'Jeszcze nie importowano CSV.';
  const preview=(last&&last.preview)||[];
  const previewHtml=preview.length
    ?`<div style="margin-top:10px;background:var(--s3);border-radius:8px;padding:8px 10px;">
        ${preview.map(p=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border);">
          <span style="font-family:'DM Mono',monospace;color:var(--muted);">${escHtml(p.date||'')}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.notes||'Garmin')}</span>
          <span style="color:var(--text);">${p.values&&p.values.m2?p.values.m2+' kcal':p.values&&p.values.m1?p.values.m1+' kroków':''}</span>
        </div>`).join('')}
      </div>`
    :'';
  return `
    <div style="margin-bottom:20px;background:rgba(0,124,195,0.12);border:1px solid rgba(0,124,195,0.35);border-radius:10px;padding:12px;font-size:12px;line-height:1.6;">
      Live OAuth (HRV, sen, Body Battery) potrzebuje sekretu API na serwerze — <strong>nie zbieramy tu secretów do Firestore</strong>.
      Działa dziś: plik CSV z Garmin Connect (Aktywności albo raport dzienny → Export).
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:10px;">Import CSV</div>
      <ol style="margin:0 0 12px 18px;padding:0;font-size:12px;line-height:1.6;color:var(--muted);">
        <li>Otwórz Garmin Connect → Aktywności albo Raporty</li>
        <li>Eksportuj CSV (Export)</li>
        <li>Wybierz klienta i wczytaj plik</li>
      </ol>
      <div class="form-field">
        <label class="form-lbl">Klient</label>
        <select id="int-garmin-client" class="form-select">
          <option value="">Wybierz klienta...</option>
          ${clients.map(c=>`<option value="${escHtml(c.id)}"${c.id===lastCid?' selected':''}>${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn btn-primary btn-sm" type="button" onclick="intGarminPickFile()">📂 Wczytaj CSV</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="intGarminOpenConnect()">Otwórz Garmin Connect</button>
      </div>
      <div id="int-garmin-last" style="font-size:11px;color:var(--muted);margin-top:10px;">${escHtml(lastTxt)}</div>
      ${previewHtml}
      ${lastCid?`<div id="int-garmin-jump" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button class="btn btn-primary btn-sm" type="button" onclick="openGarminImportedMetrics('${escHtml(lastCid)}')">📊 Pomiary Garmin</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openGarminImportedCalendar('${escHtml(lastCid)}')">📅 Kalendarz</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openGarminImportedProfile('${escHtml(lastCid)}')">👤 Profil klienta</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openGarminImportedClientApp('${escHtml(lastCid)}')">📱 Aplikacja klienta</button>
      </div>`:''}
    </div>`;
}
function intGarminPickFile(){
  const sel=document.getElementById('int-garmin-client');
  const cid=sel&&sel.value;
  if(!cid){if(typeof notify==='function')notify('⚠ Wybierz klienta');return;}
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='.csv,text/csv,text/plain';
  inp.onchange=function(){
    const f=inp.files&&inp.files[0];
    if(!f)return;
    const reader=new FileReader();
    reader.onload=function(){intGarminImportFor(cid,String(reader.result||''));};
    reader.onerror=function(){if(typeof notify==='function')notify('⚠ Nie udało się odczytać pliku');};
    reader.readAsText(f);
  };
  inp.click();
}
function intGarminImportFor(clientId,text){
  const result=importGarminCsvForClient(clientId,text);
  if(!result.ok){
    if(typeof notify==='function')notify('⚠ '+(result.error||'Import CSV nieudany'));
    return result;
  }
  ensureGarminConnected({lastImport:{at:new Date().toISOString(),metrics:result.metrics,sessions:result.sessions,skipped:result.skipped,clientId:clientId,preview:result.preview||[]}});
  if(typeof fireIntEvent==='function'){
    try{
      const cl=(window.CL||[]).find(x=>x&&x.id===clientId);
      fireIntEvent('garmin.imported',{
        import:{metrics:result.metrics,sessions:result.sessions,skipped:result.skipped,rows:result.rows||0},
        client:{id:clientId,name:(cl&&cl.name)||'',email:(cl&&cl.email)||''}
      });
    }catch(e){console.warn('fireIntEvent garmin',e);}
  }
  if(typeof notify==='function'){
    const m=result.metrics,s=result.sessions;
    const mTxt=m+' '+(m===1?'pomiar':m>1&&m<5?'pomiary':'pomiarów');
    const sTxt=s+' '+(s===1?'sesja':s>1&&s<5?'sesje':'sesji');
    notify('✓ Garmin: '+mTxt+', '+sTxt+(result.skipped?' (pominięto '+result.skipped+')':''));
  }
  try{if(typeof renderIntegrations==='function')renderIntegrations();}catch(e){}
  try{if(intDetailId==='garmin'&&typeof openIntDetail==='function')openIntDetail('garmin');}catch(e){}
  try{if(typeof renderMetrics==='function')renderMetrics();}catch(e){}
  try{if(typeof renderCal==='function')renderCal();}catch(e){}
  return result;
}
function openGarminImportedMetrics(clientId){
  if(!clientId){if(typeof notify==='function')notify('⚠ Wybierz klienta');return;}
  if(typeof closeIntDetail==='function')closeIntDetail();
  if(typeof goTo==='function')goTo('metrics');
  const csel=document.getElementById('metric-client-sel');
  if(csel)csel.value=clientId;
  if(typeof setMetricGroup==='function')setMetricGroup('mg6');
  else if(typeof renderMetrics==='function')renderMetrics();
}
function openGarminImportedCalendar(clientId){
  if(!clientId){if(typeof notify==='function')notify('⚠ Wybierz klienta');return;}
  const jump=((window.SE||[]).filter(s=>s.source==='garmin'&&s.clientId===clientId).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||{}).date
    ||((window.METRIC_ENTRIES||[]).filter(e=>e.source==='garmin'&&e.clientId===clientId).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||{}).date;
  if(typeof closeIntDetail==='function')closeIntDetail();
  if(typeof goTo==='function')goTo('calendar');
  if(jump){
    calCurrentDate=new Date(jump+'T12:00:00');
    calMiniDate=new Date(calCurrentDate);
    calSelectedDate=jump;
  }
  if(typeof setCalView==='function')setCalView('list');
  else if(typeof renderCal==='function')renderCal();
}
function openGarminImportedProfile(clientId){
  if(!clientId){if(typeof notify==='function')notify('⚠ Wybierz klienta');return;}
  if(typeof closeIntDetail==='function')closeIntDetail();
  if(typeof goTo==='function')goTo('clients');
  if(typeof openClientProfile==='function')openClientProfile(clientId);
  setTimeout(function(){if(typeof setCPTab==='function')setCPTab('metrics');},0);
}
function openGarminImportedClientApp(clientId){
  if(!clientId){if(typeof notify==='function')notify('⚠ Wybierz klienta');return;}
  if(typeof closeIntDetail==='function')closeIntDetail();
  capClientId=clientId;
  window.capClientId=clientId;
  if(typeof goTo==='function')goTo('clientapp');
  const sel=document.getElementById('cap-client-sel');
  if(sel)sel.value=clientId;
  capClientId=clientId;
  window.capClientId=clientId;
  if(typeof setCapScreen==='function')setCapScreen('progress');
}
function intGarminOpenConnect(){
  window.open('https://connect.garmin.com','_blank','noopener');
}
window.parseGarminCsv=parseGarminCsv;
window.parseGarminDuration=parseGarminDuration;
window.parseGarminDistance=parseGarminDistance;
window.importGarminCsvForClient=importGarminCsvForClient;
window.intGarminPickFile=intGarminPickFile;
window.intGarminImportFor=intGarminImportFor;
window.intGarminOpenConnect=intGarminOpenConnect;
window.ensureGarminConnected=ensureGarminConnected;
window.openGarminImportedMetrics=openGarminImportedMetrics;
window.openGarminImportedCalendar=openGarminImportedCalendar;
window.openGarminImportedProfile=openGarminImportedProfile;
window.openGarminImportedClientApp=openGarminImportedClientApp;

function renderIntegrations(){
  renderIntStatusSummary();
  renderIntDailyBar();
  renderIntContent();
}

function renderIntStatusSummary(){
  const el=document.getElementById('int-status-summary');if(!el)return;
  const dailyOn=INT_DAILY_IDS.filter(id=>getIntConn(id)?.connected).length;
  const daily=INT_DAILY_IDS.length;
  const last=window.INT_EVENT_LOG[0];
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">
      <span style="color:var(--muted);">Działa dziś</span>
      <span style="font-family:'DM Mono',monospace;color:var(--teal);">${dailyOn}/${daily}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">
      <span style="color:var(--muted);">Wymaga serwera</span>
      <span style="font-family:'DM Mono',monospace;color:var(--muted);">${INTEGRATIONS.length-daily}</span>
    </div>
    <div style="height:4px;background:var(--s3);border-radius:99px;overflow:hidden;margin-top:8px;">
      <div style="height:100%;background:var(--teal);width:${daily?Math.round(dailyOn/daily*100):0}%;border-radius:99px;"></div>
    </div>
    ${last?`<div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.4;">Ostatnio: ${escHtml(last.time)} · ${escHtml(last.msg)}</div>`:''}`;
}

function renderIntDailyBar(){
  const el=document.getElementById('int-daily-bar');if(!el)return;
  const today=todaysSessions();
  const calUrl=intCfg('calendly','event_url');
  const zapOn=!!(getIntConn('zapier')?.connected&&intCfg('zapier','webhook_url'));
  const makeOn=!!(getIntConn('make')?.connected&&intCfg('make','webhook_url'));
  const hooksOn=zapOn||makeOn;
  el.innerHTML=`
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <button class="btn btn-primary btn-sm" onclick="downloadSessionsIcs()">📅 Pobierz ICS (${(window.SE||[]).length} sesji)</button>
      <button class="btn btn-ghost btn-sm" onclick="intRemindWhatsApp()">💬 WhatsApp dziś (${today.length})</button>
      <button class="btn btn-ghost btn-sm" onclick="intRemindEmail()">✉️ E-mail dziś</button>
      <button class="btn btn-ghost btn-sm" onclick="intOpenCalendly()" ${calUrl?'':'disabled title="Najpierw zapisz link Calendly"'}>🗓 Otwórz Calendly</button>
      <button class="btn btn-ghost btn-sm" onclick="intSendCalendly()" ${calUrl?'':'disabled'}>Wyślij Calendly w czat</button>
      <button class="btn btn-ghost btn-sm" onclick="intTestWebhook()" ${hooksOn?'':'disabled title="Włącz Zapier albo Make"'}>⚡ Sprawdź webhook</button>
      <button class="btn btn-ghost btn-sm" onclick="openIntDetail('garmin')">⌚ Import Garmin</button>
      <button class="btn btn-ghost btn-sm" onclick="renderIntWebhookEventsHelp()">📋 Eventy webhook</button>
    </div>`;
}

function renderIntWebhookEventsHelp(){
  const el=document.getElementById('int-daily-panel');if(!el)return;
  const hooks=(INT_WEBHOOK_EVENTS||[]).map(e=>`<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
    <code style="font-family:'DM Mono',monospace;color:var(--accent);flex-shrink:0;">${escHtml(e.id)}</code>
    <span style="color:var(--muted);">${escHtml(e.label)}</span>
  </div>`).join('');
  el.innerHTML=`<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Catch Hook — pole <code style="font-family:'DM Mono',monospace;">event</code> w JSON</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5;">Filtruj w Zapier/Make po <code style="font-family:'DM Mono',monospace;">event</code>. Wysyłane gdy Zapier lub Make ma włączony Catch Hook.</div>
    ${hooks}`;
}
window.renderIntWebhookEventsHelp=renderIntWebhookEventsHelp;

function setIntTab(t){
  intTab=t;
  ['all','daily','connected','server'].forEach(x=>{
    const btn=document.getElementById('int-tab-'+x);
    if(btn)btn.classList.toggle('active',x===t);
  });
  renderIntContent();
}

function setIntCat(cat,btn){
  intCat=cat;
  document.querySelectorAll('.int-nav-item').forEach(el=>el.classList.remove('active'));
  btn.classList.add('active');
  renderIntContent();
}

function renderIntContent(){
  const el=document.getElementById('int-main-content');if(!el)return;

  let list=INTEGRATIONS;
  if(intCat!=='all')list=list.filter(i=>i.cat===intCat);
  if(intTab==='connected')list=list.filter(i=>getIntConn(i.id)?.connected);
  if(intTab==='daily')list=list.filter(i=>intWorksNow(i.id));
  if(intTab==='server')list=list.filter(i=>!intWorksNow(i.id));

  const catLabels={payments:'💳 Płatności',calendar:'📅 Kalendarz',communication:'💬 Komunikacja',fitness:'🏋️ Fitness & Zdrowie',analytics:'📊 Analityka',automation:'⚡ Automatyzacja'};
  const cats=[...new Set(list.map(i=>i.cat))];

  if(!list.length){
    el.innerHTML=`<div style="text-align:center;padding:80px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;opacity:0.3;">🔗</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak integracji w tej kategorii</div>
      <div style="font-size:12px;">Zmień filtry lub sprawdź zakładkę "Wszystkie"</div>
    </div>`;
    return;
  }

  el.innerHTML=cats.map(cat=>{
    const catItems=list.filter(i=>i.cat===cat);
    return `<div style="margin-bottom:28px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;margin-bottom:14px;color:var(--accent);">${catLabels[cat]||cat}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
        ${catItems.map((int,i)=>renderIntCard(int,i)).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderIntCard(int,i){
  const conn=getIntConn(int.id);
  const isConnected=conn?.connected;
  const daily=intWorksNow(int.id);
  const badge=daily
    ?(isConnected?'<span class="int-badge-daily">Działa dziś</span>':'<span class="int-badge-daily">Działa dziś — włącz</span>')
    :'<span class="int-badge-server">Wymaga serwera</span>';
  return `<div class="int-card${isConnected?' connected':''}" data-int="${int.id}" style="animation-delay:${i*0.04}s;border-top:3px solid ${int.color};" onclick="openIntDetail('${int.id}')">
    <div style="position:absolute;top:12px;right:12px;">${badge}</div>
    <div class="int-card-icon" style="background:${int.color}22;">${int.icon}</div>
    <div class="int-card-name">${int.name}</div>
    <div class="int-card-desc">${int.shortDesc}</div>
    <div style="display:flex;gap:8px;margin-top:auto;">
      ${daily
        ?(isConnected
          ?`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="event.stopPropagation();disconnectInt('${int.id}')">Wyłącz</button>
             <button class="btn btn-primary btn-sm" style="flex:1;" onclick="event.stopPropagation();openIntDetail('${int.id}')">Ustawienia</button>`
          :`<button class="btn btn-primary btn-sm" style="flex:1;" onclick="event.stopPropagation();openIntDetail('${int.id}')">Włącz →</button>`)
        :`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="event.stopPropagation();openIntDetail('${int.id}')">Dlaczego nie</button>`}
    </div>
  </div>`;
}

function openIntDetail(id){
  intDetailId=id;
  const int=INTEGRATIONS.find(x=>x.id===id);if(!int)return;
  const conn=getIntConn(id);
  const isConnected=conn?.connected;
  const daily=intWorksNow(id);

  document.getElementById('int-detail-title').textContent=int.name;
  const body=document.getElementById('int-detail-body');
  const cfgFields=(int.config||[]).map(c=>`<div class="form-field">
        <label class="form-lbl">${escHtml(c.label)}</label>
        <input type="text" class="int-config-field" id="int-cfg-${int.id}-${c.key}" placeholder="${escHtml(c.placeholder||'')}" value="${escHtml(conn?.config?.[c.key]||'')}">
      </div>`).join('');

  body.innerHTML=`
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:20px;">
      <div style="width:56px;height:56px;border-radius:14px;background:${int.color}22;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">${int.icon}</div>
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${int.name}</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.6;">${int.desc}</div>
        <div style="margin-top:8px;">
          ${daily
            ?(isConnected
              ?'<span class="int-badge-daily">Działa dziś</span><span style="font-size:10px;color:var(--muted);margin-left:8px;">Włączono: '+(conn?.configuredAt?new Date(conn.configuredAt).toLocaleString('pl'):'—')+'</span>'
              :'<span class="int-badge-daily">Działa dziś — wyłączone</span>')
            :'<span class="int-badge-server">Wymaga własnego serwera</span>'}
        </div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:10px;">${daily?'Co działa stąd':'Czego tu nie ma'}</div>
      ${int.features.map(f=>`<div class="int-feature-row">
        <div class="int-feature-check" style="background:${f.on?'var(--adim)':'var(--s3)'};color:${f.on?'var(--accent)':'var(--muted)'};">${f.on?'✓':'–'}</div>
        <span style="color:${f.on?'var(--text)':'var(--muted)'};">${f.name}</span>
      </div>`).join('')}
    </div>

    ${daily&&cfgFields?`
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:10px;">Ustawienia</div>
      ${cfgFields}
    </div>`:''}

    ${id==='garmin'?garminCsvPanelHtml(conn):''}

    ${(id==='zapier'||id==='make')?`
    <div style="margin-bottom:16px;background:var(--s3);border-radius:10px;padding:12px;">
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Eventy w body JSON</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.55;margin-bottom:8px;">Filtruj w scenariuszu po polu <code style="font-family:'DM Mono',monospace;">event</code>:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${(INT_WEBHOOK_EVENTS||[]).filter(e=>e.id!=='test').map(e=>`<span style="font-family:'DM Mono',monospace;font-size:10px;padding:4px 8px;border-radius:6px;background:var(--s2);border:1px solid var(--border);color:var(--text);">${escHtml(e.id)}</span>`).join('')}
      </div>
    </div>`:''}

    ${!daily?`
    <div style="margin-bottom:20px;background:rgba(201,123,63,0.1);border:1px solid rgba(201,123,63,0.3);border-radius:10px;padding:12px;font-size:12px;line-height:1.6;">
      ${id==='stripe'||id==='przelewy24'
        ?'Płatności online wymagają backendu. Gotówka i przelew są w Płatnościach — nie zapisujemy kluczy tajnych bramek.'
        :'Ta integracja potrzebuje OAuth albo tajnego API. Statyczna strona tego nie zrobi — i nie zbieramy tu secretów do Firestore.'}
    </div>`:''}

    ${window.INT_EVENT_LOG.length&&(id==='zapier'||id==='make')?`
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Ostatnie zdarzenia</div>
      <div style="background:var(--s3);border-radius:8px;padding:10px 12px;">
        ${window.INT_EVENT_LOG.slice(0,8).map(l=>`<div class="int-log-row">
          <span style="color:var(--muted);font-family:'DM Mono',monospace;flex-shrink:0;">${escHtml(l.time)}</span>
          <span style="width:8px;height:8px;border-radius:50%;background:${l.ok?'var(--teal)':'var(--red)'};flex-shrink:0;margin-top:3px;"></span>
          <span style="flex:1;">${escHtml(l.msg)}</span>
        </div>`).join('')}
      </div>
    </div>`:''}

    <div style="margin-bottom:16px;">
      <a href="${int.docs}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);text-decoration:none;">📖 Dokumentacja ${int.name} →</a>
    </div>

    <div style="display:flex;gap:8px;">
      ${daily
        ?(isConnected
          ?`<button class="btn btn-danger btn-sm" style="flex:1;" onclick="disconnectInt('${int.id}');closeIntDetail()">Wyłącz</button>
             <button class="btn btn-primary" style="flex:1;" onclick="connectInt('${int.id}')">💾 Zapisz</button>`
          :`<button class="btn btn-ghost btn-sm" onclick="closeIntDetail()">Anuluj</button>
             <button class="btn btn-primary" style="flex:1;" onclick="connectInt('${int.id}')">Włącz</button>`)
        :`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="closeIntDetail()">Zamknij</button>
           ${id==='stripe'||id==='przelewy24'?`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="goTo('payments')">Płatności →</button>`:''}`}
    </div>`;

  document.getElementById('int-detail-panel').style.transform='translateX(0)';
}

function closeIntDetail(){
  document.getElementById('int-detail-panel').style.transform='translateX(100%)';
  intDetailId=null;
}

function connectInt(id){
  const int=INTEGRATIONS.find(x=>x.id===id);if(!int)return;
  if(!intWorksNow(id)){
    notify('⚠ '+int.name+' wymaga serwera — nie zapisujemy kluczy tajnych.');
    return;
  }
  const config={};
  (int.config||[]).forEach(c=>{
    const el=document.getElementById('int-cfg-'+id+'-'+c.key);
    if(el)config[c.key]=el.value.trim();
  });
  const req=INT_REQUIRED_CFG[id];
  if(req&&!config[req]){
    notify('⚠ Uzupełnij wymagane pole');
    return;
  }
  if((id==='zapier'||id==='make')&&!/^https:\/\//i.test(config.webhook_url||'')){
    notify('⚠ Wklej adres https:// Catch Hook');
    return;
  }
  if(id==='calendly'&&!/^https:\/\//i.test(config.event_url||'')){
    notify('⚠ Wklej publiczny link https://calendly.com/...');
    return;
  }
  const prev=getIntConn(id);
  const docId=intDocId(id);
  const rec=withTrainer({
    id:docId,
    integrationId:id,
    connected:true,
    config,
    configuredAt:new Date().toISOString(),
    lastSync:null
  });
  window.INT_CONNECTIONS[id]=rec;
  persistById('integrationConfigs',rec);
  if(window._db&&prev&&prev.id&&prev.id!==docId){
    window._del(window._doc(window._db,'integrationConfigs',prev.id)).catch(()=>{});
  }
  addNotification('system','Integracja włączona',int.name+' — działa ze strony (patrz opis)','integrations');
  notify('✓ '+int.name+' włączone');
  renderIntegrations();
  openIntDetail(id);
}

function disconnectInt(id){
  const int=INTEGRATIONS.find(x=>x.id===id);
  if(!confirm('Wyłączyć '+((int&&int.name)||id)+'?'))return;
  const prev=getIntConn(id);
  const docId=(prev&&prev.id)||intDocId(id);
  delete window.INT_CONNECTIONS[id];
  if(window._db){
    window._del(window._doc(window._db,'integrationConfigs',docId)).catch(e=>console.warn('Firebase integration config delete:',e));
    if(docId!==id)window._del(window._doc(window._db,'integrationConfigs',id)).catch(()=>{});
  }
  notify(((int&&int.name)||id)+' — wyłączone');
  renderIntegrations();
}

function testIntConnection(id){
  if(id==='zapier'||id==='make'){intTestWebhook();return;}
  const int=INTEGRATIONS.find(x=>x.id===id);
  if(intWorksNow(id))notify('✓ '+((int&&int.name)||id)+' działa ze strony — użyj przycisków na górze ekranu.');
  else notify('⚠ '+((int&&int.name)||id)+' wymaga własnego serwera. Nie testujemy połączenia stąd.');
}

function copyWebhook(url){
  navigator.clipboard.writeText(url).then(()=>notify('✓ Skopiowano')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=url;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    notify('✓ Skopiowano!');
  });
}

function icsStamp(date,time){
  const d=String(date||'').replace(/-/g,'');
  if(d.length!==8)return '';
  const parts=String(time||'10:00').split(':');
  const h=String(parts[0]||'10').padStart(2,'0');
  const m=String(parts[1]||'00').padStart(2,'0');
  return d+'T'+h+m+'00';
}
function icsEnd(date,time,durationMin){
  const bits=String(date||'').split('-').map(Number);
  const hm=String(time||'10:00').split(':').map(Number);
  if(!bits[0])return '';
  const dt=new Date(bits[0],(bits[1]||1)-1,bits[2]||1,hm[0]||10,hm[1]||0,0);
  dt.setMinutes(dt.getMinutes()+(durationMin||60));
  const p=n=>String(n).padStart(2,'0');
  return dt.getFullYear()+p(dt.getMonth()+1)+p(dt.getDate())+'T'+p(dt.getHours())+p(dt.getMinutes())+'00';
}
function todaysSessions(){
  const today=new Date().toISOString().split('T')[0];
  return (window.SE||[]).filter(s=>s.date===today).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
}
function waPhone(raw){
  let d=String(raw||'').replace(/\D/g,'');
  if(!d)return '';
  if(d.startsWith('00'))d=d.slice(2);
  if(d.length===9)d='48'+d;
  return d;
}
function intRemindTpl(c,s){
  const tpl=intCfg('whatsapp','template')||'Cześć {imie}! Dziś trening o {godzina}.';
  return tpl.replace(/\{imie\}/gi,c&&c.name||'hej').replace(/\{godzina\}/gi,s&&s.time||'');
}

function downloadSessionsIcs(){
  const sessions=Array.isArray(window.SE)?window.SE:[];
  if(!sessions.length){notify('Brak sesji do eksportu');return;}
  const calName=intCfg('google_calendar','cal_name')||'Progress Live';
  const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Progress Live//PL','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+esc(calName)];
  const now=new Date();
  const nowStamp=icsStamp(now.toISOString().split('T')[0],String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'));
  sessions.forEach(s=>{
    const start=icsStamp(s.date,s.time);
    const end=icsEnd(s.date,s.time,s.duration||60);
    if(!start||!end)return;
    const c=(window.CL||[]).find(x=>x.id===s.clientId);
    lines.push('BEGIN:VEVENT');
    lines.push('UID:'+esc(s.id||start)+'@progresslive');
    lines.push('DTSTAMP:'+nowStamp);
    lines.push('DTSTART:'+start);
    lines.push('DTEND:'+end);
    lines.push('SUMMARY:'+esc((s.type||'Trening')+' — '+(c&&c.name||'Klient')));
    if(s.notes)lines.push('DESCRIPTION:'+esc(s.notes));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='progress-live-sesje.ics';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  notify('✓ Pobrano ICS — w Google: Ustawienia → Importuj; w Outlook: Otwórz i wyeksportuj');
}

function intRemindWhatsApp(){
  const list=todaysSessions();
  const el=document.getElementById('int-daily-panel');if(!el)return;
  if(!list.length){el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0;">Dziś brak sesji.</div>';return;}
  el.innerHTML=`<div style="font-size:12px;font-weight:600;margin-bottom:8px;">WhatsApp — sesje dziś</div>
    ${list.map(s=>{
      const c=(window.CL||[]).find(x=>x.id===s.clientId);
      const phone=waPhone(c&&c.phone);
      const text=encodeURIComponent(intRemindTpl(c,s));
      const href=phone?'https://wa.me/'+phone+'?text='+text:'';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <div style="flex:1;"><strong>${escHtml(c&&c.name||'Klient')}</strong> · ${escHtml(s.time||'')} · ${escHtml(s.type||'Trening')}</div>
        ${href?`<a class="btn btn-primary btn-sm" href="${href}" target="_blank" rel="noopener">Otwórz WA</a>`:'<span style="color:var(--muted);font-size:11px;">brak telefonu w karcie</span>'}
      </div>`;
    }).join('')}`;
}

function intRemindEmail(){
  const list=todaysSessions();
  const el=document.getElementById('int-daily-panel');if(!el)return;
  if(!list.length){el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0;">Dziś brak sesji.</div>';return;}
  const from=intCfg('email','from_email')||(typeof getTrainerEmail==='function'?getTrainerEmail():'');
  el.innerHTML=`<div style="font-size:12px;font-weight:600;margin-bottom:8px;">E-mail — sesje dziś${from?' · od '+escHtml(from):''}</div>
    ${list.map(s=>{
      const c=(window.CL||[]).find(x=>x.id===s.clientId);
      const sub=encodeURIComponent('Przypomnienie: trening '+((s&&s.time)||''));
      const body=encodeURIComponent(intRemindTpl(c,s));
      const href=c&&c.email?('mailto:'+encodeURIComponent(c.email)+'?subject='+sub+'&body='+body):'';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <div style="flex:1;"><strong>${escHtml(c&&c.name||'Klient')}</strong> · ${escHtml(s.time||'')} · ${escHtml(c&&c.email||'brak e-maila')}</div>
        ${href?`<a class="btn btn-primary btn-sm" href="${href}">Otwórz mail</a>`:'<span style="color:var(--muted);font-size:11px;">uzupełnij e-mail klienta</span>'}
      </div>`;
    }).join('')}`;
}

function intOpenCalendly(){
  const url=intCfg('calendly','event_url');
  if(!url){notify('Najpierw włącz Calendly i wklej publiczny link');return;}
  window.open(url,'_blank','noopener');
}

function intSendCalendly(){
  const url=intCfg('calendly','event_url');
  if(!url){notify('Najpierw włącz Calendly i wklej publiczny link');return;}
  const el=document.getElementById('int-daily-panel');if(!el)return;
  const clients=window.CL||[];
  el.innerHTML=`<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Wyślij Calendly w czat</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px;word-break:break-all;">${escHtml(url)}</div>
    <button class="btn btn-ghost btn-sm" style="margin-bottom:10px;" onclick="copyWebhook(${JSON.stringify(url)})">📋 Kopiuj link</button>
    ${clients.map(c=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
      <div style="flex:1;">${escHtml(c.name)}</div>
      <button class="btn btn-primary btn-sm" onclick="intPushCalendly('${c.id}')">Wyślij</button>
    </div>`).join('')||'<div style="font-size:12px;color:var(--muted);">Brak klientów</div>'}`;
}
function intPushCalendly(clientId){
  const url=intCfg('calendly','event_url');
  if(!url||!clientId)return;
  if(typeof pushMsg==='function')pushMsg(clientId,'🗓 Umów sesję w Calendly:\n'+url);
  notify('✓ Link Calendly w czacie klienta');
}

function intLog(msg,ok){
  window.INT_EVENT_LOG.unshift({time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),msg:String(msg||''),ok:!!ok});
  window.INT_EVENT_LOG=window.INT_EVENT_LOG.slice(0,30);
}

async function postIntWebhook(url,body){
  if(!url||!/^https:\/\//i.test(url))return {ok:false};
  const payload=JSON.stringify(body);
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,mode:'cors'});
    intLog(body.event+' → '+(res.ok?'ok':res.status),res.ok);
    return {ok:res.ok};
  }catch(e){
    try{
      await fetch(url,{method:'POST',mode:'no-cors',body:payload});
      intLog(body.event+' wysłany (no-cors)',true);
      return {ok:true,opaque:true};
    }catch(e2){
      intLog('błąd webhook: '+(e2.message||e.message||'sieć'),false);
      return {ok:false};
    }
  }
}

function fireIntEvent(event,payload){
  const body=Object.assign({source:'progress-live',event:event,at:new Date().toISOString(),trainerId:window._uid||null},payload||{});
  const jobs=[];
  ['zapier','make'].forEach(id=>{
    const conn=getIntConn(id);
    const url=conn&&conn.connected&&conn.config&&conn.config.webhook_url;
    if(url)jobs.push(postIntWebhook(String(url).trim(),body));
  });
  return Promise.all(jobs);
}

async function intTestWebhook(){
  const zap=intCfg('zapier','webhook_url');
  const mk=intCfg('make','webhook_url');
  if(!((getIntConn('zapier')||{}).connected&&zap)&&!((getIntConn('make')||{}).connected&&mk)){
    notify('Włącz Zapier albo Make i wklej Catch Hook');
    return;
  }
  await fireIntEvent('test',{note:'ręczne sprawdzenie z Integracji'});
  notify('✓ Wysłano test na Catch Hook — sprawdź historię w Zapier/Make');
  renderIntStatusSummary();
}
var pbActiveWeek=1;var pbCatFilter='all';
var pbProgram={
  name:'',goal:'masa',level:'sredni',duration:8,daysPerWeek:4,
  weeks:[] // [{nr, label, rpe, isDeload, days:[{name,rest,exercises:[{name,sets,reps,rest,rpe}]}]}]
};

const PB_DAYS=['Pon','Wt','Śr','Czw','Pt','Sob','Nie'];
const PB_DAY_NAMES={
  4:['Push A','Pull A','Legs A','Push B'],
  3:['Full Body A','Full Body B','Full Body C'],
  5:['Push A','Pull A','Legs A','Push B','Pull B'],
  6:['Push A','Pull A','Legs A','Push B','Pull B','Legs B'],
};
const PB_RPE_BY_WEEK={
  4:[['Akumulacja I','RPE 7'],['Akumulacja I','RPE 7-8'],['Intensyfikacja','RPE 8-9'],['DELOAD','RPE 6']],
  8:[['Akum. I','RPE 7'],['Akum. I','RPE 7'],['Akum. I','RPE 8'],['DELOAD','RPE 6'],['Akum. II','RPE 7-8'],['Akum. II','RPE 8'],['Intensyf.','RPE 8-9'],['DELOAD','RPE 6']],
  12:[['Akum. I','RPE 7'],['Akum. I','RPE 7'],['Akum. I','RPE 8'],['DELOAD','RPE 6'],['Akum. II','RPE 7-8'],['Akum. II','RPE 8'],['Akum. II','RPE 8-9'],['DELOAD','RPE 6'],['Intensyf.','RPE 8'],['Intensyf.','RPE 9'],['Realizacja','RPE 9-10'],['DELOAD','RPE 6']],
};

const PB_DEMO_EXERCISES={
  Push:[
    {name:'Wyciskanie sztangi leżąc',sets:'4',reps:'8-10',rest:'90s',rpe:'8'},
    {name:'Wyciskanie hantli skos+',sets:'3',reps:'10-12',rest:'75s',rpe:'8'},
    {name:'Wyciskanie żołnierskie OHP',sets:'3',reps:'8-10',rest:'90s',rpe:'8'},
    {name:'Wznosy hantli bokiem',sets:'4',reps:'15',rest:'45s',rpe:'7'},
    {name:'Prostowanie triceps wyciąg',sets:'3',reps:'12',rest:'60s',rpe:'7'},
  ],
  Pull:[
    {name:'Podciąganie na drążku',sets:'4',reps:'6-8',rest:'2min',rpe:'8'},
    {name:'Wiosłowanie sztangą',sets:'4',reps:'8-10',rest:'90s',rpe:'8'},
    {name:'Ściąganie drążka wyciąg',sets:'3',reps:'10-12',rest:'75s',rpe:'8'},
    {name:'Uginanie biceps sztanga',sets:'3',reps:'10',rest:'60s',rpe:'7'},
    {name:'Facepull',sets:'3',reps:'15',rest:'45s',rpe:'7'},
  ],
  Legs:[
    {name:'Przysiad ze sztangą',sets:'4',reps:'6-8',rest:'3min',rpe:'8'},
    {name:'Martwy ciąg RDL',sets:'3',reps:'10',rest:'2min',rpe:'8'},
    {name:'Hip Thrust',sets:'4',reps:'12',rest:'90s',rpe:'8'},
    {name:'Leg Press',sets:'3',reps:'12-15',rest:'90s',rpe:'7'},
    {name:'Uginanie nóg maszyna',sets:'3',reps:'12',rest:'60s',rpe:'7'},
  ],
  FBW:[
    {name:'Przysiad Goblet',sets:'3',reps:'12',rest:'90s',rpe:'7'},
    {name:'Wiosłowanie hantlem',sets:'3',reps:'10/str',rest:'75s',rpe:'7'},
    {name:'Pompki',sets:'3',reps:'12',rest:'60s',rpe:'7'},
    {name:'Hip Thrust',sets:'3',reps:'15',rest:'75s',rpe:'7'},
    {name:'Plank',sets:'3',reps:'45s',rest:'30s',rpe:'7'},
  ],
};

function pbInit(){
  pbRebuildWeeks();
  pbSetWeek(1);
  renderPBExList();
  renderPBCatChips();
}

function pbRebuildWeeks(){
  const dur=parseInt(document.getElementById('pb-duration').value)||8;
  const dpw=parseInt(document.getElementById('pb-days-per-week').value)||4;
  const rpeMap=PB_RPE_BY_WEEK[dur]||PB_RPE_BY_WEEK[8];
  const dayNames=PB_DAY_NAMES[dpw]||PB_DAY_NAMES[4];
  const existingWeeks=pbProgram.weeks;

  pbProgram.duration=dur;pbProgram.daysPerWeek=dpw;
  pbProgram.weeks=Array.from({length:dur},(_,i)=>{
    const ex=existingWeeks[i];
    const rpe=rpeMap[i]||['',''];
    const isDeload=rpe[0].includes('DELOAD');
    return ex?{...ex,nr:i+1,label:rpe[0],rpe:rpe[1],isDeload}:{
      nr:i+1,label:rpe[0],rpe:rpe[1],isDeload,
      days:Array.from({length:dpw},(_,j)=>({
        name:dayNames[j]||'Dzień '+(j+1),
        rest:isDeload&&j>=2,
        exercises:isDeload?[]:[...(PB_DEMO_EXERCISES[dayNames[j]?.split(' ')[0]]||PB_DEMO_EXERCISES.FBW)]
          .map(e=>({...e}))
      }))
    };
  });

  renderPBWeekNav();
  renderPBPeriodBars();
  if(pbActiveWeek>dur)pbActiveWeek=1;
  pbSetWeek(pbActiveWeek);
}

function renderPBWeekNav(){
  const nav=document.getElementById('pb-week-nav');if(!nav)return;
  nav.innerHTML=pbProgram.weeks.map(w=>`
    <div class="pb-week-nav-item${w.nr===pbActiveWeek?' active':''}${w.isDeload?' deload':''}" onclick="pbSetWeek(${w.nr})">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;min-width:28px;">TYG ${w.nr}</div>
      <div style="flex:1;">
        <div style="font-size:11px;color:${w.isDeload?'var(--orange)':w.nr===pbActiveWeek?'var(--accent)':'var(--text)'};">${w.label}</div>
        <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">${w.rpe}</div>
      </div>
      ${w.isDeload?'<span style="font-size:10px;">🔄</span>':''}
    </div>`).join('');
}

function renderPBPeriodBars(){
  const el=document.getElementById('pb-period-bars');if(!el)return;
  el.innerHTML=pbProgram.weeks.map(w=>{
    const isDeload=w.isDeload;
    const intensity=isDeload?20:Math.min(95,40+w.nr*6);
    const col=isDeload?'var(--orange)':'var(--accent)';
    return `<div class="pb-period-bar">
      <span style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;min-width:24px;">T${w.nr}</span>
      <div class="pb-period-fill" style="background:${col};opacity:${isDeload?0.5:0.7};width:${intensity}%;"></div>
      <span style="font-size:9px;color:${col};font-family:'DM Mono',monospace;min-width:28px;">${w.rpe}</span>
    </div>`;
  }).join('');
}

function pbSetWeek(n){
  pbActiveWeek=n;
  const week=pbProgram.weeks.find(w=>w.nr===n);if(!week)return;

  const titleEl=document.getElementById('pb-week-title');
  if(titleEl)titleEl.textContent='TYDZIEŃ '+n+' — '+week.label;

  const metaEl=document.getElementById('pb-week-meta');
  if(metaEl)metaEl.innerHTML=`
    <span class="pill ${week.isDeload?'pill-orange':'pill-green'}" style="font-size:10px;">${week.rpe}</span>
    ${week.isDeload?'<span class="pill pill-orange" style="font-size:10px;">🔄 DELOAD</span>':''}`;

  renderPBDays(week);
  renderPBWeekNav();
}

function renderPBDays(week){
  const grid=document.getElementById('pb-days-grid');if(!grid)return;
  const dpw=week.days.length;
  grid.style.gridTemplateColumns=`repeat(${dpw},1fr)`;

  grid.innerHTML=week.days.map((day,di)=>`
    <div class="pb-day-col">
      <div class="pb-day-header" style="color:${day.rest?'var(--muted)':'var(--accent)'};">
        <div>
          <div>${PB_DAYS[di]}</div>
          <input type="text" value="${day.name}" id="pb-day-name-${week.nr}-${di}" onchange="pbUpdateDayName(${week.nr},${di},this.value)" style="background:none;border:none;color:inherit;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1px;width:100%;padding:0;" placeholder="Nazwa dnia...">
        </div>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;color:var(--muted);">
          <input type="checkbox" ${day.rest?'checked':''} onchange="pbToggleRest(${week.nr},${di},this.checked)" style="accent-color:var(--accent);"> REST
        </label>
      </div>
      ${day.rest
        ?`<div class="pb-day-rest">😴 Dzień odpoczynku</div>`
        :`<div style="flex:1;overflow-y:auto;padding:8px 8px 4px;" id="pb-ex-day-${week.nr}-${di}">
          ${renderPBExItems(week.nr,di,day.exercises)}
          <button class="pb-add-ex-btn" onclick="pbAddExToDay(${week.nr},${di})">+ DODAJ ĆWICZENIE</button>
        </div>`
      }
    </div>`).join('');
}

function renderPBExItems(weekNr,dayIdx,exercises){
  return exercises.map((ex,ei)=>`
    <div class="pb-ex-item" id="pb-ex-${weekNr}-${dayIdx}-${ei}">
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${ex.name}</div>
        <div class="pb-ex-inputs">
          <input type="text" class="pb-ex-inp" value="${ex.sets||'4'}" title="Serie" placeholder="4" onchange="pbUpdateEx(${weekNr},${dayIdx},${ei},'sets',this.value)" style="width:30px;">
          <span style="font-size:10px;color:var(--muted);align-self:center;">×</span>
          <input type="text" class="pb-ex-inp" value="${ex.reps||'10'}" title="Powt." placeholder="10" onchange="pbUpdateEx(${weekNr},${dayIdx},${ei},'reps',this.value)" style="width:40px;">
          <input type="text" class="pb-ex-inp" value="${ex.rest||'90s'}" title="Przerwa" placeholder="90s" onchange="pbUpdateEx(${weekNr},${dayIdx},${ei},'rest',this.value)" style="width:36px;">
          <input type="text" class="pb-ex-inp" value="${ex.rpe||'8'}" title="RPE" placeholder="8" onchange="pbUpdateEx(${weekNr},${dayIdx},${ei},'rpe',this.value)" style="width:28px;border-color:rgba(225,31,46,0.3);">
        </div>
      </div>
      <button class="pb-ex-remove" onclick="pbRemoveEx(${weekNr},${dayIdx},${ei})">×</button>
    </div>`).join('');
}

function pbToggleRest(weekNr,dayIdx,val){
  const w=pbProgram.weeks.find(x=>x.nr===weekNr);
  if(w&&w.days[dayIdx]){w.days[dayIdx].rest=val;if(val)w.days[dayIdx].exercises=[];}
  pbSetWeek(weekNr);
}

function pbUpdateDayName(weekNr,dayIdx,val){
  const w=pbProgram.weeks.find(x=>x.nr===weekNr);
  if(w&&w.days[dayIdx])w.days[dayIdx].name=val;
}

function pbUpdateEx(weekNr,dayIdx,exIdx,field,val){
  const w=pbProgram.weeks.find(x=>x.nr===weekNr);
  if(w&&w.days[dayIdx]&&w.days[dayIdx].exercises[exIdx])
    w.days[dayIdx].exercises[exIdx][field]=val;
}

function pbRemoveEx(weekNr,dayIdx,exIdx){
  const w=pbProgram.weeks.find(x=>x.nr===weekNr);
  if(w&&w.days[dayIdx])w.days[dayIdx].exercises.splice(exIdx,1);
  pbSetWeek(weekNr);
}

function pbAddExToDay(weekNr,dayIdx,exName){
  const w=pbProgram.weeks.find(x=>x.nr===weekNr);
  if(!w||!w.days[dayIdx])return;
  const name=exName||prompt('Nazwa ćwiczenia:');
  if(!name)return;
  w.days[dayIdx].exercises.push({name,sets:'3',reps:'10',rest:'90s',rpe:'8'});
  pbSetWeek(weekNr);
}

function pbAddExFromLib(name){
  const w=pbProgram.weeks.find(x=>x.nr===pbActiveWeek);
  if(!w)return;
  // add to first non-rest day
  const day=w.days.find(d=>!d.rest);
  if(!day){notify('Wszystkie dni to REST!');return;}
  day.exercises.push({name,sets:'3',reps:'10',rest:'90s',rpe:'8'});
  pbSetWeek(pbActiveWeek);
  notify('✓ Dodano "'+name.substring(0,25)+'" do '+day.name);
}

function pbCopyWeekFrom(){
  const src=parseInt(prompt('Kopiuj ćwiczenia z tygodnia (1-'+pbProgram.duration+'):'));
  if(!src||src<1||src>pbProgram.duration)return;
  const srcW=pbProgram.weeks.find(x=>x.nr===src);
  const dstW=pbProgram.weeks.find(x=>x.nr===pbActiveWeek);
  if(!srcW||!dstW)return;
  dstW.days=JSON.parse(JSON.stringify(srcW.days));
  pbSetWeek(pbActiveWeek);
  notify('✓ Skopiowano z Tygodnia '+src);
}

function pbAddDeload(){
  const w=pbProgram.weeks.find(x=>x.nr===pbActiveWeek);
  if(!w)return;
  w.isDeload=!w.isDeload;
  w.label=w.isDeload?'DELOAD':PB_RPE_BY_WEEK[pbProgram.duration]?.[pbActiveWeek-1]?.[0]||'Akumulacja';
  w.rpe=w.isDeload?'RPE 6':PB_RPE_BY_WEEK[pbProgram.duration]?.[pbActiveWeek-1]?.[1]||'RPE 8';
  if(w.isDeload)w.days.forEach(d=>{d.exercises=d.exercises.map(e=>({...e,sets:'2',rpe:'6'}));});
  renderPBWeekNav();renderPBPeriodBars();pbSetWeek(pbActiveWeek);
  notify(w.isDeload?'🔄 Tydzień ustawiony jako DELOAD':'Tydzień przywrócony do normalnego');
}

function renderPBCatChips(){
  const el=document.getElementById('pb-cat-chips');if(!el)return;
  const cats=['all','Klatka piersiowa','Plecy','Barki','Nogi','Biceps','Triceps','Core','Pośladki','Cardio'];
  el.innerHTML=cats.map(c=>`<button class="wl-filter-chip${pbCatFilter===c?' active':''}" onclick="pbCatFilter='${c}';renderPBExList();document.querySelectorAll('#pb-cat-chips .wl-filter-chip').forEach(b=>b.classList.remove('active'));event.target.classList.add('active')" style="font-size:9px;padding:2px 7px;">${c==='all'?'Wszystkie':c}</button>`).join('');
}

function renderPBExList(){
  const search=(document.getElementById('pb-ex-search')||{}).value||'';
  let exs=allExercises();
  if(pbCatFilter!=='all')exs=exs.filter(e=>e.cat===pbCatFilter);
  if(search)exs=exs.filter(e=>e.name.toLowerCase().includes(search.toLowerCase())||( e.cat||'').toLowerCase().includes(search.toLowerCase()));
  const el=document.getElementById('pb-ex-list');if(!el)return;
  el.innerHTML=exs.slice(0,40).map(e=>{
    const col=CAT_COLORS_EX[e.cat]||'var(--muted)';
    return `<div class="pb-lib-item" onclick="pbAddExFromLib('${e.name.replace(/'/g,"\\'")}')">
      <div class="pb-lib-dot" style="background:${col};"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
        <div style="font-size:10px;color:var(--muted);">${e.cat} · ${e.eq||''}</div>
      </div>
      <span style="font-size:14px;color:var(--accent);flex-shrink:0;">+</span>
    </div>`;
  }).join('');
}

async function pbAskAI(){
  const q=document.getElementById('pb-ai-q').value.trim();if(!q)return;
  document.getElementById('pb-ai-q').value='';
  const msgs=document.getElementById('pb-ai-msgs');
  msgs.innerHTML+=`<div style="text-align:right;margin-bottom:4px;"><span style="background:var(--accent);color:#fff;padding:3px 8px;border-radius:6px;font-size:10px;">${q}</span></div>`;
  msgs.innerHTML+=`<div id="pb-ai-t" style="margin-bottom:4px;"><span style="background:var(--s3);padding:3px 8px;border-radius:6px;font-size:10px;opacity:0.5;">Analizuję...</span></div>`;
  msgs.scrollTop=msgs.scrollHeight;
  const goal={masa:'hipertrofia/masa',sila:'siła/5RM',redukcja:'kardio+siła',kondycja:'kondycja'}[pbProgram.goal]||'hipertrofia';
  const sys='Trener personalny i ekspert programowania. Zaproponuj 4-6 ćwiczeń jako JSON array: [{"name":"...","sets":"4","reps":"8-10","rest":"90s","rpe":"8"}]. TYLKO czysty JSON, bez markdown. Ćwiczenia po polsku. Cel: '+goal+'. NSCA.';
  try{
    const r=await fetch(W,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:400,system:sys,messages:[{role:'user',content:q}]})});
    const d=await r.json();
    const raw=d.content.map(i=>i.text||'').join('');
    let exercises=[];try{exercises=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){}
    if(exercises.length){
      const html=exercises.map(e=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:10px;border-bottom:1px solid var(--border);">
        <span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${e.name}</span>
        <span style="color:var(--muted);margin:0 4px;">${e.sets}×${e.reps}</span>
        <button onclick="pbAddExFromLib('${e.name.replace(/'/g,"\\'")}');this.textContent='✓';this.style.color='var(--teal)'" style="background:none;border:none;color:var(--accent);font-size:12px;cursor:pointer;flex-shrink:0;">+</button>
      </div>`).join('');
      document.getElementById('pb-ai-t').outerHTML=`<div style="margin-bottom:6px;">${html}</div>`;
    } else {
      document.getElementById('pb-ai-t').outerHTML=`<div style="margin-bottom:4px;"><span style="background:var(--s3);padding:3px 8px;border-radius:6px;font-size:10px;">${raw.substring(0,100)}</span></div>`;
    }
  }catch(e){document.getElementById('pb-ai-t').outerHTML=`<div style="margin-bottom:4px;"><span style="background:var(--s3);padding:3px 8px;border-radius:6px;font-size:10px;color:var(--red);">Błąd</span></div>`;}
  msgs.scrollTop=msgs.scrollHeight;
}

function pbQuickAI(q){document.getElementById('pb-ai-q').value=q;pbAskAI();}

function pbNewProgram(){
  pbProgram={name:'',goal:'masa',level:'sredni',duration:8,daysPerWeek:4,weeks:[]};
  document.getElementById('pb-name').value='';
  pbRebuildWeeks();
  notify('Nowy program');
}

function pbLoadDemo(){
  document.getElementById('pb-name').value='PPL Masa — 8 tygodni';
  document.getElementById('pb-goal').value='masa';
  document.getElementById('pb-level').value='sredni';
  document.getElementById('pb-duration').value='8';
  document.getElementById('pb-days-per-week').value='6';
  pbProgram={name:'PPL Masa — 8 tygodni',goal:'masa',level:'sredni',duration:8,daysPerWeek:6,weeks:[]};
  pbRebuildWeeks();
  notify('✓ Demo PPL Masa wczytane!');
}

async function pbAssign(){
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  const nameEl=document.getElementById('pb-name');
  if(nameEl&&!nameEl.value.trim())nameEl.value='Program';
  const prog=await pbSave(true);
  if(!prog){notify('Najpierw zapisz program (wpisz nazwę)');return;}
  window._assignProgId=prog.id;
  const sel=document.getElementById('assign-prog-client');
  if(sel){
    sel.innerHTML=CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
    const dateEl=document.getElementById('assign-prog-date');
    if(dateEl)dateEl.value=new Date().toISOString().split('T')[0];
    openM('m-assign-prog');
    return;
  }
  const cid=prompt('Wpisz imię lub ID klienta:');
  if(!cid)return;
  const c=CL.find(x=>x.id===cid||x.name.toLowerCase().includes(cid.toLowerCase()));
  if(!c){notify('Nie znaleziono klienta');return;}
  const newPlan=withTrainer({
    id:newId('p'),name:prog.name,clientId:c.id,clientName:c.name,
    method:prog.method||'Własna',duration:prog.duration||8,level:prog.level||'sredni',goal:prog.goal||'masa',
    source:'program',programId:prog.id,startDate:new Date().toISOString().split('T')[0],
    createdAt:new Date().toISOString(),
    days:(prog.weeks&&prog.weeks[0]&&prog.weeks[0].days
      ?prog.weeks[0].days.map(d=>{
          const isRest=d.name==='REST'||d.rest||/^rest$/i.test(d.name||'');
          return{day:d.d||d.name||'',muscles:d.name||'',rest:isRest,exercises:isRest?[]:[{name:d.name||'Trening wg planu',sets:'3',reps:'wg planu'}]};
        }):[])
  });
  PL.push(newPlan);
  await persistById('plans',newPlan);
  notify('✓ Program "'+prog.name+'" przypisany do: '+c.name);
}

async function pbSave(silent){
  const name=document.getElementById('pb-name').value.trim();
  if(!name){if(!silent)notify('Wpisz nazwę programu!');return null;}
  pbProgram.name=name;
  pbProgram.goal=document.getElementById('pb-goal').value;
  pbProgram.level=document.getElementById('pb-level').value;
  const prog=withTrainer({
    id:pbProgram._savedId||newId('pb'),type:'moje',
    name,goal:pbProgram.goal,level:pbProgram.level,
    duration:pbProgram.duration,daysPerWeek:pbProgram.daysPerWeek,
    equip:'Siłownia',method:'Własna',
    desc:'Program stworzony w Program Builder v2.',
    highlights:[],
    weeks:pbProgram.weeks.map(w=>({
      nr:w.nr,label:w.label,rpe:w.rpe,
      days:w.days.map(d=>({d:d.name.substring(0,3),name:d.rest?'REST':d.name}))
    })),
    createdAt:pbProgram.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  pbProgram._savedId=prog.id;
  const idx=(window.USER_PROGRAMS||[]).findIndex(x=>x.id===prog.id);
  if(idx>=0)window.USER_PROGRAMS[idx]=prog;
  else window.USER_PROGRAMS.push(prog);
  await persistById('programs',prog);
  if(typeof renderPrograms==='function')renderPrograms();
  document.getElementById('pb-title').textContent=name;
  if(!silent)notify('✓ Program "'+name+'" zapisany do biblioteki programów!');
  return prog;
}
var ciFilter='all';var ciActiveClient=null;
window.CHECKINS={};// clientId -> [{week, date, answers, score}]

const CI_QUESTIONS_STANDARD=[
  {id:'energy',type:'scale',label:'Poziom energii',emoji:['😴','😪','😐','😊','⚡'],question:'Jak oceniasz swój poziom energii w tym tygodniu?',unit:'/ 5'},
  {id:'sleep',type:'scale',label:'Jakość snu',emoji:['😴','😪','😐','😊','🌟'],question:'Jak spałeś/aś w tym tygodniu?',unit:'/ 5'},
  {id:'stress',type:'scale',label:'Poziom stresu',emoji:['🧘','😌','😐','😰','🤯'],question:'Jaki był poziom stresu? (1=niski, 5=wysoki)',unit:'/ 5',invert:true},
  {id:'nutrition',type:'scale',label:'Odżywianie',emoji:['🍕','🌮','😐','🥗','💪'],question:'Jak oceniasz swoje odżywianie?',unit:'/ 5'},
  {id:'workouts',type:'number',label:'Treningi zrealizowane',question:'Ile treningów udało Ci się wykonać?',unit:'szt'},
  {id:'weight',type:'number',label:'Masa ciała',question:'Podaj aktualną masę ciała (opcjonalnie)',unit:'kg'},
  {id:'notes',type:'text',label:'Uwagi / komentarz',question:'Czy jest coś ważnego, co chcesz mi przekazać?'},
];

const CI_QUESTIONS_SHORT=[
  {id:'overall',type:'scale',label:'Ogólne samopoczucie',emoji:['😣','😔','😐','😊','🔥'],question:'Jak ogólnie czujesz się w tym tygodniu?',unit:'/ 5'},
  {id:'workouts',type:'number',label:'Treningi',question:'Ile treningów wykonałeś/aś?',unit:'szt'},
  {id:'notes',type:'text',label:'Komentarz',question:'Coś do przekazania?'},
];

/** Pusta lista check-inów — bez fałszywych danych demo. */
function ensureCheckins(clientId){
  if(!window.CHECKINS[clientId])window.CHECKINS[clientId]=[];
}
async function persistCheckin(ci){
  if(!ci)return;
  if(!ci.id)ci.id=newId('ci');
  withTrainer(ci);
  await persistById('checkins',ci);
}

function getCIStatus(clientId){
  const checkins=window.CHECKINS[clientId]||[];
  const latest=checkins[checkins.length-1];
  if(!latest)return'none';
  const daysDiff=Math.floor((new Date()-new Date(latest.date||Date.now()))/(1000*60*60*24));
  if(latest.status==='filled'&&daysDiff<=7)return'done';
  if(latest.status==='pending')return daysDiff>7?'overdue':'pending';
  if(daysDiff>14)return'overdue';
  return'none';
}

function pendingCheckin(clientId){
  const list=window.CHECKINS[clientId]||[];
  return list.filter(x=>x.status==='pending').slice(-1)[0]||null;
}
function filledThisWeek(clientId){
  const weekAgo=Date.now()-7*86400000;
  return (window.CHECKINS[clientId]||[]).filter(x=>x.status==='filled'&&x.date&&new Date(x.date).getTime()>=weekAgo).slice(-1)[0]||null;
}
function scoreCheckinAnswers(a){
  const energy=+(a&&a.energy)||3;
  const sleep=+(a&&a.sleep)||3;
  const stress=+(a&&a.stress)||3;
  const nutrition=+(a&&a.nutrition)||3;
  return Math.round((energy+sleep+(6-stress)+nutrition)/4*20);
}
function checkinChatText(name,custom){
  const first=(name||'').split(' ')[0]||'';
  if(custom)return String(custom).replace(/\{imie\}/gi,first);
  return 'Hej '+first+'! Czas na tygodniowy check-in 💪 Otwórz aplikację → Check-in i wypełnij (ok. 2 min).';
}
function ensurePendingCheckin(clientId,opts){
  ensureCheckins(clientId);
  const existing=pendingCheckin(clientId);
  if(existing)return existing;
  const rec=withTrainer({
    id:newId('ci'),clientId,
    date:typeof dateStr==='function'?dateStr(new Date()):new Date().toISOString().slice(0,10),
    status:'pending',score:null,answers:{},
    source:(opts&&opts.source)||'manual',
    createdAt:new Date().toISOString()
  });
  window.CHECKINS[clientId].push(rec);
  persistCheckin(rec);
  return rec;
}

/** Po starcie współpracy (ma plan) — kandydat do tygodniowego check-inu. */
function clientEligibleForWeeklyCheckin(c){
  if(!c||c.status==='archived')return false;
  if(typeof clientHasAssignedPlan==='function')return clientHasAssignedPlan(c.id);
  return(window.PL||[]).some(p=>p&&p.clientId===c.id);
}
function checkinRecordAgeDays(ci){
  if(!ci)return 999;
  const raw=ci.createdAt||ci.date||'';
  const t=new Date(raw).getTime();
  if(!t||isNaN(t))return 999;
  return Math.floor((Date.now()-t)/86400000);
}
function needsWeeklyCheckin(clientId){
  if(filledThisWeek(clientId))return false;
  if(pendingCheckin(clientId))return false;
  return true;
}
function isWeeklyCheckinDay(now){
  const want=parseInt(window.SETTINGS&&window.SETTINGS.notifications&&window.SETTINGS.notifications.weeklyCheckinDay,10);
  const day=Number.isFinite(want)?want:1;
  return(now||new Date()).getDay()===day;
}
function lastCheckinActivity(clientId){
  const list=(window.CHECKINS&&window.CHECKINS[clientId])||[];
  if(!list.length)return null;
  return list.slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')))[0]||null;
}
/** Auto-wysyłka tygodniowego check-inu po onboardingu/planie.
 *  Wysyła gdy: setting włączony, klient ma plan, brak filled/pending w tym tygodniu,
 *  oraz (dziś to dzień check-inu LUB brak historii LUB >7 dni od ostatniego). */
function runWeeklyCheckinSweep(opts){
  const o=opts||{};
  const N=(window.SETTINGS&&window.SETTINGS.notifications)||{};
  if(N.weeklyCheckin===false&&!o.force)return{sent:0,reason:'disabled'};
  const clients=(window.CL||[]).filter(clientEligibleForWeeklyCheckin);
  let sent=0;
  const sentIds=[];
  clients.forEach(c=>{
    if(!needsWeeklyCheckin(c.id))return;
    const last=lastCheckinActivity(c.id);
    const age=checkinRecordAgeDays(last);
    if(!o.force&&!isWeeklyCheckinDay()&&last&&age<7)return;
    ensurePendingCheckin(c.id,{source:'auto'});
    if(typeof pushMsg==='function')pushMsg(c.id,checkinChatText(c.name));
    sent++;
    sentIds.push(c.id);
  });
  if(sent&&typeof addNotification==='function'){
    addNotification('task','Check-in tygodniowy','Automatycznie wysłano do '+sent+(sent===1?' klienta':' klientów'),'checkin');
  }
  if(sent&&!o.silent&&typeof notify==='function'){
    notify('✓ Check-in tygodniowy → '+sent+(sent===1?' klient':' klientów'));
  }
  if(sent&&typeof renderCheckinClientList==='function')try{renderCheckinClientList();}catch(e){}
  return{sent,sentIds};
}
window.clientEligibleForWeeklyCheckin=clientEligibleForWeeklyCheckin;
window.needsWeeklyCheckin=needsWeeklyCheckin;
window.isWeeklyCheckinDay=isWeeklyCheckinDay;
window.runWeeklyCheckinSweep=runWeeklyCheckinSweep;
window.filledThisWeek=filledThisWeek;
window.pendingCheckin=pendingCheckin;
window.ensurePendingCheckin=ensurePendingCheckin;

function setCIFilter(f,btn){
  ciFilter=f;
  document.querySelectorAll('#ci-client-list').length;
  document.querySelectorAll('.wl-filter-chip').forEach(b=>{
    if(['ci-f-all','ci-f-pending','ci-f-done','ci-f-overdue'].includes(b.id))b.classList.remove('active');
  });
  btn.classList.add('active');
  renderCheckinClientList();
}

function renderCheckin(){
  renderCheckinClientList();
  renderCheckinSummary();
}

function renderCheckinClientList(){
  const search=(document.getElementById('ci-search')||{}).value||'';
  let clients=CL.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase()));

  clients.forEach(c=>ensureCheckins(c.id));

  if(ciFilter==='pending')clients=clients.filter(c=>getCIStatus(c.id)==='pending');
  else if(ciFilter==='done')clients=clients.filter(c=>getCIStatus(c.id)==='done');
  else if(ciFilter==='overdue')clients=clients.filter(c=>getCIStatus(c.id)==='overdue');

  const el=document.getElementById('ci-client-list');if(!el)return;
  if(!clients.length){
    el.innerHTML=`<div style="padding:30px;text-align:center;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:8px;opacity:0.3;">✅</div>
      <div style="font-size:13px;font-weight:600;">Brak klientów</div>
    </div>`;return;
  }

  const statusConfig={
    done:{color:'var(--teal)',label:'Wypełniony',dot:'var(--teal)'},
    pending:{color:'var(--orange)',label:'Oczekuje',dot:'var(--orange)'},
    overdue:{color:'var(--red)',label:'Zaległy',dot:'var(--red)'},
    none:{color:'var(--muted)',label:'Nie wysłano',dot:'var(--s4)'},
  };

  el.innerHTML=clients.map((c,i)=>{
    const st=getCIStatus(c.id);
    const sc=statusConfig[st]||statusConfig.none;
    const checkins=window.CHECKINS[c.id]||[];
    const last=checkins.filter(x=>x.status==='filled').slice(-1)[0];
    const avgScore=checkins.filter(x=>x.score).length?Math.round(checkins.filter(x=>x.score).reduce((s,x)=>s+x.score,0)/checkins.filter(x=>x.score).length):null;
    const col=COLS[i%5];
    return `<div class="ci-client-row${ciActiveClient===c.id?' active':''}" onclick="openCIClient('${c.id}')">
      <div style="width:32px;height:32px;border-radius:50%;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;flex-shrink:0;">${getInit(c.name)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
          <div class="ci-status-dot" style="background:${sc.dot};"></div>
          <span style="font-size:10px;color:${sc.color};">${sc.label}</span>
          ${avgScore?`<span style="font-size:10px;color:var(--muted);margin-left:auto;">⭐ ${avgScore}%</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openCIClient(id){
  ciActiveClient=id;
  const c=CL.find(x=>x.id===id);if(!c)return;
  ensureCheckins(id);

  const ci=CL.indexOf(c);const col=COLS[ci%5];
  document.getElementById('ci-active-client').textContent=c.name;
  document.getElementById('ci-header-actions').innerHTML=`
    <button class="btn btn-ghost btn-sm" onclick="openCIFill('${id}')">✎ Wypełnij za klienta</button>
    <button class="btn btn-primary btn-sm" onclick="sendCheckinTo('${id}')">📤 Wyślij check-in</button>`;

  renderCIDetail(id);
  renderCheckinSummary(id);
  renderCheckinClientList();
}

function renderCIDetail(id){
  const c=CL.find(x=>x.id===id);if(!c)return;
  const checkins=(window.CHECKINS[id]||[]).slice().reverse();
  const el=document.getElementById('ci-detail');if(!el)return;

  if(!checkins.length){
    el.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;opacity:0.3;">✅</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak check-inów</div>
      <button class="btn btn-primary" onclick="sendCheckinTo('${id}')">Wyślij pierwszy check-in</button>
    </div>`;return;
  }

  const latest=checkins[0];
  const filled=checkins.filter(x=>x.status==='filled');

  el.innerHTML=`
    <!-- aktualny check-in -->
    <div style="margin-bottom:20px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:12px;">
        AKTUALNY TYDZIEŃ · ${latest.date}
        <span class="pill ${latest.status==='filled'?'pill-green':'pill-orange'}" style="font-size:10px;margin-left:8px;">${latest.status==='filled'?'✓ Wypełniony':'⏳ Oczekuje'}</span>
      </div>

      ${latest.status==='filled'?renderCIAnswers(latest,c):`
        <div style="background:var(--s2);border:1px dashed var(--border2);border-radius:12px;padding:20px;color:var(--muted);">
          <div style="text-align:center;margin-bottom:14px;">
            <div style="font-size:28px;margin-bottom:8px;">⏳</div>
            <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text);">Oczekuje na klienta</div>
            <div style="font-size:11px;margin-bottom:4px;">Wysłano: ${escHtml(latest.date||'')}. Klient wypełnia w aplikacji → Check-in.</div>
          </div>
          ${window._ciFillOpen===id?ciFillFormHtml(id):`<div style="text-align:center;"><button class="btn btn-ghost btn-sm" onclick="openCIFill('${id}')">✎ Wypełnij za klienta</button></div>`}
        </div>
      `}
    </div>

    <!-- historia -->
    ${filled.length>1?`
    <div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:12px;">HISTORIA (${filled.length} check-inów)</div>
      <div class="card" style="padding:0;">
        <div style="display:grid;grid-template-columns:100px 1fr 80px 80px 80px 80px;gap:8px;padding:8px 14px;font-size:9px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--border);">
          <span>Data</span><span>Ocena ogólna</span><span>Energia</span><span>Sen</span><span>Treningi</span><span>Score</span>
        </div>
        ${filled.slice(0,8).map((ci,i)=>`
          <div class="ci-history-row" style="padding:8px 14px;display:grid;grid-template-columns:100px 1fr 80px 80px 80px 80px;gap:8px;animation-delay:${i*0.03}s">
            <span style="font-family:'DM Mono',monospace;color:var(--muted);">${ci.date}</span>
            <div>
              <div style="height:6px;background:var(--s3);border-radius:99px;overflow:hidden;">
                <div style="height:100%;background:${ci.score>=70?'var(--teal)':ci.score>=50?'var(--orange)':'var(--red)'};width:${ci.score||0}%;border-radius:99px;"></div>
              </div>
            </div>
            <span style="text-align:center;">${'⭐'.repeat(ci.answers.energy||0)}</span>
            <span style="text-align:center;">${'💤'.repeat(ci.answers.sleep||0)}</span>
            <span style="font-family:'DM Mono',monospace;text-align:center;color:var(--accent);">${ci.answers.workouts||0}</span>
            <span style="font-weight:700;color:${ci.score>=70?'var(--teal)':ci.score>=50?'var(--orange)':'var(--red)'};">${ci.score||0}%</span>
          </div>`).join('')}
      </div>
    </div>`:''}
  `;
}

function renderCIAnswers(ci,c){
  const qs=CI_QUESTIONS_STANDARD;
  const scoreColor=ci.score>=70?'var(--teal)':ci.score>=50?'var(--orange)':'var(--red)';
  return `
    <!-- score big -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center;grid-column:span 1;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:40px;color:${scoreColor};line-height:1;">${ci.score}</div>
        <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:3px;">SCORE</div>
      </div>
      ${[
        {icon:'⚡',label:'Energia',val:ci.answers.energy,max:5,col:'var(--accent)'},
        {icon:'💤',label:'Sen',val:ci.answers.sleep,max:5,col:'var(--blue)'},
        {icon:'🏋️',label:'Treningi',val:ci.answers.workouts,max:5,col:'var(--teal)'},
      ].map(s=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:20px;margin-bottom:4px;">${s.icon}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${s.col};line-height:1;">${s.val||'—'}</div>
        <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;">${s.label}</div>
      </div>`).join('')}
    </div>

    <!-- wskaźniki szczegółowe -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
      ${[
        {id:'energy',label:'Energia',emoji:['😴','😪','😐','😊','⚡'],col:'var(--accent)'},
        {id:'sleep',label:'Jakość snu',emoji:['😴','😪','😐','😊','🌟'],col:'var(--blue)'},
        {id:'stress',label:'Stres (odwr.)',emoji:['🧘','😌','😐','😰','🤯'],col:'var(--orange)',invert:true},
        {id:'nutrition',label:'Odżywianie',emoji:['🍕','🌮','😐','🥗','💪'],col:'var(--teal)'},
      ].map(q=>{
        const val=ci.answers[q.id]||0;
        const pct=val/5*100;
        const em=q.emoji[val-1]||'—';
        return `<div class="ci-question-card">
          <div class="ci-q-label">${q.label}</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;">${em}</span>
            <div style="flex:1;">
              <div class="ci-score-bar"><div class="ci-score-fill" style="width:${pct}%;background:${q.col};"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;"><span>1</span><span style="color:${q.col};font-weight:700;">${val}/5</span><span>5</span></div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    ${ci.answers.weight?`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:20px;">⚖️</span>
      <div><div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:2px;">MASA CIAŁA</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text);">${ci.answers.weight} <span style="font-size:14px;color:var(--muted);">kg</span></div></div>
    </div>`:''}

    ${ci.answers.notes?`<div style="background:var(--adim);border:1px solid rgba(225,31,46,0.2);border-radius:12px;padding:12px 16px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:6px;">💬 Komentarz klienta</div>
      <div style="font-size:13px;line-height:1.6;">${ci.answers.notes}</div>
    </div>`:''}

    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn btn-ghost btn-sm" onclick="replyToCheckin('${c.id}')">💬 Odpowiedz klientowi</button>
      <button class="btn btn-ghost btn-sm" onclick="addNotification('metric','Nowy check-in','${c.name} wypełnił check-in — score: ${ci.score}%','checkin')">🔔 Ustaw alert</button>
    </div>`;
}

function renderCheckinSummary(id){
  const el=document.getElementById('ci-summary');if(!el)return;
  const allC=CL;
  allC.forEach(c=>ensureCheckins(c.id));

  const total=allC.length;
  const done=allC.filter(c=>getCIStatus(c.id)==='done').length;
  const pending=allC.filter(c=>getCIStatus(c.id)==='pending').length;
  const overdue=allC.filter(c=>getCIStatus(c.id)==='overdue').length;
  const pct=total?Math.round(done/total*100):0;

  // avg scores this week
  const scores=Object.values(window.CHECKINS).flatMap(arr=>arr.filter(x=>x.status==='filled'&&x.score)).map(x=>x.score);
  const avgScore=scores.length?Math.round(scores.reduce((s,v)=>s+v,0)/scores.length):null;

  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--teal);">${done}</div>
        <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">WYPEŁNIONE</div>
      </div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--orange);">${pending}</div>
        <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">OCZEKUJE</div>
      </div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--red);">${overdue}</div>
        <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">ZALEGŁE</div>
      </div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;" title="Średnia ocena samopoczucia klienta z wypełnionych check-inów">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--accent);">${avgScore||'—'}${avgScore?'%':''}</div>
        <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">ŚR. SCORE</div>
      </div>
    </div>

    <!-- completion bar -->
    <div style="margin-bottom:14px;" title="Jaki procent zaplanowanych check-inów klient faktycznie wypełnił (niezależnie od tego, jak dobrze się ocenił)">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;"><span style="color:var(--muted);">Wypełnialność (% wysłanych check-inów)</span><span style="color:var(--teal);font-weight:700;">${pct}%</span></div>
      <div style="height:8px;background:var(--s3);border-radius:99px;overflow:hidden;">
        <div style="height:100%;background:var(--teal);width:${pct}%;border-radius:99px;transition:width 0.3s;"></div>
      </div>
    </div>

    ${id?`<!-- trend aktywnego klienta -->
    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">TREND KLIENTA</div>
    ${(window.CHECKINS[id]||[]).filter(x=>x.status==='filled').slice(-5).reverse().map(ci=>`
      <div class="ci-trend-item">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:11px;color:var(--muted);">${ci.date}</span>
          <span style="font-size:11px;font-weight:700;color:${ci.score>=70?'var(--teal)':ci.score>=50?'var(--orange)':'var(--red)'};">${ci.score}%</span>
        </div>
        <div class="ci-score-bar"><div class="ci-score-fill" style="width:${ci.score}%;background:${ci.score>=70?'var(--teal)':ci.score>=50?'var(--orange)':'var(--red)'};"></div></div>
        <div style="display:flex;gap:8px;font-size:12px;margin-top:5px;">
          <span title="Energia">⚡${ci.answers.energy||0}</span>
          <span title="Sen">💤${ci.answers.sleep||0}</span>
          <span title="Treningi">🏋️${ci.answers.workouts||0}</span>
          ${ci.answers.weight?`<span title="Waga">⚖️${ci.answers.weight}kg</span>`:''}
        </div>
      </div>`).join('')}`:''}

    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;" onclick="sendCheckin()">📤 Wyślij check-in do wszystkich</button>
  `;
}

function ciFillDraft(clientId){
  window._ciFillDraft=window._ciFillDraft||{};
  if(!window._ciFillDraft[clientId])window._ciFillDraft[clientId]={energy:3,sleep:3,stress:3,nutrition:3,workouts:3,weight:'',notes:''};
  return window._ciFillDraft[clientId];
}
function ciFillFormHtml(clientId){
  const a=ciFillDraft(clientId);
  const qrow=(id,label,emoji)=>`<div style="margin-bottom:12px;">
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">${label}</div>
    <div style="display:flex;justify-content:space-between;gap:4px;">
      ${emoji.map((e,i)=>`<button type="button" class="clive-check-opt${a[id]===i+1?' on':''}" onclick="ciFillPick('${clientId}','${id}',${i+1})">${e}</button>`).join('')}
    </div>
  </div>`;
  return `<div>
    ${qrow('energy','Energia',['😴','😪','😐','😊','⚡'])}
    ${qrow('sleep','Sen',['😴','😪','😐','😊','🌟'])}
    ${qrow('stress','Stres (1=niski)',['🧘','😌','😐','😰','🤯'])}
    ${qrow('nutrition','Odżywianie',['🍕','🌮','😐','🥗','💪'])}
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Ile treningów</div>
      <div style="display:flex;justify-content:space-between;gap:4px;">
        ${[0,1,2,3,4,5].map(n=>`<button type="button" class="clive-check-opt${a.workouts===n?' on':''}" style="font-family:'Bebas Neue',sans-serif;font-size:16px;" onclick="ciFillPick('${clientId}','workouts',${n})">${n}</button>`).join('')}
      </div>
    </div>
    <div class="form-field"><label class="form-lbl">Masa (kg, opcjonalnie)</label>
      <input type="number" inputmode="decimal" class="form-input" value="${escHtml(a.weight||'')}" oninput="ciFillDraft('${clientId}').weight=this.value">
    </div>
    <div class="form-field"><label class="form-lbl">Komentarz</label>
      <textarea class="form-textarea" rows="2" oninput="ciFillDraft('${clientId}').notes=this.value">${escHtml(a.notes||'')}</textarea>
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveCheckinFill('${clientId}')">Zapisz check-in</button>
  </div>`;
}
function openCIFill(id){
  window._ciFillOpen=id;
  ciFillDraft(id);
  if(ciActiveClient===id)renderCIDetail(id);
}
function ciFillPick(clientId,field,val){
  ciFillDraft(clientId)[field]=val;
  if(ciActiveClient===clientId)renderCIDetail(clientId);
}
function applyCheckinAnswers(ci,answers,filledBy){
  ci.answers={
    energy:+answers.energy||3,
    sleep:+answers.sleep||3,
    stress:+answers.stress||3,
    nutrition:+answers.nutrition||3,
    workouts:answers.workouts!=null?+answers.workouts:0,
    weight:answers.weight||'',
    notes:answers.notes||''
  };
  ci.score=scoreCheckinAnswers(ci.answers);
  ci.status='filled';
  ci.filledBy=filledBy||'client';
  ci.filledAt=new Date().toISOString();
  persistCheckin(ci);
  if(typeof syncClientFromCheckin==='function'){
    try{syncClientFromCheckin(ci);}catch(e){console.warn('syncClientFromCheckin',e);}
  }
  if(typeof fireIntEvent==='function'){
    try{
      const cl=(window.CL||[]).find(x=>x&&x.id===ci.clientId);
      fireIntEvent('checkin.completed',{
        checkin:{id:ci.id,clientId:ci.clientId,date:ci.date,score:ci.score,filledBy:ci.filledBy||filledBy||'client',weight:ci.answers&&ci.answers.weight||''},
        client:{id:ci.clientId,name:(cl&&cl.name)||'',email:(cl&&cl.email)||''}
      });
    }catch(e){console.warn('fireIntEvent checkin',e);}
  }
}

/** Po check-inie: waga → karta klienta + pomiar mg1; odśwież pipeline trenera. */
function syncClientFromCheckin(ci){
  if(!ci||!ci.clientId||!ci.answers)return null;
  const w=parseFloat(ci.answers.weight);
  const hasWeight=!isNaN(w)&&w>0;
  const c=(window.CL||[]).find(x=>x&&x.id===ci.clientId);
  let changed=false;
  const bits=[];
  if(hasWeight){
    if(typeof saveClientBaselineFromFields==='function'){
      const created=saveClientBaselineFromFields(ci.clientId,{
        date:ci.date||(typeof todayYmd==='function'?todayYmd():''),
        weight:w,
        notes:'Waga z check-inu tygodniowego'
      });
      if(created&&created.length){changed=true;bits.push('waga '+w+' kg');}
    }else if(c){
      c.weight=w;changed=true;bits.push('waga '+w+' kg');
      if(typeof persistById==='function')persistById('clients',c);
    }
  }
  if(ci.answers.workouts!=null){
    bits.push((+ci.answers.workouts||0)+' treningów');
  }
  if(changed&&typeof renderDash==='function')try{renderDash();}catch(e){}
  if(changed&&typeof renderClients==='function')try{renderClients();}catch(e){}
  if(typeof cpClientId!=='undefined'&&cpClientId===ci.clientId&&typeof renderCPOverview==='function'&&c){
    try{renderCPOverview(c);}catch(e){}
  }
  if(!changed&&!bits.length)return null;
  return{changed,summary:bits.join(' · '),client:c||null};
}
window.syncClientFromCheckin=syncClientFromCheckin;

function openSimulateCheckin(id){openCIFill(id);}

function saveCheckinFill(id){
  ensureCheckins(id);
  let ci=pendingCheckin(id);
  if(!ci)ci=ensurePendingCheckin(id);
  applyCheckinAnswers(ci,ciFillDraft(id),'trainer');
  window._ciFillOpen=null;
  renderCIDetail(id);
  renderCheckinSummary(id);
  renderCheckinClientList();
  notify('✓ Check-in zapisany za klienta');
  const c=CL.find(x=>x.id===id);
  addNotification('task','Check-in (wpisany przez Ciebie)',(c?c.name:'Klient'),'checkin');
}

function sendCheckinTo(id){
  const c=CL.find(x=>x.id===id);
  if(filledThisWeek(id)&&!pendingCheckin(id)){
    pushMsg(id,checkinChatText(c&&c.name,'Hej {imie}! Check-in z tego tygodnia już jest — dziękuję 💪'));
    notify('Ten klient już wypełnił check-in w tym tygodniu — przypomnienie poszło w czacie');
    return;
  }
  ensurePendingCheckin(id);
  pushMsg(id,checkinChatText(c&&c.name));
  notify('✓ Check-in wysłany do '+(c?c.name:'klienta')+' (czat + oczekujący formularz)');
  renderCheckinClientList();
  if(ciActiveClient===id)renderCIDetail(id);
}

function sendCheckin(){
  const target=(document.getElementById('ci-send-target')||{}).value||'all';
  const msg=(document.getElementById('ci-send-msg')||{}).value||'';
  let targets=CL.filter(c=>c.status!=='archived');
  if(target==='no-checkin')targets=targets.filter(c=>getCIStatus(c.id)!=='done');
  if(target==='current'){
    if(!ciActiveClient){notify('Otwórz najpierw klienta w Check-inie');return;}
    targets=CL.filter(c=>c.id===ciActiveClient);
  }
  if(!targets.length){notify('Brak odbiorców');return;}
  if(!confirm('Wysłać check-in do '+targets.length+' klientów? Tej akcji nie da się cofnąć.'))return;
  targets.forEach(c=>{
    if(filledThisWeek(c.id)&&!pendingCheckin(c.id)){
      pushMsg(c.id,checkinChatText(c.name,msg));
      return;
    }
    ensurePendingCheckin(c.id);
    pushMsg(c.id,checkinChatText(c.name,msg));
  });
  closeM('m-checkin-send');
  notify('✓ Check-in wysłany do '+targets.length+' klientów (czat + oczekujący formularz)');
  renderCheckinClientList();
  if(ciActiveClient)renderCIDetail(ciActiveClient);
}

function replyToCheckin(id){
  goTo('inbox');
  setTimeout(()=>openChat(id),100);
}
var settingsTab='profile';

window.SETTINGS={
  profile:{
    name:'',
    title:'Trener personalny',
    email:'',
    phone:'',
    bio:'',
    avatar:'?',
    avatarUrl:null,
    specialty:['Trening siłowy','Hipertrofia','Redukcja'],
    certs:[],
  },
  brand:{
    accentColor:'#e60000',
    theme:'dark',
    appName:'PROGRESS LIVE',
    logo:null,
    font:'DM Sans',
  },
  company:{
    name:'Progress Live',
    nip:'',
    address:'',
    city:'',
    country:'Polska',
    website:'',
    invoice_prefix:'INV',
    invoice_footer:'Dziękuję za zaufanie!',
  },
  notifications:{
    sessionReminder:true,
    sessionReminderTime:60,
    paymentAlert:true,
    taskOverdue:true,
    inactiveClient:true,
    inactiveDays:14,
    weeklyCheckin:true,
    weeklyCheckinDay:1,
    emailDigest:false,
    pushNotif:true,
  },
  calendar:{
    workdayStart:'07:00',
    workdayEnd:'20:00',
    sessionDuration:60,
    breakBetween:15,
    weekStart:'monday',
    timezone:'Europe/Warsaw',
  },
  payments:{
    currency:'PLN',
    taxRate:23,
    vatPayer:false,
    bankAccount:'',
    paymentMethods:['gotówka','przelew'],
    autoInvoice:true,
  },
};

function renderTrainerProfilePage(){
  renderSettingsContent('profile','trainer-profile-content');
}
window.renderTrainerProfilePage=renderTrainerProfilePage;
window.goToTrainerProfile=function(){goTo('trainer-profile');};

function setSettingsTab(t){
  settingsTab=t;
  document.querySelectorAll('.settings-nav').forEach(el=>el.classList.remove('active'));
  const btn=document.getElementById('sn-'+t);if(btn)btn.classList.add('active');
  renderSettingsContent(t);
}

function renderSettingsContent(t,targetId){
  const el=document.getElementById(targetId||'settings-content');if(!el)return;
  const S=window.SETTINGS;
  const inp=(id,val,type='text',extra='')=>`<input type="${type}" class="form-input" id="set-${id}" value="${val||''}" ${extra} style="font-size:13px;">`;
  const textarea=(id,val)=>`<textarea class="form-textarea" id="set-${id}" rows="3" style="font-size:13px;">${val||''}</textarea>`;
  const toggle=(id,val,onchange='')=>`<div class="settings-toggle${val?' on':''}" id="set-${id}-toggle" onclick="toggleSetting('${id}')"><div class="settings-toggle-knob"></div></div>`;
  const sel=(id,val,opts)=>`<select class="form-select" id="set-${id}" style="width:auto;font-size:13px;">${opts.map(([v,l])=>`<option value="${v}"${v===val?' selected':''}>${l}</option>`).join('')}</select>`;
  const row=(label,desc,control)=>`<div class="settings-row"><div><div class="settings-row-label">${label}</div>${desc?`<div class="settings-row-desc">${desc}</div>`:''}</div>${control}</div>`;
  const card=(title,desc,content)=>`<div class="settings-card"><div class="settings-card-title">${title}</div>${desc?`<div class="settings-card-desc">${desc}</div>`:''}<div>${content}</div></div>`;

  if(t==='profile'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">PROFIL TRENERA</div>

      ${card('Zdjęcie i dane osobowe','Informacje widoczne dla klientów w aplikacji mobilnej.',`
        <div style="display:flex;gap:20px;align-items:center;margin-bottom:20px;">
          <div class="settings-avatar-big" id="set-avatar-preview" style="background:rgba(225,31,46,0.12);color:var(--accent);overflow:hidden;">${S.profile.avatarUrl?`<img src="${escHtml(S.profile.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;">`:escHtml(S.profile.avatar||'—')}</div>
          <div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${escHtml(S.profile.name)}</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">${escHtml(S.profile.title)}</div>
            <input type="file" id="set-avatar-file" accept="image/*" style="display:none" onchange="uploadProfileImage(this,'avatar')">
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('set-avatar-file').click()">📷 Zmień zdjęcie</button>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Imię i nazwisko</label>${inp('profile-name',S.profile.name)}</div>
          <div class="form-field"><label class="form-lbl">Tytuł zawodowy</label>${inp('profile-title',S.profile.title)}</div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Email</label>${inp('profile-email',S.profile.email||window._userEmail||'','email')}${window._userEmail?`<div style="font-size:10px;color:var(--muted);margin-top:4px;">Konto logowania: ${escHtml(window._userEmail)}</div>`:''}</div>
          <div class="form-field"><label class="form-lbl">Telefon</label>${inp('profile-phone',S.profile.phone,'tel')}</div>
        </div>
        <div class="form-field"><label class="form-lbl">Bio / Opis</label>${textarea('profile-bio',S.profile.bio)}</div>
      `)}

      ${card('Specjalizacje','Twoje obszary ekspertyzy widoczne w profilu.',`
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="set-specialties">
          ${(S.profile.specialty||[]).map(s=>`<span style="background:var(--adim);border:1px solid rgba(225,31,46,0.3);color:var(--accent);border-radius:99px;padding:4px 12px;font-size:12px;cursor:pointer;" onclick="removeSpecialty('${escHtml(s).replace(/'/g,'&#39;')}')">${escHtml(s)} ×</span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <input type="text" class="form-input" id="set-new-specialty" placeholder="np. Trening funkcjonalny" style="font-size:13px;">
          <button class="btn btn-ghost btn-sm" onclick="addSpecialty()">+ Dodaj</button>
        </div>
      `)}

      ${card('Certyfikaty i kwalifikacje','',`
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${(S.profile.certs||[]).map((c,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--s3);border-radius:8px;">
            <span style="font-size:16px;">🏆</span>
            <span style="font-size:13px;">${escHtml(c)}</span>
            <button onclick="removeCert(${i})" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;margin-left:auto;">×</button>
          </div>`).join('')}
          <div style="display:flex;gap:8px;margin-top:4px;">
            <input type="text" class="form-input" id="set-new-cert" placeholder="np. NSCA-CPT" style="font-size:13px;">
            <button class="btn btn-ghost btn-sm" onclick="addCert()">+ Dodaj</button>
          </div>
        </div>
      `)}
    </div>`;
  }

  else if(t==='brand'){
    const colors=['#e60000','#b80000','#0055a4','#ffd700','#2ecc71','#3e3e3e','#ffffff','#121212'];
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">MARKA I WYGLĄD</div>

      ${card('Kolor akcentu','Główny kolor aplikacji używany w przyciskach, nagłówkach i akcentach.',`
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          ${colors.map(c=>`<div class="color-swatch${c===S.brand.accentColor?' active':''}" style="background:${c};" onclick="setAccentColor('${c}')" title="${c}"></div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="color" id="set-custom-color" value="${S.brand.accentColor}" oninput="setAccentColor(this.value)" style="width:40px;height:32px;border:1px solid var(--border2);border-radius:8px;cursor:pointer;background:none;padding:2px;">
          <span style="font-size:12px;color:var(--muted);">Własny kolor</span>
          <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent);" id="accent-color-val">${S.brand.accentColor}</span>
        </div>
      `)}

      ${card('Motyw','',`
        ${row('Tryb ciemny','Ciemne tło — domyślne dla Progress Live',toggle('theme',S.brand.theme==='dark'))}
        ${row('Nazwa aplikacji','Widoczna w nagłówku i raportach',`<input type="text" class="form-input" id="set-appname" value="${S.brand.appName}" style="width:200px;font-size:13px;">`)}
      `)}

      ${card('Logo','Logo widoczne w raportach PDF i nagłówku aplikacji.',`
        <div style="display:flex;gap:16px;align-items:center;">
          <div style="width:80px;height:80px;background:var(--s3);border:1px solid var(--border2);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;" id="set-logo-preview">
            ${S.brand.logo?`<img src="${escHtml(S.brand.logo)}" alt="logo" style="width:100%;height:100%;object-fit:contain;">`:`<span style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1px;color:var(--accent);">PL</span>`}
          </div>
          <div>
            <input type="file" id="set-logo-file" accept="image/png,image/svg+xml,image/jpeg,image/webp" style="display:none" onchange="uploadProfileImage(this,'logo')">
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('set-logo-file').click()">📁 Wgraj logo (PNG/SVG)</button>
            ${S.brand.logo?`<button class="btn btn-ghost btn-sm" style="margin-left:6px;" onclick="clearBrandLogo()">Usuń</button>`:''}
            <div style="font-size:11px;color:var(--muted);margin-top:6px;">Zalecany rozmiar: 200×200 px · zapis lokalnie w ustawieniach (max ~400 KB)</div>
          </div>
        </div>
      `)}

      ${card('Podgląd marki','',`
        <div id="brand-preview" style="background:var(--s3);border-radius:10px;padding:16px;display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000" stroke-width="2.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;" id="brand-preview-name">PROGRESS<span style="color:var(--accent);">LIVE</span></div>
        </div>
      `)}
    </div>`;
  }

  else if(t==='company'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">DANE FIRMY</div>

      ${card('Dane podstawowe','Używane do fakturowania i raportów.',`
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Nazwa firmy / działalności</label>${inp('company-name',S.company.name)}</div>
          <div class="form-field"><label class="form-lbl">NIP</label>${inp('company-nip',S.company.nip)}</div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Adres</label>${inp('company-address',S.company.address)}</div>
          <div class="form-field"><label class="form-lbl">Miasto</label>${inp('company-city',S.company.city)}</div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Kraj</label>${inp('company-country',S.company.country)}</div>
          <div class="form-field"><label class="form-lbl">Strona internetowa</label>${inp('company-website',S.company.website,'url')}</div>
        </div>
      `)}

      ${card('Fakturowanie','Ustawienia dla automatycznych faktur.',`
        ${row('Prefiks numerów faktur','np. INV-1001, PL-001',`<input type="text" class="form-input" id="set-inv-prefix" value="${S.company.invoice_prefix}" style="width:100px;font-size:13px;">`)}
        ${row('Podatnik VAT','',toggle('vat-payer',S.payments.vatPayer))}
        ${row('Stawka VAT','',sel('tax-rate',String(S.payments.taxRate),[['0','0%'],['8','8%'],['23','23%']]))}
        ${row('Numer konta bankowego','Pojawi się na fakturach',`<input type="text" class="form-input" id="set-bank" value="${S.payments.bankAccount}" placeholder="PL 12 3456 7890..." style="width:240px;font-size:13px;">`)}
        <div class="form-field" style="margin-top:12px;"><label class="form-lbl">Stopka faktury</label>${textarea('inv-footer',S.company.invoice_footer)}</div>
      `)}
    </div>`;
  }

  else if(t==='notifications'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">POWIADOMIENIA</div>

      ${card('Sesje','',`
        ${row('Przypomnienie o sesji','Powiadamia przed zaplanowaną sesją',toggle('sess-reminder',S.notifications.sessionReminder))}
        ${row('Czas przed sesją','',sel('sess-reminder-time',String(S.notifications.sessionReminderTime),[['15','15 minut'],['30','30 minut'],['60','1 godzina'],['120','2 godziny'],['1440','1 dzień']]))}
      `)}

      ${card('Klienci','',`
        ${row('Alert — nieaktywny klient','Gdy klient nie trenuje przez X dni',toggle('inactive-alert',S.notifications.inactiveClient))}
        ${row('Liczba dni bez aktywności','',sel('inactive-days',String(S.notifications.inactiveDays),[['7','7 dni'],['14','14 dni'],['21','21 dni'],['30','30 dni']]))}
        ${row('Tygodniowy check-in','Auto-wysyłka do klientów z planem (po starcie współpracy)',toggle('weekly-checkin',S.notifications.weeklyCheckin!==false))}
        ${row('Dzień check-inu','',sel('weekly-checkin-day',String(S.notifications.weeklyCheckinDay!=null?S.notifications.weeklyCheckinDay:1),[['1','Poniedziałek'],['2','Wtorek'],['3','Środa'],['4','Czwartek'],['5','Piątek'],['0','Niedziela']]))}
        ${row('Zadania przeterminowane','Powiadomienie o nieodrobionych zadaniach',toggle('task-overdue',S.notifications.taskOverdue))}
      `)}

      ${card('Płatności','',`
        ${row('Alert o płatnościach','Oczekujące i wygasające pakiety',toggle('payment-alert',S.notifications.paymentAlert))}
      `)}

      ${card('Kanały powiadomień','',`
        ${row('Push (w aplikacji)','Powiadomienia wewnątrz Progress Live',toggle('push-notif',S.notifications.pushNotif))}
        ${row('Email digest','Dzienny raport na email (wkrótce)',toggle('email-digest',S.notifications.emailDigest))}
      `)}
    </div>`;
  }

  else if(t==='calendar'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">USTAWIENIA KALENDARZA</div>

      ${card('Godziny pracy','',`
        ${row('Początek dnia roboczego','',`<input type="time" class="form-input" id="set-workday-start" value="${S.calendar.workdayStart}" style="width:120px;font-size:13px;">`)}
        ${row('Koniec dnia roboczego','',`<input type="time" class="form-input" id="set-workday-end" value="${S.calendar.workdayEnd}" style="width:120px;font-size:13px;">`)}
        ${row('Domyślny czas sesji','',sel('sess-duration',String(S.calendar.sessionDuration),[['30','30 min'],['45','45 min'],['60','60 min'],['90','90 min'],['120','2 godz.']]))}
        ${row('Przerwa między sesjami','',sel('break-between',String(S.calendar.breakBetween),[['0','Brak'],['10','10 min'],['15','15 min'],['30','30 min']]))}
      `)}

      ${card('Preferencje wyświetlania','',`
        ${row('Pierwszy dzień tygodnia','',sel('week-start',S.calendar.weekStart,[['monday','Poniedziałek'],['sunday','Niedziela']]))}
        ${row('Strefa czasowa','',`<select class="form-select" id="set-timezone" style="width:200px;font-size:13px;">
          <option value="Europe/Warsaw" selected>Europe/Warsaw (GMT+2)</option>
          <option value="Europe/London">Europe/London (GMT+1)</option>
          <option value="UTC">UTC (GMT+0)</option>
        </select>`)}
      `)}
    </div>`;
  }

  else if(t==='payments'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">USTAWIENIA PŁATNOŚCI</div>

      ${card('Waluta i ceny','',`
        ${row('Waluta',''  ,sel('currency',S.payments.currency,[['PLN','PLN — Polski złoty'],['EUR','EUR — Euro'],['USD','USD — Dolar'],['GBP','GBP — Funt']]))}
        ${row('Automatyczne faktury','Generuj dokument po dodaniu pakietu (numeracja z istniejących faktur)',toggle('auto-invoice',S.payments.autoInvoice))}
      `)}
      <div class="settings-card" style="margin-bottom:16px;border-color:rgba(201,123,63,.35);">
        <div class="settings-card-title">Bez bramki online</div>
        <div class="settings-card-desc">Stripe, BLIK i Przelewy24 nie pobierają pieniędzy z tej strony. Klient płaci gotówką albo przelewem na konto poniżej — Ty klikasz „Opłacony”.</div>
      </div>

      ${card('Metody płatności','Zaznacz akceptowane formy płatności.',`
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${[['gotówka','💵 Gotówka'],['przelew','🏦 Przelew bankowy'],['karta','💳 Karta płatnicza'],['blik','📱 BLIK'],['stripe','🌐 Stripe (online)']].map(([v,l])=>`
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;background:var(--s3);border-radius:8px;">
              <input type="checkbox" ${S.payments.paymentMethods.includes(v)?'checked':''} style="accent-color:var(--accent);width:16px;height:16px;" data-pm="${v}">
              <span style="font-size:13px;">${l}</span>
            </label>`).join('')}
        </div>
      `)}
    </div>`;
  }

  else if(t==='integrations'){
    const items=typeof INTEGRATIONS!=='undefined'?INTEGRATIONS:[];
    el.innerHTML=`<div class="settings-section" style="max-width:700px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">INTEGRACJE</div>
      <div class="settings-card" style="margin-bottom:16px;">
        <div style="font-size:13px;line-height:1.6;color:var(--muted);margin-bottom:12px;">Zielone działają ze strony (ICS, WhatsApp, e-mail, Calendly, Zapier/Make, Garmin CSV). Pomarańczowe wymagają serwera — nie zbieramy kluczy tajnych.</div>
        <button class="btn btn-primary btn-sm" onclick="goTo('integrations')">Otwórz Integracje →</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${items.map(int=>{
          const on=!!(window.INT_CONNECTIONS&&window.INT_CONNECTIONS[int.id]&&window.INT_CONNECTIONS[int.id].connected);
          const daily=typeof intWorksNow==='function'?intWorksNow(int.id):false;
          return `<div class="settings-card" style="display:flex;flex-direction:column;gap:12px;border-top:3px solid ${int.color};">
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="font-size:28px;">${int.icon}</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">${int.name}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">${int.shortDesc}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="${daily?'int-badge-daily':'int-badge-server'}" style="font-size:10px;">${daily?(on?'Działa dziś':'Działa dziś — wyłączone'):'Wymaga serwera'}</span>
            <button class="btn btn-ghost btn-sm" onclick="goTo('integrations')">Otwórz</button>
          </div>
        </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  else if(t==='data'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">DANE I EKSPORT</div>

      ${card('Eksport danych','Pobierz kopię swoich danych.',`
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="exportData('clients')">⬇ Eksportuj klientów (CSV)</button>
          <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="exportData('sessions')">⬇ Eksportuj sesje (CSV)</button>
          <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="exportData('payments')">⬇ Eksportuj płatności (CSV)</button>
          <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="exportData('all')">⬇ Pełny eksport (JSON)</button>
        </div>
      `)}

      ${card('Import danych','Import klientów z CSV (kolumny: name,email,phone,goal,level — nagłówek opcjonalny).',`
        <div style="border:1px dashed var(--border2);border-radius:8px;padding:20px;text-align:center;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:8px;">📂</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Importuj klientów (CSV)</div>
          <div style="font-size:11px;margin-bottom:12px;">Oddzielone średnikiem lub przecinkiem · UTF-8</div>
          <input type="file" id="import-csv-file" accept=".csv,text/csv,text/plain" style="display:none" onchange="importClientsCsv(this)">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('import-csv-file').click()">Wybierz plik</button>
        </div>
      `)}

      ${card('Niebezpieczna strefa','',`
        <div style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.2);border-radius:8px;padding:14px;">
          <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:6px;">⚠ Usuń wszystkie dane</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Ta operacja jest nieodwracalna. Wszystkie dane klientów, sesje i plany zostaną usunięte.</div>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteAll()">Usuń wszystkie dane</button>
        </div>
      `)}
    </div>`;
  }

  else if(t==='about'){
    el.innerHTML=`<div class="settings-section">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">O APLIKACJI</div>

      ${card('Progress Live','',`
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
          <div style="width:64px;height:64px;background:var(--accent);border-radius:16px;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#000" stroke-width="2.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
          </div>
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;">PROGRESS<span style="color:var(--accent);">LIVE</span></div>
            <div style="font-size:11px;color:var(--muted);">Wersja 1.0.0 · Build 2025.05</div>
            <div style="font-size:11px;color:var(--muted);">Platforma dla trenerów personalnych</div>
          </div>
        </div>
        ${[['Klientów w bazie',CL.length],['Sesji łącznie',SE.length],['Planów treningowych',PL.length],['Ćwiczeń w bibliotece',allExercises().length],['Wielkość JS','~305 KB']]
          .map(([l,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">${l}</span><span style="font-family:'DM Mono',monospace;color:var(--accent);">${v}</span></div>`).join('')}
      `)}

      ${card('Technologie','',`
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${['Vanilla JS','Firebase Firestore','Claude AI API','HTML5/CSS3','SVG Charts'].map(t=>`<span class="pill pill-muted" style="font-size:11px;">${t}</span>`).join('')}
        </div>
      `)}
    </div>`;
  }
}

function toggleSetting(id){
  const toggle=document.getElementById('set-'+id+'-toggle');
  if(toggle)toggle.classList.toggle('on');
  // Przełącz faktyczną wartość w window.SETTINGS — wcześniej przełącznik był tylko wizualny.
  const S=window.SETTINGS;
  const map={
    'theme':()=>{S.brand.theme=S.brand.theme==='dark'?'light':'dark';},
    'vat-payer':()=>{S.payments.vatPayer=!S.payments.vatPayer;},
    'sess-reminder':()=>{S.notifications.sessionReminder=!S.notifications.sessionReminder;},
    'inactive-alert':()=>{S.notifications.inactiveClient=!S.notifications.inactiveClient;},
    'weekly-checkin':()=>{S.notifications.weeklyCheckin=!(S.notifications.weeklyCheckin!==false);},
    'task-overdue':()=>{S.notifications.taskOverdue=!S.notifications.taskOverdue;},
    'payment-alert':()=>{S.notifications.paymentAlert=!S.notifications.paymentAlert;},
    'push-notif':()=>{S.notifications.pushNotif=!S.notifications.pushNotif;},
    'email-digest':()=>{S.notifications.emailDigest=!S.notifications.emailDigest;},
    'auto-invoice':()=>{S.payments.autoInvoice=!S.payments.autoInvoice;},
  };
  if(map[id])map[id]();
  if(typeof ensureReminderAutoflowsFromSettings==='function')try{ensureReminderAutoflowsFromSettings();}catch(e){}
  if(typeof persistSettingsDoc==='function')persistSettingsDoc();
}

function setAccentColor(color){
  window.SETTINGS.brand.accentColor=color;
  if(typeof applyBrandTheme==='function')applyBrandTheme(window.SETTINGS);
  else{
    document.documentElement.style.setProperty('--accent',color);
    const rgb=typeof hexToRgbStr==='function'?hexToRgbStr(color):'230,0,0';
    document.documentElement.style.setProperty('--accent-rgb',rgb);
    document.documentElement.style.setProperty('--adim','rgba('+rgb+',0.14)');
  }
  const valEl=document.getElementById('accent-color-val');
  if(valEl)valEl.textContent=color;
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.toggle('active',s.style.background===color||s.style.backgroundColor===color));
  notify('✓ Kolor akcentu zmieniony na '+color);
}

function addSpecialty(){
  const inp=document.getElementById('set-new-specialty');
  if(!inp||!inp.value.trim())return;
  if(!window.SETTINGS.profile.specialty)window.SETTINGS.profile.specialty=[];
  window.SETTINGS.profile.specialty.push(inp.value.trim());
  inp.value='';
  renderSettingsContent('profile');
  persistSettingsDoc();
}

function removeSpecialty(s){
  window.SETTINGS.profile.specialty=(window.SETTINGS.profile.specialty||[]).filter(x=>x!==s);
  renderSettingsContent('profile');
  persistSettingsDoc();
}

function addCert(){
  const inp=document.getElementById('set-new-cert');
  if(!inp||!inp.value.trim())return;
  if(!window.SETTINGS.profile.certs)window.SETTINGS.profile.certs=[];
  window.SETTINGS.profile.certs.push(inp.value.trim());
  inp.value='';
  renderSettingsContent('profile');
  persistSettingsDoc();
  notify('✓ Certyfikat dodany');
}
function removeCert(idx){
  if(!window.SETTINGS.profile.certs)return;
  window.SETTINGS.profile.certs.splice(idx,1);
  renderSettingsContent('profile');
  persistSettingsDoc();
}
window.addCert=addCert;window.removeCert=removeCert;

function persistSettingsDoc(){
  const S=window.SETTINGS;if(!S)return;
  withTrainer(S);
  if(!window._db)return;
  const sid=window._settingsDocId||window._uid||'default';
  window._setDoc(window._doc(window._db,'settings',sid),S,{merge:true}).then(()=>{window._settingsDocId=sid;}).catch(e=>console.warn('Firebase settings:',e));
}
window.persistSettingsDoc=persistSettingsDoc;

function uploadProfileImage(input,kind){
  const file=input?.files?.[0];if(!file)return;
  if(file.size>450000){notify('Plik za duży (max ~400 KB). Skompresuj obraz.');input.value='';return;}
  const reader=new FileReader();
  reader.onload=()=>{
    const dataUrl=reader.result;
    if(kind==='logo'){
      window.SETTINGS.brand.logo=dataUrl;
      renderSettingsContent('brand');
    }else{
      window.SETTINGS.profile.avatarUrl=dataUrl;
      if(window.SETTINGS.profile.name)window.SETTINGS.profile.avatar=getInit(window.SETTINGS.profile.name);
      renderSettingsContent('profile');
      syncSidebarProfile();
    }
    persistSettingsDoc();
    notify(kind==='logo'?'✓ Logo zapisane':'✓ Zdjęcie profilowe zapisane');
  };
  reader.onerror=()=>notify('Nie udało się odczytać pliku');
  reader.readAsDataURL(file);
  input.value='';
}
window.uploadProfileImage=uploadProfileImage;

function clearBrandLogo(){
  window.SETTINGS.brand.logo=null;
  renderSettingsContent('brand');
  persistSettingsDoc();
  notify('Logo usunięte');
}
window.clearBrandLogo=clearBrandLogo;

async function importClientsCsv(input){
  const file=input?.files?.[0];if(!file)return;
  try{
    const text=await file.text();
    const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(!lines.length){notify('Pusty plik CSV');return;}
    const delim=lines[0].includes(';')?';':',';
    const split=(line)=>{
      const out=[];let cur='',q=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch==='"'){q=!q;continue;}
        if(ch===delim&&!q){out.push(cur.trim());cur='';continue;}
        cur+=ch;
      }
      out.push(cur.trim());
      return out;
    };
    let start=0;
    let headers=split(lines[0]).map(h=>h.toLowerCase());
    const looksHeader=headers.some(h=>/name|imie|imię|email|mail|phone|telefon|goal|cel|level|poziom/.test(h));
    if(looksHeader)start=1;else headers=['name','email','phone','goal','level'];
    const idx=(...aliases)=>{
      for(const a of aliases){const i=headers.findIndex(h=>h===a||h.includes(a));if(i>=0)return i;}
      return -1;
    };
    const iName=idx('name','imie','imię','nazwa');
    const iEmail=idx('email','mail');
    const iPhone=idx('phone','telefon','tel');
    const iGoal=idx('goal','cel');
    const iLevel=idx('level','poziom');
    let imported=0;
    for(let li=start;li<lines.length;li++){
      const cols=split(lines[li]);
      const name=(iName>=0?cols[iName]:cols[0])||'';
      if(!name||name.length<2)continue;
      const c=withTrainer({
        id:newId('c'),name,
        email:iEmail>=0?(cols[iEmail]||''):'',
        phone:iPhone>=0?(cols[iPhone]||''):'',
        goal:iGoal>=0?(cols[iGoal]||'masa'):'masa',
        level:iLevel>=0?(cols[iLevel]||'sredni'):'sredni',
        status:'active',
        joinDate:new Date().toISOString().split('T')[0],
        source:'CSV import',
        createdAt:new Date().toISOString()
      });
      CL.push(c);
      await persistById('clients',c);
      imported++;
    }
    renderAll();
    notify(imported?'✓ Zaimportowano '+imported+' klientów':'Nie znaleziono wierszy do importu');
  }catch(e){
    console.warn(e);notify('Błąd importu CSV: '+(e.message||e));
  }
  input.value='';
}
window.importClientsCsv=importClientsCsv;

function exportData(type){
  if(type==='clients'){
    downloadCsv('clients.csv',[['id','name','email','phone','goal','level','status']].concat(CL.map(c=>[c.id,c.name,c.email,c.phone,c.goal,c.level,c.status])));
    notify('✓ Eksport CSV: klienci');return;
  }
  if(type==='sessions'){
    downloadCsv('sessions.csv',[['id','clientId','date','time','type','duration']].concat(SE.map(s=>[s.id,s.clientId,s.date,s.time,s.type,s.duration])));
    notify('✓ Eksport CSV: sesje');return;
  }
  if(type==='payments'){
    const pkgs=typeof allPackages==='function'?allPackages():(window.PACKAGES||[]);
    downloadCsv('payments.csv',[['id','client','title','price','status','date']].concat(pkgs.map(p=>[p.id,p.clientName,p.title,p.price,p.payStatus,p.date])));
    notify('✓ Eksport CSV: płatności');return;
  }
  const data={clients:CL,sessions:SE,plans:PL,exercises:EX,workouts:WO,tasks:TASKS,settings:window.SETTINGS};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='progress-live-export.json';a.click();
  URL.revokeObjectURL(url);
  notify('✓ Eksport pobrany: progress-live-export.json');
}

function exportInvoicesCsv(){
  const inv=window.INVOICES||[];
  downloadCsv('invoices.csv',[['nr','client','title','date','amount','status']].concat(inv.map(i=>[i.nr||i.id,i.clientName,i.pkgTitle,i.date,i.amount,i.status])));
  notify('✓ Eksport CSV: faktury');
}
window.exportInvoicesCsv=exportInvoicesCsv;

function exportRepHistoryCsv(){
  const all=window.REP_HISTORY||[];
  downloadCsv('report-history.csv',[['client','type','date','channels','status']].concat(all.map(r=>[r.clientName,r.type,r.date,(r.sent||[]).join('|'),r.status])));
  notify('✓ Eksport CSV: historia raportów');
}
window.exportRepHistoryCsv=exportRepHistoryCsv;

function confirmDeleteAll(){
  if(!confirm('UWAGA! To wyczyści dane w tej sesji przeglądarki. Dokumenty w Firebase nie zostaną automatycznie usunięte (bezpieczeństwo). Kontynuować?'))return;
  if(!confirm('Ostatnie ostrzeżenie — lokalna pamięć aplikacji zostanie wyczyszczona. Kontynuować?'))return;
  window.CL=[];window.PL=[];window.SE=[];window.EX=[];window.WO=[];window.TASKS=[];
  window.PACKAGES=[];window.INVOICES=[];window.NOTIFICATIONS=[];window.CUSTOM_FORMS=[];
  window.USER_PROGRAMS=[];window.CHECKINS={};window.METRIC_ENTRIES=[];window.METRIC_GROUPS=[];
  if(window.MSGS)Object.keys(window.MSGS).forEach(k=>delete window.MSGS[k]);
  renderAll();notify('Lokalne dane wyczyszczone (Firebase bez zmian — usuń ręcznie w konsoli jeśli potrzeba)');
}

function saveSettings(){
  // read profile
  const S=window.SETTINGS;
  withTrainer(S);
  const g=id=>document.getElementById('set-'+id);
  if(g('profile-name'))S.profile.name=g('profile-name').value.trim()||S.profile.name;
  if(g('profile-title'))S.profile.title=g('profile-title').value.trim()||S.profile.title;
  if(g('profile-email'))S.profile.email=g('profile-email').value.trim()||S.profile.email;
  if(g('profile-phone'))S.profile.phone=g('profile-phone').value.trim()||S.profile.phone;
  if(g('profile-bio'))S.profile.bio=g('profile-bio').value||S.profile.bio;
  if(S.profile.name)S.profile.avatar=getInit(S.profile.name);
  if(g('appname'))S.brand.appName=g('appname').value||S.brand.appName;
  if(g('company-name'))S.company.name=g('company-name').value||S.company.name;
  if(g('company-nip'))S.company.nip=g('company-nip').value;
  if(g('company-address'))S.company.address=g('company-address').value;
  if(g('company-city'))S.company.city=g('company-city').value;
  if(g('company-website'))S.company.website=g('company-website').value;
  if(g('sess-reminder-time'))S.notifications.sessionReminderTime=parseInt(g('sess-reminder-time').value,10)||60;
  if(g('inactive-days'))S.notifications.inactiveDays=parseInt(g('inactive-days').value,10)||14;
  if(g('weekly-checkin-day'))S.notifications.weeklyCheckinDay=parseInt(g('weekly-checkin-day').value,10);
  if(typeof ensureReminderAutoflowsFromSettings==='function')try{ensureReminderAutoflowsFromSettings();}catch(e){}
  syncSidebarProfile();
  notify('✓ Ustawienia zapisane!');
  if(window._db){
    if(window._settingsDocId){
      window._setDoc(window._doc(window._db,'settings',window._settingsDocId),S,{merge:true}).catch(e=>console.warn('Firebase settings update:',e));
    }else{
      window._setDoc(window._doc(window._db,'settings',window._uid||'default'),S,{merge:true}).then(()=>{window._settingsDocId=window._uid||'default';}).catch(e=>console.warn('Firebase settings save:',e));
    }
  }
}
function syncSidebarProfile(){
  const name=getTrainerName('Trener');
  const title=getTrainerTitle();
  const p=getTrainerProfile();
  const nameEl=document.getElementById('sf-name');
  const roleEl=document.getElementById('sf-title');
  const av=document.getElementById('sf-avatar');
  if(nameEl)nameEl.textContent=name;
  if(roleEl)roleEl.textContent=title;
  if(av){
    if(p.avatarUrl){
      av.innerHTML=`<img src="${escHtml(p.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      av.style.background='var(--s3)';
    }else{
      av.style.background='';
      av.textContent=p.name?getInit(p.name):'?';
    }
  }
}
window.syncSidebarProfile=syncSidebarProfile;
var notifPanelOpen=false;var notifTab='all';
window.NOTIFICATIONS=[];

const NOTIF_TYPES={
  session:   {icon:'📅',color:'var(--blue)',bg:'rgba(201,162,39,0.12)'},
  payment:   {icon:'💰',color:'var(--teal)',bg:'rgba(62,207,178,0.12)'},
  alert:     {icon:'⚠️',color:'var(--orange)',bg:'rgba(201,123,63,0.12)'},
  task:      {icon:'✅',color:'var(--accent)',bg:'rgba(225,31,46,0.12)'},
  message:   {icon:'💬',color:'var(--purple)',bg:'rgba(157,124,244,0.12)'},
  metric:    {icon:'📏',color:'var(--blue)',bg:'rgba(201,162,39,0.12)'},
  system:    {icon:'🔔',color:'var(--muted)',bg:'var(--s3)'},
  expiry:    {icon:'⏰',color:'var(--red)',bg:'rgba(255,77,77,0.12)'},
};

// Demo notifications
const DEMO_NOTIFS=[
  {id:'n1',type:'session',title:'Sesja za 1 godzinę',body:'Jan Kowalski · Trening siłowy · 10:00',time:'dziś 9:00',read:false,action:'calendar'},
  {id:'n2',type:'expiry',title:'Pakiet wygasa za 3 dni',body:'Anna Nowak — Miesięczny coaching online',time:'dziś 8:30',read:false,action:'payments'},
  {id:'n3',type:'payment',title:'Oczekująca płatność',body:'Marta Kowalczyk — Program 12-tygodniowy · 2 200 zł',time:'wczoraj',read:false,action:'payments'},
  {id:'n4',type:'task',title:'Zadanie przeterminowane',body:'Tomasz Mazur — Wypełnij formularz postępów',time:'wczoraj',read:false,action:'tasks'},
  {id:'n5',type:'message',title:'Nowa wiadomość',body:'Kristina Wilson: "Hej, będę poza miastem w przyszłym tygodniu..."',time:'2 dni temu',read:true,action:'inbox'},
  {id:'n6',type:'alert',title:'Klient bez aktywności 14 dni',body:'Piotr Wiśniewski — ostatnia sesja 14 dni temu',time:'2 dni temu',read:true,action:'clients'},
  {id:'n7',type:'metric',title:'Nowe pomiary klienta',body:'Jan Kowalski zaktualizował pomiary — masa: -0.5 kg',time:'3 dni temu',read:true,action:'metrics'},
  {id:'n8',type:'session',title:'Sesja dodana do kalendarza',body:'Anna Nowak · Online · Środa 14:00',time:'3 dni temu',read:true,action:'calendar'},
  {id:'n9',type:'payment',title:'Płatność otrzymana',body:'Tomasz Mazur — 20 sesji VIP · 3 500 zł ✓',time:'tydzień temu',read:true,action:'payments'},
  {id:'n10',type:'system',title:'Raport wygenerowany',body:'Raport dla Jana Kowalskiego · 2 strony',time:'tydzień temu',read:true,action:null},
];

function allNotifs(){return window.NOTIFICATIONS||[];}
function unreadCount(){return allNotifs().filter(n=>!n.read).length;}

function updateNotifBadge(){
  const badge=document.getElementById('notif-badge');
  const cnt=unreadCount();
  if(badge){badge.style.display=cnt>0?'block':'none';}
}

function toggleNotifs(){
  notifPanelOpen=!notifPanelOpen;
  const panel=document.getElementById('notif-panel');
  const overlay=document.getElementById('notif-overlay');
  if(panel){panel.style.display=notifPanelOpen?'flex':'none';}
  if(overlay){overlay.style.display=notifPanelOpen?'block':'none';}
  if(notifPanelOpen)renderNotifs();
}

function closeNotifs(){
  notifPanelOpen=false;
  const panel=document.getElementById('notif-panel');
  const overlay=document.getElementById('notif-overlay');
  if(panel)panel.style.display='none';
  if(overlay)overlay.style.display='none';
}

function setNotifTab(t){
  notifTab=t;
  ['all','unread','alerts'].forEach(x=>{
    const btn=document.getElementById('nt-'+x);
    if(btn)btn.classList.toggle('active',x===t);
  });
  renderNotifs();
}

function renderNotifs(){
  updateNotifBadge();
  const all=allNotifs();
  let list=all;
  if(notifTab==='unread')list=all.filter(n=>!n.read);
  if(notifTab==='alerts')list=all.filter(n=>['alert','expiry','payment'].includes(n.type)&&!n.read);

  const el=document.getElementById('notif-list');if(!el)return;

  if(!list.length){
    el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--muted);">
      <div style="font-size:36px;margin-bottom:10px;opacity:0.3;">🔔</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${notifTab==='unread'?'Wszystko przeczytane ✓':'Brak powiadomień'}</div>
      <div style="font-size:11px;">Jesteś na bieżąco!</div>
    </div>`;
    return;
  }

  el.innerHTML=list.map((n,i)=>{
    const t=NOTIF_TYPES[n.type]||NOTIF_TYPES.system;
    return `<div class="notif-item${n.read?'':' unread'}" onclick="clickNotif('${n.id}')" style="animation-delay:${i*0.03}s">
      <div class="notif-icon" style="background:${t.bg};">${t.icon}</div>
      <div style="flex:1;min-width:0;">
        <div class="notif-title" style="color:${n.read?'var(--muted)':'var(--text)'};">${n.title}</div>
        <div class="notif-body">${n.body}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      ${!n.read?`<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>`:''}
    </div>`;
  }).join('');
}

function clickNotif(id){
  const all=allNotifs();
  const n=all.find(x=>x.id===id);
  if(!n)return;
  n.read=true;
  updateNotifBadge();
  renderNotifs();
  if(n.action){closeNotifs();goTo(n.action);}
}

function markAllRead(){
  allNotifs().forEach(n=>{
    n.read=true;
    if(n.id)persistById('notifications',n);
  });
  updateNotifBadge();
  renderNotifs();
  notify('✓ Wszystkie powiadomienia oznaczone jako przeczytane');
}

function clearAllNotifs(){
  if(!(window.NOTIFICATIONS||[]).length){notify('Brak powiadomień');return;}
  if(!confirm('Wyczyścić wszystkie powiadomienia?'))return;
  const ids=(window.NOTIFICATIONS||[]).map(n=>n.id);
  window.NOTIFICATIONS=[];
  if(typeof DEMO_NOTIFS!=='undefined')DEMO_NOTIFS.forEach(n=>n.read=true);
  updateNotifBadge();
  renderNotifs();
  notify('Powiadomienia wyczyszczone');
  if(window._db){
    ids.forEach(id=>{try{window._del(window._doc(window._db,'notifications',id));}catch(e){}});
  }
}

// Dodaj powiadomienie programowo (używane przez inne moduły)
function addNotification(type,title,body,action=null,fixedId=null){
  const n=withTrainer({
    id:fixedId||newId('n'),type,title,body,
    time:'teraz',
    read:false,
    action,
    autoKey:fixedId||null,
    createdAt:new Date().toISOString()
  });
  window.NOTIFICATIONS.unshift(n);
  persistById('notifications',n);
  updateNotifBadge();
  const badge=document.getElementById('notif-badge');
  if(badge){
    badge.style.transform='scale(1.5)';
    setTimeout(()=>{badge.style.transform='scale(1)';},300);
  }
  return n;
}

function generateAutoNotifs(){
  const today=new Date();
  const todayStr=dateStr(today);
  const hasNotif=key=>allNotifs().some(n=>n.id===key||n.autoKey===key);

  SE.filter(s=>s.date===todayStr).forEach(s=>{
    const c=CL.find(x=>x.id===s.clientId);
    const key='auto_sess_'+s.id;
    if(!hasNotif(key)&&c){
      addNotification('session','Sesja dziś!',`${c.name} · ${s.type||'Sesja'} · ${s.time||''}`,'calendar',key);
    }
  });

  allPackages().filter(p=>{
    if(!p.expiresDate)return false;
    const diff=Math.ceil((new Date(p.expiresDate)-today)/(1000*60*60*24));
    return diff>=0&&diff<=7;
  }).forEach(p=>{
    const diff=Math.ceil((new Date(p.expiresDate)-today)/(1000*60*60*24));
    const key='auto_exp_'+p.id;
    if(!hasNotif(key)){
      addNotification('expiry','Pakiet wygasa za '+diff+(diff===1?' dzień':' dni'),`${p.clientName} — ${p.title}`,'payments',key);
    }
  });

  allPackages().filter(p=>p.payStatus==='pending').forEach(p=>{
    const key='auto_pay_'+p.id;
    if(!hasNotif(key)){
      addNotification('payment','Oczekująca płatność',`${p.clientName||''} — ${p.title||'Pakiet'} · ${(p.price||0).toLocaleString('pl')} zł`,'payments',key);
    }
  });

  allPackages().forEach(p=>{
    const left=(p.sessions||0)-(p.sessionsUsed||0);
    if(p.payStatus==='expired'||left<=0||left>2)return;
    const key='auto_low_'+p.id+'_'+left;
    if(!hasNotif(key)){
      addNotification('alert','Mało sesji w pakiecie',`${p.clientName||''} — zostało ${left}`,'payments',key);
    }
  });

  TASKS.filter(t=>(typeof isOneShot==='function'?isOneShot(t):!isHabit(t))&&t.status!=='done'&&t.due&&t.due<todayStr).slice(0,3).forEach(t=>{
    const c=CL.find(x=>x.id===t.clientId);
    const key='auto_task_'+t.id;
    if(!hasNotif(key)&&c){
      addNotification('task','Zadanie przeterminowane',`${c.name} — ${t.title}`,'tasks',key);
    }
  });

  updateNotifBadge();
}

function openReportModal(){
  const sel=document.getElementById('rep-client');
  if(sel)sel.innerHTML=CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
  const now=new Date();
  const from=new Date(now);from.setMonth(from.getMonth()-1);
  const toEl=document.getElementById('rep-to');
  const fromEl=document.getElementById('rep-from');
  if(fromEl)fromEl.value=dateStr(from);
  if(toEl)toEl.value=dateStr(now);
  previewReportOptions();
  openM('m-report');
}

function openReportForClient(id){
  const sel=document.getElementById('rep-client');
  if(sel){
    sel.innerHTML=CL.map(c=>'<option value="'+c.id+'"'+(c.id===id?' selected':'')+'>'+c.name+'</option>').join('');
  }
  const now=new Date();
  const from=new Date(now);from.setMonth(from.getMonth()-3);
  const fromEl=document.getElementById('rep-from');
  const toEl=document.getElementById('rep-to');
  if(fromEl)fromEl.value=dateStr(from);
  if(toEl)toEl.value=dateStr(now);
  previewReportOptions();
  closeClientProfile();
  openM('m-report');
}

function previewReportOptions(){
  const cid=document.getElementById('rep-client').value;
  const c=CL.find(x=>x.id===cid);
  const from=document.getElementById('rep-from').value;
  const to=document.getElementById('rep-to').value;
  if(!c){return;}
  const sessions=SE.filter(s=>s.clientId===cid&&s.date>=from&&s.date<=to);
  const tasks=TASKS.filter(t=>t.clientId===cid);
  const plans=PL.filter(p=>p.clientId===cid);
  const entries=METRIC_ENTRIES.filter(e=>e.clientId===cid);
  const pkgs=allPackages().filter(p=>p.clientId===cid||p.clientName===c.name);
  const el=document.getElementById('rep-preview-info');
  if(el)el.innerHTML=`<strong style="color:var(--accent);">Podgląd dla: ${c.name}</strong> · Okres: ${from} — ${to}<br>
    📅 ${sessions.length} sesji · 📏 ${entries.length} pomiarów · ✅ ${tasks.length} zadań · 🏋️ ${plans.length} planów · 💰 ${pkgs.length} pakietów`;
}

function generateReport(){
  const cid=document.getElementById('rep-client').value;
  const c=CL.find(x=>x.id===cid);
  if(!c){notify('Wybierz klienta!');return;}
  const from=document.getElementById('rep-from').value;
  const to=document.getElementById('rep-to').value;
  const template=document.getElementById('rep-template').value;
  const sections={
    overview:document.getElementById('rep-sec-overview').checked,
    metrics:document.getElementById('rep-sec-metrics').checked,
    sessions:document.getElementById('rep-sec-sessions').checked,
    tasks:document.getElementById('rep-sec-tasks').checked,
    plans:document.getElementById('rep-sec-plans').checked,
    payments:document.getElementById('rep-sec-payments').checked,
    charts:document.getElementById('rep-sec-charts').checked,
    notes:document.getElementById('rep-sec-notes').checked,
  };
  closeM('m-report');
  const html=buildReportHTML(c,from,to,sections,template);
  document.getElementById('report-container').innerHTML=html;
  document.getElementById('report-overlay-title').textContent='RAPORT — '+c.name.toUpperCase();
  document.getElementById('report-overlay').style.display='flex';
}

function reportClose(){document.getElementById('report-overlay').style.display='none';}
function reportPrint(){window.print();}

function buildReportHTML(c,from,to,sec,template){
  const isDark=template==='professional';
  const bg=isDark?'#07080a':'#ffffff';
  const surface=isDark?'#12151a':'#f8f9fa';
  const border=isDark?'rgba(255,255,255,0.08)':'#e0e0e0';
  const text=isDark?'#eceae6':'#1a1a2a';
  const muted=isDark?'#5a6070':'#6b7280';
  const accent='#e60000';
  const accentDark=isDark?'rgba(225,31,46,0.1)':'rgba(100,180,0,0.08)';
  const blue=isDark?'#c9a227':'#2563eb';
  const orange=isDark?'#c97b3f':'#ea580c';
  const teal=isDark?'#3ecfb2':'#0d9488';
  const red=isDark?'#ff4d4d':'#dc2626';
  const fontMono="'DM Mono',monospace";

  const today=new Date().toLocaleDateString('pl',{day:'numeric',month:'long',year:'numeric'});
  const ci=CL.indexOf(c);
  const colHex=isDark?['#e60000','#4d9fff','#9d7cf4','#ff8c42','#3ecfb2'][ci%5]:['#16a34a','#2563eb','#7c3aed','#ea580c','#0d9488'][ci%5];

  // data
  const sessions=SE.filter(s=>s.clientId===c.id&&s.date>=from&&s.date<=to).sort((a,b)=>b.date.localeCompare(a.date));
  const allSessions=SE.filter(s=>s.clientId===c.id);
  const tasks=TASKS.filter(t=>t.clientId===c.id);
  const oneShot=tasks.filter(t=>typeof isOneShot==='function'?isOneShot(t):!isHabit(t));
  const habits=tasks.filter(t=>isHabit(t));
  const tasksDone=oneShot.filter(t=>t.status==='done');
  const plans=PL.filter(p=>p.clientId===c.id);
  const entries=METRIC_ENTRIES.filter(e=>e.clientId===c.id);
  const pkgs=allPackages().filter(p=>p.clientId===c.id||p.clientName===c.name);
  const notes=CLIENT_NOTES[c.id]||[];
  initDemoEntries(c.id);

  const totalRevenue=pkgs.filter(p=>p.payStatus==='paid').reduce((s,p)=>s+p.price,0);

  // session type counts
  const sessTypes={};
  sessions.forEach(s=>{const t=s.type||'Sesja';sessTypes[t]=(sessTypes[t]||0)+1;});

  // mass progress
  const massEntries=entries.filter(e=>e.groupId==='mg1').sort((a,b)=>a.date.localeCompare(b.date));
  const firstMass=massEntries[0]?.values?.m1;
  const lastMass=massEntries[massEntries.length-1]?.values?.m1;
  const massDiff=firstMass&&lastMass?(lastMass-firstMass).toFixed(1):null;

  // strength progress
  const strEntries=entries.filter(e=>e.groupId==='mg3').sort((a,b)=>a.date.localeCompare(b.date));
  const firstSq=strEntries[0]?.values?.m1;
  const lastSq=strEntries[strEntries.length-1]?.values?.m1;
  const sqDiff=firstSq&&lastSq?(lastSq-firstSq):null;

  const card=(content,extra='')=>`<div style="background:${surface};border:1px solid ${border};border-radius:14px;padding:20px 24px;margin-bottom:16px;${extra}">${content}</div>`;

  const sectionTitle=(t,icon,col=accent)=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid ${col}40;">
    <div style="font-size:22px;">${icon}</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1.5px;color:${col};">${t}</div>
  </div>`;

  const kpiBox=(val,lbl,col)=>`<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:14px 16px;text-align:center;">
    <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:${col};line-height:1;">${val}</div>
    <div style="font-size:10px;color:${muted};font-family:${fontMono};text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${lbl}</div>
  </div>`;

  // SVG bar chart
  const barChart=(data,col,unit='')=>{
    const max=Math.max(...data.map(d=>d.v),1);
    const W=480;const H=80;const pad=30;
    const bw=Math.floor((W-pad)/(data.length||1))-4;
    const bars=data.map((d,i)=>{
      const bh=Math.round((d.v/max)*(H-10));
      const x=pad+i*(bw+4);
      const y=H-bh;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="${col}" opacity="${d.v?0.85:0.2}"/>
        <text x="${x+bw/2}" y="${H+12}" text-anchor="middle" font-size="9" fill="${muted}" font-family="monospace">${d.l}</text>
        ${d.v?`<text x="${x+bw/2}" y="${y-3}" text-anchor="middle" font-size="8" fill="${col}" font-family="monospace">${d.v}${unit}</text>`:''}`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">${bars}</svg>`;
  };

  // line chart for metrics
  const lineChart=(points,col)=>{
    if(points.length<2)return '';
    const W=480;const H=70;
    const minV=Math.min(...points.map(p=>p.v));
    const maxV=Math.max(...points.map(p=>p.v));
    const range=maxV-minV||1;
    const xs=points.map((_,i)=>20+i*(W-40)/(points.length-1));
    const ys=points.map(p=>H-10-((p.v-minV)/range)*(H-20));
    const path='M'+xs.map((x,i)=>`${x},${ys[i]}`).join('L');
    const area=path+`L${xs[xs.length-1]},${H}L${xs[0]},${H}Z`;
    const dots=xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="3.5" fill="${col}" stroke="${bg}" stroke-width="1.5"/>`).join('');
    const labels=points.filter((_,i)=>i===0||i===points.length-1||i===Math.floor(points.length/2)).map((p,_,arr)=>{
      const idx=points.indexOf(p);
      return `<text x="${xs[idx]}" y="${H+14}" text-anchor="middle" font-size="8" fill="${muted}" font-family="monospace">${p.d.slice(5)}</text>
              <text x="${xs[idx]}" y="${ys[idx]-6}" text-anchor="middle" font-size="8" fill="${col}" font-family="monospace">${p.v}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">
      <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.2"/><stop offset="100%" stop-color="${col}" stop-opacity="0.02"/></linearGradient></defs>
      <path d="${area}" fill="url(#lg)"/>
      <path d="${path}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${labels}
    </svg>`;
  };

  // ── BUILD SECTIONS ──
  let html='';

  // HEADER
  html+=`<div style="background:linear-gradient(135deg,${isDark?'#07080a':'#1a1a2a'} 0%,${isDark?'#12151a':'#2a2a4a'} 100%);padding:36px 40px;margin-bottom:0;color:#fff;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-20px;right:-20px;width:200px;height:200px;border-radius:50%;background:${accent};opacity:0.05;"></div>
    <div style="position:absolute;bottom:-40px;right:60px;width:150px;height:150px;border-radius:50%;background:${blue};opacity:0.06;"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:3px;color:${accent};opacity:0.8;margin-bottom:6px;">PROGRESS LIVE · RAPORT POSTĘPÓW</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:42px;letter-spacing:2px;margin-bottom:4px;">${c.name.toUpperCase()}</div>
        <div style="font-size:13px;opacity:0.6;">Okres: ${from} — ${to}</div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          ${c.goal?`<span style="background:${accent}22;color:${accent};border:1px solid ${accent}44;border-radius:99px;padding:3px 10px;font-size:11px;font-family:monospace;">${{masa:'💪 Budowa masy',sila:'🏋️ Wzrost siły',redukcja:'🔥 Redukcja',kondycja:'🏃 Kondycja'}[c.goal]||c.goal}</span>`:''}
          ${c.level?`<span style="background:${blue}22;color:${blue};border:1px solid ${blue}44;border-radius:99px;padding:3px 10px;font-size:11px;font-family:monospace;">${{poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'}[c.level]||c.level}</span>`:''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="width:64px;height:64px;border-radius:50%;background:${colHex}22;border:3px solid ${colHex};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:26px;color:${colHex};margin-left:auto;margin-bottom:8px;">${getInit(c.name)}</div>
        <div style="font-size:11px;opacity:0.5;">Wygenerowano:<br>${today}</div>
        <div style="font-size:11px;opacity:0.5;margin-top:4px;">Trener: ${escHtml(getTrainerName())}</div>
      </div>
    </div>
  </div>`;

  // wrapper
  html+=`<div style="max-width:900px;margin:0 auto;padding:28px 32px;">`;

  // ── OVERVIEW ──
  if(sec.overview){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('PRZEGLĄD OGÓLNY','📋',accent)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
      ${kpiBox(allSessions.length,'Łącznie sesji',accent)}
      ${kpiBox(sessions.length,'Sesji w okresie',blue)}
      ${kpiBox(oneShot.length?tasksDone.length+'/'+oneShot.length:habits.length?habits.length+' nawyków':'0/0','Zadań ukończonych',teal)}
      ${kpiBox(totalRevenue.toLocaleString('pl')+' zł','Łączna wartość',orange)}
    </div>
    ${card(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="font-size:11px;font-family:${fontMono};color:${muted};text-transform:uppercase;margin-bottom:10px;">Dane klienta</div>
          ${[
            ['Email',c.email||'—'],['Wiek',c.age?c.age+' lat':'—'],
            ['Waga',c.weight?c.weight+' kg':'—'],['Wzrost',c.height?c.height+' cm':'—'],
            ['Status',c.status==='active'?'✅ Aktywny':'⚠ Nieaktywny'],
          ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid ${border};"><span style="color:${muted};">${l}</span><span style="font-weight:600;">${v}</span></div>`).join('')}
        </div>
        <div>
          <div style="font-size:11px;font-family:${fontMono};color:${muted};text-transform:uppercase;margin-bottom:10px;">Typy sesji w okresie</div>
          ${Object.entries(sessTypes).length?Object.entries(sessTypes).map(([t,n])=>`
            <div style="margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>${t}</span><span style="font-weight:700;color:${accent};">${n}</span></div>
              <div style="height:5px;background:${border};border-radius:99px;overflow:hidden;"><div style="height:100%;background:${accent};width:${Math.round(n/sessions.length*100)}%;border-radius:99px;"></div></div>
            </div>`).join(''):'<div style="color:'+muted+';font-size:12px;">Brak sesji w tym okresie</div>'}
        </div>
      </div>`)}
    </div>`;
  }

  // ── CHARTS ──
  if(sec.charts){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('WYKRESY POSTĘPÓW','📈',blue)}`;

    // session frequency chart — last 8 weeks
    const now2=new Date();
    const weekData=[];
    for(let i=7;i>=0;i--){
      const ws=new Date(now2);ws.setDate(ws.getDate()-i*7);
      const we=new Date(ws);we.setDate(we.getDate()+6);
      const cnt=allSessions.filter(s=>s.date>=dateStr(ws)&&s.date<=dateStr(we)).length;
      weekData.push({l:'T'+(8-i),v:cnt});
    }
    html+=card(`<div style="font-size:12px;font-weight:700;margin-bottom:12px;color:${text};">Częstotliwość sesji (ostatnie 8 tygodni)</div>${barChart(weekData,accent)}`);

    // mass progress chart
    if(massEntries.length>=2){
      const massPoints=massEntries.map(e=>({v:e.values.m1,d:e.date}));
      html+=card(`<div style="font-size:12px;font-weight:700;margin-bottom:12px;color:${text};">Masa ciała — trend (kg)
        ${massDiff!==null?`<span style="font-size:11px;color:${parseFloat(massDiff)<0?teal:orange};margin-left:8px;">${parseFloat(massDiff)>0?'+':''}${massDiff} kg</span>`:''}
      </div>${lineChart(massPoints,parseFloat(massDiff||0)<0?teal:orange)}`);
    }

    // strength chart
    if(strEntries.length>=2){
      const sqPoints=strEntries.map(e=>({v:e.values.m1,d:e.date}));
      html+=card(`<div style="font-size:12px;font-weight:700;margin-bottom:12px;color:${text};">Przysiad 1RM — trend (kg)
        ${sqDiff!==null?`<span style="font-size:11px;color:${sqDiff>0?teal:red};margin-left:8px;">${sqDiff>0?'+':''}${sqDiff} kg</span>`:''}
      </div>${lineChart(sqPoints,teal)}`);
    }
    html+='</div>';
  }

  // ── METRICS ──
  if(sec.metrics){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('POMIARY CIAŁA','📏',teal)}`;
    const groups=allMetricGroups();
    if(!entries.length){
      html+=card(`<div style="color:${muted};font-size:12px;text-align:center;padding:20px;">Brak pomiarów dla tego klienta</div>`);
    } else {
      groups.forEach(g=>{
        const ge=entries.filter(e=>e.groupId===g.id).sort((a,b)=>b.date.localeCompare(a.date));
        if(!ge.length)return;
        const last=ge[0];const first=ge[ge.length-1];
        html+=card(`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:20px;">${g.icon}</span>
            <span style="font-size:13px;font-weight:700;">${g.name}</span>
            <span style="font-size:10px;color:${muted};font-family:${fontMono};margin-left:auto;">Pomiarów: ${ge.length} · Ostatni: ${last.date}</span>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:${bg};">${['Wskaźnik',...ge.slice(0,4).map(e=>e.date),'Zmiana'].map(h=>`<th style="padding:6px 10px;text-align:left;font-family:${fontMono};font-size:10px;color:${muted};text-transform:uppercase;border-bottom:1px solid ${border};">${h}</th>`).join('')}</tr></thead>
              <tbody>${g.metrics.map(m=>{
                const vals=ge.slice(0,4).map(e=>e.values[m.id]);
                const first2=ge[ge.length-1]?.values[m.id];const last2=ge[0]?.values[m.id];
                const diff=first2!=null&&last2!=null?(last2-first2).toFixed(1):null;
                const goodDown=['mg1','mg2'].includes(g.id);
                const diffColor=diff==null?muted:parseFloat(diff)<0?(goodDown?teal:red):parseFloat(diff)>0?(goodDown?red:teal):muted;
                return `<tr style="border-bottom:1px solid ${border};">
                  <td style="padding:7px 10px;font-weight:600;">${m.name}${m.unit?' ('+m.unit+')':''}</td>
                  ${vals.map(v=>`<td style="padding:7px 10px;font-family:${fontMono};">${v!=null?v:'—'}</td>`).join('')}
                  <td style="padding:7px 10px;font-weight:700;color:${diffColor};">${diff!=null?(parseFloat(diff)>0?'+':'')+diff+(m.unit?' '+m.unit:''):'—'}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>`);
      });
    }
    html+='</div>';
  }

  // ── SESSIONS ──
  if(sec.sessions){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('HISTORIA SESJI','📅',blue)}`;
    if(!sessions.length){
      html+=card(`<div style="color:${muted};font-size:12px;text-align:center;padding:20px;">Brak sesji w wybranym okresie</div>`);
    } else {
      html+=card(`
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${['Data','Godzina','Typ','Czas','Notatki'].map(h=>`<th style="padding:7px 10px;text-align:left;font-family:${fontMono};font-size:10px;color:${muted};text-transform:uppercase;border-bottom:1px solid ${border};">${h}</th>`).join('')}</tr></thead>
          <tbody>${sessions.map((s,i)=>`<tr style="background:${i%2===0?'transparent':bg};border-bottom:1px solid ${border};">
            <td style="padding:7px 10px;font-family:${fontMono};">${s.date}</td>
            <td style="padding:7px 10px;font-family:${fontMono};color:${accent};">${s.time||'—'}</td>
            <td style="padding:7px 10px;font-weight:600;">${s.type||'Sesja'}</td>
            <td style="padding:7px 10px;color:${muted};">${s.duration||60} min</td>
            <td style="padding:7px 10px;color:${muted};font-size:11px;">${s.notes||'—'}</td>
          </tr>`).join('')}</tbody>
        </table>`);
    }
    html+='</div>';
  }

  // ── TASKS ──
  if(sec.tasks){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('REALIZACJA ZADAŃ','✅',teal)}`;
    const pct=oneShot.length?Math.round(tasksDone.length/oneShot.length*100):0;
    const habitToday=typeof todayYmd==='function'?todayYmd():'';
    html+=card(`
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;"><span>Ukończone (jednorazowe)</span><span style="font-weight:700;color:${teal};">${tasksDone.length}/${oneShot.length} (${pct}%)</span></div>
          <div style="height:8px;background:${border};border-radius:99px;overflow:hidden;"><div style="height:100%;background:${teal};width:${pct}%;border-radius:99px;transition:width 0.3s;"></div></div>
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:36px;color:${teal};">${pct}%</div>
      </div>
      ${oneShot.length?`<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>${['Zadanie','Kategoria','Priorytet','Termin','Status'].map(h=>`<th style="padding:6px 10px;text-align:left;font-family:${fontMono};font-size:10px;color:${muted};text-transform:uppercase;border-bottom:1px solid ${border};">${h}</th>`).join('')}</tr></thead>
        <tbody>${oneShot.map((t,i)=>{
          const isDone=t.status==='done';
          const catCol={trening:accent,dieta:teal,pomiary:blue,lifestyle:'#a8324a'}[t.cat]||muted;
          return `<tr style="background:${i%2===0?'transparent':bg};border-bottom:1px solid ${border};">
            <td style="padding:6px 10px;font-weight:600;${isDone?'text-decoration:line-through;color:'+muted+';':''};">${t.title}</td>
            <td style="padding:6px 10px;"><span style="background:${catCol}22;color:${catCol};border-radius:99px;padding:1px 7px;font-size:10px;font-family:${fontMono};">${t.cat||'—'}</span></td>
            <td style="padding:6px 10px;font-size:11px;color:${{high:red,medium:orange,low:teal}[t.priority]||muted};">${{high:'🔴 Wysoki',medium:'🟡 Średni',low:'🟢 Niski'}[t.priority]||'—'}</td>
            <td style="padding:6px 10px;font-family:${fontMono};color:${muted};">${t.due||'—'}</td>
            <td style="padding:6px 10px;">${isDone?`<span style="color:${teal};font-size:11px;">✓ Ukończone</span>`:`<span style="color:${orange};font-size:11px;">⏳ W toku</span>`}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`:habits.length?'':'<div style="color:'+muted+';font-size:12px;text-align:center;padding:16px;">Brak zadań</div>'}
      ${habits.length?`<div style="margin-top:16px;font-size:11px;font-family:${fontMono};color:${muted};text-transform:uppercase;margin-bottom:8px;">Nawyki (streak)</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>${['Nawyk','Kategoria','Seria','Ten tydzień'].map(h=>`<th style="padding:6px 10px;text-align:left;font-family:${fontMono};font-size:10px;color:${muted};text-transform:uppercase;border-bottom:1px solid ${border};">${h}</th>`).join('')}</tr></thead>
        <tbody>${habits.map((t,i)=>{
          const streak=typeof habitStreak==='function'?habitStreak(t,habitToday):0;
          const weekN=typeof habitWeek==='function'?habitWeek(t,habitToday).filter(d=>d.done).length:0;
          const catCol={trening:accent,dieta:teal,pomiary:blue,lifestyle:'#a8324a'}[t.cat]||muted;
          return `<tr style="background:${i%2===0?'transparent':bg};border-bottom:1px solid ${border};">
            <td style="padding:6px 10px;font-weight:600;">${t.title}</td>
            <td style="padding:6px 10px;"><span style="background:${catCol}22;color:${catCol};border-radius:99px;padding:1px 7px;font-size:10px;font-family:${fontMono};">${t.cat||'—'}</span></td>
            <td style="padding:6px 10px;font-weight:700;color:${orange};">${streak?('🔥 '+streak+' dni'):'—'}</td>
            <td style="padding:6px 10px;font-family:${fontMono};color:${muted};">${weekN}/7</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`:''}
    `);
    html+='</div>';
  }

  // ── PLANS ──
  if(sec.plans&&plans.length){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('PLANY TRENINGOWE','🏋️',orange)}`;
    plans.forEach(p=>{
      html+=card(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div><div style="font-size:14px;font-weight:700;">${p.name}</div><div style="font-size:11px;color:${muted};margin-top:2px;">${p.method} · ${p.duration} tyg. · ${p.level}</div></div>
          <span style="background:${accent}22;color:${accent};border:1px solid ${accent}44;border-radius:99px;padding:2px 10px;font-size:11px;font-family:${fontMono};">${p.method}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(p.days||[]).map(d=>`<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:6px 10px;min-width:80px;">
            <div style="font-size:10px;color:${d.rest?muted:accent};font-family:${fontMono};font-weight:700;margin-bottom:3px;">${d.day}${d.rest?' REST':''}</div>
            ${!d.rest&&d.muscles?`<div style="font-size:11px;font-weight:600;">${d.muscles}</div>`:''}
          </div>`).join('')}
        </div>`);
    });
    html+='</div>';
  }

  // ── PAYMENTS ──
  if(sec.payments&&pkgs.length){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('PŁATNOŚCI I PAKIETY','💰',teal)}`;
    html+=card(`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        ${kpiBox(pkgs.length,'Pakietów',accent)}
        ${kpiBox(totalRevenue.toLocaleString('pl')+' zł','Łącznie',teal)}
        ${kpiBox(pkgs.filter(p=>p.payStatus==='paid').length,'Opłaconych',blue)}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>${['Pakiet','Typ','Sesje','Cena','Ważny do','Status'].map(h=>`<th style="padding:6px 10px;text-align:left;font-family:${fontMono};font-size:10px;color:${muted};text-transform:uppercase;border-bottom:1px solid ${border};">${h}</th>`).join('')}</tr></thead>
        <tbody>${pkgs.map((p,i)=>{
          const st={paid:'✅ Opłacony',pending:'⏳ Oczekujący',expired:'❌ Wygasły'}[p.payStatus]||p.payStatus;
          const sc={paid:teal,pending:orange,expired:red}[p.payStatus]||muted;
          return `<tr style="background:${i%2===0?'transparent':bg};border-bottom:1px solid ${border};">
            <td style="padding:6px 10px;font-weight:600;">${p.title}</td>
            <td style="padding:6px 10px;color:${muted};">${{sessions:'Sesje',monthly:'Abonament',program:'Program',online:'Online'}[p.type]||p.type}</td>
            <td style="padding:6px 10px;font-family:${fontMono};">${p.sessionsUsed}/${p.sessions}</td>
            <td style="padding:6px 10px;font-weight:700;color:${accent};">${p.price.toLocaleString('pl')} zł</td>
            <td style="padding:6px 10px;font-family:${fontMono};color:${muted};">${p.expiresDate||'—'}</td>
            <td style="padding:6px 10px;color:${sc};">${st}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`);
    html+='</div>';
  }

  // ── NOTES ──
  if(sec.notes&&notes.length){
    html+=`<div style="margin-bottom:24px;">${sectionTitle('NOTATKI TRENERA','📝',blue)}`;
    html+=card(notes.map(n=>`<div style="padding:10px 14px;background:${bg};border-radius:8px;border-left:3px solid ${accent};margin-bottom:8px;">
      <div style="font-size:12px;line-height:1.6;">${n.text}</div>
      <div style="font-size:10px;color:${muted};font-family:${fontMono};margin-top:4px;">${n.date}</div>
    </div>`).join(''));
    html+='</div>';
  }

  // FOOTER
  html+=`<div style="margin-top:32px;padding-top:16px;border-top:1px solid ${border};display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:11px;color:${muted};">
      <strong style="color:${text};">Progress Live</strong> · ${escHtml(getTrainerSignature())}<br>
      Raport wygenerowany: ${today}
    </div>
    <div style="font-size:10px;color:${muted};font-family:${fontMono};text-align:right;">
      Strona 1/1<br>POUFNE — tylko dla klienta
    </div>
  </div>`;

  html+='</div>'; // close wrapper

  return `<div class="report-page" style="font-family:'DM Sans',sans-serif;background:${bg};color:${text};min-height:100vh;padding-bottom:40px;">${html}</div>`;
}
var forumActiveGroup='all';var forumFilter='all';var forumActivePost=null;
window.FORUM_GROUPS=[];window.FORUM_POSTS=[];window.FORUM_COMMENTS={};
window._forumViewed=window._forumViewed||{};

const DEMO_FORUM_GROUPS=[
  {name:'Ogólna społeczność',icon:'💬',color:'var(--accent)',desc:'Przestrzeń dla wszystkich klientów',privacy:'public',memberIds:[],createdAt:'2025-01-01'},
  {name:'Wyzwania treningowe',icon:'🏆',color:'var(--orange)',desc:'Tygodniowe i miesięczne wyzwania',privacy:'public',memberIds:[],createdAt:'2025-01-01'},
  {name:'Postępy i pomiary',icon:'📊',color:'var(--blue)',desc:'Dzielcie się wynikami i pomiarami',privacy:'public',memberIds:[],createdAt:'2025-01-01'},
  {name:'Przepisy i dieta',icon:'🥗',color:'var(--teal)',desc:'Zdrowe przepisy i wskazówki żywieniowe',privacy:'public',memberIds:[],createdAt:'2025-01-01'},
];

const POST_TYPE_COLORS={challenge:'var(--orange)',announcement:'var(--blue)',post:'var(--accent)',question:'var(--purple)',tip:'var(--teal)'};
const POST_TYPE_ICONS={challenge:'🏆',announcement:'📢',post:'📝',question:'❓',tip:'💡'};
const POST_TYPE_LABELS={challenge:'Wyzwanie',announcement:'Ogłoszenie',post:'Post',question:'Pytanie',tip:'Wskazówka'};
const REACTIONS_MAP={'fire':'🔥','strong':'💪','love':'❤️','like':'👍','heart':'🤍','brain':'🧠','yummy':'😋'};

function allForumGroups(){return window.FORUM_GROUPS||[];}
function allForumPosts(){return window.FORUM_POSTS||[];}
function getPostComments(pid){return (window.FORUM_COMMENTS[pid]||[]).slice().sort((a,b)=>(a.createdAt||a.date||'').localeCompare(b.createdAt||b.date||''));}
function forumActor(){
  if(window._clientAppMode){
    const c=(window.CL||[]).find(x=>x.id===window._clientId)||(window.CL||[])[0];
    return {name:(c&&c.name)||'Klient',role:'klient',clientId:window._clientId||(c&&c.id)||'',uid:window._uid||window._clientId||'client'};
  }
  return {name:(typeof getTrainerName==='function'?getTrainerName('Trener'):'Trener'),role:'trener',clientId:'',uid:window._uid||'trainer'};
}
function forumCanSeeGroup(g){
  if(!g)return false;
  if(g.privacy!=='private')return true;
  if(!window._clientAppMode)return true;
  return (g.memberIds||[]).indexOf(window._clientId)>=0;
}
function visibleForumGroups(){return allForumGroups().filter(forumCanSeeGroup);}
/** Czy klient jest na liście członków grupy (zapis z onboardu / ręczny). */
function isClientInForumGroup(clientId,groupId){
  if(!clientId||!groupId)return false;
  const g=allForumGroups().find(x=>x.id===groupId);
  if(!g)return false;
  return (g.memberIds||[]).indexOf(clientId)>=0;
}
/** Zapisuje klienta do grupy forum (public + private). Idempotentne. */
function enrollClientInForumGroup(clientId,groupId,opts){
  opts=opts||{};
  const g=allForumGroups().find(x=>x.id===groupId);
  if(!g||!clientId)return{ok:false,added:false,group:null};
  g.memberIds=Array.isArray(g.memberIds)?g.memberIds:[];
  let added=false;
  if(g.memberIds.indexOf(clientId)<0){
    g.memberIds.push(clientId);
    added=true;
    if(typeof persistById==='function')persistById('forumGroups',g);
  }
  if(opts.notify!==false&&typeof pushMsg==='function'){
    const label=g.name||'Społeczność';
    if(added||opts.forceNotify)pushMsg(clientId,'Jesteś w grupie na forum: '+label);
  }
  return{ok:true,added,group:g};
}
window.isClientInForumGroup=isClientInForumGroup;
window.enrollClientInForumGroup=enrollClientInForumGroup;
function visibleForumPosts(){
  return allForumPosts().filter(p=>{
    const g=allForumGroups().find(x=>x.id===p.groupId);
    if(!g)return !window._clientAppMode;
    return forumCanSeeGroup(g);
  });
}
function forumGroupMemberCount(g){
  if(!g)return 0;
  if(g.privacy==='private')return (g.memberIds||[]).length;
  return (window.CL||[]).filter(c=>c.status!=='archived').length;
}
function forumSortKey(p){return p.createdAt||p.date||'';}
function forumFormatWhen(p){
  const iso=p&&(p.createdAt||p.date)||'';
  if(!iso)return '';
  const d=new Date(iso);
  if(isNaN(d.getTime()))return escHtml(String(iso).slice(0,10));
  const now=new Date();
  const opts={hour:'2-digit',minute:'2-digit'};
  if(d.toDateString()===now.toDateString())return d.toLocaleTimeString('pl',opts);
  return d.toLocaleDateString('pl',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('pl',opts);
}
function forumReactionScore(p){
  const r=p&&p.reactions||{};
  return Object.values(r).reduce((s,v)=>s+(v||0),0);
}
function fillForumPostGroupSelect(){
  const fpg=document.getElementById('fp-group');
  if(!fpg)return;
  const groups=window._clientAppMode?visibleForumGroups():allForumGroups();
  fpg.innerHTML=groups.map(g=>'<option value="'+escHtml(g.id)+'">'+escHtml((g.icon||'')+' '+g.name)+'</option>').join('');
}
function forumNotifyMembers(p,group){
  const notifyEl=document.getElementById('fp-notify');
  if(notifyEl&&!notifyEl.checked)return;
  const active=(window.CL||[]).filter(c=>c.status!=='archived');
  let ids;
  if(group&&group.privacy==='private')ids=(group.memberIds||[]).slice();
  else ids=active.map(c=>c.id);
  ids=ids.filter(Boolean).slice(0,80);
  const preview=(p.body||'').slice(0,180);
  const text='Nowy post na forum: '+p.title+(preview?'\n\n'+preview:'');
  ids.forEach(id=>{if(typeof pushMsg==='function')pushMsg(id,text);});
  if(typeof addNotification==='function')addNotification('system','Post na forum',p.title,'forum');
}

function setForumFilter(f,btn){
  forumFilter=f;
  document.querySelectorAll('#forum-filter-chips .wl-filter-chip').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderForumFeed();
}

function renderForum(){
  const groups=visibleForumGroups();
  const posts=visibleForumPosts();
  fillForumPostGroupSelect();

  const nav=document.getElementById('forum-groups-nav');
  if(nav){
    const totalPosts=posts.length;
    nav.innerHTML=`<div class="forum-group-nav${forumActiveGroup==='all'?' active':''}" onclick="setForumGroup('all')">
      <span style="font-size:16px;">🌐</span>
      <span style="flex:1;">Wszystkie</span>
      <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);">${totalPosts}</span>
    </div>`+groups.map(g=>{
      const count=posts.filter(p=>p.groupId===g.id).length;
      const members=forumGroupMemberCount(g);
      const lock=g.privacy==='private'?' 🔒':'';
      return `<div class="forum-group-nav${forumActiveGroup===g.id?' active':''}" onclick="setForumGroup('${escHtml(g.id)}')">
        <span style="font-size:16px;">${escHtml(g.icon||'💬')}</span>
        <div style="flex:1;"><div>${escHtml(g.name)}${lock}</div><div style="font-size:10px;color:var(--muted);">${members} ${members===1?'osoba':'osób'}</div></div>
        <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);">${count}</span>
      </div>`;
    }).join('');
  }

  const statsEl=document.getElementById('forum-stats');
  if(statsEl){
    const totalComments=Object.values(window.FORUM_COMMENTS||{}).reduce((s,a)=>s+a.length,0);
    const people=(window.CL||[]).filter(c=>c.status!=='archived').length;
    statsEl.innerHTML=`
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span style="color:var(--muted);">Postów</span><span style="font-family:'DM Mono',monospace;color:var(--accent);">${posts.length}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span style="color:var(--muted);">Komentarzy</span><span style="font-family:'DM Mono',monospace;color:var(--teal);">${totalComments}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span style="color:var(--muted);">Grup</span><span style="font-family:'DM Mono',monospace;color:var(--blue);">${groups.length}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span style="color:var(--muted);">Klientów</span><span style="font-family:'DM Mono',monospace;color:var(--purple);">${people}</span></div>`;
  }

  renderForumFeed();
}

function setForumGroup(gid){
  forumActiveGroup=gid;
  forumActivePost=null;
  const group=allForumGroups().find(g=>g.id===gid);
  const titleEl=document.getElementById('forum-group-title');
  if(titleEl)titleEl.textContent=gid==='all'?'Wszystkie grupy':(group?group.icon+' '+group.name:'Grupa');
  renderForum();
  // reset detail panel
  const db=document.getElementById('forum-detail-body');
  const dt=document.getElementById('forum-detail-title');
  if(db)db.innerHTML=`<div style="padding:30px;text-align:center;color:var(--muted);">
    <div style="font-size:40px;margin-bottom:12px;opacity:0.3;">💬</div>
    <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Kliknij post</div>
    <div style="font-size:11px;">aby zobaczyć szczegóły i komentarze</div>
  </div>`;
  if(dt)dt.textContent='Wybierz post';
}

function renderForumFeed(){
  const search=(document.getElementById('forum-search')||{}).value||'';
  let posts=visibleForumPosts();
  if(forumActiveGroup!=='all')posts=posts.filter(p=>p.groupId===forumActiveGroup);
  if(search){
    const q=search.toLowerCase();
    posts=posts.filter(p=>((p.title||'')+' '+(p.body||'')+' '+(p.authorName||'')).toLowerCase().includes(q));
  }
  if(forumFilter==='pinned')posts=posts.filter(p=>p.pinned);
  else if(forumFilter==='recent')posts.sort((a,b)=>forumSortKey(b).localeCompare(forumSortKey(a)));
  else if(forumFilter==='popular')posts.sort((a,b)=>(forumReactionScore(b)+(b.views||0))-(forumReactionScore(a)+(a.views||0)));
  else{posts.sort((a,b)=>{if(a.pinned&&!b.pinned)return -1;if(!a.pinned&&b.pinned)return 1;return forumSortKey(b).localeCompare(forumSortKey(a));});}

  const feed=document.getElementById('forum-feed');if(!feed)return;
  if(!posts.length){
    feed.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;opacity:0.3;">💬</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak postów</div>
      <div style="font-size:12px;margin-bottom:16px;">Napisz ogłoszenie albo wskazówkę — klienci zobaczą to w swojej aplikacji.</div>
      <button class="btn btn-primary" onclick="openM('m-forum-post')">+ Nowy post</button>
    </div>`;
    return;
  }

  const me=forumActor();
  feed.innerHTML=posts.map((p,i)=>{
    const group=allForumGroups().find(g=>g.id===p.groupId);
    const col=POST_TYPE_COLORS[p.type]||'var(--accent)';
    const comments=getPostComments(p.id);
    const isTrainer=p.authorRole==='trener';
    const reactTotal=forumReactionScore(p);
    const myReact=(p.reactedBy||{})[me.uid];
    return `<div class="forum-post-card${p.pinned?' pinned':''}${forumActivePost===p.id?' active':''}" style="animation-delay:${i*0.04}s;border-top:3px solid ${col};" onclick="openForumPost('${escHtml(p.id)}')">
      ${p.pinned?'<div style="position:absolute;top:10px;right:12px;font-size:12px;color:var(--orange);">📌 Przypięty</div>':''}
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
        <div style="width:36px;height:36px;border-radius:50%;background:${isTrainer?'var(--adim)':'var(--s3)'};border:${isTrainer?'2px solid var(--accent)':'none'};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;flex-shrink:0;color:${isTrainer?'var(--accent)':'var(--text)'};">${escHtml(getInit(p.authorName||'?'))}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <span style="font-size:13px;font-weight:700;">${escHtml(p.authorName||'')}</span>
            ${isTrainer?'<span class="forum-badge" style="background:var(--adim);color:var(--accent);">Trener</span>':''}
            <span style="font-size:10px;color:var(--muted);margin-left:auto;">${forumFormatWhen(p)}</span>
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <span class="forum-badge" style="background:${col}22;color:${col};">${POST_TYPE_ICONS[p.type]||'📝'} ${escHtml(POST_TYPE_LABELS[p.type]||p.type||'Post')}</span>
            ${group?`<span class="forum-badge" style="background:${group.color}22;color:${group.color};">${escHtml(group.icon||'')} ${escHtml(group.name)}</span>`:''}
          </div>
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${escHtml(p.title||'')}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escHtml((p.body||'').replace(/\n/g,' '))}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;" onclick="event.stopPropagation()">
        ${Object.keys(REACTIONS_MAP).map(r=>{
          const cnt=(p.reactions||{})[r]||0;
          if(!cnt&&r!==myReact)return '';
          return `<button class="forum-reaction-btn${myReact===r?' active':''}" onclick="reactToPost('${escHtml(p.id)}','${r}')">${REACTIONS_MAP[r]} ${cnt||''}</button>`;
        }).join('')}
        <div style="margin-left:auto;display:flex;gap:8px;font-size:11px;color:var(--muted);">
          <span>💬 ${comments.length}</span>
          <span>👁 ${p.views||0}</span>
          <span>❤️ ${reactTotal}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openForumPost(pid){
  forumActivePost=pid;
  const p=allForumPosts().find(x=>x.id===pid);if(!p)return;
  window._forumViewed=window._forumViewed||{};
  if(!window._forumViewed[pid]){
    window._forumViewed[pid]=true;
    p.views=(p.views||0)+1;
    persistForumPostEngagement(p);
  }
  if(window._clientAppMode){
    if(typeof renderClientLive==='function')renderClientLive();
    return;
  }
  const isTrainer=p.authorRole==='trener';
  const comments=getPostComments(pid);
  const me=forumActor();
  const myReact=(p.reactedBy||{})[me.uid];
  const canManage=true;

  const panel=document.getElementById('forum-detail-panel');
  if(panel)panel.classList.add('forum-detail-open');
  const closeBtn=document.getElementById('forum-detail-close');
  if(closeBtn)closeBtn.style.display='block';

  const titleEl=document.getElementById('forum-detail-title');
  if(titleEl)titleEl.textContent='💬 Komentarze ('+comments.length+')';

  const db=document.getElementById('forum-detail-body');
  if(!db)return;

  db.innerHTML=`
    <div style="padding:14px;border-bottom:1px solid var(--border);">
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${isTrainer?'var(--adim)':'var(--s3)'};border:${isTrainer?'2px solid var(--accent)':'none'};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:12px;flex-shrink:0;color:${isTrainer?'var(--accent)':'var(--text)'};">${escHtml(getInit(p.authorName||'?'))}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;">${escHtml(p.authorName||'')} ${isTrainer?'<span style="font-size:10px;color:var(--accent);font-family:\'DM Mono\',monospace;">TRENER</span>':''}</div>
          <div style="font-size:10px;color:var(--muted);">${forumFormatWhen(p)} · 👁 ${p.views||0} wyświetleń</div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;">${escHtml(p.title||'')}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7;white-space:pre-line;">${escHtml(p.body||'')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
        ${Object.entries(REACTIONS_MAP).map(([r,icon])=>{
          const cnt=(p.reactions||{})[r]||0;
          return `<button class="forum-reaction-btn${myReact===r?' active':''}" onclick="reactToPost('${escHtml(p.id)}','${r}')">${icon} ${cnt||''}</button>`;
        }).join('')}
      </div>
      ${canManage?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
        ${!window._clientAppMode?`<button class="btn btn-ghost btn-sm" onclick="toggleForumPin('${escHtml(p.id)}')">${p.pinned?'Odepnij':'📌 Przypnij'}</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="deleteForumPost('${escHtml(p.id)}')">🗑 Usuń</button>
      </div>`:''}
    </div>

    <div id="forum-comments-list" style="padding:10px 14px;">
      ${!comments.length?'<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">Brak komentarzy — napisz pierwszy.</div>'
      :comments.map((c,i)=>{
        const isT=c.authorRole==='trener';
        const canDel=!window._clientAppMode || (c.clientId&&c.clientId===window._clientId);
        return `<div class="forum-comment" style="animation-delay:${i*0.03}s">
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="width:26px;height:26px;border-radius:50%;background:${isT?'var(--adim)':'var(--s3)'};border:${isT?'1px solid var(--accent)':'none'};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:10px;flex-shrink:0;color:${isT?'var(--accent)':'var(--text)'};">${escHtml(getInit(c.authorName||'?'))}</div>
            <div style="flex:1;">
              <span style="font-size:12px;font-weight:700;">${escHtml(c.authorName||'')}</span>
              ${isT?'<span style="font-size:9px;color:var(--accent);font-family:\'DM Mono\',monospace;margin-left:4px;">TRENER</span>':''}
              <span style="font-size:10px;color:var(--muted);margin-left:6px;">${forumFormatWhen(c)}</span>
            </div>
            ${canDel?`<button onclick="deleteForumComment('${escHtml(c.id)}','${escHtml(pid)}')" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;" title="Usuń">🗑</button>`:''}
          </div>
          <div class="forum-comment-bubble">${escHtml(c.body||'')}</div>
        </div>`;
      }).join('')}
    </div>

    <div style="padding:12px 14px;border-top:1px solid var(--border);">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">DODAJ KOMENTARZ</div>
      <textarea id="new-comment-${escHtml(pid)}" rows="3" placeholder="Napisz komentarz..." style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;color:var(--text);font-size:12px;resize:none;line-height:1.5;font-family:'DM Sans',sans-serif;margin-bottom:8px;"></textarea>
      <button class="btn btn-primary btn-sm" style="width:100%;" onclick="addComment('${escHtml(pid)}')">Opublikuj komentarz</button>
    </div>`;

  renderForumFeed();
}

function addComment(pid){
  const inp=document.getElementById('new-comment-'+pid);
  if(!inp||!inp.value.trim()){notify('Napisz komentarz!');return;}
  if(!window.FORUM_COMMENTS[pid])window.FORUM_COMMENTS[pid]=[];
  const me=forumActor();
  const now=new Date().toISOString();
  const c=withTrainer({
    id:newId('fc'),postId:pid,
    authorName:me.name,authorRole:me.role,
    body:inp.value.trim(),
    date:now.slice(0,10),createdAt:now,likes:0
  });
  if(me.clientId)c.clientId=me.clientId;
  window.FORUM_COMMENTS[pid].push(c);
  persistById('forumComments',c);
  const post=allForumPosts().find(x=>x.id===pid);
  if(post){post.comments=(window.FORUM_COMMENTS[pid]||[]).length;persistForumPostEngagement(post);}
  inp.value='';
  openForumPost(pid);
  renderForumFeed();
  if(window._clientAppMode&&typeof renderClientLive==='function')renderClientLive();
  notify('✓ Komentarz dodany');
}

function likeComment(cid,pid){
  const all=window.FORUM_COMMENTS[pid]||[];
  const c=all.find(x=>x.id===cid);
  if(!c)return;
  c.likes=(c.likes||0)+1;
  persistById('forumComments',c);
  openForumPost(pid);
}

function deleteForumComment(cid,pid){
  const all=window.FORUM_COMMENTS[pid]||[];
  const c=all.find(x=>x.id===cid);
  if(!c)return;
  if(window._clientAppMode && c.clientId!==window._clientId){notify('To nie Twój komentarz');return;}
  window.FORUM_COMMENTS[pid]=all.filter(x=>x.id!==cid);
  if(window._db&&window._del)window._del(window._doc(window._db,'forumComments',cid)).catch(e=>console.warn(e));
  const post=allForumPosts().find(x=>x.id===pid);
  if(post){post.comments=(window.FORUM_COMMENTS[pid]||[]).length;persistForumPostEngagement(post);}
  openForumPost(pid);
  renderForumFeed();
}

function persistForumPostEngagement(p){
  if(!p||!p.id)return;
  if(!window._clientAppMode){
    persistById('forumPosts',p);
    return;
  }
  const patch={
    id:p.id,
    trainerId:p.trainerId||window._trainerId||null,
    reactions:p.reactions||{},
    likes:p.likes||0,
    views:p.views||0,
    comments:p.comments||0,
    reactedBy:p.reactedBy||{}
  };
  if(!window._db){
    if(typeof persistWarn==='function')persistWarn('⚠ Brak połączenia z bazą — dane mogą nie zostać zapisane');
    return;
  }
  window._setDoc(window._doc(window._db,'forumPosts',p.id),patch,{merge:true})
    .then(()=>{p._fbId=p.id;})
    .catch(e=>{
      console.warn('Firebase forum post engagement:',e);
      if(typeof persistWarn==='function')persistWarn('⚠ Nie udało się zapisać. Sprawdź internet i spróbuj ponownie.');
    });
}

function reactToPost(pid,reaction){
  const p=allForumPosts().find(x=>x.id===pid);
  if(!p)return;
  if(!p.reactions)p.reactions={};
  if(!p.reactedBy)p.reactedBy={};
  const key=forumActor().uid;
  const prev=p.reactedBy[key];
  if(prev===reaction){
    p.reactions[reaction]=Math.max(0,(p.reactions[reaction]||0)-1);
    if(!p.reactions[reaction])delete p.reactions[reaction];
    delete p.reactedBy[key];
  }else{
    if(prev){
      p.reactions[prev]=Math.max(0,(p.reactions[prev]||0)-1);
      if(!p.reactions[prev])delete p.reactions[prev];
    }
    p.reactions[reaction]=(p.reactions[reaction]||0)+1;
    p.reactedBy[key]=reaction;
  }
  p.likes=forumReactionScore(p);
  persistForumPostEngagement(p);
  renderForumFeed();
  if(forumActivePost===pid)openForumPost(pid);
  if(window._clientAppMode&&typeof renderClientLive==='function')renderClientLive();
}

function addReaction(pid){
  reactToPost(pid,'like');
}

function closeForumDetail(){
  forumActivePost=null;
  const panel=document.getElementById('forum-detail-panel');
  if(panel)panel.classList.remove('forum-detail-open');
  const closeBtn=document.getElementById('forum-detail-close');
  if(closeBtn)closeBtn.style.display='none';
  const db=document.getElementById('forum-detail-body');
  const dt=document.getElementById('forum-detail-title');
  if(db)db.innerHTML=`<div style="padding:30px;text-align:center;color:var(--muted);">
    <div style="font-size:40px;margin-bottom:12px;opacity:0.3;">💬</div>
    <div style="font-size:13px;font-weight:600;">Kliknij post aby zobaczyć komentarze</div>
  </div>`;
  if(dt)dt.textContent='Wybierz post';
  renderForumFeed();
}

function toggleForumPin(pid){
  if(window._clientAppMode){notify('Przypinać może tylko trener');return;}
  const p=allForumPosts().find(x=>x.id===pid);if(!p)return;
  p.pinned=!p.pinned;
  persistById('forumPosts',p);
  openForumPost(pid);
  renderForum();
}

function deleteForumPost(pid){
  const p=allForumPosts().find(x=>x.id===pid);if(!p)return;
  if(window._clientAppMode && p.clientId!==window._clientId){notify('To nie Twój post');return;}
  if(!confirm('Usunąć post „'+(p.title||'')+'”?'))return;
  window.FORUM_POSTS=(window.FORUM_POSTS||[]).filter(x=>x.id!==pid);
  const comments=window.FORUM_COMMENTS[pid]||[];
  delete window.FORUM_COMMENTS[pid];
  if(window._db&&window._del){
    window._del(window._doc(window._db,'forumPosts',pid)).catch(e=>console.warn(e));
    comments.forEach(c=>window._del(window._doc(window._db,'forumComments',c.id)).catch(()=>{}));
  }
  closeForumDetail();
  renderForum();
  notify('Post usunięty');
}

function renderForumGroupMembers(){
  const wrap=document.getElementById('fg-members-wrap');
  const box=document.getElementById('fg-members');
  const priv=document.getElementById('fg-privacy');
  if(!wrap||!box)return;
  const isPriv=priv&&priv.value==='private';
  wrap.style.display=isPriv?'block':'none';
  if(!isPriv)return;
  const clients=(window.CL||[]).filter(c=>c.status!=='archived');
  if(!clients.length){box.innerHTML='<div style="font-size:12px;color:var(--muted);">Brak klientów — dodaj ich najpierw.</div>';return;}
  box.innerHTML=clients.map(c=>`<label style="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;cursor:pointer;">
    <input type="checkbox" class="fg-member-cb" value="${escHtml(c.id)}" style="accent-color:var(--accent);"> ${escHtml(c.name)}
  </label>`).join('');
}

function saveForumGroup(){
  const name=document.getElementById('fg-name').value.trim();
  if(!name){notify('Wpisz nazwę grupy!');return;}
  const privacy=(document.getElementById('fg-privacy')||{}).value||'public';
  const memberIds=privacy==='private'
    ?Array.from(document.querySelectorAll('.fg-member-cb:checked')).map(el=>el.value)
    :[];
  const g=withTrainer({
    id:newId('fg'),name,
    icon:document.getElementById('fg-icon').value,
    color:document.getElementById('fg-color').value,
    desc:document.getElementById('fg-desc').value,
    privacy,memberIds,
    createdAt:new Date().toISOString().split('T')[0]
  });
  window.FORUM_GROUPS.push(g);
  persistById('forumGroups',g);
  closeM('m-forum-group');
  renderForum();
  notify('✓ Grupa "'+name+'" utworzona');
}

function saveForumPost(){
  const title=document.getElementById('fp-title').value.trim();
  const body=document.getElementById('fp-body').value.trim();
  if(!title){notify('Wpisz tytuł posta!');return;}
  if(!body){notify('Napisz treść posta!');return;}
  const me=forumActor();
  const now=new Date().toISOString();
  const groupId=document.getElementById('fp-group').value;
  const group=allForumGroups().find(g=>g.id===groupId);
  const p=withTrainer({
    id:newId('fp'),
    title,body,
    type:document.getElementById('fp-type').value||'post',
    groupId,
    authorName:me.name,authorRole:me.role,
    pinned:!!(document.getElementById('fp-pinned')&&document.getElementById('fp-pinned').checked&&!window._clientAppMode),
    date:now.slice(0,10),createdAt:now,
    likes:0,views:0,comments:0,reactions:{},reactedBy:{}
  });
  if(me.clientId)p.clientId=me.clientId;
  window.FORUM_POSTS.unshift(p);
  persistById('forumPosts',p);
  forumNotifyMembers(p,group);
  closeM('m-forum-post');
  const titleInp=document.getElementById('fp-title');
  const bodyInp=document.getElementById('fp-body');
  if(titleInp)titleInp.value='';
  if(bodyInp)bodyInp.value='';
  renderForum();
  if(window._clientAppMode&&typeof renderClientLive==='function')renderClientLive();
  notify('✓ Post opublikowany');
}
var dashPeriod=7;

function setDashPeriod(p){
  dashPeriod=p;
  [7,30,90].forEach(x=>{
    const btn=document.getElementById('dash-period-'+x);
    if(btn)btn.classList.toggle('active',x===p);
  });
  renderDash();
}

// mini-calendar state
var dashCalDate = new Date();

function renderDash(){
  if(typeof ensureReminderAutoflowsFromSettings==='function')try{ensureReminderAutoflowsFromSettings();}catch(e){}
  if(typeof runAutoflowsCheck==='function')try{runAutoflowsCheck(false);}catch(e){}
  if(typeof runWeeklyCheckinSweep==='function')try{runWeeklyCheckinSweep({silent:true});}catch(e){}
  const today=new Date();
  const todayStr=dateStr(today);
  // week bounds
  const dow=(today.getDay()+6)%7;
  const weekStart=new Date(today);weekStart.setDate(today.getDate()-dow);
  const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+6);
  const weekStartStr=dateStr(weekStart);
  const weekEndStr=dateStr(weekEnd);

  // KPI
  const activeClients=CL.filter(c=>c.status==='active'||!c.status).length;
  const weekSessions=SE.filter(s=>s.date>=weekStartStr&&s.date<=weekEndStr);
  const activePlans=PL.length;

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const setHTML=(id,v)=>{const el=document.getElementById(id);if(el)el.innerHTML=v;};

  set('d-clients',activeClients);
  set('d-sessions',weekSessions.length);
  set('d-plans',activePlans);

  const done7=SE.filter(s=>s.date<todayStr&&s.date>=weekStartStr).length;
  setHTML('d-sessions-trend','<span style="color:var(--muted);">'+done7+' ukończone · '+weekSessions.length+' zaplanowane</span>');
  setHTML('d-clients-trend','<span style="color:var(--muted);">'+CL.length+' łącznie</span>');

  // data label
  const MONTHS_PL=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  const DAYS_PL=['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
  const dateLbl=document.getElementById('d-date-lbl');
  if(dateLbl)dateLbl.textContent=DAYS_PL[today.getDay()]+', '+today.getDate()+' '+MONTHS_PL[today.getMonth()]+' '+today.getFullYear();

  document.getElementById('nb-clients').textContent=CL.length;
  try{document.getElementById('b-client').innerHTML=CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');}catch(e){}
  try{updateExDl();}catch(e){}

  // compat hidden elements
  set('d-revenue','0 zł');
  set('d-active-count',activeClients+' aktywnych');

  renderDashToday();
  renderDashTasks();
  renderDashMiniCal();
  renderDashGettingStarted();
  renderDashClientPipeline();
  renderDashCheckinFollowup();
  renderProfileSetupBanner();
}

function dismissProfileSetupBanner(){
  try{localStorage.setItem('pl_profile_prompt','1');}catch(e){}
  renderProfileSetupBanner();
}
window.dismissProfileSetupBanner=dismissProfileSetupBanner;

function renderProfileSetupBanner(){
  const el=document.getElementById('dash-profile-setup');if(!el)return;
  let dismissed=false;
  try{dismissed=localStorage.getItem('pl_profile_prompt')==='1';}catch(e){}
  if(dismissed||!isTrainerProfileIncomplete()){el.style.display='none';el.innerHTML='';return;}
  el.style.display='block';
  el.innerHTML=`<div class="card" style="margin-bottom:20px;border-color:rgba(201,123,63,0.45);background:linear-gradient(135deg,rgba(201,123,63,0.1),var(--s2));">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:4px;">👤 UZUPEŁNIJ PROFIL TRENERA</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5;">Twoje imię i tytuł pojawią się w sidebarze, raportach, fakturach i wiadomościach do klientów.</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" onclick="dismissProfileSetupBanner()">Później</button>
        <button class="btn btn-primary btn-sm" onclick="goTo('trainer-profile')">Edytuj profil →</button>
      </div>
    </div>
  </div>`;
}

function dismissGettingStarted(){
  try{localStorage.setItem('pl_gs_dismissed','1');}catch(e){}
  renderDashGettingStarted();
}
window.dismissGettingStarted=dismissGettingStarted;

function renderDashGettingStarted(){
  const el=document.getElementById('dash-getting-started');if(!el)return;
  let dismissed=false;
  try{dismissed=localStorage.getItem('pl_gs_dismissed')==='1';}catch(e){}
  const liveClients=CL.filter(c=>c.status!=='archived');
  const hasClients=liveClients.length>0;
  const hasPlan=PL.length>0;
  const hasSess=SE.length>0;
  if(dismissed||(hasClients&&hasPlan&&hasSess)){el.style.display='none';el.innerHTML='';return;}
  const steps=[
    {done:hasClients,icon:'👤',title:'Dodaj klienta',desc:'Imię, cel i e-mail — stąd zaczyna się wszystko',action:"openM('m-client')",cta:'Dodaj klienta'},
    {done:hasPlan,icon:'📋',title:'Przypisz plan',desc:'Szablon lub nowy plan pod konkretną osobę',action:hasClients?"goTo('plans')":"openM('m-client')",cta:'Otwórz plany'},
    {done:hasSess,icon:'▶',title:'Odpal Trening Live',desc:'Wybierz klienta, start sesji, zapis ciężarów',action:"goTo('live')",cta:'Trening Live'},
  ];
  el.style.display='block';
  el.innerHTML=`<div class="card" style="margin-bottom:20px;border-color:rgba(225,31,46,0.25);background:linear-gradient(135deg,var(--adim),var(--s2));">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;">START DNIA</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5;">Trzy kroki, żeby aplikacja była gotowa do pracy z klientem.</div>
      </div>
      <button onclick="dismissGettingStarted()" class="btn btn-ghost btn-sm">Ukryj</button>
    </div>
    <div class="gs-steps" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      ${steps.map((s,i)=>`<div style="background:var(--s3);border:1px solid ${s.done?'var(--teal)':'var(--border)'};border-radius:10px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:28px;height:28px;border-radius:8px;background:${s.done?'rgba(62,207,178,0.18)':'var(--s2)'};display:flex;align-items:center;justify-content:center;">${s.done?'✓':s.icon}</div>
          <div style="font-size:12px;font-weight:700;">${i+1}. ${s.title}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:${s.done?'0':'10px'};">${s.desc}</div>
        ${s.done?'<div style="font-size:10px;color:var(--teal);font-family:\'DM Mono\',monospace;margin-top:8px;">GOTOWE</div>':`<button class="btn btn-primary btn-sm" onclick="${s.action}">${s.cta}</button>`}
      </div>`).join('')}
    </div>
  </div>`;
}

function renderDashClientPipeline(){
  const el=document.getElementById('dash-client-pipeline');if(!el)return;
  const rows=typeof clientsWithIncompleteOnboard==='function'?clientsWithIncompleteOnboard():[];
  if(!rows.length){el.style.display='none';el.innerHTML='';return;}
  const nextLabel={
    invite:'Wyślij zaproszenie',
    baseline:'Zapisz pomiary',
    schedule:'Ustaw dni treningu',
    plan:'Przypisz plan',
    calendar:'Wrzuć do kalendarza',
    package:'Dodaj pakiet'
  };
  el.style.display='block';
  el.innerHTML=`<div class="card" style="margin-bottom:20px;border-color:rgba(201,123,63,0.35);background:linear-gradient(135deg,rgba(201,123,63,0.08),var(--s2));">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;">START WSPÓŁPRACY</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5;">${rows.length===1?'1 klient wymaga dokończenia pipeline.':rows.length+' klientów wymaga dokończenia: pomiary → dni → plan → kalendarz → pakiet.'}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="goTo('clients')">Lista klientów →</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${rows.slice(0,8).map(row=>{
        const c=row.client;const st=row.status;
        const miss=(st.missingLabels||[]).slice(0,3).join(' · ');
        const cta=nextLabel[st.next]||'Dokończ';
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--s3);border:1px solid var(--border);border-radius:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;">${escHtml(c.name||'Klient')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${st.done}/${st.total} · ${escHtml(miss)}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openClientOnboardChecklist('${escHtml(c.id)}')">${escHtml(cta)}</button>
        </div>`;
      }).join('')}
      ${rows.length>8?`<div style="font-size:11px;color:var(--muted);text-align:center;">+ ${rows.length-8} więcej na liście klientów</div>`:''}
    </div>
  </div>`;
}
window.renderDashClientPipeline=renderDashClientPipeline;

function renderDashCheckinFollowup(){
  const el=document.getElementById('dash-checkin-followup');if(!el)return;
  const clients=(window.CL||[]).filter(c=>c&&c.status!=='archived');
  clients.forEach(c=>{ if(typeof ensureCheckins==='function')ensureCheckins(c.id); });
  const pending=clients.filter(c=>typeof getCIStatus==='function'&&getCIStatus(c.id)==='pending');
  const overdue=clients.filter(c=>typeof getCIStatus==='function'&&getCIStatus(c.id)==='overdue');
  const need=clients.filter(c=>typeof clientEligibleForWeeklyCheckin==='function'&&clientEligibleForWeeklyCheckin(c)&&typeof needsWeeklyCheckin==='function'&&needsWeeklyCheckin(c.id));
  if(!pending.length&&!overdue.length&&!need.length){el.style.display='none';el.innerHTML='';return;}
  const rows=[
    ...overdue.map(c=>({c,tag:'Zaległy',col:'var(--red)',cta:`sendCheckinTo('${escHtml(c.id)}')`})),
    ...pending.map(c=>({c,tag:'Oczekuje',col:'var(--orange)',cta:`goTo('checkin');setTimeout(()=>openCIClient('${escHtml(c.id)}'),200)`})),
    ...need.filter(c=>!pending.includes(c)&&!overdue.includes(c)).map(c=>({c,tag:'Do wysłania',col:'var(--accent)',cta:`sendCheckinTo('${escHtml(c.id)}')`}))
  ].slice(0,6);
  el.style.display='block';
  el.innerHTML=`<div class="card" style="margin-bottom:20px;border-color:rgba(62,207,178,0.3);background:linear-gradient(135deg,rgba(62,207,178,0.08),var(--s2));">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;">CHECK-IN TYGODNIOWY</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5;">${overdue.length?overdue.length+' zaległych · ':''}${pending.length?pending.length+' oczekuje · ':''}${need.length?need.length+' do wysłania':''}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="goTo('checkin')">Check-iny →</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${rows.map(row=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--s3);border:1px solid var(--border);border-radius:10px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;">${escHtml(row.c.name||'Klient')}</div>
          <div style="font-size:11px;color:${row.col};margin-top:2px;">${row.tag}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="${row.cta}">${row.tag==='Oczekuje'?'Otwórz':'Wyślij'}</button>
      </div>`).join('')}
    </div>
  </div>`;
}
window.renderDashCheckinFollowup=renderDashCheckinFollowup;

function renderDashMiniCal(){
  const el=document.getElementById('d-mini-cal');if(!el)return;
  const titleEl=document.getElementById('d-cal-title');
  const today=new Date();
  const todayStr=dateStr(today);
  const y=dashCalDate.getFullYear(),m=dashCalDate.getMonth();
  const MONTHS=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  if(titleEl)titleEl.textContent=MONTHS[m]+' '+y;
  const firstDay=(new Date(y,m,1).getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const DAYS=['Pn','Wt','Śr','Cz','Pt','Sb','Nd'];
  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">';
  DAYS.forEach(d=>{html+=`<div style="font-size:9px;font-family:'DM Mono',monospace;color:var(--muted);padding:4px 0;text-transform:uppercase;">${d}</div>`;});
  for(let i=0;i<firstDay;i++){html+='<div></div>';}
  for(let d=1;d<=daysInMonth;d++){
    const mm=String(m+1).padStart(2,'0');
    const dd=String(d).padStart(2,'0');
    const ds=y+'-'+mm+'-'+dd;
    const hasSess=SE.some(s=>s.date===ds);
    const isDone=hasSess&&ds<todayStr;
    const isToday=ds===todayStr;
    const dotColor=isDone?'var(--teal)':'var(--blue)';
    const dot=hasSess?`<div style="width:5px;height:5px;border-radius:50%;background:${dotColor};margin:1px auto 0;"></div>`:'';
    const bg=isToday?'var(--accent)22':'none';
    const border=isToday?'1px solid var(--accent)':'1px solid transparent';
    const fw=isToday?700:400;
    const col=isToday?'var(--accent)':'var(--text)';
    const click=hasSess?`onclick="goTo('calendar')"` :'';
    html+=`<div style="padding:3px 0;border-radius:6px;cursor:${hasSess?'pointer':'default'};background:${bg};border:${border};" ${click}>
      <div style="font-size:12px;font-weight:${fw};color:${col};">${d}</div>
      ${dot}
    </div>`;
  }
  html+='</div>';
  el.innerHTML=html;
}

function dashCalPrev(){
  dashCalDate=new Date(dashCalDate.getFullYear(),dashCalDate.getMonth()-1,1);
  renderDashMiniCal();
}
function dashCalNext(){
  dashCalDate=new Date(dashCalDate.getFullYear(),dashCalDate.getMonth()+1,1);
  renderDashMiniCal();
}
window.dashCalPrev=dashCalPrev;
window.dashCalNext=dashCalNext;


function renderDashSessChart(startStr,endStr){
  const el=document.getElementById('d-chart-sessions');if(!el)return;
  const lbl=document.getElementById('d-sess-total-lbl');

  // build daily buckets
  const days=[];
  const d=new Date(startStr+'T12:00:00');
  const end=new Date(endStr+'T12:00:00');
  while(d<=end){days.push(dateStr(d));d.setDate(d.getDate()+1);}

  // group — if >14 days, show weekly
  let buckets=[];
  if(days.length<=14){
    buckets=days.map(day=>({label:day.slice(8),value:SE.filter(s=>s.date===day).length}));
  } else if(days.length<=60){
    // weekly buckets
    const weeks={};
    days.forEach(day=>{
      const d2=new Date(day+'T12:00:00');
      const ws=getWeekStart(d2);const wk=dateStr(ws);
      if(!weeks[wk])weeks[wk]=0;
      weeks[wk]+=SE.filter(s=>s.date===day).length;
    });
    buckets=Object.entries(weeks).map(([w,v])=>({label:new Date(w+'T12:00:00').getDate()+'.',value:v}));
  } else {
    const months={};
    days.forEach(day=>{
      const mk=day.slice(0,7);
      if(!months[mk])months[mk]=0;
      months[mk]+=SE.filter(s=>s.date===day).length;
    });
    const mNames=['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    buckets=Object.entries(months).map(([m,v])=>({label:mNames[parseInt(m.slice(5))-1],value:v}));
  }

  const total=buckets.reduce((s,b)=>s+b.value,0);
  if(lbl)lbl.textContent=total+' '+(total===1?'sesja':total<5?'sesje':'sesji');

  const max=Math.max(...buckets.map(b=>b.value),1);
  el.innerHTML=`<div class="dash-bar">${buckets.map(b=>`
    <div class="dash-bar-col">
      <div class="dash-bar-val" style="color:var(--accent);">${b.value||''}</div>
      <div class="dash-bar-fill" style="height:${Math.round(b.value/max*72)+4}px;background:${b.value?'var(--accent)':'var(--s3)'}opacity:${b.value?1:0.3};"></div>
      <div class="dash-bar-lbl">${b.label}</div>
    </div>`).join('')}</div>`;
}

function renderDashRevenueChart(){
  const el=document.getElementById('d-chart-revenue');if(!el)return;
  const lbl=document.getElementById('d-rev-total-lbl');
  const all=allPackages();
  const now=new Date();
  const data=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=d.toISOString().slice(0,7);
    const mNames=['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const total=all.filter(p=>p.date&&p.date.startsWith(key)&&p.payStatus==='paid').reduce((s,p)=>s+p.price,0);
    data.push({label:mNames[d.getMonth()],value:total});
  }
  const total=data.reduce((s,d)=>s+d.value,0);
  if(lbl)lbl.textContent=total.toLocaleString('pl')+' zł';
  const max=Math.max(...data.map(d=>d.value),1);
  el.innerHTML=`<div class="dash-bar">${data.map(d=>`
    <div class="dash-bar-col">
      <div class="dash-bar-val" style="color:var(--teal);">${d.value?Math.round(d.value/1000)+'k':''}</div>
      <div class="dash-bar-fill" style="height:${Math.round(d.value/max*72)+4}px;background:${d.value?'var(--teal)':'var(--s3)'};" title="${d.value.toLocaleString('pl')} zł"></div>
      <div class="dash-bar-lbl">${d.label}</div>
    </div>`).join('')}</div>`;
}

function renderDashClients(){
  const cl=document.getElementById('d-client-list');if(!cl)return;
  if(!CL.length){cl.innerHTML='<div style="padding:28px;text-align:center;color:var(--muted);font-size:12px;">Brak klientów — <button class="btn btn-primary btn-sm" onclick="openM(\'m-client\')">Dodaj klienta</button></div>';return;}

  // header
  let html=`<div style="display:grid;grid-template-columns:1fr 80px 70px 60px;gap:8px;padding:7px 14px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--border);">
    <span>Klient</span><span>Cel</span><span>Status</span><span></span>
  </div>`;
  html+=CL.slice(0,8).map((c,i)=>{
    const col=COLS[i%5];
    const clientSess=SE.filter(s=>s.clientId===c.id);
    const lastSess=clientSess.sort((a,b)=>b.date.localeCompare(a.date))[0];
    const today=new Date();
    const dSince=lastSess?Math.floor((today-new Date(lastSess.date))/(1000*60*60*24)):null;
    const isInactive=dSince!==null&&dSince>14;
    const goalLabels={masa:'Masa',sila:'Siła',redukcja:'Redukcja',kondycja:'Kondycja'};
    return `<div class="dash-client-row" style="animation-delay:${i*0.03}s" onclick="openClientProfile('${c.id}')">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:30px;height:30px;border-radius:50%;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:12px;flex-shrink:0;">${getInit(c.name)}</div>
        <div>
          <div style="font-size:13px;font-weight:600;">${c.name}</div>
          <div style="font-size:10px;color:var(--muted);">${dSince!==null?dSince+'d temu':'brak sesji'}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);">${goalLabels[c.goal]||c.goal||'—'}</div>
      <div><span class="pill ${isInactive?'pill-orange':c.status==='inactive'?'pill-red':'pill-green'}" style="font-size:9px;"><span class="pill-dot"></span>${isInactive?'Zastój':c.status==='inactive'?'Offline':'Aktywny'}</span></div>
      <div><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px;" onclick="event.stopPropagation();openClientProfile('${c.id}')">Profil</button></div>
    </div>`;
  }).join('');
  cl.innerHTML=html;
}

function renderDashToday(){
  const el=document.getElementById('d-today-sessions');if(!el)return;
  const now=new Date();
  const today=dateStr(now);
  const tomorrow=dateStr(new Date(now.getFullYear(),now.getMonth(),now.getDate()+1));

  // Sesje dziś + jutro
  const todaySess=SE.filter(s=>s.date===today).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const tomorrowSess=SE.filter(s=>s.date===tomorrow).sort((a,b)=>(a.time||'').localeCompare(b.time||''));

  function timeLabel(s){
    if(!s.time)return null;
    const [hh,mm]=s.time.split(':').map(Number);
    const sessDate=new Date(s.date+'T'+s.time+':00');
    const diffMs=sessDate-now;
    const diffH=diffMs/3600000;
    if(s.date===today){
      if(diffMs<0)return {txt:'Zakończona',col:'var(--muted)'};
      if(diffH<1)return {txt:'Za '+Math.round(diffMs/60000)+' min',col:'var(--red)'};
      if(diffH<3)return {txt:'Za '+Math.floor(diffH)+'h',col:'var(--orange)'};
      return {txt:s.time,col:'var(--teal)'};
    }
    if(s.date===tomorrow)return {txt:'Jutro',col:'var(--blue)'};
    return {txt:s.date,col:'var(--muted)'};
  }

  function sessRow(s,i,col){
    const c=CL.find(x=>x.id===s.clientId);
    const ci=CL.findIndex(x=>x.id===s.clientId);
    const clCol=SESS_COLORS[(ci>=0?ci:i)%6];
    const av=c?(c.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()):'?';
    const tl=timeLabel(s);
    return `<div style="display:flex;align-items:center;gap:12px;padding:16px 4px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.1s;" onclick="editSession('${s.id}')" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">
      <div style="width:3px;height:44px;background:${clCol};border-radius:99px;flex-shrink:0;"></div>
      <div style="width:36px;height:36px;border-radius:50%;background:${clCol}22;color:${clCol};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;flex-shrink:0;">${av}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;">${c?c.name:'Klient'}</div>
        <div style="font-size:11px;color:var(--muted);">${s.type||'Trening personalny'} · ${s.duration||60} min</div>
      </div>
      ${tl?`<div style="font-size:11px;font-weight:600;color:${tl.col};background:${tl.col}18;padding:3px 10px;border-radius:99px;white-space:nowrap;">${tl.txt}</div>`:''}
      <button onclick="event.stopPropagation();editSession('${s.id}')" class="btn btn-ghost btn-sm" style="font-size:12px;padding:8px 16px;flex-shrink:0;">Szczegóły</button>
    </div>`;
  }

  let html='';

  if(todaySess.length){
    html+=todaySess.map((s,i)=>sessRow(s,i)).join('');
  }
  if(tomorrowSess.length){
    html+=tomorrowSess.map((s,i)=>sessRow(s,todaySess.length+i)).join('');
  }

  if(!todaySess.length&&!tomorrowSess.length){
    html=`<div style="padding:8px 0 4px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Brak sesji na dziś i jutro</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5;">Odpal trening od razu albo dopisz sesję do kalendarza.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="goTo('live')">▶ Trening Live</button>
        <button class="btn btn-ghost btn-sm" onclick="openM('m-session')">+ Dodaj do kalendarza</button>
      </div>
    </div>`;
  }

  el.innerHTML=html;
}

function renderDashTasks(){
  const el=document.getElementById('d-tasks-widget');if(!el)return;
  const today=dateStr(new Date());
  const tomorrow=dateStr(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1));

  const pendingHabits=TASKS.filter(t=>isHabit(t)&&!habitDoneOn(t,today));
  const pendingCh=TASKS.filter(t=>typeof isChallenge==='function'&&isChallenge(t)&&typeof challengeProgress==='function'&&challengeProgress(t,today).active&&!habitDoneOn(t,today)&&!challengeProgress(t,today).won);
  const oneShot=TASKS.filter(t=>(typeof isOneShot==='function'?isOneShot(t):!isHabit(t))&&t.status!=='done')
    .sort((a,b)=>{
      const pri=v=>v.due===today?0:v.due&&v.due<today?-1:v.due===tomorrow?1:2;
      return pri(a)-pri(b)||(a.due||'9999').localeCompare(b.due||'9999');
    });
  const tasks=pendingCh.concat(pendingHabits).concat(oneShot).slice(0,6);

  const done=TASKS.filter(t=>(typeof isOneShot==='function'?isOneShot(t):!isHabit(t))&&t.status==='done');

  if(!tasks.length&&!done.length&&!TASKS.filter(isHabit).length&&!(typeof isChallenge==='function'?TASKS.filter(isChallenge).length:0)){
    el.innerHTML=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:18px 0 8px;">
      <div style="margin-bottom:10px;">Nic pilnego na liście</div>
      <button class="btn btn-ghost btn-sm" onclick="openM('m-task')">+ Dodaj zadanie</button>
    </div>`;
    return;
  }

  let html='';

  const recentDone=done.sort((a,b)=>(b.doneAt||b.due||'').localeCompare(a.doneAt||a.due||'')).slice(0,2);

  tasks.forEach(t=>{
    const habit=isHabit(t);
    const ch=typeof isChallenge==='function'&&isChallenge(t);
    const isOverdue=!habit&&!ch&&t.due&&t.due<today;
    const isToday=t.due===today;
    const isTomorrow=t.due===tomorrow;
    const c=CL.find(x=>x.id===t.clientId);
    const streak=habit?habitStreak(t,today):0;
    const chSt=ch&&typeof challengeStatusText==='function'?challengeStatusText(t,today):'';
    let badge='';
    if(ch)badge=`<span style="background:rgba(201,162,39,0.15);color:var(--gold);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'DM Mono',monospace;font-weight:700;">🏆 Wyzwanie</span>`;
    else if(habit)badge=`<span style="background:rgba(157,124,244,0.15);color:var(--purple);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'DM Mono',monospace;font-weight:700;">🔥 Nawyk</span>`;
    else if(isOverdue)badge=`<span style="background:rgba(255,68,68,0.15);color:var(--red);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'DM Mono',monospace;font-weight:700;">Pilne</span>`;
    else if(isTomorrow)badge=`<span style="background:rgba(201,123,63,0.15);color:var(--orange);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'DM Mono',monospace;font-weight:700;">Wkrótce</span>`;
    const dueText=ch?(c?c.name+' · '+chSt:chSt):habit?(c?(c.name+(streak?' · 🔥 '+streak:'')):(streak?'🔥 '+streak+' dni':'Odhacz dziś')):isOverdue?'Termin: dziś':isToday?'Termin: dziś':isTomorrow?c?c.name+' · jutro':'jutro':c?c.name+(t.due?' · '+t.due:''):t.due||'Bez terminu';
    html+=`<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
      <div onclick="toggleTask('${t.id}');renderDash()" style="width:18px;height:18px;border-radius:4px;border:2px solid var(--border2);flex-shrink:0;cursor:pointer;margin-top:1px;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px;">${dueText}</div>
      </div>
      ${badge}
    </div>`;
  });

  recentDone.forEach(t=>{
    const c=CL.find(x=>x.id===t.clientId);
    html+=`<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);opacity:0.5;">
      <div style="width:18px;height:18px;border-radius:4px;background:var(--teal);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;text-decoration:line-through;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
        <div style="font-size:10px;color:var(--muted);">${c?c.name:''} ${t.doneAt?'· Ukończone '+t.doneAt:''}</div>
      </div>
    </div>`;
  });

  if(!tasks.length){
    html='<div style="font-size:12px;color:var(--muted);text-align:center;padding:16px 0;">Brak pilnych zadań ✓</div>'+html;
  }

  el.innerHTML=html;
}

