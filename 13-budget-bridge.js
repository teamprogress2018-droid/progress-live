/* Progress Live → Budżet Domowy.
 *
 * Kalendarz i pakiety pozostają wyłącznie w Progress Live. Do współdzielonej
 * kolejki trafia tylko potwierdzona wpłata za pakiet, z trwałym identyfikatorem.
 * Obie aplikacje są hostowane pod teamprogress2018-droid.github.io, więc ta
 * kolejka działa w tym samym profilu przeglądarki bez kopiowania kalendarza.
 */
(function(){
  'use strict';
  const OUTBOX_KEY='progress_live_budget_outbox_v1';
  const MAX_AMOUNT=99999999.99;

  function cleanText(value,max){
    return String(value==null?'':value).replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max||140);
  }
  function exactIso(value){
    const iso=String(value||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
    const date=new Date(iso+'T00:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:'';
  }
  function readOutbox(){
    try{
      const parsed=JSON.parse(localStorage.getItem(OUTBOX_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(error){return [];}
  }
  function writeOutbox(list){
    try{localStorage.setItem(OUTBOX_KEY,JSON.stringify(list));return true;}
    catch(error){console.warn('Nie udało się przygotować wpłaty dla Budżetu Domowego',error);return false;}
  }
  function packageClientName(pkg){
    if(pkg&&pkg.clientName)return cleanText(pkg.clientName,100);
    const client=(window.CL||[]).find(item=>item&&item.id===pkg.clientId);
    return cleanText(client&&client.name,100);
  }

  /** Dodaje opłacony pakiet do kolejki. Nie tworzy wpisów dla pojedynczych sesji. */
  function queueProgressLivePaidPackage(pkg,paidAt){
    if(!pkg||pkg.payStatus!=='paid'||pkg.archived||pkg.deleted||pkg.status==='archived')return {queued:false,reason:'not-paid'};
    const amount=Number(pkg.price);
    const packageId=cleanText(pkg.id||pkg._fbId,140);
    const date=exactIso(paidAt)||exactIso(pkg.paidAt)||exactIso(pkg.date)||new Date().toISOString().slice(0,10);
    if(!packageId||!Number.isFinite(amount)||amount<=0||amount>MAX_AMOUNT||!date)return {queued:false,reason:'invalid'};

    const eventId='progress-live:package:'+packageId;
    const outbox=readOutbox();
    const existing=outbox.find(item=>item&&item.id===eventId);
    if(existing)return {queued:false,reason:'exists',event:existing};

    const currency=cleanText(window.SETTINGS&&window.SETTINGS.payments&&window.SETTINGS.payments.currency||'PLN',8)||'PLN';
    const event={
      v:1,id:eventId,source:'progress-live',kind:'package-payment',status:'paid',
      occurredOn:date,amount:Math.round(amount*100)/100,currency,
      clientName:packageClientName(pkg),title:cleanText(pkg.title||pkg.type||'Pakiet treningowy',120),
      paymentMethod:cleanText(pkg.paymentMethod||'bank',16)==='cash'?'cash':'bank',
      createdAt:new Date().toISOString()
    };
    outbox.push(event);
    if(!writeOutbox(outbox))return {queued:false,reason:'storage'};
    return {queued:true,event};
  }

  window.queueProgressLivePaidPackage=queueProgressLivePaidPackage;
  window.progressLiveBudgetOutboxStatus=function(){
    const events=readOutbox();
    return {waiting:events.filter(item=>item&&item.status==='paid').length,imported:events.filter(item=>item&&item.status==='imported').length};
  };
})();
