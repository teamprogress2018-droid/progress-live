// Progress Voice — imię klienta głosem trenera: wołacz, zgodność tekstów aplikacja ↔ serwer, logika funkcji voiceNameClips na atrapach.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..','..');
const V=require(path.join(root,'server/automation/voice-names.cjs'));
let failed=0;const ok=(n,c,x)=>{console.log((c?'✓ ':'✗ ')+n+(c||!x?'':' — '+x));if(!c)failed++;};

// Aplikacja (client-voice.js)
const ctx={window:{},localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'client-voice.js'),'utf8'),ctx);
const W=ctx.window;
ok('te same zwroty z imieniem w aplikacji i na serwerze',JSON.stringify(W.PV_NAME_LINES)===JSON.stringify(V.VOICE_NAME_LINES));
const cases={'Anna Kowalska':'Anno','Kasia':'Kasiu','Piotr Urbaniak':'Piotrze','Paweł':'Pawle','Marek':'Marku','Tomasz':'Tomaszu','Adam':'Adamie',
  'Robert':'Robercie','Dawid':'Dawidzie','Marta':'Marto','Natalia':'Natalio','Ola':'Olu','Zosia':'Zosiu','Kuba':'Kubo','Bartek':'Bartku','Kamil':'Kamilu',
  'Sebastian':'Sebastianie','Agnieszka':'Agnieszko','Michał':'Michale','Ewa':'Ewo','Szymon':'Szymonie'};
const bad=Object.entries(cases).filter(([n,v])=>W.pvVocative(n)!==v).map(([n,v])=>n+'→'+W.pvVocative(n)+' (oczek. '+v+')');
ok('wołacz: typowe imiona ('+Object.keys(cases).length+')',!bad.length,bad.join(', '));
ok('puste imię → ""',W.pvVocative('')==='');
ok('walidacja imienia: litery, spacja, myślnik; bez znaków specjalnych',W.pvNameOk('Anno')&&W.pvNameOk('Anno-Mario')&&!W.pvNameOk('<b>')&&!W.pvNameOk('x'.repeat(30))&&!W.pvNameOk(''));
ok('serwer ma tę samą walidację',V.nameOk('Anno')&&V.nameOk('Anno-Mario')&&!V.nameOk('<script>')&&!V.nameOk(''));

// Silnik: imię tylko przy nagraniu (głos trenera) albo z głosem telefonu
W.CL=[{id:'c1',voiceName:'Anno'}];W._clientId='c1';
ok('głos trenera bez nagrania imienia → bez zwrotu z imieniem',W.pvNameLine(3)==='');
W.PV.clientPack={'Brawo, Anno!':'blob:x'};
ok('głos trenera z nagraniem → „Brawo, Anno!”',W.pvNameLine(3)==='Brawo, Anno!');
W.PV.pack={};
ok('źródło nagrania: prywatny plik klienta (blob:)',JSON.stringify(W.pvPackSource({text:'Brawo, Anno!'}))===JSON.stringify('blob:x'));
W.CL=[{id:'c1',voiceName:'<b>'}];
ok('nieprawidłowe imię na karcie → bez imienia',W.pvNameLine(3)==='');

// Logika funkcji na atrapach Firestore/Storage/ElevenLabs
function fakeDb(docs){
  return {collection:c=>({doc:id=>({
    get:async()=>({exists:!!docs[c+'/'+id],data:()=>docs[c+'/'+id]}),
    set:async(d,o)=>{docs[c+'/'+id]=o&&o.merge?{...(docs[c+'/'+id]||{}),...d}:d;}
  })})};
}
function fakeBucket(files){
  return {file:p=>({exists:async()=>[!!files[p]],save:async(b,o)=>{files[p]={len:b.length,type:o.contentType};},delete:async()=>{delete files[p];}})};
}
const calls=[];const fetchImpl=async(url,o)=>{calls.push(JSON.parse(o.body).text);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(10)};};
(async()=>{
  const docs={'trainerRoles/t1':{uid:'t1',role:'trainer',enabled:true},'clients/c1':{trainerId:'t1',name:'Anna Kowalska',voiceName:'Anno'},
    'clients/c2':{trainerId:'t2',voiceName:'Olu'},'clients/c3':{trainerId:'t1'}};
  const files={};const db=fakeDb(docs),bucket=fakeBucket(files);
  const err=async p=>{try{await p;return '';}catch(e){return e.code;}};
  ok('bez logowania → unauthenticated',await err(V.recordClientName({db,bucket,trainerId:'',clientId:'c1',apiKey:'k',fetchImpl}))==='unauthenticated');
  ok('konto bez roli trenera → permission-denied',await err(V.recordClientName({db,bucket,trainerId:'x',clientId:'c1',apiKey:'k',fetchImpl}))==='permission-denied');
  ok('cudzy klient → permission-denied',await err(V.recordClientName({db,bucket,trainerId:'t1',clientId:'c2',apiKey:'k',fetchImpl}))==='permission-denied');
  ok('bez zapisanego imienia → failed-precondition',await err(V.recordClientName({db,bucket,trainerId:'t1',clientId:'c3',apiKey:'k',fetchImpl}))==='failed-precondition');
  ok('bez klucza ElevenLabs → failed-precondition',await err(V.recordClientName({db,bucket,trainerId:'t1',clientId:'c1',apiKey:'',fetchImpl}))==='failed-precondition');
  ok('odrzucone wywołania nie wołają ElevenLabs',calls.length===0);
  const r=await V.recordClientName({db,bucket,trainerId:'t1',clientId:'c1',apiKey:'k',fetchImpl,now:Date.parse('2026-11-27T08:00:00Z')});
  ok('nagrano 4 zwroty z „Anno”',r.generated===4&&r.count===4&&calls.every(t=>/Anno/.test(t))&&calls.length===4,JSON.stringify(r)+calls.join('|'));
  const cv=docs['clientVoice/c1'];
  ok('spis w clientVoice/c1 (trainerId, imię, pliki n_<hash>.mp3)',cv&&cv.trainerId==='t1'&&cv.name==='Anno'&&Object.values(cv.items).every(f=>/^n_[a-f0-9]{16}\.mp3$/.test(f)));
  ok('pliki w prywatnej ścieżce client-voice/t1/c1/ jako audio/mpeg',Object.keys(files).length===4&&Object.keys(files).every(p=>p.startsWith('client-voice/t1/c1/n_'))&&Object.values(files).every(f=>f.type==='audio/mpeg'));
  await V.recordClientName({db,bucket,trainerId:'t1',clientId:'c1',apiKey:'k',fetchImpl,now:Date.parse('2026-11-27T08:01:00Z')});
  ok('ponowne wywołanie bez zmian — nic nie generuje (nie płacimy drugi raz)',calls.length===4);
  docs['clients/c1'].voiceName='Aniu';
  await V.recordClientName({db,bucket,trainerId:'t1',clientId:'c1',apiKey:'k',fetchImpl,now:Date.parse('2026-11-27T08:02:00Z')});
  ok('zmiana formy imienia → nowe nagrania, stare pliki usunięte',calls.length===8&&Object.keys(files).length===4&&docs['clientVoice/c1'].name==='Aniu');
  docs['voiceNameQuota/t1_2026-11-27']={calls:V.MAX_DAILY};
  ok('dzienny limit wywołań',await err(V.recordClientName({db,bucket,trainerId:'t1',clientId:'c1',apiKey:'k',fetchImpl,now:Date.parse('2026-11-27T09:00:00Z')}))==='resource-exhausted');
  const failFetch=async()=>({ok:false,status:500});
  delete docs['voiceNameQuota/t1_2026-11-28'];docs['clients/c1'].voiceName='Anko';
  ok('błąd ElevenLabs → unavailable',await err(V.recordClientName({db,bucket,trainerId:'t1',clientId:'c1',apiKey:'k',fetchImpl:failFetch,now:Date.parse('2026-11-28T09:00:00Z')}))==='unavailable');
  if(failed){console.error(failed+' test(ów) nie przeszło');process.exit(1);}
  console.log('Imiona głosem trenera — wszystkie testy przeszły.');
})();
