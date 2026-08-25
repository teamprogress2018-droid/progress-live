// ════════════════════════════════════════
// KLIENCI
// ════════════════════════════════════════
var clientSegment='all';
const CLIENT_GOAL_LABELS={masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja'};
const CLIENT_SEGMENT_TITLES={all:'Wszyscy klienci',active:'Aktywni klienci',inactive:'Nieaktywni klienci',archived:'Zarchiwizowani klienci'};

// Zwraca datę (Date) ostatniej jakiejkolwiek aktywności klienta, albo null jeśli brak.
// Sprawdza: sesje treningowe (SE), przypisane plany (PL), pomiary (METRIC_ENTRIES), ręczne wpisy osi czasu (CLIENT_TIMELINE).
function getClientLastActivity(clientId){
  const dates=[];
  (window.SE||[]).forEach(s=>{ if(s.clientId===clientId && s.date) dates.push(new Date(s.date+'T'+(s.time||'12:00')+':00')); });
  (window.PL||[]).forEach(p=>{ if(p.clientId===clientId && p.createdAt) dates.push(new Date(p.createdAt)); });
  (window.METRIC_ENTRIES||[]).forEach(m=>{ if(m.clientId===clientId && m.date) dates.push(new Date(m.date+'T10:00:00')); });
  (window.CLIENT_TIMELINE?.[clientId]||[]).forEach(e=>{ if(e.date) dates.push(new Date(e.date)); });
  const valid=dates.filter(d=>!isNaN(d));
  if(!valid.length)return null;
  return new Date(Math.max(...valid.map(d=>d.getTime())));
}

// Formatuje datę ostatniej aktywności do krótkiego, czytelnego tekstu + oznacza priorytet kolorem.
function formatClientActivity(clientId){
  const last=getClientLastActivity(clientId);
  if(!last)return{label:'Brak danych',color:'var(--red)',days:Infinity};
  const days=Math.floor((Date.now()-last.getTime())/(1000*60*60*24));
  let label;
  if(days<=0)label='Dziś';
  else if(days===1)label='Wczoraj';
  else if(days<7)label=days+' dni temu';
  else if(days<14)label='Tydzień temu';
  else if(days<31)label=Math.floor(days/7)+' tyg. temu';
  else label=Math.floor(days/30)+' mies. temu';
  const color=days<=3?'var(--teal)':days<=7?'var(--gold)':'var(--red)';
  return{label,color,days};
}

/** Everfit-style tracked / assigned for last N days. */
function clientTrainingWindowStats(clientId,days){
  const today=new Date();
  const sessions=(window.SE||[]).filter(s=>{
    if(s.clientId!==clientId||!s.date)return false;
    const d=new Date(s.date+'T12:00:00');
    const diff=(today-d)/86400000;
    return diff>=0&&diff<=days;
  });
  const logged=typeof completedWorkouts==='function'
    ? completedWorkouts(clientId,sessions)
    : sessions.filter(s=>s.source==='client'||s.source==='live');
  const assigned=sessions.length;
  const done=logged.length;
  const pct=assigned?Math.round((done/assigned)*100):null;
  return{done,assigned,pct};
}

function clientTasksWindowStats(clientId,days){
  const today=new Date();
  const tasks=(window.TASKS||[]).filter(t=>{
    if(t.clientId!==clientId)return false;
    const raw=t.completedAt||t.doneAt||t.dueDate||t.createdAt||t.date;
    if(!raw)return t.status==='done'||t.status==='open'||!t.status;
    const d=new Date(raw);
    if(isNaN(d))return true;
    const diff=(today-d)/86400000;
    return diff>=0&&diff<=days;
  });
  const assigned=tasks.length;
  const done=tasks.filter(t=>t.status==='done').length;
  const pct=assigned?Math.round((done/assigned)*100):null;
  return{done,assigned,pct};
}

function clPctCell(stats){
  if(!stats.assigned)return`<span class="cl-pct muted">—</span>`;
  const ok=stats.pct>=80;
  const mid=stats.pct>=40;
  return`<span class="cl-pct ${ok?'ok':mid?'mid':'low'}">${stats.done}/${stats.assigned} · ${stats.pct}%</span>`;
}

// ── Szybkie akcje z listy klientów (bez otwierania pełnego profilu) ──
function quickMessageClient(e,clientId){
  e.stopPropagation();
  goTo('inbox');
  setTimeout(()=>{ if(typeof openChat==='function')openChat(clientId); },200);
}
function quickStartWorkout(e,clientId){
  e.stopPropagation();
  goTo('live');
  setTimeout(()=>{
    const c=CL.find(x=>x.id===clientId);
    if(typeof liveClientSetField==='function')liveClientSetField(clientId,c?c.name:'');
  },200);
}
function quickCheckin(e,clientId){
  e.stopPropagation();
  if(typeof sendCheckinTo==='function')sendCheckinTo(clientId);
}
function quickArchiveClient(e,clientId){
  e.stopPropagation();
  if(typeof archiveClient==='function')archiveClient(clientId);
}
function quickRestoreClient(e,clientId){
  e.stopPropagation();
  if(typeof restoreClient==='function')restoreClient(clientId);
}
function quickDeleteClient(e,clientId){
  e.stopPropagation();
  if(typeof deleteClientPermanently==='function')deleteClientPermanently(clientId);
}

function renderClientFilters(){
  const sel=document.getElementById('client-status-filter');
  if(sel&&sel.value!==clientSegment)sel.value=clientSegment;
  const nonArchived=CL.filter(c=>c.status!=='archived');
  const segments=[
    {id:'all',label:'Wszyscy klienci',count:nonArchived.length},
    {id:'active',label:'Aktywni',count:CL.filter(c=>c.status==='active').length},
    {id:'inactive',label:'Nieaktywni',count:CL.filter(c=>c.status==='inactive').length},
    {id:'archived',label:'Zarchiwizowani',count:CL.filter(c=>c.status==='archived').length},
  ];
  const el=document.getElementById('client-filter-list');
  if(!el)return;
  el.innerHTML=segments.map(s=>`<button onclick="setClientSegment('${s.id}')" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 12px;background:${clientSegment===s.id?'var(--adim)':'none'};border:none;border-left:2px solid ${clientSegment===s.id?'var(--accent)':'transparent'};color:${clientSegment===s.id?'var(--accent)':'var(--muted)'};font-size:12px;cursor:pointer;text-align:left;">
    <span>${s.label}</span><span style="font-family:'DM Mono',monospace;font-size:11px;">${s.count}</span>
  </button>`).join('');
}
function setClientSegment(seg){clientSegment=seg;renderClientFilters();renderClients();}
function filterClients(){renderClients();}
function getSidebarClientsFiltered(){
  const q=((document.getElementById('nav-client-search')||{}).value||'').trim().toLowerCase();
  let list=(window.CL||[]).filter(c=>c&&c.status!=='archived');
  if(q){
    list=list.filter(c=>{
      const name=(c.name||'').toLowerCase();
      const email=(c.email||'').toLowerCase();
      return name.includes(q)||email.includes(q);
    });
  }
  return list.map(c=>({c,act:typeof formatClientActivity==='function'?formatClientActivity(c.id):{days:0}}))
    .sort((a,b)=>(b.act.days||0)-(a.act.days||0))
    .map(x=>x.c);
}
function renderSidebarClients(){
  const el=document.getElementById('nav-clients-list');
  if(!el)return;
  const list=getSidebarClientsFiltered();
  const activeId=(typeof cpClientId!=='undefined'&&cpClientId)?cpClientId:null;
  if(!list.length){
    const q=((document.getElementById('nav-client-search')||{}).value||'').trim();
    el.innerHTML=`<div class="nav-clients-empty">${q?'Brak wyników':'Brak klientów'}</div>`;
    return;
  }
  el.innerHTML=list.map((c,i)=>{
    const col=(typeof COLS!=='undefined'?COLS:['#e6302a','#4ade80','#60a5fa','#a78bfa','#f59e0b'])[i%5];
    const on=activeId===c.id?' active':'';
    const init=typeof getInit==='function'?getInit(c.name):(c.name||'?').slice(0,1);
    const safeName=typeof escHtml==='function'?escHtml(c.name):String(c.name||'');
    const safeInit=typeof escHtml==='function'?escHtml(init):String(init);
    return `<button type="button" class="nav-client-item${on}" role="listitem" data-client-id="${c.id}" onclick="openClientFromSidebar('${c.id}')" title="${safeName}">
      <span class="nav-client-av" style="background:${col}22;color:${col}">${safeInit}</span>
      <span class="nav-client-name">${safeName}</span>
    </button>`;
  }).join('');
}
function filterSidebarClients(){renderSidebarClients();}
function openClientFromSidebar(id){
  if(typeof closeMobileSidebar==='function')try{closeMobileSidebar();}catch(e){}
  if(typeof openClientProfile==='function')openClientProfile(id);
  else if(typeof goTo==='function'){goTo('clients');}
  renderSidebarClients();
}
window.renderSidebarClients=renderSidebarClients;
window.filterSidebarClients=filterSidebarClients;
window.openClientFromSidebar=openClientFromSidebar;

function renderClients(){
  renderClientFilters();
  const search=(document.getElementById('client-search')||{}).value||'';
  let filtered=CL.filter(c=>{
    if(search&&!(c.name||'').toLowerCase().includes(search.toLowerCase()))return false;
    if(clientSegment==='active')return c.status==='active';
    if(clientSegment==='inactive')return c.status==='inactive';
    if(clientSegment==='archived')return c.status==='archived';
    if(clientSegment==='all')return c.status!=='archived';
    return true;
  });
  filtered=filtered.map(c=>({c,act:formatClientActivity(c.id)}))
    .sort((a,b)=>b.act.days-a.act.days)
    .map(x=>x.c);
  const countEl=document.getElementById('clients-segment-count');
  if(countEl)countEl.textContent=filtered.length;
  const titleEl=document.getElementById('clients-segment-title');
  if(titleEl){
    const base=CLIENT_SEGMENT_TITLES[clientSegment]||'Klienci';
    titleEl.innerHTML=`${base} <span class="nav-badge" id="clients-segment-count">${filtered.length}</span>`;
  }
  const el=document.getElementById('clients-tbl');
  if(!filtered.length){
    const q=search.trim();
    el.innerHTML=`<div style="padding:48px 20px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;opacity:0.4;">👥</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${q?'Brak wyników':'Brak klientów w tym widoku'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5;">${q?'Spróbuj innej frazy.':clientSegment==='archived'?'Nie masz zarchiwizowanych klientów.':'Dodaj pierwszego klienta — potem plan i Trening Live.'}</div>
      ${!q&&clientSegment!=='archived'?`<button class="btn btn-primary" onclick="openM('m-client')">+ Dodaj klienta</button>`:''}
    </div>`;
    renderSidebarClients();
    return;
  }
  el.innerHTML=filtered.map((c,i)=>{
    const act=formatClientActivity(c.id);
    const t7=clientTrainingWindowStats(c.id,7);
    const t30=clientTrainingWindowStats(c.id,30);
    const tasks7=clientTasksWindowStats(c.id,7);
    const archived=c.status==='archived';
    const msgBtn=archived
      ? `<button type="button" class="cl-msg-btn" onclick="quickRestoreClient(event,'${c.id}')" title="Przywróć">↩</button>`
      : `<button type="button" class="cl-msg-btn" onclick="quickMessageClient(event,'${c.id}')" title="Wiadomość">💬</button>`;
    return `<div class="tbl-row cl-everfit-row" style="animation-delay:${i*0.03}s;" onclick="openClientProfile('${c.id}')">
    <div class="cl-name-cell">
      <div class="cl-av" style="background:${COLS[i%5]}22;color:${COLS[i%5]};">${escHtml(getInit(c.name))}</div>
      <div>
        <div class="cl-name">${escHtml(c.name)}</div>
        <div class="cl-sub">${escHtml(c.email||'Brak e-maila')}</div>
      </div>
    </div>
    <div class="cl-msg-cell" onclick="event.stopPropagation()">${msgBtn}</div>
    <div class="cl-act" style="color:${act.color};">${act.label}</div>
    <div>${clPctCell(t7)}</div>
    <div>${clPctCell(t30)}</div>
    <div>${clPctCell(tasks7)}</div>
    <div class="cl-goal">${CLIENT_GOAL_LABELS[c.goal]||c.goal||'—'}</div>
    <div class="cl-status">
      <span class="pill ${c.status==='inactive'?'pill-red':c.status==='archived'?'pill-red':'pill-green'}"><span class="pill-dot"></span>${c.status==='inactive'?'Nieaktywny':c.status==='archived'?'Zarchiwizowany':(c.appJoined?'Połączony':'Aktywny')}</span>
    </div>
  </div>`;
  }).join('');
  renderSidebarClients();
}

function openClientModal(clientId){
  window._editingClientId=clientId||null;
  const titleEl=document.querySelector('#m-client .modal-title');
  if(clientId){
    const c=CL.find(x=>x.id===clientId);
    if(!c){notify('Nie znaleziono klienta');return;}
    if(titleEl)titleEl.textContent='EDYTUJ KLIENTA';
    document.getElementById('ac-name').value=c.name||'';
    document.getElementById('ac-email').value=c.email||'';
    document.getElementById('ac-phone').value=c.phone||'';
    document.getElementById('ac-age').value=c.age||'';
    document.getElementById('ac-gender').value=c.gender||'M';
    document.getElementById('ac-weight').value=c.weight||'';
    document.getElementById('ac-height').value=c.height||'';
    document.getElementById('ac-goal').value=c.goal||'masa';
    document.getElementById('ac-level').value=c.level||'poczatkujacy';
    const freqEl=document.getElementById('ac-freq');
    if(freqEl)freqEl.value=c.trainingFreq?String(c.trainingFreq):'';
    const timeEl=document.getElementById('ac-train-time');
    if(timeEl)timeEl.value=c.preferredTrainTime||'';
    document.getElementById('ac-activity').value=c.activityLevel||'moderate';
    document.getElementById('ac-sport-notes').value=c.sportNotes||'';
    const injEl=document.getElementById('ac-injuries');
    if(injEl)injEl.value=(typeof clientInjuriesText==='function'?clientInjuriesText(c):(c.injuries||c.notes||''));
    document.getElementById('ac-notes').value=c.notes||'';
    if(typeof initPriorSportsForm==='function')initPriorSportsForm('ac',c.priorSports||[]);
    if(typeof initPhysiquePriorityForm==='function')initPhysiquePriorityForm('ac',c.physiquePriority||[]);
    if(typeof initPreferredWeekdaysForm==='function')initPreferredWeekdaysForm('ac',c.preferredWeekdays||[]);
  }else{
    if(titleEl)titleEl.textContent='NOWY KLIENT';
    ['ac-name','ac-email','ac-phone','ac-age','ac-weight','ac-height','ac-sport-notes','ac-injuries','ac-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const freqEl=document.getElementById('ac-freq');if(freqEl)freqEl.value='3';
    const timeEl=document.getElementById('ac-train-time');if(timeEl)timeEl.value='';
    if(typeof initPriorSportsForm==='function')initPriorSportsForm('ac',[]);
    if(typeof initPhysiquePriorityForm==='function')initPhysiquePriorityForm('ac',[]);
    if(typeof initPreferredWeekdaysForm==='function')initPreferredWeekdaysForm('ac',[1,3,5]);
  }
  openM('m-client');
}
window.openClientModal=openClientModal;

async function saveClient(){
  if(window._saveGuard_saveClient)return;window._saveGuard_saveClient=true;setTimeout(()=>window._saveGuard_saveClient=false,1500);

  const name=document.getElementById('ac-name').value.trim();
  if(!name){notify('Wpisz imię!');return;}

  const editId=window._editingClientId;
  const readFreq=()=>{
    const n=typeof normalizeTrainingFreq==='function'?normalizeTrainingFreq(document.getElementById('ac-freq')?.value):parseInt(document.getElementById('ac-freq')?.value,10);
    return n||undefined;
  };
  const readWeekdays=()=>typeof readPreferredWeekdaysFrom==='function'?readPreferredWeekdaysFrom('ac'):[];
  const readTrainTime=()=>(document.getElementById('ac-train-time')?.value||'').trim();
  if(editId){
    const c=CL.find(x=>x.id===editId);
    if(!c){notify('Nie znaleziono klienta');return;}
    c.name=name;
    c.email=document.getElementById('ac-email').value;
    c.phone=document.getElementById('ac-phone')?.value||'';
    c.age=+document.getElementById('ac-age').value||0;
    c.gender=document.getElementById('ac-gender').value;
    c.weight=+document.getElementById('ac-weight').value||0;
    c.height=+document.getElementById('ac-height').value||0;
    c.goal=document.getElementById('ac-goal').value;
    c.level=document.getElementById('ac-level').value;
    const freq=readFreq();if(freq)c.trainingFreq=freq;else delete c.trainingFreq;
    c.preferredWeekdays=readWeekdays();
    c.preferredTrainTime=readTrainTime();
    c.priorSports=typeof readPriorSportsFrom==='function'?readPriorSportsFrom('ac'):[];
    c.physiquePriority=typeof readPhysiquePriorityFrom==='function'?readPhysiquePriorityFrom('ac'):(c.physiquePriority||[]);
    c.activityLevel=document.getElementById('ac-activity')?.value||'moderate';
    c.sportNotes=document.getElementById('ac-sport-notes')?.value||'';
    c.injuries=document.getElementById('ac-injuries')?.value||'';
    c.notes=document.getElementById('ac-notes').value;
    window._editingClientId=null;
    closeM('m-client');
    await persistById('clients',c);
    try{renderAll();}catch(e){try{renderClients();}catch(e2){}}
    if(cpClientId===c.id){
      try{document.getElementById('cp-name').textContent=c.name;}catch(e){}
      try{renderCPOverview(c);}catch(e){}
    }
    notify('✓ Zaktualizowano: '+c.name);
    if(window._onboardResumeAfterEdit===c.id){
      window._onboardResumeAfterEdit=null;
      if(typeof maybeResumeOnboard==='function')maybeResumeOnboard(c.id);
    }
    return;
  }

  const freqNew=readFreq();
  const c=withTrainer({
    id:newId('c'),
    name,
    email:document.getElementById('ac-email').value,
    phone:document.getElementById('ac-phone')?.value||'',
    age:+document.getElementById('ac-age').value||0,
    gender:document.getElementById('ac-gender').value,
    weight:+document.getElementById('ac-weight').value||0,
    height:+document.getElementById('ac-height').value||0,
    goal:document.getElementById('ac-goal').value,
    level:document.getElementById('ac-level').value,
    trainingFreq:freqNew||3,
    preferredWeekdays:readWeekdays(),
    preferredTrainTime:readTrainTime(),
    priorSports:typeof readPriorSportsFrom==='function'?readPriorSportsFrom('ac'):[],
    physiquePriority:typeof readPhysiquePriorityFrom==='function'?readPhysiquePriorityFrom('ac'):[],
    activityLevel:document.getElementById('ac-activity')?.value||'moderate',
    sportNotes:document.getElementById('ac-sport-notes')?.value||'',
    injuries:document.getElementById('ac-injuries')?.value||'',
    notes:document.getElementById('ac-notes').value,
    status:'active',
    joinDate:new Date().toISOString().split('T')[0],
    createdAt:new Date().toISOString()
  });
  // najpierw dodaj lokalnie — natychmiast
  CL.push(c);
  window._editingClientId=null;
  closeM('m-client');
  ['ac-name','ac-email','ac-phone','ac-age','ac-weight','ac-height','ac-injuries','ac-notes'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  try{renderAll();}catch(e){try{renderClients();}catch(e2){}}
  notify('✅ Klient '+c.name+' dodany!');
  addNotification('system','Nowy klient!',c.name+' dodany do listy','clients');
  if(typeof runOnboardingForClient==='function')runOnboardingForClient(c);
  setTimeout(()=>openClientOnboardChecklist(c.id),400);
  // Firebase w tle — to samo id lokalnie i w Firestore
  await persistById('clients',c);
  if(typeof fireIntEvent==='function')fireIntEvent('client.created',{client:{id:c.id,name:c.name,email:c.email||'',phone:c.phone||''}});
}

function getClientOnboard(c){
  if(typeof clientOnboardStatus==='function')return clientOnboardStatus(c);
  if(!c)return{invite:false,plan:false,session:false,baseline:false,schedule:false,calendar:false,package:false,done:0,total:6,complete:true,next:null,missing:[],missingLabels:[]};
  const invite=!!(c.inviteSent||c.appInvited||c.inviteSentAt||c.inviteSkipped);
  const plan=PL.some(p=>p.clientId===c.id);
  const session=SE.some(s=>s.clientId===c.id);
  const baseline=typeof clientHasBaseline==='function'?clientHasBaseline(c.id):!!(c.baselineDone||c.weight);
  const schedule=typeof clientHasSchedulePrefs==='function'?clientHasSchedulePrefs(c):!!((c.preferredWeekdays||[]).length);
  const calendar=session;
  const packageDone=typeof clientHasPackage==='function'?clientHasPackage(c):!!(c.packageSkipped||(window.PACKAGES||[]).some(p=>p&&p.clientId===c.id));
  const done=[invite,baseline,schedule,plan,calendar,packageDone].filter(Boolean).length;
  return{invite,baseline,schedule,plan,calendar,package:packageDone,session,done,total:6,complete:done===6,next:null,missing:[],missingLabels:[]};
}
window.getClientOnboard=getClientOnboard;

function maybeResumeOnboard(clientId){
  const c=CL.find(x=>x.id===clientId);
  if(!c||c.status==='archived')return;
  const st=getClientOnboard(c);
  if(st.complete)return;
  if(window._onboardResumeTimer)clearTimeout(window._onboardResumeTimer);
  window._onboardResumeTimer=setTimeout(()=>{
    window._onboardResumeTimer=null;
    openClientOnboardChecklist(clientId);
  },450);
}
window.maybeResumeOnboard=maybeResumeOnboard;

function skipClientInvite(clientId){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  c.inviteSkipped=true;
  persistById('clients',c);
  renderClientOnboardChecklist();
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  if(typeof renderClients==='function')try{renderClients();}catch(e){}
  notify('Zaproszenie pominięte — możesz wrócić do niego później');
}
window.skipClientInvite=skipClientInvite;

function skipClientPackage(clientId){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  c.packageSkipped=true;
  persistById('clients',c);
  if(typeof renderClientOnboardChecklist==='function')renderClientOnboardChecklist();
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  if(typeof renderClients==='function')try{renderClients();}catch(e){}
  notify('Pakiet pominięty — możesz dodać go później w Płatnościach');
}
window.skipClientPackage=skipClientPackage;

function openPackageForClient(clientId){
  window._onboardResumeAfterPackage=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  const pkgEl=document.getElementById('pkg-client');
  if(pkgEl){
    if(!(pkgEl.options&&pkgEl.options.length)){
      pkgEl.innerHTML=(window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.name)+'</option>').join('');
    }
    pkgEl.value=clientId;
  }
  const pkgDate=document.getElementById('pkg-date');
  if(pkgDate&&!pkgDate.value)pkgDate.value=new Date().toISOString().split('T')[0];
  const paySt=document.getElementById('pkg-pay-status');
  if(paySt)paySt.value='pending';
  openM('m-package');
}
window.openPackageForClient=openPackageForClient;

function clientPendingPackage(clientId){
  return(window.PACKAGES||[]).find(p=>p&&p.clientId===clientId&&p.payStatus==='pending'&&!p.paymentRequestedAt)||null;
}
window.clientPendingPackage=clientPendingPackage;

function openAiPlanForClient(clientId){
  closeM('m-client-onboard');
  if(typeof closeClientProfile==='function')closeClientProfile();
  window._aplPrefillClientId=clientId;
  goTo('aiplangen');
  setTimeout(()=>{
    const sel=document.getElementById('apl-client');
    if(sel){
      sel.value=clientId;
      if(typeof aplFillFromClient==='function')aplFillFromClient();
    }
  },200);
}
window.openAiPlanForClient=openAiPlanForClient;

function openBuilderForClient(clientId){
  closeM('m-client-onboard');
  if(typeof closeClientProfile==='function')closeClientProfile();
  window._builderBack='clients';
  goTo('builder');
  setTimeout(()=>{
    const sel=document.getElementById('b-client');
    if(sel){
      sel.value=clientId;
      if(typeof updatePeriod==='function')updatePeriod();
    }
  },200);
}
window.openBuilderForClient=openBuilderForClient;

function openClientOnboardChecklist(clientId){
  window._onboardClientId=clientId;
  renderClientOnboardChecklist();
  openM('m-client-onboard');
}

function renderClientOnboardChecklist(){
  const id=window._onboardClientId;
  const c=CL.find(x=>x.id===id);
  const el=document.getElementById('client-onboard-steps');
  if(!el||!c)return;
  const st=getClientOnboard(c);
  const intro=document.getElementById('client-onboard-intro');
  if(intro)intro.textContent=st.complete
    ? c.name+' jest gotowy do codziennej pracy.'
    : 'Klient: '+c.name+' — dokończ start współpracy.';
  const prog=document.getElementById('client-onboard-progress');
  if(prog){
    const pct=Math.round(st.done/st.total*100);
    prog.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:6px;"><span>Postęp startu</span><span style="font-family:'DM Mono',monospace;color:var(--accent);">${st.done}/${st.total}</span></div>
      <div style="height:6px;background:var(--s4);border-radius:99px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:99px;"></div></div>`;
  }
  const safeName=c.name.replace(/'/g,"\\'");
  const steps=[
    {done:st.invite,icon:'📱',title:'Wyślij zaproszenie',desc:'Link do aplikacji w wiadomości (możesz pominąć)',
      action:`closeM('m-client-onboard');openInviteModal('${id}')`,cta:'Wyślij',
      extra:st.invite?'':`<button class="btn btn-ghost btn-sm" onclick="skipClientInvite('${id}')">Pomiń</button>`},
    {done:st.baseline,icon:'⚖️',title:'Pomiary startowe (baseline)',desc:'Waga, %BF i obwody z datą — historia progresu',
      action:`openClientBaselineModal('${id}')`,cta:'Zapisz pomiary'},
    {done:st.schedule,icon:'📅',title:'Dni treningowe',desc:'Preferowane dni tygodnia — apka i auto-kalendarz z nich korzystają',
      action:`openClientScheduleFromOnboard('${id}')`,cta:'Ustaw dni'},
    {done:st.plan,icon:'📋',title:'Przypisz plan treningowy',desc:'Najszybciej: generator AI z danymi klienta',
      action:`openAiPlanForClient('${id}')`,cta:'⚡ Plan AI',
      extra:st.plan?'':`<button class="btn btn-ghost btn-sm" onclick="closeM('m-client-onboard');openClientProfile('${id}');setTimeout(()=>setCPTab('plan'),300)">Szablon</button>`},
    {done:st.calendar,icon:'🗓',title:'Wrzuć plan do kalendarza',desc:'4 tygodnie na preferowane dni — klient widzi trening w Dziś',
      action:`scheduleClientPlanToCalendar('${id}')`,cta:'Do kalendarza',
      extra:st.calendar?'':`<button class="btn btn-ghost btn-sm" onclick="closeM('m-client-onboard');goTo('live');setTimeout(()=>liveClientSetField('${id}','${safeName}'),300)">Trening Live</button>`},
    {done:st.package,icon:'💳',title:'Pakiet / płatność',desc:'Przypisz pakiet sesji albo pomiń, jeśli rozliczacie się inaczej',
      action:`openPackageForClient('${id}')`,cta:'+ Pakiet',
      extra:st.package?'':`<button class="btn btn-ghost btn-sm" onclick="skipClientPackage('${id}')">Pomiń</button>`,
      afterDone:(()=>{
        const pend=typeof clientPendingPackage==='function'?clientPendingPackage(id):null;
        if(!pend)return'';
        return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="requestPayment('${pend.id}');renderClientOnboardChecklist()">💸 Poproś o wpłatę</button><span style="font-size:10px;color:var(--muted);align-self:center;">${escHtml(pend.title||'Pakiet')} · ${(pend.price||0)} zł</span></div>`;
      })()},
  ];
  const flow=window.ONBOARDING_FLOW;
  if(flow&&flow.forumGroupId){
    const g=(window.FORUM_GROUPS||[]).find(x=>x.id===flow.forumGroupId);
    const inForum=typeof isClientInForumGroup==='function'?isClientInForumGroup(id,flow.forumGroupId):false;
    steps.push({
      done:inForum,
      icon:'👥',
      title:'Forum / społeczność',
      desc:g?('Grupa: '+(g.name||'Forum')+(g.privacy==='private'?' (prywatna)':'')):'Dołącz klienta do grupy z Automatyzacji',
      action:`enrollClientInOnboardForum('${id}')`,
      cta:'Dołącz do forum'
    });
  }
  // Invite step: show app-joined hint when already invited
  const inviteStep=steps.find(s=>s.title&&s.title.indexOf('zaproszenie')>=0);
  if(inviteStep&&st.invite&&c.appJoined){
    inviteStep.desc='Klient założył konto w aplikacji ('+(c.appJoinedAt?String(c.appJoinedAt).slice(0,10):'ok')+').';
  }
  // Soft intake / pending forms block (not counted in pipeline total)
  const intake=typeof clientIntakeFormState==='function'?clientIntakeFormState(id):null;
  let formBlock='';
  if(intake){
    if(intake.filled){
      formBlock=`<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid var(--teal);border-radius:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(62,207,178,0.18);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">✓</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;margin-bottom:2px;">Ankieta wstępna</div>
          <div style="font-size:11px;color:var(--muted);">Wypełniona — dane poszły do profilu / AI.</div>
          <div style="font-size:10px;color:var(--teal);font-family:'DM Mono',monospace;margin-top:4px;">GOTOWE</div>
        </div>
      </div>`;
    }else if(intake.pending){
      formBlock=`<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid rgba(157,124,244,0.45);border-radius:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(157,124,244,0.18);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;margin-bottom:2px;">Ankieta czeka na klienta</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${escHtml(intake.pending.formName||'Formularz')} — klient widzi ją w apce.</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="remindFormSend('${escHtml(intake.pending.id)}');renderClientOnboardChecklist()">Przypomnij</button>
            <button class="btn btn-ghost btn-sm" onclick="closeM('m-client-onboard');openClientProfile('${id}');setTimeout(()=>setCPTab('forms'),300)">Profil</button>
          </div>
        </div>
      </div>`;
    }else if(!intake.sent){
      formBlock=`<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:8px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;margin-bottom:2px;">Ankieta wstępna</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Cel, kontuzje, częstotliwość — sync do profilu po wypełnieniu.</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="sendClientIntakeForm('${id}');renderClientOnboardChecklist()">Wyślij ankietę</button>
            <button class="btn btn-ghost btn-sm" onclick="closeM('m-client-onboard');goTo('forms')">Biblioteka</button>
          </div>
        </div>
      </div>`;
    }else if(intake.anyPending&&intake.anyPending.length){
      const p=intake.anyPending[0];
      formBlock=`<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid rgba(157,124,244,0.45);border-radius:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(157,124,244,0.18);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;margin-bottom:2px;">Formularz oczekuje</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${escHtml(p.formName||'Formularz')}${intake.anyPending.length>1?' · +'+(intake.anyPending.length-1):''}</div>
          <button class="btn btn-primary btn-sm" onclick="remindFormSend('${escHtml(p.id)}');renderClientOnboardChecklist()">Przypomnij</button>
        </div>
      </div>`;
    }
  }
  el.innerHTML=formBlock+steps.map(s=>`
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid ${s.done?'var(--teal)':'var(--border)'};border-radius:10px;margin-bottom:8px;">
      <div style="width:32px;height:32px;border-radius:8px;background:${s.done?'rgba(62,207,178,0.18)':'var(--s2)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${s.done?'✓':s.icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${s.title}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:${s.done&&!s.afterDone?'0':'8px'};">${s.desc}</div>
        ${s.done
          ?`<div style="font-size:10px;color:var(--teal);font-family:'DM Mono',monospace;margin-top:4px;">GOTOWE</div>${s.afterDone||''}`
          :`<div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="${s.action}">${s.cta}</button>${s.extra||''}</div>`}
      </div>
    </div>`).join('')+(st.complete?`<button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="closeM('m-client-onboard')">Gotowe — zamknij</button>`:'');
}
window.openClientOnboardChecklist=openClientOnboardChecklist;
window.renderClientOnboardChecklist=renderClientOnboardChecklist;

function enrollClientInOnboardForum(clientId){
  const flow=window.ONBOARDING_FLOW;
  if(!flow||!flow.forumGroupId){
    if(typeof notify==='function')notify('Ustaw grupę forum w Automatyzacja → Onboarding');
    return false;
  }
  const r=typeof enrollClientInForumGroup==='function'
    ?enrollClientInForumGroup(clientId,flow.forumGroupId,{notify:true,forceNotify:true})
    :{ok:false};
  if(!r.ok){
    if(typeof notify==='function')notify('Nie znaleziono grupy forum');
    return false;
  }
  if(typeof renderClientOnboardChecklist==='function')renderClientOnboardChecklist();
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  if(typeof notify==='function')notify(r.added?'✓ Klient dołączony do forum':'Klient już jest w tej grupie');
  return true;
}
window.enrollClientInOnboardForum=enrollClientInOnboardForum;

function openClientScheduleFromOnboard(clientId){
  window._onboardResumeAfterEdit=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  if(typeof openClientModal==='function')openClientModal(clientId);
}
window.openClientScheduleFromOnboard=openClientScheduleFromOnboard;

function latestClientPlan(clientId){
  return(window.PL||[]).filter(p=>p&&p.clientId===clientId).slice().sort((a,b)=>{
    const ak=String(a.updatedAt||a.createdAt||a.id||'');
    const bk=String(b.updatedAt||b.createdAt||b.id||'');
    return bk.localeCompare(ak);
  })[0]||null;
}
function scheduleClientPlanToCalendar(clientId){
  const plan=latestClientPlan(clientId);
  if(!plan){
    if(typeof notify==='function')notify('Najpierw przypisz plan');
    return 0;
  }
  let n=0;
  if(typeof maybeSchedulePlanToCalendar==='function')n=maybeSchedulePlanToCalendar(plan.id,{weeks:4})||0;
  else if(typeof schedulePlanToCalendar==='function')n=schedulePlanToCalendar(plan.id,{weeks:4})||0;
  if(typeof renderClientOnboardChecklist==='function')renderClientOnboardChecklist();
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  if(typeof renderClients==='function')try{renderClients();}catch(e){}
  return n;
}
window.latestClientPlan=latestClientPlan;
window.scheduleClientPlanToCalendar=scheduleClientPlanToCalendar;

function openClientBaselineModal(clientId){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  window._baselineClientId=clientId;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null&&v!==''?v:'';};
  set('bl-weight',c.weight||'');
  set('bl-bf','');
  set('bl-chest','');
  set('bl-waist','');
  set('bl-hips','');
  set('bl-thigh','');
  set('bl-arm','');
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  set('bl-date',today);
  const title=document.getElementById('m-baseline-title');
  if(title)title.textContent='POMIARY STARTOWE — '+(c.name||'').toUpperCase();
  openM('m-baseline');
}
async function saveClientBaselineModal(){
  const id=window._baselineClientId;if(!id)return;
  const g=id=>document.getElementById(id)?.value||'';
  const created=typeof saveClientBaselineFromFields==='function'?saveClientBaselineFromFields(id,{
    date:g('bl-date'),
    weight:g('bl-weight'),
    bf:g('bl-bf'),
    chest:g('bl-chest'),
    waist:g('bl-waist'),
    hips:g('bl-hips'),
    thigh:g('bl-thigh'),
    arm:g('bl-arm'),
    notes:'Pomiar startowy (baseline)'
  }):[];
  if(!created.length){notify('Wpisz przynajmniej wagę lub obwód');return;}
  closeM('m-baseline');
  notify('✓ Baseline zapisany ('+created.length+' wpisów)');
  renderClientOnboardChecklist();
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  if(typeof maybeResumeOnboard==='function')maybeResumeOnboard(id);
}
window.openClientBaselineModal=openClientBaselineModal;
window.saveClientBaselineModal=saveClientBaselineModal;

// ════════════════════════════════════════
// BUILDER
// ════════════════════════════════════════
const BUILDER_METHOD_DAYS={
  PPL:['Push','Pull','Legs'],
  FBW:['FBW'],
  'Upper Lower':['Upper','Lower'],
  Obwodowy:['Obwód A','Obwód B','Obwód C'],
  Arnold:['Arnold A','Arnold B','Arnold C'],
  'Bro Split':['Bro 1','Bro 2','Bro 3','Bro 4','Bro 5'],
  'Własna':null
};
function builderGetMethod(){
  const sel=document.getElementById('b-method');
  return sel?sel.value:'PPL';
}
function builderDayFocusLabel(method,workoutDayIndex){
  const labels=BUILDER_METHOD_DAYS[method];
  if(!labels||!labels.length)return '';
  return labels[((workoutDayIndex%labels.length)+labels.length)%labels.length];
}
function builderFillDayFocus(dayEl,workoutDayIndex){
  if(!dayEl)return;
  const inp=dayEl.querySelector('.builder-day-focus');
  if(!inp)return;
  const method=builderGetMethod();
  if(method==='Własna'){
    inp.placeholder='np. Push, FBW, własna nazwa';
    return;
  }
  inp.placeholder='Push, Pull, FBW…';
  if(dayEl.querySelector('.rc')?.checked){inp.value='';return;}
  inp.value=builderDayFocusLabel(method,workoutDayIndex);
}
function builderRefreshAllDayFocus(){
  let wi=0;
  document.querySelectorAll('.builder-day').forEach(de=>{
    if(de.querySelector('.rc')?.checked){
      const inp=de.querySelector('.builder-day-focus');
      if(inp)inp.value='';
      return;
    }
    builderFillDayFocus(de,wi);
    wi++;
  });
}
function builderOnMethodChange(){
  builderRefreshAllDayFocus();
  builderRefreshRationale();
}
window.builderOnMethodChange=builderOnMethodChange;
function builderEduCtx(){
  const cid=(document.getElementById('b-client')||{}).value||'';
  const c=(window.CL||[]).find(x=>x.id===cid)||{};
  let weight=c.weight||null;
  if(cid&&typeof clientLatestMetricWeight==='function'){
    const mw=clientLatestMetricWeight(cid);
    if(mw!=null)weight=mw;
  }
  return{
    method:(document.getElementById('b-method')||{}).value||'PPL',
    goal:c.goal||'masa',
    level:c.level||'sredni',
    weight:weight
  };
}
function builderRefreshMethodHint(){
  const hint=document.getElementById('b-method-hint');
  const btn=document.getElementById('b-method-tip-btn');
  const ctx=builderEduCtx();
  const text=typeof eduTipText==='function'?eduTipText('method',ctx):'';
  if(hint)hint.textContent=text;
  if(btn){
    btn.setAttribute('data-tip',text);
    btn.setAttribute('title',text);
    btn.setAttribute('data-edu','method');
  }
}
function builderRefreshRationale(){
  const el=document.getElementById('builder-rationale');
  const ctx=builderEduCtx();
  const days=document.querySelectorAll('#builder-days .builder-day').length;
  builderRefreshMethodHint();
  if(!el||typeof refreshMethodRationaleInto!=='function')return;
  refreshMethodRationaleInto(el,{
    method:ctx.method,
    goal:ctx.goal,
    level:ctx.level,
    daysPerWeek:days||undefined,
    weight:ctx.weight
  });
}
window.builderRefreshRationale=builderRefreshRationale;
window.builderEduCtx=builderEduCtx;

function toggleBuilderSidebar(forceOpen){
  const layout=document.querySelector('#screen-builder .builder-layout');
  const expand=document.getElementById('builder-sidebar-expand');
  if(!layout)return;
  let open;
  if(forceOpen===true)open=true;
  else if(forceOpen===false)open=false;
  else open=layout.classList.contains('builder-sidebar-collapsed');
  layout.classList.toggle('builder-sidebar-collapsed',!open);
  if(expand){
    if(open)expand.setAttribute('hidden','');
    else expand.removeAttribute('hidden');
  }
  try{localStorage.setItem('pl_builder_sidebar',open?'1':'0');}catch(e){}
}
function restoreBuilderSidebarState(){
  let open=true;
  try{open=localStorage.getItem('pl_builder_sidebar')!=='0';}catch(e){}
  toggleBuilderSidebar(open);
}
window.toggleBuilderSidebar=toggleBuilderSidebar;
window.restoreBuilderSidebarState=restoreBuilderSidebarState;
function initBuilder(){
  window._editingPlanId=null;
  window._builderPeriodWeek=0;
  if(!window._builderBack)window._builderBack='clients';
  const titleEl=document.querySelector('#screen-builder .topbar-title');
  if(titleEl)titleEl.textContent='Nowy plan treningowy';
  dayCount=0;
  document.getElementById('builder-days').innerHTML='';
  document.getElementById('b-name').value='';
  // wypełnij select klientów
  const sel=document.getElementById('b-client');
  if(sel){
    sel.innerHTML='<option value="">-- Wybierz klienta --</option>'+CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
  }
  updatePeriod();
  builderRefreshRationale();
  if(typeof restoreBuilderSidebarState==='function')restoreBuilderSidebarState();
  if(typeof hydrateEduTips==='function')hydrateEduTips(document.getElementById('screen-builder'));
}
function addDay(){
  dayCount++;const id='bd-'+dayCount;
  const days=['PON','WT','ŚR','CZ','PT','SO','ND'];
  const sel=days.map((d,i)=>`<option value="${d}"${i===dayCount-1?' selected':''}>${d}</option>`).join('');
  const div=document.createElement('div');div.id=id;div.className='builder-day';
  const tip=k=>typeof eduTipMark==='function'?eduTipMark(k,builderEduCtx()):'';
  div.innerHTML=`<div class="builder-day-hdr">
    <select class="builder-day-select">${sel}</select>
    <input type="text" class="builder-day-focus" placeholder="Push, Pull, FBW…" title="${typeof eduTipText==='function'?eduTipText('focus').replace(/"/g,'&quot;'):''}">
    <label class="builder-rest-toggle"><input type="checkbox" class="rc" style="accent-color:var(--accent);" onchange="toggleR('${id}')"> Dzień odpoczynku</label>
    <button type="button" class="builder-remove-day" onclick="document.getElementById('${id}').remove();builderRefreshAllDayFocus();builderRefreshRationale()">×</button>
  </div>
  <div class="rest-s builder-rest-state" style="display:none;">— Dzień odpoczynku / regeneracja aktywna</div>
  <div class="work-s">
    <div class="ex-tbl-hdr"><span>ĆWICZENIE</span><span>SER${tip('sets')}</span><span>POWT${tip('reps')}</span><span>KG${tip('kg')}</span><span>RPE${tip('rpe')}</span><span>RIR${tip('rir')}</span><span>PRZERWA${tip('rest')}</span><span>TEMPO${tip('tempo')}</span><span></span></div>
    <div class="ex-rows"></div>
    <button class="add-ex-btn" onclick="addRow('${id}')">+ DODAJ ĆWICZENIE</button>
  </div>`;
  document.getElementById('builder-days').appendChild(div);
  builderRefreshAllDayFocus();
  builderRefreshRationale();
}
function toggleR(id){const el=document.getElementById(id);const r=el.querySelector('.rc').checked;el.querySelector('.rest-s').style.display=r?'block':'none';el.querySelector('.work-s').style.display=r?'none':'block';builderRefreshAllDayFocus();builderRefreshRationale();}
function addRow(dayId){
  const rows=document.querySelector('#'+dayId+' .ex-rows');
  const div=document.createElement('div');div.className='ex-row';
  const ctx=typeof builderEduCtx==='function'?builderEduCtx():{};
  const t=k=>typeof eduTipText==='function'?String(eduTipText(k,ctx)).replace(/"/g,'&quot;'):'';
  div.innerHTML='<input type="text" placeholder="Nazwa ćwiczenia..." class="ex-inp ex-inp-name ex-ac-input" style="width:100%;" autocomplete="off" data-f="name" oninput="builderOnExNameChange(this.closest(\'.ex-row\'))">'
    +'<input type="number" placeholder="4" class="ex-inp" data-f="sets" title="'+t('sets')+'" oninput="builderOnPeriodFieldEdit(this)">'
    +'<input type="text" placeholder="8-10" class="ex-inp" data-f="reps" title="'+t('reps')+'" oninput="builderOnPeriodFieldEdit(this)">'
    +'<input type="number" placeholder="kg" class="ex-inp" data-f="kg" title="'+t('kg')+'" oninput="builderOnPeriodFieldEdit(this)">'
    +'<input type="text" placeholder="8" class="ex-inp" data-f="rpe" inputmode="decimal" title="'+t('rpe')+'" oninput="builderOnPeriodFieldEdit(this)">'
    +'<input type="text" placeholder="2" class="ex-inp" data-f="rir" inputmode="decimal" title="'+t('rir')+'" oninput="builderOnPeriodFieldEdit(this)">'
    +'<input type="text" placeholder="2min" class="ex-inp" data-f="rest" title="'+t('rest')+'" oninput="builderRefreshPeriodPreview()">'
    +'<input type="text" placeholder="2-0-2" class="ex-inp" data-f="tempo" title="'+t('tempo')+'">'
    +'<div class="builder-row-tools">'
    +'<div class="builder-row-actions">'
    +'<button type="button" class="builder-move-row" onclick="builderMoveRow(this,-1)" title="Przenieś wyżej">▲</button>'
    +'<button type="button" class="builder-move-row" onclick="builderMoveRow(this,1)" title="Przenieś niżej">▼</button>'
    +'</div>'
    +'<button type="button" class="builder-remove-row" onclick="builderRemoveRow(this)">×</button>'
    +'</div>'
    +'<div class="ex-row-extra">'
    +'<div class="builder-alt-box">'
    +'<div class="builder-alt-label">Zamienniki — kliknij, żeby podmienić w planie</div>'
    +'<div class="builder-alt-chips"></div>'
    +'<input type="text" placeholder="Własny zamiennik (opcjonalnie)" class="ex-inp ex-inp-name builder-sub-input" data-f="alt" oninput="builderRefreshAltChips(this.closest(\'.ex-row\'))">'
    +'</div>'
    +'<input type="number" placeholder="%1RM" class="ex-inp" data-f="pct1rm" min="1" max="150" step="0.5" title="Procent 1RM — kg z Pomiary → Siła bazowa" oninput="builderPreviewKg(this.closest(\'.ex-row\'));builderOnPeriodFieldEdit(this)">'
    +'<div class="ex-row-coach">'
    +'<input type="text" placeholder="Wskazówka dla klienta (np. łopatki ściągnięte)" class="ex-inp ex-inp-name builder-sub-input" data-f="note">'
    +'<input type="url" placeholder="Film: YouTube / Vimeo / .mp4 (lub auto z biblioteki)" class="ex-inp ex-inp-name builder-sub-input" data-f="video" title="Link do filmu techniki" oninput="builderRefreshTechMedia(this.closest(\'.ex-row\'))">'
    +'</div>'
    +'<div class="builder-tech-media"></div>'
    +'<div class="ex-kind-btns">'
    +'<input type="hidden" data-f="ss" value="">'
    +'<input type="hidden" data-f="wu" value="">'
    +'<input type="hidden" data-f="drop" value="">'
    +'<input type="hidden" data-f="amrap" value="">'
    +'<input type="hidden" data-f="emom" value="">'
    +'<button type="button" class="ex-ss-btn" onclick="builderToggleSs(this)" title="Połącz z następnym ćwiczeniem w super-serię">⚡ SS</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn wu" onclick="builderCycleKind(this,\'wu\',2)" title="Serie rozgrzewkowe (1–2) — lżejsze kg, krótsza przerwa">WU</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn drop" onclick="builderCycleKind(this,\'drop\',2)" title="Drop sety po roboczych — bez przerwy, mniejszy ciężar">DROP</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn amrap" onclick="builderToggleAmrap(this)" title="Ostatnia seria robocza = AMRAP (max powtórzeń)">AMRAP</button>'
    +'<button type="button" class="ex-ss-btn ex-emom-btn" onclick="builderToggleEmom(this)" title="EMOM: każda seria na starcie minuty, reszta minuty to przerwa">EMOM</button>'
    +'</div>'
    +'<div class="builder-period-preview" style="grid-column:1/-1;display:none;"></div>'
    +'</div>';
  rows.appendChild(div);
  const nameInp=div.querySelector('[data-f="name"]');
  if(nameInp&&typeof exAcInitInput==='function')exAcInitInput(nameInp);
  builderRefreshAltChips(div);
  builderRefreshTechMedia(div);
  builderRefreshPeriodPreview();
}
function builderAltListForRow(row){
  if(!row)return[];
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const raw=(row.querySelector('[data-f="alt"]')||{}).value||'';
  const fromField=String(raw).split(/[,;/]/).map(s=>s.trim()).filter(Boolean);
  const fromLib=typeof altsForExercise==='function'?altsForExercise(name):[];
  const cur=String(name).trim().toLowerCase();
  const seen=new Set();
  const out=[];
  fromField.concat(fromLib).forEach(a=>{
    const k=String(a).trim();
    if(!k)return;
    const lk=k.toLowerCase();
    if(lk===cur||seen.has(lk))return;
    seen.add(lk);out.push(k);
  });
  return out;
}
function builderRefreshAltChips(row){
  if(!row)return;
  const box=row.querySelector('.builder-alt-chips');if(!box)return;
  const alts=builderAltListForRow(row);
  if(!alts.length){
    box.innerHTML='<span class="builder-alt-empty">Brak zamienników w bibliotece — wpisz własny poniżej albo wybierz ćwiczenie z listy.</span>';
    return;
  }
  box.innerHTML=alts.map(a=>{
    const safe=typeof escHtml==='function'?escHtml(a):a;
    const attr=String(a).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return `<button type="button" class="builder-alt-chip" data-alt="${attr}" onclick="builderApplyAlt(this)" title="Podmień to ćwiczenie w planie">↻ ${safe}</button>`;
  }).join('');
}
window.builderRefreshAltChips=builderRefreshAltChips;
function builderApplyAlt(btn){
  const row=btn&&btn.closest('.ex-row');if(!row)return false;
  const next=String(btn.dataset.alt||btn.getAttribute('data-alt')||'').trim();
  if(!next)return false;
  const nameInp=row.querySelector('[data-f="name"]');
  const altInp=row.querySelector('[data-f="alt"]');
  const prev=nameInp?(nameInp.value||'').trim():'';
  const before=altInp?(altInp.value||''):'';
  if(nameInp)nameInp.value=next;
  if(altInp){
    const keep=String(before).split(/[,;/]/).map(s=>s.trim()).filter(Boolean)
      .filter(a=>a.toLowerCase()!==next.toLowerCase());
    if(prev&&prev.toLowerCase()!==next.toLowerCase()&&!keep.some(a=>a.toLowerCase()===prev.toLowerCase()))keep.unshift(prev);
    altInp.value=keep.join(', ');
  }
  if(typeof notify==='function')notify('✓ Podmieniono na: '+next);
  builderOnExNameChange(row);
  return true;
}
window.builderApplyAlt=builderApplyAlt;
function builderRefreshTechMedia(row){
  if(!row)return;
  const box=row.querySelector('.builder-tech-media');if(!box)return;
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const videoInp=row.querySelector('[data-f="video"]');
  const videoVal=videoInp?(videoInp.value||'').trim():'';
  const media=typeof resolveCoachMedia==='function'?resolveCoachMedia({name,video:videoVal}):{gif:'',video:videoVal,isFile:false,img:''};
  if(videoInp&&!videoVal&&media.video){
    videoInp.value=media.video;
  }
  const gif=media.gif||'';
  const video=media.video||videoInp?.value||'';
  const file=!!media.isFile||(typeof coachVideoIsFile==='function'&&coachVideoIsFile(video));
  let html='';
  if(gif&&typeof exTechniqueMediaHtml==='function'){
    html=exTechniqueMediaHtml({gif,name},{});
  }else if(video&&file){
    html=`<div class="cw-video-wrap" style="padding-top:0;height:200px;"><video src="${typeof escHtml==='function'?escHtml(video):video}" controls playsinline muted loop style="position:static;width:100%;height:100%;object-fit:contain;"></video></div>`;
  }else if(video&&media.videoEmbed){
    html=`<div class="cw-video-wrap"><iframe src="${typeof escHtml==='function'?escHtml(media.videoEmbed):media.videoEmbed}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen title="Film techniki"></iframe></div>`;
  }else if(media.img){
    html=`<img src="${typeof escHtml==='function'?escHtml(media.img):media.img}" alt="${typeof escHtml==='function'?escHtml(name):name}" loading="lazy">`;
  }else if(name.trim()){
    html=`<div class="builder-tech-empty">Brak filmu techniki dla „${typeof escHtml==='function'?escHtml(name):name}”. Wrzuć <code>.mp4</code> do <code>assets/ex/gifs/</code> (slug nazwy) albo wklej link powyżej.</div>`;
  }
  box.innerHTML=html;
}
window.builderRefreshTechMedia=builderRefreshTechMedia;
function builderOnExNameChange(row){
  if(!row)return;
  if(typeof builderPreviewKg==='function')builderPreviewKg(row);
  if(typeof builderRefreshPeriodPreview==='function')builderRefreshPeriodPreview();
  // Uzupełnij alt z biblioteki, gdy pole puste
  const altInp=row.querySelector('[data-f="alt"]');
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  if(altInp&&!(altInp.value||'').trim()&&typeof altsForExercise==='function'){
    const alts=altsForExercise(name);
    if(alts.length)altInp.value=alts.join(', ');
  }
  builderRefreshAltChips(row);
  builderRefreshTechMedia(row);
}
window.builderOnExNameChange=builderOnExNameChange;
function builderRefreshRowExtras(row){
  builderRefreshAltChips(row);
  builderRefreshTechMedia(row);
}
window.builderRefreshRowExtras=builderRefreshRowExtras;
function builderRemoveRow(btn){
  const row=btn.closest('.ex-row');
  const box=row&&row.parentElement;
  if(row)row.remove();
  if(box)builderPaintSs(box);
}
window.builderRemoveRow=builderRemoveRow;
function builderMoveRow(btn,dir){
  const row=btn&&btn.closest('.ex-row');if(!row)return;
  const box=row.parentElement;if(!box)return;
  if(dir<0){
    const prev=row.previousElementSibling;
    if(prev)box.insertBefore(row,prev);
  }else{
    const next=row.nextElementSibling;
    if(next)box.insertBefore(next,row);
  }
  builderPaintSs(box);
  if(typeof builderRefreshPeriodPreview==='function')builderRefreshPeriodPreview();
}
window.builderMoveRow=builderMoveRow;
function builderPaintSs(box){
  if(!box)return;
  const rows=[...box.querySelectorAll('.ex-row')];
  const vals=rows.map(r=>(r.querySelector('[data-f="ss"]')||{}).value||'');
  rows.forEach((r,i)=>{
    r.classList.remove('ss','ss-first','ss-last');
    const btn=r.querySelector('.ex-ss-btn');
    const v=vals[i];
    const run=!!v&&((i>0&&vals[i-1]===v)||(i<vals.length-1&&vals[i+1]===v));
    if(!run){
      const el=r.querySelector('[data-f="ss"]');if(el&&v)el.value='';
      if(btn)btn.textContent='⚡ SS';
      return;
    }
    r.classList.add('ss');
    if(i===0||vals[i-1]!==v)r.classList.add('ss-first');
    if(i===rows.length-1||vals[i+1]!==v)r.classList.add('ss-last');
    let start=i;while(start>0&&vals[start-1]===v)start--;
    if(btn)btn.textContent='⚡ '+v+(i-start+1);
  });
}
window.builderPaintSs=builderPaintSs;
function builderToggleSs(btn){
  const row=btn.closest('.ex-row');if(!row)return;
  const box=row.parentElement;
  const rows=[...box.querySelectorAll('.ex-row')];
  const i=rows.indexOf(row);
  const get=r=>(r.querySelector('[data-f="ss"]')||{}).value||'';
  const set=(r,v)=>{const el=r.querySelector('[data-f="ss"]');if(el)el.value=v||'';};
  const cur=get(row);
  const next=rows[i+1];
  const prev=rows[i-1];
  if(cur&&((next&&get(next)===cur)||(prev&&get(prev)===cur))){
    set(row,'');
    builderPaintSs(box);
    return;
  }
  if(!next){if(typeof notify==='function')notify('Dodaj następne ćwiczenie, potem ⚡ Super-seria');return;}
  let letter=get(next)||cur;
  if(!letter){
    const used=new Set(rows.map(get).filter(Boolean));
    letter='A';
    while(used.has(letter))letter=String.fromCharCode(letter.charCodeAt(0)+1);
  }
  set(row,letter);set(next,letter);
  [row,next].forEach(r=>{
    ['wu','drop'].forEach(f=>{const el=r.querySelector('[data-f="'+f+'"]');if(el)el.value='';});
    const em=r.querySelector('[data-f="emom"]');if(em)em.value='';
    if(typeof builderPaintKinds==='function')builderPaintKinds(r);
    if(typeof builderPaintEmom==='function')builderPaintEmom(r);
  });
  builderPaintSs(box);
}
window.builderToggleSs=builderToggleSs;
function builderCycleKind(btn,field,max){
  const row=btn&&btn.closest('.ex-row');if(!row)return;
  if((row.querySelector('[data-f="ss"]')||{}).value)return;
  const el=row.querySelector('[data-f="'+field+'"]');if(!el)return;
  let n=parseInt(el.value,10)||0;
  n=(n+1)%((max||2)+1);
  el.value=n?String(n):'';
  builderPaintKinds(row);
}
window.builderCycleKind=builderCycleKind;
function builderToggleAmrap(btn){
  const row=btn&&btn.closest('.ex-row');if(!row)return;
  const el=row.querySelector('[data-f="amrap"]');if(!el)return;
  el.value=el.value==='1'?'':'1';
  builderPaintKinds(row);
}
window.builderToggleAmrap=builderToggleAmrap;
function builderPaintKinds(row){
  if(!row)return;
  const g=f=>((row.querySelector('[data-f="'+f+'"]')||{}).value||'');
  const inSs=!!g('ss');
  const wu=inSs?0:(parseInt(g('wu'),10)||0);
  const dr=inSs?0:(parseInt(g('drop'),10)||0);
  const am=g('amrap')==='1';
  const wuBtn=row.querySelector('.ex-kind-btn.wu');
  const drBtn=row.querySelector('.ex-kind-btn.drop');
  const amBtn=row.querySelector('.ex-kind-btn.amrap');
  if(wuBtn){wuBtn.textContent=wu?('WU '+wu):'WU';wuBtn.classList.toggle('on',!!wu);wuBtn.disabled=inSs;wuBtn.title=inSs?'WU/DROP nie w super-serii':'Serie rozgrzewkowe (1–2) — lżejsze kg, krótsza przerwa';}
  if(drBtn){drBtn.textContent=dr?('DROP '+dr):'DROP';drBtn.classList.toggle('on',!!dr);drBtn.disabled=inSs;drBtn.title=inSs?'WU/DROP nie w super-serii':'Drop sety po roboczych — bez przerwy, mniejszy ciężar';}
  if(amBtn)amBtn.classList.toggle('on',am);
}
window.builderPaintKinds=builderPaintKinds;
function builderToggleEmom(btn){
  const row=btn&&btn.closest('.ex-row');if(!row)return;
  const el=row.querySelector('[data-f="emom"]');if(!el)return;
  el.value=el.value==='1'?'':'1';
  if(el.value==='1'){
    const ss=row.querySelector('[data-f="ss"]');
    if(ss&&ss.value){
      ss.value='';
      const box=row.parentElement;
      if(typeof builderPaintSs==='function')builderPaintSs(box);
    }
  }
  builderPaintEmom(row);
  if(typeof builderPaintKinds==='function')builderPaintKinds(row);
}
window.builderToggleEmom=builderToggleEmom;
function builderPaintEmom(row){
  if(!row)return;
  const on=((row.querySelector('[data-f="emom"]')||{}).value||'')==='1';
  const btn=row.querySelector('.ex-emom-btn');
  if(btn)btn.classList.toggle('on',on);
}
window.builderPaintEmom=builderPaintEmom;
function builderPreviewKg(row){
  if(!row)return;
  const kgEl=row.querySelector('[data-f="kg"]');
  if(!kgEl)return;
  const cid=(document.getElementById('b-client')||{}).value||'';
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const pct=typeof parsePct1RM==='function'?parsePct1RM((row.querySelector('[data-f="pct1rm"]')||{}).value||''):'';
  if(!pct||!cid||typeof weightFromPct1RM!=='function'){
    if(!kgEl.value)kgEl.placeholder='kg';
    return;
  }
  const w=weightFromPct1RM(cid,name,pct);
  kgEl.placeholder=w.kg?String(w.kg):'kg';
  kgEl.title=w.hint||'kg z %1RM';
}
window.builderPreviewKg=builderPreviewKg;
function builderRirFromRpe(rpeStr){
  const s=String(rpeStr||'').replace(/RPE\s*/ig,'').trim();
  if(!s)return '';
  const range=s.match(/(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/);
  if(range){
    const a=10-parseFloat(String(range[1]).replace(',','.'));
    const b=10-parseFloat(String(range[2]).replace(',','.'));
    if(isNaN(a)||isNaN(b))return '';
    const lo=Math.round(Math.min(a,b)*2)/2;
    const hi=Math.round(Math.max(a,b)*2)/2;
    return lo===hi?String(lo):(lo+'-'+hi);
  }
  const n=parseFloat(String(s).replace(',','.'));
  if(isNaN(n))return '';
  return String(Math.max(0,Math.round((10-n)*2)/2));
}
window.builderRirFromRpe=builderRirFromRpe;
function builderNormalizeRpe(rpeStr){
  return String(rpeStr||'').replace(/RPE\s*/ig,'').trim();
}
function builderCapturePeriodBase(row){
  if(!row||row.dataset.periodBase)return;
  const fields=['sets','reps','kg','rpe','rir','pct1rm'];
  const o={};
  fields.forEach(f=>{
    const el=row.querySelector('[data-f="'+f+'"]');
    o[f]=el?String(el.value||''):'';
  });
  row.dataset.periodBase=JSON.stringify(o);
}
function builderRestorePeriodBase(row){
  if(!row||!row.dataset.periodBase)return;
  try{
    const o=JSON.parse(row.dataset.periodBase);
    Object.keys(o).forEach(f=>{
      const el=row.querySelector('[data-f="'+f+'"]');
      if(el)el.value=o[f];
    });
  }catch(e){}
  delete row.dataset.periodBase;
}
function builderOnPeriodFieldEdit(el){
  const row=el&&el.closest('.ex-row');
  if(row&&!(window._builderPeriodWeek>0))delete row.dataset.periodBase;
  if(el&&el.getAttribute('data-f')==='rpe'&&row&&!(window._builderPeriodWeek>0)){
    const rirEl=row.querySelector('[data-f="rir"]');
    if(rirEl&&!String(rirEl.value||'').trim()){
      const auto=builderRirFromRpe(el.value);
      if(auto)rirEl.placeholder=auto;
    }
  }
  builderRefreshPeriodPreview();
}
window.builderOnPeriodFieldEdit=builderOnPeriodFieldEdit;
function builderShiftRepRange(val,delta){
  const s=String(val||'').trim();
  if(!s)return '';
  const m=s.match(/^(\d+)\s*-\s*(\d+)$/);
  if(m)return `${Math.max(1,parseInt(m[1],10)+delta)}-${Math.max(1,parseInt(m[2],10)+delta)}`;
  const one=s.match(/^(\d+)$/);
  if(one)return String(Math.max(1,parseInt(one[1],10)+delta));
  return s;
}
function builderWeekModel(level,idx){
  const ls=String(level||'sredni');
  const beginner=[
    {loadPct:0,repDelta:0,setDelta:0,rpe:'7'},
    {loadPct:2.5,repDelta:0,setDelta:0,rpe:'7'},
    {loadPct:5,repDelta:-1,setDelta:0,rpe:'8'},
    {loadPct:-12,repDelta:-2,setDelta:-1,rpe:'6',deload:true},
  ];
  const intermediate=[
    {loadPct:-2.5,repDelta:2,setDelta:1,rpe:'7'},
    {loadPct:0,repDelta:0,setDelta:0,rpe:'8'},
    {loadPct:5,repDelta:-2,setDelta:0,rpe:'9'},
    {loadPct:-15,repDelta:-2,setDelta:-1,rpe:'6',deload:true},
  ];
  const advanced=[
    {loadPct:-2.5,repDelta:1,setDelta:1,rpe:'7-8'},
    {loadPct:2.5,repDelta:0,setDelta:0,rpe:'8'},
    {loadPct:5,repDelta:-1,setDelta:0,rpe:'8-9'},
    {loadPct:7.5,repDelta:-2,setDelta:0,rpe:'9'},
    {loadPct:10,repDelta:-3,setDelta:-1,rpe:'9-10'},
    {loadPct:-15,repDelta:-2,setDelta:-1,rpe:'6',deload:true},
  ];
  const arr=ls==='poczatkujacy'?beginner:ls==='sredni'?intermediate:advanced;
  return arr[Math.max(0,Math.min(idx,arr.length-1))]||arr[0];
}
function builderWeekPreviewData(row,mod,idx){
  const base=row&&row.dataset.periodBase?(()=>{try{return JSON.parse(row.dataset.periodBase);}catch(e){return null;}})():null;
  const g=(f)=>{
    if(base&&base[f]!=null&&base[f]!=='')return base[f];
    return (row.querySelector('[data-f="'+f+'"]')||{}).value||'';
  };
  const reps=g('reps')||'10';
  const setsBase=parseInt(g('sets')||'3',10)||3;
  const kgRaw=g('kg');
  const kgBase=kgRaw?parseFloat(kgRaw)||0:builderBaseKg(row);
  const nextSets=Math.max(1,setsBase+(mod.setDelta||0));
  const nextReps=builderShiftRepRange(reps,mod.repDelta||0);
  const nextKg=kgBase?Math.max(0,Math.round((kgBase*((100+(mod.loadPct||0))/100))*2)/2):0;
  const rpe=builderNormalizeRpe(mod.rpe||g('rpe')||'');
  const rir=builderRirFromRpe(rpe)||g('rir')||'';
  return {idx,sets:nextSets,reps:nextReps,kg:nextKg,rpe,rir,deload:!!mod.deload};
}
function builderBaseKg(row){
  const base=row&&row.dataset.periodBase?(()=>{try{return JSON.parse(row.dataset.periodBase);}catch(e){return null;}})():null;
  const kgVal=(base&&base.kg!=null&&base.kg!=='')?base.kg:((row.querySelector('[data-f="kg"]')||{}).value||'');
  if(kgVal)return parseFloat(kgVal)||0;
  const cid=(document.getElementById('b-client')||{}).value||'';
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const pctRaw=(base&&base.pct1rm!=null&&base.pct1rm!=='')?base.pct1rm:((row.querySelector('[data-f="pct1rm"]')||{}).value||'');
  const pct=typeof parsePct1RM==='function'?parsePct1RM(pctRaw):'';
  if(!pct||!cid||typeof weightFromPct1RM!=='function')return 0;
  const w=weightFromPct1RM(cid,name,pct);
  return parseFloat(w.kg)||0;
}
function builderRefreshPeriodPreview(){
  const idx=window._builderPeriodWeek||0;
  const cid=(document.getElementById('b-client')||{}).value||'';
  const c=CL.find(x=>x.id===cid)||{};
  const mod=builderWeekModel(c.level||'sredni',idx);
  document.querySelectorAll('#builder-days .ex-row').forEach(row=>{
    const box=row.querySelector('.builder-period-preview');
    if(idx>0){
      builderCapturePeriodBase(row);
      const pv=builderWeekPreviewData(row,mod,idx);
      const set=(f,v)=>{const el=row.querySelector('[data-f="'+f+'"]');if(el)el.value=v==null||v===''?'':String(v);};
      set('sets',pv.sets);
      set('reps',pv.reps);
      if(pv.kg)set('kg',pv.kg);
      set('rpe',pv.rpe);
      set('rir',pv.rir);
      if(box){
        box.style.display='block';
        const bits=[
          `TYDZ ${idx+1}`,
          pv.sets+' serie',
          pv.reps+' powt.',
          (pv.kg?pv.kg+' kg':'kg bez zmiany'),
          'RPE '+pv.rpe,
          (pv.rir?'RIR '+pv.rir:''),
          pv.deload?'deload / mniej objętości':'progresja aktywna'
        ].filter(Boolean);
        box.innerHTML=`<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.18);font-size:10px;color:var(--muted);line-height:1.5;font-family:var(--font-ui);">📈 Podgląd tygodnia — ${bits.join(' · ')}. Kliknij „Użyj wartości…”, aby zapisać w formularzu.</div>`;
      }
    }else{
      builderRestorePeriodBase(row);
      if(box){box.style.display='none';box.innerHTML='';}
    }
    ['sets','reps','kg','rpe','rir'].forEach(f=>{
      const input=row.querySelector('[data-f="'+f+'"]');
      if(input)input.classList.toggle('period-preview-on',idx>0);
    });
  });
}
window.builderRefreshPeriodPreview=builderRefreshPeriodPreview;
function updateExDl(){
  const dl=document.getElementById('ex-dl');
  const all=allExercises().map(e=>e.name);
  dl.innerHTML=[...new Set(all)].map(n=>'<option value="'+n+'">').join('');
}
function updatePeriod(){
  const cid=document.getElementById('b-client').value;const c=CL.find(x=>x.id===cid);
  const el=document.getElementById('period-sched');
  if(!c){el.innerHTML='<div style="font-size:11px;color:var(--muted);">Wybierz klienta</div>';return;}
  const sch=getPeriod(c.level||'sredni');
  const rms=typeof officialLift1RMs==='function'?officialLift1RMs(c.id):{};
  const fmt=(v)=>v!=null?v+' kg':'—';
  const rmBar=`<div style="font-size:11px;color:var(--text);margin-bottom:10px;line-height:1.55;padding:8px 10px;background:var(--s3);border:1px solid var(--border);border-radius:8px;">
    <div style="font-size:9px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">1RM — Siła bazowa</div>
    Przysiad ${fmt(rms.squat)} · Martwy ${fmt(rms.deadlift)} · Bench ${fmt(rms.bench)} · OHP ${fmt(rms.ohp)}
    <div style="font-size:10px;color:var(--muted);margin-top:4px;">Pole %1RM w ćwiczeniu liczy kg z tych pomiarów. Brak? Uzupełnij w Pomiary → Siła bazowa.</div>
  </div>`;
  const sportLbl=typeof clientSportProfileLabel==='function'?clientSportProfileLabel(c):'';
  const sportBar=sportLbl?`<div style="font-size:11px;color:var(--text);margin-bottom:10px;line-height:1.55;padding:8px 10px;background:rgba(61,207,178,0.08);border:1px solid rgba(61,207,178,0.25);border-radius:8px;">
    <div style="font-size:9px;font-family:'DM Mono',monospace;color:var(--teal);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">Tło sportowe (planowanie)</div>
    ${sportLbl}
  </div>`:'';
  const activeIdx=window._builderPeriodWeek||0;
  el.innerHTML=sportBar+rmBar+`<div class="ui-section-sub" style="margin-bottom:12px;">Kliknij tydzień, aby podejrzeć serie, powtórzenia, kg, <b>RPE</b> i <b>RIR</b> w wierszach ćwiczeń.</div>`+sch.map((w,i)=>`<button type="button" class="period-row${activeIdx===i?' active':''}" onclick="builderSelectPeriodWeek(${i})"><div class="period-row-week" style="color:${w.cel.includes('DELOAD')?'var(--orange)':w.nr===1?'var(--accent)':'var(--blue)'};">Tydz. ${w.nr}</div><div style="min-width:0;flex:1;"><div class="period-row-title">${w.cel}</div><div class="period-row-sub">${w.rpe}</div></div></button>`).join('')+(activeIdx>0?`<button type="button" class="btn btn-primary btn-sm" style="width:100%;margin-top:12px;" onclick="builderApplyPeriodWeek()">Użyj wartości z tygodnia ${activeIdx+1} w formularzu</button>`:'');
  document.querySelectorAll('#builder-days .ex-row').forEach(r=>{if(typeof builderPreviewKg==='function')builderPreviewKg(r);});
  builderRefreshPeriodPreview();
  builderRefreshRationale();
}
function builderSelectPeriodWeek(idx){
  window._builderPeriodWeek=idx||0;
  updatePeriod();
}
window.builderSelectPeriodWeek=builderSelectPeriodWeek;
function builderApplyPeriodWeek(){
  const idx=window._builderPeriodWeek||0;
  if(idx<=0){notify('TYG 1 to wartości bazowe');return;}
  const cid=(document.getElementById('b-client')||{}).value||'';
  const c=CL.find(x=>x.id===cid)||{};
  const mod=builderWeekModel(c.level||'sredni',idx);
  document.querySelectorAll('#builder-days .ex-row').forEach(row=>{
    builderCapturePeriodBase(row);
    const pv=builderWeekPreviewData(row,mod,idx);
    const set=(f,v)=>{const el=row.querySelector('[data-f="'+f+'"]');if(el)el.value=v==null||v===''?'':String(v);};
    set('sets',pv.sets);
    set('reps',pv.reps);
    if(pv.kg)set('kg',pv.kg);
    set('rpe',pv.rpe);
    set('rir',pv.rir);
    delete row.dataset.periodBase;
  });
  window._builderPeriodWeek=0;
  updatePeriod();
  notify('✓ Wstawiono wartości z wybranego tygodnia (serie, powt., kg, RPE, RIR)');
}
window.builderApplyPeriodWeek=builderApplyPeriodWeek;
function getPeriod(level){
  if(level==='poczatkujacy')return[{nr:1,cel:'Adaptacja — nauka wzorców',rpe:'RPE 7'},{nr:2,cel:'Utrwalenie techniki',rpe:'RPE 7'},{nr:3,cel:'Progresja liniowa',rpe:'RPE 8'},{nr:4,cel:'DELOAD — regeneracja CNS',rpe:'RPE 6'}];
  if(level==='sredni')return[{nr:1,cel:'DUP Akumulacja — wysoka objętość',rpe:'RPE 7'},{nr:2,cel:'DUP Intensyfikacja',rpe:'RPE 8'},{nr:3,cel:'DUP Szczyt',rpe:'RPE 9'},{nr:4,cel:'DELOAD',rpe:'RPE 6'}];
  return[{nr:1,cel:'Blok Akumulacji',rpe:'RPE 7-8'},{nr:2,cel:'Blok Akumulacji +',rpe:'RPE 8'},{nr:3,cel:'Blok Intensyfikacji',rpe:'RPE 8-9'},{nr:4,cel:'Blok Intensyfikacji peak',rpe:'RPE 9'},{nr:5,cel:'Blok Realizacji',rpe:'RPE 9-10'},{nr:6,cel:'DELOAD + Pivot Week',rpe:'RPE 6'}];
}
// Ładuje istniejący plan do kreatora, żeby faktycznie go edytować (a nie tworzyć pusty nowy).
function editPlan(id){
  const plan=PL.find(p=>p.id===id);
  if(!plan){notify('Nie znaleziono planu');return;}
  window._builderBack='plans';
  goTo('builder'); // initBuilder() czyści formularz i resetuje _editingPlanId
  document.getElementById('b-name').value=plan.name||'';
  const clientSel=document.getElementById('b-client');
  if(clientSel)clientSel.value=plan.clientId||'';
  const methodSel=document.getElementById('b-method');
  if(methodSel)methodSel.value=plan.method||methodSel.value;
  const durInp=document.getElementById('b-duration');
  if(durInp)durInp.value=plan.duration||'';
  updatePeriod();
  (plan.days||[]).forEach(d=>{
    addDay();
    const dayEl=document.getElementById('bd-'+dayCount);
    if(!dayEl)return;
    const hdrInps=dayEl.querySelectorAll('.builder-day-hdr select, .builder-day-hdr input[type=text]');
    if(hdrInps[0])hdrInps[0].value=d.day||d.dayName||hdrInps[0].value;
    if(hdrInps[1])hdrInps[1].value=d.muscles||d.focus||'';
    if(d.rest){
      const rc=dayEl.querySelector('.rc');
      if(rc){rc.checked=true;toggleR(dayEl.id);}
      return;
    }
    (d.exercises||[]).forEach(ex=>{
      addRow(dayEl.id);
      const rows=dayEl.querySelectorAll('.ex-row');
      const row=rows[rows.length-1];
      const parsed=typeof parsePlanExercise==='function'?parsePlanExercise(ex):(typeof ex==='string'?{name:ex}:ex);
      const set=(f,v)=>{const el=row.querySelector('[data-f="'+f+'"]');if(el)el.value=v==null?'':v;};
      set('name',parsed.name||'');
      set('sets',parsed.sets||'');
      set('reps',parsed.reps||'');
      set('kg',parsed.kg||'');
      set('rpe',parsed.rpe||'');
      set('rir',parsed.rir||'');
      set('rest',parsed.rest||'');
      set('tempo',parsed.tempo||'');
      set('alt',(ex&&typeof ex==='object'&&ex.alt)||parsed.alt||(typeof altsForExercise==='function'?altsForExercise(parsed.name).join(', '):''));
      set('pct1rm',parsed.pct1rm||(ex&&typeof ex==='object'&&ex.pct1rm)||'');
      set('ss',parsed.ss||(ex&&typeof ex==='object'&&ex.ss)||'');
      set('emom',((ex&&typeof ex==='object'&&ex.emom)||parsed.emom)?'1':'');
      set('note',parsed.note||(ex&&typeof ex==='object'&&(ex.note||ex.notes))||'');
      set('video',parsed.video||(ex&&typeof ex==='object'&&ex.video)||'');
      set('wu',parsed.wu||(ex&&typeof ex==='object'&&ex.wu)||'');
      set('drop',parsed.drop||(ex&&typeof ex==='object'&&ex.drop)||'');
      set('amrap',((ex&&typeof ex==='object'&&ex.amrap)||parsed.amrap)?'1':'');
      if(typeof builderPreviewKg==='function')builderPreviewKg(row);
      if(typeof builderPaintEmom==='function')builderPaintEmom(row);
      if(typeof builderPaintKinds==='function')builderPaintKinds(row);
      if(typeof builderRefreshRowExtras==='function')builderRefreshRowExtras(row);
    });
    if(typeof builderPaintSs==='function')builderPaintSs(dayEl.querySelector('.ex-rows'));
  });
  const titleEl=document.querySelector('#screen-builder .topbar-title');
  if(titleEl)titleEl.textContent='Edytuj plan: '+(plan.name||'');
  window._editingPlanId=id;
}

async function savePlan(){
  if(window._saveGuard_savePlan)return;window._saveGuard_savePlan=true;setTimeout(()=>window._saveGuard_savePlan=false,1500);

  const name=document.getElementById('b-name').value.trim();
  if(!name){notify('Wpisz nazwę planu!');return;}
  const cid=document.getElementById('b-client').value;
  const c=CL.find(x=>x.id===cid);
  const days=[];
  document.querySelectorAll('.builder-day').forEach(de=>{
    const inps=de.querySelectorAll('.builder-day-hdr select, .builder-day-hdr input[type=text]');
    const dn=inps[0].value,muscles=inps[1].value;const isRest=de.querySelector('.rc').checked;
    if(isRest){days.push({day:dn,rest:true,muscles:'',exercises:[],sets:0});return;}
    const exercises=[];let sets=0;
    de.querySelectorAll('.ex-row').forEach(r=>{
      const g=f=>(r.querySelector('[data-f="'+f+'"]')||{}).value||'';
      const n=g('name').trim();
      if(!n)return;
      const setN=g('sets')||'3';
      const alt=g('alt').trim()||(typeof altsForExercise==='function'?altsForExercise(n).join(', '):'');
      const pct=typeof parsePct1RM==='function'?parsePct1RM(g('pct1rm')):'';
      exercises.push({
        name:n,
        sets:setN,
        reps:g('reps')||'10',
        kg:g('kg'),
        pct1rm:pct,
        rpe:g('rpe'),
        rir:g('rir'),
        rest:g('rest')||'90s',
        tempo:g('tempo'),
        alt,
        ss:g('ss'),
        emom:g('emom')==='1',
        note:g('note').trim(),
        video:typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(g('video')):g('video').trim(),
        wu:g('ss')?0:(typeof parseSetKindCount==='function'?parseSetKindCount(g('wu'),2):(parseInt(g('wu'),10)||0)),
        drop:g('ss')?0:(typeof parseSetKindCount==='function'?parseSetKindCount(g('drop'),2):(parseInt(g('drop'),10)||0)),
        amrap:g('amrap')==='1'
      });
      sets+=parseInt(setN,10)||3;
    });
    if(typeof applySsLabels==='function'){
      applySsLabels(exercises);
      exercises.forEach(e=>{e.ss=e.ssLetter||'';delete e.ssLabel;delete e.ssLetter;});
    }
    days.push({day:dn,muscles,exercises,sets,rest:false});
  });
  if(!days.length){notify('Dodaj przynajmniej jeden dzień!');return;}
  const editingId=window._editingPlanId;
  if(editingId){
    const idx=PL.findIndex(p=>p.id===editingId);
    if(idx>=0){
      PL[idx]={...PL[idx],name,method:document.getElementById('b-method').value,duration:document.getElementById('b-duration').value,clientId:cid,clientName:c?c.name:'',level:c?c.level:PL[idx].level,goal:c?c.goal:PL[idx].goal,days,updatedAt:new Date().toISOString()};
      window._editingPlanId=null;
      goTo('plans');notify('Plan zaktualizowany!');
      await persistById('plans',PL[idx]);
      if(cid&&typeof maybeSchedulePlanToCalendar==='function')maybeSchedulePlanToCalendar(PL[idx].id,{weeks:4,confirmMsg:'Zaktualizować kalendarz — dodać sesje z planu na 4 tyg.?'});
      return;
    }
  }
  const plan=withTrainer({id:newId('p'),name,method:document.getElementById('b-method').value,duration:document.getElementById('b-duration').value,clientId:cid,clientName:c?c.name:'',level:c?c.level:'sredni',goal:c?c.goal:'masa',days,createdAt:new Date().toISOString()});
  PL.push(plan);goTo('plans');notify('Plan zapisany!');
  await persistById('plans',plan);
  if(cid&&typeof maybeSchedulePlanToCalendar==='function')maybeSchedulePlanToCalendar(plan.id,{weeks:4});
  maybeResumeOnboard(cid);
}

/** Mapuje etykietę dnia planu → JS getDay() (0=Nd … 6=Sob). */
function planDayLabelToWeekday(label,fallbackIdx){
  const s=String(label||'').toUpperCase();
  const map={PON:1,WT:2,'ŚR':3,SR:3,CZ:4,PT:5,SO:6,ND:0,
    PONIEDZIALEK:1,WTOREK:2,SRODA:3,'ŚRODA':3,CZWARTEK:4,PIATEK:5,'PIĄTEK':5,SOBOTA:6,NIEDZIELA:0};
  for(const k of Object.keys(map)){if(s.startsWith(k)||s.includes(k+' ')||s.includes(k+':')||s.includes(k+'—')||s.includes(k+'-'))return map[k];}
  const defaults=[1,3,5,2,4,6,1]; // Pon/Śr/Pt/Wt/Czw/Sob
  return defaults[(fallbackIdx||0)%defaults.length];
}
/** Preferowane dni klienta albo opts.weekdays — inaczej etykieta dnia / fallback indeksu. */
function resolvePlanDayWeekday(dayLabel,dayIdx,preferredWeekdays){
  const pref=typeof normalizePreferredWeekdays==='function'?normalizePreferredWeekdays(preferredWeekdays):((preferredWeekdays)||[]);
  if(pref.length&&pref[dayIdx%pref.length]!=null)return pref[dayIdx%pref.length];
  return planDayLabelToWeekday(dayLabel,dayIdx);
}
/** Godzina startu z preferowanej pory klienta (np. „Wieczór (18-22)”). */
function scheduleTimeFromClient(client,fallback){
  const fb=fallback||'18:00';
  const t=String(client&&client.preferredTrainTime||'');
  if(/rano|6-10|6–10/i.test(t))return'08:00';
  if(/południe|10-14|10–14/i.test(t))return'12:00';
  if(/po południu|14-18|14–18/i.test(t))return'16:00';
  if(/wieczór|18-22|18–22/i.test(t))return'18:00';
  return fb;
}
/** Tworzy sesje kalendarzowe z dni planu (planId + dayIdx) na N tygodni do przodu. */
function schedulePlanToCalendar(planId,opts){
  const plan=PL.find(p=>p.id===planId);if(!plan){notify('Brak planu');return 0;}
  if(!plan.clientId){notify('Przypisz plan do klienta, żeby dodać do kalendarza');return 0;}
  const client=CL.find(x=>x.id===plan.clientId);
  const weeks=Math.max(1,Math.min(12,(opts&&opts.weeks)||4));
  const time=(opts&&opts.time)||scheduleTimeFromClient(client,'18:00');
  const duration=(opts&&opts.duration)||60;
  const preferred=(opts&&opts.weekdays)!=null?(opts.weekdays):(client&&client.preferredWeekdays)||[];
  const trainDays=(plan.days||[]).map((d,i)=>({d,i})).filter(x=>x.d&&!x.d.rest&&(x.d.exercises||[]).length);
  if(!trainDays.length){notify('Plan nie ma dni treningowych');return 0;}
  const today=new Date();today.setHours(0,0,0,0);
  let created=0;
  for(let w=0;w<weeks;w++){
    trainDays.forEach(({d,i})=>{
      const wd=resolvePlanDayWeekday(d.day||d.dayName,i,preferred);
      const dt=new Date(today);
      const cur=dt.getDay();
      let add=(wd-cur+7)%7;
      if(add===0&&w===0)add=0; // dziś OK
      dt.setDate(dt.getDate()+add+w*7);
      const ymd=typeof dateStr==='function'?dateStr(dt):dt.toISOString().slice(0,10);
      const exists=SE.some(s=>s.clientId===plan.clientId&&s.date===ymd&&s.planId===plan.id&&s.dayIdx===i);
      if(exists)return;
      const label=d.day||d.dayName||('Dzień '+(i+1));
      const muscles=d.muscles||d.focus||'';
      const sess=withTrainer({
        id:newId('s'),
        clientId:plan.clientId,
        date:ymd,
        time,
        type:label+(muscles?' — '+muscles:''),
        notes:'Z planu: '+(plan.name||'')+(muscles?' · '+muscles:''),
        duration,
        source:'planned',
        planId:plan.id,
        dayIdx:i,
        createdAt:new Date().toISOString()
      });
      SE.push(sess);
      persistById('sessions',sess);
      created++;
    });
  }
  try{renderCal();}catch(e){}
  try{renderDash();}catch(e){}
  try{if(typeof renderDashCalRefillFollowup==='function')renderDashCalRefillFollowup();}catch(e){}
  notify(created?'📅 Dodano '+created+' sesji do kalendarza':'Brak nowych sesji (już zaplanowane)');
  return created;
}
window.schedulePlanToCalendar=schedulePlanToCalendar;
window.planDayLabelToWeekday=planDayLabelToWeekday;
window.resolvePlanDayWeekday=resolvePlanDayWeekday;
window.scheduleTimeFromClient=scheduleTimeFromClient;

/** Auto-kalendarz gdy klient ma preferredWeekdays; inaczej confirm. */
function maybeSchedulePlanToCalendar(planId,opts){
  const plan=(window.PL||[]).find(p=>p.id===planId);
  if(!plan||!plan.clientId||typeof schedulePlanToCalendar!=='function')return 0;
  const client=(window.CL||[]).find(x=>x.id===plan.clientId);
  const pref=typeof normalizePreferredWeekdays==='function'
    ?normalizePreferredWeekdays(client&&client.preferredWeekdays)
    :((client&&client.preferredWeekdays)||[]);
  const weeks=(opts&&opts.weeks)||4;
  const forceConfirm=opts&&opts.forceConfirm;
  if(pref.length&&!forceConfirm){
    const n=schedulePlanToCalendar(planId,{weeks,weekdays:pref});
    if(n>0){
      const labels=typeof preferredWeekdaysLabels==='function'?preferredWeekdaysLabels(pref).join('/'):pref.join(',');
      const time=typeof scheduleTimeFromClient==='function'?scheduleTimeFromClient(client,'18:00'):'18:00';
      if(typeof notify==='function')notify('📅 Zaplanowano '+n+' sesji ('+labels+' · '+time+')');
    }
    return n;
  }
  const msg=(opts&&opts.confirmMsg)||'Dodać dni planu do kalendarza na najbliższe 4 tygodnie?';
  if(confirm(msg))return schedulePlanToCalendar(planId,{weeks});
  return 0;
}
window.maybeSchedulePlanToCalendar=maybeSchedulePlanToCalendar;

/** Dopełnij kalendarz klienta o kolejne tygodnie z jego planu. */
function refillClientCalendar(clientId,opts){
  opts=opts||{};
  const plan=typeof clientPlanForCalendar==='function'?clientPlanForCalendar(clientId):(window.PL||[]).find(p=>p&&p.clientId===clientId);
  if(!plan){if(typeof notify==='function')notify('Brak planu z dniami treningowymi');return 0;}
  const weeks=opts.weeks||4;
  let n=0;
  if(typeof maybeSchedulePlanToCalendar==='function')n=maybeSchedulePlanToCalendar(plan.id,{weeks,forceConfirm:false})||0;
  else if(typeof schedulePlanToCalendar==='function')n=schedulePlanToCalendar(plan.id,{weeks})||0;
  try{if(typeof renderDashCalRefillFollowup==='function')renderDashCalRefillFollowup();}catch(e){}
  return n;
}
window.refillClientCalendar=refillClientCalendar;

// ════════════════════════════════════════
// PLANS
// ════════════════════════════════════════
// Kolor akcentu karty wg metody treningowej — ten sam wzorzec co w Zasobach i Bibliotece ćwiczeń.
const PLAN_METHOD_COLORS={PPL:'var(--accent)',FBW:'var(--teal)',UL:'var(--blue)','531':'var(--purple)',HIIT:'var(--red)',GZCLP:'var(--orange)',Obwodowy:'var(--orange)',Circuit:'var(--orange)'};

function renderPlans(){
  const el=document.getElementById('plans-content');
  if(!el)return;
  const search=(document.getElementById('plans-search')||{}).value?.trim().toLowerCase()||'';
  let list=PL.filter(p=>{
    if(!search)return true;
    const client=CL.find(c=>c.id===p.clientId);
    const clientName=(client?.name||p.clientName||'').toLowerCase();
    return clientName.includes(search)||(p.name||'').toLowerCase().includes(search);
  });
  // Najnowsze / ostatnio aktualizowane na górze.
  list=list.slice().sort((a,b)=>{
    const da=new Date(a.updatedAt||a.createdAt||0).getTime();
    const db=new Date(b.updatedAt||b.createdAt||0).getTime();
    return db-da;
  });
  if(!list.length){el.innerHTML=`<div style="text-align:center;color:var(--muted);padding:60px 20px;">
    <div style="font-size:36px;margin-bottom:10px;opacity:0.35;">📋</div>
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">${search?'Brak planów pasujących do wyszukiwania':'Brak planów treningowych'}</div>
    <div style="font-size:12px;margin-bottom:16px;">Twórz i przypisuj plany z profilu klienta → zakładka Plan (szablon, własny kreator lub AI).</div>
    ${search?'':`<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" onclick="goTo('clients')">Otwórz klientów</button>
      <button class="btn btn-ghost btn-sm" onclick="goTo('templates')">📋 Szablony</button>
    </div>`}
  </div>`;return;}
  el.innerHTML=`<div class="plans-grid">`+list.map((p,pi)=>{
    const client=CL.find(c=>c.id===p.clientId);
    const clientName=client?.name||p.clientName||'Bez klienta';
    const hasClient=!!client;
    const dayChips=(p.days||[]).map(d=>d.rest?'💤':(d.day||d.dayName||d.muscles||d.focus||d.name||'—')).slice(0,6);
    const accentCol=PLAN_METHOD_COLORS[p.method]||'var(--muted)';
    return `<div class="plan-card" id="plan-card-${p.id}" style="animation-delay:${pi*0.03}s;">
      <div class="plan-card-accent" style="background:${accentCol};"></div>
      <div style="padding:16px 18px;">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          ${hasClient?`<div style="width:36px;height:36px;border-radius:9px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--accent);flex-shrink:0;">${getInit(clientName)}</div>`:'<div style="width:36px;height:36px;border-radius:9px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>'}
          <div style="min-width:0;flex:1;">
            <div style="font-size:15px;font-weight:700;color:var(--text);line-height:1.3;">${p.name}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">${hasClient?'👤 '+clientName:'Brak klienta'} · ⏱️ ${p.duration||'?'} tyg.</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
          ${dayChips.map(d=>`<span class="plan-day-chip">${d}</span>`).join('')}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="togglePlanExpand('${p.id}')" id="plan-toggle-${p.id}">👁️ Podgląd</button>
          <button class="btn btn-ghost btn-sm" onclick="editPlan('${p.id}')">✏️</button>
          ${hasClient?`<button class="btn btn-ghost btn-sm" onclick="openClientProfile('${client.id}')">👤</button>`:''}
          <button class="btn btn-danger btn-sm" onclick="delPlan('${p.id}')">🗑️</button>
        </div>
      </div>
      <div id="plan-detail-${p.id}" class="plan-card-detail" style="display:none;">
        ${(p.days||[]).map(d=>planDayPreviewHtml(d,p.clientId)).join('')}
      </div>
    </div>`;
  }).join('')+`</div>`;
}

function planDayPreviewHtml(d,clientId){
  const dayName=escHtml(d.day||d.dayName||'—');
  if(d.rest){
    return `<div class="plan-day-row">
      <div class="plan-day-name">${dayName}</div>
      <div class="plan-day-rest">— Odpoczynek</div>
    </div>`;
  }
  const focusRaw=String(d.muscles||d.focus||d.name||'');
  const dayRaw=String(d.day||d.dayName||'');
  const showFocus=focusRaw&&focusRaw!==dayRaw;
  const parts=typeof formatDayExerciseParts==='function'
    ? formatDayExerciseParts(d.exercises,clientId)
    : (d.exercises||[]).map(e=>typeof formatPlanExerciseLine==='function'?formatPlanExerciseLine(e,clientId):'').filter(Boolean);
  return `<div class="plan-day-row">
    <div class="plan-day-name">${dayName}</div>
    ${showFocus?`<div class="plan-day-focus">${escHtml(focusRaw)}</div>`:''}
    <div class="plan-day-ex">${parts.map(l=>`<div class="plan-ex-line">${escHtml(l)}</div>`).join('')}</div>
  </div>`;
}
window.planDayPreviewHtml=planDayPreviewHtml;

// Rozwija/zwija szczegóły ćwiczeń w karcie planu — na liście widać tylko nagłówek + tagi dni,
// pełne ćwiczenia pokazują się dopiero po kliknięciu "Podgląd".
function togglePlanExpand(id){
  const detail=document.getElementById('plan-detail-'+id);
  const btn=document.getElementById('plan-toggle-'+id);
  const card=document.getElementById('plan-card-'+id);
  if(!detail)return;
  const isOpen=detail.style.display==='block';
  detail.style.display=isOpen?'none':'block';
  if(card)card.classList.toggle('is-open',!isOpen);
  if(btn)btn.textContent=isOpen?'👁️ Podgląd':'👁️ Ukryj';
}
async function delPlan(id){
  if(!id){notify('Błąd: brak ID planu');return;}
  if(!confirm('Usunąć plan?'))return;
  try{if(window._db)await window._del(window._doc(window._db,'plans',id));}catch(e){console.warn('Firebase delPlan:',e);}
  window.PL=PL.filter(p=>p.id!==id);
  renderPlans();
  // odśwież profil klienta jeśli otwarty
  if(typeof cpClientId!=='undefined'&&cpClientId){try{setCPTab('plan');}catch(e){}}
  notify('✓ Plan usunięty');
}

// ════════════════════════════════════════
// CALENDAR V2 — WEEK / MONTH / LIST
// ════════════════════════════════════════
var calView='week';
var calCurrentDate=new Date();
var calMiniDate=new Date();
var calSelectedDate=null;

const CAL_HOURS=Array.from({length:24},(_,i)=>i); // 0-23
const CAL_DAYS_PL=['Pon','Wt','Śr','Czw','Pt','Sob','Nie'];
const CAL_MONTHS_PL=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const SESS_COLORS=['var(--accent)','var(--blue)','var(--purple)','var(--teal)','var(--orange)','var(--red)'];

function getWeekStart(d){
  const dt=new Date(d);
  const day=dt.getDay();
  const diff=day===0?-6:1-day; // Monday = 0
  dt.setDate(dt.getDate()+diff);
  dt.setHours(0,0,0,0);
  return dt;
}

function dateStr(d){return d.toISOString().split('T')[0];}

function setCalView(v){
  calView=v;
  document.getElementById('cal-week-view').style.display=v==='week'?'flex':'none';
  document.getElementById('cal-week-view').style.flexDirection=v==='week'?'column':'';
  document.getElementById('cal-month-view').style.display=v==='month'?'block':'none';
  document.getElementById('cal-list-view').style.display=v==='list'?'block':'none';
  ['week','month','list'].forEach(t=>{
    const btn=document.getElementById('calv-'+t);
    if(btn)btn.classList.toggle('active',t===v);
  });
  renderCal();
}

function calNav(dir){
  if(calView==='week'){calCurrentDate=new Date(calCurrentDate);calCurrentDate.setDate(calCurrentDate.getDate()+dir*7);}
  else if(calView==='month'){calCurrentDate=new Date(calCurrentDate.getFullYear(),calCurrentDate.getMonth()+dir,1);}
  else if(calView==='list'){calCurrentDate=new Date(calCurrentDate);calCurrentDate.setDate(calCurrentDate.getDate()+dir*14);}
  renderCal();
}

function calNavToday(){calCurrentDate=new Date();renderCal();}
function calMiniNav(dir){calMiniDate=new Date(calMiniDate.getFullYear(),calMiniDate.getMonth()+dir,1);renderCalMini();}

function renderCal(){
  updateCalTitle();
  renderCalMini();
  renderCalSidebar();
  if(calView==='week')renderCalWeek();
  else if(calView==='month')renderCalMonth();
  else renderCalList();
}

function updateCalTitle(){
  const el=document.getElementById('cal-title');if(!el)return;
  const today=new Date();
  if(calView==='week'){
    const ws=getWeekStart(calCurrentDate);
    const we=new Date(ws);we.setDate(we.getDate()+6);
    const sm=ws.getMonth();const em=we.getMonth();
    if(sm===em)el.textContent=CAL_DAYS_PL[0]+' '+ws.getDate()+' — '+CAL_DAYS_PL[6]+' '+we.getDate()+' '+CAL_MONTHS_PL[sm]+' '+ws.getFullYear();
    else el.textContent=ws.getDate()+' '+CAL_MONTHS_PL[sm]+' — '+we.getDate()+' '+CAL_MONTHS_PL[em]+' '+ws.getFullYear();
  } else if(calView==='month'){
    el.textContent=CAL_MONTHS_PL[calCurrentDate.getMonth()]+' '+calCurrentDate.getFullYear();
  } else {
    el.textContent='Lista sesji';
  }
}

function renderCalWeek(){
  const ws=getWeekStart(calCurrentDate);
  const today=new Date();today.setHours(0,0,0,0);
  const hdr=document.getElementById('cal-week-header');
  if(!hdr)return;

  // header — dni tygodnia
  let hdrHTML='<div style="height:48px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--s1);position:sticky;top:0;z-index:6;"></div>';
  for(let i=0;i<7;i++){
    const d=new Date(ws);d.setDate(d.getDate()+i);
    const isToday=dateStr(d)===dateStr(today);
    const dayCount=SE.filter(s=>s.date===dateStr(d)).length;
    hdrHTML+=`<div class="cal-week-day-hdr${isToday?' today':''}" style="border-bottom:1px solid var(--border);">
      <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${CAL_DAYS_PL[i]}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${isToday?'var(--accent)':'var(--text)'};">${d.getDate()}</div>
      ${dayCount?`<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);margin:0 auto;"></div>`:'<div style="width:6px;height:6px;"></div>'}
    </div>`;
  }
  hdr.innerHTML=hdrHTML;

  // grid — godziny × dni
  const grid=document.getElementById('cal-week-grid');
  let gridHTML='';
  const nowHour=new Date().getHours();
  const nowMin=new Date().getMinutes();
  const todayIdx=[...Array(7)].findIndex((_,i)=>{const d=new Date(ws);d.setDate(d.getDate()+i);return dateStr(d)===dateStr(today);});

  for(let h=6;h<23;h++){
    // hour label
    gridHTML+=`<div class="cal-hour-label">${String(h).padStart(2,'0')}:00</div>`;
    for(let i=0;i<7;i++){
      const d=new Date(ws);d.setDate(d.getDate()+i);
      const ds=dateStr(d);
      const isToday=i===todayIdx;
      const cellSessions=SE.filter(s=>s.date===ds&&parseInt((s.time||'0:0').split(':')[0])===h);
      const sessHTML=cellSessions.map((s,si)=>{
        const c=CL.find(x=>x.id===s.clientId);
        const cIdx=c?CL.indexOf(c):-1;
        const col=s.source==='garmin'?'#007cc3':SESS_COLORS[(cIdx>=0?cIdx:0)%6];
        const timeMin=parseInt((s.time||'0:0').split(':')[1]||0);
        const topPct=(timeMin/60)*100;
        const dur=s.duration||60;
        const heightPx=Math.max(20,(dur/60)*56);
        return `<div class="cal-session-block" style="background:var(--input-bg);border:1px solid rgba(255,255,255,0.1);border-left:3px solid ${col};color:var(--text);top:${topPct}%;height:${heightPx}px;" onclick="editSession('${s.id}')" title="${c?c.name:'Klient'} — ${s.type||''} ${s.time||''}">
          <div class="cal-session-name">${s.source==='garmin'?'⌚ ':''}${c?c.name.split(' ')[0]:'Klient'}</div>
          <div class="cal-session-meta">${s.time||''}${s.type?' · '+s.type:''}</div>
        </div>`;
      }).join('');
      gridHTML+=`<div class="cal-cell${isToday?' today-col':''}" onclick="quickAddSession('${ds}','${String(h).padStart(2,'0')}:00')">${sessHTML}</div>`;
    }
  }

  // current time line
  if(todayIdx>=0){
    const topPx=((nowHour-6)*56)+(nowMin/60*56);
    gridHTML+=`<div style="grid-column:${todayIdx+2};grid-row:1;display:none;"></div>`; // placeholder
  }
  grid.innerHTML=gridHTML;

  // scroll to 8:00
  const scroll=document.getElementById('cal-week-scroll');
  if(scroll)setTimeout(()=>{scroll.scrollTop=2*56;},50);

  // current time overlay
  if(todayIdx>=0){
    const topPx=((nowHour-6)*56)+(nowMin/60*56);
    const col=grid.children[todayIdx+1+8]; // approx
    // add absolute line
    const line=document.createElement('div');
    line.className='cal-time-now';
    line.style.top=(topPx+48)+'px'; // +48 for header
    line.style.gridColumn=(todayIdx+2)+'';
    grid.style.position='relative';
    grid.appendChild(line);
  }
}

function renderCalMonth(){
  const y=calCurrentDate.getFullYear();
  const m=calCurrentDate.getMonth();
  const today=new Date();
  const firstDay=new Date(y,m,1);
  let fd=firstDay.getDay();fd=(fd+6)%7;
  const dim=new Date(y,m+1,0).getDate();

  const dowEl=document.getElementById('cal-month-dow');
  if(dowEl)dowEl.innerHTML=['Pon','Wt','Śr','Czw','Pt','Sob','Nie'].map(d=>`<div style="text-align:center;font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;padding:4px 0;">${d}</div>`).join('');

  let html='';
  for(let i=0;i<fd;i++){
    const pd=new Date(y,m,1-fd+i);
    html+=`<div class="cal-month-cell other-month"><div style="font-size:12px;color:var(--muted2);">${pd.getDate()}</div></div>`;
  }
  for(let d=1;d<=dim;d++){
    const ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const daySess=SE.filter(s=>s.date===ds);
    const isToday=ds===dateStr(today);
    html+=`<div class="cal-month-cell${isToday?' today':''}" onclick="calClickDay('${ds}')">
      <div style="font-size:12px;font-weight:${isToday?700:500};color:${isToday?'var(--accent)':'var(--text)'};">${d}</div>
      ${daySess.slice(0,3).map(s=>{
        const c=CL.find(x=>x.id===s.clientId);
        const ci=c?CL.indexOf(c):-1;
        const col=SESS_COLORS[(ci>=0?ci:0)%6];
        return `<div class="cal-month-sess" style="background:var(--input-bg);border-left:3px solid ${col};color:var(--text);" onclick="event.stopPropagation();editSession('${s.id}')"><span style="color:var(--muted);">${s.time||''}</span> ${c?c.name.split(' ')[0]:'Klient'}</div>`;
      }).join('')}
      ${daySess.length>3?`<div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">+${daySess.length-3} więcej</div>`:''}
    </div>`;
  }
  const remaining=(7-((fd+dim)%7))%7;
  for(let i=1;i<=remaining;i++){
    html+=`<div class="cal-month-cell other-month"><div style="font-size:12px;color:var(--muted2);">${i}</div></div>`;
  }
  const grid=document.getElementById('cal-month-grid');
  if(grid)grid.innerHTML=html;
}

function renderCalList(){
  const el=document.getElementById('cal-list-body');if(!el)return;
  const start=new Date(calCurrentDate);start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+30);
  const startStr=dateStr(start);const endStr=dateStr(end);
  const upcoming=SE.filter(s=>s.date>=startStr&&s.date<=endStr).sort((a,b)=>a.date.localeCompare(b.date)||((a.time||'').localeCompare(b.time||'')));

  if(!upcoming.length){
    el.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;opacity:0.3;">📅</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak sesji w tym okresie</div>
      <button class="btn btn-primary" onclick="openM('m-session')">+ Dodaj sesję</button>
    </div>`;
    return;
  }

  // group by date
  const groups={};
  upcoming.forEach(s=>{if(!groups[s.date])groups[s.date]=[];groups[s.date].push(s);});
  const today=dateStr(new Date());
  el.innerHTML=Object.entries(groups).map(([date,sessions])=>{
    const d=new Date(date+'T12:00:00');
    const isToday=date===today;
    const dayName=CAL_DAYS_PL[(d.getDay()+6)%7];
    return `<div class="cal-list-day">
      <div class="cal-list-day-hdr">
        <div style="font-size:24px;color:${isToday?'var(--accent)':'var(--text)'};">${d.getDate()}</div>
        <div>
          <div style="font-size:12px;color:${isToday?'var(--accent)':'var(--muted)'};">${dayName}</div>
          <div style="font-size:11px;color:var(--muted2);">${CAL_MONTHS_PL[d.getMonth()]}</div>
        </div>
        ${isToday?'<span class="pill pill-green" style="font-size:10px;">Dziś</span>':''}
        <span class="pill pill-muted" style="font-size:10px;">${sessions.length} ${sessions.length===1?'sesja':sessions.length<5?'sesje':'sesji'}</span>
      </div>
      ${sessions.map(s=>{
        const c=CL.find(x=>x.id===s.clientId);
        const ci=c?CL.indexOf(c):-1;
        const col=s.source==='garmin'?'#007cc3':SESS_COLORS[(ci>=0?ci:0)%6];
        return `<div class="cal-list-sess" onclick="editSession('${s.id}')">
          <div style="width:4px;border-radius:2px;background:${col};flex-shrink:0;align-self:stretch;"></div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:${col};min-width:44px;line-height:1.1;">${s.time||'—'}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">${s.source==='garmin'?'⌚ ':''}${c?c.name:'Klient'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${s.source==='garmin'?'Garmin · ':''}${s.type||'Sesja'} · ${s.duration||60} min</div>
            ${s.notes?`<div style="font-size:11px;color:var(--muted2);margin-top:3px;font-style:italic;">${s.notes}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-self:center;">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editSession('${s.id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();delSession('${s.id}')">×</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function renderCalMini(){
  const y=calMiniDate.getFullYear();
  const m=calMiniDate.getMonth();
  const today=new Date();
  const titleEl=document.getElementById('cal-mini-title');
  if(titleEl)titleEl.textContent=CAL_MONTHS_PL[m]+' '+y;

  const firstDay=new Date(y,m,1);
  let fd=firstDay.getDay();fd=(fd+6)%7;
  const dim=new Date(y,m+1,0).getDate();
  let html='';
  for(let i=0;i<fd;i++){
    const pd=new Date(y,m,1-fd+i);
    html+=`<div class="cal-mini-day other-month">${pd.getDate()}</div>`;
  }
  for(let d=1;d<=dim;d++){
    const ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isToday=ds===dateStr(today);
    const hasSess=SE.some(s=>s.date===ds);
    const isSel=calSelectedDate===ds;
    html+=`<div class="cal-mini-day${isToday?' today':hasSess?' has-sess':''}${isSel?' selected':''}" onclick="calJumpTo('${ds}')">${d}</div>`;
  }
  const grid=document.getElementById('cal-mini-grid');
  if(grid)grid.innerHTML=html;
}

function renderCalSidebar(){
  const today=new Date();
  const ws=getWeekStart(calCurrentDate);
  const we=new Date(ws);we.setDate(we.getDate()+6);
  const wsStr=dateStr(ws);const weStr=dateStr(we);
  const weekSess=SE.filter(s=>s.date>=wsStr&&s.date<=weStr);

  const statsEl=document.getElementById('cal-week-stats');
  if(statsEl)statsEl.innerHTML=`
    <div class="ui-kpi-mini">
      <div class="ui-kpi-mini-val">${weekSess.length}</div>
      <div class="ui-kpi-mini-lbl">Sesji</div>
    </div>
    <div class="ui-kpi-mini">
      <div class="ui-kpi-mini-val" style="color:var(--blue);">${new Set(weekSess.map(s=>s.clientId)).size}</div>
      <div class="ui-kpi-mini-lbl">Klientów</div>
    </div>
    <div class="ui-kpi-mini">
      <div class="ui-kpi-mini-val" style="color:var(--teal);">${weekSess.reduce((s,sess)=>s+(sess.duration||60),0)}</div>
      <div class="ui-kpi-mini-lbl">Minut</div>
    </div>
    <div class="ui-kpi-mini">
      <div class="ui-kpi-mini-val" style="color:var(--orange);">${SE.filter(s=>s.date===dateStr(today)).length}</div>
      <div class="ui-kpi-mini-lbl">Dziś</div>
    </div>`;

  // upcoming
  const nowStr=dateStr(today);
  const up=SE.filter(s=>s.date>=nowStr).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')).slice(0,6);
  const upEl=document.getElementById('cal-upcoming');
  if(!upEl)return;
  upEl.innerHTML=!up.length?'<div class="ui-section-sub" style="text-align:center;padding:24px 0;">Brak nadchodzących sesji</div>'
    :up.map(s=>{
      const c=CL.find(x=>x.id===s.clientId);
      const ci=c?CL.indexOf(c):-1;
      const col=SESS_COLORS[(ci>=0?ci:0)%6];
      const d=new Date(s.date+'T12:00:00');
      const isToday=s.date===nowStr;
      return `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;" onclick="editSession('${s.id}')">
        <div style="text-align:center;min-width:40px;">
          <div style="font-size:var(--font-size-label);color:var(--text-label);font-weight:600;">${isToday?'Dziś':CAL_DAYS_PL[(d.getDay()+6)%7]}</div>
          <div class="ui-kpi-mini-val" style="font-size:22px;color:${col};">${d.getDate()}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--font-size-sm);font-weight:700;color:var(--text-primary);">${c?c.name:'Klient'}</div>
          <div style="font-size:var(--font-size-label);color:var(--text-label);margin-top:4px;">${s.time||'—'} · ${s.type||'Sesja'}</div>
        </div>
      </div>`;
    }).join('');
}

function calClickDay(ds){
  calSelectedDate=ds;
  calCurrentDate=new Date(ds+'T12:00:00');
  if(calView==='month'){setCalView('week');}
  else{renderCal();}
}

function calJumpTo(ds){
  calSelectedDate=ds;
  calCurrentDate=new Date(ds+'T12:00:00');
  calMiniDate=new Date(ds+'T12:00:00');
  renderCal();
}

function quickAddSession(date,time){
  asSetClientField('','');
  document.getElementById('as-date').value=date;
  document.getElementById('as-time').value=time;
  openM('m-session');
}

function openSessDetail(id){
  const s=SE.find(x=>x.id===id);if(!s)return;
  const c=CL.find(x=>x.id===s.clientId);
  notify(`${c?c.name:'Klient'} · ${s.date} ${s.time||''} · ${s.type||'Sesja'}`);
}

function editSession(id){
  const s=SE.find(x=>x.id===id);if(!s)return;
  const c=CL.find(x=>x.id===s.clientId);
  openM('m-session'); // resetuje formularz (w tym ukrywa sekcję zarejestrowanych ćwiczeń)
  asSetClientField(s.clientId||'',c?c.name:'');
  document.getElementById('as-date').value=s.date;
  document.getElementById('as-time').value=s.time||'';
  document.getElementById('as-type').value=s.type||'';
  document.getElementById('as-notes').value=s.notes||'';
  renderRecordedExercises(s);
}

// Pokazuje zarejestrowane ćwiczenia (ciężary/powtórzenia) i ocenę z sesji klienta lub Treningu Live.
function renderRecordedExercises(s){
  const wrap=document.getElementById('as-recorded-exercises');
  const list=document.getElementById('as-recorded-exercises-list');
  if(!wrap||!list)return;
  const hasDetailedSets=(s.exercises||[]).some(e=>Array.isArray(e.sets)&&e.sets.length&&typeof e.sets[0]==='object');
  const hasRating=Number(s.feedback)>=1&&Number(s.feedback)<=5;
  if(!hasDetailedSets&&!hasRating&&!(s.note||s.notes)){wrap.style.display='none';list.innerHTML='';return;}
  const src=s.source==='client'?'klienta':s.source==='live'?'Treningu Live':s.source==='planned'?'planu':'sesji';
  const titleEl=wrap.querySelector('[data-rec-ex-title]');
  if(titleEl)titleEl.textContent='Zapisane serie i ocena (z '+src+')';
  const ratingLine=hasRating&&typeof sessionRatingLabel==='function'
    ?`<div class="as-recorded-rating">Ocena: ${sessionRatingLabel(s.feedback)}</div>`
    :'';
  const noteLine=(s.note||s.notes)?`<div class="as-recorded-note">Komentarz: <span>${escHtml(s.note||s.notes)}</span></div>`:'';
  const exHtml=hasDetailedSets?s.exercises.map(e=>{
    const setsText=(e.sets||[]).map(st=>`${st.kg||0}kg × ${st.reps||0}`).join(' · ');
    return `<div class="as-recorded-ex-card">
      <div class="as-recorded-ex-name">${escHtml(e.name||'')}</div>
      <div class="as-recorded-ex-sets">${setsText||'brak zarejestrowanych serii'}</div>
    </div>`;
  }).join(''):'';
  list.innerHTML=ratingLine+noteLine+exHtml+(s.volume?`<div class="as-recorded-volume">Łączna objętość: ${s.volume} kg</div>`:'');
  wrap.style.display='block';
}

// Ustawia pole klienta w oknie sesji: widoczny tekst wyszukiwania + ukryte id.
function asSetClientField(clientId,clientName){
  const hid=document.getElementById('as-client');
  const vis=document.getElementById('as-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('as-client-results');
  if(res)res.style.display='none';
  asRenderPlanDayChips(clientId);
}

// Pokazuje "chipsy" z dniami przypisanego planu klienta — 1 klik wypełnia pole notatek.
function asRenderPlanDayChips(clientId){
  const wrap=document.getElementById('as-plan-days');
  const list=document.getElementById('as-plan-days-list');
  if(!wrap||!list)return;
  const clientPlans=PL.filter(p=>p.clientId===clientId);
  const plan=clientPlans[clientPlans.length-1];
  if(!plan||!plan.days||!plan.days.length){wrap.style.display='none';return;}
  list.innerHTML=plan.days.map(d=>{
    const label=d.day||d.dayName||d.muscles||d.name||'Trening';
    const detail=d.muscles&&d.muscles!==label?' — '+d.muscles:'';
    const full=(label+detail).replace(/'/g,"\\'");
    return `<button type="button" onclick="asPickPlanDay('${full}')" style="background:var(--s3);border:1px solid var(--border2);border-radius:99px;padding:5px 12px;font-size:11px;color:var(--text);cursor:pointer;">${label}${detail}</button>`;
  }).join('');
  wrap.style.display='block';
}

// Wypełnia pole notatek wybranym dniem z planu (nadpisuje, żeby nie duplikować przy kilku kliknięciach).
function asPickPlanDay(text){
  const notesEl=document.getElementById('as-notes');
  if(notesEl)notesEl.value=text;
}

// Filtruje i pokazuje klientów pod polem wyszukiwania, priorytetyzując tych wymagających uwagi.
function asClientSearchInput(){
  const q=(document.getElementById('as-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('as-client-results');
  if(!res)return;
  let list=CL;
  if(q)list=list.filter(c=>c.name.toLowerCase().includes(q));
  list=list.map(c=>({c,act:typeof formatClientActivity==='function'?formatClientActivity(c.id):{label:'',color:'var(--muted)',days:0}}))
    .sort((a,b)=>b.act.days-a.act.days)
    .slice(0,8);
  if(!list.length){
    res.innerHTML='<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">Brak wyników</div>';
    res.style.display='block';
    return;
  }
  res.innerHTML=list.map(({c,act})=>`
    <div onclick="asSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}


async function delSession(id){
  if(!confirm('Usunąć sesję?'))return;
  window.SE=SE.filter(s=>s.id!==id);
  renderCal();renderDash();
  notify('Sesja usunięta');
  if(window._db){try{await window._del(window._doc(window._db,'sessions',id));}catch(e){console.warn('Firebase delSession:',e);}}
}
async function saveSess(){
  if(window._saveGuard_saveSess)return;window._saveGuard_saveSess=true;setTimeout(()=>window._saveGuard_saveSess=false,1500);

  const cid=document.getElementById('as-client').value;
  const date=document.getElementById('as-date').value;
  const time=document.getElementById('as-time').value;
  const type=document.getElementById('as-type').value;
  const notes=document.getElementById('as-notes').value;
  const duration=parseInt(document.getElementById('as-duration').value)||60;
  if(!date||!time){notify('Uzupełnij datę i godzinę!');return;}
  const sess=withTrainer({id:newId('s'),clientId:cid,date,time,type,notes,duration,createdAt:new Date().toISOString()});
  SE.push(sess);
  closeM('m-session');
  try{renderCal();}catch(e){}
  try{renderDash();}catch(e){}
  // odśwież profil klienta jeśli otwarty
  if(cpClientId&&cpClientId===cid){try{setCPTab(cpTab);}catch(e){}}
  notify('Sesja dodana!');
  await persistById('sessions',sess);
  if(typeof fireIntEvent==='function'){
    const cli=(window.CL||[]).find(x=>x.id===cid);
    fireIntEvent('session.created',{session:{id:sess.id,date:sess.date,time:sess.time,type:sess.type,duration:sess.duration},client:{id:cid,name:cli&&cli.name||'',email:cli&&cli.email||'',phone:cli&&cli.phone||''}});
  }
  maybeResumeOnboard(cid);
}

