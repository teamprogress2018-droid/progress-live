/**
 * Progress Live 3.0 — Etap 4c: Vision (pilotaż) — analiza techniki z filmu klienta przez AI, TYLKO dla trenera.
 *
 * - Przycisk „Analiza AI (pilot)” pojawia się na karcie filmu w czacie trenera wyłącznie wtedy, gdy klient przy wysyłce
 *   zaznaczył zgodę (linia `CV_AI_LINE` w wiadomości, client-video.js).
 * - Przeglądarka trenera wyciąga 4 klatki (15/40/65/90% filmu, maks. 640 px, JPEG) i wysyła je przez pośrednika AI
 *   (ścieżka trenera, ten sam dzienny limit co inne funkcje AI) z nazwą ćwiczenia i wiadomością klienta.
 * - Wynik: co wygląda dobrze, maks. 3 rzeczy do poprawy (z numerem klatki), wskazówka dla klienta, pewność i ograniczenia.
 *   Tylko w pamięci, nic nie jest zapisywane ani wysyłane klientowi. „Wstaw wskazówkę do wiadomości” wkleja szkic do #msg-inp.
 * - Bez diagnoz i bez oceny bólu/kontuzji — to pomoc dla trenera, decyzja zostaje u niego.
 */
(function(){
  'use strict';
  const esc=s=>typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const VI_POINTS=[0.15,0.4,0.65,0.9];
  const VI_MAX=640;
  const VI_MODEL='claude-sonnet-5-5';
  const VI_SYSTEM=[
    'Jesteś asystentem trenera personalnego. Oceniasz technikę ćwiczenia na podstawie kilku klatek z krótkiego filmu klienta.',
    'Piszesz po polsku, konkretnie i życzliwie. Oceniasz tylko to, co widać na klatkach; gdy kąt kamery, oświetlenie lub kadr nie pozwalają czegoś ocenić — mówisz to wprost.',
    'Nie diagnozujesz, nie oceniasz bólu ani kontuzji, nie zgadujesz chorób. Nie wymyślasz liczb (kątów, ciężarów), których nie widać.',
    'Odpowiadasz WYŁĄCZNIE poprawnym JSON (bez markdown) o kluczach:',
    '{"dobrze":["…"],"poprawa":[{"co":"…","klatka":1,"jak":"…"}],"wskazowka":"…","pewnosc":"niska|średnia|wysoka","ograniczenia":"…"}',
    '„dobrze” — 1–3 krótkie punkty. „poprawa” — najwyżej 3 najważniejsze rzeczy, każda z numerem klatki (1–4) i jedną wskazówką „jak”.',
    '„wskazowka” — 1–2 zdania do wysłania klientowi przez trenera, prostym językiem. „ograniczenia” — czego nie da się ocenić z tych klatek.'
  ].join('\n');
  const VI={results:{},busy:{}};

  function exFromText(t){const m=/🎥 Film techniki: ([^\n]+)/.exec(String(t||''));return m?m[1].trim().slice(0,120):'';}
  function noteFromText(t){
    const lines=String(t||'').split('\n').map(x=>x.trim()).filter(Boolean)
      .filter(x=>!/^🎥 Film techniki:|^Trening:|^\[film:|^🤖 Zgoda na analizę AI/.test(x));
    return lines.join(' ').slice(0,300);
  }
  function findMsg(cid,mid,file){
    const arr=(window.MSGS&&window.MSGS[cid])||[];
    return arr.find(m=>m&&(m.id===mid||(file&&String(m.text||'').indexOf('[film:'+file+']')>=0)))||null;
  }
  /** Czeka na zdarzenie elementu (z limitem czasu). */
  function once(el,ev,ms){return new Promise((res,rej)=>{const t=setTimeout(()=>{el.removeEventListener(ev,h);rej(new Error(ev+'-timeout'));},ms||8000);
    const h=()=>{clearTimeout(t);el.removeEventListener(ev,h);res();};el.addEventListener(ev,h);});}
  /** 4 klatki z filmu jako base64 JPEG (bez nagłówka data:). */
  async function viFrames(url){
    const v=document.createElement('video');
    v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';v.src=url;
    if(!(v.readyState>=1))await once(v,'loadedmetadata',10000);
    const dur=isFinite(v.duration)&&v.duration>0?v.duration:0;
    if(!dur)throw new Error('no-duration');
    const w0=v.videoWidth||640,h0=v.videoHeight||360,k=Math.min(1,VI_MAX/Math.max(w0,h0));
    const cv=document.createElement('canvas');cv.width=Math.round(w0*k);cv.height=Math.round(h0*k);
    const g=cv.getContext('2d');const out=[];
    for(const p of VI_POINTS){
      v.currentTime=Math.min(dur-0.05,Math.max(0,dur*p));
      await once(v,'seeked',8000);
      g.drawImage(v,0,0,cv.width,cv.height);
      out.push(cv.toDataURL('image/jpeg',0.72).split(',')[1]);
    }
    v.removeAttribute('src');try{v.load();}catch(e){}
    return out;
  }
  async function viBlobUrl(d){
    const key=d.cid+'/'+d.file;
    if(window._cvUrls&&window._cvUrls[key])return window._cvUrls[key];
    if(typeof cvStorageReady!=='function'||!cvStorageReady())throw new Error('storage');
    const blob=await window._getBlob(window._storageRef(window._storage,cvPath(d.tid,d.cid,d.file)));
    const url=URL.createObjectURL(blob);(window._cvUrls=window._cvUrls||{})[key]=url;return url;
  }
  function viParse(text){
    const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
    try{
      const j=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
      const arr=x=>Array.isArray(x)?x:[];
      return {ok:true,dobrze:arr(j.dobrze).map(String).slice(0,3),
        poprawa:arr(j.poprawa).slice(0,3).map(p=>({co:String(p&&p.co||''),klatka:Number(p&&p.klatka)||null,jak:String(p&&p.jak||'')})).filter(p=>p.co),
        wskazowka:String(j.wskazowka||''),pewnosc:['niska','średnia','wysoka'].includes(j.pewnosc)?j.pewnosc:'niska',ograniczenia:String(j.ograniczenia||'')};
    }catch(e){return {ok:false,text:raw};}
  }
  async function viAnalyze(d){
    const key=d.cid+'/'+d.file;
    const msg=findMsg(d.cid,d.mid,d.file);
    if(!msg||!(typeof cvAiAllowed==='function'&&cvAiAllowed(msg.text)))return {error:'Klient nie zgodził się na analizę AI tego filmu.'};
    const frames=await (window.viFramesOverride||viFrames)(await viBlobUrl(d));
    const ex=exFromText(msg.text),note=noteFromText(msg.text);
    const content=frames.map((b,i)=>[{type:'text',text:'Klatka '+(i+1)+' ('+Math.round(VI_POINTS[i]*100)+'% filmu):'},{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b}}]).flat();
    content.push({type:'text',text:'Ćwiczenie: '+(ex||'nie podano')+'.'+(note?' Wiadomość klienta do filmu: „'+note+'”.':'')+' Oceń technikę.'});
    const r=await fetch(typeof W==='string'?W:'https://anthropic-proxy.teamprogress2018.workers.dev/',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:VI_MODEL,max_tokens:900,system:VI_SYSTEM,messages:[{role:'user',content}]})});
    const data=await r.json().catch(()=>null);
    if(!r.ok){
      const m=data&&data.error&&(data.error.message||data.error.type)||'';
      return {error:r.status===429?'Dzienny limit AI jest wykorzystany.':m?('AI nie odpowiedziało: '+String(m).slice(0,140)):'AI nie odpowiedziało. Spróbuj za chwilę.'};
    }
    const text=(Array.isArray(data&&data.content)?data.content:[]).filter(b=>b&&b.type==='text').map(b=>b.text).join('\n');
    const res=viParse(text);res.frames=frames;res.ex=ex;
    VI.results[key]=res;
    return res;
  }
  function viResultHTML(res,d){
    if(res.error)return `<p class="cv-err" role="alert">${esc(res.error)}</p>`;
    const thumbs=(res.frames||[]).map((b,i)=>`<figure class="vi-frame"><img alt="Klatka ${i+1}" src="data:image/jpeg;base64,${b}"><figcaption>${i+1}</figcaption></figure>`).join('');
    const head=`<div class="vi-head"><b>Analiza AI — pilotaż</b><span class="vi-conf">pewność: ${esc(res.pewnosc||'niska')}</span></div>`;
    if(!res.ok)return `<div class="vi-box" data-vi-result>${head}<div class="vi-frames">${thumbs}</div><p class="vi-raw">${esc(res.text||'')}</p></div>`;
    return `<div class="vi-box" data-vi-result>${head}
      <div class="vi-frames">${thumbs}</div>
      ${res.dobrze.length?`<p class="vi-h">Dobrze</p><ul>${res.dobrze.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
      ${res.poprawa.length?`<p class="vi-h">Do poprawy</p><ol>${res.poprawa.map(p=>`<li><b>${esc(p.co)}</b>${p.klatka?` <span class="vi-k">klatka ${p.klatka}</span>`:''}${p.jak?`<br>${esc(p.jak)}`:''}</li>`).join('')}</ol>`:''}
      ${res.wskazowka?`<p class="vi-h">Wskazówka dla klienta (szkic)</p><p class="vi-tip" data-vi-tip>${esc(res.wskazowka)}</p>`:''}
      ${res.ograniczenia?`<p class="vi-lim">Ograniczenia: ${esc(res.ograniczenia)}</p>`:''}
      <p class="vi-lim">To podpowiedź AI z 4 klatek — może się mylić. Decyzja i odpowiedź należą do Ciebie. Nic nie zostało zapisane ani wysłane klientowi.</p>
      <div class="vi-actions">${res.wskazowka?`<button type="button" class="cv-btn" data-act="vi-insert" data-act-stop-prop data-file="${esc(d.file)}" data-cid="${esc(d.cid)}">Wstaw wskazówkę do wiadomości</button>`:''}
        <button type="button" class="cv-btn" data-act="vi-hide" data-act-stop-prop data-file="${esc(d.file)}" data-cid="${esc(d.cid)}">Ukryj</button></div>
    </div>`;
  }
  function box(d,el){
    const own=el&&el.closest&&el.closest('[data-cv-card]');
    const card=own||[...document.querySelectorAll('[data-cv-card]')].find(x=>x.getAttribute('data-cv-card')===d.file&&x.getAttribute('data-cv-cid')===d.cid);
    return card&&card.querySelector('[data-cv-ai]');
  }
  async function viRun(d,el){
    const b=box(d,el);if(!b)return;
    const key=d.cid+'/'+d.file;
    if(VI.results[key]){b.innerHTML=viResultHTML(VI.results[key],d);return;}
    if(VI.busy[key])return;
    VI.busy[key]=true;
    b.innerHTML='<p class="cv-state" role="status">Analizuję 4 klatki filmu… (ok. 10–20 s)</p>';
    let res;
    try{res=await viAnalyze(d);}
    catch(e){const c=String(e&&e.code||e&&e.message||'');
      res={error:c.includes('unauthorized')?'Brak dostępu do tego filmu.':c.includes('object-not-found')?'Film został usunięty.':c.includes('no-duration')||c.includes('timeout')?'Nie udało się odczytać klatek z tego filmu w tej przeglądarce.':'Nie udało się przeanalizować filmu. Sprawdź połączenie i spróbuj ponownie.'};}
    VI.busy[key]=false;
    const nb=box(d,el)||b;nb.innerHTML=viResultHTML(res,d);
  }
  if(typeof uiAction==='function'){
    uiAction('cv-ai',(d,el)=>{viRun(d,el);});
    uiAction('vi-hide',(d,el)=>{const b=box(d,el);if(b)b.innerHTML='';});
    uiAction('vi-insert',(d)=>{
      const res=VI.results[d.cid+'/'+d.file];const inp=document.getElementById('msg-inp');
      if(!res||!res.wskazowka||!inp)return;
      inp.value=(inp.value?inp.value.trim()+'\n':'')+res.wskazowka;
      try{inp.focus();}catch(e){}
      if(typeof notify==='function')notify('Wskazówka wstawiona — sprawdź ją przed wysłaniem');
    });
  }
  Object.assign(window,{VI,viParse,viFrames,viAnalyze,viRun,viResultHTML,VI_SYSTEM,VI_POINTS});
})();
