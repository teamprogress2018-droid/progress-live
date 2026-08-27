#!/usr/bin/env python3
"""Sprawdza duplikaty funkcji/id/zmiennych. Kończy się kodem błędu (1) jeśli coś znajdzie - dzięki temu GitHub Actions oznaczy commit jako niepoprawny."""
import re, glob, sys, os

def report(title, items_dict, empty_msg):
    print(f"=== {title} ===")
    dupes = {k: v for k, v in items_dict.items() if len(v) > 1}
    print(f"Przeskanowano {len(items_dict)} unikalnych nazw.")
    if not dupes:
        print(f"[OK] {empty_msg}\n")
        return 0
    print(f"[BLAD] Znaleziono {len(dupes)} duplikatow:")
    for name, locs in sorted(dupes.items()):
        print(f"  {name}:")
        for loc in locs:
            print(f"    - {loc[0]}:{loc[1]}")
    print()
    return len(dupes)

files = sorted(f for f in glob.glob('*.js') if re.match(r'^\d{2}-.+\.js$', os.path.basename(f)))
if not files:
    print("Nie znaleziono plikow 00-99-*.js")
    sys.exit(1)

total_problems = 0

func_pattern = re.compile(r'^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', re.M)
funcs = {}
for fname in files:
    content = open(fname, encoding='utf-8').read()
    for m in func_pattern.finditer(content):
        name = m.group(1)
        line_no = content[:m.start()].count('\n') + 1
        funcs.setdefault(name, []).append((fname, line_no))
total_problems += report("FUNKCJE (NN-*.js)", funcs, "Zero powielonych funkcji.")

if os.path.exists('index.html'):
    html = open('index.html', encoding='utf-8').read()
    ids = {}
    for m in re.finditer(r'\bid="([^"]+)"', html):
        name = m.group(1)
        line_no = html[:m.start()].count('\n') + 1
        ids.setdefault(name, []).append(line_no)
    ids_formatted = {k: [('index.html', l) for l in v] for k, v in ids.items()}
    total_problems += report("ID (index.html)", ids_formatted, "Zero powielonych id.")

var_pattern = re.compile(r'^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=', re.M)
vars_ = {}
for fname in files:
    content = open(fname, encoding='utf-8').read()
    for m in var_pattern.finditer(content):
        name = m.group(1)
        line_no = content[:m.start()].count('\n') + 1
        vars_.setdefault(name, []).append((fname, line_no))
total_problems += report("ZMIENNE const/let (NN-*.js)", vars_, "Zero powielonych zmiennych.")

print("=" * 50)
if total_problems == 0:
    print("WSZYSTKO CZYSTE.")
    sys.exit(0)
else:
    print(f"Lacznie {total_problems} kategorii z duplikatami.")
    sys.exit(1)
