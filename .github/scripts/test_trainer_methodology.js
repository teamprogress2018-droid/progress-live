const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const api=require(path.join(root,'trainer-methodology.js'));
const materials=[
 {id:'a',title:'Domyślny',text:'Zasada A',approved:true,mode:'default'},
 {id:'b',title:'Wybrany',text:'Zasada B',approved:true,mode:'selected'},
 {id:'c',title:'Nie zatwierdzono',text:'Zasada C',approved:false,mode:'default'},
 {id:'d',title:'Referencja',text:'Zasada D',approved:true,mode:'reference'}];
let prompt=api.context({philosophy:'Najpierw technika',materials},[]);
assert.ok(prompt.includes('Zasada A')&&prompt.includes('Najpierw technika'));
assert.ok(!prompt.includes('Zasada B')&&!prompt.includes('Zasada C')&&!prompt.includes('Zasada D'));
assert.ok(api.context({materials},['b','c','d']).includes('Zasada B'));
assert.equal(api.context({materials:[materials[2]]},[]),'');
assert.equal(api.normalize({philosophy:'a'.repeat(9000),materials:[{id:'x',text:'x'.repeat(20000)}]}).materials[0].text.length,16000);
assert.equal(api.normalize({philosophy:'a'.repeat(9000)}).philosophy.length,6000);
const code=fs.readFileSync(path.join(root,'03-ai-plangen-bizstats-aicoach.js'),'utf8');
const fn=code.slice(code.indexOf('function aplVolumeTarget('),code.indexOf('window.aplVolumeTarget='));
const ctx={};vm.createContext(ctx);vm.runInContext(fn,ctx);
assert.deepEqual(ctx.aplVolumeTarget('zaawansowany',90,'wspomagany'),ctx.aplVolumeTarget('zaawansowany',90,'naturalny'));
assert.deepEqual(ctx.aplVolumeTarget('sredni',60,'TRT'),ctx.aplVolumeTarget('sredni',60,''));
assert.equal((code.match(/window.tmPrompt\(\)/g)||[]).length,2,'methodology included in initial and continuation requests');
console.log('PASS: approved material selection, limits, privacy prompt, chunk context and no automatic anabolic volume increase');
