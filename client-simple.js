/* Progress Live — prosty widok klienta (aplikacja klienta, tryb live).
 * Zasada: na ekranie „Dzisiaj” jedna główna akcja. Rozpiska, ciężary i statystyki
 * dopiero po wejściu w trening, plan albo „Więcej statystyk”.
 * Ekrany: Dzisiaj (csTodayHTML), Trening (csTrainScreenHTML + cwSimpleExerciseHTML),
 * Plan (csPlanHTML), Postępy (csProgressHTML), Kontakt (csContactHTML).
 * Dane: te same co dotąd (PL, SE, METRIC_ENTRIES, SETTINGS z publicznego profilu trenera). */

const CS_ICONS={
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  card:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  wifiOff:'<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.3-1.7"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"></path>',
  train:'<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"></path>',
  plan:'<rect x="4" y="5" width="16" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M4 10h16"></path>',
  progress:'<path d="M4 19h16M7 15l4-4 3 3 5-6"></path>',
  more:'<circle cx="5" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="19" cy="12" r="1.3"></circle>',
  contact:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"></path>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"></path>',
  clock:'<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  chevron:'<path d="M9 6l6 6-6 6"></path>',
  back:'<path d="M15 6l-6 6 6 6"></path>',
  down:'<path d="M6 9l6 6 6-6"></path>',
  close:'<path d="M6 6l12 12M18 6L6 18"></path>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
  pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle>',
  globe:'<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path>',
  checkin:'<path d="M9 11l3 3 8-8"></path><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"></path>',
  homework:'<path d="M4 11l8-7 8 7"></path><path d="M6 10v10h12V10"></path>',
  play:'<rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M10 9v6l5-3z"></path>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path><path d="M4 19V5"></path>',
  users:'<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"></path>',
  user:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>'
};
function csIcon(name,size){
  const s=size||22;
  return `<svg class="cs-ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${CS_ICONS[name]||''}</svg>`;
}
const CS_PLAY_ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 4.5v15l13-7.5z"></path></svg>';
window.csIcon=csIcon;

function csEsc(s){return typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function csToday(){return typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);}
function csYmd(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
function csAddDays(ymd,n){const d=new Date(String(ymd).slice(0,10)+'T12:00:00');d.setDate(d.getDate()+n);return csYmd(d);}
function csMonday(ymd){const d=new Date(String(ymd).slice(0,10)+'T12:00:00');const dow=d.getDay();d.setDate(d.getDate()+(dow===0?-6:1-dow));return csYmd(d);}
function csDow(ymd){return new Date(String(ymd).slice(0,10)+'T12:00:00').getDay();}
const CS_WEEKDAYS=['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
const CS_MONTHS_GEN=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
const CS_MONTHS_LOC=['styczniu','lutym','marcu','kwietniu','maju','czerwcu','lipcu','sierpniu','wrześniu','październiku','listopadzie','grudniu'];
const CS_ORD=['pierwszy','drugi','trzeci','czwarty','piąty','szósty','siódmy','ósmy','dziewiąty','dziesiąty'];
function csDateLabel(ymd){const d=new Date(String(ymd).slice(0,10)+'T12:00:00');return CS_WEEKDAYS[d.getDay()]+', '+d.getDate()+' '+CS_MONTHS_GEN[d.getMonth()];}
function csPlural(n,one,few,many){const a=Math.abs(n)%100,b=a%10;if(n===1)return one;if(b>=2&&b<=4&&(a<12||a>14))return few;return many;}

/** Treningi klienta wykonane w aplikacji lub z trenerem na żywo (bez wpisów „zaplanowany”). */
function csDoneSessions(c){
  const ok=['completed','partial','finished',''];
  return (window.SE||[]).filter(s=>s&&s.clientId===c.id&&(s.source==='client'||s.source==='live')&&ok.includes(String(s.status||''))&&s.date);
}
function csWeekDone(c,ymd){
  const mon=csMonday(ymd||csToday()),sun=csAddDays(mon,6);
  return new Set(csDoneSessions(c).filter(s=>s.date>=mon&&s.date<=sun).map(s=>s.date)).size;
}
/** Ile treningów w tygodniu: dni z harmonogramu klienta, a bez niego dni treningowe planu. */
function csWeekTarget(c,plan){
  const wds=typeof clientPreferredWeekdays==='function'?clientPreferredWeekdays(c):null;
  if(wds&&wds.length)return Math.min(7,wds.length);
  if(!plan)return 0;
  const n=typeof planTrainingDayIdxs==='function'?planTrainingDayIdxs(plan).length:(plan.days||[]).filter(d=>d&&!d.rest).length;
  return Math.min(7,n);
}
/** Szacowany czas: rozgrzewka 8 min + każda seria ok. 40 s pracy + przerwa z planu; w górę do 5 min. */
function csDurationMin(day){
  const list=(day&&day.exercises)||[];
  if(!list.length)return 0;
  let sec=8*60;
  list.forEach(raw=>{
    const p=typeof parsePlanExercise==='function'?parsePlanExercise(raw):raw||{};
    const sets=parseInt(p.sets,10)||3;
    const rest=typeof parseRestSeconds==='function'?(parseRestSeconds(p.rest)||90):90;
    sec+=sets*(40+rest);
  });
  return Math.max(10,Math.ceil(sec/60/5)*5);
}
/** Nazwa dnia do pokazania klientowi: „Full Body” zamiast „Dzień 1”, opis pod spodem. */
function csDayTitle(day,idx){
  const label=typeof capDayLabel==='function'?capDayLabel(day,idx||0):((day&&(day.day||day.dayName))||('Dzień '+((idx||0)+1)));
  const stripped=String(label).replace(/^dzie[ńn]\s*\d+\s*[—–:\-]?\s*/i,'').trim();
  const muscles=String((day&&(day.muscles||day.focus))||'').trim();
  if(stripped)return {title:stripped,sub:muscles&&muscles.toLowerCase()!==stripped.toLowerCase()?muscles:''};
  if(muscles)return {title:muscles,sub:label};
  return {title:label,sub:''};
}
function csExerciseCount(day){return ((day&&day.exercises)||[]).length;}
function csMetaLine(day){
  const n=csExerciseCount(day),min=csDurationMin(day);
  return `<div class="cs-meta">${min?`<span>${csIcon('clock',18)}ok. ${min} min</span>`:''}<span>${csIcon('list',18)}${n} ${csPlural(n,'ćwiczenie','ćwiczenia','ćwiczeń')}</span></div>`;
}
function csWeekBar(c,plan){
  const target=csWeekTarget(c,plan);
  if(!target)return '';
  const done=csWeekDone(c);
  const segs=Array.from({length:target},(_,i)=>`<span class="${i<Math.min(done,target)?'is-on':''}"></span>`).join('');
  return `<div class="cs-week" aria-label="W tym tygodniu: ${done} z ${target} treningów">
    <div class="cs-week-row"><span>W tym tygodniu</span><b>${done} z ${target} ${csPlural(target,'treningu','treningów','treningów')}</b></div>
    <div class="cs-week-bar" style="grid-template-columns:repeat(${target},minmax(0,1fr))" aria-hidden="true">${segs}</div>
  </div>`;
}
function csChatVisible(){return typeof capClientSectionVisible!=='function'||capClientSectionVisible('messages');}
function csTrainerAction(){return csChatVisible()?"setClientLiveScreen('messages')":"setClientLiveScreen('contact')";}

/** Start z jednego dotknięcia: bez ekranu z listą ćwiczeń, od razu pierwsze ćwiczenie. */
function csStart(planId,dayIdx){
  if(typeof cwOpen!=='function')return;
  cwOpen(planId,dayIdx);
  if(window._cw&&window._cw.phase==='overview'&&typeof cwBegin==='function')cwBegin();
}
window.csStart=csStart;

function csTodayState(c){
  const slot=typeof capTodaySlot==='function'?capTodaySlot(c):{kind:'noplan'};
  const inProgress=typeof cwFindResumable==='function'&&slot.plan?cwFindResumable(slot.plan.id,slot.dayIdx):null;
  return {slot,inProgress};
}

/** Karta „Dzisiejszy plan” — wspólna dla ekranu Dzisiaj i Trening. */
function csTodayCardHTML(c,st){
  const {slot,inProgress}=st;
  const startCall=slot.plan?`csStart('${csEsc(slot.plan.id)}',${Number(slot.dayIdx)||0})`:'';
  if(inProgress&&inProgress.completeLocal){
    return `<section class="cs-card is-done"><div class="cs-check" aria-hidden="true">${csIcon('check',26)}</div><h2 class="cs-card-title">Trening zapisany</h2><p class="cs-card-text">Zapisano ${Number(inProgress.confirmedSets||0)} ${csPlural(Number(inProgress.confirmedSets||0),'serię','serie','serii')} na telefonie. Wyślemy je, gdy wróci internet.</p></section>`;
  }
  if(inProgress){
    const t=csDayTitle(slot.day,slot.dayIdx);
    return `<section class="cs-card" data-cap-swipe-plan><div class="cs-eyebrow">TRENING W TOKU</div><h2 class="cs-card-title">${csEsc(inProgress.dayName&&!/^dzie[ńn]\s*\d+$/i.test(inProgress.dayName)?inProgress.dayName:t.title)}</h2><p class="cs-card-text">Zapisano ${Number(inProgress.confirmedSets||0)} ${csPlural(Number(inProgress.confirmedSets||0),'serię','serie','serii')}${inProgress.syncState==='local'?' · na telefonie':''}.</p><button type="button" class="cs-btn cs-btn-primary" onclick="${startCall}">${CS_PLAY_ICON}Wznów trening</button></section>`;
  }
  if(slot.kind==='workout'){
    const t=csDayTitle(slot.day,slot.dayIdx);
    return `<section class="cs-card" data-cap-swipe-plan><div class="cs-eyebrow">DZISIEJSZY PLAN</div><h2 class="cs-card-title">${csEsc(t.title)}</h2>${t.sub?`<p class="cs-card-sub">${csEsc(t.sub)}</p>`:''}${csMetaLine(slot.day)}<button type="button" class="cs-btn cs-btn-primary" onclick="${startCall}">${CS_PLAY_ICON}Rozpocznij trening</button></section>`;
  }
  if(slot.kind==='done'){
    return `<section class="cs-card is-done"><div class="cs-check" aria-hidden="true">${csIcon('check',26)}</div><h2 class="cs-card-title">Trening zrobiony</h2><p class="cs-card-text">Dobra robota. Teraz czas na odpoczynek.</p><button type="button" class="cs-btn cs-btn-secondary" onclick="setClientLiveScreen('progress')">Zobacz postępy</button></section>`;
  }
  if(slot.kind==='rest'){
    const next=slot.nextTrainingYmd?`<p class="cs-card-text cs-card-next">Następny trening: ${csEsc(csDateLabel(slot.nextTrainingYmd))}.</p>`:'';
    const lead=slot.weekComplete?'Plan na ten tydzień wykonany — świetna robota.':'Mięśnie rosną w czasie odpoczynku.';
    return `<section class="cs-card"><div class="cs-eyebrow">DZISIEJSZY PLAN</div><h2 class="cs-card-title">Dziś regeneracja</h2><p class="cs-card-text">${lead} Jeśli masz ochotę, wybierz się na 20–30 minut spaceru albo zrób 10 minut mobilności.</p>${next}<button type="button" class="cs-btn cs-btn-secondary" onclick="${csTrainerAction()}">Napisz do trenera</button></section>`;
  }
  return `<section class="cs-card"><div class="cs-eyebrow">DZISIEJSZY PLAN</div><h2 class="cs-card-title">Plan w przygotowaniu</h2><p class="cs-card-text">Gdy trener przypisze Ci plan, trening pojawi się tutaj.</p><button type="button" class="cs-btn cs-btn-secondary" onclick="${csTrainerAction()}">Napisz do trenera</button></section>`;
}

/** Najbliższe spotkanie z trenerem z kalendarza (dziś albo później). Pomija treningi klienta,
 *  odwołane terminy i dzisiejsze spotkanie, które już się skończyło. */
function csNextMeeting(c){
  if(!c)return null;
  const today=csToday();
  const now=new Date(),nowMin=now.getHours()*60+now.getMinutes();
  const toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(t||''));return m?Number(m[1])*60+Number(m[2]):null;};
  return (window.SE||[]).filter(s=>{
    if(!s||s.clientId!==c.id||s.source==='client'||s.source==='live'||s.archived)return false;
    if(['cancelled','canceled','completed','partial','finished','missed'].includes(String(s.status||'')))return false;
    const d=String(s.date||'').slice(0,10);
    if(!d||d<today)return false;
    if(d===today){const st=toMin(s.time);if(st!=null&&st+(Number(s.duration)||60)<=nowMin)return false;}
    return true;
  }).sort((a,b)=>(String(a.date).slice(0,10)+(a.time||'99:99')).localeCompare(String(b.date).slice(0,10)+(b.time||'99:99')))[0]||null;
}
window.csNextMeeting=csNextMeeting;
/** „Dzisiaj · 18:00”, „Jutro · 7:30”, „Czwartek, 19 listopada · 18:00”. */
function csMeetingWhen(s){
  const d=String(s.date||'').slice(0,10),today=csToday();
  const day=d===today?'Dzisiaj':d===csAddDays(today,1)?'Jutro':csDateLabel(d);
  const t=String(s.time||'').trim();
  return {day,time:/^\d{1,2}:\d{2}/.test(t)?t.slice(0,5).replace(/^0(\d)/,'$1'):''};
}
/** Kafelek „Spotkanie z trenerem”: termin, status i proste działania (potwierdź / poproś o zmianę / napisz).
    Bez ćwiczeń i partii — plan treningu zostaje w zakładce Trening. Odwołane spotkanie zostaje widoczne do jego terminu. */
function csMeetingCardHTML(c){
  const s=csNextMeeting(c)||csCancelledMeeting(c);
  if(!s)return '';
  const w=csMeetingWhen(s);
  const status=typeof commsMeetingActionsHTML==='function'?commsMeetingActionsHTML(s,'status'):'';
  const acts=typeof commsMeetingActionsHTML==='function'?commsMeetingActionsHTML(s,'buttons'):'';
  return `<section class="cs-card cs-meet" aria-labelledby="cs-meet-title">
    <div class="cs-meet-ico" aria-hidden="true">${csIcon('calendar',22)}</div>
    <div class="cs-meet-body"><h2 class="cs-meet-title" id="cs-meet-title">Spotkanie z trenerem</h2>
    <p class="cs-meet-when"><span>${csEsc(w.day)}</span>${w.time?`<span class="cs-meet-sep"> · </span><b>${csEsc(w.time)}</b>`:''}</p>${status}</div>${acts}
  </section>`;
}
/** Najbliższe odwołane spotkanie (dziś lub później), gdy nie ma innego — żeby klient zobaczył odwołanie. */
function csCancelledMeeting(c){
  if(!c)return null;const today=csToday();
  return (window.SE||[]).filter(s=>s&&s.clientId===c.id&&['cancelled','canceled'].includes(String(s.status||''))&&String(s.date||'').slice(0,10)>=today&&!['client','live'].includes(s.source))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0]||null;
}
window.csMeetingCardHTML=csMeetingCardHTML;

function csTodayHTML(c){
  const st=csTodayState(c);
  const {slot,inProgress}=st;
  const first=String(c.name||'').trim().split(/\s+/)[0]||'';
  const sub=inProgress?'Wróć do treningu, gdy będziesz gotowy.':
    slot.kind==='workout'?'Masz dziś zaplanowany trening.':
    slot.kind==='done'?'Dzisiejszy trening masz już za sobą.':
    slot.kind==='rest'?'Dziś bez treningu — czas na regenerację.':'Witaj w aplikacji.';
  return `<div class="cs-screen cs-today">
    <header class="cs-hello"><h1 class="cs-h1">Cześć${first?', '+csEsc(first):''}!</h1><p class="cs-lead">${sub}</p></header>
    ${csTodayCardHTML(c,st)}
    ${csMeetingCardHTML(c)}
    ${csPayCardHTML(c)}
    ${typeof commsFeelLinkHTML==='function'?commsFeelLinkHTML():''}
    ${csWeekBar(c,slot.plan)}
    ${typeof pkcTodayCardHTML==='function'?pkcTodayCardHTML(c):''}
  </div>`;
}
window.csTodayHTML=csTodayHTML;

/** Pakiet, który się skończył (minęła data albo wykorzystano wszystkie treningi), gdy nie ma nowego. */
function csEndedPackage(c){
  if(!c)return null;
  const all=typeof packagesForClient==='function'?packagesForClient(c.id):(window.PACKAGES||[]).filter(p=>p&&p.clientId===c.id);
  if(!all.length)return null;
  const today=csToday();
  const ended=p=>(typeof clientPackageExpired==='function'?clientPackageExpired(p,today):p.status==='expired')||
    (Number(p.sessions)>0&&Number(p.sessionsUsed||0)>=Number(p.sessions));
  if(all.some(p=>!ended(p)))return null;
  return all.slice().sort((a,b)=>String(b.expiresDate||b.createdAt||'').localeCompare(String(a.expiresDate||a.createdAt||'')))[0];
}
window.csEndedPackage=csEndedPackage;
/** Ile treningów zostało w pakiecie: {left,total,used} albo null, gdy pakiet nie ma liczby treningów. */
function csPackageLeft(p){
  const total=Number(p&&p.sessions)||0;
  if(!total)return null;
  const used=Math.min(total,Math.max(0,Number(p.sessionsUsed)||0));
  return {left:total-used,total,used};
}
window.csPackageLeft=csPackageLeft;
/** „Zostało 5 z 8 treningów” + pasek do końca pakietu (wykorzystane = pełne kreski). */
function csPackageLeftHTML(p){
  const n=csPackageLeft(p);
  if(!n)return '';
  const segs=n.total<=20?Array.from({length:n.total},(_,i)=>`<span class="${i<n.left?'is-on':''}"></span>`).join(''):'';
  const bar=segs?`<div class="cs-week-bar cs-pkg-bar" style="grid-template-columns:repeat(${n.total},minmax(0,1fr))" aria-hidden="true">${segs}</div>`:
    `<div class="cs-pkg-meter" aria-hidden="true"><span style="width:${Math.round(n.left/n.total*100)}%"></span></div>`;
  return `<div class="cs-pkg-left" aria-label="Zostało ${n.left} z ${n.total} treningów">
    <div class="cs-week-row"><span>Zostało</span><b>${n.left} z ${n.total} ${csPlural(n.total,'treningu','treningów','treningów')}</b></div>${bar}
  </div>`;
}
/** Karta pakietu na ekranie Dzisiaj: do opłacenia / aktywny (ile zostało do końca) / skończony.
 *  Bez numeru konta — szczegóły płatności klient ustala z trenerem. Przyciski drugorzędne: czerwony zostaje przy treningu. */
function csPayCardHTML(c){
  const unpaid=c&&typeof clientUnpaidPackages==='function'?clientUnpaidPackages(c.id):[];
  if(!unpaid.length){
    const act=c&&typeof clientPaidPackageForSession==='function'?clientPaidPackageForSession(c.id):null;
    if(act&&csPackageLeft(act)){
      const exp=act.expiresDate?String(act.expiresDate).slice(0,10):'';
      return `<section class="cs-card cs-pay is-active" aria-labelledby="cs-pay-title">
    <div class="cs-pay-head">${csIcon('card',22)}<h2 class="cs-card-title" id="cs-pay-title">Twój pakiet</h2></div>
    <p class="cs-pay-what"><b>${csEsc(act.title||'Pakiet treningów')}</b>${exp?` · ważny do ${csEsc(csDateLabel(exp).replace(/^[^,]+, /,''))}`:''}</p>
    ${csPackageLeftHTML(act)}
  </section>`;
    }
    const p=csEndedPackage(c);
    if(!p)return '';
    const used=Number(p.sessions)>0&&Number(p.sessionsUsed||0)>=Number(p.sessions);
    const why=used?'Wszystkie treningi z tego pakietu są już wykorzystane.':(p.expiresDate?'Pakiet był ważny do '+csDateLabel(String(p.expiresDate).slice(0,10))+'.':'Ten pakiet już się skończył.');
    return `<section class="cs-card cs-pay is-ended" aria-labelledby="cs-pay-title">
    <div class="cs-pay-head">${csIcon('card',22)}<h2 class="cs-card-title" id="cs-pay-title">Pakiet do opłacenia</h2></div>
    <p class="cs-pay-what"><b>${csEsc(p.title||'Pakiet treningów')}</b> się skończył.</p>
    <p class="cs-card-text">${csEsc(why)} Napisz do trenera, żeby ustalić kolejny pakiet.</p>
    <div class="cs-pay-btns"><button type="button" class="cs-btn cs-btn-secondary" onclick="setClientLiveScreen('messages')">Napisz do trenera</button></div>
  </section>`;
  }
  const p=unpaid.find(x=>x&&x.paymentRequestedAt)||unpaid[0];
  const seller=typeof paySeller==='function'?(paySeller()||{}):{};
  const price=Number(p.price||0);
  const amount=price?price.toLocaleString('pl')+' '+(seller.currency||'zł'):'';
  const more=unpaid.length>1?`<p class="cs-card-text">Do opłacenia masz ${unpaid.length} pakiety.</p>`:'';
  return `<section class="cs-card cs-pay" aria-labelledby="cs-pay-title">
    <div class="cs-pay-head">${csIcon('card',22)}<h2 class="cs-card-title" id="cs-pay-title">Pakiet do opłacenia</h2></div>
    <p class="cs-pay-what"><b>${csEsc(p.title||'Pakiet treningów')}</b>${amount?` · ${csEsc(amount)}`:''}</p>
    ${csPackageLeftHTML(p)}
    ${more}
    ${typeof clientNotifyPaid==='function'?`<div class="cs-pay-btns"><button type="button" class="cs-btn cs-btn-secondary" onclick="clientNotifyPaid('${csEsc(p.id)}')">Zapłaciłem</button></div>`:''}
  </section>`;
}
window.csPayCardHTML=csPayCardHTML;

/** Pasek „Brak internetu”: klient wie, że wyniki czekają na telefonie i nie są stracone. */
function csSyncOfflineBar(){
  const bar=document.getElementById('clive-offline');if(!bar)return;
  const off=typeof navigator!=='undefined'&&navigator.onLine===false;
  bar.hidden=!off;
  document.body&&document.body.classList.toggle('cs-is-offline',off);
}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('online',csSyncOfflineBar);
  window.addEventListener('offline',csSyncOfflineBar);
  if(typeof document!=='undefined'&&document.readyState!=='loading')csSyncOfflineBar();
  else if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',csSyncOfflineBar);
}
window.csSyncOfflineBar=csSyncOfflineBar;

/** Zakładka „Trening”: gdy jest trening na dziś, przycisk w pasku od razu go otwiera. */
function csTrainEntry(){
  const c=(window.CL||[]).find(x=>x&&x.id===window._clientId)||(window.CL||[])[0];
  if(!c)return false;
  const st=csTodayState(c);
  if(st.inProgress&&st.inProgress.completeLocal)return false;
  if(st.slot.plan&&(st.inProgress||st.slot.kind==='workout')){csStart(st.slot.plan.id,st.slot.dayIdx);return true;}
  return false;
}
window.csTrainEntry=csTrainEntry;
function csTrainScreenHTML(c){
  const st=csTodayState(c);
  return `<div class="cs-screen"><h1 class="cs-h1 cs-h1-page">Trening</h1>${csTodayCardHTML(c,st)}
    ${st.slot.plan?`<button type="button" class="cs-link" onclick="setClientLiveScreen('plan')">Zobacz plan na ten tydzień ${csIcon('chevron',18)}</button>`:''}</div>`;
}
window.csTrainScreenHTML=csTrainScreenHTML;

/* ---------------- Plan ---------------- */
function csPlanRows(c,plan){
  const today=csToday(),mon=csMonday(today);
  const done=csDoneSessions(c);
  const train=typeof planTrainingDayIdxs==='function'?planTrainingDayIdxs(plan):[];
  const slot=typeof capTodaySlot==='function'?capTodaySlot(c):{};
  const startIdx=typeof suggestedPlanDayIdx==='function'?suggestedPlanDayIdx(c.id,plan):(train[0]||0);
  let pos=Math.max(0,train.indexOf(slot.kind==='workout'?slot.dayIdx:startIdx));
  const takeNext=()=>{if(!train.length)return null;const idx=train[pos%train.length];pos++;return idx;};
  const wds=typeof clientPreferredWeekdays==='function'?clientPreferredWeekdays(c):null;
  const rows=[];
  if(wds&&wds.length){
    const dates=new Set();
    for(let i=0;i<7;i++){const d=csAddDays(mon,i);if(wds.includes(csDow(d)))dates.add(d);}
    done.filter(s=>s.date>=mon&&s.date<=csAddDays(mon,6)).forEach(s=>dates.add(s.date));
    const planStart=String(plan.startDate||plan.createdAt||'').slice(0,10);
    [...dates].sort().forEach(d=>{
      const sess=done.filter(s=>s.date===d).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
      const when=d===today?'Dzisiaj':csDateLabel(d);
      if(sess){
        const idx=sess.dayIdx!=null?Number(sess.dayIdx):null;
        const day=idx!=null&&sess.planId===plan.id?plan.days[idx]:null;
        rows.push({date:d,when,status:'done',dayIdx:idx,sessionId:sess.id,title:day?csDayTitle(day,idx).title:(sess.dayName||sess.type||'Trening')});
      }else if(d<today){
        if(planStart&&d<planStart)return;
        rows.push({date:d,when,status:'skipped',dayIdx:null,title:'Trening'});
      }else{
        const idx=d===today&&slot.kind==='workout'?slot.dayIdx:takeNext();
        if(d===today&&slot.kind==='workout')pos=Math.max(0,train.indexOf(idx))+1;
        rows.push({date:d,when,status:'planned',today:d===today,dayIdx:idx,title:idx!=null?csDayTitle(plan.days[idx],idx).title:'Trening'});
      }
    });
    return rows;
  }
  train.forEach(idx=>{
    const sess=done.filter(s=>s.planId===plan.id&&Number(s.dayIdx)===idx&&s.date>=mon&&s.date<=today)[0];
    const isNext=!sess&&slot.kind==='workout'&&slot.dayIdx===idx;
    rows.push({date:null,when:sess?csDateLabel(sess.date):(isNext?'Dzisiaj':'Do zrobienia w tym tygodniu'),status:sess?'done':'planned',today:isNext,dayIdx:idx,sessionId:sess&&sess.id,title:csDayTitle(plan.days[idx],idx).title});
  });
  return rows;
}
const CS_STATUS={done:['wykonany','is-done'],planned:['zaplanowany','is-planned'],skipped:['pominięty','is-skipped']};
function csOpenPlanRow(i){
  const c=(window.CL||[]).find(x=>x&&x.id===window._clientId)||(window.CL||[])[0];
  const plan=c&&typeof capClientPlan==='function'?capClientPlan(c):null;
  const row=plan?csPlanRows(c,plan)[i]:null;
  if(!row)return;
  if(row.status==='done'&&row.sessionId&&typeof clientOpenSession==='function'){clientOpenSession(row.sessionId);return;}
  window._csPlanOpen={planId:plan.id,dayIdx:row.dayIdx,status:row.status,when:row.when,today:!!row.today};
  setClientLiveScreen('plan');
}
function csClosePlanRow(){window._csPlanOpen=null;setClientLiveScreen('plan');}
window.csOpenPlanRow=csOpenPlanRow;window.csClosePlanRow=csClosePlanRow;

function csExerciseMeta(raw){
  const p=typeof parsePlanExercise==='function'?parsePlanExercise(raw):raw||{};
  const unit=typeof exLoadUnit==='function'?exLoadUnit(p):'kg';
  const suf=typeof loadUnitSuffix==='function'?loadUnitSuffix(unit):'kg';
  const parts=[];
  if(p.sets&&p.reps)parts.push(p.sets+' × '+p.reps);
  else if(p.sets)parts.push(p.sets+' serie');
  if(p.kg)parts.push(p.kg+' '+suf);
  return {name:p.name||'Ćwiczenie',meta:parts.join(' · ')};
}
function csPlanDetailHTML(c,plan,open){
  const day=open.dayIdx!=null?(plan.days||[])[open.dayIdx]:null;
  const back=`<button type="button" class="cs-back" onclick="csClosePlanRow()">${csIcon('back',18)}Mój plan</button>`;
  if(!day)return `<div class="cs-screen">${back}<h1 class="cs-h1 cs-h1-page">Trening</h1><p class="cs-lead">Ten trening nie jest już w planie.</p></div>`;
  const t=csDayTitle(day,open.dayIdx);
  const st=CS_STATUS[open.status]||CS_STATUS.planned;
  const rows=(day.exercises||[]).map((raw,i)=>{const e=csExerciseMeta(raw);return `<li class="cs-ex-row"><span class="cs-ex-n">${i+1}</span><span class="cs-li-name">${csEsc(e.name)}</span><span class="cs-ex-meta">${csEsc(e.meta)}</span></li>`;}).join('');
  const start=open.status==='planned'?`<button type="button" class="cs-btn ${open.today?'cs-btn-primary':'cs-btn-secondary'}" onclick="csStart('${csEsc(plan.id)}',${Number(open.dayIdx)})">${open.today?CS_PLAY_ICON+'Rozpocznij trening':'Rozpocznij ten trening'}</button>`:'';
  return `<div class="cs-screen">${back}
    <header class="cs-hello"><h1 class="cs-h1 cs-h1-page">${csEsc(t.title)}</h1><p class="cs-lead">${csEsc(open.when||'')} · ${st[0]} · ok. ${csDurationMin(day)} min</p></header>
    <ol class="cs-list">${rows}</ol>${start}</div>`;
}
function csPlanHTML(c){
  const plan=typeof capClientPlan==='function'?capClientPlan(c):null;
  if(!plan)return `<div class="cs-screen"><h1 class="cs-h1 cs-h1-page">Mój plan</h1><section class="cs-card"><h2 class="cs-card-title">Plan w przygotowaniu</h2><p class="cs-card-text">Gdy trener przypisze Ci plan, zobaczysz tu treningi na ten tydzień.</p><button type="button" class="cs-btn cs-btn-secondary" onclick="${csTrainerAction()}">Napisz do trenera</button></section></div>`;
  const open=window._csPlanOpen;
  if(open&&open.planId===plan.id)return csPlanDetailHTML(c,plan,open);
  const rows=csPlanRows(c,plan);
  const list=rows.map((r,i)=>{
    const st=CS_STATUS[r.status]||CS_STATUS.planned;
    const inner=`<span class="cs-row-main"><span class="cs-row-title">${csEsc(r.title)}</span><span class="cs-row-sub">${csEsc(r.when)}</span></span><span class="cs-pill ${st[1]}">${r.today&&r.status==='planned'?'dzisiaj':st[0]}</span>`;
    return r.status==='skipped'
      ?`<li><div class="cs-row is-static">${inner}<span class="cs-row-chev"></span></div></li>`
      :`<li><button type="button" class="cs-row${r.today?' is-today':''}" onclick="csOpenPlanRow(${i})">${inner}<span class="cs-row-chev">${csIcon('chevron',18)}</span></button></li>`;
  }).join('');
  return `<div class="cs-screen"><h1 class="cs-h1 cs-h1-page">Mój plan</h1>
    <div class="cs-eyebrow">TEN TYDZIEŃ</div>
    <ul class="cs-rows">${list||'<li class="cs-lead">Brak treningów w tym tygodniu.</li>'}</ul>
    <p class="cs-foot">${csEsc(plan.name||'Plan treningowy')}</p></div>`;
}
window.csPlanHTML=csPlanHTML;

/* ---------------- Postępy ---------------- */
function csWeeksInRow(c){
  const dates=new Set(csDoneSessions(c).map(s=>s.date));
  const has=mon=>{for(let i=0;i<7;i++)if(dates.has(csAddDays(mon,i)))return true;return false;};
  let mon=csMonday(csToday()),n=0;
  if(!has(mon))mon=csAddDays(mon,-7);
  while(has(mon)&&n<104){n++;mon=csAddDays(mon,-7);}
  return n;
}
function csMotivation(c,extraToday){
  const plan=typeof capClientPlan==='function'?capClientPlan(c):null;
  const target=csWeekTarget(c,plan);
  const n=csWeekDone(c)+(extraToday?1:0);
  if(n<=0)return 'Nowy tydzień — zacznij od pierwszego treningu. Każdy się liczy.';
  const ord=CS_ORD[n-1];
  if(target&&n>=target)return `Świetnie — to Twój ${ord||n+'.'} trening w tym tygodniu. Plan tygodnia wykonany.`;
  if(extraToday)return `Świetnie — to Twój ${ord||n+'.'} trening w tym tygodniu.`+(target?` Jeszcze ${target-n} i tydzień zamknięty.`:'');
  return `Dobra robota — ${n} ${csPlural(n,'trening','treningi','treningów')} za Tobą w tym tygodniu.`+(target?` Jeszcze ${target-n} i tydzień zamknięty.`:'');
}
window.csMotivation=csMotivation;
function csBodyWeightOn(){const vs=(window.SETTINGS&&window.SETTINGS.clientApp&&window.SETTINGS.clientApp.visibleSections)||{};return vs.bodyWeight===true;}
function csBodyWeight(c){
  const list=(window.METRIC_ENTRIES||[]).filter(e=>e&&e.clientId===c.id&&e.groupId==='mg1'&&e.values&&e.values.m1!=null&&e.values.m1!=='')
    .map(e=>({date:e.date||'',v:parseFloat(String(e.values.m1).replace(',','.'))})).filter(e=>Number.isFinite(e.v)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!list.length)return null;
  const last=list[list.length-1],first=list[0];
  return {value:last.v,delta:list.length>1?Math.round((last.v-first.v)*10)/10:null};
}
function csFmtNum(v){return String(v).replace('.',',');}
function csProgressHTML(c){
  const now=new Date(),monthKey=csToday().slice(0,7);
  const monthN=csDoneSessions(c).filter(s=>String(s.date).slice(0,7)===monthKey).length;
  const weeks=csWeeksInRow(c);
  let weight='';
  if(csBodyWeightOn()){
    const w=csBodyWeight(c);
    weight=w?`<section class="cs-stat"><span class="cs-stat-label">Masa ciała</span><span class="cs-stat-value">${csFmtNum(w.value)} kg</span>${w.delta!=null&&w.delta!==0?`<span class="cs-stat-sub">${w.delta<0?'−':'+'}${csFmtNum(Math.abs(w.delta))} kg od pierwszego pomiaru</span>`:''}</section>`
      :`<section class="cs-stat"><span class="cs-stat-label">Masa ciała</span><span class="cs-stat-value">—</span><span class="cs-stat-sub">Trener doda pomiar na treningu.</span></section>`;
  }
  return `<div class="cs-screen"><h1 class="cs-h1 cs-h1-page">Postępy</h1>
    <p class="cs-motivation">${csEsc(csMotivation(c))}</p>
    <section class="cs-stat"><span class="cs-stat-label">Treningi w ${CS_MONTHS_LOC[now.getMonth()]}</span><span class="cs-stat-value">${monthN}</span></section>
    <section class="cs-stat"><span class="cs-stat-label">Regularność</span><span class="cs-stat-value">${weeks} ${csPlural(weeks,'tydzień','tygodnie','tygodni')}</span><span class="cs-stat-sub">${weeks?'z rzędu z co najmniej jednym treningiem':'Pierwszy trening zaczyna serię.'}</span></section>
    ${weight}
    <button type="button" class="cs-link" onclick="csProgressFull(true)">Więcej statystyk ${csIcon('chevron',18)}</button></div>`;
}
function csProgressFull(on){window._csProgressFull=!!on;setClientLiveScreen('progress');}
window.csProgressHTML=csProgressHTML;window.csProgressFull=csProgressFull;

/* ---------------- Kontakt ---------------- */
function csWebsiteHref(url){const u=String(url||'').trim();if(!u)return '';return /^https?:\/\//i.test(u)?u:'https://'+u;}
function csContactHTML(c){
  const S=window.SETTINGS||{};
  const k=S.contact||{};
  const name=k.name||(S.company&&S.company.name)||(S.profile&&S.profile.name)||'Twój trener';
  const phone=String(k.phone||'').trim();
  const tel=phone.replace(/[^\d+]/g,'');
  const address=String(k.address||'').trim();
  const web=csWebsiteHref(k.website);
  const chat=csChatVisible();
  const write=chat?`<button type="button" class="cs-btn cs-btn-primary" onclick="setClientLiveScreen('messages')">${csIcon('chat',20)}Napisz do trenera</button>`
    :(tel?`<a class="cs-btn cs-btn-primary" href="tel:${csEsc(tel)}">${csIcon('contact',20)}Zadzwoń do trenera</a>`:'');
  const book=chat?`<button type="button" class="cs-btn cs-btn-secondary" onclick="csBookTraining()">${csIcon('calendar',20)}Umów trening</button>`
    :(tel?`<a class="cs-btn cs-btn-secondary" href="tel:${csEsc(tel)}">${csIcon('calendar',20)}Umów trening</a>`:'');
  const row=(label,val)=>`<div class="cs-kv"><span>${label}</span>${val}</div>`;
  return `<div class="cs-screen"><h1 class="cs-h1 cs-h1-page">Kontakt</h1>
    <div class="cs-stack">${write}${book}</div>
    <section class="cs-card cs-card-flat"><h2 class="cs-card-title cs-card-title-sm">${csEsc(name)}</h2>
      ${address?row('Adres',`<b>${csEsc(address)}</b>`):''}
      ${phone?row('Telefon',`<a href="tel:${csEsc(tel)}">${csEsc(phone)}</a>`):''}
      ${web?row('Strona',`<a href="${csEsc(web)}" target="_blank" rel="noopener noreferrer">${csEsc(String(k.website).replace(/^https?:\/\//i,'').replace(/\/$/,''))}</a>`):''}
      ${!address&&!phone&&!web?'<p class="cs-card-text">Trener nie dodał jeszcze danych kontaktowych.</p>':''}
    </section>
    ${address?`<a class="cs-link" href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer">${csIcon('pin',18)}Mapa i dojazd</a>`:''}
  </div>`;
}
function csBookTraining(){
  setClientLiveScreen('messages');
  setTimeout(()=>{const el=document.getElementById('clive-chat-input');if(el&&!el.value){el.value='Cześć! Chcę umówić trening. Pasuje mi: ';el.focus();}},60);
}
window.csContactHTML=csContactHTML;window.csBookTraining=csBookTraining;

/* ---------------- Trening: jedno ćwiczenie ---------------- */
function csShortTip(text){
  const t=String(text||'').replace(/\s+/g,' ').trim();
  if(!t)return '';
  const m=t.match(/^(.{20,160}?[.!?])(\s|$)/);
  if(m)return m[1];
  return t.length>160?t.slice(0,157).replace(/\s+\S*$/,'')+'…':t;
}
/* Ekran ćwiczenia (iPhone): stały nagłówek „‹ Wróć do treningu” + „…”, przewijana treść, stały dół z jednym CTA
 * „Zapisz serię X z Y” i przyciskami „← Poprzednie / Następne →”. Swipe tylko jako skrót w pustej części ekranu.
 * Wszystkie akcje działają bez swipe; wpisane wartości zostają w stanie treningu (i w szkicu na telefonie). */
const CW_UNDO_MS=7000;
function csSetsLeft(ex){if(!ex||ex.skipped)return 0;return (ex.sets||[]).filter(x=>x&&!x.done).length;}
function csLeftText(n){return (n===1?'Została':(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?'Zostały':'Zostało')+' '+n+' '+csPlural(n,'seria','serie','serii');}
function cwSetDirty(st){
  if(!st||st.done||!st._orig)return false;
  return ['reps','kg','rir'].some(k=>String(st[k]==null?'':st[k])!==String(st._orig[k]==null?'':st._orig[k]));
}
function cwDirtySets(cw){
  const out=[];
  ((cw&&cw.exercises)||[]).forEach((ex,ei)=>(ex.sets||[]).forEach((st,si)=>{if(cwSetDirty(st))out.push({ei,si,st});}));
  return out;
}
function cwStarted(cw){return !!(cw&&(cw.began||cw.elapsed>0||(typeof cwConfirmedSets==='function'&&cwConfirmedSets(cw)>0)));}
function cwOpenSheet(kind,extra){const cw=window._cw;if(!cw)return;cw.sheet=Object.assign({kind},extra||{});cwRender();
  setTimeout(()=>{const b=document.querySelector('.cs-sheet [data-cs-sheet-first]');if(b&&b.focus)try{b.focus();}catch(e){}},30);}
function cwSheetClose(){const cw=window._cw;if(!cw)return;cw.sheet=null;cwRender();}
/** Następne/poprzednie: zawsze bez swipe; przed wyjściem z niedokończonego ćwiczenia — pytanie. */
function cwNav(dir){
  const cw=window._cw;if(!cw)return;
  const ex=cw.exercises[cw.exIdx];
  if(dir<0){if(cw.exIdx>0)cwNavGo(-1);return;}
  const left=csSetsLeft(ex);
  if(left>0){cwOpenSheet('next',{left});return;}
  cwNavGo(1);
}
function cwNavGo(dir){
  const cw=window._cw;if(!cw)return;
  cw.sheet=null;cw.showTips=false;
  if(dir<0){if(typeof cwPrevEx==='function')cwPrevEx();return;}
  cwNextEx();
}
function cwNextEx(){
  const cw=window._cw;if(!cw)return;
  cw.showTips=false;cw.sheet=null;
  const ex=cw.exercises[cw.exIdx];
  // Super-seria ukończona w całości: dalej za grupą (nie do partnera, który też jest zrobiony).
  const grp=typeof ssGroupIdxs==='function'?ssGroupIdxs(cw.exercises,cw.exIdx):[];
  let next=cw.exIdx+1;
  if(grp.length>=2&&grp.every(i=>csSetsLeft(cw.exercises[i])===0)&&csSetsLeft(ex)===0&&typeof ssAdvanceIdx==='function')next=ssAdvanceIdx(cw.exercises,cw.exIdx);
  if(next>=0&&next<cw.exercises.length){if(typeof cwGoEx==='function')cwGoEx(next);return;}
  cw.phase='finish';
  if(typeof cwIncompleteSets==='function'&&cwIncompleteSets(cw)>0)cw.finishPrompt=true;
  if(typeof cwRender==='function')cwRender();
}
function cwToggleTips(){const cw=window._cw;if(!cw)return;cw.showTips=!cw.showTips;if(typeof cwRender==='function')cwRender();}
/** „‹ Wróć do treningu”: lista ćwiczeń treningu. Niezapisane wpisy → dolny panel z trzema wyborami. */
function cwBack(){
  const cw=window._cw;if(!cw)return;
  if(cwDirtySets(cw).length){cwOpenSheet('exit',{target:'overview'});return;}
  cwToOverview();
}
function cwToOverview(){
  const cw=window._cw;if(!cw)return;
  cw.sheet=null;cw.showTips=false;cw.showVideo=false;
  if(window._cwRestTimer){clearInterval(window._cwRestTimer);window._cwRestTimer=null;}
  cw.phase='overview';
  if(typeof cwWriteLocal==='function')cwWriteLocal(cw);
  cwRender();
}
function cwExitTarget(target){
  const cw=window._cw;if(!cw)return;
  cw.sheet=null;
  if(target==='close'){if(typeof cwClose==='function')cwClose(true);return;}
  cwToOverview();
}
/** „Zapisz i wyjdź”: wpisane serie (z liczbą powtórzeń) zapisują się jako wykonane, bez przerwy. */
function cwExitSave(){
  const cw=window._cw;if(!cw)return;
  const target=(cw.sheet&&cw.sheet.target)||'overview';
  let saved=0;
  cwDirtySets(cw).forEach(({st})=>{
    if(Number.parseFloat(String(st.reps||'').replace(',','.'))>0){st.done=true;saved++;}
  });
  if(saved&&typeof cwQueuePersist==='function')cwQueuePersist(cw,'in_progress');
  else if(typeof cwWriteLocal==='function')cwWriteLocal(cw);
  if(typeof notify==='function')notify(saved?('Zapisano '+saved+' '+csPlural(saved,'serię','serie','serii')):'Brak serii do zapisania');
  cwExitTarget(target);
}
/** „Wyjdź bez zapisu”: wpisane, niezapisane wartości wracają do planu. */
function cwExitDiscard(){
  const cw=window._cw;if(!cw)return;
  const target=(cw.sheet&&cw.sheet.target)||'overview';
  cwDirtySets(cw).forEach(({st})=>{['reps','kg','rir'].forEach(k=>{st[k]=st._orig[k];});delete st.rirUnknown;delete st.rirReported;});
  if(typeof cwWriteLocal==='function')cwWriteLocal(cw);
  cwExitTarget(target);
}
function cwMenu(){cwOpenSheet('menu');}
function cwEndWorkout(){
  const cw=window._cw;if(!cw)return;
  cw.sheet=null;cw.phase='finish';
  cw.finishPrompt=typeof cwIncompleteSets==='function'&&cwIncompleteSets(cw)>0;
  if(typeof cwWriteLocal==='function')cwWriteLocal(cw);
  cwRender();
}
const CS_SKIP_REASONS=['Brak czasu','Ból','Sprzęt zajęty','Inne'];
function cwSkipAsk(){cwOpenSheet('skip');}
function cwSkipPick(i){
  const cw=window._cw;if(!cw)return;
  const r=CS_SKIP_REASONS[i];if(!r)return;
  if(r==='Inne'){cw.sheet={kind:'skip',other:true};cwRender();setTimeout(()=>{const t=document.getElementById('cs-skip-other');if(t)t.focus();},30);return;}
  cw.sheet=null;
  if(typeof cwSkipEx==='function')cwSkipEx(r);
}
function cwSkipOther(){
  const cw=window._cw;if(!cw)return;
  const t=document.getElementById('cs-skip-other');
  const txt=String(t&&t.value||'').trim();
  cw.sheet=null;
  if(typeof cwSkipEx==='function')cwSkipEx(txt?'Inne: '+txt:'Inne');
}
/** Ocena zapasu (opcjonalna): ponowne dotknięcie tej samej odpowiedzi ją odznacza. Cel z planu zostaje w danych bez zmian. */
function cwSetRir(setIdx,val){
  const cw=window._cw;if(!cw)return;
  const st=(cw.exercises[cw.exIdx]||{}).sets?.[setIdx];if(!st)return;
  if(st.rirReported&&String(st.rir)===String(val)){
    if(typeof cwPatchSet==='function')cwPatchSet(setIdx,'rir',st._orig?st._orig.rir:'');
    st.rirReported=false;
  }else{
    if(typeof cwPatchSet==='function')cwPatchSet(setIdx,'rir',val);
    st.rirReported=true;
  }
  if(cw.setError&&cw.setError.field==='rir'){cw.setError=null;const e=document.getElementById('cs-set-err');if(e)e.remove();}
  const cur=st.rirReported?String(st.rir):'';
  document.querySelectorAll('.cs-rir-opts [data-rir]').forEach(b=>{const on=b.dataset.rir===cur;b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',on?'true':'false');});
}
/** „Cofnij” po zapisie serii (7 s): seria znowu do zrobienia, przerwa anulowana. */
function cwUndoLastSet(){
  const cw=window._cw;if(!cw||!cw.lastSaved)return;
  const ls=cw.lastSaved;
  const st=((cw.exercises[ls.exIdx]||{}).sets||[])[ls.setIdx];
  cw.lastSaved=null;
  cw._tapLockUntil=0;
  if(!st||!st.done)return;
  st.done=false;
  if(window._cwRestTimer){clearInterval(window._cwRestTimer);window._cwRestTimer=null;}
  cw.exIdx=ls.exIdx;cw.phase='exercise';cw.restLeft=0;
  if(typeof cwQueuePersist==='function')cwQueuePersist(cw,'in_progress');
  if(typeof notify==='function')notify('Cofnięto zapis serii');
  cwRender();
}
function cwSavedBannerHTML(cw){
  const ls=cw&&cw.lastSaved;
  if(!ls||Date.now()-ls.at>CW_UNDO_MS)return '';
  return `<div class="cs-saved" role="status" aria-live="polite" data-cs-saved="${ls.at}"><span>${csEsc(ls.label)} ${csIcon('check',18)}</span><button type="button" class="cs-saved-undo" onclick="cwUndoLastSet()">Cofnij</button></div>`;
}
function cwScheduleSavedHide(cw){
  const ls=cw&&cw.lastSaved;if(!ls)return;
  clearTimeout(window._cwSavedTimer);
  const left=CW_UNDO_MS-(Date.now()-ls.at);
  window._cwSavedTimer=setTimeout(()=>{
    const c=window._cw;if(!c||!c.lastSaved||c.lastSaved.at!==ls.at)return;
    c.lastSaved=null;
    document.querySelectorAll('[data-cs-saved]').forEach(n=>n.remove());
  },Math.max(0,left));
}
window.cwNextEx=cwNextEx;window.cwToggleTips=cwToggleTips;window.cwNav=cwNav;window.cwNavGo=cwNavGo;window.cwBack=cwBack;
window.cwToOverview=cwToOverview;window.cwExitSave=cwExitSave;window.cwExitDiscard=cwExitDiscard;window.cwMenu=cwMenu;
window.cwEndWorkout=cwEndWorkout;window.cwSkipAsk=cwSkipAsk;window.cwSkipPick=cwSkipPick;window.cwSkipOther=cwSkipOther;
window.cwSetRir=cwSetRir;window.cwUndoLastSet=cwUndoLastSet;window.cwSheetClose=cwSheetClose;window.cwOpenSheet=cwOpenSheet;
window.cwSavedBannerHTML=cwSavedBannerHTML;window.cwScheduleSavedHide=cwScheduleSavedHide;window.cwDirtySets=cwDirtySets;window.cwStarted=cwStarted;

/** Dolny panel (×/tło zamyka tylko panel; nic nie znika z danych). */
function csSheetHTML(cw){
  const sh=cw&&cw.sheet;if(!sh)return '';
  const ex=cw.exercises[cw.exIdx]||{};
  let title='',body='';
  if(sh.kind==='exit'){
    const n=cwDirtySets(cw).length;
    title='Masz niezapisane dane';
    body=`<p class="cs-sheet-text">${n===1?'Wpisana seria nie jest jeszcze zapisana.':'Wpisane serie ('+n+') nie są jeszcze zapisane.'}</p>
      <button type="button" class="cs-btn cs-btn-primary" data-cs-sheet-first onclick="cwExitSave()">Zapisz i wyjdź</button>
      <button type="button" class="cs-btn cs-btn-secondary" onclick="cwSheetClose()">Kontynuuj trening</button>
      <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwExitDiscard()">Wyjdź bez zapisu</button>`;
  }else if(sh.kind==='next'){
    const left=sh.left||csSetsLeft(ex);
    const last=cw.exIdx>=cw.exercises.length-1;
    title=csLeftText(left)+'.';
    body=`<p class="cs-sheet-text">${last?'To ostatnie ćwiczenie. Zakończyć trening?':'Przejść do następnego ćwiczenia?'}</p>
      <button type="button" class="cs-btn cs-btn-primary" data-cs-sheet-first onclick="cwSheetClose()">Wróć do serii</button>
      <button type="button" class="cs-btn cs-btn-secondary" onclick="cwNavGo(1)">${last?'Zakończ trening':'Przejdź do następnego ćwiczenia'}</button>`;
  }else if(sh.kind==='menu'){
    title='Trening';
    const inEx=cw.phase==='exercise';
    const exDone=!ex.skipped&&(ex.sets||[]).length&&(ex.sets||[]).every(x=>x.done);
    body=`${inEx&&cw.exIdx>0?`<button type="button" class="cs-btn cs-btn-ghost" data-cs-sheet-first onclick="cwNavGo(-1)">← Poprzednie ćwiczenie</button>`:''}
      ${inEx&&(ex.alts||[]).length?`<button type="button" class="cs-btn cs-btn-ghost"${cw.exIdx>0?'':' data-cs-sheet-first'} onclick="cwOpenSheet('swap')">Zamień ćwiczenie</button>`:''}
      ${inEx&&!exDone&&!ex.skipped?`<button type="button" class="cs-btn cs-btn-ghost" data-cs-skip onclick="cwSkipAsk()">Pomiń ćwiczenie…</button>`:''}
      <button type="button" class="cs-btn cs-btn-ghost" onclick="cwSheetClose();cwToOverview()">Lista ćwiczeń</button>
      <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwSheetClose();cwReportProblem()">Zgłoś ból lub problem</button>
      <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwEndWorkout()">Zakończ trening</button>`;
  }else if(sh.kind==='swap'){
    title='Zamień ćwiczenie';
    body=`<p class="cs-sheet-text">Warianty, które trener zatwierdził dla tego ćwiczenia. Serie i ciężar dopasujemy do wybranego.</p>
      ${(ex.alts||[]).slice(0,3).map((a,i)=>`<button type="button" class="cs-btn cs-btn-ghost cs-swap-opt"${i===0?' data-cs-sheet-first':''} onclick='cwSheetClose();cwSwapEx(${JSON.stringify(a).replace(/'/g,'&#39;')})'>↻ ${csEsc(a)}</button>`).join('')}`;
  }else if(sh.kind==='tech'){
    title='Technika';
    const note=csNoteInfo(ex);
    const decoImg=ex.img&&typeof isDecorativeExAsset==='function'&&isDecorativeExAsset(ex.img);
    const hasMedia=!!(ex.video||ex.videoEmbed||ex.gif||(ex.img&&!decoImg));
    const mm=typeof csMuscleMapBlock==='function'?csMuscleMapBlock(ex,hasMedia,note):'';
    const h=typeof exerciseCoachHints==='function'?exerciseCoachHints(ex):{};
    const unit=typeof exLoadUnit==='function'?exLoadUnit(ex):'kg';
    const hasRir=ex.rir!=null&&String(ex.rir)!=='';
    const methods=typeof exerciseIntensificationMethods==='function'?exerciseIntensificationMethods(ex):[];
    const facts=[
      ex.tempo?['Tempo',csTempoText(ex.tempo)]:null,
      h.restLabel?['Przerwa',h.restLabel]:null,
      unit==='sec'&&h.workLabel?['Czas pracy',h.workLabel]:null,
      hasRir?['Zapas',csRirFriendly(ex.rir)]:(h.rpe?['Wysiłek',csNum(h.rpe)+' na 10']:null)
    ].filter(Boolean);
    body=`<div class="cs-tech">
      ${csShortName(ex.name)!==ex.name?`<p class="cs-tech-full">${csEsc(ex.name)}</p>`:''}
      ${hasMedia&&typeof coachMediaHtml==='function'?`<div class="cs-media">${coachMediaHtml(ex,{showVideo:true,caption:false,showNote:false})}</div>`:''}
      ${mm}
      ${note.body&&!(mm&&/class="mm-how"/.test(mm)&&csMmTipSame(ex,note.body))?`<p class="cs-tech-note">${csEsc(note.body.replace(/^./,c=>c.toUpperCase()))}</p>`:''}
      ${!hasMedia&&!mm&&!note.full?'<p class="cw-media-missing" role="note">Brak materiału instruktażowego. Jeśli nie znasz tego ćwiczenia, poproś trenera o wskazówkę przed rozpoczęciem.</p>':''}
      ${facts.length?`<dl class="cs-tech-facts">${facts.map(([k,v])=>`<dt>${csEsc(k)}</dt><dd>${csEsc(v)}</dd>`).join('')}</dl>`:''}
      ${methods.map(m=>{const def=(window.INTENSIFICATION_METHODS||{})[m.type]||{};const info=typeof intensificationInstruction==='function'?intensificationInstruction(m,ex):m.protocol;return `<div class="cs-method"><b>${csEsc(def.label||m.type)} · ${csEsc(def.when||'Wykonanie')}</b><span>${csEsc(info)}</span></div>`;}).join('')}
      ${note.priority?`<p class="cs-tip-line">Priorytet w planie: ${csEsc(note.priority)}</p>`:''}
      ${ex.plannedName&&ex.plannedName!==ex.name?`<p class="cs-tip-line">Z planu: ${csEsc(ex.plannedName)}</p>`:''}
      ${ex.kgHint?`<p class="cs-tip-line">${csEsc(ex.kgHint)}</p>`:''}
      ${ex.progHint?`<p class="cs-tip-line">${csEsc(ex.progHint)}</p>`:''}
      ${typeof isEmomExercise==='function'&&isEmomExercise(ex)?'<p class="cs-tip-line">EMOM: zrób serię i odpocznij do końca minuty.</p>':''}
    </div>
    <button type="button" class="cs-btn cs-btn-secondary" data-cs-sheet-first onclick="cwSheetClose()">Wróć do serii</button>`;
  }else if(sh.kind==='skip'){
    title='Dlaczego pomijasz?';
    body=sh.other?`<label class="cs-sheet-field"><span>Krótko dla trenera (opcjonalnie)</span><input type="text" id="cs-skip-other" maxlength="120" enterkeyhint="done" onkeydown="if(event.key==='Enter')cwSkipOther()"></label>
      <button type="button" class="cs-btn cs-btn-primary" onclick="cwSkipOther()">Pomiń ćwiczenie</button>`
      :`<div class="cs-sheet-grid">${CS_SKIP_REASONS.map((r,i)=>`<button type="button" class="cs-btn cs-btn-ghost"${i===0?' data-cs-sheet-first':''} onclick="cwSkipPick(${i})">${csEsc(r)}</button>`).join('')}</div>`;
  }else return '';
  return `<div class="cs-sheet-wrap" data-cs-sheet="${csEsc(sh.kind)}">
    <div class="cs-sheet-backdrop" onclick="cwSheetClose()"></div>
    <section class="cs-sheet" role="dialog" aria-modal="true" aria-labelledby="cs-sheet-title">
      <div class="cs-sheet-head"><h2 id="cs-sheet-title">${csEsc(title)}</h2>${sh.kind==='exit'||sh.kind==='next'?'':`<button type="button" class="cs-sheet-x" aria-label="Zamknij" onclick="cwSheetClose()">${csIcon('close',20)}</button>`}</div>
      ${body}
    </section>
  </div>`;
}
window.csSheetHTML=csSheetHTML;

/** Lista ćwiczeń rozpoczętego treningu („‹ Wróć do treningu”). */
function csOverviewHTML(cw){
  const cur=Math.min(cw.exIdx||0,cw.exercises.length-1);
  const rows=cw.exercises.map((ex,i)=>{
    const sets=ex.sets||[];const d=sets.filter(x=>x.done).length;
    const st=ex.skipped?'pominięte':d>=sets.length&&sets.length?'zrobione':d?(d+' z '+sets.length+' serii'):(sets.length+' '+csPlural(sets.length,'seria','serie','serii'));
    const cls=ex.skipped?'is-skipped':d>=sets.length&&sets.length?'is-done':i===cur?'is-now':'';
    return `<button type="button" class="cs-ov-row ${cls}" onclick="cwGoEx(${i})"><span class="cs-ex-n">${d>=sets.length&&sets.length&&!ex.skipped?csIcon('check',16):i+1}</span><span class="cs-ov-name">${csEsc(ex.name)}</span><span class="cs-ov-st">${csEsc(st)}</span></button>`;
  }).join('');
  return `<div class="cs-ex cs-ov">
    <div class="cs-ex-top">
      <button type="button" class="cs-back-btn" onclick="cwClose()">${csIcon('back',20)}<span>Wyjdź</span></button>
      <span id="cw-clock" class="cs-ex-clock" role="timer" aria-label="Czas treningu">${typeof cwFmt==='function'?cwFmt(cw.elapsed):''}</span>
      <button type="button" class="cs-more-btn" aria-label="Więcej opcji treningu" onclick="cwMenu()">${csIcon('more',22)}</button>
    </div>
    <div class="cs-ex-scroll">
      <div class="cs-eyebrow">TWÓJ TRENING</div>
      <h2 class="cs-ex-name">${csEsc(cw.dayName||'Trening')}</h2>
      <div class="cw-sync-state ${cw.syncState==='local'?'is-local':''}${cw.syncState==='error'?' is-error':''}" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>
      <div class="cs-ov-list">${rows}</div>
    </div>
    <div class="cs-ex-foot">
      <button type="button" class="cs-btn cs-btn-primary" onclick="cwGoEx(${cur})">Kontynuuj: ćwiczenie ${cur+1} z ${cw.exercises.length}</button>
    </div>
  </div>`;
}
window.csOverviewHTML=csOverviewHTML;

/** Swipe: opcjonalny skrót. Tylko w pustej części ekranu, nie na polach ani przyciskach, nie przy pionowym przewijaniu. */
function cwBindSwipe(root){
  const area=root&&root.querySelector('.cs-ex-scroll[data-cs-swipe]');
  if(!area||area._csSwipe)return;
  area._csSwipe=true;
  let st=null;
  const hint=()=>root.querySelector('.cs-swipe-hint');
  const blocked=t=>!!(t&&t.closest&&t.closest('input,textarea,select,button,a,label,video,iframe,.cs-set,.cs-media,.cs-tips,[contenteditable="true"]'));
  area.addEventListener('touchstart',e=>{
    const a=document.activeElement;
    if(e.touches.length!==1||blocked(e.target)||(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))){st=null;return;}
    st={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now(),lock:null,dx:0};
  },{passive:true});
  area.addEventListener('touchmove',e=>{
    if(!st)return;
    const dx=e.touches[0].clientX-st.x,dy=e.touches[0].clientY-st.y;
    if(!st.lock){if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx))st.lock='v';else if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.6)st.lock='h';}
    if(st.lock!=='h'){const h=hint();if(h)h.classList.remove('is-on');return;}
    st.dx=dx;
    const cw=window._cw;const tgt=cw&&cw.exercises[cw.exIdx+(dx<0?1:-1)];
    const h=hint();
    if(h){
      if(!tgt&&dx>0){h.classList.remove('is-on');return;}
      h.textContent=dx<0?(tgt?'Następne: '+tgt.name+' →':'Zakończ trening →'):'← Poprzednie: '+tgt.name;
      h.classList.toggle('is-left',dx>0);
      h.classList.toggle('is-on',Math.abs(dx)>40);
    }
  },{passive:true});
  const end=()=>{
    const s0=st;st=null;
    const h=hint();if(h)h.classList.remove('is-on');
    if(!s0||s0.lock!=='h'||Math.abs(s0.dx)<80||Date.now()-s0.t>900)return;
    cwNav(s0.dx<0?1:-1);
  };
  area.addEventListener('touchend',end,{passive:true});
  area.addEventListener('touchcancel',()=>{st=null;const h=hint();if(h)h.classList.remove('is-on');},{passive:true});
}
window.cwBindSwipe=cwBindSwipe;

/** „2-3” → „powtórzenia”, „1” → „powtórzenie”, „5” → „powtórzeń”. */
function csRepWord(v){
  const n=Math.max(...String(v||'').split(/[^0-9]+/).filter(Boolean).map(Number).concat(0));
  if(n===1)return 'powtórzenie';
  const x=n%100,y=n%10;
  return y>=2&&y<=4&&(x<10||x>=20)?'powtórzenia':'powtórzeń';
}
/** Liczba po polsku: 17.5 → „17,5”. */
function csNum(v){return String(v==null?'':v).trim().replace(/(\d)\.(\d)/g,'$1,$2');}
/** Krótka nazwa na główny ekran: bez dopisku w nawiasie i po myślniku („Unoszenie bokiem na maszynie”). */
function csShortName(name){
  const full=String(name||'').trim();
  const short=full.replace(/\s*\([^)]*\)\s*$/,'').split(/\s+[—–]\s+/)[0].trim();
  return short.length>=3?short:full;
}
/** Zakres powtórzeń z planu („10-12” → „10–12”). */
function csRange(v){return csNum(String(v==null?'':v).trim().replace(/\s*-\s*/,'–'));}
/** Cel zapasu (RIR z planu) prostym językiem. 2.5 → „około 2–3 powtórzeń w zapasie”. Wartość w danych bez zmian. */
function csRirFriendly(v){
  const raw=String(v==null?'':v).replace(/^\s*RIR\s*/i,'').trim();
  if(!raw)return '';
  const range=raw.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
  if(range)return csNum(range[1])+'–'+csNum(range[2])+' '+csRepWord(range[2])+' w zapasie';
  const n=Number.parseFloat(raw.replace(',','.'));
  if(!Number.isFinite(n))return raw+' w zapasie';
  if(n<=0)return 'seria do końca (0 w zapasie)';
  if(!Number.isInteger(n)){const lo=Math.floor(n),hi=Math.ceil(n);return 'około '+lo+'–'+hi+' powtórzeń w zapasie';}
  return n+' '+csRepWord(String(n))+' w zapasie';
}
/** Ocena zapasu po serii: pojedyncze liczby, więc cel „2–3” zawsze ma pasującą odpowiedź. */
const CS_RIR_OPTS=[['0','0'],['1','1'],['2','2'],['3','3'],['4+','4+']];
/** Notatka trenera: ważna (na ekranie serii) albo zwykła (w „Technice”). „WAŻNE:” lub „!” na początku = ważna. */
function csNoteInfo(ex){
  const full=typeof exerciseTodoNote==='function'?exerciseTodoNote(ex):String((ex&&(ex.note||ex.libTip))||'').trim();
  const m=full.match(/^\s*(?:!+|WAŻNE\s*:)\s*/i);
  const key=!!(ex&&ex.noteKey)||!!m;
  const text=m?full.slice(m[0].length).trim():full;
  // „PRIORYTET: boczny bark — uzasadnienie” → priorytet i uzasadnienie osobno (tylko w szczegółach).
  const pr=text.match(/^\s*PRIORYTET\s*:?\s*([^—–\-.]{1,48}?)\s*[—–-]\s*([\s\S]*)$/i);
  return{full:text,key,priority:pr?pr[1].trim():'',body:pr?pr[2].trim():text};
}
/** Tempo prostym językiem: „3-0-1-0” → opuszczanie 3 s, pauza 0 s, podnoszenie 1 s, pauza 0 s. */
function csTempoText(t){
  const p=String(t||'').trim().replace(/!$/,'').split(/[-–:/\s]+/).filter(Boolean);
  if(p.length!==4)return String(t||'').replace(/!$/,'');
  return 'opuszczanie '+p[0]+' s · pauza '+p[1]+' s · podnoszenie '+p[2]+' s · pauza '+p[3]+' s';
}
function csTempoKey(ex){return !!(ex&&(ex.tempoKey||/!\s*$/.test(String(ex.tempo||''))));}

/** Mapa mięśni w „Technice”: bez filmu/obrazu w miejscu mediów, z filmem zwinięta pod nim.
    „Jak wykonać” = pole tip z biblioteki (notatka trenera o tej samej treści nie powtarza się pod spodem). */
function csMuscleMapBlock(ex,hasMedia,note){
  if(typeof muscleMapData!=='function'||typeof muscleMapHTML!=='function')return '';
  const lib=typeof libExerciseByName==='function'?libExerciseByName(ex&&ex.name):null;
  const d=muscleMapData(lib&&lib.muscle?lib:{name:ex&&ex.name,muscle:ex&&ex.muscle,tip:ex&&(ex.libTip||ex.tip)});
  if(!d)return '';
  const tip=d.tip?`<div class="mm-how"><h4 class="mm-how-h">Jak wykonać</h4><p>${csEsc(d.tip)}</p></div>`:'';
  const map=muscleMapHTML(d.primary,d.secondary);
  if(!hasMedia)return `<div class="cs-mm" data-cs-mm>${map}${tip}</div>`;
  return `<details class="cs-mm-more" data-cs-mm-more><summary>Które mięśnie pracują<span class="cs-chev">${csIcon('down',18)}</span></summary>${map}${tip}</details>`;
}
window.csMuscleMapBlock=csMuscleMapBlock;
function csMmTipSame(ex,body){
  const lib=typeof libExerciseByName==='function'?libExerciseByName(ex&&ex.name):null;
  const tip=String((lib&&lib.tip)||(ex&&(ex.libTip||ex.tip))||'').trim();
  return !!tip&&String(body||'').trim()===tip;
}
function cwSimpleExerciseHTML(cw,ex){
  const n=cw.exercises.length,idx=cw.exIdx;
  const sets=ex.sets||[];
  const cur=sets.findIndex(s=>!s.done);
  const doneN=sets.filter(s=>s.done).length;
  const allDone=cur<0||!!ex.skipped;
  const isLast=idx===n-1;
  const unit=typeof exLoadUnit==='function'?exLoadUnit(ex):'kg';
  const loadLbl=typeof loadUnitShortLabel==='function'?loadUnitShortLabel(unit):'kg';
  const weightUnit=typeof isWeightLoadUnit!=='function'||isWeightLoadUnit(unit);
  const timed=unit==='sec';
  const s=allDone?sets[sets.length-1]||{}:sets[cur];
  const setNo=s&&s.setNo!=null?s.setNo:(cur+1);
  const kindTag=s&&s.kind&&s.kind!=='work'?((typeof setKindBadge==='function'&&setKindBadge(s.kind))||s.kind):'';
  const note=csNoteInfo(ex);
  const shortName=csShortName(ex.name);
  const segs=cw.exercises.map((_,i)=>`<span class="${i<idx?'is-past':i===idx?'is-now':''}"></span>`).join('');
  const dots=sets.map((x,i)=>`<span class="${x.done?'is-done':i===cur?'is-now':''}"></span>`).join('');
  const others=(()=>{const g=typeof ssGroupIdxs==='function'?ssGroupIdxs(cw.exercises,idx):[];return g.filter(i=>i!==idx).map(i=>cw.exercises[i]).filter(Boolean);})();
  const methods=typeof exerciseIntensificationMethods==='function'?exerciseIntensificationMethods(ex):[];
  const hasRir=ex.rir!=null&&String(ex.rir)!=='';
  const showRir=!allDone&&(hasRir||!!ex.rirRequired);
  const plan=(s&&s._orig)||s||{};
  const unitWord=timed?'s':s&&s.kind==='amrap'?'powtórzeń (max)':'powt.';
  // Cel: zakres z planu (10–12), gdy seria ma wpisany dolny próg z progresji.
  const repsPlan=plan.reps!=null&&plan.reps!==''?String(plan.reps):'';
  const range=ex.planReps&&/[-–]/.test(String(ex.planReps))&&!timed&&s&&s.kind!=='amrap'?csRange(ex.planReps):'';
  const repsTxt=range&&(!repsPlan||String(ex.planReps).split(/[-–]/).map(x=>x.trim()).includes(repsPlan))?range:csRange(repsPlan);
  const target=[repsTxt?repsTxt+' '+unitWord:(s&&s.kind==='amrap'?'max powtórzeń':''),plan.kg!=null&&plan.kg!==''?csNum(plan.kg)+' '+(weightUnit?'kg':loadLbl):''].filter(Boolean).join(' · ');
  const rirPicked=s&&s.rirReported?String(s.rir||''):'';
  const err=cw.setError&&cw.setError.exIdx===idx&&cw.setError.setIdx===cur?cw.setError:null;
  const errAttr=f=>err&&err.field===f?' aria-invalid="true" aria-describedby="cs-set-err"':'';
  const tempoKey=csTempoKey(ex)&&ex.tempo;
  const workTxt=timed&&typeof exerciseCoachHints==='function'?exerciseCoachHints(ex).workLabel:'';
  const lastLine=(()=>{
    const ls=(ex.lastSets||[]).filter(x=>x&&(x.reps||x.kg));
    const pick=ls[Math.min(cur<0?0:cur,ls.length-1)];
    if(pick)return 'Ostatnio: '+csNum(pick.reps||'—')+' × '+csNum(pick.kg||'—')+(weightUnit?' kg':' '+loadLbl);
    return ex.lastKg?('Ostatnio: '+(ex.lastReps?csNum(ex.lastReps)+' × ':'')+csNum(ex.lastKg)+(weightUnit?' kg':' '+loadLbl)):'';
  })();
  const kgStep=weightUnit?2.5:1;
  const card=allDone?`<div class="cs-set-done" data-cs-ex-done>${ex.skipped?'Ćwiczenie pominięte':'Ćwiczenie ukończone '+csIcon('check',20)}</div>
      ${ex.skipped?'':`<p class="cs-done-sum">${sets.filter(x=>x.done).map(x=>csEsc(csNum(x.reps||'—'))+' × '+csEsc(csNum(x.kg||'—'))+' '+csEsc(weightUnit?'kg':loadLbl)).join(' · ')}</p>`}`:`
      ${target?`<p class="cs-target" data-cs-target><span class="cs-target-lbl">Cel</span> ${csEsc(target)}</p>`:''}
      ${hasRir?`<div class="cs-rir-goal"><span>${csEsc(csRirFriendly(ex.rir).replace(/^./,c=>c.toUpperCase()))}</span><button type="button" class="cs-q" aria-label="Co to jest zapas powtórzeń?" aria-expanded="${cw.showRirHelp?'true':'false'}" aria-controls="cs-rir-help" onclick="cwToggleRirHelp()">?</button></div>
      ${cw.showRirHelp?`<p class="cs-rir-help" id="cs-rir-help">Zapas to liczba powtórzeń, które dałbyś radę zrobić jeszcze z dobrą techniką. Skończ serię, zanim ruch zacznie się psuć.</p>`:''}`:''}
      ${tempoKey?`<p class="cs-key-line">Tempo: ${csEsc(csTempoText(ex.tempo))}</p>`:''}
      ${workTxt&&!target?`<p class="cs-key-line">Czas pracy: ${csEsc(workTxt)}</p>`:''}
      <div class="cs-set-grid">
        <label class="cs-num"><span class="cs-num-lbl">${timed?'Sekundy':s.kind==='amrap'?'Powtórzenia (max)':'Powtórzenia'}</span><input type="text" inputmode="numeric" enterkeyhint="next" autocomplete="off" aria-label="Seria ${csEsc(setNo)}: ${timed?'sekundy':'powtórzenia'}"${errAttr('reps')} value="${csEsc(s.reps)}" placeholder="${s.kind==='amrap'?'max':'0'}" onfocus="cwFieldFocus(this)" oninput="cwPatchSet(${cur},'reps',this.value)" onkeydown="cwFieldKey(event,0)"></label>
        <div class="cs-num"><span class="cs-num-lbl" id="cs-kg-lbl">${weightUnit?'Ciężar (kg)':csEsc(loadLbl)}</span><div class="cs-kg-row">
          <button type="button" class="cs-step" aria-label="Ciężar mniej o ${csNum(kgStep)}" onclick="cwStepKg(${cur},-${kgStep})">−</button>
          <input type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-labelledby="cs-kg-lbl" aria-label="Seria ${csEsc(setNo)}: ciężar" value="${csEsc(csNum(s.kg))}" placeholder="${weightUnit?'0':'—'}" onfocus="cwFieldFocus(this)" oninput="cwPatchSet(${cur},'kg',this.value)" onkeydown="cwFieldKey(event,1)">
          <button type="button" class="cs-step" aria-label="Ciężar więcej o ${csNum(kgStep)}" onclick="cwStepKg(${cur},${kgStep})">+</button>
        </div></div>
      </div>
      ${err?`<p class="cs-field-err" id="cs-set-err" role="alert">${csEsc(err.msg)}</p>`:''}
      ${showRir?`<div class="cs-rir-q" role="group" aria-label="Ile powtórzeń zostało w zapasie?${ex.rirRequired?' (wymagane)':' (opcjonalnie)'}"><span>Ile zostało w zapasie? <em>${ex.rirRequired?'wymagane':'opcjonalnie'}</em></span><div class="cs-rir-opts">${CS_RIR_OPTS.map(([v,l])=>`<button type="button" data-rir="${v}" class="${rirPicked===v?'is-on':''}" aria-pressed="${rirPicked===v?'true':'false'}" aria-label="Zapas: ${csEsc(l)}" onclick="cwSetRir(${cur},'${v}')">${csEsc(l)}</button>`).join('')}</div></div>`:''}
      ${lastLine?`<p class="cs-last">${csEsc(lastLine)}</p>`:''}`;
  const rirShow=x=>x.rirReported&&x.rir!=null&&x.rir!==''?'zapas '+String(x.rir):'';
  const setList=sets.map((x,i)=>`<li class="cs-setlog${x.done?' is-done':''}"><span>Seria ${csEsc(x.setNo!=null?x.setNo:i+1)}${x.kind&&x.kind!=='work'?' · '+csEsc((typeof setKindBadge==='function'&&setKindBadge(x.kind))||x.kind):''}</span><span>${csEsc(csNum(x.reps||'—'))} × ${csEsc(csNum(x.kg||'—'))} ${csEsc(weightUnit?'kg':loadLbl)}${x.done&&rirShow(x)?' · '+csEsc(rirShow(x)):''}</span>${x.done?`<button type="button" class="cs-mini" aria-label="Cofnij zapis serii ${csEsc(x.setNo!=null?x.setNo:i+1)}" onclick="cwUndoSet(${i})">Cofnij</button>`:'<span class="cs-mini-ph"></span>'}</li>`).join('');
  const histExtra=typeof lastSetsBlockHtml==='function'?lastSetsBlockHtml(ex,{clientId:window._clientId}):'';
  const pr=typeof exercisePR==='function'&&weightUnit?exercisePR(window._clientId,ex.name):null;
  const hist=`<details class="cs-hist"${cw.showHist?' open':''} ontoggle="cwHistToggle(this.open)">
      <summary>Historia serii <span class="cs-hist-n">${doneN} z ${sets.length}</span><span class="cs-chev">${csIcon('down',18)}</span></summary>
      <ul class="cs-setlogs">${setList}</ul>
      ${histExtra?`<div class="cs-hist-prev">${histExtra}</div>`:''}
      ${pr?`<p class="cs-tip-line">Rekord: ${csEsc(csNum(pr.kg))} kg × ${csEsc(String(pr.reps))}</p>`:''}
      <div class="cw-sync-state ${cw.syncState==='local'?'is-local':''}${cw.syncState==='error'?' is-error':''}" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>
    </details>`;
  const nextEx=cw.exercises[idx+1];
  const primary=allDone
    ?`<button type="button" class="cs-btn cs-btn-primary" data-cs-primary="next" onclick="cwPrimaryNext()">${isLast?'Zakończ trening':'Następne ćwiczenie: '+csEsc(csShortName(nextEx&&nextEx.name))+' →'}</button>`
    :`<button type="button" class="cs-btn cs-btn-primary" data-cs-primary="save" onclick="cwSaveSet(${cur})">Zapisz serię</button>`;
  return `<div class="cs-ex">
    <div class="cs-ex-top">
      <button type="button" class="cs-back-btn" aria-label="Lista ćwiczeń treningu" onclick="cwBack()">${csIcon('back',20)}<span>Lista</span></button>
      <span class="cs-ex-pos">Ćwiczenie ${idx+1} z ${n}</span>
      <span id="cw-clock" class="cs-ex-clock" role="timer" aria-label="Czas treningu">${typeof cwFmt==='function'?cwFmt(cw.elapsed):''}</span>
      <button type="button" class="cs-more-btn" aria-label="Więcej: zamień, pomiń, poprzednie ćwiczenie" onclick="cwMenu()">${csIcon('more',22)}</button>
    </div>
    <div class="cs-ex-segs" style="grid-template-columns:repeat(${n},minmax(0,1fr))" aria-hidden="true">${segs}</div>
    <div class="cs-ex-scroll" data-cs-swipe>
      <div class="cs-ex-body">
        <div class="cs-ex-headrow">
          <h2 class="cs-ex-name" title="${csEsc(ex.name)}">${ex.ssLabel?`<span class="cw-ss-badge">${csEsc(ex.ssLabel)}</span> `:''}${csEsc(shortName)}</h2>
          <button type="button" class="cs-tech-btn" onclick="cwOpenSheet('tech')"><span class="cs-tech-play">${CS_PLAY_ICON}</span>Technika</button>
        </div>
        ${note.key&&note.full?`<p class="cs-key-note" role="note"><b>Uwaga trenera:</b> ${csEsc(note.full)}</p>`:''}
        ${others.length?`<p class="cs-ex-ss">Bez przerwy z: ${others.map(o=>csEsc((o.ssLabel?o.ssLabel+' ':'')+csShortName(o.name))).join(', ')}</p>`:''}
        ${methods.length?`<p class="cs-ex-ss">⚡ ${csEsc(methods.map(m=>((window.INTENSIFICATION_METHODS||{})[m.type]||{}).label||m.type).join(', '))} · opis w „Technice”</p>`:''}
        <section class="cs-set" aria-label="Bieżąca seria">
          <div class="cs-set-head"><b>${allDone?(ex.skipped?'Pominięte':'Wszystkie serie zrobione'):'Seria '+csEsc(setNo)+' z '+sets.length}${kindTag&&!allDone?` · ${csEsc(kindTag)}`:''}</b><span class="cs-dots" aria-hidden="true">${dots}</span></div>
          ${card}
        </section>
        ${cw.syncState==='error'?`<div class="cw-sync-state is-error" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>`:''}
        ${hist}
      </div>
    </div>
    <div class="cs-swipe-hint" aria-hidden="true"></div>
    <div class="cs-ex-foot">
      ${cwSavedBannerHTML(cw)}
      ${primary}
    </div>
  </div>`;
}
window.cwSimpleExerciseHTML=cwSimpleExerciseHTML;
window.csShortName=csShortName;window.csRirFriendly=csRirFriendly;window.csNoteInfo=csNoteInfo;window.csTempoText=csTempoText;window.csNum=csNum;

/* Zapis serii: dokładnie raz. Po zapisie przycisk w tym samym miejscu zmienia znaczenie (przerwa / „Następne ćwiczenie”),
 * więc przez chwilę ignorujemy kolejne dotknięcia — szybkie podwójne dotknięcie nie przeskakuje dalej. */
const CW_TAP_LOCK_MS=700;
function cwTapLocked(){const cw=window._cw;return !!(cw&&cw._tapLockUntil&&Date.now()<cw._tapLockUntil);}
function cwLockTaps(){const cw=window._cw;if(cw)cw._tapLockUntil=Date.now()+CW_TAP_LOCK_MS;}
function cwSaveSet(setIdx){
  const cw=window._cw;if(!cw||cwTapLocked())return;
  const ex=cw.exercises[cw.exIdx];const st=ex&&ex.sets&&ex.sets[setIdx];
  if(!st||st.done)return;
  const reps=Number.parseFloat(String(st.reps||'').replace(',','.'));
  if(reps>0&&ex.rirRequired&&!st.rirReported){
    cw.setError={exIdx:cw.exIdx,setIdx,field:'rir',msg:'Zaznacz, ile powtórzeń zostało w zapasie — trener o to prosi.'};
    cwRender();return;
  }
  // Zmieniony ciężar przechodzi na kolejne serie, które miały ten sam ciężar z planu (nie trzeba wpisywać 17,5 drugi raz).
  const origKg=st._orig?String(st._orig.kg==null?'':st._orig.kg):null;
  const newKg=String(st.kg==null?'':st.kg);
  if(typeof cwCheckSet==='function')cwCheckSet(setIdx);
  if(!st.done)return;
  cwLockTaps();
  if(origKg!=null&&newKg!==''&&newKg!==origKg){
    let carried=false;
    (ex.sets||[]).forEach((x,i)=>{if(i>setIdx&&!x.done&&!x._orig&&String(x.kg==null?'':x.kg)===origKg&&(x.kind||'work')===(st.kind||'work')){x.kg=newKg;carried=true;}});
    if(carried){if(typeof cwWriteLocal==='function')cwWriteLocal(cw);if(cw.phase==='rest')cwRender();}
  }
}
/** Cofnięcie zapisanej serii z „Historii serii”. */
function cwUndoSet(setIdx){
  const cw=window._cw;if(!cw)return;
  const st=((cw.exercises[cw.exIdx]||{}).sets||[])[setIdx];
  if(!st||!st.done)return;
  if(cw.lastSaved&&cw.lastSaved.exIdx===cw.exIdx&&cw.lastSaved.setIdx===setIdx){cwUndoLastSet();return;}
  if(typeof cwCheckSet==='function')cwCheckSet(setIdx);
  if(typeof notify==='function')notify('Cofnięto zapis serii '+(setIdx+1));
}
function cwPrimaryNext(){if(cwTapLocked())return;cwLockTaps();cwNextEx();}
function cwSkipRestTap(){if(cwTapLocked())return;cwLockTaps();if(typeof cwSkipRest==='function')cwSkipRest();}
function cwStepKg(setIdx,delta){
  const cw=window._cw;if(!cw)return;
  const st=((cw.exercises[cw.exIdx]||{}).sets||[])[setIdx];if(!st)return;
  const cur=Number.parseFloat(String(st.kg||'0').replace(',','.'))||0;
  const next=Math.max(0,Math.round((cur+delta)*100)/100);
  if(typeof cwPatchSet==='function')cwPatchSet(setIdx,'kg',String(next));
  const inp=document.querySelector('#clive-player-inner .cs-kg-row input');
  if(inp)inp.value=csNum(next);
}
/** Pole wyniku: całe zaznaczone (wpisanie nadpisuje), widoczne nad klawiaturą. */
function cwFieldFocus(inp){
  try{inp.select();}catch(e){}
  setTimeout(()=>{try{inp.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}},250);
}
function cwFieldKey(e,pos){
  if(e.key!=='Enter')return;
  e.preventDefault();
  const inputs=[...document.querySelectorAll('#clive-player-inner .cs-set-grid input')];
  if(pos===0&&inputs[1])inputs[1].focus();else e.target.blur();
}
function cwToggleRirHelp(){const cw=window._cw;if(!cw)return;cw.showRirHelp=!cw.showRirHelp;cwRender();}
function cwHistToggle(open){const cw=window._cw;if(cw)cw.showHist=!!open;}
window.cwSaveSet=cwSaveSet;window.cwUndoSet=cwUndoSet;window.cwPrimaryNext=cwPrimaryNext;window.cwSkipRestTap=cwSkipRestTap;
window.cwStepKg=cwStepKg;window.cwFieldFocus=cwFieldFocus;window.cwFieldKey=cwFieldKey;window.cwToggleRirHelp=cwToggleRirHelp;window.cwHistToggle=cwHistToggle;
window.cwTapLocked=cwTapLocked;window.CW_TAP_LOCK_MS=CW_TAP_LOCK_MS;

/** Przerwa: duży licznik, parametry następnej serii, „Cofnij” i „Pomiń przerwę” w zasięgu kciuka. */
function csRestClock(sec){const v=Math.max(0,sec|0);return v>=60?Math.floor(v/60)+':'+String(v%60).padStart(2,'0'):v+' s';}
function csRestHTML(cw){
  const nxt=cw.exercises[cw.exIdx]||{};
  const emom=cw.restKind==='emom';
  const nSets=nxt.sets||[];
  const ni=nSets.findIndex(s=>!s.done);
  const ns=ni>=0?nSets[ni]:null;
  const unit=typeof exLoadUnit==='function'?exLoadUnit(nxt):'kg';
  const weightUnit=typeof isWeightLoadUnit!=='function'||isWeightLoadUnit(unit);
  const range=nxt.planReps&&/[-–]/.test(String(nxt.planReps))&&unit!=='sec'?csRange(nxt.planReps):'';
  const reps=ns?(range||csRange(ns.reps)):'';
  const params=ns?[reps?reps+(unit==='sec'?' s':' powt.'):'',ns.kg!=null&&String(ns.kg).trim()!==''?csNum(ns.kg)+(weightUnit?' kg':''):''].filter(Boolean).join(' · '):'';
  const prevEx=cw.lastSaved?cw.exercises[cw.lastSaved.exIdx]:null;
  const change=prevEx&&prevEx!==nxt;
  return `<div class="cs-ex cs-rest-scr">
    <div class="cs-ex-top"><span class="cs-ex-pos">${emom?'EMOM: czekaj na pełną minutę':(nxt.ssLabel?'Przerwa · super-seria':'Przerwa')}</span><span id="cw-clock" class="cs-ex-clock" role="timer" aria-label="Czas treningu">${typeof cwFmt==='function'?cwFmt(cw.elapsed):''}</span></div>
    <div class="cs-ex-scroll"><div class="cw-rest cs-rest">
      <div class="cw-rest-num cs-rest-clock" id="cw-rest-num" role="timer" aria-label="Pozostały czas przerwy">${csRestClock(cw.restLeft)}</div>
      <div class="sr-only" id="cw-rest-live" aria-live="polite"></div>
      ${ns?`<div class="cs-rest-next">
        <span class="cs-eyebrow">${change?'NASTĘPNE ĆWICZENIE':(emom?'NASTĘPNA RUNDA':'NASTĘPNA SERIA')}</span>
        <b>${nxt.ssLabel?csEsc(nxt.ssLabel)+' ':''}${csEsc(csShortName(nxt.name))}</b>
        <span>Seria ${ni+1} z ${nSets.length}${params?' · '+csEsc(params):''}</span>
      </div>`:''}
    </div></div>
    <div class="cs-ex-foot">
      ${cwSavedBannerHTML(cw)}
      <button type="button" class="cs-btn cs-btn-secondary cs-rest-skip" onclick="cwSkipRestTap()">Pomiń przerwę</button>
    </div>
  </div>`;
}
window.csRestHTML=csRestHTML;window.csRestClock=csRestClock;

/* Otwarta klawiatura na iPhonie: odtwarzacz mieści się w widocznej części ekranu (visualViewport), CTA nad klawiaturą. */
(function cwKeyboardFit(){
  const vv=typeof window!=='undefined'&&window.visualViewport;
  if(!vv||window._cwKbBound)return;
  window._cwKbBound=true;
  const fit=()=>{
    const p=document.getElementById('clive-player');if(!p)return;
    const on=document.body.classList.contains('cw-playing')&&(window.innerHeight-vv.height)>120;
    p.classList.toggle('cw-kb',on);
    if(on){p.style.setProperty('--cw-vvh',Math.round(vv.height)+'px');p.style.top=Math.round(vv.offsetTop)+'px';}
    else{p.style.removeProperty('--cw-vvh');p.style.top='';}
  };
  vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);
})();
