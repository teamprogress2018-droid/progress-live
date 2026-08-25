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
window.CLIENT_NOTES=CLIENT_NOTES;
window.CLIENT_ACTIVITY=CLIENT_ACTIVITY;
window.CLIENT_GROUPS=window.CLIENT_GROUPS||[]; // [{id,name,clientIds,color,createdAt}]
const GROUP_COLORS=['#e60000','#4d9fff','#9d7cf4','#ff8c42','#3ecfb2','#f59e0b'];

// ── Prawdziwe śledzenie "nieprzeczytane" (zamiast losowego i%3) ──
// Zapisuje, kiedy trener ostatnio otworzył rozmowę z danym klientem.
function msgGetLastRead(clientId){
  try{return localStorage.getItem('msg_last_read_'+clientId)||'';}catch(e){return '';}
}
function msgSetLastRead(clientId){
  try{localStorage.setItem('msg_last_read_'+clientId,new Date().toISOString());}catch(e){}
}
// Nieprzeczytane = jest wiadomość PRZYCHODZĄCA (out:false) nowsza niż ostatnie otwarcie rozmowy.
function msgHasUnread(clientId){
  const msgs=(typeof MSGS!=='undefined'?MSGS:window.MSGS)||{};
  const list=msgs[clientId]||[];
  const lastRead=msgGetLastRead(clientId);
  return list.some(m=>!m.out&&(!lastRead||(m.createdAt||'')>lastRead));
}
/** Aktywni klienci z nieprzeczytaną wiadomością do trenera (najnowsza najpierw). */
function clientsWithUnreadMsgs(){
  const clients=(window.CL||[]).filter(c=>c&&c.status!=='archived');
  const rows=clients.filter(c=>msgHasUnread(c.id)).map(c=>{
    const msgs=((typeof MSGS!=='undefined'?MSGS:window.MSGS)||{})[c.id]||[];
    const lastIn=[...msgs].reverse().find(m=>!m.out)||null;
    return{client:c,last:lastIn,at:lastIn&&(lastIn.createdAt||'')||''};
  });
  rows.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return rows;
}
function unreadMsgCount(){
  return clientsWithUnreadMsgs().length;
}
function updateInboxNavBadge(){
  const el=document.getElementById('nb-inbox');
  if(!el)return;
  const n=unreadMsgCount();
  el.textContent=n?String(n):'';
  el.style.display=n?'inline-flex':'none';
}
window.msgGetLastRead=msgGetLastRead;
window.msgSetLastRead=msgSetLastRead;
window.msgHasUnread=msgHasUnread;
window.clientsWithUnreadMsgs=clientsWithUnreadMsgs;
window.unreadMsgCount=unreadMsgCount;
window.updateInboxNavBadge=updateInboxNavBadge;

/** Nieprzeczytane od trenera (out:true) w apce klienta. */
function clientGetTrainerLastRead(clientId){
  try{return localStorage.getItem('cmsg_last_read_'+clientId)||'';}catch(e){return '';}
}
function clientMarkTrainerMsgsRead(clientId){
  if(!clientId)return;
  try{localStorage.setItem('cmsg_last_read_'+clientId,new Date().toISOString());}catch(e){}
}
function clientHasUnreadFromTrainer(clientId){
  if(!clientId)return false;
  const msgs=((typeof MSGS!=='undefined'?MSGS:window.MSGS)||{})[clientId]||[];
  const last=clientGetTrainerLastRead(clientId);
  return msgs.some(m=>m&&m.out&&(!last||(m.createdAt||'')>last));
}
window.clientGetTrainerLastRead=clientGetTrainerLastRead;
window.clientMarkTrainerMsgsRead=clientMarkTrainerMsgsRead;
window.clientHasUnreadFromTrainer=clientHasUnreadFromTrainer;

function initClientData(c){
  if(!CLIENT_NOTES[c.id])CLIENT_NOTES[c.id]=[];
  if(!CLIENT_ACTIVITY[c.id])CLIENT_ACTIVITY[c.id]=[];
}

function setInboxTab(t){
  inboxTab=t;
  document.querySelectorAll('.inbox-tab').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('itab-'+t);if(el)el.classList.add('active');
  renderInbox();
}

function renderInbox(){
  const search=(document.getElementById('inbox-search')||{}).value||'';
  let list=CL.filter(c=>c&&c.status!=='archived'&&(!search||c.name.toLowerCase().includes(search.toLowerCase())));
  if(inboxTab==='unread')list=list.filter(c=>msgHasUnread(c.id));

  const el=document.getElementById('msg-list');
  if(!el)return;

  if(inboxTab==='groups'){
    renderInboxGroups(el,search);
    updateInboxNavBadge();
    return;
  }

  if(!list.length){
    el.innerHTML='<div style="padding:30px;text-align:center;color:var(--muted);font-size:12px;">Brak rozmów</div>';
    updateInboxNavBadge();
    return;
  }

  el.innerHTML=list.map((c,i)=>{
    const msgs=MSGS[c.id]||[];
    const last=msgs.slice(-1)[0];
    const unread=msgHasUnread(c.id);
    const time=last?last.time:'';
    const col=COLS[i%5];
    return `<div class="msg-item-enhanced${curChat===c.id?' active':''}" onclick="openChat('${escHtml(c.id)}')">
      <div class="msg-avatar" style="background:${col}22;color:${col};">${getInit(c.name)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <div style="font-size:13px;font-weight:${unread?700:500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.name)}</div>
          <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;flex-shrink:0;margin-left:4px;">${escHtml(time)}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${last?escHtml(last.text):(unread?'Nowa wiadomość':'Brak wiadomości')}</div>
      </div>
      ${unread?'<div class="msg-unread-dot"></div>':''}
    </div>`;
  }).join('');
  updateInboxNavBadge();
}

function renderInboxGroups(el,search){
  const groups=(window.CLIENT_GROUPS||[]).filter(g=>!search||(g.name||'').toLowerCase().includes(search.toLowerCase()));
  el.innerHTML=`
    <div style="padding:12px;border-bottom:1px solid var(--border);">
      <button class="btn btn-primary btn-sm" style="width:100%;" onclick="openClientGroupModal()">+ Nowa grupa</button>
    </div>
    ${groups.length?groups.map((g,i)=>{
      const col=g.color||GROUP_COLORS[i%GROUP_COLORS.length];
      const members=(g.clientIds||[]).map(id=>CL.find(c=>c.id===id)).filter(Boolean);
      return `<div class="msg-item-enhanced" style="flex-direction:column;align-items:stretch;gap:8px;" onclick="event.stopPropagation()">
        <div style="display:flex;gap:10px;align-items:center;cursor:pointer;" onclick="openClientGroupModal('${escHtml(g.id)}')">
          <div class="msg-avatar" style="background:${col}22;color:${col};">👥</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;">${escHtml(g.name)}</div>
            <div style="font-size:11px;color:var(--muted);">${members.length} klientów · ${members.slice(0,3).map(c=>c.name.split(' ')[0]).join(', ')}${members.length>3?'…':''}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="messageClientGroup('${escHtml(g.id)}')">💬 Napisz</button>
          <button class="btn btn-ghost btn-sm" onclick="openClientGroupModal('${escHtml(g.id)}')">Edytuj</button>
        </div>
      </div>`;
    }).join(''):`<div style="padding:30px;text-align:center;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:10px;opacity:0.3;">👥</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Brak grup</div>
      <div style="font-size:11px;margin-bottom:12px;">Utwórz grupę i wyślij wiadomość do wielu klientów naraz</div>
    </div>`}`;
}

function openClientGroupModal(id){
  window._editingGroupId=id||null;
  let m=document.getElementById('m-client-group');
  if(!m){
    m=document.createElement('div');m.id='m-client-group';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:480px;">
      <div class="modal-hdr"><div class="modal-title" id="cg-modal-title">NOWA GRUPA</div><button class="modal-close" onclick="closeM('m-client-group')">×</button></div>
      <div class="modal-body">
        <div class="form-field"><label class="form-lbl">Nazwa grupy</label><input type="text" class="form-input" id="cg-name" placeholder="np. Redukcja 2026"></div>
        <div class="form-field"><label class="form-lbl">Kolor</label>
          <div id="cg-colors" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
        </div>
        <div class="form-field"><label class="form-lbl">Członkowie</label>
          <div id="cg-members" style="max-height:220px;overflow-y:auto;border:1px solid var(--border2);border-radius:8px;padding:8px;"></div>
        </div>
      </div>
      <div class="modal-footer" style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" id="cg-delete-btn" style="display:none;margin-right:auto;color:var(--red);" onclick="deleteClientGroup()">Usuń</button>
        <button class="btn btn-ghost" onclick="closeM('m-client-group')">Anuluj</button>
        <button class="btn btn-primary" onclick="saveClientGroup()">Zapisz</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
  }
  const g=id?(window.CLIENT_GROUPS||[]).find(x=>x.id===id):null;
  document.getElementById('cg-modal-title').textContent=g?'EDYTUJ GRUPĘ':'NOWA GRUPA';
  document.getElementById('cg-name').value=g?.name||'';
  window._cgColor=g?.color||GROUP_COLORS[0];
  document.getElementById('cg-colors').innerHTML=GROUP_COLORS.map(c=>`<button type="button" onclick="window._cgColor='${c}';openClientGroupModal(window._editingGroupId)" style="width:28px;height:28px;border-radius:8px;background:${c};border:2px solid ${window._cgColor===c?'#fff':'transparent'};cursor:pointer;"></button>`).join('');
  const selected=new Set(g?.clientIds||[]);
  document.getElementById('cg-members').innerHTML=CL.length?CL.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer;">
    <input type="checkbox" class="cg-member-chk" value="${escHtml(c.id)}" ${selected.has(c.id)?'checked':''} style="accent-color:var(--accent);">
    <span>${escHtml(c.name)}</span>
  </label>`).join(''):`<div style="font-size:12px;color:var(--muted);padding:8px;">Brak klientów — najpierw dodaj klientów.</div>`;
  const del=document.getElementById('cg-delete-btn');
  if(del)del.style.display=g?'inline-flex':'none';
  openM('m-client-group');
}

async function saveClientGroup(){
  const name=document.getElementById('cg-name')?.value.trim();
  if(!name){notify('Wpisz nazwę grupy!');return;}
  const clientIds=[...document.querySelectorAll('.cg-member-chk:checked')].map(cb=>cb.value);
  let g;
  if(window._editingGroupId){
    g=(window.CLIENT_GROUPS||[]).find(x=>x.id===window._editingGroupId);
    if(g){
      g.name=name;g.clientIds=clientIds;g.color=window._cgColor||g.color;g.updatedAt=new Date().toISOString();
      withTrainer(g);
    }
  }
  if(!g){
    g=withTrainer({id:newId('grp'),name,clientIds,color:window._cgColor||GROUP_COLORS[0],createdAt:new Date().toISOString()});
    window.CLIENT_GROUPS.push(g);
  }
  await persistById('clientGroups',g);
  closeM('m-client-group');
  refreshBroadcastGroupOptions();
  if(inboxTab==='groups')renderInbox();
  notify('✓ Grupa "'+name+'" zapisana ('+clientIds.length+' osób)');
}

async function deleteClientGroup(){
  const id=window._editingGroupId;if(!id)return;
  if(!confirm('Usunąć tę grupę?'))return;
  window.CLIENT_GROUPS=(window.CLIENT_GROUPS||[]).filter(x=>x.id!==id);
  if(window._db){try{await window._del(window._doc(window._db,'clientGroups',id));}catch(e){}}
  closeM('m-client-group');
  refreshBroadcastGroupOptions();
  if(inboxTab==='groups')renderInbox();
  notify('Grupa usunięta');
}

function messageClientGroup(id){
  const g=(window.CLIENT_GROUPS||[]).find(x=>x.id===id);if(!g)return;
  let m=document.getElementById('m-group-msg');
  if(!m){
    m=document.createElement('div');m.id='m-group-msg';m.className='modal-ov';
    m.innerHTML=`<div class="modal" style="max-width:440px;">
      <div class="modal-hdr"><div class="modal-title">WIADOMOŚĆ DO GRUPY</div><button class="modal-close" onclick="closeM('m-group-msg')">×</button></div>
      <div class="modal-body">
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;" id="gm-meta"></div>
        <textarea class="form-textarea" id="gm-text" rows="4" placeholder="Treść… Użyj {imie} aby spersonalizować."></textarea>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeM('m-group-msg')">Anuluj</button><button class="btn btn-primary" onclick="sendClientGroupMessage()">Wyślij</button></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
  }
  window._msgGroupId=id;
  const members=(g.clientIds||[]).map(cid=>CL.find(c=>c.id===cid)).filter(Boolean);
  document.getElementById('gm-meta').textContent=g.name+' · '+members.length+' odbiorców';
  document.getElementById('gm-text').value='';
  openM('m-group-msg');
}

function sendClientGroupMessage(){
  const g=(window.CLIENT_GROUPS||[]).find(x=>x.id===window._msgGroupId);if(!g)return;
  const msg=document.getElementById('gm-text')?.value.trim();
  if(!msg){notify('Wpisz wiadomość!');return;}
  const members=(g.clientIds||[]).map(cid=>CL.find(c=>c.id===cid)).filter(Boolean);
  if(!members.length){notify('Grupa nie ma członków');return;}
  if(!confirm('Wysłać wiadomość do '+members.length+' klientów z grupy "'+g.name+'"?'))return;
  members.forEach(c=>pushMsg(c.id,msg.replace(/\{imie\}/gi,c.name.split(' ')[0])));
  closeM('m-group-msg');
  notify('✓ Wysłano do '+members.length+' klientów z grupy "'+g.name+'"');
  renderInbox();
}

function refreshBroadcastGroupOptions(){
  const sel=document.getElementById('bc-target');if(!sel)return;
  const keep=sel.value;
  const base=[
    ['all','Wszyscy klienci'],
    ['active','Tylko aktywni'],
    ['inactive','Nieaktywni (zastój)'],
  ];
  const groups=(window.CLIENT_GROUPS||[]).map(g=>['group:'+g.id,'Grupa: '+g.name]);
  sel.innerHTML=[...base,...groups].map(([v,l])=>`<option value="${escHtml(v)}">${escHtml(l)}</option>`).join('');
  if([...base,...groups].some(([v])=>v===keep))sel.value=keep;
}
window.openClientGroupModal=openClientGroupModal;
window.saveClientGroup=saveClientGroup;
window.deleteClientGroup=deleteClientGroup;
window.messageClientGroup=messageClientGroup;
window.sendClientGroupMessage=sendClientGroupMessage;
window.refreshBroadcastGroupOptions=refreshBroadcastGroupOptions;

function openChat(id){
  curChat=id;
  const c=CL.find(x=>x.id===id);
  if(!c)return;
  if(!MSGS[id])MSGS[id]=[];
  msgSetLastRead(id);
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
      <div class="msg-bubble ${m.out?'msg-out':'msg-in'}" style="white-space:pre-wrap;">${escHtml(m.text||'')}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:3px;">${escHtml(m.time||'')}</div>
    </div>`).join('')
    :`<div style="text-align:center;padding:40px 20px;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:8px;">👋</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Zacznij rozmowę z ${escHtml(c.name)}</div>
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
  try{if(typeof renderDashMsgFollowup==='function')renderDashMsgFollowup();}catch(e){}
  updateInboxNavBadge();
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
  const note=withTrainer({
    id:newId('note'),
    clientId:id,
    text:nt.value.trim(),
    date:new Date().toLocaleDateString('pl',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
    createdAt:new Date().toISOString()
  });
  CLIENT_NOTES[id].unshift(note);
  persistById('clientNotes',note);
  notify('Notatka zapisana ✓');
  if(cpClientId===id){
    const c=CL.find(x=>x.id===id);
    if(c){
      if(cpTab==='notes')renderCPNotes(c);
      else if(cpTab==='overview')renderCPOverview(c);
      else setCPTab('notes');
    }
  }
}

function sendMsg(){
  const inp=document.getElementById('msg-inp');
  const txt=inp?inp.value.trim():'';
  if(!txt||!curChat)return;
  pushMsg(curChat,txt);
  inp.value='';inp.style.height='auto';
  openChat(curChat);
}

function sendBroadcast(){
  const msg=document.getElementById('bc-msg').value.trim();
  if(!msg){notify('Wpisz wiadomość!');return;}
  const target=document.getElementById('bc-target').value;
  let targets=CL;
  if(target==='active')targets=CL.filter(c=>c.status==='active');
  else if(target==='inactive')targets=CL.filter(c=>c.status==='inactive');
  else if(target&&target.startsWith('group:')){
    const gid=target.slice(6);
    const g=(window.CLIENT_GROUPS||[]).find(x=>x.id===gid);
    const ids=new Set(g?.clientIds||[]);
    targets=CL.filter(c=>ids.has(c.id));
  }
  if(!targets.length){notify('Brak odbiorców');return;}
  if(!confirm('Wysłać wiadomość do '+targets.length+' klientów?'))return;
  targets.forEach(c=>{
    const text=msg.replace(/{imie}/g,c.name.split(' ')[0]);
    pushMsg(c.id,text);
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
  {name:'Wyciskanie sztangi leżąc',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Klatka (główna), Triceps, Barki (przednie)',tip:'Łopatki ściągnięte i wciśnięte w ławkę. Pełny ROM.',nsca:'Hipertrofia: 3-4x8-12, RPE 8. Siła: 4-6x3-5.',alt:'Wyciskanie hantli, Pompki',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie hantli leżąc',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka (główna), Triceps',tip:'Hantle w jednej linii z klatką.',nsca:'3x10-12.',alt:'Wyciskanie sztangi, Pompki',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie hantli skos+',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka górna, Barki (przednie)',tip:'Kąt ławki 30-45°.',nsca:'3x10-12.',alt:'Wyciskanie sztangi skos, Pompki na rączkach',img:'assets/ex/bench.svg'},
  {name:'Rozpiętki hantlami',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka (izolacja)',tip:'Lekkie ugięcie łokci. Skup się na rozciągnięciu klatki.',nsca:'3x12-15.',alt:'Rozpiętki na wyciągu, Peck deck'},
  {name:'Rozpiętki na wyciągu',cat:'Klatka piersiowa',eq:'Wyciąg',muscle:'Klatka (izolacja), stałe napięcie',tip:'Stałe napięcie przez cały ruch.',nsca:'3x12-15.',alt:'Rozpiętki hantlami, Peck deck'},
  {name:'Pompki',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka piersiowa, Triceps, Core',tip:'Ciało w jednej linii.',nsca:'3-4xmax.',alt:'Wyciskanie sztangi, Wyciskanie hantli',img:'assets/ex/bench.svg'},
  {name:'Pompki na rączkach',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka (dolna), Triceps',tip:'Głębszy zakres ruchu.',nsca:'3x10-15.',alt:'Dipy, Pompki',img:'assets/ex/bench.svg'},
  {name:'Dipy na poręczach',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka (dolna), Triceps, Barki',tip:'Pochylenie do przodu = więcej klatki.',nsca:'3x8-12.',alt:'Pompki na rączkach',img:'assets/ex/bench.svg'},
  {name:'Peck deck',cat:'Klatka piersiowa',eq:'Maszyna',muscle:'Klatka (izolacja)',tip:'Łokcie na poziomie barków.',nsca:'3x12-15.',alt:'Rozpiętki hantlami',img:'assets/ex/bench.svg'},
  {name:'Pullover hantlem',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka, Najszerszy',tip:'Pełny zakres ruchu. Rozciągnięcie na dole.',nsca:'3x12-15.',alt:'Pullover sztangą'},
  {name:'Pompki plyometryczne',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka, Triceps, Moc',tip:'Wybij się z podłogi.',nsca:'3x5-8.',alt:'Pompki',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie wąskim chwytem',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Triceps (główny), Klatka (wewnętrzna)',tip:'Łokcie blisko tułowia.',nsca:'3x8-12.',alt:'French press, Dipy',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie sztangi skos+',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Klatka górna, Barki (przednie), Triceps',tip:'Ławka 30–45°. Łopatki ściągnięte.',nsca:'3–4x8–12.',alt:'Wyciskanie hantli skos+, Landmine press',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie sztangi skos−',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Klatka dolna, Triceps',tip:'Ławka lekko w dół. Nie odrywaj bioder.',nsca:'3x8–12.',alt:'Dipy, Pompki na rączkach',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie hantli skos−',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka dolna, Triceps',tip:'Kontroluj hantle w dolnej pozycji.',nsca:'3x10–12.',alt:'Wyciskanie sztangi skos−, Dipy',img:'assets/ex/bench.svg'},
  {name:'Floor press',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Klatka, Triceps (bez pełnego rozciągnięcia)',tip:'Łokcie zatrzymują się o podłogę — bezpieczniej dla barków.',nsca:'3–4x6–10.',alt:'Wyciskanie wąskim chwytem, Bench press',img:'assets/ex/bench.svg'},
  {name:'Wyciskanie na maszynie',cat:'Klatka piersiowa',eq:'Maszyna',muscle:'Klatka, Triceps',tip:'Łopatki oparte. Nie blokuj łokci.',nsca:'3x10–15.',alt:'Wyciskanie hantli, Peck deck',img:'assets/ex/bench.svg'},
  {name:'Cable crossover góra–dół',cat:'Klatka piersiowa',eq:'Wyciąg',muscle:'Klatka (dolna i środkowa)',tip:'Ruch od góry do bioder. Lekkie ugięcie łokci.',nsca:'3x12–15.',alt:'Rozpiętki na wyciągu, Peck deck',img:'assets/ex/bench.svg'},
  {name:'Cable crossover dół–góra',cat:'Klatka piersiowa',eq:'Wyciąg',muscle:'Klatka górna',tip:'Ruch od dołu do góry, jak „wyciskanie w górę”.',nsca:'3x12–15.',alt:'Wyciskanie hantli skos+, Rozpiętki',img:'assets/ex/bench.svg'},
  {name:'Landmine press',cat:'Klatka piersiowa',eq:'Sztanga',muscle:'Klatka górna, Barki, Core',tip:'Jedna lub dwie ręce. Stabilny tułów.',nsca:'3x8–12.',alt:'Wyciskanie skos+, Push press',img:'assets/ex/bench.svg'},
  {name:'Pompki diamentowe',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Triceps, Klatka wewnętrzna',tip:'Dłonie blisko siebie w kształt diamentu.',nsca:'3xmax.',alt:'Wyciskanie wąskim chwytem, Dipy',img:'assets/ex/bench.svg'},
  {name:'Pompki szerokie',cat:'Klatka piersiowa',eq:'Własna masa',muscle:'Klatka (główna), Barki',tip:'Dłonie szerzej niż barki. Ciało w linii.',nsca:'3xmax.',alt:'Pompki, Rozpiętki',img:'assets/ex/bench.svg'},
  {name:'Svend press',cat:'Klatka piersiowa',eq:'Hantle',muscle:'Klatka wewnętrzna (ściśnięcie)',tip:'Ściskaj talerz/hantel przed klatką i wypychaj do przodu.',nsca:'3x12–20.',alt:'Peck deck, Cable crossover',img:'assets/ex/bench.svg'},
  {name:'Martwy ciąg klasyczny',cat:'Plecy',eq:'Sztanga',muscle:'Dwugłowy uda, Pośladki, Prostownicy grzbietu',tip:'Kręgosłup neutralny przez cały czas!',nsca:'Siła: 3-5x3-5. Hipertrofia: 3x8-10.',alt:'Martwy ciąg RDL, Trap bar deadlift',img:'assets/ex/deadlift.svg'},
  {name:'Martwy ciąg RDL',cat:'Plecy',eq:'Sztanga',muscle:'Dwugłowy uda, Pośladki, Prostownicy grzbietu',tip:'Biodra do tyłu, kręgosłup neutralny.',nsca:'3-4x10-12.',alt:'Martwy ciąg klasyczny, Good morning',img:'assets/ex/deadlift.svg'},
  {name:'Wiosłowanie sztangą',cat:'Plecy',eq:'Sztanga',muscle:'Plecy środkowe, Biceps, Barki (tylne)',tip:'Tułów pod kątem 45°. Ciągnij do bioder.',nsca:'3-4x8-12.',alt:'Wiosłowanie hantlem, Wyciąg'},
  {name:'Wiosłowanie hantlem',cat:'Plecy',eq:'Hantle',muscle:'Plecy środkowe (jednostronnie), Biceps',tip:'Kolano i ręka oparte o ławkę.',nsca:'3x10-12/stronę.',alt:'Wiosłowanie sztangą'},
  {name:'Podciąganie na drążku',cat:'Plecy',eq:'Własna masa',muscle:'Plecy (szerokie), Biceps, Tylne barki',tip:'Nie bujaj się! Pełny ROM.',nsca:'3-4xmax.',alt:'Ściąganie drążka wyciąg',img:'assets/ex/pullup.svg'},
  {name:'Podciąganie neutralnym chwytem',cat:'Plecy',eq:'Własna masa',muscle:'Plecy (szerokie i środkowe), Biceps',tip:'Dłonie zwrócone do siebie.',nsca:'3xmax.',alt:'Podciąganie na drążku',img:'assets/ex/pullup.svg'},
  {name:'Ściąganie drążka wyciąg',cat:'Plecy',eq:'Wyciąg',muscle:'Najszerszy, Biceps',tip:'Drążek do górnej klatki, łokcie do dołu.',nsca:'3x10-12.',alt:'Podciąganie na drążku'},
  {name:'Wiosłowanie wyciągiem siedząc',cat:'Plecy',eq:'Wyciąg',muscle:'Plecy środkowe, Biceps, Rombowate',tip:'Ściągaj łopatki.',nsca:'3x12.',alt:'Wiosłowanie sztangą'},
  {name:'Facepull',cat:'Plecy',eq:'Wyciąg',muscle:'Tylne barki, Rombowate, Rotatory',tip:'Wyciągaj do czoła, łokcie wysoko.',nsca:'3x15-20.',alt:'Odwrotne rozpiętki'},
  {name:'Good morning',cat:'Plecy',eq:'Sztanga',muscle:'Prostownicy grzbietu, Dwugłowy uda',tip:'Kręgosłup neutralny. Biodra cofaj do tyłu.',nsca:'3x10-12.',alt:'RDL, Hyperextension'},
  {name:'Hyperextension',cat:'Plecy',eq:'Własna masa',muscle:'Prostownicy grzbietu, Pośladki',tip:'Nie przeginaj. Zatrzymaj się w linii ciała.',nsca:'3x12-15.',alt:'Good morning, RDL'},
  {name:'Odwrotne rozpiętki',cat:'Plecy',eq:'Hantle',muscle:'Tylne barki, Rombowate',tip:'Tułów równoległy do podłogi.',nsca:'3x15.',alt:'Facepull, Wiosłowanie'},
  {name:'Inverted row',cat:'Plecy',eq:'Własna masa',muscle:'Plecy środkowe, Biceps',tip:'Leżąc pod drążkiem. Ciągnij klatkę do drążka.',nsca:'3xmax.',alt:'Wiosłowanie, Podciąganie'},
  {name:'Chest supported row',cat:'Plecy',eq:'Hantle',muscle:'Plecy środkowe (bez dolnego grzbietu)',tip:'Klatka na ławce pod kątem.',nsca:'3x12.',alt:'Wiosłowanie hantlem'},
  {name:'Podciąganie podchwytem',cat:'Plecy',eq:'Własna masa',muscle:'Plecy, Biceps (mocniejsza praca)',tip:'Dłonie zwrócone do siebie/podchwytem. Pełny ROM.',nsca:'3–4xmax.',alt:'Podciąganie na drążku, Uginanie biceps'},
  {name:'T-bar row',cat:'Plecy',eq:'Sztanga',muscle:'Plecy środkowe, Najszerszy, Biceps',tip:'Klatka stabilna, ciąg do brzucha.',nsca:'3–4x8–12.',alt:'Wiosłowanie sztangą, Meadows row'},
  {name:'Meadows row',cat:'Plecy',eq:'Sztanga',muscle:'Plecy (jednostronnie), Tylne barki',tip:'Landmine. Ciągnij łokciem w bok/tył.',nsca:'3x10–12/stronę.',alt:'Wiosłowanie hantlem, T-bar row'},
  {name:'Pendlay row',cat:'Plecy',eq:'Sztanga',muscle:'Plecy środkowe, Moc eksplozywna',tip:'Sztanga z podłogi. Eksplozywny ciąg, kontrolowane opuszczenie.',nsca:'3–5x5–8.',alt:'Wiosłowanie sztangą'},
  {name:'Seal row',cat:'Plecy',eq:'Hantle',muscle:'Plecy środkowe (bez dolnego grzbietu)',tip:'Leżysz na ławce brzuchem — zero oszukiwania biodrami.',nsca:'3x10–12.',alt:'Chest supported row'},
  {name:'Straight arm pulldown',cat:'Plecy',eq:'Wyciąg',muscle:'Najszerszy (izolacja)',tip:'Ręce prawie proste. Ciągnij do bioder.',nsca:'3x12–15.',alt:'Pullover hantlem, Ściąganie drążka'},
  {name:'Ściąganie drążka wąskim chwytem',cat:'Plecy',eq:'Wyciąg',muscle:'Plecy środkowe, Biceps',tip:'Chwyt V-bar lub wąski. Drążek do klatki.',nsca:'3x10–12.',alt:'Wiosłowanie wyciągiem, Podciąganie neutralne'},
  {name:'Shrugs sztanga',cat:'Plecy',eq:'Sztanga',muscle:'Trapez (górny)',tip:'Unieś barki prosto w górę. Bez rotacji.',nsca:'3–4x10–15.',alt:'Shrugs hantle, Farmer carry'},
  {name:'Shrugs hantle',cat:'Plecy',eq:'Hantle',muscle:'Trapez (górny)',tip:'Hantle po bokach. Pauza na górze.',nsca:'3–4x12–15.',alt:'Shrugs sztanga'},
  {name:'Single-arm lat pulldown',cat:'Plecy',eq:'Wyciąg',muscle:'Najszerszy (jednostronnie)',tip:'Ciągnij łokieć do biodra. Stabilny tułów.',nsca:'3x12/stronę.',alt:'Ściąganie drążka, Wiosłowanie hantlem'},
  {name:'Wyciskanie żołnierskie OHP',cat:'Barki',eq:'Sztanga',muscle:'Barki (przednie i środkowe), Triceps',tip:'Napnij pośladki i brzuch.',nsca:'3-4x6-10.',alt:'Wyciskanie hantli, Arnold press',img:'assets/ex/ohp.svg'},
  {name:'Wyciskanie hantli siedząc',cat:'Barki',eq:'Hantle',muscle:'Barki (przednie i środkowe), Triceps',tip:'Hantle na poziomie uszu.',nsca:'3x10-12.',alt:'OHP, Arnold press',img:'assets/ex/ohp.svg'},
  {name:'Arnold press',cat:'Barki',eq:'Hantle',muscle:'Barki (wszystkie głowy), Triceps',tip:'Obrót dłoni podczas wyciskania.',nsca:'3x10-12.',alt:'Wyciskanie hantli, OHP',img:'assets/ex/ohp.svg'},
  {name:'Unoszenie bokiem',cat:'Barki',eq:'Hantle',muscle:'Barki (środkowe)',tip:'Lekkie ugięcie łokci. Nie zamachy!',nsca:'3x15-20.',alt:'Unoszenie wyciągiem'},
  {name:'Unoszenie przodem',cat:'Barki',eq:'Hantle',muscle:'Barki (przednie)',tip:'Do wysokości barków, nie wyżej.',nsca:'3x12-15.',alt:'OHP, Unoszenie wyciągiem'},
  {name:'Unoszenie wyciągiem bokiem',cat:'Barki',eq:'Wyciąg',muscle:'Barki (środkowe), stałe napięcie',tip:'Lepsza aktywacja niż hantle.',nsca:'3x15-20.',alt:'Unoszenie bokiem hantlami'},
  {name:'Odwrotne rozpiętki maszyna',cat:'Barki',eq:'Maszyna',muscle:'Tylne barki, Rombowate',tip:'Łokcie na poziomie barków.',nsca:'3x15.',alt:'Facepull, Odwrotne rozpiętki'},
  {name:'Rotacja zewnętrzna',cat:'Barki',eq:'Hantle',muscle:'Rotatory barku, Podgrzebieniowy',tip:'Łokieć przy boku pod kątem 90°.',nsca:'2-3x15-20.',alt:'Rotacja na wyciągu, Facepull'},
  {name:'Push press',cat:'Barki',eq:'Sztanga',muscle:'Barki, Triceps, Moc eksplozywna',tip:'Lekki dip kolanami i wybicie.',nsca:'3x5-8.',alt:'OHP'},
  {name:'Cuban press',cat:'Barki',eq:'Hantle',muscle:'Rotatory barku, Tylne barki',tip:'Zewnętrzna rotacja + wyciskanie.',nsca:'3x10-12.',alt:'Rotacja zewnętrzna, Facepull'},
  {name:'Wyciskanie barków maszyna',cat:'Barki',eq:'Maszyna',muscle:'Barki (przednie i środkowe), Triceps',tip:'Plecy oparte. Pełny ROM bez bólu barku.',nsca:'3x10–12.',alt:'Wyciskanie hantli siedząc, OHP'},
  {name:'Upright row',cat:'Barki',eq:'Sztanga',muscle:'Barki środkowe, Trapez',tip:'Łokcie wyżej niż nadgarstki. Nie za wąsko.',nsca:'3x10–12.',alt:'Unoszenie bokiem, Facepull'},
  {name:'Y-raise',cat:'Barki',eq:'Hantle',muscle:'Tylne barki, Dolny trapez',tip:'Unieś ręce w kształt Y. Lekkie obciążenie.',nsca:'3x12–15.',alt:'Odwrotne rozpiętki, Facepull'},
  {name:'Unoszenie bokiem na wyciągu jednorącz',cat:'Barki',eq:'Wyciąg',muscle:'Barki (środkowe)',tip:'Ciągnij w poprzek ciała — stałe napięcie.',nsca:'3x12–20/stronę.',alt:'Unoszenie bokiem, Unoszenie wyciągiem bokiem'},
  {name:'Plate front raise',cat:'Barki',eq:'Hantle',muscle:'Barki (przednie)',tip:'Talerz/hantel przed sobą do wysokości barków.',nsca:'3x12–15.',alt:'Unoszenie przodem, OHP'},
  {name:'Landmine lateral raise',cat:'Barki',eq:'Sztanga',muscle:'Barki (środkowe)',tip:'Landmine w jednej ręce — łuk na zewnątrz.',nsca:'3x12–15/stronę.',alt:'Unoszenie bokiem'},
  {name:'Uginanie biceps sztangą',cat:'Biceps',eq:'Sztanga',muscle:'Biceps (głowa długa i krótka)',tip:'Łokieć stabilny przy boku.',nsca:'3x8-12.',alt:'Uginanie hantlami',img:'assets/ex/curl.svg'},
  {name:'Uginanie młotkowe',cat:'Biceps',eq:'Hantle',muscle:'Biceps (głowa długa), Ramiennopromieniowy',tip:'Neutralny chwyt — kciuk do góry.',nsca:'3x10-12.',alt:'Uginanie biceps sztangą',img:'assets/ex/curl.svg'},
  {name:'Uginanie hantlami naprzemiennie',cat:'Biceps',eq:'Hantle',muscle:'Biceps, Ramiennopromieniowy',tip:'Pełna supinacja przy uginaniu.',nsca:'3x10-12/stronę.',alt:'Uginanie sztangą',img:'assets/ex/curl.svg'},
  {name:'Uginanie na wyciągu',cat:'Biceps',eq:'Wyciąg',muscle:'Biceps, stałe napięcie',tip:'Lepsze dla szczytowej kontrakcji.',nsca:'3x12-15.',alt:'Uginanie hantlami'},
  {name:'Spider curl',cat:'Biceps',eq:'Hantle',muscle:'Biceps (szczytowa kontrakcja)',tip:'Klatka oparta na ławce. Maksymalna izolacja.',nsca:'3x12-15.',alt:'Uginanie koncentryczne'},
  {name:'Uginanie Zottman',cat:'Biceps',eq:'Hantle',muscle:'Biceps, Ramiennopromieniowy, Przedramię',tip:'Supinacja w górze, pronacja w dół.',nsca:'3x10-12.',alt:'Uginanie młotkowe'},
  {name:'Uginanie reverse',cat:'Biceps',eq:'Sztanga',muscle:'Ramiennopromieniowy, Przedramię',tip:'Chwyt pronacyjny. Wzmacnia przedramię.',nsca:'3x12-15.',alt:'Uginanie Zottman'},
  {name:'Uginanie nadgarstka',cat:'Biceps',eq:'Sztanga',muscle:'Zginacze nadgarstka, Przedramię',tip:'Nadgarstek opiera się o ławkę.',nsca:'3x15-20.',alt:'Uginanie reverse'},
  {name:'Concentration curl',cat:'Biceps',eq:'Hantle',muscle:'Biceps (szczytowa izolacja)',tip:'Łokieć oparty o udo. Pełna kontrakcja na górze.',nsca:'3x10–12/stronę.',alt:'Spider curl, Uginanie hantlami'},
  {name:'Preacher curl',cat:'Biceps',eq:'Sztanga',muscle:'Biceps (głowa krótka)',tip:'Ramię przylegające do ławki Scotta. Nie odrywaj łokci.',nsca:'3x8–12.',alt:'Spider curl, Uginanie sztangą'},
  {name:'Incline curl',cat:'Biceps',eq:'Hantle',muscle:'Biceps (głowa długa — rozciągnięcie)',tip:'Ławka 45–60°. Ramiona swobodnie w tył.',nsca:'3x10–12.',alt:'Uginanie hantlami, Bayesian curl'},
  {name:'Bayesian curl',cat:'Biceps',eq:'Wyciąg',muscle:'Biceps (rozciągnięcie + napięcie)',tip:'Wyciąg z tyłu. Krok do przodu, uginaj do przodu.',nsca:'3x10–15.',alt:'Incline curl, Uginanie na wyciągu'},
  {name:'Drag curl',cat:'Biceps',eq:'Sztanga',muscle:'Biceps (głowa długa)',tip:'Ciągnij sztangę wzdłuż tułowia — łokcie idą w tył.',nsca:'3x10–12.',alt:'Uginanie sztangą'},
  {name:'21s biceps',cat:'Biceps',eq:'Sztanga',muscle:'Biceps (cała głowa — pump)',tip:'7 dolnej połowy + 7 górnej + 7 pełnych.',nsca:'2–3x21.',alt:'Uginanie sztangą, Uginanie na wyciągu'},
  {name:'Prostowanie tricepsa wyciąg',cat:'Triceps',eq:'Wyciąg',muscle:'Triceps (wszystkie 3 głowy)',tip:'Łokcie przy tułowiu, nie ruszaj nimi.',nsca:'3x12-15.',alt:'French press, Skull crusher'},
  {name:'French press',cat:'Triceps',eq:'Sztanga',muscle:'Triceps (długa głowa)',tip:'Łokcie skierowane do sufitu.',nsca:'3x10-12.',alt:'Prostowanie wyciąg, Skull crusher'},
  {name:'Skull crusher',cat:'Triceps',eq:'Sztanga',muscle:'Triceps (długa i boczna głowa)',tip:'Opuszczaj do czoła lub za głowę.',nsca:'3x10-12.',alt:'French press'},
  {name:'Kick back triceps',cat:'Triceps',eq:'Hantle',muscle:'Triceps (boczna i przyśrodkowa głowa)',tip:'Pełne wyprostowanie ramienia.',nsca:'3x12-15.',alt:'Prostowanie wyciąg'},
  {name:'Overhead triceps wyciąg',cat:'Triceps',eq:'Wyciąg',muscle:'Triceps (długa głowa — rozciągnięcie)',tip:'Wyciąg za głowę.',nsca:'3x12-15.',alt:'French press'},
  {name:'Prostowanie linką (rope pushdown)',cat:'Triceps',eq:'Wyciąg',muscle:'Triceps (boczna głowa)',tip:'Na dole rozciągnij linki na boki.',nsca:'3x12–15.',alt:'Prostowanie tricepsa wyciąg'},
  {name:'Prostowanie jednorącz wyciąg',cat:'Triceps',eq:'Wyciąg',muscle:'Triceps (izolacja jednostronna)',tip:'Łokieć przyklejony. Pełny wyprost.',nsca:'3x12–15/stronę.',alt:'Kick back triceps, Rope pushdown'},
  {name:'Overhead triceps hantlem',cat:'Triceps',eq:'Hantle',muscle:'Triceps (długa głowa)',tip:'Łokcie blisko głowy. Opuszczaj za głowę.',nsca:'3x10–12.',alt:'French press, Overhead triceps wyciąg'},
  {name:'Bench dip',cat:'Triceps',eq:'Własna masa',muscle:'Triceps, Klatka przednia, Barki',tip:'Biodra blisko ławki. Nie schodź za głęboko przy wrażliwych barkach.',nsca:'3x10–15.',alt:'Dipy na poręczach, Pompki diamentowe'},
  {name:'Dipy triceps (pionowe)',cat:'Triceps',eq:'Własna masa',muscle:'Triceps (główny), Klatka mniej',tip:'Tułów bardziej pionowo niż przy dipach na klatkę.',nsca:'3x8–12.',alt:'Bench dip, Wyciskanie wąskim chwytem'},
  {name:'JM press',cat:'Triceps',eq:'Sztanga',muscle:'Triceps, Klatka górna',tip:'Hybryda skull crusher + wąski bench. Łokcie pod kątem.',nsca:'3x6–10.',alt:'Skull crusher, Wyciskanie wąskim chwytem'},
  {name:'Triceps dip maszyna',cat:'Triceps',eq:'Maszyna',muscle:'Triceps (wszystkie głowy)',tip:'Ramiona blisko tułowia. Kontrolowany ruch.',nsca:'3x10–15.',alt:'Prostowanie wyciąg, Dipy'},
  {name:'Przysiad ze sztangą',cat:'Nogi',eq:'Sztanga',muscle:'Czworogłowy, Pośladki, Dwugłowy, Prostownicy',tip:'Kolana w kierunku palców. Biodra poniżej kolan.',nsca:'Siła: 4-6x3-5. Hipertrofia: 3-4x8-12.',alt:'Przysiad goblet, Front squat, Leg press',img:'assets/ex/squat.svg'},
  {name:'Przysiad Goblet',cat:'Nogi',eq:'Hantle',muscle:'Czworogłowy, Pośladki, Core',tip:'Hantel trzymaj przy klatce.',nsca:'3x12-15.',alt:'Przysiad ze sztangą',img:'assets/ex/squat.svg'},
  {name:'Front squat',cat:'Nogi',eq:'Sztanga',muscle:'Czworogłowy (głównie), Pośladki, Core',tip:'Łokcie wysoko, klatka dumna.',nsca:'3-4x6-10.',alt:'Przysiad ze sztangą',img:'assets/ex/squat.svg'},
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
  {name:'Cable pull-through',cat:'Pośladki',eq:'Wyciąg',muscle:'Pośladki, Dwugłowy uda',tip:'Hip hinge. Ciągnij linkę między nogami do wyprostu bioder.',nsca:'3x12–15.',alt:'Hip thrust, RDL'},
  {name:'Frog pump',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki (izolacja)',tip:'Podeszwy razem, kolana na boki. Wyciskaj biodra w górę.',nsca:'3x20–30.',alt:'Mostek biodrowy, Hip thrust'},
  {name:'Reverse hyperextension',cat:'Pośladki',eq:'Maszyna',muscle:'Pośladki, Dolny grzbiet, Dwugłowy',tip:'Unoś nogi do linii tułowia. Nie przeprostowuj.',nsca:'3x12–15.',alt:'Hyperextension, Hip thrust'},
  {name:'Step-up boczny',cat:'Pośladki',eq:'Hantle',muscle:'Pośladki (średni), Stabilizacja biodra',tip:'Wejście bokiem na skrzynię. Kontrola zejścia.',nsca:'3x10–12/noga.',alt:'Step-up, Bulgarian split squat'},
  {name:'Banded hip thrust',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki (aktywacja + opór)',tip:'Taśma nad kolanami — rozpychaj na boki przy wyproście.',nsca:'3x15–20.',alt:'Hip thrust, Monster walk'},
  {name:'45° hyperextension pośladki',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki, Dolny grzbiet',tip:'Zaokrąglij lekko górę ruchu w pośladkach, nie w odcinku lędźwiowym.',nsca:'3x12–15.',alt:'Hip thrust, Reverse hyperextension'},
  {name:'Glute march',cat:'Pośladki',eq:'Własna masa',muscle:'Pośladki (jednostronnie), Core',tip:'Mostek + naprzemienne unoszenie kolan.',nsca:'3x10/stronę.',alt:'Hip thrust jednonóż, Mostek biodrowy'},
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
window.DEF_EX=DEF_EX;


function allExercises(){
  // Własne ćwiczenia trenera (EX) mają PIERWSZEŃSTWO nad domyślnymi (DEF_EX) o tej samej nazwie —
  // wcześniej było odwrotnie, przez co własne ćwiczenie znikało bez ostrzeżenia.
  const all=[...(EX||[]),...DEF_EX];
  const seen=new Set();
  return all.filter(e=>{if(seen.has(e.name))return false;seen.add(e.name);return true;});
}

// Ciemna lista podpowiedzi ćwiczeń (zamiast natywnego białego datalist)
let _exAcState=null;

function exercisesGroupedByCat(q){
  const ql=(q||'').trim().toLowerCase();
  const all=allExercises();
  const filtered=ql?all.filter(e=>
    e.name.toLowerCase().includes(ql)||
    (e.cat||'').toLowerCase().includes(ql)||
    (e.muscle||'').toLowerCase().includes(ql)||
    (e.eq||'').toLowerCase().includes(ql)
  ):all;
  const byCat={};
  filtered.forEach(e=>{
    const cat=e.cat||'Inne';
    if(!byCat[cat])byCat[cat]=[];
    byCat[cat].push(e);
  });
  Object.keys(byCat).forEach(cat=>byCat[cat].sort((a,b)=>a.name.localeCompare(b.name,'pl')));
  const order=[...Object.keys(CAT_COLORS_EX),...Object.keys(byCat).filter(c=>!CAT_COLORS_EX[c])];
  return order.filter(cat=>byCat[cat]?.length).map(cat=>({cat,items:byCat[cat]}));
}

function exAcFilter(q){
  const groups=exercisesGroupedByCat(q);
  const flat=[];
  groups.forEach(g=>g.items.forEach(e=>flat.push(e.name)));
  return flat.slice(0,40);
}

function exAcEnsureWrap(input){
  if(!input)return null;
  let wrap=input.closest('.ex-ac-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.className='ex-ac-wrap';
  input.parentNode.insertBefore(wrap,input);
  wrap.appendChild(input);
  const dd=document.createElement('div');
  dd.className='ex-ac-dropdown';
  wrap.appendChild(dd);
  input.removeAttribute('list');
  input.setAttribute('autocomplete','off');
  input.classList.add('ex-ac-input');
  return wrap;
}

function exAcHide(input){
  const wrap=input&&input.closest('.ex-ac-wrap');
  const dd=wrap&&wrap.querySelector('.ex-ac-dropdown');
  if(dd)dd.style.display='none';
  if(_exAcState&&(!input||_exAcState.input===input))_exAcState=null;
}

function exAcHighlight(dd,idx){
  const items=[...dd.querySelectorAll('.ex-ac-item')];
  items.forEach((el,i)=>el.classList.toggle('active',i===idx));
  const active=items[idx];
  if(active)active.scrollIntoView({block:'nearest'});
  return items;
}

function exAcPick(input,name){
  if(!input)return;
  input.value=name;
  exAcHide(input);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function exAcRender(input){
  if(!input||typeof allExercises!=='function')return;
  const wrap=exAcEnsureWrap(input);
  const dd=wrap.querySelector('.ex-ac-dropdown');
  const groups=exercisesGroupedByCat(input.value);
  const total=groups.reduce((s,g)=>s+g.items.length,0);
  if(!total){
    dd.innerHTML='<div class="ex-ac-empty">Brak wyników — wpisz nazwę lub partię (np. klatka, plecy)</div>';
    dd.style.display='block';
    _exAcState={input,dd,idx:-1};
    return;
  }
  const ql=(input.value||'').trim();
  let html='';
  groups.forEach(g=>{
    const col=CAT_COLORS_EX[g.cat]||'var(--muted)';
    const slice=ql?g.items.slice(0,40):g.items.slice(0,16);
    html+=`<div class="ex-ac-group-hdr"><span class="ex-cat-dot" style="background:${col};"></span>${typeof escHtml==='function'?escHtml(g.cat):g.cat} <span style="opacity:0.65;font-weight:500;">(${g.items.length})</span></div>`;
    slice.forEach(e=>{
      const name=e.name||'';
      const safe=typeof escHtml==='function'?escHtml(name):name;
      const attr=String(name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      const part=e.cat||g.cat||'Inne';
      const partSafe=typeof escHtml==='function'?escHtml(part):part;
      const partCol=CAT_COLORS_EX[part]||col;
      html+=`<button type="button" class="ex-ac-item" data-name="${attr}"><span class="ex-ac-part" style="color:${partCol};border-color:${partCol}55;background:${partCol}18;">${partSafe}</span><span class="ex-ac-name">${safe}</span></button>`;
    });
    if(!ql&&g.items.length>16)html+=`<div class="ex-ac-more">+ ${g.items.length-16} więcej — wpisz aby zawęzić</div>`;
  });
  dd.innerHTML=html;
  dd.style.display='block';
  _exAcState={input,dd,idx:-1};
}

function exAcInitInput(input){
  if(!input||input.dataset.exAcInit)return;
  input.dataset.exAcInit='1';
  exAcEnsureWrap(input);
  input.addEventListener('focus',()=>exAcRender(input));
  input.addEventListener('input',()=>exAcRender(input));
  input.addEventListener('keydown',e=>{
    const st=_exAcState&&_exAcState.input===input?_exAcState:null;
    const dd=st&&st.dd;
    const open=dd&&dd.style.display!=='none';
    const items=dd?[...dd.querySelectorAll('.ex-ac-item')]:[];
    if(e.key==='ArrowDown'){
      e.preventDefault();
      if(!open){exAcRender(input);return;}
      st.idx=Math.min(st.idx+1,items.length-1);
      exAcHighlight(dd,st.idx);
    }else if(e.key==='ArrowUp'){
      e.preventDefault();
      if(!open)return;
      st.idx=Math.max(st.idx-1,0);
      exAcHighlight(dd,st.idx);
    }else if(e.key==='Enter'){
      if(!open||st.idx<0||!items[st.idx])return;
      e.preventDefault();
      exAcPick(input,items[st.idx].dataset.name||items[st.idx].textContent.trim());
    }else if(e.key==='Escape'){
      exAcHide(input);
    }
  });
  input.addEventListener('blur',()=>setTimeout(()=>exAcHide(input),160));
}

function exAcInitAll(root){
  const scope=root&&root.querySelectorAll?root:document;
  scope.querySelectorAll('input[list="ex-dl"], input.ex-ac-input').forEach(exAcInitInput);
}

document.addEventListener('mousedown',e=>{
  const item=e.target.closest('.ex-ac-item');
  if(!item)return;
  e.preventDefault();
  const input=item.closest('.ex-ac-wrap')?.querySelector('input');
  exAcPick(input,item.dataset.name||item.textContent.trim());
});

document.addEventListener('focusin',e=>{
  if(e.target.matches&&e.target.matches('input[list="ex-dl"], input.ex-ac-input'))exAcInitInput(e.target);
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>exAcInitAll());
else exAcInitAll();

window.exAcInitInput=exAcInitInput;
window.exAcInitAll=exAcInitAll;

// Zwraca własne (niedomyślne) ćwiczenie trenera o danej nazwie, jeśli istnieje.
function findCustomEx(name){
  return (EX||[]).find(e=>e.name===name);
}

function editEx(name){
  const ex=findCustomEx(name);
  if(!ex){notify('To ćwiczenie z domyślnej biblioteki — nie można go edytować');return;}
  openM('m-ex'); // resetuje formularz
  document.getElementById('ex-name').value=ex.name||'';
  document.getElementById('ex-cat').value=ex.cat||'';
  document.getElementById('ex-eq').value=ex.eq||'';
  document.getElementById('ex-desc').value=ex.desc||ex.tip||'';
  const ev=document.getElementById('ex-video');
  if(ev)ev.value=ex.video||'';
  const ei=document.getElementById('ex-img');
  if(ei)ei.value=ex.gif||ex.img||ex.thumb||ex.image||'';
  const titleEl=document.querySelector('#m-ex .modal-title');
  if(titleEl)titleEl.textContent='EDYTUJ ĆWICZENIE';
  const saveBtn=document.querySelector('#m-ex .modal-footer .btn-primary');
  if(saveBtn)saveBtn.textContent='Zapisz zmiany';
  window._editingExName=name;
}

async function delEx(name){
  const ex=findCustomEx(name);
  if(!ex){notify('To ćwiczenie z domyślnej biblioteki — nie można go usunąć');return;}
  if(!confirm('Usunąć ćwiczenie "'+name+'"?'))return;
  window.EX=(EX||[]).filter(e=>e.name!==name);
  document.getElementById('ex-detail').style.transform='translateX(100%)';
  renderLib();
  notify('Ćwiczenie usunięte');
  if(window._db&&ex.id){try{await window._del(window._doc(window._db,'exercises',ex.id));}catch(e){console.warn('Firebase delEx:',e);}}
}

async function saveEx(){
  if(window._saveGuard_saveEx)return;window._saveGuard_saveEx=true;setTimeout(()=>window._saveGuard_saveEx=false,1500);

  const name=document.getElementById('ex-name').value.trim();if(!name){notify('Wpisz nazwę!');return;}
  const video=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl((document.getElementById('ex-video')||{}).value):((document.getElementById('ex-video')||{}).value||'');
  const imgRaw=String((document.getElementById('ex-img')||{}).value||'').trim();
  const mediaUrl=(imgRaw&&!/^(javascript|data|vbscript):/i.test(imgRaw)&&(/^(https?:\/\/)/i.test(imgRaw)||imgRaw.startsWith('assets/')||/\.(png|jpe?g|gif|webp|svg|mp4|webm)(\?.*)?$/i.test(imgRaw)))?imgRaw:'';
  const isGif=/\.(gif|webp|mp4|webm)(\?.*)?$/i.test(mediaUrl);
  const gif=isGif?mediaUrl:'';
  const img=mediaUrl&&!isGif?mediaUrl:'';
  const editingName=window._editingExName;
  if(editingName){
    const idx=(EX||[]).findIndex(e=>e.name===editingName);
    if(idx>=0){
      const oldId=EX[idx].id;
      EX[idx]={...EX[idx],name,cat:document.getElementById('ex-cat').value,eq:document.getElementById('ex-eq').value,desc:document.getElementById('ex-desc').value,tip:document.getElementById('ex-desc').value,video,img,gif:gif||EX[idx].gif||''};
      window._editingExName=null;
      closeM('m-ex');renderLib();notify('Ćwiczenie zaktualizowane!');
      await persistById('exercises',EX[idx]);
      return;
    }
  }
  const ex=withTrainer({id:newId('ex'),name,cat:document.getElementById('ex-cat').value,eq:document.getElementById('ex-eq').value,desc:document.getElementById('ex-desc').value,tip:document.getElementById('ex-desc').value,video,img,gif,muscle:'',nsca:'',alt:''});
  EX.push(ex);closeM('m-ex');renderLib();notify('Ćwiczenie dodane!');
  await persistById('exercises',ex);
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

window.exercisesGroupedByCat=exercisesGroupedByCat;

function exCardHtml(e,i){
  const col=CAT_COLORS_EX[e.cat]||'var(--muted2)';
  const thumb=typeof exThumbUrl==='function'?exThumbUrl(e):'';
  const letter=((e.name||'?').trim()[0]||'?').toUpperCase();
  const media=thumb
    ?`<div class="ex-card-thumb"><img src="${typeof escHtml==='function'?escHtml(thumb):thumb}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`
    :`<div class="ex-card-thumb ex-card-thumb-ph" style="background:${col}22;color:${col};">${letter}</div>`;
  return `<div class="ex-card${exSelId===e.name?' selected':''}" style="animation-delay:${(i||0)*0.025}s" onclick="openExDetail('${e.name.replace(/'/g,"\\'")}')">
    <div class="ex-card-accent" style="background:${col};"></div>
    <div class="ex-card-body">
      ${media}
      <div>
        <div class="ex-card-name">${e.name}</div>
        <div class="ex-card-tags">
          <span class="pill pill-muted" style="font-size:9px;">${e.cat}</span>
          <span class="pill pill-muted" style="font-size:9px;">${e.eq}</span>
        </div>
        ${e.muscle?`<div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${e.muscle}</div>`:''}
        ${e.tip?`<div class="ex-card-tip">${e.tip.substring(0,80)}${e.tip.length>80?'…':''}</div>`:''}
      </div>
    </div>
  </div>`;
}

function renderLibGroupedSections(filtered,mode){
  const byCat={};
  filtered.forEach(e=>{
    const c=e.cat||'Inne';
    if(!byCat[c])byCat[c]=[];
    byCat[c].push(e);
  });
  const order=[...Object.keys(CAT_COLORS_EX),...Object.keys(byCat).filter(c=>!CAT_COLORS_EX[c])];
  if(mode==='grid'){
    const grid=document.getElementById('lib-grid');
    if(!grid)return;
    let html='';
    let idx=0;
    order.forEach(cat=>{
      const items=byCat[cat];
      if(!items?.length)return;
      items.sort((a,b)=>a.name.localeCompare(b.name,'pl'));
      const col=CAT_COLORS_EX[cat]||'var(--muted)';
      html+=`<div class="ex-cat-section">
        <div class="ex-cat-section-hdr"><span class="ex-cat-dot" style="background:${col};"></span><span>${cat}</span><span class="ex-cat-section-count">${items.length}</span></div>
        <div class="ex-cat-section-grid">${items.map(e=>exCardHtml(e,idx++)).join('')}</div>
      </div>`;
    });
    grid.innerHTML=html||'<div style="text-align:center;padding:40px;color:var(--muted);">Brak ćwiczeń pasujących do filtrów</div>';
    return;
  }
  const body=document.getElementById('ex-list-body');
  if(!body)return;
  let html='';
  order.forEach(cat=>{
    const items=byCat[cat];
    if(!items?.length)return;
    items.sort((a,b)=>a.name.localeCompare(b.name,'pl'));
    const col=CAT_COLORS_EX[cat]||'var(--muted2)';
    html+=`<div class="ex-cat-section-hdr ex-cat-section-hdr-list"><span class="ex-cat-dot" style="background:${col};"></span><span>${cat}</span><span class="ex-cat-section-count">${items.length}</span></div>`;
    items.forEach((e,i)=>{
      html+=`<div class="ex-list-row" style="animation-delay:${i*0.02}s" onclick="openExDetail('${e.name.replace(/'/g,"\\'")}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:4px;height:32px;border-radius:2px;background:${col};flex-shrink:0;"></div>
          <div><div style="font-size:13px;font-weight:600;color:var(--text);">${e.name}</div><div style="font-size:11px;color:var(--muted);margin-top:1px;">${e.muscle||''}</div></div>
        </div>
        <span class="pill pill-muted" style="font-size:10px;align-self:center;">${e.cat}</span>
        <span class="pill pill-muted" style="font-size:10px;align-self:center;">${e.eq}</span>
        <div style="font-size:11px;color:var(--muted);align-self:center;">${(e.tip||'').substring(0,60)}${(e.tip||'').length>60?'…':''}</div>
        <div style="align-self:center;"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openExDetail('${e.name.replace(/'/g,"\\'")}')">Szczegóły</button></div>
      </div>`;
    });
  });
  body.innerHTML=html||'<div style="padding:40px;text-align:center;color:var(--muted);">Brak ćwiczeń</div>';
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

  const useGrouped=exCatFilter==='Wszystkie';

  if(exView==='grid'){
    const grid=document.getElementById('lib-grid');
    if(useGrouped){
      grid.classList.add('ex-lib-grouped');
      renderLibGroupedSections(filtered,'grid');
      return;
    }
    grid.classList.remove('ex-lib-grouped');
    if(!filtered.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);">Brak ćwiczeń pasujących do filtrów</div>';return;}
    grid.innerHTML=filtered.map((e,i)=>exCardHtml(e,i)).join('');
  } else {
    if(useGrouped){
      renderLibGroupedSections(filtered,'list');
      return;
    }
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
    ${(()=>{const media=typeof resolveCoachMedia==='function'?resolveCoachMedia(e):null;if(!media)return'';let h='';if(media.gif&&typeof exTechniqueMediaHtml==='function')h+=exTechniqueMediaHtml({gif:media.gif,name:e.name},{});else if(media.img){h+=`<div class="ex-detail-thumb"><img src="${typeof escHtml==='function'?escHtml(media.img):media.img}" alt="Technika: ${typeof escHtml==='function'?escHtml(e.name):e.name}" loading="lazy" referrerpolicy="no-referrer"></div>`;}if(typeof coachMediaHtml==='function')h+=coachMediaHtml({...media,name:e.name},{showVideo:!!media.video,showGif:false});return h;})()}
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
      <div style="background:var(--adim);border:1px solid rgba(230,0,0,0.15);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6;">${e.nsca}</div>
    </div>`:''}
    ${e.alt?`<div style="margin-bottom:12px;">
      <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Zamienniki</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${e.alt.split(',').map(a=>`<span class="pill pill-muted" style="font-size:10px;cursor:pointer;" onclick="openExDetail('${a.trim().replace(/'/g,"\\'")}')">→ ${a.trim()}</span>`).join('')}</div>
    </div>`:''}
    <div style="display:flex;gap:6px;margin-top:4px;">
      <button class="btn btn-primary btn-sm" style="flex:1;" onclick="prefillExInBuilder('${e.name.replace(/'/g,"\\'")}')">Użyj w builderze</button>
    </div>
    ${findCustomEx(e.name)?`<div style="display:flex;gap:6px;margin-top:6px;">
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="editEx('${e.name.replace(/'/g,"\\'")}')">✏ Edytuj</button>
      <button class="btn btn-ghost btn-sm" style="flex:1;color:var(--red);" onclick="delEx('${e.name.replace(/'/g,"\\'")}')">🗑 Usuń</button>
    </div>`:''}
    ${typeof ownVideoForExercise==='function'&&ownVideoForExercise(e.name)?'':`<button onclick="event.stopPropagation();(function(){window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(currentExDetail+' cwiczenie technika wykonania'),'_blank');})()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;padding:10px;background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.3);border-radius:8px;color:#ff4444;font-size:12px;font-weight:700;cursor:pointer;" onmouseover="this.style.background='rgba(255,0,0,0.2)'" onmouseout="this.style.background='rgba(255,0,0,0.1)'">&#9654; Szukaj na YouTube &#8212; technika</button>`}
    `;
  // clear AI msgs
  document.getElementById('exd-ai-msgs').innerHTML='';
  const detail=document.getElementById('ex-detail');
  detail.style.transform='translateX(0)';
  renderLib();
}

window.EX=window.EX||[];
window.COACH_VIDEOS=window.COACH_VIDEOS||[];
var libTab='ex';

function setLibTab(tab){
  libTab=tab==='videos'?'videos':'ex';
  renderLibTab();
}
window.setLibTab=setLibTab;

function renderLibTab(){
  const videos=libTab==='videos';
  const exBody=document.getElementById('lib-ex-body');
  const vidBody=document.getElementById('lib-vid-body');
  if(exBody)exBody.style.display=videos?'none':'flex';
  if(vidBody)vidBody.style.display=videos?'block':'none';
  const title=document.getElementById('lib-top-title');
  if(title)title.textContent=videos?'Moje filmy':'Biblioteka ćwiczeń';
  const tabEx=document.getElementById('lib-tab-ex');
  const tabVid=document.getElementById('lib-tab-vid');
  if(tabEx)tabEx.className='btn btn-sm '+(videos?'btn-ghost':'btn-primary');
  if(tabVid)tabVid.className='btn btn-sm '+(videos?'btn-primary':'btn-ghost');
  const view=document.getElementById('lib-ex-view-btns');
  if(view)view.style.display=videos?'none':'flex';
  const addEx=document.getElementById('lib-add-ex');
  const addVid=document.getElementById('lib-add-vid');
  if(addEx)addEx.style.display=videos?'none':'';
  if(addVid)addVid.style.display=videos?'':'none';
  if(videos)renderOwnVideos();
  else renderLib();
}
window.renderLibTab=renderLibTab;

function renderOwnVideos(){
  const el=document.getElementById('own-videos-grid');
  if(!el)return;
  const list=(window.COACH_VIDEOS||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!list.length){
    el.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px 16px;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:8px;opacity:.4;">▶</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Brak własnych filmów</div>
      <div style="font-size:12px;margin-bottom:14px;">Wklej link YouTube (niewidoczny) albo .mp4 i podepnij pod ćwiczenie.</div>
      <button class="btn btn-primary btn-sm" onclick="openM('m-own-video')">+ Dodaj film</button>
    </div>`;
    return;
  }
  el.innerHTML=list.map(v=>{
    const url=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(v.url):v.url;
    const embed=typeof coachVideoEmbed==='function'?coachVideoEmbed(url):'';
    const file=typeof coachVideoIsFile==='function'&&coachVideoIsFile(url);
    let player='';
    if(embed)player=`<div class="cw-video-wrap" style="margin-bottom:8px;"><iframe src="${escHtml(embed)}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen title="${escHtml(v.name||'Film')}"></iframe></div>`;
    else if(file)player=`<div class="cw-video-wrap" style="margin-bottom:8px;"><video src="${escHtml(url)}" controls playsinline></video></div>`;
    else if(url)player=`<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="margin-bottom:8px;">↗ Otwórz link</a>`;
    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px;">
      ${player}
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${escHtml(v.name||'Film')}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">${v.exName?('Ćwiczenie: '+escHtml(v.exName)):'Bez ćwiczenia — podepnij przy edycji'}</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="editOwnVideo('${v.id}')">Edytuj</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;color:var(--red);" onclick="delOwnVideo('${v.id}')">Usuń</button>
      </div>
    </div>`;
  }).join('');
}
window.renderOwnVideos=renderOwnVideos;

async function saveOwnVideo(){
  if(window._saveGuard_saveOwnVideo)return;window._saveGuard_saveOwnVideo=true;setTimeout(()=>window._saveGuard_saveOwnVideo=false,1500);
  const name=(document.getElementById('ov-name')||{}).value.trim();
  const raw=(document.getElementById('ov-url')||{}).value;
  const url=typeof normalizeCoachVideoUrl==='function'?normalizeCoachVideoUrl(raw):String(raw||'').trim();
  const exName=(document.getElementById('ov-ex')||{}).value.trim();
  if(!name){notify('Wpisz nazwę filmu');return;}
  if(!url){notify('Wklej poprawny link https (YouTube, Vimeo albo .mp4)');return;}
  const editing=window._editingVideoId;
  if(editing){
    const idx=(window.COACH_VIDEOS||[]).findIndex(v=>v.id===editing);
    if(idx>=0){
      window.COACH_VIDEOS[idx]={...window.COACH_VIDEOS[idx],name,url,exName,updatedAt:new Date().toISOString()};
      window._editingVideoId=null;
      closeM('m-own-video');
      renderOwnVideos();
      notify('Film zaktualizowany');
      await persistById('coachVideos',window.COACH_VIDEOS[idx]);
      return;
    }
  }
  const v=withTrainer({id:newId('cv'),name,url,exName,createdAt:new Date().toISOString()});
  window.COACH_VIDEOS=window.COACH_VIDEOS||[];
  window.COACH_VIDEOS.push(v);
  closeM('m-own-video');
  renderOwnVideos();
  notify('Film dodany — klient zobaczy go przy ćwiczeniu w Starcie');
  await persistById('coachVideos',v);
}
window.saveOwnVideo=saveOwnVideo;

function editOwnVideo(id){
  const v=(window.COACH_VIDEOS||[]).find(x=>x.id===id);
  if(!v){notify('Nie znaleziono filmu');return;}
  openM('m-own-video');
  const n=document.getElementById('ov-name');if(n)n.value=v.name||'';
  const u=document.getElementById('ov-url');if(u)u.value=v.url||'';
  const e=document.getElementById('ov-ex');if(e)e.value=v.exName||'';
  const titleEl=document.querySelector('#m-own-video .modal-title');
  if(titleEl)titleEl.textContent='EDYTUJ FILM';
  const saveBtn=document.querySelector('#m-own-video .modal-footer .btn-primary');
  if(saveBtn)saveBtn.textContent='Zapisz zmiany';
  window._editingVideoId=id;
}
window.editOwnVideo=editOwnVideo;

async function delOwnVideo(id){
  const v=(window.COACH_VIDEOS||[]).find(x=>x.id===id);
  if(!v)return;
  if(!confirm('Usunąć film "'+(v.name||'')+'"?'))return;
  window.COACH_VIDEOS=(window.COACH_VIDEOS||[]).filter(x=>x.id!==id);
  renderOwnVideos();
  notify('Film usunięty');
  if(window._db){try{await window._del(window._doc(window._db,'coachVideos',id));}catch(e){console.warn('Firebase delOwnVideo:',e);}}
}
window.delOwnVideo=delOwnVideo;

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
  prefillExInBuilder(name);
}

async function askExAI(){
  const q=document.getElementById('exd-ai-q').value.trim();if(!q)return;
  document.getElementById('exd-ai-q').value='';
  const msgs=document.getElementById('exd-ai-msgs');
  msgs.innerHTML+='<div style="text-align:right;margin-bottom:5px;"><div style="display:inline-block;background:var(--accent);color:#fff;padding:5px 9px;border-radius:8px;font-size:11px;">'+q+'</div></div>';
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
  {
    id:'dp21',type:'demo',name:'Cardio Start — 1 tydzień',goal:'kondycja',level:'poczatkujacy',duration:1,daysPerWeek:5,equip:'Bez sprzętu',method:'Cardio',
    desc:'Krótki, 7-dniowy program wprowadzający do treningu wytrzymałościowego. Codzienna, rosnąca dawka cardio — idealny jako tydzień próbny przed dłuższym programem albo samodzielny reset kondycyjny.',
    highlights:['Codzienna progresja intensywności','Mix: marsz, trucht, rower, skakanka','Zero sprzętu — start od zaraz','Naturalne wprowadzenie do dłuższych programów'],
    weeks:[
      {nr:1,label:'Tydzień startowy',rpe:'RPE 5-7 (rośnie każdego dnia)',focus:'Codzienna, rosnąca dawka cardio',days:[{d:'PON',name:'Marsz szybki 20 min, tętno strefa 2'},{d:'WT',name:'Trucht/marsz naprzemienny 20 min (2 min trucht / 1 min marsz)'},{d:'ŚR',name:'Skakanka: 5×2 min (przerwa 1 min)'},{d:'CZ',name:'Rower/orbitrek 25 min, stałe tempo'},{d:'PT',name:'Krótki test: 12 min tak dużo dystansu ile dasz radę (Cooper test)'}]},
    ]
  },
  {
    id:'dp22',type:'demo',name:'Cardio Baza Wytrzymałościowa — 4 tygodnie',goal:'kondycja',level:'poczatkujacy',duration:4,daysPerWeek:4,equip:'Bez sprzętu',method:'Cardio',
    desc:'Budowanie aerobowej bazy wytrzymałościowej metodą stałego wysiłku (steady-state) z automatyczną progresją czasu i tempa co tydzień. Fundament pod każdy dalszy trening kondycyjny.',
    highlights:['Progresja czasu: 20→35 min','Trening w strefie tętna 2 (łatwa rozmowa)','1× tydzień test tempa','Zero sprzętu, dowolna dyscyplina cardio'],
    weeks:[
      {nr:1,label:'Baza — 20 min',rpe:'RPE 5-6 (strefa 2)',focus:'Budowanie nawyku, stałe, łatwe tempo',days:[{d:'PON',name:'Cardio ciągłe 20 min'},{d:'WT',name:'REST / spacer regeneracyjny'},{d:'ŚR',name:'Cardio ciągłe 20 min'},{d:'PT',name:'Cardio ciągłe 22 min'},{d:'NIE',name:'Cardio ciągłe 22 min, luźne tempo'}]},
      {nr:2,label:'Baza — 25 min',rpe:'RPE 6',focus:'+5 min do każdej sesji',days:[{d:'PON',name:'Cardio ciągłe 25 min'},{d:'ŚR',name:'Cardio ciągłe 25 min'},{d:'PT',name:'Cardio ciągłe 27 min'},{d:'NIE',name:'Cardio ciągłe 27 min'}]},
      {nr:3,label:'Baza — 30 min',rpe:'RPE 6-7',focus:'Wydłużanie + 1 sesja z lekkim przyspieszeniem',days:[{d:'PON',name:'Cardio ciągłe 30 min'},{d:'ŚR',name:'Cardio 30 min + 5×1 min przyspieszenie'},{d:'PT',name:'Cardio ciągłe 32 min'},{d:'NIE',name:'Cardio ciągłe 32 min'}]},
      {nr:4,label:'Test + Ocena',rpe:'RPE 7',focus:'Test tempa na 35 min — porównanie z tygodniem 1',days:[{d:'PON',name:'Cardio ciągłe 35 min'},{d:'ŚR',name:'Cardio ciągłe 30 min, lżej'},{d:'PT',name:'TEST: 35 min, maksymalny dystans przy stałym tętnie'}]},
    ]
  },
  {
    id:'dp23',type:'demo',name:'HIIT Spalacz — 12 tygodni',goal:'kondycja',level:'zaawansowany',duration:12,daysPerWeek:4,equip:'Bez sprzętu',method:'HIIT',
    desc:'Długoterminowy program interwałowy o wysokiej intensywności z pełną periodyzacją blokową (3 bloki po 4 tygodnie). Automatyczna progresja: dłuższe interwały, krótsze przerwy, więcej rund. Dla osób z solidną bazą kondycyjną.',
    highlights:['3 bloki progresji po 4 tygodnie','Stosunek pracy do przerwy rośnie z 1:2 do 1:1','Deload co 4. tydzień','Test Cooper na starcie i mecie'],
    weeks:[
      {nr:1,label:'Blok I — Wprowadzenie',rpe:'RPE 7',focus:'20s praca / 40s przerwa × 8 rund',days:[{d:'PON',name:'HIIT: 8× (20s max + 40s przerwa)'},{d:'WT',name:'REST / mobilność'},{d:'CZ',name:'HIIT: 8× (20s max + 40s przerwa)'},{d:'SO',name:'Cardio LISS 25 min (regeneracja)'}]},
      {nr:2,label:'Blok I — Progresja',rpe:'RPE 7-8',focus:'30s praca / 40s przerwa × 8 rund',days:[{d:'PON',name:'HIIT: 8× (30s max + 40s przerwa)'},{d:'CZ',name:'HIIT: 8× (30s max + 40s przerwa)'},{d:'SO',name:'Cardio LISS 25 min'}]},
      {nr:3,label:'Blok I — Szczyt',rpe:'RPE 8',focus:'30s praca / 30s przerwa × 10 rund',days:[{d:'PON',name:'HIIT: 10× (30s max + 30s przerwa)'},{d:'CZ',name:'HIIT: 10× (30s max + 30s przerwa)'},{d:'SO',name:'Cardio LISS 30 min'}]},
      {nr:4,label:'DELOAD I',rpe:'RPE 5-6',focus:'Regeneracja — połowa objętości',days:[{d:'PON',name:'HIIT lekki: 6× (20s + 40s)'},{d:'CZ',name:'Cardio LISS 20 min'}]},
      {nr:5,label:'Blok II — Restart wyżej',rpe:'RPE 8',focus:'40s praca / 40s przerwa × 8 rund',days:[{d:'PON',name:'HIIT: 8× (40s max + 40s przerwa)'},{d:'WT',name:'REST'},{d:'CZ',name:'HIIT: 8× (40s max + 40s przerwa)'},{d:'SO',name:'Cardio LISS 30 min'}]},
      {nr:8,label:'DELOAD II',rpe:'RPE 5-6',focus:'Regeneracja przed blokiem finałowym',days:[{d:'PON',name:'HIIT lekki: 6 rund'},{d:'CZ',name:'Cardio LISS 25 min'}]},
      {nr:9,label:'Blok III — Peak',rpe:'RPE 8-9',focus:'40s praca / 30s przerwa × 10 rund',days:[{d:'PON',name:'HIIT: 10× (40s max + 30s przerwa)'},{d:'CZ',name:'HIIT: 10× (40s max + 30s przerwa)'},{d:'SO',name:'Cardio LISS 30 min'}]},
      {nr:12,label:'TEST KOŃCOWY',rpe:'RPE 9-10',focus:'Test Cooper — porównanie z tygodniem 1',days:[{d:'PON',name:'HIIT: 45s praca / 30s przerwa × 10 rund'},{d:'PT',name:'TEST COOPER: maksymalny dystans w 12 min'}]},
    ]
  },
  {
    id:'dp24',type:'demo',name:'EMOM Kondycja Pro — 12 tygodni',goal:'kondycja',level:'sredni',duration:12,daysPerWeek:4,equip:'Mieszany',method:'EMOM',
    desc:'12-tygodniowy program EMOM (Every Minute On the Minute) z automatyczną progresją liczby powtórzeń i długości sesji co tydzień. Łączy kondycję z pracą siłową w krótkim czasie.',
    highlights:['Progresja: 20→35 minut EMOM','Rosnąca liczba powtórzeń w minucie','Deload co 4. tydzień','Mierzalny postęp — więcej rund w tym samym czasie'],
    weeks:[
      {nr:1,label:'EMOM 20 min',rpe:'RPE 6-7',focus:'Nauka tempa, umiarkowana liczba powtórzeń',days:[{d:'PON',name:'EMOM 20 min: 8 burpees + 10 kettlebell swing'},{d:'ŚR',name:'EMOM 20 min: 10 przysiadów + 8 pompek'},{d:'PT',name:'EMOM 20 min: 12 mountain climbers + 6 podciągnięć/rząd'}]},
      {nr:2,label:'EMOM 25 min',rpe:'RPE 7',focus:'+5 minut, ten sam ciężar pracy',days:[{d:'PON',name:'EMOM 25 min: 9 burpees + 11 kettlebell swing'},{d:'ŚR',name:'EMOM 25 min: 11 przysiadów + 9 pompek'},{d:'PT',name:'EMOM 25 min: 13 mountain climbers + 7 wiosłowań'}]},
      {nr:3,label:'EMOM 30 min',rpe:'RPE 7-8',focus:'Szczyt objętości w tym bloku',days:[{d:'PON',name:'EMOM 30 min: 10 burpees + 12 kettlebell swing'},{d:'ŚR',name:'EMOM 30 min: 12 przysiadów + 10 pompek'},{d:'PT',name:'EMOM 30 min: 14 mountain climbers + 8 wiosłowań'}]},
      {nr:4,label:'DELOAD',rpe:'RPE 5-6',focus:'-50% objętości, regeneracja',days:[{d:'PON',name:'EMOM 15 min, lekkie tempo'},{d:'PT',name:'EMOM 15 min, lekkie tempo'}]},
      {nr:8,label:'EMOM 30 min — Blok II',rpe:'RPE 8',focus:'Nowy blok, wyższy próg wejścia',days:[{d:'PON',name:'EMOM 30 min: 12 burpees + 14 kettlebell swing'},{d:'ŚR',name:'EMOM 30 min: 14 przysiadów pistolet-progresja + 12 pompek'},{d:'PT',name:'EMOM 30 min: 16 mountain climbers + 10 wiosłowań'}]},
      {nr:12,label:'EMOM 35 min — Test',rpe:'RPE 8-9',focus:'Maksymalna objętość programu',days:[{d:'PON',name:'EMOM 35 min: pełny obwód, rundy jak w tyg. 8 +2 powt.'},{d:'PT',name:'TEST: EMOM 20 min na maksymalną liczbę powtórzeń'}]},
    ]
  },
  {
    id:'dp25',type:'demo',name:'Tabata Full Send — 12 tygodni',goal:'kondycja',level:'zaawansowany',duration:12,daysPerWeek:4,equip:'Bez sprzętu',method:'Tabata',
    desc:'Rozszerzony, 12-tygodniowy program Tabata (20s max / 10s przerwy) z automatyczną progresją liczby rund i bloków. Dla osób gotowych na regularny, bardzo intensywny trening interwałowy.',
    highlights:['Start: 4 rundy (16 min) → Meta: 8 rund (32 min)','Klasyczny protokół 20:10 przez cały program','Rotacja ćwiczeń co tydzień — brak monotonii','Deload co 4. tydzień chroni stawy i CNS'],
    weeks:[
      {nr:1,label:'4 rundy Tabata',rpe:'RPE 8',focus:'2 bloki × 4 rundy (20s/10s), różne ćwiczenia',days:[{d:'PON',name:'Tabata: Burpees + Jump Squats (2×4 rundy)'},{d:'ŚR',name:'Tabata: Mountain Climbers + Pompki (2×4 rundy)'},{d:'PT',name:'Tabata: High Knees + Plank Jacks (2×4 rundy)'}]},
      {nr:2,label:'5 rund Tabata',rpe:'RPE 8',focus:'2 bloki × 5 rund',days:[{d:'PON',name:'Tabata: Burpees + Jump Squats (2×5 rund)'},{d:'ŚR',name:'Tabata: Mountain Climbers + Pompki (2×5 rund)'},{d:'PT',name:'Tabata: High Knees + Plank Jacks (2×5 rund)'}]},
      {nr:3,label:'6 rund Tabata',rpe:'RPE 8-9',focus:'2 bloki × 6 rund — szczyt bloku I',days:[{d:'PON',name:'Tabata: pełny obwód, 2×6 rund'},{d:'ŚR',name:'Tabata: pełny obwód, 2×6 rund'},{d:'PT',name:'Tabata: pełny obwód, 2×6 rund'}]},
      {nr:4,label:'DELOAD',rpe:'RPE 5-6',focus:'1 blok × 4 rundy, lekkie ćwiczenia',days:[{d:'PON',name:'Tabata light: 1×4 rundy'},{d:'PT',name:'Tabata light: 1×4 rundy'}]},
      {nr:8,label:'7 rund Tabata',rpe:'RPE 9',focus:'2 bloki × 7 rund — nowy poziom',days:[{d:'PON',name:'Tabata: pełny obwód, 2×7 rund'},{d:'ŚR',name:'Tabata: pełny obwód, 2×7 rund'},{d:'PT',name:'Tabata: pełny obwód, 2×7 rund'}]},
      {nr:12,label:'8 rund Tabata — Meta',rpe:'RPE 9-10',focus:'2 bloki × 8 rund — maksimum programu',days:[{d:'PON',name:'Tabata: pełny obwód, 2×8 rund'},{d:'PT',name:'TEST: maksymalna liczba powtórzeń w 1 rundzie Tabata'}]},
    ]
  },

];

function allPrograms(){return[...DEMO_PROGRAMS,...(window.USER_PROGRAMS||[])];}
window.allPrograms=allPrograms;

/** Rozwija fokus dnia programu (np. „Push A — Klatka”) do listy ćwiczeń startowych. */
function expandSessionFromDayFocus(focus){
  const s=String(focus||'').toLowerCase();
  const ex=(name,sets,reps,rest)=>({name,sets:String(sets||'3'),reps:String(reps||'8-12'),rest:rest||'90s'});
  if(/hiit|tabata|cardio|bieg/.test(s))return[ex('Rozgrzewka mobilność','2','8-10','45s'),ex(focus||'HIIT / cardio','1','20-30 min','—'),ex('Cool-down / stretch','1','5 min','—')];
  if(/mobiln|mobility/.test(s))return[ex('Foam rolling','2','10','30s'),ex('Mobilność bioder/barków','2','10','30s'),ex(focus||'Mobilność','2','8','45s')];
  if(/push/.test(s))return[
    ex('Wyciskanie sztangi / maszyna (klatka)','4','6-10','2min'),
    ex('Wyciskanie żołnierskie / barki','3','8-12','90s'),
    ex('Rozpiętki / fly maszyna','3','10-15','75s'),
    ex('Prostowanie triceps wyciąg','3','10-12','60s'),
    ex('Unoszenie boczne','3','12-15','60s')
  ];
  if(/pull/.test(s))return[
    ex('Martwy ciąg / RDL','3','6-10','2min'),
    ex('Podciąganie / lat pulldown','4','6-10','2min'),
    ex('Wiosłowanie (wyciąg / hantel)','3','8-12','90s'),
    ex('Face pull','3','12-15','60s'),
    ex('Uginanie biceps','3','10-12','60s')
  ];
  if(/leg|nóg|nogi|lower|przysiad|czwor|dwugł|poślad/.test(s))return[
    ex('Przysiad / hack squat','4','6-10','2min'),
    ex('Leg press / wykroki','3','8-12','90s'),
    ex('RDL / leg curl','3','8-12','90s'),
    ex('Wypychanie bioder / hip thrust','3','8-12','90s'),
    ex('Wspięcia na palce','3','12-15','60s')
  ];
  if(/upper|góra/.test(s))return[
    ex('Wyciskanie klatka (maszyna/Smith)','3','6-10','2min'),
    ex('Ściąganie drążka / podciąganie','3','6-10','2min'),
    ex('Wiosłowanie siedząc','3','8-12','90s'),
    ex('Unoszenie boczne','3','10-15','60s'),
    ex('Triceps + biceps (superset)','3','10-12','60s')
  ];
  if(/fbw|full\s*body/.test(s))return[
    ex('Przysiad / goblet squat','3','6-10','2min'),
    ex('Wyciskanie (klatka lub OHP)','3','6-10','2min'),
    ex('Wiosłowanie','3','8-12','90s'),
    ex('RDL / hip hinge','3','8-12','90s'),
    ex('Core / plank','3','30-45s','45s')
  ];
  return[ex(focus||'Trening wg planu','3','8-12','90s')];
}
window.expandSessionFromDayFocus=expandSessionFromDayFocus;

/** Dni planu treningowego z tygodnia programu (z ćwiczeniami, nie pustą skorupą). */
function planDaysFromProgram(prog,weekIdx){
  if(!prog)return[];
  const weeks=prog.weeks||[];
  const week=weeks[weekIdx||0]||weeks[0]||{};
  const rawDays=week.days||prog.days||[];
  return rawDays.map(d=>{
    const label=d.d||d.day||d.dayName||'Dzień';
    const focus=d.name||d.muscles||d.focus||'';
    const isRest=!!d.rest||/^rest$/i.test(String(focus))||/^rest$/i.test(String(label))||String(focus).toUpperCase()==='REST';
    let exercises=[];
    if(!isRest){
      if(Array.isArray(d.exercises)&&d.exercises.length){
        exercises=d.exercises.map(e=>{
          if(typeof e==='string')return{name:e,sets:'3',reps:'8-12',rest:'90s'};
          return{
            name:e.name||e.n||'Ćwiczenie',
            sets:String(e.sets!=null?e.sets:(e.s!=null?e.s:'3')),
            reps:String(e.reps!=null?e.reps:(e.r!=null?e.r:'8-12')),
            rest:e.rest||'90s',
            rpe:e.rpe||e.rir||'',
            tempo:e.tempo||''
          };
        });
      }else{
        exercises=expandSessionFromDayFocus(focus||label);
      }
    }
    return{day:label,muscles:focus,rest:isRest,exercises};
  });
}
window.planDaysFromProgram=planDaysFromProgram;

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
  const footer=document.getElementById('prd-footer');
  const custom=findUserProgram(id);
  if(footer)footer.innerHTML=custom
    ?`<button class="btn btn-primary" style="flex:1;" onclick="assignProgramToClient()">Przypisz klientowi</button>
       <button class="btn btn-ghost" onclick="editProgram('${id}')">✏ Edytuj</button>
       <button class="btn btn-ghost" style="color:var(--red);" onclick="delProgram('${id}')">🗑</button>`
    :`<button class="btn btn-primary" style="flex:1;" onclick="assignProgramToClient()">Przypisz klientowi</button>
       <button class="btn btn-ghost" onclick="closeProgDetail()">Zamknij</button>`;
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
  assignProgSetClientField('','');
  document.getElementById('assign-prog-date').value=new Date().toISOString().split('T')[0];
  openM('m-assign-prog');
}

// Ustawia pole klienta w oknie przypisania programu: widoczny tekst + ukryte id.
function assignProgSetClientField(clientId,clientName){
  const hid=document.getElementById('assign-prog-client');
  const vis=document.getElementById('assign-prog-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('assign-prog-client-results');
  if(res)res.style.display='none';
}

function assignProgClientSearchInput(){
  const q=(document.getElementById('assign-prog-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('assign-prog-client-results');
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
    <div onclick="assignProgSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

async function confirmAssignProgram(){
  const p=allPrograms().find(x=>x.id===progSelId);
  if(!p)return;
  const cid=document.getElementById('assign-prog-client').value;
  const startDate=document.getElementById('assign-prog-date').value||new Date().toISOString().split('T')[0];
  const c=CL.find(x=>x.id===cid);
  if(!c){notify('Wybierz klienta!');return;}

  // Buduj pełny obiekt planu z programu (z ćwiczeniami z tygodnia 1)
  const newPlan=withTrainer({
    id:newId('p'),
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
    days:typeof planDaysFromProgram==='function'?planDaysFromProgram(p,0):[]
  });

  PL.push(newPlan);
  await persistById('plans',newPlan);

  closeM('m-assign-prog');
  closeProgDetail();

  addNotification('system','Program przypisany!','"'+p.name+'" → '+c.name,'plans');
  notify('✓ Program "'+p.name+'" przypisany do: '+c.name+'!');

  if(typeof maybeSchedulePlanToCalendar==='function'&&(newPlan.days||[]).some(d=>!d.rest&&(d.exercises||[]).length)){
    maybeSchedulePlanToCalendar(newPlan.id,{weeks:4});
  }else if(typeof schedulePlanToCalendar==='function'&&(newPlan.days||[]).some(d=>!d.rest&&(d.exercises||[]).length)){
    if(confirm('Dodać dni programu do kalendarza na 4 tygodnie?'))schedulePlanToCalendar(newPlan.id,{weeks:4});
  }

  // Jeśli profil klienta otwarty — odśwież zakładkę Plan
  if(typeof cpClientId!=='undefined'&&cpClientId===cid){
    try{setCPTab('plan');}catch(e){}
  }
}

function findUserProgram(id){
  return (window.USER_PROGRAMS||[]).find(p=>p.id===id);
}

function editProgram(id){
  const p=findUserProgram(id);
  if(!p){notify('To program z biblioteki demo — nie można go edytować');return;}
  openM('m-program'); // resetuje formularz
  document.getElementById('pm-name').value=p.name||'';
  document.getElementById('pm-goal').value=p.goal||'';
  document.getElementById('pm-level').value=p.level||'';
  document.getElementById('pm-dur').value=p.duration||'';
  document.getElementById('pm-days').value=p.daysPerWeek||'';
  document.getElementById('pm-equip').value=p.equip||'';
  document.getElementById('pm-method').value=p.method||'';
  document.getElementById('pm-desc').value=p.desc||'';
  const titleEl=document.querySelector('#m-program .modal-title');
  if(titleEl)titleEl.textContent='EDYTUJ PROGRAM';
  const saveBtn=document.querySelector('#m-program .modal-footer .btn-primary');
  if(saveBtn)saveBtn.textContent='Zapisz zmiany';
  window._editingProgId=id;
}

async function delProgram(id){
  const p=findUserProgram(id);
  if(!p){notify('To program z biblioteki demo — nie można go usunąć');return;}
  if(!confirm('Usunąć program "'+p.name+'"?'))return;
  window.USER_PROGRAMS=(window.USER_PROGRAMS||[]).filter(x=>x.id!==id);
  renderPrograms();
  notify('Program usunięty');
  if(window._db){try{await window._del(window._doc(window._db,'programs',id));}catch(e){console.warn('Firebase delProgram:',e);}}
}

async function saveUserProgram(){
  if(window._saveGuard_saveUserProgram)return;window._saveGuard_saveUserProgram=true;setTimeout(()=>window._saveGuard_saveUserProgram=false,1500);

  const name=document.getElementById('pm-name').value.trim();
  if(!name){notify('Wpisz nazwę programu!');return;}
  const editingId=window._editingProgId;
  if(editingId){
    const idx=(window.USER_PROGRAMS||[]).findIndex(x=>x.id===editingId);
    if(idx>=0){
      window.USER_PROGRAMS[idx]={...window.USER_PROGRAMS[idx],name,goal:document.getElementById('pm-goal').value,level:document.getElementById('pm-level').value,duration:parseInt(document.getElementById('pm-dur').value),daysPerWeek:parseInt(document.getElementById('pm-days').value),equip:document.getElementById('pm-equip').value,method:document.getElementById('pm-method').value,desc:document.getElementById('pm-desc').value,updatedAt:new Date().toISOString()};
      window._editingProgId=null;
      closeM('m-program');renderPrograms();notify('Program zaktualizowany!');
      await persistById('programs',window.USER_PROGRAMS[idx]);
      return;
    }
  }
  const p=withTrainer({
    id:newId('up'),type:'moje',
    name,goal:document.getElementById('pm-goal').value,
    level:document.getElementById('pm-level').value,
    duration:parseInt(document.getElementById('pm-dur').value),
    daysPerWeek:parseInt(document.getElementById('pm-days').value),
    equip:document.getElementById('pm-equip').value,
    method:document.getElementById('pm-method').value,
    desc:document.getElementById('pm-desc').value,
    highlights:[],weeks:[],createdAt:new Date().toISOString()
  });
  await persistById('programs',p);
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
  {id:'tt7',name:'Nawyki codzienne',cat:'lifestyle',icon:'🔥',desc:'Odhaczanie co dzień — liczy się seria (streak), bez jednorazowego terminu',tasks:[{title:'Wypij 3L wody',cat:'lifestyle',priority:'medium',kind:'habit'},{title:'Sen 7–8 godzin',cat:'lifestyle',priority:'medium',kind:'habit'},{title:'8 000 kroków',cat:'lifestyle',priority:'low',kind:'habit'},{title:'Białko na każdym posiłku',cat:'dieta',priority:'medium',kind:'habit'}]},
  {id:'tt8',name:'Wyzwania 21 dni',cat:'lifestyle',icon:'🏆',desc:'Terminowe odhaczanie z paskiem postępu — 21 dni, żeby domknąć nawyk',tasks:[{title:'21 dni bez słodyczy',cat:'dieta',priority:'high',kind:'challenge',days:21},{title:'21 dni treningu',cat:'trening',priority:'high',kind:'challenge',days:21},{title:'21 dni 3L wody',cat:'lifestyle',priority:'medium',kind:'challenge',days:21}]},
];

const TASK_CAT_COLORS={trening:'var(--accent)',dieta:'var(--teal)',pomiary:'var(--blue)',lifestyle:'var(--purple)'};
const TASK_CAT_LABELS={trening:'Trening',dieta:'Dieta',pomiary:'Pomiary',lifestyle:'Lifestyle'};
const TASK_PRIO_COLORS={high:'var(--red)',medium:'var(--orange)',low:'var(--teal)'};
const TASK_PRIO_LABELS={high:'Wysoki',medium:'Średni',low:'Niski'};

// Ustawia pole klienta w oknie zadania: widoczny tekst wyszukiwania + ukryte id.
function taskSetClientField(clientId,clientName){
  const hid=document.getElementById('task-client');
  const vis=document.getElementById('task-client-search');
  if(hid)hid.value=clientId;
  if(vis)vis.value=clientName;
  const res=document.getElementById('task-client-results');
  if(res)res.style.display='none';
}

// Filtruje i pokazuje klientów pod polem wyszukiwania w oknie zadania.
function taskClientSearchInput(){
  const q=(document.getElementById('task-client-search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('task-client-results');
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
    <div onclick="taskSetClientField('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:13px;">${c.name}</span>
      <span style="font-size:10px;color:${act.color};font-family:'DM Mono',monospace;">${act.label||''}</span>
    </div>`).join('');
  res.style.display='block';
}

function setTaskFilter(f){
  taskFilter=f;
  document.querySelectorAll('.task-nav-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('tn-'+f);if(el)el.classList.add('active');
  renderTasks();
}

function renderTasks(){
  const clf=document.getElementById('task-client-filter');
  if(clf){const cur=clf.value;clf.innerHTML='<option value="">Wszyscy klienci</option>'+CL.map(c=>'<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+c.name+'</option>').join('');}
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().split('T')[0];
  const search=(document.getElementById('task-search')||{}).value||'';
  const clientFil=(document.getElementById('task-client-filter')||{}).value||'';
  const sortBy=(document.getElementById('task-sort')||{}).value||'due';
  const oneShot=typeof isOneShot==='function'?isOneShot:t=>!isHabit(t);
  const isCh=typeof isChallenge==='function'?isChallenge:()=>false;
  const open=TASKS.filter(t=>oneShot(t)&&t.status!=='done');
  const done=TASKS.filter(t=>oneShot(t)&&t.status==='done');
  const over=TASKS.filter(t=>oneShot(t)&&t.status!=='done'&&t.due&&t.due<today);
  const habitsN=TASKS.filter(isHabit);
  const chN=TASKS.filter(isCh);
  const tOpen=document.getElementById('t-open');if(tOpen)tOpen.textContent=open.length;
  const tDone=document.getElementById('t-done');if(tDone)tDone.textContent=done.length;
  const tOver=document.getElementById('t-over');if(tOver)tOver.textContent=over.length;
  const tHabits=document.getElementById('t-habits');if(tHabits)tHabits.textContent=habitsN.length;
  const tCh=document.getElementById('t-challenges');if(tCh)tCh.textContent=chN.length;
  let filtered=TASKS.filter(t=>{
    if(search&&!t.title.toLowerCase().includes(search.toLowerCase()))return false;
    if(clientFil&&t.clientId!==clientFil)return false;
    if(taskFilter==='open')return oneShot(t)&&t.status!=='done';
    if(taskFilter==='done')return oneShot(t)&&t.status==='done';
    if(taskFilter==='overdue')return oneShot(t)&&t.status!=='done'&&t.due&&t.due<today;
    if(taskFilter==='habits')return isHabit(t);
    if(taskFilter==='challenges')return isCh(t);
    if(['high','medium','low'].includes(taskFilter))return t.priority===taskFilter;
    if(['trening','dieta','pomiary','lifestyle'].includes(taskFilter))return t.cat===taskFilter;
    return true;
  });
  if(sortBy==='due')filtered.sort((a,b)=>{
    const rank=t=>isHabit(t)?0:isCh(t)?1:2;
    if(rank(a)!==rank(b))return rank(a)-rank(b);
    return (a.due||'9999').localeCompare(b.due||'9999');
  });
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
      const habit=isHabit(t);
      const ch=isCh(t);
      const doneToday=(habit||ch)&&habitDoneOn(t,today);
      const streak=habit?habitStreak(t,today):0;
      const chProg=ch&&typeof challengeProgress==='function'?challengeProgress(t,today):null;
      const isOverdue=oneShot(t)&&t.status!=='done'&&t.due&&t.due<today;
      const isDone=oneShot(t)&&t.status==='done';
      const catCol=TASK_CAT_COLORS[t.cat]||'var(--muted)';
      const prioCol=TASK_PRIO_COLORS[t.priority]||'var(--muted)';
      const daysLeft=t.due?Math.ceil((new Date(t.due)-new Date())/(1000*60*60*24)):null;
      html+=`<div class="task-card${isDone?' done':''}${habit?' habit':''}${ch?' challenge':''}" style="animation-delay:${i*0.03}s;border-left:3px solid ${isDone?'var(--muted2)':ch?'var(--gold)':habit?'var(--orange)':catCol};">
        <div class="task-check${isDone||doneToday?' checked':''}" onclick="toggleTask('${t.id}')">${isDone||doneToday?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div class="task-body" onclick="editTask('${t.id}')" style="cursor:pointer;">
          <div class="task-title${isDone?' done':''}">${t.title}</div>
          <div class="task-meta">
            ${habit?`<span class="pill" style="background:rgba(201,123,63,0.18);color:var(--orange);font-size:9px;">🔥 Nawyk</span>`:''}
            ${ch?`<span class="pill" style="background:rgba(201,162,39,0.18);color:var(--gold);font-size:9px;">🏆 Wyzwanie</span>`:''}
            ${t.cat?`<span class="pill" style="background:${catCol}22;color:${catCol};font-size:9px;">${TASK_CAT_LABELS[t.cat]||t.cat}</span>`:''}
            ${habit||ch?'':`<div class="task-prio-dot" style="background:${prioCol};"></div><span style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${TASK_PRIO_LABELS[t.priority]||''}</span>`}
            ${habit&&streak?`<span class="habit-streak">🔥 ${streak} ${streak===1?'dzień':'dni'}</span>`:habit?`<span style="font-size:10px;color:var(--muted);">Odhacz na dziś</span>`:''}
            ${ch&&typeof challengeStatusText==='function'?`<span style="font-size:10px;color:${chProg&&chProg.won?'var(--teal)':chProg&&chProg.lost?'var(--muted)':'var(--gold)'};">${challengeStatusText(t,today)}</span>`:''}
            ${oneShot(t)&&t.due?`<span style="font-size:10px;font-family:'DM Mono',monospace;color:${isOverdue?'var(--red)':daysLeft<=2?'var(--orange)':'var(--muted)'};">${isOverdue?'⚠ Przeterminowane':daysLeft===0?'dziś':daysLeft===1?'jutro':'za '+daysLeft+' dni'}</span>`:''}
          </div>
          ${habit?habitWeekHtml(t,today):''}
          ${ch&&typeof challengeBarHtml==='function'?challengeBarHtml(t,today):''}
        </div>
        <button onclick="delTask('${t.id}')" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;align-self:flex-start;padding:0 2px;">×</button>
      </div>`;
    });
    html+='</div>';
  });
  el.innerHTML=html;
}

// Ładuje istniejące zadanie do formularza, żeby faktycznie je edytować.
function editTask(id){
  const t=TASKS.find(x=>x.id===id);
  if(!t){notify('Nie znaleziono zadania');return;}
  openM('m-task'); // resetuje formularz i _editingTaskId
  const tCl=CL.find(x=>x.id===t.clientId);
  taskSetClientField(t.clientId||'',tCl?tCl.name:'');
  document.getElementById('task-title').value=t.title||'';
  const catEl=document.getElementById('task-cat');if(catEl)catEl.value=t.cat||'trening';
  document.getElementById('task-priority').value=t.priority||'medium';
  const habit=isHabit(t);
  const ch=typeof isChallenge==='function'&&isChallenge(t);
  const hb=document.getElementById('task-habit');
  if(hb)hb.checked=habit;
  const chb=document.getElementById('task-challenge');
  if(chb)chb.checked=ch;
  if(ch){
    const days=typeof parseChallengeDays==='function'?parseChallengeDays(t.days):21;
    const daysEl=document.getElementById('task-ch-days');
    if(daysEl)daysEl.value=String(days);
    const startEl=document.getElementById('task-ch-start');
    if(startEl)startEl.value=t.start||(typeof todayYmd==='function'?todayYmd():'');
    const tgtEl=document.getElementById('task-ch-target');
    if(tgtEl)tgtEl.value=String(typeof parseChallengeTarget==='function'?parseChallengeTarget(t):days);
    if(typeof paintChallengeDays==='function')paintChallengeDays();
  }
  if(typeof syncTaskKindUi==='function')syncTaskKindUi();
  else if(typeof onHabitToggle==='function')onHabitToggle();
  document.getElementById('task-due').value=(habit||ch)?'':(t.due||'');
  const titleEl=document.querySelector('#m-task .modal-title');
  if(titleEl)titleEl.textContent='EDYTUJ ZADANIE';
  const saveBtn=document.querySelector('#m-task .modal-footer .btn-primary');
  if(saveBtn)saveBtn.textContent='Zapisz zmiany';
  window._editingTaskId=id;
}

async function saveTask(){
  if(window._saveGuard_saveTask)return;window._saveGuard_saveTask=true;setTimeout(()=>window._saveGuard_saveTask=false,1500);

  const title=document.getElementById('task-title').value.trim();if(!title){notify('Wpisz zadanie!');return;}
  const catEl=document.getElementById('task-cat');
  const isH=!!document.getElementById('task-habit')?.checked;
  const isC=!!document.getElementById('task-challenge')?.checked;
  const dueVal=(isH||isC)?'':(document.getElementById('task-due').value||'');
  const editingId=window._editingTaskId;
  const chFields=()=>{
    const start=(document.getElementById('task-ch-start')||{}).value||(typeof todayYmd==='function'?todayYmd():'');
    const days=typeof parseChallengeDays==='function'?parseChallengeDays((document.getElementById('task-ch-days')||{}).value):21;
    const target=typeof parseChallengeTarget==='function'?parseChallengeTarget({days,target:(document.getElementById('task-ch-target')||{}).value}):days;
    const end=typeof ymdAdd==='function'?ymdAdd(start,days-1):'';
    return{start,days,target,due:end||dueVal};
  };
  const stripCh=obj=>{
    delete obj.start;delete obj.days;delete obj.target;
    return obj;
  };
  if(editingId){
    const idx=TASKS.findIndex(x=>x.id===editingId);
    if(idx>=0){
      const next={...TASKS[idx],title,clientId:document.getElementById('task-client').value,due:dueVal,priority:document.getElementById('task-priority').value,cat:catEl?catEl.value:TASKS[idx].cat,kind:isC?'challenge':isH?'habit':'task',updatedAt:new Date().toISOString()};
      if(isC){
        const f=chFields();
        next.status='open';
        next.start=f.start;
        next.days=f.days;
        next.target=f.target;
        next.due=f.due;
        next.doneDates=Array.isArray(TASKS[idx].doneDates)?TASKS[idx].doneDates:[];
        delete next.repeat;
      }else if(isH){
        next.status='open';
        next.repeat='daily';
        next.doneDates=Array.isArray(TASKS[idx].doneDates)?TASKS[idx].doneDates:[];
        stripCh(next);
      }else{
        delete next.repeat;
        delete next.doneDates;
        stripCh(next);
      }
      TASKS[idx]=next;
      window._editingTaskId=null;
      closeM('m-task');renderTasks();
      if(cpClientId&&cpClientId===TASKS[idx].clientId){try{setCPTab(cpTab);}catch(e){}}
      notify(isC?'Wyzwanie zaktualizowane!':isH?'Nawyk zaktualizowany!':'Zadanie zaktualizowane!');
      await persistById('tasks',TASKS[idx]);
      return;
    }
  }
  const t=withTrainer({id:newId('t'),title,clientId:document.getElementById('task-client').value,due:dueVal,priority:document.getElementById('task-priority').value,cat:catEl?catEl.value:'trening',desc:'',status:'open',kind:isC?'challenge':isH?'habit':'task',createdAt:new Date().toISOString()});
  if(isC){
    const f=chFields();
    t.start=f.start;t.days=f.days;t.target=f.target;t.due=f.due;t.doneDates=[];
  }else if(isH){t.repeat='daily';t.doneDates=[];}
  TASKS.push(t);closeM('m-task');renderTasks();
  if(cpClientId&&cpClientId===t.clientId){try{setCPTab(cpTab);}catch(e){}}
  notify(isC?'Wyzwanie dodane — klient odhacza w terminie 🏆':isH?'Nawyk dodany — klient odhacza codziennie 🔥':'Zadanie dodane!');
  await persistById('tasks',t);
}

function openTaskTemplates(){
  const sel=document.getElementById('tmpl-client-sel');
  if(sel)sel.innerHTML=CL.length?CL.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join(''):'<option value="">Brak klientów — dodaj klienta</option>';
  const body=document.getElementById('task-templates-body');
    if(body)body.innerHTML=TASK_TEMPLATES.map(tmpl=>`<div class="tmpl-card"><div class="tmpl-card-hdr"><div><span style="font-size:18px;margin-right:6px;">${tmpl.icon}</span><span style="font-size:13px;font-weight:700;">${tmpl.name}</span></div><button class="btn btn-primary btn-sm" onclick="applyTemplate('${tmpl.id}')">Przypisz</button></div><div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${tmpl.desc}</div><div class="tmpl-tasks">${tmpl.tasks.map(t=>`<div class="tmpl-task-item"><span style="color:${TASK_CAT_COLORS[t.cat]||'var(--muted)'};flex-shrink:0;">•</span><span>${t.title}</span><span style="margin-left:auto;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);white-space:nowrap;flex-shrink:0;padding-left:6px;">${t.kind==='challenge'?(t.days||21)+'d ★':t.kind==='habit'?'codziennie':(t.days||0)+'d'}</span></div>`).join('')}</div></div>`).join('');
  document.getElementById('task-templates-panel').style.transform='translateX(0)';
}
function closeTaskTemplates(){document.getElementById('task-templates-panel').style.transform='translateX(100%)';}

async function applyTemplate(tmplId){
  const tmpl=TASK_TEMPLATES.find(t=>t.id===tmplId);if(!tmpl)return;
  const cid=document.getElementById('tmpl-client-sel').value;if(!cid){notify('Wybierz klienta!');return;}
  const today=new Date();let added=0;
  for(const t of tmpl.tasks){
    const isC=t.kind==='challenge';
    const isH=!isC&&(t.kind==='habit'||t.repeat==='daily');
    const due=new Date(today);due.setDate(due.getDate()+(t.days||7));
    const start=typeof todayYmd==='function'?todayYmd():due.toISOString().split('T')[0];
    const chDays=typeof parseChallengeDays==='function'?parseChallengeDays(t.days||21):21;
    const task=withTrainer({id:newId('t'),title:t.title,clientId:cid,due:isC?(typeof ymdAdd==='function'?ymdAdd(start,chDays-1):due.toISOString().split('T')[0]):isH?'':due.toISOString().split('T')[0],priority:t.priority,cat:t.cat,desc:'',status:'open',kind:isC?'challenge':isH?'habit':'task',createdAt:new Date().toISOString()});
    if(isC){
      task.start=start;
      task.days=chDays;
      task.target=typeof parseChallengeTarget==='function'?parseChallengeTarget({days:chDays,target:t.target}):chDays;
      task.doneDates=[];
    }else if(isH){task.repeat='daily';task.doneDates=[];}
    await persistById('tasks',task);
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
  msgs.innerHTML+='<div style="text-align:right;margin-bottom:6px;"><div style="display:inline-block;background:var(--accent);color:#fff;padding:5px 9px;border-radius:8px;font-size:11px;">'+q+'</div></div>';
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
      const aiHtml=tasks.map(t=>`<div style="background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;margin-bottom:4px;font-size:11px;"><div style="font-weight:600;margin-bottom:4px;">${t.title}</div><div style="display:flex;gap:5px;align-items:center;"><span class="pill" style="background:${TASK_CAT_COLORS[t.cat]||'var(--muted)'}22;color:${TASK_CAT_COLORS[t.cat]||'var(--muted)'};font-size:9px;">${t.cat||''}</span><span style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">${t.days||7}d</span><button onclick="addAITask(${JSON.stringify(t).replace(/"/g,"&quot;")})" style="margin-left:auto;background:var(--accent);color:#fff;border:none;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;cursor:pointer;">+ Dodaj</button></div></div>`).join('');
      document.getElementById('tai-t').outerHTML=`<div style="margin-bottom:6px;">${aiHtml}</div>`;
    }else{document.getElementById('tai-t').outerHTML=`<div style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);padding:5px 9px;border-radius:8px;font-size:11px;">${raw.substring(0,150)}</div></div>`;}
  }catch(e){document.getElementById('tai-t').outerHTML=`<div style="margin-bottom:6px;"><div style="display:inline-block;background:var(--s3);padding:5px 9px;border-radius:8px;font-size:11px;color:var(--red);">Błąd połączenia</div></div>`;}
  msgs.scrollTop=msgs.scrollHeight;
}

async function addAITask(t){
  if(typeof t==='string')try{t=JSON.parse(t);}catch(e){return;}
  const clientFil=(document.getElementById('task-client-filter')||{}).value||'';
  const due=new Date();due.setDate(due.getDate()+(t.days||7));
  const task=withTrainer({id:newId('t'),title:t.title,clientId:clientFil,due:due.toISOString().split('T')[0],priority:t.priority||'medium',cat:t.cat||'trening',desc:'',status:'open',createdAt:new Date().toISOString()});
  await persistById('tasks',task);
  TASKS.push(task);renderTasks();notify('Zadanie AI dodane ✓');
}

function applyHabitChip(title,cat){
  const titleEl=document.getElementById('task-title');
  if(titleEl)titleEl.value=title||'';
  const catEl=document.getElementById('task-cat');
  if(catEl&&cat)catEl.value=cat;
  const hb=document.getElementById('task-habit');
  if(hb)hb.checked=true;
  const chb=document.getElementById('task-challenge');
  if(chb)chb.checked=false;
  if(typeof syncTaskKindUi==='function')syncTaskKindUi();
  else if(typeof onHabitToggle==='function')onHabitToggle();
}

function applyChallengeChip(title,cat,days){
  const titleEl=document.getElementById('task-title');
  if(titleEl)titleEl.value=title||'';
  const catEl=document.getElementById('task-cat');
  if(catEl&&cat)catEl.value=cat;
  const hb=document.getElementById('task-habit');
  if(hb)hb.checked=false;
  const chb=document.getElementById('task-challenge');
  if(chb)chb.checked=true;
  if(typeof setChallengeDays==='function')setChallengeDays(days||21);
  const startEl=document.getElementById('task-ch-start');
  if(startEl&&!startEl.value&&typeof todayYmd==='function')startEl.value=todayYmd();
  if(typeof syncTaskKindUi==='function')syncTaskKindUi();
}

function toggleTask(id){
  const t=TASKS.find(x=>x.id===id);if(!t)return;
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().split('T')[0];
  if(isHabit(t)){
    toggleHabitDay(t,today);
    persistById('tasks',t);
    renderTasks();
    try{if(typeof renderDashHabitFollowup==='function')renderDashHabitFollowup();}catch(e){}
    return;
  }
  if(typeof isChallenge==='function'&&isChallenge(t)){
    if(typeof challengeCanCheck==='function'&&!challengeCanCheck(t,today,today)){
      const p=typeof challengeProgress==='function'?challengeProgress(t,today):null;
      if(typeof notify==='function')notify(p&&p.before?'Wyzwanie jeszcze się nie zaczęło':p&&p.won?'Wyzwanie już ukończone':'Wyzwanie już się skończyło');
      return;
    }
    toggleChallengeDay(t,today,today);
    persistById('tasks',t);
    renderTasks();
    try{if(typeof renderDashHabitFollowup==='function')renderDashHabitFollowup();}catch(e){}
    return;
  }
  t.status=t.status==='done'?'open':'done';
  if(t.status==='done')t.doneAt=today;
  persistById('tasks',t);
  renderTasks();
}
async function delTask(id){
  window.TASKS=TASKS.filter(t=>t.id!==id);
  renderTasks();
  if(window._db){try{await window._del(window._doc(window._db,'tasks',id));}catch(e){console.warn('Firebase delTask:',e);}}
}

// ════════════════════════════════════════
// IMPORT BIBLIOTEKI GIF (technika ćwiczeń)
// ════════════════════════════════════════
let _exGifImportRows=[];
let _exGifImportMode='files';

function resolveExerciseName(input){
  const raw=String(input||'').trim();
  if(!raw)return '';
  const all=typeof allExercises==='function'?allExercises():[];
  const key=typeof exerciseMediaKey==='function'?exerciseMediaKey(raw):raw.toLowerCase();
  let hit=all.find(e=>(typeof exerciseMediaKey==='function'?exerciseMediaKey(e.name):e.name.toLowerCase())===key);
  if(hit)return hit.name;
  const slug=typeof exerciseSlug==='function'?exerciseSlug(raw):'';
  if(slug)hit=all.find(e=>typeof exerciseSlug==='function'&&exerciseSlug(e.name)===slug);
  if(hit)return hit.name;
  const partial=all.filter(e=>{
    const k=typeof exerciseMediaKey==='function'?exerciseMediaKey(e.name):'';
    return k&&(k.includes(key)||key.includes(k));
  });
  if(partial.length===1)return partial[0].name;
  return raw;
}

function parseExGifBulkPaste(text){
  const t=String(text||'').trim();
  if(!t)return [];
  if(t.startsWith('[')||t.startsWith('{')){
    try{
      const j=JSON.parse(t);
      const arr=Array.isArray(j)?j:(typeof j==='object'?Object.entries(j).map(([name,url])=>({name,url})) :[]);
      return arr.map(o=>{
        const url=String(o.url||o.gif||o.link||o.href||'').trim();
        const name=String(o.name||o.exercise||o.exerciseName||'').trim();
        const exerciseName=resolveExerciseName(name||matchGifFileToExercise(url.split('/').pop()||''));
        return{presetUrl:url,label:name||url.split('/').pop()||url,exerciseName,selected:!!(exerciseName&&url),status:'',url:''};
      }).filter(r=>r.presetUrl);
    }catch(e){/* fall through to lines */}
  }
  const lines=t.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  const rows=[];
  lines.forEach(line=>{
    let name='';let url='';
    if(line.includes('\t')){const p=line.split('\t');name=(p[0]||'').trim();url=(p[1]||'').trim();}
    else if(/\s\|\s/.test(line)){const p=line.split(/\s\|\s/);name=(p[0]||'').trim();url=(p[1]||'').trim();}
    else if(line.includes(';')){const p=line.split(';');name=(p[0]||'').trim();url=(p.slice(1).join(';')||'').trim();}
    else{
      const um=line.match(/^(.*?)\s+(https?:\/\/\S+)\s*$/i);
      if(um){name=um[1].trim();url=um[2].trim();}
      else{
        const cm=line.match(/^(.*),\s*(https?:\/\/\S+)\s*$/i);
        if(cm){name=cm[1].trim();url=cm[2].trim();}
        else if(/^https?:\/\//i.test(line))url=line;
        else name=line;
      }
    }
    if(!url&&name&&/^https?:\/\//i.test(name)){url=name;name='';}
    if(!url)return;
    const exerciseName=resolveExerciseName(name||matchGifFileToExercise(url.split('/').pop()||''));
    rows.push({presetUrl:url,label:name||url.split('/').pop()||url,exerciseName,selected:!!(exerciseName&&url),status:'',url:''});
  });
  return rows;
}

async function persistExerciseGifUrl(exerciseName,gifUrl){
  const url=String(gifUrl||'').trim();
  if(!url||!exerciseName)return false;
  if(typeof isSafeMediaUrl==='function'&&!isSafeMediaUrl(url))return false;
  const key=typeof exerciseMediaKey==='function'?exerciseMediaKey(exerciseName):exerciseName.toLowerCase();
  const slug=typeof exerciseSlug==='function'?exerciseSlug(exerciseName):exerciseName.toLowerCase();
  window.EX_GIF_REMOTE=window.EX_GIF_REMOTE||{};
  window.EX_GIF_REMOTE[key]=url;
  if(window._db&&window._setDoc&&window._doc&&window._uid){
    await window._setDoc(window._doc(window._db,'exerciseGifs',slug),{
      exerciseName,
      gifUrl:url,
      trainerId:window._uid,
      updatedAt:new Date().toISOString()
    },{merge:true});
  }
  return true;
}
window.persistExerciseGifUrl=persistExerciseGifUrl;

function matchGifFileToExercise(filename){
  const base=String(filename||'').replace(/\.(gif|webp|mp4|webm)$/i,'').trim();
  if(!base)return '';
  const fileSlug=base.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
  const all=typeof allExercises==='function'?allExercises():[];
  let hit=all.find(e=>typeof exerciseSlug==='function'&&exerciseSlug(e.name)===fileSlug);
  if(hit)return hit.name;
  const norm=base.toLowerCase().replace(/[-_]+/g,' ').trim();
  hit=all.find(e=>typeof exerciseMediaKey==='function'&&exerciseMediaKey(e.name)===norm);
  if(hit)return hit.name;
  const partial=all.filter(e=>{
    const s=typeof exerciseSlug==='function'?exerciseSlug(e.name):'';
    return s&&(s.includes(fileSlug)||fileSlug.includes(s));
  });
  if(partial.length===1)return partial[0].name;
  return '';
}

function buildExGifImportRows(files){
  return (files||[]).filter(f=>/\.(gif|webp|mp4|webm)$/i.test(f.name||'')).map(file=>{
    const exerciseName=matchGifFileToExercise(file.name);
    return{file,exerciseName,selected:!!exerciseName,status:'',url:''};
  }).sort((a,b)=>(b.selected?1:0)-(a.selected?1:0)||a.file.name.localeCompare(b.file.name,'pl'));
}

function renderExGifImportPreview(){
  const el=document.getElementById('exgif-preview');
  const cnt=document.getElementById('exgif-match-count');
  if(!el)return;
  const matched=_exGifImportRows.filter(r=>r.selected&&r.exerciseName).length;
  if(cnt)cnt.textContent=matched+' / '+_exGifImportRows.length+' dopasowanych';
  if(!_exGifImportRows.length){
    const msg=_exGifImportMode==='paste'
      ?'Wklej listę ćwiczeń z linkami (jedna linia = jedno ćwiczenie) i kliknij „Parsuj listę”'
      :'Wybierz pliki GIF / WEBP / MP4 z biblioteki';
    el.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px;">'+msg+'</div>';
    return;
  }
  el.innerHTML=_exGifImportRows.map((r,i)=>{
    const all=typeof allExercises==='function'?allExercises():[];
    const opts=all.map(e=>`<option value="${typeof escHtml==='function'?escHtml(e.name):e.name}" ${r.exerciseName===e.name?'selected':''}>${typeof escHtml==='function'?escHtml(e.name):e.name}</option>`).join('');
    const st=r.status==='done'?'✓':r.status==='err'?'✗':r.status==='upload'?'…':'';
    const label=r.file?(r.file.name):(r.label||r.presetUrl||'');
    const short=String(label).length>56?String(label).slice(0,53)+'…':label;
    return `<div class="exgif-row" data-i="${i}">
      <label class="exgif-row-check"><input type="checkbox" ${r.selected?'checked':''} onchange="toggleExGifImportRow(${i},this.checked)"></label>
      <div class="exgif-row-file" title="${typeof escHtml==='function'?escHtml(String(label)):String(label)}">${typeof escHtml==='function'?escHtml(short):short}</div>
      <select class="form-select exgif-row-select" onchange="setExGifImportExercise(${i},this.value)">
        <option value="">— wybierz ćwiczenie —</option>${opts}
      </select>
      <span class="exgif-row-status">${st}</span>
    </div>`;
  }).join('');
}

function onExGifFilesPicked(input){
  _exGifImportMode='files';
  if(typeof setExGifImportTab==='function')setExGifImportTab('files',true);
  const files=input&&input.files?[...input.files]:[];
  _exGifImportRows=buildExGifImportRows(files);
  renderExGifImportPreview();
  syncExGifImportBtnLabel();
}

function onExGifBulkPastePreview(){
  _exGifImportMode='paste';
  const ta=document.getElementById('exgif-paste');
  _exGifImportRows=parseExGifBulkPaste(ta?ta.value:'');
  renderExGifImportPreview();
  syncExGifImportBtnLabel();
  if(_exGifImportRows.length&&typeof notify==='function')notify('Sparsowano '+_exGifImportRows.length+' pozycji — sprawdź dopasowanie');
}

function setExGifImportTab(mode,silent){
  _exGifImportMode=mode==='paste'?'paste':'files';
  const pf=document.getElementById('exgif-panel-files');
  const pp=document.getElementById('exgif-panel-paste');
  const bf=document.getElementById('exgif-tab-files');
  const bp=document.getElementById('exgif-tab-paste');
  if(pf)pf.style.display=_exGifImportMode==='files'?'block':'none';
  if(pp)pp.style.display=_exGifImportMode==='paste'?'block':'none';
  if(bf)bf.className='btn btn-sm '+(_exGifImportMode==='files'?'btn-primary':'btn-ghost');
  if(bp)bp.className='btn btn-sm '+(_exGifImportMode==='paste'?'btn-primary':'btn-ghost');
  if(!silent){
    _exGifImportRows=[];
    renderExGifImportPreview();
  }
  syncExGifImportBtnLabel();
}

function syncExGifImportBtnLabel(){
  const btn=document.getElementById('exgif-import-btn');
  if(!btn)return;
  const urlOnly=_exGifImportRows.length>0&&_exGifImportRows.every(r=>!r.file&&!!r.presetUrl);
  if(_exGifImportMode==='paste'||urlOnly)btn.textContent='Zapisz masowo ('+(_exGifImportRows.filter(r=>r.selected).length||'…')+')';
  else btn.textContent='Wgraj pliki ('+(_exGifImportRows.filter(r=>r.selected).length||'…')+')';
}

function toggleExGifImportRow(i,on){
  if(_exGifImportRows[i])_exGifImportRows[i].selected=!!on;
  renderExGifImportPreview();
  syncExGifImportBtnLabel();
}

function setExGifImportExercise(i,name){
  if(!_exGifImportRows[i])return;
  _exGifImportRows[i].exerciseName=name||'';
  _exGifImportRows[i].selected=!!name;
  renderExGifImportPreview();
  syncExGifImportBtnLabel();
}

function openExGifImport(){
  _exGifImportRows=[];
  _exGifImportMode='paste';
  const inp=document.getElementById('exgif-files');
  if(inp)inp.value='';
  const ta=document.getElementById('exgif-paste');
  if(ta)ta.value='';
  setExGifImportTab('paste',true);
  renderExGifImportPreview();
  syncExGifImportBtnLabel();
  const bar=document.getElementById('exgif-progress');
  if(bar){bar.style.width='0%';bar.parentElement.style.display='none';}
  openM('m-ex-gif-import');
}

async function runExGifImport(){
  const rows=_exGifImportRows.filter(r=>r.selected&&r.exerciseName);
  if(!rows.length){notify('Zaznacz wiersze i przypisz ćwiczenia');return;}
  if(!window._uid){notify('Zaloguj się, aby zapisać bibliotekę GIF');return;}
  const fileRows=rows.filter(r=>r.file&&!r.presetUrl);
  if(fileRows.length&&(!window._storage||!window._storageRef||!window._uploadBytes||!window._getDownloadURL)){
    notify('Firebase Storage niedostępny do plików — użyj zakładki „Wklej listę” z URL-ami lub folderu assets/ex/gifs/');
    if(!rows.some(r=>r.presetUrl))return;
  }
  const btn=document.getElementById('exgif-import-btn');
  if(btn){btn.disabled=true;btn.textContent='Zapisywanie…';}
  const progWrap=document.getElementById('exgif-progress-wrap');
  const prog=document.getElementById('exgif-progress');
  if(progWrap)progWrap.style.display='block';
  window.EX_GIF_REMOTE=window.EX_GIF_REMOTE||{};
  let ok=0;
  const total=rows.length;
  let step=0;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    row.status='upload';
    renderExGifImportPreview();
    try{
      if(row.presetUrl){
        const saved=await persistExerciseGifUrl(row.exerciseName,row.presetUrl);
        if(saved){row.url=row.presetUrl;row.status='done';ok++;}
        else row.status='err';
      }else if(row.file){
        const slug=typeof exerciseSlug==='function'?exerciseSlug(row.exerciseName):String(row.exerciseName).toLowerCase();
        const ext=(row.file.name.match(/\.(gif|webp|mp4|webm)$/i)||['','gif'])[1].toLowerCase();
        const path='exercise-gifs/'+window._uid+'/'+slug+'.'+ext;
        const ref=window._storageRef(window._storage,path);
        await window._uploadBytes(ref,row.file,{contentType:row.file.type||'image/gif'});
        const url=await window._getDownloadURL(ref);
        row.url=url;
        await persistExerciseGifUrl(row.exerciseName,url);
        row.status='done';
        ok++;
      }else if(row.url){
        await persistExerciseGifUrl(row.exerciseName,row.url);
        row.status='done';
        ok++;
      }else row.status='err';
    }catch(e){
      console.warn('GIF import',row.label||row.file&&row.file.name,e);
      row.status='err';
    }
    step++;
    if(prog)prog.style.width=Math.round((step/total)*100)+'%';
    renderExGifImportPreview();
  }
  if(btn){btn.disabled=false;syncExGifImportBtnLabel();}
  if(typeof renderLib==='function')renderLib();
  notify('✓ Zapisano '+ok+' / '+total+' animacji techniki');
  if(ok===total)closeM('m-ex-gif-import');
}

window.openExGifImport=openExGifImport;
window.onExGifFilesPicked=onExGifFilesPicked;
window.onExGifBulkPastePreview=onExGifBulkPastePreview;
window.setExGifImportTab=setExGifImportTab;
window.runExGifImport=runExGifImport;
window.parseExGifBulkPaste=parseExGifBulkPaste;
window.toggleExGifImportRow=toggleExGifImportRow;
window.setExGifImportExercise=setExGifImportExercise;

function countExercisesWithGif(){
  const all=typeof allExercises==='function'?allExercises():[];
  return all.filter(e=>typeof exGifUrl==='function'&&!!exGifUrl(e)).length;
}
window.countExercisesWithGif=countExercisesWithGif;
