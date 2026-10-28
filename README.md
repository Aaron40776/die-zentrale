# Die Zentrale

> Persönliche Organisations-App: **Termine · Finanzen · Aufgaben · Notizen** — eine App,
> eine Farblogik, ein täglicher Loop. Mobile-first PWA, Dark-Only, keine Cloud, keine Demo-Daten.

**→ Neu im Projekt (ob Mensch oder KI)? Lies zuerst [`AI_CONTEXT.md`](AI_CONTEXT.md) — dort ist der komplette Stand dokumentiert: Features, Architektur, Datenmodell, Design-System, Kernlogik, QA-Konventionen und alle bewussten Design-Entscheidungen.**

## Warum „Die Zentrale"?

Die App entscheidet per **5-Farben-Logik**, was gerade zählt: rot = dringend, ocker = bald,
blau = geplant, grau = ruhend, grün = positiv. Statt Menü-Wäldern gibt es einen Tagesschwerpunkt
(„Heute"), eine lokale Schnelleingabe („Zahnarzt morgen 14:30 wichtig" → vorausgefülltes Formular)
und alles andere ist maximal zwei Tipps entfernt.

## Features

- **Heute** — Hero-Karte mit Tagesbegrüßung, Fortschrittsring, Chips (Termine/Aufgaben),
  Überfällig-Sektion, Finanz-Snapshot
- **Termine** — Monatskalender mit Farbpunkten, Tagesfilter, Wiederholungen
  (wöchentlich/monatlich/jährlich inkl. Geburtstage mit Countdown)
- **Finanzen** — Saldo, Monatsbudget mit Ampel, Monatsend-Prognose, Kategorie-Donut,
  6-Monats-Trend, Fixposten/Abo-Verwaltung mit **Ein-Knopf-Buchung** („✓ Buchen" bucht heute
  und schiebt die nächste Fälligkeit automatisch weiter)
- **Aufgaben** — Fristen mit Countdown, Routinen (täglich → jährlich, spawnen beim Abhaken
  die nächste Fälligkeit), Wischgesten (rechts = erledigt, links = löschen), Snooze
- **Notizen** — mit Pins
- **Schnelleingabe** — eine Zeile tippen oder 🎤 diktieren → Tab + Felder werden
  vorausgefüllt. Die lokale deutsche Erkennung funktioniert **auch ohne KI/Netz**; die KI
  verfeinert nur, wenn konfiguriert. Erkennt u. a. Beträge, Einnahmen, relative Daten und
  Wiederholungen. Dazu Eingabe-Merker (letzte Buchungstitel als Chips)
- **Rückgängig** — Löschen und das Buchen eines Fixpostens zeigen 8 s lang einen
  „Rückgängig"-Toast (Letzteres setzt auch die Fälligkeit zurück)
- **Globale Suche**, **Duplizieren**, **JSON-Backup Export/Import**, **CSV-Export**
- **PWA** — installierbar (iPhone 15 Pro optimiert: Safe-Areas, ≥44 pt Touch-Ziele, kein
  iOS-Zoom), Homescreen-Shortcuts, App-Badge, **3 Akzentfarben** (Gold/Kupfer/Salbei)

## Tech-Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite ·
npm/Bun · PWA (Service Worker) · z-ai-web-dev-sdk (KI-Parsing, server-only)

## Setup

```bash
npm install
echo 'DATABASE_URL=file:/absoluter/pfad/zu/db/custom.db' > .env
npm run db:generate
npm run dev            # http://localhost:3000
```

Die Datenbank startet **leer** (Willkommens-Screen) — alle Daten kommen von dir.
Zum Zurücksetzen: `npm run seed` (leert die DB vollständig).
`bun install` / `bun run dev` funktionieren genauso, sind aber nicht nötig.

## Datenschutz

Alle Daten liegen **ausschließlich lokal** in einer SQLite-Datei (`db/custom.db`, nicht im
Repo). Keine Cloud, kein Account, keine Analyse. Die Schnelleingabe parst zuerst lokal; nur
wenn eine KI konfiguriert ist, wird der eine Text-Schnipsel zusätzlich an das KI-Backend
gesendet. Ohne KI-Konfiguration bleibt alles offline.

## Projekt-Status

**v9 · Dark Edition** — vollständig implementiert und browser-geprüft (iPhone 15 Pro
393×852 + Desktop). Roadmap & Ideen-Pool: siehe `AI_CONTEXT.md` §14–15.
