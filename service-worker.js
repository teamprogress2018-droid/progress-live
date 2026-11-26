/* Progress Live — trwała powłoka aplikacji.
   Cache obejmuje wyłącznie pliki interfejsu z tej samej domeny. Dane klienta,
   logowanie i zapisy treningu pozostają w ich istniejących, bezpiecznych
   mechanizmach; aktywny trening dodatkowo zapisuje się lokalnie w aplikacji. */
// Wersja 64 naprawia sytuację, w której przeglądarka mieszała nowy index.html
// ze starszymi plikami JavaScript pozostawionymi w cache PWA.
// Wersja 67: adresy w cache sprowadzane do jednej postaci (bez duplikatów w addAll).
// Wersja 92: nawigacja zapisuje do cache tylko poprawne odpowiedzi (response.ok).
// Wersja 93: akcje delegowane (data-act) zamiast onclick z id z bazy.
// Wersja 94: szkic jadłospisu w dietDraft.
// Wersja 95: pola prywatne trenera nie trafiają do karty klienta.
// Wersja 96: historia ćwiczenia przewijana w bok.
// Wersja 99: powiadomienia push (spotkania, plan) i otwieranie właściwego ekranu po dotknięciu.
// Wersja 100: „Ściąganie wyciągu górnego …” z planu pokazuje film z biblioteki.
// Wersja 101: trening klienta — cel i poprzedni wynik razem, „Twój wynik”, przerwa ±15 s i pasek przerwy.
// Wersja 102: PDF planu — etykiety metod w komórkach tygodnia się zawijają.
// Wersja 103: mapa mięśni dla ćwiczeń bez filmu.
// Wersja 104: pusty rekord z importu nie zasłania filmu techniki; bez „Dodane podczas importu materiału.”
// Wersja 105: stan serwera wiadomości (działa / symulacja / wymaga konfiguracji), widoczny stan zapisu serii.
// Wersja 106: klucz publiczny Web Push — klient może włączyć powiadomienia z serwera.
// Wersja 107: kalendarz pokazuje imię i nazwisko klienta; szybkie dodanie klienta w oknie sesji.
// Wersja 108: telefon ze zgodą na powiadomienia zapisuje się do serwera sam przy otwarciu aplikacji.
// Wersja 109: trening klienta — ile serii zostało, odliczanie końca przerwy, rozgrzewka od trenera, podsumowanie i informacja dla trenera.
// Wersja 110: postęp w podsumowaniu treningu, pochwała od trenera, przyjazny powrót po opuszczonym treningu.
// Wersja 111: film techniki od klienta do trenera (prywatny plik, karta w czacie).
// Wersja 112: czat trenera odświeża się sam, rozgrzewka w oknie treningu, komunikaty „co dalej”.
// Wersja 113: powiadomienia dla trenera (link ?tchat= otwiera rozmowę z klientem).
const CACHE_NAME='progress-live-shell-v133';
const APP_SHELL=[
  './', './index.html', './globals.css', './styles.css', './research-academy.css',
  './theme.css', './manifest.json', './favicon.svg', './apple-touch-icon.png'
];

async function cacheAppShell(){
  const cache=await caches.open(CACHE_NAME);
  // Odczytujemy tylko publiczny dokument aplikacji i zapisujemy wymienione
  // w nim lokalne pliki interfejsu z ich aktualnymi wersjami ?v=….
  const page=await fetch('./index.html',{cache:'no-store'});
  const html=await page.text();
  const dynamicAssets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match=>match[1])
    .filter(ref=>!/^https?:|^data:|^#/.test(ref)&&/\.(?:js|css|json|png|svg)(?:[?#]|$)/i.test(ref))
    .map(ref=>new URL(ref,self.registration.scope).toString());
  await cache.addAll(uniqueShellUrls([...APP_SHELL,...dynamicAssets],self.registration.scope));
}

/* Cache.addAll() odrzuca całą listę, gdy ten sam adres występuje dwa razy
   („./favicon.svg” z APP_SHELL i „favicon.svg” z index.html). Przed Set
   sprowadzamy każdy wpis do pełnego adresu względem zakresu aplikacji, bez #… */
function uniqueShellUrls(refs,scope){
  return [...new Set(refs.map(ref=>{const url=new URL(ref,scope);url.hash='';return url.href;}))];
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheAppShell().then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key.startsWith('progress-live-shell-')&&key!==CACHE_NAME)
    .map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      // Strona błędu (404/500) nie może zastąpić aplikacji w pamięci offline.
      if(response.ok&&response.type==='basic'){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));
      }
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }

  // Interfejs aplikacji musi działać zawsze na zgodnym zestawie plików.
  // Pobieramy więc najpierw aktualną wersję z sieci, a cache zostaje wyłącznie
  // bezpiecznym planem awaryjnym, gdy urządzenie rzeczywiście jest offline.
  event.respondWith(fetch(request).then(response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
    }
    return response;
  }).catch(()=>caches.match(request)));
});

/* Powiadomienia push z serwera wiadomości (server/automation/comms-worker.cjs).
   Treść jest ogólna (bez zdrowia i pomiarów), bo bywa widoczna na zablokowanym ekranie. */
self.addEventListener('push',event=>{
  let d={};
  try{d=event.data?event.data.json():{};}catch(e){d={title:'Progress',body:event.data?event.data.text():''};}
  const title=String(d.title||'Progress').slice(0,80);
  const options={body:String(d.body||'').slice(0,240),tag:String(d.tag||'progress'),icon:'./apple-touch-icon.png',badge:'./apple-touch-icon.png',
    // Dozwolone tylko linki wewnątrz aplikacji: ?cs=… (klient) i ?tchat=<id klienta> (trener → rozmowa).
    data:{url:typeof d.url==='string'&&(/^\?cs=[a-z]+$/.test(d.url)||/^\?tchat=[A-Za-z0-9_.:@-]{1,200}$/.test(d.url))?'./'+d.url:'./'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
/* Dotknięcie powiadomienia: otwarta aplikacja przechodzi do sprawy, inaczej otwiera się nowe okno. */
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL((event.notification.data&&event.notification.data.url)||'./',self.registration.scope).href;
  event.waitUntil((async()=>{
    const all=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of all){
      if(c.url.startsWith(self.registration.scope)&&'focus' in c){
        try{await c.navigate(target);}catch(e){}
        return c.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
