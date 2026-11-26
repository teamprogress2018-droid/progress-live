/**
 * Progress Live 3.0 — Etap 4a: komendy głosowe w trakcie treningu klienta.
 *
 * - Domyślnie WYŁĄCZONE. Klient włącza je w Profilu (karta Progress Voice → „Komendy głosowe”).
 *   Ustawienie na tym telefonie: `localStorage` `pl_vc_v1:<clientId>`.
 * - Słuchanie tylko po dotknięciu mikrofonu (`.vc-mic`, obok głośnika w nagłówku ćwiczenia i przerwy).
 *   Jedno zdanie, potem mikrofon sam się wyłącza — bez stałego nasłuchu.
 * - Rozpoznawanie mowy robi przeglądarka (Web Speech API, pl-PL). Gdy jej brak, mikrofon się nie pokazuje.
 * - Komendy (`vcParse`, czysta funkcja): „60 kilo 10 powtórzeń”, „60 na 10”, „zapisz”, „dalej”, „poprzednie”,
 *   „cofnij”, „pomiń przerwę” / „gotowy”, „dodaj 30 sekund”, „wycisz” / „włącz głos”, „technika”, „boli”.
 *   „Boli” tylko otwiera formularz zgłoszenia — nic nie jest wysyłane bez dotknięcia.
 * - Wykonanie (`vcRun`) używa tych samych funkcji co przyciski (cwPatchSet, cwSaveSet, cwNav, cwSkipRest…).
 */
(function(){
const VC={listening:false,rec:null,last:null};

/* ---------- ustawienia ---------- */
function vcKey(){return 'pl_vc_v1:'+(window._clientId||'guest');}
function vcOn(){try{return JSON.parse(localStorage.getItem(vcKey())||'{}').on===true;}catch(e){return false;}}
function vcSetOn(on){try{localStorage.setItem(vcKey(),JSON.stringify({on:!!on}));}catch(e){}}
function vcSupported(){return typeof window!=='undefined'&&!!(window.SpeechRecognition||window.webkitSpeechRecognition);}

/* ---------- liczby słownie ---------- */
const UNITS={zero:0,jeden:1,jedna:1,jedno:1,dwa:2,dwie:2,trzy:3,cztery:4,piec:5,szesc:6,siedem:7,osiem:8,dziewiec:9,dziesiec:10,
  jedenascie:11,dwanascie:12,trzynascie:13,czternascie:14,pietnascie:15,szesnascie:16,siedemnascie:17,osiemnascie:18,dziewietnascie:19};
const TENS={dwadziescia:20,trzydziesci:30,czterdziesci:40,piecdziesiat:50,szescdziesiat:60,siedemdziesiat:70,osiemdziesiat:80,dziewiecdziesiat:90};
const HUND={sto:100,dwiescie:200,trzysta:300};
function vcFold(t){
  return String(t||'').toLowerCase().replace(/[ąćęłńóśźż]/g,c=>({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[c]))
    .replace(/(\d)[,.](\d)/g,'$1d$2').replace(/[^a-z0-9\s]/g,' ').replace(/(\d)d(\d)/g,'$1.$2').replace(/\s+/g,' ').trim();
}
/** Zamienia liczebniki na cyfry: „szescdziesiat dwa i pol” → „62.5”. */
function vcWordsToDigits(t){
  const w=t.split(' '),out=[];let acc=null;
  const flush=()=>{if(acc!=null){out.push(String(acc));acc=null;}};
  for(let i=0;i<w.length;i++){
    const x=w[i];
    if(HUND[x]!=null){if(acc!=null&&acc%100)flush();acc=(acc||0)+HUND[x];continue;}
    if(TENS[x]!=null){if(acc!=null&&acc%100)flush();acc=(acc||0)+TENS[x];continue;}
    if(UNITS[x]!=null){if(acc!=null&&acc%10)flush();acc=(acc||0)+UNITS[x];continue;}
    if(x==='i'&&w[i+1]==='pol'&&(acc!=null||/^\d+(\.\d+)?$/.test(out[out.length-1]||''))){
      if(acc!=null)acc+=0.5;else out[out.length-1]=String(Number(out[out.length-1])+0.5);i++;continue;}
    if(x==='pol'&&acc==null&&!/^\d/.test(out[out.length-1]||'')){out.push('0.5');continue;}
    flush();out.push(x);
  }
  flush();
  return out.join(' ');
}

/* ---------- rozpoznawanie komendy ---------- */
const NUM='(\\d+(?:\\.\\d+)?)';
function vcParse(text){
  const t=vcWordsToDigits(vcFold(text));
  const r={action:null,kg:null,reps:null,sec:null,text:t};
  if(!t)return r;
  let m=t.match(new RegExp(NUM+' ?(?:kg|kilo\\w*|kilogram\\w*)\\b'));if(m)r.kg=Number(m[1]);
  m=t.match(new RegExp(NUM+' ?(?:powt\\w*|razy|raz|ruch\\w*)\\b'));if(m&&Number.isInteger(Number(m[1])))r.reps=Number(m[1]);
  if(r.kg==null&&r.reps==null){m=t.match(new RegExp(NUM+' na '+NUM+'\\b'));if(m&&Number.isInteger(Number(m[2]))){r.kg=Number(m[1]);r.reps=Number(m[2]);}}
  const has=re=>re.test(t);
  if(has(/\b(boli|bol|kontuzj\w*)\b/))r.action='pain';
  else if(has(/\b(wycisz\w*|cisza|bez glosu)\b/))r.action='mute';
  else if(has(/\bwlacz (glos|asystent\w*)\b/))r.action='unmute';
  else if(has(/\b(technik\w*|jak (to )?wykona\w*|pokaz (cwiczenie|film))\b/))r.action='tech';
  else if(has(/\b(dodaj|wiecej|przedluz\w*)\b/)&&has(/\b(sekund\w*|czasu|przerw\w*|minut\w*)\b/)){
    r.action='addRest';m=t.match(new RegExp(NUM+' ?(sekund\\w*|minut\\w*)'));
    r.sec=m?Math.round(Number(m[1])*(/^minut/.test(m[2])?60:1)):15;
  }
  else if(has(/\b(pomin|koniec|skoncz\w*) przerw\w*\b|\b(gotow\w*|start|jedziemy|lecimy)\b/))r.action='ready';
  else if(has(/\bcofnij\b/))r.action='undo';
  else if(has(/\b(poprzedni\w*|wstecz)\b/))r.action='prev';
  else if(has(/\b(nastepn\w*|dalej|kolejn\w*)\b/))r.action='next';
  else if(has(/\b(zapisz|zapisuje|zrobione|zrobilem|zrobilam|seria zrobiona|zaliczone)\b/))r.action='save';
  return r;
}

/* ---------- wykonanie ---------- */
function vcCurSet(cw){const ex=cw&&cw.exercises&&cw.exercises[cw.exIdx];if(!ex||ex.skipped)return -1;return (ex.sets||[]).findIndex(s=>!s.done);}
function vcNum(n){return typeof csNum==='function'?csNum(n):String(n).replace('.',',');}
function vcRun(cmd){
  const cw=window._cw;
  if(!cw||!cw.active)return {ok:false,msg:'Komendy działają w trakcie treningu.'};
  const phase=cw.phase,said=[];
  if((cmd.kg!=null||cmd.reps!=null)&&phase==='exercise'){
    const i=vcCurSet(cw);
    if(i<0)return {ok:false,msg:'Wszystkie serie tego ćwiczenia są zapisane.'};
    if(cmd.kg!=null&&cmd.kg>=0&&cmd.kg<=500){cwPatchSet(i,'kg',String(cmd.kg));said.push(vcNum(cmd.kg)+' kg');}
    if(cmd.reps!=null&&cmd.reps>0&&cmd.reps<=100){cwPatchSet(i,'reps',String(cmd.reps));said.push(cmd.reps+' powt.');}
    if(!cmd.action&&typeof cwRender==='function')cwRender();
  }
  const a=cmd.action;
  if(!a)return said.length?{ok:true,msg:'Wpisano: '+said.join(' × ')+'. Powiedz „zapisz”, żeby zapisać serię.'}:{ok:false,msg:'Nie rozpoznano komendy. Spróbuj np. „60 kilo 10 powtórzeń, zapisz”.'};
  const pre=said.length?said.join(' × ')+' · ':'';
  if(a==='pain'){if(typeof cwPainOpen==='function'){cwPainOpen();return {ok:true,msg:'Otwarto zgłoszenie bólu — uzupełnij je dotykiem.'};}return {ok:false,msg:'Zgłoś ból z menu „…”.'};}
  if(a==='mute'||a==='unmute'){
    const on=typeof pvSettings==='function'&&pvSettings().enabled;
    if((a==='mute')===!!on&&typeof pvToggleMute==='function')pvToggleMute();
    return {ok:true,msg:a==='mute'?'Asystent wyciszony':'Asystent włączony'};
  }
  if(a==='addRest'){if(phase!=='rest')return {ok:false,msg:'Teraz nie trwa przerwa.'};cwRestAdd(cmd.sec||15);return {ok:true,msg:'Przerwa +'+(cmd.sec||15)+' s'};}
  if(a==='ready'){
    if(phase==='rest'){cwSkipRest();return {ok:true,msg:'Koniec przerwy'};}
    if(phase==='exercise'&&(said.length||vcCurSet(cw)>=0))return vcSave(cw,pre);
    return {ok:false,msg:'Teraz nie trwa przerwa.'};
  }
  if(phase==='rest'&&(a==='save'||a==='next'))return {ok:false,msg:'Trwa przerwa. Powiedz „pomiń przerwę”, żeby zacząć serię.'};
  if(phase!=='exercise')return {ok:false,msg:'Ta komenda działa na ekranie ćwiczenia.'};
  if(a==='tech'){cwOpenSheet('tech');return {ok:true,msg:'Technika ćwiczenia'};}
  if(a==='undo'){if(cw.lastSaved&&typeof cwUndoLastSet==='function'){cwUndoLastSet();return {ok:true,msg:'Cofnięto ostatnią serię'};}return {ok:false,msg:'Nie ma serii do cofnięcia.'};}
  if(a==='prev'){cwNav(-1);return {ok:true,msg:'Poprzednie ćwiczenie'};}
  if(a==='next'){cwNav(1);return {ok:true,msg:'Następne ćwiczenie'};}
  if(a==='save')return vcSave(cw,pre);
  return {ok:false,msg:'Nie rozpoznano komendy.'};
}
function vcSave(cw,pre){
  const i=vcCurSet(cw);
  if(i<0){cwNextEx();return {ok:true,msg:'Następne ćwiczenie'};}
  const ex=cw.exercises[cw.exIdx];const st=ex.sets[i];
  if(!(Number.parseFloat(String(st.reps||'').replace(',','.'))>0))return {ok:false,msg:pre+'Podaj liczbę powtórzeń, np. „10 powtórzeń, zapisz”.'};
  cw._tapLockUntil=0; // komenda to świadoma decyzja — nie blokuje jej ochrona przed podwójnym dotknięciem
  cwSaveSet(i);
  return {ok:true,msg:pre+'Seria '+(st.setNo||i+1)+' zapisana'};
}

/* ---------- mikrofon ---------- */
const MIC='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
function vcMicHTML(){
  if(!vcOn()||!vcSupported())return '';
  return `<button type="button" class="vc-mic${VC.listening?' is-on':''}" data-vc-mic aria-pressed="${VC.listening?'true':'false'}" aria-label="${VC.listening?'Słucham — dotknij, żeby przerwać':'Powiedz komendę'}" onclick="vcToggle()">${MIC}</button>`;
}
function vcSync(){document.querySelectorAll('[data-vc-mic]').forEach(b=>{b.classList.toggle('is-on',VC.listening);b.setAttribute('aria-pressed',VC.listening?'true':'false');b.setAttribute('aria-label',VC.listening?'Słucham — dotknij, żeby przerwać':'Powiedz komendę');});}
function vcSay(msg){
  if(typeof notify==='function')notify(msg);
  let live=document.getElementById('vc-live');
  if(!live&&document.body){live=document.createElement('div');live.id='vc-live';live.className='sr-only';live.setAttribute('aria-live','polite');document.body.appendChild(live);}
  if(live)live.textContent=msg;
}
function vcHandle(alternatives){
  let cmd=null;
  for(const alt of alternatives){const c=vcParse(alt);if(c.action||c.kg!=null||c.reps!=null){cmd=c;break;}}
  const res=cmd?vcRun(cmd):{ok:false,msg:'Nie rozpoznano komendy. Spróbuj np. „60 kilo 10 powtórzeń, zapisz”.'};
  VC.last={heard:alternatives[0]||'',res};
  vcSay(res.msg);
  return res;
}
function vcToggle(){
  if(VC.listening){try{VC.rec&&VC.rec.stop();}catch(e){}return;}
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return;
  if(typeof pvStop==='function')try{pvStop();}catch(e){} // asystent nie może zagłuszać mikrofonu
  const rec=new R();VC.rec=rec;
  rec.lang='pl-PL';rec.interimResults=false;rec.maxAlternatives=3;rec.continuous=false;
  rec.onresult=e=>{const alts=[];const r=e.results&&e.results[0];if(r)for(let i=0;i<r.length;i++)alts.push(r[i].transcript);vcHandle(alts);};
  rec.onerror=e=>{const er=e&&e.error;
    vcSay(er==='not-allowed'||er==='service-not-allowed'?'Brak zgody na mikrofon. Włącz ją w ustawieniach telefonu.':er==='no-speech'?'Nic nie usłyszałem. Dotknij mikrofonu i powiedz komendę.':'Nie udało się rozpoznać mowy.');};
  rec.onend=()=>{VC.listening=false;VC.rec=null;vcSync();};
  try{rec.start();VC.listening=true;vcSync();}catch(e){VC.listening=false;vcSync();}
}

/* ---------- wpięcie w nagłówek i ustawienia ---------- */
const baseMute=window.pvMuteBtnHTML;
if(typeof baseMute==='function')window.pvMuteBtnHTML=function(){return baseMute.apply(this,arguments)+vcMicHTML();};
const baseCard=window.pvSettingsCardHTML;
if(typeof baseCard==='function')window.pvSettingsCardHTML=function(){
  const html=baseCard.apply(this,arguments);
  const block=vcSupported()
    ?`<section class="cs-card pv-card vc-card" aria-labelledby="vc-card-h" data-vc-settings>
      <h2 id="vc-card-h" class="pv-h">Komendy głosowe</h2>
      <label class="pv-row"><span><b>Sterowanie głosem w treningu</b><small>Dotknij mikrofonu i powiedz np. „60 kilo 10 powtórzeń, zapisz”, „pomiń przerwę”, „dalej”, „technika”.</small></span><input type="checkbox" role="switch" data-vc-toggle ${vcOn()?'checked':''} onchange="vcSetFromUI(this)"></label>
      <p class="pv-note">Mikrofon słucha tylko po dotknięciu, jednego zdania. Mowę rozpoznaje usługa telefonu (Apple lub Google); Progress nie zapisuje nagrań.</p>
    </section>`
    :`<p class="pv-note" data-vc-settings>Komendy głosowe: ta przeglądarka nie obsługuje rozpoznawania mowy.</p>`;
  return html+block;
};
function vcSetFromUI(el){vcSetOn(!!(el&&el.checked));if(typeof notify==='function')notify(el&&el.checked?'Komendy głosowe włączone — mikrofon pojawi się na ekranie treningu':'Komendy głosowe wyłączone');}

window.VC=VC;window.vcParse=vcParse;window.vcRun=vcRun;window.vcHandle=vcHandle;window.vcToggle=vcToggle;window.vcOn=vcOn;window.vcSetOn=vcSetOn;
window.vcSupported=vcSupported;window.vcMicHTML=vcMicHTML;window.vcSetFromUI=vcSetFromUI;window.vcWordsToDigits=vcWordsToDigits;window.vcFold=vcFold;
})();
