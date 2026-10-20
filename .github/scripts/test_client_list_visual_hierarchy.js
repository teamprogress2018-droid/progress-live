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
ok('each client name is a keyboard-accessible action',js.includes('class="cl-client-open"')&&css.includes('.cl-client-open:focus-visible'));
ok('attention is represented by an independent semantic warning marker',js.includes("Object.values(clientAttentionFlags).some(Boolean)")&&css.includes('border-left: 3px solid var(--warning)'));
ok('the summary stays readable on smaller screens',css.includes('.cl-view-summary { margin-right: auto; }'));
if(failures) process.exit(1);
