# Die Zentrale — Projekt-Kontext (KI-Handoff)

> **Stand:** v18 · Oktober 2026. Die App ist eine **reine Browser-PWA**.
> Es gibt keinen Server, keine API-Routen, kein Prisma/SQLite und keine Cloud.

## 1. Was ist die App?

Private Organisations-App für eine Person: **Termine, Finanzen, Aufgaben, Notizen**.
Dark-Only, mobile-first, installierbar als PWA. Ziel ist ein täglich genutzter
„Daily Driver" mit 5-Farben-Logik und einer lokalen deutschen Schnelleingabe.

**Zielgerät:** iPhone 15 Pro (393×852 pt), installiert vom Home-Screen. Desktop zeigt
dieselbe App zentriert: bis 640 px in einer 448-px-Spalte, darüber in einer 512-px-Spalte.

## 2. Nicht verhandelbare Prinzipien

1. **Dark-Only.** Kein Light-Mode. Basis `#0c0b09`, Karten `#171411`.
2. **Keine Demo-Daten.** Start leer mit Willkommens-Screen.
3. **iPhone zuerst, überall sauber.** Safe-Areas oben/unten, Touch-Ziele ≥ 44 pt,
   Inputs 16 px, `dvh`; getestet von 320 px bis Desktop und im Querformat.
4. **Farben tragen Bedeutung** (5-Farben-Logik).
5. **Erinnerungen nur visuell** — keine Push-Benachrichtigungen.
6. **Subtraktion vor Addition.**
7. **Lokal zuerst.** Keine Netzwerkabhängigkeit für Kernfunktionen.
8. **Daten gehören dem Nutzer.** Jederzeit JSON-Backup exportierbar.
9. **Bewegung trägt Bedeutung.** Kurze, federnde Übergänge zeigen Zustandsänderungen;
   `prefers-reduced-motion` schaltet alle Animationen ab. Keine blockierenden Effekte.

## 3. Architektur

```
Next.js 16 static export (out/)
  └─ React 19 Client-App
       └─ src/lib/zentrale/localdb.ts
            └─ IndexedDB "die-zentrale"
                 events | tasks | transactions | notes | settings
```

- `next.config.ts`: `output: 'export'`, `trailingSlash: true`, `images.unoptimized`.
- Build erzeugt statische Dateien in `out/`; Hosting z. B. Netlify.
- Kein `src/app/api`, kein `src/lib/db.ts`, kein `prisma/`.
- PWA: `public/sw.js` (Cache v10), `public/manifest.webmanifest`,
  `src/components/RegisterSW.tsx`.
- Akzentwahl: `localStorage` + Früh-Skript in `layout.tsx` (kein Cookie/Server).

## 4. Datei-Map

```
src/app/
  layout.tsx              statische HTML-Shell, PWA-Metadaten, Akzent-Früh-Skript
  page.tsx                State-Orchestrierung, Undo, Badge, Sheets/Views
  globals.css             Design-System, Akzente, Ambient, Animationen

src/components/zentrale/
  views/                  Heute, Termine, Finanzen, Aufgaben
  QuickAddSheet.tsx       4 Tabs + lokale Schnelleingabe + Mikrofon
  EditSheet.tsx           Bearbeiten / Duplizieren / Löschen
  SearchSheet.tsx         globale Suche
  SettingsSheet.tsx       JSON-Backup, CSV, Akzent, App-Info
  AnimatedAmount.tsx      großer Geldbetrag mit kurzem Count-up
  ParsedPreview.tsx       prüfbare Chips für die lokale Schnelleingabe
  ImportSheet.tsx         JSON-Backup importieren
  MonthCalendar.tsx       Monatsraster
  MoneyFlow.tsx           Monatskugel mit Kategorie-Blasen + Filter
  recovery.ts             automatische lokale Sicherung + Speicherstatus
  TrendChart.tsx          6-Monats-Verlauf
  rows.tsx                Zeilen + Wischgesten
  forms.tsx               4 Formulare
  bits.tsx                Chips, DoneToggle, EmptyHint, Segmented

src/lib/zentrale/
  localdb.ts              IndexedDB-Repository + lokale API-Fassade + CSV
  useZentrale.ts          Laden/Refresh + apiSend/apiSendJson
  useBackupStatus.ts      reaktiver Status der letzten Sicherung
  types.ts                Typen, Kategorien, Farben
  date.ts                 Datums-Helfer
  finance.ts              advanceDue, Prognose, Monatsäquivalente
  quickparse.ts           lokale deutsche Erkennung

public/
  manifest.webmanifest    PWA-Manifest + Shortcuts
  sw.js                   Service Worker (CACHE v18)
  icon-192/512, apple-touch-icon, logo.svg
```

## 5. Datenmodell (IndexedDB)

Stores mit `keyPath: 'id'`; `settings` mit `keyPath: 'key'`.

- **events:** `id`, `title`, `date` (ISO), `place`, `note`, `priority`, `recurring`
- **tasks:** `id`, `title`, `dueDate`, `priority`, `recurring`, `recurringAnchor`,
  `done`, `completedAt`, `createdAt`
- **transactions:** `id`, `title`, `amount`, `type`, `category`, `date`, `recurring`, `nextDue`
- **notes:** `id`, `title`, `content`, `pinned`, `updatedAt`
- **settings:** `budget_monthly` (String-Zahl)

IDs werden mit `crypto.randomUUID()` erzeugt. Alle Datumsfelder sind ISO-Strings.

## 6. Lokale API-Fassade

`localdb.ts` bildet die früheren HTTP-Endpunkte als lokale Funktionen nach. Die Aufrufstellen
in Komponenten verwenden weiterhin Pfade wie `/api/tasks/:id`; `localRequest()` routet sie
auf IndexedDB. Das erleichtert Vergleiche mit der alten Serverlogik.

Unterstützt:

| Pfad | Methoden |
|---|---|
| `/api/events`, `/api/events/:id` | GET/POST, PATCH/DELETE |
| `/api/tasks`, `/api/tasks/:id` | GET/POST, PATCH/DELETE |
| `/api/transactions`, `/api/transactions/:id` | GET/POST, PATCH/DELETE |
| `/api/transactions/:id/book` | POST |
| `/api/notes`, `/api/notes/:id` | GET/POST, PATCH/DELETE |
| `/api/budget` | GET/PUT |
| `/api/import` | POST |

CSV und JSON-Backup laufen direkt im Client (`buildTransactionsCsv`, `SettingsSheet`).

## 7. Kernlogik

### Wiederholungen
- `nextRecurringDate()` in `date.ts` ist monatsklemmend: 31.01. + 1 Monat = 28.02.
- Aufgaben speichern `recurringAnchor` (ursprünglicher Monatstag), damit Routinen nicht
  durch kurze Monate driften.
- Beim Abhaken wird die nächste zukünftige Ausgabe erzeugt; beim Rückgängigmachen wird
  genau diese erzeugte Ausgabe wieder entfernt.

### Fixposten
- `nextDue` ist die nächste Fälligkeit.
- `book` erzeugt eine Ist-Buchung mit heutigem Datum und rückt `nextDue` weiter.
- Rückgängig löscht die Ist-Buchung und setzt `nextDue` exakt zurück.
- Die lokale Schreibwarteschlange (`mutate`) serialisiert alle Mutationen; schnelle
  Doppel-Taps können keine doppelten Nachfolger/Buchungen erzeugen.

### Schnelleingabe

`parseQuickText` erkennt Typ, Datum, Uhrzeit, Betrag und Kategorie lokal. Die
`ParsedPreview` zeigt das Ergebnis vor dem Speichern als Chips; Änderungen im
Formular bleiben danach weiterhin möglich.

### Geldfluss

`MoneyFlow` fasst die gebuchten Buchungen des gewählten Monats je Kategorie
zusammen. Die Gesamtsumme steht in einer großen Monatskugel, die Kategorien
liegen gleichmäßig verteilt als kleinere Blasen darin; der Ring zeigt die
Anteile. Ein Umschalter wechselt zwischen Einnahmen und Ausgaben. Ein Tipp auf
Blase oder Legende setzt den Kategoriefilter, scrollt zu den Buchungen und lässt
sich dort wieder lösen. Geplante zukünftige Einmal-Buchungen zählen wie in den
Summen erst nach dem Buchen.
- `quickparse.ts` erkennt deutsche Beträge, Einnahmen, relative Daten, Wochentage,
  Wiederholungen und Kategorien — vollständig offline.
- Es gibt keinen KI-Fallback und keinen Server mehr. Wenn die lokale Erkennung scheitert,
  bleibt das Formular leer und der Nutzer füllt es direkt aus.

### 5-Farben-Logik
`urgent` rot = überfällig/heute/HIGH · `soon` = bald (< 3 Tage/MEDIUM) ·
`planned` = geplant/LOW · `static` = erledigt/ruhend · `positive` = Einnahmen/alles erledigt.

## 7a. Datensicherheit

- Der JSON-Export markiert den Zeitpunkt in `localStorage` (`zentrale-last-backup-at`).
- `HeuteView` zeigt einen Hinweis, solange es Daten gibt und entweder noch nie oder
  vor mindestens 14 Tagen gesichert wurde. Der Button öffnet direkt die Einstellungen.
- `SettingsSheet` zeigt Datenbestand und letzte Sicherung und aktualisiert sich nach dem
  Export über `useBackupStatus`.
- Das Backup selbst enthält nur die Daten; der Sicherungszeitpunkt ist gerätebezogen.

## 8. QA

Nach Änderungen:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Danach die vier Views, Quick-Add inklusive Vorschau-Chips, Geldfluss-Blasen inkl.
Kategoriefilter und Sprung zu den Buchungen, Abhaken (inkl. Nachfolger und Routine-Toast),
Fixposten buchen/rückgängig, Budget, Suche, Backup-Export/-Import und die Backup-Erinnerung
im Browser prüfen.
Responsive mindestens bei 320×568, 393×852, 430×932, 768×1024, 844×390 und
1280×800 prüfen; auf horizontales Scrollen und Safe-Areas achten.
Testdaten vor der Abgabe über Einstellungen oder Browser-Speicher löschen.

**Wichtig:** Bei Shell-/Asset-Änderungen `CACHE` in `public/sw.js` bumpen, sonst sehen
installierte Geräte die alte Version. Motion-Check: Bereichswechsel, Nav-Pille und
animierte Beträge mit emulate `prefers-reduced-motion: reduce` prüfen.

## 9. Deployment

Netlify (kostenlos, HTTPS, PWA-fähig):

- Build: `npm run build`
- Publish: `out`
- Konfiguration: `netlify.toml`
- Nach dem Deploy am Handy öffnen und zum Home-Screen hinzufügen.

## 10. Grenzen und bewusste Entscheidungen

- **Nur ein Gerät.** Kein Sync, kein Multi-User, kein Account.
- **Kein Server.** Dadurch keine Netzwerkfehler, aber auch keine geräteübergreifenden Daten.
- **Backups sind Pflicht.** Browserdaten löschen oder iOS-Speicherbereinigung können Daten
  entfernen; JSON-Backup über Einstellungen ist die Sicherung.
- **Kein Push.** Erinnerungen bleiben visuell.
- **Kein KI-Parsing.** Die lokale Erkennung deckt den Alltag ab und bleibt offline.
