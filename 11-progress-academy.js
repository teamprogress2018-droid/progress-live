/* Progress Academy: edukacja trenera poza kreatorem; wyłącznie odczyt planu. */
(function(){
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const state={level:'quick',context:null,back:false,addingBook:false,selectedBookId:'',question:'',booksLoading:false};
  const bookDomains={training:'Trening',nutrition:'Żywienie'};

  function builderContext(){
    const base=typeof window.builderEduCtx==='function'?window.builderEduCtx():{};
    let days=0;document.querySelectorAll('#builder-days .builder-day').forEach(d=>{if(!d.querySelector('.rc:checked'))days++;});
    return Object.assign({},base,{planName:(document.getElementById('b-name')||{}).value||'',daysPerWeek:days||null});
  }
  function tabs(){return `<div class="academy-tabs" role="tablist" aria-label="Sekcje Progress Academy">${[['quick','Szybka odpowiedź'],['guide','Przewodnik decyzji'],['context','Mój plan'],['books','Moje książki'],['learn','Ucz się z książek']].map(x=>`<button type="button" role="tab" aria-selected="${state.level===x[0]}" class="academy-tab${state.level===x[0]?' is-active':''}" onclick="academySetLevel('${x[0]}')">${x[1]}</button>`).join('')}</div>`;}
  function quick(){return `<section class="academy-grid"><article class="academy-card"><b>Objętość</b><p>Zacznij od dolnej części MEV–MAV. Dodaj 1–2 serie na partię tylko, gdy jakość serii i regeneracja są stabilne.</p></article><article class="academy-card"><b>RIR / RPE</b><p>Dla hipertrofii zwykle 0–3 RIR. RPE 8 to około 2 powtórzenia w zapasie; nie planuj stale RPE 10.</p></article><article class="academy-card"><b>Częstotliwość</b><p>Przy hipertrofii rozłóż pracę głównych partii na około 2 ekspozycje tygodniowo.</p></article><article class="academy-card"><b>Przerwy</b><p>Wielostawy: zwykle 90–120 s przy hipertrofii i 2–5 min przy sile.</p></article></section>`;}
  function guide(){return `<section class="academy-guide"><article class="academy-step"><span>01</span><div><b>Ustal ograniczenia</b><p>Sprawdź realną liczbę dni, sen, stres i ból.</p></div></article><article class="academy-step"><span>02</span><div><b>Dobierz strukturę</b><p>2–3 dni: FBW; 3–4: Upper/Lower; 4–6: PPL lub priorytet.</p></div></article><article class="academy-step"><span>03</span><div><b>Ustaw dawkę</b><p>Dobierz ćwiczenia, serie, powtórzenia i RIR pod cel.</p></div></article><article class="academy-step"><span>04</span><div><b>Sprawdź trend</b><p>Po 2–4 tygodniach zmieniaj jedną zmienną naraz.</p></div></article></section>`;}
  function context(){const c=state.context||builderContext(),has=!!(c.clientId||c.planName||c.daysPerWeek),r=typeof window.buildMethodRationale==='function'?window.buildMethodRationale(c):null;return `<section class="academy-context"><div class="academy-context-head"><div><span class="academy-eyebrow">Kontekst tylko do odczytu</span><h2>${has?'Sprawdzenie założeń planu':'Brak otwartego planu'}</h2><p>Akademia nie zapisuje ani nie zmienia danych planu.</p></div>${state.back?'<button type="button" class="btn btn-ghost btn-sm" onclick="academyBackToBuilder()">Wróć do kreatora</button>':''}</div>${has?`<dl class="academy-context-data"><div><dt>Klient</dt><dd>${esc(c.clientName||'Nie wybrano')}</dd></div><div><dt>Cel</dt><dd>${esc(c.goal||'—')}</dd></div><div><dt>Metoda</dt><dd>${esc(c.method||'—')}</dd></div><div><dt>Dni</dt><dd>${c.daysPerWeek}</dd></div></dl><aside class="academy-signal"><b>Sygnał dla tego planu</b><p>${esc(r&&r.tips&&r.tips[0]||'Sprawdź regenerację i trend RPE.')}</p></aside>`:''}</section>`;}

  function userBooks(){return (window.KB||[]).filter(x=>x&&x.academyBook===true).slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));}
  function sourceBooks(){return typeof window.booksKbList==='function'?window.booksKbList():[];}
  function bookById(id){return userBooks().find(b=>b.id===id)||null;}
  function sourceLabel(book){return [book.bookAuthor,book.citation].filter(Boolean).join(' · ')||'Moja biblioteka';}
  function safeHref(value){try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url.href:'';}catch(e){return '';}}
  function addBookForm(){
    if(!state.addingBook)return '';
    return `<form class="academy-book-form" onsubmit="academySaveBook(event)">
      <div class="academy-form-head"><div><b>Dodaj książkę do swojej biblioteki</b><p>Przechowujemy opis i Twoje notatki — nie pełną treść książki.</p></div><button type="button" class="btn btn-ghost btn-sm" onclick="academyCancelBook()">Anuluj</button></div>
      <div class="form-grid"><div class="form-field"><label class="form-lbl" for="academy-book-title">Tytuł *</label><input id="academy-book-title" class="form-input" required maxlength="220" autocomplete="off"></div><div class="form-field"><label class="form-lbl" for="academy-book-author">Autor</label><input id="academy-book-author" class="form-input" maxlength="180" autocomplete="off"></div><div class="form-field"><label class="form-lbl" for="academy-book-domain">Obszar</label><select id="academy-book-domain" class="form-select"><option value="training">Trening</option><option value="nutrition">Żywienie</option></select></div><div class="form-field"><label class="form-lbl" for="academy-book-url">Link / ISBN (opcjonalnie)</label><input id="academy-book-url" class="form-input" maxlength="500" autocomplete="off"></div></div>
      <div class="form-field"><label class="form-lbl" for="academy-book-notes">Twoja synteza i notatki</label><textarea id="academy-book-notes" class="form-textarea" rows="6" maxlength="12000" placeholder="Własnymi słowami: najważniejsze zasady, przykłady, pytania do powtórki."></textarea><small class="academy-help">Notatki są prywatne i są jedyną treścią używaną w nauce oraz pytaniach.</small></div>
      <label class="academy-check"><input id="academy-book-learning" type="checkbox" checked> Używaj moich notatek w Progress Academy</label>
      <div><button class="btn btn-primary" type="submit">Zapisz książkę</button></div>
    </form>`;
  }
  function bookCard(book){
    const canLearn=book.useInLearning!==false&&String(book.text||'').trim().length>0;
    const url=safeHref(book.sourceUrl);
    const idArg=esc(JSON.stringify(String(book.id||'')));
    return `<article class="academy-book-card"><div class="academy-book-card-head"><div><span class="academy-book-domain">${esc(bookDomains[book.bookDomain]||'Książka')}</span><h3>${esc(book.title)}</h3><p>${esc(sourceLabel(book))}</p></div><button type="button" class="academy-icon-danger" aria-label="Usuń książkę ${esc(book.title)}" title="Usuń książkę" onclick="academyDeleteBook(${idArg})">×</button></div>${book.text?`<p class="academy-book-notes">${esc(book.text.substring(0,280))}${book.text.length>280?'…':''}</p>`:'<p class="academy-book-empty">Brak notatek — dodaj syntezę, aby uczyć się z tej książki.</p>'}<div class="academy-book-actions">${canLearn?`<button type="button" class="btn btn-ghost btn-sm" onclick="academyLearnBook(${idArg})">Ucz się z notatek</button>`:''}${url?`<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Źródło ↗</a>`:''}</div></article>`;
  }
  function books(){
    const mine=userBooks(),built=sourceBooks();
    return `<section class="academy-books"><div class="academy-book-intro"><div><span class="academy-eyebrow">Prywatna biblioteka</span><h2>Dodawaj książki, ucz się z własnych notatek.</h2><p>Tytuł, autor, link i Twoja synteza są zapisywane w prywatnej Bazie wiedzy. Pełne pliki książek nie są kopiowane ani publikowane.</p></div><button type="button" class="btn btn-primary" onclick="academyShowAddBook()">+ Dodaj książkę</button></div>${addBookForm()}<div class="academy-library-head"><h3>Moje książki <span>${mine.length}</span></h3></div>${mine.length?`<div class="academy-books-grid">${mine.map(bookCard).join('')}</div>`:'<div class="academy-empty">Dodaj pierwszą książkę i zapisz krótką syntezę. Później wykorzystasz ją w powtórkach oraz pytaniach.</div>'}<details class="academy-source-library"><summary>Źródła wbudowane w Progress Live (${built.length})</summary><p>Te opracowane reguły są dostępne dla AI i nauki jako źródła tylko do odczytu.</p><div class="academy-source-list">${built.slice(0,30).map(b=>`<span>${esc((b.author?b.author+' — ':'')+(b.title||'Bez tytułu'))}</span>`).join('')||'<span>Wczytywanie źródeł…</span>'}</div></details></section>`;
  }
  function customMatches(query){
    const q=String(query||'').trim().toLocaleLowerCase('pl');
    return userBooks().filter(b=>b.useInLearning!==false&&b.text&&(!q||[b.title,b.bookAuthor,b.text,b.bookDomain].join(' ').toLocaleLowerCase('pl').includes(q))).map(b=>({text:b.text,book:b.id,cite:(b.bookAuthor?b.bookAuthor+' — ':'')+b.title,status:'moja notatka'}));
  }
  function learningSources(){
    const q=state.question.trim();
    const mine=customMatches(q);
    const domain=/żyw|zyw|diet|białk|bialk|kcal|kalor|makro|suplement/i.test(q)?'nutrition':'training';
    const built=q&&typeof window.booksKbSelect==='function'?window.booksKbSelect({mode:domain,query:q,maxChars:1800,perBook:2}):[];
    return mine.concat(built).slice(0,6);
  }
  function learn(){
    const selected=bookById(state.selectedBookId);
    const q=state.question.trim();
    const sources=selected?[{text:selected.text,book:selected.id,cite:(selected.bookAuthor?selected.bookAuthor+' — ':'')+selected.title,status:'moja notatka'}]:learningSources();
    const hasNotes=userBooks().some(b=>b.useInLearning!==false&&b.text);
    const sourceHtml=sources.length?`<div class="academy-learning-results" aria-live="polite">${sources.map(s=>`<article class="academy-learning-card"><span>${esc(s.status||'źródło')}</span><h3>${esc(s.cite||'Źródło')}</h3><p>${esc(String(s.text||'').substring(0,650))}${String(s.text||'').length>650?'…':''}</p><div class="academy-recall"><b>Powtórka aktywna</b><span>Jak zastosujesz tę zasadę w planie lub rozmowie z klientem?</span></div></article>`).join('')}</div>`:`<div class="academy-empty">${hasNotes?'Nie znaleziono notatek pasujących do pytania. Zmień sformułowanie lub dodaj syntezę do książki.':'Najpierw dodaj książkę wraz z własnymi notatkami. To z nich powstanie materiał do nauki.'}</div>`;
    return `<section class="academy-learn"><div class="academy-learn-intro"><span class="academy-eyebrow">Nauka oparta na źródłach</span><h2>Zapytaj swoje notatki i źródła Academy.</h2><p>Odpowiedzi pokazują, z której książki lub notatki pochodzą. To materiał edukacyjny, nie porada medyczna.</p></div>${selected?`<div class="academy-selected-book"><span>Uczysz się z: <b>${esc(selected.title)}</b></span><button class="btn btn-ghost btn-sm" type="button" onclick="academyClearSelectedBook()">Wróć do wszystkich źródeł</button></div>`:''}<form class="academy-question" onsubmit="academyAskBooks(event)"><label class="form-lbl" for="academy-question">Pytanie lub temat do powtórki</label><div><input id="academy-question" class="form-input" value="${esc(q)}" placeholder="np. hipertrofia klatki, białko na redukcji, RIR" maxlength="240" autocomplete="off"><button class="btn btn-primary" type="submit">Szukaj materiału</button></div></form>${!q&&!selected?`<div class="academy-empty">Wpisz temat, aby połączyć Twoje notatki ze źródłami Academy.</div>`:sourceHtml}</section>`;
  }
  function render(){const root=document.getElementById('screen-academy');if(!root)return;const body=state.level==='quick'?quick():state.level==='guide'?guide():state.level==='context'?context():state.level==='books'?books():learn();root.innerHTML=`<div class="topbar"><div><div class="topbar-title">Progress Academy</div><div class="academy-subtitle">Metodyka planowania i nauka na podstawie własnych źródeł</div></div></div><main class="content academy-content"><header class="academy-hero"><span class="academy-eyebrow">Dla trenera</span><h1>Decyzje treningowe, krok po kroku.</h1><p>Szybka odpowiedź, przewodnik, analiza planu i nauka z książek.</p></header>${tabs()}<div class="academy-panel">${body}</div></main>`;}
  async function prepareBooks(){
    if(state.booksLoading||typeof window.booksKbLoad!=='function')return;
    state.booksLoading=true;try{await window.booksKbLoad();}finally{state.booksLoading=false;if(state.level==='books'||state.level==='learn')render();}
  }
  window.academySetLevel=l=>{state.level=l;if(l==='books'||l==='learn')prepareBooks();render();};
  window.academyShowAddBook=()=>{state.addingBook=true;render();setTimeout(()=>document.getElementById('academy-book-title')?.focus(),0);};
  window.academyCancelBook=()=>{state.addingBook=false;render();};
  window.academySaveBook=async event=>{
    event.preventDefault();
    const title=(document.getElementById('academy-book-title')||{}).value?.trim();
    if(!title){notify('Podaj tytuł książki');return;}
    if(!window._db||typeof window.persistById!=='function'){notify('Zaloguj się i sprawdź połączenie, aby zapisać książkę');return;}
    const record=withTrainer({id:newId('kb'),kind:'note',academyBook:true,title,bookAuthor:(document.getElementById('academy-book-author')||{}).value?.trim()||'',bookDomain:(document.getElementById('academy-book-domain')||{}).value==='nutrition'?'nutrition':'training',sourceUrl:(document.getElementById('academy-book-url')||{}).value?.trim()||'',text:(document.getElementById('academy-book-notes')||{}).value?.trim()||'',useInLearning:!!document.getElementById('academy-book-learning')?.checked,useInPlanning:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    const saved=await persistById('kb',record);
    if(!saved){notify('Nie udało się zapisać książki — nic nie zostało dodane');return;}
    window.KB=window.KB||[];window.KB.push(saved);state.addingBook=false;render();notify('✓ Książka zapisana w prywatnej bibliotece');
  };
  window.academyDeleteBook=async id=>{
    const book=bookById(id);if(!book||!confirm(`Usunąć książkę „${book.title}” wraz z jej notatkami?`))return;
    try{await window._del(window._doc(window._db,'kb',book._fbId||book.id));}catch(e){notify('Nie udało się usunąć książki. Spróbuj ponownie.');return;}
    window.KB=(window.KB||[]).filter(x=>x.id!==book.id);if(state.selectedBookId===book.id)state.selectedBookId='';render();notify('Książka została usunięta');
  };
  window.academyLearnBook=id=>{state.selectedBookId=id;state.question='';state.level='learn';prepareBooks();render();};
  window.academyClearSelectedBook=()=>{state.selectedBookId='';render();};
  window.academyAskBooks=event=>{event.preventDefault();state.selectedBookId='';state.question=((document.getElementById('academy-question')||{}).value||'').trim();render();};
  window.academyFromBuilder=()=>{state.context=builderContext();state.back=true;window._builderPreserveOnReturn=true;window._builderNavigationConfirmed=true;state.level='context';goTo('academy');};
  window.academyBackToBuilder=()=>{window._builderPreserveOnReturn=true;goTo('builder');};
  window.renderProgressAcademy=render;
})();
