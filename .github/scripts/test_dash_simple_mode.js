#!/usr/bin/env node
'use strict';
/** Dashboard dla początkującego trenera: jeden następny krok + przełączany widok prosty. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.ok(html.includes('id="dash-next-action"'), 'sekcja następnego kroku');
assert.ok(html.includes('id="dash-simple-toggle"') && html.includes('toggleDashSimpleMode()'), 'przełącznik widoku');
assert.ok(html.includes('Najważniejsze działania trenera w jednym miejscu'), 'jasny opis ekranu');
assert.ok(/function dashNextAction\s*\(/.test(src) && /function renderDashNextAction\s*\(/.test(src), 'logika następnego kroku');
assert.ok(src.includes("localStorage.getItem('pl_dash_simple')") && src.includes("localStorage.setItem('pl_dash_simple'"), 'zapamiętanie widoku');
assert.ok(src.includes('renderDashNextAction();') && src.includes('applyDashSimpleMode();'), 'render dashboardu');
assert.ok(css.includes('#screen-dashboard.dash-simple .dash-kpi-secondary') && css.includes('.dash-next-action'), 'uproszczony układ');

console.log('All simple dashboard tests passed.');
