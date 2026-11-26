/* Progress Journey + Progress Rewards (3.0, etap 2c).
 *
 * Wszystko LICZONE z zapisanych treningów (csDoneSessions / csStrengthSeries) przy każdym wyświetleniu — nic nie jest
 * „naliczane”, więc nie da się przyznać czegoś dwa razy ani zgubić po odświeżeniu. Data zdobycia = dzień, w którym warunek
 * został spełniony (np. data 10. treningu).
 *
 * Journey (klient → Postępy, „Twoja droga”): kamienie milowe — pierwszy trening, pierwszy tydzień współpracy, 10 treningów,
 * pierwszy miesiąc, pierwszy rekord osobisty, 30 i 50 treningów, 100 dni współpracy, cel ustalony z trenerem
 * (client.journeyGoal = {text, reachedAt} — osiągnięcie zaznacza trener). Oś czasu: zdobyte (z datą), następny (pasek postępu),
 * 2 kolejne wyszarzone. Subtelne wyróżnienie świeżego etapu (≤ 3 dni), wyłączone przy prefers-reduced-motion.
 *
 * Rewards (klient → Postępy, „Odznaki”): Pierwszy krok, Regularność (4 tyg. z rzędu), Konsekwencja (8 tyg. z rzędu),
 * Wytrwałość (25 treningów), Rekordzista (3 rekordy osobiste), Zdrowe nawyki (10 check-inów samopoczucia),
 * Progress Champion (50 treningów), Progress Elite (100 treningów). Bez nagród za objętość, trening mimo bólu
 * czy kosztem regeneracji; bez liczników „straconych dni” i poczucia winy.
 * Prawdziwe nagrody ustala trener (profil klienta → Plan, karta „Droga klienta i nagrody”):
 * client.rewards = {[badgeId]: {prize, givenAt?}}. Klient widzi „Nagroda od trenera: …” dopiero po zdobyciu odznaki.
 * Zapis tylko na karcie klienta (jak rozgrzewka) — bez zmian reguł Firestore.
 */
(function(){
  'use strict';
  const esc=s=>typeof csEsc==='function'?csEsc(s):(typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const today=()=>typeof csToday==='function'?csToday():new Date().toISOString().slice(0,10);
  const addDays=(ymd,n)=>{if(typeof csAddDays==='function')return csAddDays(ymd,n);const d=new Date(ymd+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const monday=ymd=>{if(typeof csMonday==='function')return csMonday(ymd);const d=new Date(ymd+'T12:00:00');const w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);return d.toISOString().slice(0,10);};
  const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00')-Date.parse(a+'T12:00:00'))/864e5);
  const plural=(n,a,b,c)=>typeof csPlural==='function'?csPlural(n,a,b,c):(n===1?a:(n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:c));
  const fmtDate=ymd=>typeof cpgDate==='function'?cpgDate(ymd):ymd;
  const icon=(n,s)=>typeof csIcon==='function'?csIcon(n,s):'';

  /* ---------- Dane ---------- */
  function pjData(c){
    const sessions=(typeof csDoneSessions==='function'?csDoneSessions(c):[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const dates=sessions.map(s=>String(s.date||'').slice(0,10)).filter(Boolean);
    // Rekordy osobiste jako zdarzenia: ciężar wyższy niż wszystko wcześniej w tym ćwiczeniu (pierwszy wpis to nie rekord).
    const prDates=[];
    try{
      const series=typeof csStrengthSeries==='function'?csStrengthSeries(c):{};
      Object.keys(series).forEach(n=>{let max=null;series[n].forEach(p=>{if(max!=null&&p.kg>max)prDates.push(p.date);max=max==null?p.kg:Math.max(max,p.kg);});});
    }catch(e){}
    prDates.sort();
    // Tygodnie z rzędu (pn–nd) z co najmniej jednym treningiem: data, w której seria osiągnęła N tygodni.
    const weekSet=new Set(dates.map(monday));
    const weeks=[...weekSet].sort();
    const streakAt=n=>{let run=0,prev=null;for(const w of weeks){run=prev&&addDays(prev,7)===w?run+1:1;prev=w;if(run>=n){const inWeek=dates.filter(d=>monday(d)===w);return inWeek[0]||w;}}return '';};
    const readiness=sessions.filter(s=>s.planSnapshot&&s.planSnapshot.readiness&&s.planSnapshot.readiness.level).map(s=>String(s.date).slice(0,10));
    const start=dates[0]||'';
    return {sessions,dates,prDates,streakAt,readiness,start,total:dates.length};
  }

  /* ---------- Journey ---------- */
  function pjMilestones(c,d){
    d=d||pjData(c);
    const t=today();
    const nth=n=>d.dates[n-1]||'';
    const after=n=>d.start&&daysBetween(d.start,t)>=n?addDays(d.start,n):'';
    const cnt=(n,lbl)=>({key:'w'+n,title:lbl||(n+' '+plural(n,'trening','treningi','treningów')),at:nth(n),progress:Math.min(d.total,n),of:n,unit:plural(n,'trening','treningi','treningów')});
    const days=(n,title)=>({key:'d'+n,title,at:after(n),progress:d.start?Math.min(n,Math.max(0,daysBetween(d.start,t))):0,of:n,unit:'dni'});
    const list=[
      {key:'first',title:'Pierwszy trening',at:nth(1),progress:Math.min(d.total,1),of:1,unit:'trening'},
      days(7,'Pierwszy tydzień współpracy'),
      cnt(10),
      days(30,'Pierwszy miesiąc'),
      {key:'pr1',title:'Pierwszy rekord osobisty',at:d.prDates[0]||'',progress:d.prDates.length?1:0,of:1,unit:'rekord'},
      cnt(30),cnt(50),
      days(100,'100 dni współpracy')
    ];
    const g=c&&c.journeyGoal;
    if(g&&String(g.text||'').trim())list.push({key:'goal',title:'Twój cel: '+String(g.text).trim().slice(0,120),at:g.reachedAt?String(g.reachedAt).slice(0,10):'',progress:g.reachedAt?1:0,of:1,unit:'',trainer:true});
    return list;
  }
  function pjJourneyHTML(c){
    if(!c)return '';
    const d=pjData(c);
    if(!d.total)return '';
    const all=pjMilestones(c,d);
    const done=all.filter(m=>m.at).sort((a,b)=>a.at.localeCompare(b.at));
    const todo=all.filter(m=>!m.at);
    const next=todo[0];const later=todo.slice(1,3);
    const fresh=m=>m.at&&daysBetween(m.at,today())<=3;
    const li=(m,state)=>{
      const bar=state==='next'&&m.of>1?`<div class="pj-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.of}" aria-valuenow="${m.progress}" aria-label="${esc(m.title)}"><span style="width:${Math.round(100*m.progress/m.of)}%"></span></div><span class="pj-sub">${m.progress} z ${m.of} ${esc(m.unit)}</span>`:'';
      const sub=state==='done'?`<span class="pj-sub">${esc(fmtDate(m.at))}</span>`:state==='next'?(m.trainer?'<span class="pj-sub">Osiągnięcie potwierdzi trener.</span>':''):'';
      return `<li class="pj-item is-${state}${fresh(m)?' is-fresh':''}" data-pj="${esc(m.key)}"><span class="pj-dot" aria-hidden="true">${state==='done'?icon('check',14):''}</span><span class="pj-body"><b>${esc(m.title)}</b>${sub}${bar}</span><span class="sr-only">${state==='done'?'osiągnięte':state==='next'?'następny etap':'przed Tobą'}</span></li>`;
    };
    return `<section class="cpg-card pj" data-pj-journey aria-labelledby="pj-h">
      <h2 class="cpg-h" id="pj-h">${icon('star',18)}Twoja droga</h2>
      <ol class="pj-list">${done.map(m=>li(m,'done')).join('')}${next?li(next,'next'):''}${later.map(m=>li(m,'later')).join('')}</ol>
    </section>`;
  }

  /* ---------- Rewards ---------- */
  const PJ_BADGES=[
    {id:'first_step',name:'Pierwszy krok',how:'Pierwszy ukończony trening.',at:(c,d)=>d.dates[0]||'',left:d=>d.total?'':'1 trening'},
    {id:'regularity',name:'Regularność',how:'4 tygodnie z rzędu z treningiem.',at:(c,d)=>d.streakAt(4),left:()=>''},
    {id:'consistency',name:'Konsekwencja',how:'8 tygodni z rzędu z treningiem.',at:(c,d)=>d.streakAt(8),left:()=>''},
    {id:'perseverance',name:'Wytrwałość',how:'25 ukończonych treningów.',at:(c,d)=>d.dates[24]||'',left:d=>leftN(25-d.total,'trening','treningi','treningów')},
    {id:'record',name:'Rekordzista',how:'3 rekordy osobiste.',at:(c,d)=>d.prDates[2]||'',left:d=>leftN(3-d.prDates.length,'rekord','rekordy','rekordów')},
    {id:'habits',name:'Zdrowe nawyki',how:'10 razy „Jak się dziś czujesz?” przed treningiem.',at:(c,d)=>d.readiness[9]||'',left:d=>leftN(10-d.readiness.length,'check-in','check-iny','check-inów')},
    {id:'champion',name:'Progress Champion',how:'50 ukończonych treningów.',at:(c,d)=>d.dates[49]||'',left:d=>leftN(50-d.total,'trening','treningi','treningów')},
    {id:'elite',name:'Progress Elite',how:'100 ukończonych treningów.',at:(c,d)=>d.dates[99]||'',left:d=>leftN(100-d.total,'trening','treningi','treningów')}
  ];
  function leftN(n,a,b,c){return n>0?'Jeszcze '+n+' '+plural(n,a,b,c):'';}
  const PJ_PRIZES=['Koszulka Team Progress','Dodatkowa konsultacja','Analiza techniki','Bonus do pakietu'];
  function pjRewardsCfg(c){
    const r=c&&c.rewards&&typeof c.rewards==='object'?c.rewards:{};
    const out={};
    PJ_BADGES.forEach(b=>{const x=r[b.id];if(x&&String(x.prize||'').trim())out[b.id]={prize:String(x.prize).trim().slice(0,80),givenAt:x.givenAt?String(x.givenAt).slice(0,10):''};});
    return out;
  }
  function pjBadges(c,d){
    d=d||pjData(c);
    const cfg=pjRewardsCfg(c);
    return PJ_BADGES.map(b=>{const at=b.at(c,d);return {id:b.id,name:b.name,how:b.how,at,earned:!!at,left:at?'':b.left(d),prize:cfg[b.id]?cfg[b.id].prize:'',givenAt:cfg[b.id]?cfg[b.id].givenAt:''};});
  }
  function pjBadgesHTML(c){
    if(!c)return '';
    const d=pjData(c);if(!d.total)return '';
    const list=pjBadges(c,d);
    const n=list.filter(b=>b.earned).length;
    const pending=list.filter(b=>b.earned&&b.prize&&!b.givenAt);
    return `<section class="cpg-card pj-badges" data-pj-badges aria-labelledby="pjb-h">
      <h2 class="cpg-h" id="pjb-h">${icon('trophy',18)}Odznaki <span class="pj-count">${n} z ${list.length}</span></h2>
      ${pending.length?`<div class="pj-prize" data-pj-prize role="status">${icon('star',18)}<span><b>Nagroda od trenera: ${esc(pending.map(b=>b.prize).join(', '))}</b><br>Za odznakę ${esc(pending.map(b=>'„'+b.name+'”').join(', '))}. Odbierzesz ją na treningu.</span></div>`:''}
      <ul class="pj-grid">${list.map(b=>`<li class="pj-badge${b.earned?' is-on':''}" data-pj-badge="${b.id}">
        <span class="pj-medal" aria-hidden="true">${icon(b.earned?'trophy':'star',22)}</span>
        <b>${esc(b.name)}</b>
        <span class="pj-sub">${b.earned?esc(fmtDate(b.at)):esc(b.left||b.how)}</span>
        ${b.prize&&b.earned?`<span class="pj-sub pj-gift">${b.givenAt?'Odebrano: ':'Nagroda: '}${esc(b.prize)}</span>`:''}
        <span class="sr-only">${b.earned?'zdobyta':'jeszcze nie zdobyta'} — ${esc(b.how)}</span>
      </li>`).join('')}</ul>
    </section>`;
  }

  /* ---------- Trener: karta w profilu klienta → Plan ---------- */
  function pjState(c){const st=window._pjEdit;return st&&st.clientId===c.id?st:null;}
  function pjTrainerCardHTML(c){
    const d=pjData(c);
    const st=pjState(c);
    const badges=pjBadges(c,d);
    const ms=pjMilestones(c,d).filter(m=>m.at);
    const pending=badges.filter(b=>b.earned&&b.prize&&!b.givenAt);
    if(!st){
      return `<section class="wu-card pj-card" id="pj-card" aria-labelledby="pj-t">
        <div class="wu-head"><h3 id="pj-t" class="cp-section-title" style="margin:0;">DROGA KLIENTA I NAGRODY</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="pj-edit" data-cid="${esc(c.id)}">Ustaw nagrody i cel</button></div>
        <p class="wu-sub">${d.total?`${d.total} ${plural(d.total,'trening','treningi','treningów')} · kamienie milowe: ${ms.length} · odznaki: ${badges.filter(b=>b.earned).length} z ${badges.length}`:'Brak ukończonych treningów — droga zacznie się po pierwszym treningu.'}</p>
        ${pending.length?`<p class="pj-todo" role="status"><b>Do wręczenia (${pending.length}):</b> ${esc(pending.map(b=>b.prize+' — „'+b.name+'”').join('; '))}</p>`:''}
        ${c.journeyGoal&&c.journeyGoal.text?`<p class="wu-sub">Cel: ${esc(c.journeyGoal.text)}${c.journeyGoal.reachedAt?' — osiągnięty '+esc(fmtDate(String(c.journeyGoal.reachedAt).slice(0,10))):''}</p>`:''}
      </section>`;
    }
    const row=b=>{
      const cur=st.rewards[b.id]||{prize:'',given:false};
      const preset=cur.own?'__own':(PJ_PRIZES.includes(cur.prize)?cur.prize:(cur.prize?'__own':''));
      return `<tr><th scope="row">${esc(b.name)}<br><span class="wu-sub">${b.earned?'zdobyta '+esc(fmtDate(b.at)):esc(b.how)}</span></th>
        <td><select class="form-input" data-pj-prize="${b.id}" aria-label="Nagroda za: ${esc(b.name)}">
          <option value="">— bez nagrody —</option>${PJ_PRIZES.map(p=>`<option${preset===p?' selected':''}>${esc(p)}</option>`).join('')}<option value="__own"${preset==='__own'?' selected':''}>Własna…</option></select>
          ${preset==='__own'?`<input type="text" class="form-input" maxlength="80" data-pj-own="${b.id}" aria-label="Własna nagroda: ${esc(b.name)}" placeholder="np. trening w parze gratis" value="${esc(cur.prize)}">`:''}</td>
        <td>${b.earned&&cur.prize?`<label class="pj-given"><input type="checkbox" data-pj-given="${b.id}"${cur.given?' checked':''}> wręczona</label>`:''}</td></tr>`;
    };
    return `<section class="wu-card pj-card is-editing" id="pj-card" aria-labelledby="pj-t">
      <div class="wu-head"><h3 id="pj-t" class="cp-section-title" style="margin:0;">DROGA KLIENTA I NAGRODY</h3></div>
      <label class="wu-search"><span>Indywidualny cel ustalony z klientem (pojawi się na jego drodze)</span>
        <input type="text" class="form-input" maxlength="120" data-pj-goal placeholder="np. 10 pompek bez kolan, przysiad z 40 kg" value="${esc(st.goalText)}"></label>
      ${st.goalText?`<label class="pj-given"><input type="checkbox" data-pj-goal-done${st.goalDone?' checked':''}> cel osiągnięty</label>`:''}
      <p class="wu-sub">Nagrody pojawią się klientowi dopiero po zdobyciu odznaki. Odznaki liczą się same z zapisanych treningów — nie nagradzamy objętości ani treningu mimo bólu.</p>
      <div class="xp-prev-wrap"><table class="xp-prev pj-table"><thead><tr><th scope="col">Odznaka</th><th scope="col">Nagroda</th><th scope="col">Status</th></tr></thead><tbody>${badges.map(row).join('')}</tbody></table></div>
      ${st.error?`<p class="wu-err" role="alert">${esc(st.error)}</p>`:''}
      <div class="wu-actions"><button type="button" class="btn btn-ghost" data-act="pj-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="pj-save"${st.saving?' disabled':''}>${st.saving?'Zapisuję…':'Zapisz'}</button></div>
    </section>`;
  }
  function pjRender(c){
    const host=document.getElementById('pj-card');
    if(host)host.outerHTML=pjTrainerCardHTML(c);
    else{
      const anchor=document.getElementById('xp-card')||document.getElementById('wu-card');
      if(anchor)anchor.insertAdjacentHTML('afterend',pjTrainerCardHTML(c));
      else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',pjTrainerCardHTML(c));}
    }
    const st=pjState(c);if(!st)return;
    const card=document.getElementById('pj-card');
    card.querySelectorAll('[data-pj-prize]').forEach(el=>{el.onchange=()=>{const id=el.dataset.pjPrize;const r=st.rewards[id]||(st.rewards[id]={prize:'',given:false});
      if(el.value==='__own'){r.own=true;if(PJ_PRIZES.includes(r.prize))r.prize='';}else{r.own=false;r.prize=el.value;}
      pjRender(c);const again=document.querySelector(`#pj-card [data-pj-own="${id}"]`)||document.querySelector(`#pj-card [data-pj-prize="${id}"]`);if(again)again.focus();};});
    card.querySelectorAll('[data-pj-own]').forEach(el=>{el.oninput=()=>{const r=st.rewards[el.dataset.pjOwn];if(r)r.prize=el.value;};});
    card.querySelectorAll('[data-pj-given]').forEach(el=>{el.onchange=()=>{const r=st.rewards[el.dataset.pjGiven];if(r)r.given=el.checked;};});
    const g=card.querySelector('[data-pj-goal]');if(g)g.onchange=()=>{st.goalText=g.value.trim().slice(0,120);pjRender(c);};
    const gd=card.querySelector('[data-pj-goal-done]');if(gd)gd.onchange=()=>{st.goalDone=gd.checked;};
  }
  const cur=()=>clientById(window._pjEdit&&window._pjEdit.clientId);
  async function pjSave(){
    const st=window._pjEdit;const c=cur();if(!st||!c||st.saving)return;
    const g=document.querySelector('#pj-card [data-pj-goal]');if(g)st.goalText=g.value.trim().slice(0,120);
    const prevR=c.rewards,prevG=c.journeyGoal;
    const old=pjRewardsCfg(c);const now=today();
    const rewards={};
    Object.entries(st.rewards).forEach(([id,r])=>{const p=String(r.prize||'').trim().slice(0,80);if(!p)return;rewards[id]={prize:p,...(r.given?{givenAt:(old[id]&&old[id].givenAt)||now}:{})};});
    c.rewards=rewards;
    c.journeyGoal=st.goalText?{text:st.goalText,...(st.goalDone?{reachedAt:(prevG&&prevG.reachedAt)||now}:{})}:null;
    st.saving=true;st.error='';pjRender(c);
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.rewards=prevR;c.journeyGoal=prevG;st.saving=false;st.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';pjRender(c);return;}
    window._pjEdit=null;pjRender(c);
    if(typeof notify==='function')notify('Zapisano — klient zobaczy nagrodę po zdobyciu odznaki');
  }
  if(typeof uiAction==='function'){
    uiAction('pj-edit',dd=>{const c=clientById(dd.cid);if(!c)return;const cfg=pjRewardsCfg(c);const rewards={};
      Object.entries(cfg).forEach(([id,r])=>{rewards[id]={prize:r.prize,given:!!r.givenAt};});
      window._pjEdit={clientId:c.id,rewards,goalText:String(c.journeyGoal&&c.journeyGoal.text||''),goalDone:!!(c.journeyGoal&&c.journeyGoal.reachedAt)};pjRender(c);});
    uiAction('pj-cancel',()=>{const c=cur();window._pjEdit=null;if(c)pjRender(c);});
    uiAction('pj-save',()=>{pjSave();});
  }
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._pj){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)pjRender(c);}catch(e){}return r;};
    wrapped._pj=true;wrapped._xp=orig._xp;wrapped._wu=orig._wu;
    window.renderCPPlan=wrapped;
  }
  Object.assign(window,{PJ_BADGES,PJ_PRIZES,pjData,pjMilestones,pjJourneyHTML,pjBadges,pjBadgesHTML,pjRewardsCfg,pjTrainerCardHTML,pjSave});
})();
