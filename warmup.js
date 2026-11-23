/* Rozgrzewka klienta — wybór przez trenera (profil klienta → Plan).
 * Trener wybiera ćwiczenia z własnej biblioteki (allExercises), widzi zapisane ograniczenia klienta
 * i oznaczenie, gdy nazwa ćwiczenia może dotyczyć ograniczonego obszaru (cpClientLimitConflicts).
 * Aplikacja niczego nie diagnozuje i nie dobiera sama — decyzja należy do trenera.
 * Zapis: client.warmup = {items:[{name,dose}], note, updatedAt}. Klient odhacza wykonanie w aplikacji (client-simple.js). */
(function(){
  'use strict';
  const WU_MAX=12;
  const WU_CATS=['Rozgrzewka','Mobilność','Rozciąganie','Cardio'];
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;

  function wuItems(c){
    const w=c&&c.warmup;
    return (w&&Array.isArray(w.items)?w.items:[]).filter(i=>i&&String(i.name||'').trim()).slice(0,WU_MAX)
      .map(i=>({name:String(i.name).trim().slice(0,120),dose:String(i.dose||'').trim().slice(0,40)}));
  }
  function wuLimitsText(c){
    return String(c&&c.injuries||'').trim()||'';
  }
  /** Ostrzeżenia dla trenera: nazwa ćwiczenia pasuje do obszaru z zapisanych ograniczeń. Tylko informacja. */
  function wuConflicts(c,names){
    if(!c||typeof cpClientLimitConflicts!=='function')return {};
    const out={};
    try{cpClientLimitConflicts({injuries:wuLimitsText(c)},names).forEach(x=>{out[String(x.exercise).toLowerCase()]=x.area;});}catch(e){}
    return out;
  }
  function wuLibrary(){
    let all=[];
    try{all=typeof allExercises==='function'?allExercises():[].concat(window.EX||[],window.DEF_EX||[]);}catch(e){all=[];}
    const seen=new Set();
    return all.filter(x=>{const n=String(x&&x.name||'').trim();if(!n||seen.has(n.toLowerCase()))return false;seen.add(n.toLowerCase());return true;});
  }
  function wuSearch(q){
    const lib=wuLibrary();
    const t=String(q||'').trim().toLowerCase();
    const rank=x=>WU_CATS.indexOf(x.cat)>=0?WU_CATS.indexOf(x.cat):9;
    const own=new Set((window.EX||[]).map(x=>String(x&&x.name||'').toLowerCase()));
    return lib.filter(x=>!t||String(x.name).toLowerCase().includes(t)||String(x.aka||'').toLowerCase().includes(t)||String(x.cat||'').toLowerCase().includes(t))
      .filter(x=>t||WU_CATS.includes(x.cat)||own.has(String(x.name).toLowerCase()))
      .sort((a,b)=>rank(a)-rank(b)||String(a.name).localeCompare(String(b.name),'pl'))
      .slice(0,12);
  }

  function wuState(c){
    const st=window._wuEdit;
    if(st&&st.clientId===c.id)return st;
    return null;
  }
  function wuCardHTML(c){
    const st=wuState(c);
    const items=st?st.items:wuItems(c);
    const limits=wuLimitsText(c);
    const conf=wuConflicts(c,items.map(i=>i.name));
    const warn=n=>conf[String(n).toLowerCase()]?`<span class="wu-flag" title="Nazwa pasuje do obszaru z ograniczeń klienta — sprawdź sam, czy to ćwiczenie jest dla niego odpowiednie.">⚠ sprawdź: ${esc(conf[String(n).toLowerCase()])}</span>`:'';
    if(!st){
      return `<section class="wu-card" id="wu-card" aria-labelledby="wu-title">
        <div class="wu-head"><h3 id="wu-title" class="cp-section-title" style="margin:0;">ROZGRZEWKA PRZED TRENINGIEM</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="wu-edit" data-cid="${esc(c.id)}">${items.length?'Zmień':'Ustaw rozgrzewkę'}</button></div>
        ${items.length?`<ol class="wu-list">${items.map(i=>`<li><b>${esc(i.name)}</b>${i.dose?` <span class="wu-dose">${esc(i.dose)}</span>`:''} ${warn(i.name)}</li>`).join('')}</ol>
          ${c.warmup&&c.warmup.note?`<p class="wu-note">Notatka dla klienta: ${esc(c.warmup.note)}</p>`:''}
          <p class="wu-sub">Klient zobaczy tę listę przed każdym treningiem i zaznaczy, co zrobił.</p>`
        :`<p class="wu-sub">Brak przypisanej rozgrzewki. Klient zaczyna od razu od pierwszego ćwiczenia.</p>`}
      </section>`;
    }
    const res=wuSearch(st.q);
    const resConf=wuConflicts(c,res.map(x=>x.name));
    return `<section class="wu-card is-editing" id="wu-card" aria-labelledby="wu-title">
      <div class="wu-head"><h3 id="wu-title" class="cp-section-title" style="margin:0;">ROZGRZEWKA — WYBÓR TRENERA</h3></div>
      <div class="wu-limits${limits?'':' is-empty'}" role="note"><b>Zapisane ograniczenia klienta:</b> ${limits?esc(limits):'brak zapisanych ograniczeń'}
        <span class="wu-limits-sub">Oznaczenie ⚠ to tylko podpowiedź z nazwy ćwiczenia. Ocena, czy ćwiczenie jest odpowiednie, należy do Ciebie.</span></div>
      <ol class="wu-list wu-edit-list">${items.length?items.map((i,ix)=>`<li><b>${esc(i.name)}</b> ${warn(i.name)}
          <input type="text" class="form-input wu-dose-in" maxlength="40" aria-label="Ilość: ${esc(i.name)}" placeholder="np. 2 × 10 lub 30 s" value="${esc(i.dose)}" data-wu-dose="${ix}">
          <button type="button" class="btn btn-ghost btn-sm" data-act="wu-up" data-i="${ix}" aria-label="Przesuń wyżej: ${esc(i.name)}"${ix===0?' disabled':''}>↑</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="wu-remove" data-i="${ix}" aria-label="Usuń: ${esc(i.name)}">Usuń</button></li>`).join('')
        :'<li class="wu-empty">Dodaj ćwiczenia z biblioteki poniżej.</li>'}</ol>
      <label class="wu-search"><span>Szukaj w swojej bibliotece ćwiczeń</span>
        <input type="search" class="form-input" id="wu-q" autocomplete="off" placeholder="np. mobilność bioder, krążenia ramion" value="${esc(st.q||'')}"></label>
      <ul class="wu-results" id="wu-results">${res.length?res.map(x=>{const inList=items.some(i=>i.name.toLowerCase()===String(x.name).toLowerCase());const a=resConf[String(x.name).toLowerCase()];
        return `<li><span><b>${esc(x.name)}</b> <span class="wu-cat">${esc(x.cat||'')}</span>${a?` <span class="wu-flag">⚠ sprawdź: ${esc(a)}</span>`:''}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-act="wu-add" data-name="${esc(x.name)}"${inList||items.length>=WU_MAX?' disabled':''}>${inList?'Dodane':'+ Dodaj'}</button></li>`;}).join('')
        :'<li class="wu-empty">Nic nie znaleziono. Dodaj ćwiczenie do biblioteki, a potem wybierz je tutaj.</li>'}</ul>
      <label class="wu-search"><span>Notatka dla klienta (opcjonalnie)</span>
        <input type="text" class="form-input" id="wu-note" maxlength="300" placeholder="np. spokojnie, bez bólu" value="${esc(st.note||'')}"></label>
      ${st.error?`<p class="wu-err" role="alert">${esc(st.error)}</p>`:''}
      <div class="wu-actions">
        <button type="button" class="btn btn-ghost" data-act="wu-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="wu-save"${st.saving?' disabled':''}>${st.saving?'Zapisuję…':'Zapisz rozgrzewkę'}</button>
      </div>
    </section>`;
  }
  function wuRender(c){
    const host=document.getElementById('wu-card');
    if(host){host.outerHTML=wuCardHTML(c);}
    else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',wuCardHTML(c));}
    wuBindInputs(c);
  }
  function wuBindInputs(c){
    const q=document.getElementById('wu-q');
    if(q)q.oninput=()=>{const st=wuState(c);if(!st)return;st.q=q.value;const pos=q.selectionStart;wuRender(c);const n=document.getElementById('wu-q');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}};
    const note=document.getElementById('wu-note');
    if(note)note.oninput=()=>{const st=wuState(c);if(st)st.note=note.value;};
    document.querySelectorAll('[data-wu-dose]').forEach(inp=>{inp.oninput=()=>{const st=wuState(c);const i=Number(inp.dataset.wuDose);if(st&&st.items[i])st.items[i].dose=inp.value.slice(0,40);};});
  }
  const cur=()=>clientById(window._wuEdit&&window._wuEdit.clientId);

  async function wuSave(){
    const st=window._wuEdit;const c=cur();if(!st||!c||st.saving)return;
    const items=st.items.map(i=>({name:i.name,dose:String(i.dose||'').trim().slice(0,40)})).slice(0,WU_MAX);
    const prev=c.warmup;
    c.warmup=items.length?{items,note:String(st.note||'').trim().slice(0,300),updatedAt:new Date().toISOString()}:null;
    st.saving=true;st.error='';wuRender(c);
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.warmup=prev;st.saving=false;st.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';wuRender(c);return;}
    window._wuEdit=null;wuRender(c);
    if(typeof notify==='function')notify(items.length?'Rozgrzewka zapisana — klient zobaczy ją przed treningiem':'Rozgrzewka usunięta');
  }

  if(typeof uiAction==='function'){
    uiAction('wu-edit',d=>{const c=clientById(d.cid);if(!c)return;window._wuEdit={clientId:c.id,items:wuItems(c),note:String(c.warmup&&c.warmup.note||''),q:''};wuRender(c);});
    uiAction('wu-cancel',()=>{const c=cur();window._wuEdit=null;if(c)wuRender(c);});
    uiAction('wu-add',d=>{const st=window._wuEdit;const c=cur();if(!st||!c)return;const n=String(d.name||'').trim().slice(0,120);
      if(!n||st.items.length>=WU_MAX||st.items.some(i=>i.name.toLowerCase()===n.toLowerCase()))return;st.items.push({name:n,dose:''});wuRender(c);});
    uiAction('wu-remove',d=>{const st=window._wuEdit;const c=cur();if(!st||!c)return;st.items.splice(Number(d.i),1);wuRender(c);});
    uiAction('wu-up',d=>{const st=window._wuEdit;const c=cur();const i=Number(d.i);if(!st||!c||i<1)return;const t=st.items[i];st.items[i]=st.items[i-1];st.items[i-1]=t;wuRender(c);});
    uiAction('wu-save',()=>{wuSave();});
  }

  // Karta rozgrzewki na górze zakładki „Plan” w profilu klienta.
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._wu){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)wuRender(c);}catch(e){}return r;};
    wrapped._wu=true;
    window.renderCPPlan=wrapped;
  }
  window.wuCardHTML=wuCardHTML;window.wuSearch=wuSearch;window.wuItems=wuItems;window.wuSave=wuSave;
})();
