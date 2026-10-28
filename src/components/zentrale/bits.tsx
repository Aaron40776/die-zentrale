'use client'

import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { dueInfo } from '@/lib/zentrale/date'
import { PRIORITY_LABELS, PRIORITY_TONE, TONE_BAR, TONE_CHIP, TONE_DOT, type Priority, type Tone } from '@/lib/zentrale/types'

/** Countdown-Badge: "heute fällig", "in 3 Tagen", "2 T. überfällig" ... */
export function CountdownChip({ iso, done, className }: { iso: string | null; done?: boolean; className?: string }) {
  const info = dueInfo(iso, done ?? false)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        TONE_CHIP[info.tone],
        className
      )}
    >
      {info.label}
    </span>
  )
}

export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TONE_DOT[tone], className)} />
}

export function PriorityPip({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      aria-label={`Wichtigkeit: ${PRIORITY_LABELS[priority]}`}
      title={`Wichtigkeit: ${PRIORITY_LABELS[priority]}`}
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[PRIORITY_TONE[priority]], className)}
    />
  )
}

export function PriorityBar({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('absolute inset-y-2 left-0 w-1 rounded-full', TONE_BAR[tone], className)} />
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {right}
    </div>
  )
}

export function EmptyHint({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon
  title: string
  hint: string
  /** Optionale Direktaktion direkt im leeren Zustand (z. B. gleich erfassen). */
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10" aria-hidden>
        <Icon className="h-5 w-5 text-brand/80" />
      </span>
      <p className="text-sm font-medium text-foreground/90">{title}</p>
      <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="hit mt-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-bold text-brand-ink transition-transform active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          {action.label}
        </button>
      )}
    </div>
  )
}

interface SegOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/** Segment-Schalter (iOS-Stil) für Tabs und Filter. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 rounded-xl bg-muted p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-all',
              active ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.icon && <o.icon className="h-4 w-4" aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const PRIORITY_ACTIVE: Record<Priority, string> = {
  HIGH: 'border-red-500/50 bg-red-500/15 text-red-300',
  MEDIUM: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  LOW: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
}

/** 3-Stufen-Wichtigkeit (Hoch/Mittel/Niedrig) mit Farblogik. */
export function PrioritySeg({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const opts: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Wichtigkeit</span>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Wichtigkeit">
        {opts.map((p) => {
          const active = p === value
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(p)}
              className={cn(
                'rounded-lg border px-2 py-2 text-[13px] font-medium transition-all',
                active ? PRIORITY_ACTIVE[p] : 'border-border bg-card text-muted-foreground hover:border-stone-600'
              )}
            >
              {PRIORITY_LABELS[p]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Runder Erledigt-Knopf (Aufgaben). */
export function DoneToggle({ done, onToggle, className }: { done: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'hit flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        done ? 'border-green-500 bg-green-500 text-[#08130a]' : 'border-stone-600 bg-transparent hover:border-stone-400',
        className
      )}
    >
      {done && (
        <svg viewBox="0 0 24 24" className="check-draw h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

/** Skelett-Zeile für Ladezustand. */
export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('h-16 animate-pulse rounded-2xl bg-muted', className)} />
}
