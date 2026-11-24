// Etap 2 modernizacji: kółko odliczania przerwy i odliczanie głosem po polsku (5…1, start), wyłączane przełącznikiem.
'use strict';
const fs=require('fs');const vm=require('vm');
const js=fs.readFileSync('client-simple.js','utf8');const css=fs.readFileSync('client-simple.css','utf8');const app=fs.readFileSync('10-client-app.js','utf8');
let fails=0;const ok=(n,c)=>{console.log((c?'OK   ':'FAIL ')+n);if(!c)fails++;};
ok('kółko w ekranie przerwy', /data-cs-rest-arc/.test(js)&&/class="cs-rest-ring"/.test(js)&&css.includes('.cs-ring-arc'));
ok('pełny czas przerwy zapamiętany (restTotal)', /cw\.restTotal=cw\.restLeft/.test(app)&&/cw\.restTotal=Math\.max/.test(js));
ok('głos po polsku: pięć…jeden, start', /pięć/.test(js)&&/'start'/.test(js)&&/u\.lang='pl-PL'/.test(js));
ok('głos tylko przy włączonym przełączniku', /if\(silent\|\|!csRestSignalOn\(\)\)return;/.test(js));
ok('głos odblokowany dotknięciem „Zapisz serię”', /csRestUnlockVoice\(\);/.test(js));
// Przesunięcie łuku: pełne kółko na starcie, puste na końcu.
const m=js.match(/const CS_RING_C=[^\n]+\nfunction csRestRingOffset[^\n]+/);
const ctx={};vm.runInNewContext(m[0]+';this.f=csRestRingOffset;this.C=CS_RING_C;',ctx);
ok('łuk: start = 0, połowa = C/2, koniec = C', Number(ctx.f(90,90))===0&&Math.abs(Number(ctx.f(45,90))-ctx.C/2)<0.2&&Math.abs(Number(ctx.f(0,90))-ctx.C)<0.2);
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Kółko i głos przerwy: OK');
