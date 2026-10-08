/* Progress Academy — osobna przestrzeń edukacyjna dla trenera.
   Czyta kontekst kreatora, ale nigdy nie zapisuje ani nie zmienia planu. */
(function(){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const state={level:'quick',context:null,returnToBuilder:false};

  function getBuilderContext(){
    const base=typeof window.builderEduCtx==='function'?window.builderEduCtx():{};
    let days=0;
    document.querySelectorAll('#builder-days .builder-day').forEach(day=>{
      if(!day.querySelector('.rc:checked'))days++;
    });
    return Object.assign({},base,{planName:(document.getElementById('b-name')||{}).value||'',daysPerWeek:days||null});
  }
  function context(){ return state.context||getBuilderContext(); }
  function labelGoal(goal){ return ({masa:'hipertrofia',sila:'siła',redukcja:'redukcja',kondycja:'kondycja',atletyzm:'atletyzm',rehab:'powrót'})[goal]||goal||'—'; }
  function planSignal(ctx){
    const r=typeof window.buildMethodRationale==='function'?window.buildMethodRationale(ctx):null;
    if(!r)return {title:'Dodaj kontekst planu',text:'Otwórz Akademię z kreatora, aby sprawdzić bieżące założenia.'};
    return r.tips&&r.tips.length?{title:'Sygnał dla tego planu',text:r.tips[0]}:{title:'Plan bez sygnałów',text:'Nie wykryliśmy oczywistej niespójności. Sprawdź jednak regenerację i trend RPE.'};
  }
  function helpTabs(){
    const tabs=[['quick','1 · Szybka odpowiedź'],['guide','2 · Przewodnik decyzji'],['context','3 · Mój plan']];
    return `<div class="academy-tabs" role="tablist" aria-label="Poziom pomocy">${tabs.map(([id,name])=>`<button type="button" role="tab" aria-selected="${state.level===id}" class="academy-tab${state.level===id?' is-active':''}" onclick="academySetLevel('${id}')">${name}</button>`).join('')}</div>`;
  }
  function quick(){
    return `<section class="academy-grid" aria-label="Szybkie odpowiedzi">
      ${card('Objętość','Zacznij od dolnej części zakresu MEV–MAV. Dodawaj 1–2 serie na partię tylko, gdy jakość serii i regeneracja są stabilne.','MEV · MAV · MRV')}
      ${card('RIR / RPE','Dla hipertrofii zwykle zostaw 0–3 RIR. RPE 8 oznacza około 2 powtórzeń w zapasie; nie planuj stale RPE 10.','RIR → RPE')}
      ${card('Częstotliwość','Przy celu hipertroficznym rozłóż pracę głównych partii na około 2 ekspozycje tygodniowo, o ile grafik klienta na to pozwala.','Split')}
      ${card('Przerwy','Wielostawy wymagają zwykle 90–120 s przy hipertrofii i 2–5 min przy sile. Zbyt krótka przerwa obniża jakość kolejnej serii.','Regeneracja')}
    </section>
    <p class="academy-disclaimer">To ramy edukacyjne, nie automatyczne zalecenie kliniczne. Uwzględnij zdrowie, technikę, sen i informację zwrotną klienta.</p>`;
  }
  function card(title,text,tag){return `<article class="academy-card"><span class="academy-card-tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><button type="button" class="academy-text-btn" onclick="academySetLevel('guide')">Zobacz, jak podjąć decyzję <span aria-hidden="true">→</span></button></article>`;}
  function guide(){
    return `<section class="academy-guide" aria-label="Przewodnik decyzji">
      <article class="academy-step"><span>01</span><div><h3>Ustal ograniczenia</h3><p>Ile dni klient realnie trenuje? Jak śpi, jak znosi stres i czy występuje ból? To wyznacza bezpieczny punkt startowy.</p></div></article>
      <article class="academy-step"><span>02</span><div><h3>Dobierz strukturę</h3><p>2–3 dni: najczęściej FBW. 3–4 dni: Upper/Lower. 4–6 dni: PPL lub podział z priorytetem. To hipoteza do sprawdzenia, nie reguła.</p></div></article>
      <article class="academy-step"><span>03</span><div><h3>Ustaw dawkę</h3><p>Wybierz ćwiczenia, serie, powtórzenia i RIR pod cel. Zacznij konserwatywnie, szczególnie po przerwie lub przy wysokim stresie.</p></div></article>
      <article class="academy-step"><span>04</span><div><h3>Sprawdź trend</h3><p>Po 2–4 tygodniach oceń wykonanie, trend RPE, ból i postęp. Zmieniaj jedną zmienną naraz: objętość, ciężar lub częstotliwość.</p></div></article>
    </section>`;
  }
  function contextView(){
    const ctx=context(), signal=planSignal(ctx), has=!!(ctx.clientId||ctx.planName||ctx.daysPerWeek);
    return `<section class="academy-context">
      <div class="academy-context-head"><div><span class="academy-eyebrow">Kontekst tylko do odczytu</span><h2>${has?'Sprawdzenie założeń planu':'Brak otwartego planu'}</h2><p>${has?'Akademia odczytała wartości z kreatora. Nie zapisuje ani nie zmienia danych planu.':'Przejdź do kreatora i użyj „Sprawdź w Progress Academy”, aby zobaczyć analizę konkretnego planu.'}</p></div>${state.returnToBuilder?'<button type="button" class="btn btn-ghost btn-sm" onclick="academyBackToBuilder()">Wróć do kreatora</button>':''}</div>
      ${has?`<dl class="academy-context-data"><div><dt>Klient</dt><dd>${esc(ctx.clientName||'Nie wybrano')}</dd></div><div><dt>Cel</dt><dd>${esc(labelGoal(ctx.goal))}</dd></div><div><dt>Metoda</dt><dd>${esc(ctx.method||'—')}</dd></div><div><dt>Dni treningowe</dt><dd>${ctx.daysPerWeek||'—'}</dd></div></dl>
      <aside class="academy-signal" aria-live="polite"><span aria-hidden="true">◌</span><div><strong>${esc(signal.title)}</strong><p>${esc(signal.text)}</p></div></aside>`:''}
    </section>`;
  }
  function render(){
    const root=document.getElementById('screen-academy'); if(!root)return;
    const body=state.level==='quick'?quick():state.level==='guide'?guide():contextView();
    root.innerHTML=`<div class="topbar"><div><div class="topbar-title">Progress Academy</div><div class="academy-subtitle">Metodyka planowania bez przeciążania kreatora</div></div><div class="topbar-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="goTo('kb')">Baza wiedzy</button></div></div><main class="content academy-content"><header class="academy-hero"><span class="academy-eyebrow">Dla trenera</span><h1>Decyzje treningowe, krok po kroku.</h1><p>Szybka odpowiedź, przewodnik i analiza kontekstu planu — wybierz głębokość wsparcia, której potrzebujesz.</p></header>${helpTabs()}<div class="academy-panel">${body}</div></main>`;
  }
  window.academySetLevel=function(level){state.level=level;render();};
  window.academyFromBuilder=function(){state.context=getBuilderContext();state.returnToBuilder=true;window._builderPreserveOnReturn=true;state.level='context';goTo('academy');};
  window.academyBackToBuilder=function(){
    window._builderPreserveOnReturn=true;
    goTo('builder');
  };
  window.renderProgressAcademy=render;
  const originalGoToRender=window._goToRender;
  // _goToRender is a function declaration in core; add Academy without changing its existing routing.
  document.addEventListener('DOMContentLoaded',render);
  window.addEventListener('load',render);
})();
