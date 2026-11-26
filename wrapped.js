/* Progress Wrapped (3.0, etap 2d): podsumowanie współpracy — miesiąc, kwartał, rok — w stylu „Wrapped”.
 *
 * Klient (Postępy → karta „Podsumowanie miesiąca” → „Zobacz swoje podsumowanie”): okno z okresem do wyboru
 * (miesiąc / kwartał / rok; w pierwszych 5 dniach miesiąca domyślnie poprzedni miesiąc), liczbą treningów, czasem,
 * regularnością (tygodnie z treningiem), realizacją planu (treningi wobec celu tygodnia z planu), rekordami osobistymi,
 * największym postępem siłowym, etapami i odznakami zdobytymi w okresie (journey.js), wiadomością od trenera
 * i kolejnym celem. Wszystko liczone z zapisanych treningów (to samo źródło co Postępy).
 * „Zapisz jako grafikę” rysuje PNG 1080 × 1350 w barwach Team Progress (canvas, bez zewnętrznych bibliotek);
 * „Udostępnij” tylko gdy telefon to umożliwia (Web Share z plikiem) — zawsze dobrowolnie. Na grafice NIE MA masy ciała,
 * obwodów, zdjęć ani zgłoszeń bólu/samopoczucia.
 * Trener (profil klienta → Plan): wiadomość do podsumowania bieżącego (i poprzedniego) miesiąca + podgląd liczb.
 * Zapis: client.wrappedNotes = {'2026-11': 'tekst', …} (karta klienta, 24 ostatnie) — bez zmian reguł Firestore.
 */
(function(){
  'use strict';
  const esc=s=>typeof csEsc==='function'?csEsc(s):(typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const today=()=>typeof csToday==='function'?csToday():new Date().toISOString().slice(0,10);
  const plural=(n,a,b,c)=>typeof csPlural==='function'?csPlural(n,a,b,c):(n===1?a:(n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:c));
  const MONTHS=['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
  const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
  const ymdAdd=(ymd,n)=>{const d=new Date(ymd+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const monday=ymd=>{const d=new Date(ymd+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
  const lastDay=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
  const pad=n=>String(n).padStart(2,'0');
  const num=v=>typeof cpgNum==='function'?cpgNum(v):String(v).replace('.',',');

  /* ---------- Okresy ---------- */
  /** kind: month|quarter|year; ref: dowolny dzień w okresie. → {kind,key,label,from,to} */
  function pwPeriod(kind,ref){
    const [y,m]=String(ref||today()).split('-').map(Number);
    if(kind==='year')return {kind,key:String(y),label:'Rok '+y,from:y+'-01-01',to:y+'-12-31'};
    if(kind==='quarter'){const q=Math.floor((m-1)/3)+1,m1=(q-1)*3+1,m3=m1+2;return {kind,key:y+'-Q'+q,label:q+'. kwartał '+y,from:y+'-'+pad(m1)+'-01',to:y+'-'+pad(m3)+'-'+pad(lastDay(y,m3))};}
    return {kind:'month',key:y+'-'+pad(m),label:cap(MONTHS[m-1])+' '+y,from:y+'-'+pad(m)+'-01',to:y+'-'+pad(m)+'-'+pad(lastDay(y,m))};
  }
  /** Domyślny miesiąc: w pierwszych 5 dniach — poprzedni (jak podsumowanie w Postępach). */
  function pwDefaultRef(){
    const t=today();
    if(+t.slice(8,10)<=5){const d=new Date(t+'T12:00:00Z');d.setUTCDate(0);return d.toISOString().slice(0,10);}
    return t;
  }

  /* ---------- Liczby ---------- */
  function pwStats(c,p){
    const t=today();
    const end=p.to<t?p.to:t;
    const all=(typeof csDoneSessions==='function'?csDoneSessions(c):[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const list=all.filter(s=>{const d=String(s.date||'').slice(0,10);return d>=p.from&&d<=p.to;});
    const days=new Set(list.map(s=>String(s.date).slice(0,10))).size;
    const minutes=list.reduce((n,s)=>n+(parseInt(s.duration,10)||0),0);
    // Regularność: tygodnie (pn–nd) okresu do dziś, w których był co najmniej jeden trening.
    const weeks=[];if(p.from<=end){for(let w=monday(p.from);w<=end;w=ymdAdd(w,7))weeks.push(w);}
    const withT=new Set(list.map(s=>monday(String(s.date).slice(0,10))));
    const weeksOn=weeks.filter(w=>withT.has(w)).length;
    // Realizacja planu: treningi wobec celu tygodnia z planu (dni treningowe) w pełnych/rozpoczętych tygodniach okresu.
    let planPct=null;
    try{
      const plan=typeof capClientPlan==='function'?capClientPlan(c):null;
      const target=typeof csWeekTarget==='function'?csWeekTarget(c,plan):0;
      if(target&&weeks.length){const planned=target*weeks.length;planPct=Math.min(100,Math.round(100*days/planned));}
    }catch(e){}
    // Rekordy i największy postęp siłowy w okresie.
    let prs=[],best=null;
    try{
      const series=typeof csStrengthSeries==='function'?csStrengthSeries(c):{};
      Object.keys(series).forEach(n=>{
        let max=null;
        series[n].forEach(pt=>{if(max!=null&&pt.kg>max&&pt.date>=p.from&&pt.date<=p.to)prs.push({n,kg:pt.kg,date:pt.date});max=max==null?pt.kg:Math.max(max,pt.kg);});
        const inP=series[n].filter(pt=>pt.date>=p.from&&pt.date<=p.to);
        if(inP.length>=2){const g=inP[inP.length-1].kg-inP[0].kg;if(g>0&&(!best||g>best.g))best={n,g,from:inP[0].kg,to:inP[inP.length-1].kg};}
      });
    }catch(e){}
    const inP=x=>x&&x>=p.from&&x<=p.to;
    const milestones=typeof pjMilestones==='function'?pjMilestones(c).filter(m=>inP(m.at)).map(m=>m.title):[];
    const badges=typeof pjBadges==='function'?pjBadges(c).filter(b=>inP(b.at)).map(b=>b.name):[];
    const notes=c&&c.wrappedNotes||{};
    const trainerMsg=String(notes[p.key]||'').trim();
    let next='';
    if(c&&c.journeyGoal&&c.journeyGoal.text&&!c.journeyGoal.reachedAt)next=String(c.journeyGoal.text);
    else if(typeof pjMilestones==='function'){const n=pjMilestones(c).find(m=>!m.at);if(n)next=n.title+(n.of>1&&n.unit!=='dni'?' ('+n.progress+' z '+n.of+')':'');}
    return {period:p,workouts:days,minutes,weeks:weeks.length,weeksOn,planPct,prs,best,milestones,badges,trainerMsg,next,empty:!days};
  }
  function pwFacts(s){
    const out=[];
    out.push({big:String(s.workouts),label:plural(s.workouts,'trening','treningi','treningów')});
    if(s.minutes)out.push({big:s.minutes>=120?num(Math.round(s.minutes/6)/10)+' h':s.minutes+' min',label:'czasu aktywności'});
    if(s.weeks)out.push({big:s.weeksOn+' z '+s.weeks,label:plural(s.weeks,'tydzień','tygodnie','tygodni')+' z treningiem'});
    if(s.planPct!=null)out.push({big:s.planPct+'%',label:'realizacji planu'});
    if(s.prs.length)out.push({big:String(s.prs.length),label:plural(s.prs.length,'rekord osobisty','rekordy osobiste','rekordów osobistych')});
    return out;
  }
  function pwHighlights(s){
    const h=[];
    if(s.best)h.push('Największy postęp: '+s.best.n+' '+num(s.best.from)+' → '+num(s.best.to)+' kg');
    if(s.milestones.length)h.push('Etapy: '+s.milestones.join(', '));
    if(s.badges.length)h.push('Odznaki: '+s.badges.join(', '));
    return h;
  }

  /* ---------- Klient: przycisk i okno ---------- */
  function pwOpenBtnHTML(c){
    if(!c||!(typeof csDoneSessions==='function'&&csDoneSessions(c).length))return '';
    return `<button type="button" class="cs-btn cs-btn-secondary pw-open" data-pw-open onclick="pwOpen()">Zobacz swoje podsumowanie</button>`;
  }
  function pwSheetHTML(c,kind){
    const p=pwPeriod(kind,pwDefaultRef());
    const s=pwStats(c,p);
    const facts=pwFacts(s),hl=pwHighlights(s);
    const tabs=[['month','Miesiąc'],['quarter','Kwartał'],['year','Rok']];
    return `<div class="pv-gate pw-sheet" id="pw-sheet" role="dialog" aria-modal="true" aria-labelledby="pw-h">
      <div class="pv-gate-card pw-card">
        <div class="pw-tabs" role="group" aria-label="Okres">${tabs.map(([k,l])=>`<button type="button" class="cpg-chip${k===kind?' is-on':''}" aria-pressed="${k===kind?'true':'false'}" data-pw-kind="${k}" onclick="pwOpen('${k}')">${l}</button>`).join('')}</div>
        <div class="pw-hero"><span class="pw-brand">TEAM PROGRESS</span><h2 id="pw-h">${esc(p.label)}</h2></div>
        ${s.empty?`<p class="cs-ready-hint">W tym okresie nie ma jeszcze zapisanych treningów.</p>`:`
        <div class="pw-facts">${facts.map(f=>`<div class="pw-fact"><b>${esc(f.big)}</b><span>${esc(f.label)}</span></div>`).join('')}</div>
        ${hl.length?`<ul class="pw-hl">${hl.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}`}
        ${s.trainerMsg?`<blockquote class="pw-msg" data-pw-msg><span>Wiadomość od trenera</span>${esc(s.trainerMsg)}</blockquote>`:''}
        ${s.next?`<p class="pw-next"><span>Kolejny cel</span>${esc(s.next)}</p>`:''}
        ${s.empty?'':`<button type="button" class="cs-btn cs-btn-primary" data-pw-save onclick="pwSaveImage('${kind}')">Zapisz jako grafikę</button>
        ${typeof navigator!=='undefined'&&navigator.canShare?`<button type="button" class="cs-btn cs-btn-secondary" data-pw-share onclick="pwShare('${kind}')">Udostępnij</button>`:''}
        <p class="pw-note">Na grafice nie ma masy ciała, pomiarów ani zdjęć. Udostępnianie jest tylko Twoją decyzją.</p>`}
        <button type="button" class="cs-btn cs-btn-ghost" onclick="pwClose()">Zamknij</button>
      </div></div>`;
  }
  function pwOpen(kind){
    const c=clientById(window._clientId);if(!c)return;
    kind=['month','quarter','year'].includes(kind)?kind:'month';
    const had=document.getElementById('pw-sheet');
    if(!had)window._pwOpener=document.activeElement;
    if(had)had.remove();
    document.body.insertAdjacentHTML('beforeend',pwSheetHTML(c,kind));
    const el=document.getElementById('pw-sheet');
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();pwClose();}});
    const f=el.querySelector(`[data-pw-kind="${kind}"]`);if(f)f.focus();
  }
  function pwClose(){
    const el=document.getElementById('pw-sheet');if(el)el.remove();
    const o=window._pwOpener;window._pwOpener=null;if(o&&document.contains(o)&&o.focus)o.focus();
  }

  /* ---------- Grafika (canvas 1080 × 1350) ---------- */
  function pwWrap(ctx,text,maxW){
    const words=String(text).split(/\s+/);const lines=[];let line='';
    words.forEach(w=>{const t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){lines.push(line);line=w;}else line=t;});
    if(line)lines.push(line);return lines;
  }
  function pwDraw(c,kind){
    const p=pwPeriod(kind,pwDefaultRef());const s=pwStats(c,p);
    const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;
    const x=cv.getContext('2d');if(!x)return null;
    const RED='#C62828',INK='#20242B',MUTED='#667085',BG='#F4F5F7',CARD='#FFFFFF',LINE='#E1E4E8';
    const F='-apple-system, "Segoe UI", Inter, Roboto, Arial, sans-serif';
    x.fillStyle=BG;x.fillRect(0,0,1080,1350);
    x.fillStyle=CARD;x.beginPath();if(x.roundRect)x.roundRect(60,60,960,1230,40);else x.rect(60,60,960,1230);x.fill();
    x.fillStyle=RED;x.fillRect(60,60,960,14);
    x.fillStyle=RED;x.font='700 30px '+F;x.fillText('TEAM PROGRESS',120,150);
    x.fillStyle=INK;x.font='800 72px '+F;x.fillText(p.label,120,240);
    const first=String(c&&c.name||'').trim().split(/\s+/)[0]||'';
    x.fillStyle=MUTED;x.font='400 34px '+F;x.fillText(first?'Podsumowanie: '+first:'Twoje podsumowanie',120,295);
    // Liczby: siatka 2 kolumny
    const facts=pwFacts(s).slice(0,4);
    facts.forEach((f,i)=>{
      const cx=120+(i%2)*440,cy=360+Math.floor(i/2)*200;
      x.strokeStyle=LINE;x.lineWidth=2;x.beginPath();if(x.roundRect)x.roundRect(cx,cy,400,170,24);else x.rect(cx,cy,400,170);x.stroke();
      x.fillStyle=INK;x.font='800 64px '+F;x.fillText(f.big,cx+30,cy+85);
      x.fillStyle=MUTED;x.font='500 28px '+F;pwWrap(x,f.label,340).slice(0,2).forEach((l,j)=>x.fillText(l,cx+30,cy+125+j*32));
    });
    let y=360+Math.ceil(facts.length/2)*200+30;
    x.font='500 32px '+F;x.fillStyle=INK;
    pwHighlights(s).slice(0,3).forEach(h=>{pwWrap(x,'• '+h,840).slice(0,2).forEach(l=>{x.fillText(l,120,y);y+=44;});y+=6;});
    if(s.trainerMsg){
      y+=20;x.fillStyle=RED;x.fillRect(120,y,6,Math.min(220,30+pwWrap(x,s.trainerMsg,800).slice(0,4).length*44));
      x.fillStyle=MUTED;x.font='600 26px '+F;x.fillText('WIADOMOŚĆ OD TRENERA',146,y+28);
      x.fillStyle=INK;x.font='italic 400 32px '+F;pwWrap(x,'„'+s.trainerMsg+'”',800).slice(0,4).forEach((l,j)=>x.fillText(l,146,y+72+j*44));
      y+=72+Math.min(4,pwWrap(x,s.trainerMsg,800).length)*44;
    }
    if(s.next&&y<1160){x.fillStyle=MUTED;x.font='600 26px '+F;x.fillText('KOLEJNY CEL',120,y+40);x.fillStyle=INK;x.font='600 32px '+F;pwWrap(x,s.next,840).slice(0,2).forEach((l,j)=>x.fillText(l,120,y+84+j*42));}
    x.fillStyle=MUTED;x.font='500 26px '+F;x.fillText('Progress Live · teamprogress.pl',120,1240);
    return cv;
  }
  function pwBlob(c,kind){
    return new Promise(res=>{const cv=pwDraw(c,kind);if(!cv||!cv.toBlob)return res(null);cv.toBlob(b=>res(b),'image/png');});
  }
  function pwFileName(kind){const p=pwPeriod(kind,pwDefaultRef());return 'team-progress-podsumowanie-'+p.key.toLowerCase()+'.png';}
  async function pwSaveImage(kind){
    const c=clientById(window._clientId);if(!c)return;
    const b=await pwBlob(c,kind);
    if(!b){if(typeof notify==='function')notify('Nie udało się przygotować grafiki');return;}
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=pwFileName(kind);
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
    window._pwLast={kind,size:b.size,name:a.download};
    if(typeof notify==='function')notify('Grafika zapisana');
  }
  async function pwShare(kind){
    const c=clientById(window._clientId);if(!c)return;
    const b=await pwBlob(c,kind);if(!b)return;
    try{
      const file=new File([b],pwFileName(kind),{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:'Moje podsumowanie — Team Progress'});
      else pwSaveImage(kind);
    }catch(e){/* klient anulował udostępnianie */}
  }

  /* ---------- Trener: wiadomość do podsumowania ---------- */
  function pwTrainerCardHTML(c){
    const st=window._pwEdit&&window._pwEdit.clientId===c.id?window._pwEdit:null;
    const p=pwPeriod('month',today());
    const prev=pwPeriod('month',(()=>{const d=new Date(p.from+'T12:00:00Z');d.setUTCDate(0);return d.toISOString().slice(0,10);})());
    const notes=c.wrappedNotes||{};
    const s=pwStats(c,p);
    const nums=s.empty?'W tym miesiącu jeszcze bez treningów.':pwFacts(s).map(f=>f.big+' '+f.label).join(' · ');
    if(!st){
      return `<section class="wu-card pw-tcard" id="pw-card" aria-labelledby="pw-t">
        <div class="wu-head"><h3 id="pw-t" class="cp-section-title" style="margin:0;">PODSUMOWANIE MIESIĄCA (WRAPPED)</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="pw-edit" data-cid="${esc(c.id)}">${notes[p.key]?'Zmień wiadomość':'Dodaj wiadomość'}</button></div>
        <p class="wu-sub">${esc(p.label)}: ${esc(nums)}</p>
        ${notes[p.key]?`<p class="wu-sub">Twoja wiadomość: „${esc(notes[p.key])}”</p>`:'<p class="wu-sub">Klient widzi podsumowanie w Postępach. Dodaj krótką wiadomość — pojawi się w nim i na grafice.</p>'}
      </section>`;
    }
    return `<section class="wu-card pw-tcard is-editing" id="pw-card" aria-labelledby="pw-t">
      <div class="wu-head"><h3 id="pw-t" class="cp-section-title" style="margin:0;">PODSUMOWANIE MIESIĄCA — WIADOMOŚĆ TRENERA</h3></div>
      <p class="wu-sub">${esc(p.label)}: ${esc(nums)}</p>
      <label class="wu-search"><span>${esc(p.label)}</span><textarea class="form-input" rows="3" maxlength="400" data-pw-note="${p.key}" placeholder="np. Świetny miesiąc — 3 rekordy i pełna regularność. W grudniu skupiamy się na technice przysiadu.">${esc(st.notes[p.key]||'')}</textarea></label>
      <label class="wu-search"><span>${esc(prev.label)} (poprzedni)</span><textarea class="form-input" rows="2" maxlength="400" data-pw-note="${prev.key}">${esc(st.notes[prev.key]||'')}</textarea></label>
      ${st.error?`<p class="wu-err" role="alert">${esc(st.error)}</p>`:''}
      <div class="wu-actions"><button type="button" class="btn btn-ghost" data-act="pw-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="pw-save"${st.saving?' disabled':''}>${st.saving?'Zapisuję…':'Zapisz'}</button></div>
    </section>`;
  }
  function pwRender(c){
    const host=document.getElementById('pw-card');
    if(host)host.outerHTML=pwTrainerCardHTML(c);
    else{
      const anchor=document.getElementById('pj-card')||document.getElementById('xp-card')||document.getElementById('wu-card');
      if(anchor)anchor.insertAdjacentHTML('afterend',pwTrainerCardHTML(c));
      else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',pwTrainerCardHTML(c));}
    }
    document.querySelectorAll('#pw-card [data-pw-note]').forEach(t=>{t.oninput=()=>{const st=window._pwEdit;if(st)st.notes[t.dataset.pwNote]=t.value;};});
  }
  const cur=()=>clientById(window._pwEdit&&window._pwEdit.clientId);
  async function pwSaveNotes(){
    const st=window._pwEdit;const c=cur();if(!st||!c||st.saving)return;
    const prev=c.wrappedNotes;
    const merged={...(prev||{})};
    Object.entries(st.notes).forEach(([k,v])=>{const t=String(v||'').trim().slice(0,400);if(t)merged[k]=t;else delete merged[k];});
    const keys=Object.keys(merged).sort().slice(-24);const out={};keys.forEach(k=>{out[k]=merged[k];});
    c.wrappedNotes=out;
    st.saving=true;st.error='';pwRender(c);
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.wrappedNotes=prev;st.saving=false;st.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';pwRender(c);return;}
    window._pwEdit=null;pwRender(c);
    if(typeof notify==='function')notify('Wiadomość zapisana — klient zobaczy ją w podsumowaniu');
  }
  if(typeof uiAction==='function'){
    uiAction('pw-edit',d=>{const c=clientById(d.cid);if(!c)return;window._pwEdit={clientId:c.id,notes:{...(c.wrappedNotes||{})}};pwRender(c);});
    uiAction('pw-cancel',()=>{const c=cur();window._pwEdit=null;if(c)pwRender(c);});
    uiAction('pw-save',()=>{pwSaveNotes();});
  }
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._pw){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)pwRender(c);}catch(e){}return r;};
    wrapped._pw=true;wrapped._pj=orig._pj;wrapped._xp=orig._xp;wrapped._wu=orig._wu;
    window.renderCPPlan=wrapped;
  }
  Object.assign(window,{pwPeriod,pwDefaultRef,pwStats,pwFacts,pwHighlights,pwOpenBtnHTML,pwSheetHTML,pwOpen,pwClose,pwDraw,pwSaveImage,pwShare,pwTrainerCardHTML,pwSaveNotes});
})();
