/* Strona główna trenera (pulpit): powitanie, data, wyszukiwarka, „Mój dzień” i „Twoje cele”.
   Wszystko liczone z istniejących danych (CL, SE, PL, PACKAGES, CHECKINS) — bez danych przykładowych. */
(function(){
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const DAYS=['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
  const MONTHS=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const todayStr=()=>typeof dashTodayYmd==='function'?dashTodayYmd():ymd(new Date());

  function weekRange(){
    const t=new Date(todayStr()+'T12:00:00');
    const start=new Date(t);start.setDate(t.getDate()-((t.getDay()+6)%7));
    const end=new Date(start);end.setDate(start.getDate()+6);
    return{start:ymd(start),end:ymd(end)};
  }
  function clientName(id){
    const c=(window.CL||[]).find(x=>x&&x.id===id);
    return c?String(c.name||''):'';
  }
  function firstName(full){return String(full||'').trim().split(/\s+/)[0]||'';}

  function renderDashBadges(){
    const set=(id,n)=>{const el=document.getElementById(id);if(!el)return;el.textContent=n>9?'9+':String(n);el.hidden=!n;};
    set('dash-notif-badge',typeof unreadCount==='function'?unreadCount():0);
    set('dash-msg-badge',typeof unreadMsgCount==='function'?unreadMsgCount():0);
  }

  function renderDashHeader(){
    const name=typeof getTrainerName==='function'?getTrainerName(''):'';
    const hello=document.getElementById('dash-hello');
    if(hello)hello.textContent=name?'Witaj, '+firstName(name)+'!':'Witaj w Progress Live!';
    const d=new Date(todayStr()+'T12:00:00');
    const day=document.getElementById('dash-date-day');
    const full=document.getElementById('dash-date-full');
    if(day)day.textContent=DAYS[d.getDay()];
    if(full)full.textContent=d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear();
    renderDashBadges();
  }

  function sessionTag(s){
    if(/online/i.test(String(s.type||'')+' '+String(s.title||'')+' '+String(s.location||'')))return{lbl:'Online',cls:'online'};
    if(!s.clientId)return{lbl:'Trening',cls:'own'};
    return{lbl:'Klient',cls:'client'};
  }
  function sessionTitle(s){
    const n=String(clientName(s.clientId)||s.clientName||'').trim();
    const kind=String(s.type||s.title||'').trim();
    if(n)return kind&&kind!==n?n+' · '+kind:n;
    return kind||'Własny trening';
  }

  function renderDashDay(){
    const el=document.getElementById('dash-day-list');if(!el)return;
    const rows=(typeof dashTodaySessions==='function'?dashTodaySessions():[]).slice(0,6);
    if(!rows.length){
      el.innerHTML='<div class="dash3-empty">Brak zaplanowanych zajęć na dziś.<button type="button" onclick="goTo(\'calendar\')">Zaplanuj w kalendarzu →</button></div>';
      return;
    }
    const now=new Date();
    el.innerHTML=rows.map(s=>{
      const st=typeof dashSessionState==='function'?dashSessionState(s,now):{kind:'upcoming'};
      const tag=sessionTag(s);
      const done=st.kind==='done';
      const stLbl=done?'zrealizowany':st.kind==='running'?'trwa teraz':st.kind==='skipped'?'pominięty':'';
      return '<button type="button" class="dash3-day-row dash3-tag-'+tag.cls+(done?' is-done':'')+(st.kind==='running'?' is-now':'')+'" onclick="goTo(\'calendar\')"'+(stLbl?' title="'+esc(stLbl)+'"':'')+'>'+
        '<span class="dash3-check" aria-hidden="true">'+(done?'✓':'')+'</span>'+
        '<b>'+esc(s.time||'—')+'</b><i></i>'+
        '<span class="dash3-day-name">'+esc(sessionTitle(s))+'</span>'+
        '<em>'+esc(tag.lbl)+'</em></button>';
    }).join('');
  }

  function dashGoals(){
    const w=weekRange();const today=todayStr();const now=new Date();
    const week=(typeof dashAgendaSessions==='function'?dashAgendaSessions(window.SE||[]):(window.SE||[]))
      .filter(s=>s&&s.date>=w.start&&s.date<=w.end&&!(typeof sessionIsSkipped==='function'&&sessionIsSkipped(s)));
    const weekDone=week.filter(s=>typeof dashSessionState==='function'?dashSessionState(s,now).kind==='done':s.date<today).length;

    const active=(window.CL||[]).filter(c=>c&&(c.status==='active'||!c.status));
    const withPlan=new Set((window.PL||[]).map(p=>p&&p.clientId).filter(Boolean));
    const planned=active.filter(c=>withPlan.has(c.id)).length;

    const pkgs=(window.PACKAGES||[]).filter(p=>p&&p.status!=='archived'&&p.status!=='cancelled'&&(!p.expiresDate||String(p.expiresDate).slice(0,10)>=today));
    const paid=pkgs.filter(p=>p.payStatus==='paid').length;

    const cis=[];Object.values(window.CHECKINS||{}).forEach(list=>(list||[]).forEach(ci=>{const d=String(ci&&ci.date||'').slice(0,10);if(d>=w.start&&d<=w.end)cis.push(ci);}));
    const filled=cis.filter(ci=>ci.status&&ci.status!=='pending').length;

    return[
      {key:'train',lbl:'Treningi',done:weekDone,total:week.length,hint:'Zrealizowane treningi w tym tygodniu'},
      {key:'plans',lbl:'Plany',done:planned,total:active.length,hint:'Aktywni klienci z przypisanym planem'},
      {key:'money',lbl:'Finanse',done:paid,total:pkgs.length,hint:'Opłacone aktywne pakiety'},
      {key:'checkin',lbl:'Check-iny',done:filled,total:cis.length,hint:'Wypełnione check-iny w tym tygodniu'}
    ];
  }
  const GOAL_ICON={
    train:'<svg viewBox="0 0 24 24"><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="5.5" y="7" width="3" height="10" rx="1"/><rect x="8.5" y="11" width="7" height="2"/><rect x="15.5" y="7" width="3" height="10" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/></svg>',
    plans:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>',
    money:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5h4" fill="none" stroke="#0b0c0e" stroke-width="1.6"/></svg>',
    checkin:'<svg viewBox="0 0 24 24"><path d="M12 2l2.6 6.3L21 9l-5 4.4L17.5 21 12 17.3 6.5 21 8 13.4 3 9l6.4-.7z"/></svg>'
  };
  function renderDashGoals(){
    const el=document.getElementById('dash-goals-list');if(!el)return;
    el.innerHTML=dashGoals().map(g=>{
      const pct=g.total?Math.min(100,Math.round(g.done/g.total*100)):0;
      return '<div class="dash3-goal dash3-goal-'+g.key+'" title="'+esc(g.hint)+'"><span class="dash3-goal-ic">'+GOAL_ICON[g.key]+'</span><span class="dash3-goal-lbl">'+esc(g.lbl)+'</span>'+
        '<span class="dash3-goal-bar" role="progressbar" aria-label="'+esc(g.hint)+'" aria-valuemin="0" aria-valuemax="'+g.total+'" aria-valuenow="'+g.done+'"><b style="width:'+pct+'%"></b></span>'+
        '<em>'+(g.total?g.done+' / '+g.total:'—')+'</em></div>';
    }).join('');
  }

  function renderDashHome(){
    renderDashHeader();
    renderDashDay();
    renderDashGoals();
  }

  function dashNewNote(){
    if(typeof goTo==='function')goTo('kb');
    if(typeof openKbModal==='function')openKbModal();
  }

  // ── Wyszukiwarka ──────────────────────────────────────────────
  let searchHits=[];let searchSel=0;
  function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l');}
  function searchData(q){
    const n=norm(q);if(n.length<2)return[];
    const hits=[];
    (window.CL||[]).forEach(c=>{if(c&&c.status!=='archived'&&(norm(c.name).includes(n)||norm(c.email).includes(n)))hits.push({kind:'Klient',label:c.name,sub:c.email||'',go:()=>{goTo('clients');if(typeof openClientProfile==='function')openClientProfile(c.id);}});});
    (window.PL||[]).forEach(p=>{if(p&&norm(p.name).includes(n)){const cn=clientName(p.clientId);hits.push({kind:'Plan',label:p.name,sub:cn,go:()=>{if(typeof editPlan==='function')editPlan(p.id);else goTo('plans');}});}});
    const ex=typeof allExercises==='function'?allExercises():[];
    let exN=0;
    for(const e of ex){if(exN>=6)break;if(e&&norm(e.name).includes(n)){exN++;hits.push({kind:'Ćwiczenie',label:e.name,sub:e.muscle||e.cat||'',go:()=>{goTo('library');if(typeof openExDetail==='function')openExDetail(e.name);}});}}
    return hits.slice(0,12);
  }
  function renderSearch(){
    const box=document.getElementById('dash-search-results');if(!box)return;
    const input=document.getElementById('dash-search');
    const q=input?input.value.trim():'';
    if(q.length<2){box.hidden=true;box.innerHTML='';return;}
    box.hidden=false;
    box.innerHTML=searchHits.length?searchHits.map((h,i)=>'<button type="button" role="option" aria-selected="'+(i===searchSel)+'" class="'+(i===searchSel?'is-sel':'')+'" onmousedown="event.preventDefault();dashSearchOpen('+i+')"><em>'+esc(h.kind)+'</em><b>'+esc(h.label)+'</b><span>'+esc(h.sub)+'</span></button>').join('')
      :'<div class="dash3-search-empty">Brak wyników dla „'+esc(q)+'”</div>';
  }
  function dashSearchInput(q){searchHits=searchData(q);searchSel=0;renderSearch();}
  function closeSearch(){const box=document.getElementById('dash-search-results');if(box){box.hidden=true;}}
  function dashSearchOpen(i){
    const h=searchHits[i];if(!h)return;
    const input=document.getElementById('dash-search');if(input){input.value='';input.blur();}
    searchHits=[];closeSearch();h.go();
  }
  function dashSearchKey(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      if(!searchHits.length)return;e.preventDefault();
      searchSel=(searchSel+(e.key==='ArrowDown'?1:-1)+searchHits.length)%searchHits.length;renderSearch();
    }else if(e.key==='Enter'){e.preventDefault();dashSearchOpen(searchSel);}
    else if(e.key==='Escape'){e.target.value='';searchHits=[];closeSearch();e.target.blur();}
  }
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==='k'){
      const scr=document.getElementById('screen-dashboard');
      const input=document.getElementById('dash-search');
      if(scr&&scr.classList.contains('active')&&input){e.preventDefault();input.focus();input.select();}
    }
  });
  document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('.dash3-search'))closeSearch();});

  Object.assign(window,{renderDashHome,renderDashBadges,renderDashDay,renderDashGoals,dashGoals,dashNewNote,dashSearchInput,dashSearchKey,dashSearchOpen});
})();
