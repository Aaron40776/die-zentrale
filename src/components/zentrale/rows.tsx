'use client'

import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { ArrowRight, Cake, CalendarDays, Check, ChevronRight, MapPin, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayDiff, eventDate, fmtTime } from '@/lib/zentrale/date'
import { PRIORITY_TONE, RECURRING_LABELS, type EventItem, type TaskItem } from '@/lib/zentrale/types'
import { CountdownChip, DoneToggle, PriorityBar, PriorityPip } from './bits'

const TIME_CHIP =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-muted px-2 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground'

/**
 * Wischgesten-Hülle im iOS-Stil: nach rechts wischen = erledigt, nach links = Aktion freigeben.
 * touch-pan-y lässt vertikales Scrollen zu; horizontale Bewegung wird hier verarbeitet.
 */
export function SwipeRow({
  children,
  onComplete,
  onDelete,
}: {
  children: ReactNode
  onComplete?: () => void
  onDelete?: () => void
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const engagedRef = useRef(false)
  const dxRef = useRef(0)

  const canComplete = !!onComplete
  const canDelete = !!onDelete

  function move(v: number) {
    dxRef.current = v
    setDx(v)
  }

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) return
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    engagedRef.current = false
    setDragging(false)
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!startRef.current || e.touches.length !== 1) return
    const t = e.touches[0]
    const mx = t.clientX - startRef.current.x
    const my = t.clientY - startRef.current.y
    if (!engagedRef.current) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        engagedRef.current = true
        setDragging(true)
      } else if (Math.abs(my) > 8) {
        // vertikales Scrollen gewinnt -> Geste abbrechen
        startRef.current = null
        return
      } else {
        return
      }
    }
    let next = mx
    if (next > 0 && !canComplete) next = 0
    if (next < 0 && !canDelete) next = 0
    move(Math.max(-140, Math.min(120, next)))
  }

  function onTouchEnd() {
    if (!startRef.current) return
    startRef.current = null
    setDragging(false)
    if (!engagedRef.current) return
    engagedRef.current = false
    const x = dxRef.current
    if (x > 64 && canComplete) {
      move(0)
      onComplete!()
    } else if (x <= -96 && canDelete) {
      move(0)
      onDelete!()
    } else if (x < -28) {
      move(-72) // offen stehen lassen: Löschknopf antippen
    } else {
      move(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Hintergrund-Ebene: erledigt (rechts wischen) */}
      {canComplete && (
        <div className="absolute inset-y-0 left-0 flex w-28 items-center pl-4" aria-hidden>
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-[#08130a] transition-opacity duration-150',
              dx > 24 ? 'opacity-100' : 'opacity-0'
            )}
          >
            <Check className="h-4.5 w-4.5" strokeWidth={3} />
          </span>
        </div>
      )}
      {/* Hintergrund-Ebene: löschen (links wischen) */}
      {canDelete && (
        <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-end pr-3" aria-hidden={dx >= 0}>
          <button
            type="button"
            tabIndex={dx < 0 ? 0 : -1}
            onClick={onDelete}
            aria-label="Aufgabe löschen"
            className="hit flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition-opacity duration-150"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {/* Vordergrund: folgt dem Finger */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          startRef.current = null
          engagedRef.current = false
          setDragging(false)
          move(0)
        }}
        onClickCapture={(e) => {
          // Zeile ist wisch-offen: erster Tap schließt sie, statt die Aktion darunter auszulösen
          if (dxRef.current !== 0) {
            e.preventDefault()
            e.stopPropagation()
            move(0)
          }
        }}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn('relative touch-pan-y', dragging ? '' : 'transition-transform duration-200 ease-out')}
      >
        {children}
      </div>
    </div>
  )
}

/** Termin-Zeile: farbiger Balken = manuelle Wichtigkeit; Jahrestage mit Torte + Countdown. */
export function EventRow({ event, onEdit, compact }: { event: EventItem; onEdit: () => void; compact?: boolean }) {
  const yearly = event.recurring === 'YEARLY'
  const effDate = eventDate(event)
  const allDay = fmtTime(event.date) === '00:00'
  const sub = event.place ?? event.note
  const diff = dayDiff(effDate)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Termin bearbeiten: ${event.title}${yearly ? ' (jährlich)' : ''}`}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit()
        }
      }}
      className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 pl-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-all duration-150 hover:shadow-[0_2px_10px_rgba(0,0,0,0.4)] active:scale-[0.985]"
    >
      <PriorityBar tone={PRIORITY_TONE[event.priority]} />
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
        {yearly ? <Cake className="h-4 w-4 text-brand" /> : <CalendarDays className="h-4 w-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
        {sub && !compact && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 text-stone-500" aria-hidden />
            <span className="truncate">{sub}</span>
          </p>
        )}
      </div>
      {yearly ? (
        <span
          title={`Jährlich – nächstes Datum: ${new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(effDate)}`}
          className={cn(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums',
            diff === 0 ? 'bg-green-500/15 text-green-400' : 'bg-sky-500/15 text-sky-400'
          )}
        >
          {diff === 0 ? 'heute' : diff === 1 ? 'morgen' : `in ${diff} T.`}
        </span>
      ) : allDay ? (
        <span className={cn(TIME_CHIP)}>ganztägig</span>
      ) : (
        <span className={TIME_CHIP}>{fmtTime(event.date)} Uhr</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-600" aria-hidden />
    </div>
  )
}

/**
 * Aufgaben-Zeile mit Erledigt-Knopf und Countdown-Chip; Routine-Aufgaben mit Wiederholungs-Icon.
 * Überfällige/heutige Aufgaben bekommen den Schnellknopf "auf morgen".
 * Wischgesten: rechts wischen = erledigt, links wischen = löschen (falls onDelete übergeben).
 */
export function TaskRow({
  task,
  onToggle,
  onEdit,
  onSnooze,
  onDelete,
}: {
  task: TaskItem
  onToggle: () => void
  onEdit: () => void
  onSnooze?: () => void
  onDelete?: () => void
}) {
  const snoozable = !!onSnooze && !task.done && !!task.dueDate && dayDiff(new Date(task.dueDate)) <= 0
  return (
    <SwipeRow onComplete={task.done ? undefined : onToggle} onDelete={onDelete}>
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-150 active:scale-[0.985]">
        <DoneToggle done={task.done} onToggle={onToggle} />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Aufgabe bearbeiten: ${task.title}`}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <p className={cn('flex items-center gap-1.5 truncate text-sm font-medium', task.done ? 'text-muted-foreground/70 line-through' : 'text-foreground')}>
            {task.recurring !== 'NONE' && (
              <RefreshCw
                className="h-3 w-3 shrink-0 text-brand"
                aria-label={`Wiederholt sich ${RECURRING_LABELS[task.recurring].toLowerCase()}`}
              />
            )}
            {task.title}
          </p>
        </button>
        {snoozable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSnooze!()
            }}
            title="Auf morgen verschieben"
            aria-label="Aufgabe auf morgen verschieben"
            className="hit flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-brand/15 hover:text-brand"
          >
            morgen
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        )}
        {!task.done && !snoozable && <PriorityPip priority={task.priority} />}
        <CountdownChip iso={task.dueDate} done={task.done} />
      </div>
    </SwipeRow>
  )
}
