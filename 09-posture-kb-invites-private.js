// ═══════════════════════════════════════════════════════
// OCENA POSTAWY AI
// ═══════════════════════════════════════════════════════
function renderCPPosture(c){
  if(!c._posture)c._posture={photos:{front:null,side:null,back:null},analyses:[],currentPhoto:null};
  const p=c._posture;
  const labels={front:'Przód',side:'Bok',back:'Tył'};
  const ICONS={front:'🫁',side:'🏃',back:'🔙'};

  const photoSlots=['front','side','back'].map(view=>{
    const has=p.photos[view];
    const active=p.currentPhoto===view;
    return `<label style="cursor:pointer;display:block;">
      <input type="file" accept="image/*" style="display:none;" onchange="postureUploadPhoto('${c.id}','${view}',this)">
      <div style="border:2px ${has?(active?'solid var(--accent)':'solid var(--border2)'):'dashed var(--border2)'};border-radius:12px;overflow:hidden;background:${has?'transparent':'var(--s3)'};transition:border-color 0.15s;" onclick="if(this.parentElement.querySelector('input').files.length===0&&${has?'true':'false'})postureSetActive('${c.id}','${view}')">
        ${has?`<img src="${has}" style="width:100%;height:110px;object-fit:cover;display:block;">`
            :`<div style="height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;"><div style="font-size:28px;opacity:0.4;">${ICONS[view]}</div><div style="font-size:10px;color:var(--muted);">+ Wgraj</div></div>`}
        <div style="padding:6px 8px;background:${active&&has?'rgba(230,0,0,0.1)':'var(--s2)'};border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;font-weight:700;color:${active&&has?'var(--accent)':'var(--text)'};">${labels[view]}</span>
          ${has?`<span style="font-size:9px;color:var(--muted);">zmień</span>`:`<span style="font-size:9px;color:var(--muted);">brak</span>`}
        </div>
      </div>
    </label>`;
  }).join('');

  const viewBtns=Object.entries(labels).filter(([v])=>p.photos[v]).map(([v,l])=>
    `<button onclick="postureSetActive('${c.id}','${v}')" style="padding:5px 14px;border-radius:6px;border:1px solid ${p.currentPhoto===v?'var(--accent)':'var(--border2)'};background:${p.currentPhoto===v?'rgba(230,0,0,0.1)':'var(--s3)'};color:${p.currentPhoto===v?'var(--accent)':'var(--muted)'};font-size:11px;font-weight:${p.currentPhoto===v?700:400};cursor:pointer;transition:all 0.12s;">${l}</button>`
  ).join('');

  const _postureHtml=`
    <div style="margin-bottom:14px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1.5px;color:var(--text);margin-bottom:4px;">🧍 OCENA POSTAWY — AI</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5;">Wgraj zdjęcie klienta i uruchom analizę AI. Wynik zawiera wady postawy, słabe i skrócone mięśnie oraz gotowy program korekcyjny.</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      ${photoSlots}
    </div>

    ${Object.values(p.photos).some(x=>x)?`
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Wybierz zdjęcie do analizy</div>
      <div style="display:flex;gap:6px;">${viewBtns}</div>
    </div>
    <button class="btn btn-primary" style="width:100%;padding:12px;font-size:13px;font-weight:700;letter-spacing:0.5px;" onclick="postureAnalyze('${c.id}')" id="posture-analyze-btn">
      🔍 Analizuj postawę AI
    </button>`:''}

    <div id="posture-results" style="margin-top:14px;">
      ${p.analyses.length?renderPostureResults(p.analyses):`
        <div style="text-align:center;padding:32px 16px;color:var(--muted);">
          <div style="font-size:42px;margin-bottom:10px;opacity:0.2;">🧍</div>
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;">Brak analiz</div>
          <div style="font-size:11px;">Wgraj zdjęcie i kliknij Analizuj</div>
        </div>`}
    </div>`;
  document.getElementById('cp-body').innerHTML=(typeof withAnalyticsShell==='function'?withAnalyticsShell(_postureHtml):_postureHtml);
}

function postureUploadPhoto(clientId, view, input){
  if(!input.files[0])return;
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  if(!c._posture)c._posture={photos:{front:null,side:null,back:null},analyses:[],currentPhoto:null};
  const reader=new FileReader();
  reader.onload=e=>{
    c._posture.photos[view]=e.target.result;
    if(!c._posture.currentPhoto)c._posture.currentPhoto=view;
    renderCPPosture(c);
  };
  reader.readAsDataURL(input.files[0]);
}

function postureSetActive(clientId, view){
  const c=CL.find(x=>x.id===clientId);if(!c||!c._posture)return;
  c._posture.currentPhoto=view;
  renderCPPosture(c);
}

async function postureAnalyze(clientId){
  const c=CL.find(x=>x.id===clientId);
  if(!c||!c._posture)return;
  const view=c._posture.currentPhoto;
  const photo=c._posture.photos[view];
  if(!photo){notify('⚠ Wybierz zdjęcie do analizy');return;}

  const btn=document.getElementById('posture-analyze-btn');
  if(btn){btn.disabled=true;btn.innerHTML='⏳ Analizuję...';}

  const viewLabels={front:'przód (widok od przodu)',side:'bok (widok z boku)',back:'tył (widok od tyłu)'};
  const base64=photo.split(',')[1];
  const mediaType=photo.split(';')[0].split(':')[1]||'image/jpeg';

  const systemPrompt=`Jesteś doświadczonym fizjoterapeutą i trenerem personalnym. Analizujesz postawę ciała klientów na podstawie zdjęć. Odpowiadasz zawsze po polsku, konkretnie i profesjonalnie. Format odpowiedzi:

🔍 WADY POSTAWY
• [Lista wykrytych wad i dysfunkcji]

💪 MIĘŚNIE SŁABE (wymagają wzmocnienia)
• [Mięsień] — [dlaczego słaby, objawy]

🔄 MIĘŚNIE SKRÓCONE/NAPIĘTE (wymagają rozciągnięcia)
• [Mięsień] — [dlaczego skrócony]

🏋️ ZALECANE ĆWICZENIA KORYGUJĄCE
• [Ćwiczenie] — [cel, liczba serii/powtórzeń]

⚠️ OSTRZEŻENIA
• [Ćwiczenia/ruchy których należy unikać]

📋 PROGRAM KOREKCYJNY (3x/tydzień)
• [Dzień 1, 2, 3 z konkretnymi ćwiczeniami]

Bądź konkretny. Bazuj wyłącznie na tym co widzisz na zdjęciu.`;

  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1500,
        system:systemPrompt,
        messages:[{
          role:'user',
          content:[
            {type:'image',source:{type:'base64',media_type:mediaType,data:base64}},
            {type:'text',text:`Przeanalizuj postawę ciała klienta na tym zdjęciu (${viewLabels[view]||view}). Klient: ${c.name}, wiek: ${c.age||'nieznany'}, cel: ${c.goal||'nieznany'}. Podaj szczegółową analizę postawy.`}
          ]
        }]
      })
    });

    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Błąd API');

    const result=data.content?.map(b=>b.text||'').join('')||'Brak odpowiedzi';
    const today=new Date().toLocaleDateString('pl-PL');
    const viewLabelShort={front:'Przód',side:'Bok',back:'Tył'};

    if(!c._posture.analyses)c._posture.analyses=[];
    c._posture.analyses.push({date:today,view:viewLabelShort[view]||view,result});

    // Zapisz do Firebase
    persistById('clients',c);

    renderCPPosture(c);
    notify('✓ Analiza postawy ukończona!');

  }catch(err){
    console.error('Posture AI error:',err);
    notify('⚠ Błąd analizy: '+err.message);
    if(btn){btn.disabled=false;btn.innerHTML='🔍 Analizuj postawę AI';}
  }
}

window.postureUploadPhoto=postureUploadPhoto;
window.postureSetActive=postureSetActive;
window.postureAnalyze=postureAnalyze;

function renderCPPhotos(c){
  const el=document.getElementById('cp-body');if(!el||!c)return;
  el.innerHTML=`
    <div class="cp-section-title">ZDJECIA SYLWETKI</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:16px;">Klient dodaje przód / bok / tył w swojej apce. Możesz też wgrać zestaw tutaj i porównać daty.</div>
    ${typeof ppBlockHTML==='function'?ppBlockHTML(c,{live:true,accent:'var(--accent)'}):'<div style="color:var(--muted);font-size:12px;">Brak modułu zdjęć.</div>'}`;
}
window.renderCPPhotos=renderCPPhotos;

function cpOpenSession(){
  openM('m-session');
  // pre-select client
  setTimeout(()=>{
    if(cpClientId){
      const cc=CL.find(x=>x.id===cpClientId);
      if(typeof asSetClientField==='function')asSetClientField(cpClientId,cc?cc.name:'');
    }
    // set today's date
    const dateEl=document.getElementById('as-date');
    if(dateEl&&!dateEl.value)dateEl.value=new Date().toISOString().split('T')[0];
  },50);
}

function cpQuickMessage(){
  if(!cpClientId)return;
  closeClientProfile();
  goTo('inbox');
  setTimeout(()=>{if(typeof openChat==='function')openChat(cpClientId);},200);
}

function cpQuickCheckin(){
  if(!cpClientId)return;
  if(typeof sendCheckinTo==='function')sendCheckinTo(cpClientId);
}

function cpStartLive(){
  if(!cpClientId)return;
  const c=CL.find(x=>x.id===cpClientId);
  closeClientProfile();
  goTo('live');
  setTimeout(()=>{if(typeof liveClientSetField==='function')liveClientSetField(cpClientId,c?c.name:'');},200);
}

function toggleCpHdrMore(evOrForce){
  const menu=document.getElementById('cp-hdr-more-menu');
  const btn=document.getElementById('cp-hdr-more-btn');
  if(!menu)return;
  let open;
  if(evOrForce===false)open=false;
  else if(evOrForce===true)open=true;
  else open=menu.hasAttribute('hidden');
  if(open){
    menu.removeAttribute('hidden');
    if(btn)btn.setAttribute('aria-expanded','true');
  }else{
    menu.setAttribute('hidden','');
    if(btn)btn.setAttribute('aria-expanded','false');
  }
}
function _cpHdrMoreOutside(e){
  const wrap=document.querySelector('.cp-hdr-more-wrap');
  const menu=document.getElementById('cp-hdr-more-menu');
  if(!wrap||!menu||menu.hasAttribute('hidden'))return;
  if(wrap.contains(e.target))return;
  toggleCpHdrMore(false);
}
document.addEventListener('click',_cpHdrMoreOutside);

function closeCpMoreNav(){
  const el=document.getElementById('cp-more-items');
  const btn=document.getElementById('cp-more-toggle');
  if(el)el.setAttribute('hidden','');
  if(btn){
    btn.setAttribute('aria-expanded','false');
    const moreTabs=['tasks','notes','timeline','analytics','photos','forms','food','payments','features','documents'];
    if(!moreTabs.includes(window.cpTab))btn.classList.remove('active');
  }
}
function _positionCpMoreMenu(){
  const btn=document.getElementById('cp-more-toggle');
  const el=document.getElementById('cp-more-items');
  if(!btn||!el||el.hasAttribute('hidden'))return;
  if(el.parentElement!==document.body)document.body.appendChild(el);
  const r=btn.getBoundingClientRect();
  const mw=Math.max(220,el.offsetWidth||220);
  let left=r.left+r.width/2-mw/2;
  left=Math.max(8,Math.min(left,window.innerWidth-mw-8));
  let top=r.bottom+6;
  const mh=el.offsetHeight||280;
  if(top+mh>window.innerHeight-8&&r.top>mh+12)top=r.top-mh-6;
  el.style.left=left+'px';
  el.style.top=top+'px';
  el.style.right='auto';
  el.style.transform='none';
}
function openCpMoreNav(){
  const el=document.getElementById('cp-more-items');
  const btn=document.getElementById('cp-more-toggle');
  if(el)el.removeAttribute('hidden');
  if(btn)btn.setAttribute('aria-expanded','true');
  _positionCpMoreMenu();
}
function toggleCpMoreNav(evOrForce){
  const el=document.getElementById('cp-more-items');
  if(!el)return;
  if(evOrForce&&typeof evOrForce==='object'){
    try{evOrForce.preventDefault();}catch(e){}
    try{evOrForce.stopPropagation();}catch(e){}
    try{evOrForce.stopImmediatePropagation&&evOrForce.stopImmediatePropagation();}catch(e){}
  }
  let open;
  if(evOrForce===false)open=false;
  else if(evOrForce===true)open=true;
  else open=el.hasAttribute('hidden');
  if(open){
    openCpMoreNav();
    window._cpMoreIgnoreUntil=Date.now()+250;
  }else closeCpMoreNav();
}
function _cpMoreOutside(e){
  if(window._cpMoreIgnoreUntil&&Date.now()<window._cpMoreIgnoreUntil)return;
  const wrap=document.querySelector('.cp-tabs-more-wrap');
  const el=document.getElementById('cp-more-items');
  const btn=document.getElementById('cp-more-toggle');
  if(!el||el.hasAttribute('hidden'))return;
  if(wrap&&wrap.contains(e.target))return;
  if(el.contains(e.target))return;
  if(btn&&btn.contains(e.target))return;
  closeCpMoreNav();
}
window.addEventListener('resize',()=>{try{_positionCpMoreMenu();}catch(e){}});
window.addEventListener('scroll',()=>{try{_positionCpMoreMenu();}catch(e){}},true);
document.addEventListener('click',_cpMoreOutside);
window.toggleCpMoreNav=toggleCpMoreNav;
window.openCpMoreNav=openCpMoreNav;
window.closeCpMoreNav=closeCpMoreNav;
window.toggleCpHdrMore=toggleCpHdrMore;
window.cpQuickMessage=cpQuickMessage;
window.cpQuickCheckin=cpQuickCheckin;
window.cpStartLive=cpStartLive;

function cpOpenTask(){
  openM('m-task');
  setTimeout(()=>{
    if(cpClientId){
      const cc=CL.find(x=>x.id===cpClientId);
      if(typeof taskSetClientField==='function')taskSetClientField(cpClientId,cc?cc.name:'');
    }
  },50);
}
function deleteClientNote(clientId,idx){
  if(!CLIENT_NOTES[clientId])return;
  if(!confirm('Usunąć tę notatkę?'))return;
  const removed=CLIENT_NOTES[clientId].splice(idx,1)[0];
  const c=CL.find(x=>x.id===clientId);
  if(c){
    if(cpTab==='notes')renderCPNotes(c);
    else setCPTab('overview');
  }
  notify('Notatka usunięta');
  if(removed&&removed.id&&window._db){
    try{window._del(window._doc(window._db,'clientNotes',removed.id));}catch(e){}
  }
}
function deleteClientActivity(clientId,idx){
  if(!CLIENT_ACTIVITY[clientId])return;
  if(!confirm('Usunąć ten wpis aktywności?'))return;
  CLIENT_ACTIVITY[clientId].splice(idx,1);
  setCPTab('overview');
  notify('Aktywność usunięta');
}
function saveCPEdit(id){
  const c=CL.find(x=>x.id===id);if(!c)return;
  c.name=document.getElementById('cpe-name').value.trim()||c.name;
  c.email=document.getElementById('cpe-email').value;
  c.phone=(document.getElementById('cpe-phone')||{}).value||'';
  c.age=parseInt(document.getElementById('cpe-age').value)||c.age;
  c.gender=(document.getElementById('cpe-gender')||{}).value||c.gender;
  c.weight=parseFloat(document.getElementById('cpe-weight').value)||c.weight;
  c.height=parseInt(document.getElementById('cpe-height').value)||c.height;
  // Cel / poziom / częstotliwość / pora / kontuzje — wyłącznie z Ankiety wstępnej (Formularze)
  const goalEl=document.getElementById('cpe-goal');
  if(goalEl)c.goal=goalEl.value;
  const levelEl=document.getElementById('cpe-level');
  if(levelEl)c.level=levelEl.value;
  const freqEl=document.getElementById('cpe-freq');
  if(freqEl){
    const freq=typeof normalizeTrainingFreq==='function'?normalizeTrainingFreq(freqEl.value):parseInt(freqEl.value,10);
    if(freq)c.trainingFreq=freq;else delete c.trainingFreq;
  }
  const timeEl=document.getElementById('cpe-train-time');
  if(timeEl)c.preferredTrainTime=(timeEl.value||'').trim();
  if(typeof readPreferredWeekdaysFrom==='function')c.preferredWeekdays=readPreferredWeekdaysFrom('cpe');
  c.status=document.getElementById('cpe-status').value;
  c.priorSports=typeof readPriorSportsFrom==='function'?readPriorSportsFrom('cpe'):(c.priorSports||[]);
  c.physiquePriority=typeof readPhysiquePriorityFrom==='function'?readPhysiquePriorityFrom('cpe'):(c.physiquePriority||[]);
  c.activityLevel=document.getElementById('cpe-activity')?.value||c.activityLevel||'moderate';
  c.sportNotes=document.getElementById('cpe-sport-notes')?.value||'';
  const injEl=document.getElementById('cpe-injuries');
  if(injEl)c.injuries=injEl.value;
  c.notes=document.getElementById('cpe-notes').value;
  window._cpEditingClientId=null;
  persistById('clients',c);
  // Odśwież sidebar bez zamykania drawera
  try{renderClients();}catch(e){}
  try{document.getElementById('nb-clients').textContent=CL.length;}catch(e){}
  // Zaktualizuj nagłówek drawera
  try{
    document.getElementById('cp-name').textContent=c.name;
    document.getElementById('cp-sub').textContent=(c.goal||'Brak celu')+' · '+(c.level||'')+(c.age?' · '+c.age+' lat':'');
  }catch(e){}
  // Wróć do zakładki Przegląd po zapisaniu
  try{setCPTab('overview');}catch(e){}
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  notify('✓ Profil "'+c.name+'" zaktualizowany!');
}

function archiveClient(id){
  const c=CL.find(x=>x.id===id);
  if(!c)return;
  if(c.status==='archived'){notify('Klient jest już w archiwum');return;}
  if(!confirm('Zarchiwizować klienta „'+(c.name||'')+'”?\n\nZniknie z aktywnej listy (filtr „Zarchiwizowani”). Możesz go później przywrócić lub usunąć na zawsze.'))return;
  c.status='archived';
  persistById('clients',c);
  try{renderClients();}catch(e){}
  try{renderClientFilters();}catch(e){}
  try{document.getElementById('nb-clients').textContent=CL.filter(x=>x.status!=='archived').length;}catch(e){}
  if(typeof closeClientProfile==='function')closeClientProfile();
  notify('✓ Klient '+c.name+' zarchiwizowany');
}

function restoreClient(id){
  const c=CL.find(x=>x.id===id);
  if(!c)return;
  c.status='active';
  persistById('clients',c);
  try{renderClients();}catch(e){}
  try{renderClientFilters();}catch(e){}
  try{document.getElementById('nb-clients').textContent=CL.filter(x=>x.status!=='archived').length;}catch(e){}
  if(typeof refreshClientProfileRemoveActions==='function')refreshClientProfileRemoveActions(c);
  notify('✓ Klient '+c.name+' przywrócony');
}

/** Trwałe usunięcie rekordu klienta (nie archiwum). */
function deleteClientPermanently(id){
  const c=CL.find(x=>x.id===id);
  if(!c)return;
  if(!confirm('Usunąć klienta „'+(c.name||'')+'” na zawsze?\n\nTej operacji nie da się cofnąć. Jeśli chcesz tylko schować go z listy — anuluj i użyj „Zarchiwizuj”.'))return;
  if(!confirm('Na pewno usunąć „'+(c.name||'')+'”?'))return;
  const idx=CL.findIndex(x=>x.id===id);
  if(idx>=0)CL.splice(idx,1);
  if(window._db&&window._del&&window._doc){
    window._del(window._doc(window._db,'clients',id)).catch(e=>console.warn('Firebase delete client:',e));
  }
  if(typeof cpClientId!=='undefined'&&cpClientId===id&&typeof closeClientProfile==='function')closeClientProfile();
  try{renderClients();}catch(e){}
  try{renderClientFilters();}catch(e){}
  try{document.getElementById('nb-clients').textContent=CL.filter(x=>x.status!=='archived').length;}catch(e){}
  notify('Klient usunięty');
}

function refreshClientProfileRemoveActions(c){
  const archBtn=document.getElementById('cp-archive-btn');
  const restBtn=document.getElementById('cp-restore-btn');
  const delBtn=document.getElementById('cp-delete-btn');
  const archived=!!(c&&c.status==='archived');
  if(archBtn&&archBtn.style)archBtn.style.display=archived?'none':'';
  if(restBtn&&restBtn.style)restBtn.style.display=archived?'':'none';
  if(delBtn&&delBtn.style)delBtn.style.display='';
}
var payTab='overview';
window.PACKAGES=[];window.INVOICES=[];
var invoiceCounter=1000;

function nextInvoiceNr(){
  const prefix=((window.SETTINGS&&window.SETTINGS.company&&window.SETTINGS.company.invoice_prefix)||'INV').replace(/[^A-Za-z0-9]/g,'')||'INV';
  let max=1000;
  (window.INVOICES||[]).forEach(inv=>{
    const m=String(inv.nr||inv.id||'').match(/(\d+)\s*$/);
    if(m)max=Math.max(max,parseInt(m[1],10));
  });
  invoiceCounter=max+1;
  return prefix+'-'+invoiceCounter;
}

function paySeller(){
  const S=window.SETTINGS||{};
  const co=S.company||{};
  const pay=S.payments||{};
  return{
    name:(typeof getTrainerName==='function'?getTrainerName(''):'')||co.name||'Trener',
    nip:co.nip||'',
    address:[co.address,co.city].filter(Boolean).join(', '),
    bank:pay.bankAccount||'',
    footer:co.invoice_footer||'',
    currency:pay.currency||'PLN'
  };
}

const PAY_STATUS_PILL={paid:'pill-green',pending:'pill-orange',partial:'pill-blue',expired:'pill-red'};
const PAY_STATUS_LABEL={paid:'Opłacony',pending:'Oczekujący',partial:'Częściowy',expired:'Wygasły'};
const PKG_TYPE_LABEL={sessions:'Pakiet sesji',monthly:'Abonament',program:'Program',online:'Coaching online'};
const PKG_TYPE_COLOR={sessions:'var(--accent)',monthly:'var(--blue)',program:'var(--purple)',online:'var(--teal)'};

function allPackages(){return window.PACKAGES||[];}
function allInvoices(){return window.INVOICES||[];}

function setPayTab(t){
  payTab=t;
  ['overview','packages','invoices','history'].forEach(tab=>{
    const v=document.getElementById('ptab-'+tab+'-view');
    if(v)v.style.display=tab===t?'block':'none';
    const btn=document.getElementById('ptab-'+tab);
    if(btn)btn.classList.toggle('active',tab===t);
  });
  const addBtn=document.getElementById('pay-add-btn');
  if(addBtn)addBtn.textContent=t==='invoices'?'+ Ręczna faktura':'+ Nowy pakiet';
  if(t==='overview')renderPayOverview();
  if(t==='packages')renderPayPackages();
  if(t==='invoices')renderPayInvoices();
  if(t==='history')renderPayHistory();
}

function renderPayOverview(){
  const all=allPackages();
  const today=new Date();
  const thisMonth=today.toISOString().slice(0,7);

  // stats
  const monthly=all.filter(p=>p.date&&p.date.startsWith(thisMonth)&&p.payStatus==='paid').reduce((s,p)=>s+p.price,0);
  const annual=all.filter(p=>p.payStatus==='paid').reduce((s,p)=>s+p.price,0);
  const active=all.filter(p=>p.expiresDate&&p.expiresDate>=today.toISOString().split('T')[0]&&p.sessionsUsed<p.sessions).length;
  const expiring=all.filter(p=>{
    if(!p.expiresDate)return false;
    const d=new Date(p.expiresDate);
    const diff=Math.ceil((d-today)/(1000*60*60*24));
    return diff>=0&&diff<=7;
  }).length;

  document.getElementById('pay-monthly').textContent=monthly.toLocaleString('pl')+' zł';
  document.getElementById('pay-annual').textContent=annual.toLocaleString('pl')+' zł';
  document.getElementById('pay-active-pkg').textContent=active;
  document.getElementById('pay-expiring').textContent=expiring;

  // chart
  renderPayChart();

  // transactions
  const tl=document.getElementById('pay-transactions-list');
  const sorted=all.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,8);
  tl.innerHTML=!sorted.length
    ?`<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px;">Brak transakcji — pojawią się tu automatycznie po zarejestrowaniu pierwszej płatności.</div>`
    :sorted.map((p,i)=>`<div class="pay-trans-row" style="animation-delay:${i*0.03}s">
    <div>
      <div style="font-size:13px;font-weight:600;">${p.clientName||'—'}</div>
      <div style="font-size:11px;color:var(--muted);">${p.title}</div>
    </div>
    <div style="color:var(--muted);align-self:center;">${p.date||'—'}</div>
    <div style="font-weight:700;color:var(--accent);align-self:center;">${p.price.toLocaleString('pl')} zł</div>
    <div style="align-self:center;"><span class="pill ${PAY_STATUS_PILL[p.payStatus]||'pill-muted'}" style="font-size:10px;">${PAY_STATUS_LABEL[p.payStatus]||p.payStatus}</span></div>
  </div>`).join('');

  // active packages
  const pal=document.getElementById('pay-active-list');
  const activePkgs=all.filter(p=>p.expiresDate&&p.expiresDate>=today.toISOString().split('T')[0]&&p.sessionsUsed<p.sessions).slice(0,4);
  pal.innerHTML=activePkgs.length?activePkgs.map(p=>{
    const pct=Math.round(p.sessionsUsed/p.sessions*100);
    const col=PKG_TYPE_COLOR[p.type]||'var(--accent)';
    const daysLeft=p.expiresDate?Math.ceil((new Date(p.expiresDate)-today)/(1000*60*60*24)):null;
    return `<div class="card-sm" style="margin-bottom:8px;border-left:3px solid ${col};">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <div style="font-size:12px;font-weight:600;">${p.clientName}</div>
        <div style="font-size:11px;color:var(--muted);">${daysLeft!==null?daysLeft+'d':'—'}</div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">${p.title}</div>
      <div class="pkg-progress"><div class="pkg-progress-fill" style="width:${pct}%;background:${col};"></div></div>
      <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${p.sessionsUsed}/${p.sessions} sesji · ${pct}%</div>
    </div>`;
  }).join(''):'<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px;">Brak aktywnych pakietów</div>';

  // alerts
  const alerts=document.getElementById('pay-alerts-list');
  const expPkgs=all.filter(p=>{
    if(!p.expiresDate)return false;
    const diff=Math.ceil((new Date(p.expiresDate)-today)/(1000*60*60*24));
    return diff>=0&&diff<=7;
  });
  const pendPkgs=all.filter(p=>p.payStatus==='pending');
  let alertsHTML='';
  expPkgs.forEach(p=>{
    const d=Math.ceil((new Date(p.expiresDate)-today)/(1000*60*60*24));
    alertsHTML+=`<div class="pay-alert"><span style="font-size:18px;">⏰</span><div><div style="font-weight:600;">${p.clientName}</div><div style="color:var(--orange);">Pakiet wygasa za ${d} ${d===1?'dzień':'dni'}</div></div></div>`;
  });
  const lowPkgs=all.filter(p=>{
    const left=(p.sessions||0)-(p.sessionsUsed||0);
    return p.payStatus!=='expired'&&left>0&&left<=2;
  });
  lowPkgs.forEach(p=>{
    const left=(p.sessions||0)-(p.sessionsUsed||0);
    alertsHTML+=`<div class="pay-alert"><span style="font-size:18px;">📉</span><div><div style="font-weight:600;">${escHtml(p.clientName||'')}</div><div style="color:var(--orange);">Został${left===1?'a':'o'} ${left} ${left===1?'sesja':'sesje'}</div></div></div>`;
  });
  pendPkgs.forEach(p=>{
    alertsHTML+=`<div class="pay-alert"><span style="font-size:18px;">💳</span><div style="flex:1;"><div style="font-weight:600;">${escHtml(p.clientName||'')}</div><div style="color:var(--red);">Oczekująca płatność — ${(p.price||0).toLocaleString('pl')} zł</div></div>
      <button class="btn btn-ghost btn-sm" onclick="requestPayment('${p.id}')">Poproś</button></div>`;
  });
  alerts.innerHTML=alertsHTML||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:16px;">Brak alertów ✓</div>';
}

function renderPayChart(){
  const all=allPackages();
  const months=['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  const now=new Date();
  const data=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=d.toISOString().slice(0,7);
    const total=all.filter(p=>p.date&&p.date.startsWith(key)&&p.payStatus==='paid').reduce((s,p)=>s+p.price,0);
    data.push({label:months[d.getMonth()],value:total});
  }
  const max=Math.max(...data.map(d=>d.value),1);
  const el=document.getElementById('pay-chart-svg');
  if(!el)return;
  el.innerHTML=`<div class="pay-bar">${data.map(d=>`
    <div class="pay-bar-col">
      <div class="pay-bar-val">${d.value?d.value.toLocaleString('pl')+'zł':''}</div>
      <div class="pay-bar-fill" style="height:${Math.round(d.value/max*80)+4}px;background:${d.value?'var(--accent)':'var(--s3)'};"></div>
      <div class="pay-bar-lbl">${d.label}</div>
    </div>`).join('')}</div>`;
}

function renderPayPackages(){
  const all=allPackages();
  const today=new Date().toISOString().split('T')[0];

  // client filter chips
  const bar=document.getElementById('pkg-client-filter-bar');
  if(bar){
    const clients=['all',...new Set(all.map(p=>p.clientName))];
    bar.innerHTML=clients.map(c=>`<button class="wl-filter-chip${c==='all'?'active':''}" onclick="filterPkgByClient('${c}',this)">${c==='all'?'Wszyscy':c}</button>`).join('');
  }

  const grid=document.getElementById('pay-pkg-grid');
  if(!grid)return;
  grid.innerHTML=all.map((p,i)=>{
    const col=PKG_TYPE_COLOR[p.type]||'var(--accent)';
    const pct=Math.round(p.sessionsUsed/p.sessions*100);
    const isExpired=p.expiresDate&&p.expiresDate<today;
    const daysLeft=p.expiresDate?Math.ceil((new Date(p.expiresDate)-new Date())/(1000*60*60*24)):null;
    return `<div class="pkg-card" style="animation-delay:${i*0.04}s">
      <div class="pkg-card-top" style="background:${col};"></div>
      <div class="pkg-card-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div>
            <div style="font-size:14px;font-weight:700;">${p.title}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${p.clientName} · ${PKG_TYPE_LABEL[p.type]||p.type}</div>
          </div>
          <span class="pill ${PAY_STATUS_PILL[p.payStatus]||'pill-muted'}" style="font-size:10px;flex-shrink:0;">${PAY_STATUS_LABEL[p.payStatus]||p.payStatus}</span>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="text-align:center;flex:1;background:var(--s3);border-radius:8px;padding:8px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${col};">${p.price.toLocaleString('pl')}</div>
            <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">PLN</div>
          </div>
          <div style="text-align:center;flex:1;background:var(--s3);border-radius:8px;padding:8px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${isExpired?'var(--red)':daysLeft<=7?'var(--orange)':'var(--text)'};">${daysLeft!==null?(isExpired?'WYGASŁ':daysLeft+'d'):'∞'}</div>
            <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">POZOSTAŁO</div>
          </div>
        </div>
        <div class="pkg-progress"><div class="pkg-progress-fill" style="width:${pct}%;background:${col};"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:10px;">
          <span>${p.sessionsUsed}/${p.sessions} sesji</span>
          <span>${pct}% wykorzystano</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="usePackageSession('${p.id}')">+ Sesja</button>
          <button class="btn btn-ghost btn-sm" onclick="viewInvoice('${p.invoiceId||p.id}')">🧾</button>
          ${p.payStatus==='pending'?`<button class="btn btn-primary btn-sm" onclick="markPaid('${p.id}')">Opłacony</button>
          <button class="btn btn-ghost btn-sm" onclick="requestPayment('${p.id}')">Poproś o wpłatę</button>`:''}
          <button class="btn btn-ghost btn-sm" title="Usuń" onclick="deletePackage('${p.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('')+`<div style="border:1px dashed var(--border2);border-radius:var(--r2);display:flex;align-items:center;justify-content:center;min-height:180px;cursor:pointer;background:transparent;" onclick="openM('m-package')">
    <div style="text-align:center;color:var(--muted);"><div style="font-size:32px;margin-bottom:8px;">+</div><div style="font-size:13px;font-weight:600;">Nowy pakiet</div></div>
  </div>`;
}

function filterPkgByClient(name,btn){
  document.querySelectorAll('#pkg-client-filter-bar .wl-filter-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // filter grid
  document.querySelectorAll('#pay-pkg-grid .pkg-card').forEach(card=>{
    if(name==='all'){card.style.display='block';return;}
    const clientEl=card.querySelector('.pkg-card-body div div:last-child');
    card.style.display=(clientEl&&clientEl.textContent.includes(name))?'block':'none';
  });
}

function usePackageSession(id){
  const all=allPackages();
  const p=all.find(x=>x.id===id);
  if(!p)return;
  if(p.sessionsUsed>=p.sessions){notify('Pakiet wyczerpany!');return;}
  p.sessionsUsed++;
  persistById('packages',p);
  renderPayPackages();
  notify('✓ Sesja odliczona z pakietu ('+p.sessionsUsed+'/'+p.sessions+')');
}

function clientUnpaidPackages(clientId){
  if(!clientId)return[];
  return allPackages().filter(p=>p&&p.clientId===clientId&&p.payStatus==='pending'&&p.status!=='expired');
}
window.clientUnpaidPackages=clientUnpaidPackages;

function packagesAwaitingPayment(){
  const live=new Set((window.CL||[]).filter(c=>c&&c.status!=='archived').map(c=>c.id));
  return allPackages().filter(p=>p&&p.clientId&&p.payStatus==='pending'&&p.status!=='expired'&&(!live.size||live.has(p.clientId)));
}
window.packagesAwaitingPayment=packagesAwaitingPayment;

function payTransferText(p){
  const seller=typeof paySeller==='function'?paySeller():{};
  const amount=p&&p.price!=null?p.price:0;
  const title=((p&&p.clientName)||'')+' '+((p&&(p.invoiceId||p.id))||'');
  return[
    'Konto: '+(seller.bank||'(brak numeru konta)'),
    'Kwota: '+Number(amount).toLocaleString('pl')+' '+(seller.currency||'zł'),
    'Tytuł: '+title.trim()
  ].join('\n');
}
window.payTransferText=payTransferText;

function copyPackageTransfer(pkgId){
  const p=allPackages().find(x=>x.id===pkgId);
  if(!p){if(typeof notify==='function')notify('Nie znaleziono pakietu');return false;}
  const text=payTransferText(p);
  window._payCopy={bank:(typeof paySeller==='function'?paySeller().bank:''),title:((p.clientName||'')+' '+(p.invoiceId||p.id||'')).trim(),amount:p.price||0};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>{if(typeof notify==='function')notify('✓ Skopiowano dane do przelewu');}).catch(()=>{
      try{prompt('Skopiuj dane przelewu:',text);}catch(e){}
    });
  }else{
    try{prompt('Skopiuj dane przelewu:',text);}catch(e){}
  }
  return true;
}
window.copyPackageTransfer=copyPackageTransfer;

function clientNotifyPaid(pkgId){
  const p=allPackages().find(x=>x.id===pkgId);
  if(!p){if(typeof notify==='function')notify('Nie znaleziono pakietu');return false;}
  const msg='Wpłaciłem za pakiet: '+(p.title||'pakiet')+' ('+Number(p.price||0).toLocaleString('pl')+' zł). Proszę o oznaczenie jako opłacony.';
  if(typeof pushClientMsg==='function')pushClientMsg(msg);
  else if(typeof pushMsg==='function'&&p.clientId)pushMsg(p.clientId,msg);
  if(typeof addNotification==='function'){
    addNotification('payment','Klient zgłasza wpłatę',(p.clientName||'Klient')+' · '+(p.title||'')+' · '+(p.price||0)+' zł','payments');
  }
  if(typeof notify==='function')notify('✓ Wiadomość poszła do trenera');
  return true;
}
window.clientNotifyPaid=clientNotifyPaid;

function refreshPaySurfaces(){
  try{if(typeof renderDashPayFollowup==='function')renderDashPayFollowup();}catch(e){}
  try{if(typeof renderClientLive==='function'&&window._clientAppMode)renderClientLive();}catch(e){}
  try{if(typeof updateClientLiveNavBadges==='function'&&window._clientAppMode){
    const c=(window.CL||[]).find(x=>x.id===window._clientId)||(window.CL||[])[0];
    if(c)updateClientLiveNavBadges(c);
  }}catch(e){}
}

function markPaid(id){
  const all=allPackages();
  const p=all.find(x=>x.id===id);
  if(p){
    p.payStatus='paid';renderPayPackages();renderPayOverview();notify('✓ Pakiet oznaczony jako opłacony');
    persistById('packages',p);
    const inv=(window.INVOICES||[]).find(i=>i.pkgId===p.id||i.id===p.invoiceId||i.nr===p.invoiceId);
    if(inv){inv.status='paid';persistById('invoices',inv);}
    if(typeof fireIntEvent==='function'){
      fireIntEvent('package.paid',{package:{id:p.id,title:p.title,price:p.price,clientId:p.clientId,clientName:p.clientName}});
    }
    refreshPaySurfaces();
  }
}

function requestPayment(id){
  const p=allPackages().find(x=>x.id===id);
  if(!p){notify('Nie znaleziono pakietu');return false;}
  if(!p.clientId){notify('Pakiet bez klienta');return false;}
  const seller=paySeller();
  const lines=[
    'Prośba o płatność — '+p.title,
    'Kwota: '+(p.price||0).toLocaleString('pl')+' '+(seller.currency||'zł'),
    seller.bank?('Nr konta: '+seller.bank):'Nr konta: (trener uzupełni w Ustawieniach → Płatności)',
    'Tytuł przelewu: '+(p.clientName||'')+' '+(p.invoiceId||''),
    '',
    'Po wpłacie daj znać — oznaczę pakiet jako opłacony.'
  ];
  if(typeof pushMsg==='function')pushMsg(p.clientId,lines.join('\n'));
  p.paymentRequestedAt=new Date().toISOString();
  if(typeof persistById==='function')persistById('packages',p);
  notify('✓ Prośba o wpłatę poszła do czatu klienta');
  if(typeof addNotification==='function')addNotification('payment','Wysłano prośbę o wpłatę',(p.clientName||'')+' · '+(p.price||0)+' zł','inbox');
  if(typeof renderClientOnboardChecklist==='function'&&window._onboardClientId===p.clientId){
    try{renderClientOnboardChecklist();}catch(e){}
  }
  refreshPaySurfaces();
  return true;
}

function deletePackage(id){
  const p=allPackages().find(x=>x.id===id);
  if(!p)return;
  if(!confirm('Usunąć pakiet „'+p.title+'”? Faktura zostanie w historii.'))return;
  window.PACKAGES=(window.PACKAGES||[]).filter(x=>x.id!==id);
  if(window._db&&window._del&&window._doc){
    window._del(window._doc(window._db,'packages',id)).catch(e=>console.warn(e));
  }
  if(payTab==='packages')renderPayPackages();
  else renderPayOverview();
  notify('Pakiet usunięty');
}

function viewInvoice(invId){
  const inv=allInvoices().find(x=>x.id===invId||x.nr===invId)||allPackages().find(x=>x.id===invId||x.invoiceId===invId);
  if(!inv){notify('Faktura nie znaleziona');return;}
  const nr=inv.nr||inv.invoiceId||inv.id;
  const clientName=inv.clientName||'—';
  const pkgTitle=inv.pkgTitle||inv.title||'Pakiet';
  const date=inv.date||'—';
  const amount=inv.amount!=null?inv.amount:inv.price||0;
  const status=inv.status||inv.payStatus||'pending';
  const seller=paySeller();
  window._payCopy={bank:seller.bank,title:clientName+' '+nr,amount};
  document.getElementById('inv-modal-title').textContent='FAKTURA '+nr;
  document.getElementById('inv-modal-body').innerHTML=`
    <div style="font-family:'DM Mono',monospace;">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;gap:12px;">
        <div>
          <div style="font-size:22px;font-weight:700;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;">PROGRESS LIVE</div>
          <div style="font-size:11px;color:var(--muted);">${escHtml(seller.name)}</div>
          ${seller.nip?`<div style="font-size:11px;color:var(--muted);">NIP ${escHtml(seller.nip)}</div>`:''}
          ${seller.address?`<div style="font-size:11px;color:var(--muted);">${escHtml(seller.address)}</div>`:''}
        </div>
        <div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${escHtml(nr)}</div><div style="font-size:11px;color:var(--muted);">Data: ${escHtml(date)}</div></div>
      </div>
      <div style="background:var(--s3);border-radius:8px;padding:12px;margin-bottom:16px;">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Nabywca</div>
        <div style="font-size:14px;font-weight:600;">${escHtml(clientName)}</div>
      </div>
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 100px 100px;padding:8px 12px;background:var(--s3);font-size:10px;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--border);">
          <span>Pozycja</span><span>Ilość</span><span style="text-align:right;">Kwota</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 100px 100px;padding:12px;font-size:12px;">
          <span>${escHtml(pkgTitle)}</span><span>1</span><span style="text-align:right;font-weight:700;">${amount.toLocaleString('pl')} zł</span>
        </div>
      </div>
      ${seller.bank?`<div style="background:var(--s3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Przelew</div>
        <div>Konto: <strong>${escHtml(seller.bank)}</strong></div>
        <div>Tytuł: ${escHtml(clientName+' '+nr)}</div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="copyPayTransfer()">📋 Kopiuj dane do przelewu</button>
      </div>`:`<div style="font-size:11px;color:var(--orange);margin-bottom:12px;">Uzupełnij numer konta w Ustawieniach → Płatności, żeby pojawił się na fakturze.</div>`}
      <div style="display:flex;justify-content:flex-end;">
        <div style="background:var(--adim);border:1px solid rgba(230,0,0,0.2);border-radius:8px;padding:12px 20px;text-align:right;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">RAZEM</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--accent);">${amount.toLocaleString('pl')} zł</div>
        </div>
      </div>
      <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:var(--muted);">${escHtml(seller.footer||'Dokument wewnętrzny — nie jest fakturą VAT, chyba że uzupełnisz NIP w ustawieniach.')}</div>
        <span class="pill ${PAY_STATUS_PILL[status]||'pill-muted'}">${PAY_STATUS_LABEL[status]||status}</span>
      </div>
    </div>`;
  openM('m-invoice');
}

function copyPayTransfer(){
  const d=window._payCopy||{};
  const seller=paySeller();
  const text='Konto: '+(d.bank||seller.bank||'')+'\nKwota: '+(d.amount!=null?d.amount:0)+' zł\nTytuł: '+(d.title||'');
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>notify('✓ Dane przelewu skopiowane')).catch(()=>notify(text));}
  else notify(text);
}

function renderPayInvoices(){
  const all=allInvoices();
  const el=document.getElementById('pay-invoices-list');
  if(!el)return;
  el.innerHTML=!all.length
    ?`<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px;">Brak wystawionych faktur.</div>`
    :all.map((inv,i)=>`<div class="pay-inv-row" style="animation-delay:${i*0.03}s" onclick="viewInvoice('${inv.id}')">
    <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);">${inv.nr}</div>
    <div><div style="font-size:13px;font-weight:600;">${inv.clientName}</div><div style="font-size:11px;color:var(--muted);">${inv.pkgTitle}</div></div>
    <div style="color:var(--muted);align-self:center;">${inv.date}</div>
    <div style="font-weight:700;align-self:center;">${inv.amount.toLocaleString('pl')} zł</div>
    <div style="align-self:center;"><span class="pill ${PAY_STATUS_PILL[inv.status]||'pill-muted'}" style="font-size:10px;">${PAY_STATUS_LABEL[inv.status]||inv.status}</span></div>
    <div style="align-self:center;"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();viewInvoice('${inv.id}')">👁</button></div>
  </div>`).join('');
}

function renderPayHistory(){
  const all=allPackages();
  const hcf=(document.getElementById('hist-client-fil')||{}).value||'';
  const hsf=(document.getElementById('hist-status-fil')||{}).value||'';
  const hcEl=document.getElementById('hist-client-fil');
  if(hcEl){const cur=hcEl.value;hcEl.innerHTML='<option value="">Wszyscy klienci</option>'+[...new Set(all.map(p=>p.clientName))].map(n=>'<option value="'+n+'"'+(n===cur?' selected':'')+'>'+n+'</option>').join('');}
  let res=all;
  if(hcf)res=res.filter(p=>p.clientName===hcf);
  if(hsf)res=res.filter(p=>p.payStatus===hsf);
  const el=document.getElementById('pay-history-list');
  if(!el)return;
  const today=new Date().toISOString().split('T')[0];
  el.innerHTML=res.map((p,i)=>{
    const isExpired=p.expiresDate&&p.expiresDate<today;
    const status=isExpired?'expired':p.payStatus;
    return `<div class="pay-hist-row" style="animation-delay:${i*0.03}s">
      <div><div style="font-size:13px;font-weight:600;">${p.title}</div><div style="font-size:11px;color:var(--muted);">${PKG_TYPE_LABEL[p.type]||p.type}</div></div>
      <div style="align-self:center;">${p.clientName}</div>
      <div style="align-self:center;color:var(--muted);">${p.date||'—'}</div>
      <div style="align-self:center;color:var(--muted);">${p.expiresDate||'—'}</div>
      <div style="align-self:center;font-weight:700;color:var(--accent);">${p.price.toLocaleString('pl')} zł</div>
      <div style="align-self:center;"><span class="pill ${PAY_STATUS_PILL[status]||'pill-muted'}" style="font-size:10px;">${PAY_STATUS_LABEL[status]||status}</span></div>
    </div>`;
  }).join('')||'<div style="padding:40px;text-align:center;color:var(--muted);">Brak wyników</div>';
}

async function savePackage(){
  if(window._saveGuard_savePackage)return;window._saveGuard_savePackage=true;setTimeout(()=>window._saveGuard_savePackage=false,1500);

  const title=document.getElementById('pkg-title').value.trim();
  if(!title){notify('Wpisz nazwę pakietu!');return;}
  const cid=document.getElementById('pkg-client').value;
  const c=CL.find(x=>x.id===cid);
  const price=parseInt(document.getElementById('pkg-price').value)||0;
  const sessions=parseInt(document.getElementById('pkg-sessions').value)||1;
  const validity=parseInt(document.getElementById('pkg-validity').value)||90;
  const date=document.getElementById('pkg-date').value||new Date().toISOString().split('T')[0];
  const expD=new Date(date);expD.setDate(expD.getDate()+validity);
  const invId=nextInvoiceNr();
  const pkg=withTrainer({
    id:newId('pkg'),title,
    type:document.getElementById('pkg-type').value,
    sessions,sessionsUsed:0,price,validity,
    clientId:cid,clientName:c?c.name:'Brak klienta',
    payStatus:document.getElementById('pkg-pay-status').value,
    date,expiresDate:expD.toISOString().split('T')[0],
    notes:document.getElementById('pkg-notes').value,
    invoiceId:invId
  });
  const inv=withTrainer({id:invId,nr:invId,pkgId:pkg.id,clientName:pkg.clientName,pkgTitle:title,date,amount:price,status:pkg.payStatus});
  window.PACKAGES.push(pkg);
  window.INVOICES.push(inv);
  await persistById('packages',pkg);
  await persistById('invoices',inv);
  closeM('m-package');
  if(payTab==='overview')renderPayOverview();
  else if(payTab==='packages')renderPayPackages();
  else if(payTab==='invoices')renderPayInvoices();
  const resumeId=window._onboardResumeAfterPackage||pkg.clientId;
  const fromOnboard=!!window._onboardResumeAfterPackage;
  window._onboardResumeAfterPackage=null;
  if(pkg.payStatus==='pending'&&pkg.clientId&&(fromOnboard||price>0)){
    if(confirm('Pakiet oczekuje na wpłatę. Wysłać prośbę o płatność do czatu klienta teraz?')){
      if(typeof requestPayment==='function')requestPayment(pkg.id);
    }
  }
  if(resumeId&&typeof maybeResumeOnboard==='function')maybeResumeOnboard(resumeId);
  if(typeof renderDash==='function')try{renderDash();}catch(e){}
  if(typeof renderClients==='function')try{renderClients();}catch(e){}
  if(typeof cpClientId!=='undefined'&&cpClientId===pkg.clientId&&typeof renderCPPayments==='function'){
    const cl=CL.find(x=>x.id===pkg.clientId);if(cl)try{renderCPPayments(cl);}catch(e){}
  }
  notify('✓ Pakiet "'+title+'" dodany! Faktura '+invId+' wygenerowana.');
}
var odTab='browse';var odWorkoutFilter='all';var odProgramFilter='all';
window.OD_WORKOUTS=[];

const OD_COLLECTIONS=[
  {id:'dom',name:'Dom bez sprzętu',icon:'🏠',color:'var(--blue)',desc:'Ćwiczenia w domu — zero sprzętu, follow-along YouTube',count:2},
  {id:'mobilnosc',name:'Mobilność',icon:'🧘',color:'var(--teal)',desc:'Stretching, mobilność i regeneracja',count:2},
  {id:'fbw',name:'Full Body',icon:'⚡',color:'var(--accent)',desc:'Programy angażujące całe ciało',count:1},
  {id:'hiit',name:'HIIT / Cardio',icon:'🔥',color:'var(--red)',desc:'Intensywne interwały, tabata i cardio',count:2},
  {id:'oddech',name:'Oddech i relaks',icon:'🌬',color:'var(--purple)',desc:'Box breathing, 4-7-8, oddech przeponowy — przed snem lub po treningu',count:5},
  {id:'sila',name:'Siła',icon:'💪',color:'var(--orange)',desc:'Treningi siłowe z obciążeniem',count:0},
];

const OD_DEMO_WORKOUTS=[
  {id:'ow1',name:'Full Body 30 min (HASfit)',type:'video',level:'sredni',time:30,coll:'fbw',format:'strength',equipment:'dumbbells',color:'#1a1a2e',emoji:'⚡',desc:'Darmowy trening całego ciała z hantlami. YouTube, bez subskrypcji.',url:'https://www.youtube.com/watch?v=445nEr4-uJM',views:0,likes:12,structure:{label:'Obwody',rounds:3,setsDesc:'3 obwody · ~12 powt. na ćwiczenie',materials:'Hantle (para), mata opcjonalnie'}},
  {id:'ow2',name:'HIIT 20 min — bez sprzętu (MadFit)',type:'video',level:'sredni',time:20,coll:'dom',format:'hiit',equipment:'none',color:'#1a0a0a',emoji:'🔥',desc:'Standing HIIT, bez powtórzeń, zero sprzętu. Darmowy follow-along na YouTube.',url:'https://www.youtube.com/watch?v=HhdYlniTjvg',views:0,likes:8,structure:{label:'Interwały',rounds:5,workSec:45,restSec:15,note:'5 rund · 45s praca / 15s przerwa · cardio'}},
  {id:'ow3',name:'Push Day — klatka, barki, triceps',type:'video',level:'sredni',time:20,coll:'sila',format:'strength',equipment:'dumbbells',color:'#0a1a0a',emoji:'💪',desc:'MadFit push w domu. Wklejony odcinek YouTube, nie kanał.',url:'https://www.youtube.com/watch?v=N6IzvFjybLc',views:0,likes:15,structure:{label:'Serie',setsDesc:'3–4 serie · 10–15 powt. · hantle',materials:'Hantle, ławka/oparcie opcjonalnie'}},
  {id:'ow4',name:'Pull Day — plecy (ATHLEAN-X)',type:'video',level:'sredni',time:12,coll:'sila',format:'strength',equipment:'none',color:'#0a0a1a',emoji:'🏋️',desc:'Darmowy film o treningu pleców. Odtwarzaj w portalu albo na YouTube.',url:'https://www.youtube.com/watch?v=OXvQe9payHw',views:0,likes:11,structure:{label:'Serie',setsDesc:'3 serie · technika + objętość',materials:'Drążek / gumy opcjonalnie'}},
  {id:'ow5',name:'Mobilność bioder 20 min',type:'video',level:'poczatkujacy',time:20,coll:'mobilnosc',format:'mobility',equipment:'mat',color:'#0a1a1a',emoji:'🧘',desc:'Yoga With Adriene — Feel Good Flow na biodra. Za darmo na YouTube.',url:'https://www.youtube.com/watch?v=zwoVcrdmLOE',views:0,likes:9,structure:{label:'Flow',durationMin:20,materials:'Mata, wygodny strój'}},
  {id:'ow6',name:'Lower Body — nogi i pośladki',type:'video',level:'sredni',time:20,coll:'dom',format:'strength',equipment:'none',color:'#1a1000',emoji:'🦵',desc:'MadFit, bez sprzętu. Darmowy follow-along na YouTube.',url:'https://www.youtube.com/watch?v=9hQTvrP6EsM',views:0,likes:14,structure:{label:'Obwód',rounds:3,setsDesc:'3 obwody · nogi i pośladki · bez sprzętu',materials:'Brak — własne ciało'}},
  {id:'ow7',name:'Stretch i elastyczność 28 min (Adriene)',type:'video',level:'poczatkujacy',time:28,coll:'mobilnosc',format:'stretch',equipment:'mat',color:'#0a1a1a',emoji:'🧘',desc:'Yoga With Adriene — pełny stretching w domu, bez sprzętu.',url:'https://www.youtube.com/watch?v=g_tea8ZNr5A',views:0,likes:10,structure:{label:'Stretch',durationMin:28,materials:'Mata'}},
  {id:'ow8',name:'Tabata 16 min — cardio (MadFit)',type:'video',level:'sredni',time:16,coll:'hiit',format:'tabata',equipment:'none',color:'#2a0a0a',emoji:'⏱',desc:'Klasyczna tabata 20s/10s × 8 rund na ćwiczenie. Zero sprzętu, follow-along YouTube.',url:'https://www.youtube.com/watch?v=XI0YfASj5gY',views:0,likes:6,structure:{label:'Tabata',rounds:8,workSec:20,restSec:10,note:'8 rund tabata · 20s praca / 10s przerwa · cardio'}},
  {id:'ow9',name:'Box breathing 4-4-4-4 — 5 min',type:'video',level:'poczatkujacy',time:5,coll:'oddech',format:'breath',equipment:'none',color:'#0a0a2a',emoji:'🌬',desc:'Technika Navy SEAL — wyrównuje układ nerwowy. Idealna przed snem lub po stresie.',url:'https://www.youtube.com/watch?v=tEmt1RCBKw0',views:0,likes:18,structure:{label:'Box 4-4-4-4',inhaleSec:4,holdInSec:4,exhaleSec:4,holdOutSec:4,cycles:8,note:'8 cykli · 4s wdech / 4s zatrzymanie / 4s wydech / 4s pauza · stres / sen',materials:'Wygodne siedzenie, cisza',when:'Po treningu, przed snem, stres'}},
  {id:'ow10',name:'Oddychanie 4-7-8 (Dr Weil) — 5 min',type:'video',level:'poczatkujacy',time:5,coll:'oddech',format:'breath',equipment:'none',color:'#1a0a2a',emoji:'😴',desc:'Klasyczna metoda relaksacyjna — wdech 4s, zatrzymanie 7s, wydech 8s. Uspokaja przed snem.',url:'https://www.youtube.com/watch?v=1Dv-ldGLsyg',views:0,likes:14,structure:{label:'4-7-8',inhaleSec:4,holdInSec:7,exhaleSec:8,cycles:4,note:'4 cykle · 4s wdech / 7s zatrzymanie / 8s wydech · bez pauzy między cyklami',materials:'Brak — język dotyka podniebienia przy wydechu',when:'Wieczorem, lęk, trudność z zasypianiem'}},
  {id:'ow11',name:'Oddech przeponowy — baza 8 min',type:'video',level:'poczatkujacy',time:8,coll:'oddech',format:'breath',equipment:'none',color:'#0a1a2a',emoji:'🫁',desc:'Oddychanie brzuszne — obniża tętno spoczynkowe i napięcie w klatce. Fundament pod inne metody.',url:'https://www.youtube.com/watch?v=0Ua9butB5nU',views:0,likes:11,structure:{label:'Przeponowy',inhaleSec:4,exhaleSec:6,cycles:10,note:'10 powtórzeń · wdech nosem (brzuch się unosi) · wydech ustami 6s',materials:'Leżenie lub siedzenie, ręka na brzuchu',when:'Regeneracja, ból pleców, rozgrzewka oddechowa'}},
  {id:'ow12',name:'Oddychanie spójne 5-5 — 6 min',type:'video',level:'poczatkujacy',time:6,coll:'oddech',format:'breath',equipment:'none',color:'#0a2a1a',emoji:'💚',desc:'Równy rytm ~6 oddechów/min (wdech 5s, wydech 5s) — wspiera HRV i spokój w ciągu dnia.',url:'https://www.youtube.com/watch?v=aNXKjGFUlMs',views:0,likes:9,structure:{label:'Spójne 5-5',inhaleSec:5,exhaleSec:5,cycles:12,note:'12 cykli · 5s wdech / 5s wydech · bez zatrzymania · ~6 oddechów/min',materials:'Brak',when:'Między spotkaniami, cooldown po cardio'}},
  {id:'ow13',name:'Wim Hof — wprowadzenie (początkujący) — 11 min',type:'video',level:'sredni',time:11,coll:'oddech',format:'breath',equipment:'none',color:'#0a1520',emoji:'❄️',desc:'Pierwsza sesja metody Wim Hofa z oficjalnym przewodnikiem. Nie w wannie, nie w wodzie — tylko oddech.',url:'https://www.youtube.com/watch?v=tybOi4hjZFQ',views:0,likes:22,structure:{label:'Wim Hof intro',rounds:3,note:'3 serie głębokich wdechów + wydech passively · retencja po wydechu · NIE w wodzie · unikaj przy ciąży/urazach',materials:'Mata/koc, miejsce do leżenia',when:'Rano na czczo (zaawansowani), NIE bez konsultacji przy schorzeniach'}},
  {id:'ow14',name:'Oddech przed treningiem — aktywacja 4 min',type:'video',level:'poczatkujacy',time:4,coll:'oddech',format:'breath',equipment:'none',color:'#1a1a0a',emoji:'⚡',desc:'Krótka sekwencja oddechowa przed siłownią — pobudza bez stresu jak kawa.',url:'https://www.youtube.com/watch?v=kwOTAl9NOnw',views:0,likes:7,structure:{label:'Pre-workout',inhaleSec:3,exhaleSec:3,cycles:15,note:'15 cykli · szybszy rytm 3s/3s · przez nos · przed rozgrzewką',materials:'Brak',when:'5 min przed Start treningu w apce'}},
];
window.OD_DEMO_WORKOUTS=OD_DEMO_WORKOUTS;

const OD_DEMO_PROGRAMS=[
  {id:'op2',name:'4 tygodnie Full Body — YouTube',category:'fbw',level:'poczatkujacy',duration:'4 tygodnie',status:'active',color:'linear-gradient(135deg,#1a1a2e,#2a1a0a)',emoji:'⚡',desc:'3 darmowe treningi w tygodniu z YouTube (HASfit, MadFit). Odtwarzaj w apce — bez subskrypcji.',clients:0,weeks:[
    {label:'Tydzień 1',days:[
      {label:'Dzień 1 — Full Body',workoutId:'ow1'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — HIIT',workoutId:'ow2'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Lower Body',workoutId:'ow6'},
    ]},
    {label:'Tydzień 2',days:[
      {label:'Dzień 1 — Push',workoutId:'ow3'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — Pull',workoutId:'ow4'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Mobilność',workoutId:'ow5'},
    ]},
  ]},
  {id:'op3',name:'Mobilność i regeneracja — 4 tygodnie',category:'mobilnosc',level:'poczatkujacy',duration:'4 tygodnie',status:'active',color:'linear-gradient(135deg,#0a1a1a,#0a2a2a)',emoji:'🧘',desc:'Stretching i mobilność w domu bez sprzętu — filmy YouTube (Adriene). Idealne między treningami siłowymi lub jako samodzielny reset.',clients:0,weeks:[
    {label:'Tydzień 1',days:[
      {label:'Dzień 1 — Mobilność bioder',workoutId:'ow5'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — Stretch całego ciała',workoutId:'ow7'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Mobilność bioder',workoutId:'ow5'},
    ]},
    {label:'Tydzień 2',days:[
      {label:'Dzień 1 — Stretch całego ciała',workoutId:'ow7'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — Mobilność bioder',workoutId:'ow5'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Stretch + oddech',workoutId:'ow10'},
    ]},
  ]},
  {id:'op5',name:'Regeneracja oddechowa — 2 tygodnie',category:'oddech',level:'poczatkujacy',duration:'2 tygodnie',status:'active',color:'linear-gradient(135deg,#1a0a2a,#0a1a2a)',emoji:'🌬',desc:'5 metod oddychania na zmianę — box, 4-7-8, przeponowy, spójny i przed treningiem. Krótkie sesje YouTube, zero sprzętu.',clients:0,weeks:[
    {label:'Tydzień 1',days:[
      {label:'Dzień 1 — Box 4-4-4-4',workoutId:'ow9'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — 4-7-8 (sen)',workoutId:'ow10'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Oddech przeponowy',workoutId:'ow11'},
    ]},
    {label:'Tydzień 2',days:[
      {label:'Dzień 1 — Spójne 5-5',workoutId:'ow12'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — Przed treningiem',workoutId:'ow14'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Box breathing',workoutId:'ow9'},
    ]},
  ]},
  {id:'op4',name:'Dom bez sprzętu — 4 tygodnie',category:'dom',level:'poczatkujacy',duration:'4 tygodnie',status:'active',color:'linear-gradient(135deg,#1a1000,#0a1a0a)',emoji:'🏠',desc:'Treningi w domu bez hantli i maszyn — HIIT i nogi z YouTube (MadFit). Zero sprzętu, start od zaraz.',clients:0,weeks:[
    {label:'Tydzień 1',days:[
      {label:'Dzień 1 — HIIT 20 min',workoutId:'ow2'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — Nogi i pośladki',workoutId:'ow6'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — HIIT 20 min',workoutId:'ow2'},
    ]},
    {label:'Tydzień 2',days:[
      {label:'Dzień 1 — Nogi i pośladki',workoutId:'ow6'},
      {label:'Dzień 2 — Regeneracja',rest:true},
      {label:'Dzień 3 — HIIT 20 min',workoutId:'ow2'},
      {label:'Dzień 4 — Regeneracja',rest:true},
      {label:'Dzień 5 — Nogi i pośladki',workoutId:'ow6'},
    ]},
  ]},
  {id:'op1',name:'Starting Strength — szkic',level:'poczatkujacy',duration:'4 tygodnie',color:'linear-gradient(135deg,#1a0a0a,#2a1a0a)',emoji:'🏋️',desc:'Szkic programu siłowego — dodaj filmy YouTube w panelu On-demand.',clients:0,status:'draft'},
];
window.OD_PROGRAMS=window.OD_PROGRAMS||[];
window.OD_PROGRESS=window.OD_PROGRESS||[];
function allODPrograms(){return window.OD_PROGRAMS&&window.OD_PROGRAMS.length?window.OD_PROGRAMS:OD_DEMO_PROGRAMS;}
function ensureODPrograms(){
  if(window.OD_PROGRAMS&&window.OD_PROGRAMS.length)return window.OD_PROGRAMS;
  window.OD_PROGRAMS=OD_DEMO_PROGRAMS.map(p=>JSON.parse(JSON.stringify(p)));
  return window.OD_PROGRAMS;
}
function odProgramWorkoutIds(prog){
  const ids=new Set();
  (prog&&prog.weeks||[]).forEach(w=>(w.days||[]).forEach(d=>{if(d.workoutId)ids.add(d.workoutId);}));
  return [...ids];
}
function odProgramWorkoutCount(prog){return odProgramWorkoutIds(prog).length;}
function odProgramSessionKey(progId,weekIdx,dayIdx){
  return String(progId||'')+':'+Number(weekIdx)+':'+Number(dayIdx);
}
function odProgramSessionTotal(prog){
  let n=0;
  (prog&&prog.weeks||[]).forEach(w=>(w.days||[]).forEach(d=>{if(!d.rest&&d.workoutId)n++;}));
  return n;
}
function odProgramProgressFor(clientId,progId){
  const cid=clientId||window._clientId||'';
  return (window.OD_PROGRESS||[]).find(p=>p.clientId===cid&&p.programId===progId)||null;
}
function odProgramDoneSet(clientId,progId){
  const rec=odProgramProgressFor(clientId,progId);
  return new Set((rec&&rec.done)||[]);
}
function odProgramProgressPct(clientId,prog){
  const total=odProgramSessionTotal(prog);
  if(!total)return 0;
  const done=odProgramDoneSet(clientId,prog.id);
  let n=0;
  (prog.weeks||[]).forEach((w,wi)=>(w.days||[]).forEach((d,di)=>{
    if(!d.rest&&d.workoutId&&done.has(odProgramSessionKey(prog.id,wi,di)))n++;
  }));
  return Math.round(n/total*100);
}
function odProgramProgressDocId(clientId,progId){
  return 'odpr_'+String(clientId||'').replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+String(progId||'');
}
function odProgramWeekWorkoutKeys(prog,weekIdx){
  const keys=[];
  const w=(prog&&prog.weeks||[])[weekIdx];
  if(!w)return keys;
  (w.days||[]).forEach((d,di)=>{if(!d.rest&&d.workoutId)keys.push(odProgramSessionKey(prog.id,weekIdx,di));});
  return keys;
}
function odProgramWeekComplete(clientId,prog,weekIdx){
  const keys=odProgramWeekWorkoutKeys(prog,weekIdx);
  if(!keys.length)return false;
  const done=odProgramDoneSet(clientId,prog.id);
  return keys.every(k=>done.has(k));
}
function odProgramNextSession(clientId,prog){
  if(!prog)return null;
  const done=odProgramDoneSet(clientId,prog.id);
  let found=null;
  (prog.weeks||[]).forEach((w,wi)=>(w.days||[]).forEach((d,di)=>{
    if(found||d.rest||!d.workoutId)return;
    const key=odProgramSessionKey(prog.id,wi,di);
    if(!done.has(key))found={prog,weekIdx:wi,dayIdx:di,day:d,key,workoutId:d.workoutId};
  }));
  return found;
}
function odProgramContinueForClient(clientId){
  if(typeof ensureODPrograms==='function')ensureODPrograms();
  if(typeof ensureODWorkouts==='function')ensureODWorkouts();
  const progs=allODPrograms().filter(p=>(typeof odProgramWorkoutCount==='function'?odProgramWorkoutCount(p)>0:p.status==='active')&&p.status!=='draft');
  let pick=null;
  let pickPct=-1;
  progs.forEach(p=>{
    const next=odProgramNextSession(clientId,p);
    if(!next)return;
    const pct=odProgramProgressPct(clientId,p);
    if(pct>=100)return;
    if(pct>0&&pct>=pickPct){pick=p;pickPct=pct;}
    else if(!pick&&pct===0)pick=p;
  });
  if(!pick)pick=progs.find(p=>{const n=odProgramNextSession(clientId,p);return n&&odProgramProgressPct(clientId,p)<100;})||null;
  if(!pick)return null;
  const next=odProgramNextSession(clientId,pick);
  if(!next)return null;
  const workout=allODWorkouts().find(x=>x.id===next.workoutId)||null;
  return {prog:pick,next,workout,pct:odProgramProgressPct(clientId,pick)};
}
function odProgramNotifyAfterToggle(clientId,progId,weekIdx,markedDone){
  if(!markedDone||typeof addNotification!=='function')return;
  const prog=allODPrograms().find(x=>x.id===progId);
  if(!prog)return;
  const c=(window.CL||[]).find(x=>x.id===clientId)||{name:'Klient'};
  const pct=odProgramProgressPct(clientId,prog);
  if(pct>=100){
    addNotification('system','Program on-demand ukończony',c.name+' · '+prog.name,'ondemand','odprog_done_'+clientId+'_'+progId);
    return;
  }
  if(odProgramWeekComplete(clientId,prog,weekIdx)){
    const wk=(prog.weeks||[])[weekIdx];
    addNotification('system','Tydzień programu on-demand',c.name+' · '+prog.name+' · '+(wk&&wk.label||('Tydzień '+(Number(weekIdx)+1))),'ondemand','odprog_week_'+clientId+'_'+progId+'_'+weekIdx);
  }
}
window.odProgramProgressDocId=odProgramProgressDocId;
window.odProgramWeekComplete=odProgramWeekComplete;
window.odProgramNextSession=odProgramNextSession;
window.odProgramContinueForClient=odProgramContinueForClient;
window.odProgramNotifyAfterToggle=odProgramNotifyAfterToggle;
function collectODProgramWeeksFromForm(){
  const weeks=[];
  document.querySelectorAll('#odp-weeks .odp-week').forEach(wEl=>{
    const label=(wEl.querySelector('.odp-week-label')||{}).value||'Tydzień';
    const days=[];
    wEl.querySelectorAll('.odp-day').forEach(dEl=>{
      const dlabel=(dEl.querySelector('.odp-day-label')||{}).value||'';
      const sel=dEl.querySelector('.odp-day-wo');
      const val=sel?sel.value:'';
      if(val==='rest')days.push({label:dlabel||'Regeneracja',rest:true});
      else if(val)days.push({label:dlabel||'',workoutId:val});
      else days.push({label:dlabel||'Dzień',rest:true});
    });
    weeks.push({label,days});
  });
  return weeks;
}
function odWorkoutSelectHtml(selected){
  const list=allODWorkouts();
  const cur=selected||'';
  return `<select class="form-select odp-day-wo" style="font-size:12px;">
    <option value="rest"${cur==='rest'||!cur?' selected':''}>🧘 Regeneracja</option>
    ${list.map(w=>`<option value="${escHtml(w.id)}"${cur===w.id?' selected':''}>▶ ${escHtml(w.name)}</option>`).join('')}
  </select>`;
}
function odProgramDayRowHtml(day){
  const d=day||{};
  const sel=d.rest?'rest':(d.workoutId||'rest');
  return `<div class="odp-day" style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center;">
    <input class="form-input odp-day-label" style="font-size:12px;" placeholder="Dzień 1 — Full Body" value="${escHtml(d.label||'')}">
    ${odWorkoutSelectHtml(sel)}
    <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.odp-day').remove()">×</button>
  </div>`;
}
function odProgramWeekHtml(week){
  const w=week||{label:'Tydzień',days:[{label:'Dzień 1',workoutId:''}]};
  return `<div class="odp-week" style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:10px;">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input class="form-input odp-week-label" style="font-size:13px;font-weight:600;" value="${escHtml(w.label||'Tydzień')}">
      <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.odp-week').remove()">Usuń tydzień</button>
    </div>
    <div class="odp-days">${(w.days&&w.days.length?w.days:[{label:'Dzień 1'}]).map(odProgramDayRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost btn-sm" onclick="odpAddDay(this)">+ Dzień</button>
  </div>`;
}
function renderODProgramWeeksEditor(weeks){
  const box=document.getElementById('odp-weeks');
  if(!box)return;
  const list=weeks&&weeks.length?weeks:[{label:'Tydzień 1',days:[{label:'Dzień 1 — Full Body',workoutId:''},{label:'Dzień 2 — Regeneracja',rest:true}]}];
  box.innerHTML=list.map(odProgramWeekHtml).join('');
}
function odpAddWeek(){
  const box=document.getElementById('odp-weeks');
  if(!box)return;
  const n=box.querySelectorAll('.odp-week').length+1;
  box.insertAdjacentHTML('beforeend',odProgramWeekHtml({label:'Tydzień '+n,days:[{label:'Dzień 1',workoutId:''}]}));
}
function odpAddDay(btn){
  const days=btn&&btn.parentElement&&btn.parentElement.querySelector('.odp-days');
  if(!days)return;
  const n=days.querySelectorAll('.odp-day').length+1;
  days.insertAdjacentHTML('beforeend',odProgramDayRowHtml({label:'Dzień '+n}));
}
window.odProgramSessionKey=odProgramSessionKey;
window.odProgramSessionTotal=odProgramSessionTotal;
window.odProgramProgressFor=odProgramProgressFor;
window.odProgramDoneSet=odProgramDoneSet;
window.odProgramProgressPct=odProgramProgressPct;
window.collectODProgramWeeksFromForm=collectODProgramWeeksFromForm;
window.renderODProgramWeeksEditor=renderODProgramWeeksEditor;
window.odpAddWeek=odpAddWeek;
window.odpAddDay=odpAddDay;
window.ensureODPrograms=ensureODPrograms;
window.odProgramWorkoutIds=odProgramWorkoutIds;
window.odProgramWorkoutCount=odProgramWorkoutCount;
function allODWorkouts(){
  if(window.OD_WORKOUTS&&window.OD_WORKOUTS.length)return window.OD_WORKOUTS;
  return OD_DEMO_WORKOUTS;
}
function odYoutubeId(url){
  const embed=typeof coachVideoEmbed==='function'?coachVideoEmbed(url):'';
  const m=String(embed||'').match(/embed\/([A-Za-z0-9_-]{11})/);
  return m?m[1]:'';
}
function odThumbUrl(w){
  const id=odYoutubeId(w&&w.url);
  return id?('https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'):'';
}
function odCanPlay(w){
  if(!w||!w.url)return false;
  if(typeof coachVideoEmbed==='function'&&coachVideoEmbed(w.url))return true;
  if(typeof coachVideoIsFile==='function'&&coachVideoIsFile(w.url))return true;
  return /^https?:\/\//i.test(String(w.url||''));
}
const OD_FORMAT_LABELS={hiit:'🔥 HIIT',tabata:'⏱ Tabata',intervals:'⚡ Interwały',cardio:'❤️ Cardio',mobility:'🧘 Mobilność',stretch:'🤸 Stretch',strength:'💪 Siła',breath:'🌬 Oddychanie'};
const OD_EQUIP_LABELS={none:'Bez sprzętu',dumbbells:'Hantle',mat:'Mata',bands:'Gumy'};
function odWorkoutFormatLabel(w){return OD_FORMAT_LABELS[w&&w.format]||'🏋️ Trening';}
function odWorkoutEquipmentLabel(w){return OD_EQUIP_LABELS[w&&w.equipment]||'';}
function odWorkoutStructureText(w){
  const s=w&&w.structure;
  if(!s)return '';
  if(s.note&&!s.inhaleSec)return s.note;
  if(s.inhaleSec&&s.exhaleSec){
    let t='Wdech '+s.inhaleSec+'s';
    if(s.holdInSec)t+=' · zatrzymanie '+s.holdInSec+'s';
    t+=' · wydech '+s.exhaleSec+'s';
    if(s.holdOutSec)t+=' · pauza '+s.holdOutSec+'s';
    if(s.cycles)t+=' · '+s.cycles+' cykli';
    if(s.when)t+=' · '+s.when;
    return t;
  }
  if(s.note)return s.note;
  if(s.setsDesc)return s.setsDesc;
  if(s.durationMin)return s.durationMin+' min ciągłej pracy';
  if(s.rounds&&s.workSec&&s.restSec)return s.rounds+' rund · '+s.workSec+'s praca / '+s.restSec+'s przerwa';
  if(s.rounds)return s.rounds+' obwodów';
  return s.label||'';
}
function odWorkoutMaterialsText(w){
  const s=w&&w.structure;
  if(s&&s.materials)return s.materials;
  const eq=odWorkoutEquipmentLabel(w);
  return eq||'';
}
function odWorkoutMetaChipsHTML(w){
  const chips=[odWorkoutFormatLabel(w)];
  const eq=odWorkoutEquipmentLabel(w);
  if(eq)chips.push(eq);
  if(w&&w.time)chips.push(String(w.time)+' min');
  const st=odWorkoutStructureText(w);
  if(st)chips.push(st);
  return chips.map(c=>`<span class="pill pill-muted" style="font-size:9px;">${escHtml(c)}</span>`).join('');
}
function assignHomeworkToClient(clientId,workoutId,opts){
  opts=opts||{};
  if(typeof ensureODWorkouts==='function')ensureODWorkouts();
  const w=(typeof allODWorkouts==='function'?allODWorkouts():OD_DEMO_WORKOUTS).find(x=>x.id===workoutId);
  if(!w){if(typeof notify==='function')notify('Nie znaleziono treningu');return null;}
  const c=(window.CL||[]).find(x=>x.id===clientId);
  if(!c){if(typeof notify==='function')notify('Wybierz klienta');return null;}
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  const t=(typeof withTrainer==='function'?withTrainer:x=>x)({
    id:typeof newId==='function'?newId('t'):('t_'+Date.now()),
    kind:'homework',
    odWorkoutId:workoutId,
    title:opts.title||w.name,
    desc:opts.desc||w.desc||'',
    clientId,
    cat:'trening',
    priority:opts.priority||'medium',
    due:opts.due||today,
    status:'open',
    createdAt:new Date().toISOString()
  });
  window.TASKS=window.TASKS||[];
  window.TASKS.push(t);
  if(typeof persistById==='function')persistById('tasks',t);
  if(opts.notify!==false&&typeof notify==='function')notify('✓ Zadanie domowe: '+c.name+' · '+t.title);
  if(typeof pushMsg==='function'){
    pushMsg(clientId,'[od:'+workoutId+']\n🏠 Zadanie domowe od trenera: "'+t.title+'"\n'+odWorkoutStructureText(w)+(odWorkoutMaterialsText(w)?'\nMateriały: '+odWorkoutMaterialsText(w):''));
  }
  try{if(typeof renderTasks==='function')renderTasks();}catch(e){}
  try{if(typeof renderDashHwFollowup==='function')renderDashHwFollowup();}catch(e){}
  if(typeof cpClientId!=='undefined'&&cpClientId===clientId){try{if(typeof setCPTab==='function')setCPTab('tasks');}catch(e){}}
  return t;
}

function remindHomework(taskId){
  const t=(window.TASKS||[]).find(x=>x&&x.id===taskId);
  if(!t||!isHomework(t)){if(typeof notify==='function')notify('Nie znaleziono zadania domowego');return false;}
  if(t.status==='done'){if(typeof notify==='function')notify('Zadanie jest już zaliczone');return false;}
  const title=t.title||'Zadanie domowe';
  const msg=t.odWorkoutId
    ?('[od:'+t.odWorkoutId+']\n🏠 Przypomnienie: zadanie domowe "'+title+'" — odpal w zakładce Domowe.')
    :('🏠 Przypomnienie: zadanie domowe "'+title+'" — odpal w zakładce Domowe.');
  if(typeof pushMsg==='function')pushMsg(t.clientId,msg);
  t.remindedAt=new Date().toISOString();
  if(typeof persistById==='function')persistById('tasks',t);
  if(typeof addNotification==='function'){
    const c=(window.CL||[]).find(x=>x.id===t.clientId);
    addNotification('task','Przypomnienie — zadanie domowe',((c&&c.name)||'Klient')+' · '+title,'tasks');
  }
  if(typeof notify==='function')notify('✓ Przypomnienie poszło do czatu klienta');
  try{if(typeof renderDashHwFollowup==='function')renderDashHwFollowup();}catch(e){}
  return true;
}
window.remindHomework=remindHomework;

function remindHabit(taskId){
  const t=(window.TASKS||[]).find(x=>x&&x.id===taskId);
  if(!t||!(isHabit(t)||isChallenge(t))){if(typeof notify==='function')notify('Nie znaleziono nawyku / wyzwania');return false;}
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  if(habitDoneOn(t,today)){if(typeof notify==='function')notify('Już odhaczone dziś');return false;}
  if(isChallenge(t)){
    const p=typeof challengeProgress==='function'?challengeProgress(t,today):null;
    if(p&&(p.won||!p.active)){if(typeof notify==='function')notify(p.won?'Wyzwanie ukończone':'Wyzwanie nieaktywne');return false;}
  }
  const title=t.title||(isChallenge(t)?'Wyzwanie':'Nawyk');
  const streak=isHabit(t)&&typeof habitStreak==='function'?habitStreak(t,today):0;
  const msg=isChallenge(t)
    ?('🏆 Przypomnienie: wyzwanie "'+title+'" — odhacz dziś w zakładce Dziś.')
    :('🔥 Przypomnienie: nawyk "'+title+'"'+(streak?' (seria '+streak+')':'')+' — odhacz dziś w aplikacji.');
  if(typeof pushMsg==='function')pushMsg(t.clientId,msg);
  t.remindedAt=new Date().toISOString();
  if(typeof persistById==='function')persistById('tasks',t);
  if(typeof addNotification==='function'){
    const c=(window.CL||[]).find(x=>x.id===t.clientId);
    addNotification('task',isChallenge(t)?'Przypomnienie — wyzwanie':'Przypomnienie — nawyk',((c&&c.name)||'Klient')+' · '+title,'tasks');
  }
  if(typeof notify==='function')notify('✓ Przypomnienie poszło do czatu klienta');
  try{if(typeof renderDashHabitFollowup==='function')renderDashHabitFollowup();}catch(e){}
  return true;
}
window.remindHabit=remindHabit;

function openAssignHomeworkModal(workoutId,clientId){
  window._assignHwWorkoutId=workoutId||null;
  let m=document.getElementById('m-assign-homework');
  if(!m){
    m=document.createElement('div');
    m.id='m-assign-homework';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:440px;">
      <div class="modal-hdr"><div class="modal-title">PRZYPISZ ZADANIE DOMOWE</div><button class="modal-close" onclick="closeM('m-assign-homework')">×</button></div>
      <div class="modal-body">
        <div id="ahw-preview" style="background:var(--s3);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;line-height:1.5;"></div>
        <div class="form-field" style="position:relative;">
          <label class="form-lbl">Klient</label>
          <input class="form-select" id="ahw-client-search" placeholder="Wpisz imię..." autocomplete="off" oninput="ahwClientSearchInput()" onfocus="ahwClientSearchInput()">
          <input type="hidden" id="ahw-client">
          <div id="ahw-client-results" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--s2);border:1px solid var(--border2);border-radius:8px;margin-top:4px;max-height:200px;overflow-y:auto;"></div>
        </div>
        <div class="form-field"><label class="form-lbl">Termin (opcjonalnie)</label><input type="date" class="form-input" id="ahw-due"></div>
        <div class="form-field"><label class="form-lbl">Notatka dla klienta</label><textarea class="form-select" id="ahw-note" rows="2" style="resize:none;" placeholder="np. Wykonaj po treningu siłowym"></textarea></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeM('m-assign-homework')">Anuluj</button><button class="btn btn-primary" onclick="saveAssignHomework()">🏠 Przypisz</button></div>
    </div>`;
    document.body.appendChild(m);
  }
  const w=(typeof allODWorkouts==='function'?allODWorkouts():[]).find(x=>x.id===workoutId);
  const prev=document.getElementById('ahw-preview');
  if(prev&&w){
    prev.innerHTML=`<div style="font-weight:700;margin-bottom:6px;">${escHtml(w.emoji||'🏠')} ${escHtml(w.name)}</div>
      <div style="color:var(--muted);margin-bottom:8px;">${escHtml(w.desc||'')}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;">${odWorkoutMetaChipsHTML(w)}</div>`;
  }
  const hid=document.getElementById('ahw-client');
  const search=document.getElementById('ahw-client-search');
  const cl=clientId?(window.CL||[]).find(x=>x.id===clientId):null;
  if(hid)hid.value=clientId||'';
  if(search)search.value=cl?cl.name:'';
  const due=document.getElementById('ahw-due');
  if(due)due.value=typeof todayYmd==='function'?todayYmd():'';
  const note=document.getElementById('ahw-note');
  if(note)note.value='';
  openM('m-assign-homework');
}
function ahwClientSearchInput(){
  const q=(document.getElementById('ahw-client-search')||{}).value||'';
  const el=document.getElementById('ahw-client-results');
  const hid=document.getElementById('ahw-client');
  if(!el)return;
  const ql=q.trim().toLowerCase();
  const list=(window.CL||[]).filter(c=>c.status!=='archived'&&(!ql||String(c.name||'').toLowerCase().includes(ql))).slice(0,12);
  if(!list.length){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=list.map(c=>`<div style="padding:10px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);" onclick="ahwPickClient('${escHtml(c.id)}','${escHtml(c.name||'')}')">${escHtml(c.name)}</div>`).join('');
  if(!ql&&hid)hid.value='';
}
function ahwPickClient(id,name){
  const hid=document.getElementById('ahw-client');
  const search=document.getElementById('ahw-client-search');
  const el=document.getElementById('ahw-client-results');
  if(hid)hid.value=id;
  if(search)search.value=name;
  if(el)el.style.display='none';
}
function saveAssignHomework(){
  const wid=window._assignHwWorkoutId;
  const cid=(document.getElementById('ahw-client')||{}).value;
  if(!wid){if(typeof notify==='function')notify('Brak treningu');return;}
  if(!cid){if(typeof notify==='function')notify('Wybierz klienta');return;}
  assignHomeworkToClient(cid,wid,{due:(document.getElementById('ahw-due')||{}).value||'',desc:(document.getElementById('ahw-note')||{}).value||''});
  closeM('m-assign-homework');
}
function openHomeworkPickerForClient(clientId){
  window._assignHwClientId=clientId;
  let m=document.getElementById('m-homework-picker');
  if(!m){
    m=document.createElement('div');
    m.id='m-homework-picker';m.className='modal-ov';
    m.innerHTML=`<div class="modal modal-wide">
      <div class="modal-hdr"><div class="modal-title">WYBIERZ TRENING DOMOWY</div><button class="modal-close" onclick="closeM('m-homework-picker')">×</button></div>
      <div class="modal-body" id="m-homework-picker-body" style="max-height:60vh;overflow-y:auto;"></div>
    </div>`;
    document.body.appendChild(m);
  }
  const body=document.getElementById('m-homework-picker-body');
  const list=(typeof allODWorkouts==='function'?allODWorkouts():OD_DEMO_WORKOUTS).slice();
  if(body){
    body.innerHTML=list.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">${list.map((w,i)=>`<div style="background:var(--s2);border:1px solid var(--border2);border-radius:12px;padding:12px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${escHtml(w.emoji||'🏠')} ${escHtml(w.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.4;">${escHtml(w.desc||'')}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">${odWorkoutMetaChipsHTML(w)}</div>
      <button type="button" class="btn btn-primary btn-sm" style="width:100%;" onclick="assignHomeworkToClient('${escHtml(clientId)}','${escHtml(w.id)}');closeM('m-homework-picker');">Przypisz</button>
    </div>`).join('')}</div>`:`<div style="text-align:center;padding:40px;color:var(--muted);">Brak treningów w bibliotece On-demand.</div>`;
  }
  openM('m-homework-picker');
}
window.odWorkoutFormatLabel=odWorkoutFormatLabel;
window.odWorkoutEquipmentLabel=odWorkoutEquipmentLabel;
window.odWorkoutStructureText=odWorkoutStructureText;
window.odWorkoutMaterialsText=odWorkoutMaterialsText;
window.odWorkoutMetaChipsHTML=odWorkoutMetaChipsHTML;
window.assignHomeworkToClient=assignHomeworkToClient;
window.remindHomework=remindHomework;
window.remindHabit=remindHabit;
window.openAssignHomeworkModal=openAssignHomeworkModal;
window.openHomeworkPickerForClient=openHomeworkPickerForClient;
window.ahwClientSearchInput=ahwClientSearchInput;
window.ahwPickClient=ahwPickClient;
window.saveAssignHomework=saveAssignHomework;
function ensureODWorkouts(){
  if(window.OD_WORKOUTS&&window.OD_WORKOUTS.length)return window.OD_WORKOUTS;
  window.OD_WORKOUTS=OD_DEMO_WORKOUTS.map(w=>Object.assign({},w));
  return window.OD_WORKOUTS;
}
function migrateODYoutubeWorkouts(){
  const demoById={};const demoByName={};
  OD_DEMO_WORKOUTS.forEach(d=>{demoById[d.id]=d;demoByName[String(d.name||'').toLowerCase()]=d;});
  let n=0;
  ensureODWorkouts().forEach(w=>{
    const playable=typeof coachVideoEmbed==='function'&&coachVideoEmbed(w.url);
    if(playable)return;
    const demo=demoById[w.id]||demoByName[String(w.name||'').toLowerCase()];
    if(!demo||!demo.url)return;
    w.url=demo.url;
    w.type='video';
    if(demo.time)w.time=demo.time;
    if(demo.desc)w.desc=demo.desc;
    n++;
    if(typeof persistById==='function')persistById('odWorkouts',w);
  });
  return n;
}
window.allODWorkouts=allODWorkouts;
window.odYoutubeId=odYoutubeId;
window.odThumbUrl=odThumbUrl;
window.ensureODWorkouts=ensureODWorkouts;
window.migrateODYoutubeWorkouts=migrateODYoutubeWorkouts;

const LEVEL_MAP={poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'};

function odProgramsForCollection(collId){
  const progs=allODPrograms().filter(p=>p.status!=='draft'&&odProgramWorkoutCount(p)>0);
  if(!collId||collId==='all')return progs;
  if(['dom','mobilnosc','fbw'].includes(collId))return progs.filter(p=>p.category===collId);
  const allW=allODWorkouts();
  return progs.filter(p=>odProgramWorkoutIds(p).some(wid=>{
    const w=allW.find(x=>x.id===wid);
    return w&&w.coll===collId;
  }));
}
window.odProgramsForCollection=odProgramsForCollection;

function setODTab(t){
  ensureODWorkouts();
  migrateODYoutubeWorkouts();
  if(t==='workouts')t='programs';
  odTab=t;
  ['browse','programs','settings'].forEach(tab=>{
    const v=document.getElementById('odtab-'+tab+'-view');
    if(v)v.style.display=tab===t?'block':'none';
    const btn=document.getElementById('odtab-'+tab);
    if(btn)btn.classList.toggle('active',tab===t);
  });
  const addBtn=document.getElementById('od-add-btn');
  if(addBtn){
    if(t==='programs'){addBtn.textContent='+ Nowy program';addBtn.onclick=()=>openODProgramModal();}
    else{addBtn.textContent='+ Dodaj film';addBtn.onclick=()=>openM('m-od-workout');}
  }
  if(t==='browse')renderODBrowse();
  if(t==='programs')renderODPrograms();
}

function renderODBrowse(){
  const allW=allODWorkouts();
  const activeProgs=odProgramsForCollection('all');
  const sc=document.getElementById('od-stat-clients');if(sc)sc.textContent=CL.length;
  const sw=document.getElementById('od-stat-workouts');if(sw)sw.textContent=allW.length;
  const sp=document.getElementById('od-stat-programs');if(sp)sp.textContent=activeProgs.length;

  const cg=document.getElementById('od-collections-grid');
  if(cg)cg.innerHTML=OD_COLLECTIONS.map((c,i)=>{
    const progN=odProgramsForCollection(c.id).length;
    const woN=allW.filter(w=>w.coll===c.id).length;
    const cntLabel=progN?`${progN} program${progN===1?'':'ów'}`:`${woN} film${woN===1?'':'ów'}`;
    return `<div class="od-coll-card" style="animation-delay:${i*0.05}s;border-top:3px solid ${c.color};" onclick="setODTab('programs');odProgramFilter='${c.id}';renderODPrograms()">
      <div style="font-size:28px;margin-bottom:8px;">${c.icon}</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${c.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${c.desc}</div>
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);margin-top:8px;">${cntLabel}</div>
    </div>`;
  }).join('');

  const pg=document.getElementById('od-programs-grid');
  if(pg)pg.innerHTML=activeProgs.slice(0,6).map((p,i)=>odProgramCardHTML(p,i)).join('');
}

function renderODWorkouts(){
  const allW=allODWorkouts();
  // filters
  const fEl=document.getElementById('od-workout-filters');
  if(fEl){
    const filters=[{id:'all',label:'Wszystkie'},
      ...OD_COLLECTIONS.map(c=>({id:c.id,label:c.icon+' '+c.name})),
      {id:'poczatkujacy',label:'Początkujący'},{id:'sredni',label:'Średni'},{id:'zaawansowany',label:'Zaawansowany'}];
    fEl.innerHTML=filters.map(f=>`<button class="wl-filter-chip${odWorkoutFilter===f.id?' active':''}" onclick="odWorkoutFilter='${f.id}';renderODWorkouts()">${f.label}</button>`).join('');
  }
  let res=allW;
  if(odWorkoutFilter!=='all'){
    if(['poczatkujacy','sredni','zaawansowany'].includes(odWorkoutFilter))res=allW.filter(w=>w.level===odWorkoutFilter);
    else res=allW.filter(w=>w.coll===odWorkoutFilter);
  }
  const g=document.getElementById('od-all-workouts-grid');
  if(!g)return;
  g.innerHTML=res.length?res.map((w,i)=>odWorkoutCardHTML(w,i)).join('')
    :`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">▶️</div><div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak treningów</div><button class="btn btn-primary" onclick="openM('m-od-workout')">+ Dodaj trening</button></div>`;
}

function renderODPrograms(){
  const g=document.getElementById('od-all-programs-grid');
  if(!g)return;
  let list=odProgramsForCollection(odProgramFilter||'all');
  const fEl=document.getElementById('od-program-filters');
  if(fEl){
    const filters=[{id:'all',label:'Wszystkie programy'},
      ...OD_COLLECTIONS.filter(c=>odProgramsForCollection(c.id).length).map(c=>({id:c.id,label:c.icon+' '+c.name}))];
    fEl.innerHTML=filters.map(f=>`<button class="wl-filter-chip${(odProgramFilter||'all')===f.id?' active':''}" onclick="odProgramFilter='${f.id}';renderODPrograms()">${f.label}</button>`).join('');
  }
  g.innerHTML=(list.length?list.map((p,i)=>odProgramCardHTML(p,i)).join(''):`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">📋</div><div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak programów w tej kolekcji</div><button class="btn btn-primary" onclick="odProgramFilter='all';renderODPrograms()">Pokaż wszystkie</button></div>`)
    +`<div style="border:1px dashed var(--border2);border-radius:var(--r2);padding:18px;display:flex;align-items:center;justify-content:center;min-height:180px;cursor:pointer;background:transparent;" onclick="openODProgramModal()"><div style="text-align:center;color:var(--muted);"><div style="font-size:32px;margin-bottom:8px;">+</div><div style="font-size:13px;font-weight:600;">Nowy program on-demand</div><div style="font-size:11px;margin-top:4px;">Klienci startują sami</div></div></div>`;
}

function odWorkoutCardHTML(w,i){
  const coll=OD_COLLECTIONS.find(c=>c.id===w.coll);
  const collColor=coll?coll.color:'var(--muted)';
  const thumb=odThumbUrl(w);
  const bg=thumb
    ?`background-image:url('${escHtml(thumb)}');background-size:cover;background-position:center;`
    :`background:linear-gradient(135deg,${w.color||'var(--s3)'},var(--s3));`;
  const yt=odCanPlay(w);
  return `<div class="od-workout-card" style="animation-delay:${i*0.04}s" onclick="openODWorkout('${escHtml(w.id)}')">
    <div class="od-thumb" style="${bg}">
      <div class="od-thumb-label">${escHtml(LEVEL_MAP[w.level]||w.level||'')}</div>
      ${thumb?'':`<div style="font-size:40px;opacity:0.3;position:absolute;">${escHtml(w.emoji||'▶️')}</div>`}
      <div class="od-play-btn">▶</div>
      <div class="od-thumb-time">${escHtml(String(w.time||'?'))} min</div>
    </div>
    <div style="padding:12px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${escHtml(w.name||'')}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.4;">${escHtml(w.desc||'')}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
        ${coll?`<span class="pill" style="background:${collColor}22;color:${collColor};font-size:9px;">${coll.icon} ${escHtml(coll.name)}</span>`:''}
        ${typeof odWorkoutMetaChipsHTML==='function'?odWorkoutMetaChipsHTML(w):''}
        <span class="pill pill-muted" style="font-size:9px;">${yt?'▶️ YouTube':w.type==='audio'?'🎧 Audio':'🏋️ Plan'}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm" style="flex:1;" type="button" onclick="openODWorkout('${escHtml(w.id)}')">▶ Odtwórz</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openAssignHomeworkModal('${escHtml(w.id)}')">🏠 Klientowi</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="shareODWorkout('${escHtml(w.id)}')">↗</button>
      </div>
    </div>
  </div>`;
}

function odProgramCardHTML(p,i){
  const ytN=odProgramWorkoutCount(p);
  return `<div class="od-prog-card" style="animation-delay:${i*0.05}s;${ytN?'cursor:pointer;':''}" ${ytN?`onclick="openODProgramClient('${escHtml(p.id)}')"`:''}>
    <div class="od-prog-thumb" style="background:${p.color||'var(--s3)'};">
      <div style="font-size:36px;opacity:0.25;position:absolute;top:10px;right:10px;">${p.emoji||'🏋️'}</div>
      <div>
        <span style="background:rgba(0,0,0,0.6);color:${p.status==='draft'?'var(--orange)':'var(--accent)'};font-size:10px;font-family:'DM Mono',monospace;padding:2px 8px;border-radius:4px;margin-right:6px;">${p.status==='draft'?'DRAFT':'AKTYWNY'}</span>
        <span style="background:rgba(0,0,0,0.6);color:#fff;font-size:10px;font-family:'DM Mono',monospace;padding:2px 8px;border-radius:4px;">${escHtml(p.duration||'')}</span>
        ${ytN?`<span style="background:rgba(0,0,0,0.6);color:#fff;font-size:10px;font-family:'DM Mono',monospace;padding:2px 8px;border-radius:4px;margin-left:6px;">${ytN}× YouTube</span>`:''}
      </div>
    </div>
    <div style="padding:14px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${escHtml(p.name)}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:10px;">${escHtml(p.desc||'')}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Poziom: <strong>${LEVEL_MAP[p.level]||escHtml(p.level||'—')}</strong></div>
      <div style="display:flex;gap:6px;" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" style="flex:1;" type="button" onclick="openODProgramModal('${escHtml(p.id)}')">Edytuj</button>
        ${ytN?`<button class="btn btn-primary btn-sm" style="flex:1;" type="button" onclick="openODProgramClient('${escHtml(p.id)}')">Podgląd klienta</button>`:`<button class="btn btn-primary btn-sm" style="flex:1;" type="button" onclick="shareODProgram('${escHtml(p.id)}')">Udostępnij</button>`}
        <button class="btn btn-ghost btn-sm" type="button" onclick="shareODProgram('${escHtml(p.id)}')">↗</button>
      </div>
    </div>
  </div>`;
}

function openODProgramModal(id){
  window._editingODProgId=id||null;
  let m=document.getElementById('m-od-program');
  if(!m){
    m=document.createElement('div');
    m.id='m-od-program';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:520px;">
      <div class="modal-hdr"><div class="modal-title" id="odp-modal-title">NOWY PROGRAM ON-DEMAND</div><button class="modal-close" onclick="closeM('m-od-program')">×</button></div>
      <div class="modal-body">
        <div class="form-field"><label class="form-lbl">Nazwa</label><input type="text" class="form-input" id="odp-name" placeholder="np. Starting Strength 4 tyg."></div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Poziom</label>
            <select class="form-select" id="odp-level">
              <option value="poczatkujacy">Początkujący</option>
              <option value="sredni" selected>Średni</option>
              <option value="zaawansowany">Zaawansowany</option>
            </select>
          </div>
          <div class="form-field"><label class="form-lbl">Czas trwania</label><input type="text" class="form-input" id="odp-duration" placeholder="np. 8 tygodni" value="4 tygodnie"></div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label class="form-lbl">Status</label>
            <select class="form-select" id="odp-status">
              <option value="draft">Draft</option>
              <option value="active">Aktywny</option>
            </select>
          </div>
          <div class="form-field"><label class="form-lbl">Emoji</label><input type="text" class="form-input" id="odp-emoji" value="🏋️" maxlength="4"></div>
        </div>
        <div class="form-field"><label class="form-lbl">Opis</label><textarea class="form-textarea" id="odp-desc" rows="3" placeholder="Opis programu dla klientów..."></textarea></div>
        <div class="form-field">
          <label class="form-lbl">Tygodnie i dni YouTube</label>
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Przypisz darmowy trening (watch?v=…) albo regenerację. Klient odhacza dni w apce.</div>
          <div id="odp-weeks"></div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="odpAddWeek()">+ Tydzień</button>
        </div>
      </div>
      <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" id="odp-delete-btn" style="display:none;margin-right:auto;color:var(--red);" onclick="deleteODProgram()">Usuń</button>
        <button class="btn btn-ghost" onclick="closeM('m-od-program')">Anuluj</button>
        <button class="btn btn-primary" onclick="saveODProgram()">Zapisz</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
  }
  const p=id?(window.OD_PROGRAMS||[]).find(x=>x.id===id)||OD_DEMO_PROGRAMS.find(x=>x.id===id):null;
  document.getElementById('odp-modal-title').textContent=p?'EDYTUJ PROGRAM':'NOWY PROGRAM ON-DEMAND';
  document.getElementById('odp-name').value=p?.name||'';
  document.getElementById('odp-level').value=p?.level||'sredni';
  document.getElementById('odp-duration').value=p?.duration||'4 tygodnie';
  document.getElementById('odp-status').value=p?.status||'draft';
  document.getElementById('odp-emoji').value=p?.emoji||'🏋️';
  document.getElementById('odp-desc').value=p?.desc||'';
  renderODProgramWeeksEditor(p&&p.weeks);
  const del=document.getElementById('odp-delete-btn');
  if(del)del.style.display=(p&&window.OD_PROGRAMS.some(x=>x.id===p.id))?'inline-flex':'none';
  openM('m-od-program');
}

async function saveODProgram(){
  const name=document.getElementById('odp-name')?.value.trim();
  if(!name){notify('Wpisz nazwę programu!');return;}
  const weeks=collectODProgramWeeksFromForm();
  const editingId=window._editingODProgId;
  let prog;
  if(editingId){
    prog=(window.OD_PROGRAMS||[]).find(x=>x.id===editingId);
    if(!prog){
      prog=withTrainer({id:editingId,name,level:document.getElementById('odp-level').value,duration:document.getElementById('odp-duration').value.trim()||'4 tygodnie',status:document.getElementById('odp-status').value,emoji:document.getElementById('odp-emoji').value||'🏋️',desc:document.getElementById('odp-desc').value.trim(),color:'linear-gradient(135deg,#1a0a0a,#2a1a0a)',clients:0,weeks,createdAt:new Date().toISOString()});
      window.OD_PROGRAMS.push(prog);
    }else{
      prog.name=name;
      prog.level=document.getElementById('odp-level').value;
      prog.duration=document.getElementById('odp-duration').value.trim()||prog.duration;
      prog.status=document.getElementById('odp-status').value;
      prog.emoji=document.getElementById('odp-emoji').value||'🏋️';
      prog.desc=document.getElementById('odp-desc').value.trim();
      prog.weeks=weeks;
      prog.updatedAt=new Date().toISOString();
      withTrainer(prog);
    }
  }else{
    prog=withTrainer({
      id:newId('op'),name,
      level:document.getElementById('odp-level').value,
      duration:document.getElementById('odp-duration').value.trim()||'4 tygodnie',
      status:document.getElementById('odp-status').value,
      emoji:document.getElementById('odp-emoji').value||'🏋️',
      desc:document.getElementById('odp-desc').value.trim(),
      color:'linear-gradient(135deg,#1a0a0a,#2a1a0a)',
      clients:0,
      weeks,
      createdAt:new Date().toISOString()
    });
    window.OD_PROGRAMS.push(prog);
  }
  await persistById('odPrograms',prog);
  closeM('m-od-program');
  renderODPrograms();
  if(odTab==='browse')renderODBrowse();
  notify('✓ Program "'+name+'" zapisany'+(odProgramWorkoutCount(prog)?' · '+odProgramWorkoutCount(prog)+' treningów YouTube':''));
}

async function deleteODProgram(){
  const id=window._editingODProgId;if(!id)return;
  if(!confirm('Usunąć ten program?'))return;
  window.OD_PROGRAMS=(window.OD_PROGRAMS||[]).filter(x=>x.id!==id);
  if(window._db){try{await window._del(window._doc(window._db,'odPrograms',id));}catch(e){}}
  closeM('m-od-program');
  renderODPrograms();
  notify('Program usunięty');
}
window.openODProgramModal=openODProgramModal;
window.saveODProgram=saveODProgram;
window.deleteODProgram=deleteODProgram;
window.allODPrograms=allODPrograms;

function shareODWorkout(id){
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  const w=allODWorkouts().find(x=>x.id===id);
  if(!w){notify('Nie znaleziono treningu');return;}
  if(!confirm('Udostępnić trening "'+w.name+'" wszystkim klientom ('+CL.length+')?'))return;
  const link=w.url||'(brak URL wideo)';
  const tag='[od:'+id+']';
  CL.forEach(c=>pushMsg(c.id,tag+'\n▶️ Nowy trening on-demand: "'+w.name+'"\n'+link+(w.desc?'\n'+w.desc:'')));
  notify('✓ Trening "'+w.name+'" wysłany do '+CL.length+' klientów (Inbox)');
}

function odPlayerHtml(w,extraWrapClass){
  const embed=typeof coachVideoEmbed==='function'?coachVideoEmbed(w.url):'';
  const file=typeof coachVideoIsFile==='function'&&coachVideoIsFile(w.url);
  const safeUrl=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(w.url):String(w.url||'');
  const wrapCls='od-player-wrap'+(extraWrapClass?' '+extraWrapClass:'');
  if(embed){
    return '<div class="'+wrapCls+'"><iframe id="od-player-frame" src="'+escHtml(embed)+'" title="'+escHtml(w.name||'Trening')+'" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>';
  }
  if(file&&safeUrl){
    return '<video id="od-player-frame" src="'+escHtml(safeUrl)+'" controls playsinline style="width:100%;border-radius:12px;background:#000;"></video>';
  }
  if(safeUrl){
    return '<div style="padding:28px;text-align:center;color:var(--muted);">Nie da się osadzić tego linku. <a href="'+escHtml(safeUrl)+'" target="_blank" rel="noopener noreferrer">Otwórz wideo</a></div>';
  }
  return '<div style="padding:28px;text-align:center;color:var(--muted);">Brak linku YouTube. Dodaj URL odcinka (watch?v=...), nie kanału.</div>';
}

function openODWorkoutLive(w){
  if(window._cw&&window._cw.active){
    if(!confirm('Masz rozpoczęty trening z planu. Przerwać i odtworzyć on-demand?'))return;
    if(typeof cwClose==='function')cwClose();
  }
  window._odPlay={id:w.id,workout:w};
  const wrap=document.getElementById('clive-player');
  const inner=document.getElementById('clive-player-inner');
  if(!wrap||!inner)return false;
  const safeUrl=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(w.url):String(w.url||'');
  inner.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
    <button type="button" class="btn btn-ghost btn-sm" onclick="closeODPlayer()">✕ Zamknij</button>
    <div style="font-size:11px;color:var(--muted);text-align:right;flex:1;">YouTube · darmowy trening</div>
  </div>
  <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;margin-bottom:6px;">${escHtml(w.name||'Trening')}</div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5;">${escHtml(w.desc||'')}${w.time?' · '+w.time+' min':''}</div>
  ${odPlayerHtml(w,'clive-od-player-wrap')}
  ${safeUrl?`<a class="btn btn-ghost btn-sm" style="margin-top:12px;display:inline-flex;" href="${escHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Otwórz na YouTube</a>`:''}`;
  wrap.hidden=false;
  document.body.classList.add('od-playing');
  return true;
}

function closeODPlayer(){
  const frame=document.getElementById('od-player-frame');
  if(frame){
    if(frame.tagName==='IFRAME')frame.removeAttribute('src');
    else if(frame.pause){try{frame.pause();}catch(e){}}
  }
  if(window._odPlay||(document.body&&document.body.classList&&document.body.classList.contains('od-playing'))){
    const wrap=document.getElementById('clive-player');
    if(wrap)wrap.hidden=true;
    document.body.classList.remove('od-playing');
    window._odPlay=null;
  }
  const m=document.getElementById('m-od-player');
  if(m)m.classList.remove('show');
}
function openODWorkout(id){
  const w=allODWorkouts().find(x=>x.id===id);
  if(!w){if(typeof notify==='function')notify('Nie znaleziono treningu');return;}
  if(window._clientAppMode&&openODWorkoutLive(w))return;
  const embed=typeof coachVideoEmbed==='function'?coachVideoEmbed(w.url):'';
  const file=typeof coachVideoIsFile==='function'&&coachVideoIsFile(w.url);
  let m=document.getElementById('m-od-player');
  if(!m){
    m=document.createElement('div');
    m.id='m-od-player';
    m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:760px;">
      <div class="modal-hdr"><div class="modal-title" id="od-player-title">TRENING</div><button class="modal-close" type="button" onclick="closeODPlayer()">×</button></div>
      <div class="modal-body">
        <div class="od-player-wrap" id="od-player-wrap"></div>
        <div id="od-player-meta" style="font-size:12px;color:var(--muted);margin-top:10px;line-height:1.5;"></div>
      </div>
      <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;">
        <a id="od-player-yt" class="btn btn-ghost btn-sm" href="#" target="_blank" rel="noopener noreferrer">Otwórz na YouTube</a>
        <button class="btn btn-primary btn-sm" type="button" onclick="closeODPlayer()">Zamknij</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)closeODPlayer();});
  }
  document.getElementById('od-player-title').textContent=w.name||'Trening';
  const wrap=document.getElementById('od-player-wrap');
  const meta=document.getElementById('od-player-meta');
  const yt=document.getElementById('od-player-yt');
  const safeUrl=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(w.url):String(w.url||'');
  if(yt){
    if(safeUrl){yt.href=safeUrl;yt.style.display='inline-flex';}
    else{yt.removeAttribute('href');yt.style.display='none';}
  }
  if(meta)meta.textContent=(w.desc||'')+(w.time?' · '+w.time+' min':'')+' · darmowy YouTube';
  if(wrap)wrap.innerHTML=odPlayerHtml(w);
  if(typeof openM==='function')openM('m-od-player');
  else m.classList.add('show');
}

async function saveODWorkout(){
  if(window._saveGuard_saveODWorkout)return;window._saveGuard_saveODWorkout=true;setTimeout(()=>window._saveGuard_saveODWorkout=false,1500);

  const name=document.getElementById('odw-name').value.trim();
  if(!name){notify('Wpisz nazwę treningu!');return;}
  const type=document.getElementById('odw-type').value;
  const rawUrl=document.getElementById('odw-url').value;
  const url=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(rawUrl):String(rawUrl||'').trim();
  const embed=typeof coachVideoEmbed==='function'?coachVideoEmbed(url):'';
  const file=typeof coachVideoIsFile==='function'&&coachVideoIsFile(url);
  if(type==='video'&&!embed&&!file){
    notify('Wklej link do odcinka YouTube (np. youtube.com/watch?v=...), nie do kanału.');
    return;
  }
  ensureODWorkouts();
  const w=withTrainer({
    id:newId('ow'),name,
    type:type,
    level:document.getElementById('odw-level').value,
    time:parseInt(document.getElementById('odw-time').value)||30,
    coll:document.getElementById('odw-coll').value,
    url:url,
    desc:document.getElementById('odw-desc').value,
    color:'var(--s3)',emoji:'🏋️',views:0,likes:0
  });
  window.OD_WORKOUTS.push(w);
  await persistById('odWorkouts',w);
  closeM('m-od-workout');
  if(odTab==='browse')renderODBrowse();
  else if(odTab==='programs')renderODPrograms();
  notify('✓ Trening "'+name+'" dodany!');
}

function shareODProgram(id){
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  const p=allODPrograms().find(x=>x.id===id);
  if(!p){notify('Nie znaleziono programu');return;}
  if(!confirm('Udostępnić program "'+p.name+'" wszystkim klientom ('+CL.length+')?'))return;
  const tag='[odprog:'+id+']';
  const ytN=odProgramWorkoutCount(p);
  CL.forEach(c=>pushMsg(c.id,tag+'\n📋 Program on-demand: "'+p.name+'"'+(p.desc?'\n'+p.desc:'')+'\nCzas: '+(p.duration||'—')+' · '+(LEVEL_MAP[p.level]||p.level||'')+(ytN?'\n'+ytN+' treningów YouTube w apce':'')));
  notify('✓ Program "'+p.name+'" wysłany do '+CL.length+' klientów (Inbox)');
}

var resTab='resources';var resNav='all';var resColl='all';
window.USER_RESOURCES=[];

const RES_TYPE_COLORS={link:'var(--blue)',video:'var(--red)',doc:'var(--orange)',podcast:'var(--purple)'};
const RES_TYPE_ICONS={link:'🔗',video:'▶️',doc:'📄',podcast:'🎧'};
// 5 kategorii z kolorami wg schematu: Odżywianie=zielony, Trening=czerwony(marka), Rehabilitacja=niebieski, Psychologia=fioletowy, Muzyka=złoty.
const RES_CAT_COLORS={odżywianie:'var(--teal)',trening:'var(--accent)',regeneracja:'var(--blue)',psychologia:'var(--purple)',muzyka:'var(--gold)'};
const RES_CAT_LABELS={odżywianie:'🥗 Odżywianie i Dieta',trening:'🏋️ Trening Siłowy',regeneracja:'🩹 Rehabilitacja i Mobilność',psychologia:'🧠 Psychologia i Mindset',muzyka:'🎧 Muzyka do słuchania'};

const DEMO_RESOURCES=[
  {id:'r1',name:'Dobre źródła białka',type:'link',cat:'odżywianie',url:'https://www.health.harvard.edu/nutrition/high-protein-foods-the-best-protein-sources-to-include-in-a-healthy-diet',desc:'Harvard Health — darmowy przewodnik po źródłach białka w diecie.',coll:'edu'},
  {id:'r2',name:'Znaczenie białka w diecie',type:'link',cat:'odżywianie',url:'https://nutritionsource.hsph.harvard.edu/what-should-you-eat/protein/',desc:'Harvard Nutrition Source — po co białko w budowie mięśni i regeneracji.',coll:'edu'},
  {id:'r3',name:'Mikroelementy — przewodnik',type:'link',cat:'odżywianie',url:'https://www.healthline.com/nutrition/micronutrients',desc:'Darmowy przewodnik po witaminach i minerałach (bez logowania).',coll:'edu'},
  {id:'r4',name:'Znaczenie błonnika',type:'link',cat:'odżywianie',url:'https://www.houstonmethodist.org/blog/articles/2022/sep/why-is-fiber-good-for-you/',desc:'Jak błonnik wpływa na zdrowie jelit i metabolizm.',coll:'edu'},
  {id:'r5',name:'Mind Pump — trening siłowy (YouTube)',type:'podcast',cat:'trening',url:'https://www.youtube.com/@MindPumpTV',desc:'Darmowy podcast/wideo o treningu siłowym i coachingu. Bez Spotify Premium.',coll:'podcasts'},
  {id:'r6',name:'Barbell Medicine — siła i rehab (YouTube)',type:'podcast',cat:'regeneracja',url:'https://www.youtube.com/@BarbellMedicine',desc:'Jak łączyć trening siłowy z profilaktyką urazów. Kanał YouTube, darmowy dostęp.',coll:'podcasts'},
  {id:'r7',name:'Yoga With Adriene — mobilność (YouTube)',type:'podcast',cat:'regeneracja',url:'https://www.youtube.com/@yogawithadriene',desc:'Darmowe sesje mobilności i regeneracji na YouTube.',coll:'podcasts'},
  {id:'r8',name:'Huberman Lab — mindset i sen (YouTube)',type:'podcast',cat:'psychologia',url:'https://www.youtube.com/@hubermanlab',desc:'Nauka o śnie, stresie i nawykach. Pełne odcinki za darmo na YouTube.',coll:'podcasts'},
  {id:'r9',name:'Andy Galpin — fizjologia treningu (YouTube)',type:'podcast',cat:'psychologia',url:'https://www.youtube.com/@andygalpin',desc:'Wyjaśnienia adaptacji, recovery i wydolności. Darmowy kanał YouTube.',coll:'podcasts'},
  {id:'r10',name:'The Workout Mix — muzyka na siłownię',type:'video',cat:'muzyka',url:'https://www.youtube.com/@TheWorkoutMix',desc:'Darmowe mixy treningowe na YouTube — bez konta Premium.',coll:'music'},
  {id:'r11',name:'Power Music Workout — cardio (YouTube)',type:'video',cat:'muzyka',url:'https://www.youtube.com/@PowerMusicWorkout',desc:'Darmowa muzyka do cardio i biegania na YouTube, zamiast Spotify.',coll:'music'},
  {id:'r12',name:'NCS — muzyka bez copyrightu',type:'video',cat:'muzyka',url:'https://www.youtube.com/@NoCopyrightSounds',desc:'Darmowe utwory do treningu, legalne do odtwarzania bez subskrypcji.',coll:'music'},
  {id:'r13',name:'FoundMyFitness — odżywianie (YouTube)',type:'podcast',cat:'odżywianie',url:'https://www.youtube.com/@FoundMyFitness',desc:'Rhonda Patrick — nauka o diecie i regeneracji. Darmowe odcinki na YouTube.',coll:'podcasts'},
  {id:'r14',name:'The Proof — dieta i zdrowie (YouTube)',type:'podcast',cat:'odżywianie',url:'https://www.youtube.com/@TheProofWithSimonHill',desc:'Podcast żywieniowy na YouTube. Bez płatnej aplikacji muzycznej.',coll:'podcasts'},
  {id:'r15',name:'Renaissance Periodization (YouTube)',type:'podcast',cat:'trening',url:'https://www.youtube.com/@RenaissancePeriodization',desc:'Dr Mike Israetel — hipertrofia i programowanie. Darmowy kanał YouTube.',coll:'podcasts'},
];

const DEMO_COLLECTIONS=[
  {id:'edu',name:'Poradniki edukacyjne',icon:'📚',desc:'Artykuły i przewodniki o żywieniu, treningu i zdrowiu (darmowe strony)',count:4,color:'var(--blue)',clients:0},
  {id:'music',name:'Muzyka do treningu',icon:'🎵',desc:'Mixy treningowe na YouTube — darmowe, bez Spotify Premium',count:3,color:'var(--accent)',clients:0},
  {id:'podcasts',name:'Podcasty fitness na YouTube',icon:'🎧',desc:'Darmowe podcasty i kanały YouTube o treningu, diecie i mindsetcie',count:8,color:'var(--purple)',clients:0},
];
window.DEMO_RESOURCES=DEMO_RESOURCES;
window.DEMO_COLLECTIONS=DEMO_COLLECTIONS;

function allResources(){return window.USER_RESOURCES||[];}

function isGenericSpotifyUrl(url){
  const s=String(url||'').trim().toLowerCase();
  if(!/spotify\.com/.test(s))return false;
  return !/\/(playlist|episode|show|album|track|user)\//.test(s);
}

function migrateSpotifyDemoResources(){
  const list=window.USER_RESOURCES||[];
  const demoById={};
  DEMO_RESOURCES.forEach(r=>{demoById[r.id]=r;});
  let changed=0;
  list.forEach(r=>{
    if(!isGenericSpotifyUrl(r.url))return;
    const demo=demoById[r.id];
    if(demo){
      r.url=demo.url;r.name=demo.name;r.desc=demo.desc;r.type=demo.type;r.cat=demo.cat;r.coll=demo.coll;
    }else{
      r.url='https://www.youtube.com/results?search_query='+encodeURIComponent((r.name||'fitness podcast')+' youtube');
      r.type=r.type==='link'?'video':r.type;
      r.desc=(r.desc?r.desc+' ':'')+'(YouTube — darmowy dostęp, bez Spotify Premium)';
    }
    changed++;
    if(typeof persistById==='function')persistById('resources',r);
  });
  return changed;
}
window.isGenericSpotifyUrl=isGenericSpotifyUrl;
window.migrateSpotifyDemoResources=migrateSpotifyDemoResources;

function setResTab(t){
  resTab=t;
  document.getElementById('res-resources-view').style.display=t==='resources'?'block':'none';
  document.getElementById('res-collections-view').style.display=t==='collections'?'block':'none';
  document.querySelectorAll('#rtab-resources,#rtab-collections').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('rtab-'+t);if(el)el.classList.add('active');
  const addBtn=document.getElementById('res-add-btn');
  if(addBtn)addBtn.textContent=t==='collections'?'+ Nowa kolekcja':'+ Dodaj zasób';
  renderResources();
}

function setResNav(n){
  resNav=n;
  document.querySelectorAll('.res-nav-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('rn-'+n);if(el)el.classList.add('active');
  renderResources();
}

// Duże zakładki wg rodzaju materiału (Muzyka / Podcasty / Artykuły) — główny sposób nawigacji dla klienta.
function setResColl(c){
  resColl=c;
  document.querySelectorAll('.res-coll-tab').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('rcoll-'+c);if(el)el.classList.add('active');
  renderResources();
}

function updateResCounts(){
  const all=allResources();
  const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
  set('rnc-all',all.length);
  ['link','video','doc','podcast'].forEach(t=>set('rnc-'+t,all.filter(r=>r.type===t).length));
  ['odżywianie','trening','regeneracja','psychologia','muzyka'].forEach(c=>set('rnc-'+c,all.filter(r=>r.cat===c).length));
}

function renderResources(){
  updateResCounts();
  const clf=document.getElementById('res-client-fil');
  if(clf){const cur=clf.value;clf.innerHTML='<option value="">Wszyscy klienci</option>'+CL.map(c=>'<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+c.name+'</option>').join('');}

  const search=(document.getElementById('res-search')||{}).value||'';
  const all=allResources();

  let res=all.filter(r=>{
    if(search&&!r.name.toLowerCase().includes(search.toLowerCase())&&!(r.desc||'').toLowerCase().includes(search.toLowerCase()))return false;
    if(resColl!=='all'&&r.coll!==resColl)return false;
    if(resNav==='all')return true;
    if(['link','video','doc','podcast'].includes(resNav))return r.type===resNav;
    if(['odżywianie','trening','regeneracja','psychologia','muzyka'].includes(resNav))return r.cat===resNav;
    return true;
  });

  const lbl=document.getElementById('res-count-lbl');
  if(lbl)lbl.textContent=res.length+' '+(res.length===1?'zasób':res.length<5?'zasoby':'zasobów');

  if(resTab==='resources'){
    const grid=document.getElementById('res-grid');
    if(!grid)return;
    if(!res.length){
      grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">🔗</div><div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak zasobów</div><button class="btn btn-primary" onclick="openM(\'m-resource\')">+ Dodaj zasób</button></div>';
      return;
    }
    grid.innerHTML=res.map((r,i)=>{
      const tc=RES_TYPE_COLORS[r.type]||'var(--muted)';
      const ti=RES_TYPE_ICONS[r.type]||'📎';
      const cc=RES_CAT_COLORS[r.cat]||'var(--muted)';
      const domain=r.url?r.url.replace('https://','').replace('http://','').split('/')[0]:'';
      return `<div class="res-card" style="animation-delay:${i*0.03}s" onclick="window.open('${r.url}','_blank')">
        <div class="res-card-accent" style="background:${tc};"></div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div class="res-type-icon" style="background:${tc}22;">${ti}</div>
          <div style="flex:1;min-width:0;">
            <div class="res-card-title">${r.name}</div>
            <div class="res-card-url">${domain}</div>
            ${r.desc?`<div style="font-size:13px;color:#D1D5DB;line-height:1.55;margin-bottom:8px;">${r.desc}</div>`:''}
            <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
              <span class="pill" style="background:${cc}22;color:${cc};font-size:10px;font-weight:700;">${RES_CAT_LABELS[r.cat]||r.cat}</span>
              ${r.coll?`<span class="pill pill-muted" style="font-size:9px;">📁 ${DEMO_COLLECTIONS.find(c=>c.id===r.coll)?.name||r.coll}</span>`:''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid var(--border);padding-top:10px;" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="sendResourceToClient('${r.id}')">Wyślij klientowi</button>
          <button class="btn btn-primary btn-sm" onclick="window.open('${r.url}','_blank')">↗ Otwórz</button>
        </div>
      </div>`;
    }).join('');
  } else {
    // collections view
    const grid=document.getElementById('res-coll-grid');
    if(!grid)return;
    const allColls=[...DEMO_COLLECTIONS];
    grid.innerHTML=allColls.map((c,i)=>`<div class="res-coll-card" style="animation-delay:${i*0.05}s;border-top:4px solid ${c.color};">
      <div class="res-coll-icon">${c.icon}</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${c.name}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:12px;">${c.desc}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">
        <span class="pill pill-muted" style="font-size:10px;">${allResources().filter(r=>r.coll===c.id).length} zasobów</span>
        <span class="pill pill-muted" style="font-size:10px;">Dostępne dla ${c.clients} klientów</span>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="viewCollection('${c.id}')">Zobacz zasoby</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="shareCollection('${c.id}')">Udostępnij</button>
      </div>
    </div>`).join('')+`<div style="border:1px dashed var(--border2);border-radius:var(--r2);padding:18px;display:flex;align-items:center;justify-content:center;min-height:160px;cursor:pointer;background:transparent;" onclick="openM('m-resource')">
      <div style="text-align:center;color:var(--muted);"><div style="font-size:32px;margin-bottom:8px;">+</div><div style="font-size:13px;font-weight:600;">Nowa kolekcja</div></div>
    </div>`;
  }
}

function viewCollection(id){
  resTab='resources';
  setResNav(id==='edu'?'odżywianie':id==='music'?'trening':'trening');
  setResTab('resources');
}

function shareCollection(id){
  const c=DEMO_COLLECTIONS.find(x=>x.id===id);
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  notify('✓ Kolekcja "'+(c?c.name:id)+'" udostępniona wszystkim klientom');
}

var sendResourceId=null;

function sendResourceToClient(id){
  sendResourceId=id;
  const r=allResources().find(x=>x.id===id);if(!r)return;
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  document.getElementById('m-send-resource-title').textContent='WYŚLIJ: '+r.name.toUpperCase();
  sendResourceSetClientField('','');
  openM('m-send-resource');
}

function sendResourceSetClientField(clientId,clientName){
  const hid=document.getElementById('send-resource-client');
  const vis=document.getElementById('send-resource-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('send-resource-client-results');
  if(res)res.style.display='none';
}

function sendResourceClientSearchInput(){
  const q=(document.getElementById('send-resource-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('send-resource-client-results');
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
    <div onclick="sendResourceSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function confirmSendResource(){
  if(!sendResourceId)return;
  const cid=document.getElementById('send-resource-client').value;
  if(!cid){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===cid);
  const r=allResources().find(x=>x.id===sendResourceId);
  if(!r||!c)return;
  pushMsg(cid,`📚 Polecam Ci ten materiał: ${r.name}\n\n${r.desc||''}\n\n${r.url||''}`);
  closeM('m-send-resource');
  notify('✓ Zasób "'+r.name+'" wysłany do '+c.name);
}

// ── PACZKA STARTOWA dla nowego podopiecznego ──
// 1 klik = wysyła playlistę treningową + artykuł o diecie + przewodnik po regeneracji naraz.
function openStarterPackModal(){
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  starterPackSetClientField('','');
  openM('m-starter-pack');
}

function starterPackSetClientField(clientId,clientName){
  const hid=document.getElementById('starter-pack-client');
  const vis=document.getElementById('starter-pack-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('starter-pack-client-results');
  if(res)res.style.display='none';
}

function starterPackClientSearchInput(){
  const q=(document.getElementById('starter-pack-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('starter-pack-client-results');
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
    <div onclick="starterPackSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function confirmStarterPack(){
  const cid=document.getElementById('starter-pack-client').value;
  if(!cid){notify('Wybierz klienta!');return;}
  const c=CL.find(x=>x.id===cid);
  if(!c)return;
  if(typeof ensureODWorkouts==='function')ensureODWorkouts();
  if(typeof ensureODPrograms==='function')ensureODPrograms();
  const all=allResources();
  const picks=[
    all.find(r=>r.coll==='podcasts'&&/youtube/i.test(r.url||'')),
    all.find(r=>r.cat==='odżywianie'&&r.type==='link'),
    all.find(r=>r.coll==='music'&&/youtube/i.test(r.url||'')),
  ].filter(Boolean);
  const workouts=allODWorkouts().slice(0,2);
  const prog=allODPrograms().find(p=>p.status==='active'&&odProgramWorkoutCount(p)>0);
  if(!picks.length&&!workouts.length&&!prog){notify('Brak zasobów i treningów do wysłania.');return;}
  const lines=[`🎁 Witaj ${c.name.split(' ')[0]}! Start na YouTube (bez Spotify Premium):`];
  if(prog)lines.push('','[odprog:'+prog.id+']','📋 Program: '+prog.name+(prog.duration?' ('+prog.duration+')':''));
  if(workouts.length){
    lines.push('','▶ Treningi w apce:');
    workouts.forEach(w=>lines.push('[od:'+w.id+'] '+w.name+(w.url?'\n'+w.url:'')));
  }
  if(picks.length){
    lines.push('','🎧 Podcast / artykuł / muzyka:');
    picks.forEach(r=>lines.push('• '+r.name+(r.url?'\n'+r.url:'')));
  }
  pushMsg(cid,lines.join('\n'));
  closeM('m-starter-pack');
  notify('✓ Paczka startowa wysłana do '+c.name+'!');
}

async function saveResource(){
  if(window._saveGuard_saveResource)return;window._saveGuard_saveResource=true;setTimeout(()=>window._saveGuard_saveResource=false,1500);

  const name=document.getElementById('rs-name').value.trim();
  if(!name){notify('Wpisz nazwę zasobu!');return;}
  const r=withTrainer({
    id:newId('ur'),
    name,
    type:document.getElementById('rs-type').value,
    cat:document.getElementById('rs-cat').value,
    url:document.getElementById('rs-url').value,
    desc:document.getElementById('rs-desc').value,
    coll:document.getElementById('rs-coll').value,
    createdAt:new Date().toISOString()
  });
  window.USER_RESOURCES.push(r);
  await persistById('resources',r);
  closeM('m-resource');
  renderResources();
  notify('✓ Zasób "'+name+'" dodany!');
}
var autoTab='onboard';var onboardingActive=false;
window.AUTOFLOWS=[];
window.ONBOARD_HISTORY=[];

const DEMO_AUTOFLOWS=[
  {name:'2-tygodniowe wyzwanie fitness',type:'sequence',trigger:'',scope:'new',status:'inactive',
   steps:[
     {type:'message',day:1,text:'Dzień 1: Cześć {imie}! Zaczynamy wyzwanie! Dzisiaj: 3 serie pompek do upadku 💪'},
     {type:'task',day:1,text:'Wykonaj trening startowy'},
     {type:'wait',day:3,text:'Czekaj 2 dni',waitDays:2},
     {type:'message',day:3,text:'Dzień 3: Jak Ci idzie? Pamiętaj o nawodnieniu 💧'},
     {type:'form',day:7,text:'Wypełnij formularz postępów — tydzień 1'},
     {type:'message',day:14,text:'Gratulacje! Ukończyłeś 2-tygodniowe wyzwanie! 🎉'},
   ]},
  {name:'Przypomnienie o treningu',type:'trigger',trigger:'session_today',scope:'all',status:'inactive',
   steps:[
     {type:'message',day:1,text:'Hej {imie}! Nie zapomnij o treningu dzisiaj 🏋️'},
   ]},
  {name:'Alert po zastoju (14 dni)',type:'trigger',trigger:'inactivity',scope:'all',status:'inactive',
   steps:[
     {type:'message',day:14,text:'{imie}, minęły 2 tygodnie bez treningu. Wszystko ok? Chętnie pomogę wrócić na właściwe tory! 💪'},
     {type:'task',day:14,text:'Skontaktuj się z trenerem'},
   ]},
];

function ensureReminderAutoflowsFromSettings(){
  const S=window.SETTINGS||{};
  const N=S.notifications||{};
  window.AUTOFLOWS=window.AUTOFLOWS||[];
  const defs=[
    {
      key:'pl-session-reminder',
      enabled:N.sessionReminder!==false,
      trigger:'session_today',
      name:'Przypomnienie o treningu',
      steps:[
        {type:'message',day:1,text:'Hej {imie}! Nie zapomnij o treningu dzisiaj 🏋️'}
      ]
    },
    {
      key:'pl-inactive-client',
      enabled:N.inactiveClient!==false,
      trigger:'inactivity',
      name:'Alert po zastoju ('+String(N.inactiveDays||14)+' dni)',
      steps:[
        {type:'message',day:parseInt(N.inactiveDays,10)||14,text:'{imie}, minęło już trochę czasu od ostatniego treningu. Wszystko ok? Chętnie pomogę wrócić do rytmu 💪'},
        {type:'task',day:parseInt(N.inactiveDays,10)||14,text:'Skontaktuj się z klientem'}
      ]
    }
  ];
  let changed=false;
  defs.forEach(def=>{
    let af=window.AUTOFLOWS.find(x=>x&&x.systemKey===def.key);
    if(!af){
      af=withTrainer({
        id:newId('af'),
        systemKey:def.key,
        name:def.name,
        type:'trigger',
        trigger:def.trigger,
        scope:'all',
        status:def.enabled?'active':'inactive',
        steps:def.steps
      });
      window.AUTOFLOWS.push(af);
      changed=true;
      return;
    }
    const nextName=def.name;
    const nextStatus=def.enabled?'active':'inactive';
    const nextSteps=def.steps;
    if(af.name!==nextName||af.status!==nextStatus||JSON.stringify(af.steps||[])!==JSON.stringify(nextSteps)){
      af.name=nextName;
      af.status=nextStatus;
      af.steps=nextSteps;
      af.trigger=def.trigger;
      af.scope='all';
      changed=true;
    }
  });
  if(changed){
    window.AUTOFLOWS.forEach(af=>{ if(af&&af.systemKey) persistById('autoflows',af); });
  }
  return changed;
}
window.ensureReminderAutoflowsFromSettings=ensureReminderAutoflowsFromSettings;

function setAutoTab(t){
  autoTab=t;
  document.getElementById('auto-onboard-tab').style.display=t==='onboard'?'block':'none';
  document.getElementById('auto-autoflow-tab').style.display=t==='autoflow'?'block':'none';
  document.querySelectorAll('#screen-automation .auto-tab-btn').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('atab-'+t);if(el)el.classList.add('active');
  fillAutomationSelects();
  if(t==='autoflow'){renderAutoflows();renderAutoflowLog();}
  if(t==='onboard')renderOnboardHistory();
}

function fillAutomationSelects(){
  const flow=window.ONBOARDING_FLOW||{};
  const prog=document.getElementById('osc-program-sel');
  if(prog){
    const list=typeof allPrograms==='function'?allPrograms():[];
    prog.innerHTML='<option value="">Nie przypisuj programu</option>'+list.map(p=>'<option value="'+escHtml(p.id)+'">'+escHtml(p.name)+'</option>').join('');
    if(flow.programId)prog.value=flow.programId;
  }
  const forum=document.getElementById('osc-forum-sel');
  if(forum){
    const groups=window.FORUM_GROUPS||[];
    forum.innerHTML='<option value="">Brak</option>'+groups.map(g=>'<option value="'+escHtml(g.id)+'">'+escHtml((g.icon||'')+' '+g.name)+'</option>').join('');
    if(flow.forumGroupId)forum.value=flow.forumGroupId;
  }
  const res=document.getElementById('osc-resource-sel');
  if(res){
    const items=window.USER_RESOURCES||[];
    res.innerHTML='<option value="">Wszystkie zasoby</option>'+items.map(r=>'<option value="'+escHtml(r.id)+'">'+escHtml(r.title||r.name||'Zasób')+'</option>').join('');
    if(flow.resourceId)res.value=flow.resourceId;
  }
  const formsBox=document.getElementById('osc-forms-list');
  if(formsBox){
    const forms=typeof allForms==='function'?allForms():[];
    const selected=flow.formIds||[];
    if(!forms.length){
      formsBox.innerHTML='<div style="font-size:11px;color:var(--muted);">Brak formularzy — dodaj w Formularzach.</div>';
    }else{
      formsBox.innerHTML=forms.map(f=>`<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;">
        <input type="checkbox" class="osc-form-cb" value="${escHtml(f.id)}" ${selected.indexOf(f.id)>=0?'checked':''} style="accent-color:var(--accent);">
        ${escHtml(f.name||'Formularz')}
      </label>`).join('');
    }
  }
}

function setOnboardingToggleUi(on){
  onboardingActive=!!on;
  const sw=document.getElementById('onboard-toggle');
  if(sw)sw.classList.toggle('on',onboardingActive);
  const st=document.getElementById('onboard-status');
  if(st)st.textContent=onboardingActive?'Aktywny':'Draft';
}

function toggleOnboarding(){
  setOnboardingToggleUi(!onboardingActive);
  if(!window.ONBOARDING_FLOW){
    saveOnboardingFlow();
  }else{
    window.ONBOARDING_FLOW.active=onboardingActive;
    persistById('onboardingFlows',window.ONBOARDING_FLOW);
  }
  notify(onboardingActive?'✓ Onboarding aktywny — nowy klient dostanie wiadomość / formularz / program':'Onboarding wyłączony — nic nie pójdzie automatycznie');
}

function updateOSC(){
  // update preview based on checkboxes
  const ondemandOn=document.getElementById('osc-ondemand-en').checked;
  const recipesOn=document.getElementById('osc-recipes-en').checked;
  const prevOD=document.getElementById('prev-ondemand');
  const prevR=document.getElementById('prev-recipes');
  const odContent=document.getElementById('osc-ondemand-content');
  const rContent=document.getElementById('osc-recipes-content');
  if(prevOD){prevOD.className='osc-preview-step '+(ondemandOn?'active':'inactive');prevOD.querySelector('.osc-preview-step div').style.opacity=ondemandOn?'1':'0.4';}
  if(prevR){prevR.className='osc-preview-step '+(recipesOn?'active':'inactive');}
  if(odContent)odContent.style.opacity=ondemandOn?'1':'0.4';
  if(rContent)rContent.style.opacity=recipesOn?'1':'0.4';
}

function addOSCForm(){
  fillAutomationSelects();
  notify('Zaznacz formularze z listy — to prawdziwe formularze z zakładki Formularze');
}

function collectOnboardingFormIds(){
  return Array.from(document.querySelectorAll('.osc-form-cb:checked')).map(el=>el.value);
}

function saveOnboardingFlow(){
  const flow=withTrainer({
    id:window.ONBOARDING_FLOW?.id||(window._uid?('onbflow_'+window._uid):newId('onbflow')),
    active:onboardingActive,
    formsEnabled:!!document.getElementById('osc-forms-en')?.checked,
    msgEnabled:!!document.getElementById('osc-msg-en')?.checked,
    assignEnabled:!!document.getElementById('osc-assign-en')?.checked,
    ondemandEnabled:!!document.getElementById('osc-ondemand-en')?.checked,
    recipesEnabled:!!document.getElementById('osc-recipes-en')?.checked,
    welcomeMsg:document.getElementById('osc-welcome-msg')?.value||'',
    programId:document.getElementById('osc-program-sel')?.value||'',
    forumGroupId:document.getElementById('osc-forum-sel')?.value||'',
    resourceId:document.getElementById('osc-resource-sel')?.value||'',
    formIds:collectOnboardingFormIds(),
    history:(window.ONBOARDING_FLOW&&window.ONBOARDING_FLOW.history)||[],
    updatedAt:new Date().toISOString()
  });
  window.ONBOARDING_FLOW=flow;
  persistById('onboardingFlows',flow);
  notify('✓ Onboarding zapisany'+(flow.active?' i aktywny':' — włącz przełącznik, żeby działał przy nowym kliencie'));
}

function applyOnboardingFlow(flow){
  if(!flow)return;
  window.ONBOARDING_FLOW=flow;
  const setChk=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=!!v;};
  setChk('osc-forms-en',flow.formsEnabled!==false);
  setChk('osc-msg-en',flow.msgEnabled!==false);
  setChk('osc-assign-en',flow.assignEnabled!==false);
  setChk('osc-ondemand-en',!!flow.ondemandEnabled);
  setChk('osc-recipes-en',!!flow.recipesEnabled);
  const msg=document.getElementById('osc-welcome-msg');if(msg&&flow.welcomeMsg!=null)msg.value=flow.welcomeMsg;
  fillAutomationSelects();
  const prog=document.getElementById('osc-program-sel');if(prog&&flow.programId)prog.value=flow.programId;
  const forum=document.getElementById('osc-forum-sel');if(forum&&flow.forumGroupId)forum.value=flow.forumGroupId;
  const res=document.getElementById('osc-resource-sel');if(res&&flow.resourceId)res.value=flow.resourceId;
  setOnboardingToggleUi(!!flow.active);
  if(typeof updateOSC==='function')updateOSC();
  renderOnboardHistory();
}
window.applyOnboardingFlow=applyOnboardingFlow;

function logOnboardRun(client, parts){
  const flow=window.ONBOARDING_FLOW;if(!flow)return;
  flow.history=flow.history||[];
  flow.history.unshift({at:new Date().toISOString(),clientName:client.name,clientId:client.id,parts:parts.join(', ')});
  flow.history=flow.history.slice(0,30);
  persistById('onboardingFlows',flow);
  renderOnboardHistory();
}

function renderOnboardHistory(){
  const el=document.getElementById('onboard-history');if(!el)return;
  const hist=(window.ONBOARDING_FLOW&&window.ONBOARDING_FLOW.history)||[];
  if(!hist.length){
    el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px;">Brak uruchomień. Włącz flow, zapisz, potem dodaj klienta.</div>';
    return;
  }
  el.innerHTML=hist.map(h=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
    <span><strong>${escHtml(h.clientName||'')}</strong> — ${escHtml(h.parts||'')}</span>
    <span style="color:var(--muted);font-family:'DM Mono',monospace;font-size:10px;">${escHtml((h.at||'').slice(0,16).replace('T',' '))}</span>
  </div>`).join('');
}

function assignProgramPlanToClient(programId, client){
  if(!programId||typeof allPrograms!=='function')return null;
  const prog=allPrograms().find(p=>p.id===programId);if(!prog)return null;
  const days=typeof planDaysFromProgram==='function'
    ?planDaysFromProgram(prog,0)
    :(((prog.weeks&&prog.weeks[0])||{}).days||[]).map(d=>({day:d.d||d.day||d.name||'Dzień',muscles:d.name||'',exercises:[]}));
  const plan=withTrainer({
    id:newId('p'),name:prog.name,clientId:client.id,clientName:client.name||'',
    method:prog.method||'',duration:prog.duration||0,
    level:prog.level||'sredni',goal:prog.goal||'masa',
    programId:prog.id,
    days:days.length?days:[{day:'Pon',muscles:'',exercises:[{name:'Trening wg planu',sets:'3',reps:'8-12',rest:'90s'}]}],
    source:'onboarding',createdAt:new Date().toISOString()
  });
  (window.PL||(window.PL=[])).push(plan);
  persistById('plans',plan);
  return plan;
}

function runOnboardingForClient(client){
  if(!client)return false;
  const flow=window.ONBOARDING_FLOW;
  const first=(client.name||'').split(' ')[0];
  const parts=[];
  let formSent=false;
  if(flow&&flow.active){
    if(flow.msgEnabled!==false && flow.welcomeMsg && typeof pushMsg==='function'){
      pushMsg(client.id,(flow.welcomeMsg||'').replace(/\{imie\}/g,first));
      parts.push('wiadomość');
    }
    if(flow.formsEnabled!==false){
      const ids=(flow.formIds&&flow.formIds.length)?flow.formIds:[];
      const forms=typeof allForms==='function'?allForms():[];
      const picked=ids.length?forms.filter(f=>ids.indexOf(f.id)>=0):forms.slice(0,1);
      picked.forEach(form=>{
        if(typeof createFormSend==='function')createFormSend(form,client.id);
        else{
          const send=withTrainer({id:newId('fs'),formId:form.id,formName:form.name,clientId:client.id,sentAt:new Date().toLocaleDateString('pl'),status:'sent',answers:{},questions:typeof snapshotFormQuestions==='function'?snapshotFormQuestions(form):[]});
          (window.FORM_SENDS||(window.FORM_SENDS=[])).push(send);
          persistById('formSends',send);
          if(typeof pushMsg==='function')pushMsg(client.id,'Formularz do wypełnienia: '+(form.name||'Ankieta'));
        }
      });
      if(picked.length){parts.push('formularz');formSent=true;}
    }
    if(flow.assignEnabled!==false && flow.programId){
      const assigned=assignProgramPlanToClient(flow.programId,client);
      if(assigned){
        parts.push('program');
        if(typeof maybeSchedulePlanToCalendar==='function'&&(assigned.days||[]).some(d=>!d.rest&&(d.exercises||[]).length)){
          try{
            const n=maybeSchedulePlanToCalendar(assigned.id,{weeks:4});
            if(n>0)parts.push('kalendarz');
          }catch(e){console.warn('schedule after onboard assign',e);}
        }else if(typeof schedulePlanToCalendar==='function'&&(assigned.days||[]).some(d=>!d.rest&&(d.exercises||[]).length)){
          try{
            if(confirm('Program „'+(assigned.name||'')+'” przypisany. Dodać dni do kalendarza na 4 tyg.?')){
              schedulePlanToCalendar(assigned.id,{weeks:4});
              parts.push('kalendarz');
            }
          }catch(e){console.warn('schedule after onboard assign',e);}
        }
      }
    }
    if(flow.forumGroupId && (flow.assignEnabled!==false)){
      const enrolled=typeof enrollClientInForumGroup==='function'
        ?enrollClientInForumGroup(client.id,flow.forumGroupId,{notify:true})
        :null;
      if(enrolled&&enrolled.ok)parts.push('forum');
      else{
        const g=(window.FORUM_GROUPS||[]).find(x=>x.id===flow.forumGroupId);
        if(g){
          g.memberIds=g.memberIds||[];
          if(g.memberIds.indexOf(client.id)<0){g.memberIds.push(client.id);persistById('forumGroups',g);}
          if(typeof pushMsg==='function')pushMsg(client.id,'Jesteś w grupie na forum: '+(g.name||'Społeczność'));
          parts.push('forum');
        }
      }
    }
    if(flow.ondemandEnabled){
      if(typeof ensureODWorkouts==='function')ensureODWorkouts();
      if(typeof ensureODPrograms==='function')ensureODPrograms();
      const items=window.USER_RESOURCES||[];
      const one=flow.resourceId?items.find(r=>r.id===flow.resourceId):null;
      const progs=allODPrograms().filter(p=>p.status==='active'&&odProgramWorkoutCount(p)>0);
      const prog=progs[0]||null;
      const picks=allODWorkouts().slice(0,3);
      const lines=[];
      if(prog)lines.push('[odprog:'+prog.id+']','📋 Program: '+prog.name+' ('+(prog.duration||'')+')');
      if(picks.length)lines.push('▶ Treningi YouTube w apce:',...picks.map(w=>'[od:'+w.id+'] '+w.name));
      if(one)lines.push('🎧 '+ (one.title||one.name)+': '+(one.url||''));
      else if(!prog&&!picks.length){
        const names=items.slice(0,5).map(r=>r.title||r.name).filter(Boolean);
        if(names.length)lines.push('Zasoby na start:\n- '+names.join('\n- '));
      }
      if(typeof pushMsg==='function')pushMsg(client.id,lines.length?lines.join('\n'):'Trener udostępni Ci treningi on-demand wkrótce — zakładka ▶ On-demand w apce.');
      parts.push('on-demand');
    }
    if(flow.recipesEnabled && typeof pushMsg==='function'){
      pushMsg(client.id,'Proszę o krótki dzienniczek żywienia z 2–3 dni — wrzucimy to do planu.');
      parts.push('żywienie');
    }
    if(parts.length){
      logOnboardRun(client,parts);
      if(typeof addNotification==='function')addNotification('system','Onboarding uruchomiony',client.name+' — '+parts.join(', '),'automation');
    }
  }
  if(!formSent&&typeof createFormSend==='function'){
    const forms=typeof allForms==='function'?allForms():[];
    const intake=forms.find(f=>f.id==='df1')||forms.find(f=>(f.cat||'').includes('wstepna'))||forms[0];
    if(intake){
      createFormSend(intake,client.id);
      parts.push('formularz (auto)');
    }
  }
  if(typeof enrollNewClientInAutoflows==='function')enrollNewClientInAutoflows(client);
  return parts.length>0;
}
window.runOnboardingForClient=runOnboardingForClient;

function savePortalSettings(){
  const S=window.SETTINGS||(window.SETTINGS={});
  if(!S.portal)S.portal={};
  S.portal.resourcesVisible=true;
  S.portal.workoutCollectionsVisible=true;
  S.portal.ondemandVisible=true;
  // Odczyt checkboxów z ekranu portalu jeśli obecne
  const cards=document.querySelectorAll('#screen-portal input[type=checkbox]');
  if(cards.length>=3){
    S.portal.resourcesVisible=cards[0].checked;
    S.portal.workoutCollectionsVisible=cards[1].checked;
    S.portal.ondemandVisible=cards[2].checked;
  }
  withTrainer(S);
  if(window._db){
    const sid=window._settingsDocId||window._uid||'default';
    window._setDoc(window._doc(window._db,'settings',sid),S,{merge:true}).then(()=>{window._settingsDocId=sid;}).catch(e=>console.warn(e));
  }
  notify('✓ Ustawienia portalu zapisane');
}
window.savePortalSettings=savePortalSettings;

function renderAutoflows(){
  const all=window.AUTOFLOWS||[];
  const el=document.getElementById('autoflow-list-main');
  if(!el)return;
  if(!all.length){
    el.innerHTML='<div style="text-align:center;padding:60px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;opacity:0.3;">⚡</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;">Brak autoflows</div><button class="btn btn-primary" onclick="openM(\'m-autoflow-builder\')">+ Nowy Autoflow</button></div>';
    return;
  }
  const typeLabels={sequence:'Sekwencja dni',trigger:'Wyzwalacz'};
  const trigLabels={inactivity:'brak aktywności',session_today:'sesja dziś',new_client:'nowy klient'};
  el.innerHTML=all.map((af,i)=>{
    const enrolledCount=Object.keys(window.AF_STATE?.enrollments?.[af.id]||{}).length;
    const trig=af.type==='trigger'?(trigLabels[af.trigger||'inactivity']||af.trigger):'';
    return `<div class="af-card" style="animation-delay:${i*0.05}s">
    <div class="af-card-hdr">
      <div>
        <div style="font-size:14px;font-weight:700;">${escHtml(af.name)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(typeLabels[af.type]||af.type)}${trig?' · '+escHtml(trig):''} · ${(af.steps||[]).length} kroków · ${enrolledCount} zapisanych</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span class="pill ${af.status==='active'?'pill-green':'pill-muted'}">${af.status==='active'?'Aktywny':'Nieaktywny'}</span>
        <button onclick="toggleAF('${escHtml(af.id)}')" class="btn btn-ghost btn-sm">${af.status==='active'?'Wyłącz':'Włącz'}</button>
        <button onclick="deleteAutoflow('${escHtml(af.id)}')" class="btn btn-ghost btn-sm" title="Usuń">🗑</button>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;">
      ${(af.steps||[]).map(s=>`<div class="af-step-row" style="flex:0 0 auto;max-width:300px;">
        <div class="af-step-icon" style="background:${s.type==='message'?'var(--adim)':s.type==='task'?'rgba(201,162,39,0.12)':s.type==='form'?'rgba(157,124,244,0.12)':'var(--s4)'};">${s.type==='message'?'💬':s.type==='task'?'✅':s.type==='form'?'📋':'⏳'}</div>
        <div><div style="font-size:11px;font-weight:600;">${s.type==='wait'?'Czekaj '+(s.waitDays||s.day||'')+' dni':escHtml((s.type||'').charAt(0).toUpperCase()+(s.type||'').slice(1))} · dzień ${s.day||1}</div><div style="font-size:10px;color:var(--muted);">${escHtml((s.text||'').substring(0,40))}${(s.text||'').length>40?'…':''}</div></div>
      </div>`).join('')}
    </div>
  </div>`;}).join('');
}

function renderAutoflowLog(){
  const el=document.getElementById('autoflow-log');if(!el)return;
  const logs=(window.AF_STATE&&window.AF_STATE.logs)||[];
  if(!logs.length){
    el.innerHTML='<div style="text-align:center;padding:12px;">Jeszcze nic nie poszło. Włącz flow i otwórz panel albo kliknij „Sprawdź teraz”.</div>';
    return;
  }
  el.innerHTML=logs.slice(0,20).map(l=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
    <span>${escHtml(l.client||'')} — ${escHtml(l.af||'')} · ${escHtml(l.text||'')}</span>
    <span style="font-family:'DM Mono',monospace;font-size:10px;">${escHtml((l.at||'').slice(0,16).replace('T',' '))}</span>
  </div>`).join('');
}

function toggleAF(id){
  const af=(window.AUTOFLOWS||[]).find(x=>x.id===id);
  if(!af)return;
  af.status=af.status==='active'?'inactive':'active';
  persistById('autoflows',af);
  if(af.status==='active'){
    enrollScopeClients(af,true);
    notify('Autoflow włączony. Obecni klienci zapisani bez wysyłki wstecz. Nowi dostaną krok 1.');
    runAutoflowsCheck(true);
  }else{
    renderAutoflows();
    notify('Autoflow wyłączony');
  }
}

function deleteAutoflow(id){
  const af=(window.AUTOFLOWS||[]).find(x=>x.id===id);if(!af)return;
  if(!confirm('Usunąć „'+af.name+'"?'))return;
  window.AUTOFLOWS=(window.AUTOFLOWS||[]).filter(x=>x.id!==id);
  if(window._db&&window._del)window._del(window._doc(window._db,'autoflows',id)).catch(e=>console.warn(e));
  renderAutoflows();
  notify('Autoflow usunięty');
}

function updateAfBuilderUi(){
  const type=(document.getElementById('af-type')||{}).value;
  const scope=(document.getElementById('af-scope')||{}).value;
  const tw=document.getElementById('af-trigger-wrap');
  const cw=document.getElementById('af-scope-clients-wrap');
  const box=document.getElementById('af-scope-clients');
  if(tw)tw.style.display=type==='trigger'?'block':'none';
  if(cw)cw.style.display=scope==='select'?'block':'none';
  if(scope==='select'&&box){
    const clients=(window.CL||[]).filter(c=>c.status!=='archived');
    box.innerHTML=clients.length?clients.map(c=>`<label style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0;cursor:pointer;">
      <input type="checkbox" class="af-client-cb" value="${escHtml(c.id)}" style="accent-color:var(--accent);"> ${escHtml(c.name)}
    </label>`).join(''):'<div style="font-size:12px;color:var(--muted);">Brak klientów</div>';
  }
}

function addAFStep(type){
  const container=document.getElementById('af-steps');
  const icons={message:'💬',task:'✅',form:'📋',wait:'⏳'};
  const labels={message:'Wyślij wiadomość',task:'Przypisz zadanie',form:'Wyślij formularz',wait:'Czekaj (dni)'};
  const div=document.createElement('div');div.className='af-step-row';
  div.innerHTML=`<div class="af-step-icon" style="background:var(--s3);">${icons[type]}</div>
    <div style="font-size:11px;font-weight:600;min-width:100px;flex-shrink:0;">${labels[type]}</div>
    ${type==='wait'?`<input type="number" class="af-step-inp" data-type="wait" placeholder="2" min="1" style="width:60px;flex:0 0 60px;"> <span style="font-size:11px;color:var(--muted);">dni</span>`
    :`<input type="text" class="af-step-inp" placeholder="Treść..." data-type="${type}">`}
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;flex-shrink:0;">×</button>`;
  container.appendChild(div);
}

function saveAutoflow(){
  const name=document.getElementById('af-name').value.trim();
  if(!name){notify('Wpisz nazwę!');return;}
  const steps=[];
  let dayCursor=1;
  document.querySelectorAll('#af-steps .af-step-row').forEach(row=>{
    const inp=row.querySelector('input');
    if(!inp||!String(inp.value||'').trim())return;
    const type=(inp.dataset.type)||'wait';
    if(type==='wait'){
      const n=Math.max(1,parseInt(inp.value,10)||1);
      dayCursor+=n;
      steps.push({type:'wait',day:dayCursor,text:'Czekaj '+n+' dni',waitDays:n});
    }else{
      steps.push({type,day:dayCursor,text:inp.value.trim()});
    }
  });
  if(!steps.filter(s=>s.type!=='wait').length){notify('Dodaj przynajmniej wiadomość, zadanie albo formularz');return;}
  const scope=document.getElementById('af-scope').value;
  const clientIds=scope==='select'?Array.from(document.querySelectorAll('.af-client-cb:checked')).map(el=>el.value):[];
  const af=withTrainer({
    id:newId('af'),name,
    type:document.getElementById('af-type').value,
    trigger:document.getElementById('af-trigger')?.value||'inactivity',
    scope,clientIds,status:'active',steps,
    createdAt:new Date().toISOString()
  });
  window.AUTOFLOWS.push(af);
  persistById('autoflows',af);
  closeM('m-autoflow-builder');
  document.getElementById('af-name').value='';
  document.getElementById('af-steps').innerHTML='';
  enrollScopeClients(af,true);
  if(autoTab==='autoflow')renderAutoflows();
  notify('✓ Autoflow zapisany. Obecni bez spamu wstecz — nowi dostaną krok 1.');
  runAutoflowsCheck(true);
}

function ensureAfState(){
  if(!window.AF_STATE)window.AF_STATE={enrollments:{},executed:{},lastFired:{},logs:[]};
  const s=window.AF_STATE;
  if(!s.enrollments)s.enrollments={};
  if(!s.executed)s.executed={};
  if(!s.lastFired)s.lastFired={};
  if(!s.logs)s.logs=[];
  return s;
}

function afClientsFor(af){
  const active=(window.CL||[]).filter(c=>c.status!=='archived');
  if(af.scope==='select')return active.filter(c=>(af.clientIds||[]).indexOf(c.id)>=0);
  if(af.scope==='new'){
    const since=(af.createdAt||'').split('T')[0];
    return active.filter(c=>{
      const joined=c.joinDate||(c.createdAt||'').split('T')[0];
      return since&&joined&&joined>=since;
    });
  }
  return active;
}

function enrollClientInAutoflow(af,c,skipPast){
  const state=ensureAfState();
  const todayISO=new Date().toISOString().split('T')[0];
  if(!state.enrollments[af.id])state.enrollments[af.id]={};
  if(!state.executed[af.id])state.executed[af.id]={};
  if(state.enrollments[af.id][c.id])return false;
  state.enrollments[af.id][c.id]=todayISO;
  state.executed[af.id][c.id]={};
  if(skipPast){
    (af.steps||[]).forEach((step,si)=>{if(step.type!=='wait')state.executed[af.id][c.id][si]=true;});
  }
  return true;
}

function enrollScopeClients(af,skipPast){
  afClientsFor(af).forEach(c=>enrollClientInAutoflow(af,c,skipPast));
  saveAutomationState();
}

function enrollNewClientInAutoflows(c){
  (window.AUTOFLOWS||[]).filter(af=>af.status==='active').forEach(af=>{
    if(af.scope==='select'&&(af.clientIds||[]).indexOf(c.id)<0)return;
    enrollClientInAutoflow(af,c,false);
  });
  saveAutomationState();
  runAutoflowsCheck(false);
}

function logAF(af,c,text){
  const state=ensureAfState();
  state.logs.unshift({at:new Date().toISOString(),af:af.name,client:c.name,text:(text||'').substring(0,80)});
  state.logs=state.logs.slice(0,40);
}

function runAutoflowsCheck(showToast){
  const state=ensureAfState();
  const today=new Date();
  const todayISO=today.toISOString().split('T')[0];
  let changed=false;
  let ran=0;
  (window.AUTOFLOWS||[]).filter(af=>af.status==='active').forEach(af=>{
    if(!state.enrollments[af.id])state.enrollments[af.id]={};
    if(!state.executed[af.id])state.executed[af.id]={};
    if(!state.lastFired[af.id])state.lastFired[af.id]={};
    afClientsFor(af).forEach(c=>{
      if(!state.enrollments[af.id][c.id])return;
      const enrolledAt=new Date(state.enrollments[af.id][c.id]);
      const daysSince=Math.max(0,Math.floor((today-enrolledAt)/86400000));
      if(!state.executed[af.id][c.id])state.executed[af.id][c.id]={};
      (af.steps||[]).forEach((step,si)=>{
        if(step.type==='wait')return;
        if(af.type==='sequence'){
          if(daysSince>=(step.day||1)-1&&!state.executed[af.id][c.id][si]){
            execAFStep(step,c,af);
            state.executed[af.id][c.id][si]=true;
            changed=true;ran++;
          }
        }else{
          const kind=af.trigger||'inactivity';
          if(!state.lastFired[af.id][c.id])state.lastFired[af.id][c.id]={};
          const lastFired=state.lastFired[af.id][c.id][si];
          const daysSinceLastFired=lastFired?Math.floor((today-new Date(lastFired))/86400000):999;
          let fire=false;
          if(kind==='inactivity'){
            const inactiveDays=(typeof formatClientActivity==='function'?formatClientActivity(c.id).days:0);
            const threshold=step.day||14;
            fire=inactiveDays>=threshold&&daysSinceLastFired>=7;
          }else if(kind==='session_today'){
            const leadMin=parseInt(window.SETTINGS?.notifications?.sessionReminderTime,10)||60;
            const sessions=(window.SE||[]).filter(s=>s.clientId===c.id&&s.date===todayISO);
            const hasWindow=sessions.some(s=>{
              if(!s.time)return true;
              const at=new Date(s.date+'T'+s.time+':00');
              const diffMin=Math.round((at.getTime()-today.getTime())/60000);
              return diffMin>=0&&diffMin<=leadMin;
            });
            fire=hasWindow&&daysSinceLastFired>=1;
          }else if(kind==='new_client'){
            fire=!state.executed[af.id][c.id][si];
          }
          if(fire){
            execAFStep(step,c,af);
            state.lastFired[af.id][c.id][si]=todayISO;
            state.executed[af.id][c.id][si]=true;
            changed=true;ran++;
          }
        }
      });
    });
  });
  if(changed)saveAutomationState();
  renderAutoflows();
  renderAutoflowLog();
  if(showToast)notify(ran?('✓ Wykonano '+ran+' krok(ów)'):'Brak zaległych kroków');
}

function execAFStep(step,c,af){
  const firstName=(c.name||'').split(' ')[0];
  const text=(step.text||'').replace(/\{imie\}/g,firstName);
  if(step.type==='message'){
    if(typeof pushMsg==='function')pushMsg(c.id,text);
  }else if(step.type==='task'){
    const t=withTrainer({id:newId('t'),clientId:c.id,title:text,status:'open',priority:'medium',cat:'trening',due:new Date().toISOString().split('T')[0],createdAt:new Date().toISOString()});
    window.TASKS.push(t);
    persistById('tasks',t);
  }else if(step.type==='form'){
    const form=(typeof allForms==='function'?allForms():[]).find(f=>(f.name||'').toLowerCase().includes((text||'').toLowerCase())||(text||'').toLowerCase().includes((f.name||'').toLowerCase()));
    if(form){
      if(typeof createFormSend==='function')createFormSend(form,c.id);
      else{
        const send=withTrainer({id:newId('fs'),formId:form.id,formName:form.name,clientId:c.id,sentAt:new Date().toLocaleDateString('pl'),status:'sent',answers:{}});
        window.FORM_SENDS.push(send);
        persistById('formSends',send);
        if(typeof pushMsg==='function')pushMsg(c.id,'Formularz: '+(form.name||text));
      }
    }else if(typeof pushMsg==='function'){
      pushMsg(c.id,text);
    }
  }
  logAF(af||{name:'Autoflow'},c,text);
  if(typeof addNotification==='function')addNotification('system','Autoflow',text.substring(0,60)+' — '+c.name,'automation');
}

function saveAutomationState(){
  if(!window._db)return;
  withTrainer(window.AF_STATE);
  const payload={...window.AF_STATE};
  delete payload._fbId;
  const docId=window._afStateDocId||window._uid||'default';
  window._afStateDocId=docId;
  window._setDoc(window._doc(window._db,'automationState',docId),payload,{merge:true}).catch(e=>console.warn('AF state save:',e));
}

function notify(msg){
  const old=document.querySelector('.notif');if(old)old.remove();
  const d=document.createElement('div');d.className='notif';
  // Bezpiecznie: textContent zamiast innerHTML (toast może zawierać imię klienta / treść z inputu).
  d.textContent=String(msg??'').replace(/<[^>]*>/g,'');
  document.body.appendChild(d);setTimeout(()=>d.remove(),3000);
}

// ════════════════════════════════════════
// BAZA WIEDZY (KB) — zasady, badania, kontekst planowania
// ════════════════════════════════════════
window.KB = window.KB || [];
window._kbFilter = window._kbFilter || 'all';

function setKbFilter(f,btn){
  window._kbFilter=f||'all';
  document.querySelectorAll('#kb-filters .wl-filter-chip').forEach(b=>b.classList.toggle('active',b===btn||b.dataset.kbF===window._kbFilter));
  renderKB();
}
window.setKbFilter=setKbFilter;

function openKbModal(prefill){
  const p=prefill||{};
  document.getElementById('kb-modal-title').textContent=p.title?'EDYTUJ WPIS':'NOWY WPIS DO BAZY WIEDZY';
  document.getElementById('kb-kind').value=p.kind||'principle';
  document.getElementById('kb-title').value=p.title||'';
  document.getElementById('kb-text').value=p.text||'';
  document.getElementById('kb-citation').value=p.citation||'';
  document.getElementById('kb-url').value=p.sourceUrl||'';
  document.getElementById('kb-use-planning').checked=p.useInPlanning!==false;
  kbKindHint();
  openM('m-kb');
}
window.openKbModal=openKbModal;

function kbKindHint(){
  const kind=document.getElementById('kb-kind')?.value||'note';
  const el=document.getElementById('kb-kind-hint');
  if(!el)return;
  if(kind==='evidence')el.textContent='Dodaj link PubMed/DOI jeśli masz — aplikacja nie ściąga badań automatycznie, ale AI i panel „Dlaczego tak?” pokażą Twoje źródło.';
  else if(kind==='principle')el.textContent='Twoje doświadczenie coachingowe ma priorytet w generatorze AI, gdy koliduje z ogólnikami.';
  else el.textContent='Notatka ogólna — też może trafić do planu, jeśli zaznaczysz „Używaj przy planowaniu”.';
}
window.kbKindHint=kbKindHint;

function kbKindLabel(kind){
  const k=typeof normalizeKbKind==='function'?normalizeKbKind({kind}):kind;
  return k==='evidence'?'Badanie':(k==='principle'?'Zasada':'Notatka');
}
function kbKindColor(kind){
  const k=typeof normalizeKbKind==='function'?normalizeKbKind({kind}):kind;
  return k==='evidence'?'var(--teal)':(k==='principle'?'var(--accent)':'var(--blue)');
}

function renderKB(){
  const el = document.getElementById('kb-list'); if(!el) return;
  const filter=window._kbFilter||'all';
  const list=(KB||[]).slice().reverse().filter(k=>{
    if(filter==='all')return true;
    const kind=typeof normalizeKbKind==='function'?normalizeKbKind(k):(k.kind||'note');
    return kind===filter;
  });
  renderKbBuiltinPreview();
  if(!list.length){
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><div style="font-size:36px;margin-bottom:10px;opacity:0.3;">📚</div><div>Brak wpisów'+(filter!=='all'?' w tej kategorii':'')+'. Dodaj zasadę, badanie albo wczytaj pakiet startowy.</div></div>';
    return;
  }
  el.innerHTML = list.map(k=>{
    const kind=typeof normalizeKbKind==='function'?normalizeKbKind(k):(k.kind||'note');
    const planOn=typeof kbEntryUsesInPlanning==='function'?kbEntryUsesInPlanning(k):k.useInPlanning!==false;
    const url=k.sourceUrl?`<a href="${escHtml(k.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:var(--teal);">Źródło ↗</a>`:'';
    const cite=k.citation?`<div style="font-size:11px;color:var(--muted);margin-top:4px;">${escHtml(k.citation)}</div>`:'';
    return `<div class="card-sm" style="border-left:3px solid ${kbKindColor(kind)};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
            <span class="pill" style="font-size:10px;background:rgba(255,255,255,0.06);color:${kbKindColor(kind)};">${kbKindLabel(kind)}</span>
            ${planOn?'<span class="pill" style="font-size:10px;background:rgba(74,222,128,0.12);color:#4ade80;">Planowanie</span>':''}
          </div>
          <div style="font-size:13px;font-weight:700;">${escHtml(k.title)}</div>
        </div>
        <button onclick="delKBEntry('${k.id}')" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;">×</button>
      </div>
      <div style="font-size:12px;color:var(--muted);line-height:1.6;white-space:pre-wrap;">${escHtml((k.text||'').substring(0,280))}${(k.text||'').length>280?'…':''}</div>
      ${cite}
      <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">${url}</div>
    </div>`;
  }).join('');
}

function renderKbBuiltinPreview(){
  const wrap=document.getElementById('kb-builtin-preview');
  if(!wrap)return;
  const pack=window.BUILTIN_PLANNING_EVIDENCE||[];
  if(!pack.length){wrap.innerHTML='';return;}
  const imported=new Set((KB||[]).map(k=>k.builtinId).filter(Boolean));
  const missing=pack.filter(b=>!imported.has(b.id));
  wrap.innerHTML=`<div class="card-sm" style="border:1px dashed var(--border2);">
    <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Pakiet startowy (wbudowany)</div>
    <div style="font-size:11px;color:var(--muted);line-height:1.55;margin-bottom:8px;">
      ${pack.length} zasad/źródeł zawsze w kontekście AI i panelu „Dlaczego tak?”.
      ${missing.length?` Możesz skopiować ${missing.length} do swojej bazy (edytowalne).`:' Wszystkie skopiowane do Twojej bazy.'}
    </div>
    <ul style="margin:0 0 10px;padding-left:16px;font-size:11px;color:var(--text-secondary);line-height:1.5;">
      ${pack.slice(0,4).map(b=>`<li>${escHtml(b.title)}${b.sourceUrl?' · PubMed':''}</li>`).join('')}
      ${pack.length>4?`<li>+${pack.length-4} więcej…</li>`:''}
    </ul>
    ${missing.length?`<button type="button" class="btn btn-ghost btn-sm" onclick="kbImportBuiltinPack()">📚 Dodaj pakiet do mojej bazy</button>`:''}
  </div>`;
}

async function kbImportBuiltinPack(){
  const pack=window.BUILTIN_PLANNING_EVIDENCE||[];
  if(!pack.length){notify('Brak pakietu startowego');return;}
  const have=new Set((KB||[]).map(k=>k.builtinId).filter(Boolean));
  let n=0;
  for(const b of pack){
    if(have.has(b.id))continue;
    const entry=withTrainer({
      id:newId('kb'),kind:b.kind,title:b.title,text:b.text,
      citation:b.citation||'',sourceUrl:b.sourceUrl||'',
      useInPlanning:true,builtinId:b.id,createdAt:new Date().toISOString()
    });
    KB.push(entry);
    n++;
    await persistById('kb',entry);
  }
  renderKB();
  if(typeof builderRefreshRationale==='function')try{builderRefreshRationale();}catch(e){}
  if(typeof aplRefreshRationale==='function')try{aplRefreshRationale();}catch(e){}
  notify(n?`✓ Dodano ${n} wpisów z pakietu startowego`:'✓ Pakiet już był w bazie');
}
window.kbImportBuiltinPack=kbImportBuiltinPack;

async function saveKBEntry(){
  if(window._saveGuard_saveKBEntry)return;window._saveGuard_saveKBEntry=true;setTimeout(()=>window._saveGuard_saveKBEntry=false,1500);

  const title = document.getElementById('kb-title').value.trim();
  const text = document.getElementById('kb-text').value.trim();
  if(!title || !text){notify('Wpisz tytuł i treść!'); return;}
  const kind=document.getElementById('kb-kind')?.value||'note';
  const citation=(document.getElementById('kb-citation')?.value||'').trim();
  const sourceUrl=(document.getElementById('kb-url')?.value||'').trim();
  const useInPlanning=!!document.getElementById('kb-use-planning')?.checked;
  const entry = withTrainer({
    id:newId('kb'), kind, title, text, citation, sourceUrl, useInPlanning,
    createdAt:new Date().toISOString()
  });
  KB.push(entry);
  closeM('m-kb');
  ['kb-title','kb-text','kb-citation','kb-url'].forEach(id=>{const i=document.getElementById(id);if(i)i.value='';});
  const kindEl=document.getElementById('kb-kind');if(kindEl)kindEl.value='principle';
  const useEl=document.getElementById('kb-use-planning');if(useEl)useEl.checked=true;
  renderKB();
  if(typeof builderRefreshRationale==='function')try{builderRefreshRationale();}catch(e){}
  if(typeof aplRefreshRationale==='function')try{aplRefreshRationale();}catch(e){}
  notify('✓ Wpis dodany — '+(useInPlanning?'aktywny przy planowaniu':'tylko baza / AI Coach'));
  await persistById('kb', entry);
}

async function delKBEntry(id){
  if(!confirm('Usunąć wpis?')) return;
  window.KB = KB.filter(k=>k.id!==id);
  renderKB();
  if(typeof builderRefreshRationale==='function')try{builderRefreshRationale();}catch(e){}
  if(window._db){try{await window._del(window._doc(window._db,'kb',id));}catch(e){}}
}

function kbContextForAI(){
  const planning=typeof planningEvidenceContext==='function'?planningEvidenceContext(3500):'';
  const notes=(KB||[]).filter(k=>{
    const kind=typeof normalizeKbKind==='function'?normalizeKbKind(k):(k.kind||'note');
    return kind==='note'||k.useInPlanning===false;
  });
  let extra='';
  if(notes.length){
    extra='\n\n=== POZOSTAŁE NOTATKI TRENERA ===\n'+notes.map(k=>`### ${k.title}\n${(k.text||'').substring(0,500)}`).join('\n\n');
  }
  if(!planning&&!KB.length) return '';
  if(!planning){
    return '\n\n=== BAZA WIEDZY TRENERA (kontekst, wykorzystaj jeśli pomocne) ===\n'
      + KB.map(k=>`### ${k.title}\n${(k.text||'').substring(0,600)}`).join('\n\n');
  }
  return planning+extra;
}

window.renderKB=renderKB; window.saveKBEntry=saveKBEntry; window.delKBEntry=delKBEntry; window.kbContextForAI=kbContextForAI;

// expose

// ════════════════════════════════════════
// SYSTEM ZAPROSZEŃ KLIENTÓW
// ════════════════════════════════════════
var inviteClientId = null;
var inviteMethod = 'wiadomosc';
const APP_URL = 'https://teamprogress2018-droid.github.io/progress-live/';

function generateInviteLink(client) {
  if(typeof ensureClientInvite==='function'){
    // synchroniczny fallback — token jeśli już jest, inaczej tymczasowy link
    if(client.inviteToken)return (typeof clientAppUrl==='function'?clientAppUrl():APP_URL)+'?invite='+encodeURIComponent(client.inviteToken);
  }
  return APP_URL + '?invite=' + encodeURIComponent(client.inviteToken||client.id);
}

async function openInviteModal(clientId) {
  const c = CL.find(x => x.id === clientId);
  if (!c) return;
  inviteClientId = clientId;
  inviteMethod = 'wiadomosc';

  // Wypełnij avatar i dane
  const el = id => document.getElementById(id);
  if (el('inv-avatar')) el('inv-avatar').textContent = getInit(c.name);
  if (el('inv-name')) el('inv-name').textContent = c.name;
  if (el('inv-email')) el('inv-email').textContent = c.email || 'Brak emaila';

  if (el('inv-link')) el('inv-link').textContent = 'Generowanie linku...';
  openM('m-invite');
  const link = typeof ensureClientInvite==='function' ? await ensureClientInvite(c) : generateInviteLink(c);
  if (el('inv-link')) el('inv-link').textContent = link;

  // Reset przycisków metody
  document.querySelectorAll('.inv-method-btn').forEach(b => {
    const isActive = b.dataset.method === 'wiadomosc';
    b.style.background = isActive ? 'var(--adim)' : 'var(--s3)';
    b.style.borderColor = isActive ? 'var(--accent)' : 'var(--border2)';
    b.style.color = isActive ? 'var(--accent)' : 'var(--muted)';
  });

  updateInvitePreview(c, link, 'wiadomosc');
}

function selectInvMethod(btn) {
  inviteMethod = btn.dataset.method;
  document.querySelectorAll('.inv-method-btn').forEach(b => {
    const isActive = b === btn;
    b.style.background = isActive ? 'var(--adim)' : 'var(--s3)';
    b.style.borderColor = isActive ? 'var(--accent)' : 'var(--border2)';
    b.style.color = isActive ? 'var(--accent)' : 'var(--muted)';
  });
  const c = CL.find(x => x.id === inviteClientId);
  const link = document.getElementById('inv-link')?.textContent || '';
  if (c) updateInvitePreview(c, link, inviteMethod);
}

function updateInvitePreview(c, link, method) {
  const built = buildInviteMessage(c, link, method || 'wiadomosc');
  const el = document.getElementById('inv-msg-preview');
  if (el) el.textContent = built.preview;
  const sendBtn = document.getElementById('inv-send-btn');
  if (sendBtn) {
    const labels = { wiadomosc: '📤 Wyślij do Inbox', email: '✉️ Otwórz e-mail', whatsapp: '💚 Otwórz WhatsApp' };
    sendBtn.textContent = labels[method] || labels.wiadomosc;
  }
  const hint = document.getElementById('inv-channel-hint');
  if (hint) {
    const hints = {
      wiadomosc: 'Wiadomość trafi do czatu w Progress Live (Inbox klienta).',
      email: c.email
        ? 'Otworzy Twoją aplikację pocztową (mailto) z gotową treścią — wyślij stamtąd.'
        : 'Brak e-maila w karcie klienta — uzupełnij albo użyj Inbox / WhatsApp.',
      whatsapp: (typeof waPhone === 'function' ? waPhone(c.phone) : c.phone)
        ? 'Otworzy WhatsApp (wa.me) z gotową wiadomością — wyślij stamtąd.'
        : 'Brak telefonu w karcie klienta — uzupełnij albo użyj Inbox / e-mail.'
    };
    hint.textContent = hints[method] || hints.wiadomosc;
  }
}

/** Treści zaproszenia pod Inbox / mailto / wa.me. */
function buildInviteMessage(c, link, method) {
  const trainerName = typeof getTrainerName === 'function' ? getTrainerName('Twój trener') : 'Twój trener';
  const firstName = String(c && c.name || 'hej').split(' ')[0];
  const url = link || (c && c.inviteLink) || '';
  const emailBody = `Cześć ${firstName},\n\nZ przyjemnością zapraszam Cię do aplikacji Progress Live, gdzie znajdziesz swój plan treningowy, postępy i kontakt ze mną.\n\n➡️ Kliknij aby się zarejestrować:\n${url}\n\nPozdrawiam,\n${trainerName}`;
  const waBody = `Hej ${firstName}! 🏋️ Twoja aplikacja treningowa jest gotowa!\n\n👉 ${url}\n\nZaloguj się i sprawdź swój plan. Do zobaczenia! 💪`;
  const inboxBody = `Cześć ${firstName}! 👋\n\nWitaj w Progress Live — Twojej aplikacji treningowej!\n\n🔗 Twój link do aplikacji:\n${url}\n\nZaloguj się emailem: ${(c && c.email) || '[Twój email]'}\nPrzy pierwszym wejściu ustaw hasło.\nDo zobaczenia na treningu! 💪\n\n— ${trainerName}`;
  if (method === 'email') {
    return {
      subject: 'Zaproszenie do aplikacji Progress Live',
      body: emailBody,
      preview: 'Temat: Zaproszenie do aplikacji Progress Live\n\n' + emailBody
    };
  }
  if (method === 'whatsapp') {
    return { subject: '', body: waBody, preview: waBody };
  }
  return { subject: '', body: inboxBody, preview: inboxBody };
}
window.buildInviteMessage = buildInviteMessage;

function copyInviteLink() {
  const link = document.getElementById('inv-link')?.textContent || '';
  navigator.clipboard.writeText(link)
    .then(() => notify('✓ Link skopiowany do schowka!'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = link; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      notify('✓ Link skopiowany!');
    });
}

function sendInvitation() {
  const c = CL.find(x => x.id === inviteClientId);
  if (!c) return;
  const link = document.getElementById('inv-link')?.textContent || '';
  const method = inviteMethod || 'wiadomosc';
  const built = buildInviteMessage(c, link, method);
  const preview = document.getElementById('inv-msg-preview')?.textContent || built.preview;

  // Zawsze zostaw kopię w Inbox aplikacji
  if (typeof pushMsg === 'function') pushMsg(c.id, preview);

  c.inviteSent = true;
  c.appInvited = true;
  c.inviteLink = link;
  c.inviteSentAt = new Date().toISOString();
  c.inviteMethod = method;
  persistById('clients', c);

  let channelLabel = 'Inbox';
  let openedExternal = false;

  if (method === 'email') {
    if (!c.email) {
      notify('⚠ Brak e-maila w karcie — zapisano w Inbox');
      channelLabel = 'Inbox (brak e-maila)';
    } else {
      const href = 'mailto:' + encodeURIComponent(c.email)
        + '?subject=' + encodeURIComponent(built.subject)
        + '&body=' + encodeURIComponent(built.body);
      try { window.open(href, '_blank'); openedExternal = true; } catch (e) { window.location.href = href; openedExternal = true; }
      channelLabel = 'e-mail';
    }
  } else if (method === 'whatsapp') {
    const phone = typeof waPhone === 'function' ? waPhone(c.phone) : String(c.phone || '').replace(/\D/g, '');
    if (!phone) {
      notify('⚠ Brak telefonu w karcie — zapisano w Inbox');
      channelLabel = 'Inbox (brak telefonu)';
    } else {
      const href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(built.body);
      window.open(href, '_blank', 'noopener');
      openedExternal = true;
      channelLabel = 'WhatsApp';
    }
  }

  if (typeof fireIntEvent === 'function') {
    try {
      fireIntEvent('invite.sent', {
        invite: { clientId: c.id, method: method, link: link || '', channel: channelLabel, external: openedExternal },
        client: { id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || '' }
      });
    } catch (e) { console.warn('fireIntEvent invite', e); }
  }

  if (typeof addNotification === 'function') {
    addNotification('system', 'Zaproszenie wysłane', c.name + ' · ' + channelLabel, 'clients');
  }
  closeM('m-invite');
  if (method === 'wiadomosc' || !openedExternal) {
    notify('✅ Zaproszenie do ' + c.name + ': ' + channelLabel);
  } else {
    notify('✅ Zapisano w Inbox · otwarto ' + channelLabel + ' — dokończ wysyłkę');
  }
  if (typeof maybeResumeOnboard === 'function') maybeResumeOnboard(c.id);
  if (typeof renderClients === 'function') try { renderClients(); } catch (e) {}
  if (typeof renderDash === 'function') try { renderDash(); } catch (e) {}
}

window.openInviteModal = openInviteModal;
window.selectInvMethod = selectInvMethod;
window.copyInviteLink = copyInviteLink;
window.sendInvitation = sendInvitation;
window.generateInviteLink = generateInviteLink;
// ════ KONIEC SYSTEM ZAPROSZEŃ ════


// ═══════════════════════════════════════
// TRYB PRYWATNY
// ═══════════════════════════════════════
var privateModeActive = false;

function togglePrivateMode(){
  privateModeActive = !privateModeActive;
  const btn = document.getElementById('private-mode-btn');
  const bar = document.getElementById('private-bar');

  if(privateModeActive){
    // Włącz
    if(bar) bar.classList.add('on');
    if(btn) btn.classList.add('active');
    // Ukryj kafelek KPI przychodów
    const kpi = document.getElementById('dash-revenue-kpi');
    if(kpi) kpi.classList.add('priv-hidden');
    // Ukryj wykres przychodów
    const chart = document.getElementById('dash-revenue-chart');
    if(chart) chart.classList.add('priv-hidden');
    // Zablokuj nawigację do Płatności
    document.querySelectorAll('.nav-item').forEach(b=>{
      if(b.textContent.trim().includes('Płatności')){
        b.dataset.privDisabled='1';
        b.style.opacity='0.3';
        b.style.pointerEvents='none';
      }
    });
    // Jeśli jesteśmy na Płatnościach — wróć
    const active = document.querySelector('.screen.active') || document.querySelector('.screen[style*="flex"]');
    if(active && active.id === 'screen-payments') goTo('dashboard');
    notify('🔒 Tryb prywatny włączony');
  } else {
    // Wyłącz
    if(bar) bar.classList.remove('on');
    if(btn) btn.classList.remove('active');
    // Przywróć KPI
    const kpi = document.getElementById('dash-revenue-kpi');
    if(kpi) kpi.classList.remove('priv-hidden');
    // Przywróć wykres
    const chart = document.getElementById('dash-revenue-chart');
    if(chart) chart.classList.remove('priv-hidden');
    // Przywróć nawigację
    document.querySelectorAll('.nav-item').forEach(b=>{
      if(b.dataset.privDisabled){
        b.style.opacity='';
        b.style.pointerEvents='';
        delete b.dataset.privDisabled;
      }
    });
    // Odśwież dashboard
    try{ renderDash(); }catch(e){}
    notify('👁 Tryb prywatny wyłączony');
  }
}

window.togglePrivateMode = togglePrivateMode;

function toggleMoreNav(){
  const el=document.getElementById('nav-more-items');
  const arrow=document.getElementById('nav-more-arrow');
  if(!el)return;
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  if(arrow)arrow.style.transform=open?'':'rotate(180deg)';
}
window.toggleMoreNav=toggleMoreNav;

function closeLibraryFlyout(){
  const fly=document.getElementById('nav-library-flyout');
  const btn=document.getElementById('nav-library-btn');
  const wrap=document.getElementById('nav-library-wrap');
  if(fly){
    fly.setAttribute('hidden','');
    fly.style.left='';fly.style.top='';fly.style.right='';fly.style.bottom='';
    fly.style.width='';fly.style.maxHeight='';
    if(wrap&&fly.parentElement!==wrap)wrap.appendChild(fly);
  }
  if(btn)btn.setAttribute('aria-expanded','false');
}
function _positionLibraryFlyout(){
  const fly=document.getElementById('nav-library-flyout');
  const btn=document.getElementById('nav-library-btn');
  if(!fly||!btn||fly.hasAttribute('hidden'))return;
  // Portal to body so sidebar-nav overflow cannot clip the menu
  if(fly.parentElement!==document.body)document.body.appendChild(fly);
  const r=btn.getBoundingClientRect();
  const gap=10;
  const pad=8;
  const isNarrow=window.matchMedia('(max-width:900px)').matches;
  if(isNarrow){
    fly.style.left=pad+'px';
    fly.style.right=pad+'px';
    fly.style.width='auto';
    fly.style.top='auto';
    const spaceBelow=window.innerHeight-(r.bottom+gap);
    const preferAbove=spaceBelow<220;
    if(preferAbove){
      fly.style.bottom=(window.innerHeight-r.top+gap)+'px';
      fly.style.maxHeight=Math.max(160,r.top-gap-pad)+'px';
    }else{
      fly.style.bottom='auto';
      fly.style.top=(r.bottom+gap)+'px';
      fly.style.maxHeight=Math.max(160,window.innerHeight-r.bottom-gap-pad)+'px';
    }
    return;
  }
  fly.style.right='auto';
  fly.style.bottom='auto';
  fly.style.width='';
  let left=r.right+gap;
  const maxW=Math.min(280,window.innerWidth-pad*2);
  if(left+maxW>window.innerWidth-pad)left=Math.max(pad,r.left-maxW-gap);
  let top=Math.max(pad,r.top-8);
  fly.style.left=left+'px';
  fly.style.top=top+'px';
  fly.style.maxHeight=(window.innerHeight-top-pad)+'px';
  requestAnimationFrame(function(){
    if(fly.hasAttribute('hidden'))return;
    const fr=fly.getBoundingClientRect();
    let t=fr.top;
    if(fr.bottom>window.innerHeight-pad)t=Math.max(pad,window.innerHeight-pad-fr.height);
    if(t<pad)t=pad;
    fly.style.top=t+'px';
    fly.style.maxHeight=(window.innerHeight-t-pad)+'px';
  });
}
function toggleLibraryFlyout(ev){
  if(ev&&typeof ev==='object'){
    try{ev.preventDefault();}catch(e){}
    try{ev.stopPropagation();}catch(e){}
    try{ev.stopImmediatePropagation&&ev.stopImmediatePropagation();}catch(e){}
  }
  const fly=document.getElementById('nav-library-flyout');
  const btn=document.getElementById('nav-library-btn');
  if(!fly)return;
  const open=fly.hasAttribute('hidden');
  if(open){
    fly.removeAttribute('hidden');
    if(btn)btn.setAttribute('aria-expanded','true');
    window._libFlyIgnoreUntil=Date.now()+280;
    _positionLibraryFlyout();
  }else closeLibraryFlyout();
}
function _libraryFlyoutOutside(e){
  if(window._libFlyIgnoreUntil&&Date.now()<window._libFlyIgnoreUntil)return;
  const wrap=document.getElementById('nav-library-wrap');
  const fly=document.getElementById('nav-library-flyout');
  if(!wrap||!fly||fly.hasAttribute('hidden'))return;
  if(wrap.contains(e.target)||fly.contains(e.target))return;
  closeLibraryFlyout();
}
function _libraryFlyoutReposition(){
  const fly=document.getElementById('nav-library-flyout');
  if(!fly||fly.hasAttribute('hidden'))return;
  _positionLibraryFlyout();
}
document.addEventListener('click',_libraryFlyoutOutside);
window.addEventListener('resize',_libraryFlyoutReposition);
document.addEventListener('scroll',_libraryFlyoutReposition,true);
window.toggleLibraryFlyout=toggleLibraryFlyout;
window.closeLibraryFlyout=closeLibraryFlyout;
window._positionLibraryFlyout=_positionLibraryFlyout;

window.goTo=goTo;window.openM=openM;window.closeM=closeM;
window.saveClient=saveClient;window.saveSess=saveSess;window.saveEx=saveEx;window.savePlan=savePlan;window.delPlan=delPlan;
window.addDay=addDay;window.addRow=addRow;window.toggleR=toggleR;window.updatePeriod=updatePeriod;
window.askAI=askAI;window.sendMsg=sendMsg;window.openChat=openChat;
window.setInboxTab=setInboxTab;window.useQuickReply=useQuickReply;
window.addClientNote=addClientNote;window.saveClientNote=saveClientNote;
window.sendBroadcast=sendBroadcast;
window.renderLib=renderLib;window.renderWL=renderWL;
window.setWLNav=setWLNav;window.setWLView=setWLView;window.setWLSort=setWLSort;
window.openWLDetail=openWLDetail;window.closeWLDetail=closeWLDetail;
window.assignWorkout=assignWorkout;window.assignWorkoutDirect=assignWorkoutDirect;
window.openAssignWorkoutModal=openAssignWorkoutModal;window.confirmAssignWorkout=confirmAssignWorkout;
window.addWExRow=addWExRow;window.saveWorkout=saveWorkout;
window.setDashPeriod=setDashPeriod;
window.openReportModal=openReportModal;window.openReportForClient=openReportForClient;
window.previewReportOptions=previewReportOptions;window.generateReport=generateReport;
window.reportClose=reportClose;window.reportPrint=reportPrint;
window.renderIntegrations=renderIntegrations;window.setIntTab=setIntTab;
window.setIntCat=setIntCat;window.openIntDetail=openIntDetail;window.closeIntDetail=closeIntDetail;
window.connectInt=connectInt;window.disconnectInt=disconnectInt;
window.testIntConnection=testIntConnection;window.copyWebhook=copyWebhook;
window.downloadSessionsIcs=downloadSessionsIcs;window.intRemindWhatsApp=intRemindWhatsApp;
window.intRemindEmail=intRemindEmail;window.intOpenCalendly=intOpenCalendly;
window.intSendCalendly=intSendCalendly;window.intPushCalendly=intPushCalendly;
window.intTestWebhook=intTestWebhook;window.fireIntEvent=fireIntEvent;window.intWorksNow=intWorksNow;
window.initClientApp=initClientApp;window.renderClientApp=renderClientApp;
window.setCapTab=setCapTab;window.setCapScreen=setCapScreen;window.setCapDevice=setCapDevice;
window.shareAppLink=shareAppLink;window.sendAppInvite=sendAppInvite;window.inviteClientToApp=inviteClientToApp;
window.exportInvoicesCsv=exportInvoicesCsv;window.exportRepHistoryCsv=exportRepHistoryCsv;window.exportData=exportData;
window.pbNewProgram=pbNewProgram;window.pbLoadDemo=pbLoadDemo;
window.pbAssign=pbAssign;window.pbSave=pbSave;window.pbSetWeek=pbSetWeek;
window.pbToggleRest=pbToggleRest;window.pbUpdateDayName=pbUpdateDayName;
window.pbUpdateEx=pbUpdateEx;window.pbRemoveEx=pbRemoveEx;
window.pbAddExToDay=pbAddExToDay;window.pbAddExFromLib=pbAddExFromLib;
window.pbCopyWeekFrom=pbCopyWeekFrom;window.pbAddDeload=pbAddDeload;
window.renderPBExList=renderPBExList;window.pbAskAI=pbAskAI;window.pbQuickAI=pbQuickAI;
window.pbRebuildWeeks=pbRebuildWeeks;
window.renderCheckin=renderCheckin;window.setCIFilter=setCIFilter;
window.openCIClient=openCIClient;window.openSimulateCheckin=openSimulateCheckin;
window.openCIFill=openCIFill;window.ciFillPick=ciFillPick;window.saveCheckinFill=saveCheckinFill;
window.sendCheckinTo=sendCheckinTo;window.sendCheckin=sendCheckin;
window.replyToCheckin=replyToCheckin;
window.setSettingsTab=setSettingsTab;window.toggleSetting=toggleSetting;
window.setAccentColor=setAccentColor;window.addSpecialty=addSpecialty;
window.removeSpecialty=removeSpecialty;window.exportData=exportData;
window.confirmDeleteAll=confirmDeleteAll;window.saveSettings=saveSettings;
window.toggleNotifs=toggleNotifs;window.closeNotifs=closeNotifs;
window.setNotifTab=setNotifTab;window.markAllRead=markAllRead;
window.clearAllNotifs=clearAllNotifs;window.clickNotif=clickNotif;
window.addNotification=addNotification;window.generateAutoNotifs=generateAutoNotifs;
window.renderForum=renderForum;window.setForumGroup=setForumGroup;window.setForumFilter=setForumFilter;
window.openForumPost=openForumPost;window.addComment=addComment;
window.likeComment=likeComment;window.reactToPost=reactToPost;window.addReaction=addReaction;
window.closeForumDetail=closeForumDetail;window.saveForumGroup=saveForumGroup;window.saveForumPost=saveForumPost;
window.toggleForumPin=toggleForumPin;window.deleteForumPost=deleteForumPost;window.deleteForumComment=deleteForumComment;
window.renderForumGroupMembers=renderForumGroupMembers;window.fillForumPostGroupSelect=fillForumPostGroupSelect;
window.setCalView=setCalView;window.calNav=calNav;window.calNavToday=calNavToday;
window.calMiniNav=calMiniNav;window.calClickDay=calClickDay;window.calJumpTo=calJumpTo;
window.quickAddSession=quickAddSession;window.openSessDetail=openSessDetail;
window.editSession=editSession;window.delSession=delSession;window.saveTask=saveTask;window.toggleTask=toggleTask;window.delTask=delTask;
window.editTask=editTask;window.renderTasks=renderTasks;window.setTaskFilter=setTaskFilter;window.applyHabitChip=applyHabitChip;window.applyChallengeChip=applyChallengeChip;
window.openTaskTemplates=openTaskTemplates;window.closeTaskTemplates=closeTaskTemplates;
window.applyTemplate=applyTemplate;window.askTaskAI=askTaskAI;window.addAITask=addAITask;
window.setClientSegment=setClientSegment;window.filterClients=filterClients;
window.setExView=setExView;window.openExDetail=openExDetail;window.closeExDetail=closeExDetail;
window.setLibTab=setLibTab;window.saveOwnVideo=saveOwnVideo;window.editOwnVideo=editOwnVideo;window.delOwnVideo=delOwnVideo;
window.prefillExInBuilder=prefillExInBuilder;window.prefillExInWorkout=prefillExInWorkout;
window.askExAI=askExAI;
window.renderPrograms=renderPrograms;window.setProgNav=setProgNav;window.setProgDurFilter=setProgDurFilter;
window.openProgDetail=openProgDetail;window.closeProgDetail=closeProgDetail;
window.assignProgramToClient=assignProgramToClient;window.openAssignProg=openAssignProg;
window.confirmAssignProgram=confirmAssignProgram;window.saveUserProgram=saveUserProgram;
window.renderForms=renderForms;window.setFormNav=setFormNav;
window.openFormDetail=openFormDetail;window.closeFormDetail=closeFormDetail;
window.openSendForm=openSendForm;window.confirmSendForm=confirmSendForm;
window.toggleFormSendAnswers=toggleFormSendAnswers;window.createFormSend=createFormSend;window.renderCPForms=renderCPForms;
window.selectScale=selectScale;window.selectYN=selectYN;
window.addFormQ=addFormQ;window.saveCustomForm=saveCustomForm;
window.renderMetrics=renderMetrics;window.setMetricGroup=setMetricGroup;window.setMetricView=setMetricView;
window.saveQuickEntry=saveQuickEntry;window.delMetricEntry=delMetricEntry;
window.addMetricField=addMetricField;window.selectMetricIcon=selectMetricIcon;
window.saveMetricGroup=saveMetricGroup;window.updateMetricEntryForm=updateMetricEntryForm;
window.saveMetricEntry=saveMetricEntry;window.askMetricAI=askMetricAI;
window.setAutoTab=setAutoTab;window.toggleOnboarding=toggleOnboarding;window.updateOSC=updateOSC;
window.addOSCForm=addOSCForm;window.saveOnboardingFlow=saveOnboardingFlow;
window.renderAutoflows=renderAutoflows;window.toggleAF=toggleAF;
window.addAFStep=addAFStep;window.saveAutoflow=saveAutoflow;
window.runAutoflowsCheck=runAutoflowsCheck;window.deleteAutoflow=deleteAutoflow;
if(typeof ensureReminderAutoflowsFromSettings==='function')ensureReminderAutoflowsFromSettings();
window.updateAfBuilderUi=updateAfBuilderUi;window.fillAutomationSelects=fillAutomationSelects;
window.setResTab=setResTab;window.setResNav=setResNav;window.renderResources=renderResources;
window.viewCollection=viewCollection;window.shareCollection=shareCollection;
window.sendResourceToClient=sendResourceToClient;window.saveResource=saveResource;
window.setODTab=setODTab;window.renderODBrowse=renderODBrowse;
window.renderODWorkouts=renderODWorkouts;window.renderODPrograms=renderODPrograms;
window.shareODWorkout=shareODWorkout;window.shareODProgram=shareODProgram;
window.saveODWorkout=saveODWorkout;window.openODWorkout=openODWorkout;window.closeODPlayer=closeODPlayer;
window.setPayTab=setPayTab;window.renderPayOverview=renderPayOverview;
window.renderPayPackages=renderPayPackages;window.renderPayInvoices=renderPayInvoices;
window.renderPayHistory=renderPayHistory;window.savePackage=savePackage;
window.usePackageSession=usePackageSession;window.markPaid=markPaid;
window.requestPayment=requestPayment;window.deletePackage=deletePackage;window.copyPayTransfer=copyPayTransfer;
window.copyPackageTransfer=copyPackageTransfer;window.clientNotifyPaid=clientNotifyPaid;
window.clientUnpaidPackages=clientUnpaidPackages;window.packagesAwaitingPayment=packagesAwaitingPayment;window.payTransferText=payTransferText;
window.viewInvoice=viewInvoice;window.filterPkgByClient=filterPkgByClient;
window.openClientModal=openClientModal;
window.setCPTab=setCPTab;window.saveCPEdit=saveCPEdit;window.startCPEdit=startCPEdit;window.cancelCPEdit=cancelCPEdit;window.archiveClient=archiveClient;window.restoreClient=restoreClient;window.deleteClientPermanently=deleteClientPermanently;window.refreshClientProfileRemoveActions=refreshClientProfileRemoveActions;
window.renderCPTraining=renderCPTraining;window.renderCPFood=renderCPFood;
window.renderCPDocuments=renderCPDocuments;window.renderCPSettings=renderCPSettings;
window.toggleClientFeature=toggleClientFeature;window.updateClientUnit=updateClientUnit;
window.addFoodEntry=addFoodEntry;window.viewFoodEntry=viewFoodEntry;
window.addClientDoc=addClientDoc;window.delClientDoc=delClientDoc;
window.openAddSessionFromCP=openAddSessionFromCP;
window.delPlanFromProfile=delPlanFromProfile;window.cpAssignTemplate=cpAssignTemplate;window.liveSelectPlanForClient=liveSelectPlanForClient;
window.cpOpenSession=cpOpenSession;window.cpOpenTask=cpOpenTask;
// alias for old renderClients reference
window.openClientDetail=openClientProfile;
window.calcTDEE=calcTDEE;window.setCalcActivity=setCalcActivity;window.setCalcGoal=setCalcGoal;
window.setCalcMacro=setCalcMacro;window.syncSliders=syncSliders;
window.calcLoadFromClient=calcLoadFromClient;window.calcSendToClient=calcSendToClient;

updateExDl();
// init notifications
setTimeout(()=>{updateNotifBadge();},500);
