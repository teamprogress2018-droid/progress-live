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

  const S={edit:'',drag:null,cid:'',tab:'overview',choice:'komplet',form:'week',day:0,showAll:false,gen:{state:'idle',msg:'',error:null},modal:false};

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
    try{const x=dr.nutrition;const n=PC().buildNutrition(c,x.form||'week',{trainDays:trainDaysOf(c),variant:x.variant||0,habits:x.habits,mealShift:x.mealShift,prep:x.prep,people:x.people,delta:x.delta});
      // Zmiany trenera w posiłkach (DietView: edycja, zmiana składnika, zamiennik, kalorie, kopia na inny dzień).
      if(n&&n.ok&&n.week&&x.edits&&root.DietView){root.DietView.applyEdits(n.week,x.edits);n.shopping=n.week.shopping;}
      if(n)n.note=x.clientNote||'';
      return n;}
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
      rows.push(['Trening',p?`${(p.days||[]).length} × ${p.sessionDuration||'?'} min · ${esc(p.method||p.planName||'')}${dr.edits?' · zmiany trenera: '+dr.edits:''}`:(S.gen.state==='running'?'w przygotowaniu…':'brak szkicu treningu')]);
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
      const ex=(d.exercises||[]).map((e,j)=>exHTML(e,i,j,(d.exercises||[]).length)).join('');
      return`<section class="pk-card pk-day" data-pk-day="${i}"><div class="pk-head"><h3 class="pk-h3">${esc(d.dayName||'Dzień '+(i+1))}</h3><span class="pk-muted">${esc(p.sessionDuration?p.sessionDuration+' min':'')}</span></div>${d.focus?`<div class="pk-muted">${esc(d.focus)}</div>`:''}${wu?`<div class="pk-lbl">Rozgrzewka</div><ul class="pk-list">${wu}</ul>`:''}<div class="pk-lbl">Ćwiczenia</div><ol class="pk-exs" data-pk-exs="${i}" ondragover="event.preventDefault()" ondrop="pkExDrop(event,${i})">${ex}</ol><form class="pk-add" onsubmit="event.preventDefault();pkExAdd(${i})"><input class="form-input pk-in" id="pk-add-${i}" placeholder="Własne ćwiczenie" aria-label="Nazwa nowego ćwiczenia"><button type="submit" class="btn btn-ghost pk-btn">Dodaj</button></form></section>`;
    };
    const prog=[txt(p.periodization)].concat(p.progressionRules||[]).filter(Boolean);
    const rules=ruleIssues(p);
    const rulesHTML=rules.length?`<div class="pk-miss" data-pk-rules><b>Odbiega od Twoich zasad generatora:</b><ul class="pk-list">${rules.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>Przy publikacji aplikacja zapyta, czy zapisać mimo to.</div>`:'';
    return`<section class="pk-card"><div class="pk-head"><h2 class="pk-h2">${esc(p.planName||'Plan treningowy')}</h2><span class="pk-muted">${(p.days||[]).length} dni · ${esc(p.weeks||'?')} tyg.</span></div>${p.warmup?`<p class="pk-muted">Rozgrzewka ogólna: ${esc(p.warmup)}</p>`:''}${safety.length?`<div class="pk-miss"><b>Bezpieczeństwo:</b> ${safety.map(esc).join(' ')}</div>`:''}${rulesHTML}</section>${(p.days||[]).map(day).join('')}${prog.length?`<section class="pk-card"><h3 class="pk-h3">Progresja</h3><ul class="pk-list">${prog.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}`;
  }

  /** Te same zasady trenera co przy zapisie w generatorze (limit serii na ćwiczenie i na tydzień). */
  function ruleIssues(p){
    const W=root.GeneratorWorkbench;if(!W||!W.audit)return[];
    try{const r=W.rules(root.SETTINGS&&root.SETTINGS.generatorRules||{});const wk=Array.isArray(p.weekKeys)&&p.weekKeys.length?p.weekKeys:[undefined];
      return[...new Set([].concat(...wk.map(w=>W.audit(p,r,w).issues)))];}catch(e){return[];}
  }
  /* Edytor ćwiczenia: przeciąganie (komputer) albo strzałki (telefon), zamiana jednym kliknięciem, serie ±, edycja, usuwanie. */
  function exHTML(e,i,j,n){
    const id=i+'-'+j;
    if(S.edit===id){
      const f=(k,l,ph)=>`<label class="pk-ef"><span class="pk-lbl">${l}</span><input class="form-input pk-in" data-pk-ef="${k}" value="${esc(e[k]||'')}" placeholder="${esc(ph||'')}"></label>`;
      return`<li class="pk-ex is-edit" data-pk-ex="${id}"><div class="pk-ef-grid">${f('name','Ćwiczenie')}${f('sets','Serie','3')}${f('reps','Powtórzenia','8-10')}${f('rir','Zapas powtórzeń (RIR)','2')}${f('rest','Przerwa','90s')}${f('notes','Technika')}${f('alt','Zamiennik')}</div><div class="pk-actions"><button type="button" class="btn btn-ghost pk-btn pk-btn-strong" onclick="pkExSave(${i},${j})">Zapisz</button><button type="button" class="btn btn-ghost pk-btn" onclick="pkExCancel()">Anuluj</button></div></li>`;
    }
    const b=(lbl,fn,dis,cls)=>`<button type="button" class="pk-ib${cls?' '+cls:''}" aria-label="${lbl}" title="${lbl}" onclick="${fn}"${dis?' disabled':''}>`;
    return`<li class="pk-ex" data-pk-ex="${id}" draggable="true" ondragstart="pkExDrag(event,${i},${j})"><div class="pk-ex-top"><span class="pk-grip" aria-hidden="true">⋮⋮</span><div class="pk-ex-name">${j+1}. ${esc(e.name)}${e.custom?' <span class="pk-tag">własne</span>':''}</div></div>`+
      `<div class="pk-ex-meta"><span class="pk-sets">${b('Mniej serii',`pkExSets(${i},${j},-1)`,(parseInt(e.sets,10)||0)<=1)}−</button><b>${esc(e.sets||'?')}</b> × ${esc(e.reps||'?')}${b('Więcej serii',`pkExSets(${i},${j},1)`,(parseInt(e.sets,10)||0)>=10)}+</button></span>${e.rir?`<span>RIR ${esc(e.rir)}</span>`:''}${e.rpe?`<span>RPE ${esc(e.rpe)}</span>`:''}${e.rest?`<span>przerwa ${esc(e.rest)}</span>`:''}${e.tempo?`<span>tempo ${esc(e.tempo)}</span>`:''}</div>`+
      `${e.notes?`<div class="pk-ex-note">Technika: ${esc(e.notes)}</div>`:''}${e.alt?`<div class="pk-ex-note">Zamiennik: ${esc(e.alt)}</div>`:''}`+
      `<div class="pk-ex-acts">${b('Wyżej',`pkExMove(${i},${j},-1)`,j===0)}↑</button>${b('Niżej',`pkExMove(${i},${j},1)`,j===n-1)}↓</button>${e.alt?`<button type="button" class="pk-tb" data-pk-swap onclick="pkExSwap(${i},${j})">Zamień na zamiennik</button>`:''}<button type="button" class="pk-tb" onclick="pkExEdit(${i},${j})">Edytuj</button><button type="button" class="pk-tb pk-tb-del" onclick="pkExDel(${i},${j})">Usuń</button></div></li>`;
  }
  /** Zmiana treningu w szkicu: po edycji plan trzeba opublikować ponownie. Tygodnie progresji liczone od nowa. */
  function editTraining(fn,msg){
    const c=clientById(S.cid),dr=draftOf(c);if(!dr||!dr.training)return;
    const p=dr.training;
    const touched=fn(p);
    (touched||[]).forEach(ex=>{if(ex&&p.weekKeys&&typeof root.aplComputeProgression==='function'){try{root.aplComputeProgression(ex,p.weekKeys,p.phases||{},p.progression||'linear');}catch(e){}}});
    dr.trainingPublished=false;dr.updatedAt=now();
    if(dr.status==='opublikowany'){dr.status='szkic';}
    dr.edits=(dr.edits||0)+1;
    save(c);render();if(msg)say(msg);
  }
  const exAt=(p,i,j)=>((p.days||[])[i]||{}).exercises&&p.days[i].exercises[j];
  function exMove(i,j,dir){editTraining(p=>{const a=p.days[i].exercises,k=j+dir;if(k<0||k>=a.length)return;const x=a.splice(j,1)[0];a.splice(k,0,x);});}
  function exDrag(ev,i,j){S.drag={i,j};try{ev.dataTransfer.setData('text/plain',i+'-'+j);ev.dataTransfer.effectAllowed='move';}catch(e){}}
  function exDrop(ev,i){
    ev.preventDefault();const from=S.drag;S.drag=null;if(!from||from.i!==i)return;
    const li=ev.target&&ev.target.closest?ev.target.closest('[data-pk-ex]'):null;
    const to=li?parseInt(li.dataset.pkEx.split('-')[1],10):Infinity;
    editTraining(p=>{const a=p.days[i].exercises;const x=a.splice(from.j,1)[0];a.splice(Math.min(to,a.length),0,x);});
  }
  function exSets(i,j,d){editTraining(p=>{const e=exAt(p,i,j);if(!e)return;const n=Math.min(10,Math.max(1,(parseInt(e.sets,10)||3)+d));e.sets=String(n);return[e];});}
  function exSwap(i,j){editTraining(p=>{const e=exAt(p,i,j);if(!e||!e.alt)return;const old=e.name;e.name=e.alt;e.alt=old;e.swapped=!e.swapped;return[e];},'Ćwiczenie zamienione');}
  function exDel(i,j){editTraining(p=>{p.days[i].exercises.splice(j,1);},'Ćwiczenie usunięte');}
  function exAdd(i){
    const el=doc().getElementById('pk-add-'+i);const name=txt(el&&el.value);
    if(!name){say('Wpisz nazwę ćwiczenia');return;}
    editTraining(p=>{const e={name,sets:'3',reps:'10-12',rest:'90s',rir:'2',notes:'',custom:true};(p.days[i].exercises=p.days[i].exercises||[]).push(e);return[e];},'Ćwiczenie dodane');
  }
  function exSave(i,j){
    const li=doc().querySelector('[data-pk-ex="'+i+'-'+j+'"]');if(!li)return;
    const v={};li.querySelectorAll('[data-pk-ef]').forEach(x=>{v[x.dataset.pkEf]=txt(x.value);});
    if(!v.name){say('Ćwiczenie musi mieć nazwę');return;}
    S.edit='';
    editTraining(p=>{const e=exAt(p,i,j);if(!e)return;Object.assign(e,v);return[e];},'Zmiany zapisane w szkicu');
  }

  function itemsHTML(items){
    return`<ul class="pk-items">${(items||[]).map(it=>{const f=food(it.id),h=PC().homePortion(it.id,it.amount);const sw=(it.swaps||[]).slice(0,2).map(s=>esc(food(s.id).name.toLowerCase())+' '+fmtAmount(food(s.id),s.amount)).join(', ');
      return`<li><span>${esc(f.name)}</span><span class="pk-amt">${fmtAmount(f,it.amount)}${h?` <span class="pk-muted">(${esc(h)})</span>`:''}</span>${sw?`<div class="pk-muted pk-sw">albo: ${sw}</div>`:''}</li>`;}).join('')}</ul>`;
  }
  function mealHTML(m,act){
    return`<div class="pk-meal"><div class="pk-meal-h"><b>${esc(m.name)}</b>${m.dish?` · ${esc(m.dish)}`:''}<span class="pk-muted"> ~${r(m.total.kcal)} kcal · B ${r(m.total.p)} g</span>${m.swapped?' <span class="pk-tag">zmieniony</span>':''}</div>${itemsHTML(m.items)}${act||''}</div>`;
  }
  /** Zmiany odżywiania w szkicu: forma, zamiana posiłku, inny zestaw, nawyki, gotowanie na zapas, osoby. Cel kcal się nie zmienia. */
  function editNutrition(fn,msg){
    const c=clientById(S.cid),dr=draftOf(c);if(!dr||!dr.nutrition)return;
    fn(dr.nutrition);dr.updatedAt=now();if(dr.status==='opublikowany')dr.status='szkic';
    save(c);render();if(msg)say(msg);
  }
  const OPT=(lbl,list,cur,fn)=>`<div class="pk-lbl">${lbl}</div><div class="pk-chips">${list.map(([v,l])=>`<button type="button" class="pk-chip${String(cur)===String(v)?' is-on':''}" aria-pressed="${String(cur)===String(v)}" onclick="${fn}(${v})">${l}</button>`).join('')}</div>`;
  function targetsHTML(n){
    const t=n.targets;
    return`<div class="pk-targets" data-pk-targets><div><b>${n.kcal}</b><span>kcal dziennie</span></div><div><b>${t.protein.g} g</b><span>białko</span></div><div><b>${t.fat.g} g</b><span>tłuszcz</span></div><div><b>${t.carbs.g} g</b><span>węglowodany</span></div><div><b>${n.meals}</b><span>posiłki</span></div><div><b>${String(n.water[0]).replace('.',',')}–${String(n.water[1]).replace('.',',')} l</b><span>woda</span></div></div>`;
  }
  /** Widok planu dla klienta (DietView) w trybie trenera: ten sam wygląd, co u klienta, plus akcje edycji. */
  function dietVM(c,n){
    return root.DietView.fromBuilt(n.targets,n.week,{client:c.name||'',goalKey:n.goalKey,delta:n.delta,kcal:n.kcal,water:n.water,meals:n.meals,note:n.note,habit:(n.habits||[])[0],people:n.people});
  }
  function dietOpts(c){
    return{mode:'trainer',day:S.day,onDay:i=>{S.day=i;},
      onEdit:(key,snap)=>editNutrition(x=>{x.edits=Object.assign({},x.edits);if(snap)x.edits[key]=snap;else delete x.edits[key];},snap?'Posiłek zapisany w szkicu':'Posiłek wrócił do wersji z automatu'),
      onSwapMeal:(d,mi)=>root.pkMealSwap(d,mi),
      onNote:v=>editNutrition(x=>{x.clientNote=v;},'Notatka zapisana w szkicu'),
      onShop:()=>{},
      onSend:()=>{S.tab='overview';render();const b=doc().getElementById('pk-reviewed')||doc().getElementById('pk-publish');if(b&&b.scrollIntoView)b.scrollIntoView({block:'center'});say('Zaznacz „Szkic sprawdzony” i opublikuj plan. Klient dostanie wiadomość.');}};
  }
  function nutritionHTML(c,dr){
    const g=PC().healthGate(c);
    if(g.stop)return`<section class="pk-card pk-stop"><h2 class="pk-h2">${esc(g.message)}</h2><p class="pk-muted">Odżywianie dla tego klienta ułoży lekarz albo dietetyk kliniczny.</p></section>`;
    if(!dr||!dr.nutrition)return emptyTab('Brak szkicu odżywiania','Wybierz „Ułóż odżywianie” albo „Ułóż komplet” w przeglądzie.');
    const n=nutritionOf(c,dr);
    if(!n||!n.ok)return`<section class="pk-card"><h2 class="pk-h2">Brakuje danych do obliczenia celu</h2><p class="pk-muted">Potrzebne: ${esc((n&&n.missing||[]).join(', ')||'dane klienta')}.</p><button type="button" class="btn btn-ghost btn-sm pk-btn" onclick="pkOpenInterview()">Uzupełnij wywiad</button></section>`;
    const forms=`<div class="pk-chips" role="group" aria-label="Forma odżywiania">${FORMS.map(f=>`<button type="button" class="pk-chip${n.form===f.v?' is-on':''}" data-pk-nform="${f.v}" aria-pressed="${n.form===f.v}" onclick="pkSetNutritionForm('${f.v}')">${f.l}</button>`).join('')}</div>`;
    const head=`<section class="pk-card"><div class="pk-head"><h2 class="pk-h2">Odżywianie</h2><span class="pk-muted">orientacyjny cel</span></div>${forms}${n.form==='week'&&root.DietView?'':targetsHTML(n)}<p class="pk-muted">Cel liczony z masy ciała, wzrostu, wieku i aktywności${n.assumptions.length?' (z założeniami: '+esc(n.assumptions.join(', '))+')':''}. Do obserwacji i korekty po check-inach.</p></section>`;
    let body='';
    if(n.form==='habits'){
      body=`<section class="pk-card" data-pk-habits><h3 class="pk-h3">3 nawyki na start</h3><p class="pk-muted">Klient dostaje cel i nawyki bez rozpisanych posiłków. Lista zakupów to produkty bazowe na tydzień. Nawyki możesz zmienić.</p><ol class="pk-habits">${[0,1,2].map(i=>`<li><input class="form-input pk-in" data-pk-habit="${i}" value="${esc(n.habits[i]||'')}" aria-label="Nawyk ${i+1}"></li>`).join('')}</ol><div class="pk-actions"><button type="button" class="btn btn-ghost pk-btn" onclick="pkSaveHabits()">Zapisz nawyki</button><button type="button" class="pk-link" onclick="pkResetHabits()">Przywróć domyślne</button></div></section>`;
    }else if(n.form==='flex'){
      body=Object.keys(n.flex).map(slot=>`<section class="pk-card" data-pk-slot="${esc(slot)}"><h3 class="pk-h3">${esc(slot)}</h3><div class="pk-muted">Do wyboru, podobna kaloryczność</div><div class="pk-opts">${n.flex[slot].map((m,i)=>`<div class="pk-opt"><div class="pk-lbl">Propozycja ${i+1}</div>${mealHTML(m)}</div>`).join('')}</div></section>`).join('');
    }else{
      const w=n.week,di=Math.min(S.day,w.days.length-1),d=w.days[di];
      const td=trainDaysOf(c);
      const days=`<div class="pk-chips pk-days" role="group" aria-label="Dzień">${w.days.map((x,i)=>`<button type="button" class="pk-chip${i===di?' is-on':''}" data-pk-wday="${i}" aria-pressed="${i===di}" onclick="pkDay(${i})">${WD[i]||i+1}${td.includes((i+1)%7)?' ·':''}</button>`).join('')}</div><div class="pk-muted">Kropka = dzień treningowy.</div>`;
      const cook=w.cooking&&w.cooking.length?`<section class="pk-card"><h3 class="pk-h3">Gotowanie na zapas</h3><ul class="pk-list">${w.cooking.map(b=>`<li><b>${esc(b.days[0])}</b>${b.days.length>1?' (na: '+esc(b.days.join(', '))+')':''}: ${b.items.map(it=>esc(food(it.id).name.toLowerCase())+' '+fmtShop(food(it.id),it.amount)).join(', ')}</li>`).join('')}</ul></section>`:'';
      const warn=(w.warnings||[]).length?`<div class="pk-miss">${w.warnings.map(esc).join('<br>')}</div>`:'';

      const opts=`<section class="pk-card" data-pk-week-opts><h3 class="pk-h3">Ustawienia jadłospisu</h3>${OPT('Gotowanie obiadów na zapas',[[0,'Nie'],[2,'Na 2 dni'],[3,'Na 3 dni']],n.prep>1?n.prep:0,'pkPrep')}${OPT('Lista zakupów dla',[[1,'1 osoby'],[2,'2 osób'],[3,'3 osób'],[4,'4 osób']],n.people||1,'pkPeople')}<div class="pk-actions"><button type="button" class="btn btn-ghost pk-btn" data-pk-variant onclick="pkVariant()">Inny jadłospis na tydzień</button><button type="button" class="btn btn-ghost pk-btn" onclick="pkPdf()">Pobierz PDF</button></div><p class="pk-muted">Kalorie i makro zostają te same. Zmienia się tylko dobór posiłków.</p></section>`;
      body=root.DietView?`${warn?`<section class="pk-card">${warn}</section>`:''}<section class="pk-dpv" data-pk-week>${root.DietView.render('pkdpv',dietVM(c,n),dietOpts(c))}</section>${cook}${opts}`
        :`<section class="pk-card" data-pk-week>${days}<h3 class="pk-h3">${esc(d.name)} · ~${r(d.total.kcal)} kcal</h3>${warn}${d.meals.map((m,mi)=>mealHTML(m,`<div class="pk-meal-acts"><button type="button" class="pk-tb" data-pk-mswap="${di}-${mi}" onclick="pkMealSwap(${di},${mi})">Inny posiłek</button></div>`)).join('')}</section>${cook}${opts}`;
    }
    return head+body;
  }
  function shoppingHTML(c,dr){
    if(PC().healthGate(c).stop)return emptyTab('Brak listy zakupów','Odżywianie dla tego klienta wymaga konsultacji z lekarzem lub dietetykiem klinicznym.');
    const n=dr&&dr.nutrition?nutritionOf(c,dr):null;
    if(!n||!n.ok)return emptyTab('Brak listy zakupów','Lista powstaje razem ze szkicem odżywiania.');
    const span=n.shopDays===7?'na tydzień':'na '+n.shopDays+' dni';
    const ppl=n.form==='week'&&n.people>1?' dla '+n.people+' osób':'';
    return`<section class="pk-card" data-pk-shopping><div class="pk-head"><h2 class="pk-h2">Lista zakupów ${span}${ppl}</h2><span class="pk-muted">${n.shopping.length} produktów</span></div><ul class="pk-shop">${n.shopping.map(s=>{const f=food(s.id),h0=PC().homePortion(s.id,s.amount),h=h0&&(parseFloat(h0.replace(/^ok\. /,''))||0)<=6?h0:'';return`<li><span>${esc(f.name)}</span><span class="pk-amt">${fmtShop(f,s.amount)}${h&&f.unit!=='szt'?` <span class="pk-muted">(${esc(h)})</span>`:''}</span></li>`;}).join('')}</ul><p class="pk-muted">Ilości orientacyjne. Produkty suche (ryż, makaron, płatki) liczone przed gotowaniem.</p><div class="pk-actions"><button type="button" class="btn btn-ghost pk-btn" data-pk-copy onclick="pkCopyShop()">Kopiuj listę</button></div></section>`;
  }
  function notesHTML(c,dr){
    return`<section class="pk-card"><h2 class="pk-h2">Notatki trenera</h2><p class="pk-muted">Widzisz je tylko Ty. Klient ich nie dostaje.</p><textarea class="form-input pk-notes" id="pk-notes" rows="8" placeholder="Np. klient woli trenować rano, w piątki krótszy trening">${esc(dr&&dr.notes||'')}</textarea><div class="pk-actions"><button type="button" class="btn btn-ghost pk-btn" onclick="pkSaveNotes()">Zapisz notatki</button></div></section>`;
  }
  const SCALES=[['mood','Nastrój'],['sleep','Sen'],['hunger','Głód'],['energy','Energia'],['nutrition','Jedzenie wg planu']];
  function reviewOf(c,dr){
    const n=dr.nutrition?nutritionOf(c,dr):null;
    return PC().progressReview(c,{since:dr.publishedAt,delta:n&&n.ok?n.delta:(dr.nutrition&&dr.nutrition.delta),plannedWorkouts:trainDaysOf(c).length});
  }
  function progressHTML(c,dr){
    if(!dr||!dr.publishedAt)return emptyTab('Postępy po publikacji','Po publikacji planu klient co tydzień wypełnia krótki check-in. Tu zobaczysz jego odpowiedzi i propozycję korekty do Twojej decyzji.');
    const rv=reviewOf(c,dr);
    if(!rv.checkins.length){
      const t=Date.parse(dr.publishedAt),next=isFinite(t)?new Date(t+7*86400000).toISOString():'';
      return`<section class="pk-card" data-pk-progress="empty"><h2 class="pk-h2">Postępy</h2><p class="pk-muted">Plan opublikowany ${esc(fmtDate(dr.publishedAt))}. Klient wypełni pierwszy check-in około ${esc(fmtDate(next))}.</p></section>`;
    }
    const decided=dr.decisions||{};
    const sug=rv.suggestions.filter(x=>!decided[x.id]);
    const sugHTML=sug.length?sug.map(x=>`<div class="pk-sug" data-pk-sug="${esc(x.kind)}"><b>${esc(x.title)}</b><p class="pk-muted">${esc(x.text)}</p><div class="pk-actions">${x.apply?`<button type="button" class="btn btn-ghost pk-btn pk-btn-strong" onclick="pkSugApply('${esc(x.id)}')">Wprowadź</button>`:''}<button type="button" class="btn btn-ghost pk-btn" onclick="pkSugManual('${esc(x.id)}')">Zmienię ręcznie</button><button type="button" class="btn btn-ghost pk-btn" onclick="pkSugReject('${esc(x.id)}')">Odrzuć</button></div></div>`).join(''):
      `<p class="pk-muted">${rv.enough?'Brak propozycji zmian. Plan bez korekty.':esc(rv.message||'Za mało danych na propozycję.')}</p>`;
    const done=Object.keys(decided).length?`<div class="pk-muted" data-pk-decisions>Twoje decyzje: ${Object.values(decided).slice(-3).map(d=>esc(d.title+' – '+({apply:'wprowadzone do szkicu',manual:'zmienisz ręcznie',reject:'odrzucone'}[d.action]||d.action))).join('; ')}.</div>`:'';
    const rows=rv.checkins.slice(-4).reverse().map(ci=>{const a=ci.answers;
      return`<div class="pk-ci" data-pk-ci="${esc(ci.date)}"><div class="pk-ci-h"><b>${esc(fmtDate(ci.date))}</b>${a.weight?`<span>${esc(a.weight)} kg</span>`:''}<span>treningi: ${esc(a.workouts!=null?a.workouts:'—')}</span></div><div class="pk-ex-meta">${SCALES.filter(([k])=>a[k]!=null).map(([k,l])=>`<span>${l} ${esc(a[k])}/5</span>`).join('')}</div>${a.hardest?`<div class="pk-ex-note"><b>Najtrudniejsze:</b> ${esc(a.hardest)}</div>`:''}${a.notes?`<div class="pk-ex-note">${esc(a.notes)}</div>`:''}</div>`;}).join('');
    return`<section class="pk-card" data-pk-progress><div class="pk-head"><h2 class="pk-h2">Propozycja korekty</h2><span class="pk-muted">do Twojej decyzji</span></div><p class="pk-muted">AI nic nie zmienia samo. „Wprowadź” zmienia tylko szkic, a klient dostaje zmianę po ponownej publikacji.</p>${sugHTML}${done}</section><section class="pk-card"><h2 class="pk-h2">Check-iny</h2>${rows}</section>`;
  }
  function sugFind(id){const c=clientById(S.cid),dr=draftOf(c);if(!dr)return{};return{c,dr,x:reviewOf(c,dr).suggestions.find(s=>s.id===id)};}
  function sugDecide(id,action){
    const {c,dr,x}=sugFind(id);if(!dr||!x)return null;
    dr.decisions=Object.assign({},dr.decisions);dr.decisions[id]={action,at:now(),title:x.title,kind:x.kind};
    return{c,dr,x};
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
        // Poprawiony plan zastępuje poprzednią wersję z tego ekranu: stara trafia do archiwum, żeby klient nie miał dwóch.
        const old=dr.trainingPlanId&&dr.trainingPlanId!==saved.id?(root.PL||[]).find(x=>x&&x.id===dr.trainingPlanId):null;
        if(old&&!old.archived){old.archived=true;old.archivedAt=now();old.replacedBy=saved.id;if(typeof root.persistById==='function')await root.persistById('plans',old);}
        dr.trainingPlanId=saved.id;dr.trainingPublished=true;
      }
      if(dr.nutrition){
        const n=nutritionOf(c,dr);
        if(!n||!n.ok)throw new Error('Brak danych do odżywiania');
        const at=now(),text=nutritionText(n),t=n.targets;
        const rec={status:'zatwierdzony',updatedAt:at,approvedAt:at,approvedBy:root._uid||null,source:'plan-klienta',form:n.form,
          kcal:t.kcal,protein:t.protein.g,fat:t.fat.g,carbs:t.carbs.g,days:n.form==='week'?7:1,meals:n.meals,prefs:n.prefs||null,text,plan:PC().publicPlan(n)};
        if(c.dietPlan&&c.dietPlan.status==='zatwierdzony')c.dietPlanHistory=[c.dietPlan].concat(c.dietPlanHistory||[]).slice(0,5);
        c.dietPlan=rec;c.dietDraft=null;
        if(typeof root.pushMsg==='function')root.pushMsg(c.id,text);
      }
      dr.status='opublikowany';dr.publishedAt=now();dr.updatedAt=dr.publishedAt;
      // Widoczne dla klienta: data publikacji (dodatkowe pytania w check-inie). Szkic zostaje prywatny.
      c.clientPlanPublished=dr.publishedAt;
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
    pkExMove:exMove,pkExDrag:exDrag,pkExDrop:exDrop,pkExSets:exSets,pkExSwap:exSwap,pkExDel:exDel,pkExAdd:exAdd,pkExSave:exSave,
    pkExEdit:(i,j)=>{S.edit=i+'-'+j;render();},pkExCancel:()=>{S.edit='';render();},
    pkMealSwap:(d,mi)=>editNutrition(x=>{const k=d+':'+mi;x.mealShift=Object.assign({},x.mealShift);x.mealShift[k]=(x.mealShift[k]||0)+1;if(x.edits&&x.edits[k]){x.edits=Object.assign({},x.edits);delete x.edits[k];}},'Posiłek zamieniony'),
    pkVariant:()=>editNutrition(x=>{x.variant=(x.variant||0)+7;x.mealShift={};x.edits={};},'Nowy jadłospis na tydzień'),
    pkPrep:v=>editNutrition(x=>{x.prep=v;}),
    pkPeople:v=>editNutrition(x=>{x.people=v;}),
    pkSaveHabits:()=>{const v=[...doc().querySelectorAll('[data-pk-habit]')].map(el=>txt(el.value)).filter(Boolean);if(!v.length){say('Wpisz przynajmniej jeden nawyk');return;}editNutrition(x=>{x.habits=v.slice(0,3);},'Nawyki zapisane');},
    pkResetHabits:()=>editNutrition(x=>{x.habits=PC().DEFAULT_HABITS.slice();}),
    pkPdf:()=>{const c=clientById(S.cid),n=nutritionOf(c,draftOf(c));if(!n||!n.week)return;if(root.DietView){root.DietView.preview(dietVM(c,n));return;}const base=String(root.location.href).split('#')[0].split('?')[0].replace(/[^/]*$/,'');
      const w=root.open('','_blank','width=860,height=900');if(!w){say('Zablokowano okno. Odblokuj wyskakujące okna, żeby pobrać PDF.');return;}
      w.document.open();w.document.write(DP().dietPlanPrintHTML(n.targets,n.week,{client:c.name||'',date:new Date().toLocaleDateString('pl-PL'),base}));w.document.close();try{w.opener=null;}catch(e){}},
    pkCopyShop:()=>{const c=clientById(S.cid),n=nutritionOf(c,draftOf(c));if(!n)return;const t='Lista zakupów:\n'+n.shopping.map(x=>'• '+food(x.id).name+' '+fmtShop(food(x.id),x.amount)).join('\n');
      S.lastCopy=t;const cb=root.navigator&&root.navigator.clipboard;(cb?cb.writeText(t):Promise.reject()).then(()=>say('Lista skopiowana'),()=>say('Nie udało się skopiować. Zaznacz listę ręcznie.'));},
    pkSugApply:id=>{const r0=sugDecide(id,'apply');if(!r0)return;const a=r0.x.apply||{};
      if(a.type==='kcal'){editNutrition(x=>{x.delta=a.delta;},'Zmiana kalorii w szkicu. Opublikuj, żeby klient ją dostał.');}
      else if(a.type==='sets'){editTraining(p=>{const t=[];(p.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>{const n=parseInt(e.sets,10)||3;if(n>2){e.sets=String(n+a.d);t.push(e);}}));return t;},'Lżejszy tydzień w szkicu. Opublikuj, żeby klient go dostał.');}
      else{save(r0.c);render();}},
    pkSugManual:id=>{const r0=sugDecide(id,'manual');if(!r0)return;save(r0.c);S.tab=r0.x.kind==='trening'?'training':'nutrition';render();},
    pkSugReject:id=>{const r0=sugDecide(id,'reject');if(!r0)return;save(r0.c);render();say('Propozycja odrzucona');},
    pkOnTrainingReady:onTrainingReady,pkOnTrainingError:onTrainingError,pkOnTrainingProgress:onTrainingProgress
  });
  root.PlanClientUI={state:()=>S,nutritionText,trainDaysOf,render};
})(typeof window!=='undefined'?window:globalThis);
