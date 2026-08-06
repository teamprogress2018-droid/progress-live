// ════════════════════════════════════════
// INBOX
// ════════════════════════════════════════
// ════════════════════════════════════════
// INBOX — ENHANCED
// ════════════════════════════════════════
var inboxTab='all';
const QUICK_REPLIES=['Dziękuję za informację!','Rozumiem, zajmę się tym.','Świetna robota! 💪','Pamiętaj o treningu!','Proszę wypełnić formularz postępów.','Kiedy możemy się spotkać?'];
const CLIENT_NOTES={};// clientId -> [{text, date}]
const CLIENT_ACTIVITY={};// clientId -> [{type, text, date, icon}]

function initClientData(c){
  if(!CLIENT_NOTES[c.id])CLIENT_NOTES[c.id]=[
    {text:'Klient preferuje treningi rano przed 8:00',date:'14 maj, 7:36'},
    {text:'Cel: redukcja 5kg do końca lata',date:'9 maj, 7:36'},
  ];
  if(!CLIENT_ACTIVITY[c.id])CLIENT_ACTIVITY[c.id]=[
    {type:'workout',text:'Ukończył trening — Push Day',date:'dziś 9:15',icon:'💪'},
    {type:'metric',text:'Zaktualizował pomiary (masa: -0.5kg)',date:'wczoraj 8:00',icon:'📏'},
    {type:'form',text:'Wypełnił formularz postępów',date:'3 dni temu',icon:'📋'},
    {type:'task',text:'Ukończył zadanie: 3 treningi w tygodniu',date:'4 dni temu',icon:'✅'},
    {type:'message',text:'Wysłał wiadomość',date:'tydzień temu',icon:'💬'},
  ];
}

function setInboxTab(t){
  inboxTab=t;
  document.querySelectorAll('.inbox-tab').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('itab-'+t);if(el)el.classList.add('active');
  renderInbox();
}

function renderInbox(){
  const search=(document.getElementById('inbox-search')||{}).value||'';
  let list=CL.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase()));
  if(inboxTab==='unread')list=list.filter((c,i)=>i%3===0);// simulate unread
  if(inboxTab==='groups')list=[];// groups placeholder

  const el=document.getElementById('msg-list');
  if(!el)return;

  if(inboxTab==='groups'){
    el.innerHTML=`<div style="padding:30px;text-align:center;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:10px;opacity:0.3;">👥</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Grupy wkrótce</div>
      <div style="font-size:11px;">Wyślij wiadomość do grupy klientów naraz</div>
    </div>`;
    return;
  }

  if(!list.length){
    el.innerHTML='<div style="padding:30px;text-align:center;color:var(--muted);font-size:12px;">Brak rozmów</div>';
    return;
  }

  el.innerHTML=list.map((c,i)=>{
    const msgs=MSGS[c.id]||[];
    const last=msgs.slice(-1)[0];
    const unread=i%3===0&&msgs.length===0;
    const time=last?last.time:'';
    const col=COLS[i%5];
    return `<div class="msg-item-enhanced${curChat===c.id?' active':''}" onclick="openChat('${c.id}')">
      <div class="msg-avatar" style="background:${col}22;color:${col};">${getInit(c.name)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <div style="font-size:13px;font-weight:${unread?700:500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
          <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;flex-shrink:0;margin-left:4px;">${time}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${last?last.text:(unread?'Nowa wiadomość':'Brak wiadomości')}</div>
      </div>
      ${unread?'<div class="msg-unread-dot"></div>':''}
    </div>`;
  }).join('');
}

function openChat(id){
  curChat=id;
  const c=CL.find(x=>x.id===id);
  if(!c)return;
  if(!MSGS[id])MSGS[id]=[];
  initClientData(c);
  const ci=CL.indexOf(c);
  const col=COLS[ci%5];

  // header
  document.getElementById('msg-to').textContent=c.name;
  document.getElementById('msg-header-actions').innerHTML=`
    <button class="btn btn-ghost btn-sm" onclick="openM('m-metric-entry')" title="Dodaj pomiar">📏</button>
    <button class="btn btn-ghost btn-sm" onclick="openM('m-task')" title="Dodaj zadanie">✅</button>
    <button class="btn btn-ghost btn-sm" onclick="openM('m-send-form')" title="Wyślij formularz">📋</button>`;

  // messages
  const wrap=document.getElementById('msg-wrap');
  wrap.innerHTML=MSGS[id].length?MSGS[id].map(m=>`
    <div style="margin-bottom:12px;${m.out?'text-align:right;':''}">
      <div class="msg-bubble ${m.out?'msg-out':'msg-in'}">${m.text}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:3px;">${m.time}</div>
    </div>`).join('')
    :`<div style="text-align:center;padding:40px 20px;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:8px;">👋</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Zacznij rozmowę z ${c.name}</div>
      <div style="font-size:11px;">Wyślij wiadomość lub wybierz szybką odpowiedź poniżej</div>
    </div>`;
  wrap.scrollTop=wrap.scrollHeight;

  // quick replies
  document.getElementById('quick-replies').innerHTML=QUICK_REPLIES.map(r=>
    `<button class="quick-reply-btn" onclick="useQuickReply('${r.replace(/'/g,"\\'")}')">${r}</button>`
  ).join('');

  // right panel
  const cipH=document.getElementById('cip-header');
  cipH.innerHTML=`
    <div style="width:52px;height:52px;border-radius:50%;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:20px;margin:0 auto 10px;">${getInit(c.name)}</div>
    <div style="font-size:14px;font-weight:700;">${c.name}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px;">${c.goal||'Brak celu'} · ${c.level||''}</div>
    <div style="display:flex;gap:5px;justify-content:center;margin-top:10px;">
      <span class="pill ${c.status==='inactive'?'pill-red':'pill-green'}" style="font-size:10px;"><span class="pill-dot"></span>${c.status==='inactive'?'Offline':'Aktywny'}</span>
    </div>`;

  const notes=CLIENT_NOTES[id]||[];
  const activity=CLIENT_ACTIVITY[id]||[];
  document.getElementById('cip-body').innerHTML=`
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;">Notatki (${notes.length})</div>
        <button onclick="addClientNote('${id}')" style="background:none;border:none;color:var(--accent);font-size:18px;cursor:pointer;line-height:1;">+</button>
      </div>
      ${notes.map(n=>`<div class="cip-note">
        <div>${n.text}</div>
        <div class="cip-note-date">${n.date}</div>
      </div>`).join('')}
      <div id="note-input-${id}" style="display:none;margin-top:6px;">
        <textarea id="note-text-${id}" placeholder="Dodaj notatkę..." rows="2" style="width:100%;background:var(--s4);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;color:var(--text);font-size:11px;resize:none;font-family:'DM Sans',sans-serif;"></textarea>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button onclick="saveClientNote('${id}')" class="btn btn-primary btn-sm" style="flex:1;">Zapisz</button>
          <button onclick="document.getElementById('note-input-${id}').style.display='none'" class="btn btn-ghost btn-sm">Anuluj</button>
        </div>
      </div>
    </div>
    <div style="padding:12px 14px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Aktywność</div>
      ${activity.map(a=>`<div class="cip-activity-item">
        <div class="cip-activity-icon" style="background:var(--s3);">${a.icon}</div>
        <div><div style="font-size:11px;color:var(--text);">${a.text}</div><div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;">${a.date}</div></div>
      </div>`).join('')}
    </div>`;

  renderInbox();
}

function useQuickReply(text){
  const inp=document.getElementById('msg-inp');
  if(inp)inp.value=text;
  inp.focus();
}

function addClientNote(id){
  const ni=document.getElementById('note-input-'+id);
  if(ni)ni.style.display='block';
  const nt=document.getElementById('note-text-'+id);
  if(nt)nt.focus();
}

function saveClientNote(id){
  const nt=document.getElementById('note-text-'+id);
  if(!nt||!nt.value.trim())return;
  if(!CLIENT_NOTES[id])CLIENT_NOTES[id]=[];
  CLIENT_NOTES[id].unshift({text:nt.value.trim(),date:new Date().toLocaleDateString('pl',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})});
  openChat(id);notify('Notatka zapisana ✓');
}

function sendMsg(){
  const inp=document.getElementById('msg-inp');
  const txt=inp?inp.value.trim():'';
  if(!txt||!curChat)return;
  if(!MSGS[curChat])MSGS[curChat]=[];
  MSGS[curChat].push({text:txt,out:true,time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'})});
  inp.value='';inp.style.height='auto';
  openChat(curChat);
}

function sendBroadcast(){
  const msg=document.getElementById('bc-msg').value.trim();
  if(!msg){notify('Wpisz wiadomość!');return;}
  const target=document.getElementById('bc-target').value;
  let targets=CL;
  if(target==='active')targets=CL.filter(c=>c.status==='active');
  if(target==='inactive')targets=CL.filter(c=>c.status==='inactive');
  targets.forEach(c=>{
    if(!MSGS[c.id])MSGS[c.id]=[];
    const text=msg.replace(/{imie}/g,c.name.split(' ')[0]);
    MSGS[c.id].push({text,out:true,time:new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'})});
  });
  closeM('m-broadcast');
  renderInbox();
  notify('✓ Broadcast wysłany do '+targets.length+' klientów');
}

// ════════════════════════════════════════
// EXERCISE LIBRARY — ENHANCED
// ════════════════════════════════════════
var exView='grid';var exCatFilter='Wszystkie';var exEquipFilter='';var exSelId=null;

const CAT_COLORS_EX={
  'Klatka piersiowa':'var(--blue)',
  'Plecy':'var(--purple)',
  'Barki':'var(--orange)',
  'Nogi':'var(--teal)',
  'Biceps':'#f59e0b',
  'Triceps':'#ec4899',
  'Core':'var(--accent)',
  'Pośladki':'var(--red)',
  'Cardio':'#14b8a6',
};

const DEF_EX=[
  {name:'Wyciskanie sztangi leżąc',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Klatka (główna), Triceps, Barki (przednie)',tip:'Łopatki ściągnięte i wciśnięte w ławkę. Pełny ROM.',nsca:'Hipertrofia: 3-4x8-12, RPE 8. Siła: 4-6x3-5.',alt:'Wyciskanie hantli, Pompki'},
  {name:'Wyciskanie hantli leżąc',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka (główna), Triceps',tip:'Hantle w jednej linii z klatką.',nsca:'3x10-12.',alt:'Wyciskanie sztangi, Pompki'},
  {name:'Wyciskanie hantli skos+',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka górna, Barki (przednie)',tip:'Kąt ławki 30-45°.',nsca:'3x10-12.',alt:'Wyciskanie sztangi skos, Pompki na rączkach'},
  {name:'Rozpiętki hantlami',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka (izolacja)',tip:'Lekkie ugięcie łokci. Skup się na rozciągnięciu klatki.',nsca:'3x12-15.',alt:'Rozpiętki na wyciągu, Peck deck'},
  {name:'Rozpiętki na wyciągu',cat:'Klatka piersiowa',eq:'Wyciąg',muscle:'Klatka (izolacja), stałe napięcie',tip:'Stałe napięcie przez cały ruch.',nsca:'3x12-15.',alt:'Rozpiętki hantlami, Peck deck'},
  {name:'Pompki',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka piersiowa, Triceps, Core',tip:'Ciało w jednej linii.',nsca:'3-4xmax.',alt:'Wyciskanie sztangi, Wyciskanie hantli'},
  {name:'Pompki na rączkach',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka (dolna), Triceps',tip:'Głębszy zakres ruchu.',nsca:'3x10-15.',alt:'Dipy, Pompki'},
  {name:'Dipy na poręczach',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka (dolna), Triceps, Barki',tip:'Pochylenie do przodu = więcej klatki.',nsca:'3x8-12.',alt:'Pompki na rączkach'},
  {name:'Peck deck',cat:'Klatka piersiowa',eq:'Maszyna',muscle:'Klatka (izolacja)',tip:'Łokcie na poziomie barków.',nsca:'3x12-15.',alt:'Rozpiętki hantlami'},
  {name:'Pullover hantlem',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka, Najszerszy',tip:'Pełny zakres ruchu. Rozciągnięcie na dole.',nsca:'3x12-15.',alt:'Pullover sztangą'},
  {name:'Pompki plyometryczne',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka, Triceps, Moc',tip:'Wybij się z podłogi.',nsca:'3x5-8.',alt:'Pompki'},
  {name:'Wyciskanie wąskim chwytem',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Triceps (główny), Klatka (wewnętrzna)',tip:'Łokcie blisko tułowia.',nsca:'3x8-12.',alt:'French press, Dipy'},
  {name:'Martwy ciąg klasyczny',cat:'Plecy',eq:'Sztanga',muscle:'Dwugłowy uda, Pośladki, Prostownicy grzbietu',tip:'Kręgosłup neutralny przez cały czas!',nsca:'Siła: 3-5x3-5. Hipertrofia: 3x8-10.',alt:'Martwy ciąg RDL, Trap bar deadlift'},
  {name:'Martwy ciąg RDL',cat:'Plecy',eq:'Sztanga',muscle:'Dwugłowy uda, Pośladki, Prostownicy grzbietu',tip:'Biodra do tyłu, kręgosłup neutralny.',nsca:'3-4x10-12.',alt:'Martwy ciąg klasyczny, Good morning'},
  {name:'Wiosłowanie sztangą',cat:'Plecy',eq:'Sztanga',muscle:'Plecy środkowe, Biceps, Barki (tylne)',tip:'Tułów pod kątem 45°. Ciągnij do bioder.',nsca:'3-4x8-12.',alt:'Wiosłowanie hantlem, Wyciąg'},
  {name:'Wiosłowanie hantlem',cat:'Plecy',eq:'Hantle',muscle:'Plecy środkowe (jednostronnie), Biceps',tip:'Kolano i ręka oparte o ławkę.',nsca:'3x10-12/stronę.',alt:'Wiosłowanie sztangą'},
  {name:'Podciąganie na drążku',cat:'Plecy',eq:'Własna masa',muscle:'Plecy (szerokie), Biceps, Tylne barki',tip:'Nie bujaj się! Pełny ROM.',nsca:'3-4xmax.',alt:'Ściąganie drążka wyciąg'},
  {name:'Podciąganie neutralnym chwytem',cat:'Plecy',eq:'Własna masa',muscle:'Plecy (szerokie i środkowe), Biceps',tip:'Dłonie zwrócone do siebie.',nsca:'3xmax.',alt:'Podciąganie na drążku'},
  {name:'Ściąganie drążka wyciąg',cat:'Plecy',eq:'Wyciąg',muscle:'Najszerszy, Biceps',tip:'Drążek do górnej klatki, łokcie do dołu.',nsca:'3x10-12.',alt:'Podciąganie na drążku'},
  {name:'Wiosłowanie wyciągiem siedząc',cat:'Plecy',eq:'Wyciąg',muscle:'Plecy środkowe, Biceps, Rombowate',tip:'Ściągaj łopatki.',nsca:'3x12.',alt:'Wiosłowanie sztangą'},
  {name:'Facepull',cat:'Plecy',eq:'Wyciąg',muscle:'Tylne barki, Rombowate, Rotatory',tip:'Wyciągaj do czoła, łokcie wysoko.',nsca:'3x15-20.',alt:'Odwrotne rozpiętki'},
  {name:'Good morning',cat:'Plecy',eq:'Sztanga',muscle:'Prostownicy grzbietu, Dwugłowy uda',tip:'Kręgosłup neutralny. Biodra cofaj do tyłu.',nsca:'3x10-12.',alt:'RDL, Hyperextension'},
  {name:'Hyperextension',cat:'Plecy',eq:'Własna masa',muscle:'Prostownicy grzbietu, Pośladki',tip:'Nie przeginaj. Zatrzymaj się w linii ciała.',nsca:'3x12-15.',alt:'Good morning, RDL'},
  {name:'Odwrotne rozpiętki',cat:'Plecy',eq:'Hantle',muscle:'Tylne barki, Rombowate',tip:'Tułów równoległy do podłogi.',nsca:'3x15.',alt:'Facepull, Wiosłowanie'},
  {name:'Inverted row',cat:'Plecy',eq:'Własna masa',muscle:'Plecy środkowe, Biceps',tip:'Leżąc pod drążkiem. Ciągnij klatkę do drążka.',nsca:'3xmax.',alt:'Wiosłowanie, Podciąganie'},
  {name:'Chest supported row',cat:'Plecy',eq:'Hantle',muscle:'Plecy środkowe (bez dolnego grzbietu)',tip:'Klatka na ławce pod kątem.',nsca:'3x12.',alt:'Wiosłowanie hantlem'},
  {name:'Wyciskanie żołnierskie OHP',cat:'Barki',eq:'Sztanga',muscle:'Barki (przednie i środkowe), Triceps',tip:'Napnij pośladki i brzuch.',nsca:'3-4x6-10.',alt:'Wyciskanie hantli, Arnold press'},
  {name:'Wyciskanie hantli siedząc',cat:'Barki',eq:'Hantle',muscle:'Barki (przednie i środkowe), Triceps',tip:'Hantle na poziomie uszu.',nsca:'3x10-12.',alt:'OHP, Arnold press'},
  {name:'Arnold press',cat:'Barki',eq:'Hantle',muscle:'Barki (wszystkie głowy), Triceps',tip:'Obrót dłoni podczas wyciskania.',nsca:'3x10-12.',alt:'Wyciskanie hantli, OHP'},
  {name:'Unoszenie bokiem',cat:'Barki',eq:'Hantle',muscle:'Barki (środkowe)',tip:'Lekkie ugięcie łokci. Nie zamachy!',nsca:'3x15-20.',alt:'Unoszenie wyciągiem'},
  {name:'Unoszenie przodem',cat:'Barki',eq:'Hantle',muscle:'Barki (przednie)',tip:'Do wysokości barków, nie wyżej.',nsca:'3x12-15.',alt:'OHP, Unoszenie wyciągiem'},
  {name:'Unoszenie wyciągiem bokiem',cat:'Barki',eq:'Wyciąg',muscle:'Barki (środkowe), stałe napięcie',tip:'Lepsza aktywacja niż hantle.',nsca:'3x15-20.',alt:'Unoszenie bokiem hantlami'},
  {name:'Odwrotne rozpiętki maszyna',cat:'Barki',eq:'Maszyna',muscle:'Tylne barki, Rombowate',tip:'Łokcie na poziomie barków.',nsca:'3x15.',alt:'Facepull, Odwrotne rozpiętki'},
  {name:'Rotacja zewnętrzna',cat:'Barki',eq:'Hantle',muscle:'Rotatory barku, Podgrzebieniowy',tip:'Łokieć przy boku pod kątem 90°.',nsca:'2-3x15-20.',alt:'Rotacja na wyciągu, Facepull'},
  {name:'Push press',cat:'Barki',eq:'Sztanga',muscle:'Barki, Triceps, Moc eksplozywna',tip:'Lekki dip kolanami i wybicie.',nsca:'3x5-8.',alt:'OHP'},
  {name:'Cuban press',cat:'Barki',eq:'Hantle',muscle:'Rotatory barku, Tylne barki',tip:'Zewnętrzna rotacja + wyciskanie.',nsca:'3x10-12.',alt:'Rotacja zewnętrzna, Facepull'},
  {name:'Uginanie biceps sztangą',cat:'Biceps',eq:'Sztanga',muscle:'Biceps (głowa długa i krótka)',tip:'Łokieć stabilny przy boku.',nsca:'3x8-12.',alt:'Uginanie hantlami'},
  {name:'Uginanie młotkowe',cat:'Biceps',eq:'Hantle',muscle:'Biceps (głowa długa), Ramiennopromieniowy',tip:'Neutralny chwyt — kciuk do góry.',nsca:'3x10-12.',alt:'Uginanie biceps sztangą'},
  {name:'Uginanie hantlami naprzemiennie',cat:'Biceps',eq:'Hantle',muscle:'Biceps, Ramiennopromieniowy',tip:'Pełna supinacja przy uginaniu.',nsca:'3x10-12/stronę.',alt:'Uginanie sztangą'},
  {name:'Uginanie na wyciągu',cat:'Biceps',eq:'Wyciąg',muscle:'Biceps, stałe napięcie',tip:'Lepsze dla szczytowej kontrakcji.',nsca:'3x12-15.',alt:'Uginanie hantlami'},
  {name:'Spider curl',cat:'Biceps',eq:'Hantle',muscle:'Biceps (szczytowa kontrakcja)',tip:'Klatka oparta na ławce. Maksymalna izolacja.',nsca:'3x12-15.',alt:'Uginanie koncentryczne'},
  {name:'Uginanie Zottman',cat:'Biceps',eq:'Hantle',muscle:'Biceps, Ramiennopromieniowy, Przedramię',tip:'Supinacja w górze, pronacja w dół.',nsca:'3x10-12.',alt:'Uginanie młotkowe'},
  {name:'Uginanie reverse',cat:'Biceps',eq:'Sztanga',muscle:'Ramiennopromieniowy, Przedramię',tip:'Chwyt pronacyjny. Wzmacnia przedramię.',nsca:'3x12-15.',alt:'Uginanie Zottman'},
  {name:'Uginanie nadgarstka',cat:'Biceps',eq:'Sztanga',muscle:'Zginacze nadgarstka, Przedramię',tip:'Nadgarstek opiera się o ławkę.',nsca:'3x15-20.',alt:'Uginanie reverse'},
  {name:'Prostowanie tricepsa wyciąg',cat:'Triceps',eq:'Wyciąg',muscle:'Triceps (wszystkie 3 głowy)',tip:'Łokcie przy tułowiu, nie ruszaj nimi.',nsca:'3x12-15.',alt:'French press, Skull crusher'},
  {name:'French press',cat:'Triceps',eq:'Sztanga',muscle:'Triceps (długa głowa)',tip:'Łokcie skierowane do sufitu.',nsca:'3x10-12.',alt:'Prostowanie wyciąg, Skull crusher'},
  {name:'Skull crusher',cat:'Triceps',eq:'Sztanga',muscle:'Triceps (długa i boczna głowa)',tip:'Opuszczaj do czoła lub za głowę.',nsca:'3x10-12.',alt:'French press'},
  {name:'Kick back triceps',cat:'Triceps',eq:'Hantle',muscle:'Triceps (boczna i przyśrodkowa głowa)',tip:'Pełne wyprostowanie ramienia.',nsca:'3x12-15.',alt:'Prostowanie wyciąg'},
  {name:'Overhead triceps wyciąg',cat:'Triceps',eq:'Wyciąg',muscle:'Triceps (długa głowa — rozciągnięcie)',tip:'Wyciąg za głowę.',nsca:'3x12-15.',alt:'French press'},
  {name:'Przysiad ze sztangą',cat:'Nogi',eq:'Sztanga',muscle:'Czworogłowy, Pośladki, Dwugłowy, Prostownicy',tip:'Kolana w kierunku palców. Biodra poniżej kolan.',nsca:'Siła: 4-6x3-5. Hipertrofia: 3-4x8-12.',alt:'Przysiad goblet, Front squat, Leg press'},
  {name:'Przysiad Goblet',cat:'Nogi',eq:'Hantle',muscle:'Czworogłowy, Pośladki, Core',tip:'Hantel trzymaj przy klatce.',nsca:'3x12-15.',alt:'Przysiad ze sztangą'},
  {name:'Front squat',cat:'Nogi',eq:'Sztanga',muscle:'Czworogłowy (głównie), Pośladki, Core',tip:'Łokcie wysoko, klatka dumna.',nsca:'3-4x6-10.',alt:'Przysiad ze sztangą'},
  {name:'Przysiad sumo',cat:'Nogi',eq:'Sztanga',muscle:'Pośladki, Przywodziciele, Czworogłowy',tip:'Szerokie ustawienie stóp, palce na zewnątrz.',nsca:'3x8-12.',alt:'Przysiad klasyczny'},
  {name:'Leg press',cat:'Nogi',eq:'Maszyna',muscle:'Czworogłowy, Pośladki, Dwugłowy uda',tip:'Nie blokuj kolan całkowicie.',nsca:'3-4x10-15.',alt:'Przysiad ze sztangą'},
  {name:'Wykrok ze sztangą',cat:'Nogi',eq:'Sztanga',muscle:'Czworogłowy, Pośladki (jednostronnie)',tip:'Kolano tylne blisko podłogi.',nsca:'3x10-12/noga.',alt:'Wykrok z hantlami, Bulgarian split squat'},
  {name:'Bulgarian split squat',cat:'Nogi',eq:'Hantle',muscle:'Czworogłowy, Pośladki (izolacja jednostronna)',tip:'Tylna noga na ławce.',nsca:'3x8-12/noga.',alt:'Wykrok'},
  {name:'Hip thrust',cat:'Nogi',eq:'Sztanga',muscle:'Pośladki (izolacja), Dwugłowy uda',tip:'Ściśnij pośladki maksymalnie na górze.',nsca:'3-4x10-15.',alt:'Mostek biodrowy'},
  {name:'Mostek biodrowy',cat:'Nogi',eq:'Własna masa',muscle:'Pośladki, Dwugłowy uda',tip:'Zatrzymanie na górze 2 sek.',nsca:'3x15-20.',alt:'Hip thrust'},
  {name:'Rumuński martwy ciąg',cat:'Nogi',eq:'Sztanga',muscle:'Pośladki, Dwugłowy uda, Dolny grzbiet',tip:'Biodra do tyłu, plecy proste.',nsca:'3x10-12.',alt:'RDL hantlami'},
  {name:'Uginanie nóg maszyna',cat:'Nogi',eq:'Maszyna',muscle:'Dwugłowy uda (izolacja)',tip:'Pełny zakres ruchu.',nsca:'3x12-15.',alt:'RDL'},
  {name:'Wyprosty nóg maszyna',cat:'Nogi',eq:'Maszyna',muscle:'Czworogłowy (izolacja)',tip:'Zatrzymaj na górze 1 sek.',nsca:'3x12-15.',alt:'Przysiad, Leg press'},
  {name:'Wspięcia na palce',cat:'Nogi',eq:'Maszyna',muscle:'Łydki (brzuchaty i płaszczkowaty)',tip:'Pełny zakres. Powolne tempo.',nsca:'4x15-20.',alt:'Wspięcia na palce stojąc'},
  {name:'Wspięcia na palce jednonóż',cat:'Nogi',eq:'Własna masa',muscle:'Łydki (jednostronnie)',tip:'Trzymaj się czegoś dla balansu.',nsca:'3x15-20/noga.',alt:'Wspięcia na palce'},
  {name:'Step-up',cat:'Nogi',eq:'Hantle',muscle:'Czworogłowy, Pośladki (jednostronnie)',tip:'Ciężar na pięcie.',nsca:'3x10-12/noga.',alt:'Wykrok, Bulgarian split squat'},
  {name:'Sumo deadlift',cat:'Nogi',eq:'Sztanga',muscle:'Pośladki, Przywodziciele, Czworogłowy, Grzbiet',tip:'Szerokie ustawienie, palce na zewnątrz.',nsca:'3-5x3-6.',alt:'Martwy ciąg klasyczny'},
  {name:'Hack squat maszyna',cat:'Nogi',eq:'Maszyna',muscle:'Czworogłowy (głównie), Pośladki',tip:'Plecy płasko przy podparciu.',nsca:'3x10-12.',alt:'Leg press'},
  {name:'Przysiad jednonóż (pistol)',cat:'Nogi',eq:'Własna masa',muscle:'Czworogłowy, Pośladki, Stabilizacja',tip:'Zacznij od wersji na skrzynię.',nsca:'3x5-8/noga.',alt:'Bulgarian split squat'},
  {name:'Box squat',cat:'Nogi',eq:'Sztanga',muscle:'Pośladki, Czworogłowy',tip:'Usiąść na skrzynię, zatrzymać się, wstać.',nsca:'4x5-6.',alt:'Przysiad ze sztangą'},
  {name:'Single leg RDL',cat:'Nogi',eq:'Hantle',muscle:'Pośladki, Dwugłowy uda (jednostronnie)',tip:'Biodra równo. Powolne opuszczanie.',nsca:'3x10-12/noga.',alt:'RDL, Bulgarian split squat'},
  {name:'Nordic curl',cat:'Nogi',eq:'Własna masa',muscle:'Dwugłowy uda (ekscentryczne)',tip:'Nogi przytrzymane. Opuszczaj ciało powoli.',nsca:'3x5-8.',alt:'Uginanie nóg'},
  {name:'Wall sit',cat:'Nogi',eq:'Własna masa',muscle:'Czworogłowy (izometria), Pośladki',tip:'Plecy na ścianie, uda równoległe do podłogi.',nsca:'3x45-60 sek.',alt:'Przysiad'},
  {name:'Trap bar deadlift',cat:'Nogi',eq:'Sztanga',muscle:'Czworogłowy, Pośladki, Grzbiet',tip:'Bardziej pionowy tułów niż konwencjonalny deadlift.',nsca:'3-5x4-8.',alt:'Martwy ciąg klasyczny'},
  {name:'Kickback pośladki',cat:'Pośladki',eq:'Wyciąg',muscle:'Pośladki (izolacja)',tip:'Kontrolowany ruch. Maksymalna kontrakcja na górze.',nsca:'3x15-20/noga.',alt:'Hip thrust, Mostek'},
  {name:'Abdukcja biodra maszyna',cat:'Pośladki',eq:'Maszyna',muscle:'Pośladki (średni i mały)',tip:'Kontrolowane odwodzenie.',nsca:'3x15-20.',alt:'Monster walk'},
  {name:'Hip thrust jednonóż',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki (jednostronnie)',tip:'Jedna noga uniesiona.',nsca:'3x12-15/noga.',alt:'Hip thrust'},
  {name:'Monster walk',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki (średni), Stabilizatory biodra',tip:'Taśma oporowa powyżej kolan.',nsca:'3x15 kroków/stronę.',alt:'Abdukcja maszyna'},
  {name:'Clamshell',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki (średni i mały)',tip:'Leżąc na boku. Otwieraj kolano jak muszla.',nsca:'3x15-20/stronę.',alt:'Monster walk'},
  {name:'Plank',cat:'Core',eq:'Własna masa',muscle:'Core (anteriora), Pośladki, Barki',tip:'45-60s/serie. Biodra nie opadają.',nsca:'2-3x45-60s.',alt:'Deska boczna, Ab wheel'},
  {name:'Ab wheel rollout',cat:'Core',eq:'Własna masa',muscle:'Core (przedni — prosty), Barki',tip:'Zacznij od wersji na kolanach.',nsca:'3x8-12.',alt:'Plank, Hollow hold'},
  {name:'Hollow hold',cat:'Core',eq:'Własna masa',muscle:'Core (głęboki), Biodra',tip:'Plecy płasko na podłodze.',nsca:'3x20-30s.',alt:'Plank, Ab wheel'},
  {name:'Dragon flag',cat:'Core',eq:'Własna masa',muscle:'Core (cały), Biodra',tip:'Bardzo zaawansowane. Ciało w linii.',nsca:'3x5-8.',alt:'Ab wheel, Hollow hold'},
  {name:'Deska boczna',cat:'Core',eq:'Własna masa',muscle:'Skośne brzucha, Biodra',tip:'Biodra nie opadają. Ciało w linii bocznej.',nsca:'3x30-45s/stronę.',alt:'Plank'},
  {name:'Dead bug',cat:'Core',eq:'Własna masa',muscle:'Core głęboki, Biodra, Stabilizacja',tip:'Plecy ZAWSZE przyciśnięte do podłogi.',nsca:'3x8-10/stronę.',alt:'Bird dog, Plank'},
  {name:'Bird dog',cat:'Core',eq:'Własna masa',muscle:'Core głęboki, Prostownicy grzbietu, Pośladki',tip:'Wyciągnij przeciwne ramię i nogę.',nsca:'3x10/stronę.',alt:'Dead bug'},
  {name:'Brzuszki klasyczne',cat:'Core',eq:'Własna masa',muscle:'Prosty brzucha (górny)',tip:'Nie ciągnij za szyję.',nsca:'3x15-20.',alt:'Crunch maszyna, Zwisy nóg'},
  {name:'Zwisy nóg drążek',cat:'Core',eq:'Własna masa',muscle:'Prosty brzucha (dolny), Biodra',tip:'Nogi proste lub ugięte.',nsca:'3x10-15.',alt:'Unoszenie kolan'},
  {name:'Russian twist',cat:'Core',eq:'Własna masa',muscle:'Skośne brzucha, Core rotacyjny',tip:'Plecy pod kątem 45°.',nsca:'3x15/stronę.',alt:'Woodchop'},
  {name:'Woodchop wyciąg',cat:'Core',eq:'Wyciąg',muscle:'Skośne brzucha, Core rotacyjny',tip:'Ruch diagonalny od góry do dołu.',nsca:'3x12/stronę.',alt:'Russian twist, Pallof press'},
  {name:'Pallof press',cat:'Core',eq:'Wyciąg',muscle:'Core antyrotacyjny, Stabilizacja kręgosłupa',tip:'Opieraj się rotacji.',nsca:'3x10-12/stronę.',alt:'Woodchop, Plank'},
  {name:'Farmer carry',cat:'Core',eq:'Hantle',muscle:'Chwyt, Core, Trapez, Całe ciało',tip:'Plecy proste, ramiona w dół.',nsca:'3x20-30 m.',alt:'Suitcase carry'},
  {name:'Hanging knee raise',cat:'Core',eq:'Własna masa',muscle:'Core dolny, Biodra',tip:'Wisisz na drążku. Kolana do klatki.',nsca:'3x15.',alt:'Zwisy nóg'},
  {name:'Toes to bar',cat:'Core',eq:'Własna masa',muscle:'Core (cały), Biodra',tip:'Wisisz na drążku. Nogi proste do drążka.',nsca:'3x8-10.',alt:'Hanging knee raise'},
  {name:'V-up',cat:'Core',eq:'Własna masa',muscle:'Core (cały), Biodra',tip:'Unieś jednocześnie nogi i tułów.',nsca:'3x12-15.',alt:'Brzuszki, Hollow hold'},
  {name:'Dead hang',cat:'Core',eq:'Własna masa',muscle:'Chwyt, Barki, Kręgosłup (dekompresja)',tip:'Wisisz swobodnie na drążku.',nsca:'3xmax czas.',alt:'Farmer carry, Podciąganie'},
  {name:'Jumping jacks',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Całe ciało, Cardio',tip:'Zacznij powoli, przyspieszaj.',nsca:'2-3 min.',alt:'High knees, Bieganie w miejscu'},
  {name:'High knees',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra, Czworogłowy, Cardio',tip:'Kolana do klatki. Ramiona aktywnie.',nsca:'3x30 sek.',alt:'Jumping jacks, Butt kicks'},
  {name:'Butt kicks',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Dwugłowy uda, Łydki, Cardio',tip:'Pięty do pośladków.',nsca:'3x30 sek.',alt:'High knees'},
  {name:'Inchworm',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Łańcuch tylny, Core, Barki',tip:'Powoli przemieszczaj ręce do przodu.',nsca:'3x8-10 powt.',alt:'Bear crawl'},
  {name:'Bear crawl',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Core, Barki, Biodra, Koordynacja',tip:'Kolana kilka cm nad podłogą.',nsca:'3x10 m.',alt:'Inchworm'},
  {name:'Leg swing przód-tył',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra (mobilizacja), Dwugłowy uda',tip:'Trzymaj się ściany. Swobodny zamach.',nsca:'2x15/noga.',alt:'Leg swing boczny'},
  {name:'Leg swing boczny',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Przywodziciele, Biodra',tip:'Boczne machy nogi.',nsca:'2x15/noga.',alt:'Leg swing przód-tył'},
  {name:'Hip circle',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra (mobilizacja 360°)',tip:'Szerokie, kontrolowane kółka biodrami.',nsca:'2x10/kierunek.',alt:'Leg swing, Cat-cow'},
  {name:'Arm circle',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Barki (mobilizacja)',tip:'Małe do dużych kółek.',nsca:'2x15/kierunek.',alt:'Shoulder roll'},
  {name:'Cat-cow',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Kręgosłup (mobilizacja), Core',tip:'Naprzemienne wyginanie i prostowanie kręgosłupa.',nsca:'2-3x10.',alt:'Child pose, Thread the needle'},
  {name:'Thread the needle',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Kręgosłup piersiowy (rotacja), Barki',tip:'Przeciągnij rękę pod ciałem.',nsca:'2x8/stronę.',alt:'Cat-cow'},
  {name:'World greatest stretch',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra, Kręgosłup, Barki — mobilizacja',tip:'Wykrok + rotacja + skrzyżowanie ramion.',nsca:'2x5/stronę.',alt:'Couch stretch, Hip 90/90'},
  {name:'Hip 90/90',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra (rotacja wewnętrzna i zewnętrzna)',tip:'Nogi ugięte pod kątem 90° po obu stronach.',nsca:'2x10/stronę.',alt:'World greatest stretch'},
  {name:'Couch stretch',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Prostownik biodra, Czworogłowy',tip:'Tylna noga oparta o ścianę. Biodra pchaj do przodu.',nsca:'2x30-60 sek/stronę.',alt:'Hip flexor stretch'},
  {name:'Spiderman stretch',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra, Pachwinowe, Mobilizacja',tip:'Wykrok do przodu, rękę obok stopy.',nsca:'2x8/stronę.',alt:'World greatest stretch'},
  {name:'Ankle circle',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Staw skokowy (mobilizacja)',tip:'Pełny zakres ruchu.',nsca:'2x10/kierunek/noga.',alt:'Calf raise'},
  {name:'Thoracic rotation',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Kręgosłup piersiowy (rotacja)',tip:'Ręka za głową, otwieraj klatkę.',nsca:'2x10/stronę.',alt:'Thread the needle, Cat-cow'},
  {name:'Open book',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Kręgosłup piersiowy, Barki (rotacja)',tip:'Leżąc na boku. Otwieraj górną rękę.',nsca:'2x10/stronę.',alt:'Thread the needle'},
  {name:'Donkey kick',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Pośladki (aktywacja), Biodra',tip:'Kop piętą w sufit — kolano ugięte 90°.',nsca:'2x15/noga.',alt:'Fire hydrant'},
  {name:'Fire hydrant',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Pośladki (średni), Biodra zewnętrzne',tip:'Na czworaka. Unoś nogę w bok.',nsca:'2x15/noga.',alt:'Clamshell'},
  {name:'Glute bridge aktywacja',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Pośladki (aktywacja przed treningiem)',tip:'Zatrzymaj na górze 2 sek.',nsca:'2x15.',alt:'Hip thrust'},
  {name:'Lateral lunge',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Przywodziciele, Czworogłowy, Pośladki',tip:'Szeroki krok w bok.',nsca:'2x10/stronę.',alt:'Sumo squat, Hip 90/90'},
  {name:'Squat to stand',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Łańcuch tylny, Mobilizacja',tip:'Stań — chwyć palce — zejdź w przysiad — wstań.',nsca:'2x10.',alt:'Inchworm'},
  {name:'Toy soldier',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Dwugłowy uda, Biodra (dynamiczne)',tip:'Maszeruj i kopaj prostą nogę.',nsca:'2x10/noga.',alt:'Leg swing'},
  {name:'Lateral shuffle',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Pośladki, Biodra, Koordynacja',tip:'Szybkie boczne kroki. Środek ciężkości niski.',nsca:'3x10 m.',alt:'Monster walk'},
  {name:'A-skip',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra, Koordynacja biegowa',tip:'Rytmiczne podskoki z unosieniem kolan.',nsca:'3x10 m.',alt:'High knees, B-skip'},
  {name:'B-skip',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Dwugłowy uda, Biodra, Koordynacja',tip:'A-skip + wyprostowanie nogi do przodu.',nsca:'3x10 m.',alt:'A-skip'},
  {name:'Głębokie kucnięcie (hang)',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Biodra, Staw skokowy, Dolny grzbiet',tip:'Trzymaj się czegoś i siedź głęboko.',nsca:'3x30-60 sek.',alt:'Squat to stand'},
  {name:'Hip flexor stretch dynamiczny',cat:'Rozgrzewka',eq:'Własna masa',muscle:'Prostownik biodra (dynamiczne)',tip:'Wykrok niski. Dynamiczne wychylenia.',nsca:'2x10/stronę.',alt:'Couch stretch'},
  {name:'Skłon do nóg siedząc',cat:'Rozciąganie',eq:'Własna masa',muscle:'Dwugłowy uda, Dolny grzbiet',tip:'Plecy proste jak długo możesz.',nsca:'3x30-60 sek.',alt:'Downward dog'},
  {name:'Butterfly stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Przywodziciele, Pachwinowe',tip:'Stopy razem, kolana na boki.',nsca:'3x30-60 sek.',alt:'Pigeon pose'},
  {name:'Pigeon pose',cat:'Rozciąganie',eq:'Własna masa',muscle:'Pośladki, Biodra zewnętrzne, IT band',tip:'Przednia noga ugięta przed tobą.',nsca:'3x60 sek/stronę.',alt:'Butterfly, Figure-4 stretch'},
  {name:'Figure-4 stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Pośladki (gruszkowaty), Biodra',tip:'Leżąc na plecach. Skrzyżuj nogę na kolanie.',nsca:'3x30-60 sek/stronę.',alt:'Pigeon pose'},
  {name:'Rozciąganie czworogłowego stojąc',cat:'Rozciąganie',eq:'Własna masa',muscle:'Czworogłowy uda',tip:'Chwyć stopę z tyłu. Kolana razem.',nsca:'3x30 sek/noga.',alt:'Couch stretch'},
  {name:'Rozciąganie łydek',cat:'Rozciąganie',eq:'Własna masa',muscle:'Łydki (brzuchaty i płaszczkowaty)',tip:'Przy ścianie. Prosta noga = brzuchaty.',nsca:'3x30-60 sek/noga.',alt:'Downward dog'},
  {name:'Doorway stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Klatka piersiowa, Przedni bark',tip:'Ręce na framudze. Wychyl się do przodu.',nsca:'3x30 sek.',alt:'Rozpiętki'},
  {name:'Child pose',cat:'Rozciąganie',eq:'Własna masa',muscle:'Dolny grzbiet, Biodra, Barki',tip:'Usiądź na piętach, ramiona do przodu.',nsca:'3x60 sek.',alt:'Cat-cow, Downward dog'},
  {name:'Downward dog',cat:'Rozciąganie',eq:'Własna masa',muscle:'Łańcuch tylny, Barki, Łydki, Kręgosłup',tip:'V-kształt. Pięty do podłogi.',nsca:'3x30-60 sek.',alt:'Child pose'},
  {name:'Rozciąganie biodra leżąc',cat:'Rozciąganie',eq:'Własna masa',muscle:'Prostownik biodra, Czworogłowy',tip:'Leżąc na boku. Chwyć stopę i przyciągnij.',nsca:'3x30 sek/stronę.',alt:'Couch stretch'},
  {name:'Neck stretch boczny',cat:'Rozciąganie',eq:'Własna masa',muscle:'Dźwigacz łopatki, Mięśnie szyi',tip:'Pochyl głowę w bok. Delikatne przyciąganie.',nsca:'3x30 sek/stronę.',alt:'Shoulder roll'},
  {name:'Foam roller plecy',cat:'Rozciąganie',eq:'Własna masa',muscle:'Kręgosłup piersiowy, Mięśnie przykręgosłupowe',tip:'Roluj powoli. Zatrzymuj na bolących punktach.',nsca:'3-5 min.',alt:'Cat-cow'},
  {name:'Foam roller łydki',cat:'Rozciąganie',eq:'Własna masa',muscle:'Łydki, Ścięgno Achillesa',tip:'Roluj od kostki do dołu kolana.',nsca:'2-3 min.',alt:'Rozciąganie łydek'},
  {name:'Foam roller IT band',cat:'Rozciąganie',eq:'Własna masa',muscle:'Pasmo biodrowo-piszczelowe',tip:'Od biodra do kolana. Zatrzymuj na napiętych miejscach.',nsca:'2-3 min/stronę.',alt:'Pigeon pose'},
  {name:'Seated forward fold',cat:'Rozciąganie',eq:'Własna masa',muscle:'Dwugłowy uda, Dolny grzbiet, Łydki',tip:'Nogi proste. Sięgaj do stóp.',nsca:'3x60 sek.',alt:'Downward dog'},
  {name:'Supine twist',cat:'Rozciąganie',eq:'Własna masa',muscle:'Kręgosłup (rotacja), Pośladki, Dolny grzbiet',tip:'Kolano do klatki i przełóż na drugą stronę.',nsca:'3x30-60 sek/stronę.',alt:'Pigeon pose'},
  {name:'Cobra stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Brzuch, Klatka, Kręgosłup lędźwiowy',tip:'Leżąc na brzuchu. Unoś tułów.',nsca:'3x30 sek.',alt:'Child pose, Upward dog'},
  {name:'Lizard pose',cat:'Rozciąganie',eq:'Własna masa',muscle:'Biodra, Prostownik biodra, Przywodziciele',tip:'Niski wykrok z rękami wewnątrz stopy.',nsca:'3x45 sek/stronę.',alt:'World greatest, Pigeon pose'},
  {name:'Straddle stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Przywodziciele, Hamstringi, Grzbiet',tip:'Nogi rozłożone szeroko. Pochyl tułów.',nsca:'3x60 sek.',alt:'Butterfly stretch'},
  {name:'Frog stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Przywodziciele, Biodra wewnętrzne',tip:'Na czworaka z szerokimi kolanami.',nsca:'3x60 sek.',alt:'Butterfly'},
  {name:'Sleeper stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Rotatory barku tylne, Tylny bark',tip:'Leżąc na boku. Dociskaj przedramię do dołu.',nsca:'3x30 sek/stronę.',alt:'Rotacja zewnętrzna'},
  {name:'Cross body shoulder stretch',cat:'Rozciąganie',eq:'Własna masa',muscle:'Tylny bark, Rombowate',tip:'Przyciągnij rękę przez klatkę.',nsca:'3x30 sek/stronę.',alt:'Sleeper stretch'},
  {name:'Rozciąganie biodrowo-lędźwiowego',cat:'Rozciąganie',eq:'Własna masa',muscle:'Biodrowo-lędźwiowy, Prostownik biodra',tip:'Klęczysz. Pchaj biodra do przodu.',nsca:'3x45 sek/stronę.',alt:'Couch stretch'},
  {name:'Burpees',cat:'Cardio',eq:'Własna masa',muscle:'Całe ciało — cardio',tip:'Pełny zakres ruchu.',nsca:'3-5x10-15 lub tabata.',alt:'Mountain climbers, Sprawl'},
  {name:'Mountain climbers',cat:'Cardio',eq:'Własna masa',muscle:'Core, Biodra, Cardio',tip:'Pozycja deski. Naprzemienne kolana.',nsca:'3x30-45 sek.',alt:'Burpees, High knees'},
  {name:'Box jump',cat:'Cardio',eq:'Własna masa',muscle:'Czworogłowy, Pośladki, Moc eksplozywna',tip:'Miękkie lądowanie na lekko ugiętych kolanach.',nsca:'3-4x5-8.',alt:'Jump squat'},
  {name:'Jump squat',cat:'Cardio',eq:'Własna masa',muscle:'Czworogłowy, Pośladki, Moc',tip:'Przysiad — wybij się explosywnie.',nsca:'3x8-10.',alt:'Box jump'},
  {name:'Kettlebell swing',cat:'Cardio',eq:'Kettlebell',muscle:'Pośladki, Dwugłowy uda, Core, Cardio',tip:'Napęd biodrami — nie przysiadem. Hip hinge!',nsca:'3-5x15-20.',alt:'Deadlift, Hip thrust'},
  {name:'Turkish get-up',cat:'Cardio',eq:'Kettlebell',muscle:'Całe ciało, Stabilizacja, Core',tip:'Powolne. Każda faza kontrolowana.',nsca:'3x3-5/stronę.',alt:'Kettlebell swing'},
];


function allExercises(){
  const all=[...DEF_EX,...(EX||[])];
  const seen=new Set();
  return all.filter(e=>{if(seen.has(e.name))return false;seen.add(e.name);return true;});
}

function setExView(v){
  exView=v;
  document.getElementById('ex-grid-view').style.display=v==='grid'?'block':'none';
  document.getElementById('ex-list-view').style.display=v==='list'?'flex':'none';
  document.getElementById('ex-list-view').style.flexDirection='column';
  document.getElementById('ex-view-grid-btn').className='btn btn-sm '+(v==='grid'?'btn-primary':'btn-ghost');
  document.getElementById('ex-view-list-btn').className='btn btn-sm '+(v==='list'?'btn-primary':'btn-ghost');
  renderLib();
}

function renderLib(){
  updateExDl();
  const all=allExercises();
  const search=(document.getElementById('ex-search')||{}).value||'';
  const sort=(document.getElementById('ex-sort')||{}).value||'az';

  // build category nav
  const cats=['Wszystkie',...Object.keys(CAT_COLORS_EX)];
  const catNav=document.getElementById('ex-cat-nav');
  if(catNav){
    catNav.innerHTML=cats.map(c=>{
      const count=c==='Wszystkie'?all.length:all.filter(e=>e.cat===c).length;
      const col=CAT_COLORS_EX[c]||'var(--muted)';
      return `<div class="ex-cat-nav-item${exCatFilter===c?' active':''}" onclick="exCatFilter='${c}';renderLib()">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="ex-cat-dot" style="background:${col};"></div>
          <span>${c}</span>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:10px;">${count}</span>
      </div>`;
    }).join('');
  }

  // equip filters
  const equips=['Sztanga','Hantle','Maszyna','Wyciąg','Własna masa','Kettlebell'];
  const equipEl=document.getElementById('ex-equip-filters');
  if(equipEl){
    equipEl.innerHTML=equips.map(eq=>`<div class="ex-equip-chip${exEquipFilter===eq?' active':''}" onclick="exEquipFilter=exEquipFilter==='${eq}'?'':'${eq}';renderLib()">
      <div class="ex-equip-dot"></div><span>${eq}</span>
    </div>`).join('');
  }

  // filter
  let filtered=all.filter(e=>{
    if(exCatFilter!=='Wszystkie'&&e.cat!==exCatFilter)return false;
    if(exEquipFilter&&e.eq!==exEquipFilter)return false;
    if(search){const s=search.toLowerCase();if(!e.name.toLowerCase().includes(s)&&!(e.cat||'').toLowerCase().includes(s)&&!(e.muscle||'').toLowerCase().includes(s))return false;}
    return true;
  });

  // sort
  if(sort==='az')filtered.sort((a,b)=>a.name.localeCompare(b.name,'pl'));
  else if(sort==='cat')filtered.sort((a,b)=>a.cat.localeCompare(b.cat,'pl'));
  else if(sort==='eq')filtered.sort((a,b)=>(a.eq||'').localeCompare(b.eq||'','pl'));

  const countEl=document.getElementById('ex-results-count');
  if(countEl)countEl.textContent=filtered.length+' '+(filtered.length===1?'ćwiczenie':filtered.length<5?'ćwiczenia':'ćwiczeń');

  if(exView==='grid'){
    const grid=document.getElementById('lib-grid');
    if(!filtered.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);">Brak ćwiczeń pasujących do filtrów</div>';return;}
    grid.innerHTML=filtered.map((e,i)=>{
      const col=CAT_COLORS_EX[e.cat]||'var(--muted2)';
      return `<div class="ex-card${exSelId===e.name?' selected':''}" style="animation-delay:${i*0.025}s" onclick="openExDetail('${e.name.replace(/'/g,"\\'")}')">
        <div class="ex-card-accent" style="background:${col};"></div>
        <div style="padding-left:8px;">
          <div class="ex-card-name">${e.name}</div>
          <div class="ex-card-tags">
            <span class="pill pill-muted" style="font-size:9px;">${e.cat}</span>
            <span class="pill pill-muted" style="font-size:9px;">${e.eq}</span>
          </div>
          ${e.muscle?`<div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${e.muscle}</div>`:''}
          ${e.tip?`<div class="ex-card-tip">${e.tip.substring(0,80)}${e.tip.length>80?'…':''}</div>`:''}
        </div>
      </div>`;
    }).join('');
  } else {
    const body=document.getElementById('ex-list-body');
    if(!filtered.length){body.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);">Brak ćwiczeń</div>';return;}
    body.innerHTML=filtered.map((e,i)=>{
      const col=CAT_COLORS_EX[e.cat]||'var(--muted2)';
      return `<div class="ex-list-row" style="animation-delay:${i*0.02}s" onclick="openExDetail('${e.name.replace(/'/g,"\\'")}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:4px;height:32px;border-radius:2px;background:${col};flex-shrink:0;"></div>
          <div><div style="font-size:13px;font-weight:600;">${e.name}</div><div style="font-size:11px;color:var(--muted);margin-top:1px;">${e.muscle||''}</div></div>
        </div>
        <span class="pill pill-muted" style="font-size:10px;align-self:center;">${e.cat}</span>
        <span class="pill pill-muted" style="font-size:10px;align-self:center;">${e.eq}</span>
        <div style="font-size:11px;color:var(--muted);align-self:center;">${(e.tip||'').substring(0,60)}${(e.tip||'').length>60?'…':''}</div>
        <div style="align-self:center;"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openExDetail('${e.name.replace(/'/g,"\\'")}')">Szczegóły</button></div>
      </div>`;
    }).join('');
  }
}

var currentExDetail='';
function openExDetail(name){
  const all=allExercises();
  const e=all.find(x=>x.name===name);
  if(!e)return;
  currentExDetail=name;
  exSelId=name;
  const col=CAT_COLORS_EX[e.cat]||'var(--muted2)';
  document.getElementById('exd-title').textContent=e.name;
  document.getElementById('exd-body').innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
      <span class="pill" style="background:${col}22;color:${col};">${e.cat}</span>
      <span class="pill pill-muted">${e.eq}</span>
    </div>
    ${e.muscle?`<div style="margin-bottom:12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Mięśnie</div>
      <div style="font-size:12px;line-height:1.6;">${e.muscle}</div>
    </div>`:''}
    ${e.tip?`<div style="margin-bottom:12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Wskazówka techniczna</div>
      <div style="background:var(--s3);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6;border-left:3px solid ${col};">${e.tip}</div>
    </div>`:''}
    ${e.nsca?`<div style="margin-bottom:12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Parametry NSCA/ACSM</div>
      <div style="background:var(--adim);border:1px solid rgba(200,241,53,0.15);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6;">${e.nsca}</div>
    </div>`:''}
    ${e.alt?`<div style="margin-bottom:12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Zamienniki</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${e.alt.split(',').map(a=>`<span class="pill pill-muted" style="font-size:10px;cursor:pointer;" onclick="openExDetail('${a.trim().replace(/'/g,"\\'")}')">→ ${a.trim()}</span>`).join('')}</div>
    </div>`:''}
    <div style="display:flex;gap:6px;margin-top:4px;">
      <button class="btn btn-primary btn-sm" style="flex:1;" onclick="prefillExInBuilder('${e.name.replace(/'/g,"\\'")}')">Użyj w builderze</button>
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="prefillExInWorkout('${e.name.replace(/'/g,"\\'")}')">Dodaj do treningu</button>
    </div>
    <button onclick="event.stopPropagation();(function(){window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(currentExDetail+' cwiczenie technika wykonania'),'_blank');})()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;padding:10px;background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.3);border-radius:8px;color:#ff4444;font-size:12px;font-weight:700;cursor:pointer;" onmouseover="this.style.background='rgba(255,0,0,0.2)'" onmouseout="this.style.background='rgba(255,0,0,0.1)'">&#9654; Zobacz na YouTube &#8212; technika</button>
    `;
  // clear AI msgs
  document.getElementById('exd-ai-msgs').innerHTML='';
  const detail=document.getElementById('ex-detail');
  detail.style.transform='translateX(0)';
  renderLib();
}

function closeExDetail(){
  document.getElementById('ex-detail').style.transform='translateX(100%)';
  exSelId=null;renderLib();
}

function prefillExInBuilder(name){
  closeExDetail();goTo('builder');
  setTimeout(()=>{
    const rows=document.querySelectorAll('.ex-inp-name');
    for(const r of rows){if(!r.value){r.value=name;r.focus();return;}}
    notify(name+' — dodaj ćwiczenie w builderze');
  },300);
}

function prefillExInWorkout(name){
  openM('m-workout');
  setTimeout(()=>{
    const rows=document.querySelectorAll('#w-ex-rows .wb-inp');
    for(const r of rows){if(!r.value&&r.placeholder==='Nazwa ćwiczenia...'){r.value=name;r.focus();return;}}
  },200);
}

async function askExAI(){
  const q=document.getElementById('exd-ai-q').value.trim();if(!q)return;
  document.getElementById('exd-ai-q').value='';
  const msgs=document.getElementById('exd-ai-msgs');
  msgs.innerHTML+='<div style="text-align:right;margin-bottom:5px;"><div style="display:inline-block;background:var(--accent);color:#000;padding:5px 9px;border-radius:8px;font-size:11px;">'+q+'</div></div>';
  msgs.innerHTML+='<div id="exd-ai-t" style="margin-bottom:5px;"><div style="display:inline-block;background:var(--s3);border:1px solid var(--border2);padding:5px 9px;border-radius:8px;font-size:11px;opacity:0.5;">Analizuję...</div></div>';
  msgs.scrollTop=msgs.scrollHeight;
  const ctx=exSelId?'Ćwiczenie: '+exSelId+'. ':'';
  const sys='Asystent trenera personalnego. Odpowiadaj BARDZO KRÓTKO po polsku, max 60 słów. Ekspert techniki ćwiczeń, biomechaniki, NSCA. Dawaj konkretne wskazówki.';
  try{
    const r=await fetch(W,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:150,system:sys,messages:[{role:'user',content:ctx+q}]})});
    const d=await r.json();const ans=d.content.map(i=>i.text||'').join('');
    document.getElementById('exd-ai-t').outerHTML='<div style="margin-bottom:5px;"><div style="display:inline-block;background:var(--s3);border:1px solid var(--border2);padding:5px 9px;border-radius:8px;font-size:11px;line-height:1.5;">'+ans.replace(/\n/g,'<br>')+'</div></div>';
  }catch(e){document.getElementById('exd-ai-t').outerHTML='<div style="margin-bottom:5px;"><div style="display:inline-block;background:var(--s3);padding:5px 9px;border-radius:8px;font-size:11px;color:var(--red);">Błąd</div></div>';}
  msgs.scrollTop=msgs.scrollHeight;
}

async function saveEx(){
  const name=document.getElementById('ex-name').value.trim();if(!name){notify('Wpisz nazwę!');return;}
  const ex={id:'l'+Date.now(),name,cat:document.getElementById('ex-cat').value,eq:document.getElementById('ex-eq').value,desc:document.getElementById('ex-desc').value,tip:document.getElementById('ex-desc').value,muscle:'',nsca:'',alt:''};
  EX.push(ex);closeM('m-ex');renderLib();notify('Ćwiczenie dodane!');
  if(window._db){try{const r=await window._add(window._col(window._db,'exercises'),ex);if(r&&r.id)ex.id=r.id;}catch(e){console.warn('Firebase:',e);}}
}

// ════════════════════════════════════════
// AI
// ════════════════════════════════════════
async function askAI(){
  const q=document.getElementById('ai-q').value.trim();if(!q)return;
  document.getElementById('ai-q').value='';
  const msgs=document.getElementById('ai-msgs');
  msgs.innerHTML+='<div class="ai-msg user"><div class="ai-bubble">'+q+'</div></div>';
  msgs.innerHTML+='<div class="ai-msg bot" id="ai-t"><div class="ai-bubble" style="opacity:0.5;">Analizuję...</div></div>';
  msgs.scrollTop=msgs.scrollHeight;
  const cid=document.getElementById('b-client').value;const c=CL.find(x=>x.id===cid);
  const ctx=c?'Klient: '+c.name+', '+c.age+'lat, '+c.weight+'kg, cel: '+c.goal+', poziom: '+c.level+'. ':'';
  const sys='Asystent trenera personalnego. Odpowiadaj KRÓTKO po polsku, max 100 słów. NSCA: hipertrofia 3-6 serii/8-10 powt/67-85% 1RM; siła 2-6 serii/1-6 powt/85%+ 1RM. RPE 8=RIR 2. Facepull i HipThrust zawsze. Dawaj konkretne liczby.';
  try{
    const r=await fetch(W,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:250,system:sys,messages:[{role:'user',content:ctx+q}]})});
    const d=await r.json();
    const ans=d.content.map(i=>i.text||'').join('');
    document.getElementById('ai-t').outerHTML='<div class="ai-msg bot"><div class="ai-bubble">'+ans.replace(/\n/g,'<br>')+'</div></div>';
  }catch(e){document.getElementById('ai-t').outerHTML='<div class="ai-msg bot"><div class="ai-bubble" style="color:var(--red);">Błąd połączenia</div></div>';}
  msgs.scrollTop=msgs.scrollHeight;
}

// ════════════════════════════════════════
// PROGRAMS LIBRARY
// ════════════════════════════════════════
var progNav='all';var progDurFilter='';var progSelId=null;
window.USER_PROGRAMS=[];

const GOAL_COLORS={masa:'var(--accent)',sila:'var(--orange)',redukcja:'var(--red)',kondycja:'var(--teal)'};
const GOAL_LABELS={masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja'};
const LEVEL_COLORS_P={poczatkujacy:'var(--teal)',sredni:'var(--blue)',zaawansowany:'var(--purple)'};

const DEMO_PROGRAMS=[
  {
    id:'dp1',type:'demo',name:'PPL Masa — 8 tygodni',goal:'masa',level:'sredni',duration:8,daysPerWeek:6,equip:'Siłownia',method:'PPL',
    desc:'Klasyczny Push/Pull/Legs dla średnio-zaawansowanych ukierunkowany na hipertrofię. Periodyzacja falowana (DUP) z deloadem w 4. i 8. tygodniu. Zgodny z wytycznymi NSCA.',
    highlights:['DUP — różna intensywność w ciągu tygodnia','Facepull i Hip Thrust w każdym cyklu','Deload co 4 tygodnie','Progresja: +2,5 kg co tydzień przy RPE ≤8'],
    weeks:[
      {nr:1,label:'Akumulacja I',rpe:'RPE 7',focus:'Budowa bazy objętościowej',days:[{d:'PON',name:'Push A — Klatka + Barki + Triceps'},{d:'WT',name:'Pull A — Plecy + Biceps'},{d:'ŚR',name:'Legs A — Czworogłowe'},{d:'CZ',name:'Push B — Objętość'},{d:'PT',name:'Pull B — Martwy ciąg'},{d:'SO',name:'Legs B — Pośladki + Dwugłowe'}]},
      {nr:2,label:'Akumulacja I',rpe:'RPE 7-8',focus:'Progresja liniowa +2,5 kg',days:[{d:'PON',name:'Push A'},{d:'WT',name:'Pull A'},{d:'ŚR',name:'Legs A'},{d:'CZ',name:'Push B'},{d:'PT',name:'Pull B'},{d:'SO',name:'Legs B'}]},
      {nr:3,label:'Akumulacja I',rpe:'RPE 8',focus:'+1 seria na partie priorytetowe',days:[{d:'PON',name:'Push A'},{d:'WT',name:'Pull A'},{d:'ŚR',name:'Legs A'},{d:'CZ',name:'Push B'},{d:'PT',name:'Pull B'},{d:'SO',name:'Legs B'}]},
      {nr:4,label:'DELOAD',rpe:'RPE 6',focus:'-50% serii, -10% ciężaru — regeneracja CNS',days:[{d:'PON',name:'Push — lekki'},{d:'WT',name:'Pull — lekki'},{d:'ŚR',name:'REST'},{d:'CZ',name:'Legs — lekki'},{d:'PT',name:'REST'},{d:'SO',name:'Mobilność'}]},
      {nr:5,label:'Akumulacja II',rpe:'RPE 7-8',focus:'Nowy blok — progresja od RPE 7',days:[{d:'PON',name:'Push A'},{d:'WT',name:'Pull A'},{d:'ŚR',name:'Legs A'},{d:'CZ',name:'Push B'},{d:'PT',name:'Pull B'},{d:'SO',name:'Legs B'}]},
      {nr:6,label:'Akumulacja II',rpe:'RPE 8',focus:'Szczyt objętości — MRV',days:[{d:'PON',name:'Push A'},{d:'WT',name:'Pull A'},{d:'ŚR',name:'Legs A'},{d:'CZ',name:'Push B'},{d:'PT',name:'Pull B'},{d:'SO',name:'Legs B'}]},
      {nr:7,label:'Intensyfikacja',rpe:'RPE 8-9',focus:'Redukcja objętości, wzrost intensywności',days:[{d:'PON',name:'Push — ciężki'},{d:'WT',name:'Pull — ciężki'},{d:'ŚR',name:'Legs — ciężki'},{d:'CZ',name:'Push — lekki'},{d:'PT',name:'Pull — lekki'},{d:'SO',name:'REST'}]},
      {nr:8,label:'DELOAD + Ewaluacja',rpe:'RPE 6',focus:'Regeneracja + test 1RM',days:[{d:'PON',name:'Push — lekki'},{d:'WT',name:'Pull — lekki'},{d:'ŚR',name:'REST'},{d:'CZ',name:'Legs — lekki'},{d:'PT',name:'Test 1RM (opcja)'},{d:'SO',name:'REST'}]},
    ]
  },
  {
    id:'dp2',type:'demo',name:'Siła 5×5 — 12 tygodni',goal:'sila',level:'sredni',duration:12,daysPerWeek:3,equip:'Siłownia',method:'FBW',
    desc:'Protokół oparty na StrongLifts / Starting Strength rozbudowany o periodyzację blokową. Trzy sesje FBW na tydzień. Nacisk na ćwiczenia wielostawowe: przysiad, martwy ciąg, OHP, wiosłowanie.',
    highlights:['3 sesje FBW / tydzień','Progresja 2,5-5 kg co sesję','12-tygodniowe bloki siłowe','Przerwy 3-5 min między seriami'],
    weeks:[
      {nr:1,label:'Adaptacja',rpe:'RPE 7',focus:'Nauka techniki, lekkie ciężary',days:[{d:'PON',name:'FBW A — Przysiad 5×5, OHP 5×5, Martwy 1×5'},{d:'ŚR',name:'FBW B — Przysiad 5×5, Wiosłowanie 5×5, OHP 5×5'},{d:'PT',name:'FBW A — powtórzenie'}]},
      {nr:2,label:'Liniowa progresja',rpe:'RPE 7-8',focus:'+2,5 kg przysiad i martwy, +2,5 kg reszta',days:[{d:'PON',name:'FBW A'},{d:'ŚR',name:'FBW B'},{d:'PT',name:'FBW A'}]},
      {nr:3,label:'Liniowa progresja',rpe:'RPE 8',focus:'Kontynuacja — scięgna adaptują się wolniej!',days:[{d:'PON',name:'FBW A'},{d:'ŚR',name:'FBW B'},{d:'PT',name:'FBW A'}]},
      {nr:4,label:'DELOAD',rpe:'RPE 6',focus:'-50% objętości, technika',days:[{d:'PON',name:'FBW lekki'},{d:'ŚR',name:'FBW lekki'},{d:'PT',name:'REST'}]},
    ]
  },
  {
    id:'dp3',type:'demo',name:'Redukcja 8 tygodni — Cardio + Siła',goal:'redukcja',level:'poczatkujacy',duration:8,daysPerWeek:4,equip:'Siłownia',method:'Upper/Lower',
    desc:'Program łączący trening siłowy (Upper/Lower) z sesjami cardio HIIT. Zachowanie masy mięśniowej przy deficycie kalorycznym. Dla osób z wagą przekraczającą cel.',
    highlights:['2× Upper + 2× Lower / tydzień','HIIT 2× tydzień (20-30 min)','Zachowanie siły przy redukcji','Deficyt kaloryczny 300-500 kcal'],
    weeks:[
      {nr:1,label:'Adaptacja + Cardio',rpe:'RPE 7',focus:'Poznanie struktury, umiarkowany deficyt',days:[{d:'PON',name:'Upper A — Klatka + Plecy'},{d:'WT',name:'HIIT 20 min'},{d:'ŚR',name:'Lower A — Nogi + Pośladki'},{d:'CZ',name:'REST'},{d:'PT',name:'Upper B'},{d:'SO',name:'HIIT 25 min'}]},
      {nr:2,label:'Progresja',rpe:'RPE 7-8',focus:'Wzrost intensywności cardio',days:[{d:'PON',name:'Upper A'},{d:'WT',name:'HIIT 25 min'},{d:'ŚR',name:'Lower A'},{d:'CZ',name:'REST'},{d:'PT',name:'Upper B'},{d:'SO',name:'HIIT 30 min'}]},
    ]
  },
  {
    id:'dp4',type:'demo',name:'FBW Początkujący — 4 tygodnie',goal:'masa',level:'poczatkujacy',duration:4,daysPerWeek:3,equip:'Siłownia',method:'FBW',
    desc:'Idealne wprowadzenie do treningu siłowego. Trzy sesje Full Body w tygodniu. Nacisk na naukę wzorców ruchowych i bezpieczną progresję. Dostosowane do wytycznych NSCA dla nowicjuszy.',
    highlights:['Adaptacja nerwowo-mięśniowa','Nauka 6 podstawowych wzorców','Liniowa progresja +2,5 kg/tydzień','Scięgna: adaptacja 6-8 tygodni!'],
    weeks:[
      {nr:1,label:'Adaptacja — technika',rpe:'RPE 6-7',focus:'Nauka wzorców, lekkie ciężary 60% 1RM',days:[{d:'PON',name:'FBW — Przysiad Goblet, Pompki, Wiosłowanie hantlem, Hip Thrust, Plank'},{d:'ŚR',name:'FBW — powtórzenie dnia A'},{d:'PT',name:'FBW — powtórzenie dnia A'}]},
      {nr:2,label:'Utrwalenie',rpe:'RPE 7',focus:'Ten sam ciężar lub +2,5 kg gdy RPE <7',days:[{d:'PON',name:'FBW B — +2,5 kg przysiad i wiosłowanie'},{d:'ŚR',name:'FBW B'},{d:'PT',name:'FBW B'}]},
      {nr:3,label:'Progresja',rpe:'RPE 7-8',focus:'Progresja liniowa — NSCA: 60-70% 1RM',days:[{d:'PON',name:'FBW C'},{d:'ŚR',name:'FBW C'},{d:'PT',name:'FBW C'}]},
      {nr:4,label:'DELOAD + Ocena',rpe:'RPE 6',focus:'-50% serii, ocena techniki, plan na kolejny blok',days:[{d:'PON',name:'FBW — lekki'},{d:'ŚR',name:'REST / Mobilność'},{d:'PT',name:'FBW — lekki + ocena'}]},
    ]
  },
  {
    id:'dp5',type:'demo',name:'Kondycja — Bieg + Siła 8 tygodni',goal:'kondycja',level:'sredni',duration:8,daysPerWeek:5,equip:'Bez sprzętu',method:'HIIT',
    desc:'Hybrydowy program łączący bieganie interwałowe z treningiem siłowym na masę własnego ciała. Poprawa VO2max, wytrzymałości i ogólnej sprawności.',
    highlights:['Trening kardio 3×/tydzień','Siła własna masa 2×/tydzień','Progresja dystansu biegowego','Brak sprzętu wymagany'],
    weeks:[
      {nr:1,label:'Baza aerobowa',rpe:'RPE 6-7',focus:'Łatwy bieg ciągły, poznanie tempa',days:[{d:'PON',name:'Bieg ciągły 20 min (strefa 2)'},{d:'WT',name:'Siła: Pompki 3×10, Przysiady 3×15, Plank 3×45s'},{d:'ŚR',name:'REST'},{d:'CZ',name:'Bieg ciągły 25 min'},{d:'PT',name:'Siła: Burpees, Mountain climbers, Dips'}]},
      {nr:2,label:'Interwały',rpe:'RPE 7-8',focus:'Wprowadzenie interwałów 1:2',days:[{d:'PON',name:'Bieg interwałowy: 8×200m (przerwa 60s)'},{d:'WT',name:'Siła FBW'},{d:'ŚR',name:'Bieg ciągły 25 min'},{d:'CZ',name:'REST'},{d:'PT',name:'Siła FBW + core'}]},
    ]
  },
  {
    id:'dp6',type:'demo',name:'Arnold Split — Zaawansowany 12 tyg.',goal:'masa',level:'zaawansowany',duration:12,daysPerWeek:6,equip:'Siłownia',method:'Arnold',
    desc:'Legendarny split Arnolda Schwarzeneggera zmodernizowany o periodyzację blokową i protokoły NSCA. Dla zaawansowanych szukających nowego bodźca treningowego.',
    highlights:['6 sesji/tydzień','Każda partia 2× tygodniowo','Bloki: akumulacja → intensyfikacja → peak','Objętość: 18-22 serie/partia/tydzień'],
    weeks:[
      {nr:1,label:'Akumulacja — wysoka objętość',rpe:'RPE 7',focus:'Klatka+Plecy / Barki+Ramiona / Nogi — 2×/tydzień',days:[{d:'PON',name:'Klatka + Plecy — Wyciskanie, Wiosłowanie, Podciąganie'},{d:'WT',name:'Barki + Ramiona — OHP, Wznosy, Biceps, Triceps'},{d:'ŚR',name:'Nogi — Przysiad, RDL, Hip Thrust, Łydki'},{d:'CZ',name:'Klatka + Plecy — Objętościowo'},{d:'PT',name:'Barki + Ramiona — Objętościowo'},{d:'SO',name:'Nogi — Objętościowo'}]},
      {nr:2,label:'Akumulacja + progresja',rpe:'RPE 8',focus:'+2,5 kg ciężarach podstawowych',days:[{d:'PON',name:'Klatka + Plecy'},{d:'WT',name:'Barki + Ramiona'},{d:'ŚR',name:'Nogi'},{d:'CZ',name:'Klatka + Plecy'},{d:'PT',name:'Barki + Ramiona'},{d:'SO',name:'Nogi'}]},
    ]
  },
  {
    id:'dp7',type:'demo',name:'Tabata — Intensywny 4 tygodnie',goal:'kondycja',level:'sredni',duration:4,daysPerWeek:4,equip:'Bez sprzętu',method:'Tabata',
    desc:'Protokół Tabata: 20 sekund maksymalnej intensywności + 10 sekund przerwy × 8 rund = 4 minuty piekła. Badania dr Izumi Tabaty (1996) potwierdzają: poprawia zarówno wydolność tlenową jak i beztlenową. Skuteczniejszy niż 60 min cardio.',
    highlights:['20s praca / 10s przerwa × 8 rund','4 minuty = 1 blok Tabata','Wzrost VO2max o 14% w 6 tyg.','Spalanie kalorii do 24h po treningu (EPOC)'],
    weeks:[
      {nr:1,label:'Podstawy Tabata',rpe:'RPE 8-9',focus:'Nauka protokołu, 2-3 bloki/sesja',days:[{d:'PON',name:'Tabata: Burpees + High Knees — 3 bloki'},{d:'WT',name:'REST lub spacer'},{d:'ŚR',name:'Tabata: Przysiady + Mountain Climbers — 3 bloki'},{d:'CZ',name:'REST'},{d:'PT',name:'Tabata: Pompki + Jumping Jacks — 3 bloki'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:2,label:'Progresja',rpe:'RPE 9',focus:'4 bloki/sesja, zmiana ćwiczeń',days:[{d:'PON',name:'Tabata: Burpees + Squat Jump — 4 bloki'},{d:'WT',name:'REST'},{d:'ŚR',name:'Tabata: KB Swing + Push-up — 4 bloki'},{d:'CZ',name:'REST'},{d:'PT',name:'Tabata: Sprint w miejscu + Dips — 4 bloki'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:3,label:'Szczyt intensywności',rpe:'RPE 9-10',focus:'5 bloków, złożone ćwiczenia',days:[{d:'PON',name:'Tabata Full Body — 5 bloków'},{d:'WT',name:'REST'},{d:'ŚR',name:'Tabata Dolna + Core — 5 bloków'},{d:'CZ',name:'REST'},{d:'PT',name:'Tabata Górna — 5 bloków'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:4,label:'Deload + Test',rpe:'RPE 7-8',focus:'3 bloki, test wytrzymałości',days:[{d:'PON',name:'Tabata — lekka wersja 3 bloki'},{d:'WT',name:'REST'},{d:'ŚR',name:'Test: ile Burpees w 4 min?'},{d:'CZ',name:'REST'},{d:'PT',name:'REST'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
    ]
  },
  {
    id:'dp8',type:'demo',name:'EMOM — Siła i Kondycja 6 tygodni',goal:'kondycja',level:'sredni',duration:6,daysPerWeek:3,equip:'Siłownia',method:'EMOM',
    desc:'EMOM (Every Minute On the Minute) — wykonujesz zadaną liczbę powtórzeń na początku każdej minuty, reszta minuty to przerwa. Im szybciej skończysz, tym więcej odpoczywasz. Idealny protokół łączący siłę z wydolnością.',
    highlights:['Praca na starcie każdej minuty','Im szybsza praca = dłuższa przerwa','Buduje siłę-wytrzymałość','Sesje 20-40 minut'],
    weeks:[
      {nr:1,label:'EMOM 20 min',rpe:'RPE 7',focus:'Poznanie protokołu, umiarkowane ciężary',days:[{d:'PON',name:'EMOM 20: Nieparzyste — 5 Przysiadów, Parzyste — 5 Podciągnięć'},{d:'ŚR',name:'EMOM 20: Nieparzyste — 8 KB Swing, Parzyste — 5 Push Press'},{d:'PT',name:'EMOM 20: Nieparzyste — 5 Deadlift, Parzyste — 10 Pompek'}]},
      {nr:2,label:'EMOM 25 min',rpe:'RPE 7-8',focus:'Wydłużenie czasu pracy',days:[{d:'PON',name:'EMOM 25: 3 ćwiczenia rotacyjnie — Squat/Pull/Hinge'},{d:'ŚR',name:'EMOM 25: Górna — Press/Row/Pull'},{d:'PT',name:'EMOM 25: Siłowy — cięższe ciężary, mniej powtórzeń'}]},
      {nr:3,label:'EMOM 30 min',rpe:'RPE 8',focus:'Pełne 30 min bez przerwy',days:[{d:'PON',name:'EMOM 30: Full Body rotacja 5 ćwiczeń'},{d:'ŚR',name:'EMOM 30: Siłowy Lower'},{d:'PT',name:'EMOM 30: Siłowy Upper'}]},
      {nr:4,label:'EMOM cięższy',rpe:'RPE 8-9',focus:'+5% ciężaru przy zachowaniu formy',days:[{d:'PON',name:'EMOM 20 — ciężki: 3-4 powt. Przysiad + Martwy'},{d:'ŚR',name:'EMOM 20 — ciężki: Pull + Press'},{d:'PT',name:'EMOM 20 — ciężki: FBW kompletny'}]},
      {nr:5,label:'EMOM kompleksowy',rpe:'RPE 8-9',focus:'Kompleksy: kilka ćwiczeń pod rząd',days:[{d:'PON',name:'EMOM 24: co 2 min — Kompleks 6 ćwiczeń ze sztangą'},{d:'ŚR',name:'EMOM 24: KB kompleks'},{d:'PT',name:'EMOM 24: BW kompleks zaawansowany'}]},
      {nr:6,label:'Deload + Test',rpe:'RPE 6-7',focus:'Regeneracja, ocena progresu',days:[{d:'PON',name:'EMOM 15 — lekki'},{d:'ŚR',name:'REST'},{d:'PT',name:'Test: maks. powtórzeń w EMOM 10 min'}]},
    ]
  },
  {
    id:'dp9',type:'demo',name:'AMRAP — Crossfit Style 4 tygodnie',goal:'kondycja',level:'sredni',duration:4,daysPerWeek:4,equip:'Siłownia',method:'AMRAP',
    desc:'AMRAP (As Many Rounds As Possible) — wykonujesz jak najwięcej rund zadanego zestawu ćwiczeń w wyznaczonym czasie. Mierzysz postęp przez porównanie liczby rund w kolejnych tygodniach. Wysoka intensywność, brak przerw.',
    highlights:['Jak najwyęcej rund w czasie','Mierzalny progres co tydzień','Wytrzymałość siłowa','15-25 minut intensywnej pracy'],
    weeks:[
      {nr:1,label:'AMRAP 15 min',rpe:'RPE 8',focus:'Ustanowienie baseline',days:[{d:'PON',name:'AMRAP 15: 5 Pull-up, 10 Push-up, 15 Squat (klasyczny Cindy)'},{d:'WT',name:'REST'},{d:'ŚR',name:'AMRAP 15: 10 KB Swing, 5 Burpee, 10 Box Jump'},{d:'CZ',name:'REST'},{d:'PT',name:'AMRAP 15: 10 Thruster, 10 Ring Row, 10 Sit-up'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:2,label:'AMRAP 20 min',rpe:'RPE 8-9',focus:'Wydłużenie — więcej rund niż tydzień 1',days:[{d:'PON',name:'AMRAP 20: Cindy — cel +2 rundy vs tydzień 1'},{d:'WT',name:'REST'},{d:'ŚR',name:'AMRAP 20: Kompleks dolna'},{d:'CZ',name:'REST'},{d:'PT',name:'AMRAP 20: Kompleks górna'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:3,label:'AMRAP z obciążeniem',rpe:'RPE 9',focus:'Dodaj ciężar — mniejsza liczba rund',days:[{d:'PON',name:'AMRAP 20: Cindy z kamizelką lub ciężarami'},{d:'WT',name:'REST'},{d:'ŚR',name:'AMRAP 15: Thrusters ciężkie'},{d:'CZ',name:'REST'},{d:'PT',name:'AMRAP 20: Deadlift + Burpee'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:4,label:'Benchmark test',rpe:'RPE 9-10',focus:'Maksymalny wysiłek — test progresu',days:[{d:'PON',name:'AMRAP 20: Cindy — pobij rekord!'},{d:'WT',name:'REST'},{d:'ŚR',name:'REST'},{d:'CZ',name:'AMRAP 15: ulubiony zestaw'},{d:'PT',name:'REST'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
    ]
  },
  {
    id:'dp10',type:'demo',name:'German Volume Training (GVT) — 6 tyg.',goal:'masa',level:'zaawansowany',duration:6,daysPerWeek:4,equip:'Siłownia',method:'GVT',
    desc:'GVT (German Volume Training) — 10 serii × 10 powtórzeń z 60% 1RM. Opracowany przez Reinera Heppenthala, popularyzowany przez Charlesa Poliquina. Ekstremalna objętość prowadzi do hipertrofii sarkoplazmatycznej. Tylko dla zaawansowanych.',
    highlights:['10×10 — 100 powtórzeń na ćwiczenie','60% 1RM — nie więcej!','Przerwa 60-90s między seriami','Przyrost masy do 4-5 kg w 6 tyg.'],
    weeks:[
      {nr:1,label:'Adaptacja GVT',rpe:'RPE 7',focus:'Zacznij od 50-60% 1RM — to trudniejsze niż myślisz',days:[{d:'PON',name:'Klatka + Plecy: 10×10 Wyciskanie + 10×10 Podciąganie'},{d:'WT',name:'REST'},{d:'ŚR',name:'Nogi + Pośladki: 10×10 Przysiad + 10×10 RDL'},{d:'CZ',name:'REST'},{d:'PT',name:'Barki + Ramiona: 10×10 OHP + 10×10 Biceps'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:2,label:'GVT klasyczny',rpe:'RPE 8',focus:'Ten sam ciężar przez cały tydzień',days:[{d:'PON',name:'Klatka + Plecy: 10×10'},{d:'WT',name:'REST'},{d:'ŚR',name:'Nogi + Pośladki: 10×10'},{d:'CZ',name:'REST'},{d:'PT',name:'Barki + Ramiona: 10×10'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:3,label:'Progresja +2,5 kg',rpe:'RPE 8-9',focus:'Tylko gdy zrobiłeś wszystkie 10×10 w tyg. 2',days:[{d:'PON',name:'Klatka + Plecy: +2,5 kg'},{d:'WT',name:'REST'},{d:'ŚR',name:'Nogi + Pośladki: +2,5 kg'},{d:'CZ',name:'REST'},{d:'PT',name:'Barki + Ramiona: +2,5 kg'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:4,label:'Deload GVT',rpe:'RPE 6',focus:'5×10 zamiast 10×10 — regeneracja',days:[{d:'PON',name:'Klatka + Plecy: 5×10 (50%)'},{d:'WT',name:'REST'},{d:'ŚR',name:'Nogi: 5×10 (50%)'},{d:'CZ',name:'REST'},{d:'PT',name:'Barki: 5×10'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:5,label:'GVT Faza 2',rpe:'RPE 9',focus:'Zmień ćwiczenia, zachowaj protokół',days:[{d:'PON',name:'Klatka + Plecy: inne ćwiczenia 10×10'},{d:'WT',name:'REST'},{d:'ŚR',name:'Nogi: Leg Press + Nordic Curl 10×10'},{d:'CZ',name:'REST'},{d:'PT',name:'Barki + Ramiona: 10×10'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
      {nr:6,label:'Peak + Test siły',rpe:'RPE 8-9',focus:'Ostatni tydzień GVT + test 1RM po regeneracji',days:[{d:'PON',name:'GVT — finalne 10×10'},{d:'WT',name:'REST'},{d:'ŚR',name:'GVT — finalne 10×10'},{d:'CZ',name:'REST'},{d:'PT',name:'Test 1RM po 3 dniach odpoczynku'},{d:'SO',name:'REST'},{d:'ND',name:'REST'}]},
    ]
  },
  {
    id:'dp11',type:'demo',name:'5/3/1 Wendler — Siła 12 tygodni',goal:'sila',level:'sredni',duration:12,daysPerWeek:4,equip:'Siłownia',method:'5/3/1',
    desc:'Jeden z najpopularniejszych programów siłowych na świecie. Jim Wendler oparł go na 4 ćwiczeniach: Przysiad, Martwy ciąg, OHP, Wyciskanie. Cykle 4-tygodniowe z rosnącą intensywnością i resetem obciążeń. Długoterminowa, powolna ale solidna progresja.',
    highlights:['4 ćwiczenia główne','Cykl 4-tygodniowy (3 + 1 deload)','Submaksymalne ciężary = zdrowie','AMRAP w ostatniej serii (PR)'],
    weeks:[
      {nr:1,label:'Tydzień 5 (65-85%)',rpe:'RPE 7-8',focus:'5-5-5+ — ostatnia seria AMRAP',days:[{d:'PON',name:'OHP: 5×65%, 5×75%, 5+×85% + akcesoria'},{d:'WT',name:'Martwy ciąg: 5×65%, 5×75%, 5+×85% + akcesoria'},{d:'CZ',name:'Wyciskanie: 5×65%, 5×75%, 5+×85% + akcesoria'},{d:'PT',name:'Przysiad: 5×65%, 5×75%, 5+×85% + akcesoria'}]},
      {nr:2,label:'Tydzień 3 (70-90%)',rpe:'RPE 8-9',focus:'3-3-3+ — większe ciężary',days:[{d:'PON',name:'OHP: 3×70%, 3×80%, 3+×90%'},{d:'WT',name:'Martwy: 3×70%, 3×80%, 3+×90%'},{d:'CZ',name:'Wyciskanie: 3×70%, 3×80%, 3+×90%'},{d:'PT',name:'Przysiad: 3×70%, 3×80%, 3+×90%'}]},
      {nr:3,label:'Tydzień 1 (75-95%)',rpe:'RPE 9',focus:'5-3-1+ — najcięższy tydzień',days:[{d:'PON',name:'OHP: 5×75%, 3×85%, 1+×95%'},{d:'WT',name:'Martwy: 5×75%, 3×85%, 1+×95%'},{d:'CZ',name:'Wyciskanie: 5×75%, 3×85%, 1+×95%'},{d:'PT',name:'Przysiad: 5×75%, 3×85%, 1+×95%'}]},
      {nr:4,label:'DELOAD (40-60%)',rpe:'RPE 5-6',focus:'Regeneracja — nie pomijaj!',days:[{d:'PON',name:'OHP: 5×40%, 5×50%, 5×60%'},{d:'WT',name:'Martwy: 5×40%, 5×50%, 5×60%'},{d:'CZ',name:'Wyciskanie: 5×40%, 5×50%, 5×60%'},{d:'PT',name:'Przysiad: 5×40%, 5×50%, 5×60%'}]},
    ]
  },
  {
    id:'dp12',type:'demo',name:'HIIT — Interwały Wysokiej Intensywności 8 tyg.',goal:'kondycja',level:'poczatkujacy',duration:8,daysPerWeek:3,equip:'Bez sprzętu',method:'HIIT',
    desc:'HIIT (High Intensity Interval Training) — naprzemienne okresy wysokiej i niskiej intensywności. Metaanaliza 2019 (British Journal of Sports Medicine): HIIT 28% skuteczniejszy w spalaniu tłuszczu niż steady-state cardio. Idealne gdy masz mało czasu.',
    highlights:['20-30 min treningu = 60 min cardio','Efekt EPOC — spalanie do 24h','Poprawa wrażliwości insulinowej','Zachowanie masy mięśniowej'],
    weeks:[
      {nr:1,label:'Intro HIIT 1:2',rpe:'RPE 7-8',focus:'Stosunek pracy do odpoczynku 1:2 (20s:40s)',days:[{d:'PON',name:'HIIT 20 min: 20s praca / 40s odpoczynek × 20 rund'},{d:'ŚR',name:'REST lub lekki spacer'},{d:'PT',name:'HIIT 20 min: inne ćwiczenia, ten sam protokół'}]},
      {nr:2,label:'HIIT 1:2 progresja',rpe:'RPE 8',focus:'Trudniejsze ćwiczenia',days:[{d:'PON',name:'HIIT 25 min: Burpee, Squat Jump, Push-up, Mountain Climber'},{d:'ŚR',name:'REST'},{d:'PT',name:'HIIT 25 min: Sprint 30s / Marsz 60s × 15'}]},
      {nr:3,label:'HIIT 1:1',rpe:'RPE 8-9',focus:'Równy stosunek pracy i odpoczynku',days:[{d:'PON',name:'HIIT 30 min: 30s praca / 30s odpoczynek'},{d:'ŚR',name:'REST'},{d:'PT',name:'HIIT 30 min: Dolna + Core'}]},
      {nr:4,label:'Deload HIIT',rpe:'RPE 6-7',focus:'Lżejszy tydzień, 1:2 ponownie',days:[{d:'PON',name:'HIIT 20 min — lekki: 1:2'},{d:'ŚR',name:'REST'},{d:'PT',name:'Spacer lub joga'}]},
      {nr:5,label:'HIIT 2:1',rpe:'RPE 9',focus:'Więcej pracy niż odpoczynku',days:[{d:'PON',name:'HIIT 20 min: 40s praca / 20s odpoczynek'},{d:'ŚR',name:'REST'},{d:'PT',name:'HIIT 20 min: 40:20 różne ćwiczenia'}]},
      {nr:6,label:'HIIT zaawansowany',rpe:'RPE 9',focus:'Złożone ćwiczenia wielostawowe',days:[{d:'PON',name:'HIIT 30 min: Kompleksy — Thruster, KB Swing, Box Jump'},{d:'ŚR',name:'REST'},{d:'PT',name:'HIIT Sprint: 10×100m z 1 min przerwy'}]},
      {nr:7,label:'Szczyt HIIT',rpe:'RPE 9-10',focus:'Najkrótsza przerwa, najwyższa intensywność',days:[{d:'PON',name:'Tabata + HIIT hybrid: 4+10+4 min'},{d:'ŚR',name:'REST'},{d:'PT',name:'HIIT maksymalny 20 min: 2:1'}]},
      {nr:8,label:'Test końcowy',rpe:'RPE 8-9',focus:'Porównaj wyniki z tygodnia 1',days:[{d:'PON',name:'HIIT test — ten sam protokół co tydzień 1'},{d:'ŚR',name:'REST'},{d:'PT',name:'Ocena: ile rund więcej?'}]},
    ]
  },
  {
    id:'dp13',type:'demo',name:'Upper/Lower Split — Masa 8 tygodni',goal:'masa',level:'sredni',duration:8,daysPerWeek:4,equip:'Siłownia',method:'Upper/Lower',
    desc:'Klasyczny podział górna/dolna część ciała. Każda partia trenowana 2× tygodniowo. Idealna równowaga między frekwencją, objętością i regeneracją. Zalecany przez NSCA dla naturalnych zawodników na etapie intermediate.',
    highlights:['Każda partia 2×/tydzień','Optymalna synteza białek','Łatwe do modyfikowania','4 dni treningu = ≥3 dni odpoczynku'],
    weeks:[
      {nr:1,label:'Akumulacja I',rpe:'RPE 7',focus:'Budowa bazy, nauka ćwiczeń',days:[{d:'PON',name:'Upper A: Wyciskanie 4×8, Podciąganie 4×8, OHP 3×10, Wiosłowanie 3×10'},{d:'WT',name:'Lower A: Przysiad 4×8, RDL 3×10, Leg Press 3×12, Hip Thrust 3×12'},{d:'CZ',name:'Upper B: Wyciskanie hantli 4×10, Wiosłowanie 4×10, Wznosy 3×15'},{d:'PT',name:'Lower B: Wykrok 3×10, Uginanie nóg 3×12, Wspięcia łydki 4×15'}]},
      {nr:2,label:'Akumulacja I cont.',rpe:'RPE 7-8',focus:'+2,5 kg ciężarach głównych',days:[{d:'PON',name:'Upper A: +2,5 kg'},{d:'WT',name:'Lower A: +2,5 kg'},{d:'CZ',name:'Upper B'},{d:'PT',name:'Lower B'}]},
      {nr:3,label:'Akumulacja II',rpe:'RPE 8',focus:'+1 seria na ćwiczenia główne',days:[{d:'PON',name:'Upper A: 5×8'},{d:'WT',name:'Lower A: 5×8'},{d:'CZ',name:'Upper B: 5×10'},{d:'PT',name:'Lower B: 5×10'}]},
      {nr:4,label:'DELOAD',rpe:'RPE 6',focus:'-50% serii',days:[{d:'PON',name:'Upper — lekki'},{d:'WT',name:'Lower — lekki'},{d:'CZ',name:'REST'},{d:'PT',name:'REST'}]},
    ]
  },
  {
    id:'dp14',type:'demo',name:'Piramida siłowa — Moc i masa 6 tyg.',goal:'sila',level:'sredni',duration:6,daysPerWeek:4,equip:'Siłownia',method:'Piramida',
    desc:'Protokół piramidalny — serie rosnące (ascending) lub malejące (descending) pod względem ciężaru/powtórzeń. Ascending: rozgrzewka wbudowana w trening. Descending: pierwsze serie przy świeżych mięśniach. Kombinacja obu = pełne widmo.',
    highlights:['Wbudowana rozgrzewka (ascending)','Maks. siła na początku (descending)','Podwójna piramida — najskuteczniejsza','Wszechstronne obciążenie mięśni'],
    weeks:[
      {nr:1,label:'Piramida wznosząca',rpe:'RPE 6-9',focus:'12-10-8-6-4 powtórzeń (ciężar rośnie)',days:[{d:'PON',name:'Klatka: Wyciskanie 12/10/8/6/4 + akcesoria'},{d:'WT',name:'Plecy: Wiosłowanie + Podciąganie piramida'},{d:'CZ',name:'Nogi: Przysiad + RDL piramida'},{d:'PT',name:'Barki + Ramiona: OHP piramida + izolacja'}]},
      {nr:2,label:'Piramida wznosząca cont.',rpe:'RPE 7-9',focus:'+2,5 kg na każdym poziomie',days:[{d:'PON',name:'Klatka: piramida +2,5 kg'},{d:'WT',name:'Plecy: piramida +2,5 kg'},{d:'CZ',name:'Nogi: piramida +2,5 kg'},{d:'PT',name:'Barki: piramida +2,5 kg'}]},
      {nr:3,label:'Piramida opadająca',rpe:'RPE 9-7',focus:'4-6-8-10-12 (start ciężki, gdy świeży)',days:[{d:'PON',name:'Klatka: Wyciskanie 4/6/8/10/12 — start maksymalny'},{d:'WT',name:'Plecy: Piramida opadająca'},{d:'CZ',name:'Nogi: Piramida opadająca'},{d:'PT',name:'Barki: Piramida opadająca'}]},
      {nr:4,label:'Podwójna piramida',rpe:'RPE 6-9-6',focus:'12-8-4-8-12 — pełne spectrum',days:[{d:'PON',name:'Klatka: Podwójna piramida 5 serii'},{d:'WT',name:'Plecy: Podwójna piramida'},{d:'CZ',name:'Nogi: Podwójna piramida'},{d:'PT',name:'Barki: Podwójna piramida'}]},
      {nr:5,label:'Piramida + dropset',rpe:'RPE 9-10',focus:'Po szczycie piramidy — dropset do upadku',days:[{d:'PON',name:'Klatka: Piramida wznosząca + dropset na szczycie'},{d:'WT',name:'Plecy: Piramida + dropset'},{d:'CZ',name:'Nogi: Piramida + dropset'},{d:'PT',name:'Barki: Piramida + dropset'}]},
      {nr:6,label:'Deload + ocena',rpe:'RPE 6',focus:'Regeneracja, test 1RM',days:[{d:'PON',name:'Lekka piramida wznosząca 3 serie'},{d:'WT',name:'REST'},{d:'CZ',name:'Test 1RM Przysiad + Wyciskanie'},{d:'PT',name:'REST'}]},
    ]
  },
  {
    id:'dp15',type:'demo',name:'Superserie i Drop sety — Hipertrofia 6 tyg.',goal:'masa',level:'sredni',duration:6,daysPerWeek:4,equip:'Siłownia',method:'Superset/Drop',
    desc:'Superserie (dwa ćwiczenia bez przerwy) i drop sety (zmniejszanie ciężaru bez przerwy) to sprawdzone techniki intensyfikacji treningu. Oszczędzają czas i tworzą ogromny stres metaboliczny. Idealny dla zaawansowanych szukających nowych bodźców.',
    highlights:['Skrócenie czasu treningu 30%','Maksymalny pompa mięśniowa','Superserie antagonistyczne = więcej siły','Dropsety = pełne wyczerpanie mięśnia'],
    weeks:[
      {nr:1,label:'Superserie antagonistyczne',rpe:'RPE 8',focus:'Klatka+Plecy, Biceps+Triceps, Quad+Ham',days:[{d:'PON',name:'Push+Pull: Wyciskanie SS Wiosłowanie × 4, OHP SS Podciąganie × 3'},{d:'WT',name:'Nogi: Przysiad SS RDL × 4, Leg Press SS Uginanie × 3'},{d:'CZ',name:'Ramiona: Biceps SS Triceps × 5 ćwiczeń'},{d:'PT',name:'Barki: Wznosy przód SS tył × 4'}]},
      {nr:2,label:'Superserie agonistyczne',rpe:'RPE 8-9',focus:'Dwa ćwiczenia tej samej partii pod rząd',days:[{d:'PON',name:'Klatka: Wyciskanie SS Rozpiętki × 4'},{d:'WT',name:'Nogi: Przysiad SS Leg Press × 4'},{d:'CZ',name:'Plecy: Podciąganie SS Wiosłowanie × 4'},{d:'PT',name:'Barki: OHP SS Wznosy × 4'}]},
      {nr:3,label:'Drop sety',rpe:'RPE 9-10',focus:'Po ostatniej serii — 2 dropsety',days:[{d:'PON',name:'Klatka: 3 normalne serie + 2 dropsety na koniec'},{d:'WT',name:'Nogi: Leg Press + Squat z dropsetami'},{d:'CZ',name:'Plecy: Ściąganie + Wiosłowanie z dropsetami'},{d:'PT',name:'Ramiona: każde ćwiczenie z dropsetem'}]},
      {nr:4,label:'Deload',rpe:'RPE 6',focus:'Normalne serie, brak superserii',days:[{d:'PON',name:'Push — normalne serie 3×10'},{d:'WT',name:'Pull — normalne serie'},{d:'CZ',name:'REST'},{d:'PT',name:'Nogi — normalne serie'}]},
      {nr:5,label:'Giant Sets',rpe:'RPE 8-9',focus:'3-4 ćwiczenia pod rząd na jedną partię',days:[{d:'PON',name:'Klatka Giant: Wyciskanie→Rozpiętki→Pompki→Dip × 3 rundy'},{d:'WT',name:'Nogi Giant: Przysiad→Leg Press→Wykrok→Hip Thrust × 3'},{d:'CZ',name:'Plecy Giant: Podciąganie→Wiosłowanie→Ściąganie→Facepull × 3'},{d:'PT',name:'Ramiona Giant: Biceps 2 cwicz + Triceps 2 cwicz × 4'}]},
      {nr:6,label:'Rest-Pause',rpe:'RPE 9-10',focus:'Seria do upadku + 10s przerwa + dalej',days:[{d:'PON',name:'Push: Rest-pause na głównych ćwiczeniach'},{d:'WT',name:'Nogi: Rest-pause'},{d:'CZ',name:'Pull: Rest-pause'},{d:'PT',name:'Test sił — brak technik intensyfikacji'}]},
    ]
  },
  {
    id:'dp16',type:'demo',name:'Streching i Mobilność — 4 tygodnie',goal:'kondycja',level:'poczatkujacy',duration:4,daysPerWeek:5,equip:'Bez sprzętu',method:'Mobilność',
    desc:'Program mobilności i elastyczności oparty na badaniach. Połączenie stretchingu statycznego, dynamicznego i PNF (Proprioceptive Neuromuscular Facilitation). Idealne uzupełnienie każdego programu siłowego lub samodzielny program regeneracji.',
    highlights:['PNF stretching — najskuteczniejsza metoda','Poprawa zakresu ruchu o 20-30% w 4 tyg.','Redukcja bólu mięśniowego','5-10 min/dzień wystarczy'],
    weeks:[
      {nr:1,label:'Stretching statyczny',rpe:'RPE 4-5',focus:'Utrzymuj pozycje 30-60 sekund',days:[{d:'PON',name:'Biodra + Uda: Pigeon, Figure-4, Couch stretch, Butterfly — 30 min'},{d:'WT',name:'Grzbiet + Barki: Doorway, Lat stretch, Thoracic rotation — 30 min'},{d:'ŚR',name:'Aktywna regeneracja: Cat-cow, World Greatest, Hip 90/90 — 20 min'},{d:'CZ',name:'Dolna część: Downward dog, Seated forward fold, Lizard — 30 min'},{d:'PT',name:'Górna część: Pec minor, Sleeper stretch, Cross-body — 30 min'}]},
      {nr:2,label:'Stretching dynamiczny',rpe:'RPE 5-6',focus:'Ruch w zakresie, bez utrzymywania',days:[{d:'PON',name:'Rozgrzewka dynamiczna: Leg swing, World Greatest, Inchworm — 20 min'},{d:'WT',name:'Mobilność bioder: Hip circle, Lateral lunge, Spiderman — 20 min'},{d:'ŚR',name:'Kręgosłup: T-spine rotation, Cat-cow, Thread needle — 20 min'},{d:'CZ',name:'Dolna: Toy soldier, Hacky sack, Squat to stand — 20 min'},{d:'PT',name:'Całe ciało: płynna sekwencja 20 min'}]},
      {nr:3,label:'PNF Stretching',rpe:'RPE 6-7',focus:'Naprężenie 6s + rozluźnienie + pogłębienie',days:[{d:'PON',name:'PNF Biodra i uda — technika Contract-Relax'},{d:'WT',name:'PNF Barki i grzbiet'},{d:'ŚR',name:'PNF Hamstringi i łydki'},{d:'CZ',name:'PNF Klatka i piersiowy'},{d:'PT',name:'Pełna sesja mobilności 45 min'}]},
      {nr:4,label:'Foam roller + mobilność',rpe:'RPE 4-6',focus:'Myofascial release + stretching',days:[{d:'PON',name:'Foam roller: plecy, IT band, czworogłowy — 30 min'},{d:'WT',name:'Foam roller: łydki, pośladki, barki — 30 min'},{d:'ŚR',name:'Mobilność aktywna: Yoga flow 30 min'},{d:'CZ',name:'Foam roller + stretching dolna'},{d:'PT',name:'Test zakresu ruchu + ocena postępu'}]},
    ]
  },
  {
    id:'dp17',type:'demo',name:'Trening na masę bez sprzętu — 8 tyg.',goal:'masa',level:'sredni',duration:8,daysPerWeek:4,equip:'Bez sprzętu',method:'Calisthenics',
    desc:'Kalistenika zaawansowana — budowanie masy i siły wyłącznie masą własnego ciała. Progresja przez trudniejsze warianty ćwiczeń. Badania (2017, Journal of Human Kinetics) potwierdzają porównywalną hipertrofię z treningiem siłowym.',
    highlights:['Zero sprzętu — ćwicz wszędzie','Progresja przez trudniejsze warianty','Buduje siłę funkcjonalną','Zdrowe stawy — mniejsze ryzyko kontuzji'],
    weeks:[
      {nr:1,label:'Baza kalisteniki',rpe:'RPE 7',focus:'Opanuj podstawowe wzorce',days:[{d:'PON',name:'Push: Pompki 4×15, Dips 3×10, Pike push-up 3×10'},{d:'WT',name:'Pull: Podciąganie 4×max, Inverted row 3×12'},{d:'CZ',name:'Push: Pompki jednoręczne progresja, Dip variations'},{d:'PT',name:'Legs: Pistol squat progresja, Nordic curl, Hip thrust'}]},
      {nr:2,label:'Progresja wariantów',rpe:'RPE 8',focus:'Trudniejsze wersje gdy >15 powtórzeń',days:[{d:'PON',name:'Push: Pompki z elevacją, Archer push-up progresja'},{d:'WT',name:'Pull: Podciąganie z obciążeniem lub L-sit pull-up'},{d:'CZ',name:'Push: Handstand push-up progresja'},{d:'PT',name:'Legs: Pistol squat, Single leg RDL z masą ciała'}]},
    ]
  },
  {
    id:'dp18',type:'demo',name:'Trening Funkcjonalny — 6 tygodni',goal:'kondycja',level:'poczatkujacy',duration:6,daysPerWeek:3,equip:'Kettlebell',method:'Functional',
    desc:'Trening funkcjonalny z kettlebell i masą własną ciała. Opracowany na wzór protokołów Military Fitness. Poprawia wzorce ruchowe, siłę całego ciała, stabilizację i koordynację. Idealne dla sportowców wszystkich dyscyplin.',
    highlights:['Kompleksowe wzorce ruchowe','Siła + Koordynacja + Propriocepcja','Kettlebell — narzędzie wszechstronne','Turkish Get-Up jako benchmark'],
    weeks:[
      {nr:1,label:'Kettlebell basics',rpe:'RPE 6-7',focus:'Nauka KB Swing, Goblet Squat, Turkish Get-Up',days:[{d:'PON',name:'KB: Swing 5×15, Goblet Squat 4×10, Halo 3×10, Get-Up 3×3/stronę'},{d:'ŚR',name:'Funkcjonalny BW: Bear crawl, Inchworm, Farmer carry'},{d:'PT',name:'KB kompleks: Swing→Clean→Press→Squat × 5 rund'}]},
      {nr:2,label:'Kompleksy KB',rpe:'RPE 7-8',focus:'Płynne przejścia między ćwiczeniami',days:[{d:'PON',name:'KB kompleks 5 ćwiczeń: 5 rund'},{d:'ŚR',name:'Unilateral: TGU + Single leg work + Suitcase carry'},{d:'PT',name:'EMOM 20: Swing + Snatch + Press'}]},
    ]
  },
  {
    id:'dp19',type:'demo',name:'Program Zawodnika — Siła + Moc 12 tyg.',goal:'sila',level:'zaawansowany',duration:12,daysPerWeek:5,equip:'Siłownia',method:'Conjugate/Block',
    desc:'Program dla zaawansowanych sportowców oparty na metodzie sprzężonej Westside Barbell i periodyzacji blokowej. Rozwijanie siły maksymalnej, mocy eksplozywnej i siły-wytrzymałości jednocześnie. Wymaga doświadczenia i solidnej techniki.',
    highlights:['Metoda sprzężona (Conjugate Method)','Max Effort + Dynamic Effort','Ćwiczenia akcesoryjne GPP','Przeznaczony dla zawodników'],
    weeks:[
      {nr:1,label:'ME Lower / DE Upper',rpe:'RPE 9/7',focus:'Max Effort Dolna + Dynamic Effort Górna',days:[{d:'PON',name:'ME Lower: Przysiad 1RM wariacja + akcesoria siłowe'},{d:'WT',name:'DE Upper: 9×3 Wyciskanie @60% + Górna akcesorium'},{d:'ŚR',name:'REST'},{d:'CZ',name:'ME Upper: Wyciskanie 1RM wariacja'},{d:'PT',name:'DE Lower: 10×2 Przysiad @60% + Martwy + Akcesoria'},{d:'SO',name:'GPP: kondycja, mobilność'}]},
      {nr:2,label:'ME Lower / DE Upper',rpe:'RPE 9/7',focus:'Inne wariacje ćwiczeń głównych',days:[{d:'PON',name:'ME Lower: Martwy box pull lub sumo'},{d:'WT',name:'DE Upper: Floor press dynamic'},{d:'ŚR',name:'REST'},{d:'CZ',name:'ME Upper: Board press lub pin press'},{d:'PT',name:'DE Lower: Box squat dynamic'},{d:'SO',name:'GPP'}]},
    ]
  },
  {
    id:'dp20',type:'demo',name:'Bieganie — Od Kanapy do 5km — 8 tyg.',goal:'kondycja',level:'poczatkujacy',duration:8,daysPerWeek:3,equip:'Bez sprzętu',method:'Couch to 5K',
    desc:'Klasyczny protokół C25K (Couch to 5K) zmodyfikowany o wytyczne ACSM. Przeprowadza początkującego od marszu do biegu ciągłego 5 km. Badania potwierdzają: 90% uczestników ukończyło 5K po 9 tygodniach. Zacznij gdzie jesteś.',
    highlights:['Od 0 do 5km w 8 tygodniach','Naprzemienne bieg/marsz','Stopniowe wydłużanie biegu','3 sesje tygodniowo'],
    weeks:[
      {nr:1,label:'Marsz + bieg 1 min',rpe:'RPE 5-6',focus:'60s bieg / 90s marsz × 8 rund = 20 min',days:[{d:'PON',name:'C25K W1: 5 min marsz rozgrzewka → 8× (60s bieg + 90s marsz) → 5 min marsz'},{d:'ŚR',name:'C25K W1 powtórzenie'},{d:'PT',name:'C25K W1 powtórzenie'}]},
      {nr:2,label:'Bieg 1,5 min',rpe:'RPE 6',focus:'90s bieg / 2 min marsz × 6 rund',days:[{d:'PON',name:'C25K W2: 6× (90s bieg + 2 min marsz)'},{d:'ŚR',name:'C25K W2 powtórzenie'},{d:'PT',name:'C25K W2 powtórzenie'}]},
      {nr:3,label:'Bieg 3 min',rpe:'RPE 6-7',focus:'3 min bieg / 90s marsz × 5 rund',days:[{d:'PON',name:'C25K W3: 2× (90s bieg + 90s marsz + 3 min bieg + 3 min marsz)'},{d:'ŚR',name:'C25K W3 powtórzenie'},{d:'PT',name:'C25K W3 powtórzenie'}]},
      {nr:4,label:'Bieg 5 min',rpe:'RPE 7',focus:'5 min bieg ciągły',days:[{d:'PON',name:'C25K W4: 3 min bieg + 90s marsz + 5 min bieg + 2,5 min marsz + 3 min + 90s + 5 min'},{d:'ŚR',name:'C25K W4 powtórzenie'},{d:'PT',name:'C25K W4 powtórzenie'}]},
      {nr:5,label:'Bieg 8-20 min',rpe:'RPE 7',focus:'Wydłużanie biegu ciągłego',days:[{d:'PON',name:'C25K W5D1: 5 min + 3 min marsz + 5 min + 3 min + 5 min'},{d:'ŚR',name:'C25K W5D2: 8 min bieg + 5 min marsz + 8 min bieg'},{d:'PT',name:'C25K W5D3: 20 min bieg ciągły — przełomowy moment!'}]},
      {nr:6,label:'Bieg 22-25 min',rpe:'RPE 7-8',focus:'Wydłużanie do 25 min',days:[{d:'PON',name:'C25K W6D1: 5+8+5 min z marszem'},{d:'ŚR',name:'C25K W6D2: 10 min + 3 min marsz + 10 min'},{d:'PT',name:'C25K W6D3: 22 min bieg ciągły'}]},
      {nr:7,label:'Bieg 25-28 min',rpe:'RPE 7-8',focus:'Zbliżanie się do 5km',days:[{d:'PON',name:'C25K W7: 25 min bieg ciągły'},{d:'ŚR',name:'C25K W7: 25 min'},{d:'PT',name:'C25K W7: 25 min'}]},
      {nr:8,label:'5km!',rpe:'RPE 7-8',focus:'30 min bieg = około 5km',days:[{d:'PON',name:'C25K W8: 28 min bieg ciągły'},{d:'ŚR',name:'C25K W8: 28 min'},{d:'PT',name:'5K RACE: Biegnij 5km bez przerwy! 🎉'}]},
    ]
  },

];

function allPrograms(){return[...DEMO_PROGRAMS,...(window.USER_PROGRAMS||[])];}

function setProgNav(n){
  progNav=n;
  document.querySelectorAll('.prog-nav-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('pn-'+n);if(el)el.classList.add('active');
  renderPrograms();
}

function setProgDurFilter(d){
  progDurFilter=d;
  document.querySelectorAll('#prog-dur-chips .wl-filter-chip').forEach((el,i)=>{
    el.classList.remove('active');
    if((['','4','8','12'][i])===d)el.classList.add('active');
  });
  renderPrograms();
}

function updateProgCounts(){
  const all=allPrograms();
  const cnt=fn=>all.filter(fn).length;
  const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
  set('pnc-all',all.length);
  set('pnc-demo',cnt(p=>p.type==='demo'));
  set('pnc-moje',cnt(p=>p.type==='moje'));
  ['masa','sila','redukcja','kondycja'].forEach(g=>set('pnc-'+g,cnt(p=>p.goal===g)));
  ['poczatkujacy','sredni','zaawansowany'].forEach(l=>set('pnc-'+l,cnt(p=>p.level===l)));
}

function renderPrograms(){
  updateProgCounts();
  const all=allPrograms();
  const search=(document.getElementById('prog-search')||{}).value||'';
  const equipFil=(document.getElementById('prog-equip-fil')||{}).value||'';
  let res=all.filter(p=>{
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!(p.desc||'').toLowerCase().includes(search.toLowerCase()))return false;
    if(equipFil&&p.equip!==equipFil)return false;
    if(progDurFilter&&String(p.duration)!==progDurFilter)return false;
    if(progNav==='all')return true;
    if(progNav==='demo')return p.type==='demo';
    if(progNav==='moje')return p.type==='moje';
    if(['masa','sila','redukcja','kondycja'].includes(progNav))return p.goal===progNav;
    if(['poczatkujacy','sredni','zaawansowany'].includes(progNav))return p.level===progNav;
    return true;
  });

  const lbl=document.getElementById('prog-count-lbl');
  if(lbl)lbl.textContent=res.length+' '+(res.length===1?'program':res.length<5?'programy':'programów');

  const grid=document.getElementById('prog-grid');
  if(!grid)return;
  if(!res.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">📋</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak programów</div><div style="font-size:12px;margin-bottom:20px;">Zmień filtry lub dodaj własny program</div><button class="btn btn-primary" onclick="openM(\'m-program\')">+ Nowy program</button></div>';
    return;
  }

  grid.innerHTML=res.map((p,i)=>{
    const gc=GOAL_COLORS[p.goal]||'var(--accent)';
    const lc=LEVEL_COLORS_P[p.level]||'var(--muted)';
    const ll={'poczatkujacy':'Początkujący','sredni':'Średni','zaawansowany':'Zaawansowany'}[p.level]||p.level;
    const gl=GOAL_LABELS[p.goal]||p.goal;
    // intensity bars for weeks
    const weekBars=(p.weeks||[]).map(w=>{
      const isDeload=w.label&&w.label.includes('DELOAD');
      const fillPct=isDeload?20:Math.min(95,50+w.nr*6);
      const col=isDeload?'var(--orange)':gc;
      return `<div class="prog-week-bar">
        <span class="prog-week-num">TYG ${w.nr}</span>
        <div class="prog-week-fill" style="background:${col};opacity:${isDeload?0.6:0.8};width:${fillPct}%;max-width:100%;"></div>
        <span class="prog-week-label">${w.label||''}</span>
      </div>`;
    }).join('');

    return `<div class="prog-card" style="animation-delay:${i*0.05}s" onclick="openProgDetail('${p.id}')">
      <div class="prog-card-top" style="background:${gc};"></div>
      <div class="prog-card-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px;">
          <div class="prog-card-title">${p.name}</div>
          ${p.type==='demo'?'<span class="pill pill-blue" style="font-size:9px;white-space:nowrap;flex-shrink:0;">DEMO</span>':'<span class="pill pill-green" style="font-size:9px;white-space:nowrap;flex-shrink:0;">MOJE</span>'}
        </div>
        <div class="prog-card-sub">${p.method} · ${gl} · ${ll}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="pill" style="background:${gc}22;color:${gc};font-size:10px;">${gl}</span>
          <span class="pill" style="background:${lc}22;color:${lc};font-size:10px;">${ll}</span>
          <span class="pill pill-muted" style="font-size:10px;">${p.equip}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.desc||''}</div>
        <div class="prog-card-weeks">${weekBars}</div>
      </div>
      <div class="prog-stats-row">
        <div class="prog-stat"><div class="prog-stat-val">${p.duration}</div><div class="prog-stat-lbl">Tygodni</div></div>
        <div class="prog-stat"><div class="prog-stat-val">${p.daysPerWeek}</div><div class="prog-stat-lbl">Dni/tyg</div></div>
        <div class="prog-stat"><div class="prog-stat-val">${(p.weeks||[]).length}</div><div class="prog-stat-lbl">Bloków</div></div>
      </div>
      <div class="prog-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openProgDetail('${p.id}')">Szczegóły</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openAssignProg('${p.id}')">Przypisz</button>
      </div>
    </div>`;
  }).join('');
}

function openProgDetail(id){
  const p=allPrograms().find(x=>x.id===id);if(!p)return;
  progSelId=id;
  const gc=GOAL_COLORS[p.goal]||'var(--accent)';
  const gl=GOAL_LABELS[p.goal]||p.goal;
  const ll={'poczatkujacy':'Początkujący','sredni':'Średni','zaawansowany':'Zaawansowany'}[p.level]||p.level;
  document.getElementById('prd-title').textContent=p.name;
  document.getElementById('prd-meta').textContent=p.method+' · '+gl+' · '+ll+' · '+p.duration+' tyg. · '+p.daysPerWeek+' dni/tyg.';
  document.getElementById('prd-body').innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
      <span class="pill" style="background:${gc}22;color:${gc};">${gl}</span>
      <span class="pill pill-muted">${ll}</span>
      <span class="pill pill-muted">${p.equip}</span>
      <span class="pill pill-muted">${p.method}</span>
      ${p.type==='demo'?'<span class="pill pill-blue">DEMO</span>':''}
    </div>
    <div style="font-size:12px;line-height:1.7;color:var(--muted);margin-bottom:16px;">${p.desc||''}</div>
    ${p.highlights&&p.highlights.length?`<div style="margin-bottom:16px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Kluczowe założenia</div>
      ${p.highlights.map(h=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px;font-size:12px;"><span style="color:${gc};flex-shrink:0;">✓</span><span>${h}</span></div>`).join('')}
    </div>`:''}
    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Harmonogram tygodniowy</div>
    ${(p.weeks||[]).map(w=>{
      const isDeload=w.label&&w.label.includes('DELOAD');
      return `<div class="prog-detail-week">
        <div class="prog-detail-week-hdr">
          <span class="prog-detail-week-num">TYG ${w.nr}</span>
          <div>
            <span style="font-size:12px;font-weight:700;color:${isDeload?'var(--orange)':gc};">${w.label||''}</span>
            ${w.rpe?`<span class="pill pill-muted" style="font-size:9px;margin-left:6px;">${w.rpe}</span>`:''}
          </div>
        </div>
        ${w.focus?`<div style="font-size:11px;color:var(--muted);margin-bottom:6px;padding-left:60px;">${w.focus}</div>`:''}
        ${(w.days||[]).map(d=>`<div class="prog-detail-day">
          <span class="prog-detail-day-name">${d.d}</span>
          <span style="font-size:12px;${d.name==='REST'?'color:var(--muted);font-style:italic;':''}">${d.name}</span>
        </div>`).join('')}
      </div>`;
    }).join('')}`;
  document.getElementById('prog-detail').style.transform='translateX(0)';
}

function closeProgDetail(){
  document.getElementById('prog-detail').style.transform='translateX(100%)';
  progSelId=null;
}

function assignProgramToClient(){
  openAssignProg(progSelId);
}

function openAssignProg(id){
  progSelId=id;
  const p=allPrograms().find(x=>x.id===id);
  if(!p)return;
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  document.getElementById('m-assign-prog-title').textContent='PRZYPISZ: '+p.name.toUpperCase();
  document.getElementById('assign-prog-client').innerHTML=CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
  document.getElementById('assign-prog-date').value=new Date().toISOString().split('T')[0];
  openM('m-assign-prog');
}

async function confirmAssignProgram(){
  const p=allPrograms().find(x=>x.id===progSelId);
  if(!p)return;
  const cid=document.getElementById('assign-prog-client').value;
  const startDate=document.getElementById('assign-prog-date').value||new Date().toISOString().split('T')[0];
  const c=CL.find(x=>x.id===cid);
  if(!c){notify('Wybierz klienta!');return;}

  // Buduj pełny obiekt planu z programu
  const newPlan={
    id:'prog_'+Date.now(),
    name:p.name,
    clientId:cid,
    clientName:c.name,
    method:p.method||'Własna',
    duration:p.duration||8,
    level:p.level||'sredni',
    goal:p.goal||'masa',
    source:'program',
    programId:p.id,
    startDate,
    createdAt:new Date().toISOString(),
    days:(p.weeks&&p.weeks[0]&&p.weeks[0].days
      ? p.weeks[0].days.map(d=>({
          day:d.d||d.name||'',
          muscles:d.name||'',
          rest:d.name==='REST'||d.rest||false,
          exercises:[]
        }))
      : [])
  };

  PL.push(newPlan);

  // Zapisz do Firebase jeśli dostępne
  if(window._db){
    try{
      const r=await window._add(window._col(window._db,'plans'),newPlan);
      if(r&&r.id)newPlan.id=r.id;
    }catch(e){console.warn('Firebase plan save:',e);}
  }

  closeM('m-assign-prog');
  closeProgDetail();

  addNotification('system','Program przypisany!','"'+p.name+'" → '+c.name,'plans');
  notify('✓ Program "'+p.name+'" przypisany do: '+c.name+'!');

  // Jeśli profil klienta otwarty — odśwież zakładkę Plan
  if(typeof cpClientId!=='undefined'&&cpClientId===cid){
    try{setCPTab('plan');}catch(e){}
  }
}

async function saveUserProgram(){
  const name=document.getElementById('pm-name').value.trim();
  if(!name){notify('Wpisz nazwę programu!');return;}
  const p={
    id:'up'+Date.now(),type:'moje',
    name,goal:document.getElementById('pm-goal').value,
    level:document.getElementById('pm-level').value,
    duration:parseInt(document.getElementById('pm-dur').value),
    daysPerWeek:parseInt(document.getElementById('pm-days').value),
    equip:document.getElementById('pm-equip').value,
    method:document.getElementById('pm-method').value,
    desc:document.getElementById('pm-desc').value,
    highlights:[],weeks:[],createdAt:new Date().toISOString()
  };
  try{if(window._db){const r=await window._add(window._col(window._db,'programs'),p);p.id=r.id;}}catch(e){}
  window.USER_PROGRAMS.push(p);closeM('m-program');renderPrograms();notify('Program dodany! 📋');
}
window.TASKS=[];var taskFilter='all';

const TASK_TEMPLATES=[
  {id:'tt1',name:'Start programu — tydzień 1',cat:'trening',icon:'💪',desc:'Pakiet zadań na pierwsze 7 dni po starcie programu',tasks:[{title:'Wykonaj 3 treningi zgodnie z planem',cat:'trening',priority:'high',days:7},{title:'Zrób zdjęcia startowe (przód, bok, tył)',cat:'pomiary',priority:'high',days:2},{title:'Zmierz masę ciała rano na czczo',cat:'pomiary',priority:'medium',days:1},{title:'Wypełnij ankietę wstępną',cat:'lifestyle',priority:'medium',days:3},{title:'Zainstaluj aplikację do śledzenia kalorii',cat:'dieta',priority:'low',days:5}]},
  {id:'tt2',name:'Kontrola miesięczna',cat:'pomiary',icon:'📏',desc:'Ocena postępów po 4 tygodniach programu',tasks:[{title:'Zmierz masę ciała (3 dni z rzędu, średnia)',cat:'pomiary',priority:'high',days:3},{title:'Zrób zdjęcia postępu',cat:'pomiary',priority:'high',days:3},{title:'Wypełnij formularz oceny postępów',cat:'pomiary',priority:'medium',days:5},{title:'Oceń samopoczucie i energię (skala 1-10)',cat:'lifestyle',priority:'medium',days:2},{title:'Zgłoś ból lub dyskomfort do trenera',cat:'lifestyle',priority:'high',days:1}]},
  {id:'tt3',name:'Tydzień nawyków żywieniowych',cat:'dieta',icon:'🥗',desc:'Praca nad podstawami diety przez 7 dni',tasks:[{title:'Jedz 1.8-2.2g białka na kg masy ciała każdego dnia',cat:'dieta',priority:'high',days:7},{title:'Wypij min. 35ml wody na kg masy ciała',cat:'dieta',priority:'high',days:7},{title:'Meal prep — przygotuj posiłki wieczorem',cat:'dieta',priority:'medium',days:7},{title:'Unikaj alkoholu przez cały tydzień',cat:'lifestyle',priority:'medium',days:7},{title:'Zapisuj wszystkie posiłki w aplikacji',cat:'dieta',priority:'low',days:7}]},
  {id:'tt4',name:'Tydzień regeneracji',cat:'lifestyle',icon:'😴',desc:'Zadania wspierające regenerację i sen',tasks:[{title:'Śpij minimum 7-8 godzin każdej nocy',cat:'lifestyle',priority:'high',days:7},{title:'Wykonaj 10 min stretching wieczorem',cat:'trening',priority:'medium',days:7},{title:'Wyjdź na spacer 30 min 3× w tygodniu',cat:'lifestyle',priority:'medium',days:7},{title:'Ogranicz ekrany 1h przed snem',cat:'lifestyle',priority:'low',days:7},{title:'Foam rolling po każdym treningu',cat:'trening',priority:'low',days:3}]},
  {id:'tt5',name:'Tydzień deloadu',cat:'trening',icon:'⚡',desc:'Zadania na tydzień deloadu i regeneracji CNS',tasks:[{title:'Trenuj z 50% normalnej objętości i -10% ciężaru',cat:'trening',priority:'high',days:7},{title:'Skup się na technice — lekkie ciężary, pełny ROM',cat:'trening',priority:'high',days:7},{title:'Oceń postępy i przygotuj plan na kolejny blok',cat:'pomiary',priority:'medium',days:5},{title:'Zaplanuj cele na kolejne 4 tygodnie',cat:'lifestyle',priority:'medium',days:4}]},
  {id:'tt6',name:'Przed nowym blokiem',cat:'trening',icon:'🎯',desc:'Zadania przed startem kolejnego cyklu',tasks:[{title:'Ustal nowe 1RM lub szacunkowe maksima',cat:'pomiary',priority:'high',days:3},{title:'Przejrzyj notatki z poprzedniego bloku',cat:'trening',priority:'medium',days:2},{title:'Omów zmiany w planie z trenerem',cat:'lifestyle',priority:'high',days:3},{title:'Sprawdź sprzęt — pas, opaski, buty',cat:'trening',priority:'low',days:5}]},
];

const TASK_CAT_COLORS={trening:'var(--accent)',dieta:'var(--teal)',pomiary:'var(--blue)',lifestyle:'var(--purple)'};
const TASK_CAT_LABELS={trening:'Trening',dieta:'Dieta',pomiary:'Pomiary',lifestyle:'Lifestyle'};
const TASK_PRIO_COLORS={high:'var(--red)',medium:'var(--orange)',low:'var(--teal)'};
const TASK_PRIO_LABELS={high:'Wysoki',medium:'Średni',low:'Niski'};

function setTaskFilter(f){
  taskFilter=f;
  document.querySelectorAll('.task-nav-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('tn-'+f);if(el)el.classList.add('active');
  renderTasks();
}

function renderTasks(){
  const clf=document.getElementById('task-client-filter');
  if(clf){const cur=clf.value;clf.innerHTML='<option value="">Wszyscy klienci</option>'+CL.map(c=>'<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+c.name+'</option>').join('');}
  const today=new Date().toISOString().split('T')[0];
  const search=(document.getElementById('task-search')||{}).value||'';
  const clientFil=(document.getElementById('task-client-filter')||{}).value||'';
  const sortBy=(document.getElementById('task-sort')||{}).value||'due';
  const open=TASKS.filter(t=>t.status!=='done');
  const done=TASKS.filter(t=>t.status==='done');
  const over=TASKS.filter(t=>t.status!=='done'&&t.due&&t.due<today);
  const tOpen=document.getElementById('t-open');if(tOpen)tOpen.textContent=open.length;
  const tDone=document.getElementById('t-done');if(tDone)tDone.textContent=done.length;
  const tOver=document.getElementById('t-over');if(tOver)tOver.textContent=over.length;
  let filtered=TASKS.filter(t=>{
    if(search&&!t.title.toLowerCase().includes(search.toLowerCase()))return false;
    if(clientFil&&t.clientId!==clientFil)return false;
    if(taskFilter==='open')return t.status!=='done';
    if(taskFilter==='done')return t.status==='done';
    if(taskFilter==='overdue')return t.status!=='done'&&t.due&&t.due<today;
    if(['high','medium','low'].includes(taskFilter))return t.priority===taskFilter;
    if(['trening','dieta','pomiary','lifestyle'].includes(taskFilter))return t.cat===taskFilter;
    return true;
  });
  if(sortBy==='due')filtered.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  else if(sortBy==='priority'){const o={high:0,medium:1,low:2};filtered.sort((a,b)=>(o[a.priority]||1)-(o[b.priority]||1));}
  else if(sortBy==='client')filtered.sort((a,b)=>{const ca=CL.find(c=>c.id===a.clientId);const cb=CL.find(c=>c.id===b.clientId);return(ca?ca.name:'').localeCompare(cb?cb.name:'');});
  else filtered.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const lbl=document.getElementById('task-count-lbl');if(lbl)lbl.textContent=filtered.length+' '+(filtered.length===1?'zadanie':filtered.length<5?'zadania':'zadań');
  const el=document.getElementById('tasks-list');
  if(!el)return;
  if(!filtered.length){el.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">✅</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak zadań</div><div style="font-size:12px;margin-bottom:20px;">Dodaj zadanie lub użyj szablonu</div><div style="display:flex;gap:8px;justify-content:center;"><button class="btn btn-ghost btn-sm" onclick="openTaskTemplates()">📋 Szablony</button><button class="btn btn-primary btn-sm" onclick="openM('m-task')">+ Zadanie</button></div></div>`;return;}
  const groups={};
  filtered.forEach(t=>{const key=t.clientId||'__general';if(!groups[key])groups[key]=[];groups[key].push(t);});
  let html='';
  Object.entries(groups).forEach(([cid,tasks])=>{
    const c=CL.find(x=>x.id===cid);const cname=c?c.name:'Ogólne';const ci=CL.indexOf(c);
    html+=`<div style="margin-bottom:16px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">${c?`<div style="width:24px;height:24px;border-radius:50%;background:${COLS[ci%5]}22;color:${COLS[ci%5]};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:11px;flex-shrink:0;">${getInit(cname)}</div>`:'<div style="width:24px;height:24px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:12px;">📋</div>'}<span style="font-size:13px;font-weight:700;">${cname}</span><span class="pill pill-muted" style="font-size:10px;">${tasks.length}</span><div style="flex:1;height:1px;background:var(--border);"></div></div>`;
    tasks.forEach((t,i)=>{
      const isOverdue=t.status!=='done'&&t.due&&t.due<today;
      const isDone=t.status==='done';
      const catCol=TASK_CAT_COLORS[t.cat]||'var(--muted)';
      const prioCol=TASK_PRIO_COLORS[t.priority]||'var(--muted)';
      const daysLeft=t.due?Math.ceil((new Date(t.due)-new Date())/(1000*60*60*24)):null;
      html+=`<div class="task-card${isDone?' done':''}" style="animation-delay:${i*0.03}s;border-left:3px solid ${isDone?'var(--muted2)':catCol};">
        <div class="task-check${isDone?' checked':''}" onclick="toggleTask('${t.id}')">${isDone?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div class="task-body">
          <div class="task-title${isDone?' done':''}">${t.title}</div>
          <div class="task-meta">
            ${t.cat?`<span class="pill" style="background:${catCol}22;color:${catCol};font-size:9px;">${TASK_CAT_LABELS[t.cat]||t.cat}</span>`:''}
            <div class="task-prio-dot" style="background:${prioCol};"></div>
            <span style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${TASK_PRIO_LABELS[t.priority]||''}</span>
            ${t.due?`<span style="font-size:10px;font-family:'DM Mono',monospace;color:${isOverdue?'var(--red)':daysLeft<=2?'var(--orange)':'var(--muted)'};">${isOverdue?'⚠ PRZET.':daysLeft===0?'dziś':daysLeft===1?'jutro':'za '+daysLeft+' dni'}</span>`:''}
          </div>
        </div>
        <button onclick="delTask('${t.id}')" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;align-self:flex-start;padding:0 2px;">×</button>
      </div>`;
    });
    html+='</div>';
  });
  el.innerHTML=html;
}

async function saveTask(){
  const title=document.getElementById('task-title').value.trim();if(!title){notify('Wpisz zadanie!');return;}
  const catEl=document.getElementById('task-cat');
  const t={id:'l'+Date.now(),title,clientId:document.getElementById('task-client').value,due:document.getElementById('task-due').value,priority:document.getElementById('task-priority').value,cat:catEl?catEl.value:'trening',desc:'',status:'open',createdAt:new Date().toISOString()};
  TASKS.push(t);closeM('m-task');renderTasks();
  if(cpClientId&&cpClientId===t.clientId){try{setCPTab(cpTab);}catch(e){}}
  notify('Zadanie dodane!');
  if(window._db){try{const r=await window._add(window._col(window._db,'tasks'),t);if(r&&r.id)t.id=r.id;}catch(e){console.warn('Firebase:',e);}}
}
function toggleTask(id){const t=TASKS.find(x=>x.id===id);if(t)t.status=t.status==='done'?'open':'done';renderTasks();}
function delTask(id){window.TASKS=TASKS.filter(t=>t.id!==id);renderTasks();}

function openTaskTemplates(){
  const sel=document.getElementById('tmpl-client-sel');
  if(sel)sel.innerHTML=CL.length?CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join(''):'<option value="">Brak klientów — dodaj klienta</option>';
  const body=document.getElementById('task-templates-body');
  if(body)body.innerHTML=TASK_TEMPLATES.map(tmpl=>`<div class="tmpl-card"><div class="tmpl-card-hdr"><div><span style="font-size:18px;margin-right:6px;">${tmpl.icon}</span><span style="font-size:13px;font-weight:700;">${tmpl.name}</span></div><button class="btn btn-primary btn-sm" onclick="applyTemplate('${tmpl.id}')">Przypisz</button></div><div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${tmpl.desc}</div><div class="tmpl-tasks">${tmpl.tasks.map(t=>`<div class="tmpl-task-item"><span style="color:${TASK_CAT_COLORS[t.cat]||'var(--muted)'};flex-shrink:0;">•</span><span>${t.title}</span><span style="margin-left:auto;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);white-space:nowrap;flex-shrink:0;padding-left:6px;">${t.days}d</span></div>`).join('')}</div></div>`).join('');
  document.getElementById('task-templates-panel').style.transform='translateX(0)';
}
function closeTaskTemplates(){document.getElementById('task-templates-panel').style.transform='translateX(100%)';}

async function applyTemplate(tmplId){
  const tmpl=TASK_TEMPLATES.find(t=>t.id===tmplId);if(!tmpl)return;
  const cid=document.getElementById('tmpl-client-sel').value;if(!cid){notify('Wybierz klienta!');return;}
  const today=new Date();let added=0;
  for(const t of tmpl.tasks){
    const due=new Date(today);due.setDate(due.getDate()+t.days);
    const task={title:t.title,clientId:cid,due:due.toISOString().split('T')[0],priority:t.priority,cat:t.cat,desc:'',status:'open',createdAt:new Date().toISOString()};
    try{if(window._db){const r=await window._add(window._col(window._db,'tasks'),task);task.id=r.id;}else task.id='l'+Date.now();}catch(e){task.id='l'+Date.now();}
    TASKS.push(task);added++;
  }
  const c=CL.find(x=>x.id===cid);
  closeTaskTemplates();renderTasks();
  notify('✓ Dodano '+added+' zadań dla '+(c?c.name:'klienta')+' — '+tmpl.name);
}

async function askTaskAI(){
  const q=document.getElementById('task-ai-q').value.trim();if(!q)return;
  document.getElementById('task-ai-q').value='';
  const msgs=document.getElementById('task-ai-msgs');
  msgs.innerHTML+='<div style="text-align:right;margin-bottom:6px;"><div style="display:inline-block;background:var(--accent);color:#000;padding:5px 9px;border-radius:8px;font-size:11px;">'+q+'</div></div>';
  msgs.innerHTML+='<div id="tai-t" style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);border:1px solid var(--border2);padding:5px 9px;border-radius:8px;font-size:11px;opacity:0.5;">Generuję zadania...</div></div>';
  msgs.scrollTop=msgs.scrollHeight;
  const clientFil=(document.getElementById('task-client-filter')||{}).value||'';
  const c=CL.find(x=>x.id===clientFil);
  const ctx=c?`Klient: ${c.name}, ${c.age||'?'} lat, cel: ${c.goal||'?'}, poziom: ${c.level||'?'}. `:'';
  const sys='Asystent trenera personalnego. Zaproponuj 3-5 konkretnych zadań dla klienta jako JSON array: [{"title":"...","cat":"trening|dieta|pomiary|lifestyle","priority":"high|medium|low","days":N}]. Tylko czysty JSON, bez markdown. Zadania po polsku, konkretne i mierzalne.';
  try{
    const r=await fetch(W,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:400,system:sys,messages:[{role:'user',content:ctx+q}]})});
    const d=await r.json();
    const raw=d.content.map(i=>i.text||'').join('');
    let tasks=[];try{tasks=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){}
    if(tasks.length){
      const aiHtml=tasks.map(t=>`<div style="background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;margin-bottom:4px;font-size:11px;"><div style="font-weight:600;margin-bottom:4px;">${t.title}</div><div style="display:flex;gap:5px;align-items:center;"><span class="pill" style="background:${TASK_CAT_COLORS[t.cat]||'var(--muted)'}22;color:${TASK_CAT_COLORS[t.cat]||'var(--muted)'};font-size:9px;">${t.cat||''}</span><span style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">${t.days||7}d</span><button onclick="addAITask(${JSON.stringify(t).replace(/"/g,"&quot;")})" style="margin-left:auto;background:var(--accent);color:#000;border:none;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;cursor:pointer;">+ Dodaj</button></div></div>`).join('');
      document.getElementById('tai-t').outerHTML=`<div style="margin-bottom:6px;">${aiHtml}</div>`;
    }else{document.getElementById('tai-t').outerHTML=`<div style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);padding:5px 9px;border-radius:8px;font-size:11px;">${raw.substring(0,150)}</div></div>`;}
  }catch(e){document.getElementById('tai-t').outerHTML=`<div style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);padding:5px 9px;border-radius:8px;font-size:11px;color:var(--red);">Błąd połączenia</div></div>`;}
  msgs.scrollTop=msgs.scrollHeight;
}

async function addAITask(t){
  if(typeof t==='string')try{t=JSON.parse(t);}catch(e){return;}
  const clientFil=(document.getElementById('task-client-filter')||{}).value||'';
  const due=new Date();due.setDate(due.getDate()+(t.days||7));
  const task={title:t.title,clientId:clientFil,due:due.toISOString().split('T')[0],priority:t.priority||'medium',cat:t.cat||'trening',desc:'',status:'open',createdAt:new Date().toISOString()};
  try{if(window._db){const r=await window._add(window._col(window._db,'tasks'),task);task.id=r.id;}else task.id='l'+Date.now();}catch(e){task.id='l'+Date.now();}
  TASKS.push(task);renderTasks();notify('Zadanie AI dodane ✓');
}

