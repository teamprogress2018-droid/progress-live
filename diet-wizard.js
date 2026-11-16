/* Kalkulator → jadłospis: prosty kreator w 4 krokach, kontrola jakości przed wysłaniem, „Dlaczego taki plan?”,
   podgląd klienta, PDF i lista zakupów. Obliczenia (BMR, TDEE, kcal, makro, dzień treningowy / wolny, dobór posiłków)
   zostają w 07-forms-metrics-calculator.js i diet-plan.js bez zmian; tu jest tylko sposób pokazania i ustawienia.
   Stan kreatora: window.dietWiz (zapisywany w client.dietPlan.wizard przy „Zapisz w profilu” i wysyłce). */
(function(root){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const DP=()=>root.DietPlan;
  const DV=()=>root.DietView;
  const r=v=>Math.round(v||0);
  const recalc=()=>{if(typeof root.calcTDEE==='function')root.calcTDEE();};

  const FRESH=()=>({step:1,generated:false,times:[],medical:'',budget:'',lunchbox:null,other:'',exChecked:false,timeSet:false,prepSet:false,noSkip:false,noLike:false,edits:{},clientId:''});
  const W=root.dietWiz=root.dietWiz||FRESH();

  const STEPS=['Cel i rytm dnia','Alergie i wykluczenia','Styl życia','Podsumowanie'];
  // Alergie i wykluczenia w kolejności z kreatora. „Orzechy” obejmują też orzeszki ziemne.
  const EX_UI=[['gluten','Gluten'],['mleko','Mleko i nabiał'],['jaja','Jaja'],['ryby','Ryby'],['orzechy','Orzechy'],['soja','Soja'],['sezam','Sezam'],['mieso','Mięso'],['pieczywo','Pieczywo']];
  const EX_IDS={orzechy:['orzechy','orzeszki']};
  const GOALS=[[-500,'Agresywna redukcja'],[-300,'Łagodna redukcja'],[0,'Utrzymanie'],[300,'Łagodna masa'],[500,'Agresywna masa']];
  const goalLabel=d=>(GOALS.find(g=>g[0]===d)||[0,d<0?'Redukcja':d>0?'Masa':'Utrzymanie'])[1];
  const DEFAULT_TIMES={3:['8:00','13:00','19:00'],4:['7:30','12:00','16:00','19:30'],5:['7:30','10:30','13:30','16:30','19:30'],6:['7:00','9:30','12:30','15:00','17:30','20:00']};
  const MEDICAL_WARN='Nie generuj automatycznie gotowego jadłospisu. Przygotuj wyłącznie ogólne wskazówki i skieruj klienta do lekarza lub dietetyka klinicznego.';

  const g=(name,def)=>typeof root[name]!=='undefined'?root[name]:def;
  const prefs=()=>g('dietPrefs',{style:'wszystko',ex:[],skip:[],like:[],maxMin:0,col:[]});
  const meals=()=>g('dietMeals',5);
  const client=()=>typeof root.dietCalcClient==='function'?root.dietCalcClient():null;
  function times(){const n=meals();const t=(W.times||[]).slice(0,n);const d=DEFAULT_TIMES[n]||DEFAULT_TIMES[5];while(t.length<n)t.push(d[t.length]);return t;}

  /** Preferencje do generatora: wybór z kreatora + budżet ekonomiczny i lunchbox jako zestawy dań z e-booków. */
  function effectivePrefs(p){
    p=p||prefs();
    const col=(p.col||[]).slice();
    if(W.budget==='eko')['biedra','lidl'].forEach(c=>{if(!col.includes(c))col.push(c);});
    if(W.lunchbox===true&&!col.includes('lunchbox'))col.push('lunchbox');
    return Object.assign({},p,{col});
  }
  // Nowy klient w kalkulatorze = nowy kreator (bez zmian z poprzedniego klienta). Zapisany stan klienta wraca.
  function syncClient(){
    const c=client(),id=c&&c.id||'';
    if(W.clientId===id)return;
    const saved=c&&c.dietPlan&&c.dietPlan.wizard;
    Object.assign(W,FRESH(),saved&&typeof saved==='object'?saved:{},{clientId:id,edits:saved&&saved.edits||{},generated:!!(saved&&saved.generated)});
    if(!saved&&c&&root.PlanClient){
      const iv=root.PlanClient.interviewOf?root.PlanClient.interviewOf(c):{};
      if(iv.cookingTime)W.timeSet=true;
      if(iv.mealPrep)W.prepSet=true;
      if(iv.foodExclusions&&iv.foodExclusions.length)W.exChecked=true;
    }
  }

  /* ───────── Kompletność danych ───────── */
  function completeness(ctx){
    const p=prefs(),c=client();
    const items=[
      ['cel klienta',!!(c&&c.goal)],
      ['dni treningowe',!!(ctx&&ctx.td&&ctx.td.fromClient)],
      ['pory posiłków',(W.times||[]).length>0],
      ['alergie i wykluczenia',W.exChecked||p.ex.length>0||!!W.other],
      ['choroby i leki',W.medical!==''],
      ['czas na przygotowanie',W.timeSet],
      ['budżet',!!W.budget],
      ['gotowanie i lunchbox',W.prepSet&&W.lunchbox!==null],
      ['produkty lubiane',p.like.length>0||W.noLike],
      ['produkty nielubiane',p.skip.length>0||W.noSkip]
    ];
    const ok=items.filter(x=>x[1]).length;
    const miss=items.filter(x=>!x[1]).map(x=>x[0]);
    return{pct:Math.round(ok/items.length*100),miss};
  }

  /* ───────── Kroki ───────── */
  const chip=(on,click,label,attr)=>`<button type="button" class="dg-chip${on?' is-on':''}" aria-pressed="${on}" onclick="${click}"${attr||''}>${esc(label)}</button>`;
  const row=(label,body,hint)=>`<div class="dg-row"><div class="dg-lbl">${label}</div><div class="dg-chips">${body}</div>${hint?`<div class="dg-hint">${hint}</div>`:''}</div>`;
  function stepper(){
    return`<ol class="dg-steps" aria-label="Kroki kreatora">${STEPS.map((l,i)=>{const n=i+1,cur=!W.generated&&W.step===n,done=W.generated||W.step>n;return`<li class="dg-step${cur?' is-cur':''}${done?' is-done':''}"><button type="button" onclick="dgGo(${n})" aria-current="${cur?'step':'false'}"><span class="dg-num">${done&&!cur?'✓':n}</span><span class="dg-sl">${l}</span></button></li>`;}).join('')}</ol>`;
  }
  function step1(ctx){
    const p=prefs(),td=ctx.td,delta=g('calcGoalDelta',0),dt=g('dietDayType','trening');
    const WEEK=[[1,'Pon'],[2,'Wt'],[3,'Śr'],[4,'Czw'],[5,'Pt'],[6,'Sob'],[0,'Nd']];
    const c=client();
    return row('Cel klienta',GOALS.map(([v,l])=>chip(delta===v,`dgGoal(${v})`,l)).join(''),c&&c.goal?'Z profilu klienta: '+esc(c.goal)+'. Kalorie liczą się z danych po lewej.':'Kalorie liczą się z danych po lewej.')+
      row('Dzień w jadłospisie',chip(dt==='trening','dietSetDayType(\'trening\')','Dzień treningowy')+chip(dt==='wolny','dietSetDayType(\'wolny\')','Dzień wolny'),ctx.rest&&ctx.rest.same?'Przy tej aktywności dzień treningowy i wolny mają te same kalorie.':'Dzień wolny ma mniej węglowodanów, białko zostaje.')+
      row('Dni treningowe w tygodniu',WEEK.map(([d,l])=>chip(td.days.includes(d),`dietToggleTrainDay(${d})`,l)).join(''),td.fromClient?'Z profilu klienta.':'Domyślnie pon / śr / pt.')+
      row('Liczba posiłków',[3,4,5,6].map(k=>chip(meals()===k,`dgMeals(${k})`,k+' posiłki')).join(''))+
      `<div class="dg-row"><div class="dg-lbl">Pory posiłków (orientacyjnie)</div><div class="dg-times">${times().map((t,i)=>`<label class="dg-time"><span>${i+1}.</span><input type="time" class="dg-input" value="${esc(t.padStart(5,'0'))}" data-dg-time="${i}" onchange="dgTime(${i},this.value)" aria-label="Pora posiłku ${i+1}"></label>`).join('')}</div></div>`+
      row('Szybkość przygotowania',[[15,'do 15 min'],[30,'do 30 min'],[0,'dowolnie']].map(([v,l])=>chip(W.timeSet&&p.maxMin===v,`dgMaxMin(${v})`,l)).join(''));
  }
  function step2(){
    const p=prefs();
    const on=id=>(EX_IDS[id]||[id]).every(x=>p.ex.includes(x));
    const any=EX_UI.some(([id])=>on(id))||!!W.other;
    const status=any?`Wykluczenia: ${EX_UI.filter(([id])=>on(id)).map(x=>x[1].toLowerCase()).concat(W.other?[W.other]:[]).map(esc).join(', ')}`:'Brak zgłoszonych alergii i wykluczeń';
    const styles=DP()?Object.keys(DP().DIET_STYLES):[];
    return`<div class="dg-status${any?' is-set':''}" data-dg-exstatus>${status}</div>`+
      row('Alergie i wykluczenia',EX_UI.map(([id,l])=>chip(on(id),`dgEx('${id}')`,l)).join(''),'Przy alergii zawsze sprawdzaj etykietę produktu.')+
      `<div class="dg-row"><label class="dg-lbl" for="dg-other">Inne (wpisz)</label><input class="dg-input" id="dg-other" value="${esc(W.other)}" placeholder="np. seler, kiwi" onchange="dgOther(this.value)"><div class="dg-hint">Wpisanych ręcznie wykluczeń aplikacja nie rozpoznaje w produktach. Sprawdzisz je w kontroli jakości.</div></div>`+
      (styles.length?row('Sposób żywienia',styles.map(k=>chip(p.style===k,`dgStyle('${k}')`,DP().DIET_STYLES[k].label)).join('')):'')+
      `<div class="dg-row"><div class="dg-lbl">Czy są choroby, leki lub zalecenia lekarza, które wymagają konsultacji z dietetykiem?</div><div class="dg-chips">${chip(W.medical==='nie','dgMedical(\'nie\')','Nie')}${chip(W.medical==='tak','dgMedical(\'tak\')','Tak')}</div></div>`+
      (W.medical==='tak'?`<div class="dg-warn" role="alert" data-dg-medical>${MEDICAL_WARN}</div>`:'')+
      (!any&&!W.exChecked?`<button type="button" class="dg-link" onclick="dgNoEx()">Potwierdzam: klient nie ma alergii ani wykluczeń</button>`:'');
  }
  function foodPicker(kind){
    const p=prefs(),D=DP();if(!D)return'';
    const list=kind==='like'?p.like:p.skip;
    const groups=[['Mięso i ryby',['mieso','wedlina','ryby']],['Nabiał',['nabial','ser']],['Rośliny białkowe',['roslinne']],['Pieczywo, płatki, kasze',['zboza','skrobia']],['Tłuszcze i orzechy',['orzechy','nasiona','oleje','pasty']],['Owoce',['owoce']],['Warzywa',['warzywa']],['Inne',['dodatki']]];
    const fn=kind==='like'?'dgLike':'dgSkip';
    const other=kind==='like'?p.skip:p.like;
    return groups.map(([l,subs])=>{const fs=D.DIET_FOODS.filter(f=>subs.includes(f.sub)&&!other.includes(f.id));return fs.length?`<div class="dg-fgroup"><div class="dg-hint">${l}</div><div class="dg-chips">${fs.map(f=>chip(list.includes(f.id),`${fn}('${f.id}')`,f.name.replace(/\s*\((surow[aey]?|such[aye]?|odsączony|ugotowan[aey])\)$/i,''))).join('')}</div></div>`:'';}).join('');
  }
  function step3(){
    const p=prefs();
    return row('Budżet',[['eko','Ekonomiczny'],['standard','Standard'],['bez','Bez ograniczeń']].map(([v,l])=>chip(W.budget===v,`dgBudget('${v}')`,l)).join(''),W.budget==='eko'?'Częściej dania z jadłospisów z Biedronki i Lidla.':'')+
      row('Czas na przygotowanie',[[15,'do 15 min'],[30,'do 30 min'],[0,'dowolnie']].map(([v,l])=>chip(W.timeSet&&p.maxMin===v,`dgMaxMin(${v})`,l)).join(''))+
      row('Gotowanie',[[0,'codziennie'],[2,'na 2 dni'],[3,'na 3 dni']].map(([v,l])=>chip(W.prepSet&&g('dietPrep',0)===v,`dgPrep(${v})`,l)).join(''),'Na 2–3 dni = ten sam obiad przez kolejne dni (widok kilku dni).')+
      row('Lista zakupów dla',[1,2,3,4].map(n=>chip(g('dietPeople',1)===n,`dietSetPeople(${n})`,n===1?'1 osoby':n+' osób')).join(''))+
      row('Lunchbox do pracy',chip(W.lunchbox===true,'dgLunch(true)','Tak')+chip(W.lunchbox===false,'dgLunch(false)','Nie'))+
      `<details class="dg-more"${p.like.length?' open':''}><summary>Produkty lubiane${p.like.length?' ('+p.like.length+')':''}</summary>${foodPicker('like')}<label class="dg-check"><input type="checkbox"${W.noLike?' checked':''} onchange="dgFlag('noLike',this.checked)"> Klient nie ma ulubionych produktów</label></details>`+
      `<details class="dg-more"${p.skip.length?' open':''}><summary>Produkty nielubiane${p.skip.length?' ('+p.skip.length+')':''}</summary>${foodPicker('skip')}<label class="dg-check"><input type="checkbox"${W.noSkip?' checked':''} onchange="dgFlag('noSkip',this.checked)"> Klient je wszystko</label></details>`+
      (DP()?`<details class="dg-more"><summary>Rodzaj dań z e-booków${p.col.length?' ('+p.col.length+')':''}</summary><div class="dg-chips">${chip(!p.col.length,'dietClearCol()','Wszystkie')}${DP().DIET_COLLECTIONS.map(c=>chip(p.col.includes(c.id),`dietToggleCol('${c.id}')`,c.label)).join('')}</div></details>`:'');
  }
  function summaryRows(ctx){
    const p=prefs(),delta=g('calcGoalDelta',0);
    const exl=EX_UI.filter(([id])=>(EX_IDS[id]||[id]).every(x=>p.ex.includes(x))).map(x=>x[1].toLowerCase()).concat(W.other?[W.other]:[]);
    return[['Cel',goalLabel(delta)+' · '+r(ctx.t.kcal)+' kcal · białko '+ctx.t.protein.g+' g'],
      ['Posiłki',meals()+' dziennie · ok. '+times().join(', ')],
      ['Dzień',g('dietDayType','trening')==='wolny'?'wolny':'treningowy'],
      ['Alergie i wykluczenia',exl.length?exl.join(', '):'brak zgłoszonych'],
      ['Choroby i leki',W.medical==='tak'?'tak, wymaga konsultacji':W.medical==='nie'?'nie':'brak odpowiedzi'],
      ['Czas',W.timeSet?(p.maxMin?'do '+p.maxMin+' min':'dowolnie'):'brak odpowiedzi'],
      ['Budżet',{eko:'ekonomiczny',standard:'standard',bez:'bez ograniczeń'}[W.budget]||'brak odpowiedzi'],
      ['Gotowanie',W.prepSet?({0:'codziennie',2:'na 2 dni',3:'na 3 dni'}[g('dietPrep',0)]||'codziennie'):'brak odpowiedzi'],
      ['Lunchbox',W.lunchbox===true?'tak':W.lunchbox===false?'nie':'brak odpowiedzi'],
      ['Lubi / nie lubi',(p.like.length||0)+' / '+(p.skip.length||0)+' produktów']];
  }
  function step4(ctx){
    const cp=completeness(ctx);
    const med=W.medical==='tak';
    return`<dl class="dg-sum">${summaryRows(ctx).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="dg-fit" data-dg-fit="${cp.pct}"><div class="dg-fit-bar"><span style="width:${cp.pct}%"></span></div><div><b>Dopasowanie planu: ${cp.pct}%.</b> ${cp.miss.length?'Brakuje informacji o: '+esc(cp.miss.join(', '))+'.':'Mamy wszystkie potrzebne informacje.'}</div></div>
      ${med?`<div class="dg-warn" role="alert">${MEDICAL_WARN}</div>${generalTipsHTML(ctx)}`:''}`;
  }
  function generalTipsHTML(ctx){
    const hab=root.PlanClient&&root.PlanClient.DEFAULT_HABITS||['Białko w każdym posiłku','Pół talerza warzyw do obiadu i kolacji','Woda: butelka zawsze pod ręką'];
    return`<section class="dg-card" data-dg-general><h4 class="dg-h4">Ogólne wskazówki dla klienta</h4><ul><li>Orientacyjnie ok. ${r(ctx.t.kcal)} kcal i ${ctx.t.protein.g} g białka dziennie (do potwierdzenia z lekarzem lub dietetykiem).</li>${hab.map(h=>`<li>${esc(h)}</li>`).join('')}<li>${meals()} posiłków w stałych porach.</li></ul><p class="dg-hint">Przy chorobach i lekach jadłospis układa lekarz albo dietetyk kliniczny.</p></section>`;
  }

  /* ───────── Kontrola jakości ───────── */
  function qualityChecks(ctx){
    const t=ctx.shown,day=ctx.day,p=effectivePrefs(),out=[];
    const days=day.days||[day];
    const off=days.filter(d=>Math.abs((d.diffKcal!=null?d.diffKcal:r(d.total.kcal-(d.kcalTarget||t.kcal))))>Math.max(60,(d.kcalTarget||t.kcal)*0.05));
    out.push(off.length?{ok:false,text:'Kalorie odbiegają od celu o ponad 5%: '+off.map(d=>d.name||'dzień').join(', ')+'.'}:{ok:true,text:'Kalorie mieszczą się w wybranym celu.'});
    const pOff=days.filter(d=>Math.abs(d.total.p-t.protein.g)>t.protein.g*0.1);
    out.push(pOff.length?{ok:false,text:'Białko odbiega od celu o ponad 10%: '+pOff.map(d=>(d.name||'dzień')+' '+r(d.total.p)+' g').join(', ')+'.'}:{ok:true,text:'Białko jest zgodne z celem klienta ('+t.protein.g+' g).'});
    out.push(days.every(d=>d.meals.length===meals())?{ok:true,text:'Liczba posiłków pasuje do ustawień ('+meals()+').'}:{ok:false,text:'Liczba posiłków nie zgadza się z ustawieniem.'});
    const D=DP();
    if(D&&D.dietAllow){
      const allow=D.dietAllow(D.dietPrefsNorm(p)),F={};D.DIET_FOODS.forEach(f=>{F[f.id]=f;});
      const bad=new Set();days.forEach(d=>d.meals.forEach(m=>(m.items||[]).forEach(it=>{if(!allow(F[it.id]))bad.add(F[it.id]?F[it.id].name:it.id);})));
      out.push(bad.size?{ok:false,text:'W planie są produkty z wykluczeń: '+[...bad].join(', ')+'. Zmień je ręcznie.'}:{ok:true,text:p.ex.length||p.skip.length?'Uwzględniono wykluczenia i produkty, których klient nie je.':'Uwzględniono wykluczenia (klient nie zgłosił żadnych).'});
    }
    if(W.other)out.push({ok:false,text:'Wykluczenie wpisane ręcznie („'+W.other+'”). Sprawdź posiłki samodzielnie.'});
    const cp=completeness(ctx);
    const mdata=cp.miss.filter(x=>['alergie i wykluczenia','produkty lubiane','produkty nielubiane','czas na przygotowanie','choroby i leki'].includes(x));
    if(mdata.length)out.push({ok:false,text:'Brakuje danych o: '+mdata.join(', ')+'.'});
    (day.warnings||[]).forEach(w=>out.push({ok:false,text:w}));
    const c=client();
    if(c&&typeof root.dietClientHealthRisks==='function')root.dietClientHealthRisks(c).forEach(rk=>out.push({ok:false,stop:true,text:'Ankieta lub profil wskazuje: '+rk.label+'. Skieruj klienta do lekarza lub dietetyka.'}));
    if(c&&c.injuries)out.push({ok:false,info:true,text:'Klient ma wpisane: „'+String(c.injuries).slice(0,100)+'”. Jadłospis tego nie uwzględnia.'});
    out.push({ok:false,text:'Plan wymaga ręcznej weryfikacji trenera. Nic nie wysyła się samo.'});
    return out;
  }
  function qcHTML(ctx){
    const list=qualityChecks(ctx);
    const icon=x=>x.ok?'✓':x.stop?'⛔':'⚠';
    const cls=x=>x.ok?'is-ok':x.stop?'is-stop':'is-warn';
    const approval=root._dietApprovalOpen;
    const risks=client()&&typeof root.dietClientHealthRisks==='function'?root.dietClientHealthRisks(client()):[];
    return`<section class="dg-qc" data-dg-qc aria-labelledby="dg-qc-h"><h4 class="dg-h4" id="dg-qc-h">Kontrola jakości planu</h4><ul>${list.map(x=>`<li class="${cls(x)}"><span aria-hidden="true">${icon(x)}</span> ${esc(x.text)}</li>`).join('')}</ul>
      ${approval?`<div class="diet-approval dg-approve">${risks.length?`<label class="dg-check is-risk"><input type="checkbox" id="diet-risk-ack" onchange="dietApprovalToggle()"> Świadomie wysyłam mimo ryzyka: ${esc(risks.map(x=>x.label).join(', '))}. Ustaliłem to z klientem i jego lekarzem lub dietetykiem.</label>`:''}<label class="dg-check"><input type="checkbox" id="diet-approve-check" onchange="dietApprovalToggle()"> Sprawdziłem plan i punkty powyżej.</label><div class="dg-actions"><button type="button" class="btn btn-primary" id="diet-approve-btn" disabled style="opacity:.45;" onclick="dietApproveAndSend()">Zatwierdź i wyślij klientowi</button><button type="button" class="btn btn-ghost" onclick="dietCloseApproval()">Anuluj</button></div></div>`:''}</section>`;
  }

  /* ───────── Plan: model widoku, „Dlaczego taki plan?” ───────── */
  function whyLines(ctx){
    const p=effectivePrefs(),D=DP(),c=client();
    const exl=D?p.ex.map(id=>(D.DIET_EXCLUSIONS.find(e=>e.id===id)||{label:id}).label.toLowerCase()):[];
    if(W.other)exl.push(W.other);
    const iv=c&&root.PlanClient&&root.PlanClient.interviewOf?root.PlanClient.interviewOf(c):{};
    return DV().why({meals:meals(),times:(W.times||[]).length?times():[],mealsFromClient:!!iv.mealsPerDay||(W.times||[]).length>0,trainRest:!!(ctx.rest&&!ctx.rest.same),
      goal:goalLabel(g('calcGoalDelta',0)),maxMin:W.timeSet?p.maxMin:0,prep:g('dietPrep',0),lunchbox:W.lunchbox===true,budget:W.budget,ex:exl,likes:p.like.length>0});
  }
  function vmOf(ctx){
    const c=client();
    return DV().fromBuilt(ctx.shown,ctx.day,{client:c&&c.name||'',goal:goalLabel(g('calcGoalDelta',0)),kcal:ctx.shown.kcal,meals:meals(),people:g('dietPeople',1),
      water:c&&c.weight?[Math.round(c.weight*0.030*10)/10,Math.round(c.weight*0.035*10)/10]:null,why:whyLines(ctx),times:times(),habit:'Zjedz białko w każdym posiłku',note:W.note||''});
  }
  function trainerDetailsHTML(ctx){
    const t=ctx.t,rest=ctx.rest;
    const row=(l,a)=>`<tr><th scope="row">${l}</th><td>${r(a.kcal)} kcal</td><td>${a.protein.g} g</td><td>${a.fat.g} g</td><td>${a.carbs.g} g</td></tr>`;
    const tbl=`<table class="dg-tbl"><thead><tr><th></th><th>Kalorie</th><th>Białko</th><th>Tłuszcz</th><th>Węgle</th></tr></thead><tbody>${row('Dzień treningowy',t)}${rest&&!rest.blocked?row('Dzień wolny',rest):''}</tbody></table>${rest&&rest.same?'<p class="dg-hint">Przy tej aktywności (PAL ≤ 1,5) dni się nie różnią.</p>':''}`;
    // Pełna stara karta (normy, źródła, uwagi, korekta z postępów) jako szczegóły dla trenera.
    const old=DP()&&ctx.cardT?DP().dietRenderCard(ctx.cardT,ctx.day,{review:ctx.review,meals:meals(),train:ctx.t,rest:ctx.rest,trainDays:ctx.td.days,dayType:g('dietDayType','trening')}):'';
    const norms=old.replace(/^[\s\S]*?(<div class="calc-tip">)/,'$1').replace(/<div class="diet-wizard"[\s\S]*$/,'');
    return`<details class="dg-more dg-details" data-dg-details><summary>Szczegóły dla trenera: dzień treningowy i wolny, normy, źródła</summary>${tbl}<div class="dg-norms">${norms}</div></details>`;
  }

  /** Karta jadłospisu w kalkulatorze. ctx z calcDietCardHTML: {t, rest, shown, cardT, day, blocked, td, review}. */
  function cardHTML(ctx){
    syncClient();
    const D=DP();
    if(ctx.blocked||!ctx.day)return D.dietRenderCard(ctx.cardT,null,{review:ctx.review,meals:meals(),train:ctx.t,rest:ctx.rest,trainDays:ctx.td.days,dayType:g('dietDayType','trening')});
    const head=`<div class="dg-head"><h3 class="dg-h3">Jadłospis dla klienta</h3>${stepper()}</div>`;
    if(!W.generated||W.medical==='tak'){
      const n=W.step;
      const body=n===1?step1(ctx):n===2?step2():n===3?step3():step4(ctx);
      const med=W.medical==='tak';
      const nav=`<div class="dg-nav">${n>1?`<button type="button" class="btn btn-ghost" onclick="dgGo(${n-1})">Wstecz</button>`:''}<span class="dg-grow"></span>${n<4?`<button type="button" class="btn btn-ghost dg-next" onclick="dgGo(${n+1})">Dalej: ${STEPS[n]}</button>`:med?'':`<button type="button" class="btn btn-primary" data-dg-generate onclick="dgGenerate()">Wygeneruj indywidualny jadłospis</button>`}</div>`;
      return`<div class="calc-result-card diet-card dg" id="diet-card" data-dg-step="${n}">${head}<section class="dg-body" aria-label="${STEPS[n-1]}"><h4 class="dg-h4">${n}. ${STEPS[n-1]}</h4>${body}</section>${nav}</div>`;
    }
    const vm=vmOf(ctx);
    const v=g('dietView','dzien');
    const views=`<div class="dg-row dg-row-inline"><div class="dg-lbl">Widok i lista zakupów</div><div class="dg-chips">${[['dzien','1 dzień'],['3dni','3 dni'],['tydzien','Cały tydzień']].map(([k,l])=>chip(v===k,`dgView('${k}')`,l)).join('')}<span class="dg-sep"></span>${[1,2,3,4].map(n=>chip(g('dietPeople',1)===n,`dietSetPeople(${n})`,n===1?'1 osoba':n+' osoby')).join('')}<span class="dg-sep"></span><button type="button" class="dg-chip" onclick="dgVariant()">Inny zestaw posiłków</button></div></div>`;
    const acts=`<div class="dg-actions" role="toolbar" aria-label="Akcje jadłospisu"><button type="button" class="btn btn-ghost" onclick="dietSaveDraft()">Zapisz w profilu</button><button type="button" class="btn btn-ghost" data-dg-clientpreview onclick="dgClientPreview()">Podgląd klienta</button><button type="button" class="btn btn-ghost" onclick="dgPdf()">Wygeneruj PDF</button><button type="button" class="btn btn-ghost dg-send" onclick="dietSendToClient()">Wyślij klientowi</button><button type="button" class="dg-link" onclick="dgGo(1)">Zmień ustawienia</button></div>`;
    const plan=DV().render('calcdpv',vm,{mode:'trainer',noTbar:true,base:'',day:W.day||0,onDay:i=>{W.day=i;},
      onEdit:(key,snap)=>{W.edits=Object.assign({},W.edits);if(snap)W.edits[key]=snap;else delete W.edits[key];recalc();if(typeof root.notify==='function')root.notify(snap?'Posiłek zmieniony w jadłospisie':'Posiłek wrócił do wersji z automatu');},
      onSwapMeal:(d,m)=>{if(W.edits[d+':'+m]){W.edits=Object.assign({},W.edits);delete W.edits[d+':'+m];}root.dietSwapMeal(d,m);},
      onNote:t=>{W.note=t;recalc();},onSend:()=>root.dietSendToClient(),onShop:()=>{}});
    return`<div class="calc-result-card diet-card dg dg-plan" id="diet-card" data-dg-step="plan">${head}${acts}${qcHTML(ctx)}${views}${plan}${trainerDetailsHTML(ctx)}</div>`;
  }

  /** Zmiany trenera nałożone na jadłospis z generatora (przed zapisem, PDF i wysyłką). */
  function applyEdits(day){if(day&&W.edits&&Object.keys(W.edits).length&&DV())DV().applyEdits(day,W.edits);return day;}
  /** Dane do zapisu u klienta: plan w formacie widoku klienta + stan kreatora. */
  function recordExtra(){
    const last=root._dietLast;if(!last||!last.day||!DV())return{};
    const ctx=root._dgCtx;
    const vm=ctx?vmOf(Object.assign({},ctx,{shown:last.targets,day:last.day})):DV().fromBuilt(last.targets,last.day,{});
    const wz=Object.assign({},W);delete wz.clientId;
    return{plan:DV().toPublic(vm,{goal:''}),why:vm.why,wizard:wz,source:'kalkulator',form:'week',prefs:DP()?DP().dietPrefsNorm(prefs()):prefs()};
  }

  Object.assign(root,{
    dietWizCardHTML:cardHTML,dietWizPrefs:effectivePrefs,dietWizApplyEdits:applyEdits,dietWizRecordExtra:recordExtra,dietWizCompleteness:completeness,dietWizQuality:qualityChecks,
    dgGo:n=>{W.step=Math.max(1,Math.min(4,n));if(W.generated&&n<=4)W.generated=false;recalc();const el=root.document&&root.document.getElementById('diet-card');if(el&&el.scrollIntoView)el.scrollIntoView({block:'start'});},
    dgGenerate:()=>{if(W.medical==='tak'){if(root.notify)root.notify('Przy chorobach i lekach nie generujemy automatycznego jadłospisu.');return;}W.generated=true;W.edits={};recalc();},
    dgGoal:v=>{const b=root.document&&root.document.querySelector('.calc-goal-btn[data-val="'+v+'"]');if(b&&typeof root.setCalcGoal==='function')root.setCalcGoal(b,v);else{root.calcGoalDelta=v;recalc();}},
    dgMeals:k=>{W.times=[];W.edits={};root.dietSetMeals(k);},
    dgTime:(i,v)=>{const t=times();t[i]=v;W.times=t;recalc();},
    dgMaxMin:v=>{W.timeSet=true;root.dietSetMaxMin(v);},
    dgPrep:v=>{W.prepSet=true;W.edits={};root.dietSetPrep(v);},
    dgBudget:v=>{W.budget=v;W.edits={};recalc();},
    dgLunch:v=>{W.lunchbox=!!v;W.edits={};recalc();},
    dgFlag:(k,v)=>{W[k]=!!v;recalc();},
    dgNoEx:()=>{W.exChecked=true;recalc();},
    dgOther:v=>{W.other=String(v||'').trim().slice(0,80);W.exChecked=true;recalc();},
    dgMedical:v=>{W.medical=v;recalc();},
    dgStyle:k=>{W.exChecked=true;W.edits={};root.dietSetStyle(k);},
    dgEx:id=>{const p=prefs(),ids=EX_IDS[id]||[id],on=ids.every(x=>p.ex.includes(x));p.ex=on?p.ex.filter(x=>!ids.includes(x)):[...new Set(p.ex.concat(ids))];W.exChecked=true;W.edits={};recalc();},
    dgLike:id=>{W.edits={};root.dietToggleLike(id);},
    dgSkip:id=>{W.edits={};root.dietToggleSkip(id);},
    dgView:k=>{W.edits={};W.day=0;root.dietSetView(k);},
    dgVariant:()=>{W.edits={};root.dietNextVariant();},
    dgClientPreview:()=>{const ctx=root._dgCtx;if(!ctx||!DV())return;DV().clientPreview(vmOf(ctx));},
    dgPdf:()=>{const ctx=root._dgCtx;if(!ctx||!DV())return;DV().preview(vmOf(ctx));}
  });
})(typeof window!=='undefined'?window:globalThis);
