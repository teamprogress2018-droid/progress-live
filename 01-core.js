const W='https://anthropic-proxy.teamprogress2018.workers.dev/';
window.CL=[];window.PL=[];window.SE=[];window.EX=[];window.WO=[];
var dayCount=0;var curChat=null;var libF='Wszystkie';
var wlNav='all';var wlView='grid';var wlSort='nazwa';var wlDetailId=null;

const MSGS={};
window.MSGS=MSGS;

/** Escape HTML — chroni przed XSS przy wstawianiu tekstu użytkownika. */
function escHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
window.escHtml=escHtml;

/** Stabilne ID współdzielone lokalnie i w Firestore (doc id = obj.id). */
function newId(prefix){
  return (prefix||'id')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}
window.newId=newId;
/** Dokleja trainerId bieżącego użytkownika do obiektu przed zapisem. */
function withTrainer(obj){
  if(window._uid)obj.trainerId=window._uid;
  return obj;
}
window.withTrainer=withTrainer;
/** Mapuje dokument Firestore z priorytetem id dokumentu (nie lokalnego pola id z data()). */
function mapFbDoc(d){
  return {...d.data(),id:d.id,_fbId:d.id};
}
window.mapFbDoc=mapFbDoc;
/** Legacy bez trainerId widoczne; nowe dokumenty filtrujemy po uid. */
function belongsToTrainer(data){
  if(!window._uid)return true;
  if(!data||!data.trainerId)return true;
  return data.trainerId===window._uid;
}
window.belongsToTrainer=belongsToTrainer;
/** Zapisuje dokument pod stałym id (setDoc), żeby lokalne id = Firestore id. */
async function persistById(colName,obj){
  if(!obj||!obj.id)return obj;
  withTrainer(obj);
  if(!window._db)return obj;
  try{
    await window._setDoc(window._doc(window._db,colName,obj.id),obj,{merge:true});
    obj._fbId=obj.id;
  }catch(e){console.warn('Firebase persist '+colName+':',e);}
  return obj;
}
window.persistById=persistById;

/** Prosty eksport CSV (UTF-8 BOM) — pobiera plik w przeglądarce. */
function downloadCsv(filename,rows){
  const esc=v=>{
    const s=String(v??'');
    if(/[",\n\r]/.test(s))return '"'+s.replace(/"/g,'""')+'"';
    return s;
  };
  const csv='\uFEFF'+rows.map(r=>r.map(esc).join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
window.downloadCsv=downloadCsv;

/** Jednorazowa migracja: dokumenty bez trainerId dostają uid bieżącego trenera. */
async function migrateTrainerOwnership(collections){
  if(!window._db||!window._uid)return;
  const key='pl_trainer_migrated_'+window._uid;
  try{if(localStorage.getItem(key)==='1')return;}catch(e){}
  let tagged=0;
  for(const colName of collections){
    try{
      const snap=await window._get(window._col(window._db,colName));
      for(const d of snap.docs){
        const data=d.data()||{};
        if(data.trainerId)continue;
        try{
          await window._setDoc(window._doc(window._db,colName,d.id),{trainerId:window._uid},{merge:true});
          tagged++;
        }catch(e){}
      }
    }catch(e){console.warn('Migracja '+colName+':',e);}
  }
  try{localStorage.setItem(key,'1');}catch(e){}
  if(tagged)console.info('Progress Live: oznaczono trainerId na',tagged,'legacy dokumentach');
}
window.migrateTrainerOwnership=migrateTrainerOwnership;

/** Wejście w tryb podglądu klienta z linku #client-preview=<id>. */
function enterClientPreviewMode(clientId){
  window._clientPreviewMode=true;
  capClientId=clientId;
  window.capClientId=clientId;
  const sidebar=document.querySelector('.sidebar');
  if(sidebar)sidebar.style.display='none';
  const main=document.querySelector('.main');
  if(main){main.style.marginLeft='0';main.style.width='100%';}
  goTo('clientapp');
  const sel=document.getElementById('cap-client-sel');
  if(sel){sel.value=clientId;sel.style.display='none';}
  document.querySelectorAll('#cap-tab-customize,#cap-tab-access').forEach(b=>{if(b)b.style.display='none';});
  let banner=document.getElementById('cap-mock-banner');
  if(!banner){
    // initClientApp mógł jeszcze nie dodać bannera — dodaj teraz
    const top=document.querySelector('#screen-clientapp .topbar');
    if(top){
      banner=document.createElement('div');
      banner.id='cap-mock-banner';
      top.parentNode.insertBefore(banner,top.nextElementSibling);
    }
  }
  if(banner){
    banner.style.cssText='margin:0 16px 8px;padding:10px 14px;background:rgba(62,207,178,0.12);border:1px solid rgba(62,207,178,0.35);border-radius:8px;font-size:12px;color:var(--teal);';
    banner.innerHTML='Podgląd klienta · <button type="button" onclick="exitClientPreviewMode()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;text-decoration:underline;">Wróć do panelu trenera</button>';
  }
  setCapTab('preview');
  renderClientApp();
}
window.enterClientPreviewMode=enterClientPreviewMode;

function exitClientPreviewMode(){
  window._clientPreviewMode=false;
  const sidebar=document.querySelector('.sidebar');
  if(sidebar)sidebar.style.display='';
  document.querySelectorAll('#cap-tab-customize,#cap-tab-access').forEach(b=>{if(b)b.style.display='';});
  const sel=document.getElementById('cap-client-sel');
  if(sel)sel.style.display='';
  if(location.hash.indexOf('client-preview=')===0)history.replaceState(null,'',location.pathname+location.search);
  const banner=document.getElementById('cap-mock-banner');
  if(banner){
    banner.style.cssText='margin:0 16px 8px;padding:10px 14px;background:rgba(201,123,63,0.12);border:1px solid rgba(201,123,63,0.35);border-radius:8px;font-size:12px;color:var(--orange);';
    banner.textContent='To jest podgląd UI dla trenera — nie ma osobnej aplikacji klienta ani realnego logowania podopiecznych.';
  }
  goTo('dashboard');
}
window.exitClientPreviewMode=exitClientPreviewMode;

function consumeClientPreviewHash(){
  const m=(location.hash||'').match(/[#&]client-preview=([^&]+)/);
  if(!m)return;
  const cid=decodeURIComponent(m[1]);
  if(CL.find(c=>c.id===cid))enterClientPreviewMode(cid);
  else notify('Nie znaleziono klienta z linku podglądu');
}
window.consumeClientPreviewHash=consumeClientPreviewHash;

/** Overlay ładowania danych po zalogowaniu. */
function showAppLoading(on){
  let el=document.getElementById('app-loading');
  if(on){
    if(!el){
      el=document.createElement('div');
      el.id='app-loading';
      el.innerHTML='<div class="app-loading-card"><div class="app-loading-spin"></div><div>Ładowanie danych…</div></div>';
      document.body.appendChild(el);
    }
    el.style.display='flex';
  }else if(el){
    el.style.display='none';
  }
}
window.showAppLoading=showAppLoading;

// Wspólna funkcja wysyłania wiadomości — zawsze zapisuje trwale do Firebase.
// Używana przez WSZYSTKIE miejsca w apce, które wysyłają wiadomość do klienta
// (czat, broadcast, przypomnienia o check-in, zaproszenia, wyniki kalkulatora itd.),
// żeby żadna z nich nie znikała po odświeżeniu strony.
function pushMsg(clientId,text){
  if(!MSGS[clientId])MSGS[clientId]=[];
  const msg=withTrainer({id:newId('msg'),clientId,text,out:true,time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),createdAt:new Date().toISOString()});
  MSGS[clientId].push(msg);
  persistById('messages',msg);
  return msg;
}
const COLS=['#c8f135','#4d9fff','#9d7cf4','#ff8c42','#3ecfb2'];

// ── DEMO TRENINGI ──
const DEMO_WORKOUTS=[
  {id:'d1',name:'Full Body EMOM 5x5',cat:'fbw',level:'sredni',time:50,equip:'Sztanga',type:'demo',desc:'Klasyczny protokół EMOM. Każda minuta: 5 powtórzeń ćwiczenia siłowego. Idealne na budowę bazy siłowej przy jednoczesnej kontroli tętna.',notes:'Zachowaj RPE 7-8. Jeśli nie zdążysz odpocząć — zmniejsz ciężar.',exercises:[{name:'Przysiad ze sztangą',sets:'5',reps:'5',rest:'60s'},{name:'Wyciskanie żołnierskie OHP',sets:'5',reps:'5',rest:'60s'},{name:'Wiosłowanie sztangą',sets:'5',reps:'5',rest:'60s'},{name:'Martwy ciąg RDL',sets:'3',reps:'8',rest:'90s'},{name:'Facepull',sets:'3',reps:'15',rest:'45s'}],createdAt:'2025-01-10'},
  {id:'d2',name:'HIIT Tabata 20:10 5x5',cat:'cardio',level:'sredni',time:30,equip:'Bez sprzętu',type:'demo',desc:'Protokół Tabata: 20s pracy / 10s przerwy przez 5 rund. Intensywny trening cardio bez sprzętu.',notes:'Utrzymaj intensywność przez wszystkie rundy. Tętno 85-95% HRmax.',exercises:[{name:'Burpees',sets:'5',reps:'20s',rest:'10s'},{name:'Jump Squats',sets:'5',reps:'20s',rest:'10s'},{name:'Mountain Climbers',sets:'5',reps:'20s',rest:'10s'},{name:'High Knees',sets:'5',reps:'20s',rest:'10s'},{name:'Pompki',sets:'5',reps:'20s',rest:'10s'}],createdAt:'2025-01-12'},
  {id:'d3',name:'Lower Body 60:120 5x5',cat:'sila',level:'zaawansowany',time:65,equip:'Sztanga',type:'demo',desc:'Trening dolnych partii z długimi przerwami — nacisk na maksymalną siłę. Progresja liniowa.',notes:'Przerwy 3-5 min przy ciężkich seriach. Scięgna adaptują się 6-8 tyg wolniej od mięśni!',exercises:[{name:'Przysiad ze sztangą',sets:'5',reps:'5',rest:'3min'},{name:'Martwy ciąg klasyczny',sets:'4',reps:'4',rest:'4min'},{name:'Hip Thrust',sets:'4',reps:'8',rest:'2min'},{name:'Leg Press',sets:'3',reps:'10',rest:'90s'},{name:'Uginanie nóg maszyna',sets:'3',reps:'12',rest:'60s'},{name:'Wspięcia na łydki',sets:'4',reps:'15',rest:'45s'}],createdAt:'2025-01-15'},
  {id:'d4',name:'Push Day — Hipertrofia',cat:'hipertrofia',level:'sredni',time:55,equip:'Mieszany',type:'demo',desc:'Dzień push w układzie PPL. Skupienie na objętości i TUT dla hipertrofii klatki, barków i tricepsa.',notes:'TUT 2-0-2. Przerwy 60-90s. 8-12 powtórzeń w każdej serii.',exercises:[{name:'Wyciskanie sztangi leżąc',sets:'4',reps:'8-10',rest:'90s'},{name:'Wyciskanie hantli skos+',sets:'3',reps:'10-12',rest:'75s'},{name:'Rozpiętki wyciąg krzyżowy',sets:'3',reps:'12-15',rest:'60s'},{name:'Wyciskanie żołnierskie OHP',sets:'3',reps:'10',rest:'90s'},{name:'Wznosy hantli bokiem',sets:'4',reps:'15',rest:'45s'},{name:'Prostowanie triceps wyciąg',sets:'3',reps:'12',rest:'60s'}],createdAt:'2025-01-18'},
  {id:'d5',name:'Pull Day — Plecy & Biceps',cat:'hipertrofia',level:'sredni',time:55,equip:'Mieszany',type:'demo',desc:'Dzień pull. Budowanie szerokości i grubości pleców + ramiona. Kluczowe: Facepull ZAWSZE na końcu.',notes:'Facepull obowiązkowo! Rotatory mankietu często zaniedbywane — zapobiega kontuzjom.',exercises:[{name:'Podciąganie na drążku',sets:'4',reps:'6-8',rest:'2min'},{name:'Wiosłowanie sztangą',sets:'4',reps:'8-10',rest:'90s'},{name:'Ściąganie drążka wyciąg',sets:'3',reps:'10-12',rest:'75s'},{name:'Wiosłowanie hantlem',sets:'3',reps:'12',rest:'60s'},{name:'Uginanie biceps sztanga',sets:'3',reps:'10',rest:'60s'},{name:'Facepull',sets:'3',reps:'15',rest:'45s'}],createdAt:'2025-01-20'},
  {id:'d6',name:'Mobilność & Aktywna regeneracja',cat:'mobilnosc',level:'poczatkujacy',time:35,equip:'Bez sprzętu',type:'demo',desc:'Sesja mobilności i rozciągania. Idealna jako aktywna regeneracja w dniu odpoczynku lub po ciężkim treningu.',notes:'Oddychaj spokojnie. Każda pozycja minimum 30 sekund. Brak bólu — tylko delikatne napięcie.',exercises:[{name:'Hip 90/90 stretch',sets:'2',reps:'60s/str',rest:'10s'},{name:'Cat-Cow',sets:'2',reps:'10',rest:'10s'},{name:'Pigeon Pose',sets:'2',reps:'60s/str',rest:'10s'},{name:'Thoracic spine rotations',sets:'2',reps:'10/str',rest:'10s'},{name:'Dead hang',sets:'3',reps:'30s',rest:'30s'},{name:'Y-raise hantlami',sets:'2',reps:'15',rest:'30s'}],createdAt:'2025-01-22'},
];

function getInit(name){return name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();}

function toggleMobileSidebar(){
  document.querySelector('.sidebar').classList.toggle('mobile-open');
  document.getElementById('mobile-sidebar-backdrop').classList.toggle('show');
}
function closeMobileSidebar(){
  document.querySelector('.sidebar').classList.remove('mobile-open');
  document.getElementById('mobile-sidebar-backdrop').classList.remove('show');
}
window.toggleMobileSidebar=toggleMobileSidebar;window.closeMobileSidebar=closeMobileSidebar;

function goTo(n){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  const s=document.getElementById('screen-'+n);if(s)s.classList.add('active');
  closeMobileSidebar();
  const navMap={'dashboard':0,'clients':1,'calendar':2,'inbox':3,'plans':4,'workout-library':5,'library':6,'programs':7,'tasks':8,'forms':9,'payments':10,'calculator':11,'automation':12,'metrics':13,'checkin':14,'aiplangen':15,'ondemand':16,'resources':17,'bizstats':18,'live':19,'forum':20,'settings':22,'aicoach':23,'kb':24,'builder':-1,'progbuilder':-1,'reports':-1,'templates':-1,'onboarding':-1,'clientapp':-1,'integrations':-1};
  const btns=document.querySelectorAll('.nav-item');
  if(navMap[n]!==undefined&&btns[navMap[n]])btns[navMap[n]].classList.add('active');
  if(n==='builder')initBuilder();
  if(n==='calendar'){calCurrentDate=new Date();calMiniDate=new Date();setCalView('week');}
  if(n==='plans')renderPlans();
  if(n==='library')renderLib();
  if(n==='inbox')renderInbox();
  if(n==='clients'){renderClientFilters();renderClients();}
  if(n==='dashboard')renderDash();
  if(n==='workout-library'){closeWLDetail();renderWL();}
  if(n==='programs'){renderPrograms();}
  if(n==='metrics'){
    renderMetrics();
  }
  if(n==='tasks'){
    document.getElementById('task-due').value=new Date().toISOString().split('T')[0];
    renderTasks();
  }
  if(n==='forms'){renderForms();}
  if(n==='automation'){setAutoTab('onboard');}
  if(n==='resources'){renderResources();}
  if(n==='ondemand'){setODTab('browse');}
  if(n==='payments'){
    document.getElementById('pkg-client').innerHTML=CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
    document.getElementById('pkg-date').value=new Date().toISOString().split('T')[0];
    setPayTab('overview');
  }
  if(n==='calculator'){initCalcClients();calcTDEE();}
  if(n==='forum'){
    const fpg=document.getElementById('fp-group');
    if(fpg)fpg.innerHTML=allForumGroups().map(g=>'<option value="'+g.id+'">'+g.icon+' '+g.name+'</option>').join('');
    renderForum();
  }
  if(n==='settings'){setSettingsTab('profile');}
  if(n==='checkin'){renderCheckin();}
  if(n==='progbuilder'){pbInit();}
  if(n==='integrations'){renderIntegrations();}
  if(n==='clientapp'){initClientApp();}
  if(n==='aicoach'){initAICoach();}
  if(n==='bizstats'){initBizStats();}
  if(n==='aiplangen'){initAplangen();}
  if(n==='reports'){initReports();}
  if(n==='live'){initLive();}
  if(n==='templates'){initTemplates();}
  if(n==='onboarding'){initOnboarding();}
  if(n==='kb'){renderKB();}
}

function openM(id){
  if(id==='m-session'){
    document.getElementById('as-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('as-time').value='10:00';
    const rec=document.getElementById('as-recorded-exercises');
    if(rec)rec.style.display='none';
  }
  if(id==='m-form'){
    window._editingFormId=null;
    const titleEl=document.querySelector('#m-form .modal-title');
    if(titleEl)titleEl.textContent='NOWY FORMULARZ';
    const saveBtn=document.querySelector('#m-form .modal-footer .btn-primary');
    if(saveBtn)saveBtn.textContent='Zapisz formularz';
    document.getElementById('nf-title').value='';
    document.getElementById('nf-desc').value='';
    document.getElementById('nf-questions').innerHTML='';
  }
  if(id==='m-program'){
    window._editingProgId=null;
    const titleEl=document.querySelector('#m-program .modal-title');
    if(titleEl)titleEl.textContent='NOWY PROGRAM';
    const saveBtn=document.querySelector('#m-program .modal-footer .btn-primary');
    if(saveBtn)saveBtn.textContent='Zapisz program';
    document.getElementById('pm-name').value='';
    document.getElementById('pm-desc').value='';
  }
  if(id==='m-ex'){
    window._editingExName=null;
    const titleEl=document.querySelector('#m-ex .modal-title');
    if(titleEl)titleEl.textContent='NOWE ĆWICZENIE';
    const saveBtn=document.querySelector('#m-ex .modal-footer .btn-primary');
    if(saveBtn)saveBtn.textContent='Zapisz';
    document.getElementById('ex-name').value='';
    document.getElementById('ex-desc').value='';
  }
  if(id==='m-task'){
    window._editingTaskId=null;
    const titleEl=document.querySelector('#m-task .modal-title');
    if(titleEl)titleEl.textContent='NOWE ZADANIE';
    const saveBtn=document.querySelector('#m-task .modal-footer .btn-primary');
    if(saveBtn)saveBtn.textContent='Dodaj zadanie';
    taskSetClientField('','');
    const td=document.getElementById('task-due');
    if(td&&!td.value)td.value=new Date().toISOString().split('T')[0];
    document.getElementById('task-title').value='';
  }
  if(id==='m-metric-entry'){
    meClientSetField('','');
    document.getElementById('me-group').innerHTML=allMetricGroups().map(g=>'<option value="'+g.id+'">'+g.icon+' '+g.name+'</option>').join('');
    document.getElementById('me-date').value=new Date().toISOString().split('T')[0];
    updateMetricEntryForm();
  }
  if(id==='m-metric-group'){
    document.getElementById('mg-metrics-list').innerHTML='';
    document.getElementById('mg-name').value='';
    addMetricField();addMetricField();
  }
  if(id==='m-workout'){
    document.getElementById('w-ex-rows').innerHTML='';
    addWExRow();addWExRow();addWExRow();
  }
  document.getElementById(id).classList.add('show');
}
function closeM(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.modal-ov').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');}));

window.renderAll=function(){
  const safe=(fn)=>{try{fn();}catch(e){console.warn('renderAll partial fail:',e);}};
  safe(renderDash);safe(renderClients);safe(renderPlans);
  safe(renderCal);safe(renderLib);safe(renderInbox);safe(renderWL);
  try{document.getElementById('nb-clients').textContent=CL.length;}catch(e){}
  try{document.getElementById('b-client').innerHTML=CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');}catch(e){}
  safe(updateExDl);
  safe(generateAutoNotifs);
};

