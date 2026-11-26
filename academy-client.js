/* Progress Academy dla klienta (3.0, etap 3c): krótkie lekcje 1–3 min przypisywane przez trenera.
 *
 * Trener (profil klienta → Plan, karta „Academy — lekcje dla klienta”): zaznacza lekcje z biblioteki Team Progress
 * (AC_LIB: 10 krótkich lekcji w 9 kategoriach) albo dodaje własną (tytuł, kategoria, tekst, opcjonalnie film YouTube
 * i jedno zadanie). Zapis: client.academy = {assigned:[id], custom:[{id,title,cat,min,text,video,task}], updatedAt}
 * (karta klienta, jak rozgrzewka — bez zmian reguł Firestore).
 * Klient: na „Dzisiaj” NAJWYŻEJ JEDNA wskazówka (pierwsza nieprzerobiona przypisana lekcja), w zakładce „Trener” karta
 * „Academy” z listą lekcji. Lekcja: tekst, film (jeśli jest), jedno pytanie sprawdzające, jedno praktyczne zadanie,
 * „Przerobione ✓”. Postęp klienta zapisuje się na tym telefonie (`localStorage` `pl_academy_done_v1:<clientId>`),
 * bo klient nie może zmieniać swojej karty.
 * Treści ogólne, edukacyjne — bez diagnoz i indywidualnych zaleceń medycznych lub dietetycznych.
 */
(function(){
  'use strict';
  const esc=s=>typeof csEsc==='function'?csEsc(s):(typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const clientById=id=>(window.CL||[]).find(c=>c&&c.id===id)||null;
  const AC_CATS=['Trening siłowy','Technika ćwiczeń','Regeneracja','Odżywianie','Sen','Zdrowe nawyki','Motywacja','Podstawy anatomii','Aktywność codzienna'];
  const AC_LIB=[
    {id:'ac_progresja',cat:'Trening siłowy',min:2,title:'Po co zwiększać ciężar?',
      text:['Mięśnie dostosowują się do tego, co regularnie robisz. Gdy ten sam wysiłek staje się łatwy, ciało nie ma powodu, żeby dalej się zmieniać.','Dlatego trener co jakiś czas zwiększa ciężar, liczbę powtórzeń albo serii. To jest progresja — małe kroki, a nie skoki.','Progresja nie oznacza, że każdy trening musi być cięższy. Czasem postępem jest lepsza technika albo spokojniejszy oddech przy tym samym ciężarze.'],
      quiz:{q:'Co jest progresją?',opts:['Każdy trening do upadku mięśniowego','Stopniowe zwiększanie wymagań, np. +1 powtórzenie','Zmiana wszystkich ćwiczeń co tydzień'],a:1,why:'Progresja to małe, stopniowe kroki — ciężar, powtórzenia albo jakość ruchu.'},
      task:'Przy jednym ćwiczeniu na najbliższym treningu zapisz uczciwie, ile powtórzeń zostało Ci w zapasie.'},
    {id:'ac_rir',cat:'Technika ćwiczeń',min:2,title:'Zapas powtórzeń — jak go ocenić?',
      text:['Zapas powtórzeń (RIR) to liczba powtórzeń, które mogłabyś jeszcze zrobić z dobrą techniką, gdybyś nie przerwała serii.','„2 w zapasie” znaczy: seria była wymagająca, ale spokojnie zrobiłabyś jeszcze dwa poprawne powtórzenia.','Nie chodzi o zgadywanie do ostatniego powtórzenia. Jeśli technika zaczyna się psuć, to sygnał, że zapas się kończy.'],
      quiz:{q:'„1 w zapasie” oznacza, że…',opts:['zrobiłam jedno powtórzenie','mogłabym zrobić jeszcze 1 poprawne powtórzenie','seria była bardzo łatwa'],a:1,why:'RIR mówi, ile poprawnych powtórzeń zostało — nie ile zrobiłaś.'},
      task:'W aplikacji po serii zaznacz „Ile zostało w zapasie?” przy jednym ćwiczeniu.'},
    {id:'ac_oddech',cat:'Technika ćwiczeń',min:2,title:'Oddech i napięcie brzucha',
      text:['Przy ćwiczeniach z ciężarem stabilny tułów pomaga kontrolować ruch i chroni plecy.','Prosty sposób: przed powtórzeniem weź spokojny wdech, delikatnie napnij brzuch, jakbyś szykowała się na lekkie szturchnięcie, wykonaj ruch i wypuść powietrze pod koniec.','Nie wstrzymuj oddechu na długo i nie rób tego „na siłę”. Jeśli kręci Ci się w głowie — przerwij i powiedz trenerowi.'],
      quiz:{q:'Kiedy napinamy brzuch?',opts:['Tylko po treningu','Przed powtórzeniem, utrzymując spokojny oddech','Nigdy przy ciężarach'],a:1,why:'Lekkie napięcie przed ruchem stabilizuje tułów.'},
      task:'Przy pierwszym ćwiczeniu dzisiejszego treningu zrób 2 powtórzenia, skupiając się tylko na oddechu.'},
    {id:'ac_zakwasy',cat:'Regeneracja',min:2,title:'Zakwasy — co warto wiedzieć',
      text:['Ból mięśni 1–2 dni po treningu zdarza się zwłaszcza po nowych ćwiczeniach albo po przerwie. Zwykle mija sam w ciągu kilku dni.','Lekki ruch — spacer, spokojna rozgrzewka — często pomaga bardziej niż leżenie.','Zakwasy to coś innego niż ostry, kłujący ból albo ból stawu. Taki ból zgłoś trenerowi w aplikacji i nie ćwicz „na siłę”.'],
      quiz:{q:'Co zrobić przy ostrym bólu stawu w trakcie ćwiczenia?',opts:['Dokończyć serię','Przerwać i zgłosić trenerowi','Zwiększyć ciężar'],a:1,why:'Ostry ból to sygnał do przerwania — trener zdecyduje, co dalej.'},
      task:'Dzień po treningu wybierz się na 15–20 minut spaceru.'},
    {id:'ac_sen',cat:'Sen',min:2,title:'Sen a efekty treningu',
      text:['W czasie snu ciało regeneruje się po wysiłku. Krótki sen często oznacza mniej energii na treningu i większy apetyt.','Pomaga stała pora kładzenia się i wstawania — także w weekend — oraz chwila bez telefonu przed snem.','Jeśli masz problemy ze snem przez dłuższy czas, porozmawiaj z lekarzem.'],
      quiz:{q:'Co najbardziej pomaga w lepszym śnie?',opts:['Stała pora snu','Trening tuż przed północą','Kawa wieczorem'],a:0,why:'Regularny rytm dnia to jedna z najprostszych dźwigni.'},
      task:'Przez 3 dni połóż się o tej samej porze (±30 min).'},
    {id:'ac_bialko',cat:'Odżywianie',min:2,title:'Białko w każdym posiłku',
      text:['Białko jest budulcem mięśni. Zamiast liczyć gramy, zacznij od prostej zasady: źródło białka w każdym głównym posiłku.','Przykłady: jajka, twaróg, jogurt naturalny, mięso, ryby, rośliny strączkowe, tofu.','Indywidualne ilości ustala trener albo dietetyk — szczególnie przy chorobach nerek i innych schorzeniach.'],
      quiz:{q:'Które z tych to dobre źródło białka?',opts:['Twaróg','Sok owocowy','Biała bułka'],a:0,why:'Nabiał, mięso, ryby, jaja i strączki to proste źródła białka.'},
      task:'Jutro dodaj źródło białka do śniadania.'},
    {id:'ac_nawyk',cat:'Zdrowe nawyki',min:2,title:'Małe kroki — nawyk na 2 minuty',
      text:['Nawyki łatwiej budować, gdy pierwszy krok jest bardzo mały: „przygotuję strój na trening” zamiast „będę trenować codziennie”.','Połącz nowy nawyk z czymś, co i tak robisz: po porannej kawie — 2 minuty rozciągania.','Liczy się regularność, nie perfekcja. Gorszy tydzień to nie porażka — wracasz do planu.'],
      quiz:{q:'Najłatwiej zacząć nawyk, gdy…',opts:['pierwszy krok jest bardzo mały','od razu robisz wszystko idealnie','czekasz na motywację'],a:0,why:'Mały krok obniża próg wejścia — potem łatwiej go powiększać.'},
      task:'Wybierz jeden 2-minutowy nawyk i zrób go dziś po czymś, co robisz codziennie.'},
    {id:'ac_minimum',cat:'Motywacja',min:1,title:'Gorszy dzień? Wersja minimum',
      text:['Nie każdy dzień jest idealny. Zamiast rezygnować, zrób wersję minimum: rozgrzewkę i jedno, dwa najważniejsze ćwiczenia.','Jeśli trener włączył krótsze treningi, na „Dzisiaj” zobaczysz „Mniej czasu?” — to właśnie taka wersja.','Krótki trening też buduje nawyk. A jeśli źle się czujesz — napisz do trenera.'],
      quiz:{q:'Co zrobić w dzień bez sił?',opts:['Odpuścić cały tydzień','Zrobić wersję minimum albo napisać do trenera','Trenować dwa razy mocniej jutro'],a:1,why:'Mniej, ale regularnie — i w kontakcie z trenerem.'},
      task:'Zapisz w notatkach, jak wygląda Twoja wersja minimum (2–3 ćwiczenia).'},
    {id:'ac_posladki',cat:'Podstawy anatomii',min:2,title:'Mięśnie pośladkowe — po co je wzmacniać?',
      text:['Pośladki to jedne z największych mięśni w ciele. Pracują przy wstawaniu, chodzeniu po schodach i podnoszeniu rzeczy z ziemi.','Silne pośladki pomagają stabilizować miednicę i kolana w codziennych ruchach.','W Twoim planie pracują m.in. w przysiadach, wykrokach, martwym ciągu i unoszeniu bioder.'],
      quiz:{q:'W którym ruchu pracują pośladki?',opts:['Wstawanie z krzesła','Pisanie na klawiaturze','Mruganie'],a:0,why:'Wstawanie to w praktyce przysiad — pośladki pracują mocno.'},
      task:'Dziś wstań z krzesła 10 razy powoli, bez pomocy rąk.'},
    {id:'ac_kroki',cat:'Aktywność codzienna',min:2,title:'Ruch poza treningiem',
      text:['Trening to kilka godzin w tygodniu. Reszta dnia też ma znaczenie: spacery, schody, zabawa z dziećmi, prace w domu.','Codzienny ruch pomaga w samopoczuciu, kondycji i kontroli masy ciała.','Proste pomysły: krótki spacer po posiłku, schody zamiast windy, rozmowa telefoniczna na stojąco.'],
      quiz:{q:'Który pomysł zwiększa codzienny ruch?',opts:['Spacer po obiedzie','Dłuższe siedzenie','Jazda windą na 1. piętro'],a:0,why:'Małe porcje ruchu w ciągu dnia sumują się.'},
      task:'Przez 3 dni zrób 10-minutowy spacer po jednym posiłku.'}
  ];

  /* ---------- Dane ---------- */
  function acCfg(c){
    const a=c&&c.academy||{};
    const custom=(Array.isArray(a.custom)?a.custom:[]).filter(x=>x&&String(x.id||'').replace(/[^A-Za-z0-9_-]/g,'')&&String(x.title||'').trim()).slice(0,20).map(x=>({
      id:String(x.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,40),cat:AC_CATS.includes(x.cat)?x.cat:'Zdrowe nawyki',min:Math.max(1,Math.min(3,parseInt(x.min,10)||2)),
      title:String(x.title).trim().slice(0,80),text:String(x.text||'').split(/\n{2,}|\n/).map(t=>t.trim()).filter(Boolean).slice(0,8),
      video:/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(String(x.video||''))?String(x.video):'',task:String(x.task||'').trim().slice(0,200),custom:true}));
    const assigned=(Array.isArray(a.assigned)?a.assigned:[]).map(String);
    return {assigned,custom};
  }
  function acLesson(c,id){const cfg=acCfg(c);return cfg.custom.find(x=>x.id===id)||AC_LIB.find(x=>x.id===id)||null;}
  /** Lekcje przypisane klientowi, w kolejności przypisania (własne trenera zawsze przypisane). */
  function acAssigned(c){
    const cfg=acCfg(c);
    const ids=[...new Set(cfg.assigned.concat(cfg.custom.map(x=>x.id)))];
    return ids.map(id=>acLesson(c,id)).filter(Boolean);
  }
  const doneKey=()=>'pl_academy_done_v1:'+(window._clientId||'');
  function acDone(){try{return JSON.parse(localStorage.getItem(doneKey())||'{}')||{};}catch(e){return {};}}
  function acMarkDone(id){const d=acDone();d[id]=new Date().toISOString().slice(0,10);try{localStorage.setItem(doneKey(),JSON.stringify(d));}catch(e){}return d;}
  function acNext(c){const d=acDone();return acAssigned(c).find(l=>!d[l.id])||null;}

  /* ---------- Klient ---------- */
  /** „Dzisiaj”: najwyżej jedna wskazówka — pierwsza nieprzerobiona lekcja. */
  function acTodayHTML(c){
    const l=c&&acNext(c);if(!l)return '';
    return `<button type="button" class="cs-ready-link ac-tip" data-ac-tip="${esc(l.id)}" onclick="acOpen(this.dataset.acTip)"><span class="cs-ready-link-t">Wskazówka od trenera: ${esc(l.title)}</span><span class="cs-ready-link-s">${esc(l.cat)} · ${l.min} min</span></button>`;
  }
  /** Zakładka „Trener”: karta Academy z listą lekcji (tylko gdy coś przypisano). */
  function acHubHTML(c){
    const list=c?acAssigned(c):[];if(!list.length)return '';
    const d=acDone();const n=list.filter(l=>d[l.id]).length;
    return `<section class="cs-card ac-hub" data-ac-hub aria-labelledby="ac-hub-h">
      <div class="cs-eyebrow" id="ac-hub-h">ACADEMY · ${n} Z ${list.length} PRZEROBIONYCH</div>
      <ul class="ac-list">${list.map(l=>`<li><button type="button" class="ac-item${d[l.id]?' is-done':''}" data-ac-open="${esc(l.id)}" onclick="acOpen(this.dataset.acOpen)">
        <span class="ac-item-t">${esc(l.title)}</span><span class="ac-item-s">${esc(l.cat)} · ${l.min} min${d[l.id]?' · przerobione ✓':''}</span></button></li>`).join('')}</ul>
    </section>`;
  }
  function acYouTubeId(u){const m=/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/.exec(String(u||''));return m?m[1]:'';}
  function acSheetHTML(l){
    const done=!!acDone()[l.id];
    const vid=acYouTubeId(l.video);
    return `<div class="pv-gate ac-sheet" id="ac-sheet" role="dialog" aria-modal="true" aria-labelledby="ac-h">
      <div class="pv-gate-card">
        <span class="pw-brand">ACADEMY · ${esc(l.cat.toUpperCase())} · ${l.min} MIN</span>
        <h2 id="ac-h">${esc(l.title)}</h2>
        ${vid?`<div class="ac-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(vid)}" title="${esc(l.title)}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`:''}
        ${(l.text||[]).map(p=>`<p class="ac-p">${esc(p)}</p>`).join('')}
        ${l.quiz?`<fieldset class="ac-quiz" data-ac-quiz><legend>${esc(l.quiz.q)}</legend>
          ${l.quiz.opts.map((o,i)=>`<button type="button" class="xp-opt ac-opt" data-ac-opt="${i}" onclick="acAnswer('${esc(l.id)}',${i})">${esc(o)}</button>`).join('')}
          <p class="ac-fb" data-ac-fb aria-live="polite" hidden></p></fieldset>`:''}
        ${l.task?`<p class="pw-next ac-task"><span>Zadanie na dziś</span>${esc(l.task)}</p>`:''}
        <button type="button" class="cs-btn cs-btn-primary" data-ac-done onclick="acFinish('${esc(l.id)}')"${done?' disabled':''}>${done?'Przerobione ✓':'Przerobione'}</button>
        <button type="button" class="cs-btn cs-btn-ghost" onclick="acClose()">Zamknij</button>
      </div></div>`;
  }
  function acOpen(id){
    const c=clientById(window._clientId);const l=c&&acLesson(c,id);if(!l)return;
    window._acOpener=document.activeElement;
    const old=document.getElementById('ac-sheet');if(old)old.remove();
    document.body.insertAdjacentHTML('beforeend',acSheetHTML(l));
    const el=document.getElementById('ac-sheet');
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();acClose();}});
    const h=el.querySelector('h2');if(h){h.tabIndex=-1;h.focus();}
  }
  function acClose(){
    const el=document.getElementById('ac-sheet');if(el)el.remove();
    const o=window._acOpener;window._acOpener=null;if(o&&document.contains(o)&&o.focus)o.focus();
  }
  function acAnswer(id,i){
    const c=clientById(window._clientId);const l=c&&acLesson(c,id);if(!l||!l.quiz)return;
    const good=Number(i)===l.quiz.a;
    document.querySelectorAll('#ac-sheet [data-ac-opt]').forEach(b=>{const k=Number(b.dataset.acOpt);b.classList.toggle('is-good',k===l.quiz.a);b.classList.toggle('is-bad',k===Number(i)&&!good);b.setAttribute('aria-pressed',k===Number(i)?'true':'false');});
    const fb=document.querySelector('#ac-sheet [data-ac-fb]');
    if(fb){fb.hidden=false;fb.textContent=(good?'Dobrze! ':'Prawie. ')+l.quiz.why;}
  }
  function acFinish(id){
    acMarkDone(id);
    acClose();
    if(typeof notify==='function')notify('Lekcja przerobiona ✓');
    try{if(typeof renderClientLive==='function')renderClientLive();}catch(e){}
  }

  /* ---------- Trener: karta w profilu klienta → Plan ---------- */
  function acState(c){const st=window._acEdit;return st&&st.clientId===c.id?st:null;}
  function acTrainerCardHTML(c){
    const st=acState(c);
    if(!st){
      const list=acAssigned(c);
      return `<section class="wu-card ac-card" id="ac-card" aria-labelledby="ac-t">
        <div class="wu-head"><h3 id="ac-t" class="cp-section-title" style="margin:0;">ACADEMY — LEKCJE DLA KLIENTA</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-act="ac-edit" data-cid="${esc(c.id)}">${list.length?'Zmień':'Przypisz lekcje'}</button></div>
        <p class="wu-sub">${list.length?'Przypisane ('+list.length+'): '+esc(list.map(l=>l.title).join(', '))+'. Klient widzi jedną wskazówkę na „Dzisiaj” i całą listę w zakładce „Trener”.':'Brak przypisanych lekcji. Klient nie widzi wskazówek Academy.'}</p>
      </section>`;
    }
    const byCat=AC_CATS.map(cat=>({cat,items:AC_LIB.filter(l=>l.cat===cat)})).filter(x=>x.items.length);
    return `<section class="wu-card ac-card is-editing" id="ac-card" aria-labelledby="ac-t">
      <div class="wu-head"><h3 id="ac-t" class="cp-section-title" style="margin:0;">ACADEMY — WYBÓR TRENERA</h3></div>
      <p class="wu-sub">Lekcje 1–3 min z pytaniem i jednym zadaniem. Kolejność zaznaczania = kolejność wskazówek na „Dzisiaj”.</p>
      <div class="ac-pick">${byCat.map(g=>`<fieldset><legend>${esc(g.cat)}</legend>${g.items.map(l=>`<label class="pj-given"><input type="checkbox" data-ac-pick="${l.id}"${st.assigned.includes(l.id)?' checked':''}> ${esc(l.title)} <span class="wu-sub">· ${l.min} min</span></label>`).join('')}</fieldset>`).join('')}</div>
      <h4 class="ac-own-h">Twoje lekcje</h4>
      ${st.custom.length?`<ul class="wu-list">${st.custom.map((x,i)=>`<li><b>${esc(x.title)}</b> <span class="wu-sub">${esc(x.cat)}</span> <button type="button" class="btn btn-ghost btn-sm" data-act="ac-del" data-i="${i}">Usuń</button></li>`).join('')}</ul>`:'<p class="wu-sub">Brak własnych lekcji.</p>'}
      <div class="ac-new">
        <label class="wu-search"><span>Tytuł</span><input type="text" class="form-input" maxlength="80" data-ac-new="title" placeholder="np. Jak ustawić stopy w przysiadzie"></label>
        <label class="wu-search"><span>Kategoria</span><select class="form-input" data-ac-new="cat">${AC_CATS.map(cat=>`<option>${esc(cat)}</option>`).join('')}</select></label>
        <label class="wu-search"><span>Tekst (krótkie akapity, 1–3 min czytania)</span><textarea class="form-input" rows="4" maxlength="1500" data-ac-new="text"></textarea></label>
        <label class="wu-search"><span>Film YouTube (opcjonalnie)</span><input type="url" class="form-input" data-ac-new="video" placeholder="https://youtu.be/…"></label>
        <label class="wu-search"><span>Jedno zadanie praktyczne (opcjonalnie)</span><input type="text" class="form-input" maxlength="200" data-ac-new="task"></label>
        <button type="button" class="btn btn-ghost btn-sm" data-act="ac-add">+ Dodaj lekcję</button>
      </div>
      ${st.error?`<p class="wu-err" role="alert">${esc(st.error)}</p>`:''}
      <div class="wu-actions"><button type="button" class="btn btn-ghost" data-act="ac-cancel">Anuluj</button>
        <button type="button" class="btn btn-primary" data-act="ac-save"${st.saving?' disabled':''}>${st.saving?'Zapisuję…':'Zapisz'}</button></div>
    </section>`;
  }
  function acRender(c){
    const host=document.getElementById('ac-card');
    if(host)host.outerHTML=acTrainerCardHTML(c);
    else{
      const anchor=document.getElementById('pw-card')||document.getElementById('pj-card')||document.getElementById('xp-card')||document.getElementById('wu-card');
      if(anchor)anchor.insertAdjacentHTML('afterend',acTrainerCardHTML(c));
      else{const body=document.getElementById('cp-body');if(!body)return;body.insertAdjacentHTML('afterbegin',acTrainerCardHTML(c));}
    }
    document.querySelectorAll('#ac-card [data-ac-pick]').forEach(cb=>{cb.onchange=()=>{const st=acState(c);if(!st)return;const id=cb.dataset.acPick;
      st.assigned=st.assigned.filter(x=>x!==id);if(cb.checked)st.assigned.push(id);};});
  }
  const cur=()=>clientById(window._acEdit&&window._acEdit.clientId);
  function acAddCustom(){
    const st=window._acEdit;const c=cur();if(!st||!c)return;
    const v=k=>{const el=document.querySelector(`#ac-card [data-ac-new="${k}"]`);return el?String(el.value||'').trim():'';};
    const title=v('title'),text=v('text'),video=v('video');
    if(!title||!text){st.error='Wpisz tytuł i tekst lekcji.';acRender(c);return;}
    if(video&&!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(video)){st.error='Film: wklej link z YouTube (https://youtu.be/… lub https://www.youtube.com/…).';acRender(c);return;}
    if(st.custom.length>=20){st.error='Maksymalnie 20 własnych lekcji.';acRender(c);return;}
    st.custom.push({id:'acc_'+Date.now().toString(36),title:title.slice(0,80),cat:v('cat'),min:Math.max(1,Math.min(3,Math.round(text.split(/\s+/).length/180)||1)),text:text.slice(0,1500),video,task:v('task').slice(0,200)});
    st.error='';acRender(c);
  }
  async function acSave(){
    const st=window._acEdit;const c=cur();if(!st||!c||st.saving)return;
    const prev=c.academy;
    c.academy={assigned:st.assigned.filter(id=>AC_LIB.some(l=>l.id===id)),custom:st.custom,updatedAt:new Date().toISOString()};
    st.saving=true;st.error='';acRender(c);
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.academy=prev;st.saving=false;st.error='Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';acRender(c);return;}
    window._acEdit=null;acRender(c);
    if(typeof notify==='function')notify('Lekcje zapisane — klient zobaczy wskazówkę na „Dzisiaj”');
  }
  if(typeof uiAction==='function'){
    uiAction('ac-edit',d=>{const c=clientById(d.cid);if(!c)return;const a=c.academy||{};
      window._acEdit={clientId:c.id,assigned:(Array.isArray(a.assigned)?a.assigned:[]).slice(),custom:(Array.isArray(a.custom)?a.custom:[]).map(x=>({...x}))};acRender(c);});
    uiAction('ac-cancel',()=>{const c=cur();window._acEdit=null;if(c)acRender(c);});
    uiAction('ac-add',()=>{acAddCustom();});
    uiAction('ac-del',d=>{const st=window._acEdit;const c=cur();if(!st||!c)return;st.custom.splice(Number(d.i),1);acRender(c);});
    uiAction('ac-save',()=>{acSave();});
  }
  const orig=window.renderCPPlan;
  if(typeof orig==='function'&&!orig._ac){
    const wrapped=function(c){const r=orig.apply(this,arguments);try{if(c&&c.id)acRender(c);}catch(e){}return r;};
    wrapped._ac=true;wrapped._pw=orig._pw;wrapped._pj=orig._pj;wrapped._xp=orig._xp;wrapped._wu=orig._wu;
    window.renderCPPlan=wrapped;
  }
  Object.assign(window,{AC_LIB,AC_CATS,acCfg,acLesson,acAssigned,acDone,acNext,acTodayHTML,acHubHTML,acSheetHTML,acOpen,acClose,acAnswer,acFinish,acTrainerCardHTML,acSave});
})();
