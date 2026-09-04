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
      age: c.age||'', gender: (typeof normalizeClientGender==='function'?normalizeClientGender(c.gender):c.gender)||'M',
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
  return `<div class="cp-edit-card" id="cp-edit-card">
    <div class="cp-edit-card-hdr">
      <div>
        <div class="cp-edit-card-title">Dane osobowe</div>
        <div class="cp-edit-card-sub">Imię i nazwisko, telefon, e-mail, waga, wzrost, sport — dopisz lub popraw</div>
      </div>
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
    ${field('cpe-name','Imię i nazwisko',`<input class="cp-edit-field form-input" id="cpe-name" autocomplete="name" placeholder="np. Jan Kowalski" value="${escHtml(c.name||'')}">`)}
    <div class="form-grid">
      ${field('cpe-email','Email',`<input class="cp-edit-field form-input" id="cpe-email" type="email" value="${escHtml(c.email||'')}">`)}
      ${field('cpe-phone','Telefon',`<input class="cp-edit-field form-input" id="cpe-phone" type="tel" placeholder="+48 123 456 789" value="${escHtml(c.phone||'')}">`)}
    </div>
    <div class="form-grid">
      ${field('cpe-age','Wiek',`<input type="number" class="cp-edit-field form-input" id="cpe-age" value="${c.age||''}">`)}
      ${field('cpe-gender','Płeć',`<select class="form-select" id="cpe-gender">
          <option value="M" ${((typeof normalizeClientGender==='function'?normalizeClientGender(c.gender):c.gender)||'M')==='M'?'selected':''}>Mężczyzna</option>
          <option value="K" ${((typeof normalizeClientGender==='function'?normalizeClientGender(c.gender):c.gender)||'M')==='K'?'selected':''}>Kobieta</option>
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
  const id=clientId||(typeof cpClientId!=='undefined'?cpClientId:window.cpClientId);
  if(!id)return;
  window._cpEditingClientId=id;
  const alreadyOpen=typeof cpClientId!=='undefined'&&cpClientId===id;
  if(!alreadyOpen&&typeof openClientProfile==='function'){
    openClientProfile(id);
    window._cpEditingClientId=id;
  }
  const c=CL.find(x=>x.id===id);
  if(!c)return;
  if(typeof setCPTab==='function')setCPTab('overview');
  else if(typeof renderCPOverview==='function')renderCPOverview(c);
  requestAnimationFrame(()=>{
    const card=document.getElementById('cp-edit-card')||document.querySelector('.cp-edit-card');
    if(card&&card.scrollIntoView)card.scrollIntoView({behavior:'smooth',block:'start'});
    const nameEl=document.getElementById('cpe-name');
    if(nameEl){
      nameEl.focus();
      try{const n=nameEl.value.length;nameEl.setSelectionRange(n,n);}catch(e){}
    }
  });
}
function cancelCPEdit(){
  window._cpEditingClientId=null;
  const c=CL.find(x=>x.id===cpClientId);
  if(c&&typeof renderCPOverview==='function')renderCPOverview(c);
}
window.startCPEdit=startCPEdit;
window.cancelCPEdit=cancelCPEdit;

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

function cpDaysSinceYmd(raw){
  const s=String(raw||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return 999;
  const t=new Date(s+'T12:00:00').getTime();
  if(!t||isNaN(t))return 999;
  return Math.max(0,Math.floor((Date.now()-t)/86400000));
}

/** Zielony = wpis ≤2 dni; żółty = 3–6 dni; czerwony = ≥7 dni lub brak. */
function cpClientPulseStatus(clientId){
  const filled=((window.CHECKINS&&window.CHECKINS[clientId])||[]).filter(x=>x&&x.status==='filled');
  const lastFilled=filled.slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
  const logged=typeof completedWorkouts==='function'?completedWorkouts(clientId):(window.SE||[]).filter(s=>s&&s.clientId===clientId&&(s.source==='live'||s.source==='client'));
  const lastLog=logged.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const dates=[];
  if(lastFilled)dates.push(lastFilled.date||lastFilled.createdAt);
  if(lastLog)dates.push(lastLog.date);
  if(!dates.length)return{tone:'bad',label:'Brak wpisów',days:null,hint:'Brak raportu i odhaczonego treningu'};
  const days=Math.min(...dates.map(cpDaysSinceYmd));
  if(days<=2)return{tone:'good',label:'Na czas',days,hint:'Ostatni wpis '+days+' d. temu'};
  if(days<=6)return{tone:'warn',label:'Brak raportu',days,hint:'Brak wpisu od '+days+' dni'};
  return{tone:'bad',label:'Cichy tydzień',days,hint:'Brak wpisów od '+days+' dni'};
}
window.cpClientPulseStatus=cpClientPulseStatus;

function cpLatestPhysique(clientId){
  const list=typeof ppListFor==='function'?ppListFor(clientId):[];
  const latest=list.length?list[list.length-1]:null;
  if(!latest)return null;
  const photos=latest.photos||{};
  return{
    date:latest.date||'',
    weight:latest.weight||'',
    front:photos.front||latest.front||'',
    side:photos.side||latest.side||'',
    back:photos.back||latest.back||''
  };
}
window.cpLatestPhysique=cpLatestPhysique;

function cpGarminWeekAvg(clientId){
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  const from=(()=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
  const entries=(window.METRIC_ENTRIES||[]).filter(e=>e&&e.clientId===clientId&&e.groupId==='mg6'&&e.date>=from&&e.date<=today);
  if(!entries.length)return{n:0,steps:null,kcal:null,hr:null};
  const byDay={};
  entries.forEach(e=>{
    const day=e.date;
    if(!byDay[day])byDay[day]={steps:0,kcal:0,hrSum:0,hrN:0};
    const v=e.values||{};
    const st=parseFloat(v.m1);if(isFinite(st)&&st>0)byDay[day].steps+=st;
    const kcal=parseFloat(v.m2);if(isFinite(kcal)&&kcal>0)byDay[day].kcal+=kcal;
    const hr=parseFloat(v.m3);if(isFinite(hr)&&hr>0){byDay[day].hrSum+=hr;byDay[day].hrN++;}
  });
  const days=Object.keys(byDay);
  const n=days.length;
  const avgDays=(pick)=>{
    const vals=days.map(pick).filter(v=>v>0);
    if(!vals.length)return null;
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  };
  return{
    n,
    steps:avgDays(d=>byDay[d].steps),
    kcal:avgDays(d=>byDay[d].kcal),
    hr:avgDays(d=>byDay[d].hrN?byDay[d].hrSum/byDay[d].hrN:0)
  };
}
window.cpGarminWeekAvg=cpGarminWeekAvg;

function cpTrainIconRow(done,assigned){
  const a=Math.max(0,Number(assigned)||0);
  const d=Math.max(0,Math.min(Number(done)||0,a||Number(done)||0));
  if(!a&&!d)return'<div class="cp-ov-ico-row"><span class="cp-ov-ico empty">—</span></div>';
  const n=Math.min(Math.max(a,d),14);
  let html='';
  for(let i=0;i<n;i++){
    html+=i<d?'<span class="cp-ov-ico done" title="Odhaczone">✓</span>':'<span class="cp-ov-ico plan" title="Zaplanowany">⏱</span>';
  }
  if(a>14)html+='<span class="cp-ov-ico-more">+'+escHtml(String(a-14))+'</span>';
  return'<div class="cp-ov-ico-row">'+html+'</div>';
}
window.cpTrainIconRow=cpTrainIconRow;

function cpRemindClient(clientId,kind){
  const c=(window.CL||[]).find(x=>x.id===clientId);
  if(!c){if(typeof notify==='function')notify('Nie znaleziono klienta');return false;}
  const text=kind==='onboard'
    ?'👋 Przypomnienie: dokończ start współpracy w aplikacji (pomiary / plan / kalendarz).'
    :(kind==='workout'
      ?'💪 Przypomnienie o treningu — odhacz sesję w aplikacji, gdy zrobisz.'
      :'💬 Krótki check-in od trenera — daj znać, jak idzie.');
  if(typeof pushMsg==='function')pushMsg(clientId,text);
  if(typeof notify==='function')notify('✓ Wiadomość poszła do czatu klienta');
  return true;
}
window.cpRemindClient=cpRemindClient;

function cpCollapseDaySessions(sessDay){
  const groups=[];
  const byKey={};
  (sessDay||[]).forEach(s=>{
    const title=typeof sessionTitle==='function'?sessionTitle(s):(s.type||s.title||'Sesja');
    const key=String(title).toLowerCase().trim();
    if(!byKey[key]){
      byKey[key]={title,items:[],happened:false,s};
      groups.push(byKey[key]);
    }
    byKey[key].items.push(s);
    if(typeof sessionHappened==='function'&&sessionHappened(s))byKey[key].happened=true;
  });
  return{groups,shown:groups.slice(0,2),extra:Math.max(0,groups.length-2),total:(sessDay||[]).length};
}
window.cpCollapseDaySessions=cpCollapseDaySessions;

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
  const pulse=typeof cpClientPulseStatus==='function'?cpClientPulseStatus(c.id):{tone:'good',label:'',hint:''};
  const physique=photosOn&&typeof cpLatestPhysique==='function'?cpLatestPhysique(c.id):null;
  const garmin7=metricsOn&&typeof cpGarminWeekAvg==='function'?cpGarminWeekAvg(c.id):{n:0};
  const lastCheck=(((window.CHECKINS&&window.CHECKINS[c.id])||[]).filter(x=>x&&x.status==='filled').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0])||null;
  const checkScore=lastCheck&&typeof scoreCheckinAnswers==='function'?scoreCheckinAnswers(lastCheck.answers):(lastCheck&&lastCheck.score)||null;
  const poseSrc=(p,key)=>{
    if(!p)return'';
    const photosObj=p.photos||{};
    return photosObj[key]||p[key]||'';
  };

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
    <div class="cp-ov-pulse cp-ov-pulse-${escHtml(pulse.tone||'good')}">
      <span class="cp-ov-pulse-dot" aria-hidden="true"></span>
      <div>
        <div class="cp-ov-pulse-label">${escHtml(pulse.label||'Status')}</div>
        <div class="cp-ov-pulse-hint">${escHtml(pulse.hint||'')}</div>
      </div>
    </div>

    ${editing?'':`<div class="cp-ov-edit-cta" role="button" tabindex="0" onclick="startCPEdit('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();startCPEdit('${c.id}')}">
      <div>
        <div class="cp-ov-edit-cta-title">Dane osobowe</div>
        <div class="cp-ov-edit-cta-sub">Imię i nazwisko, telefon, e-mail, waga, wzrost, sport — kliknij, aby dopisać lub poprawić</div>
      </div>
      <span class="cp-ov-edit-cta-go">✏️ Edytuj dane</span>
    </div>`}
    ${editing?cpClientDataEditHTML(c):''}

    ${(()=>{const ob=typeof getClientOnboard==='function'?getClientOnboard(c):null;
      if(!ob||ob.complete)return'';
      return `<div style="background:rgba(201,123,63,0.1);border:1px solid rgba(201,123,63,0.35);border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:700;margin-bottom:2px;">Start współpracy ${ob.done}/${ob.total}</div>
          <div style="font-size:11px;color:var(--muted);">${!ob.invite?'Brak zaproszenia. ':''}${!ob.baseline?'Brak pomiarów. ':''}${!ob.schedule?'Brak dni treningowych. ':''}${!ob.plan?'Brak planu. ':''}${!ob.calendar&&!ob.session?'Brak w kalendarzu. ':''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();cpRemindClient('${c.id}','onboard')">Przypomnij</button>
          <button class="btn btn-primary btn-sm" onclick="openClientOnboardChecklist('${c.id}')">Dokończ</button>
        </div>
      </div>`;
    })()}

    ${(()=>{
      const w=c.weight||(typeof clientLatestMetricWeight==='function'?clientLatestMetricWeight(c.id):null);
      const bmi=typeof clientBmiStatus==='function'?clientBmiStatus(w,c.height):null;
      const mon=typeof buildMonitorVerdict==='function'?buildMonitorVerdict(c):null;
      if(!bmi&&!mon)return'';
      const tone=mon?(mon.verdictTone||'neutral'):(bmi&&bmi.overweight?'warn':'ok');
      const dir=mon?(mon.verdict==='progres'?'Dobra strona':(mon.verdict==='regres'?'Zła strona':mon.verdict)):'';
      const tips=(bmi&&bmi.overweight?(bmi.tips||[]).slice(0,3):[]).concat((mon&&mon.next||[]).slice(0,2));
      if(!tips.length&&!(bmi&&bmi.overweight)&&!(mon&&(mon.verdict==='regres'||mon.verdict==='ryzyko stagnacji')))return'';
      return `<div class="cp-bmi-banner cp-bmi-${tone}">
        <div>
          <div class="cp-bmi-k">Asystent trenera · ${bmi&&bmi.overweight?escHtml(bmi.label)+(bmi.bmi?' · BMI '+bmi.bmi:''):'Strażnik postępów'}${dir?' · '+escHtml(dir):''}</div>
          <ul class="cp-bmi-tips">${tips.slice(0,4).map(t=>`<li>${escHtml(t)}</li>`).join('')}</ul>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="openClientMonitorSummary('${c.id}')">Monitoring</button>
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

    <div class="cp-ov-card" style="margin-bottom:16px;">
      <div class="cp-ov-card-hd">
        <div class="cp-ov-card-title">Podsumowania klienta</div>
      </div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px;">Start: plan + ankieta + makro. Monitoring: werdykt progres / regres z wskazówkami „co dalej”.</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button type="button" class="btn btn-primary btn-sm" onclick="openClientOnboardSummary('${c.id}')">Podsumowanie start</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="openClientMonitorSummary('${c.id}')">Monitoring progresu</button>
      </div>
    </div>

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
              ${cpTrainIconRow(last7,assigned7)}
              <div class="cp-ov-stat-lbl">Ostatnie 7 dni</div>
              <div class="cp-ov-stat-sub">${assigned7?last7+' ✓ · '+(assigned7-last7)+' ⏱':(last7?last7+' zarejestrowane':'Brak treningów')}</div>
            </div>
            <div>
              ${cpTrainIconRow(last30,assigned30)}
              <div class="cp-ov-stat-lbl">Ostatnie 30 dni</div>
              <div class="cp-ov-stat-sub">${assigned30?last30+' ✓ · '+(assigned30-last30)+' ⏱':(logged.length+' łącznie · '+tasksDone.length+'/'+oneShot.length+' zadań')}</div>
            </div>
            <div>
              ${cpTrainIconRow(0,nextWeekAssigned)}
              <div class="cp-ov-stat-lbl">Następny tydzień</div>
              <div class="cp-ov-stat-sub">${nextWeekAssigned?nextWeekAssigned+' zaplanowane':'Jeszcze nie przypisano'}</div>
            </div>
          </div>
          ${lastWorkout?`<div class="cp-ov-last-wo" onclick="setCPTab('training')">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Ostatni trening</div>
            <div style="font-size:14px;font-weight:700;">${escHtml(lastWorkoutTitle)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(lastWorkout.date||'')}${lastWorkoutDays!=null?' · '+lastWorkoutDays+' dni temu':''}${lastWorkout.feedback?' · '+lastWorkout.feedback+'/5':''}</div>
          </div>`:`<div class="cp-ov-last-wo muted">Brak zarejestrowanych treningów — klient jeszcze nic nie odhaczył.</div>`}
          ${(assigned7&&last7===0)||(pulse.tone!=='good')?`<div style="margin-top:10px;position:relative;z-index:1;"><button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();cpRemindClient('${c.id}','workout')">Przypomnij o treningu</button></div>`:''}
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

        <div class="cp-ov-card" style="cursor:pointer;" onclick="setCPTab('photos')">
          <div class="cp-ov-card-hd">
            <div class="cp-ov-card-title">Aktualna sylwetka</div>
            <span style="font-size:11px;color:var(--muted);">${physique&&(physique.weight||weightVal)?escHtml(String(physique.weight||weightVal))+' kg':'Zdjęcia →'}</span>
          </div>
          ${photosOn?(physique&&(physique.front||physique.side||physique.back)?`<div class="cp-ov-physique">
            ${[['front','Przód'],['side','Bok'],['back','Tył']].map(([k,lab])=>{
              const src=physique[k];
              return `<figure class="cp-ov-physique-cell">${src?`<img src="${escHtml(src)}" alt="${lab}">`:`<span>📷</span>`}<figcaption>${lab}</figcaption></figure>`;
            }).join('')}
          </div>
          <div class="cp-ov-rail-hint">${escHtml(physique.date||'')} · waga ${escHtml(String(physique.weight||weightVal||'—'))}${weightVal?' kg':''}</div>`
            :'<div style="font-size:12px;color:var(--muted);padding:8px 0;">Brak zdjęć sylwetki — klient doda je w Progress.</div>')
          :'<div style="font-size:12px;color:var(--muted);padding:8px 0;">Zdjęcia wyłączone w Funkcjach.</div>'}
        </div>

        <div class="cp-ov-card">
          <div class="cp-ov-card-hd">
            <div class="cp-ov-card-title">Samopoczucie (check-in)</div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('progress')">Progress →</button>
          </div>
          <div class="cp-ov-feel-grid">
            <div>
              <div class="cp-ov-metric-lbl">Ostatni raport</div>
              <div class="cp-ov-metric-val">${checkScore!=null?escHtml(String(checkScore)):'—'}${checkScore!=null?'<span class="cp-ov-metric-unit">/100</span>':''}</div>
              <div class="cp-ov-stat-sub">${lastCheck?escHtml(String(lastCheck.date||'').slice(0,10)):'Brak check-inu'}</div>
            </div>
            <div>
              <div class="cp-ov-metric-lbl">Garmin · 7 dni</div>
              <div class="cp-ov-garmin-avgs">
                <span>Kroki <b>${garmin7.steps!=null?escHtml(String(garmin7.steps)):'—'}</b></span>
                <span>HR <b>${garmin7.hr!=null?escHtml(String(garmin7.hr))+' bpm':'—'}</b></span>
                <span>kcal <b>${garmin7.kcal!=null?escHtml(String(garmin7.kcal)):'—'}</b></span>
              </div>
              <div class="cp-ov-stat-sub">${garmin7.n?garmin7.n+' dni z importu CSV':'Brak importu Garmin'}</div>
            </div>
          </div>
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
           <div class="cp-ov-rail-hint">Cel i poziom są w ankiecie — kliknij, aby otworzyć dane klienta</div>`,
          `startCPEdit('${c.id}')`)}

        ${railCard('Notatki',
          (notes.length?notes.slice(0,2).map(n=>`<div class="cip-note" style="margin-bottom:8px;"><div>${escHtml(n.text)}</div><div class="cip-note-date">${escHtml(n.date||'')}</div></div>`).join('')
            :'<div style="font-size:12px;color:var(--muted);">Brak notatek</div>')+
          '<div class="cp-ov-rail-hint">Otwórz zakładkę Notatki</div>',
          `setCPTab('notes')`)}

        ${railCard('Ograniczenia / kontuzje',
          (injuries?`<div style="font-size:12px;line-height:1.5;color:var(--text);">${escHtml(injuries)}</div>`
            :'<div style="font-size:12px;color:var(--muted);">Brak wpisanych ograniczeń</div>')+
          '<div class="cp-ov-rail-hint">Kontuzje z ankiety — kliknij, aby otworzyć dane i ankietę</div>',
          `startCPEdit('${c.id}')`)}

        ${photosOn?railCard('Zdjęcia postępu',
          (photos.length?`<div class="cp-ov-photos">${photos.map(p=>{
            const src=poseSrc(p,'front')||poseSrc(p,'side')||poseSrc(p,'back')||'';
            return `<div class="cp-ov-photo">${src?`<img src="${escHtml(src)}" alt="">`:`<span>📷</span>`}<div class="cp-ov-photo-d">${escHtml(p.date||'')}</div></div>`;
          }).join('')}</div>`
            :'<div style="font-size:12px;color:var(--muted);">Brak zdjęć</div>')+
          '<div class="cp-ov-rail-hint">Wszystkie zdjęcia w zakładce Zdjęcia</div>',
          `setCPTab('photos')`):''}

        ${railCard('Profil',
          `<div class="cp-ov-profile-rows">
            <div><span>Imię i nazwisko</span><b title="${escHtml(c.name||'')}">${escHtml(c.name||'—')}</b></div>
            <div><span>Email</span><b title="${escHtml(c.email||'')}">${escHtml(c.email||'—')}</b></div>
            <div><span>Telefon</span><b>${escHtml(c.phone||'—')}</b></div>
            <div><span>Wiek / wzrost</span><b>${c.age?c.age+' lat':'—'}${c.height?' · '+c.height+' cm':''}</b></div>
            <div><span>Status</span><b style="color:${c.status==='active'?'var(--teal)':c.status==='inactive'?'var(--orange)':'var(--muted)'};">${c.status==='active'?'Aktywny':c.status==='inactive'?'Nieaktywny':'Zarchiwizowany'}</b></div>
          </div>
          <div class="cp-ov-rail-hint">Kliknij: imię i nazwisko, telefon, waga, sport…</div>`,
          `startCPEdit('${c.id}')`)}
      </aside>
    </div>`;
}

function renderCPPlan(c){
  const plans=PL.filter(p=>p.clientId===c.id);
  const activePlan=typeof latestClientPlan==='function'?latestClientPlan(c.id):plans.slice(-1)[0]||null;
  const activeId=activePlan?activePlan.id:null;
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="cp-section-title" style="margin:0;">PLANY TRENINGOWE (${plans.length})</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" onclick="cpAssignTemplate('${c.id}')">📋 Przypisz szablon</button>
        <button class="btn btn-ghost btn-sm" onclick="openBuilderForClient('${c.id}')">✏ Stwórz własny plan</button>
        <button class="btn btn-primary btn-sm" onclick="goTo('aiplangen');document.getElementById('apl-client').value='${c.id}';aplFillFromClient();closeClientProfile()">⚡ Generuj plan AI</button>
      </div>
    </div>
    ${plans.length?`<div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:12px;padding:10px 12px;background:var(--s3);border:1px solid var(--border);border-radius:8px;">Nowy plan dodajesz przyciskami powyżej — trafia na listę, a <strong>najnowszy</strong> idzie do kalendarza. Stary usuń ×, jeśli nieaktualny.</div>`:''}
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
            <div style="display:flex;gap:5px;align-items:center;">
              ${p.id===activeId?`<span class="pill pill-teal" style="font-size:9px;">AKTYWNY</span>`:''}
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
    <div class="cp-metrics-head">
      <div class="cp-section-title" style="margin:0;">POMIARY</div>
      <div class="cp-metrics-groups">
        ${groups.map(g=>{
          const n=entries.filter(e=>e.groupId===g.id).length;
          const on=g.id===activeGid;
          return `<button type="button" class="cp-metrics-chip${on?' active':''}" onclick="setCPMetricGroup('${c.id}','${g.id}')">
            ${g.icon} ${g.name}${n?` <span>${n}</span>`:''}
          </button>`;
        }).join('')}
      </div>
      <div class="cp-metrics-actions">
        <button type="button" class="btn btn-primary btn-sm" onclick="openMetricEntryForClient('${c.id}','${activeGid}')">+ Nowy pomiar</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="typeof openClientBaselineModal==='function'&&openClientBaselineModal('${c.id}')">Baseline</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="setCPTab('progress')">📈 Progress</button>
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
      </div>`:`<div style="font-size:12px;color:var(--muted);padding:8px 0;">${activeGroup.id==='mg2'?'Brak obwodów centymetrem — dodaj szyję, klatkę, talię, biodra, ramiona, uda i łydki.':'Brak pomiarów w tej grupie — dodaj pierwszy.'}</div>`}
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
  const circBars=typeof circBarItems==='function'?circBarItems(lastC):(lastC?[
    {label:'Klatka',v:parseFloat(lastC.values.m1)||0,col:'var(--accent)',unit:'cm'},
    {label:'Talia',v:parseFloat(lastC.values.m2)||0,col:'var(--orange)',unit:'cm'},
    {label:'Biodra',v:parseFloat(lastC.values.m3)||0,col:'var(--purple)',unit:'cm'},
    {label:'Udo',v:parseFloat(lastC.values.m4)||0,col:'var(--blue)',unit:'cm'},
    {label:'Ramię',v:parseFloat(lastC.values.m5)||0,col:'var(--teal)',unit:'cm'},
  ]:[]);
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
  if(!c._mpView)c._mpView='1w';
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
      const title=typeof sessionTitle==='function'?sessionTitle(s):(s.type||s.title||'Sesja');
      const happened=typeof sessionHappened==='function'&&sessionHappened(s);
      const tip=typeof sessionHappenedTip==='function'?sessionHappenedTip(s):title;
      const typeCol=s.source==='client'?'var(--teal)':s.source==='live'?'var(--orange)':happened?'var(--teal)':'var(--accent)';
      return `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="editSession('${s.id}')" title="${escHtml(tip)}">
        <div style="width:38px;height:38px;border-radius:10px;background:${typeCol}18;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${happened?'✓':(emoji||'💪')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${happened?'✓ ':''}${escHtml(title)}</div>
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
    const collapsed=typeof cpCollapseDaySessions==='function'?cpCollapseDaySessions(sessDay):{shown:sessDay.map(s=>({title:s.type||'Sesja',items:[s],happened:false,s})),extra:0};
    const sessCards=collapsed.shown.map(g=>{
      const s=g.s||g.items[0];
      const exCount=(s.exercises||[]).length;
      const title=g.title||(typeof sessionTitle==='function'?sessionTitle(s):(s.type||s.title||'Sesja'));
      const typeLabel=typeof sessionSourceLabel==='function'?sessionSourceLabel(s):(s.type||'REGULAR');
      const happened=!!g.happened||(typeof sessionHappened==='function'&&sessionHappened(s));
      const tip=typeof sessionHappenedTip==='function'?sessionHappenedTip(s):title;
      const typeCol=s.source==='client'?'var(--teal)':s.source==='live'?'var(--orange)':happened?'var(--teal)':'var(--accent)';
      const emoji=typeof sessionRatingEmoji==='function'?sessionRatingEmoji(s.feedback):'';
      const n=g.items&&g.items.length>1?g.items.length:0;
      return `<div class="${happened?'cp-sess-done':''}" style="background:${typeCol}15;border:1px solid ${typeCol}40;border-radius:6px;padding:5px 6px;margin-top:4px;cursor:pointer;" onclick="event.stopPropagation();editSession('${s.id}')" title="${escHtml(tip)}">
        <div style="font-size:10px;font-weight:700;color:${typeCol};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${happened?'✓ ':''}${safeEscSnippet(String(title).toUpperCase(),18)}${n?` ×${n}`:''}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
          <span style="background:${typeCol}25;color:${typeCol};border-radius:3px;padding:1px 4px;font-size:9px;font-family:'DM Mono',monospace;">${happened?'✓ ':''}${safeEscSnippet(String(typeLabel).toUpperCase(),8)}</span>
          <span style="font-size:9px;color:var(--muted);">${emoji||''}${exCount?` ⚡ ${exCount}`:''}</span>
        </div>
      </div>`;
    }).join('')+(collapsed.extra?`<div style="font-size:9px;color:var(--muted);margin-top:4px;text-align:center;">+${collapsed.extra} więcej</div>`:'');

    return `<div class="cp-cal-day" style="border:1px solid ${isToday?'var(--accent)':isPast?'var(--border)':'var(--border)'};border-radius:8px;padding:7px;min-height:90px;background:${isToday?'rgba(230,0,0,0.04)':isPast?'rgba(0,0,0,0.1)':'var(--s2)'};cursor:pointer;transition:border-color 0.12s;" onclick="openAddSessionFromCP('${c.id}','${ds}')" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='${isToday?'var(--accent)':isPast?'var(--border)':'var(--border)'}'">
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



// ════════════════════════════════════════
// PODSUMOWANIE START + MONITORING PROGRESU
// ════════════════════════════════════════

const JOURNEY_ACT_MULT={sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
const JOURNEY_GOAL_DELTA={redukcja:-300,masa:300,sila:0,kondycja:0,atletyzm:0,rehab:0};
const JOURNEY_MACRO_PCT={
  masa:{p:35,f:25,c:40},redukcja:{p:40,f:30,c:30},sila:{p:35,f:25,c:40},
  kondycja:{p:30,f:30,c:40},atletyzm:{p:30,f:25,c:45},rehab:{p:30,f:30,c:40}
};

function estimateClientMacros(c,opts){
  const o=opts||{};
  if(c&&c.macros&&c.macros.targetKcal&&!o.force){
    return{...c.macros,source:'saved'};
  }
  const weight=parseFloat(o.weight!=null?o.weight:(c&&c.weight))||0;
  const height=parseFloat(o.height!=null?o.height:(c&&c.height))||0;
  const age=parseFloat(o.age!=null?o.age:(c&&c.age))||30;
  const gender=(typeof normalizeClientGender==='function'?normalizeClientGender(o.gender||(c&&c.gender)):(o.gender||(c&&c.gender)))||'M';
  if(!weight||!height)return null;
  const bmr=gender==='K'?(10*weight+6.25*height-5*age-161):(10*weight+6.25*height-5*age+5);
  const actKey=String((c&&c.activityLevel)||'moderate').toLowerCase();
  const mult=JOURNEY_ACT_MULT[actKey]||1.55;
  const goal=String((c&&c.goal)||'masa').toLowerCase();
  const delta=JOURNEY_GOAL_DELTA[goal]!=null?JOURNEY_GOAL_DELTA[goal]:0;
  const pct=JOURNEY_MACRO_PCT[goal]||JOURNEY_MACRO_PCT.masa;
  const tdee=Math.round(bmr*mult);
  const target=tdee+delta;
  return{
    tdee,targetKcal:target,
    proteinG:Math.round(target*(pct.p/100)/4),
    fatG:Math.round(target*(pct.f/100)/9),
    carbG:Math.round(target*(pct.c/100)/4),
    activityMult:mult,goalDelta:delta,macroPct:pct,weight,
    source:'estimate',updatedAt:new Date().toISOString()
  };
}
window.estimateClientMacros=estimateClientMacros;

function journeyIntakeHighlights(c){
  const state=typeof clientIntakeFormState==='function'?clientIntakeFormState(c.id):null;
  const send=state&&state.filledSend;
  const out={filled:!!(state&&state.filled),pending:!!(state&&state.pending),rows:[]};
  if(!send){
    out.rows.push({k:'Status ankiety',v:state&&state.pending?'Wysłana — czekamy na klienta':(state&&state.sent?'Wysłana':'Nie wypełniona')});
    if(c.goal)out.rows.push({k:'Cel (z profilu)',v:({masa:'Budowa masy',sila:'Siła',redukcja:'Redukcja',kondycja:'Kondycja'})[c.goal]||c.goal});
    if(c.level)out.rows.push({k:'Poziom',v:({poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'})[c.level]||c.level});
    if(c.trainingFreq)out.rows.push({k:'Dni/tydzień',v:String(c.trainingFreq)});
    if(c.injuries)out.rows.push({k:'Kontuzje / ograniczenia',v:String(c.injuries)});
    return out;
  }
  const qs=typeof formQuestionsForSend==='function'?formQuestionsForSend(send):(send.questions||[]);
  const map=typeof formSendAnswersMap==='function'?formSendAnswersMap(send):(send.answers||{});
  (qs||[]).slice(0,8).forEach(q=>{
    if(!q)return;
    const raw=map[q.id];
    const val=typeof formatFormAnswer==='function'?formatFormAnswer(q,raw):(raw!=null&&String(raw).trim()!==''?String(raw):'—');
    out.rows.push({k:q.label||q.id,v:val});
  });
  return out;
}

function journeyPlanHighlights(c){
  const plan=typeof latestClientPlan==='function'?latestClientPlan(c.id):((window.PL||[]).filter(p=>p.clientId===c.id)[0]||null);
  if(!plan)return{hasPlan:false,plan:null,days:[]};
  const days=(plan.days||[]).map(d=>({
    label:d.d||d.day||d.name||'Dzień',
    focus:d.focus||d.name||'',
    exCount:(d.exercises||d.ex||[]).length
  }));
  return{hasPlan:true,plan,days,method:plan.method||'',duration:plan.duration||plan.weeks||''};
}

function buildOnboardNextSteps(c,ctx){
  const steps=[];
  const intake=ctx.intake||{};
  const plan=ctx.plan||{};
  const macros=ctx.macros;
  if(!intake.filled)steps.push({prio:'high',text:'Dokończ ankietę wstępną — bez niej cel, poziom i ograniczenia są niekompletne.'});
  if(!plan.hasPlan)steps.push({prio:'high',text:'Przypisz / wygeneruj plan treningowy dopasowany do ankiety i stażu.'});
  else if(plan.days&&plan.days.length&&typeof scheduleClientPlanToCalendar==='function'){
    const sess=(window.SE||[]).filter(s=>s.clientId===c.id).length;
    if(sess<3)steps.push({prio:'med',text:'Wrzuć plan do kalendarza (4 tyg.), żeby klient widział kolejne treningi w apce.'});
  }
  if(!macros)steps.push({prio:'med',text:'Policz makro w Kalkulatorze i wyślij klientowi (zapisze się w profilu).'});
  else if(macros.source==='estimate')steps.push({prio:'low',text:'Makro jest szacunkowe — potwierdź w Kalkulatorze i wyślij klientowi.'});
  if(!(c.weight&&c.height))steps.push({prio:'med',text:'Uzupełnij wagę i wzrost (pomiary bazowe) — potrzebne do makro i monitoringu.'});
  steps.push({prio:'low',text:'Umów pierwszy check-in za 7 dni — punkt startowy do oceny progresu.'});
  steps.push({prio:'low',text:'Wyjaśnij klientowi metodę i cele prostym językiem (ściągawka / „Jak wytłumaczyć klientowi”).'});
  return steps.slice(0,6);
}

function buildMonitorVerdict(c){
  const signals=[];
  const goal=String(c.goal||'masa').toLowerCase();
  const massDelta=typeof cpMetricDeltaPct==='function'?cpMetricDeltaPct(c.id,'mg1','m1'):null;
  const bfDelta=typeof cpMetricDeltaPct==='function'?cpMetricDeltaPct(c.id,'mg1','m2'):null;
  const squatDelta=typeof cpMetricDeltaPct==='function'?cpMetricDeltaPct(c.id,'mg3','m1'):null;
  const adh30=typeof cpClientAdherence==='function'?cpClientAdherence(c.id,30):{pct:0,logged:0,assigned:0};
  const adh7=typeof cpClientAdherence==='function'?cpClientAdherence(c.id,7):{pct:0,logged:0,assigned:0};
  const checkins=typeof cpCheckinTrendPoints==='function'?cpCheckinTrendPoints(c.id):[];
  let checkTrend=null;
  if(checkins.length>=2){
    const a=checkins[checkins.length-1].v;
    const b=checkins[Math.max(0,checkins.length-3)].v;
    checkTrend=a-b;
  }
  const vol=typeof clientWeeklyVolumeStats==='function'?clientWeeklyVolumeStats(c.id,6):null;
  const plans=(window.PL||[]).filter(p=>p.clientId===c.id);
  const sessions=(window.SE||[]).filter(s=>s.clientId===c.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const lastDate=sessions[0]&&sessions[0].date;
  const daysSince=lastDate?Math.round((Date.now()-new Date(lastDate+'T12:00:00').getTime())/86400000):null;
  const insights=typeof buildClientInsight==='function'?buildClientInsight(c,sessions,plans,daysSince):[];

  const logged=sessions.filter(s=>s&&(typeof isLoggedWorkout==='function'?isLoggedWorkout(s):(s.source==='client'||s.source==='live'||(Array.isArray(s.exercises)&&s.exercises.length))));
  const recent=logged.slice(0,3);
  const prev=logged.slice(3,6);
  const avgNum=(arr,fn)=>{const xs=arr.map(fn).filter(n=>typeof n==='number'&&isFinite(n));return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;};
  const volOf=s=>parseFloat(s.volume)||0;
  const fbOf=s=>parseFloat(s.feedback)||0;
  const volNow=avgNum(recent,volOf),volPrev=avgNum(prev,volOf);
  const fbNow=avgNum(recent,fbOf),fbPrev=avgNum(prev,fbOf);

  let score=0; // >0 progress, <0 regress
  if(massDelta!=null){
    if(goal==='redukcja'){
      if(massDelta< -0.5){score+=2;signals.push({tone:'good',label:'Masa ciała',text:`Spadek ${Math.abs(massDelta)}% vs poprzedni pomiar — zgodne z redukcją.`});}
      else if(massDelta>1){score-=2;signals.push({tone:'bad',label:'Masa ciała',text:`Wzrost ${massDelta}% — sprawdź deficyt / adherence żywieniową.`});}
      else signals.push({tone:'neutral',label:'Masa ciała',text:`Zmiana ${massDelta}% — stabilnie; obserwuj trend 2–3 pomiarów.`});
    }else if(goal==='masa'||goal==='sila'){
      if(massDelta>0.5){score+=2;signals.push({tone:'good',label:'Masa ciała',text:`Wzrost ${massDelta}% — dobry sygnał przy budowie masy / sile.`});}
      else if(massDelta< -1){score-=1;signals.push({tone:'warn',label:'Masa ciała',text:`Spadek ${Math.abs(massDelta)}% — upewnij się, że nadwyżka kaloryczna i regeneracja są OK.`});}
      else signals.push({tone:'neutral',label:'Masa ciała',text:`Zmiana ${massDelta}% — powoli; to nie musi być problem.`});
    }else{
      signals.push({tone:'neutral',label:'Masa ciała',text:massDelta!=null?`Zmiana ${massDelta}%.`:'Brak drugiego pomiaru masy.'});
    }
  }else signals.push({tone:'neutral',label:'Masa ciała',text:'Za mało pomiarów masy (potrzeba ≥2).'});

  if(bfDelta!=null){
    if(bfDelta< -1){score+=1;signals.push({tone:'good',label:'% tkanki tłuszczowej',text:`Spadek ${Math.abs(bfDelta)}%.`});}
    else if(bfDelta>2){score-=1;signals.push({tone:'warn',label:'% tkanki tłuszczowej',text:`Wzrost ${bfDelta}% — warto skorygować makro / NEAT.`});}
  }

  if(squatDelta!=null){
    if(squatDelta>0){score+=2;signals.push({tone:'good',label:'Siła (przysiad 1RM)',text:`+${squatDelta}% — progres siłowy.`});}
    else if(squatDelta< -3){score-=2;signals.push({tone:'bad',label:'Siła (przysiad 1RM)',text:`${squatDelta}% — możliwy regres; sprawdź objętość i sen.`});}
    else signals.push({tone:'neutral',label:'Siła (przysiad 1RM)',text:`${squatDelta}% — plateau / szum pomiaru.`});
  }

  if(adh30.assigned||adh30.logged){
    if(adh30.pct>=75){score+=2;signals.push({tone:'good',label:'Adherencja 30 dni',text:`${adh30.pct}% (${adh30.logged}/${adh30.assigned}) — solidna regularność.`});}
    else if(adh30.pct>=50){score+=0;signals.push({tone:'warn',label:'Adherencja 30 dni',text:`${adh30.pct}% — średnio; uprość plan albo usuń bariery.`});}
    else{score-=2;signals.push({tone:'bad',label:'Adherencja 30 dni',text:`${adh30.pct}% — ryzyko regresu przez brak bodźca.`});}
  }
  if(adh7.logged===0&&adh7.assigned>0){
    score-=1;signals.push({tone:'warn',label:'Ostatni tydzień',text:`0 z ${adh7.assigned} zaplanowanych — krótki kontakt check-inowy.`});
  }
  if(daysSince!=null&&daysSince>10){
    score-=2;signals.push({tone:'bad',label:'Nieobecność',text:`Brak sesji od ${daysSince} dni.`});
  }
  if(checkTrend!=null){
    if(checkTrend>=5){score+=1;signals.push({tone:'good',label:'Check-in',text:`Samopoczucie ↑ (+${Math.round(checkTrend)} pkt).`});}
    else if(checkTrend<=-8){score-=2;signals.push({tone:'bad',label:'Check-in',text:`Samopoczucie ↓ (${Math.round(checkTrend)} pkt) — obniż intensywność / dopytaj o sen i stres.`});}
  }
  if(volNow!=null&&volPrev!=null&&volPrev>0){
    const d=Math.round(((volNow-volPrev)/volPrev)*100);
    if(d<=-20){score-=1;signals.push({tone:'warn',label:'Objętość sesji',text:`Ostatnie treningi ${d}% vs wcześniejsze — możliwy spadek bodźca albo zmęczenie.`});}
    else if(d>=15){score+=1;signals.push({tone:'good',label:'Objętość sesji',text:`Objętość ↑ ${d}% — idziemy do przodu, pilnuj regeneracji.`});}
  }
  if(fbNow!=null&&fbPrev!=null&&fbPrev>0){
    const d=+(fbNow-fbPrev).toFixed(1);
    if(d<=-1){score-=1;signals.push({tone:'bad',label:'Ocena treningu',text:`Średnia ocena ${fbNow.toFixed(1)}/5 (↓ ${Math.abs(d)}) — sesje idą gorzej; skróć objętość albo dopytaj.`});}
    else if(d>=0.6){score+=1;signals.push({tone:'good',label:'Ocena treningu',text:`Ocena sesji ↑ do ${fbNow.toFixed(1)}/5.`});}
  }

  let verdict='stabilnie';
  let verdictTone='neutral';
  if(score>=3){verdict='progres';verdictTone='good';}
  else if(score<=-3){verdict='regres';verdictTone='bad';}
  else if(score<=-1){verdict='ryzyko stagnacji';verdictTone='warn';}

  const next=[];
  if(verdict==='progres'){
    next.push('Idziemy w dobrą stronę — utrzymaj volume w MAV; dokładaj obciążenie tylko gdy RPE/RIR na to pozwala.');
    next.push('Zaplanuj deload za 1–2 tygodnie, zanim pojawi się plateau.');
  }else if(verdict==='regres'){
    next.push('Zła strona — skróć objętość o ~20–30% na 7–10 dni i wróć do MEV.');
    next.push('Zweryfikuj sen, stres i makro — trening nie nadrobi deficytu regeneracji.');
    next.push('Napisz krótką wiadomość / wyślij check-in, żeby złapać kontekst poza siłownią.');
  }else{
    next.push('Zbierz jeszcze 1–2 pomiary i check-in — decyzje opieraj na trendzie, nie na jednym punkcie.');
    if(adh30.pct<75)next.push('Popraw adherencję (mniej dni albo krótsze sesje), zanim zwiększysz objętość.');
    if(!massDelta&&!squatDelta)next.push('Uzupełnij pomiary masy i siły bazowej — bez nich monitoring jest ślepy.');
  }
  const bmiSt=typeof clientBmiStatus==='function'?clientBmiStatus(c.weight||(typeof clientLatestMetricWeight==='function'?clientLatestMetricWeight(c.id):null),c.height):null;
  if(bmiSt&&bmiSt.overweight&&bmiSt.tips[0]){
    next.push((bmiSt.obese?'Otyłość':'Nadwaga')+' (BMI '+(bmiSt.bmi||'?')+'): '+bmiSt.tips[0]);
  }
  insights.forEach(i=>{if(i&&i.text)next.push(i.text.replace(/^[^—]*—\s*/,''));});

  return{
    verdict,verdictTone,score,signals,next:next.slice(0,7),
    stats:{massDelta,bfDelta,squatDelta,adh30,adh7,daysSince,checkTrend,vol,bmi:bmiSt&&bmiSt.bmi,bmiLabel:bmiSt&&bmiSt.label}
  };
}
window.buildMonitorVerdict=buildMonitorVerdict;

function monitorWeekKey(d){
  const dt=d?new Date(d):new Date();
  const t=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate()));
  const day=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-day);
  const yStart=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  const wk=Math.ceil((((t-yStart)/86400000)+1)/7);
  return t.getUTCFullYear()+'-W'+String(wk).padStart(2,'0');
}

function clientMonitorContextForAI(clientId){
  const c=(window.CL||[]).find(x=>x&&x.id===clientId);
  if(!c||typeof buildMonitorVerdict!=='function')return'';
  const v=buildMonitorVerdict(c);
  if(!v)return'';
  const dir=v.verdict==='progres'?'DOBRA STRONA — utrzymuj kurs'
    :(v.verdict==='regres'?'ZŁA STRONA — korekta teraz'
    :(v.verdict==='ryzyko stagnacji'?'UWAGA — ryzyko stagnacji':'STABILNIE — zbieraj dane'));
  const lines=['=== STRAŻNIK POSTĘPÓW (OBOWIĄZKOWE) ==='];
  lines.push('Werdykt: '+String(v.verdict||'').toUpperCase()+' (score '+(v.score??'?')+'). '+dir+'.');
  (v.signals||[]).forEach(s=>lines.push('- ['+(s.tone||'')+'] '+(s.label||'')+': '+(s.text||'')));
  if(v.next&&v.next.length){
    lines.push('Jak zrobić, żeby było dobrze:');
    v.next.forEach(t=>lines.push('- '+t));
  }
  lines.push('Powiedz trenerowi wprost: czy idziemy w dobrą czy złą stronę. Podaj 2–4 konkretne korekty planu / obciążenia / adherencji. Nie bądź ogólnikowy.');
  return lines.join('\n')+'\n';
}
window.clientMonitorContextForAI=clientMonitorContextForAI;

function maybeNotifyTrainerMonitor(clientId,source){
  const c=(window.CL||[]).find(x=>x&&x.id===clientId);
  if(!c||typeof buildMonitorVerdict!=='function')return null;
  const v=buildMonitorVerdict(c);
  if(!v)return v;
  const src=source||'auto';
  if(v.verdict==='stabilnie')return v;
  if(v.verdict==='progres'&&src!=='session')return v;
  if(typeof addNotification!=='function')return v;
  const key='monitor_'+clientId+'_'+v.verdict+'_'+monitorWeekKey();
  const list=typeof allNotifs==='function'?allNotifs():(window.NOTIFICATIONS||[]);
  if((list||[]).some(n=>n&&(n.id===key||n.autoKey===key)))return v;
  const title=v.verdict==='progres'?'Idziemy w dobrą stronę'
    :(v.verdict==='regres'?'Regres — korekta planu':'Ryzyko stagnacji');
  const advice=(v.next||[]).slice(0,2).join(' ');
  addNotification(v.verdict==='regres'?'alert':'system',title,(c.name||'Klient')+' · '+advice,'clients',key);
  return v;
}
window.maybeNotifyTrainerMonitor=maybeNotifyTrainerMonitor;
window.trainerWatchdogAfterSession=(id)=>maybeNotifyTrainerMonitor(id,'session');

function buildClientJourneySummary(clientId,mode){
  const c=(window.CL||[]).find(x=>x.id===clientId);
  if(!c)return null;
  const m=mode==='monitor'?'monitor':'onboard';
  const intake=journeyIntakeHighlights(c);
  const plan=journeyPlanHighlights(c);
  const macros=estimateClientMacros(c);
  const monitor=m==='monitor'?buildMonitorVerdict(c):null;
  const next=m==='monitor'?(monitor.next||[]):buildOnboardNextSteps(c,{intake,plan,macros});
  return{client:c,mode:m,intake,plan,macros,monitor,next,generatedAt:new Date().toISOString()};
}
window.buildClientJourneySummary=buildClientJourneySummary;

function renderClientJourneyHTML(summary){
  if(!summary||!summary.client)return'<div class="client-journey" style="padding:24px;color:var(--text-label);">Brak danych klienta.</div>';
  const c=summary.client;
  const esc=(typeof escHtml==='function'?escHtml:(s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')));
  const goalLbl=({masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja',atletyzm:'Atletyzm',rehab:'Rehab'})[c.goal]||c.goal||'—';
  const levelLbl=({poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'})[c.level]||c.level||'—';
  const row=(k,v)=>`<div class="cj-row"><span class="cj-k">${esc(k)}</span><span class="cj-v">${esc(v)}</span></div>`;
  let hero='';
  if(summary.mode==='monitor'&&summary.monitor){
    const v=summary.monitor;
    hero=`<div class="cj-verdict cj-verdict-${esc(v.verdictTone||'neutral')}">
      <div class="cj-verdict-lbl">Werdykt monitoringu</div>
      <div class="cj-verdict-val">${esc(v.verdict.toUpperCase())}</div>
      <div class="cj-verdict-sub">Na podstawie pomiarów, adherencji, check-inów i planu</div>
    </div>`;
  }else{
    hero=`<div class="cj-verdict cj-verdict-neutral">
      <div class="cj-verdict-lbl">Podsumowanie startowe</div>
      <div class="cj-verdict-val">PLAN · ANKIETA · MAKRO</div>
      <div class="cj-verdict-sub">Co ustalone + co zrobić dalej z klientem</div>
    </div>`;
  }
  const intakeHtml=`<div class="cj-card"><div class="cj-h">Ankieta wstępna</div>
    ${summary.intake.rows.map(r=>row(r.k,r.v)).join('')||'<div class="cj-empty">Brak odpowiedzi — wyślij ankietę.</div>'}
  </div>`;
  const plan=summary.plan;
  const planHtml=`<div class="cj-card"><div class="cj-h">Plan treningowy</div>
    ${plan.hasPlan?`
      ${row('Nazwa',plan.plan.name||'—')}
      ${row('Metoda',plan.method||'—')}
      ${row('Czas',plan.duration?plan.duration+' tyg.':'—')}
      <div class="cj-days">${(plan.days||[]).map(d=>`<div class="cj-day"><b>${esc(d.label)}</b> ${esc(d.focus||'')} <span>${d.exCount?d.exCount+' ćw.':'—'}</span></div>`).join('')}</div>
    `:'<div class="cj-empty">Brak przypisanego planu.</div>'}
  </div>`;
  const mac=summary.macros;
  const macrosHtml=`<div class="cj-card"><div class="cj-h">Makro / energia ${mac&&mac.source==='estimate'?'(szacunek)':''}</div>
    ${mac?`
      ${row('TDEE',mac.tdee+' kcal')}
      ${row('Cel kcal',mac.targetKcal+' kcal')}
      ${row('Białko',mac.proteinG+' g')}
      ${row('Tłuszcze',mac.fatG+' g')}
      ${row('Węglowodany',mac.carbG+' g')}
      ${row('Woda (min.)',mac.weight?((Math.round(mac.weight*0.035*10)/10)+' l/dzień'):'—')}
      ${mac.source==='estimate'?'<div class="cj-note">Szacunek z danych klienta — potwierdź w Kalkulatorze i wyślij, żeby zapisać.</div>':`<div class="cj-note">Zapisano ${mac.updatedAt?new Date(mac.updatedAt).toLocaleDateString('pl'):''}.</div>`}
    `:'<div class="cj-empty">Brak wagi/wzrostu — nie da się policzyć makro.</div>'}
  </div>`;
  let monitorHtml='';
  if(summary.mode==='monitor'&&summary.monitor){
    monitorHtml=`<div class="cj-card"><div class="cj-h">Sygnały progres / regres</div>
      <div class="cj-signals">${summary.monitor.signals.map(s=>`<div class="cj-sig cj-sig-${esc(s.tone||'neutral')}"><b>${esc(s.label)}</b><span>${esc(s.text)}</span></div>`).join('')}</div>
    </div>`;
  }
  const nextHtml=`<div class="cj-card cj-next"><div class="cj-h">Co dalej — wskazówki</div>
    <ol class="cj-ol">${(summary.next||[]).map(t=>`<li>${esc(typeof t==='string'?t:(t.text||''))}</li>`).join('')}</ol>
  </div>`;
  const when=new Date(summary.generatedAt||Date.now()).toLocaleString('pl');
  return`<div class="client-journey" id="client-journey-root">
    <div class="cj-top">
      <div>
        <div class="cj-name">${esc(c.name)}</div>
        <div class="cj-meta">${esc(goalLbl)} · ${esc(levelLbl)}${c.age?' · '+c.age+' lat':''}${c.weight?' · '+c.weight+' kg':''}</div>
      </div>
      <div class="cj-date">${esc(when)}</div>
    </div>
    ${hero}
    <div class="cj-grid">${intakeHtml}${planHtml}${macrosHtml}</div>
    ${monitorHtml}
    ${nextHtml}
    <div class="cj-foot">Progress Live — podsumowanie dla trenera i klienta · możesz wydrukować / zapisać jako PDF</div>
  </div>`;
}
window.renderClientJourneyHTML=renderClientJourneyHTML;

function openClientJourneySummary(clientId,mode){
  const id=clientId||window.cpClientId;
  if(!id){if(typeof notify==='function')notify('Wybierz klienta');return;}
  const summary=buildClientJourneySummary(id,mode||'onboard');
  if(!summary){if(typeof notify==='function')notify('Nie znaleziono klienta');return;}
  try{if(typeof closeClientProfile==='function')closeClientProfile();}catch(e){}
  try{if(typeof closeM==='function')closeM('m-report');}catch(e){}
  const html=renderClientJourneyHTML(summary);
  const box=document.getElementById('report-container');
  const title=document.getElementById('report-overlay-title');
  const ov=document.getElementById('report-overlay');
  if(!box||!ov){if(typeof notify==='function')notify('Brak podglądu raportu');return;}
  box.innerHTML=html;
  if(title)title.textContent=(summary.mode==='monitor'?'MONITORING — ':'PODSUMOWANIE START — ')+String(summary.client.name||'').toUpperCase();
  ov.style.display='flex';
}
window.openClientJourneySummary=openClientJourneySummary;
window.openClientOnboardSummary=(id)=>openClientJourneySummary(id,'onboard');
window.openClientMonitorSummary=(id)=>openClientJourneySummary(id,'monitor');
