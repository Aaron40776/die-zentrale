# Die Zentrale — Projekt-Kontext (KI-Handoff-Dokument)

> **Zweck dieses Dokuments:** Ein anderer KI-Assistent (oder Mensch) soll ohne Vorwissen den
> kompletten Stand der App verstehen und direkt weiterentwickeln können. Es beschreibt den Stand
> **v7** (Oktober 2026) — vollständig implementiert und browser-geprüft.
> Ergänzende Design-Quelle: `docs/Konzeptdokument.pdf`, Wireframe: `docs/mockup.png`.

---

## 0. KI-Onboarding — so arbeitest du an diesem Projekt weiter

1. **Lies dieses Dokument vollständig**, bevor du etwas änderst. Kritisch: §2 (Prinzipien),
   §8 (Kernlogik — hier liegen die leichtesten Fehlbau-Fallen) und §11 (bewusst
   abgelehnte Ideen — nicht erneut vorschlagen oder einbauen).
2. **Setup:** `bun install && bunx prisma generate && bun run dev` → http://localhost:3000.
   Der leere Willkommens-Screen ist der korrekte Startzustand, kein Bug.
3. **Ändern → prüfen:** Nach jeder Änderung QA nach §12 (Browser 393×852 UND 1280×800,
   alle berührten Flows durchklicken, danach DB wippen: `bun prisma/seed.ts`).
4. **Konventionen:** lint + `bunx tsc --noEmit` müssen 0 Fehler sein; bei sichtbaren
   Änderungen die Versionszeile im SettingsSheet hochzählen; bei Shell-Änderungen die
   CACHE-Konstante in `public/sw.js` bumpen (sonst sehen installierte Geräte nichts Neues).
5. **Kontext aktuell halten:** Widerspricht dieses Dokument dem Code, gewinnt der Code —
   und du aktualisierst AI_CONTEXT.md im selben Commit mit. Ein veraltetes Handoff-Dokument
   ist schlimmer als keins.

---

## 1. Was ist „Die Zentrale"?

Eine **private**, nicht-kommerzielle Organisations-App des Nutzers (nur eigener Gebrauch, kein
Login, keine Multi-User-Fähigkeit vorgesehen). Sie bündelt die vier Bereiche **Termine,
Finanzen, Aufgaben, Notizen** in einer einzigen Handy-App und entscheidet automatisch per
Farblogik, was gerade wichtig ist. Ziel ist ein echtes **täglich genutztes Werkzeug** („Daily
Driver"), kein Feature-Sammlung: Der Nutzer hat in mehreren Runden aktiv „subtrahiert" — alles,
was den Tagesloop nicht beschleunigt, wurde entfernt.

**Zielgerät: iPhone 15 Pro (393×852 pt)**, installiert als PWA auf dem Home-Screen. Desktop
(≥768 px) zeigt dieselbe App zentriert in einer 448-px-Spalte mit Ambient-Licht — muss nicht
optimiert werden, darf aber nicht kaputt sein.

## 2. Nicht verhandelbare Prinzipien

1. **Dark-Only.** Es gibt keinen hellen Modus. Basis-Schwarz `#0c0b09`, Karten `#171411`.
2. **Keine Demo-Daten.** Die App startet leer (Willkommens-Screen mit Direktaktionen). Alle
   Daten kommen vom Nutzer selbst. Vor jedem QA-Durchlauf: Testdaten einspielen, danach DB
   wieder wippen (`bun prisma/seed.ts`).
3. **iPhone 15 Pro zuerst.** Safe-Areas (Dynamic Island oben, Home-Indicator unten) respektiert
   via `viewport-fit=cover` + `env(safe-area-inset-*)`; Touch-Ziele ≥ 44 pt; Inputs 16 px
   (iOS zoomt sonst); `dvh` statt `vh`.
4. **Farben tragen Bedeutung** (5-Farben-Logik, siehe §8) — Deko-Farben sind verboten.
5. **Erinnerung nur visuell** (Chips, Badge, Farben) — keine Push-Benachrichtigungen.
6. **Subtraktion vor Addition.** Neue Features nur, wenn sie den täglichen Loop verkürzen.
   Bewusst verworfen: Offline-Sync, Kategorie-Budgets, Foto-Anhänge, Unternotizen, Push.

## 3. Tech-Stack

| Layer      | Technik |
|------------|---------|
| Framework  | Next.js 16 (App Router, React 19, TypeScript), Start via **Bun** |
| Styling    | Tailwind CSS 4 + shadcn/ui-Komponenten (`src/components/ui/`), `tw-animate-css` |
| Datenbank  | SQLite via Prisma 6 (`db/custom.db`, Schema in `prisma/schema.prisma`) |
| KI         | `z-ai-web-dev-sdk` **server-only** in `/api/parse` (Schnelleingabe-Parsing) |
| Toasts     | sonner |
| Sheets/Drawer | vaul |
| PWA        | `public/manifest.webmanifest`, handgeschriebener Service-Worker `public/sw.js`, `src/components/RegisterSW.tsx` |
| Sonstiges  | lucide-react (Icons), date-fns, recharts (nur TrendChart) |

## 4. Datei-Map (wer macht was)

```
src/
  app/
    layout.tsx            HTML-Shell: viewport-fit=cover, Früh-Skript (Akzent aus
                          localStorage VOR Paint), app-ambient-Div, metaTags (iOS-PWA)
    page.tsx              Zentrale State-Orchestrierung: lädt alle Daten, deleteWithUndo,
                          setAppBadge, ?quick=-Handler, render die 4 Views + alle Sheets
    globals.css           Design-System: Farb-Variablen, Akzentsystem, .card-gold,
                          .app-ambient, .hit-Utility, Animationen (rise, checkdraw)
    api/
      route.ts            GET /api  → Healthcheck
      events/…            CRUD Termine
      tasks/…             CRUD Aufgaben
      notes/…             CRUD Notizen
      transactions/…      CRUD Buchungen; PATCH {advance:true} = Fixposten weiterschieben
      parse/route.ts      POST KI-Schnelleingabe (Systemprompt + Normalisierung)
      budget/route.ts     GET/PUT Monatsbudget (Setting budget_monthly)
      import/route.ts     POST JSON-Backup einspielen
      export/csv/route.ts GET CSV aller Buchungen (Semikolon, BOM, deutsche Zahlen)
  components/
    zentrale/
      views/HeuteView.tsx     Hero-Karte (Begrüßung, Fortschrittsring, Chips), Tageslisten,
                              Finanz-Snapshot, Überfällig-Sektion
      views/TermineView.tsx   Monatskalender + Tagesfilter + Farb-Punkte + „Alle Termine"
      views/FinanzenView.tsx  Saldo-Karte (card-gold), Budget-Ampel, Prognose, Donut,
                              6-Monats-Trend, Monatsnav, Filter, Fixposten + „✓ Gebucht"
      views/AufgabenView.tsx  Segmented (Offen/Heute/Erledigte), Swipe-Hinweis, Snooze
      BottomNav.tsx           schwebende Glas-Leiste + Gold-FAB (Quick-Add)
      QuickAddSheet.tsx       4 Tabs + SmartBar (KI), Mikrofon-Button, Enter-Parsing
      EditSheet.tsx           Bearbeiten / Duplizieren / zweistufig Löschen
      SearchSheet.tsx         globale Suche über alle 4 Bereiche
      SettingsSheet.tsx       JSON-Export/-Import, CSV, Akzent-Swatches, Version
      ImportSheet.tsx         Backup-Einspielen (JSON)
      MonthCalendar.tsx       Monatsraster Mo–So, 6 Wochen, Farbpunkte, Heute-Ring
      DonutChart.tsx          Kategorie-Donut (Finanzen)
      TrendChart.tsx          6-Monats-Saldo-Verlauf
      rows.tsx                EventRow, TaskRow (in SwipeRow), NoteRow, TransactionRow,
                              SwipeRow (Wischgesten: rechts >64px erledigt, links <−96px löschen)
      forms.tsx               4 Formulare (Event/Task/Transaction/Note) mit prefill-Prop
                              (KI-Vorschau) und recent-Prop (Eingabe-Merker)
      bits.tsx                kleine Bausteine: Chip, EmptyHint (mit Aktions-Button),
                              DoneToggle (animiertes Häkchen), Segmented, …
  lib/
    zentrale/types.ts        alle TS-Typen + CATEGORIES + CATEGORY_COLORS + TONE-Maps
    zentrale/finance.ts      computeNextDue, advanceDue (monatsklemmend), forecastMonthEnd
    zentrale/date.ts         Datums-Helper (dayDiff, fmtEur, fmtLongDate, eventDate, dueInfo …)
    zentrale/useZentrale.ts  Daten-Laden + CRUD-Calls (fetch-Wrapper)
prisma/
  schema.prisma              5 Modelle (siehe §5)
  seed.ts                    WIPPT die DB (leerer Start-Zustand) — `bun prisma/seed.ts`
public/
  manifest.webmanifest       PWA-Manifest + 3 Shortcuts (Ausgabe/Termin/Aufgabe via ?quick=)
  sw.js                      Service-Worker, CACHE-Version v6 (bei Shell-Änderung bumpen!)
  icon-192/512, apple-touch-icon, logo.svg
```

## 5. Datenmodell (prisma/schema.prisma)

Alle Einträge sind flach, cuid-Primärschlüssel, `createdAt`/`updatedAt` überall.

- **Event** (Termin): `title`, `date` (Datum+Uhrzeit), `place?`, `note?`,
  `priority: HIGH|MEDIUM|LOW`, `recurring: NONE|YEARLY` (jährlich = Geburtstage/Jahrestage,
  wandern automatisch ins Folgejahr; `eventDate()` in date.ts rechnet das beim Lesen).
- **Task** (Aufgabe): `title`, `dueDate?`, `priority`, `done`, `completedAt?`,
  `recurring: NONE|DAILY|WEEKLY|MONTHLY|YEARLY` (Routine: beim Abhaken wird automatisch die
  nächste Fälligkeit angelegt).
- **Transaction** (Buchung): `title`, `amount` (Float > 0), `type: INCOME|EXPENSE`,
  `category` (Whitelist CATEGORIES), `date`, `recurring: NONE|WEEKLY|MONTHLY|YEARLY`,
  `nextDue?` (Fälligkeit des Fixpostens — nur gesetzt wenn recurring ≠ NONE).
- **Note**: `title`, `content`, `pinned`.
- **Setting**: Key-Value (`key` = PK), genutzt für `budget_monthly`.

**CATEGORIES** (feste Whitelist, auch im KI-Prompt): Wohnen, Lebensmittel, Abos, Mobilität,
Gesundheit, Freizeit, Einkommen, Sonstiges. Farben in `CATEGORY_COLORS` (auf dunklen Grund
abgestimmte Warmtöne, Einkommen grün).

## 6. API-Endpunkte

| Route | Methode | Zweck |
|---|---|---|
| `/api/events`, `/api/events/[id]` | GET/POST, PATCH/DELETE | Termine |
| `/api/tasks`, `/api/tasks/[id]` | GET/POST, PATCH/DELETE | Aufgaben (PATCH mit `done` setzt completedAt) |
| `/api/notes`, `/api/notes/[id]` | GET/POST, PATCH/DELETE | Notizen |
| `/api/transactions`, `/api/transactions/[id]` | GET/POST, PATCH/DELETE | Buchungen; **PATCH `{advance:true}`** = „✓ Gebucht"-Flow: erstellt keine Kopie, schiebt `nextDue` mit `advanceDue()` weiter (monatsklemmend: 31.1. → 28.2.) |
| `/api/parse` | POST | KI-Schnelleingabe: Text → strukturiertes `ParsedEntry` (siehe §8) |
| `/api/budget` | GET/PUT | Monatsbudget; `PUT {amount:null}` entfernt es |
| `/api/import` | POST | JSON-Backup einspielen |
| `/api/export/csv` | GET | CSV aller Buchungen (Excel/Numbers-kompatibel) |

JSON-Backup (Export) läuft **client-seitig** aus den geladenen Daten (SettingsSheet → Blob-Download).

## 7. UX-Flows

- **Quick-Add (Herzstück):** Gold-FAB → Sheet mit SmartBar oben: eine Zeile schreiben (oder
  🎤 diktieren) → Enter → `/api/parse` → passender Tab wird aktiviert und alle Felder sind
  vorausgefüllt (prefill) → Nutzer prüft/anpasst → Speichern. Fallback: Felder von Hand.
  Homescreen-Shortcuts öffnen das Sheet direkt mit vorgewähltem Tab (`?quick=transaction` u. a.).
- **Eingabe-Merker:** Im Buchungs-Formular erscheinen max. 4 zuletzt genutzte Titel als Chips;
  Tap füllt Titel/Betrag/Kategorie/Art/Wiederholung. Nur im Neu-Modus, verschwinden beim Tippen.
- **Bearbeiten:** Zeile antippen → EditSheet (alle Felder) + Duplizieren („ (Kopie)") +
  zweistufiges Löschen (roter Knopf → Bestätigung).
- **Löschen mit Rückgängig:** Jede Task-Löschung (Wisch UND EditSheet) läuft über
  `deleteWithUndo` in page.tsx: Toast 8 s mit „Rückgängig"-Aktion, Wiederherstellung per POST
  mit alten Inhalten (inkl. done-Zustand).
- **Aufgaben-Wisch:** rechts wischen (>64 px) = erledigt; links wischen (<−96 px) = sofort
  löschen; dazwischen: Zeile bleibt offen mit Löschknopf, Tap schließt sie. Engage-Schwelle
  8 px nur wenn horizontaler Ausschlag > vertikaler (Scrollen bleibt ungestört).
- **Suche:** Zahnrad-los, Kopf-Button → SearchSheet über alle 4 Bereiche, Treffer antippen
  öffnet EditSheet.
- **Leer-Zustände:** Jeder leere Bereich hat einen Direktaktions-Button („Erste Aufgabe
  anlegen" etc.) — nie eine Sackgasse.

## 8. Kernlogik (Details, die man kennen MUSS)

### 5-Farben-Logik (`types.ts` → TONE_CHIP/TONE_DOT/TONE_BAR)
`urgent` rot = überfällig/heute/HIGH · `soon` amber/ocker = bald (< 3 Tage, MEDIUM) ·
`planned` blau = geplant/LOW · `static` grau = erledigt/ruhend · `positive` grün = Einnahmen/
„alles erledigt". Manuelle Wichtigkeit mappt via `PRIORITY_TONE` (HIGH→urgent, MEDIUM→soon,
LOW→planned); Zeitliche Nähe kann hochstufen (überfällige Aufgabe ist rot, egal was
eingestellt war). Diese Farben kommen überall vor: Chips, Kalender-Punkte, Balken, Listen-Rand.

### Fixposten (Abo/Fixkosten)
- `nextDue` = nächste Fälligkeit. Anzeige: „heute fällig"/„morgen fällig"/„in X Tagen"
  (**tagesbasiert** — `computeNextDue` vergleicht seit v7 gegen 0 Uhr heute, nicht mehr gegen
  `now`; sonst verschwände der „Gebucht"-Knopf am Fälligkeitstag selbst).
- **„✓ Gebucht"-Knopf** (nur wenn dayDiff ≤ 0, sonst Chevron): erstellt SOFORT eine reale
  Buchung mit heutigem Datum UND schickt `PATCH {advance:true}` → `nextDue` rückt auf den
  nächsten Monat (monatsklemmend). Danach Toast + Saldo/Donut-Update live.
- Prognose: `forecastMonthEnd` rechnet Saldo + fällige Fixposten bis Monatsende
  („Prognose: −120 € bis Monatsende"), Chip in Saldo-Karte + Heute-Snapshot.

### KI-Schnelleingabe (`/api/parse`)
- `z-ai-web-dev-sdk`, thinking disabled, Systemprompt enthält **heutiges Datum** +
  Zeitzone Europe/Berlin, fordert **JSON-only** in genau einem von 4 Formaten (event/task/
  transaction/note).
- Serverseitige Normalisierung (vertraue der KI nicht blind): `validIsoDate`/`validTime`,
  Betrag > 0, Kategorie **nur aus CATEGORIES-Whitelist** (Prompt enthält Beispiel-Mappings:
  Miete→Wohnen, Netflix→Abos, Gehalt→Einkommen …), `oneOf`-Checks, sonst Fallback Sonstiges.
- Relative Zeilen wie „morgen", „gestern", „jeden Dienstag" versteht der Prompt (Wiederholung
  → recurring-Wert).
- Mikrofon: `webkitSpeechRecognition` Feature-Detect nach Mount (Safari iOS unterstützt es
  zwischenzeitlich; fehlt der Support, bleibt der Button unsichtbar), `de-DE`, interimResults
  live im Feld, finale Erkennung → automatisches Parsing. Fehler-Cases: „Mikrofon blockiert" /
  „nicht verstanden".

### Akzent-System (3 Farben, SettingsSheet umschaltbar)
- CSS-Variablen: `--brand-base/ink/deep/rgb`, `--hero-a/b/c/fg/fg-2`, `--fab-a/c`; `@theme
  inline` bindet `--color-brand` daran → **die ganze App färbt sich um**, weil Komponenten
  nur `brand`-Klassen benutzen.
- `html[data-accent='kupfer'|'salbei']` überschreibt die Variablen; Gold ist Default (kein
  data-Attribut nötig).
- Kein Flash beim Start: Mini-Skript in `layout.tsx` liest `localStorage['zentrale-accent']`
  **vor dem Paint** und setzt data-accent.
- Werte: Gold `#c9a84c` (ink `#221a05`), Kupfer `#d08a5a`, Salbei `#a9bd93`.

### Budget
Setting `budget_monthly` (EUR). Fortschrittsbalken in der Saldo-Karte (nur aktueller Monat):
< 70 % grün, < 100 % amber, ≥ 100 % rot + Warnzeile. Bewusst KEINE Kategorie-Budgets
(abgelehnt).

## 9. Design-System (Dark Edition)

- **Ebenen:** Basis `#0c0b09`, Karten `#171411`, Glass-Nav `#161310/85 + backdrop-blur-xl`.
- **Gold-System:** `--brand-base #c9a84c`; FAB-Gradient `#e8cd7d → brand → #b08a3a` mit
  Glow-Shadow; `.card-gold` = dezenter Gold-Gradient für Hero-/Saldo-Karte; `.app-ambient`
  = fixes Gold-Radial als Tiefenlicht (fixed, z-1, hinter Inhalt).
- **Typografie:** `font-family: -apple-system/BlinkMacSystemFont` VOR Geist → auf dem iPhone
  natives SF Pro (0 KB), Desktop/Android Geist. Alle Inputs 16 px (verhindert iOS-Auto-Zoom).
- **Layout:** App max 448 px zentriert; Bottom-Content-Offset `pb-[calc(96px+env(safe-area-
  inset-bottom))]`; Header `pt-[calc(env(safe-area-inset-top)+16px)]`; Sheets haben
  `pb-[env(safe-area-inset-bottom)]` (Home-Indicator); Toast-Viewport oben (mobil) bzw.
  unten (sm:), beide mit `max(1rem, env(...))`.
- **Touch:** `.hit`-Utility (unsichtbares ::after, inset −0.5rem) vergrößert kleine Klick-
  ziele auf ~44 pt; `touch-action: manipulation` (kein Doppel-Tipp-Zoom);
  `-webkit-tap-highlight-color: transparent`; `overscroll-behavior-y: none` (kein PTR).
- **Animationen:** `rise` (fade-in-up, gestaffelte Delays in HeuteView), `checkdraw`
  (Häkchen zeichnet sich im DoneToggle), Press-Feedback `active:scale-[0.985]` auf Rows,
  FAB `active:scale-90`. Alles unter `prefers-reduced-motion` deaktiviert.
- **Meta:** `formatDetection` aus (iOS macht sonst Beträge zu Telefonlinks), `themeColor
  #0c0b09`, `interactiveWidget: 'resizes-content'` (Tastatur schiebt Layout zusammen).

## 10. PWA-Details

- Manifest: Name „Die Zentrale", `display: standalone`, theme/background `#0c0b09`,
  Icons 192/512/apple-touch, **3 Shortcuts** (Ausgabe erfassen, Termin erfassen, Aufgabe
  erfassen → `?quick=…`).
- sw.js: einfaches Cache-First für Shell-Assets, **CACHE-Konstante v6** — bei jeder Änderung
  der Shell (layout/globals/manifest) bumpen, sonst sehen installierte Geräte nichts Neues.
- App-Badge: `navigator.setAppBadge/clearAppBadge` (Feature-Detect, try/catch) — Anzahl
  offener, heute fälliger Aufgaben.
- Installations-Hinweis für iOS (Aktionen teilen → Zum Home-Bildschirm) im SettingsSheet.

## 11. Bewusste Entscheidungen & Ausschlüsse (nicht wieder vorschlagen!)

**Verworfen (endgültig):** Offline-Sync/Server-Hosting, Kategorie-Budgets, Foto-Anhänge,
Unternotizen, Push-Benachrichtigungen, Login/Multi-User.
**In Runde 7 entfernt:** Donut-Doppelung auf Heute, CSV/Export-Buttons aus den Headern
(liegen jetzt im SettingsSheet), nackter Fortschrittsbalken, WeekStrip (durch echten
Monatskalender ersetzt).
**Warum SQLite lokal:** Privatnutzer, ein Gerät, keine Cloud-Abhängigkeit, Daten bleiben
beim Nutzer (Datenschutz-Argument). `db/` ist deshalb bewusst **nicht** im Repo.

## 12. Entwicklung & QA-Konventionen (so wurde gearbeitet)

```bash
bun install                      # deps
bunx prisma generate             # Client
bun run dev                      # dev server :3000
bun prisma/seed.ts               # DB WIPPN (leerer Zustand — vor Übergabe immer!)
curl -X PUT localhost:3000/api/budget -d '{"amount":null}' -H 'Content-Type: application/json'
bun run lint                     # eslint
bunx tsc --noEmit                # Typcheck (src/ muss 0 Fehler sein)
```

- `.env` (NICHT im Repo): `DATABASE_URL=file:/home/z/my-project/db/custom.db`
- **QA-Prozess jedes Mal:** agent-browser in 393×852 (iPhone 15 Pro) UND 1280×800 (Desktop);
  Testdaten über die echte UI anlegen; alle Kernflows durchklicken (Quick-Add inkl. KI,
  Wisch, Gebucht-Flow, Undo, Suche, Import/Export, Akzente); danach DB wippen — Endzustand
  ist IMMER der leere Willkommens-Screen. Konsolen-/Seitenfehler müssen leer sein.
- **Lint-Falle:** `react-hooks/set-state-in-effect` — bei nötigem setState im Effect das
  `queueMicrotask(() => …)`-Pattern benutzen (so machen es AufgabenView-Swipe-Hinweis und
  SettingsSheet-Akzent-Init).
- **Versionszeile** im SettingsSheet hochzählen (aktuell „Version 7 · Dark Edition") bei
  sichtbaren Änderungen; sw.js CACHE bumpen bei Shell-Änderungen.

## 13. Test-Artefakte & bekannte Eigenheiten

- Headless-Test-Nachteile (KEINE App-Bugs): 12h-Locale im Testbrowser kann Zeit-Spinbutton-
  Füllung verhindern (App zeigt korrekt 14:30 Uhr); das `nextjs-portal`-Overlay der
  Dev-Tools kann Klicks verdecken (im Test `remove()`).
- QA-Screenshots der letzten Durchläufe: `scripts/qa3_*.png` (nicht im Repo).
- Konzept-PDF + Wireframe: `docs/` im Repo.

## 14. Ideen-Pool (bewusst NICHT umgesetzt, nur falls explizit gewünscht)

- Wochenansicht zusätzlich zum Monatskalender (wurde abgelehnt — Monatskalender gewann)
- Statistik-Vertiefung in Finanzen (Jahresverlauf, Top-Kategorien-Liste)
- Erweiterte Wiederholungen für Termine (täglich/wöchentlich — aktuell nur jährlich)
- Daten-Cloud-Sync (bewusst verworfen)

## 15. Aktueller Zustand / Was als Nächstes

- **v7 ist vollständig umgesetzt und verifiziert**: alle Features aus §3, 5-Farben-Logik,
  Safe-Areas, KI-Pipeline, Undo, Diktier-Button, Eingabe-Merker, 3 Akzente.
- DB ist gewippt (leer), Budget nicht gesetzt — Auslieferungszustand.
- Offene Punkte: keine bekannten Bugs. Nächste sinnvolle Schritte wären echte Nutzung und
  Feedback-Schleifen statt neuer Features (Prinzip „Subtraktion vor Addition").
