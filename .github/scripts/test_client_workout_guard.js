// Etap 1 (3.0): strażnik treningu klienta — Wake Lock, zapis przy schowaniu aplikacji, wysyłka po powrocie,
// oraz poprawka ekranu przerwy (odtwarzacz nie zostaje w wysokości „z klawiaturą”).
'use strict';
const fs=require('fs');const vm=require('vm');
const app=fs.readFileSync('10-client-app.js','utf8');
const js=fs.readFileSync('client-simple.js','utf8');const css=fs.readFileSync('client-simple.css','utf8');
let fails=0;const ok=(n,c)=>{console.log((c?'OK   ':'FAIL ')+n);if(!c)fails++;};

// --- poprawka przerwy (statycznie) ---
ok('tryb klawiatury tylko przy aktywnym polu', /const on=typing&&document\.body\.classList\.contains\('cw-playing'\)/.test(js)&&/const fitIfIdle=\(\)=>\{if\(!typingNow\(\)\)fit\(\);\}/.test(js));
ok('po utracie fokusu wysokość wraca', /addEventListener\('focusout',\(\)=>\{setTimeout\(fitIfIdle/.test(js));
ok('kółko przerwy nie ucina się od góry (safe center)', /\.cw-ex-mode \.cs-rest \{[^}]*justify-content: safe center/.test(css));

// --- strażnik (zachowanie na atrapach) ---
const start=app.indexOf('let _cwWakeLock=null;');const end=app.indexOf('window.cwWakeLock=cwWakeLock;');
ok('blok strażnika istnieje', start>0&&end>start);
const block=app.slice(start,end)+';this.api={cwWakeLock,cwGuardSync,cwSaveOnHide,cwResumeSync,get lock(){return _cwWakeLock;}};';

function makeCtx(opts){
  const listeners={};const calls={write:[],queue:[],flush:0,persist:0,lockReq:0,lockRel:0};
  const bodyClasses=new Set(opts.playing?['cw-playing']:[]);
  const ctx={
    window:{_cw:opts.cw||null,addEventListener:(t,f)=>{(listeners['w:'+t]=listeners['w:'+t]||[]).push(f);}},
    document:{visibilityState:opts.visible===false?'hidden':'visible',body:{classList:{contains:c=>bodyClasses.has(c)}},
      addEventListener:(t,f)=>{(listeners['d:'+t]=listeners['d:'+t]||[]).push(f);}},
    navigator:{onLine:opts.online!==false,
      wakeLock:{request:async()=>{calls.lockReq++;return{addEventListener(){},release:async()=>{calls.lockRel++;}};}},
      storage:{persist:async()=>{calls.persist++;return true;}}},
    MutationObserver:undefined,
    cwWriteLocal:(cw,keep)=>{calls.write.push(keep);return true;},
    cwQueuePersist:(cw,st)=>{calls.queue.push(st);return Promise.resolve(true);},
    cwFlushLocal:()=>{calls.flush++;return Promise.resolve(true);}
  };
  vm.createContext(ctx);vm.runInContext(block,ctx);
  return {ctx,calls,bodyClasses};
}

(async()=>{
  // Trening trwa → blokada ekranu + prośba o trwałe dane (raz).
  let t=makeCtx({playing:true});
  t.ctx.api.cwGuardSync();await new Promise(r=>setTimeout(r,0));
  t.ctx.api.cwGuardSync();await new Promise(r=>setTimeout(r,0));
  ok('trening: Wake Lock włączony raz', t.calls.lockReq===1);
  ok('trening: prośba o trwałe dane raz', t.calls.persist===1);
  // Koniec treningu → blokada zwolniona.
  t.bodyClasses.delete('cw-playing');t.ctx.api.cwGuardSync();await new Promise(r=>setTimeout(r,0));
  ok('koniec treningu: Wake Lock zwolniony', t.calls.lockRel===1);

  // Bez treningu nic nie blokujemy.
  t=makeCtx({playing:false});t.ctx.api.cwGuardSync();await new Promise(r=>setTimeout(r,0));
  ok('bez treningu: brak blokady i prośby', t.calls.lockReq===0&&t.calls.persist===0);

  // Schowanie aplikacji w trakcie treningu → zapis w telefonie bez zmiany stanu synchronizacji.
  t=makeCtx({playing:true,cw:{active:true,syncState:'local',status:'in_progress'}});
  t.ctx.api.cwSaveOnHide();
  ok('schowanie: szkic zapisany w telefonie (stan zachowany)', t.calls.write.length===1&&t.calls.write[0]===true);

  // Powrót z niewysłanym zapisem → wysyłka.
  t.ctx.api.cwResumeSync();
  ok('powrót: niezsynchronizowany trening wysłany', t.calls.queue.length===1&&t.calls.queue[0]==='in_progress');
  // Powrót, gdy wszystko wysłane → bez dodatkowego zapisu.
  t=makeCtx({playing:true,cw:{active:true,syncState:'synced',status:'in_progress'}});
  t.ctx.api.cwResumeSync();
  ok('powrót: zsynchronizowany trening bez ponownej wysyłki', t.calls.queue.length===0&&t.calls.flush===0);
  // Powrót bez aktywnego treningu → dosyłamy zaległy szkic z telefonu.
  t=makeCtx({playing:false,cw:null});t.ctx.api.cwResumeSync();
  ok('powrót bez treningu: zaległy szkic dosłany', t.calls.flush===1);
  // Bez sieci nic nie wysyłamy.
  t=makeCtx({playing:true,online:false,cw:{active:true,syncState:'local'}});t.ctx.api.cwResumeSync();
  ok('bez sieci: brak prób wysyłki', t.calls.queue.length===0&&t.calls.flush===0);

  // Zdarzenia podpięte.
  ok('podpięte: visibilitychange + pagehide + MutationObserver', /addEventListener\('visibilitychange'/.test(app.slice(start))&&/addEventListener\('pagehide',cwSaveOnHide\)/.test(app)&&/new MutationObserver\(cwGuardSync\)/.test(app));

  if(fails){console.log(fails+' failed');process.exit(1);}console.log('Strażnik treningu klienta: OK');
})();
