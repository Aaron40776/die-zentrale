'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { AnimatedAmount } from './AnimatedAmount'
import { fmtEur } from '@/lib/zentrale/date'
import { CATEGORY_COLORS, type TxType } from '@/lib/zentrale/types'
import { cn } from '@/lib/utils'

export interface FlowCategory {
  label: string
  amount: number
  count: number
}

interface Props {
  type: TxType
  onTypeChange: (type: TxType) => void
  categories: FlowCategory[]
  total: number
  activeCategory: string | null
  onCategory: (category: string) => void
}

const RING_RADIUS = 47
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function pctLabel(amount: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = Math.round((amount / total) * 100)
  return pct === 0 ? '<1%' : `${pct}%`
}

/**
 * Monatsfluss: eine große Summenkugel als Anker, darunter eine gut lesbare
 * Rangliste mit echten Beträgen und proportionalen Blasenbalken. Die Blasen
 * im Ring dienen nur der Verknüpfung – die Namen stehen bewusst in der Liste.
 */
export function MoneyFlow({ type, onTypeChange, categories, total, activeCategory, onCategory }: Props) {
  const isIncome = type === 'INCOME'
  const label = isIncome ? 'Einnahmen' : 'Ausgaben'
  const count = categories.reduce((sum, category) => sum + category.count, 0)
  const top = categories[0]
  const topPct = top ? pctLabel(top.amount, total) : '0%'

  const segments = categories.map((category, index) => {
    const fraction = total > 0 ? category.amount / total : 0
    const start =
      total > 0
        ? categories.slice(0, index).reduce((sum, previous) => sum + previous.amount, 0) / total
        : 0
    return { category, fraction, start }
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-muted/60 p-1" role="group" aria-label="Geldfluss-Art">
          {(['EXPENSE', 'INCOME'] as const).map((option) => {
            const active = type === option
            const Icon = option === 'INCOME' ? ArrowDownLeft : ArrowUpRight
            return (
              <button
                key={option}
                type="button"
                onClick={() => onTypeChange(option)}
                aria-pressed={active}
                className={cn(
                  'hit inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  active
                    ? option === 'INCOME'
                      ? 'bg-green-500/15 text-green-300'
                      : 'bg-red-500/15 text-red-300'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {option === 'INCOME' ? 'Einnahmen' : 'Ausgaben'}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          'animate-bubble-pop relative mx-auto aspect-square w-[min(232px,100%)] rounded-full border border-white/10 bg-[radial-gradient(circle_at_34%_26%,rgba(255,255,255,0.08),rgba(255,255,255,0.015)_46%,rgba(0,0,0,0.18))]',
          isIncome
            ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_24px_70px_-28px_rgba(74,222,128,0.45)]'
            : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_24px_70px_-28px_rgba(248,113,113,0.42)]'
        )}
        role="group"
        aria-label={`${label} im Monat: ${fmtEur(total)}. ${categories.length} ${categories.length === 1 ? 'Kategorie' : 'Kategorien'}.`}
      >
        <div className="pointer-events-none absolute inset-3 rounded-full border border-white/[0.04]" aria-hidden />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="#2b2823" strokeWidth="3.6" />
          {segments.map(({ category, fraction, start }) => {
            const length = fraction * RING_CIRCUMFERENCE
            const visible = Math.max(length - (categories.length > 1 ? 1.4 : 0), 0.5)
            return (
              <circle
                key={category.label}
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke={CATEGORY_COLORS[category.label] ?? '#a8a29e'}
                strokeWidth="3.6"
                strokeDasharray={`${visible} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={-start * RING_CIRCUMFERENCE}
                strokeOpacity={activeCategory && activeCategory !== category.label ? 0.38 : 0.96}
                style={{ transition: 'stroke-dasharray 500ms ease, stroke-dashoffset 500ms ease, stroke-opacity 180ms ease' }}
              />
            )
          })}
        </svg>

        {/* Kleine Farbpunkte auf dem Ring verbinden die Kugel mit den Zeilen darunter. */}
        {segments.map(({ category, fraction, start }) => {
          const angle = ((-90 + (start + fraction / 2) * 360) * Math.PI) / 180
          const left = 50 + RING_RADIUS * Math.cos(angle)
          const topDot = 50 + RING_RADIUS * Math.sin(angle)
          const active = activeCategory === category.label
          return (
            <span
              key={`dot-${category.label}`}
              aria-hidden
              className={cn('pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all', active && 'h-2.5 w-2.5 ring-2 ring-white/50')}
              style={{
                left: `${left}%`,
                top: `${topDot}%`,
                backgroundColor: CATEGORY_COLORS[category.label] ?? '#a8a29e',
                boxShadow: `0 0 10px ${CATEGORY_COLORS[category.label] ?? '#a8a29e'}aa`,
              }}
            />
          )
        })}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[22%] text-center">
          <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', isIncome ? 'text-green-300' : 'text-red-300')}>
            {label}
          </span>
          <span className="mt-0.5 max-w-full text-[clamp(20px,5.5vw,28px)] font-bold leading-none tracking-tight">
            <AnimatedAmount value={total} />
          </span>
          <span className="mt-1 text-[10px] text-stone-500">
            {categories.length} {categories.length === 1 ? 'Kategorie' : 'Kategorien'} · {count} {count === 1 ? 'Buchung' : 'Buchungen'}
          </span>
        </div>
      </div>

      {top && (
        <p className="mt-2 text-center text-[11px] text-stone-500">
          <span className="font-semibold" style={{ color: CATEGORY_COLORS[top.label] ?? '#a8a29e' }}>
            {top.label}
          </span>{' '}
          ist mit {topPct} {isIncome ? 'deine größte Einnahme' : 'dein größter Posten'}.
        </p>
      )}

      {categories.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {categories.map((category, index) => {
            const pct = pctLabel(category.amount, total)
            const share = total > 0 ? (category.amount / total) * 100 : 0
            const active = activeCategory === category.label
            const color = CATEGORY_COLORS[category.label] ?? '#a8a29e'
            return (
              <li key={category.label} className="animate-rise" style={{ animationDelay: `${60 + index * 35}ms` }}>
                <button
                  type="button"
                  onClick={() => onCategory(category.label)}
                  aria-pressed={active}
                  aria-label={`${category.label}: ${fmtEur(category.amount)} (${pct}). ${
                    active ? 'Filter entfernen' : 'Buchungen filtern'
                  }`}
                  className={cn(
                    'hit group relative flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition-all',
                    active
                      ? 'border-brand/60 bg-white/[0.07] shadow-[0_0_0_1px_rgba(212,165,116,0.15)]'
                      : 'border-border/70 bg-muted/20 hover:border-white/20 hover:bg-white/[0.04]'
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-r-2xl transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.max(share, 2.5)}%`,
                      background: `linear-gradient(90deg, ${color}42, ${color}0d)`,
                    }}
                  />
                  <span
                    aria-hidden
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                    style={{ borderColor: `${color}70`, background: `${color}20` }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{category.label}</span>
                    <span className="block text-[10px] text-stone-500">
                      {category.count} {category.count === 1 ? 'Buchung' : 'Buchungen'} · {pct}
                    </span>
                  </span>
                  <AnimatedAmount
                    value={category.amount}
                    className="relative shrink-0 text-[13px] font-bold text-foreground"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-stone-500">
          Keine {isIncome ? 'Einnahmen' : 'Ausgaben'} in diesem Monat.
        </p>
      )}

      <p className="mt-3 text-center text-[11px] text-stone-500">
        {categories.length > 0
          ? 'Tippe auf eine Zeile, um die Buchungen zu filtern. Der Ring zeigt die Anteile.'
          : isIncome
            ? 'Wechsle zu den Ausgaben oder erfasse eine Einnahme.'
            : 'Wechsle zu den Einnahmen oder erfasse eine Ausgabe.'}
      </p>
    </div>
  )
}
