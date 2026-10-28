'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, ListTodo, Loader2, Mic, Sparkles, StickyNote, Wallet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Segmented } from './bits'
import { EventForm, NoteForm, TaskForm, TransactionForm } from './forms'
import type { ParsedEntry, QuickTab, TransactionItem } from '@/lib/zentrale/types'
import { parseQuickText } from '@/lib/zentrale/quickparse'
import { cn } from '@/lib/utils'

const SMART_INPUT =
  'w-full rounded-xl border-border bg-muted/40 pl-9 text-base text-foreground placeholder:text-stone-500 focus-visible:ring-brand'

// ---------- Spracherkennung (iOS Safari: webkitSpeechRecognition) ----------
interface SpeechAlternativeLike {
  transcript: string
}
interface SpeechResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechAlternativeLike
}
interface SpeechEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechResultLike }
}
interface RecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  abort: () => void
}
type RecognitionCtor = new () => RecognitionLike

/** Quick-Capture: die zentrale +-Taste. Oben lokale Schnelleingabe (tippen oder diktieren), darunter die vier Reiter. */
export function QuickAddSheet({
  open,
  onOpenChange,
  onSaved,
  initialTab = 'event',
  initialDate,
  transactions,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
  initialTab?: QuickTab
  /** Vorbelegtes Datum, z. B. der im Kalender angetippte Tag. */
  initialDate?: string | null
  /** Frühere Buchungen -> Eingabe-Merker (Vorschläge im Buchungsformular). */
  transactions?: TransactionItem[]
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<QuickTab>(initialTab)
  const [smart, setSmart] = useState('')
  const [parsing, setParsing] = useState(false)
  const [prefill, setPrefill] = useState<ParsedEntry | null>(null)
  const [prefillToken, setPrefillToken] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<RecognitionLike | null>(null)

  // Spracherkennung nur nach dem Mount prüfen (Hydration-sicher) und beim Schließen sauber beenden
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    const supported = !!(w.SpeechRecognition || w.webkitSpeechRecognition)
    queueMicrotask(() => setSpeechSupported(supported))
    return () => {
      try {
        recRef.current?.abort()
      } catch {
        /* ignorieren */
      }
    }
  }, [])

  function handleDone() {
    onSaved()
    // über handleClose schließen, damit Vorschau & Eingabe geleert werden (sonst klebt der alte Entwurf beim nächsten Öffnen)
    handleClose(false)
  }

  /** Sheet schließen -> Vorschau & Eingabe verwerfen, damit beim nächsten Öffnen alles blank ist. */
  function handleClose(next: boolean) {
    if (!next) {
      try {
        recRef.current?.abort()
      } catch {
        /* ignorieren */
      }
      setListening(false)
      setTab(initialTab)
      setPrefill(null)
      setPrefillToken((t) => t + 1)
      setSmart('')
    }
    onOpenChange(next)
  }

  /** Schnelleingabe: lokale deutsche Erkennung, sofort und ohne Netz. */
  async function runParse(textOverride?: string) {
    const text = (textOverride ?? smart).trim()
    if (!text || parsing) return
    setParsing(true)
    const local = parseQuickText(text)
    if (local) {
      applyEntry(local, true)
      setParsing(false)
      return
    }
    setParsing(false)
    toast({ title: 'Nicht erkannt.', description: 'Bitte direkt im Formular erfassen.', variant: 'destructive' })
  }

  function applyEntry(entry: ParsedEntry, local: boolean) {
    setTab(entry.kind)
    setPrefill(entry)
    setPrefillToken((t) => t + 1)
    setSmart('')
    toast({
      title: local ? 'Lokal erkannt.' : 'Vorschau ausgefüllt.',
      description: local ? 'Lokal erkannt – bitte kurz prüfen.' : 'Bitte kurz prüfen und speichern.',
    })
  }

  /** Diktat starten (oder laufendes Diktat stoppen); Ergebnis läuft in dieselbe Verarbeitung. */
  function toggleDictation() {
    if (listening) {
      try {
        recRef.current?.abort()
      } catch {
        /* ignorieren */
      }
      setListening(false)
      return
    }
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    try {
      recRef.current?.abort()
    } catch {
      /* ignorieren */
    }
    const rec = new Ctor()
    recRef.current = rec
    rec.lang = 'de-DE'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      let finalText = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0]?.transcript ?? ''
        if (e.results[i].isFinal) finalText += chunk
        else interim += chunk
      }
      if (finalText.trim()) {
        setListening(false)
        setSmart(finalText.trim())
        void runParse(finalText.trim())
      } else if (interim.trim()) {
        setSmart(interim.trim()) // live mitlesen
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = (ev) => {
      setListening(false)
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        toast({ title: 'Mikrofon blockiert.', description: 'Bitte in den iOS-Einstellungen unter Safari den Mikrofonzugriff erlauben.', variant: 'destructive' })
      } else if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        toast({ title: 'Diktat nicht verstanden.', description: 'Bitte erneut tippen oder die Zeile eintippen.', variant: 'destructive' })
      }
    }
    setSmart('')
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="mx-auto max-w-md sm:max-w-lg">
        <DrawerHeader className="pb-1 text-left">
          <DrawerTitle>Neu erfassen</DrawerTitle>
          <DrawerDescription>Alles landet an seinem Ort – und sofort in der Übersicht.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void runParse()
            }}
            className="flex items-center gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
              <Input
                value={smart}
                onChange={(e) => setSmart(e.target.value)}
                placeholder={listening ? 'Sprich jetzt …' : 'z. B. Zahnarzt morgen 14:30, 45 €'}
                className={SMART_INPUT}
                maxLength={300}
                enterKeyHint="go"
                aria-label="Schnelleingabe: eine Zeile, die Zentrale füllt das Formular aus"
              />
            </div>
            {speechSupported && (
              <button
                type="button"
                onClick={toggleDictation}
                aria-label={listening ? 'Diktat stoppen' : 'Statt zu tippen diktieren'}
                aria-pressed={listening}
                title={listening ? 'Diktat stoppen' : 'Diktieren'}
                className={cn(
                  'hit flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
                  listening
                    ? 'animate-pulse border-red-500/50 bg-red-500/15 text-red-400'
                    : 'border-border bg-card text-muted-foreground hover:border-stone-600 hover:text-foreground'
                )}
              >
                <Mic className="h-4.5 w-4.5" aria-hidden />
              </button>
            )}
            <button
              type="submit"
              disabled={parsing || !smart.trim()}
              aria-label="Aus Text ausfüllen"
              className="hit flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink transition-opacity disabled:opacity-40"
            >
              {parsing ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : <ArrowRight className="h-4.5 w-4.5" aria-hidden />}
            </button>
          </form>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
            {listening
              ? 'Die Zentrale hört zu – sprich deinen Eintrag in einem Satz.'
              : 'Kurz eintippen oder Mikrofon antippen – Typ, Datum & Betrag werden erkannt, auch offline.'}
          </p>
        </div>
        <div className="px-4">
          <Segmented<QuickTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'event', label: 'Termin', icon: CalendarDays },
              { value: 'task', label: 'Aufgabe', icon: ListTodo },
              { value: 'transaction', label: 'Buchung', icon: Wallet },
              { value: 'note', label: 'Notiz', icon: StickyNote },
            ]}
          />
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-4 pb-6 pt-4">
          {tab === 'event' && (
            <EventForm
              key={`new-event-${initialTab}-${initialDate ?? ''}-${prefillToken}`}
              prefill={prefill?.kind === 'event' ? prefill : undefined}
              defaultDate={initialDate ?? undefined}
              onDone={handleDone}
            />
          )}
          {tab === 'task' && (
            <TaskForm
              key={`new-task-${initialTab}-${initialDate ?? ''}-${prefillToken}`}
              prefill={prefill?.kind === 'task' ? prefill : undefined}
              defaultDate={initialDate ?? undefined}
              onDone={handleDone}
            />
          )}
          {tab === 'transaction' && (
            <TransactionForm
              key={`new-tx-${initialTab}-${prefillToken}`}
              prefill={prefill?.kind === 'transaction' ? prefill : undefined}
              recent={transactions}
              onDone={handleDone}
            />
          )}
          {tab === 'note' && (
            <NoteForm key={`new-note-${initialTab}-${prefillToken}`} prefill={prefill?.kind === 'note' ? prefill : undefined} onDone={handleDone} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
