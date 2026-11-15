/* Ekran trenera „Plan klienta: trening + odżywianie” (#screen-clientplan).
   Jeden proces: Co wiemy o kliencie → wybór (trening / odżywianie / komplet) → szkic AI → sprawdzenie → publikacja.
   Logika danych: plan-client.js (PlanClient). Trening: ten sam wywiad i generator (PLIV.generateForClientPlan).
   Szkic leży w c.clientPlan i klient go nie widzi; publikacja zapisuje plan treningowy (PL), jadłospis (c.dietPlan) i wysyła wiadomość. */
(function(root){
  'use strict';
  const doc=()=>root.document;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const txt=x=>String(x==null?'':x).trim();
  const PC=()=>root.PlanClient;
  const DP=()=>root.DietPlan;
  const clients=()=>(Array.isArray(root.CL)?root.CL:[]).filter(c=>c&&c.status!=='archived');
  const clientById=id=>(Array.isArray(root.CL)?root.CL:[]).find(c=>c&&c.id===id)||null;
  const say=m=>{if(typeof root.notify==='function')root.notify(m);};
  const save=c=>{if(typeof root.persistById==='function')return root.persistById('clients',c);return Promise.resolve(c);};
  const now=()=>new Date().toISOString();
  const fmtDate=iso=>{const t=Date.parse(iso);return isFinite(t)?new Date(t).toLocaleDateString('pl-PL',{day:'numeric',month:'long'}):'';};

  const TABS=[['overview','Przegląd'],['training','Trening'],['nutrition','Odżywianie'],['shopping','Lista zakupów'],['notes','Notatki trenera'],['progress','Postępy']];
  const CHOICES=[
    {v:'trening',l:'Ułóż trening',d:'Plan treningowy z wywiadu. Odżywianie bez zmian.'},
    {v:'odzywianie',l:'Ułóż odżywianie',d:'Cel kaloryczny, makro i plan posiłków. Trening bez zmian.'},
    {v:'komplet',l:'Ułóż komplet',d:'Trening i odżywianie razem, dni treningowe zgrane z jadłospisem.'}
  ];
  const FORMS=[
    {v:'habits',l:'Cele i nawyki',d:'Kalorie, makro i 3 nawyki. Bez rozpisanych posiłków.'},
    {v:'flex',l:'Elastyczny plan posiłków',d:'Do 3 propozycji na każdy posiłek, o podobnej kaloryczności.'},
    {v:'week',l:'Jadłospis 7 dni',d:'Rozpisany tydzień z gotowaniem na zapas.'}
  ];
  const WD=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  // Domyślne dni treningowe, gdy klient nie podał ulubionych (1 = pon … 0 = nd).
  const DEFAULT_DAYS={1:[3],2:[2,4],3:[1,3,5],4:[1,2,4,5],5:[1,2,3,4,5],6:[1,2,3,4,5,6]};

  const S={cid:'',tab:'overview',choice:'komplet',form:'week',day:0,showAll:false,gen:{state:'idle',msg:'',error:null},modal:false};

  function food(id){const D=DP();if(!D)return{name:id,unit:'g'};if(!D._F){D._F={};D.DIET_FOODS.forEach(f=>{D._F[f.id]=f;});}return D._F[id]||{name:id,unit:'g'};}
  function fmtAmount(f,a){return f.unit==='szt'?a+' szt.':a+' '+f.unit;}
  function fmtShop(f,a){if(f.unit==='szt')return a+' szt.';return a>=1000?(Math.round(a/100)/10).toString().replace('.',',')+(f.unit==='ml'?' l':' kg'):a+' '+f.unit;}
  const r=v=>Math.round(v||0);

  function draftOf(c){return c&&c.clientPlan&&typeof c.clientPlan==='object'?c.clientPlan:null;}
  function trainDaysOf(c){
    const d=PC().interviewOf(c);
    const pref=(d.prefDays||[]).map(x=>parseInt(x,10)).filter(x=>x>=0&&x<=6);
    const n=parseInt(d.days,10)||parseInt(c.trainingFreq,10)||3;
    return pref.length?pref.slice(0,n):(DEFAULT_DAYS[Math.min(6,Math.max(1,n))]||DEFAULT_DAYS[3]);
  }
  /** Szkic odżywiania liczony z aktualnych danych klienta i formy ze szkicu (nie zapisujemy całego jadłospisu). */
  function nutritionOf(c,dr){
    if(!dr||!dr.nutrition)return null;
    try{return PC().buildNutrition(c,dr.nutrition.form||'week',{trainDays:trainDaysOf(c),variant:dr.nutrition.variant||0,habits:dr.nutrition.habits});}
    catch(e){console.warn('Plan klienta: odżywianie',e);return null;}
  }

  /* ───────── Render ───────── */
  function mount(){return doc()&&doc().getElementById('pk-root');}
  function render(){
    const el=mount();if(!el)return;
    const list=clients();
    if(S.cid&&!clientById(S.cid))S.cid='';
    if(!S.cid&&list.length===1)S.cid=list[0].id;
    const c=clientById(S.cid);
    const pick=`<label class="pk-pick"><span class="pk-pick-lbl">Klient</span><select class="form-select" id="pk-client" aria-label="Klient" onchange="pkSelectClient(this.value)"><option value="">Wybierz klienta…</option>${list.map(x=>`<option value="${esc(x.id)}"${x.id===S.cid?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(!c){el.innerHTML=`<div class="pk-wrap">${pick}<div class="pk-card pk-empty"><h2 class="pk-h2">Wybierz klienta</h2><p class="pk-muted">Plan powstaje z wywiadu i profilu klienta. Trening i odżywianie układasz w jednym miejscu, a klient widzi plan dopiero po publikacji.</p></div></div>`;el.dataset.pkState='pick';return;}
    const raw=draftOf(c),dr=raw&&raw.kind?raw:null;
    const status=dr?(dr.status==='opublikowany'?`<span class="pk-pill is-ok">Opublikowany ${esc(fmtDate(dr.publishedAt))}</span>`:`<span class="pk-pill">Szkic · klient go nie widzi</span>`):'';
    const tabs=`<div class="pk-tabs" role="tablist">${TABS.map(([k,l])=>`<button type="button" role="tab" class="pk-tab${S.tab===k?' is-on':''}" aria-selected="${S.tab===k}" data-pk-tab="${k}" onclick="pkTab('${k}')">${l}</button>`).join('')}</div>`;
    const body={overview:overviewHTML,training:trainingHTML,nutrition:nutritionHTML,shopping:shoppingHTML,notes:(cc)=>notesHTML(cc,raw),progress:progressHTML}[S.tab]||overviewHTML;
    el.innerHTML=`<div class="pk-wrap"><div class="pk-top">${pick}${status}</div>${tabs}<div class="pk-body" data-pk-body="${S.tab}">${body(c,dr)}</div></div>${S.modal?modalHTML(c):''}`;
    el.dataset.pkState=dr?(dr.status==='opublikowany'?'published':'draft'):'new';
  }

  function factsHTML(c){
    const P=PC(),list=P.facts(c),miss=P.missing(list,3),conf=P.confidence(list);
    const rows=list.filter(f=>S.showAll||f.top).map(f=>`<div class="pk-fact${f.v?'':' is-miss'}" data-pk-fact="${f.k}"><span class="pk-fact-l">${esc(f.l)}</span><span class="pk-fact-v">${f.v?esc(f.v):'brak danych'}</span></div>`).join('');
    const more=list.length>list.filter(f=>f.top).length?`<button type="button" class="pk-link" onclick="pkToggleAll()">${S.showAll?'Pokaż mniej':'Pokaż wszystko ('+list.length+')'}</button>`:'';
    const missBox=miss.length?`<div class="pk-miss" data-pk-missing><div><b>Brakuje:</b> ${miss.map(f=>esc(f.l.toLowerCase())).join(', ')}.</div><div class="pk-muted">Szkic powstanie i bez tego, ale z mniejszą pewnością dopasowania.</div><button type="button" class="btn btn-ghost btn-sm pk-btn" onclick="pkOpenInterview()">Uzupełnij wywiad</button></div>`:'';
    const tone=conf.level===3?'is-ok':conf.level===2?'is-warn':'is-low';
    return`<section class="pk-card" aria-labelledby="pk-facts-h"><div class="pk-head"><h2 class="pk-h2" id="pk-facts-h">Co wiemy o kliencie</h2><span class="pk-pill ${tone}" data-pk-confidence="${conf.label}">Pewność dopasowania: ${conf.label}</span></div><div class="pk-facts">${rows}</div>${more}${missBox}</section>`;
  }
  function healthHTML(c){
    const g=PC().healthGate(c);
    if(!g.stop)return'';
    const why=g.flags.concat(g.hits).map(x=>`<li>${esc(x)}</li>`).join('');
    const ack=g.ack?`<div class="pk-muted">Zgoda lekarza na trening potwierdzona ${esc(fmtDate(g.ack.at))}.</div>`:
      `<label class="pk-check"><input type="checkbox" id="pk-health-ack" onchange="pkHealthAck(this.checked)"> Klient ma zgodę lekarza na trening. Odżywianie ułoży lekarz albo dietetyk kliniczny.</label>`;
    return`<section class="pk-card pk-stop" data-pk-health role="alert"><h2 class="pk-h2">${esc(g.message)}</h2><p class="pk-muted">Powód z wywiadu:</p><ul class="pk-list">${why}</ul><p class="pk-muted">AI nie przygotuje odżywiania. Trening jest dostępny po potwierdzeniu zgody lekarza.</p>${ack}</section>`;
  }
  function choiceHTML(c,dr){
    const g=PC().healthGate(c);
    if(g.stop&&S.choice!=='trening')S.choice='trening';
    const card=o=>{const off=g.stop&&o.v!=='trening';return`<button type="button" class="pk-choice${S.choice===o.v?' is-on':''}" data-pk-choice="${o.v}" aria-pressed="${S.choice===o.v}"${off?' disabled':''} onclick="pkChoice('${o.v}')"><b>${o.l}</b><span>${off?'Niedostępne: wymaga konsultacji z lekarzem lub dietetykiem.':o.d}</span></button>`;};
    const needsNut=S.choice!=='trening';
    const forms=needsNut?`<div class="pk-sub"><div class="pk-lbl">Forma odżywiania</div><div class="pk-chips">${FORMS.map(f=>`<button type="button" class="pk-chip${S.form===f.v?' is-on':''}" data-pk-form="${f.v}" aria-pressed="${S.form===f.v}" onclick="pkForm('${f.v}')">${f.l}</button>`).join('')}</div><div class="pk-muted">${esc((FORMS.find(f=>f.v===S.form)||FORMS[2]).d)}</div></div>`:'';
    const blocked=g.stop&&!g.ack;
    const running=S.gen.state==='running';
    const btnCls=dr?'btn btn-ghost':'btn btn-primary';
    const label=running?'AI układa szkic…':dr?'Przygotuj nowy szkic':'Przygotuj szkic';
    const gen=running?`<div class="pk-gen" data-pk-gen="running" aria-live="polite"><span class="pk-spin" aria-hidden="true"></span>${esc(S.gen.msg||'AI układa trening…')}</div>`:
      S.gen.state==='error'?`<div class="pk-gen is-err" data-pk-gen="error" role="alert"><b>${esc(S.gen.error&&S.gen.error.title||'Nie udało się przygotować szkicu')}</b><div>${esc(S.gen.error&&S.gen.error.hint||'Spróbuj ponownie za chwilę.')}</div></div>`:'';
    const warnNew=dr&&dr.status!=='opublikowany'?'<div class="pk-muted">Nowy szkic zastąpi obecny. Notatki trenera zostają.</div>':'';
    return`<section class="pk-card" aria-labelledby="pk-choice-h"><h2 class="pk-h2" id="pk-choice-h">Co przygotować</h2><div class="pk-choices">${CHOICES.map(card).join('')}</div>${forms}${warnNew}<div class="pk-actions"><button type="button" class="${btnCls} pk-btn" id="pk-generate" onclick="pkGenerate()"${running||blocked?' disabled':''}>${label}</button>${blocked?'<span class="pk-muted">Najpierw potwierdź zgodę lekarza.</span>':''}</div>${gen}</section>`;
  }
  function draftHTML(c,dr){
    if(!dr)return'';
    const nut=nutritionOf(c,dr);
    const rows=[];
    if(dr.kind!=='odzywianie'){
      const p=dr.training;
      rows.push(['Trening',p?`${(p.days||[]).length} × ${p.sessionDuration||'?'} min · ${esc(p.method||p.planName||'')}`:(S.gen.state==='running'?'w przygotowaniu…':'brak szkicu treningu')]);
    }
    if(dr.nutrition){
      rows.push(['Odżywianie',nut&&nut.ok?`ok. ${nut.kcal} kcal · B ${nut.targets.protein.g} g · T ${nut.targets.fat.g} g · W ${nut.targets.carbs.g} g · ${esc((FORMS.find(f=>f.v===nut.form)||{}).l||'')}`:'brak danych do obliczenia']);
    }
    const asm=[].concat(dr.trainingAssumptions||[],nut&&nut.assumptions||[]);
    const asmHTML=asm.length?`<div class="pk-asm" data-pk-assumptions><b>Założenia AI do sprawdzenia:</b><ul class="pk-list">${[...new Set(asm)].map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>`:'';
    const flag=dr.needsTrainerReview?'<div class="pk-miss">Plan wymaga uwagi trenera: sprawdź ograniczenia zdrowotne przed publikacją.</div>':'';
    const ready=(dr.kind==='odzywianie'||dr.training)&&(!dr.nutrition||(nut&&nut.ok));
    const published=dr.status==='opublikowany';
    const pub=published?`<div class="pk-muted">Opublikowany ${esc(fmtDate(dr.publishedAt))}. Klient widzi plan treningowy i jadłospis w wiadomościach.</div>`:
      `<label class="pk-check"><input type="checkbox" id="pk-reviewed"${ready?'':' disabled'}> Szkic sprawdzony. Klient zobaczy go dopiero po publikacji.</label><div class="pk-actions"><button type="button" class="btn btn-primary pk-btn" id="pk-publish" onclick="pkPublish()"${ready?'':' disabled'}>Opublikuj klientowi</button></div>`;
    return`<section class="pk-card" data-pk-draft aria-labelledby="pk-draft-h"><div class="pk-head"><h2 class="pk-h2" id="pk-draft-h">${published?'Plan klienta':'Szkic planu'}</h2><span class="pk-muted">${esc(fmtDate(dr.updatedAt))}</span></div><div class="pk-facts">${rows.map(([l,v])=>`<div class="pk-fact"><span class="pk-fact-l">${l}</span><span class="pk-fact-v">${v}</span></div>`).join('')}</div>${flag}${asmHTML}<p class="pk-muted">To propozycja do sprawdzenia i edycji. Cele są orientacyjne, do obserwacji i korekty.</p>${pub}</section>`;
  }
  function overviewHTML(c,dr){
    return`<div class="pk-grid"><div class="pk-col">${healthHTML(c)}${factsHTML(c)}</div><div class="pk-col">${choiceHTML(c,dr)}${draftHTML(c,dr)}</div></div>`;
  }

  function emptyTab(title,hint){return`<section class="pk-card pk-empty"><h2 class="pk-h2">${title}</h2><p class="pk-muted">${hint}</p><button type="button" class="btn btn-ghost btn-sm pk-btn" onclick="pkTab('overview')">Przejdź do przeglądu</button></section>`;}
  function trainingHTML(c,dr){
    const p=dr&&dr.training;
    if(!p)return emptyTab('Brak szkicu treningu',S.gen.state==='running'?'AI układa trening. Szkic pojawi się tutaj za chwilę.':'Wybierz „Ułóż trening” albo „Ułóż komplet” w przeglądzie.');
    const lim=PC().facts(c).find(f=>f.k==='limits');
    const safety=[lim&&lim.v&&lim.v!=='Brak'?'Ograniczenia klienta: '+lim.v:'',txt(p.adaptation_notes)].filter(Boolean);
    const day=(d,i)=>{
      const wu=(d.warmupExercises||[]).map(w=>`<li>${esc(w.name)}${w.sets||w.reps?' · '+esc([w.sets,w.reps].filter(Boolean).join(' × ')):''}${w.note?' <span class="pk-muted">('+esc(w.note)+')</span>':''}</li>`).join('');
      const ex=(d.exercises||[]).map((e,j)=>`<li class="pk-ex" data-pk-ex="${i}-${j}"><div class="pk-ex-name">${j+1}. ${esc(e.name)}</div><div class="pk-ex-meta"><span>${esc(e.sets||'?')} × ${esc(e.reps||'?')}</span>${e.rir?`<span>RIR ${esc(e.rir)}</span>`:''}${e.rpe?`<span>RPE ${esc(e.rpe)}</span>`:''}${e.rest?`<span>przerwa ${esc(e.rest)}</span>`:''}${e.tempo?`<span>tempo ${esc(e.tempo)}</span>`:''}</div>${e.notes?`<div class="pk-ex-note">Technika: ${esc(e.notes)}</div>`:''}${e.alt?`<div class="pk-ex-note">Zamiennik: ${esc(e.alt)}</div>`:''}</li>`).join('');
      return`<section class="pk-card pk-day" data-pk-day="${i}"><div class="pk-head"><h3 class="pk-h3">${esc(d.dayName||'Dzień '+(i+1))}</h3><span class="pk-muted">${esc(p.sessionDuration?p.sessionDuration+' min':'')}</span></div>${d.focus?`<div class="pk-muted">${esc(d.focus)}</div>`:''}${wu?`<div class="pk-lbl">Rozgrzewka</div><ul class="pk-list">${wu}</ul>`:''}<div class="pk-lbl">Ćwiczenia</div><ol class="pk-exs">${ex}</ol></section>`;
    };
    const prog=[txt(p.periodization)].concat(p.progressionRules||[]).filter(Boolean);
    return`<section class="pk-card"><div class="pk-head"><h2 class="pk-h2">${esc(p.planName||'Plan treningowy')}</h2><span class="pk-muted">${(p.days||[]).length} dni · ${esc(p.weeks||'?')} tyg.</span></div>${p.warmup?`<p class="pk-muted">Rozgrzewka ogólna: ${esc(p.warmup)}</p>`:''}${safety.length?`<div class="pk-miss"><b>Bezpieczeństwo:</b> ${safety.map(esc).join(' ')}</div>`:''}</section>${(p.days||[]).map(day).join('')}${prog.length?`<section class="pk-card"><h3 class="pk-h3">Progresja</h3><ul class="pk-list">${prog.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}`;
  }

  function itemsHTML(items){
    return`<ul class="pk-items">${(items||[]).map(it=>{const f=food(it.id),h=PC().homePortion(it.id,it.amount);const sw=(it.swaps||[]).slice(0,2).map(s=>esc(food(s.id).name.toLowerCase())+' '+fmtAmount(food(s.id),s.amount)).join(', ');
      return`<li><span>${esc(f.name)}</span><span class="pk-amt">${fmtAmount(f,it.amount)}${h?` <span class="pk-muted">(${esc(h)})</span>`:''}</span>${sw?`<div class="pk-muted pk-sw">albo: ${sw}</div>`:''}</li>`;}).join('')}</ul>`;
  }
  function mealHTML(m){
    return`<div class="pk-meal"><div class="pk-meal-h"><b>${esc(m.name)}</b>${m.dish?` · ${esc(m.dish)}`:''}<span class="pk-muted"> ~${r(m.total.kcal)} kcal · B ${r(m.total.p)} g</span></div>${itemsHTML(m.items)}</div>`;
  }
  function targetsHTML(n){
    const t=n.targets;
    return`<div class="pk-targets" data-pk-targets><div><b>${n.kcal}</b><span>kcal dziennie</span></div><div><b>${t.protein.g} g</b><span>białko</span></div><div><b>${t.fat.g} g</b><span>tłuszcz</span></div><div><b>${t.carbs.g} g</b><span>węglowodany</span></div><div><b>${n.meals}</b><span>posiłki</span></div><div><b>${String(n.water[0]).replace('.',',')}–${String(n.water[1]).replace('.',',')} l</b><span>woda</span></div></div>`;
  }
  function nutritionHTML(c,dr){
    const g=PC().healthGate(c);
    if(g.stop)return`<section class="pk-card pk-stop"><h2 class="pk-h2">${esc(g.message)}</h2><p class="pk-muted">Odżywianie dla tego klienta ułoży lekarz albo dietetyk kliniczny.</p></section>`;
    if(!dr||!dr.nutrition)return emptyTab('Brak szkicu odżywiania','Wybierz „Ułóż odżywianie” albo „Ułóż komplet” w przeglądzie.');
    const n=nutritionOf(c,dr);
    if(!n||!n.ok)return`<section class="pk-card"><h2 class="pk-h2">Brakuje danych do obliczenia celu</h2><p class="pk-muted">Potrzebne: ${esc((n&&n.missing||[]).join(', ')||'dane klienta')}.</p><button type="button" class="btn btn-ghost btn-sm pk-btn" onclick="pkOpenInterview()">Uzupełnij wywiad</button></section>`;
    const forms=`<div class="pk-chips" role="group" aria-label="Forma odżywiania">${FORMS.map(f=>`<button type="button" class="pk-chip${n.form===f.v?' is-on':''}" data-pk-nform="${f.v}" aria-pressed="${n.form===f.v}" onclick="pkSetNutritionForm('${f.v}')">${f.l}</button>`).join('')}</div>`;
    const head=`<section class="pk-card"><div class="pk-head"><h2 class="pk-h2">Odżywianie</h2><span class="pk-muted">orientacyjny cel</span></div>${forms}${targetsHTML(n)}<p class="pk-muted">Cel liczony z masy ciała, wzrostu, wieku i aktywności${n.assumptions.length?' (z założeniami: '+esc(n.assumptions.join(', '))+')':''}. Do obserwacji i korekty po check-inach.</p></section>`;
    let body='';
    if(n.form==='habits'){
      body=`<section class="pk-card" data-pk-habits><h3 class="pk-h3">3 nawyki na start</h3><ol class="pk-list">${n.habits.map(h=>`<li>${esc(h)}</li>`).join('')}</ol><p class="pk-muted">Klient dostaje cel i nawyki bez rozpisanych posiłków. Lista zakupów to produkty bazowe na tydzień.</p></section>`;
    }else if(n.form==='flex'){
      body=Object.keys(n.flex).map(slot=>`<section class="pk-card" data-pk-slot="${esc(slot)}"><h3 class="pk-h3">${esc(slot)}</h3><div class="pk-muted">Do wyboru, podobna kaloryczność</div><div class="pk-opts">${n.flex[slot].map((m,i)=>`<div class="pk-opt"><div class="pk-lbl">Propozycja ${i+1}</div>${mealHTML(m)}</div>`).join('')}</div></section>`).join('');
    }else{
      const w=n.week,di=Math.min(S.day,w.days.length-1),d=w.days[di];
      const td=trainDaysOf(c);
      const days=`<div class="pk-chips pk-days" role="group" aria-label="Dzień">${w.days.map((x,i)=>`<button type="button" class="pk-chip${i===di?' is-on':''}" data-pk-wday="${i}" aria-pressed="${i===di}" onclick="pkDay(${i})">${WD[i]||i+1}${td.includes((i+1)%7)?' ·':''}</button>`).join('')}</div><div class="pk-muted">Kropka = dzień treningowy.</div>`;
      const cook=w.cooking&&w.cooking.length?`<section class="pk-card"><h3 class="pk-h3">Gotowanie na zapas</h3><ul class="pk-list">${w.cooking.map(b=>`<li><b>${esc(b.days[0])}</b>${b.days.length>1?' (na: '+esc(b.days.join(', '))+')':''}: ${b.items.map(it=>esc(food(it.id).name.toLowerCase())+' '+fmtShop(food(it.id),it.amount)).join(', ')}</li>`).join('')}</ul></section>`:'';
      const warn=(w.warnings||[]).length?`<div class="pk-miss">${w.warnings.map(esc).join('<br>')}</div>`:'';
      body=`<section class="pk-card" data-pk-week>${days}<h3 class="pk-h3">${esc(d.name)} · ~${r(d.total.kcal)} kcal</h3>${warn}${d.meals.map(mealHTML).join('')}</section>${cook}`;
    }
    return head+body;
  }
  function shoppingHTML(c,dr){
    if(PC().healthGate(c).stop)return emptyTab('Brak listy zakupów','Odżywianie dla tego klienta wymaga konsultacji z lekarzem lub dietetykiem klinicznym.');
    const n=dr&&dr.nutrition?nutritionOf(c,dr):null;
    if(!n||!n.ok)return emptyTab('Brak listy zakupów','Lista powstaje razem ze szkicem odżywiania.');
    const span=n.shopDays===7?'na tydzień':'na '+n.shopDays+' dni';
    const ppl=n.form==='week'&&n.people>1?' dla '+n.people+' osób':'';
    return`<section class="pk-card" data-pk-shopping><div class="pk-head"><h2 class="pk-h2">Lista zakupów ${span}${ppl}</h2><span class="pk-muted">${n.shopping.length} produktów</span></div><ul class="pk-shop">${n.shopping.map(s=>{const f=food(s.id);return`<li><span>${esc(f.name)}</span><span class="pk-amt">${fmtShop(f,s.amount)}</span></li>`;}).join('')}</ul><p class="pk-muted">Ilości orientacyjne. Produkty suche (ryż, makaron, płatki) liczone przed gotowaniem.</p></section>`;
  }
  function notesHTML(c,dr){
    return`<section class="pk-card"><h2 class="pk-h2">Notatki trenera</h2><p class="pk-muted">Widzisz je tylko Ty. Klient ich nie dostaje.</p><textarea class="form-input pk-notes" id="pk-notes" rows="8" placeholder="Np. klient woli trenować rano, w piątki krótszy trening">${esc(dr&&dr.notes||'')}</textarea><div class="pk-actions"><button type="button" class="btn btn-ghost pk-btn" onclick="pkSaveNotes()">Zapisz notatki</button></div></section>`;
  }
  function progressHTML(c,dr){
    if(!dr||dr.status!=='opublikowany')return emptyTab('Postępy po publikacji','Po publikacji planu klient co tydzień wypełnia krótki check-in. Tu zobaczysz jego odpowiedzi i propozycję korekty do Twojej decyzji.');
    const t=Date.parse(dr.publishedAt),next=isFinite(t)?new Date(t+7*86400000).toISOString():'';
    return`<section class="pk-card"><h2 class="pk-h2">Postępy</h2><p class="pk-muted">Plan opublikowany ${esc(fmtDate(dr.publishedAt))}. Pierwszy check-in klienta: ${esc(fmtDate(next))}.</p></section>`;
  }

  /* ───────── Uzupełnij wywiad: tylko brakujące pola (max 3) ───────── */
  const chipRow=(key,list,val,multi)=>`<div class="pk-chips" data-pk-iv="${key}">${list.map(o=>{const on=multi?(val||[]).includes(o.v):val===o.v;return`<button type="button" class="pk-chip${on?' is-on':''}" aria-pressed="${on}" onclick="pkIvPick('${key}','${esc(o.v)}',${multi?1:0})">${esc(o.l)}</button>`;}).join('')}</div>`;
  function ivFieldHTML(k,d,c){
    const L=root.PLIV||{};
    const inp=(id,val,ph,type)=>`<input class="form-input pk-in" id="pk-iv-${id}" type="${type||'text'}" inputmode="${type==='number'?'decimal':'text'}" value="${esc(val||'')}" placeholder="${esc(ph||'')}">`;
    switch(k){
      case'goal':return chipRow('goal',L.GOALS||[],d.goal);
      case'trainings':return`<div class="pk-lbl">Dni w tygodniu</div>${chipRow('days',L.DAYS||[],d.days)}<div class="pk-lbl">Czas sesji</div>${chipRow('minutes',L.MINUTES||[],d.minutes)}`;
      case'limits':return`<div class="pk-lbl">Ból lub kontuzja</div>${chipRow('pain',L.YESNO||[],d.pain)}${inp('painText',d.painText,'Gdzie i kiedy boli')}<div class="pk-lbl">Zalecenia lekarza</div>${chipRow('medical',L.YESNO||[],d.medical)}`;
      case'body':return`<div class="pk-row2">${inp('height',d.height,'Wzrost (cm)','number')}${inp('weight',d.weight,'Masa ciała (kg)','number')}</div>`;
      case'age':return inp('age',c.age,'Wiek (lata)','number');
      case'allergies':return`<div class="pk-lbl">Sposób odżywiania</div>${chipRow('foodStyle',L.FOOD_STYLE||[],d.foodStyle)}<div class="pk-lbl">Alergie i wykluczenia</div>${chipRow('foodExclusions',L.FOOD_EX||[],d.foodExclusions,true)}`;
      case'activity':return`<div class="pk-lbl">Praca</div>${chipRow('job',L.JOB||[],d.job)}<div class="pk-lbl">Kroki dziennie</div>${chipRow('steps',L.STEPS||[],d.steps)}`;
      case'meals':return chipRow('mealsPerDay',L.MEALS||[],d.mealsPerDay);
      case'foodPrefs':return`${chipRow('foodStyle',L.FOOD_STYLE||[],d.foodStyle)}${inp('foodLikes',d.foodLikes,'Co lubi')}${inp('foodDislikes',d.foodDislikes,'Czego nie lubi')}`;
      case'cooking':return chipRow('cookingTime',L.COOKING||[],d.cookingTime);
      case'budget':return chipRow('foodBudget',L.BUDGET||[],d.foodBudget);
    }
    return'';
  }
  function modalHTML(c){
    const P=PC(),miss=P.missing(P.facts(c),3);
    const d=S.ivData||(S.ivData=P.interviewOf(c));
    const body=miss.length?miss.map(f=>`<div class="pk-ivf" data-pk-ivf="${f.k}"><div class="pk-lbl pk-lbl-strong">${esc(f.l)}</div>${ivFieldHTML(f.k,d,c)}</div>`).join(''):'<p class="pk-muted">Wszystkie najważniejsze dane są uzupełnione.</p>';
    return`<div class="pk-modal-bg" onclick="if(event.target===this)pkCloseInterview()"><div class="pk-modal" role="dialog" aria-modal="true" aria-labelledby="pk-iv-h"><div class="pk-head"><h2 class="pk-h2" id="pk-iv-h">Uzupełnij wywiad</h2><button type="button" class="pk-x" aria-label="Zamknij" onclick="pkCloseInterview()">×</button></div><p class="pk-muted">Tylko to, czego brakuje do planu. Pełny wywiad jest w Generatorze planu AI.</p>${body}<div class="pk-actions pk-actions-end"><button type="button" class="btn btn-ghost pk-btn" onclick="pkCloseInterview()">Anuluj</button><button type="button" class="btn btn-ghost pk-btn pk-btn-strong" id="pk-iv-save" onclick="pkSaveInterview()">Zapisz</button></div></div></div>`;
  }
  function ivPick(key,v,multi){
    const d=S.ivData||{};
    if(multi){const a=(d[key]||[]).slice(),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);d[key]=a;}
    else d[key]=d[key]===v?'':v;
    S.ivData=d;render();
  }
  function saveInterview(){
    const c=clientById(S.cid);if(!c)return;
    const d=S.ivData||{};
    const val=id=>{const el=doc().getElementById('pk-iv-'+id);return el?txt(el.value):null;};
    ['painText','height','weight','foodLikes','foodDislikes'].forEach(k=>{const v=val(k);if(v!=null)d[k]=v;});
    const age=val('age');if(age!=null&&parseInt(age,10)>0)c.age=parseInt(age,10);
    const keep=['goal','days','minutes','pain','painText','medical','height','weight','foodStyle','foodExclusions','job','steps','mealsPerDay','foodLikes','foodDislikes','cookingTime','foodBudget'];
    const iv=Object.assign({},c.planInterview||{});
    keep.forEach(k=>{if(d[k]!==undefined)iv[k]=Array.isArray(d[k])?d[k].slice():d[k];});
    iv.status=iv.status||'started';iv.updatedAt=now();
    c.planInterview=iv;
    S.modal=false;S.ivData=null;
    save(c);render();say('Wywiad uzupełniony');
  }

  /* ───────── Akcje ───────── */
  function ensureAplClient(c){
    const sel=doc().getElementById('apl-client');
    if(sel&&![...sel.options].some(o=>o.value===c.id)){const o=doc().createElement('option');o.value=c.id;o.textContent=c.name||c.id;sel.appendChild(o);}
  }
  function generate(){
    const c=clientById(S.cid);if(!c||S.gen.state==='running')return;
    const g=PC().healthGate(c);
    if(g.stop&&!g.ack){say('Najpierw potwierdź zgodę lekarza na trening');return;}
    const kind=g.stop?'trening':S.choice;
    const prev=draftOf(c);
    const dr={status:'szkic',kind,createdAt:now(),updatedAt:now(),notes:prev&&prev.notes||'',history:(prev&&prev.history||[]).slice(0,10),
      training:null,trainingAssumptions:[],trainingPublished:false,needsTrainerReview:false,
      nutrition:kind==='trening'?null:{form:S.form,variant:0,habits:PC().DEFAULT_HABITS.slice()}};
    // Odżywianie bez treningu zostawia opublikowany trening, a trening bez odżywiania — opublikowany jadłospis.
    if(kind==='odzywianie'&&prev&&prev.training){dr.training=prev.training;dr.trainingPublished=!!prev.trainingPublished;dr.trainingPlanId=prev.trainingPlanId||'';}
    if(prev&&prev.status==='opublikowany')dr.history.unshift({at:prev.publishedAt,kind:prev.kind,trainingPlanId:prev.trainingPlanId||''});
    if(dr.nutrition){const n=nutritionOf(c,dr);if(!n||!n.ok){say('Do odżywiania brakuje: '+((n&&n.missing)||[]).join(', '));}}
    c.clientPlan=dr;
    S.gen={state:'idle',msg:'',error:null};
    if(kind!=='odzywianie'){
      const L=root.PLIV;
      if(!L||typeof L.generateForClientPlan!=='function'){S.gen={state:'error',error:{title:'Generator planu jest niedostępny',hint:'Odśwież stronę i spróbuj ponownie.'}};render();return;}
      ensureAplClient(c);
      const res=L.generateForClientPlan(c.id);
      if(!res.ok){S.gen={state:'error',error:{title:'Nie udało się uruchomić generatora',hint:res.error||'Spróbuj ponownie za chwilę.'}};}
      else{dr.trainingAssumptions=res.assumptions||[];dr.needsTrainerReview=!!(res.rec&&res.rec.needsTrainerReview);dr.method=res.rec&&res.rec.method||'';if(S.gen.state!=='error'&&!dr.training)S.gen={state:'running',msg:'AI układa trening…',error:null};}
    }
    save(c);
    S.tab='overview';render();
  }
  function onTrainingReady(plan,rec,cid){
    const c=clientById(cid);const dr=draftOf(c);
    S.gen={state:'idle',msg:'',error:null};
    if(c&&dr){
      dr.training=JSON.parse(JSON.stringify(plan||{}));dr.trainingPublished=false;dr.updatedAt=now();
      if(rec&&rec.needsTrainerReview)dr.needsTrainerReview=true;
      save(c);say('Szkic treningu gotowy. Sprawdź go przed publikacją.');
    }
    if(cid===S.cid)render();
  }
  function onTrainingError(err){S.gen={state:'error',msg:'',error:err||null};render();}
  function onTrainingProgress(msg){
    if(S.gen.state!=='running')return;S.gen.msg=String(msg||'');
    const el=doc()&&doc().querySelector('[data-pk-gen="running"]');
    if(el)el.lastChild.textContent=S.gen.msg;
  }

  /** Tekst jadłospisu dla klienta w każdej z trzech form. */
  function nutritionText(n){
    const D=DP(),t=n.targets;
    if(n.form==='week')return D.dietPlanText(t,n.week);
    const L=[];
    L.push('🍽 Twój orientacyjny cel na dzień: ok. '+n.kcal+' kcal','Białko '+t.protein.g+' g · Tłuszcz '+t.fat.g+' g · Węglowodany '+t.carbs.g+' g','Woda: '+String(n.water[0]).replace('.',',')+'–'+String(n.water[1]).replace('.',',')+' l dziennie','');
    if(n.form==='habits'){
      L.push('Na start 3 nawyki:');n.habits.forEach((h,i)=>L.push((i+1)+'. '+h));L.push('');
    }else{
      L.push('Do każdego posiłku wybierz jedną propozycję. Mają podobną kaloryczność.','');
      Object.keys(n.flex).forEach(slot=>{
        L.push('🍴 '+slot.toUpperCase());
        n.flex[slot].forEach((m,i)=>{L.push((i+1)+') '+(m.dish||'Propozycja '+(i+1))+' (~'+r(m.total.kcal)+' kcal)');m.items.forEach(it=>{const f=food(it.id),h=PC().homePortion(it.id,it.amount);L.push('   • '+f.name+' '+fmtAmount(f,it.amount)+(h?' ('+h+')':''));});});
        L.push('');
      });
    }
    L.push('🛒 Lista zakupów '+(n.shopDays===7?'na tydzień':'na '+n.shopDays+' dni')+':');
    n.shopping.forEach(s=>{const f=food(s.id);L.push('• '+f.name+' '+fmtShop(f,s.amount));});
    L.push('','To orientacyjny cel do obserwacji i korekty. Nie zastępuje porady dietetyka ani lekarza.');
    return L.join('\n');
  }
  async function publish(){
    const c=clientById(S.cid),dr=draftOf(c);if(!c||!dr)return;
    const chk=doc().getElementById('pk-reviewed');
    if(!chk||!chk.checked){say('Najpierw zaznacz, że szkic jest sprawdzony');return;}
    const g=PC().healthGate(c);
    if(dr.nutrition&&g.stop){say(PC().HEALTH_STOP);return;}
    if(dr.training&&g.stop&&!g.ack){say('Najpierw potwierdź zgodę lekarza na trening');return;}
    const btn=doc().getElementById('pk-publish');if(btn){btn.disabled=true;btn.textContent='Publikuję…';}
    try{
      if(dr.training&&!dr.trainingPublished){
        if(typeof root.aplSavePlan!=='function')throw new Error('Brak zapisu planu');
        ensureAplClient(c);
        const sel=doc().getElementById('apl-client');if(sel)sel.value=c.id;
        root.aplLastPlan=JSON.parse(JSON.stringify(dr.training));
        const saved=await root.aplSavePlan();
        if(!saved)throw new Error('Plan treningowy nie został zapisany');
        dr.trainingPlanId=saved.id;dr.trainingPublished=true;
      }
      if(dr.nutrition){
        const n=nutritionOf(c,dr);
        if(!n||!n.ok)throw new Error('Brak danych do odżywiania');
        const at=now(),text=nutritionText(n),t=n.targets;
        const rec={status:'zatwierdzony',updatedAt:at,approvedAt:at,approvedBy:root._uid||null,source:'plan-klienta',form:n.form,
          kcal:t.kcal,protein:t.protein.g,fat:t.fat.g,carbs:t.carbs.g,days:n.form==='week'?7:1,meals:n.meals,prefs:n.prefs||null,text};
        if(c.dietPlan&&c.dietPlan.status==='zatwierdzony')c.dietPlanHistory=[c.dietPlan].concat(c.dietPlanHistory||[]).slice(0,5);
        c.dietPlan=rec;
        if(typeof root.pushMsg==='function')root.pushMsg(c.id,text);
      }
      dr.status='opublikowany';dr.publishedAt=now();dr.updatedAt=dr.publishedAt;
      await save(c);
      say('Plan opublikowany. '+(c.name||'Klient')+' go widzi.');
    }catch(e){
      say('Nie udało się opublikować: '+(e&&e.message||e)+'. Spróbuj ponownie.');
    }
    render();
  }

  function init(){
    if(root._pkOpenId){S.cid=root._pkOpenId;root._pkOpenId='';S.tab='overview';}
    render();
  }
  function open(cid){
    root._pkOpenId=cid||'';
    if(typeof root.goTo==='function')root.goTo('clientplan');else init();
  }

  Object.assign(root,{
    pkInit:init,openClientPlan:open,pkRender:render,
    pkSelectClient:id=>{S.cid=id;S.tab='overview';S.day=0;S.showAll=false;S.gen.state==='running'||(S.gen={state:'idle',msg:'',error:null});render();},
    pkTab:k=>{S.tab=k;render();},
    pkToggleAll:()=>{S.showAll=!S.showAll;render();},
    pkChoice:v=>{S.choice=v;render();},
    pkForm:v=>{S.form=v;render();},
    pkDay:i=>{S.day=i;render();},
    pkSetNutritionForm:v=>{const c=clientById(S.cid),dr=draftOf(c);if(!dr||!dr.nutrition)return;dr.nutrition.form=v;S.form=v;dr.updatedAt=now();if(dr.status==='opublikowany')dr.status='szkic';save(c);render();},
    pkHealthAck:on=>{const c=clientById(S.cid);if(!c)return;c.healthAck=on?{at:now(),by:root._uid||null}:null;save(c);render();},
    pkOpenInterview:()=>{S.modal=true;S.ivData=null;render();},
    pkCloseInterview:()=>{S.modal=false;S.ivData=null;render();},
    pkIvPick:ivPick,pkSaveInterview:saveInterview,
    pkGenerate:generate,pkPublish:publish,
    pkSaveNotes:()=>{const c=clientById(S.cid);if(!c)return;const el=doc().getElementById('pk-notes');const dr=draftOf(c)||(c.clientPlan={status:'szkic',kind:'',createdAt:now(),history:[]});dr.notes=el?el.value:'';dr.updatedAt=now();save(c);say('Notatki zapisane');},
    pkOnTrainingReady:onTrainingReady,pkOnTrainingError:onTrainingError,pkOnTrainingProgress:onTrainingProgress
  });
  root.PlanClientUI={state:()=>S,nutritionText,trainDaysOf,render};
})(typeof window!=='undefined'?window:globalThis);
