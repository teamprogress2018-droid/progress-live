/**
 * Progress Live 3.0 — Etap 4b: Progress AI dla klienta.
 *
 * - Trener włącza je dla konkretnego klienta (profil klienta → Plan → karta `#pai-card`): `client.aiCoach={on,limit,updatedAt}`.
 *   Domyślnie wyłączone. Limit pytań na dobę: 5 / 10 / 20 / 30 (domyślnie 10). Klient nie może zmienić tego pola (firestore.rules).
 * - Klient: zakładka „Trener” → karta „Progress AI” → okno `#pai-sheet` (czat, szybkie pytania, licznik pozostałych pytań).
 * - Zapytanie idzie do pośrednika AI na ścieżkę `/client` (server/ai-proxy/worker.mjs): klient wysyła TYLKO pytanie,
 *   ostatnie 6 wiadomości i podsumowanie treningów (`paiContext`). Prompt, model i limit tokenów ustala serwer.
 * - Dane o zdrowiu (kontuzje) trafiają do kontekstu tylko przy zgodzie klienta na dane o zdrowiu (`consents.health.granted`).
 * - Rozmowa jest tylko w pamięci (znika po zamknięciu aplikacji) — nic nie zapisujemy w Firestore ani w telefonie.
 */
(function(){
  'use strict';
  const esc=s=>typeof csEsc==='function'?csEsc(s):(typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const LIMITS=[5,10,20,30];
  const QUICK=['Jak dobrze wykonać dzisiejsze ćwiczenia?','Nie mam dziś siły — co zrobić?','Jak się regenerować po treningu?'];
  const PAI={msgs:[],busy:false,remaining:null,limit:null,error:''};

  function paiCfg(c){const a=c&&c.aiCoach;const limit=LIMITS.includes(Number(a&&a.limit))?Number(a.limit):10;return {on:!!(a&&a.on===true),limit};}
  function proxyUrl(){try{if(typeof W==='string'&&W)return W;}catch(e){}return 'https://anthropic-proxy.teamprogress2018.workers.dev/';}

  /* ---------- kontekst: tylko dane treningowe tego klienta ---------- */
  function exLine(raw){
    const p=typeof parsePlanExercise==='function'?parsePlanExercise(raw):(raw||{});
    const o={name:String(p.name||raw&&raw.name||'').slice(0,80)};
    ['sets','reps','kg','rest','rir','tempo'].forEach(k=>{const v=p[k]!=null?p[k]:raw&&raw[k];if(v!=null&&String(v).trim()!=='')o[k]=String(v).slice(0,20);});
    if(p.notes||raw&&raw.notes)o.note=String(p.notes||raw.notes).slice(0,120);
    return o;
  }
  function paiContext(c){
    if(!c)return {};
    const ctx={profile:{},week:{},today:null,recent:[]};
    ['goal','level','trainingFreq'].forEach(k=>{if(c[k])ctx.profile[k]=String(c[k]).slice(0,120);});
    if(c.goalDesc)ctx.profile.goalDesc=String(c.goalDesc).slice(0,200);
    const health=!!(c.consents&&c.consents.health&&c.consents.health.granted===true);
    if(health&&c.injuries)ctx.profile.injuries=String(c.injuries).slice(0,300);
    let slot={kind:'noplan'};
    try{slot=typeof capTodaySlot==='function'?capTodaySlot(c):slot;}catch(e){}
    const plan=slot&&slot.plan;
    if(plan)ctx.plan={name:String(plan.name||'').slice(0,80),days:(plan.days||[]).filter(d=>d&&!d.rest&&(d.exercises||[]).length).length};
    if(slot&&slot.day){
      const t=typeof csDayTitle==='function'?csDayTitle(slot.day,slot.dayIdx):{title:slot.day.day||''};
      ctx.today={status:slot.kind,title:String(t.title||'').slice(0,80),exercises:(slot.day.exercises||[]).slice(0,12).map(exLine)};
    }else ctx.today={status:slot&&slot.kind||'noplan'};
    try{
      ctx.week={done:typeof csWeekDone==='function'?csWeekDone(c):null,target:typeof csWeekTarget==='function'?csWeekTarget(c,plan):null};
      const done=(typeof csDoneSessions==='function'?csDoneSessions(c):[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
      ctx.recent=done.map(s=>{const o={date:String(s.date).slice(0,10),title:String(s.dayName||s.name||s.type||'').slice(0,60),exercises:(s.exercises||[]).length};
        if(s.feedback!=null)o.feeling=s.feedback;if(s.difficulty!=null)o.difficulty=s.difficulty;return o;});
    }catch(e){}
    // Limit serwera to 6000 znaków JSON — przycinamy od najmniej ważnych danych.
    const size=()=>JSON.stringify(ctx).length;
    while(size()>5500&&ctx.recent.length)ctx.recent.pop();
    while(size()>5500&&ctx.today&&ctx.today.exercises&&ctx.today.exercises.length)ctx.today.exercises.pop();
    return ctx;
  }

  /* ---------- zakładka „Trener” ---------- */
  function paiHubHTML(c){
    if(!c||!paiCfg(c).on)return '';
    return `<section class="cs-card pai-hub" data-pai-hub aria-labelledby="pai-hub-h">
      <div class="cs-eyebrow" id="pai-hub-h">PROGRESS AI</div>
      <p class="cs-card-text">Zapytaj o technikę, regenerację albo swój plan. W sprawach bólu i zmian w planie pisz do trenera.</p>
      <button type="button" class="cs-btn cs-btn-secondary" data-pai-open onclick="paiOpen()">Zapytaj Progress AI</button>
    </section>`;
  }
  const baseHub=window.csTrainerHubHTML;
  if(typeof baseHub==='function'&&!baseHub._pai){
    const wrapped=function(c){const html=baseHub.apply(this,arguments);const card=paiHubHTML(c);if(!card)return html;
      const i=html.indexOf('<ul class="cs-rows cs-hub-rows"');return i<0?html+card:html.slice(0,i)+card+html.slice(i);};
    wrapped._pai=true;window.csTrainerHubHTML=wrapped;
  }

  /* ---------- okno rozmowy ---------- */
  function textHTML(t){return String(t||'').split(/\n+/).map(p=>p.trim()).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');}
  function paiSheetHTML(c){
    const cfg=paiCfg(c);
    const left=PAI.remaining!=null?`Zostało ${PAI.remaining} z ${PAI.limit||cfg.limit} pytań dziś`:`Możesz zadać ${cfg.limit} pytań dziennie`;
    const list=PAI.msgs.map((m,i)=>m.role==='user'
      ?`<li class="pai-msg is-user"><span class="sr-only">Ty: </span>${textHTML(m.text)}</li>`
      :`<li class="pai-msg is-ai"><span class="sr-only">Progress AI: </span>${textHTML(m.text)}${i===PAI.msgs.length-1?`<button type="button" class="pai-trainer" data-pai-trainer onclick="paiToTrainer()">Napisz do trenera</button>`:''}</li>`).join('');
    return `<div class="pv-gate pai-sheet" id="pai-sheet" role="dialog" aria-modal="true" aria-labelledby="pai-h">
      <div class="pv-gate-card">
        <div class="pai-top"><span class="pw-brand">PROGRESS AI</span><button type="button" class="pai-x" aria-label="Zamknij" onclick="paiClose()">×</button></div>
        <h2 id="pai-h" tabindex="-1">Zapytaj o swój trening</h2>
        <p class="pai-note">Odpowiada asystent AI — może się pomylić i nie zastępuje trenera ani lekarza. Przy bólu przerwij ćwiczenie i napisz do trenera.</p>
        ${list?`<ol class="pai-list" aria-live="polite">${list}</ol>`:`<div class="pai-quick" data-pai-quick>${QUICK.map((q,i)=>`<button type="button" class="xp-opt pai-q" data-pai-q="${i}" onclick="paiAskQuick(${i})">${esc(q)}</button>`).join('')}</div>`}
        ${PAI.busy?`<p class="pai-busy" role="status">Progress AI pisze odpowiedź…</p>`:''}
        ${PAI.error?`<p class="wu-err" role="alert">${esc(PAI.error)}</p>`:''}
        <form class="pai-form" onsubmit="event.preventDefault();paiAsk()">
          <label for="pai-in" class="sr-only">Twoje pytanie</label>
          <textarea id="pai-in" rows="2" maxlength="500" placeholder="Np. czy mogę ćwiczyć po słabo przespanej nocy?"${PAI.busy||PAI.remaining===0?' disabled':''}></textarea>
          <button type="submit" class="cs-btn cs-btn-primary" data-pai-send${PAI.busy||PAI.remaining===0?' disabled':''}>Zapytaj</button>
        </form>
        <p class="pai-left" data-pai-left>${esc(left)}</p>
        <p class="pai-note">Pytanie i podsumowanie Twoich treningów trafiają do dostawcy AI (Anthropic) zgodnie z polityką prywatności. Rozmowa nie jest zapisywana.</p>
      </div>
    </div>`;
  }
  function paiRender(focusInput){
    const c=clientById(window._clientId);const el=document.getElementById('pai-sheet');if(!el||!c)return;
    const typed=(document.getElementById('pai-in')||{}).value||'';
    el.outerHTML=paiSheetHTML(c);
    const nel=document.getElementById('pai-sheet');bindSheet(nel);
    const inp=document.getElementById('pai-in');if(inp&&!PAI.busy)inp.value=typed;
    const list=nel.querySelector('.pai-list');if(list)list.scrollTop=list.scrollHeight;
    if(focusInput&&inp&&!inp.disabled)try{inp.focus();}catch(e){}
  }
  function bindSheet(el){if(el)el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();paiClose();}});}
  function paiOpen(){
    const c=clientById(window._clientId);if(!c||!paiCfg(c).on)return;
    window._paiOpener=document.activeElement;
    const old=document.getElementById('pai-sheet');if(old)old.remove();
    document.body.insertAdjacentHTML('beforeend',paiSheetHTML(c));
    const el=document.getElementById('pai-sheet');bindSheet(el);
    const h=el.querySelector('h2');if(h)try{h.focus();}catch(e){}
  }
  function paiClose(){const el=document.getElementById('pai-sheet');if(el)el.remove();const o=window._paiOpener;window._paiOpener=null;if(o&&o.focus&&document.body.contains(o))try{o.focus();}catch(e){}}
  function paiToTrainer(){paiClose();if(typeof setClientLiveScreen==='function')setClientLiveScreen('messages');}
  function paiAskQuick(i){const inp=document.getElementById('pai-in');if(inp)inp.value=QUICK[i]||'';paiAsk();}

  async function paiAsk(){
    const c=clientById(window._clientId);if(!c||PAI.busy)return;
    const inp=document.getElementById('pai-in');
    const q=String(inp&&inp.value||'').trim();
    if(!q){PAI.error='Wpisz pytanie.';paiRender(true);return;}
    if(q.length>500){PAI.error='Pytanie jest za długie (maks. 500 znaków).';paiRender(true);return;}
    const history=PAI.msgs.slice(-6);
    PAI.msgs.push({role:'user',text:q});PAI.busy=true;PAI.error='';
    if(inp)inp.value='';
    paiRender();
    let res=null,data=null;
    try{
      res=await fetch(proxyUrl()+'client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,history,context:paiContext(c)})});
      data=await res.json().catch(()=>null);
    }catch(e){res=null;}
    PAI.busy=false;
    if(res&&res.ok&&data&&typeof data.text==='string'){
      PAI.msgs.push({role:'assistant',text:data.text});
      if(data.remaining!=null)PAI.remaining=Number(data.remaining);if(data.limit!=null)PAI.limit=Number(data.limit);
    }else{
      PAI.msgs.pop(); // pytanie bez odpowiedzi wraca do pola, żeby można było je wysłać ponownie
      const t=data&&data.error&&data.error.type;
      if(res&&res.status===429){PAI.remaining=0;PAI.error=(data&&data.error&&data.error.message)||'Dzisiejszy limit pytań jest wykorzystany.';}
      else if(t==='disabled')PAI.error='Trener wyłączył Progress AI.';
      else if(!res)PAI.error='Brak połączenia z internetem. Spróbuj ponownie.';
      else PAI.error=(data&&data.error&&data.error.message)||'Progress AI nie odpowiedziało. Spróbuj za chwilę.';
      paiRender();const again=document.getElementById('pai-in');if(again&&!again.disabled)again.value=q;
      return;
    }
    paiRender(true);
  }

  /* ---------- karta trenera (profil klienta → Plan) ---------- */
  function paiState(c){const st=window._paiEdit;return st&&c&&st.clientId===c.id?st:null;}
  function paiTrainerCardHTML(c){
    const cfg=paiCfg(c);const st=paiState(c);
    if(!st){
      return `<section class="wu-card pai-card" id="pai-card" aria-labelledby="pai-t">
        <div class="wu-head"><h3 id="pai-t" class="cp-section-title" style="margin:0;">PROGRESS AI DLA KLIENTA</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="pai-edit" data-cid="${esc(c.id)}">${cfg.on?'Zmień':'Ustaw'}</button></div>
        <p class="wu-sub">${cfg.on?`Włączone · do ${cfg.limit} pytań dziennie. Klient pyta w zakładce „Trener”.`:'Wyłączone. Klient nie widzi Progress AI.'}</p>
      </section>`;
    }
    return `<section class="wu-card pai-card is-editing" id="pai-card" aria-labelledby="pai-t">
      <div class="wu-head"><h3 id="pai-t" class="cp-section-title" style="margin:0;">PROGRESS AI — USTALENIE TRENERA</h3></div>
      <label class="xp-on"><input type="checkbox" data-pai-field="on" ${st.cfg.on?'checked':''}> <span><b>Pozwól klientowi pytać Progress AI</b><br><span class="wu-sub">Asystent odpowiada o technice, regeneracji, motywacji i planie klienta. Nie zmienia planu, nie diagnozuje, przy bólu odsyła do Ciebie. Każde pytanie to płatne zapytanie do API Anthropic (Twój klucz w pośredniku AI).</span></span></label>
      <label class="xp-sel"><span>Pytań dziennie</span><select data-pai-field="limit">${LIMITS.map(n=>`<option value="${n}"${st.cfg.limit===n?' selected':''}>${n}</option>`).join('')}</select></label>
      ${st.error?`<p class="wu-err" role="alert">${esc(st.error)}</p>`:''}
      <div class="wu-actions"><button type="button" class="btn btn-ghost" data-act="pai-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="pai-save"${st.saving?' disabled':''}>${st.saving?'Zapisuję…':'Zapisz'}</button></div>
    </section>`;
  }
  function paiTrainerRender(c){
    const host=document.getElementById('pai-card');
    if(host)host.outerHTML=paiTrainerCardHTML(c);
    else{
      const anchor=document.getElementById('ac-card')||document.getElementById('pw-card')||document.getElementById('pj-card')||document.getElementById('xp-card')||document.getElementById('wu-card');
      if(anchor)anchor.insertAdjacentHTML('afterend',paiTrainerCardHTML(c));
      else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',paiTrainerCardHTML(c));}
    }
    document.querySelectorAll('#pai-card [data-pai-field]').forEach(el=>{el.onchange=()=>{const st=paiState(c);if(!st)return;
      if(el.dataset.paiField==='on')st.cfg.on=!!el.checked;else st.cfg.limit=Number(el.value)||10;};});
  }
  const cur=()=>clientById(window._paiEdit&&window._paiEdit.clientId);
  async function paiSave(){
    const st=window._paiEdit;const c=cur();if(!st||!c||st.saving)return;
    const prev=c.aiCoach;
    c.aiCoach={on:!!st.cfg.on,limit:LIMITS.includes(st.cfg.limit)?st.cfg.limit:10,updatedAt:new Date().toISOString()};
    st.saving=true;st.error='';paiTrainerRender(c);
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.aiCoach=prev;st.saving=false;st.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';paiTrainerRender(c);return;}
    window._paiEdit=null;paiTrainerRender(c);
    if(typeof notify==='function')notify(c.aiCoach.on?'Progress AI włączone dla klienta':'Progress AI wyłączone dla klienta');
  }
  if(typeof uiAction==='function'){
    uiAction('pai-edit',d=>{const c=clientById(d.cid);if(!c)return;window._paiEdit={clientId:c.id,cfg:paiCfg(c)};paiTrainerRender(c);});
    uiAction('pai-cancel',()=>{const c=cur();window._paiEdit=null;if(c)paiTrainerRender(c);});
    uiAction('pai-save',()=>{paiSave();});
  }
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._pai){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)paiTrainerRender(c);}catch(e){}return r;};
    wrapped._pai=true;wrapped._ac=orig._ac;wrapped._pw=orig._pw;wrapped._pj=orig._pj;wrapped._xp=orig._xp;wrapped._wu=orig._wu;
    window.renderCPPlan=wrapped;
  }

  Object.assign(window,{PAI,PAI_QUICK:QUICK,paiCfg,paiContext,paiHubHTML,paiSheetHTML,paiOpen,paiClose,paiAsk,paiAskQuick,paiToTrainer,paiTrainerCardHTML,paiSave});
})();
