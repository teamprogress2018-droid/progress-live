/* Progress Live — trwała powłoka aplikacji.
   Cache obejmuje wyłącznie pliki interfejsu z tej samej domeny. Dane klienta,
   logowanie i zapisy treningu pozostają w ich istniejących, bezpiecznych
   mechanizmach; aktywny trening dodatkowo zapisuje się lokalnie w aplikacji. */
const CACHE_NAME='progress-live-shell-v20';
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
  await cache.addAll([...new Set([...APP_SHELL,...dynamicAssets])]);
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
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
    }
    return response;
  })));
});
