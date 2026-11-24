/* RODO w aplikacji klienta: polityka prywatności, zgody (rejestracja + jednorazowo dla istniejących kont),
 * „Pobierz moje dane” i prośba o usunięcie konta. Zgody zapisują się na karcie klienta w polu `consents`
 * (reguły Firestore przyjmują tylko ten kształt). Gdy zapis się nie uda (brak sieci, stare reguły), zgoda czeka w telefonie
 * i zapisuje się przy następnym uruchomieniu — klient nie jest o nią pytany drugi raz. */
'use strict';

const PRIVACY_VERSION='2026-11-24';
const PRIVACY_URL='polityka-prywatnosci.html';
const PRIVACY_PENDING_KEY='pl_privacy_pending_v1:';

function privacyEsc(s){return typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function privacyConsentsOf(c){return c&&c.consents&&typeof c.consents==='object'?c.consents:null;}
/** Czy klient przyjął aktualną wersję polityki (na karcie albo w oczekującym zapisie w telefonie). */
function privacyAccepted(c){
  const k=privacyConsentsOf(c);
  if(k&&k.privacy&&k.privacy.version===PRIVACY_VERSION)return true;
  const p=privacyPendingRead(c&&c.id);
  return !!(p&&p.privacy&&p.privacy.version===PRIVACY_VERSION);
}
/** Zgoda na dane o zdrowiu (pomiary, zdjęcia). Karta bez żadnych zgód (podgląd trenera, testy, stare konta przed bramką) = bez blokady. */
function privacyHealthAllowed(c){
  const k=privacyConsentsOf(c)||privacyPendingRead(c&&c.id);
  if(!k||!k.health)return !k;
  return k.health.granted===true;
}
function privacyBuildConsents(health,prev){
  const at=new Date().toISOString();
  return {privacy:{version:PRIVACY_VERSION,at},health:{granted:!!health,at:(prev&&prev.health&&prev.health.granted===!!health&&prev.health.at)||at}};
}
function privacyPendingRead(cid){
  if(!cid)return null;
  try{const raw=localStorage.getItem(PRIVACY_PENDING_KEY+cid);return raw?JSON.parse(raw):null;}catch(e){return null;}
}
function privacyPendingWrite(cid,consents){try{if(cid)localStorage.setItem(PRIVACY_PENDING_KEY+cid,JSON.stringify(consents));}catch(e){}}
function privacyPendingClear(cid){try{if(cid)localStorage.removeItem(PRIVACY_PENDING_KEY+cid);}catch(e){}}

/** Zapis zgód na karcie klienta. Zwraca true po zapisie na serwerze; inaczej zostawia zgodę w telefonie. */
async function privacySaveConsents(cid,consents){
  const c=(window.CL||[]).find(x=>x&&x.id===cid);
  if(c)c.consents=consents;
  if(!cid||!window._setDoc||!window._doc||!window._db){privacyPendingWrite(cid,consents);return false;}
  try{
    await window._setDoc(window._doc(window._db,'clients',cid),{consents},{merge:true});
    privacyPendingClear(cid);
    return true;
  }catch(e){
    console.warn('Zgody RODO — zapis odłożony:',e&&e.code||e);
    privacyPendingWrite(cid,consents);
    return false;
  }
}
async function privacyFlushPending(cid){const p=privacyPendingRead(cid);if(p)await privacySaveConsents(cid,p);}

/* ── Jednorazowa bramka dla kont założonych przed wprowadzeniem zgód (i po zmianie wersji polityki) ── */
function privacyGateHTML(){
  return `<div class="pv-gate" id="pv-gate" role="dialog" aria-modal="true" aria-labelledby="pv-gate-h">
    <div class="pv-gate-card">
      <h2 id="pv-gate-h">Twoje dane w Progress Live</h2>
      <p>Zanim przejdziesz dalej: Twoje dane służą tylko do prowadzenia Twoich treningów. Widzisz je Ty i Twój trener.</p>
      <label class="pv-check"><input type="checkbox" id="pv-gate-privacy"><span>Zapoznałem(-am) się z <a href="${PRIVACY_URL}" target="_blank" rel="noopener">polityką prywatności</a> i ją akceptuję. <em>wymagane</em></span></label>
      <label class="pv-check"><input type="checkbox" id="pv-gate-health"><span>Zgadzam się na przetwarzanie moich danych o zdrowiu — pomiarów ciała, zdjęć sylwetki, informacji o kontuzjach i filmów techniki — w celu prowadzenia treningów. <em>opcjonalne, możesz zmienić w Profilu</em></span></label>
      <p class="pv-err" id="pv-gate-err" role="alert" hidden>Zaznacz akceptację polityki prywatności.</p>
      <button type="button" class="cs-btn cs-btn-primary" onclick="privacyGateAccept()">Przejdź dalej</button>
      <button type="button" class="cs-link" onclick="doSignOut()">Wyloguj się</button>
    </div>
  </div>`;
}
function privacyGateCheck(){
  const c=(window.CL||[])[0];
  if(!c||!c.id)return;
  privacyFlushPending(c.id);
  if(privacyAccepted(c)||document.getElementById('pv-gate'))return;
  document.body.insertAdjacentHTML('beforeend',privacyGateHTML());
  const prev=privacyConsentsOf(c);
  const h=document.getElementById('pv-gate-health');if(h&&prev&&prev.health)h.checked=prev.health.granted===true;
  setTimeout(()=>{const f=document.getElementById('pv-gate-h');if(f){f.tabIndex=-1;f.focus();}},0);
}
async function privacyGateAccept(){
  const ok=document.getElementById('pv-gate-privacy');
  const err=document.getElementById('pv-gate-err');
  if(!ok||!ok.checked){if(err)err.hidden=false;if(ok)ok.focus();return;}
  const c=(window.CL||[])[0];if(!c)return;
  const health=!!(document.getElementById('pv-gate-health')||{}).checked;
  const gate=document.getElementById('pv-gate');if(gate)gate.remove();
  await privacySaveConsents(c.id,privacyBuildConsents(health,privacyConsentsOf(c)));
  if(typeof setClientLiveScreen==='function'&&window._clientLiveScreen)setClientLiveScreen(window._clientLiveScreen);
}

/* ── Profil klienta → Prywatność ── */
function privacyFmtDate(iso){
  const d=new Date(iso||'');if(isNaN(d))return '';
  return d.toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'});
}
function privacyProfileCardHTML(c){
  const k=privacyConsentsOf(c)||privacyPendingRead(c&&c.id)||{};
  const pol=k.privacy&&k.privacy.version===PRIVACY_VERSION;
  const health=!!(k.health&&k.health.granted);
  return `<section class="pv-card" data-pv-card aria-labelledby="pv-card-h">
    <h2 id="pv-card-h">Prywatność</h2>
    <p class="pv-line">${pol?'Polityka prywatności zaakceptowana '+privacyEsc(privacyFmtDate(k.privacy.at)):'Polityka prywatności: brak akceptacji'} · <a href="${PRIVACY_URL}" target="_blank" rel="noopener">Przeczytaj</a></p>
    <label class="pv-check pv-switch"><input type="checkbox" ${health?'checked':''} onchange="privacyToggleHealth(this.checked)"><span><b>Dane o zdrowiu</b> — pomiary ciała, zdjęcia sylwetki, kontuzje, filmy techniki${k.health&&k.health.at?` <em>${health?'zgoda od':'wycofana'} ${privacyEsc(privacyFmtDate(k.health.at))}</em>`:''}</span></label>
    <button type="button" class="cap-btn-secondary pv-btn" onclick="privacyExportData()">Pobierz moje dane</button>
    <button type="button" class="cap-btn-secondary pv-btn pv-danger" onclick="privacyDeleteOpen()">Usuń konto i dane</button>
  </section>`;
}
async function privacyToggleHealth(on){
  const c=(window.CL||[])[0];if(!c)return;
  const prev=privacyConsentsOf(c)||privacyPendingRead(c.id);
  const next={privacy:(prev&&prev.privacy)||{version:PRIVACY_VERSION,at:new Date().toISOString()},health:{granted:!!on,at:new Date().toISOString()}};
  const saved=await privacySaveConsents(c.id,next);
  if(typeof notify==='function')notify(on?'Zgoda na dane o zdrowiu zapisana':'Zgoda na dane o zdrowiu wycofana'+(saved?'':' — zapisze się po połączeniu'));
  if(typeof setClientLiveScreen==='function')setClientLiveScreen('profile');
}

/** Kopia danych klienta (art. 15 i 20 RODO) z tego, co aplikacja już ma w pamięci — plik JSON do pobrania. */
function privacyExportPayload(){
  const c=(window.CL||[])[0]||{};const cid=c.id;
  const mine=list=>(list||[]).filter(x=>x&&x.clientId===cid);
  const photos=mine(window.PROGRESS_PHOTOS).map(p=>({id:p.id,date:p.date,weight:p.weight||null,views:Object.keys(p.photos||{})}));
  return {
    exportedAt:new Date().toISOString(),
    note:'Kopia Twoich danych z aplikacji Progress Live. Zdjęcia są wymienione bez plików — pobierzesz je w aplikacji albo poprosisz trenera.',
    profile:{name:c.name||'',email:c.email||'',goal:c.goal||'',level:c.level||'',injuries:c.injuries||'',weight:c.weight||'',preferredWeekdays:c.preferredWeekdays||[],consents:c.consents||null},
    plans:mine(window.PL).map(p=>({name:p.name,startDate:p.startDate,days:(p.days||[]).map(d=>({day:d.day,exercises:(d.exercises||[]).map(e=>({name:e.name,sets:e.sets,reps:e.reps,kg:e.kg}))}))})),
    workouts:mine(window.SE).map(s=>({date:s.date,type:s.type||s.title||'',source:s.source||'',duration:s.duration||null,feedback:s.feedback||null,exercises:(s.exercises||[]).map(e=>({name:e.name,sets:e.sets||[]}))})),
    measurements:mine(window.METRIC_ENTRIES).map(m=>({date:m.date,group:m.groupId,values:m.values})),
    progressPhotos:photos,
    checkins:((window.CHECKINS||{})[cid]||[]).map(x=>({date:x.date,answers:x.answers||{}})),
    messages:((window.MSGS||{})[cid]||[]).map(m=>({at:m.createdAt||'',fromTrainer:!!m.out,text:m.text||''})),
    tasks:mine(window.TASKS).map(t=>({title:t.title||'',status:t.status||'',date:t.date||t.dueDate||''})),
    packages:mine(window.PACKAGES).map(p=>({title:p.title||'',sessions:p.sessions||0,used:p.sessionsUsed||0,price:p.price||null,status:p.payStatus||p.status||''}))
  };
}
function privacyExportData(){
  const data=privacyExportPayload();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='progress-live-moje-dane-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
  if(typeof notify==='function')notify('Plik z Twoimi danymi jest gotowy');
}

/** Prośba o usunięcie konta (art. 17 RODO): wiadomość w czacie + powiadomienie dla trenera. Dane usuwa trener w panelu. */
function privacyDeleteOpen(){
  if(document.getElementById('pv-del'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="pv-gate" id="pv-del" role="dialog" aria-modal="true" aria-labelledby="pv-del-h">
    <div class="pv-gate-card">
      <h2 id="pv-del-h">Usunąć konto i dane?</h2>
      <p>Wyślemy trenerowi prośbę o usunięcie Twojego konta i danych (plany, treningi, pomiary, zdjęcia, wiadomości). Trener zrobi to w ciągu 30 dni i potwierdzi w czacie. Dokumenty rozliczeniowe zostają tak długo, jak wymaga prawo.</p>
      <p>Najpierw możesz pobrać kopię swoich danych.</p>
      <button type="button" class="cs-btn cs-btn-secondary" onclick="privacyExportData()">Pobierz moje dane</button>
      <button type="button" class="cs-btn cs-btn-primary pv-danger-btn" onclick="privacyDeleteSend()">Wyślij prośbę o usunięcie</button>
      <button type="button" class="cs-link" onclick="document.getElementById('pv-del').remove()">Anuluj</button>
    </div></div>`);
}
async function privacyDeleteSend(){
  const c=(window.CL||[])[0];const box=document.getElementById('pv-del');
  if(!c){if(box)box.remove();return;}
  const at=new Date().toISOString();const tid=c.trainerId||window._trainerId;
  const text='Proszę o usunięcie mojego konta i danych w Progress Live (RODO, art. 17). Data prośby: '+privacyFmtDate(at)+'.';
  let sent=false;
  try{
    if(window._setDoc&&window._doc&&window._db){
      const id='msg_rodo_'+c.id+'_'+Date.now();
      await window._setDoc(window._doc(window._db,'messages',id),{id,trainerId:tid,clientId:c.id,text,out:false,kind:'direct',time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),createdAt:at});
      window.MSGS=window.MSGS||{};(window.MSGS[c.id]=window.MSGS[c.id]||[]).push({id,clientId:c.id,text,out:false,createdAt:at});
      const nid='n_rodo_'+c.id+'_'+Date.now();
      try{await window._setDoc(window._doc(window._db,'notifications',nid),{id:nid,trainerId:tid,clientId:c.id,type:'system',title:'Prośba o usunięcie danych',body:(c.name||'Klient')+' prosi o usunięcie konta i danych (RODO). Termin: 30 dni.',action:'clients',read:false,createdAt:at,time:'teraz'});}catch(e){}
      sent=true;
    }
  }catch(e){console.warn('Prośba RODO:',e);}
  if(box)box.querySelector('.pv-gate-card').innerHTML=sent
    ?`<h2 id="pv-del-h">Prośba wysłana</h2><p>Trener dostał prośbę w czacie. Usunie Twoje dane w ciągu 30 dni i potwierdzi to w wiadomości.</p><button type="button" class="cs-btn cs-btn-primary" onclick="document.getElementById('pv-del').remove()">Zamknij</button>`
    :`<h2 id="pv-del-h">Nie udało się wysłać</h2><p>Sprawdź internet i spróbuj ponownie albo zadzwoń do trenera.</p><button type="button" class="cs-btn cs-btn-primary" onclick="privacyDeleteSend()">Spróbuj ponownie</button><button type="button" class="cs-link" onclick="document.getElementById('pv-del').remove()">Zamknij</button>`;
}

Object.assign(window,{PRIVACY_VERSION,PRIVACY_URL,privacyAccepted,privacyHealthAllowed,privacyBuildConsents,privacySaveConsents,privacyFlushPending,
  privacyGateCheck,privacyGateAccept,privacyProfileCardHTML,privacyToggleHealth,privacyExportData,privacyExportPayload,privacyDeleteOpen,privacyDeleteSend});
