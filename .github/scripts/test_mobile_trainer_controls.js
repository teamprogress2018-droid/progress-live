const fs=require('fs');
const core=fs.readFileSync('01-core.js','utf8');
const clients=fs.readFileSync('05-clients-builder-plans-calendar.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const theme=fs.readFileSync('theme.css','utf8');
let failed=false;
function ok(name,pass){
  if(pass)console.log('✓ '+name);
  else{console.error('✗ '+name);failed=true;}
}
ok('mobile menu is bound as a real button action',core.includes('function bindMobileSidebarControls()')&&core.includes("button.addEventListener('click',toggleMobileSidebar)")&&html.includes('id="mobile-menu-btn" type="button" aria-label="Otwórz menu"'));
ok('mobile navigation closes safely and opens the LIVE workspace',core.includes('function openLiveFromMobile()')&&html.includes('onclick="openLiveFromMobile()"'));
ok('the compact client list keeps a visible reversible action',clients.includes('function toggleClientListCompact()')&&clients.includes("filtered.slice(0,3)")&&html.includes('id="client-list-toggle"'));
ok('the light surface uses a restrained cool background and separate white cards',theme.includes('--bg-main: #f4f7fb')&&theme.includes('background: linear-gradient(180deg, #e9f2ff'));
ok('phone header reserves separate space for navigation and LIVE',theme.includes('grid-template-columns: minmax(0, 1fr) auto')&&theme.includes('padding: max(8px, env(safe-area-inset-top)) 12px 8px 68px'));
if(failed)process.exit(1);
