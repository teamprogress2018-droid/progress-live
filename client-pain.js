/* „Zgłoś ból” w trakcie treningu (aplikacja klienta): gdzie boli, jak mocno, krótki opis → zapis w treningu (cw.issues)
 * i od razu wiadomość do trenera w czacie przez kolejkę na telefonie (bez sieci wyśle się sama). Trener z włączonymi
 * powiadomieniami dostaje push (treść na ekranie blokady bez szczegółów zdrowotnych). Aplikacja nie diagnozuje i nie doradza
 * leczenia — mówi tylko, kiedy przerwać i kiedy dzwonić pod 112. */
'use strict';

const PAIN_AREAS=[['kolano','Kolano'],['ledzwie','Dół pleców'],['plecy','Góra pleców / kark'],['bark','Bark'],['lokiec','Łokieć / nadgarstek'],['biodro','Biodro'],['stopa','Kostka / stopa'],['inne','Inne']];
const PAIN_LEVELS=[['lekki','Lekko','1–3'],['sredni','Średnio','4–6'],['silny','Mocno','7–10']];

function painEsc(s){return typeof csEsc==='function'?csEsc(s):String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function painState(){return window._csPain||(window._csPain={area:'',level:'',note:'',err:''});}

function painSheetHTML(){
  const cw=window._cw||{};const ex=(cw.exercises||[])[cw.exIdx]||{};const st=painState();
  const strong=st.level==='silny';
  return `<div class="pv-gate cs-pain" id="cs-pain" role="dialog" aria-modal="true" aria-labelledby="cs-pain-h">
    <div class="pv-gate-card">
      <h2 id="cs-pain-h">Zgłoś ból trenerowi</h2>
      <p class="cs-pain-ex">${painEsc(ex.name||'Trening')}</p>
      <p class="cs-pain-safe" role="note"><b>Silny lub nagły ból — przerwij ćwiczenie.</b> Ból w klatce piersiowej, duszność, zawroty głowy albo drętwienie — przerwij trening i zadzwoń pod 112.</p>
      <fieldset class="cs-pain-set"><legend>Gdzie boli?</legend>
        <div class="cs-pain-chips">${PAIN_AREAS.map(([id,l])=>`<button type="button" class="cpg-chip${st.area===id?' is-on':''}" aria-pressed="${st.area===id}" data-pain-area="${id}">${l}</button>`).join('')}</div>
      </fieldset>
      <fieldset class="cs-pain-set"><legend>Jak mocno?</legend>
        <div class="cs-pain-levels">${PAIN_LEVELS.map(([id,l,r])=>`<button type="button" class="cs-pain-lvl${st.level===id?' is-on':''}${id==='silny'?' is-strong':''}" aria-pressed="${st.level===id}" data-pain-level="${id}"><b>${l}</b><span>${r}</span></button>`).join('')}</div>
      </fieldset>
      <label class="cs-pain-note"><span>Kiedy boli? <em>opcjonalnie</em></span>
        <textarea id="cs-pain-note" rows="2" maxlength="300" placeholder="np. przy opuszczaniu, od drugiej serii">${painEsc(st.note)}</textarea></label>
      ${strong?`<p class="cs-pain-stop" role="alert">Przy silnym bólu nie kontynuuj tego ćwiczenia.</p>`:''}
      <p class="pv-err" id="cs-pain-err" role="alert"${st.err?'':' hidden'}>${painEsc(st.err)}</p>
      <button type="button" class="cs-btn cs-btn-primary" data-pain-send="skip">Wyślij i pomiń ćwiczenie</button>
      ${strong?`<button type="button" class="cs-btn cs-btn-secondary" data-pain-send="finish">Wyślij i zakończ trening</button>`:`<button type="button" class="cs-btn cs-btn-secondary" data-pain-send="continue">Wyślij i kontynuuj ostrożnie</button>`}
      <button type="button" class="cs-link" data-pain-close>Anuluj</button>
      <p class="cs-pain-priv">Zgłoszenie zobaczy tylko Twój trener.</p>
    </div></div>`;
}
function painRender(){
  const old=document.getElementById('cs-pain');
  const note=document.getElementById('cs-pain-note');if(note)painState().note=note.value;
  const html=painSheetHTML();
  if(old)old.outerHTML=html;else document.body.insertAdjacentHTML('beforeend',html);
}
function cwPainOpen(){
  if(!window._cw)return;
  window._csPain={area:'',level:'',note:'',err:''};
  if(typeof cwSheetClose==='function')try{cwSheetClose();}catch(e){}
  painRender();
  setTimeout(()=>{const h=document.getElementById('cs-pain-h');if(h){h.tabIndex=-1;h.focus();}},0);
}
function cwPainClose(){const el=document.getElementById('cs-pain');if(el)el.remove();window._csPain=null;}

function painMessageText(cw,ex,st,decision){
  const area=(PAIN_AREAS.find(a=>a[0]===st.area)||[])[1]||'';
  const lvl=PAIN_LEVELS.find(l=>l[0]===st.level)||[];
  const done=(ex.sets||[]).filter(x=>x&&x.done).length,total=(ex.sets||[]).length;
  const dec={skip:'pominąłem(-am) to ćwiczenie',continue:'kontynuuję ostrożnie',finish:'kończę trening'}[decision]||'';
  return ['Zgłoszenie bólu: '+area+' · '+(lvl[1]||'').toLowerCase()+' ('+(lvl[2]||'')+')',
    'Ćwiczenie: '+(ex.name||'—')+(total?' (zrobione serie: '+done+' z '+total+')':''),
    st.note?'Opis: '+st.note:'',
    dec?'Decyzja: '+dec:''].filter(Boolean).join('\n').slice(0,1000);
}
async function cwPainSend(decision){
  const cw=window._cw;if(!cw)return;
  const st=painState();const note=document.getElementById('cs-pain-note');st.note=String(note?note.value:st.note||'').trim().slice(0,300);
  if(!st.area||!st.level){st.err=!st.area?'Zaznacz, gdzie boli.':'Zaznacz, jak mocno boli.';painRender();return;}
  // Progress Voice: komunikat bezpieczeństwa (bez diagnozy).
  if(typeof pvEmit==='function')pvEmit('PAIN_REPORTED');
  const ex=cw.exercises[cw.exIdx]||{};
  const at=new Date().toISOString();
  cw.issues=cw.issues||[];
  cw.issues.push({exerciseName:ex.name||'',area:st.area,level:st.level,note:st.note,decision,reportedAt:at});
  const n=cw.issues.length;
  const id='msg_pain_'+String(cw.sessionId||'s'+Date.now()).replace(/[^A-Za-z0-9_.:@-]/g,'_').slice(0,160)+'_'+n;
  const text=painMessageText(cw,ex,st,decision);
  cwPainClose();
  if(decision==='skip'&&typeof cwSkipEx==='function')cwSkipEx('Ból');
  else if(decision==='finish'){cw.phase='finish';if(typeof cwQueuePersist==='function')cwQueuePersist(cw,'in_progress');if(typeof cwRender==='function')cwRender();}
  else{if(typeof cwQueuePersist==='function')cwQueuePersist(cw,'in_progress');if(typeof cwRender==='function')cwRender();}
  let res='pending';
  try{res=typeof csOutboxQueue==='function'?await csOutboxQueue(id,text,cw.sessionId):'error';}catch(e){res='pending';}
  if(typeof notify==='function')notify(res==='sent'?'Trener dostał zgłoszenie w czacie':res==='error'?'Nie udało się zapisać zgłoszenia — napisz do trenera w czacie':'Zgłoszenie zapisane — wyślemy je, gdy wróci internet');
  return res;
}

document.addEventListener('click',e=>{
  const t=e.target&&e.target.closest?e.target.closest('#cs-pain [data-pain-area],#cs-pain [data-pain-level],#cs-pain [data-pain-send],#cs-pain [data-pain-close]'):null;
  if(!t)return;
  const st=painState();
  if(t.hasAttribute('data-pain-area')){st.area=t.getAttribute('data-pain-area');st.err='';painRender();}
  else if(t.hasAttribute('data-pain-level')){st.level=t.getAttribute('data-pain-level');st.err='';painRender();}
  else if(t.hasAttribute('data-pain-send'))cwPainSend(t.getAttribute('data-pain-send'));
  else if(t.hasAttribute('data-pain-close'))cwPainClose();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('cs-pain'))cwPainClose();});

/** Jedno zgłoszenie z treningu jako krótki tekst dla trenera: „Przysiad: ból — Kolano, mocno (7–10) · przy opuszczaniu”. */
function painIssueText(x){
  if(!x)return '';
  const area=(PAIN_AREAS.find(a=>a[0]===x.area)||[])[1];
  const lvl=PAIN_LEVELS.find(l=>l[0]===x.level);
  const head=area?'ból — '+area+(lvl?', '+lvl[1].toLowerCase()+' ('+lvl[2]+')':''):'';
  return [(x.exerciseName?x.exerciseName+': ':'')+head,x.note||''].filter(Boolean).join(head&&x.note?' · ':'');
}
Object.assign(window,{painIssueText,cwPainOpen,cwPainClose,cwPainSend,painMessageText});
