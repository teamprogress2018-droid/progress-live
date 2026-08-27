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
const COLS=['#e60000','#0055a4','#ffd700','#2ecc71','#9e9e9e'];

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
  if(window._onboardResumeTimer){
    clearTimeout(window._onboardResumeTimer);
    window._onboardResumeTimer=null;
  }
  if(n!=='clients'&&typeof closeClientProfile==='function'){
    try{closeClientProfile();}catch(e){}
  }
  document.querySelectorAll('.modal-ov.show').forEach(m=>m.classList.remove('show'));
  if(typeof closeIntDetail==='function'){
    try{closeIntDetail();}catch(e){}
  }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.nav-flyout-item').forEach(b=>b.classList.remove('active'));
  const s=document.getElementById('screen-'+n);if(s)s.classList.add('active');
  closeMobileSidebar();
  if(typeof closeLibraryFlyout==='function')closeLibraryFlyout();
  const libraryScreens=['library','plans','programs','templates','tasks','forms','metrics'];
  const moreScreens=['ondemand','forum','payments','calculator','kb','trainer-profile','checkin','integrations','resources','bizstats','settings','aicoach'];
  // builder + aiplangen celowo poza Więcej — wejście z profilu klienta (Plan)
  if(moreScreens.includes(n)){
    const moreEl=document.getElementById('nav-more-items');
    const arrow=document.getElementById('nav-more-arrow');
    if(moreEl)moreEl.style.display='block';
    if(arrow)arrow.style.transform='rotate(180deg)';
  }
  const activeBtn=document.querySelector('.nav-item[data-screen="'+n+'"]');
  if(activeBtn)activeBtn.classList.add('active');
  const flyItem=document.querySelector('.nav-flyout-item[data-screen="'+n+'"]');
  if(flyItem)flyItem.classList.add('active');
  if(libraryScreens.includes(n)){
    const libBtn=document.getElementById('nav-library-btn');
    if(libBtn)libBtn.classList.add('active');
  }
  try{ _goToRender(n); }catch(e){ console.warn('goTo render error ('+n+'):', e); }
}
function _goToRender(n){
  if(n==='builder')initBuilder();
  if(n==='calendar'){calCurrentDate=new Date();calMiniDate=new Date();setCalView('week');}
  if(n==='plans')renderPlans();
  if(n==='library'){if(typeof renderLibTab==='function')renderLibTab();else renderLib();}
  if(n==='inbox')renderInbox();
  if(n==='clients'){renderClientFilters();renderClients();}
  if(n==='dashboard')renderDash();
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
    const pkgEl=document.getElementById('pkg-client');
    if(pkgEl)pkgEl.innerHTML=CL.map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.name)+'</option>').join('');
    const pkgDate=document.getElementById('pkg-date');
    if(pkgDate)pkgDate.value=new Date().toISOString().split('T')[0];
    setPayTab('overview');
  }
  if(n==='calculator'){initCalcClients();calcTDEE();}
  if(n==='forum'){
    fillForumPostGroupSelect();
    renderForum();
  }
  if(n==='settings'){setSettingsTab('brand');}
  if(n==='trainer-profile'){renderTrainerProfilePage();}
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

function initPriorSportsForm(prefix,selected){
  const mountId=prefix+'-prior-sports-mount';
  const mount=document.getElementById(mountId);
  if(mount&&typeof priorSportsChipsHTML==='function'){
    mount.outerHTML=priorSportsChipsHTML(selected||[],prefix);
    return;
  }
  const direct=document.getElementById(prefix+'-prior-sports');
  if(!direct&&typeof priorSportsChipsHTML==='function'){
    const parent=document.getElementById(mountId)||document.querySelector('#m-'+prefix+' .modal-body');
    if(parent){
      const wrap=document.createElement('div');
      wrap.id=prefix+'-prior-sports-wrap';
      wrap.innerHTML=priorSportsChipsHTML(selected||[],prefix);
      parent.insertBefore(wrap.firstElementChild,parent.firstChild);
    }
  }else if(direct&&typeof setPriorSportsChips==='function'){
    setPriorSportsChips(prefix,selected||[]);
  }
}
window.initPriorSportsForm=initPriorSportsForm;

function openM(id){
  document.querySelectorAll('.ex-ac-dropdown').forEach(dd=>{dd.style.display='none';});
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
    const ev=document.getElementById('ex-video');if(ev)ev.value='';
    const ei=document.getElementById('ex-img');if(ei)ei.value='';
  }
  if(id==='m-task'){
    window._editingTaskId=null;
    const titleEl=document.querySelector('#m-task .modal-title');
    if(titleEl)titleEl.textContent='NOWE ZADANIE';
    const saveBtn=document.querySelector('#m-task .modal-footer .btn-primary');
    if(saveBtn)saveBtn.textContent='Dodaj zadanie';
    taskSetClientField('','');
    const hb=document.getElementById('task-habit');
    if(hb)hb.checked=false;
    const chb=document.getElementById('task-challenge');
    if(chb)chb.checked=false;
    const chDays=document.getElementById('task-ch-days');
    if(chDays)chDays.value='21';
    const chStart=document.getElementById('task-ch-start');
    if(chStart)chStart.value='';
    const chTgt=document.getElementById('task-ch-target');
    if(chTgt)chTgt.value='';
    if(typeof syncTaskKindUi==='function')syncTaskKindUi();
    const wrap=document.getElementById('task-due-wrap');
    if(wrap)wrap.style.display='';
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
  if(id==='m-own-video'){
    window._editingVideoId=null;
    const titleEl=document.querySelector('#m-own-video .modal-title');
    if(titleEl)titleEl.textContent='NOWY FILM';
    const saveBtn=document.querySelector('#m-own-video .modal-footer .btn-primary');
    if(saveBtn)saveBtn.textContent='Zapisz film';
    const n=document.getElementById('ov-name');if(n)n.value='';
    const u=document.getElementById('ov-url');if(u)u.value='';
    const e=document.getElementById('ov-ex');if(e)e.value='';
  }
  if(id==='m-autoflow-builder'){
    if(typeof updateAfBuilderUi==='function')updateAfBuilderUi();
  }
  if(id==='m-client'){
    window._editingClientId=null;
    const titleEl=document.querySelector('#m-client .modal-title');
    if(titleEl)titleEl.textContent='NOWY KLIENT';
    if(typeof initPriorSportsForm==='function')initPriorSportsForm('ac',[]);
  }
  document.getElementById(id).classList.add('show');
}
function closeM(id){
  if(id==='m-od-player'){
    const frame=document.getElementById('od-player-frame');
    if(frame){
      if(frame.tagName==='IFRAME')frame.removeAttribute('src');
      else if(frame.pause){try{frame.pause();}catch(e){}}
    }
  }
  const el=document.getElementById(id);
  if(el)el.classList.remove('show');
}
document.querySelectorAll('.modal-ov').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');}));

window.renderAll=function(){
  const safe=(fn)=>{try{fn();}catch(e){console.warn('renderAll partial fail:',e);}};
  safe(renderDash);safe(renderClients);safe(renderPlans);
  safe(renderCal);safe(renderLib);safe(renderInbox);
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
  if(/bench|floor press|podlogi/.test(n))return 'bench';
  if(/wyciskan/.test(n)&&/(lez|skos|incline|decline|klatk|podlog)/.test(n))return 'bench';
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

window.COACH_VIDEOS=window.COACH_VIDEOS||[];

function normalizeCoachVideoUrl(raw){
  const s=String(raw||'').trim();
  if(!s)return '';
  if(/^(javascript|data|vbscript):/i.test(s))return '';
  let url=s;
  if(!/^https?:\/\//i.test(url)){
    if(/^(www\.|youtube\.|youtu\.be|vimeo\.)/i.test(url))url='https://'+url;
    else return '';
  }
  if(!/^https?:\/\//i.test(url))return '';
  return url;
}
window.normalizeCoachVideoUrl=normalizeCoachVideoUrl;

function coachVideoEmbed(url){
  const u=normalizeCoachVideoUrl(url);
  if(!u)return '';
  let id='';
  let m=u.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if(m)id=m[1];
  if(!id){m=u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);if(m)id=m[1];}
  if(!id){m=u.match(/youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/);if(m)id=m[1];}
  if(id)return 'https://www.youtube-nocookie.com/embed/'+id;
  m=u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if(m)return 'https://player.vimeo.com/video/'+m[1];
  return '';
}
window.coachVideoEmbed=coachVideoEmbed;

function coachVideoIsFile(url){
  return /\.(mp4|webm|ogg|m4v)(\?|#|$)/i.test(String(url||''));
}
window.coachVideoIsFile=coachVideoIsFile;

function youtubeIdFromUrl(url){
  const u=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(url):String(url||'');
  if(!u)return '';
  let m=u.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if(m)return m[1];
  m=u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if(m)return m[1];
  m=u.match(/youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/);
  if(m)return m[1];
  return '';
}
window.youtubeIdFromUrl=youtubeIdFromUrl;

function exerciseMediaKey(name){
  return String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
}
window.exerciseMediaKey=exerciseMediaKey;

function exerciseSlug(name){
  return exerciseMediaKey(name)
    .normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/ł/g,'l')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'');
}
window.exerciseSlug=exerciseSlug;

/** GIF / zdjęcie techniki z manifestu repo, Firestore (EX_GIF_REMOTE) lub pola gif/img ćwiczenia. */
function exGifMapLookup(name){
  const key=exerciseMediaKey(name);
  const slug=exerciseSlug(name);
  if(!key&&!slug)return '';
  const remote=window.EX_GIF_REMOTE||{};
  if(remote[key])return remote[key];
  if(remote[slug])return remote[slug];
  const manifest=window.EX_GIF_MANIFEST||{};
  if(manifest[key])return manifest[key];
  if(manifest[slug])return manifest[slug];
  if(manifest[name])return manifest[name];
  return '';
}
window.exGifMapLookup=exGifMapLookup;

function exPhotoMapLookup(name){
  const key=exerciseMediaKey(name);
  const slug=exerciseSlug(name);
  if(!key&&!slug)return '';
  const photos=window.EX_PHOTO_MANIFEST||{};
  if(photos[key])return photos[key];
  if(photos[slug])return photos[slug];
  if(photos[name])return photos[name];
  return '';
}
window.exPhotoMapLookup=exPhotoMapLookup;

/** Placeholdery SVG z assets/ex/*.svg nie są prawdziwymi zdjęciami techniki. */
function isDecorativeExAsset(url){
  const s=String(url||'').trim();
  if(!s)return false;
  if(/\/gifs\//i.test(s))return false;
  return /(?:^|\/)assets\/ex\/(?:bench|curl|deadlift|ohp|pullup|squat)\.svg(?:\?|#|$)/i.test(s)
    || /(?:^|\/)assets\/ex\/[^/]+\.svg(?:\?|#|$)/i.test(s);
}
window.isDecorativeExAsset=isDecorativeExAsset;

function isSafeMediaUrl(url){
  const s=String(url||'').trim();
  if(!s||/^(javascript|data|vbscript):/i.test(s))return false;
  if(/^https?:\/\//i.test(s))return true;
  if(s.startsWith('assets/'))return true;
  return /^\.?\.?\/?[A-Za-z0-9_./-]+\.(gif|webp|png|jpe?g|svg|mp4|webm)(\?.*)?$/i.test(s);
}
window.isSafeMediaUrl=isSafeMediaUrl;

function exGifUrl(exOrName){
  let ex=exOrName;
  if(typeof exOrName==='string')ex=typeof libExerciseByName==='function'?libExerciseByName(exOrName):null;
  if(ex&&typeof ex==='object'){
    const gif=String(ex.gif||'').trim();
    if(isSafeMediaUrl(gif)&&!isDecorativeExAsset(gif))return gif;
    const img=String(ex.img||ex.thumb||ex.image||'').trim();
    if(isSafeMediaUrl(img)&&/\.(gif|webp|mp4|webm)(\?|#|$)/i.test(img)&&!isDecorativeExAsset(img))return img;
    const mapped=exGifMapLookup(ex.name);
    if(mapped)return mapped;
    return '';
  }
  return exGifMapLookup(typeof exOrName==='string'?exOrName:'');
}
window.exGifUrl=exGifUrl;

/** Miniatura: GIF > własne zdjęcie > manifest zdjęć > YouTube. Ignoruje placeholdery SVG. */
function exThumbUrl(exOrName){
  let ex=exOrName;
  if(typeof exOrName==='string')ex=typeof libExerciseByName==='function'?libExerciseByName(exOrName):null;
  const gif=typeof exGifUrl==='function'?exGifUrl(ex||exOrName):'';
  if(gif)return gif;
  const name=(ex&&ex.name)||(typeof exOrName==='string'?exOrName:'');
  const photo=exPhotoMapLookup(name);
  if(photo)return photo;
  if(!ex||typeof ex!=='object')return '';
  const img=String(ex.img||ex.thumb||ex.image||'').trim();
  if(img&&isSafeMediaUrl(img)&&!isDecorativeExAsset(img))return img;
  let video=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(ex.video||''):String(ex.video||'');
  if(!video&&ex.name&&typeof ownVideoForExercise==='function')video=ownVideoForExercise(ex.name);
  const yt=youtubeIdFromUrl(video);
  if(yt)return 'https://i.ytimg.com/vi/'+yt+'/mqdefault.jpg';
  return '';
}
window.exThumbUrl=exThumbUrl;

function libExerciseByName(name){
  const key=String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(!key)return null;
  const lib=typeof allExercises==='function'?allExercises():[].concat(window.EX||[],window.DEF_EX||[]);
  const byName=lib.find(e=>String(e.name||'').toLowerCase().replace(/\s+/g,' ').trim()===key);
  if(byName)return byName;
  return lib.find(e=>{
    const aka=String(e.aka||'').toLowerCase().replace(/\s+/g,' ');
    if(!aka)return false;
    return aka.split(/[,;/|]/).map(s=>s.trim()).filter(Boolean).includes(key);
  })||null;
}
window.libExerciseByName=libExerciseByName;

function ownVideoForExercise(name){
  const key=String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(!key)return '';
  const vids=(window.COACH_VIDEOS||[]).filter(v=>String(v.exName||'').toLowerCase().replace(/\s+/g,' ').trim()===key)
    .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(vids[0])return normalizeCoachVideoUrl(vids[0].url);
  const lib=libExerciseByName(name);
  return lib?normalizeCoachVideoUrl(lib.video||''):'';
}
window.ownVideoForExercise=ownVideoForExercise;

function resolveCoachMedia(parsed){
  const ex=parsed&&typeof parsed==='object'?parsed:{name:parsed};
  const name=ex.name||'';
  const lib=libExerciseByName(name);
  const note=String(ex.note||ex.notes||ex.cue||'').trim();
  let video=normalizeCoachVideoUrl(ex.video||ex.url||'');
  if(!video)video=ownVideoForExercise(name);
  let libTip='';
  if(!note&&lib){
    libTip=String(lib.tip||lib.desc||'').trim();
    if(libTip.length>160)libTip=libTip.slice(0,157)+'…';
  }
  const embed=coachVideoEmbed(video);
  const gif=exGifUrl({...ex,...(lib||{}),video:video||(lib&&lib.video)||'',gif:(ex.gif||(lib&&lib.gif)||''),img:(ex.img||ex.thumb||ex.image||(lib&&(lib.img||lib.thumb||lib.image))||'')});
  const img=gif||exThumbUrl({...ex,...(lib||{}),video:video||(lib&&lib.video)||'',img:(ex.img||ex.thumb||ex.image||(lib&&(lib.img||lib.thumb||lib.image))||'')});
  return{note,libTip,video,videoEmbed:embed,isFile:coachVideoIsFile(video),img,gif};
}
window.resolveCoachMedia=resolveCoachMedia;

function coachMediaIcons(ex){
  const src=ex&&typeof ex==='object'?ex:{name:String(ex||'')};
  const coach=(src.libTip!==undefined||src.planVideo!==undefined||src.planNote!==undefined)
    ?{note:String(src.note||'').trim(),libTip:String(src.libTip||'').trim(),video:String(src.video||'').trim(),gif:String(src.gif||'').trim()}
    :resolveCoachMedia(typeof parsePlanExercise==='function'?parsePlanExercise(src):src);
  let icons='';
  if(coach.note||coach.libTip)icons+=' 💡';
  if(coach.gif)icons+=' 🎞';
  if(coach.video)icons+=' ▶️';
  return icons;
}
window.coachMediaIcons=coachMediaIcons;

function exTechniqueMediaHtml(media,opts){
  opts=opts||{};
  const gif=String((media&&media.gif)||'').trim();
  const compact=!!opts.compact;
  if(!gif||!isSafeMediaUrl(gif))return '';
  const alt=escHtml((media&&media.name)||'Technika wykonania');
  const cls=compact?'ex-ac-thumb-img cw-technique-gif-img':'cw-technique-gif-img';
  if(/\.(mp4|webm)(\?|#|$)/i.test(gif)){
    return `<div class="cw-technique-media cw-technique-gif${compact?' is-compact':''}"><video class="${cls}" src="${escHtml(gif)}" autoplay loop muted playsinline preload="metadata" title="${alt}"></video></div>`;
  }
  return `<div class="cw-technique-media cw-technique-gif${compact?' is-compact':''}"><img class="${cls}" src="${escHtml(gif)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer"></div>`;
}
window.exTechniqueMediaHtml=exTechniqueMediaHtml;

function coachMediaHtml(ex,opts){
  opts=opts||{};
  const note=(ex&&ex.note)||'';
  const libTip=(ex&&ex.libTip)||'';
  const video=(ex&&ex.video)||'';
  const embed=(ex&&ex.videoEmbed)||'';
  const gif=(ex&&ex.gif)||'';
  const file=!!(ex&&ex.isFile)||coachVideoIsFile(video);
  const show=!!opts.showVideo;
  const showGif=opts.showGif!==false;
  const toggle=opts.toggleFn||'';
  let html='';
  if(showGif&&gif)html+=exTechniqueMediaHtml({gif,name:ex&&ex.name},opts);
  if(note)html+=`<div class="cw-coach-note">${escHtml(note)}</div>`;
  else if(libTip)html+=`<div style="font-size:11px;color:var(--muted);margin:0 0 10px;line-height:1.45;">${escHtml(libTip)}</div>`;
  if(video){
    html+=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px;">`;
    if(toggle)html+=`<button type="button" class="btn btn-ghost btn-sm" onclick="${toggle}">${show?'▾ Ukryj film':'▶ Film techniki'}</button>`;
    html+=`<a class="btn btn-ghost btn-sm" href="${escHtml(video)}" target="_blank" rel="noopener noreferrer">↗ Otwórz film</a></div>`;
    if(show&&embed)html+=`<div class="cw-video-wrap"><iframe src="${escHtml(embed)}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen title="Film techniki"></iframe></div>`;
    else if(show&&file)html+=`<div class="cw-video-wrap"><video src="${escHtml(video)}" controls playsinline></video></div>`;
  }
  return html;
}
window.coachMediaHtml=coachMediaHtml;

/** Ćwiczenie z planu: obiekt AI albo string z kreatora ("Wyciskanie 4x8 @75%"). */
function parsePlanExercise(ex){
  if(ex==null)return{name:'Ćwiczenie',sets:'3',reps:'10',rest:'90s',kg:'',pct1rm:'',ss:'',emom:false,note:'',video:'',wu:0,drop:0,amrap:false};
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
      pct1rm:isPct?parsePct1RM(amt):'',
      ss:'',
      emom:false,
      note:'',
      video:'',
      wu:0,
      drop:0,
      amrap:false
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
    alt:ex.alt||'',
    ss:String(ex.ss||ex.superset||'').trim(),
    emom:isEmomFlag(ex.emom),
    note:String(ex.note||ex.notes||ex.cue||'').trim(),
    video:normalizeCoachVideoUrl(ex.video||ex.url||''),
    wu:parseSetKindCount(ex.wu,2),
    drop:parseSetKindCount(ex.drop,2),
    amrap:isAmrapFlag(ex.amrap)
  };
}
window.parsePlanExercise=parsePlanExercise;

function parseSetKindCount(v,max){
  const n=parseInt(v,10);
  if(!Number.isFinite(n)||n<=0)return 0;
  return Math.min(max==null?2:max,n);
}
window.parseSetKindCount=parseSetKindCount;

function isAmrapFlag(v){
  return v===true||v===1||v==='1'||v==='true'||v==='amrap'||v==='AMRAP';
}
window.isAmrapFlag=isAmrapFlag;

function setKindOf(s){
  return(s&&s.kind)||'work';
}
window.setKindOf=setKindOf;

function isWorkingSet(s){
  const k=setKindOf(s);
  return k==='work'||k==='amrap';
}
window.isWorkingSet=isWorkingSet;

function setKindBadge(kind){
  if(kind==='warmup')return 'W';
  if(kind==='drop')return 'D';
  if(kind==='amrap')return '+';
  return '';
}
window.setKindBadge=setKindBadge;

function formatSetKindTag(ex){
  const p=ex&&typeof ex==='object'?ex:{};
  const bits=[];
  const inSs=!!String(p.ss||'').trim();
  const wu=inSs?0:parseSetKindCount(p.wu,2);
  const dr=inSs?0:parseSetKindCount(p.drop,2);
  if(wu)bits.push('WU'+wu);
  if(isAmrapFlag(p.amrap))bits.push('AMRAP');
  if(dr)bits.push('DROP'+dr);
  return bits.join(' ');
}
window.formatSetKindTag=formatSetKindTag;

function scaleKg(kg,frac){
  const n=parseFloat(kg);
  if(!Number.isFinite(n)||n<=0)return kg||'';
  return roundToPlate(n*frac)||String(n);
}
window.scaleKg=scaleKg;

function expandExerciseSets(ex,opts){
  opts=opts||{};
  const last=opts.last;
  const plannedKg=opts.plannedKg||'';
  const lockPct=!!opts.lockPct;
  const defaultReps=ex.reps||'10';
  const inSs=!!String(ex.ss||'').trim();
  const nWork=Math.max(1,parseInt(ex.sets,10)||3);
  const nWu=inSs?0:parseSetKindCount(ex.wu,2);
  const nDrop=inSs?0:parseSetKindCount(ex.drop,2);
  const amrap=isAmrapFlag(ex.amrap);
  const lastWork=((last&&last.sets)||[]).filter(isWorkingSet);
  const sets=[];
  let no=1;
  const wuFrac=nWu===1?[0.6]:[0.5,0.7];
  for(let i=0;i<nWu;i++){
    sets.push({setNo:no++,kg:scaleKg(plannedKg,wuFrac[i])||'',reps:defaultReps,done:false,kind:'warmup'});
  }
  for(let i=0;i<nWork;i++){
    const kind=(amrap&&i===nWork-1)?'amrap':(!inSs&&isEmomFlag(ex.emom)?'emom':'work');
    const prev=lastWork[i];
    let kg=plannedKg;
    if(!lockPct&&prev&&prev.kg!=null&&prev.kg!=='')kg=String(prev.kg);
    let reps='';
    if(kind!=='amrap'){
      reps=prev&&prev.reps!=null&&prev.reps!==''?String(prev.reps):defaultReps;
    }
    sets.push({setNo:no++,kg:kg||'',reps,done:false,kind});
  }
  const dropFrac=nDrop===1?[0.75]:[0.8,0.6];
  for(let i=0;i<nDrop;i++){
    sets.push({setNo:no++,kg:scaleKg(plannedKg,dropFrac[i])||'',reps:defaultReps,done:false,kind:'drop'});
  }
  return sets;
}
window.expandExerciseSets=expandExerciseSets;

function skipRestBeforeSet(next){
  return!!(next&&next.kind==='drop');
}
window.skipRestBeforeSet=skipRestBeforeSet;

function restSecAfterSet(ex,st,next){
  if(next&&next.kind==='drop')return 0;
  if(st&&st.kind==='warmup')return Math.min(45,(ex&&ex.restSec)||90);
  return(ex&&ex.restSec)||90;
}
window.restSecAfterSet=restSecAfterSet;

function isEmomFlag(v){
  return v===true||v===1||v==='1'||v==='true'||v==='emom'||v==='EMOM';
}
window.isEmomFlag=isEmomFlag;

function isEmomExercise(ex){
  if(!ex)return false;
  if(String(ex.ss||'').trim())return false;
  return isEmomFlag(ex.emom);
}
window.isEmomExercise=isEmomExercise;

/** Po N-tej skończonej rundzie: ile sekund do N×60 od startu zegara EMOM. */
function emomRestSec(doneCount,elapsedSec){
  const n=Math.max(1,parseInt(doneCount,10)||1);
  const elapsed=Number(elapsedSec)||0;
  const wait=n*60-elapsed;
  return wait>0?Math.ceil(wait):0;
}
window.emomRestSec=emomRestSec;

function applySsLabels(list){
  let n=0;
  let i=0;
  while(i<(list||[]).length){
    const g=String(list[i].ss||'').trim();
    if(!g){
      list[i].ss='';list[i].ssLabel='';list[i].ssLetter='';
      i++;continue;
    }
    let j=i+1;
    while(j<list.length&&String(list[j].ss||'').trim()===g)j++;
    if(j-i<2){
      list[i].ss='';list[i].ssLabel='';list[i].ssLetter='';
      i++;continue;
    }
    const letter=String.fromCharCode(65+(n%26));
    n++;
    for(let k=i;k<j;k++){
      list[k].ss=letter;
      list[k].ssLetter=letter;
      list[k].ssLabel=letter+(k-i+1);
    }
    i=j;
  }
  return list;
}
window.applySsLabels=applySsLabels;

function ssGroupIdxs(list,idx){
  const g=list&&list[idx]&&String(list[idx].ss||'').trim();
  if(!g)return[idx];
  const out=[];
  for(let i=0;i<list.length;i++) if(String(list[i].ss||'').trim()===g) out.push(i);
  return out.length>=2?out:[idx];
}
window.ssGroupIdxs=ssGroupIdxs;

function ssDoneCount(ex){return ((ex&&ex.sets)||[]).filter(s=>s&&s.done).length;}
function ssHasRemain(ex){return ((ex&&ex.sets)||[]).some(s=>s&&!s.done);}

function ssNextAfterSet(list,idx){
  if(!list||!list[idx])return{kind:'advance'};
  const group=ssGroupIdxs(list,idx);
  const myDone=ssDoneCount(list[idx]);
  if(group.length>=2){
    const pos=group.indexOf(idx);
    for(let k=1;k<group.length;k++){
      const j=group[(pos+k)%group.length];
      if(ssDoneCount(list[j])<myDone)return{kind:'partner',exIdx:j};
    }
    const leftover=group.find(i=>ssHasRemain(list[i]));
    if(leftover!=null)return{kind:'rest',exIdx:leftover};
    return{kind:'advance'};
  }
  if(ssHasRemain(list[idx]))return{kind:'rest',exIdx:idx};
  return{kind:'advance'};
}
window.ssNextAfterSet=ssNextAfterSet;

function ssAdvanceIdx(list,idx){
  const group=ssGroupIdxs(list,idx);
  const last=group[group.length-1];
  const n=last+1;
  return list&&n<list.length?n:-1;
}
window.ssAdvanceIdx=ssAdvanceIdx;

function formatPlanExerciseLine(ex,clientId){
  const p=parsePlanExercise(ex);
  if(ex&&typeof ex==='object'&&ex.ssLabel)p.ssLabel=ex.ssLabel;
  let kgPart='';
  if(p.pct1rm){
    const w=weightFromPct1RM(clientId,p.name,p.pct1rm);
    kgPart=w.kg?(' @'+p.pct1rm+'% → '+w.kg+'kg'):(' @'+p.pct1rm+'%');
  }else if(p.kg){
    kgPart=' @'+p.kg+'kg';
  }
  const tag=formatSetKindTag(p);
  const emom=isEmomFlag(p.emom)&&!p.ss?' EMOM':'';
  return(p.ssLabel?p.ssLabel+' ':'')+(p.name||'')+(p.sets?' '+p.sets+'×'+p.reps:'')+kgPart+(tag?' '+tag:'')+emom;
}
window.formatPlanExerciseLine=formatPlanExerciseLine;

function formatDayExerciseParts(exercises,clientId){
  const list=(exercises||[]).map(e=>parsePlanExercise(e));
  applySsLabels(list);
  const parts=[];
  let i=0;
  while(i<list.length){
    const line=p=>formatPlanExerciseLine(p,clientId);
    if(list[i].ss&&i+1<list.length&&list[i+1].ss===list[i].ss){
      const chunk=[];
      const g=list[i].ss;
      while(i<list.length&&list[i].ss===g){chunk.push(line(list[i]));i++;}
      parts.push(chunk.join(' + '));
    }else{
      parts.push(line(list[i]));
      i++;
    }
  }
  return parts.filter(Boolean);
}
window.formatDayExerciseParts=formatDayExerciseParts;

function formatDayExerciseLines(exercises,clientId){
  return formatDayExerciseParts(exercises,clientId).join(' · ');
}
window.formatDayExerciseLines=formatDayExerciseLines;

function altsForExercise(name,explicit){
  const fromPlan=String(explicit||'').split(/[,;/|]/).map(s=>s.trim()).filter(Boolean);
  if(fromPlan.length)return fromPlan;
  const hit=typeof libExerciseByName==='function'?libExerciseByName(name):null;
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

/** Dodaje dni do daty YYYY-MM-DD (południe, bez przesunięcia UTC). */
function ymdAdd(ymd,days){
  const p=String(ymd||'').slice(0,10);
  const d=new Date(p+'T12:00:00');
  if(isNaN(d.getTime()))return '';
  d.setDate(d.getDate()+(Number(days)||0));
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
window.ymdAdd=ymdAdd;

function isHabit(t){
  if(!t||t.kind==='challenge')return false;
  return t.kind==='habit'||t.repeat==='daily';
}
window.isHabit=isHabit;

function isChallenge(t){
  return !!(t&&t.kind==='challenge');
}
window.isChallenge=isChallenge;

function isHomework(t){
  return !!(t&&(t.kind==='homework'||t.odWorkoutId||t.odProgramId));
}
window.isHomework=isHomework;

function openHomeworkTasks(tasks){
  const live=new Set((window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>c.id));
  return(tasks||window.TASKS||[]).filter(t=>t&&isHomework(t)&&t.status!=='done'&&t.clientId&&(!live.size||live.has(t.clientId)))
    .slice()
    .sort((a,b)=>{
      const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
      const ao=a.due&&a.due<today?0:1;
      const bo=b.due&&b.due<today?0:1;
      if(ao!==bo)return ao-bo;
      return String(a.due||'9999').localeCompare(String(b.due||'9999'));
    });
}
window.openHomeworkTasks=openHomeworkTasks;

function clientOpenHomework(clientId,tasks){
  if(!clientId)return[];
  return openHomeworkTasks(tasks).filter(t=>t.clientId===clientId);
}
window.clientOpenHomework=clientOpenHomework;

/** Nawyki aktywnych klientów nieodhachowane dziś (dłuższy streak na górze). */
function pendingHabitTasks(tasks,today){
  today=today||(typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10));
  const live=new Set((window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>c.id));
  return(tasks||window.TASKS||[]).filter(t=>t&&isHabit(t)&&t.clientId&&(!live.size||live.has(t.clientId))&&!habitDoneOn(t,today))
    .slice()
    .sort((a,b)=>habitStreak(b,today)-habitStreak(a,today)||String(a.title||'').localeCompare(String(b.title||''),'pl'));
}
window.pendingHabitTasks=pendingHabitTasks;

/** Aktywne wyzwania bez odhaczenia dziś. */
function pendingChallengeTasks(tasks,today){
  today=today||(typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10));
  const live=new Set((window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>c.id));
  return(tasks||window.TASKS||[]).filter(t=>{
    if(!t||!isChallenge(t)||!t.clientId||(live.size&&!live.has(t.clientId)))return false;
    const p=challengeProgress(t,today);
    return p.active&&!p.won&&!habitDoneOn(t,today);
  }).slice().sort((a,b)=>{
    const pa=challengeProgress(a,today),pb=challengeProgress(b,today);
    return(pa.pct||0)-(pb.pct||0)||String(a.title||'').localeCompare(String(b.title||''),'pl');
  });
}
window.pendingChallengeTasks=pendingChallengeTasks;

function clientPendingHabits(clientId,tasks,today){
  if(!clientId)return[];
  return pendingHabitTasks(tasks,today).filter(t=>t.clientId===clientId)
    .concat(pendingChallengeTasks(tasks,today).filter(t=>t.clientId===clientId));
}
window.clientPendingHabits=clientPendingHabits;

function isOneShot(t){
  return !!(t&&!isHabit(t)&&!isChallenge(t)&&!isHomework(t));
}
window.isOneShot=isOneShot;

function habitDoneOn(t,ymd){
  return !!(t&&ymd&&(t.doneDates||[]).includes(ymd));
}
window.habitDoneOn=habitDoneOn;

/** Ciąg dni kończący się dziś albo wczoraj (dziś jeszcze nie odhaczone). */
function habitStreak(t,today){
  const set=new Set((t&&t.doneDates)||[]);
  let start=today;
  if(!set.has(today)){
    const y=ymdAdd(today,-1);
    if(!set.has(y))return 0;
    start=y;
  }
  let n=0,d=start;
  while(set.has(d)){
    n++;
    d=ymdAdd(d,-1);
    if(n>4000)break;
  }
  return n;
}
window.habitStreak=habitStreak;

function toggleHabitDay(t,ymd){
  if(!t||!ymd)return t;
  const dates=[...(t.doneDates||[])];
  const i=dates.indexOf(ymd);
  if(i>=0)dates.splice(i,1);
  else dates.push(ymd);
  dates.sort();
  t.doneDates=dates;
  t.status='open';
  t.due='';
  t.kind='habit';
  t.repeat='daily';
  t.updatedAt=new Date().toISOString();
  return t;
}
window.toggleHabitDay=toggleHabitDay;

function habitWeek(t,today){
  const days=[];
  for(let i=6;i>=0;i--){
    const ymd=ymdAdd(today,-i);
    days.push({ymd,done:habitDoneOn(t,ymd),today:ymd===today});
  }
  return days;
}
window.habitWeek=habitWeek;

function habitWeekHtml(t,today){
  return `<div class="habit-week">${habitWeek(t,today).map(d=>`<span class="habit-dot${d.done?' on':''}${d.today?' today':''}" title="${d.ymd}"></span>`).join('')}</div>`;
}
window.habitWeekHtml=habitWeekHtml;

/** Biblioteka z progress-nawyki: fazy dnia + XP. */
const HABIT_LIBRARY=[
  {id:'m1',phase:'morning',phaseLabel:'🌅 Poranek',name:'Wstań bez odkładania alarmu',meta:'W ciągu 5 min od budzika',xp:15,cat:'lifestyle',emoji:'⏰'},
  {id:'m2',phase:'morning',name:'Szklanka wody',meta:'Nawodnienie przed kawą',xp:5,cat:'lifestyle',emoji:'💧'},
  {id:'m3',phase:'morning',name:'5 min planowania dnia',meta:'3 priorytety na dziś',xp:10,cat:'lifestyle',emoji:'📝'},
  {id:'mv1',phase:'move',phaseLabel:'🏃 Ruch',name:'Trening / aktywność fizyczna',meta:'Min. 30 min',xp:25,cat:'trening',emoji:'🏋️'},
  {id:'mv2',phase:'move',name:'10 000 kroków',meta:'Rozbij na kilka wyjść',xp:10,cat:'trening',emoji:'🚶'},
  {id:'n1',phase:'nutrition',phaseLabel:'🥗 Odżywianie',name:'Zdrowe śniadanie',meta:'Białko + warzywa',xp:10,cat:'dieta',emoji:'🍳'},
  {id:'n2',phase:'nutrition',name:'Bez cukru / słodyczy',meta:'Zero przetworzonego cukru',xp:15,cat:'dieta',emoji:'🚫'},
  {id:'n3',phase:'nutrition',name:'2L wody',meta:'Przez cały dzień',xp:10,cat:'dieta',emoji:'💧'},
  {id:'f1',phase:'focus',phaseLabel:'📚 Fokus',name:'Czytanie — min. 20 stron',meta:'Książka, nie social media',xp:20,cat:'lifestyle',emoji:'📖'},
  {id:'f2',phase:'focus',name:'Nauka języka — 15 min',meta:'Aplikacja lub kurs',xp:15,cat:'lifestyle',emoji:'🗣️'},
  {id:'f3',phase:'focus',name:'Bez telefonu przez 2h',meta:'Brak powiadomień',xp:15,cat:'lifestyle',emoji:'📵'},
  {id:'s1',phase:'social',phaseLabel:'👨‍👧 Rodzina',name:'Czas z dziećmi — 30 min',meta:'Bez telefonu, pełna obecność',xp:25,cat:'lifestyle',emoji:'👨‍👧'},
  {id:'e1',phase:'evening',phaseLabel:'🌙 Wieczór',name:'Przegląd dnia — 5 min',meta:'Co poszło? Co zmienić?',xp:10,cat:'lifestyle',emoji:'🪞'},
  {id:'e2',phase:'evening',name:'Sen przed 23:00',meta:'Min. 7h snu',xp:15,cat:'lifestyle',emoji:'😴'},
];
window.HABIT_LIBRARY=HABIT_LIBRARY;

const HABIT_PHASE_ORDER=['morning','move','nutrition','focus','social','evening'];
window.HABIT_PHASE_ORDER=HABIT_PHASE_ORDER;

function habitLibraryById(id){
  return HABIT_LIBRARY.find(h=>h.id===id)||null;
}
window.habitLibraryById=habitLibraryById;

function habitPhaseLabel(phase){
  const hit=HABIT_LIBRARY.find(h=>h.phase===phase&&h.phaseLabel);
  return hit?hit.phaseLabel:phase||'';
}
window.habitPhaseLabel=habitPhaseLabel;

function habitXpOf(t){
  const n=Number(t&&t.xp);
  if(n>0)return n;
  const lib=t&&t.libId?habitLibraryById(t.libId):null;
  return lib?Number(lib.xp)||0:10;
}
window.habitXpOf=habitXpOf;

/** XP z odhaczeń nawyków klienta (suma doneDates × xp). */
function clientHabitXpTotal(clientId,tasks){
  const list=(tasks||window.TASKS||[]).filter(t=>t&&t.clientId===clientId&&isHabit(t));
  let xp=0;
  list.forEach(t=>{
    const per=habitXpOf(t);
    xp+=((t.doneDates||[]).length)*per;
  });
  return xp;
}
window.clientHabitXpTotal=clientHabitXpTotal;

function clientHabitBestStreak(clientId,tasks,today){
  today=today||(typeof todayYmd==='function'?todayYmd():'');
  const list=(tasks||window.TASKS||[]).filter(t=>t&&t.clientId===clientId&&isHabit(t));
  if(!list.length)return 0;
  return Math.max(...list.map(t=>habitStreak(t,today)),0);
}
window.clientHabitBestStreak=clientHabitBestStreak;

function habitTaskFromLibrary(lib,clientId){
  const h=typeof lib==='string'?habitLibraryById(lib):lib;
  if(!h||!clientId)return null;
  const base={
    id:typeof newId==='function'?newId('t'):('t_'+Date.now()),
    title:h.name,
    clientId,
    due:'',
    priority:'medium',
    cat:h.cat||'lifestyle',
    desc:h.meta||'',
    status:'open',
    kind:'habit',
    repeat:'daily',
    doneDates:[],
    libId:h.id,
    phase:h.phase,
    emoji:h.emoji||'🔥',
    xp:Number(h.xp)||10,
    meta:h.meta||'',
    createdAt:new Date().toISOString()
  };
  return typeof withTrainer==='function'?withTrainer(base):base;
}
window.habitTaskFromLibrary=habitTaskFromLibrary;

async function assignHabitLibraryToClient(clientId,libIds){
  if(!clientId){if(typeof notify==='function')notify('Wybierz klienta!');return 0;}
  const ids=libIds&&libIds.length?libIds:HABIT_LIBRARY.map(h=>h.id);
  const existing=(window.TASKS||[]).filter(t=>t&&t.clientId===clientId&&isHabit(t));
  const haveLib=new Set(existing.map(t=>t.libId).filter(Boolean));
  const haveTitle=new Set(existing.map(t=>String(t.title||'').toLowerCase()));
  let n=0;
  for(const id of ids){
    const lib=habitLibraryById(id);if(!lib)continue;
    if(haveLib.has(lib.id)||haveTitle.has(String(lib.name).toLowerCase()))continue;
    const task=habitTaskFromLibrary(lib,clientId);if(!task)continue;
    (window.TASKS||(window.TASKS=[])).push(task);
    if(typeof persistById==='function')await persistById('tasks',task);
    haveLib.add(lib.id);haveTitle.add(String(lib.name).toLowerCase());n++;
  }
  return n;
}
window.assignHabitLibraryToClient=assignHabitLibraryToClient;

function onHabitToggle(){
  const h=document.getElementById('task-habit');
  const c=document.getElementById('task-challenge');
  if(h&&h.checked&&c)c.checked=false;
  syncTaskKindUi();
}
window.onHabitToggle=onHabitToggle;

function onChallengeToggle(){
  const h=document.getElementById('task-habit');
  const c=document.getElementById('task-challenge');
  if(c&&c.checked&&h)h.checked=false;
  syncTaskKindUi();
}
window.onChallengeToggle=onChallengeToggle;

function syncTaskKindUi(){
  const habit=!!document.getElementById('task-habit')?.checked;
  const ch=!!document.getElementById('task-challenge')?.checked;
  const due=document.getElementById('task-due-wrap');
  const wrap=document.getElementById('task-ch-wrap');
  if(due)due.style.display=(habit||ch)?'none':'';
  if(wrap)wrap.style.display=ch?'':'none';
  if(ch){
    const start=document.getElementById('task-ch-start');
    if(start&&!start.value)start.value=typeof todayYmd==='function'?todayYmd():'';
    paintChallengeDays();
  }
}
window.syncTaskKindUi=syncTaskKindUi;

function parseChallengeDays(v){
  const n=parseInt(v,10);
  if(n===7||n===14||n===21||n===30)return n;
  if(n>=2&&n<=90)return n;
  return 21;
}
window.parseChallengeDays=parseChallengeDays;

function parseChallengeTarget(t){
  const days=parseChallengeDays(t&&t.days);
  const n=parseInt(t&&t.target,10);
  if(n>=1&&n<=days)return n;
  return days;
}
window.parseChallengeTarget=parseChallengeTarget;

function challengeBounds(t){
  const days=parseChallengeDays(t&&t.days);
  const start=String((t&&t.start)||'').slice(0,10);
  return{start,end:start?ymdAdd(start,days-1):'',days};
}
window.challengeBounds=challengeBounds;

function challengeProgress(t,today){
  today=today||(typeof todayYmd==='function'?todayYmd():'');
  const days=parseChallengeDays(t&&t.days);
  const start=String((t&&t.start)||today||'').slice(0,10);
  const end=start?ymdAdd(start,days-1):'';
  const target=parseChallengeTarget({days,target:t&&t.target});
  const done=((t&&t.doneDates)||[]).filter(d=>start&&end&&d>=start&&d<=end).length;
  const pct=target?Math.min(100,Math.round(done/target*100)):0;
  const before=!!(today&&start&&today<start);
  const after=!!(today&&end&&today>end);
  const active=!!(today&&start&&end&&!before&&!after);
  const won=done>=target;
  const lost=after&&!won;
  let left=0;
  if(before)left=days;
  else if(active&&today&&end){
    let d=today;
    while(d<=end&&left<400){left++;d=ymdAdd(d,1);}
  }
  return{start,end,days,target,done,pct,before,after,active,won,lost,left};
}
window.challengeProgress=challengeProgress;

function challengeCanCheck(t,ymd,today){
  today=today||(typeof todayYmd==='function'?todayYmd():'');
  const p=challengeProgress(t,today);
  if(!ymd||!p.start||!p.end)return false;
  if(ymd<p.start||ymd>p.end)return false;
  if(today&&ymd>today)return false;
  return true;
}
window.challengeCanCheck=challengeCanCheck;

function challengeVisible(t,today){
  today=today||(typeof todayYmd==='function'?todayYmd():'');
  const p=challengeProgress(t,today);
  if(!p.end||!today)return true;
  return today<=ymdAdd(p.end,7);
}
window.challengeVisible=challengeVisible;

function toggleChallengeDay(t,ymd,today){
  if(!t||!ymd)return t;
  if(!challengeCanCheck(t,ymd,today))return t;
  const dates=[...(t.doneDates||[])];
  const i=dates.indexOf(ymd);
  if(i>=0)dates.splice(i,1);
  else dates.push(ymd);
  dates.sort();
  t.doneDates=dates;
  t.status='open';
  t.kind='challenge';
  delete t.repeat;
  t.updatedAt=new Date().toISOString();
  return t;
}
window.toggleChallengeDay=toggleChallengeDay;

function challengeStatusText(t,today){
  const p=challengeProgress(t,today);
  if(p.won)return '🏆 '+p.done+'/'+p.target+' — ukończone';
  if(p.lost)return p.done+'/'+p.target+' — czas minął';
  if(p.before)return 'Start '+p.start;
  return p.done+'/'+p.target+' · jeszcze '+p.left+' '+(p.left===1?'dzień':'dni');
}
window.challengeStatusText=challengeStatusText;

function challengeBarHtml(t,today){
  const p=challengeProgress(t,today);
  const col=p.won?'var(--teal)':p.lost?'var(--muted2)':'var(--gold)';
  return `<div class="ch-bar"><div class="ch-bar-fill" style="width:${p.pct}%;background:${col};"></div></div>`;
}
window.challengeBarHtml=challengeBarHtml;

function setChallengeDays(n){
  const days=parseChallengeDays(n);
  const el=document.getElementById('task-ch-days');
  if(el)el.value=String(days);
  const tgt=document.getElementById('task-ch-target');
  if(tgt){
    const cur=parseInt(tgt.value,10);
    if(!cur||cur>days)tgt.value=String(days);
  }
  paintChallengeDays();
}
window.setChallengeDays=setChallengeDays;

function paintChallengeDays(){
  const cur=String((document.getElementById('task-ch-days')||{}).value||'21');
  document.querySelectorAll('.ch-days-btn').forEach(b=>b.classList.toggle('on',b.getAttribute('data-d')===cur));
}
window.paintChallengeDays=paintChallengeDays;

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

/** Sesja z kalendarza (source=planned) na dany dzień — dayIdx z planu. */
function plannedSessionForDate(clientId,planId,dateYmd){
  if(!clientId||!planId)return null;
  const day=dateYmd||(typeof todayYmd==='function'?todayYmd():'');
  if(!day)return null;
  const list=(window.SE||[]).filter(s=>s&&s.clientId===clientId&&s.planId===planId&&s.date===day&&s.source==='planned'&&s.dayIdx!=null)
    .sort((a,b)=>(a.time||'').localeCompare(b.time||'')||(a.createdAt||'').localeCompare(b.createdAt||''));
  return list[0]||null;
}
window.plannedSessionForDate=plannedSessionForDate;

function suggestedPlanDayIdx(clientId,plan){
  if(!plan||!plan.days||!plan.days.length)return 0;
  const train=planTrainingDayIdxs(plan);
  if(!train.length)return 0;
  // Kalendarz: jeśli dziś jest zaplanowana sesja z tego planu — bierz jej dayIdx (Live / Today).
  const today=typeof todayYmd==='function'?todayYmd():'';
  const planned=plannedSessionForDate(clientId,plan.id,today);
  if(planned){
    const idx=Number(planned.dayIdx);
    if(train.indexOf(idx)>=0)return idx;
  }
  if(plan.days.length===7)return(new Date().getDay()+6)%7;
  const past=(window.SE||[]).filter(s=>s.clientId===clientId&&s.planId===plan.id&&s.dayIdx!=null&&(s.source==='live'||s.source==='client'))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!past.length)return train[0];
  // Zawsze kolejny dzień treningowy po ostatniej sesji (także gdy była dziś) —
  // Live „Kolejny dzień” i rotacja PPL. Widok „dziś zrobione” w portalu nadpisuje dayIdx osobno.
  const lastIdx=Number(past[0].dayIdx);
  const pos=train.indexOf(lastIdx);
  if(pos<0)return train[0];
  return train[(pos+1)%train.length];
}
window.suggestedPlanDayIdx=suggestedPlanDayIdx;

function lastLoadForExercise(clientId,name){
  if(!clientId||!name)return null;
  const key=exerciseNameKey(name);
  const sessions=(window.SE||[]).filter(s=>s.clientId===clientId&&Array.isArray(s.exercises))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
  for(const s of sessions){
    const ex=(s.exercises||[]).find(e=>exerciseNameKey(e.name)===key);
    if(!ex)continue;
    const sets=(ex.sets||[]).filter(x=>x&&(x.kg||x.reps));
    if(!sets.length)continue;
    const last=sets[sets.length-1];
    return{kg:last.kg,reps:last.reps,sets};
  }
  return null;
}
window.lastLoadForExercise=lastLoadForExercise;

function exerciseNameKey(name){
  return String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
}
window.exerciseNameKey=exerciseNameKey;

function formatSetLoad(kg,reps){
  const k=(kg==null||kg==='')?'—':String(kg);
  const r=(reps==null||reps==='')?'—':String(reps);
  return k+' kg × '+r;
}
window.formatSetLoad=formatSetLoad;

function loggedSetRows(clientId,name,sessions){
  const key=exerciseNameKey(name);
  if(!clientId||!key)return [];
  const rows=[];
  (sessions||window.SE||[]).forEach(s=>{
    if(!s||s.clientId!==clientId)return;
    (s.exercises||[]).forEach(ex=>{
      if(exerciseNameKey(ex.name)!==key)return;
      (ex.sets||[]).forEach(st=>{
        const est=epley1RM(st&&st.kg,st&&st.reps);
        if(est==null)return;
        rows.push({
          date:s.date||'',
          createdAt:s.createdAt||'',
          sessionId:s.id,
          name:ex.name,
          kg:parseFloat(st.kg),
          reps:parseFloat(st.reps),
          setNo:st.setNo||0,
          epley:est
        });
      });
    });
  });
  return rows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||'')||(b.setNo||0)-(a.setNo||0));
}
window.loggedSetRows=loggedSetRows;

function exercisePR(clientId,name,sessions){
  const rows=loggedSetRows(clientId,name,sessions);
  if(!rows.length)return null;
  return rows.reduce((best,row)=>row.epley>(best.epley||0)?row:best);
}
window.exercisePR=exercisePR;

function setBeatsPR(pr,kg,reps){
  const est=epley1RM(kg,reps);
  if(est==null||!pr||pr.epley==null)return false;
  return est>pr.epley+0.05;
}
window.setBeatsPR=setBeatsPR;

function prToastText(clientId,name,kg,reps,sessions){
  const prev=exercisePR(clientId,name,sessions);
  if(!setBeatsPR(prev,kg,reps))return '';
  return '🏆 Rekord: '+name+' · '+formatSetLoad(kg,reps);
}
window.prToastText=prToastText;

function superseriesToastText(nextEx,opts){
  const ex=nextEx&&typeof nextEx==='object'?nextEx:{name:nextEx};
  opts=opts||{};
  const ss='Super-seria → '+(ex&&ex.ssLabel?ex.ssLabel+' ':'')+(ex&&ex.name?ex.name:'')+(opts.noRest?' (bez przerwy)':'');
  return opts.prMsg?(opts.prMsg+' · '+ss):ss;
}
window.superseriesToastText=superseriesToastText;

function clientExercisePRs(clientId,sessions){
  const names=new Map();
  (sessions||window.SE||[]).forEach(s=>{
    if(!s||s.clientId!==clientId)return;
    (s.exercises||[]).forEach(ex=>{
      const key=exerciseNameKey(ex.name);
      if(key&&!names.has(key))names.set(key,ex.name);
    });
  });
  const prs=[];
  names.forEach(name=>{
    const pr=exercisePR(clientId,name,sessions);
    if(pr)prs.push(Object.assign({name},pr));
  });
  return prs.sort((a,b)=>b.epley-a.epley);
}
window.clientExercisePRs=clientExercisePRs;

function exerciseHistoryByDay(clientId,name,sessions){
  const rows=loggedSetRows(clientId,name,sessions);
  const map={};
  const days=[];
  rows.forEach(r=>{
    const d=r.date||'';
    if(!map[d]){
      map[d]={date:d,sets:[],best:r};
      days.push(map[d]);
    }
    map[d].sets.push(r);
    if(r.epley>map[d].best.epley)map[d].best=r;
  });
  return days;
}
window.exerciseHistoryByDay=exerciseHistoryByDay;

function mapPlanExercisesForClient(rawEx,clientId){
  const mapped=(rawEx||[]).map(raw=>{
    const ex=parsePlanExercise(raw);
    const last=lastLoadForExercise(clientId,ex.name);
    const rest=parseRestSeconds(ex.rest);
    const pct=ex.pct1rm||'';
    const fromPct=pct?weightFromPct1RM(clientId,ex.name,pct):null;
    const plannedKg=(fromPct&&fromPct.kg)?fromPct.kg:(ex.kg||'');
    const lockPct=!!pct;
    const emom=isEmomExercise(ex);
    const coach=typeof resolveCoachMedia==='function'?resolveCoachMedia(ex):{video:'',videoEmbed:'',isFile:false};
    const sets=expandExerciseSets(ex,{last,plannedKg,lockPct});
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
      ss:ex.ss||'',
      wu:ex.ss?0:(ex.wu||0),
      drop:ex.ss?0:(ex.drop||0),
      amrap:!!ex.amrap,
      emom,
      note:coach.note||'',
      libTip:coach.libTip||'',
      planNote:coach.note||'',
      planVideo:normalizeCoachVideoUrl(ex.video||''),
      video:coach.video||'',
      videoEmbed:coach.videoEmbed||'',
      isFile:!!coach.isFile,
      gif:coach.gif||'',
      img:coach.img||'',
      sets
    };
  });
  return applySsLabels(mapped);
}
window.mapPlanExercisesForClient=mapPlanExercisesForClient;

window.PROGRESS_PHOTOS=window.PROGRESS_PHOTOS||[];

function ppFeatureOn(c){
  if(!c)return true;
  const s=c.clientSettings||{};
  return s.progressPhoto!==false;
}
window.ppFeatureOn=ppFeatureOn;

/** Per-client: masa / obwody / Garmin w Progress (domyślnie ON). */
function bmFeatureOn(c){
  if(!c)return true;
  const s=c.clientSettings||{};
  return s.bodyMetrics!==false;
}
window.bmFeatureOn=bmFeatureOn;

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

const SESSION_RATING={
  1:{emoji:'😓',label:'Bardzo ciężko'},
  2:{emoji:'😐',label:'Ciężko'},
  3:{emoji:'🙂',label:'OK'},
  4:{emoji:'💪',label:'Dobre'},
  5:{emoji:'🔥',label:'Świetne'}
};
window.SESSION_RATING=SESSION_RATING;

function sessionRatingEmoji(n){
  const r=SESSION_RATING[Number(n)];
  return r?r.emoji:'';
}
window.sessionRatingEmoji=sessionRatingEmoji;

function sessionRatingLabel(n){
  const r=SESSION_RATING[Number(n)];
  return r?(r.emoji+' '+r.label):'';
}
window.sessionRatingLabel=sessionRatingLabel;

function isLoggedWorkout(s){
  if(!s)return false;
  if(s.source==='planned'||s.source==='garmin')return false;
  if(s.source==='client'||s.source==='live')return true;
  return Array.isArray(s.exercises)&&s.exercises.length>0;
}
window.isLoggedWorkout=isLoggedWorkout;

function completedWorkouts(clientId,sessions){
  return(sessions||window.SE||[]).filter(s=>s&&s.clientId===clientId&&isLoggedWorkout(s))
    .slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
}
window.completedWorkouts=completedWorkouts;

function sessionSetsCount(s){
  if(!s||!s.exercises)return 0;
  return s.exercises.reduce((n,e)=>{
    if(Array.isArray(e.sets))return n+e.sets.length;
    const k=parseInt(e.sets,10);
    return n+(Number.isFinite(k)?k:0);
  },0);
}
window.sessionSetsCount=sessionSetsCount;

function avgSessionRating(sessions){
  const nums=(sessions||[]).map(s=>Number(s.feedback)).filter(n=>n>=1&&n<=5);
  if(!nums.length)return 0;
  return Math.round((nums.reduce((a,b)=>a+b,0)/nums.length)*10)/10;
}
window.avgSessionRating=avgSessionRating;

function sessionTitle(s){
  if(s&&s.source==='garmin')return s.notes||s.type||s.title||'Garmin';
  return (s&&(s.type||s.title))||'Trening';
}
window.sessionTitle=sessionTitle;

function sessionSourceLabel(s){
  if(!s)return '';
  if(s.source==='garmin')return 'Garmin';
  if(s.source==='client')return 'Klient';
  if(s.source==='live')return 'Live';
  if(s.source==='planned')return 'Plan';
  return 'Sala';
}
window.sessionSourceLabel=sessionSourceLabel;

function snapshotFormQuestions(form){
  return((form&&form.questions)||[]).map(q=>({
    id:q.id,type:q.type,text:q.text,required:!!q.required,
    options:Array.isArray(q.options)?q.options.slice():undefined
  }));
}
window.snapshotFormQuestions=snapshotFormQuestions;

function formQuestionsForSend(send,forms){
  if(send&&Array.isArray(send.questions)&&send.questions.length)return send.questions;
  const list=forms||(typeof allForms==='function'?allForms():[]);
  const f=list.find(x=>x&&send&&x.id===send.formId);
  return(f&&f.questions)||[];
}
window.formQuestionsForSend=formQuestionsForSend;

function formSendAnswersMap(send){
  const a=send&&send.answers;
  if(!a)return{};
  if(!Array.isArray(a))return a;
  const m={};
  a.forEach((item,i)=>{
    if(item&&typeof item==='object'&&item.id!=null)m[item.id]=item.value;
    else if(item!=null&&item!=='')m['q'+(i+1)]=item;
  });
  return m;
}
window.formSendAnswersMap=formSendAnswersMap;

function formatFormAnswer(q,val){
  if(val==null||String(val).trim()==='')return '—';
  const v=String(val);
  if(q&&q.type==='yesno'){
    if(v==='tak'||v==='true'||v==='Tak'||v==='1')return 'Tak';
    if(v==='nie'||v==='false'||v==='Nie'||v==='0')return 'Nie';
  }
  return v;
}
window.formatFormAnswer=formatFormAnswer;

function missingRequiredFormAnswers(questions,answers){
  const map=answers&&!Array.isArray(answers)?answers:{};
  return(questions||[]).filter(q=>q&&q.required&&(map[q.id]==null||String(map[q.id]).trim()===''));
}
window.missingRequiredFormAnswers=missingRequiredFormAnswers;

function pendingFormSends(clientId,sends){
  return(sends||window.FORM_SENDS||[]).filter(s=>s&&s.clientId===clientId&&s.status!=='filled');
}
window.pendingFormSends=pendingFormSends;

function allPendingFormSends(sends){
  const list=sends||window.FORM_SENDS||[];
  const live=new Set((window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>c.id));
  return list.filter(s=>s&&s.status!=='filled'&&s.clientId&&(!live.size||live.has(s.clientId)))
    .slice()
    .sort((a,b)=>String(b.sentAtIso||b.createdAt||'').localeCompare(String(a.sentAtIso||a.createdAt||'')));
}
window.allPendingFormSends=allPendingFormSends;

function defaultIntakeForm(){
  const forms=typeof allForms==='function'?allForms():[];
  return forms.find(f=>f&&f.id==='df1')
    ||forms.find(f=>f&&String(f.cat||'').includes('wstepna'))
    ||forms.find(f=>f&&/wst[eę]p|ankieta|intake|onboard/i.test(String(f.name||'')))
    ||null;
}
window.defaultIntakeForm=defaultIntakeForm;

function clientIntakeFormState(clientId){
  const form=defaultIntakeForm();
  const sends=(window.FORM_SENDS||[]).filter(s=>s&&s.clientId===clientId);
  const forForm=form?sends.filter(s=>s.formId===form.id):sends;
  const filledSend=forForm.find(s=>s.status==='filled')||null;
  const pending=forForm.find(s=>s.status!=='filled')||null;
  const anyPending=sends.filter(s=>s.status!=='filled');
  return{
    form,
    filled:!!filledSend,
    filledSend,
    pending:pending||null,
    anyPending,
    sent:!!(filledSend||pending||forForm.length)
  };
}
window.clientIntakeFormState=clientIntakeFormState;

function applyFormSubmit(send,answers,nowIso){
  if(!send)return{ok:false,error:'missing'};
  if(send.status==='filled')return{ok:false,error:'already'};
  const qs=formQuestionsForSend(send);
  const map=answers&&!Array.isArray(answers)?answers:{};
  const missing=missingRequiredFormAnswers(qs,map);
  if(missing.length)return{ok:false,error:'required',missing};
  send.status='filled';
  send.answers=map;
  send.filledAt=nowIso||new Date().toISOString();
  let intakeSync=null;
  if(typeof syncClientFromIntakeForm==='function'){
    try{intakeSync=syncClientFromIntakeForm(send);}catch(e){console.warn('syncClientFromIntakeForm',e);}
  }
  return{ok:true,send,intakeSync:intakeSync||null};
}
window.applyFormSubmit=applyFormSubmit;

// ── Wcześniejsze sporty / profil wytrzymałość vs siła (planowanie) ──
const PRIOR_SPORTS_CATALOG=[
  {id:'running',label:'Bieganie',icon:'🏃',endurance:9,strength:3},
  {id:'cycling',label:'Kolarstwo',icon:'🚴',endurance:8,strength:4},
  {id:'swimming',label:'Pływanie',icon:'🏊',endurance:8,strength:4},
  {id:'football',label:'Piłka nożna',icon:'⚽',endurance:7,strength:5},
  {id:'basketball',label:'Koszykówka',icon:'🏀',endurance:6,strength:6},
  {id:'gym',label:'Siłownia',icon:'🏋️',endurance:4,strength:9},
  {id:'crossfit',label:'CrossFit',icon:'🔥',endurance:7,strength:7},
  {id:'martial',label:'Sztuki walki',icon:'🥋',endurance:6,strength:6},
  {id:'yoga',label:'Joga / pilates',icon:'🧘',endurance:5,strength:3},
  {id:'hiking',label:'Turystyka / góry',icon:'⛰️',endurance:7,strength:5},
  {id:'team',label:'Sporty zespołowe',icon:'🤾',endurance:6,strength:5},
];
const ACTIVITY_LEVEL_LABELS={
  sedentary:'Siedzący tryb życia',
  light:'Lekka aktywność (spacery)',
  moderate:'Umiarkowana aktywność',
  active:'Aktywny (regularny trening)'
};
function normalizePriorSports(list){
  if(!list)return[];
  if(Array.isArray(list))return list.filter(Boolean);
  if(typeof list==='string')return list.split(',').map(s=>s.trim()).filter(Boolean);
  return[];
}
function clientSportProfile(c){
  const ids=normalizePriorSports(c&&c.priorSports);
  const sports=ids.map(id=>PRIOR_SPORTS_CATALOG.find(x=>x.id===id)).filter(Boolean);
  let endurance=3,strength=3;
  if(sports.length){
    endurance=Math.round(sports.reduce((s,x)=>s+x.endurance,0)/sports.length);
    strength=Math.round(sports.reduce((s,x)=>s+x.strength,0)/sports.length);
  }
  const act=c&&c.activityLevel;
  if(act==='active')endurance=Math.min(10,endurance+1);
  else if(act==='sedentary')endurance=Math.max(1,endurance-1);
  let bias='balanced';
  if(endurance-strength>=2)bias='endurance';
  else if(strength-endurance>=2)bias='strength';
  return {endurance,strength,bias,labels:sports.map(s=>s.label),sports,ids};
}
function clientSportProfileLabel(c){
  const p=clientSportProfile(c);
  if(!p.labels.length&&!(c&&c.activityLevel))return'';
  const biasLabel={endurance:'predyspozycja wytrzymałościowa',strength:'predyspozycja siłowa',balanced:'profil zrównoważony'}[p.bias];
  const parts=[];
  if(p.labels.length)parts.push('Sporty: '+p.labels.join(', '));
  if(c.activityLevel&&ACTIVITY_LEVEL_LABELS[c.activityLevel])parts.push(ACTIVITY_LEVEL_LABELS[c.activityLevel]);
  parts.push(biasLabel);
  return parts.join(' · ');
}
function clientSportProfileForAI(c){
  if(!c)return'';
  const p=clientSportProfile(c);
  if(!p.labels.length&&!c.activityLevel&&!c.sportNotes)return'';
  let txt='TŁO SPORTOWE I AKTYWNOŚĆ (obowiązkowo uwzględnij przy doborze objętości, zakresów powtórzeń i pracy kondycyjnej):\n';
  if(p.labels.length)txt+='- Wcześniejsze sporty/aktywności: '+p.labels.join(', ')+'\n';
  if(c.activityLevel)txt+='- Dotychczasowa aktywność: '+(ACTIVITY_LEVEL_LABELS[c.activityLevel]||c.activityLevel)+'\n';
  if(c.sportNotes)txt+='- Uwagi sportowe: '+c.sportNotes+'\n';
  txt+='- Indeks wytrzymałości: '+p.endurance+'/10 · indeks siły bazowej: '+p.strength+'/10\n';
  if(p.bias==='endurance'){
    txt+='- WNIOSEK: dominacja wytrzymałościowa (np. biegacz) — więcej pracy aerobowej i wyższych zakresów powtórzeń, mniejszy startowy nacisk na maksymalne obciążenia siłowe; szybsza adaptacja cardio, wolniejsza siła absolutna.\n';
  }else if(p.bias==='strength'){
    txt+='- WNIOSEK: dominacja siłowa — szybsza progresja obciążeń, niższe zakresy powtórzeń, mniej objętości cardio; wykorzystaj istniejącą bazę siłową.\n';
  }else{
    txt+='- WNIOSEK: profil zrównoważony — standardowa periodyzacja objętość/intensywność.\n';
  }
  return txt;
}
function priorSportsChipsHTML(selected,prefix,onclickFn){
  const sel=new Set(normalizePriorSports(selected));
  const fn=onclickFn||("togglePriorSportChip(this,'"+prefix+"')");
  return '<div class="prior-sports-grid" id="'+prefix+'-prior-sports" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px;">'+
    PRIOR_SPORTS_CATALOG.map(s=>{
      const on=sel.has(s.id);
      return '<button type="button" class="prior-sport-chip'+(on?' active':'')+'" data-sport="'+s.id+'" onclick="'+fn+'" style="padding:8px 6px;border-radius:10px;border:1px solid '+(on?'var(--accent)':'var(--border2)')+';background:'+(on?'var(--adim)':'var(--s3)')+';cursor:pointer;font-size:11px;text-align:center;color:var(--text);">'+
        '<span style="font-size:16px;display:block;margin-bottom:2px;">'+s.icon+'</span>'+s.label+
      '</button>';
    }).join('')+'</div>';
}
function readPriorSportsFrom(prefix){
  const root=document.getElementById(prefix+'-prior-sports');
  if(!root)return[];
  return[...root.querySelectorAll('.prior-sport-chip.active')].map(b=>b.dataset.sport).filter(Boolean);
}
function setPriorSportsChips(prefix,ids){
  const root=document.getElementById(prefix+'-prior-sports');
  if(!root)return;
  const sel=new Set(normalizePriorSports(ids));
  root.querySelectorAll('.prior-sport-chip').forEach(b=>{
    const on=sel.has(b.dataset.sport);
    b.classList.toggle('active',on);
    b.style.borderColor=on?'var(--accent)':'var(--border2)';
    b.style.background=on?'var(--adim)':'var(--s3)';
  });
}
function togglePriorSportChip(btn,prefix){
  if(!btn)return;
  btn.classList.toggle('active');
  const on=btn.classList.contains('active');
  btn.style.borderColor=on?'var(--accent)':'var(--border2)';
  btn.style.background=on?'var(--adim)':'var(--s3)';
}
window.PRIOR_SPORTS_CATALOG=PRIOR_SPORTS_CATALOG;
window.ACTIVITY_LEVEL_LABELS=ACTIVITY_LEVEL_LABELS;
window.normalizePriorSports=normalizePriorSports;
window.clientSportProfile=clientSportProfile;
window.clientSportProfileLabel=clientSportProfileLabel;
window.clientSportProfileForAI=clientSportProfileForAI;
window.priorSportsChipsHTML=priorSportsChipsHTML;
window.readPriorSportsFrom=readPriorSportsFrom;
window.setPriorSportsChips=setPriorSportsChips;
window.togglePriorSportChip=togglePriorSportChip;

// ── Priorytet sylwetkowy (weak points / focus muscles) ──
const PHYSIQUE_PRIORITY_CATALOG=[
  {id:'upper_chest',label:'Góra klatki',icon:'⬆️'},
  {id:'mid_chest',label:'Środek klatki',icon:'🫁'},
  {id:'lats',label:'Szerokość pleców',icon:'🦇'},
  {id:'upper_back',label:'Góra pleców',icon:'🔙'},
  {id:'side_delts',label:'Boczny bark',icon:'📐'},
  {id:'rear_delts',label:'Tył barku',icon:'↩️'},
  {id:'front_delts',label:'Przód barku',icon:'➡️'},
  {id:'biceps',label:'Biceps',icon:'💪'},
  {id:'triceps',label:'Triceps',icon:'🔱'},
  {id:'quads',label:'Czworogłowe',icon:'🦵'},
  {id:'hamstrings',label:'Dwugłowe',icon:'🦿'},
  {id:'glutes',label:'Pośladki',icon:'🍑'},
  {id:'calves',label:'Łydki',icon:'🦶'},
  {id:'abs',label:'Brzuch / core',icon:'🎯'},
];
const PHYSIQUE_PRIORITY_MAP=Object.fromEntries(PHYSIQUE_PRIORITY_CATALOG.map(p=>[p.id,p]));
function normalizePhysiquePriority(ids){
  if(!ids)return[];
  const arr=Array.isArray(ids)?ids:String(ids).split(/[,;|]/).map(s=>s.trim()).filter(Boolean);
  const known=new Set(PHYSIQUE_PRIORITY_CATALOG.map(p=>p.id));
  return[...new Set(arr.map(x=>String(x).trim()).filter(id=>known.has(id)))];
}
function physiquePriorityLabel(id){
  return(PHYSIQUE_PRIORITY_MAP[id]&&PHYSIQUE_PRIORITY_MAP[id].label)||id||'';
}
function physiquePriorityChipsHTML(selected,prefix,onclickFn){
  const sel=new Set(normalizePhysiquePriority(selected));
  const fn=onclickFn||("togglePhysiquePriorityChip(this,'"+prefix+"')");
  return '<div class="physique-priority-grid" id="'+prefix+'-physique-priority" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;">'+
    PHYSIQUE_PRIORITY_CATALOG.map(p=>{
      const on=sel.has(p.id);
      return '<button type="button" class="physique-priority-chip'+(on?' active':'')+'" data-priority="'+p.id+'" onclick="'+fn+'" style="padding:8px 6px;border-radius:10px;border:1px solid '+(on?'var(--accent)':'var(--border2)')+';background:'+(on?'var(--adim)':'var(--s3)')+';cursor:pointer;font-size:11px;text-align:center;color:var(--text);">'+
        '<span style="font-size:15px;display:block;margin-bottom:2px;">'+p.icon+'</span>'+p.label+
      '</button>';
    }).join('')+'</div>';
}
function readPhysiquePriorityFrom(prefix){
  const root=document.getElementById(prefix+'-physique-priority');
  if(!root)return[];
  return[...root.querySelectorAll('.physique-priority-chip.active')].map(b=>b.dataset.priority).filter(Boolean);
}
function setPhysiquePriorityChips(prefix,ids){
  const root=document.getElementById(prefix+'-physique-priority');
  if(!root)return;
  const sel=new Set(normalizePhysiquePriority(ids));
  root.querySelectorAll('.physique-priority-chip').forEach(b=>{
    const on=sel.has(b.dataset.priority);
    b.classList.toggle('active',on);
    b.style.borderColor=on?'var(--accent)':'var(--border2)';
    b.style.background=on?'var(--adim)':'var(--s3)';
  });
}
function togglePhysiquePriorityChip(btn){
  if(!btn)return;
  btn.classList.toggle('active');
  const on=btn.classList.contains('active');
  btn.style.borderColor=on?'var(--accent)':'var(--border2)';
  btn.style.background=on?'var(--adim)':'var(--s3)';
}
function initPhysiquePriorityForm(prefix,selected){
  const mountId=prefix+'-physique-priority-mount';
  const mount=document.getElementById(mountId);
  if(mount&&typeof physiquePriorityChipsHTML==='function'){
    mount.outerHTML=physiquePriorityChipsHTML(selected||[],prefix);
    return;
  }
  const direct=document.getElementById(prefix+'-physique-priority');
  if(direct&&typeof setPhysiquePriorityChips==='function')setPhysiquePriorityChips(prefix,selected||[]);
}
/** Kontuzje: preferuj dedykowane pole, fallback na notes (stare karty). */
function clientInjuriesText(c){
  if(!c)return'';
  const inj=String(c.injuries||'').trim();
  if(inj)return inj;
  return String(c.notes||'').trim();
}
function clientPhysiquePriorityForAI(c,overrideIds){
  const ids=normalizePhysiquePriority(overrideIds!=null?overrideIds:(c&&c.physiquePriority));
  if(!ids.length)return'';
  const labels=ids.map(physiquePriorityLabel).filter(Boolean);
  return'- PRIORYTET SYLWETKOWY (weak points): '+labels.join(', ')+'. Te partie MUSZĄ być 1-2 pierwszymi ćwiczeniami w sesjach, które je stymulują (świeży układ nerwowy). Preferuj maszyny/wyciągi/suwnicę i warianty w pozycji wydłużonej (stretch-mediated).\n';
}
window.PHYSIQUE_PRIORITY_CATALOG=PHYSIQUE_PRIORITY_CATALOG;
window.PHYSIQUE_PRIORITY_MAP=PHYSIQUE_PRIORITY_MAP;
window.normalizePhysiquePriority=normalizePhysiquePriority;
window.physiquePriorityLabel=physiquePriorityLabel;
window.physiquePriorityChipsHTML=physiquePriorityChipsHTML;
window.readPhysiquePriorityFrom=readPhysiquePriorityFrom;
window.setPhysiquePriorityChips=setPhysiquePriorityChips;
window.togglePhysiquePriorityChip=togglePhysiquePriorityChip;
window.initPhysiquePriorityForm=initPhysiquePriorityForm;
window.clientInjuriesText=clientInjuriesText;
window.clientPhysiquePriorityForAI=clientPhysiquePriorityForAI;

// ── Częstotliwość i preferowane dni tygodnia (karta → AI → kalendarz) ──
const WEEKDAY_TRAIN_OPTIONS=[
  {id:1,label:'Pon',key:'PON'},
  {id:2,label:'Wt',key:'WT'},
  {id:3,label:'Śr',key:'ŚR'},
  {id:4,label:'Czw',key:'CZ'},
  {id:5,label:'Pt',key:'PT'},
  {id:6,label:'Sob',key:'SO'},
  {id:0,label:'Nd',key:'ND'}
];
function normalizeTrainingFreq(v){
  const n=parseInt(v,10);
  if(!n||n<2)return 0;
  return Math.min(6,n);
}
/** Domyślne dni tygodnia dla danej częstotliwości (JS getDay: 0=Nd…6=Sob). */
function defaultWeekdaysForFreq(freq){
  const n=normalizeTrainingFreq(freq);
  if(n===2)return[1,4];
  if(n===3)return[1,3,5];
  if(n===4)return[1,2,4,5];
  if(n===5)return[1,2,3,4,5];
  if(n===6)return[1,2,3,4,5,6];
  return[];
}
function ymdWeekday(ymd){
  const d=new Date(String(ymd||'').slice(0,10)+'T12:00:00');
  if(isNaN(d.getTime()))return -1;
  return d.getDay();
}
function clientPreferredWeekdays(client){
  if(!client)return null;
  const pref=normalizePreferredWeekdays(client.preferredWeekdays);
  if(pref.length)return pref;
  const freq=normalizeTrainingFreq(client.trainingFreq);
  if(freq)return defaultWeekdaysForFreq(freq);
  return null;
}
function hasPlannedSessionOnDate(clientId,dateYmd){
  const day=String(dateYmd||'').slice(0,10);
  if(!clientId||!day)return false;
  return(window.SE||[]).some(s=>s&&s.clientId===clientId&&s.date===day&&s.source==='planned');
}
/** Czy klient ma trening w harmonogramie (preferowane dni lub wpis planned w kalendarzu). */
function isClientTrainingDay(clientId,dateYmd,clientOpt){
  const day=String(dateYmd||(typeof todayYmd==='function'?todayYmd():'')).slice(0,10);
  if(!clientId||!day)return true;
  if(hasPlannedSessionOnDate(clientId,day))return true;
  const c=clientOpt||(window.CL||[]).find(x=>x&&x.id===clientId);
  const wds=clientPreferredWeekdays(c);
  if(!wds||!wds.length)return true;
  const dow=ymdWeekday(day);
  if(dow<0)return true;
  return wds.indexOf(dow)>=0;
}
function nextClientTrainingDayYmd(clientId,fromYmd){
  const start=String(fromYmd||(typeof todayYmd==='function'?todayYmd():'')).slice(0,10);
  const c=(window.CL||[]).find(x=>x&&x.id===clientId);
  const wds=clientPreferredWeekdays(c);
  if(!wds||!wds.length)return null;
  for(let i=1;i<=14;i++){
    const y=typeof ymdAdd==='function'?ymdAdd(start,i):'';
    if(!y)continue;
    if(wds.indexOf(ymdWeekday(y))>=0)return y;
  }
  return null;
}
function formatTrainingDayShortPl(ymd){
  const dow=ymdWeekday(ymd);
  const w=WEEKDAY_TRAIN_OPTIONS.find(x=>x.id===dow);
  if(!w)return String(ymd||'');
  const d=new Date(String(ymd||'').slice(0,10)+'T12:00:00');
  if(isNaN(d.getTime()))return w.label;
  const mon=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  return w.label+' '+d.getDate()+' '+mon[d.getMonth()];
}
function preferredWeekdaysLabels(ids){
  const list=normalizePreferredWeekdays(ids);
  return list.map(id=>{
    const w=WEEKDAY_TRAIN_OPTIONS.find(x=>x.id===id);
    return w?w.label:String(id);
  });
}
function normalizePreferredWeekdays(list){
  if(!list)return[];
  const arr=Array.isArray(list)?list:String(list).split(/[,;|]/).map(s=>s.trim()).filter(Boolean);
  const out=[];
  arr.forEach(x=>{
    if(typeof x==='number'&&x>=0&&x<=6){out.push(x);return;}
    const s=String(x).toUpperCase();
    const hit=WEEKDAY_TRAIN_OPTIONS.find(w=>w.key===s||w.label.toUpperCase()===s||String(w.id)===s);
    if(hit&&!out.includes(hit.id))out.push(hit.id);
    else{
      const n=parseInt(x,10);
      if(!isNaN(n)&&n>=0&&n<=6&&!out.includes(n))out.push(n);
    }
  });
  return out;
}
function preferredWeekdaysChipsHTML(selected,prefix){
  const sel=new Set(normalizePreferredWeekdays(selected));
  return '<div class="preferred-weekdays-grid" id="'+prefix+'-preferred-weekdays" style="display:flex;flex-wrap:wrap;gap:6px;">'+
    WEEKDAY_TRAIN_OPTIONS.map(w=>{
      const on=sel.has(w.id);
      return '<button type="button" class="preferred-weekday-chip'+(on?' active':'')+'" data-wd="'+w.id+'" onclick="togglePreferredWeekdayChip(this)" style="min-width:42px;padding:7px 10px;border-radius:8px;border:1px solid '+(on?'var(--accent)':'var(--border2)')+';background:'+(on?'var(--adim)':'var(--s3)')+';cursor:pointer;font-size:11px;font-weight:600;color:var(--text);">'+w.label+'</button>';
    }).join('')+'</div>';
}
function readPreferredWeekdaysFrom(prefix){
  const root=document.getElementById(prefix+'-preferred-weekdays');
  if(!root)return[];
  return[...root.querySelectorAll('.preferred-weekday-chip.active')].map(b=>parseInt(b.dataset.wd,10)).filter(n=>!isNaN(n));
}
function setPreferredWeekdayChips(prefix,ids){
  const root=document.getElementById(prefix+'-preferred-weekdays');
  if(!root)return;
  const sel=new Set(normalizePreferredWeekdays(ids));
  root.querySelectorAll('.preferred-weekday-chip').forEach(b=>{
    const on=sel.has(parseInt(b.dataset.wd,10));
    b.classList.toggle('active',on);
    b.style.borderColor=on?'var(--accent)':'var(--border2)';
    b.style.background=on?'var(--adim)':'var(--s3)';
  });
}
function togglePreferredWeekdayChip(btn){
  if(!btn)return;
  btn.classList.toggle('active');
  const on=btn.classList.contains('active');
  btn.style.borderColor=on?'var(--accent)':'var(--border2)';
  btn.style.background=on?'var(--adim)':'var(--s3)';
}
function initPreferredWeekdaysForm(prefix,selected){
  const mount=document.getElementById(prefix+'-preferred-weekdays-mount');
  if(mount){mount.outerHTML=preferredWeekdaysChipsHTML(selected||[],prefix);return;}
  const direct=document.getElementById(prefix+'-preferred-weekdays');
  if(direct)setPreferredWeekdayChips(prefix,selected||[]);
}
const CLIENT_ONBOARD_STEPS=[
  {id:'invite',label:'Zaproszenie',missing:'brak zaproszenia'},
  {id:'baseline',label:'Pomiary',missing:'brak pomiarów'},
  {id:'schedule',label:'Harmonogram',missing:'brak dni treningowych'},
  {id:'plan',label:'Plan',missing:'brak planu'},
  {id:'calendar',label:'Kalendarz',missing:'brak w kalendarzu'},
  {id:'package',label:'Pakiet',missing:'brak pakietu'}
];
function clientHasSchedulePrefs(c){
  return normalizePreferredWeekdays(c&&c.preferredWeekdays).length>0;
}
function clientHasAssignedPlan(clientId){
  return(window.PL||[]).some(p=>p&&p.clientId===clientId);
}
/** Najpóźniejsza zaplanowana sesja (source=planned) klienta. */
function clientLastPlannedYmd(clientId){
  if(!clientId)return'';
  const dates=(window.SE||[]).filter(s=>s&&s.clientId===clientId&&s.source==='planned'&&s.date)
    .map(s=>String(s.date).slice(0,10)).filter(Boolean).sort();
  return dates.length?dates[dates.length-1]:'';
}
window.clientLastPlannedYmd=clientLastPlannedYmd;

/** Plan klienta do dopełnienia kalendarza (najnowszy z dniami treningowymi). */
function clientPlanForCalendar(clientId){
  if(!clientId)return null;
  const list=(window.PL||[]).filter(p=>p&&p.clientId===clientId&&(p.days||[]).some(d=>d&&!d.rest&&(d.exercises||[]).length));
  if(!list.length)return null;
  return list.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0];
}
window.clientPlanForCalendar=clientPlanForCalendar;

/**
 * Klient z planem, którego ostatnia sesja planned jest ≤ withinDays od dziś
 * (albo brak planned) — trzeba dopełnić kalendarz.
 */
function clientNeedsCalendarRefill(c,withinDays){
  if(!c||c.status==='archived')return false;
  const plan=clientPlanForCalendar(c.id);
  if(!plan)return false;
  const days=withinDays==null?7:withinDays;
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  const last=clientLastPlannedYmd(c.id);
  if(!last)return{client:c,plan,last:'',urgency:'empty'};
  const horizon=typeof ymdAdd==='function'?ymdAdd(today,days):today;
  if(last>horizon)return false;
  return{client:c,plan,last,urgency:last<today?'past':'soon'};
}
window.clientNeedsCalendarRefill=clientNeedsCalendarRefill;

function clientsNeedingCalendarRefill(withinDays){
  return(window.CL||[]).filter(c=>c&&c.status!=='archived')
    .map(c=>clientNeedsCalendarRefill(c,withinDays))
    .filter(Boolean)
    .sort((a,b)=>{
      const u={past:0,empty:1,soon:2};
      return(u[a.urgency]||9)-(u[b.urgency]||9)||String(a.last||'').localeCompare(String(b.last||''));
    });
}
window.clientsNeedingCalendarRefill=clientsNeedingCalendarRefill;

/** Nowe zdjęcia sylwetki od klientów (source=client), ostatnie N dni. */
function recentClientProgressPhotos(withinDays){
  const days=withinDays==null?14:withinDays;
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  const from=typeof ymdAdd==='function'?ymdAdd(today,-days):today;
  const live=new Set((window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>c.id));
  return(window.PROGRESS_PHOTOS||[]).filter(p=>{
    if(!p||!p.clientId||(live.size&&!live.has(p.clientId)))return false;
    if(p.source&&p.source!=='client')return false;
    const d=String(p.date||p.createdAt||'').slice(0,10);
    return d&&d>=from;
  }).slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
}
window.recentClientProgressPhotos=recentClientProgressPhotos;

function clientHasCalendarOrSession(clientId){
  return(window.SE||[]).some(s=>s&&s.clientId===clientId&&(s.source==='planned'||s.source==='live'||s.source==='client'));
}
function clientOnboardHasBaseline(c){
  if(!c)return false;
  if(c.baselineDone||c.weight)return true;
  return(window.METRIC_ENTRIES||[]).some(e=>e&&e.clientId===c.id&&(e.groupId==='mg1'||e.groupId==='mg2'));
}
function clientHasPackage(c){
  if(!c)return false;
  if(c.packageSkipped)return true;
  const pkgs=window.PACKAGES||[];
  return pkgs.some(p=>p&&(p.clientId===c.id||(c.name&&p.clientName===c.name)));
}
/** Status startu współpracy: zaproszenie → baseline → harmonogram → plan → kalendarz → pakiet. */
function clientOnboardStatus(c){
  if(!c)return{invite:false,baseline:false,schedule:false,plan:false,calendar:false,package:false,session:false,done:0,total:CLIENT_ONBOARD_STEPS.length,complete:true,next:null,missing:[],missingLabels:[]};
  const invite=!!(c.inviteSent||c.appInvited||c.inviteSentAt||c.inviteSkipped);
  const baseline=clientOnboardHasBaseline(c);
  const schedule=clientHasSchedulePrefs(c);
  const plan=clientHasAssignedPlan(c.id);
  const calendar=clientHasCalendarOrSession(c.id);
  const packageDone=clientHasPackage(c);
  const flags={invite,baseline,schedule,plan,calendar,package:packageDone};
  const missing=CLIENT_ONBOARD_STEPS.filter(s=>!flags[s.id]).map(s=>s.id);
  const missingLabels=CLIENT_ONBOARD_STEPS.filter(s=>!flags[s.id]).map(s=>s.missing);
  const done=CLIENT_ONBOARD_STEPS.length-missing.length;
  return{
    invite,baseline,schedule,plan,calendar,package:packageDone,
    session:calendar,
    done,total:CLIENT_ONBOARD_STEPS.length,
    complete:missing.length===0,
    next:missing[0]||null,
    missing,missingLabels
  };
}
function clientsWithIncompleteOnboard(){
  return(window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>{
    const st=clientOnboardStatus(c);
    return{client:c,status:st};
  }).filter(x=>!x.status.complete).sort((a,b)=>a.status.done-b.status.done||String(a.client.name||'').localeCompare(String(b.client.name||''),'pl'));
}
function mapGoalFromIntakeText(t){
  const s=String(t||'').toLowerCase();
  if(/si[lł]a|1\s*rm|max\.?\s*si|powerlift|ciężar/.test(s))return'sila';
  if(/reduk|schud|odchudz|fat\s*loss|spal/.test(s))return'redukcja';
  if(/kondyc|wytrzym|cardio|bieg|maraton/.test(s))return'kondycja';
  if(/masa|hipertrof|mi[eę][sś]|sylwet|kształt|budow/.test(s))return'masa';
  return null;
}
function mapLevelFromIntakeChoice(t){
  const s=String(t||'').toLowerCase();
  if(/pocz|0-1|0–1/.test(s))return'poczatkujacy';
  if(/ponad\s*3|3\+|zaawans/.test(s))return'zaawansowany';
  if(/1-3|1–3|śred|sred/.test(s))return'sredni';
  return null;
}
/** Po wypełnieniu Ankiety wstępnej (df1) — nadpisz kartę klienta polami z odpowiedzi.
 *  Zwraca false | {changed:true, summary:string, client} */
function syncClientFromIntakeForm(send){
  if(!send||!send.clientId)return false;
  const formId=String(send.formId||'');
  const formName=String(send.formName||'').toLowerCase();
  const isIntake=formId==='df1'||formName.includes('ankieta wstępna')||formName.includes('ankieta wstepna');
  if(!isIntake)return false;
  const c=(window.CL||[]).find(x=>x.id===send.clientId);
  if(!c)return false;
  const a=typeof formSendAnswersMap==='function'?formSendAnswersMap(send):(send.answers||{});
  let changed=false;
  const bits=[];
  const goal=mapGoalFromIntakeText(a.q1);
  if(goal){c.goal=goal;changed=true;bits.push('cel '+goal);}
  if(a.q1&&String(a.q1).trim()){c.goalDesc=String(a.q1).trim();changed=true;}
  const level=mapLevelFromIntakeChoice(a.q2);
  if(level){c.level=level;changed=true;bits.push('poziom '+level);}
  const yesInj=/^(tak|true|1)$/i.test(String(a.q3||'').trim());
  const injTxt=String(a.q4||'').trim();
  if(yesInj&&injTxt){c.injuries=injTxt;changed=true;bits.push('kontuzje');}
  else if(yesInj&&!c.injuries){c.injuries='Zgłoszone w ankiecie (bez opisu)';changed=true;bits.push('kontuzje');}
  const freq=normalizeTrainingFreq(a.q5);
  if(freq){
    c.trainingFreq=freq;changed=true;bits.push(freq+'×/tydz');
    const hasWd=normalizePreferredWeekdays(c.preferredWeekdays).length>0;
    if(!hasWd){
      c.preferredWeekdays=defaultWeekdaysForFreq(freq);
      bits.push('dni '+preferredWeekdaysLabels(c.preferredWeekdays).join('/'));
    }
  }
  if(a.q6&&String(a.q6).trim()){c.preferredTrainTime=String(a.q6).trim();changed=true;bits.push(c.preferredTrainTime);}
  if(changed&&typeof persistById==='function')persistById('clients',c);
  if(!changed)return false;
  return{changed:true,summary:bits.join(' · '),client:c};
}
window.WEEKDAY_TRAIN_OPTIONS=WEEKDAY_TRAIN_OPTIONS;
window.normalizeTrainingFreq=normalizeTrainingFreq;
window.defaultWeekdaysForFreq=defaultWeekdaysForFreq;
window.ymdWeekday=ymdWeekday;
window.clientPreferredWeekdays=clientPreferredWeekdays;
window.hasPlannedSessionOnDate=hasPlannedSessionOnDate;
window.isClientTrainingDay=isClientTrainingDay;
window.nextClientTrainingDayYmd=nextClientTrainingDayYmd;
window.formatTrainingDayShortPl=formatTrainingDayShortPl;
window.preferredWeekdaysLabels=preferredWeekdaysLabels;
window.normalizePreferredWeekdays=normalizePreferredWeekdays;
window.preferredWeekdaysChipsHTML=preferredWeekdaysChipsHTML;
window.readPreferredWeekdaysFrom=readPreferredWeekdaysFrom;
window.setPreferredWeekdayChips=setPreferredWeekdayChips;
window.togglePreferredWeekdayChip=togglePreferredWeekdayChip;
window.initPreferredWeekdaysForm=initPreferredWeekdaysForm;
window.CLIENT_ONBOARD_STEPS=CLIENT_ONBOARD_STEPS;
window.clientHasSchedulePrefs=clientHasSchedulePrefs;
window.clientHasAssignedPlan=clientHasAssignedPlan;
window.clientHasCalendarOrSession=clientHasCalendarOrSession;
window.clientOnboardHasBaseline=clientOnboardHasBaseline;
window.clientHasPackage=clientHasPackage;
window.clientOnboardStatus=clientOnboardStatus;
window.clientsWithIncompleteOnboard=clientsWithIncompleteOnboard;
window.mapGoalFromIntakeText=mapGoalFromIntakeText;
window.mapLevelFromIntakeChoice=mapLevelFromIntakeChoice;
window.syncClientFromIntakeForm=syncClientFromIntakeForm;

// ── Motyw studia (czerwień + grafit) ──
const STUDIO_THEME={
  accent:'#e60000',
  accent2:'#b80000',
  bg:'#1a1a1a',
  blue:'#0055a4',
  yellow:'#ffd700'
};
function hexToRgbStr(hex){
  const h=String(hex||'').replace('#','');
  if(h.length!==6)return '230,0,0';
  return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(5,7),16);
}
function applyBrandTheme(settings){
  const root=typeof document!=='undefined'?document.documentElement:null;
  if(!root)return;
  const s=settings||window.SETTINGS||{};
  const brand=s.brand||{};
  const accent=brand.accentColor||STUDIO_THEME.accent;
  const rgb=hexToRgbStr(accent);
  root.style.setProperty('--accent',accent);
  root.style.setProperty('--accent2',brand.accentDark||STUDIO_THEME.accent2);
  root.style.setProperty('--accent-rgb',rgb);
  root.style.setProperty('--adim','rgba('+rgb+',0.14)');
  root.style.setProperty('--glow','0 0 0 1px rgba('+rgb+',0.35), 0 0 18px rgba('+rgb+',0.18)');
  const meta=typeof document!=='undefined'?document.querySelector('meta[name="theme-color"]'):null;
  if(meta)meta.setAttribute('content',accent);
}
window.STUDIO_THEME=STUDIO_THEME;
window.applyBrandTheme=applyBrandTheme;
if(typeof document!=='undefined'&&document.documentElement){
  try{applyBrandTheme(window.SETTINGS);}catch(e){}
}

// ════════════════════════════════════════
// UZASADNIENIE METODYCZNE (dla trenera)
// Ramy edukacyjne oparte o NSCA / ACSM / literaturę objętościową —
// bez live PubMed; cytowania to punkty startowe do dalszej nauki.
// ════════════════════════════════════════
const METHOD_WHY={
  PPL:{label:'Push / Pull / Legs',why:'Dzieli ciało na wzorce push, pull i nogi — każda partia ~2×/tydzień przy 6 dniach (lub 1–2× przy 3–4 dniach). Dobrze skaluje objętość hipertrofii bez „bro-splitu” 1×/tydzień.',best:'4–6 dni/tydzień, masa i kształtowanie'},
  FBW:{label:'Full Body (FBW)',why:'Całe ciało w każdej sesji → wysoka częstotliwość stymulacji (3×/tydzień na partie). Idealne przy 2–3 dniach i dla początkujących (adaptacja nerwowo-mięśniowa).',best:'2–3 dni/tydzień, nowicjusze, utrzymanie'},
  'Upper Lower':{label:'Upper / Lower',why:'Góra i dół na przemian — zwykle 4 dni, każda partia 2×/tydzień. Kompromis między FBW a PPL: więcej objętości na sesję niż FBW, mniej dni niż pełne PPL 6×.',best:'3–4 dni/tydzień, masa lub siła'},
  UL:{label:'Upper / Lower',why:'Góra i dół na przemian — zwykle 4 dni, każda partia 2×/tydzień. Kompromis między FBW a PPL.',best:'3–4 dni/tydzień'},
  Arnold:{label:'Arnold Split',why:'Klatka+plecy, barki+ramiona, nogi (×2) — wysoka objętość na partie sylwetkowe. Wymaga dobrej regeneracji i doświadczenia z objętością.',best:'5–6 dni, zaawansowani, hipertrofia'},
  'Bro Split':{label:'Bro Split',why:'Jedna partia / dzień — wysoka objętość lokalna, ale niska częstotliwość (~1×/tydzień). Używaj świadomie; przy hipertrofii częściej lepsze 2×/tydzień.',best:'5–6 dni, zaawansowani z priorytetami'},
  '531':{label:'5/3/1 Wendler',why:'Progresja %1RM na głównych wielostawach (przysiad, bench, deadlift, OHP) + asysty. Priorytet siły i długoterminowej progresji, nie maksymalnej objętości sylwetkowej.',best:'3–4 dni, cel siła'},
  '5/3/1':{label:'5/3/1 Wendler',why:'Progresja %1RM na głównych wielostawach + asysty. Priorytet siły.',best:'3–4 dni, cel siła'},
  Blokowa:{label:'Periodyzacja blokowa',why:'Bloki akumulacji → intensyfikacji → realizacji (+ deload). Objętość i intensywność nie rosną naraz — chroni przed stagnacją i przetrenowaniem.',best:'8–12+ tygodni, średni/zaawansowany'},
  Obwodowy:{label:'Trening obwodowy (circuit)',why:'Stacje / rundy z krótkimi przerwami (lub bez) — wysoka gęstość pracy, tętno i wydatek energetyczny. Dobry do kondycji, redukcji i ograniczonego czasu sesji; słabszy wybór pod maksymalne 1RM.',best:'2–4 dni, redukcja, kondycja, sesje 30–45 min'},
  Circuit:{label:'Trening obwodowy (circuit)',why:'Stacje / rundy z krótkimi przerwami — wysoka gęstość pracy i wydatek energetyczny. Dobry do kondycji i redukcji.',best:'2–4 dni, redukcja, kondycja'},
  Custom:{label:'Dostosowana',why:'Struktura pod klienta — uzasadnij częstotliwość partii (≥2×/tydzień przy hipertrofii) i objętość względem MEV/MAV.',best:'gdy sztywny split nie pasuje'},
  'Własna':{label:'Własna struktura',why:'Pełna kontrola trenera. Zapisz w notatkach planu, dlaczego taki układ dni i objętości.',best:'doświadczeni trenerzy'}
};
const GOAL_WHY={
  masa:{
    label:'Budowa masy (hipertrofia)',
    sets:'3–4 serie robocze / ćwiczenie',
    reps:'złożone 6–10 · izolacje 8–15',
    rpe:'RPE 7–9 (RIR 1–3)',
    rest:'60–120 s (izolacje krócej, wielostawy dłużej)',
    why:'Hipertrofia reaguje na tygodniową objętość blisko upadku. Celuj w MEV–MAV na partię; częstotliwość ≥2×/tydzień na główne partie.',
    volume:'Klatka/plecy ~10–18 serii/tyg · barki ~12–20 · nogi ~12–20 · ramiona ~8–14'
  },
  sila:{
    label:'Wzrost siły',
    sets:'3–6 serii / ćwiczenie główne',
    reps:'główne 1–6 · asysty 6–10',
    rpe:'RPE 7–9 (ciężkie serie), zapas na technikę',
    rest:'2–5 min na wielostawach',
    why:'Siła wymaga wysokiej intensywności (%1RM) i pełnej regeneracji między seriami. Objętość niższa niż przy masie; priorytet: przysiad, wyciskanie, martwy, OHP.',
    volume:'Główne ruchy 10–20 ciężkich serii/tyg łącznie · asysty umiarkowanie'
  },
  redukcja:{
    label:'Redukcja (zachowanie mięśni)',
    sets:'3–4 serie / ćwiczenie',
    reps:'6–12 (utrzymaj ciężar, nie „cardio na siłowni”)',
    rpe:'RPE 7–8 — unikaj ciągłego RPE 10 przy deficycie',
    rest:'60–120 s',
    why:'Przy deficycie kalorycznym trening siłowy chroni masę mięśniową. Nie tnij drastycznie objętości na starcie; dodaj NEAT/cardio osobno.',
    volume:'Utrzymaj blisko MEV–dolne MAV; deload wcześniej przy słabym śnie/stresie'
  },
  kondycja:{
    label:'Kondycja ogólna',
    sets:'2–4 serie',
    reps:'8–15 + praca tlenowa / interwały',
    rpe:'RPE 6–8 siłowo · wyżej w HIIT',
    rest:'45–90 s siłowo',
    why:'Łączysz bazę siłową z pojemnością tlenową. Nie maksymalizuj MRV siłowego — zostaw energię na cardio/HIIT.',
    volume:'Siła: okolice MEV · osobno 1–3 sesje kondycyjne'
  },
  atletyzm:{
    label:'Atletyzm / moc',
    sets:'3–5 (moc: niższa objętość, wyższa jakość)',
    reps:'moc 1–5 · siła 3–6 · hipertrofia asyst 6–10',
    rpe:'RPE 6–8 na plyo/moc (świeżość)',
    rest:'2–5 min przy mocy',
    why:'Moc wymaga świeżego układu nerwowego — najpierw skoki/rzuty/olympic, potem siła, na końcu objętość.',
    volume:'Niska–średnia objętość hipertrofii; jakość ruchu > liczba serii'
  },
  rehab:{
    label:'Rehabilitacja / powrót',
    sets:'2–3 serie kontrolowane',
    reps:'8–15, bez bólu ostrego',
    rpe:'RPE 5–7',
    rest:'60–90 s',
    why:'Priorytet: zakres ruchu, kontrola i tolerancja obciążenia. Unikaj maksymalnych ciężarów i metod intensyfikacji do konsultacji z fizjo.',
    volume:'Poniżej typowego MEV na obszar kontuzji; buduj stopniowo'
  }
};
const LEVEL_WHY={
  poczatkujacy:'Nowicjusz: dolna połowa MEV–MAV, nauka wzorców, progresja liniowa. Scięgna adaptują się wolniej niż mięśnie — nie skacz objętością co tydzień.',
  sredni:'Średni: środek/góra MAV, możliwa DUP lub falowanie. Deload co 4–6 tygodni.',
  zaawansowany:'Zaawansowany: góra MAV, blisko MRV na priorytetach, bloki i specjalizacja. Wymaga snu, białka i monitorowania RPE.'
};

/** Tygodniowa liczba serii roboczych na partię wg stażu (orientacja MEV–MAV; hipertrofia). */
const VOLUME_PART_ORDER=['Klatka','Plecy','Barki','Biceps','Triceps','Quady','Tył uda','Pośladki','Brzuch','Łydki'];
const VOLUME_BY_LEVEL={
  poczatkujacy:{
    label:'Początkujący',
    tenure:'0–1 rok',
    note:'Startuj nisko (MEV). +1–2 serie/partię co 1–2 tyg. tylko gdy regeneracja OK.',
    parts:{
      Klatka:'6–10',Plecy:'8–12',Barki:'8–12',Biceps:'6–8',Triceps:'6–8',
      Quady:'8–12','Tył uda':'6–10',Pośladki:'6–10',Brzuch:'4–8',Łydki:'6–10'
    }
  },
  sredni:{
    label:'Średni',
    tenure:'1–3 lata',
    note:'Środek MAV. Priorytety +2–4 serie vs. utrzymanie. Deload co 4–6 tyg.',
    parts:{
      Klatka:'10–16',Plecy:'12–18',Barki:'12–18',Biceps:'8–12',Triceps:'8–12',
      Quady:'12–18','Tył uda':'10–16',Pośladki:'10–14',Brzuch:'6–10',Łydki:'8–14'
    }
  },
  zaawansowany:{
    label:'Zaawansowany',
    tenure:'3+ lata',
    note:'Góra MAV / lokalnie blisko MRV na priorytetach. Specjalizacja + bloki; nie trzymaj wszystkich partii na suficie naraz.',
    parts:{
      Klatka:'12–20',Plecy:'14–22',Barki:'14–22',Biceps:'10–16',Triceps:'10–16',
      Quady:'14–22','Tył uda':'12–20',Pośladki:'12–18',Brzuch:'6–12',Łydki:'10–16'
    }
  }
};
window.VOLUME_BY_LEVEL=VOLUME_BY_LEVEL;
window.VOLUME_PART_ORDER=VOLUME_PART_ORDER;

function volumeGuideForLevel(levelKey){
  const k=String(levelKey||'sredni').toLowerCase();
  return VOLUME_BY_LEVEL[k]||VOLUME_BY_LEVEL.sredni;
}
window.volumeGuideForLevel=volumeGuideForLevel;

const RATIONALE_SOURCES=[
  'NSCA — Essentials of Strength Training and Conditioning (serie/powt./%1RM)',
  'ACSM — Guidelines: częstotliwość i progresja oporu',
  'Schoenfeld i in. — metaanalizy objętości i częstotliwości hipertrofii (punkty orientacyjne MEV/MAV)',
  'Israetel / RP — landmarks objętości (MEV / MAV / MRV) jako ramy, nie sztywne normy',
  'Twoja Baza wiedzy w apce — dopisz własne zasady i doświadczenie'
];

/** Wbudowany pakiet dowodów / zasad — zawsze dostępny przy planowaniu (bez live PubMed). */
const BUILTIN_PLANNING_EVIDENCE=[
  {id:'bev_freq',kind:'evidence',title:'Częstotliwość ≥2×/partię (hipertrofia)',
    text:'Przy hipertrofii stymulacja głównych partii co najmniej 2× w tygodniu zwykle daje lepszy efekt niż 1× przy tej samej objętości tygodniowej — stąd PPL/UL/FBW zamiast klasycznego bro-splitu.',
    citation:'Schoenfeld et al., frequency meta-analyses',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/30558493/',useInPlanning:true},
  {id:'bev_vol',kind:'evidence',title:'Objętość tygodniowa (MEV→MAV)',
    text:'Hipertrofia skaluje się z tygodniową liczbą serii roboczych blisko upadku. Celuj między MEV a MAV; MRV to sufit, nie domyślny cel. Początkujący: dolna połowa zakresu.',
    citation:'Schoenfeld / Israetel volume landmarks (ramy praktyczne)',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/27433992/',useInPlanning:true},
  {id:'bev_prox',kind:'evidence',title:'Bliskość upadku (RIR/RPE)',
    text:'Serie hipertroficzne powinny kończyć się blisko upadku (ok. 0–3 RIR). Zbyt duży zapas ogranicza bodziec; ciągłe RPE 10 utrudnia progresję i regenerację.',
    citation:'Refalo / proximity to failure reviews',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/33497853/',useInPlanning:true},
  {id:'bev_str',kind:'evidence',title:'Siła: intensywność i przerwy',
    text:'Rozwój siły maksymalnej opiera się na wysokim %1RM, niższych powtórzeniach i dłuższych przerwach (2–5 min) na wielostawach — objętość niższa niż w czystej hipertrofii.',
    citation:'NSCA Essentials; ACSM resistance guidelines',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/19204579/',useInPlanning:true},
  {id:'bev_deload',kind:'principle',title:'Deload co 4–6 tygodni',
    text:'Planuj obniżenie objętości/intensywności co kilka tygodni (sen, staw, RPE drift). Deload to narzędzie progresji, nie „przegrana”.',
    citation:'Praktyka periodyzacji (NSCA / coaching)',sourceUrl:'',useInPlanning:true}
];

function normalizeKbKind(k){
  const v=String((k&&k.kind)||'note').toLowerCase();
  if(v==='evidence'||v==='badanie'||v==='source')return'evidence';
  if(v==='principle'||v==='zasada')return'principle';
  return'note';
}
function kbEntryUsesInPlanning(k){
  if(!k)return false;
  if(k.useInPlanning===false)return false;
  const kind=normalizeKbKind(k);
  if(kind==='principle'||kind==='evidence')return true;
  // stare notatki (bez kind) — domyślnie tak, jeśli nie wyłączono
  return k.useInPlanning!==false;
}
/** Wpisy trenera + pakiet wbudowany do kontekstu planowania. */
function getPlanningEvidenceEntries(){
  const user=(window.KB||[]).filter(kbEntryUsesInPlanning);
  const userTitles=new Set(user.map(k=>String(k.title||'').toLowerCase()));
  const userBuiltin=new Set(user.map(k=>k.builtinId).filter(Boolean));
  const builtins=BUILTIN_PLANNING_EVIDENCE.filter(b=>!userBuiltin.has(b.id)&&!userTitles.has(String(b.title).toLowerCase()));
  return builtins.map(b=>({...b,builtin:true})).concat(user.map(k=>({
    id:k.id,kind:normalizeKbKind(k),title:k.title,text:k.text,
    citation:k.citation||'',sourceUrl:k.sourceUrl||'',useInPlanning:true,builtin:false
  })));
}
function planningEvidenceContext(maxChars){
  const list=getPlanningEvidenceEntries();
  if(!list.length)return'';
  const budget=maxChars||4500;
  let out='\n\n=== DOWODY I ZASADY TRENERA (obowiązkowy kontekst planowania) ===\n';
  out+='Uwzględnij te zasady przy doborze metody, serii, RPE i objętości. Preferuj zasady oznaczone jako „zasada trenera” nad ogólnikami, gdy kolidują.\n';
  for(const e of list){
    const kind=e.kind==='evidence'?'BADANIE/ŹRÓDŁO':(e.kind==='principle'?'ZASADA TRENERA':'NOTATKA');
    const cite=e.citation?` [${e.citation}]`:'';
    const url=e.sourceUrl?` URL: ${e.sourceUrl}`:'';
    const block=`### [${kind}] ${e.title}${cite}${url}\n${String(e.text||'').substring(0,500)}\n\n`;
    if(out.length+block.length>budget)break;
    out+=block;
  }
  return out;
}
function planningEvidenceSourceLines(){
  return getPlanningEvidenceEntries().slice(0,8).map(e=>{
    const tag=e.kind==='evidence'?'Źródło':(e.kind==='principle'?'Zasada':'Notatka');
    const cite=e.citation?` — ${e.citation}`:'';
    return `${tag}: ${e.title}${cite}`;
  });
}
window.BUILTIN_PLANNING_EVIDENCE=BUILTIN_PLANNING_EVIDENCE;
window.getPlanningEvidenceEntries=getPlanningEvidenceEntries;
window.planningEvidenceContext=planningEvidenceContext;
window.planningEvidenceSourceLines=planningEvidenceSourceLines;
window.kbEntryUsesInPlanning=kbEntryUsesInPlanning;
window.normalizeKbKind=normalizeKbKind;

function normalizeRationaleMethod(method){
  const m=String(method||'').trim();
  if(!m)return'PPL';
  if(/^upper\s*\/?\s*lower$/i.test(m)||m==='UL')return'Upper Lower';
  if(/^5\s*\/\s*3\s*\/\s*1|531$/i.test(m))return'531';
  if(/^bro/i.test(m))return'Bro Split';
  if(/^arnold/i.test(m))return'Arnold';
  if(/^w[lł]asna/i.test(m))return'Własna';
  if(/^custom|dostosow/i.test(m))return'Custom';
  if(/^blok/i.test(m))return'Blokowa';
  if(/^obwod|circuit|okr[eę]ż/i.test(m))return'Obwodowy';
  if(/^fbw|full\s*body/i.test(m))return'FBW';
  if(/^ppl|push/i.test(m))return'PPL';
  return m;
}
/** Krótka, prosta mowa do klienta — bez RPE/MEV/żargonu. */
function buildClientTalkPlain(opts){
  const o=opts||{};
  const methodKey=normalizeRationaleMethod(o.methodKey||o.method);
  const goalKey=String(o.goalKey||o.goal||'masa').toLowerCase();
  const levelKey=String(o.levelKey||o.level||'sredni').toLowerCase();
  const weight=parseFloat(o.weight);
  const methodTalk={
    PPL:'Trenujemy Push / Pull / Nogi — dzielimy ciało na trzy dni ruchu, żeby mięśnie pracowały częściej niż raz w tygodniu.',
    FBW:'Trenujemy całe ciało na każdej sesji — przy mniejszej liczbie dni w tygodniu to najprostszy i najskuteczniejszy układ.',
    'Upper Lower':'Trenujemy na przemian górę i dół ciała — każda partia dostaje bodziec zwykle dwa razy w tygodniu.',
    UL:'Trenujemy na przemian górę i dół ciała — każda partia dostaje bodziec zwykle dwa razy w tygodniu.',
    Arnold:'Plan jest bardziej „sylwetkowy”: osobne dni na klatkę+plecy, barki+ramiona i nogi — dużo pracy na kształt.',
    'Bro Split':'Każdy dzień to inna partia — dużo pracy lokalnie w jednej sesji; trzymamy jakość ruchu i regenerację.',
    '531':'Główny cel to siła na wielostawach (przysiad, wyciskanie, martwy, wyciskanie nad głowę) z jasną progresją ciężaru.',
    '5/3/1':'Główny cel to siła na wielostawach z jasną progresją ciężaru.',
    Blokowa:'Plan idzie blokami: najpierw budujemy objętość, potem ciężar, potem domykamy — bez gonienia wszystkiego naraz.',
    Obwodowy:'Trening w obwodach / stacjach: krótsze przerwy, więcej ruchu w krótszym czasie — dobre do kondycji i redukcji.',
    Circuit:'Trening w obwodach / stacjach: krótsze przerwy, więcej ruchu w krótszym czasie.',
    Custom:'Układ dni dobraliśmy pod Ciebie — ważne, żebyś ćwiczył regularnie i z dobrą techniką.',
    'Własna':'Układ dni dobraliśmy pod Ciebie — ważne, żebyś ćwiczył regularnie i z dobrą techniką.'
  };
  const goalTalk={
    masa:'Cel: budować mięśnie. Robimy kilka solidnych serii i stopniowo dokładamy ciężar, gdy idzie łatwiej.',
    sila:'Cel: rosnąć w sile. Na początku sesji ciężkie ruchy główne, potem lżejsze uzupełnienia — bez pośpiechu między seriami.',
    redukcja:'Cel: schudnąć bez gubienia mięśni. Na siłowni trzymamy solidne ciężary; tłuszcz schodzi głównie z diety.',
    kondycja:'Cel: lepsza kondycja. Łączymy siłę z pracą oddechową / interwałami, bez przeciążania każdej sesji.',
    atletyzm:'Cel: moc i atletyzm. Najpierw skoki / szybkie ruchy na świeżo, potem siła — jakość ważniejsza niż liczba serii.',
    rehab:'Cel: bezpieczny powrót. Ćwiczymy z kontrolą, bez ostrego bólu i bez maksymalnych ciężarów.'
  };
  const levelTalk={
    poczatkujacy:'Zaczynamy spokojnie: nauka ruchu i stały, mały postęp — nie skaczemy objętością co tydzień.',
    sredni:'Masz już bazę — dokładamy obciążenie lub serie w tempie, które dasz radę regenerować.',
    zaawansowany:'Masz doświadczenie — trzymamy wysoką jakość serii i zostawiamy zapas (nie musisz co raz iść na maksa).'
  };
  const parts=[
    methodTalk[methodKey]||('Trenujemy metodą „'+(o.methodLabel||methodKey)+'”.'),
    goalTalk[goalKey]||goalTalk.masa,
    levelTalk[levelKey]||levelTalk.sredni
  ];
  if(!isNaN(weight)&&weight>0){
    if(goalKey==='redukcja'){
      parts.push('Przy ~'+Math.round(weight)+' kg dobieramy wygodniejsze warianty ćwiczeń i pilnujemy techniki — efekt wagi idzie z diety, nie z „cardio na siłowni”.');
    }else{
      parts.push('Przy ~'+Math.round(weight)+' kg dobieramy obciążenie i warianty pod Twój komfort stawów i technikę.');
    }
  }
  return parts.join(' ');
}
function buildMethodRationale(opts){
  const o=opts||{};
  const methodKey=normalizeRationaleMethod(o.method);
  const goalKey=String(o.goal||'masa').toLowerCase();
  const levelKey=String(o.level||'sredni').toLowerCase();
  const days=parseInt(o.daysPerWeek,10)||0;
  const weight=parseFloat(o.weight);
  const method=METHOD_WHY[methodKey]||METHOD_WHY.Custom||METHOD_WHY.PPL;
  const goal=GOAL_WHY[goalKey]||GOAL_WHY.masa;
  const levelTip=LEVEL_WHY[levelKey]||LEVEL_WHY.sredni;
  const tips=[];
  if(methodKey==='PPL'&&days&&days<4)tips.push('PPL przy '+days+' dniach: rozważ FBW lub Upper/Lower, albo skrócone PPL (np. Push+quad / Pull+ham / Upper).');
  if(methodKey==='FBW'&&days>=5)tips.push('FBW przy '+days+' dniach bywa zbyt częste — rozważ Upper/Lower lub PPL, żeby dać partiom regenerację.');
  if(methodKey==='Obwodowy'&&goalKey==='sila')tips.push('Obwód słabo buduje max 1RM — do siły dodaj 1–2 ciężkie wielostawy na początku albo wybierz PPL/531.');
  if(methodKey==='Obwodowy'&&days&&days>=5)tips.push('Obwód ≥5×/tydzień mocno obciąża regenerację — skróć rundy lub przeplataj dni lżejsze.');
  if(methodKey==='Bro Split'&&(goalKey==='masa'||goalKey==='redukcja'))tips.push('Przy hipertrofii preferuj ≥2 stymulacje partii/tydzień — bro split daje zwykle 1×; świadomie zwiększ częstotliwość lub objętość priorytetów.');
  if(goalKey==='sila'&&methodKey==='PPL')tips.push('Siła + PPL OK, ale trzymaj ciężkie wielostawy na początku sesji i dłuższe przerwy (3–5 min).');
  tips.push('Zapisuj RPE/RIR — decyzje o +kg / +seriach opieraj na trendzie, nie na jednym „złym dniu”.');
  if(!isNaN(weight)&&weight>0){
    if(goalKey==='redukcja'){
      tips.push('Waga ~'+Math.round(weight)+' kg (redukcja): utrzymaj ciężary robocze — nie zamieniaj treningu w cardio. Deficyt głównie z diety.');
      if(weight>=95)tips.push('Wyższa masa ciała: więcej maszyn / stabilnych wariantów na stawy, dłuższa rozgrzewka, kontroluj lądowanie i głębokość przysiadu.');
    }else if(goalKey==='masa'){
      tips.push('Waga ~'+Math.round(weight)+' kg (masa): celuj w progresję obciążenia przy RPE 7–9; objętość w strefie MEV–MAV.');
    }else if(goalKey==='sila'){
      tips.push('Waga ~'+Math.round(weight)+' kg (siła): priorytet technika wielostawów; nie gonij objętości kosztem jakości %1RM.');
    }else if(goalKey==='kondycja'){
      tips.push('Waga ~'+Math.round(weight)+' kg (kondycja): łącz obwody / interwały z 1–2 dniami siły, żeby nie tracić masy mięśniowej.');
    }
  }
  const clientTalk=buildClientTalkPlain({methodKey,methodLabel:method.label,goalKey,weight,levelKey});
  const trainerSources=typeof planningEvidenceSourceLines==='function'?planningEvidenceSourceLines():[];
  const trainerEntries=typeof getPlanningEvidenceEntries==='function'?getPlanningEvidenceEntries().filter(e=>!e.builtin).slice(0,5):[];
  const volGuide=volumeGuideForLevel(levelKey);
  const volSummary=VOLUME_PART_ORDER.slice(0,6).map(p=>p+': '+(volGuide.parts[p]||'—')+' s/tyg').join(' · ');
  return{
    methodKey,goalKey,levelKey,daysPerWeek:days||null,weight:(!isNaN(weight)&&weight>0)?weight:null,
    clientName:o.clientName||undefined,
    methodLabel:method.label,
    methodWhy:method.why,
    methodBest:method.best,
    goalLabel:goal.label,
    sets:goal.sets,
    reps:goal.reps,
    rpe:goal.rpe,
    rest:goal.rest,
    goalWhy:goal.why,
    volume:goal.volume,
    levelTip,
    levelVolumeLabel:volGuide.label+' ('+volGuide.tenure+')',
    levelVolumeNote:volGuide.note,
    levelVolumeParts:volGuide.parts,
    levelVolumeSummary:volSummary,
    volumeByLevel:VOLUME_BY_LEVEL,
    volumePartOrder:VOLUME_PART_ORDER,
    tips,
    clientTalk,
    sources:RATIONALE_SOURCES.concat(trainerSources).slice(0,12),
    trainerEntries
  };
}
function renderVolumeByLevelTable(r,esc){
  const order=r.volumePartOrder||VOLUME_PART_ORDER;
  const levels=['poczatkujacy','sredni','zaawansowany'];
  const labels={poczatkujacy:'Pocz.',sredni:'Średni',zaawansowany:'Zaaw.'};
  const cur=String(r.levelKey||'sredni').toLowerCase();
  const head=levels.map(l=>`<th class="mr-vol-th${l===cur?' is-current':''}">${esc(labels[l])}</th>`).join('');
  const rows=order.map(part=>{
    const cells=levels.map(l=>{
      const v=(r.volumeByLevel&&r.volumeByLevel[l]&&r.volumeByLevel[l].parts&&r.volumeByLevel[l].parts[part])||'—';
      return `<td class="mr-vol-td${l===cur?' is-current':''}">${esc(v)}</td>`;
    }).join('');
    return `<tr><th scope="row" class="mr-vol-part">${esc(part)}</th>${cells}</tr>`;
  }).join('');
  return `<div class="mr-vol-wrap">
    <div class="mr-meta" style="margin-bottom:6px;">Serie robocze / partię / <b>tydzień</b> (hipertrofia · MEV–MAV). Kolumna <b>${esc(r.levelVolumeLabel||'')}</b> = wybrany staż klienta.</div>
    <table class="mr-vol-table"><thead><tr><th class="mr-vol-part">Partia</th>${head}</tr></thead><tbody>${rows}</tbody></table>
    <div class="mr-meta" style="margin-top:6px;">${esc(r.levelVolumeNote||'')}</div>
    <div class="mr-note">Siła / rehab: trzymaj dolną połowę zakresu; kondycja: okolice MEV + osobne sesje cardio. Nie sumuj „wszystkie partie na MRV” naraz.</div>
  </div>`;
}
function renderMethodRationaleHTML(opts){
  const r=typeof opts==='object'&&opts.methodWhy?opts:buildMethodRationale(opts||{});
  const escFn=(typeof window!=='undefined'&&typeof window.escHtml==='function')?window.escHtml:(typeof escHtml==='function'?escHtml:null);
  const esc=escFn||(s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
  const row=(k,v)=>`<div class="mr-row"><span class="mr-k">${esc(k)}</span><span class="mr-v">${esc(v)}</span></div>`;
  const trainerBlock=(r.trainerEntries&&r.trainerEntries.length)?`<div class="mr-block mr-card"><div class="mr-block-head"><span class="mr-eyebrow">Baza</span><span class="mr-block-title">Twoje zasady / dowody</span></div><ul class="mr-tips">${r.trainerEntries.map(e=>{
    const tag=e.kind==='evidence'?'Źródło':(e.kind==='principle'?'Zasada':'Notatka');
    return `<li><b>${esc(tag)}:</b> ${esc(e.title)}${e.citation?' — '+esc(e.citation):''}</li>`;
  }).join('')}</ul></div>`:'';
  const volPreview=r.levelVolumeSummary?`<div class="mr-vol-preview">${esc(r.levelVolumeSummary)}</div>`:'';
  try{window._lastMethodRationale=r;}catch(e){}
  const ctxBits=[r.methodLabel,r.goalLabel,r.levelVolumeLabel].filter(Boolean).join(' · ');
  return`<details class="method-rationale">
    <summary class="method-rationale-hdr">
      <div class="method-rationale-hdr-main">
        <div class="method-rationale-kicker">Dlaczego tak? · przewodnik</div>
        <div class="method-rationale-title">Asystent trenera</div>
        <div class="method-rationale-toggle-hint method-rationale-hint-closed">Naciśnij nagłówek, aby rozwinąć · Więcej = pełny przewodnik</div>
        <div class="method-rationale-toggle-hint method-rationale-hint-open">Kliknij nagłówek, aby zwinąć · Więcej = pełny przewodnik</div>
        ${ctxBits?`<div class="method-rationale-ctx">${esc(ctxBits)}</div>`:''}
      </div>
      <div class="method-rationale-actions" onclick="event.preventDefault();event.stopPropagation();">
        <button type="button" class="mr-action-btn mr-more-btn" onclick="openMethodRationaleModal()" title="Pełny przewodnik: objętość, serie, powtórzenia">Więcej</button>
        <span class="method-rationale-badge" aria-hidden="true"></span>
      </div>
    </summary>
    <div class="method-rationale-body">
      <div class="mr-chips" aria-label="Źródła">
        <span class="mr-chip">NSCA</span>
        <span class="mr-chip">ACSM</span>
        <span class="mr-chip mr-chip--accent">Twoja baza</span>
      </div>
      <div class="mr-block mr-card mr-client-talk">
        <div class="mr-block-head">
          <span class="mr-eyebrow">Dla klienta</span>
          <span class="mr-block-title">Jak wytłumaczyć klientowi</span>
        </div>
        <div class="mr-text">${esc(r.clientTalk||'')}</div>
        <div class="mr-meta">Krótka wersja — skopiuj do SMS / wiadomości.</div>
      </div>
      <div class="mr-block mr-card">
        <div class="mr-block-head">
          <span class="mr-eyebrow">Metoda</span>
          <span class="mr-block-title">${esc(r.methodLabel)}</span>
        </div>
        <div class="mr-text">${esc(r.methodWhy)}</div>
        <div class="mr-meta">Najlepiej: ${esc(r.methodBest)}</div>
      </div>
      <div class="mr-block mr-card">
        <div class="mr-block-head">
          <span class="mr-eyebrow">Cel</span>
          <span class="mr-block-title">${esc(r.goalLabel)}</span>
        </div>
        <div class="mr-text">${esc(r.goalWhy)}</div>
        <div class="mr-stats">
          ${row('Serie',r.sets)}
          ${row('Powtórzenia',r.reps)}
          ${row('RPE / RIR',r.rpe)}
          ${row('Przerwy',r.rest)}
          ${row('Objętość/tyg.',r.volume)}
        </div>
      </div>
      <div class="mr-block mr-card">
        <div class="mr-block-head">
          <span class="mr-eyebrow">Poziom / staż</span>
          <span class="mr-block-title">${esc(r.levelVolumeLabel||'')}</span>
        </div>
        <div class="mr-text">${esc(r.levelTip)}</div>
        ${volPreview}
      </div>
      <details class="mr-volume mr-card">
        <summary class="mr-block-title">Serie na partię wg stażu — rozwiń tabelę</summary>
        ${renderVolumeByLevelTable(r,esc)}
      </details>
      ${r.tips&&r.tips.length?`<div class="mr-block mr-card"><div class="mr-block-head"><span class="mr-eyebrow">Wskazówki</span><span class="mr-block-title">${r.weight?'Waga ~'+Math.round(r.weight)+' kg':'Na co uważać'}</span></div><ul class="mr-tips">${r.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}
      ${trainerBlock}
      <details class="mr-sources mr-card">
        <summary class="mr-block-title">Źródła (edukacyjne + baza) — rozwiń</summary>
        <ul class="mr-tips mr-tips-sm">${(r.sources||[]).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
        <div class="mr-note">Brak live PubMed — wbudowane ramy + linki, które dodasz w Bazie wiedzy (zasady / badania). AI i kreator biorą je jako kontekst planowania.</div>
      </details>
    </div>
  </details>`;
}
/** Jedna ściągawka: objętość / serie / powt. / RPE / zależności — pod przyciskiem w builderze. */
function renderTrainerCheatSheetHTML(opts){
  const r=typeof opts==='object'&&opts.methodWhy?opts:buildMethodRationale(opts||{});
  const escFn=(typeof window!=='undefined'&&typeof window.escHtml==='function')?window.escHtml:(typeof escHtml==='function'?escHtml:null);
  const esc=escFn||(s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
  const row=(k,v)=>`<div class="mr-row"><span class="mr-k">${esc(k)}</span><span class="mr-v">${esc(v)}</span></div>`;
  const ctxBits=[
    r.clientName?('Klient: '+r.clientName):'',
    r.methodLabel?('Metoda: '+r.methodLabel):'',
    r.goalLabel?('Cel: '+r.goalLabel):'',
    r.levelVolumeLabel?('Staż: '+r.levelVolumeLabel):'',
    r.daysPerWeek?('Dni/tyg.: '+r.daysPerWeek):'',
    r.weight?('Waga ~'+Math.round(r.weight)+' kg'):''
  ].filter(Boolean);
  const fieldRules=[
    {k:'Serie / ćw.',v:r.sets||'3–4 robocze'},
    {k:'Powtórzenia',v:r.reps||'6–12'},
    {k:'RPE / RIR',v:(r.rpe||'RPE 7–9')+' · RIR ≈ 10 − RPE'},
    {k:'Przerwy',v:r.rest||'60–120 s'},
    {k:'Tempo',v:'np. 3-1-1-0 (ekscentryka–pauza–koncentryka–pauza)'},
    {k:'Częstotliwość',v:'Hipertrofia: ≥2 stymulacje partii / tydzień'},
    {k:'Deload',v:'Co 4–6 tyg. lub wcześniej przy dryfie RPE / słabym śnie'}
  ];
  const periodByLevel={
    poczatkujacy:'4 tyg.: adaptacja → budowa → deload (RPE ~7→6). Mało serii, nauka ruchu.',
    sredni:'4 tyg. DUP: objętość / intensywność na przemian, deload w 4. RPE 7→9.',
    zaawansowany:'Blok 6 tyg.: akumulacja → intensyfikacja → realizacja → deload. Nie trzymaj wszystkich partii na MRV.'
  };
  const period=periodByLevel[String(r.levelKey||'sredni').toLowerCase()]||periodByLevel.sredni;
  return`<div class="trainer-cheat" id="trainer-cheat-root">
    <div class="tch-hero">
      <div class="tch-kicker">Ściągawka trenera</div>
      <div class="tch-sub">Objętość · serie · powtórzenia · RPE · zależności — bez szukania po apce</div>
      <div class="tch-ctx">${ctxBits.map(b=>`<span class="tch-chip">${esc(b)}</span>`).join('')}</div>
    </div>
    <div class="tch-grid">
      <div class="mr-block tch-card">
        <div class="mr-block-title">Parametry pod cel: ${esc(r.goalLabel||'')}</div>
        <div class="mr-text">${esc(r.goalWhy||'')}</div>
        ${row('Serie',r.sets)}
        ${row('Powtórzenia',r.reps)}
        ${row('RPE / RIR',r.rpe)}
        ${row('Przerwy',r.rest)}
        ${row('Objętość/tyg.',r.volume)}
      </div>
      <div class="mr-block tch-card">
        <div class="mr-block-title">Metoda: ${esc(r.methodLabel||'')}</div>
        <div class="mr-text">${esc(r.methodWhy||'')}</div>
        <div class="mr-meta">Najlepiej: ${esc(r.methodBest||'')}</div>
        <div class="mr-block-title" style="margin-top:10px;">Periodyzacja (${esc(r.levelVolumeLabel||'staż')})</div>
        <div class="mr-text">${esc(period)}</div>
        <div class="mr-meta">${esc(r.levelTip||'')}</div>
      </div>
    </div>
    <div class="mr-block tch-card tch-volume">
      <div class="mr-block-title">Serie robocze / partię / tydzień (MEV–MAV)</div>
      ${renderVolumeByLevelTable(r,esc)}
    </div>
    <div class="mr-block tch-card">
      <div class="mr-block-title">Szybkie reguły przy wpisywaniu serii</div>
      <div class="tch-rules">${fieldRules.map(x=>`<div class="tch-rule"><span class="tch-rule-k">${esc(x.k)}</span><span class="tch-rule-v">${esc(x.v)}</span></div>`).join('')}</div>
    </div>
    ${r.tips&&r.tips.length?`<div class="mr-block tch-card"><div class="mr-block-title">Zależności / ostrzeżenia${r.weight?' · waga ~'+Math.round(r.weight)+' kg':''}</div><ul class="mr-tips">${r.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}
    <div class="mr-block tch-card mr-client-talk">
      <div class="mr-block-title">Jak wytłumaczyć klientowi</div>
      <div class="mr-text">${esc(r.clientTalk||'')}</div>
    </div>
    <div class="tch-foot">NSCA · ACSM · Schoenfeld / Israetel (ramy MEV–MAV) · Twoja Baza wiedzy</div>
  </div>`;
}
function resolveMethodRationaleOpts(opts){
  if(opts&&typeof opts==='object'&&(opts.methodWhy||opts.method||opts.goal||opts.level))return opts;
  const screenActive=(id)=>{const el=document.getElementById(id);return!!(el&&el.classList.contains('active'));};
  if(screenActive('screen-aiplangen')&&typeof aplEduCtx==='function'){
    try{
      const ctx=aplEduCtx()||{};
      if(ctx.method||ctx.goal||ctx.level||ctx.clientName)return ctx;
    }catch(e){}
  }
  if(screenActive('screen-builder')&&typeof builderEduCtx==='function'){
    try{
      const ctx=builderEduCtx()||{};
      const days=document.querySelectorAll('#builder-days .builder-day').length;
      return{method:ctx.method,goal:ctx.goal,level:ctx.level,weight:ctx.weight,daysPerWeek:days||undefined,clientId:ctx.clientId,clientName:ctx.clientName};
    }catch(e){}
  }
  if(typeof aplEduCtx==='function'&&document.getElementById('apl-client')?.value){
    try{return aplEduCtx()||{};}catch(e){}
  }
  if(typeof builderEduCtx==='function'&&document.getElementById('b-client')?.value){
    try{
      const ctx=builderEduCtx()||{};
      const days=document.querySelectorAll('#builder-days .builder-day').length;
      return{method:ctx.method,goal:ctx.goal,level:ctx.level,weight:ctx.weight,daysPerWeek:days||undefined,clientId:ctx.clientId,clientName:ctx.clientName};
    }catch(e){}
  }
  return window._lastMethodRationale||{};
}
function openMethodRationaleModal(opts){
  const mount=document.getElementById('method-rationale-modal-body');
  if(!mount){if(typeof notify==='function')notify('Brak okna ściągawki');return;}
  const src=resolveMethodRationaleOpts(opts);
  const r=typeof src==='object'&&src.methodWhy?src:buildMethodRationale(src||{});
  if(src.clientName&&!r.clientName)r.clientName=src.clientName;
  try{window._lastMethodRationale=r;}catch(e){}
  mount.innerHTML=renderTrainerCheatSheetHTML(r);
  const title=document.querySelector('#m-method-rationale .modal-title');
  if(title)title.textContent=r.clientName?('ŚCIĄGAWKA — '+String(r.clientName).toUpperCase()):'ŚCIĄGAWKA TRENERA';
  if(typeof openM==='function')openM('m-method-rationale');
}
function printTrainerCheatSheet(){
  // Zawsze odśwież treść spod aktualnego klienta / metody w builderze
  const mount=document.getElementById('method-rationale-modal-body');
  const src=resolveMethodRationaleOpts();
  const r=typeof src==='object'&&src.methodWhy?src:buildMethodRationale(src||{});
  try{window._lastMethodRationale=r;}catch(e){}
  const sheet=renderTrainerCheatSheetHTML(r);
  if(mount){
    mount.innerHTML=sheet;
    const title=document.querySelector('#m-method-rationale .modal-title');
    if(title)title.textContent='ŚCIĄGAWKA TRENERA';
  }
  const html=(document.getElementById('trainer-cheat-root')||{innerHTML:sheet}).innerHTML||sheet;
  if(!html){if(typeof notify==='function')notify('Brak treści do druku');return;}
  const w=window.open('','_blank','noopener,noreferrer,width=900,height=700');
  if(!w){
    if(typeof openM==='function')openM('m-method-rationale');
    document.body.classList.add('printing-cheat-sheet');
    window.print();
    setTimeout(()=>document.body.classList.remove('printing-cheat-sheet'),800);
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Ściągawka trenera — Progress Live</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;padding:18px 22px;font-size:12px;line-height:1.45;}
  .tch-kicker{font-size:18px;font-weight:700;margin:0 0 4px;font-family:system-ui,sans-serif;}
  .tch-sub,.mr-meta,.tch-foot{color:#444;font-size:11px;}
  .tch-ctx{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px;}
  .tch-chip{border:1px solid #ccc;border-radius:4px;padding:2px 8px;font-size:11px;font-family:system-ui,sans-serif;}
  .tch-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  @media(max-width:720px){.tch-grid{grid-template-columns:1fr;}}
  .tch-card,.mr-block{border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:12px;break-inside:avoid;}
  .mr-block-title{font-weight:700;font-size:12px;margin:0 0 6px;font-family:system-ui,sans-serif;}
  .mr-row{display:grid;grid-template-columns:100px 1fr;gap:6px;margin-top:3px;}
  .mr-k{color:#555;font-weight:600;}
  .mr-vol-table{width:100%;border-collapse:collapse;margin-top:6px;}
  .mr-vol-table th,.mr-vol-table td{border:1px solid #ccc;padding:4px 6px;text-align:left;}
  .mr-vol-table .is-current{background:#f0f0f0;font-weight:700;}
  .tch-rules{display:grid;gap:4px;}
  .tch-rule{display:grid;grid-template-columns:110px 1fr;gap:8px;}
  .tch-rule-k{font-weight:700;font-family:system-ui,sans-serif;}
  .mr-tips{margin:4px 0 0;padding-left:18px;}
  .tch-foot{margin-top:8px;border-top:1px solid #ddd;padding-top:8px;}
  @media print{body{padding:0;} .tch-card{break-inside:avoid;}}
</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>{try{w.print();}catch(e){}},250);
}
function refreshMethodRationaleInto(el,opts){
  if(!el)return;
  el.innerHTML=renderMethodRationaleHTML(opts||{});
}
window.METHOD_WHY=METHOD_WHY;
window.GOAL_WHY=GOAL_WHY;
window.LEVEL_WHY=LEVEL_WHY;
window.buildClientTalkPlain=buildClientTalkPlain;
window.buildMethodRationale=buildMethodRationale;
window.renderMethodRationaleHTML=renderMethodRationaleHTML;
window.renderTrainerCheatSheetHTML=renderTrainerCheatSheetHTML;
window.renderVolumeByLevelTable=renderVolumeByLevelTable;
window.openMethodRationaleModal=openMethodRationaleModal;
window.openTrainerCheatSheet=openMethodRationaleModal;
window.printTrainerCheatSheet=printTrainerCheatSheet;
window.refreshMethodRationaleInto=refreshMethodRationaleInto;
window.normalizeRationaleMethod=normalizeRationaleMethod;

// ════════════════════════════════════════
// TOOLTIPY EDUKACYJNE (Serie / RPE / Metoda…)
// ════════════════════════════════════════
const EDU_TIPS={
  method:'Metoda = jak dzielisz ciało na dni (PPL, FBW, Upper/Lower…). Przy hipertrofii celuj w ≥2 stymulacje partii/tydzień. Szczegóły w panelu „Dlaczego tak?”.',
  goal:'Cel ustala zakresy: masa → objętość i RIR 0–3; siła → wyższy %1RM i dłuższe przerwy; redukcja → utrzymaj ciężar, nie tnij od razu objętości.',
  sets:'Serie robocze na ćwiczenie. Hipertrofia zwykle 3–4; siła 3–6 na głównych. Sumę tygodniową partii (MEV–MAV) wg stażu zobaczysz w przewodniku „Serie na partię”.',
  reps:'Powtórzenia: hipertrofia złożone ~6–10, izolacje ~8–15; siła główne ~1–6. Dobierz tak, by ostatnie powt. były blisko upadku (patrz RPE/RIR).',
  kg:'Ciężar roboczy. Możesz liczyć z %1RM (Pomiary → Siła bazowa). Zostaw puste, jeśli klient dobiera wg RPE.',
  rpe:'RPE 1–10: jak trudna była seria. RPE 8 ≈ zostały ~2 powtórzenia (RIR 2). Hipertrofia często RPE 7–9; unikaj ciągłego RPE 10.',
  rir:'RIR = powtórzenia w zapasie. RIR 0 = upadek; RIR 2 ≈ RPE 8. Łatwiejsze w komunikacji z klientem niż samo RPE.',
  rest:'Przerwa: izolacje ~60–90 s; wielostawy hipertrofia ~90–120 s; siła 2–5 min. Za krótka przerwa psuje jakość kolejnej serii.',
  tempo:'Tempo np. 3-1-1-0 = ekscentryka 3 s – pauza w rozciągnięciu 1 s – koncentryka 1 s – pauza 0. Pomaga w kontroli i stretch-mediated hypertrophy.',
  focus:'Etykieta dnia (Push/Pull/FBW…). Uzupełnia się z metody — możesz nadpisać własną nazwą.',
  days:'Liczba dni/tydzień musi pasować do metody: FBW 2–3, Upper/Lower 3–4, PPL 4–6. Za mało dni przy PPL = słaba częstotliwość partii.'
};
function eduTipText(key,ctx){
  const k=String(key||'');
  const o=ctx||{};
  if(k==='method'&&o.method&&typeof METHOD_WHY==='object'){
    const mk=typeof normalizeRationaleMethod==='function'?normalizeRationaleMethod(o.method):o.method;
    const m=METHOD_WHY[mk];
    if(m)return m.label+': '+m.why+(m.best?' Najlepiej: '+m.best+'.':'');
  }
  if((k==='sets'||k==='reps'||k==='rpe')&&o.goal&&typeof GOAL_WHY==='object'){
    const g=GOAL_WHY[String(o.goal).toLowerCase()];
    if(g){
      if(k==='sets')return g.sets+'. '+g.why;
      if(k==='reps')return g.reps+'. '+g.why;
      if(k==='rpe')return g.rpe+'. RIR ≈ 10 − RPE.';
    }
  }
  return EDU_TIPS[k]||'Podpowiedź metodyczna — zobacz panel „Dlaczego tak?”.';
}
function eduTipMark(key,opts){
  const text=eduTipText(key,opts);
  const esc=(typeof window!=='undefined'&&window.escHtml)?window.escHtml:(s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'));
  const safe=esc(text);
  return `<button type="button" class="edu-tip" data-edu="${esc(key)}" data-tip="${safe}" title="${safe}" aria-label="Wyjaśnienie: ${esc(key)}">?</button>`;
}
function eduLbl(label,key,opts){
  return `<span class="edu-lbl">${label}${eduTipMark(key,opts)}</span>`;
}
window.EDU_TIPS=EDU_TIPS;
window.eduTipText=eduTipText;
window.eduTipMark=eduTipMark;
window.eduLbl=eduLbl;

function hydrateEduTips(root){
  const scope=root&&root.querySelectorAll?root:document;
  scope.querySelectorAll('.edu-tip[data-edu]').forEach(btn=>{
    const key=btn.getAttribute('data-edu');
    const ctx={};
    if(key==='method'){
      const m=document.getElementById('b-method')||document.getElementById('tplc-method');
      if(m)ctx.method=m.value;
      if(typeof aplGetVal==='function'){try{ctx.method=aplGetVal('apl-methods')||ctx.method;}catch(e){}}
    }
    if(key==='goal'||key==='sets'||key==='reps'||key==='rpe'){
      const g=document.getElementById('tplc-goal');
      if(g)ctx.goal=g.value;
      if(typeof aplGetVal==='function'){try{ctx.goal=aplGetVal('apl-goals')||ctx.goal;}catch(e){}}
      if(typeof builderEduCtx==='function'){try{Object.assign(ctx,builderEduCtx());}catch(e){}}
    }
    const text=eduTipText(key,ctx);
    btn.setAttribute('data-tip',text);
    btn.setAttribute('title',text);
  });
}
function bindEduTipClicks(){
  if(window._eduTipsBound)return;
  window._eduTipsBound=true;
  document.addEventListener('click',e=>{
    const tip=e.target.closest&&e.target.closest('.edu-tip');
    if(!tip){
      document.querySelectorAll('.edu-tip.is-open').forEach(b=>b.classList.remove('is-open'));
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    hydrateEduTips(tip.parentElement||document);
    const open=tip.classList.contains('is-open');
    document.querySelectorAll('.edu-tip.is-open').forEach(b=>b.classList.remove('is-open'));
    if(!open)tip.classList.add('is-open');
  });
}
window.hydrateEduTips=hydrateEduTips;
window.bindEduTipClicks=bindEduTipClicks;
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindEduTipClicks();hydrateEduTips();});
  else{bindEduTipClicks();hydrateEduTips();}
}
