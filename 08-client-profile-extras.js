// ════════════════════════════════════════
// OŚ CZASU KLIENTA — notatki + auto: sesje/plany/pomiary
// ════════════════════════════════════════
window.CLIENT_TIMELINE = window.CLIENT_TIMELINE || {}; // clientId -> [{id,text,type,date}]

const CTL_ICONS  = {trening:'🏋️',pomiar:'📏',plan:'📋',notatka:'📝',cel:'🎯',sukces:'🏆'};
const CTL_COLORS = {trening:'#E8302A',pomiar:'var(--blue)',plan:'var(--blue)',notatka:'var(--orange)',cel:'var(--accent)',sukces:'#FFD700'};

function safeEscSnippet(text,max){
  return escHtml(String(text||'').slice(0,Math.max(0,max||0)));
}
window.safeEscSnippet=safeEscSnippet;

function renderCPTimeline(c){
  if(!c) return;
  if(!CLIENT_TIMELINE[c.id]) CLIENT_TIMELINE[c.id] = c.timeline || [];

  document.getElementById('cp-body').innerHTML = `
    <div class="cp-section-title">DODAJ WPIS</div>
    <div style="display:flex;gap:6px;margin-bottom:16px;">
      <select id="ctl-new-type" style="background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:7px 8px;color:var(--text);font-size:12px;">
        <option value="notatka">📝 Notatka</option>
        <option value="cel">🎯 Cel</option>
        <option value="sukces">🏆 Sukces</option>
      </select>
      <input type="text" id="ctl-new-text" placeholder="Dodaj wpis do osi czasu..." style="flex:1;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:7px 9px;color:var(--text);font-size:12px;" onkeydown="if(event.key==='Enter')ctlAddEntry('${c.id}')">
      <button class="btn btn-primary btn-sm" onclick="ctlAddEntry('${c.id}')">Dodaj</button>
    </div>
    <div class="cp-section-title">OŚ CZASU</div>
    <div id="cp-timeline-list"></div>`;

  renderCPTimelineList(c);
}

function renderCPTimelineList(c){
  const manual = CLIENT_TIMELINE[c.id] || [];

  const autoSess = SE.filter(s=>s.clientId===c.id).map(s=>({
    id:'auto_sess_'+s.id, type:'trening',
    text:(s.type||'Trening')+(s.exercises?' — '+s.exercises.length+' ćwiczeń':'')+(s.volume?' · '+s.volume+' kg obj.':''),
    date:s.date+'T'+(s.time||'12:00')+':00'
  }));

  const autoPlans = PL.filter(p=>p.clientId===c.id).map(p=>({
    id:'auto_plan_'+p.id, type:'plan', text:'Przypisano plan: '+p.name,
    date:(p.createdAt||new Date().toISOString())
  }));

  const autoMeas = (window.METRIC_ENTRIES||[]).filter(e=>e.clientId===c.id).map(m=>{
    const g = allMetricGroups().find(gr=>gr.id===m.groupId);
    const parts = g ? g.metrics.filter(mm=>m.values[mm.id]!=null).map(mm=>mm.name+': '+m.values[mm.id]+(mm.unit?' '+mm.unit:'')).slice(0,3).join(' · ') : '';
    return {id:'auto_meas_'+m.id, type:'pomiar', text:(g?g.icon+' '+g.name+' — ':'')+parts, date:m.date+'T10:00:00'};
  });

  const all = [...manual, ...autoSess, ...autoPlans, ...autoMeas].sort((a,b)=>new Date(b.date)-new Date(a.date));

  const el = document.getElementById('cp-timeline-list');
  if(!el) return;
  if(!all.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px;">Brak wpisów. Dodaj notatkę lub wykonaj sesję/pomiar.</div>'; return;}

  el.innerHTML = all.slice(0,60).map(e=>{
    const isAuto = e.id.toString().startsWith('auto_');
    const col = CTL_COLORS[e.type] || 'var(--muted)';
    const dayStr = new Date(e.date).toLocaleDateString('pl',{day:'numeric',month:'short',year:'numeric'});
    return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start;">
      <div style="width:22px;height:22px;border-radius:50%;background:${col}22;border:1px solid ${col}44;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px;">${CTL_ICONS[e.type]||'📝'}</div>
      <div style="flex:1;">
        <div style="font-size:12px;color:var(--text);line-height:1.4;">${e.text}</div>
        <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;">${dayStr}</div>
      </div>
      ${!isAuto?`<button onclick="ctlDeleteEntry('${c.id}','${e.id}')" style="background:none;border:none;color:var(--muted2);font-size:14px;cursor:pointer;padding:0 2px;">×</button>`:''}
    </div>`;
  }).join('');
}

function ctlAddEntry(clientId){
  const text = document.getElementById('ctl-new-text')?.value?.trim();
  const type = document.getElementById('ctl-new-type')?.value || 'notatka';
  if(!text) return;
  if(!CLIENT_TIMELINE[clientId]) CLIENT_TIMELINE[clientId]=[];
  CLIENT_TIMELINE[clientId].unshift({id:newId('ct'), text, type, date:new Date().toISOString()});
  const c = CL.find(x=>x.id===clientId);
  if(c){c.timeline=CLIENT_TIMELINE[clientId];persistById('clients',c);}
  renderCPTimeline(c);
}

function ctlDeleteEntry(clientId, id){
  CLIENT_TIMELINE[clientId] = (CLIENT_TIMELINE[clientId]||[]).filter(e=>e.id!==id);
  const c = CL.find(x=>x.id===clientId);
  if(c){c.timeline=CLIENT_TIMELINE[clientId];persistById('clients',c);}
  renderCPTimeline(c);
}

window.renderCPTimeline=renderCPTimeline; window.ctlAddEntry=ctlAddEntry; window.ctlDeleteEntry=ctlDeleteEntry;

// ════════════════════════════════════════
// PSYCHO — profil psychodietetyczny klienta
// ════════════════════════════════════════
window.CLIENT_PSYCHO = window.CLIENT_PSYCHO || {}; // clientId -> {habits,diagnosis,psychology,daily:[]}

const PSY_HABIT_LABELS = {binge:'Napady objadania się',snacking:'Niekontrolowane podjadanie',yoyo:'Błędne koło yo-yo',emotional:'Jedzenie emocjonalne',restriction:'Nadmierne restrykcje',social:'Trudności w sytuacjach społecznych'};
const PSY_DIAG_LABELS  = {io:'Insulinooporność',diabetes:'Cukrzyca (t.1 lub t.2)',ibs:'Jelito drażliwe (IBS)',hashimoto:'Hashimoto / niedoczynność',pcos:'PCOS',gluten:'Nietolerancja glutenu/celiakia',lactose:'Nietolerancja laktozy'};
const PSY_BARRIERS = ['Brak czasu','Brak motywacji','Perfekcjonizm (wszystko albo nic)','Strach przed porażką','Porównywanie się z innymi','Trauma związana z odchudzaniem','Problemy emocjonalne z jedzeniem','Presja społeczna'];

function psyGet(clientId){
  if(!CLIENT_PSYCHO[clientId]){
    const c = CL.find(x=>x.id===clientId);
    CLIENT_PSYCHO[clientId] = (c && c.psycho) ? c.psycho : {habits:{},diagnosis:{},psychology:{},daily:[]};
  }
  return CLIENT_PSYCHO[clientId];
}

function psyPersist(clientId){
  const c=CL.find(x=>x.id===clientId);
  if(c){c.psycho=CLIENT_PSYCHO[clientId];persistById('clients',c);}
}

function renderCPPsycho(c){
  if(!c) return;
  const p = psyGet(c.id);
  const todayMood = (p.daily||[]).find(d=>d.date===new Date().toISOString().split('T')[0]);

  const _psyHtml = `
    <div style="background:linear-gradient(135deg,rgba(157,124,244,0.1),rgba(232,48,42,0.06));border:1px solid rgba(157,124,244,0.2);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--purple);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">😊 Dzienny tracker nastroju</div>
      <div style="display:flex;gap:6px;justify-content:space-between;margin-bottom:10px;" id="psy-mood-btns">
        ${[[1,'😞','Bardzo zły'],[2,'😕','Zły'],[3,'😐','Neutralny'],[4,'😊','Dobry'],[5,'🤩','Świetny']].map(([v,e,t])=>
          `<button onclick="psySetMood('${c.id}',${v},this)" class="psy-mood-btn" data-v="${v}" title="${t}" style="flex:1;font-size:20px;background:${(todayMood?.mood===v)?'rgba(157,124,244,0.25)':'var(--s3)'};border:1px solid ${(todayMood?.mood===v)?'rgba(157,124,244,0.5)':'var(--border2)'};border-radius:8px;padding:8px 2px;cursor:pointer;">${e}</button>`
        ).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Poziom energii</div>
          <input type="range" id="psy-energy" min="1" max="10" value="${todayMood?.energy||5}" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('psy-energy-val').textContent=this.value">
          <div style="font-size:10px;color:var(--purple);text-align:right;" id="psy-energy-val">${todayMood?.energy||5}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Poziom stresu</div>
          <input type="range" id="psy-stress" min="1" max="10" value="${todayMood?.stress||5}" style="width:100%;accent-color:var(--red);" oninput="document.getElementById('psy-stress-val').textContent=this.value">
          <div style="font-size:10px;color:var(--red);text-align:right;" id="psy-stress-val">${todayMood?.stress||5}</div>
        </div>
      </div>
      <div style="margin-top:10px;">
        <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Jakość snu (godz.)</div>
        <div style="display:flex;gap:6px;">
          <input id="psy-sleep" type="number" min="0" max="12" step="0.5" value="${todayMood?.sleep||''}" placeholder="7.5" style="flex:1;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 9px;color:var(--text);font-size:12px;">
          <button onclick="psySaveDaily('${c.id}')" id="psy-daily-btn" style="background:rgba(157,124,244,0.2);border:1px solid rgba(157,124,244,0.4);border-radius:6px;padding:6px 12px;color:var(--purple);font-size:11px;font-weight:600;cursor:pointer;">💾 Zapisz</button>
        </div>
      </div>
    </div>

    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📈 Nastrój — ostatnie 7 dni</div>
      <div id="psy-mood-history" style="display:flex;gap:4px;align-items:flex-end;height:56px;"></div>
    </div>

    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🍽️ Nawyki żywieniowe klienta</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${Object.entries(PSY_HABIT_LABELS).map(([k,label])=>
          `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);">
            <input type="checkbox" id="psy-h-${k}" ${p.habits?.[k]?'checked':''} style="accent-color:var(--red);"> ${label}
          </label>`
        ).join('')}
      </div>
    </div>

    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🏥 Diagnoza / kondycja zdrowotna</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${Object.entries(PSY_DIAG_LABELS).map(([k,label])=>
          `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);">
            <input type="checkbox" id="psy-d-${k}" ${p.diagnosis?.[k]?'checked':''} style="accent-color:var(--accent);"> ${label}
          </label>`
        ).join('')}
      </div>
      <textarea id="psy-diag-notes" placeholder="Inne diagnozy, leki, uwagi..." style="width:100%;margin-top:10px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:8px 9px;color:var(--text);font-size:12px;resize:none;height:54px;">${p.diagnosis?.notes||''}</textarea>
    </div>

    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">💭 Relacja z ciałem i ćwiczeniami</div>
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Motywacja do ćwiczeń (1-10)</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="range" id="psy-motivation" min="1" max="10" value="${p.psychology?.motivation||7}" style="flex:1;accent-color:var(--accent);" oninput="document.getElementById('psy-mot-val').textContent=this.value">
          <span style="font-size:13px;font-weight:700;color:var(--accent);min-width:18px;" id="psy-mot-val">${p.psychology?.motivation||7}</span>
        </div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Zadowolenie z własnego ciała (1-10)</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="range" id="psy-body-sat" min="1" max="10" value="${p.psychology?.bodySatisfaction||6}" style="flex:1;accent-color:var(--accent);" oninput="document.getElementById('psy-body-val').textContent=this.value">
          <span style="font-size:13px;font-weight:700;color:var(--accent);min-width:18px;" id="psy-body-val">${p.psychology?.bodySatisfaction||6}</span>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Główna bariera psychologiczna</div>
      <select id="psy-barrier" style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:7px 9px;color:var(--text);font-size:12px;">
        <option value="">– wybierz –</option>
        ${PSY_BARRIERS.map(b=>`<option ${p.psychology?.barrier===b?'selected':''}>${b}</option>`).join('')}
      </select>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      <button onclick="psySaveProfile('${c.id}')" id="psy-save-btn" style="width:100%;background:rgba(157,124,244,0.15);border:1px solid rgba(157,124,244,0.35);border-radius:8px;padding:10px;color:var(--purple);font-size:12px;font-weight:600;cursor:pointer;">💾 Zapisz profil psychodietetyczny</button>
      <button onclick="psyAskAI('${c.id}')" id="psy-ai-btn" style="width:100%;background:rgba(230,0,0,0.1);border:1px solid rgba(230,0,0,0.25);border-radius:8px;padding:10px;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;">🤖 Zapytaj AI o strategie</button>
      <button onclick="psyCheckYoyo('${c.id}')" style="width:100%;background:rgba(201,123,63,0.1);border:1px solid rgba(201,123,63,0.25);border-radius:8px;padding:10px;color:var(--orange);font-size:12px;font-weight:600;cursor:pointer;">🔄 Sprawdź błędne koło yo-yo</button>
      <div id="psy-yoyo-result"></div>
      <div id="psy-ai-result"></div>
    </div>`;
  document.getElementById('cp-body').innerHTML=(typeof withAnalyticsShell==='function'?withAnalyticsShell(_psyHtml):_psyHtml);

  psyRenderMoodHistory(c.id);
}

function psySetMood(clientId,val,btn){
  document.querySelectorAll('.psy-mood-btn').forEach(b=>{b.style.background='var(--s3)';b.style.borderColor='var(--border2)';});
  btn.style.background='rgba(157,124,244,0.25)';btn.style.borderColor='rgba(157,124,244,0.5)';
  btn.dataset.selected='1';
}

function psySaveDaily(clientId){
  const selBtn = document.querySelector('.psy-mood-btn[data-selected="1"]') || document.querySelector('.psy-mood-btn');
  const mood = parseInt(selBtn?.dataset.v || 3);
  const today = new Date().toISOString().split('T')[0];
  const p = psyGet(clientId);
  if(!p.daily) p.daily=[];
  const entry = {date:today, mood, energy:parseInt(document.getElementById('psy-energy')?.value||5), stress:parseInt(document.getElementById('psy-stress')?.value||5), sleep:parseFloat(document.getElementById('psy-sleep')?.value||7)};
  const idx = p.daily.findIndex(d=>d.date===today);
  if(idx>=0) p.daily[idx]=entry; else p.daily.push(entry);
  p.daily = p.daily.slice(-30);
  psyPersist(clientId);
  psyRenderMoodHistory(clientId);
  const btn=document.getElementById('psy-daily-btn');
  if(btn){btn.textContent='✓ Zapisano!';setTimeout(()=>btn.textContent='💾 Zapisz',2000);}
}

function psySaveProfile(clientId){
  const p = psyGet(clientId);
  p.habits = {};
  Object.keys(PSY_HABIT_LABELS).forEach(k=>{ p.habits[k] = !!document.getElementById('psy-h-'+k)?.checked; });
  p.diagnosis = {notes: document.getElementById('psy-diag-notes')?.value||''};
  Object.keys(PSY_DIAG_LABELS).forEach(k=>{ p.diagnosis[k] = !!document.getElementById('psy-d-'+k)?.checked; });
  p.psychology = {
    motivation: parseInt(document.getElementById('psy-motivation')?.value||7),
    bodySatisfaction: parseInt(document.getElementById('psy-body-sat')?.value||6),
    barrier: document.getElementById('psy-barrier')?.value||''
  };
  psyPersist(clientId);
  const btn=document.getElementById('psy-save-btn');
  if(btn){const old=btn.textContent;btn.textContent='✓ Profil zapisany!';btn.style.background='rgba(74,222,128,0.15)';setTimeout(()=>{btn.textContent=old;btn.style.background='rgba(157,124,244,0.15)';},2500);}
  notify('✓ Profil psychodietetyczny zapisany');
}

function psyRenderMoodHistory(clientId){
  const el = document.getElementById('psy-mood-history'); if(!el) return;
  const p = psyGet(clientId);
  const daily = (p.daily||[]).slice(-7);
  if(!daily.length){ el.innerHTML='<div style="font-size:11px;color:var(--muted);text-align:center;width:100%;">Brak danych – zacznij śledzić nastrój!</div>'; return; }
  const moodEmoji={1:'😞',2:'😕',3:'😐',4:'😊',5:'🤩'};
  const moodColor={1:'#ff4d4d',2:'#c97b3f',3:'#9a9086',4:'#4ade80',5:'#e60000'};
  el.innerHTML = daily.map(d=>{
    const height=Math.round((d.mood/5)*100);
    const dayName=new Date(d.date).toLocaleDateString('pl',{weekday:'short'}).substring(0,2);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="font-size:13px;">${moodEmoji[d.mood]||'😐'}</div>
      <div style="width:100%;height:${height}%;background:${moodColor[d.mood]||'var(--muted)'};border-radius:3px;min-height:4px;opacity:.8;"></div>
      <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">${dayName}</div>
    </div>`;
  }).join('');
}

async function psyAskAI(clientId){
  const p = psyGet(clientId);
  const c = CL.find(x=>x.id===clientId);
  const habits = Object.entries(p.habits||{}).filter(([,v])=>v).map(([k])=>PSY_HABIT_LABELS[k]).filter(Boolean);
  const diagnoses = Object.entries(p.diagnosis||{}).filter(([k,v])=>v&&k!=='notes').map(([k])=>PSY_DIAG_LABELS[k]).filter(Boolean);
  const barrier = p.psychology?.barrier||'';
  const motivation = p.psychology?.motivation||7;

  let prompt = `Jako psychodietetyk, zaproponuj strategie dla klienta${c?' '+c.name:''}:\n`;
  if(habits.length) prompt += `• Problemy: ${habits.join(', ')}\n`;
  if(diagnoses.length) prompt += `• Diagnozy: ${diagnoses.join(', ')}\n`;
  if(barrier) prompt += `• Bariera: ${barrier}\n`;
  prompt += `• Motywacja: ${motivation}/10\n`;
  prompt += '\nPodaj konkretne techniki behawioralne, strategie mindful eating i wskazówki dla trenera personalnego. Odpowiedz krótko po polsku (max 150 słów).';

  const resEl = document.getElementById('psy-ai-result');
  const btn = document.getElementById('psy-ai-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Analizuję...';}
  if(resEl) resEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:10px;">AI przygotowuje strategie...</div>';

  try{
    const r = await fetch(W,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:400,system:'Jesteś doświadczonym psychodietetykiem i trenerem personalnym. Odpowiadaj konkretnie, po polsku.',messages:[{role:'user',content:prompt}]})});
    const d = await r.json();
    const ans = (d.content||[]).map(i=>i.text||'').join('');
    if(resEl) resEl.innerHTML = `<div style="background:rgba(230,0,0,0.06);border:1px solid rgba(230,0,0,0.2);border-radius:8px;padding:12px;margin-top:4px;font-size:12px;color:var(--text);line-height:1.6;white-space:pre-wrap;">🤖 ${ans}</div>`;
  }catch(e){
    if(resEl) resEl.innerHTML = '<div style="color:var(--red);font-size:12px;padding:8px;">Błąd: '+e.message+'</div>';
  }
  if(btn){btn.disabled=false;btn.textContent='🤖 Zapytaj AI o strategie';}
}

function psyCheckYoyo(clientId){
  const resultEl = document.getElementById('psy-yoyo-result');
  const weights = (window.METRIC_ENTRIES||[]).filter(e=>e.clientId===clientId&&e.groupId==='mg1'&&e.values?.m1!=null)
    .map(e=>({date:e.date,w:parseFloat(e.values.m1)})).sort((a,b)=>a.date.localeCompare(b.date));

  if(weights.length<3){
    resultEl.innerHTML = `<div style="background:var(--s3);border-radius:8px;padding:10px;font-size:11px;color:var(--muted);margin-top:6px;">Potrzeba min. 3 pomiarów wagi, aby wykryć wzorzec yo-yo.</div>`;
    return;
  }

  let reversals=0;
  for(let i=1;i<weights.length-1;i++){
    const prev=weights[i-1].w,curr=weights[i].w,next=weights[i+1].w;
    if((curr>prev&&curr>next)||(curr<prev&&curr<next)) reversals++;
  }
  const first=weights[0].w, last=weights[weights.length-1].w;
  const maxW=Math.max(...weights.map(w=>w.w)), minW=Math.min(...weights.map(w=>w.w));
  const amplitude=(maxW-minW).toFixed(1);
  const isYoyo = reversals>=2 && parseFloat(amplitude)>=2;

  resultEl.innerHTML = isYoyo
    ? `<div style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.25);border-radius:8px;padding:12px;margin-top:6px;">
        <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px;">⚠️ Wykryto wzorzec yo-yo</div>
        <div style="font-size:11px;color:var(--text);line-height:1.6;">Amplituda: <strong>${amplitude}kg</strong> · ${reversals} zmiany kierunku<br>
        Zalecenie: zmień podejście z restrykcji na zrównoważony deficyt (max -300kcal). Zwiększ białko do 2.4g/kg. Praca nad psychologią jedzenia.</div>
      </div>`
    : `<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);border-radius:8px;padding:12px;margin-top:6px;">
        <div style="font-size:12px;font-weight:700;color:var(--teal);">✅ Brak wzorca yo-yo</div>
        <div style="font-size:11px;color:var(--text);margin-top:4px;">Waga zmienia się ${last>first?'rosnąco':'malejąco'} o ${Math.abs(last-first).toFixed(1)}kg. Amplituda: ${amplitude}kg.</div>
      </div>`;
}

window.renderCPPsycho=renderCPPsycho; window.psySetMood=psySetMood; window.psySaveDaily=psySaveDaily;
window.psySaveProfile=psySaveProfile; window.psyAskAI=psyAskAI; window.psyCheckYoyo=psyCheckYoyo;

// ════════════════════════════════════════
// SFR TRACKER — objętość tygodniowa i zmęczenie stawowe per partia
// ════════════════════════════════════════
window.CLIENT_SFR = window.CLIENT_SFR || {}; // clientId -> {weekKey: {muscle:{sets,fatigue}}}

const SFR_MUSCLES = ['Klatka','Plecy','Barki','Biceps','Triceps','Nogi','Pośladki','Core'];
const SFR_LIMITS = {
  'Klatka':{mev:10,mrv:20},'Plecy':{mev:10,mrv:22},'Barki':{mev:12,mrv:22},
  'Biceps':{mev:8,mrv:16},'Triceps':{mev:8,mrv:16},'Nogi':{mev:12,mrv:24},
  'Pośladki':{mev:6,mrv:16},'Core':{mev:8,mrv:16}
};

function sfrWeekKey(){
  const d=new Date();
  const year=d.getFullYear();
  const week=Math.ceil((d-new Date(year,0,1))/(7*24*3600*1000));
  return `${year}W${week}`;
}

function sfrGetWeekData(clientId){
  if(!CLIENT_SFR[clientId]){
    const c=CL.find(x=>x.id===clientId);
    CLIENT_SFR[clientId]=(c&&c.sfr)?c.sfr:{};
  }
  const wk=sfrWeekKey();
  if(!CLIENT_SFR[clientId][wk]) CLIENT_SFR[clientId][wk]={};
  const data=CLIENT_SFR[clientId][wk];
  SFR_MUSCLES.forEach(m=>{ if(!data[m]) data[m]={sets:0,fatigue:5}; });
  return data;
}

function sfrPersist(clientId){
  const c=CL.find(x=>x.id===clientId);
  if(c){c.sfr=CLIENT_SFR[clientId];persistById('clients',c);}
}

// Mnożnik MRV na podstawie ostatniego dziennego wpisu z modułu Psycho (stres/sen)
function sfrGetMultiplier(clientId){
  const psy=(typeof psyGet==='function')?psyGet(clientId):null;
  const last=(psy&&psy.daily&&psy.daily.length)?psy.daily[psy.daily.length-1]:null;
  if(!last) return {mult:1.0, source:'brak danych z Psycho — używam pełnego MRV'};
  const stress=last.stress||5, sleep=(last.sleep!=null)?last.sleep:7;
  if(stress>=7||sleep<6) return {mult:0.75, source:`wysoki stres (${stress}/10) lub mało snu (${sleep}h) — MRV obniżone o 25%`};
  if(stress>=5||sleep<7) return {mult:0.9, source:`umiarkowany stres/sen — MRV obniżone o 10%`};
  return {mult:1.0, source:`dobry stres/sen (${stress}/10, ${sleep}h) — pełne MRV`};
}

function renderCPSfr(c){
  if(!c) return;
  const _sfrHtml=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">TYDZIEŃ ${sfrWeekKey()}</div>
      <button onclick="sfrReset('${c.id}')" style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.2);border-radius:6px;padding:5px 10px;color:var(--red);font-size:10px;cursor:pointer;">↺ Reset tygodnia</button>
    </div>
    <div id="sfr-mult-info" style="font-size:10px;color:var(--muted);background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:12px;"></div>
    <div id="sfr-warning" style="display:none;background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.25);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--red);line-height:1.6;"></div>
    <div id="sfr-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>`;
  document.getElementById('cp-body').innerHTML=(typeof withAnalyticsShell==='function'?withAnalyticsShell(_sfrHtml):_sfrHtml);
  sfrRender(c.id);
}

function sfrRender(clientId){
  const grid=document.getElementById('sfr-grid');
  if(!grid) return;
  const data=sfrGetWeekData(clientId);
  const {mult,source}=sfrGetMultiplier(clientId);

  const infoEl=document.getElementById('sfr-mult-info');
  if(infoEl) infoEl.innerHTML=`🧠 <b>Mnożnik MRV z Psycho:</b> ×${mult} — ${source}`;

  grid.innerHTML=SFR_MUSCLES.map(m=>{
    const d=data[m]||{sets:0,fatigue:5};
    const lim=SFR_LIMITS[m];
    const adjMrv=Math.round(lim.mrv*mult);
    const pct=Math.min(100,Math.round(d.sets/adjMrv*100));
    const color=pct>=100?'var(--red)':pct>=75?'var(--orange)':'var(--teal)';
    const fatigueEmoji=d.fatigue<=3?'😊':d.fatigue<=6?'😐':'😫';
    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:600;color:var(--text);">${m}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">${d.sets}/${adjMrv} serii</span>
          <button onclick="sfrAddSet('${clientId}','${m}')" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.25);border-radius:4px;padding:1px 7px;color:var(--teal);font-size:12px;cursor:pointer;">+</button>
          <button onclick="sfrRemoveSet('${clientId}','${m}')" style="background:rgba(255,255,255,0.04);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;color:var(--muted);font-size:12px;cursor:pointer;">−</button>
        </div>
      </div>
      <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;margin-bottom:6px;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:20px;transition:width .3s;"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <span style="font-size:9px;color:var(--muted);white-space:nowrap;">Zmęczenie: ${fatigueEmoji}</span>
        <input type="range" min="1" max="10" value="${d.fatigue}" oninput="sfrSetFatigue('${clientId}','${m}',this.value)" style="flex:1;accent-color:${color};">
        <span style="font-size:9px;color:${color};font-family:'DM Mono',monospace;">${d.fatigue}/10</span>
      </div>
    </div>`;
  }).join('');

  sfrCheckWarnings(clientId,mult);
}

function sfrAddSet(clientId,muscle){
  const data=sfrGetWeekData(clientId);
  data[muscle].sets++;
  sfrPersist(clientId);
  sfrRender(clientId);
}

function sfrRemoveSet(clientId,muscle){
  const data=sfrGetWeekData(clientId);
  if(data[muscle].sets>0) data[muscle].sets--;
  sfrPersist(clientId);
  sfrRender(clientId);
}

function sfrSetFatigue(clientId,muscle,val){
  const data=sfrGetWeekData(clientId);
  data[muscle].fatigue=parseInt(val);
  sfrPersist(clientId);
  sfrRender(clientId);
}

function sfrReset(clientId){
  if(!confirm('Zresetować objętość na ten tydzień?')) return;
  const wk=sfrWeekKey();
  CLIENT_SFR[clientId][wk]={};
  SFR_MUSCLES.forEach(m=>{ CLIENT_SFR[clientId][wk][m]={sets:0,fatigue:5}; });
  sfrPersist(clientId);
  sfrRender(clientId);
}

function sfrCheckWarnings(clientId,mult){
  const warningEl=document.getElementById('sfr-warning');
  if(!warningEl) return;
  const data=sfrGetWeekData(clientId);
  const warnings=[];
  SFR_MUSCLES.forEach(m=>{
    const d=data[m];
    const adjMrv=Math.round(SFR_LIMITS[m].mrv*mult);
    if(d?.sets>=adjMrv) warnings.push(`⚠️ ${m}: MRV osiągnięte (${d.sets}/${adjMrv} serii)`);
    if(d?.fatigue>=8) warnings.push(`🦴 ${m}: Wysokie zmęczenie stawowe (${d.fatigue}/10) — rozważ deload`);
  });
  if(warnings.length){
    warningEl.style.display='block';
    warningEl.innerHTML=warnings.join('<br>');
  }else{
    warningEl.style.display='none';
  }
}

// Wykorzystywane przez generator planu AI (jeśli wybrano klienta)
function sfrGetContextForAI(clientId){
  if(!clientId || !CLIENT_SFR[clientId]) return '';
  const data=sfrGetWeekData(clientId);
  const {mult}=sfrGetMultiplier(clientId);
  const lines=SFR_MUSCLES.map(m=>{
    const d=data[m];
    if(!d||d.sets===0) return null;
    const adjMrv=Math.round(SFR_LIMITS[m].mrv*mult);
    return `${m}: ${d.sets}/${adjMrv} serii w tym tygodniu, zmęczenie stawowe: ${d.fatigue}/10`;
  }).filter(Boolean);
  if(!lines.length) return '';
  return `\n\nSFR TRACKER (bieżący tydzień klienta, uwzględnij przy planowaniu objętości):\n${lines.join('\n')}\nLimit MRV dostosowany do stresu/snu (mnożnik: ${mult}x)`;
}

window.renderCPSfr=renderCPSfr; window.sfrAddSet=sfrAddSet; window.sfrRemoveSet=sfrRemoveSet;
window.sfrSetFatigue=sfrSetFatigue; window.sfrReset=sfrReset; window.sfrGetContextForAI=sfrGetContextForAI;

// ════════════════════════════════════════
// IMPORT Z FITEBO
// ════════════════════════════════════════
let fbImages = [];
let fbParsed = [];

function fbFileLoad(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('fb-paste').value = e.target.result; };
  reader.readAsText(file, 'UTF-8');
}

function fbImagesLoad(input){
  const files = Array.from(input.files || []);
  if(fbImages.length + files.length > 8){ notify('⚠ Maksymalnie 8 zrzutów na jedną analizę.'); }
  files.slice(0, Math.max(0, 8 - fbImages.length)).forEach(file => {
    if(file.size > 5000000){ notify('⚠ '+file.name+': plik za duży (max 5MB), pomijam.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      fbImages.push({ dataUrl, mediaType: dataUrl.split(';')[0].split(':')[1], base64: dataUrl.split(',')[1] });
      renderFbImagePreviews();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function fbRemoveImage(i){ fbImages.splice(i,1); renderFbImagePreviews(); }

function renderFbImagePreviews(){
  const wrap = document.getElementById('fb-img-previews'); if(!wrap) return;
  wrap.innerHTML = fbImages.map((img,i)=>`<div style="position:relative;width:60px;height:60px;border-radius:8px;overflow:hidden;border:1px solid var(--border2);">
    <img src="${img.dataUrl}" style="width:100%;height:100%;object-fit:cover;">
    <button onclick="fbRemoveImage(${i})" style="position:absolute;top:1px;right:1px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:1;">×</button>
  </div>`).join('');
}

async function fbAnalyze(){
  const raw = document.getElementById('fb-paste').value.trim();
  const resultEl = document.getElementById('fb-result');
  const btn = document.getElementById('fb-analyze-btn');
  if(!raw && !fbImages.length){ resultEl.innerHTML = '<div style="color:var(--red);font-size:12px;">Wklej dane albo wgraj zrzut ekranu.</div>'; return; }
  btn.disabled = true; btn.textContent = '⏳ Analizuję...';
  resultEl.innerHTML = '<div style="color:var(--muted);font-size:12px;">AI analizuje dane, przy większych porcjach może to potrwać kilkanaście sekund...</div>';

  const system = `Jesteś asystentem migracji danych dla platformy trenera personalnego. Wyciągnij dane klientów z tekstu i/lub zrzutów ekranu z aplikacji Fitebo. Zwróć WYŁĄCZNIE poprawny JSON, bez markdown:
{"clients":[{
  "name":"Imię Nazwisko","age":liczba_lub_null,"gender":"M"|"K"|null,
  "weight":liczba_lub_null,"height":liczba_lub_null,
  "goal":"masa"|"sila"|"redukcja"|"kondycja"|null,
  "level":"poczatkujacy"|"sredni"|"zaawansowany"|null,
  "injuries":"tekst_lub_null",
  "measurements":[{"date":"YYYY-MM-DD","weight":liczba_lub_null,"waist":liczba_lub_null,"chest":liczba_lub_null,"hips":liczba_lub_null}],
  "sessions":[{"date":"YYYY-MM-DD","type":"opis treningu","exercisesCount":liczba_lub_null}],
  "notes":"dodatkowe uwagi tekstowe lub null"
}]}
Zasady: jeśli danych brak, użyj null / pustej tablicy — NIE zmyślaj. Daty w formacie YYYY-MM-DD; jeśli nie da się ustalić dokładnej daty, pomiń wpis. Jeśli w danych jest wielu klientów, zwróć każdego osobno w tablicy.`;

  const content = fbImages.length
    ? [...fbImages.map(img => ({ type:'image', source:{ type:'base64', media_type: img.mediaType, data: img.base64 } })), { type:'text', text: raw || 'Przeanalizuj załączone zrzuty ekranu z Fitebo.' }]
    : raw.substring(0, 15000);

  try{
    const resp = await fetch(W, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:4000, system, messages:[{ role:'user', content }] }) });
    const data = await resp.json();
    const rawText = (data.content||[]).map(b=>b.text||'').join('');
    let parsed;
    try{ parsed = JSON.parse(rawText.replace(/```json|```/g,'').trim()); }
    catch(e){ const m = rawText.match(/\{[\s\S]+\}/); if(m) parsed = JSON.parse(m[0]); }

    if(!parsed || !Array.isArray(parsed.clients) || !parsed.clients.length){
      resultEl.innerHTML = '<div style="color:var(--red);font-size:12px;">Nie udało się rozpoznać żadnego klienta. Spróbuj wkleić inny fragment albo wyraźniejszy zrzut ekranu.</div>';
    } else {
      fbParsed = parsed.clients;
      renderFbPreview();
    }
  }catch(e){
    resultEl.innerHTML = '<div style="color:var(--red);font-size:12px;">Błąd: ' + e.message + '</div>';
  }
  btn.disabled = false; btn.textContent = '🔍 Analizuj (AI)';
}

function renderFbPreview(){
  const el = document.getElementById('fb-result');
  let h = '<div style="font-size:11px;color:var(--teal);margin-bottom:8px;">✅ Znaleziono ' + fbParsed.length + ' klient(ów). Odznacz tych, których NIE chcesz importować:</div>';
  fbParsed.forEach((c,i) => {
    h += `<label style="display:flex;align-items:flex-start;gap:8px;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" id="fb-chk-${i}" checked style="margin-top:2px;">
      <div><div style="font-weight:600;font-size:12px;">${c.name || '(bez imienia)'}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px;">${(c.measurements||[]).length} pomiarów · ${(c.sessions||[]).length} sesji</div></div>
    </label>`;
  });
  h += '<button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="fbImportSelected()">📥 Importuj zaznaczone</button>';
  el.innerHTML = h;
}

async function fbImportSelected(){
  let imported = 0;
  for(let i=0; i<fbParsed.length; i++){
    const chk = document.getElementById('fb-chk-'+i);
    if(!chk || !chk.checked) continue;
    const c = fbParsed[i];
    if(!c.name) continue;

    const newClient = withTrainer({
      id: newId('c'), name: c.name,
      email:'', phone:'',
      age: c.age||'', gender: c.gender==='K'?'K':'M',
      weight: c.weight||'', height: c.height||'',
      goal: c.goal||'masa', level: c.level||'sredni',
      injuries: c.injuries||'', notes: c.notes||'',
      status:'active', joinDate: new Date().toISOString().split('T')[0],
      source:'Fitebo import'
    });
    CL.push(newClient);
    await persistById('clients', newClient);

    for(const m of (c.measurements||[]).filter(m=>m.date)){
      if(m.weight!=null){
        const me=withTrainer({ id:newId('me'), clientId:newClient.id, groupId:'mg1', date:m.date, values:{ m1:m.weight }, notes:'Import z Fitebo' });
        window.METRIC_ENTRIES.push(me);
        await persistById('metricEntries', me);
      }
      if(m.waist!=null || m.chest!=null || m.hips!=null){
        const me=withTrainer({ id:newId('me'), clientId:newClient.id, groupId:'mg2', date:m.date, values:{ m1:m.chest||null, m2:m.waist||null, m3:m.hips||null }, notes:'Import z Fitebo' });
        window.METRIC_ENTRIES.push(me);
        await persistById('metricEntries', me);
      }
    }

    for(const s of (c.sessions||[]).filter(s=>s.date)){
      const sess = withTrainer({ id:newId('s'), clientId:newClient.id, date:s.date, time:'', type: s.type || 'Trening (import Fitebo)', duration:60, notes:'Zaimportowano z Fitebo', createdAt: new Date().toISOString() });
      SE.push(sess);
      await persistById('sessions', sess);
    }

    if(c.notes){
      if(!window.CLIENT_TIMELINE) window.CLIENT_TIMELINE = {};
      if(!CLIENT_TIMELINE[newClient.id]) CLIENT_TIMELINE[newClient.id] = [];
      CLIENT_TIMELINE[newClient.id].push({ id:'fbn_'+Date.now(), text:'Import z Fitebo: '+c.notes, type:'notatka', date:new Date().toISOString() });
      if(window._db){ try{ window._setDoc(window._doc(window._db,'clients',newClient.id), { timeline: CLIENT_TIMELINE[newClient.id] }, { merge:true }); }catch(e){} }
    }

    imported++;
  }

  try{ renderClients(); }catch(e){}
  try{ document.getElementById('nb-clients').textContent = CL.length; }catch(e){}
  fbImages = []; renderFbImagePreviews();
  document.getElementById('fb-result').innerHTML = '<div style="color:var(--teal);font-size:13px;font-weight:600;">✅ Zaimportowano ' + imported + ' klient(ów)! Znajdziesz ich na liście Klienci.</div>';
  notify('✓ Import z Fitebo zakończony — ' + imported + ' klient(ów)');
}

window.fbFileLoad=fbFileLoad; window.fbImagesLoad=fbImagesLoad; window.fbRemoveImage=fbRemoveImage;
window.fbAnalyze=fbAnalyze; window.fbImportSelected=fbImportSelected;

// Buduje krótkie, automatyczne wnioski dla trenera na bazie danych, które apka już zbiera
// (nastrój/stres z modułu Psycho, frekwencja sesji vs. przypisany plan). Zwraca max 2 najważniejsze.
function buildClientInsight(c,sessions,plans,daysSince){
  const insights=[];

  // 1) Nastrój / stres — trend z ostatnich wpisów w module Psycho
  const psyDaily=(window.CLIENT_PSYCHO?.[c.id]?.daily||[]).slice(-5);
  if(psyDaily.length>=2){
    const avgStress=psyDaily.reduce((s,d)=>s+(d.stress||0),0)/psyDaily.length;
    const moodTrend=psyDaily[psyDaily.length-1].mood-psyDaily[0].mood;
    if(avgStress>=7){
      insights.push({icon:'⚠️',color:'var(--red)',text:`Wysoki poziom stresu w ostatnich wpisach (śr. ${avgStress.toFixed(1)}/10) — rozważ obniżenie intensywności o 15-20% w tym tygodniu.`});
    } else if(moodTrend<=-2){
      insights.push({icon:'📉',color:'var(--orange)',text:'Nastrój klienta spada w ostatnich wpisach — warto zapytać, jak się czuje, zanim naciśniesz na kolejny ciężki trening.'});
    }
  }

  // 2) Frekwencja vs. przypisany plan
  if(plans.length){
    const expectedPerWeek=plans[0].days?.length||3;
    const twoWeeksAgo=new Date();twoWeeksAgo.setDate(twoWeeksAgo.getDate()-14);
    const recentCount=sessions.filter(s=>new Date(s.date)>=twoWeeksAgo).length;
    const expectedTwoWeeks=expectedPerWeek*2;
    if(expectedTwoWeeks>0 && recentCount<expectedTwoWeeks*0.6){
      insights.push({icon:'📊',color:'var(--gold)',text:`${recentCount} sesji w ostatnich 2 tyg. przy planie ${expectedPerWeek}×/tydz. (oczekiwano ~${expectedTwoWeeks}) — rozważ dopytać o przeszkody albo zmniejszyć liczbę dni w planie.`});
    }
  }

  // 3) Długa nieobecność (tylko jeśli nic wcześniej nie wskazano)
  if(!insights.length && daysSince!==null && daysSince>10){
    insights.push({icon:'⏱️',color:'var(--red)',text:`Brak sesji od ${daysSince} dni — dobry moment na krótką wiadomość sprawdzającą, zanim klient całkiem straci rytm.`});
  }

  return insights.slice(0,2);
}

function cpClientDataEditHTML(c){
  const field=(id,label,control)=>`<div class="form-field cp-field-below"><div class="cp-field-control">${control}</div><label class="form-lbl" for="${id}">${label}</label></div>`;
  const intake=typeof clientIntakeFormState==='function'?clientIntakeFormState(c.id):null;
  const intakeLbl=intake&&intake.filled?'Wypełniona':intake&&intake.pending?'Oczekuje na klienta':intake&&intake.sent?'Wysłana':'Nie wysłana';
  const intakeCol=intake&&intake.filled?'var(--teal)':intake&&intake.pending?'var(--orange)':'var(--muted)';
  const goalLabels={masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja'};
  const levelLabels={poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'};
  return `<div class="cp-edit-card">
    <div class="cp-edit-card-hdr">
      <div class="cp-edit-card-title">Edycja danych klienta</div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="cancelCPEdit()">Anuluj</button>
    </div>
    <div style="background:rgba(225,31,46,0.08);border:1px solid rgba(225,31,46,0.25);border-radius:10px;padding:12px;margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">📋 Ankieta wstępna — tylko w Formularzach</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:8px;">Cel, poziom, dni/tydzień, pora treningu i kontuzje pochodzą z ankiety (apką lub PDF). Nie edytuj ich tu drugi raz.</div>
      <div style="font-size:11px;margin-bottom:8px;">Status: <span style="color:${intakeCol};font-weight:700;">${intakeLbl}</span>
        ${c.goal||c.level||c.trainingFreq?` · teraz: ${escHtml(goalLabels[c.goal]||c.goal||'—')} / ${escHtml(levelLabels[c.level]||c.level||'—')}${c.trainingFreq?' / '+c.trainingFreq+'×':''}`:''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" class="btn btn-primary btn-sm" onclick="goTo('forms');setTimeout(()=>{if(typeof openFormDetail==='function')openFormDetail('df1');},200)">Otwórz ankietę</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="printFormPdf('df1')">📄 PDF blank</button>
        ${intake&&intake.pending?`<button type="button" class="btn btn-ghost btn-sm" onclick="remindFormSend('${escHtml(intake.pending.id)}')">Przypomnij</button>`:''}
        ${!(intake&&(intake.filled||intake.pending))?`<button type="button" class="btn btn-ghost btn-sm" onclick="sendClientIntakeForm('${escHtml(c.id)}');cancelCPEdit();">Wyślij w apce</button>`:''}
        <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('forms')">Historia w profilu</button>
      </div>
    </div>
    ${field('cpe-name','Imię i nazwisko',`<input class="cp-edit-field form-input" id="cpe-name" value="${escHtml(c.name||'')}">`)}
    <div class="form-grid">
      ${field('cpe-email','Email',`<input class="cp-edit-field form-input" id="cpe-email" type="email" value="${escHtml(c.email||'')}">`)}
      ${field('cpe-phone','Telefon',`<input class="cp-edit-field form-input" id="cpe-phone" type="tel" placeholder="+48 123 456 789" value="${escHtml(c.phone||'')}">`)}
    </div>
    <div class="form-grid">
      ${field('cpe-age','Wiek',`<input type="number" class="cp-edit-field form-input" id="cpe-age" value="${c.age||''}">`)}
      ${field('cpe-gender','Płeć',`<select class="form-select" id="cpe-gender">
          <option value="M" ${c.gender==='M'?'selected':''}>Mężczyzna</option>
          <option value="K" ${c.gender==='K'?'selected':''}>Kobieta</option>
        </select>`)}
    </div>
    <div class="form-grid">
      ${field('cpe-weight','Waga (kg)',`<input type="number" class="cp-edit-field form-input" id="cpe-weight" value="${c.weight||''}" step="0.1">`)}
      ${field('cpe-height','Wzrost (cm)',`<input type="number" class="cp-edit-field form-input" id="cpe-height" value="${c.height||''}">`)}
    </div>
    <div class="form-field cp-field-below">
      <div class="cp-field-control">
        <div class="cp-field-hint">Kolejność = Dzień 1, 2… przy zapisie do kalendarza (nie jest w ankiecie).</div>
        ${typeof preferredWeekdaysChipsHTML==='function'?preferredWeekdaysChipsHTML(c.preferredWeekdays||[],'cpe'):'<div id="cpe-preferred-weekdays-mount"></div>'}
      </div>
      <label class="form-lbl">Preferowane dni tygodnia</label>
    </div>
    ${field('cpe-status','Status',`<select class="form-select" id="cpe-status">
        <option value="active" ${c.status==='active'?'selected':''}>Aktywny</option>
        <option value="inactive" ${c.status==='inactive'?'selected':''}>Nieaktywny</option>
        <option value="archived" ${c.status==='archived'?'selected':''}>Zarchiwizowany</option>
      </select>`)}
    <div class="form-field cp-field-below">
      <div class="cp-field-control">
        <div class="cp-field-hint">Wpływa na planowanie — biegacz ma wyższą wytrzymałość, siłownia wyższą bazę siłową.</div>
        ${typeof priorSportsChipsHTML==='function'?priorSportsChipsHTML(c.priorSports,'cpe'):''}
      </div>
      <label class="form-lbl">Wcześniejsze sporty / aktywności</label>
    </div>
    <div class="form-grid">
      ${field('cpe-activity','Dotychczasowa aktywność',`<select class="form-select" id="cpe-activity">
          <option value="sedentary" ${c.activityLevel==='sedentary'?'selected':''}>Siedzący tryb</option>
          <option value="light" ${c.activityLevel==='light'?'selected':''}>Lekka</option>
          <option value="moderate" ${(!c.activityLevel||c.activityLevel==='moderate')?'selected':''}>Umiarkowana</option>
          <option value="active" ${c.activityLevel==='active'?'selected':''}>Aktywny</option>
        </select>`)}
      ${field('cpe-profile-auto','Profil (auto)',`<div class="cp-profile-auto">${typeof clientSportProfileLabel==='function'?escHtml(clientSportProfileLabel(c)||'—'):'—'}</div>`)}
    </div>
    ${field('cpe-sport-notes','Uwagi sportowe',`<input class="form-input" id="cpe-sport-notes" value="${escHtml(c.sportNotes||'')}" placeholder="np. biegał 5 lat, teraz siłownia od zera">`)}
    <div class="form-field cp-field-below">
      <div class="cp-field-control">
        <div class="cp-field-hint">Partie na początku sesji (AI / Live).</div>
        ${typeof physiquePriorityChipsHTML==='function'?physiquePriorityChipsHTML(c.physiquePriority,'cpe'):''}
      </div>
      <label class="form-lbl">Priorytet sylwetkowy</label>
    </div>
    ${field('cpe-notes','Uwagi prywatne',`<textarea class="form-select" id="cpe-notes" rows="2" style="resize:none;">${escHtml(c.notes||'')}</textarea>`)}
    <button type="button" class="btn btn-primary" style="width:100%;" onclick="saveCPEdit('${c.id}')">💾 Zapisz zmiany</button>
  </div>`;
}
function startCPEdit(clientId){
  window._cpEditingClientId=clientId;
  if(typeof cpClientId!=='undefined'&&cpClientId===clientId){
    const c=CL.find(x=>x.id===clientId);
    if(c&&typeof setCPTab==='function')setCPTab('overview');
    else if(c&&typeof renderCPOverview==='function')renderCPOverview(c);
    return;
  }
  if(typeof openClientProfile==='function')openClientProfile(clientId);
  window._cpEditingClientId=clientId;
  const c=CL.find(x=>x.id===clientId);
  if(c&&typeof renderCPOverview==='function')renderCPOverview(c);
}
function cancelCPEdit(){
  window._cpEditingClientId=null;
  const c=CL.find(x=>x.id===cpClientId);
  if(c&&typeof renderCPOverview==='function')renderCPOverview(c);
}
window.startCPEdit=startCPEdit;
window.cancelCPEdit=cancelCPEdit;

function cpOverviewUpdates(c){
  const manual=(window.CLIENT_TIMELINE&&CLIENT_TIMELINE[c.id])||c.timeline||[];
  const autoSess=(window.SE||[]).filter(s=>s.clientId===c.id).map(s=>({
    type:'trening',
    text:(typeof sessionTitle==='function'?sessionTitle(s):(s.type||'Trening')),
    date:s.date+'T'+(s.time||'12:00')+':00'
  }));
  const autoPlans=(window.PL||[]).filter(p=>p.clientId===c.id).map(p=>({
    type:'plan',text:'Przypisano plan: '+p.name,date:p.createdAt||new Date().toISOString()
  }));
  const autoMeas=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===c.id).slice(-12).map(m=>{
    const g=typeof allMetricGroups==='function'?allMetricGroups().find(gr=>gr.id===m.groupId):null;
    return{type:'pomiar',text:(g?(g.icon+' '+g.name):'Pomiar')+(m.notes?' — '+m.notes:''),date:(m.date||'')+'T10:00:00'};
  });
  return [...manual,...autoSess,...autoPlans,...autoMeas]
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .slice(0,8);
}

function cpMetricLatest(clientId,groupId,metricId){
  const list=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===clientId&&e.groupId===groupId&&e.values&&e.values[metricId]!=null)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return list[0]||null;
}

function cpMetricDeltaPct(clientId,groupId,metricId){
  const list=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===clientId&&e.groupId===groupId&&e.values&&e.values[metricId]!=null)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(list.length<2)return null;
  const cur=parseFloat(list[0].values[metricId]);
  const prev=parseFloat(list[1].values[metricId]);
  if(!isFinite(cur)||!isFinite(prev)||!prev)return null;
  return Math.round(((cur-prev)/Math.abs(prev))*1000)/10;
}

function cpMetricSeries(clientId,groupId,metricId,limit){
  return (window.METRIC_ENTRIES||[]).filter(e=>e.clientId===clientId&&e.groupId===groupId&&e.values&&e.values[metricId]!=null)
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''))
    .slice(-(limit||8))
    .map(e=>({d:e.date,v:parseFloat(e.values[metricId])}))
    .filter(p=>isFinite(p.v));
}

/** Mini sparkline for Overview metric cards (Everfit-style). */
function cpOvSparkSVG(points,color,bars){
  const pts=(points||[]).filter(p=>p&&isFinite(p.v));
  if(pts.length<2)return'';
  const W=160,H=36,pad=2;
  const col=color||'var(--accent)';
  if(bars){
    const max=Math.max(...pts.map(p=>p.v),1);
    const bw=Math.max(3,Math.floor((W-pad*2)/pts.length)-2);
    return `<svg class="cp-ov-spark" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">${pts.map((p,i)=>{
      const bh=Math.max(2,Math.round((p.v/max)*(H-pad*2)));
      const x=pad+i*(bw+2);const y=H-pad-bh;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="1.5" fill="${col}" opacity="0.85"/>`;
    }).join('')}</svg>`;
  }
  const minV=Math.min(...pts.map(p=>p.v));
  const maxV=Math.max(...pts.map(p=>p.v));
  const range=(maxV-minV)||1;
  const xs=pts.map((_,i)=>pad+(i/(pts.length-1))*(W-pad*2));
  const ys=pts.map(p=>pad+(H-pad*2)-((p.v-minV)/range)*(H-pad*2));
  const path='M'+xs.map((x,i)=>x.toFixed(1)+','+ys[i].toFixed(1)).join('L');
  return `<svg class="cp-ov-spark" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function renderCPOverview(c){
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];
  const sessions=SE.filter(s=>s.clientId===c.id);
  const tasks=TASKS.filter(t=>t.clientId===c.id);
  const oneShot=tasks.filter(t=>typeof isOneShot==='function'?isOneShot(t):!isHabit(t));
  const tasksDone=oneShot.filter(t=>t.status==='done');
  const plans=PL.filter(p=>p.clientId===c.id);
  const lastSess=sessions.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const daysSince=lastSess?Math.floor((today-new Date(lastSess.date))/(1000*60*60*24)):null;
  const notes=CLIENT_NOTES[c.id]||[];
  initClientData(c);

  const editing=window._cpEditingClientId===c.id;
  const goalLabels={masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja'};
  const levelLabels={poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'};
  const goalText=goalLabels[c.goal]||c.goal||'—';
  const levelText=levelLabels[c.level]||c.level||'';
  const injuries=typeof clientInjuriesText==='function'?clientInjuriesText(c):(c.injuries||'');
  const metricsOn=typeof bmFeatureOn==='function'?bmFeatureOn(c):true;
  const photosOn=typeof ppFeatureOn==='function'?ppFeatureOn(c):true;

  const logged=typeof completedWorkouts==='function'?completedWorkouts(c.id,sessions):sessions.filter(s=>s.source==='client'||s.source==='live');
  const inPastDays=(s,n)=>{const d=new Date(s.date+'T12:00:00');const diff=(today-d)/86400000;return diff>=0&&diff<=n;};
  const assigned7=sessions.filter(s=>inPastDays(s,7)).length;
  const assigned30=sessions.filter(s=>inPastDays(s,30)).length;
  const last7=logged.filter(s=>inPastDays(s,7)).length;
  const last30=logged.filter(s=>inPastDays(s,30)).length;
  // Next calendar week (Mon–Sun after current week)
  const dow=today.getDay(); // 0 Sun
  const daysToNextMon=((8-dow)%7)||7;
  const nextMon=new Date(today);nextMon.setDate(today.getDate()+daysToNextMon);
  const nextSun=new Date(nextMon);nextSun.setDate(nextMon.getDate()+6);
  const nextMonStr=nextMon.toISOString().split('T')[0];
  const nextSunStr=nextSun.toISOString().split('T')[0];
  const nextWeekAssigned=sessions.filter(s=>s.date>=nextMonStr&&s.date<=nextSunStr).length;
  const lastWorkout=logged.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const lastWorkoutTitle=lastWorkout?(typeof sessionTitle==='function'?sessionTitle(lastWorkout):(lastWorkout.type||'Trening')):null;
  const lastWorkoutDays=lastWorkout?Math.floor((today-new Date(lastWorkout.date+'T12:00:00'))/86400000):null;

  const weightEntry=metricsOn?cpMetricLatest(c.id,'mg1','m1'):null;
  const weightVal=weightEntry?weightEntry.values.m1:(c.weight||null);
  const weightDelta=metricsOn?cpMetricDeltaPct(c.id,'mg1','m1'):null;
  const weightSpark=metricsOn?cpOvSparkSVG(cpMetricSeries(c.id,'mg1','m1'),'var(--accent)'):'';
  const stepsEntry=metricsOn?cpMetricLatest(c.id,'mg6','m1'):null;
  const stepsDelta=metricsOn?cpMetricDeltaPct(c.id,'mg6','m1'):null;
  const stepsSpark=metricsOn?cpOvSparkSVG(cpMetricSeries(c.id,'mg6','m1'),'var(--blue)',true):'';
  const hrEntry=metricsOn?(cpMetricLatest(c.id,'mg4','m1')||cpMetricLatest(c.id,'mg6','m3')):null;
  const hrGroup=hrEntry?hrEntry.groupId:'mg4';
  const hrKey=hrEntry&&hrEntry.values&&hrEntry.values.m1!=null?'m1':'m3';
  const hrDelta=metricsOn&&hrEntry?cpMetricDeltaPct(c.id,hrGroup,hrKey):null;
  const hrSpark=metricsOn&&hrEntry?cpOvSparkSVG(cpMetricSeries(c.id,hrGroup,hrKey),'var(--teal)'):'';
  const sleepEntry=cpMetricLatest(c.id,'mg5','m2');
  const sleepSpark=cpOvSparkSVG(cpMetricSeries(c.id,'mg5','m2'),'var(--blue)',true);

  const photos=photosOn&&typeof ppListFor==='function'?ppListFor(c.id).slice().reverse().slice(0,2):[];
  const updates=cpOverviewUpdates(c);

  const metricCard=(title,value,unit,delta,empty,spark)=>{
    const has=value!=null&&value!==''&&value!=='—';
    const dHtml=delta==null?'':`<div class="cp-ov-metric-delta" style="color:${delta<=0?'var(--teal)':'var(--orange)'};">${delta>0?'↑':'↓'} ${Math.abs(delta)}%</div>`;
    return `<div class="cp-ov-metric">
      <div class="cp-ov-metric-lbl">${title}</div>
      <div class="cp-ov-metric-val">${has?escHtml(String(value)):'—'}${has&&unit?`<span class="cp-ov-metric-unit">${unit}</span>`:''}</div>
      ${has?dHtml:`<div style="font-size:10px;color:var(--muted);margin-top:4px;">${empty||'Brak danych'}</div>`}
      ${spark?`<div class="cp-ov-metric-spark">${spark}</div>`:''}
    </div>`;
  };

  const railCard=(title,body,onclick)=>{
    const click=onclick?` class="cp-ov-rail-card clickable" role="button" tabindex="0" onclick="${onclick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onclick}}"`:` class="cp-ov-rail-card"`;
    return `<div${click}>
    <div class="cp-ov-rail-hd"><span>${title}</span></div>
    ${body}
  </div>`;
  };

  document.getElementById('cp-body').innerHTML=`
    ${editing?cpClientDataEditHTML(c):''}

    ${(()=>{const ob=typeof getClientOnboard==='function'?getClientOnboard(c):null;
      if(!ob||ob.complete)return'';
      return `<div style="background:rgba(201,123,63,0.1);border:1px solid rgba(201,123,63,0.35);border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:700;margin-bottom:2px;">Start współpracy ${ob.done}/${ob.total}</div>
          <div style="font-size:11px;color:var(--muted);">${!ob.invite?'Brak zaproszenia. ':''}${!ob.baseline?'Brak pomiarów. ':''}${!ob.schedule?'Brak dni treningowych. ':''}${!ob.plan?'Brak planu. ':''}${!ob.calendar&&!ob.session?'Brak w kalendarzu. ':''}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openClientOnboardChecklist('${c.id}')">Dokończ</button>
      </div>`;
    })()}

    ${(()=>{const ins=buildClientInsight(c,sessions,plans,daysSince);
      if(!ins.length)return'';
      return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        ${ins.slice(0,2).map(i=>`<div style="background:${i.color}14;border:1px solid ${i.color}44;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:16px;flex-shrink:0;">${i.icon}</span>
          <div style="font-size:12px;color:var(--text);line-height:1.6;">${i.text}</div>
        </div>`).join('')}
      </div>`;
    })()}

    <div class="cp-ov-layout">
      <div class="cp-ov-main">
        <!-- Training -->
        <div class="cp-ov-card">
          <div class="cp-ov-card-hd">
            <div class="cp-ov-card-title">Treningi</div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('training')">Otwórz →</button>
          </div>
          <div class="cp-ov-train-stats">
            <div>
              <div class="cp-ov-stat-num" style="color:var(--accent);">${last7}${assigned7?`<span class="cp-ov-stat-of">/${assigned7}</span>`:''}</div>
              <div class="cp-ov-stat-lbl">Ostatnie 7 dni</div>
              <div class="cp-ov-stat-sub">${assigned7?last7+'/'+assigned7+' odhaczone':(last7?last7+' zarejestrowane':'Brak treningów')}</div>
            </div>
            <div>
              <div class="cp-ov-stat-num" style="color:var(--blue);">${last30}${assigned30?`<span class="cp-ov-stat-of">/${assigned30}</span>`:''}</div>
              <div class="cp-ov-stat-lbl">Ostatnie 30 dni</div>
              <div class="cp-ov-stat-sub">${assigned30?last30+'/'+assigned30+' odhaczone':(logged.length+' łącznie · '+tasksDone.length+'/'+oneShot.length+' zadań')}</div>
            </div>
            <div>
              <div class="cp-ov-stat-num" style="color:var(--teal);">${nextWeekAssigned}</div>
              <div class="cp-ov-stat-lbl">Następny tydzień</div>
              <div class="cp-ov-stat-sub">${nextWeekAssigned?nextWeekAssigned+' w kalendarzu':'Jeszcze nie przypisano'}</div>
            </div>
          </div>
          ${lastWorkout?`<div class="cp-ov-last-wo" onclick="setCPTab('training')">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Ostatni trening</div>
            <div style="font-size:14px;font-weight:700;">${escHtml(lastWorkoutTitle)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(lastWorkout.date||'')}${lastWorkoutDays!=null?' · '+lastWorkoutDays+' dni temu':''}${lastWorkout.feedback?' · '+lastWorkout.feedback+'/5':''}</div>
          </div>`:`<div class="cp-ov-last-wo muted">Brak zarejestrowanych treningów — klient jeszcze nic nie odhaczył.</div>`}
        </div>

        <!-- Body metrics → full story in Progress / Pomiary -->
        <div class="cp-ov-card" style="cursor:pointer;" onclick="setCPTab('progress')">
          <div class="cp-ov-card-hd">
            <div class="cp-ov-card-title">Pomiary ciała</div>
            <span style="font-size:11px;color:var(--muted);">Progress →</span>
          </div>
          ${metricsOn?`<div class="cp-ov-metrics-grid" onclick="event.stopPropagation()">
            ${metricCard('Waga',weightVal,'kg',weightDelta,'Dodaj pomiar masy',weightSpark)}
            ${metricCard('Sen',sleepEntry?sleepEntry.values.m2:null,'/10',null,'Brak danych snu',sleepSpark)}
            ${metricCard('Tętno spocz.',hrEntry?(hrEntry.values.m1||hrEntry.values.m3):null,'bpm',hrDelta,'Brak danych',hrSpark)}
            ${metricCard('Kroki',stepsEntry?stepsEntry.values.m1:null,'',stepsDelta,'Import Garmin / pomiar',stepsSpark)}
          </div>
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;" onclick="event.stopPropagation()">
            <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('metrics')">Aktualizuj pomiary</button>
          </div>`:`<div style="font-size:12px;color:var(--muted);padding:8px 0;">Pomiary ciała wyłączone w Funkcjach klienta.</div>`}
        </div>

        <!-- Active plan -->
        ${plans.length?`
        <div class="cp-ov-card" style="cursor:pointer;" onclick="setCPTab('plan')">
          <div class="cp-ov-card-hd">
            <div class="cp-ov-card-title">Aktywny plan</div>
            <span class="pill pill-green" style="font-size:11px;">${escHtml(plans[plans.length-1].method||'—')}</span>
          </div>
          <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${escHtml(plans[plans.length-1].name)}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${escHtml(plans[plans.length-1].method||'—')} · ${plans[plans.length-1].duration||'?'} tyg. · ${(plans[plans.length-1].days||[]).length} dni/tydzień</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${(plans[plans.length-1].days||[]).slice(0,5).map(d=>`<span style="background:${d.rest?'var(--s3)':'rgba(230,0,0,0.12)'};color:${d.rest?'var(--muted)':'var(--accent)'};border-radius:5px;padding:3px 8px;font-size:11px;font-family:'DM Mono',monospace;">${escHtml(d.day||d.dayName||'?')}${d.rest?' REST':''}</span>`).join('')}
          </div>
        </div>`:`
        <div class="cp-ov-card" style="text-align:center;cursor:pointer;" onclick="setCPTab('plan')">
          <div class="cp-ov-card-title" style="margin-bottom:10px;">Aktywny plan</div>
          <div style="font-size:13px;color:var(--muted);">Brak planu</div>
          <div class="cp-ov-rail-hint" style="margin-top:8px;">Przejdź do zakładki Plan</div>
        </div>`}
      </div>

      <aside class="cp-ov-rail">
        ${railCard('Cel',
          `<div style="font-size:14px;font-weight:700;line-height:1.4;margin-bottom:6px;">${escHtml(goalText)}</div>
           <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">${escHtml(levelText)}${c.trainingFreq?' · '+c.trainingFreq+'× / tydz.':''}${c.preferredTrainTime?' · '+escHtml(c.preferredTrainTime):''}</div>
           <div class="cp-ov-shared-tag">Udostępnione klientowi</div>
           <div class="cp-ov-rail-hint">Kliknij, aby edytować profil</div>`,
          `startCPEdit('${c.id}')`)}

        ${railCard('Notatki',
          (notes.length?notes.slice(0,2).map(n=>`<div class="cip-note" style="margin-bottom:8px;"><div>${escHtml(n.text)}</div><div class="cip-note-date">${escHtml(n.date||'')}</div></div>`).join('')
            :'<div style="font-size:12px;color:var(--muted);">Brak notatek</div>')+
          '<div class="cp-ov-rail-hint">Otwórz zakładkę Notatki</div>',
          `setCPTab('notes')`)}

        ${railCard('Ograniczenia / kontuzje',
          (injuries?`<div style="font-size:12px;line-height:1.5;color:var(--text);">${escHtml(injuries)}</div>`
            :'<div style="font-size:12px;color:var(--muted);">Brak wpisanych ograniczeń</div>')+
          '<div class="cp-ov-rail-hint">Kliknij, aby edytować profil</div>',
          `startCPEdit('${c.id}')`)}

        ${photosOn?railCard('Zdjęcia postępu',
          (photos.length?`<div class="cp-ov-photos">${photos.map(p=>{
            const src=p.front||p.side||p.back||'';
            return `<div class="cp-ov-photo">${src?`<img src="${src}" alt="">`:`<span>📷</span>`}<div class="cp-ov-photo-d">${escHtml(p.date||'')}</div></div>`;
          }).join('')}</div>`
            :'<div style="font-size:12px;color:var(--muted);">Brak zdjęć</div>')+
          '<div class="cp-ov-rail-hint">Zdjęcia w Progress</div>',
          `setCPTab('photos')`):''}

        ${railCard('Profil',
          `<div class="cp-ov-profile-rows">
            <div><span>Email</span><b title="${escHtml(c.email||'')}">${escHtml(c.email||'—')}</b></div>
            <div><span>Telefon</span><b>${escHtml(c.phone||'—')}</b></div>
            <div><span>Wiek / wzrost</span><b>${c.age?c.age+' lat':'—'}${c.height?' · '+c.height+' cm':''}</b></div>
            <div><span>Status</span><b style="color:${c.status==='active'?'var(--teal)':c.status==='inactive'?'var(--orange)':'var(--muted)'};">${c.status==='active'?'Aktywny':c.status==='inactive'?'Nieaktywny':'Zarchiwizowany'}</b></div>
          </div>
          <div class="cp-ov-rail-hint">Kontakt: przycisk Wiadomość u góry</div>`,
          `startCPEdit('${c.id}')`)}

        ${railCard('Aktualizacje',
          (updates.length?updates.map(u=>{
            const dayStr=(()=>{try{return new Date(u.date).toLocaleDateString('pl',{day:'numeric',month:'short'});}catch(e){return'';}})();
            return `<div class="cp-ov-update"><span class="cp-ov-update-ico">${(CTL_ICONS&&CTL_ICONS[u.type])||'•'}</span><div><div class="cp-ov-update-txt">${escHtml(u.text||'')}</div><div class="cp-ov-update-d">${escHtml(dayStr)}</div></div></div>`;
          }).join('')
            :'<div style="font-size:12px;color:var(--muted);">Brak aktywności — sesje i pomiary pojawią się tu automatycznie</div>')+
          '<div class="cp-ov-rail-hint">Pełna oś czasu</div>',
          `setCPTab('timeline')`)}
      </aside>
    </div>`;
}

function renderCPPlan(c){
  const plans=PL.filter(p=>p.clientId===c.id);
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="cp-section-title" style="margin:0;">PLANY TRENINGOWE (${plans.length})</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" onclick="cpAssignTemplate('${c.id}')">📋 Przypisz szablon</button>
        <button class="btn btn-ghost btn-sm" onclick="openBuilderForClient('${c.id}')">✏ Stwórz własny plan</button>
        <button class="btn btn-primary btn-sm" onclick="goTo('aiplangen');document.getElementById('apl-client').value='${c.id}';aplFillFromClient();closeClientProfile()">⚡ Generuj plan AI</button>
      </div>
    </div>
    ${!plans.length
      ?`<div style="text-align:center;padding:40px;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:10px;opacity:0.3;">📋</div>
          <div>Brak planów treningowych</div>
        </div>`
      :plans.map((p,pi)=>`
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;animation:fadeUp 0.15s ease ${pi*0.05}s both;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
            <div>
              <div style="font-size:17px;font-weight:700;">${p.name}</div>
              <div style="font-size:13px;color:var(--muted);margin-top:3px;">${p.method||'—'} · ${p.duration||'?'} tyg. · ${(p.days||[]).length} dni</div>
            </div>
            <div style="display:flex;gap:5px;">
              <span class="pill pill-green" style="font-size:11px;">${p.method||'—'}</span>
              <button onclick="delPlanFromProfile('${p.id}','${c.id}')" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;line-height:1;" title="Usuń plan">×</button>
            </div>
          </div>
          <!-- dni treningowe -->
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${(p.days||[]).map(d=>`
              <div style="background:var(--s3);border-radius:8px;padding:8px 10px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:${d.rest||!(d.exercises&&d.exercises.length)?0:5}px;">
                  <span style="font-size:12px;font-family:'DM Mono',monospace;color:${d.rest?'var(--muted)':'var(--accent)'};font-weight:700;min-width:32px;">${d.day||d.dayName||'—'}</span>
                  <span style="font-size:14px;font-weight:600;color:${d.rest?'var(--muted)':'var(--text)'};">${d.rest?'Odpoczynek':(d.muscles||d.name||d.focus||'Trening')}</span>
                </div>
                ${!d.rest&&(d.exercises||[]).length?`<div style="padding-left:40px;display:flex;flex-wrap:wrap;gap:4px;">
                  ${(d.exercises||[]).slice(0,4).map(e=>`<span style="font-size:12px;color:var(--muted);background:var(--s2);border-radius:4px;padding:2px 7px;">${typeof e==='string'?e:e.name||e.n||''}</span>`).join('')}
                  ${(d.exercises||[]).length>4?`<span style="font-size:12px;color:var(--muted2);">+${(d.exercises||[]).length-4} więcej</span>`:''}
                </div>`:''}
              </div>`).join('')}
          </div>
          <div style="margin-top:10px;display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="liveSelectPlanForClient('${p.id}','${c.id}')">▶ Trenuj teraz</button>
            <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="editPlan('${p.id}');closeClientProfile()">✏ Edytuj</button>
          </div>
        </div>`).join('')}`;
}

async function delPlanFromProfile(planId,clientId){
  if(!confirm('Usunąć plan?'))return;
  window.PL=PL.filter(p=>p.id!==planId);
  if(window._db){try{await window._del(window._doc(window._db,'plans',planId));}catch(e){console.warn('Firebase:',e);}}
  const c=CL.find(x=>x.id===clientId);
  if(c)renderCPPlan(c);
  notify('✓ Plan usunięty');
}

function cpAssignTemplate(clientId){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  // otwórz szablony i ustaw klienta
  closeClientProfile();
  goTo('templates');
  setTimeout(()=>{
    // pre-select klienta w panelu szablonów
    const sel=document.getElementById('tpl-assign-client');
    if(sel)sel.value=clientId;
    notify('Wybierz szablon i kliknij "Przypisz plan klientowi" dla '+c.name);
  },300);
}

function liveSelectPlanForClient(planId,clientId){
  closeClientProfile();
  goTo('live');
  setTimeout(()=>{
    const c=CL.find(x=>x.id===clientId);
    if(typeof liveClientSetField==='function')liveClientSetField(clientId,c?c.name:'');
    setTimeout(()=>liveSelectPlan(planId),200);
  },300);
}

function renderCPMetrics(c){
  const groups=allMetricGroups();
  const entries=METRIC_ENTRIES.filter(e=>e.clientId===c.id);
  const activeGid=window._cpMetricGroup||(groups.find(g=>entries.some(e=>e.groupId===g.id))||groups[0]||{}).id||'mg1';
  window._cpMetricGroup=activeGid;
  const activeGroup=groups.find(g=>g.id===activeGid)||groups[0];
  const geAll=entries.filter(e=>e.groupId===activeGid).sort((a,b)=>b.date.localeCompare(a.date));
  const last=geAll[0];const prev=geAll[1];
  const safeName=(c.name||'').replace(/'/g,"\\'");

  document.getElementById('cp-body').innerHTML=`
    <div style="position:sticky;top:0;z-index:5;background:var(--s1);padding-bottom:10px;margin-bottom:4px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <div class="cp-section-title" style="margin:0;">POMIARY</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" onclick="openMetricEntryForClient('${c.id}','${activeGid}')">+ Nowy pomiar</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="typeof openClientBaselineModal==='function'&&openClientBaselineModal('${c.id}')">Baseline</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('progress')">📈 Progress</button>
        </div>
      </div>
      <div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:2px;">
        ${groups.map(g=>{
          const n=entries.filter(e=>e.groupId===g.id).length;
          const on=g.id===activeGid;
          return `<button type="button" onclick="setCPMetricGroup('${c.id}','${g.id}')" style="flex-shrink:0;padding:7px 10px;border-radius:8px;border:1px solid ${on?'var(--accent)':'var(--border2)'};background:${on?'var(--adim)':'var(--s3)'};color:var(--text);font-size:11px;cursor:pointer;white-space:nowrap;">
            ${g.icon} ${g.name}${n?` <span style="color:var(--muted);font-family:'DM Mono',monospace;">${n}</span>`:''}
          </button>`;
        }).join('')}
      </div>
    </div>

    ${activeGroup?`<div class="card-sm" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:20px;">${activeGroup.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;">${escHtml(activeGroup.name)} — ostatni</div>
          <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${last?escHtml(last.date):'brak wpisów'}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;">
          ${last?`<button type="button" class="btn btn-ghost btn-sm" onclick="editMetricEntry('${last.id}')">✎ Edytuj</button>`:''}
          <button type="button" class="btn btn-primary btn-sm" onclick="openMetricEntryForClient('${c.id}','${activeGroup.id}')">+</button>
        </div>
      </div>
      ${last?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;">
        ${activeGroup.metrics.map(m=>{
          const cv=last.values[m.id];const pv=prev?prev.values[m.id]:null;
          const diff=cv!=null&&pv!=null?(cv-pv).toFixed(1):null;
          const goodDown=['mg1','mg2'].includes(activeGroup.id);
          const color=diff==null?'var(--muted)':parseFloat(diff)<0?(goodDown?'var(--teal)':'var(--red)'):parseFloat(diff)>0?(goodDown?'var(--red)':'var(--teal)'):'var(--muted)';
          return `<div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">${escHtml(m.name)}</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);">${cv!=null?cv:'—'}${m.unit?'<span style="font-size:10px;color:var(--muted);"> '+escHtml(m.unit)+'</span>':''}</div>
            ${diff!=null?`<div style="font-size:10px;color:${color};">${parseFloat(diff)>0?'+':''}${diff}</div>`:''}
          </div>`;
        }).join('')}
      </div>`:`<div style="font-size:12px;color:var(--muted);padding:8px 0;">Brak pomiarów w tej grupie — dodaj pierwszy.</div>`}
    </div>`:''}

    <div style="margin-top:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div class="cp-section-title" style="margin:0;">HISTORIA — ${activeGroup?escHtml(activeGroup.name):''}</div>
        <span style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${geAll.length} wpisów</span>
      </div>
      ${!geAll.length
        ?`<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px;">Brak historii. <button type="button" class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="openMetricEntryForClient('${c.id}','${activeGid}')">+ Dodaj pomiar</button></div>`
        :`<div style="display:flex;flex-direction:column;gap:6px;">
          ${geAll.map(e=>{
            const vals=(activeGroup.metrics||[]).map(m=>e.values[m.id]!=null?`<span style="font-size:11px;"><span style="color:var(--muted);">${escHtml(m.name)}:</span> <strong>${e.values[m.id]}</strong>${m.unit?' '+escHtml(m.unit):''}</span>`:'').filter(Boolean).join(' · ');
            return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);margin-bottom:4px;">${escHtml(e.date)}${e.source==='garmin'?' · ⌚ Garmin':''}</div>
                <div style="font-size:12px;line-height:1.5;">${vals||'—'}</div>
                ${e.notes?`<div style="font-size:10px;color:var(--muted);margin-top:4px;">${escHtml(e.notes)}</div>`:''}
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                <button type="button" class="btn btn-ghost btn-sm" onclick="editMetricEntry('${e.id}')" title="Edytuj">✎</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="if(confirm('Usunąć ten pomiar?'))delMetricEntry('${e.id}')" title="Usuń" style="color:var(--red);">×</button>
              </div>
            </div>`;
          }).join('')}
        </div>`}
    </div>
    <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:16px;line-height:1.5;">
      Rekordy siłowe i tonaż → <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('progress')">Progress</button>
      · Pełne wykresy: <button type="button" class="btn btn-ghost btn-sm" onclick="goTo('metrics');setTimeout(()=>{const s=document.getElementById('metric-client-sel');const q=document.getElementById('metric-client-sel-search');if(s)s.value='${c.id}';if(q)q.value='${safeName}';if(typeof metricClientSetField==='function')metricClientSetField('${c.id}','${safeName}');if(typeof setMetricGroup==='function')setMetricGroup('${activeGid}');},200);closeClientProfile()">Pomiary →</button>
    </div>`;
}
function setCPMetricGroup(clientId,groupId){
  window._cpMetricGroup=groupId;
  const c=(window.CL||[]).find(x=>x.id===clientId);
  if(c)renderCPMetrics(c);
}
window.setCPMetricGroup=setCPMetricGroup;
window.renderCPMetrics=renderCPMetrics;

/** Tygodniowy tonaż / sesje / serie — wspólne dla Progress (trener) i portalu. */
function clientWeeklyVolumeStats(clientId,weeks){
  if(typeof capWeeklyVolume==='function')return capWeeklyVolume(clientId,weeks||8);
  const logged=typeof completedWorkouts==='function'?completedWorkouts(clientId):(window.SE||[]).filter(s=>s.clientId===clientId&&(s.source==='live'||s.source==='client'||(s.exercises||[]).length));
  const now=new Date();const buckets=[];
  const n=weeks||8;
  for(let i=n-1;i>=0;i--){
    const end=new Date(now);end.setDate(end.getDate()-i*7);
    const start=new Date(end);start.setDate(start.getDate()-6);
    const ds=start.toISOString().slice(0,10);const de=end.toISOString().slice(0,10);
    let vol=0,sessions=0,sets=0;
    logged.forEach(s=>{
      const d=s.date;if(!d||d<ds||d>de)return;
      sessions++;vol+=Number(s.volume)||0;
      sets+=typeof sessionSetsCount==='function'?sessionSetsCount(s):0;
    });
    buckets.push({l:'T'+(n-i),vol:Math.round(vol),sessions,sets});
  }
  return buckets;
}
window.clientWeeklyVolumeStats=clientWeeklyVolumeStats;

function cpSortedMetricEntries(entries){
  return(entries||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
}
function cpMetricPoints(entries,key){
  return cpSortedMetricEntries(entries).map(e=>({d:e.date||'',v:parseFloat(e.values&&e.values[key])||0})).filter(p=>p.v>0);
}

function cpLineChartSVG(points,color,opts){
  const pts=(points||[]).filter(p=>p&&p.v>0);
  if(pts.length<2)return`<div style="font-size:11px;color:var(--muted);padding:24px 8px;text-align:center;">Potrzeba min. 2 pomiarów do wykresu</div>`;
  const W=(opts&&opts.w)||480;const H=(opts&&opts.h)||130;
  const pad={l:42,r:14,t:14,b:26};
  const iW=W-pad.l-pad.r;const iH=H-pad.t-pad.b;
  const minV=Math.min(...pts.map(p=>p.v))*0.98;
  const maxV=Math.max(...pts.map(p=>p.v))*1.02;
  const range=maxV-minV||1;
  const col=color||'var(--accent)';
  const uid='cp'+String(col).replace(/[^a-z0-9]/gi,'')+pts.length;
  const xs=pts.map((_,i)=>pad.l+(i/(pts.length-1||1))*iW);
  const ys=pts.map(p=>pad.t+iH-(((p.v-minV)/range)*iH));
  const path='M'+xs.map((x,i)=>x+','+ys[i]).join('L');
  const area=path+' L'+xs[xs.length-1]+','+(pad.t+iH)+' L'+xs[0]+','+(pad.t+iH)+' Z';
  const unit=(opts&&opts.unit)||'';
  const yLabels=[minV,minV+range*0.5,maxV].map(v=>`<text x="${pad.l-6}" y="${pad.t+iH-(((v-minV)/range)*iH)+4}" font-size="9" fill="var(--muted)" text-anchor="end">${v.toFixed(1)}</text>`).join('');
  const xStep=Math.max(1,Math.floor(pts.length/4));
  const xLabels=pts.map((p,i)=>(i===0||i===pts.length-1||i%xStep===0)?`<text x="${xs[i]}" y="${H-6}" font-size="8" fill="var(--muted)" text-anchor="middle">${escHtml(String(p.d||'').slice(5))}</text>`:'').join('');
  const dots=xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="4" fill="${col}" stroke="var(--bg)" stroke-width="1.5"><title>${escHtml(String(pts[i].d||''))}: ${pts[i].v}${unit?' '+unit:''}</title></circle>`).join('');
  return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cp-chart-svg" style="width:100%;display:block;">
    <defs><linearGradient id="${uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.28"/><stop offset="100%" stop-color="${col}" stop-opacity="0.02"/></linearGradient></defs>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+iH}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t+iH}" x2="${pad.l+iW}" y2="${pad.t+iH}" stroke="var(--border)" stroke-width="1"/>
    ${yLabels}${xLabels}
    <path d="${area}" fill="url(#${uid})"/>
    <path d="${path}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

function cpNormalizedTrendChart(series,opts){
  const norm=(series||[]).map(s=>{
    const pts=(s.points||[]).filter(p=>p.v>0);
    if(pts.length<2)return null;
    const base=pts[0].v||1;
    return{label:s.label,color:s.color,points:pts.map(p=>({d:p.d,v:Math.round(((p.v-base)/base)*1000)/10}))};
  }).filter(Boolean);
  if(!norm.length)return'';
  const W=(opts&&opts.w)||480;const H=(opts&&opts.h)||100;
  const pad={l:42,r:14,t:14,b:26};
  const iW=W-pad.l-pad.r;const iH=H-pad.t-pad.b;
  const allPts=norm.flatMap(s=>s.points);
  const minV=Math.min(...allPts.map(p=>p.v),-5);
  const maxV=Math.max(...allPts.map(p=>p.v),5);
  const range=maxV-minV||1;
  const maxLen=Math.max(...norm.map(s=>s.points.length));
  let svg='';
  norm.forEach(s=>{
    const pts=s.points;
    const xs=pts.map((_,i)=>pad.l+(i/(maxLen-1||1))*iW);
    const ys=pts.map(p=>pad.t+iH-(((p.v-minV)/range)*iH));
    const path='M'+xs.map((x,i)=>x+','+ys[i]).join('L');
    svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  const zeroY=pad.t+iH-(((0-minV)/range)*iH);
  const legend=norm.map(s=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);margin-right:10px;"><span style="width:12px;height:2px;background:${s.color};"></span>${escHtml(s.label)}</span>`).join('');
  return`<div style="font-size:9px;color:var(--muted);margin-bottom:4px;">Zmiana % od pierwszego pomiaru</div>
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cp-chart-svg" style="width:100%;display:block;">
    <line x1="${pad.l}" y1="${zeroY}" x2="${pad.l+iW}" y2="${zeroY}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,3"/>
    ${svg}
  </svg><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">${legend}</div>`;
}

function cpMultiLineChartSVG(series,opts){
  const valid=(series||[]).filter(s=>(s.points||[]).filter(p=>p.v>0).length>=2);
  if(!valid.length)return`<div style="font-size:11px;color:var(--muted);padding:24px 8px;text-align:center;">Potrzeba min. 2 pomiarów do wykresu</div>`;
  const W=(opts&&opts.w)||480;const H=(opts&&opts.h)||130;
  const pad={l:42,r:14,t:14,b:26};
  const iW=W-pad.l-pad.r;const iH=H-pad.t-pad.b;
  const allPts=valid.flatMap(s=>s.points.filter(p=>p.v>0));
  const minV=Math.min(...allPts.map(p=>p.v))*0.98;
  const maxV=Math.max(...allPts.map(p=>p.v))*1.02;
  const range=maxV-minV||1;
  const maxLen=Math.max(...valid.map(s=>s.points.filter(p=>p.v>0).length));
  let svg='';
  valid.forEach(s=>{
    const pts=s.points.filter(p=>p.v>0);
    const xs=pts.map((_,i)=>pad.l+(i/(maxLen-1||1))*iW);
    const ys=pts.map(p=>pad.t+iH-(((p.v-minV)/range)*iH));
    const path='M'+xs.map((x,i)=>x+','+ys[i]).join('L');
    svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
    svg+=xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="3.5" fill="${s.color}" stroke="var(--bg)" stroke-width="1.5"><title>${escHtml(s.label)}: ${pts[i].v}</title></circle>`).join('');
  });
  const yLabels=[minV,minV+range*0.5,maxV].map(v=>`<text x="${pad.l-6}" y="${pad.t+iH-(((v-minV)/range)*iH)+4}" font-size="9" fill="var(--muted)" text-anchor="end">${v.toFixed(1)}</text>`).join('');
  const legend=valid.map(s=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);margin-right:12px;"><span style="width:14px;height:2px;background:${s.color};border-radius:1px;"></span>${escHtml(s.label)}</span>`).join('');
  return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cp-chart-svg" style="width:100%;display:block;">
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+iH}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t+iH}" x2="${pad.l+iW}" y2="${pad.t+iH}" stroke="var(--border)" stroke-width="1"/>
    ${yLabels}${svg}
  </svg><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">${legend}</div>`;
}

function cpWeeklyDualChart(weeks){
  const rows=weeks||[];
  if(!rows.length)return'';
  const maxVol=Math.max(...rows.map(w=>w.vol),1);
  const maxSess=Math.max(...rows.map(w=>w.sessions),1);
  const W=480,H=150,pad=28;
  const n=rows.length;
  const slot=(W-pad*2)/n;
  const bW=Math.max(6,Math.floor(slot*0.38));
  let bars='';
  rows.forEach((w,i)=>{
    const x=pad+i*slot+(slot-bW)/2;
    const vH=Math.round((w.vol/maxVol)*(H-pad-18));
    const sH=Math.round((w.sessions/maxSess)*(H-pad-18)*0.55);
    bars+=`<rect x="${x}" y="${H-pad-vH}" width="${bW}" height="${vH}" rx="4" fill="var(--accent)" opacity="${w.vol?0.88:0.15}"/>`;
    bars+=`<rect x="${x+bW+2}" y="${H-pad-sH}" width="${Math.max(4,bW-4)}" height="${sH}" rx="3" fill="var(--blue)" opacity="${w.sessions?0.85:0.15}"/>`;
    if(w.vol)bars+=`<text x="${x+bW/2}" y="${H-pad-vH-4}" text-anchor="middle" font-size="7" fill="var(--accent)" font-family="'DM Mono',monospace">${w.vol>=1000?Math.round(w.vol/100)/10+'k':w.vol}</text>`;
    bars+=`<text x="${x+slot/2}" y="${H-6}" text-anchor="middle" font-size="8" fill="var(--muted)">${escHtml(w.l)}</text>`;
  });
  return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cp-chart-svg" style="width:100%;display:block;">${bars}</svg>
  <div style="display:flex;gap:14px;margin-top:6px;">
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);"><span style="width:12px;height:8px;border-radius:2px;background:var(--accent);"></span>Tonaż kg</span>
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);"><span style="width:12px;height:8px;border-radius:2px;background:var(--blue);"></span>Sesje</span>
  </div>`;
}

function cpRatingTrendChart(sessions){
  const rated=(sessions||[]).filter(s=>s.date&&Number(s.feedback)>=1&&Number(s.feedback)<=5)
    .sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(-12);
  if(rated.length<2)return`<div style="font-size:11px;color:var(--muted);padding:24px 8px;text-align:center;">Brak ocen sesji</div>`;
  return cpLineChartSVG(rated.map(s=>({d:s.date,v:Number(s.feedback)})),'var(--teal)',{w:340,h:120,unit:'/5'});
}

function cpHorizontalBars(items){
  const rows=(items||[]).filter(i=>i.v>0);
  if(!rows.length)return`<div style="font-size:11px;color:var(--muted);padding:12px 0;">Brak danych</div>`;
  const max=Math.max(...rows.map(i=>i.v),1);
  return`<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
    ${rows.map(b=>`<div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
        <span style="color:var(--muted);">${escHtml(b.label)}</span>
        <span style="color:${b.col||'var(--accent)'};font-weight:700;font-family:'DM Mono',monospace;">${b.v}${b.unit?` ${escHtml(b.unit)}`:''}</span>
      </div>
      <div style="height:8px;background:var(--s3);border-radius:99px;overflow:hidden;">
        <div style="height:100%;background:${b.col||'var(--accent)'};width:${Math.round(b.v/max*100)}%;border-radius:99px;transition:width .4s;"></div>
      </div>
    </div>`).join('')}
  </div>`;
}

function cpPrBarChart(prs){
  const rows=(prs||[]).slice(0,8).map(p=>{
    const est=typeof roundToPlate==='function'?roundToPlate(p.epley):Math.round(p.epley||0);
    return{label:p.name,v:est||0,col:'var(--accent)',unit:'kg 1RM'};
  }).filter(r=>r.v>0);
  if(!rows.length)return`<div style="font-size:12px;color:var(--muted);padding:8px 0;">Brak rekordów — pojawią się po zapisanych seriach.</div>`;
  return cpHorizontalBars(rows);
}

/** Adherencja treningowa: ukończone / zaplanowane w oknie dni. */
function cpClientAdherence(clientId,days){
  const n=days==null?30:days;
  const sessions=(window.SE||[]).filter(s=>s&&s.clientId===clientId&&s.date);
  const today=new Date();today.setHours(12,0,0,0);
  const inPast=s=>{
    const d=new Date(s.date+'T12:00:00');
    if(isNaN(d))return false;
    const diff=(today-d)/86400000;
    return diff>=0&&diff<=n;
  };
  const assigned=sessions.filter(inPast);
  const logged=(typeof completedWorkouts==='function'?completedWorkouts(clientId,sessions):assigned.filter(s=>s.source==='client'||s.source==='live'||(s.exercises||[]).length)).filter(inPast);
  const pct=assigned.length?Math.round((logged.length/assigned.length)*100):(logged.length?100:0);
  return{assigned:assigned.length,logged:logged.length,pct:Math.min(100,pct)};
}
window.cpClientAdherence=cpClientAdherence;

function cpCheckinTrendPoints(clientId){
  const list=((window.CHECKINS&&window.CHECKINS[clientId])||[]).filter(x=>x&&x.status==='filled'&&x.answers);
  return list.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).slice(-12)
    .map(x=>({d:x.date||'',v:typeof scoreCheckinAnswers==='function'?scoreCheckinAnswers(x.answers):(Number(x.score)||0)}))
    .filter(p=>p.v>0);
}
window.cpCheckinTrendPoints=cpCheckinTrendPoints;

/** Tygodniowa adherencja nawyków (% odhaczeń). */
function cpHabitAdherenceWeekly(clientId,weeks){
  const n=weeks||8;
  const habits=(window.TASKS||[]).filter(t=>t&&t.clientId===clientId&&typeof isHabit==='function'&&isHabit(t));
  const today=new Date();today.setHours(12,0,0,0);
  const out=[];
  for(let i=n-1;i>=0;i--){
    let due=0,done=0;
    for(let d=0;d<7;d++){
      const day=new Date(today);
      day.setDate(today.getDate()-(i*7+(6-d)));
      const ymd=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
      habits.forEach(h=>{due++;if(typeof habitDoneOn==='function'&&habitDoneOn(h,ymd))done++;});
    }
    out.push({l:'T'+(n-i),pct:due?Math.round((done/due)*100):0,done,due});
  }
  return out;
}
window.cpHabitAdherenceWeekly=cpHabitAdherenceWeekly;

function cpPctBarChart(rows,opts){
  const list=rows||[];
  if(!list.length)return`<div style="font-size:11px;color:var(--muted);padding:20px 8px;text-align:center;">Brak danych</div>`;
  const W=(opts&&opts.w)||480,H=(opts&&opts.h)||120,pad=28;
  const n=list.length;
  const slot=(W-pad*2)/n;
  const bW=Math.max(8,Math.floor(slot*0.55));
  const col=(opts&&opts.color)||'var(--teal)';
  let bars='';
  list.forEach((w,i)=>{
    const pct=Math.max(0,Math.min(100,Number(w.pct)||0));
    const x=pad+i*slot+(slot-bW)/2;
    const h=Math.round((pct/100)*(H-pad-16));
    bars+=`<rect x="${x}" y="${H-pad-h}" width="${bW}" height="${h}" rx="4" fill="${col}" opacity="${pct?0.9:0.2}"/>`;
    if(pct)bars+=`<text x="${x+bW/2}" y="${H-pad-h-4}" text-anchor="middle" font-size="8" fill="${col}" font-family="'DM Mono',monospace">${pct}%</text>`;
    bars+=`<text x="${x+slot/2}" y="${H-6}" text-anchor="middle" font-size="8" fill="var(--muted)">${escHtml(w.l||'')}</text>`;
  });
  return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cp-chart-svg" style="width:100%;display:block;">${bars}</svg>`;
}
window.cpPctBarChart=cpPctBarChart;

function setCPProgressPanel(panel){
  const p=panel||'all';
  window._cpProgressPanel=p;
  document.querySelectorAll('#cp-body [data-cp-panel]').forEach(el=>{
    const id=el.getAttribute('data-cp-panel');
    const show=p==='all'||id==='kpi'||id===p;
    el.classList.toggle('cp-panel-hidden',!show);
  });
  document.querySelectorAll('#cp-body [data-cp-panel-chip]').forEach(btn=>{
    btn.classList.toggle('active',btn.getAttribute('data-cp-panel-chip')===p);
  });
}
window.setCPProgressPanel=setCPProgressPanel;

function renderCPProgress(c){
  const logged=typeof completedWorkouts==='function'?completedWorkouts(c.id):(window.SE||[]).filter(s=>s.clientId===c.id&&(s.source==='live'||s.source==='client'||(s.exercises||[]).length));
  const prs=typeof clientExercisePRs==='function'?clientExercisePRs(c.id).slice(0,12):[];
  const volWeeks=clientWeeklyVolumeStats(c.id,8);
  const totalVol=logged.reduce((s,x)=>s+(Number(x.volume)||0),0);
  const totalSets=logged.reduce((s,x)=>s+(typeof sessionSetsCount==='function'?sessionSetsCount(x):0),0);
  const avg=typeof avgSessionRating==='function'?avgSessionRating(logged):0;
  const adh7=cpClientAdherence(c.id,7);
  const adh30=cpClientAdherence(c.id,30);
  const sess30=adh30.logged;
  const entries=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===c.id);
  const byG=(gid)=>entries.filter(e=>e.groupId===gid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const mass=byG('mg1');
  const circ=byG('mg2');
  const strength=byG('mg3');
  const lastM=mass[0],prevM=mass[1];
  const lastC=circ[0],prevC=circ[1];
  const lastS=strength[0];
  const delta=(a,b,k)=>{
    if(!a||!b||a.values==null||b.values==null||a.values[k]==null||b.values[k]==null)return null;
    return +(a.values[k]-b.values[k]).toFixed(1);
  };
  const deltaHtml=(d,goodDown)=>{
    if(d==null)return'';
    const good=goodDown?(d<=0):(d>=0);
    return `<span style="font-size:10px;color:${good?'var(--teal)':'var(--orange)'};">${d>0?'+':''}${d}</span>`;
  };
  const metricTile=(label,val,unit,d,goodDown)=>`<div style="background:var(--s3);border-radius:8px;padding:10px;text-align:center;">
    <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${escHtml(label)}</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1;">${val!=null?escHtml(String(val)):'—'}${unit?`<span style="font-size:11px;color:var(--muted);"> ${escHtml(unit)}</span>`:''}</div>
    ${deltaHtml(d,goodDown)}
  </div>`;

  const massAsc=cpSortedMetricEntries(mass);
  const circAsc=cpSortedMetricEntries(circ);
  const strengthAsc=cpSortedMetricEntries(strength);
  const massPts=cpMetricPoints(mass,'m1');
  const bfPts=cpMetricPoints(mass,'m2');
  const musclePts=cpMetricPoints(mass,'m3');
  const squatPts=cpMetricPoints(strength,'m1');
  const circBars=lastC?[
    {label:'Klatka',v:parseFloat(lastC.values.m1)||0,col:'var(--accent)',unit:'cm'},
    {label:'Talia',v:parseFloat(lastC.values.m2)||0,col:'var(--orange)',unit:'cm'},
    {label:'Biodra',v:parseFloat(lastC.values.m3)||0,col:'var(--purple)',unit:'cm'},
    {label:'Udo',v:parseFloat(lastC.values.m4)||0,col:'var(--blue)',unit:'cm'},
    {label:'Ramię',v:parseFloat(lastC.values.m5)||0,col:'var(--teal)',unit:'cm'},
  ]:[];
  const strengthBars=lastS?[
    {label:'Przysiad',v:parseFloat(lastS.values.m1)||0,col:'var(--accent)',unit:'kg'},
    {label:'Martwy',v:parseFloat(lastS.values.m2)||0,col:'var(--orange)',unit:'kg'},
    {label:'Wyciskanie',v:parseFloat(lastS.values.m3)||0,col:'var(--blue)',unit:'kg'},
    {label:'OHP',v:parseFloat(lastS.values.m4)||0,col:'var(--teal)',unit:'kg'},
  ]:[];

  const ciPts=cpCheckinTrendPoints(c.id);
  const ciAvg=ciPts.length?Math.round(ciPts.reduce((s,p)=>s+p.v,0)/ciPts.length):0;
  const habitWeeks=cpHabitAdherenceWeekly(c.id,8);
  const habits=(window.TASKS||[]).filter(t=>t&&t.clientId===c.id&&typeof isHabit==='function'&&isHabit(t));
  const todayY=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  const bestStreak=habits.length?Math.max(...habits.map(h=>typeof habitStreak==='function'?habitStreak(h,todayY):0),0):0;
  const habitPct7=habitWeeks.length?habitWeeks[habitWeeks.length-1].pct:0;
  const photosOn=typeof ppFeatureOn==='function'?ppFeatureOn(c):true;
  const photos=photosOn&&typeof ppListFor==='function'?ppListFor(c.id).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,6):[];
  const panel=window._cpProgressPanel||'all';
  const chip=(id,label)=>`<button type="button" class="cp-analytics-chip${panel===id?' active':''}" data-cp-panel-chip="${id}" onclick="setCPProgressPanel('${id}')">${label}</button>`;

  document.getElementById('cp-body').innerHTML=`
    <div style="margin-bottom:12px;">
      <div class="cp-section-title" style="margin:0;">ANALITYKA KLIENTA</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px;">Jeden panel: trening · ciało · check-in · nawyki · zdjęcia</div>
    </div>

    <div class="cp-analytics-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
      ${chip('all','Wszystko')}
      ${chip('train','Trening')}
      ${chip('body','Ciało')}
      ${chip('checkin','Check-in')}
      ${chip('habits','Nawyki')}
      ${chip('photos','Zdjęcia')}
    </div>

    <div data-cp-panel="kpi" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:${adh30.pct>=70?'var(--teal)':adh30.pct>=40?'var(--orange)':'var(--accent)'};">${adh30.pct}%</div><div class="cp-stat-lbl">Adherencja 30 dni</div><div style="font-size:9px;color:var(--muted);margin-top:2px;">${adh30.logged}/${adh30.assigned||'—'} · 7d ${adh7.pct}%</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--accent);">${sess30}</div><div class="cp-stat-lbl">Sesje 30 dni</div><div style="font-size:9px;color:var(--muted);margin-top:2px;">${Math.round(totalVol).toLocaleString('pl')} kg</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--blue);">${ciAvg||'—'}</div><div class="cp-stat-lbl">Check-in śr.</div><div style="font-size:9px;color:var(--muted);margin-top:2px;">${ciPts.length?ciPts.length+' raportów':'brak'}</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--teal);">${bestStreak||habitPct7||'—'}</div><div class="cp-stat-lbl">${bestStreak?'Streak nawyków':'Nawyki 7d'}</div><div style="font-size:9px;color:var(--muted);margin-top:2px;">${habits.length?habits.length+' aktywnych':(bestStreak?'dni':'brak nawyków')}${habitPct7?' · '+habitPct7+'%':''}</div></div>
    </div>

    <div data-cp-panel="train" style="display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">📊 Tonaż tygodniowy</div>
            <div class="stat-card-sub">Ostatnie 8 tygodni · tonaż vs liczba sesji</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);">${Math.round(totalVol).toLocaleString('pl')}<span style="font-size:12px;color:var(--muted);"> kg</span></div>
        </div>
        ${cpWeeklyDualChart(volWeeks)}
      </div>
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">⭐ Ocena sesji</div>
            <div class="stat-card-sub">Trend ostatnich treningów · śr. ${avg?avg+'/5':'—'}</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--teal);">${avg?avg+'/5':'—'}</div>
        </div>
        ${cpRatingTrendChart(logged)}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);">
          Serie łącznie: <strong style="color:var(--text);">${totalSets}</strong>
        </div>
      </div>
    </div>

    <div data-cp-panel="body" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">⚖️ Masa / skład ciała</div>
            <div class="stat-card-sub">${lastM?`Ostatni pomiar: ${escHtml(lastM.date||'')}`:'Brak pomiarów'}</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="window._cpMetricGroup='mg1';setCPTab('metrics')">Historia →</button>
        </div>
        ${massAsc.length>=2
          ?cpLineChartSVG(massPts,'var(--accent)',{unit:'kg'})
          :`<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Dodaj min. 2 pomiary masy, aby zobaczyć trend.</div>`}
        ${massAsc.length>=2?`<div style="margin-top:10px;">${cpNormalizedTrendChart([
          {label:'Masa',color:'var(--accent)',points:massPts},
          {label:'%BF',color:'var(--orange)',points:bfPts},
          {label:'Mięśnie',color:'var(--teal)',points:musclePts},
        ],{h:95})}</div>`:''}
        ${lastM?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px;">
          ${metricTile('Masa',lastM.values.m1,'kg',delta(lastM,prevM,'m1'),true)}
          ${metricTile('%BF',lastM.values.m2,'%',delta(lastM,prevM,'m2'),true)}
          ${metricTile('Mięśnie',lastM.values.m3,'kg',delta(lastM,prevM,'m3'),false)}
          ${metricTile('BMI',lastM.values.m4,'',delta(lastM,prevM,'m4'),true)}
        </div>`
        :`<div style="font-size:12px;color:var(--muted);">Brak pomiarów — dodaj w <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('metrics')">Pomiary</button></div>`}
      </div>

      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">📏 Obwody ciała</div>
            <div class="stat-card-sub">${lastC?`Ostatni: ${escHtml(lastC.date||'')}`:'Brak obwodów'}</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="window._cpMetricGroup='mg2';setCPTab('metrics')">Historia →</button>
        </div>
        ${circAsc.length>=2?`<div style="margin-bottom:12px;">${cpMultiLineChartSVG([
          {label:'Klatka',color:'var(--accent)',points:cpMetricPoints(circ,'m1')},
          {label:'Talia',color:'var(--orange)',points:cpMetricPoints(circ,'m2')},
          {label:'Udo',color:'var(--blue)',points:cpMetricPoints(circ,'m4')},
        ],{h:110})}</div>`:''}
        ${circBars.length?cpHorizontalBars(circBars):`<div style="font-size:12px;color:var(--muted);">Brak obwodów.</div>`}
      </div>
    </div>

    <div data-cp-panel="train" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      ${lastS||strengthAsc.length>=2?`<div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">💪 Siła bazowa (1RM)</div>
            <div class="stat-card-sub">Z pomiarów · ${lastS?escHtml(lastS.date||''):''}</div>
          </div>
        </div>
        ${squatPts.length>=2?`<div style="margin-bottom:12px;">${cpLineChartSVG(squatPts,'var(--accent)',{h:100,unit:'kg'})}<div style="font-size:9px;color:var(--muted);margin-top:4px;">Trend przysiadu</div></div>`:''}
        ${strengthBars.length?cpHorizontalBars(strengthBars):''}
      </div>`:''}

      <div class="stat-card"${lastS||strengthAsc.length>=2?'':' style="grid-column:1/-1;"'}>
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">🏆 Rekordy z treningów</div>
            <div class="stat-card-sub">Live / apka · szac. 1RM</div>
          </div>
        </div>
        ${cpPrBarChart(prs)}
        ${prs.length?`<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px;">
          ${prs.slice(0,6).map(p=>{
            const est=typeof roundToPlate==='function'?roundToPlate(p.epley):Math.round(p.epley);
            return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">
              <div><span style="font-weight:600;">${escHtml(p.name)}</span>
              <span style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;margin-left:6px;">${escHtml(p.date||'')}</span></div>
              <div style="font-weight:700;color:var(--accent);white-space:nowrap;">${escHtml(typeof formatSetLoad==='function'?formatSetLoad(p.kg,p.reps):(p.kg+' × '+p.reps))}${est?' · ~'+est+' kg':''}</div>
            </div>`;
          }).join('')}
        </div>`:''}
      </div>
    </div>

    <div data-cp-panel="checkin" style="display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px;">
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">📝 Samopoczucie (check-in)</div>
            <div class="stat-card-sub">Energia · sen · stres · odżywianie · ostatnie ${ciPts.length||0} raportów</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--blue);">${ciAvg||'—'}</div>
        </div>
        ${ciPts.length>=2?cpLineChartSVG(ciPts,'var(--blue)',{h:120,unit:'/100'})
          :`<div style="font-size:12px;color:var(--muted);padding:16px 0;">Za mało wypełnionych check-inów do wykresu — pojawią się po 2+ raportach klienta.</div>`}
      </div>
    </div>

    <div data-cp-panel="habits" style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">✅ Adherencja nawyków</div>
            <div class="stat-card-sub">% odhaczeń tygodniowo · ${habits.length} aktywnych</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--teal);">${habitPct7}%</div>
        </div>
        ${habits.length?cpPctBarChart(habitWeeks,{color:'var(--teal)',h:120})
          :`<div style="font-size:12px;color:var(--muted);padding:16px 0;">Brak nawyków — dodaj w zakładce Zadania.</div>`}
      </div>
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">🔥 Streaki</div>
            <div class="stat-card-sub">Najdłuższe serie</div>
          </div>
        </div>
        ${habits.length?`<div style="display:flex;flex-direction:column;gap:8px;">
          ${habits.slice().sort((a,b)=>(typeof habitStreak==='function'?habitStreak(b,todayY):0)-(typeof habitStreak==='function'?habitStreak(a,todayY):0)).slice(0,6).map(h=>{
            const st=typeof habitStreak==='function'?habitStreak(h,todayY):0;
            return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:var(--s3);border-radius:8px;">
              <span style="font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(h.title||'Nawyk')}</span>
              <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--teal);flex-shrink:0;">${st}d</span>
            </div>`;
          }).join('')}
        </div>`:`<div style="font-size:12px;color:var(--muted);">Brak streaków.</div>`}
      </div>
    </div>

    <div data-cp-panel="photos" class="stat-card" style="margin-bottom:8px;">
      <div class="stat-card-hdr">
        <div>
          <div class="stat-card-title">📷 Zdjęcia postępów</div>
          <div class="stat-card-sub">${photos.length?photos.length+' ostatnich':'Brak zdjęć'}</div>
        </div>
      </div>
      ${photos.length?`<div class="cp-analytics-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
        ${photos.map(ph=>{
          const src=ph.url||ph.dataUrl||ph.thumb||'';
          const when=escHtml(String(ph.date||ph.createdAt||'').slice(0,10));
          return `<div style="background:var(--s3);border-radius:10px;overflow:hidden;border:1px solid var(--border);">
            ${src?`<img src="${escHtml(src)}" alt="" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;">`:`<div style="aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:20px;">📷</div>`}
            <div style="padding:6px 8px;font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">${when||'—'}</div>
          </div>`;
        }).join('')}
      </div>`:`<div style="font-size:12px;color:var(--muted);padding:8px 0;">Klient jeszcze nie dodał zdjęć postępów.</div>`}
    </div>
  `;
  setCPProgressPanel(panel);
}
window.renderCPProgress=renderCPProgress;

function renderCPTasks(c){
  const tasks=TASKS.filter(t=>t.clientId===c.id);
  const isHw=typeof isHomework==='function'?isHomework:()=>false;
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().split('T')[0];
  const oneShot=tasks.filter(t=>typeof isOneShot==='function'?isOneShot(t):!isHabit(t)&&!isHw(t));
  const homework=tasks.filter(t=>isHw(t));
  const habits=tasks.filter(t=>isHabit(t));
  const chs=tasks.filter(t=>typeof isChallenge==='function'&&isChallenge(t));
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <div class="cp-section-title" style="margin:0;">ZADANIA (${tasks.length})</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="typeof openHomeworkPickerForClient==='function'&&openHomeworkPickerForClient('${c.id}')">🏡 Trening domowy</button>
        <button class="btn btn-primary btn-sm" onclick="openM('m-task');taskSetClientField('${c.id}','${(c.name||'').replace(/'/g,"\\'")}')">+ Zadanie</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
      <div class="cp-stat-box" style="flex:1;min-width:70px;"><div class="cp-stat-val" style="color:var(--blue);font-size:22px;">${homework.filter(t=>t.status!=='done').length}</div><div class="cp-stat-lbl">Domowe</div></div>
      <div class="cp-stat-box" style="flex:1;min-width:70px;"><div class="cp-stat-val" style="color:var(--accent);font-size:22px;">${oneShot.filter(t=>t.status!=='done').length}</div><div class="cp-stat-lbl">Aktywne</div></div>
      <div class="cp-stat-box" style="flex:1;min-width:70px;"><div class="cp-stat-val" style="color:var(--purple);font-size:22px;">${habits.length}</div><div class="cp-stat-lbl">Nawyki</div></div>
      <div class="cp-stat-box" style="flex:1;min-width:70px;"><div class="cp-stat-val" style="color:var(--gold);font-size:22px;">${chs.length}</div><div class="cp-stat-lbl">Wyzwania</div></div>
    </div>
    ${homework.length?`<div class="cp-section-title">ZADANIA DOMOWE</div>
      ${homework.map(t=>{
        const w=(typeof allODWorkouts==='function'?allODWorkouts():[]).find(x=>x.id===t.odWorkoutId);
        const done=t.status==='done';
        const struct=w&&typeof odWorkoutStructureText==='function'?odWorkoutStructureText(w):'';
        return `<div style="background:var(--s2);border:1px solid ${done?'rgba(62,207,178,0.35)':'var(--border2)'};border-radius:10px;padding:12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:700;">${escHtml(t.title)}${done?' <span style="color:var(--teal);">✓</span>':''}</div>
              ${struct?`<div style="font-size:10px;color:var(--muted);margin-top:4px;">${escHtml(struct)}</div>`:''}
              ${t.due?`<div style="font-size:10px;color:var(--muted);margin-top:2px;">Termin: ${escHtml(t.due)}</div>`:''}
            </div>
            ${!done?`<div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn btn-ghost btn-sm" type="button" onclick="remindHomework('${escHtml(t.id)}')">Przypomnij</button>
              ${w?`<button class="btn btn-ghost btn-sm" type="button" onclick="openAssignHomeworkModal('${escHtml(w.id)}','${escHtml(c.id)}')">↻</button>`:''}
            </div>`:''}
          </div>
        </div>`;
      }).join('')}`:''}
    ${!tasks.length?'<div style="text-align:center;padding:30px;color:var(--muted);">Brak zadań dla tego klienta</div>'
    :tasks.filter(t=>!isHw(t)).sort((a,b)=>{
      const rank=t=>isHw(t)?0:isHabit(t)?1:(typeof isChallenge==='function'&&isChallenge(t)?2:3);
      return rank(a)-rank(b)||(a.due||'9999').localeCompare(b.due||'9999');
    }).map(t=>{
      const hw=isHw(t);
      const habit=isHabit(t);
      const ch=typeof isChallenge==='function'&&isChallenge(t);
      const one=typeof isOneShot==='function'?isOneShot(t):!habit&&!ch&&!hw;
      const doneToday=(habit||ch)&&habitDoneOn(t,today);
      const streak=habit?habitStreak(t,today):0;
      const isDone=one&&t.status==='done';
      const isOverdue=one&&!isDone&&t.due&&t.due<today;
      const catCol=TASK_CAT_COLORS[t.cat]||'var(--muted)';
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);">
        <div class="task-check${isDone||doneToday?' checked':''}" onclick="toggleTask('${t.id}');renderCPTasks(CL.find(x=>x.id==='${c.id}'))">${isDone||doneToday?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div style="flex:1;${isDone?'opacity:0.5;text-decoration:line-through;':''}cursor:pointer;" onclick="editTask('${t.id}')">
          <div style="font-size:12px;font-weight:600;">${t.title}</div>
          <div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;align-items:center;">
            ${hw?`<span class="pill" style="background:rgba(0,85,164,0.18);color:var(--blue);font-size:9px;">🏡 Domowe</span>`:''}
            ${habit?`<span class="pill" style="background:rgba(157,124,244,0.18);color:var(--purple);font-size:9px;">🔥 Nawyk</span>`:''}
            ${ch?`<span class="pill" style="background:rgba(201,162,39,0.18);color:var(--gold);font-size:9px;">🏆 Wyzwanie</span>`:''}
            ${t.cat?`<span class="pill" style="background:${catCol}22;color:${catCol};font-size:9px;">${TASK_CAT_LABELS[t.cat]||t.cat}</span>`:''}
            ${habit&&streak?`<span class="habit-streak">🔥 ${streak}</span>`:''}
            ${ch&&typeof challengeStatusText==='function'?`<span style="font-size:10px;color:var(--gold);">${challengeStatusText(t,today)}</span>`:''}
            ${one&&t.due?`<span style="font-size:10px;color:${isOverdue?'var(--red)':'var(--muted)'};font-family:'DM Mono',monospace;">${isOverdue?'⚠ ':''} ${t.due}</span>`:''}
          </div>
          ${habit?habitWeekHtml(t,today):''}
          ${ch&&typeof challengeBarHtml==='function'?challengeBarHtml(t,today):''}
        </div>
      </div>`;
    }).join('')}
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;" onclick="openTaskTemplates()">📋 Użyj szablonu</button>`;
}

function renderCPPayments(c){
  const pkgs=allPackages().filter(p=>p.clientId===c.id||p.clientName===c.name);
  const total=pkgs.filter(p=>p.payStatus==='paid').reduce((s,p)=>s+p.price,0);
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div class="cp-section-title" style="margin:0;">PAKIETY I PŁATNOŚCI</div>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('pkg-client').value='${c.id}';openM('m-package')">+ Pakiet</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--accent);font-size:22px;">${total.toLocaleString('pl')} zł</div><div class="cp-stat-lbl">Łącznie zapłacono</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--blue);font-size:22px;">${pkgs.length}</div><div class="cp-stat-lbl">Pakietów</div></div>
    </div>
    ${!pkgs.length?'<div style="text-align:center;padding:30px;color:var(--muted);">Brak pakietów</div>'
    :pkgs.map(p=>{
      const pct=Math.round(p.sessionsUsed/p.sessions*100);
      const col=PKG_TYPE_COLOR[p.type]||'var(--accent)';
      const isExpired=p.expiresDate&&p.expiresDate<today;
      return `<div class="card-sm" style="margin-bottom:8px;border-left:3px solid ${col};">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <div style="font-size:12px;font-weight:600;">${p.title}</div>
          <div style="font-weight:700;color:${col};">${p.price.toLocaleString('pl')} zł</div>
        </div>
        <div class="pkg-progress" style="margin:6px 0;"><div class="pkg-progress-fill" style="width:${pct}%;background:${col};"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);">
          <span>${p.sessionsUsed}/${p.sessions} sesji</span>
          <span class="pill ${PAY_STATUS_PILL[isExpired?'expired':p.payStatus]||'pill-muted'}" style="font-size:9px;">${PAY_STATUS_LABEL[isExpired?'expired':p.payStatus]||p.payStatus}</span>
        </div>
        ${p.invoiceId?`<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;" onclick="viewInvoice('${p.invoiceId}')">🧾 Faktura ${p.invoiceId}</button>`:''}
        <div style="display:flex;gap:6px;margin-top:6px;">
          ${p.payStatus==='pending'?`<button class="btn btn-primary btn-sm" style="flex:1;" onclick="markPaid('${p.id}')">Opłacony</button>
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="requestPayment('${p.id}')">${p.paymentRequestedAt?'Wyślij ponownie':'Poproś o wpłatę'}</button>`:''}
        </div>
        ${p.payStatus==='pending'&&p.paymentRequestedAt?`<div style="font-size:10px;color:var(--orange);margin-top:6px;">Prośba wysłana ${escHtml(String(p.paymentRequestedAt).slice(0,10))} — klient widzi dane w apce.</div>`:''}
      </div>`;
    }).join('')}`;
}


// ══════════════════════════════════════════════════════
// CP — TRAINING (kalendarz 2-tygodniowy)
// ══════════════════════════════════════════════════════
function renderCPTraining(c){
  if(!c._mpView)c._mpView='2w';
  if(!c._mpTab)c._mpTab='assignment';

  const sessions=SE.filter(s=>s.clientId===c.id);
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];
  const logged=typeof completedWorkouts==='function'?completedWorkouts(c.id,sessions):sessions.filter(s=>s.source==='client'||s.source==='live');
  const avgRate=typeof avgSessionRating==='function'?avgSessionRating(logged):0;

  // Statystyki — zrobione treningi, nie same wpisy w kalendarzu
  const last7=logged.filter(s=>{const d=new Date(s.date);return(today-d)/86400000<=7;}).length;
  const last30=logged.filter(s=>{const d=new Date(s.date);return(today-d)/86400000<=30;}).length;

  // Oblicz zakres kalendarza
  const getMonday=(d)=>{const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()-(day===0?6:day-1));dt.setHours(0,0,0,0);return dt;};
  const mon=getMonday(today);
  const weeks=c._mpView==='1w'?1:c._mpView==='2w'?2:4;
  const totalDays=weeks*7;
  const days=Array.from({length:totalDays},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});

  const dayNamesShort=['Pon','Wt','Śr','Czw','Pt','Sob','Nie'];
  const MONTHS_PL=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

  // Zakres dat header
  const rangeStart=days[0];
  const rangeEnd=days[days.length-1];
  const rangeLabel=rangeStart.getDate()+' '+MONTHS_PL[rangeStart.getMonth()]+' – '+rangeEnd.getDate()+' '+MONTHS_PL[rangeEnd.getMonth()];

  // Historia sesji
  const historyHTML=sessions.length
    ?sessions.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,15).map(s=>{
      const exCount=(s.exercises||[]).length;
      const emoji=typeof sessionRatingEmoji==='function'?sessionRatingEmoji(s.feedback):'';
      const src=typeof sessionSourceLabel==='function'?sessionSourceLabel(s):(s.type||'sesja');
      const typeCol=s.source==='client'?'var(--teal)':s.source==='live'?'var(--orange)':'var(--accent)';
      const title=typeof sessionTitle==='function'?sessionTitle(s):(s.type||s.title||'Sesja');
      return `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="editSession('${s.id}')">
        <div style="width:38px;height:38px;border-radius:10px;background:${typeCol}18;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${emoji||'💪'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${escHtml(title)}</div>
          <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;">${escHtml(s.date||'')}${s.duration?' · '+s.duration+' min':''}${exCount?' · '+exCount+' ćw.':''}${s.feedback?' · '+s.feedback+'/5':''}</div>
        </div>
        <span style="background:${typeCol}18;color:${typeCol};border-radius:4px;padding:2px 8px;font-size:10px;font-family:'DM Mono',monospace;font-weight:700;text-transform:uppercase;">${escHtml(src)}</span>
      </div>`;
    }).join('')
    :'<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Brak historii sesji</div>';

  // Siatka kalendarza
  const calGrid=days.map((d,i)=>{
    const ds=d.toISOString().split('T')[0];
    const isToday=ds===todayStr;
    const isPast=d<today&&!isToday;
    const sessDay=sessions.filter(s=>s.date===ds);
    const dayName=dayNamesShort[d.getDay()===0?6:d.getDay()-1];
    const sessCards=sessDay.map(s=>{
      const exCount=(s.exercises||[]).length;
      const title=typeof sessionTitle==='function'?sessionTitle(s):(s.type||s.title||'Sesja');
      const typeLabel=typeof sessionSourceLabel==='function'?sessionSourceLabel(s):(s.type||'REGULAR');
      const typeCol=s.source==='client'?'var(--teal)':s.source==='live'?'var(--orange)':'var(--accent)';
      const emoji=typeof sessionRatingEmoji==='function'?sessionRatingEmoji(s.feedback):'';
      return `<div style="background:${typeCol}15;border:1px solid ${typeCol}40;border-radius:6px;padding:5px 6px;margin-top:4px;cursor:pointer;" onclick="event.stopPropagation();editSession('${s.id}')">
        <div style="font-size:10px;font-weight:700;color:${typeCol};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeEscSnippet(String(title).toUpperCase(),18)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
          <span style="background:${typeCol}25;color:${typeCol};border-radius:3px;padding:1px 4px;font-size:9px;font-family:'DM Mono',monospace;">${safeEscSnippet(String(typeLabel).toUpperCase(),8)}</span>
          <span style="font-size:9px;color:var(--muted);">${emoji||''}${exCount?` ⚡ ${exCount}`:''}</span>
        </div>
        ${s.duration?`<div style="font-size:9px;color:var(--muted);margin-top:2px;">⏱ ${s.duration} min</div>`:''}
      </div>`;
    }).join('');

    return `<div style="border:1px solid ${isToday?'var(--accent)':isPast?'var(--border)':'var(--border)'};border-radius:8px;padding:7px;min-height:90px;background:${isToday?'rgba(230,0,0,0.04)':isPast?'rgba(0,0,0,0.1)':'var(--s2)'};cursor:pointer;transition:border-color 0.12s;" onclick="openAddSessionFromCP('${c.id}','${ds}')" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='${isToday?'var(--accent)':isPast?'var(--border)':'var(--border)'}'">
      <div style="font-size:10px;color:${isToday?'var(--accent)':'var(--muted)'};font-family:'DM Mono',monospace;font-weight:${isToday?700:400};">${dayName} ${d.getDate()}</div>
      ${sessCards}
      ${!sessDay.length?`<div style="margin-top:10px;text-align:center;font-size:16px;color:var(--border2);opacity:0.6;">+</div>`:''}
    </div>`;
  });

  // Tydzień 2: podziel na wiersze po 7
  let gridRows='';
  for(let w=0;w<weeks;w++){
    const weekDays=calGrid.slice(w*7,(w+1)*7);
    gridRows+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;">${weekDays.join('')}</div>`;
  }

  document.getElementById('cp-body').innerHTML=`
    <!-- Statystyki -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
      <div style="background:var(--s3);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:30px;color:var(--accent);">${last7}</div>
        <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">Ostatnie 7 dni</div>
      </div>
      <div style="background:var(--s3);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:30px;color:var(--blue);">${last30}</div>
        <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">Ostatnie 30 dni</div>
      </div>
      <div style="background:var(--s3);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:30px;color:var(--teal);">${logged.length}</div>
        <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">Zrobione${avgRate?' · śr. '+avgRate+'/5':''}</div>
      </div>
    </div>

    <!-- Nagłówek Master Planner -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <!-- Tabs: Assignment / History -->
      <div style="display:flex;gap:2px;background:var(--s3);border:1px solid var(--border2);border-radius:8px;padding:2px;">
        <button onclick="cpMpTab('${c.id}','assignment')" style="padding:5px 14px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:${c._mpTab==='assignment'?'var(--accent)':'none'};color:${c._mpTab==='assignment'?'#000':'var(--muted)'};">Assignment</button>
        <button onclick="cpMpTab('${c.id}','history')" style="padding:5px 14px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:${c._mpTab==='history'?'var(--accent)':'none'};color:${c._mpTab==='history'?'#000':'var(--muted)'};">History</button>
      </div>
      <!-- Zakres dat -->
      <div style="font-size:12px;color:var(--muted);padding:0 4px;">📅 ${rangeLabel}</div>
      <!-- Przycisk + Sesja -->
      <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="openAddSessionFromCP('${c.id}','${todayStr}')">+ Sesja</button>
      <!-- Widok: 1W / 2W / 4W -->
      <div style="display:flex;gap:2px;background:var(--s3);border:1px solid var(--border2);border-radius:8px;padding:2px;">
        <button onclick="cpMpView('${c.id}','1w')" style="padding:4px 10px;border-radius:6px;border:none;font-size:11px;font-weight:600;cursor:pointer;background:${c._mpView==='1w'?'var(--s1)':'none'};color:${c._mpView==='1w'?'var(--text)':'var(--muted)'};">1 Tydzień</button>
        <button onclick="cpMpView('${c.id}','2w')" style="padding:4px 10px;border-radius:6px;border:none;font-size:11px;font-weight:600;cursor:pointer;background:${c._mpView==='2w'?'var(--s1)':'none'};color:${c._mpView==='2w'?'var(--text)':'var(--muted)'};">2 Tygodnie</button>
        <button onclick="cpMpView('${c.id}','4w')" style="padding:4px 10px;border-radius:6px;border:none;font-size:11px;font-weight:600;cursor:pointer;background:${c._mpView==='4w'?'var(--s1)':'none'};color:${c._mpView==='4w'?'var(--text)':'var(--muted)'};">4 Tygodnie</button>
      </div>
    </div>

    <!-- Nagłówki dni -->
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;">
      ${dayNamesShort.map(n=>`<div style="text-align:center;font-size:10px;color:var(--muted);font-weight:600;font-family:'DM Mono',monospace;text-transform:uppercase;">${n}</div>`).join('')}
    </div>

    <!-- Siatka kalendarza / Historia -->
    <div id="cp-mp-content">
      ${c._mpTab==='assignment'?gridRows:historyHTML}
    </div>`;
}

function cpMpView(clientId, view){
  const c=CL.find(x=>x.id===clientId);
  if(!c)return;
  c._mpView=view;
  renderCPTraining(c);
}
function cpMpTab(clientId, tab){
  const c=CL.find(x=>x.id===clientId);
  if(!c)return;
  c._mpTab=tab;
  renderCPTraining(c);
}
window.cpMpView=cpMpView;
window.cpMpTab=cpMpTab;

function openAddSessionFromCP(clientId,date){
  openM('m-session');
  setTimeout(()=>{
    const c=CL.find(x=>x.id===clientId);
    if(typeof asSetClientField==='function')asSetClientField(clientId,c?c.name:'');
    const sd=document.getElementById('as-date');if(sd)sd.value=date||new Date().toISOString().split('T')[0];
  },50);
}

function renderCPNotes(c){
  const notes=CLIENT_NOTES[c.id]||[];
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="cp-section-title" style="margin:0;">NOTATKI (${notes.length})</div>
      <button onclick="addClientNote('${c.id}')" class="btn btn-primary btn-sm">+ Dodaj notatkę</button>
    </div>
    <div id="cp-notes-area">
      ${notes.map((n,ni)=>`<div class="cip-note" style="position:relative;padding-right:24px;margin-bottom:8px;"><div>${n.text}</div><div class="cip-note-date">${n.date}</div><button onclick="deleteClientNote('${c.id}',${ni})" style="position:absolute;top:4px;right:4px;background:none;border:none;color:var(--muted2);font-size:14px;cursor:pointer;line-height:1;">×</button></div>`).join('')}
      ${!notes.length?'<div style="text-align:center;padding:40px;color:var(--muted);">Brak notatek — dodaj pierwszą obserwację z treningu</div>':''}
      <div id="note-input-${c.id}" style="display:none;margin-top:12px;">
        <textarea id="note-text-${c.id}" rows="3" style="width:100%;background:var(--s4);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;resize:none;font-family:'DM Sans',sans-serif;"></textarea>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button onclick="saveClientNote('${c.id}')" class="btn btn-primary btn-sm" style="flex:1;">Zapisz</button>
          <button onclick="document.getElementById('note-input-${c.id}').style.display='none'" class="btn btn-ghost btn-sm">Anuluj</button>
        </div>
      </div>
    </div>`;
}
window.renderCPNotes=renderCPNotes;

// ══════════════════════════════════════════════════════
// CP — FOOD JOURNAL (stub — zakładka ukryta; brak persistencji i apki klienta)
// ══════════════════════════════════════════════════════
window.CLIENT_FOOD = window.CLIENT_FOOD || {};
function renderCPFood(c){
  document.getElementById('cp-body').innerHTML=`
    <div class="cp-section-title">ŻYWIENIE</div>
    <div style="text-align:center;padding:48px 20px;background:var(--s3);border-radius:12px;border:1px dashed var(--border2);">
      <div style="font-size:36px;margin-bottom:10px;opacity:0.5;">🥗</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Dziennik żywieniowy w przygotowaniu</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.55;max-width:360px;margin:0 auto 14px;">
        Ta zakładka była tylko stubem (wpisy w pamięci, bez zapisu i bez widoku w apce klienta). Wróci, gdy będzie prawdziwy dziennik + zdjęcia posiłków.
      </div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('overview')">← Wróć do przeglądu</button>
    </div>`;
}
function addFoodEntry(){
  if(typeof notify==='function')notify('Dziennik żywieniowy jest w przygotowaniu');
}
function viewFoodEntry(){
  if(typeof notify==='function')notify('Dziennik żywieniowy jest w przygotowaniu');
}

// ══════════════════════════════════════════════════════
// CP — DOCUMENTS
// ══════════════════════════════════════════════════════
window.CLIENT_DOCS = window.CLIENT_DOCS || {};
function renderCPDocuments(c){
  if(!window.CLIENT_DOCS[c.id])window.CLIENT_DOCS[c.id]=[];
  const docs=window.CLIENT_DOCS[c.id];
  const typeIcon={pdf:'📄',image:'🖼️',video:'🎬',other:'📁'};
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="cp-section-title" style="margin:0;">DOKUMENTY (${docs.length})</div>
      <button class="btn btn-primary btn-sm" onclick="addClientDoc('${c.id}')">+ Notatka / nazwa</button>
    </div>
    <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:12px;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;">
      Lista nazw dokumentów trenera (zapis w bazie). <b>Upload plików i widok w apce klienta — w przygotowaniu.</b> Ankiety wysyłaj z Formularzy (apką lub PDF).
    </div>
    ${!docs.length?`<div style="text-align:center;padding:40px 20px;background:var(--s3);border-radius:12px;border:1px dashed var(--border2);">
      <div style="font-size:40px;margin-bottom:12px;">📂</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Brak wpisów</div>
      <div style="font-size:11px;color:var(--muted);">Dodaj nazwę dokumentu / notatkę dla siebie (bez pliku).</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:14px;" onclick="addClientDoc('${c.id}')">+ Dodaj nazwę</button>
    </div>`:
    docs.map(d=>`
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--s3);border-radius:10px;margin-bottom:8px;">
        <div style="width:40px;height:40px;border-radius:8px;background:var(--s4);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${typeIcon[d.type]||'📁'}</div>
        <div style="flex:1;overflow:hidden;">
          <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(d.name||'')}</div>
          <div style="font-size:10px;color:var(--muted);">${escHtml(d.date||'')}${d.size&&d.size!=='—'?' · '+escHtml(d.size):''}</div>
          ${d.note?`<div style="font-size:10px;color:var(--muted2);font-style:italic;">${escHtml(d.note)}</div>`:''}
        </div>
        <button type="button" onclick="delClientDoc('${escHtml(c.id)}','${escHtml(d.id)}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:4px;" title="Usuń">🗑</button>
      </div>`).join('')}`;
}
function addClientDoc(clientId){
  const name=prompt('Nazwa / opis dokumentu (bez uploadu pliku):');if(!name)return;
  const type=name.endsWith('.pdf')?'pdf':name.match(/\.(jpg|png|jpeg)/i)?'image':'other';
  const note=prompt('Notatka (opcjonalne):','')||'';
  if(!window.CLIENT_DOCS[clientId])window.CLIENT_DOCS[clientId]=[];
  const docItem=withTrainer({
    id:newId('doc'),clientId,name,type,note,
    date:new Date().toISOString().split('T')[0],
    size:'—',
    createdAt:new Date().toISOString()
  });
  window.CLIENT_DOCS[clientId].push(docItem);
  persistById('clientDocs',docItem);
  const c=CL.find(x=>x.id===clientId);if(c)renderCPDocuments(c);
}
function delClientDoc(clientId,docId){
  if(!confirm('Usunąć dokument?'))return;
  window.CLIENT_DOCS[clientId]=(window.CLIENT_DOCS[clientId]||[]).filter(x=>x.id!==docId);
  if(window._db){try{window._del(window._doc(window._db,'clientDocs',docId));}catch(e){}}
  const c=CL.find(x=>x.id===clientId);if(c)renderCPDocuments(c);
}

// ══════════════════════════════════════════════════════
// CP — SETTINGS (ustawienia per klient jak w Everfit)
// ══════════════════════════════════════════════════════
function toggleClientFeature(clientId,feature,tab){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  if(!c.clientSettings)c.clientSettings={};
  const defaults={training:true,tasks:true,messages:true,progressPhoto:true,bodyMetrics:true};
  const cur=c.clientSettings[feature]!==undefined?!!c.clientSettings[feature]:!!defaults[feature];
  c.clientSettings[feature]=!cur;
  persistById('clients',c);
  if(tab)setCPTab(tab);
  else renderCPSettings(c);
  notify(feature+' '+(c.clientSettings[feature]?'włączone':'wyłączone'));
}
function renderCPSettings(c){
  if(!c.clientSettings)c.clientSettings={};
  const s=c.clientSettings;
  // Tylko funkcje faktycznie respektowane w apce (progressPhoto, bodyMetrics).
  // foodJournal / macros / mealPlan usunięte — były stubami bez implementacji.
  const feat=[
    {key:'progressPhoto',label:'Zdjęcia postępu',desc:'Klient może dodawać zdjęcia sylwetki w Progress',icon:'📸',default:true},
    {key:'bodyMetrics',label:'Pomiary ciała',desc:'Masa, obwody i Garmin w Progress klienta (treningi zostają)',icon:'📏',default:true},
  ];
  const coming=[
    {icon:'🥗',label:'Dziennik żywieniowy',desc:'W przygotowaniu — nie włączamy przełącznika, żeby nie obiecywać funkcji'},
    {icon:'📎',label:'Upload dokumentów',desc:'W przygotowaniu — dziś tylko lista nazw u trenera'},
  ];
  const toggle=(key,defaultVal)=>{
    const on=s[key]!==undefined?s[key]:defaultVal;
    return `<div onclick="toggleClientFeature('${c.id}','${key}','features')" style="width:40px;height:22px;border-radius:11px;background:${on?'var(--accent)':'var(--s4)'};cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0;">
      <div style="width:16px;height:16px;border-radius:50%;background:${on?'#0a0a0a':'var(--muted)'};position:absolute;top:3px;left:${on?'21px':'3px'};transition:left 0.2s;"></div>
    </div>`;
  };
  document.getElementById('cp-body').innerHTML=`
    <div class="cp-section-title">FUNKCJE W APLIKACJI KLIENTA</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px;">Przełączniki tylko dla funkcji, które realnie działają. Reszta nawigacji klienta: Ustawienia → Aplikacja klienta.</div>
    ${feat.map(f=>{
      const on=s[f.key]!==undefined?s[f.key]:f.default;
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="width:36px;height:36px;border-radius:10px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${f.icon}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:${on?'var(--text)':'var(--muted)'};">${f.label}</div>
          <div style="font-size:11px;color:var(--muted);">${f.desc}</div>
        </div>
        ${toggle(f.key,f.default)}
      </div>`;
    }).join('')}
    <div style="margin-top:18px;" class="cp-section-title">W PRZYGOTOWANIU</div>
    ${coming.map(f=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);opacity:0.75;">
      <div style="width:36px;height:36px;border-radius:10px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${f.icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--muted);">${f.label}</div>
        <div style="font-size:11px;color:var(--muted);">${f.desc}</div>
      </div>
      <span class="pill pill-muted" style="font-size:9px;">WKRÓTCE</span>
    </div>`).join('')}

    <div style="margin-top:20px;" class="cp-section-title">USTAWIENIA JEDNOSTEK</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Waga</div>
        <select class="form-select" style="font-size:12px;" onchange="updateClientUnit('${c.id}','weightUnit',this.value)">
          <option value="kg" ${(s.weightUnit||'kg')==='kg'?'selected':''}>kg</option>
          <option value="lbs" ${s.weightUnit==='lbs'?'selected':''}>lbs</option>
        </select>
      </div>
      <div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Wymiary</div>
        <select class="form-select" style="font-size:12px;" onchange="updateClientUnit('${c.id}','dimUnit',this.value)">
          <option value="cm" ${(s.dimUnit||'cm')==='cm'?'selected':''}>cm</option>
          <option value="in" ${s.dimUnit==='in'?'selected':''}>inch</option>
        </select>
      </div>
    </div>

    <div class="cp-section-title">STREFA CZASOWA</div>
    <select class="form-select" style="font-size:12px;margin-bottom:16px;" onchange="updateClientUnit('${c.id}','timezone',this.value)">
      ${['Europe/Warsaw','Europe/London','America/New_York','America/Chicago','America/Los_Angeles','Asia/Tokyo','Australia/Sydney']
        .map(tz=>`<option value="${tz}" ${(s.timezone||'Europe/Warsaw')===tz?'selected':''}>${tz.replace('_',' ')}</option>`).join('')}
    </select>

    <button class="btn btn-danger btn-sm" style="width:100%;margin-bottom:8px;" onclick="archiveClient('${c.id}')">🗃 Zarchiwizuj klienta</button>
    <button class="btn btn-ghost btn-sm" style="width:100%;color:var(--red);" onclick="deleteClientPermanently('${c.id}')">🗑 Usuń klienta na zawsze</button>`;
}
function updateClientUnit(clientId,key,value){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  if(!c.clientSettings)c.clientSettings={};
  c.clientSettings[key]=value;
  persistById('clients',c);
  notify('Zapisano');
}


