// ════════════════════════════════════════
// FORMS — ENHANCED
// ════════════════════════════════════════
var formNav='all';var formSelId=null;var sendFormId=null;
window.CUSTOM_FORMS=[];
window.FORM_SENDS=[];// {formId, clientId, sentAt, status:'sent'|'filled', answers:[]}

const CAT_COLORS_F={wstepna:'var(--accent)',postepy:'var(--blue)',zdrowie:'var(--red)',dieta:'var(--teal)',satysfakcja:'var(--purple)'};
const CAT_LABELS_F={wstepna:'Wstępna',postepy:'Postępy',zdrowie:'Zdrowie',dieta:'Dieta',satysfakcja:'Satysfakcja'};
const Q_TYPE_LABELS={text:'Tekst',scale:'Skala 1-10',yesno:'Tak/Nie',number:'Liczba',choice:'Wybór'};

const DEMO_FORMS=[
  {
    id:'df1',type:'demo',status:'active',cat:'wstepna',
    name:'Ankieta wstępna',
    desc:'Podstawowe informacje o stanie zdrowia, celach i historii treningowej klienta. Wysyłana automatycznie po dodaniu nowego klienta.',
    questions:[
      {id:'q1',type:'text',text:'Jaki jest Twój główny cel treningowy?',required:true},
      {id:'q2',type:'choice',text:'Jak długo trenujesz?',options:['Jestem początkujący (0-1 rok)','1-3 lata','Ponad 3 lata'],required:true},
      {id:'q3',type:'yesno',text:'Czy masz jakieś kontuzje lub problemy zdrowotne, o których powinienem wiedzieć?',required:true},
      {id:'q4',type:'text',text:'Jeśli tak — opisz proszę rodzaj i lokalizację bólu/kontuzji'},
      {id:'q5',type:'number',text:'Ile dni w tygodniu możesz trenować?',required:true},
      {id:'q6',type:'choice',text:'O której porze dnia preferujesz trening?',options:['Rano (6-10)','Południe (10-14)','Po południu (14-18)','Wieczór (18-22)'],required:false},
      {id:'q7',type:'yesno',text:'Czy stosujesz jakąś dietę lub masz ograniczenia żywieniowe?'},
      {id:'q8',type:'text',text:'Opisz swój typowy dzień żywieniowy (3 główne posiłki)'},
      {id:'q9',type:'scale',text:'Jak oceniasz swój obecny poziom energii (1=bardzo niski, 10=bardzo wysoki)?',required:true},
      {id:'q10',type:'text',text:'Czego oczekujesz od współpracy ze mną jako trenerem?',required:true},
    ]
  },
  {
    id:'df2',type:'demo',status:'active',cat:'zdrowie',
    name:'Ocena postawy i zdrowia',
    desc:'Szczegółowa analiza wad postawy, bólu, ograniczeń ruchowych i historii medycznej. Kluczowa przed ułożeniem planu.',
    questions:[
      {id:'q1',type:'yesno',text:'Czy odczuwasz bóle kręgosłupa (odcinek lędźwiowy)?',required:true},
      {id:'q2',type:'yesno',text:'Czy odczuwasz bóle kręgosłupa (odcinek szyjny/piersiowy)?'},
      {id:'q3',type:'choice',text:'Czy masz zdiagnozowane wady postawy?',options:['Nie','Hiperlordoza','Hiperkifoza','Skolioza','Protrakcja barków','Kilka z powyższych'],required:true},
      {id:'q4',type:'yesno',text:'Czy miałeś/aś operacje ortopedyczne w ciągu ostatnich 2 lat?'},
      {id:'q5',type:'text',text:'Opisz operacje lub poważne urazy (jeśli dotyczy)'},
      {id:'q6',type:'yesno',text:'Czy przyjmujesz leki na stałe?'},
      {id:'q7',type:'choice',text:'Jak oceniasz swoją mobilność bioder?',options:['Dobra (pełny przysiad bez problemów)','Średnia (pewne ograniczenia)','Słaba (trudności z głębokim przysiadem)'],required:true},
      {id:'q8',type:'yesno',text:'Czy masz problemy z kolanami (ból, trzaski, niestabilność)?'},
      {id:'q9',type:'yesno',text:'Czy masz problemy z barkami (ból przy uniesieniu ramion)?'},
      {id:'q10',type:'scale',text:'Jak oceniasz swój ogólny stan zdrowia (1=bardzo zły, 10=doskonały)?',required:true},
    ]
  },
  {
    id:'df3',type:'demo',status:'active',cat:'postepy',
    name:'Miesięczna ocena postępów',
    desc:'Formularz wysyłany co 30 dni. Mierzy postęp fizyczny, samopoczucie i satysfakcję z planu treningowego.',
    questions:[
      {id:'q1',type:'number',text:'Aktualna masa ciała (kg)'},
      {id:'q2',type:'scale',text:'Jak oceniasz swoje postępy w tym miesiącu? (1=brak postępów, 10=świetne)'},
      {id:'q3',type:'scale',text:'Jak oceniasz swoje samopoczucie i energię? (1=bardzo złe, 10=doskonałe)'},
      {id:'q4',type:'number',text:'Ile treningów udało Ci się wykonać w tym miesiącu?'},
      {id:'q5',type:'scale',text:'Jak oceniasz poziom trudności planu? (1=za łatwy, 10=za trudny)'},
      {id:'q6',type:'yesno',text:'Czy trzymałeś/aś się planu żywieniowego?'},
      {id:'q7',type:'yesno',text:'Czy wystąpiły jakieś bóle lub kontuzje w tym miesiącu?'},
      {id:'q8',type:'text',text:'Opisz bóle lub kontuzje (jeśli dotyczy)'},
      {id:'q9',type:'scale',text:'Jak bardzo jesteś zadowolony/a ze współpracy z trenerem? (1-10)'},
      {id:'q10',type:'text',text:'Co chciałbyś/chciałabyś zmienić lub ulepszyć w swoim planie?'},
    ]
  },
  {
    id:'df4',type:'demo',status:'active',cat:'dieta',
    name:'Wywiad żywieniowy',
    desc:'Szczegółowe informacje o nawykach żywieniowych, preferencjach i celach dietetycznych klienta.',
    questions:[
      {id:'q1',type:'number',text:'Ile posiłków dziennie spożywasz?'},
      {id:'q2',type:'yesno',text:'Czy liczysz kalorie lub makroskładniki?'},
      {id:'q3',type:'choice',text:'Jaki jest Twój główny cel żywieniowy?',options:['Redukcja masy ciała','Budowa masy mięśniowej','Utrzymanie wagi','Poprawa zdrowia','Nie mam konkretnego celu'],required:true},
      {id:'q4',type:'yesno',text:'Czy jesteś wegetarianinem/weganinem?'},
      {id:'q5',type:'text',text:'Jakie masz ograniczenia dietetyczne lub alergie pokarmowe?'},
      {id:'q6',type:'scale',text:'Jak oceniasz jakość swojej diety (1=bardzo zła, 10=doskonała)?'},
      {id:'q7',type:'number',text:'Ile litrów wody pijesz dziennie?'},
      {id:'q8',type:'yesno',text:'Czy suplementujesz? (białko, kreatyna, witaminy itp.)'},
      {id:'q9',type:'text',text:'Jakie suplementy stosujesz?'},
      {id:'q10',type:'text',text:'O której godzinie zwykle jesz ostatni posiłek?'},
    ]
  },
  {
    id:'df5',type:'demo',status:'active',cat:'satysfakcja',
    name:'Ankieta satysfakcji klienta',
    desc:'Badanie zadowolenia ze współpracy z trenerem. Anonimowe. Pomaga ulepszać usługi.',
    questions:[
      {id:'q1',type:'scale',text:'Jak oceniasz ogólną jakość współpracy z trenerem? (1-10)',required:true},
      {id:'q2',type:'scale',text:'Jak oceniasz jakość ułożonego planu treningowego? (1-10)',required:true},
      {id:'q3',type:'scale',text:'Jak oceniasz komunikację i dostępność trenera? (1-10)',required:true},
      {id:'q4',type:'scale',text:'Jak oceniasz postępy, które osiągnąłeś/osiągnęłaś? (1-10)'},
      {id:'q5',type:'yesno',text:'Czy poleciłbyś/poleciłabyś tego trenera znajomym?',required:true},
      {id:'q6',type:'text',text:'Co najbardziej cenisz we współpracy z trenerem?'},
      {id:'q7',type:'text',text:'Co Twoim zdaniem można by poprawić?'},
    ]
  },
];

function allForms(){return[...DEMO_FORMS,...(window.CUSTOM_FORMS||[])];}

function createFormSend(form,clientId,extraMsg){
  if(!form||!clientId)return null;
  const now=new Date();
  const iso=now.toISOString();
  const send=withTrainer({
    id:newId('fs'),
    formId:form.id,
    formName:form.name||'Formularz',
    clientId,
    sentAt:now.toLocaleDateString('pl'),
    sentAtIso:iso,
    createdAt:iso,
    status:'sent',
    answers:{},
    questions:snapshotFormQuestions(form)
  });
  window.FORM_SENDS=window.FORM_SENDS||[];
  window.FORM_SENDS.push(send);
  persistById('formSends',send);
  const msg=(extraMsg||'').trim()||('📋 Proszę wypełnić formularz: "'+(form.name||'Formularz')+'"');
  if(typeof pushMsg==='function')pushMsg(clientId,msg);
  return send;
}
window.createFormSend=createFormSend;

function setFormNav(n){
  formNav=n;
  document.querySelectorAll('.form-nav-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('fn-'+n);if(el)el.classList.add('active');
  renderForms();
}

function updateFormCounts(){
  const all=allForms();
  const cnt=fn=>all.filter(fn).length;
  const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
  set('fnc-all',all.length);
  set('fnc-active',cnt(f=>f.status==='active'));
  set('fnc-draft',cnt(f=>f.status==='draft'));
  ['wstepna','postepy','zdrowie','dieta','satysfakcja'].forEach(c=>set('fnc-'+c,cnt(f=>f.cat===c)));
  // stats
  const sent=FORM_SENDS.length;
  const filled=FORM_SENDS.filter(s=>s.status==='filled').length;
  set('fs-sent',sent);
  set('fs-filled',filled);
  set('fs-pending',sent-filled);
}

function renderForms(){
  updateFormCounts();
  const all=allForms();
  const search=(document.getElementById('form-search')||{}).value||'';
  const clientFil=(document.getElementById('form-client-filter')||{}).value||'';

  // populate client filter
  const cf=document.getElementById('form-client-filter');
  if(cf){const cur=cf.value;cf.innerHTML='<option value="">Wszyscy klienci</option>'+CL.map(c=>'<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+c.name+'</option>').join('');}

  let res=all.filter(f=>{
    if(search&&!f.name.toLowerCase().includes(search.toLowerCase())&&!(f.desc||'').toLowerCase().includes(search.toLowerCase()))return false;
    if(formNav==='active')return f.status==='active';
    if(formNav==='draft')return f.status==='draft';
    if(['wstepna','postepy','zdrowie','dieta','satysfakcja'].includes(formNav))return f.cat===formNav;
    return true;
  });

  const lbl=document.getElementById('form-count-lbl');
  if(lbl)lbl.textContent=res.length+' '+(res.length===1?'formularz':res.length<5?'formularze':'formularzy');

  const grid=document.getElementById('forms-grid-main');
  if(!grid)return;
  if(!res.length){
    grid.innerHTML='<div style="text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">📋</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak formularzy</div><button class="btn btn-primary" onclick="openM(\'m-form\')">+ Nowy formularz</button></div>';
    return;
  }

  grid.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">${res.map((f,i)=>{
    const col=CAT_COLORS_F[f.cat]||'var(--accent)';
    const cl=CAT_LABELS_F[f.cat]||f.cat;
    const sends=FORM_SENDS.filter(s=>s.formId===f.id);
    const filled=sends.filter(s=>s.status==='filled').length;
    return `<div class="form-card" style="animation-delay:${i*0.04}s" onclick="openFormDetail('${f.id}')">
      <div class="form-card-top" style="background:${col};"></div>
      <div class="form-card-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px;">
          <div class="form-card-title">${f.name}</div>
          ${f.type==='demo'?'<span class="pill pill-blue" style="font-size:9px;white-space:nowrap;">DEMO</span>':'<span class="pill pill-green" style="font-size:9px;white-space:nowrap;">MOJE</span>'}
        </div>
        <div class="form-card-desc">${f.desc||''}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="pill" style="background:${col}22;color:${col};font-size:10px;">${cl}</span>
          <span class="pill pill-muted" style="font-size:10px;">${(f.questions||[]).length} pytań</span>
          <span class="pill ${f.status==='active'?'pill-green':'pill-muted'}" style="font-size:10px;">${f.status==='active'?'Aktywny':'Roboczy'}</span>
        </div>
        <div class="form-card-stats">
          <div style="font-size:11px;color:var(--muted);">Wysłanych: <span style="color:var(--text);font-weight:600;">${sends.length}</span> · Wypełnionych: <span style="color:var(--teal);font-weight:600;">${filled}</span></div>
          <div style="display:flex;gap:5px;" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="openFormDetail('${f.id}')">Podgląd</button>
            <button class="btn btn-primary btn-sm" onclick="openSendForm('${f.id}')">Wyślij</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openFormDetail(id){
  const f=allForms().find(x=>x.id===id);if(!f)return;
  formSelId=id;
  const col=CAT_COLORS_F[f.cat]||'var(--accent)';
  const cl=CAT_LABELS_F[f.cat]||f.cat;
  document.getElementById('fd-title').textContent=f.name;
  document.getElementById('fd-meta').textContent=cl+' · '+(f.questions||[]).length+' pytań · '+(f.status==='active'?'Aktywny':'Roboczy');

  const sends=FORM_SENDS.filter(s=>s.formId===id);

  document.getElementById('fd-body').innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
      <span class="pill" style="background:${col}22;color:${col};">${cl}</span>
      <span class="pill pill-muted">${(f.questions||[]).length} pytań</span>
      ${f.type==='demo'?'<span class="pill pill-blue">DEMO</span>':''}
    </div>
    <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:16px;">${f.desc||''}</div>

    ${sends.length?`<div style="margin-bottom:16px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Wysyłki i odpowiedzi</div>
      ${sends.slice().reverse().map(s=>{
        const c=CL.find(x=>x.id===s.clientId);
        const filled=s.status==='filled';
        const open=window._fdAnswersSendId===s.id;
        return `<div style="padding:7px 0;border-bottom:1px solid var(--border);">
        <div ${filled?`onclick="toggleFormSendAnswers('${s.id}')"`:''} style="display:flex;align-items:center;gap:8px;font-size:12px;${filled?'cursor:pointer;':''}">
          <span>${c?c.name:'Klient'}</span>
          <span class="sent-badge ${filled?'pill-green':'pill-orange'}">${filled?'✓ Wypełniony':'⏳ Oczekuje'}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${s.sentAt||''}${filled?' · odpowiedzi':''}</span>
        </div>
        ${open?formAnswersHtml(s):''}
      </div>`;}).join('')}
    </div>`:''}

    <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">PODGLĄD PYTAŃ</div>
    <div id="fd-questions-preview">
      ${(f.questions||[]).map((q,i)=>`
        <div class="fd-question">
          <div class="fd-q-text">${i+1}. ${q.text}${q.required?'<span style="color:var(--red);margin-left:4px;">*</span>':''}</div>
          ${q.type==='text'?`<input type="text" class="fd-q-input" placeholder="Odpowiedź tekstowa..." disabled>`:''}
          ${q.type==='number'?`<input type="number" class="fd-q-input" placeholder="Wpisz liczbę..." disabled>`:''}
          ${q.type==='scale'?`<div class="fd-scale">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="fd-scale-btn" onclick="selectScale(this,'${q.id}')">${n}</button>`).join('')}</div>`:''}
          ${q.type==='yesno'?`<div class="fd-yn"><button class="fd-yn-btn" onclick="selectYN(this,'${q.id}','tak')">✓ Tak</button><button class="fd-yn-btn" onclick="selectYN(this,'${q.id}','nie')">✗ Nie</button></div>`:''}
          ${q.type==='choice'&&q.options?`<div style="display:flex;flex-direction:column;gap:5px;">${q.options.map(opt=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;"><input type="radio" name="q${q.id}" style="accent-color:var(--accent);"> ${opt}</label>`).join('')}</div>`:''}
        </div>`).join('')}
    </div>`;

  document.getElementById('fd-actions').innerHTML=findCustomForm(id)
    ?`<button class="btn btn-primary" style="flex:1;" onclick="openSendForm('${id}')">📤 Wyślij do klienta</button>
      <button class="btn btn-ghost" onclick="editForm('${id}')">✏</button>
      <button class="btn btn-ghost" style="color:var(--red);" onclick="delForm('${id}')">🗑</button>`
    :`<button class="btn btn-primary" style="flex:1;" onclick="openSendForm('${id}')">📤 Wyślij do klienta</button>
      <button class="btn btn-ghost" onclick="closeFormDetail()">Zamknij</button>`;

  document.getElementById('form-detail').style.transform='translateX(0)';
}

function closeFormDetail(){
  document.getElementById('form-detail').style.transform='translateX(100%)';
  formSelId=null;
  window._fdAnswersSendId=null;
}

function formAnswersHtml(send){
  const qs=formQuestionsForSend(send);
  const ans=formSendAnswersMap(send);
  if(!qs.length)return `<div style="font-size:11px;color:var(--muted);padding:8px 0;">Brak pytań w tym wysłaniu.</div>`;
  return `<div style="background:var(--s3);border-radius:8px;padding:10px 12px;margin-top:8px;">
    ${qs.map((q,i)=>`<div style="padding:6px 0;${i<qs.length-1?'border-bottom:1px solid var(--border);':''}">
      <div style="font-size:11px;color:var(--muted);line-height:1.4;">${i+1}. ${escHtml(q.text||'')}${q.required?' <span style="color:var(--red);">*</span>':''}</div>
      <div style="font-size:13px;font-weight:600;margin-top:3px;">${escHtml(formatFormAnswer(q,ans[q.id]))}</div>
    </div>`).join('')}
  </div>`;
}

function toggleFormSendAnswers(sendId){
  window._fdAnswersSendId=window._fdAnswersSendId===sendId?null:sendId;
  if(formSelId)openFormDetail(formSelId);
}

function selectScale(btn,qid){
  btn.closest('.fd-scale').querySelectorAll('.fd-scale-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
}
function selectYN(btn,qid,val){
  btn.closest('.fd-yn').querySelectorAll('.fd-yn-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
}

function openSendForm(id){
  sendFormId=id;
  const f=allForms().find(x=>x.id===id);if(!f)return;
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  document.getElementById('m-send-form-title').textContent='WYŚLIJ: '+f.name.toUpperCase();
  sendFormSetClientField('','');
  document.getElementById('send-form-msg').value='';
  openM('m-send-form');
}

// Ustawia pole klienta w oknie wysyłania formularza: widoczny tekst + ukryte id.
function sendFormSetClientField(clientId,clientName){
  const hid=document.getElementById('send-form-client');
  const vis=document.getElementById('send-form-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('send-form-client-results');
  if(res)res.style.display='none';
}

function sendFormClientSearchInput(){
  const q=(document.getElementById('send-form-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('send-form-client-results');
  if(!res)return;
  let list=CL;
  if(q)list=list.filter(c=>c.name.toLowerCase().includes(q));
  list=list.map(c=>({c,act:typeof formatClientActivity==='function'?formatClientActivity(c.id):{label:'',color:'var(--muted)',days:0}}))
    .sort((a,b)=>b.act.days-a.act.days)
    .slice(0,8);
  if(!list.length){
    res.innerHTML='<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">Brak wyników</div>';
    res.style.display='block';
    return;
  }
  res.innerHTML=list.map(({c,act})=>`
    <div onclick="sendFormSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function confirmSendForm(){
  if(!sendFormId)return;
  const cid=document.getElementById('send-form-client').value;
  if(!cid){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===cid);
  const f=allForms().find(x=>x.id===sendFormId);
  if(!f){notify('Nie znaleziono formularza');return;}
  const extra=(document.getElementById('send-form-msg')||{}).value||'';
  createFormSend(f,cid,extra);
  closeM('m-send-form');
  renderForms();
  if(formSelId===sendFormId)openFormDetail(sendFormId);
  notify('✓ Formularz "'+f.name+'" wysłany do '+(c?c.name:'klienta')+' — wypełni go w apce');
}

// Form builder
function addFormQ(type){
  const container=document.getElementById('nf-questions');
  const id='nfq'+Date.now();
  const div=document.createElement('div');
  div.className='fq-row';
  div.id=id;
  div.innerHTML=`
    <span class="fq-type-badge">${Q_TYPE_LABELS[type]||type}</span>
    <input type="text" placeholder="Treść pytania..." style="flex:1;background:var(--s4);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;" data-type="${type}">
    ${type==='choice'?`<input type="text" placeholder="Opcja 1, Opcja 2, Opcja 3..." style="width:180px;background:var(--s4);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:11px;" data-opts>`:'' }
    <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);cursor:pointer;flex-shrink:0;"><input type="checkbox" style="accent-color:var(--accent);" data-req> Wymagane</label>
    <button onclick="document.getElementById('${id}').remove()" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;flex-shrink:0;">×</button>`;
  container.appendChild(div);
}

function findCustomForm(id){
  return (window.CUSTOM_FORMS||[]).find(f=>f.id===id);
}

function editForm(id){
  const f=findCustomForm(id);
  if(!f){notify('To formularz z biblioteki demo — nie można go edytować');return;}
  openM('m-form');
  document.getElementById('nf-title').value=f.name||'';
  document.getElementById('nf-cat').value=f.cat||'';
  document.getElementById('nf-desc').value=f.desc||'';
  const container=document.getElementById('nf-questions');
  container.innerHTML='';
  (f.questions||[]).forEach(q=>{
    addFormQ(q.type);
    const lastRow=container.lastElementChild;
    const inp=lastRow.querySelector('input[data-type]');
    if(inp)inp.value=q.text||'';
    const optsInp=lastRow.querySelector('input[data-opts]');
    if(optsInp&&q.options)optsInp.value=q.options.join(', ');
    const reqInp=lastRow.querySelector('input[data-req]');
    if(reqInp)reqInp.checked=!!q.required;
  });
  const titleEl=document.querySelector('#m-form .modal-title');
  if(titleEl)titleEl.textContent='EDYTUJ FORMULARZ';
  const saveBtn=document.querySelector('#m-form .modal-footer .btn-primary');
  if(saveBtn)saveBtn.textContent='Zapisz zmiany';
  window._editingFormId=id;
  closeFormDetail();
}

async function delForm(id){
  const f=findCustomForm(id);
  if(!f){notify('To formularz z biblioteki demo — nie można go usunąć');return;}
  if(!confirm('Usunąć formularz "'+f.name+'"?'))return;
  window.CUSTOM_FORMS=(window.CUSTOM_FORMS||[]).filter(x=>x.id!==id);
  closeFormDetail();
  renderForms();
  notify('Formularz usunięty');
  if(window._db){try{await window._del(window._doc(window._db,'forms',id));}catch(e){console.warn('Firebase delForm:',e);}}
}

async function saveCustomForm(){
  if(window._saveGuard_saveCustomForm)return;window._saveGuard_saveCustomForm=true;setTimeout(()=>window._saveGuard_saveCustomForm=false,1500);

  const title=document.getElementById('nf-title').value.trim();
  if(!title){notify('Wpisz nazwę formularza!');return;}
  const questions=[];
  document.querySelectorAll('#nf-questions .fq-row').forEach((row,i)=>{
    const inp=row.querySelector('input[data-type]');
    const optsInp=row.querySelector('input[data-opts]');
    const reqInp=row.querySelector('input[data-req]');
    if(!inp||!inp.value.trim())return;
    const q={id:'q'+(i+1),type:inp.dataset.type,text:inp.value.trim(),required:reqInp?reqInp.checked:false};
    if(optsInp&&optsInp.value)q.options=optsInp.value.split(',').map(s=>s.trim()).filter(Boolean);
    questions.push(q);
  });
  if(!questions.length){notify('Dodaj przynajmniej jedno pytanie!');return;}
  const editingId=window._editingFormId;
  if(editingId){
    const idx=(window.CUSTOM_FORMS||[]).findIndex(x=>x.id===editingId);
    if(idx>=0){
      window.CUSTOM_FORMS[idx]={...window.CUSTOM_FORMS[idx],cat:document.getElementById('nf-cat').value,name:title,desc:document.getElementById('nf-desc').value,questions,updatedAt:new Date().toISOString()};
      window._editingFormId=null;
      closeM('m-form');
      document.getElementById('nf-questions').innerHTML='';
      document.getElementById('nf-title').value='';
      renderForms();notify('✓ Formularz zaktualizowany!');
      await persistById('forms',window.CUSTOM_FORMS[idx]);
      return;
    }
  }
  const form=withTrainer({id:newId('cf'),type:'moje',status:'active',cat:document.getElementById('nf-cat').value,name:title,desc:document.getElementById('nf-desc').value,questions,createdAt:new Date().toISOString()});
  await persistById('forms',form);
  window.CUSTOM_FORMS.push(form);
  closeM('m-form');
  document.getElementById('nf-questions').innerHTML='';
  document.getElementById('nf-title').value='';
  renderForms();notify('✓ Formularz "'+title+'" utworzony!');
}

function renderCPForms(c){
  const sends=(window.FORM_SENDS||[]).filter(s=>s.clientId===c.id)
    .slice().sort((a,b)=>(b.sentAtIso||b.createdAt||b.sentAt||'').localeCompare(a.sentAtIso||a.createdAt||a.sentAt||''));
  const pending=sends.filter(s=>s.status!=='filled');
  const filled=sends.filter(s=>s.status==='filled');
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div class="cp-section-title" style="margin:0;">FORMULARZE (${sends.length})</div>
      <button class="btn btn-primary btn-sm" onclick="goTo('forms')">📋 Biblioteka</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px;">
      <div class="cp-stat-box" style="flex:1;"><div class="cp-stat-val" style="color:var(--orange);font-size:22px;">${pending.length}</div><div class="cp-stat-lbl">Oczekuje</div></div>
      <div class="cp-stat-box" style="flex:1;"><div class="cp-stat-val" style="color:var(--teal);font-size:22px;">${filled.length}</div><div class="cp-stat-lbl">Wypełnione</div></div>
    </div>
    ${!sends.length?'<div style="text-align:center;padding:30px;color:var(--muted);">Brak wysłanych formularzy. Otwórz Formularze i kliknij Wyślij.</div>'
    :sends.map(s=>{
      const f=(typeof allForms==='function'?allForms():[]).find(x=>x.id===s.formId);
      const name=s.formName||(f&&f.name)||'Formularz';
      const open=window._fdAnswersSendId===s.id;
      const isFilled=s.status==='filled';
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <div style="flex:1;${isFilled?'cursor:pointer;':''}" ${isFilled?`onclick="window._fdAnswersSendId=window._fdAnswersSendId==='${s.id}'?null:'${s.id}';renderCPForms(CL.find(x=>x.id==='${c.id}'))"`:''}>
            <div style="font-size:13px;font-weight:600;">${escHtml(name)}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px;">${escHtml(s.sentAt||'')} ${isFilled?'· kliknij, żeby zobaczyć odpowiedzi':''}</div>
          </div>
          <span class="pill ${isFilled?'pill-green':'pill-orange'}" style="font-size:9px;">${isFilled?'✓ Wypełniony':'⏳ Oczekuje'}</span>
        </div>
        ${open?formAnswersHtml(s):''}
      </div>`;
    }).join('')}
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;" onclick="goTo('forms')">📤 Wyślij kolejny</button>`;
}

// ════════════════════════════════════════
// METRICS — POMIARY CIAŁA
// ════════════════════════════════════════
var metricActiveGroup=null;var metricView='table';var metricSelIcon='⚖️';
window.METRIC_GROUPS=[];window.METRIC_ENTRIES=[];

const DEMO_METRIC_GROUPS=[
  {id:'mg1',name:'Masa i BMI',icon:'⚖️',color:'var(--accent)',metrics:[
    {id:'m1',name:'Masa ciała',unit:'kg',type:'number'},
    {id:'m2',name:'% tkanki tłuszczowej',unit:'%',type:'number'},
    {id:'m3',name:'Masa mięśniowa',unit:'kg',type:'number'},
    {id:'m4',name:'BMI',unit:'',type:'number'},
  ]},
  {id:'mg2',name:'Obwody ciała',icon:'📏',color:'var(--blue)',metrics:[
    {id:'m1',name:'Klatka piersiowa',unit:'cm',type:'number'},
    {id:'m2',name:'Talia',unit:'cm',type:'number'},
    {id:'m3',name:'Biodra',unit:'cm',type:'number'},
    {id:'m4',name:'Udo (lewe)',unit:'cm',type:'number'},
    {id:'m5',name:'Ramię (lewe)',unit:'cm',type:'number'},
  ]},
  {id:'mg3',name:'Siła bazowa',icon:'💪',color:'var(--orange)',metrics:[
    {id:'m1',name:'Przysiad 1RM',unit:'kg',type:'number'},
    {id:'m2',name:'Martwy ciąg 1RM',unit:'kg',type:'number'},
    {id:'m3',name:'Wyciskanie leżąc 1RM',unit:'kg',type:'number'},
    {id:'m4',name:'OHP 1RM',unit:'kg',type:'number'},
  ]},
  {id:'mg4',name:'Kondycja',icon:'🏃',color:'var(--teal)',metrics:[
    {id:'m1',name:'Tętno spoczynkowe',unit:'bpm',type:'number'},
    {id:'m2',name:'Bieg 1km',unit:'min',type:'number'},
    {id:'m3',name:'Pompki maks.',unit:'szt',type:'number'},
    {id:'m4',name:'Podciągania maks.',unit:'szt',type:'number'},
  ]},
  {id:'mg5',name:'Samopoczucie',icon:'❤️',color:'var(--red)',metrics:[
    {id:'m1',name:'Energia (1-10)',unit:'',type:'scale'},
    {id:'m2',name:'Jakość snu (1-10)',unit:'',type:'scale'},
    {id:'m3',name:'Motywacja (1-10)',unit:'',type:'scale'},
    {id:'m4',name:'Poziom stresu (1-10)',unit:'',type:'scale'},
  ]},
  {id:'mg6',name:'Garmin Connect',icon:'⌚',color:'#007cc3',metrics:[
    {id:'m1',name:'Kroki',unit:'szt',type:'number'},
    {id:'m2',name:'Kalorie',unit:'kcal',type:'number'},
    {id:'m3',name:'Śr. tętno',unit:'bpm',type:'number'},
    {id:'m4',name:'Czas aktywności',unit:'min',type:'number'},
    {id:'m5',name:'Dystans',unit:'km',type:'number'},
  ]},
];
window.DEMO_METRIC_GROUPS=DEMO_METRIC_GROUPS;

// demo entries for first client
function initDemoEntries(clientId){
  if(!clientId||METRIC_ENTRIES.some(e=>e.clientId===clientId))return;
  const now=new Date();
  const makeDate=(daysAgo)=>{const d=new Date(now);d.setDate(d.getDate()-daysAgo);return d.toISOString().split('T')[0];};
  const entries=[
    {id:'de1',clientId,groupId:'mg1',date:makeDate(60),values:{m1:88,m2:22,m3:58,m4:27.2},notes:'Pomiar startowy'},
    {id:'de2',clientId,groupId:'mg1',date:makeDate(30),values:{m1:85.5,m2:20.5,m3:59.5,m4:26.4},notes:'Po pierwszym miesięcu'},
    {id:'de3',clientId,groupId:'mg1',date:makeDate(0),values:{m1:83,m2:18.8,m3:61,m4:25.6},notes:'Aktualne'},
    {id:'de4',clientId,groupId:'mg2',date:makeDate(60),values:{m1:102,m2:90,m3:100,m4:62,m5:38},notes:'Startowe'},
    {id:'de5',clientId,groupId:'mg2',date:makeDate(30),values:{m1:100,m2:87,m3:99,m4:61,m5:39},notes:''},
    {id:'de6',clientId,groupId:'mg2',date:makeDate(0),values:{m1:98,m2:84,m3:97,m4:60,m5:40},notes:'Aktualne'},
    {id:'de7',clientId,groupId:'mg3',date:makeDate(60),values:{m1:100,m2:120,m3:80,m4:60},notes:'Testy startowe'},
    {id:'de8',clientId,groupId:'mg3',date:makeDate(0),values:{m1:120,m2:145,m3:95,m4:72},notes:'Po 8 tygodniach'},
    {id:'de9',clientId,groupId:'mg5',date:makeDate(14),values:{m1:6,m2:5,m3:7,m4:6},notes:''},
    {id:'de10',clientId,groupId:'mg5',date:makeDate(0),values:{m1:8,m2:7,m3:8,m4:4},notes:'Aktualne'},
  ];
  entries.forEach(e=>METRIC_ENTRIES.push(e));
}

// Ustawia pole klienta w oknie dodawania pomiaru: widoczny tekst + ukryte id.
function meClientSetField(clientId,clientName){
  const hid=document.getElementById('me-client');
  const vis=document.getElementById('me-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('me-client-results');
  if(res)res.style.display='none';
  updateMetricEntryForm();
}

function meClientSearchInput(){
  const q=(document.getElementById('me-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('me-client-results');
  if(!res)return;
  let list=CL;
  if(q)list=list.filter(c=>c.name.toLowerCase().includes(q));
  list=list.map(c=>({c,act:typeof formatClientActivity==='function'?formatClientActivity(c.id):{label:'',color:'var(--muted)',days:0}}))
    .sort((a,b)=>b.act.days-a.act.days)
    .slice(0,8);
  if(!list.length){
    res.innerHTML='<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">Brak wyników</div>';
    res.style.display='block';
    return;
  }
  res.innerHTML=list.map(({c,act})=>`
    <div onclick="meClientSetField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

// Ustawia pole klienta w bocznym panelu ekranu Pomiary: widoczny tekst + ukryte id.
function metricClientSetField(clientId,clientName){
  const hid=document.getElementById('metric-client-sel');
  const vis=document.getElementById('metric-client-sel-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('metric-client-sel-results');
  if(res)res.style.display='none';
  renderMetrics();
}

function metricClientSearchInput(){
  const q=(document.getElementById('metric-client-sel-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('metric-client-sel-results');
  if(!res)return;
  let list=CL;
  if(q)list=list.filter(c=>c.name.toLowerCase().includes(q));
  list=list.map(c=>({c,act:typeof formatClientActivity==='function'?formatClientActivity(c.id):{label:'',color:'var(--muted)',days:0}}))
    .sort((a,b)=>b.act.days-a.act.days)
    .slice(0,8);
  if(!list.length){
    res.innerHTML='<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">Brak wyników</div>';
    res.style.display='block';
    return;
  }
  res.innerHTML=list.map(({c,act})=>`
    <div onclick="metricClientSetField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function allMetricGroups(){return[...DEMO_METRIC_GROUPS,...(window.METRIC_GROUPS||[])];}

function renderMetrics(){
  const cid=(document.getElementById('metric-client-sel')||{}).value||'';
  // populate client sel
  const csel=document.getElementById('metric-client-sel');
  if(csel){const cur=csel.value;csel.innerHTML='<option value="">Wybierz klienta...</option>'+CL.map(c=>'<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+c.name+'</option>').join('');}
  if(cid)initDemoEntries(cid);

  // groups nav
  const groups=allMetricGroups();
  const nav=document.getElementById('metric-groups-nav');
  if(nav){
    nav.innerHTML=groups.map(g=>`<div class="metric-group-nav${metricActiveGroup===g.id?' active':''}" onclick="setMetricGroup('${g.id}')">
      <span style="font-size:16px;">${g.icon}</span>
      <span>${g.name}</span>
      <span style="margin-left:auto;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);">${METRIC_ENTRIES.filter(e=>e.clientId===cid&&e.groupId===g.id).length}</span>
    </div>`).join('');
  }

  // summary
  const sumEl=document.getElementById('metric-summary');
  if(sumEl&&cid){
    const lastMass=METRIC_ENTRIES.filter(e=>e.clientId===cid&&e.groupId==='mg1').sort((a,b)=>b.date.localeCompare(a.date))[0];
    const firstMass=METRIC_ENTRIES.filter(e=>e.clientId===cid&&e.groupId==='mg1').sort((a,b)=>a.date.localeCompare(b.date))[0];
    const lastGarmin=METRIC_ENTRIES.filter(e=>e.clientId===cid&&e.groupId==='mg6').sort((a,b)=>b.date.localeCompare(a.date))[0];
    const diff=lastMass&&firstMass&&lastMass!==firstMass?((lastMass.values.m1||0)-(firstMass.values.m1||0)).toFixed(1):null;
    sumEl.innerHTML=(lastMass||lastGarmin)?`
      ${lastMass?`<div class="metric-summary-row"><span style="color:var(--muted);">Masa ciała</span><span style="font-weight:700;">${lastMass.values.m1||'—'} kg</span></div>`:''}
      ${diff!==null?`<div class="metric-summary-row"><span style="color:var(--muted);">Zmiana</span><span style="font-weight:700;color:${diff<0?'var(--teal)':diff>0?'var(--red)':'var(--muted)'};">${diff>0?'+':''}${diff} kg</span></div>`:''}
      ${lastGarmin?`<div class="metric-summary-row"><span style="color:var(--muted);">Garmin</span><span style="font-weight:700;">${lastGarmin.values.m1?lastGarmin.values.m1+' kroków':lastGarmin.values.m2?lastGarmin.values.m2+' kcal':'⌚'}</span></div>`:''}
      <div class="metric-summary-row"><span style="color:var(--muted);">Pomiarów</span><span>${METRIC_ENTRIES.filter(e=>e.clientId===cid).length}</span></div>
    `:'<div style="font-size:11px;color:var(--muted);">Brak danych</div>';
  }

  if(metricActiveGroup)renderMetricData(cid,metricActiveGroup);
  else{
    document.getElementById('metric-table-body').innerHTML='<div style="padding:60px;text-align:center;color:var(--muted);"><div style="font-size:32px;margin-bottom:10px;opacity:0.3;">📊</div><div style="font-size:14px;font-weight:600;margin-bottom:6px;">Wybierz grupę pomiarów</div><div style="font-size:12px;">z lewego panelu</div></div>';
    document.getElementById('metric-chart-container').innerHTML='';
    document.getElementById('metric-quick-form').innerHTML='<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">Wybierz klienta i grupę</div>';
  }
}

function setMetricGroup(gid){
  metricActiveGroup=gid;
  const cid=(document.getElementById('metric-client-sel')||{}).value||'';
  renderMetrics();
  renderMetricData(cid,gid);
}

function setMetricView(v){
  metricView=v;
  document.getElementById('metric-chart-view').style.display=v==='chart'?'block':'none';
  document.getElementById('metric-table-view').style.display=v==='table'?'flex':'none';
  document.getElementById('metric-table-view').style.flexDirection='column';
  document.getElementById('metric-view-chart-btn').className='btn btn-sm '+(v==='chart'?'btn-primary':'btn-ghost');
  document.getElementById('metric-view-table-btn').className='btn btn-sm '+(v==='table'?'btn-primary':'btn-ghost');
}

function renderMetricData(cid,gid){
  const group=allMetricGroups().find(g=>g.id===gid);
  if(!group)return;
  document.getElementById('metric-active-group-title').textContent=group.icon+' '+group.name;

  const entries=METRIC_ENTRIES.filter(e=>e.clientId===cid&&e.groupId===gid).sort((a,b)=>b.date.localeCompare(a.date));

  // quick form
  const qf=document.getElementById('metric-quick-form');
  if(qf&&cid){
    qf.innerHTML=`
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">${group.icon} ${group.name}</div>
      <div style="margin-bottom:8px;"><input type="date" id="quick-date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;"></div>
      ${group.metrics.map(m=>`<div style="margin-bottom:6px;">
        <label style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;display:block;margin-bottom:3px;">${m.name}${m.unit?' ('+m.unit+')':''}</label>
        ${m.type==='scale'
          ?'<div style="display:flex;gap:3px;">'+(Array.from({length:10},(_,i)=>`<button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.background='var(--s3)');this.style.background='var(--accent)';this.style.color='#000';" style="flex:1;padding:4px 2px;background:var(--s3);border:1px solid var(--border);border-radius:4px;color:var(--muted);font-size:10px;cursor:pointer;" data-qm="${m.id}">${i+1}</button>`).join(''))+'</div>'
          :`<input type="number" step="0.1" id="qm-${m.id}" placeholder="${m.unit||'wartość'}" style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;">`
        }
      </div>`).join('')}
      <button onclick="saveQuickEntry('${cid}','${gid}')" class="btn btn-primary" style="width:100%;margin-top:6px;">Zapisz pomiar</button>`;
  }

  // table
  const tbody=document.getElementById('metric-table-body');
  if(!entries.length){
    tbody.innerHTML='<div style="padding:60px;text-align:center;color:var(--muted);"><div style="font-size:32px;margin-bottom:10px;opacity:0.3;">${group.icon}</div><div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak pomiarów</div><div style="font-size:12px;margin-bottom:20px;">Dodaj pierwszy pomiar klikając "+ Dodaj pomiar"</div><button class="btn btn-primary btn-sm" onclick="openM(\'m-metric-entry\')">+ Dodaj pomiar</button></div>';
  } else {
    tbody.innerHTML=entries.map((e,i)=>{
      const prev=entries[i+1];
      const firstMetric=group.metrics[0];
      const currVal=firstMetric?e.values[firstMetric.id]:null;
      const prevVal=firstMetric&&prev?prev.values[firstMetric.id]:null;
      const change=currVal!=null&&prevVal!=null?(currVal-prevVal).toFixed(1):null;
      const trendUp=change&&parseFloat(change)>0;
      const trendDown=change&&parseFloat(change)<0;
      // for weight, down=good; for strength, up=good
      const goodDown=['mg1','mg2'].includes(gid);
      const trendClass=change==null?'trend-neutral':trendUp?(goodDown?'trend-down':'trend-up'):trendDown?(goodDown?'trend-up':'trend-down'):'trend-neutral';
      return `<div class="metric-table-row" style="animation-delay:${i*0.03}s">
        <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);">${e.date}</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;">
          ${group.metrics.map(m=>`<span class="metric-val-chip">${m.name}: <strong>${e.values[m.id]!=null?e.values[m.id]+'':'—'}${m.unit?'<span style="color:var(--muted);font-size:9px;"> '+m.unit+'</span>':''}</strong></span>`).join('')}
          ${e.notes?`<span class="metric-val-chip" style="color:var(--muted);">${e.source==='garmin'?'⌚ ':''}${e.notes}</span>`:''}
        </div>
        <div style="font-size:12px;" class="${trendClass}">${change!=null?(parseFloat(change)>0?'+':'')+change+(firstMetric&&firstMetric.unit?' '+firstMetric.unit:''):'—'}</div>
        <div style="font-size:18px;" class="${trendClass}">${e.source==='garmin'?'⌚':change==null?'—':parseFloat(change)>0?'↑':parseFloat(change)<0?'↓':'→'}</div>
        <div><button onclick="delMetricEntry('${e.id}')" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;">×</button></div>
      </div>`;
    }).join('');
  }

  // chart (SVG)
  if(metricView==='chart')renderMetricChart(entries,group);
}

function renderMetricChart(entries,group){
  const container=document.getElementById('metric-chart-container');
  if(!entries.length||!group.metrics.length){container.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);">Brak danych do wykresu</div>';return;}
  const sorted=entries.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const m=group.metrics[0];
  const vals=sorted.map(e=>parseFloat(e.values[m.id])||0).filter(v=>v>0);
  if(!vals.length){container.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted);">Brak wartości do wykresu</div>';return;}
  const minV=Math.min(...vals)*0.97;const maxV=Math.max(...vals)*1.03;
  const W=600;const H=200;const pad={t:20,r:20,b:40,l:50};
  const iW=W-pad.l-pad.r;const iH=H-pad.t-pad.b;
  const xStep=iW/(sorted.length-1||1);
  const yScale=(v)=>pad.t+iH-(((v-minV)/(maxV-minV||1))*iH);
  const pts=sorted.map((e,i)=>({x:pad.l+i*xStep,y:yScale(parseFloat(e.values[m.id])||0),v:e.values[m.id],d:e.date}));
  const col=group.color||'var(--accent)';
  // path
  const path='M'+pts.map(p=>`${p.x},${p.y}`).join('L');
  // area
  const area=path+'L'+pts[pts.length-1].x+','+(pad.t+iH)+'L'+pad.l+','+(pad.t+iH)+'Z';
  // y axis labels
  const yLabels=[minV,minV+(maxV-minV)*0.5,maxV].map(v=>`<text x="${pad.l-6}" y="${yScale(v)+4}" font-size="10" fill="var(--muted)" text-anchor="end">${v.toFixed(1)}</text>`).join('');
  // x labels
  const xLabels=pts.map((p,i)=>{if(i%Math.max(1,Math.floor(pts.length/4))!==0&&i!==pts.length-1)return'';return`<text x="${p.x}" y="${H-pad.b+14}" font-size="9" fill="var(--muted)" text-anchor="middle">${p.d.slice(5)}</text>`;}).join('');
  // dots+tooltips
  const dots=pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" fill="${col}" stroke="var(--bg)" stroke-width="2"><title>${p.d}: ${p.v} ${m.unit||''}</title></circle>`).join('');
  container.innerHTML=`
    <div style="font-size:13px;font-weight:700;margin-bottom:12px;">${group.icon} ${m.name} ${m.unit?'('+m.unit+')':''} — trend</div>
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;overflow:visible;">
      <defs><linearGradient id="aGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.25"/><stop offset="100%" stop-color="${col}" stop-opacity="0.02"/></linearGradient></defs>
      <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+iH}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${pad.l}" y1="${pad.t+iH}" x2="${pad.l+iW}" y2="${pad.t+iH}" stroke="var(--border)" stroke-width="1"/>
      ${yLabels}${xLabels}
      <path d="${area}" fill="url(#aGrad)"/>
      <path d="${path}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
    <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
      ${group.metrics.filter((_,i)=>i>0).map(mm=>{
        const mv=sorted.map(e=>parseFloat(e.values[mm.id])||0).filter(v=>v>0);
        const last=mv[mv.length-1];const first=mv[0];
        const d=last&&first?(last-first).toFixed(1):null;
        return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:4px;">${mm.name}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--text);">${last||'—'}${mm.unit?'<span style="font-size:12px;color:var(--muted);"> '+mm.unit+'</span>':''}</div>
          ${d!=null?`<div style="font-size:11px;color:${parseFloat(d)<0?'var(--teal)':parseFloat(d)>0?'var(--orange)':'var(--muted)'};">${parseFloat(d)>0?'+':''}${d} ${mm.unit||''}</div>`:''}
        </div>`;
      }).join('')}
    </div>`;
}

function saveQuickEntry(cid,gid){
  const group=allMetricGroups().find(g=>g.id===gid);if(!group)return;
  const date=document.getElementById('quick-date').value||new Date().toISOString().split('T')[0];
  const values={};
  group.metrics.forEach(m=>{
    const el=document.getElementById('qm-'+m.id);
    if(el&&el.value)values[m.id]=parseFloat(el.value);
  });
  if(!Object.keys(values).length){notify('Wpisz przynajmniej jedną wartość!');return;}
  const entry=withTrainer({id:newId('qe'),clientId:cid,groupId:gid,date,values,notes:'',createdAt:new Date().toISOString()});
  METRIC_ENTRIES.push(entry);
  renderMetrics();renderMetricData(cid,gid);
  notify('✓ Pomiar zapisany!');
  persistById('metricEntries',entry);
}

function delMetricEntry(id){
  window.METRIC_ENTRIES=METRIC_ENTRIES.filter(e=>e.id!==id);
  const cid=(document.getElementById('metric-client-sel')||{}).value||'';
  renderMetricData(cid,metricActiveGroup);
  if(window._db && id){
    (async()=>{try{await window._del(window._doc(window._db,'metricEntries',id));}catch(e){/* wpis demo/niezsynchronizowany - nic do usunięcia w chmurze */}})();
  }
}

// Metric group creator
function addMetricField(){
  const list=document.getElementById('mg-metrics-list');
  const div=document.createElement('div');div.className='metric-field-row';
  div.innerHTML=`<input type="text" placeholder="Nazwa (np. Masa ciała)" style="flex:1;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;">
    <input type="text" placeholder="kg" style="width:50px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;" title="Jednostka">
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;">×</button>`;
  list.appendChild(div);
}

function selectMetricIcon(btn){
  document.querySelectorAll('.metric-icon-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  metricSelIcon=btn.dataset.icon;
}

function saveMetricGroup(){
  const name=document.getElementById('mg-name').value.trim();
  if(!name){notify('Wpisz nazwę grupy!');return;}
  const metrics=[];
  document.querySelectorAll('#mg-metrics-list .metric-field-row').forEach((row,i)=>{
    const inps=row.querySelectorAll('input');
    if(inps[0]&&inps[0].value.trim())metrics.push({id:'m'+(i+1),name:inps[0].value.trim(),unit:inps[1]?inps[1].value.trim():'',type:'number'});
  });
  const grp=withTrainer({id:newId('ug'),name,icon:metricSelIcon,color:'var(--purple)',metrics});
  window.METRIC_GROUPS.push(grp);
  closeM('m-metric-group');
  document.getElementById('mg-name').value='';
  document.getElementById('mg-metrics-list').innerHTML='';
  renderMetrics();notify('✓ Grupa "'+name+'" utworzona!');
  persistById('metricGroups',grp);
}

function updateMetricEntryForm(){
  const cid=document.getElementById('me-client').value;
  const gid=document.getElementById('me-group').value;
  // populate group select
  const gsel=document.getElementById('me-group');
  const curG=gsel.value;
  gsel.innerHTML=allMetricGroups().map(g=>'<option value="'+g.id+'"'+(g.id===curG?' selected':'')+'>'+g.icon+' '+g.name+'</option>').join('');
  const group=allMetricGroups().find(g=>g.id===gsel.value);
  const fields=document.getElementById('me-fields');
  if(!fields||!group)return;
  fields.innerHTML=group.metrics.map(m=>`<div class="form-field"><label class="form-lbl">${m.name}${m.unit?' ('+m.unit+')':''}</label><input type="number" step="0.1" class="form-input" id="mef-${m.id}" placeholder="${m.unit||'wartość'}"></div>`).join('');
}

async function saveMetricEntry(){
  if(window._saveGuard_saveMetricEntry)return;window._saveGuard_saveMetricEntry=true;setTimeout(()=>window._saveGuard_saveMetricEntry=false,1500);

  const cid=document.getElementById('me-client').value;
  const gid=document.getElementById('me-group').value;
  const date=document.getElementById('me-date').value;
  if(!cid||!gid||!date){notify('Uzupełnij wszystkie pola!');return;}
  const group=allMetricGroups().find(g=>g.id===gid);if(!group)return;
  const values={};
  group.metrics.forEach(m=>{const el=document.getElementById('mef-'+m.id);if(el&&el.value)values[m.id]=parseFloat(el.value);});
  if(!Object.keys(values).length){notify('Wpisz przynajmniej jedną wartość!');return;}
  const entry=withTrainer({id:newId('me'),clientId:cid,groupId:gid,date,values,notes:document.getElementById('me-notes').value,createdAt:new Date().toISOString()});
  METRIC_ENTRIES.push(entry);
  closeM('m-metric-entry');
  if((document.getElementById('metric-client-sel')||{}).value===cid){renderMetrics();if(metricActiveGroup===gid)renderMetricData(cid,gid);}
  notify('✓ Pomiar dodany!');
  await persistById('metricEntries',entry);
}

async function askMetricAI(){
  const q=document.getElementById('metric-ai-q').value.trim();if(!q)return;
  document.getElementById('metric-ai-q').value='';
  const msgs=document.getElementById('metric-ai-msgs');
  msgs.innerHTML+='<div style="text-align:right;margin-bottom:6px;"><div style="display:inline-block;background:var(--accent);color:#fff;padding:5px 9px;border-radius:8px;font-size:11px;">'+q+'</div></div>';
  msgs.innerHTML+='<div id="mai-t" style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);border:1px solid var(--border2);padding:5px 9px;border-radius:8px;font-size:11px;opacity:0.5;">Analizuję dane...</div></div>';
  msgs.scrollTop=msgs.scrollHeight;
  const cid=(document.getElementById('metric-client-sel')||{}).value||'';
  const c=CL.find(x=>x.id===cid);
  const entries=METRIC_ENTRIES.filter(e=>e.clientId===cid);
  const group=metricActiveGroup?allMetricGroups().find(g=>g.id===metricActiveGroup):null;
  const ctx=`Trener personalny analizuje postępy klienta. ${c?'Klient: '+c.name+', cel: '+(c.goal||'?')+', poziom: '+(c.level||'?')+'. ':''}${group?'Grupa pomiarów: '+group.name+'. ':''}${entries.length?'Liczba pomiarów: '+entries.length+'. ':''} `;
  const sys='Asystent trenera personalnego. Analizuj postępy klienta na podstawie danych. Odpowiadaj KRÓTKO po polsku, max 80 słów. Dawaj konkretne wskazówki i oceny. Używaj danych liczbowych gdy są dostępne.';
  try{
    const r=await fetch(W,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:200,system:sys,messages:[{role:'user',content:ctx+q}]})});
    const d=await r.json();const ans=d.content.map(i=>i.text||'').join('');
    document.getElementById('mai-t').outerHTML=`<div style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);border:1px solid var(--border2);padding:6px 9px;border-radius:8px;font-size:11px;line-height:1.5;">${ans.replace(/\n/g,'<br>')}</div></div>`;
  }catch(e){document.getElementById('mai-t').outerHTML=`<div style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);padding:5px 9px;border-radius:8px;font-size:11px;color:var(--red);">Błąd połączenia</div></div>`;}
  msgs.scrollTop=msgs.scrollHeight;
}

// ════════════════════════════════════════
// CALCULATOR — TDEE / MAKRO
// ════════════════════════════════════════
var calcActivity=1.375;var calcGoalDelta=0;
var calcMacroP=35;var calcMacroF=25;var calcMacroC=40;

function initCalcClients(){
  calcSetClientField('','');
  calcShowWelcome();
}

// Ekran powitalny kalkulatora — ten sam styl co w Generatorze AI: duża ikona,
// tytuł, opis i siatka kart pokazujących, co warto uzupełnić przed obliczeniem.
function calcShowWelcome(){
  const el=document.getElementById('calc-results');
  if(!el)return;
  el.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;text-align:center;padding:40px;">
      <div style="font-size:56px;margin-bottom:20px;">🧮</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:2px;margin-bottom:10px;">KALKULATOR TDEE I MAKRO</div>
      <div style="font-size:13px;color:var(--muted);max-width:440px;line-height:1.8;margin-bottom:28px;">Wypełnij dane po lewej stronie i kliknij <strong style="color:var(--accent);">Oblicz</strong>. Kalkulator wyznaczy zapotrzebowanie kaloryczne, podział makroskładników i przykładowy rozkład na posiłki.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:500px;">
        ${[
          {icon:'👤',txt:'Płeć, wiek, waga, wzrost'},
          {icon:'🏃',txt:'Poziom aktywności'},
          {icon:'🎯',txt:'Cel klienta'},
          {icon:'⚖️',txt:'Podział makroskładników'},
          {icon:'🍽️',txt:'Liczba posiłków'},
          {icon:'📤',txt:'Opcjonalnie: wyślij klientowi'},
        ].map(i=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:11px;color:var(--muted);"><div style="font-size:20px;margin-bottom:5px;">${i.icon}</div>${i.txt}</div>`).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:28px;padding:12px 32px;" onclick="calcTDEE()">🧮 Oblicz teraz</button>
    </div>`;
}

// Ustawia pole klienta w kalkulatorze: widoczny tekst + ukryte id, i wczytuje jego dane.
function calcSetClientField(clientId,clientName){
  const hid=document.getElementById('calc-client');
  const vis=document.getElementById('calc-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('calc-client-results');
  if(res)res.style.display='none';
  calcLoadFromClient();
}

function calcClientSearchInput(){
  const q=(document.getElementById('calc-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('calc-client-results');
  if(!res)return;
  let list=CL;
  if(q)list=list.filter(c=>c.name.toLowerCase().includes(q));
  list=list.map(c=>({c,act:typeof formatClientActivity==='function'?formatClientActivity(c.id):{label:'',color:'var(--muted)',days:0}}))
    .sort((a,b)=>b.act.days-a.act.days)
    .slice(0,8);
  if(!list.length){
    res.innerHTML='<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">Brak wyników</div>';
    res.style.display='block';
    return;
  }
  res.innerHTML=list.map(({c,act})=>`
    <div onclick="calcSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function calcLoadFromClient(){
  const cid=document.getElementById('calc-client').value;
  if(!cid){calcTDEE();return;}
  const c=CL.find(x=>x.id===cid);
  if(!c){calcTDEE();return;}
  if(c.age)document.getElementById('calc-age').value=c.age;
  if(c.weight)document.getElementById('calc-weight').value=c.weight;
  if(c.height)document.getElementById('calc-height').value=c.height;
  if(c.gender)document.getElementById('calc-gender').value=c.gender;
  // set goal preset based on client goal
  const goalMap={redukcja:-300,masa:300,sila:0,kondycja:0};
  const delta=goalMap[c.goal]||0;
  document.querySelectorAll('.calc-goal-btn').forEach(b=>{
    b.classList.remove('active');
    if(parseInt(b.dataset.val)===delta)b.classList.add('active');
  });
  calcGoalDelta=delta;
  // set macro preset
  const macroMap={masa:{p:35,f:25,c:40},redukcja:{p:40,f:30,c:30},sila:{p:35,f:25,c:40},kondycja:{p:30,f:30,c:40}};
  const m=macroMap[c.goal]||{p:30,f:30,c:40};
  setCalcMacroVals(m.p,m.f,m.c);
  calcTDEE();
  notify('✓ Dane klienta wczytane: '+c.name);
}

function setCalcActivity(btn,val){
  calcActivity=val;
  document.querySelectorAll('.calc-act-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  calcTDEE();
}

function setCalcGoal(btn,delta){
  calcGoalDelta=delta;
  document.querySelectorAll('.calc-goal-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  calcTDEE();
}

function setCalcMacro(btn,p,f,c){
  document.querySelectorAll('.calc-macro-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  setCalcMacroVals(p,f,c);
  calcTDEE();
}

function setCalcMacroVals(p,f,c){
  calcMacroP=p;calcMacroF=f;calcMacroC=c;
  document.getElementById('sl-p').value=p;
  document.getElementById('sl-f').value=f;
  document.getElementById('sl-c').value=c;
  document.getElementById('sl-p-val').textContent=p;
  document.getElementById('sl-f-val').textContent=f;
  document.getElementById('sl-c-val').textContent=c;
  document.getElementById('sl-sum-lbl').textContent='Suma: '+(p+f+c)+'%';
}

function syncSliders(changed){
  let p=parseInt(document.getElementById('sl-p').value);
  let f=parseInt(document.getElementById('sl-f').value);
  let c=parseInt(document.getElementById('sl-c').value);
  const sum=p+f+c;
  // normalize to 100
  if(sum!==100){
    const diff=100-sum;
    if(changed==='p'){if(f+diff>=10&&f+diff<=60){f+=diff;}else{c+=diff;}}
    else if(changed==='f'){if(c+diff>=5&&c+diff<=65){c+=diff;}else{p+=diff;}}
    else{if(p+diff>=15&&p+diff<=55){p+=diff;}else{f+=diff;}}
    p=Math.max(15,Math.min(55,p));f=Math.max(10,Math.min(60,f));c=Math.max(5,Math.min(65,c));
    const s2=p+f+c;if(s2!==100)c+=100-s2;
    document.getElementById('sl-p').value=p;
    document.getElementById('sl-f').value=f;
    document.getElementById('sl-c').value=c;
  }
  calcMacroP=p;calcMacroF=f;calcMacroC=c;
  document.getElementById('sl-p-val').textContent=p;
  document.getElementById('sl-f-val').textContent=f;
  document.getElementById('sl-c-val').textContent=c;
  document.getElementById('sl-sum-lbl').textContent='Suma: '+(p+f+c)+'%';
  document.querySelectorAll('.calc-macro-btn').forEach(b=>b.classList.remove('active'));
  calcTDEE();
}

function calcTDEE(){
  const gender=document.getElementById('calc-gender').value;
  const age=parseInt(document.getElementById('calc-age').value)||25;
  const weight=parseFloat(document.getElementById('calc-weight').value)||80;
  const height=parseInt(document.getElementById('calc-height').value)||180;

  // Mifflin-St Jeor BMR
  let bmr;
  if(gender==='M') bmr=10*weight+6.25*height-5*age+5;
  else bmr=10*weight+6.25*height-5*age-161;

  const tdee=Math.round(bmr*calcActivity);
  const target=tdee+calcGoalDelta;
  const proteinG=Math.round(target*(calcMacroP/100)/4);
  const fatG=Math.round(target*(calcMacroF/100)/9);
  const carbG=Math.round(target*(calcMacroC/100)/4);

  // per kg recommendations
  const protPerKg=(proteinG/weight).toFixed(1);
  const isProtOk=parseFloat(protPerKg)>=1.6&&parseFloat(protPerKg)<=2.5;

  // LBM (szacunkowa beztłuszczowa masa)
  const lbm=Math.round(weight*0.82);

  // meals plan
  const meals=[
    {name:'Śniadanie',pct:0.25},{name:'II śniadanie',pct:0.15},
    {name:'Obiad',pct:0.30},{name:'Podwieczorek',pct:0.10},{name:'Kolacja',pct:0.20}
  ];

  const goalLabels={'-500':'Agresywna redukcja','-300':'Łagodna redukcja','0':'Utrzymanie wagi','300':'Łagodna masa','500':'Agresywna masa'};
  const goalColors={'-500':'var(--red)','-300':'var(--orange)','0':'var(--teal)','300':'var(--blue)','500':'var(--accent)'};
  const gc=goalColors[String(calcGoalDelta)]||'var(--accent)';
  const gl=goalLabels[String(calcGoalDelta)]||'Cel';

  const el=document.getElementById('calc-results');
  if(!el)return;

  el.innerHTML=`
    <div class="calc-col-main">
    <!-- główny wynik TDEE -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="calc-result-card" style="text-align:center;border-top:3px solid var(--muted);">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">BMR (Metabolizm bazowy)</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:42px;color:var(--muted);line-height:1;">${Math.round(bmr)}</div>
        <div style="font-size:11px;color:var(--muted);">kcal / dzień</div>
        <div style="font-size:10px;color:var(--muted2);margin-top:6px;">Mifflin-St Jeor</div>
      </div>
      <div class="calc-result-card" style="text-align:center;border-top:3px solid var(--orange);">
        <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--orange);text-transform:uppercase;margin-bottom:6px;">TDEE (Całkowite zapotrzebowanie)</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:42px;color:var(--orange);line-height:1;">${tdee}</div>
        <div style="font-size:11px;color:var(--muted);">kcal / dzień</div>
        <div style="font-size:10px;color:var(--muted2);margin-top:6px;">TDEE = BMR × ${calcActivity}</div>
      </div>
    </div>

    <!-- cel kaloryczny -->
    <div class="calc-result-card" style="border-top:3px solid ${gc};margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div>
          <div style="font-size:10px;font-family:'DM Mono',monospace;color:${gc};text-transform:uppercase;margin-bottom:4px;">${gl}</div>
          <div class="calc-big-val" style="color:${gc};">${target} <span style="font-size:20px;">kcal</span></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:var(--muted);">Zmiana vs TDEE</div>
          <div style="font-size:20px;font-weight:700;color:${calcGoalDelta<0?'var(--teal)':calcGoalDelta>0?'var(--orange)':'var(--muted)'};">${calcGoalDelta>0?'+':''}${calcGoalDelta} kcal</div>
          ${calcGoalDelta!==0?`<div style="font-size:11px;color:var(--muted);">≈ ${Math.abs(calcGoalDelta/7700*7).toFixed(2)} kg/tydzień</div>`:''}
        </div>
      </div>

      <!-- pasek makro -->
      <div class="calc-macro-bar">
        <div class="calc-macro-seg" style="width:${calcMacroP}%;background:var(--accent);"></div>
        <div class="calc-macro-seg" style="width:${calcMacroF}%;background:var(--orange);"></div>
        <div class="calc-macro-seg" style="width:${calcMacroC}%;background:var(--blue);"></div>
      </div>

      <!-- makro tabela -->
      <div>
        <div class="calc-macro-row">
          <div style="display:flex;align-items:center;gap:8px;"><div class="calc-macro-dot" style="background:var(--accent);"></div><span style="font-weight:600;">Białko</span></div>
          <div style="font-family:'DM Mono',monospace;"><span style="font-size:18px;font-weight:700;color:var(--accent);">${proteinG}g</span> <span style="font-size:11px;color:var(--muted);">(${calcMacroP}% · ${Math.round(target*calcMacroP/100)} kcal)</span></div>
          <div style="font-size:11px;color:${isProtOk?'var(--teal)':'var(--orange)'};">${protPerKg} g/kg ${isProtOk?'✓':'⚠'}</div>
        </div>
        <div class="calc-macro-row">
          <div style="display:flex;align-items:center;gap:8px;"><div class="calc-macro-dot" style="background:var(--orange);"></div><span style="font-weight:600;">Tłuszcze</span></div>
          <div style="font-family:'DM Mono',monospace;"><span style="font-size:18px;font-weight:700;color:var(--orange);">${fatG}g</span> <span style="font-size:11px;color:var(--muted);">(${calcMacroF}% · ${Math.round(target*calcMacroF/100)} kcal)</span></div>
          <div style="font-size:11px;color:var(--muted);">${(fatG/weight).toFixed(1)} g/kg</div>
        </div>
        <div class="calc-macro-row">
          <div style="display:flex;align-items:center;gap:8px;"><div class="calc-macro-dot" style="background:var(--blue);"></div><span style="font-weight:600;">Węglowodany</span></div>
          <div style="font-family:'DM Mono',monospace;"><span style="font-size:18px;font-weight:700;color:var(--blue);">${carbG}g</span> <span style="font-size:11px;color:var(--muted);">(${calcMacroC}% · ${Math.round(target*calcMacroC/100)} kcal)</span></div>
          <div style="font-size:11px;color:var(--muted);">${(carbG/weight).toFixed(1)} g/kg</div>
        </div>
      </div>
    </div>

    <!-- alternatywne scenariusze -->
    <div class="calc-result-card">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:12px;">ALTERNATYWNE SCENARIUSZE</div>
      <div class="calc-scenarios">
        ${[{l:'Agresywna redukcja',d:-500,c:'var(--red)'},{l:'Łagodna redukcja',d:-300,c:'var(--orange)'},{l:'Utrzymanie',d:0,c:'var(--teal)'},{l:'Łagodna masa',d:300,c:'var(--blue)'},{l:'Agresywna masa',d:500,c:'var(--accent)'}].map(s=>`
          <div style="background:var(--s3);border-radius:8px;padding:10px;text-align:center;${calcGoalDelta===s.d?'border:1px solid '+s.c+';':'border:1px solid transparent;'}">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${s.l}</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:${s.c};">${tdee+s.d}</div>
            <div style="font-size:9px;color:var(--muted2);">kcal/dzień</div>
          </div>`).join('')}
      </div>
    </div>
    </div>

    <div class="calc-col-side">
    <!-- podział na posiłki -->
    <div class="calc-result-card" style="margin-bottom:14px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:12px;">PODZIAŁ NA POSIŁKI (5 posiłków)</div>
      ${meals.map(m=>`<div class="calc-meal-card">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:12px;font-weight:700;">${m.name}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--accent);">${Math.round(target*m.pct)} kcal</div>
        </div>
        <div style="display:flex;gap:8px;font-size:11px;color:var(--muted);">
          <span>B: <strong style="color:var(--accent);">${Math.round(proteinG*m.pct)}g</strong></span>
          <span>T: <strong style="color:var(--orange);">${Math.round(fatG*m.pct)}g</strong></span>
          <span>W: <strong style="color:var(--blue);">${Math.round(carbG*m.pct)}g</strong></span>
        </div>
      </div>`).join('')}
    </div>

    <!-- wskazówki i normy -->
    <div class="calc-result-card">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:12px;">NORMY I WSKAZÓWKI</div>
      <div class="calc-tip"><strong style="color:var(--accent);">Białko:</strong> Rekomendacja NSCA: 1.6–2.5 g/kg masy ciała. Twój wynik: ${protPerKg} g/kg — ${isProtOk?'✅ w normie':'⚠ poza normą, dostosuj'}.</div>
      <div class="calc-tip"><strong style="color:var(--accent);">Woda:</strong> Min. ${Math.round(weight*0.035*10)/10} l/dzień (35ml/kg). Podczas treningu +500-1000ml.</div>
      <div class="calc-tip"><strong style="color:var(--accent);">Tempo zmian:</strong> Zalecane 0.5-1% masy ciała/tydzień. Twój deficit/nadwyżka to ~${Math.abs(calcGoalDelta/7700*7).toFixed(2)} kg/tydzień.</div>
      <div class="calc-tip"><strong style="color:var(--accent);">LBM (szacunkowa beztłuszczowa masa):</strong> ~${lbm} kg. Docelowo 1.8-2.2g białka na kg LBM = ${Math.round(lbm*1.8)}–${Math.round(lbm*2.2)}g białka.</div>
      <div class="calc-tip"><strong style="color:var(--accent);">Okno żywieniowe po treningu:</strong> Spożyj 20-40g białka + węglowodany w ciągu 2h po treningu (okno anaboliczne).</div>
    </div>
    </div>`;
}

function calcSendToClient(){
  const cid=document.getElementById('calc-client').value;
  if(!cid){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===cid);
  const age=document.getElementById('calc-age').value;
  const weight=document.getElementById('calc-weight').value;
  const height=document.getElementById('calc-height').value;
  const gender=document.getElementById('calc-gender').value;
  let bmr;
  if(gender==='M')bmr=10*weight+6.25*height-5*age+5;
  else bmr=10*weight+6.25*height-5*age-161;
  const tdee=Math.round(bmr*calcActivity);
  const target=tdee+calcGoalDelta;
  const proteinG=Math.round(target*(calcMacroP/100)/4);
  const fatG=Math.round(target*(calcMacroF/100)/9);
  const carbG=Math.round(target*(calcMacroC/100)/4);
  pushMsg(cid,`📊 Twoje zapotrzebowanie kaloryczne:\n\nTDEE: ${tdee} kcal\nCel: ${target} kcal\n\nMakroskładniki:\n🟢 Białko: ${proteinG}g\n🟡 Tłuszcze: ${fatG}g\n🔵 Węglowodany: ${carbG}g\n\nWoda: min. ${Math.round(weight*0.035*10)/10}l/dzień`);
  notify('✓ Wyniki wysłane do '+(c?c.name:'klienta')+' w wiadomościach!');
}
var cpClientId=null;var cpTab='overview';

function openClientProfile(id){
  cpClientId=id;cpTab='overview';
  window._cpEditingClientId=null;
  const c=CL.find(x=>x.id===id);if(!c)return;
  const ci=CL.indexOf(c);const col=COLS[ci%5];
  document.getElementById('cp-avatar').style.background=col+'22';
  document.getElementById('cp-avatar').style.color=col;
  document.getElementById('cp-avatar').textContent=getInit(c.name);
  document.getElementById('cp-name').textContent=c.name;
  document.getElementById('cp-sub').textContent=(({masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja'})[c.goal]||c.goal||'Brak celu')+' · '+(c.level||'')+(c.age?' · '+c.age+' lat':'');
  document.getElementById('cp-drawer').classList.add('open');
  document.getElementById('cp-overlay').classList.add('show');
  document.querySelectorAll('.cp-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('cpt-overview').classList.add('active');
  renderCPOverview(c);
}

function closeClientProfile(){
  window._cpEditingClientId=null;
  document.getElementById('cp-drawer').classList.remove('open');
  document.getElementById('cp-overlay').classList.remove('show');
  cpClientId=null;
}

function setCPTab(t){
  cpTab=t;
  const moreTabs=['timeline','psycho','sfr','posture','photos','metrics','tasks','forms','food','documents','payments','features'];
  if(moreTabs.includes(t)){
    const moreEl=document.getElementById('cp-more-items');
    const arrow=document.getElementById('cp-more-arrow');
    if(moreEl)moreEl.style.display='block';
    if(arrow)arrow.style.transform='rotate(180deg)';
  }
  document.querySelectorAll('.cp-tab').forEach(el=>el.classList.remove('active'));
  const btn=document.getElementById('cpt-'+t);if(btn)btn.classList.add('active');
  const c=CL.find(x=>x.id===cpClientId);if(!c)return;
  if(t==='overview')renderCPOverview(c);
  if(t==='notes')renderCPNotes(c);
  if(t==='timeline')renderCPTimeline(c);
  if(t==='psycho')renderCPPsycho(c);
  if(t==='sfr')renderCPSfr(c);
  if(t==='training')renderCPTraining(c);
  if(t==='plan')renderCPPlan(c);
  if(t==='metrics')renderCPMetrics(c);
  if(t==='tasks')renderCPTasks(c);
  if(t==='forms')renderCPForms(c);
  if(t==='food')renderCPFood(c);
  if(t==='documents')renderCPDocuments(c);
  if(t==='payments')renderCPPayments(c);
  if(t==='features')renderCPSettings(c);
  if(t==='posture')renderCPPosture(c);
  if(t==='photos')renderCPPhotos(c);
}

