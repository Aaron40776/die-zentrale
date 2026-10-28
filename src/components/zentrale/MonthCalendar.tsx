'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayKey } from '@/lib/zentrale/date'
import { TONE_DOT, type Tone } from '@/lib/zentrale/types'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

interface CalendarDay {
  key: string
  date: Date
  inMonth: boolean
}

/**
 * Monatskalender mit Farbpunkten (5-Farben-Logik): das Planungsraster der Termine.
 * Tipp auf einen Tag filtert die Liste darunter, Pfeile blättern den Monat.
 */
export function MonthCalendar({
  selectedKey,
  onSelectDay,
  dots,
}: {
  /** Gewählter Tag als dayKey (YYYY-MM-DD) oder null für "ganze Woche/Monat". */
  selectedKey: string | null
  onSelectDay: (key: string | null) => void
  /** dayKey -> Farbtöne der Einträge an diesem Tag. */
  dots: Map<string, Tone[]>
}) {
  const today = new Date()
  const todayKey = dayKey(today)
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const viewIsCurrentMonth = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth()

  const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(view)

  // Raster: 6 Wochen, Start Montag. Tage außerhalb des Monats gedimmt.
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const gridStart = new Date(first)
  gridStart.setDate(1 - ((first.getDay() + 6) % 7))

  const cells: CalendarDay[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return {
      key: dayKey(d),
      date: d,
      inMonth: d.getMonth() === view.getMonth(),
    }
  })

  function shift(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))
  }

  return (
    <section aria-label="Monatskalender" className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold capitalize text-foreground" aria-live="polite">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Früherer Monat"
            className="hit flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ChevronLeft className="h-4.5 w-4.5" aria-hidden />
          </button>
          {!viewIsCurrentMonth && (
            <button
              type="button"
              onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="hit rounded-lg px-2 py-1.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/10"
            >
              Heute
            </button>
          )}
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Späterer Monat"
            className="hit flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ChevronRight className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5" role="grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-stone-600" role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((c) => {
          const isToday = c.key === todayKey
          const isSelected = c.key === selectedKey
          const dayDots = dots.get(c.key) ?? []
          const shown = dayDots.slice(0, 3)
          const extra = Math.max(0, dayDots.length - 3)
          const body = (
            <>
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium tabular-nums transition-colors',
                  isSelected
                    ? 'bg-brand font-bold text-brand-ink'
                    : isToday
                      ? 'font-bold text-brand ring-1 ring-brand/60'
                      : c.inMonth
                        ? 'text-foreground/90'
                        : 'text-stone-700'
                )}
              >
                {c.date.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                {shown.map((t, j) => (
                  <span key={j} className={cn('h-1 w-1 rounded-full', c.inMonth || isSelected ? TONE_DOT[t] : 'bg-stone-700')} />
                ))}
                {extra > 0 && <span className="text-[8px] font-semibold leading-none text-stone-600">+{extra}</span>}
              </span>
            </>
          )
          if (!c.inMonth) {
            return (
              <div key={c.key} aria-disabled className="flex flex-col items-center gap-0.5 py-1 opacity-45">
                {body}
              </div>
            )
          }
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${c.date.getDate()}. – ${dayDots.length === 1 ? '1 Eintrag' : `${dayDots.length} Einträge`}`}
              onClick={() => onSelectDay(isSelected ? null : c.key)}
              className="hit flex flex-col items-center gap-0.5 rounded-xl py-1 transition-colors hover:bg-white/[0.04]"
            >
              {body}
            </button>
          )
        })}
      </div>
    </section>
  )
}
