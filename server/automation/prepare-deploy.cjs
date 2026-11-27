'use strict';
// Keep generated npm metadata/dependencies out of the static app repository.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '.runtime');
fs.mkdirSync(target, {recursive: true});
for (const file of ['worker.cjs', 'youtube-curation-core.cjs', 'youtube-curation.cjs', 'comms-worker.cjs', 'voice-names.cjs', 'index.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(target, file));
// Jawne parametry funkcji (np. publiczny klucz VAPID) — bez sekretów.
for (const envFile of fs.readdirSync(__dirname).filter(f => /^\.env(\.[\w-]+)?$/.test(f))) fs.copyFileSync(path.join(__dirname, envFile), path.join(target, envFile));
// Wspólna logika wiadomości (ta sama co w aplikacji).
fs.copyFileSync(path.join(__dirname, '../../comms-core.js'), path.join(target, 'comms-core.js'));
// Firebase CLI confines emulator rule files to the config directory.
fs.copyFileSync(path.join(__dirname, '../../firestore.rules'), path.join(target, 'firestore.rules'));
fs.copyFileSync(path.join(__dirname, '../../storage.rules'), path.join(target, 'storage.rules'));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
  name: 'progress-live-autoflow', private: true, main: 'index.cjs', engines: {node: '22'},
  dependencies: {'firebase-admin': '13.5.0', 'firebase-functions': '6.4.0', 'web-push': '3.6.7'}
}, null, 2) + '\n');
console.log('Prepared isolated Firebase function source. No deployment performed.');
