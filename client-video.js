/* Film techniki od klienta do przypisanego trenera.
 * Plik: PRYWATNA ścieżka Storage client-videos/{trainerId}/{clientId}/v_….{mp4|mov|webm} (reguły w storage.rules).
 * Wiadomość: istniejący czat (messages) — tekst z nazwą ćwiczenia i treningiem + znacznik [film:v_….mp4].
 * W Firestore NIE ma adresu do pliku ani tokenu: odtwarzanie przez zalogowane pobranie getBlob → adres obiektu w pamięci.
 * Nic nie wysyła się samo: klient wybiera film, widzi podgląd i odbiorcę, dopiero „Wyślij film” rozpoczyna wysyłkę.
 * Bez kompresji i zmiany pliku. Nie logujemy pliku, ścieżek z tokenami ani treści wiadomości. */
(function(){
  'use strict';
  const CV_MAX_MB=75, CV_MAX_BYTES=CV_MAX_MB*1024*1024, CV_MAX_SEC=60;
  const CV_TYPES={'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'};
  const CV_EXT_TYPE={mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
  const CV_TAG=/\[film:(v_[A-Za-z0-9_-]{6,80}\.(?:mp4|mov|webm))\]/;
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ico=(n,sz)=>typeof csIcon==='function'?csIcon(n,sz):'';

  function cvStripTag(text){return String(text||'').replace(/\[film:[^\]]*\]\s*/g,'').trim();}
  function cvFileFromText(text){const m=CV_TAG.exec(String(text||''));return m?m[1]:'';}
  function cvPath(trainerId,clientId,file){return 'client-videos/'+trainerId+'/'+clientId+'/'+file;}
  function cvStorageReady(){return !!(window._storage&&window._storageRef&&window._uploadBytes&&window._getBlob&&window._deleteObject);}
  function cvTrainerName(){
    try{if(typeof getTrainerName==='function'){const n=getTrainerName();if(n)return String(n).slice(0,80);}}catch(e){}
    const p=(window.SETTINGS&&window.SETTINGS.profile)||{};
    return String(p.name||'Twój trener').slice(0,80);
  }
  function cvDateLabel(ymd){
    try{const d=new Date(String(ymd).slice(0,10)+'T12:00:00');return d.toLocaleDateString('pl',{day:'numeric',month:'long'});}catch(e){return String(ymd||'');}
  }
  /** Typ pliku: z file.type, a gdy telefon go nie poda — z rozszerzenia nazwy. */
  function cvFileType(file){
    const t=String(file&&file.type||'').toLowerCase();
    if(CV_TYPES[t])return {type:t,ext:CV_TYPES[t]};
    const ext=(String(file&&file.name||'').toLowerCase().match(/\.([a-z0-9]+)$/)||[])[1]||'';
    if(!t&&CV_EXT_TYPE[ext]){const type=CV_EXT_TYPE[ext];return {type,ext:CV_TYPES[type]};}
    return null;
  }
  function cvMb(bytes){return (Math.round(bytes/1024/1024*10)/10).toString().replace('.',',');}
  /** Sprawdzenie przed podglądem: format i rozmiar. Zwraca komunikat błędu albo ''. */
  function cvValidate(file){
    if(!file)return 'Nie wybrano pliku.';
    if(!cvFileType(file))return 'Ten format nie jest obsługiwany. Wyślij film MP4, MOV (iPhone) albo WebM.';
    if(!(file.size>0))return 'Plik jest pusty. Wybierz inny film.';
    if(file.size>CV_MAX_BYTES)return 'Film ma '+cvMb(file.size)+' MB, a limit to '+CV_MAX_MB+' MB. Nagraj krótszy fragment (np. jedną serię, 20–40 s) albo wybierz inny plik.';
    return '';
  }
  function cvDuration(url){
    return new Promise(resolve=>{
      try{
        const v=document.createElement('video');let done=false;
        const fin=val=>{if(done)return;done=true;try{v.removeAttribute('src');v.load();}catch(e){}resolve(val);};
        v.preload='metadata';v.muted=true;
        v.onloadedmetadata=()=>fin(Number.isFinite(v.duration)?v.duration:null);
        v.onerror=()=>fin(null);
        setTimeout(()=>fin(null),6000);
        v.src=url;
      }catch(e){resolve(null);}
    });
  }

  /* ---------- Klient: okno wysyłki ---------- */
  function cvContextFromWorkout(){
    const cw=window._cw;if(!cw)return null;
    const ex=(cw.exercises||[])[cw.exIdx]||{};
    return {exName:String(ex.name||'Ćwiczenie').slice(0,120),dayName:String(cw.dayName||'Trening').slice(0,80),date:cw.date||(typeof todayYmd==='function'?todayYmd():''),sessionId:cw.sessionId||''};
  }
  function cvOpen(ctx){
    const c=ctx||cvContextFromWorkout();
    if(!c)return;
    if(window._cw&&window._cw.sheet&&typeof cwSheetClose==='function')cwSheetClose();
    cvRevoke();
    window._cvSend={...c,status:'pick',error:'',file:null,url:'',duration:null,note:'',videoFile:'',uploaded:false,msgSaved:false};
    cvRender();
  }
  function cvRevoke(){const s=window._cvSend;if(s&&s.url){try{URL.revokeObjectURL(s.url);}catch(e){}}}
  function cvClose(){
    const s=window._cvSend;
    if(s&&s.status==='sending')return; // trwa wysyłka — nie przerywamy w połowie
    cvRevoke();window._cvSend=null;
    const r=document.getElementById('cv-root');if(r)r.remove();
  }
  async function cvPicked(input){
    const s=window._cvSend;if(!s)return;
    const file=input&&input.files&&input.files[0];
    if(input)input.value='';
    if(!file)return;
    const err=cvValidate(file);
    if(err){s.status='invalid';s.error=err;s.file=null;cvRender();return;}
    cvRevoke();
    s.file=file;s.url=URL.createObjectURL(file);s.type=cvFileType(file);
    s.status='checking';cvRender();
    const dur=await cvDuration(s.url);
    if(window._cvSend!==s)return;
    s.duration=dur;
    if(dur!=null&&dur>CV_MAX_SEC+0.5){
      s.status='invalid';s.error='Film trwa '+Math.round(dur)+' s, a limit to '+CV_MAX_SEC+' s. Nagraj krótszy fragment — wystarczy jedna seria.';
      cvRevoke();s.url='';s.file=null;cvRender();return;
    }
    s.status='preview';s.error='';cvRender();
  }
  function cvBuildText(s){
    const note=String(s.note||'').trim().slice(0,300);
    return ('🎥 Film techniki: '+s.exName+'\nTrening: '+s.dayName+(s.date?' · '+cvDateLabel(s.date):'')+(note?'\n'+note:'')+'\n[film:'+s.videoFile+']').slice(0,2000);
  }
  /** Wysyłka po potwierdzeniu klienta: 1) plik do prywatnej ścieżki, 2) wiadomość w czacie. Ponowienie nie powtarza udanego kroku. */
  async function cvSend(){
    const s=window._cvSend;if(!s||!s.file||s.status==='sending')return;
    const ta=document.getElementById('cv-note');if(ta)s.note=ta.value;
    if(typeof navigator!=='undefined'&&navigator.onLine===false){s.status='waiting';s.error='';cvRender();return;}
    if(!cvStorageReady()||!window._trainerId||!window._clientId){s.status='error';s.error='Wysyłanie filmów nie jest teraz dostępne. Odśwież aplikację i spróbuj ponownie.';cvRender();return;}
    if(!s.videoFile){
      const rnd=(typeof newId==='function'?newId('v'):'v_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)).replace(/[^A-Za-z0-9_-]/g,'');
      s.videoFile=(rnd.startsWith('v_')?rnd:'v_'+rnd).slice(0,60)+'.'+s.type.ext;
    }
    s.status='sending';s.error='';cvRender();
    try{
      if(!s.uploaded){
        const ref=window._storageRef(window._storage,cvPath(window._trainerId,window._clientId,s.videoFile));
        await window._uploadBytes(ref,s.file,{contentType:s.type.type,customMetadata:{exercise:s.exName.slice(0,100)}});
        s.uploaded=true;
      }
      if(!s.msgSaved){
        const now=new Date();
        const msg=typeof withTrainer==='function'?withTrainer({id:'msg_'+s.videoFile.replace(/\.[a-z0-9]+$/,''),clientId:window._clientId,text:cvBuildText(s),out:false,kind:'direct',
          time:now.toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'}),createdAt:now.toISOString()}):null;
        const saved=msg&&typeof clientConfirmWrite==='function'&&typeof captureClientTenantSession==='function'?await clientConfirmWrite('messages',msg,captureClientTenantSession()):null;
        if(!saved)throw new Error('message-not-confirmed');
        s.msgSaved=true;
        window.MSGS=window.MSGS||{};const arr=window.MSGS[window._clientId]=window.MSGS[window._clientId]||[];
        if(!arr.some(x=>x&&x.id===msg.id))arr.push(msg);
      }
      if(window._cvSend!==s)return;
      s.status='sent';cvRender();
    }catch(e){
      if(window._cvSend!==s)return;
      const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
      s.status=offline?'waiting':'error';
      s.error=offline?'':(String(e&&e.code||'').includes('unauthorized')?'Brak uprawnień do wysłania filmu. Poproś trenera o sprawdzenie połączenia konta z aplikacją.':'Nie udało się wysłać filmu. Sprawdź połączenie i spróbuj ponownie.');
      cvRender();
    }
  }
  function cvRetry(){const s=window._cvSend;if(!s)return;s.status='preview';cvSend();}
  if(typeof window.addEventListener==='function')window.addEventListener('online',()=>{const s=window._cvSend;if(s&&s.status==='waiting')cvSend();});

  function cvRender(){
    const s=window._cvSend;
    let root=document.getElementById('cv-root');
    if(!s){if(root)root.remove();return;}
    if(!root){root=document.createElement('div');root.id='cv-root';document.body.appendChild(root);}
    const who=cvTrainerName();
    const ctx=`<dl class="cv-ctx"><dt>Ćwiczenie</dt><dd data-cv-ex>${esc(s.exName)}</dd><dt>Trening</dt><dd>${esc(s.dayName)}${s.date?' · '+esc(cvDateLabel(s.date)):''}</dd></dl>`;
    const privacy=`<p class="cv-privacy" data-cv-privacy>${ico('lock',16)}<span>Film zobaczy tylko Twój trener: <b>${esc(who)}</b>. Zostanie mu udostępniony w czacie. Możesz go później usunąć.</span></p>`;
    const limits=`<p class="cv-limits">Do ${CV_MAX_SEC} s i ${CV_MAX_MB} MB · MP4, MOV albo WebM.</p>`;
    let body='',foot='';
    if(s.status==='pick'||s.status==='invalid'){
      body=`${ctx}${s.status==='invalid'?`<p class="cv-err" role="alert" data-cv-error>${esc(s.error)}</p>`:''}${privacy}${limits}
        <label class="cs-btn cs-btn-primary cv-pick"><input type="file" accept="video/*" capture="environment" data-cv-capture onchange="cvPicked(this)" hidden>${ico('camera',20)}Nagraj film</label>
        <label class="cs-btn cs-btn-secondary cv-pick"><input type="file" accept="video/mp4,video/quicktime,video/webm,video/*" data-cv-file onchange="cvPicked(this)" hidden>${s.status==='invalid'?'Wybierz inny film':'Wybierz film z telefonu'}</label>
        <p class="cv-hint">„Nagraj film” otwiera aparat, jeśli telefon na to pozwala — inaczej wybierzesz plik.</p>`;
    }else if(s.status==='checking'){
      body=`${ctx}<p class="cv-state" role="status">Sprawdzam film…</p>`;
    }else if(s.status==='preview'){
      body=`<video class="cv-preview" src="${esc(s.url)}" controls playsinline preload="metadata" aria-label="Podgląd filmu"></video>
        <p class="cv-meta">${s.duration!=null?Math.round(s.duration)+' s · ':''}${esc(cvMb(s.file.size))} MB</p>
        ${ctx}
        <label class="cv-note"><span>Wiadomość do trenera <em>opcjonalnie</em></span><textarea id="cv-note" rows="2" maxlength="300" placeholder="Np. czy kolana idą dobrze?">${esc(s.note||'')}</textarea></label>
        ${privacy}`;
      foot=`<button type="button" class="cs-btn cs-btn-primary" data-cv-send onclick="cvSend()">Wyślij film trenerowi</button>
        <button type="button" class="cs-link cv-again" onclick="cvOpen(window._cvSend)">Wybierz inny film</button>`;
    }else if(s.status==='sending'){
      body=`${ctx}<p class="cv-state is-busy" role="status" data-cv-status="sending">Wysyłanie filmu… Nie zamykaj aplikacji.</p>`;
    }else if(s.status==='waiting'){
      body=`${ctx}<p class="cv-state is-local" role="status" data-cv-status="waiting">Oczekuje na połączenie. Wyślemy film, gdy wróci internet — nie zamykaj aplikacji.</p>`;
      foot=`<button type="button" class="cs-btn cs-btn-secondary" onclick="cvRetry()">Spróbuj teraz</button><button type="button" class="cs-link cv-again" onclick="cvClose()">Anuluj wysyłkę</button>`;
    }else if(s.status==='error'){
      body=`${ctx}<p class="cv-state is-error" role="alert" data-cv-status="error">${esc(s.error)}</p>`;
      foot=`<button type="button" class="cs-btn cs-btn-primary" data-cv-retry onclick="cvRetry()">Spróbuj ponownie</button><button type="button" class="cs-link cv-again" onclick="cvClose()">Anuluj</button>`;
    }else if(s.status==='sent'){
      body=`${ctx}<p class="cv-state is-ok" role="status" data-cv-status="sent">Wysłano. Trener zobaczy film w czacie i tam Ci odpowie.</p>
        <p class="cv-hint">Trener zobaczy film w aplikacji. Powiadomienie na telefon dostanie tylko wtedy, gdy włączył je u siebie — tego nie widzimy z Twojej strony.</p>`;
      foot=`<button type="button" class="cs-btn cs-btn-primary" onclick="cvClose()">Gotowe</button>`;
    }
    root.innerHTML=`<div class="cs-sheet-wrap cv-wrap" data-cv-sheet="${esc(s.status)}">
      <div class="cs-sheet-backdrop" onclick="cvClose()"></div>
      <section class="cs-sheet cv-sheet" role="dialog" aria-modal="true" aria-labelledby="cv-title">
        <div class="cs-sheet-head"><h2 id="cv-title">Film techniki dla trenera</h2>${s.status==='sending'?'':`<button type="button" class="cs-sheet-x" aria-label="Zamknij" onclick="cvClose()">${ico('close',20)}</button>`}</div>
        ${body}${foot}
      </section></div>`;
  }

  /* ---------- Karta filmu w czacie (klient i trener) ---------- */
  window._cvDeleted=window._cvDeleted||{};
  window._cvUrls=window._cvUrls||{};
  function cvChatCardHTML(m,opt){
    const file=cvFileFromText(m&&m.text);if(!file)return '';
    const o=opt||{};
    const trainerId=o.viewer==='trainer'?window._uid:window._trainerId;
    const clientId=o.viewer==='trainer'?o.clientId:window._clientId;
    if(!trainerId||!clientId)return '';
    const key=clientId+'/'+file;
    if(window._cvDeleted[key])return `<div class="cv-card is-deleted" data-cv-card="${esc(file)}">🎥 Film został usunięty.</div>`;
    const canDelete=o.viewer==='trainer'||!m.out;
    return `<div class="cv-card" data-cv-card="${esc(file)}" data-cv-cid="${esc(clientId)}">
      <div class="cv-card-row"><span class="cv-card-ico" aria-hidden="true">🎥</span><b>Film techniki</b>
        <button type="button" class="cv-btn" data-act="cv-play" data-act-stop-prop data-file="${esc(file)}" data-cid="${esc(clientId)}" data-tid="${esc(trainerId)}">Odtwórz</button>
        ${canDelete?`<button type="button" class="cv-btn cv-del" data-act="cv-del" data-act-stop-prop data-file="${esc(file)}" data-cid="${esc(clientId)}" data-tid="${esc(trainerId)}">Usuń film</button>`:''}</div>
      <div class="cv-player" data-cv-player></div></div>`;
  }
  /** Karta, w której kliknięto (ten sam film może być w kilku widokach naraz). */
  function cardEl(file,cid,el){
    const own=el&&el.closest&&el.closest('[data-cv-card]');
    if(own&&own.getAttribute('data-cv-card')===file)return own;
    return [...document.querySelectorAll('[data-cv-card]')].find(x=>x.getAttribute('data-cv-card')===file&&(!cid||x.getAttribute('data-cv-cid')===cid));
  }
  async function cvPlay(d,el){
    const card=cardEl(d.file,d.cid,el);if(!card)return;
    const box=card.querySelector('[data-cv-player]');if(!box)return;
    const key=d.cid+'/'+d.file;
    if(window._cvUrls[key]){box.innerHTML=`<video controls playsinline autoplay src="${esc(window._cvUrls[key])}" aria-label="Film techniki"></video>`;return;}
    if(!cvStorageReady()){box.innerHTML='<p class="cv-err">Odtwarzanie nie jest teraz dostępne. Odśwież aplikację.</p>';return;}
    box.innerHTML='<p class="cv-state" role="status">Wczytuję film…</p>';
    try{
      const blob=await window._getBlob(window._storageRef(window._storage,cvPath(d.tid,d.cid,d.file)));
      const url=URL.createObjectURL(blob);
      window._cvUrls[key]=url;
      box.innerHTML=`<video controls playsinline src="${esc(url)}" aria-label="Film techniki"></video>`;
    }catch(e){
      const code=String(e&&e.code||'');
      if(code.includes('object-not-found')){window._cvDeleted[key]=true;card.outerHTML=`<div class="cv-card is-deleted" data-cv-card="${esc(d.file)}">🎥 Film został usunięty.</div>`;return;}
      box.innerHTML=`<p class="cv-err" role="alert">${code.includes('unauthorized')?'Brak dostępu do tego filmu.':'Nie udało się wczytać filmu. Sprawdź połączenie.'}</p>`;
    }
  }
  async function cvDelete(d,el){
    const card=cardEl(d.file,d.cid,el);if(!card)return;
    if(!card.classList.contains('is-confirm')){
      card.classList.add('is-confirm');
      card.insertAdjacentHTML('beforeend',`<div class="cv-confirm" data-cv-confirm><span>Usunąć ten film? Nie da się go przywrócić.</span>
        <button type="button" class="cv-btn cv-del" data-act="cv-del" data-act-stop-prop data-file="${esc(d.file)}" data-cid="${esc(d.cid)}" data-tid="${esc(d.tid)}" data-sure="1">Tak, usuń</button>
        <button type="button" class="cv-btn" data-act="cv-del-cancel" data-act-stop-prop data-file="${esc(d.file)}" data-cid="${esc(d.cid)}">Anuluj</button></div>`);
      return;
    }
    if(d.sure!=='1')return;
    try{
      await window._deleteObject(window._storageRef(window._storage,cvPath(d.tid,d.cid,d.file)));
    }catch(e){
      if(!String(e&&e.code||'').includes('object-not-found')){
        const c=card.querySelector('[data-cv-confirm]');if(c)c.innerHTML='<span class="cv-err" role="alert">Nie udało się usunąć filmu. Sprawdź połączenie i spróbuj ponownie.</span>';
        card.classList.remove('is-confirm');return;
      }
    }
    const key=d.cid+'/'+d.file;
    window._cvDeleted[key]=true;
    if(window._cvUrls[key]){try{URL.revokeObjectURL(window._cvUrls[key]);}catch(e){}delete window._cvUrls[key];}
    card.outerHTML=`<div class="cv-card is-deleted" data-cv-card="${esc(d.file)}">🎥 Film został usunięty.</div>`;
    if(typeof notify==='function')notify('Film usunięty');
  }
  if(typeof uiAction==='function'){
    uiAction('cv-play',(d,el)=>{cvPlay(d,el);});
    uiAction('cv-del',(d,el)=>{cvDelete(d,el);});
    uiAction('cv-del-cancel',(d,el)=>{const card=cardEl(d.file,d.cid,el);if(!card)return;card.classList.remove('is-confirm');const c=card.querySelector('[data-cv-confirm]');if(c)c.remove();});
  }
  Object.assign(window,{CV_MAX_BYTES,CV_MAX_SEC,CV_MAX_MB,cvStripTag,cvFileFromText,cvValidate,cvFileType,cvOpen,cvClose,cvPicked,cvSend,cvRetry,cvRender,cvChatCardHTML,cvPlay,cvDelete,cvPath,cvStorageReady});
})();
