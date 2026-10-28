'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck, Check, Download, FileSpreadsheet, Info, Palette, Upload } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ImportSheet } from '@/components/zentrale/ImportSheet'
import { dayKey } from '@/lib/zentrale/date'
import type { EventItem, NoteItem, TaskItem, TransactionItem } from '@/lib/zentrale/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  events: EventItem[]
  tasks: TaskItem[]
  transactions: TransactionItem[]
  notes: NoteItem[]
  onImported: () => void
}

/** Verfügbare Akzentfarben – Reihenfolge = Anzeige. */
const ACCENTS = [
  { id: 'gold', label: 'Gold', color: '#c9a84c' },
  { id: 'kupfer', label: 'Kupfer', color: '#d08a5a' },
  { id: 'salbei', label: 'Salbei', color: '#a9bd93' },
] as const

type AccentId = (typeof ACCENTS)[number]['id']

function Row({
  icon: Icon,
  title,
  hint,
  onClick,
  href,
  download,
}: {
  icon: typeof Download
  title: string
  hint: string
  onClick?: () => void
  href?: string
  download?: boolean
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10" aria-hidden>
        <Icon className="h-4 w-4 text-brand" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
      </span>
    </>
  )
  const cls =
    'flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-all duration-150 hover:border-stone-600 active:scale-[0.99]'
  return href ? (
    <a href={href} download={download} onClick={onClick} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/** Erzeugt den Export-Handler (JSON-Download aller vier Bereiche). */
function exportBackup(events: EventItem[], tasks: TaskItem[], transactions: TransactionItem[], notes: NoteItem[]) {
  return () => {
    const payload = {
      app: 'Die Zentrale',
      exportedAt: new Date().toISOString(),
      events,
      tasks,
      transactions,
      notes,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zentrale-backup-${dayKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Einstellungen: alle Daten-Operationen (Backup & Export) und App-Infos
 * an einem Ort - aus den daily Views raus, damit die Kopfzeilen ruhig bleiben.
 */
export function SettingsSheet({ open, onOpenChange, events, tasks, transactions, notes, onImported }: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [accent, setAccent] = useState<AccentId>('gold')

  // Aktuelle Auswahl beim Öffnen übernehmen (wird vom Früh-Skript im <body> gesetzt)
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      const current = document.documentElement.getAttribute('data-accent')
      if (current === 'kupfer' || current === 'salbei') setAccent(current)
      else setAccent('gold')
    })
  }, [open])

  function pickAccent(id: AccentId) {
    setAccent(id)
    if (id === 'gold') document.documentElement.removeAttribute('data-accent')
    else document.documentElement.setAttribute('data-accent', id)
    try {
      localStorage.setItem('zentrale-accent', id)
    } catch {
      /* Speichern nicht möglich -> Auswahl gilt nur für diese Sitzung */
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="pb-1 text-left">
            <DrawerTitle>Einstellungen</DrawerTitle>
            <DrawerDescription>Daten sichern, übertragen und zur App.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[60dvh] space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2">
            <section aria-label="Daten & Backup">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Daten &amp; Backup</h3>
              <div className="space-y-2">
                <Row
                  icon={Download}
                  title="Backup exportieren (JSON)"
                  hint="Alle Termine, Aufgaben, Buchungen und Notizen als Datei sichern."
                  onClick={exportBackup(events, tasks, transactions, notes)}
                />
                <Row
                  icon={Upload}
                  title="Backup importieren"
                  hint="Backup zurückspielen – zusammenführen oder alles ersetzen."
                  onClick={() => {
                    onOpenChange(false)
                    queueMicrotask(() => setImportOpen(true))
                  }}
                />
                <Row
                  icon={FileSpreadsheet}
                  title="Buchungen als CSV"
                  hint="Für Excel oder Numbers – Semikolon-getrennt, deutsche Zahlen."
                  href="/api/export/csv"
                  download
                />
              </div>
            </section>

            <section aria-label="Erscheinungsbild">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Erscheinungsbild</h3>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Akzentfarbe wählen">
                {ACCENTS.map((a) => {
                  const active = accent === a.id
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => pickAccent(a.id)}
                      aria-pressed={active}
                      className={cn(
                        'hit flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-3 transition-all',
                        active ? 'border-brand/60 bg-brand/5' : 'border-border hover:border-stone-600'
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10"
                        style={{ backgroundColor: a.color }}
                      >
                        {active && <Check className="h-3.5 w-3.5 text-[#0c0b09]" strokeWidth={3.5} />}
                      </span>
                      <span className={cn('text-[12px] font-semibold', active ? 'text-brand' : 'text-muted-foreground')}>{a.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-stone-500">
                <Palette className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Akzent der ganzen App – Aufhellung, FAB und Karten folgen. Gespeichert auf diesem Gerät.
              </p>
            </section>

            <section aria-label="App">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">App</h3>
              <div className="space-y-2">
                <Row
                  icon={CalendarCheck}
                  title="Zum Home-Bildschirm hinzufügen"
                  hint="iPhone: Teilen → „Zum Home-Bildschirm“ · Android: Menü ⁝ → „Zum Startbildschirm“. Läuft dann wie eine echte App, ohne Store."
                />
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10" aria-hidden>
                    <Info className="h-4 w-4 text-brand" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Die Zentrale</span>
                    <span className="block text-xs text-muted-foreground">Version 7 · Dark Edition · nur auf diesem Gerät</span>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </DrawerContent>
      </Drawer>
      <ImportSheet open={importOpen} onOpenChange={setImportOpen} onDone={onImported} />
    </>
  )
}
