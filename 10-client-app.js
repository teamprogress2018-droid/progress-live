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

async function queryByTrainerId(colName,trainerId){
  const out=[];
  if(!window._db||!trainerId)return out;
  try{
    if(window._query&&window._where&&window._get){
      const q=window._query(window._col(window._db,colName),window._where('trainerId','==',trainerId));
      const snap=await window._get(q);
      snap.forEach(d=>{
        const x=typeof window.mapFbDoc==='function'?window.mapFbDoc(d):{...d.data(),id:d.id,_fbId:d.id};
        out.push(x);
      });
    }
  }catch(e){console.warn('query trainer '+colName,e);}
  return out;
}

function indexForumComments(list){
  window.FORUM_COMMENTS={};
  (list||[]).forEach(c=>{
    if(!c||!c.postId)return;
    if(!window.FORUM_COMMENTS[c.postId])window.FORUM_COMMENTS[c.postId]=[];
    window.FORUM_COMMENTS[c.postId].push(c);
  });
}

function clientSaveForumPost(){
  const title=((document.getElementById('clive-fp-title')||{}).value||'').trim();
  const body=((document.getElementById('clive-fp-body')||{}).value||'').trim();
  if(!title||!body){if(typeof notify==='function')notify('Wpisz tytuł i treść');return;}
  const groups=typeof visibleForumGroups==='function'?visibleForumGroups():(window.FORUM_GROUPS||[]);
  const group=groups.find(g=>g.privacy!=='private')||groups[0];
  if(!group){if(typeof notify==='function')notify('Trener nie utworzył jeszcze grupy');return;}
  const me=typeof forumActor==='function'?forumActor():{name:'Klient',role:'klient',clientId:window._clientId};
  const now=new Date().toISOString();
  const p=withTrainer({
    id:newId('fp'),title,body,type:'post',groupId:group.id,
    authorName:me.name,authorRole:'klient',
    pinned:false,date:now.slice(0,10),createdAt:now,
    likes:0,views:0,comments:0,reactions:{},reactedBy:{}
  });
  if(me.clientId)p.clientId=me.clientId;
  window.FORUM_POSTS=window.FORUM_POSTS||[];
  window.FORUM_POSTS.unshift(p);
  persistById('forumPosts',p);
  if(typeof addNotification==='function')addNotification('system','Nowy post klienta',me.name+': '+title,'forum');
  if(typeof notify==='function')notify('✓ Post opublikowany');
  if(typeof renderClientLive==='function')renderClientLive();
}

function emptyClientCollections(){
  window.CL=[];window.PL=[];window.SE=[];window.EX=[];window.WO=[];
  window.TASKS=[];window.PACKAGES=[];window.METRIC_ENTRIES=[];
  window.CHECKINS={};window.NOTIFICATIONS=[];
  window.FORUM_GROUPS=[];window.FORUM_POSTS=[];window.FORUM_COMMENTS={};
  window.PROGRESS_PHOTOS=[];
  window.COACH_VIDEOS=[];
  window.USER_RESOURCES=[];
  window.OD_WORKOUTS=[];
  window.OD_PROGRAMS=[];
  window.OD_PROGRESS=[];
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
  window.PROGRESS_PHOTOS=await queryByClientId('progressPhotos',cid);
  window.EX=await queryByTrainerId('exercises',account.trainerId);
  window.COACH_VIDEOS=await queryByTrainerId('coachVideos',account.trainerId);
  try{
    const res=await queryByTrainerId('resources',account.trainerId);
    window.USER_RESOURCES=(res&&res.length)?res:((window.DEMO_RESOURCES||[]).map(r=>Object.assign({},r)));
  }catch(e){
    window.USER_RESOURCES=(window.DEMO_RESOURCES||[]).map(r=>Object.assign({},r));
  }
  try{
    const od=await queryByTrainerId('odWorkouts',account.trainerId);
    window.OD_WORKOUTS=(od&&od.length)?od:((window.OD_DEMO_WORKOUTS||[]).map(w=>Object.assign({},w)));
    if(typeof migrateODYoutubeWorkouts==='function')migrateODYoutubeWorkouts();
  }catch(e){
    window.OD_WORKOUTS=(window.OD_DEMO_WORKOUTS||[]).map(w=>Object.assign({},w));
  }
  try{
    const odp=await queryByTrainerId('odPrograms',account.trainerId);
    window.OD_PROGRAMS=(odp&&odp.length)?odp:((typeof ensureODPrograms==='function'?ensureODPrograms():[])||[]);
    if(typeof ensureODPrograms==='function'&&!window.OD_PROGRAMS.length)ensureODPrograms();
  }catch(e){
    if(typeof ensureODPrograms==='function')ensureODPrograms();
  }
  try{
    const pr=await queryByClientId('odProgress',cid);
    window.OD_PROGRESS=pr||[];
  }catch(e){window.OD_PROGRESS=[];}
  const msgs=await queryByClientId('messages',cid);
  msgs.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  if(!window.MSGS)window.MSGS={};
  window.MSGS[cid]=msgs;
  const cis=await queryByClientId('checkins',cid);
  window.CHECKINS={};window.CHECKINS[cid]=cis.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  window.FORUM_GROUPS=await queryByTrainerId('forumGroups',account.trainerId);
  window.FORUM_POSTS=await queryByTrainerId('forumPosts',account.trainerId);
  indexForumComments(await queryByTrainerId('forumComments',account.trainerId));
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
  clientTryOpenOdDeepLink();
}

function clientTryOpenOdDeepLink(){
  try{
    const q=new URLSearchParams(location.search||'');
    const od=q.get('od');
    const odprog=q.get('odprog');
    if(odprog&&typeof openODProgramClient==='function')setTimeout(()=>openODProgramClient(odprog),400);
    else if(od&&typeof openODWorkout==='function')setTimeout(()=>openODWorkout(od),400);
  }catch(e){}
}

function renderClientLive(){
  const c=window.CL.find(x=>x.id===window._clientId)||window.CL[0];
  const content=document.getElementById('clive-screen-content');
  if(!content)return;
  let scr=window._clientLiveScreen||'home';
  const navIds=(typeof capLiveNavScreens==='function'?capLiveNavScreens():[]).map(s=>s.id);
  const subScreens=['forms','formfill','session','exercise','calendar','resources','odprogram'];
  if(typeof capClientSectionVisible==='function'&&!capClientSectionVisible(scr)&&!subScreens.includes(scr))scr='home';
  window._clientLiveScreen=scr;
  ['home','plan','homework','progress','checkin','ondemand','resources','forum','messages','profile'].forEach(s=>{
    const bn=document.getElementById('clive-bn-'+s);
    if(!bn)return;
    const visible=!navIds.length||navIds.includes(s);
    bn.style.display=visible?'':'none';
    const on=s===scr;
    bn.classList.toggle('active',on);
    bn.style.opacity=on?'1':'0.55';
  });
  updateClientLiveNavBadges(c);
  if(typeof capScreenHTML==='function'&&c)content.innerHTML=capScreenHTML(scr,c);
  else if(!c)content.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);">Nie znaleziono profilu klienta.</div>';
}

function updateClientLiveNavBadges(c){
  const cid=c&&c.id;
  const setBadge=(id,on)=>{
    const bn=document.getElementById(id);if(!bn)return;
    let dot=bn.querySelector('.clive-nav-badge');
    if(on){
      if(!dot){
        dot=document.createElement('span');
        dot.className='clive-nav-badge';
        dot.style.cssText='position:absolute;top:4px;right:10px;width:8px;height:8px;border-radius:50%;background:var(--accent);border:1px solid var(--s1);';
        bn.style.position=bn.style.position||'relative';
        bn.appendChild(dot);
      }
      dot.style.display='block';
    }else if(dot){
      dot.style.display='none';
    }
  };
  const pendCi=cid&&typeof pendingCheckin==='function'?!!pendingCheckin(cid):false;
  const pendForms=cid&&typeof pendingFormSends==='function'?pendingFormSends(cid).length>0:false;
  setBadge('clive-bn-checkin',pendCi);
  setBadge('clive-bn-messages',pendForms);
}
window.updateClientLiveNavBadges=updateClientLiveNavBadges;

function setClientLiveScreen(scr){
  window._clientLiveScreen=scr;
  renderClientLive();
}

function capGoScreen(scr){
  if(window._clientAppMode){setClientLiveScreen(scr);return;}
  if(typeof setCapScreen==='function')setCapScreen(scr);
}

function clientCalNav(delta){
  const now=new Date();
  const d=window._cliveCal||{y:now.getFullYear(),m:now.getMonth()};
  d.m+=Number(delta)||0;
  while(d.m<0){d.m+=12;d.y--;}
  while(d.m>11){d.m-=12;d.y++;}
  window._cliveCal=d;
  capGoScreen('calendar');
}

function clientOpenSession(id){
  window._cliveSessionId=id;
  capGoScreen('session');
}

function clientOpenExercise(name){
  window._cliveExerciseName=name;
  if(window._clientAppMode)setClientLiveScreen('exercise');
  else if(typeof setCapScreen==='function')setCapScreen('exercise');
}

function clientOpenForm(sendId){
  window._cliveFormSendId=sendId;
  window._cliveFormAnswers=window._cliveFormAnswers||{};
  const send=(window.FORM_SENDS||[]).find(s=>s.id===sendId);
  if(!window._cliveFormAnswers[sendId]){
    window._cliveFormAnswers[sendId]=send?Object.assign({},formSendAnswersMap(send)):{};
  }
  setClientLiveScreen('formfill');
}

function clientFormSetAnswer(sendId,qid,val){
  window._cliveFormAnswers=window._cliveFormAnswers||{};
  if(!window._cliveFormAnswers[sendId])window._cliveFormAnswers[sendId]={};
  window._cliveFormAnswers[sendId][qid]=val;
}

function clientFormPick(sendId,qid,val){
  clientFormSetAnswer(sendId,qid,val);
  renderClientLive();
}

function clientSubmitForm(sendId){
  const send=(window.FORM_SENDS||[]).find(s=>s.id===sendId);
  if(!send){if(typeof notify==='function')notify('Nie znaleziono formularza');return;}
  const answers=(window._cliveFormAnswers&&window._cliveFormAnswers[sendId])||{};
  const r=applyFormSubmit(send,answers);
  if(!r.ok){
    if(r.error==='required'){if(typeof notify==='function')notify('Uzupełnij wymagane pytania ('+r.missing.length+')');}
    else if(r.error==='already'){if(typeof notify==='function')notify('Ten formularz jest już wysłany');}
    else if(typeof notify==='function')notify('Nie udało się wysłać');
    return;
  }
  persistById('formSends',send);
  const name=send.formName||'Formularz';
  if(typeof notify==='function')notify('✓ Wysłano: '+name);
  if(typeof pushClientMsg==='function')pushClientMsg('Wypełniłem formularz: '+name);
  if(typeof addNotification==='function'){
    const c=(window.CL||[]).find(x=>x.id===send.clientId);
    const sync=r.intakeSync;
    if(sync&&sync.changed){
      addNotification('form','Ankieta — profil zaktualizowany',(c?c.name+': ':'')+(sync.summary||name),'clients');
      if(typeof cpClientId!=='undefined'&&cpClientId===send.clientId&&typeof renderCPOverview==='function'&&c){
        try{renderCPOverview(c);}catch(e){}
      }
      if(typeof renderDash==='function')try{renderDash();}catch(e){}
      if(typeof renderClients==='function')try{renderClients();}catch(e){}
    }else{
      addNotification('form','Formularz wypełniony',(c?c.name+' — ':'')+name,'forms');
    }
  }
  window._cliveFormSendId=null;
  setClientLiveScreen('forms');
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
  if(typeof filledThisWeek==='function'&&filledThisWeek(clientId)&&typeof pendingCheckin==='function'&&!pendingCheckin(clientId)){
    if(typeof notify==='function')notify('Check-in z tego tygodnia już jest');
    return;
  }
  const answers={
    energy:a.energy||3,sleep:a.sleep||3,stress:a.stress||3,nutrition:a.nutrition||3,
    workouts:a.workouts!=null?a.workouts:0,weight:a.weight||'',notes:a.notes||''
  };
  if(typeof ensureCheckins==='function')ensureCheckins(clientId);
  else if(!window.CHECKINS[clientId])window.CHECKINS[clientId]=[];
  let ci=typeof pendingCheckin==='function'?pendingCheckin(clientId):null;
  if(!ci){
    ci=withTrainer({
      id:newId('ci'),clientId,
      date:typeof dateStr==='function'?dateStr(new Date()):new Date().toISOString().slice(0,10),
      status:'pending',score:null,answers:{},createdAt:new Date().toISOString()
    });
    window.CHECKINS[clientId].push(ci);
  }
  if(typeof applyCheckinAnswers==='function')applyCheckinAnswers(ci,answers,'client');
  else{
    ci.answers=answers;ci.status='filled';ci.score=Math.round(((answers.energy)+(answers.sleep)+(6-answers.stress)+answers.nutrition)/4*20);
    persistById('checkins',ci);
    if(typeof syncClientFromCheckin==='function')try{syncClientFromCheckin(ci);}catch(e){}
  }
  window._cliveCheckin={};
  pushClientMsg('Wypełniłem tygodniowy check-in'+(answers.weight?' (waga '+answers.weight+' kg)':'')+'.');
  if(typeof addNotification==='function'){
    const me=(window.CL||[]).find(x=>x.id===clientId)||(window.CL||[])[0];
    const wBit=answers.weight?' · waga '+answers.weight+' kg':'';
    addNotification('task','Nowy check-in od klienta',((me&&me.name)||'Klient')+wBit,'checkin');
  }
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
window.capGoScreen=capGoScreen;
window.clientCalNav=clientCalNav;
window.clientOpenSession=clientOpenSession;
window.clientOpenExercise=clientOpenExercise;
window.clientOpenForm=clientOpenForm;
window.clientFormSetAnswer=clientFormSetAnswer;
window.clientFormPick=clientFormPick;
window.clientSubmitForm=clientSubmitForm;
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
window.queryByTrainerId=queryByTrainerId;
window.clientSaveForumPost=clientSaveForumPost;
window.clientToggleTask=clientToggleTask;
window.cwOpen=cwOpen;
window.cwClose=cwClose;
window.cwBegin=cwBegin;
window.cwPatchSet=cwPatchSet;
window.cwCheckSet=cwCheckSet;
window.cwStartRest=cwStartRest;
window.cwGoEx=cwGoEx;
window.cwSkipRest=cwSkipRest;
window.cwSkipEx=cwSkipEx;
window.cwPrevEx=cwPrevEx;
window.cwRate=cwRate;
window.cwFinish=cwFinish;
window.cwSwapEx=cwSwapEx;
window.ppPick=ppPick;
window.ppSave=ppSave;
window.ppDelete=ppDelete;
window.ppOpenDraft=ppOpenDraft;
window.ppCloseDraft=ppCloseDraft;
window.ppSetCmp=ppSetCmp;
window.ppCmpView=ppCmpView;

document.addEventListener('DOMContentLoaded',prepareAuthForInvite);

function clientToggleTask(id){
  const t=(window.TASKS||[]).find(x=>x.id===id);
  if(!t)return;
  if(typeof isHomework==='function'&&isHomework(t)){
    if(typeof clientStartHomework==='function')clientStartHomework(id);
    return;
  }
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  if(typeof isHabit==='function'&&isHabit(t)){
    toggleHabitDay(t,today);
    persistById('tasks',t);
    const done=habitDoneOn(t,today);
    const streak=habitStreak(t,today);
    if(typeof notify==='function')notify(done?('✓ Dziś zrobione'+(streak?' · 🔥 '+streak:'')):'Nawyk odznaczony');
    if(typeof renderClientLive==='function')renderClientLive();
    return;
  }
  if(typeof isChallenge==='function'&&isChallenge(t)){
    if(typeof challengeCanCheck==='function'&&!challengeCanCheck(t,today,today)){
      const p=typeof challengeProgress==='function'?challengeProgress(t,today):null;
      if(typeof notify==='function')notify(p&&p.before?'Wyzwanie jeszcze się nie zaczęło':p&&p.won?'Wyzwanie ukończone 🏆':'Wyzwanie już się skończyło');
      return;
    }
    toggleChallengeDay(t,today,today);
    persistById('tasks',t);
    const p=typeof challengeProgress==='function'?challengeProgress(t,today):null;
    const done=typeof habitDoneOn==='function'&&habitDoneOn(t,today);
    if(typeof notify==='function'){
      if(p&&p.won)notify('🏆 Wyzwanie ukończone · '+p.done+'/'+p.target);
      else notify(done?('✓ '+((p&&p.done)||0)+'/'+(p?p.target:'')+' dni'):'Wyzwanie odznaczone');
    }
    if(typeof renderClientLive==='function')renderClientLive();
    return;
  }
  t.status=t.status==='done'?'open':'done';
  t.updatedAt=new Date().toISOString();
  persistById('tasks',t);
  if(typeof notify==='function')notify(t.status==='done'?'✓ Zadanie zrobione':'Zadanie znów otwarte');
  renderClientLive();
}

function clientStartHomework(taskId){
  const t=(window.TASKS||[]).find(x=>x.id===taskId);
  const wid=t&&t.odWorkoutId;
  if(!wid){
    if(typeof notify==='function')notify('Brak powiązanego treningu');
    return;
  }
  if(typeof openODWorkout==='function')openODWorkout(wid);
  else if(typeof notify==='function')notify('Nie można odtworzyć treningu');
}

function clientCompleteHomework(taskId){
  const t=(window.TASKS||[]).find(x=>x.id===taskId);
  if(!t)return;
  t.status='done';
  t.doneAt=new Date().toISOString();
  t.updatedAt=new Date().toISOString();
  if(typeof persistById==='function')persistById('tasks',t);
  if(typeof notify==='function')notify('✓ Zadanie domowe zaliczone');
  if(typeof renderClientLive==='function')renderClientLive();
}

window.clientStartHomework=clientStartHomework;
window.clientCompleteHomework=clientCompleteHomework;

function cwClearTimers(){
  if(window._cwRestTimer){clearInterval(window._cwRestTimer);window._cwRestTimer=null;}
  if(window._cwClock){clearInterval(window._cwClock);window._cwClock=null;}
}

function cwOpen(planId,dayIdx){
  if(!window._clientAppMode){
    if(typeof notify==='function')notify('Podgląd — klient startuje trening w swojej apce');
    return;
  }
  const plan=(window.PL||[]).find(p=>p.id===planId);
  if(!plan){if(typeof notify==='function')notify('Nie znaleziono planu');return;}
  const day=(plan.days||[])[dayIdx];
  if(!day||day.rest||!(day.exercises||[]).length){if(typeof notify==='function')notify('Ten dzień nie ma ćwiczeń');return;}
  const exercises=mapPlanExercisesForClient(day.exercises,window._clientId);
  if(!exercises.length){if(typeof notify==='function')notify('Brak ćwiczeń w tym dniu');return;}
  cwClearTimers();
  window._cw={
    active:true,phase:'overview',
    planId,dayIdx,dayName:typeof capDayLabel==='function'?capDayLabel(day,dayIdx):('Dzień '+(dayIdx+1)),
    planName:plan.name||'Plan',
    exercises,exIdx:0,restLeft:0,rating:0,note:'',
    startedAt:Date.now(),elapsed:0
  };
  const wrap=document.getElementById('clive-player');
  if(wrap)wrap.hidden=false;
  document.body.classList.add('cw-playing');
  cwRender();
}

function cwClose(){
  if(window._cw&&window._cw.active&&window._cw.phase!=='overview'&&window._cw.phase!=='finish'){
    if(!confirm('Przerwać trening? Serie nie zostaną zapisane.'))return;
  }
  cwClearTimers();
  window._cw=null;
  const wrap=document.getElementById('clive-player');
  if(wrap)wrap.hidden=true;
  document.body.classList.remove('cw-playing');
  renderClientLive();
}

function cwBegin(){
  const cw=window._cw;if(!cw)return;
  cw.phase='exercise';
  cw.startedAt=Date.now();
  cw.emomClock={};
  cwClearTimers();
  window._cwClock=setInterval(()=>{
    if(!window._cw)return;
    window._cw.elapsed=Math.round((Date.now()-window._cw.startedAt)/1000);
    const el=document.getElementById('cw-clock');
    if(el)el.textContent=cwFmt(window._cw.elapsed);
  },1000);
  cwEnsureEmomClock();
  cwRender();
}

function cwFmt(sec){
  const m=Math.floor((sec||0)/60),s=(sec||0)%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function cwPatchSet(setIdx,field,val){
  const cw=window._cw;if(!cw)return;
  const ex=cw.exercises[cw.exIdx];if(!ex||!ex.sets[setIdx])return;
  ex.sets[setIdx][field]=val;
}

function cwStartRest(seconds,kind){
  const cw=window._cw;if(!cw)return;
  cw.phase='rest';
  cw.restKind=kind||'';
  cw.restLeft=seconds||90;
  cwClearTimers();
  window._cwClock=setInterval(()=>{
    if(!window._cw)return;
    window._cw.elapsed=Math.round((Date.now()-window._cw.startedAt)/1000);
  },1000);
  window._cwRestTimer=setInterval(()=>{
    if(!window._cw)return;
    window._cw.restLeft-=1;
    const n=document.getElementById('cw-rest-num');
    if(n)n.textContent=Math.max(0,window._cw.restLeft);
    if(window._cw.restLeft<=0)cwSkipRest();
  },1000);
  cwRender();
}

function cwGoEx(idx){
  const cw=window._cw;if(!cw)return;
  if(idx==null||idx<0||idx>=cw.exercises.length){cw.phase='finish';cwRender();return;}
  cw.exIdx=idx;
  cw.phase='exercise';
  cw.showVideo=false;
  cwEnsureEmomClock();
  cwRender();
}

function cwEnsureEmomClock(){
  const cw=window._cw;if(!cw)return;
  const ex=cw.exercises[cw.exIdx];
  if(typeof isEmomExercise!=='function'||!isEmomExercise(ex))return;
  cw.emomClock=cw.emomClock||{};
  if(!cw.emomClock[cw.exIdx])cw.emomClock[cw.exIdx]=Date.now();
}

function cwEmomElapsed(){
  const cw=window._cw;if(!cw||!cw.emomClock||!cw.emomClock[cw.exIdx])return 0;
  return(Date.now()-cw.emomClock[cw.exIdx])/1000;
}

function cwCheckSet(setIdx){
  const cw=window._cw;if(!cw)return;
  const ex=cw.exercises[cw.exIdx];if(!ex||!ex.sets[setIdx])return;
  const st=ex.sets[setIdx];
  st.done=!st.done;
  if(!st.done){cwRender();return;}
  const prMsg=typeof prToastText==='function'?prToastText(window._clientId,ex.name,st.kg,st.reps):'';
  if(typeof isEmomExercise==='function'&&isEmomExercise(ex)){
    cwEnsureEmomClock();
    const done=ex.sets.filter(s=>s.done).length;
    const nxtSet=ex.sets.find(s=>!s.done);
    if(nxtSet){
      const wait=typeof emomRestSec==='function'?emomRestSec(done,cwEmomElapsed()):0;
      if(wait>0){
        if(typeof notify==='function')notify('EMOM — następna runda za '+wait+' s');
        cwStartRest(wait,'emom');
      }else{
        if(typeof notify==='function')notify('EMOM — poza minutą, jedź dalej');
        cwRender();
      }
      return;
    }
  }
  const nxtSet=ex.sets.find(s=>!s.done);
  if(nxtSet&&typeof skipRestBeforeSet==='function'&&skipRestBeforeSet(nxtSet)){
    if(typeof notify==='function')notify((prMsg?prMsg+' · ':'')+'Drop set — bez przerwy, zdejmij ciężar');
    cwRender();
    return;
  }
  const act=typeof ssNextAfterSet==='function'?ssNextAfterSet(cw.exercises,cw.exIdx):null;
  if(act&&act.kind==='partner'){
    const nxt=cw.exercises[act.exIdx];
    cwGoEx(act.exIdx);
    if(typeof notify==='function')notify(typeof superseriesToastText==='function'?superseriesToastText(nxt,{prMsg}):('Super-seria → '+(nxt&&nxt.ssLabel?nxt.ssLabel+' ':'')+(nxt?nxt.name:'')));
    return;
  }
  if(prMsg&&typeof notify==='function')notify(prMsg);
  if(act&&act.kind==='rest'){
    cw.exIdx=act.exIdx;
    const nextEx=cw.exercises[act.exIdx];
    const nextSt=(nextEx.sets||[]).find(x=>!x.done);
    const sec=typeof restSecAfterSet==='function'?restSecAfterSet(nextEx,st,nextSt):(nextEx&&nextEx.restSec)||90;
    cwStartRest(sec);
    return;
  }
  if(act&&act.kind==='advance'){
    const next=typeof ssAdvanceIdx==='function'?ssAdvanceIdx(cw.exercises,cw.exIdx):cw.exIdx+1;
    cwGoEx(next);
    return;
  }
  const next=ex.sets.find(s=>!s.done);
  if(next){
    const sec=typeof restSecAfterSet==='function'?restSecAfterSet(ex,st,next):ex.restSec||90;
    cwStartRest(sec);
    return;
  }
  if(cw.exIdx<cw.exercises.length-1){cwGoEx(cw.exIdx+1);return;}
  cw.phase='finish';cwRender();
}

function cwSkipRest(){
  const cw=window._cw;if(!cw)return;
  if(window._cwRestTimer){clearInterval(window._cwRestTimer);window._cwRestTimer=null;}
  cw.phase='exercise';
  cwRender();
}

function cwSkipEx(){
  const cw=window._cw;if(!cw)return;
  if(cw.exIdx<cw.exercises.length-1){cw.exIdx+=1;cw.phase='exercise';cwRender();}
  else{cw.phase='finish';cwRender();}
}

function cwPrevEx(){
  const cw=window._cw;if(!cw||cw.exIdx<=0)return;
  cw.exIdx-=1;cw.phase='exercise';cwRender();
}

function cwRate(v){
  const cw=window._cw;if(!cw)return;
  cw.rating=v;
  cwRender();
}

function cwSwapEx(name){
  const cw=window._cw;if(!cw)return;
  const cur=cw.exercises[cw.exIdx];if(!cur)return;
  name=String(name||'').trim();
  if(!name||name===cur.name)return;
  const orig=cur.plannedName||cur.name;
  cur.plannedName=orig;
  cur.name=name;
  const extra=typeof altsForExercise==='function'?altsForExercise(name):[];
  cur.alts=[orig].concat(cur.alts||[]).concat(extra).filter((n,i,a)=>n&&n!==cur.name&&a.indexOf(n)===i);
  const last=typeof lastLoadForExercise==='function'?lastLoadForExercise(window._clientId,name):null;
  if(last){
    cur.lastKg=last.kg||'';
    cur.lastReps=last.reps||'';
    (cur.sets||[]).forEach((s,i)=>{
      if(s.done)return;
      const prev=last.sets&&last.sets[i];
      if(!prev)return;
      if(prev.kg!=null&&prev.kg!=='')s.kg=String(prev.kg);
      if(prev.reps!=null&&prev.reps!=='')s.reps=String(prev.reps);
    });
  }
  if(cur.pct1rm&&typeof weightFromPct1RM==='function'){
    const w=weightFromPct1RM(window._clientId,name,cur.pct1rm);
    cur.kgHint=w.hint||'';
    if(w.kg){
      (cur.sets||[]).forEach(s=>{if(!s.done)s.kg=String(w.kg);});
    }
  }
  if(typeof notify==='function')notify('Zamieniono na: '+name);
  if(typeof resolveCoachMedia==='function'){
    const m=resolveCoachMedia({name});
    cur.video=m.video||'';
    cur.videoEmbed=m.videoEmbed||'';
    cur.isFile=!!m.isFile;
    cur.note='';
    cur.libTip=m.libTip||'';
  }
  cw.showVideo=false;
  cwRender();
}

function cwToggleVideo(){
  const cw=window._cw;if(!cw)return;
  cw.showVideo=!cw.showVideo;
  cwRender();
}
window.cwToggleVideo=cwToggleVideo;

function cwRender(){
  const el=document.getElementById('clive-player-inner');
  const cw=window._cw;
  if(!el||!cw)return;
  const accent=(window.SETTINGS&&window.SETTINGS.brand&&window.SETTINGS.brand.accentColor)||'#e60000';
  const back=`<button type="button" class="btn btn-ghost btn-sm" onclick="cwClose()">✕</button>`;
  if(cw.phase==='overview'){
    el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">${back}<div style="font-size:11px;color:var(--muted);">${escHtml(cw.planName)}</div></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;margin-bottom:6px;">${escHtml(cw.dayName)}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:18px;">${cw.exercises.length} ćwiczeń · odhacz serie, timer przerwy sam się włączy</div>
      ${cw.exercises.map((ex,i)=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);">
        <div style="font-size:13px;font-weight:600;">${i+1}. ${ex.ssLabel?`<span class="cw-ss-badge">${escHtml(ex.ssLabel)}</span>`:''}${escHtml(ex.name)}${ex.video?' ▶':''}</div>
        <div style="font-size:11px;color:var(--muted);white-space:nowrap;">${ex.sets.length} serii${ex.wu?' · WU'+ex.wu:''}${ex.amrap?' · AMRAP':''}${ex.drop?' · DROP'+ex.drop:''}${ex.emom?' · EMOM':''}</div>
      </div>`).join('')}
      <button type="button" class="cap-btn-primary" style="margin-top:20px;padding:16px;font-size:16px;" onclick="cwBegin()">▶ Start</button>`;
    return;
  }
  if(cw.phase==='rest'){
    const nxt=cw.exercises[cw.exIdx]||{};
    const emom=cw.restKind==='emom';
    el.innerHTML=`<div class="cw-rest">
      <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">${emom?'EMOM — czekaj na minutę':(nxt.ssLabel?'Przerwa · super-seria':'Przerwa')}</div>
      <div class="cw-rest-num" id="cw-rest-num">${cw.restLeft}</div>
      <div style="font-size:13px;color:var(--muted);">${emom?'Następna runda':'Następna seria'} · ${nxt.ssLabel?escHtml(nxt.ssLabel)+' ':''}${escHtml(nxt.name||'')}</div>
      <button type="button" class="cap-btn-primary" style="max-width:240px;padding:12px;" onclick="cwSkipRest()">Pomiń przerwę</button>
    </div>`;
    return;
  }
  if(cw.phase==='finish'){
    const setsDone=cw.exercises.flatMap(e=>e.sets).filter(s=>s.done).length;
    el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">${back}</div>
      <div style="text-align:center;padding:10px 0 20px;">
        <div style="font-size:40px;margin-bottom:8px;">🔥</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;">TRENING SKOŃCZONY</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;">${setsDone} serii · ${cwFmt(cw.elapsed)}</div>
      </div>
      <div style="font-size:13px;margin-bottom:10px;text-align:center;">Jak było? (ocena dla trenera)</div>
      <div style="display:flex;justify-content:center;gap:8px;margin-bottom:6px;">
        ${[1,2,3,4,5].map(n=>`<button type="button" class="clive-check-opt${cw.rating===n?' on':''}" onclick="cwRate(${n})">${['😓','😐','🙂','💪','🔥'][n-1]}</button>`).join('')}
      </div>
      <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:14px;">${cw.rating?(typeof sessionRatingLabel==='function'?sessionRatingLabel(cw.rating):cw.rating+'/5'):'Wybierz 1–5'}</div>
      <textarea class="form-textarea" rows="3" placeholder="Komentarz dla trenera (opcjonalnie)" oninput="window._cw.note=this.value">${escHtml(cw.note||'')}</textarea>
      <button type="button" class="cap-btn-primary" style="margin-top:16px;padding:16px;" onclick="cwFinish()">Zapisz i wyślij do trenera</button>`;
    return;
  }
  const ex=cw.exercises[cw.exIdx];
  cwEnsureEmomClock();
  const doneSets=ex.sets.filter(s=>s.done).length;
  const emomOn=typeof isEmomExercise==='function'&&isEmomExercise(ex);
  const emomWait=emomOn&&typeof emomRestSec==='function'?emomRestSec(doneSets+1,cwEmomElapsed()):0;
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      ${back}
      <div id="cw-clock" style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${accent};">${cwFmt(cw.elapsed)}</div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Ćwiczenie ${cw.exIdx+1} / ${cw.exercises.length}${ex.ssLabel?' · super-seria':''}${emomOn?' · EMOM runda '+(doneSets+1)+'/'+ex.sets.length:''}</div>
    <div style="font-size:20px;font-weight:700;margin-bottom:6px;">${ex.ssLabel?`<span class="cw-ss-badge">${escHtml(ex.ssLabel)}</span>`:''}${escHtml(ex.name)}</div>
    ${typeof coachMediaHtml==='function'?coachMediaHtml(ex,{showVideo:!!cw.showVideo,toggleFn:'cwToggleVideo()'}):''}
    ${(()=>{const g=typeof ssGroupIdxs==='function'?ssGroupIdxs(cw.exercises,cw.exIdx):[];const others=g.filter(i=>i!==cw.exIdx).map(i=>cw.exercises[i]).filter(Boolean);return others.length?`<div style="font-size:11px;color:var(--orange);margin-bottom:8px;">Bez przerwy z: ${others.map(o=>escHtml((o.ssLabel?o.ssLabel+' ':'')+o.name)).join(', ')}</div>`:'';})()}
    ${(ex.plannedName&&ex.plannedName!==ex.name)?`<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Z planu: ${escHtml(ex.plannedName)}</div>`:''}
    ${(ex.alts||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;">${ex.alts.map(a=>`<button type="button" class="btn btn-ghost btn-sm" onclick='cwSwapEx(${JSON.stringify(a)})'>↻ ${escHtml(a)}</button>`).join('')}</div>`:''}
    ${ex.kgHint?`<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${escHtml(ex.kgHint)}</div>`:''}
    ${(()=>{
      const last=ex.lastKg?('Ostatnio: '+escHtml(String(ex.lastKg))+' kg'+(ex.lastReps?' × '+escHtml(String(ex.lastReps)):'')):'';
      const pr=typeof exercisePR==='function'?exercisePR(window._clientId,ex.name):null;
      const rec=pr?('Rekord: '+escHtml(String(pr.kg))+' kg × '+escHtml(String(pr.reps))):'';
      const same=pr&&ex.lastKg!=null&&Number(ex.lastKg)===Number(pr.kg)&&Number(ex.lastReps)===Number(pr.reps);
      const line=same?(last?last+' · rekord':rec):(last&&rec?last+' · '+rec:(last||rec));
      return line?`<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">${line}</div>`:'<div style="height:8px;"></div>';
    })()}
    ${emomOn?`<div style="font-size:11px;color:var(--blue);margin-bottom:8px;">Zegar minuty · do rundy ~${emomWait}s (zrób serie i czekaj reszty)</div>`:''}
    <div style="height:6px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;margin-bottom:16px;">
      <div style="height:100%;width:${Math.round((cw.exIdx+doneSets/Math.max(1,ex.sets.length))/cw.exercises.length*100)}%;background:${accent};"></div>
    </div>
    <div class="cw-set-row" style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">
      <div>#</div><div>Kg</div><div>Powt.</div><div></div>
    </div>
    ${ex.sets.map((s,i)=>`<div class="cw-set-row">
      <div style="text-align:center;font-weight:700;color:${s.done?'var(--teal)':'var(--muted)'};">${s.done?'✓':s.setNo}${s.kind&&s.kind!=='work'?`<div class="cw-set-kind ${s.kind}">${escHtml((typeof setKindBadge==='function'&&setKindBadge(s.kind))||s.kind)}</div>`:''}</div>
      <input type="number" inputmode="decimal" value="${escHtml(s.kg)}" ${s.done?'disabled':''} oninput="cwPatchSet(${i},'kg',this.value)" class="${s.done?'cw-set-done':''}">
      <input type="text" inputmode="numeric" value="${escHtml(s.reps)}" ${s.done?'disabled':''} placeholder="${s.kind==='amrap'?'max':''}" oninput="cwPatchSet(${i},'reps',this.value)" class="${s.done?'cw-set-done':''}">
      <button type="button" class="btn ${s.done?'btn-ghost':'btn-primary'} btn-sm" onclick="cwCheckSet(${i})">${s.done?'↩':'+'}</button>
    </div>`).join('')}
    <div style="display:flex;gap:8px;margin-top:18px;">
      ${cw.exIdx>0?`<button type="button" class="btn btn-ghost" onclick="cwPrevEx()">←</button>`:''}
      <button type="button" class="btn btn-ghost" style="flex:1;" onclick="cwSkipEx()">Pomiń ćwiczenie</button>
    </div>`;
}

async function cwFinish(){
  const cw=window._cw;if(!cw)return;
  if(!cw.rating){if(typeof notify==='function')notify('Wybierz ocenę 1–5 — trener to widzi');return;}
  const clientId=window._clientId;
  const totalSets=cw.exercises.flatMap(e=>e.sets).filter(s=>s.done).length;
  const volume=Math.round(cw.exercises.flatMap(e=>e.sets).filter(s=>s.done&&s.kg).reduce((a,s)=>a+(parseFloat(s.kg)||0)*(parseFloat(s.reps)||0),0));
  const durationMin=Math.max(1,Math.round((cw.elapsed||0)/60));
  const newSession=withTrainer({
    id:newId('s'),
    clientId,
    date:todayYmd(),
    time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),
    type:cw.dayName||'Trening',
    duration:durationMin,
    exercises:cw.exercises.map(e=>({
      name:e.name,
      sets:e.sets.filter(s=>s.done).map(s=>({kg:parseFloat(s.kg)||0,reps:parseFloat(s.reps)||0,setNo:s.setNo,kind:s.kind||'work'}))
    })),
    volume,
    feedback:cw.rating||0,
    note:cw.note||'',
    source:'client',
    planId:cw.planId,
    dayIdx:cw.dayIdx,
    createdAt:new Date().toISOString()
  });
  window.SE=window.SE||[];
  window.SE.push(newSession);
  await persistById('sessions',newSession);
  const me=(window.CL||[])[0];
  const name=me&&me.name?me.name.split(' ')[0]:'Klient';
  pushClientMsg('Zrobiłem trening: '+cw.dayName+(cw.rating?(' · ocena '+cw.rating+'/5'):'')+(cw.note?('\n'+cw.note):''));
  if(typeof addNotification==='function'){
    addNotification('system','Trening klienta',name+' · '+cw.dayName+' · ocena '+cw.rating+'/5 · '+durationMin+' min · '+totalSets+' serii','live');
  }
  if(typeof notify==='function')notify('✓ Trening zapisany');
  cwClearTimers();
  window._cw=null;
  const wrap=document.getElementById('clive-player');
  if(wrap)wrap.hidden=true;
  document.body.classList.remove('cw-playing');
  window._cliveSessionId=newSession.id;
  window._clientLiveScreen='progress';
  renderClientLive();
}

function ppOpenDraft(){
  if(!window._clientAppMode && !(window.cpClientId&&document.getElementById('cp-drawer')&&document.getElementById('cp-drawer').classList.contains('open'))){
    if(typeof notify==='function')notify('Podgląd — klient robi zdjęcia w swojej apce');
    return;
  }
  const cid=window._clientAppMode?window._clientId:window.cpClientId;
  const c=(window.CL||[]).find(x=>x.id===cid)||(window.CL||[])[0]||{};
  window._ppDraft={front:'',side:'',back:'',weight:c.weight||'',note:'',open:true};
  if(window._clientAppMode)renderClientLive();
  else if(typeof setCPTab==='function')setCPTab('photos');
}
function ppCloseDraft(){
  window._ppDraft=null;
  if(window._clientAppMode)renderClientLive();
  else if(typeof setCPTab==='function')setCPTab('photos');
}
async function ppPick(view,input){
  const file=input&&input.files&&input.files[0];
  if(!file)return;
  try{
    const data=await compressImageFile(file);
    window._ppDraft=window._ppDraft||{front:'',side:'',back:'',weight:'',note:'',open:true};
    window._ppDraft[view]=data;
    window._ppDraft.open=true;
    if(window._clientAppMode)renderClientLive();
    else if(typeof setCPTab==='function')setCPTab('photos');
  }catch(e){
    if(typeof notify==='function')notify('Nie udało się wczytać zdjęcia');
  }
  if(input)input.value='';
}
async function ppSave(clientId){
  const draft=window._ppDraft||{};
  const cid=clientId||window._clientId;
  if(!cid)return;
  if(!draft.front&&!draft.side&&!draft.back){
    if(typeof notify==='function')notify('Dodaj przynajmniej jedno zdjęcie');
    return;
  }
  const entry=withTrainer({
    id:newId('pp'),
    clientId:cid,
    date:typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10),
    weight:draft.weight||'',
    note:draft.note||'',
    photos:{front:draft.front||'',side:draft.side||'',back:draft.back||''},
    source:window._clientAppMode?'client':'trainer',
    createdAt:new Date().toISOString()
  });
  window.PROGRESS_PHOTOS=window.PROGRESS_PHOTOS||[];
  window.PROGRESS_PHOTOS.push(entry);
  await persistById('progressPhotos',entry);
  window._ppDraft=null;
  if(window._clientAppMode){
    pushClientMsg('Dodałem zdjęcia sylwetki ('+entry.date+').');
    if(typeof addNotification==='function'){
      const me=(window.CL||[])[0];
      addNotification('task','Nowe zdjęcia sylwetki',(me&&me.name)||'Klient','clients');
    }
  }
  if(typeof notify==='function')notify('✓ Zdjęcia zapisane');
  if(window._clientAppMode){window._clientLiveScreen='progress';renderClientLive();}
  else if(typeof setCPTab==='function')setCPTab('photos');
}
function ppDelete(id){
  if(!id||!confirm('Usunąć ten zestaw zdjęć?'))return;
  window.PROGRESS_PHOTOS=(window.PROGRESS_PHOTOS||[]).filter(p=>p.id!==id);
  if(window._db){try{window._del(window._doc(window._db,'progressPhotos',id));}catch(e){}}
  if(typeof notify==='function')notify('Usunięto zestaw');
  if(window._clientAppMode)renderClientLive();
  else if(typeof setCPTab==='function')setCPTab('photos');
}
function ppSetCmp(side,id){
  window._ppCmp=window._ppCmp||{left:'',right:'',view:'front'};
  window._ppCmp[side]=id;
  if(window._clientAppMode)renderClientLive();
  else if(typeof setCPTab==='function')setCPTab('photos');
}
function ppCmpView(view){
  window._ppCmp=window._ppCmp||{left:'',right:'',view:'front'};
  window._ppCmp.view=view;
  if(window._clientAppMode)renderClientLive();
  else if(typeof setCPTab==='function')setCPTab('photos');
}
function ppLatestWeight(c){
  const entries=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===c.id&&e.groupId==='mg1'&&e.values&&e.values.m1!=null)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(entries[0])return entries[0].values.m1;
  return c.weight||'—';
}

function ppSlotHTML(view,label,src,cid,live){
  const pick=live?`onchange="ppPick('${view}',this)"`:'';
  return `<label style="display:block;cursor:pointer;">
    <input type="file" accept="image/*" capture="environment" style="display:none;" ${pick}>
    <div style="border:1px dashed rgba(255,255,255,.15);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04);min-height:110px;display:flex;flex-direction:column;">
      ${src?`<img src="${src}" alt="${label}" style="width:100%;height:120px;object-fit:cover;display:block;">`
        :`<div style="height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:rgba(255,255,255,.4);font-size:11px;"><span style="font-size:22px;">📷</span>${label}</div>`}
      <div style="padding:6px;text-align:center;font-size:10px;color:rgba(255,255,255,.5);">${src?'Zmień':'Zrób / wgraj'} · ${label}</div>
    </div>
  </label>`;
}

function ppBlockHTML(c,opts){
  opts=opts||{};
  const live=!!opts.live;
  const accent=opts.accent||'#e60000';
  const cid=c.id;
  if(!ppFeatureOn(c))return '';
  const list=ppListFor(cid);
  const draft=window._ppDraft;
  const views=[{id:'front',l:'Przód'},{id:'side',l:'Bok'},{id:'back',l:'Tył'}];
  let cmp=window._ppCmp;
  if(!cmp||!cmp.left||!cmp.right){
    cmp={left:(list[0]&&list[0].id)||'',right:(list[list.length-1]&&list[list.length-1].id)||'',view:(cmp&&cmp.view)||'front'};
    window._ppCmp=cmp;
  }
  const left=list.find(p=>p.id===cmp.left)||list[0];
  const right=list.find(p=>p.id===cmp.right)||list[list.length-1];
  const view=cmp.view||'front';
  const draftBox=draft&&draft.open?`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;margin-bottom:14px;">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px;">Nowy zestaw</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
      ${views.map(v=>ppSlotHTML(v.id,v.l,draft[v.id],cid,live)).join('')}
    </div>
    <input type="number" inputmode="decimal" class="form-input" placeholder="Waga (kg, opcjonalnie)" value="${escHtml(draft.weight||'')}" oninput="window._ppDraft.weight=this.value" style="margin-bottom:8px;font-size:16px;">
    <input type="text" class="form-input" placeholder="Notatka (opcjonalnie)" value="${escHtml(draft.note||'')}" oninput="window._ppDraft.note=this.value" style="margin-bottom:10px;font-size:14px;">
    <div style="display:flex;gap:8px;">
      <button type="button" class="btn btn-ghost" style="flex:1;" onclick="ppCloseDraft()">Anuluj</button>
      <button type="button" class="btn btn-primary" style="flex:1;" onclick="ppSave('${escHtml(cid)}')">Zapisz</button>
    </div>
  </div>`:'';
  const compare=list.length>=2&&left&&right?`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;margin-bottom:14px;">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Porównanie</div>
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <select class="form-select" onchange="ppSetCmp('left',this.value)">${list.map(p=>`<option value="${escHtml(p.id)}" ${p.id===left.id?'selected':''}>${escHtml(p.date)}</option>`).join('')}</select>
      <select class="form-select" onchange="ppSetCmp('right',this.value)">${list.map(p=>`<option value="${escHtml(p.id)}" ${p.id===right.id?'selected':''}>${escHtml(p.date)}</option>`).join('')}</select>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;">${views.map(v=>`<button type="button" class="btn ${view===v.id?'btn-primary':'btn-ghost'} btn-sm" onclick="ppCmpView('${v.id}')">${v.l}</button>`).join('')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><div style="font-size:10px;color:rgba(255,255,255,.45);margin-bottom:4px;">${escHtml(left.date)}${left.weight?' · '+escHtml(String(left.weight))+' kg':''}</div>${left.photos&&left.photos[view]?`<img src="${left.photos[view]}" style="width:100%;border-radius:10px;object-fit:cover;aspect-ratio:3/4;">`:'<div style="aspect-ratio:3/4;border-radius:10px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.35);">Brak</div>'}</div>
      <div><div style="font-size:10px;color:rgba(255,255,255,.45);margin-bottom:4px;">${escHtml(right.date)}${right.weight?' · '+escHtml(String(right.weight))+' kg':''}</div>${right.photos&&right.photos[view]?`<img src="${right.photos[view]}" style="width:100%;border-radius:10px;object-fit:cover;aspect-ratio:3/4;">`:'<div style="aspect-ratio:3/4;border-radius:10px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.35);">Brak</div>'}</div>
    </div>
  </div>`:'';
  const history=list.length?list.slice().reverse().map(p=>`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px;margin-bottom:8px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;">${escHtml(p.date)}${p.weight?' · '+escHtml(String(p.weight))+' kg':''}</div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="${live?`ppDelete('${escHtml(p.id)}')`:'void(0)'}">Usuń</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
      ${views.map(v=>p.photos&&p.photos[v.id]?`<img src="${p.photos[v.id]}" style="width:100%;height:88px;object-fit:cover;border-radius:8px;">`:`<div style="height:88px;border-radius:8px;background:rgba(255,255,255,.04);"></div>`).join('')}
    </div>
    ${p.note?`<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:6px;">${escHtml(p.note)}</div>`:''}
  </div>`).join(''):`<div style="text-align:center;padding:18px;color:rgba(255,255,255,.45);font-size:12px;line-height:1.6;">Zrób zestaw przód / bok / tył — potem porównasz z kolejnym miesiącem.</div>`;
  return `<div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:13px;font-weight:700;">Zdjęcia sylwetki</div>
      ${draft&&draft.open?'':`<button type="button" class="btn btn-primary btn-sm" onclick="${live?'ppOpenDraft()':'notify(\'Podgląd — klient robi zdjęcia w swojej apce\')'}">+ Dodaj</button>`}
    </div>
    ${draftBox}${compare}${history}`;
}
window.ppBlockHTML=ppBlockHTML;
