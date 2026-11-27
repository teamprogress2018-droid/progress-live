/**
 * Progress Voice — imię klienta głosem trenera: karta w profilu klienta (zakładka Plan, `#vn-card`).
 *
 * - Trener zatwierdza albo poprawia formę imienia w wołaczu (propozycja pvVocative z client-voice.js) → `client.voiceName`.
 * - „Zapisz i nagraj moim głosem” zapisuje kartę i woła funkcję serwera voiceNameClips (window._voiceNamesCall),
 *   która nagrywa 4 zwroty z imieniem do prywatnych plików klienta. Stan nagrań z Firestore clientVoice/{clientId}.
 * - „Nie używaj imienia” czyści pole — asystent przestaje używać imienia (nagrania zostają, nie są odtwarzane).
 */
(function(){
  'use strict';
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const VN={status:{},busy:{}};
  const lines=v=>(window.PV_NAME_LINES||[]).map(t=>t.replace('{V}',v));

  async function vnLoadStatus(c){
    if(!c||VN.status[c.id]!==undefined||typeof window._getDoc!=='function'||!window._db)return;
    VN.status[c.id]=null;
    try{const s=await window._getDoc(window._doc(window._db,'clientVoice',c.id));const d=s&&s.exists&&s.exists()?s.data():null;
      VN.status[c.id]=d?{name:d.name,count:Object.keys(d.items||{}).length,at:d.updatedAt}:false;}
    catch(e){VN.status[c.id]=false;}
    vnRender(c);
  }
  function vnCardHTML(c){
    const saved=String(c.voiceName||'').trim();
    const v=saved||(typeof pvVocative==='function'?pvVocative(c.name):'');
    const st=VN.status[c.id];const busy=VN.busy[c.id];
    const rec=st&&st.name?`Nagrane Twoim głosem: <b>${esc(st.name)}</b> (${st.count} zwroty)${st.name!==saved&&saved?' — forma imienia się zmieniła, nagraj ponownie.':''}`:'Imię nie jest jeszcze nagrane Twoim głosem.';
    return `<section class="wu-card vn-card" id="vn-card" aria-labelledby="vn-t">
      <div class="wu-head"><h3 id="vn-t" class="cp-section-title" style="margin:0;">GŁOS ASYSTENTA: IMIĘ KLIENTA</h3></div>
      <p class="wu-sub">Asystent w treningu zwraca się do klienta po imieniu: „${esc(lines(v||'…').join('” · „'))}”.</p>
      <label class="xp-sel vn-field"><span>Jak się zwracać (wołacz)</span><input type="text" maxlength="24" data-vn-name value="${esc(v)}" placeholder="np. Anno" aria-describedby="vn-hint"></label>
      <p class="wu-sub" id="vn-hint">Propozycja z imienia — popraw, jeśli mówisz inaczej (np. „Gosiu” zamiast „Małgorzato”).</p>
      <p class="wu-sub" data-vn-status>${rec}</p>
      ${VN.err&&VN.err[c.id]?`<p class="wu-err" role="alert">${esc(VN.err[c.id])}</p>`:''}
      <div class="wu-actions">
        ${saved?`<button type="button" class="btn btn-ghost" data-act="vn-clear" data-cid="${esc(c.id)}"${busy?' disabled':''}>Nie używaj imienia</button>`:''}
        <button type="button" class="btn btn-primary" data-act="vn-record" data-cid="${esc(c.id)}"${busy?' disabled':''}>${busy?'Nagrywam… (do 30 s)':'Zapisz i nagraj moim głosem'}</button>
      </div>
      <p class="wu-sub">Imię trafia do ElevenLabs tylko w celu nagrania. Nagrania są prywatne — słyszy je tylko ten klient.</p>
    </section>`;
  }
  function vnRender(c){
    const host=document.getElementById('vn-card');
    if(host){host.outerHTML=vnCardHTML(c);return;}
    const anchor=document.getElementById('hb-card')||document.getElementById('pai-card')||document.getElementById('ac-card')||document.getElementById('wu-card');
    if(anchor)anchor.insertAdjacentHTML('afterend',vnCardHTML(c));
    else{const body=document.getElementById('cp-body');if(body)body.insertAdjacentHTML('afterbegin',vnCardHTML(c));else return;}
    vnLoadStatus(c);
  }
  async function vnRecord(cid){
    const c=clientById(cid);if(!c||VN.busy[cid])return;
    VN.err=VN.err||{};VN.err[cid]='';
    const inp=document.querySelector('#vn-card [data-vn-name]');
    const v=String(inp&&inp.value||'').trim();
    if(!(typeof pvNameOk==='function'&&pvNameOk(v))){VN.err[cid]='Wpisz samo imię w wołaczu, np. „Anno” (litery, do 24 znaków).';vnRender(c);return;}
    if(typeof window._voiceNamesCall!=='function'){VN.err[cid]='Nagrywanie nie jest teraz dostępne. Odśwież aplikację.';vnRender(c);return;}
    VN.busy[cid]=true;vnRender(c);
    const prev=c.voiceName;
    if(c.voiceName!==v){
      c.voiceName=v;
      let ok=false;try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
      if(!ok){c.voiceName=prev;VN.busy[cid]=false;VN.err[cid]='Nie udało się zapisać karty klienta. Sprawdź połączenie.';vnRender(c);return;}
    }
    try{
      const r=await window._voiceNamesCall({clientId:cid});
      const d=r&&r.data||{};
      VN.status[cid]={name:d.name||v,count:d.count||4,at:new Date().toISOString()};
      if(typeof notify==='function')notify('Imię nagrane Twoim głosem ('+(d.count||4)+' zwroty)');
    }catch(e){
      const code=String(e&&e.code||'').replace('functions/','');
      const msg=String(e&&e.message||'').trim();
      VN.err[cid]=(code==='internal'||code==='not-found')&&(!msg||/^internal$/i.test(msg))
        ?'Nagrywanie nie odpowiedziało. Jeśli to pierwsze użycie — funkcja może nie być jeszcze wdrożona na serwerze (pilot.sh voice).'
        :msg||'Nie udało się nagrać imienia. Spróbuj ponownie.';
    }
    VN.busy[cid]=false;vnRender(c);
  }
  async function vnClear(cid){
    const c=clientById(cid);if(!c)return;const prev=c.voiceName;c.voiceName='';
    let ok=false;try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.voiceName=prev;VN.err=VN.err||{};VN.err[cid]='Nie udało się zapisać. Sprawdź połączenie.';}
    vnRender(c);
  }
  if(typeof uiAction==='function'){uiAction('vn-record',d=>{vnRecord(d.cid);});uiAction('vn-clear',d=>{vnClear(d.cid);});}
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._vn){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)vnRender(c);}catch(e){}return r;};
    Object.keys(orig).forEach(k=>{wrapped[k]=orig[k];});wrapped._vn=true;window.renderCPPlan=wrapped;
  }
  Object.assign(window,{VN,vnCardHTML,vnRecord,vnClear});
})();
