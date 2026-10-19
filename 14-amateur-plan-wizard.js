// Tryb Amator — krótki, bezpieczny wywiad przed przekazaniem kandydata do generatora AI.
// Nie zastępuje kwalifikacji medycznej ani decyzji trenera.
const APL_AMATEUR_SCHEMA_VERSION=1;

function aplAmateurAssessment(input){
  const d=input||{};
  const flags=[];
  if(d.parq==='yes')flags.push('health-declaration');
  if(d.pain==='yes')flags.push('pain-or-injury');
  if(d.consent!==true)flags.push('consent-missing');
  const recoveryLow=Number(d.sleep)<=2||Number(d.stress)>=5;
  return {
    status:flags.length?'review':recoveryLow?'cautious':'clear',
    blockers:flags,
    recoveryLow,
    message:flags.length
      ?'Plan nie zostanie wygenerowany automatycznie. Przekaż odpowiedzi trenerowi lub specjaliście przed rozpoczęciem ćwiczeń.'
      :recoveryLow
        ?'Plan startowy będzie lżejszy ze względu na deklarowaną regenerację.'
        :'Możemy przygotować ostrożny plan startowy.'
  };
}

function aplAmateurPrescription(input){
  const d=input||{};
  const assessment=aplAmateurAssessment(d);
  const requestedDays=Math.max(2,Math.min(3,parseInt(d.days,10)||2));
  const requestedDuration=Math.max(30,Math.min(60,parseInt(d.duration,10)||45));
  return {
    method:'FBW',
    progression:'double',
    level:'poczatkujacy',
    weeks:'4',
    days:String(requestedDays),
    duration:String(requestedDuration),
    intensify:[],
    targetRir:assessment.recoveryLow?'4':'3',
    conservative:assessment.recoveryLow,
    needsReview:assessment.status==='review'
  };
}

function aplAmateurSetOpt(groupId,value){
  const root=document.getElementById(groupId);if(!root)return;
  root.querySelectorAll('.apl-opt').forEach(btn=>btn.classList.toggle('active',btn.dataset.val===String(value)));
}

function aplAmateurEquipment(values){
  const wanted=new Set(values||[]);
  document.querySelectorAll('#apl-equipment .apl-opt-multi').forEach(btn=>btn.classList.toggle('active',wanted.has(btn.dataset.val)));
}

function aplAmateurApply(input){
  const d=input||{},rx=aplAmateurAssessment(d),p=aplAmateurPrescription(d);
  if(p.needsReview)return{ok:false,assessment:rx};
  aplAmateurSetOpt('apl-goals',d.goal||'kondycja');
  aplAmateurSetOpt('apl-levels',p.level);
  aplAmateurSetOpt('apl-methods',p.method);
  aplAmateurSetOpt('apl-days',p.days);
  aplAmateurSetOpt('apl-duration',p.duration);
  aplAmateurSetOpt('apl-weeks',p.weeks);
  aplAmateurSetOpt('apl-progression',p.progression);
  aplAmateurEquipment(d.equipment&&d.equipment.length?d.equipment:['Bez sprzętu']);
  const sleep=document.getElementById('apl-sleep');if(sleep)sleep.value=String(Math.max(1,Math.min(5,Number(d.sleep)||3)));
  const stress=document.getElementById('apl-stress');if(stress)stress.value=String(Math.max(1,Math.min(5,Number(d.stress)||3)));
  const injuries=document.getElementById('apl-injuries');if(injuries)injuries.value=String(d.painDetails||'').trim();
  const notes=document.getElementById('apl-notes');
  if(notes)notes.value=['TRYB AMATOR — plan startowy.', 'Cel: '+(d.goal||'sprawność ogólna')+'.', 'Zasada: RIR '+p.targetRir+'; bez serii do upadku, HIIT i zaawansowanych technik.', d.preferences?'Preferencje: '+d.preferences+'.':''].filter(Boolean).join('\n');
  window._aplAmateurIntake={schemaVersion:APL_AMATEUR_SCHEMA_VERSION,createdAt:new Date().toISOString(),answers:{...d},assessment:rx,prescription:p};
  return{ok:true,assessment:rx,prescription:p};
}

function aplAmateurRead(){
  const read=id=>document.getElementById(id)?.value||'';
  return {
    goal:read('apl-am-goal'),days:read('apl-am-days'),duration:read('apl-am-duration'),
    sleep:read('apl-am-sleep'),stress:read('apl-am-stress'),parq:read('apl-am-parq'),pain:read('apl-am-pain'),
    painDetails:read('apl-am-pain-details'),preferences:read('apl-am-preferences'),
    equipment:[...document.querySelectorAll('#apl-am-equipment input:checked')].map(x=>x.value),
    consent:document.getElementById('apl-am-consent')?.checked===true
  };
}

function aplAmateurStepErrors(input,step){
  const d=input||{},n=Number(step)||1,errors=[];
  if(n===1&&(!Array.isArray(d.equipment)||!d.equipment.length))errors.push('Wybierz co najmniej jeden rodzaj dostępnego sprzętu.');
  if(n===2&&d.pain==='yes'&&!String(d.painDetails||'').trim())errors.push('Opisz, co boli i przy jakim ruchu — trener musi to sprawdzić.');
  return errors;
}

function aplAmateurRender(){
  const mount=document.getElementById('apl-amateur-mount');if(!mount)return;
  mount.hidden=false;
  mount.innerHTML=`<section style="margin:0 0 16px;padding:14px;border:1px solid rgba(255,59,48,.38);border-radius:12px;background:rgba(255,59,48,.06);">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:start;margin-bottom:10px;"><div><div style="font-size:12px;font-weight:800;color:var(--accent);">TRYB AMATOR · 3 KRÓTKIE KROKI</div><div style="font-size:11px;color:var(--muted);line-height:1.45;margin-top:3px;">Odpowiedz prostym językiem. Gdy coś budzi niepokój, plan automatyczny zostanie zatrzymany.</div></div><button type="button" class="btn btn-ghost btn-sm" onclick="aplAmateurClose()">Tryb ekspercki</button></div>
    <div style="display:flex;gap:5px;margin:0 0 12px;" aria-label="Postęp formularza"><span data-apl-am-dot="1" style="height:4px;flex:1;border-radius:4px;background:var(--accent);"></span><span data-apl-am-dot="2" style="height:4px;flex:1;border-radius:4px;background:var(--border);"></span><span data-apl-am-dot="3" style="height:4px;flex:1;border-radius:4px;background:var(--border);"></span></div>
    <div data-apl-am-step="1"><div style="font-size:11px;font-weight:700;margin-bottom:9px;">Krok 1 z 3 · Twój cel i realny czas</div><div class="form-field"><label class="form-lbl">Co jest teraz najważniejsze?</label><select id="apl-am-goal" class="form-select"><option value="kondycja">Lepsza kondycja i sprawność</option><option value="redukcja">Redukcja masy ciała</option><option value="masa">Budowa mięśni</option><option value="sila">Więcej siły w codzienności</option></select></div><div class="form-grid"><div class="form-field"><label class="form-lbl">Ile dni realnie?</label><select id="apl-am-days" class="form-select"><option value="2">2 dni</option><option value="3">3 dni</option></select></div><div class="form-field"><label class="form-lbl">Czas jednej sesji</label><select id="apl-am-duration" class="form-select"><option value="30">30 min</option><option value="45" selected>45 min</option><option value="60">60 min</option></select></div></div><div class="form-field"><label class="form-lbl">Sprzęt, do którego masz stały dostęp</label><div id="apl-am-equipment" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;"><label><input type="checkbox" value="Bez sprzętu" checked> Bez sprzętu</label><label><input type="checkbox" value="Hantle"> Hantle</label><label><input type="checkbox" value="Maszyny siłowe"> Maszyny</label><label><input type="checkbox" value="Wyciągi i linki"> Wyciągi i linki</label><label><input type="checkbox" value="Sztanga i wolne ciężary"> Wolne ciężary</label></div></div><button type="button" class="btn btn-primary" style="width:100%;" onclick="aplAmateurNext(1)">Dalej: bezpieczeństwo</button></div>
    <div data-apl-am-step="2" hidden><div style="font-size:11px;font-weight:700;margin-bottom:9px;">Krok 2 z 3 · Bezpieczeństwo i regeneracja</div><div class="form-field"><label class="form-lbl">Bezpieczeństwo</label><select id="apl-am-parq" class="form-select"><option value="no">Nie mam przeciwwskazań ani zaleceń medycznych ograniczających aktywność</option><option value="yes">Mam przeciwwskazanie, zalecenie medyczne lub nie jestem pewien/pewna</option></select><select id="apl-am-pain" class="form-select" style="margin-top:7px;"><option value="no">Ćwiczenia nie wywołują teraz bólu</option><option value="yes">Ból lub świeży uraz występuje podczas ruchu</option></select><input id="apl-am-pain-details" class="form-input" placeholder="Jeśli tak: co boli i przy jakim ruchu?" style="margin-top:7px;"></div><div class="form-grid"><div class="form-field"><label class="form-lbl">Sen (1–5)</label><select id="apl-am-sleep" class="form-select"><option value="1">1 — bardzo słaby</option><option value="2">2 — słaby</option><option value="3" selected>3 — średni</option><option value="4">4 — dobry</option><option value="5">5 — świetny</option></select></div><div class="form-field"><label class="form-lbl">Stres (1–5)</label><select id="apl-am-stress" class="form-select"><option value="1">1 — niski</option><option value="2">2 — lekki</option><option value="3" selected>3 — średni</option><option value="4">4 — wysoki</option><option value="5">5 — bardzo wysoki</option></select></div></div><div style="display:flex;gap:8px;"><button type="button" class="btn btn-ghost" style="flex:1;" onclick="aplAmateurSetStep(1)">Wstecz</button><button type="button" class="btn btn-primary" style="flex:1;" onclick="aplAmateurNext(2)">Dalej: podsumowanie</button></div></div>
    <div data-apl-am-step="3" hidden><div style="font-size:11px;font-weight:700;margin-bottom:9px;">Krok 3 z 3 · Preferencje i zgoda</div><div class="form-field"><label class="form-lbl">Co lubisz lub czego wolisz unikać?</label><input id="apl-am-preferences" class="form-input" placeholder="np. wolę maszyny, nie lubię podskoków"></div><label style="display:flex;gap:8px;align-items:flex-start;font-size:11px;line-height:1.4;color:var(--muted);"><input id="apl-am-consent" type="checkbox"> Potwierdzam, że podałem/podałam prawdziwe informacje. Wiem, że generator nie zastępuje konsultacji medycznej ani decyzji trenera.</label><div style="display:flex;gap:8px;margin-top:12px;"><button type="button" class="btn btn-ghost" style="flex:1;" onclick="aplAmateurSetStep(2)">Wstecz</button><button type="button" class="btn btn-primary" style="flex:2;" onclick="aplAmateurPrepare()">Przygotuj plan startowy</button></div></div><div id="apl-amateur-feedback" role="status" style="margin-top:9px;font-size:11px;line-height:1.45;"></div>
  </section>`;
}

function aplAmateurSetStep(step){
  const n=Math.max(1,Math.min(3,Number(step)||1));
  document.querySelectorAll('[data-apl-am-step]').forEach(el=>{el.hidden=el.dataset.aplAmStep!==String(n);});
  document.querySelectorAll('[data-apl-am-dot]').forEach(el=>{el.style.background=Number(el.dataset.aplAmDot)<=n?'var(--accent)':'var(--border)';});
}

function aplAmateurNext(step){
  const errors=aplAmateurStepErrors(aplAmateurRead(),step);
  if(errors.length){notify(errors[0]);return false;}
  aplAmateurSetStep(Number(step)+1);return true;
}

function aplAmateurPrepare(){
  const input=aplAmateurRead(),result=aplAmateurApply(input),feedback=document.getElementById('apl-amateur-feedback');
  if(!result.ok){if(feedback)feedback.innerHTML='<b style="color:var(--red);">Wymagana weryfikacja człowieka.</b> '+result.assessment.message;return;}
  if(feedback)feedback.innerHTML='<b style="color:var(--teal);">Gotowe.</b> '+result.assessment.message+' Ustawiliśmy FBW, 2–3 sesje, 4 tygodnie i podwójną progresję. Teraz generujemy kandydat do sprawdzenia przez trenera.';
  aplGenerate();
}

function aplAmateurPlanIssues(plan){
  const intake=window._aplAmateurIntake;if(!intake)return[];
  const p=intake.prescription||{},chosen=(intake.answers&&intake.answers.equipment)||[],days=(plan&&plan.days)||[],issues=[];
  if(days.length!==Number(p.days))issues.push('Liczba wygenerowanych dni nie zgadza się z deklarowaną dostępnością.');
  const advanced=/drop[ -]?set|rest[ -]?pause|cluster|smolov|tabata|\bhiit\b|plyo|skok|amrap|upadk/i;
  days.forEach((day,di)=>{
    const exercises=(day&&day.exercises)||[];
    if(exercises.length>5)issues.push('Dzień '+(di+1)+' ma więcej niż 5 ćwiczeń roboczych — zmniejsz objętość startową.');
    exercises.forEach(ex=>{
      const text=[ex.name,ex.notes,ex.note].join(' ');
      if(advanced.test(text))issues.push('Dzień '+(di+1)+' zawiera niedozwoloną technikę startową: '+(ex.name||'ćwiczenie')+'.');
      const rir=parseFloat(ex.rir);
      if(Number.isFinite(rir)&&rir<Number(p.targetRir||3))issues.push('Dzień '+(di+1)+' ma zbyt wysoką intensywność (RIR '+rir+').');
      const catalog=typeof libExerciseByName==='function'?libExerciseByName(ex.name):null;
      if(catalog&&!aplAmateurEquipmentAllowed(catalog.eq,chosen))issues.push('Dzień '+(di+1)+' wymaga sprzętu spoza deklaracji: '+(ex.name||'ćwiczenie')+' ('+catalog.eq+').');
    });
  });
  if(advanced.test(String(plan&&plan.periodization||'')))issues.push('Opis progresji zawiera technikę niedozwoloną w planie startowym.');
  return [...new Set(issues)];
}

function aplAmateurEquipmentAllowed(equipment,chosen){
  const eq=String(equipment||'').toLowerCase(),set=new Set(chosen||[]);
  if(!eq)return true;
  if(/własna masa|bez sprzętu|bodyweight|mata/.test(eq))return set.has('Bez sprzętu');
  if(/hantl/.test(eq))return set.has('Hantle')||set.has('Sztanga i wolne ciężary');
  if(/kettlebell|sztang/.test(eq))return set.has('Sztanga i wolne ciężary');
  if(/maszyn/.test(eq))return set.has('Maszyny siłowe');
  if(/wyciąg|link/.test(eq))return set.has('Wyciągi i linki');
  return true;
}

function aplAmateurMayAddExercise(plan,dayIndex){
  if(!window._aplAmateurIntake)return true;
  const day=(plan&&plan.days||[])[Number(dayIndex)];
  return !!day&&(day.exercises||[]).length<5;
}

function aplAmateurMayAddDay(plan){
  if(!window._aplAmateurIntake)return true;
  const max=Number((window._aplAmateurIntake.prescription||{}).days)||2;
  return ((plan&&plan.days)||[]).length<max;
}

function aplAmateurReviewHtml(){
  const intake=window._aplAmateurIntake;if(!intake)return'';
  const a=intake.answers||{},p=intake.prescription||{},esc=v=>String(v==null?'—':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const review=intake.trainerReview;
  const issues=window._aplAmateurPlanIssues||[];
  return `<section data-apl-amateur-review style="margin-top:14px;padding:12px 14px;border:1px solid rgba(61,207,178,.32);border-radius:10px;background:rgba(61,207,178,.07);font-size:12px;line-height:1.55;">
    <div style="font-weight:800;color:var(--teal);">TRYB AMATOR · RAPORT DO WERYFIKACJI</div>
    <div style="color:var(--muted);margin-top:3px;">Cel: ${esc(a.goal)} · ${esc(p.days)} sesje · ${esc(p.duration)} min · sen ${esc(a.sleep)}/5 · stres ${esc(a.stress)}/5 · RIR ${esc(p.targetRir)}</div>
    <div style="color:var(--muted);margin-top:3px;">Sprzęt: ${esc((a.equipment||[]).join(', ')||'nie podano')} · preferencje: ${esc(a.preferences||'brak')}</div>
    ${issues.length?`<div style="margin-top:8px;color:var(--red);"><b>Plan wymaga korekty przed zapisem:</b><ul style="margin:4px 0 0;padding-left:18px;">${issues.map(esc).map(x=>'<li>'+x+'</li>').join('')}</ul></div>`:''}
    ${review?`<div style="margin-top:8px;color:var(--teal);">✓ Zweryfikowano przez trenera: ${esc(review.at)}</div>`:`<label style="display:flex;gap:7px;align-items:flex-start;margin-top:9px;color:var(--text);"><input id="apl-am-review-check" type="checkbox"> Sprawdziłem/sprawdziłam dane, ćwiczenia, ograniczenia i akceptuję ten plan startowy.</label>`}
  </section>`;
}

function aplAmateurConfirmReview(){
  const intake=window._aplAmateurIntake;if(!intake)return true;
  if(intake.trainerReview)return true;
  const checked=document.getElementById('apl-am-review-check')?.checked===true;
  if(!checked){notify('Potwierdź weryfikację planu Amator przed zapisem.');return false;}
  intake.trainerReview={at:new Date().toISOString(),source:'trainer-confirmation'};
  return true;
}

function aplAmateurOpen(){aplAmateurRender();document.getElementById('apl-amateur-mount')?.scrollIntoView({behavior:'smooth',block:'start'});}
function aplAmateurClose(){const mount=document.getElementById('apl-amateur-mount');if(mount){mount.hidden=true;mount.innerHTML='';}window._aplAmateurIntake=null;}

window.aplAmateurAssessment=aplAmateurAssessment;window.aplAmateurPrescription=aplAmateurPrescription;window.aplAmateurApply=aplAmateurApply;window.aplAmateurStepErrors=aplAmateurStepErrors;window.aplAmateurEquipmentAllowed=aplAmateurEquipmentAllowed;window.aplAmateurMayAddExercise=aplAmateurMayAddExercise;window.aplAmateurMayAddDay=aplAmateurMayAddDay;window.aplAmateurPlanIssues=aplAmateurPlanIssues;
window.aplAmateurOpen=aplAmateurOpen;window.aplAmateurClose=aplAmateurClose;window.aplAmateurPrepare=aplAmateurPrepare;window.aplAmateurSetStep=aplAmateurSetStep;window.aplAmateurNext=aplAmateurNext;window.aplAmateurReviewHtml=aplAmateurReviewHtml;window.aplAmateurConfirmReview=aplAmateurConfirmReview;
