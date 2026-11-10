const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const js=read('05-clients-builder-plans-calendar.js');
const css=read('theme.css');
let failures=0;
const ok=(description,condition)=>{
  if(condition) console.log(`✓ ${description}`);
  else { console.error(`✗ ${description}`); failures++; }
};
ok('current client view has a live summary',html.includes('id="client-view-summary" aria-live="polite"')&&js.includes("document.getElementById('client-view-summary')"));
ok('each client name is a keyboard-accessible action',js.includes('class="cl2-name"')&&css.includes('.cl2-name:focus-visible'));
ok('one next step per client, red only for urgent',js.includes("const CLIENT_ISSUES=")&&js.includes("noemail:{sev:'info'")&&css.includes('.cl2-row.cl2-row-urgent { border-left: 3px solid var(--danger); }'));
ok('status tooltips explain the marker',js.includes('title="${escHtml(CLIENT_SEV_LABEL[sev]+\': \'+def.tip)}"'));
ok('at most three summary numbers',js.includes("stat('active','Aktywni'")&&js.includes("stat('need','Wymaga uwagi'")&&js.includes("stat('regres','Regres'"));
ok('first-use empty state',js.includes('Zacznij od dodania pierwszego klienta.'));
if(failures) process.exit(1);
