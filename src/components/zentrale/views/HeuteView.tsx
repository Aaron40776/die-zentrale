'use client'

import { useState, useSyncExternalStore } from 'react'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, ListTodo, Loader2, Pin, Search, Settings, ShieldCheck, Smartphone, StickyNote, Wallet, X } from 'lucide-react'
import { AnimatedAmount } from '@/components/zentrale/AnimatedAmount'
import { CountdownChip, EmptyHint, SectionTitle, SkeletonRow } from '@/components/zentrale/bits'
import { EventRow, TaskRow } from '@/components/zentrale/rows'
import { SettingsSheet } from '@/components/zentrale/SettingsSheet'
import { addDays, dayDiff, dayKey, eventOccurrences, fmtEur, fmtLongDate, startOfDay } from '@/lib/zentrale/date'
import { forecastLabel, forecastMonthEnd, isPlannedEntry } from '@/lib/zentrale/finance'
import { useLastBackupAt } from '@/lib/zentrale/useBackupStatus'
import type { EditTarget, EventItem, NoteItem, QuickTab, TaskItem, TransactionItem } from '@/lib/zentrale/types'
import { cn } from '@/lib/utils'

interface Props {
  events: EventItem[]
  tasks: TaskItem[]
  transactions: TransactionItem[]
  notes: NoteItem[]
  loading: boolean
  error: string | null
  onNavigate: (v: 'termine' | 'finanzen' | 'aufgaben') => void
  onEdit: (t: EditTarget) => void
  onToggleTask: (t: TaskItem) => void
  onSnoozeTask: (t: TaskItem) => void
  onDeleteTask?: (t: TaskItem) => void
  onQuickAdd: (tab: QuickTab) => void
  /** Fixposten direkt aus der Übersicht buchen. */
  onBookFixed?: (t: TransactionItem) => void
  bookingId?: string | null
  onSearch: () => void
  onRefresh: () => void
}

function isToday(iso: string | null): boolean {
  return !!iso && dayKey(new Date(iso)) === dayKey(new Date())
}

// PWA-Installations-Hinweis als Mini-Store (localStorage ist ein externes System).
const installHintStore = {
  listeners: new Set<() => void>(),
  subscribe(cb: () => void) {
    installHintStore.listeners.add(cb)
    return () => {
      installHintStore.listeners.delete(cb)
    }
  },
  get(): boolean {
    if (typeof window === 'undefined') return false
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    // Nur auf iPhone/iPad zeigen – Desktop und Android bekommen keine iOS-Anleitung.
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const isIOS = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
    return isIOS && !standalone && localStorage.getItem('zentrale-install-hint-done') === null
  },
  dismiss() {
    localStorage.setItem('zentrale-install-hint-done', '1')
    for (const l of installHintStore.listeners) l()
  },
}

/** Fortschritts-Ring: erledigt-heute im Verhältnis zu allem, was jetzt dran ist. */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`Tagesfortschritt ${pct} Prozent`}>
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-brand">{label}</span>
    </div>
  )
}

/** Heute-Fokus: die 5-Sekunden-Übersicht – Hero → Rot → Heute → 7 Tage → Geld → Notizen. */
export function HeuteView({ events, tasks, transactions, notes, loading, error, onNavigate, onEdit, onToggleTask, onSnoozeTask, onDeleteTask, onQuickAdd, onBookFixed, bookingId = null, onSearch, onRefresh }: Props) {
  const today = new Date()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const lastBackupAt = useLastBackupAt()
  const showInstallHint = useSyncExternalStore(installHintStore.subscribe, installHintStore.get, () => false)

  const overdueTasks = tasks
    .filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) < 0)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
  const overdueCount = overdueTasks.length
  const dayStart = startOfDay(today)
  const todayEvents = events
    .flatMap((e) => eventOccurrences(e, dayStart, dayStart).map((occ) => ({ event: e, date: occ })))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const todayTasks = tasks.filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) === 0)
  // Fällige Fixposten (Abos/Miete) – direkt in der Übersicht sichtbar und buchbar.
  const fixedDue = transactions
    .filter((t) => t.recurring !== 'NONE' && t.nextDue && dayDiff(new Date(t.nextDue)) <= 0)
    .sort((a, b) => (a.nextDue! < b.nextDue! ? -1 : 1))
  const overdueFixed = fixedDue.filter((t) => dayDiff(new Date(t.nextDue!)) < 0)
  const todayFixed = fixedDue.filter((t) => dayDiff(new Date(t.nextDue!)) === 0)

  type Upcoming = { kind: 'event'; event: EventItem; date: string; key: string } | { kind: 'task'; task: TaskItem; date: string; key: string }
  const horizonEnd = addDays(dayStart, 7)
  const upcoming: Upcoming[] = [
    ...events
      .flatMap((e) =>
        eventOccurrences(e, addDays(dayStart, 1), horizonEnd).map((occ) => ({
          kind: 'event' as const,
          event: e,
          date: occ.toISOString(),
          key: `e-${e.id}-${occ.getTime()}`,
        }))
      ),
    ...tasks
      .filter((t) => {
        if (t.done || !t.dueDate) return false
        const d = dayDiff(new Date(t.dueDate))
        return d >= 1 && d <= 7
      })
      .map((t) => ({ kind: 'task' as const, task: t, date: t.dueDate!, key: `t-${t.id}` })),
  ]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5)

  const pinned = notes.filter((n) => n.pinned)
  const openCount = tasks.filter((t) => !t.done).length

  const balance = transactions.filter((t) => !isPlannedEntry(t, today)).reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0)
  const fx = forecastMonthEnd(transactions, balance, today)
  const monthKey = dayKey(today).slice(0, 7)
  const monthTx = transactions
    .filter((t) => dayKey(new Date(t.date)).slice(0, 7) === monthKey && !isPlannedEntry(t, today))
  const inSum = monthTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const outSum = monthTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)

  // Tagesfortschritt: erledigt heute vs. alles, was jetzt dran ist (heute fällig + überfällig)
  const doneToday = tasks.filter((t) => t.done && isToday(t.completedAt)).length
  const dueNow = tasks.filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) <= 0).length
  const progressTotal = doneToday + dueNow
  const progressPct = progressTotal > 0 ? Math.round((doneToday / progressTotal) * 100) : 0

  const isCompletelyEmpty =
    events.length === 0 && tasks.length === 0 && transactions.length === 0 && notes.length === 0
  const totalEntries = events.length + tasks.length + transactions.length + notes.length
  const backupAgeDays = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / 86_400_000) : null
  const showBackupHint = !loading && !isCompletelyEmpty && (lastBackupAt === null || (backupAgeDays ?? 0) >= 14)

  // Begrüßung nach Tageszeit
  const hour = today.getHours()
  const greeting = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  const snoozeBtn = (t: TaskItem) => (
    <button
      type="button"
      onClick={() => onSnoozeTask(t)}
      title="Auf morgen verschieben"
      aria-label="Aufgabe auf morgen verschieben"
      className="hit flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-red-200 transition-colors hover:bg-white/20 hover:text-white"
    >
      morgen
      <ArrowRight className="h-3 w-3" aria-hidden />
    </button>
  )

  const todayCount = todayEvents.length + todayTasks.length + todayFixed.length
  const attentionCount = overdueTasks.length + overdueFixed.length

  return (
    <div>
      <header className="mb-4 flex items-center gap-2.5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-deep" aria-hidden>
          <span className="h-4 w-4 rounded-full border-2 border-brand" />
          <span className="absolute h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">Die Zentrale</h1>
          <p className="truncate text-xs text-muted-foreground">Alles an einem Ort</p>
        </div>
        <button
          type="button"
          onClick={onSearch}
          aria-label="Suchen"
          className="hit flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-stone-600 hover:text-foreground"
        >
          <Search className="h-4.5 w-4.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Einstellungen"
          className="hit flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-stone-600 hover:text-foreground"
        >
          <Settings className="h-4.5 w-4.5" aria-hidden />
        </button>
      </header>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={onRefresh} className="hit shrink-0 font-semibold underline underline-offset-2">
            Erneut laden
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow className="h-28" />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isCompletelyEmpty ? (
        /* ---------- Willkommen: die leere Zentrale ---------- */
        <div className="animate-rise rounded-3xl border border-border bg-card p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
          <span className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-deep" aria-hidden>
            <span className="h-7 w-7 rounded-full border-[3px] border-brand" />
            <span className="absolute h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          <h2 className="text-lg font-bold text-foreground">Willkommen in deiner Zentrale</h2>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            Ein Ort für Termine, Aufgaben, Finanzen und Notizen. Alles, was du erfasst, sortiert sich hier automatisch
            nach Dringlichkeit – rot zuerst, Rest leise.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(
              [
                { tab: 'event', label: 'Termin', icon: CalendarDays },
                { tab: 'task', label: 'Aufgabe', icon: ListTodo },
                { tab: 'transaction', label: 'Buchung', icon: Wallet },
                { tab: 'note', label: 'Notiz', icon: StickyNote },
              ] as const
            ).map((c) => (
              <button
                key={c.tab}
                type="button"
                onClick={() => onQuickAdd(c.tab)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-3 text-[12px] font-medium text-foreground transition-colors hover:border-brand/50 hover:bg-brand/10"
              >
                <c.icon className="h-4.5 w-4.5 text-brand" aria-hidden />
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-stone-500">
            Die +-Taste unten öffnet dieselbe Auswahl jederzeit wieder.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* ---------- Hero: der Tag auf einen Blick ---------- */}
          <section aria-label="Heute im Überblick" className="card-gold animate-rise relative overflow-hidden rounded-3xl p-5">
            <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-brand/15 blur-3xl" aria-hidden />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-hero">{greeting}</p>
                <h2 className="mt-0.5 text-[22px] font-bold capitalize leading-tight tracking-tight text-foreground">
                  {fmtLongDate(today)}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-300">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      {overdueCount} überfällig
                    </span>
                  )}
                  {todayCount === 0 && overdueCount === 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-medium text-green-300">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Nichts angesetzt
                    </span>
                  )}
                  {todayEvents.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                      {todayEvents.length} {todayEvents.length === 1 ? 'Termin' : 'Termine'} heute
                    </span>
                  )}
                  {todayTasks.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                      {todayTasks.length} {todayTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'} fällig
                    </span>
                  )}
                  {todayFixed.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                      {todayFixed.length} {todayFixed.length === 1 ? 'Fixposten' : 'Fixposten'} fällig
                    </span>
                  )}
                  {openCount > 0 && (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {openCount} offen gesamt
                    </span>
                  )}
                </div>
              </div>
              {progressTotal > 0 && <ProgressRing pct={progressPct} label={`${doneToday}/${progressTotal}`} />}
            </div>
          </section>

          {showInstallHint && (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-brand/40 bg-brand/10 p-3.5">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">Zentrale auf den Startbildschirm</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  iPhone: Teilen → „Zum Home-Bildschirm“ – läuft dann wie eine echte App, ohne Store.
                </p>
              </div>
              <button
                type="button"
                onClick={installHintStore.dismiss}
                aria-label="Hinweis ausblenden"
                className="hit shrink-0 rounded-full p-1 text-stone-500 transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {showBackupHint && (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">
                  {lastBackupAt === null ? 'Noch kein Backup' : `Letztes Backup vor ${backupAgeDays} Tagen`}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {totalEntries} {totalEntries === 1 ? 'Eintrag liegt' : 'Einträge liegen'} nur in diesem Browser. Ein
                  Export schützt vor Datenverlust, wenn Browserdaten gelöscht werden.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="hit shrink-0 rounded-full bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/25"
              >
                Sichern
              </button>
            </div>
          )}

          {/* ---------- Überfälliges zuerst – die rote Ebene ---------- */}
          {(overdueTasks.length > 0 || overdueFixed.length > 0) && (
            <section aria-label="Überfällig" className="animate-rise mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5" style={{ animationDelay: '60ms' }}>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
                <h2 className="text-[13px] font-bold text-red-300">
                  Braucht jetzt Aufmerksamkeit ({overdueTasks.length + overdueFixed.length})
                </h2>
              </div>
              <ul className="space-y-2">
                {overdueTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5">
                    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-red-500/60" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onEdit({ kind: 'task', task: t })}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-foreground"
                    >
                      {t.title}
                    </button>
                    {snoozeBtn(t)}
                    <CountdownChip iso={t.dueDate} />
                  </li>
                ))}
                {overdueFixed.map((t) => (
                  <li key={`fixed-${t.id}`} className="flex items-center gap-2.5">
                    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <Wallet className="h-4 w-4 text-red-400/70" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('finanzen')}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-foreground"
                    >
                      {t.title}
                      <span className="ml-1.5 text-[11px] font-normal text-red-300">
                        {t.type === 'INCOME' ? '+' : '−'}
                        {fmtEur(t.amount)}
                      </span>
                    </button>
                    <CountdownChip iso={t.nextDue} />
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-4">
                {overdueTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('aufgaben')}
                    className="hit py-1 text-xs font-semibold text-red-300 underline-offset-2 hover:underline"
                  >
                    Aufgaben öffnen
                  </button>
                )}
                {overdueFixed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('finanzen')}
                    className="hit py-1 text-xs font-semibold text-red-300 underline-offset-2 hover:underline"
                  >
                    Finanzen öffnen
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ---------- Heute ---------- */}
          <section aria-label="Heute fällig" className="animate-rise mt-1" style={{ animationDelay: '120ms' }}>
            <SectionTitle>Heute</SectionTitle>
            {todayCount === 0 ? (
              attentionCount > 0 ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                  <p className="text-[13px] text-amber-300">
                    <span className="font-semibold">Heute nichts Neues</span> – aber {attentionCount}{' '}
                    {attentionCount === 1 ? 'Eintrag braucht' : 'Einträge brauchen'} oben Aufmerksamkeit.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-2xl border border-green-500/30 bg-green-500/10 p-3.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" aria-hidden />
                  <p className="text-[13px] text-green-300">
                    <span className="font-semibold">Alles im Plan.</span> Für heute steht nichts mehr an.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-2">
                {todayEvents.map((ev) => (
                  <EventRow key={`${ev.event.id}-${ev.date.getTime()}`} event={ev.event} occurrenceDate={ev.date.toISOString()} onEdit={() => onEdit({ kind: 'event', event: ev.event })} compact />
                ))}
                {todayTasks.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={() => onToggleTask(t)} onEdit={() => onEdit({ kind: 'task', task: t })} onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined} />
                ))}
                {todayFixed.map((t) => (
                  <div key={`fixed-${t.id}`} className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                      <Wallet className="h-4 w-4 text-amber-400" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onEdit({ kind: 'transaction', transaction: t })}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[13px] font-semibold text-foreground">{t.title}</span>
                      <span className="block text-[11px] text-amber-300">
                        {t.type === 'INCOME' ? '+' : '−'}
                        {fmtEur(t.amount)} · Fixposten {t.nextDue && dayDiff(new Date(t.nextDue)) < 0 ? 'überfällig' : 'heute fällig'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onBookFixed?.(t)}
                      disabled={!onBookFixed || bookingId === t.id}
                      className="shrink-0 rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-60"
                    >
                      {bookingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : 'Buchen'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---------- Nächste 7 Tage ---------- */}
          <section aria-label="Nächste 7 Tage" className="animate-rise" style={{ animationDelay: '180ms' }}>
            <SectionTitle
              right={
                <button
                  type="button"
                  onClick={() => onNavigate('termine')}
                  className="hit flex items-center gap-0.5 py-1 text-xs font-semibold text-brand hover:underline"
                >
                  Alle Termine <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            >
              Die nächsten 7 Tage
            </SectionTitle>
            {upcoming.length === 0 ? (
              <EmptyHint icon={CalendarDays} title="Nichts geplant" hint="Tippe auf +, um den nächsten Termin oder die nächste Aufgabe zu erfassen." />
            ) : (
              <div className="space-y-2">
                {upcoming.map((u) =>
                  u.kind === 'event' ? (
                    <EventRow key={u.key} event={u.event} occurrenceDate={u.date} onEdit={() => onEdit({ kind: 'event', event: u.event })} compact showDate />
                  ) : (
                    <TaskRow key={u.key} task={u.task} onToggle={() => onToggleTask(u.task)} onEdit={() => onEdit({ kind: 'task', task: u.task })} onDelete={onDeleteTask ? () => onDeleteTask(u.task) : undefined} />
                  )
                )}
              </div>
            )}
          </section>

          {/* ---------- Finanz-Snapshot ---------- */}
          <section aria-label="Finanzen im Überblick" className="animate-rise" style={{ animationDelay: '240ms' }}>
            <SectionTitle
              right={
                <button
                  type="button"
                  onClick={() => onNavigate('finanzen')}
                  className="hit flex items-center gap-0.5 py-1 text-xs font-semibold text-brand hover:underline"
                >
                  Alle Buchungen <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            >
              Finanzen
            </SectionTitle>
            <button
              type="button"
              onClick={() => onNavigate('finanzen')}
              aria-label="Finanzbereich öffnen"
              className="card-gold relative block w-full overflow-hidden rounded-2xl p-4 text-left shadow-md transition-transform active:scale-[0.99]"
            >
              <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-brand/10 blur-3xl" aria-hidden />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-hero">Aktueller Saldo</span>
                  <Wallet className="h-4 w-4 text-hero" aria-hidden />
                </div>
                <p className={cn('mt-1 text-3xl font-bold tracking-tight', balance >= 0 ? 'text-green-300' : 'text-red-300')}>
                  <AnimatedAmount value={balance} />
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                    <span className="font-semibold text-green-300">{inSum > 0 ? `+${fmtEur(inSum)}` : fmtEur(0)}</span> rein
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                    <span className="font-semibold text-red-300">{outSum > 0 ? `−${fmtEur(outSum)}` : fmtEur(0)}</span> raus
                  </span>
                  {fx.movements > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium',
                        fx.forecast >= 0 ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'
                      )}
                      title="Aktueller Saldo plus alle bis Monatsende geplanten Posten"
                    >
                      Prognose Monatsende <span className="font-semibold">{forecastLabel(fx)}</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          </section>

          {/* ---------- Gepinnte Notizen ---------- */}
          {pinned.length > 0 && (
            <section aria-label="Gepinnte Notizen" className="animate-rise" style={{ animationDelay: '300ms' }}>
              <SectionTitle>Gepinnte Notizen</SectionTitle>
              <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
                {pinned.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onEdit({ kind: 'note', note: n })}
                    className="w-52 shrink-0 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-left transition-transform active:scale-[0.98]"
                  >
                    <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-foreground">
                      <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{n.title}</span>
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{n.content}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        events={events}
        tasks={tasks}
        transactions={transactions}
        notes={notes}
        onImported={onRefresh}
      />
    </div>
  )
}
