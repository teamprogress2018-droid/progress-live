/* Plan klienta: widok klienta (aplikacja klienta). „Moje jedzenie” i „Lista zakupów” z opublikowanego jadłospisu
   (c.dietPlan.plan z ekranu „Plan klienta”), karta jedzenia na „Dzisiaj” i dodatkowe pytania check-inu.
   Trening klient ma w zakładce Trening (plan z PL). Szkic i notatki trenera są w clientPrivate, klient ich nie widzi. */
(function(root){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const ico=(n,s)=>typeof root.csIcon==='function'?root.csIcon(n,s):'';
  const FORM_LBL={habits:'Cele i nawyki',flex:'Elastyczny plan posiłków',week:'Jadłospis na tydzień'};
  const WD_SHORT=['Pn','Wt','Śr','Cz','Pt','So','Nd'];

  function me(){const id=root._clientId||root.capClientId;return(root.CL||[]).find(x=>x&&x.id===id)||null;}
  /** Jadłospis z ekranu „Plan klienta”, zatwierdzony przez trenera. */
  /** Zatwierdzony jadłospis. Starsze karty mogą mieć w dietPlan szkic, który zastąpił plan — wtedy ostatni zatwierdzony z historii. */
  function approvedOf(c){
    const ok=d=>d&&d.status==='zatwierdzony'&&d.plan&&typeof d.plan==='object';
    if(!c)return null;if(ok(c.dietPlan))return c.dietPlan;
    if(c.dietPlan&&c.dietPlan.status==='szkic')return(Array.isArray(c.dietPlanHistory)?c.dietPlanHistory:[]).find(ok)||null;
    return null;
  }
  function planOf(c){const d=approvedOf(c);return d?d.plan:null;}
  function food(id){const D=root.DietPlan;if(!D)return{name:id,unit:'g'};if(!D._F){D._F={};D.DIET_FOODS.forEach(f=>{D._F[f.id]=f;});}return D._F[id]||{name:id,unit:'g'};}
  function amt(f,a){return f.unit==='szt'?a+' szt.':a+' '+f.unit;}
  function shopAmt(f,a){if(f.unit==='szt')return a+' szt.';return a>=1000?(Math.round(a/100)/10).toString().replace('.',',')+(f.unit==='ml'?' l':' kg'):a+' '+f.unit;}
  function home(id,a){const P=root.PlanClient;return P&&P.homePortion?P.homePortion(id,a):'';}
  const todayIdx=()=>(new Date().getDay()+6)%7;

  function targetsLine(p){return`ok. ${p.kcal} kcal · białko ${p.p} g · tłuszcz ${p.f} g · węglowodany ${p.c} g`;}
  function mealHTML(m){
    return`<li class="pkc-meal"><div class="pkc-meal-h"><b>${esc(m.n)}</b>${m.d?` · ${esc(m.d)}`:''}<span class="pkc-muted"> ~${m.k} kcal</span></div><ul class="pkc-items">${m.i.map(([id,a])=>{const f=food(id),h=home(id,a);return`<li><span>${esc(f.name)}</span><span>${amt(f,a)}${h?` <span class="pkc-muted">(${esc(h)})</span>`:''}</span></li>`;}).join('')}</ul></li>`;
  }
  /** „Moje jedzenie”: forma, cel dzienny, posiłki (dzień tygodnia albo propozycje do wyboru) albo nawyki. */
  function foodHTML(c){
    const p=planOf(c);
    if(!p)return`<div class="cs-screen" data-pkc-food="empty"><header><h1 class="cs-h1 cs-h1-page">Moje jedzenie</h1><p class="cs-lead">Trener jeszcze nie przygotował Twojego planu jedzenia. Możesz zapytać na czacie.</p></header></div>`;
    const st=root._pkcFood||(root._pkcFood={day:todayIdx()});
    let body='';
    if(p.form==='habits'){
      body=`<section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">3 nawyki na ten tydzień</h2><ol class="pkc-habits">${p.habits.map(h=>`<li>${esc(h)}</li>`).join('')}</ol></section>`;
    }else if(p.form==='flex'){
      body=p.flex.map(sl=>`<section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">${esc(sl.s)}</h2><p class="cs-card-text">Wybierz jedną propozycję.</p><ol class="pkc-meals">${sl.o.map(mealHTML).join('')}</ol></section>`).join('');
    }else if(p.days.length&&root.DietView){
      // Nowy widok planu: nagłówek z celem, zakładki, karty posiłków (diet-plan-view.js).
      return`<div class="cs-screen pkc-dpv" data-pkc-food="${esc(p.form)}">${root.DietView.render('pkcdpv',vmOf(c,p),{mode:'client',
        choice:loadChoice(c),onChoice:ch=>saveChoice(c,ch),shopDone:()=>shopDone(c),onShopToggle:(id,on)=>root.pkcShopToggle(id,on)})}</div>`;
    }else if(p.days.length){
      const di=Math.min(st.day,p.days.length-1),d=p.days[di];
      body=`<div class="cs-chips pkc-days" role="group" aria-label="Dzień tygodnia">${p.days.map((x,i)=>`<button type="button" class="cs-chip${i===di?' is-on':''}" aria-pressed="${i===di}" data-pkc-day="${i}" onclick="pkcDay(${i})">${esc(p.days.length===7?WD_SHORT[i]:(x.n||'').replace('Dzień ','D'))}</button>`).join('')}</div>
        <section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">${esc(d.n)}${di===todayIdx()?' (dziś)':''}</h2><ol class="pkc-meals">${d.m.map(mealHTML).join('')}</ol></section>
        ${p.cooking&&p.cooking.length?`<section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">Gotowanie na zapas</h2><ul class="pkc-habits">${p.cooking.map(b=>`<li><b>${esc(b.days[0])}</b>${b.days.length>1?' (na: '+esc(b.days.join(', '))+')':''}</li>`).join('')}</ul></section>`:''}`;
    }
    return`<div class="cs-screen" data-pkc-food="${esc(p.form)}"><header><div class="cs-eyebrow">${esc(FORM_LBL[p.form]||'Plan jedzenia')}</div><h1 class="cs-h1 cs-h1-page">Moje jedzenie</h1><p class="cs-lead">${esc(targetsLine(p))}</p></header>
      ${body}
      <button type="button" class="cs-btn cs-btn-secondary" onclick="capGoScreen('shopping')">${ico('list',20)}Lista zakupów</button>
      <p class="pkc-muted">To orientacyjny plan od trenera. Jeśli coś nie pasuje, napisz na czacie.</p></div>`;
  }
  /** Tydzień planu liczony od zatwierdzenia (1 = pierwszy tydzień). */
  function weekNo(c){const d=approvedOf(c),t=Date.parse(d&&d.approvedAt||'');return isFinite(t)?Math.max(1,Math.floor((Date.now()-t)/(7*864e5))+1):1;}
  function vmOf(c,p){
    return root.DietView.fromPublic(p,{client:c&&c.name||'',goalKey:p.goal||(c&&c.goal)||'',delta:0,period:'tydzień '+weekNo(c)});
  }
  // „Zamień posiłek” u klienta: wybrany posiłek z innego dnia pamiętamy na tym telefonie, dla tego planu.
  function choiceKey(c){const d=approvedOf(c);return'pkc-choice:'+(c&&c.id)+':'+(d&&d.approvedAt||'');}
  function loadChoice(c){try{return JSON.parse(root.localStorage.getItem(choiceKey(c))||'{}')||{};}catch(e){return{};}}
  function saveChoice(c,ch){try{root.localStorage.setItem(choiceKey(c),JSON.stringify(ch||{}));}catch(e){}}
  // Odhaczone produkty pamiętamy tylko na tym telefonie (wygoda przy zakupach).
  function shopKey(c){const d=approvedOf(c);return'pkc-shop:'+(c&&c.id)+':'+(d&&d.approvedAt||'');}
  function shopDone(c){try{return JSON.parse(root.localStorage.getItem(shopKey(c))||'[]');}catch(e){return[];}}
  function shopHTML(c){
    const p=planOf(c);
    if(!p)return`<div class="cs-screen" data-pkc-shop="empty"><header><h1 class="cs-h1 cs-h1-page">Lista zakupów</h1><p class="cs-lead">Lista pojawi się razem z planem jedzenia od trenera.</p></header></div>`;
    const done=new Set(shopDone(c));
    const span=p.shopDays===7?'na tydzień':'na '+p.shopDays+' dni';
    return`<div class="cs-screen" data-pkc-shop><header><h1 class="cs-h1 cs-h1-page">Lista zakupów</h1><p class="cs-lead">${span}${p.people>1?', dla '+p.people+' osób':''}. Odhacz, co już masz.</p></header>
      <ul class="cs-list pkc-shop">${p.shop.map(([id,a])=>{const f=food(id),on=done.has(id);return`<li><label class="pkc-check${on?' is-on':''}"><input type="checkbox" data-pkc-item="${esc(id)}"${on?' checked':''} onchange="pkcShopToggle('${esc(id)}',this.checked)"><span>${esc(f.name)}</span><span class="pkc-amt">${shopAmt(f,a)}</span></label></li>`;}).join('')}</ul>
      <p class="pkc-muted">Ilości orientacyjne. Produkty suche (ryż, makaron, płatki) liczone przed gotowaniem.</p></div>`;
  }
  /** Karta na „Dzisiaj”: posiłki na dziś albo nawyki; nic, gdy nie ma planu jedzenia. */
  function todayCardHTML(c){
    const p=planOf(c);if(!p)return'';
    let txt='';
    if(p.form==='week'&&p.days.length){const d=p.days[Math.min(todayIdx(),p.days.length-1)];txt=d.m.map(m=>`<li><b>${esc(m.n)}</b>${m.d?': '+esc(m.d):''}</li>`).join('');}
    else if(p.form==='flex')txt=p.flex.map(sl=>`<li><b>${esc(sl.s)}</b>: ${sl.o.length} propozycje do wyboru</li>`).join('');
    else txt=p.habits.map(h=>`<li>${esc(h)}</li>`).join('');
    return`<section class="cs-card cs-card-flat" data-pkc-today><div class="cs-eyebrow">JEDZENIE NA DZIŚ</div><p class="cs-card-text">${esc(targetsLine(p))}</p><ul class="pkc-habits">${txt}</ul><button type="button" class="cs-btn cs-btn-secondary" onclick="capGoScreen('food')">Moje jedzenie</button></section>`;
  }

  /* Check-in: przy planie z „Plan klienta” dochodzą nastrój, głód i pytanie o najtrudniejszą rzecz w tygodniu. */
  function hasClientPlan(c){const d=c&&c.dietPlan;return!!(d&&d.source==='plan-klienta')||!!(c&&c.clientPlanPublished);}
  const EXTRA_SCALES={mood:'nastrój',hunger:'głód'};

  Object.assign(root,{
    pkcFoodHTML:foodHTML,pkcShopHTML:shopHTML,pkcTodayCardHTML:todayCardHTML,pkcHasFood:c=>!!planOf(c||me()),pkcMe:me,
    pkcCheckinExtra:c=>hasClientPlan(c||me()),PKC_EXTRA_SCALES:EXTRA_SCALES,
    pkcDay:i=>{root._pkcFood={day:i};if(typeof root.renderClientLive==='function')root.renderClientLive();else if(typeof root.capGoScreen==='function')root.capGoScreen('food');},
    pkcShopToggle:(id,on)=>{const c=me();const s=new Set(shopDone(c));if(on)s.add(id);else s.delete(id);try{root.localStorage.setItem(shopKey(c),JSON.stringify([...s]));}catch(e){}
      const el=root.document&&root.document.querySelector('[data-pkc-item="'+id+'"]');if(el&&el.parentNode)el.parentNode.classList.toggle('is-on',!!on);}
  });
})(typeof window!=='undefined'?window:globalThis);
