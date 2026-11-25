/* Postępy 2.0 (aplikacja klienta live): jeden ekran zamiast „Postępy” + „Więcej statystyk”.
 * Zakres 30 dni / 90 dni / cały okres, podsumowanie miesiąca, osiągnięcia, cel tygodnia z planu, kalendarz regularności,
 * postęp siłowy, jedna lista rekordów (z szacowanym 1RM tylko do 10 powtórzeń), trendy masy ciała i obwodów, zdjęcia przed / po.
 * Dane wyłącznie z zapisów klienta (bez przykładów). Ładowany po client-simple.js — używa jego pomocników (cs*). */
'use strict';

Object.assign(CS_ICONS,{
  trophy:'<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  scale:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8.5a5 5 0 0 1 8 0l-3 3.5"/>',
  ruler:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  summary:'<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>'
});

const CPG_RANGES=[['30','30 dni'],['90','90 dni'],['all','Cały okres']];
const CPG_MONTHS=['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
const CPG_MONTHS_GEN=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];

/* ── Formaty po polsku ── */
/** Data: „20 listopada” (rok tylko, gdy inny niż bieżący). */
function cpgDate(ymd){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd||''));if(!m)return '';
  const y=+m[1],mo=+m[2]-1,d=+m[3];
  return d+' '+CPG_MONTHS_GEN[mo]+(String(y)!==csToday().slice(0,4)?' '+y:'');
}
/** Krótko do osi wykresu: „20.11”. */
function cpgDateShort(ymd){const m=/^\d{4}-(\d{2})-(\d{2})/.exec(String(ymd||''));return m?(+m[2])+'.'+m[1]:'';}
/** Liczba: przecinek dziesiętny, spacja tysięcy (1 250,5). */
function cpgNum(v,dec){
  const n=typeof v==='number'?v:Number.parseFloat(String(v==null?'':v).replace(',','.'));
  if(!Number.isFinite(n))return '—';
  const r=dec==null?Math.round(n*10)/10:Number(n.toFixed(dec));
  return r.toLocaleString('pl-PL',{maximumFractionDigits:dec==null?1:dec,minimumFractionDigits:0}).replace(/ /g,' ');
}
/** Zmiana ze znakiem i prawdziwym minusem: „+2,5”, „−1,6”. */
function cpgSigned(v,dec){return (v>0?'+':v<0?'−':'')+cpgNum(Math.abs(v),dec);}

/* ── 1RM: szacunek tylko dla 1–10 powtórzeń (średnia wzorów Epleya i Brzyckiego); powyżej 10 powt. wzory są zbyt niedokładne. ── */
function estimate1RM(kg,reps){
  const w=Number.parseFloat(String(kg==null?'':kg).replace(',','.')),r=Number.parseFloat(String(reps==null?'':reps).replace(',','.'));
  if(!Number.isFinite(w)||w<=0||!Number.isFinite(r)||r<1)return null;
  if(r===1)return w;
  if(r>10)return null;
  const epley=w*(1+r/30),brzycki=w*36/(37-r);
  return (epley+brzycki)/2;
}
window.estimate1RM=estimate1RM;

/* ── Zakres ── */
function cpgRange(){
  if(window._cpgRange)return window._cpgRange;
  try{const v=sessionStorage.getItem('pl_cs_prog_range');if(v&&CPG_RANGES.some(r=>r[0]===v))return (window._cpgRange=v);}catch(e){}
  return (window._cpgRange='90');
}
function cpgSetRange(v){
  if(!CPG_RANGES.some(r=>r[0]===v))return;
  window._cpgRange=v;try{sessionStorage.setItem('pl_cs_prog_range',v);}catch(e){}
  setClientLiveScreen('progress');
}
function cpgFrom(range){return range==='all'?'':csAddDays(csToday(),-(Number(range)-1));}
function cpgInRange(ymd,from){const d=String(ymd||'').slice(0,10);return !!d&&(!from||d>=from)&&d<=csToday();}

/* ── Dane ── */
function cpgSessions(c){return csDoneSessions(c).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
function cpgWorkSets(ex){
  const list=typeof exerciseLoggedSets==='function'?exerciseLoggedSets(ex):(Array.isArray(ex&&ex.sets)?ex.sets:[]);
  return (list||[]).filter(x=>x&&x.kind!=='warmup'&&x.done!==false);
}
function cpgSetCount(s){return (s.exercises||[]).filter(e=>e&&!e.skipped).reduce((n,e)=>n+cpgWorkSets(e).length,0);}
function cpgVolume(s){
  if(Number(s.volume)>0)return Number(s.volume);
  return (s.exercises||[]).reduce((t,e)=>{if(e.loadUnit&&e.loadUnit!=='kg')return t;return t+cpgWorkSets(e).reduce((u,x)=>u+csKgNum(x.kg)*csKgNum(x.reps),0);},0);
}
/** Rekordy: najcięższa seria (przy równym ciężarze więcej powtórzeń) każdego ćwiczenia z ciężarem, z całej historii. */
function cpgRecords(c){
  const series=csStrengthSeries(c);
  return Object.keys(series).map(name=>{
    const pts=series[name];let best=pts[0],bestIdx=0;
    pts.forEach((p,i)=>{if(p.kg>best.kg||(p.kg===best.kg&&p.reps>best.reps)){best=p;bestIdx=i;}});
    const beforeMax=pts.slice(0,bestIdx).reduce((m,p)=>Math.max(m,p.kg),0);
    return {name,n:pts.length,best,isNew:bestIdx>0&&best.kg>beforeMax,est:estimate1RM(best.kg,best.reps)};
  }).sort((a,b)=>b.n-a.n||b.best.kg-a.best.kg);
}
function cpgMetricSeries(c,groupId,metricId,from){
  return (window.METRIC_ENTRIES||[]).filter(e=>e&&e.clientId===c.id&&e.groupId===groupId&&e.values&&e.values[metricId]!=null&&e.values[metricId]!==''&&cpgInRange(e.date,from))
    .map(e=>({date:String(e.date).slice(0,10),v:Number.parseFloat(String(e.values[metricId]).replace(',','.'))}))
    .filter(p=>Number.isFinite(p.v)&&p.v>0).sort((a,b)=>a.date.localeCompare(b.date));
}

/* ── Osiągnięcia: krótkie, prawdziwe, z ostatnich 14 dni ── */
function cpgAchievements(c,sessions,records){
  const out=[];const since=csAddDays(csToday(),-13);
  const fresh=records.filter(r=>r.isNew&&r.best.date>=since).sort((a,b)=>b.best.date.localeCompare(a.best.date));
  if(fresh.length)out.push({ico:'trophy',text:`Nowy rekord: ${fresh[0].name} — ${cpgNum(fresh[0].best.kg)} kg × ${fresh[0].best.reps}`,sub:cpgDate(fresh[0].best.date)+(fresh.length>1?` · i ${fresh.length-1} ${csPlural(fresh.length-1,'inny rekord','inne rekordy','innych rekordów')} w ostatnich 2 tygodniach`:'')});
  const total=sessions.length;
  const mile=[10,25,50,75,100,150,200,300].filter(m=>total>=m).pop();
  if(mile&&sessions[mile-1]&&sessions[mile-1].date>=since)out.push({ico:'star',text:`To już ${mile} ${csPlural(mile,'trening','treningi','treningów')} za Tobą!`,sub:'Regularność robi wynik.'});
  const weeks=csWeeksInRow(c);
  if(weeks>=4)out.push({ico:'calendar',text:`${weeks} ${csPlural(weeks,'tydzień','tygodnie','tygodni')} z rzędu z treningiem`,sub:'Najtrudniejsze już za Tobą — nawyk działa.'});
  const plan=typeof capClientPlan==='function'?capClientPlan(c):null;
  const target=csWeekTarget(c,plan),done=csWeekDone(c);
  if(target&&done>=target)out.push({ico:'check',text:'Plan tygodnia wykonany',sub:`${done} z ${target} treningów w tym tygodniu.`});
  return out.slice(0,2);
}

/* ── Podsumowanie miesiąca (bieżący; w pierwszych 5 dniach także poprzedni) ── */
function cpgMonthSummary(c,sessions,ym){
  const list=sessions.filter(s=>String(s.date).slice(0,7)===ym);
  const [y,m]=ym.split('-').map(Number);
  const name=CPG_MONTHS[m-1]+(String(y)!==csToday().slice(0,4)?' '+y:'');
  if(!list.length)return {name,empty:true};
  const sets=list.reduce((n,s)=>n+cpgSetCount(s),0);
  const vol=list.reduce((n,s)=>n+cpgVolume(s),0);
  const mins=list.reduce((n,s)=>n+(parseInt(s.duration,10)||0),0);
  // Największy postęp w miesiącu: różnica najcięższej serii między pierwszym a ostatnim treningiem z tym ćwiczeniem.
  const series=csStrengthSeries(c);let bestGain=null;
  Object.keys(series).forEach(n=>{const pts=series[n].filter(p=>p.date.slice(0,7)===ym);if(pts.length<2)return;const g=pts[pts.length-1].kg-pts[0].kg;if(g>0&&(!bestGain||g>bestGain.g))bestGain={n,g};});
  const days=new Set(list.map(s=>String(s.date).slice(0,10))).size;
  return {name,empty:false,days,sets,vol,mins,bestGain};
}
function cpgSummaryHTML(c,sessions){
  const today=csToday(),ym=today.slice(0,7);
  const months=[ym];
  if(+today.slice(8,10)<=5){const d=new Date(today+'T12:00:00');d.setDate(0);months.push(csYmd(d).slice(0,7));}
  const cards=months.map((k,i)=>{
    const s=cpgMonthSummary(c,sessions,k);
    if(s.empty)return i===0&&months.length===1?`<p class="cpg-sum-line">W tym miesiącu jeszcze bez treningu — pierwszy zacznie podsumowanie.</p>`:'';
    const facts=[`${s.days} ${csPlural(s.days,'trening','treningi','treningów')}`,s.sets?`${s.sets} ${csPlural(s.sets,'seria','serie','serii')}`:'',s.vol>=1000?`${cpgNum(s.vol/1000)} t podniesione`:s.vol>0?`${cpgNum(Math.round(s.vol),0)} kg podniesione`:'',s.mins?`${cpgNum(s.mins,0)} min`:''].filter(Boolean);
    return `<div class="cpg-sum-month"><b>${csEsc(s.name.charAt(0).toUpperCase()+s.name.slice(1))}${i===0?'':' (poprzedni)'}</b>
      <p class="cpg-sum-line">${csEsc(facts.join(' · '))}</p>
      ${s.bestGain?`<p class="cpg-sum-line is-up">Największy postęp: ${csEsc(s.bestGain.n)} ${csEsc(cpgSigned(s.bestGain.g))} kg</p>`:''}</div>`;
  }).join('');
  return `<section class="cpg-card cpg-summary" data-cpg-summary><h2 class="cpg-h">${csIcon('summary',18)}Podsumowanie miesiąca</h2>${cards}</section>`;
}

/* ── Kalendarz regularności: tygodnie w kolumnach, dni (pn–nd) w wierszach ── */
function cpgCalendarHTML(c,sessions,range){
  const weeksN=range==='30'?5:range==='90'?13:Math.min(26,Math.max(13,Math.ceil(((new Date(csToday()+'T12:00:00'))-(new Date((sessions[0]&&sessions[0].date||csToday())+'T12:00:00')))/604800000)+1));
  const done=new Set(sessions.map(s=>String(s.date).slice(0,10)));
  const lastMon=csMonday(csToday()),firstMon=csAddDays(lastMon,-7*(weeksN-1));
  const today=csToday();
  let cells='',count=0,activeWeeks=0;
  for(let w=0;w<weeksN;w++){
    const mon=csAddDays(firstMon,7*w);let wk=0;
    for(let d=0;d<7;d++){
      const day=csAddDays(mon,d),on=done.has(day),fut=day>today;
      if(on){count++;wk++;}
      cells+=`<span class="cpg-cal-d${on?' is-on':''}${fut?' is-fut':''}${day===today?' is-today':''}" style="grid-column:${w+1};grid-row:${d+1}" title="${csEsc(cpgDate(day)+(on?' — trening':''))}"></span>`;
    }
    if(wk)activeWeeks++;
  }
  const label=`Kalendarz regularności: ${count} ${csPlural(count,'dzień','dni','dni')} z treningiem w ${weeksN} ${csPlural(weeksN,'tygodniu','tygodniach','tygodniach')}, ${activeWeeks} ${csPlural(activeWeeks,'tydzień','tygodnie','tygodni')} z co najmniej jednym treningiem.`;
  return `<section class="cpg-card" data-cpg-calendar><h2 class="cpg-h">${csIcon('calendar',18)}Regularność</h2>
    <p class="cpg-sub">${activeWeeks} z ${weeksN} ${csPlural(weeksN,'tygodnia','tygodni','tygodni')} z treningiem · ${count} ${csPlural(count,'trening','treningi','treningów')}</p>
    <div class="cpg-cal" role="img" aria-label="${csEsc(label)}" style="grid-template-columns:repeat(${weeksN},minmax(0,1fr))">${cells}</div>
    <div class="cpg-cal-foot" aria-hidden="true"><span>${csEsc(cpgDate(firstMon))}</span><span class="cpg-cal-key"><i class="cpg-cal-d"></i>bez treningu <i class="cpg-cal-d is-on"></i>trening</span></div>
  </section>`;
}

/* ── Wykres linii (siła, masa ciała) ── */
function cpgLineSVG(pts,unit,label){
  const P=pts.slice(-12),W=320,H=140,L=36,R=12,T=12,B=24;
  const vals=P.map(p=>p.v);let lo=Math.min(...vals),hi=Math.max(...vals);
  if(hi===lo){lo=lo-2;hi=hi+2;}const pad=(hi-lo)*0.15;lo=Math.max(0,lo-pad);hi=hi+pad;
  const x=i=>L+(P.length===1?(W-L-R)/2:i*(W-L-R)/(P.length-1)),y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  const line=P.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
  const ticks=[hi,(hi+lo)/2,lo].map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="cs-ch-grid"/><text x="${L-6}" y="${(y(v)+4).toFixed(1)}" text-anchor="end" class="cs-ch-ax">${csEsc(cpgNum(v,hi-lo<6?1:0))}</text>`).join('');
  const dots=P.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i===P.length-1?5:3.5}" class="cs-ch-dot${i===P.length-1?' is-last':''}"/>`).join('');
  const labels=P.map((p,i)=>(i===0||i===P.length-1)?`<text x="${x(i).toFixed(1)}" y="${H-6}" text-anchor="${i===0?'start':'end'}" class="cs-ch-ax">${csEsc(cpgDateShort(p.date))}</text>`:'').join('');
  const aria=label+': '+P.map(p=>cpgDate(p.date)+' '+cpgNum(p.v)+' '+unit).join(', ');
  return `<svg class="cs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${csEsc(aria)}">${ticks}<path d="${line}" class="cs-ch-line"/>${dots}${labels}</svg>`;
}

/* ── Siła: wybór ćwiczenia (4 najczęściej robione w zakresie) ── */
function cpgSetEx(name){window._cpgEx=name;setClientLiveScreen('progress');}
function cpgStrengthHTML(c,from){
  const series=csStrengthSeries(c);
  const list=Object.keys(series).map(n=>({name:n,pts:series[n].filter(p=>cpgInRange(p.date,from))})).filter(x=>x.pts.length>=2)
    .sort((a,b)=>b.pts.length-a.pts.length||((b.pts[b.pts.length-1].kg-b.pts[0].kg)-(a.pts[a.pts.length-1].kg-a.pts[0].kg)));
  if(!list.length)return `<section class="cpg-card" data-cs-strength><h2 class="cpg-h">${csIcon('progress',18)}Postęp siłowy</h2><p class="cpg-sub">Po 2 treningach z tym samym ćwiczeniem w wybranym okresie zobaczysz tu, jak rośnie Twój ciężar.</p></section>`;
  const top=list.slice(0,4);
  const pick=top.find(x=>x.name===window._cpgEx)||top[0];
  const a=pick.pts[0],z=pick.pts[pick.pts.length-1],d=z.kg-a.kg;
  const msg=d>0?`${cpgSigned(d)} kg od ${cpgDate(a.date)}`:d===0?(z.reps>a.reps?`+${z.reps-a.reps} powt. przy tym samym ciężarze od ${cpgDate(a.date)}`:z.reps<a.reps?'Ten sam ciężar, mniej powtórzeń — trener dobierze obciążenie':'Ciężar stabilny — dobra baza do kolejnego kroku'):'Lżej niż na początku okresu — trener dobierze ciężar';
  const chips=top.length>1?`<div class="cpg-chips" role="group" aria-label="Ćwiczenie na wykresie">${top.map(x=>`<button type="button" class="cpg-chip${x===pick?' is-on':''}" aria-pressed="${x===pick?'true':'false'}" data-cpg-ex="${csEsc(x.name)}">${csEsc(x.name)}</button>`).join('')}</div>`:'';
  return `<section class="cpg-card cs-strength" data-cs-strength><h2 class="cpg-h">${csIcon('progress',18)}Postęp siłowy</h2>
    ${chips||`<b class="cs-strength-name">${csEsc(pick.name)}</b>`}
    <span class="cpg-big" data-cpg-strength-big>${d===0&&z.reps!==a.reps?`${a.reps} → ${z.reps} powt. <small>(${csEsc(cpgNum(z.kg))} kg)</small>`:`${csEsc(cpgNum(a.kg))} → ${csEsc(cpgNum(z.kg))} kg`}</span>
    <span class="cpg-sub${d>0||(d===0&&z.reps>a.reps)?' is-up':''}" data-cs-strength-delta>${csEsc(msg)}</span>
    ${cpgLineSVG(pick.pts.map(p=>({date:p.date,v:p.kg})),'kg','Najcięższa seria w kolejnych treningach')}
  </section>`;
}

/* ── Rekordy: jedna lista, bez pasków; szac. 1RM tylko do 10 powt. ── */
function cpgRecordsHTML(records){
  if(!records.length)return `<section class="cpg-card" data-cpg-records><h2 class="cpg-h">${csIcon('trophy',18)}Rekordy</h2><p class="cpg-sub">Po zapisanych seriach z ciężarem pojawią się tu Twoje najlepsze wyniki.</p></section>`;
  const all=!!window._cpgAllRecs,shown=all?records:records.slice(0,5);
  return `<section class="cpg-card cs-records" data-cpg-records data-cs-records><h2 class="cpg-h">${csIcon('trophy',18)}Rekordy</h2>
    <ul class="cpg-recs">${shown.map(r=>`<li><button type="button" class="cpg-rec" data-cpg-rec="${csEsc(r.name)}">
      <span class="cpg-rec-main"><span class="cpg-rec-name">${csEsc(r.name)}${r.isNew&&r.best.date>=csAddDays(csToday(),-13)?' <em class="cpg-new">nowy</em>':''}</span>
      <span class="cpg-rec-sub">${csEsc(cpgDate(r.best.date))}${r.est&&r.best.reps>1?' · szac. 1RM ok. '+csEsc(cpgNum(Math.round(r.est*2)/2))+' kg':''}</span></span>
      <b class="cpg-rec-val">${csEsc(cpgNum(r.best.kg))} kg × ${csEsc(String(r.best.reps))}</b></button></li>`).join('')}</ul>
    ${records.length>5?`<button type="button" class="cs-link cpg-more" data-cpg-allrecs>${all?'Pokaż mniej':'Pokaż wszystkie ('+records.length+')'}</button>`:''}
  </section>`;
}

/* ── Ciało: masa (gdy trener ją pokazuje) i obwody ── */
function cpgBodyHTML(c,from){
  if(typeof bmFeatureOn==='function'&&!bmFeatureOn(c))return '';
  let out='';
  if(csBodyWeightOn()){
    let pts=cpgMetricSeries(c,'mg1','m1',from);
    if(!pts.length){const allPts=cpgMetricSeries(c,'mg1','m1','');if(allPts.length)pts=[allPts[allPts.length-1]];}
    if(pts.length>=2){
      const d=Math.round((pts[pts.length-1].v-pts[0].v)*10)/10;
      out+=`<section class="cpg-card" data-cpg-weight><h2 class="cpg-h">${csIcon('scale',18)}Masa ciała</h2>
        <span class="cpg-big">${csEsc(cpgNum(pts[pts.length-1].v))} kg</span>
        <span class="cpg-sub">${d?csEsc(cpgSigned(d))+' kg od '+csEsc(cpgDate(pts[0].date)):'Bez zmian od '+csEsc(cpgDate(pts[0].date))}</span>
        ${cpgLineSVG(pts,'kg','Masa ciała')}</section>`;
    }else if(pts.length===1){
      out+=`<section class="cpg-card" data-cpg-weight><h2 class="cpg-h">${csIcon('scale',18)}Masa ciała</h2><span class="cpg-big">${csEsc(cpgNum(pts[0].v))} kg</span><span class="cpg-sub">${csEsc(cpgDate(pts[0].date))} · trend pojawi się po kolejnym pomiarze</span></section>`;
    }
  }
  const defs=typeof circMetricDefs==='function'?circMetricDefs():[];
  const rows=(defs.length?defs:[{id:'m1',name:'Klatka'},{id:'m2',name:'Talia'},{id:'m3',name:'Biodra'},{id:'m4',name:'Udo'},{id:'m5',name:'Ramię'}]).map(m=>{
    const pts=cpgMetricSeries(c,'mg2',m.id,from);if(!pts.length)return '';
    const last=pts[pts.length-1],d=pts.length>1?Math.round((last.v-pts[0].v)*10)/10:null;
    const nm=String(m.name||m.id);
    return `<li><span>${csEsc(nm.charAt(0).toUpperCase()+nm.slice(1))}</span><b>${csEsc(cpgNum(last.v))} cm</b><span class="cpg-delta">${d==null?'1 pomiar':d===0?'bez zmian':csEsc(cpgSigned(d))+' cm'}</span></li>`;
  }).filter(Boolean);
  if(rows.length){
    const dates=(window.METRIC_ENTRIES||[]).filter(e=>e&&e.clientId===c.id&&e.groupId==='mg2'&&cpgInRange(e.date,from)).map(e=>String(e.date).slice(0,10)).sort();
    out+=`<section class="cpg-card" data-cpg-circ><h2 class="cpg-h">${csIcon('ruler',18)}Obwody</h2>
      <p class="cpg-sub">${dates.length>1?'Zmiana od '+csEsc(cpgDate(dates[0]))+' do '+csEsc(cpgDate(dates[dates.length-1])):'Pomiar z '+csEsc(cpgDate(dates[0]))}</p>
      <ul class="cpg-circ">${rows.join('')}</ul></section>`;
  }
  return out;
}

/* ── Zdjęcia: przed i po (pierwsze w okresie vs ostatnie) ── */
function cpgSetPhotoView(v){window._cpgPhotoView=v;setClientLiveScreen('progress');}
function cpgPhotosHTML(c,from){
  if(typeof ppFeatureOn==='function'&&!ppFeatureOn(c))return '';
  if(typeof privacyHealthAllowed==='function'&&!privacyHealthAllowed(c))return `<section class="cpg-card" data-cpg-photos><h2 class="cpg-h">${csIcon('image',18)}Zdjęcia przed i po</h2><p class="cpg-sub">Zdjęcia sylwetki wymagają zgody na dane o zdrowiu. Możesz ją włączyć w Profilu (Trener → Profil → Prywatność).</p></section>`;
  const all=typeof ppListFor==='function'?ppListFor(c.id):[];
  const inR=all.filter(p=>cpgInRange(p.date,from));
  const views=[['front','Przód'],['side','Bok'],['back','Tył']];
  const view=views.some(v=>v[0]===window._cpgPhotoView)?window._cpgPhotoView:'front';
  const withView=(inR.length>=2?inR:all).filter(p=>p.photos&&p.photos[view]);
  const before=withView[0],after=withView[withView.length-1];
  const add=`<button type="button" class="cs-btn cs-btn-secondary cpg-photo-add" onclick="ppOpenDraft()">${csIcon('camera',18)}Dodaj zdjęcia</button>`;
  const draft=window._ppDraft&&window._ppDraft.open&&typeof ppBlockHTML==='function'?`<div class="cpg-photo-draft">${ppBlockHTML(c,{live:true})}</div>`:'';
  if(!before||!after||before===after){
    return `<section class="cpg-card" data-cpg-photos><h2 class="cpg-h">${csIcon('image',18)}Zdjęcia przed i po</h2>
      <p class="cpg-sub">${all.length?'Do porównania potrzebne są co najmniej 2 zestawy zdjęć.':'Zrób zdjęcia teraz i co 4 tygodnie w tym samym świetle i miejscu — zmiana będzie widoczna obok siebie.'} Zdjęcia widzisz tylko Ty i Twój trener.</p>
      ${add}${draft}</section>`;
  }
  const img=(p,lbl)=>`<figure class="cpg-ph"><img src="${csEsc(p.photos[view])}" alt="${csEsc(lbl+', '+cpgDate(p.date))}" loading="lazy"><figcaption><b>${csEsc(lbl)}</b> ${csEsc(cpgDate(p.date))}${p.weight?' · '+csEsc(cpgNum(p.weight))+' kg':''}</figcaption></figure>`;
  return `<section class="cpg-card" data-cpg-photos><h2 class="cpg-h">${csIcon('image',18)}Zdjęcia przed i po</h2>
    <div class="cpg-chips" role="group" aria-label="Ujęcie">${views.map(v=>`<button type="button" class="cpg-chip${v[0]===view?' is-on':''}" aria-pressed="${v[0]===view?'true':'false'}" onclick="cpgSetPhotoView('${v[0]}')">${v[1]}</button>`).join('')}</div>
    <div class="cpg-ph-pair">${img(before,'Przed')}${img(after,'Teraz')}</div>
    ${add}${draft}</section>`;
}

/* ── Historia i dodatkowe dane (zwinięte) ── */
function cpgHistoryHTML(sessions){
  const list=sessions.slice().reverse().slice(0,20);
  if(!list.length)return `<p class="cpg-sub">Brak zapisanych treningów. Po skończonym treningu pojawi się tutaj.</p>`;
  return `<ul class="cpg-hist">${list.map(s=>{const sets=cpgSetCount(s);const n=(s.exercises||[]).filter(e=>!e.skipped).length;
    return `<li><button type="button" class="cpg-hist-row" data-act="session-open" data-session-id="${csEsc(s.id)}">
      <span class="cpg-rec-main"><span class="cpg-rec-name">${csEsc(s.type||s.title||'Trening')}</span>
      <span class="cpg-rec-sub">${csEsc(cpgDate(s.date))}${s.duration?' · '+csEsc(cpgNum(s.duration,0))+' min':''}${n?' · '+n+' '+csPlural(n,'ćwiczenie','ćwiczenia','ćwiczeń'):''}${sets?' · '+sets+' '+csPlural(sets,'seria','serie','serii'):''}</span></span>
      <span class="cs-row-chev">${csIcon('chevron',18)}</span></button></li>`;}).join('')}</ul>`;
}
/** Zadania domowe (trening w domu): data, czas, RPE — osobno od treningów z planu. */
function cpgHomeworkHTML(c){
  const list=(window.SE||[]).filter(s=>s&&s.clientId===c.id&&s.source==='homework'&&s.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
  if(!list.length)return '';
  return `<div class="cpg-sub-h">Zadania domowe</div><ul class="cpg-hist">${list.map(s=>`<li><div class="cpg-hist-row is-static"><span class="cpg-rec-main"><span class="cpg-rec-name">${csEsc(s.type||s.title||'Zadanie domowe')}</span>
    <span class="cpg-rec-sub">${csEsc(cpgDate(s.date))}${s.duration?' · '+csEsc(cpgNum(s.duration,0))+' min':''}${s.rpe?' · RPE '+csEsc(String(s.rpe)):''}</span></span></div></li>`).join('')}</ul>`;
}
function cpgWeeklyKgHTML(sessions){
  const weeks=[];const mon=csMonday(csToday());
  for(let i=7;i>=0;i--){const m=csAddDays(mon,-7*i),e=csAddDays(m,6);weeks.push({l:cpgDateShort(m),v:Math.round(sessions.filter(s=>s.date>=m&&s.date<=e).reduce((t,s)=>t+cpgVolume(s),0))});}
  const max=Math.max(1,...weeks.map(w=>w.v));
  if(!weeks.some(w=>w.v))return '';
  return `<div class="cpg-sub-h">Kilogramy w tygodniu (ostatnie 8 tygodni)</div>
    <div class="cpg-bars" role="img" aria-label="${csEsc('Kilogramy w tygodniu: '+weeks.map(w=>'od '+w.l+' '+cpgNum(w.v,0)+' kg').join(', '))}">${weeks.map(w=>`<span class="cpg-bar"><i style="height:${Math.round(w.v/max*100)}%"></i><em>${csEsc(w.l)}</em></span>`).join('')}</div>`;
}

/* ── Ekran ── */
function cpgProgressHTML(c){
  const range=cpgRange(),from=cpgFrom(range);
  const sessions=cpgSessions(c);
  const inR=sessions.filter(s=>cpgInRange(s.date,from));
  const records=cpgRecords(c);
  const plan=typeof capClientPlan==='function'?capClientPlan(c):null;
  const target=csWeekTarget(c,plan),weekDone=csWeekDone(c);
  const weeks=csWeeksInRow(c);
  const days=new Set(inR.map(s=>String(s.date).slice(0,10))).size;
  const vol=inR.reduce((t,s)=>t+cpgVolume(s),0);
  const ach=cpgAchievements(c,sessions,records);
  const seg=target?Array.from({length:target},(_,i)=>`<span class="${i<weekDone?'is-on':''}"></span>`).join(''):'';
  const rangeLbl=(CPG_RANGES.find(r=>r[0]===range)||CPG_RANGES[1])[1];
  return `<div class="cs-screen cpg"><h1 class="cs-h1 cs-h1-page">Postępy</h1>
    <section class="cpg-goal" data-cpg-goal aria-label="Cel tygodnia">
      <p class="cs-motivation cpg-goal-txt">${csEsc(csMotivation(c))}</p>
      ${target?`<div class="cpg-goal-row"><span class="cpg-goal-segs" aria-hidden="true">${seg}</span><b>${Math.min(weekDone,target)} z ${target}</b></div><p class="cpg-goal-src">${plan?'Cel z Twojego planu: '+target+' '+csPlural(target,'trening','treningi','treningów')+' w tygodniu':'Cel z Twojego harmonogramu'}</p>`:''}
    </section>
    ${ach.length?`<section class="cpg-ach" data-cpg-ach aria-label="Osiągnięcia">${ach.map(a=>`<div class="cpg-ach-item"><span class="cpg-ach-ico">${csIcon(a.ico,18)}</span><span><b>${csEsc(a.text)}</b>${a.sub?`<em>${csEsc(a.sub)}</em>`:''}</span></div>`).join('')}</section>`:''}
    <div class="cpg-range" role="group" aria-label="Okres">${CPG_RANGES.map(r=>`<button type="button" class="cpg-chip${r[0]===range?' is-on':''}" aria-pressed="${r[0]===range?'true':'false'}" data-cpg-range="${r[0]}">${r[1]}</button>`).join('')}</div>
    <div class="cpg-kpis" data-cpg-kpis>
      <section class="cs-stat cpg-kpi"><span class="cs-stat-label">Treningi · ${csEsc(rangeLbl.toLowerCase())}</span><span class="cs-stat-value">${days}</span></section>
      <section class="cs-stat cpg-kpi"><span class="cs-stat-label">Tygodnie z rzędu</span><span class="cs-stat-value">${weeks}</span></section>
      <section class="cs-stat cpg-kpi"><span class="cs-stat-label">Podniesione</span><span class="cs-stat-value">${vol>=1000?csEsc(cpgNum(vol/1000))+' t':csEsc(cpgNum(Math.round(vol),0))+' kg'}</span></section>
      <section class="cs-stat cpg-kpi"><span class="cs-stat-label">Serie robocze</span><span class="cs-stat-value">${inR.reduce((n,s)=>n+cpgSetCount(s),0)}</span></section>
    </div>
    ${cpgSummaryHTML(c,sessions)}
    ${cpgCalendarHTML(c,sessions,range)}
    ${cpgStrengthHTML(c,from)}
    ${cpgRecordsHTML(records)}
    ${cpgBodyHTML(c,from)}
    ${cpgPhotosHTML(c,from)}
    <details class="cpg-card cpg-more-data" data-cpg-more${window._cpgMoreOpen||window._csProgressFull?' open':''} ontoggle="window._cpgMoreOpen=this.open">
      <summary><span>Historia treningów i więcej danych</span><span class="cs-chev">${csIcon('down',18)}</span></summary>
      ${cpgWeeklyKgHTML(sessions)}
      <div class="cpg-sub-h">Historia treningów</div>
      ${cpgHistoryHTML(sessions)}
      ${cpgHomeworkHTML(c)}
    </details>
  </div>`;
}
window.cpgProgressHTML=cpgProgressHTML;window.cpgSetRange=cpgSetRange;window.cpgSetEx=cpgSetEx;window.cpgSetPhotoView=cpgSetPhotoView;
window.cpgDate=cpgDate;window.cpgNum=cpgNum;window.cpgRecords=cpgRecords;window.cpgAchievements=cpgAchievements;window.cpgMonthSummary=cpgMonthSummary;

/* Kliknięcia przez data-* (nazwy ćwiczeń z bazy nie trafiają do onclick). */
document.addEventListener('click',e=>{
  const t=e.target&&e.target.closest?e.target.closest('[data-cpg-range],[data-cpg-ex],[data-cpg-rec],[data-cpg-allrecs]'):null;
  if(!t||!t.closest('.cpg'))return;
  if(t.hasAttribute('data-cpg-range'))cpgSetRange(t.getAttribute('data-cpg-range'));
  else if(t.hasAttribute('data-cpg-ex'))cpgSetEx(t.getAttribute('data-cpg-ex'));
  else if(t.hasAttribute('data-cpg-allrecs')){window._cpgAllRecs=!window._cpgAllRecs;setClientLiveScreen('progress');}
  else if(t.hasAttribute('data-cpg-rec')&&typeof clientOpenExercise==='function')clientOpenExercise(t.getAttribute('data-cpg-rec'));
});
