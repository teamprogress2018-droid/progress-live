const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..','..');
const wizard=fs.readFileSync(path.join(root,'12-manual-plan-wizard.js'),'utf8');
const profile=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');

const assert=(ok,label)=>{if(!ok)throw new Error(label);};
assert(/function openManualPlanPicker\(clientId\)/.test(wizard),'kreator przyjmuje klienta z punktu wejścia');
assert(/const selected=clientId\|\|\(document\.getElementById\('b-client'\)/.test(wizard),'punkt wejścia zachowuje wskazanego klienta');
assert(/onclick="openManualPlanPicker\('\$\{c\.id\}'\)"/.test(profile),'profil klienta otwiera kreator planu ręcznego');
assert(!/onclick="openBuilderForClient\('\$\{c\.id\}'\)"/.test(profile),'profil nie omija kreatora planu ręcznego');
console.log('OK manual plan entrypoints');
