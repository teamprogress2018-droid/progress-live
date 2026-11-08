// Pośrednik AI (Cloudflare Worker) — źródło do wklejenia w Cloudflare → Workers → anthropic-proxy.
// Instrukcja wdrożenia: docs/ai-proxy-worker.md. Testy: node server/ai-proxy/test-worker.mjs
//
// Zasady (te same co trainer() w firestore.rules):
// - tylko zalogowani użytkownicy projektu progress-live-fc83d (podpis tokenu Firebase),
// - tylko konta z nadaną rolą trenera: dokument trainerRoles/{uid} {uid, role:'trainer', enabled:true};
//   samo założenie konta e-mailem NIE daje dostępu do AI (odpowiedź 403),
// - dzienny limit zapytań na konto w KV „RATE”; bez podpiętego RATE Worker odmawia (503),
//   żeby limit nie mógł „po cichu” przestać działać,
// - tylko adres aplikacji (CORS), dozwolone modele i limit max_tokens.
export const PROJECT_ID = 'progress-live-fc83d';
export const ALLOWED_ORIGINS = ['https://teamprogress2018-droid.github.io'];
export const ALLOWED_MODELS = ['claude-sonnet-4-20250514'];
export const MAX_TOKENS_CAP = 8000;
export const DAILY_LIMIT = 400;            // zapytań na konto trenera na dobę (UTC)
export const ROLE_CACHE_MS = 5 * 60 * 1000; // wynik sprawdzenia roli trzymany 5 min w pamięci Workera

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const FIRESTORE_DOC = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/';
let jwksCache = { keys: null, exp: 0 };
const roleCache = new Map();

export function resetCaches() { jwksCache = { keys: null, exp: 0 }; roleCache.clear(); }

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
export async function verifyFirebaseToken(token) {
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

/** Czyta trainerRoles/{uid} tokenem samego użytkownika (reguła pozwala tylko na własny dokument).
 *  Zwraca true/false; rzuca wyjątek, gdy Firestore jest nieosiągalny (Worker odmawia — fail closed). */
export async function hasTrainerRole(uid, idToken) {
  const cached = roleCache.get(uid);
  if (cached && Date.now() < cached.exp) return cached.ok;
  const r = await fetch(FIRESTORE_DOC + 'trainerRoles/' + encodeURIComponent(uid), {
    headers: { Authorization: 'Bearer ' + idToken },
  });
  let ok = false;
  if (r.status === 200) {
    const f = (await r.json()).fields || {};
    ok = f.uid?.stringValue === uid && f.role?.stringValue === 'trainer' && f.enabled?.booleanValue === true;
  } else if (r.status !== 404 && r.status !== 403) {
    throw new Error('role-check ' + r.status);
  }
  roleCache.set(uid, { ok, exp: Date.now() + ROLE_CACHE_MS });
  return ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'method' }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin' }, 403, origin);

    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return json({ error: { type: 'auth', message: 'Zaloguj się, aby korzystać z AI.' } }, 401, origin);
    }
    const idToken = auth.slice(7);
    let uid;
    try { uid = await verifyFirebaseToken(idToken); }
    catch (e) { return json({ error: { type: 'auth', message: 'Sesja wygasła — zaloguj się ponownie.' } }, 401, origin); }

    let trainer;
    try { trainer = await hasTrainerRole(uid, idToken); }
    catch (e) { return json({ error: { type: 'role_check', message: 'Nie udało się sprawdzić roli trenera. Spróbuj za chwilę.' } }, 503, origin); }
    if (!trainer) {
      return json({ error: { type: 'forbidden', message: 'To konto nie ma nadanej roli trenera — AI jest niedostępne.' } }, 403, origin);
    }

    if (!env || !env.RATE) {
      return json({ error: { type: 'config', message: 'Limit AI nie jest skonfigurowany (brak magazynu RATE w Workerze).' } }, 503, origin);
    }
    const key = uid + ':' + new Date().toISOString().slice(0, 10);
    const n = Number(await env.RATE.get(key) || 0);
    if (n >= DAILY_LIMIT) return json({ error: { type: 'rate_limit', message: 'Dzienny limit AI wyczerpany.' } }, 429, origin);
    await env.RATE.put(key, String(n + 1), { expirationTtl: 172800 });

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
