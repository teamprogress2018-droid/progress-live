#!/usr/bin/env node
'use strict';
// Service worker: Cache.addAll() nie może dostać tego samego adresu dwa razy
// („./favicon.svg” z APP_SHELL i „favicon.svg” z index.html) — inaczej instalacja PWA się wywraca.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL', n, x || ''); failed++; } else console.log('OK  ', n); };

const scope = 'https://teamprogress2018-droid.github.io/progress-live/';
let added = null;
const listeners = {};
const sandbox = {
  URL, Set, Promise, console,
  self: { registration: { scope }, location: { origin: 'https://teamprogress2018-droid.github.io' },
    addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting() {}, clients: { claim() {} } },
  caches: { open: async () => ({ addAll: async list => {
    // Zachowanie przeglądarki: duplikat adresu = InvalidStateError i odrzucenie całej listy.
    const seen = new Set();
    for (const u of list) { const k = new URL(u, scope).href; if (seen.has(k)) throw new Error('InvalidStateError duplicate ' + k); seen.add(k); }
    added = list;
  } }), keys: async () => [] },
  fetch: async () => ({ text: async () => html + '\n<link rel="icon" href="favicon.svg"><link href="./theme.css#x" rel="stylesheet">' }),
};
sandbox.addEventListener = sandbox.self.addEventListener;
vm.runInNewContext(sw, sandbox);

(async () => {
  let error = null;
  try { await sandbox.cacheAppShell(); } catch (e) { error = e; }
  ok('install caches the shell without duplicate-request error', !error && Array.isArray(added), error && error.message);
  ok('every cached URL is absolute and unique', added && added.every(u => u.startsWith(scope)) && new Set(added).size === added.length);
  ok('favicon cached once', added && added.filter(u => /favicon\.svg$/.test(u)).length === 1);
  ok('theme.css cached once (fragment dropped)', added && added.filter(u => u === scope + 'theme.css').length === 1);
  ok('versioned scripts from index.html are cached', added && added.some(u => /01-core\.js\?v=\d+/.test(u)));
  ok('helper normalizes before Set', /function uniqueShellUrls\(refs,scope\)/.test(sw) && sw.includes('new URL(ref,scope)'));
  ok('cache name bumped', /progress-live-shell-v(\d+)/.test(sw) && +sw.match(/progress-live-shell-v(\d+)/)[1] >= 67);
  if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
  console.log('\nAll service worker cache checks passed');
})();
