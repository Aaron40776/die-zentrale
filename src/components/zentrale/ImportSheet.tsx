'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { apiSend } from '@/lib/zentrale/useZentrale'
import { cn } from '@/lib/utils'

interface ParsedBackup {
  budget?: number | null
  events: unknown[]
  tasks: unknown[]
  transactions: unknown[]
  notes: unknown[]
}

/**
 * Backup wiederherstellen: JSON-Datei einlesen, Zusammenfassung zeigen,
 * dann Zusammenführen (neu anlegen) oder Alles ersetzen (1:1-Restore).
 */
export function ImportSheet({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)

  function reset() {
    setFileName(null)
    setParsed(null)
    setError(null)
    setConfirmReplace(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleOpenChange(o: boolean) {
    if (!o && busy) return
    if (!o) reset()
    onOpenChange(o)
  }

  function pickFile(f: File | undefined) {
    setParsed(null)
    setError(null)
    setConfirmReplace(false)
    setFileName(f?.name ?? null)
    if (!f) return
    void f.text().then((txt) => {
      try {
        const j = JSON.parse(txt) as Record<string, unknown>
        if (j.app !== 'Die Zentrale') throw new Error('fremd')
        const arr = (k: string) => (Array.isArray(j[k]) ? (j[k] as unknown[]) : [])
        const p: ParsedBackup = {
          budget: typeof j.budget === 'number' && Number.isFinite(j.budget) && j.budget > 0 ? j.budget : null,
          events: arr('events'),
          tasks: arr('tasks'),
          transactions: arr('transactions'),
          notes: arr('notes'),
        }
        if (p.events.length + p.tasks.length + p.transactions.length + p.notes.length === 0) {
          throw new Error('leer')
        }
        setParsed(p)
      } catch {
        setFileName(null)
        if (inputRef.current) inputRef.current.value = ''
        setError('Das sieht nicht nach einem Zentrale-Backup aus. Erwartet wird die JSON-Datei aus dem Backup-Export dieser App.')
      }
    })
  }

  async function run(mode: 'merge' | 'replace') {
    if (!parsed || busy) return
    setBusy(true)
    const ok = await apiSend('/api/import', 'POST', { mode, data: parsed })
    setBusy(false)
    if (ok) {
      toast({
        title: mode === 'replace' ? 'Backup wiederhergestellt.' : 'Backup zusammengeführt.',
        description: `${parsed.events.length} Termine · ${parsed.tasks.length} Aufgaben · ${parsed.transactions.length} Buchungen · ${parsed.notes.length} Notizen`,
      })
      reset()
      onOpenChange(false)
      onDone()
    } else {
      toast({ title: 'Import fehlgeschlagen.', variant: 'destructive' })
    }
  }

  const total = parsed ? parsed.events.length + parsed.tasks.length + parsed.transactions.length + parsed.notes.length : 0

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="mx-auto max-w-md sm:max-w-lg">
        <DrawerHeader className="pb-1 text-left">
          <DrawerTitle>Backup importieren</DrawerTitle>
          <DrawerDescription>Stelle dein JSON-Backup wieder her – zum Beispiel nach einem Gerätewechsel.</DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[60dvh] space-y-3 overflow-y-auto px-4 pb-6 pt-2">
          <label
            className="relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-7 text-center transition-colors hover:border-brand/50"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Backup-Datei wählen"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Upload className="h-7 w-7 text-stone-500" aria-hidden />
            <span className="max-w-full truncate text-sm font-medium text-foreground">{fileName ?? 'Backup-Datei wählen'}</span>
            <span className="text-xs text-muted-foreground">JSON aus dem Backup-Export (Download-Symbol)</span>
          </label>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">{error}</p>
          )}

          {parsed && (
            <>
              <div className="rounded-xl border border-border bg-card px-3.5 py-3 text-[13px] text-foreground">
                <p className="font-semibold">{total} Einträge erkannt</p>
                <p className="mt-0.5 text-muted-foreground">
                  {parsed.events.length} Termine · {parsed.tasks.length} Aufgaben · {parsed.transactions.length} Buchungen ·{' '}
                  {parsed.notes.length} Notizen
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run('merge')}
                  className="flex-1 rounded-xl border-border"
                >
                  Zusammenführen
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => (confirmReplace ? run('replace') : setConfirmReplace(true))}
                  className={cn(
                    'flex-1 rounded-xl text-white',
                    confirmReplace ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
                  )}
                >
                  {busy ? 'Importiert …' : confirmReplace ? 'Wirklich ersetzen' : 'Alles ersetzen'}
                </Button>
              </div>
              {confirmReplace && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                  <span>Alle aktuellen Einträge werden gelöscht.</span>
                  <button
                    type="button"
                    onClick={() => setConfirmReplace(false)}
                    className="hit shrink-0 font-semibold underline-offset-2 hover:underline"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
              <p className="text-[11px] leading-snug text-stone-500">
                <span className="font-semibold text-stone-400">Zusammenführen</span> legt alles zusätzlich an (doppelte Einträge möglich).{' '}
                <span className="font-semibold text-stone-400">Alles ersetzen</span> löscht zuerst alle aktuellen Einträge und stellt das Backup
                exakt wieder her.
              </p>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}