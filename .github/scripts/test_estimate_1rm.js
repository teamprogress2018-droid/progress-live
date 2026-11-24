// Szacowany 1RM w aplikacji klienta (client-progress.js): 1 powt. = ciężar, 2–10 powt. = średnia Epleya i Brzyckiego, powyżej 10 — brak szacunku.
'use strict';
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('client-progress.js','utf8');
const fn=src.match(/function estimate1RM\(kg,reps\)\{[\s\S]*?\n\}/)[0];
const ctx={};vm.runInNewContext(fn+';this.f=estimate1RM;',ctx);
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c?'':' — '+x));if(!c)fails++;};
ok('1 powt. = ciężar', ctx.f(100,1)===100, ctx.f(100,1));
ok('5 powt.: 100 kg → ok. 114,6 kg', Math.abs(ctx.f(100,5)-114.6)<0.2, ctx.f(100,5));
ok('10 powt.: 80 kg → ok. 106,7 kg', Math.abs(ctx.f(80,10)-106.7)<0.2, ctx.f(80,10));
ok('12 powt.: brak szacunku', ctx.f(60,12)===null, ctx.f(60,12));
ok('przecinek dziesiętny', Math.abs(ctx.f('72,5',8)-90.9)<0.2, ctx.f('72,5',8));
ok('złe dane: brak szacunku', ctx.f(0,5)===null&&ctx.f(80,0)===null&&ctx.f('',5)===null);
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Szacowany 1RM: OK');
