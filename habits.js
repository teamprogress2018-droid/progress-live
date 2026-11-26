/**
 * Progress Live 3.0 — przypomnienia o nawykach (woda, sen, spacer, własne).
 *
 * - Trener ustawia je dla klienta: profil klienta → Plan → karta `#hb-card`. Zapis: `client.habits={on,items,updatedAt}`.
 *   items: water {from,to,everyH}, sleep {at}, steps {at}, custom {at,text≤80}; każdy z `on`.
 * - Wysyła serwer (CommsCore.planJobs → `habit_reminder`, tylko push), o ustawionych godzinach (bez przesuwania przez ciszę nocną),
 *   poza dziennym limitem automatów. Klient wyłącza je w „Powiadomieniach” (kategoria `habits`).
 */
(function(){
  'use strict';
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const HM=/^([01]\d|2[0-3]):[0-5]\d$/;
  const DEF={water:{id:'water',on:true,from:'09:00',to:'19:00',everyH:2},sleep:{id:'sleep',on:false,at:'22:00'},steps:{id:'steps',on:false,at:'18:00'},custom:{id:'custom',on:false,at:'08:00',text:''}};
  const LABEL={water:'Woda',sleep:'Sen',steps:'Spacer',custom:'Własne przypomnienie'};

  function hbCfg(c){
    const h=c&&c.habits||{};const items={};
    Object.keys(DEF).forEach(k=>{const it=(Array.isArray(h.items)?h.items:[]).find(x=>x&&x.id===k);items[k]=Object.assign({},DEF[k],it||{},{id:k});});
    return {on:h.on===true,items};
  }
  function hbTimesText(it){
    const t=typeof CommsCore!=='undefined'&&CommsCore.habitTimes?CommsCore.habitTimes(it):[];
    return t.length?t.join(', '):'—';
  }
  function hbSummary(cfg){
    const on=Object.values(cfg.items).filter(it=>it.on);
    if(!cfg.on||!on.length)return 'Wyłączone. Klient nie dostaje przypomnień o nawykach.';
    return on.map(it=>LABEL[it.id]+': '+hbTimesText(it)).join(' · ');
  }
  function pushState(c){
    const P=window.COMMS&&window.COMMS.prefs&&window.COMMS.prefs[c.id];
    if(!P)return '';
    if(P.categories&&P.categories.habits===false)return 'Klient wyłączył u siebie przypomnienia o nawykach.';
    return P.push&&P.push.subscribed?'Klient ma włączone powiadomienia push.':'Klient nie ma jeszcze włączonych powiadomień push — bez nich przypomnienia nie dotrą.';
  }
  const st=c=>{const s=window._hbEdit;return s&&c&&s.clientId===c.id?s:null;};
  function row(k,it,inner){
    return `<fieldset class="hb-row"><legend class="sr-only">${esc(LABEL[k])}</legend>
      <label class="xp-on"><input type="checkbox" data-hb="${k}.on" ${it.on?'checked':''}> <b>${esc(LABEL[k])}</b></label>${inner}</fieldset>`;
  }
  const time=(k,f,v)=>`<input type="time" data-hb="${k}.${f}" value="${esc(v)}" aria-label="${esc(LABEL[k])}: godzina">`;
  function hbCardHTML(c){
    const s=st(c);const cfg=s?s.cfg:hbCfg(c);
    const ps=pushState(c);
    if(!s){
      return `<section class="wu-card hb-card" id="hb-card" aria-labelledby="hb-t">
        <div class="wu-head"><h3 id="hb-t" class="cp-section-title" style="margin:0;">PRZYPOMNIENIA O NAWYKACH</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="hb-edit" data-cid="${esc(c.id)}">${cfg.on?'Zmień':'Ustaw'}</button></div>
        <p class="wu-sub" data-hb-summary>${esc(hbSummary(cfg))}</p>${cfg.on&&ps?`<p class="wu-sub">${esc(ps)}</p>`:''}
      </section>`;
    }
    const w=cfg.items.water;
    return `<section class="wu-card hb-card is-editing" id="hb-card" aria-labelledby="hb-t">
      <div class="wu-head"><h3 id="hb-t" class="cp-section-title" style="margin:0;">PRZYPOMNIENIA O NAWYKACH</h3></div>
      <label class="xp-on"><input type="checkbox" data-hb="on" ${cfg.on?'checked':''}> <span><b>Wysyłaj klientowi przypomnienia</b><br><span class="wu-sub">Tylko jako powiadomienie push na telefonie klienta, o tych godzinach (także w ciszy nocnej). Nie liczą się do dziennego limitu. Klient może je wyłączyć w „Powiadomieniach”.</span></span></label>
      ${row('water',w,`<div class="hb-times">od ${time('water','from',w.from)} do ${time('water','to',w.to)} co <select data-hb="water.everyH" aria-label="Woda: co ile godzin">${[1,2,3,4].map(n=>`<option value="${n}"${Number(w.everyH)===n?' selected':''}>${n} h</option>`).join('')}</select></div>`)}
      ${row('sleep',cfg.items.sleep,`<div class="hb-times">o ${time('sleep','at',cfg.items.sleep.at)}</div>`)}
      ${row('steps',cfg.items.steps,`<div class="hb-times">o ${time('steps','at',cfg.items.steps.at)}</div>`)}
      ${row('custom',cfg.items.custom,`<div class="hb-times">o ${time('custom','at',cfg.items.custom.at)} <input type="text" maxlength="80" data-hb="custom.text" value="${esc(cfg.items.custom.text)}" placeholder="np. Weź witaminę D" aria-label="Treść własnego przypomnienia"></div>`)}
      <p class="wu-sub" data-hb-preview>Godziny: ${esc(hbSummary(cfg))}</p>
      ${ps?`<p class="wu-sub">${esc(ps)}</p>`:''}
      ${s.error?`<p class="wu-err" role="alert">${esc(s.error)}</p>`:''}
      <div class="wu-actions"><button type="button" class="btn btn-ghost" data-act="hb-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="hb-save"${s.saving?' disabled':''}>${s.saving?'Zapisuję…':'Zapisz'}</button></div>
    </section>`;
  }
  function hbRender(c){
    const host=document.getElementById('hb-card');
    if(host)host.outerHTML=hbCardHTML(c);
    else{
      const anchor=document.getElementById('pai-card')||document.getElementById('ac-card')||document.getElementById('pw-card')||document.getElementById('pj-card')||document.getElementById('xp-card')||document.getElementById('wu-card');
      if(anchor)anchor.insertAdjacentHTML('afterend',hbCardHTML(c));
      else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',hbCardHTML(c));}
    }
    document.querySelectorAll('#hb-card [data-hb]').forEach(el=>{
      const h=()=>{const s=st(c);if(!s)return;const path=el.dataset.hb.split('.');
        const v=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?Number(el.value):el.value;
        if(path.length===1)s.cfg[path[0]]=v;else s.cfg.items[path[0]][path[1]]=v;
        const pv=document.querySelector('#hb-card [data-hb-preview]');if(pv)pv.textContent='Godziny: '+hbSummary(s.cfg);};
      el.addEventListener('change',h);if(el.type==='text')el.addEventListener('input',h);
    });
  }
  function hbValidate(cfg){
    const it=cfg.items;
    if(it.water.on&&(!HM.test(it.water.from)||!HM.test(it.water.to)||it.water.from>=it.water.to))return 'Woda: godzina „od” musi być wcześniejsza niż „do”.';
    for(const k of ['sleep','steps','custom'])if(it[k].on&&!HM.test(it[k].at))return LABEL[k]+': wpisz godzinę.';
    if(it.custom.on&&!String(it.custom.text||'').trim())return 'Wpisz treść własnego przypomnienia.';
    return '';
  }
  async function hbSave(){
    const s=window._hbEdit;const c=s&&clientById(s.clientId);if(!s||!c||s.saving)return;
    const err=hbValidate(s.cfg);if(err){s.error=err;hbRender(c);return;}
    const prev=c.habits;
    c.habits={on:!!s.cfg.on,items:Object.values(s.cfg.items).map(it=>{const o={id:it.id,on:!!it.on};
      if(it.id==='water'){o.from=it.from;o.to=it.to;o.everyH=[1,2,3,4].includes(Number(it.everyH))?Number(it.everyH):2;}
      else{o.at=it.at;if(it.id==='custom')o.text=String(it.text||'').trim().slice(0,80);}return o;}),updatedAt:new Date().toISOString()};
    s.saving=true;s.error='';hbRender(c);
    let ok=false;try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.habits=prev;s.saving=false;s.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';hbRender(c);return;}
    window._hbEdit=null;hbRender(c);
    if(typeof notify==='function')notify(c.habits.on?'Przypomnienia o nawykach zapisane':'Przypomnienia o nawykach wyłączone');
  }
  if(typeof uiAction==='function'){
    uiAction('hb-edit',d=>{const c=clientById(d.cid);if(!c)return;const cfg=hbCfg(c);if(!c.habits)cfg.on=true;window._hbEdit={clientId:c.id,cfg};hbRender(c);});
    uiAction('hb-cancel',()=>{const c=window._hbEdit&&clientById(window._hbEdit.clientId);window._hbEdit=null;if(c)hbRender(c);});
    uiAction('hb-save',()=>{hbSave();});
  }
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._hb){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)hbRender(c);}catch(e){}return r;};
    Object.keys(orig).forEach(k=>{wrapped[k]=orig[k];});wrapped._hb=true;window.renderCPPlan=wrapped;
  }
  Object.assign(window,{hbCfg,hbSummary,hbCardHTML,hbValidate,hbSave});
})();
