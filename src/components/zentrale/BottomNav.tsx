'use client'

import { CalendarDays, Home, ListChecks, Plus, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewKind } from '@/lib/zentrale/types'

const NAV: { id: ViewKind; label: string; icon: LucideIcon }[] = [
  { id: 'heute', label: 'Heute', icon: Home },
  { id: 'termine', label: 'Termine', icon: CalendarDays },
  { id: 'finanzen', label: 'Finanzen', icon: Wallet },
  { id: 'aufgaben', label: 'Aufgaben', icon: ListChecks },
]

function NavButton({ item, active, onNavigate }: { item: (typeof NAV)[number]; active: boolean; onNavigate: (v: ViewKind) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={active ? 'page' : undefined}
      className="relative z-10 flex h-full flex-col items-center justify-center gap-1 pt-1"
    >
      <span aria-hidden className="flex h-7 w-12 items-center justify-center rounded-full">
        <item.icon
          className={cn('h-5 w-5 transition-colors', active ? 'text-brand' : 'text-stone-500')}
          strokeWidth={active ? 2.4 : 2}
        />
      </span>
      <span className={cn('text-[10px] font-medium transition-colors', active ? 'text-brand' : 'text-stone-500')}>
        {item.label}
      </span>
    </button>
  )
}

/**
 * Schwebende Glas-Navigation: abgerundete Leinwand mit Unschärfe, die goldene
 * +-Taste ragt hinaus. Homage an iOS-Tab-Bars, aber als eigenes Objekt.
 */
export function BottomNav({
  view,
  onNavigate,
  onAdd,
}: {
  view: ViewKind
  onNavigate: (v: ViewKind) => void
  onAdd: () => void
}) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 select-none px-4 pb-[calc(env(safe-area-inset-bottom)+10px)]"
    >
      <div className="pointer-events-auto relative mx-auto max-w-md sm:max-w-lg">
        {/* Zentrale +-Taste, ragt über die Leinwand hinaus */}
        <div className="absolute -top-6 left-1/2 z-10 -translate-x-1/2">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Neu erfassen"
            className="group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-[var(--fab-a)] via-brand to-[var(--fab-c)] text-brand-ink shadow-[0_10px_28px_-4px_rgb(var(--brand-rgb)/0.45)] ring-4 ring-[#0c0b09] transition-transform duration-150 active:scale-90"
          >
            <Plus className="h-7 w-7 transition-transform duration-200 group-active:rotate-90" strokeWidth={2.6} aria-hidden />
          </button>
        </div>
        {/* Glas-Leinwand */}
        <div className="relative grid h-16 grid-cols-5 items-stretch overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#161310]/85 shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <span
            aria-hidden
            className="motion-nav-pill pointer-events-none absolute inset-y-0 left-0 z-0 flex w-1/5 flex-col items-center justify-center gap-1 pt-1"
            style={{ transform: `translate3d(${{ heute: 0, termine: 1, finanzen: 3, aufgaben: 4 }[view] * 100}%, 0, 0)` }}
          >
            <span className="h-7 w-12 rounded-full bg-brand/15" />
            <span className="invisible text-[10px] font-medium" aria-hidden>.</span>
          </span>
          <NavButton item={NAV[0]} active={view === 'heute'} onNavigate={onNavigate} />
          <NavButton item={NAV[1]} active={view === 'termine'} onNavigate={onNavigate} />
          <div aria-hidden />
          <NavButton item={NAV[2]} active={view === 'finanzen'} onNavigate={onNavigate} />
          <NavButton item={NAV[3]} active={view === 'aufgaben'} onNavigate={onNavigate} />
        </div>
      </div>
    </nav>
  )
}
