const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'theme.css'),'utf8');
const app=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');

let failures=0;
function ok(description,condition){
  if(condition)console.log(`✓ ${description}`);
  else{console.error(`✗ ${description}`);failures+=1;}
}

ok('the workout player uses the light canvas',css.includes('html[data-theme="light"] .clive-player-inner { background: var(--bg-main); }'));
ok('completed sets use the independent success colour',css.includes('html[data-theme="light"] .cw-set-done')&&css.includes('background: var(--success-bg);'));
ok('sync status uses semantic success and warning colours',css.includes('html[data-theme="light"] .cw-sync-state')&&css.includes('.cw-sync-state.is-local'));
ok('RPE selection and super-series labels stay legible on the light theme',css.includes('html[data-theme="light"] .clive-check-opt')&&css.includes('html[data-theme="light"] .cw-ss-badge'));
ok('workout controls expose their purpose to screen readers',app.includes('role="status" aria-live="polite"')&&app.includes('aria-label="Seria ${s.setNo}: ciężar"')&&app.includes('aria-label="${s.done?\'Cofnij zatwierdzenie serii\':\'Zatwierdź serię\'} ${s.setNo}"'));
ok('timers and training difficulty use accessible state semantics',app.includes('role="timer" aria-label="Czas treningu"')&&app.includes('aria-pressed="${cw.rating===n?\'true\':\'false\'}"'));

if(failures)process.exit(1);
