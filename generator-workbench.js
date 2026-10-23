/* Generator: deterministic proposals, trainer rules and bounded version history.
   A proposal never writes a plan. Approval edits the draft; the existing Save
   action remains responsible for confirmed persistence and client assignment. */
(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase().trim();
  const escape=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults={maxIncreasePct:5,loadStep:2.5,maxSetsPerExercise:5,maxWeeklySets:20,preferred:'',excluded:'',instructions:''};
  const list=x=>String(x||'').split(/[\n;,]/).map(norm).filter(Boolean);
  const keys=p=>Array.isArray(p.weekKeys)&&p.weekKeys.length?p.weekKeys:['w1'];
  const week=p=>keys(p).includes(p.currentWeek)?p.currentWeek:keys(p)[0];
  const cell=(e,w)=>({s:String(e[w]?.s??e.sets??'3'),r:String(e[w]?.r??e.reps??'10'),kg:String(e[w]?.kg??e.kg??''),rest:String(e[w]?.rest??e.rest??'90s'),rir:String(e[w]?.rir??e.rir??''),rpe:String(e[w]?.rpe??e.rpe??'')});
  const numeric=x=>/^\d+(?:[.,]\d+)?$/.test(String(x).trim())?Number(String(x).replace(',','.')):null;
  function rules(input){
    const r=Object.assign({},defaults,input||{});
    for(const [k,lo,hi] of [['maxIncreasePct',0,10],['loadStep',0.25,10],['maxSetsPerExercise',1,10],['maxWeeklySets',1,40]]){
      const n=Number(r[k]);if(!Number.isFinite(n)||n<lo||n>hi)throw new Error('Nieprawidłowa wartość zasady: '+k);
      r[k]=k.includes('Sets')?Math.floor(n):n;
    }
    for(const k of ['preferred','excluded','instructions'])r[k]=String(r[k]||'').slice(0,2000);
    if(list(r.preferred).some(n=>list(r.excluded).includes(n)))throw new Error('Ćwiczenie nie może być równocześnie preferowane i wykluczone.');
    return r;
  }
  function snapshot(plan){const p=copy(plan);delete p.generatorHistory;return p;}
  function signature(plan){return JSON.stringify(snapshot(plan));}
  function category(ex){
    const library=typeof root.allExercises==='function'?root.allExercises():[];
    const hit=library.find(e=>norm(e.name)===norm(ex.name))||{};
    return norm(ex.cat||hit.cat||ex.muscleGroup||ex.muscle||'nieoznaczona').split(/[,(]/)[0].trim();
  }
  function audit(plan,r,w){
    const totals={},issues=[];w=w||week(plan);
    (plan.days||[]).forEach((d,di)=>(d.exercises||[]).forEach(e=>{
      const c=cell(e,w),s=numeric(c.s),cat=category(e);
      if(s==null||s<1)issues.push('Dzień '+(di+1)+': sprawdź liczbę serii '+e.name+'.');
      else{totals[cat]=(totals[cat]||0)+s;if(s>r.maxSetsPerExercise)issues.push(e.name+': przekroczony limit serii na ćwiczenie.');}
      if(list(r.excluded).includes(norm(e.name)))issues.push(e.name+': ćwiczenie wykluczone przez trenera.');
    }));
    Object.entries(totals).forEach(([cat,s])=>{if(cat!=='nieoznaczona'&&s>r.maxWeeklySets)issues.push(cat+': '+s+' serii — ponad limitem trenera '+r.maxWeeklySets+'.');});
    return{totals,issues,unknown:totals.nieoznaczona||0};
  }
  function proposeAdapt(plan,r,getRec){
    const candidate=copy(plan),w=week(plan),changes=[],notes=[];
    if(/deload|regenerac|przejsciowy/i.test(norm(plan.phases?.[w]))){notes.push('Wybrany tydzień jest regeneracyjny. Zachowano zaplanowane odciążenie; zmiany wymagają ręcznej oceny trenera.');return{kind:'adapt',title:'Ocena tygodnia '+w,candidate,changes,notes,base:signature(plan)};}
    (candidate.days||[]).forEach((d,di)=>(d.exercises||[]).forEach((e,ei)=>{
      const c=cell(e,w),rec=getRec(e,c)||{},facts=rec.facts||{},before=copy(c);
      if(!['medium','high'].includes(rec.confidence)){notes.push(e.name+': za mało pewnych danych — bez zmiany.');return;}
      const reason=(rec.reasons||[]).join(' ');
      const last=numeric(facts.lastKg),kg=numeric(c.kg),reps=String(c.r).match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
      const loadUnit=typeof root.exLoadUnit==='function'?root.exLoadUnit(e):'kg';
      const weightOK=loadUnit==='kg'&&!/assisted|asyst|pomoc/i.test(e.loadUnit||e.name||'')&&last!=null&&last>0&&kg!=null;
      // Recommendations are based on completed results, never the precomputed next-week increase.
      if(rec.action==='DODAJ CIĘŻAR'&&weightOK){
        const step=Math.floor((last*r.maxIncreasePct/100)/r.loadStep)*r.loadStep;
        if(step<=0){notes.push(e.name+': najmniejszy skok sprzętu przekracza limit procentowy.');return;}
        c.kg=String(Math.round((last+step)*100)/100);
      }else if(rec.action==='ZMNIEJSZ OBCIĄŻENIE'&&weightOK)c.kg=String(Math.round(Math.max(r.loadStep,Math.floor(last*0.95/r.loadStep)*r.loadStep)*100)/100);
      else if(rec.action==='DODAJ POWTÓRZENIA'&&reps&&Number.isFinite(facts.avgReps)){
        const lo=Number(reps[1]),hi=Number(reps[2]||reps[1]);
        const target=Math.min(hi,Math.max(lo,Math.floor(facts.avgReps)+1));
        c.r=target<hi?target+'–'+hi:String(hi);
      }else{notes.push(e.name+': '+(reason||'Bez automatycznej zmiany; sprawdź jednostkę, zakres lub zalecenie deloadu.'));return;}
      if(JSON.stringify(c)!==JSON.stringify(before)){e[w]=c;changes.push({di,ei,name:e.name,before,after:copy(c),reason,confidence:rec.confidence});}
    }));
    return{kind:'adapt',title:'Aktualizacja wybranego tygodnia '+w,candidate,changes,notes,base:signature(plan)};
  }
  function pattern(e){
    if(e.pattern||e.movementPattern)return norm(e.pattern||e.movementPattern);
    if(typeof root.exercisePatternKey==='function'){const k=root.exercisePatternKey(e);if(k)return k;}
    const n=norm(e.name);
    for(const [rx,k] of [[/wios|row/,'pull-horizontal'],[/podciag|sciaganie drazka|pull.?up|pulldown/,'pull-vertical'],[/przysiad|squat|leg press|suwnic/,'squat'],[/martwy|rdl|deadlift|good morning/,'hinge'],[/wykrok|lunge|split squat/,'lunge'],[/wycisk.*bark|ohp|overhead|zolniers/,'push-vertical'],[/wycisk|pomp|bench|push.?up/,'push-horizontal'],[/uginan.*nog|leg curl/,'knee-flexion'],[/uginan.*ram|biceps|curl/,'elbow-flexion'],[/triceps|prostowan.*ram/,'elbow-extension']])if(rx.test(n))return k;
    return '';
  }
  function rankSwaps(ex,library,r,equipment){
    const source=library.find(e=>norm(e.name)===norm(ex.name))||ex;
    const p=pattern(source),cat=category(source),eq=list(equipment),seen=new Set();
    return library.filter(e=>{
      const n=norm(e.name);if(!n||n===norm(ex.name)||seen.has(n)||list(r.excluded).includes(n))return false;seen.add(n);
      return !eq.length||eq.includes(norm(e.eq||e.equipment));
    }).map(e=>{
      const q=pattern(e),samePattern=!!p&&q===p,sameCat=cat!=='nieoznaczona'&&category(e)===cat;
      const explicit=list(source.alt).includes(norm(e.name));
      if(!samePattern&&!sameCat&&!explicit)return null;
      // A known different movement is not presented as biomechanically equivalent.
      if(p&&q&&p!==q&&!explicit)return null;
      const why=[samePattern?'zgodny wzorzec ruchu':'wzorzec wymaga sprawdzenia',sameCat?'zgodna kategoria mięśniowa':'inna kategoria — sprawdź cel'];
      let extra=0;
      if(source.difficulty&&e.difficulty){if(norm(source.difficulty)===norm(e.difficulty)){extra++;why.push('zgodny poziom trudności');}else why.push('inny poziom trudności — sprawdź technikę');}
      if(typeof root.exerciseBiomech==='function'){
        const a=root.exerciseBiomech(source),b=root.exerciseBiomech(e);
        if(a.plane&&a.plane===b.plane){extra++;why.push('zgodna szacowana płaszczyzna ruchu');}
        if(a.stable===b.stable)extra++;
      }
      if(explicit)why.push('zamiennik zapisany w bibliotece');
      if(list(r.preferred).includes(norm(e.name)))why.push('preferencja trenera');
      return{exercise:e,score:(samePattern?6:0)+(sameCat?3:0)+(explicit?2:0)+extra+(list(r.preferred).includes(norm(e.name))?1:0),why:why.join('; '),confidence:samePattern?'medium':'low'};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.exercise.name.localeCompare(b.exercise.name)).slice(0,8);
  }
  function seconds(v){const n=parseFloat(String(v).replace(',','.'));if(!Number.isFinite(n))return 90;return /min/.test(v)?n*60:/s/.test(v)?n:n<=5?n*60:n;}
  function estimateDay(day,w){return 5+(day.exercises||[]).reduce((sum,e)=>{const c=cell(e,w),s=Number(c.s)||3;return sum+s*(45+seconds(c.rest))/60+1;},0);}
  function emergency(plan,r,opts){
    const w=week(plan),candidate=copy(plan),changes=[],notes=[];
    candidate.parentGeneratorPlanId=plan.sourcePlanId||'';
    candidate.planName=(plan.planName||plan.name||'Plan')+' — wariant na 1 tydzień';
    candidate.weeks=1;candidate.weekKeys=[w];candidate.currentWeek=w;candidate.phases={[w]:plan.phases?.[w]||'Wariant awaryjny'};
    candidate.generatorHistory=[];delete candidate.sourcePlanId;
    candidate.days=(plan.days||[]).filter((d,i)=>i!==opts.skipDay).map(copy);
    if(opts.skipDay>=0){changes.push({name:plan.days[opts.skipDay]?.dayName||'Pominięty dzień',reason:'Pominięcie tylko w osobnym wariancie tygodnia; utracona objętość nie jest automatycznie nadrabiana.'});notes.push('Sprawdź rozkład partii: usunięty trening zmniejsza tygodniową objętość.');}
    if(!candidate.days.length)throw new Error('Wariant musi zawierać co najmniej jeden dzień.');
    candidate.days.forEach(d=>{
      (d.exercises||[]).forEach(e=>{const c=cell(e,w);keys(plan).forEach(k=>delete e[k]);e[w]=c;});
      if(opts.minutes){
        const target=Number(opts.minutes);if(!Number.isFinite(target)||target<15||target>120)throw new Error('Wybierz czas od 15 do 120 minut.');
        let guard=0;
        while(estimateDay(d,w)>target&&guard++<150){
          const candidates=(d.exercises||[]).filter(e=>Number(e[w].s)>1).sort((a,b)=>Number(list(r.preferred).includes(norm(a.name)))-Number(list(r.preferred).includes(norm(b.name)))||Number(b[w].s)-Number(a[w].s));
          if(!candidates.length)break;
          const e=candidates[0];e[w].s=String(Number(e[w].s)-1);
        }
        if(estimateDay(d,w)>target)notes.push((d.dayName||d.day)+': nie da się osiągnąć limitu bez usunięcia ćwiczeń; szacunek '+Math.ceil(estimateDay(d,w))+' min.');
        changes.push({name:d.dayName||d.day,reason:'Skrócenie przez redukcję serii, bez automatycznego usuwania ćwiczeń. Szacowany czas: '+Math.ceil(estimateDay(d,w))+' min (zależny od tempa i przerw).'});
      }
    });
    candidate.daysPerWeek=candidate.days.length;candidate.sessionDuration=opts.minutes||plan.sessionDuration;
    return{kind:'emergency',title:'Osobny wariant awaryjny na 1 tydzień',candidate,changes,notes,base:signature(plan)};
  }
  function addRevision(plan,label){
    const entry={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),at:new Date().toISOString(),label:String(label).slice(0,160),snapshot:snapshot(plan)};
    const history=(plan.generatorHistory||[]).concat(entry).slice(-5);
    // Firestore documents have a size limit: retain bounded nonrecursive snapshots.
    while(history.length>1&&JSON.stringify(history).length>220000)history.shift();
    if(JSON.stringify(history).length>220000)throw new Error('Plan jest zbyt duży dla historii wersji. Skróć plan przed zapisaniem wersji.');
    return history;
  }
  function compare(before,after){
    const changes=[],max=Math.max(before.days?.length||0,after.days?.length||0),w=week(after);
    for(let di=0;di<max;di++){
      const a=before.days?.[di],b=after.days?.[di];
      if(!a||!b){changes.push({name:(a||b).dayName||(a||b).day||'Dzień '+(di+1),reason:b?'Dodanie dnia':'Usunięcie dnia'});continue;}
      for(let ei=0;ei<Math.max(a.exercises?.length||0,b.exercises?.length||0);ei++){
        const x=a.exercises?.[ei],y=b.exercises?.[ei];
        if(!x||!y){changes.push({name:(x||y).name,reason:y?'Dodanie ćwiczenia':'Usunięcie ćwiczenia'});continue;}
        const c=cell(x,w),d=cell(y,w);
        if(x.name!==y.name||JSON.stringify(c)!==JSON.stringify(d))changes.push({name:x.name===y.name?x.name:x.name+' → '+y.name,before:c,after:d,reason:'Porównanie w tygodniu '+w});
      }
    }
    if(signature(before)!==signature(after)&&!changes.length)changes.push({name:'Ustawienia programu lub pozostałe tygodnie',reason:'Zmiana danych programu. Przywrócona zostanie kompletna wybrana migawka.'});
    return changes;
  }
  const api={rules,cell,week,snapshot,signature,audit,proposeAdapt,rankSwaps,emergency,addRevision,estimateDay,compare};
  root.GeneratorWorkbench=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  let proposal=null,proposalOwner='',busy=false;
  const saveCache=new WeakMap(),bindings=new WeakMap();
  const current=()=>typeof aplLastPlan!=='undefined'?aplLastPlan:null;
  const owner=()=>String(root._uid||'');
  const tell=msg=>{if(typeof root.notify==='function')root.notify(msg);};
  function getRules(){return rules(root.SETTINGS?.generatorRules||{});}
  function selectedClient(){return document.getElementById('apl-client')?.value||'';}
  function assertTrainer(){if(!owner()||root._clientAppMode)throw new Error('Zaloguj się jako trener.');}
  function assertPlan(){
    assertTrainer();const p=current(),b=p&&bindings.get(p);
    if(!p||!b||b.owner!==owner()||b.generation!==root.tenantSessionGeneration||b.clientId!==selectedClient())throw new Error('Klient lub konto zostały zmienione. Otwórz plan ponownie dla właściwego klienta.');
    return p;
  }
  function setProposal(p){proposal=p;proposalOwner=owner();proposal.clientId=selectedClient();renderProposal();}
  function renderProposal(){
    const el=document.getElementById('gwb-preview');if(!el)return;
    if(!proposal){el.innerHTML='';return;}
    const p=proposal;
    const label=c=>c.s+' × '+c.r+' | '+(c.kg||'bez ciężaru')+' | RIR '+(c.rir||'—')+' | przerwa '+c.rest;
    const warnings=audit(p.candidate,getRules()).issues;
    el.innerHTML='<h4>'+escape(p.title)+'</h4><p>To propozycja. Zatwierdzenie zmienia wersję roboczą; zapis do klienta wymaga „Zapisz plan”.</p>'+p.changes.map(c=>'<div class="gwb-change"><b>'+escape(c.name)+'</b>'+(c.before?'<div>'+escape(label(c.before))+' → '+escape(label(c.after))+'</div>':'')+'<small>'+escape(c.reason)+'</small></div>').join('')+p.notes.concat(warnings).map(n=>'<p class="gwb-note">'+escape(n)+'</p>').join('')+(p.changes.length?'<button type="button" class="btn btn-primary btn-sm" onclick="gwbApprove()">Zatwierdź propozycję</button>':'<p>Brak zmian do zatwierdzenia.</p>')+' <button type="button" class="btn btn-ghost btn-sm" onclick="gwbDismiss()">Odrzuć</button>';
  }
  root.gwbDismiss=()=>{proposal=null;renderProposal();};
  root.gwbRulesPrompt=()=>{
    const r=getRules();return '\nZASADY TRENERA (nie mogą znosić ograniczeń klienta): '+JSON.stringify(r)+'\nLimity objętości są ustawieniami trenera, nie pomiarem MRV. Preferencje ustępują ograniczeniom. Nie wymyślaj wyników klienta.\n';
  };
  root.gwbRenderRules=()=>{
    const el=document.getElementById('gwb-rules');if(!el)return;const r=getRules();
    el.innerHTML='<details><summary>Moje zasady generatora</summary><p>Domyślne zasady trenera. Limity objętości są orientacyjne, nie wyznaczają indywidualnego MRV.</p><div class="gwb-grid">'+[['maxIncreasePct','Maksymalny wzrost ciężaru (%)',0,10,0.5],['loadStep','Skok ciężaru (kg)',0.25,10,0.25],['maxSetsPerExercise','Limit serii na ćwiczenie',1,10,1],['maxWeeklySets','Limit serii na kategorię / tydzień',1,40,1]].map(([k,l,min,max,step])=>'<label>'+l+'<input class="form-input" type="number" id="gwb-'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+r[k]+'"></label>').join('')+'</div>'+[['preferred','Preferowane ćwiczenia (oddziel średnikami)'],['excluded','Wykluczone ćwiczenia (dokładne nazwy)'],['instructions','Własne wskazówki dla AI (wymagają oceny trenera)']].map(([k,l])=>'<label>'+l+'<textarea class="form-input" id="gwb-'+k+'" maxlength="2000">'+escape(r[k])+'</textarea></label>').join('')+'<button type="button" class="btn btn-ghost btn-sm" onclick="gwbSaveRules()">Zapisz zasady</button></details>';
  };
  root.gwbSaveRules=async()=>{
    if(busy)return;busy=true;
    const uid=owner(),generation=root.tenantSessionGeneration,previous=copy(root.SETTINGS?.generatorRules||{});
    try{
      assertTrainer();const input={};
      Object.keys(defaults).forEach(k=>input[k]=document.getElementById('gwb-'+k)?.value??defaults[k]);
      const r=rules(input);root.SETTINGS.generatorRules=r;
      const saved=await root.persistSettingsDoc();
      if(owner()!==uid||root.tenantSessionGeneration!==generation)return;
      if(!saved){root.SETTINGS.generatorRules=previous;throw new Error('Zasady nie zostały potwierdzone w bazie. Spróbuj ponownie.');}
      tell('Zasady trenera zapisane.');
    }catch(e){if(owner()===uid&&root.tenantSessionGeneration===generation&&root.SETTINGS)root.SETTINGS.generatorRules=previous;tell(e.message);}finally{busy=false;}
  };
  root.gwbRender=(rendered,client)=>{
    const el=document.getElementById('gwb-panel'),p=current();if(!el)return;
    proposal=null;if(!p){el.innerHTML='';return;}
    if(!bindings.has(p))bindings.set(p,{owner:owner(),generation:root.tenantSessionGeneration,clientId:client?.id||''});
    const a=audit(p,getRules());
    el.innerHTML='<h3>Rozwój planu</h3><p>Wybrany tydzień: '+escape(week(p))+'. Wszystkie zmiany najpierw zobaczysz w podglądzie.</p><div class="gwb-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="gwbAdapt()">Dopasuj do wyników</button><button type="button" class="btn btn-ghost btn-sm" onclick="gwbEmergency()">Wariant awaryjny</button><button type="button" class="btn btn-ghost btn-sm" onclick="gwbHistory()">Historia wersji</button></div><details><summary>Objętość i ograniczenia trenera</summary><p>Sumy według oznaczeń kategorii, bez przeliczania pośredniej pracy mięśni. Brak kategorii: '+a.unknown+' serii.</p>'+Object.entries(a.totals).map(([k,n])=>'<div>'+escape(k)+': '+n+' serii</div>').join('')+a.issues.map(s=>'<p class="gwb-note">'+escape(s)+'</p>').join('')+'</details><div id="gwb-preview" aria-live="polite"></div>';
  };
  root.gwbAdapt=()=>{
    try{
      const p=assertPlan(),cid=selectedClient();if(!cid)throw new Error('Wybierz klienta i przygotuj plan.');
      const r=getRules();setProposal(proposeAdapt(p,r,(ex,c)=>{
        const range=c.r.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
        const classified=root.exerciseProgressClass(cid,ex.name,[],{exerciseId:ex.exerciseId||ex.id||''});
        return root.recommendExerciseProgress(classified,{target:{repMax:range?Number(range[2]||range[1]):null}});
      }));
    }catch(e){tell(e.message);}
  };
  root.gwbApprove=()=>{
    try{
      const p=assertPlan();
      if(!proposal||proposalOwner!==owner()||proposal.clientId!==selectedClient()||proposal.base!==signature(p))throw new Error('Plan, klient lub sesja uległy zmianie. Przygotuj propozycję ponownie.');
      if(window._aplAmateurIntake&&typeof aplAmateurPlanIssues==='function'){
        const issues=aplAmateurPlanIssues(proposal.candidate);if(issues.length)throw new Error(issues[0]);
      }
      const next=proposal.candidate;
      next.generatorHistory=addRevision(p,'Przed: '+proposal.title);
      next.generatorRules=getRules();next.generatorLastDecision={at:new Date().toISOString(),title:proposal.title,changes:proposal.changes,notes:proposal.notes};
      if(proposal.kind==='emergency'){delete next.sourcePlanId;next.parentGeneratorPlanId=p.sourcePlanId||'';}
      bindings.set(next,bindings.get(p));aplLastPlan=next;proposal=null;aplRerenderCurrent();tell('Zatwierdzono wersję roboczą. Kliknij „Zapisz plan”, aby zapisać.');
    }catch(e){tell(e.message);}
  };
  root.gwbEmergency=()=>{
    const el=document.getElementById('gwb-preview'),p=current();if(!el||!p)return;proposal=null;
    el.innerHTML='<h4>Osobny wariant na jeden tydzień</h4><p>Powstanie osobny plan. Oryginał i kalendarz pozostają bez zmian do Twojej decyzji.</p><label>Czas sesji (minuty, opcjonalnie)<input id="gwb-minutes" class="form-input" type="number" min="15" max="120" placeholder="np. 25"></label><label>Pomiń dzień<select id="gwb-skip" class="form-select"><option value="-1">Zachowaj wszystkie dni</option>'+p.days.map((d,i)=>'<option value="'+i+'">'+escape(d.dayName||d.day||'Dzień '+(i+1))+'</option>').join('')+'</select></label><button type="button" class="btn btn-ghost btn-sm" onclick="gwbPrepareEmergency()">Pokaż wariant</button>';
  };
  root.gwbPrepareEmergency=()=>{try{const p=assertPlan(),minutes=document.getElementById('gwb-minutes').value,skipDay=Number(document.getElementById('gwb-skip').value);if(!minutes&&skipDay<0)throw new Error('Wybierz krótszy czas lub dzień do pominięcia.');setProposal(emergency(p,getRules(),{minutes,skipDay}));}catch(e){tell(e.message);}};
  root.gwbHistory=()=>{
    const el=document.getElementById('gwb-preview'),p=current();if(!el||!p)return;proposal=null;
    el.innerHTML='<h4>Historia wersji</h4><p>Historia przechowuje do 5 ostatnich migawek (z limitem rozmiaru). Przywrócenie wymaga podglądu i późniejszego zapisu.</p>'+(p.generatorHistory||[]).map((h,i)=>'<div class="gwb-change"><b>'+escape(h.label)+'</b><div>'+escape(new Date(h.at).toLocaleString('pl-PL'))+'</div><button type="button" class="btn btn-ghost btn-sm" onclick="gwbRestore('+i+')">Podgląd przywrócenia</button></div>').join('')+(!(p.generatorHistory||[]).length?'<p>Historia pojawi się po pierwszej zatwierdzonej zmianie lub zapisaniu planu.</p>':'');
  };
  root.gwbRestore=i=>{const p=current(),h=p?.generatorHistory?.[i];if(h)setProposal({kind:'restore',title:'Przywrócenie: '+h.label,candidate:copy(h.snapshot),base:signature(p),changes:compare(p,h.snapshot),notes:['Przywrócenie kompletnej migawki planu z '+h.at]});};
  let swapContext=null;
  root.gwbSwap=(di,ei)=>{
    const p=current(),ex=p?.days?.[di]?.exercises?.[ei],el=document.getElementById('gwb-preview');if(!ex||!el)return false;
    const lib=typeof root.allExercises==='function'?root.allExercises():[];
    const available=document.getElementById('gwb-equipment')?.value||'';
    const ranked=rankSwaps(ex,lib,getRules(),available);
    swapContext={di,ei,ranked,base:signature(p),owner:owner(),clientId:selectedClient()};proposal=null;
    el.innerHTML='<h4>Zamienniki: '+escape(ex.name)+'</h4><p>Ranking jest podpowiedzią na podstawie tagów i nazw, nie oceną medyczną. Po zamianie ciężar zostanie wyczyszczony we wszystkich tygodniach.</p><label>Dostępny sprzęt (dokładne tagi, oddziel średnikami)<input class="form-input" id="gwb-equipment" value="'+escape(available)+'" placeholder="np. Hantle; Ławka"></label><button type="button" class="btn btn-ghost btn-sm" onclick="gwbSwap('+di+','+ei+')">Filtruj</button>'+ranked.map((x,i)=>'<div class="gwb-change"><b>'+escape(x.exercise.name)+'</b><small>'+escape(x.why)+'</small><button type="button" class="btn btn-ghost btn-sm" onclick="gwbPickSwap('+i+')">Zobacz zamianę</button></div>').join('')+(!ranked.length?'<p>Brak dopasowań — zmień filtr lub użyj ręcznego edytora.</p>':'');el.scrollIntoView({block:'nearest',behavior:'smooth'});return true;
  };
  root.gwbPickSwap=i=>{
    try{
      const p=assertPlan(),s=swapContext;if(!s||s.owner!==owner()||s.clientId!==selectedClient()||s.base!==signature(p))throw new Error('Przygotuj ranking ponownie.');
      const hit=s.ranked[i];if(!hit)return;const next=copy(p),ex=next.days[s.di].exercises[s.ei],old=ex.name;
      ex.name=hit.exercise.name;delete ex.id;delete ex.exerciseId;if(hit.exercise.id)ex.exerciseId=hit.exercise.id;
      for(const k of ['cat','eq','muscle','pattern','movementPattern','difficulty']){delete ex[k];if(hit.exercise[k]!=null)ex[k]=hit.exercise[k];}
      ex.muscleGroup=hit.exercise.cat||hit.exercise.muscle||'';ex.kg='';delete ex.loadUnit;delete ex.alt;
      if(hit.exercise.loadUnit)ex.loadUnit=hit.exercise.loadUnit;
      keys(p).forEach(w=>{if(ex[w])ex[w].kg='';});
      setProposal({kind:'swap',title:'Zamiana ćwiczenia',candidate:next,base:signature(p),changes:[{name:old+' → '+ex.name,reason:hit.why+'; dobierz nowy ciężar i sprawdź zakres powtórzeń.'}],notes:[]});
    }catch(e){tell(e.message);}
  };
  root.gwbOpenSaved=()=>{
    try{
      assertTrainer();const id=document.getElementById('gwb-saved-plan')?.value,p=(typeof PL!=='undefined'?PL:[]).find(x=>x.id===id);
      if(!p||p.trainerId!==owner())throw new Error('Wybierz własny plan.');
      aplLastPlan=Object.assign(copy(p),{sourcePlanId:p.id,planName:p.name,weeks:p.duration,days:copy(p.days).map(d=>Object.assign(d,{dayName:d.dayName||d.day,focus:d.focus||d.muscles||'',exercises:(d.exercises||[]).map(e=>Object.assign(e,{notes:e.notes||e.note||''}))}))});
      delete aplLastPlan._fbId;delete aplLastPlan.id;
      document.getElementById('apl-client').value=p.clientId||'';
      aplLastClient=(typeof CL!=='undefined'?CL:[]).find(c=>c.id===p.clientId)||null;
      aplRerenderCurrent();tell('Otworzono kopię planu do rozwoju. Zapis utworzy nowy plan; poprzedni zachowasz.');
    }catch(e){tell(e.message);}
  };
  root.gwbRefreshSaved=()=>{
    const select=document.getElementById('gwb-saved-plan');if(!select)return;
    select.innerHTML='<option value="">Wybierz zapisany plan</option>'+(typeof PL!=='undefined'?PL:[]).filter(p=>p.trainerId===owner()&&!p.archived).map(p=>'<option value="'+escape(p.id)+'">'+escape(p.name)+'</option>').join('');
  };
  root.gwbBeforeSave=src=>{
    try{
      if(bindings.has(src))assertPlan();else assertTrainer();
      const issues=keys(src).flatMap(w=>audit(src,getRules(),w).issues.map(s=>w+': '+s));
      if(issues.length)throw new Error('Popraw plan zgodnie z zasadami trenera: '+issues[0]);
      root.gwbSaveMetadata(src);return true;
    }catch(e){tell(e.message);return false;}
  };
  root.gwbSaveMetadata=src=>{
    const sig=signature(src)+JSON.stringify(getRules()),cached=saveCache.get(src);
    if(cached?.signature===sig)return copy(cached.value);
    const value={generatorRules:getRules(),generatorHistory:addRevision(src,'Zapis planu'),generatorLastDecision:src.generatorLastDecision||null,parentGeneratorPlanId:src.sourcePlanId||src.parentGeneratorPlanId||null};
    saveCache.set(src,{signature:sig,value});return copy(value);
  };
  root.gwbAfterSave=(src,saved)=>{src.generatorHistory=copy(saved.generatorHistory||[]);};
  root.gwbGenerating=()=>{proposal=null;swapContext=null;const el=document.getElementById('gwb-panel');if(el)el.innerHTML='';};
  root.gwbReset=()=>{root.gwbGenerating();for(const id of ['gwb-rules','gwb-saved-plan']){const el=document.getElementById(id);if(el)el.innerHTML='';}const controls=document.getElementById('gwb-controls');if(controls)controls.open=false;};
  // Explicit UI entry point refreshes per-account data, including after sign-in.
  document.addEventListener('click',e=>{if(e.target.closest?.('#gwb-controls > summary')){root.gwbRenderRules();root.gwbRefreshSaved();}});
})(typeof window!=='undefined'?window:globalThis);
