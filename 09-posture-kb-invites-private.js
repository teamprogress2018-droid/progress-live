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
        <div style="padding:6px 8px;background:${active&&has?'rgba(225,31,46,0.1)':'var(--s2)'};border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;font-weight:700;color:${active&&has?'var(--accent)':'var(--text)'};">${labels[view]}</span>
          ${has?`<span style="font-size:9px;color:var(--muted);">zmień</span>`:`<span style="font-size:9px;color:var(--muted);">brak</span>`}
        </div>
      </div>
    </label>`;
  }).join('');

  const viewBtns=Object.entries(labels).filter(([v])=>p.photos[v]).map(([v,l])=>
    `<button onclick="postureSetActive('${c.id}','${v}')" style="padding:5px 14px;border-radius:6px;border:1px solid ${p.currentPhoto===v?'var(--accent)':'var(--border2)'};background:${p.currentPhoto===v?'rgba(225,31,46,0.1)':'var(--s3)'};color:${p.currentPhoto===v?'var(--accent)':'var(--muted)'};font-size:11px;font-weight:${p.currentPhoto===v?700:400};cursor:pointer;transition:all 0.12s;">${l}</button>`
  ).join('');

  document.getElementById('cp-body').innerHTML=`
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

function toggleCpMoreNav(){
  const el=document.getElementById('cp-more-items');
  const arrow=document.getElementById('cp-more-arrow');
  if(!el)return;
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  if(arrow)arrow.style.transform=open?'':'rotate(180deg)';
}
window.toggleCpMoreNav=toggleCpMoreNav;
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
  c.age=parseInt(document.getElementById('cpe-age').value)||c.age;
  c.weight=parseFloat(document.getElementById('cpe-weight').value)||c.weight;
  c.height=parseInt(document.getElementById('cpe-height').value)||c.height;
  c.goal=document.getElementById('cpe-goal').value;
  c.level=document.getElementById('cpe-level').value;
  c.status=document.getElementById('cpe-status').value;
  c.notes=document.getElementById('cpe-notes').value;
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
  notify('✓ Profil "'+c.name+'" zaktualizowany!');
}

function archiveClient(id){
  if(!confirm('Zarchiwizować klienta?'))return;
  const c=CL.find(x=>x.id===id);
  if(c){
    c.status='archived';
    persistById('clients',c);
    try{renderClients();}catch(e){}
    try{document.getElementById('nb-clients').textContent=CL.length;}catch(e){}
    closeClientProfile();
    notify('✓ Klient '+c.name+' zarchiwizowany');
  }
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
  }
}

function requestPayment(id){
  const p=allPackages().find(x=>x.id===id);
  if(!p){notify('Nie znaleziono pakietu');return;}
  if(!p.clientId){notify('Pakiet bez klienta');return;}
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
  notify('✓ Prośba o wpłatę poszła do czatu klienta');
  if(typeof addNotification==='function')addNotification('payment','Wysłano prośbę o wpłatę',(p.clientName||'')+' · '+(p.price||0)+' zł','inbox');
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
        <div style="background:var(--adim);border:1px solid rgba(225,31,46,0.2);border-radius:8px;padding:12px 20px;text-align:right;">
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
  notify('✓ Pakiet "'+title+'" dodany! Faktura '+invId+' wygenerowana.');
}
var odTab='browse';var odWorkoutFilter='all';
window.OD_WORKOUTS=[];

const OD_COLLECTIONS=[
  {id:'fbw',name:'Full Body',icon:'⚡',color:'var(--accent)',desc:'Treningi angażujące całe ciało',count:2},
  {id:'hiit',name:'HIIT / Cardio',icon:'🔥',color:'var(--red)',desc:'Intensywne interwały i cardio',count:1},
  {id:'sila',name:'Siła',icon:'💪',color:'var(--orange)',desc:'Treningi siłowe z obciążeniem',count:2},
  {id:'mobilnosc',name:'Mobilność',icon:'🧘',color:'var(--teal)',desc:'Stretching, mobilność i regeneracja',count:1},
];

const OD_DEMO_WORKOUTS=[
  {id:'ow1',name:'Full Body EMOM 30 min',type:'video',level:'sredni',time:30,coll:'fbw',color:'#1a1a2e',emoji:'⚡',desc:'Klasyczny protokół EMOM dla całego ciała. Idealne na dzień FBW.',views:0,likes:12},
  {id:'ow2',name:'HIIT Tabata — bez sprzętu',type:'video',level:'sredni',time:25,coll:'hiit',color:'#1a0a0a',emoji:'🔥',desc:'20s praca / 10s odpoczynek. Maksymalne spalanie.',views:0,likes:8},
  {id:'ow3',name:'Push Day — Klatka & Triceps',type:'workout',level:'sredni',time:55,coll:'sila',color:'#0a1a0a',emoji:'💪',desc:'Kompleksowy trening push z objętością hipertroficzną.',views:0,likes:15},
  {id:'ow4',name:'Pull Day — Plecy & Biceps',type:'workout',level:'sredni',time:55,coll:'sila',color:'#0a0a1a',emoji:'🏋️',desc:'Budowanie szerokości i grubości pleców.',views:0,likes:11},
  {id:'ow5',name:'Mobilność bioder 20 min',type:'video',level:'poczatkujacy',time:20,coll:'mobilnosc',color:'#0a1a1a',emoji:'🧘',desc:'Kompleksowa sesja mobilności — idealna po treningu nóg.',views:0,likes:9},
  {id:'ow6',name:'Lower Body — Nogi & Pośladki',type:'workout',level:'sredni',time:60,coll:'fbw',color:'#1a1000',emoji:'🦵',desc:'Pełny trening nóg z hip thrustem i przysiadem.',views:0,likes:14},
];

const OD_DEMO_PROGRAMS=[
  {id:'op1',name:'Starting Strength — Demo',level:'poczatkujacy',duration:'4 tygodnie',color:'linear-gradient(135deg,#1a0a0a,#2a1a0a)',emoji:'🏋️',desc:'Oparty na Starting Strength Marka Rippetoe. Program siły oparty na własnej masie, stopniowo wprowadzający obciążenia.',clients:0,status:'draft'},
];
window.OD_PROGRAMS=window.OD_PROGRAMS||[];
function allODPrograms(){return window.OD_PROGRAMS&&window.OD_PROGRAMS.length?window.OD_PROGRAMS:OD_DEMO_PROGRAMS;}

const LEVEL_MAP={poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'};

function setODTab(t){
  odTab=t;
  ['browse','workouts','programs','settings'].forEach(tab=>{
    const v=document.getElementById('odtab-'+tab+'-view');
    if(v)v.style.display=tab===t?'block':'none';
    const btn=document.getElementById('odtab-'+tab);
    if(btn)btn.classList.toggle('active',tab===t);
  });
  const addBtn=document.getElementById('od-add-btn');
  if(addBtn){
    if(t==='programs'){addBtn.textContent='+ Nowy program';addBtn.onclick=()=>openODProgramModal();}
    else{addBtn.textContent='+ Dodaj trening';addBtn.onclick=()=>openM('m-od-workout');}
  }
  if(t==='browse')renderODBrowse();
  if(t==='workouts')renderODWorkouts();
  if(t==='programs')renderODPrograms();
}

function renderODBrowse(){
  const allW=(window.OD_WORKOUTS||[]);
  // stats
  const sc=document.getElementById('od-stat-clients');if(sc)sc.textContent=CL.length;
  const sw=document.getElementById('od-stat-workouts');if(sw)sw.textContent=allW.length;

  // collections grid
  const cg=document.getElementById('od-collections-grid');
  if(cg)cg.innerHTML=OD_COLLECTIONS.map((c,i)=>`
    <div class="od-coll-card" style="animation-delay:${i*0.05}s;border-top:3px solid ${c.color};" onclick="setODTab('workouts');odWorkoutFilter='${c.id}';renderODWorkouts()">
      <div style="font-size:28px;margin-bottom:8px;">${c.icon}</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${c.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${c.desc}</div>
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);margin-top:8px;">${allW.filter(w=>w.coll===c.id).length} treningów</div>
    </div>`).join('');

  // workouts grid (first 4)
  const wg=document.getElementById('od-workouts-grid');
  if(wg)wg.innerHTML=allW.slice(0,4).map((w,i)=>odWorkoutCardHTML(w,i)).join('');

  // programs grid
  const pg=document.getElementById('od-programs-grid');
  if(pg)pg.innerHTML=allODPrograms().slice(0,3).map((p,i)=>odProgramCardHTML(p,i)).join('');
}

function renderODWorkouts(){
  const allW=(window.OD_WORKOUTS||[]);
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
  const list=allODPrograms();
  g.innerHTML=(list.length?list.map((p,i)=>odProgramCardHTML(p,i)).join(''):'')
    +`<div style="border:1px dashed var(--border2);border-radius:var(--r2);padding:18px;display:flex;align-items:center;justify-content:center;min-height:180px;cursor:pointer;background:transparent;" onclick="openODProgramModal()"><div style="text-align:center;color:var(--muted);"><div style="font-size:32px;margin-bottom:8px;">+</div><div style="font-size:13px;font-weight:600;">Nowy program on-demand</div><div style="font-size:11px;margin-top:4px;">Klienci startują sami</div></div></div>`;
}

function odWorkoutCardHTML(w,i){
  const coll=OD_COLLECTIONS.find(c=>c.id===w.coll);
  const collColor=coll?coll.color:'var(--muted)';
  return `<div class="od-workout-card" style="animation-delay:${i*0.04}s">
    <div class="od-thumb" style="background:${w.color||'var(--s3)'};background:linear-gradient(135deg,${w.color||'var(--s3)'},var(--s3));">
      <div class="od-thumb-label">${LEVEL_MAP[w.level]||w.level}</div>
      <div style="font-size:40px;opacity:0.3;position:absolute;">${w.emoji||'▶️'}</div>
      <div class="od-play-btn">▶</div>
      <div class="od-thumb-time">${w.time} min</div>
    </div>
    <div style="padding:12px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${w.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.4;">${w.desc||''}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
        ${coll?`<span class="pill" style="background:${collColor}22;color:${collColor};font-size:9px;">${coll.icon} ${coll.name}</span>`:''}
        <span class="pill pill-muted" style="font-size:9px;">${w.type==='video'?'▶️ Wideo':w.type==='audio'?'🎧 Audio':'🏋️ Plan'}</span>
      </div>
      <div style="display:flex;gap:6px;" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="shareODWorkout('${w.id}')">Udostępnij klientom</button>
        <button class="btn btn-ghost btn-sm" onclick="notify('${w.name} — podgląd')">👁</button>
      </div>
    </div>
  </div>`;
}

function odProgramCardHTML(p,i){
  return `<div class="od-prog-card" style="animation-delay:${i*0.05}s">
    <div class="od-prog-thumb" style="background:${p.color||'var(--s3)'};">
      <div style="font-size:36px;opacity:0.25;position:absolute;top:10px;right:10px;">${p.emoji||'🏋️'}</div>
      <div>
        <span style="background:rgba(0,0,0,0.6);color:${p.status==='draft'?'var(--orange)':'var(--accent)'};font-size:10px;font-family:'DM Mono',monospace;padding:2px 8px;border-radius:4px;margin-right:6px;">${p.status==='draft'?'DRAFT':'AKTYWNY'}</span>
        <span style="background:rgba(0,0,0,0.6);color:#fff;font-size:10px;font-family:'DM Mono',monospace;padding:2px 8px;border-radius:4px;">${escHtml(p.duration||'')}</span>
      </div>
    </div>
    <div style="padding:14px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${escHtml(p.name)}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:10px;">${escHtml(p.desc||'')}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Poziom: <strong>${LEVEL_MAP[p.level]||escHtml(p.level||'—')}</strong></div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openODProgramModal('${escHtml(p.id)}')">Edytuj</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="shareODProgram('${escHtml(p.id)}')">Udostępnij</button>
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
  const del=document.getElementById('odp-delete-btn');
  if(del)del.style.display=(p&&window.OD_PROGRAMS.some(x=>x.id===p.id))?'inline-flex':'none';
  openM('m-od-program');
}

async function saveODProgram(){
  const name=document.getElementById('odp-name')?.value.trim();
  if(!name){notify('Wpisz nazwę programu!');return;}
  const editingId=window._editingODProgId;
  let prog;
  if(editingId){
    prog=(window.OD_PROGRAMS||[]).find(x=>x.id===editingId);
    if(!prog){
      // edycja demo → utwórz kopię użytkownika
      prog=withTrainer({id:newId('op'),name,level:document.getElementById('odp-level').value,duration:document.getElementById('odp-duration').value.trim()||'4 tygodnie',status:document.getElementById('odp-status').value,emoji:document.getElementById('odp-emoji').value||'🏋️',desc:document.getElementById('odp-desc').value.trim(),color:'linear-gradient(135deg,#1a0a0a,#2a1a0a)',clients:0,createdAt:new Date().toISOString()});
      window.OD_PROGRAMS.push(prog);
    }else{
      prog.name=name;
      prog.level=document.getElementById('odp-level').value;
      prog.duration=document.getElementById('odp-duration').value.trim()||prog.duration;
      prog.status=document.getElementById('odp-status').value;
      prog.emoji=document.getElementById('odp-emoji').value||'🏋️';
      prog.desc=document.getElementById('odp-desc').value.trim();
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
      createdAt:new Date().toISOString()
    });
    window.OD_PROGRAMS.push(prog);
  }
  await persistById('odPrograms',prog);
  closeM('m-od-program');
  renderODPrograms();
  if(odTab==='browse')renderODBrowse();
  notify('✓ Program "'+name+'" zapisany');
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
  const w=(window.OD_WORKOUTS||[]).find(x=>x.id===id);
  if(!w){notify('Nie znaleziono treningu');return;}
  if(!confirm('Udostępnić trening "'+w.name+'" wszystkim klientom ('+CL.length+')?'))return;
  const link=w.url||'(brak URL wideo)';
  CL.forEach(c=>pushMsg(c.id,'▶️ Nowy trening on-demand: "'+w.name+'"\n'+link+(w.desc?'\n'+w.desc:'')));
  notify('✓ Trening "'+w.name+'" wysłany do '+CL.length+' klientów (Inbox)');
}

function shareODProgram(id){
  if(!CL.length){notify('Najpierw dodaj klienta!');return;}
  const p=allODPrograms().find(x=>x.id===id);
  if(!p){notify('Nie znaleziono programu');return;}
  if(!confirm('Udostępnić program "'+p.name+'" wszystkim klientom ('+CL.length+')?'))return;
  CL.forEach(c=>pushMsg(c.id,'📋 Program on-demand: "'+p.name+'"'+(p.desc?'\n'+p.desc:'')+'\nCzas: '+(p.duration||'—')+' · '+(LEVEL_MAP[p.level]||p.level||'')));
  notify('✓ Program "'+p.name+'" wysłany do '+CL.length+' klientów (Inbox)');
}

async function saveODWorkout(){
  if(window._saveGuard_saveODWorkout)return;window._saveGuard_saveODWorkout=true;setTimeout(()=>window._saveGuard_saveODWorkout=false,1500);

  const name=document.getElementById('odw-name').value.trim();
  if(!name){notify('Wpisz nazwę treningu!');return;}
  const w=withTrainer({
    id:newId('ow'),name,
    type:document.getElementById('odw-type').value,
    level:document.getElementById('odw-level').value,
    time:parseInt(document.getElementById('odw-time').value)||30,
    coll:document.getElementById('odw-coll').value,
    url:document.getElementById('odw-url').value,
    desc:document.getElementById('odw-desc').value,
    color:'var(--s3)',emoji:'🏋️',views:0,likes:0
  });
  window.OD_WORKOUTS.push(w);
  await persistById('odWorkouts',w);
  closeM('m-od-workout');
  if(odTab==='browse')renderODBrowse();
  else if(odTab==='workouts')renderODWorkouts();
  notify('✓ Trening "'+name+'" dodany!');
}
var resTab='resources';var resNav='all';var resColl='all';
window.USER_RESOURCES=[];

const RES_TYPE_COLORS={link:'var(--blue)',video:'var(--red)',doc:'var(--orange)',podcast:'var(--purple)'};
const RES_TYPE_ICONS={link:'🔗',video:'▶️',doc:'📄',podcast:'🎧'};
// 5 kategorii z kolorami wg schematu: Odżywianie=zielony, Trening=czerwony(marka), Rehabilitacja=niebieski, Psychologia=fioletowy, Muzyka=złoty.
const RES_CAT_COLORS={odżywianie:'var(--teal)',trening:'var(--accent)',regeneracja:'var(--blue)',psychologia:'var(--purple)',muzyka:'var(--gold)'};
const RES_CAT_LABELS={odżywianie:'🥗 Odżywianie i Dieta',trening:'🏋️ Trening Siłowy',regeneracja:'🩹 Rehabilitacja i Mobilność',psychologia:'🧠 Psychologia i Mindset',muzyka:'🎧 Muzyka do słuchania'};

const DEMO_RESOURCES=[
  {id:'r1',name:'Dobre źródła białka',type:'link',cat:'odżywianie',url:'https://www.health.harvard.edu',desc:'Harvard Health — kompleksowy przewodnik po źródłach białka w diecie.',coll:'edu'},
  {id:'r2',name:'Znaczenie białka w diecie',type:'link',cat:'odżywianie',url:'https://nutritionsource.hsph.harvard.edu',desc:'Dlaczego białko jest kluczowe dla budowy mięśni i regeneracji.',coll:'edu'},
  {id:'r3',name:'Mikroelementy — przewodnik',type:'link',cat:'odżywianie',url:'https://www.healthline.com',desc:'Kompleksowy przewodnik po witaminach i minerałach.',coll:'edu'},
  {id:'r4',name:'Znaczenie błonnika',type:'link',cat:'odżywianie',url:'https://www.houstonmethodist.org',desc:'Jak błonnik wpływa na zdrowie jelit i metabolizm.',coll:'edu'},
  {id:'r5',name:'Fitness Myths — Real Coaching',type:'podcast',cat:'trening',url:'https://open.spotify.com',desc:'Podcast obalający najpopularniejsze mity fitnessu.',coll:'podcasts'},
  {id:'r6',name:'Trening siłowy i rehabilitacja',type:'podcast',cat:'regeneracja',url:'https://open.spotify.com',desc:'Jak łączyć trening siłowy z profilaktyką urazów.',coll:'podcasts'},
  {id:'r7',name:'Mobilność i regeneracja',type:'podcast',cat:'regeneracja',url:'https://open.spotify.com',desc:'Praktyczne techniki poprawy mobilności i recovery.',coll:'podcasts'},
  {id:'r8',name:'Psychologia w sporcie',type:'podcast',cat:'psychologia',url:'https://open.spotify.com',desc:'Mindfulness, nawyki i psychologia osiągania celów.',coll:'podcasts'},
  {id:'r9',name:'Coaching, Nawyki i Mindset',type:'podcast',cat:'psychologia',url:'https://open.spotify.com',desc:'Budowanie trwałych nawyków i mentalności sportowca.',coll:'podcasts'},
  {id:'r10',name:'Muzyka do treningu — Workout',type:'video',cat:'muzyka',url:'https://www.youtube.com',desc:'Energetyczna playlista YouTube do treningu siłowego.',coll:'music'},
  {id:'r11',name:'Spotify Playlist — Cardio',type:'link',cat:'muzyka',url:'https://open.spotify.com',desc:'Najlepsza playlista do cardio i biegania.',coll:'music'},
  {id:'r12',name:'Fun Workout Mix',type:'video',cat:'muzyka',url:'https://www.youtube.com',desc:'Motywujący mix muzyczny do każdego treningu.',coll:'music'},
  {id:'r13',name:'5k Training Mix',type:'video',cat:'muzyka',url:'https://www.youtube.com',desc:'Specjalny mix dla biegaczy przygotowujących się do 5km.',coll:'music'},
  {id:'r14',name:'Running Motivation Playlist',type:'link',cat:'muzyka',url:'https://www.youtube.com',desc:'Playlist motywacyjna do biegania.',coll:'music'},
  {id:'r15',name:'Mindfulness dla sportowców',type:'podcast',cat:'psychologia',url:'https://open.spotify.com',desc:'Techniki mindfulness poprawiające wydajność treningową.',coll:'podcasts'},
];

const DEMO_COLLECTIONS=[
  {id:'edu',name:'Poradniki edukacyjne',icon:'📚',desc:'Artykuły i przewodniki o żywieniu, treningu i zdrowiu',count:4,color:'var(--blue)',clients:0},
  {id:'music',name:'Muzyka do treningu',icon:'🎵',desc:'Playlisty i mixy muzyczne do różnych typów treningu',count:5,color:'var(--accent)',clients:0},
  {id:'podcasts',name:'Podcasty fitness',icon:'🎧',desc:'Najlepsze podcasty o treningu, żywieniu i psychologii sportu',count:6,color:'var(--purple)',clients:0},
];

function allResources(){return window.USER_RESOURCES||[];}

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
  const all=allResources();
  const picks=[
    all.find(r=>r.coll==='music'),
    all.find(r=>r.cat==='odżywianie'),
    all.find(r=>r.cat==='regeneracja'),
  ].filter(Boolean);
  if(!picks.length){notify('Brak zasobów do wysłania — dodaj kilka materiałów.');return;}
  const intro=`🎁 Witaj ${c.name.split(' ')[0]}! Przygotowałem dla Ciebie mały start — ${picks.length===3?'playlistę, artykuł o diecie i przewodnik po regeneracji':'kilka materiałów'}, żebyś mógł/mogła zacząć na dobrych zasadach:`;
  const body=picks.map(r=>`• ${r.name}\n${r.url||''}`).join('\n\n');
  pushMsg(cid,intro+'\n\n'+body);
  closeM('m-starter-pack');
  notify('✓ Paczka startowa ('+picks.length+' zasoby) wysłana do '+c.name+'!');
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
  const week0=(prog.weeks&&prog.weeks[0])||{};
  const days=(week0.days||[]).map(d=>({day:d.d||d.day||d.name||'Dzień',exercises:[]}));
  const plan=withTrainer({
    id:newId('p'),name:prog.name,clientId:client.id,method:prog.method||'',
    duration:prog.duration||0,days:days.length?days:[{day:'Pon',exercises:[]}],
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
        const send=withTrainer({id:newId('fs'),formId:form.id,clientId:client.id,sentAt:new Date().toLocaleDateString('pl'),status:'sent',answers:[]});
        (window.FORM_SENDS||(window.FORM_SENDS=[])).push(send);
        persistById('formSends',send);
        if(typeof pushMsg==='function')pushMsg(client.id,'Formularz do wypełnienia: '+(form.name||'Ankieta'));
      });
      if(picked.length)parts.push('formularz');
    }
    if(flow.assignEnabled!==false && flow.programId){
      if(assignProgramPlanToClient(flow.programId,client))parts.push('program');
    }
    if(flow.assignEnabled!==false && flow.forumGroupId){
      const g=(window.FORUM_GROUPS||[]).find(x=>x.id===flow.forumGroupId);
      if(g){
        if(g.privacy==='private'){
          g.memberIds=g.memberIds||[];
          if(g.memberIds.indexOf(client.id)<0){g.memberIds.push(client.id);persistById('forumGroups',g);}
        }
        if(typeof pushMsg==='function')pushMsg(client.id,'Jesteś w grupie na forum: '+(g.name||'Społeczność'));
        parts.push('forum');
      }
    }
    if(flow.ondemandEnabled){
      const items=window.USER_RESOURCES||[];
      const one=flow.resourceId?items.find(r=>r.id===flow.resourceId):null;
      const names=one?[one.title||one.name]:items.slice(0,5).map(r=>r.title||r.name).filter(Boolean);
      if(typeof pushMsg==='function')pushMsg(client.id, names.length
        ?('Zasoby na start:\n- '+names.join('\n- '))
        :'Trener udostępni Ci zasoby on-demand wkrótce.');
      parts.push('zasoby');
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
            const hasToday=(window.SE||[]).some(s=>s.clientId===c.id&&s.date===todayISO);
            fire=hasToday&&daysSinceLastFired>=1;
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
      const send=withTrainer({id:newId('fs'),formId:form.id,clientId:c.id,sentAt:new Date().toLocaleDateString('pl'),status:'sent',answers:[]});
      window.FORM_SENDS.push(send);
      persistById('formSends',send);
      if(typeof pushMsg==='function')pushMsg(c.id,'Formularz: '+(form.name||text));
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
// BAZA WIEDZY (KB) — kontekst dla AI Coach
// ════════════════════════════════════════
window.KB = window.KB || [];

function renderKB(){
  const el = document.getElementById('kb-list'); if(!el) return;
  if(!KB.length){
    el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted);"><div style="font-size:36px;margin-bottom:10px;opacity:0.3;">📚</div><div>Brak wpisów. Dodaj pierwszą notatkę.</div></div>';
    return;
  }
  el.innerHTML = KB.slice().reverse().map(k=>`
    <div class="card-sm" style="border-left:3px solid var(--accent);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div style="font-size:13px;font-weight:700;">${escHtml(k.title)}</div>
        <button onclick="delKBEntry('${k.id}')" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;">×</button>
      </div>
      <div style="font-size:12px;color:var(--muted);line-height:1.6;white-space:pre-wrap;">${escHtml((k.text||'').substring(0,280))}${(k.text||'').length>280?'…':''}</div>
    </div>`).join('');
}

async function saveKBEntry(){
  if(window._saveGuard_saveKBEntry)return;window._saveGuard_saveKBEntry=true;setTimeout(()=>window._saveGuard_saveKBEntry=false,1500);

  const title = document.getElementById('kb-title').value.trim();
  const text = document.getElementById('kb-text').value.trim();
  if(!title || !text){notify('Wpisz tytuł i treść!'); return;}
  const entry = withTrainer({id:newId('kb'), title, text, createdAt:new Date().toISOString()});
  KB.push(entry);
  closeM('m-kb');
  document.getElementById('kb-title').value=''; document.getElementById('kb-text').value='';
  renderKB();
  notify('✓ Wpis dodany do bazy wiedzy!');
  await persistById('kb', entry);
}

async function delKBEntry(id){
  if(!confirm('Usunąć wpis?')) return;
  window.KB = KB.filter(k=>k.id!==id);
  renderKB();
  if(window._db){try{await window._del(window._doc(window._db,'kb',id));}catch(e){}}
}

function kbContextForAI(){
  if(!KB.length) return '';
  return '\n\n=== BAZA WIEDZY TRENERA (kontekst, wykorzystaj jeśli pomocne) ===\n'
    + KB.map(k=>`### ${k.title}\n${(k.text||'').substring(0,600)}`).join('\n\n');
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
  const trainerName = getTrainerName('Twój trener');
  const firstName = c.name.split(' ')[0];
  const msgs = {
    wiadomosc: `Cześć ${firstName}! 👋\n\nWitaj w Progress Live — Twojej aplikacji treningowej!\n\n🔗 Twój link do aplikacji:\n${link}\n\nZaloguj się emailem: ${c.email || '[Twój email]'}\nPrzy pierwszym wejściu ustaw hasło.\nDo zobaczenia na treningu! 💪\n\n— ${trainerName}`,
    email: `Temat: Zaproszenie do aplikacji Progress Live\n\nCześć ${firstName},\n\nZ przyjemnością zapraszam Cię do aplikacji Progress Live, gdzie znajdziesz swój plan treningowy, postępy i kontakt ze mną.\n\n➡️ Kliknij aby się zarejestrować:\n${link}\n\nPozdrawiam,\n${trainerName}`,
    whatsapp: `Hej ${firstName}! 🏋️ Twoja aplikacja treningowa jest gotowa!\n\n👉 ${link}\n\nZaloguj się i sprawdź swój plan. Do zobaczenia! 💪`
  };
  const el = document.getElementById('inv-msg-preview');
  if (el) el.textContent = msgs[method] || msgs.wiadomosc;
}

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
  const methodLabels = { wiadomosc: 'Inbox', email: 'email (niepodłączony — zapisano w Inbox)', whatsapp: 'WhatsApp (niepodłączony — zapisano w Inbox)' };

  // Dodaj do wiadomości
  pushMsg(c.id, document.getElementById('inv-msg-preview')?.textContent || '');

  // Oznacz klienta jako zaproszony i zapisz
  c.inviteSent = true;
  c.appInvited = true;
  c.inviteLink = link;
  c.inviteSentAt = new Date().toISOString();
  persistById('clients', c);

  addNotification('system', 'Zaproszenie zapisane', c.name + ' — link w Inbox (' + (methodLabels[inviteMethod]||'wiadomość') + ')', 'clients');
  closeM('m-invite');
  notify('✅ Zaproszenie do ' + c.name + ': ' + (methodLabels[inviteMethod]||'Inbox'));
  maybeResumeOnboard(c.id);
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
window.openForumPost=openForumPost;window.addComment=addComment;window.addCommentAs=addCommentAs;
window.likeComment=likeComment;window.reactToPost=reactToPost;window.addReaction=addReaction;
window.closeForumDetail=closeForumDetail;window.saveForumGroup=saveForumGroup;window.saveForumPost=saveForumPost;
window.setCalView=setCalView;window.calNav=calNav;window.calNavToday=calNavToday;
window.calMiniNav=calMiniNav;window.calClickDay=calClickDay;window.calJumpTo=calJumpTo;
window.quickAddSession=quickAddSession;window.openSessDetail=openSessDetail;
window.editSession=editSession;window.delSession=delSession;window.saveTask=saveTask;window.toggleTask=toggleTask;window.delTask=delTask;
window.openTaskTemplates=openTaskTemplates;window.closeTaskTemplates=closeTaskTemplates;
window.applyTemplate=applyTemplate;window.askTaskAI=askTaskAI;window.addAITask=addAITask;
window.setClientSegment=setClientSegment;window.filterClients=filterClients;
window.setExView=setExView;window.openExDetail=openExDetail;window.closeExDetail=closeExDetail;
window.prefillExInBuilder=prefillExInBuilder;window.prefillExInWorkout=prefillExInWorkout;
window.askExAI=askExAI;
window.renderPrograms=renderPrograms;window.setProgNav=setProgNav;window.setProgDurFilter=setProgDurFilter;
window.openProgDetail=openProgDetail;window.closeProgDetail=closeProgDetail;
window.assignProgramToClient=assignProgramToClient;window.openAssignProg=openAssignProg;
window.confirmAssignProgram=confirmAssignProgram;window.saveUserProgram=saveUserProgram;
window.renderForms=renderForms;window.setFormNav=setFormNav;
window.openFormDetail=openFormDetail;window.closeFormDetail=closeFormDetail;
window.openSendForm=openSendForm;window.confirmSendForm=confirmSendForm;
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
window.updateAfBuilderUi=updateAfBuilderUi;window.fillAutomationSelects=fillAutomationSelects;
window.setResTab=setResTab;window.setResNav=setResNav;window.renderResources=renderResources;
window.viewCollection=viewCollection;window.shareCollection=shareCollection;
window.sendResourceToClient=sendResourceToClient;window.saveResource=saveResource;
window.setODTab=setODTab;window.renderODBrowse=renderODBrowse;
window.renderODWorkouts=renderODWorkouts;window.renderODPrograms=renderODPrograms;
window.shareODWorkout=shareODWorkout;window.shareODProgram=shareODProgram;
window.saveODWorkout=saveODWorkout;
window.setPayTab=setPayTab;window.renderPayOverview=renderPayOverview;
window.renderPayPackages=renderPayPackages;window.renderPayInvoices=renderPayInvoices;
window.renderPayHistory=renderPayHistory;window.savePackage=savePackage;
window.usePackageSession=usePackageSession;window.markPaid=markPaid;
window.requestPayment=requestPayment;window.deletePackage=deletePackage;window.copyPayTransfer=copyPayTransfer;
window.viewInvoice=viewInvoice;window.filterPkgByClient=filterPkgByClient;
window.openClientProfile=openClientProfile;window.closeClientProfile=closeClientProfile;
window.setCPTab=setCPTab;window.saveCPEdit=saveCPEdit;window.archiveClient=archiveClient;
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

updateExDl();renderWL();
// init notifications
setTimeout(()=>{updateNotifBadge();},500);
