const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(root,'12-manual-plan-wizard.js'),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context);
const api=context.window;
const assert=(ok,label)=>{if(!ok)throw new Error(label);};

const legacy={id:'p1',method:'PPL',duration:'8',progression:'double',days:[{day:'PON',exercises:[{name:'Przysiad'}]}]};
const legacyBefore=JSON.stringify(legacy);
const meta=api.manualPlanRead(legacy,{level:'poczatkujacy',goal:'masa'});
assert(meta.version===2,'nowy model ma wersję');
assert(meta.clientProfile.level==='poczatkujacy','odczytuje poziom klienta');
assert(meta.clientProfile.goal==='hipertrofia','mapuje cel klienta');
assert(meta.periodization.deloadEnabled===false,'nie wymusza deloadu');
assert(JSON.stringify(legacy)===legacyBefore,'nie modyfikuje starego planu');
assert(api.manualPlanSuggestedSplit({level:'poczatkujacy',sessionsPerWeek:2}).split==='FBW','sugeruje FBW dla początkującego 2x');
assert(api.manualPlanSuggestedSplit({level:'sredni',sessionsPerWeek:4}).split==='Upper Lower','sugeruje Upper/Lower dla 4 sesji');

const custom=api.manualPlanNormalizeMeta({
  mode:'advanced',
  periodization:{strategy:'blokowa',durationWeeks:6,deloadEnabled:true},
  progression:{type:'double',repRange:'6–10',loadStepKg:2.5},
  intensity:{mode:'rir',globalTarget:'2'},
  trainingMethods:['straight_sets','top_set_backoff']
},legacy,{});
assert(custom.mode==='advanced','zachowuje tryb zaawansowany');
assert(custom.periodization.weeks.length===6,'tworzy wymaganą liczbę tygodni');
assert(custom.periodization.weeks[5].deload===true,'dodaje deload tylko gdy wybrany');
assert(custom.trainingMethods.includes('top_set_backoff'),'zachowuje metody treningowe');
const withPriority=api.manualPlanNormalizeMeta({priorities:{primary:'plecy',secondary:'barki'}},legacy,{});
assert(withPriority.priorities.primary==='plecy'&&withPriority.priorities.secondary==='barki','zachowuje dwa priorytety klienta');
const attached=api.manualPlanAttach(legacy,custom,{});
assert(attached.days.length===1&&attached.manualPlanSchemaVersion===2,'dołącza dane bez naruszania dni planu');
const applied=api.manualPlanApplyToPlan(legacy,custom,{});
assert(applied.days.length===1,'zapis planu ręcznego zachowuje dni');
assert(applied.weekKeys.length===6&&applied.currentWeek==='w1','zapis tworzy kompatybilne tygodnie planu');
assert(applied.phases.w6.includes('deload'),'zapis przenosi fazę tygodnia do starego widoku planu');
assert(applied.duration==='6'&&applied.progression==='double','zapis synchronizuje pola wymagane przez istniejący kreator');
const analysis=api.manualPlanAnalyzeDays([{day:'PON',exercises:[
  {name:'Wyciskanie A',sets:'4',rest:'90s',biomech:{pattern:'horizontal_push',prime:'Klatka',secondary:['Triceps','Barki przednie'],profile:'bell-shaped',lengthBias:'shortened'}},
  {name:'Wyciskanie B',sets:'3',rest:'90s',biomech:{pattern:'horizontal_push',prime:'Klatka',profile:'ascending',lengthBias:'mid-range'}},
  {name:'Wiosłowanie',sets:'4',rest:'120s',biomech:{pattern:'horizontal_pull',prime:'Plecy',profile:'constant',lengthBias:'lengthened'}}
]}],{sessionMinutes:30});
assert(analysis.totalSets===11&&analysis.muscleSets.Klatka===7,'analizuje objętość według głównej partii');
assert(analysis.secondaryExposure.Triceps===4&&analysis.secondaryFrequency.Triceps===1,'oddziela ekspozycję wtórną od serii bezpośrednich');
assert(analysis.coverage.upperPush.present===true&&analysis.coverage.upperPull.present===true,'tworzy mapę pokrycia wzorców bez oceniania braków jako błędów');
assert(analysis.resistanceProfiles.constant===4&&analysis.lengthBiases.lengthened===4&&analysis.biomechHints.length>=2,'dodaje ostrożne wskazówki o profilu oporu i akcencie zakresu');
assert(analysis.frequency.Klatka===1&&analysis.score<100,'analizuje częstotliwość i wynik kontrolny');
assert(analysis.duplicates.length===1,'zaznacza podobny wzorzec w jednej jednostce');
assert(analysis.warnings.some(item=>item.type==='redundancja'),'tworzy wyjaśnialne ostrzeżenie o redundancji');
assert(analysis.dayStats.length===1&&analysis.dayStats[0].totalSets===11,'zachowuje statystyki pojedynczej jednostki do kontroli kosztu sesji');
const highCost=api.manualPlanAnalyzeDays([{day:'WT',exercises:Array.from({length:9},(_,i)=>({name:'Ruch '+i,sets:'4',rest:'90s',biomech:{pattern:'other',prime:'Test'}}))}],{sessionMinutes:60});
assert(highCost.warnings.some(item=>item.type==='koszt_sesji'&&item.level==='high'),'oznacza bardzo długą jednostkę jako duże ostrzeżenie');
const programming=api.manualPlanExerciseProgramming({name:'Wiosłowanie',biomech:{prime:'Plecy',secondary:['Biceps'],accessory:['chwyt'],pattern:'horizontal_pull',plane:'sagittal',compound:true,stable:true,unilateral:false,lengthBias:'mid-range'}});
assert(programming.primaryMuscles[0]==='Plecy'&&programming.tags.role==='compound','zapisuje rolę biomechaniczną ćwiczenia');
assert(programming.tags.direction==='horizontal'&&programming.tags.stability==='stable','dodaje tagi do przyszłej analizy AI');
const summary=api.manualPlanExerciseSummary({name:'Wiosłowanie',biomech:{prime:'Plecy',secondary:['Biceps'],accessory:['chwyt'],pattern:'horizontal_pull',plane:'sagittal',compound:true,stable:true,unilateral:false,lengthBias:'mid-range'}});
assert(summary.primary==='Plecy'&&summary.pattern==='horizontal_pull','buduje czytelne podsumowanie programowania ćwiczenia');
assert(summary.tags.role==='compound'&&summary.tags.lengthBias==='mid-range','podsumowanie zachowuje tagi biomechaniczne');
assert(typeof api.manualPlanOpenExerciseBiomech==='function'&&typeof api.manualPlanBiomechShowMore==='function','udostępnia biomechanikę na żądanie dla kreatora');
assert(typeof api.manualPlanOpenAnalysis==='function','udostępnia analizę planu na żądanie');
assert(typeof api.manualPlanToggleMethod==='function','obsługuje widoczny wybór metod w kreatorze');
assert(typeof api.manualPlanOpenLearnMore==='function','udostępnia krótką edukację na żądanie w kreatorze');
console.log('OK manual plan model');
