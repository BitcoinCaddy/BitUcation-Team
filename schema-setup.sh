#!/usr/bin/env bash
# ============================================================
# BitUcation Orga · PocketBase einrichten
#
# Voraussetzung: PocketBase läuft, ein Admin-Konto ist angelegt.
#   ./pocketbase serve --http 127.0.0.1:8090
#
# Aufruf:
#   PB_URL=https://sync.bitucation.com \
#   PB_ADMIN=admin@bitucation.com \
#   PB_PW='dein-admin-passwort' \
#   bash schema-setup.sh
# ============================================================
set -euo pipefail

PB_URL="${PB_URL:?PB_URL fehlt}"
PB_ADMIN="${PB_ADMIN:?PB_ADMIN fehlt}"
PB_PW="${PB_PW:?PB_PW fehlt}"
START_PW="${START_PW:-BitU-Start2026}"

say(){ printf '\n\033[1m%s\033[0m\n' "$1"; }

say "Anmelden"
TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$PB_ADMIN\",\"password\":\"$PB_PW\"}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
[ -n "$TOKEN" ] || { echo "Anmeldung fehlgeschlagen"; exit 1; }

say "Collection 'records' anlegen"
# Wichtig ab PocketBase 0.23: created und updated werden NICHT mehr automatisch
# angelegt. Ohne die beiden autodate-Felder schlaegt jeder inkrementelle Abruf
# der App mit HTTP 400 fehl (sort=updated und filter=updated>...).
# Regeln: nur angemeldete Konten dürfen lesen und schreiben.
# Wer feiner abstufen will, ergänzt hier z.B.
#   listRule: @request.auth.rolle != "guest" || rtype != "note"
curl -s -X POST "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d '{
  "name": "records",
  "type": "base",
  "listRule":   "@request.auth.id != \"\"",
  "viewRule":   "@request.auth.id != \"\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\"",
  "fields": [
    {"name":"cid",    "type":"text","required":true},
    {"name":"rtype",  "type":"text","required":true},
    {"name":"owner",  "type":"text"},
    {"name":"payload","type":"json","required":true},
    {"name":"deleted","type":"bool"},
    {"name":"created","type":"autodate","onCreate":true,"onUpdate":false},
    {"name":"updated","type":"autodate","onCreate":true,"onUpdate":true}
  ],
  "indexes": ["CREATE UNIQUE INDEX idx_records_cid ON records (cid)"]
}' > /dev/null && echo "  angelegt (oder existierte bereits)"

say "Konten anlegen"
# Die Anmeldenamen müssen zur Umwandlung in js/sync.js passen:
# Kleinbuchstaben, Umlaute ausgeschrieben, dann @bitucation.local
for NAME in caddy bianca markus gast; do
  curl -s -X POST "$PB_URL/api/collections/users/records" \
    -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$NAME@bitucation.local\",\"password\":\"$START_PW\",\"passwordConfirm\":\"$START_PW\",\"verified\":true,\"name\":\"$NAME\"}" \
    > /dev/null && echo "  $NAME"
done

say "Fertig"
cat <<TXT
Serveradresse für die App: $PB_URL
Startpasswort für alle:    $START_PW

Wichtig: Jeder ändert sein Passwort sofort selbst. Solange das Startpasswort
gilt, kommt jeder hinein, der es kennt.
TXT
