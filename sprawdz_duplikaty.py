#!/usr/bin/env python3
"""
Sprawdza Progress Live pod kątem trzech najczęstszych przyczyn "dziwnych błędów":
1. Ta sama funkcja zdefiniowana dwa razy w różnych plikach (druga cicho nadpisuje pierwszą)
2. Ten sam id="..." użyty dwa razy w HTML (getElementById znajdzie tylko pierwszy)
3. Ta sama zmienna const/let zadeklarowana dwa razy (SyntaxError przy wczytaniu strony)

UŻYCIE:
  1. Wrzuć ten plik do tego samego folderu co index.html i pliki 0*.js
  2. Zainstaluj Python (jeśli nie masz): https://www.python.org/downloads/
  3. Otwórz terminal/wiersz poleceń w tym folderze
  4. Uruchom: python sprawdz_duplikaty.py
"""
import re, glob, sys, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def report(title, items_dict, empty_msg, format_loc):
    print(f"=== {title} ===")
    dupes = {k: v for k, v in items_dict.items() if len(v) > 1}
    print(f"Przeskanowano {len(items_dict)} unikalnych nazw.")
    if not dupes:
        print(f"✅ {empty_msg}\n")
        return 0
    print(f"⚠️  Znaleziono {len(dupes)} duplikatów:")
    for name, locs in sorted(dupes.items()):
        print(f"  {name}:")
        for loc in locs:
            print(f"    - {format_loc(loc)}")
    print()
    return len(dupes)

files = sorted(glob.glob('0*.js'))
if not files:
    print("❌ Nie znaleziono plików 0*.js w tym folderze. Uruchom skrypt w folderze z index.html.")
    sys.exit(1)

total_problems = 0

# 1. Duplikaty funkcji
func_pattern = re.compile(r'^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', re.M)
funcs = {}
for fname in files:
    content = open(fname, encoding='utf-8').read()
    for m in func_pattern.finditer(content):
        name = m.group(1)
        line_no = content[:m.start()].count('\n') + 1
        funcs.setdefault(name, []).append((fname, line_no))
total_problems += report(
    "FUNKCJE (0*.js)", funcs, "ZERO powielonych funkcji.",
    lambda loc: f"{loc[0]}:{loc[1]}"
)

# 2. Duplikaty id w index.html
if os.path.exists('index.html'):
    html = open('index.html', encoding='utf-8').read()
    ids = {}
    for m in re.finditer(r'\bid="([^"]+)"', html):
        name = m.group(1)
        line_no = html[:m.start()].count('\n') + 1
        ids.setdefault(name, []).append(line_no)
    ids_formatted = {k: [('index.html', l) for l in v] for k, v in ids.items()}
    total_problems += report(
        "ID (index.html)", ids_formatted, "ZERO powielonych id.",
        lambda loc: f"{loc[0]}:{loc[1]}"
    )

# 3. Duplikaty zmiennych top-level
var_pattern = re.compile(r'^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=', re.M)
vars_ = {}
for fname in files:
    content = open(fname, encoding='utf-8').read()
    for m in var_pattern.finditer(content):
        name = m.group(1)
        line_no = content[:m.start()].count('\n') + 1
        vars_.setdefault(name, []).append((fname, line_no))
total_problems += report(
    "ZMIENNE const/let (0*.js)", vars_, "ZERO powielonych zmiennych.",
    lambda loc: f"{loc[0]}:{loc[1]}"
)

print("=" * 50)
if total_problems == 0:
    print("✅ WSZYSTKO CZYSTE — brak duplikatów.")
else:
    print(f"⚠️  Łącznie {total_problems} kategorii z duplikatami do sprawdzenia powyżej.")
