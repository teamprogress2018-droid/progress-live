#!/usr/bin/env python3
"""
Fix script for Progress Live beta v4.html
Fixes 13 bugs found during code review.

Usage:
    python3 fix_progress_live.py input.html > output.html
    python3 fix_progress_live.py input.html -o output.html

Bugs fixed:
    1.  mp-select-workout-btn -> mp-select-btn (wrong ID in Master Planner)
    2.  mp-tab-ai/create -> mp-tab-ai-btn/mp-tab-create-btn (wrong IDs in mpFindTab)
    3.  mp-client-name/meta -> mp-client-name-bar/mp-client-meta-bar (wrong IDs)
    4a. apl-days template literal -> static HTML buttons
    4b. apl-duration template literal -> static HTML buttons
    4c. apl-weeks template literal -> static HTML buttons
    4d. live rest timer template literal -> static HTML buttons
    4e. live feedback template literal -> static HTML buttons
    5.  SVG var(--accent/blue) -> hex values in bizRevenueChart
    6.  pay-chart-svg null guard
    7.  Duplicate id on live-history-tab div
    8.  mpNavPrev/Next/Today/PickDay missing functions
    9.  renderMasterPlanner alias missing
    10. initCalcClients null guard
    11. mp-client-avatar -> mp-client-avatar-bar (consistent with other bar IDs)
"""

import sys
import re
import argparse

def fix(content):
    log = []

    def replace(old, new, name, count=None):
        nonlocal content
        n = content.count(old)
        if n == 0:
            log.append(f"  SKIP {name} (pattern not found)")
            return
        if count and n != count:
            log.append(f"  WARN {name}: expected {count} occurrences, found {n}")
        content = content.replace(old, new)
        log.append(f"  OK   {name} ({n}x)")

    # ── 1. mp-select-workout-btn ──────────────────────────────────
    replace(
        "document.getElementById('mp-select-workout-btn')",
        "document.getElementById('mp-select-btn')",
        "FIX 1: mp-select-workout-btn -> mp-select-btn"
    )

    # ── 2. mpFindTab tab IDs ──────────────────────────────────────
    replace(
        "  const aiBtn = document.getElementById('mp-tab-ai');\n  const createBtn = document.getElementById('mp-tab-create');",
        "  const aiBtn = document.getElementById('mp-tab-ai-btn');\n  const createBtn = document.getElementById('mp-tab-create-btn');",
        "FIX 2: mpFindTab tab button IDs"
    )

    # ── 3. mpRenderClientHeader IDs ──────────────────────────────
    replace(
        "document.getElementById('mp-client-name');",
        "document.getElementById('mp-client-name-bar');",
        "FIX 3a: mp-client-name -> mp-client-name-bar"
    )
    replace(
        "document.getElementById('mp-client-meta');",
        "document.getElementById('mp-client-meta-bar');",
        "FIX 3b: mp-client-meta -> mp-client-meta-bar"
    )
    # Also fix the av line if it uses the non-bar version
    replace(
        "document.getElementById('mp-client-avatar');",
        "document.getElementById('mp-client-avatar-bar');",
        "FIX 3c: mp-client-avatar -> mp-client-avatar-bar"
    )

    # ── 4a. apl-days static HTML ─────────────────────────────────
    replace(
        "${[2,3,4,5,6].map(d=>`<button class=\"apl-opt${d===4?' active':''}\" data-val=\"${d}\" onclick=\"aplToggleOpt(this,'apl-days')\" style=\"flex:1;\">${d}\u00d7</button>`).join('')}",
        "<button class=\"apl-opt\" data-val=\"2\" onclick=\"aplToggleOpt(this,'apl-days')\" style=\"flex:1;\">2\u00d7</button>\n          <button class=\"apl-opt\" data-val=\"3\" onclick=\"aplToggleOpt(this,'apl-days')\" style=\"flex:1;\">3\u00d7</button>\n          <button class=\"apl-opt active\" data-val=\"4\" onclick=\"aplToggleOpt(this,'apl-days')\" style=\"flex:1;\">4\u00d7</button>\n          <button class=\"apl-opt\" data-val=\"5\" onclick=\"aplToggleOpt(this,'apl-days')\" style=\"flex:1;\">5\u00d7</button>\n          <button class=\"apl-opt\" data-val=\"6\" onclick=\"aplToggleOpt(this,'apl-days')\" style=\"flex:1;\">6\u00d7</button>",
        "FIX 4a: apl-days static buttons"
    )

    # ── 4b. apl-duration static HTML ─────────────────────────────
    replace(
        "${[45,60,75,90].map(d=>`<button class=\"apl-opt${d===60?' active':''}\" data-val=\"${d}\" onclick=\"aplToggleOpt(this,'apl-duration')\" style=\"flex:1;\">${d}'</button>`).join('')}",
        "<button class=\"apl-opt\" data-val=\"45\" onclick=\"aplToggleOpt(this,'apl-duration')\" style=\"flex:1;\">45'</button>\n          <button class=\"apl-opt active\" data-val=\"60\" onclick=\"aplToggleOpt(this,'apl-duration')\" style=\"flex:1;\">60'</button>\n          <button class=\"apl-opt\" data-val=\"75\" onclick=\"aplToggleOpt(this,'apl-duration')\" style=\"flex:1;\">75'</button>\n          <button class=\"apl-opt\" data-val=\"90\" onclick=\"aplToggleOpt(this,'apl-duration')\" style=\"flex:1;\">90'</button>",
        "FIX 4b: apl-duration static buttons"
    )

    # ── 4c. apl-weeks static HTML ────────────────────────────────
    replace(
        "${[4,6,8,12].map(w=>`<button class=\"apl-opt${w===8?' active':''}\" data-val=\"${w}\" onclick=\"aplToggleOpt(this,'apl-weeks')\" style=\"flex:1;\">${w} tyg.</button>`).join('')}",
        "<button class=\"apl-opt\" data-val=\"4\" onclick=\"aplToggleOpt(this,'apl-weeks')\" style=\"flex:1;\">4 tyg.</button>\n          <button class=\"apl-opt\" data-val=\"6\" onclick=\"aplToggleOpt(this,'apl-weeks')\" style=\"flex:1;\">6 tyg.</button>\n          <button class=\"apl-opt active\" data-val=\"8\" onclick=\"aplToggleOpt(this,'apl-weeks')\" style=\"flex:1;\">8 tyg.</button>\n          <button class=\"apl-opt\" data-val=\"12\" onclick=\"aplToggleOpt(this,'apl-weeks')\" style=\"flex:1;\">12 tyg.</button>",
        "FIX 4c: apl-weeks static buttons"
    )

    # ── 4d. live rest timer static HTML ──────────────────────────
    old_rest = '          ${[60,90,120,180].map(s=>`<button onclick="liveStartRest(${s})" style="flex:1;padding:5px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;font-size:10px;font-family:\'DM Mono\',monospace;color:var(--muted);cursor:pointer;">${s}s</button>`).join(\'\')'
    new_rest = """          <button onclick="liveStartRest(60)" style="flex:1;padding:5px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);cursor:pointer;">60s</button>
          <button onclick="liveStartRest(90)" style="flex:1;padding:5px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);cursor:pointer;">90s</button>
          <button onclick="liveStartRest(120)" style="flex:1;padding:5px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);cursor:pointer;">120s</button>
          <button onclick="liveStartRest(180)" style="flex:1;padding:5px;background:var(--s3);border:1px solid var(--border2);border-radius:6px;font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);cursor:pointer;">180s</button>"""
    replace(old_rest, new_rest, "FIX 4d: live rest timer static buttons")

    # ── 4e. live feedback static HTML ────────────────────────────
    old_fb = '          ${[\'😓\',\'😐\',\'🙂\',\'💪\',\'🔥\'].map((e,i)=>`<button onclick="liveFeedback(${i+1})" style="width:40px;height:40px;border-radius:10px;background:var(--s3);border:1px solid var(--border2);font-size:20px;cursor:pointer;" title="Poziom ${i+1}">${e}</button>`).join(\'\')'
    new_fb = """          <button onclick="liveFeedback(1)" style="width:40px;height:40px;border-radius:10px;background:var(--s3);border:1px solid var(--border2);font-size:20px;cursor:pointer;" title="Poziom 1">😓</button>
          <button onclick="liveFeedback(2)" style="width:40px;height:40px;border-radius:10px;background:var(--s3);border:1px solid var(--border2);font-size:20px;cursor:pointer;" title="Poziom 2">😐</button>
          <button onclick="liveFeedback(3)" style="width:40px;height:40px;border-radius:10px;background:var(--s3);border:1px solid var(--border2);font-size:20px;cursor:pointer;" title="Poziom 3">🙂</button>
          <button onclick="liveFeedback(4)" style="width:40px;height:40px;border-radius:10px;background:var(--s3);border:1px solid var(--border2);font-size:20px;cursor:pointer;" title="Poziom 4">💪</button>
          <button onclick="liveFeedback(5)" style="width:40px;height:40px;border-radius:10px;background:var(--s3);border:1px solid var(--border2);font-size:20px;cursor:pointer;" title="Poziom 5">🔥</button>"""
    replace(old_fb, new_fb, "FIX 4e: live feedback static buttons")

    # ── 5. SVG var() -> hex in bizRevenueChart ───────────────────
    replace(
        'stop-color="var(--accent)" stop-opacity=".25"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>',
        'stop-color="#c8f135" stop-opacity=".25"/><stop offset="100%" stop-color="#c8f135" stop-opacity="0"/>',
        "FIX 5a: SVG gradient accent -> #c8f135"
    )
    replace(
        'stop-color="var(--blue)" stop-opacity=".15"/><stop offset="100%" stop-color="var(--blue)" stop-opacity="0"/>',
        'stop-color="#4d9fff" stop-opacity=".15"/><stop offset="100%" stop-color="#4d9fff" stop-opacity="0"/>',
        "FIX 5b: SVG gradient blue -> #4d9fff"
    )
    replace(
        'stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>',
        'stroke="#c8f135" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>',
        "FIX 5c: SVG polyline stroke accent -> #c8f135"
    )
    replace(
        'stroke="var(--blue)" stroke-width="2" stroke-dasharray="5,4" stroke-linejoin="round" stroke-linecap="round"/>',
        'stroke="#4d9fff" stroke-width="2" stroke-dasharray="5,4" stroke-linejoin="round" stroke-linecap="round"/>',
        "FIX 5d: SVG polyline stroke blue -> #4d9fff"
    )

    # ── 6. pay-chart-svg null guard ──────────────────────────────
    old6 = "  const el=document.getElementById('pay-chart-svg');\n  if(!el)return;"
    if old6 not in content:
        replace(
            "  const el=document.getElementById('pay-chart-svg');",
            "  const el=document.getElementById('pay-chart-svg');\n  if(!el)return;",
            "FIX 6: pay-chart-svg null guard"
        )

    # ── 7. Duplicate id on live-history-tab ──────────────────────
    replace(
        '''<div id="live-history-tab" style="flex:1;overflow-y:auto;padding:20px 24px;display:none;" id="live-history-content">''',
        '''<div id="live-history-tab" style="flex:1;overflow-y:auto;padding:20px 24px;display:none;">''',
        "FIX 7: remove duplicate id on live-history-tab"
    )

    # ── 8. mpNavPrev/Next/Today/PickDay missing ───────────────────
    if "function mpNavPrev(" not in content:
        nav_fns = """
function mpNavPrev(){
  var step=mpView==='week'?7:1;
  mpCurrentWeekStart=new Date(mpCurrentWeekStart);
  mpCurrentWeekStart.setDate(mpCurrentWeekStart.getDate()-step);
  mpRender();
}
function mpNavNext(){
  var step=mpView==='week'?7:1;
  mpCurrentWeekStart=new Date(mpCurrentWeekStart);
  mpCurrentWeekStart.setDate(mpCurrentWeekStart.getDate()+step);
  mpRender();
}
function mpNavToday(){
  mpCurrentWeekStart=mpGetMonday(new Date());
  mpRender();
}
function mpPickDay(){
  var d=prompt('Wpisz datę (YYYY-MM-DD):',new Date().toISOString().split('T')[0]);
  if(d){mpCurrentWeekStart=mpGetMonday(new Date(d+'T12:00:00'));mpRender();}
}
window.mpNavPrev=mpNavPrev;
window.mpNavNext=mpNavNext;
window.mpNavToday=mpNavToday;
window.mpPickDay=mpPickDay;
"""
        replace(
            "window.mpRender = mpRender;",
            nav_fns + "window.mpRender = mpRender;",
            "FIX 8: mpNavPrev/Next/Today/PickDay added"
        )

    # ── 9. renderMasterPlanner alias ─────────────────────────────
    if "function renderMasterPlanner" not in content:
        alias = """
function renderMasterPlanner(){
  if(!mpCurrentWeekStart)mpCurrentWeekStart=mpGetMonday(new Date());
  mpRender();
}
window.renderMasterPlanner=renderMasterPlanner;
"""
        replace(
            "window.mpRender = mpRender;",
            "window.mpRender = mpRender;\n" + alias,
            "FIX 9: renderMasterPlanner alias added"
        )

    # ── 10. initCalcClients null guard ───────────────────────────
    if "function initCalcClients(){\n  const sel=document.getElementById('calc-client');\n  if(!sel)return;" not in content:
        replace(
            "function initCalcClients(){\n  const sel=document.getElementById('calc-client');",
            "function initCalcClients(){\n  const sel=document.getElementById('calc-client');\n  if(!sel)return;",
            "FIX 10: initCalcClients null guard"
        )

    return content, log


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fix Progress Live HTML bugs')
    parser.add_argument('input', help='Input HTML file')
    parser.add_argument('-o', '--output', help='Output file (default: stdout)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Show fix log')
    args = parser.parse_args()

    with open(args.input, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Input: {len(content):,} bytes", file=sys.stderr)
    fixed, log = fix(content)
    print(f"Output: {len(fixed):,} bytes", file=sys.stderr)

    applied = sum(1 for l in log if l.strip().startswith('OK'))
    skipped = sum(1 for l in log if l.strip().startswith('SKIP'))
    warned  = sum(1 for l in log if l.strip().startswith('WARN'))

    print(f"Fixes: {applied} applied, {skipped} skipped, {warned} warnings", file=sys.stderr)
    if args.verbose or warned:
        for l in log:
            print(l, file=sys.stderr)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f"Saved to: {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(fixed)
