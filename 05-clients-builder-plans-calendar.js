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
  if(typeof clientAdherenceStats==='function'){
    const st=clientAdherenceStats(clientId,days);
    return{done:st.logged,assigned:st.assigned,pct:st.assigned||st.logged?st.pct:null};
  }
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
function quickEditClient(e,clientId){
  e.stopPropagation();
  if(typeof openClientModal==='function')openClientModal(clientId);
}
function quickStartWorkout(e,clientId){
  e.stopPropagation();
  const c=CL.find(x=>x.id===clientId);
  if(typeof liveSetPendingClient==='function')liveSetPendingClient(clientId,{clientName:c?c.name:''});
  goTo('live');
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
    const unread=typeof msgHasUnread==='function'?msgHasUnread(c.id):(typeof clientsWithUnreadMsgs==='function'&&clientsWithUnreadMsgs().some(x=>x.id===c.id));
    const badge=unread?'<span class="nav-client-attn" title="Nieprzeczytana wiadomość" aria-label="Nieprzeczytana"></span>':'';
    return `<button type="button" class="nav-client-item${on}" role="listitem" data-client-id="${c.id}" onclick="openClientFromSidebar('${c.id}')" title="${safeName}">
      <span class="nav-client-av" style="background:${col}22;color:${col}">${safeInit}</span>
      <span class="nav-client-name">${safeName}</span>
      ${badge}
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
    const life=typeof clientLifecycleStatus==='function'?clientLifecycleStatus(c):null;
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
      <div class="cl-name-meta">
        <div class="cl-name">${escHtml(c.name)}</div>
        <div class="cl-sub">${escHtml(c.email||'Brak e-maila')}${life&&life.key!=='active'&&life.key!=='onboarding'?' · '+escHtml(life.label):''}</div>
      </div>
      <button type="button" class="cl-edit-btn" onclick="quickEditClient(event,'${c.id}')" title="Edytuj dane klienta">Edycja</button>
    </div>
    <div class="cl-msg-cell" onclick="event.stopPropagation()">${msgBtn}</div>
    <div class="cl-act" style="color:${act.color};">${act.label}</div>
    <div>${clPctCell(t7)}</div>
    <div>${clPctCell(t30)}</div>
    <div>${clPctCell(tasks7)}</div>
    <div class="cl-goal">${CLIENT_GOAL_LABELS[c.goal]||c.goal||'—'}</div>
    <div class="cl-status">
      <span class="pill ${archived?'pill-red':c.status==='inactive'?'pill-red':life&&(life.key==='noemail'||life.key==='expired')?'pill-red':life&&(life.key==='onboarding'||life.key==='expiring'||life.key==='atrisk')?'pill-orange':c.appJoined?'pill-green':'pill-green'}"><span class="pill-dot"></span>${archived?'Zarchiwizowany':c.status==='inactive'?'Nieaktywny':life&&life.key==='onboarding'?life.label:life&&life.key==='noemail'?'Brak e-maila':life&&life.key==='expired'?'Pakiet wygasł':c.appJoined?'Połączony':(life&&life.label)||'Aktywny'}</span>
    </div>
  </div>`;
  }).join('');
  renderSidebarClients();
}

// A draft belongs to one trainer session and one client, including after a failed save.
const clientModalDrafts=new Map();
const clientModalFieldIds={name:'ac-name',email:'ac-email',phone:'ac-phone',age:'ac-age',gender:'ac-gender',weight:'ac-weight',height:'ac-height',goal:'ac-goal',level:'ac-level',trainingFreq:'ac-freq',preferredTrainTime:'ac-train-time',activityLevel:'ac-activity',sportNotes:'ac-sport-notes',injuries:'ac-injuries',notes:'ac-notes'};
function clientModalFields(){
  const fields={};
  for(const [key,id] of Object.entries(clientModalFieldIds))fields[key]=document.getElementById(id)?.value||'';
  const bg=typeof readSportBackgroundFrom==='function'?readSportBackgroundFrom('ac'):{priorSports:[],additional_activities:[]};
  fields.priorSports=bg.priorSports||[];fields.additional_activities=bg.additional_activities||[];
  fields.physiquePriority=typeof readPhysiquePriorityFrom==='function'?readPhysiquePriorityFrom('ac'):[];
  fields.preferredWeekdays=typeof readPreferredWeekdaysFrom==='function'?readPreferredWeekdaysFrom('ac'):[];
  return fields;
}
function clientModalIsCurrent(state){
  return window._clientModalState===state&&state.open&&assignmentSessionCurrent(state.auth)&&
    document.getElementById('m-client')?.classList.contains('show');
}
function captureClientModalDraft(){
  const state=window._clientModalState;
  if(state&&state.open){if(!state.candidate)state.fields=clientModalFields();state.open=false;}
}
function clearClientModalDrafts(){
  clientModalDrafts.clear();window._clientModalState=null;
  for(const id of Object.values(clientModalFieldIds)){const el=document.getElementById(id);if(el)el.value='';}
  ['ac-prior-sports-mount','ac-physique-priority-mount','ac-preferred-weekdays-mount','ac-save-status'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='';});
}
function renderClientModalSaveState(state){
  if(window._clientModalState!==state)return;
  document.querySelectorAll('#m-client .modal-body input,#m-client .modal-body select,#m-client .modal-body textarea,#m-client .modal-body button').forEach(el=>{el.disabled=!!state.candidate;});
  const btn=document.getElementById('ac-save-btn');
  if(btn){btn.disabled=!!(state.pending||state.saved||state.conflict);btn.textContent=state.pending?'Zapisuję…':state.saved?'Zapisano':state.error?'Ponów zapis':'Zapisz klienta';}
  const next=document.getElementById('ac-new-btn');if(next)next.style.display=state.saved&&!state.editId&&!state.pending?'':'none';
  const refresh=document.getElementById('ac-reload-btn');if(refresh)refresh.style.display=state.conflict?'':'none';
  const status=document.getElementById('ac-save-status');
  if(status){status.textContent=state.message||'';status.style.color=state.error?'var(--accent)':'var(--muted)';}
}
function openClientModal(clientId){
  captureClientModalDraft();
  const auth=assignmentSession();
  for(const [key,draft] of clientModalDrafts)if(!assignmentSessionCurrent(draft.auth))clientModalDrafts.delete(key);
  const c=clientId?CL.find(x=>x.id===clientId):null;
  if(clientId&&!c){notify('Nie znaleziono klienta');return;}
  const key=JSON.stringify([auth.uid,auth.generation,clientId||'new']);
  let state=clientModalDrafts.get(key);
  if(state&&state.saved&&!state.pending&&(state.editId||state.acknowledged)){clientModalDrafts.delete(key);state=null;}
  if(!state){
    const base=c?JSON.parse(JSON.stringify(c)):null;
    state={auth,key,editId:clientId||null,base,operation:{auth,edit:!!clientId,base},fields:c?{...base,injuries:typeof clientInjuriesText==='function'?clientInjuriesText(c):(c.injuries||'')}:{gender:'M',goal:'masa',level:'poczatkujacy',trainingFreq:3,activityLevel:'moderate',preferredWeekdays:[1,3,5]}};
    clientModalDrafts.set(key,state);
  }
  state.open=true;window._clientModalState=state;window._editingClientId=state.editId;
  const titleEl=document.querySelector('#m-client .modal-title');
  if(titleEl)titleEl.textContent=state.editId?'EDYTUJ KLIENTA':'NOWY KLIENT';
  for(const [field,id] of Object.entries(clientModalFieldIds)){
    const el=document.getElementById(id);if(el)el.value=state.fields[field]??'';
  }
  const gender=document.getElementById('ac-gender');if(gender)gender.value=(typeof normalizeClientGender==='function'?normalizeClientGender(state.fields.gender):state.fields.gender)||'M';
  if(typeof initPriorSportsForm==='function')initPriorSportsForm('ac',state.fields.priorSports||[],state.fields.additional_activities||[]);
  if(typeof initPhysiquePriorityForm==='function')initPhysiquePriorityForm('ac',state.fields.physiquePriority||[]);
  if(typeof initPreferredWeekdaysForm==='function')initPreferredWeekdaysForm('ac',state.fields.preferredWeekdays||[]);
  // Do not call the generic New Client entry point again: it used to clear the edit ID.
  if(!state.displayBase)state.displayBase=clientModalFields();
  document.getElementById('m-client').classList.add('show');
  renderClientModalSaveState(state);
}
function startNewClientModalDraft(){
  const state=window._clientModalState;
  if(!state||!clientModalIsCurrent(state)||!state.saved||state.pending)return;
  clientModalDrafts.delete(state.key);openClientModal();
}
function reloadClientModalDraft(){
  const state=window._clientModalState;
  if(!state||!clientModalIsCurrent(state)||!state.conflict||state.pending)return;
  const remote=state.conflict;
  try{assertAssignmentSession(state.auth,remote);}catch(error){notify(error.message);return;}
  state.base=JSON.parse(JSON.stringify(remote));state.fields={...state.base,injuries:typeof clientInjuriesText==='function'?clientInjuriesText(state.base):(state.base.injuries||'')};
  state.operation={auth:state.auth,edit:true,base:state.base};
  state.candidate=null;state.error=false;state.conflict=null;state.displayBase=null;
  state.message='Wczytano aktualne dane. Wprowadź i zapisz swoje zmiany.';
  state.open=false;openClientModal(state.editId);
}
window.openClientModal=openClientModal;
window.quickEditClient=quickEditClient;
window.captureClientModalDraft=captureClientModalDraft;
window.clearClientModalDrafts=clearClientModalDrafts;
window.startNewClientModalDraft=startNewClientModalDraft;
window.reloadClientModalDraft=reloadClientModalDraft;

async function saveClient(){
  const state=window._clientModalState;
  if(!state||!clientModalIsCurrent(state)||state.pending||state.saved||state.conflict)return;
  if(!state.candidate){
    const fields=clientModalFields(),name=fields.name.trim();
    if(!name){notify('Wpisz imię!');return;}
    const email=typeof normalizeClientEmail==='function'?normalizeClientEmail(fields.email):fields.email.trim().toLowerCase();
    if(!clientEmailValid(email)){notify('Podaj prawidłowy e-mail — bez niego klient nie zaloguje się do aplikacji.');return;}
    try{if(!assignmentSessionCurrent(state.auth))throw new Error('Zaloguj się ponownie przed zapisem.');
      if(state.editId)assertAssignmentSession(state.auth,CL.find(c=>c.id===state.editId));
    }catch(error){notify(error.message);return;}
    const freq=typeof normalizeTrainingFreq==='function'?normalizeTrainingFreq(fields.trainingFreq):parseInt(fields.trainingFreq,10);
    const values={...fields,name,email,age:+fields.age||0,weight:+fields.weight||0,height:+fields.height||0,
      gender:(typeof normalizeClientGender==='function'?normalizeClientGender(fields.gender):fields.gender)||'M',trainingFreq:freq||(state.editId?null:3)};
    if(state.editId){
      for(const key of Object.keys(values)){
        if(JSON.stringify(fields[key])===JSON.stringify(state.displayBase[key])){
          if(Object.prototype.hasOwnProperty.call(state.base,key))values[key]=state.base[key];
          else delete values[key];
        }
      }
    }
    state.fields=fields;
    state.candidate=state.editId?{...state.base,...values}:{...values,
      id:'c_'+crypto.randomUUID(),trainerId:state.auth.uid,status:'active',
      joinDate:new Date().toISOString().split('T')[0],createdAt:new Date().toISOString(),
      onboardingFlow:((window.SETTINGS||{}).onboarding||{}).defaultFlow||'standard'};
  }
  state.pending=true;state.error=false;state.message='Czekamy na potwierdzenie zapisu klienta.';
  renderClientModalSaveState(state);
  try{
    const saved=await saveClientCardConfirmed(state.candidate,state.operation);
    if(!assignmentSessionCurrent(state.auth))return;
    assertAssignmentSession(state.auth,saved);
    state.saved=true;
    let c=CL.find(x=>x.id===saved.id);
    if(state.editId){
      if(!c)throw new Error('Klient został usunięty podczas zapisu.');
      assertAssignmentSession(state.auth,c);
    }
    if(c)Object.assign(c,saved);else{c=saved;CL.push(c);}
    state.message='Klient '+c.name+' zapisany.';
    if(clientModalIsCurrent(state)){
      window._aplLastClientId=c.id;
      if(typeof aplRefreshFromSavedClient==='function')try{aplRefreshFromSavedClient(c.id);}catch(e){}
    }
    if(state.editId){
      try{if(typeof syncClientNameCache==='function')syncClientNameCache(c.id,c.name);}catch(e){}
    }
    try{renderAll();}catch(e){try{renderClients();}catch(e2){}}
    if(state.editId){
      if(typeof cpClientId!=='undefined'&&cpClientId===c.id){
        try{document.getElementById('cp-name').textContent=c.name;}catch(e){}
        if(clientModalIsCurrent(state)&&typeof cpTab!=='undefined'&&cpTab==='overview'&&!window._cpEditingClientId){
          try{renderCPOverview(c);}catch(e){}
        }
      }
      notify('✓ Zaktualizowano: '+c.name);
      if(clientModalIsCurrent(state)){
        state.acknowledged=true;closeM('m-client');
        if(window._onboardResumeAfterEdit===c.id){window._onboardResumeAfterEdit=null;if(typeof maybeResumeOnboard==='function')maybeResumeOnboard(c.id);}
      }
      return;
    }
    state.message='Klient '+c.name+' zapisany. Uruchamiam start współpracy…';
    renderClientModalSaveState(state);
    const result=await assignClientPipeline(c,{persist:false,runFlow:true,schedule:true,notify:true,fireEvent:true});
    if(!assignmentSessionCurrent(state.auth))return;
    if(!result.ok)state.message='Klient '+c.name+' zapisany. Start współpracy wymaga dokończenia w checkliście: '+(result.error||'Spróbuj ponownie.');
    else if(result.calendar&&result.calendar.status==='error')state.message='Klient i plan zapisani. Kalendarz wymaga ponowienia w checkliście: '+result.calendar.error;
    else state.message='✅ Klient '+c.name+' zapisany!';
    notify(state.message);
    if(clientModalIsCurrent(state)){
      state.acknowledged=!!result.ok;closeM('m-client');
      if(typeof openClientOnboardChecklist==='function')openClientOnboardChecklist(c.id);
    }
  }catch(error){
    if(!assignmentSessionCurrent(state.auth))return;
    state.error=true;
    state.conflict=state.editId&&error&&error.code==='client-card-conflict'?error.remote:null;
    state.message=state.saved?(state.editId?'Edycja zapisana, ale klient jest teraz niedostępny. Odśwież listę klientów.':'Klient zapisany. Dokończ start współpracy w jego checkliście.'):
      state.conflict?'Dane klienta zmieniły się podczas edycji. Wczytaj aktualne dane i nanieś zmiany ponownie.':
      'Nie potwierdzono zapisu. Dane formularza zachowano. Ponów zapis. '+(error?.message||'');
    notify(state.message);
  }finally{
    state.pending=false;
    if(clientModalIsCurrent(state))renderClientModalSaveState(state);
  }
}

function getClientOnboard(c){
  c=clientForOnboardSkip(c);
  if(typeof clientOnboardStatus==='function')return clientOnboardStatus(c);
  if(!c)return{invite:false,plan:false,session:false,baseline:false,schedule:false,calendar:false,package:false,done:0,total:6,complete:true,next:null,missing:[],missingLabels:[]};
  const invite=!!(c.inviteSent||c.appInvited||c.inviteSentAt||c.inviteSkipped);
  const plan=PL.some(p=>p.clientId===c.id);
  const session=SE.some(s=>s.clientId===c.id);
  const baseline=typeof clientHasBaseline==='function'?clientHasBaseline(c.id):!!(c.baselineDone);
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

const onboardSkipStates=new Map();
function getOnboardSkipState(clientId,field){
  const auth=assignmentSession();
  return onboardSkipStates.get(JSON.stringify([auth.uid,auth.generation,clientId,field]));
}
function clientForOnboardSkip(c){
  if(!c)return c;
  let result=c;
  for(const field of ['inviteSkipped','packageSkipped']){
    const state=getOnboardSkipState(c.id,field);
    if(state&&!state.saved&&!state.markerBefore&&(state.pending||state.error)){
      if(result===c)result={...c};delete result[field];
    }
  }
  return result;
}
function renderOnboardSkipState(clientId){
  document.querySelectorAll('button[data-onboard-skip-client]').forEach(button=>{
    if(button.getAttribute('data-onboard-skip-client')!==clientId)return;
    const state=getOnboardSkipState(clientId,button.getAttribute('data-onboard-skip-field'));
    button.disabled=!!state?.pending;
    if(button.getAttribute('data-onboard-skip-action')==='skip')button.textContent=state?.pending?'Zapisuję…':state?.error?'Ponów pominięcie':'Pomiń';
  });
  document.querySelectorAll('[data-onboard-skip-status]').forEach(el=>{
    if(el.getAttribute('data-onboard-skip-client')!==clientId)return;
    const state=getOnboardSkipState(clientId,el.getAttribute('data-onboard-skip-status'));
    el.textContent=state?.message||'';el.hidden=!el.textContent;el.style.color=state?.error?'var(--accent)':'var(--muted)';
  });
  if(typeof renderInviteSkipState==='function')renderInviteSkipState(clientId);
}
function clearOnboardSkipStates(){
  onboardSkipStates.clear();
  document.querySelectorAll('[data-onboard-skip-status]').forEach(el=>{el.textContent='';el.hidden=true;});
  document.querySelectorAll('button[data-onboard-skip-client]').forEach(button=>{button.disabled=false;});
  if(typeof clearInviteSkipView==='function')clearInviteSkipView();
}
function saveOnboardSkip(clientId,field){
  if(!['inviteSkipped','packageSkipped'].includes(field))return Promise.resolve(false);
  const auth=assignmentSession(),key=JSON.stringify([auth.uid,auth.generation,clientId,field]);
  for(const [storedKey,state] of onboardSkipStates)if(!assignmentSessionCurrent(state.auth))onboardSkipStates.delete(storedKey);
  let state=onboardSkipStates.get(key);
  if(state?.pending)return state.promise;
  const c=CL.find(x=>x.id===clientId);
  try{
    assertAssignmentSession(auth,c);
    if(state&&(c._fbId||c.id)!==(state.candidate._fbId||state.candidate.id))throw new Error('Identyfikator klienta zmienił się. Otwórz ponownie checklistę.');
  }catch(error){if(typeof notify==='function')notify(error.message);return Promise.resolve(false);}
  if(state?.saved)return Promise.resolve(true);
  if(!state){
    const snapshot=onboardScheduleFreeze(onboardScheduleClone({...c,[field]:true}));
    state={auth:onboardScheduleFreeze({...auth}),clientId,field,key,candidate:snapshot,markerBefore:!!c[field]};
    state.operation={auth:state.auth};onboardSkipStates.set(key,state);
  }
  state.pending=true;state.error=false;state.message='Czekamy na potwierdzenie pominięcia.';
  if(window._onboardClientId===clientId&&typeof renderClientOnboardChecklist==='function')try{renderClientOnboardChecklist();}catch(e){}
  renderOnboardSkipState(clientId);
  state.promise=Promise.resolve().then(async()=>{
    try{
      const saved=await saveClientOnboardSkipConfirmed(state.candidate,field,state.operation);
      if(!assignmentSessionCurrent(state.auth))return false;
      assertAssignmentSession(state.auth,saved);
      if(saved.id!==clientId||(saved._fbId||saved.id)!==(state.candidate._fbId||state.candidate.id)||saved[field]!==true)throw new Error('Nie można potwierdzić pominięcia dla tego klienta.');
      state.acknowledged=true;
      const local=CL.find(x=>x.id===clientId);assertAssignmentSession(state.auth,local);
      if((local._fbId||local.id)!==(state.candidate._fbId||state.candidate.id))throw new Error('Identyfikator klienta zmienił się podczas zapisu.');
      local[field]=true;state.saved=true;
      state.message=(field==='inviteSkipped'?'Zaproszenie':'Pakiet')+' klienta '+(saved.name||state.candidate.name||clientId)+' pominięte.';
      if(window._onboardClientId===clientId&&typeof renderClientOnboardChecklist==='function')try{renderClientOnboardChecklist();}catch(e){}
      if(typeof renderDash==='function')try{renderDash();}catch(e){}
      if(typeof renderClients==='function')try{renderClients();}catch(e){}
      if(typeof notify==='function')notify(state.message);
      return true;
    }catch(error){
      if(!assignmentSessionCurrent(state.auth))return false;
      state.error=true;state.message=state.acknowledged?'Pominięcie zapisane, ale klient jest teraz niedostępny. Odśwież listę klientów.':
        'Nie potwierdzono pominięcia. Ponów zapis. '+(error?.message||'');
      if(window._onboardClientId===clientId&&typeof renderClientOnboardChecklist==='function')try{renderClientOnboardChecklist();}catch(e){}
      if(typeof notify==='function')notify(state.message);
      return false;
    }finally{state.pending=false;state.promise=null;if(assignmentSessionCurrent(state.auth))renderOnboardSkipState(clientId);}
  });
  return state.promise;
}
function skipClientInvite(clientId){return saveOnboardSkip(clientId,'inviteSkipped');}
window.skipClientInvite=skipClientInvite;
window.getOnboardSkipState=getOnboardSkipState;
window.clientForOnboardSkip=clientForOnboardSkip;
window.renderOnboardSkipState=renderOnboardSkipState;
window.clearOnboardSkipStates=clearOnboardSkipStates;

function clientNextStartStep(c){
  if(!c||c.status==='archived'||typeof clientOnboardStatus!=='function')return null;
  const st=clientOnboardStatus(c);
  if(!st||st.complete)return null;
  const intake=typeof clientIntakeFormState==='function'?clientIntakeFormState(c.id):null;
  const steps={
    invite:{label:'Zaproś klienta',why:'Zaproszenie daje klientowi dostęp do ankiety i przypisanych treningów.'},
    intake:{label:intake&&intake.pending?'Sprawdź ankietę':'Przygotuj ankietę',why:intake&&intake.pending?'Ankieta czeka na odpowiedź klienta. Sprawdź jej status przed przygotowaniem planu.':'Zbierz cel, doświadczenie i ograniczenia klienta przed przygotowaniem planu.'},
    baseline:{label:'Dodaj pomiary',why:'Pomiary początkowe pozwolą później porównać wyniki klienta.'},
    schedule:{label:'Ustal dni treningowe',why:'Dopasuj harmonogram do czasu, którym klient rzeczywiście dysponuje.'},
    plan:{label:'Przygotuj plan',why:'Wykorzystaj ankietę i pomiary. Przed zapisaniem sprawdź ograniczenia klienta.'},
    calendar:{label:'Zaplanuj terminy',why:'Przypisany plan potrzebuje terminów, żeby klient wiedział, kiedy trenować.'},
    package:{label:'Ustal rozliczenie',why:'Przypisz pakiet lub pomiń ten krok, jeśli rozliczacie się inaczej.'}
  };
  const step=steps[st.next];
  return step?{...step,key:st.next,done:st.done,total:st.total}:null;
}
function openClientNextStartStep(clientId){
  const c=(window.CL||[]).find(x=>x.id===clientId);
  const step=clientNextStartStep(c);
  if(!step)return;
  if(step.key==='invite')return openInviteFromOnboard(clientId);
  if(step.key==='intake'){
    const intake=typeof clientIntakeFormState==='function'?clientIntakeFormState(clientId):null;
    return intake&&intake.pending?openClientProfileFromOnboard(clientId,'forms'):openFormsLibraryFromOnboard(clientId);
  }
  if(step.key==='baseline')return openClientBaselineModal(clientId,true);
  if(step.key==='schedule')return openClientScheduleFromOnboard(clientId);
  if(step.key==='plan')return openAiPlanForClient(clientId,true);
  // Calendar and billing require a choice; opening the checklist does not create entries.
  return openClientOnboardChecklist(clientId);
}
window.clientNextStartStep=clientNextStartStep;
window.openClientNextStartStep=openClientNextStartStep;

function openInviteFromOnboard(clientId){
  if(window._onboardResumeTimer){clearTimeout(window._onboardResumeTimer);window._onboardResumeTimer=null;}
  window._onboardResumeAfterInvite=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  if(typeof openInviteModal==='function')openInviteModal(clientId);
}
window.openInviteFromOnboard=openInviteFromOnboard;

function openFormsLibraryFromOnboard(clientId){
  window._onboardResumeAfterForms=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  if(typeof closeClientProfile==='function')closeClientProfile();
  goTo('forms');
  setTimeout(()=>{
    const cf=document.getElementById('form-client-filter');
    if(cf)cf.value=clientId;
    if(typeof setFormNav==='function')setFormNav('wstepna');
    else if(typeof renderForms==='function')renderForms();
    if(typeof renderOnboardFormsBanner==='function')renderOnboardFormsBanner();
    if(typeof openFormDetail==='function')openFormDetail('df1');
  },80);
}
window.openFormsLibraryFromOnboard=openFormsLibraryFromOnboard;

function openClientProfileFromOnboard(clientId,tab){
  window._onboardResumeAfterProfile=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  if(typeof openClientProfile==='function')openClientProfile(clientId,{tab:tab||'forms',fromOnboard:true});
}
window.openClientProfileFromOnboard=openClientProfileFromOnboard;

function openLiveFromOnboard(clientId,clientName){
  window._onboardResumeAfterLive=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  if(typeof liveSetPendingClient==='function')liveSetPendingClient(clientId,{clientName:clientName||''});
  goTo('live');
  if(typeof renderOnboardLiveBanner==='function')renderOnboardLiveBanner();
}
function renderOnboardLiveBanner(){
  const bar=document.getElementById('live-onboard-banner');
  if(!bar)return;
  const cid=window._onboardResumeAfterLive;
  const c=cid&&(window.CL||[]).find(x=>x.id===cid);
  if(!c){bar.style.display='none';bar.innerHTML='';return;}
  const esc=typeof escHtml==='function'?escHtml:s=>String(s||'');
  bar.style.display='flex';
  bar.innerHTML='<span>Start współpracy: <b>'+esc(c.name)+'</b> — sesja Live zalicza kalendarz. Albo wróć i wrzuć plan.</span>'
    +'<button type="button" class="btn btn-primary btn-sm" onclick="resumeOnboardFromLive()">Wróć do checklisty</button>';
}
function resumeOnboardFromLive(){
  const cid=window._onboardResumeAfterLive;
  window._onboardResumeAfterLive=null;
  if(typeof renderOnboardLiveBanner==='function')renderOnboardLiveBanner();
  if(cid&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);
}
window.openLiveFromOnboard=openLiveFromOnboard;
window.renderOnboardLiveBanner=renderOnboardLiveBanner;
window.resumeOnboardFromLive=resumeOnboardFromLive;

function renderOnboardAplBanner(){
  const bar=document.getElementById('apl-onboard-banner');
  if(!bar)return;
  const cid=window._onboardResumeAfterApl;
  const c=cid&&(window.CL||[]).find(x=>x.id===cid);
  if(!c){bar.style.display='none';bar.innerHTML='';return;}
  const esc=typeof escHtml==='function'?escHtml:s=>String(s||'');
  bar.style.display='flex';
  bar.innerHTML='<span>Start współpracy: <b>'+esc(c.name)+'</b> — wygeneruj plan albo wróć do checklisty.</span>'
    +'<button type="button" class="btn btn-primary btn-sm" onclick="resumeOnboardFromApl()">Wróć do checklisty</button>';
}
function resumeOnboardFromApl(){
  const cid=window._onboardResumeAfterApl;
  if(cid&&typeof aplLastPlan!=='undefined'&&aplLastPlan&&typeof clientHasAssignedPlan==='function'&&!clientHasAssignedPlan(cid)&&typeof aplSavePlan==='function'){
    const sel=document.getElementById('apl-client');
    if(sel)sel.value=cid;
    try{aplSavePlan();return;}catch(e){console.warn('onboard apl auto-save',e);}
  }
  window._onboardResumeAfterApl=null;
  if(typeof renderOnboardAplBanner==='function')renderOnboardAplBanner();
  if(cid&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);
}
function renderOnboardBuilderBanner(){
  const bar=document.getElementById('builder-onboard-banner');
  if(!bar)return;
  const cid=window._onboardResumeAfterBuilder;
  const c=cid&&(window.CL||[]).find(x=>x.id===cid);
  if(!c){bar.style.display='none';bar.innerHTML='';return;}
  const esc=typeof escHtml==='function'?escHtml:s=>String(s||'');
  bar.style.display='flex';
  bar.innerHTML='<span>Start współpracy: <b>'+esc(c.name)+'</b> — zapisz plan albo wróć do checklisty.</span>'
    +'<button type="button" class="btn btn-primary btn-sm" onclick="resumeOnboardFromBuilder()">Wróć do checklisty</button>';
}
function resumeOnboardFromBuilder(){
  const cid=window._onboardResumeAfterBuilder;
  window._onboardResumeAfterBuilder=null;
  if(typeof renderOnboardBuilderBanner==='function')renderOnboardBuilderBanner();
  if(cid&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);
}
function builderLeaveToCaller(opts){
  opts=opts||{};
  if(window._onboardResumeAfterBuilder&&!opts.saved){
    resumeOnboardFromBuilder();
    return;
  }
  const cid=window._builderReturnClientId;
  const tab=window._builderReturnTab||'plan';
  window._builderReturnClientId=null;
  window._builderReturnTab=null;
  if(cid&&typeof openClientProfile==='function'){
    goTo('clients');
    openClientProfile(cid,{tab:tab});
    return;
  }
  goTo(window._builderBack||'clients');
}
function builderGoBack(){
  builderLeaveToCaller();
}
window.renderOnboardAplBanner=renderOnboardAplBanner;
window.resumeOnboardFromApl=resumeOnboardFromApl;
window.renderOnboardBuilderBanner=renderOnboardBuilderBanner;
window.resumeOnboardFromBuilder=resumeOnboardFromBuilder;
window.builderGoBack=builderGoBack;
window.builderLeaveToCaller=builderLeaveToCaller;

function skipClientPackage(clientId){return saveOnboardSkip(clientId,'packageSkipped');}
window.skipClientPackage=skipClientPackage;

function openPackageForClient(clientId){
  window._packageOpenClient=clientId;
  window._onboardResumeAfterPackage=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  const pkgEl=document.getElementById('pkg-client');
  if(pkgEl){
    const list=(window.CL||[]).filter(c=>c&&c.status!=='archived');
    if(clientId&&!list.some(c=>c.id===clientId)){
      const extra=(window.CL||[]).find(c=>c&&c.id===clientId);
      if(extra)list.push(extra);
    }
    pkgEl.innerHTML=list.map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.name||c.email||c.id)+'</option>').join('')
      ||(clientId?'<option value="'+escHtml(clientId)+'">'+escHtml(clientId)+'</option>':'');
    pkgEl.value=clientId;
  }
  const pkgDate=document.getElementById('pkg-date');
  if(pkgDate&&!pkgDate.value)pkgDate.value=new Date().toISOString().split('T')[0];
  const paySt=document.getElementById('pkg-pay-status');
  if(paySt&&!paySt.value)paySt.value='pending';
  const bar=document.getElementById('pkg-onboard-banner');
  if(bar){
    const c=(window.CL||[]).find(x=>x&&x.id===clientId);
    const esc=typeof escHtml==='function'?escHtml:s=>String(s||'');
    bar.style.display='flex';
    bar.innerHTML='<span>Start współpracy: <b>'+esc(c&&c.name||'')+'</b> — zapisz pakiet albo wróć do checklisty.</span>'
      +'<button type="button" class="btn btn-primary btn-sm" onclick="closePackageModal()">Wróć do checklisty</button>';
  }
  openM('m-package');
}
function closePackageModal(){
  if(typeof closeM==='function')closeM('m-package');
  const bar=document.getElementById('pkg-onboard-banner');
  if(bar){bar.style.display='none';bar.innerHTML='';}
  const cid=window._onboardResumeAfterPackage;
  window._onboardResumeAfterPackage=null;
  if(cid&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);
}
function clearPackageOnboardBanner(){
  const bar=document.getElementById('pkg-onboard-banner');
  if(bar){bar.style.display='none';bar.innerHTML='';}
}
window.openPackageForClient=openPackageForClient;
window.closePackageModal=closePackageModal;
window.clearPackageOnboardBanner=clearPackageOnboardBanner;

function clientPendingPackage(clientId){
  return(window.PACKAGES||[]).find(p=>p&&p.clientId===clientId&&p.payStatus==='pending'&&!p.paymentRequestedAt)||null;
}
window.clientPendingPackage=clientPendingPackage;

function openAiPlanForClient(clientId,fromOnboard){
  window._onboardResumeAfterApl=fromOnboard?clientId:null;
  if(fromOnboard&&typeof closeM==='function')closeM('m-client-onboard');
  if(typeof closeClientProfile==='function')closeClientProfile();
  window._aplPrefillClientId=clientId;
  goTo('aiplangen');
  setTimeout(()=>{
    const sel=document.getElementById('apl-client');
    if(sel){
      sel.value=clientId;
      if(typeof aplFillFromClient==='function')aplFillFromClient();
    }
    if(typeof renderOnboardAplBanner==='function')renderOnboardAplBanner();
  },200);
}
window.openAiPlanForClient=openAiPlanForClient;

function openBuilderForClient(clientId,fromOnboard){
  window._builderBack='clients';
  window._onboardResumeAfterBuilder=fromOnboard?clientId:null;
  goTo('builder');
  const sel=document.getElementById('b-client');
  if(sel){
    sel.value=clientId;
    if(typeof updatePeriod==='function')updatePeriod();
  }
  if(typeof renderOnboardBuilderBanner==='function')renderOnboardBuilderBanner();
}
window.openBuilderForClient=openBuilderForClient;

function openNewPlanPicker(){
  let m=document.getElementById('m-new-plan');
  if(!m){
    m=document.createElement('div');
    m.id='m-new-plan';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:440px;">
      <div class="modal-hdr"><div class="modal-title">NOWY PLAN</div><button class="modal-close" onclick="closeM('m-new-plan')">×</button></div>
      <div class="modal-body">
        <div class="form-field"><label class="form-lbl">Klient</label>
          <select class="form-select" id="np-client"></select>
        </div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5;">Kreator otworzy się z wybranym podopiecznym. Albo wklej gotowy tydzień z biblioteki.</div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeM('m-new-plan')">Anuluj</button><button class="btn btn-ghost" onclick="closeM('m-new-plan');goTo('templates')">📋 Gotowy tydzień</button><button class="btn btn-primary" onclick="saveNewPlanPicker()">Otwórz kreator</button></div>
    </div>`;
    document.body.appendChild(m);
  }
  const sel=document.getElementById('np-client');
  const list=(window.CL||[]).filter(c=>c&&c.status!=='archived');
  if(sel)sel.innerHTML=list.length?list.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join(''):'<option value="">Brak klientów</option>';
  openM('m-new-plan');
}
function saveNewPlanPicker(){
  const cid=(document.getElementById('np-client')||{}).value;
  closeM('m-new-plan');
  if(!cid){if(typeof notify==='function')notify('Najpierw dodaj klienta');openM('m-client');return;}
  openBuilderForClient(cid);
}
window.openNewPlanPicker=openNewPlanPicker;
window.saveNewPlanPicker=saveNewPlanPicker;

function openClientOnboardChecklist(clientId){
  if(window._onboardResumeTimer){clearTimeout(window._onboardResumeTimer);window._onboardResumeTimer=null;}
  window._onboardClientId=clientId;
  renderClientOnboardChecklist();
  openM('m-client-onboard');
}

function renderClientOnboardChecklist(){
  const id=window._onboardClientId;
  const c=CL.find(x=>x.id===id);
  const el=document.getElementById('client-onboard-steps');
  if(!el||!c)return;
  const st={...getClientOnboard(c)};
  const calendarState=getOnboardCalendarState(id);
  // A local listener may emit before the write acknowledgement. Keep this action unconfirmed.
  if(calendarState&&calendarState.operation&&!calendarState.calendarBefore&&st.calendar){
    st.calendar=false;st.done=Math.max(0,st.done-1);st.complete=false;
  }
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
  const intake=typeof clientIntakeFormState==='function'?clientIntakeFormState(id):null;
  const steps=[
    {skipField:'inviteSkipped',done:st.invite,icon:'📱',title:'Wyślij zaproszenie',
      desc:st.invite&&c.inviteSkipped&&!(c.inviteSent||c.appInvited||c.inviteSentAt||c.appJoined)
        ?'Zaproszenie pominięte — możesz wysłać je później.'
        :st.invite&&!c.appJoined
        ?'Checklistę oznaczono, ale klient dostanie link dopiero gdy wyślesz e-mail (Gmail) albo WhatsApp — Inbox w apce zobaczy po zalogowaniu.'
        :'Link na e-mail klienta (Gmail). Inbox w apce zobaczy dopiero po pierwszym logowaniu.',
      action:`openInviteFromOnboard('${id}')`,cta:'✉️ E-mail',
      extra:st.invite?'':`<button type="button" class="btn btn-ghost btn-sm" data-onboard-skip-client="${escHtml(id)}" data-onboard-skip-field="inviteSkipped" data-onboard-skip-action="skip" onclick="skipClientInvite('${id}')">Pomiń</button>`,
      doneExtra:(st.invite&&!c.appJoined)?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="openInviteFromOnboard('${id}')">✉️ ${c.inviteSkipped&&!(c.inviteSent||c.appInvited||c.inviteSentAt)?'Wyślij zaproszenie':'Wyślij ponownie e-mailem'}</button></div>`:''},
    {done:!!(intake&&intake.filled),icon:'📋',title:'Ankieta wstępna',
      desc:intake&&intake.filled
        ?'Wypełniona — cel, ograniczenia i preferencje są dostępne w profilu oraz generatorze planu.'
        :intake&&intake.pending
          ?'Czeka na odpowiedź klienta. Plan przygotuj po sprawdzeniu celu i przeciwwskazań.'
          :'Zbierz cel, doświadczenie, możliwości i przeciwwskazania przed przygotowaniem planu.',
      action:intake&&intake.pending?`remindFormSend('${intake.pending.id}');renderClientOnboardChecklist()`:`sendClientIntakeForm('${id}');renderClientOnboardChecklist()`,
      cta:intake&&intake.pending?'Przypomnij klientowi':'Wyślij ankietę',
      extra:intake&&intake.pending
        ?`<button class="btn btn-ghost btn-sm" onclick="openClientProfileFromOnboard('${id}','forms')">Formularze</button>`
        :`<button class="btn btn-ghost btn-sm" onclick="openFormsLibraryFromOnboard('${id}')">Biblioteka formularzy</button>`},
    {done:st.baseline,icon:'⚖️',title:'Pomiary startowe (baseline)',desc:'Waga, %BF i obwody z datą — historia progresu',
      action:`openClientBaselineModal('${id}',true)`,cta:'Zapisz pomiary'},
    {done:st.schedule,icon:'📅',title:'Dni treningowe',desc:'Preferowane dni tygodnia — apka i auto-kalendarz z nich korzystają',
      action:`openClientScheduleFromOnboard('${id}')`,cta:'Ustaw dni'},
    {done:st.plan,icon:'📋',title:'Przypisz plan treningowy',
      desc:st.plan
        ?`Plan już przypisany${(()=>{const lp=typeof latestClientPlan==='function'?latestClientPlan(id):null;return lp&&lp.name?' (“'+lp.name+'”)':'';})()}. Możesz dodać kolejny — najnowszy trafia do kalendarza.`
        :'Najszybciej: generator AI z danymi klienta',
      action:`openAiPlanForClient('${id}',true)`,cta:'⚡ Plan AI',
      extra:st.plan?'':`<button class="btn btn-ghost btn-sm" onclick="openBuilderForClient('${id}',true)">Szablon / kreator</button>`},
    {key:'calendar',done:st.calendar,icon:'🗓',title:'Dodaj terminy do kalendarza',desc:'Dopełnij 4 tygodnie według planu. Istniejące treningi, zmiany terminów i pominięcia zostaną zachowane.',
      action:`scheduleClientPlanToCalendar('${id}')`,cta:'Dodaj terminy na 4 tygodnie',
      extra:st.calendar?'':`<button class="btn btn-ghost btn-sm" onclick="openLiveFromOnboard('${id}','${safeName}')">Trening Live</button>`,
      doneExtra:st.calendar?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><button type="button" class="btn btn-ghost btn-sm" data-onboard-calendar-client="${escHtml(id)}" data-onboard-calendar-label="Dopełnij terminy najnowszego planu" onclick="scheduleClientPlanToCalendar('${id}')">Dopełnij terminy najnowszego planu</button></div>`:''},
    {skipField:'packageSkipped',done:st.package,icon:'💳',title:'Pakiet / płatność',desc:'Przypisz pakiet sesji albo pomiń, jeśli rozliczacie się inaczej',
      action:`openPackageForClient('${id}')`,cta:'+ Pakiet',
      extra:st.package?'':`<button type="button" class="btn btn-ghost btn-sm" data-onboard-skip-client="${escHtml(id)}" data-onboard-skip-field="packageSkipped" data-onboard-skip-action="skip" onclick="skipClientPackage('${id}')">Pomiń</button>`,
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
  let formBlock='';
  if(intake&&!intake.filled&&!intake.pending&&intake.anyPending&&intake.anyPending.length){
      const p=intake.anyPending[0];
      formBlock=`<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid rgba(157,124,244,0.45);border-radius:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(157,124,244,0.18);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;margin-bottom:2px;">Formularz oczekuje</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${escHtml(p.formName||'Formularz')}${intake.anyPending.length>1?' · +'+(intake.anyPending.length-1):''}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="remindFormSend('${escHtml(p.id)}');renderClientOnboardChecklist()">Przypomnij</button>
            <button class="btn btn-ghost btn-sm" onclick="openClientProfileFromOnboard('${id}','forms')">Profil</button>
          </div>
        </div>
      </div>`;
  }
  el.innerHTML=formBlock+steps.map(s=>`
    <div ${s.key==='calendar'?'data-onboard-step="calendar"':''} style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid ${s.done?'var(--teal)':'var(--border)'};border-radius:10px;margin-bottom:8px;">
      <div style="width:32px;height:32px;border-radius:8px;background:${s.done?'rgba(62,207,178,0.18)':'var(--s2)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${s.done?'✓':s.icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${s.title}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:${(s.done&&!s.afterDone&&!s.doneExtra)||!s.done?'8px':'0'};">${s.desc}</div>
        ${s.done
          ?`<div style="font-size:10px;color:var(--teal);font-family:'DM Mono',monospace;margin-top:4px;">GOTOWE</div>${s.doneExtra||''}${s.afterDone||''}`
          :`<div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn btn-primary btn-sm" ${s.key==='calendar'?`data-onboard-calendar-client="${escHtml(id)}" data-onboard-calendar-label="${s.cta}"`:s.skipField?`data-onboard-skip-client="${escHtml(id)}" data-onboard-skip-field="${s.skipField}" data-onboard-skip-action="related"`:''} onclick="${s.action}">${s.cta}</button>${s.extra||''}</div>`}
        ${s.skipField?`<div data-onboard-skip-client="${escHtml(id)}" data-onboard-skip-status="${s.skipField}" role="status" aria-live="polite" hidden style="font-size:11px;line-height:1.5;margin-top:8px;"></div>`:''}
        ${s.key==='calendar'?`<div data-onboard-calendar-status="${escHtml(id)}" role="status" aria-live="polite" hidden style="font-size:11px;line-height:1.5;margin-top:8px;"></div>`:''}
      </div>
    </div>`).join('')+(st.complete?`<button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="closeM('m-client-onboard')">Gotowe — zamknij</button>`:'');
  renderOnboardCalendarState(id);
  renderOnboardSkipState(id);
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

// Schedule retries belong to one client and authenticated trainer session.
const onboardScheduleDrafts=new Map();
function onboardScheduleClone(value){
  if(Array.isArray(value))return value.map(onboardScheduleClone);
  if(value instanceof Date)return new Date(value.getTime());
  if(value&&typeof value==='object'&&value.constructor?.name==='Object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,onboardScheduleClone(item)]));
  return value;
}
function onboardScheduleFreeze(value){
  if(Array.isArray(value)||(value&&typeof value==='object'&&value.constructor?.name==='Object')){
    Object.values(value).forEach(onboardScheduleFreeze);Object.freeze(value);
  }
  return value;
}
function onboardScheduleOwnsModal(state){
  return !!state&&window._onboardScheduleState===state&&state.open&&assignmentSessionCurrent(state.auth)&&
    window._onboardScheduleClientId===state.clientId&&document.getElementById('m-onboard-schedule')?.classList.contains('show');
}
function onboardScheduleIsCurrent(state){
  return onboardScheduleOwnsModal(state)&&!document.querySelector('.modal-ov.show:not(#m-onboard-schedule)');
}
function captureOnboardScheduleDraft(){
  const state=window._onboardScheduleState;
  if(state&&state.open){
    if(!state.candidate&&window._onboardScheduleClientId===state.clientId&&typeof readPreferredWeekdaysFrom==='function')state.days=onboardScheduleClone(readPreferredWeekdaysFrom('ob-sched'));
    state.open=false;
  }
}
function clearOnboardScheduleDrafts(){
  onboardScheduleDrafts.clear();window._onboardScheduleState=null;
  window._onboardScheduleClientId=null;window._onboardResumeAfterSchedule=null;
  const modal=document.getElementById('m-onboard-schedule');if(modal)modal.classList.remove('show');
  const name=document.getElementById('ob-sched-name');if(name)name.textContent='';
  const bar=document.getElementById('sched-onboard-banner');if(bar){bar.style.display='none';bar.innerHTML='';}
  if(typeof initPreferredWeekdaysForm==='function')initPreferredWeekdaysForm('ob-sched',[]);
  const status=document.getElementById('ob-sched-save-status');if(status)status.textContent='';
}
function renderOnboardScheduleSaveState(state){
  if(!onboardScheduleOwnsModal(state))return;
  const days=document.getElementById('ob-sched-preferred-weekdays');
  if(days)days.querySelectorAll('button').forEach(button=>{button.disabled=!!state.candidate;});
  const save=document.getElementById('ob-sched-save-btn');
  if(save){save.disabled=!!(state.pending||state.saved||state.conflict);save.textContent=state.pending?'Zapisuję…':state.saved?'Zapisano':state.error?'Ponów zapis':'Zapisz dni';}
  const status=document.getElementById('ob-sched-save-status');if(status){status.textContent=state.message||'';status.style.color=state.error?'var(--accent)':'var(--muted)';}
  const reload=document.getElementById('ob-sched-reload-btn');if(reload){reload.hidden=!state.conflict;reload.disabled=!!state.pending;}
  const discard=document.getElementById('ob-sched-discard-btn');if(discard)discard.disabled=!!(state.pending||state.saved||(state.candidate&&!state.conflict));
}
function reloadOnboardScheduleDraft(){
  const state=window._onboardScheduleState;
  if(!onboardScheduleIsCurrent(state)||!state.conflict||state.pending)return;
  try{
    const local=CL.find(c=>c.id===state.clientId);
    assertAssignmentSession(state.auth,state.conflict);assertAssignmentSession(state.auth,local);
    if((state.conflict._fbId||state.conflict.id)!==(state.base._fbId||state.base.id))throw new Error('Identyfikator klienta zmienił się. Otwórz ponownie harmonogram.');
    if((local._fbId||local.id)!==(state.base._fbId||state.base.id))throw new Error('Identyfikator klienta zmienił się. Otwórz ponownie harmonogram.');
  }catch(error){state.error=true;state.message=error.message;renderOnboardScheduleSaveState(state);return;}
  state.base=onboardScheduleFreeze(onboardScheduleClone(state.conflict));
  state.days=onboardScheduleClone(state.base.preferredWeekdays?.length?state.base.preferredWeekdays:[1,3,5]);
  state.operation={auth:state.auth,edit:true,base:state.base};state.candidate=null;state.displayDays=null;state.conflict=null;state.error=false;
  state.message='Wczytano aktualne dane. Zaznacz i zapisz dni treningowe.';state.open=false;
  openClientScheduleFromOnboard(state.clientId);
}
function discardOnboardScheduleDraft(){
  const state=window._onboardScheduleState;
  if(!onboardScheduleIsCurrent(state)||state.pending||state.saved||(state.candidate&&!state.conflict))return;
  onboardScheduleDrafts.delete(state.key);
  closeScheduleOnboardModal();window._onboardScheduleState=null;
}
function openClientScheduleFromOnboard(clientId){
  const c=CL.find(x=>x.id===clientId),auth=assignmentSession();
  try{assertAssignmentSession(auth,c);}catch(error){if(typeof notify==='function')notify(error.message);return;}
  if(window._onboardResumeTimer){clearTimeout(window._onboardResumeTimer);window._onboardResumeTimer=null;}
  captureOnboardScheduleDraft();
  for(const [key,draft] of onboardScheduleDrafts)if(!assignmentSessionCurrent(draft.auth))onboardScheduleDrafts.delete(key);
  const key=JSON.stringify([auth.uid,auth.generation,clientId]);
  let state=onboardScheduleDrafts.get(key);
  if(state&&state.saved&&!state.pending){onboardScheduleDrafts.delete(key);state=null;}
  if(!state){
    const base=onboardScheduleFreeze(onboardScheduleClone(c));
    state={auth:onboardScheduleFreeze({...auth}),key,clientId,base,days:onboardScheduleClone(c.preferredWeekdays?.length?c.preferredWeekdays:[1,3,5])};
    state.operation={auth:state.auth,edit:true,base};onboardScheduleDrafts.set(key,state);
  }
  window._onboardScheduleState=state;state.open=true;
  window._onboardScheduleClientId=clientId;
  window._onboardResumeAfterSchedule=clientId;
  if(typeof closeM==='function')closeM('m-client-onboard');
  const nameEl=document.getElementById('ob-sched-name');
  if(nameEl)nameEl.textContent=state.base.name||'';
  if(typeof initPreferredWeekdaysForm==='function'){
    initPreferredWeekdaysForm('ob-sched',state.days);
  }
  if(!state.displayDays&&typeof readPreferredWeekdaysFrom==='function')state.displayDays=onboardScheduleClone(readPreferredWeekdaysFrom('ob-sched'));
  const bar=document.getElementById('sched-onboard-banner');
  if(bar){
    const esc=typeof escHtml==='function'?escHtml:s=>String(s||'');
    bar.style.display='flex';
    bar.innerHTML='<span>Start współpracy: <b>'+esc(c.name)+'</b> — zaznacz dni albo wróć do checklisty.</span>'
      +'<button type="button" class="btn btn-primary btn-sm" onclick="closeScheduleOnboardModal()">Wróć do checklisty</button>';
  }
  openM('m-onboard-schedule');
  renderOnboardScheduleSaveState(state);
}
function closeScheduleOnboardModal(){
  const state=window._onboardScheduleState;
  const cid=onboardScheduleIsCurrent(state)?state.clientId:null;
  captureOnboardScheduleDraft();
  if(typeof closeM==='function')closeM('m-onboard-schedule');
  const bar=document.getElementById('sched-onboard-banner');
  if(bar){bar.style.display='none';bar.innerHTML='';}
  window._onboardResumeAfterSchedule=null;window._onboardScheduleClientId=null;
  if(cid&&assignmentSessionCurrent(state.auth)){
    try{assertAssignmentSession(state.auth,CL.find(c=>c.id===cid));if(typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);}catch(error){}
  }
}
async function saveClientScheduleFromOnboard(){
  const state=window._onboardScheduleState;
  if(!onboardScheduleIsCurrent(state)||state.pending||state.saved||state.conflict)return;
  try{
    const local=CL.find(c=>c.id===state.clientId);assertAssignmentSession(state.auth,local);
    if((local._fbId||local.id)!==(state.base._fbId||state.base.id))throw new Error('Identyfikator klienta zmienił się. Otwórz ponownie harmonogram.');
    if(!state.candidate){
      if(typeof readPreferredWeekdaysFrom!=='function')throw new Error('Nie można odczytać dni treningowych. Odśwież aplikację.');
      const days=readPreferredWeekdaysFrom('ob-sched');
      if(!days.length)throw new Error('Wybierz przynajmniej jeden dzień');
      state.days=onboardScheduleClone(days);
      const untouched=state.base.preferredWeekdays?.length&&JSON.stringify(days)===JSON.stringify(state.displayDays);
      state.candidate=onboardScheduleFreeze({id:state.clientId,trainerId:state.auth.uid,
        ...(state.base._fbId?{_fbId:state.base._fbId}:{}),preferredWeekdays:onboardScheduleClone(untouched?state.base.preferredWeekdays:days)});
    }
  }catch(error){state.error=true;state.message=error.message;renderOnboardScheduleSaveState(state);if(typeof notify==='function')notify(state.message);return;}
  state.pending=true;state.error=false;state.message='Czekamy na potwierdzenie zapisu dni treningowych.';
  renderOnboardScheduleSaveState(state);
  try{
    const saved=await saveClientCardConfirmed(state.candidate,state.operation);
    if(!assignmentSessionCurrent(state.auth))return;
    assertAssignmentSession(state.auth,saved);
    if(saved.id!==state.clientId||(saved._fbId||saved.id)!==(state.base._fbId||state.base.id))throw new Error('Nie można potwierdzić identyfikatora zapisanego klienta.');
    state.saved=true;
    const c=CL.find(x=>x.id===state.clientId);assertAssignmentSession(state.auth,c);
    if((c._fbId||c.id)!==(state.base._fbId||state.base.id))throw new Error('Identyfikator klienta zmienił się podczas zapisu.');
    // Merge only the confirmed schedule; other local fields may have changed meanwhile.
    if(Object.prototype.hasOwnProperty.call(saved,'preferredWeekdays'))c.preferredWeekdays=onboardScheduleClone(saved.preferredWeekdays);
    if(saved.clientCardWriteId)c.clientCardWriteId=saved.clientCardWriteId;
    state.message='Dni treningowe klienta '+(saved.name||state.base.name||state.clientId)+' zapisane.';
    if(typeof renderDash==='function')try{renderDash();}catch(e){}
    if(typeof renderClients==='function')try{renderClients();}catch(e){}
    if(typeof notify==='function')notify(state.message);
    if(onboardScheduleIsCurrent(state))closeScheduleOnboardModal();
  }catch(error){
    if(!assignmentSessionCurrent(state.auth))return;
    state.error=true;state.conflict=error?.code==='client-card-conflict'&&error.remote?onboardScheduleClone(error.remote):null;
    state.message=state.saved?'Dni zapisane, ale klient jest teraz niedostępny. Odśwież listę klientów.':
      state.conflict?'Dni treningowe zmieniły się w innym oknie. Wczytaj aktualne dane i zaznacz dni ponownie.':
      'Nie potwierdzono zapisu. Wybrane dni zachowano. Ponów zapis. '+(error?.message||'');
    if(onboardScheduleIsCurrent(state)&&typeof notify==='function')notify(state.message);
  }finally{state.pending=false;if(onboardScheduleOwnsModal(state))renderOnboardScheduleSaveState(state);}
}
window.openClientScheduleFromOnboard=openClientScheduleFromOnboard;
window.closeScheduleOnboardModal=closeScheduleOnboardModal;
window.saveClientScheduleFromOnboard=saveClientScheduleFromOnboard;
window.captureOnboardScheduleDraft=captureOnboardScheduleDraft;
window.clearOnboardScheduleDrafts=clearOnboardScheduleDrafts;
window.reloadOnboardScheduleDraft=reloadOnboardScheduleDraft;
window.discardOnboardScheduleDraft=discardOnboardScheduleDraft;

function latestClientPlan(clientId){
  return(window.PL||[]).filter(p=>p&&p.clientId===clientId).slice().sort((a,b)=>{
    const ak=String(a.updatedAt||a.createdAt||a.id||'');
    const bk=String(b.updatedAt||b.createdAt||b.id||'');
    return bk.localeCompare(ak);
  })[0]||null;
}
// Calendar actions in Start współpracy are scoped to the current trainer session.
const onboardCalendarStates=new Map();
function onboardCalendarSession(){return {uid:window._uid,generation:window.tenantSessionGeneration||0};}
function onboardCalendarCurrent(auth){
  return !!auth.uid&&auth.uid===window._uid&&auth.generation===(window.tenantSessionGeneration||0)&&
    !window._clientAppMode&&!window._clientPreviewMode&&window._tenantDataReady===true&&
    (!window.tenantSessionIsCurrent||window.tenantSessionIsCurrent(auth));
}
function onboardCalendarKey(auth,cid){return JSON.stringify([auth.uid,auth.generation,cid]);}
function getOnboardCalendarState(cid){
  const auth=onboardCalendarSession();
  for(const [key,state] of onboardCalendarStates){
    if(state.auth.uid!==auth.uid||state.auth.generation!==auth.generation)onboardCalendarStates.delete(key);
  }
  return onboardCalendarStates.get(onboardCalendarKey(auth,cid));
}
function renderOnboardCalendarState(cid){
  const state=getOnboardCalendarState(cid);
  document.querySelectorAll('[data-onboard-calendar-client]').forEach(button=>{
    if(button.getAttribute('data-onboard-calendar-client')!==cid)return;
    button.disabled=!!(state&&state.pending);
    button.textContent=state&&state.pending?'Zapisywanie…':state&&state.error?'Ponów zapis terminów':button.getAttribute('data-onboard-calendar-label');
  });
  document.querySelectorAll('[data-onboard-calendar-status]').forEach(el=>{
    if(el.getAttribute('data-onboard-calendar-status')!==cid)return;
    el.textContent=state&&state.message||'';
    el.hidden=!el.textContent;
    el.style.color=state&&state.error?'var(--orange)':'var(--muted)';
  });
}
function scheduleClientPlanToCalendar(clientId){
  const cid=String(clientId||''),auth=onboardCalendarSession();
  let state=getOnboardCalendarState(cid);
  if(state&&state.pending)return state.promise;
  if(!state){
    state={auth,pending:false,error:false,message:'',operation:null};
    onboardCalendarStates.set(onboardCalendarKey(auth,cid),state);
  }
  try{
    if(!onboardCalendarCurrent(auth))throw new Error('Dane konta nie są gotowe. Otwórz ponownie profil klienta po zalogowaniu.');
    const client=(window.CL||[]).find(c=>c&&c.id===cid&&c.trainerId===auth.uid&&!c.archived&&!c.deleted&&c.status!=='archived');
    if(!client)throw new Error('Klient jest niedostępny. Odśwież listę klientów.');
    if(typeof window.refillCalendarConfirmed!=='function')throw new Error('Odśwież aplikację, aby wczytać moduł kalendarza.');
    if(!state.operation){
      const plan=(window.PL||[]).filter(p=>p&&p.clientId===cid&&p.trainerId===auth.uid&&!p.archived&&!p.deleted&&p.status!=='archived'&&
        (p.days||[]).some(d=>d&&!d.rest&&(d.exercises||[]).length))
        .sort((a,b)=>String(b.updatedAt||b.createdAt||b.id||'').localeCompare(String(a.updatedAt||a.createdAt||a.id||'')))[0];
      if(!plan)throw new Error('Najpierw przypisz klientowi plan z dniami treningowymi.');
      const preferred=typeof normalizePreferredWeekdays==='function'?normalizePreferredWeekdays(client.preferredWeekdays):(client.preferredWeekdays||[]);
      if(!preferred.length&&!confirm('Dodać terminy na 4 tygodnie według dni w planie? Preferowane dni klienta nie są jeszcze ustawione.'))return Promise.resolve({status:'cancelled'});
      state.operation={planId:plan.id,weeks:4};
      state.planName=plan.name||'Plan treningowy';
      state.calendarBefore=!!getClientOnboard(client).calendar;
    }
  }catch(error){
    const message=error&&error.message||'Nie można rozpocząć zapisu terminów.';
    state.error=true;state.message=message;
    renderOnboardCalendarState(cid);
    return Promise.resolve({status:'error',error:message});
  }
  state.pending=true;state.error=false;
  state.message='Sprawdzam terminy i zapisuję brakujące: '+state.planName+'. Poczekaj na potwierdzenie.';
  renderOnboardCalendarState(cid);
  // Start in a microtask so repeated clicks always receive the same Promise.
  state.promise=Promise.resolve().then(async()=>{
    try{
      if(!onboardCalendarCurrent(auth))throw new Error('Sesja logowania zmieniła się. Otwórz ponownie profil klienta.');
      const result=await window.refillCalendarConfirmed(cid,state.operation);
      if(!onboardCalendarCurrent(auth))return {status:'error',error:'Sesja logowania zmieniła się. Otwórz ponownie profil klienta.'};
      if(!result||!['saved','unchanged'].includes(result.status))throw new Error(result&&result.error||'Nie udało się potwierdzić zapisu terminów.');
      state.operation=null;state.error=false;
      state.message=result.added?'Potwierdzono zapis '+result.added+' treningów. Istniejące terminy zachowano.':'Kalendarz jest już uzupełniony. Istniejące terminy zachowano.';
      return result;
    }catch(error){
      const message=error&&error.code?'Nie udało się potwierdzić zapisu. Sprawdź połączenie i ponów zapis terminów.':error&&error.message||'Nie udało się potwierdzić zapisu terminów.';
      if(onboardCalendarCurrent(auth)){state.error=true;state.message=message;}
      return {status:'error',error:message};
    }finally{
      state.pending=false;
      const modal=document.getElementById('m-client-onboard');
      if(onboardCalendarCurrent(auth)&&window._onboardClientId===cid&&
        getOnboardCalendarState(cid)===state&&modal&&modal.classList.contains('show')){
        renderClientOnboardChecklist();
        if(!state.error&&!state.operation){
          if(typeof renderDash==='function')try{renderDash();}catch(e){}
          if(typeof renderClients==='function')try{renderClients();}catch(e){}
        }
      }
    }
  });
  return state.promise;
}
window.latestClientPlan=latestClientPlan;
window.scheduleClientPlanToCalendar=scheduleClientPlanToCalendar;

const baselineModalDrafts=new Map();
function baselineModalFields(){
  const g=id=>document.getElementById(id)?.value||'';
  return {date:g('bl-date'),weight:g('bl-weight'),bf:g('bl-bf'),
    circ:typeof collectBaselineCircFields==='function'?collectBaselineCircFields():{},notes:'Pomiar startowy (baseline)'};
}
function baselineModalIsCurrent(state){
  return window._baselineModalState===state&&state.open&&baselineSessionCurrent(state.auth)&&
    document.getElementById('m-baseline')?.classList.contains('show');
}
function renderBaselineSaveState(state){
  if(!baselineModalIsCurrent(state))return;
  document.querySelectorAll('#m-baseline input').forEach(el=>{el.disabled=!!state.operation.entries;});
  const btn=document.getElementById('bl-save-btn');
  if(btn){btn.disabled=!!(state.pending||state.saved);btn.textContent=state.saved?'Zapisano':state.pending?'Zapisuję…':state.error?'Ponów zapis':'Zapisz pomiary';}
  const next=document.getElementById('bl-new-btn');if(next)next.style.display=state.saved?'':'none';
  const status=document.getElementById('bl-save-status');
  if(status){status.textContent=state.saved?'Te pomiary zostały zapisane. Aby dodać nowy zestaw, wybierz „Dodaj kolejne pomiary”.':state.pending?'Czekamy na potwierdzenie zapisu.':state.error||'';status.style.color=state.error?'var(--accent)':'var(--muted)';}
}
function openClientBaselineModal(clientId,fromOnboard){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  const previous=window._baselineModalState;
  if(previous&&previous.open){if(!previous.operation.entries)previous.fields=baselineModalFields();previous.open=false;}
  const auth=baselineSession();
  for(const [key,draft] of baselineModalDrafts)if(!baselineSessionCurrent(draft.auth))baselineModalDrafts.delete(key);
  const key=JSON.stringify([auth.uid,auth.generation,clientId]);
  let state=baselineModalDrafts.get(key);
  if(!state){
    state={auth,clientId,operation:{},fields:{weight:c.weight||'',bf:'',circ:{},date:typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10)}};
    baselineModalDrafts.set(key,state);
  }
  state.open=true;state.resumeId=fromOnboard?clientId:null;
  window._baselineModalState=state;
  window._baselineClientId=clientId;
  window._onboardResumeAfterBaseline=state.resumeId;
  if(fromOnboard&&typeof closeM==='function')closeM('m-client-onboard');
  openM('m-baseline');
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null?v:'';};
  if(typeof renderBaselineCircFields==='function')renderBaselineCircFields();
  set('bl-weight',state.fields.weight);set('bl-bf',state.fields.bf);set('bl-date',state.fields.date);
  Object.entries(state.fields.circ||{}).forEach(([id,value])=>set('bl-circ-'+id,value));
  const title=document.getElementById('m-baseline-title');
  if(title)title.textContent='POMIARY STARTOWE — '+(c.name||'').toUpperCase();
  const bar=document.getElementById('bl-onboard-banner');
  if(bar){
    const esc=typeof escHtml==='function'?escHtml:s=>String(s||'');
    bar.style.display=fromOnboard?'flex':'none';
    bar.innerHTML=fromOnboard?'<span>Start współpracy: <b>'+esc(c.name)+'</b> — zapisz pomiary albo wróć do checklisty.</span>'
      +'<button type="button" class="btn btn-primary btn-sm" onclick="closeBaselineModal()">Wróć do checklisty</button>':'';
  }
  renderBaselineSaveState(state);
}
function startNewBaselineDraft(){
  const state=window._baselineModalState;
  if(!state||!state.saved||!baselineModalIsCurrent(state))return;
  baselineModalDrafts.delete(JSON.stringify([state.auth.uid,state.auth.generation,state.clientId]));
  openClientBaselineModal(state.clientId,!!state.resumeId);
}
function closeBaselineModal(){
  const state=window._baselineModalState;
  if(state){if(!state.operation.entries)state.fields=baselineModalFields();state.open=false;}
  if(typeof closeM==='function')closeM('m-baseline');
  const bar=document.getElementById('bl-onboard-banner');
  if(bar){bar.style.display='none';bar.innerHTML='';}
  const cid=state&&baselineSessionCurrent(state.auth)?state.resumeId:null;
  window._onboardResumeAfterBaseline=null;
  if(cid&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);
}
async function saveClientBaselineModal(){
  const state=window._baselineModalState;
  if(!state||!baselineModalIsCurrent(state)||state.pending||state.saved)return;
  if(!state.operation.entries)state.fields=baselineModalFields();
  state.pending=true;state.error='';renderBaselineSaveState(state);
  try{
    const request=saveClientBaselineConfirmed(state.clientId,state.fields,state.operation);
    renderBaselineSaveState(state);
    const created=await request;
    if(!created.length)throw new Error('Wpisz przynajmniej wagę, skład ciała lub obwód.');
    state.saved=true;
    const mass=created.find(e=>e.groupId==='mg1'),circ=created.find(e=>e.groupId==='mg2');
    state.fields={date:created[0].date,weight:mass?.values?.m1??'',bf:mass?.values?.m2??'',circ:{...(circ?.values||{})}};
    const client=(window.CL||[]).find(c=>c.id===state.clientId);
    notify('✓ Pomiary startowe zapisane'+(client&&client.name?' — '+client.name:''));
    if(typeof renderDash==='function')try{renderDash();}catch(e){}
    if(!baselineModalIsCurrent(state)){
      if(baselineSessionCurrent(state.auth)&&state.resumeId===window._onboardClientId&&
        document.getElementById('m-client-onboard')?.classList.contains('show')&&typeof renderClientOnboardChecklist==='function')
        renderClientOnboardChecklist();
      return;
    }
    const resumeId=state.resumeId;
    state.open=false;window._onboardResumeAfterBaseline=null;
    closeM('m-baseline');
    const bar=document.getElementById('bl-onboard-banner');if(bar){bar.style.display='none';bar.innerHTML='';}
    if(resumeId&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(resumeId);
    else if(typeof renderClientOnboardChecklist==='function'&&document.getElementById('m-client-onboard')?.classList.contains('show'))renderClientOnboardChecklist();
  }catch(error){
    state.error=(error&&error.message)||'Nie udało się potwierdzić zapisu. Ponów zapis.';
    if(state.operation.entries)state.error+=' Zachowaliśmy wartości do ponowienia.';
  }finally{state.pending=false;renderBaselineSaveState(state);}
}
window.openClientBaselineModal=openClientBaselineModal;
window.startNewBaselineDraft=startNewBaselineDraft;
window.closeBaselineModal=closeBaselineModal;
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
  Smolov:['Smolov T1','Smolov T2','Smolov T3','Smolov T4','Utrzymanie góry','Deload'],
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
  const circ=typeof normalizeRationaleMethod==='function'&&normalizeRationaleMethod(builderGetMethod())==='Obwodowy';
  if(circ){
    document.querySelectorAll('.builder-day').forEach(de=>{
      const cb=de.querySelector('.circ');
      if(cb&&!cb.checked){cb.checked=true;builderOnCircuitToggle(de.id);}
    });
  }
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
    weight:weight,
    clientId:cid||undefined,
    clientName:c.name||undefined
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
  builderRefreshMethodHint();
  if(typeof builderRefreshKbHits==='function')builderRefreshKbHits();
}
window.builderRefreshRationale=builderRefreshRationale;
window.builderEduCtx=builderEduCtx;

function builderKbTextForDay(dayEl){
  if(!dayEl)return '';
  const bits=[];
  bits.push((dayEl.querySelector('.builder-day-focus')||{}).value||'');
  dayEl.querySelectorAll('[data-f="name"]').forEach(inp=>{
    const name=(inp.value||'').trim();
    if(!name)return;
    bits.push(name);
    const ex=typeof libExerciseByName==='function'?libExerciseByName(name):null;
    if(ex)bits.push(ex.muscle||'',ex.cat||'');
  });
  return bits.join(' ');
}
function builderCollectKbTags(dayEl){
  const bits=[];
  const method=(document.getElementById('b-method')||{}).value||'';
  bits.push(method);
  if(dayEl)bits.push(builderKbTextForDay(dayEl));
  else document.querySelectorAll('#builder-days .builder-day').forEach(d=>bits.push(builderKbTextForDay(d)));
  const tags=typeof kbTagsFromText==='function'?kbTagsFromText(bits.join(' ')):[];
  ['mev','mav','rir','rpe','deload'].forEach(id=>{if(tags.indexOf(id)<0)tags.push(id);});
  if(/ppl|upper|fbw|full body/i.test(method)&&tags.indexOf('freq')<0)tags.push('freq');
  return typeof normalizeKbTags==='function'?normalizeKbTags(tags):tags;
}
function builderKbHitHtml(hit){
  const e=hit&&hit.entry;if(!e)return '';
  const esc=typeof escHtml==='function'?escHtml:(s=>String(s??''));
  const labels=typeof kbTagLabels==='function'?kbTagLabels(hit.tags||[]):[];
  const text=String(e.text||'');
  const short=text.length>140?text.slice(0,137)+'…':text;
  return `<div class="builder-kb-hit">
    ${labels.length?`<div class="builder-kb-hit-tags">${labels.map(l=>`<span class="kb-tag">${esc(l)}</span>`).join('')}</div>`:''}
    <div class="builder-kb-hit-title">${esc(e.title||'')}</div>
    <div class="builder-kb-hit-text">${esc(short)}</div>
  </div>`;
}
function builderRefreshKbHits(){
  const hitsFn=typeof kbEntriesForBuilder==='function'?kbEntriesForBuilder:null;
  const planTags=builderCollectKbTags();
  const planHits=hitsFn?hitsFn(planTags,{limit:6}):[];
  const box=document.getElementById('builder-kb-hits');
  if(box){
    if(!planHits.length)box.innerHTML='<div class="ui-section-sub">Brak dopasowanych wpisów. Dodaj tag MEV / partię w Bazie wiedzy.</div>';
    else box.innerHTML=planHits.map(builderKbHitHtml).join('');
  }
  document.querySelectorAll('#builder-days .builder-day').forEach(dayEl=>{
    const strip=dayEl.querySelector('.builder-day-kb');
    if(!strip)return;
    if(dayEl.querySelector('.rc')&&dayEl.querySelector('.rc').checked){
      strip.hidden=true;strip.innerHTML='';return;
    }
    const dayHits=hitsFn?hitsFn(builderCollectKbTags(dayEl),{limit:10}):[];
    const muscleHits=dayHits.filter(h=>{
      const mt=typeof kbMuscleTags==='function'?kbMuscleTags(h.tags||[]):[];
      return mt.length>0;
    });
    const show=muscleHits.length?muscleHits:dayHits.filter(h=>h.score>0).slice(0,2);
    if(!show.length){strip.hidden=true;strip.innerHTML='';return;}
    strip.hidden=false;
    strip.innerHTML=show.map(builderKbHitHtml).join('');
  });
}
window.builderCollectKbTags=builderCollectKbTags;
window.builderRefreshKbHits=builderRefreshKbHits;

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
  builderResetSaveState();
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
    <input type="text" class="builder-day-focus" placeholder="Push, Pull, FBW…" oninput="builderRefreshKbHits()" title="${typeof eduTipText==='function'?eduTipText('focus').replace(/"/g,'&quot;'):''}">
    <label class="builder-rest-toggle"><input type="checkbox" class="rc" style="accent-color:var(--accent);" onchange="toggleR('${id}')"> Dzień odpoczynku</label>
    <button type="button" class="builder-remove-day" onclick="document.getElementById('${id}').remove();builderRefreshAllDayFocus();builderRefreshRationale()">×</button>
  </div>
  <div class="builder-day-kb" hidden></div>
  <div class="rest-s builder-rest-state" style="display:none;">— Dzień odpoczynku / regeneracja aktywna</div>
  <div class="work-s">
    <div class="builder-circuit-bar">
      <label class="builder-circuit-toggle"><input type="checkbox" class="circ" style="accent-color:var(--accent);" onchange="builderOnCircuitToggle('${id}')"> Obwód (stacje)</label>
      <input type="text" class="ex-inp builder-round-rest" data-f="roundRest" placeholder="90s rundy" title="Przerwa między rundami obwodu" hidden>
    </div>
    <div class="ex-tbl-hdr"><span>ĆWICZENIE</span><span>SER${tip('sets')}</span><span>POWT${tip('reps')}</span><span>KG/S${tip('kg')}</span><span>RPE${tip('rpe')}</span><span>RIR${tip('rir')}</span><span>PRZERWA${tip('rest')}</span><span>TEMPO${tip('tempo')}</span><span></span></div>
    <div class="ex-rows"></div>
    <button class="add-ex-btn" onclick="addRow('${id}')">+ DODAJ ĆWICZENIE</button>
  </div>`;
  document.getElementById('builder-days').appendChild(div);
  if(typeof normalizeRationaleMethod==='function'&&normalizeRationaleMethod(builderGetMethod())==='Obwodowy'){
    const cb=div.querySelector('.circ');
    if(cb){cb.checked=true;builderOnCircuitToggle(id);}
  }
  builderRefreshAllDayFocus();
  builderRefreshRationale();
}
function builderOnCircuitToggle(id){
  const el=document.getElementById(id);
  if(!el)return;
  builderPaintCircuitDay(el);
}
window.builderOnCircuitToggle=builderOnCircuitToggle;
function builderPaintCircuitDay(dayEl){
  if(!dayEl)return;
  const on=!!(dayEl.querySelector('.circ')||{}).checked;
  dayEl.classList.toggle('is-circuit',on);
  const rr=dayEl.querySelector('.builder-round-rest');
  if(rr)rr.hidden=!on;
  [...dayEl.querySelectorAll('.ex-row')].forEach((r,i)=>{
    const badge=r.querySelector('.builder-station-badge');
    if(badge){badge.hidden=!on;badge.textContent='S'+(i+1);}
    const tr=r.querySelector('[data-f="trans"]');
    if(tr)tr.hidden=!on;
  });
}
window.builderPaintCircuitDay=builderPaintCircuitDay;
function toggleR(id){const el=document.getElementById(id);const r=el.querySelector('.rc').checked;el.querySelector('.rest-s').style.display=r?'block':'none';el.querySelector('.work-s').style.display=r?'none':'block';builderRefreshAllDayFocus();builderRefreshRationale();}
function addRow(dayId){
  const rows=document.querySelector('#'+dayId+' .ex-rows');
  const div=document.createElement('div');div.className='ex-row';
  const ctx=typeof builderEduCtx==='function'?builderEduCtx():{};
  const t=k=>typeof eduTipText==='function'?String(eduTipText(k,ctx)).replace(/"/g,'&quot;'):'';
  div.innerHTML='<div class="builder-ex-namecell">'
    +'<span class="builder-station-badge" hidden>S1</span>'
    +'<button type="button" class="builder-ex-thumb" hidden title="Podgląd techniki" onclick="builderOpenExMedia(this.closest(\'.ex-row\'))"></button>'
    +'<input type="text" placeholder="Nazwa ćwiczenia..." class="ex-inp ex-inp-name ex-ac-input" style="width:100%;" autocomplete="off" data-f="name" oninput="builderOnExNameChange(this.closest(\'.ex-row\'))">'
    +'</div>'
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
    +'<div class="builder-alt-box" hidden>'
    +'<div class="builder-alt-label">Zamienniki gdy nie ma maszyny — sztanga / hantle / brama / ławka — kliknij, żeby podmienić w planie</div>'
    +'<div class="builder-alt-chips"></div>'
    +'<input type="text" placeholder="Własny zamiennik (opcjonalnie)" class="ex-inp ex-inp-name builder-sub-input" data-f="alt" oninput="builderRefreshAltChips(this.closest(\'.ex-row\'))">'
    +'</div>'
    +'<input type="number" placeholder="%1RM" class="ex-inp" data-f="pct1rm" min="1" max="150" step="0.5" title="Procent 1RM — kg z Pomiary → Siła bazowa" oninput="builderPreviewKg(this.closest(\'.ex-row\'));builderOnPeriodFieldEdit(this)">'
    +'<div class="ex-row-coach">'
    +'<label class="builder-todo-lbl">Do zrobienia<textarea placeholder="Co zrobić w tym ćwiczeniu (np. łopatki ściągnięte, pauza 2 s)" class="ex-inp ex-inp-name builder-sub-input builder-todo-input" data-f="note" rows="2"></textarea></label>'
    +'<input type="url" placeholder="Własny film (opcjonalnie): YouTube / Vimeo / .mp4" class="ex-inp ex-inp-name builder-sub-input" data-f="video" title="Nadpisz film techniki z biblioteki" oninput="builderRefreshTechMedia(this.closest(\'.ex-row\'))">'
    +'</div>'
    +'<div class="ex-kind-btns">'
    +'<input type="hidden" data-f="ss" value="">'
    +'<input type="hidden" data-f="wu" value="">'
    +'<input type="hidden" data-f="drop" value="">'
    +'<input type="hidden" data-f="cluster" value="">'
    +'<input type="hidden" data-f="rp" value="">'
    +'<input type="hidden" data-f="amrap" value="">'
    +'<input type="hidden" data-f="emom" value="">'
    +'<button type="button" class="ex-ss-btn builder-alt-toggle" onclick="builderToggleAlts(this.closest(\'.ex-row\'))" title="Pokaż zamienniki" aria-expanded="false">Zamienniki</button>'
    +'<button type="button" class="ex-ss-btn" onclick="builderToggleSs(this)" title="Połącz z następnym ćwiczeniem w super-serię">⚡ SS</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn wu" onclick="builderCycleKind(this,\'wu\',2)" title="Serie rozgrzewkowe (1–2) — lżejsze kg, krótsza przerwa">WU</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn drop" onclick="builderCycleKind(this,\'drop\',2)" title="Drop sety po roboczych — bez przerwy, zrzut 20% lub kg">DROP</button>'
    +'<input type="text" class="ex-inp ex-drop-step" data-f="dropStep" placeholder="20% / 10kg" title="Zrzut między dropami: 20% ciężaru roboczego albo 10kg" hidden>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn cluster" onclick="builderCycleKind(this,\'cluster\',3)" title="Klaster: mini-serie z 20 s wewnątrz (1–3)">KL</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn rp" onclick="builderCycleKind(this,\'rp\',2)" title="Rest-pause: 1–2 dogrywki po 15 s">RP</button>'
    +'<button type="button" class="ex-ss-btn ex-kind-btn amrap" onclick="builderToggleAmrap(this)" title="Ostatnia seria robocza = AMRAP (max powtórzeń)">AMRAP</button>'
    +'<button type="button" class="ex-ss-btn ex-emom-btn" onclick="builderToggleEmom(this)" title="EMOM: każda seria na starcie minuty, reszta minuty to przerwa">EMOM</button>'
    +'<input type="text" class="ex-inp ex-trans-inp" data-f="trans" placeholder="20s przejście" title="Czas przejścia do następnej stacji obwodu" hidden>'
    +'</div>'
    +'<div class="builder-period-preview" style="grid-column:1/-1;display:none;"></div>'
    +'<div class="builder-ex-hist-slot" hidden></div>'
    +'</div>';
  rows.appendChild(div);
  const nameInp=div.querySelector('[data-f="name"]');
  if(nameInp&&typeof exAcInitInput==='function')exAcInitInput(nameInp);
  builderRefreshAltChips(div);
  builderRefreshTechMedia(div);
  builderRefreshPeriodPreview();
  builderPaintKinds(div);
  const dayEl=document.getElementById(dayId);
  if(dayEl)builderPaintCircuitDay(dayEl);
  if(typeof builderRefreshKbHits==='function')builderRefreshKbHits();
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
  const btn=row.querySelector('.builder-alt-toggle');
  if(btn){
    btn.textContent=alts.length?('Zamienniki · '+alts.length):'Zamienniki';
    btn.title=alts.length?'Pokaż zamienniki (gdy nie ma maszyny w studio)':'Pokaż zamienniki';
  }
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
function builderToggleAlts(row){
  if(!row)return;
  const box=row.querySelector('.builder-alt-box');
  const btn=row.querySelector('.builder-alt-toggle');
  if(!box)return;
  const open=!box.hasAttribute('hidden');
  if(open){
    box.setAttribute('hidden','');
    row.classList.remove('alts-open');
    if(btn){btn.classList.remove('on');btn.setAttribute('aria-expanded','false');}
  }else{
    box.removeAttribute('hidden');
    row.classList.add('alts-open');
    if(btn){btn.classList.add('on');btn.setAttribute('aria-expanded','true');}
    builderRefreshAltChips(row);
  }
}
window.builderToggleAlts=builderToggleAlts;
function builderExMediaFromRow(row){
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const videoInp=row.querySelector('[data-f="video"]');
  const videoVal=videoInp?(videoInp.value||'').trim():'';
  const media=typeof resolveCoachMedia==='function'?resolveCoachMedia({name,video:videoVal}):{gif:'',video:videoVal,isFile:false,img:'',videoEmbed:''};
  if(videoInp&&!videoVal&&media.video)videoInp.value=media.video;
  media.name=name;
  return media;
}
function builderRefreshTechMedia(row){
  if(!row)return;
  const thumb=row.querySelector('.builder-ex-thumb');
  const media=builderExMediaFromRow(row);
  const gif=media.gif||'';
  const video=media.video||'';
  const file=!!media.isFile||(typeof coachVideoIsFile==='function'&&coachVideoIsFile(video));
  let html='';
  if(gif&&typeof exTechniqueMediaHtml==='function'){
    html=exTechniqueMediaHtml({gif,name:media.name},{compact:true});
  }else if(video&&file){
    html=`<video src="${typeof escHtml==='function'?escHtml(video):video}" muted loop playsinline preload="metadata"></video>`;
  }else if(media.img){
    html=`<img src="${typeof escHtml==='function'?escHtml(media.img):media.img}" alt="${typeof escHtml==='function'?escHtml(media.name):media.name}" loading="lazy" referrerpolicy="no-referrer">`;
  }
  if(thumb){
    if(html){
      thumb.innerHTML=html;
      thumb.hidden=false;
      thumb.setAttribute('aria-label','Podgląd techniki: '+(media.name||''));
    }else{
      thumb.innerHTML='';
      thumb.hidden=true;
    }
  }
  const pop=document.getElementById('builder-ex-media-pop');
  if(pop&&pop.dataset.row===String(row.dataset.builderRow||'')&&!pop.hidden)builderFillExMediaPop(media);
}
window.builderRefreshTechMedia=builderRefreshTechMedia;
function builderFillExMediaPop(media){
  const pop=document.getElementById('builder-ex-media-pop');
  if(!pop)return;
  const gif=media.gif||'';
  const video=media.video||'';
  const file=!!media.isFile||(typeof coachVideoIsFile==='function'&&coachVideoIsFile(video));
  let html='';
  if(gif&&typeof exTechniqueMediaHtml==='function')html=exTechniqueMediaHtml({gif,name:media.name},{});
  else if(video&&file)html=`<video src="${typeof escHtml==='function'?escHtml(video):video}" controls playsinline muted loop></video>`;
  else if(video&&media.videoEmbed)html=`<iframe src="${typeof escHtml==='function'?escHtml(media.videoEmbed):media.videoEmbed}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen title="Film techniki"></iframe>`;
  else if(media.img)html=`<img src="${typeof escHtml==='function'?escHtml(media.img):media.img}" alt="${typeof escHtml==='function'?escHtml(media.name):media.name}">`;
  pop.querySelector('.builder-ex-media-pop-body').innerHTML=html||'<div class="builder-alt-empty">Brak podglądu techniki w bibliotece.</div>';
  const title=pop.querySelector('.builder-ex-media-pop-title');
  if(title)title.textContent=media.name||'Technika';
}
function builderCloseExMedia(){
  const pop=document.getElementById('builder-ex-media-pop');
  if(!pop)return;
  pop.hidden=true;
  pop.dataset.row='';
  const body=pop.querySelector('.builder-ex-media-pop-body');
  if(body)body.innerHTML='';
}
window.builderCloseExMedia=builderCloseExMedia;
function builderOpenExMedia(row){
  if(!row)return;
  const media=builderExMediaFromRow(row);
  if(!media.gif&&!media.video&&!media.img){
    if(typeof notify==='function')notify('Brak filmu/zdjęcia techniki w bibliotece — wklej link poniżej.');
    return;
  }
  let pop=document.getElementById('builder-ex-media-pop');
  if(!pop){
    pop=document.createElement('div');
    pop.id='builder-ex-media-pop';
    pop.className='builder-ex-media-pop';
    pop.innerHTML='<div class="builder-ex-media-pop-card"><div class="builder-ex-media-pop-bar"><span class="builder-ex-media-pop-title"></span><button type="button" class="builder-ex-media-pop-close" onclick="builderCloseExMedia()" aria-label="Zamknij">×</button></div><div class="builder-ex-media-pop-body"></div></div>';
    pop.addEventListener('click',e=>{if(e.target===pop)builderCloseExMedia();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')builderCloseExMedia();});
    document.body.appendChild(pop);
  }
  if(!row.dataset.builderRow)row.dataset.builderRow='r'+Math.random().toString(36).slice(2,8);
  pop.dataset.row=row.dataset.builderRow;
  builderFillExMediaPop(media);
  pop.hidden=false;
}
window.builderOpenExMedia=builderOpenExMedia;
function builderFillExTodo(row){
  if(!row)return;
  const noteInp=row.querySelector('[data-f="note"]');
  if(!noteInp)return;
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const tip=typeof exerciseTodoNote==='function'?exerciseTodoNote({name}):String(((typeof libExerciseByName==='function'?libExerciseByName(name):null)||{}).tip||'').trim();
  const cur=String(noteInp.value||'').trim();
  const prev=row.dataset.autoTodo||'';
  if(!tip){
    if(cur&&cur===prev){noteInp.value='';row.dataset.autoTodo='';}
    return;
  }
  if(!cur||cur===prev||cur===tip){
    noteInp.value=tip;
    row.dataset.autoTodo=tip;
  }
}
window.builderFillExTodo=builderFillExTodo;
function builderOnExNameChange(row){
  if(!row)return;
  if(typeof builderApplyLoadUnit==='function')builderApplyLoadUnit(row);
  if(typeof builderPreviewKg==='function')builderPreviewKg(row);
  if(typeof builderRefreshPeriodPreview==='function')builderRefreshPeriodPreview();
  // Uzupełnij alt z biblioteki, gdy pole puste
  const altInp=row.querySelector('[data-f="alt"]');
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  if(altInp&&!(altInp.value||'').trim()&&typeof altsForExercise==='function'){
    const alts=altsForExercise(name);
    if(alts.length)altInp.value=alts.join(', ');
  }
  builderFillExTodo(row);
  builderRefreshAltChips(row);
  builderRefreshTechMedia(row);
  if(typeof builderRefreshExHist==='function')builderRefreshExHist(row);
  if(typeof builderRefreshKbHits==='function')builderRefreshKbHits();
}
window.builderOnExNameChange=builderOnExNameChange;
function builderRefreshExHist(row){
  if(!row)return;
  try{
    let box=row.querySelector('.builder-ex-hist-slot');
    if(!box){
      box=document.createElement('div');
      box.className='builder-ex-hist-slot';
      const extra=row.querySelector('.ex-row-extra');
      if(extra)extra.appendChild(box);
      else row.appendChild(box);
    }
    const cid=(document.getElementById('b-client')||{}).value||'';
    const name=(row.querySelector('[data-f="name"]')||{}).value||'';
    const alt=(row.querySelector('[data-f="alt"]')||{}).value||'';
    const fromField=String(alt).split(/[,;/]/).map(s=>s.trim()).filter(Boolean);
    const fromLib=typeof altsForExercise==='function'?altsForExercise(name):[];
    const alts=fromField.concat(fromLib);
    const html=cid&&name&&typeof lastSetsBlockHtml==='function'
      ?lastSetsBlockHtml({name,clientId:cid,alts},{variant:'builder',limit:8})
      :'';
    box.innerHTML=html||'';
    box.hidden=!html;
  }catch(e){console.warn('builderRefreshExHist',e);}
}
window.builderRefreshExHist=builderRefreshExHist;
function builderRefreshRowExtras(row){
  builderRefreshAltChips(row);
  builderRefreshTechMedia(row);
  if(typeof builderRefreshExHist==='function')builderRefreshExHist(row);
}
window.builderRefreshRowExtras=builderRefreshRowExtras;
function builderRemoveRow(btn){
  const row=btn.closest('.ex-row');
  const box=row&&row.parentElement;
  const dayEl=row&&row.closest('.builder-day');
  if(row)row.remove();
  if(box)builderPaintSs(box);
  if(dayEl)builderPaintCircuitDay(dayEl);
  if(typeof builderRefreshKbHits==='function')builderRefreshKbHits();
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
    ['wu','drop','cluster','rp'].forEach(f=>{const el=r.querySelector('[data-f="'+f+'"]');if(el)el.value='';});
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
  const cl=inSs?0:(parseInt(g('cluster'),10)||0);
  const rp=inSs?0:(parseInt(g('rp'),10)||0);
  const am=g('amrap')==='1';
  const wuBtn=row.querySelector('.ex-kind-btn.wu');
  const drBtn=row.querySelector('.ex-kind-btn.drop');
  const clBtn=row.querySelector('.ex-kind-btn.cluster');
  const rpBtn=row.querySelector('.ex-kind-btn.rp');
  const amBtn=row.querySelector('.ex-kind-btn.amrap');
  if(wuBtn){wuBtn.textContent=wu?('WU '+wu):'WU';wuBtn.classList.toggle('on',!!wu);wuBtn.disabled=inSs;wuBtn.title=inSs?'WU/DROP nie w super-serii':'Serie rozgrzewkowe (1–2) — lżejsze kg, krótsza przerwa';}
  if(drBtn){drBtn.textContent=dr?('DROP '+dr):'DROP';drBtn.classList.toggle('on',!!dr);drBtn.disabled=inSs;drBtn.title=inSs?'WU/DROP nie w super-serii':'Drop sety po roboczych — bez przerwy; wpisz 20% albo 10kg';}
  const stepInp=row.querySelector('[data-f="dropStep"]');
  if(stepInp){stepInp.hidden=!dr||inSs;if(!dr)stepInp.value=stepInp.value;}
  if(clBtn){clBtn.textContent=cl?('KL '+cl):'KL';clBtn.classList.toggle('on',!!cl);clBtn.disabled=inSs;clBtn.title=inSs?'Klaster nie w super-serii':'Klaster: mini-serie z 20 s wewnątrz (1–3)';}
  if(rpBtn){rpBtn.textContent=rp?('RP '+rp):'RP';rpBtn.classList.toggle('on',!!rp);rpBtn.disabled=inSs;rpBtn.title=inSs?'Rest-pause nie w super-serii':'Rest-pause: 1–2 dogrywki po 15 s';}
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
  const unit=typeof builderApplyLoadUnit==='function'?builderApplyLoadUnit(row):(typeof exLoadUnit==='function'?exLoadUnit((row.querySelector('[data-f="name"]')||{}).value||''):'kg');
  if(unit&&unit!=='kg')return;
  const cid=(document.getElementById('b-client')||{}).value||'';
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const pct=typeof parsePct1RM==='function'?parsePct1RM((row.querySelector('[data-f="pct1rm"]')||{}).value||''):'';
  if(!pct||!cid||typeof weightFromPct1RM!=='function'){
    if(!kgEl.value)kgEl.placeholder=typeof loadUnitPlaceholder==='function'?loadUnitPlaceholder('kg'):'kg';
    return;
  }
  const w=weightFromPct1RM(cid,name,pct);
  kgEl.placeholder=w.kg?String(w.kg):(typeof loadUnitPlaceholder==='function'?loadUnitPlaceholder('kg'):'kg');
  kgEl.title=w.hint||'kg z %1RM';
}
window.builderPreviewKg=builderPreviewKg;
function builderApplyLoadUnit(row){
  if(!row)return 'kg';
  const name=(row.querySelector('[data-f="name"]')||{}).value||'';
  const unit=typeof exLoadUnit==='function'?exLoadUnit(name):'kg';
  row.dataset.loadUnit=unit;
  const kgEl=row.querySelector('[data-f="kg"]');
  if(kgEl){
    kgEl.dataset.loadUnit=unit;
    kgEl.placeholder=typeof loadUnitPlaceholder==='function'?loadUnitPlaceholder(unit):(unit==='min'?'min':unit==='sec'?'sec':'kg');
    kgEl.title=typeof loadUnitTitle==='function'?loadUnitTitle(unit):(unit==='min'?'Czas (min)':unit==='sec'?'Czas (s)':'Obciążenie (kg)');
  }
  const pct=row.querySelector('[data-f="pct1rm"]');
  if(pct){
    const timed=typeof isWeightLoadUnit==='function'?!isWeightLoadUnit(unit):(unit==='sec'||unit==='min'||unit==='m');
    pct.disabled=!!timed;
    if(timed){
      pct.value='';
      pct.title='Nie dotyczy — to pole to czas, nie ciężar';
    }else{
      pct.title='Procent 1RM — kg z Pomiary → Siła bazowa';
    }
  }
  return unit;
}
window.builderApplyLoadUnit=builderApplyLoadUnit;
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
  if(typeof periodWeekModel==='function')return periodWeekModel(level,idx);
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
function builderEditingPlan(){
  const id=window._editingPlanId;
  return id&&(window.PL||[]).find(p=>p&&p.id===id)||null;
}
function builderPeriodSchedule(client){
  const plan=builderEditingPlan();
  const c=client||{};
  const dur=parseInt((document.getElementById('b-duration')||{}).value,10)||0;
  if(plan&&Array.isArray(plan.weekKeys)&&plan.weekKeys.length){
    if(typeof planPhaseSchedule==='function')return planPhaseSchedule(plan,c);
  }
  if(plan&&typeof isFiteboLikePlan==='function'&&isFiteboLikePlan(plan)&&typeof fiteboContinuePhases==='function'){
    const n=Math.max(4,Math.min(12,dur||parseInt(plan.duration,10)||8));
    const keys=['w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11','w12'].slice(0,n);
    const phases=fiteboContinuePhases(n,keys);
    return keys.map((wk,i)=>{
      const cel=phases[wk]||('Tydzień '+(i+1));
      const rpe=typeof planPhaseRpe==='function'?planPhaseRpe(cel):'8';
      return{nr:i+1,key:wk,cel,rpe:'RPE '+rpe};
    });
  }
  return getPeriod(c.level||'sredni');
}
window.builderPeriodSchedule=builderPeriodSchedule;
function builderWeekMetaForSave(prev,dur){
  const n=Math.max(4,Math.min(12,parseInt(dur,10)||8));
  const fromPrev=prev&&Array.isArray(prev.weekKeys)&&prev.weekKeys.length;
  const fitebo=prev&&(prev.source==='fitebo-continue'||prev.fromFitebo||prev.source==='fitebo');
  if(!fromPrev&&!fitebo)return {};
  const weekKeys=['w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11','w12'].slice(0,n);
  const phases=fitebo&&typeof fiteboContinuePhases==='function'
    ? fiteboContinuePhases(n,weekKeys)
    : Object.assign({},prev&&prev.phases||{});
  const idx=window._builderPeriodWeek||0;
  const out={weekKeys,phases,currentWeek:weekKeys[idx]||(prev&&prev.currentWeek)||weekKeys[0]};
  if(prev&&prev.source)out.source=prev.source;
  if(prev&&prev.fromFitebo)out.fromFitebo=true;
  if(prev&&prev.continueFromWeek)out.continueFromWeek=prev.continueFromWeek;
  return out;
}
window.builderWeekMetaForSave=builderWeekMetaForSave;
function builderPlanRationaleChanged(prev,next){
  if(!prev||!next)return false;
  const signature=plan=>JSON.stringify({
    method:plan.method||'',
    duration:String(plan.duration||''),
    progression:plan.progression||'',
    clientId:plan.clientId||'',
    level:plan.level||'',
    goal:plan.goal||'',
    days:Array.isArray(plan.days)?plan.days:[]
  });
  return signature(prev)!==signature(next);
}
function builderRowWeekLoads(row){
  if(!row||!row.dataset.weekLoads)return null;
  try{return JSON.parse(row.dataset.weekLoads);}catch(e){return null;}
}
function builderApplyWeekLoad(row,load){
  if(!row||!load)return;
  const set=(f,v)=>{const el=row.querySelector('[data-f="'+f+'"]');if(el&&v!=null&&v!=='')el.value=String(v);};
  if(load.s!=null)set('sets',load.s);
  if(load.r!=null)set('reps',load.r);
  if(load.kg!=null&&load.kg!=='')set('kg',load.kg);
  if(load.rpe!=null)set('rpe',load.rpe);
  if(load.rest)set('rest',load.rest);
  if(load.rir!=null)set('rir',load.rir);
}
function builderRefreshPeriodPreview(){
  const idx=window._builderPeriodWeek||0;
  const cid=(document.getElementById('b-client')||{}).value||'';
  const c=CL.find(x=>x.id===cid)||{};
  const sch=builderPeriodSchedule(c);
  const key=sch[idx]&&sch[idx].key;
  const mod=builderWeekModel(c.level||'sredni',idx);
  document.querySelectorAll('#builder-days .ex-row').forEach(row=>{
    const box=row.querySelector('.builder-period-preview');
    const loads=builderRowWeekLoads(row);
    if(loads&&key&&loads[key]){
      builderApplyWeekLoad(row,loads[key]);
      if(box){
        box.style.display='block';
        const w=sch[idx]||{};
        box.innerHTML=`<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.18);font-size:10px;color:var(--muted);line-height:1.5;font-family:var(--font-ui);">📈 Tydzień ${idx+1} — ${w.cel||''} · ${loads[key].s||''}×${loads[key].r||''}${loads[key].kg?' @'+loads[key].kg+' kg':''} · RPE ${loads[key].rpe||''}</div>`;
      }
    }else if(idx>0){
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
        const name=(row.querySelector('[data-f="name"]')||{}).value||'';
        const unit=row.dataset.loadUnit||(typeof exLoadUnit==='function'?exLoadUnit(name):'kg');
        const suf=typeof loadUnitSuffix==='function'?loadUnitSuffix(unit):'kg';
        const bits=[
          `TYDZ ${idx+1}`,
          pv.sets+' serie',
          pv.reps+' powt.',
          (pv.kg?pv.kg+' '+suf:suf+' bez zmiany'),
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
      if(input)input.classList.toggle('period-preview-on',idx>0&&!(loads&&key&&loads[key]));
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
  if(!el)return;
  if(!c){el.innerHTML='<div style="font-size:11px;color:var(--muted);">Wybierz klienta</div>';return;}
  const sch=builderPeriodSchedule(c);
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
  const n=sch.length;
  if(activeIdx>=n)window._builderPeriodWeek=Math.max(0,n-1);
  const idx=window._builderPeriodWeek||0;
  const hasKeys=sch.some(w=>w&&w.key);
  el.innerHTML=sportBar+rmBar+`<div class="ui-section-sub" style="margin-bottom:12px;">Kliknij tydzień, aby podejrzeć serie, powtórzenia, kg, <b>RPE</b> i <b>RIR</b> w wierszach ćwiczeń.${n>4?` Ten plan ma <b>${n} tygodni</b>.`:''}</div>`+sch.map((w,i)=>`<button type="button" class="period-row${idx===i?' active':''}" onclick="builderSelectPeriodWeek(${i})"><div class="period-row-week" style="color:${/deload/i.test(w.cel)?'var(--orange)':w.nr===1?'var(--accent)':'var(--blue)'};">Tydz. ${w.nr}</div><div style="min-width:0;flex:1;"><div class="period-row-title">${w.cel}</div><div class="period-row-sub">${w.rpe}${w.rir?' · RIR '+w.rir:''}</div></div></button>`).join('')+(idx>0&&!hasKeys?`<button type="button" class="btn btn-primary btn-sm" style="width:100%;margin-top:12px;" onclick="builderApplyPeriodWeek()">Użyj wartości z tygodnia ${idx+1} w formularzu</button>`:'');
  document.querySelectorAll('#builder-days .ex-row').forEach(r=>{
    if(typeof builderPreviewKg==='function')builderPreviewKg(r);
    if(typeof builderRefreshExHist==='function')builderRefreshExHist(r);
  });
  builderRefreshPeriodPreview();
  builderRefreshRationale();
  if(typeof refreshBuilderAiCoachCard==='function')refreshBuilderAiCoachCard();
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
  return typeof periodScheduleForLevel==='function'?periodScheduleForLevel(level):[{nr:1,cel:'DUP Akumulacja — wysoka objętość',rpe:'RPE 7'},{nr:2,cel:'DUP Intensyfikacja',rpe:'RPE 8'},{nr:3,cel:'DUP Szczyt',rpe:'RPE 9'},{nr:4,cel:'DELOAD',rpe:'RPE 6'}];
}
function builderEnsureSelectValue(sel,value,label){
  if(!sel)return;
  let v=value==null||value===''?'':String(value);
  if(!v)return;
  if(v==='Custom')v='Własna';
  if(![...sel.options].some(o=>o.value===v)){
    const o=document.createElement('option');
    o.value=v;
    o.textContent=label||v;
    sel.appendChild(o);
  }
  sel.value=v;
}
window.builderEnsureSelectValue=builderEnsureSelectValue;
function builderSetDayHeader(dayEl,d){
  if(!dayEl)return;
  const sel=dayEl.querySelector('.builder-day-select');
  const focus=dayEl.querySelector('.builder-day-focus');
  const label=String((d&&(d.day||d.dayName))||'').trim();
  const muscles=String((d&&(d.muscles||d.focus))||'').trim();
  if(sel&&label)builderEnsureSelectValue(sel,label,label);
  if(focus)focus.value=muscles;
}
window.builderSetDayHeader=builderSetDayHeader;
// Ładuje istniejący plan do kreatora, żeby faktycznie go edytować (a nie tworzyć pusty nowy).
function editPlan(id){
  const plan=PL.find(p=>p.id===id);
  if(!plan){notify('Nie znaleziono planu');return;}
  if(!window._builderReturnClientId)window._builderBack='plans';
  goTo('builder'); // initBuilder() czyści formularz i resetuje _editingPlanId
  window._editingPlanId=id;
  window._builderSaveState.base=builderPlanClone(plan);
  document.getElementById('b-name').value=plan.name||'';
  const clientSel=document.getElementById('b-client');
  if(clientSel)clientSel.value=plan.clientId||'';
  builderEnsureSelectValue(document.getElementById('b-method'),plan.method||'');
  builderEnsureSelectValue(document.getElementById('b-duration'),plan.duration||(plan.weekKeys&&plan.weekKeys.length)||'');
  const progSel=document.getElementById('b-progression');
  if(progSel)progSel.value=typeof normalizePlanProgression==='function'?normalizePlanProgression(plan.progression||plan.progressionType):'double';
  const keys=plan.weekKeys||[];
  const cur=plan.currentWeek&&keys.length?keys.indexOf(plan.currentWeek):0;
  window._builderPeriodWeek=cur>=0?cur:0;
  updatePeriod();
  (plan.days||[]).forEach(d=>{
    addDay();
    const dayEl=document.getElementById('bd-'+dayCount);
    if(!dayEl)return;
    builderSetDayHeader(dayEl,d);
    if(d.rest){
      const rc=dayEl.querySelector('.rc');
      if(rc){rc.checked=true;toggleR(dayEl.id);}
      return;
    }
    const circOn=!!d.circuit||(typeof normalizeRationaleMethod==='function'&&normalizeRationaleMethod(plan.method)==='Obwodowy');
    const circCb=dayEl.querySelector('.circ');
    if(circCb&&circOn)circCb.checked=true;
    const rr=dayEl.querySelector('[data-f="roundRest"]');
    if(rr&&d.roundRest)rr.value=d.roundRest;
    if(circOn)builderPaintCircuitDay(dayEl);
    (d.exercises||[]).forEach(ex=>{
      try{
        addRow(dayEl.id);
        const rows=dayEl.querySelectorAll('.ex-row');
        const row=rows[rows.length-1];
        if(!row)return;
        const parsed=typeof parsePlanExercise==='function'?parsePlanExercise(ex):(typeof ex==='string'?{name:ex}:ex);
        const wkIdx=window._builderPeriodWeek||0;
        const shown=(ex&&typeof ex==='object'&&typeof exerciseForPlanWeek==='function')?exerciseForPlanWeek(ex,plan,wkIdx):parsed;
        const set=(f,v)=>{const el=row.querySelector('[data-f="'+f+'"]');if(el)el.value=v==null?'':v;};
        set('name',shown.name||parsed.name||'');
        set('sets',shown.sets||parsed.sets||'');
        set('reps',shown.reps||parsed.reps||'');
        set('kg',shown.kg||parsed.kg||'');
        set('rpe',shown.rpe||parsed.rpe||'');
        set('rir',shown.rir||parsed.rir||'');
        set('rest',shown.rest||parsed.rest||'');
        set('tempo',parsed.tempo||'');
        set('alt',(ex&&typeof ex==='object'&&ex.alt)||parsed.alt||(typeof altsForExercise==='function'?altsForExercise(parsed.name).join(', '):''));
        set('pct1rm',parsed.pct1rm||(ex&&typeof ex==='object'&&ex.pct1rm)||'');
        set('ss',parsed.ss||(ex&&typeof ex==='object'&&ex.ss)||'');
        set('emom',((ex&&typeof ex==='object'&&ex.emom)||parsed.emom)?'1':'');
        set('note',parsed.note||(ex&&typeof ex==='object'&&(ex.note||ex.notes))||'');
        if(typeof builderFillExTodo==='function')builderFillExTodo(row);
        set('video',parsed.video||(ex&&typeof ex==='object'&&ex.video)||'');
        set('wu',parsed.wu||(ex&&typeof ex==='object'&&ex.wu)||'');
        set('drop',parsed.drop||(ex&&typeof ex==='object'&&ex.drop)||'');
        set('dropStep',(ex&&typeof ex==='object'&&ex.dropStep)||parsed.dropStep||'');
        set('trans',(ex&&typeof ex==='object'&&(ex.trans||ex.transSec))||parsed.trans||'');
        set('cluster',parsed.cluster||(ex&&typeof ex==='object'&&ex.cluster)||'');
        set('rp',parsed.rp||(ex&&typeof ex==='object'&&ex.rp)||'');
        set('amrap',((ex&&typeof ex==='object'&&ex.amrap)||parsed.amrap)?'1':'');
        if(ex&&typeof ex==='object'){
          const loads={};
          (plan.weekKeys||[]).forEach(wk=>{if(ex[wk])loads[wk]=ex[wk];});
          if(Object.keys(loads).length)row.dataset.weekLoads=JSON.stringify(loads);
        }
        if(typeof builderPreviewKg==='function')builderPreviewKg(row);
        if(typeof builderApplyLoadUnit==='function')builderApplyLoadUnit(row);
        if(typeof builderPaintEmom==='function')builderPaintEmom(row);
        if(typeof builderPaintKinds==='function')builderPaintKinds(row);
        if(typeof builderRefreshRowExtras==='function')builderRefreshRowExtras(row);
      }catch(e){console.warn('editPlan row',e);}
    });
    if(typeof builderPaintSs==='function')builderPaintSs(dayEl.querySelector('.ex-rows'));
    if(typeof builderPaintCircuitDay==='function')builderPaintCircuitDay(dayEl);
  });
  const titleEl=document.querySelector('#screen-builder .topbar-title');
  if(titleEl)titleEl.textContent='Edytuj plan: '+(plan.name||'');
  window._editingPlanId=id;
  updatePeriod();
}
function editPlanFromProfile(planId,clientId){
  const plan=(window.PL||[]).find(p=>p&&p.id===planId);
  if(!plan){if(typeof notify==='function')notify('Nie znaleziono planu');return;}
  window._builderReturnClientId=clientId||plan.clientId||'';
  window._builderReturnTab='plan';
  window._builderBack='clients';
  try{editPlan(planId);}
  catch(e){
    console.warn('editPlanFromProfile',e);
    if(typeof notify==='function')notify('Nie udało się otworzyć kreatora');
  }
}
window.editPlan=editPlan;
window.editPlanFromProfile=editPlanFromProfile;

function builderPlanClone(value){
  return JSON.parse(JSON.stringify(value));
}
function builderPlanSignature(value){
  const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.keys(v).filter(k=>k!=='_fbId').sort().reduce((out,k)=>{out[k]=clean(v[k]);return out;},{}):v;
  return JSON.stringify(clean(value));
}
function builderSaveSessionCurrent(session){
  return !!session&&!!session.uid&&!window._clientAppMode&&!window._clientPreviewMode&&
    window._uid===session.uid&&window.tenantSessionGeneration===session.generation&&
    (typeof window.tenantSessionIsCurrent!=='function'||window.tenantSessionIsCurrent(session));
}
function builderSaveStatus(message,isError){
  const el=document.getElementById('builder-save-status');
  if(el){el.hidden=!message;el.textContent=message||'';el.style.color=isError?'var(--orange)':'var(--muted)';}
}
function builderSaveUnlock(state){
  (state&&state.controls||[]).forEach(item=>{item.el.disabled=item.disabled;});
  if(state)state.controls=[];
}
function builderResetSaveState(){
  builderSaveUnlock(window._builderSaveState);
  window._builderSaveState={session:{uid:window._uid,generation:window.tenantSessionGeneration},pending:false,candidate:null,base:null,saved:false,controls:[]};
  const btn=document.getElementById('b-save-btn');
  if(btn){btn.disabled=false;btn.textContent='Zapisz plan';}
  builderSaveStatus('');
  builderCalendarActions(window._builderSaveState,false);
  return window._builderSaveState;
}
function builderSaveLock(state){
  if(state.controls.length)return;
  const screen=document.getElementById('screen-builder');
  if(!screen)return;
  screen.querySelectorAll('input,select,textarea,button').forEach(el=>{
    if(el.id==='b-save-btn'||el.id==='b-calendar-retry'||el.id==='b-calendar-continue'||(el.getAttribute('onclick')||'').includes('builderGoBack'))return;
    state.controls.push({el,disabled:el.disabled});el.disabled=true;
  });
}
function builderSaveFormCurrent(state){
  const screen=document.getElementById('screen-builder');
  return window._builderSaveState===state&&builderSaveSessionCurrent(state.session)&&!!screen&&screen.classList.contains('active');
}
function builderCalendarActions(state,visible){
  if(window._builderSaveState!==state)return;
  const actions=document.getElementById('builder-calendar-actions');
  if(actions)actions.hidden=!visible;
  ['b-calendar-retry','b-calendar-continue'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.disabled=!!(state.calendar&&state.calendar.status==='pending');
  });
}
function builderFinishSavedPlan(state){
  state=state||window._builderSaveState;
  if(!state||!state.saved||state.finished||!builderSaveFormCurrent(state)||
    (state.calendar&&state.calendar.status==='pending'))return;
  state.finished=true;
  builderCalendarActions(state,false);
  builderSaveUnlock(state);
  window._editingPlanId=null;
  const cid=state.savedPlan&&state.savedPlan.clientId;
  if(typeof builderLeaveToCaller==='function')builderLeaveToCaller({saved:true});
  else goTo('plans');
  if(window._onboardResumeAfterBuilder===cid){
    window._onboardResumeAfterBuilder=null;
    if(typeof renderOnboardBuilderBanner==='function')renderOnboardBuilderBanner();
  }
  if(cid&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(cid);
}
function builderRetryCalendar(state){
  state=state||window._builderSaveState;
  if(!state||!state.saved||state.finished||!state.calendar||!builderSaveFormCurrent(state))return Promise.resolve(null);
  const calendar=state.calendar;
  if(calendar.status==='pending')return calendar.promise;
  calendar.status='pending';calendar.error='';
  builderCalendarActions(state,false);
  builderSaveStatus('Plan zapisany. Sprawdzam terminy i dopełniam kalendarz…');
  calendar.promise=(async()=>{
    try{
      if(typeof window.refillCalendarConfirmed!=='function')throw new Error('Moduł kalendarza jest niedostępny. Odśwież aplikację i dopełnij kalendarz w profilu klienta.');
      const result=await window.refillCalendarConfirmed(calendar.clientId,{planId:calendar.planId,weeks:calendar.weeks});
      if(!result||!['saved','unchanged'].includes(result.status))
        throw new Error(result&&result.error||'Nie udało się potwierdzić zapisu terminów.');
      calendar.status='saved';
      if(builderSaveFormCurrent(state)){
        builderSaveStatus('Plan zapisany. Kalendarz uzupełniony; istniejące terminy zachowano.');
        builderFinishSavedPlan(state);
      }
      return result;
    }catch(error){
      calendar.status='error';
      calendar.error=error&&error.message||'Nie udało się potwierdzić zapisu terminów.';
      if(builderSaveFormCurrent(state)){
        builderSaveStatus('Plan zapisany. Dopełnienie kalendarza nie zostało potwierdzone. '+calendar.error+' Możesz ponowić samo dopełnienie; plan nie zostanie zapisany drugi raz.',true);
        builderCalendarActions(state,true);
      }
      return {status:'error',error:calendar.error};
    }
  })();
  return calendar.promise;
}
async function persistBuilderPlan(candidate,base,session){
  if(!builderSaveSessionCurrent(session))throw new Error('Sesja wygasła. Zaloguj się ponownie.');
  if(!window._db||typeof window._runTransaction!=='function'||typeof window._doc!=='function')throw new Error('Brak połączenia z bazą. Spróbuj ponownie.');
  if(candidate.trainerId!==session.uid||(base&&base.trainerId!==session.uid))throw new Error('Plan nie należy do bieżącego konta.');
  const docId=candidate._fbId||candidate.id;
  const ref=window._doc(window._db,'plans',docId);
  const payload=builderPlanClone(candidate);delete payload._fbId;
  const client=candidate.clientId?(window.CL||[]).find(c=>c.id===candidate.clientId):null;
  if(candidate.clientId&&(!client||client.trainerId!==session.uid))throw new Error('Klient jest niedostępny. Otwórz jego profil ponownie.');
  await window._runTransaction(window._db,async tx=>{
    if(!builderSaveSessionCurrent(session))throw new Error('Sesja wygasła.');
    if(client){
      const clientSnap=await tx.get(window._doc(window._db,'clients',client._fbId||client.id));
      if(!clientSnap.exists()||clientSnap.data().trainerId!==session.uid)throw new Error('Klient jest niedostępny. Otwórz jego profil ponownie.');
    }
    const snap=await tx.get(ref);
    if(snap.exists()){
      const raw=snap.data();
      if(raw.trainerId!==session.uid)throw new Error('Nie można zapisać tego planu na bieżącym koncie.');
      // clients/plans use the document ID, including legacy payloads without an id.
      const remote={...raw,id:candidate.id};
      if(!builderSaveSessionCurrent(session))throw new Error('Sesja wygasła.');
      if(builderPlanSignature(remote)===builderPlanSignature(payload))return;
      if(!base||builderPlanSignature(remote)!==builderPlanSignature(base))
        throw new Error('Plan zmienił się w innym oknie. Zachowaliśmy Twoją wersję w kreatorze; otwórz aktualny plan przed kolejną edycją.');
    }else if(base){
      throw new Error('Ten plan został usunięty. Zachowaliśmy treść w kreatorze.');
    }
    if(!builderSaveSessionCurrent(session))throw new Error('Sesja wygasła.');
    tx.set(ref,payload,{merge:true});
  });
  if(!builderSaveSessionCurrent(session))return null;
  return {...candidate,_fbId:docId};
}
async function savePlan(){
  const state=window._builderSaveState||builderResetSaveState();
  if(state.pending||state.saved)return null;
  if(!builderSaveSessionCurrent(state.session)){builderSaveStatus('Sesja wygasła. Otwórz kreator ponownie po zalogowaniu.',true);return null;}
  const retry=state.candidate;

  const name=document.getElementById('b-name').value.trim();
  if(!name){notify('Wpisz nazwę planu!');return;}
  const cid=document.getElementById('b-client').value;
  const c=CL.find(x=>x.id===cid);
  const editingId=window._editingPlanId;
  const prev=state.base||(editingId?(window.PL||[]).find(p=>p.id===editingId):null);
  if(editingId&&(!prev||prev.id!==editingId||prev.trainerId!==state.session.uid)){
    builderSaveStatus('Nie można edytować tego planu. Otwórz aktualny plan z biblioteki.',true);return null;
  }
  if(cid&&(!c||c.trainerId!==state.session.uid)){
    builderSaveStatus('Wybrany klient jest niedostępny. Wybierz klienta ponownie.',true);return null;
  }
  if(prev&&prev.clientId&&prev.clientId!==cid){
    builderSaveStatus('To plan przypisany do klienta. Aby przygotować plan dla innej osoby, utwórz nowy plan.',true);return null;
  }
  const dur=parseInt((document.getElementById('b-duration')||{}).value,10)||4;
  const weekMeta=builderWeekMetaForSave(prev,dur);
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
      const ex={
        name:n,
        sets:setN,
        reps:g('reps')||'10',
        kg:g('kg'),
        loadUnit:typeof exLoadUnit==='function'?exLoadUnit(n):'kg',
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
        dropStep:g('ss')?'':String(g('dropStep')||'').trim(),
        trans:g('trans').trim(),
        cluster:g('ss')?0:(typeof parseSetKindCount==='function'?parseSetKindCount(g('cluster'),3):(parseInt(g('cluster'),10)||0)),
        rp:g('ss')?0:(typeof parseSetKindCount==='function'?parseSetKindCount(g('rp'),2):(parseInt(g('rp'),10)||0)),
        amrap:g('amrap')==='1'
      };
      const loads=builderRowWeekLoads(r);
      (weekMeta.weekKeys||[]).forEach(wk=>{if(loads&&loads[wk])ex[wk]=loads[wk];});
      if(weekMeta.currentWeek){
        ex[weekMeta.currentWeek]={s:setN,r:g('reps')||'10',kg:g('kg'),rest:g('rest')||'90s',rpe:g('rpe'),rir:g('rir')};
      }
      exercises.push(ex);
      sets+=parseInt(setN,10)||3;
    });
    if(typeof applySsLabels==='function'){
      applySsLabels(exercises);
      exercises.forEach(e=>{e.ss=e.ssLetter||'';delete e.ssLabel;delete e.ssLetter;});
    }
    const row={day:dn,muscles,exercises,sets,rest:false,circuit:!!(de.querySelector('.circ')||{}).checked,roundRest:(de.querySelector('[data-f="roundRest"]')||{}).value||''};
    const wd=typeof planDayWeekday==='function'?planDayWeekday(row,days.filter(x=>x&&!x.rest).length):null;
    if(wd!=null)row.weekday=wd;
    days.push(row);
  });
  if(!days.length){notify('Dodaj przynajmniej jeden dzień!');return;}
  const progression=typeof normalizePlanProgression==='function'?normalizePlanProgression((document.getElementById('b-progression')||{}).value):'double';
  const candidate=retry||{
    ...(prev?builderPlanClone(prev):{id:newId('p'),createdAt:new Date().toISOString(),trainerId:state.session.uid}),
    name,method:document.getElementById('b-method').value,
    duration:document.getElementById('b-duration').value,
    progression,clientId:cid,clientName:c?c.name:'',
    level:c?c.level:(prev?prev.level:'sredni'),goal:c?c.goal:(prev?prev.goal:'masa'),
    days,...weekMeta,...(prev?{updatedAt:new Date().toISOString()}:{})
  };
  if(prev&&prev.rationale&&builderPlanRationaleChanged(prev,candidate))candidate.rationale=null;
  state.candidate=candidate;
  if(prev&&!state.base)state.base=builderPlanClone(prev);
  state.pending=true;
  builderSaveLock(state);
  const btn=document.getElementById('b-save-btn');
  if(btn){btn.disabled=true;btn.textContent='Zapisywanie…';}
  builderSaveStatus('Zapisywanie planu. Poczekaj na potwierdzenie.');
  let saved;
  try{
    saved=await persistBuilderPlan(candidate,state.base,state.session);
    if(!saved||!builderSaveSessionCurrent(state.session))return null;
    const idx=PL.findIndex(p=>p.id===saved.id);
    if(idx>=0)PL[idx]=saved;else PL.push(saved);
    state.saved=true;
    state.savedPlan=saved;
  }catch(e){
    if(builderSaveFormCurrent(state)){
      console.warn('Zapis planu niepotwierdzony:',e);
      builderSaveStatus((e&&e.message&&!e.code?e.message:'Nie udało się potwierdzić zapisu. Sprawdź połączenie z internetem.')+' Formularz jest zachowany. „Ponów zapis” wysyła te same dane.',true);
    }
    return null;
  }finally{
    state.pending=false;
    if(window._builderSaveState===state){
      // Keep the confirmed form locked until calendar completion or explicit exit.
      if(btn){btn.disabled=state.saved;btn.textContent=state.saved?'Zapisano plan':'Ponów zapis';}
    }
  }
  if(!builderSaveFormCurrent(state))return saved;
  builderSaveStatus('Plan zapisany.');
  notify(editingId?'Plan zaktualizowany!':'Plan zapisany!');
  // A confirmed plan and its calendar have independent outcomes and retries.
  const hasTraining=(saved.days||[]).some(day=>day&&!day.rest&&(day.exercises||[]).length);
  if(saved.clientId&&hasTraining){
    const weeks=Math.max(1,Math.min(12,Number(saved.duration)>=8?Number(saved.duration):4));
    const client=(window.CL||[]).find(item=>item.id===saved.clientId);
    const preferred=typeof normalizePreferredWeekdays==='function'
      ?normalizePreferredWeekdays(client&&client.preferredWeekdays):((client&&client.preferredWeekdays)||[]);
    if(preferred.length||confirm('Dopełnić kalendarz o brakujące treningi z zapisanego planu na '+weeks+' tygodni? Istniejące terminy pozostaną bez zmian.')){
      state.calendar={planId:saved.id,clientId:saved.clientId,weeks,status:'ready',error:'',promise:null};
      await builderRetryCalendar(state);
      return saved;
    }
  }
  builderFinishSavedPlan(state);
  return saved;
}

/** Mapuje etykietę dnia planu → JS getDay() (0=Nd … 6=Sob). */
function planDayLabelToWeekday(label,fallbackIdx){
  if(typeof parsePlanWeekdayFromText==='function'){
    const parsed=parsePlanWeekdayFromText(label);
    if(parsed!=null)return parsed;
  }
  const s=String(label||'').toUpperCase();
  const map={PON:1,WT:2,'ŚR':3,SR:3,CZ:4,PT:5,SO:6,ND:0,
    PONIEDZIALEK:1,WTOREK:2,SRODA:3,'ŚRODA':3,CZWARTEK:4,PIATEK:5,'PIĄTEK':5,SOBOTA:6,NIEDZIELA:0};
  for(const k of Object.keys(map)){if(s.startsWith(k)||s.includes(k+' ')||s.includes(k+':')||s.includes(k+'—')||s.includes(k+'-'))return map[k];}
  const defaults=[1,3,5,2,4,6,1]; // Pon/Śr/Pt/Wt/Czw/Sob
  return defaults[(fallbackIdx||0)%defaults.length];
}
/** Unikalne dni tygodnia: najpierw preferencje, potem wolne Pon–Nd — bez owijania dwóch treningów na ten sam dzień. */
function uniqueWeekdaysForTrainDays(trainCount,preferredWeekdays){
  const n=Math.max(0,Number(trainCount)||0);
  const pref=typeof normalizePreferredWeekdays==='function'?normalizePreferredWeekdays(preferredWeekdays):((preferredWeekdays)||[]);
  const out=[];const used=new Set();
  pref.forEach(d=>{if(out.length<n&&!used.has(d)){used.add(d);out.push(d);}});
  [1,2,3,4,5,6,0].forEach(d=>{if(out.length<n&&!used.has(d)){used.add(d);out.push(d);}});
  return out;
}
function resolvePlanDayWeekday(dayOrLabel,dayIdx,preferredWeekdays){
  const idx=Math.max(0,Number(dayIdx)||0);
  const day=dayOrLabel&&typeof dayOrLabel==='object'?dayOrLabel:{day:dayOrLabel};
  if(typeof planDayWeekday==='function')return planDayWeekday(day,idx,preferredWeekdays);
  const fromName=planDayLabelToWeekday(day.day||day.dayName||day.name||dayOrLabel,idx);
  if(fromName!=null&&(day.day||day.dayName||day.name||dayOrLabel)){
    const parsed=typeof parsePlanWeekdayFromText==='function'?parsePlanWeekdayFromText(day.day||day.dayName||day.name||dayOrLabel):null;
    if(parsed!=null)return parsed;
  }
  const pref=typeof normalizePreferredWeekdays==='function'?normalizePreferredWeekdays(preferredWeekdays):((preferredWeekdays)||[]);
  if(pref.length){
    const map=uniqueWeekdaysForTrainDays(idx+1,pref);
    if(map[idx]!=null)return map[idx];
  }
  return fromName;
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
/** Usuwa sesje source=planned klienta od danej daty (domyślnie dziś) — stary plan nie zostaje pod nowym. */
function dropPlannedSessionsFrom(clientId,fromYmd){
  const cid=String(clientId||'');
  const from=String(fromYmd||(typeof todayYmd==='function'?todayYmd():'')||'').slice(0,10);
  if(!cid)return 0;
  const list=window.SE||[];
  const drop=[];
  for(let i=list.length-1;i>=0;i--){
    const s=list[i];
    const d=String(s&&s.date||'').slice(0,10);
    if(s&&s.clientId===cid&&s.source==='planned'&&(!from||d>=from)){
      drop.push(s);
      list.splice(i,1);
    }
  }
  drop.forEach(s=>{
    if(window._db&&typeof window._del==='function'&&typeof window._doc==='function'){
      try{window._del(window._doc(window._db,'sessions',s.id));}catch(e){}
    }
  });
  return drop.length;
}
/** Tworzy sesje kalendarzowe z dni planu (planId + dayIdx) na N tygodni do przodu. */
function schedulePlanToCalendar(planId,opts){
  const plan=PL.find(p=>p.id===planId);if(!plan){notify('Brak planu');return 0;}
  if(!plan.clientId){notify('Przypisz plan do klienta, żeby dodać do kalendarza');return 0;}
  if(!(opts&&opts.forceAccess)&&typeof assertClientPaidAccess==='function'&&!assertClientPaidAccess(plan.clientId))return 0;
  const client=CL.find(x=>x.id===plan.clientId);
  const weeks=Math.max(1,Math.min(12,(opts&&opts.weeks)||4));
  const time=(opts&&opts.time)||scheduleTimeFromClient(client,'18:00');
  const duration=(opts&&opts.duration)||60;
  const preferred=(opts&&opts.weekdays)!=null?(opts.weekdays):(client&&client.preferredWeekdays)||[];
  const trainDays=(plan.days||[]).map((d,i)=>({d,i})).filter(x=>x.d&&!x.d.rest&&(x.d.exercises||[]).length);
  if(!trainDays.length){notify('Plan nie ma dni treningowych');return 0;}
  if(typeof hydratePlanDaysWeekdays==='function'&&hydratePlanDaysWeekdays(plan,preferred)){
    try{if(typeof persistById==='function')persistById('plans',plan);}catch(e){}
  }
  const today=new Date();today.setHours(0,0,0,0);
  const todayStr=typeof dateStr==='function'?dateStr(today):(typeof todayYmd==='function'?todayYmd():today.toISOString().slice(0,10));
  if(typeof dropPlannedSessionsFrom==='function')dropPlannedSessionsFrom(plan.clientId,todayStr);
  let created=0;
  for(let w=0;w<weeks;w++){
    trainDays.forEach(({d,i},trainI)=>{
      const wd=resolvePlanDayWeekday(d,trainI,preferred);
      const dt=new Date(today);
      const cur=dt.getDay();
      let add=(wd-cur+7)%7;
      if(add===0&&w===0)add=0; // dziś OK
      dt.setDate(dt.getDate()+add+w*7);
      const ymd=typeof dateStr==='function'?dateStr(dt):dt.toISOString().slice(0,10);
      const exists=SE.some(s=>s.clientId===plan.clientId&&s.date===ymd&&s.source==='planned');
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
window.uniqueWeekdaysForTrainDays=uniqueWeekdaysForTrainDays;
window.resolvePlanDayWeekday=resolvePlanDayWeekday;
window.scheduleTimeFromClient=scheduleTimeFromClient;
window.dropPlannedSessionsFrom=dropPlannedSessionsFrom;

/** Auto-kalendarz gdy klient ma preferredWeekdays; inaczej confirm. */
function maybeSchedulePlanToCalendar(planId,opts){
  const plan=(window.PL||[]).find(p=>p.id===planId);
  if(!plan||!plan.clientId||typeof schedulePlanToCalendar!=='function')return 0;
  if(!(opts&&opts.forceAccess)&&typeof assertClientPaidAccess==='function'&&!assertClientPaidAccess(plan.clientId))return 0;
  const client=(window.CL||[]).find(x=>x.id===plan.clientId);
  const pref=typeof normalizePreferredWeekdays==='function'
    ?normalizePreferredWeekdays(client&&client.preferredWeekdays)
    :((client&&client.preferredWeekdays)||[]);
  const weeks=(opts&&opts.weeks)||4;
  const forceConfirm=opts&&opts.forceConfirm;
  if(pref.length&&!forceConfirm){
    const n=schedulePlanToCalendar(planId,{weeks,weekdays:pref,forceAccess:true});
    if(n>0){
      const labels=typeof preferredWeekdaysLabels==='function'?preferredWeekdaysLabels(pref).join('/'):pref.join(',');
      const time=typeof scheduleTimeFromClient==='function'?scheduleTimeFromClient(client,'18:00'):'18:00';
      if(typeof notify==='function')notify('📅 Zaplanowano '+n+' sesji ('+labels+' · '+time+')');
    }
    return n;
  }
  const msg=(opts&&opts.confirmMsg)||'Dodać dni planu do kalendarza na najbliższe 4 tygodnie?';
  if(confirm(msg))return schedulePlanToCalendar(planId,{weeks,forceAccess:true});
  return 0;
}
window.maybeSchedulePlanToCalendar=maybeSchedulePlanToCalendar;

/** Dopełnij kalendarz klienta o kolejne tygodnie z jego planu. */
function refillClientCalendar(clientId,opts){
  if(typeof window.refillCalendarConfirmed==='function')return window.refillCalendarConfirmed(clientId,opts);
  if(typeof notify==='function')notify('Odśwież aplikację, aby dopełnić kalendarz.');
  return Promise.resolve({status:'error',error:'Moduł kalendarza jest niedostępny'});
}
window.refillClientCalendar=refillClientCalendar;

// ════════════════════════════════════════
// PLANS
// ════════════════════════════════════════
// Kolor akcentu karty wg metody treningowej — ten sam wzorzec co w Zasobach i Bibliotece ćwiczeń.
const PLAN_METHOD_COLORS={PPL:'var(--accent)',FBW:'var(--teal)',UL:'var(--blue)','531':'var(--purple)',HIIT:'var(--red)',GZCLP:'var(--orange)',Obwodowy:'var(--orange)',Circuit:'var(--orange)'};
const PLANS_VIEW_KEY='pl_plans_view';
var plansLibStatus='active';
var plansLibSort='newest';
var plansLibClientId='';
var plansLibView=(function(){
  try{
    const v=localStorage.getItem(PLANS_VIEW_KEY);
    if(v==='cards'||v==='table')return v;
  }catch(e){}
  return 'table';
})();

function planIsUnassigned(p){return !p||!p.clientId;}
function planIsArchived(p){return !!(p&&(p.archived===true||p.status==='archived'));}
function planStamp(p){return String((p&&(p.updatedAt||p.createdAt))||'');}
function planDateLabel(p){
  const y=String(planStamp(p)).slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(y)?y:'—';
}
function planStatusMeta(p){
  if(planIsArchived(p))return{key:'archived',label:'Archiwum',pill:'pill-muted'};
  if(planIsUnassigned(p))return{key:'template',label:'Szablon',pill:'pill-blue'};
  return{key:'active',label:'Aktywny',pill:'pill-green'};
}
function filterSortPlans(plans,clients,opts){
  const o=opts||{};
  const search=String(o.search||'').trim().toLowerCase();
  const status=o.status||'active';
  const clientId=o.clientId||'';
  const sort=o.sort||'newest';
  const byId={};
  (clients||[]).forEach(c=>{if(c&&c.id)byId[c.id]=c;});
  let list=(plans||[]).filter(p=>{
    if(!p)return false;
    const archived=planIsArchived(p);
    const unassigned=planIsUnassigned(p);
    if(status==='archived'){if(!archived)return false;}
    else if(status==='templates'){if(archived||!unassigned)return false;}
    else if(archived||unassigned)return false;
    if(clientId&&p.clientId!==clientId)return false;
    if(search){
      const client=byId[p.clientId];
      const clientName=String(client&&client.name||p.clientName||'').toLowerCase();
      const name=String(p.name||'').toLowerCase();
      if(!clientName.includes(search)&&!name.includes(search))return false;
    }
    return true;
  });
  list=list.slice().sort((a,b)=>{
    if(sort==='alpha')return String(a.name||'').localeCompare(String(b.name||''),'pl',{sensitivity:'base'});
    const da=Date.parse(planStamp(a))||0;
    const db=Date.parse(planStamp(b))||0;
    return sort==='oldest'?da-db:db-da;
  });
  return list;
}
window.planIsUnassigned=planIsUnassigned;
window.planIsArchived=planIsArchived;
window.planStamp=planStamp;
window.planDateLabel=planDateLabel;
window.planStatusMeta=planStatusMeta;
window.filterSortPlans=filterSortPlans;

function setPlansLibStatus(s){
  plansLibStatus=s==='templates'||s==='archived'?s:'active';
  renderPlans();
}
function setPlansLibSort(s){
  plansLibSort=s==='oldest'||s==='alpha'?s:'newest';
  renderPlans();
}
function setPlansLibClient(id){
  plansLibClientId=String(id||'');
  renderPlans();
}
function setPlansLibView(v){
  plansLibView=v==='cards'?'cards':'table';
  try{localStorage.setItem(PLANS_VIEW_KEY,plansLibView);}catch(e){}
  renderPlans();
}
window.setPlansLibStatus=setPlansLibStatus;
window.setPlansLibSort=setPlansLibSort;
window.setPlansLibClient=setPlansLibClient;
window.setPlansLibView=setPlansLibView;

function planActionButtons(p,client){
  const hasClient=!!client;
  const arch=planIsArchived(p);
  const id=p.id;
  return `<button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();togglePlanExpand('${id}')" id="plan-toggle-${id}">👁️ Podgląd</button>
    <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();exportSavedPlanPDF('${id}')" title="PDF" id="plan-pdf-${id}">📄</button>
    <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();editPlan('${id}')" title="Edytuj">✏️</button>
    ${hasClient?`<button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();openClientProfile('${client.id}')" title="Profil">👤</button>`:''}
    ${arch
      ?`<button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();restorePlan('${id}')" title="Przywróć">↩</button>`
      :`<button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();archivePlan('${id}')" title="Archiwizuj">📦</button>`}
    <button class="btn btn-danger btn-sm" type="button" onclick="event.stopPropagation();delPlan('${id}')" title="Usuń">🗑️</button>`;
}

function renderPlans(){
  const el=document.getElementById('plans-content');
  if(!el)return;
  const search=(document.getElementById('plans-search')||{}).value?.trim().toLowerCase()||'';
  const all=window.PL||[];
  const clients=window.CL||[];
  const nActive=all.filter(p=>!planIsArchived(p)&&!planIsUnassigned(p)).length;
  const nTpl=all.filter(p=>!planIsArchived(p)&&planIsUnassigned(p)).length;
  const nArch=all.filter(p=>planIsArchived(p)).length;
  const setN=(id,n)=>{const e=document.getElementById(id);if(e)e.textContent=n;};
  setN('plans-n-active',nActive);setN('plans-n-templates',nTpl);setN('plans-n-archived',nArch);
  ['active','templates','archived'].forEach(s=>{
    const b=document.getElementById('plans-st-'+s);
    if(b)b.classList.toggle('is-on',plansLibStatus===s);
  });
  const sortEl=document.getElementById('plans-sort');
  if(sortEl&&sortEl.value!==plansLibSort)sortEl.value=plansLibSort;
  const clientSel=document.getElementById('plans-client');
  if(clientSel){
    const opts=['<option value="">Wszyscy podopieczni</option>'].concat(
      clients.filter(c=>c&&c.id&&c.status!=='archived').slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pl'))
        .map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name||c.id)}</option>`)
    );
    clientSel.innerHTML=opts.join('');
    clientSel.value=plansLibClientId;
    clientSel.disabled=plansLibStatus==='templates';
  }
  const vc=document.getElementById('plans-view-cards');
  const vt=document.getElementById('plans-view-table');
  if(vc)vc.classList.toggle('is-on',plansLibView==='cards');
  if(vt)vt.classList.toggle('is-on',plansLibView==='table');

  const list=filterSortPlans(all,clients,{search,status:plansLibStatus,clientId:plansLibClientId,sort:plansLibSort});
  const emptyHint=plansLibStatus==='templates'
    ?'Tu lądują kopie bez przypisanego klienta. Mikrocykle są w Bibliotece szablonów.'
    :plansLibStatus==='archived'
      ?'Zarchiwizowane plany nie mieszają się z aktywnymi.'
      :'Twórz i przypisuj plany z profilu klienta → zakładka Plan.';
  if(!list.length){
    el.innerHTML=`<div style="text-align:center;color:var(--muted);padding:60px 20px;">
    <div style="font-size:36px;margin-bottom:10px;opacity:0.35;">📋</div>
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">${search||plansLibClientId?'Brak planów pasujących do filtrów':'Brak planów w tej zakładce'}</div>
    <div style="font-size:12px;margin-bottom:16px;">${emptyHint}</div>
    ${search||plansLibClientId?'':`<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" onclick="goTo('clients')">Otwórz klientów</button>
      <button class="btn btn-ghost btn-sm" onclick="goTo('templates')">📋 Biblioteka szablonów</button>
    </div>`}
  </div>`;return;}

  const cardHtml=(p,pi)=>{
    const client=clients.find(c=>c.id===p.clientId);
    const clientName=client?.name||p.clientName||'Bez klienta';
    const hasClient=!!client;
    const dayChips=(p.days||[]).map(d=>d.rest?'💤':(d.day||d.dayName||d.muscles||d.focus||d.name||'—')).slice(0,6);
    const accentCol=PLAN_METHOD_COLORS[p.method]||'var(--muted)';
    const st=planStatusMeta(p);
    const nm=typeof escHtml==='function'?escHtml(p.name||''):String(p.name||'');
    const cn=typeof escHtml==='function'?escHtml(clientName):String(clientName);
    return `<div class="plan-card" id="plan-card-${p.id}" style="animation-delay:${pi*0.03}s;">
      <div class="plan-card-accent" style="background:${accentCol};"></div>
      <div style="padding:16px 18px;">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          ${hasClient?`<div style="width:36px;height:36px;border-radius:9px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--accent);flex-shrink:0;">${getInit(clientName)}</div>`:'<div style="width:36px;height:36px;border-radius:9px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>'}
          <div style="min-width:0;flex:1;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <div style="font-size:15px;font-weight:700;color:var(--text);line-height:1.3;">${nm}</div>
              <span class="pill ${st.pill}"><span class="pill-dot"></span>${st.label}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">${hasClient?'👤 '+cn:'Brak klienta'} · ⏱️ ${p.duration||'?'} tyg. · ${planDateLabel(p)}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
          ${dayChips.map(d=>`<span class="plan-day-chip">${typeof escHtml==='function'?escHtml(String(d)):d}</span>`).join('')}
        </div>
        <div class="plan-card-actions">${planActionButtons(p,client)}</div>
      </div>
      <div id="plan-detail-${p.id}" class="plan-card-detail" style="display:none;">
        ${(p.days||[]).map(d=>planDayPreviewHtml(d,p.clientId)).join('')}
      </div>
    </div>`;
  };

  if(plansLibView==='table'){
    el.innerHTML=`<div class="plans-tbl-wrap">
      <div class="plans-tbl-hdr" role="row">
        <span>Data</span><span>Nazwa planu</span><span>Podopieczny</span><span>Czas</span><span>Status</span><span>Akcje</span>
      </div>
      ${list.map((p,pi)=>{
        const client=clients.find(c=>c.id===p.clientId);
        const clientName=client?.name||p.clientName||'—';
        const st=planStatusMeta(p);
        const nm=typeof escHtml==='function'?escHtml(p.name||''):String(p.name||'');
        const cn=typeof escHtml==='function'?escHtml(clientName):String(clientName);
        return `<div class="plans-tbl-row plan-card" id="plan-card-${p.id}" style="animation-delay:${pi*0.02}s;">
          <span class="plans-tbl-date">${planDateLabel(p)}</span>
          <span class="plans-tbl-name">${nm}</span>
          <span class="plans-tbl-client">${client?'👤 '+cn:'—'}</span>
          <span>${p.duration||'—'} tyg.</span>
          <span><span class="pill ${st.pill}"><span class="pill-dot"></span>${st.label}</span></span>
          <span class="plans-tbl-actions">${planActionButtons(p,client)}</span>
          <div id="plan-detail-${p.id}" class="plan-card-detail plans-tbl-detail" style="display:none;">
            ${(p.days||[]).map(d=>planDayPreviewHtml(d,p.clientId)).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
    return;
  }
  el.innerHTML=`<div class="plans-grid">`+list.map((p,pi)=>cardHtml(p,pi)).join('')+`</div>`;
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

async function archivePlan(id){
  const p=(window.PL||[]).find(x=>x&&x.id===id);
  if(!p){notify('Nie znaleziono planu');return;}
  if(planIsArchived(p)){notify('Plan jest już w archiwum');return;}
  if(!confirm('Zarchiwizować plan? Zniknie z listy aktywnych.'))return;
  p.archived=true;
  p.updatedAt=new Date().toISOString();
  try{if(typeof persistById==='function')await persistById('plans',p);}catch(e){console.warn('archivePlan:',e);}
  renderPlans();
  notify('Plan w archiwum');
}
async function restorePlan(id){
  const p=(window.PL||[]).find(x=>x&&x.id===id);
  if(!p){notify('Nie znaleziono planu');return;}
  p.archived=false;
  if(p.status==='archived')delete p.status;
  p.updatedAt=new Date().toISOString();
  try{if(typeof persistById==='function')await persistById('plans',p);}catch(e){console.warn('restorePlan:',e);}
  renderPlans();
  notify('Plan przywrócony');
}
window.archivePlan=archivePlan;
window.restorePlan=restorePlan;

// ════════════════════════════════════════
// CALENDAR V2 — WEEK / MONTH / LIST
// ════════════════════════════════════════
var calView='week';
var calCurrentDate=new Date();
var calMiniDate=new Date();
var calSelectedDate=null;

const CAL_HOURS=Array.from({length:24},(_,i)=>i); // 0-23
const CAL_HOUR_H=60;
const CAL_WEEK_H0=6;
const CAL_WEEK_H1=23;
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

function dateStr(d){
  if(typeof dateStrLocal==='function')return dateStrLocal(d);
  const x=d instanceof Date?d:new Date(d);
  if(isNaN(x.getTime()))return '';
  const p=n=>String(n).padStart(2,'0');
  return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
}

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

function calSessionDoneBits(s){
  const happened=typeof sessionHappened==='function'&&sessionHappened(s);
  const tipRaw=typeof sessionHappenedTip==='function'?sessionHappenedTip(s):((s&&s.type||'')+' '+(s&&s.time||''));
  const tip=typeof escHtml==='function'?escHtml(tipRaw):String(tipRaw||'').replace(/"/g,'&quot;');
  return{happened,cls:happened?' cal-session-done':'',mark:happened?'✓ ':'',tip};
}
window.calSessionDoneBits=calSessionDoneBits;
function calSalaDoneBtn(s){
  if(!s||s.source!=='planned')return '';
  const happened=typeof sessionHappened==='function'&&sessionHappened(s);
  if(happened)return '';
  const sid=String(s.id||'').replace(/\\/g,'').replace(/'/g,"\\'");
  return `<button type="button" class="btn btn-primary btn-sm cal-sala-done" onclick="event.stopPropagation();openSalaDoneModal('${sid}')">✓ Odbył się</button>`;
}
window.calSalaDoneBtn=calSalaDoneBtn;
function calSessionTimeKey(s){
  const parts=String(s&&s.time||'').split(':');
  const h=parseInt(parts[0],10);
  const m=parseInt(parts[1],10);
  if(!isFinite(h))return '';
  return String(h).padStart(2,'0')+':'+String(isFinite(m)?m:0).padStart(2,'0');
}
function calSessionIsLogged(s){
  if(!s)return false;
  if(typeof isLoggedWorkout==='function')return isLoggedWorkout(s);
  return s.source==='live'||s.source==='sala'||s.source==='client'||s.source==='homework';
}
/** Jedna karta na klienta+dzień+godzinę; plan znika, gdy jest zapis z tego dnia. */
function calDedupeVisibleSessions(list){
  const src=(list||[]).filter(s=>s&&s.source!=='live-draft');
  const loggedDays=new Set();
  src.forEach(s=>{
    if(calSessionIsLogged(s)&&s.clientId&&s.date)loggedDays.add(String(s.clientId)+'|'+String(s.date).slice(0,10));
  });
  const filtered=src.filter(s=>{
    if(s.source!=='planned'||!s.clientId||!s.date)return true;
    return !loggedDays.has(String(s.clientId)+'|'+String(s.date).slice(0,10));
  });
  const byKey=Object.create(null);
  const order=[];
  filtered.forEach(s=>{
    const d=String(s.date||'').slice(0,10);
    const t=calSessionTimeKey(s);
    const cid=String(s.clientId||'');
    const type=String(s.type||s.title||'').toLowerCase().replace(/\s+/g,' ').trim();
    const key=cid?cid+'|'+d+'|'+t:'anon|'+d+'|'+t+'|'+type;
    if(!byKey[key]){
      byKey[key]=s;
      order.push(key);
      return;
    }
    const cur=byKey[key];
    const rs=calSessionIsLogged(s)?2:(s.source==='garmin'?1:0);
    const rc=calSessionIsLogged(cur)?2:(cur.source==='garmin'?1:0);
    if(rs>rc)byKey[key]=s;
  });
  return order.map(k=>byKey[k]);
}
function calVisibleSessions(list){
  return calDedupeVisibleSessions(list||window.SE||[]);
}
window.calSessionTimeKey=calSessionTimeKey;
window.calDedupeVisibleSessions=calDedupeVisibleSessions;
window.calVisibleSessions=calVisibleSessions;

function calSessionStartMin(s){
  const parts=String(s&&s.time||'0:0').split(':');
  const h=parseInt(parts[0],10);
  const m=parseInt(parts[1],10);
  return (isFinite(h)?h:0)*60+(isFinite(m)?m:0);
}
function calSessionEndMin(s){
  const dur=parseInt(s&&s.duration,10);
  return calSessionStartMin(s)+(isFinite(dur)&&dur>0?dur:60);
}
/** Godzina wiersza w tygodniu (jak w miesiącu: karty idą w dół po czasie). */
function calWeekHourBucket(s,h0,h1){
  const start=h0==null?CAL_WEEK_H0:h0;
  const end=h1==null?CAL_WEEK_H1:h1;
  const hr=Math.floor(calSessionStartMin(s)/60);
  if(!isFinite(hr))return start;
  return Math.max(start,Math.min(end-1,hr));
}
function calWeekSessChip(s){
  const c=CL.find(x=>x.id===s.clientId);
  const cIdx=c?CL.indexOf(c):-1;
  const col=s.source==='garmin'?'#007cc3':SESS_COLORS[(cIdx>=0?cIdx:0)%6];
  const bits=typeof calSessionDoneBits==='function'?calSessionDoneBits(s):{cls:'',mark:'',tip:''};
  const who=c?c.name:'Klient';
  const first=c?c.name.split(' ')[0]:'Klient';
  const sid=s&&s.id?String(s.id).replace(/"/g,''):'';
  const typeBit=s&&s.type?String(s.type):'';
  const tipRaw=who+(typeBit?' — '+typeBit:'')+(bits.happened?' · odbył się':'')+' — '+(bits.tip||'');
  const tip=typeof escHtml==='function'?escHtml(tipRaw):String(tipRaw).replace(/"/g,'&quot;');
  return `<div class="cal-session-block${bits.cls} cal-week-sess" data-cal-sess="${sid}" style="background:var(--input-bg);border:1px solid rgba(255,255,255,0.1);border-left:3px solid ${col};color:var(--text);min-width:0;max-width:100%;" onclick="event.stopPropagation();editSession('${s.id}')" title="${tip}">
      <div class="cal-session-name">${bits.mark}${s.source==='garmin'?'⌚ ':''}<span class="cal-week-sess-time">${s.time||''}</span> ${first}</div>
      ${typeof calSalaDoneBtn==='function'?calSalaDoneBtn(s):''}
    </div>`;
}
window.calSessionStartMin=calSessionStartMin;
window.calSessionEndMin=calSessionEndMin;
window.calWeekHourBucket=calWeekHourBucket;

function renderCalWeek(){
  const ws=getWeekStart(calCurrentDate);
  const today=new Date();today.setHours(0,0,0,0);
  const hdr=document.getElementById('cal-week-header');
  if(!hdr)return;
  hdr.style.display='grid';
  hdr.style.gridTemplateColumns='60px repeat(7,minmax(0,1fr))';
  hdr.style.minWidth='0';
  hdr.style.width='100%';
  const h0=CAL_WEEK_H0;
  const h1=CAL_WEEK_H1;

  // header — dni tygodnia
  let hdrHTML='<div style="height:48px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--s1);position:sticky;top:0;z-index:6;"></div>';
  for(let i=0;i<7;i++){
    const d=new Date(ws);d.setDate(d.getDate()+i);
    const isToday=dateStr(d)===dateStr(today);
    const dayCount=calVisibleSessions().filter(s=>s.date===dateStr(d)).length;
    hdrHTML+=`<div class="cal-week-day-hdr${isToday?' today':''}" style="border-bottom:1px solid var(--border);">
      <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${CAL_DAYS_PL[i]}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${isToday?'var(--accent)':'var(--text)'};">${d.getDate()}</div>
      ${dayCount?`<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);margin:0 auto;"></div>`:'<div style="width:6px;height:6px;"></div>'}
    </div>`;
  }
  hdr.innerHTML=hdrHTML;

  // siatka godzin × dni: karty w komórce godziny, jedna pod drugą (jak w miesiącu)
  const grid=document.getElementById('cal-week-grid');
  grid.style.display='grid';
  grid.style.gridTemplateColumns='60px repeat(7,minmax(0,1fr))';
  grid.style.minWidth='0';
  grid.style.width='100%';
  let gridHTML='';
  const now=new Date();
  const nowHour=now.getHours();
  const nowMin=now.getMinutes();
  const todayIdx=[...Array(7)].findIndex((_,i)=>{const d=new Date(ws);d.setDate(d.getDate()+i);return dateStr(d)===dateStr(today);});

  const byDay=[];
  for(let i=0;i<7;i++){
    const d=new Date(ws);d.setDate(d.getDate()+i);
    const ds=dateStr(d);
    const list=calVisibleSessions().filter(s=>s&&s.date===ds)
      .sort((a,b)=>calSessionStartMin(a)-calSessionStartMin(b)||String(a.id||'').localeCompare(String(b.id||'')));
    byDay.push({ds,list});
  }

  for(let h=h0;h<h1;h++){
    gridHTML+=`<div class="cal-hour-label" data-cal-hour="${h}">${String(h).padStart(2,'0')}:00</div>`;
    for(let i=0;i<7;i++){
      const {ds,list}=byDay[i];
      const isToday=i===todayIdx;
      const chips=list.filter(s=>calWeekHourBucket(s,h0,h1)===h).map(calWeekSessChip).join('');
      gridHTML+=`<div class="cal-cell${isToday?' today-col':''}" data-cal-day="${ds}" data-cal-hour="${h}" onclick="quickAddSession('${ds}','${String(h).padStart(2,'0')}:00')">${chips}</div>`;
    }
  }

  grid.innerHTML=gridHTML;
  grid.style.position='relative';

  const scroll=document.getElementById('cal-week-scroll');
  if(scroll){
    const lab=grid.querySelector('.cal-hour-label[data-cal-hour="8"]')||grid.querySelector('.cal-hour-label[data-cal-hour="7"]');
    if(lab)scroll.scrollTop=Math.max(0,lab.offsetTop-8);
  }

  if(todayIdx>=0&&nowHour>=h0&&nowHour<h1){
    const lab=grid.querySelector('.cal-hour-label[data-cal-hour="'+nowHour+'"]');
    const topPx=lab?lab.offsetTop+(nowMin/60)*lab.offsetHeight:((nowHour-h0)*CAL_HOUR_H)+(nowMin/60*CAL_HOUR_H);
    const line=document.createElement('div');
    line.className='cal-time-now';
    line.style.top=topPx+'px';
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
    const daySess=calVisibleSessions().filter(s=>s.date===ds);
    const isToday=ds===dateStr(today);
    html+=`<div class="cal-month-cell${isToday?' today':''}" onclick="calClickDay('${ds}')">
      <div style="font-size:12px;font-weight:${isToday?700:500};color:${isToday?'var(--accent)':'var(--text)'};">${d}</div>
      ${daySess.slice(0,3).map(s=>{
        const c=CL.find(x=>x.id===s.clientId);
        const ci=c?CL.indexOf(c):-1;
        const col=SESS_COLORS[(ci>=0?ci:0)%6];
        const bits=typeof calSessionDoneBits==='function'?calSessionDoneBits(s):{cls:'',mark:'',tip:''};
        return `<div class="cal-month-sess${bits.cls}" style="background:var(--input-bg);border-left:3px solid ${col};color:var(--text);" onclick="event.stopPropagation();editSession('${s.id}')" title="${bits.tip}"><div class="cal-month-sess-line">${bits.mark}<span style="color:var(--muted);">${s.time||''}</span> ${c?c.name.split(' ')[0]:'Klient'}</div>${typeof calSalaDoneBtn==='function'?calSalaDoneBtn(s):''}</div>`;
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
  const upcoming=calVisibleSessions().filter(s=>s.date>=startStr&&s.date<=endStr).sort((a,b)=>a.date.localeCompare(b.date)||((a.time||'').localeCompare(b.time||'')));

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
        const bits=typeof calSessionDoneBits==='function'?calSessionDoneBits(s):{cls:'',mark:'',tip:''};
        return `<div class="cal-list-sess${bits.cls}" onclick="editSession('${s.id}')" title="${bits.tip}">
          <div style="width:4px;border-radius:2px;background:${col};flex-shrink:0;align-self:stretch;"></div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:${col};min-width:44px;line-height:1.1;">${s.time||'—'}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">${bits.mark}${s.source==='garmin'?'⌚ ':''}${c?c.name:'Klient'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${s.source==='garmin'?'Garmin · ':''}${s.type||'Sesja'} · ${s.duration||60} min${bits.happened?' · odbył się':''}</div>
            ${s.notes?`<div style="font-size:11px;color:var(--muted2);margin-top:3px;font-style:italic;">${s.notes}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-self:center;">
            ${typeof calSalaDoneBtn==='function'?calSalaDoneBtn(s):''}
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
    const hasDone=typeof sessionHappened==='function'&&SE.some(s=>s.date===ds&&sessionHappened(s));
    const isSel=calSelectedDate===ds;
    html+=`<div class="cal-mini-day${isToday?' today':hasDone?' has-done':hasSess?' has-sess':''}${isSel?' selected':''}" onclick="calJumpTo('${ds}')">${d}</div>`;
  }
  const grid=document.getElementById('cal-mini-grid');
  if(grid)grid.innerHTML=html;
}

function renderCalSidebar(){
  const today=new Date();
  const ws=getWeekStart(calCurrentDate);
  const we=new Date(ws);we.setDate(we.getDate()+6);
  const wsStr=dateStr(ws);const weStr=dateStr(we);
  const weekSess=calVisibleSessions().filter(s=>s.date>=wsStr&&s.date<=weStr);

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
      <div class="ui-kpi-mini-val" style="color:var(--teal);">${weekSess.filter(s=>typeof sessionIsRecorded==='function'&&sessionIsRecorded(s)).length}</div>
      <div class="ui-kpi-mini-lbl">Odbyte</div>
    </div>
    <div class="ui-kpi-mini">
      <div class="ui-kpi-mini-val" style="color:var(--orange);">${calVisibleSessions().filter(s=>s.date===dateStr(today)).length}</div>
      <div class="ui-kpi-mini-lbl">Dziś</div>
    </div>`;

  // upcoming
  const nowStr=dateStr(today);
  const up=calVisibleSessions().filter(s=>s.date>=nowStr).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')).slice(0,6);
  const upEl=document.getElementById('cal-upcoming');
  if(!upEl)return;
  upEl.innerHTML=!up.length?'<div class="ui-section-sub" style="text-align:center;padding:24px 0;">Brak nadchodzących sesji</div>'
    :up.map(s=>{
      const c=CL.find(x=>x.id===s.clientId);
      const ci=c?CL.indexOf(c):-1;
      const col=SESS_COLORS[(ci>=0?ci:0)%6];
      const d=new Date(s.date+'T12:00:00');
      const isToday=s.date===nowStr;
      const bits=typeof calSessionDoneBits==='function'?calSessionDoneBits(s):{cls:'',mark:'',tip:''};
      return `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;" onclick="editSession('${s.id}')" title="${bits.tip}">
        <div style="text-align:center;min-width:40px;">
          <div style="font-size:var(--font-size-label);color:var(--text-label);font-weight:600;">${isToday?'Dziś':CAL_DAYS_PL[(d.getDay()+6)%7]}</div>
          <div class="ui-kpi-mini-val" style="font-size:22px;color:${col};">${d.getDate()}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--font-size-sm);font-weight:700;color:var(--text-primary);">${bits.mark}${c?c.name:'Klient'}</div>
          <div style="font-size:var(--font-size-label);color:var(--text-label);margin-top:4px;">${s.time||'—'} · ${s.type||'Sesja'}${bits.happened?' · odbył się':''}</div>
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
  openM('m-session');
  asSetClientField('','');
  const d=document.getElementById('as-date');
  const t=document.getElementById('as-time');
  if(d)d.value=date;
  if(t)t.value=time;
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
  window._editingSessionId=id;
  asSetClientField(s.clientId||'',c?c.name:'');
  document.getElementById('as-date').value=s.date;
  document.getElementById('as-time').value=s.time||'';
  const typeEl=document.getElementById('as-type');
  if(typeEl){
    const ty=s.type||'';
    if(ty&&![...typeEl.options].some(o=>o.value===ty)){
      const opt=document.createElement('option');
      opt.value=ty;opt.textContent=ty;
      typeEl.appendChild(opt);
    }
    typeEl.value=ty;
  }
  document.getElementById('as-notes').value=s.notes||'';
  const durEl=document.getElementById('as-duration');
  if(durEl)durEl.value=s.duration||60;
  const del=document.getElementById('as-del-btn');
  if(del)del.style.display='';
  const titleEl=document.querySelector('#m-session .modal-title');
  if(titleEl)titleEl.textContent=s.source==='planned'?'TERMIN PLANU':'SESJA';
  const salaBar=document.getElementById('as-sala-done');
  if(salaBar){
    const pending=s.source==='planned'&&!(typeof sessionHappened==='function'&&sessionHappened(s));
    salaBar.style.display=pending?'':'none';
    salaBar.innerHTML=pending?`<button type="button" class="btn btn-primary" style="width:100%;" onclick="closeM('m-session');openSalaDoneModal('${escHtml(s.id)}')">✓ Odbył się — ocena i czas</button>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.4;">Bez Live tonaż 0. Ocena 1–5 i minuty wchodzą do Postępów.</div>`:'';
  }
  renderRecordedExercises(s);
}

function delSessionFromModal(){
  const id=window._editingSessionId;
  if(!id)return;
  if(typeof closeM==='function')closeM('m-session');
  delSession(id);
}
window.delSessionFromModal=delSessionFromModal;

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
  const s=(window.SE||[]).find(x=>x&&x.id===id);
  const planned=s&&s.source==='planned';
  const msg=planned
    ?'Usunąć ten termin z kalendarza?\nPlan klienta zostaje — znika tylko ten dzień.'
    :'Usunąć sesję z kalendarza?';
  if(!confirm(msg))return;
  const cid=s&&s.clientId;
  window.SE=SE.filter(x=>x.id!==id);
  try{renderCal();}catch(e){}
  try{renderDash();}catch(e){}
  if(cid&&typeof renderCPTraining==='function'){
    const c=CL.find(x=>x.id===cid);
    if(c&&typeof cpTab!=='undefined'&&cpTab==='training')try{renderCPTraining(c);}catch(e){}
  }
  notify(planned?'Termin usunięty z kalendarza':'Sesja usunięta');
  if(window._db){try{await window._del(window._doc(window._db,'sessions',id));}catch(e){console.warn('Firebase delSession:',e);}}
}
window.delSession=delSession;

(function wrapOpenSessionModal(){
  const orig=window.openM;
  if(typeof orig!=='function')return;
  window.openM=function(id){
    orig.apply(this,arguments);
    if(id==='m-session'){
      window._editingSessionId=null;
      const del=document.getElementById('as-del-btn');
      if(del)del.style.display='none';
      const t=document.querySelector('#m-session .modal-title');
      if(t)t.textContent='NOWA SESJA';
    }
  };
})();
async function saveSess(){
  if(window._saveGuard_saveSess)return;window._saveGuard_saveSess=true;setTimeout(()=>window._saveGuard_saveSess=false,1500);

  const cid=document.getElementById('as-client').value;
  const date=document.getElementById('as-date').value;
  const time=document.getElementById('as-time').value;
  const type=document.getElementById('as-type').value;
  const notes=document.getElementById('as-notes').value;
  const duration=parseInt(document.getElementById('as-duration').value)||60;
  if(!cid){notify('Wybierz klienta!');return;}
  if(!date||!time){notify('Uzupełnij datę i godzinę!');return;}
  const editId=window._editingSessionId;
  const existing=editId&&(window.SE||[]).find(x=>x&&x.id===editId);
  const refresh=()=>{
    try{renderCal();}catch(e){}
    try{renderDash();}catch(e){}
    if(typeof cpClientId!=='undefined'&&cpClientId===cid){try{setCPTab(cpTab);}catch(e){}}
  };
  if(existing){
    existing.clientId=cid;
    existing.date=date;
    existing.time=time;
    existing.type=type;
    existing.notes=notes;
    existing.duration=duration;
    existing.updatedAt=new Date().toISOString();
    closeM('m-session');
    window._editingSessionId=null;
    refresh();
    notify('Sesja zapisana!');
    await persistById('sessions',existing);
    return;
  }
  const sess=withTrainer({id:newId('s'),clientId:cid,date,time,type,notes,duration,createdAt:new Date().toISOString()});
  SE.push(sess);
  closeM('m-session');
  refresh();
  notify('Sesja dodana!');
  await persistById('sessions',sess);
  if(typeof fireIntEvent==='function'){
    const cli=(window.CL||[]).find(x=>x.id===cid);
    fireIntEvent('session.created',{session:{id:sess.id,date:sess.date,time:sess.time,type:sess.type,duration:sess.duration},client:{id:cid,name:cli&&cli.name||'',email:cli&&cli.email||'',phone:cli&&cli.phone||''}});
  }
  maybeResumeOnboard(cid);
}

