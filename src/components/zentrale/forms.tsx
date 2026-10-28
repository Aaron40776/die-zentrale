'use client'

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { History } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { dayKey, isoFromInput, toInputDate, toInputTime } from '@/lib/zentrale/date'
import { parseAmount } from '@/lib/zentrale/money'
import { CATEGORIES, EVENT_RECURRING, RECURRING_LABELS, TX_RECURRING, type EventItem, type NoteItem, type ParsedEntry, type Priority, type Recurring, type TaskItem, type TransactionItem, type TxType } from '@/lib/zentrale/types'
import { apiSend } from '@/lib/zentrale/useZentrale'
import { PrioritySeg } from './bits'

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-stone-500">{hint}</p>}
    </div>
  )
}

const INPUT_CLS = 'w-full rounded-xl border-border bg-muted/40 text-base text-foreground placeholder:text-stone-500 focus-visible:ring-brand'

export function SaveButton({ saving, label = 'Speichern' }: { saving: boolean; label?: string }) {
  return (
    <Button
      type="submit"
      disabled={saving}
      className="h-11 w-full rounded-xl bg-brand text-[15px] font-semibold text-brand-ink hover:bg-brand/90"
    >
      {saving ? 'Speichert …' : label}
    </Button>
  )
}

function fail(toastFn: ReturnType<typeof useToast>['toast'], msg: string) {
  toastFn({ title: msg, variant: 'destructive' })
}

/** Kompakte Betragsvorschau für Eingabe-Merker-Chips (12,99 € / +2.500 €). */
function fmtSuggestAmount(t: TransactionItem): string {
  const s = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(t.amount)
  return t.type === 'INCOME' ? `+${s} €` : `${s} €`
}

// ---------------- Termin ----------------

export function EventForm({
  initial,
  prefill,
  defaultDate,
  onDone,
}: {
  initial?: EventItem
  prefill?: Extract<ParsedEntry, { kind: 'event' }>
  defaultDate?: string
  onDone: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  const [date, setDate] = useState(toInputDate(initial?.date) || prefill?.date || defaultDate || dayKey(new Date()))
  const [time, setTime] = useState(initial ? toInputTime(initial.date) : (prefill?.time ?? ''))
  const [place, setPlace] = useState(initial?.place ?? prefill?.place ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? prefill?.priority ?? 'MEDIUM')
  const [recurring, setRecurring] = useState<Recurring>(
    initial?.recurring ?? prefill?.recurring ?? (prefill?.yearly ? 'YEARLY' : 'NONE')
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail(toast, 'Bitte einen Titel angeben.')
    const iso = isoFromInput(date, time || undefined)
    if (!iso) return fail(toast, 'Bitte ein gültiges Datum angeben.')
    setSaving(true)
    const payload = {
      title: title.trim(),
      date: iso,
      place: place.trim() || null,
      note: note.trim() || null,
      priority,
      recurring,
    }
    const ok = initial
      ? await apiSend(`/api/events/${initial.id}`, 'PATCH', payload)
      : await apiSend('/api/events', 'POST', payload)
    setSaving(false)
    if (ok) {
      toast({ title: initial ? 'Termin aktualisiert.' : 'Termin gespeichert.' })
      onDone()
    } else {
      fail(toast, 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Zahnarzttermin" className={INPUT_CLS} maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Datum">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field label="Uhrzeit (optional)" hint="Ohne Zeit = ganztägig">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLS} />
        </Field>
      </div>
      <Field
        label="Wiederholung"
        hint={
          recurring === 'YEARLY'
            ? 'Geburtstage & Jahrestage wandern jedes Jahr automatisch mit.'
            : recurring === 'NONE'
              ? 'Einmaliger Termin.'
              : 'Der Termin erscheint automatisch in jeder Periode im Kalender.'
        }
      >
        <Select value={recurring} onValueChange={(v) => setRecurring(v as Recurring)}>
          <SelectTrigger className="w-full rounded-xl border-border bg-muted/40 text-base">
            <SelectValue placeholder="Wiederholung" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_RECURRING.map((r) => (
              <SelectItem key={r} value={r}>
                {RECURRING_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Ort (optional)">
        <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="z. B. Praxis Dr. Weber" className={INPUT_CLS} maxLength={120} />
      </Field>
      <PrioritySeg value={priority} onChange={setPriority} />
      <Field label="Notiz (optional)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mitnehmen, Hinweise …" rows={2} className={cn(INPUT_CLS, 'resize-none')} maxLength={500} />
      </Field>
      <SaveButton saving={saving} />
    </form>
  )
}

// ---------------- Aufgabe ----------------

export function TaskForm({
  initial,
  prefill,
  defaultDate,
  onDone,
}: {
  initial?: TaskItem
  prefill?: Extract<ParsedEntry, { kind: 'task' }>
  defaultDate?: string
  onDone: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  const [dueDate, setDueDate] = useState(toInputDate(initial?.dueDate) || prefill?.dueDate || defaultDate || '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? prefill?.priority ?? 'MEDIUM')
  const [recurring, setRecurring] = useState<Recurring>(initial?.recurring ?? prefill?.recurring ?? 'NONE')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail(toast, 'Bitte einen Titel angeben.')
    const newDue = isoFromInput(dueDate)
    setSaving(true)
    const payload = {
      title: title.trim(),
      dueDate: newDue,
      priority,
      recurring,
      // Nur Titel/Priorität ändern den Monatsanker nicht (z. B. 31.1. bleibt 31.).
      ...(initial?.recurring !== 'NONE' && initial?.dueDate === newDue ? { keepAnchor: true } : {}),
    }
    const ok = initial
      ? await apiSend(`/api/tasks/${initial.id}`, 'PATCH', payload)
      : await apiSend('/api/tasks', 'POST', payload)
    setSaving(false)
    if (ok) {
      toast({ title: initial ? 'Aufgabe aktualisiert.' : 'Aufgabe gespeichert.' })
      onDone()
    } else {
      fail(toast, 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Belege sortieren" className={INPUT_CLS} maxLength={120} />
      </Field>
      <Field label="Fällig am (optional)">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT_CLS} />
      </Field>
      <PrioritySeg value={priority} onChange={setPriority} />
      <Field
        label="Wiederholung"
        hint={recurring !== 'NONE' ? 'Routine: Beim Abhaken wird die nächste Fälligkeit automatisch angelegt.' : 'Einmalige Aufgabe – ohne Wiederholung.'}
      >
        <Select value={recurring} onValueChange={(v) => setRecurring(v as Recurring)}>
          <SelectTrigger className="w-full rounded-xl border-border bg-muted/40 text-base">
            <SelectValue placeholder="Wiederholung" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RECURRING_LABELS) as Recurring[]).map((r) => (
              <SelectItem key={r} value={r}>
                {RECURRING_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <SaveButton saving={saving} />
    </form>
  )
}

// ---------------- Buchung ----------------

export function TransactionForm({
  initial,
  prefill,
  recent,
  onDone,
}: {
  initial?: TransactionItem
  prefill?: Extract<ParsedEntry, { kind: 'transaction' }>
  /** Frühere Buchungen: daraus leitet der Eingabe-Merker die Vorschläge ab. */
  recent?: TransactionItem[]
  onDone: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  const [amount, setAmount] = useState(
    initial ? String(initial.amount).replace('.', ',') : prefill ? String(prefill.amount).replace('.', ',') : ''
  )
  const [type, setType] = useState<TxType>(initial?.type ?? prefill?.type ?? 'EXPENSE')
  const [category, setCategory] = useState(initial?.category ?? prefill?.category ?? 'Lebensmittel')
  const [date, setDate] = useState(toInputDate(initial?.date) || prefill?.date || dayKey(new Date()))
  const [recurring, setRecurring] = useState<Recurring>(initial?.recurring ?? prefill?.recurring ?? 'NONE')

  const catOptions = type === 'INCOME' ? (['Einkommen', 'Sonstiges'] as const) : CATEGORIES.filter((c) => c !== 'Einkommen')

  // Eingabe-Merker: zuletzt genutzte Titel (ohne Dubletten, max. 4, nur im Neu-Modus)
  const suggestions = useMemo(() => {
    if (initial || !recent?.length) return []
    const seen = new Set<string>()
    const out: TransactionItem[] = []
    for (const t of recent) {
      const key = t.title.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(t)
      if (out.length >= 4) break
    }
    return out
  }, [recent, initial])

  /** Vorschlag antippen: Titel, Betrag, Kategorie & Art übernehmen – ein Feld bleibt zum Anpassen. */
  function applySuggestion(s: TransactionItem) {
    setTitle(s.title)
    setAmount(String(s.amount).replace('.', ','))
    setType(s.type)
    setCategory(s.type === 'INCOME' ? 'Einkommen' : s.category === 'Einkommen' ? 'Sonstiges' : s.category)
    setRecurring(TX_RECURRING.includes(s.recurring) ? s.recurring : 'NONE')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail(toast, 'Bitte einen Titel angeben.')
    const value = parseAmount(amount)
    if (!amount || value === null || value <= 0) return fail(toast, 'Bitte einen Betrag größer 0 angeben.')
    const iso = isoFromInput(date)
    if (!iso) return fail(toast, 'Bitte ein gültiges Datum angeben.')
    setSaving(true)
    const payload = { title: title.trim(), amount: value, type, category, date: iso, recurring }
    const ok = initial
      ? await apiSend(`/api/transactions/${initial.id}`, 'PATCH', payload)
      : await apiSend('/api/transactions', 'POST', payload)
    setSaving(false)
    if (ok) {
      toast({ title: initial ? 'Buchung aktualisiert.' : 'Buchung gespeichert.' })
      onDone()
    } else {
      fail(toast, 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Art der Buchung">
        {(
          [
            { v: 'EXPENSE', label: 'Ausgabe', active: 'bg-accent text-red-400 shadow-sm' },
            { v: 'INCOME', label: 'Einnahme', active: 'bg-accent text-green-400 shadow-sm' },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={type === o.v}
            onClick={() => {
              setType(o.v)
              if (o.v === 'INCOME') setCategory('Einkommen')
              else if (category === 'Einkommen') setCategory('Lebensmittel')
            }}
            className={cn(
              'rounded-lg px-2 py-2 text-[13px] font-medium transition-all',
              type === o.v ? o.active : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'INCOME' ? 'z. B. Gehalt' : 'z. B. Wocheneinkauf'} className={INPUT_CLS} maxLength={120} />
      </Field>
      {suggestions.length > 0 && !title && (
        <div className="flex flex-wrap gap-1.5" aria-label="Vorschläge aus früheren Buchungen">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applySuggestion(s)}
              title={`${s.title} · ${fmtSuggestAmount(s)} · ${s.category}`}
              className="hit flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
            >
              <History className="h-3 w-3 shrink-0 text-brand" aria-hidden />
              <span className="truncate">{s.title}</span>
              <span className="shrink-0 tabular-nums text-stone-500">{fmtSuggestAmount(s)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Betrag (€)">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="z. B. 12,99"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Datum">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
        </Field>
      </div>
      <Field label="Kategorie">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full rounded-xl border-border bg-muted/40 text-base">
            <SelectValue placeholder="Kategorie wählen" />
          </SelectTrigger>
          <SelectContent>
            {catOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Wiederholung"
        hint={
          recurring !== 'NONE'
            ? 'Fixposten: Die erste Rate wird bei heutigem Datum direkt gebucht, danach erscheint die nächste Fälligkeit.'
            : 'Einmalige Buchung – wird sofort im Saldo berücksichtigt.'
        }
      >
        <Select value={recurring} onValueChange={(v) => setRecurring(v as Recurring)}>
          <SelectTrigger className="w-full rounded-xl border-border bg-muted/40 text-base">
            <SelectValue placeholder="Wiederholung" />
          </SelectTrigger>
          <SelectContent>
            {TX_RECURRING.map((r) => (
              <SelectItem key={r} value={r}>
                {RECURRING_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <SaveButton saving={saving} />
    </form>
  )
}

// ---------------- Notiz ----------------

export function NoteForm({
  initial,
  prefill,
  onDone,
}: {
  initial?: NoteItem
  prefill?: Extract<ParsedEntry, { kind: 'note' }>
  onDone: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? prefill?.content ?? '')
  const [pinned, setPinned] = useState(initial?.pinned ?? false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail(toast, 'Bitte einen Titel angeben.')
    setSaving(true)
    const payload = { title: title.trim(), content, pinned }
    const ok = initial
      ? await apiSend(`/api/notes/${initial.id}`, 'PATCH', payload)
      : await apiSend('/api/notes', 'POST', payload)
    setSaving(false)
    if (ok) {
      toast({ title: initial ? 'Notiz aktualisiert.' : 'Notiz gespeichert.' })
      onDone()
    } else {
      fail(toast, 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Router & Zugänge" className={INPUT_CLS} maxLength={120} />
      </Field>
      <Field label="Inhalt">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Was willst du festhalten?" rows={6} className={cn(INPUT_CLS, 'min-h-32 resize-none')} maxLength={4000} />
      </Field>
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3">
        <div>
          <p className="text-[13px] font-medium text-foreground">Anheften</p>
          <p className="text-[11px] text-muted-foreground">Klebt oben in der Übersicht.</p>
        </div>
        <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Notiz anheften" />
      </div>
      <SaveButton saving={saving} />
    </form>
  )
}
