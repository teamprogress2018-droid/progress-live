// Testy pośrednika AI bez sieci: podpisane tokeny RS256, fałszywe JWKS, Firestore i Anthropic.
// Uruchom: node server/ai-proxy/test-worker.mjs
import assert from 'node:assert/strict';
import worker, { DAILY_LIMIT, PROJECT_ID, resetCaches } from './worker.mjs';

const ORIGIN = 'https://teamprogress2018-droid.github.io';
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'test-kid', alg: 'RS256', use: 'sig' };
const b64url = buf => Buffer.from(buf).toString('base64url');
async function idToken(uid, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iss: 'https://securetoken.google.com/' + PROJECT_ID, aud: PROJECT_ID,
    sub: uid, iat: now, exp: now + 3600, ...extra }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(h + '.' + p));
  return h + '.' + p + '.' + b64url(sig);
}

// Fałszywa sieć: JWKS, dokumenty trainerRoles/{uid}, Anthropic.
const roles = new Map();
let anthropicCalls = 0, roleCalls = 0, firestoreDown = false;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith('https://www.googleapis.com/service_accounts/')) {
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=3600' } });
  }
  if (url.startsWith('https://firestore.googleapis.com/')) {
    roleCalls++;
    if (firestoreDown) return new Response('{}', { status: 500 });
    const uid = decodeURIComponent(url.split('/trainerRoles/')[1]);
    const auth = new Headers(init.headers).get('Authorization') || '';
    // Model reguły: użytkownik może pobrać tylko własny dokument roli.
    const tokenSub = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url')).sub;
    if (tokenSub !== uid) return new Response('{}', { status: 403 });
    const role = roles.get(uid);
    if (!role) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ fields: {
      uid: { stringValue: role.uid }, role: { stringValue: role.role }, enabled: { booleanValue: role.enabled } } }));
  }
  if (url === 'https://api.anthropic.com/v1/messages') {
    anthropicCalls++;
    return new Response(JSON.stringify({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'ok' }], sent: JSON.parse(init.body) }));
  }
  throw new Error('unexpected fetch ' + url);
};
function kv() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); } };
}
async function call(token, env = { RATE: kv(), ANTHROPIC_API_KEY: 'k' }, body = { model: 'x', max_tokens: 99999, messages: [] }, origin = ORIGIN) {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await worker.fetch(new Request('https://proxy.test/', { method: 'POST', headers, body: JSON.stringify(body) }), env);
  return { status: res.status, body: await res.json().catch(() => null) };
}
let count = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('fresh self-registered account without a role gets 403 and never reaches Anthropic', async () => {
  const before = anthropicCalls;
  const r = await call(await idToken('fresh-user'));
  assert.equal(r.status, 403); assert.equal(r.body.error.type, 'forbidden'); count += 2;
  assert.equal(anthropicCalls, before, 'no Anthropic call'); count++;
});
test('disabled or mismatched role grant is not a trainer', async () => {
  roles.set('disabled-user', { uid: 'disabled-user', role: 'trainer', enabled: false });
  roles.set('mismatch-user', { uid: 'someone-else', role: 'trainer', enabled: true });
  roles.set('client-role', { uid: 'client-role', role: 'client', enabled: true });
  for (const uid of ['disabled-user', 'mismatch-user', 'client-role']) {
    assert.equal((await call(await idToken(uid))).status, 403, uid); count++;
  }
});
test('granted trainer is forwarded with capped tokens and allowed model', async () => {
  roles.set('trainer-1', { uid: 'trainer-1', role: 'trainer', enabled: true });
  const before = anthropicCalls;
  const r = await call(await idToken('trainer-1'));
  assert.equal(r.status, 200); assert.equal(anthropicCalls, before + 1); count += 2;
  assert.equal(r.body.sent.max_tokens, 8000); assert.equal(r.body.sent.model, 'claude-sonnet-5-5'); count += 2;
  const legacy = await call(await idToken('trainer-1'), undefined, { model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [] });
  assert.equal(legacy.status, 200); assert.equal(legacy.body.sent.model, 'claude-sonnet-5-5'); count += 2;
  assert.deepEqual(r.body.sent.thinking, { type: 'between_tools' }); count++;
  assert.equal(r.body.content[0].type, 'text'); assert.equal(r.body.content[0].text, 'ok'); assert.equal(r.body.content.length, 1); count += 3;
});
test('role check result is cached for repeated calls', async () => {
  resetCaches(); roles.set('trainer-c', { uid: 'trainer-c', role: 'trainer', enabled: true });
  const env = { RATE: kv(), ANTHROPIC_API_KEY: 'k' }, t = await idToken('trainer-c'), before = roleCalls;
  await call(t, env); await call(t, env); await call(t, env);
  assert.equal(roleCalls - before, 1); count++;
});
test('missing, forged or expired tokens get 401; foreign origin 403', async () => {
  assert.equal((await call(null)).status, 401); count++;
  const good = await idToken('trainer-1');
  const forged = good.split('.').slice(0, 2).join('.') + '.' + b64url(new Uint8Array(256));
  assert.equal((await call(forged)).status, 401); count++;
  assert.equal((await call(await idToken('trainer-1', { exp: Math.floor(Date.now() / 1000) - 10 }))).status, 401); count++;
  assert.equal((await call(await idToken('trainer-1', { aud: 'other-project' }))).status, 401); count++;
  assert.equal((await call(good, undefined, undefined, 'https://evil.example')).status, 403); count++;
});
test('daily limit of 400 requests per trainer is enforced (429) and counted per account', async () => {
  roles.set('trainer-r', { uid: 'trainer-r', role: 'trainer', enabled: true });
  roles.set('trainer-s', { uid: 'trainer-s', role: 'trainer', enabled: true });
  const env = { RATE: kv(), ANTHROPIC_API_KEY: 'k' };
  const key = 'trainer-r:' + new Date().toISOString().slice(0, 10);
  env.RATE.m.set(key, String(DAILY_LIMIT - 1));
  assert.equal((await call(await idToken('trainer-r'), env)).status, 200, 'request #400 passes'); count++;
  assert.equal(env.RATE.m.get(key), String(DAILY_LIMIT)); count++;
  const before = anthropicCalls;
  const r = await call(await idToken('trainer-r'), env);
  assert.equal(r.status, 429); assert.equal(r.body.error.type, 'rate_limit'); count += 2;
  assert.equal(anthropicCalls, before, 'limited request never reaches Anthropic'); count++;
  assert.equal((await call(await idToken('trainer-s'), env)).status, 200, 'other trainer keeps its own quota'); count++;
});
test('without the RATE store the worker refuses instead of running unlimited (503)', async () => {
  const before = anthropicCalls;
  const r = await call(await idToken('trainer-1'), { ANTHROPIC_API_KEY: 'k' });
  assert.equal(r.status, 503); assert.equal(r.body.error.type, 'config'); count += 2;
  assert.equal(anthropicCalls, before); count++;
});
test('role check failure fails closed (503), not open', async () => {
  resetCaches(); firestoreDown = true;
  const r = await call(await idToken('trainer-1'));
  firestoreDown = false;
  assert.equal(r.status, 503); assert.equal(r.body.error.type, 'role_check'); count += 2;
});

let failed = 0;
for (const { name, fn } of tests) {
  try { await fn(); console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); }
}
console.log(count + ' AI proxy assertions across ' + tests.length + ' scenarios; failures: ' + failed);
if (failed) process.exitCode = 1;
