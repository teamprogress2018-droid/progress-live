// ════════════════════════════════════════
// APLIKACJA KLIENTA — logowanie i powłoka
// ════════════════════════════════════════

function clientInviteTokenFromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    const fromQ=q.get('invite')||q.get('token');
    if(fromQ)return fromQ.trim();
    const m=(location.hash||'').match(/[#&]invite=([^&]+)/);
    return m?decodeURIComponent(m[1]).trim():'';
  }catch(e){return '';}
}

function clientAppUrl(){
  return (location.origin+location.pathname).replace(/index\.html$/,'');
}

function newInviteToken(){
  const a=new Uint8Array(16);
  (window.crypto||crypto).getRandomValues(a);
  return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
}

async function fetchInviteDoc(token){
  if(!token||!window._db||!window._getDoc||!window._doc)return null;
  try{
    const snap=await window._getDoc(window._doc(window._db,'invites',token));
    if(!snap.exists())return null;
    return {id:snap.id,...(snap.data()||{})};
  }catch(e){
    console.warn('Zaproszenie:',e);
    return null;
  }
}

async function fetchClientAccount(uid){
  if(!uid||!window._db||!window._getDoc)return null;
  try{
    const snap=await window._getDoc(window._doc(window._db,'clientAccounts',uid));
    if(!snap.exists())return null;
    const data=snap.data()||{};
    if(data.role!=='client'||!data.clientId)return null;
    return {id:snap.id,...data};
  }catch(e){return null;}
}

async function queryByClientId(colName,clientId){
  const out=[];
  if(!window._db||!clientId)return out;
  try{
    if(window._query&&window._where&&window._get){
      const q=window._query(window._col(window._db,colName),window._where('clientId','==',clientId));
      const snap=await window._get(q);
      snap.forEach(d=>{
        const x=typeof window.mapFbDoc==='function'?window.mapFbDoc(d):{...d.data(),id:d.id,_fbId:d.id};
        out.push(x);
      });
      return out;
    }
  }catch(e){console.warn('query '+colName,e);}
  return out;
}

function emptyClientCollections(){
  window.CL=[];window.PL=[];window.SE=[];window.EX=[];window.WO=[];
  window.TASKS=[];window.PACKAGES=[];window.METRIC_ENTRIES=[];
  window.CHECKINS={};window.NOTIFICATIONS=[];
  if(window.MSGS)Object.keys(window.MSGS).forEach(k=>delete window.MSGS[k]);
}

async function loadClientApp(account){
  window._clientAppMode=true;
  window._clientId=account.clientId;
  window._trainerId=account.trainerId;
  window._clientAccount=account;
  emptyClientCollections();
  const cid=account.clientId;
  try{
    const snap=await window._getDoc(window._doc(window._db,'clients',cid));
    if(snap.exists()){
      const c=typeof window.mapFbDoc==='function'?window.mapFbDoc(snap):{id:snap.id,...snap.data()};
      window.CL=[c];
    }
  }catch(e){console.warn('Klient (profil):',e);}
  window.PL=await queryByClientId('plans',cid);
  window.SE=await queryByClientId('sessions',cid);
  window.TASKS=await queryByClientId('tasks',cid);
  window.PACKAGES=await queryByClientId('packages',cid);
  window.METRIC_ENTRIES=await queryByClientId('metricEntries',cid);
  const msgs=await queryByClientId('messages',cid);
  msgs.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  if(!window.MSGS)window.MSGS={};
  window.MSGS[cid]=msgs;
  const cis=await queryByClientId('checkins',cid);
  window.CHECKINS={};window.CHECKINS[cid]=cis.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  try{
    if(account.trainerId){
      const st=await window._getDoc(window._doc(window._db,'settings',account.trainerId));
      if(st.exists()){
        const data=st.data()||{};
        window.SETTINGS={...window.SETTINGS,...data};
        if(data.profile)window.SETTINGS.profile={...window.SETTINGS.profile,...data.profile};
      }
    }
  }catch(e){}
  if((!window.SETTINGS||!window.SETTINGS.profile||!window.SETTINGS.profile.name)&&account.trainerName){
    window.SETTINGS=window.SETTINGS||{};
    window.SETTINGS.profile=Object.assign({},window.SETTINGS.profile||{},{name:account.trainerName});
  }
  enterClientLiveShell();
}

function enterClientLiveShell(){
  document.body.classList.add('client-app-mode');
  const authScreen=document.getElementById('auth-screen');
  if(authScreen)authScreen.style.display='none';
  const appRoot=document.getElementById('app-root');
  if(appRoot)appRoot.style.display='';
  const sidebar=document.querySelector('.sidebar');
  if(sidebar)sidebar.style.display='none';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const live=document.getElementById('screen-clientlive');
  if(live)live.classList.add('active');
  const c=window.CL[0];
  window.capClientId=c?c.id:window._clientId;
  renderClientLive();
}

function renderClientLive(){
  const c=window.CL.find(x=>x.id===window._clientId)||window.CL[0];
  const content=document.getElementById('clive-screen-content');
  if(!content)return;
  const scr=window._clientLiveScreen||'home';
  ['home','plan','progress','messages','profile'].forEach(s=>{
    const bn=document.getElementById('clive-bn-'+s);
    if(!bn)return;
    const on=s===scr;
    bn.classList.toggle('active',on);
    bn.style.opacity=on?'1':'0.55';
  });
  if(typeof capScreenHTML==='function'&&c)content.innerHTML=capScreenHTML(scr,c);
  else if(!c)content.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);">Nie znaleziono profilu klienta.</div>';
}

function setClientLiveScreen(scr){
  window._clientLiveScreen=scr;
  renderClientLive();
}

function prepareAuthForInvite(){
  const token=clientInviteTokenFromUrl();
  window._pendingInviteToken=token||window._pendingInviteToken||'';
  const hint=document.getElementById('auth-role-hint');
  if(window._pendingInviteToken){
    if(hint)hint.textContent='Aplikacja klienta — ustaw hasło z zaproszenia trenera';
    authShowRegister();
    fetchInviteDoc(window._pendingInviteToken).then(inv=>{
      const tokEl=document.getElementById('auth-reg-token');
      if(tokEl)tokEl.value=window._pendingInviteToken;
      if(!inv)return;
      const em=document.getElementById('auth-reg-email');
      if(em&&inv.email){em.value=inv.email;em.readOnly=!!inv.email;}
      const sub=document.getElementById('auth-reg-sub');
      if(sub)sub.textContent=inv.clientName
        ?('Cześć '+inv.clientName.split(' ')[0]+'! Ustaw hasło, żeby zobaczyć plan od '+(inv.trainerName||'trenera')+'.')
        :'Ustaw hasło do aplikacji klienta.';
    });
  }else if(hint){
    hint.textContent='Zaloguj się — trener do panelu, klient do swojej aplikacji';
  }
}

function authShowRegister(){
  const login=document.getElementById('auth-login-view');
  const reset=document.getElementById('auth-reset-view');
  const reg=document.getElementById('auth-register-view');
  if(login)login.style.display='none';
  if(reset)reset.style.display='none';
  if(reg)reg.style.display='block';
}
function authShowLoginFromClient(){
  const login=document.getElementById('auth-login-view');
  const reset=document.getElementById('auth-reset-view');
  const reg=document.getElementById('auth-register-view');
  if(reg)reg.style.display='none';
  if(reset)reset.style.display='none';
  if(login)login.style.display='block';
}

function authSetError(id,msg){
  const el=document.getElementById(id);
  if(!el)return;
  if(!msg){el.style.display='none';el.textContent='';return;}
  el.textContent=msg;
  el.style.display='block';
}

async function doClientRegister(){
  const token=(document.getElementById('auth-reg-token')?.value||window._pendingInviteToken||clientInviteTokenFromUrl()||'').trim();
  const email=(document.getElementById('auth-reg-email')?.value||'').trim();
  const pass=document.getElementById('auth-reg-password')?.value||'';
  const pass2=document.getElementById('auth-reg-password2')?.value||'';
  const btn=document.getElementById('auth-reg-btn');
  authSetError('auth-reg-error','');
  if(!token){authSetError('auth-reg-error','Wklej token z linku zaproszenia albo otwórz link od trenera.');return;}
  if(!email||!pass){authSetError('auth-reg-error','Wpisz e-mail i hasło.');return;}
  if(pass.length<6){authSetError('auth-reg-error','Hasło musi mieć co najmniej 6 znaków.');return;}
  if(pass!==pass2){authSetError('auth-reg-error','Hasła nie są takie same.');return;}
  if(!window._createUser){authSetError('auth-reg-error','Brak połączenia z logowaniem. Odśwież stronę.');return;}
  if(btn){btn.disabled=true;btn.textContent='Zakładanie konta...';}
  try{
    const inv=await fetchInviteDoc(token);
    if(!inv||!inv.clientId||!inv.trainerId){
      authSetError('auth-reg-error','To zaproszenie jest nieważne. Poproś trenera o nowy link.');
      return;
    }
    if(inv.email&&email.toLowerCase()!==String(inv.email).toLowerCase()){
      authSetError('auth-reg-error','Użyj adresu e-mail z zaproszenia: '+inv.email);
      return;
    }
    const cred=await window._createUser(email,pass);
    const uid=cred.user.uid;
    await window._setDoc(window._doc(window._db,'clientAccounts',uid),{
      role:'client',
      uid,
      clientId:inv.clientId,
      trainerId:inv.trainerId,
      inviteToken:token,
      clientName:inv.clientName||'',
      trainerName:inv.trainerName||'',
      email,
      createdAt:new Date().toISOString()
    });
    window._pendingInviteToken='';
    try{history.replaceState(null,'',location.pathname);}catch(e){}
  }catch(e){
    const msgs={
      'auth/email-already-in-use':'To konto już istnieje — zaloguj się hasłem.',
      'auth/invalid-email':'Nieprawidłowy adres e-mail.',
      'auth/weak-password':'Hasło jest za słabe (min. 6 znaków).',
      'auth/operation-not-allowed':'Rejestracja e-mail/hasło jest wyłączona w Firebase.'
    };
    authSetError('auth-reg-error',msgs[e.code]||('Nie udało się założyć konta: '+(e.message||e)));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Utwórz konto i wejdź';}
  }
}

function pushClientMsg(text){
  const clientId=window._clientId;
  if(!clientId||!text||!text.trim())return;
  if(!window.MSGS[clientId])window.MSGS[clientId]=[];
  const msg=withTrainer({
    id:newId('msg'),
    clientId,
    text:text.trim(),
    out:false,
    time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),
    createdAt:new Date().toISOString()
  });
  window.MSGS[clientId].push(msg);
  persistById('messages',msg);
  renderClientLive();
}

function clientSendChat(){
  const inp=document.getElementById('clive-chat-input');
  if(!inp)return;
  pushClientMsg(inp.value);
  inp.value='';
}

function clientConfirmAttendance(){
  pushClientMsg('Potwierdzam obecność na dzisiejszym treningu.');
  if(typeof notify==='function')notify('✓ Potwierdzenie poszło do trenera');
}

function capPickCheckin(field,val){
  window._cliveCheckin=window._cliveCheckin||{};
  window._cliveCheckin[field]=val;
  renderClientLive();
}

function clientSubmitCheckin(){
  const a=window._cliveCheckin||{};
  const clientId=window._clientId;
  if(!clientId)return;
  const energy=a.energy||3,sleep=a.sleep||3,stress=a.stress||3,nutrition=a.nutrition||3;
  const workouts=a.workouts!=null?a.workouts:0;
  const weight=a.weight||'';
  const notes=a.notes||'';
  const score=Math.round((energy+sleep+(6-stress)+nutrition)/4*20);
  const ci=withTrainer({
    id:newId('ci'),
    clientId,
    date:typeof dateStr==='function'?dateStr(new Date()):new Date().toISOString().slice(0,10),
    status:'filled',
    score,
    answers:{energy,sleep,stress,nutrition,workouts,weight,notes},
    createdAt:new Date().toISOString()
  });
  if(!window.CHECKINS[clientId])window.CHECKINS[clientId]=[];
  window.CHECKINS[clientId].push(ci);
  if(typeof persistCheckin==='function')persistCheckin(ci);
  else persistById('checkins',ci);
  window._cliveCheckin={};
  if(typeof notify==='function')notify('✓ Check-in wysłany do trenera');
  window._clientLiveScreen='home';
  renderClientLive();
}

async function ensureClientInvite(client){
  if(!client)return '';
  if(client.inviteToken){
    const link=clientAppUrl()+'?invite='+encodeURIComponent(client.inviteToken);
    client.inviteLink=link;
    return link;
  }
  const token=newInviteToken();
  client.inviteToken=token;
  const link=clientAppUrl()+'?invite='+encodeURIComponent(token);
  client.inviteLink=link;
  const payload=withTrainer({
    id:token,
    clientId:client.id,
    clientName:client.name||'',
    email:client.email||'',
    trainerName:typeof getTrainerName==='function'?getTrainerName('Trener'):'Trener',
    createdAt:new Date().toISOString()
  });
  try{
    if(window._db&&window._setDoc)await window._setDoc(window._doc(window._db,'invites',token),payload,{merge:true});
  }catch(e){
    console.warn('Zapis zaproszenia:',e);
    if(typeof persistWarn==='function')persistWarn('⚠ Nie zapisano zaproszenia w bazie — wdróż reguły Firestore.');
  }
  persistById('clients',client);
  return link;
}

window.clientInviteTokenFromUrl=clientInviteTokenFromUrl;
window.fetchClientAccount=fetchClientAccount;
window.loadClientApp=loadClientApp;
window.enterClientLiveShell=enterClientLiveShell;
window.renderClientLive=renderClientLive;
window.setClientLiveScreen=setClientLiveScreen;
window.prepareAuthForInvite=prepareAuthForInvite;
window.authShowRegister=authShowRegister;
window.authShowLoginFromClient=authShowLoginFromClient;
window.doClientRegister=doClientRegister;
window.pushClientMsg=pushClientMsg;
window.clientSendChat=clientSendChat;
window.clientConfirmAttendance=clientConfirmAttendance;
window.capPickCheckin=capPickCheckin;
window.clientSubmitCheckin=clientSubmitCheckin;
window.ensureClientInvite=ensureClientInvite;
window.newInviteToken=newInviteToken;
window.clientAppUrl=clientAppUrl;

document.addEventListener('DOMContentLoaded',prepareAuthForInvite);
