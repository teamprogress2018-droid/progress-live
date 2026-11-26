#!/usr/bin/env node
/* Progress Voice — paczka nagrań głosem trenera (ElevenLabs), generowana RAZ po stronie serwera (GitHub Actions).
 *
 * Wejście: teksty z client-voice.js (100 komunikatów PV_LIB + wsparcie PV_SUPPORT) + gotowe wersje dynamiczne,
 * które pojawiają się w każdym treningu: odliczanie 5…1, „Seria druga z czterech.” (n ≤ 8).
 * Wyjście: assets/voice/pv/<hash>.mp3 + assets/voice/pv/manifest.json { voiceId, model, items: { "<tekst>": "<plik>" } }.
 * Aplikacja klienta (client-voice.js, pvLoadPack) odtwarza nagranie, gdy tekst komunikatu jest w manifeście;
 * inaczej — synteza mowy telefonu. Klucz API jest tylko w sekrecie repozytorium (ELEVENLABS_API_KEY), nigdy w aplikacji.
 * Pliki już wygenerowane tym samym głosem i modelem są pomijane (nie płacimy drugi raz).
 *
 * Użycie: ELEVENLABS_API_KEY=… node .github/scripts/build_voice_pack.js [--voice ID] [--model eleven_v4] [--dry]
 */
'use strict';
const fs=require('fs');const path=require('path');const vm=require('vm');const crypto=require('crypto');

const args=process.argv.slice(2);
const arg=(n,d)=>{const i=args.indexOf('--'+n);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:d;};
const DRY=args.includes('--dry');
const VOICE=arg('voice',process.env.PV_VOICE_ID||'ktn1ayYhp3s7pvGT1Y3H');
let MODEL=arg('model',process.env.PV_MODEL||'eleven_v4');
const KEY=process.env.ELEVENLABS_API_KEY||'';
const OUT=path.join('assets','voice','pv');
const MANIFEST=path.join(OUT,'manifest.json');

/* Wskazówki tonu dla modelu v4 (nie są czytane). Piotr zaakceptował wersję „energetic, motivating coach voice”. */
const TONE='[energetic, motivating coach voice] ';
const TONE_COUNT='[clear, energetic] ';

function loadVoiceModule(){
  const src=fs.readFileSync('client-voice.js','utf8');
  const ctx={window:{},localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},console};
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return ctx.window;
}
function lines(){
  const W=loadVoiceModule();
  const out=[];
  W.PV_LIB.forEach(m=>out.push({text:m.text,tone:TONE}));
  Object.values(W.PV_SUPPORT).forEach(t=>out.push({text:t,tone:TONE}));
  ['pięć','cztery','trzy','dwa','jeden'].forEach(t=>out.push({text:t,tone:TONE_COUNT}));
  for(let n=2;n<=8;n++)for(let k=1;k<=n;k++)out.push({text:'Seria '+W.pvOrd(k,true)+' z '+W.pvNumGen(n)+'.',tone:TONE});
  const seen=new Set();return out.filter(x=>!seen.has(x.text)&&seen.add(x.text));
}
const fileFor=t=>crypto.createHash('sha1').update(t).digest('hex').slice(0,16)+'.mp3';

async function tts(text){
  const url=`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE)}?output_format=mp3_44100_64`;
  for(let attempt=1;attempt<=3;attempt++){
    const r=await fetch(url,{method:'POST',headers:{'xi-api-key':KEY,'Content-Type':'application/json',Accept:'audio/mpeg'},body:JSON.stringify({text,model_id:MODEL})});
    if(r.ok)return Buffer.from(await r.arrayBuffer());
    const body=(await r.text()).slice(0,300);
    if(r.status===401||r.status===403)throw new Error('Klucz ElevenLabs odrzucony ('+r.status+'): '+body);
    if((r.status===400||r.status===422)&&MODEL==='eleven_v4'&&!process.env.PV_NO_FALLBACK){
      // Model v4 niedostępny przez API na tym koncie → v2 (bez wskazówek tonu w nawiasach, bo v2 by je przeczytał).
      console.warn('eleven_v4 odrzucony ('+r.status+'), przechodzę na eleven_multilingual_v2: '+body);
      MODEL='eleven_multilingual_v2';text=String(text).replace(/^\[[^\]]*\]\s*/,'');attempt--;continue;
    }
    if(r.status===400||r.status===422)throw new Error('Żądanie odrzucone ('+r.status+', model '+MODEL+'): '+body);
    if(attempt===3)throw new Error('ElevenLabs '+r.status+': '+body);
    await new Promise(res=>setTimeout(res,1500*attempt));
  }
}

(async()=>{
  const list=lines();
  fs.mkdirSync(OUT,{recursive:true});
  let man={voiceId:VOICE,model:MODEL,items:{}};
  try{const old=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));if(old.voiceId===VOICE&&old.model===MODEL)man.items=old.items||{};}catch(e){}
  const todo=list.filter(x=>!(man.items[x.text]&&fs.existsSync(path.join(OUT,man.items[x.text]))));
  const chars=todo.reduce((s,x)=>s+x.text.length,0);
  console.log(`Linii: ${list.length}, do wygenerowania: ${todo.length} (${chars} znaków), głos ${VOICE}, model ${MODEL}`);
  if(DRY){todo.slice(0,10).forEach(x=>console.log(' -',x.text));return;}
  if(todo.length&&!KEY){console.error('Brak sekretu ELEVENLABS_API_KEY (repo → Settings → Secrets and variables → Actions).');process.exit(2);}
  let done=0;
  for(const x of todo){
    const buf=await tts(MODEL==='eleven_v4'?x.tone+x.text:x.text);
    const f=fileFor(x.text);
    fs.writeFileSync(path.join(OUT,f),buf);
    man.items[x.text]=f;done++;
    if(done%20===0){fs.writeFileSync(MANIFEST,JSON.stringify(man,null,1));console.log(`  ${done}/${todo.length}`);}
  }
  // Tylko teksty z bieżącej listy (stare usunięte z manifestu i z dysku).
  const keep=new Set(list.map(x=>x.text));
  for(const t of Object.keys(man.items))if(!keep.has(t)){try{fs.unlinkSync(path.join(OUT,man.items[t]));}catch(e){}delete man.items[t];}
  man.model=MODEL;man.generatedAt=new Date().toISOString();man.count=Object.keys(man.items).length;
  fs.writeFileSync(MANIFEST,JSON.stringify(man,null,1));
  console.log(`Gotowe: ${done} nowych, razem ${man.count} nagrań.`);
})().catch(e=>{console.error(String(e&&e.message||e));process.exit(1);});
