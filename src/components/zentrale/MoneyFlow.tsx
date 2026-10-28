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
const BUBBLE_ORBIT = 37.5

function pctLabel(amount: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = Math.round((amount / total) * 100)
  return pct === 0 ? '<1%' : `${pct}%`
}

function bubbleSize(amount: number, total: number): number {
  return Math.round(36 + Math.sqrt(Math.max(0, amount) / Math.max(1, total)) * 12)
}

/**
 * Monatskugel: Die Gesamtsumme steht in der Mitte, die Kategorien liegen als
 * kleine Blasen in der großen Kugel. Der Ring zeigt die Anteile, ein Tipp filtert.
 */
export function MoneyFlow({ type, onTypeChange, categories, total, activeCategory, onCategory }: Props) {
  const isIncome = type === 'INCOME'
  const label = isIncome ? 'Einnahmen' : 'Ausgaben'
  const count = categories.reduce((sum, category) => sum + category.count, 0)

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
          'relative mx-auto aspect-square w-[min(258px,100%)] rounded-full border border-white/10 bg-[radial-gradient(circle_at_34%_26%,rgba(255,255,255,0.08),rgba(255,255,255,0.015)_46%,rgba(0,0,0,0.18))]',
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
                strokeOpacity={activeCategory && activeCategory !== category.label ? 0.45 : 0.95}
              />
            )
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[23%] text-center">
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

        {segments.map(({ category }, index) => {
          // Blasen gleichmäßig verteilen, nicht nach Segmentmitte: Ein großer
          // Posten würde sonst alle kleinen Blasen auf engem Raum zusammendrängen.
          const angle = ((-90 + (index / Math.max(1, segments.length)) * 360) * Math.PI) / 180
          const left = 50 + BUBBLE_ORBIT * Math.cos(angle)
          const top = 50 + BUBBLE_ORBIT * Math.sin(angle)
          const size = bubbleSize(category.amount, total)
          const bubbleColor = CATEGORY_COLORS[category.label] ?? '#a8a29e'
          const active = activeCategory === category.label
          const pct = pctLabel(category.amount, total)

          return (
            <button
              key={`${category.label}-${category.amount}-${category.count}-${index}`}
              type="button"
              onClick={() => onCategory(category.label)}
              aria-pressed={active}
              aria-label={`${category.label}: ${fmtEur(category.amount)} (${pct} der Monatssumme). ${
                active ? 'Filter entfernen' : 'Buchungen filtern'
              }`}
              title={`${category.label}: ${fmtEur(category.amount)} · ${category.count} ${
                category.count === 1 ? 'Buchung' : 'Buchungen'
              }`}
              className="group absolute z-10 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <span className="animate-bubble-pop block" aria-hidden>
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 shadow-[0_5px_18px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95',
                    active && 'ring-2 ring-brand/80 ring-offset-2 ring-offset-card'
                  )}
                  style={{
                    width: size,
                    height: size,
                    borderColor: bubbleColor,
                    background: `radial-gradient(circle at 32% 26%, ${bubbleColor}52, ${bubbleColor}18 68%, rgba(12,11,9,0.55) 74%)`,
                  }}
                >
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: bubbleColor }}>
                    {pct}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {categories.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
          {categories.map((category) => {
            const pct = pctLabel(category.amount, total)
            const active = activeCategory === category.label
            return (
              <li key={category.label}>
                <button
                  type="button"
                  onClick={() => onCategory(category.label)}
                  aria-pressed={active}
                  aria-label={`${category.label}: ${fmtEur(category.amount)} (${pct}). ${
                    active ? 'Filter entfernen' : 'Buchungen filtern'
                  }`}
                  className={cn(
                    'hit flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-white/[0.04]',
                    active ? 'bg-white/[0.06] text-foreground' : 'text-muted-foreground'
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[category.label] ?? '#a8a29e' }}
                  />
                  <span className="min-w-0 flex-1 truncate">{category.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground/80">{fmtEur(category.amount)}</span>
                  <span className="w-8 shrink-0 text-right tabular-nums text-stone-500">{pct}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-center text-[12px] text-stone-500">
          Keine {isIncome ? 'Einnahmen' : 'Ausgaben'} in diesem Monat.
        </p>
      )}

      <p className="mt-3 text-center text-[11px] text-stone-500">
        {categories.length > 0
          ? 'Tippe auf eine Blase oder Zeile, um die Buchungen zu filtern.'
          : isIncome
            ? 'Wechsle zu den Ausgaben oder erfasse eine Einnahme.'
            : 'Wechsle zu den Einnahmen oder erfasse eine Ausgabe.'}
      </p>
    </div>
  )
}
