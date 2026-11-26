/* Komunikacja trener ↔ klient: wspólna logika przeglądarki i serwera (bez DOM, bez Firestore).
   - planJobs: jakie wiadomości automatyczne powinny istnieć teraz (A–F),
   - reconcile: co dodać, a co anulować (zmiana / odwołanie terminu, przerwa, brak zgody),
   - pickChannel / nextAfterFailure: jeden kanał naraz, kanał zapasowy po błędzie,
   - applyProviderEvent: statusy tylko takie, jakie da się ustalić (zaplanowano → przekazano → dostarczono → odczytano),
   - texts: krótkie treści bez danych zdrowotnych, z oznaczeniem „Przypomnienie systemowe”.
   Czas: Europe/Warsaw, z uwzględnieniem zmiany czasu (Intl). */
(function(root){
  'use strict';
  const TZ='Europe/Warsaw';
  const DAY=86400000,MIN=60000;

  const DEFAULTS=Object.freeze({
    enabled:false,                 // główny wyłącznik wysyłki (serwer); bez niego tylko podgląd
    remindDayBefore:{on:true,hour:'18:00'},       // A
    meetingChange:{on:true},                      // B
    newPlan:{on:true},                            // C
    firstWorkoutCheck:{on:true,afterHours:3},     // D
    weeklySummary:{on:false,weekday:0,hour:'18:00'},// E (0 = niedziela)
    inactivity:{on:true,days:7,trainerAfterDays:3},// F
    personalRecord:{on:true},                     // G (3.0) gratulacje po rekordzie osobistym
    packageEnding:{on:true,daysBefore:5},         // H (3.0) kończący się pakiet / ostatni trening w pakiecie
    monthlySummary:{on:true,hour:'18:00'},        // I (3.0) podsumowanie miesiąca (Progress Wrapped) 1. dnia miesiąca
    maxPerDay:2,                                  // limit automatów do klienta na dobę (bez spotkań)
    quiet:{from:'21:00',to:'08:00'},
    maxAttempts:3,
    retryMinutes:[5,20,60]
  });

  // ---------- czas w Warszawie ----------
  const pad=n=>String(n).padStart(2,'0');
  function warsawParts(ms){
    const f=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'});
    const o={};f.formatToParts(new Date(ms)).forEach(p=>{o[p.type]=p.value;});
    const wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday];
    return {ymd:`${o.year}-${o.month}-${o.day}`,hm:`${o.hour}:${o.minute}`,weekday:wd};
  }
  /** Godzina zegarowa w Warszawie → moment UTC (ms). Działa przy zmianie czasu (marzec / październik). */
  function warsawToMs(ymd,hm){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd||''));const t=/^(\d{1,2}):(\d{2})/.exec(String(hm||''));
    if(!m||!t)return NaN;
    const guess=Date.UTC(+m[1],+m[2]-1,+m[3],+t[1],+t[2]);
    let ms=guess;
    for(let k=0;k<3;k++){
      const p=warsawParts(ms);const [py,pm,pd]=p.ymd.split('-').map(Number);const [ph,pmin]=p.hm.split(':').map(Number);
      const asUtc=Date.UTC(py,pm-1,pd,ph,pmin);ms+=guess-asUtc;
    }
    return ms;
  }
  function addDaysYmd(ymd,n){const [y,m,d]=ymd.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d+n));return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`;}
  const hmToMin=hm=>{const t=/^(\d{1,2}):(\d{2})/.exec(String(hm||''));return t?+t[1]*60+ +t[2]:null;};

  /** Przesunięcie poza godziny ciszy (np. 21:00–8:00) na najbliższy dozwolony moment. */
  function outsideQuiet(ms,quiet){
    if(!quiet||!quiet.from||!quiet.to)return ms;
    const p=warsawParts(ms),now=hmToMin(p.hm),a=hmToMin(quiet.from),b=hmToMin(quiet.to);
    if(a==null||b==null||a===b)return ms;
    const inQuiet=a<b?(now>=a&&now<b):(now>=a||now<b);
    if(!inQuiet)return ms;
    const day=a<b||now<b?p.ymd:addDaysYmd(p.ymd,1);
    return warsawToMs(day,quiet.to);
  }

  // ---------- dane wejściowe ----------
  const CANCELLED=['cancelled','canceled'];
  const DONE=['completed','partial','finished','missed'];
  function settingsOf(s){
    const o=JSON.parse(JSON.stringify(DEFAULTS));
    if(s&&typeof s==='object')Object.keys(s).forEach(k=>{if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])&&s[k]&&typeof s[k]==='object')Object.assign(o[k],s[k]);else if(s[k]!==undefined)o[k]=s[k];});
    return o;
  }
  /** Klient na przerwie / zawieszony / zarchiwizowany nie dostaje automatów. */
  function clientPaused(c,nowMs){
    if(!c)return true;
    if(['archived','paused','suspended','inactive','former'].includes(String(c.status||'')))return true;
    if(c.commsPausedUntil&&Date.parse(c.commsPausedUntil)>nowMs)return true;
    return false;
  }
  /** Spotkanie z trenerem w kalendarzu (nie trening klienta w aplikacji). */
  function isMeeting(s){return !!s&&!!s.clientId&&!['client','live','homework','sala'].includes(s.source)&&!s.archived;}
  function meetingMs(s){return warsawToMs(String(s.date||'').slice(0,10),s.time||'');}

  /** Status spotkania dla klienta i trenera z zgłoszeń (commsCases) i pola status sesji. */
  function meetingState(s,cases){
    if(!s)return {key:'none'};
    if(CANCELLED.includes(String(s.status||'')))return {key:'cancelled',label:'Odwołane'};
    const mine=(cases||[]).filter(c=>c&&c.sessionId===s.id&&(!c.sessionStamp||c.sessionStamp===stampOf(s)))
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const last=mine[0];
    if(last&&last.type==='meeting_change')return {key:'change_requested',label:'Prośba o zmianę wysłana',case:last};
    if(last&&last.type==='meeting_confirm')return {key:'confirmed',label:'Potwierdzone',case:last};
    return {key:'awaiting',label:'Czeka na potwierdzenie'};
  }
  /** Odcisk terminu: potwierdzenie starego terminu nie przechodzi na nowy. */
  function stampOf(s){return String(s.date||'').slice(0,10)+'T'+String(s.time||'').slice(0,5);}

  // ---------- planowanie (A–F) ----------
  /**
   * state: {clients, sessions, plans, cases, prefs:{[clientId]:pref}, settings, enabledAt}
   * Zwraca listę zadań {id, kind, clientId, dueAt(ms), ref, sessionStamp?, audience:'client'|'trainer'}.
   * Id są deterministyczne — ponowne przeliczenie nie tworzy duplikatu.
   */
  function planJobs(state,nowMs){
    const st=settingsOf(state&&state.settings);
    const clients=(state&&state.clients)||[],sessions=(state&&state.sessions)||[],plans=(state&&state.plans)||[];
    const enabledAt=Date.parse((state&&state.enabledAt)||'')||0;
    const byId={};clients.forEach(c=>{if(c&&c.id)byId[c.id]=c;});
    const out=[];
    const push=j=>{const c=byId[j.clientId];if(!c||(j.audience!=='trainer'&&clientPaused(c,nowMs)))return;
      // Nawyki mają godzinę ustawioną przez trenera — bez przesuwania przez ciszę nocną.
      if(j.audience!=='trainer'&&j.kind!=='meeting_change'&&j.kind!=='meeting_cancel'&&j.kind!=='habit_reminder')j.dueAt=outsideQuiet(j.dueAt,st.quiet);out.push(j);};

    sessions.filter(isMeeting).forEach(s=>{
      const at=meetingMs(s);if(!isFinite(at))return;
      const cancelled=CANCELLED.includes(String(s.status||''));
      // A. Dzień przed o ustalonej godzinie; jeśli termin dodano później — od razu, gdy do spotkania > 3 h.
      if(st.remindDayBefore.on&&!cancelled&&!DONE.includes(String(s.status||''))&&at>nowMs){
        let due=warsawToMs(addDaysYmd(String(s.date).slice(0,10),-1),st.remindDayBefore.hour);
        if(due<nowMs)due=at-nowMs>3*3600000?nowMs:NaN;
        if(isFinite(due)&&due<at)push({id:`rem:${s.id}:${stampOf(s)}`,kind:'meeting_reminder',clientId:s.clientId,dueAt:due,ref:s.id,sessionStamp:stampOf(s),meetingAt:at});
      }
      // B. Zmiana / odwołanie — tylko jeśli trener zmienił termin po włączeniu automatów i spotkanie jeszcze się nie odbyło.
      const ch=Date.parse(s.changedAt||'');
      if(st.meetingChange.on&&ch&&ch>=enabledAt&&nowMs-ch<2*DAY&&at>nowMs){
        push({id:`chg:${s.id}:${s.changedAt}`,kind:cancelled?'meeting_cancel':'meeting_change',clientId:s.clientId,dueAt:ch,ref:s.id,sessionStamp:stampOf(s),meetingAt:at});
      }
    });

    // C. Nowy plan (przypisany po włączeniu automatów, nie starszy niż 2 dni).
    if(st.newPlan.on)plans.forEach(p=>{
      if(!p||!p.clientId||p.archived||p.status==='archived'||p.status==='draft')return;
      const t=Date.parse(p.assignedAt||p.createdAt||'');
      if(!t||t<enabledAt||nowMs-t>2*DAY)return;
      push({id:`plan:${p.id}`,kind:'new_plan',clientId:p.clientId,dueAt:t,ref:p.id});
    });

    const doneBy={};sessions.forEach(s=>{if(s&&s.clientId&&['client','live','sala','homework'].includes(s.source)&&s.status!=='in_progress'){(doneBy[s.clientId]=doneBy[s.clientId]||[]).push(s);}});
    clients.forEach(c=>{
      if(!c||!c.id)return;
      const done=(doneBy[c.id]||[]).slice().sort((a,b)=>String(a.completedAt||a.date||'').localeCompare(String(b.completedAt||b.date||'')));
      // D. Pytanie o samopoczucie po pierwszym zapisanym treningu (raz na klienta).
      if(st.firstWorkoutCheck.on&&done.length){
        const f=done[0],t=Date.parse(f.completedAt||f.createdAt||'');
        if(t&&t>=enabledAt&&nowMs-t<3*DAY)push({id:`well:${c.id}`,kind:'first_workout_check',clientId:c.id,dueAt:t+st.firstWorkoutCheck.afterHours*3600000,ref:f.id});
      }
      // E. Podsumowanie tygodnia w wybranym dniu i godzinie.
      if(st.weeklySummary.on){
        const p=warsawParts(nowMs);let back=(p.weekday-st.weeklySummary.weekday+7)%7;
        const ymd=addDaysYmd(p.ymd,-back);let due=warsawToMs(ymd,st.weeklySummary.hour);
        if(due>nowMs)due=warsawToMs(addDaysYmd(ymd,7),st.weeklySummary.hour);
        else if(nowMs-due>12*3600000)due=warsawToMs(addDaysYmd(ymd,7),st.weeklySummary.hour);
        if(due>=enabledAt)push({id:`week:${c.id}:${warsawParts(due).ymd}`,kind:'weekly_summary',clientId:c.id,dueAt:due,ref:warsawParts(due).ymd});
      }
      // F. Jedno delikatne przypomnienie po N dniach bez aktywności, potem zadanie dla trenera.
      if(st.inactivity.on){
        const last=done.length?Date.parse(done[done.length-1].completedAt||done[done.length-1].date||''):Date.parse(c.createdAt||'');
        if(last){
          const lastYmd=warsawParts(last).ymd;
          const nudge=last+st.inactivity.days*DAY;
          if(nudge<=nowMs+DAY&&nowMs-nudge<2*DAY&&nudge>=enabledAt)push({id:`idle:${c.id}:${lastYmd}`,kind:'inactivity_nudge',clientId:c.id,dueAt:Math.max(nudge,warsawToMs(warsawParts(nudge).ymd,'10:00')),ref:lastYmd});
          const task=nudge+st.inactivity.trainerAfterDays*DAY;
          if(task<=nowMs&&nowMs-task<2*DAY&&task>=enabledAt)push({id:`contact:${c.id}:${lastYmd}`,kind:'trainer_contact',clientId:c.id,dueAt:task,ref:lastYmd,audience:'trainer'});
        }
      }
    });
    planJobs3(state,nowMs,st,push,enabledAt);
    planHabits(state,nowMs,push,enabledAt);
    return out.filter(j=>isFinite(j.dueAt));
  }

  // ---------- zdarzenia 3.0 (G–I) ----------
  const DONE_SRC=['client','live','sala','homework'];
  const exKey=n=>String(n||'').toLowerCase().replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
  const kgNum=v=>{const x=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(x)?x:0;};
  /** Najcięższa seria robocza (kg) każdego ćwiczenia w treningu. */
  function sessionBest(s){
    const out={};
    ((s&&s.exercises)||[]).forEach(ex=>{
      if(!ex||ex.skipped||(ex.loadUnit&&ex.loadUnit!=='kg'))return;
      const k=exKey(ex.name);if(!k)return;
      ((ex.sets||ex.loggedSets||[])).forEach(st=>{if(!st||st.kind==='warmup'||st.done===false)return;const kg=kgNum(st.kg);if(kg>0&&(!out[k]||kg>out[k]))out[k]=kg;});
    });
    return out;
  }
  const doneTime=s=>Date.parse(s.completedAt||s.updatedAt||s.createdAt||'')||Date.parse(String(s.date||'')+'T12:00:00Z')||0;
  /** Rekordy w treningu: ciężar wyższy niż WSZYSTKIE wcześniejsze zapisy tego ćwiczenia (pierwszy zapis to nie rekord).
   *  history = pełna historia klienta — bez niej rekordu nie ogłaszamy (żadnych „rekordów” z niepełnych danych). */
  function sessionPRs(s,history){
    if(!s||!Array.isArray(history))return [];
    const t=doneTime(s),d=String(s.date||'').slice(0,10);
    const earlier=history.filter(x=>x&&x.id!==s.id&&DONE_SRC.includes(x.source)&&x.status!=='in_progress'&&(String(x.date||'').slice(0,10)<d||(String(x.date||'').slice(0,10)===d&&doneTime(x)<t)));
    const prev={};earlier.forEach(x=>{const b=sessionBest(x);Object.keys(b).forEach(k=>{if(!prev[k]||b[k]>prev[k])prev[k]=b[k];});});
    const cur=sessionBest(s);
    return Object.keys(cur).filter(k=>prev[k]&&cur[k]>prev[k]);
  }
  /** Aktywny pakiet klienta (ta sama zasada co w aplikacji: nie wygasły, najpóźniej kończący się). */
  function activePackage(packages,clientId){
    const list=(packages||[]).filter(p=>p&&p.clientId===clientId&&p.status!=='expired'&&p.payStatus!=='expired');
    return list.sort((a,b)=>String(b.expiresDate||b.createdAt||'').localeCompare(String(a.expiresDate||a.createdAt||'')))[0]||null;
  }
  const MEETING_KINDS=['meeting_reminder','meeting_change','meeting_cancel'];
  /** Rodzaje, które nie liczą się do dziennego limitu i nie są nim blokowane. */
  const LIMIT_EXEMPT=MEETING_KINDS.concat('habit_reminder');
  // ---------- J. przypomnienia o nawykach (3.0) ----------
  const HABITS={water:{title:'Czas na wodę',body:'Wypij szklankę wody.'},
    sleep:{title:'Pora szykować się do snu',body:'Odłóż telefon — sen to też część treningu.'},
    steps:{title:'Czas na spacer',body:'Masz chwilę na krótki spacer?'},
    custom:{title:'Przypomnienie od trenera',body:''}};
  const HM=/^([01]\d|2[0-3]):[0-5]\d$/;
  /** Godziny przypomnienia jednego nawyku w ciągu dnia (HH:MM). Woda: od–do co N godzin; reszta: jedna godzina. */
  function habitTimes(it){
    if(!it||it.on===false)return [];
    if(it.id==='water'){
      const from=HM.test(it.from)?it.from:'09:00',to=HM.test(it.to)?it.to:'19:00';
      const step=[1,2,3,4].includes(Number(it.everyH))?Number(it.everyH)*60:120;
      const out=[];for(let m=hmToMin(from);m<=hmToMin(to)&&out.length<16;m+=step)out.push(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'));
      return out;
    }
    if(!HABITS[it.id])return [];
    if(it.id==='custom'&&!String(it.text||'').trim())return [];
    return HM.test(it.at)?[it.at]:[];
  }
  function planHabits(state,nowMs,push,enabledAt){
    const prefs=(state&&state.prefs)||null;
    const p=warsawParts(nowMs),days=[p.ymd,addDaysYmd(p.ymd,1)];
    ((state&&state.clients)||[]).forEach(c=>{
      const h=c&&c.habits;if(!c||!c.id||!h||h.on!==true||!Array.isArray(h.items))return;
      // Na serwerze planujemy tylko dla klientów z włączonym push i bez wyłączonej kategorii (bez setek wpisów „tylko w aplikacji”).
      if(prefs){const pr=prefs[c.id]||{};if(pr.channel==='none'||!(pr.push&&pr.push.subscribed)||(pr.categories&&pr.categories.habits===false))return;}
      h.items.forEach(it=>{
        habitTimes(it).forEach(hm=>days.forEach(d=>{
          const due=warsawToMs(d,hm);
          if(due<enabledAt||due<nowMs-10*MIN||due>nowMs+26*60*MIN)return;
          push({id:`habit:${c.id}:${it.id}:${d}:${hm.replace(':','')}`,kind:'habit_reminder',clientId:c.id,dueAt:due,ref:it.id,habit:it.id,
            ...(it.id==='custom'?{text:String(it.text).slice(0,80)}:{})});
        }));
      });
    });
  }
  /** Dzienny limit automatów do klienta w dniu kalendarzowym (Warszawa; spotkania i zadania trenera się nie liczą). sentAt: lista czasów (ms) wysyłek do klienta. */
  function overDailyLimit(job,sentAt,nowMs,max){
    if(!job||job.audience==='trainer'||LIMIT_EXEMPT.includes(job.kind))return false;
    const m=Number(max);if(!(m>0))return false;
    const day=warsawParts(nowMs).ymd;return (sentAt||[]).filter(t=>t<=nowMs&&warsawParts(t).ymd===day).length>=m;
  }
  function planJobs3(state,nowMs,st,push,enabledAt){
    const clients=(state&&state.clients)||[],sessions=(state&&state.sessions)||[],packages=(state&&state.packages)||[];
    const history=(state&&state.history)||{};
    const p=warsawParts(nowMs);
    clients.forEach(c=>{
      if(!c||!c.id||clientPaused(c,nowMs))return;
      const mine=sessions.filter(s=>s&&s.clientId===c.id&&DONE_SRC.includes(s.source)&&s.status!=='in_progress');
      // G. Rekord osobisty — tylko z pełną historią klienta, w ciągu 2 dni od treningu.
      if(st.personalRecord.on&&history[c.id]){
        mine.forEach(s=>{
          const t=doneTime(s);if(!t||t<enabledAt||nowMs-t>2*DAY)return;
          if(sessionPRs(s,history[c.id]).length)push({id:`pr:${s.id}`,kind:'personal_record',clientId:c.id,dueAt:t+20*MIN,ref:s.id});
        });
      }
      // H. Kończący się pakiet (N dni przed datą) i ostatni trening w pakiecie.
      if(st.packageEnding.on){
        const pkg=activePackage(packages,c.id);
        if(pkg){
          const exp=String(pkg.expiresDate||'').slice(0,10);
          if(/^\d{4}-\d{2}-\d{2}$/.test(exp)&&exp>=p.ymd){
            const start=addDaysYmd(exp,-Math.max(1,Number(st.packageEnding.daysBefore)||5));
            // Stały termin (bez nowMs) — kolejka się nie „przesuwa” przy każdym przebiegu.
            const due=Math.max(warsawToMs(start,'10:00'),enabledAt);
            if(addDaysYmd(start,-1)<=p.ymd)push({id:`pkgend:${pkg.id}:${exp}`,kind:'package_ending',clientId:c.id,dueAt:due,ref:pkg.id,expires:exp});
          }
          const total=Number(pkg.sessions)||0,used=Number(pkg.sessionsUsed)||0;
          const t=Date.parse(pkg.updatedAt||'');
          if(total>1&&total-used===1&&Number.isFinite(t)&&t>=enabledAt&&nowMs-t<3*DAY)
            push({id:`pkglast:${pkg.id}:${total}`,kind:'package_last',clientId:c.id,dueAt:t+5*MIN,ref:pkg.id});
        }
      }
      // I. Podsumowanie miesiąca: 1. dnia miesiąca o ustalonej godzinie, gdy w poprzednim miesiącu był trening.
      if(st.monthlySummary.on&&Number(p.ymd.slice(8,10))<=3){
        const first=p.ymd.slice(0,8)+'01';
        const prevYm=addDaysYmd(first,-1).slice(0,7);
        if(mine.some(s=>String(s.date||'').slice(0,7)===prevYm)){
          const due=warsawToMs(first,st.monthlySummary.hour);
          if(due>=enabledAt&&nowMs-due<3*DAY)push({id:`month:${c.id}:${prevYm}`,kind:'monthly_summary',clientId:c.id,dueAt:due,ref:prevYm});
        }
      }
    });
  }

  /**
   * Porównuje zadania zapisane z tym, co powinno istnieć teraz.
   * - nowe → create (status 'scheduled'),
   * - zaplanowane, których już nie powinno być (zmiana / odwołanie / przerwa / wyłączona automatyzacja) → cancel,
   * - wysłane nigdy nie są anulowane ani tworzone ponownie (brak podwójnej wysyłki).
   */
  function reconcile(existing,desired){
    const have={};(existing||[]).forEach(j=>{if(j&&j.id)have[j.id]=j;});
    const want={};(desired||[]).forEach(j=>{want[j.id]=j;});
    const create=[],cancel=[],update=[];
    Object.keys(want).forEach(id=>{
      const h=have[id];
      if(!h){create.push(Object.assign({status:'scheduled',attempts:0,history:[]},want[id]));return;}
      if(h.status==='scheduled'&&h.dueAt!==want[id].dueAt)update.push({id,dueAt:want[id].dueAt});
    });
    Object.keys(have).forEach(id=>{
      const h=have[id];
      if(!want[id]&&(h.status==='scheduled'||h.status==='retry')&&h.audience!=='trainer'&&['meeting_reminder','first_workout_check','weekly_summary','inactivity_nudge','package_ending','monthly_summary','habit_reminder'].includes(h.kind))cancel.push({id,reason:'nieaktualne'});
    });
    return {create,cancel,update};
  }

  // ---------- kanały ----------
  /** Kanały w kolejności: wybrany przez klienta, potem zapasowy. Bez zgody kanał nie wchodzi w grę. */
  function channelsFor(pref,job){
    const p=pref||{};
    if(job&&job.audience==='trainer')return ['trainer_task'];
    if(p.channel==='none')return ['inapp'];
    const cat=categoryOf(job&&job.kind);
    if(p.categories&&p.categories[cat]===false)return ['inapp'];
    const ok={
      push:!!(p.push&&p.push.subscribed),
      whatsapp:!!(p.whatsapp&&p.whatsapp.optIn&&p.whatsapp.phone&&!p.whatsapp.optOutAt)
    };
    const order=p.channel==='whatsapp'?['whatsapp','push']:['push','whatsapp'];
    let list=order.filter(ch=>ok[ch]);
    if(p.fallback===false)list=list.slice(0,1);
    return list.concat('inapp');
  }
  function categoryOf(kind){
    return {meeting_reminder:'meetings',meeting_change:'meetings',meeting_cancel:'meetings',new_plan:'plan',
      first_workout_check:'checkins',weekly_summary:'checkins',inactivity_nudge:'checkins',
      personal_record:'checkins',monthly_summary:'checkins',package_ending:'plan',package_last:'plan',habit_reminder:'habits'}[kind]||'other';
  }
  function pickChannel(pref,job){return channelsFor(pref,job)[0];}
  /** Po błędzie: ponów ten sam kanał (z przerwą), po wyczerpaniu prób — kolejny kanał; potem „błąd”. */
  function nextAfterFailure(job,pref,settings,nowMs,permanent){
    const st=settingsOf(settings);
    const list=channelsFor(pref,job);
    const tries=(job.attempts||0);
    if(!permanent&&tries<st.maxAttempts){
      const wait=(st.retryMinutes[Math.min(tries-1,st.retryMinutes.length-1)]||60)*MIN;
      return {status:'retry',channel:job.channel,dueAt:nowMs+wait};
    }
    const i=list.indexOf(job.channel);
    const next=list[i+1];
    if(next&&next!=='inapp'&&!job.fallbackUsed)return {status:'retry',channel:next,dueAt:nowMs,attempts:0,fallbackUsed:true};
    return {status:'failed',channel:job.channel};
  }

  // ---------- statusy ----------
  const RANK={scheduled:0,sending:1,handed_over:2,delivered:3,read:4,confirmed:5};
  const LABEL={scheduled:'Zaplanowano',sending:'Wysyłanie',handed_over:'Przekazano do dostawcy',delivered:'Dostarczono',read:'Odczytano',
    confirmed:'Potwierdzono przez klienta',failed:'Błąd',unknown:'Status nieznany',cancelled:'Anulowano',simulated:'Symulacja — nic nie wysłano',inapp:'W aplikacji'};
  /** Zdarzenie od dostawcy → nowy status. Nie cofa statusu (np. spóźnione „sent” po „read”).
      „failed” po „delivered” nie kasuje dostarczenia (WhatsApp potrafi wysłać oba przy kilku urządzeniach). */
  function applyProviderEvent(job,ev){
    const cur=job.status,next=ev&&ev.status;
    if(!next)return job;
    const h=(job.history||[]).concat({at:ev.at||null,status:next,channel:ev.channel||job.channel,code:ev.code||null});
    if(next==='failed'){
      if((RANK[cur]||0)>=RANK.delivered)return Object.assign({},job,{history:h,warning:ev.code||'failed-after-delivery'});
      return Object.assign({},job,{status:'failed',history:h,error:ev.code||'failed'});
    }
    if(RANK[next]==null)return Object.assign({},job,{history:h});
    if((RANK[next]||0)<=(RANK[cur]||0))return Object.assign({},job,{history:h});
    return Object.assign({},job,{status:next,history:h});
  }
  /** Brak odpowiedzi od dostawcy przez 24 h po przekazaniu = „status nieznany”, nie błąd. */
  function staleStatus(job,nowMs){
    if(job.status==='handed_over'&&job.handedAt&&nowMs-Date.parse(job.handedAt)>DAY)return 'unknown';
    return job.status;
  }

  // ---------- treści ----------
  function fmtWhen(ms){
    const p=warsawParts(ms);const [y,m,d]=p.ymd.split('-').map(Number);
    const days=['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'];
    const months=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
    return `${days[p.weekday]}, ${d} ${months[m-1]}, ${p.hm.replace(/^0/,'')}`;
  }
  function fmtDay(ymd){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd||''));if(!m)return '';
    const months=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];return Number(m[3])+' '+months[Number(m[2])-1];}
  /** Treść powiadomienia. Na zablokowanym ekranie: bez zdrowia, pomiarów i nazwy klienta. */
  function texts(job,opts){
    const o=opts||{};const studio=o.studio||'Progress';
    const when=job.meetingAt?fmtWhen(job.meetingAt):'';
    const tag='Przypomnienie systemowe';
    const map={
      meeting_reminder:{title:'Jutro spotkanie z trenerem',body:`${when}. Potwierdź obecność albo poproś o zmianę w aplikacji.`,url:'?cs=meeting'},
      meeting_change:{title:'Zmiana terminu spotkania',body:`Nowy termin: ${when}. Sprawdź szczegóły w aplikacji.`,url:'?cs=meeting'},
      meeting_cancel:{title:'Spotkanie odwołane',body:'Trener odwołał spotkanie. Szczegóły w aplikacji.',url:'?cs=meeting'},
      new_plan:{title:'Masz nowy plan treningowy',body:'Otwórz aplikację, żeby go zobaczyć.',url:'?cs=plan'},
      first_workout_check:{title:'Jak się czujesz po treningu?',body:'Odpowiedz jednym kliknięciem w aplikacji.',url:'?cs=feel'},
      weekly_summary:{title:'Podsumowanie tygodnia',body:'Zobacz, co udało się zrobić w tym tygodniu.',url:'?cs=progress'},
      inactivity_nudge:{title:'Dawno nie było treningu',body:'Jeśli coś przeszkadza, napisz — razem coś ustalimy.',url:'?cs=chat'},
      trainer_contact:{title:'Skontaktuj się z klientem',body:'Brak aktywności mimo przypomnienia.',url:'?screen=inbox'},
      personal_record:{title:'Nowy rekord osobisty!',body:'Gratulacje — zobacz go w Postępach.',url:'?cs=progress'},
      package_ending:{title:'Pakiet treningów wkrótce się kończy',body:(job.expires?'Ważny do '+fmtDay(job.expires)+'. ':'')+'Porozmawiaj z trenerem o przedłużeniu.',url:'?cs=chat'},
      package_last:{title:'Ostatni trening w pakiecie',body:'Porozmawiaj z trenerem o kolejnym pakiecie.',url:'?cs=chat'},
      monthly_summary:{title:'Twoje podsumowanie miesiąca jest gotowe',body:'Zobacz, co udało się osiągnąć.',url:'?cs=progress'},
      habit_reminder:(()=>{const h=HABITS[job.habit]||HABITS.custom;return {title:h.title,body:job.habit==='custom'?String(job.text||'').slice(0,80):h.body,url:'?cs=today'};})()
    };
    const t=map[job.kind]||{title:studio,body:'',url:''};
    return {title:`${studio}: ${t.title}`,body:t.body,url:t.url,tag,systemNote:`${tag} — wiadomość wysłana automatycznie, nie przez trenera osobiście.`};
  }
  /** Szablon WhatsApp (kategoria utility) i jego zmienne. Szablony trzeba zatwierdzić w WhatsApp Manager. */
  function whatsappTemplate(job){
    const when=job.meetingAt?fmtWhen(job.meetingAt):'';
    return ({
      meeting_reminder:{name:'progress_przypomnienie_spotkanie',lang:'pl',vars:[when],buttons:['Potwierdzam','Proszę o zmianę']},
      meeting_change:{name:'progress_zmiana_terminu',lang:'pl',vars:[when]},
      meeting_cancel:{name:'progress_odwolanie_spotkania',lang:'pl',vars:[]},
      new_plan:{name:'progress_nowy_plan',lang:'pl',vars:[]},
      first_workout_check:{name:'progress_samopoczucie',lang:'pl',vars:[]},
      weekly_summary:{name:'progress_podsumowanie_tygodnia',lang:'pl',vars:[]},
      inactivity_nudge:{name:'progress_brak_aktywnosci',lang:'pl',vars:[]},
      personal_record:{name:'progress_rekord',lang:'pl',vars:[]},
      package_ending:{name:'progress_pakiet_konczy_sie',lang:'pl',vars:[job.expires?fmtDay(job.expires):'']},
      package_last:{name:'progress_pakiet_ostatni_trening',lang:'pl',vars:[]},
      monthly_summary:{name:'progress_podsumowanie_miesiaca',lang:'pl',vars:[]}
    })[job.kind]||null;
  }

  // ---------- sprawy „Do odpowiedzi” ----------
  const CASE_TYPES=['meeting_confirm','meeting_change','wellbeing','difficulty','message','trainer_contact'];
  const CASE_LABEL={meeting_confirm:'Potwierdzenie spotkania',meeting_change:'Prośba o zmianę terminu',wellbeing:'Samopoczucie',
    difficulty:'Trudność',message:'Wiadomość',trainer_contact:'Kontakt z klientem'};
  const CASE_STATUS={new:'Nowa',in_progress:'W trakcie',done:'Zakończona'};
  /** Potwierdzenie nie wymaga odpowiedzi — trafia od razu jako zakończone (informacja). */
  function caseNeedsReply(c){return c&&c.type!=='meeting_confirm';}

  const api={TZ,DEFAULTS,settingsOf,warsawParts,warsawToMs,addDaysYmd,outsideQuiet,clientPaused,isMeeting,meetingMs,meetingState,stampOf,
    planJobs,reconcile,channelsFor,sessionPRs,sessionBest,activePackage,overDailyLimit,habitTimes,HABITS,LIMIT_EXEMPT,categoryOf,pickChannel,nextAfterFailure,applyProviderEvent,staleStatus,LABEL,texts,whatsappTemplate,fmtWhen,
    CASE_TYPES,CASE_LABEL,CASE_STATUS,caseNeedsReply};
  root.CommsCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
