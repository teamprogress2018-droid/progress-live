/* Create a package and its invoice as one confirmed, retryable operation. */
(function(){
  'use strict';
  const operations=new WeakMap(),unconfirmed=new Set();
  const copy=value=>JSON.parse(JSON.stringify(value));
  const fail=message=>new Error(message);
  function required(name){if(typeof window[name]!=='function')throw fail('Brak połączenia z bazą. Spróbuj ponownie.');return window[name];}
  function uuid(prefix){
    if(window.crypto&&typeof window.crypto.randomUUID==='function')return prefix+'_'+window.crypto.randomUUID();
    if(window.crypto&&typeof window.crypto.getRandomValues==='function'){
      const bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);
      return prefix+'_'+Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
    }
    throw fail('Nie można bezpiecznie rozpocząć zapisu. Odśwież aplikację.');
  }
  function assert(state,remote){
    if(!required('assignmentSessionCurrent')(state.auth))throw fail('Sesja zmieniła się. Otwórz ponownie formularz.');
    const current=(window.CL||[]).find(c=>c&&c.id===state.client.id);
    required('assertAssignmentSession')(state.auth,current);
    if((current._fbId||current.id)!==(state.client._fbId||state.client.id))throw fail('Klient zmienił się. Otwórz ponownie formularz.');
    if(remote){required('assertAssignmentSession')(state.auth,remote);if(remote.id!==state.client.id)throw fail('Klient zmienił się. Otwórz ponownie formularz.');}
  }
  function validate(pair){
    const p=pair&&pair.pkg,i=pair&&pair.invoice;
    if(!p||!i||!p.title||!p.title.trim()||!p.clientId||!['sessions','monthly','program','online'].includes(p.type)||
      !['paid','pending','partial'].includes(p.payStatus)||!Number.isFinite(p.price)||p.price<0||p.price>Number.MAX_SAFE_INTEGER/100||
      Math.abs(p.price*100-Math.round(p.price*100))>0.00001||!Number.isSafeInteger(p.sessions)||p.sessions<1||
      !Number.isSafeInteger(p.validity)||p.validity<1||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(p.date)||
      !Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date||!i.nr)
      throw fail('Sprawdź nazwę, klienta, datę, cenę oraz dodatnią liczbę sesji i dni ważności.');
  }
  function pairFromDocs(state,packages,invoices){
    if(packages.length!==1||invoices.length!==1)throw fail('Nie można potwierdzić pary pakiet–faktura. Odśwież dane przed kolejną próbą.');
    const p=packages[0],i=invoices[0],pkg={...p.data(),_fbId:p.id},invoice={...i.data(),_fbId:i.id};
    if(p.id!==state.pair.pkg.id||i.id!==state.pair.invoice.id||pkg.id!==p.id||invoice.id!==i.id||
      pkg.trainerId!==state.auth.uid||invoice.trainerId!==state.auth.uid||pkg.packageCreateId!==state.token||
      invoice.packageCreateId!==state.token||pkg.invoiceDocId!==invoice.id||invoice.pkgId!==pkg.id||pkg.clientId!==state.client.id||invoice.clientId!==state.client.id)
      throw fail('Istnieją inne dane z tym identyfikatorem. Odśwież dane przed kolejną próbą.');
    for(const key of ['title','type','sessions','price','validity','date','expiresDate','invoiceId','invoiceDocId'])if(pkg[key]!==state.pair.pkg[key])throw fail('Dane pakietu nie odpowiadają tej próbie zapisu. Odśwież dane.');
    for(const key of ['nr','pkgTitle','date','amount'])if(invoice[key]!==state.pair.invoice[key])throw fail('Dane faktury nie odpowiadają tej próbie zapisu. Odśwież dane.');
    return {pkg,invoice};
  }
  async function create(state){
    assert(state);if(!window._db)throw fail('Brak połączenia z bazą. Spróbuj ponownie.');
    const doc=required('_doc'),transaction=required('_runTransaction');
    if(state.failed){
      await transaction(window._db,async tx=>{
        assert(state);const found=await tx.get(doc(window._db,'clients',state.client._fbId||state.client.id));
        assert(state);if(!found.exists())throw fail('Klient został usunięty. Odśwież listę klientów.');assert(state,found.data());
      });
      assert(state);
      const get=required('_getDocsFromServer'),query=required('_query'),col=required('_col'),where=required('_where');
      // Owned queries are permitted even when the two documents do not exist.
      const found=await Promise.all(['packages','invoices'].map((name,index)=>get(query(col(window._db,name),
        where('trainerId','==',state.auth.uid),where('id','==',index?state.pair.invoice.id:state.pair.pkg.id)))));
      assert(state);
      if(found.some(s=>!s||!Array.isArray(s.docs)||s.metadata&&s.metadata.hasPendingWrites))throw fail('Nie udało się potwierdzić zapisu. Spróbuj ponownie.');
      if(found.some(s=>s.docs.length))return pairFromDocs(state,found[0].docs,found[1].docs);
    }
    const result=await transaction(window._db,async tx=>{
      assert(state);
      const found=await tx.get(doc(window._db,'clients',state.client._fbId||state.client.id));
      assert(state);
      if(!found.exists())throw fail('Klient został usunięty. Odśwież listę klientów.');
      assert(state,found.data());
      // UUID document IDs avoid reading missing records, forbidden by owner rules.
      tx.set(doc(window._db,'packages',state.pair.pkg.id),copy(state.pair.pkg));
      tx.set(doc(window._db,'invoices',state.pair.invoice.id),copy(state.pair.invoice));
      return copy(state.pair);
    });
    assert(state);
    if(!result||!result.pkg||!result.invoice||result.pkg.packageCreateId!==state.token||result.invoice.packageCreateId!==state.token)
      throw fail('Nie udało się potwierdzić zapisu. Spróbuj ponownie.');
    return result;
  }
  window.newPackageSaveId=uuid;
  window.packageSaveRecordVisible=function(record,metadata){return !unconfirmed.has(record&&record.packageCreateId);};
  window.clearPackageSaveReceipts=function(){unconfirmed.clear();};
  window.savePackageConfirmed=function(pair,operation){
    try{
      if(!operation||typeof operation!=='object')throw fail('Otwórz ponownie formularz.');
      let state=operations.get(operation);
      if(!state){
        validate(pair);
        if(!operation.client||operation.client.id!==pair.pkg.clientId)throw fail('Wybierz dostępnego klienta.');
        for(const record of [pair.pkg,pair.invoice])if(typeof record.id!=='string'||!record.id||record.id.includes('/')||record._fbId&&record._fbId!==record.id||record.trainerId!==operation.auth.uid)throw fail('Nieprawidłowy identyfikator lub właściciel zapisu.');
        if(pair.pkg.invoiceDocId!==pair.invoice.id||pair.invoice.pkgId!==pair.pkg.id||pair.invoice.amount!==pair.pkg.price||pair.invoice.status!==pair.pkg.payStatus||pair.invoice.clientId!==pair.pkg.clientId)throw fail('Nieprawidłowa para pakiet–faktura.');
        state={auth:Object.freeze(copy(operation.auth)),client:Object.freeze(copy(operation.client)),pair:copy(pair),token:uuid('pcw'),failed:false,promise:null,result:null};
        assert(state);state.pair.pkg.packageCreateId=state.token;state.pair.invoice.packageCreateId=state.token;
        Object.freeze(state.pair.pkg);Object.freeze(state.pair.invoice);Object.freeze(state.pair);
        operations.set(operation,state);operation.candidate=state.pair;unconfirmed.add(state.token);
      }
      assert(state);
      if(state.promise)return state.promise;
      if(state.result)return Promise.resolve(copy(state.result));
      state.promise=Promise.resolve().then(()=>create(state)).then(result=>{
        assert(state);state.result=copy(result);unconfirmed.delete(state.token);return copy(result);
      }).catch(error=>{state.failed=true;throw error;}).finally(()=>{state.promise=null;});
      return state.promise;
    }catch(error){return Promise.reject(error);}
  };
})();
