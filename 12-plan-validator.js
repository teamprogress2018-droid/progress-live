/* Progress Live Plan Validator — deterministic validation, no AI calls. */
(function(){
  const VERSION='1.0.0';
  // One deterministic policy boundary. A future trainer settings screen can store an
  // approved policy object without changing the plan generator or the validator logic.
  const DEFAULT_POLICY=Object.freeze({
    version:'2026.1',
    minSetsPerExercise:1,maxSetsPerExercise:8,maxWorkingSetsPerDay:30,minReps:1,maxReps:50,
    minRir:0,maxRir:10,minRestSeconds:30,maxRestSeconds:600,
    maxWeeklyLoadChange:0.15,highEffortAverageRir:0.75,fallingRirDelta:1,
    minLiveEffortSets:6,minLiveEffortSessions:2
  });
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm=v=>String(v||'').toLocaleLowerCase('pl').replace(/[^a-z0-9ąćęłńóśźż]+/g,' ').trim();
  const numberFrom=v=>{
    const m=String(v==null?'':v).replace(',','.').match(/\d+(?:\.\d+)?/);
    return m?Number(m[0]):NaN;
  };
  const restSeconds=v=>{
    const s=String(v||'').toLowerCase().replace(',','.');
    const n=numberFrom(s);
    if(!Number.isFinite(n))return NaN;
    return /min|m\b/.test(s)&&!/ms\b/.test(s)?n*60:n;
  };
  const issue=(severity,code,message,path,meta)=>Object.assign({severity,code,message,path:path||'',policyVersion:VERSION},meta||{});
  function planPolicy(override){
    const raw=override&&typeof override==='object'?override:{};
    const out={...DEFAULT_POLICY};
    Object.keys(DEFAULT_POLICY).forEach(key=>{
      if(key==='version')return;
      const value=Number(raw[key]);
      if(Number.isFinite(value)&&value>=0)out[key]=value;
    });
    if(raw.version)out.version=String(raw.version);
    return out;
  }
  const catalogId=ex=>String(ex&&ex.id||'builtin:'+norm(ex&&ex.name).replace(/\s+/g,'-'));
  function exerciseCatalog(){
    const list=typeof window.allExercises==='function'?window.allExercises():[].concat(window.EX||[],window.DEF_EX||[]);
    return (list||[]).filter(ex=>ex&&ex.name).map(ex=>({
      id:catalogId(ex),name:ex.name,aliases:[ex.name].concat(String(ex.aka||'').split(',')).map(norm).filter(Boolean),
      category:ex.cat||'',muscle:ex.muscle||'',equipment:ex.eq||'',loadUnit:ex.load||'kg',source:ex.id?'custom':'builtin'
    }));
  }
  function resolveExercise(value){
    const key=norm(typeof value==='string'?value:value&&value.name);
    if(!key)return null;
    return exerciseCatalog().find(ex=>ex.aliases.includes(key))||null;
  }

  const MUSCLE_ALIASES=[
    ['klatka',/klatk|pec|chest/],['plecy',/plec|najszersz|lats?|romb|prostownik/],
    ['barki',/bark|naramien|rotator/],['biceps',/biceps|ramiennopromieni/],['triceps',/triceps/],
    ['quady',/czworog|quad/],['tyl uda',/dwuglow|tyl uda|hamstring/],['posladki',/poslad/],
    ['lydki',/lydk|calf/],['core',/brzuch|core|skosn|tulow/]
  ];
  function canonicalMuscle(value){
    const k=norm(value);
    const hit=MUSCLE_ALIASES.find(([,re])=>re.test(k));
    return hit?hit[0]:'';
  }
  function muscleContributions(ex){
    const explicit=ex&&(ex.muscleGroup||ex.muscleGroupName||'');
    if(explicit){
      const key=canonicalMuscle(explicit);
      return key?[{muscle:key,weight:1}]:[];
    }
    const ref=ex&&ex.name?resolveExercise(ex.name):null;
    if(!ref)return [];
    const primary=canonicalMuscle(ref.category);
    const out=primary?[{muscle:primary,weight:1}]:[];
    String(ref.muscle||'').split(',').forEach(part=>{
      const muscle=canonicalMuscle(part);
      if(!muscle||out.some(row=>row.muscle===muscle))return;
      out.push({muscle,weight:/glown|głown|primary/i.test(part)?1:0.5});
    });
    return out;
  }
  function plannedSetCount(ex){
    const n=numberFrom(ex&&(ex.sets!=null?ex.sets:ex.s));
    return Number.isFinite(n)?n:NaN;
  }
  function plannedReps(ex){
    const n=numberFrom(ex&&(ex.reps!=null?ex.reps:ex.r));
    return Number.isFinite(n)?n:NaN;
  }
  function readWeekSets(ex,weekKey){
    const w=ex&&weekKey&&ex[weekKey];
    return plannedSetCount(w&&w.s!=null?w:ex);
  }
  function addVolume(out,group,sets){
    if(!Number.isFinite(sets)||sets<=0)return;
    out[group]=(out[group]||0)+sets;
  }
  const GUIDE_PART_BY_MUSCLE={
    klatka:'Klatka',plecy:'Plecy',barki:'Barki',biceps:'Biceps',triceps:'Triceps',
    quady:'Quady','tyl uda':'Tył uda',posladki:'Pośladki',core:'Brzuch',lydki:'Łydki'
  };
  const PRIORITY_MUSCLE={
    upper_chest:'klatka',mid_chest:'klatka',lats:'plecy',upper_back:'plecy',
    side_delts:'barki',rear_delts:'barki',front_delts:'barki',biceps:'biceps',
    triceps:'triceps',quads:'quady',hamstrings:'tyl uda',glutes:'posladki',calves:'lydki',abs:'core'
  };
  function guideRange(value){
    const values=String(value==null?'':value).match(/\d+(?:[.,]\d+)?/g)||[];
    if(!values.length)return null;
    const min=Number(values[0].replace(',','.'));
    const max=Number((values[1]||values[0]).replace(',','.'));
    return Number.isFinite(min)&&Number.isFinite(max)?{min,max}:null;
  }
  function clientPriorityMuscles(client){
    const raw=client&&client.physiquePriority;
    const ids=Array.isArray(raw)?raw:String(raw||'').split(/[,;|]/).map(x=>x.trim());
    return [...new Set(ids.map(id=>PRIORITY_MUSCLE[id]).filter(Boolean))];
  }
  function addVolumeGuideIssues(issues,weeklyVolume,client){
    if(!client||typeof window.volumeGuideForLevel!=='function')return null;
    const level=String(client.level||'sredni').toLowerCase();
    const guide=window.volumeGuideForLevel(level);
    if(!guide||!guide.parts)return null;
    const priorityMuscles=clientPriorityMuscles(client);
    const ranges={};
    Object.entries(GUIDE_PART_BY_MUSCLE).forEach(([muscle,part])=>{
      const range=guideRange(guide.parts[part]);
      if(!range)return;
      ranges[muscle]={part,min:range.min,max:range.max,actual:weeklyVolume[muscle]||0};
      if((weeklyVolume[muscle]||0)>range.max){
        issues.push(issue('warning','VOLUME_ABOVE_LEVEL_GUIDE','Objętość dla „'+part+'” przekracza orientacyjny zakres dla poziomu „'+(guide.label||level)+'” ('+range.min+'–'+range.max+' serii/tydz.). Zweryfikuj regenerację i priorytety.', 'computed.weeklyVolume.'+muscle,{muscle,actual:weeklyVolume[muscle],min:range.min,max:range.max,level}));
      }
      if(priorityMuscles.includes(muscle)&&(weeklyVolume[muscle]||0)<range.min){
        issues.push(issue('warning','PRIORITY_VOLUME_BELOW_GUIDE','Priorytet sylwetkowy „'+part+'” ma objętość poniżej orientacyjnego dolnego zakresu dla poziomu „'+(guide.label||level)+'” ('+range.min+' serii/tydz.). Sprawdź, czy jest to zamierzone.', 'computed.weeklyVolume.'+muscle,{muscle,actual:weeklyVolume[muscle]||0,min:range.min,max:range.max,level}));
      }
    });
    return {level,label:guide.label||level,note:guide.note||'',priorityMuscles,ranges};
  }
  function liveEffortTrend(client,policy){
    const clientId=client&&client.id;
    if(!clientId||!Array.isArray(window.SE))return null;
    const sessions=window.SE.filter(s=>s&&s.clientId===clientId&&Array.isArray(s.exercises)&&s.source!=='planned'&&s.source!=='live-draft')
      .slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,4);
    const bySession=sessions.map(session=>{
      const values=[];
      (session.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(set=>{
        const rir=numberFrom(set&&set.rir);
        if(Number.isFinite(rir)&&rir>=0&&rir<=10)values.push(rir);
      }));
      return {date:session.date||session.createdAt||'',sets:values.length,avgRir:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};
    }).filter(x=>x.sets>0);
    const values=bySession.flatMap(x=>Array.from({length:x.sets},()=>x.avgRir));
    if(values.length<policy.minLiveEffortSets||bySession.length<policy.minLiveEffortSessions)return null;
    const avgRir=values.reduce((a,b)=>a+b,0)/values.length;
    const split=Math.floor(bySession.length/2);
    const recent=bySession.slice(0,split);
    const earlier=bySession.slice(split);
    const avg=list=>list.reduce((sum,row)=>sum+row.avgRir,0)/list.length;
    const recentAvg=recent.length?avg(recent):null;
    const earlierAvg=earlier.length?avg(earlier):null;
    return {sessions:bySession.length,sets:values.length,avgRir,estimatedRpe:10-avgRir,recentAvgRir:recentAvg,earlierAvgRir:earlierAvg,deltaRir:recentAvg!=null&&earlierAvg!=null?recentAvg-earlierAvg:null};
  }
  function addLiveEffortIssues(issues,client,policy){
    const trend=liveEffortTrend(client,policy);
    if(!trend)return null;
    if(trend.avgRir<=policy.highEffortAverageRir){
      issues.push(issue('warning','LIVE_EFFORT_HIGH','Ostatnie sesje Live wskazują średnio RIR '+trend.avgRir.toFixed(1)+' (około RPE '+trend.estimatedRpe.toFixed(1)+'). Sprawdź regenerację przed podnoszeniem objętości lub intensywności.','computed.liveEffort',{...trend}));
    }
    if(trend.deltaRir!=null&&trend.deltaRir<=-policy.fallingRirDelta&&trend.recentAvgRir<=2){
      issues.push(issue('warning','LIVE_EFFORT_TREND_DOWN','RIR w ostatnich sesjach spadł o '+Math.abs(trend.deltaRir).toFixed(1)+' względem wcześniejszych zapisów. Sprawdź zmęczenie, sen i gotowość do progresji.','computed.liveEffort',{...trend}));
    }
    return trend;
  }
  const LIMITATION_RULES=[
    {id:'shoulder',limitation:/(bark|shoulder|obr[eę]cz)/,exercise:/(wyciskan.*(zolniers|żołniers|ohp|nad głow)|dips|pompki na porecz|podciaganie za kark)/,label:'barków'},
    {id:'knee',limitation:/(kolan|knee)/,exercise:/(przysiad|squat|wykrok|lunge|leg press|skok|jump)/,label:'kolan'},
    {id:'spine',limitation:/(kregoslup|kr[eę]gosłup|l[eę]d[zź]|ledz|dysk|rwa kulsz)/,exercise:/(martw|deadlift|rdl|good morning|wioslowanie sztang)/,label:'kręgosłupa'},
    {id:'hip',limitation:/(biodr|hip)/,exercise:/(przysiad|squat|wykrok|lunge|martw|deadlift|hip thrust)/,label:'bioder'}
  ];
  function clientLimitationsText(client){
    if(!client)return '';
    if(typeof window.clientCombinedLimitationsText==='function')return String(window.clientCombinedLimitationsText(client)||'');
    return String(client.injuries||client.limitations||'');
  }
  function addLimitationReviewIssues(issues,days,client){
    const limitations=clientLimitationsText(client).toLocaleLowerCase('pl');
    if(!limitations)return [];
    const hits=[];
    days.forEach((day,di)=>{if(day&&day.rest)return;(day&&day.exercises||[]).forEach((ex,ei)=>{
      const name=String(ex&&ex.name||'');
      const nameForMatch=name.toLocaleLowerCase('pl');
      LIMITATION_RULES.forEach(rule=>{
        if(!rule.limitation.test(limitations)||!rule.exercise.test(nameForMatch))return;
        hits.push({rule:rule.id,exercise:name,path:'days['+di+'].exercises['+ei+']'});
        issues.push(issue('warning','LIMITATION_REVIEW_REQUIRED','Zgłoszone ograniczenie dotyczące '+rule.label+' może wymagać modyfikacji lub potwierdzenia dla ćwiczenia: '+name+'. To sygnał do oceny przez trenera/specjalistę, nie diagnoza.', 'days['+di+'].exercises['+ei+'].name',{limitation:rule.id,exercise:name}));
      });
    });});
    return hits;
  }
  function validatePlan(plan,options){
    const p=plan&&typeof plan==='object'?plan:{};
    const opts=options||{};
    const policy=planPolicy(opts.policy||window.PL_PLAN_POLICY);
    const issues=[];
    const days=Array.isArray(p.days)?p.days:[];
    const weeklyVolume={};
    const phaseVolume={};
    const exerciseRefs=[];
    const dayWorkSets=[];
    if(!days.length)issues.push(issue('error','PLAN_DAYS_REQUIRED','Plan musi zawierać co najmniej jeden dzień treningowy.','days'));
    if(days.length>7)issues.push(issue('warning','PLAN_MANY_DAYS','Plan ma więcej niż 7 dni — sprawdź, czy to nie duplikacja mikrocyklu.','days'));
    days.forEach((day,di)=>{
      if(day&&day.rest)return;
      const exercises=Array.isArray(day&&day.exercises)?day.exercises:[];
      const seen={};
      let daySets=0;
      if(!exercises.length)issues.push(issue('error','DAY_EXERCISES_REQUIRED','Dzień treningowy nie zawiera ćwiczeń.','days['+di+'].exercises'));
      exercises.forEach((ex,ei)=>{
        const path='days['+di+'].exercises['+ei+']';
        const name=String(ex&&ex.name||'').trim();
        if(!name)issues.push(issue('error','EXERCISE_NAME_REQUIRED','Ćwiczenie nie ma nazwy.',path+'.name'));
        const key=norm(name);
        const ref=resolveExercise(name);
        if(name&&!ref)issues.push(issue('warning','EXERCISE_UNKNOWN','Ćwiczenie nie zostało odnalezione w bibliotece; uzupełnij katalog lub wybierz istniejącą pozycję.',path+'.name'));
        if(ref)exerciseRefs.push({path,id:ref.id,name:ref.name,equipment:ref.equipment,loadUnit:ref.loadUnit,source:ref.source});
        if(key&&seen[key])issues.push(issue('warning','DAY_DUPLICATE_EXERCISE','To samo ćwiczenie występuje drugi raz w tym dniu: '+name+'.',path));
        if(key)seen[key]=true;
        const sets=plannedSetCount(ex);
        if(!Number.isFinite(sets)||sets<policy.minSetsPerExercise)issues.push(issue('error','SETS_INVALID','Liczba serii musi być liczbą co najmniej '+policy.minSetsPerExercise+'.',path+'.sets'));
        else{
          daySets+=sets;
          if(sets>policy.maxSetsPerExercise)issues.push(issue('warning','SETS_HIGH_PER_EXERCISE','Więcej niż '+policy.maxSetsPerExercise+' serii jednego ćwiczenia — sprawdź czas sesji i jakość pracy.',path+'.sets',{value:sets}));
        }
        const reps=plannedReps(ex);
        if(!Number.isFinite(reps)||reps<policy.minReps)issues.push(issue('error','REPS_INVALID','Zakres powtórzeń musi zaczynać się od liczby co najmniej '+policy.minReps+'.',path+'.reps'));
        else if(reps>policy.maxReps)issues.push(issue('warning','REPS_HIGH','Bardzo wysoki zakres powtórzeń — sprawdź, czy jest celowy.',path+'.reps',{value:reps}));
        const rir=numberFrom(ex&&(ex.rir!=null?ex.rir:ex.rpe));
        if(Number.isFinite(rir)&&(rir<policy.minRir||rir>policy.maxRir))issues.push(issue('error','EFFORT_INVALID','RIR/RPE musi mieścić się w skali '+policy.minRir+'–'+policy.maxRir+'.',path+'.rir',{value:rir}));
        const rest=restSeconds(ex&&ex.rest);
        if(Number.isFinite(rest)&&(rest<policy.minRestSeconds||rest>policy.maxRestSeconds))issues.push(issue('warning','REST_UNUSUAL','Przerwa poza zakresem '+policy.minRestSeconds+'–'+policy.maxRestSeconds+' s — sprawdź zapis.',path+'.rest',{value:rest}));
        const contributions=muscleContributions(ex);
        if(!contributions.length)issues.push(issue('warning','MUSCLE_UNCLASSIFIED','Brak rozpoznanej grupy mięśniowej; objętość tego ćwiczenia nie może być przypisana.',path+'.muscleGroup'));
        else contributions.forEach(row=>addVolume(weeklyVolume,row.muscle,sets*row.weight));
      });
      dayWorkSets.push({dayIndex:di,label:day&&((day.name||day.dayName||day.title))||'Dzień '+(di+1),sets:daySets});
      if(daySets>policy.maxWorkingSetsPerDay)issues.push(issue('warning','DAY_VOLUME_HIGH','Dzień ma '+daySets+' serii roboczych; przekracza ustawiony próg '+policy.maxWorkingSetsPerDay+'. Sprawdź czas sesji, regenerację i rozkład objętości.', 'days['+di+']',{dayIndex:di,sets:daySets,max:policy.maxWorkingSetsPerDay}));
    });
    const keys=Array.isArray(p.weekKeys)&&p.weekKeys.length?p.weekKeys:[];
    if(keys.length){
      keys.forEach(wk=>{
        const one={};
        days.forEach(day=>{if(!(day&&day.rest))(day&&day.exercises||[]).forEach(ex=>muscleContributions(ex).forEach(row=>addVolume(one,row.muscle,readWeekSets(ex,wk)*row.weight)));});
        phaseVolume[wk]=one;
      });
      keys.forEach((wk,i)=>{
        if(i===0)return;
        days.forEach((day,di)=>{if(day&&day.rest)return;(day&&day.exercises||[]).forEach((ex,ei)=>{
          const prev=ex&&ex[keys[i-1]];
          const cur=ex&&ex[wk];
          const prevKg=numberFrom(prev&&prev.kg);
          const curKg=numberFrom(cur&&cur.kg);
          if(Number.isFinite(prevKg)&&prevKg>0&&Number.isFinite(curKg)&&curKg>0&&Math.abs(curKg-prevKg)/prevKg>policy.maxWeeklyLoadChange){
            issues.push(issue('warning','LOAD_CHANGE_HIGH','Zmiana ciężaru między tygodniami przekracza '+Math.round(policy.maxWeeklyLoadChange*100)+'%; sprawdź progresję i jednostkę.', 'days['+di+'].exercises['+ei+'].'+wk+'.kg',{previous:prevKg,current:curKg}));
          }
        });});
      });
      keys.forEach(wk=>{
        if(!/deload/i.test(String(p.phases&&p.phases[wk]||'')))return;
        const current=Object.values(phaseVolume[wk]||{}).reduce((a,b)=>a+b,0);
        const baseline=Object.values(phaseVolume[keys[0]]||{}).reduce((a,b)=>a+b,0);
        if(baseline&&current>=baseline)issues.push(issue('warning','DELOAD_VOLUME_NOT_REDUCED','Tydzień oznaczony jako deload nie ma mniejszej objętości niż tydzień bazowy.','phases.'+wk,{baseline,current}));
      });
    }
    const volumeGuide=addVolumeGuideIssues(issues,weeklyVolume,opts.client);
    const liveEffort=addLiveEffortIssues(issues,opts.client,policy);
    const limitationReviews=addLimitationReviewIssues(issues,days,opts.client);
    const errors=issues.filter(x=>x.severity==='error');
    const warnings=issues.filter(x=>x.severity==='warning');
    const requiresTrainerReview=issues.some(x=>['LIMITATION_REVIEW_REQUIRED','LIVE_EFFORT_HIGH','LIVE_EFFORT_TREND_DOWN'].includes(x.code));
    return {
      valid:errors.length===0,
      requiresTrainerReview,
      version:VERSION,
      policyVersion:policy.version,
      source:opts.source||'manual',
      generatedAt:new Date().toISOString(),
      summary:{errors:errors.length,warnings:warnings.length,info:issues.length-errors.length-warnings.length},
      computed:{weeklyVolume,phaseVolume,exerciseRefs,days:days.length,dayWorkSets,volumeGuide,liveEffort,limitationReviews,policy},
      issues
    };
  }
  function renderPlanValidation(report){
    if(!report)return'';
    const s=report.summary||{};
    const tone=s.errors?'#ff6b6b':s.warnings?'#f5b942':'#3dcfb2';
    const label=s.errors?'Wymaga poprawek przed zapisem':s.warnings?'Sprawdź ostrzeżenia przed zapisem':'Plan przeszedł walidację';
    const review=report.requiresTrainerReview?'<p style="font-size:11px;line-height:1.55;margin:7px 0;color:#f5b942"><b>Potwierdzenie trenera wymagane:</b> plan zawiera sygnał dotyczący ograniczeń klienta lub regeneracji. Zapis pozostaje możliwy po świadomej ocenie.</p>':'';
    const rows=(report.issues||[]).slice(0,8).map(i=>'<li style="margin:4px 0"><b>'+esc(i.code)+'</b> — '+esc(i.message)+'</li>').join('');
    const volume=Object.entries(report.computed&&report.computed.weeklyVolume||{}).map(([k,v])=>esc(k)+': '+esc(v)+' s.').join(' · ');
    const guide=report.computed&&report.computed.volumeGuide;
    const effort=report.computed&&report.computed.liveEffort;
    const guideLine=guide?'<p style="font-size:11px;line-height:1.55;margin:7px 0"><b>Zakres poziomu:</b> '+esc(guide.label||guide.level)+' — '+esc(guide.note||'orientacyjna wskazówka dla trenera.')+(guide.priorityMuscles&&guide.priorityMuscles.length?' · priorytet: '+esc(guide.priorityMuscles.join(', ')): '')+'</p>':'';
    const effortLine=effort?'<p style="font-size:11px;line-height:1.55;margin:7px 0"><b>Ostatnie sesje Live:</b> RIR śr. '+esc(effort.avgRir.toFixed(1))+' (≈ RPE '+esc(effort.estimatedRpe.toFixed(1))+') z '+esc(effort.sessions)+' sesji / '+esc(effort.sets)+' serii.</p>':'';
    return '<details class="apl-plan-validation" open style="margin-top:14px;padding:12px 14px;border:1px solid '+tone+'55;border-radius:10px;background:var(--s3);">'
      +'<summary style="cursor:pointer;font-weight:700;color:'+tone+'">Plan Health — '+label+' ('+(s.errors||0)+' błędów, '+(s.warnings||0)+' ostrz.)</summary>'
      +'<p style="font-size:11px;color:var(--muted);line-height:1.55;margin:8px 0">Wynik obliczony lokalnie przez walidator '+VERSION+'; nie jest oceną AI ani poradą medyczną.</p>'
      +(volume?'<p style="font-size:11px;line-height:1.55;margin:7px 0"><b>Objętość wyliczona:</b> '+volume+'</p>':'')
      +guideLine+effortLine
      +review
      +(rows?'<ul style="font-size:11px;color:var(--muted);padding-left:18px;margin:8px 0">'+rows+'</ul>':'')
      +'</details>';
  }
  window.PL_PLAN_VALIDATOR_VERSION=VERSION;
  window.PL_DEFAULT_PLAN_POLICY=DEFAULT_POLICY;
  window.plPlanPolicy=planPolicy;
  window.plExerciseCatalog=exerciseCatalog;
  window.plResolveExercise=resolveExercise;
  window.plMuscleContributions=muscleContributions;
  window.plValidatePlan=validatePlan;
  window.plRenderPlanValidation=renderPlanValidation;
})();
