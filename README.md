# Die Zentrale

> Persönliche Organisations-App: **Termine · Finanzen · Aufgaben · Notizen** — eine App,
> eine Farblogik, ein täglicher Loop. Mobile-first PWA, Dark-Only, **komplett lokal**.

**Die App läuft vollständig im Browser.** Es gibt keinen Server, keine API, keine Cloud,
keine Anmeldung und keine Datenbank außerhalb deines Geräts. Alle Einträge liegen in
**IndexedDB** auf dem Handy und bleiben auch offline verfügbar.

## Warum „Die Zentrale"?

Die App entscheidet per **5-Farben-Logik**, was gerade zählt: rot = dringend, ocker = bald,
blau = geplant, grau = ruhend, grün = positiv. Statt Menü-Wäldern gibt es einen Tagesschwerpunkt
(„Heute"), eine lokale Schnelleingabe („Zahnarzt morgen 14:30 wichtig" → vorausgefülltes Formular)
und alles andere ist maximal zwei Tipps entfernt.

## Features

- **Heute** — Hero-Karte mit Tagesbegrüßung, Fortschrittsring, Chips, Überfällig-Sektion,
  Finanz-Snapshot
- **Termine** — Monatskalender mit Farbpunkten, Tagesfilter, Wiederholungen
  (wöchentlich/monatlich/jährlich inkl. Geburtstage mit Countdown)
- **Finanzen** — Saldo, Monatsbudget mit Ampel, Monatsend-Prognose, Kategorie-Donut,
  6-Monats-Trend, Fixposten/Abo-Verwaltung mit **Ein-Knopf-Buchung**
- **Aufgaben** — Fristen mit Countdown, Routinen (täglich → jährlich, erzeugen beim Abhaken
  die nächste Fälligkeit), Wischgesten, Snooze
- **Notizen** — mit Pins
- **Schnelleingabe** — eine Zeile tippen oder diktieren → Tab + Felder werden vorausgefüllt.
  Die deutsche Erkennung läuft **komplett lokal und offline**.
- **Rückgängig** — Löschen und Fixposten-Buchen zeigen einen Rückgängig-Toast
- **Globale Suche**, **Duplizieren**, **JSON-Backup Export/Import**, **CSV-Export**
- **PWA** — installierbar, offline nutzbar, Homescreen-Shortcuts, App-Badge,
  3 Akzentfarben (Gold/Kupfer/Salbei)

## Tech-Stack

Next.js 16 (statischer Export) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
IndexedDB (native) · PWA (Service Worker)

Kein Prisma, kein SQLite, kein API-Server.

## Entwicklung

```bash
npm install
npm run dev            # http://localhost:3000
```

Die App startet leer mit dem Willkommens-Screen. Alle Daten kommen von dir.

Statischen Build erzeugen:

```bash
npm run build          # Ergebnis liegt in out/
npm run start          # lokale Vorschau via npx serve
```

## Auf dem Handy installieren

Die App braucht **HTTPS** (oder localhost), damit der Service Worker und die PWA-Installation
funktionieren. Am einfachsten:

1. Repository zu **Netlify** verbinden (kostenlos).
2. Build-Kommando: `npm run build`
3. Publish-Verzeichnis: `out`
4. Die `netlify.toml` im Repo enthält diese Einstellungen bereits.
5. Die `https://…netlify.app`-Adresse am Handy öffnen.
6. iPhone/Safari: **Teilen → Zum Home-Bildschirm**; Android/Chrome: **App installieren**.

Netlify deployt bei jedem Push auf `main` automatisch neu.

## Datenschutz und Datensicherung

Alle Daten bleiben im Browser des Geräts. Es gibt keine Cloud, kein Konto, keine Analyse.
Das hat eine wichtige Konsequenz:

- **Browserdaten löschen = alle Daten weg.**
- Deshalb regelmäßig **Einstellungen → Backup exportieren** nutzen.
- Beim Gerätewechsel zuerst das Backup exportieren und auf dem neuen Gerät importieren.
- Die App bittet den Browser um dauerhafte Speicherung; eine Garantie ist das auf iOS nicht.
  Das JSON-Backup bleibt die verlässliche Sicherung.

## Projekt-Status

**v10 · Local-First** — statischer Export, IndexedDB, offline-fähig. Details für
Weiterentwicklung: [`AI_CONTEXT.md`](AI_CONTEXT.md).
