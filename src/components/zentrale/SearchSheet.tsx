'use client'

import { useMemo, useRef, useState } from 'react'
import { CalendarDays, ListTodo, Search, StickyNote, Wallet, X } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { fmtEur, fmtShortDate, eventDate } from '@/lib/zentrale/date'
import { RECURRING_LABELS, type EditTarget, type EventItem, type NoteItem, type TaskItem, type TransactionItem } from '@/lib/zentrale/types'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPick: (t: EditTarget) => void
  events: EventItem[]
  tasks: TaskItem[]
  transactions: TransactionItem[]
  notes: NoteItem[]
}

/** Umlaute/Akzente ignorieren, damit „Muller“ auch „Müller“ findet. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
}

interface Hit {
  key: string
  kind: 'event' | 'task' | 'transaction' | 'note'
  label: string
  sub: string
  target: EditTarget
}

/** Globale Suche über Termine, Aufgaben, Buchungen und Notizen – alles ist maximal 3 Tipps entfernt. */
export function SearchSheet({ open, onOpenChange, onPick, events, tasks, transactions, notes }: Props) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const needle = q.trim().toLowerCase()
  const needleNorm = normalize(needle)

  const hits: Hit[] = useMemo(() => {
    if (needleNorm.length < 2) return []
    const match = (...parts: (string | null | undefined)[]) =>
      parts.some((p) => p && normalize(p).includes(needleNorm))

    const evHits: Hit[] = events
      .filter((e) => match(e.title, e.place, e.note))
      .slice(0, 6)
      .map((e) => ({
        key: `ev-${e.id}`,
        kind: 'event' as const,
        label: e.title,
        sub: `Termin · ${fmtShortDate(eventDate(e).toISOString())}${e.recurring !== 'NONE' ? ` · ${RECURRING_LABELS[e.recurring].toLowerCase()}` : ''}`,
        target: { kind: 'event', event: e },
      }))

    const taskHits: Hit[] = tasks
      .filter((t) => match(t.title))
      .slice(0, 6)
      .map((t) => ({
        key: `tk-${t.id}`,
        kind: 'task' as const,
        label: t.title,
        sub: `Aufgabe${t.done ? ' · erledigt' : ''}${t.dueDate ? ` · ${fmtShortDate(t.dueDate)}` : ''}`,
        target: { kind: 'task', task: t },
      }))

    const txHits: Hit[] = transactions
      .filter((t) => match(t.title, t.category))
      .slice(0, 6)
      .map((t) => {
        const fixed = t.recurring !== 'NONE'
        const when = fixed && t.nextDue ? `nächste Fälligkeit ${fmtShortDate(t.nextDue)}` : fmtShortDate(t.date)
        return {
          key: `tx-${t.id}`,
          kind: 'transaction' as const,
          label: t.title,
          sub: `${fixed ? 'Fixposten' : 'Buchung'} · ${t.category} · ${when} · ${fmtEur(t.amount)}`,
          target: { kind: 'transaction', transaction: t },
        }
      })

    const noteHits: Hit[] = notes
      .filter((n) => match(n.title, n.content))
      .slice(0, 6)
      .map((n) => ({
        key: `no-${n.id}`,
        kind: 'note' as const,
        label: n.title,
        sub: 'Notiz' + (n.pinned ? ' · angeheftet' : ''),
        target: { kind: 'note', note: n },
      }))

    return [...evHits, ...taskHits, ...txHits, ...noteHits]
  }, [needleNorm, events, tasks, transactions, notes])

  const KIND_ICON = { event: CalendarDays, task: ListTodo, transaction: Wallet, note: StickyNote }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQ('')
      }}
    >
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="pb-1 text-left">
          <DrawerTitle>Suchen</DrawerTitle>
          <DrawerDescription>Termine, Aufgaben, Buchungen und Notizen auf einen Streich finden.</DrawerDescription>
        </DrawerHeader>
        <div className="relative px-4">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" aria-hidden />
          <Input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="z. B. Zahnarzt, Netflix, Belege …"
            className="w-full rounded-xl border-border bg-muted/40 pl-9 pr-9 text-base placeholder:text-stone-500"
            aria-label="Suchbegriff"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('')
                inputRef.current?.focus()
              }}
              aria-label="Suchbegriff löschen"
              className="hit absolute right-7 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-stone-500 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        <div className="max-h-[55dvh] min-h-32 overflow-y-auto px-4 pb-6 pt-3">
          {needle.length < 2 ? (
            <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
              Mindestens zwei Buchstaben tippen – Ergebnisse erscheinen sofort.
            </p>
          ) : hits.length === 0 ? (
            <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">Nichts gefunden für „{q.trim()}“.</p>
          ) : (
            <ul className="space-y-1.5">
              {hits.map((h) => {
                const Icon = KIND_ICON[h.kind]
                return (
                  <li key={h.key}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        setQ('')
                        onPick(h.target)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-stone-600"
                    >
                      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{h.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{h.sub}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
