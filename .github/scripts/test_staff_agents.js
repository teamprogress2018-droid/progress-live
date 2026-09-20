#!/usr/bin/env node
'use strict';
/** Sztab ekspercki: routing słów kluczowych, tryby AI Coach, sekwencyjne wywołania. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 03 v37', html.includes('03-ai-plangen-bizstats-aicoach.js?v=39'));
ok('cache 06 v77', html.includes('06-inbox-exercises-ai-programs.js?v=82'));
ok('CI unit', wf.includes('test_staff_agents.js'));
ok('CI ui', wf.includes('test_staff_agents_ui.js'));
ok('sztab button', html.includes('id="aicm-sztab"') && html.includes('Sztab ekspercki'));
ok('dev button', html.includes('id="aicm-dev"') && html.includes('Dev aplikacji'));
ok('biomech button', html.includes('id="exd-ask-biomech"') && html.includes('Zapytaj Biomechanika'));
ok('no vercel proxy', !src03.includes('/api/agent') && !src06.includes('/api/agent'));
ok('uses existing worker', /anthropic-proxy\.teamprogress2018\.workers\.dev/.test(src03));
ok('sequential for-of', /for\s*\(\s*const agentId of (ids|agentIds)\s*\)/.test(src03));
ok('no Promise.all staff', !/Promise\.all\s*\(\s*agentIds/.test(src03));
ok('sztab mode in AIC_MODES', /sztab:\{[\s\S]*label:'🦴 Sztab ekspercki'/.test(src03));
ok('exercise uses biomech staff', /staffAgentsForAicMode[\s\S]*mode==='exercise'\) return \['biomechanika'\]/.test(src03));
ok('builder keeps NSCA fallback', /staffAgentsForBuilderQuery/.test(src06) && /NSCA: hipertrofia/.test(src06));
ok('askExAI uses biomech prompt', /STAFF_SYSTEM_PROMPTS\.biomechanika/.test(src06));

const start = src03.indexOf('const STAFF_AGENT_IDS=');
const end = src03.indexOf('window.callStaffAgentsSequentially=callStaffAgentsSequentially;');
ok('staff slice', start > 0 && end > start);
const slice = src03.slice(start, end + 'window.callStaffAgentsSequentially=callStaffAgentsSequentially;'.length);

const calls = [];
const documentStub = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const windowObj = { document: documentStub, W: 'https://anthropic-proxy.teamprogress2018.workers.dev/' };
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, isNaN, Infinity, undefined, Promise,
  async fetch(url, opts) {
    const body = JSON.parse(opts.body);
    calls.push({ url, system: body.system, messages: body.messages, max_tokens: body.max_tokens });
    const id = /\[BIOMECHANIKA\]/.test(body.system) ? 'BIO' : /\[DEV\]/.test(body.system) ? 'DEV' : /\[BIZNES/.test(body.system) ? 'BIZ' : 'UNK';
    return {
      json: async () => ({ content: [{ type: 'text', text: 'odp-' + id }] })
    };
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(slice, ctx);

const {
  routeStaffQuery,
  routeStaffFromContext,
  staffAgentsForAicMode,
  staffAgentsForBuilderQuery,
  callStaffAgentsSequentially,
  STAFF_AGENT_IDS
} = windowObj;

ok('ids order', STAFF_AGENT_IDS.join(',') === 'biomechanika,dev,biznes');
ok('no match → all three', routeStaffQuery('cześć, jak leci?').join(',') === 'biomechanika,dev,biznes');
ok('ból → biomech', routeStaffQuery('ból barku przy unoszeniu').join(',') === 'biomechanika');
ok('cennik → biznes', routeStaffQuery('jaki cennik pakietu').join(',') === 'biznes');
ok('bug → dev', routeStaffQuery('bug w aplikacji').join(',') === 'dev');
ok('multi order preserved', routeStaffQuery('ból i cennik').join(',') === 'biomechanika,biznes');
ok('context force', routeStaffFromContext('dev').join(',') === 'dev');
ok('mode sztab routes', staffAgentsForAicMode('sztab', 'ból kolana').join(',') === 'biomechanika');
ok('mode sztab all', staffAgentsForAicMode('sztab', 'hej').join(',') === 'biomechanika,dev,biznes');
ok('mode exercise forced', staffAgentsForAicMode('exercise', 'cennik').join(',') === 'biomechanika');
ok('mode business forced', staffAgentsForAicMode('business', 'ból').join(',') === 'biznes');
ok('mode dev forced', staffAgentsForAicMode('dev', 'cennik').join(',') === 'dev');
ok('coach stays single', staffAgentsForAicMode('coach', 'ból') === null);
ok('plan stays single', staffAgentsForAicMode('plan', 'aplikacja') === null);
ok('builder no match null', staffAgentsForBuilderQuery('ile serii na klatkę?') === null);
ok('builder match', staffAgentsForBuilderQuery('ból kolana').join(',') === 'biomechanika');

(async () => {
  calls.length = 0;
  const results = await callStaffAgentsSequentially(
    ['biomechanika', 'biznes'],
    'to samo pytanie',
    '\nextra-ctx',
    [{ role: 'user', content: 'to samo pytanie' }],
    null,
    800
  );
  ok('sequential count', results.length === 2 && calls.length === 2);
  ok('independent same question', calls.every(c => c.messages[0].content === 'to samo pytanie'));
  ok('prompts differ', /BIOMECHANIKA/.test(calls[0].system) && /BIZNES/.test(calls[1].system));
  ok('extra ctx appended', calls.every(c => /extra-ctx/.test(c.system)));
  ok('order biomech then biznes', results[0].agentId === 'biomechanika' && results[1].agentId === 'biznes');
  ok('replies parsed', results[0].text === 'odp-BIO' && results[1].text === 'odp-BIZ');
  ok('worker url', calls.every(c => c.url.includes('anthropic-proxy.teamprogress2018.workers.dev')));

  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll staff-agent tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
