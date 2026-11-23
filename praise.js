/* Pochwała od trenera po treningu klienta.
 * Trener: szybkie reakcje albo własne zdanie — w oknie treningu (kalendarz) i w czacie pod „Zrobiłem trening”.
 * Zapis: zwykła wiadomość trenera w czacie (messages, out:true) z polem praiseFor = id treningu (sessions.id).
 * Klient widzi pochwałę w czacie, na ekranie „Dzisiaj” (do 3 dni) i w szczegółach treningu. Bez zmian reguł bazy. */
(function(){
  'use strict';
  const PRAISE_QUICK=['👏 Dobra robota!','💪 Świetny trening — tak trzymaj!','🙌 Brawo za regularność!','🔥 Mocno dziś! Widać postęp.'];
  const PRAISE_DAYS=3;
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msgsOf=cid=>((window.MSGS||{})[cid]||[]).filter(Boolean);

  function praiseFor(clientId,key){
    if(!clientId||!key)return null;
    return msgsOf(clientId).filter(m=>m.out&&m.praiseFor===key).slice(-1)[0]||null;
  }
  /** Klucz pochwały dla wiadomości „Zrobiłem trening”: id treningu (msg_<sessionId>) albo samej wiadomości. */
  function praiseKeyForMsg(m){
    const id=String(m&&m.id||'');
    if(/^msg_/.test(id)){const sid=id.slice(4);if((window.SE||[]).some(s=>s&&s.id===sid))return sid;}
    return 'm:'+id;
  }
  function praiseSend(clientId,key,text){
    const t=String(text||'').trim().slice(0,300);
    if(!clientId||!key||!t||typeof pushMsg!=='function')return null;
    if(praiseFor(clientId,key))return null;
    const msg=pushMsg(clientId,t,{kind:'direct',praiseFor:key});
    if(typeof notify==='function')notify('✓ Pochwała wysłana — klient zobaczy ją w aplikacji');
    try{
      const s=(window.SE||[]).find(x=>x&&x.id===key);
      if(s&&typeof renderRecordedExercises==='function'&&document.getElementById('as-recorded-exercises-list'))renderRecordedExercises(s);
      if(typeof curChat!=='undefined'&&curChat===clientId&&typeof openChat==='function')openChat(clientId);
    }catch(e){}
    return msg;
  }
  function chipsHTML(clientId,key){
    return `<div class="pr-chips" role="group" aria-label="Szybka pochwała">${PRAISE_QUICK.map(q=>`<button type="button" class="pr-chip" data-act="praise-send" data-act-stop-prop data-cid="${esc(clientId)}" data-key="${esc(key)}" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="pr-own"><input type="text" class="form-input" maxlength="300" aria-label="Własna pochwała dla klienta" placeholder="Albo napisz własne zdanie, np. poprawiłaś technikę w przysiadzie">
        <button type="button" class="btn btn-primary btn-sm" data-act="praise-own" data-act-stop-prop data-cid="${esc(clientId)}" data-key="${esc(key)}">Wyślij</button></div>`;
  }
  /** Okno treningu w kalendarzu (renderRecordedExercises). */
  function praiseTrainerBlockHTML(s){
    if(window._clientAppMode||!s||!s.clientId||!['client','live','sala','homework'].includes(s.source)||s.status==='in_progress')return '';
    const sent=praiseFor(s.clientId,s.id);
    if(sent)return `<div class="pr-block is-sent" data-pr-block>Twoja pochwała: „${esc(typeof msgDisplayText==='function'?msgDisplayText(sent):sent.text)}” ✓</div>`;
    return `<div class="pr-block" data-pr-block><div class="pr-title">Pochwal klienta</div>${chipsHTML(s.clientId,s.id)}</div>`;
  }
  /** Czat trenera: pod ostatnią wiadomością „Zrobiłem trening…”. */
  function praiseChatBlockHTML(m,clientId){
    if(window._clientAppMode||!m||m.out||!/^Zrobiłem trening/.test(String(m.text||'')))return '';
    const key=praiseKeyForMsg(m);
    const sent=praiseFor(clientId,key);
    if(sent)return `<div class="pr-chat-sent">✓ Pochwała wysłana</div>`;
    const last=msgsOf(clientId).filter(x=>!x.out&&/^Zrobiłem trening/.test(String(x.text||''))).slice(-1)[0];
    if(!last||last.id!==m.id)return '';
    return `<div class="pr-block pr-in-chat" data-pr-block>${chipsHTML(clientId,key)}</div>`;
  }
  /** Klient: najnowsza pochwała z ostatnich 3 dni na ekranie „Dzisiaj”. */
  function praiseLatestForClient(clientId){
    const since=Date.now()-PRAISE_DAYS*86400000;
    return msgsOf(clientId).filter(m=>m.out&&m.praiseFor&&Date.parse(m.createdAt||'')>=since).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).slice(-1)[0]||null;
  }
  function praiseTodayCardHTML(c){
    const m=c&&praiseLatestForClient(c.id);
    if(!m)return '';
    const text=typeof msgDisplayText==='function'?msgDisplayText(m):m.text;
    const reply=typeof csTrainerAction==='function'?csTrainerAction():"setClientLiveScreen('messages')";
    return `<section class="cs-card cs-praise" data-cs-praise><div class="cs-eyebrow">TRENER O TWOIM TRENINGU</div>
      <p class="cs-praise-text">${esc(text)}</p>
      <button type="button" class="cs-link" onclick="${reply}">Odpowiedz trenerowi</button></section>`;
  }
  /** Klient: szczegóły treningu w historii. */
  function praiseClientSessionHTML(s){
    const m=s&&praiseFor(s.clientId,s.id);
    if(!m)return '';
    return `<div class="cs-praise-hist" data-cs-praise-hist><span class="cs-eyebrow">OD TRENERA</span><p>${esc(typeof msgDisplayText==='function'?msgDisplayText(m):m.text)}</p></div>`;
  }

  if(typeof uiAction==='function'){
    uiAction('praise-send',d=>{praiseSend(d.cid,d.key,d.text);});
    uiAction('praise-own',(d,el)=>{
      const inp=el&&el.closest('.pr-own')&&el.closest('.pr-own').querySelector('input');
      const t=inp?inp.value.trim():'';
      if(!t){if(inp)inp.focus();if(typeof notify==='function')notify('Wpisz krótką pochwałę');return;}
      praiseSend(d.cid,d.key,t);
    });
  }
  Object.assign(window,{PRAISE_QUICK,praiseFor,praiseKeyForMsg,praiseSend,praiseTrainerBlockHTML,praiseChatBlockHTML,praiseLatestForClient,praiseTodayCardHTML,praiseClientSessionHTML});
})();
