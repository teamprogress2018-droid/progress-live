// ════════════════════════════════════════
// OŚ CZASU KLIENTA — notatki + auto: sesje/plany/pomiary
// ════════════════════════════════════════
window.CLIENT_TIMELINE = window.CLIENT_TIMELINE || {}; // clientId -> [{id,text,type,date}]

const CTL_ICONS  = {trening:'🏋️',pomiar:'📏',plan:'📋',notatka:'📝',cel:'🎯',sukces:'🏆'};
const CTL_COLORS = {trening:'#E8302A',pomiar:'var(--blue)',plan:'var(--blue)',notatka:'var(--orange)',cel:'var(--accent)',sukces:'#FFD700'};

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

  document.getElementById('cp-body').innerHTML = `
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
      <button onclick="psyAskAI('${c.id}')" id="psy-ai-btn" style="width:100%;background:rgba(225,31,46,0.1);border:1px solid rgba(225,31,46,0.25);border-radius:8px;padding:10px;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;">🤖 Zapytaj AI o strategie</button>
      <button onclick="psyCheckYoyo('${c.id}')" style="width:100%;background:rgba(201,123,63,0.1);border:1px solid rgba(201,123,63,0.25);border-radius:8px;padding:10px;color:var(--orange);font-size:12px;font-weight:600;cursor:pointer;">🔄 Sprawdź błędne koło yo-yo</button>
      <div id="psy-yoyo-result"></div>
      <div id="psy-ai-result"></div>
    </div>`;

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
  const moodColor={1:'#ff4d4d',2:'#c97b3f',3:'#9a9086',4:'#4ade80',5:'#e11f2e'};
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
    if(resEl) resEl.innerHTML = `<div style="background:rgba(225,31,46,0.06);border:1px solid rgba(225,31,46,0.2);border-radius:8px;padding:12px;margin-top:4px;font-size:12px;color:var(--text);line-height:1.6;white-space:pre-wrap;">🤖 ${ans}</div>`;
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
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;">TYDZIEŃ ${sfrWeekKey()}</div>
      <button onclick="sfrReset('${c.id}')" style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.2);border-radius:6px;padding:5px 10px;color:var(--red);font-size:10px;cursor:pointer;">↺ Reset tygodnia</button>
    </div>
    <div id="sfr-mult-info" style="font-size:10px;color:var(--muted);background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:12px;"></div>
    <div id="sfr-warning" style="display:none;background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.25);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--red);line-height:1.6;"></div>
    <div id="sfr-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>`;
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

function renderCPOverview(c){
  const today=new Date().toISOString().split('T')[0];
  const ci=CL.indexOf(c);const col=COLS[ci%5];
  const sessions=SE.filter(s=>s.clientId===c.id);
  const tasks=TASKS.filter(t=>t.clientId===c.id);
  const tasksDone=tasks.filter(t=>t.status==='done');
  const plans=PL.filter(p=>p.clientId===c.id);
  const packages=allPackages().filter(p=>p.clientId===c.id||p.clientName===c.name);
  const lastSess=sessions.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const daysSince=lastSess?Math.floor((new Date()-new Date(lastSess.date))/(1000*60*60*24)):null;
  const notes=CLIENT_NOTES[c.id]||[];
  const activity=CLIENT_ACTIVITY[c.id]||[];
  initClientData(c);

  document.getElementById('cp-body').innerHTML=`
    <!-- statystyki -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--accent);">${sessions.length}</div><div class="cp-stat-lbl">Sesji</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--blue);">${plans.length}</div><div class="cp-stat-lbl">Planów</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:var(--teal);">${tasksDone.length}/${tasks.length}</div><div class="cp-stat-lbl">Zadań</div></div>
      <div class="cp-stat-box"><div class="cp-stat-val" style="color:${daysSince===null?'var(--muted)':daysSince>14?'var(--red)':daysSince>7?'var(--orange)':'var(--teal)'};">${daysSince!==null?daysSince+'d':'—'}</div><div class="cp-stat-lbl">Ost. sesja</div></div>
    </div>

    ${(()=>{const ins=buildClientInsight(c,sessions,plans,daysSince);
      if(!ins.length)return'';
      return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        ${ins.map(i=>`<div style="background:${i.color}14;border:1px solid ${i.color}44;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:16px;flex-shrink:0;">${i.icon}</span>
          <div style="font-size:12px;color:var(--text);line-height:1.6;">${i.text}</div>
        </div>`).join('')}
      </div>`;
    })()}

    <!-- dane podstawowe -->
    <div class="cp-section-title">DANE KLIENTA</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;">
      ${[
        ['📧 Email',c.email||'—'],['🎂 Wiek',c.age?c.age+' lat':'—'],
        ['⚖️ Waga',c.weight?c.weight+' kg':'—'],['📏 Wzrost',c.height?c.height+' cm':'—'],
        ['🎯 Cel',{masa:'Budowa masy',sila:'Wzrost siły',redukcja:'Redukcja',kondycja:'Kondycja'}[c.goal]||c.goal||'—'],
        ['🏋️ Poziom',{poczatkujacy:'Początkujący',sredni:'Średni',zaawansowany:'Zaawansowany'}[c.level]||c.level||'—'],
      ].map(([l,v])=>`<div style="background:var(--s3);border-radius:8px;padding:9px 11px;"><div style="font-size:12px;color:var(--muted);margin-bottom:2px;">${l}</div><div style="font-size:14px;font-weight:600;">${v}</div></div>`).join('')}
    </div>

    ${c.notes?`<div style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.2);border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:12px;"><span style="color:var(--red);">⚠ Kontuzje/uwagi: </span>${c.notes}</div>`:''}

    ${(()=>{const ob=typeof getClientOnboard==='function'?getClientOnboard(c):null;
      if(!ob||ob.complete)return'';
      return `<div style="background:rgba(201,123,63,0.1);border:1px solid rgba(201,123,63,0.35);border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:700;margin-bottom:2px;">Start współpracy ${ob.done}/3</div>
          <div style="font-size:11px;color:var(--muted);">${!ob.invite?'Brak zaproszenia. ':''}${!ob.plan?'Brak planu. ':''}${!ob.session?'Brak sesji. ':''}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openClientOnboardChecklist('${c.id}')">Dokończ</button>
      </div>`;
    })()}

    <!-- aktywny plan -->
    ${plans.length?`
    <div class="cp-section-title">AKTYWNY PLAN</div>
    <div style="background:linear-gradient(135deg,var(--adim),transparent);border:1px solid rgba(225,31,46,0.2);border-radius:10px;padding:12px 14px;margin-bottom:16px;cursor:pointer;" onclick="setCPTab('plan')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:15px;font-weight:700;">${plans[plans.length-1].name}</div>
        <span class="pill pill-green" style="font-size:11px;">${plans[plans.length-1].method||'—'}</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px;">${plans[plans.length-1].method||'—'} · ${plans[plans.length-1].duration||'?'} tyg. · ${(plans[plans.length-1].days||[]).length} dni/tydzień</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        ${(plans[plans.length-1].days||[]).slice(0,5).map(d=>`<span style="background:${d.rest?'var(--s3)':'rgba(225,31,46,0.12)'};color:${d.rest?'var(--muted)':'var(--accent)'};border-radius:5px;padding:3px 8px;font-size:12px;font-family:'DM Mono',monospace;">${d.day||d.dayName||'?'}${d.rest?' REST':''}</span>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--accent);margin-top:8px;">→ Kliknij aby zobaczyć szczegóły</div>
    </div>`:`
    <div class="cp-section-title">AKTYWNY PLAN</div>
    <div style="background:var(--s3);border:1px dashed var(--border2);border-radius:10px;padding:12px 14px;margin-bottom:16px;text-align:center;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Brak przypisanego planu</div>
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="openAiPlanForClient('${c.id}')">⚡ Plan AI</button>
        <button class="btn btn-ghost btn-sm" onclick="cpAssignTemplate('${c.id}')">📋 Szablon</button>
      </div>
    </div>`}
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div class="cp-section-title" style="margin-bottom:0;">NOTATKI (${notes.length})</div>
      <button onclick="setCPTab('notes')" style="background:none;border:none;color:var(--accent);font-size:12px;cursor:pointer;">Wszystkie →</button>
    </div>
    <div id="cp-notes-area" style="margin-bottom:16px;">
      ${notes.slice(0,2).map((n,ni)=>`<div class="cip-note" style="position:relative;padding-right:24px;"><div>${n.text}</div><div class="cip-note-date">${n.date}</div></div>`).join('')}
      ${!notes.length?'<div style="font-size:12px;color:var(--muted);padding:8px 0;">Brak notatek — dodaj w zakładce Notatki</div>':''}
    </div>

    <!-- aktywność -->
    <div class="cp-section-title">OSTATNIA AKTYWNOŚĆ</div>
    ${(CLIENT_ACTIVITY[c.id]||[]).map((a,ai)=>`<div class="cp-mini-row">
      <div class="cp-mini-icon" style="background:var(--s3);">${a.icon}</div>
      <div style="flex:1;"><div>${a.text}</div><div style="font-size:12px;color:var(--muted);margin-top:1px;">${a.date}</div></div>
      <button onclick="deleteClientActivity('${c.id}',${ai})" style="background:none;border:none;color:var(--muted2);font-size:14px;cursor:pointer;padding:0 4px;">×</button>
    </div>`).join('')}`;
}

function renderCPPlan(c){
  const plans=PL.filter(p=>p.clientId===c.id);
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="cp-section-title" style="margin:0;">PLANY TRENINGOWE (${plans.length})</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" onclick="cpAssignTemplate('${c.id}')">📋 Przypisz szablon</button>
        <button class="btn btn-primary btn-sm" onclick="goTo('aiplangen');document.getElementById('apl-client').value='${c.id}';aplFillFromClient();closeClientProfile()">⚡ Generuj plan AI</button>
      </div>
    </div>
    ${!plans.length
      ?`<div style="text-align:center;padding:40px;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:10px;opacity:0.3;">📋</div>
          <div style="margin-bottom:14px;">Brak planów treningowych</div>
          <button class="btn btn-primary btn-sm" onclick="cpAssignTemplate('${c.id}')">📋 Przypisz szablon</button>
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
  initDemoEntries(c.id);
  const groups=allMetricGroups();
  const entries=METRIC_ENTRIES.filter(e=>e.clientId===c.id);
  document.getElementById('cp-body').innerHTML=`
    <div class="cp-section-title">POMIARY CIAŁA</div>
    ${groups.map(g=>{
      const ge=entries.filter(e=>e.groupId===g.id).sort((a,b)=>b.date.localeCompare(a.date));
      if(!ge.length)return '';
      const last=ge[0];const prev=ge[1];
      return `<div class="card-sm" style="margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:20px;">${g.icon}</span>
          <div style="font-size:13px;font-weight:700;">${g.name}</div>
          <span style="font-size:10px;color:var(--muted);margin-left:auto;font-family:'DM Mono',monospace;">${last.date}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;">
          ${g.metrics.map(m=>{
            const cv=last.values[m.id];const pv=prev?prev.values[m.id]:null;
            const diff=cv!=null&&pv!=null?(cv-pv).toFixed(1):null;
            const goodDown=['mg1','mg2'].includes(g.id);
            const color=diff==null?'var(--muted)':parseFloat(diff)<0?(goodDown?'var(--teal)':'var(--red)'):parseFloat(diff)>0?(goodDown?'var(--red)':'var(--teal)'):'var(--muted)';
            return `<div style="background:var(--s3);border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">${m.name}</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);">${cv!=null?cv:'—'}${m.unit?'<span style="font-size:10px;color:var(--muted);"> '+m.unit+'</span>':''}</div>
              ${diff!=null?`<div style="font-size:10px;color:${color};">${parseFloat(diff)>0?'+':''}${diff}</div>`:''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
    <div style="margin-top:16px;">
      <div class="cp-section-title">HISTORIA POMIARÓW</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:var(--s3);">
            <th style="padding:6px 10px;text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);">Data</th>
            ${groups.slice(0,1).map(g=>g.metrics.map(m=>`<th style="padding:6px 10px;text-align:right;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);">${m.name}</th>`).join('')).join('')}
          </tr></thead>
          <tbody>
            ${(()=>{const g=groups[0];if(!g)return '<tr><td colspan="10" style="text-align:center;padding:16px;color:var(--muted);">Brak danych</td></tr>';
              const ge=entries.filter(e=>e.groupId===g.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
              return ge.map(e=>`<tr style="border-bottom:1px solid var(--border);">
                <td style="padding:6px 10px;font-family:'DM Mono',monospace;color:var(--muted);">${e.date}</td>
                ${g.metrics.map(m=>`<td style="padding:6px 10px;text-align:right;font-weight:600;">${e.values[m.id]!=null?e.values[m.id]+' '+(m.unit||''):'—'}</td>`).join('')}
              </tr>`).join('');})()}
          </tbody>
        </table>
      </div>
    </div>
    <button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px;" onclick="goTo('metrics');closeClientProfile()">📊 Zarządzaj pomiarami</button>`;
}

function renderCPTasks(c){
  const tasks=TASKS.filter(t=>t.clientId===c.id);
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div class="cp-section-title" style="margin:0;">ZADANIA (${tasks.length})</div>
      <button class="btn btn-primary btn-sm" onclick="openM('m-task');taskSetClientField('${c.id}','${(c.name||'').replace(/'/g,"\\'")}')">+ Zadanie</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px;">
      <div class="cp-stat-box" style="flex:1;"><div class="cp-stat-val" style="color:var(--accent);font-size:22px;">${tasks.filter(t=>t.status!=='done').length}</div><div class="cp-stat-lbl">Aktywne</div></div>
      <div class="cp-stat-box" style="flex:1;"><div class="cp-stat-val" style="color:var(--teal);font-size:22px;">${tasks.filter(t=>t.status==='done').length}</div><div class="cp-stat-lbl">Ukończone</div></div>
      <div class="cp-stat-box" style="flex:1;"><div class="cp-stat-val" style="color:var(--orange);font-size:22px;">${tasks.filter(t=>t.status!=='done'&&t.due&&t.due<today).length}</div><div class="cp-stat-lbl">Przet.</div></div>
    </div>
    ${!tasks.length?'<div style="text-align:center;padding:30px;color:var(--muted);">Brak zadań dla tego klienta</div>'
    :tasks.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).map(t=>{
      const isDone=t.status==='done';
      const isOverdue=!isDone&&t.due&&t.due<today;
      const catCol=TASK_CAT_COLORS[t.cat]||'var(--muted)';
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);">
        <div class="task-check${isDone?' checked':''}" onclick="toggleTask('${t.id}');renderCPTasks(CL.find(x=>x.id==='${c.id}'))">${isDone?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div style="flex:1;${isDone?'opacity:0.5;text-decoration:line-through;':''}cursor:pointer;" onclick="editTask('${t.id}')">
          <div style="font-size:12px;font-weight:600;">${t.title}</div>
          <div style="display:flex;gap:5px;margin-top:3px;">
            ${t.cat?`<span class="pill" style="background:${catCol}22;color:${catCol};font-size:9px;">${TASK_CAT_LABELS[t.cat]||t.cat}</span>`:''}
            ${t.due?`<span style="font-size:10px;color:${isOverdue?'var(--red)':'var(--muted)'};font-family:'DM Mono',monospace;">${isOverdue?'⚠ ':''} ${t.due}</span>`:''}
          </div>
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

  // Statystyki
  const last7=sessions.filter(s=>{const d=new Date(s.date);return(today-d)/86400000<=7;}).length;
  const last30=sessions.filter(s=>{const d=new Date(s.date);return(today-d)/86400000<=30;}).length;

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
    ?sessions.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15).map(s=>{
      const wo=allWorkouts().find(w=>w.id===s.workoutId);
      const exCount=wo?(wo.days||[]).reduce((n,d)=>n+(d.exercises||[]).length,0):0;
      const typeCol=s.type==='siłowy'||s.type==='Trening siłowy'?'var(--orange)':s.type==='cardio'?'var(--blue)':'var(--accent)';
      return `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="editSession('${s.id}')">
        <div style="width:38px;height:38px;border-radius:10px;background:${typeCol}18;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">💪</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${s.title||'Sesja'}</div>
          <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;">${s.date}${s.duration?' · '+s.duration+' min':''}</div>
        </div>
        <span style="background:${typeCol}18;color:${typeCol};border-radius:4px;padding:2px 8px;font-size:10px;font-family:'DM Mono',monospace;font-weight:700;text-transform:uppercase;">${s.type||'trening personalny'}</span>
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
      const wo=allWorkouts().find(w=>w.id===s.workoutId);
      const exCount=wo?(wo.days||[]).reduce((n,d)=>n+(d.exercises||[]).length,0):0;
      const typeLabel=s.type||'REGULAR';
      const typeCol=s.type==='siłowy'||s.type==='Trening siłowy'?'var(--orange)':s.type==='cardio'?'var(--blue)':'var(--accent)';
      return `<div style="background:${typeCol}15;border:1px solid ${typeCol}40;border-radius:6px;padding:5px 6px;margin-top:4px;cursor:pointer;" onclick="event.stopPropagation();editSession('${s.id}')">
        <div style="font-size:10px;font-weight:700;color:${typeCol};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(s.title||'Sesja').toUpperCase().substring(0,18)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
          <span style="background:${typeCol}25;color:${typeCol};border-radius:3px;padding:1px 4px;font-size:9px;font-family:'DM Mono',monospace;">${typeLabel.toUpperCase().substring(0,8)}</span>
          ${exCount?`<span style="font-size:9px;color:var(--muted);">⚡ ${exCount}</span>`:''}
        </div>
        ${s.duration?`<div style="font-size:9px;color:var(--muted);margin-top:2px;">⏱ ${s.duration} min</div>`:''}
      </div>`;
    }).join('');

    return `<div style="border:1px solid ${isToday?'var(--accent)':isPast?'var(--border)':'var(--border)'};border-radius:8px;padding:7px;min-height:90px;background:${isToday?'rgba(225,31,46,0.04)':isPast?'rgba(0,0,0,0.1)':'var(--s2)'};cursor:pointer;transition:border-color 0.12s;" onclick="openAddSessionFromCP('${c.id}','${ds}')" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='${isToday?'var(--accent)':isPast?'var(--border)':'var(--border)'}'">
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
        <div style="font-family:'Bebas Neue',sans-serif;font-size:30px;color:var(--teal);">${sessions.length}</div>
        <div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">Łącznie sesji</div>
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
// CP — FOOD JOURNAL (dziennik żywieniowy)
// ══════════════════════════════════════════════════════
window.CLIENT_FOOD = window.CLIENT_FOOD || {};
function renderCPFood(c){
  if(!window.CLIENT_FOOD[c.id]) window.CLIENT_FOOD[c.id]=[];
  const entries=window.CLIENT_FOOD[c.id];
  const enabled=c.clientSettings?.foodJournal!==false;
  const today=new Date().toISOString().split('T')[0];
  const byDate={};
  entries.forEach(e=>{if(!byDate[e.date])byDate[e.date]=[];byDate[e.date].push(e);});
  const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  const mealTypes={breakfast:'🌅 Śniadanie',lunch:'☀️ Obiad',snack:'🍎 Przekąska',dinner:'🌙 Kolacja',other:'🍽️ Inne'};
  document.getElementById('cp-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="cp-section-title" style="margin:0;">DZIENNIK ŻYWIENIOWY</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);cursor:pointer;">
          <span>${enabled?'✅ Aktywny':'⛔ Wyłączony'}</span>
          <div onclick="toggleClientFeature('${c.id}','foodJournal','food')" style="width:32px;height:18px;border-radius:9px;background:${enabled?'var(--accent)':'var(--s4)'};cursor:pointer;position:relative;transition:background 0.2s;">
            <div style="width:14px;height:14px;border-radius:50%;background:#000;position:absolute;top:2px;left:${enabled?'16px':'2px'};transition:left 0.2s;"></div>
          </div>
        </label>
        ${enabled?`<button class="btn btn-primary btn-sm" onclick="addFoodEntry('${c.id}')">+ Wpis</button>`:''}
      </div>
    </div>
    ${!enabled?`<div style="text-align:center;padding:40px 20px;background:var(--s3);border-radius:12px;border:1px dashed var(--border2);">
      <div style="font-size:32px;margin-bottom:8px;">🥗</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Dziennik Żywieniowy wyłączony</div>
      <div style="font-size:11px;color:var(--muted);">Włącz powyżej aby klient mógł dodawać zdjęcia posiłków</div>
    </div>`:
    !entries.length?`<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:32px;margin-bottom:8px;">📸</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Brak wpisów</div>
      <div style="font-size:11px;color:var(--muted);">Klient jeszcze nie dodał żadnych posiłków</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="addFoodEntry('${c.id}')">+ Dodaj przykładowy wpis</button>
    </div>`:
    dates.map(date=>`
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:8px;text-transform:uppercase;">${date===today?'📅 DZIŚ':date}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          ${byDate[date].map(e=>`
            <div style="background:var(--s3);border-radius:10px;overflow:hidden;cursor:pointer;" onclick="viewFoodEntry('${c.id}','${e.id}')">
              <div style="height:80px;background:linear-gradient(135deg,var(--s4),var(--s2));display:flex;align-items:center;justify-content:center;font-size:32px;">${e.emoji||'🍽️'}</div>
              <div style="padding:8px;">
                <div style="font-size:11px;font-weight:600;">${e.name||'Posiłek'}</div>
                <div style="font-size:10px;color:var(--muted);">${mealTypes[e.type]||e.type||''}${e.kcal?' · '+e.kcal+' kcal':''}</div>
                ${e.note?`<div style="font-size:10px;color:var(--muted2);margin-top:2px;font-style:italic;">${e.note}</div>`:''}
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')}`;
}
function addFoodEntry(clientId){
  const name=prompt('Nazwa posiłku:');if(!name)return;
  const type=prompt('Typ (breakfast/lunch/snack/dinner/other):','lunch')||'other';
  const kcal=parseInt(prompt('Kalorie (opcjonalne):',''))||null;
  const emojis={'breakfast':'🥣','lunch':'🍲','snack':'🍎','dinner':'🌮','other':'🍽️'};
  if(!window.CLIENT_FOOD[clientId])window.CLIENT_FOOD[clientId]=[];
  window.CLIENT_FOOD[clientId].push({
    id:'fe'+Date.now(),date:new Date().toISOString().split('T')[0],
    name,type,kcal,emoji:emojis[type]||'🍽️',note:'',addedAt:new Date().toISOString()
  });
  const c=CL.find(x=>x.id===clientId);if(c)renderCPFood(c);
}
function viewFoodEntry(clientId,entryId){
  const e=(window.CLIENT_FOOD[clientId]||[]).find(x=>x.id===entryId);
  if(!e)return;
  if(confirm(`${e.emoji||'🍽️'} ${e.name}\nData: ${e.date}\nKalorie: ${e.kcal||'—'}\n\nUsunąć ten wpis?`)){
    window.CLIENT_FOOD[clientId]=(window.CLIENT_FOOD[clientId]||[]).filter(x=>x.id!==entryId);
    const c=CL.find(x=>x.id===clientId);if(c)renderCPFood(c);
  }
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
      <button class="btn btn-primary btn-sm" onclick="addClientDoc('${c.id}')">+ Dodaj</button>
    </div>
    ${!docs.length?`<div style="text-align:center;padding:60px 20px;background:var(--s3);border-radius:12px;border:1px dashed var(--border2);">
      <div style="font-size:40px;margin-bottom:12px;">📂</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Brak dokumentów</div>
      <div style="font-size:11px;color:var(--muted);">Dokumenty przesłane przez klienta pojawią się tutaj</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:14px;" onclick="addClientDoc('${c.id}')">+ Dodaj dokument</button>
    </div>`:
    docs.map(d=>`
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--s3);border-radius:10px;margin-bottom:8px;">
        <div style="width:40px;height:40px;border-radius:8px;background:var(--s4);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${typeIcon[d.type]||'📁'}</div>
        <div style="flex:1;overflow:hidden;">
          <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</div>
          <div style="font-size:10px;color:var(--muted);">${d.date}${d.size?' · '+d.size:''}</div>
          ${d.note?`<div style="font-size:10px;color:var(--muted2);font-style:italic;">${d.note}</div>`:''}
        </div>
        <button onclick="delClientDoc('${c.id}','${d.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:4px;">🗑</button>
      </div>`).join('')}`;
}
function addClientDoc(clientId){
  const name=prompt('Nazwa dokumentu (np. "Ankieta wstępna.pdf"):');if(!name)return;
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
  c.clientSettings[feature]=!c.clientSettings[feature];
  persistById('clients',c);
  if(tab)setCPTab(tab);
  else renderCPSettings(c);
  notify(feature+' '+(c.clientSettings[feature]?'włączone':'wyłączone'));
}
function renderCPSettings(c){
  if(!c.clientSettings)c.clientSettings={};
  const s=c.clientSettings;
  const feat=[
    {key:'training',label:'Treningi',desc:'Przypisywanie i śledzenie treningów',icon:'💪',default:true},
    {key:'tasks',label:'Zadania',desc:'Harmonogram zadań i materiały edukacyjne',icon:'✅',default:true},
    {key:'foodJournal',label:'Dziennik żywieniowy',desc:'Klient przesyła zdjęcia posiłków',icon:'🥗',default:false},
    {key:'macros',label:'Makroelementy',desc:'Śledzenie kalorii i makroskładników',icon:'🔢',default:false},
    {key:'mealPlan',label:'Plan żywieniowy',desc:'Spersonalizowane plany diety',icon:'🍽️',default:false},
    {key:'messages',label:'Wiadomości',desc:'Czat bezpośredni z trenerem',icon:'💬',default:true},
    {key:'progressPhoto',label:'Zdjęcia postępu',desc:'Wizualizacja efektów — przed/po',icon:'📸',default:true},
    {key:'bodyMetrics',label:'Pomiary ciała',desc:'Monitorowanie pomiarów ciała',icon:'📏',default:true},
  ];
  const toggle=(key,defaultVal)=>{
    const on=s[key]!==undefined?s[key]:defaultVal;
    return `<div onclick="toggleClientFeature('${c.id}','${key}','settings')" style="width:40px;height:22px;border-radius:11px;background:${on?'var(--accent)':'var(--s4)'};cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0;">
      <div style="width:16px;height:16px;border-radius:50%;background:${on?'#0a0a0a':'var(--muted)'};position:absolute;top:3px;left:${on?'21px':'3px'};transition:left 0.2s;"></div>
    </div>`;
  };
  document.getElementById('cp-body').innerHTML=`
    <div class="cp-section-title">DANE KLIENTA</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
      <div class="form-field"><label class="form-lbl">Imię i nazwisko</label><input class="cp-edit-field form-input" id="cpe-name" value="${c.name||''}"></div>
      <div class="form-grid">
        <div class="form-field"><label class="form-lbl">Email</label><input class="cp-edit-field form-input" id="cpe-email" value="${c.email||''}"></div>
        <div class="form-field"><label class="form-lbl">Wiek</label><input type="number" class="cp-edit-field form-input" id="cpe-age" value="${c.age||''}"></div>
      </div>
      <div class="form-grid">
        <div class="form-field"><label class="form-lbl">Waga (kg)</label><input type="number" class="cp-edit-field form-input" id="cpe-weight" value="${c.weight||''}" step="0.1"></div>
        <div class="form-field"><label class="form-lbl">Wzrost (cm)</label><input type="number" class="cp-edit-field form-input" id="cpe-height" value="${c.height||''}"></div>
      </div>
      <div class="form-grid">
        <div class="form-field"><label class="form-lbl">Cel</label>
          <select class="form-select" id="cpe-goal">
            <option value="masa" ${c.goal==='masa'?'selected':''}>Budowa masy</option>
            <option value="sila" ${c.goal==='sila'?'selected':''}>Wzrost siły</option>
            <option value="redukcja" ${c.goal==='redukcja'?'selected':''}>Redukcja</option>
            <option value="kondycja" ${c.goal==='kondycja'?'selected':''}>Kondycja</option>
          </select>
        </div>
        <div class="form-field"><label class="form-lbl">Poziom</label>
          <select class="form-select" id="cpe-level">
            <option value="poczatkujacy" ${c.level==='poczatkujacy'?'selected':''}>Początkujący</option>
            <option value="sredni" ${c.level==='sredni'?'selected':''}>Średni</option>
            <option value="zaawansowany" ${c.level==='zaawansowany'?'selected':''}>Zaawansowany</option>
          </select>
        </div>
      </div>
      <div class="form-field"><label class="form-lbl">Status</label>
        <select class="form-select" id="cpe-status">
          <option value="active" ${c.status==='active'?'selected':''}>Aktywny</option>
          <option value="inactive" ${c.status==='inactive'?'selected':''}>Nieaktywny</option>
          <option value="archived" ${c.status==='archived'?'selected':''}>Zarchiwizowany</option>
        </select>
      </div>
      <div class="form-field"><label class="form-lbl">Uwagi / kontuzje</label><textarea class="form-select" id="cpe-notes" rows="2" style="resize:none;">${c.notes||''}</textarea></div>
      <button class="btn btn-primary" style="width:100%;" onclick="saveCPEdit('${c.id}')">💾 Zapisz zmiany</button>
    </div>

    <div class="cp-section-title">FUNKCJE KLIENTA</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px;">Włącz lub wyłącz funkcje dla tego klienta. Wyłączone funkcje nie będą widoczne w aplikacji klienta.</div>
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

    <button class="btn btn-danger btn-sm" style="width:100%;" onclick="archiveClient('${c.id}')">🗃 Zarchiwizuj klienta</button>`;
}
function updateClientUnit(clientId,key,value){
  const c=CL.find(x=>x.id===clientId);if(!c)return;
  if(!c.clientSettings)c.clientSettings={};
  c.clientSettings[key]=value;
  persistById('clients',c);
  notify('Zapisano');
}


