// Komunikacja: przypomnienia, zmiana / odwołanie terminu, brak zgody, kanał zapasowy, statusy dostawcy, czas Warszawy.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..','..');
const ctx={console,Intl,Date};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'comms-core.js'),'utf8'),ctx);
const C=ctx.CommsCore;
let failed=0;const ok=(n,c,x)=>{console.log((c?'✓ ':'✗ ')+n+(c||!x?'':' — '+x));if(!c)failed++;};
const iso=ms=>new Date(ms).toISOString();

// Czas Warszawy i zmiana czasu.
ok('zima: 18:00 w Warszawie = 17:00 UTC',iso(C.warsawToMs('2026-11-20','18:00'))==='2026-11-20T17:00:00.000Z');
ok('lato: 18:00 w Warszawie = 16:00 UTC',iso(C.warsawToMs('2026-07-20','18:00'))==='2026-07-20T16:00:00.000Z');
ok('dzień zmiany czasu (25.10.2026): 18:00 = 17:00 UTC',iso(C.warsawToMs('2026-10-25','18:00'))==='2026-10-25T17:00:00.000Z');
ok('dzień zmiany czasu (29.03.2026): 18:00 = 16:00 UTC',iso(C.warsawToMs('2026-03-29','18:00'))==='2026-03-29T16:00:00.000Z');
const q={from:'21:00',to:'08:00'};
ok('godziny ciszy: 22:30 → 8:00 następnego dnia',iso(C.outsideQuiet(C.warsawToMs('2026-11-20','22:30'),q))===iso(C.warsawToMs('2026-11-21','08:00')));
ok('godziny ciszy: 6:00 → 8:00 tego dnia',iso(C.outsideQuiet(C.warsawToMs('2026-11-21','06:00'),q))===iso(C.warsawToMs('2026-11-21','08:00')));
ok('poza ciszą bez zmian',C.outsideQuiet(C.warsawToMs('2026-11-21','12:00'),q)===C.warsawToMs('2026-11-21','12:00'));

// A. Przypomnienie dzień przed.
const now=C.warsawToMs('2026-11-21','10:00');
const client={id:'c1',name:'Anna',status:'active'};
const sess={id:'s1',clientId:'c1',date:'2026-11-23',time:'18:00',type:'Trening personalny',source:'planned'};
const base={clients:[client],sessions:[sess],plans:[],settings:{},enabledAt:'2026-11-01T00:00:00Z'};
let jobs=C.planJobs(base,now);
const rem=jobs.find(j=>j.kind==='meeting_reminder');
ok('A: przypomnienie dzień przed o 18:00 (Warszawa)',rem&&iso(rem.dueAt)===iso(C.warsawToMs('2026-11-22','18:00')),JSON.stringify(rem));
ok('A: id deterministyczne (bez duplikatu po przeliczeniu)',JSON.stringify(C.planJobs(base,now).map(j=>j.id))===JSON.stringify(jobs.map(j=>j.id)));
const r0=C.reconcile([],jobs);
ok('A: nowe zadanie ma status „zaplanowano”',r0.create.length===jobs.length&&r0.create.every(j=>j.status==='scheduled'));
const stored=r0.create;

// Zmiana terminu → stare przypomnienie anulowane, nowe utworzone, informacja o zmianie.
const moved=Object.assign({},sess,{date:'2026-11-24',time:'07:30',changedAt:iso(now-5*60000)});
jobs=C.planJobs(Object.assign({},base,{sessions:[moved]}),now);
let r=C.reconcile(stored,jobs);
ok('zmiana terminu: stare przypomnienie anulowane',r.cancel.some(x=>x.id==='rem:s1:2026-11-23T18:00'),JSON.stringify(r.cancel));
ok('zmiana terminu: nowe przypomnienie na nowy termin',r.create.some(j=>j.id==='rem:s1:2026-11-24T07:30'));
ok('B: informacja o zmianie terminu (od razu, także w ciszy nocnej)',r.create.some(j=>j.kind==='meeting_change'&&j.dueAt===now-5*60000));

// Odwołanie → przypomnienie anulowane, informacja o odwołaniu.
const cancelled=Object.assign({},sess,{status:'cancelled',changedAt:iso(now-60000)});
r=C.reconcile(stored,C.planJobs(Object.assign({},base,{sessions:[cancelled]}),now));
ok('odwołanie: przypomnienie anulowane',r.cancel.some(x=>x.id==='rem:s1:2026-11-23T18:00'));
ok('odwołanie: wiadomość o odwołaniu',r.create.some(j=>j.kind==='meeting_cancel'));
// Już wysłane nie jest anulowane ani wysyłane drugi raz.
r=C.reconcile([Object.assign({},stored[0],{status:'delivered'})],C.planJobs(Object.assign({},base,{sessions:[cancelled]}),now));
ok('wysłane przypomnienie nie jest anulowane ani tworzone ponownie',!r.cancel.length&&!r.create.some(j=>j.id===stored[0].id));

// Przerwa / zawieszenie współpracy.
r=C.reconcile(stored,C.planJobs(Object.assign({},base,{clients:[Object.assign({},client,{status:'paused'})]}),now));
ok('przerwa w treningach: brak nowych zadań i anulowanie zaplanowanych',!r.create.length&&r.cancel.length===1);
r=C.reconcile(stored,C.planJobs(Object.assign({},base,{clients:[Object.assign({},client,{commsPausedUntil:'2026-12-01T00:00:00Z'})]}),now));
ok('wstrzymane powiadomienia do daty',r.cancel.length===1&&!r.create.length);

// Termin dodany późno: < 3 h do spotkania → bez przypomnienia; > 3 h → od razu.
const soon=Object.assign({},sess,{date:'2026-11-21',time:'12:00'});
ok('termin za 2 h: bez przypomnienia',!C.planJobs(Object.assign({},base,{sessions:[soon]}),now).some(j=>j.kind==='meeting_reminder'));
const later=Object.assign({},sess,{date:'2026-11-21',time:'19:00'});
const lj=C.planJobs(Object.assign({},base,{sessions:[later]}),now).find(j=>j.kind==='meeting_reminder');
ok('termin dziś wieczorem: przypomnienie od razu',lj&&lj.dueAt===now);
ok('treningi klienta w aplikacji nie są spotkaniami',!C.planJobs(Object.assign({},base,{sessions:[Object.assign({},sess,{source:'client'})]}),now).some(j=>j.kind==='meeting_reminder'));
ok('zmiany sprzed włączenia automatów nie wysyłają wiadomości',!C.planJobs(Object.assign({},base,{enabledAt:iso(now),sessions:[moved]}),now).some(j=>j.kind==='meeting_change'));

// C, D, E, F.
const plan={id:'p1',clientId:'c1',createdAt:iso(now-3600000)};
ok('C: nowy plan',C.planJobs(Object.assign({},base,{plans:[plan]}),now).some(j=>j.id==='plan:p1'));
ok('C: szkic planu bez wiadomości',!C.planJobs(Object.assign({},base,{plans:[Object.assign({},plan,{status:'draft'})]}),now).some(j=>j.kind==='new_plan'));
const w1={id:'w1',clientId:'c1',source:'client',status:'completed',completedAt:iso(now-3600000)};
const d=C.planJobs(Object.assign({},base,{sessions:[w1]}),now).find(j=>j.kind==='first_workout_check');
ok('D: pytanie po pierwszym treningu (raz na klienta, po 3 h)',d&&d.id==='well:c1'&&d.dueAt===now-3600000+3*3600000);
const e=C.planJobs(Object.assign({},base,{settings:{weeklySummary:{on:true,weekday:0,hour:'18:00'}}}),now).find(j=>j.kind==='weekly_summary');
ok('E: podsumowanie w niedzielę 18:00',e&&iso(e.dueAt)===iso(C.warsawToMs('2026-11-22','18:00')),e&&iso(e.dueAt));
const act=days=>({id:'w0',clientId:'c1',source:'client',status:'completed',completedAt:iso(now-days*86400000)});
let fj=C.planJobs(Object.assign({},base,{sessions:[act(8)]}),now);
ok('F: po 7 dniach bez treningu jedno przypomnienie, jeszcze bez zadania dla trenera',fj.filter(j=>j.kind==='inactivity_nudge').length===1&&!fj.some(j=>j.kind==='trainer_contact'));
fj=C.planJobs(Object.assign({},base,{sessions:[act(11)]}),now);
ok('F: po kolejnych 3 dniach zadanie kontaktu dla trenera (nie do klienta), bez drugiego przypomnienia',fj.some(j=>j.kind==='trainer_contact'&&j.audience==='trainer')&&!fj.some(j=>j.kind==='inactivity_nudge'));
ok('F: dawno nieaktywny klient nie dostaje zaległych wiadomości',!C.planJobs(Object.assign({},base,{sessions:[act(40)]}),now).some(j=>/inactivity|trainer_contact/.test(j.kind)));

// Kanały: zgoda, preferencja, zapasowy, bez wysyłki wszystkim naraz.
const job={kind:'meeting_reminder'};
ok('brak zgody na WhatsApp i brak push → tylko w aplikacji',JSON.stringify(C.channelsFor({channel:'whatsapp',whatsapp:{phone:'48600'}},job))==='["inapp"]');
ok('wybrany WhatsApp z zgodą → WhatsApp, zapasowo push',JSON.stringify(C.channelsFor({channel:'whatsapp',whatsapp:{optIn:true,phone:'48600'},push:{subscribed:true}},job))==='["whatsapp","push","inapp"]');
ok('rezygnacja z WhatsApp wyłącza kanał',C.pickChannel({channel:'whatsapp',whatsapp:{optIn:true,phone:'48600',optOutAt:'2026-11-01'},push:{subscribed:true}},job)==='push');
ok('bez kanału zapasowego, gdy klient tak chce',JSON.stringify(C.channelsFor({channel:'push',push:{subscribed:true},whatsapp:{optIn:true,phone:'1'},fallback:false},job))==='["push","inapp"]');
ok('kategoria wyłączona przez klienta → tylko w aplikacji',C.pickChannel({channel:'push',push:{subscribed:true},categories:{meetings:false}},job)==='inapp');
ok('jeden kanał naraz (pierwszy z listy)',C.pickChannel({channel:'push',push:{subscribed:true},whatsapp:{optIn:true,phone:'1'}},job)==='push');

// Ponowienia i kanał zapasowy.
const pref={channel:'whatsapp',whatsapp:{optIn:true,phone:'48600'},push:{subscribed:true}};
let n=C.nextAfterFailure({channel:'whatsapp',attempts:1,kind:'meeting_reminder'},pref,{},now,false);
ok('błąd przejściowy: ponowienie tego samego kanału za 5 min',n.status==='retry'&&n.channel==='whatsapp'&&n.dueAt===now+5*60000);
n=C.nextAfterFailure({channel:'whatsapp',attempts:3,kind:'meeting_reminder'},pref,{},now,false);
ok('po 3 próbach: kanał zapasowy (push)',n.status==='retry'&&n.channel==='push'&&n.fallbackUsed);
n=C.nextAfterFailure({channel:'whatsapp',attempts:1,kind:'meeting_reminder'},pref,{},now,true);
ok('błąd trwały (np. numer bez WhatsApp): od razu kanał zapasowy',n.channel==='push');
n=C.nextAfterFailure({channel:'push',attempts:3,fallbackUsed:true,kind:'meeting_reminder'},pref,{},now,false);
ok('zapasowy też zawiódł: status „błąd”',n.status==='failed');

// Statusy od dostawcy.
let j={status:'handed_over',history:[]};
j=C.applyProviderEvent(j,{status:'read'});ok('odczytano (WhatsApp może pominąć „dostarczono”)',j.status==='read');
j=C.applyProviderEvent(j,{status:'delivered'});ok('spóźnione „dostarczono” nie cofa statusu',j.status==='read');
j=C.applyProviderEvent({status:'delivered',history:[]},{status:'failed',code:131050});ok('„błąd” po „dostarczono” nie kasuje dostarczenia',j.status==='delivered'&&j.warning===131050);
j=C.applyProviderEvent({status:'handed_over',history:[]},{status:'failed',code:131026});ok('„błąd” przed dostarczeniem',j.status==='failed'&&j.error===131026);
ok('brak potwierdzenia przez 24 h = „status nieznany”, nie błąd',C.staleStatus({status:'handed_over',handedAt:iso(now-25*3600000)},now)==='unknown');

// Treści: oznaczenie systemowe, bez danych zdrowotnych i nazw partii.
const t=C.texts({kind:'meeting_reminder',meetingAt:C.warsawToMs('2026-11-23','18:00')});
ok('treść przypomnienia z datą po polsku',/poniedziałek, 23 listopada, 18:00/.test(t.body),t.body);
ok('oznaczenie „Przypomnienie systemowe”',/Przypomnienie systemowe/.test(t.systemNote)&&/nie przez trenera osobiście/.test(t.systemNote));
const all=['meeting_reminder','meeting_change','meeting_cancel','new_plan','first_workout_check','weekly_summary','inactivity_nudge'].map(k=>C.texts({kind:k,meetingAt:now}));
ok('bez wagi, bólu, partii i ćwiczeń w treściach na ekranie blokady',all.every(x=>!/kg|waga|ból|bark|kolan|plec|klatk|nogi|ćwicz/i.test(x.title+x.body)),JSON.stringify(all.map(x=>x.title)));
ok('szablon WhatsApp dla przypomnienia z przyciskami',C.whatsappTemplate({kind:'meeting_reminder',meetingAt:now}).buttons.length===2);

// Status spotkania dla klienta.
const ms=C.meetingState(sess,[{type:'meeting_confirm',sessionId:'s1',sessionStamp:'2026-11-23T18:00',createdAt:'2026-11-21T09:00:00Z'}]);
ok('potwierdzone',ms.key==='confirmed');
ok('potwierdzenie starego terminu nie dotyczy nowego',C.meetingState(moved,[{type:'meeting_confirm',sessionId:'s1',sessionStamp:'2026-11-23T18:00'}]).key==='awaiting');
ok('odwołane',C.meetingState(cancelled,[]).key==='cancelled');

if(failed){console.error(failed+' błąd(ów)');process.exit(1);}
console.log('Wszystkie testy komunikacji przeszły.');
