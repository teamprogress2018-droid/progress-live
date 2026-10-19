// UI: tryb Amator prowadzi przez ankietę, zapisuje kwalifikację i uruchamia plan startowy.
'use strict';
const { chromium } = require('playwright');

let failed = 0;
function ok(name, condition, extra) {
  if (condition) console.log('OK  ', name);
  else { console.error('FAIL', name + (extra ? ' — ' + extra : '')); failed++; }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    window.notify = m => { window.__amateurNotice = String(m); };
    ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    if (typeof goTo === 'function') goTo('aiplangen');
    window.__amateurGenerated = false;
    window.aplGenerate = () => { window.__amateurGenerated = true; };
    aplAmateurOpen();
    const mount=document.getElementById('apl-amateur-mount');
    const equipment=[...document.querySelectorAll('#apl-am-equipment input')];
    equipment.forEach(input => { input.checked=false; });
    const equipmentError=aplAmateurStepErrors(aplAmateurRead(),1)[0]||'';
    document.querySelector('#apl-am-equipment input[value="Hantle"]').checked=true;
    document.getElementById('apl-am-pain').value='yes';
    const painError=aplAmateurStepErrors(aplAmateurRead(),2)[0]||'';
    document.getElementById('apl-am-pain-details').value='Kolano przy głębokim przysiadzie';
    document.getElementById('apl-am-consent').checked=true;
    aplAmateurPrepare();
    const blocked={generated:window.__amateurGenerated,intake:window._aplAmateurIntake||null,feedback:(document.getElementById('apl-amateur-feedback')||{}).textContent||''};
    document.getElementById('apl-am-pain').value='no';
    aplAmateurPrepare();
    return {mountVisible:!!mount&&!mount.hidden,equipmentError,painError,blocked,prepared:{generated:window.__amateurGenerated,intake:window._aplAmateurIntake||null}};
  });
  ok('renders the Amateur form', result.mountVisible, JSON.stringify(result));
  ok('requires equipment before next step', /co najmniej jeden rodzaj/.test(result.equipmentError), result.equipmentError);
  ok('requires pain details for trainer review', /Opisz, co boli/.test(result.painError), result.painError);
  ok('health flag blocks automatic generation', result.blocked.generated === false && result.blocked.intake === null && /Wymagana weryfikacja człowieka/.test(result.blocked.feedback), JSON.stringify(result.blocked));
  ok('clear intake starts generator', result.prepared.generated === true, JSON.stringify(result.prepared));
  ok('intake stores conservative starter prescription', result.prepared.intake && result.prepared.intake.prescription.method === 'FBW' && result.prepared.intake.prescription.days === '2' && result.prepared.intake.answers.equipment.includes('Hantle'), JSON.stringify(result.prepared.intake));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll amateur-mode UI tests passed');
})().catch(err => { console.error(err); process.exit(1); });
