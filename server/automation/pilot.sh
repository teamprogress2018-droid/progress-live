#!/usr/bin/env bash
# Uruchomienie produkcyjne krok po kroku — wyłącznie w Google Cloud Shell właściciela projektu
# (zalogowanego na jego konto). Każdy krok jest osobny i wymaga świadomego wywołania.
# Żaden klucz prywatny nie jest wypisywany na ekran ani zapisywany w repozytorium.
#   bash server/automation/pilot.sh check        — kopia i porównanie reguł (nic nie zmienia)
#   bash server/automation/pilot.sh rules        — publikacja firestore.rules, indeksów i storage.rules
#   bash server/automation/pilot.sh vapid        — klucze Web Push (tylko jeśli sekretu jeszcze nie ma)
#   bash server/automation/pilot.sh push         — wdrożenie funkcji commsScheduler (bez WhatsApp)
#   bash server/automation/pilot.sh enable UID   — włączenie wiadomości dla trenera w trybie SYMULACJI
#   bash server/automation/pilot.sh live UID     — przełączenie trenera na prawdziwą wysyłkę push
#   bash server/automation/pilot.sh status UID   — stan serwera (commsStatus) bez treści
set -euo pipefail
P=progress-live-fc83d
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
token() { gcloud auth print-access-token; }
api() { curl -sS -H "Authorization: Bearer $(token)" -H "Content-Type: application/json" "$@"; }
FS="https://firestore.googleapis.com/v1/projects/$P/databases/(default)/documents"

case "${1:-}" in
check)
  out="$HOME/kopia-regul-$(date +%Y%m%d-%H%M)"; mkdir -p "$out"
  api "https://firebaserules.googleapis.com/v1/projects/$P/releases" > "$out/releases.json"
  python3 - "$out" <<'PY'
import json, sys, subprocess, urllib.request
out = sys.argv[1]
tok = subprocess.check_output(['gcloud', 'auth', 'print-access-token']).decode().strip()
rel = json.load(open(out + '/releases.json')).get('releases', [])
for r in rel:
    name, rs = r['name'], r['rulesetName']
    req = urllib.request.Request('https://firebaserules.googleapis.com/v1/' + rs, headers={'Authorization': 'Bearer ' + tok})
    src = json.load(urllib.request.urlopen(req))['source']['files'][0]['content']
    kind = 'storage' if 'firebase.storage' in name else 'firestore' if 'cloud.firestore' in name else 'inne'
    open(f'{out}/{kind}.rules', 'w').write(src)
    print(f'{kind:9} {name.split("/releases/")[1]}  aktualizacja: {r.get("updateTime", "?")}  linii: {src.count(chr(10)) + 1}')
PY
  for k in firestore storage; do
    if [ -f "$out/$k.rules" ]; then
      if diff -q "$out/$k.rules" "$k.rules" >/dev/null; then echo "$k: OPUBLIKOWANE = repozytorium";
      else echo "$k: RÓŻNICE względem repozytorium (linie +repo / -produkcja):"; diff "$out/$k.rules" "$k.rules" | grep -E '^[<>]' | sed 's/^</-/;s/^>/+/' | head -40; fi
    else echo "$k: brak opublikowanych reguł"; fi
  done
  echo "Kopia obecnych reguł: $out"
  echo "Firebase CLI: $(firebase --version 2>/dev/null || echo brak)"; firebase projects:list 2>&1 | grep -c "$P" | sed 's/^/projekt widoczny dla CLI: /'
  ;;
rules)
  firebase deploy --project "$P" --only firestore:rules,firestore:indexes,storage --non-interactive
  ;;
vapid)
  if firebase functions:secrets:get VAPID_PRIVATE_KEY --project "$P" >/dev/null 2>&1; then
    echo "Sekret VAPID_PRIVATE_KEY już istnieje — nie generuję nowych kluczy (stare subskrypcje przestałyby działać)."
    [ -f server/automation/.env.$P ] && grep VAPID_PUBLIC_KEY server/automation/.env.$P || echo "Uwaga: brak pliku z kluczem publicznym w repozytorium."
    exit 0
  fi
  tmp="$(mktemp -d)"; chmod 700 "$tmp"
  ( cd "$tmp" && npm init -y >/dev/null && npm install --silent web-push@3.6.7 >/dev/null )
  node -e "const w=require('$tmp/node_modules/web-push');const k=w.generateVAPIDKeys();require('fs').writeFileSync('$tmp/priv',k.privateKey,{mode:0o600});require('fs').writeFileSync('$tmp/pub',k.publicKey);"
  firebase functions:secrets:set VAPID_PRIVATE_KEY --project "$P" --data-file "$tmp/priv" --force >/dev/null
  pub="$(cat "$tmp/pub")"; shred -u "$tmp/priv" 2>/dev/null || rm -f "$tmp/priv"; rm -rf "$tmp"
  echo "VAPID_PUBLIC_KEY=$pub" > server/automation/.env.$P
  echo "Sekret prywatny zapisany w Secret Manager (nie wyświetlam go)."
  echo "KLUCZ PUBLICZNY (jawny, do aplikacji): $pub"
  ;;
push)
  grep -q '^VAPID_PUBLIC_KEY=.\+' server/automation/.env.$P || { echo "Brak klucza publicznego w server/automation/.env.$P"; exit 1; }
  node server/automation/prepare-deploy.cjs
  npm install --prefix server/automation/.runtime --silent --no-audit --no-fund
  ( cd server/automation && firebase deploy --project "$P" --config firebase.json --only functions:autoflow-pending:commsScheduler --non-interactive )
  ;;
enable|live)
  uid="${2:?Podaj UID trenera}"
  role="$(api "$FS/trainerRoles/$uid" | python3 -c 'import json,sys;d=json.load(sys.stdin).get("fields",{});print(d.get("role",{}).get("stringValue",""),d.get("enabled",{}).get("booleanValue",""))')"
  [ "$role" = "trainer True" ] || { echo "UID nie ma aktywnej roli trenera ($role) — przerwano."; exit 1; }
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cur="$(api "$FS/serverAutomation/private/trainers/$uid" | python3 -c 'import json,sys;d=json.load(sys.stdin);c=d.get("fields",{}).get("comms",{}).get("mapValue",{}).get("fields",{});print(c.get("enabledAt",{}).get("stringValue",""))')"
  at="${cur:-$now}"; live=false; [ "$1" = live ] && live=true
  body=$(python3 -c "import json;print(json.dumps({'fields':{'comms':{'mapValue':{'fields':{'enabled':{'booleanValue':True},'enabledAt':{'stringValue':'$at'},'live':{'booleanValue':$([ $live = true ] && echo True || echo False)},'channels':{'arrayValue':{'values':[{'stringValue':'push'}]}}}}}}}))")
  api -X PATCH "$FS/serverAutomation/private/trainers/$uid?updateMask.fieldPaths=comms" -d "$body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("zapisano:",json.dumps({k:v for k,v in d.get("fields",{}).get("comms",{}).get("mapValue",{}).get("fields",{}).items()}) if "fields" in d else d)'
  ;;
status)
  uid="${2:?Podaj UID trenera}"
  api "$FS/commsStatus/$uid" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(json.dumps(d.get("fields",d),indent=1)[:1500])'
  ;;
trainers)
  api "$FS/trainerRoles?pageSize=50" | python3 -c 'import json,sys;[print(x["name"].split("/")[-1],x["fields"].get("enabled",{}).get("booleanValue")) for x in json.load(sys.stdin).get("documents",[])]'
  ;;
*) sed -n 2,12p "$0" ;;
esac
