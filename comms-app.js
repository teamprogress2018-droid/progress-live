/* Komunikacja w aplikacji: spotkania (potwierdź / poproś o zmianę), samopoczucie i trudności,
   „Do odpowiedzi” trenera ze statusami, preferencje kontaktu klienta, powiadomienia push i panel wiadomości automatycznych.
   Logika planowania i statusów: comms-core.js. Wysyłka po zamknięciu aplikacji odbywa się wyłącznie na serwerze
   (server/automation/comms-worker.cjs) — przeglądarka jej nie udaje: podgląd kolejki jest opisany jako symulacja.
   Odporność: dopóki nowe reguły Firestore nie są opublikowane, zapis sprawy przechodzi zwykłą wiadomością czatu
   z krótkim znacznikiem, a „Do odpowiedzi” odczytuje go z czatu. */
(function(){
  'use strict';
  // Publiczny klucz VAPID (nie jest tajny). Pusty = powiadomienia z serwera nie są jeszcze skonfigurowane.
  const VAPID_PUBLIC_KEY='BK0Zt0pvw1h3Q8Qmr2yTcLKtsBYpLlWnrjRv4nY8TPsczYAORYXQuwqwDV1AdzmUamnuufCcXMMGjy64gv71LGg';
  const CC=()=>window.CommsCore;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nowIso=()=>new Date().toISOString();
  const nid=p=>(typeof newId==='function'?newId(p):p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  const COMMS=window.COMMS=window.COMMS||{cases:[],prefs:{},jobs:null,rulesOk:null,loaded:false};
  const act=(name,fn)=>{if(typeof window.uiAction==='function')window.uiAction(name,fn);};
  /* Stan serwera wiadomości z dokumentu commsStatus/{trener} (zapisuje go tylko serwer przy każdym uruchomieniu).
     Brak dokumentu albo stare uruchomienie = serwer nie pracuje. Nigdy nie zgadujemy „działa”. */
  const STATUS_FRESH_MS=30*60000;
  function channelState(ch,nowMs){
    const st=COMMS.status;
    if(!st||!st.lastRunAt)return 'not_running';
    const t=Date.parse(st.lastRunAt);
    if(!Number.isFinite(t)||(nowMs||Date.now())-t>STATUS_FRESH_MS)return 'not_running';
    const c=st.channels&&st.channels[ch];
    const m=c&&c.mode;
    return ['live','simulation','needs_config','off'].includes(m)?m:'needs_config';
  }
  const STATE_LABEL={live:'Działa',simulation:'Symulacja — nic nie jest wysyłane',needs_config:'Wymaga konfiguracji',off:'Wyłączony',not_running:'Serwer nie jest uruchomiony'};
  window.commsChannelState=channelState;
  async function loadStatus(trainerId){
    if(!trainerId||!window._db||!window._getDoc||!window._doc){COMMS.status=null;return;}
    try{const d=await window._getDoc(window._doc(window._db,'commsStatus',trainerId));COMMS.status=d.exists()?d.data():null;}
    catch(e){COMMS.status=null;}
  }

  /* ================= wspólne: sprawy ================= */
  // Znacznik w czacie (zapas, gdy reguły nowej kolekcji nie są jeszcze opublikowane).
  const TAG=/\s*\[spotkanie:(potwierdzam|zmiana):([A-Za-z0-9_.:@-]{1,200}):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\]\s*$/;
  const FEEL_TAG=/\s*\[samopoczucie:([a-z_]{1,30})\]\s*$/;
  function clientName(id){const c=(window.CL||[]).find(x=>x&&x.id===id);return c?c.name:'Klient';}
  /** Sprawy z czatu: znaczniki spotkań / samopoczucia i ostatnie wiadomości klienta bez odpowiedzi trenera. */
  function chatCases(){
    const out=[];const M=window.MSGS||{};
    (window.CL||[]).forEach(c=>{
      if(!c||c.status==='archived')return;
      const msgs=(M[c.id]||[]).filter(m=>m&&!m.broadcast);
      let lastOut=-1;msgs.forEach((m,i)=>{if(m.out)lastOut=i;});
      let pending=null,count=0;
      msgs.forEach((m,i)=>{
        if(m.out)return;
        const t=String(m.text||'');const g=TAG.exec(t),f=FEEL_TAG.exec(t);
        if(g){out.push({id:'msg_'+m.id,virtual:true,clientId:c.id,type:g[1]==='potwierdzam'?'meeting_confirm':'meeting_change',sessionId:g[2],sessionStamp:g[3],
          text:t.replace(TAG,'').replace(/^(✅ Potwierdzam spotkanie|🔁 Proszę o zmianę terminu)\s*(—\s*)?/,'').trim(),status:g[1]==='potwierdzam'?'done':(i<lastOut?'in_progress':'new'),source:'chat',createdAt:m.createdAt});return;}
        if(f){out.push({id:'msg_'+m.id,virtual:true,clientId:c.id,type:f[1]==='trudnosc'?'difficulty':'wellbeing',mood:f[1],text:(t.replace(FEEL_TAG,'').split(' — ')[1]||'').trim(),
          status:i<lastOut?'in_progress':'new',source:'chat',createdAt:m.createdAt});return;}
        if(i>lastOut){pending=m;count++;}
      });
      if(pending)out.push({id:'msg_'+pending.id,virtual:true,clientId:c.id,type:'message',text:String(pending.text||''),count,status:'new',source:'chat',createdAt:pending.createdAt});
    });
    return out;
  }
  /** Wszystkie sprawy: zapisane (commsCases) + z czatu; zapisany status trenera ma pierwszeństwo. */
  function allCases(){
    const stored=(COMMS.cases||[]).filter(Boolean);
    const byId=new Map(stored.map(c=>[c.id,c]));
    chatCases().forEach(v=>{const s=byId.get(v.id);byId.set(v.id,s?Object.assign({},v,s,{virtual:false}):v);});
    return [...byId.values()];
  }
  function openCases(){return allCases().filter(c=>c.status!=='done'&&CC().caseNeedsReply(c));}
  window.commsAllCases=allCases;window.commsOpenCount=()=>openCases().length;
  /** Sprawy klienta (aplikacja klienta): z kolekcji i z czatu. */
  function myCases(){return allCases().filter(c=>c.clientId===window._clientId);}

  /* ================= klient: zapis spraw ================= */
  async function writeCase(doc){
    // Podgląd trenera (nie aplikacja klienta): zapis jak zwykły rekord trenera.
    if(!window._clientAppMode){COMMS.cases.push(doc);if(typeof persistById==='function')persistById('commsCases',doc);return 'stored';}
    try{
      if(!window._db||typeof window._setDoc!=='function')throw new Error('offline');
      await window._setDoc(window._doc(window._db,'commsCases',doc.id),doc);
      COMMS.cases.push(doc);COMMS.rulesOk=true;return 'stored';
    }catch(e){
      COMMS.rulesOk=false;
      // Zapas: zwykła wiadomość czatu (działa na obecnych regułach) — trener zobaczy ją w „Do odpowiedzi”.
      const text=doc.type==='meeting_confirm'||doc.type==='meeting_change'
        ?`${doc.type==='meeting_confirm'?'✅ Potwierdzam spotkanie':'🔁 Proszę o zmianę terminu'}${doc.reason?' — '+doc.reason:''}${doc.text?': '+doc.text:''} [spotkanie:${doc.type==='meeting_confirm'?'potwierdzam':'zmiana'}:${doc.sessionId}:${doc.sessionStamp}]`
        :`${doc.type==='difficulty'?'⚠️ Zgłaszam trudność':'💬 Samopoczucie'}: ${feelLabel(doc.mood)}${doc.text?' — '+doc.text:''} [samopoczucie:${doc.type==='difficulty'?'trudnosc':doc.mood||'inne'}]`;
      const ok=typeof pushClientMsg==='function'?await pushClientMsg(text):false;
      return ok?'chat':'failed';
    }
  }
  function baseCase(type,extra){
    return Object.assign({id:nid('cc'),trainerId:window._trainerId||window._uid,clientId:window._clientId,type,status:type==='meeting_confirm'?'done':'new',source:'app',createdAt:nowIso()},extra||{});
  }
  function sessionById(id){return (window.SE||[]).find(s=>s&&s.id===id);}
  async function confirmMeeting(sessionId){
    const s=sessionById(sessionId);if(!s)return;
    const r=await writeCase(baseCase('meeting_confirm',{sessionId,sessionStamp:CC().stampOf(s)}));
    toast(r==='failed'?'Nie udało się wysłać. Sprawdź internet i spróbuj ponownie.':'Dziękujemy! Trener wie, że będziesz.');
    rerenderClient();
  }
  window.commsConfirmMeeting=confirmMeeting;

  /* ---------- arkusze klienta (zmiana terminu, samopoczucie) ---------- */
  const CHANGE_REASONS=['Inny dzień','Inna godzina','Nie mogę przyjść'];
  const FEELS=[['dobrze','Czuję się dobrze'],['zmeczenie','Jestem zmęczony / zmęczona'],['bol','Coś mnie boli'],['brak_czasu','Brakuje mi czasu'],['trudnosc','Mam trudność z ćwiczeniem lub planem'],['inne','Inne']];
  function feelLabel(k){const f=FEELS.find(x=>x[0]===k);return f?f[1]:'Inne';}
  function sheet(id,title,body){
    closeSheet();
    const w=document.createElement('div');w.className='cs-sheet-wrap comms-sheet';w.id='comms-sheet';w.setAttribute('data-cs-sheet',id);
    w.innerHTML=`<div class="cs-sheet-backdrop" data-act="comms-sheet-close"></div><section class="cs-sheet" role="dialog" aria-modal="true" aria-labelledby="comms-sheet-title">
      <div class="cs-sheet-head"><h2 id="comms-sheet-title">${esc(title)}</h2><button type="button" class="cs-sheet-x" aria-label="Zamknij" data-act="comms-sheet-close">${typeof csIcon==='function'?csIcon('close',20):'×'}</button></div>
      <div class="cs-sheet-body">${body}</div></section>`;
    document.body.appendChild(w);
    const first=w.querySelector('[data-first]');if(first)setTimeout(()=>{try{first.focus();}catch(e){}},30);
    w.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});
  }
  function closeSheet(){const w=document.getElementById('comms-sheet');if(w)w.remove();}
  act('comms-sheet-close',()=>closeSheet());
  function openChange(sessionId){
    const s=sessionById(sessionId);if(!s)return;
    const when=CC().fmtWhen(CC().meetingMs(s));
    sheet('change','Poproś o zmianę terminu',`<p class="cs-sheet-text">Obecny termin: <b>${esc(when)}</b>. Trener odpowie w czacie.</p>
      <div class="cs-sheet-grid" role="group" aria-label="Powód">${CHANGE_REASONS.map((r,i)=>`<button type="button" class="cs-btn cs-btn-ghost comms-opt" aria-pressed="false" data-act="comms-pick" data-v="${esc(r)}"${i===0?' data-first':''}>${esc(r)}</button>`).join('')}</div>
      <label class="cs-sheet-field"><span>Kiedy Ci pasuje? (opcjonalnie)</span><input type="text" id="comms-change-text" maxlength="300" placeholder="np. czwartek po 17"></label>
      <button type="button" class="cs-btn cs-btn-primary" data-act="comms-send-change" data-id="${esc(sessionId)}">Wyślij prośbę</button>`);
  }
  act('comms-change',d=>openChange(d.id));
  act('comms-confirm',d=>confirmMeeting(d.id));
  act('comms-pick',(d,el)=>{const g=el.parentElement;g.querySelectorAll('.comms-opt').forEach(b=>{const on=b===el;b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));});});
  const picked=()=>{const b=document.querySelector('#comms-sheet .comms-opt.is-on');return b?b.getAttribute('data-v'):'';};
  act('comms-send-change',async d=>{
    const s=sessionById(d.id);if(!s)return;
    const text=(document.getElementById('comms-change-text')||{}).value||'';
    const r=await writeCase(baseCase('meeting_change',{sessionId:d.id,sessionStamp:CC().stampOf(s),reason:picked().slice(0,60),text:text.trim().slice(0,300)}));
    closeSheet();toast(r==='failed'?'Nie udało się wysłać. Spróbuj ponownie.':'Prośba wysłana. Trener odpowie w czacie.');rerenderClient();
  });
  function openFeel(){
    sheet('feel','Jak się czujesz?',`<p class="cs-sheet-text">Trener zobaczy Twoją odpowiedź i odezwie się w czacie.</p>
      <div class="cs-sheet-grid comms-feel" role="group" aria-label="Samopoczucie">${FEELS.map((f,i)=>`<button type="button" class="cs-btn cs-btn-ghost comms-opt" aria-pressed="false" data-act="comms-pick" data-v="${f[0]}"${i===0?' data-first':''}>${esc(f[1])}</button>`).join('')}</div>
      <label class="cs-sheet-field"><span>Napisz kilka słów (opcjonalnie)</span><textarea id="comms-feel-text" rows="3" maxlength="1000"></textarea></label>
      <p class="cs-sheet-hint">W nagłym bólu lub złym samopoczuciu nie czekaj na odpowiedź — przerwij trening i skontaktuj się z lekarzem.</p>
      <button type="button" class="cs-btn cs-btn-primary" data-act="comms-send-feel">Wyślij trenerowi</button>`);
  }
  window.commsOpenFeel=openFeel;
  act('comms-feel',()=>openFeel());
  act('comms-send-feel',async()=>{
    const mood=picked()||'inne';
    const text=((document.getElementById('comms-feel-text')||{}).value||'').trim().slice(0,1000);
    const r=await writeCase(baseCase(mood==='trudnosc'?'difficulty':'wellbeing',{mood,text}));
    closeSheet();toast(r==='failed'?'Nie udało się wysłać. Spróbuj ponownie.':'Wysłane. Dziękujemy!');rerenderClient();
  });
  function toast(t){if(typeof notify==='function')notify(t);}
  function rerenderClient(){try{if(typeof renderClientLive==='function'&&window._clientAppMode!==undefined)renderClientLive();}catch(e){}}

  /* ---------- kafelek spotkania: status i działania ---------- */
  /** Status + przyciski pod terminem spotkania (ekran Dzisiaj klienta). */
  function meetingActionsHTML(s,part){
    if(!s||!CC())return '';
    const st=CC().meetingState(s,myCases());
    const chip=`<p class="cs-meet-status is-${st.key}" role="status"><span class="cs-meet-dot" aria-hidden="true"></span>${esc(st.label)}</p>`;
    const chat=typeof csTrainerAction==='function'?csTrainerAction():"setClientLiveScreen('messages')";
    const confirm=st.key==='awaiting'?`<button type="button" class="cs-btn cs-btn-primary" data-act="comms-confirm" data-id="${esc(s.id)}">Potwierdzam</button>`:'';
    const change=st.key!=='change_requested'&&st.key!=='cancelled'?`<button type="button" class="cs-btn cs-btn-secondary" data-act="comms-change" data-id="${esc(s.id)}">Poproś o zmianę</button>`:'';
    if(part==='status')return chip;
    return `<div class="cs-meet-acts">${confirm}${change}<button type="button" class="cs-link cs-link-sm cs-meet-write" onclick="${chat}">${typeof csIcon==='function'?csIcon('chat',18):''}Napisz do trenera</button></div>`;
  }
  window.commsMeetingActionsHTML=meetingActionsHTML;
  /** Mały przycisk pod kafelkami: zgłoszenie samopoczucia lub trudności. */
  function feelLinkHTML(){return `<button type="button" class="cs-link comms-feel-link" data-act="comms-feel">${typeof csIcon==='function'?csIcon('chat',18):''}Zgłoś samopoczucie lub trudność</button>`;}
  window.commsFeelLinkHTML=feelLinkHTML;

  /* ================= klient: wczytanie i preferencje ================= */
  async function commsClientLoad(account,session){
    const cid=account&&account.clientId,tid=account&&account.trainerId;
    if(!cid||!tid||!window._db)return;
    try{
      const q=window._query(window._col(window._db,'commsCases'),window._where('trainerId','==',tid),window._where('clientId','==',cid));
      const snap=await window._get(q);const rows=[];snap.forEach(d=>{const x=d.data()||{};if(x.clientId===cid&&x.trainerId===tid)rows.push({...x,id:d.id});});
      COMMS.cases=rows;COMMS.rulesOk=true;
    }catch(e){COMMS.rulesOk=false;}
    try{const p=await window._getDoc(window._doc(window._db,'commsPrefs',cid));COMMS.prefs[cid]=p.exists()?p.data():null;}catch(e){COMMS.prefs[cid]=undefined;}
    await loadStatus(tid);
    COMMS.loaded=true;
    handleDeepLink();
    rerenderClient();
  }
  window.commsClientLoad=commsClientLoad;
  function myPrefs(){const cid=window._clientId;const p=COMMS.prefs[cid];return p&&typeof p==='object'?p:{channel:'push',categories:{meetings:true,plan:true,checkins:true},quiet:{from:'21:00',to:'08:00'},fallback:true};}
  async function savePrefs(patch){
    const cid=window._clientId,tid=window._trainerId||window._uid;
    const next=Object.assign({},myPrefs(),patch,{id:cid,clientId:cid,trainerId:tid,updatedAt:nowIso()});
    if(!window._clientAppMode){COMMS.prefs[cid]=next;rerenderClient();return true;}
    try{await window._setDoc(window._doc(window._db,'commsPrefs',cid),next);COMMS.prefs[cid]=next;rerenderClient();return true;}
    catch(e){toast('Nie udało się zapisać ustawień. Ta część aplikacji czeka na włączenie przez trenera.');return false;}
  }
  const PUSH_SUPPORTED=()=>typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const IS_IOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const STANDALONE=()=>(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  /** Ekran „Powiadomienia” klienta (Więcej → Powiadomienia). Pokazuje tylko statusy, które da się ustalić. */
  function notifyHTML(){
    const p=myPrefs(),wa=p.whatsapp||{},cat=p.categories||{};
    const perm=('Notification' in window)?Notification.permission:'unsupported';
    let pushInfo;
    if(!PUSH_SUPPORTED())pushInfo=IS_IOS()&&!STANDALONE()?'Na iPhonie powiadomienia działają po dodaniu aplikacji do ekranu początkowego (Udostępnij → „Do ekranu początkowego”) i otwarciu jej z ikony.':'Ta przeglądarka nie obsługuje powiadomień.';
    else if(perm==='denied')pushInfo='Powiadomienia są zablokowane w ustawieniach telefonu lub przeglądarki. Włącz je tam, a potem wróć tutaj.';
    else if(p.push&&p.push.subscribed)pushInfo='Ten telefon jest zapisany do powiadomień. Dostarczenie zależy też od ustawień telefonu (np. tryb skupienia).';
    else pushInfo='Powiadomienia nie są włączone na tym telefonie.';
    const serverReady=!!VAPID_PUBLIC_KEY;
    const ch=(v,l)=>`<label class="comms-radio"><input type="radio" name="comms-ch" value="${v}" ${p.channel===v?'checked':''} data-act="comms-channel"> <span>${l}</span></label>`;
    const tog=(k,l)=>`<label class="comms-check"><input type="checkbox" ${cat[k]!==false?'checked':''} data-act="comms-cat" data-k="${k}"> <span>${l}</span></label>`;
    return `<div class="cs-screen comms-notify"><h1 class="cs-h1 cs-h1-page">Powiadomienia</h1>
      <section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">Jak mamy Ci przypominać?</h2>
        <p class="cs-card-text">Jedna wiadomość jednym sposobem — nie wysyłamy jej naraz wszędzie.</p>
        <div class="comms-radios" role="radiogroup" aria-label="Sposób kontaktu">${ch('push','Powiadomienie w telefonie (z aplikacji)')}${ch('whatsapp','WhatsApp')}${ch('none','Tylko w aplikacji, bez przypomnień')}</div>
        <label class="comms-check"><input type="checkbox" ${p.fallback!==false?'checked':''} data-act="comms-fallback"> <span>Jeśli wiadomość nie dojdzie, spróbuj drugim sposobem</span></label>
      </section>
      <section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">Powiadomienia w telefonie</h2>
        <p class="cs-card-text">${esc(pushInfo)}</p>
        ${PUSH_SUPPORTED()&&perm!=='denied'?(p.push&&p.push.subscribed
          ?`<button type="button" class="cs-btn cs-btn-ghost" data-act="comms-push-off">Wyłącz na tym telefonie</button>`
          :`<button type="button" class="cs-btn cs-btn-primary" data-act="comms-push-on">Włącz powiadomienia</button>`):''}
        ${PUSH_SUPPORTED()&&perm==='granted'?`<button type="button" class="cs-btn cs-btn-secondary" data-act="comms-push-test">Wyślij powiadomienie testowe</button>`:''}
        ${!serverReady||channelState('push')!=='live'?'<p class="cs-sheet-hint" data-comms-push-pending>Wysyłka powiadomień z serwera nie jest jeszcze uruchomiona przez trenera. Test pokazuje, jak powiadomienie wygląda na tym telefonie.</p>':''}
      </section>
      <section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">WhatsApp</h2>
        ${channelState('whatsapp')!=='live'?'<p class="cs-sheet-hint" data-comms-wa-pending>Wysyłka przez WhatsApp nie jest jeszcze uruchomiona. Możesz zapisać zgodę, ale do tego czasu przypomnienia zobaczysz tylko w aplikacji.</p>':''}
        ${wa.optIn&&!wa.optOutAt?`<p class="cs-card-text">Zgoda udzielona ${esc(String(wa.optInAt||'').slice(0,10))} na numer <b>${esc(wa.phone||'')}</b>. Możesz ją wycofać tutaj albo odpisując „STOP”.</p>
          <button type="button" class="cs-btn cs-btn-ghost" data-act="comms-wa-off">Wycofaj zgodę na WhatsApp</button>`
          :`<p class="cs-card-text">Przypomnienia o spotkaniach i planie od Progress Studio Treningu Personalnego przez WhatsApp. Bez reklam. Zgodę możesz wycofać w każdej chwili.</p>
          <label class="cs-sheet-field"><span>Numer WhatsApp</span><input type="tel" id="comms-wa-phone" inputmode="tel" autocomplete="tel" maxlength="20" value="${esc(wa.phone||'')}" placeholder="+48 600 100 200"></label>
          <button type="button" class="cs-btn cs-btn-secondary" data-act="comms-wa-on">Zgadzam się na przypomnienia przez WhatsApp</button>`}
      </section>
      <section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">O czym przypominać</h2>
        ${tog('meetings','Spotkania z trenerem (przypomnienie, zmiana, odwołanie)')}${tog('plan','Nowy plan treningowy')}${tog('checkins','Pytania o samopoczucie i podsumowanie tygodnia')}
        <div class="comms-quiet"><span>Cisza nocna</span><label>od <input type="time" value="${esc((p.quiet||{}).from||'21:00')}" id="comms-quiet-from"></label><label>do <input type="time" value="${esc((p.quiet||{}).to||'08:00')}" id="comms-quiet-to"></label></div>
        <button type="button" class="cs-btn cs-btn-ghost" data-act="comms-quiet-save">Zapisz ciszę nocną</button>
        <p class="cs-sheet-hint">Zmiana lub odwołanie spotkania przychodzi także w czasie ciszy.</p>
      </section></div>`;
  }
  window.commsNotifyHTML=notifyHTML;
  act('comms-channel',(d,el)=>{savePrefs({channel:el.value});});
  act('comms-fallback',(d,el)=>{savePrefs({fallback:!!el.checked});});
  act('comms-cat',(d,el)=>{const p=myPrefs();savePrefs({categories:Object.assign({meetings:true,plan:true,checkins:true},p.categories||{},{[d.k]:!!el.checked})});});
  act('comms-quiet-save',()=>{const a=(document.getElementById('comms-quiet-from')||{}).value,b=(document.getElementById('comms-quiet-to')||{}).value;if(a&&b)savePrefs({quiet:{from:a,to:b}}).then(ok=>ok&&toast('Zapisano.'));});
  act('comms-wa-on',()=>{
    const raw=((document.getElementById('comms-wa-phone')||{}).value||'');
    let d=raw.replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.length===9)d='48'+d;
    if(d.length<10||d.length>15){toast('Wpisz numer telefonu z WhatsApp.');return;}
    savePrefs({channel:'whatsapp',whatsapp:{optIn:true,phone:d,optInAt:nowIso(),optOutAt:null,consentText:'Zgoda na przypomnienia o spotkaniach i planie od Progress Studio Treningu Personalnego przez WhatsApp. Wycofanie: w aplikacji lub odpowiedź STOP.'}}).then(ok=>ok&&toast('Zgoda zapisana.'));
  });
  act('comms-wa-off',()=>{const p=myPrefs();savePrefs({channel:p.channel==='whatsapp'?'push':p.channel,whatsapp:Object.assign({},p.whatsapp||{},{optIn:false,optOutAt:nowIso()})}).then(ok=>ok&&toast('Zgoda wycofana.'));});
  function urlB64(s){const p='='.repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)));}
  // Wywołane bezpośrednio z dotknięcia przycisku (wymóg iPhone'a).
  act('comms-push-on',async()=>{
    if(!PUSH_SUPPORTED())return;
    let perm;try{perm=await Notification.requestPermission();}catch(e){perm='default';}
    if(perm!=='granted'){toast(perm==='denied'?'Powiadomienia zablokowane. Możesz je włączyć w ustawieniach telefonu.':'Nie włączono powiadomień.');rerenderClient();return;}
    if(!VAPID_PUBLIC_KEY){toast('Zgoda zapisana na tym telefonie. Wysyłkę z serwera trener uruchomi później.');rerenderClient();return;}
    try{
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64(VAPID_PUBLIC_KEY)});
      const j=sub.toJSON();const id='ps_'+(await sha(j.endpoint)).slice(0,40);
      const doc={id,trainerId:window._trainerId,clientId:window._clientId,endpoint:j.endpoint,keys:{p256dh:j.keys.p256dh,auth:j.keys.auth},device:deviceLabel(),createdAt:nowIso()};
      await window._setDoc(window._doc(window._db,'pushSubscriptions',id),doc);
      await savePrefs({push:{subscribed:true,at:nowIso(),device:deviceLabel()}});
      toast('Powiadomienia włączone.');
    }catch(e){toast('Nie udało się włączyć powiadomień. Spróbuj ponownie później.');}
  });
  act('comms-push-off',async()=>{
    try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
      if(sub){const id='ps_'+(await sha(sub.endpoint)).slice(0,40);try{await window._del(window._doc(window._db,'pushSubscriptions',id));}catch(e){}await sub.unsubscribe();}}catch(e){}
    savePrefs({push:{subscribed:false,at:nowIso(),device:deviceLabel()}});
  });
  act('comms-push-test',async()=>{
    try{const reg=await navigator.serviceWorker.ready;
      await reg.showNotification('Progress: powiadomienie testowe',{body:'Tak wygląda przypomnienie. To test na tym telefonie — nic nie wysłano z serwera.',tag:'comms-test',data:{url:'./?cs=meeting'}});
      toast('Wysłano test na ten telefon. Jeśli go nie widzisz, sprawdź ustawienia powiadomień i tryb skupienia.');
    }catch(e){toast('Ten telefon nie pozwolił pokazać powiadomienia.');}
  });
  async function sha(t){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){return String(Date.now());}}
  function deviceLabel(){const u=navigator.userAgent||'';return /iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android':'Komputer';}

  /** Link z powiadomienia: ?cs=meeting|plan|feel|chat|progress otwiera właściwe miejsce. */
  function handleDeepLink(){
    let k='';try{k=new URLSearchParams(location.search).get('cs')||'';}catch(e){}
    if(!k||!window._clientAppMode||window._commsDeepDone)return;
    window._commsDeepDone=true;
    const go=s=>{try{setClientLiveScreen(s);}catch(e){}};
    if(k==='plan')go('plan');else if(k==='chat')go('messages');else if(k==='progress')go('progress');else if(k==='feel'){go('home');setTimeout(openFeel,60);}else go('home');
    try{history.replaceState(null,'',location.pathname);}catch(e){}
  }

  /* ================= trener: wczytanie ================= */
  async function commsTrainerLoad(read){
    const [cases,prefs,jobs]=await Promise.all(['commsCases','commsPrefs','commsJobs'].map(n=>Promise.resolve(read(n)).catch(()=>null)));
    COMMS.cases=cases||[];COMMS.rulesOk=cases!==null;
    COMMS.prefs={};(prefs||[]).forEach(p=>{if(p&&p.clientId)COMMS.prefs[p.clientId]=p;});
    COMMS.jobs=jobs;
    await loadStatus(window._uid);
    COMMS.loaded=true;
    try{if(typeof renderInbox==='function'&&inboxTabIs('replies'))renderInbox();}catch(e){}
    updateRepliesBadge();
  }
  window.commsTrainerLoad=commsTrainerLoad;
  function inboxTabIs(t){return typeof inboxTab!=='undefined'&&inboxTab===t;}
  function updateRepliesBadge(){
    const n=openCases().length;const el=document.getElementById('itab-replies-n');
    if(el){el.textContent=n?String(n):'';el.hidden=!n;}
  }
  window.commsUpdateRepliesBadge=updateRepliesBadge;

  /* ================= trener: „Do odpowiedzi” ================= */
  const TYPE_ICON={meeting_confirm:'✅',meeting_change:'🔁',wellbeing:'💬',difficulty:'⚠️',message:'✉️',trainer_contact:'📞'};
  window._repliesFilter=window._repliesFilter||'open';
  function ago(iso){const t=Date.parse(iso||'');if(!t)return '';const m=Math.round((Date.now()-t)/60000);if(m<60)return m<=1?'przed chwilą':m+' min temu';const h=Math.round(m/60);if(h<24)return h+' godz. temu';const d=Math.round(h/24);return d===1?'wczoraj':d+' dni temu';}
  function caseText(c){
    const C=CC();let t=c.text||'';
    if(c.type==='meeting_confirm'||c.type==='meeting_change'){
      const s=sessionById(c.sessionId);
      const when=s?C.fmtWhen(C.meetingMs(s)):(c.sessionStamp||'');
      const stale=s&&c.sessionStamp&&C.stampOf(s)!==c.sessionStamp?' (termin był już zmieniony)':'';
      t=`${when}${stale}${c.reason?' · '+c.reason:''}${t?' · '+t:''}`;
    }
    if(c.type==='wellbeing'||c.type==='difficulty')t=`${feelLabel(c.mood)}${t?' · '+t:''}`;
    if(c.type==='message'&&c.count>1)t=`(${c.count} wiadomości) ${t}`;
    return t;
  }
  function renderRepliesList(el){
    const C=CC();
    const list=allCases().filter(c=>window._repliesFilter==='done'?c.status==='done':c.status!=='done'&&C.caseNeedsReply(c))
      .sort((a,b)=>{const r={new:0,in_progress:1,done:2};return (r[a.status]-r[b.status])||String(b.createdAt||'').localeCompare(String(a.createdAt||''));});
    const confirmed=allCases().filter(c=>c.type==='meeting_confirm'&&Date.now()-Date.parse(c.createdAt||0)<7*864e5).length;
    el.innerHTML=`<div class="rep-head">
        <div class="rep-filters" role="group" aria-label="Filtr spraw"><button type="button" class="rep-f ${window._repliesFilter!=='done'?'is-on':''}" data-act="rep-filter" data-f="open">Otwarte</button><button type="button" class="rep-f ${window._repliesFilter==='done'?'is-on':''}" data-act="rep-filter" data-f="done">Zakończone</button></div>
        ${confirmed?`<p class="rep-note">✅ ${confirmed} ${confirmed===1?'potwierdzenie':'potwierdzeń'} spotkań w tym tygodniu</p>`:''}
        ${COMMS.rulesOk===false?'<p class="rep-note rep-warn">Nowe sprawy przychodzą przez czat — reguły bazy dla „Do odpowiedzi” nie są jeszcze opublikowane.</p>':''}
      </div>
      ${list.length?list.map(c=>`<div class="rep-item is-${esc(c.status)}" data-case="${esc(c.id)}">
        <button type="button" class="rep-main" data-act="rep-open" data-id="${esc(c.id)}">
          <span class="rep-top"><b>${esc(clientName(c.clientId))}</b><span class="rep-ago">${esc(ago(c.createdAt))}</span></span>
          <span class="rep-type">${TYPE_ICON[c.type]||''} ${esc(C.CASE_LABEL[c.type]||'Sprawa')}${c.source==='whatsapp'?' · WhatsApp':c.source==='system'?' · automatycznie':''}</span>
          <span class="rep-text">${esc(caseText(c)).slice(0,220)}</span>
        </button>
        <div class="rep-acts"><span class="rep-st">${esc(C.CASE_STATUS[c.status]||c.status)}</span>
          ${c.status==='new'?`<button type="button" class="btn btn-ghost btn-sm" data-act="rep-status" data-id="${esc(c.id)}" data-s="in_progress">W trakcie</button>`:''}
          ${c.status!=='done'?`<button type="button" class="btn btn-ghost btn-sm" data-act="rep-status" data-id="${esc(c.id)}" data-s="done">Zakończ</button>`:`<button type="button" class="btn btn-ghost btn-sm" data-act="rep-status" data-id="${esc(c.id)}" data-s="new">Otwórz ponownie</button>`}
          ${c.type==='meeting_change'&&sessionById(c.sessionId)?`<button type="button" class="btn btn-ghost btn-sm" data-act="rep-session" data-id="${esc(c.sessionId)}">Zmień termin</button>`:''}
        </div></div>`).join('')
      :`<div class="rep-empty">${window._repliesFilter==='done'?'Brak zakończonych spraw.':'Nic nie czeka na odpowiedź. 👍'}</div>`}`;
    updateRepliesBadge();
  }
  window.commsRenderRepliesList=renderRepliesList;
  act('rep-filter',d=>{window._repliesFilter=d.f;try{renderInbox();}catch(e){}});
  act('rep-open',d=>{const c=allCases().find(x=>x.id===d.id);if(!c)return;try{openChat(c.clientId);}catch(e){}
    if(c.status==='new'&&c.type!=='message')setStatus(c.id,'in_progress');});
  act('rep-session',d=>{try{editSession(d.id);}catch(e){}});
  act('rep-status',d=>setStatus(d.id,d.s));
  async function setStatus(id,status){
    const c=allCases().find(x=>x.id===id);if(!c)return;
    const doc={id:c.id,trainerId:window._uid,clientId:c.clientId,type:c.type,status,source:c.source||'chat',createdAt:c.createdAt||nowIso(),updatedAt:nowIso()};
    ['sessionId','sessionStamp','reason','mood','text'].forEach(k=>{if(c[k]!=null&&c[k]!=='')doc[k]=String(c[k]).slice(0,2000);});
    const i=COMMS.cases.findIndex(x=>x.id===id);
    if(i>=0)COMMS.cases[i]=Object.assign({},COMMS.cases[i],doc);else COMMS.cases.push(doc);
    try{renderInbox();}catch(e){}
    if(typeof persistById==='function'){const saved=await persistById('commsCases',doc);if(!saved)toast('Status widoczny tylko na tym urządzeniu — zapis do bazy wymaga publikacji reguł.');}
  }
  window.commsSetCaseStatus=setStatus;

  /* ================= trener: spotkania i wiadomości automatyczne ================= */
  /** Zmiana lub odwołanie terminu zapisuje changedAt — serwer wyśle informację i usunie stare przypomnienie. */
  function markSessionChanged(s,prev){
    if(!s||!prev)return;
    if(String(prev.date||'')!==String(s.date||'')||String(prev.time||'')!==String(s.time||'')){s.changedAt=nowIso();s.prevAt=prev.date+'T'+(prev.time||'');}
  }
  window.commsMarkSessionChanged=markSessionChanged;
  async function cancelMeeting(id){
    const s=sessionById(id);if(!s)return;
    if(!confirm('Odwołać to spotkanie? Klient zobaczy w aplikacji, że jest odwołane'+(settings().enabled?' i dostanie informację.':'.')))return;
    s.status='cancelled';s.changedAt=nowIso();s.updatedAt=s.changedAt;
    try{closeM('m-session');}catch(e){}
    try{renderCal();}catch(e){}try{renderDash();}catch(e){}
    if(typeof persistById==='function'&&await persistById('sessions',s))toast('Spotkanie odwołane.');
  }
  window.commsCancelMeeting=cancelMeeting;
  /** Linia statusu w oknie spotkania: potwierdzenie / prośba o zmianę od klienta. */
  function sessionStatusLine(id){
    const s=sessionById(id);if(!s||!CC()||!CC().isMeeting(s))return '';
    const st=CC().meetingState(s,allCases().filter(c=>c.clientId===s.clientId));
    const when=st.case&&st.case.createdAt?' · '+new Date(st.case.createdAt).toLocaleString('pl-PL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="comms-sess-line is-${st.key}">${esc(st.label)}${esc(when)}${st.key==='change_requested'&&st.case&&st.case.text?' — „'+esc(st.case.text)+'”':''}</div>`;
  }
  window.commsSessionStatusLine=sessionStatusLine;

  function settings(){const S=window.SETTINGS||{};return CC().settingsOf(S.comms||{});}
  const KIND_LABEL={meeting_reminder:'Przypomnienie dzień przed spotkaniem',meeting_change:'Zmiana terminu',meeting_cancel:'Odwołanie spotkania',new_plan:'Nowy plan',
    first_workout_check:'Pytanie po pierwszym treningu',weekly_summary:'Podsumowanie tygodnia',inactivity_nudge:'Przypomnienie po braku aktywności',trainer_contact:'Zadanie: kontakt z klientem'};
  const CH_LABEL={push:'Powiadomienie push',whatsapp:'WhatsApp',inapp:'Tylko w aplikacji',trainer_task:'Do odpowiedzi (trener)'};
  function prefsSummary(cid){
    const p=COMMS.prefs[cid];
    if(!p)return 'nie wybrał(a) — tylko w aplikacji';
    const bits=[];
    bits.push(p.channel==='whatsapp'?'woli WhatsApp':p.channel==='none'?'bez przypomnień':'woli powiadomienia');
    if(p.whatsapp&&p.whatsapp.optIn&&!p.whatsapp.optOutAt)bits.push('zgoda WhatsApp '+String(p.whatsapp.optInAt||'').slice(0,10));
    else if(p.whatsapp&&p.whatsapp.optOutAt)bits.push('wycofał(a) zgodę WhatsApp');
    if(p.push&&p.push.subscribed)bits.push('push zapisany ('+(p.push.device||'urządzenie')+')');
    return bits.join(' · ');
  }
  function panelHTML(){
    const st=settings(),C=CC();
    const S=window.SETTINGS||{};const enabledAt=(S.comms&&S.comms.enabledAt)||new Date(Date.now()-864e5).toISOString();
    const preview=C.planJobs({clients:window.CL||[],sessions:window.SE||[],plans:window.PL||[],settings:S.comms||{},enabledAt},Date.now())
      .filter(j=>j.dueAt>=Date.now()-36e5).sort((a,b)=>a.dueAt-b.dueAt).slice(0,25);
    const fmt=ms=>{const p=C.warsawParts(ms);return p.ymd.slice(8,10)+'.'+p.ymd.slice(5,7)+' '+p.hm;};
    const running=channelState('push')!=='not_running';
    const server=running&&Array.isArray(COMMS.jobs);
    const jobs=server?COMMS.jobs.slice().sort((a,b)=>(b.dueAt||0)-(a.dueAt||0)).slice(0,40):[];
    const anyLive=['push','whatsapp'].some(ch=>channelState(ch)==='live');
    const chRow=(ch,label)=>{const k=channelState(ch);const miss=(COMMS.status&&COMMS.status.channels&&COMMS.status.channels[ch]&&COMMS.status.channels[ch].missing)||[];
      return `<li class="comms-ch is-${k}" data-comms-ch="${ch}" data-state="${k}"><b>${label}:</b> ${esc(STATE_LABEL[k])}${k==='needs_config'&&miss.length?' — brakuje: '+esc(miss.join(', ')):''}</li>`;};
    const lastRun=running&&COMMS.status?new Date(COMMS.status.lastRunAt).toLocaleString('pl-PL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    const row=(on,key,label,extra)=>`<label class="comms-tg"><input type="checkbox" data-cfg="${key}" ${on?'checked':''}> <span>${label}</span>${extra||''}</label>`;
    return `<div class="comms-panel">
      <div class="comms-mode ${anyLive?'is-on':'is-off'}" data-comms-mode="${anyLive?'live':running?'server':'off'}">
        <b>${anyLive?'Wysyłka po zamknięciu aplikacji: działa':running?'Serwer wiadomości pracuje, ale nic nie wysyła':'Wysyłka po zamknięciu aplikacji: jeszcze nie uruchomiona'}</b>
        <ul class="comms-ch-list">${chRow('push','Powiadomienia push')}${chRow('whatsapp','WhatsApp')}</ul>
        <span>${running?'Ostatnie uruchomienie serwera: '+esc(lastRun)+'. „Działa” oznacza przekazanie wiadomości dostawcy; dostarczenie zależy od telefonu klienta.':'Na razie klienci widzą spotkania, potwierdzenia i przypomnienia tylko w aplikacji. Automatyczne push i WhatsApp ruszą po wdrożeniu serwera i konfiguracji (server/automation/README.md).'}</span>
      </div>
      <h3 class="comms-h">Co wysyłać automatycznie</h3>
      ${row(st.remindDayBefore.on,'remindDayBefore.on','A. Przypomnienie dzień przed spotkaniem, z przyciskiem „Potwierdzam”',` o <input type="time" data-cfg="remindDayBefore.hour" value="${esc(st.remindDayBefore.hour)}">`)}
      ${row(st.meetingChange.on,'meetingChange.on','B. Informacja o zmianie lub odwołaniu terminu (od razu)')}
      ${row(st.newPlan.on,'newPlan.on','C. Informacja o nowym planie z linkiem do planu')}
      ${row(st.firstWorkoutCheck.on,'firstWorkoutCheck.on','D. Pytanie o samopoczucie po pierwszym treningu',` po <input type="number" min="1" max="24" data-cfg="firstWorkoutCheck.afterHours" value="${esc(st.firstWorkoutCheck.afterHours)}"> godz.`)}
      ${row(st.weeklySummary.on,'weeklySummary.on','E. Podsumowanie tygodnia',` w <select data-cfg="weeklySummary.weekday">${['niedzielę','poniedziałek','wtorek','środę','czwartek','piątek','sobotę'].map((d,i)=>`<option value="${i}" ${+st.weeklySummary.weekday===i?'selected':''}>${d}</option>`).join('')}</select> o <input type="time" data-cfg="weeklySummary.hour" value="${esc(st.weeklySummary.hour)}">`)}
      ${row(st.inactivity.on,'inactivity.on','F. Jedno przypomnienie po braku treningu',` po <input type="number" min="3" max="30" data-cfg="inactivity.days" value="${esc(st.inactivity.days)}"> dniach, potem zadanie dla Ciebie po <input type="number" min="1" max="14" data-cfg="inactivity.trainerAfterDays" value="${esc(st.inactivity.trainerAfterDays)}"> dniach`)}
      <div class="comms-quiet-t">Cisza nocna (domyślnie dla klientów): od <input type="time" data-cfg="quiet.from" value="${esc(st.quiet.from)}"> do <input type="time" data-cfg="quiet.to" value="${esc(st.quiet.to)}"></div>
      <p class="comms-note">Czas: Europe/Warsaw (ze zmianą czasu). Klienci na przerwie lub zawieszeni nie dostają wiadomości. Każda wiadomość jest oznaczona jako przypomnienie systemowe — nie udaje, że piszesz osobiście.</p>
      <button type="button" class="btn btn-primary btn-sm" data-act="comms-save-cfg">Zapisz ustawienia</button>
      <h3 class="comms-h">Najbliższe wiadomości <span class="comms-badge-sim">PODGLĄD — przeglądarka niczego nie wysyła</span></h3>
      ${preview.length?`<table class="comms-tbl"><thead><tr><th>Kiedy</th><th>Klient</th><th>Co</th><th>Sposób</th></tr></thead><tbody>${preview.map(j=>`<tr><td>${esc(fmt(j.dueAt))}</td><td>${esc(clientName(j.clientId))}</td><td>${esc(KIND_LABEL[j.kind]||j.kind)}</td><td>${esc(CH_LABEL[C.pickChannel(COMMS.prefs[j.clientId],j)]||'')}</td></tr>`).join('')}</tbody></table>`:'<p class="comms-note">Na razie nic nie jest zaplanowane.</p>'}
      <h3 class="comms-h">Historia wysyłki (z serwera)</h3>
      ${server&&jobs.length?`<table class="comms-tbl"><thead><tr><th>Termin</th><th>Klient</th><th>Co</th><th>Kanał</th><th>Status</th></tr></thead><tbody>${jobs.map(j=>`<tr><td>${esc(fmt(j.dueAt))}</td><td>${esc(clientName(j.clientId))}</td><td>${esc(KIND_LABEL[j.kind]||j.kind)}</td><td>${esc(CH_LABEL[j.channel]||'—')}</td><td class="st-${esc(j.status)}">${esc(C.LABEL[C.staleStatus(j,Date.now())]||j.status)}${j.lastError?' · '+esc(j.lastError):''}</td></tr>`).join('')}</tbody></table>`
        :`<p class="comms-note">${server?'Brak wysłanych wiadomości.':'Brak — serwer nie wysyła jeszcze wiadomości. Nie pokazujemy żadnych „wysłanych”, dopóki tak nie jest.'}</p>`}
      <h3 class="comms-h">Zgody i sposób kontaktu klientów</h3>
      <ul class="comms-prefs">${(window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>`<li><b>${esc(c.name)}</b> — ${esc(prefsSummary(c.id))}</li>`).join('')||'<li>Brak klientów.</li>'}</ul>
      <p class="comms-note">Zgodę na WhatsApp i powiadomienia zaznacza klient w swojej aplikacji (Więcej → Powiadomienia). Brak zapisanego telefonu do push nie oznacza, że klient nie ma aplikacji.</p>
    </div>`;
  }
  function openPanel(){
    let ov=document.getElementById('m-comms');
    if(!ov){ov=document.createElement('div');ov.className='modal-ov';ov.id='m-comms';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','m-comms-t');
      ov.innerHTML=`<div class="modal modal-lg"><div class="modal-hdr"><div class="modal-title" id="m-comms-t">SPOTKANIA I POWIADOMIENIA</div><button class="modal-close" aria-label="Zamknij" onclick="closeM('m-comms')">×</button></div><div class="modal-body" id="m-comms-body"></div></div>`;
      document.body.appendChild(ov);}
    document.getElementById('m-comms-body').innerHTML=panelHTML();
    if(typeof openM==='function')openM('m-comms');else ov.classList.add('show');
  }
  window.openCommsPanel=openPanel;
  act('comms-open-panel',()=>openPanel());
  act('comms-save-cfg',async()=>{
    const S=window.SETTINGS;if(!S)return;
    const cfg=JSON.parse(JSON.stringify(settings()));
    document.querySelectorAll('#m-comms [data-cfg]').forEach(el=>{
      const path=el.getAttribute('data-cfg').split('.');let o=cfg;path.slice(0,-1).forEach(p=>{o=o[p];});
      const k=path[path.length-1];o[k]=el.type==='checkbox'?el.checked:el.type==='number'||el.tagName==='SELECT'?Number(el.value):el.value;
    });
    cfg.enabledAt=(S.comms&&S.comms.enabledAt)||nowIso();
    S.comms=cfg;
    const ok=typeof persistSettingsDoc==='function'?await persistSettingsDoc():false;
    toast(ok?'Ustawienia zapisane.':'Zapisano na tym urządzeniu — sprawdź połączenie.');
    document.getElementById('m-comms-body').innerHTML=panelHTML();
  });
})();
