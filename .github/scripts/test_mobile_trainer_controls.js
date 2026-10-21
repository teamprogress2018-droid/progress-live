const fs=require('fs');
const core=fs.readFileSync('01-core.js','utf8');
const live=fs.readFileSync('02-workouts-onboarding-templates-live.js','utf8');
const clients=fs.readFileSync('05-clients-builder-plans-calendar.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const theme=fs.readFileSync('theme.css','utf8');
let failed=false;
function ok(name,pass){
  if(pass)console.log('✓ '+name);
  else{console.error('✗ '+name);failed=true;}
}
ok('mobile menu is bound as a real button action',core.includes('function bindMobileSidebarControls()')&&core.includes("button.addEventListener('click',toggleMobileSidebar)")&&html.includes('id="mobile-menu-btn" type="button" aria-label="Otwórz menu"'));
ok('mobile navigation closes safely and opens the LIVE workspace without reopening a selected client picker',core.includes('function openLiveFromMobile()')&&core.includes("&&!document.getElementById('live-client-sel')?.value")&&html.includes('onclick="openLiveFromMobile()"'));
ok('the compact client list keeps a visible reversible action',clients.includes('function toggleClientListCompact()')&&clients.includes("filtered.slice(0,3)")&&html.includes('id="client-list-toggle"'));
ok('the compact client list states how many people are hidden',clients.includes('Widoczne 3 z ${total}')&&clients.includes('widoczne 3 z ${total}')&&clients.includes("btn.setAttribute('aria-label',compact"));
ok('phone client lists default to a compact filter bar without removing access to filters',clients.includes('function clientFiltersDefaultVisible()')&&clients.includes("clientUiPref('pl_clients_filters','')")&&clients.includes("savedFilters===''?clientFiltersDefaultVisible():savedFilters!=='0'")&&clients.includes("Pokaż filtry listy klientów")&&theme.includes('#screen-clients .cl-filters-toggle { min-height: 44px'));
ok('the light surface uses a restrained cool background and separate white cards',theme.includes('--bg-main: #f4f7fb')&&theme.includes('background: linear-gradient(180deg, #e9f2ff'));
ok('phone header reserves separate space for navigation and LIVE',theme.includes('grid-template-columns: minmax(0, 1fr) auto')&&theme.includes('padding: max(8px, env(safe-area-inset-top)) 12px 8px 68px'));
ok('iPhone safe areas keep the trainer menu and LIVE header below the system status bar',theme.includes('body:not(.client-app-mode) #app-root { padding-top: env(safe-area-inset-top); }')&&theme.includes('#mobile-menu-btn { top: max(8px, env(safe-area-inset-top)); }'));
ok('the trainer canvas stays visibly cool behind white cards, including LIVE',theme.includes('html[data-theme="light"] .main { background: #edf3fb; }')&&theme.includes('#screen-live .live-floor'));
ok('LIVE keeps technique above the full-width series log on a phone',theme.includes('#screen-live .live-ex-body { display: flex; flex-direction: column')&&theme.includes('#screen-live .live-ex-log { flex: 1 1 100%; width: 100%; min-width: 0; }'));
ok('LIVE keeps the save action full width for the first active client on a phone',fs.readFileSync('styles.css','utf8').includes('#screen-live.live-session-on .live-slot-controls[data-live-slot="0"]{width:100%;}')&&fs.readFileSync('styles.css','utf8').includes('.live-session-btn{width:100%;min-height:48px;font-size:15px;}'));
ok('LIVE offers real recently active clients as a shortcut before searching',live.includes('function liveRecentClientChoices')&&live.includes('function liveQuickPickClient')&&live.includes("Ostatnio aktywni")&&theme.includes('.live-quick-client'));
ok('settings use one readable column on a phone',html.includes('class="settings-layout"')&&html.includes('class="settings-sidebar"')&&html.includes('class="settings-content"')&&fs.readFileSync('styles.css','utf8').includes('#screen-settings .settings-layout{display:block!important;overflow:auto!important;}'));
ok('calendar uses one full-width phone column',html.includes('class="cal-layout"')&&fs.readFileSync('styles.css','utf8').includes('#screen-calendar .cal-layout{display:block!important;overflow-y:auto!important;}'));
ok('weekly calendar preserves readable day columns on a phone',fs.readFileSync('styles.css','utf8').includes('#screen-calendar #cal-week-header,#screen-calendar #cal-week-scroll,#screen-calendar #cal-week-grid{width:720px!important;min-width:720px!important;}'));
ok('calendar shortens the weekly date range on a phone',clients.includes("matchMedia('(max-width:600px)').matches")&&clients.includes("ws.getDate()+'–'+we.getDate()"));
if(failed)process.exit(1);
