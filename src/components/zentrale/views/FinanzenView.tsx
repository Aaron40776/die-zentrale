'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, PiggyBank, RefreshCw, Search, Wallet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EmptyHint, SectionTitle, SkeletonRow } from '@/components/zentrale/bits'
import { DonutChart } from '@/components/zentrale/DonutChart'
import { TrendChart } from '@/components/zentrale/TrendChart'
import { dayDiff, dayKey, fmtEur } from '@/lib/zentrale/date'
import { forecastLabel, forecastMonthEnd, isPlannedEntry, monthlyEquivalent } from '@/lib/zentrale/finance'
import { getBudget, setBudget as saveLocalBudget } from '@/lib/zentrale/localdb'
import { parseAmount } from '@/lib/zentrale/money'
import { CATEGORY_COLORS, RECURRING_LABELS, type EditTarget, type TransactionItem } from '@/lib/zentrale/types'

import { cn } from '@/lib/utils'

interface Props {
  transactions: TransactionItem[]
  loading: boolean
  onEdit: (t: EditTarget) => void
  /** Nach jeder Änderung (z. B. Fixposten gebucht) die globalen Daten neu laden. */
  onChanged?: () => void
  /** Öffnet die Schnellerfassung (für die Aktionsfläche im leeren Zustand). */
  onQuickAdd?: () => void
  /** Fixposten einbuchen (zentral in page.tsx, damit auch die Heute-Ansicht buchen kann). */
  onBookFixed?: (t: TransactionItem) => void
  bookingId?: string | null
  onSearch?: () => void
}

type Filter = 'alle' | 'INCOME' | 'EXPENSE'

/** Finanzen: Saldo, Monatsbilanz mit Monatsnavigation, 6-Monats-Verlauf, Kategorien-Donut, Budget, Fixposten & Buchungen. */
export function FinanzenView({ transactions, loading, onEdit, onChanged, onQuickAdd, onBookFixed, bookingId = null, onSearch }: Props) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<Filter>('alle')
  const [monthOffset, setMonthOffset] = useState(0) // 0 = laufender Monat

  // Monatsbudget
  const [budget, setBudget] = useState<number | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)

  useEffect(() => {
    let alive = true
    getBudget()
      .then((amount) => {
        if (alive) setBudget(amount)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // Budget nach Import/Refresh erneut lesen; die Transaktionsliste ändert dabei ihre Identität.
  }, [transactions])

  function openBudgetDialog() {
    setBudgetInput(budget !== null ? String(budget).replace('.', ',') : '')
    setBudgetOpen(true)
  }

  async function saveBudget() {
    const value = parseAmount(budgetInput)
    if (!budgetInput.trim() || value === null || value <= 0) {
      toast({ title: 'Bitte einen gültigen Betrag angeben.', variant: 'destructive' })
      return
    }
    setBudgetSaving(true)
    try {
      await saveLocalBudget(value)
      setBudget(Math.round(value * 100) / 100)
      setBudgetOpen(false)
      toast({ title: 'Budget gespeichert.', description: `Ausgabengrenze: ${fmtEur(value)} pro Monat.` })
    } catch {
      toast({ title: 'Budget konnte nicht gespeichert werden.', variant: 'destructive' })
    } finally {
      setBudgetSaving(false)
    }
  }

  async function clearBudget() {
    setBudgetSaving(true)
    try {
      await saveLocalBudget(null)
      setBudget(null)
      setBudgetOpen(false)
      toast({ title: 'Budget entfernt.' })
    } catch {
      toast({ title: 'Budget konnte nicht entfernt werden.', variant: 'destructive' })
    } finally {
      setBudgetSaving(false)
    }
  }

  const now = new Date()
  const balance = transactions.filter((t) => !isPlannedEntry(t, now)).reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0)

  // Gewählter Monat (Monatsnavigation)
  const viewMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
  const monthKey = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(viewMonth)
  const monthShortLabel = new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(viewMonth)
  const monthTx = transactions.filter((t) => dayKey(new Date(t.date)).slice(0, 7) === monthKey)
  // Geplante (zukünftige) Einmal-Buchungen zählen erst, wenn sie gebucht sind.
  const bookedMonthTx = monthTx.filter((t) => !isPlannedEntry(t, now))
  const inSum = bookedMonthTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const outSum = bookedMonthTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
  const monthNet = inSum - outSum

  const sliceMap = new Map<string, number>()
  for (const t of bookedMonthTx.filter((x) => x.type === 'EXPENSE' && x.category !== 'Einkommen')) {
    sliceMap.set(t.category, (sliceMap.get(t.category) ?? 0) + t.amount)
  }
  const slices = [...sliceMap.entries()].sort((a, b) => b[1] - a[1])

  const fx = forecastMonthEnd(transactions, balance)

  // Budget-Fortschritt nur im laufenden Monat sinnvoll. Geplante Posten zählen
  // mit: Sonst stünde die Ampel auf Grün, obwohl die Miete noch abgeht.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeftInMonth = Math.max(1, daysInMonth - now.getDate() + 1)
  const budgetOut = outSum + fx.plannedOut
  const budgetPct = budget && budget > 0 ? Math.round((budgetOut / budget) * 100) : 0
  const budgetBarPct = Math.min(100, budgetPct)
  const overBudget = budget !== null && budgetOut > budget
  const budgetBar = overBudget ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-400' : 'bg-green-500'

  const fixed = transactions
    .filter((t) => t.recurring !== 'NONE')
    .sort((a, b) => {
      const an = a.nextDue ? dayDiff(new Date(a.nextDue)) : 9999
      const bn = b.nextDue ? dayDiff(new Date(b.nextDue)) : 9999
      return an - bn
    })
  const fixedMonthly = fixed
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + monthlyEquivalent(t), 0)
  const budgetLeft = budget !== null ? budget - budgetOut : 0

  // Vergangene 6 Monate – gibt es überhaupt Daten, sonst Chart weglassen
  const hasHistory = transactions.some((t) => {
    if (isPlannedEntry(t, now)) return false
    const d = new Date(t.date)
    const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
    return diffMonths >= 0 && diffMonths <= 5
  })

  const list = monthTx
    .filter((t) => t.recurring === 'NONE')
    .filter((t) => filter === 'alle' || t.type === filter)
    .sort((a, b) => (a.date > b.date ? -1 : 1))

  // Gruppierung nach Tag (absteigend)
  const groups: { label: string; items: TransactionItem[] }[] = []
  for (const t of list) {
    const k = dayKey(new Date(t.date))
    const diff = dayDiff(new Date(t.date))
    const label = diff === 0 ? 'Heute' : diff === -1 ? 'Gestern' : new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(t.date))
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(t)
    else groups.push({ label, items: [t] })
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Finanzen</h1>
          <p className="text-xs text-muted-foreground">Saldo, Budget und alle Buchungen an einem Ort.</p>
        </div>
        {onSearch && (
          <button type="button" onClick={onSearch} aria-label="Suchen" className="hit flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-stone-600 hover:text-foreground">
            <Search className="h-4.5 w-4.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={openBudgetDialog}
          aria-label="Monatsbudget festlegen"
          title="Monatsbudget festlegen"
          className={cn(
            'hit flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-card transition-colors',
            budget !== null
              ? 'border-brand/50 text-brand'
              : 'border-border text-muted-foreground hover:border-stone-600 hover:text-foreground'
          )}
        >
          <PiggyBank className="h-4.5 w-4.5" aria-hidden />
        </button>
      </header>

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow className="h-28" />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div>
          {/* Saldo-Karte */}
          <section aria-label="Saldo" className="card-gold relative overflow-hidden rounded-2xl p-4 shadow-md">
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-brand/10 blur-3xl" aria-hidden />
            <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-hero">Aktueller Saldo</span>
              <Wallet className="h-4 w-4 text-hero" aria-hidden />
            </div>
            <p className={cn('mt-1 text-3xl font-bold tabular-nums tracking-tight', balance >= 0 ? 'text-green-300' : 'text-red-300')}>
              {fmtEur(balance)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                <span className="font-semibold text-green-300">{inSum > 0 ? `+${fmtEur(inSum)}` : fmtEur(0)}</span> {monthOffset === 0 ? 'ein · Monat' : `ein · ${monthShortLabel}`}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                <span className="font-semibold text-red-300">{outSum > 0 ? `−${fmtEur(outSum)}` : fmtEur(0)}</span> {monthOffset === 0 ? 'aus · Monat' : `aus · ${monthShortLabel}`}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium',
                  monthNet >= 0 ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'
                )}
              >
                Bilanz {monthOffset === 0 ? 'Monat' : monthLabel.split(' ')[0]}{' '}
                <span className="font-semibold">{monthNet >= 0 ? '+' : '−'}{fmtEur(Math.abs(monthNet))}</span>
              </span>
              {fixedMonthly > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-hero-2">
                  Grundlast {fmtEur(fixedMonthly)}/M.
                </span>
              )}
              {monthOffset === 0 && budget === null && (
                <button
                  type="button"
                  onClick={openBudgetDialog}
                  className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/20"
                >
                  Monatsbudget festlegen
                </button>
              )}
              {monthOffset === 0 && fx.movements > 0 && (
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

            {/* Monatsbudget mit Fortschrittsbalken */}
            {budget !== null && monthOffset === 0 && (
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-hero-2">
                  <span className="flex items-center gap-1">
                    <PiggyBank className="h-3.5 w-3.5 text-hero" aria-hidden />
                    Budget {monthLabel.split(' ')[0]}
                  </span>
                  <span className="tabular-nums" title="Gebuchte Ausgaben plus noch geplante Posten">
                    {fmtEur(budgetOut)} von {fmtEur(budget)} ({budgetPct} %)
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={budgetBarPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Ausgaben und geplante Posten im Vergleich zum Monatsbudget"
                >
                  <div className={cn('h-full rounded-full transition-all', budgetBar)} style={{ width: `${budgetBarPct}%` }} />
                </div>
                {overBudget ? (
                  <p className="mt-1.5 text-[11px] font-medium text-red-300">
                    Budget um {fmtEur(Math.abs(budgetLeft))} überschritten – Restmonat so günstig wie möglich halten.
                  </p>
                ) : budgetLeft === 0 ? (
                  <p className="mt-1.5 text-[11px] font-medium text-amber-300">Budget genau aufgebraucht – keine weiteren Ausgaben einplanen.</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-hero-2">
                    Noch <span className="font-semibold">{fmtEur(budgetLeft)}</span> verfügbar · {fmtEur(budgetLeft / Math.max(1, daysLeftInMonth))} pro Tag
                  </p>
                )}
              </div>
            )}
            </div>
          </section>

          {/* 6-Monats-Verlauf */}
          {hasHistory && (
            <div className="mt-4">
              <TrendChart transactions={transactions} />
            </div>
          )}

          {/* Donut mit Monatsnavigation */}
          <SectionTitle
            right={
              <div className="flex items-center gap-1" role="group" aria-label="Monat wählen">
                <button
                  type="button"
                  onClick={() => setMonthOffset((o) => o + 1)}
                  aria-label="Früherer Monat"
                  className="hit flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-stone-600 hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <span className="min-w-[7.5rem] text-center text-xs font-semibold text-foreground" aria-live="polite">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
                  disabled={monthOffset === 0}
                  aria-label="Späterer Monat"
                  className="hit flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors enabled:hover:border-stone-600 enabled:hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            }
          >
            Ausgaben nach Kategorie
          </SectionTitle>
          {slices.length === 0 ? (
            <EmptyHint
              icon={Wallet}
              title="Keine Ausgaben"
              hint={monthOffset === 0 ? 'Erfasse deine erste Ausgabe dieses Monats.' : `Keine Ausgaben in ${monthLabel}.`}
              action={monthOffset === 0 && onQuickAdd ? { label: 'Ausgabe erfassen', onClick: onQuickAdd } : undefined}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              <DonutChart slices={slices.map(([label, amount]) => ({ label, amount, color: CATEGORY_COLORS[label] ?? '#a8a29e' }))} />
            </div>
          )}

          {/* Fixposten & Abos */}
          <SectionTitle right={
            fixed.filter((f) => f.type === 'EXPENSE').length > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                {fmtEur(fixedMonthly)} p.M.
              </span>
            ) : undefined
          }>
            Fixposten &amp; Abos
          </SectionTitle>
          {fixed.length === 0 ? (
            <EmptyHint icon={RefreshCw} title="Keine Fixposten" hint="Wiederkehrende Buchungen (z. B. Miete, Netflix) erscheinen hier." />
          ) : (
            <div className="space-y-2">
              {fixed.map((t) => {
                const dueDiff = t.nextDue ? dayDiff(new Date(t.nextDue)) : null
                const dueNow = dueDiff !== null && dueDiff <= 0
                return (
                  <div
                    key={t.id}
                    className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card p-2.5 pl-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                  >
                    <button
                      type="button"
                      onClick={() => onEdit({ kind: 'transaction', transaction: t })}
                      aria-label={`Fixposten bearbeiten: ${t.title}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${CATEGORY_COLORS[t.category] ?? '#a8a29e'}1a` }}
                      >
                        <RefreshCw className="h-4 w-4" style={{ color: CATEGORY_COLORS[t.category] ?? '#a8a29e' }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{t.title}</span>
                        <span className={cn('block text-xs', dueNow ? 'font-semibold text-amber-400' : 'text-muted-foreground')}>
                          {RECURRING_LABELS[t.recurring]}
                          {dueDiff !== null && (
                            <>
                              {' · '}
                              {dueDiff < 0
                                ? `${-dueDiff} ${-dueDiff === 1 ? 'Tag' : 'Tage'} überfällig`
                                : dueDiff === 0
                                  ? 'heute fällig'
                                  : dueDiff === 1
                                    ? 'morgen fällig'
                                    : `nächste Fälligkeit in ${dueDiff} T.`}
                            </>
                          )}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-sm font-semibold tabular-nums', t.type === 'INCOME' ? 'text-green-400' : 'text-foreground')}>
                        {t.type === 'INCOME' ? '+' : '−'}
                        {fmtEur(t.amount)}
                      </span>
                      {!dueNow && <ChevronRight className="h-4 w-4 shrink-0 text-stone-600" aria-hidden />}
                    </button>
                    {dueNow ? (
                      <button
                        type="button"
                        onClick={() => onBookFixed?.(t)}
                        aria-label={`${t.title} jetzt für heute buchen`}
                        disabled={bookingId !== null}
                        className="hit flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand px-3 text-[12px] font-bold text-brand-ink transition-transform active:scale-95 disabled:opacity-60"
                      >
                        {bookingId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                        )}
                        Buchen
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {/* Buchungen des gewählten Monats */}
          <SectionTitle right={
            monthOffset === 0 ? undefined : (
              <button type="button" onClick={() => setMonthOffset(0)} className="hit py-1 text-xs font-semibold text-brand hover:underline">
                Zurück zum aktuellen Monat
              </button>
            )
          }>
            Buchungen · {monthLabel}
          </SectionTitle>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Buchungen filtern">
            {(
              [
                { v: 'alle', label: 'Alle' },
                { v: 'INCOME', label: 'Einnahmen' },
                { v: 'EXPENSE', label: 'Ausgaben' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                role="tab"
                aria-selected={filter === o.v}
                onClick={() => setFilter(o.v)}
                className={cn(
                  'rounded-lg px-2 py-1.5 text-[13px] font-medium transition-all',
                  filter === o.v ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyHint
              icon={Wallet}
              title="Keine Buchungen"
              hint={monthOffset === 0 ? 'Erfasse eine Einnahme oder Ausgabe – in zwei Sekunden erledigt.' : `Für ${monthLabel} sind keine Buchungen erfasst.`}
              action={monthOffset === 0 && onQuickAdd ? { label: 'Buchung erfassen', onClick: onQuickAdd } : undefined}
            />
          ) : (
            groups.map((g) => (
              <section key={g.label}>
                <h3 className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{g.label}</h3>
                <div className="space-y-2">
                  {g.items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onEdit({ kind: 'transaction', transaction: t })}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                    >
                      <span aria-hidden className="h-8 w-8 shrink-0 rounded-xl" style={{ backgroundColor: `${CATEGORY_COLORS[t.category] ?? '#a8a29e'}22` }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{t.title}</span>
                        <span className="block text-[11px] text-stone-500">
                          {t.category}
                          {t.recurring !== 'NONE' ? ` · ${RECURRING_LABELS[t.recurring]}` : ''}
                          {dayDiff(new Date(t.date)) > 0 ? ' · geplant' : ''}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-sm font-semibold tabular-nums', t.type === 'INCOME' ? 'text-green-400' : 'text-foreground')}>
                        {t.type === 'INCOME' ? '+' : '−'}
                        {fmtEur(t.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* Monatsbudget-Dialog */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="max-w-xs rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>Monatsbudget</DialogTitle>
            <DialogDescription>Wie viel willst du pro Monat maximal ausgeben? Die Ausgaben des laufenden Monats werden dagegen gestellt.</DialogDescription>
          </DialogHeader>
          <Input
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            inputMode="decimal"
            placeholder="z. B. 450"
            className="w-full rounded-xl border-border bg-muted/40 text-base text-foreground placeholder:text-stone-500 focus-visible:ring-brand"
            maxLength={10}
            aria-label="Budgetbetrag in Euro"
          />
          <div className="flex gap-2">
            {budget !== null && (
              <Button
                type="button"
                variant="outline"
                disabled={budgetSaving}
                onClick={clearBudget}
                className="flex-1 rounded-xl border-border text-muted-foreground hover:text-foreground"
              >
                Entfernen
              </Button>
            )}
            <Button
              type="button"
              disabled={budgetSaving}
              onClick={saveBudget}
              className="flex-1 rounded-xl bg-brand text-[15px] font-semibold text-brand-ink hover:bg-brand/90"
            >
              {budgetSaving ? 'Speichert …' : 'Speichern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
