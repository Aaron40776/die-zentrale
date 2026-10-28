'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { AnimatedAmount } from './AnimatedAmount'
import { fmtEur } from '@/lib/zentrale/date'
import { CATEGORY_COLORS } from '@/lib/zentrale/types'
import { cn } from '@/lib/utils'

export interface FlowCategory {
  label: string
  amount: number
  count: number
}

interface Props {
  income: FlowCategory[]
  expenses: FlowCategory[]
  inSum: number
  outSum: number
  activeCategory: string | null
  onCategory: (category: string) => void
}

function pctLabel(amount: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = Math.round((amount / total) * 100)
  return pct === 0 ? '<1%' : `${pct}%`
}

function Bubble({
  category,
  total,
  active,
  onSelect,
}: {
  category: FlowCategory
  total: number
  active: boolean
  onSelect: () => void
}) {
  const max = Math.max(1, total)
  const size = Math.round(44 + Math.sqrt(category.amount / max) * 14)
  const color = CATEGORY_COLORS[category.label] ?? '#a8a29e'
  const percent = pctLabel(category.amount, total)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${category.label}: ${fmtEur(category.amount)} (${percent} der Monatssumme). ${
        active ? 'Filter entfernen' : 'Buchungen filtern'
      }`}
      title={`${category.label}: ${fmtEur(category.amount)} · ${category.count} ${
        category.count === 1 ? 'Buchung' : 'Buchungen'
      }`}
      className={cn(
        'group flex w-[60px] shrink-0 flex-col items-center rounded-xl px-0.5 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70',
        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'
      )}
    >
      <span className="animate-bubble-pop shrink-0" aria-hidden>
        <span
          className={cn(
            'flex items-center justify-center rounded-full border-2 shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95',
            active && 'ring-2 ring-brand/80 ring-offset-2 ring-offset-card'
          )}
          style={{
            width: size,
            height: size,
            borderColor: color,
            background: `radial-gradient(circle at 32% 26%, ${color}42, ${color}12 68%, transparent 72%)`,
          }}
        >
          <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
            {percent}
          </span>
        </span>
      </span>
      <span className={cn('mt-0.5 w-full truncate text-[10px] font-medium', active ? 'text-brand' : 'text-muted-foreground')}>
        {category.label}
      </span>
      <span className="w-full truncate text-[9px] tabular-nums text-stone-500">{fmtEur(category.amount)}</span>
    </button>
  )
}

function Lane({
  type,
  categories,
  total,
  activeCategory,
  onCategory,
}: {
  type: 'INCOME' | 'EXPENSE'
  categories: FlowCategory[]
  total: number
  activeCategory: string | null
  onCategory: (category: string) => void
}) {
  const isIncome = type === 'INCOME'
  const Icon = isIncome ? ArrowDownLeft : ArrowUpRight
  const label = isIncome ? 'Einnahmen' : 'Ausgaben'
  const sign = isIncome ? '+' : '−'

  return (
    <section aria-label={label}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider',
              isIncome ? 'text-green-300' : 'text-red-300'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {categories.length === 0
              ? 'Noch nichts in diesem Monat'
              : `${categories.length} ${categories.length === 1 ? 'Kategorie' : 'Kategorien'}`}
          </p>
        </div>
        <p className={cn('text-base font-bold tabular-nums', isIncome ? 'text-green-300' : 'text-red-300')}>
          {sign}
          <AnimatedAmount value={total} />
        </p>
      </div>

      {categories.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-start gap-x-1 gap-y-1.5">
          {categories.map((category) => (
            <Bubble
              key={`${category.label}-${category.amount}-${category.count}`}
              category={category}
              total={total}
              active={activeCategory === category.label}
              onSelect={() => onCategory(category.label)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-border px-3 py-2 text-[11px] text-stone-500">
          {isIncome ? 'Einnahmen erscheinen hier als grüne Blasen.' : 'Ausgaben erscheinen hier als Blasen.'}
        </p>
      )}
    </section>
  )
}

/**
 * Monatlicher Geldfluss: Kategorien werden zu Blasen aggregiert. Die Größe zeigt
 * den Anteil, ein Tipp filtert die Buchungsliste. Bewusst ohne Dauer-Animation.
 */
export function MoneyFlow({ income, expenses, inSum, outSum, activeCategory, onCategory }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Lane type="INCOME" categories={income} total={inSum} activeCategory={activeCategory} onCategory={onCategory} />

      <div className="my-3.5 flex items-center gap-2" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-500">
          Monatsfluss
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Lane type="EXPENSE" categories={expenses} total={outSum} activeCategory={activeCategory} onCategory={onCategory} />

      <p className="mt-3 text-[11px] text-stone-500">Tippe auf eine Blase, um die Buchungen zu filtern.</p>
    </div>
  )
}
