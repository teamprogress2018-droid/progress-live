# Proxy AI (Cloudflare Worker) — zabezpieczenie

Aplikacja woła Claude przez `https://anthropic-proxy.teamprogress2018.workers.dev/`.
Od tej wersji każde zapytanie z aplikacji ma nagłówek `Authorization: Bearer <token Firebase>`
(`installAiProxyAuth` w `01-core.js`). Worker poniżej:

- przepuszcza tylko zalogowanych użytkowników projektu `progress-live-fc83d` (weryfikacja podpisu tokenu),
- przyjmuje zapytania tylko z adresu aplikacji (CORS),
- pozwala tylko na wybrane modele i ogranicza `max_tokens`,
- (opcjonalnie) liczy dzienny limit zapytań na użytkownika w KV.

## Kolejność wdrożenia — WAŻNE

1. **Najpierw** wdroż ten Worker (zezwala na nagłówek `Authorization`).
   Przez pierwsze dni ustaw `REQUIRE_AUTH = false` — Worker przyjmie też stare zapytania bez tokenu.
2. Opublikuj nową wersję aplikacji (GitHub Pages).
3. Po 1–2 dniach (gdy wszyscy mają nową wersję) ustaw `REQUIRE_AUTH = true`.

Odwrotna kolejność zablokuje AI w aplikacji (przeglądarka odrzuci nagłówek, którego Worker nie zna).

Dodatkowo w Anthropic Console → Settings → Limits ustaw miesięczny limit wydatków.

## Kod Workera

Zmienne środowiskowe (Settings → Variables): `ANTHROPIC_API_KEY` (secret).
Opcjonalnie powiąż KV namespace jako `RATE` dla limitu dziennego.

```js
const PROJECT_ID = 'progress-live-fc83d';
const ALLOWED_ORIGINS = ['https://teamprogress2018-droid.github.io'];
const ALLOWED_MODELS = ['claude-sonnet-4-20250514'];
const MAX_TOKENS_CAP = 8000;
const DAILY_LIMIT = 400;          // zapytań na użytkownika na dobę (wymaga KV „RATE”)
const REQUIRE_AUTH = false;       // po wdrożeniu nowej wersji aplikacji zmień na true

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache = { keys: null, exp: 0 };

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function getKeys() {
  if (jwksCache.keys && Date.now() < jwksCache.exp) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  const data = await r.json();
  const maxAge = Number((r.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys: data.keys, exp: Date.now() + maxAge * 1000 };
  return data.keys;
}
async function verifyFirebaseToken(token) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('bad token');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256') throw new Error('alg');
  if (payload.aud !== PROJECT_ID || payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID) throw new Error('aud/iss');
  if (!payload.sub || payload.exp < now || payload.iat > now + 300) throw new Error('exp');
  const jwk = (await getKeys()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('sig');
  return payload.sub;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'method' }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin' }, 403, origin);

    let uid = null;
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) {
      try { uid = await verifyFirebaseToken(auth.slice(7)); }
      catch (e) { return json({ error: { type: 'auth', message: 'Sesja wygasła — zaloguj się ponownie.' } }, 401, origin); }
    } else if (REQUIRE_AUTH) {
      return json({ error: { type: 'auth', message: 'Zaloguj się, aby korzystać z AI.' } }, 401, origin);
    }

    if (uid && env.RATE) {
      const key = uid + ':' + new Date().toISOString().slice(0, 10);
      const n = Number(await env.RATE.get(key) || 0);
      if (n >= DAILY_LIMIT) return json({ error: { type: 'rate_limit', message: 'Dzienny limit AI wyczerpany.' } }, 429, origin);
      await env.RATE.put(key, String(n + 1), { expirationTtl: 172800 });
    }

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'json' }, 400, origin); }
    if (!ALLOWED_MODELS.includes(body.model)) body.model = ALLOWED_MODELS[0];
    body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS_CAP);
    delete body.stream;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
  },
};
```

Jeśli obecny Worker robi coś więcej (np. inne ścieżki, logowanie), przenieś tylko części:
CORS z `Authorization`, `verifyFirebaseToken`, listę modeli i limit `max_tokens`.
