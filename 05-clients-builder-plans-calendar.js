// ════════════════════════════════════════
// KLIENCI
// ════════════════════════════════════════
var clientSegment='all';

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
    const sel=document.getElementById('live-client-sel');
    if(sel){ sel.value=clientId; if(typeof liveLoadClient==='function')liveLoadClient(); }
  },200);
}
function quickCheckin(e,clientId){
  e.stopPropagation();
  if(typeof sendCheckinTo==='function')sendCheckinTo(clientId);
}

function renderClientFilters(){
  const segments=[
    {id:'all',label:'Wszyscy klienci',count:CL.length},
    {id:'active',label:'Połączeni',count:CL.filter(c=>c.status==='active').length},
    {id:'inactive',label:'Offline',count:CL.filter(c=>c.status==='inactive').length},
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
    return true;
  });
  // Priorytet: klienci wymagający uwagi (dawno nieaktywni / brak danych) na górze listy.
  filtered=filtered.map(c=>({c,act:formatClientActivity(c.id)}))
    .sort((a,b)=>b.act.days-a.act.days)
    .map(x=>x.c);
  const countEl=document.getElementById('clients-segment-count');
  if(countEl)countEl.textContent=filtered.length;
  const el=document.getElementById('clients-tbl');
  if(!filtered.length){el.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);">Brak klientów</div>';return;}
  el.innerHTML=filtered.map((c,i)=>{
    const act=formatClientActivity(c.id);
    return `<div class="tbl-row" style="grid-template-columns:2fr 120px 120px 100px 130px 80px;animation-delay:${i*0.03}s;cursor:pointer;" onclick="openClientProfile('${c.id}')">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:50%;background:${COLS[i%5]}22;color:${COLS[i%5]};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;flex-shrink:0;">${getInit(c.name)}</div>
      <div><div style="font-size:13px;font-weight:600;">${c.name}</div><div style="font-size:11px;color:var(--muted);">${c.email||'—'}</div></div>
    </div>
    <div style="font-size:12px;color:${act.color};align-self:center;font-weight:600;">${act.label}</div>
    <div style="font-size:12px;color:var(--muted);align-self:center;">${c.goal||'—'}</div>
    <div style="align-self:center;display:flex;gap:4px;flex-wrap:wrap;">
      <span class="pill ${c.status==='inactive'?'pill-red':'pill-green'}"><span class="pill-dot"></span>${c.status==='inactive'?'Offline':'Aktywny'}</span>
      ${c.inviteSent?'<span class="pill pill-blue" style="font-size:9px;">📱 Zaproszony</span>':''}
    </div>
    <div style="align-self:center;display:flex;gap:6px;">
      <button onclick="quickMessageClient(event,'${c.id}')" title="Wyślij wiadomość" style="width:28px;height:28px;border-radius:6px;background:var(--s3);border:1px solid var(--border2);color:var(--text);font-size:13px;cursor:pointer;">💬</button>
      <button onclick="quickStartWorkout(event,'${c.id}')" title="Rozpocznij dzisiejszy trening" style="width:28px;height:28px;border-radius:6px;background:var(--s3);border:1px solid var(--border2);color:var(--accent);font-size:13px;cursor:pointer;">▶</button>
      <button onclick="quickCheckin(event,'${c.id}')" title="Wyślij prośbę o check-in" style="width:28px;height:28px;border-radius:6px;background:var(--s3);border:1px solid var(--border2);color:var(--teal);font-size:13px;cursor:pointer;">✓</button>
    </div>
    <div style="align-self:center;"><button class="btn btn-ghost btn-sm" onclick="openClientProfile('${c.id}')">Profil</button></div>
  </div>`;
  }).join('');
}

async function saveClient(){
  const name=document.getElementById('ac-name').value.trim();
  if(!name){notify('Wpisz imię!');return;}
  const c={
    id:'l'+Date.now(),
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
    createdAt:new Date().toISOString()
  };
  // najpierw dodaj lokalnie — natychmiast
  CL.push(c);
  closeM('m-client');
  ['ac-name','ac-email','ac-phone','ac-age','ac-weight','ac-height','ac-notes'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  try{renderAll();}catch(e){try{renderClients();}catch(e2){}}
  notify('✅ Klient '+c.name+' dodany!');
  addNotification('system','Nowy klient!',c.name+' dodany do listy','clients');
  // Pokaż modal zaproszenia
  setTimeout(()=>openInviteModal(c.id), 400);
  // Firebase w tle — nie blokuj UI
  if(window._db){
    try{
      const r=await window._add(window._col(window._db,'clients'),c);
      if(r&&r.id)c.id=r.id;
    }catch(e){console.warn('Firebase save failed (offline?):', e);}
  }
}

// ════════════════════════════════════════
// BUILDER
// ════════════════════════════════════════
function initBuilder(){
  dayCount=0;
  document.getElementById('builder-days').innerHTML='';
  document.getElementById('b-name').value='';
  // wypełnij select klientów
  const sel=document.getElementById('b-client');
  if(sel){
    sel.innerHTML='<option value="">-- Wybierz klienta --</option>'+CL.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
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
  div.innerHTML='<input type="text" placeholder="Nazwa ćwiczenia..." class="ex-inp ex-inp-name" style="width:100%;" list="ex-dl">'
    +'<input type="number" placeholder="4" class="ex-inp">'+'<input type="text" placeholder="8-10" class="ex-inp">'
    +'<input type="number" placeholder="kg" class="ex-inp">'+'<input type="number" placeholder="8" class="ex-inp">'
    +'<input type="number" placeholder="2" class="ex-inp">'+'<input type="text" placeholder="2min" class="ex-inp">'
    +'<input type="text" placeholder="2-0-2" class="ex-inp">'
    +'<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;">×</button>';
  rows.appendChild(div);
}
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
  el.innerHTML=sch.map(w=>`<div class="period-row"><div style="font-family:'DM Mono',monospace;font-size:10px;color:${w.cel.includes('DELOAD')?'var(--orange)':w.nr===1?'var(--accent)':'var(--blue)'};width:46px;flex-shrink:0;">TYG ${w.nr}</div><div><div style="font-size:12px;font-weight:600;">${w.cel}</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">${w.rpe}</div></div></div>`).join('');
}
function getPeriod(level){
  if(level==='poczatkujacy')return[{nr:1,cel:'Adaptacja — nauka wzorców',rpe:'RPE 7'},{nr:2,cel:'Utrwalenie techniki',rpe:'RPE 7'},{nr:3,cel:'Progresja liniowa',rpe:'RPE 8'},{nr:4,cel:'DELOAD — regeneracja CNS',rpe:'RPE 6'}];
  if(level==='sredni')return[{nr:1,cel:'DUP Akumulacja — wysoka objętość',rpe:'RPE 7'},{nr:2,cel:'DUP Intensyfikacja',rpe:'RPE 8'},{nr:3,cel:'DUP Szczyt',rpe:'RPE 9'},{nr:4,cel:'DELOAD',rpe:'RPE 6'}];
  return[{nr:1,cel:'Blok Akumulacji',rpe:'RPE 7-8'},{nr:2,cel:'Blok Akumulacji +',rpe:'RPE 8'},{nr:3,cel:'Blok Intensyfikacji',rpe:'RPE 8-9'},{nr:4,cel:'Blok Intensyfikacji peak',rpe:'RPE 9'},{nr:5,cel:'Blok Realizacji',rpe:'RPE 9-10'},{nr:6,cel:'DELOAD + Pivot Week',rpe:'RPE 6'}];
}
async function savePlan(){
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
    de.querySelectorAll('.ex-row').forEach(r=>{const i=r.querySelectorAll('input');const n=i[0].value.trim();if(!n)return;exercises.push(n+' '+i[1].value+'x'+i[2].value);sets+=parseInt(i[1].value)||3;});
    days.push({day:dn,muscles,exercises,sets,rest:false});
  });
  if(!days.length){notify('Dodaj przynajmniej jeden dzień!');return;}
  const plan={id:'l'+Date.now(),name,method:document.getElementById('b-method').value,duration:document.getElementById('b-duration').value,clientId:cid,clientName:c?c.name:'',level:c?c.level:'sredni',goal:c?c.goal:'masa',days,createdAt:new Date().toISOString()};
  PL.push(plan);goTo('plans');notify('Plan zapisany!');
  if(window._db){try{const r=await window._add(window._col(window._db,'plans'),plan);if(r&&r.id)plan.id=r.id;}catch(e){console.warn('Firebase:',e);}}
}

// ════════════════════════════════════════
// PLANS
// ════════════════════════════════════════
function renderPlans(){
  const el=document.getElementById('plans-content');
  if(!el)return;
  if(!PL.length){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:60px;">Brak planów — utwórz pierwszy!</div>';return;}
  el.innerHTML=PL.map((p,pi)=>{
    const client=CL.find(c=>c.id===p.clientId);
    const clientName=client?.name||p.clientName||'Bez klienta';
    const hasClient=!!client;
    return `<div class="plan-card" style="animation-delay:${pi*0.05}s">
      <div class="plan-card-hdr">
        <div style="display:flex;align-items:center;gap:10px;flex:1;">
          ${hasClient?`<div style="width:34px;height:34px;border-radius:9px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--accent);flex-shrink:0;">${getInit(clientName)}</div>`:'<div style="width:34px;height:34px;border-radius:9px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>'}
          <div>
            <div style="font-size:15px;font-weight:700;">${p.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
              <span style="font-size:11px;color:${hasClient?'var(--accent)':'var(--muted)'};">${hasClient?'👤 '+clientName:'Brak klienta'}</span>
              <span style="color:var(--border2);">·</span>
              <span style="font-size:11px;color:var(--muted);">${p.method||'—'}</span>
              <span style="color:var(--border2);">·</span>
              <span style="font-size:11px;color:var(--muted);">${p.duration||'?'} tyg.</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="pill pill-green">${p.method||'—'}</span>
          ${hasClient?`<button class="btn btn-ghost btn-sm" onclick="openClientProfile('${client.id}')">Profil klienta</button>`:''}
          <button class="btn btn-danger btn-sm" onclick="delPlan('${p.id}')">Usuń</button>
        </div>
      </div>
      ${(p.days||[]).map(d=>`<div class="plan-day-row"><div class="plan-day-name">${d.day||d.dayName||'—'}</div>${d.rest?'<div style="color:var(--muted);font-size:12px;font-style:italic;">— Odpoczynek</div>':`<div style="flex:1;"><div style="font-size:13px;font-weight:600;">${d.muscles||d.focus||d.name||''}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">${(d.exercises||[]).slice(0,3).map(e=>typeof e==='string'?e:(e.name||e.n||'')).filter(Boolean).join(' · ')}</div></div>`}</div>`).join('')}
    </div>`;
  }).join('');
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
        return `<div class="cal-session-block" style="background:${col}22;border-color:${col}44;color:${col};top:${topPct}%;height:${heightPx}px;" onclick="openSessDetail('${s.id}')" title="${c?c.name:'Klient'} — ${s.type||''} ${s.time||''}">
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
        return `<div class="cal-month-sess" style="background:${col}22;color:${col};" onclick="event.stopPropagation();openSessDetail('${s.id}')">${s.time||''} ${c?c.name.split(' ')[0]:'Klient'}</div>`;
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
        return `<div class="cal-list-sess" onclick="openSessDetail('${s.id}')">
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
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="openSessDetail('${s.id}')">
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
  document.getElementById('as-client').innerHTML=CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
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
  document.getElementById('as-client').innerHTML=CL.map(c=>'<option value="'+c.id+'"'+(c.id===s.clientId?' selected':'')+'>'+c.name+'</option>').join('');
  document.getElementById('as-date').value=s.date;
  document.getElementById('as-time').value=s.time||'';
  document.getElementById('as-type').value=s.type||'';
  document.getElementById('as-notes').value=s.notes||'';
  openM('m-session');
}

function delSession(id){
  if(!confirm('Usunąć sesję?'))return;
  window.SE=SE.filter(s=>s.id!==id);
  renderCal();renderDash();
  notify('Sesja usunięta');
}
async function saveSess(){
  const cid=document.getElementById('as-client').value;
  const date=document.getElementById('as-date').value;
  const time=document.getElementById('as-time').value;
  const type=document.getElementById('as-type').value;
  const notes=document.getElementById('as-notes').value;
  const duration=parseInt(document.getElementById('as-duration').value)||60;
  if(!date||!time){notify('Uzupełnij datę i godzinę!');return;}
  const sess={id:'l'+Date.now(),clientId:cid,date,time,type,notes,duration,createdAt:new Date().toISOString()};
  SE.push(sess);
  closeM('m-session');
  try{renderCal();}catch(e){}
  try{renderDash();}catch(e){}
  // odśwież profil klienta jeśli otwarty
  if(cpClientId&&cpClientId===cid){try{setCPTab(cpTab);}catch(e){}}
  notify('Sesja dodana!');
  if(window._db){try{const r=await window._add(window._col(window._db,'sessions'),sess);if(r&&r.id)sess.id=r.id;}catch(e){console.warn('Firebase:',e);}}
}

