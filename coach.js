/* Progress Coach (3.0, etap 3a): nowe sygnały w „Wymagają uwagi” (lista Klienci + pulpit) — to samo źródło (clientIssues).
 *
 * Sygnały (z danych, które już są: wiadomości czatu, zapisane treningi, journey.js):
 *  - pain   „Zgłoszony ból”           — wiadomość klienta „Zgłoszenie bólu…” z ostatnich 7 dni (client-pain.js)      → Odpowiedz
 *  - feel   „Samopoczucie: porozmawiaj” — „Samopoczucie przed treningiem…” z ostatnich 3 dni (client-readiness.js)  → Napisz
 *  - video  „Film techniki do obejrzenia” — wiadomość z [film:…] z ostatnich 7 dni (client-video.js)                  → Obejrzyj
 *  - reward „Nagroda do wręczenia”     — odznaka zdobyta, nagroda przypisana, niewręczona (journey.js)               → Zobacz
 *  - record „Nowy rekord”              — rekord osobisty z ostatnich 7 dni (journey.js pjData)                          → Pogratuluj
 * Rozwiązanie: (1) trener odpisał w czacie po zdarzeniu (pain/feel/video/record) albo wręczył nagrodę — sprawa znika sama;
 * (2) przycisk „Rozwiązane” zapisuje client.coachResolved[key] = czas — sprawa wraca dopiero przy NOWYM zdarzeniu.
 * Bez ocen ryzyka zdrowotnego i bez automatycznych wiadomości — działanie zawsze należy do trenera.
 */
(function(){
  'use strict';
  if(typeof CLIENT_ISSUES!=='object'||typeof CLIENT_ISSUE_ORDER==='undefined'||typeof clientIssues!=='function')return;
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DAY=864e5;
  const plural=(n,a,b,c)=>typeof clPlural==='function'?clPlural(n,a,b,c):(n===1?a:c);

  Object.assign(CLIENT_ISSUES,{
    pain:{sev:'urgent',label:'Zgłoszony ból',action:'Odpowiedz',counts:true,coach:true,
      tip:'Klient zgłosił ból w trakcie treningu. Odpisz mu i zdecyduj, co dalej z planem. Aplikacja nie ocenia przyczyny.',
      many:n=>n+' '+plural(n,'klient zgłosił','klientów zgłosiło','klientów zgłosiło')+' ból'},
    feel:{sev:'warn',label:'Samopoczucie: warto porozmawiać',action:'Napisz',counts:true,coach:true,
      tip:'Przed treningiem klient zaznaczył słabe samopoczucie albo ból. Krótka wiadomość pomoże zdecydować o treningu.',
      many:n=>n+' '+plural(n,'klient potrzebuje','klientów potrzebuje','klientów potrzebuje')+' rozmowy o samopoczuciu'},
    video:{sev:'warn',label:'Film techniki do obejrzenia',action:'Obejrzyj',counts:true,coach:true,
      tip:'Klient przesłał film techniki i czeka na Twoją informację zwrotną.',
      many:n=>n+' '+plural(n,'film czeka','filmy czekają','filmów czeka')+' na obejrzenie'},
    reward:{sev:'info',label:'Nagroda do wręczenia',action:'Zobacz nagrodę',counts:true,coach:true,
      tip:'Klient zdobył odznakę, do której przypisałeś nagrodę. Wręcz ją na najbliższym treningu i zaznacz „wręczona”.',
      many:n=>n+' '+plural(n,'nagroda czeka','nagrody czekają','nagród czeka')+' na wręczenie'},
    record:{sev:'info',label:'Nowy rekord',action:'Pogratuluj',counts:true,coach:true,
      tip:'Klient pobił rekord osobisty. Krótka pochwała buduje motywację.',
      many:n=>n+' '+plural(n,'klient pobił','klientów pobiło','klientów pobiło')+' rekord'}
  });
  // Kolejność = priorytet: ból zaraz po regresie i wygasłym pakiecie; dobre wiadomości na końcu spraw „do zrobienia”.
  const insertAfter=(after,keys)=>{const i=CLIENT_ISSUE_ORDER.indexOf(after);CLIENT_ISSUE_ORDER.splice(i<0?CLIENT_ISSUE_ORDER.length:i+1,0,...keys.filter(k=>!CLIENT_ISSUE_ORDER.includes(k)));};
  insertAfter('expired',['pain']);
  insertAfter('report',['feel','video']);
  insertAfter('expiring',['reward','record']);

  const COACH_KEYS=['pain','feel','video','reward','record'];
  function msgsOf(c){return (window.MSGS&&window.MSGS[c.id])||[];}
  const tsOf=m=>{const t=Date.parse(m&&m.createdAt||'');return Number.isFinite(t)?t:0;};
  /** Czy trener odpisał po czasie t. */
  function trainerRepliedAfter(c,t){return msgsOf(c).some(m=>m&&m.out===true&&tsOf(m)>t);}
  function resolvedAt(c,key){const r=c&&c.coachResolved&&c.coachResolved[key];const t=Date.parse(r||'');return Number.isFinite(t)?t:0;}
  function agoText(t){
    if(typeof attnAgoText==='function')return attnAgoText(t);
    const d=Math.floor((Date.now()-t)/DAY);return d<=0?'dziś':d===1?'wczoraj':d+' dni temu';
  }
  function lastClientMsg(c,re,days){
    const since=Date.now()-days*DAY;
    return msgsOf(c).filter(m=>m&&m.out!==true&&re.test(String(m.text||''))&&tsOf(m)>=since).sort((a,b)=>tsOf(b)-tsOf(a))[0]||null;
  }
  /** Sygnały Coach dla klienta: [{key,label,reason,at}]. */
  function coachSignals(c){
    const out=[];if(!c)return out;
    const add=(key,at,label,reason)=>{if(at&&at>resolvedAt(c,key))out.push({key,label,reason,at});};
    const pain=lastClientMsg(c,/^Zgłoszenie bólu/,7);
    if(pain&&!trainerRepliedAfter(c,tsOf(pain))){
      const area=(/^Zgłoszenie bólu:\s*([^·\n]+)/.exec(pain.text)||[])[1];
      add('pain',tsOf(pain),'Zgłoszony ból'+(area?' — '+area.trim().slice(0,40):''),'Zgłoszone '+agoText(tsOf(pain))+'. Odpisz klientowi.');
    }
    const feel=lastClientMsg(c,/^Samopoczucie przed treningiem/,3);
    if(feel&&!trainerRepliedAfter(c,tsOf(feel)))add('feel',tsOf(feel),CLIENT_ISSUES.feel.label,'Check-in '+agoText(tsOf(feel))+' — warto porozmawiać przed treningiem.');
    const vid=lastClientMsg(c,/\[film:[^\]]+\]/,7);
    if(vid&&!trainerRepliedAfter(c,tsOf(vid))){
      const ex=(/Film techniki:\s*([^\n/]+)/.exec(vid.text)||[])[1];
      add('video',tsOf(vid),'Film do obejrzenia'+(ex?': '+ex.trim().slice(0,40):''),'Przesłany '+agoText(tsOf(vid))+'.');
    }
    try{
      if(typeof pjBadges==='function'){
        const pend=pjBadges(c).filter(b=>b.earned&&b.prize&&!b.givenAt);
        if(pend.length){const t=Math.max(...pend.map(b=>Date.parse(b.at+'T12:00:00')||0));add('reward',t,'Nagroda do wręczenia: '+pend[0].prize,pend.map(b=>'„'+b.name+'” — '+b.prize).join('; '));}
      }
      if(typeof pjData==='function'){
        const d=pjData(c);const last=d.prDates[d.prDates.length-1];
        const t=last?Date.parse(last+'T20:00:00'):0;
        if(t&&Date.now()-t<=7*DAY&&!trainerRepliedAfter(c,Date.parse(last+'T00:00:00')))add('record',t,'Nowy rekord osobisty','Rekord '+agoText(t)+'. Pogratuluj klientowi.');
      }
    }catch(e){}
    return out;
  }

  // Rozszerzenie clientIssues — to samo źródło dla listy Klienci, filtrów i pulpitu.
  const baseIssues=window.clientIssues;
  function clientIssuesWithCoach(c,flags){
    const base=baseIssues(c,flags);
    if(!c||c.status==='archived'||c.status==='inactive')return base;
    let extra=[];try{extra=coachSignals(c);}catch(e){extra=[];}
    return base.concat(extra).sort((a,b)=>CLIENT_ISSUE_ORDER.indexOf(a.key)-CLIENT_ISSUE_ORDER.indexOf(b.key));
  }
  window.clientIssues=clientIssuesWithCoach;

  const baseAction=window.clientDoAction;
  function clientDoActionWithCoach(e,clientId,key){
    if(COACH_KEYS.includes(key)){
      if(e&&e.stopPropagation)e.stopPropagation();
      if(key==='reward'){if(typeof openClientProfile==='function')openClientProfile(clientId,{tab:'plan'});return;}
      if(typeof openChat==='function'){if(typeof goTo==='function')goTo('inbox');setTimeout(()=>openChat(clientId),60);return;}
      if(typeof quickMessageClient==='function')return quickMessageClient(e||{stopPropagation(){}},clientId);
      return;
    }
    return baseAction(e,clientId,key);
  }
  window.clientDoAction=clientDoActionWithCoach;

  function coachResolvable(key){return COACH_KEYS.includes(key)&&key!=='reward';}
  async function coachResolve(clientId,key){
    const c=(window.CL||[]).find(x=>x&&x.id===clientId);if(!c||!coachResolvable(key))return;
    const prev=c.coachResolved;
    c.coachResolved={...(prev||{}),[key]:new Date().toISOString()};
    let ok=false;
    try{ok=typeof persistById==='function'?!!(await persistById('clients',c)):false;}catch(e){ok=false;}
    if(!ok){c.coachResolved=prev;if(typeof notify==='function')notify('Nie udało się zapisać — sprawdź połączenie');return;}
    if(typeof notify==='function')notify('Oznaczono jako rozwiązane');
    try{if(typeof renderClients==='function'&&document.getElementById('screen-clients')&&!document.getElementById('screen-clients').hidden)renderClients();}catch(e){}
    try{if(typeof renderDashOps==='function')renderDashOps();}catch(e){}
  }
  function coachResolveBtnHTML(clientId,key){
    if(!coachResolvable(key))return '';
    return `<button type="button" class="btn btn-ghost btn-sm coach-resolve" data-act="coach-resolve" data-act-stop-prop data-cid="${esc(clientId)}" data-key="${esc(key)}" title="Oznacz jako rozwiązane — wróci tylko przy nowym zdarzeniu">Rozwiązane</button>`;
  }
  if(typeof uiAction==='function')uiAction('coach-resolve',d=>{coachResolve(d.cid,d.key);});

  Object.assign(window,{coachSignals,coachResolvable,coachResolve,coachResolveBtnHTML,COACH_KEYS});
})();
