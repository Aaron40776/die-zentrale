'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2 } from 'lucide-react'
import { CountdownChip, EmptyHint, SectionTitle, SkeletonRow } from '@/components/zentrale/bits'
import { MonthCalendar } from '@/components/zentrale/MonthCalendar'
import { EventRow, TaskRow } from '@/components/zentrale/rows'
import { addDays, dayDiff, dayKey, eventDate, fmtDayLabel } from '@/lib/zentrale/date'
import { PRIORITY_TONE, type EditTarget, type EventItem, type TaskItem, type Tone } from '@/lib/zentrale/types'

interface Props {
  events: EventItem[]
  tasks: TaskItem[]
  loading: boolean
  onEdit: (t: EditTarget) => void
  onToggleTask: (t: TaskItem) => void
  onSnoozeTask: (t: TaskItem) => void
  onDeleteTask?: (t: TaskItem) => void
  /** Öffnet die Schnellerfassung (Termin-Reiter) für Aktionen im leeren Zustand. */
  onQuickAdd?: () => void
}

/** Termine: Monatskalender (Planungsraster) + gruppierte Liste + Überfällig-Block; Jahrestage wandern automatisch mit. */
export function TermineView({ events, tasks, loading, onEdit, onToggleTask, onSnoozeTask, onDeleteTask, onQuickAdd }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const today = new Date()

  const overdueTasks = tasks
    .filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) < 0)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))

  const { eventsByDay, tasksByDay, dots } = useMemo(() => {
    const evMap = new Map<string, EventItem[]>()
    for (const ev of events) {
      const k = dayKey(eventDate(ev))
      if (!evMap.has(k)) evMap.set(k, [])
      evMap.get(k)!.push(ev)
    }
    const tkMap = new Map<string, TaskItem[]>()
    for (const t of tasks) {
      if (t.done || !t.dueDate) continue
      const k = dayKey(new Date(t.dueDate))
      if (!tkMap.has(k)) tkMap.set(k, [])
      tkMap.get(k)!.push(t)
    }
    const dotMap = new Map<string, Tone[]>()
    const push = (k: string, tone: Tone) => {
      if (!dotMap.has(k)) dotMap.set(k, [])
      dotMap.get(k)!.push(tone)
    }
    for (const [k, evs] of evMap) for (const e of evs) push(k, PRIORITY_TONE[e.priority])
    for (const [k, tks] of tkMap) for (const t of tks) push(k, dayDiff(new Date(t.dueDate!)) <= 1 ? 'urgent' : 'soon')
    for (const list of dotMap.values()) list.sort((a, b) => (a === 'urgent' ? -1 : b === 'urgent' ? 1 : 0))
    return { eventsByDay: evMap, tasksByDay: tkMap, dots: dotMap }
  }, [events, tasks])

  function dayLabel(offset: number, d: Date): string {
    if (offset === 0) return 'Heute'
    if (offset === 1) return 'Morgen'
    return fmtDayLabel(d)
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Termine</h1>
        <p className="text-xs text-muted-foreground">Den Monat im Blick – tippe auf einen Tag zum Filtern.</p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow className="h-16" />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div>
          <MonthCalendar selectedKey={selectedKey} onSelectDay={setSelectedKey} dots={dots} />

          {/* Überfällige Aufgaben immer oben – die rote Ebene */}
          {overdueTasks.length > 0 && selectedKey === null && (
            <section aria-label="Überfällige Aufgaben" className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
                <h2 className="text-[13px] font-bold text-red-300">Überfällig ({overdueTasks.length})</h2>
              </div>
              <div className="space-y-2">
                {overdueTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5">
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
                    <button
                      type="button"
                      onClick={() => onSnoozeTask(t)}
                      title="Auf morgen verschieben"
                      aria-label="Aufgabe auf morgen verschieben"
                      className="hit flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-red-200 transition-colors hover:bg-white/20 hover:text-white"
                    >
                      morgen
                    </button>
                    <CountdownChip iso={t.dueDate} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedKey ? (
            <>
              <SectionTitle
                right={
                  <button type="button" onClick={() => setSelectedKey(null)} className="hit py-1 text-xs font-semibold text-brand hover:underline">
                    Filter löschen
                  </button>
                }
              >
                {fmtDayLabel(new Date(`${selectedKey}T12:00:00`))}
              </SectionTitle>
              {(() => {
                const evs = eventsByDay.get(selectedKey) ?? []
                const tks = tasksByDay.get(selectedKey) ?? []
                if (evs.length === 0 && tks.length === 0) {
                  return (
                    <EmptyHint
                      icon={CalendarDays}
                      title="Freier Tag"
                      hint="An diesem Tag ist nichts geplant."
                      action={onQuickAdd ? { label: 'Termin erfassen', onClick: onQuickAdd } : undefined}
                    />
                  )
                }
                return (
                  <div className="space-y-2">
                    {evs.map((ev) => (
                      <EventRow key={ev.id} event={ev} onEdit={() => onEdit({ kind: 'event', event: ev })} />
                    ))}
                    {tks.map((t) => (
                      <TaskRow key={t.id} task={t} onToggle={() => onToggleTask(t)} onEdit={() => onEdit({ kind: 'task', task: t })} onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined} />
                    ))}
                  </div>
                )
              })()}
            </>
          ) : (
            <>
              {/* 14 Tage gruppiert */}
              {Array.from({ length: 14 }, (_, offset) => {
                const d = addDays(today, offset)
                const k = dayKey(d)
                const evs = eventsByDay.get(k) ?? []
                const tks = tasksByDay.get(k) ?? []
                if (evs.length === 0 && tks.length === 0) return null
                return (
                  <section key={k}>
                    <SectionTitle>{dayLabel(offset, d)}</SectionTitle>
                    <div className="space-y-2">
                      {evs.map((ev) => (
                        <EventRow key={ev.id} event={ev} onEdit={() => onEdit({ kind: 'event', event: ev })} />
                      ))}
                      {tks.map((t) => (
                        <TaskRow key={t.id} task={t} onToggle={() => onToggleTask(t)} onEdit={() => onEdit({ kind: 'task', task: t })} onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined} />
                      ))}
                    </div>
                  </section>
                )
              })}

              {/* Später */}
              {(() => {
                const later = events
                  .filter((e) => dayDiff(eventDate(e)) > 13)
                  .sort((a, b) => (eventDate(a) < eventDate(b) ? -1 : 1))
                if (later.length === 0) return null
                return (
                  <>
                    <SectionTitle>Später</SectionTitle>
                    <div className="space-y-2">
                      {later.map((ev) => (
                        <EventRow key={ev.id} event={ev} onEdit={() => onEdit({ kind: 'event', event: ev })} />
                      ))}
                    </div>
                  </>
                )
              })()}

              {overdueTasks.length === 0 &&
                events.filter((e) => dayDiff(eventDate(e)) >= 0).length === 0 &&
                tasks.filter((t) => {
                  if (t.done || !t.dueDate) return false
                  const d = dayDiff(new Date(t.dueDate))
                  return d >= 0 && d <= 13
                }).length === 0 && (
                  <div className="mt-4">
                    <EmptyHint
                      icon={CalendarDays}
                      title="Keine Termine"
                      hint="Erfasse deinen ersten Termin – jährliche Wiederholungen (Geburtstage) wandern automatisch mit."
                      action={onQuickAdd ? { label: 'Termin erfassen', onClick: onQuickAdd } : undefined}
                    />
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
