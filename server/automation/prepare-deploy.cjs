'use strict';
// Keep generated npm metadata/dependencies out of the static app repository.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '.runtime');
fs.mkdirSync(target, {recursive: true});
for (const file of ['worker.cjs', 'index.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(target, file));
// Firebase CLI confines emulator rule files to the config directory.
fs.copyFileSync(path.join(__dirname, '../../firestore.rules'), path.join(target, 'firestore.rules'));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
  name: 'progress-live-autoflow', private: true, main: 'index.cjs', engines: {node: '22'},
  dependencies: {'firebase-admin': '13.5.0', 'firebase-functions': '6.4.0'}
}, null, 2) + '\n');
console.log('Prepared isolated Firebase function source. No deployment performed.');
