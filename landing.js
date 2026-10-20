/* Strona startowa przed zalogowaniem: ruchome kafelki z wynikami + okno logowania/zaproszenia. */
(function(){
  'use strict';
  // Przykładowe wyniki, jakie klient widzi w swojej aplikacji (nie są to dane prawdziwych klientów).
  var LANDING_STATS=[
    [
      {tone:'dark',label:'W tym tygodniu',value:'10 240',unit:'kg',text:'przerzucone na treningach',spark:[42,55,48,70,62,84,100]},
      {tone:'light',label:'Martwy ciąg',chip:'Rekord',value:'100',unit:'kg',text:'+5 kg od ostatniego rekordu'},
      {tone:'accent',label:'Seria',value:'21',unit:'dni',text:'bez opuszczonego treningu'},
      {tone:'light',label:'Plan na ten miesiąc',value:'11/12',unit:'',text:'treningów zrobionych',meter:92}
    ],
    [
      {tone:'light',label:'Przysiad',value:'+15',unit:'kg',text:'w 6 tygodni',spark:[60,64,66,72,76,84,100]},
      {tone:'dark',label:'Obwód w pasie',value:'−6',unit:'cm',text:'od pierwszego pomiaru'},
      {tone:'light',label:'Masa ciała',value:'−4,2',unit:'kg',text:'w 8 tygodni',spark:[100,94,90,86,80,76,70]},
      {tone:'dark',label:'Wyciskanie leżąc',chip:'Rekord',value:'80',unit:'kg',text:'pierwsze 5 powtórzeń'}
    ]
  ];

  function landingStatHTML(st,copy){
    var viz='';
    if(st.spark)viz='<div class="pl-land-spark" aria-hidden="true">'+st.spark.map(function(h){return '<i style="height:'+h+'%"></i>';}).join('')+'</div>';
    else if(st.meter)viz='<div class="pl-land-meter" aria-hidden="true"><i style="width:'+st.meter+'%"></i></div>';
    return '<div class="pl-land-stat pl-land-stat--'+st.tone+'"'+(copy?' aria-hidden="true"':'')+'>'+
      '<div class="pl-land-stat-top"><span class="pl-land-stat-label">'+st.label+'</span>'+(st.chip?'<span class="pl-land-stat-chip">'+st.chip+'</span>':'')+'</div>'+
      '<div class="pl-land-stat-value">'+st.value+(st.unit?'<small>'+st.unit+'</small>':'')+'</div>'+
      '<div class="pl-land-stat-text">'+st.text+'</div>'+viz+'</div>';
  }
  // Każda ścieżka ma kafelki dwa razy: animacja przesuwa o połowę, więc pętla nie ma szwu.
  function renderLandingStats(){
    var tracks=document.querySelectorAll('#auth-screen .pl-land-track');
    for(var i=0;i<tracks.length&&i<LANDING_STATS.length;i++){
      var set=LANDING_STATS[i];
      tracks[i].innerHTML=set.map(function(st){return landingStatHTML(st,false);}).join('')+
        set.map(function(st){return landingStatHTML(st,true);}).join('');
    }
  }

  var lastFocus=null;
  function landingOpenAuth(view,email){
    var screen=document.getElementById('auth-screen');
    if(!screen)return;
    if(!screen.classList.contains('pl-auth-open'))lastFocus=document.activeElement;
    screen.classList.add('pl-auth-open');
    var card=document.getElementById('auth-card');
    if(card)card.setAttribute('aria-hidden','false');
    if(view==='login'||view==='register'){
      var ids={login:'auth-login-view',register:'auth-register-view'};
      ['auth-login-view','auth-register-view','auth-reset-view'].forEach(function(id){
        var el=document.getElementById(id);if(el)el.style.display=id===ids[view]?'block':'none';
      });
    }
    var target=null;
    if(view==='login'){
      var em=document.getElementById('auth-email');
      if(em&&email)em.value=email;
      target=em&&em.value?document.getElementById('auth-password'):em;
    }else if(view==='register'){
      var reg=document.getElementById('auth-reg-email');
      if(reg&&email&&!reg.value)reg.value=email;
      target=reg;
    }
    if(target&&typeof target.focus==='function')setTimeout(function(){try{target.focus();}catch(e){}},30);
  }
  function landingCloseAuth(){
    var screen=document.getElementById('auth-screen');
    if(!screen)return;
    screen.classList.remove('pl-auth-open');
    var card=document.getElementById('auth-card');
    if(card)card.setAttribute('aria-hidden','true');
    if(lastFocus&&typeof lastFocus.focus==='function'){try{lastFocus.focus();}catch(e){}}
    lastFocus=null;
  }
  function landingStart(ev){
    if(ev&&ev.preventDefault)ev.preventDefault();
    var em=document.getElementById('pl-land-email');
    landingOpenAuth('login',em?em.value.trim():'');
  }

  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var screen=document.getElementById('auth-screen');
    if(screen&&screen.classList.contains('pl-auth-open')&&screen.style.display!=='none')landingCloseAuth();
  });

  window.LANDING_STATS=LANDING_STATS;
  window.renderLandingStats=renderLandingStats;
  window.landingOpenAuth=landingOpenAuth;
  window.landingCloseAuth=landingCloseAuth;
  window.landingStart=landingStart;
  renderLandingStats();
})();
