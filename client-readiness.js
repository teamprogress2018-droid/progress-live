/* Progress Readiness (3.0, etap 2): krótki, OPCJONALNY check-in samopoczucia w dniu treningu.
 * Na „Dzisiaj” pod kartą treningu: „Jak się dziś czujesz? · 20 s” → arkusz z 4 pytaniami po 3 odpowiedzi
 * (sen, energia, stres, mięśnie) + „Czy coś Cię boli?” tylko przy zgodzie na dane o zdrowiu.
 * Wynik słowem: dobre samopoczucie / umiarkowane / warto skonsultować trening z trenerem — to NIE jest pomiar ani diagnoza.
 * Start treningu się nie wydłuża (check-in nie blokuje „Rozpocznij trening”).
 * Zapis: telefon (`localStorage` `pl_ready_v1:<clientId>:<data>`) → przy starcie treningu tego dnia trafia do
 * `planSnapshot.readiness` (pierwszy zapis sesji, jak rozgrzewka — bez zmian reguł Firestore). Trener widzi go w oknie treningu
 * i w wiadomości „Zrobiłem trening…”. Przy „warto skonsultować” trener od razu dostaje wiadomość w czacie przez kolejkę telefonu
 * (stałe id `msg_ready_<clientId>_<data>`; pierwsza linia bez odpowiedzi — trafia na ekran blokady trenera).
 * Plan treningu nigdy nie zmienia się sam. Wyłącznik: window.CS_READINESS_OFF=true. */
'use strict';

const READY_QS=[
  {key:'sleep',label:'Jak spałeś?',opts:['Źle','Średnio','Dobrze']},
  {key:'energy',label:'Ile masz energii?',opts:['Mało','Średnio','Dużo']},
  {key:'stress',label:'Jaki masz poziom stresu?',opts:['Wysoki','Średni','Niski']},
  {key:'soreness',label:'Jak czują się mięśnie?',opts:['Obolałe','Trochę zmęczone','Wypoczęte']}
];
const READY_NAMES=['sen','energia','stres','mięśnie'];
const READY_LEVELS={
  good:{label:'Dobre samopoczucie',short:'dobre',text:'Trenuj według planu.'},
  mid:{label:'Umiarkowane samopoczucie',short:'umiarkowane',text:'Trenuj według planu i słuchaj ciała. Jeśli coś będzie nie tak, napisz do trenera.'},
  consult:{label:'Warto skonsultować trening z trenerem',short:'warto porozmawiać z trenerem',text:'Trener dostał Twoje odpowiedzi. Możesz trenować według planu albo najpierw do niego napisać.'}
};
const READY_KEY='pl_ready_v1:';

function readyEnabled(){return !window.CS_READINESS_OFF;}
function readyEsc(s){return typeof csEsc==='function'?csEsc(s):String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function readyToday(){return typeof csToday==='function'?csToday():(typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10));}
function readyClient(){return (window.CL||[]).find(x=>x&&x.id===window._clientId)||null;}
function readyHealthAllowed(){const c=readyClient();return typeof privacyHealthAllowed==='function'?!!privacyHealthAllowed(c):true;}

/** Poziom z odpowiedzi 0–2 (0 = gorzej). Ból albo suma ≤ 3 → konsultacja; suma ≥ 6 bez żadnej najgorszej odpowiedzi → dobre. */
function readyLevel(a){
  if(!a)return '';
  const vals=READY_QS.map(q=>a[q.key]);
  if(vals.some(v=>typeof v!=='number'||v<0||v>2))return '';
  if(a.pain===true)return 'consult';
  const sum=vals.reduce((s,v)=>s+v,0);
  if(sum<=3)return 'consult';
  if(sum>=6&&!vals.includes(0))return 'good';
  return 'mid';
}
function readySummary(r){
  if(!r)return '';
  const lv=READY_LEVELS[r.level];if(!lv)return '';
  const parts=READY_QS.map((q,i)=>typeof r[q.key]==='number'&&q.opts[r[q.key]]?READY_NAMES[i]+': '+q.opts[r[q.key]].toLowerCase():'').filter(Boolean);
  if(r.pain===true)parts.push('ból: tak');
  return lv.label+(parts.length?' ('+parts.join(', ')+')':'');
}
function readyTrainerText(r){
  return ['Samopoczucie przed treningiem — warto porozmawiać przed dzisiejszym treningiem, szczegóły poniżej.',
    READY_QS.map((q,i)=>READY_NAMES[i].charAt(0).toUpperCase()+READY_NAMES[i].slice(1)+': '+q.opts[r[q.key]].toLowerCase()).join(' · ')+(r.pain===true?' · Ból: tak':''),
    'Plan treningu nie został zmieniony.'].join('\n').slice(0,2000);
}
function readyStoreKey(date){return READY_KEY+(window._clientId||'')+':'+(date||readyToday());}
function readyGet(date){
  try{const raw=localStorage.getItem(readyStoreKey(date));const r=raw?JSON.parse(raw):null;return r&&READY_LEVELS[r.level]?r:null;}catch(e){return null;}
}
function readySet(r){try{localStorage.setItem(readyStoreKey(),JSON.stringify(r));return true;}catch(e){return false;}}
function readyPick(r){return {sleep:r.sleep,energy:r.energy,stress:r.stress,soreness:r.soreness,...(typeof r.pain==='boolean'?{pain:r.pain}:{}),level:r.level,at:r.at};}

/** Dołącza dzisiejszy check-in do treningu przed pierwszym zapisem sesji (woła cwStartFlow). */
function cwReadyAttach(cw){
  if(!cw||cw.readiness||cw.began)return;
  const r=readyGet(cw.date||readyToday());
  if(r)cw.readiness=readyPick(r);
}

/* ---------- Karta na „Dzisiaj” ---------- */
function readyTodayHTML(c,st){
  if(!readyEnabled()||!c||!st)return '';
  const slot=st.slot||{};
  if(!(st.inProgress||slot.kind==='workout'))return '';
  const r=readyGet();
  if(r)return `<div class="cs-ready-done" data-cs-ready-done><span>Samopoczucie dziś: <b>${readyEsc(READY_LEVELS[r.level].short)}</b></span><button type="button" class="cs-link" onclick="csReadyOpen()">Zmień</button></div>`;
  return `<button type="button" class="cs-ready-link" data-cs-ready-open onclick="csReadyOpen()"><span class="cs-ready-link-t">Jak się dziś czujesz?</span><span class="cs-ready-link-s">4 pytania · ok. 20 s · zobaczy je trener</span></button>`;
}

/* ---------- Arkusz pytań ---------- */
function readyDraft(){return window._csReady||(window._csReady={});}
function csReadyOpen(){
  if(!readyEnabled())return;
  const prev=readyGet();
  window._csReady=prev?readyPick(prev):{};
  window._csReadyOpener=document.activeElement;
  const old=document.getElementById('cs-ready');if(old)old.remove();
  document.body.insertAdjacentHTML('beforeend',csReadySheetHTML());
  const el=document.getElementById('cs-ready');
  el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();csReadyClose();}});
  const first=el.querySelector('.cs-ready-opts button');if(first)first.focus();
}
function csReadyClose(){
  const el=document.getElementById('cs-ready');if(el)el.remove();
  const o=window._csReadyOpener;window._csReadyOpener=null;
  if(o&&document.contains(o)&&o.focus)o.focus();
}
function csReadyPick(key,val){
  const st=readyDraft();
  if(key==='pain')st.pain=Number(val)===1;else st[key]=Math.max(0,Math.min(2,Number(val)||0));
  const cur=key==='pain'?(st.pain?1:0):st[key];
  document.querySelectorAll(`#cs-ready [data-ready-q="${key}"] button`).forEach(b=>{const on=Number(b.dataset.readyV)===cur;b.classList.toggle('is-on',on);b.setAttribute('aria-checked',on?'true':'false');});
  csReadyRenderResult();
}
function csReadyResultInner(lv){
  if(!lv)return '';
  const L=READY_LEVELS[lv];
  return `<b>${readyEsc(L.label)}</b><span>${readyEsc(L.text)}</span>`;
}
function csReadyRenderResult(){
  const lv=readyLevel(readyDraft());
  const box=document.querySelector('#cs-ready [data-ready-result]');
  const btn=document.querySelector('#cs-ready [data-ready-save]');
  if(btn)btn.disabled=!lv;
  if(!box)return;
  box.hidden=!lv;box.className='cs-ready-result'+(lv?' is-'+lv:'');box.innerHTML=csReadyResultInner(lv);
}
async function csReadySave(){
  const st=readyDraft();const level=readyLevel(st);if(!level)return;
  const r=readyPick({...st,level,at:new Date().toISOString()});
  const prev=readyGet();
  readySet(r);
  // Trening otwarty, ale jeszcze bez zapisu sesji — dołączamy od razu.
  const cw=window._cw;if(cw&&!cw.began)cwReadyAttach(cw);
  if(level==='consult'&&!(prev&&prev.level==='consult')&&typeof csOutboxQueue==='function'){
    const id=('msg_ready_'+(window._clientId||'')+'_'+readyToday()).replace(/[^A-Za-z0-9_.:@-]/g,'_').slice(0,190);
    csOutboxQueue(id,readyTrainerText(r),'').catch(()=>{});
  }
  csReadyClose();
  const host=document.querySelector('[data-cs-ready-open],[data-cs-ready-done]');
  if(host){const c=readyClient();const s=typeof csTodayState==='function'&&c?csTodayState(c):null;const html=readyTodayHTML(c,s);if(html)host.outerHTML=html;}
  if(typeof notify==='function')notify(level==='consult'?'Zapisano — trener dostał Twoje odpowiedzi':'Zapisano ✓');
}
function csReadySheetHTML(){
  const st=readyDraft();
  const radio=(key,labelHtml,aria,opts,cur,two)=>`<fieldset class="cs-ready-q" data-ready-q="${key}">
      <legend>${labelHtml}</legend>
      <div class="cs-ready-opts${two?' is-two':''}" role="radiogroup" aria-label="${readyEsc(aria)}">${opts.map((o,i)=>`<button type="button" role="radio" aria-checked="${cur===i?'true':'false'}" class="${cur===i?'is-on':''}" data-ready-v="${i}" onclick="csReadyPick('${key}',${i})">${readyEsc(o)}</button>`).join('')}</div>
    </fieldset>`;
  const qs=READY_QS.map(q=>radio(q.key,readyEsc(q.label),q.label,q.opts,st[q.key],false)).join('');
  const pain=readyHealthAllowed()?radio('pain','Czy coś Cię boli? <span class="cs-ready-opt">opcjonalnie</span>','Czy coś Cię boli?',['Nie','Tak'],st.pain===true?1:st.pain===false?0:-1,true):'';
  const lv=readyLevel(st);
  return `<div class="pv-gate cs-ready" id="cs-ready" role="dialog" aria-modal="true" aria-labelledby="cs-ready-h">
    <div class="pv-gate-card">
      <h2 id="cs-ready-h">Jak się dziś czujesz?</h2>
      <p class="cs-ready-hint">Odpowiedzi zobaczy tylko Twój trener. To nie jest badanie — pomaga trenerowi dopasować prowadzenie.</p>
      ${qs}${pain}
      <div class="cs-ready-result${lv?' is-'+lv:''}" data-ready-result aria-live="polite"${lv?'':' hidden'}>${csReadyResultInner(lv)}</div>
      <button type="button" class="cs-btn cs-btn-primary" data-ready-save onclick="csReadySave()"${lv?'':' disabled'}>Zapisz</button>
      <button type="button" class="cs-btn cs-btn-ghost" onclick="csReadyClose()">Anuluj</button>
    </div>
  </div>`;
}
window.READY_QS=READY_QS;window.READY_LEVELS=READY_LEVELS;window.readyLevel=readyLevel;window.readySummary=readySummary;window.readyTrainerText=readyTrainerText;
window.readyGet=readyGet;window.cwReadyAttach=cwReadyAttach;window.readyTodayHTML=readyTodayHTML;
window.csReadyOpen=csReadyOpen;window.csReadyClose=csReadyClose;window.csReadyPick=csReadyPick;window.csReadySave=csReadySave;window.csReadySheetHTML=csReadySheetHTML;
