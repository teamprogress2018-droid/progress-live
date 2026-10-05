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
  function invoicePrefix(){
    const configured=window.SETTINGS&&window.SETTINGS.company&&window.SETTINGS.company.invoice_prefix;
    const prefix=configured===undefined||configured===null||configured===''?'INV':configured;
    if(typeof prefix!=='string'||!/^[\p{L}\p{N}._/\-]{1,40}$/u.test(prefix))
      throw fail('Sprawdź prefiks faktur w Ustawieniach → Firma: użyj od 1 do 40 liter lub cyfr oraz separatorów /, _, - i kropki, bez spacji, cudzysłowów i znaków sterujących.');
    return prefix;
  }
  function validate(pair){
    const p=pair&&pair.pkg,i=pair&&pair.invoice;
    if(!p||!i||!p.title||!p.title.trim()||!p.clientId||!['sessions','monthly','program','online'].includes(p.type)||
      !['paid','pending','partial'].includes(p.payStatus)||!Number.isFinite(p.price)||p.price<0||p.price>Number.MAX_SAFE_INTEGER/100||
      Math.abs(p.price*100-Math.round(p.price*100))>0.00001||!Number.isSafeInteger(p.sessions)||p.sessions<1||
      !Number.isSafeInteger(p.validity)||p.validity<1||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(p.date)||
      !Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date)
      throw fail('Sprawdź nazwę, klienta, datę, cenę oraz dodatnią liczbę sesji i dni ważności.');
  }
  function pairFromDocs(state,packages,invoices){
    if(packages.length!==1||invoices.length!==1)throw fail('Nie można potwierdzić pary pakiet–faktura. Odśwież dane przed kolejną próbą.');
    const p=packages[0],i=invoices[0],pkg={...p.data(),_fbId:p.id},invoice={...i.data(),_fbId:i.id};
    if(p.id!==state.pair.pkg.id||i.id!==state.pair.invoice.id||pkg.id!==p.id||invoice.id!==i.id||
      pkg.trainerId!==state.auth.uid||invoice.trainerId!==state.auth.uid||pkg.packageCreateId!==state.token||
      invoice.packageCreateId!==state.token||pkg.invoiceDocId!==invoice.id||invoice.pkgId!==pkg.id||pkg.clientId!==state.client.id||invoice.clientId!==state.client.id)
      throw fail('Istnieją inne dane z tym identyfikatorem. Odśwież dane przed kolejną próbą.');
    for(const key of ['title','type','sessions','price','validity','date','expiresDate','invoiceDocId'])if(pkg[key]!==state.pair.pkg[key])throw fail('Dane pakietu nie odpowiadają tej próbie zapisu. Odśwież dane.');
    for(const key of ['pkgTitle','date','amount'])if(invoice[key]!==state.pair.invoice[key])throw fail('Dane faktury nie odpowiadają tej próbie zapisu. Odśwież dane.');
    if(!Number.isSafeInteger(invoice.numberSequence)||invoice.numberSequence<1||invoice.numberSeries!=='S'||
      invoice.numberPrefix!==state.prefix||invoice.nr!==state.prefix+'-S-'+invoice.numberSequence||pkg.invoiceId!==invoice.nr)
      throw fail('Nie można potwierdzić numeru faktury. Odśwież dane przed kolejną próbą.');
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
      const counterRef=doc(window._db,'invoiceCounters',state.auth.uid);
      const counter=await tx.get(counterRef);
      assert(state);
      const previous=counter.exists()?counter.data():{trainerId:state.auth.uid,last:0};
      if(!previous||previous.trainerId!==state.auth.uid||!Number.isSafeInteger(previous.last)||previous.last<0||previous.last>=Number.MAX_SAFE_INTEGER)
        throw fail('Licznik faktur jest nieprawidłowy. Odśwież dane przed kolejną próbą.');
      const sequence=previous.last+1,nr=state.prefix+'-S-'+sequence;
      // The callback may rerun after a counter conflict; the frozen draft stays unchanged.
      const pair=copy(state.pair);
      pair.pkg.invoiceId=nr;
      pair.invoice.nr=nr;pair.invoice.numberSequence=sequence;pair.invoice.numberSeries='S';
      tx.set(counterRef,{trainerId:state.auth.uid,last:sequence,invoiceDocId:pair.invoice.id});
      // UUID document IDs avoid reading missing records, forbidden by owner rules.
      tx.set(doc(window._db,'packages',pair.pkg.id),pair.pkg);
      tx.set(doc(window._db,'invoices',pair.invoice.id),pair.invoice);
      return pair;
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
        state={auth:Object.freeze(copy(operation.auth)),client:Object.freeze(copy(operation.client)),pair:copy(pair),prefix:invoicePrefix(),token:uuid('pcw'),failed:false,promise:null,result:null};
        assert(state);state.pair.pkg.packageCreateId=state.token;state.pair.invoice.packageCreateId=state.token;state.pair.invoice.numberPrefix=state.prefix;
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

/* Confirm a payment on the latest package and its linked invoice together. */
(function(){
  'use strict';
  const states=new Map();
  const copy=value=>JSON.parse(JSON.stringify(value));
  const fail=message=>new Error(message);
  const required=name=>{if(typeof window[name]!=='function')throw fail('Brak połączenia z bazą. Spróbuj ponownie.');return window[name];};
  function assert(state,pkg){
    if(!required('assignmentSessionCurrent')(state.auth))throw fail('Sesja zmieniła się. Otwórz ponownie płatności.');
    const client=(window.CL||[]).find(c=>c&&c.id===state.client.id);
    required('assertAssignmentSession')(state.auth,client);
    if((client._fbId||client.id)!==(state.client._fbId||state.client.id))throw fail('Klient zmienił się. Otwórz ponownie płatności.');
    const local=(window.PACKAGES||[]).find(p=>p&&p.id===state.pkg.id);
    if(!local||local.trainerId!==state.auth.uid||local.clientId!==state.client.id||local.archived||local.deleted||local.status==='archived'||(local._fbId||local.id)!==state.docId)
      throw fail('Pakiet zmienił się. Odśwież płatności.');
    if(pkg&&(pkg.id!==state.pkg.id||pkg.trainerId!==state.auth.uid||pkg.clientId!==state.client.id||pkg.archived||pkg.deleted||pkg.status==='archived'||!['pending','partial','paid'].includes(pkg.payStatus)))
      throw fail('Pakiet jest niedostępny. Odśwież płatności.');
  }
  function invoiceAssert(state,pkg,invoice,docId){
    const freshLink=invoice&&(invoice.pkgId===pkg.id||pkg.invoiceDocId===docId&&invoice.clientId===pkg.clientId||
      !pkg.invoiceDocId&&pkg.invoiceId&&(invoice.id===pkg.invoiceId||invoice.nr===pkg.invoiceId)&&invoice.clientId===pkg.clientId);
    if(!invoice||!freshLink||invoice.trainerId!==state.auth.uid||invoice.pkgId&&invoice.pkgId!==pkg.id||invoice.clientId&&invoice.clientId!==pkg.clientId||!invoice.pkgId&&invoice.clientId!==pkg.clientId||invoice.archived||invoice.deleted||!['pending','partial','paid'].includes(invoice.status)||
      pkg.invoiceDocId&&(pkg.invoiceDocId!==docId||invoice.id!==docId))
      throw fail('Faktura nie odpowiada temu pakietowi. Odśwież płatności.');
  }
  async function pay(state){
    assert(state);if(!window._db)throw fail('Brak połączenia z bazą. Spróbuj ponownie.');
    const get=required('_getDocsFromServer'),query=required('_query'),col=required('_col'),where=required('_where'),doc=required('_doc');
    // Legacy id/number fallbacks must be unique within the captured owner.
    const lookups=[['pkgId',state.pkg.id]];
    if(state.pkg.invoiceId)lookups.push(['id',state.pkg.invoiceId],['nr',state.pkg.invoiceId]);
    const snapshots=await Promise.all(lookups.map(([field,value])=>get(query(col(window._db,'invoices'),where('trainerId','==',state.auth.uid),where(field,'==',value)))));
    assert(state);
    if(snapshots.some(found=>!found||!Array.isArray(found.docs)||found.metadata&&found.metadata.hasPendingWrites))throw fail('Nie udało się potwierdzić powiązanej faktury. Spróbuj ponownie.');
    const docs=new Map();snapshots.forEach(found=>found.docs.forEach(row=>docs.set(row.id,row)));
    const result=await required('_runTransaction')(window._db,async tx=>{
      assert(state);
      const packageRef=doc(window._db,'packages',state.docId),packageDoc=await tx.get(packageRef);
      assert(state);
      if(!packageDoc.exists())throw fail('Pakiet został usunięty. Odśwież płatności.');
      const pkg={...packageDoc.data(),_fbId:state.docId};assert(state,pkg);
      const clientDoc=await tx.get(doc(window._db,'clients',state.client._fbId||state.client.id));
      assert(state);
      if(!clientDoc.exists())throw fail('Klient został usunięty. Odśwież płatności.');
      const client=clientDoc.data();required('assertAssignmentSession')(state.auth,client);
      if(client.id!==state.client.id)throw fail('Klient zmienił się. Odśwież płatności.');
      let invoiceId=pkg.invoiceDocId;
      if(!invoiceId){
        const linked=[...docs.values()].filter(row=>row.data().pkgId===pkg.id);
        const candidates=linked.length?linked:[...docs.values()].filter(row=>pkg.invoiceId&&(row.data().id===pkg.invoiceId||row.data().nr===pkg.invoiceId));
        if(candidates.length!==1)throw fail(candidates.length?'Znaleziono więcej niż jedną fakturę pakietu. Sprawdź faktury przed ponowieniem.':'Brak powiązanej faktury. Sprawdź faktury przed ponowieniem.');
        invoiceId=candidates[0].id;
      }
      if(typeof invoiceId!=='string'||!invoiceId||invoiceId.includes('/'))throw fail('Nieprawidłowe powiązanie faktury. Odśwież płatności.');
      const invoiceRef=doc(window._db,'invoices',invoiceId);
      let invoiceDoc;
      try{invoiceDoc=await tx.get(invoiceRef);}catch(error){assert(state);throw fail('Nie można odczytać powiązanej faktury. Sprawdź faktury i spróbuj ponownie.');}
      assert(state);
      if(!invoiceDoc.exists())throw fail('Powiązana faktura została usunięta. Odśwież płatności.');
      const invoice={id:invoiceId,...invoiceDoc.data(),_fbId:invoiceId};invoiceAssert(state,pkg,invoice,invoiceId);
      if(!state.invoiceMasks.has(invoiceId))state.invoiceMasks.set(invoiceId,invoice.status);
      const packagePatch=pkg.payStatus==='paid'?{}:{payStatus:'paid',paymentWriteId:state.token};
      const invoicePatch=invoice.status==='paid'?{}:{status:'paid',paymentWriteId:state.token};
      // Only payment fields change; current usage, price, notes and numbering survive.
      if(Object.keys(packagePatch).length)tx.update(packageRef,packagePatch);
      if(Object.keys(invoicePatch).length)tx.update(invoiceRef,invoicePatch);
      return {pkg:{...pkg,...packagePatch},invoice:{...invoice,...invoicePatch},paymentTransition:packagePatch.payStatus==='paid'||pkg.paymentWriteId===state.token};
    });
    assert(state);
    if(!result||!result.pkg||!result.invoice||result.pkg.payStatus!=='paid'||result.invoice.status!=='paid')throw fail('Nie udało się potwierdzić płatności. Spróbuj ponownie.');
    assert(state,result.pkg);invoiceAssert(state,result.pkg,result.invoice,result.invoice._fbId);
    return result;
  }
  window.packagePaymentConfirmedRecord=function(record,collection){
    for(const state of states.values()){
      if(!state.masked||!required('assignmentSessionCurrent')(state.auth))continue;
      if(collection==='packages'&&record.id===state.pkg.id&&record.trainerId===state.auth.uid)return {...record,payStatus:state.pkg.payStatus};
      if(collection==='invoices'&&record.trainerId===state.auth.uid&&state.invoiceMasks.has(record._fbId||record.id))return {...record,status:state.invoiceMasks.get(record._fbId||record.id)};
    }
    return record;
  };
  window.clearPackagePaymentStates=function(){states.clear();};
  // Non-async entry preserves promise identity for submissions from both payment views.
  window.markPackagePaidConfirmed=function(pkg,auth){
    try{
      if(!pkg||typeof pkg.id!=='string'||!pkg.id||pkg.id.includes('/')||typeof (pkg._fbId||pkg.id)!=='string'||(pkg._fbId||pkg.id).includes('/')||!auth||!auth.uid)throw fail('Nieprawidłowy pakiet. Odśwież płatności.');
      const key=JSON.stringify([auth.uid,auth.generation,pkg._fbId||pkg.id]);
      let state=states.get(key);
      if(!state){
        const client=(window.CL||[]).find(c=>c&&c.id===pkg.clientId);
        required('assertAssignmentSession')(auth,client);
        state={auth:Object.freeze(copy(auth)),client:Object.freeze(copy(client)),pkg:Object.freeze(copy(pkg)),docId:pkg._fbId||pkg.id,token:required('newPackageSaveId')('ppw'),promise:null,acknowledged:false,masked:false,invoiceMasks:new Map()};
        assert(state,pkg);states.set(key,state);
      }
      assert(state);
      if(state.promise)return state.promise;
      state.masked=true;
      state.promise=Promise.resolve().then(()=>pay(state)).then(result=>{
        assert(state,result.pkg);const transitioned=result.paymentTransition&&!state.acknowledged;
        state.acknowledged=true;state.masked=false;if(states.get(key)===state)states.delete(key);return {...copy(result),transitioned};
      }).finally(()=>{state.promise=null;});
      return state.promise;
    }catch(error){return Promise.reject(error);}
  };
})();
