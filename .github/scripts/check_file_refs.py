#!/usr/bin/env python3
"""Sprawdza czy kazdy plik wskazany w <script src="..."> i <link href="..."> w index.html
faktycznie istnieje w repo. To dokladnie ten blad, ktory zdarzyl sie wczesniej -
pliki JS wgrane luzem zamiast do podfolderu, ktorego oczekiwal index.html."""
import re, os, sys

html = open('index.html', encoding='utf-8').read()

local_refs = []
for m in re.finditer(r'<script[^>]+src="([^"]+)"', html):
    src = m.group(1).split('?')[0]
    if src.startswith('http'):
        continue
    local_refs.append(src)
for m in re.finditer(r'<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"', html):
    href = m.group(1).split('?')[0]
    if href.startswith('http'):
        continue
    local_refs.append(href)
for m in re.finditer(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', html):
    href = m.group(1).split('?')[0]
    if href.startswith('http'):
        continue
    local_refs.append(href)

missing = [r for r in local_refs if not os.path.exists(r)]

print(f"Sprawdzono {len(local_refs)} lokalnych odwolan do plikow w index.html.")
if missing:
    print(f"[BLAD] {len(missing)} plikow nie istnieje w repo:")
    for m in missing:
        print(f"  - {m}  (index.html odwoluje sie do tej sciezki, ale pliku tam nie ma)")
    sys.exit(1)
else:
    print("[OK] Wszystkie odwolania do plikow sa poprawne.")
    sys.exit(0)
