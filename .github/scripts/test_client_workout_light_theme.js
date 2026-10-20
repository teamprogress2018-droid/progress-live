const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'theme.css'),'utf8');

let failures=0;
function ok(description,condition){
  if(condition)console.log(`✓ ${description}`);
  else{console.error(`✗ ${description}`);failures+=1;}
}

ok('the workout player uses the light canvas',css.includes('html[data-theme="light"] .clive-player-inner { background: var(--bg-main); }'));
ok('completed sets use the independent success colour',css.includes('html[data-theme="light"] .cw-set-done')&&css.includes('background: var(--success-bg);'));
ok('sync status uses semantic success and warning colours',css.includes('html[data-theme="light"] .cw-sync-state')&&css.includes('.cw-sync-state.is-local'));
ok('RPE selection and super-series labels stay legible on the light theme',css.includes('html[data-theme="light"] .clive-check-opt')&&css.includes('html[data-theme="light"] .cw-ss-badge'));

if(failures)process.exit(1);
