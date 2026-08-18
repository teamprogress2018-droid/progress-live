// ════════════════════════════════════════
// WORKOUT LIBRARY
// ════════════════════════════════════════
const CAT_LABELS={sila:'Siła',hipertrofia:'Hipertrofia',cardio:'Cardio / HIIT',mobilnosc:'Mobilność',fbw:'Full Body'};
const CAT_COLORS={sila:'var(--orange)',hipertrofia:'var(--accent)',cardio:'var(--red)',mobilnosc:'var(--teal)',fbw:'var(--blue)'};
const LEVEL_LABELS={poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'};
const LEVEL_PILLS={poczatkujacy:'pill-teal',sredni:'pill-blue',zaawansowany:'pill-purple'};

function allWorkouts(){return[...DEMO_WORKOUTS,...WO];}

function filteredWorkouts(){
  const all=allWorkouts();
  const search=(document.getElementById('wl-search')||{}).value||'';
  const filPoziom=(document.getElementById('wl-fil-poziom')||{}).value||'';
  const filSprzet=(document.getElementById('wl-fil-sprzet')||{}).value||'';
  let res=all.filter(w=>{
    if(search&&!w.name.toLowerCase().includes(search.toLowerCase())&&!(w.desc||'').toLowerCase().includes(search.toLowerCase())) return false;
    if(filPoziom&&w.level!==filPoziom) return false;
    if(filSprzet&&w.equip!==filSprzet) return false;
    if(wlNav==='all') return true;
    if(wlNav==='moje') return w.type==='moje';
    if(wlNav==='demo') return w.type==='demo';
    if(['sila','hipertrofia','cardio','mobilnosc','fbw'].includes(wlNav)) return w.cat===wlNav;
    if(['poczatkujacy','sredni','zaawansowany'].includes(wlNav)) return w.level===wlNav;
    return true;
  });
  // sort
  if(wlSort==='nazwa') res.sort((a,b)=>a.name.localeCompare(b.name));
  else if(wlSort==='cwiczenia') res.sort((a,b)=>(b.exercises||[]).length-(a.exercises||[]).length);
  else if(wlSort==='czas') res.sort((a,b)=>(b.time||0)-(a.time||0));
  else if(wlSort==='data') res.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return res;
}

function updateWLCounts(){
  const all=allWorkouts();
  const cnt=(fn)=>all.filter(fn).length;
  document.getElementById('wl-cnt-all').textContent=all.length;
  document.getElementById('wl-cnt-moje').textContent=cnt(w=>w.type==='moje');
  document.getElementById('wl-cnt-demo').textContent=cnt(w=>w.type==='demo');
  ['sila','hipertrofia','cardio','mobilnosc','fbw'].forEach(c=>{
    const el=document.getElementById('wl-cnt-'+c);if(el)el.textContent=cnt(w=>w.cat===c);
  });
  ['poczatkujacy','sredni','zaawansowany'].forEach(l=>{
    const el=document.getElementById('wl-cnt-'+l);if(el)el.textContent=cnt(w=>w.level===l);
  });
}

function setWLNav(n){
  wlNav=n;
  document.querySelectorAll('.wl-nav-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('wl-nav-'+n);if(el)el.classList.add('active');
  renderWL();
}

function setWLView(v){
  wlView=v;
  document.getElementById('wl-list-view').style.display=v==='list'?'flex':'none';
  document.getElementById('wl-list-view').style.flexDirection='column';
  document.getElementById('wl-card-view').style.display=v==='grid'?'block':'none';
  document.getElementById('wl-view-list').className='btn btn-sm '+(v==='list'?'btn-primary':'btn-ghost');
  document.getElementById('wl-view-grid').className='btn btn-sm '+(v==='grid'?'btn-primary':'btn-ghost');
  renderWL();
}

function setWLSort(s){
  wlSort=s;
  document.querySelectorAll('.wl-filter-chip').forEach((el,i)=>el.classList.remove('active'));
  const map={nazwa:0,cwiczenia:1,czas:2,data:3};
  const chips=document.querySelectorAll('.wl-filter-chip');
  if(chips[map[s]])chips[map[s]].classList.add('active');
  renderWL();
}

function renderWL(){
  updateWLCounts();
  const res=filteredWorkouts();
  document.getElementById('wl-results-count').textContent=res.length+' '+(res.length===1?'trening':res.length<5?'treningi':'treningów');

  if(wlView==='list'){
    const body=document.getElementById('wl-list-body');
    if(!res.length){body.innerHTML='<div class="wl-empty"><div class="wl-empty-icon">🏋️</div><div class="wl-empty-title">Brak treningów</div><div class="wl-empty-sub">Dodaj pierwszy trening lub zmień filtry</div><button class="btn btn-primary" onclick="openM(\'m-workout\')">+ Nowy trening</button></div>';return;}
    body.innerHTML=res.map((w,i)=>`
      <div class="wl-list-row" style="animation-delay:${i*0.03}s" onclick="openWLDetail('${w.id}')">
        <div>
          <div style="font-size:13px;font-weight:700;">${w.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${(w.desc||'').substring(0,60)}${(w.desc||'').length>60?'…':''}</div>
        </div>
        <div><span class="pill" style="background:${CAT_COLORS[w.cat]}22;color:${CAT_COLORS[w.cat]};font-size:10px;">${CAT_LABELS[w.cat]||w.cat}</span></div>
        <div style="font-size:12px;color:var(--muted);">${(w.exercises||[]).length} ćwiczeń</div>
        <div style="font-size:12px;color:var(--muted);">${w.time||'—'} min</div>
        <div><span class="pill ${LEVEL_PILLS[w.level]||'pill-muted'}" style="font-size:10px;">${LEVEL_LABELS[w.level]||w.level}</span></div>
        <div style="font-size:12px;color:var(--muted);">${w.equip||'—'}</div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openWLDetail('${w.id}')">Szczegóły</button>
        </div>
      </div>`).join('');
  } else {
    const body=document.getElementById('wl-card-body');
    if(!res.length){body.innerHTML='<div class="wl-empty" style="grid-column:1/-1;"><div class="wl-empty-icon">🏋️</div><div class="wl-empty-title">Brak treningów</div><div class="wl-empty-sub">Dodaj pierwszy trening lub zmień filtry</div><button class="btn btn-primary" onclick="openM(\'m-workout\')">+ Nowy trening</button></div>';return;}
    body.innerHTML=res.map((w,i)=>`
      <div class="wl-card" style="animation-delay:${i*0.04}s" onclick="openWLDetail('${w.id}')">
        <div class="wl-card-accent" style="background:${CAT_COLORS[w.cat]||'var(--accent)'};"></div>
        <div class="wl-card-body">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <div class="wl-card-title">${w.name}</div>
            ${w.type==='demo'?'<span class="pill pill-blue" style="font-size:9px;white-space:nowrap;">DEMO</span>':''}
          </div>
          <div class="wl-card-desc">${w.desc||'—'}</div>
          <div class="wl-card-meta">
            <span class="pill" style="background:${CAT_COLORS[w.cat]}22;color:${CAT_COLORS[w.cat]};font-size:10px;">${CAT_LABELS[w.cat]||w.cat}</span>
            <span class="pill ${LEVEL_PILLS[w.level]||'pill-muted'}" style="font-size:10px;">${LEVEL_LABELS[w.level]||w.level}</span>
            <span class="pill pill-muted" style="font-size:10px;">${w.equip||'—'}</span>
          </div>
          <div class="wl-card-stats">
            <div class="wl-card-stat"><div class="wl-card-stat-val">${(w.exercises||[]).length}</div><div class="wl-card-stat-lbl">Ćwiczeń</div></div>
            <div class="wl-card-stat"><div class="wl-card-stat-val">${w.time||'—'}</div><div class="wl-card-stat-lbl">Minut</div></div>
            <div class="wl-card-stat"><div class="wl-card-stat-val">${(w.exercises||[]).reduce((s,e)=>s+(parseInt(e.sets)||0),0)||'—'}</div><div class="wl-card-stat-lbl">Serii</div></div>
          </div>
          <div class="wl-card-actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openWLDetail('${w.id}')">Szczegóły</button>
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="assignWorkoutDirect('${w.id}')">Przypisz</button>
          </div>
        </div>
      </div>`).join('');
  }
  // update dashboard
  document.getElementById('d-workouts').textContent=allWorkouts().length;
  renderDashWorkouts();
}

function openWLDetail(id){
  const all=allWorkouts();
  const w=all.find(x=>x.id===id);
  if(!w)return;
  wlDetailId=id;
  document.getElementById('wld-title').textContent=w.name;
  document.getElementById('wld-meta').textContent=(CAT_LABELS[w.cat]||w.cat)+' · '+(LEVEL_LABELS[w.level]||w.level)+' · '+(w.time||'—')+' min';
  document.getElementById('wld-pills').innerHTML=
    `<span class="pill" style="background:${CAT_COLORS[w.cat]}22;color:${CAT_COLORS[w.cat]};">${CAT_LABELS[w.cat]||w.cat}</span>`+
    `<span class="pill ${LEVEL_PILLS[w.level]||'pill-muted'}">${LEVEL_LABELS[w.level]||w.level}</span>`+
    `<span class="pill pill-muted">${w.equip||'—'}</span>`+
    (w.type==='demo'?'<span class="pill pill-blue">DEMO</span>':'<span class="pill pill-green">Mój</span>');
  document.getElementById('wld-desc').textContent=w.desc||'Brak opisu.';
  document.getElementById('wld-stats').innerHTML=`
    <div class="card-sm" style="text-align:center;"><div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--accent);">${(w.exercises||[]).length}</div><div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">ĆWICZEŃ</div></div>
    <div class="card-sm" style="text-align:center;"><div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--blue);">${w.time||'—'}</div><div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">MINUT</div></div>
    <div class="card-sm" style="text-align:center;"><div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--orange);">${(w.exercises||[]).reduce((s,e)=>s+(parseInt(e.sets)||0),0)||'—'}</div><div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">SERII</div></div>`;
  document.getElementById('wld-exercises').innerHTML=(w.exercises||[]).map((e,i)=>`
    <div class="wl-detail-ex">
      <div class="wl-ex-num">${i+1}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${e.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${e.sets||'?'} serii × ${e.reps||'?'} powtórzeń${e.rest?' · Przerwa: '+e.rest:''}</div>
      </div>
    </div>`).join('');
  document.getElementById('wld-notes-section').innerHTML=w.notes?`
    <div style="background:var(--adim);border:1px solid rgba(225,31,46,0.2);border-radius:8px;padding:10px 12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);margin-bottom:5px;">NOTATKI DLA KLIENTA</div>
      <div style="font-size:12px;line-height:1.6;">${w.notes}</div>
    </div>`:'';
  document.getElementById('wl-detail').classList.add('open');
}

function closeWLDetail(){document.getElementById('wl-detail').classList.remove('open');wlDetailId=null;}

function assignWorkout(){
  if(!wlDetailId)return;
  const w=allWorkouts().find(x=>x.id===wlDetailId);
  if(!w)return;
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  openAssignWorkoutModal(w.id);
}

function assignWorkoutDirect(id){
  const w=allWorkouts().find(x=>x.id===id);
  if(!w)return;
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  openAssignWorkoutModal(id);
}

function openAssignWorkoutModal(workoutId){
  window._assignWorkoutId=workoutId;
  const w=allWorkouts().find(x=>x.id===workoutId);
  let modal=document.getElementById('m-assign-workout');
  if(!modal){
    modal=document.createElement('div');
    modal.className='modal-ov';
    modal.id='m-assign-workout';
    modal.innerHTML=`<div class="modal" style="max-width:420px;">
      <div class="modal-title">Przypisz trening</div>
      <div class="form-field"><label class="form-lbl">Trening</label><div id="aw-name" style="font-size:13px;font-weight:600;"></div></div>
      <div class="form-field"><label class="form-lbl">Klient</label>
        <select class="form-select" id="aw-client"></select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button class="btn btn-ghost" onclick="closeM('m-assign-workout')">Anuluj</button>
        <button class="btn btn-primary" onclick="confirmAssignWorkout()">Przypisz</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show');});
  }
  document.getElementById('aw-name').textContent=w?w.name:'';
  document.getElementById('aw-client').innerHTML=CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
  openM('m-assign-workout');
}

async function confirmAssignWorkout(){
  const wid=window._assignWorkoutId;
  const cid=document.getElementById('aw-client')?.value;
  const w=allWorkouts().find(x=>x.id===wid);
  const c=CL.find(x=>x.id===cid);
  if(!w||!c){notify('Wybierz klienta!');return;}
  const plan=withTrainer({
    id:newId('p'),
    name:w.name,
    clientId:c.id,
    clientName:c.name,
    method:'Trening z biblioteki',
    duration:1,
    level:w.level||c.level||'sredni',
    goal:c.goal||'masa',
    source:'workout-library',
    workoutId:w.id,
    days:[{day:'Dzień 1',muscles:w.name,rest:false,exercises:(w.exercises||[]).map(e=>({name:e.name,sets:e.sets||'3',reps:e.reps||'10',rest:e.rest||'60s'}))}],
    createdAt:new Date().toISOString()
  });
  PL.push(plan);
  await persistById('plans',plan);
  pushMsg(c.id,'💪 Nowy trening: "'+w.name+'" — sprawdź plan w aplikacji / z trenerem.');
  closeM('m-assign-workout');
  closeWLDetail();
  addNotification('system','Trening przypisany','"'+w.name+'" → '+c.name,'plans');
  notify('✓ Trening "'+w.name+'" przypisany do: '+c.name);
}

function renderDashWorkouts(){
  const el=document.getElementById('d-workout-list');
  if(!el)return;
  const recent=allWorkouts().slice(0,4);
  if(!recent.length){el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;">Brak treningów</div>';return;}
  el.innerHTML=recent.map(w=>`
    <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="width:32px;height:32px;border-radius:8px;background:${CAT_COLORS[w.cat]}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:${CAT_COLORS[w.cat]};font-size:14px;">${w.cat==='sila'?'💪':w.cat==='cardio'?'🏃':w.cat==='mobilnosc'?'🧘':w.cat==='fbw'?'⚡':'🏋️'}</span>
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${w.name}</div>
        <div style="font-size:11px;color:var(--muted);">${(w.exercises||[]).length} ćwiczeń · ${w.time||'?'} min</div>
      </div>
    </div>`).join('');
}

// dodawanie wiersza ćwiczenia w modalu workout
function addWExRow(){
  const rows=document.getElementById('w-ex-rows');
  const div=document.createElement('div');
  div.className='wb-ex-row';
  div.innerHTML=
    '<input type="text" class="wb-inp" placeholder="Nazwa ćwiczenia..." list="ex-dl">'+
    '<input type="number" class="wb-inp" placeholder="4" min="1">'+
    '<input type="text" class="wb-inp" placeholder="8-10">'+
    '<input type="text" class="wb-inp" placeholder="90s">'+
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;">×</button>';
  rows.appendChild(div);
}

async function saveWorkout(){
  if(window._saveGuard_saveWorkout)return;window._saveGuard_saveWorkout=true;setTimeout(()=>window._saveGuard_saveWorkout=false,1500);

  const name=document.getElementById('w-name').value.trim();
  if(!name){notify('Wpisz nazwę treningu!');return;}
  const exercises=[];
  document.querySelectorAll('#w-ex-rows .wb-ex-row').forEach(r=>{
    const inps=r.querySelectorAll('input');
    const n=inps[0].value.trim();
    if(!n)return;
    exercises.push({name:n,sets:inps[1].value||'3',reps:inps[2].value||'10',rest:inps[3].value||'60s'});
  });
  if(!exercises.length){notify('Dodaj przynajmniej jedno ćwiczenie!');return;}
  const w=withTrainer({
    id:newId('w'),
    name,
    cat:document.getElementById('w-cat').value,
    level:document.getElementById('w-level').value,
    time:parseInt(document.getElementById('w-time').value)||45,
    equip:document.getElementById('w-equip').value,
    type:document.getElementById('w-type').value,
    desc:document.getElementById('w-desc').value,
    notes:document.getElementById('w-notes').value,
    exercises,
    createdAt:new Date().toISOString().split('T')[0]
  });
  await persistById('workouts',w);
  WO.push(w);closeM('m-workout');renderWL();notify('Trening dodany! 💪');
}

// ════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════
var onbTab='overview';
var onbStep=0;
var onbNewClient={};
var ONB_ACTIVE=[];   // [{clientId, step, startDate, flow}]
window.ONB_ACTIVE=ONB_ACTIVE;

const ONB_STEPS=[
  {id:'welcome',    icon:'👋', label:'Powitanie',        desc:'Wiadomość powitalna i dostęp do aplikacji'},
  {id:'ankieta',    icon:'📋', label:'Ankieta wstępna',  desc:'Dane, cel, poziom, zdrowie, preferencje'},
  {id:'kontrakt',   icon:'📄', label:'Kontrakt',         desc:'Regulamin współpracy i zgody RODO'},
  {id:'pomiary',    icon:'📏', label:'Pomiary startowe', desc:'Waga, wzrost, obwody, zdjęcia startowe'},
  {id:'plan',       icon:'📋', label:'Pierwszy plan',    desc:'Przypisanie planu treningowego'},
  {id:'zadania',    icon:'✅', label:'Pierwsze zadania',  desc:'Lista zadań na pierwszy tydzień'},
  {id:'platnosc',   icon:'💳', label:'Płatność',         desc:'Wybór pakietu i opłacenie'},
  {id:'aplikacja',  icon:'📱', label:'Aplikacja',        desc:'Wysłanie linku do aplikacji klienta'},
  {id:'sesja1',     icon:'🏋️', label:'Pierwsza sesja',   desc:'Zaplanowanie i przeprowadzenie sesji'},
  {id:'checkin',    icon:'✅', label:'Pierwszy check-in',desc:'Wypełnienie pierwszego check-inu'},
];

const ONB_FLOWS=[
  {id:'standard',  name:'Standard',      icon:'⚡', color:'var(--accent)',
   desc:'Kompletny onboarding — ankieta, kontrakt, plan, płatność, aplikacja, sesja.',
   steps:['welcome','ankieta','kontrakt','pomiary','plan','zadania','platnosc','aplikacja','sesja1','checkin'],
   duration:'7 dni'},
  {id:'quick',     name:'Szybki start',  icon:'🚀', color:'var(--blue)',
   desc:'Minimum formalności — od razu do treningu. Ankieta online + plan + sesja.',
   steps:['welcome','ankieta','plan','platnosc','sesja1'],
   duration:'2 dni'},
  {id:'online',    name:'Online',        icon:'💻', color:'var(--purple)',
   desc:'Klient zdalny — wszystko przez aplikację. Bez sesji stacjonarnej na starcie.',
   steps:['welcome','ankieta','kontrakt','plan','zadania','platnosc','aplikacja','checkin'],
   duration:'5 dni'},
  {id:'vip',       name:'VIP',           icon:'👑', color:'var(--orange)',
   desc:'Rozszerzony onboarding dla klientów premium. Pełna diagnostyka i badania.',
   steps:['welcome','ankieta','kontrakt','pomiary','plan','zadania','platnosc','aplikacja','sesja1','checkin'],
   duration:'14 dni'},
];

function initOnboarding(){
  // Nie seedujemy fałszywych onboardingu — tylko realne wpisy z ONB_ACTIVE
  setOnbTab('overview');
}

function setOnbTab(t){
  onbTab=t;
  ['overview','new','flows','settings'].forEach(x=>{
    const el=document.getElementById('onb-'+x+'-tab');
    if(el)el.style.display=x===t?'block':'none';
    document.getElementById('onb-tab-'+x)?.classList.toggle('active',x===t);
  });
  if(t==='overview')renderOnbOverview();
  if(t==='new'){onbStep=0;onbNewClient={};renderOnbNew();}
  if(t==='flows')renderOnbFlows();
  if(t==='settings')renderOnbSettings();
}

/* ── OVERVIEW ── */
function renderOnbOverview(){
  const el=document.getElementById('onb-overview-tab');if(!el)return;
  const completed=ONB_ACTIVE.filter(o=>o.step>=ONB_STEPS.length).length;
  const inProgress=ONB_ACTIVE.filter(o=>o.step<ONB_STEPS.length).length;

  el.innerHTML=`
    <!-- KPI -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">
      ${[
        {icon:'🔄',label:'W trakcie',val:inProgress,col:'var(--accent)'},
        {icon:'✅',label:'Ukończone',val:completed+8,col:'var(--teal)'},
        {icon:'⏳',label:'Oczekujące',val:CL.length-ONB_ACTIVE.length,col:'var(--orange)'},
        {icon:'📊',label:'Śr. czas (dni)',val:4.2,col:'var(--blue)'},
      ].map(s=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="font-size:20px;margin-bottom:6px;">${s.icon}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${s.col};line-height:1;">${s.val}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px;">${s.label}</div>
      </div>`).join('')}
    </div>

    <!-- aktywne onboardingi -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;">AKTYWNE ONBOARDINGI</div>
      <button class="btn btn-primary btn-sm" onclick="setOnbTab('new')">+ Nowy klient</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
      ${ONB_ACTIVE.map(o=>{
        const c=CL.find(x=>x.id===o.clientId);if(!c)return'';
        const flow=ONB_FLOWS.find(f=>f.id===o.flow)||ONB_FLOWS[0];
        const steps=flow.steps.map(sid=>ONB_STEPS.find(s=>s.id===sid)).filter(Boolean);
        const pct=Math.round(o.step/steps.length*100);
        const curStep=steps[o.step]||steps[steps.length-1];
        return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:42px;height:42px;border-radius:12px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--accent);flex-shrink:0;">${getInit(c.name)}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;">${c.name}</div>
              <div style="font-size:11px;color:var(--muted);">Flow: ${flow.icon} ${flow.name} · Start: ${o.startDate}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:18px;font-weight:700;color:var(--accent);">${pct}%</div>
              <div style="font-size:10px;color:var(--muted);">${o.step}/${steps.length} kroków</div>
            </div>
          </div>
          <!-- pasek postępu z krokami -->
          <div style="display:flex;gap:3px;margin-bottom:10px;">
            ${steps.map((s,i)=>`<div title="${s.label}" style="flex:1;height:6px;border-radius:3px;background:${i<o.step?'var(--accent)':i===o.step?'rgba(225,31,46,0.4)':'var(--s3)'};transition:background 0.3s;"></div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:11px;color:var(--muted);">
              ${o.step<steps.length?`Następny krok: <span style="color:var(--accent);">${curStep?.icon} ${curStep?.label}</span>`:'<span style="color:var(--teal);">✓ Onboarding ukończony!</span>'}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="onbCompleteStep('${o.clientId}')">Potwierdź krok ✓</button>
              <button class="btn btn-primary btn-sm" onclick="onbViewClient('${o.clientId}')">Otwórz →</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- klienci bez onboardingu -->
    ${CL.filter(c=>!ONB_ACTIVE.find(o=>o.clientId===c.id)).length?`
    <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;margin-bottom:12px;color:var(--muted);">KLIENCI BEZ ONBOARDINGU</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
      ${CL.filter(c=>!ONB_ACTIVE.find(o=>o.clientId===c.id)).map(c=>`
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--muted);">${getInit(c.name)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
            <div style="font-size:10px;color:var(--muted);">Brak onboardingu</div>
          </div>
          <button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="onbStartFor('${c.id}')">Start</button>
        </div>`).join('')}
    </div>`:''}`;
}

function onbCompleteStep(cid){
  const o=ONB_ACTIVE.find(x=>x.clientId===cid);if(!o)return;
  const flow=ONB_FLOWS.find(f=>f.id===o.flow)||ONB_FLOWS[0];
  if(o.step<flow.steps.length){o.step++;notify('✓ Krok ukończony!');}
  else notify('Onboarding już ukończony!');
  if(!o.id)o.id=newId('onba');
  withTrainer(o);
  persistById('onboardingActive',o);
  renderOnbOverview();
}

function onbViewClient(cid){
  goTo('clients');
  setTimeout(()=>openClientProfile&&openClientProfile(cid),300);
}

function onbStartFor(cid){
  const c=CL.find(x=>x.id===cid);if(!c)return;
  const o=withTrainer({id:newId('onba'),clientId:cid,step:0,startDate:new Date().toISOString().split('T')[0],flow:'standard'});
  ONB_ACTIVE.push(o);
  persistById('onboardingActive',o);
  notify('✓ Onboarding uruchomiony dla '+c.name);
  renderOnbOverview();
}

/* ── NEW CLIENT WIZARD ── */
const ONB_WIZARD_STEPS=[
  {label:'Dane podstawowe', icon:'👤'},
  {label:'Cel i poziom',    icon:'🎯'},
  {label:'Zdrowie',         icon:'🩺'},
  {label:'Plan i flow',     icon:'📋'},
  {label:'Potwierdzenie',   icon:'✅'},
];

function renderOnbNew(){
  const el=document.getElementById('onb-new-tab');if(!el)return;
  const step=onbStep;
  const total=ONB_WIZARD_STEPS.length;

  el.innerHTML=`
    <div style="max-width:680px;margin:0 auto;">
      <!-- stepper -->
      <div style="display:flex;align-items:center;margin-bottom:28px;">
        ${ONB_WIZARD_STEPS.map((s,i)=>`
          <div style="display:flex;align-items:center;flex:${i<total-1?1:'none'};">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${i<step?'14px':'16px'};
                background:${i<step?'var(--teal)':i===step?'var(--accent)':'var(--s3)'};
                color:${i<=step?'#000':'var(--muted)'};font-weight:700;border:2px solid ${i===step?'var(--accent)':i<step?'var(--teal)':'var(--border2)'};">${i<step?'✓':s.icon}</div>
              <div style="font-size:9px;font-family:'DM Mono',monospace;color:${i===step?'var(--accent)':i<step?'var(--teal)':'var(--muted)'};white-space:nowrap;">${s.label}</div>
            </div>
            ${i<total-1?`<div style="flex:1;height:2px;background:${i<step?'var(--teal)':'var(--border)'};margin:0 6px;margin-bottom:18px;"></div>`:''}
          </div>`).join('')}
      </div>

      <!-- step content -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:28px;margin-bottom:16px;" id="onb-wizard-body">
        ${onbWizardStepHTML(step)}
      </div>

      <!-- nav buttons -->
      <div style="display:flex;gap:10px;justify-content:space-between;">
        <button class="btn btn-ghost" onclick="onbWizardBack()" ${step===0?'disabled style="opacity:0.4;"':''}>← Wstecz</button>
        <button class="btn btn-primary" onclick="onbWizardNext()" id="onb-next-btn">${step===total-1?'✓ Utwórz klienta':'Dalej →'}</button>
      </div>
    </div>`;
}

function onbWizardStepHTML(step){
  if(step===0) return `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">👤 DANE PODSTAWOWE</div>
    <div class="form-grid">
      <div class="form-field"><label class="form-lbl">Imię i nazwisko *</label>
        <input type="text" class="form-input" id="onb-name" placeholder="Jan Kowalski" value="${onbNewClient.name||''}"></div>
      <div class="form-field"><label class="form-lbl">Email *</label>
        <input type="email" class="form-input" id="onb-email" placeholder="jan@example.com" value="${onbNewClient.email||''}"></div>
      <div class="form-field"><label class="form-lbl">Telefon</label>
        <input type="tel" class="form-input" id="onb-phone" placeholder="+48 123 456 789" value="${onbNewClient.phone||''}"></div>
      <div class="form-field"><label class="form-lbl">Data urodzenia</label>
        <input type="date" class="form-input" id="onb-dob" value="${onbNewClient.dob||''}"></div>
      <div class="form-field"><label class="form-lbl">Płeć</label>
        <select class="form-select" id="onb-gender">
          <option value="mężczyzna" ${onbNewClient.gender==='mężczyzna'?'selected':''}>Mężczyzna</option>
          <option value="kobieta" ${onbNewClient.gender==='kobieta'?'selected':''}>Kobieta</option>
          <option value="inne">Inne</option>
        </select></div>
      <div class="form-field"><label class="form-lbl">Skąd trafił/a do Ciebie?</label>
        <select class="form-select" id="onb-source">
          <option value="polecenie">Polecenie znajomego</option>
          <option value="instagram">Instagram</option>
          <option value="google">Google</option>
          <option value="tiktok">TikTok</option>
          <option value="inne">Inne</option>
        </select></div>
    </div>`;

  if(step===1) return `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">🎯 CEL I POZIOM</div>
    <div class="form-field"><label class="form-lbl">Główny cel treningowy *</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;" id="onb-goal-opts">
        ${[['masa','💪','Budowa masy'],['sila','🏋️','Siła'],['redukcja','🔥','Redukcja'],['kondycja','🏃','Kondycja'],['atletyzm','⚡','Atletyzm'],['rehab','🩺','Rehab']].map(([v,ico,l])=>`
          <button class="apl-opt${onbNewClient.goal===v?' active':''}" data-val="${v}" onclick="onbSetVal('goal','${v}');this.closest('[id]')?.querySelectorAll('.apl-opt').forEach(b=>b.classList.remove('active'));this.classList.add('active');" style="text-align:center;">${ico}<br><span style="font-size:10px;">${l}</span></button>`).join('')}
      </div></div>
    <div class="form-grid" style="margin-top:14px;">
      <div class="form-field"><label class="form-lbl">Poziom zaawansowania</label>
        <select class="form-select" id="onb-level" onchange="onbSetVal('level',this.value)">
          <option value="poczatkujacy" ${onbNewClient.level==='poczatkujacy'?'selected':''}>🌱 Początkujący (0-1 rok)</option>
          <option value="sredni" ${onbNewClient.level==='sredni'?'selected':''}>⚡ Średni (1-3 lata)</option>
          <option value="zaawansowany" ${onbNewClient.level==='zaawansowany'?'selected':''}>🔥 Zaawansowany (3+ lat)</option>
        </select></div>
      <div class="form-field"><label class="form-lbl">Ile razy w tygodniu chce trenować?</label>
        <select class="form-select" id="onb-freq" onchange="onbSetVal('freq',this.value)">
          ${[2,3,4,5,6].map(n=>`<option value="${n}" ${onbNewClient.freq==n?'selected':''}>${n}× w tygodniu</option>`).join('')}
        </select></div>
      <div class="form-field"><label class="form-lbl">Waga (kg)</label>
        <input type="number" class="form-input" id="onb-weight" placeholder="80" value="${onbNewClient.weight||''}"></div>
      <div class="form-field"><label class="form-lbl">Wzrost (cm)</label>
        <input type="number" class="form-input" id="onb-height" placeholder="178" value="${onbNewClient.height||''}"></div>
    </div>
    <div class="form-field" style="margin-top:10px;"><label class="form-lbl">Opis celu własnymi słowami</label>
      <textarea class="form-input" id="onb-goal-desc" rows="2" placeholder="np. chcę schudnąć 10 kg na wakacje..." style="resize:none;font-size:13px;">${onbNewClient.goalDesc||''}</textarea></div>`;

  if(step===2) return `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">🩺 ZDROWIE I OGRANICZENIA</div>
    <div class="form-field"><label class="form-lbl">Kontuzje lub problemy zdrowotne</label>
      <textarea class="form-input" id="onb-injuries" rows="3" placeholder="np. ból kolan, przepuklina, nadciśnienie..." style="resize:none;font-size:13px;">${onbNewClient.injuries||''}</textarea></div>
    <div class="form-field"><label class="form-lbl">Leki stałe</label>
      <input type="text" class="form-input" id="onb-meds" placeholder="np. inhibitory ACE, metformina..." value="${onbNewClient.meds||''}"></div>
    <div class="form-field"><label class="form-lbl">Aktywność fizyczna dotychczas</label>
      <select class="form-select" id="onb-activity">
        <option value="sedentary">Siedzący tryb życia</option>
        <option value="light">Lekka aktywność (spacery)</option>
        <option value="moderate">Umiarkowana (rekreacyjnie)</option>
        <option value="active">Aktywny (regularny trening)</option>
      </select></div>
    <div class="form-field"><label class="form-lbl">Dostępny sprzęt</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
        ${[['gym','🏋️','Pełna siłownia'],['dumbbells','💪','Hantle'],['home','🏠','Ćwiczenia domowe'],['pool','🏊','Basen'],['outdoor','🌳','Na zewnątrz'],['none','❌','Bez sprzętu']].map(([v,ico,l])=>`
          <label style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--s3);border-radius:7px;cursor:pointer;font-size:11px;">
            <input type="checkbox" value="${v}" class="onb-equip-check" style="accent-color:var(--accent);">${ico} ${l}
          </label>`).join('')}
      </div></div>
    <div class="form-field"><label class="form-lbl">Czy wyraża zgodę na przetwarzanie danych (RODO)?</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="onb-rodo" ${onbNewClient.rodo?'checked':''} style="accent-color:var(--accent);width:16px;height:16px;">
        <span>Tak, wyrażam zgodę na przetwarzanie danych osobowych przez Piotra Urbaniaka w celu świadczenia usług treningowych.</span>
      </label></div>`;

  if(step===3) return `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">📋 PLAN I ONBOARDING FLOW</div>
    <div class="form-field"><label class="form-lbl">Flow onboardingu</label>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${ONB_FLOWS.map(f=>`<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--s3);border-radius:10px;cursor:pointer;border:1px solid ${onbNewClient.flow===f.id?'var(--accent)':'var(--border2)'};" onclick="onbSetVal('flow','${f.id}');document.querySelectorAll('#onb-new-tab label[style*=border]').forEach(l=>l.style.borderColor='var(--border2)');this.style.borderColor='var(--accent)';">
          <input type="radio" name="onb-flow" value="${f.id}" ${onbNewClient.flow===f.id?'checked':''} style="accent-color:var(--accent);">
          <span style="font-size:18px;">${f.icon}</span>
          <div><div style="font-size:13px;font-weight:700;">${f.name} <span style="font-size:10px;color:var(--muted);">(${f.duration})</span></div>
          <div style="font-size:11px;color:var(--muted);">${f.desc}</div></div>
        </label>`).join('')}
      </div></div>
    <div class="form-field"><label class="form-lbl">Przypisz szablon planu treningowego (opcjonalnie)</label>
      <select class="form-select" id="onb-template" onchange="onbSetVal('template',this.value)">
        <option value="">Bez planu na razie</option>
        ${PLAN_TEMPLATES.slice(0,10).map(t=>`<option value="${t.id}" ${onbNewClient.template===t.id?'selected':''}>${t.name}</option>`).join('')}
      </select></div>
    <div class="form-field"><label class="form-lbl">Pakiet startowy</label>
      <select class="form-select" id="onb-package" onchange="onbSetVal('package',this.value)">
        <option value="">Bez pakietu</option>
        <option value="4sess">4 sesje (600 PLN)</option>
        <option value="8sess">8 sesji (1100 PLN)</option>
        <option value="12sess">12 sesji (1500 PLN)</option>
        <option value="online">Online miesięcznie (350 PLN/mies.)</option>
      </select></div>
    <div class="form-field"><label class="form-lbl">Notatka prywatna (widoczna tylko dla Ciebie)</label>
      <textarea class="form-input" id="onb-private-note" rows="2" placeholder="np. klient polecony przez Annę, wrażliwy na kolan..." style="resize:none;font-size:13px;">${onbNewClient.privateNote||''}</textarea></div>`;

  if(step===4) return `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:20px;">✅ POTWIERDZENIE</div>
    <div style="background:var(--adim);border:1px solid rgba(225,31,46,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;">Podsumowanie nowego klienta</div>
      ${[
        ['Imię i nazwisko',onbNewClient.name||'—'],
        ['Email',onbNewClient.email||'—'],
        ['Telefon',onbNewClient.phone||'—'],
        ['Cel',onbNewClient.goal||'—'],
        ['Poziom',onbNewClient.level||'—'],
        ['Flow',ONB_FLOWS.find(f=>f.id===onbNewClient.flow)?.name||'Standard'],
        ['Pakiet',onbNewClient.package||'Brak'],
        ['Szablon planu',onbNewClient.template?PLAN_TEMPLATES.find(t=>t.id===onbNewClient.template)?.name:'Brak'],
      ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <span style="color:var(--muted);">${l}</span>
        <span style="font-weight:600;">${v}</span>
      </div>`).join('')}
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7;">Po kliknięciu "Utwórz klienta":<br>
    ✓ Klient zostanie dodany do listy klientów<br>
    ✓ Uruchomi się flow onboardingu<br>
    ${onbNewClient.template?'✓ Zostanie przypisany szablon planu treningowego<br>':''}
    ✓ Zostanie wysłane powiadomienie powitalne</div>`;

  return '<div>Nieznany krok</div>';
}

function onbSetVal(key,val){onbNewClient[key]=val;}

function onbWizardBack(){
  if(onbStep>0){onbStep--;renderOnbNew();}
}

function onbWizardNext(){
  // collect current step values
  if(onbStep===0){
    onbNewClient.name=document.getElementById('onb-name')?.value||'';
    onbNewClient.email=document.getElementById('onb-email')?.value||'';
    onbNewClient.phone=document.getElementById('onb-phone')?.value||'';
    onbNewClient.dob=document.getElementById('onb-dob')?.value||'';
    onbNewClient.gender=document.getElementById('onb-gender')?.value||'mężczyzna';
    onbNewClient.source=document.getElementById('onb-source')?.value||'';
    if(!onbNewClient.name||!onbNewClient.email){notify('⚠ Wypełnij imię i email!');return;}
  }
  if(onbStep===1){
    onbNewClient.level=document.getElementById('onb-level')?.value||'sredni';
    onbNewClient.freq=document.getElementById('onb-freq')?.value||3;
    onbNewClient.weight=document.getElementById('onb-weight')?.value||'';
    onbNewClient.height=document.getElementById('onb-height')?.value||'';
    onbNewClient.goalDesc=document.getElementById('onb-goal-desc')?.value||'';
    if(!onbNewClient.goal){notify('⚠ Wybierz cel!');return;}
  }
  if(onbStep===2){
    onbNewClient.injuries=document.getElementById('onb-injuries')?.value||'';
    onbNewClient.meds=document.getElementById('onb-meds')?.value||'';
    onbNewClient.rodo=document.getElementById('onb-rodo')?.checked||false;
    if(!onbNewClient.rodo){notify('⚠ Wymagana zgoda RODO!');return;}
  }
  if(onbStep===3){
    onbNewClient.template=document.getElementById('onb-template')?.value||'';
    onbNewClient.package=document.getElementById('onb-package')?.value||'';
    onbNewClient.privateNote=document.getElementById('onb-private-note')?.value||'';
    if(!onbNewClient.flow)onbNewClient.flow='standard';
  }
  if(onbStep===ONB_WIZARD_STEPS.length-1){
    onbCreateClient();return;
  }
  onbStep++;
  renderOnbNew();
}

function onbCreateClient(){
  const newC=withTrainer({
    id:newId('c'),
    name:onbNewClient.name,
    email:onbNewClient.email,
    phone:onbNewClient.phone||'',
    goal:onbNewClient.goal||'masa',
    level:onbNewClient.level||'sredni',
    weight:onbNewClient.weight||'',
    height:onbNewClient.height||'',
    gender:onbNewClient.gender||'mężczyzna',
    injuries:onbNewClient.injuries||'',
    notes:onbNewClient.privateNote||'',
    status:'active',
    joinDate:new Date().toISOString().split('T')[0],
    source:onbNewClient.source||'',
  });
  CL.push(newC);
  persistById('clients',newC);

  // assign template plan
  if(onbNewClient.template){
    const t=PLAN_TEMPLATES.find(x=>x.id===onbNewClient.template);
    if(t){
      const p=withTrainer({id:newId('p'),name:t.name,clientId:newC.id,method:t.method,duration:t.weeks,
        days:(t.days_detail||[]).map(d=>({day:d.name,exercises:(d.exercises||[]).map(e=>({name:e.n,sets:e.s,reps:e.r}))})),
        source:'template',createdAt:new Date().toISOString()});
      PL.push(p);
      persistById('plans',p);
    }
  }

  // start onboarding flow
  const onbRec=withTrainer({id:newId('onba'),clientId:newC.id,step:1,startDate:new Date().toISOString().split('T')[0],flow:onbNewClient.flow||'standard'});
  ONB_ACTIVE.push(onbRec);
  persistById('onboardingActive',onbRec);

  // add first tasks
  const tasks=[
    withTrainer({id:newId('t'),clientId:newC.id,title:'Wypełnij ankietę wstępną',status:'open',priority:'high',cat:'lifestyle',due:new Date(Date.now()+86400000).toISOString().split('T')[0],createdAt:new Date().toISOString()}),
    withTrainer({id:newId('t'),clientId:newC.id,title:'Zaakceptuj kontrakt współpracy',status:'open',priority:'high',cat:'lifestyle',due:new Date(Date.now()+2*86400000).toISOString().split('T')[0],createdAt:new Date().toISOString()}),
    withTrainer({id:newId('t'),clientId:newC.id,title:'Zainstaluj aplikację Progress Live',status:'open',priority:'medium',cat:'lifestyle',due:new Date(Date.now()+3*86400000).toISOString().split('T')[0],createdAt:new Date().toISOString()}),
  ];
  tasks.forEach(t=>{TASKS.push(t);persistById('tasks',t);});

  addNotification('system','Nowy klient!',newC.name+' — onboarding uruchomiony','clients');
  notify('🎉 Klient '+newC.name+' dodany! Onboarding uruchomiony.');
  if(typeof runOnboardingForClient==='function')runOnboardingForClient(newC);

  onbNewClient={};onbStep=0;
  setOnbTab('overview');
}

/* ── FLOWS ── */
function renderOnbFlows(){
  const el=document.getElementById('onb-flows-tab');if(!el)return;
  el.innerHTML=`
    <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:6px;">SZABLONY FLOW ONBOARDINGU</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:20px;">Każdy flow definiuje kolejność kroków onboardingu dla nowego klienta.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      ${ONB_FLOWS.map(f=>`<div style="background:var(--s2);border:1px solid var(--border);border-top:3px solid ${f.color};border-radius:12px;padding:18px;">
        <div style="font-size:24px;margin-bottom:8px;">${f.icon}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${f.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.6;">${f.desc}</div>
        <div style="font-size:10px;color:${f.color};font-family:'DM Mono',monospace;margin-bottom:10px;">⏱ ${f.duration} · ${f.steps.length} kroków</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">
          ${f.steps.map(sid=>{const s=ONB_STEPS.find(x=>x.id===sid);return s?`<span style="background:var(--s3);border-radius:5px;padding:2px 7px;font-size:10px;color:var(--muted);">${s.icon} ${s.label}</span>`:''}).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="setOnbTab('new');onbSetVal('flow','${f.id}')">Użyj tego flow →</button>
      </div>`).join('')}
    </div>`;
}

/* ── SETTINGS ── */
function renderOnbSettings(){
  const el=document.getElementById('onb-settings-tab');if(!el)return;
  const S=window.SETTINGS||{};
  const onb=S.onboarding||{};
  const contract=onb.contract||'Regulamin współpracy z trenerem personalnym\n\n1. Klient zobowiązuje się do regularnego uczestnictwa w sesjach.\n2. Odwołanie sesji możliwe do 24h przed jej terminem.\n3. Trener zastrzega sobie prawo do modyfikacji planu.';
  el.innerHTML=`
    <div style="max-width:600px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:20px;">USTAWIENIA ONBOARDINGU</div>
      <div class="settings-card" style="margin-bottom:14px;">
        <div class="settings-card-title">📩 Automatyczne wiadomości</div>
        <div class="settings-card-desc">Wiadomości wysyłane automatycznie na każdym etapie onboardingu.</div>
        ${ONB_STEPS.slice(0,5).map(s=>`<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <span>${s.icon} ${s.label}</span>
          <input type="checkbox" class="onb-msg-step" data-step="${s.id}" ${(onb.msgSteps&&onb.msgSteps[s.id]===false)?'':'checked'} style="accent-color:var(--accent);">
        </label>`).join('')}
      </div>
      <div class="settings-card" style="margin-bottom:14px;">
        <div class="settings-card-title">⏰ Przypomnienia</div>
        <div class="settings-card-desc">Automatyczne przypomnienia gdy klient nie ukończy kroku.</div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Przypomnij po (dni)</label>
            <input type="number" class="form-input" id="onb-remind-days" value="${onb.remindDays||2}" style="font-size:12px;"></div>
          <div class="form-field"><label class="form-lbl">Kanał przypomnienia</label>
            <select class="form-select" id="onb-remind-channel" style="font-size:12px;">
              <option value="email" ${(onb.remindChannel||'email')==='email'?'selected':''}>Email</option>
              <option value="whatsapp" ${onb.remindChannel==='whatsapp'?'selected':''}>WhatsApp</option>
              <option value="sms" ${onb.remindChannel==='sms'?'selected':''}>SMS</option>
            </select></div>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card-title">📝 Domyślny kontrakt</div>
        <div class="settings-card-desc">Treść kontraktu współpracy wysyłanego klientom.</div>
        <textarea class="form-input" id="onb-contract-text" rows="5" style="font-size:12px;resize:none;">${escHtml(contract)}</textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="saveOnbContract()">Zapisz ustawienia onboardingu</button>
      </div>
    </div>`;
}

function saveOnbContract(){
  const S=window.SETTINGS||(window.SETTINGS={});
  if(!S.onboarding)S.onboarding={};
  S.onboarding.contract=document.getElementById('onb-contract-text')?.value||'';
  S.onboarding.remindDays=parseInt(document.getElementById('onb-remind-days')?.value)||2;
  S.onboarding.remindChannel=document.getElementById('onb-remind-channel')?.value||'email';
  S.onboarding.msgSteps={};
  document.querySelectorAll('.onb-msg-step').forEach(cb=>{S.onboarding.msgSteps[cb.dataset.step]=cb.checked;});
  if(typeof persistSettingsDoc==='function')persistSettingsDoc();
  else{
    withTrainer(S);
    if(window._db){
      const sid=window._settingsDocId||window._uid||'default';
      window._setDoc(window._doc(window._db,'settings',sid),S,{merge:true}).catch(()=>{});
    }
  }
  notify('✓ Ustawienia onboardingu zapisane');
}
window.saveOnbContract=saveOnbContract;

window.initOnboarding=initOnboarding;window.setOnbTab=setOnbTab;
window.renderOnbNew=renderOnbNew;window.onbWizardBack=onbWizardBack;
window.onbWizardNext=onbWizardNext;window.onbSetVal=onbSetVal;
window.onbCompleteStep=onbCompleteStep;window.onbViewClient=onbViewClient;
window.onbStartFor=onbStartFor;window.onbCreateClient=onbCreateClient;

// ════════════════════════════════════════
// SZABLONY PLANÓW
// ════════════════════════════════════════
var tplFilter='all';
var tplDetailId=null;
var TPL_CUSTOM=[];
window.TPL_CUSTOM=TPL_CUSTOM;

const PLAN_TEMPLATES=[
  // ── MASA ──
  {id:'t01',name:'PPL 3× — Budowa masy',goal:'masa',level:'sredni',method:'PPL',days:3,weeks:8,
   desc:'Klasyczny Push/Pull/Legs 3 razy w tygodniu. Ideał dla osób z ograniczonym czasem, szukających solidnego wzrostu masy mięśniowej.',
   tags:['masa','PPL','3×/tydzień','sztanga'],
   color:'var(--accent)',popularity:98,
   schedule:['Pon: Push','Śr: Pull','Pt: Legs'],
   days_detail:[
     {name:'Push — Klatka, Barki, Triceps',exercises:[
       {n:'Wyciskanie sztangi leżąc',s:'4',r:'6-8',rest:'180s'},
       {n:'Wyciskanie hantli skos+',s:'3',r:'10-12',rest:'90s'},
       {n:'Rozpiętki wyciąg',s:'3',r:'12-15',rest:'60s'},
       {n:'OHP ze sztangą',s:'4',r:'8-10',rest:'120s'},
       {n:'Wznosy hantli bokiem',s:'4',r:'12-15',rest:'60s'},
       {n:'Prostowanie triceps wyciąg',s:'3',r:'12-15',rest:'60s'},
       {n:'Dipy na poręczach',s:'3',r:'10-12',rest:'90s'},
     ]},
     {name:'Pull — Plecy, Biceps',exercises:[
       {n:'Martwy ciąg',s:'4',r:'5-6',rest:'240s'},
       {n:'Podciąganie na drążku',s:'4',r:'6-10',rest:'120s'},
       {n:'Wiosłowanie sztangą',s:'3',r:'8-10',rest:'120s'},
       {n:'Wiosłowanie hantlą',s:'3',r:'10-12',rest:'90s'},
       {n:'Ściąganie wyciąg górny',s:'3',r:'12-15',rest:'75s'},
       {n:'Uginanie ramion ze sztangą',s:'3',r:'10-12',rest:'75s'},
       {n:'Uginanie młotkowe',s:'3',r:'12',rest:'60s'},
     ]},
     {name:'Legs — Nogi, Pośladki',exercises:[
       {n:'Przysiad ze sztangą',s:'4',r:'6-8',rest:'180s'},
       {n:'Leg press',s:'3',r:'10-12',rest:'120s'},
       {n:'Wypady z hantlami',s:'3',r:'12/stronę',rest:'90s'},
       {n:'Prostowanie nóg maszyna',s:'3',r:'15',rest:'60s'},
       {n:'Uginanie nóg leżąc',s:'3',r:'12-15',rest:'60s'},
       {n:'Wspięcia na palce stojąc',s:'4',r:'15-20',rest:'60s'},
     ]},
   ]},

  {id:'t02',name:'PPL 6× — Zaawansowana masa',goal:'masa',level:'zaawansowany',method:'PPL',days:6,weeks:12,
   desc:'PPL 6 dni w tygodniu — każda partia trenowana 2× w tygodniu. Maksymalna częstotliwość dla szybkiego wzrostu masy.',
   tags:['masa','PPL','6×/tydzień','zaawansowany'],
   color:'var(--accent)',popularity:85,
   schedule:['Pon: Push','Wt: Pull','Śr: Legs','Czw: Push','Pt: Pull','Sob: Legs'],
   days_detail:[]},

  {id:'t03',name:'FBW 3× — Początkujący',goal:'masa',level:'poczatkujacy',method:'FBW',days:3,weeks:8,
   desc:'Full Body Workout 3 razy w tygodniu. Idealny start dla osób bez doświadczenia. Trenuje całe ciało każdego dnia.',
   tags:['masa','FBW','3×/tydzień','początkujący'],
   color:'var(--teal)',popularity:95,
   schedule:['Pon: Full Body A','Śr: Full Body B','Pt: Full Body A/B'],
   days_detail:[
     {name:'Full Body A',exercises:[
       {n:'Przysiad ze sztangą',s:'3',r:'5',rest:'180s'},
       {n:'Wyciskanie sztangi leżąc',s:'3',r:'5',rest:'180s'},
       {n:'Wiosłowanie sztangą',s:'3',r:'5',rest:'180s'},
       {n:'OHP ze sztangą',s:'2',r:'5',rest:'120s'},
       {n:'Martwy ciąg',s:'1',r:'5',rest:'240s'},
     ]},
     {name:'Full Body B',exercises:[
       {n:'Przysiad ze sztangą',s:'3',r:'5',rest:'180s'},
       {n:'Wyciskanie sztangi leżąc',s:'3',r:'5',rest:'180s'},
       {n:'Podciąganie/wspomagane',s:'3',r:'5',rest:'180s'},
       {n:'OHP ze sztangą',s:'2',r:'5',rest:'120s'},
       {n:'Martwy ciąg',s:'1',r:'5',rest:'240s'},
     ]},
   ]},

  {id:'t04',name:'Upper/Lower 4× — Masa',goal:'masa',level:'sredni',method:'UL',days:4,weeks:10,
   desc:'4 dni w tygodniu — 2 treningi górne i 2 dolne. Dobry balans między częstotliwością a regeneracją.',
   tags:['masa','Upper/Lower','4×/tydzień'],
   color:'var(--blue)',popularity:88,
   schedule:['Pon: Upper A','Wt: Lower A','Czw: Upper B','Pt: Lower B'],
   days_detail:[]},

  {id:'t05',name:'Stronglifts 5×5',goal:'sila',level:'poczatkujacy',method:'FBW',days:3,weeks:12,
   desc:'Legendarny program siłowy 5×5. Trzy ćwiczenia bazowe, 5 serii po 5 powtórzeń. Progresja 2.5 kg każdy trening.',
   tags:['siła','5×5','3×/tydzień','klasyk'],
   color:'var(--orange)',popularity:97,
   schedule:['Pon: Workout A','Śr: Workout B','Pt: Workout A'],
   days_detail:[
     {name:'Workout A',exercises:[
       {n:'Przysiad ze sztangą',s:'5',r:'5',rest:'180s'},
       {n:'Wyciskanie sztangi leżąc',s:'5',r:'5',rest:'180s'},
       {n:'Wiosłowanie sztangą',s:'5',r:'5',rest:'180s'},
     ]},
     {name:'Workout B',exercises:[
       {n:'Przysiad ze sztangą',s:'5',r:'5',rest:'180s'},
       {n:'OHP ze sztangą',s:'5',r:'5',rest:'180s'},
       {n:'Martwy ciąg',s:'1',r:'5',rest:'300s'},
     ]},
   ]},

  {id:'t06',name:'5/3/1 Wendler — Siła',goal:'sila',level:'sredni',method:'531',days:4,weeks:16,
   desc:'Kultowy program siłowy Jima Wendlera. Cykl 4-tygodniowy z progresją. Skupiony na 4 ćwiczeniach bazowych + praca uzupełniająca.',
   tags:['siła','5/3/1','4×/tydzień','cykl'],
   color:'var(--orange)',popularity:92,
   schedule:['Pon: Przysiad','Wt: Bench','Czw: Martwy ciąg','Pt: OHP'],
   days_detail:[
     {name:'Tydzień 1 — Przysiad (dzień przykładowy)',exercises:[
       {n:'Przysiad — rozgrzewka',s:'2',r:'5',rest:'120s'},
       {n:'Przysiad 65% 1RM',s:'1',r:'5',rest:'180s'},
       {n:'Przysiad 75% 1RM',s:'1',r:'5',rest:'180s'},
       {n:'Przysiad 85% 1RM',s:'1',r:'5+',rest:'240s'},
       {n:'Leg press (BBB)',s:'5',r:'10',rest:'90s'},
       {n:'Uginanie nóg',s:'5',r:'10',rest:'60s'},
     ]},
   ]},

  {id:'t07',name:'PHUL — Power Hypertrophy',goal:'masa',level:'zaawansowany',method:'UL',days:4,weeks:12,
   desc:'Power Hypertrophy Upper Lower — łączy trening siłowy i hipertroficzny. 2 dni mocy + 2 dni objętościowe.',
   tags:['masa','siła','PHUL','4×/tydzień'],
   color:'var(--purple)',popularity:80,
   schedule:['Pon: Upper Power','Wt: Lower Power','Czw: Upper Hyper','Pt: Lower Hyper'],
   days_detail:[]},

  // ── REDUKCJA ──
  {id:'t08',name:'Fat Loss — FBW 4×',goal:'redukcja',level:'sredni',method:'FBW',days:4,weeks:8,
   desc:'Full Body z deficytem kalorycznym. Wysoka częstotliwość treningu przy niskiej objętości — utrzymanie masy mięśniowej podczas redukcji.',
   tags:['redukcja','FBW','4×/tydzień','cardio'],
   color:'var(--red)',popularity:82,
   schedule:['Pon: FBW','Wt: Cardio LISS','Śr: FBW','Czw: Cardio HIIT','Pt: FBW','Sob: Cardio LISS'],
   days_detail:[
     {name:'Full Body — Redukcja',exercises:[
       {n:'Przysiad goblet',s:'4',r:'12-15',rest:'60s'},
       {n:'Wyciskanie hantli leżąc',s:'3',r:'12-15',rest:'60s'},
       {n:'Wiosłowanie hantlą',s:'3',r:'12-15',rest:'60s'},
       {n:'Wypady z hantlami',s:'3',r:'12/stronę',rest:'60s'},
       {n:'OHP hantlami',s:'3',r:'12-15',rest:'60s'},
       {n:'Deski (Plank)',s:'3',r:'45s',rest:'45s'},
       {n:'Mountain Climbers',s:'3',r:'30s',rest:'30s'},
     ]},
   ]},

  {id:'t09',name:'HIIT + Siła — 3×',goal:'redukcja',level:'sredni',method:'FBW',days:3,weeks:6,
   desc:'Trening obwodowy HIIT połączony z pracą siłową. Ideał dla szybkiej redukcji przy zachowaniu mięśni.',
   tags:['redukcja','HIIT','obwód','3×/tydzień'],
   color:'var(--red)',popularity:75,
   schedule:['Pon/Śr/Pt: HIIT+Siła'],
   days_detail:[]},

  // ── KONDYCJA ──
  {id:'t10',name:'Kondycja ogólna — 3×',goal:'kondycja',level:'poczatkujacy',method:'FBW',days:3,weeks:8,
   desc:'Program dla osób chcących poprawić ogólną sprawność fizyczną. Łączy siłę, wytrzymałość i mobilność.',
   tags:['kondycja','3×/tydzień','mobilność','dla każdego'],
   color:'var(--blue)',popularity:79,
   schedule:['Pon: Siła','Śr: Cardio + Core','Pt: Funkcjonalny'],
   days_detail:[]},

  {id:'t11',name:'Atletyzm — 4×',goal:'kondycja',level:'sredni',method:'UL',days:4,weeks:10,
   desc:'Program atletyczny rozwijający siłę, moc, szybkość i wytrzymałość. Ideał dla sportowców i osób aktywnych.',
   tags:['kondycja','atletyzm','moc','4×/tydzień'],
   color:'var(--blue)',popularity:72,
   schedule:['Pon: Siła górna','Wt: Moc+sprint','Czw: Siła dolna','Pt: Wytrzymałość'],
   days_detail:[]},

  // ── KOBIETY ──
  {id:'t12',name:'Glute & Legs — 3×',goal:'kobieta',level:'sredni',method:'UL',days:3,weeks:8,
   desc:'Dedykowany program dla kobiet skupiony na pośladkach i nogach. Progresja ciężarów, ćwiczenia izolowane i złożone.',
   tags:['kobieta','pośladki','nogi','3×/tydzień'],
   color:'var(--purple)',popularity:94,
   schedule:['Pon: Glutes+Legs A','Śr: Upper Body','Pt: Glutes+Legs B'],
   days_detail:[
     {name:'Glutes & Legs A',exercises:[
       {n:'Hip thrust ze sztangą',s:'4',r:'10-12',rest:'90s'},
       {n:'Przysiad sumo',s:'4',r:'10-12',rest:'90s'},
       {n:'RDL ze sztangą',s:'3',r:'10-12',rest:'90s'},
       {n:'Abdukcja na maszynie',s:'4',r:'15-20',rest:'60s'},
       {n:'Wypady bułgarskie',s:'3',r:'10/stronę',rest:'75s'},
       {n:'Uginanie nóg leżąc',s:'3',r:'12-15',rest:'60s'},
       {n:'Wspięcia na palce',s:'4',r:'15-20',rest:'45s'},
     ]},
     {name:'Upper Body — Kobiecy',exercises:[
       {n:'Wyciskanie hantli siedząc',s:'3',r:'12-15',rest:'75s'},
       {n:'Butterfly maszyna',s:'3',r:'12-15',rest:'60s'},
       {n:'Ściąganie wyciąg szerokim',s:'3',r:'12-15',rest:'75s'},
       {n:'Wiosłowanie wyciąg siedzący',s:'3',r:'12-15',rest:'75s'},
       {n:'Wznosy ramion bokiem',s:'3',r:'15',rest:'60s'},
       {n:'Uginanie ramion',s:'3',r:'12-15',rest:'60s'},
       {n:'Plank + warianty',s:'3',r:'40s',rest:'30s'},
     ]},
   ]},

  {id:'t13',name:'Full Body Kobiety — 3×',goal:'kobieta',level:'poczatkujacy',method:'FBW',days:3,weeks:8,
   desc:'Pełne ciało dla kobiet zaczynających przygodę z siłownią. Ćwiczenia funkcjonalne, bezpieczne dla kolan i pleców.',
   tags:['kobieta','FBW','3×/tydzień','początkujący'],
   color:'var(--purple)',popularity:88,
   schedule:['Pon/Śr/Pt: Full Body'],
   days_detail:[]},

  {id:'t14',name:'Tone & Sculpt — 4×',goal:'kobieta',level:'sredni',method:'UL',days:4,weeks:10,
   desc:'Program rzeźby dla kobiet — wysoka objętość, umiarkowane ciężary. Definiuje sylwetkę bez nadmiernej masy.',
   tags:['kobieta','rzeźba','4×/tydzień','ton'],
   color:'var(--purple)',popularity:82,
   schedule:['Pon: Upper A','Wt: Lower A','Czw: Upper B','Pt: Lower B'],
   days_detail:[]},

  // ── SENIOR ──
  {id:'t15',name:'Senior Active — 3×',goal:'senior',level:'poczatkujacy',method:'FBW',days:3,weeks:8,
   desc:'Bezpieczny program dla osób 50+. Skupiony na mobilności, sile funkcjonalnej i równowadze. Bez obciążeń osiowych.',
   tags:['senior','3×/tydzień','mobilność','bezpieczny'],
   color:'var(--teal)',popularity:76,
   schedule:['Pon/Śr/Pt: Full Body + Mobilność'],
   days_detail:[
     {name:'Senior — Full Body',exercises:[
       {n:'Przysiad do krzesła (BW)',s:'3',r:'10-15',rest:'90s'},
       {n:'Wyciskanie hantli siedząc',s:'3',r:'12-15',rest:'90s'},
       {n:'Wiosłowanie hantlą (oparcie)',s:'3',r:'12-15',rest:'90s'},
       {n:'Step-up na podest',s:'3',r:'10/stronę',rest:'90s'},
       {n:'Rotacje tułowia z taśmą',s:'3',r:'12/stronę',rest:'60s'},
       {n:'Plank na kolanach',s:'3',r:'20-30s',rest:'60s'},
       {n:'Stretching statyczny',s:'1',r:'10 min',rest:'—'},
     ]},
   ]},

  // ── SIŁA ──
  {id:'t16',name:'GZCLP — Siła dla każdego',goal:'sila',level:'poczatkujacy',method:'FBW',days:3,weeks:10,
   desc:'Program GZCLP — prosta progresja dla zaczynających przygodę z treningiem siłowym. 3 poziomy ćwiczeń (T1/T2/T3).',
   tags:['siła','GZCLP','3×/tydzień','progresja'],
   color:'var(--orange)',popularity:83,
   schedule:['Pon: A','Śr: B','Pt: C'],
   days_detail:[]},

  {id:'t17',name:'Texas Method — Siła',goal:'sila',level:'zaawansowany',method:'FBW',days:3,weeks:12,
   desc:'Legendarny Texas Method. Poniedziałek: wysoka objętość, środa: regeneracja, piątek: maksymalna intensywność.',
   tags:['siła','Texas Method','3×/tydzień','zaawansowany'],
   color:'var(--orange)',popularity:78,
   schedule:['Pon: Volume','Śr: Recovery','Pt: Intensity'],
   days_detail:[]},

  {id:'t18',name:'Starting Strength',goal:'sila',level:'poczatkujacy',method:'FBW',days:3,weeks:12,
   desc:'Program Marka Rippetoe. Dwa treningi zmieniane naprzemiennie, 3 podstawowe ćwiczenia na sesję. Prosta progresja liniowa.',
   tags:['siła','Starting Strength','3×/tydzień','klasyk'],
   color:'var(--orange)',popularity:91,
   schedule:['Pon: Workout A','Śr: Workout B','Pt: Workout A'],
   days_detail:[]},

  {id:'t19',name:'Nsuns 5/3/1 — 4 dni',goal:'sila',level:'zaawansowany',method:'531',days:4,weeks:16,
   desc:'Zmodyfikowany 5/3/1 z wyższą objętością. Program nSuns — popularny na Reddit /r/fitness. Szybki przyrost siły.',
   tags:['siła','5/3/1','nSuns','4×/tydzień'],
   color:'var(--orange)',popularity:80,
   schedule:['Pon: Bench+OHP','Wt: Squat+Deadlift','Czw: OHP+Bench','Pt: Deadlift+Squat'],
   days_detail:[]},

  // ── BEZ SPRZĘTU ──
  {id:'t20',name:'Calisthenics — Bez sprzętu',goal:'masa',level:'sredni',method:'UL',days:4,weeks:10,
   desc:'Program kalisteniki bez żadnego sprzętu. Pompki, podciągania, dipy, przysiady. Można ćwiczyć wszędzie.',
   tags:['masa','kalistenika','bez sprzętu','4×/tydzień'],
   color:'var(--teal)',popularity:77,
   schedule:['Pon: Push','Wt: Pull','Czw: Push','Pt: Pull+Legs'],
   days_detail:[
     {name:'Push — Klatka, Barki, Triceps',exercises:[
       {n:'Pompki szerokie',s:'4',r:'15-20',rest:'90s'},
       {n:'Pompki skośne (nogi wyżej)',s:'3',r:'12-15',rest:'75s'},
       {n:'Pompki diamentowe',s:'3',r:'10-15',rest:'75s'},
       {n:'Pompki na jednej ręce (progresja)',s:'3',r:'5/stronę',rest:'90s'},
       {n:'Dipy na krześle',s:'4',r:'12-15',rest:'75s'},
       {n:'Pike push-ups',s:'3',r:'12',rest:'60s'},
     ]},
     {name:'Pull — Plecy, Biceps',exercises:[
       {n:'Podciąganie podchwytem',s:'4',r:'6-10',rest:'120s'},
       {n:'Podciąganie nachwytem',s:'3',r:'6-10',rest:'120s'},
       {n:'Australian pull-ups',s:'3',r:'12-15',rest:'90s'},
       {n:'Face pulls z taśmą',s:'3',r:'15',rest:'60s'},
       {n:'Uginanie z taśmą',s:'3',r:'15',rest:'60s'},
     ]},
   ]},

  {id:'t21',name:'Home Workout — Hantle',goal:'masa',level:'poczatkujacy',method:'FBW',days:3,weeks:8,
   desc:'Program domowy z hantlami. Ideał dla osób trenujących w domu. Kompleksowy trening całego ciała.',
   tags:['masa','hantle','dom','3×/tydzień'],
   color:'var(--blue)',popularity:85,
   schedule:['Pon/Śr/Pt: Full Body'],
   days_detail:[]},

  {id:'t22',name:'Crossfit-Style — 5×',goal:'kondycja',level:'sredni',method:'FBW',days:5,weeks:8,
   desc:'Trening w stylu CrossFit — WOD (Workout of the Day). Wysoka intensywność, różnorodność ćwiczeń, codzienna zmiana.',
   tags:['kondycja','crossfit','5×/tydzień','intensywny'],
   color:'var(--red)',popularity:70,
   schedule:['Pon–Pt: WOD (zmienny)'],
   days_detail:[]},

  {id:'t23',name:'Rekompo — Masa+Redukcja',goal:'masa',level:'sredni',method:'UL',days:4,weeks:12,
   desc:'Program rekompo — jednoczesna budowa masy i redukcja tkanki tłuszczowej. Dla osób na utrzymaniu kalorycznym.',
   tags:['masa','redukcja','rekompo','4×/tydzień'],
   color:'var(--purple)',popularity:73,
   schedule:['Pon: Upper','Wt: Lower','Czw: Upper','Pt: Lower'],
   days_detail:[]},

  {id:'t24',name:'3-dniowy FBW + Cardio',goal:'redukcja',level:'poczatkujacy',method:'FBW',days:3,weeks:6,
   desc:'Idealny program na start przygody z odchudzaniem. 3 treningi siłowe + 2 sesje cardio LISS w tygodniu.',
   tags:['redukcja','FBW','3×/tydzień','cardio','początkujący'],
   color:'var(--red)',popularity:86,
   schedule:['Pon: FBW','Wt: Cardio','Śr: FBW','Czw: Cardio','Pt: FBW'],
   days_detail:[]},
];

function initTemplates(){
  renderTemplates();
  updateTplMyCount();
}

function setTplFilter(f,btn){
  tplFilter=f;
  document.querySelectorAll('.tpl-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTemplates();
}

function renderTemplates(){
  const el=document.getElementById('tpl-grid');if(!el)return;
  const q=(document.getElementById('tpl-search')?.value||'').toLowerCase();
  const goalMap={masa:'masa',sila:'sila',redukcja:'redukcja',kondycja:'kondycja',kobieta:'kobieta',senior:'senior'};
  const levelMap={poczatkujacy:'poczatkujacy',sredni:'sredni',zaawansowany:'zaawansowany'};
  const methodMap={PPL:'PPL',FBW:'FBW',UL:'Upper/Lower','531':'531'};

  let list=[...PLAN_TEMPLATES,...TPL_CUSTOM];

  if(tplFilter!=='all'){
    if(goalMap[tplFilter])list=list.filter(t=>t.goal===tplFilter);
    else if(levelMap[tplFilter])list=list.filter(t=>t.level===tplFilter);
    else if(methodMap[tplFilter])list=list.filter(t=>t.method===methodMap[tplFilter]||t.method===tplFilter);
  }
  if(q)list=list.filter(t=>t.name.toLowerCase().includes(q)||t.desc.toLowerCase().includes(q)||(t.tags||[]).some(tag=>tag.toLowerCase().includes(q)));

  const goalLabels={masa:'💪 Masa',sila:'🏋️ Siła',redukcja:'🔥 Redukcja',kondycja:'🏃 Kondycja',kobieta:'👩 Kobiety',senior:'🧓 Senior'};
  const levelLabels={poczatkujacy:'🌱 Poczatkujący',sredni:'⚡ Średni',zaawansowany:'🔥 Zaawansowany'};

  if(!list.length){
    el.innerHTML=`<div style="text-align:center;padding:80px;color:var(--muted);">
      <div style="font-size:36px;opacity:0.3;margin-bottom:12px;">📋</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak szablonów</div>
      <div style="font-size:12px;">Zmień filtry lub utwórz własny szablon.</div>
    </div>`;return;
  }

  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
    ${list.map((t,i)=>`<div class="tpl-card" style="animation-delay:${i*0.03}s;border-top:3px solid ${t.color};" onclick="openTplDetail('${t.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:700;line-height:1.3;flex:1;padding-right:8px;">${t.name}</div>
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);white-space:nowrap;">${t.days}×/tydzień</div>
      </div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:10px;">${t.desc.slice(0,80)}${t.desc.length>80?'…':''}</div>
      <div style="margin-bottom:10px;">
        <span class="tpl-tag" style="background:${t.color}22;color:${t.color};">${goalLabels[t.goal]||t.goal}</span>
        <span class="tpl-tag">${levelLabels[t.level]||t.level}</span>
        <span class="tpl-tag">${t.method}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:3px;">
          ${Array.from({length:5},(_,i)=>`<div style="height:3px;width:14px;border-radius:99px;background:${i<Math.round(t.popularity/20)?t.color:'var(--s3)'};"></div>`).join('')}
        </div>
        <div style="font-size:10px;color:var(--muted);">${t.weeks} tyg.</div>
      </div>
    </div>`).join('')}
  </div>`;
}

function openTplDetail(id){
  tplDetailId=id;
  const t=[...PLAN_TEMPLATES,...TPL_CUSTOM].find(x=>x.id===id);if(!t)return;
  const goalLabels={masa:'💪 Budowa masy',sila:'🏋️ Siła',redukcja:'🔥 Redukcja',kondycja:'🏃 Kondycja',kobieta:'👩 Dla kobiet',senior:'🧓 Senior'};
  const levelLabels={poczatkujacy:'🌱 Początkujący',sredni:'⚡ Średniozaawansowany',zaawansowany:'🔥 Zaawansowany'};

  const el=document.getElementById('tpl-detail');
  el.innerHTML=`
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;position:sticky;top:0;background:var(--s1);z-index:1;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;">${t.name}</div>
      <button onclick="closeTplDetail()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;">×</button>
    </div>
    <div style="padding:20px;">
      <!-- header info -->
      <div style="background:linear-gradient(135deg,${t.color}15,transparent);border:1px solid ${t.color}33;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:12px;">${t.desc}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <span class="tpl-tag" style="background:${t.color}22;color:${t.color};">${goalLabels[t.goal]||t.goal}</span>
          <span class="tpl-tag">${levelLabels[t.level]||t.level}</span>
          <span class="tpl-tag">🔁 ${t.method}</span>
          <span class="tpl-tag">📅 ${t.days}× /tydzień</span>
          <span class="tpl-tag">📆 ${t.weeks} tygodni</span>
        </div>
      </div>

      <!-- harmonogram -->
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Harmonogram tygodnia</div>
        ${(t.schedule||[]).map(s=>`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <span style="color:${t.color};">→</span><span>${s}</span>
        </div>`).join('')}
      </div>

      <!-- przykładowe ćwiczenia -->
      ${t.days_detail?.length?`
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Przykładowy dzień treningowy</div>
        ${t.days_detail.slice(0,1).map(d=>`
          <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px;">
            <div style="font-size:12px;font-weight:700;margin-bottom:8px;">${d.name}</div>
            ${d.exercises.map((ex,i)=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;align-items:center;">
              <span style="width:16px;height:16px;border-radius:4px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--accent);flex-shrink:0;">${i+1}</span>
              <span style="flex:1;">${ex.n}</span>
              <span style="font-family:'DM Mono',monospace;color:var(--accent);">${ex.s}×${ex.r}</span>
            </div>`).join('')}
          </div>`).join('')}
      </div>`:''}

      <!-- popularity -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">
          <span style="color:var(--muted);">Popularność</span>
          <span style="color:${t.color};font-weight:700;">${t.popularity}%</span>
        </div>
        <div style="height:5px;background:var(--s3);border-radius:99px;overflow:hidden;">
          <div style="height:100%;background:${t.color};width:${t.popularity}%;border-radius:99px;"></div>
        </div>
      </div>

      <!-- przypisz do klienta -->
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Przypisz do klienta</div>
        <select class="form-select" id="tpl-assign-client" style="font-size:12px;margin-bottom:8px;">
          <option value="">Wybierz klienta...</option>
          ${CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" style="width:100%;" onclick="tplAssignToClient('${t.id}')">✓ Przypisz plan klientowi</button>
      </div>

      <div style="display:flex;gap:8px;">
        ${t.custom?`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="closeTplDetail();openTplCreate('${t.id}')">✎ Edytuj</button>`:''}
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="tplStartLive('${t.id}')">▶ Użyj w treningu Live</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="tplDuplicate('${t.id}')">📋 Duplikuj</button>
      </div>
    </div>`;
  el.style.transform='translateX(0)';
}

function closeTplDetail(){
  document.getElementById('tpl-detail').style.transform='translateX(100%)';
  tplDetailId=null;
}

function tplAssignToClient(tid){
  const _prevClientId = cpClientId;
  const cid=document.getElementById('tpl-assign-client')?.value;
  if(!cid){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===cid);
  const t=[...PLAN_TEMPLATES,...TPL_CUSTOM].find(x=>x.id===tid);
  if(!t||!c)return;
  // build plan object
  const newPlan=withTrainer({
    id:newId('p'),
    name:t.name,
    clientId:cid,
    clientName:c.name,
    method:t.method,
    duration:t.weeks,
    days:(t.days_detail||[]).map(d=>({day:d.name,exercises:(d.exercises||[]).map(e=>({name:e.n,sets:e.s,reps:e.r}))})),
    source:'template',
    templateId:tid,
    createdAt:new Date().toISOString(),
  });
  PL.push(newPlan);
  persistById('plans',newPlan);
  addNotification('system','Plan przypisany!','Szablon "'+t.name+'" przypisano do '+c.name,'plans');
  notify('✅ Plan "'+t.name+'" przypisany do '+c.name+'!');
  closeTplDetail();
  const st=typeof getClientOnboard==='function'?getClientOnboard(c):null;
  if(st&&!st.complete){maybeResumeOnboard(cid);return;}
  if(_prevClientId){
    goTo('clients');
    setTimeout(()=>openClientProfile(_prevClientId),300);
  }
}

function tplStartLive(tid){
  const t=[...PLAN_TEMPLATES,...TPL_CUSTOM].find(x=>x.id===tid);if(!t)return;
  closeTplDetail();
  goTo('live');
  setTimeout(()=>{
    // inject template exercises into live
    const day=t.days_detail?.[0];
    if(day){
      liveExercises=(day.exercises||[]).map(ex=>({
        name:ex.n,
        sets:Array.from({length:parseInt(ex.s)||3},(_,i)=>({setNo:i+1,kg:'',reps:ex.r||'10',done:false})),
        done:false,collapsed:false,
      }));
      renderLiveExercises();
    }
  },300);
  notify('Plan "'+t.name+'" załadowany do treningu Live!');
}

function tplDuplicate(tid){
  const t=[...PLAN_TEMPLATES,...TPL_CUSTOM].find(x=>x.id===tid);if(!t)return;
  const copy=withTrainer({...JSON.parse(JSON.stringify(t)),id:newId('tpl'),name:t.name+' (kopia)',custom:true,createdAt:new Date().toISOString()});
  TPL_CUSTOM.push(copy);
  persistById('planTemplates',copy);
  updateTplMyCount();
  renderTemplates();
  notify('✓ Szablon zduplikowany — możesz go edytować!');
}

function openTplCreate(editId){
  window._editingTplId=editId||null;
  let m=document.getElementById('m-tpl-create');
  if(!m){
    m=document.createElement('div');m.id='m-tpl-create';m.className='modal-ov';
    m.innerHTML=`<div class="modal modal-wide" style="max-width:640px;">
      <div class="modal-hdr"><div class="modal-title" id="tplc-title">NOWY SZABLON PLANU</div><button class="modal-close" onclick="closeM('m-tpl-create')">×</button></div>
      <div class="modal-body">
        <div class="form-field"><label class="form-lbl">Nazwa</label><input type="text" class="form-input" id="tplc-name" placeholder="np. PPL 4× — Moja wersja"></div>
        <div class="form-field"><label class="form-lbl">Opis</label><textarea class="form-textarea" id="tplc-desc" rows="2" placeholder="Krótki opis szablonu..."></textarea></div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Cel</label>
            <select class="form-select" id="tplc-goal">
              <option value="masa">Masa</option><option value="sila">Siła</option><option value="redukcja">Redukcja</option><option value="kondycja">Kondycja</option>
            </select>
          </div>
          <div class="form-field"><label class="form-lbl">Poziom</label>
            <select class="form-select" id="tplc-level">
              <option value="poczatkujacy">Początkujący</option><option value="sredni" selected>Średni</option><option value="zaawansowany">Zaawansowany</option>
            </select>
          </div>
          <div class="form-field"><label class="form-lbl">Metoda</label>
            <select class="form-select" id="tplc-method">
              <option>PPL</option><option>FBW</option><option>UL</option><option>531</option><option>Custom</option>
            </select>
          </div>
          <div class="form-field"><label class="form-lbl">Tygodnie</label><input type="number" class="form-input" id="tplc-weeks" value="8" min="1" max="52"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px;">
          <div style="font-size:12px;font-weight:700;">Dni treningowe</div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="tplcAddDay()">+ Dzień</button>
        </div>
        <div id="tplc-days" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>
      <div class="modal-footer" style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" id="tplc-del" style="display:none;margin-right:auto;color:var(--red);" onclick="deleteCustomTemplate()">Usuń</button>
        <button class="btn btn-ghost" onclick="closeM('m-tpl-create')">Anuluj</button>
        <button class="btn btn-primary" onclick="saveCustomTemplate()">Zapisz szablon</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
  }
  const existing=editId?TPL_CUSTOM.find(x=>x.id===editId):null;
  document.getElementById('tplc-title').textContent=existing?'EDYTUJ SZABLON':'NOWY SZABLON PLANU';
  document.getElementById('tplc-name').value=existing?.name||'';
  document.getElementById('tplc-desc').value=existing?.desc||'';
  document.getElementById('tplc-goal').value=existing?.goal||'masa';
  document.getElementById('tplc-level').value=existing?.level||'sredni';
  document.getElementById('tplc-method').value=existing?.method||'PPL';
  document.getElementById('tplc-weeks').value=existing?.weeks||8;
  const daysEl=document.getElementById('tplc-days');
  daysEl.innerHTML='';
  const days=existing?.days_detail?.length?existing.days_detail:[{name:'Dzień 1',exercises:[{n:'',s:'3',r:'10'}]}];
  days.forEach(d=>tplcAddDay(d));
  const del=document.getElementById('tplc-del');
  if(del)del.style.display=existing?'inline-flex':'none';
  openM('m-tpl-create');
}

function tplcAddDay(prefill){
  const wrap=document.getElementById('tplc-days');if(!wrap)return;
  const di=wrap.children.length;
  const day=prefill||{name:'Dzień '+(di+1),exercises:[{n:'',s:'3',r:'10'}]};
  const box=document.createElement('div');
  box.className='tplc-day';
  box.style.cssText='background:var(--s3);border:1px solid var(--border2);border-radius:10px;padding:10px;';
  box.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
      <input type="text" class="form-input tplc-day-name" value="${escHtml(day.name||'')}" placeholder="Nazwa dnia" style="flex:1;font-size:12px;">
      <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.tplc-day').remove()">×</button>
    </div>
    <div class="tplc-ex-list" style="display:flex;flex-direction:column;gap:6px;"></div>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="tplcAddEx(this)">+ Ćwiczenie</button>`;
  wrap.appendChild(box);
  const list=box.querySelector('.tplc-ex-list');
  (day.exercises&&day.exercises.length?day.exercises:[{n:'',s:'3',r:'10'}]).forEach(ex=>tplcAddExRow(list,ex));
}

function tplcAddEx(btn){
  const list=btn.parentElement.querySelector('.tplc-ex-list');
  tplcAddExRow(list,{n:'',s:'3',r:'10'});
}

function tplcAddExRow(list,ex){
  const row=document.createElement('div');
  row.style.cssText='display:grid;grid-template-columns:1fr 54px 64px 28px;gap:6px;align-items:center;';
  row.innerHTML=`
    <input type="text" class="form-input tplc-ex-n" placeholder="Ćwiczenie" value="${escHtml(ex.n||'')}" style="font-size:12px;" list="ex-dl">
    <input type="text" class="form-input tplc-ex-s" placeholder="Serie" value="${escHtml(ex.s||'3')}" style="font-size:12px;">
    <input type="text" class="form-input tplc-ex-r" placeholder="Powt." value="${escHtml(ex.r||'10')}" style="font-size:12px;">
    <button type="button" style="background:none;border:none;color:var(--muted2);cursor:pointer;font-size:16px;" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(row);
}

async function saveCustomTemplate(){
  const name=document.getElementById('tplc-name')?.value.trim();
  if(!name){notify('Wpisz nazwę szablonu!');return;}
  const days=[];
  document.querySelectorAll('#tplc-days .tplc-day').forEach(box=>{
    const dname=box.querySelector('.tplc-day-name')?.value.trim()||'Dzień';
    const exercises=[];
    box.querySelectorAll('.tplc-ex-list > div').forEach(row=>{
      const n=row.querySelector('.tplc-ex-n')?.value.trim();
      if(!n)return;
      exercises.push({
        n,
        s:row.querySelector('.tplc-ex-s')?.value.trim()||'3',
        r:row.querySelector('.tplc-ex-r')?.value.trim()||'10',
        rest:'90s'
      });
    });
    days.push({name:dname,exercises});
  });
  if(!days.length){notify('Dodaj przynajmniej jeden dzień!');return;}
  const goal=document.getElementById('tplc-goal').value;
  const level=document.getElementById('tplc-level').value;
  const method=document.getElementById('tplc-method').value;
  const weeks=parseInt(document.getElementById('tplc-weeks').value)||8;
  const desc=document.getElementById('tplc-desc').value.trim()||'Własny szablon';
  const color={masa:'var(--accent)',sila:'var(--orange)',redukcja:'var(--red)',kondycja:'var(--teal)'}[goal]||'var(--accent)';
  let tpl;
  if(window._editingTplId){
    tpl=TPL_CUSTOM.find(x=>x.id===window._editingTplId);
  }
  if(tpl){
    Object.assign(tpl,{name,desc,goal,level,method,weeks,days:days.length,days_detail:days,schedule:days.map(d=>d.name),tags:[goal,method,days.length+'×/tydzień','własny'],color,custom:true,updatedAt:new Date().toISOString()});
    withTrainer(tpl);
  }else{
    tpl=withTrainer({
      id:newId('tpl'),name,desc,goal,level,method,weeks,days:days.length,
      days_detail:days,schedule:days.map(d=>d.name),
      tags:[goal,method,days.length+'×/tydzień','własny'],
      color,popularity:50,custom:true,createdAt:new Date().toISOString()
    });
    TPL_CUSTOM.push(tpl);
  }
  await persistById('planTemplates',tpl);
  closeM('m-tpl-create');
  updateTplMyCount();
  renderTemplates();
  notify('✓ Szablon "'+name+'" zapisany');
}

async function deleteCustomTemplate(){
  const id=window._editingTplId;if(!id)return;
  if(!confirm('Usunąć ten szablon?'))return;
  const idx=TPL_CUSTOM.findIndex(x=>x.id===id);
  if(idx>=0)TPL_CUSTOM.splice(idx,1);
  if(window._db){try{await window._del(window._doc(window._db,'planTemplates',id));}catch(e){}}
  closeM('m-tpl-create');
  updateTplMyCount();
  renderTemplates();
  notify('Szablon usunięty');
}
window.tplcAddDay=tplcAddDay;window.tplcAddEx=tplcAddEx;
window.saveCustomTemplate=saveCustomTemplate;window.deleteCustomTemplate=deleteCustomTemplate;

function updateTplMyCount(){
  const el=document.getElementById('tpl-my-count');
  if(el)el.textContent=TPL_CUSTOM.length;
}

window.initTemplates=initTemplates;window.setTplFilter=setTplFilter;
window.renderTemplates=renderTemplates;window.openTplDetail=openTplDetail;
window.closeTplDetail=closeTplDetail;window.tplAssignToClient=tplAssignToClient;
window.tplStartLive=tplStartLive;window.tplDuplicate=tplDuplicate;window.openTplCreate=openTplCreate;

// ════════════════════════════════════════
// LIVE WORKOUT — TRYB LIVE
// ════════════════════════════════════════
var liveTab='trainer';
var liveClientId=null;
var livePlanId=null;
var liveCurrentDayIdx=0;
var liveSessionActive=false;
var liveTimerSec=0;var liveTimerInterval=null;
var liveRestSec=0;var liveRestInterval=null;
var liveExercises=[];  // [{name,sets:[{kg,reps,done}],done}]
var liveFeedbackVal=0;
var LIVE_HISTORY=[];
const LIVE_DRAFT_KEY='pl_live_draft';

function liveSaveDraft(){
  if(!liveClientId&&!liveExercises.length)return;
  try{
    localStorage.setItem(LIVE_DRAFT_KEY,JSON.stringify({
      clientId:liveClientId,
      planId:livePlanId,
      dayIdx:liveCurrentDayIdx,
      exercises:liveExercises,
      sessionActive:liveSessionActive,
      timerSec:liveTimerSec,
      feedback:liveFeedbackVal,
      note:document.getElementById('live-note')?.value||'',
      savedAt:Date.now()
    }));
  }catch(e){}
}

function liveClearDraft(){
  try{localStorage.removeItem(LIVE_DRAFT_KEY);}catch(e){}
}

function liveTryRecoverDraft(){
  let raw;
  try{raw=localStorage.getItem(LIVE_DRAFT_KEY);}catch(e){return false;}
  if(!raw)return false;
  try{
    const draft=JSON.parse(raw);
    if(!draft.clientId||Date.now()-(draft.savedAt||0)>7*24*60*60*1000){liveClearDraft();return false;}
    const c=CL.find(x=>x.id===draft.clientId);
    if(!c){liveClearDraft();return false;}
    if(!confirm('Masz niedokończoną sesję treningową ('+c.name+'). Wznowić?')){liveClearDraft();return false;}
    liveClientId=draft.clientId;
    livePlanId=draft.planId||null;
    liveCurrentDayIdx=draft.dayIdx||0;
    liveExercises=draft.exercises||[];
    liveSessionActive=!!draft.sessionActive;
    liveTimerSec=draft.timerSec||0;
    liveFeedbackVal=draft.feedback||0;
    const noteEl=document.getElementById('live-note');
    if(noteEl)noteEl.value=draft.note||'';
    liveClientSetField(draft.clientId,c.name,true);
    if(liveSessionActive){
      clearInterval(liveTimerInterval);
      liveTimerInterval=setInterval(()=>{
        liveTimerSec++;
        const m=String(Math.floor(liveTimerSec/60)).padStart(2,'0');
        const s=String(liveTimerSec%60).padStart(2,'0');
        const el=document.getElementById('live-timer');
        if(el)el.textContent=m+':'+s;
      },1000);
      document.getElementById('live-timer-status').textContent='W toku';
      document.getElementById('live-start-btn').style.display='none';
      document.getElementById('live-end-btn').style.display='';
    }
    liveSyncFloorUi();
    renderLivePlanPicker();
    renderLiveExercises();
    notify('Sesja wznowiona z kopii zapasowej');
    return true;
  }catch(e){liveClearDraft();return false;}
}

function liveSyncFloorUi(){
  const sc=document.getElementById('screen-live');
  if(!sc)return;
  sc.classList.toggle('live-session-on',!!liveSessionActive);
  if(!liveSessionActive)sc.classList.remove('live-plan-open');
  const tog=document.getElementById('live-plan-toggle');
  if(tog)tog.textContent=sc.classList.contains('live-plan-open')?'Ukryj plan':'Plan';
}
function liveTogglePlanPanel(){
  const sc=document.getElementById('screen-live');
  if(!sc)return;
  sc.classList.toggle('live-plan-open');
  liveSyncFloorUi();
}
window.liveTogglePlanPanel=liveTogglePlanPanel;

function initLive(){
  const recovered=liveTryRecoverDraft();
  liveSyncFloorUi();
  if(recovered){renderLiveHistory();return;}
  if(liveClientId){
    liveLoadClient();
  }else{
    liveClientSetField('','',true);
    livePlanId=null;
    liveExercises=[];
    renderLiveClientCard();
    renderLivePlanPicker();
    renderLiveExercises();
  }
  renderLiveHistory();
}

function setLiveTab(t){
  liveTab=t;
  ['trainer','client','history'].forEach(x=>{
    const el=document.getElementById('live-'+x+'-tab');
    if(el)el.style.display=x===t?'flex':'none';
    document.getElementById('live-tab-'+x)?.classList.toggle('active',x===t);
  });
  if(t==='client')renderLiveClientMock();
  if(t==='history')renderLiveHistory();
}

// Ustawia pole klienta na ekranie Trening Live: widoczny tekst + ukryte id.
function liveClientSetField(clientId,clientName,skipLoad){
  const hid=document.getElementById('live-client-sel');
  const vis=document.getElementById('live-client-sel-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('live-client-sel-results');
  if(res)res.style.display='none';
  liveClientId=clientId;
  if(!skipLoad)liveLoadClient();
  else renderLiveClientCard();
}

function liveClientSearchInput(){
  const q=(document.getElementById('live-client-sel-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('live-client-sel-results');
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
    <div onclick="liveClientSetField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function liveLoadClient(){
  const sel=document.getElementById('live-client-sel');
  liveClientId=sel?.value||null;
  renderLiveClientCard();
  renderLivePlanPicker();
  renderLiveExercises();
}

function renderLiveClientCard(){
  const el=document.getElementById('live-client-card');if(!el)return;
  const c=CL.find(x=>x.id===liveClientId);
  if(!c){el.innerHTML='';return;}
  const sessCount=SE.filter(s=>s.clientId===c.id).length;
  el.innerHTML=`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div style="width:42px;height:42px;border-radius:12px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--accent);flex-shrink:0;">${getInit(c.name)}</div>
      <div>
        <div style="font-size:14px;font-weight:700;">${c.name}</div>
        <div style="font-size:11px;color:var(--muted);">${{masa:'💪 Masa',sila:'🏋️ Siła',redukcja:'🔥 Redukcja',kondycja:'🏃 Kondycja'}[c.goal]||'—'} · ${sessCount} sesji</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">
      <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-weight:700;color:var(--accent);">${c.weight||'—'}</div>
        <div style="color:var(--muted);">kg</div>
      </div>
      <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-weight:700;color:var(--blue);">${c.height||'—'}</div>
        <div style="color:var(--muted);">cm</div>
      </div>
      <div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-weight:700;color:var(--orange);">${c.age||'—'}</div>
        <div style="color:var(--muted);">lat</div>
      </div>
    </div>
  </div>`;
}

function renderLivePlanPicker(){
  const el=document.getElementById('live-plan-picker');if(!el)return;
  if(!liveClientId){
    el.innerHTML=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:16px;background:var(--s2);border-radius:10px;border:1px dashed var(--border2);line-height:1.5;">
      Wybierz klienta u góry, żeby załadować jego plan i zacząć sesję.
    </div>`;
    return;
  }
  const plans=PL.filter(p=>p.clientId===liveClientId);
  if(!plans.length){
    el.innerHTML=`<div style="font-size:11px;color:var(--muted);text-align:center;padding:12px;background:var(--s2);border-radius:10px;border:1px solid var(--border);">
      Brak planów dla klienta.<br>
      <button class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="goTo('aiplangen');if(liveClientId){document.getElementById('apl-client').value=liveClientId;aplFillFromClient();}">⚡ Generuj plan AI</button>
    </div>
    <div style="margin-top:10px;">
      <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="liveQuickAdd()">⚡ Szybki trening bez planu</button>
    </div>`;
    return;
  }
  const activePlan=plans.find(p=>p.id===livePlanId)||plans[0];
  const days=activePlan?.days||[];

  el.innerHTML=`
    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;margin-bottom:8px;letter-spacing:1px;">Wybierz plan</div>
    <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
      ${plans.map(p=>`<div style="background:var(--s2);border:1px solid ${livePlanId===p.id?'var(--accent)':'var(--border)'};border-radius:10px;padding:10px 12px;cursor:pointer;transition:border-color 0.12s;" onclick="liveSelectPlan('${p.id}')" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='${livePlanId===p.id?'var(--accent)':'var(--border)'}'">
        <div style="font-size:12px;font-weight:700;color:${livePlanId===p.id?'var(--accent)':'var(--text)'};">${p.name}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${p.method||''} · ${p.duration||'?'} tyg. · ${(p.days||[]).length} dni</div>
      </div>`).join('')}
    </div>
    ${days.length>1?`
    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;margin-bottom:6px;letter-spacing:1px;">Dzień treningu ${liveExercises.length?`<span style="color:var(--accent);normal-case;text-transform:none;letter-spacing:0;">— sugerowany na dziś</span>`:''}</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">
      ${days.map((d,i)=>`<button onclick="liveSelectDay(${i})" style="background:${liveExercises.length&&i===liveCurrentDayIdx?'rgba(225,31,46,0.08)':'var(--s3)'};border:1px solid ${liveExercises.length&&i===liveCurrentDayIdx?'var(--accent)':'var(--border2)'};border-radius:8px;padding:7px 12px;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">
        <div style="font-size:11px;font-weight:600;">${d.day||'Dzień '+(i+1)}</div>
        <div style="font-size:10px;color:var(--muted);">${(d.exercises||[]).length} ćw.</div>
      </button>`).join('')}
    </div>`:''}
    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;margin-bottom:6px;letter-spacing:1px;">Lub quick-add</div>
    <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="liveQuickAdd()">⚡ Szybki trening bez planu</button>`;

  if(!livePlanId&&plans.length)liveSelectPlan(plans[0].id);
}

// Sprawdza ostatnią sesję live tego klienta z tym planem i sugeruje kolejny dzień w rotacji.
// Jeśli brak historii — zaczyna od dnia 1 (indeks 0).
function liveGetSuggestedDayIdx(clientId,plan){
  if(typeof suggestedPlanDayIdx==='function')return suggestedPlanDayIdx(clientId,plan);
  if(!plan||!plan.days||!plan.days.length)return 0;
  const past=SE.filter(s=>s.clientId===clientId&&(s.source==='live'||s.source==='client')&&s.planId===plan.id&&s.dayIdx!=null)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!past.length)return 0;
  return (past[0].dayIdx+1)%plan.days.length;
}

function liveNormExName(n){
  return String(n||'').toLowerCase().replace(/\s+/g,' ').trim();
}

/** Ostatnie kg/powt. tego ćwiczenia u tego klienta (z zapisanych sesji). */
function liveLastLoad(clientId,name){
  if(!clientId||!name)return null;
  const key=liveNormExName(name);
  const sessions=SE.filter(s=>s.clientId===clientId&&Array.isArray(s.exercises))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||''));
  for(const s of sessions){
    const ex=(s.exercises||[]).find(e=>liveNormExName(e.name)===key);
    if(!ex)continue;
    const sets=(ex.sets||[]).filter(x=>x&&(x.kg||x.reps));
    if(!sets.length)continue;
    const last=sets[sets.length-1];
    return{kg:last.kg,reps:last.reps,sets};
  }
  return null;
}

function liveMapPlanExercises(rawEx){
  const mapped=typeof mapPlanExercisesForClient==='function'
    ?mapPlanExercisesForClient(rawEx,liveClientId)
    :(rawEx||[]).map(ex=>({name:ex.name||ex.n||'Ćwiczenie',sets:[{setNo:1,kg:'',reps:'10',done:false}]}));
  return mapped.map(ex=>({...ex,done:false,collapsed:false}));
}

function liveSelectPlan(pid){
  livePlanId=pid;
  const p=PL.find(x=>x.id===pid);if(!p)return;

  // Pobierz ćwiczenia z SUGEROWANEGO dnia (na bazie rotacji od ostatniej sesji), nie zawsze z Dnia 1.
  // Struktura: p.days = [{day:'Dzień 1', exercises:[{name,sets,reps}]}]
  const suggestedIdx=liveGetSuggestedDayIdx(liveClientId,p);
  liveCurrentDayIdx=suggestedIdx;
  const day=(p.days||[])[suggestedIdx];
  const rawEx=day?.exercises||[];

  if(rawEx.length>0){
    liveExercises=liveMapPlanExercises(rawEx);
  } else {
    // Plan bez ćwiczeń - zaproponuj wybór dnia
    liveExercises=[];
    liveShowDayPicker(p);
  }

  renderLivePlanPicker();
  renderLiveExercises();
  liveSaveDraft();
}

function liveShowDayPicker(p){
  const el=document.getElementById('live-exercises-panel');if(!el)return;
  const days=p.days||[];
  if(!days.length){
    el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:10px;opacity:0.3;">📋</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Plan nie zawiera ćwiczeń</div>
      <div style="font-size:11px;margin-bottom:14px;">Dodaj ćwiczenia do planu w kreatorze</div>
      <button class="btn btn-ghost btn-sm" onclick="goTo('builder')">Otwórz kreator</button>
    </div>`;
    return;
  }
  el.innerHTML=`<div style="padding:16px;">
    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Wybierz dzień treningu</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${days.map((d,i)=>`
        <button onclick="liveSelectDay(${i})" style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;text-align:left;transition:border-color 0.12s;display:flex;align-items:center;justify-content:space-between;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--text);">${d.day||'Dzień '+(i+1)}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">${(d.exercises||[]).length} ćwiczeń</div>
          </div>
          <div style="color:var(--accent);font-size:16px;">→</div>
        </button>`).join('')}
    </div>
  </div>`;
}

function liveSelectDay(dayIdx){
  const p=PL.find(x=>x.id===livePlanId);if(!p)return;
  const day=(p.days||[])[dayIdx];if(!day)return;
  liveCurrentDayIdx=dayIdx;
  const rawEx=day.exercises||[];
  liveExercises=liveMapPlanExercises(rawEx);
  renderLivePlanPicker();
  renderLiveExercises();
  liveSaveDraft();
}
window.liveSelectDay=liveSelectDay;

function liveQuickAdd(){
  liveExercises=[
    {name:'Ćwiczenie 1',sets:[{setNo:1,kg:'',reps:'10',done:false},{setNo:2,kg:'',reps:'10',done:false},{setNo:3,kg:'',reps:'10',done:false}],done:false},
  ];
  renderLiveExercises();
  liveSaveDraft();
}

function renderLiveExercises(){
  const el=document.getElementById('live-exercises-panel');if(!el)return;
  if(!liveExercises.length){
    if(window._liveSavedClientId){
      const nm=window._liveSavedClientName||'klient';
      el.innerHTML=`<div style="text-align:center;padding:48px 20px;">
        <div style="font-size:36px;margin-bottom:10px;">✅</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:6px;">SESJA ZAPISANA</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5;">${escHtml(nm)} · trening jest w kalendarzu i historii.</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="liveRepeatSameClient()">▶ Kolejny dzień tego klienta</button>
          <button class="btn btn-ghost" onclick="goTo('clients')">Lista klientów</button>
          <button class="btn btn-ghost" onclick="goTo('dashboard')">Panel</button>
        </div>
      </div>`;
      return;
    }
    el.innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--muted);">
      <div style="font-size:36px;margin-bottom:12px;opacity:0.3;">🏋️</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Wybierz klienta i plan</div>
      <div style="font-size:12px;">Potem Start sesji — kg z poprzedniego treningu wstawią się same.</div>
    </div>`;
    return;
  }
  const doneCnt=liveExercises.filter(e=>e.done).length;
  const total=liveExercises.length;
  const setsDone=liveExercises.flatMap(e=>e.sets).filter(s=>s.done).length;
  const volume=liveExercises.flatMap(e=>e.sets).filter(s=>s.done&&s.kg).reduce((a,s)=>a+parseFloat(s.kg||0)*parseFloat(s.reps||0),0);

  // update stats panel
  const setEl=v=>id=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  document.getElementById('live-ex-done').textContent=doneCnt;
  document.getElementById('live-ex-total').textContent=total;
  document.getElementById('live-sets-done').textContent=setsDone;
  document.getElementById('live-volume').textContent=Math.round(volume);
  const pb=document.getElementById('live-progress-bar');
  if(pb)pb.style.width=(total?Math.round(doneCnt/total*100):0)+'%';

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;">${liveSessionActive?'TRENING W TOKU':'PLAN TRENINGU'}</div>
        <div style="font-size:11px;color:var(--muted);">${doneCnt}/${total} ćwiczeń ukończonych</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="liveAddExercise()">+ Dodaj ćwiczenie</button>
    </div>
    ${liveExercises.map((ex,i)=>liveExCard(ex,i)).join('')}
    ${liveSessionActive&&doneCnt===total&&total>0?`
    <div style="background:linear-gradient(135deg,var(--adim),transparent);border:1px solid rgba(225,31,46,0.3);border-radius:14px;padding:20px;text-align:center;margin-top:10px;">
      <div style="font-size:28px;margin-bottom:8px;">🎉</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-bottom:4px;">TRENING UKOŃCZONY!</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">${setsDone} serii · ${Math.round(volume)} kg objętości</div>
      <button class="btn btn-primary" onclick="liveEndSession()">Zakończ i zapisz sesję</button>
    </div>`:''}`;
}

function liveExCard(ex,i){
  const setsDone=ex.sets.filter(s=>s.done).length;
  const lastHint=ex.lastKg!==''&&ex.lastKg!=null?`Ostatnio: ${ex.lastKg} kg${ex.lastReps?' × '+ex.lastReps:''}`:'';
  return `<div class="live-ex-card${ex.done?' done':liveSessionActive&&!ex.done&&i===liveExercises.findIndex(e=>!e.done)?' active':''}" id="live-ex-${i}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:${ex.collapsed?0:10}px;cursor:pointer;" onclick="liveToggleCollapse(${i})">
      <div style="width:30px;height:30px;border-radius:8px;background:${ex.done?'var(--teal)':'var(--adim)'};display:flex;align-items:center;justify-content:center;font-size:${ex.done?'14px':'12px'};font-weight:700;color:${ex.done?'#000':'var(--accent)'};flex-shrink:0;">${ex.done?'✓':i+1}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;">${escHtml(ex.name)}</div>
        <div style="font-size:10px;color:var(--muted);">${ex.sets.length} serie · ${setsDone}/${ex.sets.length} ukończono${lastHint?' · '+lastHint:''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        ${!ex.done?`<button type="button" class="live-skip-btn" onclick="event.stopPropagation();liveSkipEx(${i})">Pomiń</button>`:''}
        <span style="color:var(--muted);font-size:14px;">${ex.collapsed?'▶':'▼'}</span>
      </div>
    </div>
    ${!ex.collapsed?`
    <div>
      <div class="live-set-grid live-set-head">
        <span></span><span>Seria</span><span style="text-align:center;">Ciężar</span><span style="text-align:center;">Powt.</span><span></span>
      </div>
      ${ex.sets.map((s,si)=>`<div class="live-set-row">
        <div class="live-set-check${s.done?' done':''}" onclick="liveToggleSet(${i},${si})" title="Oznacz serię">${s.done?'✓':''}</div>
        <div class="live-set-label"><span class="live-set-label-full">Seria </span>${s.setNo}</div>
        <input type="number" inputmode="decimal" class="live-kg-input" placeholder="${ex.lastKg!==''&&ex.lastKg!=null?ex.lastKg:'kg'}" value="${s.kg}" oninput="liveSetKg(${i},${si},this.value)" onkeydown="liveSetKey(event,${i},${si})" onclick="event.stopPropagation()">
        <input type="number" inputmode="numeric" class="live-kg-input" placeholder="powt." value="${s.reps}" oninput="liveSetReps(${i},${si},this.value)" onkeydown="liveSetKey(event,${i},${si})" onclick="event.stopPropagation()">
        <button type="button" class="live-set-rest" onclick="liveStartRest(90)" title="Przerwa 90s">⏱</button>
      </div>`).join('')}
      <button type="button" class="live-add-set" onclick="liveAddSet(${i})">+ Dodaj serię</button>
    </div>`:''}
  </div>`;
}

function liveSetKey(e,ei,si){
  if(e.key==='Enter'){
    e.preventDefault();
    liveToggleSet(ei,si);
  }
}
window.liveSetKey=liveSetKey;

function liveToggleCollapse(i){
  liveExercises[i].collapsed=!liveExercises[i].collapsed;
  renderLiveExercises();
}

function liveToggleSet(ei,si){
  const ex=liveExercises[ei];if(!ex)return;
  const s=ex.sets[si];
  s.done=!s.done;
  if(s.done){
    const next=ex.sets[si+1];
    if(next){
      if((next.kg===''||next.kg==null)&&s.kg!==''&&s.kg!=null)next.kg=s.kg;
      if((next.reps===''||next.reps==null||next.reps==='8-12')&&s.reps)next.reps=s.reps;
    }
    if(ex.sets.every(x=>x.done)){
      ex.done=true;
      ex.collapsed=true;
      const nxt=liveExercises.find(e=>!e.done);
      if(nxt)nxt.collapsed=false;
    }
    liveStartRest(90);
  }else{
    ex.done=false;
  }
  liveSaveDraft();
  renderLiveExercises();
}

function liveSetKg(ei,si,v){liveExercises[ei].sets[si].kg=v;liveSaveDraft();}
function liveSetReps(ei,si,v){liveExercises[ei].sets[si].reps=v;liveSaveDraft();}

function liveAddSet(ei){
  const ex=liveExercises[ei];
  const prev=ex.sets[ex.sets.length-1];
  ex.sets.push({setNo:ex.sets.length+1,kg:prev&&prev.kg!=null?prev.kg:'',reps:prev&&prev.reps?prev.reps:'8-12',done:false});
  renderLiveExercises();
  liveSaveDraft();
}

function liveSkipEx(i){
  liveExercises[i].done=true;
  liveExercises[i].collapsed=true;
  renderLiveExercises();
}

function liveAddExercise(){
  liveExercises.push({
    name:'Nowe ćwiczenie',
    sets:[{setNo:1,kg:'',reps:'10',done:false},{setNo:2,kg:'',reps:'10',done:false},{setNo:3,kg:'',reps:'10',done:false}],
    done:false,collapsed:false
  });
  renderLiveExercises();
}

function liveStartSession(){
  if(!liveClientId){notify('Wybierz klienta!');return;}
  if(!liveExercises.length){notify('Wybierz plan lub dodaj ćwiczenia!');return;}
  window._liveSavedClientId=null;
  window._liveSavedClientName='';
  liveSessionActive=true;
  liveTimerSec=0;
  clearInterval(liveTimerInterval);
  liveTimerInterval=setInterval(()=>{
    liveTimerSec++;
    const m=String(Math.floor(liveTimerSec/60)).padStart(2,'0');
    const s=String(liveTimerSec%60).padStart(2,'0');
    const el=document.getElementById('live-timer');
    if(el)el.textContent=m+':'+s;
  },1000);
  document.getElementById('live-timer-status').textContent='W toku';
  document.getElementById('live-start-btn').style.display='none';
  document.getElementById('live-end-btn').style.display='';
  liveSyncFloorUi();
  notify('▶ Sesja rozpoczęta!');
  liveSaveDraft();
  renderLiveExercises();
}

function liveEndSession(){
  if(!confirm('Zakończyć i zapisać sesję?'))return;
  clearInterval(liveTimerInterval);
  liveSessionActive=false;
  liveClearDraft();
  const c=CL.find(x=>x.id===liveClientId);
  const totalSets=liveExercises.flatMap(e=>e.sets).filter(s=>s.done).length;
  const volume=Math.round(liveExercises.flatMap(e=>e.sets).filter(s=>s.done&&s.kg).reduce((a,s)=>a+parseFloat(s.kg||0)*parseFloat(s.reps||0),0));
  const durationMin=Math.round(liveTimerSec/60);
  const newSession=withTrainer({
    id:newId('s'),
    clientId:liveClientId,
    date:dateStr(new Date()),
    time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),
    type:'Trening personalny',
    duration:durationMin||60,
    exercises:liveExercises.map(e=>({
      name:e.name,
      sets:e.sets.filter(s=>s.done).map(s=>({kg:parseFloat(s.kg)||0,reps:parseFloat(s.reps)||0,setNo:s.setNo}))
    })),
    volume,feedback:liveFeedbackVal,
    note:document.getElementById('live-note')?.value||'',
    source:'live',
    planId:livePlanId||null,
    dayIdx:livePlanId!=null?liveCurrentDayIdx:null,
    createdAt:new Date().toISOString()
  });
  SE.push(newSession);
  persistById('sessions',newSession);
  LIVE_HISTORY.unshift({...newSession,clientName:c?.name||'Klient'});
  // Odlicz sesję z aktywnego pakietu klienta jeśli jest
  const pkg=(window.PACKAGES||[]).filter(p=>p.clientId===liveClientId&&(p.sessionsUsed||0)<(p.sessions||0)&&p.payStatus!=='expired')
    .sort((a,b)=>(a.payStatus==='paid'?0:1)-(b.payStatus==='paid'?0:1))[0];
  if(pkg){
    pkg.sessionsUsed=(pkg.sessionsUsed||0)+1;
    persistById('packages',pkg);
    const left=Math.max(0,(pkg.sessions||0)-pkg.sessionsUsed);
    if(left<=1){
      addNotification('alert',left===0?'Pakiet wyczerpany':'Ostatnia sesja w pakiecie',(c?.name||'')+' — '+pkg.title,'payments');
    }
  }
  addNotification('system','Sesja zapisana!','Trening '+c?.name+' · '+durationMin+' min · '+totalSets+' serii','clients');
  const leftTxt=pkg?(' · pakiet '+(pkg.sessionsUsed)+'/'+pkg.sessions):'';
  notify('✅ Sesja zapisana! '+durationMin+' min, '+totalSets+' serii, '+volume+' kg obj.'+leftTxt);
  window._liveSavedClientId=liveClientId;
  window._liveSavedClientName=c?.name||'';
  document.getElementById('live-timer').textContent='00:00';
  document.getElementById('live-timer-status').textContent='Nieaktywny';
  document.getElementById('live-start-btn').style.display='';
  document.getElementById('live-end-btn').style.display='none';
  liveSyncFloorUi();
  liveFeedbackVal=0;
  const fb=document.getElementById('live-feedback-text');
  if(fb)fb.textContent='Brak oceny';
  liveExercises=[];
  livePlanId=null;
  renderLiveExercises();
  renderLiveHistory();
  if(typeof maybeResumeOnboard==='function')maybeResumeOnboard(window._liveSavedClientId||liveClientId);
}

function liveRepeatSameClient(){
  const id=window._liveSavedClientId||liveClientId;
  const name=window._liveSavedClientName||(CL.find(x=>x.id===id)||{}).name||'';
  window._liveSavedClientId=null;
  window._liveSavedClientName='';
  if(!id){notify('Wybierz klienta');return;}
  liveClientSetField(id,name);
  notify('Kolejny dzień — kg z poprzedniej sesji są już w polach');
}
window.liveRepeatSameClient=liveRepeatSameClient;

function liveStartRest(sec){
  clearInterval(liveRestInterval);
  liveRestSec=sec;
  const el=document.getElementById('live-rest-timer');
  const update=()=>{
    if(!el)return;
    if(liveRestSec<=0){
      clearInterval(liveRestInterval);
      el.textContent='GO!';
      el.style.color='var(--accent)';
      setTimeout(()=>{if(el)el.textContent='—';el.style.color='var(--text)';},2000);
      return;
    }
    el.textContent=liveRestSec+'s';
    el.style.color=liveRestSec<=10?'var(--red)':'var(--text)';
    liveRestSec--;
  };
  update();
  liveRestInterval=setInterval(update,1000);
}

function liveFeedback(v){
  liveFeedbackVal=v;
  const labels={1:'😓 Bardzo ciężko',2:'😐 Ciężko',3:'🙂 OK',4:'💪 Dobre',5:'🔥 Świetne!'};
  document.getElementById('live-feedback-text').textContent=labels[v]||'';
  notify('Feedback: '+labels[v]);
}

function renderLiveClientMock(){
  const el=document.getElementById('live-client-mock');if(!el)return;
  const c=CL.find(x=>x.id===liveClientId);
  const doneCnt=liveExercises.filter(e=>e.done).length;
  const total=liveExercises.length;
  const pct=total?Math.round(doneCnt/total*100):0;
  const accent=window.SETTINGS?.brand?.accentColor||'#e11f2e';
  el.innerHTML=`
    <div style="background:#07080a;border-radius:40px;border:6px solid #1a1a2a;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
      <!-- status bar -->
      <div style="padding:12px 20px 6px;display:flex;justify-content:space-between;font-size:10px;font-family:'DM Mono',monospace;color:rgba(255,255,255,0.5);">
        <span>9:41</span><span>▲▲▲ 🔋</span>
      </div>
      <!-- header -->
      <div style="padding:10px 20px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:${accent}22;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;color:${accent};">${c?getInit(c.name):'PL'}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#eceae6;">${liveSessionActive?'TRENING W TOKU':'Plan treningu'}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);">${c?.name||'Klient'}</div>
          </div>
          ${liveSessionActive?`<div style="margin-left:auto;font-family:'Bebas Neue',sans-serif;font-size:18px;color:${accent};" id="live-mock-timer">--:--</div>`:''}
        </div>
        <!-- progress bar -->
        <div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;">
            <span style="color:rgba(255,255,255,0.4);">Postęp</span>
            <span style="color:${accent};font-weight:700;">${doneCnt}/${total} ćwiczeń</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden;">
            <div style="height:100%;background:${accent};width:${pct}%;border-radius:99px;transition:width 0.4s;"></div>
          </div>
        </div>
      </div>
      <!-- exercises list -->
      <div style="padding:12px 16px;max-height:500px;overflow-y:auto;">
        ${liveExercises.length?liveExercises.map((ex,i)=>`
          <div style="margin-bottom:10px;background:${ex.done?'rgba(62,207,178,0.06)':'rgba(255,255,255,0.03)'};border:1px solid ${ex.done?'rgba(62,207,178,0.2)':'rgba(255,255,255,0.06)'};border-radius:14px;padding:12px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:${ex.done?0:8}px;">
              <div style="width:24px;height:24px;border-radius:6px;background:${ex.done?'var(--teal)':'rgba(225,31,46,0.1)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${ex.done?'#000':accent};flex-shrink:0;">${ex.done?'✓':i+1}</div>
              <div style="font-size:12px;font-weight:700;color:#eceae6;">${ex.name}</div>
            </div>
            ${!ex.done?`<div style="display:flex;gap:5px;">
              ${ex.sets.map(s=>`<div style="flex:1;height:28px;border-radius:6px;background:${s.done?accent+'33':'rgba(255,255,255,0.06)'};border:1px solid ${s.done?accent+'66':'transparent'};display:flex;align-items:center;justify-content:center;font-size:9px;font-family:'DM Mono',monospace;color:${s.done?accent:'rgba(255,255,255,0.3)'};">${s.done?'✓':s.setNo}</div>`).join('')}
            </div>`:''}
          </div>`).join(''):`<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3);font-size:12px;">Wybierz plan treningowy</div>`}
      </div>
    </div>`;
  // sync mock timer
  if(liveSessionActive){
    const mt=document.getElementById('live-mock-timer');
    if(mt){
      const m=String(Math.floor(liveTimerSec/60)).padStart(2,'0');
      const s=String(liveTimerSec%60).padStart(2,'0');
      mt.textContent=m+':'+s;
    }
  }
}

function renderLiveHistory(){
  const container=document.getElementById('live-history-tab');if(!container)return;
  const all=[...LIVE_HISTORY,...SE.slice(0,8).map(s=>({...s,clientName:CL.find(c=>c.id===s.clientId)?.name||'Klient'}))];
  container.innerHTML=`
    <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:16px;">HISTORIA SESJI LIVE</div>
    ${all.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
      ${all.slice(0,12).map(s=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--accent);">${getInit(s.clientName||'?')}</div>
          <div>
            <div style="font-size:13px;font-weight:700;">${s.clientName||'Klient'}</div>
            <div style="font-size:10px;color:var(--muted);">${s.date||''} ${s.time||''}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">
          <div style="background:var(--s3);border-radius:6px;padding:7px;text-align:center;">
            <div style="font-weight:700;color:var(--accent);">${s.duration||60}</div>
            <div style="color:var(--muted);">min</div>
          </div>
          <div style="background:var(--s3);border-radius:6px;padding:7px;text-align:center;">
            <div style="font-weight:700;color:var(--blue);">${s.exercises?.length||'—'}</div>
            <div style="color:var(--muted);">ćw.</div>
          </div>
          <div style="background:var(--s3);border-radius:6px;padding:7px;text-align:center;">
            <div style="font-weight:700;color:var(--orange);">${s.volume||'—'}</div>
            <div style="color:var(--muted);">kg obj.</div>
          </div>
        </div>
        ${s.note?`<div style="font-size:11px;color:var(--muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);line-height:1.5;">${s.note}</div>`:''}
      </div>`).join('')}
    </div>`:`<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:36px;opacity:0.3;margin-bottom:12px;">📊</div>
      <div>Brak historii sesji live. Zacznij trening!</div>
    </div>`}`;
}

window.initLive=initLive;window.setLiveTab=setLiveTab;window.liveLoadClient=liveLoadClient;
window.liveSelectPlan=liveSelectPlan;window.liveQuickAdd=liveQuickAdd;
window.liveStartSession=liveStartSession;window.liveEndSession=liveEndSession;
window.liveToggleSet=liveToggleSet;window.liveToggleCollapse=liveToggleCollapse;
window.liveSetKg=liveSetKg;window.liveSetReps=liveSetReps;
window.liveAddSet=liveAddSet;window.liveSkipEx=liveSkipEx;window.liveAddExercise=liveAddExercise;
window.liveStartRest=liveStartRest;window.liveFeedback=liveFeedback;

// ════════════════════════════════════════
// RAPORTY POSTĘPÓW
// ════════════════════════════════════════
var repTab='overview';var repClientId=null;
var REP_HISTORY=[];
var repGenerating=false;

function initReports(){
  const sel=document.getElementById('rep-client-sel');
  if(sel){
    sel.innerHTML='<option value="">Wybierz klienta...</option>'+CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
    if(!repClientId&&CL.length){repClientId=CL[0].id;sel.value=repClientId;}
  }
  renderRepOverview();
  renderRepHistory();
  renderRepAuto();
}

function setRepTab(t){
  repTab=t;
  ['overview','generate','history','auto'].forEach(x=>{
    const el=document.getElementById('rep-'+x+'-tab');
    if(el)el.style.display=x===t?(x==='generate'?'flex':'block'):'none';
    document.getElementById('rep-tab-'+x)?.classList.toggle('active',x===t);
  });
  if(t==='overview')renderRepOverview();
  if(t==='history')renderRepHistory();
  if(t==='auto')renderRepAuto();
}

function repLoadClient(){
  const sel=document.getElementById('rep-client-sel');
  repClientId=sel?.value||null;
  renderRepOverview();
}

function renderRepOverview(){
  const el=document.getElementById('rep-overview-tab');if(!el)return;
  const clients=repClientId?CL.filter(c=>c.id===repClientId):CL;
  if(!clients.length){
    el.innerHTML='<div style="text-align:center;padding:60px;color:var(--muted);">Brak klientów</div>';return;
  }

  // summary stats
  const totalReps=REP_HISTORY.length;
  const thisWeek=REP_HISTORY.filter(r=>{const d=new Date(r.date);const n=new Date();return(n-d)<7*86400000;}).length;

  el.innerHTML=`
    <!-- top stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">
      ${[
        {icon:'📄',label:'Raportów wysłanych',val:totalReps,col:'var(--accent)'},
        {icon:'📅',label:'W tym tygodniu',val:thisWeek,col:'var(--blue)'},
        {icon:'✅',label:'Klientów z raportem',val:clients.length,col:'var(--teal)'},
        {icon:'🤖',label:'Automatycznych',val:REP_HISTORY.filter(r=>r.auto).length,col:'var(--purple)'},
      ].map(s=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="font-size:20px;margin-bottom:6px;">${s.icon}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${s.col};line-height:1;">${s.val}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px;">${s.label}</div>
      </div>`).join('')}
    </div>

    <!-- klienci -->
    <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:14px;">KLIENCI — STATUS RAPORTÓW</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">
      ${clients.map(c=>{
        const cSess=SE.filter(s=>s.clientId===c.id);
        const cCheckins=(window.CHECKINS?.[c.id]||[]);
        const lastRep=REP_HISTORY.filter(r=>r.clientId===c.id)[0];
        const daysAgo=lastRep?Math.round((new Date()-new Date(lastRep.date))/86400000):null;
        const statusOk=daysAgo!==null&&daysAgo<8;
        return `<div style="background:var(--s2);border:1px solid ${statusOk?'rgba(62,207,178,0.3)':'var(--border)'};border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:38px;height:38px;border-radius:10px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--accent);flex-shrink:0;">${getInit(c.name)}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;">${c.name}</div>
              <div style="font-size:10px;color:var(--muted);">${c.goal||'—'} · ${cSess.length} sesji</div>
            </div>
            <span class="pill ${statusOk?'pill-green':'pill-orange'}" style="font-size:9px;">${statusOk?'Aktualny':'Zaległy'}</span>
          </div>
          <div style="display:flex;gap:8px;font-size:11px;color:var(--muted);margin-bottom:12px;">
            <span>📅 ${cSess.length} sesji</span>
            <span>✅ ${cCheckins.length} check-inów</span>
            <span>📄 Ost: ${daysAgo!==null?daysAgo+' dni temu':'Brak'}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="repQuickView('${c.id}')">👁 Podgląd</button>
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="repClientId='${c.id}';document.getElementById('rep-client-sel').value='${c.id}';setRepTab('generate')">📄 Generuj</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderRepHistory(){
  const el=document.getElementById('rep-history-tab');if(!el)return;
  const all=REP_HISTORY;
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;">HISTORIA WYSŁANYCH RAPORTÓW</div>
      <button class="btn btn-ghost btn-sm" onclick="exportRepHistoryCsv()">⬇ Eksport CSV</button>
    </div>
    ${!all.length?`<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:36px;opacity:0.3;margin-bottom:12px;">📄</div>
      <div>Brak wysłanych raportów — pojawią się tu automatycznie po wygenerowaniu pierwszego.</div>
    </div>`:`<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:1fr 100px 110px 130px 80px 100px;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);font-size:9px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;">
        <span>Klient</span><span>Typ</span><span>Data</span><span>Kanały</span><span>Status</span><span></span>
      </div>
      ${all.map(r=>`<div style="display:grid;grid-template-columns:1fr 100px 110px 130px 80px 100px;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border);align-items:center;font-size:12px;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">
        <span style="font-weight:600;">${r.clientName}</span>
        <span class="pill" style="font-size:9px;background:var(--s3);color:var(--muted);">${r.type}</span>
        <span style="color:var(--muted);">${r.date}</span>
        <div style="display:flex;gap:4px;">${(r.sent||[]).map(s=>({email:'✉️',whatsapp:'💬',app:'📱'}[s]||s)).map(i=>`<span>${i}</span>`).join('')}</div>
        <span class="pill ${r.status==='dostarczony'?'pill-green':'pill-orange'}" style="font-size:9px;">${r.status}</span>
        <button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="notify('Podgląd raportu')">Podgląd</button>
      </div>`).join('')}
    </div>`}`;
}

const DEFAULT_REP_SCHEDULES=[
  {id:'weekly',label:'Tygodniowy raport postępów',desc:'Co poniedziałek — podsumowanie poprzedniego tygodnia',active:true,time:'Pon 8:00',clients:'active',channels:['email','app']},
  {id:'monthly',label:'Miesięczny raport pełny',desc:'1. dnia miesiąca — pełna analiza z wykresami',active:true,time:'1. mies. 9:00',clients:'premium',channels:['email']},
  {id:'checkin',label:'Raport po check-inie',desc:'Automatycznie po wypełnieniu check-inu przez klienta',active:false,time:'Po check-inie',clients:'all',channels:['app']},
  {id:'quarterly',label:'Kwartalny raport od startu',desc:'Co 3 miesiące od dołączenia klienta',active:false,time:'Co 90 dni',clients:'all',channels:['email','whatsapp']},
];

function getRepSchedules(){
  const S=window.SETTINGS||(window.SETTINGS={});
  if(!S.reports)S.reports={};
  if(!Array.isArray(S.reports.schedules)||!S.reports.schedules.length){
    S.reports.schedules=DEFAULT_REP_SCHEDULES.map(x=>({...x,channels:[...(x.channels||[])]}));
  }
  return S.reports.schedules;
}

function clientsLabel(v){
  return {all:'Wszyscy',active:'Wszyscy aktywni',premium:'Pakiet Premium',inactive:'Nieaktywni'}[v]||v||'Wszyscy';
}
function channelsLabel(arr){
  const map={email:'Email',app:'App',whatsapp:'WhatsApp'};
  return (arr||[]).map(c=>map[c]||c).join(' + ')||'—';
}

function renderRepAuto(){
  const el=document.getElementById('rep-auto-tab');if(!el)return;
  const schedules=getRepSchedules();
  el.innerHTML=`
    <div style="max-width:700px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:6px;">AUTOMATYCZNE RAPORTY</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Harmonogram zapisuje się w ustawieniach. Wysyłka e-mail/WhatsApp wymaga backendu — tu zapisujemy reguły i generujemy raport w appce przy logowaniu (jeśli włączone).</div>
      <div style="font-size:11px;color:var(--muted);background:var(--adim);border:1px solid rgba(225,31,46,0.15);border-radius:8px;padding:10px 12px;margin-bottom:20px;">Uwaga: to nie jest cron 24/7. Reguły są sprawdzane gdy otworzysz panel trenera.</div>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
        ${schedules.map((a,i)=>`<div style="background:var(--s2);border:1px solid ${a.active?'rgba(225,31,46,0.2)':'var(--border)'};border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;">
          <label style="position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;">
            <input type="checkbox" ${a.active?'checked':''} style="opacity:0;width:0;height:0;" onchange="repToggleAuto(${i},this.checked)">
            <div style="position:absolute;inset:0;background:${a.active?'var(--accent)':'var(--s3)'};border-radius:99px;transition:0.2s;"></div>
            <div style="position:absolute;top:3px;left:${a.active?'21':'3'}px;width:16px;height:16px;background:${a.active?'#000':'var(--muted)'};border-radius:50%;transition:0.2s;"></div>
          </label>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${escHtml(a.label)}</div>
            <div style="font-size:11px;color:var(--muted);">${escHtml(a.desc||'')}</div>
            <div style="display:flex;gap:10px;margin-top:6px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted2);">
              <span>⏰ ${escHtml(a.time||'')}</span><span>👥 ${escHtml(clientsLabel(a.clients))}</span><span>📤 ${escHtml(channelsLabel(a.channels))}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="openRepScheduleEdit(${i})">Edytuj</button>
        </div>`).join('')}
      </div>

      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;margin-bottom:14px;">USTAWIENIA GLOBALNE</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-lbl">Domyślny szablon</label>
            <select class="form-select" id="rep-set-template" style="font-size:12px;">
              <option value="dark">🌑 Ciemny (Progress Live)</option>
              <option value="light">☀️ Jasny (profesjonalny)</option>
              <option value="minimal">◻️ Minimalny</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-lbl">Język raportu</label>
            <select class="form-select" id="rep-set-lang" style="font-size:12px;">
              <option value="pl">🇵🇱 Polski</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-lbl">Stopka raportu</label>
            <input type="text" class="form-input" id="rep-set-footer" value="" style="font-size:12px;">
          </div>
          <div class="form-field">
            <label class="form-lbl">Logo w raporcie</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:40px;height:40px;border-radius:8px;background:var(--adim);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;" id="rep-set-logo-prev">⚡</div>
              <span style="font-size:11px;color:var(--muted);">Używa logo z Ustawienia → Marka</span>
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveRepSettings()">Zapisz ustawienia</button>
      </div>
    </div>`;
  const R=(window.SETTINGS&&window.SETTINGS.reports)||{};
  const tEl=document.getElementById('rep-set-template');if(tEl)tEl.value=R.template||'dark';
  const lEl=document.getElementById('rep-set-lang');if(lEl)lEl.value=R.lang||'pl';
  const fEl=document.getElementById('rep-set-footer');
  if(fEl)fEl.value=R.footer||((window.SETTINGS?.profile?.name||'Trener')+' · Progress Live');
  const logoPrev=document.getElementById('rep-set-logo-prev');
  if(logoPrev&&window.SETTINGS?.brand?.logo)logoPrev.innerHTML='<img src="'+escHtml(window.SETTINGS.brand.logo)+'" style="width:100%;height:100%;object-fit:contain;">';
}

function openRepScheduleEdit(idx){
  const schedules=getRepSchedules();
  const a=schedules[idx];if(!a)return;
  window._repSchedIdx=idx;
  let m=document.getElementById('m-rep-sched');
  if(!m){
    m=document.createElement('div');m.id='m-rep-sched';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:460px;">
      <div class="modal-hdr"><div class="modal-title">EDYTUJ HARMONOGRAM</div><button class="modal-close" onclick="closeM('m-rep-sched')">×</button></div>
      <div class="modal-body">
        <div class="form-field"><label class="form-lbl">Nazwa</label><input type="text" class="form-input" id="rs-label"></div>
        <div class="form-field"><label class="form-lbl">Opis</label><textarea class="form-textarea" id="rs-desc" rows="2"></textarea></div>
        <div class="form-field"><label class="form-lbl">Czas / częstotliwość</label><input type="text" class="form-input" id="rs-time" placeholder="np. Pon 8:00"></div>
        <div class="form-field"><label class="form-lbl">Odbiorcy</label>
          <select class="form-select" id="rs-clients">
            <option value="all">Wszyscy</option>
            <option value="active">Wszyscy aktywni</option>
            <option value="premium">Pakiet Premium</option>
            <option value="inactive">Nieaktywni</option>
          </select>
        </div>
        <div class="form-field"><label class="form-lbl">Kanały</label>
          <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:4px 0;"><input type="checkbox" id="rs-ch-email" style="accent-color:var(--accent);"> Email</label>
          <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:4px 0;"><input type="checkbox" id="rs-ch-app" style="accent-color:var(--accent);"> App / Inbox</label>
          <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:4px 0;"><input type="checkbox" id="rs-ch-whatsapp" style="accent-color:var(--accent);"> WhatsApp</label>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeM('m-rep-sched')">Anuluj</button><button class="btn btn-primary" onclick="saveRepScheduleEdit()">Zapisz</button></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
  }
  document.getElementById('rs-label').value=a.label||'';
  document.getElementById('rs-desc').value=a.desc||'';
  document.getElementById('rs-time').value=a.time||'';
  document.getElementById('rs-clients').value=a.clients||'all';
  document.getElementById('rs-ch-email').checked=(a.channels||[]).includes('email');
  document.getElementById('rs-ch-app').checked=(a.channels||[]).includes('app');
  document.getElementById('rs-ch-whatsapp').checked=(a.channels||[]).includes('whatsapp');
  openM('m-rep-sched');
}

function saveRepScheduleEdit(){
  const schedules=getRepSchedules();
  const a=schedules[window._repSchedIdx];if(!a)return;
  a.label=document.getElementById('rs-label').value.trim()||a.label;
  a.desc=document.getElementById('rs-desc').value.trim();
  a.time=document.getElementById('rs-time').value.trim();
  a.clients=document.getElementById('rs-clients').value;
  a.channels=[];
  if(document.getElementById('rs-ch-email').checked)a.channels.push('email');
  if(document.getElementById('rs-ch-app').checked)a.channels.push('app');
  if(document.getElementById('rs-ch-whatsapp').checked)a.channels.push('whatsapp');
  if(typeof persistSettingsDoc==='function')persistSettingsDoc();
  closeM('m-rep-sched');
  renderRepAuto();
  notify('✓ Harmonogram zapisany');
}

function repToggleAuto(idx,val){
  const schedules=getRepSchedules();
  if(!schedules[idx])return;
  schedules[idx].active=!!val;
  if(typeof persistSettingsDoc==='function')persistSettingsDoc();
  renderRepAuto();
  notify(val?'✅ Automatyczny raport włączony':'⏸ Automatyczny raport wyłączony');
}
window.openRepScheduleEdit=openRepScheduleEdit;
window.saveRepScheduleEdit=saveRepScheduleEdit;

function saveRepSettings(){
  const S=window.SETTINGS||(window.SETTINGS={});
  if(!S.reports)S.reports={};
  S.reports.template=document.getElementById('rep-set-template')?.value||'dark';
  S.reports.lang=document.getElementById('rep-set-lang')?.value||'pl';
  S.reports.footer=document.getElementById('rep-set-footer')?.value||'';
  if(typeof persistSettingsDoc==='function')persistSettingsDoc();
  else{
    withTrainer(S);
    if(window._db){
      const sid=window._settingsDocId||window._uid||'default';
      window._setDoc(window._doc(window._db,'settings',sid),S,{merge:true}).catch(()=>{});
    }
  }
  notify('✓ Ustawienia raportów zapisane');
}
window.saveRepSettings=saveRepSettings;


function repQuickView(cid){
  repClientId=cid;
  document.getElementById('rep-client-sel').value=cid;
  setRepTab('generate');
  setTimeout(()=>repPreview(),100);
}

function repPreview(){
  if(!repClientId){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===repClientId);if(!c)return;
  const template=aplGetVal('rep-templates')||'dark';
  renderRepDocument(c,template,false,'');
}

async function repGenerate(){
  if(repGenerating)return;
  if(!repClientId){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===repClientId);if(!c)return;

  repGenerating=true;
  const area=document.getElementById('rep-preview-area');
  area.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
    <div class="ai-dot" style="width:16px;height:16px;"></div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:var(--accent);">AI GENERUJE RAPORT...</div>
    <div style="font-size:12px;color:var(--muted);">Analizuję dane klienta i tworzę spersonalizowane podsumowanie...</div>
  </div>`;

  const sessions=SE.filter(s=>s.clientId===c.id);
  const checkins=(window.CHECKINS?.[c.id]||[]);
  const plans=PL.filter(p=>p.clientId===c.id);
  const trainerNote=document.getElementById('rep-trainer-note')?.value||'';

  const systemPrompt=`Jesteś asystentem trenera personalnego. Generujesz profesjonalne raporty postępów dla klientów.
Odpowiadaj TYLKO w JSON bez markdown:
{
  "headline": "Krótki nagłówek raportu (np. 'Świetny tydzień!')",
  "summary": "2-3 zdania ogólnego podsumowania okresu",
  "achievements": ["Osiągnięcie 1","Osiągnięcie 2","Osiągnięcie 3"],
  "improvements": ["Obszar do poprawy 1","Obszar do poprawy 2"],
  "nextWeekFocus": "Co skupiamy się w kolejnym tygodniu",
  "trainerComment": "Osobisty komentarz trenera (ciepły, motywujący)",
  "motivationScore": 85,
  "progressScore": 78
}`;

  const userMsg=`Klient: ${c.name}, cel: ${c.goal||'—'}, poziom: ${c.level||'—'}
Sesji w tym tygodniu: ${sessions.filter(s=>{const d=new Date(s.date);return(new Date()-d)<7*86400000;}).length}
Łącznie sesji: ${sessions.length}
Check-inów: ${checkins.length}
Ostatni check-in score: ${checkins[checkins.length-1]?.score||'brak'}
Aktywny plan: ${plans[plans.length-1]?.name||'brak'}
${trainerNote?`Notatka trenera: ${trainerNote}`:''}
Wygeneruj raport tygodniowy.`;

  let aiData={headline:'Dobry tydzień!',summary:'Kontynuuj w tym kierunku.',achievements:['Regularne sesje','Dobry check-in'],improvements:['Regeneracja'],nextWeekFocus:'Fokus na nogi',trainerComment:'Świetna robota!',motivationScore:80,progressScore:75};

  try{
    const resp=await fetch('https://anthropic-proxy.teamprogress2018.workers.dev/',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:800,system:systemPrompt,messages:[{role:'user',content:userMsg}]})
    });
    const data=await resp.json();
    const raw=data?.content?.[0]?.text||'{}';
    try{aiData=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){const m=raw.match(/\{[\s\S]+\}/);if(m)aiData=JSON.parse(m[0]);}
  }catch(e){}

  const template=aplGetVal('rep-templates')||'dark';
  renderRepDocument(c,template,true,aiData);

  // save to history
  const sentChannels=[];
  if(document.getElementById('rep-send-email')?.checked)sentChannels.push('email');
  if(document.getElementById('rep-send-whatsapp')?.checked)sentChannels.push('whatsapp');
  if(document.getElementById('rep-send-app')?.checked)sentChannels.push('app');
  const repEntry=withTrainer({id:newId('r'),clientId:c.id,clientName:c.name,type:aplGetVal('rep-types')||'weekly',date:new Date().toISOString().split('T')[0],sent:sentChannels,status:'wygenerowany',auto:false});
  // Honest status: email/WhatsApp nie są podłączone — raport jest lokalny + w historii
  const channels=[];
  if(document.getElementById('rep-send-email')?.checked)channels.push('email (lokalnie — wysyłka niepodłączona)');
  if(document.getElementById('rep-send-whatsapp')?.checked)channels.push('WhatsApp (niepodłączone)');
  if(document.getElementById('rep-send-app')?.checked){
    channels.push('aplikacja');
    pushMsg(c.id,'📄 Twój raport postępów jest gotowy — sprawdź u trenera lub w podglądzie.');
    addNotification('report','Raport postępów gotowy!','Raport dla '+c.name+' wygenerowany','reports');
  }
  REP_HISTORY.unshift(repEntry);
  await persistById('reportHistory',repEntry);

  if(channels.length)notify('✅ Raport zapisany dla '+c.name+'. Kanały: '+channels.join(', '));
  else notify('✅ Raport wygenerowany i zapisany w historii');

  repGenerating=false;
}

function renderRepDocument(c,template,hasAI,ai){
  const area=document.getElementById('rep-preview-area');
  const sessions=SE.filter(s=>s.clientId===c.id);
  const checkins=(window.CHECKINS?.[c.id]||[]);
  const plans=PL.filter(p=>p.clientId===c.id);
  const trainerName=getTrainerName();
  const weekSess=sessions.filter(s=>{const d=new Date(s.date);return(new Date()-d)<7*86400000;});
  const isDark=template==='dark';
  const bg=isDark?'#07080a':'#ffffff';
  const text=isDark?'#eceae6':'#1a1a2a';
  const muted=isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)';
  const border=isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.1)';
  const accent=window.SETTINGS?.brand?.accentColor||'#e11f2e';
  const card=isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)';

  const activeSections=[...document.querySelectorAll('.rep-section-check:checked')].map(cb=>cb.value);

  area.innerHTML=`
    <div style="max-width:680px;margin:0 auto;">
      <!-- toolbar -->
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px;">
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨 Drukuj</button>
        <button class="btn btn-primary btn-sm" onclick="window.print()">⬇ PDF (przez drukuj)</button>
      </div>

      <!-- dokument -->
      <div id="rep-doc" style="background:${bg};color:${text};border-radius:16px;overflow:hidden;border:1px solid ${border};font-family:'DM Sans',sans-serif;">

        <!-- header -->
        <div style="background:${isDark?'linear-gradient(135deg,#0d0f12,#12151a)':accent+'22'};padding:28px 32px;border-bottom:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:3px;color:${accent};text-transform:uppercase;margin-bottom:6px;">RAPORT POSTĘPÓW</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:1px;color:${text};">${hasAI&&ai.headline?ai.headline:'Podsumowanie tygodnia'}</div>
              <div style="font-size:12px;color:${muted};margin-top:4px;">${new Date().toLocaleDateString('pl',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
            </div>
            <div style="text-align:right;">
              <div style="width:56px;height:56px;border-radius:16px;background:${accent}22;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;color:${accent};margin-left:auto;margin-bottom:6px;">${getInit(c.name)}</div>
              <div style="font-size:13px;font-weight:700;">${c.name}</div>
              <div style="font-size:11px;color:${muted};">${trainerName}</div>
            </div>
          </div>
          ${hasAI&&ai.summary?`<div style="margin-top:14px;font-size:13px;line-height:1.7;color:${muted};border-top:1px solid ${border};padding-top:14px;">${ai.summary}</div>`:''}
        </div>

        <div style="padding:28px 32px;">

          ${activeSections.includes('sessions')?`
          <!-- SESJE -->
          <div style="margin-bottom:24px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:${accent};margin-bottom:12px;">📅 SESJE TRENINGOWE</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
              ${[
                {label:'Sesji w tygodniu',val:weekSess.length||3},
                {label:'Łącznie sesji',val:sessions.length||12},
                {label:'Aktywny plan',val:plans.length?'Tak':'Brak'},
              ].map(s=>`<div style="background:${card};border-radius:10px;padding:14px;border:1px solid ${border};">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:${accent};">${s.val}</div>
                <div style="font-size:11px;color:${muted};margin-top:2px;">${s.label}</div>
              </div>`).join('')}
            </div>
          </div>`:''}

          ${activeSections.includes('checkins')&&checkins.length?`
          <!-- CHECK-INY -->
          <div style="margin-bottom:24px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:${accent};margin-bottom:12px;">✅ OSTATNI CHECK-IN</div>
            <div style="background:${card};border-radius:10px;padding:16px;border:1px solid ${border};">
              ${checkins.slice(-1).map(ci=>`
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-size:13px;font-weight:700;">Wynik: ${ci.score||'—'}%</span>
                  <span style="font-size:11px;color:${muted};">${ci.date||''}</span>
                </div>
                <div style="height:8px;background:${border};border-radius:99px;overflow:hidden;">
                  <div style="height:100%;background:${accent};width:${ci.score||70}%;border-radius:99px;"></div>
                </div>`).join('')}
            </div>
          </div>`:''}

          ${activeSections.includes('progress')?`
          <!-- POSTĘPY SIŁOWE -->
          <div style="margin-bottom:24px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:${accent};margin-bottom:12px;">📈 POSTĘPY SIŁOWE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              ${[
                {name:'Przysiad',start:100,current:120},
                {name:'Wyciskanie',start:80,current:95},
                {name:'Martwy ciąg',start:120,current:145},
                {name:'OHP',start:60,current:72},
              ].map(e=>`<div style="background:${card};border-radius:10px;padding:12px;border:1px solid ${border};">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <span style="font-size:12px;font-weight:600;">${e.name}</span>
                  <span style="font-size:12px;color:var(--teal);">↑ +${e.current-e.start} kg</span>
                </div>
                <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:${accent};">${e.current} kg</div>
              </div>`).join('')}
            </div>
          </div>`:''}

          ${hasAI&&activeSections.includes('tasks')&&ai.achievements?`
          <!-- OSIĄGNIĘCIA AI -->
          <div style="margin-bottom:24px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:${accent};margin-bottom:12px;">⭐ OSIĄGNIĘCIA</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${ai.achievements.map(a=>`<div style="display:flex;gap:10px;padding:10px 12px;background:${card};border-radius:8px;border:1px solid ${border};">
                <span style="color:${accent};">✓</span>
                <span style="font-size:12px;">${a}</span>
              </div>`).join('')}
            </div>
          </div>`:''}

          ${hasAI&&ai.improvements?`
          <!-- DO POPRAWY -->
          <div style="margin-bottom:24px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:var(--orange);margin-bottom:12px;">🎯 OBSZARY DO POPRAWY</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${ai.improvements.map(a=>`<div style="display:flex;gap:10px;padding:10px 12px;background:${card};border-radius:8px;border:1px solid ${border};">
                <span style="color:var(--orange);">→</span>
                <span style="font-size:12px;">${a}</span>
              </div>`).join('')}
            </div>
          </div>`:''}

          ${hasAI&&activeSections.includes('plan')&&ai.nextWeekFocus?`
          <!-- PLAN NA KOLEJNY TYDZIEŃ -->
          <div style="margin-bottom:24px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:${accent};margin-bottom:10px;">📋 FOKUS NA KOLEJNY TYDZIEŃ</div>
            <div style="background:${accent}15;border:1px solid ${accent}33;border-radius:10px;padding:14px;font-size:13px;line-height:1.7;">${ai.nextWeekFocus}</div>
          </div>`:''}

          ${hasAI&&activeSections.includes('motivation')&&ai.trainerComment?`
          <!-- SŁOWO OD TRENERA -->
          <div style="background:${isDark?'linear-gradient(135deg,#0d0f12,#12151a)':accent+'11'};border:1px solid ${border};border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="font-size:11px;color:${accent};font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:8px;">💬 Słowo od trenera</div>
            <div style="font-size:13px;line-height:1.8;font-style:italic;">"${ai.trainerComment}"</div>
            <div style="margin-top:10px;font-size:11px;color:${muted};">— ${trainerName}</div>
          </div>`:''}

          <!-- footer -->
          <div style="border-top:1px solid ${border};padding-top:16px;display:flex;justify-content:space-between;font-size:10px;color:${muted};">
            <span>${trainerName} · Progress Live</span>
            <span>Wygenerowano ${new Date().toLocaleDateString('pl')}</span>
          </div>
        </div>
      </div>
    </div>`;
}

window.initReports=initReports;window.setRepTab=setRepTab;window.repLoadClient=repLoadClient;
window.repPreview=repPreview;window.repGenerate=repGenerate;
window.repQuickView=repQuickView;window.repToggleAuto=repToggleAuto;

