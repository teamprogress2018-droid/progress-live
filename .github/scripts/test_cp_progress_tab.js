// Progress tab: rekordy nie w Pomiary, są w Progress.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', '..', '08-client-profile-extras.js'), 'utf8');
const metricsFn = src.slice(src.indexOf('function renderCPMetrics'), src.indexOf('function setCPMetricGroup'));
const progressFn = src.slice(src.indexOf('function renderCPProgress'), src.indexOf('window.renderCPProgress'));

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); failed++; }
  else console.log('OK   ' + name);
}

ok('metrics has no training PRs block', !/Rekordy z treningów/.test(metricsFn));
ok('progress has training PRs', /Rekordy z treningów/.test(progressFn));
ok('progress has weekly tonnage', /Tonaż tygodniowy/.test(progressFn));
ok('progress has circumferences', /Obwody ciała/.test(progressFn));
ok('progress has no CTA strip', !/Podsumowanie<\/button>/.test(progressFn) && !/setCPTab\('photos'\)/.test(progressFn));
ok('progress uses svg charts', /cp-chart-svg|cpLineChartSVG|cpWeeklyDualChart/.test(progressFn));
ok('progress uses stat-card layout', /stat-card/.test(progressFn));
ok('progress analytics hub', /ANALITYKA KLIENTA/.test(progressFn) && /Adherencja 30 dni/.test(progressFn));
ok('index has progress tab', /cpt-progress/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')));
ok('setCPTab wires progress', /t==='progress'/.test(fs.readFileSync(path.join(__dirname, '..', '..', '07-forms-metrics-calculator.js'), 'utf8')));
ok('index slim header', /cp-hdr-actions/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')));
ok('podsumowanie in overflow', /openReportForClient\(cpClientId\)/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')));
ok('cache bump 08', /08-client-profile-extras\.js\?v=37/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')));

if (failed) process.exit(1);
console.log('\nAll cp-progress tests passed');
