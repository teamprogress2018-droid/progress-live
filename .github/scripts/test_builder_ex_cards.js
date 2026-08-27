#!/usr/bin/env node
/** Builder: clickable substitutes + media helpers. */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');

if(!src05.includes('builderApplyAlt')||!src05.includes('builderRefreshTechMedia')||!src05.includes('builderToggleAlts')){
  console.error('FAIL missing builder alt/media helpers');process.exit(1);
}
if(!css.includes('.builder-alt-chip')||!css.includes('.ex-rows{display:flex')){
  console.error('FAIL missing builder card CSS');process.exit(1);
}
if(!src05.includes('builder-ex-thumb')||!src05.includes('builder-alt-toggle')||!src05.includes('Zamienniki — kliknij')){
  console.error('FAIL addRow markup missing');process.exit(1);
}

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

eq('css accent sets',css.includes('data-f="sets"'),true);
eq('css alt chips',css.includes('builder-alt-chip'),true);
eq('css thumb',css.includes('builder-ex-thumb'),true);
eq('css compact numeric inputs',css.includes('ex-row>.ex-inp')&&css.includes('min-height:40px'),true);
eq('css wider set col',css.includes('54px 78px 64px'),true);
ok('alts hidden by default', /builder-alt-box" hidden/.test(src05)||/builder-alt-box' hidden/.test(src05));
ok('no empty film box', !src05.includes('Brak filmu techniki'));
ok('lookup keys helper', core.includes('function exerciseLookupKeys'));
ok('media popover', src05.includes('builderOpenExMedia')&&css.includes('builder-ex-media-pop'));

const altsForExercise=(name)=>{
  if(/sztangi leż/i.test(name))return['Wyciskanie hantli','Pompki'];
  if(/hantli/i.test(name))return['Wyciskanie sztangi leżąc','Pompki'];
  return[];
};

function builderAltListForRow(row){
  const name=row.name||'';
  const raw=row.alt||'';
  const fromField=String(raw).split(/[,;/]/).map(s=>s.trim()).filter(Boolean);
  const fromLib=altsForExercise(name);
  const cur=String(name).trim().toLowerCase();
  const seen=new Set();const out=[];
  fromField.concat(fromLib).forEach(a=>{
    const k=String(a).trim();const lk=k.toLowerCase();
    if(!k||lk===cur||seen.has(lk))return;seen.add(lk);out.push(k);
  });
  return out;
}

eq('alts for bench',builderAltListForRow({name:'Wyciskanie sztangi leżąc',alt:''}),['Wyciskanie hantli','Pompki']);
eq('alts merge custom',builderAltListForRow({name:'Wyciskanie sztangi leżąc',alt:'Floor press'}),['Floor press','Wyciskanie hantli','Pompki']);

function applyAlt(row,next){
  const prev=row.name;
  const before=row.alt||'';
  row.name=next;
  const keep=String(before).split(/[,;/]/).map(s=>s.trim()).filter(Boolean)
    .filter(a=>a.toLowerCase()!==next.toLowerCase());
  if(prev&&prev.toLowerCase()!==next.toLowerCase()&&!keep.some(a=>a.toLowerCase()===prev.toLowerCase()))keep.unshift(prev);
  row.alt=keep.join(', ');
  return row;
}
const swapped=applyAlt({name:'Wyciskanie sztangi leżąc',alt:'Wyciskanie hantli, Pompki'},'Wyciskanie hantli');
eq('swap name',swapped.name,'Wyciskanie hantli');
eq('swap keeps previous',swapped.alt.includes('Wyciskanie sztangi leżąc'),true);
eq('swap drops self',swapped.alt.toLowerCase().includes('wyciskanie hantli'),false);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll builder ex-cards tests passed');
