#!/usr/bin/env node
'use strict';
/* Contract checks for client self-workout persistence and the scoped UI. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const portal=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');

function ok(label,value){assert.equal(value,true,label);console.log('OK  '+label);}

ok('uses one stable client-session ID',/sessionId:newId\('s'\)/.test(app)&&/id:cw\.sessionId/.test(app));
ok('stores plan snapshot at workout start',/planSnapshot:cwPlanSnapshot\(exercises\)/.test(app)&&/planSnapshot:\{planId:cw\.planId/.test(app));
ok('counts only confirmed sets in the record',/filter\(s=>s&&s\.done\)/.test(app)&&/confirmed:true/.test(app));
ok('persists each confirmed or reverted set',/st\.done=!st\.done;\s*cwQueuePersist\(cw,'in_progress'\)/.test(app));
ok('persists locally before an offline attempt',/cw\.syncState='local';cwWriteLocal\(cw\)/.test(app));
ok('flushes local work after reconnect or app reopen',/function cwFlushLocal\(\)/.test(app)&&/setTimeout\(\(\)=>cwFlushLocal\(\),0\)/.test(app));
ok('partial completion asks before ending',/cw\.finishPrompt=true/.test(app)&&/Zakończ częściowo wykonany/.test(app));
ok('supports a pain report without automated treatment',/function cwReportProblem\(\)/.test(app)&&/Zgłoś ból lub problem/.test(app));
ok('client replacements come only from the trainer plan',/const alts=String\(ex\.alt\|\|''\)/.test(core)&&/approvedAlts:alts\.slice\(\)/.test(core));
ok('trainer session panel shows plan and actual result',/Plan: \$\{planned\}/.test(fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8'))&&/Wynik: \$\{setsText/.test(fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8')));
ok('rules limit client session statuses and mutable fields',/\['in_progress', 'completed', 'partial'\]/.test(rules)&&/confirmedSets/.test(rules)&&/planSnapshot/.test(rules));
ok('today screen is deliberately compact',/function capClientTodaySimple\(c\)/.test(portal)&&/Wznów trening/.test(portal)&&/Najbliższe spotkanie/.test(portal));
console.log('\nAll client self-workout contract checks passed.');
