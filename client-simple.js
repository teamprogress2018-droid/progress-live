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
function cwNextEx(){
  const cw=window._cw;if(!cw)return;
  cw.showTips=false;
  if(cw.exIdx<cw.exercises.length-1){if(typeof cwGoEx==='function')cwGoEx(cw.exIdx+1);return;}
  cw.phase='finish';
  if(typeof cwRender==='function')cwRender();
}
function cwToggleTips(){const cw=window._cw;if(!cw)return;cw.showTips=!cw.showTips;if(typeof cwRender==='function')cwRender();}
window.cwNextEx=cwNextEx;window.cwToggleTips=cwToggleTips;

function cwSimpleExerciseHTML(cw,ex){
  const n=cw.exercises.length,idx=cw.exIdx;
  const sets=ex.sets||[];
  const cur=sets.findIndex(s=>!s.done);
  const doneN=sets.filter(s=>s.done).length;
  const allDone=cur<0;
  const isLast=idx===n-1;
  const unit=typeof exLoadUnit==='function'?exLoadUnit(ex):'kg';
  const loadLbl=typeof loadUnitShortLabel==='function'?loadUnitShortLabel(unit):'kg';
  const weightUnit=typeof isWeightLoadUnit!=='function'||isWeightLoadUnit(unit);
  const s=allDone?sets[sets.length-1]||{}:sets[cur];
  const setNo=s&&s.setNo!=null?s.setNo:(cur+1);
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
  const inputs=allDone?`<p class="cs-set-done">Wszystkie serie zrobione. ${isLast?'To było ostatnie ćwiczenie.':'Przejdź do następnego ćwiczenia.'}</p>`:`
      <div class="cs-set-grid">
        <label class="cs-num"><input type="text" inputmode="numeric" aria-label="Seria ${csEsc(setNo)}: powtórzenia" value="${csEsc(s.reps)}" placeholder="${s.kind==='amrap'?'max':'0'}" oninput="cwPatchSet(${cur},'reps',this.value)"><span>${unit==='sec'?'sekund':s.kind==='amrap'?'powtórzeń (max)':'powtórzeń'}</span></label>
        <label class="cs-num"><input type="number" inputmode="decimal" aria-label="Seria ${csEsc(setNo)}: ciężar" value="${csEsc(s.kg)}" placeholder="${weightUnit?'0':'—'}" oninput="cwPatchSet(${cur},'kg',this.value)"><span>${csEsc(weightUnit?'kg':loadLbl)}</span></label>
      </div>
      ${showRir?`<label class="cs-rir"><span>Zapas powtórzeń (RIR)</span><input type="text" inputmode="decimal" aria-label="Seria ${csEsc(setNo)}: RIR" value="${csEsc(s.rir!=null&&s.rir!==''?s.rir:'')}" placeholder="${csEsc(ex.rir)}" oninput="cwPatchSet(${cur},'rir',this.value)"></label>`:''}`;
  const lastHtml=(()=>{
    const html=typeof lastSetsBlockHtml==='function'?lastSetsBlockHtml(ex,{clientId:window._clientId}):'';
    const pr=typeof exercisePR==='function'&&weightUnit?exercisePR(window._clientId,ex.name):null;
    const rec=pr?('Rekord: '+csEsc(String(pr.kg))+' kg × '+csEsc(String(pr.reps))):'';
    if(html)return html+(rec?`<p class="cs-tip-line">${rec}</p>`:'');
    const last=ex.lastKg?('Ostatnio: '+csEsc(String(ex.lastKg))+' '+csEsc(typeof loadUnitSuffix==='function'?loadUnitSuffix(unit):'kg')+(ex.lastReps?' × '+csEsc(String(ex.lastReps)):'')):'';
    const line=[last,rec].filter(Boolean).join(' · ');
    return line?`<p class="cs-tip-line">${line}</p>`:'';
  })();
  const setList=sets.map((x,i)=>`<li class="cs-setlog${x.done?' is-done':''}"><span>Seria ${csEsc(x.setNo!=null?x.setNo:i+1)}${x.kind&&x.kind!=='work'?' · '+csEsc((typeof setKindBadge==='function'&&setKindBadge(x.kind))||x.kind):''}</span><span>${csEsc(x.reps||'—')} × ${csEsc(x.kg||'—')} ${csEsc(weightUnit?'kg':loadLbl)}</span>${x.done?`<button type="button" class="cs-mini" aria-label="Cofnij zatwierdzenie serii ${csEsc(x.setNo!=null?x.setNo:i+1)}" onclick="cwCheckSet(${i})">Cofnij</button>`:'<span class="cs-mini-ph"></span>'}</li>`).join('');
  const tips=cw.showTips?`<div class="cs-tips" id="cs-tips">
      ${todo&&todo!==tip?`<div class="cs-tips-block"><div class="cs-eyebrow">TECHNIKA</div><p>${csEsc(todo)}</p></div>`:''}
      ${!hasMedia&&!todo?'<div class="cw-media-missing" role="note">Brak materiału instruktażowego. Jeśli nie znasz tego ćwiczenia, poproś trenera o wskazówkę przed rozpoczęciem.</div>':''}
      ${typeof exerciseCoachHintsHtml==='function'?exerciseCoachHintsHtml(ex):''}
      ${ex.plannedName&&ex.plannedName!==ex.name?`<p class="cs-tip-line">Z planu: ${csEsc(ex.plannedName)}</p>`:''}
      ${ex.kgHint?`<p class="cs-tip-line">${csEsc(ex.kgHint)}</p>`:''}
      ${ex.progHint?`<p class="cs-tip-line">${csEsc(ex.progHint)}</p>`:''}
      ${emomOn?`<p class="cs-tip-line">EMOM: zrób serię i odpocznij do końca minuty.</p>`:''}
      ${lastHtml?`<div class="cs-tips-block"><div class="cs-eyebrow">POPRZEDNIO</div>${lastHtml}</div>`:''}
      <div class="cs-tips-block"><div class="cs-eyebrow">SERIE (${doneN}/${sets.length})</div><ul class="cs-setlogs">${setList}</ul>${showRir?'<p class="cs-tip-line cw-rir-help">RIR — ile powtórzeń zostało Ci w zapasie po serii.</p>':''}</div>
      ${(ex.alts||[]).length?`<div class="cs-tips-block"><div class="cs-eyebrow">INNE WARIANTY OD TRENERA</div><div class="cs-chips">${ex.alts.slice(0,3).map(a=>`<button type="button" class="cs-chip" onclick='cwSwapEx(${JSON.stringify(a).replace(/'/g,'&#39;')})'>↻ ${csEsc(a)}</button>`).join('')}</div></div>`:''}
      <div class="cw-sync-state ${cw.syncState==='local'?'is-local':''}${cw.syncState==='error'?' is-error':''}" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>
      <div class="cs-tips-actions">
        ${idx>0?'<button type="button" class="cs-btn cs-btn-ghost" onclick="cwPrevEx()">Poprzednie ćwiczenie</button>':''}
        <button type="button" class="cs-btn cs-btn-ghost" onclick="cwSkipEx()">Pomiń ćwiczenie</button>
        <button type="button" class="cs-btn cs-btn-ghost cs-warn" onclick="cwReportProblem()">Zgłoś ból lub problem</button>
      </div>
    </div>`:'';
  const nextLbl=isLast?'Zakończ trening':'Następne ćwiczenie';
  return `<div class="cs-ex">
    <div class="cs-ex-top">
      <button type="button" class="cs-round" aria-label="Zapisz trening do wznowienia i zamknij" onclick="cwClose()">${csIcon('close',20)}</button>
      <span class="cs-ex-count">Ćwiczenie ${idx+1} z ${n}</span>
      <span id="cw-clock" class="cs-ex-clock" role="timer" aria-label="Czas treningu">${typeof cwFmt==='function'?cwFmt(cw.elapsed):''}</span>
    </div>
    <div class="cs-ex-segs" style="grid-template-columns:repeat(${n},minmax(0,1fr))" aria-hidden="true">${segs}</div>
    <div class="cs-ex-body">
      ${hasMedia?(cw.showVideo&&typeof coachMediaHtml==='function'?`<div class="cs-media">${coachMediaHtml(ex,{showVideo:true,toggleFn:'cwToggleVideo()',caption:false,showNote:false})}</div><button type="button" class="cs-link cs-link-sm" onclick="cwToggleVideo()">Ukryj film</button>`
        :`<button type="button" class="cs-media-btn" onclick="cwToggleVideo()"><span class="cs-media-play">${CS_PLAY_ICON}</span><span>Zobacz technikę</span></button>`):''}
      <h2 class="cs-ex-name">${ex.ssLabel?`<span class="cw-ss-badge">${csEsc(ex.ssLabel)}</span> `:''}${csEsc(ex.name)}</h2>
      ${tip?`<p class="cs-ex-tip">${csEsc(tip)}</p>`:''}
      ${others.length?`<p class="cs-ex-ss">Bez przerwy z: ${others.map(o=>csEsc((o.ssLabel?o.ssLabel+' ':'')+o.name)).join(', ')}</p>`:''}
      ${methodsHtml}
      <section class="cs-set" aria-label="Bieżąca seria">
        <div class="cs-set-head"><b>${allDone?'Wszystkie serie zrobione':'Seria '+csEsc(setNo)+' z '+sets.length}${kindTag&&!allDone?` · ${csEsc(kindTag)}`:''}</b><span class="cs-dots" aria-hidden="true">${dots}</span></div>
        ${inputs}
      </section>
      ${cw.syncState==='error'&&!cw.showTips?`<div class="cw-sync-state is-error" role="status" aria-live="polite">${csEsc(typeof cwSyncStateText==='function'?cwSyncStateText(cw):'')}</div>`:''}
      <button type="button" class="cs-link" aria-expanded="${cw.showTips?'true':'false'}" aria-controls="cs-tips" onclick="cwToggleTips()">${cw.showTips?'Ukryj wskazówki':'Pokaż wskazówki'}<span class="cs-chev${cw.showTips?' is-open':''}">${csIcon('down',18)}</span></button>
      ${tips}
    </div>
    <div class="cs-ex-foot">
      ${allDone?`<button type="button" class="cs-btn cs-btn-primary" onclick="cwNextEx()">${nextLbl}</button>`
        :`<button type="button" class="cs-btn cs-btn-primary" onclick="cwCheckSet(${cur})">Ukończ serię</button><button type="button" class="cs-btn cs-btn-secondary" onclick="cwNextEx()">${nextLbl}</button>`}
    </div>
  </div>`;
}
window.cwSimpleExerciseHTML=cwSimpleExerciseHTML;
