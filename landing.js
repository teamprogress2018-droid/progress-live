/* Strona startowa przed zalogowaniem: ruchome zdjęcia + okno logowania/zaproszenia. */
(function(){
  'use strict';
  var LANDING_PHOTOS=[
    [{f:'hero',t:'Twoi klienci, Twoja marka'},{f:'clients',t:'Trening z klientem'},{f:'live',t:'Trening LIVE'},{f:'stats',t:'Postępy i wykresy'}],
    [{f:'plans',t:'Plany treningowe'},{f:'calendar',t:'Kalendarz i check-iny'},{f:'academy',t:'Progress Academy'},{f:'finance',t:'Pakiety i płatności'}]
  ];

  function landingPhotoHTML(p,copy){
    return '<figure class="pl-land-photo"'+(copy?' aria-hidden="true"':'')+'>'+
      '<img src="assets/brand/landing/'+p.f+'.jpg" alt="" width="420" height="560" decoding="async"'+(copy?' loading="lazy"':'')+'>'+
      '<figcaption>'+p.t+'</figcaption></figure>';
  }
  // Każda ścieżka ma zdjęcia dwa razy: animacja przesuwa o połowę, więc pętla nie ma szwu.
  function renderLandingPhotos(){
    var tracks=document.querySelectorAll('#auth-screen .pl-land-track');
    for(var i=0;i<tracks.length&&i<LANDING_PHOTOS.length;i++){
      var set=LANDING_PHOTOS[i];
      tracks[i].innerHTML=set.map(function(p){return landingPhotoHTML(p,false);}).join('')+
        set.map(function(p){return landingPhotoHTML(p,true);}).join('');
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

  window.LANDING_PHOTOS=LANDING_PHOTOS;
  window.renderLandingPhotos=renderLandingPhotos;
  window.landingOpenAuth=landingOpenAuth;
  window.landingCloseAuth=landingCloseAuth;
  window.landingStart=landingStart;
  renderLandingPhotos();
})();
