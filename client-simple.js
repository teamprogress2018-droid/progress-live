/* Progress Live — prosty widok klienta (aplikacja klienta, tryb live).
 * Zasada: na ekranie „Dzisiaj” jedna główna akcja. Rozpiska, ciężary i statystyki
 * dopiero po wejściu w trening, plan albo „Więcej statystyk”.
 * Ekrany: Dzisiaj (csTodayHTML), Trening (csTrainScreenHTML + cwSimpleExerciseHTML),
 * Plan (csPlanHTML), Postępy (csProgressHTML), Kontakt (csContactHTML).
 * Dane: te same co dotąd (PL, SE, METRIC_ENTRIES, SETTINGS z publicznego profilu trenera). */

const CS_ICONS={
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
    return `<section class="cs-card is-done"><div class="cs-check" aria-hidden="true">${csIcon('check',26)}</div><h2 class="cs-card-title">Trening zapisany</h2><p class="cs-card-text">Zapisano ${Number(inProgress.confirmedSets||0)} serii na telefonie. Wyślemy je, gdy wróci internet.</p></section>`;
  }
  if(inProgress){
    const t=csDayTitle(slot.day,slot.dayIdx);
    return `<section class="cs-card" data-cap-swipe-plan><div class="cs-eyebrow">TRENING W TOKU</div><h2 class="cs-card-title">${csEsc(inProgress.dayName&&!/^dzie[ńn]\s*\d+$/i.test(inProgress.dayName)?inProgress.dayName:t.title)}</h2><p class="cs-card-text">Zapisano ${Number(inProgress.confirmedSets||0)} serii${inProgress.syncState==='local'?' · na telefonie':''}.</p><button type="button" class="cs-btn cs-btn-primary" onclick="${startCall}">${CS_PLAY_ICON}Wznów trening</button></section>`;
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

function csTodayHTML(c){
  const st=csTodayState(c);
  const {slot,inProgress}=st;
  const first=String(c.name||'').trim().split(/\s+/)[0]||'';
  const sub=inProgress?'Wróć do treningu, gdy będziesz gotowy.':
    slot.kind==='workout'?'Masz dziś zaplanowany trening.':
    slot.kind==='done'?'Dzisiejszy trening masz już za sobą.':
    slot.kind==='rest'?'Dziś bez treningu — czas na regenerację.':'Witaj w aplikacji.';
  const today=csToday();
  const meeting=(slot.inPerson||[]).find(s=>s&&s.date>=today&&s.source!=='client'&&s.source!=='live');
  return `<div class="cs-screen cs-today">
    <header class="cs-hello"><h1 class="cs-h1">Cześć${first?', '+csEsc(first):''}!</h1><p class="cs-lead">${sub}</p></header>
    ${csTodayCardHTML(c,st)}
    ${meeting?`<div class="cs-note">${csIcon('calendar',18)}<span>Spotkanie z trenerem: ${csEsc(meeting.time||'')} ${csEsc(meeting.type||'')}</span></div>`:''}
    ${csWeekBar(c,slot.plan)}
  </div>`;
}
window.csTodayHTML=csTodayHTML;

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
  cwDirtySets(cw).forEach(({st})=>{['reps','kg','rir'].forEach(k=>{st[k]=st._orig[k];});delete st.rirUnknown;});
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
/** RIR prostym językiem: 0 / 1–2 / 3–4 / Nie wiem. */
const CS_RIR_OPTS=[['0','Ledwo (0)'],['1-2','1–2'],['3-4','3–4'],['?','Nie wiem']];
function cwSetRir(setIdx,val){
  const cw=window._cw;if(!cw)return;
  const st=(cw.exercises[cw.exIdx]||{}).sets?.[setIdx];if(!st)return;
  if(val==='?'){if(typeof cwPatchSet==='function')cwPatchSet(setIdx,'rir','');st.rirUnknown=true;}
  else{if(typeof cwPatchSet==='function')cwPatchSet(setIdx,'rir',val);delete st.rirUnknown;}
  document.querySelectorAll('.cs-rir-opts [data-rir]').forEach(b=>{const on=b.dataset.rir===(st.rirUnknown?'?':String(st.rir||''));b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',on?'true':'false');});
}
/** „Cofnij” po zapisie serii (7 s): seria znowu do zrobienia, przerwa anulowana. */
function cwUndoLastSet(){
  const cw=window._cw;if(!cw||!cw.lastSaved)return;
  const ls=cw.lastSaved;
  const st=((cw.exercises[ls.exIdx]||{}).sets||[])[ls.setIdx];
  cw.lastSaved=null;
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
      <button type="button" class="cs-btn cs-btn-secondary" onclick="cwNavGo(1)">${last?'Zakończ trening':'Przejdź dalej'}</button>`;
  }else if(sh.kind==='menu'){
    title='Trening';
    body=`<button type="button" class="cs-btn cs-btn-ghost" data-cs-sheet-first onclick="cwSkipAsk()">Pomiń ćwiczenie</button>
      <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwSheetClose();cwReportProblem()">Zgłoś ból lub problem</button>
      <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwEndWorkout()">Zakończ trening</button>`;
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
  const s=allDone?sets[sets.length-1]||{}:sets[cur];
  const setNo=s&&s.setNo!=null?s.setNo:(cur+1);
  const curNo=cur+1;
  const kindTag=s&&s.kind&&s.kind!=='work'?((typeof setKindBadge==='function'&&setKindBadge(s.kind))||s.kind):'';
  const todo=typeof exerciseTodoNote==='function'?exerciseTodoNote(ex):String(ex.note||ex.libTip||'').trim();
  const tip=csShortTip(todo);
  const hasMedia=!!(ex.video||ex.videoEmbed||ex.gif||ex.img);
  const segs=cw.exercises.map((_,i)=>`<span class="${i<idx?'is-past':i===idx?'is-now':''}"></span>`).join('');
  const dots=sets.map((x,i)=>`<span class="${x.done?'is-done':i===cur?'is-now':''}"></span>`).join('');
  const others=(()=>{const g=typeof ssGroupIdxs==='function'?ssGroupIdxs(cw.exercises,idx):[];return g.filter(i=>i!==idx).map(i=>cw.exercises[i]).filter(Boolean);})();
  const emomOn=typeof isEmomExercise==='function'&&isEmomExercise(ex);
  const methods=typeof exerciseIntensificationMethods==='function'?exerciseIntensificationMethods(ex):[];
  const methodsHtml=methods.map(m=>{const def=(window.INTENSIFICATION_METHODS||{})[m.type]||{};const info=typeof intensificationInstruction==='function'?intensificationInstruction(m,ex):m.protocol;return `<div class="cs-method"><b>${csEsc(def.label||m.type)} · ${csEsc(def.when||'Wykonanie')}</b><span>${csEsc(info)}</span></div>`;}).join('');
  const showRir=!allDone&&ex.rir!=null&&String(ex.rir)!=='';
  const plan=(s&&s._orig)||s||{};
  const unitWord=unit==='sec'?'s':s&&s.kind==='amrap'?'powtórzeń (max)':'powtórzeń';
  const target=[plan.reps!=null&&plan.reps!==''?csEsc(plan.reps)+' '+unitWord:(s&&s.kind==='amrap'?'max powtórzeń':''),plan.kg!=null&&plan.kg!==''?csEsc(plan.kg)+' '+csEsc(weightUnit?'kg':loadLbl):'',showRir?'zostaw w zapasie '+csEsc(String(ex.rir).replace(/\s*-\s*/,'–'))+' '+csRepWord(ex.rir):''].filter(Boolean).join(' · ');
  const rirVal=s&&s.rirUnknown?'?':String((s&&s.rir)||'');
  const err=cw.setError&&cw.setError.exIdx===idx&&cw.setError.setIdx===cur?cw.setError:null;
  const errAttr=f=>err&&err.field===f?' aria-invalid="true" aria-describedby="cs-set-err"':'';
  const inputs=allDone?`<p class="cs-set-done" data-cs-ex-done>${ex.skipped?'Ćwiczenie pominięte':'Ćwiczenie ukończone'} ${ex.skipped?'':csIcon('check',20)}</p>`:`
      ${target?`<p class="cs-target" data-cs-target>${target}</p>`:''}
      <div class="cs-set-grid">
        <label class="cs-num"><input type="text" inputmode="numeric" enterkeyhint="done" aria-label="Seria ${csEsc(setNo)}: powtórzenia"${errAttr('reps')} value="${csEsc(s.reps)}" placeholder="${s.kind==='amrap'?'max':'0'}" oninput="cwPatchSet(${cur},'reps',this.value)"><span>${unit==='sec'?'sekund':s.kind==='amrap'?'powtórzeń (max)':'powtórzeń'}</span></label>
        <label class="cs-num"><input type="text" inputmode="decimal" enterkeyhint="done" aria-label="Seria ${csEsc(setNo)}: ciężar" value="${csEsc(s.kg)}" placeholder="${weightUnit?'0':'—'}" oninput="cwPatchSet(${cur},'kg',this.value)"><span>${csEsc(weightUnit?'kg':loadLbl)}</span></label>
      </div>
      ${err?`<p class="cs-field-err" id="cs-set-err" role="alert">${csEsc(err.msg)}</p>`:''}
      ${showRir?`<div class="cs-rir-q" role="group" aria-label="Ile powtórzeń zostało Ci w zapasie?"><span>Ile powtórzeń zostało Ci w zapasie?</span><div class="cs-rir-opts">${CS_RIR_OPTS.map(([v,l])=>`<button type="button" data-rir="${v}" class="${rirVal===v?'is-on':''}" aria-pressed="${rirVal===v?'true':'false'}" aria-label="Seria ${csEsc(setNo)}: zapas ${csEsc(l)}" onclick="cwSetRir(${cur},'${v}')">${csEsc(l)}</button>`).join('')}</div></div>`:''}`;
  const lastHtml=(()=>{
    const html=typeof lastSetsBlockHtml==='function'?lastSetsBlockHtml(ex,{clientId:window._clientId}):'';
    const pr=typeof exercisePR==='function'&&weightUnit?exercisePR(window._clientId,ex.name):null;
    const rec=pr?('Rekord: '+csEsc(String(pr.kg))+' kg × '+csEsc(String(pr.reps))):'';
    if(html)return html+(rec?`<p class="cs-tip-line">${rec}</p>`:'');
    const last=ex.lastKg?('Ostatnio: '+csEsc(String(ex.lastKg))+' '+csEsc(typeof loadUnitSuffix==='function'?loadUnitSuffix(unit):'kg')+(ex.lastReps?' × '+csEsc(String(ex.lastReps)):'')):'';
    const line=[last,rec].filter(Boolean).join(' · ');
    return line?`<p class="cs-tip-line">${line}</p>`:'';
  })();
  const rirShow=x=>x.rirUnknown?'zapas: nie wiem':(x.rir!=null&&x.rir!==''?'zapas '+String(x.rir).replace('-','–'):'');
  const setList=sets.map((x,i)=>`<li class="cs-setlog${x.done?' is-done':''}"><span>Seria ${csEsc(x.setNo!=null?x.setNo:i+1)}${x.kind&&x.kind!=='work'?' · '+csEsc((typeof setKindBadge==='function'&&setKindBadge(x.kind))||x.kind):''}</span><span>${csEsc(x.reps||'—')} × ${csEsc(x.kg||'—')} ${csEsc(weightUnit?'kg':loadLbl)}${x.done&&rirShow(x)?' · '+csEsc(rirShow(x)):''}</span>${x.done?`<button type="button" class="cs-mini" aria-label="Cofnij zapis serii ${csEsc(x.setNo!=null?x.setNo:i+1)}" onclick="cwCheckSet(${i})">Cofnij</button>`:'<span class="cs-mini-ph"></span>'}</li>`).join('');
  const tips=cw.showTips?`<div class="cs-tips" id="cs-tips">
      ${todo&&todo!==tip?`<div class="cs-tips-block"><div class="cs-eyebrow">TECHNIKA</div><p>${csEsc(todo)}</p></div>`:''}
      ${!hasMedia&&!todo?'<div class="cw-media-missing" role="note">Brak materiału instruktażowego. Jeśli nie znasz tego ćwiczenia, poproś trenera o wskazówkę przed rozpoczęciem.</div>':''}
      ${typeof exerciseCoachHintsHtml==='function'?exerciseCoachHintsHtml(ex):''}
      ${ex.plannedName&&ex.plannedName!==ex.name?`<p class="cs-tip-line">Z planu: ${csEsc(ex.plannedName)}</p>`:''}
      ${ex.kgHint?`<p class="cs-tip-line">${csEsc(ex.kgHint)}</p>`:''}
      ${ex.progHint?`<p class="cs-tip-line">${csEsc(ex.progHint)}</p>`:''}
      ${emomOn?`<p class="cs-tip-line">EMOM: zrób serię i odpocznij do końca minuty.</p>`:''}
      ${methodsHtml?`<div class="cs-tips-block">${methodsHtml}</div>`:''}
      ${lastHtml?`<div class="cs-tips-block"><div class="cs-eyebrow">HISTORIA</div>${lastHtml}</div>`:''}
      <div class="cs-tips-block"><div class="cs-eyebrow">SERIE (${doneN}/${sets.length})</div><ul class="cs-setlogs">${setList}</ul>${showRir?'<p class="cs-tip-line cw-rir-help">Zapas powtórzeń: ile powtórzeń dałbyś radę zrobić jeszcze po serii.</p>':''}</div>
      ${(ex.alts||[]).length?`<div class="cs-tips-block"><div class="cs-eyebrow">INNE WARIANTY OD TRENERA</div><div class="cs-chips">${ex.alts.slice(0,3).map(a=>`<button type="button" class="cs-chip" onclick='cwSwapEx(${JSON.stringify(a).replace(/'/g,'&#39;')})'>↻ ${csEsc(a)}</button>`).join('')}</div></div>`:''}
      <div class="cw-sync-state ${cw.syncState==='local'?'is-local':''}${cw.syncState==='error'?' is-error':''}" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>
      <div class="cs-tips-actions">
        ${idx>0?'<button type="button" class="cs-btn cs-btn-ghost" onclick="cwNav(-1)">← Poprzednie ćwiczenie</button>':''}
        ${allDone?'':'<button type="button" class="cs-btn cs-btn-ghost" onclick="cwSkipAsk()">Pomiń ćwiczenie</button>'}
        <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwReportProblem()">Zgłoś ból lub problem</button>
      </div>
    </div>`:'';
  const nextEx=cw.exercises[idx+1];
  const primary=allDone
    ?`<button type="button" class="cs-btn cs-btn-primary" data-cs-primary="next" onclick="cwNextEx()">${isLast?'Zakończ trening':'Przejdź do następnego ćwiczenia'}</button>`
    :`<button type="button" class="cs-btn cs-btn-primary" data-cs-primary="save" onclick="cwCheckSet(${cur})">Zapisz serię ${curNo} z ${sets.length}</button>`;
  const media=hasMedia?(cw.showVideo&&typeof coachMediaHtml==='function'
    ?`<div class="cs-media">${coachMediaHtml(ex,{showVideo:true,toggleFn:'cwToggleVideo()',caption:false,showNote:false})}<button type="button" class="cs-media-x" aria-label="Zamknij film" onclick="cwToggleVideo()">${csIcon('close',20)}</button></div>`
    :`<button type="button" class="cs-tech-btn" onclick="cwToggleVideo()"><span class="cs-tech-play">${CS_PLAY_ICON}</span>Technika</button>`):'';
  return `<div class="cs-ex">
    <div class="cs-ex-top">
      <button type="button" class="cs-back-btn" onclick="cwBack()">${csIcon('back',20)}<span>Wróć do treningu</span></button>
      <span id="cw-clock" class="cs-ex-clock" role="timer" aria-label="Czas treningu">${typeof cwFmt==='function'?cwFmt(cw.elapsed):''}</span>
      <button type="button" class="cs-more-btn" aria-label="Więcej opcji treningu" onclick="cwMenu()">${csIcon('more',22)}</button>
    </div>
    <div class="cs-ex-segs" style="grid-template-columns:repeat(${n},minmax(0,1fr))" aria-hidden="true">${segs}</div>
    <div class="cs-ex-scroll" data-cs-swipe>
      <div class="cs-ex-body">
        <span class="cs-ex-count">Ćwiczenie ${idx+1} z ${n}</span>
        <h2 class="cs-ex-name">${ex.ssLabel?`<span class="cw-ss-badge">${csEsc(ex.ssLabel)}</span> `:''}${csEsc(ex.name)}</h2>
        ${tip||media?`<div class="cs-ex-tiprow">${tip?`<p class="cs-ex-tip">${csEsc(tip)}</p>`:''}${cw.showVideo?'':media}</div>`:''}
        ${cw.showVideo?media:''}
        ${others.length?`<p class="cs-ex-ss">Bez przerwy z: ${others.map(o=>csEsc((o.ssLabel?o.ssLabel+' ':'')+o.name)).join(', ')}</p>`:''}
        ${methods.length&&!cw.showTips?`<p class="cs-ex-ss">⚡ ${csEsc(methods.map(m=>((window.INTENSIFICATION_METHODS||{})[m.type]||{}).label||m.type).join(', '))} — szczegóły we „Wskazówkach i historii”</p>`:''}
        <section class="cs-set" aria-label="Bieżąca seria">
          <div class="cs-set-head"><b>${allDone?(ex.skipped?'Pominięte':'Wszystkie serie zrobione'):'Seria '+csEsc(setNo)+' z '+sets.length}${kindTag&&!allDone?` · ${csEsc(kindTag)}`:''}</b><span class="cs-dots" aria-hidden="true">${dots}</span></div>
          ${inputs}
        </section>
        ${cw.syncState==='error'&&!cw.showTips?`<div class="cw-sync-state is-error" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>`:''}
        <button type="button" class="cs-link" aria-expanded="${cw.showTips?'true':'false'}" aria-controls="cs-tips" onclick="cwToggleTips()">${cw.showTips?'Ukryj wskazówki':'Wskazówki i historia'}<span class="cs-chev${cw.showTips?' is-open':''}">${csIcon('down',18)}</span></button>
        ${tips}
      </div>
    </div>
    <div class="cs-swipe-hint" aria-hidden="true"></div>
    <div class="cs-ex-foot">
      ${cwSavedBannerHTML(cw)}
      ${primary}
      <div class="cs-ex-nav">
        <button type="button" class="cs-nav-btn" data-cs-nav="prev" onclick="cwNav(-1)" ${idx>0?'':'disabled'}>← Poprzednie</button>
        <button type="button" class="cs-nav-btn" data-cs-nav="next" onclick="cwNav(1)">${isLast?'Zakończ →':'Następne →'}</button>
      </div>
    </div>
  </div>`;
}
window.cwSimpleExerciseHTML=cwSimpleExerciseHTML;

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
