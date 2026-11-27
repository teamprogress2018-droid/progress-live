/**
 * Progress Live 3.0 — Etap 5a: Body — porównanie sylwetki suwakiem (przed / po) razem z pomiarami z tych dni.
 *
 * - Zastępuje parę zdjęć w Postępach klienta (cpgPhotosHTML w client-progress.js), gdy są co najmniej 2 zestawy zdjęć
 *   z danym ujęciem (Przód / Bok / Tył). Mniej zdjęć — dotychczasowy widok (zachęta + „Dodaj zdjęcia”).
 * - Suwak: zdjęcie „przed” pod spodem, „po” odsłaniane z prawej (clip-path). Sterowanie: przeciąganie palcem/myszą
 *   po zdjęciu albo suwak `input[type=range]` (klawiatura, czytnik ekranu).
 * - Daty do porównania wybiera się z list (domyślnie: pierwszy zestaw w zakresie i najnowszy).
 * - Pod zdjęciem zmiany z tych dni: masa ciała (gdy trener ją pokazuje) i obwody — wartość najbliższa dacie zdjęcia (±14 dni).
 * - Id zdjęć z bazy nie trafiają do onclick — obsługa przez data-* i delegowane zdarzenia.
 */
(function(){
  'use strict';
  const base=window.cpgPhotosHTML;
  if(typeof base!=='function'||base._bd)return;
  const VIEWS=[['front','Przód'],['side','Bok'],['back','Tył']];
  const BD=window._bd=window._bd||{pos:50,a:'',b:''};
  const esc=s=>typeof csEsc==='function'?csEsc(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>typeof cpgNum==='function'?cpgNum(v):String(v).replace('.',',');
  const signed=v=>typeof cpgSigned==='function'?cpgSigned(v):(v>0?'+':'')+String(v).replace('.',',');
  const dlabel=d=>typeof cpgDate==='function'?cpgDate(d):String(d||'');
  const DAY=864e5;

  /** Wartość pomiaru najbliższa dacie (±14 dni), z całej historii. */
  function nearest(c,group,metric,ymd){
    const pts=typeof cpgMetricSeries==='function'?cpgMetricSeries(c,group,metric,''):[];
    const t=Date.parse(ymd+'T12:00:00Z');let best=null,bd=Infinity;
    pts.forEach(p=>{const d=Math.abs(Date.parse(String(p.date).slice(0,10)+'T12:00:00Z')-t);if(d<bd){bd=d;best=p;}});
    return best&&bd<=14*DAY?best.v:null;
  }
  function deltas(c,a,b){
    const out=[];
    const bodyOn=typeof bmFeatureOn!=='function'||bmFeatureOn(c);
    if(bodyOn&&(typeof csBodyWeightOn!=='function'||csBodyWeightOn())){
      const wa=Number(a.weight)||nearest(c,'mg1','m1',a.date),wb=Number(b.weight)||nearest(c,'mg1','m1',b.date);
      if(wa&&wb)out.push({label:'Masa ciała',v:Math.round((wb-wa)*10)/10,unit:'kg',now:wb});
    }
    if(bodyOn){
      const defs=typeof circMetricDefs==='function'&&circMetricDefs().length?circMetricDefs():[{id:'m1',name:'Klatka'},{id:'m2',name:'Talia'},{id:'m3',name:'Biodra'},{id:'m4',name:'Udo'},{id:'m5',name:'Ramię'}];
      defs.forEach(m=>{const va=nearest(c,'mg2',m.id,a.date),vb=nearest(c,'mg2',m.id,b.date);
        if(va!=null&&vb!=null){const n=String(m.name||m.id);out.push({label:n.charAt(0).toUpperCase()+n.slice(1),v:Math.round((vb-va)*10)/10,unit:'cm',now:vb});}});
    }
    return out;
  }
  function bdPhotosHTML(c,from){
    const all=typeof ppListFor==='function'?ppListFor(c.id):[];
    const view=VIEWS.some(v=>v[0]===window._cpgPhotoView)?window._cpgPhotoView:'front';
    const sets=all.filter(p=>p&&p.photos&&p.photos[view]&&p.date);
    if(sets.length<2)return null;
    const inR=sets.filter(p=>typeof cpgInRange!=='function'||cpgInRange(p.date,from));
    let a=sets.find(p=>p.id===BD.a),b=sets.find(p=>p.id===BD.b);
    if(!a)a=(inR.length>=2?inR:sets)[0];
    if(!b)b=sets[sets.length-1];
    if(a===b){const i=sets.indexOf(b);a=i>0?sets[i-1]:sets[1];}
    if(String(a.date)>String(b.date)){const t=a;a=b;b=t;}
    const pos=Math.max(0,Math.min(100,Number(BD.pos)||50));
    const opt=(sel)=>sets.map(p=>`<option value="${esc(p.id)}"${p===sel?' selected':''}>${esc(dlabel(p.date))}</option>`).join('');
    const dl=deltas(c,a,b);
    const days=Math.round((Date.parse(String(b.date).slice(0,10))-Date.parse(String(a.date).slice(0,10)))/DAY);
    const add=`<button type="button" class="cs-btn cs-btn-secondary cpg-photo-add" onclick="ppOpenDraft()">${typeof csIcon==='function'?csIcon('camera',18):''}Dodaj zdjęcia</button>`;
    const draft=window._ppDraft&&window._ppDraft.open&&typeof ppBlockHTML==='function'?`<div class="cpg-photo-draft">${ppBlockHTML(c,{live:true})}</div>`:'';
    return `<section class="cpg-card bd-card" data-cpg-photos data-bd>
      <h2 class="cpg-h">${typeof csIcon==='function'?csIcon('image',18):''}Body — przed i po</h2>
      <div class="cpg-chips" role="group" aria-label="Ujęcie">${VIEWS.map(v=>`<button type="button" class="cpg-chip${v[0]===view?' is-on':''}" aria-pressed="${v[0]===view?'true':'false'}" onclick="cpgSetPhotoView('${v[0]}')">${v[1]}</button>`).join('')}</div>
      <div class="bd-cmp" data-bd-cmp style="--bd-pos:${pos}%">
        <img class="bd-img" src="${esc(a.photos[view])}" alt="${esc('Przed, '+dlabel(a.date))}" draggable="false">
        <div class="bd-after" aria-hidden="false"><img class="bd-img" src="${esc(b.photos[view])}" alt="${esc('Po, '+dlabel(b.date))}" draggable="false"></div>
        <div class="bd-line" aria-hidden="true"><span class="bd-knob">‹ ›</span></div>
        <span class="bd-tag bd-tag-a" aria-hidden="true">Przed</span><span class="bd-tag bd-tag-b" aria-hidden="true">Po</span>
      </div>
      <label class="bd-range"><span class="sr-only">Porównanie zdjęć: przesuń, aby odsłonić zdjęcie „po”</span>
        <input type="range" min="0" max="100" step="1" value="${pos}" data-bd-range aria-valuetext="${pos}% zdjęcia po"></label>
      <div class="bd-dates">
        <label><span>Przed</span><select data-bd-a aria-label="Data zdjęcia przed">${opt(a)}</select></label>
        <label><span>Po</span><select data-bd-b aria-label="Data zdjęcia po">${opt(b)}</select></label>
      </div>
      <p class="cpg-sub" data-bd-span>${days>0?esc(days+' '+(typeof csPlural==='function'?csPlural(days,'dzień','dni','dni'):'dni')+' między zdjęciami'):'Zdjęcia z tego samego dnia'}</p>
      ${dl.length?`<ul class="cpg-circ bd-deltas" data-bd-deltas>${dl.map(x=>`<li><span>${esc(x.label)}</span><b>${esc(num(x.now))} ${x.unit}</b><span class="cpg-delta">${x.v===0?'bez zmian':esc(signed(x.v))+' '+x.unit}</span></li>`).join('')}</ul>`
        :`<p class="cpg-sub" data-bd-deltas>Pomiary z tych dni pojawią się tu, gdy masa ciała lub obwody zostaną zapisane w pobliżu dat zdjęć.</p>`}
      <p class="cpg-sub">Zdjęcia widzisz tylko Ty i Twój trener.</p>
      ${add}${draft}</section>`;
  }
  const wrapped=function(c,from){
    try{const h=c&&bdPhotosHTML(c,from);if(h)return h;}catch(e){}
    return base.apply(this,arguments);
  };
  wrapped._bd=true;
  window.cpgPhotosHTML=wrapped;

  /* ---------- sterowanie ---------- */
  function setPos(root,v){
    BD.pos=Math.max(0,Math.min(100,Math.round(v)));
    const cmp=root.querySelector('[data-bd-cmp]');if(cmp)cmp.style.setProperty('--bd-pos',BD.pos+'%');
    const r=root.querySelector('[data-bd-range]');if(r){r.value=BD.pos;r.setAttribute('aria-valuetext',BD.pos+'% zdjęcia po');}
  }
  function rerender(){if(typeof setClientLiveScreen==='function')setClientLiveScreen('progress');}
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('input',e=>{const t=e.target;if(t&&t.matches&&t.matches('[data-bd-range]')){const root=t.closest('[data-bd]');if(root)setPos(root,Number(t.value));}});
    document.addEventListener('change',e=>{const t=e.target;if(!t||!t.matches)return;
      if(t.matches('[data-bd-a]')){BD.a=t.value;rerender();}else if(t.matches('[data-bd-b]')){BD.b=t.value;rerender();}});
    let drag=null;
    const at=(e,cmp)=>{const r=cmp.getBoundingClientRect();const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;return r.width?x/r.width*100:50;};
    document.addEventListener('pointerdown',e=>{const cmp=e.target&&e.target.closest&&e.target.closest('[data-bd-cmp]');if(!cmp)return;
      drag=cmp;try{cmp.setPointerCapture(e.pointerId);}catch(x){}setPos(cmp.closest('[data-bd]'),at(e,cmp));e.preventDefault();});
    document.addEventListener('pointermove',e=>{if(!drag)return;setPos(drag.closest('[data-bd]'),at(e,drag));});
    const end=()=>{drag=null;};
    document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
  }
  Object.assign(window,{bdPhotosHTML,bdDeltas:deltas,bdNearest:nearest});
})();
