// ════════════════════════════════════════
// AI PLAN GENERATOR
// ════════════════════════════════════════
var aplGenerating=false;
var aplLastPlan=null;

// ── Lokalne obliczanie progresji na kolejne tygodnie (bez dodatkowych zapytań do AI) ──
function aplComputeProgression(ex,weekKeys,phasesMap,progressionType){
  const baseS=ex.sets,baseR=ex.reps,baseRest=ex.rest;
  const baseRpe=parseFloat(ex.rir)||7;
  let baseKgNum=null,kgSuffix='';
  if(ex.kg){
    const m=String(ex.kg).match(/^([\d.]+)/);
    if(m){baseKgNum=parseFloat(m[1]);kgSuffix=String(ex.kg).slice(m[1].length);}
  }
  weekKeys.forEach((wk,i)=>{
    if(i===0){ex[wk]={s:baseS,r:baseR,rest:baseRest,rpe:String(baseRpe),kg:ex.kg||''};return;}
    const phase=(phasesMap[wk]||'').toLowerCase();
    const isDeload=phase.includes('deload');
    let s=baseS,r=baseR,rest=baseRest,rpe=baseRpe,kg=ex.kg||'';
    if(isDeload){
      rpe=Math.max(5,baseRpe-2);
      s=String(Math.max(1,Math.round((parseInt(baseS)||3)*0.6)));
      if(baseKgNum!=null)kg=(Math.round(baseKgNum*0.7*10)/10)+kgSuffix;
    }else{
      switch(progressionType){
        case 'linear':
          rpe=Math.min(9,baseRpe+Math.floor(i/2));
          if(baseKgNum!=null)kg=(Math.round((baseKgNum+2.5*i)*10)/10)+kgSuffix;
          break;
        case 'dup':
          rpe=Math.min(9,baseRpe+Math.floor(i/3));
          if(baseKgNum!=null)kg=(Math.round((baseKgNum+1.25*i)*10)/10)+kgSuffix;
          break;
        case 'wave':
          rpe=(i%2===0)?Math.min(8,baseRpe):Math.min(9,baseRpe+1);
          if(baseKgNum!=null)kg=(Math.round((baseKgNum+(i%2===0?0:2.5))*10)/10)+kgSuffix;
          break;
        case 'block':
          if(i<weekKeys.length*0.4){rpe=Math.min(7,baseRpe);}
          else if(i<weekKeys.length*0.8){rpe=Math.min(9,baseRpe+2);}
          else{rpe=Math.min(10,baseRpe+3);}
          if(baseKgNum!=null)kg=(Math.round((baseKgNum+2*i)*10)/10)+kgSuffix;
          break;
        case 'double':
          rpe=Math.min(9,baseRpe+Math.floor(i/2));
          if(baseKgNum!=null)kg=(Math.round((baseKgNum+2*Math.floor(i/2))*10)/10)+kgSuffix;
          break;
        default:
          rpe=Math.min(9,baseRpe+Math.floor(i/2));
          if(baseKgNum!=null)kg=(Math.round((baseKgNum+2.5*i)*10)/10)+kgSuffix;
      }
    }
    ex[wk]={s,r,rest,rpe:String(rpe),kg};
  });
}

function initAplangen(){
  const sel=document.getElementById('apl-client');
  if(sel){
    sel.innerHTML='<option value="">Nowy / ręcznie wpisz</option>'+CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
  }
  if(!document.getElementById('apl-result').innerHTML){
    aplShowWelcome();
  }
}

function aplShowWelcome(){
  document.getElementById('apl-result').innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;text-align:center;padding:40px;">
      <div style="font-size:56px;margin-bottom:20px;">⚡</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:2px;margin-bottom:10px;">GENERATOR PLANÓW AI</div>
      <div style="font-size:13px;color:var(--muted);max-width:440px;line-height:1.8;margin-bottom:28px;">Wypełnij formularz po lewej stronie i kliknij <strong style="color:var(--accent);">Generuj plan</strong>. AI stworzy spersonalizowany plan treningowy z ćwiczeniami, seriami, powtórzeniami i wskazówkami metodycznymi.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:500px;">
        ${[
          {icon:'🎯',txt:'Cel i poziom klienta'},
          {icon:'📅',txt:'Dni i czas sesji'},
          {icon:'🏋️',txt:'Dostępny sprzęt'},
          {icon:'🩺',txt:'Kontuzje i limity'},
          {icon:'📋',txt:'Metoda (PPL/FBW/531)'},
          {icon:'✏️',txt:'Dodatkowe życzenia'},
        ].map(i=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:11px;color:var(--muted);"><div style="font-size:20px;margin-bottom:5px;">${i.icon}</div>${i.txt}</div>`).join('')}
      </div>
    </div>`;
}

function aplToggleOpt(btn,groupId){
  const grp=document.getElementById(groupId);
  grp.querySelectorAll('.apl-opt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function aplFillFromClient(){
  const sel=document.getElementById('apl-client');
  const cid=sel.value;
  if(!cid)return;
  const c=CL.find(x=>x.id===cid);
  if(!c)return;
  if(c.age)document.getElementById('apl-age').value=c.age;
  if(c.weight)document.getElementById('apl-weight').value=c.weight;
  if(c.height)document.getElementById('apl-height').value=c.height;
  if(c.gender)document.getElementById('apl-gender').value=c.gender;
  if(c.injuries)document.getElementById('apl-injuries').value=c.injuries;
  if(c.goal){
    document.querySelectorAll('#apl-goals .apl-opt').forEach(b=>{
      b.classList.toggle('active',b.dataset.val===c.goal);
    });
  }
  if(c.level){
    document.querySelectorAll('#apl-levels .apl-opt').forEach(b=>{
      b.classList.toggle('active',b.dataset.val===c.level);
    });
  }
  notify(`✓ Dane ${c.name} wczytane do formularza`);
}

function aplGetVal(groupId){
  const active=document.querySelector(`#${groupId} .apl-opt.active`);
  return active?.dataset?.val||'';
}

function aplGetMulti(groupId){
  return [...document.querySelectorAll(`#${groupId} .apl-opt-multi.active`)].map(b=>b.dataset.val);
}

async function aplGenerate(){
  if(aplGenerating)return;
  const goal=aplGetVal('apl-goals');
  const level=aplGetVal('apl-levels');
  const method=aplGetVal('apl-methods');
  const days=aplGetVal('apl-days');
  const duration=aplGetVal('apl-duration');
  const weeks=aplGetVal('apl-weeks');
  const equipment=aplGetMulti('apl-equipment');
  const intensify=aplGetMulti('apl-intensify');
  const age=document.getElementById('apl-age').value;
  const weight=document.getElementById('apl-weight').value;
  const height=document.getElementById('apl-height').value;
  const gender=document.getElementById('apl-gender').value;
  const injuries=document.getElementById('apl-injuries').value;
  const notes=document.getElementById('apl-notes').value;
  const cid=document.getElementById('apl-client').value;
  const client=cid?CL.find(x=>x.id===cid):null;

  // anatomia i biomechanika
  const femur=document.getElementById('apl-femur')?.value||'';
  const wingspan=document.getElementById('apl-wingspan')?.value||'';
  const ankle=document.getElementById('apl-ankle')?.value||'';
  const pelvis=document.getElementById('apl-pelvis')?.value||'';
  const asymmetry=document.getElementById('apl-asymmetry')?.value||'';

  // styl zycia
  const job=document.getElementById('apl-job')?.value||'';
  const sleepLabels=['fatalna','słaba','średnia','dobra','świetna'];
  const stressLabels=['niski','lekki','średni','wysoki','bardzo wysoki'];
  const sleep=sleepLabels[(document.getElementById('apl-sleep')?.value||3)-1];
  const stress=stressLabels[(document.getElementById('apl-stress')?.value||3)-1];

  // progresja
  const progression=aplGetVal('apl-progression')||'ai';

  const weeksNum = parseInt(weeks)||8;
  const weekKeys = ['w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11','w12'].slice(0,weeksNum);
  const PHASE_TABLES={
    1:{w1:'Tydzień 1'},
    4:{w1:'Adaptacja',w2:'Hipertrofia I',w3:'Hipertrofia II',w4:'Deload'},
    6:{w1:'Adaptacja',w2:'Hipertrofia I',w3:'Hipertrofia I',w4:'Hipertrofia II',w5:'Intensyfikacja',w6:'Deload'},
    8:{w1:'Adaptacja',w2:'Adaptacja',w3:'Hipertrofia I',w4:'Hipertrofia I',w5:'Hipertrofia II',w6:'Siła',w7:'Deload',w8:'Szczyt'},
    12:{w1:'Adaptacja',w2:'Adaptacja',w3:'Hipertrofia I',w4:'Hipertrofia I',w5:'Hipertrofia II',w6:'Hipertrofia II',w7:'Siła',w8:'Siła',w9:'Deload',w10:'Intensyfikacja',w11:'Szczyt',w12:'Test/Realizacja'},
  };
  const phasesMap = PHASE_TABLES[weeksNum] || (()=>{const o={};weekKeys.forEach((k,i)=>o[k]=i===weekKeys.length-1?'Deload':'Tydzień '+(i+1));return o;})();

  if(!goal||!level||!method||!days){
    notify('⚠ Uzupełnij wymagane pola!');return;
  }

  aplGenerating=true;
  ['apl-gen-btn','apl-gen-btn2'].forEach(id=>{
    const b=document.getElementById(id);
    if(b){b.disabled=true;b.textContent='⏳ Generuję...';}
  });

  const res=document.getElementById('apl-result');
  res.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;gap:20px;">
    <div style="width:56px;height:56px;border-radius:16px;background:var(--adim);display:flex;align-items:center;justify-content:center;">
      <div class="ai-dot" style="width:16px;height:16px;"></div>
    </div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:var(--accent);">AI GENERUJE PLAN...</div>
    <div style="font-size:12px;color:var(--muted);max-width:300px;text-align:center;line-height:1.7;">Analizuję parametry i tworzę spersonalizowany plan ${method} na ${weeks} tygodni...</div>
    <div style="display:flex;gap:6px;">${[0,1,2].map(i=>`<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 1s ${i*0.2}s infinite;"></div>`).join('')}</div>
  </div>`;

  const progressionInstructions={
    linear:'PROGRESJA LINIOWA: każdy tydzień +2.5-5kg przy tych samych seriach i powtórzeniach.',
    dup:'DUP (Daily Undulating Periodization): każda sesja inne zakresy — A: 4-6 powt. (siła), B: 8-12 (hipertrofia), C: 15-20 (wytrzymałość).',
    wave:'FALUJĄCA TYGODNIOWA: tygodnie nieparzyste = wyższa objętość RPE 7-8, parzyste = wyższa intensywność RPE 8-9.',
    block:'BLOKOWA: pierwsze tygodnie Akumulacja (10-15 powt. RPE 6-7), środkowe Intensyfikacja (6-8 powt. RPE 8-9), ostatni tydzień Deload, potem Realizacja.',
    double:'PODWÓJNA PROGRESJA: dodawaj 1 powt./tydzień do górnego zakresu, potem +2.5-5kg i reset do dolnego zakresu powtórzeń.',
  };
  const progressionInstruction = progression==='ai'
    ? 'Dobierz OPTYMALNĄ metodę progresji dla tego klienta i uzasadnij wybór w polu "periodization".'
    : progressionInstructions[progression];

  const wuEx = `[{"name":"Krążenia ramion","emoji":"🔄","sets":"2x","reps":"15","note":"mobilizacja"},{"name":"Aktywacja pośladków z gumą","emoji":"🍑","sets":"2x","reps":"12","note":"aktywacja"}]`;

  const systemPrompt=`Jesteś ekspertem programowania treningowego z certyfikatami NSCA CSCS i NASM CPT. Tworzysz szczegółowe plany treningowe w języku polskim.

WAŻNE — odpowiedz TYLKO w formacie JSON (bez żadnego dodatkowego tekstu, bez markdown, bez \`\`\`):
{
  "planName": "Nazwa planu",
  "summary": "Krótkie 2-zdaniowe uzasadnienie metodyczne",
  "method": "Nazwa metody",
  "weeks": ${weeksNum},
  "daysPerWeek": liczba,
  "sessionDuration": liczba_minut,
  "periodization": "Opis periodyzacji (np. progresja liniowa 2.5kg/tyg)",
  "deload": "Opis tygodnia deload (co ile tygodni i jak)",
  "warmup": "Ogólny protokół rozgrzewki 5-8 min (opis tekstowy, ponad sesjami)",
  "cooldown": "Protokół cool-down / schłodzenia",
  "nutritionTip": "Krótka wskazówka żywieniowa dopasowana do celu",
  "days": [
    {
      "dayName": "Dzień 1 — Push / Klatka, barki, triceps",
      "focus": "Klatka piersiowa, barki, triceps",
      "warmupExercises": ${wuEx},
      "exercises": [
        {
          "name": "Wyciskanie sztangi leżąc (płaskie)",
          "notes": "Ćwiczenie bazowe — priorytet siłowy, uwaga techniczna",
          "muscleGroup": "Klatka",
          "sets": "4",
          "reps": "8-10",
          "rest": "90s",
          "rpe": "7",
          "kg": "60"
        }
      ]
    }
  ],
  "progressionRules": ["Regułą 1", "Reguła 2"],
  "keyExercises": ["Ćwiczenie kluczowe 1", "Ćwiczenie kluczowe 2"],
  "weeklyVolume": {"chest":"12 serii","back":"14 serii","legs":"16 serii","shoulders":"10 serii","arms":"8 serii"}
}

Podaj wartości TYLKO dla tygodnia 1 (bazowe). Pole "kg" podaj jako sam SUGEROWANY CIĘŻAR STARTOWY W KG (liczba, np. "60"), albo pusty string jeśli niemożliwe do oszacowania — resztę tygodni (progresję) obliczy aplikacja automatycznie na podstawie wybranej metody progresji.

WARMUP KAŻDEJ SESJI: "warmupExercises" to lista DOKŁADNIE 3 ćwiczeń mobilizacyjno-aktywacyjnych SPECYFICZNYCH dla tej sesji (nie ogólnikowych), z polami name/emoji/sets/reps/note.

FAZY TYGODNI (kontekst dla treści "periodization"/"deload", NIE umieszczaj w JSON): ${JSON.stringify(phasesMap)}


METODA PROGRESJI (obowiązkowa): ${progressionInstruction}

OBOWIĄZKOWE PROGI OBJĘTOŚCI (MEV/MAV/MRV) NA PARTIĘ NA TYDZIEŃ — liczba serii roboczych zsumowana ze WSZYSTKICH dni treningowych w całym tygodniu:
Klatka: MEV 10 / MAV 14-18 / MRV 20
Plecy: MEV 10 / MAV 14-20 / MRV 22
Barki: MEV 12 / MAV 16-20 / MRV 22
Biceps: MEV 8 / MAV 10-14 / MRV 16
Triceps: MEV 8 / MAV 10-14 / MRV 16
Nogi (czworogłowe): MEV 12 / MAV 16-20 / MRV 24
Pośladki: MEV 6 / MAV 10-14 / MRV 16
Core: MEV 8 / MAV 10-14 / MRV 16
Wg stażu: Początkujący → doln half MEV-MAV. Średni → środek/góra MAV. Zaawansowany → góra MAV, blisko MRV.

OBOWIĄZKOWA WERYFIKACJA PRZED ZWRÓCENIEM JSON: Dla KAŻDEJ partii zsumuj w pamięci liczbę serii roboczych ze WSZYSTKICH dni treningowych tygodnia (licz tylko ćwiczenia, gdzie ta partia jest głównym celem). Jeśli suma dla jakiejkolwiek partii jest PONIŻEJ MEV z tabeli — to błąd krytyczny: dodaj kolejne ćwiczenie lub serię w jednym z dni, zanim oddasz plan. Pole "weeklyVolume" w JSON MUSI odzwierciedlać faktyczną, sprawdzoną sumę, nie szacunek.
SZCZEGÓLNA UWAGA przy podziałach Upper/Lower, Push/Pull/Legs: gdy dana partia (np. barki, biceps) pojawia się tylko w części dni tygodnia, łatwo przypadkiem zejść poniżej MEV mimo że pojedynczy dzień "wygląda nieźle" — zawsze licz sumę tygodniową, nie objętość jednego dnia.

METODY INTENSYFIKACJI DO WYKORZYSTANIA (zaznaczone przez trenera): ${intensify.length?intensify.join(', '):'brak — standardowe serie proste'}. Jeśli zaznaczono, w polu "notes" wybranych ćwiczeń zaznacz zastosowaną metodę (np. "Drop-set na ostatniej serii: -20% ciężaru do upadku").

UWZGLĘDNIJ ANATOMIĘ I BIOMECHANIKĘ KLIENTA przy doborze wariantów ćwiczeń (np. długa kość udowa → przysiad na maszynie hack/suwnicy zamiast klasycznego przysiadu ze sztangą; ograniczona mobilność skokowa → dodaj podkładki pod pięty lub zamień na wykroki; długie ramiona → węższy chwyt w wyciskaniu).

Stwórz PEŁNY plan z wszystkimi dniami i 5-6 ćwiczeniami na dzień (plus 2 na core na końcu każdej sesji siłowej).`;

  const userMsg=`Stwórz plan treningowy:
- Cel: ${goal}
- Poziom: ${level}
- Metoda: ${method}
- Dni/tydzień: ${days}
- Czas sesji: ${duration} minut
- Długość planu: ${weeks} tygodni
- Sprzęt: ${equipment.join(', ')||'pełna siłownia'}
${age?`- Wiek: ${age} lat`:''}
${gender?`- Płeć: ${gender}`:''}
${weight?`- Waga: ${weight} kg`:''}
${height?`- Wzrost: ${height} cm`:''}
${injuries?`- Kontuzje/ograniczenia: ${injuries}`:''}
${femur?`- Długość kości udowej: ${femur}`:''}
${wingspan?`- Zasięg ramion: ${wingspan}`:''}
${ankle?`- Mobilność stawu skokowego: ${ankle}`:''}
${pelvis?`- Budowa miednicy: ${pelvis}`:''}
${asymmetry?`- Dominacja stron/asymetrie: ${asymmetry}`:''}
${job?`- Rodzaj pracy (NEAT): ${job}`:''}
- Jakość snu: ${sleep}
- Poziom stresu: ${stress}
${notes?`- Dodatkowe uwagi: ${notes}`:''}
${client?`- Klient: ${client.name}, cel: ${client.goal}, poziom: ${client.level}`:''}${cid&&typeof sfrGetContextForAI==='function'?sfrGetContextForAI(cid):''}`;

  try{
    const fetchOpts={
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens: Math.min(4500+(parseInt(days)||4)*1300, 9500),
        system:systemPrompt,
        messages:[{role:'user',content:userMsg}]
      })
    };
    let resp=await fetch('https://anthropic-proxy.teamprogress2018.workers.dev/',fetchOpts);
    let attempt=0;
    while(!resp.ok && attempt<2){
      attempt++;
      await new Promise(r=>setTimeout(r,attempt*3000));
      resp=await fetch('https://anthropic-proxy.teamprogress2018.workers.dev/',fetchOpts);
    }
    if(!resp.ok){
      throw new Error('Serwer AI przeciążony (status '+resp.status+') po '+(attempt+1)+' próbach.');
    }
    const data=await resp.json();
    const raw=data?.content?.[0]?.text||'';
    const clean=raw.replace(/```json|```/g,'').trim();
    let plan;
    try{plan=JSON.parse(clean);}catch(e){
      // fallback — try to extract JSON
      const m=clean.match(/\{[\s\S]+\}/);
      if(m)plan=JSON.parse(m[0]);
      else throw new Error('JSON parse failed');
    }
    aplLastPlan=plan;
    aplLastClient=client;
    plan.phases=phasesMap;
    plan.weekKeys=weekKeys;
    plan.currentWeek=plan.currentWeek||weekKeys[0];
    (plan.days||[]).forEach(d=>{
      (d.exercises||[]).forEach(ex=>{
        ex.sets=ex.sets||'3';ex.reps=ex.reps||'10';ex.rest=ex.rest||'90s';ex.rir=ex.rir||ex.rpe||'7';
        aplComputeProgression(ex,weekKeys,phasesMap,progression);
      });
    });
    aplRenderPlan(plan,client,goal,method,days,weeks);
  }catch(e){
    console.error('aplGenerate błąd:',e);
    const isTimeout=/524|przeciążon|timeout/i.test(e?.message||'');
    res.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:14px;text-align:center;padding:40px;">
      <div style="font-size:40px;">${isTimeout?'⏱️':'❌'}</div>
      <div style="font-size:15px;font-weight:700;color:var(--red);">${isTimeout?'Serwer AI jest chwilowo przeciążony':'Błąd generowania planu'}</div>
      <div style="font-size:12px;color:var(--muted);max-width:320px;">${isTimeout?'To zwykle mija po chwili. Odczekaj 30-60 sekund i spróbuj ponownie.':'Sprawdź połączenie internetowe i spróbuj ponownie.'}</div>
      <button class="btn btn-primary" onclick="aplGenerate()">↺ Spróbuj ponownie</button>
    </div>`;
  }

  aplGenerating=false;
  ['apl-gen-btn','apl-gen-btn2'].forEach(id=>{
    const b=document.getElementById(id);
    if(b){b.disabled=false;b.innerHTML='✨ Generuj plan';}
  });
}

function aplRenderPlan(plan,client,goal,method,days,weeks){
  const goalLabels={masa:'💪 Budowa masy',sila:'🏋️ Wzrost siły',redukcja:'🔥 Redukcja',kondycja:'🏃 Kondycja',atletyzm:'⚡ Atletyzm',rehab:'🩺 Rehabilitacja'};
  const res=document.getElementById('apl-result');
  const weekKeys=plan.weekKeys||['w1'];
  const phases=plan.phases||{w1:'Tydzień 1'};
  const curWeek=plan.currentWeek||weekKeys[0];
  const curWeekIdx=weekKeys.indexOf(curWeek);
  const phaseColors={'Adaptacja':'var(--blue)','Hipertrofia I':'var(--teal)','Hipertrofia II':'var(--teal)','Siła':'var(--gold)','Deload':'var(--muted)','Intensyfikacja':'var(--orange)','Szczyt':'var(--accent)','Test/Realizacja':'var(--accent)'};
  const phaseColor=(ph)=>{for(const k in phaseColors){if((ph||'').includes(k))return phaseColors[k];}return 'var(--accent)';};

  let html=`
    <!-- plan header -->
    <div style="background:linear-gradient(135deg,var(--adim),transparent);border:1px solid rgba(225,31,46,0.25);border-radius:16px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:var(--glow);">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent);"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:1px;margin-bottom:4px;">${plan.planName||'Plan treningowy AI'}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.6;">${plan.summary||''}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="aplSavePlan()">💾 Zapisz plan</button>
          <button class="btn btn-ghost btn-sm" onclick="aplExportPlanPDF()">📄 PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="aplExportPlan()">⬇ JSON</button>
          <button class="btn btn-ghost btn-sm" onclick="aplGenerate()">↺ Regeneruj</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="pill pill-green">${goalLabels[goal]||goal}</span>
        <span class="pill" style="background:var(--s3);color:var(--muted);">📅 ${plan.daysPerWeek||days}×/tydzień</span>
        <span class="pill" style="background:var(--s3);color:var(--muted);">⏱ ${plan.sessionDuration||60} min</span>
        <span class="pill" style="background:var(--s3);color:var(--muted);">📆 ${plan.weeks||weeks} tygodni</span>
        <span class="pill" style="background:var(--s3);color:var(--muted);">🔁 ${plan.method||method}</span>
      </div>
    </div>

    <!-- 3-panel: zasady progresji / rozgrzewka / schłodzenie (kolory dopasowane 1:1 do Progress Studio AI) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-bottom:16px;">
      <div style="background:rgba(74,222,128,0.05);border:1px solid rgba(74,222,128,0.2);border-radius:12px;padding:16px 18px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:14px;">📈</span>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1px;color:#4ade80;">ZASADY PROGRESJI</span>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7;">${plan.periodization||''}</div>
        ${plan.progressionRules?.length?`<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">${plan.progressionRules.map(r=>`<div style="display:flex;gap:6px;font-size:11px;color:var(--muted);line-height:1.5;"><span style="color:#4ade80;flex-shrink:0;">→</span>${r}</div>`).join('')}</div>`:''}
        <div style="font-family:'Bebas Neue',sans-serif;font-size:10px;letter-spacing:1px;color:#4ade80;margin-top:10px;margin-bottom:3px;">DELOAD</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.6;">${plan.deload||'Co 4-6 tygodni: 50% objętości'}</div>
      </div>
      <div style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:16px 18px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:14px;">🔥</span>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1px;color:#f59e0b;">PROTOKÓŁ ROZGRZEWKI</span>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7;">${plan.warmup||'5-8 min cardio lekkie + mobilizacja'}</div>
      </div>
      <div style="background:rgba(248,113,113,0.05);border:1px solid rgba(248,113,113,0.2);border-radius:12px;padding:16px 18px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:14px;">❄️</span>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1px;color:#f87171;">SCHŁODZENIE</span>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7;">${plan.cooldown||'5 min stretchingu statycznego'}</div>
      </div>
    </div>

    <!-- legenda -->
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:7px 14px;margin-bottom:14px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
      <span style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px;">Legenda:</span>
      <span style="font-size:10px;color:var(--teal);">✏️ <b>Powt./Serie/Przerwa</b> — edytuj przez ✏️</span>
      <span style="font-size:10px;color:var(--accent);">🏷️ <b>RPE</b> — docelowy poziom wysiłku danego tygodnia</span>
      <span style="font-size:10px;color:var(--gold);">⚖️ <b>Ciężar ref.</b> — punkt startowy, koryguj wg odczucia</span>
    </div>`;

  // ── NAWIGATOR TYGODNI ──
  if(weekKeys.length>1){
    html+=`<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">`;
    weekKeys.forEach((wk,i)=>{
      const ph=phases[wk]||('Tydzień '+(i+1));
      const col=phaseColor(ph);
      const active=i===curWeekIdx;
      html+=`<button onclick="aplSetWeek(${i})" style="padding:7px 14px;border-radius:8px;border:1px solid ${active?col:'var(--border)'};background:${active?'var(--adim)':'var(--s3)'};color:${active?col:'var(--muted)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;transition:all .12s;">TYG ${i+1} <span style="opacity:.75;">${ph}</span></button>`;
    });
    html+=`</div>`;
  }

  const curPhase=phases[curWeek]||'Tydzień '+(curWeekIdx+1);
  const curCol=phaseColor(curPhase);
  html+=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:${curCol};">TYDZIEŃ ${curWeekIdx+1}</div>
    <div style="background:var(--s3);border:1px solid ${curCol};border-radius:20px;padding:3px 12px;font-size:9px;font-family:'DM Mono',monospace;color:${curCol};letter-spacing:.5px;">${curPhase}</div>
  </div>`;

  // ── DNI TRENINGOWE ──
  (plan.days||[]).forEach((d,di)=>{
    const warmupExs=d.warmupExercises||[];
    html+=`<div style="margin-bottom:22px;border-radius:14px;overflow:hidden;border:1px solid rgba(225,31,46,0.2);">
      <div style="background:var(--adim);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1.5px;color:var(--accent);">${d.dayName}</div>
          ${d.focus?`<div style="font-size:10px;color:var(--muted);margin-top:2px;">${d.focus}</div>`:''}
        </div>
        <span style="font-size:10px;background:var(--s3);color:var(--muted);border-radius:6px;padding:3px 10px;font-family:'DM Mono',monospace;">${(d.exercises||[]).length} ćwiczeń</span>
      </div>`;

    if(warmupExs.length){
      html+=`<div style="background:rgba(201,162,39,0.04);padding:14px 20px 16px;">
        <div style="font-size:9px;font-family:'DM Mono',monospace;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🔥 Rozgrzewka — mobilizacja &amp; aktywacja</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">
          ${warmupExs.map(ex=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;display:flex;gap:9px;align-items:flex-start;">
            <span style="font-size:18px;flex-shrink:0;">${ex.emoji||'🔸'}</span>
            <div style="min-width:0;">
              <div style="font-size:11px;font-weight:600;line-height:1.3;">${ex.name||''}</div>
              <div style="font-size:10px;color:var(--gold);font-family:'DM Mono',monospace;margin-top:2px;">${ex.sets||''}&nbsp;×&nbsp;${ex.reps||''}</div>
              ${ex.note?`<div style="font-size:9px;color:var(--muted);font-style:italic;margin-top:2px;">${ex.note}</div>`:''}
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    }

    html+=`<div style="background:var(--s2);">
      <div style="padding:10px 20px;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border);">
        <span style="font-size:9px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">📋 Ćwiczenia główne</span>
      </div>`;

    (d.exercises||[]).forEach((ex,ei)=>{
      const wp=ex[curWeek]||{};
      const sets=wp.s||ex.sets||'3';
      const reps=wp.r||ex.reps||'10';
      const rest=wp.rest||ex.rest||'90s';
      const rpe=wp.rpe||ex.rir||'';
      const kg=wp.kg||'';
      const isLast=ei===(d.exercises.length-1);
      html+=`<div id="apl-ex-row-${di}-${ei}" style="padding:15px 20px;${!isLast?'border-bottom:1px solid rgba(255,255,255,0.05);':''}">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div class="apl-ex-num" style="flex-shrink:0;margin-top:2px;">${ei+1}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;line-height:1.3;">${ex.name}</div>
            ${ex.notes?`<div style="font-size:11px;color:var(--muted);margin-top:5px;font-style:italic;line-height:1.6;">💡 ${ex.notes}</div>`:''}
            ${ex.muscleGroup?`<span style="font-size:9px;background:var(--s3);color:var(--muted);border-radius:4px;padding:1px 6px;margin-top:5px;display:inline-block;">${ex.muscleGroup}</span>`:''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
            ${rpe?`<span style="font-size:10px;color:var(--accent);background:var(--adim);border:1px solid rgba(225,31,46,0.3);border-radius:6px;padding:3px 9px;font-family:'DM Mono',monospace;font-weight:700;">RPE ${rpe}</span>`:''}
            <button onclick="aplEditExercise(${di},${ei})" title="Edytuj" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;opacity:.75;">✏️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;padding-left:42px;">
          <div style="background:var(--s3);border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Serie</div>
            <div style="font-size:16px;font-family:'Bebas Neue',sans-serif;color:var(--accent);">${sets}</div>
          </div>
          <div style="background:var(--s3);border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Powt.</div>
            <div style="font-size:16px;font-family:'Bebas Neue',sans-serif;color:var(--teal);">${reps}</div>
          </div>
          <div style="background:var(--s3);border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Przerwa</div>
            <div style="font-size:16px;font-family:'Bebas Neue',sans-serif;color:var(--muted);">${rest}</div>
          </div>
          <div style="background:var(--s3);border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Ciężar ref.</div>
            <div style="font-size:12px;font-family:'Bebas Neue',sans-serif;color:var(--gold);">${kg||'wg odczucia'}</div>
          </div>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  });

  // ── OBJĘTOŚĆ TYGODNIOWA + ODŻYWIANIE (na dole) ──
  html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">`;
  if(plan.weeklyVolume){
    html+=`<div class="apl-day-block">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1px;color:var(--accent);margin-bottom:10px;">📊 OBJĘTOŚĆ/TYDZIEŃ</div>
      ${Object.entries(plan.weeklyVolume).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);text-transform:capitalize;">${k}</span><span style="font-family:'DM Mono',monospace;color:var(--accent);font-weight:700;">${v}</span></div>`).join('')}
    </div>`;
  }
  if(plan.nutritionTip){
    html+=`<div class="apl-day-block">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1px;color:var(--gold);margin-bottom:8px;">🥗 ODŻYWIANIE</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7;">${plan.nutritionTip}</div>
    </div>`;
  }
  html+=`</div>`;

  res.innerHTML=html;
}

function aplSetWeek(idx){
  if(!aplLastPlan||!aplLastPlan.weekKeys)return;
  aplLastPlan.currentWeek=aplLastPlan.weekKeys[idx];
  aplRenderPlan(aplLastPlan,aplLastClient,aplLastPlan.method,aplLastPlan.method,aplLastPlan.daysPerWeek,aplLastPlan.weeks);
}

// ════════════════════════════════════════
// EDYCJA ĆWICZENIA W WYGENEROWANYM PLANIE
// ════════════════════════════════════════
let aplLastClient=null;

function aplEditExercise(di,ei){
  const ex=aplLastPlan.days[di].exercises[ei];
  const curWeek=aplLastPlan.currentWeek||(aplLastPlan.weekKeys||['w1'])[0];
  const wp=ex[curWeek]||{};
  const row=document.getElementById(`apl-ex-row-${di}-${ei}`);
  if(!row||!ex)return;
  row.innerHTML=`
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div class="apl-ex-num" style="flex-shrink:0;margin-top:2px;">${ei+1}</div>
      <div style="flex:1;min-width:0;">
        <input type="text" id="apl-edit-name-${di}-${ei}" value="${(ex.name||'').replace(/"/g,'&quot;')}" style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 9px;color:var(--text);font-size:13px;font-weight:700;margin-bottom:5px;">
        <input type="text" id="apl-edit-notes-${di}-${ei}" value="${(ex.notes||'').replace(/"/g,'&quot;')}" placeholder="notatka" style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:5px 9px;color:var(--muted);font-size:11px;">
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button onclick="aplSaveExerciseEdit(${di},${ei})" title="Zapisz" style="background:var(--teal);border:none;border-radius:6px;width:26px;height:26px;color:#000;cursor:pointer;font-size:13px;">✓</button>
        <button onclick="aplRerenderCurrent()" title="Anuluj" style="background:var(--s3);border:1px solid var(--border2);border-radius:6px;width:26px;height:26px;color:var(--red);cursor:pointer;font-size:12px;">✕</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;padding-left:42px;">
      <div><div style="font-size:8px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Serie</div><input type="text" id="apl-edit-sets-${di}-${ei}" value="${wp.s||ex.sets||''}" style="width:100%;text-align:center;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 2px;color:var(--accent);font-size:12px;"></div>
      <div><div style="font-size:8px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Powt.</div><input type="text" id="apl-edit-reps-${di}-${ei}" value="${wp.r||ex.reps||''}" style="width:100%;text-align:center;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 2px;color:var(--teal);font-size:12px;"></div>
      <div><div style="font-size:8px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Przerwa</div><input type="text" id="apl-edit-rest-${di}-${ei}" value="${wp.rest||ex.rest||''}" style="width:100%;text-align:center;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 2px;color:var(--text);font-size:12px;"></div>
      <div><div style="font-size:8px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">RPE / kg</div><input type="text" id="apl-edit-rir-${di}-${ei}" value="${wp.rpe||ex.rir||''}" style="width:100%;text-align:center;background:var(--s3);border:1px solid var(--border2);border-radius:6px;padding:6px 2px;color:var(--gold);font-size:12px;"></div>
    </div>`;
}

function aplSaveExerciseEdit(di,ei){
  const ex=aplLastPlan.days[di].exercises[ei];
  const curWeek=aplLastPlan.currentWeek||(aplLastPlan.weekKeys||['w1'])[0];
  ex.name=document.getElementById(`apl-edit-name-${di}-${ei}`).value.trim()||ex.name;
  ex.notes=document.getElementById(`apl-edit-notes-${di}-${ei}`).value.trim();
  if(!ex[curWeek])ex[curWeek]={};
  ex[curWeek].s=document.getElementById(`apl-edit-sets-${di}-${ei}`).value.trim();
  ex[curWeek].r=document.getElementById(`apl-edit-reps-${di}-${ei}`).value.trim();
  ex[curWeek].rest=document.getElementById(`apl-edit-rest-${di}-${ei}`).value.trim();
  ex[curWeek].rpe=document.getElementById(`apl-edit-rir-${di}-${ei}`).value.trim();
  // zachowaj kompatybilność wsteczną (tydzień 1 = pola płaskie)
  if(curWeek===(aplLastPlan.weekKeys||['w1'])[0]){
    ex.sets=ex[curWeek].s;ex.reps=ex[curWeek].r;ex.rest=ex[curWeek].rest;ex.rir=ex[curWeek].rpe;
  }
  notify('✓ Ćwiczenie zaktualizowane');
  aplRerenderCurrent();
}

function aplRerenderCurrent(){
  if(!aplLastPlan)return;
  aplRenderPlan(aplLastPlan,aplLastClient,aplLastPlan.method,aplLastPlan.method,aplLastPlan.daysPerWeek,aplLastPlan.weeks);
}

function aplSavePlan(){
  if(!aplLastPlan){notify('Brak planu do zapisania!');return;}
  const cid=document.getElementById('apl-client').value;
  const client=cid?CL.find(x=>x.id===cid):null;
  const curWeek=aplLastPlan.currentWeek||(aplLastPlan.weekKeys||['w1'])[0];
  const newPlan=withTrainer({
    id:newId('p'),
    name:aplLastPlan.planName||'Plan AI',
    clientId:cid||null,
    clientName:client?client.name:'',
    method:aplLastPlan.method||'Custom',
    duration:aplLastPlan.weeks||8,
    days:(aplLastPlan.days||[]).map(d=>({
      day:d.dayName,
      muscles:d.focus||'',
      exercises:(d.exercises||[]).map(e=>{
        const wp=e[curWeek]||{};
        return{name:e.name,sets:wp.s||e.sets||'3',reps:wp.r||e.reps||'10',rest:wp.rest||e.rest||'90s',rpe:wp.rpe||e.rir||''};
      })
    })),
    source:'ai',
    createdAt:new Date().toISOString()
  });
  PL.push(newPlan);
  persistById('plans',newPlan);
  addNotification('system','Plan AI zapisany!','"'+newPlan.name+'" dodany do planów'+(client?' klienta '+client.name:''),'plans');
  notify(`✅ Plan "${newPlan.name}" zapisany${client?' dla '+client.name:''}!`);
}

function aplExportPlan(){
  if(!aplLastPlan){notify('Brak planu!');return;}
  const txt=JSON.stringify(aplLastPlan,null,2);
  const blob=new Blob([txt],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`plan-${aplLastPlan.planName?.replace(/\s/g,'-')||'ai'}.json`;
  a.click();
  notify('⬇ Plan wyeksportowany jako JSON');
}

// ════════════════════════════════════════
// EKSPORT PLANU DO PDF (przez istniejący #report-overlay)
// ════════════════════════════════════════
function aplExportPlanPDF(){
  if(!aplLastPlan){notify('Brak planu!');return;}
  const cid=document.getElementById('apl-client')?.value;
  const client=cid?CL.find(x=>x.id===cid):null;
  const html=buildPlanPDFHTML(aplLastPlan,client);
  document.getElementById('report-container').innerHTML=html;
  document.getElementById('report-overlay-title').textContent='PLAN TRENINGOWY — '+(aplLastPlan.planName||'AI').toUpperCase();
  document.getElementById('report-overlay').style.display='flex';
}

function buildPlanPDFHTML(plan,client){
  const bg='#ffffff',surface='#f8f9fa',border='#e0e0e0',text='#1a1a2a',muted='#6b7280';
  const accent='#7c3aed',accentDim='rgba(124,58,237,0.08)',orange='#ea580c',teal='#0d9488';
  const today=new Date().toLocaleDateString('pl',{day:'numeric',month:'long',year:'numeric'});

  const card=(content,extra='')=>`<div style="background:${surface};border:1px solid ${border};border-radius:14px;padding:20px 24px;margin-bottom:16px;${extra}">${content}</div>`;
  const sectionTitle=(t,icon,col=accent)=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid ${col}40;">
    <div style="font-size:20px;">${icon}</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1.5px;color:${col};">${t}</div>
  </div>`;

  let html=`<div style="max-width:850px;margin:0 auto;padding:40px 30px;font-family:'DM Sans',sans-serif;color:${text};">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:1px;color:${accent};">${plan.planName||'Plan treningowy AI'}</div>
        <div style="font-size:13px;color:${muted};margin-top:4px;">${client?'Klient: '+client.name+' · ':''}Wygenerowano: ${today}</div>
      </div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:${muted};">PROGRESS LIVE</div>
    </div>
    ${plan.summary?`<div style="font-size:13px;color:${text};line-height:1.6;margin:14px 0 20px;padding:14px 16px;background:${accentDim};border-radius:10px;border-left:3px solid ${accent};">${plan.summary}</div>`:''}

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
      ${[['📅',plan.daysPerWeek||'-','dni/tydz.'],['⏱',(plan.sessionDuration||60)+'min','sesja'],['📆',plan.weeks||'-','tygodni'],['🎯',plan.method||'-','metoda']].map(([icon,val,lbl])=>
        `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:18px;">${icon}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:${accent};margin:2px 0;">${val}</div>
          <div style="font-size:9px;color:${muted};text-transform:uppercase;">${lbl}</div>
        </div>`
      ).join('')}
    </div>`;

  if(plan.periodization||plan.deload){
    html+=card(`
      ${plan.periodization?`<div style="margin-bottom:10px;"><b style="color:${accent};font-size:12px;">📈 Periodyzacja:</b> <span style="font-size:12px;">${plan.periodization}</span></div>`:''}
      ${plan.deload?`<div><b style="color:${orange};font-size:12px;">🔄 Deload:</b> <span style="font-size:12px;">${plan.deload}</span></div>`:''}
    `);
  }

  (plan.days||[]).forEach((day,i)=>{
    html+=card(`
      ${sectionTitle(day.dayName||('Dzień '+(i+1)),'💪')}
      ${day.focus?`<div style="font-size:11px;color:${muted};margin-bottom:12px;">Focus: ${day.focus}</div>`:''}
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="border-bottom:2px solid ${border};text-align:left;">
          <th style="padding:6px 8px;color:${muted};font-weight:600;">Ćwiczenie</th>
          <th style="padding:6px 8px;color:${muted};font-weight:600;">Serie</th>
          <th style="padding:6px 8px;color:${muted};font-weight:600;">Powt.</th>
          <th style="padding:6px 8px;color:${muted};font-weight:600;">Przerwa</th>
          <th style="padding:6px 8px;color:${muted};font-weight:600;">Tempo</th>
          <th style="padding:6px 8px;color:${muted};font-weight:600;">RIR</th>
        </tr></thead>
        <tbody>
        ${(day.exercises||[]).map(e=>`<tr style="border-bottom:1px solid ${border};">
          <td style="padding:7px 8px;font-weight:600;">${e.name||''}${e.notes?`<div style="font-size:9px;color:${muted};font-weight:400;margin-top:2px;">${e.notes}</div>`:''}</td>
          <td style="padding:7px 8px;">${e.sets||'-'}</td>
          <td style="padding:7px 8px;">${e.reps||'-'}</td>
          <td style="padding:7px 8px;">${e.rest||'-'}</td>
          <td style="padding:7px 8px;">${e.tempo||'-'}</td>
          <td style="padding:7px 8px;">${e.rir||'-'}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    `);
  });

  if(plan.warmup||plan.cooldown){
    html+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      ${plan.warmup?card(`<div style="font-size:11px;"><b style="color:${teal};">🔥 Rozgrzewka:</b><br>${plan.warmup}</div>`):''}
      ${plan.cooldown?card(`<div style="font-size:11px;"><b style="color:${accent};">🧊 Cool-down:</b><br>${plan.cooldown}</div>`):''}
    </div>`;
  }

  if(plan.weeklyVolume){
    html+=card(`
      ${sectionTitle('Objętość tygodniowa wg partii','📊')}
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${Object.entries(plan.weeklyVolume).map(([k,v])=>`<span style="background:${bg};border:1px solid ${border};border-radius:20px;padding:5px 12px;font-size:11px;">${k}: <b>${v}</b></span>`).join('')}
      </div>
    `);
  }

  if(plan.progressionRules?.length){
    html+=card(`
      ${sectionTitle('Zasady progresji','📈',teal)}
      <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.8;">${plan.progressionRules.map(r=>`<li>${r}</li>`).join('')}</ul>
    `);
  }

  if(plan.nutritionTip){
    html+=card(`<div style="font-size:12px;"><b style="color:${orange};">🥗 Wskazówka żywieniowa:</b> ${plan.nutritionTip}</div>`);
  }

  html+=`<div style="text-align:center;margin-top:24px;font-size:10px;color:${muted};">Plan wygenerowany przez AI · Progress Live · ${today}</div>
    </div>`;
  return html;
}

function aplReset(){
  aplLastPlan=null;
  aplShowWelcome();
}

window.initAplangen=initAplangen;window.aplToggleOpt=aplToggleOpt;
window.aplFillFromClient=aplFillFromClient;window.aplGenerate=aplGenerate;
window.aplSavePlan=aplSavePlan;window.aplExportPlan=aplExportPlan;window.aplExportPlanPDF=aplExportPlanPDF;window.aplReset=aplReset;
window.aplEditExercise=aplEditExercise;window.aplSaveExerciseEdit=aplSaveExerciseEdit;window.aplRerenderCurrent=aplRerenderCurrent;

// ════════════════════════════════════════
// STATYSTYKI BIZNESOWE
// ════════════════════════════════════════
var bizPeriod=30;

function setBizPeriod(p,btn){
  bizPeriod=p;
  document.querySelectorAll('#bst-p-30,#bst-p-90,#bst-p-365').forEach(b=>b?.classList.remove('active'));
  btn?.classList.add('active');
  renderBizStats();
}

function initBizStats(){renderBizStats();}

function renderBizStats(){
  const el=document.getElementById('biz-content');if(!el)return;
  const D=bizGenerateData(bizPeriod);
  el.innerHTML=`
    <!-- KPI ROW -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:24px;">
      ${bizKPI('💰','Przychód',D.revenue,'PLN',D.revenueGrowth)}
      ${bizKPI('👥','Aktywni klienci',D.activeClients,'os.',D.clientsGrowth)}
      ${bizKPI('📅','Sesji w okresie',D.sessions,'',D.sessionsGrowth)}
      ${bizKPI('🔄','Retencja',D.retention,'%',D.retentionDiff,'pp')}
      ${bizKPI('💎','Śr. wartość klienta',D.ltv,'PLN',D.ltvGrowth)}
    </div>

    <!-- dwie kolumny -->
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:16px;">
      <!-- wykres przychodów -->
      <div class="stat-card">
        <div class="stat-card-hdr">
          <div>
            <div class="stat-card-title">Przychody miesięczne</div>
            <div class="stat-card-sub">Faktyczne vs prognozowane</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);">${D.revenue.toLocaleString('pl')} PLN</div>
        </div>
        ${bizRevenueChart(D)}
      </div>

      <!-- podział przychodów pie-like -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Podział przychodów</div></div>
        ${bizRevenueBreakdown(D)}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px;">
      <!-- retencja -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Retencja klientów</div><div class="stat-card-sub">Cohort view</div></div>
        ${bizRetentionChart(D)}
      </div>

      <!-- akwizycja -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Nowi vs odchodzący</div></div>
        ${bizAcquisitionChart(D)}
      </div>

      <!-- sesje per klient -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Aktywność klientów</div></div>
        ${bizActivityChart(D)}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-bottom:16px;">
      <!-- top klienci -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Top klienci wg przychodu</div></div>
        ${bizTopClients(D)}
      </div>

      <!-- metryki biznesowe -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Kluczowe wskaźniki</div></div>
        ${bizMetrics(D)}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <!-- godziny sesji heatmap -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Popularność godzin sesji</div></div>
        ${bizHeatmap(D)}
      </div>

      <!-- prognoza -->
      <div class="stat-card">
        <div class="stat-card-hdr"><div class="stat-card-title">Prognoza na kolejne 3 miesiące</div></div>
        ${bizForecast(D)}
      </div>
    </div>`;
}

function bizGenerateData(period){
  // base from real data or generate realistic demo
  const clientCount=CL.length||12;
  const sessionCount=SE.length||Math.round(clientCount*period/7*0.8);
  const baseRevPerClient=800;
  const revenue=Math.round(clientCount*baseRevPerClient*(period/30)*0.9+Math.random()*2000);
  const months=period<=30?['Kwi','Maj']:period<=90?['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz']:
    ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  const cnt=months.length;
  // revenue series — growing trend with noise
  const revSeries=months.map((_,i)=>{
    const base=Math.round((clientCount-2+i*0.4)*baseRevPerClient*(period<=30?1:period<=90?0.33:0.083));
    return base+Math.round((Math.random()-0.4)*base*0.15);
  });
  const forecastSeries=[revSeries[cnt-1]*1.04,revSeries[cnt-1]*1.08,revSeries[cnt-1]*1.13].map(Math.round);
  const newClients=months.map((_,i)=>Math.round(1.5+i*0.2+Math.random()*1.5));
  const lostClients=months.map(()=>Math.round(Math.random()*1.2));
  return{
    revenue,revenueGrowth:12,
    activeClients:clientCount,clientsGrowth:3,
    sessions:sessionCount,sessionsGrowth:8,
    retention:87,retentionDiff:2,
    ltv:Math.round(baseRevPerClient*5.5),ltvGrowth:7,
    months,revSeries,forecastSeries,newClients,lostClients,
    breakdown:[
      {label:'Pakiety sesji',pct:55,col:'var(--accent)'},
      {label:'Plany online',pct:24,col:'var(--blue)'},
      {label:'On-demand',pct:13,col:'var(--purple)'},
      {label:'Inne',pct:8,col:'var(--muted)'},
    ],
    cohorts:[92,87,81,75,70,65],
    topClients:CL.slice(0,6).map((c,i)=>({name:c.name,rev:Math.round((8-i)*290+Math.random()*200),sessions:Math.round((8-i)*1.5+Math.random()*3)})),
    hourDist:[0,0,1,2,4,6,8,5,3,2,3,5,6,4,3,2,4,6,8,7,5,3,1,0],
    churnRate:6,nps:72,avgSessionLength:58,utilizationRate:83,
  };
}

function bizKPI(icon,label,val,unit,growth,growthUnit='%'){
  const pos=growth>=0;
  const disp=typeof val==='number'&&val>1000?val.toLocaleString('pl'):val;
  return `<div class="stat-kpi">
    <div style="font-size:20px;margin-bottom:6px;">${icon}</div>
    <div class="stat-kpi-val">${disp}<span style="font-size:13px;font-weight:400;color:var(--muted);margin-left:3px;">${unit}</span></div>
    <div class="stat-kpi-label">${label}</div>
    <div class="stat-kpi-growth ${pos?'pos':'neg'}">${pos?'↑':'↓'} ${Math.abs(growth)}${growthUnit} vs poprzedni okres</div>
  </div>`;
}

function bizRevenueChart(D){
  const max=Math.max(...D.revSeries,...D.forecastSeries)*1.15||1;
  const W=480,H=140,pad=30;
  const iW=W-pad*2,iH=H-pad;
  const n=D.revSeries.length;
  const pts=D.revSeries.map((v,i)=>[pad+i*(iW/(n-1)),H-pad-Math.round(v/max*iH)]);
  const fStart=pts[pts.length-1];
  const fPts=[fStart,...D.forecastSeries.map((v,i)=>[pad+(n+i)*(iW/(n+D.forecastSeries.length-1)),H-pad-Math.round(v/max*iH)])];
  const poly=pts.map(([x,y])=>`${x},${y}`).join(' ');
  const fPoly=fPts.map(([x,y])=>`${x},${y}`).join(' ');
  const area=`${pts[0][0]},${H-pad} ${poly} ${pts[pts.length-1][0]},${H-pad}`;
  const fArea=`${fPts[0][0]},${H-pad} ${fPoly} ${fPts[fPts.length-1][0]},${H-pad}`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%">
    <defs>
      <linearGradient id="rg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
      <linearGradient id="rg2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--blue)" stop-opacity=".15"/><stop offset="100%" stop-color="var(--blue)" stop-opacity="0"/></linearGradient>
    </defs>
    <polygon points="${area}" fill="url(#rg1)"/>
    <polygon points="${fArea}" fill="url(#rg2)"/>
    <polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${fPoly}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-dasharray="5,4" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map(([x,y],i)=>i%Math.ceil(n/6)===0?`<text x="${x}" y="${H-4}" font-size="9" fill="rgba(255,255,255,0.3)" text-anchor="middle">${D.months[i]}</text>`:'' ).join('')}
    ${pts[pts.length-1]?`<circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="4" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.5"/>`:''}
  </svg>
  <div style="display:flex;gap:14px;margin-top:6px;">
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);"><div style="width:16px;height:2px;background:var(--accent);"></div>Faktyczne</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);"><div style="width:16px;height:2px;background:var(--blue);border-top:2px dashed var(--blue);"></div>Prognoza</div>
  </div>`;
}

function bizRevenueBreakdown(D){
  let cum=0;
  const slices=D.breakdown.map(b=>{
    const start=cum;cum+=b.pct;
    return{...b,start};
  });
  // donut SVG
  const r=60,cx=80,cy=80,stroke=22;
  function arc(pct,offset){
    const c=2*Math.PI*r;
    return `stroke-dasharray="${pct/100*c} ${c}" stroke-dashoffset="${-offset/100*c}"`;
  }
  return `<div style="display:flex;align-items:center;gap:20px;">
    <svg viewBox="0 0 160 160" style="width:120px;flex-shrink:0;">
      ${slices.map(s=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.col}" stroke-width="${stroke}" ${arc(s.pct,s.start)} transform="rotate(-90 ${cx} ${cy})" opacity="0.85"/>`).join('')}
      <text x="${cx}" y="${cy-8}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.4)">Łącznie</text>
      <text x="${cx}" y="${cy+8}" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="18" fill="var(--accent)">${D.activeClients}</text>
      <text x="${cx}" y="${cy+22}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.3)">klientów</text>
    </svg>
    <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
      ${D.breakdown.map(b=>`<div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
          <span style="color:var(--muted);">${b.label}</span>
          <span style="color:${b.col};font-weight:700;">${b.pct}%</span>
        </div>
        <div style="height:3px;background:var(--s3);border-radius:99px;"><div style="height:100%;background:${b.col};width:${b.pct}%;border-radius:99px;"></div></div>
      </div>`).join('')}
    </div>
  </div>`;
}

function bizRetentionChart(D){
  const labels=['M1','M2','M3','M4','M5','M6'];
  return `<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
    ${D.cohorts.map((pct,i)=>`<div style="display:flex;align-items:center;gap:8px;">
      <div style="width:24px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);text-align:right;">${labels[i]}</div>
      <div style="flex:1;height:22px;background:var(--s3);border-radius:5px;overflow:hidden;position:relative;">
        <div style="height:100%;background:${pct>80?'var(--teal)':pct>70?'var(--accent)':'var(--orange)'};width:${pct}%;border-radius:5px;"></div>
        <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;font-family:'DM Mono',monospace;color:#000;">${pct}%</span>
      </div>
    </div>`).join('')}
    <div style="font-size:10px;color:var(--muted);margin-top:4px;">Retencja po kolejnych miesiącach od startu</div>
  </div>`;
}

function bizAcquisitionChart(D){
  const maxV=Math.max(...D.newClients,...D.lostClients,1);
  const W=240,H=100,pad=20;
  const n=D.months.length;
  const bW=Math.max(4,Math.floor((W-pad*2)/n)-3);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%">
    ${D.newClients.map((v,i)=>{
      const x=pad+i*(W-pad*2)/n;
      const h=Math.round(v/maxV*(H-pad-10));
      return `<rect x="${x}" y="${H-pad-h}" width="${bW}" height="${h}" rx="3" fill="var(--teal)" opacity="0.85"/>`;
    }).join('')}
    ${D.lostClients.map((v,i)=>{
      const x=pad+i*(W-pad*2)/n+bW+2;
      const h=Math.round(v/maxV*(H-pad-10));
      return `<rect x="${x}" y="${H-pad-h}" width="${bW}" height="${h}" rx="3" fill="var(--red)" opacity="0.7"/>`;
    }).join('')}
    ${D.months.map((_,i)=>i%Math.ceil(n/4)===0?`<text x="${pad+i*(W-pad*2)/n+bW/2}" y="${H-4}" font-size="8" fill="rgba(255,255,255,0.3)" text-anchor="middle">${D.months[i]}</text>`:'').join('')}
  </svg>
  <div style="display:flex;gap:12px;margin-top:4px;">
    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted);"><div style="width:10px;height:10px;border-radius:2px;background:var(--teal);"></div>Nowi</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted);"><div style="width:10px;height:10px;border-radius:2px;background:var(--red);"></div>Odchodzący</div>
  </div>`;
}

function bizActivityChart(D){
  const buckets=[
    {label:'8+ sesji/mies.',count:Math.round(D.activeClients*0.25),col:'var(--accent)'},
    {label:'4–7 sesji/mies.',count:Math.round(D.activeClients*0.40),col:'var(--blue)'},
    {label:'1–3 sesji/mies.',count:Math.round(D.activeClients*0.25),col:'var(--orange)'},
    {label:'Nieaktywni',count:Math.round(D.activeClients*0.10),col:'var(--red)'},
  ];
  const total=buckets.reduce((a,b)=>a+b.count,0)||1;
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
    ${buckets.map(b=>`<div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
        <span style="color:var(--muted);">${b.label}</span>
        <span style="color:${b.col};font-weight:700;">${b.count} os.</span>
      </div>
      <div style="height:6px;background:var(--s3);border-radius:99px;overflow:hidden;">
        <div style="height:100%;background:${b.col};width:${Math.round(b.count/total*100)}%;border-radius:99px;transition:width 0.5s;"></div>
      </div>
    </div>`).join('')}
  </div>`;
}

function bizTopClients(D){
  const maxRev=D.topClients[0]?.rev||1;
  return `<div style="margin-top:4px;">
    <div style="display:grid;grid-template-columns:1fr 90px 70px 50px;gap:6px;padding:5px 0;font-size:9px;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--border);">
      <span>Klient</span><span style="text-align:right;">Przychód</span><span style="text-align:right;">Sesji</span><span></span>
    </div>
    ${D.topClients.map((c,i)=>`<div style="display:grid;grid-template-columns:1fr 90px 70px 50px;gap:6px;padding:9px 0;border-bottom:1px solid var(--border);align-items:center;">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:24px;height:24px;border-radius:6px;background:${['var(--accent)','var(--blue)','var(--purple)','var(--teal)','var(--orange)','var(--red)'][i%6]}22;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${['var(--accent)','var(--blue)','var(--purple)','var(--teal)','var(--orange)','var(--red)'][i%6]};">${getInit(c.name)}</div>
        <span style="font-size:12px;font-weight:600;">${c.name}</span>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;font-weight:700;color:var(--accent);">${c.rev.toLocaleString('pl')} PLN</div>
        <div style="height:3px;background:var(--s3);border-radius:99px;margin-top:3px;"><div style="height:100%;background:var(--accent);width:${Math.round(c.rev/maxRev*100)}%;border-radius:99px;"></div></div>
      </div>
      <div style="text-align:right;font-size:12px;color:var(--muted);">${c.sessions} sesji</div>
      <div style="text-align:center;"><span class="pill pill-green" style="font-size:9px;">Aktywny</span></div>
    </div>`).join('')}
  </div>`;
}

function bizMetrics(D){
  const items=[
    {label:'Wskaźnik churnu',val:D.churnRate+'%',icon:'📉',col:'var(--orange)',hint:'Cel: <5%'},
    {label:'NPS (satysfakcja)',val:D.nps+' pkt',icon:'⭐',col:'var(--accent)',hint:'Świetny (>50)'},
    {label:'Śr. długość sesji',val:D.avgSessionLength+' min',icon:'⏱',col:'var(--blue)',hint:'Standard 60 min'},
    {label:'Wykorzystanie czasu',val:D.utilizationRate+'%',icon:'📊',col:'var(--teal)',hint:'Cel: >80%'},
    {label:'Śr. przychód/sesję',val:Math.round(D.revenue/D.sessions)+' PLN',icon:'💰',col:'var(--accent)',hint:''},
    {label:'Koszty pozyskania',val:'180 PLN',icon:'🎯',col:'var(--muted)',hint:'CAC'},
  ];
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
    ${items.map(m=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:16px;">${m.icon}</span>
      <div style="flex:1;"><div style="font-size:11px;color:var(--muted);">${m.label}</div>${m.hint?`<div style="font-size:10px;color:var(--muted2);">${m.hint}</div>`:''}</div>
      <div style="font-size:14px;font-weight:700;color:${m.col};">${m.val}</div>
    </div>`).join('')}
  </div>`;
}

function bizHeatmap(D){
  const hours=D.hourDist;
  const max=Math.max(...hours,1);
  const slots=['6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
  return `<div style="margin-top:8px;">
    <div style="display:flex;gap:3px;flex-wrap:wrap;">
      ${hours.slice(6).map((v,i)=>{
        const pct=v/max;
        const bg=pct>0.7?'var(--accent)':pct>0.4?'rgba(225,31,46,0.5)':pct>0.1?'rgba(225,31,46,0.2)':'var(--s3)';
        return `<div style="width:28px;text-align:center;">
          <div style="height:28px;border-radius:5px;background:${bg};margin-bottom:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${pct>0.7?'#000':'transparent'};">${v||''}</div>
          <div style="font-size:8px;color:var(--muted2);">${slots[i]}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;align-items:center;">
      <span style="font-size:10px;color:var(--muted);">Mało</span>
      <div style="display:flex;gap:3px;">${[0.1,0.3,0.5,0.7,1].map(o=>`<div style="width:14px;height:10px;border-radius:2px;background:rgba(225,31,46,${o});"></div>`).join('')}</div>
      <span style="font-size:10px;color:var(--muted);">Dużo</span>
    </div>
  </div>`;
}

function bizForecast(D){
  const months=['Lip','Sie','Wrz'];
  const base=D.revSeries[D.revSeries.length-1]||3000;
  const vals=[Math.round(base*1.04),Math.round(base*1.09),Math.round(base*1.14)];
  const max=Math.max(...vals)*1.1;
  return `<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
    ${vals.map((v,i)=>`<div style="background:var(--s3);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;border-radius:8px;background:rgba(201,162,39,${0.1+i*0.05});display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--blue);">${months[i]}</div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:var(--text);">${v.toLocaleString('pl')} PLN</div>
        <div style="height:4px;background:var(--s2);border-radius:99px;margin-top:5px;overflow:hidden;">
          <div style="height:100%;background:var(--blue);width:${Math.round(v/max*100)}%;border-radius:99px;"></div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--teal);font-weight:600;">+${Math.round((v/base-1)*100)}%</div>
    </div>`).join('')}
    <div style="font-size:10px;color:var(--muted);line-height:1.5;padding:8px 0;">Prognoza zakłada utrzymanie obecnego tempa wzrostu i retencji klientów.</div>
  </div>`;
}

function exportBizReport(){
  const rows=[['Metryka','Wartość']];
  rows.push(['Aktywnych klientów',CL.filter(c=>c.status!=='inactive').length]);
  rows.push(['Planów',PL.length]);
  rows.push(['Sesji',SE.length]);
  rows.push(['Pakietów',(window.PACKAGES||[]).length]);
  const paid=(window.INVOICES||[]).filter(i=>i.status==='paid'||i.payStatus==='paid');
  rows.push(['Faktury opłacone',paid.length]);
  rows.push(['Suma opłaconych (zł)',paid.reduce((s,i)=>s+(i.amount||i.price||0),0)]);
  downloadCsv('bizstats-'+new Date().toISOString().slice(0,10)+'.csv',rows);
  notify('✓ Wyeksportowano CSV ze statystykami biznesowymi');
}

window.initBizStats=initBizStats;window.setBizPeriod=setBizPeriod;window.exportBizReport=exportBizReport;

// ════════════════════════════════════════
// AI COACH
// ════════════════════════════════════════
var aicMode='coach';
var aicClientId=null;
var aicMsgs=[];   // [{role,html}]
var aicLoading=false;
var aicHistorySessions=[]; // [{title,msgs,mode,date}]

const AIC_MODES={
  coach:{
    label:'🧠 Analiza klienta',
    system:`Jesteś AI Coach — zaawansowanym asystentem trenera personalnego Piotra Urbaniaka. Masz wiedzę na poziomie NSCA CSCS, NASM CPT i ACSM. Komunikujesz się po polsku. Analizujesz klientów, ich postępy, check-iny i plany treningowe. Dajesz konkretne, spersonalizowane rekomendacje.
Formatuj odpowiedzi używając:
- **pogrubień** dla ważnych terminów
- ### nagłówki dla sekcji
- Listy punktowane dla rekomendacji
Bądź konkretny i profesjonalny, ale przyjazny.`,
    suggestions:['Analiza ostatnich check-inów','Czy klient osiąga postępy?','Ryzyko plateau treningowego','Jak zmotywować klienta?','Ocena obciążenia treningowego']
  },
  plan:{
    label:'📋 Generator planu',
    system:`Jesteś ekspertem od programowania treningowego. Tworzysz spersonalizowane plany treningowe oparte o zasady periodyzacji, specyfice celu klienta i jego możliwościach. Znasz metody PPL, FBW, Upper/Lower, 5/3/1, Block Periodization i inne. Komunikujesz się po polsku.
Gdy generujesz plan:
- Podaj strukturę tygodnia (np. PN/ŚR/PT)
- Dla każdego dnia podaj ćwiczenia z seriami×powtórzeniami
- Uzasadnij wybory metodologicznie
- Uwzględnij deload co 4-6 tygodni`,
    suggestions:['Wygeneruj plan PPL 3-dniowy','Plan dla osoby z problemami kolan','6-tygodniowy program siłowy','Plan treningowy dla kobiety — redukcja','Periodyzacja blokowa na 12 tygodni']
  },
  nutrition:{
    label:'🥗 Doradca żywienia',
    system:`Jesteś ekspertem żywieniowym z certyfikatem PN i ISSN. Doradzasz w zakresie odżywiania sportowego, kalkulacji makroskładników, suplementacji i diety dopasowanej do celu treningowego. Komunikujesz się po polsku.
Pamiętaj:
- Zawsze pytaj o cel (masa/redukcja/utrzymanie) i poziom aktywności
- Podawaj konkretne wartości kcal i makro
- Uwzględniaj preferencje żywieniowe klienta
- Nie zastępujesz dietetyka — w złożonych przypadkach odsyłaj do specjalisty`,
    suggestions:['Oblicz zapotrzebowanie kaloryczne','Ile białka na kilogram masy?','Suplementacja przy budowaniu masy','Dieta dla klienta na redukcji','Odżywianie przed i po treningu']
  },
  exercise:{
    label:'💪 Ekspert ćwiczeń',
    system:`Jesteś ekspertem biomechaniki i techniki ćwiczeń siłowych. Znasz szczegółowo technikę wszystkich ćwiczeń siłowych, ich odmiany, mięśnie docelowe, najczęstsze błędy i modyfikacje dla różnych poziomów zaawansowania i kontuzji. Komunikujesz się po polsku.
Odpowiadając na pytania o technikę:
- Opisz ustawienie ciała krok po kroku
- Wskaż najczęstsze błędy
- Podaj regresje i progresje
- Zasugeruj ćwiczenia zastępcze jeśli potrzeba`,
    suggestions:['Technika przysiadu z kontuzją kolana','Zastępniki martwego ciągu dla początkujących','Jak poprawić wyciskanie na klatce?','Ćwiczenia na tylną część uda','Trening mobilności bioder']
  },
  business:{
    label:'💼 Biznes trenerski',
    system:`Jesteś ekspertem od prowadzenia działalności trenera personalnego. Doradzasz w zakresie marketingu, ustalania cen, pozyskiwania klientów, retencji, zarządzania czasem i rozwijania firmy trenerskiej. Komunikujesz się po polsku.
Dajesz konkretne, praktyczne rady:
- Strategie pozyskiwania klientów online i offline
- Konstruowanie oferty i pakietów
- Social media dla trenerów
- Jak podnosić ceny bez utraty klientów
- Automatyzacja i skalowanie biznesu`,
    suggestions:['Jak pozyskać pierwszych 10 klientów?','Jak ustalić ceny pakietów?','Social media strategia dla trenera','Jak zwiększyć retencję klientów?','Skalowanie biznesu online']
  }
};

function initAICoach(){
  const sel=document.getElementById('aic-client-sel');
  if(sel){
    sel.innerHTML='<option value="">Brak klienta (ogólne)</option>'+CL.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
  }
  if(!aicMsgs.length) aicShowWelcome();
  renderAICQuickQs();
  renderAICTools();
  renderAICHistory();
}

function aicShowWelcome(){
  const msgs=document.getElementById('aic-msgs');
  if(!msgs)return;
  msgs.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;text-align:center;padding:40px;">
    <div style="width:64px;height:64px;border-radius:20px;background:var(--adim);border:1px solid rgba(225,31,46,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <div class="ai-dot" style="width:14px;height:14px;"></div>
    </div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;margin-bottom:8px;">AI COACH</div>
    <div style="font-size:13px;color:var(--muted);max-width:420px;line-height:1.7;margin-bottom:24px;">Twój asystent AI z wiedzą NSCA/NASM/ACSM. Wybierz tryb pracy, opcjonalnie wskaż klienta i zadaj pytanie.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
      ${Object.entries(AIC_MODES).map(([k,m])=>`<button class="aic-suggestion" onclick="setAICMode('${k}',document.getElementById('aicm-${k}'));document.getElementById('aic-input').focus();">${m.label}</button>`).join('')}
    </div>
  </div>`;
}

function aicLoadClient(){
  const sel=document.getElementById('aic-client-sel');
  aicClientId=sel?.value||null;
  const bar=document.getElementById('aic-context-bar');
  const txt=document.getElementById('aic-context-text');
  if(aicClientId){
    const c=CL.find(x=>x.id===aicClientId);
    if(c&&bar&&txt){
      const sessions=SE.filter(s=>s.clientId===c.id).length;
      const plans=PL.filter(p=>p.clientId===c.id).length;
      bar.style.display='block';
      txt.textContent=`${c.name} · ${c.goal||'brak celu'} · ${c.level||'brak poziomu'} · ${sessions} sesji · ${plans} planów`;
    }
  } else {
    if(bar)bar.style.display='none';
  }
}

function setAICMode(mode,btn){
  aicMode=mode;
  document.querySelectorAll('.aic-mode-btn').forEach(b=>b.classList.remove('active'));
  const target=btn||document.getElementById('aicm-'+mode);
  if(target)target.classList.add('active');
  renderAICQuickQs();
  renderAICTools();
}

function renderAICQuickQs(){
  const el=document.getElementById('aic-quick-qs');if(!el)return;
  const qs=AIC_MODES[aicMode]?.suggestions||[];
  el.innerHTML=qs.map(q=>`<button class="aic-quick-q" onclick="aicSendQuick('${q.replace(/'/g,"\\'")}')">${q}</button>`).join('');
}

function aicSendQuick(q){
  const inp=document.getElementById('aic-input');
  if(inp){inp.value=q;inp.style.height='auto';}
  sendAICMsg();
}

function renderAICTools(){
  const el=document.getElementById('aic-tools');if(!el)return;
  const toolSets={
    coach:[
      {icon:'📊',title:'Analiza postępów',desc:'Porównaj wyniki klienta z poprzednim miesiącem',q:'Przeanalizuj postępy klienta i oceń czy idzie w dobrym kierunku.'},
      {icon:'⚠️',title:'Detekcja plateau',desc:'Sprawdź czy klient nie utknął w miejscu',q:'Czy klient wykazuje oznaki plateau treningowego? Co zmienić?'},
      {icon:'❤️',title:'Check-in analiza',desc:'Interpretuj wyniki ostatnich check-inów',q:'Przeanalizuj ostatnie check-iny klienta i wskaż obszary wymagające uwagi.'},
      {icon:'🎯',title:'Zmiana programu',desc:'Kiedy i jak zmodyfikować plan',q:'Czy czas zmienić plan treningowy klienta? Zaproponuj modyfikacje.'},
    ],
    plan:[
      {icon:'📋',title:'PPL 3-dniowy',desc:'Push/Pull/Legs — 3 sesje w tygodniu',q:'Wygeneruj plan PPL na 3 dni w tygodniu dla klienta.'},
      {icon:'🏋️',title:'FBW 3x/tydzień',desc:'Full Body Workout — dla początkujących',q:'Stwórz plan FBW 3 razy w tygodniu.'},
      {icon:'📅',title:'Upper/Lower 4x',desc:'4 treningi — górna/dolna partia',q:'Wygeneruj plan Upper/Lower na 4 dni w tygodniu.'},
      {icon:'⚡',title:'5/3/1 Wendler',desc:'Program siłowy na 16 tygodni',q:'Opisz jak wdrożyć metodę 5/3/1 Wendlera dla tego klienta.'},
    ],
    nutrition:[
      {icon:'🔢',title:'Kalkulator TDEE',desc:'Oblicz zapotrzebowanie kaloryczne',q:'Oblicz TDEE i makroskładniki dla klienta.'},
      {icon:'💊',title:'Suplementacja',desc:'Co, kiedy i ile suplementować',q:'Jakie suplementy polecasz dla klienta i w jakich dawkach?'},
      {icon:'🍗',title:'Jadłospis',desc:'Przykładowy plan żywieniowy na dzień',q:'Przygotuj przykładowy jadłospis na jeden dzień dla klienta.'},
      {icon:'⚖️',title:'Dieta deficytowa',desc:'Plan żywienia na redukcję',q:'Jak skonstruować dietę deficytową dla klienta aby skutecznie spalać tłuszcz?'},
    ],
    exercise:[
      {icon:'🦵',title:'Analiza przysiadu',desc:'Technika i najczęstsze błędy',q:'Opisz technikę przysiadu, najczęstsze błędy i jak je poprawić.'},
      {icon:'💀',title:'Martwy ciąg',desc:'Technika conventional i sumo',q:'Porównaj technikę martwego ciągu conventional i sumo — kiedy który polecasz?'},
      {icon:'🤕',title:'Kontuzje i modyfikacje',desc:'Ćwiczenia bezpieczne przy urazach',q:'Jakie modyfikacje ćwiczeń polecasz dla klienta z kontuzją?'},
      {icon:'🧘',title:'Mobilność i rozgrzewka',desc:'Protokół rozgrzewki przed treningiem',q:'Zaproponuj 10-minutowy protokół rozgrzewki przed treningiem siłowym.'},
    ],
    business:[
      {icon:'📣',title:'Pozyskanie klientów',desc:'Strategie online i offline',q:'Jak skutecznie pozyskiwać nowych klientów jako trener personalny?'},
      {icon:'💰',title:'Pakiety i ceny',desc:'Jak skonstruować ofertę',q:'Jak skonstruować pakiety treningowe i ustalić ceny?'},
      {icon:'📱',title:'Social media',desc:'Content strategy dla trenera',q:'Stwórz strategię content marketingową na Instagram/TikTok dla trenera personalnego.'},
      {icon:'🔄',title:'Retencja klientów',desc:'Jak zmniejszyć odpływ klientów',q:'Jak zwiększyć retencję klientów i zmniejszyć churn?'},
    ],
  };
  const tools=toolSets[aicMode]||toolSets.coach;
  el.innerHTML=tools.map(t=>`<div class="aic-tool-card" onclick="aicSendQuick('${t.q.replace(/'/g,"\\'")}')">
    <div style="font-size:20px;margin-bottom:6px;">${t.icon}</div>
    <div style="font-size:12px;font-weight:700;margin-bottom:3px;">${t.title}</div>
    <div style="font-size:11px;color:var(--muted);line-height:1.4;">${t.desc}</div>
  </div>`).join('');
}

function renderAICHistory(){
  const el=document.getElementById('aic-history');if(!el)return;
  if(!aicHistorySessions.length){
    el.innerHTML='<div style="padding:8px 14px;font-size:11px;color:var(--muted2);">Brak historii</div>';
    return;
  }
  el.innerHTML=aicHistorySessions.slice().reverse().map((s,i)=>`<div class="aic-hist-item" onclick="aicLoadSession(${aicHistorySessions.length-1-i})">
    <span style="margin-right:4px;">${AIC_MODES[s.mode]?.label.split(' ')[0]||'💬'}</span>${s.title}
    <div style="font-size:9px;color:var(--muted2);margin-top:1px;">${s.date}</div>
  </div>`).join('');
}

function aicLoadSession(idx){
  const s=aicHistorySessions[idx];if(!s)return;
  aicMode=s.mode;
  aicMsgs=s.msgs.slice();
  setAICMode(s.mode,null);
  aicRenderAllMsgs();
}

function aicRenderAllMsgs(){
  const el=document.getElementById('aic-msgs');if(!el)return;
  el.innerHTML='';
  aicMsgs.forEach(m=>aicAddMsgDOM(m.role,m.html,false));
  el.scrollTop=el.scrollHeight;
}

async function sendAICMsg(){
  if(aicLoading)return;
  const inp=document.getElementById('aic-input');
  const text=inp?.value?.trim();
  if(!text)return;
  inp.value='';inp.style.height='auto';

  // save to session if first message
  if(!aicMsgs.length){
    // clear welcome screen
    const msgs=document.getElementById('aic-msgs');
    if(msgs)msgs.innerHTML='';
  }

  // add user message
  aicMsgs.push({role:'user',html:escH(text)});
  aicAddMsgDOM('user',escH(text),true);
  document.getElementById('aic-suggestions').innerHTML='';

  // build system prompt with client context
  let systemPrompt=AIC_MODES[aicMode]?.system||AIC_MODES.coach.system;
  systemPrompt+=`\n\nDziś: ${new Date().toLocaleDateString('pl',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`;
  systemPrompt+=`\nTrener: Piotr Urbaniak`;
  systemPrompt+=kbContextForAI();

  if(aicClientId){
    const c=CL.find(x=>x.id===aicClientId);
    if(c){
      const sessions=SE.filter(s=>s.clientId===c.id);
      const plans=PL.filter(p=>p.clientId===c.id);
      const tasks=TASKS.filter(t=>t.clientId===c.id);
      const checkins=window.CHECKINS?.[c.id]||[];
      const metrics=(window.METRIC_ENTRIES||[]).filter(e=>e.clientId===c.id);
      systemPrompt+=`\n\n=== DANE KLIENTA ===
Imię: ${c.name}
Cel: ${c.goal||'—'}
Poziom: ${c.level||'—'}
Wiek: ${c.age||'—'}
Waga: ${c.weight||'—'} kg
Wzrost: ${c.height||'—'} cm
Liczba sesji: ${sessions.length}
Liczba planów: ${plans.length}
Liczba zadań: ${tasks.length}
${checkins.length?`Ostatni check-in: ${JSON.stringify(checkins[checkins.length-1])}`:'Brak check-inów'}
${metrics.length?`Ostatnie pomiary: ${JSON.stringify(metrics.slice(-3))}`:'Brak pomiarów'}
${plans.length?`Aktualny plan: ${plans[plans.length-1].name}, metoda: ${plans[plans.length-1].method}`:'Brak planu'}
Notatki: ${c.notes||'—'}`;
    }
  }

  // build messages for API (last 8 messages for context)
  const apiMsgs=aicMsgs.slice(-9,-1).map(m=>({
    role:m.role==='user'?'user':'assistant',
    content:m.role==='user'?m.html:m.rawText||m.html.replace(/<[^>]+>/g,'')
  }));
  apiMsgs.push({role:'user',content:text});

  aicLoading=true;
  // show typing indicator
  const typingId='aic-typing-'+Date.now();
  const msgs=document.getElementById('aic-msgs');
  if(msgs){
    msgs.innerHTML+=`<div id="${typingId}" class="aic-msg">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;border-radius:8px;background:var(--adim);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <div class="ai-dot" style="width:8px;height:8px;"></div>
        </div>
        <div class="aic-bubble-ai" style="padding:10px 14px;">
          <span style="display:inline-flex;gap:4px;align-items:center;">
            <span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1s infinite;"></span>
            <span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1s 0.2s infinite;"></span>
            <span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1s 0.4s infinite;"></span>
          </span>
        </div>
      </div>
    </div>`;
    msgs.scrollTop=msgs.scrollHeight;
  }

  try{
    const resp=await fetch('https://anthropic-proxy.teamprogress2018.workers.dev/',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1500,
        system:systemPrompt,
        messages:apiMsgs
      })
    });
    const data=await resp.json();
    const raw=data?.content?.[0]?.text||'Przepraszam, wystąpił błąd. Spróbuj ponownie.';
    // remove typing
    document.getElementById(typingId)?.remove();
    const html=aicMarkdownToHTML(raw);
    aicMsgs.push({role:'assistant',html,rawText:raw});
    aicAddMsgDOM('assistant',html,true);
    renderAICSuggestions(aicMode);
    // save to history
    aicSaveToHistory(text);
  }catch(e){
    document.getElementById(typingId)?.remove();
    const errHtml='<span style="color:var(--red);">❌ Błąd połączenia z AI. Sprawdź połączenie internetowe.</span>';
    aicMsgs.push({role:'assistant',html:errHtml});
    aicAddMsgDOM('assistant',errHtml,true);
  }
  aicLoading=false;
}

function aicMarkdownToHTML(md){
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^[\-\*] (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
    .replace(/^\d+\. (.+)$/gm,'<li>$1</li>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/\n/g,'<br>');
}

function aicAddMsgDOM(role,html,scroll){
  const el=document.getElementById('aic-msgs');if(!el)return;
  const isUser=role==='user';
  const div=document.createElement('div');
  div.className='aic-msg';
  div.style.display='flex';
  div.style.justifyContent=isUser?'flex-end':'flex-start';
  div.style.alignItems='flex-start';
  div.style.gap='8px';
  if(isUser){
    div.innerHTML=`<div class="aic-bubble-user">${html}</div>`;
  } else {
    div.innerHTML=`<div style="display:flex;gap:8px;align-items:flex-start;max-width:100%;">
      <div style="width:28px;height:28px;border-radius:8px;background:var(--adim);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
        <div class="ai-dot" style="width:8px;height:8px;"></div>
      </div>
      <div class="aic-bubble-ai">${html}</div>
    </div>`;
  }
  el.appendChild(div);
  if(scroll)el.scrollTop=el.scrollHeight;
}

function renderAICSuggestions(mode){
  const el=document.getElementById('aic-suggestions');if(!el)return;
  const qs=AIC_MODES[mode]?.suggestions||[];
  const pick=qs.sort(()=>Math.random()-0.5).slice(0,3);
  el.innerHTML=pick.map(q=>`<button class="aic-suggestion" onclick="aicSendQuick('${q.replace(/'/g,"\\'")}')">↩ ${q}</button>`).join('');
}

function aicSaveToHistory(firstMsg){
  if(aicHistorySessions.length===0||aicMsgs.length===2){
    aicHistorySessions.push({
      title:firstMsg.slice(0,40)+(firstMsg.length>40?'…':''),
      msgs:aicMsgs.slice(),
      mode:aicMode,
      date:new Date().toLocaleDateString('pl',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
    });
  } else {
    // update last session
    const last=aicHistorySessions[aicHistorySessions.length-1];
    if(last)last.msgs=aicMsgs.slice();
  }
  renderAICHistory();
}

function aicNewSession(){
  // save current
  if(aicMsgs.length>0){
    aicHistorySessions.push({
      title:(aicMsgs[0]?.html||'Sesja').replace(/<[^>]+>/g,'').slice(0,40),
      msgs:aicMsgs.slice(),
      mode:aicMode,
      date:new Date().toLocaleDateString('pl',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
    });
  }
  aicMsgs=[];
  aicShowWelcome();
  document.getElementById('aic-suggestions').innerHTML='';
  renderAICHistory();
}

function aicClear(){
  aicMsgs=[];
  aicShowWelcome();
  document.getElementById('aic-suggestions').innerHTML='';
}

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

window.initAICoach=initAICoach;window.aicLoadClient=aicLoadClient;
window.setAICMode=setAICMode;window.sendAICMsg=sendAICMsg;
window.aicSendQuick=aicSendQuick;window.aicNewSession=aicNewSession;
window.aicClear=aicClear;window.aicLoadSession=aicLoadSession;

