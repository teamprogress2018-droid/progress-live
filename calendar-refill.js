/* Manual calendar fill: confirmed, create-only writes; never rebuild existing appointments. */
(function(){
  'use strict';
  const states=new Map();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const ymd=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const signature=value=>JSON.stringify((function clean(v){
    return Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.keys(v).filter(k=>k!=='_fbId').sort().reduce((o,k)=>{o[k]=clean(v[k]);return o;},{}):v;
  })(value));
  const session=()=>({uid:window._uid,generation:window.tenantSessionGeneration||0});
  const current=auth=>!!auth.uid&&auth.uid===window._uid&&auth.generation===(window.tenantSessionGeneration||0)&&
    !window._clientAppMode&&!window._clientPreviewMode&&window._tenantDataReady===true&&
    (!window.tenantSessionIsCurrent||window.tenantSessionIsCurrent(auth));
  const key=(auth,cid)=>JSON.stringify([auth.uid,auth.generation,cid]);
  function assertCurrent(auth){if(!current(auth))throw new Error('Sesja logowania zmieniła się. Otwórz ponownie profil klienta.');}
  function mapped(snap,id){return snap.exists()?{...snap.data(),id:id||snap.id,_fbId:snap.id}:null;}
  function owned(value,auth,cid){return !!value&&value.trainerId===auth.uid&&(!cid||value.clientId===cid);}
  function active(value){return value&&!value.archived&&value.status!=='archived'&&!value.deleted;}

  function renderCalendarRefillState(cid){
    const state=states.get(key(session(),cid));
    if(typeof document==='undefined')return;
    document.querySelectorAll('[data-calendar-refill-client]').forEach(button=>{
      if(button.getAttribute('data-calendar-refill-client')!==cid)return;
      button.disabled=!!(state&&state.pending);
      button.textContent=state&&state.pending?'Zapisywanie…':state&&state.error?'Ponów dopełnienie':'Dopełnij 4 tygodnie';
    });
    document.querySelectorAll('[data-calendar-refill-status]').forEach(el=>{
      if(el.getAttribute('data-calendar-refill-status')!==cid)return;
      el.textContent=state&&state.message||'';
      el.hidden=!el.textContent;
      el.style.color=state&&state.error?'var(--orange)':'var(--muted)';
    });
  }

  const explicitPlan=opts=>Object.prototype.hasOwnProperty.call(opts,'planId');
  function selectPlan(cid,opts,auth){
    const plans=(window.PL||[]).filter(p=>owned(p,auth,cid)&&active(p)&&
      (p.days||[]).some(d=>d&&!d.rest&&(d.exercises||[]).length));
    if(explicitPlan(opts)){
      const plan=typeof opts.planId==='string'&&opts.planId.trim()&&plans.find(p=>p.id===opts.planId);
      if(!plan)throw new Error('Wskazany plan jest niedostępny lub nie ma dni treningowych. Odśwież aplikację i sprawdź plan klienta.');
      return plan;
    }
    const plan=plans.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0];
    if(!plan)throw new Error('Przypisz klientowi plan z dniami treningowymi.');
    return plan;
  }
  function assertRequestedScope(op,opts){
    // Manual retry confirms its frozen payload. A named action must match that payload.
    if(!explicitPlan(opts))return;
    const plan=selectPlan(op.clientId,opts,op.auth);
    if(plan.id!==op.plan.id)throw new Error('Poprzednie dopełnienie dotyczy innego planu. Dokończ je w kalendarzu lub kontynuuj bez dopełnienia i odśwież aplikację przed dodaniem terminów aktualnego planu.');
    if(signature(plan)!==op.planSignature)throw new Error('Poprzednie dopełnienie dotyczy wcześniejszej wersji planu. Kontynuuj bez dopełnienia i odśwież aplikację, aby użyć aktualnego planu.');
    const client=(window.CL||[]).find(c=>c.id===op.clientId);
    if(!owned(client,op.auth)||!active(client))throw new Error('Klient jest niedostępny. Odśwież listę klientów.');
    const weeks=opts.weeks===undefined?4:Number(opts.weeks);
    const duration=opts.duration===undefined?60:Number(opts.duration);
    const time=opts.time||window.scheduleTimeFromClient(client,'18:00');
    if(weeks!==op.options.weeks||duration!==op.options.duration||time!==op.options.time)
      throw new Error('Poprzednie dopełnienie ma inny zakres lub godzinę. Dokończ je w kalendarzu lub kontynuuj bez dopełnienia i odśwież aplikację przed rozpoczęciem nowego.');
    const days=op.plan.days.filter(day=>day&&!day.rest&&(day.exercises||[]).length);
    const preferred=opts.weekdays||client.preferredWeekdays||[];
    const weekdays=days.map((day,index)=>window.resolvePlanDayWeekday(day,index,preferred));
    if(signature(weekdays)!==signature(op.options.weekdays))
      throw new Error('Poprzednie dopełnienie ma inne dni tygodnia. Dokończ je w kalendarzu lub kontynuuj bez dopełnienia i odśwież aplikację przed rozpoczęciem nowego.');
  }
  function capture(cid,opts,auth){
    const client=(window.CL||[]).find(c=>c.id===cid);
    if(!owned(client,auth)||!active(client))throw new Error('Klient jest niedostępny. Odśwież listę klientów.');
    const plan=selectPlan(cid,opts,auth);
    const weeks=opts.weeks===undefined?4:Number(opts.weeks);
    const duration=opts.duration===undefined?60:Number(opts.duration);
    const time=opts.time||window.scheduleTimeFromClient(client,'18:00');
    if(!Number.isInteger(weeks)||weeks<1||weeks>12)throw new Error('Wybierz od 1 do 12 pełnych tygodni.');
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isFinite(duration)||duration<=0||duration>1440)
      throw new Error('Sprawdź godzinę i czas trwania treningu.');
    const days=plan.days.map((day,index)=>({day,index})).filter(x=>x.day&&!x.day.rest&&(x.day.exercises||[]).length);
    const preferred=opts.weekdays||client.preferredWeekdays||[];
    const weekdays=days.map((x,i)=>window.resolvePlanDayWeekday(x.day,i,preferred));
    if(weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(weekdays).size!==days.length)
      throw new Error('Ustaw różne dni tygodnia dla treningów w planie, potem dopełnij kalendarz.');
    const today=new Date();today.setHours(12,0,0,0);
    const createdAt=new Date().toISOString();
    const candidates=[];
    for(let week=0;week<weeks;week++)days.forEach(({day,index},trainIndex)=>{
      const date=new Date(today);date.setDate(date.getDate()+(weekdays[trainIndex]-today.getDay()+7)%7+week*7);
      const dateYmd=ymd(date);
      const id='calfill_'+encodeURIComponent(JSON.stringify([auth.uid,cid,plan.id,index,dateYmd]));
      if(id.length>1400)throw new Error('Nie można utworzyć terminu dla tego identyfikatora planu.');
      const label=day.day||day.dayName||('Dzień '+(index+1));
      const muscles=day.muscles||day.focus||'';
      candidates.push({id,trainerId:auth.uid,clientId:cid,date:dateYmd,time,duration,source:'planned',
        planId:plan.id,dayIdx:index,calendarOccurrenceDate:dateYmd,createdAt,
        type:label+(muscles?' — '+muscles:''),notes:'Z planu: '+(plan.name||'')+(muscles?' · '+muscles:'')});
    });
    return {auth,clientId:cid,clientDoc:client._fbId||cid,plan:clone(plan),planDoc:plan._fbId||plan.id,
      planSignature:signature(plan),options:{weeks,duration,time,weekdays:clone(weekdays)},candidates};
  }

  function sameOccurrence(record,candidate){
    return record&&record.trainerId===candidate.trainerId&&record.clientId===candidate.clientId&&
      record.planId===candidate.planId&&record.dayIdx===candidate.dayIdx&&record.source==='planned';
  }
  function blocks(record,candidate){
    if(!record||record.clientId!==candidate.clientId||record.trainerId!==candidate.trainerId)return false;
    if(record.id===candidate.id||record._fbId===candidate.id)return sameOccurrence(record,candidate);
    if(record.plannedSessionId===candidate.id&&window.isLoggedWorkout(record))return true;
    if(String(record.date||'').slice(0,10)!==candidate.date)return false;
    if(record.source==='planned')return true; // Includes skipped and appointments from another plan.
    return window.isLoggedWorkout(record)&&record.planId===candidate.planId&&record.dayIdx===candidate.dayIdx;
  }
  function paidAccess(client,packages){
    const mode=window.clientAccessMode(client);
    if(mode==='trial'||mode==='guest')return true;
    if(!packages.length)return true;
    return packages.some(p=>p.payStatus==='paid'&&!window.clientPackageExpired(p,ymd(new Date())));
  }
  async function queryOwned(collection,op){
    const snap=await window._get(window._query(window._col(window._db,collection),
      window._where('trainerId','==',op.auth.uid),window._where('clientId','==',op.clientId)));
    assertCurrent(op.auth);
    const rows=[];
    snap.forEach(doc=>{const row={...doc.data(),id:doc.id,_fbId:doc.id};
      if(!owned(row,op.auth,op.clientId))throw new Error('Nie można potwierdzić właściciela danych.');
      rows.push(row);
    });
    return rows;
  }
  async function persist(op){
    const [sessions,packages]=await Promise.all([queryOwned('sessions',op),queryOwned('packages',op)]);
    assertCurrent(op.auth);
    // Query matches are re-read in the transaction. Keep their original reservation if moved meanwhile.
    const blockers=sessions.filter(s=>op.candidates.some(c=>blocks(s,c)));
    return window._runTransaction(window._db,async transaction=>{
      assertCurrent(op.auth);
      const refs=new Map();
      const add=(col,id)=>{const k=col+'/'+id;if(!refs.has(k))refs.set(k,window._doc(window._db,col,id));return k;};
      const ck=add('clients',op.clientDoc),pk=add('plans',op.planDoc);
      op.candidates.forEach(c=>add('sessions',c.id));
      blockers.forEach(s=>add('sessions',s._fbId));
      packages.forEach(p=>add('packages',p._fbId));
      const docs=new Map(await Promise.all(Array.from(refs,async ([k,ref])=>[k,await transaction.get(ref)])));
      assertCurrent(op.auth);
      const client=mapped(docs.get(ck),op.clientId),plan=mapped(docs.get(pk),op.plan.id);
      if(!owned(client,op.auth)||!active(client))throw new Error('Klient został usunięty lub zarchiwizowany.');
      if(!owned(plan,op.auth,op.clientId)||!active(plan))throw new Error('Plan został usunięty, zarchiwizowany lub przypisany inaczej.');
      const livePackages=packages.map(p=>mapped(docs.get('packages/'+p._fbId))).filter(Boolean);
      if(livePackages.some(p=>!owned(p,op.auth,op.clientId)))throw new Error('Zmieniły się dane pakietu. Odśwież profil.');
      const liveBlockers=blockers.map(s=>({before:s,after:mapped(docs.get('sessions/'+s._fbId))}));
      if(liveBlockers.some(s=>s.after&&!owned(s.after,op.auth,op.clientId)))throw new Error('Zmienił się właściciel terminu. Odśwież kalendarz.');
      const records=[],missing=[];
      op.candidates.forEach(candidate=>{
        const existing=mapped(docs.get('sessions/'+candidate.id));
        if(existing){
          if(!sameOccurrence(existing,candidate))throw new Error('Konflikt terminu. Istniejące treningi pozostawiono bez zmian.');
          records.push(existing);return;
        }
        const reserved=liveBlockers.some(s=>s.after&&(blocks(s.before,candidate)||blocks(s.after,candidate)));
        if(!reserved)missing.push(candidate);
      });
      if(missing.length){
        if(signature(plan)!==op.planSignature)throw new Error('Plan zmienił się od rozpoczęcia dopełniania. Odśwież aplikację, aby użyć aktualnego planu.');
        if(!paidAccess(client,livePackages))throw new Error('Pakiet jest nieopłacony lub wygasł. Sprawdź płatności albo dostęp Trial / Gość.');
      }
      assertCurrent(op.auth);
      missing.forEach(candidate=>{transaction.set(refs.get('sessions/'+candidate.id),clone(candidate));records.push({...candidate,_fbId:candidate.id});});
      liveBlockers.forEach(s=>{if(s.after)records.push(s.after);});
      return {added:missing.length,records};
    });
  }

  function refillCalendarConfirmed(clientId,opts){
    const cid=String(clientId||''),auth=session(),stateKey=key(auth,cid);
    // Do not retain one account's pending payload for another authenticated session.
    for(const [k,s] of states)if(s.auth.uid!==auth.uid||s.auth.generation!==auth.generation)states.delete(k);
    let state=states.get(stateKey);
    opts=opts||{};
    if(state&&state.operation&&explicitPlan(opts)){
      try{assertCurrent(auth);assertRequestedScope(state.operation,opts);}
      catch(error){return Promise.resolve({status:'error',error:error&&error.message||'Nie można potwierdzić zakresu kalendarza.'});}
    }
    if(state&&state.pending)return state.promise;
    if(!state){state={auth,pending:false,operation:null,message:'',error:false};states.set(stateKey,state);}
    state.pending=true;state.error=false;state.message='Sprawdzam istniejące terminy i zapisuję brakujące…';
    renderCalendarRefillState(cid);
    state.promise=(async()=>{
      try{
        assertCurrent(auth);
        if(!window._db||!window._runTransaction||!window._get)throw new Error('Brak połączenia z bazą. Odśwież aplikację i spróbuj ponownie.');
        if(!state.operation)state.operation=capture(cid,opts,auth);
        const result=await persist(state.operation);
        assertCurrent(auth);
        const list=window.SE||[];
        result.records.forEach(record=>{
          const index=list.findIndex(s=>(s._fbId||s.id)===record._fbId);
          if(index<0)list.push(record);else list[index]=record;
        });
        window.SE=list;
        state.operation=null;state.pending=false;
        state.message=result.added?'Dodano '+result.added+' treningów. Istniejące terminy zachowano.':'Kalendarz jest już uzupełniony. Istniejące terminy zachowano.';
        try{if(window.cpClientId===cid&&window.renderCPTraining)window.renderCPTraining((window.CL||[]).find(c=>c.id===cid));}catch(e){}
        try{if(window.renderCal)window.renderCal();}catch(e){}
        try{if(window.renderDashCalRefillFollowup)window.renderDashCalRefillFollowup();}catch(e){}
        if(window.notify)window.notify(state.message);
        return {status:result.added?'saved':'unchanged',added:result.added};
      }catch(error){
        const message=error&&error.code?'Nie udało się potwierdzić zapisu. Sprawdź połączenie i ponów dopełnienie.':
          error&&error.message||'Nie udało się potwierdzić zapisu.';
        if(current(auth)){
          state.error=true;
          state.message=message;
          if(window.notify)window.notify(state.message);
        }
        return {status:'error',error:message};
      }finally{
        state.pending=false;
        if(current(auth))renderCalendarRefillState(cid);
      }
    })();
    return state.promise;
  }
  window.refillCalendarConfirmed=refillCalendarConfirmed;
  window.renderCalendarRefillState=renderCalendarRefillState;
})();
