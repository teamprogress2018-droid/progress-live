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
/** Dokleja trainerId bieżącego użytkownika do obiektu przed zapisem.
 *  W aplikacji klienta zachowujemy trainerId trenera (nie uid podopiecznego). */
function withTrainer(obj){
  if(window._clientAppMode){
    if(window._trainerId)obj.trainerId=window._trainerId;
    // clientId tylko na rekordach klienta. Nie dopisuj go do postów trenera —
    // inaczej Firestore odrzuca reakcje/wyświetlenia ( spoza dozwolonych pól ).
    if(window._clientId && !obj.clientId && obj.authorRole!=='trener' && !obj._fbId){
      obj.clientId=window._clientId;
    }
    return obj;
  }
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
  if(window._clientAppMode){
    if(!data)return false;
    if(data.trainerId&&window._trainerId&&data.trainerId!==window._trainerId)return false;
    if(data.clientId&&window._clientId&&data.clientId!==window._clientId)return false;
    return true;
  }
  if(!window._uid)return true;
  if(!data||!data.trainerId)return true;
  return data.trainerId===window._uid;
}
window.belongsToTrainer=belongsToTrainer;
function persistWarn(msg){
  const now=Date.now();
  if(now-(window._persistWarnAt||0)<8000)return;
  window._persistWarnAt=now;
  if(typeof notify==='function')notify(msg);
}
/** Zapisuje dokument pod stałym id (setDoc), żeby lokalne id = Firestore id. */
async function persistById(colName,obj){
  if(!obj||!obj.id)return obj;
  withTrainer(obj);
  if(!window._db){
    persistWarn('⚠ Brak połączenia z bazą — dane mogą nie zostać zapisane');
    return obj;
  }
  try{
    const payload={...obj};
    delete payload._fbId;
    await window._setDoc(window._doc(window._db,colName,obj.id),payload,{merge:true});
    obj._fbId=obj.id;
  }catch(e){
    console.warn('Firebase persist '+colName+':',e);
    persistWarn('⚠ Nie udało się zapisać. Sprawdź internet i spróbuj ponownie.');
  }
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

/**
 * Jednorazowa migracja: dokumenty bez trainerId dostają uid bieżącego trenera.
 * Bezpieczeństwo multi-tenant: jeśli w bazie są już dokumenty innego trenera,
 * NIE przejmujemy dokumentów bez trainerId (unikamy „kradzieży” legacy).
 * Flaga localStorage ustawiana dopiero po udanym przebiegu (bez błędów zapisu).
 */
async function migrateTrainerOwnership(collections){
  if(!window._db||!window._uid)return;
  const key='pl_trainer_migrated_'+window._uid;
  try{if(localStorage.getItem(key)==='1')return;}catch(e){}
  let tagged=0;
  let failed=0;
  let otherOwnerSeen=false;
  for(const colName of collections){
    try{
      const snap=await window._get(window._col(window._db,colName));
      for(const d of snap.docs){
        const data=d.data()||{};
        if(data.trainerId&&data.trainerId!==window._uid){otherOwnerSeen=true;break;}
      }
      if(otherOwnerSeen)break;
    }catch(e){console.warn('Migracja (skan) '+colName+':',e);failed++;}
  }
  if(otherOwnerSeen){
    console.warn('Progress Live: wykryto dane innego trenera — pomijam przejęcie legacy bez trainerId');
    try{localStorage.setItem(key,'1');}catch(e){}
    return;
  }
  for(const colName of collections){
    try{
      const snap=await window._get(window._col(window._db,colName));
      for(const d of snap.docs){
        const data=d.data()||{};
        if(data.trainerId)continue;
        try{
          await window._setDoc(window._doc(window._db,colName,d.id),{trainerId:window._uid},{merge:true});
          tagged++;
        }catch(e){failed++;}
      }
    }catch(e){console.warn('Migracja '+colName+':',e);failed++;}
  }
  if(!failed){
    try{localStorage.setItem(key,'1');}catch(e){}
  }else{
    console.warn('Progress Live: migracja trainerId częściowo nieudana ('+failed+' błędów) — ponowię przy następnym logowaniu');
  }
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
    banner.textContent='To jest podgląd UI. Prawdziwe logowanie klienta jest w linku z zaproszenia.';
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
const COLS=['#e11f2e','#4d9fff','#9d7cf4','#ff8c42','#3ecfb2'];

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

/** Profil trenera z Ustawień — jedno źródło prawdy w całej apce. */
function getTrainerProfile(){
  return(window.SETTINGS&&window.SETTINGS.profile)||{};
}
function getTrainerName(fallback='Trener'){
  const name=(getTrainerProfile().name||'').trim();
  return name||fallback;
}
function getTrainerTitle(){
  return(getTrainerProfile().title||'').trim()||'Trener personalny';
}
function getTrainerEmail(){
  return(getTrainerProfile().email||'').trim()||window._userEmail||'';
}
function getTrainerSignature(){
  return getTrainerName()+' — '+getTrainerTitle();
}
function isTrainerProfileIncomplete(){
  return!(getTrainerProfile().name||'').trim();
}
function applyAuthToTrainerProfile(){
  if(!window.SETTINGS)window.SETTINGS={};
  if(!window.SETTINGS.profile)window.SETTINGS.profile={title:'Trener personalny',avatar:'?',specialty:[],certs:[]};
  const p=window.SETTINGS.profile;
  if(window._userEmail&&!p.email)p.email=window._userEmail;
  if(!(p.name||'').trim()){
    if(window._userDisplayName){
      p.name=window._userDisplayName.trim();
    }else if(window._userEmail){
      const local=window._userEmail.split('@')[0];
      p.name=local.replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    }
  }
  if(p.name&&!p.avatar)p.avatar=getInit(p.name);
}
function maybePromptTrainerProfile(){
  if(window._clientAppMode||window._clientPreviewMode)return;
  if(!isTrainerProfileIncomplete())return;
  let dismissed=false;
  try{dismissed=localStorage.getItem('pl_profile_prompt')==='1';}catch(e){}
  if(dismissed)return;
  setTimeout(()=>{
    if(typeof notify==='function')notify('Uzupełnij profil trenera: Ustawienia → Profil');
  },1200);
}
window.getTrainerProfile=getTrainerProfile;
window.getTrainerName=getTrainerName;
window.getTrainerTitle=getTrainerTitle;
window.getTrainerEmail=getTrainerEmail;
window.getTrainerSignature=getTrainerSignature;
window.isTrainerProfileIncomplete=isTrainerProfileIncomplete;
window.applyAuthToTrainerProfile=applyAuthToTrainerProfile;
window.maybePromptTrainerProfile=maybePromptTrainerProfile;

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
  const moreScreens=['workout-library','library','programs','tasks','forms','payments','calculator','automation','integrations','metrics','checkin','aiplangen','ondemand','resources','bizstats','forum','settings','aicoach','kb'];
  if(moreScreens.includes(n)){
    const moreEl=document.getElementById('nav-more-items');
    const arrow=document.getElementById('nav-more-arrow');
    if(moreEl)moreEl.style.display='block';
    if(arrow)arrow.style.transform='rotate(180deg)';
  }
  const activeBtn=document.querySelector('.nav-item[data-screen="'+n+'"]');
  if(activeBtn)activeBtn.classList.add('active');
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
    document.getElementById('pkg-client').innerHTML=CL.map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.name)+'</option>').join('');
    document.getElementById('pkg-date').value=new Date().toISOString().split('T')[0];
    setPayTab('overview');
  }
  if(n==='calculator'){initCalcClients();calcTDEE();}
  if(n==='forum'){
    fillForumPostGroupSelect();
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
  if(id==='m-broadcast'){
    if(typeof refreshBroadcastGroupOptions==='function')refreshBroadcastGroupOptions();
  }
  if(id==='m-forum-post'){
    if(typeof fillForumPostGroupSelect==='function')fillForumPostGroupSelect();
  }
  if(id==='m-forum-group'){
    const name=document.getElementById('fg-name');
    const desc=document.getElementById('fg-desc');
    if(name)name.value='';
    if(desc)desc.value='';
    if(typeof renderForumGroupMembers==='function')renderForumGroupMembers();
  }
  if(id==='m-autoflow-builder'){
    if(typeof updateAfBuilderUi==='function')updateAfBuilderUi();
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
  safe(syncSidebarProfile);
};

function showNetBanner(offline){
  let el=document.getElementById('net-banner');
  if(!el){
    el=document.createElement('div');
    el.id='net-banner';
    el.style.cssText='display:none;position:fixed;top:0;left:0;right:0;z-index:4000;padding:8px 14px;background:var(--orange);color:#000;font-size:12px;font-weight:700;text-align:center;';
    document.body.appendChild(el);
  }
  if(offline){
    el.textContent='Brak internetu — zmiany mogą nie zostać zapisane w chmurze.';
    el.style.display='block';
  }else{
    el.textContent='Połączenie wróciło.';
    el.style.background='var(--teal)';
    el.style.display='block';
    setTimeout(()=>{el.style.display='none';el.style.background='var(--orange)';},2500);
  }
}
window.addEventListener('offline',()=>showNetBanner(true));
window.addEventListener('online',()=>showNetBanner(false));
window.addEventListener('beforeunload',e=>{
  if(typeof liveSessionActive!=='undefined'&&liveSessionActive){
    e.preventDefault();
    e.returnValue='';
  }
  if(window._cw&&window._cw.active){
    e.preventDefault();
    e.returnValue='';
  }
});

function parsePct1RM(v){
  if(v==null||v==='')return '';
  const s=String(v).trim().replace(',','.');
  const m=s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  const n=parseFloat(m?m[1]:s);
  if(!Number.isFinite(n)||n<=0||n>150)return '';
  return String(n);
}
window.parsePct1RM=parsePct1RM;

function roundToPlate(kg,plate){
  const n=parseFloat(kg);
  const step=plate||2.5;
  if(!Number.isFinite(n)||n<=0||!Number.isFinite(step)||step<=0)return '';
  const rounded=Math.round(n/step)*step;
  if(rounded<=0)return '';
  const x=Math.round(rounded*10)/10;
  return Number.isInteger(x)?String(x):x.toFixed(1);
}
window.roundToPlate=roundToPlate;

function epley1RM(kg,reps){
  const w=parseFloat(kg);
  const r=parseFloat(reps);
  if(!Number.isFinite(w)||w<=0||!Number.isFinite(r)||r<=0)return null;
  if(r<=1)return w;
  return w*(1+r/30);
}
window.epley1RM=epley1RM;

/** Rodzina boju do 1RM: OHP przed bench (oboje mają „wyciskanie”). */
function guessLiftFamily(name){
  const n=String(name||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  if(!n)return '';
  if(/francusk|triceps|prostowanie|kickback/.test(n))return '';
  if(/ohp|military|zolniers|overhead|nad glowa|\barnold\b/.test(n))return 'ohp';
  if(/wyciskan/.test(n)&&/(siedz|stoj)/.test(n)&&!/lez/.test(n))return 'ohp';
  if(/przysiad|squat|hack|goblet/.test(n))return 'squat';
  if(/martw|deadlift|\brdl\b|rumunsk|trap\s*bar/.test(n))return 'deadlift';
  if(/bench/.test(n))return 'bench';
  if(/wyciskan/.test(n)&&/(lez|skos|incline|decline|klatk)/.test(n))return 'bench';
  if(/^wyciskanie( sztangi| hantli)?$/.test(n))return 'bench';
  return '';
}
window.guessLiftFamily=guessLiftFamily;

const LIFT_1RM_META={
  squat:{metric:'m1',label:'przysiad'},
  deadlift:{metric:'m2',label:'martwy ciąg'},
  bench:{metric:'m3',label:'wyciskanie leżąc'},
  ohp:{metric:'m4',label:'OHP'}
};

function officialLift1RMs(clientId){
  const out={squat:null,deadlift:null,bench:null,ohp:null};
  if(!clientId)return out;
  const entries=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===clientId&&e.groupId==='mg3')
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const num=x=>{const n=parseFloat(x);return Number.isFinite(n)&&n>0?n:null;};
  for(const e of entries){
    const v=e.values||{};
    if(out.squat==null)out.squat=num(v.m1);
    if(out.deadlift==null)out.deadlift=num(v.m2);
    if(out.bench==null)out.bench=num(v.m3);
    if(out.ohp==null)out.ohp=num(v.m4);
    if(out.squat&&out.deadlift&&out.bench&&out.ohp)break;
  }
  return out;
}
window.officialLift1RMs=officialLift1RMs;

function epley1RMFromSessions(clientId,family,exactName){
  if(!clientId)return null;
  const want=String(exactName||'').toLowerCase().replace(/\s+/g,' ').trim();
  const sessions=(window.SE||[]).filter(s=>s.clientId===clientId&&Array.isArray(s.exercises))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
  for(const s of sessions){
    let best=null;
    for(const ex of s.exercises||[]){
      const match=family?guessLiftFamily(ex.name)===family
        :String(ex.name||'').toLowerCase().replace(/\s+/g,' ').trim()===want;
      if(!match)continue;
      for(const set of ex.sets||[]){
        const est=epley1RM(set.kg,set.reps);
        if(est!=null&&(best==null||est>best))best=est;
      }
    }
    if(best!=null)return best;
  }
  return null;
}
window.epley1RMFromSessions=epley1RMFromSessions;

function client1RMforExercise(clientId,name){
  const family=guessLiftFamily(name);
  const official=officialLift1RMs(clientId);
  const meta=family?LIFT_1RM_META[family]:null;
  if(meta&&official[family])return{kg:official[family],source:'metric',family,label:meta.label};
  const est=epley1RMFromSessions(clientId,family,name);
  if(est)return{kg:est,source:'epley',family,label:meta?meta.label:(name||'ćwiczenie')};
  return null;
}
window.client1RMforExercise=client1RMforExercise;

function weightFromPct1RM(clientId,name,pct){
  const p=parseFloat(parsePct1RM(pct));
  if(!Number.isFinite(p)||p<=0)return{kg:'',hint:'',rm:null};
  const rm=client1RMforExercise(clientId,name);
  if(!rm)return{kg:'',hint:p+'% 1RM — wpisz pomiar w Pomiary → Siła bazowa',rm:null};
  const kg=roundToPlate(rm.kg*p/100);
  const rmKg=roundToPlate(rm.kg)||String(Math.round(rm.kg));
  const src=rm.source==='metric'?(rm.label+' 1RM '+rmKg+' kg'):('szac. 1RM '+rmKg+' kg z sesji');
  return{kg:kg||'',hint:p+'% z '+src+(kg?' → '+kg+' kg':''),rm};
}
window.weightFromPct1RM=weightFromPct1RM;

/** Ćwiczenie z planu: obiekt AI albo string z kreatora ("Wyciskanie 4x8 @75%"). */
function parsePlanExercise(ex){
  if(ex==null)return{name:'Ćwiczenie',sets:'3',reps:'10',rest:'90s',kg:'',pct1rm:''};
  if(typeof ex==='string'){
    const raw=ex.trim();
    const m=raw.match(/^(.*?)(?:\s+(\d+)\s*[x×]\s*(\d+(?:\s*-\s*\d+)?))?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*(%|kg)?)?\s*$/i);
    const amt=m&&m[4]?String(m[4]).replace(',','.'):'';
    const unit=((m&&m[5])||'').toLowerCase();
    const isPct=unit==='%';
    return{
      name:(m&&m[1]?m[1]:raw).trim()||'Ćwiczenie',
      sets:(m&&m[2])||'3',
      reps:((m&&m[3])||'10').replace(/\s/g,''),
      rest:'90s',
      kg:isPct?'':amt,
      pct1rm:isPct?parsePct1RM(amt):''
    };
  }
  let kg=ex.kg!=null&&ex.kg!==''?String(ex.kg):'';
  let pct1rm=parsePct1RM(ex.pct1rm);
  const fromKg=parsePct1RM(/^\s*\d+(?:[.,]\d+)?\s*%\s*$/.test(kg)?kg:'');
  if(fromKg){pct1rm=pct1rm||fromKg;kg='';}
  return{
    name:ex.name||ex.n||'Ćwiczenie',
    sets:String(ex.sets||ex.s||'3'),
    reps:String(ex.reps||ex.r||'10'),
    rest:String(ex.rest||ex.rs||'90s'),
    kg,
    pct1rm,
    rpe:ex.rpe||ex.rir||'',
    rir:ex.rir||'',
    tempo:ex.tempo||'',
    alt:ex.alt||''
  };
}
window.parsePlanExercise=parsePlanExercise;

function formatPlanExerciseLine(ex,clientId){
  const p=parsePlanExercise(ex);
  let kgPart='';
  if(p.pct1rm){
    const w=weightFromPct1RM(clientId,p.name,p.pct1rm);
    kgPart=w.kg?(' @'+p.pct1rm+'% → '+w.kg+'kg'):(' @'+p.pct1rm+'%');
  }else if(p.kg){
    kgPart=' @'+p.kg+'kg';
  }
  return(p.name||'')+(p.sets?' '+p.sets+'×'+p.reps:'')+kgPart;
}
window.formatPlanExerciseLine=formatPlanExerciseLine;

function altsForExercise(name,explicit){
  const fromPlan=String(explicit||'').split(/[,;/|]/).map(s=>s.trim()).filter(Boolean);
  if(fromPlan.length)return fromPlan;
  const key=String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(!key)return [];
  const lib=typeof allExercises==='function'?allExercises():(window.DEF_EX||[]);
  const hit=lib.find(e=>String(e.name||'').toLowerCase().replace(/\s+/g,' ').trim()===key);
  if(!hit||!hit.alt)return [];
  return String(hit.alt).split(/[,;/]/).map(s=>s.trim()).filter(Boolean);
}
window.altsForExercise=altsForExercise;

function parseRestSeconds(rest){
  const s=String(rest||'90');
  if(/min/i.test(s))return Math.round((parseFloat(s)||1)*60);
  const n=parseInt(s,10);
  return Number.isFinite(n)&&n>0?n:90;
}
window.parseRestSeconds=parseRestSeconds;

function todayYmd(){
  if(typeof dateStr==='function')return dateStr(new Date());
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
window.todayYmd=todayYmd;

function mondayYmd(){
  const d=new Date();
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
window.mondayYmd=mondayYmd;

function planTrainingDayIdxs(plan){
  return(plan&&plan.days||[]).map((d,i)=>d&&!d.rest&&(d.exercises||[]).length?i:-1).filter(i=>i>=0);
}
window.planTrainingDayIdxs=planTrainingDayIdxs;

function suggestedPlanDayIdx(clientId,plan){
  if(!plan||!plan.days||!plan.days.length)return 0;
  if(plan.days.length===7)return(new Date().getDay()+6)%7;
  const train=planTrainingDayIdxs(plan);
  if(!train.length)return 0;
  const past=(window.SE||[]).filter(s=>s.clientId===clientId&&s.planId===plan.id&&s.dayIdx!=null&&(s.source==='live'||s.source==='client'))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!past.length)return train[0];
  const today=todayYmd();
  if(past[0].date===today)return past[0].dayIdx;
  const pos=train.indexOf(past[0].dayIdx);
  if(pos<0)return train[0];
  return train[(pos+1)%train.length];
}
window.suggestedPlanDayIdx=suggestedPlanDayIdx;

function lastLoadForExercise(clientId,name){
  if(!clientId||!name)return null;
  const key=String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
  const sessions=(window.SE||[]).filter(s=>s.clientId===clientId&&Array.isArray(s.exercises))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
  for(const s of sessions){
    const ex=(s.exercises||[]).find(e=>String(e.name||'').toLowerCase().replace(/\s+/g,' ').trim()===key);
    if(!ex)continue;
    const sets=(ex.sets||[]).filter(x=>x&&(x.kg||x.reps));
    if(!sets.length)continue;
    const last=sets[sets.length-1];
    return{kg:last.kg,reps:last.reps,sets};
  }
  return null;
}
window.lastLoadForExercise=lastLoadForExercise;

function mapPlanExercisesForClient(rawEx,clientId){
  return(rawEx||[]).map(raw=>{
    const ex=parsePlanExercise(raw);
    const last=lastLoadForExercise(clientId,ex.name);
    const nSets=parseInt(ex.sets,10)||3;
    const defaultReps=ex.reps||'10';
    const rest=parseRestSeconds(ex.rest);
    const pct=ex.pct1rm||'';
    const fromPct=pct?weightFromPct1RM(clientId,ex.name,pct):null;
    const plannedKg=(fromPct&&fromPct.kg)?fromPct.kg:(ex.kg||'');
    const lockPct=!!pct;
    return{
      name:ex.name,
      plannedName:ex.name,
      alts:altsForExercise(ex.name,ex.alt),
      restSec:rest,
      rpe:ex.rpe||'',
      pct1rm:pct,
      kgHint:fromPct?fromPct.hint:'',
      lastKg:last&&last.kg!=null&&last.kg!==''?last.kg:(plannedKg||''),
      lastReps:last&&last.reps!=null&&last.reps!==''?last.reps:'',
      sets:Array.from({length:nSets},(_,i)=>{
        const prev=last&&last.sets[i];
        let kg=plannedKg;
        if(!lockPct&&prev&&prev.kg!=null&&prev.kg!=='')kg=String(prev.kg);
        return{
          setNo:i+1,
          kg:kg||'',
          reps:prev&&prev.reps!=null&&prev.reps!==''?String(prev.reps):defaultReps,
          done:false
        };
      })
    };
  });
}
window.mapPlanExercisesForClient=mapPlanExercisesForClient;

window.PROGRESS_PHOTOS=window.PROGRESS_PHOTOS||[];

function ppFeatureOn(c){
  if(!c)return true;
  const s=c.clientSettings||{};
  return s.progressPhoto!==false;
}
window.ppFeatureOn=ppFeatureOn;

function ppListFor(clientId){
  return (window.PROGRESS_PHOTOS||[]).filter(p=>p.clientId===clientId)
    .slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.createdAt||'').localeCompare(b.createdAt||''));
}
window.ppListFor=ppListFor;

function compressImageFile(file,max=720,quality=0.68){
  return new Promise((resolve,reject)=>{
    if(!file){reject(new Error('Brak pliku'));return;}
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let w=img.width,h=img.height;
      const scale=Math.min(1,max/Math.max(w,h,1));
      w=Math.max(1,Math.round(w*scale));
      h=Math.max(1,Math.round(h*scale));
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#111';
      ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Nie udało się wczytać zdjęcia'));};
    img.src=url;
  });
}
window.compressImageFile=compressImageFile;

