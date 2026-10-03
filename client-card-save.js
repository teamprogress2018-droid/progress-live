/* Confirmed client-card writes. Applying the result to CL and starting onboarding
 * belongs to the caller, after this promise resolves in the same session. */
(function(){
  'use strict';
  const operations=new WeakMap();
  const fields=['name','email','phone','age','gender','weight','height','goal','level',
    'trainingFreq','preferredWeekdays','preferredTrainTime','priorSports',
    'additional_activities','physiquePriority','activityLevel','sportNotes','injuries','notes','status'];
  const labels={name:'Imię i nazwisko',email:'E-mail',phone:'Telefon',age:'Wiek',
    gender:'Płeć',weight:'Masa ciała',height:'Wzrost',goal:'Cel',level:'Poziom',
    trainingFreq:'Częstotliwość treningów',preferredWeekdays:'Dni treningów',
    preferredTrainTime:'Pora treningów',priorSports:'Tło sportowe',
    additional_activities:'Dodatkowe aktywności',physiquePriority:'Priorytet sylwetkowy',
    activityLevel:'Aktywność',sportNotes:'Uwagi sportowe',injuries:'Kontuzje',notes:'Notatki',status:'Status'};
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const plain=value=>value&&typeof value==='object'&&
    (Object.getPrototypeOf(value)===null||
      (Object.getPrototypeOf(value).constructor&&Object.getPrototypeOf(value).constructor.name==='Object'));
  function clone(value){
    if(Array.isArray(value))return value.map(clone);
    if(value instanceof Date)return new Date(value.getTime());
    if(plain(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clone(item)]));
    // Firestore Timestamp values are immutable, but retain their type in snapshots.
    if(value&&typeof value.toMillis==='function'&&value.constructor&&typeof value.constructor.fromMillis==='function')
      return value.constructor.fromMillis(value.toMillis());
    return value;
  }
  function freeze(value){
    if(Array.isArray(value)||plain(value)){
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function equal(a,b){
    if(a===b)return true;
    if(a instanceof Date&&b instanceof Date)return a.getTime()===b.getTime();
    if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
    if(plain(a)&&plain(b)){
      const keys=Object.keys(a),other=Object.keys(b);
      return keys.length===other.length&&keys.every(key=>own(b,key)&&equal(a[key],b[key]));
    }
    if(a&&b&&typeof a.isEqual==='function')return a.isEqual(b);
    return false;
  }
  function fail(message,code){const error=new Error(message);if(code)error.code=code;return error;}
  function required(name){
    if(typeof window[name]!=='function')throw fail('Brak połączenia z bazą. Odśwież aplikację i spróbuj ponownie.','client-card-unavailable');
    return window[name];
  }
  function assert(state,client){
    const current=required('assignmentSessionCurrent');
    const check=required('assertAssignmentSession');
    if(!state.auth||!state.auth.uid||!current(state.auth))
      throw fail('Sesja zmieniła się. Otwórz ponownie formularz klienta.','client-card-session');
    check(state.auth,client||state.candidate);
  }
  function receipt(){
    const crypto=window.crypto;
    if(crypto&&typeof crypto.randomUUID==='function')return 'ccw_'+crypto.randomUUID();
    if(crypto&&typeof crypto.getRandomValues==='function'){
      const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
      return 'ccw_'+Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
    }
    throw fail('Nie można bezpiecznie rozpocząć zapisu. Odśwież aplikację.','client-card-unavailable');
  }
  function snapshot(raw,docId,state){
    const result=clone(raw);
    if(!result||typeof result!=='object')throw fail('Nie można odczytać aktualnych danych klienta.');
    if(own(result,'id')&&result.id!==state.candidate.id)
      throw fail('Identyfikator klienta zmienił się. Otwórz ponownie formularz.','client-card-unavailable');
    if(!result.id)result.id=state.candidate.id;
    result._fbId=docId;
    return result;
  }
  function conflict(message,remote){
    const error=fail(message,'client-card-conflict');
    if(remote)error.remote=clone(remote);
    return error;
  }
  function checkLocalCreate(state){
    if(!Array.isArray(window.CL))throw fail('Dane klientów nie są jeszcze gotowe. Odśwież aplikację.','client-card-unavailable');
    for(const existing of window.CL){
      if(!existing||existing.id!==state.candidate.id)continue;
      assert(state,existing);
      if(existing.clientCardCreateId!==state.token)
        throw conflict('Klient o tym identyfikatorze już istnieje. Otwórz ponownie formularz.');
    }
  }
  async function create(state){
    assert(state);checkLocalCreate(state);
    if(!window._db)throw fail('Brak połączenia z bazą. Spróbuj ponownie.','client-card-unavailable');
    if(state.failed){
      const get=required('_getDocsFromServer'),query=required('_query');
      const collection=required('_col'),where=required('_where');
      assert(state);checkLocalCreate(state);
      // Missing client documents cannot be read under current tenant rules.
      // A server-only, owned query distinguishes a lost acknowledgement safely.
      const found=await get(query(collection(window._db,'clients'),
        where('trainerId','==',state.auth.uid),where('id','==',state.candidate.id)));
      assert(state);checkLocalCreate(state);
      if(!found||!Array.isArray(found.docs))throw fail('Nie udało się potwierdzić zapisu klienta. Spróbuj ponownie.');
      if(found.docs.length){
        if(found.docs.length!==1)throw conflict('Istnieje więcej niż jeden klient z tym identyfikatorem. Odśwież listę klientów.');
        const doc=found.docs[0],remote=snapshot(doc.data(),doc.id,state);
        assert(state,remote);
        if(remote.clientCardCreateId!==state.token)
          throw conflict('Klient o tym identyfikatorze już istnieje. Otwórz ponownie formularz.',remote);
        return remote;
      }
    }
    const persist=required('persistById');
    assert(state);checkLocalCreate(state);
    const saved=await persist('clients',clone(state.candidate));
    assert(state);checkLocalCreate(state);
    if(!saved)throw fail('Nie udało się potwierdzić zapisu klienta. Spróbuj ponownie.','client-card-unconfirmed');
    const result=clone(saved);
    assert(state,result);
    if(result.id!==state.candidate.id||result.clientCardCreateId!==state.token)
      throw fail('Nie udało się potwierdzić zapisu klienta. Spróbuj ponownie.','client-card-unconfirmed');
    return result;
  }
  async function edit(state){
    assert(state);assert(state,state.base);
    if(!window._db)throw fail('Brak połączenia z bazą. Spróbuj ponownie.','client-card-unavailable');
    const transaction=required('_runTransaction'),doc=required('_doc');
    const docId=state.candidate._fbId||state.candidate.id;
    const ref=doc(window._db,'clients',docId);
    assert(state);
    const saved=await transaction(window._db,async tx=>{
      assert(state);
      const found=await tx.get(ref);
      assert(state);
      if(!found.exists())throw fail('Klient został usunięty. Otwórz ponownie listę klientów.','client-card-unavailable');
      const remote=snapshot(found.data(),docId,state);
      assert(state,remote);
      if(remote.clientCardWriteId===state.token)return remote;
      const patch={},conflicts=[];
      for(const key of fields){
        if(!own(state.candidate,key)||state.candidate[key]===undefined)continue;
        const next=state.candidate[key],base=state.base[key];
        if(equal(next,base))continue;
        if(!equal(remote[key],base)&&!equal(remote[key],next))conflicts.push(labels[key]);
        if(!equal(remote[key],next))patch[key]=clone(next);
      }
      if(conflicts.length)throw conflict('Dane klienta zmieniły się w innym oknie ('+conflicts.join(', ')+'). Wczytaj aktualne dane przed kolejną edycją.',remote);
      patch.clientCardWriteId=state.token;
      assert(state,remote);
      tx.update(ref,patch);
      return {...remote,...clone(patch)};
    });
    assert(state);assert(state,saved);
    return clone(saved);
  }
  // Non-async entry point preserves strict promise identity for double submissions.
  window.saveClientCardConfirmed=function(candidate,operation){
    if(!operation||typeof operation!=='object')return Promise.reject(fail('Otwórz ponownie formularz klienta.'));
    let state=operations.get(operation);
    try{
      if(!state){
        if(!candidate||typeof candidate!=='object'||typeof candidate.id!=='string'||!candidate.id||candidate.id.includes('/')||
          (candidate._fbId&&typeof candidate._fbId!=='string')||(candidate._fbId&&candidate._fbId.includes('/')))
          throw fail('Nieprawidłowy identyfikator klienta. Otwórz ponownie formularz.');
        if(typeof operation.edit!=='boolean'||(operation.edit&&(!operation.base||operation.base.id!==candidate.id)))
          throw fail('Nie można potwierdzić danych wyjściowych klienta. Otwórz ponownie formularz.');
        if((!operation.edit&&candidate._fbId&&candidate._fbId!==candidate.id)||
          (operation.edit&&(operation.base._fbId||operation.base.id)!==(candidate._fbId||candidate.id)))
          throw fail('Identyfikator klienta zmienił się. Otwórz ponownie formularz.');
        const first=clone(candidate),auth=freeze(clone(operation.auth)),base=freeze(clone(operation.base));
        if(operation.edit&&own(first,'status')&&!equal(first.status,base.status)&&!['active','inactive'].includes(first.status))
          throw fail('Wybierz status Aktywny lub Nieaktywny. Archiwizacja jest dostępna w menu profilu.','client-card-status');
        state={auth,base,edit:operation.edit,candidate:first,token:null,promise:null,result:null,failed:false};
        assert(state);if(state.edit)assert(state,base);
        state.token=receipt();first.clientCardWriteId=state.token;
        if(!state.edit)first.clientCardCreateId=state.token;
        state.candidate=freeze(first);
        operations.set(operation,state);
        operation.candidate=state.candidate;operation.clientCardWriteId=state.token;
      }
      if(state.promise)return state.promise;
      assert(state);
      if(state.result){assert(state,state.result);return Promise.resolve(clone(state.result));}
      // Defer execution so a second same-tick call sees the pending promise.
      state.promise=Promise.resolve().then(()=>state.edit?edit(state):create(state)).then(result=>{
        assert(state,result);state.result=freeze(clone(result));return clone(result);
      }).catch(error=>{state.failed=true;throw error;}).finally(()=>{state.promise=null;});
      return state.promise;
    }catch(error){return Promise.reject(error);}
  };
})();
