'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { BottomNav } from '@/components/zentrale/BottomNav'
import { EditSheet } from '@/components/zentrale/EditSheet'
import { QuickAddSheet } from '@/components/zentrale/QuickAddSheet'
import { SearchSheet } from '@/components/zentrale/SearchSheet'
import { AufgabenView } from '@/components/zentrale/views/AufgabenView'
import { FinanzenView } from '@/components/zentrale/views/FinanzenView'
import { HeuteView } from '@/components/zentrale/views/HeuteView'
import { TermineView } from '@/components/zentrale/views/TermineView'
import { addDays, dayDiff, eventDate, fmtEur, fmtShortDate, isoFromInput, dayKey } from '@/lib/zentrale/date'
import type { EditTarget, QuickTab, TaskItem, TransactionItem, ViewKind } from '@/lib/zentrale/types'
import { nextTaskDue } from '@/lib/zentrale/localdb'
import { restoreRecoverySnapshot } from '@/lib/zentrale/recovery'
import { apiSend, apiSendJson, useZentrale } from '@/lib/zentrale/useZentrale'

const KIND_LABEL: Record<EditTarget['kind'], string> = {
  event: 'Termin',
  task: 'Aufgabe',
  transaction: 'Buchung',
  note: 'Notiz',
}

export default function Page() {
  const z = useZentrale()
  const { toast } = useToast()
  const [view, setView] = useState<ViewKind>('heute')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickTab, setQuickTab] = useState<QuickTab>('event')
  const [quickDate, setQuickDate] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const bookingRef = useRef(false)
  const togglingRef = useRef<Set<string>>(new Set())
  const undoingRef = useRef<Set<string>>(new Set())
  const restoringRef = useRef<Set<string>>(new Set())

  async function toggleTask(t: TaskItem) {
    // Doppeltipp darf bei Routinen keinen zweiten Nachfolger erzeugen.
    if (togglingRef.current.has(t.id)) return
    togglingRef.current.add(t.id)
    try {
      const ok = await apiSend(`/api/tasks/${t.id}`, 'PATCH', { done: !t.done })
      if (ok) {
        await z.refresh()
        if (!t.done && t.recurring !== 'NONE') {
          const next = nextTaskDue(t)
          toast({
            title: 'Routine abgehakt.',
            description: next ? `Nächste Ausführung: ${fmtShortDate(next)}.` : 'Der nächste Lauf wurde angelegt.',
            duration: 4000,
            action: (
              <ToastAction altText="Aufgaben öffnen" onClick={() => setView('aufgaben')}>
                Ansehen
              </ToastAction>
            ),
          })
        }
      } else {
        toast({ title: 'Aufgabe konnte nicht aktualisiert werden.', variant: 'destructive' })
      }
    } finally {
      togglingRef.current.delete(t.id)
    }
  }

  /** Schnellverschiebung: offene Aufgabe auf morgen setzen. */
  async function snoozeTask(t: TaskItem) {
    const tomorrow = addDays(new Date(), 1)
    const iso = isoFromInput(dayKey(tomorrow))
    if (!iso) return
    // Schnellverschiebung soll den Rhythmus nicht dauerhaft verändern.
    const ok = await apiSend(`/api/tasks/${t.id}`, 'PATCH', { dueDate: iso, keepAnchor: true })
    if (ok) {
      await z.refresh()
      toast({ title: 'Auf morgen verschoben.', description: t.title })
    } else {
      toast({ title: 'Verschieben fehlgeschlagen.', variant: 'destructive' })
    }
  }

  /** Fixposten mit einem Tipp einbuchen: echte Buchung heute + Fälligkeit rückt serverseitig weiter. */
  async function bookFixed(t: TransactionItem) {
    if (bookingRef.current) return
    bookingRef.current = true
    setBookingId(t.id)
    const result = await apiSendJson<{ booked: TransactionItem; template: TransactionItem }>(
      `/api/transactions/${t.id}/book`,
      'POST'
    )
    if (result) {
      const previousDue = t.nextDue
      toast({
        title: `${t.title} gebucht.`,
        description: `${t.type === 'INCOME' ? '+' : '−'}${fmtEur(t.amount)} für heute erfasst · nächste Fälligkeit aktualisiert.`,
        duration: 8000,
        action: (
          <ToastAction
            altText="Buchung rückgängig machen"
            onClick={() => void undoBooking(t.id, result.booked.id, previousDue)}
          >
            Rückgängig
          </ToastAction>
        ),
      })
      await z.refresh()
    } else {
      toast({ title: 'Buchen fehlgeschlagen.', variant: 'destructive' })
    }
    setBookingId(null)
  }

  /** Falsch gebuchten Fixposten zurücknehmen: Ist-Buchung löschen und Fälligkeit zurücksetzen. */
  async function undoBooking(templateId: string, bookedId: string, previousDue: string | null) {
    if (undoingRef.current.has(bookedId)) return
    undoingRef.current.add(bookedId)
    try {
      const removed = await apiSend(`/api/transactions/${bookedId}`, 'DELETE')
      const reset = await apiSend(`/api/transactions/${templateId}`, 'PATCH', { nextDue: previousDue })
      if (removed && reset) {
        toast({ title: 'Buchung rückgängig gemacht.' })
        await z.refresh()
      } else {
        toast({ title: 'Rückgängig fehlgeschlagen.', variant: 'destructive' })
      }
    } finally {
      undoingRef.current.delete(bookedId)
    }
  }

  /** Gelöschten Eintrag wiederherstellen (neue ID, alte Inhalte). */
  async function restoreTarget(t: EditTarget) {
    const key = `${t.kind}:${t.kind === 'event' ? t.event.id : t.kind === 'task' ? t.task.id : t.kind === 'transaction' ? t.transaction.id : t.note.id}`
    if (restoringRef.current.has(key)) return
    restoringRef.current.add(key)
    try {
      if (t.kind === 'event') {
        const e = t.event
        await apiSend('/api/events', 'POST', { title: e.title, date: e.date, place: e.place, note: e.note, priority: e.priority, recurring: e.recurring })
      } else if (t.kind === 'task') {
        await apiSendJson<TaskItem>('/api/tasks', 'POST', {
          title: t.task.title,
          dueDate: t.task.dueDate,
          priority: t.task.priority,
          recurring: t.task.recurring,
          recurringAnchor: t.task.recurringAnchor,
          done: t.task.done,
          completedAt: t.task.completedAt,
        })
      } else if (t.kind === 'transaction') {
        const x = t.transaction
        await apiSend('/api/transactions', 'POST', {
          title: x.title,
          amount: x.amount,
          type: x.type,
          category: x.category,
          date: x.date,
          recurring: x.recurring,
          nextDue: x.nextDue,
        })
      } else {
        const n = t.note
        await apiSend('/api/notes', 'POST', { title: n.title, content: n.content, pinned: n.pinned, updatedAt: n.updatedAt })
      }
      await z.refresh()
    } finally {
      restoringRef.current.delete(key)
    }
  }

  /** Löschen mit Sicherheitsnetz: Toast mit "Rückgängig" (8 s Zeit zum Umdenken). */
  function deleteWithUndo(t: EditTarget) {
    const item = t.kind === 'event' ? t.event : t.kind === 'task' ? t.task : t.kind === 'transaction' ? t.transaction : t.note
    const url = `/api/${t.kind === 'event' ? 'events' : t.kind === 'task' ? 'tasks' : t.kind === 'transaction' ? 'transactions' : 'notes'}/${item.id}`
    void (async () => {
      const ok = await apiSend(url, 'DELETE')
      if (!ok) {
        toast({ title: 'Löschen fehlgeschlagen.', variant: 'destructive' })
        return
      }
      await z.refresh()
      toast({
        title: `${KIND_LABEL[t.kind]} gelöscht.`,
        description: item.title,
        duration: 8000,
        action: (
          <ToastAction altText={`${KIND_LABEL[t.kind]} wiederherstellen`} onClick={() => void restoreTarget(t)}>
            Rückgängig
          </ToastAction>
        ),
      })
    })()
  }

  /** Wischgeste links: Aufgabe löschen (mit Rückgängig). */
  function deleteTask(t: TaskItem) {
    deleteWithUndo({ kind: 'task', task: t })
  }

  async function clearDoneTasks() {
    const done = z.tasks.filter((task) => task.done)
    if (done.length === 0) return
    if (!window.confirm(`${done.length} erledigte ${done.length === 1 ? 'Aufgabe' : 'Aufgaben'} endgültig löschen?`)) return
    const result = await apiSendJson<{ count: number }>('/api/tasks/completed', 'DELETE')
    if (!result) {
      toast({ title: 'Aufräumen fehlgeschlagen.', variant: 'destructive' })
      return
    }
    await z.refresh()
    toast({
      title: `${result.count} erledigte ${result.count === 1 ? 'Aufgabe' : 'Aufgaben'} gelöscht.`,
      description: 'Die offenen Aufgaben und Notizen bleiben erhalten.',
    })
  }

  async function restoreRecovery() {
    const result = await restoreRecoverySnapshot()
    if (!result.ok) {
      toast({ title: 'Wiederherstellen fehlgeschlagen.', description: result.error, variant: 'destructive' })
      return
    }
    await z.refresh()
    toast({ title: 'Sicherung wiederhergestellt.', description: `${result.count} Einträge sind zurück.` })
  }

  function openQuickAdd(tab: QuickTab, date?: string | null) {
    setQuickTab(tab)
    setQuickDate(date ?? null)
    setQuickOpen(true)
  }

  // Tab-Zähler: überfällige/heutige Aufgaben + heutige Termine als Badge im Browser-Tab
  const dueCount = useMemo(() => {
    const openTasks = z.tasks.filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) <= 0).length
    const todayEvents = z.events.filter((e) => dayDiff(eventDate(e)) === 0).length
    const dueFixed = z.transactions.filter(
      (t) => t.recurring !== 'NONE' && t.nextDue && dayDiff(new Date(t.nextDue)) <= 0
    ).length
    return openTasks + todayEvents + dueFixed
  }, [z.tasks, z.events, z.transactions])

  useEffect(() => {
    document.title = dueCount > 0 ? `(${dueCount}) Die Zentrale` : 'Die Zentrale'
  }, [dueCount])

  // App-Icon-Badge (iOS 17+/Android, nur im Standalone): gleiche Zahl wie im Tab-Titel
  useEffect(() => {
    try {
      const nav = navigator as Navigator & {
        setAppBadge?: (n?: number) => void | Promise<void>
        clearAppBadge?: () => void | Promise<void>
      }
      if (typeof nav.setAppBadge !== 'function') return
      if (dueCount > 0) void nav.setAppBadge(dueCount)
      else void nav.clearAppBadge?.()
    } catch {
      /* Badge nicht verfügbar -> still ignorieren */
    }
  }, [dueCount])

  // Tastatur: ⌘/Ctrl+K oder "/" öffnet die globale Suche (Desktop-Komfort).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (!typing && !quickOpen && !editTarget && e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [quickOpen, editTarget])

  // Homescreen-Shortcut: /?quick=transaction|task|event|note öffnet Quick-Add mit passendem Reiter
  // (asynchron, damit der Öffnungs-Zustand erst nach dem Hydration-Pass gesetzt wird)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('quick')
    if (q === 'event' || q === 'task' || q === 'transaction' || q === 'note') {
      window.history.replaceState(null, '', window.location.pathname)
      queueMicrotask(() => {
        setQuickTab(q)
        setQuickOpen(true)
      })
    }
  }, [])

  return (
    <div className="min-h-dvh">
      {/* Safe-Area-oben: im Standalone-Modus (Home-Bildschirm) bleibt Platz unter Dynamic Island/Statusleiste.
          Unten: Platz fuer die schwebende Glas-Navigation inkl. Abstand. */}
      <main className="mx-auto w-full max-w-md sm:max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(112px+env(safe-area-inset-bottom))]">
        {z.error && view !== 'heute' && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
            <span className="min-w-0 flex-1">{z.error}</span>
            <button type="button" onClick={() => void z.refresh()} className="hit shrink-0 font-semibold underline underline-offset-2">
              Erneut laden
            </button>
          </div>
        )}
        <div key={view} className="animate-view">
          {view === 'heute' && (
            <HeuteView
              events={z.events}
              tasks={z.tasks}
              transactions={z.transactions}
              notes={z.notes}
              loading={z.loading}
              error={z.error}
              onNavigate={setView}
              onEdit={setEditTarget}
              onToggleTask={toggleTask}
              onSnoozeTask={snoozeTask}
              onDeleteTask={deleteTask}
              onQuickAdd={openQuickAdd}
              onBookFixed={bookFixed}
              bookingId={bookingId}
              onSearch={() => setSearchOpen(true)}
              onRefresh={() => void z.refresh()}
              onRestoreRecovery={() => void restoreRecovery()}
              onAddEventAt={(date) => openQuickAdd('event', date)}
            />
          )}
          {view === 'termine' && (
            <TermineView
              events={z.events}
              tasks={z.tasks}
              loading={z.loading}
              onEdit={setEditTarget}
              onToggleTask={toggleTask}
              onSnoozeTask={snoozeTask}
              onDeleteTask={deleteTask}
              onQuickAdd={(date) => openQuickAdd('event', date)}
              onSearch={() => setSearchOpen(true)}
            />
          )}
          {view === 'finanzen' && (
            <FinanzenView
              transactions={z.transactions}
              loading={z.loading}
              onEdit={setEditTarget}
              onChanged={z.refresh}
              onQuickAdd={() => openQuickAdd('transaction')}
              onBookFixed={bookFixed}
              bookingId={bookingId}
              onSearch={() => setSearchOpen(true)}
            />
          )}
          {view === 'aufgaben' && (
            <AufgabenView
              tasks={z.tasks}
              notes={z.notes}
              loading={z.loading}
              onEdit={setEditTarget}
              onToggleTask={toggleTask}
              onSnoozeTask={snoozeTask}
              onDeleteTask={deleteTask}
              onQuickAdd={openQuickAdd}
              onClearDone={() => void clearDoneTasks()}
              onSearch={() => setSearchOpen(true)}
            />
          )}
          </div>
      </main>

      <BottomNav
        view={view}
        onNavigate={setView}
        onAdd={() =>
          openQuickAdd(view === 'finanzen' ? 'transaction' : view === 'aufgaben' ? 'task' : 'event')
        }
      />
      {/* key sorgt dafuer, dass der Reiter beim Oeffnen uebernommen wird */}
      <QuickAddSheet
        key={`${quickTab}-${quickDate ?? ''}`}
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onSaved={z.refresh}
        initialTab={quickTab}
        initialDate={quickDate}
        transactions={z.transactions}
      />
      <SearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPick={setEditTarget}
        events={z.events}
        tasks={z.tasks}
        transactions={z.transactions}
        notes={z.notes}
      />
      <EditSheet
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={z.refresh}
        onDeleteTarget={(t) => {
          setEditTarget(null)
          deleteWithUndo(t)
        }}
      />
    </div>
  )
}
