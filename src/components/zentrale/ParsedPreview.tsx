import { CalendarDays, CheckCircle2, ListTodo, StickyNote, Wallet, type LucideIcon } from 'lucide-react'
import { fmtEur, fmtShortDate } from '@/lib/zentrale/date'
import { PRIORITY_LABELS, RECURRING_LABELS, type ParsedEntry } from '@/lib/zentrale/types'

const KIND_META: Record<ParsedEntry['kind'], { label: string; icon: LucideIcon }> = {
  event: { label: 'Termin', icon: CalendarDays },
  task: { label: 'Aufgabe', icon: ListTodo },
  transaction: { label: 'Buchung', icon: Wallet },
  note: { label: 'Notiz', icon: StickyNote },
}

function chipsFor(entry: ParsedEntry): string[] {
  const chips: string[] = []

  if (entry.kind === 'event') {
    chips.push(fmtShortDate(entry.date))
    if (entry.time) chips.push(`${entry.time} Uhr`)
    const recurring = entry.recurring ?? (entry.yearly ? 'YEARLY' : 'NONE')
    if (recurring !== 'NONE') chips.push(RECURRING_LABELS[recurring])
    if (entry.priority !== 'MEDIUM') chips.push(PRIORITY_LABELS[entry.priority])
  }

  if (entry.kind === 'task') {
    chips.push(entry.dueDate ? fmtShortDate(entry.dueDate) : 'Ohne Datum')
    if (entry.recurring !== 'NONE') chips.push(RECURRING_LABELS[entry.recurring])
    if (entry.priority !== 'MEDIUM') chips.push(PRIORITY_LABELS[entry.priority])
  }

  if (entry.kind === 'transaction') {
    chips.push(`${entry.type === 'EXPENSE' ? '−' : '+'}${fmtEur(entry.amount)}`)
    chips.push(entry.category)
    if (entry.recurring !== 'NONE') chips.push(RECURRING_LABELS[entry.recurring])
    chips.push(entry.type === 'EXPENSE' ? 'Ausgabe' : 'Einnahme')
  }

  return chips
}

/** Zeigt direkt nach dem Parsen, was die Zentrale verstanden hat – vor dem Speichern korrigierbar. */
export function ParsedPreview({ entry }: { entry: ParsedEntry }) {
  const meta = KIND_META[entry.kind]
  const Icon = meta.icon
  const chips = chipsFor(entry)

  return (
    <div
      key={entry.kind}
      className="animate-view mb-4 rounded-2xl border border-brand/30 bg-brand/[0.06] p-3.5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand" aria-hidden>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
            {meta.label} erkannt
            <CheckCircle2 className="h-3 w-3 text-green-400" aria-hidden />
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{entry.title}</p>
          {entry.kind === 'note' && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{entry.content}</p>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[46px]">
          {chips.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className="animate-rise rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-foreground/85"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 pl-[46px] text-[11px] text-stone-500">Du kannst die Felder unten noch korrigieren.</p>
    </div>
  )
}
