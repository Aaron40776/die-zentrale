'use client'

import { cn } from '@/lib/utils'
import { weekdayShort } from '@/lib/zentrale/date'
import { TONE_DOT, type Tone } from '@/lib/zentrale/types'

export interface WeekDots {
  tones: Tone[]
  extra: number
}

/** 7-Tage-Streifen: die Woche auf einen Blick, tippbar zum Filtern. */
export function WeekStrip({
  days,
  dotsByIndex,
  selected,
  onSelect,
}: {
  days: Date[]
  dotsByIndex: WeekDots[]
  selected: number | null
  onSelect: (i: number | null) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const isToday = i === 0
        const active = selected === i
        const dots = dotsByIndex[i]?.tones.slice(0, 3) ?? []
        const extra = dotsByIndex[i]?.extra ?? 0
        return (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onSelect(active ? null : i)}
            aria-pressed={active}
            aria-label={isToday ? `Heute, ${d.getDate()}. – ${dots.length + extra} Punkte` : `${weekdayShort(d)}, ${d.getDate()}. – ${dots.length + extra} Punkte`}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border px-1 pb-2 pt-2 transition-all',
              active
                ? 'border-brand bg-brand/10 ring-1 ring-brand'
                : isToday
                  ? 'border-brand/40 bg-card'
                  : 'border-border bg-card hover:border-stone-600'
            )}
          >
            <span className={cn('text-[10px] font-medium uppercase', isToday ? 'text-brand' : 'text-muted-foreground')}>
              {weekdayShort(d)}
            </span>
            <span className={cn('text-sm font-bold tabular-nums', isToday ? 'text-brand' : 'text-foreground')}>
              {d.getDate()}
            </span>
            <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
              {dots.map((t, j) => (
                <span key={j} className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[t])} />
              ))}
              {extra > 0 && <span className="text-[8px] font-semibold leading-none text-stone-500">+{extra}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
