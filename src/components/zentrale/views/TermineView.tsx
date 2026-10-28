'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Search } from 'lucide-react'
import { CountdownChip, EmptyHint, SectionTitle, SkeletonRow } from '@/components/zentrale/bits'
import { MonthCalendar } from '@/components/zentrale/MonthCalendar'
import { EventRow, TaskRow } from '@/components/zentrale/rows'
import { addDays, dayDiff, dayKey, eventDate, eventOccurrences, fmtDayLabel } from '@/lib/zentrale/date'
import type { EditTarget, EventItem, TaskItem } from '@/lib/zentrale/types'

interface Props {
  events: EventItem[]
  tasks: TaskItem[]
  loading: boolean
  onEdit: (t: EditTarget) => void
  onToggleTask: (t: TaskItem) => void
  onSnoozeTask: (t: TaskItem) => void
  onDeleteTask?: (t: TaskItem) => void
  /** Öffnet die Schnellerfassung (Termin-Reiter), optional mit dem angetippten Kalendertag. */
  onQuickAdd?: (dateKey?: string) => void
  onSearch?: () => void
}

/** Termine: Monatskalender (Planungsraster) + gruppierte Liste + Überfällig-Block; Jahrestage wandern automatisch mit. */
export function TermineView({ events, tasks, loading, onEdit, onToggleTask, onSnoozeTask, onDeleteTask, onQuickAdd, onSearch }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const today = new Date()

  const overdueTasks = tasks
    .filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) < 0)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))

  /** Termine eines Tages – inklusive der konkreten Ausgabe eines wiederkehrenden Termins. */
  function eventsOn(key: string): { event: EventItem; date: Date }[] {
    const day = new Date(`${key}T12:00:00`)
    if (Number.isNaN(day.getTime())) return []
    return events
      .flatMap((event) => eventOccurrences(event, day, day).map((date) => ({ event, date })))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  const tasksByDay = useMemo(() => {
    const tkMap = new Map<string, TaskItem[]>()
    for (const t of tasks) {
      if (t.done || !t.dueDate) continue
      const k = dayKey(new Date(t.dueDate))
      if (!tkMap.has(k)) tkMap.set(k, [])
      tkMap.get(k)!.push(t)
    }
    return tkMap
  }, [tasks])

  const upcoming = useMemo(() => {
    const start = new Date()
    const end = addDays(start, 13)
    const rows: { key: string; event: EventItem; date: Date }[] = []
    for (const ev of events) {
      for (const occ of eventOccurrences(ev, start, end)) {
        rows.push({ key: `${ev.id}-${occ.getTime()}`, event: ev, date: occ })
      }
    }
    return rows.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events])

  function dayLabel(offset: number, d: Date): string {
    if (offset === 0) return 'Heute'
    if (offset === 1) return 'Morgen'
    return fmtDayLabel(d)
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Termine</h1>
          <p className="text-xs text-muted-foreground">Den Monat im Blick – tippe auf einen Tag zum Filtern.</p>
        </div>
        {onSearch && (
          <button type="button" onClick={onSearch} aria-label="Suchen" className="hit flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-stone-600 hover:text-foreground">
            <Search className="h-4.5 w-4.5" aria-hidden />
          </button>
        )}
      </header>

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow className="h-16" />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div>
          <MonthCalendar selectedKey={selectedKey} onSelectDay={setSelectedKey} events={events} tasks={tasks} />

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
                const evs = eventsOn(selectedKey)
                const tks = tasksByDay.get(selectedKey) ?? []
                if (evs.length === 0 && tks.length === 0) {
                  return (
                    <EmptyHint
                      icon={CalendarDays}
                      title="Freier Tag"
                      hint="An diesem Tag ist nichts geplant."
                      action={onQuickAdd ? { label: 'Termin erfassen', onClick: () => onQuickAdd(selectedKey ?? undefined) } : undefined}
                    />
                  )
                }
                return (
                  <div className="space-y-2">
                    {evs.map(({ event, date }) => (
                      <EventRow
                        key={`${event.id}-${date.getTime()}`}
                        event={event}
                        occurrenceDate={date.toISOString()}
                        onEdit={() => onEdit({ kind: 'event', event })}
                      />
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
              {/* 14 Tage gruppiert – wiederkehrende Termine erscheinen in jeder Periode */}
              {Array.from({ length: 14 }, (_, offset) => {
                const d = addDays(today, offset)
                const k = dayKey(d)
                const evs = upcoming.filter((u) => dayKey(u.date) === k)
                const tks = (tasksByDay.get(k) ?? []).sort((a, b) => dayDiff(new Date(a.dueDate!)) - dayDiff(new Date(b.dueDate!)))
                if (evs.length === 0 && tks.length === 0) return null
                return (
                  <section key={k}>
                    <SectionTitle>{dayLabel(offset, d)}</SectionTitle>
                    <div className="space-y-2">
                      {evs.map((u) => (
                        <EventRow key={u.key} event={u.event} occurrenceDate={u.date.toISOString()} onEdit={() => onEdit({ kind: 'event', event: u.event })} />
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
                        <EventRow key={ev.id} event={ev} onEdit={() => onEdit({ kind: 'event', event: ev })} showDate />
                      ))}
                    </div>
                  </>
                )
              })()}

              {overdueTasks.length === 0 &&
                upcoming.length === 0 &&
                events.filter((e) => dayDiff(eventDate(e)) >= 0 && dayDiff(eventDate(e)) <= 13).length === 0 &&
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
                      action={onQuickAdd ? { label: 'Termin erfassen', onClick: () => onQuickAdd(selectedKey ?? undefined) } : undefined}
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
