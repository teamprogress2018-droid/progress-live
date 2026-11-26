// Progress Live 3.0 — Etap 4a: komendy głosowe (voice-commands.js) — rozpoznawanie i wykonanie na atrapie treningu.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..','..');
let failed=0;const ok=(n,c,x)=>{console.log((c?'✓ ':'✗ ')+n+(c||!x?'':' — '+x));if(!c)failed++;};
const store={};
const calls=[];
const ctx={console,JSON,Number,String,Math,Date,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}},
  document:{querySelectorAll:()=>[],getElementById:()=>null,body:null}};
ctx.window=ctx;ctx.globalThis=ctx;
Object.assign(ctx,{
  notify:m=>calls.push(['notify',m]),
  pvMuteBtnHTML:()=>'<button data-pv-mute></button>',
  pvSettingsCardHTML:()=>'<section data-pv-settings></section>',
  pvSettings:()=>({enabled:ctx.__pvOn}),pvToggleMute:()=>{ctx.__pvOn=!ctx.__pvOn;calls.push(['mute']);},pvStop:()=>{},
  cwPatchSet:(i,f,v)=>{ctx._cw.exercises[ctx._cw.exIdx].sets[i][f]=v;},
  cwSaveSet:i=>{calls.push(['save',i]);ctx._cw.exercises[ctx._cw.exIdx].sets[i].done=true;},
  cwNav:d=>calls.push(['nav',d]),cwNextEx:()=>calls.push(['nextEx']),cwSkipRest:()=>calls.push(['skipRest']),cwRestAdd:s=>calls.push(['restAdd',s]),
  cwOpenSheet:k=>calls.push(['sheet',k]),cwUndoLastSet:()=>calls.push(['undo']),cwPainOpen:()=>calls.push(['pain']),cwRender:()=>{},
  csNum:n=>String(n).replace('.',','),_clientId:'c1',__pvOn:true
});
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'voice-commands.js'),'utf8'),ctx);
const P=t=>ctx.vcParse(t);

// Liczby słownie
ok('„sześćdziesiąt dwa i pół” → 62.5',ctx.vcWordsToDigits(ctx.vcFold('sześćdziesiąt dwa i pół'))==='62.5');
ok('„sto dwadzieścia pięć” → 125',ctx.vcWordsToDigits(ctx.vcFold('sto dwadzieścia pięć'))==='125');
ok('„dwanaście” → 12',ctx.vcWordsToDigits('dwanascie')==='12');

// Rozpoznawanie
let r=P('60 kilo 10 powtórzeń zapisz');ok('60 kilo 10 powtórzeń zapisz',r.kg===60&&r.reps===10&&r.action==='save',JSON.stringify(r));
r=P('Sześćdziesiąt dwa i pół kilograma, osiem powtórzeń.');ok('słownie, z kropką i przecinkiem',r.kg===62.5&&r.reps===8&&r.action===null,JSON.stringify(r));
r=P('62,5 kg');ok('62,5 kg (przecinek)',r.kg===62.5,JSON.stringify(r));
r=P('80 na 5');ok('„80 na 5” = 80 kg × 5',r.kg===80&&r.reps===5,JSON.stringify(r));
r=P('dziesięć razy');ok('„dziesięć razy” = 10 powt.',r.reps===10&&r.kg==null,JSON.stringify(r));
ok('„zrobione” = zapisz',P('Zrobione').action==='save');
ok('„dalej” = następne',P('dalej').action==='next');
ok('„następne ćwiczenie”',P('następne ćwiczenie').action==='next');
ok('„poprzednie”',P('poprzednie ćwiczenie').action==='prev');
ok('„cofnij”',P('cofnij').action==='undo');
ok('„pomiń przerwę”',P('pomiń przerwę').action==='ready');
ok('„jestem gotowy”',P('jestem gotowy').action==='ready');
r=P('dodaj 30 sekund');ok('„dodaj 30 sekund”',r.action==='addRest'&&r.sec===30,JSON.stringify(r));
ok('„więcej czasu” = +15 s',P('więcej czasu').sec===15);
ok('„wycisz”',P('wycisz').action==='mute');
ok('„włącz głos”',P('włącz głos').action==='unmute');
ok('„jak wykonać to ćwiczenie”',P('jak wykonać to ćwiczenie').action==='tech');
ok('„boli mnie kolano” = ból',P('boli mnie kolano').action==='pain');
ok('zwykła rozmowa = nic',P('która jest godzina').action===null&&P('która jest godzina').kg==null);

// Wykonanie
const fresh=phase=>{ctx._cw={active:true,phase,exIdx:0,exercises:[{name:'Przysiad',sets:[{setNo:1,reps:'',kg:'50',done:false},{setNo:2,reps:'',kg:'50'}]}]};calls.length=0;};
fresh('exercise');
let res=ctx.vcRun(P('60 kilo 10 powtórzeń zapisz'));
ok('wpisuje kg i powt. w bieżącą serię i zapisuje',ctx._cw.exercises[0].sets[0].kg==='60'&&ctx._cw.exercises[0].sets[0].reps==='10'&&calls.some(c=>c[0]==='save'&&c[1]===0),JSON.stringify(calls));
ok('komunikat potwierdza zapis',/Seria 1 zapisana/.test(res.msg)&&/60 kg/.test(res.msg),res.msg);
res=ctx.vcRun(P('12 powtórzeń'));
ok('same liczby trafiają do NASTĘPNEJ serii i nie zapisują',ctx._cw.exercises[0].sets[1].reps==='12'&&!calls.some(c=>c[0]==='save'&&c[1]===1),JSON.stringify(calls));
ok('podpowiedź „powiedz zapisz”',/zapisz/.test(res.msg),res.msg);
fresh('exercise');
res=ctx.vcRun(P('zapisz'));
ok('„zapisz” bez powtórzeń — nie zapisuje, prosi o liczbę',!calls.some(c=>c[0]==='save')&&/powtórzeń/.test(res.msg),res.msg);
fresh('rest');
ctx.vcRun(P('pomiń przerwę'));ok('przerwa: „pomiń przerwę” kończy przerwę',calls.some(c=>c[0]==='skipRest'));
calls.length=0;ctx.vcRun(P('dodaj 30 sekund'));ok('przerwa: +30 s',calls.some(c=>c[0]==='restAdd'&&c[1]===30));
calls.length=0;res=ctx.vcRun(P('zapisz'));ok('przerwa: „zapisz” nic nie zapisuje',!calls.some(c=>c[0]==='save')&&/przerwa/i.test(res.msg),res.msg);
fresh('exercise');res=ctx.vcRun(P('dodaj 30 sekund'));ok('poza przerwą: +30 s odrzucone',!calls.length&&/nie trwa przerwa/.test(res.msg));
fresh('exercise');ctx.vcRun(P('boli'));ok('„boli” tylko otwiera formularz (nic nie wysyła)',calls.length===1&&calls[0][0]==='pain');
fresh('exercise');ctx.vcRun(P('technika'));ok('„technika” otwiera arkusz techniki',calls.some(c=>c[0]==='sheet'&&c[1]==='tech'));
fresh('exercise');ctx.vcRun(P('dalej'));ok('„dalej” = ten sam przycisk co „Następne →”',calls.some(c=>c[0]==='nav'&&c[1]===1));
fresh('exercise');ctx.__pvOn=true;ctx.vcRun(P('wycisz'));ok('„wycisz” wycisza asystenta',ctx.__pvOn===false);
calls.length=0;ctx.vcRun(P('wycisz'));ok('„wycisz” drugi raz nie włącza z powrotem',ctx.__pvOn===false&&!calls.some(c=>c[0]==='mute'));
ctx._cw={active:false};ok('poza treningiem nic się nie dzieje',ctx.vcRun(P('zapisz')).ok===false);
fresh('exercise');ok('ciężar spoza zakresu (900 kg) pomijany',(ctx.vcRun(P('900 kilo 5 powtórzeń')),ctx._cw.exercises[0].sets[0].kg==='50'));

// Ustawienia i mikrofon
ok('domyślnie wyłączone',ctx.vcOn()===false);
ok('wyłączone → brak mikrofonu w nagłówku',ctx.pvMuteBtnHTML()==='<button data-pv-mute></button>');
ctx.vcSetOn(true);
ok('bez Web Speech API → brak mikrofonu nawet po włączeniu',!/data-vc-mic/.test(ctx.pvMuteBtnHTML()));
ctx.webkitSpeechRecognition=function(){};
ok('z Web Speech API i włączone → mikrofon ≥ 44 px obok głośnika',/data-vc-mic/.test(ctx.pvMuteBtnHTML())&&/aria-label="Powiedz komendę"/.test(ctx.pvMuteBtnHTML()));
ok('Profil: osobna karta „Komendy głosowe” z informacją o rozpoznawaniu mowy',/data-vc-settings/.test(ctx.pvSettingsCardHTML())&&/nie zapisuje nagrań/.test(ctx.pvSettingsCardHTML()));
ok('ustawienie per klient na telefonie',JSON.parse(store['pl_vc_v1:c1']).on===true);

if(failed){console.error(failed+' test(ów) nie przeszło');process.exit(1);}
console.log('Komendy głosowe — wszystkie testy przeszły.');
