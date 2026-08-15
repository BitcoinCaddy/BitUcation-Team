# BitUcation Orga

Interne Planungs-App für das BitUcation Team. Aufgaben, Redaktionsplan, Kursproduktion,
Wissen und Gesellschafterbeschlüsse. Läuft als installierbare PWA, arbeitet offline und
gleicht optional über einen eigenen PocketBase Server ab.

## Aufbau

```
index.html              App-Hülle: Anmeldung, Ansicht, Tabbar
styles.css              Design System, hell und dunkel
js/store.js             IndexedDB, Record-Modell, Settings, Startbestand
js/sync.js              PocketBase Abgleich, Warteschlange, Live-Updates
js/ui.js                Icons, Datumsformate, Sheets, Formularfelder
js/views.js             Alle Ansichten und Bearbeiten-Masken
js/app.js               Router, Tabbar, Anmelde-Trommel, Ereignisse
sw.js                   Offline-Hülle
manifest.webmanifest    Installierbarkeit
server/schema-setup.sh  Richtet die Server-Collection und die Konten ein
```

Das Datenmodell ist bewusst generisch, alles ist ein Record:

```js
{ id, type, ownerId, createdAt, updatedAt, deleted, ...Nutzdaten }
```

`type` ist einer von `person`, `task`, `content`, `course`, `note`. Neue Bereiche brauchen
deshalb keine Änderung an Speicher oder Abgleich, nur eine neue Ansicht in `views.js`.

## Auf GitHub Pages bringen

1. Neues Repository anlegen, den kompletten Ordner hineinlegen.
2. Settings, Pages, Branch auf `main` und Ordner auf `/ (root)` stellen.
3. Aufrufen, auf dem Handy über das Teilen-Menü zum Startbildschirm hinzufügen.

Ohne Server läuft dann alles lokal auf dem jeweiligen Gerät. Das ist ein funktionierender
Zustand zum Ausprobieren, aber kein gemeinsamer Stand.

## Team-Sync einrichten

PocketBase ist eine einzelne Binärdatei mit SQLite, Anmeldung und Regelwerk. Ein kleiner
Server bei Hetzner für rund fünf Euro im Monat reicht für ein Team dieser Größe locker.

```bash
wget https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_linux_amd64.zip
unzip pocketbase_linux_amd64.zip
./pocketbase serve --http 127.0.0.1:8090
# davor ein Reverse Proxy mit TLS, z.B. Caddy
```

Danach einmalig:

```bash
PB_URL=https://sync.example.com PB_ADMIN=admin@example.com PB_PW='…' bash server/schema-setup.sh
```

In der App unter System die Serveradresse eintragen und anmelden. Ab dann gilt:
lokale Änderungen wandern in eine Warteschlange und werden gesendet, sobald Netz da ist.
Fremde Änderungen kommen live über SSE herein, zusätzlich wird alle 90 Sekunden abgeglichen.
Bei gleichzeitiger Bearbeitung gewinnt die letzte Schreiboperation.

### Getestet gegen PocketBase 0.23.4

Der Abgleich ist nicht nur geschrieben, sondern mit zwei und drei parallelen Clients gegen
einen laufenden Server durchgespielt worden: Anlegen, Ändern, Löschen, Offline-Warteschlange,
Nachholen nach Abwesenheit, Nachzügler-Gerät, gleichzeitige Änderung. Drei Dinge sind dabei
aufgefallen und behoben:

1. Ab PocketBase 0.23 werden `created` und `updated` **nicht mehr automatisch** angelegt.
   Ohne die beiden `autodate` Felder scheitert jeder inkrementelle Abruf mit HTTP 400, und
   ein Gerät holt verpasste Änderungen nie nach. Das Setup-Skript legt sie deshalb mit an.
2. Nach einem Funkloch blieb die Live-Leitung tot und der Status auf „getrennt“ stehen.
   Sie wird jetzt beim Zurückkommen neu aufgebaut.
3. Ein Gerät, das lange offline war, hätte beim Hochladen eine neuere Fassung überschreiben
   können. Vor jedem Hochladen wird jetzt geprüft, ob auf dem Server schon etwas Neueres liegt.

Der Startbestand hat feste IDs und einen festen alten Zeitstempel und wird nie hochgeladen.
Sonst hätte jedes Gerät die Demodaten erneut angelegt und das Team hätte alles doppelt.

## Was diese App bewusst nicht kann

- **Die Rollen in der Oberfläche sind keine Sicherheit.** Sie steuern, was angezeigt wird.
  Wer die Daten wirklich schützen will, muss die Regeln in PocketBase verschärfen, siehe
  Kommentar in `server/schema-setup.sh`. Solange dort nur „angemeldet“ steht, sieht jedes
  angemeldete Konto alles.
- **Ohne Server kein gemeinsamer Stand.** Drei Geräte sind dann drei getrennte Datenbestände.
- **Kein Rechteschutz gegen den Gerätebesitzer.** Alles liegt unverschlüsselt in der IndexedDB.
- **Letzte Schreiboperation gewinnt.** Wenn zwei gleichzeitig denselben Eintrag ändern,
  überschreibt der spätere Speichervorgang den früheren. Für ein Team dieser Größe ist das
  in Ordnung, für zehn Leute nicht mehr.

## Schriften

Die App lädt keine Schriften von fremden Servern, weil ein Aufruf an Google Fonts die IP der
Nutzer ohne Einwilligung in die USA überträgt. Es sind nur Font-Stacks gesetzt. Wer
Space Grotesk, Syne und Space Mono wirklich sehen will, legt die WOFF2 Dateien nach
`assets/fonts/` und ergänzt oben in `styles.css`:

```css
@font-face{font-family:'Space Grotesk';src:url('assets/fonts/space-grotesk.woff2') format('woff2');font-display:swap}
```

## Nach Änderungen

In `sw.js` die Zeile `const V = 'bitu-orga-v1'` hochzählen und die `?v=1` Parameter in
`index.html` mitziehen, sonst holen die Geräte die alte Fassung aus dem Cache.
