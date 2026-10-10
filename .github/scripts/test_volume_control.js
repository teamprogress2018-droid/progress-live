// Smoke test for weekly-volume helpers. Run with: node .github/scripts/test_volume_control.js
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync('12-manual-plan-wizard.js','utf8');
const context={window:{},console,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(source,context,{filename:'12-manual-plan-wizard.js'});

const chest={prime:'Klatka piersiowa',secondary:['Triceps'],pattern:'horizontal_push'};
const days=[
  {day:'PON',exercises:[{name:'Wyciskanie',sets:3,biomech:chest}]},
  {day:'PT',exercises:[{name:'Rozpiętka',sets:2,biomech:chest}]},
  {day:'SO',rest:true,exercises:[{name:'Nie liczyć',sets:8,biomech:chest}]}
];
const initial=context.window.manualPlanVolumeSummarize(days);
assert.strictEqual(initial.direct['Klatka piersiowa'],5,'Direct chest work must sum across all training days.');
assert.strictEqual(initial.secondary.Triceps,5,'Secondary work is retained as exposure.');
assert.ok(context.window.manualPlanVolumeState(5,10,'Klatka piersiowa').text.includes('5/10'),'The 5/10 reference must be shown.');
assert.strictEqual(context.window.manualPlanVolumeState(5,10,'Klatka piersiowa').kind,'under');
assert.strictEqual(context.window.manualPlanVolumeState(10,10,'Klatka piersiowa').kind,'reached');
assert.ok(context.window.manualPlanVolumeState(10,10,'Klatka piersiowa').text.includes('Osiągnięto ustalony limit'),'Reached state must prompt a regeneration review.');

days[1].exercises.push({name:'Dodatkowe wyciskanie',sets:6,biomech:chest});
const exceeded=context.window.manualPlanVolumeSummarize(days);
assert.strictEqual(exceeded.direct['Klatka piersiowa'],11,'Adding six sets must update the weekly total.');
assert.strictEqual(context.window.manualPlanVolumeState(11,10,'Klatka piersiowa').kind,'over');
assert.ok(context.window.manualPlanVolumeState(11,10,'Klatka piersiowa').text.includes('o 1 serii'),'Exceeded state must state the one-set excess.');
console.log('Volume-control helpers: OK');
