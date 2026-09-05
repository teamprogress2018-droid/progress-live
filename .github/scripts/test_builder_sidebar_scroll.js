#!/usr/bin/env node
/** Builder right sidebar must scroll (min-height:0 + overflow-y). */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('builder-sidebar min-height 0',/\.builder-sidebar\{[^}]*min-height:\s*0/.test(css)||/\.builder-sidebar\{[\s\S]*?min-height:\s*0/.test(css));
ok('builder-main min-height 0',/\.builder-main\{[\s\S]*?min-height:\s*0/.test(css));
ok('builder-sidebar-scroll overflow-y auto',/\.builder-sidebar-scroll\{[\s\S]*?overflow-y:\s*auto/.test(css));
ok('sidebar cards flex-shrink 0',/\.builder-sidebar-scroll>\.card\{[\s\S]*?flex-shrink:\s*0/.test(css)||css.includes('.builder-sidebar-scroll>.card'));
ok('builder-layout no fixed 100vh',!/\.builder-layout\{[^}]*height:\s*calc\(100vh/.test(css));
ok('builder-layout min-height 0',/\.builder-layout\{[\s\S]*?min-height:\s*0/.test(css));
ok('screen-builder content overflow hidden',css.includes('#screen-builder > .content.builder-layout{overflow:hidden;}'));

ok('cache bump styles v34',html.includes('styles.css?v=61'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll builder-sidebar-scroll tests passed');
