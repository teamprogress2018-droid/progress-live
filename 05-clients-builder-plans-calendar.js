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

function renderClientFilters(){
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
function renderClients(){
  renderClientFilters();
  const search=(document.getElementById('client-search')||{}).value||'';
  let filtered=CL.filter(c=>{
    if(search&&!c.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(clientSegment==='active')return c.status==='active';
    if(clientSegment==='inactive')return c.status==='inactive';
    if(clientSegment==='archived')return c.status==='archived';
    if(clientSegment==='all')return c.status!=='archived';
    return true;
  });
  // Priorytet: klienci wymagający uwagi (dawno nieaktywni / brak danych) na górze listy.
  filtered=filtered.map(c=>({c,act:formatClientActivity(c.id)}))
    .sort((a,b)=>b.act.days-a.act.days)
    .map(x=>x.c);
  const countEl=document.getElementById('clients-segment-count');
  if(countEl)countEl.textContent=filtered.length;
  const titleEl=document.getElementById('clients-segment-title');
  if(titleEl)titleEl.textContent=CLIENT_SEGMENT_TITLES[clientSegment]||'Klienci';
  const el=document.getElementById('clients-tbl');
  if(!filtered.length){
    const q=search.trim();
    el.innerHTML=`<div style="padding:48px 20px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;opacity:0.4;">👥</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${q?'Brak wyników':'Brak klientów w tym widoku'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5;">${q?'Spróbuj innej frazy.':clientSegment==='archived'?'Nie masz zarchiwizowanych klientów.':'Dodaj pierwszego klienta — potem plan i Trening Live.'}</div>
      ${!q&&clientSegment!=='archived'?`<button class="btn btn-primary" onclick="openM('m-client')">+ Dodaj klienta</button>`:''}
    </div>`;
    return;
  }
  el.innerHTML=filtered.map((c,i)=>{
    const act=formatClientActivity(c.id);
    return `<div class="tbl-row" style="grid-template-columns:2fr 120px 120px 100px 150px;animation-delay:${i*0.03}s;cursor:pointer;" onclick="openClientProfile('${c.id}')">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:50%;background:${COLS[i%5]}22;color:${COLS[i%5]};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;flex-shrink:0;">${escHtml(getInit(c.name))}</div>
      <div><div style="font-size:13px;font-weight:600;">${escHtml(c.name)}</div><div style="font-size:11px;color:var(--muted);">${escHtml(c.email||'⚠ Brak e-maila')}</div></div>
    </div>
    <div style="font-size:12px;color:${act.color};align-self:center;font-weight:600;">${act.label}</div>
    <div style="font-size:12px;color:var(--muted);align-self:center;">${CLIENT_GOAL_LABELS[c.goal]||c.goal||'—'}</div>
    <div style="align-self:center;display:flex;gap:4px;flex-wrap:wrap;">
      <span class="pill ${c.status==='inactive'?'pill-red':c.status==='archived'?'pill-red':'pill-green'}"><span class="pill-dot"></span>${c.status==='inactive'?'Nieaktywny':c.status==='archived'?'Zarchiwizowany':'Aktywny'}</span>
      ${c.inviteSent?'<span class="pill pill-blue" style="font-size:9px;">📱 Zaproszony</span>':''}
      ${(()=>{const ob=getClientOnboard(c);return ob.complete?'':'<span class="pill pill-orange" style="font-size:9px;" onclick="event.stopPropagation();openClientOnboardChecklist(\''+c.id+'\')">Start '+ob.done+'/3</span>';})()}
    </div>
    <div style="align-self:center;display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="quickMessageClient(event,'${c.id}')" title="Wyślij wiadomość" style="width:32px;height:32px;border-radius:8px;background:var(--s3);border:1px solid var(--border2);color:var(--text);font-size:14px;cursor:pointer;">💬</button>
      <button onclick="quickStartWorkout(event,'${c.id}')" title="Rozpocznij dzisiejszy trening" style="width:32px;height:32px;border-radius:8px;background:var(--s3);border:1px solid var(--border2);color:var(--accent);font-size:14px;cursor:pointer;">▶</button>
      <button onclick="quickCheckin(event,'${c.id}')" title="Wyślij prośbę o check-in" style="width:32px;height:32px;border-radius:8px;background:var(--s3);border:1px solid var(--border2);color:var(--teal);font-size:14px;cursor:pointer;">✓</button>
    </div>
  </div>`;
  }).join('');
}

async function saveClient(){
  if(window._saveGuard_saveClient)return;window._saveGuard_saveClient=true;setTimeout(()=>window._saveGuard_saveClient=false,1500);

  const name=document.getElementById('ac-name').value.trim();
  if(!name){notify('Wpisz imię!');return;}
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
    notes:document.getElementById('ac-notes').value,
    status:'active',
    joinDate:new Date().toISOString().split('T')[0],
    createdAt:new Date().toISOString()
  });
  // najpierw dodaj lokalnie — natychmiast
  CL.push(c);
  closeM('m-client');
  ['ac-name','ac-email','ac-phone','ac-age','ac-weight','ac-height','ac-notes'].forEach(id=>{
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
  if(!c)return{invite:false,plan:false,session:false,done:0,total:3,complete:true};
  const invite=!!(c.inviteSent||c.appInvited||c.inviteSentAt||c.inviteSkipped);
  const plan=PL.some(p=>p.clientId===c.id);
  const session=SE.some(s=>s.clientId===c.id);
  const done=[invite,plan,session].filter(Boolean).length;
  return{invite,plan,session,done,total:3,complete:done===3};
}
window.getClientOnboard=getClientOnboard;

function maybeResumeOnboard(clientId){
  const c=CL.find(x=>x.id===clientId);
  if(!c||c.status==='archived')return;
  const st=getClientOnboard(c);
  if(st.complete)return;
  setTimeout(()=>openClientOnboardChecklist(clientId),450);
}
window.maybeResumeOnboard=maybeResumeOnboard;

function skipClientInvite(clientId){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  c.inviteSkipped=true;
  persistById('clients',c);
  renderClientOnboardChecklist();
  notify('Zaproszenie pominięte — możesz wrócić do niego później');
}
window.skipClientInvite=skipClientInvite;

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
    {done:st.plan,icon:'📋',title:'Przypisz plan treningowy',desc:'Najszybciej: generator AI z danymi klienta',
      action:`openAiPlanForClient('${id}')`,cta:'⚡ Plan AI',
      extra:st.plan?'':`<button class="btn btn-ghost btn-sm" onclick="closeM('m-client-onboard');openClientProfile('${id}');setTimeout(()=>setCPTab('plan'),300)">Szablon</button>`},
    {done:st.session,icon:'▶',title:'Pierwsza sesja',desc:'Odpal Trening Live albo dopisz do kalendarza',
      action:`closeM('m-client-onboard');goTo('live');setTimeout(()=>liveClientSetField('${id}','${safeName}'),300)`,cta:'Trening Live'},
  ];
  el.innerHTML=steps.map(s=>`
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s3);border:1px solid ${s.done?'var(--teal)':'var(--border)'};border-radius:10px;margin-bottom:8px;">
      <div style="width:32px;height:32px;border-radius:8px;background:${s.done?'rgba(62,207,178,0.18)':'var(--s2)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${s.done?'✓':s.icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${s.title}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:${s.done?'0':'8px'};">${s.desc}</div>
        ${s.done?'<div style="font-size:10px;color:var(--teal);font-family:\'DM Mono\',monospace;margin-top:4px;">GOTOWE</div>':`<div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="${s.action}">${s.cta}</button>${s.extra||''}</div>`}
      </div>
    </div>`).join('')+(st.complete?`<button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="closeM('m-client-onboard')">Gotowe — zamknij</button>`:'');
}
window.openClientOnboardChecklist=openClientOnboardChecklist;
window.renderClientOnboardChecklist=renderClientOnboardChecklist;

// ════════════════════════════════════════
// BUILDER
// ════════════════════════════════════════
function initBuilder(){
  window._editingPlanId=null;
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
}
function addDay(){
  dayCount++;const id='bd-'+dayCount;
  const days=['PON','WT','ŚR','CZ','PT','SO','ND'];
  const sel=days.map((d,i)=>`<option value="${d}"${i===dayCount-1?' selected':''}>${d}</option>`).join('');
  const div=document.createElement('div');div.id=id;div.className='builder-day';
  div.innerHTML=`<div class="builder-day-hdr">
    <select style="background:var(--s2);border:1px solid var(--border2);border-radius:6px;padding:4px 8px;color:var(--accent);font-family:'DM Mono',monospace;font-size:13px;">${sel}</select>
    <input type="text" placeholder="np. Klatka + Triceps" style="flex:1;background:var(--s2);border:1px solid var(--border);border-radius:6px;padding:5px 9px;color:var(--text);font-size:12px;">
    <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer;white-space:nowrap;margin-left:6px;"><input type="checkbox" class="rc" style="accent-color:var(--accent);" onchange="toggleR('${id}')"> REST</label>
    <button onclick="document.getElementById('${id}').remove()" style="background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.2);color:var(--red);border-radius:6px;padding:4px 8px;margin-left:6px;">×</button>
  </div>
  <div class="rest-s" style="display:none;padding:12px 14px;font-size:12px;color:var(--muted);">— Dzień odpoczynku / regeneracja aktywna</div>
  <div class="work-s">
    <div class="ex-tbl-hdr"><span>ĆWICZENIE</span><span>SER</span><span>POWT</span><span>KG</span><span>RPE</span><span>RIR</span><span>PRZERWA</span><span>TEMPO</span><span></span></div>
    <div class="ex-rows"></div>
    <button class="add-ex-btn" onclick="addRow('${id}')">+ DODAJ ĆWICZENIE</button>
  </div>`;
  document.getElementById('builder-days').appendChild(div);
}
function toggleR(id){const el=document.getElementById(id);const r=el.querySelector('.rc').checked;el.querySelector('.rest-s').style.display=r?'block':'none';el.querySelector('.work-s').style.display=r?'none':'block';}
function addRow(dayId){
  const rows=document.querySelector('#'+dayId+' .ex-rows');
  const div=document.createElement('div');div.className='ex-row';
  div.innerHTML='<input type="text" placeholder="Nazwa ćwiczenia..." class="ex-inp ex-inp-name" style="width:100%;" list="ex-dl" data-f="name" oninput="builderPreviewKg(this.closest(\'.ex-row\'))">'
    +'<input type="number" placeholder="4" class="ex-inp" data-f="sets">'
    +'<input type="text" placeholder="8-10" class="ex-inp" data-f="reps">'
    +'<input type="number" placeholder="kg" class="ex-inp" data-f="kg" title="Zostaw puste, jeśli liczysz z %1RM">'
    +'<input type="number" placeholder="8" class="ex-inp" data-f="rpe">'
    +'<input type="number" placeholder="2" class="ex-inp" data-f="rir">'
    +'<input type="text" placeholder="2min" class="ex-inp" data-f="rest">'
    +'<input type="text" placeholder="2-0-2" class="ex-inp" data-f="tempo">'
    +'<button type="button" onclick="builderRemoveRow(this)" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;">×</button>'
    +'<div class="ex-row-extra">'
    +'<input type="text" placeholder="Zamiennik (opcjonalnie, np. hantle zamiast sztangi)" class="ex-inp ex-inp-name" data-f="alt" style="font-size:11px;">'
    +'<input type="number" placeholder="%1RM" class="ex-inp" data-f="pct1rm" min="1" max="150" step="0.5" title="Procent 1RM — kg z Pomiary → Siła bazowa" oninput="builderPreviewKg(this.closest(\'.ex-row\'))">'
    +'<div class="ex-kind-btns">'
    +'<input type="hidden" data-f="ss" value="">'
    +'<input type="hidden" data-f="emom" value="">'
    +'<button type="button" class="ex-ss-btn" onclick="builderToggleSs(this)" title="Połącz z następnym ćwiczeniem w super-serię">⚡ SS</button>'
    +'<button type="button" class="ex-ss-btn ex-emom-btn" onclick="builderToggleEmom(this)" title="EMOM: każda seria na starcie minuty, reszta minuty to przerwa">EMOM</button>'
    +'</div>'
    +'</div>';
  rows.appendChild(div);
}
function builderRemoveRow(btn){
  const row=btn.closest('.ex-row');
  const box=row&&row.parentElement;
  if(row)row.remove();
  if(box)builderPaintSs(box);
}
window.builderRemoveRow=builderRemoveRow;
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
  const em1=row.querySelector('[data-f="emom"]');
  const em2=next.querySelector('[data-f="emom"]');
  if(em1)em1.value='';
  if(em2)em2.value='';
  if(typeof builderPaintEmom==='function'){builderPaintEmom(row);builderPaintEmom(next);}
  builderPaintSs(box);
}
window.builderToggleSs=builderToggleSs;
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
  el.innerHTML=rmBar+sch.map(w=>`<div class="period-row"><div style="font-family:'DM Mono',monospace;font-size:10px;color:${w.cel.includes('DELOAD')?'var(--orange)':w.nr===1?'var(--accent)':'var(--blue)'};width:46px;flex-shrink:0;">TYG ${w.nr}</div><div><div style="font-size:12px;font-weight:600;">${w.cel}</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">${w.rpe}</div></div></div>`).join('');
  document.querySelectorAll('#builder-days .ex-row').forEach(r=>{if(typeof builderPreviewKg==='function')builderPreviewKg(r);});
}
function getPeriod(level){
  if(level==='poczatkujacy')return[{nr:1,cel:'Adaptacja — nauka wzorców',rpe:'RPE 7'},{nr:2,cel:'Utrwalenie techniki',rpe:'RPE 7'},{nr:3,cel:'Progresja liniowa',rpe:'RPE 8'},{nr:4,cel:'DELOAD — regeneracja CNS',rpe:'RPE 6'}];
  if(level==='sredni')return[{nr:1,cel:'DUP Akumulacja — wysoka objętość',rpe:'RPE 7'},{nr:2,cel:'DUP Intensyfikacja',rpe:'RPE 8'},{nr:3,cel:'DUP Szczyt',rpe:'RPE 9'},{nr:4,cel:'DELOAD',rpe:'RPE 6'}];
  return[{nr:1,cel:'Blok Akumulacji',rpe:'RPE 7-8'},{nr:2,cel:'Blok Akumulacji +',rpe:'RPE 8'},{nr:3,cel:'Blok Intensyfikacji',rpe:'RPE 8-9'},{nr:4,cel:'Blok Intensyfikacji peak',rpe:'RPE 9'},{nr:5,cel:'Blok Realizacji',rpe:'RPE 9-10'},{nr:6,cel:'DELOAD + Pivot Week',rpe:'RPE 6'}];
}
// Ładuje istniejący plan do kreatora, żeby faktycznie go edytować (a nie tworzyć pusty nowy).
function editPlan(id){
  const plan=PL.find(p=>p.id===id);
  if(!plan){notify('Nie znaleziono planu');return;}
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
      if(typeof builderPreviewKg==='function')builderPreviewKg(row);
      if(typeof builderPaintEmom==='function')builderPaintEmom(row);
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
        emom:g('emom')==='1'
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
      return;
    }
  }
  const plan=withTrainer({id:newId('p'),name,method:document.getElementById('b-method').value,duration:document.getElementById('b-duration').value,clientId:cid,clientName:c?c.name:'',level:c?c.level:'sredni',goal:c?c.goal:'masa',days,createdAt:new Date().toISOString()});
  PL.push(plan);goTo('plans');notify('Plan zapisany!');
  await persistById('plans',plan);
  maybeResumeOnboard(cid);
}

// ════════════════════════════════════════
// PLANS
// ════════════════════════════════════════
// Kolor akcentu karty wg metody treningowej — ten sam wzorzec co w Zasobach i Bibliotece ćwiczeń.
const PLAN_METHOD_COLORS={PPL:'var(--accent)',FBW:'var(--teal)',UL:'var(--blue)','531':'var(--purple)',HIIT:'var(--red)',GZCLP:'var(--orange)'};

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
    <div style="font-size:12px;margin-bottom:16px;">Przypisz plan klientowi, żeby móc od razu odpalić Trening Live.</div>
    ${search?'':`<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" onclick="goTo('builder')">+ Nowy plan</button>
      <button class="btn btn-ghost btn-sm" onclick="goTo('aiplangen')">⚡ Generuj plan AI</button>
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
      <div id="plan-detail-${p.id}" style="display:none;border-top:1px solid var(--border);padding:14px 18px;background:rgba(0,0,0,0.15);">
        ${(p.days||[]).map(d=>`<div class="plan-day-row" style="padding:9px 0;">
          <div class="plan-day-name">${d.day||d.dayName||'—'}</div>
          ${d.rest?'<div style="color:var(--muted);font-size:12px;font-style:italic;">— Odpoczynek</div>':`<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--text);">${d.muscles||d.focus||d.name||''}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;line-height:1.5;">${typeof formatDayExerciseLines==='function'?formatDayExerciseLines(d.exercises,p.clientId):(d.exercises||[]).map(e=>typeof formatPlanExerciseLine==='function'?formatPlanExerciseLine(e,p.clientId):'').filter(Boolean).join(' · ')}</div></div>`}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('')+`</div>`;
}

// Rozwija/zwija szczegóły ćwiczeń w karcie planu — na liście widać tylko nagłówek + tagi dni,
// pełne ćwiczenia pokazują się dopiero po kliknięciu "Podgląd".
function togglePlanExpand(id){
  const detail=document.getElementById('plan-detail-'+id);
  const btn=document.getElementById('plan-toggle-'+id);
  if(!detail)return;
  const isOpen=detail.style.display==='block';
  detail.style.display=isOpen?'none':'block';
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
        const col=SESS_COLORS[(cIdx>=0?cIdx:0)%6];
        const timeMin=parseInt((s.time||'0:0').split(':')[1]||0);
        const topPct=(timeMin/60)*100;
        const dur=s.duration||60;
        const heightPx=Math.max(20,(dur/60)*56);
        return `<div class="cal-session-block" style="background:${col}22;border-color:${col}44;color:${col};top:${topPct}%;height:${heightPx}px;" onclick="editSession('${s.id}')" title="${c?c.name:'Klient'} — ${s.type||''} ${s.time||''}">
          <div style="font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${c?c.name.split(' ')[0]:'Klient'}</div>
          <div style="font-size:9px;opacity:0.8;">${s.time||''} ${s.type||''}</div>
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
        return `<div class="cal-month-sess" style="background:${col}22;color:${col};" onclick="event.stopPropagation();editSession('${s.id}')">${s.time||''} ${c?c.name.split(' ')[0]:'Klient'}</div>`;
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
        const col=SESS_COLORS[(ci>=0?ci:0)%6];
        return `<div class="cal-list-sess" onclick="editSession('${s.id}')">
          <div style="width:4px;border-radius:2px;background:${col};flex-shrink:0;align-self:stretch;"></div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:${col};min-width:44px;line-height:1.1;">${s.time||'—'}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">${c?c.name:'Klient'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${s.type||'Sesja'} · ${s.duration||60} min</div>
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
    <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--accent);">${weekSess.length}</div>
      <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">SESJI</div>
    </div>
    <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--blue);">${new Set(weekSess.map(s=>s.clientId)).size}</div>
      <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">KLIENTÓW</div>
    </div>
    <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--teal);">${weekSess.reduce((s,sess)=>s+(sess.duration||60),0)}</div>
      <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">MINUT</div>
    </div>
    <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--orange);">${SE.filter(s=>s.date===dateStr(today)).length}</div>
      <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">DZIŚ</div>
    </div>`;

  // upcoming
  const nowStr=dateStr(today);
  const up=SE.filter(s=>s.date>=nowStr).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')).slice(0,6);
  const upEl=document.getElementById('cal-upcoming');
  if(!upEl)return;
  upEl.innerHTML=!up.length?'<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px 0;">Brak nadchodzących sesji</div>'
    :up.map(s=>{
      const c=CL.find(x=>x.id===s.clientId);
      const ci=c?CL.indexOf(c):-1;
      const col=SESS_COLORS[(ci>=0?ci:0)%6];
      const d=new Date(s.date+'T12:00:00');
      const isToday=s.date===nowStr;
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="editSession('${s.id}')">
        <div style="text-align:center;min-width:36px;">
          <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${isToday?'DZIŚ':CAL_DAYS_PL[(d.getDay()+6)%7]}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:${col};">${d.getDate()}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;">${c?c.name:'Klient'}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">${s.time||'—'} · ${s.type||'Sesja'}</div>
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

// Pokazuje zarejestrowane ćwiczenia (ciężary/powtórzenia) z sesji Trening Live, jeśli są dostępne.
// Wcześniej te dane były zapisywane, ale nigdzie nie były pokazywane trenerowi z powrotem.
function renderRecordedExercises(s){
  const wrap=document.getElementById('as-recorded-exercises');
  const list=document.getElementById('as-recorded-exercises-list');
  if(!wrap||!list)return;
  const hasDetailedSets=(s.exercises||[]).some(e=>Array.isArray(e.sets)&&e.sets.length&&typeof e.sets[0]==='object');
  if(!hasDetailedSets){wrap.style.display='none';list.innerHTML='';return;}
  list.innerHTML=s.exercises.map(e=>{
    const setsText=(e.sets||[]).map(st=>`${st.kg||0}kg × ${st.reps||0}`).join(' · ');
    return `<div style="background:var(--s3);border-radius:8px;padding:8px 10px;">
      <div style="font-size:12px;font-weight:600;margin-bottom:3px;">${e.name}</div>
      <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;">${setsText||'brak zarejestrowanych serii'}</div>
    </div>`;
  }).join('')+(s.volume?`<div style="font-size:11px;color:var(--accent);text-align:right;font-family:'DM Mono',monospace;padding-top:2px;">Łączna objętość: ${s.volume} kg</div>`:'');
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

