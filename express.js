/* Progress Express (3.0, etap 2): krótsze warianty treningu, ZATWIERDZONE przez trenera.
 *
 * Trener (profil klienta → Plan, karta pod rozgrzewką): włącza „Krótsze treningi” i ustala regułę wariantów:
 *   Skrócony (~30 min) = pierwsze N ćwiczeń dnia (domyślnie 4), serie: wszystkie albo maks. K;
 *   Express  (~15 min) = pierwsze N ćwiczeń (domyślnie 2), maks. K serii (domyślnie 2).
 *   Kolejność ćwiczeń w planie = priorytet (najważniejsze na początku dnia); super-serii nie rozcinamy.
 *   Podgląd pokazuje każdy dzień aktywnego planu: ćwiczenia w wariancie i szacowany czas.
 * Klient („Dzisiaj”, tylko gdy trener włączył): „Mniej czasu? Wybierz krótszy trening” → 3 duże przyciski
 *   (pełny / skrócony / express z czasem i liczbą ćwiczeń) → start od razu (2 dotknięcia od „Dzisiaj”). Rozgrzewka zostaje.
 * Zapis: client.express = {on, short:{ex,sets}, express:{ex,sets}, updatedAt} (karta klienta, jak rozgrzewka — bez zmian reguł);
 *   w treningu planSnapshot.variant = {kind, label, estMin, kept, omitted:[nazwy], setsCap} — trener widzi go w oknie
 *   treningu i w wiadomości „Zrobiłem trening…”. System nie usuwa niczego poza regułą ustaloną przez trenera.
 */
(function(){
  'use strict';
  const XP_DEF={on:false,short:{ex:4,sets:0},express:{ex:2,sets:2}};
  const XP_KINDS={
    full:{label:'Pełny trening',short:'pełny'},
    short:{label:'Trening skrócony',short:'skrócony',target:30},
    express:{label:'Progress Express',short:'Express',target:15}
  };
  const esc=s=>typeof escHtml==='function'?escHtml(s):(typeof csEsc==='function'?csEsc(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const clampInt=(v,lo,hi,d)=>{const n=parseInt(v,10);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):d;};

  /** Konfiguracja z karty klienta (bezpieczne granice). */
  function xpCfg(c){
    const x=c&&c.express||{};
    return {
      on:!!x.on,
      short:{ex:clampInt(x.short&&x.short.ex,1,8,XP_DEF.short.ex),sets:clampInt(x.short&&x.short.sets,0,6,XP_DEF.short.sets)},
      express:{ex:clampInt(x.express&&x.express.ex,1,6,XP_DEF.express.ex),sets:clampInt(x.express&&x.express.sets,1,6,XP_DEF.express.sets)}
    };
  }
  /** Ile pierwszych pozycji wziąć, żeby nie rozciąć super-serii (pole ss). */
  function xpCount(list,n){
    let k=Math.min(n,list.length);
    while(k>0&&k<list.length){
      const a=String((list[k-1]||{}).ss||''),b=String((list[k]||{}).ss||'');
      if(a&&a===b)k++;else break;
    }
    return k;
  }
  /* --- czas (ta sama zasada co csDurationMin: seria 40 s + przerwa; start: pełny 8 min, krótsze 4 min) --- */
  function xpRawSets(raw){const p=typeof parsePlanExercise==='function'?parsePlanExercise(raw):(raw||{});return {name:p.name||raw&&raw.name||'',sets:parseInt(p.sets,10)||3,rest:(typeof parseRestSeconds==='function'?parseRestSeconds(p.rest):0)||90,ss:p.ss||raw&&raw.ss||''};}
  function xpEstMin(items,base){
    let sec=base;
    items.forEach(i=>{sec+=i.sets*(40+i.rest);});
    return Math.max(5,Math.round(sec/60/5)*5);
  }
  /** Wariant dla dnia planu (podgląd i wybór): {kind,label,estMin,items:[{name,sets}],omitted:[nazwy],setsCap}. */
  function xpVariantForDay(day,c,kind){
    const raw=((day&&day.exercises)||[]).map(xpRawSets).filter(i=>i.name);
    const cfg=xpCfg(c);
    if(kind==='full'||!XP_KINDS[kind]||kind==='full'){
      return {kind:'full',label:XP_KINDS.full.label,estMin:typeof csDurationMin==='function'?csDurationMin(day):xpEstMin(raw,480),items:raw.map(i=>({name:i.name,sets:i.sets})),omitted:[],setsCap:0};
    }
    const r=cfg[kind];
    const k=xpCount(raw,r.ex);
    const kept=raw.slice(0,k).map(i=>({...i,sets:r.sets?Math.min(i.sets,r.sets):i.sets}));
    return {kind,label:XP_KINDS[kind].label,estMin:xpEstMin(kept,240),items:kept.map(i=>({name:i.name,sets:i.sets})),omitted:raw.slice(k).map(i=>i.name),setsCap:r.sets||0};
  }
  /** Czy krótszy wariant w ogóle coś skraca (inaczej nie ma sensu go pokazywać). */
  function xpUseful(v,full){return v.omitted.length>0||v.items.some((i,ix)=>full.items[ix]&&i.sets<full.items[ix].sets);}

  /* ---------- Klient: zastosowanie wariantu do treningu (przed pierwszym zapisem sesji) ---------- */
  function xpApply(cw,c,kind){
    if(!cw||cw.began||cw.variant||!XP_KINDS[kind]||kind==='full')return false;
    const cfg=xpCfg(c);if(!cfg.on)return false;
    const r=cfg[kind];
    const list=cw.exercises||[];
    const k=xpCount(list,r.ex);
    const omitted=list.slice(k).map(e=>e.name||'');
    const kept=list.slice(0,k).map(e=>{
      if(!r.sets)return e;
      const sets=e.sets||[];
      const warm=sets.filter(s=>s.kind==='warmup');
      const work=sets.filter(s=>s.kind!=='warmup').slice(0,r.sets);
      return {...e,sets:warm.concat(work)};
    });
    cw.exercises=kept;
    if(typeof cwPlanSnapshot==='function')cw.planSnapshot=cwPlanSnapshot(kept);
    cw.exIdx=0;
    const est=xpEstMin(kept.map(e=>({sets:(e.sets||[]).filter(s=>s.kind!=='warmup').length||1,rest:Number(e.restSec)||90})),240);
    cw.variant={kind,label:XP_KINDS[kind].label,estMin:est,kept:kept.length,omitted,setsCap:r.sets||0};
    return true;
  }
  /** Wołane z cwStartFlow (nowy trening): wariant wybrany na „Dzisiaj”. */
  function xpApplyPending(cw){
    const p=window._xpPending;window._xpPending=null;
    if(!p||!cw||p.planId!==cw.planId||Number(p.dayIdx)!==Number(cw.dayIdx))return false;
    return xpApply(cw,clientById(window._clientId),p.kind);
  }
  function xpSummary(v){
    if(!v||!XP_KINDS[v.kind]||v.kind==='full')return '';
    const parts=[v.label+(v.estMin?' (ok. '+v.estMin+' min)':'')];
    if(v.setsCap)parts.push('maks. '+v.setsCap+' '+(v.setsCap===1?'seria':v.setsCap<5?'serie':'serii')+' na ćwiczenie');
    if(v.omitted&&v.omitted.length)parts.push('pominięte zgodnie z ustaleniem trenera: '+v.omitted.join(', '));
    return parts.join(' · ');
  }

  /* ---------- Klient: „Dzisiaj” ---------- */
  function xpTodayHTML(c,st){
    if(!c||!st||st.inProgress)return '';
    const slot=st.slot||{};
    if(slot.kind!=='workout'||!slot.plan)return '';
    const cfg=xpCfg(c);if(!cfg.on)return '';
    const day=(slot.plan.days||[])[slot.dayIdx];if(!day)return '';
    const full=xpVariantForDay(day,c,'full');
    if(!['short','express'].some(k=>xpUseful(xpVariantForDay(day,c,k),full)))return '';
    return `<button type="button" class="cs-ready-link xp-link" data-xp-open onclick="xpOpen()"><span class="cs-ready-link-t">Mniej czasu?</span><span class="cs-ready-link-s">Wybierz krótszy trening przygotowany przez trenera</span></button>`;
  }
  function xpOpen(){
    const c=clientById(window._clientId);
    const st=c&&typeof csTodayState==='function'?csTodayState(c):null;
    const slot=st&&st.slot||{};
    if(!slot.plan)return;
    const day=(slot.plan.days||[])[slot.dayIdx];
    const full=xpVariantForDay(day,c,'full');
    const opts=['full','short','express'].map(k=>xpVariantForDay(day,c,k)).filter(v=>v.kind==='full'||xpUseful(v,full));
    const ex=n=>n+' '+(n===1?'ćwiczenie':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'ćwiczenia':'ćwiczeń');
    window._xpOpener=document.activeElement;
    const old=document.getElementById('xp-sheet');if(old)old.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="pv-gate xp-sheet" id="xp-sheet" role="dialog" aria-modal="true" aria-labelledby="xp-h">
      <div class="pv-gate-card">
        <h2 id="xp-h">Ile masz dziś czasu?</h2>
        <p class="cs-ready-hint">Krótsze wersje ustalił Twój trener. Najważniejsze ćwiczenia zostają.</p>
        <div class="xp-opts">${opts.map(v=>`<button type="button" class="xp-opt${v.kind==='full'?' is-full':''}" data-xp-kind="${v.kind}" onclick="xpStart('${v.kind}')">
          <span class="xp-opt-t">${esc(v.label)} <b>· ok. ${v.estMin} min</b></span>
          <span class="xp-opt-s">${ex(v.items.length)}${v.setsCap?' · maks. '+v.setsCap+' '+(v.setsCap===1?'seria':v.setsCap<5?'serie':'serii'):''}: ${esc(v.items.map(i=>i.name).join(', '))}</span>
        </button>`).join('')}</div>
        <button type="button" class="cs-btn cs-btn-ghost" onclick="xpClose()">Anuluj</button>
      </div></div>`);
    const el=document.getElementById('xp-sheet');
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();xpClose();}});
    const first=el.querySelector('.xp-opt');if(first)first.focus();
  }
  function xpClose(){
    const el=document.getElementById('xp-sheet');if(el)el.remove();
    const o=window._xpOpener;window._xpOpener=null;if(o&&document.contains(o)&&o.focus)o.focus();
  }
  function xpStart(kind){
    const c=clientById(window._clientId);
    const st=c&&typeof csTodayState==='function'?csTodayState(c):null;
    const slot=st&&st.slot||{};
    xpClose();
    if(!slot.plan)return;
    window._xpPending=kind==='full'?null:{planId:slot.plan.id,dayIdx:slot.dayIdx,kind};
    if(typeof csStart==='function')csStart(slot.plan.id,slot.dayIdx);
    window._xpPending=null;
  }

  /* ---------- Trener: karta w profilu klienta → Plan ---------- */
  function xpClientPlan(c){
    const list=(window.PL||[]).filter(p=>p&&p.clientId===c.id&&!p.archived&&(p.days||[]).some(d=>d&&!d.rest&&(d.exercises||[]).length));
    return list.sort((a,b)=>String(b.startDate||b.createdAt||'').localeCompare(String(a.startDate||a.createdAt||'')))[0]||null;
  }
  function xpState(c){const st=window._xpEdit;return st&&st.clientId===c.id?st:null;}
  function xpSel(name,val,opts,label){
    return `<label class="xp-sel"><span>${label}</span><select class="form-input" data-xp-field="${name}">${opts.map(([v,t])=>`<option value="${v}"${String(v)===String(val)?' selected':''}>${t}</option>`).join('')}</select></label>`;
  }
  function xpPreviewHTML(c,cfgOverride){
    const plan=xpClientPlan(c);
    if(!plan)return '<p class="wu-sub">Klient nie ma jeszcze planu z ćwiczeniami — podgląd pojawi się po ułożeniu planu.</p>';
    const cc={...c,express:cfgOverride||c.express};
    const rows=(plan.days||[]).map((d,i)=>({d,i})).filter(x=>x.d&&!x.d.rest&&(x.d.exercises||[]).length).map(({d,i})=>{
      const name=typeof capDayLabel==='function'?capDayLabel(d,i):(d.day||('Dzień '+(i+1)));
      const f=xpVariantForDay(d,cc,'full'),s=xpVariantForDay(d,cc,'short'),e=xpVariantForDay(d,cc,'express');
      const cell=v=>xpUseful(v,f)||v.kind==='full'?`<b>ok. ${v.estMin} min</b><br><span class="xp-names">${esc(v.items.map(it=>it.name+(v.setsCap?' ×'+it.sets:'')).join(', '))}</span>`:'<span class="xp-names">bez skrótu (dzień już krótki)</span>';
      return `<tr><th scope="row">${esc(name)}</th><td>${cell(f)}</td><td>${cell(s)}</td><td>${cell(e)}</td></tr>`;
    }).join('');
    return `<div class="xp-prev-wrap"><table class="xp-prev"><caption>Podgląd: ${esc(plan.name||'Plan')}</caption><thead><tr><th scope="col">Dzień</th><th scope="col">Pełny</th><th scope="col">Skrócony</th><th scope="col">Express</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function xpCardHTML(c){
    const st=xpState(c);
    const cfg=st?st.cfg:xpCfg(c);
    if(!st){
      return `<section class="wu-card xp-card" id="xp-card" aria-labelledby="xp-title">
        <div class="wu-head"><h3 id="xp-title" class="cp-section-title" style="margin:0;">KRÓTSZE TRENINGI (PROGRESS EXPRESS)</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="xp-edit" data-cid="${esc(c.id)}">${cfg.on?'Zmień':'Ustaw'}</button></div>
        ${cfg.on?`<p class="wu-sub">Włączone. Skrócony: pierwsze ${cfg.short.ex} ćw.${cfg.short.sets?', maks. '+cfg.short.sets+' serie':''} · Express: pierwsze ${cfg.express.ex} ćw., maks. ${cfg.express.sets} serie. Klient wybiera wariant na ekranie „Dzisiaj”.</p>`
          :`<p class="wu-sub">Wyłączone. Klient widzi tylko pełny trening.</p>`}
      </section>`;
    }
    const exOpts=n=>Array.from({length:n},(_,i)=>[i+1,'pierwsze '+(i+1)]);
    return `<section class="wu-card xp-card is-editing" id="xp-card" aria-labelledby="xp-title">
      <div class="wu-head"><h3 id="xp-title" class="cp-section-title" style="margin:0;">KRÓTSZE TRENINGI — USTALENIE TRENERA</h3></div>
      <label class="xp-on"><input type="checkbox" data-xp-field="on" ${cfg.on?'checked':''}> <span><b>Pozwól klientowi wybrać krótszy trening</b><br><span class="wu-sub">Kolejność ćwiczeń w planie = priorytet. Najważniejsze ćwiczenia ustaw na początku dnia. Rozgrzewka zostaje w każdym wariancie, super-serii nie rozcinamy.</span></span></label>
      <div class="xp-rules">
        <fieldset><legend>Skrócony (ok. 30 min)</legend>${xpSel('short.ex',cfg.short.ex,exOpts(8),'Ćwiczenia')}${xpSel('short.sets',cfg.short.sets,[[0,'wszystkie'],[2,'maks. 2'],[3,'maks. 3'],[4,'maks. 4']],'Serie')}</fieldset>
        <fieldset><legend>Express (ok. 15 min)</legend>${xpSel('express.ex',cfg.express.ex,exOpts(6),'Ćwiczenia')}${xpSel('express.sets',cfg.express.sets,[[1,'maks. 1'],[2,'maks. 2'],[3,'maks. 3']],'Serie')}</fieldset>
      </div>
      ${xpPreviewHTML(c,cfg)}
      ${st.error?`<p class="wu-err" role="alert">${esc(st.error)}</p>`:''}
      <div class="wu-actions">
        <button type="button" class="btn btn-ghost" data-act="xp-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="xp-save"${st.saving?' disabled':''}>${st.saving?'Zapisuję…':'Zapisz'}</button>
      </div>
    </section>`;
  }
  function xpRender(c){
    const host=document.getElementById('xp-card');
    if(host)host.outerHTML=xpCardHTML(c);
    else{
      const wu=document.getElementById('wu-card');
      if(wu)wu.insertAdjacentHTML('afterend',xpCardHTML(c));
      else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',xpCardHTML(c));}
    }
    document.querySelectorAll('#xp-card [data-xp-field]').forEach(el=>{el.onchange=()=>{
      const st=xpState(c);if(!st)return;
      const f=el.dataset.xpField;
      if(f==='on')st.cfg.on=!!el.checked;
      else{const [k,p]=f.split('.');st.cfg[k][p]=parseInt(el.value,10)||0;}
      xpRender(c);
      const again=document.querySelector(`#xp-card [data-xp-field="${f}"]`);if(again)again.focus();
    };});
  }
  const cur=()=>clientById(window._xpEdit&&window._xpEdit.clientId);
  async function xpSave(){
    const st=window._xpEdit;const c=cur();if(!st||!c||st.saving)return;
    const prev=c.express;
    c.express={on:!!st.cfg.on,short:{ex:st.cfg.short.ex,sets:st.cfg.short.sets},express:{ex:st.cfg.express.ex,sets:st.cfg.express.sets},updatedAt:new Date().toISOString()};
    st.saving=true;st.error='';xpRender(c);
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.express=prev;st.saving=false;st.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';xpRender(c);return;}
    window._xpEdit=null;xpRender(c);
    if(typeof notify==='function')notify(c.express.on?'Krótsze treningi włączone — klient wybierze wariant na „Dzisiaj”':'Krótsze treningi wyłączone');
  }
  if(typeof uiAction==='function'){
    uiAction('xp-edit',d=>{const c=clientById(d.cid);if(!c)return;window._xpEdit={clientId:c.id,cfg:JSON.parse(JSON.stringify(xpCfg(c)))};xpRender(c);});
    uiAction('xp-cancel',()=>{const c=cur();window._xpEdit=null;if(c)xpRender(c);});
    uiAction('xp-save',()=>{xpSave();});
  }
  // Karta pod rozgrzewką na zakładce „Plan” w profilu klienta (warmup.js opakowuje renderCPPlan wcześniej).
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._xp){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)xpRender(c);}catch(e){}return r;};
    wrapped._xp=true;wrapped._wu=orig._wu;
    window.renderCPPlan=wrapped;
  }

  Object.assign(window,{XP_KINDS,xpCfg,xpCount,xpEstMin,xpVariantForDay,xpUseful,xpApply,xpApplyPending,xpSummary,xpTodayHTML,xpOpen,xpClose,xpStart,xpCardHTML,xpPreviewHTML,xpSave});
})();
