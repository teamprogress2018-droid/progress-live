const fs=require('fs');

let failed=0;
function ok(name,condition){
  if(condition)console.log('OK   '+name);
  else{console.error('FAIL '+name);failed++;}
}

const src=fs.readFileSync('06-inbox-exercises-ai-programs.js','utf8');
const block=src.match(/const EX_MEDIA_BICEPS_ADD=\[([\s\S]*?)\];\nEX_MEDIA_BICEPS_ADD\.forEach/);
ok('curated biceps media catalogue',!!block);
const names=block?[...block[1].matchAll(/\{name:'([^']+)'/g)].map(m=>m[1]):[];
const expected=[
  'Ściskanie handgripu','Uginanie młotkowe na modlitewniku',
  'Uginanie na modlitewniku na wyciągu','Uginanie nadgarstków ze sztangą',
  'Uginanie ramion bokiem na wyciągu','Uginanie ramion na górnym wyciągu nad głową',
  'Uginanie ramion nachwytem na wyciągu','Uginanie gryfem łamanym szerokim chwytem'
];
expected.forEach(name=>ok(name,names.includes(name)));
ok('no duplicate curated names',new Set(names).size===names.length);
ok('catalogue is appended without replacing base exercises',src.includes('if(!DEF_EX.some(existing=>existing.name===ex.name))DEF_EX.push(ex);'));
ok('source aliases cover visual variants',src.includes('Uginanie w koncentracji kobieta')&&src.includes('Uginanie w koncentracji mężczyzna')&&src.includes('Uginanie ramion z podparciem o ławkę'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('All biceps media catalogue checks passed');
