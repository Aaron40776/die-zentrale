'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ListTodo, MoveHorizontal, Pin, StickyNote, X } from 'lucide-react'
import { EmptyHint, SectionTitle, Segmented, SkeletonRow } from '@/components/zentrale/bits'
import { TaskRow } from '@/components/zentrale/rows'
import { dayDiff, fmtShortDate } from '@/lib/zentrale/date'
import type { EditTarget, NoteItem, QuickTab, TaskItem } from '@/lib/zentrale/types'
import { cn } from '@/lib/utils'

interface Props {
  tasks: TaskItem[]
  notes: NoteItem[]
  loading: boolean
  onEdit: (t: EditTarget) => void
  onToggleTask: (t: TaskItem) => void
  onSnoozeTask: (t: TaskItem) => void
  onDeleteTask?: (t: TaskItem) => void
  /** Öffnet die Schnellerfassung mit passendem Reiter (für Aktionen im leeren Zustand). */
  onQuickAdd?: (tab: QuickTab) => void
}

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

/** Aufgaben & Notizen: Erledigt-Mechanik + angeheftete Notizen oben. */
export function AufgabenView({ tasks, notes, loading, onEdit, onToggleTask, onSnoozeTask, onDeleteTask, onQuickAdd }: Props) {
  const [tab, setTab] = useState<'aufgaben' | 'notizen'>('aufgaben')
  const [showDone, setShowDone] = useState(false)
  // Wisch-Geste einmalig zeigen, bis sie weggeklickt wird (pro Gerät gemerkt)
  const [swipeHint, setSwipeHint] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (localStorage.getItem('zentrale-swipe-hint') !== 'off') setSwipeHint(true)
      } catch {
        /* localStorage nicht verfügbar -> Hinweis einfach zeigen */
      }
    })
  }, [])

  function dismissSwipeHint() {
    setSwipeHint(false)
    try {
      localStorage.setItem('zentrale-swipe-hint', 'off')
    } catch {
      /* ignorieren */
    }
  }

  const { open, done, overdueCount, todayCount } = useMemo(() => {
    const openList = tasks.filter((t) => !t.done)
    const doneList = tasks.filter((t) => t.done)
    openList.sort((a, b) => {
      const da = a.dueDate ? dayDiff(new Date(a.dueDate)) : 9999
      const db = b.dueDate ? dayDiff(new Date(b.dueDate)) : 9999
      if (da !== db) return da - db
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    })
    doneList.sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1))
    return {
      open: openList,
      done: doneList,
      overdueCount: openList.filter((t) => t.dueDate && dayDiff(new Date(t.dueDate)) < 0).length,
      todayCount: openList.filter((t) => t.dueDate && dayDiff(new Date(t.dueDate)) === 0).length,
    }
  }, [tasks])

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => (a.pinned === b.pinned ? (a.updatedAt > b.updatedAt ? -1 : 1) : a.pinned ? -1 : 1)),
    [notes]
  )

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Aufgaben &amp; Notizen</h1>
        <p className="text-xs text-muted-foreground">Abhaken, planen und Wichtiges festhalten.</p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div>
          <Segmented<'aufgaben' | 'notizen'>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'aufgaben', label: 'Aufgaben', icon: ListTodo },
              { value: 'notizen', label: 'Notizen', icon: StickyNote },
            ]}
            className="mb-4"
          />

          {tab === 'aufgaben' ? (
            <div>
              {/* Status-Zeile */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {open.length} offen
                </span>
                {overdueCount > 0 && (
                  <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400">
                    {overdueCount} überfällig
                  </span>
                )}
                {todayCount > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                    {todayCount} heute fällig
                  </span>
                )}
                {done.length > 0 && (
                  <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-medium text-green-400">
                    {done.length} erledigt
                  </span>
                )}
              </div>

              {open.length === 0 ? (
                <EmptyHint
                  icon={Check}
                  title="Alles erledigt!"
                  hint="Erfasse deine nächste Aufgabe – mit Frist, damit sie rot blinkt, wenn es drängt."
                  action={onQuickAdd ? { label: 'Aufgabe erfassen', onClick: () => onQuickAdd('task') } : undefined}
                />
              ) : (
                <div className="space-y-2">
                  {open.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() => onToggleTask(t)}
                      onEdit={() => onEdit({ kind: 'task', task: t })}
                      onSnooze={() => onSnoozeTask(t)}
                      onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined}
                    />
                  ))}
                </div>
              )}

              {done.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDone((s) => !s)}
                    aria-expanded={showDone}
                    className="hit mt-4 py-1 text-xs font-semibold text-stone-500 underline-offset-2 hover:underline"
                  >
                    {showDone ? 'Erledigte ausblenden' : `Erledigte anzeigen (${done.length})`}
                  </button>
                  {showDone && (
                    <div className="mt-2 space-y-2">
                      {done.map((t) => (
                        <TaskRow key={t.id} task={t} onToggle={() => onToggleTask(t)} onEdit={() => onEdit({ kind: 'task', task: t })} onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Wisch-Hinweis: einmalig, bis er weggeklickt wird */}
              {swipeHint && open.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
                  <MoveHorizontal className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Wischen: nach rechts = erledigt · nach links = löschen
                  </p>
                  <button
                    type="button"
                    onClick={dismissSwipeHint}
                    aria-label="Hinweis ausblenden"
                    className="hit -m-1 shrink-0 p-1 text-stone-500 transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <SectionTitle>Notizen ({notes.length})</SectionTitle>
              {sortedNotes.length === 0 ? (
                <EmptyHint
                  icon={StickyNote}
                  title="Noch keine Notizen"
                  hint="Passwörter, Pläne, Ideen – was du nicht verlieren willst."
                  action={onQuickAdd ? { label: 'Notiz erfassen', onClick: () => onQuickAdd('note') } : undefined}
                />
              ) : (
                <div className="space-y-2.5">
                  {sortedNotes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onEdit({ kind: 'note', note: n })}
                      className={cn(
                        'block w-full rounded-2xl border bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
                        n.pinned ? 'border-amber-500/30' : 'border-border'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Angeheftet" />}
                        <span className="truncate text-sm font-semibold text-foreground">{n.title}</span>
                      </span>
                      {n.content && (
                        <span className="mt-1 line-clamp-4 block whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
                          {n.content}
                        </span>
                      )}
                      <span className="mt-2 block text-[11px] text-stone-500">Bearbeitet: {fmtShortDate(n.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hinweis, dass Termine im eigenen Bereich leben */}
          {tab === 'aufgaben' && overdueCount > 0 && (
            <p className="mt-4 text-center text-[11px] text-stone-500">
              Überfällige Aufgaben erscheinen auch rot in der Heute-Übersicht.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
