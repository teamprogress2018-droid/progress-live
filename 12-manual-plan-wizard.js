// ════════════════════════════════════════
// MANUAL PLAN WIZARD — MODEL DANYCH
// Etap 1: niezależny od UI model programu. Stare plany nie mają pola
// `manualPlan` i pozostają w pełni obsługiwane przez dotychczasowy builder.
// ════════════════════════════════════════
(function(){
  'use strict';

  const MANUAL_PLAN_SCHEMA_VERSION=2;
  const MANUAL_PLAN_SPLITS=[
    'FBW','Upper Lower','PPL','Push Pull','Góra/dół + FBW','Trening dzielony','Własny split'
  ];
  const MANUAL_PLAN_PERIODIZATION=[
    'stały','liniowa','double','dup','blokowa','step_loading','autoregulacja','własna'
  ];
  const MANUAL_PLAN_PROGRESSIONS=[
    'load','reps','double','sets','rir_rpe','volume','density','technique','własna'
  ];
  const MANUAL_PLAN_INTENSITY=[
    'rir','rpe','pct_1rm','fixed_load','rep_range','własna'
  ];
  const MANUAL_PLAN_METHODS=[
    'straight_sets','superset','combined_sets','circuit','drop_set','rest_pause','myo_reps',
    'cluster_set','top_set_backoff','pyramid','reverse_pyramid','tempo','pause_reps','amrap','własna'
  ];
  const MANUAL_PLAN_PRIORITIES=['none','klatka','plecy','barki','ramiona','posladki','nogi','core','wlasny'];

  const copy=value=>JSON.parse(JSON.stringify(value));
  const text=value=>String(value==null?'':value).trim();
  const list=value=>Array.isArray(value)
    ?value.map(text).filter(Boolean)
    :text(value).split(/[,;\n]/).map(text).filter(Boolean);
  const number=(value,fallback,min,max)=>{
    const parsed=Number(value);
    if(!Number.isFinite(parsed))return fallback;
    return Math.max(min==null?-Infinity:min,Math.min(max==null?Infinity:max,parsed));
  };

  function manualPlanLevel(value){
    const raw=text(value).toLowerCase();
    if(/pocz|beginner/.test(raw))return 'poczatkujacy';
    if(/zaaw|advanced/.test(raw))return 'zaawansowany';
    return 'sredni';
  }

  function manualPlanGoal(value){
    const raw=text(value).toLowerCase();
    if(/technik|adapt/.test(raw))return 'adaptacja';
    if(/mas[ay]|hipertrof|budow|sylwet/.test(raw))return 'hipertrofia';
    if(/si[lł]/.test(raw))return 'sila';
    if(/redukc|odchudz/.test(raw))return 'redukcja';
    if(/sprawn/.test(raw))return 'sprawnosc';
    if(/sport|atlet/.test(raw))return 'sport';
    if(/powr[oó]t|return/.test(raw))return 'powrot';
    return raw||'inny';
  }

  function manualPlanSuggestedSplit(profile){
    const p=profile||{};
    const sessions=number(p.sessionsPerWeek,3,1,7);
    const beginner=manualPlanLevel(p.level)==='poczatkujacy';
    if(sessions<=2)return{
      split:'FBW',
      message:'Przy 1–2 sesjach rozważ FBW A/B: łatwiej powtórzyć główne wzorce bez przeładowania jednego dnia.'
    };
    if(beginner&&sessions<=3)return{
      split:'FBW',
      message:'Dla osoby początkującej 2–3 dni FBW zwykle upraszczają naukę wzorców i kontrolę objętości.'
    };
    if(sessions===4)return{
      split:'Upper Lower',
      message:'Przy 4 sesjach Upper/Lower jest prostym punktem startowym; PPL też może działać przy rotowanej kolejce dni.'
    };
    return{
      split:'PPL',
      message:'Przy 5–6 sesjach PPL umożliwia naturalne rozłożenie pracy. To sugestia, nie blokada.'
    };
  }

  function manualPlanDefaultWeeks(length,deloadEnabled){
    const count=number(length,8,1,52);
    const weeks=[];
    for(let i=0;i<count;i++)weeks.push({
      id:'w'+(i+1),
      number:i+1,
      label:'Tydzień '+(i+1),
      phase:i===0?'wejście':'progresja',
      deload:false,
      intensityTarget:''
    });
    if(deloadEnabled&&count>=4){
      const last=weeks[weeks.length-1];
      last.phase='deload';last.deload=true;last.intensityTarget='RIR 3–4';
    }
    return weeks;
  }

  function manualPlanDefaultMeta(plan,client){
    const p=plan||{};
    const c=client||{};
    const level=manualPlanLevel(p.level||c.level);
    const goal=manualPlanGoal(p.goal||c.goal);
    const sessions=Math.max(1,(p.days||[]).filter(day=>day&&!day.rest).length||number(c.sessionsPerWeek,3,1,7));
    const split=MANUAL_PLAN_SPLITS.includes(p.method)?p.method:manualPlanSuggestedSplit({level,sessionsPerWeek:sessions}).split;
    const duration=number(p.duration,8,1,52);
    const progression=String(p.progression||'double');
    return {
      version:MANUAL_PLAN_SCHEMA_VERSION,
      mode:'guided',
      clientProfile:{
        level,
        goal,
        trainingAge:text(c.trainingAge||c.experience||c.staz),
        sessionsPerWeek:sessions,
        sessionMinutes:number(c.sessionMinutes||c.duration,60,15,300),
        equipment:list(c.availableEquipment||c.equipment),
        mobilityLimits:text(c.mobilityLimits||c.limitations),
        reportedIssues:text(c.injuries||c.dolegliwosci),
        preferences:text(c.preferences),
        excludedExercises:list(c.excludedExercises)
      },
      structure:{
        split,
        customSplit:'',
        suggestion:manualPlanSuggestedSplit({level,sessionsPerWeek:sessions})
      },
      priorities:{primary:'none',secondary:'',custom:''},
      periodization:{
        strategy:'stały',
        durationWeeks:duration,
        deloadEnabled:false,
        weeks:manualPlanDefaultWeeks(duration,false),
        customRule:''
      },
      progression:{
        type:MANUAL_PLAN_PROGRESSIONS.includes(progression)?progression:'double',
        repRange:'8–12',
        defaultSets:3,
        rirStart:'3',
        rirEnd:'1',
        loadMode:'kg',
        loadStepKg:2.5,
        loadStepPercent:'',
        rule:''
      },
      intensity:{
        mode:'rir',
        globalTarget:'2',
        weeklyTargets:[],
        allowExerciseOverride:true
      },
      trainingMethods:['straight_sets'],
      analysis:{volume:null,movement:null,frequency:null,balance:null,time:null,warnings:[]}
    };
  }

  function manualPlanNormalizeMeta(raw,plan,client){
    const base=manualPlanDefaultMeta(plan,client);
    const data=raw&&typeof raw==='object'?raw:{};
    const sourceProfile=data.clientProfile||{};
    const sourceStructure=data.structure||{};
    const sourcePeriod=data.periodization||{};
    const sourceProgression=data.progression||{};
    const sourceIntensity=data.intensity||{};
    const duration=number(sourcePeriod.durationWeeks,base.periodization.durationWeeks,1,52);
    const deloadEnabled=!!sourcePeriod.deloadEnabled;
    const rawWeeks=Array.isArray(sourcePeriod.weeks)&&sourcePeriod.weeks.length?sourcePeriod.weeks:manualPlanDefaultWeeks(duration,deloadEnabled);
    const weeks=rawWeeks.slice(0,duration).map((week,index)=>({
      id:text(week.id)||'w'+(index+1),number:index+1,label:text(week.label)||'Tydzień '+(index+1),
      phase:text(week.phase)||'progresja',deload:!!week.deload,intensityTarget:text(week.intensityTarget)
    }));
    while(weeks.length<duration)weeks.push(...manualPlanDefaultWeeks(duration-weeks.length,false).map((week,index)=>Object.assign(week,{id:'w'+(weeks.length+index+1),number:weeks.length+index+1,label:'Tydzień '+(weeks.length+index+1)})));
    if(deloadEnabled&&weeks.length&& !weeks.some(week=>week.deload)){
      const last=weeks[weeks.length-1];last.deload=true;last.phase='deload';last.intensityTarget=last.intensityTarget||'RIR 3–4';
    }
    const profile={
      level:manualPlanLevel(sourceProfile.level||base.clientProfile.level),
      sessionsPerWeek:number(sourceProfile.sessionsPerWeek,base.clientProfile.sessionsPerWeek,1,7)
    };
    const split=text(sourceStructure.split)||base.structure.split;
    const sourcePriorities=data.priorities&&typeof data.priorities==='object'?data.priorities:{};
    const primaryPriority=MANUAL_PLAN_PRIORITIES.includes(text(sourcePriorities.primary))?text(sourcePriorities.primary):base.priorities.primary;
    const secondaryPriority=MANUAL_PLAN_PRIORITIES.includes(text(sourcePriorities.secondary))&&text(sourcePriorities.secondary)!==primaryPriority?text(sourcePriorities.secondary):'';
    return {
      version:MANUAL_PLAN_SCHEMA_VERSION,
      mode:data.mode==='advanced'?'advanced':'guided',
      clientProfile:{
        level:profile.level,
        goal:manualPlanGoal(sourceProfile.goal||base.clientProfile.goal),
        trainingAge:text(sourceProfile.trainingAge||base.clientProfile.trainingAge),
        sessionsPerWeek:profile.sessionsPerWeek,
        sessionMinutes:number(sourceProfile.sessionMinutes,base.clientProfile.sessionMinutes,15,300),
        equipment:list(sourceProfile.equipment||base.clientProfile.equipment),
        mobilityLimits:text(sourceProfile.mobilityLimits||base.clientProfile.mobilityLimits),
        reportedIssues:text(sourceProfile.reportedIssues||base.clientProfile.reportedIssues),
        preferences:text(sourceProfile.preferences||base.clientProfile.preferences),
        excludedExercises:list(sourceProfile.excludedExercises||base.clientProfile.excludedExercises)
      },
      structure:{split:MANUAL_PLAN_SPLITS.includes(split)?split:'Własny split',customSplit:text(sourceStructure.customSplit),suggestion:manualPlanSuggestedSplit(profile)},
      priorities:{primary:primaryPriority,secondary:secondaryPriority,custom:text(sourcePriorities.custom)},
      periodization:{
        strategy:MANUAL_PLAN_PERIODIZATION.includes(sourcePeriod.strategy)?sourcePeriod.strategy:base.periodization.strategy,
        durationWeeks:duration,deloadEnabled,weeks,customRule:text(sourcePeriod.customRule)
      },
      progression:{
        type:MANUAL_PLAN_PROGRESSIONS.includes(sourceProgression.type)?sourceProgression.type:base.progression.type,
        repRange:text(sourceProgression.repRange)||base.progression.repRange,
        defaultSets:number(sourceProgression.defaultSets,base.progression.defaultSets,1,20),
        rirStart:text(sourceProgression.rirStart)||base.progression.rirStart,
        rirEnd:text(sourceProgression.rirEnd)||base.progression.rirEnd,
        loadMode:text(sourceProgression.loadMode)||base.progression.loadMode,
        loadStepKg:number(sourceProgression.loadStepKg,base.progression.loadStepKg,0,100),
        loadStepPercent:text(sourceProgression.loadStepPercent),rule:text(sourceProgression.rule)
      },
      intensity:{
        mode:MANUAL_PLAN_INTENSITY.includes(sourceIntensity.mode)?sourceIntensity.mode:base.intensity.mode,
        globalTarget:text(sourceIntensity.globalTarget)||base.intensity.globalTarget,
        weeklyTargets:Array.isArray(sourceIntensity.weeklyTargets)?copy(sourceIntensity.weeklyTargets):[],
        allowExerciseOverride:sourceIntensity.allowExerciseOverride!==false
      },
      trainingMethods:list(data.trainingMethods||base.trainingMethods).filter(method=>MANUAL_PLAN_METHODS.includes(method)),
      analysis:data.analysis&&typeof data.analysis==='object'?copy(data.analysis):copy(base.analysis)
    };
  }

  function manualPlanRead(plan,client){
    return manualPlanNormalizeMeta(plan&&plan.manualPlan,plan,client);
  }

  function manualPlanAttach(plan,meta,client){
    const next=Object.assign({},plan||{});
    next.manualPlan=manualPlanNormalizeMeta(meta,next,client);
    next.manualPlanSchemaVersion=MANUAL_PLAN_SCHEMA_VERSION;
    return next;
  }

  function manualPlanExerciseDefaults(exercise){
    const ex=exercise||{};
    return {
      primaryMuscles:list(ex.primaryMuscles||ex.muscle||ex.muscleGroup),
      secondaryMuscles:list(ex.secondaryMuscles),
      movementPattern:text(ex.movementPattern),
      plane:text(ex.plane),
      trainingMethod:text(ex.trainingMethod)||'straight_sets',
      progressionRule:text(ex.progressionRule),
      intensityOverride:ex.intensityOverride&&typeof ex.intensityOverride==='object'?copy(ex.intensityOverride):null
    };
  }

  const esc=value=>String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const goalLabels={adaptacja:'Nauka techniki / adaptacja',hipertrofia:'Hipertrofia',sila:'Siła',redukcja:'Redukcja',sprawnosc:'Poprawa sprawności',sport:'Przygotowanie sportowe',powrot:'Powrót do treningu',inny:'Inny'};
  const periodHelp={
    stały:'Stały schemat: te same główne parametry, a progresję regulujesz osobną zasadą.',
    liniowa:'Liniowa: zmiana obciążenia lub powtórzeń w kolejnych tygodniach.',
    double:'Podwójna progresja: najpierw osiągnij górę zakresu powtórzeń, potem zwiększ obciążenie.',
    dup:'Falowa / DUP: parametry zmieniają się między jednostkami lub tygodniami.',
    blokowa:'Blokowa: kolejne etapy mają inne priorytety, np. objętość, potem intensywność.',
    step_loading:'Step loading: kilka tygodni narastania, potem decyzja o lżejszym tygodniu.',
    autoregulacja:'Autoregulacja: obciążenie i wysiłek dostosowujesz do bieżącej gotowości.',
    własna:'Własna: opisz zasadę tak, aby trener i klient rozumieli warunek progresji.'
  };

  function manualPlanLegacyMethod(meta){
    const split=meta&&meta.structure&&meta.structure.split;
    return ['PPL','FBW','Upper Lower','Obwodowy','Arnold','Bro Split','Smolov','Własna'].includes(split)?split:'Własna';
  }

  function manualPlanLegacyProgression(meta){
    const type=meta&&meta.progression&&meta.progression.type;
    if(type==='load')return 'linear';
    if(type==='dup'||type==='density'||type==='volume')return 'wave';
    if(type==='własna'||type==='technique')return 'off';
    return 'double';
  }

  function manualPlanApplyToPlan(plan,meta,client){
    const normalized=manualPlanNormalizeMeta(meta,plan,client);
    const next=manualPlanAttach(plan,normalized,client);
    const weeks=normalized.periodization.weeks||[];
    if(weeks.length){
      next.weekKeys=weeks.map(week=>week.id);
      next.phases=Object.fromEntries(weeks.map(week=>[week.id,week.label+(week.phase?' — '+week.phase:'')]));
      next.currentWeek=next.weekKeys[0];
    }
    next.method=manualPlanLegacyMethod(normalized);
    next.duration=String(normalized.periodization.durationWeeks);
    next.progression=manualPlanLegacyProgression(normalized);
    return next;
  }

  function manualPlanEnsureModal(id){
    let modal=document.getElementById(id);
    if(!modal){
      modal=document.createElement('div');
      modal.id=id;modal.className='modal-ov';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function manualPlanClientOptions(selected){
    const clients=(window.CL||[]).filter(client=>client&&client.status!=='archived');
    if(!clients.length)return '<option value="">Brak aktywnych klientów</option>';
    return clients.map(client=>`<option value="${esc(client.id)}"${String(client.id)===String(selected)?' selected':''}>${esc(client.name||client.email||client.id)}</option>`).join('');
  }

  function openManualPlanPicker(clientId){
    const modal=manualPlanEnsureModal('m-manual-plan-entry');
    // Wejście z karty klienta przekazuje jego ID. Wejście z ekranu planów
    // zachowuje dotychczas zaznaczonego klienta w builderze.
    const selected=clientId||(document.getElementById('b-client')||{}).value||'';
    modal.innerHTML=`<div class="modal" style="max-width:760px;">
      <div class="modal-hdr"><div class="modal-title">NOWY PLAN RĘCZNY</div><button class="modal-close" onclick="closeM('m-manual-plan-entry')">×</button></div>
      <div class="modal-body">
        <div class="form-field"><label class="form-lbl">Dla kogo tworzysz plan?</label><select class="form-select" id="mpw-entry-client">${manualPlanClientOptions(selected)}</select></div>
        <div style="font-size:12px;color:var(--muted);line-height:1.55;margin:4px 0 14px;">Najpierw ustalimy decyzje programowe, a potem przejdziesz do obecnego, szczegółowego edytora ćwiczeń.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;">
          <button type="button" class="card" style="text-align:left;cursor:pointer;padding:16px;border-color:var(--accent);" onclick="manualPlanStart('guided')">
            <div style="font-weight:800;font-size:15px;margin-bottom:6px;">A. Kreator prowadzony</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.55;">Krok po kroku, krótkie wyjaśnienia „Dlaczego?” i kontrola podstawowych decyzji.</div>
          </button>
          <button type="button" class="card" style="text-align:left;cursor:pointer;padding:16px;" onclick="manualPlanStart('advanced')">
            <div style="font-weight:800;font-size:15px;margin-bottom:6px;">B. Tryb zaawansowany</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.55;">Najważniejsze ustawienia w jednym widoku. Możesz pominąć etap i dopracować go później.</div>
          </button>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeM('m-manual-plan-entry')">Anuluj</button><button class="btn btn-ghost" onclick="closeM('m-manual-plan-entry');goTo('templates')">Gotowy tydzień</button></div>
    </div>`;
    if(typeof openM==='function')openM('m-manual-plan-entry');
  }

  function manualPlanStart(mode){
    const clientId=(document.getElementById('mpw-entry-client')||{}).value||'';
    const client=(window.CL||[]).find(item=>item&&item.id===clientId);
    if(!client){if(typeof notify==='function')notify('Wybierz aktywnego klienta');return;}
    const meta=manualPlanDefaultMeta({},client);
    meta.mode=mode==='advanced'?'advanced':'guided';
    window._manualPlanWizard={clientId,step:1,meta};
    if(typeof closeM==='function')closeM('m-manual-plan-entry');
    manualPlanRenderWizard();
  }

  function manualPlanWizardState(){
    return window._manualPlanWizard||null;
  }

  function manualPlanProfileFields(meta){
    const p=meta.clientProfile;
    const levelOptions=[['poczatkujacy','Początkujący'],['sredni','Średniozaawansowany'],['zaawansowany','Zaawansowany']];
    const goalOptions=Object.entries(goalLabels);
    return `<div class="form-grid">
      <div class="form-field"><label class="form-lbl">Poziom zaawansowania <button type="button" class="edu-tip" title="Wpływa m.in. na złożoność planu, objętość i sposób progresji.">?</button></label><select class="form-select" id="mpw-level">${levelOptions.map(([v,l])=>`<option value="${v}"${p.level===v?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-lbl">Główny cel</label><select class="form-select" id="mpw-goal">${goalOptions.map(([v,l])=>`<option value="${v}"${p.goal===v?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-lbl">Staż treningowy</label><input class="form-input" id="mpw-training-age" value="${esc(p.trainingAge)}" placeholder="np. 18 miesięcy"></div>
      <div class="form-field"><label class="form-lbl">Treningi w tygodniu</label><input class="form-input" id="mpw-sessions" type="number" min="1" max="7" value="${p.sessionsPerWeek}"></div>
      <div class="form-field"><label class="form-lbl">Czas jednej jednostki (min)</label><input class="form-input" id="mpw-minutes" type="number" min="15" max="300" value="${p.sessionMinutes}"></div>
      <div class="form-field"><label class="form-lbl">Dostępny sprzęt</label><input class="form-input" id="mpw-equipment" value="${esc(p.equipment.join(', '))}" placeholder="np. hantle, wyciąg, maszyny"></div>
    </div>
    <div class="form-grid">
      <div class="form-field"><label class="form-lbl">Ograniczenia ruchowe</label><textarea class="form-input" id="mpw-mobility" rows="2" placeholder="Opcjonalnie">${esc(p.mobilityLimits)}</textarea></div>
      <div class="form-field"><label class="form-lbl">Dolegliwości zgłoszone przez klienta</label><textarea class="form-input" id="mpw-issues" rows="2" placeholder="Opis trenera — bez diagnozowania">${esc(p.reportedIssues)}</textarea></div>
      <div class="form-field"><label class="form-lbl">Preferencje treningowe</label><textarea class="form-input" id="mpw-preferences" rows="2" placeholder="np. hantle, krótsze sesje">${esc(p.preferences)}</textarea></div>
      <div class="form-field"><label class="form-lbl">Ćwiczenia wykluczone</label><textarea class="form-input" id="mpw-excluded" rows="2" placeholder="Rozdziel przecinkami">${esc(p.excludedExercises.join(', '))}</textarea></div>
    </div>`;
  }

  const priorityLabels={none:'Brak szczególnego priorytetu',klatka:'Klatka piersiowa',plecy:'Plecy',barki:'Barki',ramiona:'Ramiona',posladki:'Pośladki',nogi:'Nogi',core:'Core',wlasny:'Własny priorytet'};

  function manualPlanGoalFields(meta){
    const p=meta.clientProfile;
    const levelOptions=[['poczatkujacy','Początkujący'],['sredni','Średniozaawansowany'],['zaawansowany','Zaawansowany']];
    return `<div class="form-grid">
      <div class="form-field"><label class="form-lbl">Główny cel</label><select class="form-select" id="mpw-goal">${Object.entries(goalLabels).map(([v,l])=>`<option value="${v}"${p.goal===v?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-lbl">Poziom doświadczenia</label><select class="form-select" id="mpw-level">${levelOptions.map(([v,l])=>`<option value="${v}"${p.level===v?' selected':''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="manual-plan-why"><b>Dlaczego to sugerujemy?</b> Cel i doświadczenie pozwalają dobrać prostotę struktury oraz bezpieczny punkt startowy objętości. Każdą decyzję później zmienisz.</div>
    <details class="manual-plan-more"><summary>Więcej danych o kliencie</summary><div class="form-grid" style="margin-top:12px;"><div class="form-field"><label class="form-lbl">Staż treningowy</label><input class="form-input" id="mpw-training-age" value="${esc(p.trainingAge)}" placeholder="np. 18 miesięcy"></div><div class="form-field"><label class="form-lbl">Sprzęt</label><input class="form-input" id="mpw-equipment" value="${esc(p.equipment.join(', '))}" placeholder="np. hantle, wyciąg, maszyny"></div><div class="form-field"><label class="form-lbl">Preferencje</label><input class="form-input" id="mpw-preferences" value="${esc(p.preferences)}" placeholder="np. krótsze sesje"></div><div class="form-field"><label class="form-lbl">Ćwiczenia wykluczone</label><input class="form-input" id="mpw-excluded" value="${esc(p.excludedExercises.join(', '))}" placeholder="Rozdziel przecinkami"></div></div></details>`;
  }

  function manualPlanPrioritiesFields(meta){
    const p=meta.priorities||{};
    const options=allowNone=>MANUAL_PLAN_PRIORITIES.filter(value=>allowNone||value!=='none').map(value=>`<option value="${value}"${p[allowNone?'primary':'secondary']===value?' selected':''}>${priorityLabels[value]}</option>`).join('');
    return `<div class="form-grid"><div class="form-field"><label class="form-lbl">PRIORYTET 1</label><select class="form-select" id="mpw-priority-primary">${options(true)}</select></div><div class="form-field"><label class="form-lbl">PRIORYTET 2 <span style="color:var(--muted);font-weight:400;">(opcjonalnie)</span></label><select class="form-select" id="mpw-priority-secondary"><option value="">Bez drugiego priorytetu</option>${options(false)}</select></div></div><div class="form-field"><label class="form-lbl">Własny priorytet <span style="color:var(--muted);font-weight:400;">(opcjonalnie)</span></label><input class="form-input" id="mpw-priority-custom" value="${esc(p.custom)}" placeholder="np. chwyt, przygotowanie do biegu"></div><div class="manual-plan-why"><b>Dlaczego to sugerujemy?</b> Priorytet pomaga ułożyć ważniejsze ćwiczenia wcześniej i kontrolować ich objętość. Nie jest sztywną regułą — regeneracja oraz reszta planu nadal mają znaczenie.</div>`;
  }

  function manualPlanWeekFields(meta){
    const p=meta.clientProfile;
    return `<div class="form-grid"><div class="form-field"><label class="form-lbl">Treningi w tygodniu</label><input class="form-input" id="mpw-sessions" type="number" min="1" max="7" value="${p.sessionsPerWeek}"></div><div class="form-field"><label class="form-lbl">Czas jednej jednostki (min)</label><input class="form-input" id="mpw-minutes" type="number" min="15" max="300" value="${p.sessionMinutes}"></div></div>${manualPlanStructureFields(meta)}<div class="manual-plan-why"><b>Dlaczego to sugerujemy?</b> Przy 3 treningach Full Body ułatwia częstsze bodźcowanie całego ciała. To punkt startowy, a nie obowiązek.</div>`;
  }

  function manualPlanExerciseStepFields(meta){
    const p=meta.periodization||{};
    return `<div class="card" style="padding:14px;background:var(--s3);"><b>Za chwilę przejdziesz do ćwiczeń.</b><div style="margin-top:6px;font-size:13px;line-height:1.55;color:var(--text-secondary);">W edytorze dodasz ćwiczenie, serie, powtórzenia, RIR i przerwę. Biomechanikę otworzysz ikoną ⓘ przy danym ćwiczeniu — nie będzie zasłaniała planu.</div></div><div class="form-grid" style="margin-top:14px;"><div class="form-field"><label class="form-lbl">Długość programu</label><select class="form-select" id="mpw-weeks">${[4,6,8,10,12].map(value=>`<option value="${value}"${p.durationWeeks===value?' selected':''}>${value} tygodni</option>`).join('')}</select></div><div class="form-field"><label class="form-lbl">Deload <span style="color:var(--muted);font-weight:400;">(opcjonalnie)</span></label><label class="manual-plan-check"><input type="checkbox" id="mpw-deload"${p.deloadEnabled?' checked':''}> Dodaj lżejszy tydzień</label></div></div><div class="manual-plan-why"><b>Dlaczego to sugerujemy?</b> Najpierw budujemy prostą strukturę, a szczegóły ćwiczeń dobieramy dopiero wtedy, gdy znamy cel, priorytety i dostępny czas.</div>`;
  }

  function manualPlanGuidedReview(meta){
    const profile=meta.clientProfile||{},priority=meta.priorities||{};
    const primary=priority.primary==='wlasny'?(priority.custom||'własny priorytet'):(priorityLabels[priority.primary]||priorityLabels.none);
    const secondary=priority.secondary?(priority.secondary==='wlasny'?(priority.custom||'własny priorytet'):priorityLabels[priority.secondary]):'';
    return `<div class="manual-plan-ready"><div class="manual-plan-ready-icon">✓</div><div><b>Plan ma poprawne podstawy.</b><div style="margin-top:4px;color:var(--text-secondary);font-size:13px;line-height:1.55;">W kolejnym widoku dodasz ćwiczenia i zobaczysz krótką analizę częstotliwości, objętości, priorytetów oraz regeneracji.</div></div></div><div class="manual-plan-summary"><div><span>Cel</span><b>${esc(goalLabels[profile.goal]||profile.goal)}</b></div><div><span>Priorytet</span><b>${esc(primary)}${secondary?' + '+esc(secondary):''}</b></div><div><span>Tydzień</span><b>${profile.sessionsPerWeek} treningi · ${esc(meta.structure&&meta.structure.split)}</b></div><div><span>Progresja</span><b>${esc(meta.progression&&meta.progression.type==='double'?'Podwójna progresja':meta.progression&&meta.progression.type||'do ustalenia')}</b></div></div>`;
  }

  function manualPlanWizardCoach(step,meta){
    const p=meta.priorities||{};
    const primary=p.primary==='wlasny'?(p.custom||'wybrany priorytet'):(priorityLabels[p.primary]||'wybrany priorytet');
    const messages={
      1:'Określ główny cel i poziom klienta. Na tej podstawie uprościmy kolejne rekomendacje.',
      2:`Wybierz partię, na której klientowi najbardziej zależy. Uwzględnię „${primary}” przy kolejności ćwiczeń i analizie objętości.`,
      3:'Dobieramy liczbę sesji i strukturę tygodnia. Sugestia ma pomagać, nie blokować Twojej decyzji.',
      4:'Na start proste serie są najłatwiejsze do kontroli. Metody intensyfikacyjne dodawaj celowo, nie z rozpędu.',
      5:'Dla większości osób podwójna progresja jest czytelna: najpierw powtórzenia, potem najmniejszy dostępny skok ciężaru.',
      6:'Teraz przechodzimy do ćwiczeń. W edytorze zobaczysz tylko parametry potrzebne do pracy; szczegóły są pod „Więcej” i ⓘ.',
      7:'Podstawy są gotowe. Analiza po dodaniu ćwiczeń sprawdzi strukturę, ale decyzja zawsze zostaje po stronie trenera.'
    };
    return `<aside class="manual-plan-coach"><div class="manual-plan-coach-label">ASYSTENT NA TYM KROKU</div><div>${esc(messages[step]||messages[1])}</div><button type="button" class="btn btn-ghost btn-sm" onclick="manualPlanOpenLearnMore()">Dowiedz się więcej</button></aside>`;
  }

  function manualPlanOpenLearnMore(){
    const state=manualPlanWizardState();if(!state)return;
    const modal=manualPlanEnsureModal('m-manual-plan-learn');
    const p=state.meta.priorities||{};
    const priority=p.primary==='wlasny'?(p.custom||'własnego priorytetu'):(priorityLabels[p.primary]||'braku szczególnego priorytetu');
    modal.innerHTML=`<div class="modal" style="max-width:620px;"><div class="modal-hdr"><div class="modal-title">DLACZEGO TAKI KROK?</div><button class="modal-close" onclick="closeM('m-manual-plan-learn')">×</button></div><div class="modal-body" style="font-size:13px;line-height:1.6;">Asystent najpierw zbiera decyzje, które zmieniają cały plan: cel, częstotliwość i priorytety. Dla ${esc(priority)} może potem zasugerować wcześniejsze miejsce w sesji oraz sprawdzić, czy ta partia nie została przypadkowo pominięta. To wskazówka programowa, nie diagnoza ani sztywna norma.</div><div class="modal-footer"><button class="btn btn-primary" onclick="closeM('m-manual-plan-learn')">Rozumiem</button></div></div>`;
    if(typeof openM==='function')openM('m-manual-plan-learn');
  }

  function manualPlanStructureFields(meta){
    const p=meta.clientProfile,structure=meta.structure;
    const suggestion=manualPlanSuggestedSplit(p);
    return `<div class="card" style="padding:12px;margin-bottom:14px;background:var(--s3);"><b>Sugestia aplikacji:</b> ${esc(suggestion.message)}</div>
      <div class="form-field"><label class="form-lbl">Struktura tygodnia</label><select class="form-select" id="mpw-split">${MANUAL_PLAN_SPLITS.map(split=>`<option value="${esc(split)}"${structure.split===split?' selected':''}>${esc(split)}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-lbl">Własna nazwa splitu <span style="color:var(--muted);font-weight:400;">(opcjonalnie)</span></label><input class="form-input" id="mpw-custom-split" value="${esc(structure.customSplit)}" placeholder="np. Dół / Góra / FBW"></div>
      <div style="font-size:12px;color:var(--muted);line-height:1.55;">To sugestia, nie blokada. Docelową kolejność i dni dopracujesz w edytorze jednostek.</div>`;
  }

  function manualPlanPeriodFields(meta){
    const p=meta.periodization;
    const labels={stały:'Brak / stały schemat',liniowa:'Liniowa',double:'Podwójna progresja',dup:'Falowa / DUP',blokowa:'Blokowa',step_loading:'Step loading',autoregulacja:'Autoregulacja',własna:'Własna'};
    return `<div class="form-grid">
      <div class="form-field"><label class="form-lbl">Model periodyzacji</label><select class="form-select" id="mpw-period" onchange="manualPlanPeriodHelp()">${MANUAL_PLAN_PERIODIZATION.map(value=>`<option value="${value}"${p.strategy===value?' selected':''}>${labels[value]}</option>`).join('')}</select><div id="mpw-period-help" class="edu-inline-hint" style="margin-top:8px;">${esc(periodHelp[p.strategy]||periodHelp.stały)}</div></div>
      <div class="form-field"><label class="form-lbl">Długość programu</label><select class="form-select" id="mpw-weeks">${[4,6,8,10,12].map(value=>`<option value="${value}"${p.durationWeeks===value?' selected':''}>${value} tygodni</option>`).join('')}</select></div>
    </div>
    <label class="builder-rest-toggle" style="display:flex;margin:10px 0 12px;"><input type="checkbox" id="mpw-deload"${p.deloadEnabled?' checked':''}> Dodaj deload do struktury mezocyklu</label>
    <div class="form-field"><label class="form-lbl">Własna zasada periodyzacji <span style="color:var(--muted);font-weight:400;">(opcjonalnie)</span></label><textarea class="form-input" id="mpw-period-rule" rows="2" placeholder="np. Tyg. 1 wejście, tyg. 2–4 progresja, tyg. 5 overload">${esc(p.customRule)}</textarea></div>`;
  }

  function manualPlanProgressionFields(meta){
    const p=meta.progression;
    const labels={load:'Progresja ciężaru',reps:'Progresja powtórzeń',double:'Podwójna progresja',sets:'Progresja serii',rir_rpe:'Progresja RIR / RPE',volume:'Progresja objętości',density:'Gęstość treningu',technique:'Technika / ROM / tempo',własna:'Własna zasada'};
    return `<div class="form-grid">
      <div class="form-field"><label class="form-lbl">Główna reguła progresji</label><select class="form-select" id="mpw-progression">${MANUAL_PLAN_PROGRESSIONS.map(value=>`<option value="${value}"${p.type===value?' selected':''}>${labels[value]}</option>`).join('')}</select><div class="edu-inline-hint" style="margin-top:8px;">Wybierz dominującą regułę. Poszczególne ćwiczenia zachowują możliwość własnej reguły.</div></div>
      <div class="form-field"><label class="form-lbl">Zakres powtórzeń domyślnie</label><input class="form-input" id="mpw-rep-range" value="${esc(p.repRange)}" placeholder="np. 8–12"></div>
      <div class="form-field"><label class="form-lbl">Serie domyślnie</label><input class="form-input" id="mpw-default-sets" type="number" min="1" max="20" value="${p.defaultSets}"></div>
      <div class="form-field"><label class="form-lbl">Krok ciężaru</label><div style="display:flex;gap:8px;"><select class="form-select" id="mpw-load-mode"><option value="kg"${p.loadMode==='kg'?' selected':''}>kg</option><option value="percent"${p.loadMode==='percent'?' selected':''}>%</option><option value="custom"${p.loadMode==='custom'?' selected':''}>własny</option></select><input class="form-input" id="mpw-load-step" type="number" min="0" step="0.5" value="${p.loadStepKg}"></div></div>
      <div class="form-field"><label class="form-lbl">RIR na początku</label><input class="form-input" id="mpw-rir-start" value="${esc(p.rirStart)}" placeholder="np. 3"></div>
      <div class="form-field"><label class="form-lbl">RIR pod koniec bloku</label><input class="form-input" id="mpw-rir-end" value="${esc(p.rirEnd)}" placeholder="np. 1–2"></div>
    </div>
    <div class="form-field"><label class="form-lbl">Warunek progresji / własna reguła</label><textarea class="form-input" id="mpw-progression-rule" rows="2" placeholder="np. Po osiągnięciu górnej granicy powtórzeń we wszystkich seriach zwiększ ciężar o najmniejszy dostępny skok.">${esc(p.rule)}</textarea></div>`;
  }

  function manualPlanIntensityFields(meta){
    const p=meta.intensity;
    const labels={rir:'RIR — powtórzenia w zapasie',rpe:'RPE — odczuwany wysiłek',pct_1rm:'% 1RM',fixed_load:'Stały ciężar',rep_range:'Zakres powtórzeń',własna:'Własna metoda'};
    return `<div class="form-grid">
      <div class="form-field"><label class="form-lbl">Główna metoda intensywności</label><select class="form-select" id="mpw-intensity-mode">${MANUAL_PLAN_INTENSITY.map(value=>`<option value="${value}"${p.mode===value?' selected':''}>${labels[value]}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-lbl">Cel domyślny</label><input class="form-input" id="mpw-intensity-target" value="${esc(p.globalTarget)}" placeholder="np. RIR 2 lub RPE 8"></div>
    </div>
    <label class="builder-rest-toggle" style="display:flex;margin:10px 0 12px;"><input type="checkbox" id="mpw-intensity-override"${p.allowExerciseOverride?' checked':''}> Pozwól trenerowi nadpisać intensywność w pojedynczym ćwiczeniu</label>
    <div class="card" style="padding:12px;background:var(--s3);font-size:12px;line-height:1.55;"><b>Dlaczego?</b> RIR, RPE i %1RM są różnymi narzędziami. Aplikacja zapisuje wybrany język wysiłku, ale nie udaje, że jeden wskaźnik idealnie opisuje każdą osobę i każde ćwiczenie.</div>`;
  }

  function manualPlanMethodsFields(meta,simple){
    const selected=new Set(meta.trainingMethods||[]);
    const labels={straight_sets:'Serie proste',superset:'Superserie',combined_sets:'Serie łączone',circuit:'Obwód',drop_set:'Drop set',rest_pause:'Rest-pause',myo_reps:'Myo-reps',cluster_set:'Cluster set',top_set_backoff:'Top set + back-off',pyramid:'Piramida',reverse_pyramid:'Odwrócona piramida',tempo:'Tempo kontrolowane',pause_reps:'Pauzy',amrap:'AMRAP',własna:'Własna metoda'};
    const cards=methods=>`<div class="manual-plan-method-grid">${methods.map(method=>`<label class="manual-plan-method-option${selected.has(method)?' is-selected':''}"><input type="checkbox" data-mpw-method="${method}"${selected.has(method)?' checked':''} onchange="manualPlanToggleMethod(this)"><span>${esc(labels[method])}</span></label>`).join('')}</div>`;
    const basic=['straight_sets','superset','circuit','tempo'];
    return `<div style="font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:12px;">Wybierz metody dostępne w tym programie. Zaznaczenie nie oznacza obowiązku użycia.</div>${cards(simple?basic:MANUAL_PLAN_METHODS)}${simple?`<details class="manual-plan-more"><summary>Więcej metod i ustawień</summary><div style="margin-top:10px;">${cards(MANUAL_PLAN_METHODS.filter(method=>!basic.includes(method)))}</div></details>`:''}<div class="manual-plan-why"><b>Dlaczego to sugerujemy?</b> Metody zwiększające gęstość lub pracę blisko upadku zachowaj zwykle dla ćwiczeń stabilnych, w których technika jest przewidywalna.</div>`;
  }

  function manualPlanToggleMethod(input){
    const option=input&&input.closest?input.closest('.manual-plan-method-option'):null;
    if(option)option.classList.toggle('is-selected',!!input.checked);
  }

  function manualPlanProgress(mode,step){
    const labels=['Cel','Priorytet','Tydzień','Metoda','Progresja','Ćwiczenia','Gotowe'];
    const current=mode==='advanced'?7:step;
    const milestones=mode==='advanced'?'Ustawienia programu':labels.map((label,index)=>`<span class="${index+1===current?'is-current':index+1<current?'is-done':''}">${index+1<current?'✓ ':''}${label}</span>`).join('<i>→</i>');
    return `<div class="manual-plan-progress"><div class="manual-plan-progress-top"><span>KROK ${current}/${mode==='advanced'?7:labels.length} — ${mode==='advanced'?'Ustawienia programu':labels[current-1]}</span><span>${mode==='advanced'?'Tryb zaawansowany':'Asystent krok po kroku'}</span></div><div class="manual-plan-progress-line"><div style="width:${Math.round(current/(mode==='advanced'?7:labels.length)*100)}%;"></div></div><div class="manual-plan-progress-labels">${milestones}</div></div>`;
  }

  function manualPlanRenderWizard(){
    const state=manualPlanWizardState();if(!state)return;
    const meta=state.meta;
    const advanced=meta.mode==='advanced';
    const step=state.step||1;
    let content='';
    if(advanced){
      content=`<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:14px;">Ustaw podstawy programu w jednym widoku. Każdy parametr możesz zmienić później.</div>${manualPlanProfileFields(meta)}<hr style="border:0;border-top:1px solid var(--border);margin:16px 0;">${manualPlanPrioritiesFields(meta)}<hr style="border:0;border-top:1px solid var(--border);margin:16px 0;">${manualPlanStructureFields(meta)}<hr style="border:0;border-top:1px solid var(--border);margin:16px 0;">${manualPlanPeriodFields(meta)}<hr style="border:0;border-top:1px solid var(--border);margin:16px 0;">${manualPlanProgressionFields(meta)}<hr style="border:0;border-top:1px solid var(--border);margin:16px 0;">${manualPlanIntensityFields(meta)}<hr style="border:0;border-top:1px solid var(--border);margin:16px 0;">${manualPlanMethodsFields(meta)}`;
    }else if(step===1){
      content=manualPlanGoalFields(meta);
    }else if(step===2){content=manualPlanPrioritiesFields(meta);}
    else if(step===3){content=manualPlanWeekFields(meta);}
    else if(step===4){content=manualPlanMethodsFields(meta,true);}
    else if(step===5){content=manualPlanProgressionFields(meta)+`<details class="manual-plan-more"><summary>Więcej ustawień intensywności</summary><div style="margin-top:12px;">${manualPlanIntensityFields(meta)}</div></details>`;}
    else if(step===6){content=manualPlanExerciseStepFields(meta);}
    else{content=manualPlanGuidedReview(meta);}
    const footer=advanced
      ?`<button class="btn btn-ghost" onclick="closeM('m-manual-plan-wizard')">Anuluj</button><button class="btn btn-primary" onclick="manualPlanOpenBuilder()">Przejdź do budowania jednostek</button>`
      :`<button class="btn btn-ghost" ${step===1?'disabled':''} onclick="manualPlanWizardBack()">Wstecz</button><button class="btn btn-primary" onclick="manualPlanWizardNext()">${step===7?'Przejdź do ćwiczeń':step===6?'Podsumowanie':'Dalej'}</button>`;
    const modal=manualPlanEnsureModal('m-manual-plan-wizard');
    modal.innerHTML=`<div class="modal" style="max-width:900px;max-height:88vh;display:flex;flex-direction:column;"><div class="modal-hdr"><div class="modal-title">PLAN RĘCZNY — ${advanced?'USTAWIENIA PROGRAMU':'KREATOR'}</div><button class="modal-close" onclick="closeM('m-manual-plan-wizard')">×</button></div><div class="modal-body" style="overflow:auto;">${manualPlanProgress(meta.mode,step)}${advanced?'':manualPlanWizardCoach(step,meta)}${content}</div><div class="modal-footer">${footer}</div></div>`;
    if(typeof openM==='function')openM('m-manual-plan-wizard');
  }

  function manualPlanSyncWizard(){
    const state=manualPlanWizardState();if(!state)return null;
    const meta=state.meta;
    const read=id=>document.getElementById(id);
    const value=id=>text((read(id)||{}).value);
    const checked=id=>!!((read(id)||{}).checked);
    if(read('mpw-level')){
      meta.clientProfile.level=manualPlanLevel(value('mpw-level'));
      meta.clientProfile.goal=manualPlanGoal(value('mpw-goal'));
      if(read('mpw-training-age'))meta.clientProfile.trainingAge=value('mpw-training-age');
      if(read('mpw-equipment'))meta.clientProfile.equipment=list(value('mpw-equipment'));
      if(read('mpw-mobility'))meta.clientProfile.mobilityLimits=value('mpw-mobility');
      if(read('mpw-issues'))meta.clientProfile.reportedIssues=value('mpw-issues');
      if(read('mpw-preferences'))meta.clientProfile.preferences=value('mpw-preferences');
      if(read('mpw-excluded'))meta.clientProfile.excludedExercises=list(value('mpw-excluded'));
    }
    if(read('mpw-sessions'))meta.clientProfile.sessionsPerWeek=number(value('mpw-sessions'),meta.clientProfile.sessionsPerWeek,1,7);
    if(read('mpw-minutes'))meta.clientProfile.sessionMinutes=number(value('mpw-minutes'),meta.clientProfile.sessionMinutes,15,300);
    if(read('mpw-priority-primary')){
      meta.priorities=meta.priorities||{};
      meta.priorities.primary=value('mpw-priority-primary');
      meta.priorities.secondary=value('mpw-priority-secondary');
      meta.priorities.custom=value('mpw-priority-custom');
    }
    if(read('mpw-split')){
      meta.structure.split=value('mpw-split');
      meta.structure.customSplit=value('mpw-custom-split');
      meta.structure.suggestion=manualPlanSuggestedSplit(meta.clientProfile);
    }
    if(read('mpw-period')){
      meta.periodization.strategy=value('mpw-period');
      meta.periodization.customRule=value('mpw-period-rule');
    }
    if(read('mpw-weeks'))meta.periodization.durationWeeks=number(value('mpw-weeks'),meta.periodization.durationWeeks,1,52);
    if(read('mpw-deload'))meta.periodization.deloadEnabled=checked('mpw-deload');
    if(read('mpw-period')||read('mpw-weeks')||read('mpw-deload'))meta.periodization.weeks=manualPlanDefaultWeeks(meta.periodization.durationWeeks,meta.periodization.deloadEnabled);
    if(read('mpw-progression')){
      meta.progression.type=value('mpw-progression');
      meta.progression.repRange=value('mpw-rep-range');
      meta.progression.defaultSets=number(value('mpw-default-sets'),meta.progression.defaultSets,1,20);
      meta.progression.loadMode=value('mpw-load-mode');
      meta.progression.loadStepKg=number(value('mpw-load-step'),meta.progression.loadStepKg,0,100);
      meta.progression.rirStart=value('mpw-rir-start');
      meta.progression.rirEnd=value('mpw-rir-end');
      meta.progression.rule=value('mpw-progression-rule');
    }
    if(read('mpw-intensity-mode')){
      meta.intensity.mode=value('mpw-intensity-mode');
      meta.intensity.globalTarget=value('mpw-intensity-target');
      meta.intensity.allowExerciseOverride=checked('mpw-intensity-override');
    }
    const methodInputs=document.querySelectorAll?document.querySelectorAll('[data-mpw-method]'):[];
    if(methodInputs.length)meta.trainingMethods=[...methodInputs].filter(input=>input.checked).map(input=>input.getAttribute('data-mpw-method'));
    state.meta=manualPlanNormalizeMeta(meta,{},{});
    return state.meta;
  }

  function manualPlanWizardNext(){
    const state=manualPlanWizardState();if(!state)return;
    manualPlanSyncWizard();
    if(state.step>=7){manualPlanOpenBuilder();return;}
    state.step++;
    manualPlanRenderWizard();
  }

  function manualPlanWizardBack(){
    const state=manualPlanWizardState();if(!state)return;
    manualPlanSyncWizard();state.step=Math.max(1,(state.step||1)-1);manualPlanRenderWizard();
  }

  function manualPlanPeriodHelp(){
    const sel=document.getElementById('mpw-period'),help=document.getElementById('mpw-period-help');
    if(help)help.textContent=periodHelp[sel&&sel.value]||periodHelp.stały;
  }

  function manualPlanOpenBuilder(){
    const state=manualPlanWizardState();if(!state)return;
    const meta=manualPlanSyncWizard()||state.meta;
    const client=(window.CL||[]).find(item=>item&&item.id===state.clientId)||{};
    if(typeof closeM==='function')closeM('m-manual-plan-wizard');
    if(typeof goTo==='function')goTo('builder');
    window._manualPlanDraft=manualPlanNormalizeMeta(meta,{},client);
    const clientSelect=document.getElementById('b-client');if(clientSelect)clientSelect.value=state.clientId;
    const method=document.getElementById('b-method');
    if(method){
      const legacy=manualPlanLegacyMethod(window._manualPlanDraft);
      if(typeof builderEnsureSelectValue==='function')builderEnsureSelectValue(method,legacy,legacy);
      else method.value=legacy;
    }
    const duration=document.getElementById('b-duration');
    if(duration&&typeof builderEnsureSelectValue==='function')builderEnsureSelectValue(duration,window._manualPlanDraft.periodization.durationWeeks,window._manualPlanDraft.periodization.durationWeeks+' tygodni');
    const progression=document.getElementById('b-progression');
    if(progression)progression.value=manualPlanLegacyProgression(window._manualPlanDraft);
    const name=document.getElementById('b-name');
    if(name&&!name.value.trim())name.value=(client.name?client.name+' — ':'')+(goalLabels[window._manualPlanDraft.clientProfile.goal]||'Plan treningowy');
    const dayBox=document.getElementById('builder-days');
    if(dayBox&&!dayBox.querySelector('.builder-day')&&typeof addDay==='function'){
      for(let i=0;i<window._manualPlanDraft.clientProfile.sessionsPerWeek;i++)addDay();
      const priorities=window._manualPlanDraft.priorities||{};
      const focus=[priorities.primary,priorities.secondary].filter(value=>value&&value!=='none').map(value=>value==='wlasny'?(priorities.custom||'Priorytet'):priorityLabels[value]);
      [...dayBox.querySelectorAll('.builder-day-focus')].forEach((input,index)=>{if(input&&!input.value&&focus[index])input.value=focus[index];});
    }
    if(typeof updatePeriod==='function')updatePeriod();
    if(typeof builderRefreshRationale==='function')builderRefreshRationale();
    manualPlanUpdateBuilderAssistant();
    manualPlanShowAnalysis();
    window._manualPlanWizard=null;
  }

  function manualPlanUpdateBuilderAssistant(){
    if(typeof document==='undefined'||!window._manualPlanDraft)return;
    const priority=(window._manualPlanDraft.priorities||{}).primary;
    const label=priority==='wlasny'?((window._manualPlanDraft.priorities||{}).custom||'wybrany priorytet'):(priorityLabels[priority]||'plan');
    const bubble=document.querySelector('#ai-msgs .ai-msg.bot .ai-bubble');
    if(bubble)bubble.textContent=priority&&priority!=='none'?`Priorytet: ${label}. Dodaj najważniejsze ćwiczenia tej partii wcześniej w odpowiedniej jednostce; potem sprawdź analizę planu.`:'Dodaj ćwiczenia, a na końcu otwórz Analizę planu. Pokaże krótkie wskazówki o objętości, wzorcach i regeneracji.';
  }

  function manualPlanSetCount(value){
    const parsed=parseInt(value,10);
    return Number.isFinite(parsed)&&parsed>0?parsed:3;
  }

  function manualPlanBio(ex){
    if(ex&&ex.biomech)return ex.biomech;
    if(typeof exerciseBiomech==='function')return exerciseBiomech(ex||{});
    return {pattern:(ex&&ex.pattern)||'other',prime:(ex&&(ex.muscle||ex.cat))||'nieokreślona',compound:!!(ex&&ex.compound),stable:!!(ex&&ex.stable)};
  }

  function manualPlanExerciseProgramming(ex){
    const bio=manualPlanBio(ex);
    const pattern=text(bio.pattern)||'other';
    const direction=/^vertical_/.test(pattern)?'vertical':/^horizontal_/.test(pattern)?'horizontal':'local';
    return {
      primaryMuscles:list(bio.prime),
      secondaryMuscles:list(bio.secondary),
      accessoryMuscles:list(bio.accessory),
      movementPattern:pattern,
      plane:text(bio.plane)||'context_dependent',
      tags:{
        role:bio.compound?'compound':'isolation_or_accessory',
        stability:bio.stable?'stable':'less_stable',
        laterality:bio.unilateral?'unilateral':'bilateral_or_unspecified',
        direction,
        lengthBias:text(bio.lengthBias)||'context_dependent'
      },
      evidenceNote:text(bio.biasSource)||'Klasyfikacja pomaga analizować plan; potwierdź tor ruchu i konkretny sprzęt.'
    };
  }

  const manualPlanPatternLabels={
    horizontal_push:'pchanie poziome',vertical_push:'pchanie pionowe',
    horizontal_pull:'przyciąganie poziome',vertical_pull:'przyciąganie pionowe',
    knee_dominant:'dominacja kolana',hip_dominant:'dominacja biodra',
    knee_flexion:'zgięcie kolana',shoulder_abduction:'odwiedzenie barku',
    elbow_flexion:'zgięcie łokcia',elbow_extension:'wyprost łokcia',
    shoulder_extension:'wyprost ramienia',scapular_rear_delt:'łopatka / tylny bark',
    core:'core',cardio:'cardio',other:'do określenia'
  };
  const manualPlanPlaneLabels={sagittal:'strzałkowa',frontal:'czołowa',transverse:'poprzeczna',context_dependent:'zależna od wariantu'};
  const manualPlanTagLabels={
    compound:'wielostawowe',isolation_or_accessory:'izolacja / dodatek',
    stable:'stabilne',less_stable:'mniej stabilne',unilateral:'jednostronne',
    bilateral_or_unspecified:'obustronne / bez doprecyzowania',vertical:'pion',horizontal:'poziom',local:'lokalny wzorzec',
    lengthened:'akcent wydłużenia',mid_range:'środek zakresu',shortened:'akcent skrócenia',context_dependent:'profil zależny od wariantu'
  };

  function manualPlanExerciseSummary(ex){
    const bio=manualPlanBio(ex||{});
    const programming=manualPlanExerciseProgramming(ex||{});
    return {
      primary:text(bio.prime)||'nieokreślona',
      secondary:list(bio.secondary),accessory:list(bio.accessory),
      pattern:text(bio.pattern)||'other',plane:text(bio.plane)||'context_dependent',
      tags:programming.tags||{},evidenceNote:programming.evidenceNote||''
    };
  }

  function manualPlanMuscleRecord(primary){
    const records=Array.isArray(window.MUSCLE_BIOMECH_RECORDS)?window.MUSCLE_BIOMECH_RECORDS:[];
    const normalize=value=>text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l');
    const key=normalize(primary);
    return records.find(record=>normalize(record.name).includes(key)||list(record.tags).some(tag=>normalize(tag)===key))||null;
  }

  function manualPlanExerciseBiomechModal(ex,expanded){
    const summary=manualPlanExerciseSummary(ex||{});
    const record=manualPlanMuscleRecord(summary.primary);
    const functionText=(record&&record.functions)||('Wzorzec: '+(manualPlanPatternLabels[summary.pattern]||summary.pattern)+'.');
    const romText=(record&&record.rom)||'Pełny, kontrolowany i tolerowany zakres ruchu; ogranicz go, gdy technika lub komfort wyraźnie się pogarszają.';
    const cueText=(record&&record.coach)||'Dobierz tor, ustawienie i obciążenie tak, aby utrzymać kontrolę ruchu oraz komfort klienta.';
    const title=text(ex&&ex.name)||'Ćwiczenie';
    const detailRows=record&&expanded?[
      ['Funkcja',record.functions],['Biomechanika',record.biomechanics],['Płaszczyzna',record.plane],['ROM',record.rom],['Profil oporu',record.resistance],['Ustawienie / cue',record.setup],['Typowe błędy',record.errors],['Kiedy zmodyfikować wariant',record.modifications],['Dlaczego?',record.evidence]
    ].filter(([,value])=>text(value)).map(([label,value])=>`<section style="padding:11px 0;border-top:1px solid var(--border);"><b style="font-size:11px;color:var(--accent);letter-spacing:.04em;text-transform:uppercase;">${esc(label)}</b><div style="margin-top:5px;font-size:13px;line-height:1.55;">${esc(value)}</div></section>`).join(''):'';
    const modal=manualPlanEnsureModal('m-manual-plan-exercise-biomech');
    modal.innerHTML=`<div class="modal" style="max-width:680px;"><div class="modal-hdr"><div class="modal-title">${expanded?'BIOMECHANIKA — SZCZEGÓŁY':'BIOMECHANIKA'}</div><button class="modal-close" onclick="closeM('m-manual-plan-exercise-biomech')">×</button></div><div class="modal-body"><div style="font-size:14px;font-weight:800;margin-bottom:12px;">${esc(title)}</div>${expanded?detailRows:`<div style="display:grid;gap:9px;"><div class="card-sm" style="padding:10px;"><b>Główna funkcja</b><div style="margin-top:4px;font-size:13px;line-height:1.5;">${esc(functionText)}</div></div><div class="card-sm" style="padding:10px;"><b>Zakres</b><div style="margin-top:4px;font-size:13px;line-height:1.5;">${esc(romText)}</div></div><div class="card-sm" style="padding:10px;"><b>Wskazówka</b><div style="margin-top:4px;font-size:13px;line-height:1.5;">${esc(cueText)}</div></div><div style="font-size:12px;color:var(--muted);">${esc(summary.primary)} · ${esc(manualPlanPatternLabels[summary.pattern]||summary.pattern)} · ${esc(manualPlanPlaneLabels[summary.plane]||summary.plane)}</div></div>`}</div><div class="modal-footer">${expanded?'<button class="btn btn-ghost" onclick="manualPlanBiomechShowQuick()">Wróć do skrótu</button>':'<button class="btn btn-ghost" onclick="manualPlanBiomechShowMore()">Dowiedz się więcej</button>'}<button class="btn btn-primary" onclick="closeM('m-manual-plan-exercise-biomech')">Gotowe</button></div></div>`;
    if(typeof openM==='function')openM('m-manual-plan-exercise-biomech');
  }

  function manualPlanOpenExerciseBiomech(row){
    const name=text((row&&row.querySelector('[data-f="name"]')||{}).value);
    if(!name)return;
    const library=typeof libExerciseByName==='function'?libExerciseByName(name):null;
    window._manualPlanBiomechExercise=Object.assign({},library||{},{name});
    manualPlanExerciseBiomechModal(window._manualPlanBiomechExercise,false);
  }

  function manualPlanBiomechShowMore(){manualPlanExerciseBiomechModal(window._manualPlanBiomechExercise||{},true);}
  function manualPlanBiomechShowQuick(){manualPlanExerciseBiomechModal(window._manualPlanBiomechExercise||{},false);}

  function manualPlanRenderExerciseProgramming(row){
    if(!row||typeof document==='undefined')return;
    const card=row.querySelector('.manual-plan-exercise-programming');
    const trigger=row.querySelector('.manual-plan-biomech-trigger');
    if(!window._manualPlanDraft){if(card)card.remove();if(trigger)trigger.remove();return;}
    const name=text((row.querySelector('[data-f="name"]')||{}).value);
    if(card)card.remove();
    if(!name){if(trigger)trigger.remove();return;}
    if(!trigger){
      const tools=row.querySelector('.builder-row-tools');
      if(!tools)return;
      const button=document.createElement('button');
      button.type='button';button.className='builder-biomech-trigger';button.title='Biomechanika ćwiczenia';button.setAttribute('aria-label','Biomechanika ćwiczenia');
      button.innerHTML='ⓘ<span>Biomechanika</span>';
      button.onclick=()=>manualPlanOpenExerciseBiomech(row);
      tools.prepend(button);
    }
  }

  function manualPlanToggleExerciseProgramming(row){
    manualPlanOpenExerciseBiomech(row);
  }

  function manualPlanAnalyzeDays(days,profile){
    const muscleSets={},secondaryExposure={},frequency={},secondaryFrequency={},patterns={},resistanceProfiles={},lengthBiases={},duplicates=[],warnings=[],dayStats=[];
    const active=(days||[]).filter(day=>day&&!day.rest);
    let totalSets=0,totalExercises=0,estimatedSeconds=0;
    active.forEach((day,dayIndex)=>{
      const seen=new Set();
      const dayMuscles=new Set();
      const daySecondaryMuscles=new Set();
      let daySets=0,dayExercises=0,daySeconds=0;
      (day.exercises||[]).forEach(raw=>{
        const ex=typeof raw==='string'?{name:raw}:raw||{};
        if(!text(ex.name))return;
        totalExercises++;
        dayExercises++;
        const sets=manualPlanSetCount(ex.sets);
        totalSets+=sets;
        daySets+=sets;
        const bio=manualPlanBio(ex);
        const primary=text(bio.prime)||'nieokreślona';
        muscleSets[primary]=(muscleSets[primary]||0)+sets;
        dayMuscles.add(primary);
        // Serie pomocnicze są ekspozycją, nie "połową serii" ani serią bezpośrednią.
        // Nie dodajemy ich do głównej objętości, aby nie tworzyć pozornie precyzyjnego wyniku.
        list(bio.secondary).forEach(muscle=>{
          const name=text(muscle);
          if(!name||name===primary||/chwyt|stabilizac|tuł[oó]w|core/i.test(name))return;
          secondaryExposure[name]=(secondaryExposure[name]||0)+sets;
          daySecondaryMuscles.add(name);
        });
        const pattern=text(bio.pattern)||'other';
        patterns[pattern]=(patterns[pattern]||0)+sets;
        const resistanceProfile=text(bio.profile);
        if(['ascending','descending','bell-shaped','constant'].includes(resistanceProfile))resistanceProfiles[resistanceProfile]=(resistanceProfiles[resistanceProfile]||0)+sets;
        const lengthBias=text(bio.lengthBias);
        if(['lengthened','mid-range','shortened'].includes(lengthBias))lengthBiases[lengthBias]=(lengthBiases[lengthBias]||0)+sets;
        const key=typeof exercisePatternKey==='function'?exercisePatternKey(ex):pattern;
        if(key&&seen.has(key))duplicates.push({day:day.day||('Dzień '+(dayIndex+1)),name:ex.name,key});
        if(key)seen.add(key);
        const restMatch=String(ex.rest||'90').match(/\d+(?:[.,]\d+)?/);
        const restSeconds=restMatch?Math.min(300,Number(String(restMatch[0]).replace(',','.'))*(/min/i.test(ex.rest||'')?60:1)):90;
        const workSeconds=sets*(25+restSeconds);
        estimatedSeconds+=workSeconds;
        daySeconds+=workSeconds;
      });
      dayMuscles.forEach(primary=>{frequency[primary]=(frequency[primary]||0)+1;});
      daySecondaryMuscles.forEach(muscle=>{secondaryFrequency[muscle]=(secondaryFrequency[muscle]||0)+1;});
      dayStats.push({day:day.day||('Dzień '+(dayIndex+1)),totalSets:daySets,exercises:dayExercises,estimatedMinutes:Math.round(daySeconds/60)});
    });
    const push=(patterns.horizontal_push||0)+(patterns.vertical_push||0)+(patterns.elbow_extension||0);
    const pull=(patterns.horizontal_pull||0)+(patterns.vertical_pull||0)+(patterns.elbow_flexion||0);
    const sessionMinutes=Number(profile&&profile.sessionMinutes)||60;
    if(duplicates.length)warnings.push({level:'warning',type:'redundancja',text:'W tej samej jednostce powtarza się podobny wzorzec. Sprawdź, czy ćwiczenia mają inną funkcję, zakres lub profil oporu.'});
    if(push>=8&&pull>0&&push>pull*1.8)warnings.push({level:'info',type:'balans',text:'Objętość pchania wyraźnie przewyższa przyciąganie. To nie jest automatyczny błąd, ale warto potwierdzić intencję planu.'});
    if(pull>=8&&push>0&&pull>push*1.8)warnings.push({level:'info',type:'balans',text:'Objętość przyciągania wyraźnie przewyższa pchanie. Sprawdź, czy wynika to z priorytetu lub potrzeb klienta.'});
    const averageMinutes=active.length?Math.round(estimatedSeconds/60/active.length):0;
    if(averageMinutes>sessionMinutes+10)warnings.push({level:'warning',type:'czas',text:'Szacowany czas jednostki przekracza deklarowany czas klienta. To szacunek — sprawdź realne przerwy, przejścia i rozgrzewkę.'});
    dayStats.filter(day=>day.totalSets>=30||day.exercises>=9).forEach(day=>warnings.push({level:'high',type:'koszt_sesji',text:`${day.day}: ${day.exercises} ćwiczeń i ${day.totalSets} serii roboczych. Wysoki koszt zmęczeniowy jednostki — rozważ rozłożenie objętości, mniej serii lub mniej metod intensyfikacyjnych.`}));
    const unknown=patterns.other||0;
    // Mapa opisuje to, co jest w planie; brak wzorca nie jest błędem sam w sobie.
    // Priorytety, ograniczenia sprzętu i etap treningu mogą uzasadniać celowe pominięcie.
    const coverageDefinitions=[
      {key:'upperPush',label:'Pchanie — góra',patterns:['horizontal_push','vertical_push']},
      {key:'upperPull',label:'Przyciąganie — góra',patterns:['horizontal_pull','vertical_pull']},
      {key:'kneeDominant',label:'Dominacja kolana',patterns:['knee_dominant']},
      {key:'hipDominant',label:'Dominacja biodra',patterns:['hip_dominant']},
      {key:'kneeFlexion',label:'Zgięcie kolana',patterns:['knee_flexion']},
      {key:'core',label:'Core',patterns:['core']},
      {key:'scapularRearDelt',label:'Łopatka / tylny bark',patterns:['scapular_rear_delt']}
    ];
    const coverage={};
    coverageDefinitions.forEach(item=>{
      const sets=item.patterns.reduce((sum,pattern)=>sum+(patterns[pattern]||0),0);
      coverage[item.key]={label:item.label,sets,present:sets>0,patterns:item.patterns};
    });
    const profileLabels={ascending:'rosnący',descending:'malejący','bell-shaped':'dzwonowy',constant:'stały'};
    const biasLabels={lengthened:'wydłużenie',mid_range:'środek zakresu',shortened:'skrócenie'};
    const biomechHints=[];
    const profilesPresent=Object.keys(resistanceProfiles);
    const biasesPresent=Object.keys(lengthBiases);
    if(profilesPresent.length>=2)biomechHints.push(`Wskazówka biomechaniczna: plan wykorzystuje ${profilesPresent.length} profile oporu (${profilesPresent.map(key=>profileLabels[key]||key).join(', ')}). To różnicuje miejsce największego oporu, ale konkretny tor zawsze zależy od maszyny, linki i ustawienia.`);
    else if(profilesPresent.length===1)biomechHints.push(`Wskazówka biomechaniczna: rozpoznany jest głównie profil oporu „${profileLabels[profilesPresent[0]]||profilesPresent[0]}”. Nie jest to błąd; przy powielaniu podobnych ćwiczeń sprawdź jednak, czy warianty rzeczywiście różnią bodziec.`);
    if(biasesPresent.length)biomechHints.push(`Wskazówka biomechaniczna: rozpoznane akcenty zakresu: ${biasesPresent.map(key=>biasLabels[key]||key).join(', ')}. To heurystyka oparta na wariancie ćwiczenia, nie pomiar sił dla konkretnego stanowiska.`);
    const deductions=[];
    if(!totalExercises)deductions.push({points:50,text:'Brak ćwiczeń do przeanalizowania.'});
    if(duplicates.length)deductions.push({points:10,text:'Powtarzające się wzorce w pojedynczej jednostce.'});
    warnings.filter(item=>item.type==='czas').forEach(()=>deductions.push({points:10,text:'Czas jednostki przekracza zadeklarowany limit.'}));
    warnings.filter(item=>item.type==='balans').forEach(()=>deductions.push({points:5,text:'Wyraźna przewaga pchania lub przyciągania do potwierdzenia.'}));
    if(unknown)deductions.push({points:Math.min(15,unknown*3),text:'Część ćwiczeń nie została rozpoznana przez bibliotekę.'});
    const score=Math.max(0,100-deductions.reduce((sum,item)=>sum+item.points,0));
    return {totalSets,totalExercises,muscleSets,secondaryExposure,frequency,secondaryFrequency,patterns,resistanceProfiles,lengthBiases,biomechHints,coverage,duplicates,warnings,deductions,score,estimatedMinutes:Math.round(estimatedSeconds/60),averageMinutes,activeDays:active.length,dayStats};
  }

  function manualPlanBuilderDays(){
    if(typeof document==='undefined')return [];
    return [...document.querySelectorAll('#builder-days .builder-day')].map((day,index)=>({
      day:(day.querySelector('.builder-day-select')||{}).value||('Dzień '+(index+1)),
      rest:!!(day.querySelector('.rc')||{}).checked,
      exercises:[...day.querySelectorAll('.ex-row')].map(row=>{
        const get=key=>(row.querySelector('[data-f="'+key+'"]')||{}).value||'';
        const name=text(get('name'));
        const library=typeof libExerciseByName==='function'?libExerciseByName(name):null;
        return Object.assign({},library||{},{name,sets:get('sets'),rest:get('rest'),reps:get('reps')});
      })
    }));
  }

  function manualPlanAnalysisHtml(result){
    const muscleRows=Object.entries(result.muscleSets).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const secondaryRows=Object.entries(result.secondaryExposure||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const patternLabels={horizontal_push:'pchanie poziome',vertical_push:'pchanie pionowe',horizontal_pull:'przyciąganie poziome',vertical_pull:'przyciąganie pionowe',knee_dominant:'dominacja kolana',hip_dominant:'dominacja biodra',knee_flexion:'zgięcie kolana',shoulder_abduction:'odwiedzenie barku',elbow_flexion:'zgięcie łokcia',elbow_extension:'wyprost łokcia',core:'core'};
    const patternRows=Object.entries(result.patterns).filter(([key])=>key!=='other').sort((a,b)=>b[1]-a[1]).slice(0,8);
    const frequencyRows=Object.entries(result.frequency).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const coverageRows=Object.values(result.coverage||{});
    const biomechHintHtml=(result.biomechHints||[]).map(item=>`<div style="margin-top:5px;color:var(--muted);">💡 ${esc(item)}</div>`).join('');
    const warningHtml=result.warnings.length?result.warnings.map(item=>{
      const prefix=item.level==='high'?'⛔':item.level==='warning'?'⚠':'ℹ';
      const color=item.level==='high'?'var(--accent)':item.level==='warning'?'var(--warn)':'var(--muted)';
      return `<div style="margin-top:7px;color:${color};">${prefix} ${esc(item.text)}</div>`;
    }).join(''):'<div style="margin-top:7px;color:var(--muted);">Brak oczywistych ostrzeżeń z prostych reguł. To nie jest ocena kliniczna ani gwarancja jakości.</div>';
    return `<div style="font-size:12px;line-height:1.55;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;"><span class="kb-tag">${result.totalSets} serii roboczych</span><span class="kb-tag">${result.activeDays} jednostki</span><span class="kb-tag">~${result.averageMinutes} min / jednostkę</span><span class="kb-tag">${result.deductions.length?result.deductions.length+' sprawy do sprawdzenia':'kontrola struktury: bez odliczeń'}</span></div>
      <div><b>Serie bezpośrednie — główna partia</b><br>${muscleRows.length?muscleRows.map(([name,sets])=>`${esc(name)}: ${sets}`).join(' · '):'Dodaj ćwiczenia z biblioteki, aby rozpoznać partie.'}</div>
      <div style="margin-top:8px;"><b>Udział wtórny — ekspozycja z ruchów złożonych</b><br>${secondaryRows.length?secondaryRows.map(([name,sets])=>`${esc(name)}: ${sets}`).join(' · '):'Brak rozpoznanego udziału wtórnego.'}<div style="margin-top:3px;color:var(--muted);">To nie są dodatkowe serie bezpośrednie i nie należy ich sumować z pierwszym wierszem. Informują tylko, gdzie dana partia może także pracować.</div></div>
      <div style="margin-top:8px;"><b>Częstotliwość głównej partii</b><br>${frequencyRows.length?frequencyRows.map(([name,days])=>`${esc(name)}: ${days}×`).join(' · '):'Brak danych.'}</div>
      <div style="margin-top:8px;"><b>Wzorce ruchu</b><br>${patternRows.length?patternRows.map(([name,sets])=>`${esc(patternLabels[name]||name)}: ${sets}`).join(' · '):'Brak rozpoznanych wzorców.'}</div>
      <div style="margin-top:8px;"><b>Mapa pokrycia wzorców</b><br>${coverageRows.map(item=>`<span class="kb-tag" style="margin:3px 4px 0 0;${item.present?'':'opacity:.55;'}">${item.present?'✓':'—'} ${esc(item.label)}${item.present?': '+item.sets+' serii':''}</span>`).join('')}<div style="margin-top:3px;color:var(--muted);">„—” oznacza brak rozpoznanego wzorca, nie błąd. Potwierdź, czy wynika to z celu, priorytetów i ograniczeń klienta.</div></div>
      ${biomechHintHtml?`<div style="margin-top:8px;"><b>Biomechanika — kontekst ćwiczeń</b>${biomechHintHtml}</div>`:''}
      <div style="margin-top:8px;"><b>Kontrola</b>${warningHtml}</div>
      <div style="margin-top:7px;color:var(--muted);">To checklista prostych heurystyk (${result.deductions.length?result.deductions.map(item=>esc(item.text)).join(' '):'brak odliczeń'}), nie ocena jakości programu ani diagnoza.</div>
      ${result.duplicates.length?`<div style="margin-top:7px;color:var(--muted);">Podobne wzorce: ${result.duplicates.map(item=>esc(item.day+' — '+item.name)).join('; ')}</div>`:''}
      <button type="button" class="btn btn-ghost btn-sm" style="margin-top:11px;" onclick="manualPlanOpenAnalysis()">Odśwież analizę</button>
    </div>`;
  }

  function manualPlanRefreshAnalysis(){
    if(typeof document==='undefined')return null;
    const meta=window._manualPlanDraft;
    const quickbar=document.getElementById('manual-plan-quickbar');
    const trigger=document.getElementById('manual-plan-analysis-trigger');
    const cycle=document.getElementById('manual-plan-cycle-summary');
    if(!meta){if(quickbar)quickbar.hidden=true;return null;}
    if(quickbar)quickbar.hidden=false;
    const result=manualPlanAnalyzeDays(manualPlanBuilderDays(),meta.clientProfile);
    meta.analysis={volume:{direct:result.muscleSets,secondaryExposure:result.secondaryExposure},movement:result.patterns,biomechanics:{resistanceProfiles:result.resistanceProfiles,lengthBiases:result.lengthBiases,hints:result.biomechHints},coverage:result.coverage,frequency:{sessions:result.activeDays,byPrimaryMuscle:result.frequency,bySecondaryMuscle:result.secondaryFrequency},balance:null,time:{estimatedMinutes:result.estimatedMinutes,averageMinutes:result.averageMinutes},warnings:result.warnings,score:result.score,deductions:result.deductions};
    const actionItems=(result.warnings||[]).filter(item=>item.level==='high'||item.level==='warning').length+(result.duplicates||[]).length;
    if(trigger){
      trigger.textContent=actionItems?'⚠ Analiza planu · '+actionItems+' '+(actionItems===1?'uwaga':'uwagi'):'✓ Analiza planu · bez istotnych uwag';
      trigger.classList.toggle('has-warning',actionItems>0);
    }
    if(cycle){
      const labels={stały:'stały układ',liniowa:'liniowa',double:'podwójna progresja',dup:'falowa / DUP',blokowa:'blokowa',step_loading:'step loading',autoregulacja:'autoregulacja',własna:'własna'};
      const period=meta.periodization||{},progression=meta.progression||{};
      const priority=meta.priorities&&meta.priorities.primary;
      const priorityText=priority&&priority!=='none'?' · priorytet: '+(priority==='wlasny'?(meta.priorities.custom||'własny'):priorityLabels[priority]):'';
      cycle.textContent='Cykl: '+(period.durationWeeks||'—')+' tyg. · '+(labels[period.strategy]||period.strategy||'stały układ')+' · '+(labels[progression.type]||progression.type||'progresja do ustalenia')+(period.deloadEnabled?' · deload':'')+priorityText;
    }
    window._manualPlanLastAnalysis=result;
    return result;
  }

  function manualPlanOpenAnalysis(){
    const meta=window._manualPlanDraft;
    if(!meta)return null;
    const result=manualPlanRefreshAnalysis()||window._manualPlanLastAnalysis;
    if(!result)return null;
    const modal=manualPlanEnsureModal('m-manual-plan-analysis');
    modal.innerHTML=`<div class="modal" style="max-width:760px;"><div class="modal-hdr"><div class="modal-title">ANALIZA PLANU</div><button class="modal-close" onclick="closeM('m-manual-plan-analysis')">×</button></div><div class="modal-body"><div style="font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:14px;">To zestaw wskazówek do decyzji trenera. Nie blokuje zapisu planu i nie zastępuje indywidualnej oceny.</div>${manualPlanAnalysisHtml(result)}</div><div class="modal-footer"><button class="btn btn-primary" onclick="closeM('m-manual-plan-analysis')">Gotowe</button></div></div>`;
    if(typeof openM==='function')openM('m-manual-plan-analysis');
    return result;
  }

  function manualPlanShowAnalysis(){
    if(typeof document==='undefined')return;
    const quickbar=document.getElementById('manual-plan-quickbar');
    if(quickbar)quickbar.hidden=!window._manualPlanDraft;
    if(!window._manualPlanAnalysisObserver&&typeof MutationObserver!=='undefined'){
      let queued=false;
      const schedule=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;manualPlanRefreshAnalysis();},80);};
      const target=document.getElementById('builder-days');
      if(target){
        window._manualPlanAnalysisObserver=new MutationObserver(schedule);
        window._manualPlanAnalysisObserver.observe(target,{childList:true,subtree:true});
        target.addEventListener('input',schedule);
        target.addEventListener('change',schedule);
      }
    }
    document.querySelectorAll('#builder-days .ex-row').forEach(manualPlanRenderExerciseProgramming);
    manualPlanRefreshAnalysis();
  }

  function manualPlanReviewItems(meta,result){
    const complete=[];
    const suggestions=[];
    const profile=meta.clientProfile||{};
    if(profile.goal)complete.push('określony cel');else suggestions.push({level:'warning',text:'Brak określonego celu programu.'});
    const priority=meta.priorities||{};
    if(priority.primary&&priority.primary!=='none')complete.push('ustalony priorytet: '+(priority.primary==='wlasny'?(priority.custom||'własny'):priorityLabels[priority.primary]));
    if(meta.progression&&meta.progression.type)complete.push('ustalona progresja');else suggestions.push({level:'warning',text:'Brak zdefiniowanej zasady progresji.'});
    if(meta.intensity&&meta.intensity.mode)complete.push('określona intensywność');else suggestions.push({level:'warning',text:'Brak sposobu sterowania intensywnością.'});
    if(result.activeDays)complete.push(`${result.activeDays} jednostki do realizacji`);else suggestions.push({level:'high',text:'Dodaj co najmniej jedną jednostkę z ćwiczeniami przed zapisem.'});
    if(result.activeDays&&profile.sessionsPerWeek&&result.activeDays!==Number(profile.sessionsPerWeek))suggestions.push({level:'info',text:`Zbudowano ${result.activeDays} jednostki, a profil zakłada ${profile.sessionsPerWeek} treningów tygodniowo. Potwierdź, że to zamierzone.`});
    (result.warnings||[]).forEach(item=>suggestions.push(item));
    const advanced=(meta.trainingMethods||[]).filter(method=>['drop_set','rest_pause','myo_reps','cluster_set','top_set_backoff','reverse_pyramid','amrap'].includes(method));
    if(profile.level==='poczatkujacy'&&advanced.length>=2)suggestions.push({level:'warning',text:'Dla osoby początkującej wybrano kilka zaawansowanych metod intensyfikacyjnych. Rozważ pozostawienie prostszych serii jako bazy.'});
    return {complete,suggestions};
  }

  function manualPlanOpenReview(){
    const meta=window._manualPlanDraft;
    if(!meta)return typeof savePlan==='function'?savePlan():null;
    const result=manualPlanRefreshAnalysis()||manualPlanAnalyzeDays(manualPlanBuilderDays(),meta.clientProfile);
    const review=manualPlanReviewItems(meta,result);
    const levelLabel={high:'DUŻE OSTRZEŻENIE',warning:'OSTRZEŻENIE',info:'WSKAZÓWKA'};
    const icon={high:'⛔',warning:'⚠',info:'ℹ'};
    const color={high:'var(--accent)',warning:'var(--warn)',info:'var(--muted)'};
    const completeHtml=review.complete.length?review.complete.map(item=>`<div style="margin-top:7px;color:var(--green,#2fbf71);">✓ ${esc(item)}</div>`).join(''):'<div style="margin-top:7px;color:var(--muted);">Uzupełnij ustawienia programu.</div>';
    const suggestionHtml=review.suggestions.length?review.suggestions.map(item=>`<div style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:8px;"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:${color[item.level]||color.info};">${icon[item.level]||icon.info} ${levelLabel[item.level]||levelLabel.info}</div><div style="margin-top:4px;line-height:1.5;">${esc(item.text)}</div></div>`).join(''):'<div style="margin-top:10px;color:var(--muted);">Brak sugestii z obecnych, prostych reguł. Nie zastępuje to oceny trenera.</div>';
    const modal=manualPlanEnsureModal('m-manual-plan-review');
    modal.innerHTML=`<div class="modal" style="max-width:760px;"><div class="modal-hdr"><div class="modal-title">ANALIZA PLANU</div><button class="modal-close" onclick="closeM('m-manual-plan-review')">×</button></div><div class="modal-body"><div style="font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:14px;">To podsumowanie pomaga sprawdzić decyzje programowe. Nie blokuje zapisu ani nie zastępuje decyzji trenera.</div><div class="card" style="padding:13px;"><b>✓ Ustalono</b>${completeHtml}</div><div style="margin-top:14px;"><b>Sprawdź przed zapisem</b>${suggestionHtml}</div><div style="margin-top:14px;font-size:12px;color:var(--muted);">Plan można zapisać.${review.suggestions.length?' Sprawdź '+review.suggestions.length+' sugestie.':''}</div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeM('m-manual-plan-review')">Wróć do edycji</button><button class="btn btn-primary" onclick="manualPlanConfirmSave()">Zapisz mimo sugestii</button></div></div>`;
    if(typeof openM==='function')openM('m-manual-plan-review');
    return review;
  }

  function manualPlanConfirmSave(){
    if(typeof closeM==='function')closeM('m-manual-plan-review');
    return typeof savePlan==='function'?savePlan():null;
  }

  function manualPlanSaveFromBuilder(){
    return window._manualPlanDraft?manualPlanOpenReview():(typeof savePlan==='function'?savePlan():null);
  }

  window.MANUAL_PLAN_SCHEMA_VERSION=MANUAL_PLAN_SCHEMA_VERSION;
  window.MANUAL_PLAN_SPLITS=MANUAL_PLAN_SPLITS;
  window.MANUAL_PLAN_PERIODIZATION=MANUAL_PLAN_PERIODIZATION;
  window.MANUAL_PLAN_PROGRESSIONS=MANUAL_PLAN_PROGRESSIONS;
  window.MANUAL_PLAN_INTENSITY=MANUAL_PLAN_INTENSITY;
  window.MANUAL_PLAN_METHODS=MANUAL_PLAN_METHODS;
  window.manualPlanLevel=manualPlanLevel;
  window.manualPlanGoal=manualPlanGoal;
  window.manualPlanSuggestedSplit=manualPlanSuggestedSplit;
  window.manualPlanDefaultWeeks=manualPlanDefaultWeeks;
  window.manualPlanDefaultMeta=manualPlanDefaultMeta;
  window.manualPlanNormalizeMeta=manualPlanNormalizeMeta;
  window.manualPlanRead=manualPlanRead;
  window.manualPlanAttach=manualPlanAttach;
  window.manualPlanExerciseDefaults=manualPlanExerciseDefaults;
  window.manualPlanApplyToPlan=manualPlanApplyToPlan;
  window.openManualPlanPicker=openManualPlanPicker;
  window.manualPlanStart=manualPlanStart;
  window.manualPlanWizardNext=manualPlanWizardNext;
  window.manualPlanWizardBack=manualPlanWizardBack;
  window.manualPlanOpenLearnMore=manualPlanOpenLearnMore;
  window.manualPlanPeriodHelp=manualPlanPeriodHelp;
  window.manualPlanToggleMethod=manualPlanToggleMethod;
  window.manualPlanOpenBuilder=manualPlanOpenBuilder;
  window.manualPlanAnalyzeDays=manualPlanAnalyzeDays;
  window.manualPlanRefreshAnalysis=manualPlanRefreshAnalysis;
  window.manualPlanOpenAnalysis=manualPlanOpenAnalysis;
  window.manualPlanShowAnalysis=manualPlanShowAnalysis;
  window.manualPlanExerciseProgramming=manualPlanExerciseProgramming;
  window.manualPlanExerciseSummary=manualPlanExerciseSummary;
  window.manualPlanRenderExerciseProgramming=manualPlanRenderExerciseProgramming;
  window.manualPlanToggleExerciseProgramming=manualPlanToggleExerciseProgramming;
  window.manualPlanOpenExerciseBiomech=manualPlanOpenExerciseBiomech;
  window.manualPlanBiomechShowMore=manualPlanBiomechShowMore;
  window.manualPlanBiomechShowQuick=manualPlanBiomechShowQuick;
  window.manualPlanOpenReview=manualPlanOpenReview;
  window.manualPlanConfirmSave=manualPlanConfirmSave;
  window.manualPlanSaveFromBuilder=manualPlanSaveFromBuilder;
})();
