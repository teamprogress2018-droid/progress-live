#!/usr/bin/env node
'use strict';
/** Baza wiedzy: zarządzanie wpisami i jawny podgląd kontekstu AI. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const kb = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.ok(html.includes('id="kb-search"') && html.includes('oninput="renderKB()"'), 'wyszukiwarka bazy');
assert.ok(html.includes('id="kb-result-count"'), 'licznik wyników');
assert.ok(html.includes('id="kb-ai-context-preview"'), 'podgląd kontekstu AI');
assert.ok(/function editKBEntry\s*\(/.test(kb) && kb.includes('openKbModal(k)'), 'edycja wpisu');
assert.ok(/function duplicateKBEntry\s*\(/.test(kb) && kb.includes("+' — kopia'"), 'kopiowanie wpisu');
assert.ok(kb.includes('k.id!==editingId') && kb.includes('Podobny wpis już istnieje'), 'blokada duplikatów');
assert.ok(kb.includes('[k.title,k.text,k.citation,k.sourceUrl,...tags]'), 'wyszukiwanie treści i źródeł');
assert.ok(core.includes('window._kbLastPlanningContext=used'), 'rejestr wpisów przekazanych do AI');
assert.ok(css.includes('.kb-card-actions') && css.includes('.kb-ai-context-preview'), 'style zarządzania bazą');

console.log('All KB management tests passed.');
