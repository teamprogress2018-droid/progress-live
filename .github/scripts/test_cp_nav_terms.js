#!/usr/bin/env node
'use strict';
/** Client profile navigation names and overflow destinations. */
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const src07=fs.readFileSync(path.join(root,'07-forms-metrics-calculator.js'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github','workflows','check.yml'),'utf8');
let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

const start=html.indexOf('<div class="cp-tabs-inner">');
const end=html.indexOf('<div class="cp-tabs-more-menu"',start);
const primary=html.slice(start,end);
const moreStart=html.indexOf('<div class="cp-tabs-more-menu"',end);
const more=html.slice(moreStart,html.indexOf('</nav>',moreStart));
const primaryTabs=[...primary.matchAll(/id="cpt-(overview|training|plan|progress|metrics)"[^>]*>([^<]+)/g)];
ok('five primary tabs use agreed names',primaryTabs.map(m=>m[2].trim()).join('|')==='Przegląd|Treningi|Plan|Postępy|Pomiary');
ok('history and document links are collapsed',/<details class="cp-tabs-more-group">[\s\S]*<summary>Historia i dokumenty<\/summary>[\s\S]*Historia aktywności[\s\S]*Lista dokumentów[\s\S]*<\/details>/.test(more));
ok('specialty evaluation label replaces analytics',/id="cpt-analytics"[^>]*>Oceny specjalistyczne/.test(more)&&/aria-label="Oceny specjalistyczne"/.test(src07));
ok('destructive actions are absent from overflow',!/(archiveClient|restoreClient|deleteClientPermanently)/.test(html.slice(html.indexOf('id="cp-hdr-more-menu"'),html.indexOf('<!-- glowny uklad')))&&!/(archiveClient|deleteClientPermanently)/.test(more));
const settings=src08.slice(src08.indexOf('function renderCPSettings'),src08.indexOf('function updateClientUnit'));
ok('settings retain archive, restore, and permanent delete',/archiveClient\('\$\{c\.id\}'\)/.test(settings)&&/restoreClient\('\$\{c\.id\}'\)/.test(settings)&&/deleteClientPermanently\('\$\{c\.id\}'\)/.test(settings));
const overview=src08.slice(src08.indexOf('function renderCPOverview'),src08.indexOf('function renderCPPlan'));
ok('overview measurement shortcut opens the edit/history screen',/id="cp-ov-card-metrics"[^>]*onclick="setCPTab\('metrics'\)"/.test(overview)&&/Pomiary →/.test(overview));
const progress=src08.slice(src08.indexOf('function renderCPProgress'),src08.indexOf('window.renderCPProgress'));
ok('postęp screen uses one empty-training message',/Brak zapisanych treningów/.test(progress)&&/data-cp-panel="train" class="stat-card cp-progress-empty"/.test(progress));
ok('plan realization shows no data without assignments',/adh30\.assigned\?`\$\{adh30\.pct\}%`:'Brak danych'/.test(progress)&&/Realizacja planu · 30 dni/.test(progress));
ok('timeline heading says Historia aktywności',/class="cp-section-title">Historia aktywności<\/div>/.test(src08));
ok('updated app script caches',/07-forms-metrics-calculator\.js\?v=43/.test(html)&&/08-client-profile-extras\.js\?v=87/.test(html));
ok('CI runs navigation regression test',wf.includes('test_cp_nav_terms.js'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll client-profile navigation tests passed');
