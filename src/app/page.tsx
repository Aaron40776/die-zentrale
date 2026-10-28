'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { addDays, dayDiff, eventDate, isoFromInput, dayKey } from '@/lib/zentrale/date'
import type { EditTarget, QuickTab, TaskItem, ViewKind } from '@/lib/zentrale/types'
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

  async function toggleTask(t: TaskItem) {
    const ok = await apiSend(`/api/tasks/${t.id}`, 'PATCH', { done: !t.done })
    if (ok) await z.refresh()
  }

  /** Schnellverschiebung: offene Aufgabe auf morgen setzen. */
  async function snoozeTask(t: TaskItem) {
    const tomorrow = addDays(new Date(), 1)
    const iso = isoFromInput(dayKey(tomorrow))
    if (!iso) return
    const ok = await apiSend(`/api/tasks/${t.id}`, 'PATCH', { dueDate: iso })
    if (ok) {
      await z.refresh()
      toast({ title: 'Auf morgen verschoben.', description: t.title })
    }
  }

  /** Gelöschten Eintrag wiederherstellen (neue ID, alte Inhalte). */
  async function restoreTarget(t: EditTarget) {
    if (t.kind === 'event') {
      const e = t.event
      await apiSend('/api/events', 'POST', { title: e.title, date: e.date, place: e.place, note: e.note, priority: e.priority, recurring: e.recurring })
    } else if (t.kind === 'task') {
      const created = await apiSendJson<TaskItem>('/api/tasks', 'POST', {
        title: t.task.title,
        dueDate: t.task.dueDate,
        priority: t.task.priority,
        recurring: t.task.recurring,
      })
      // Erledigt-Zustand mit zurückholen
      if (created && t.task.done) await apiSend(`/api/tasks/${created.id}`, 'PATCH', { done: true })
    } else if (t.kind === 'transaction') {
      const x = t.transaction
      await apiSend('/api/transactions', 'POST', {
        title: x.title,
        amount: x.amount,
        type: x.type,
        category: x.category,
        date: x.date,
        recurring: x.recurring,
      })
    } else {
      const n = t.note
      await apiSend('/api/notes', 'POST', { title: n.title, content: n.content, pinned: n.pinned })
    }
    await z.refresh()
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

  function openQuickAdd(tab: QuickTab) {
    setQuickTab(tab)
    setQuickOpen(true)
  }

  // Tab-Zähler: überfällige/heutige Aufgaben + heutige Termine als Badge im Browser-Tab
  const dueCount = useMemo(() => {
    const openTasks = z.tasks.filter((t) => !t.done && t.dueDate && dayDiff(new Date(t.dueDate)) <= 0).length
    const todayEvents = z.events.filter((e) => dayDiff(eventDate(e)) === 0).length
    return openTasks + todayEvents
  }, [z.tasks, z.events])

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
      <main className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(112px+env(safe-area-inset-bottom))]">
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
            onSearch={() => setSearchOpen(true)}
            onRefresh={() => void z.refresh()}
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
            onQuickAdd={() => openQuickAdd('event')}
          />
        )}
        {view === 'finanzen' && (
          <FinanzenView
            transactions={z.transactions}
            loading={z.loading}
            onEdit={setEditTarget}
            onChanged={z.refresh}
            onQuickAdd={() => openQuickAdd('transaction')}
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
          />
        )}
      </main>

      <BottomNav view={view} onNavigate={setView} onAdd={() => openQuickAdd('event')} />
      {/* key sorgt dafuer, dass der Reiter beim Oeffnen uebernommen wird */}
      <QuickAddSheet
        key={quickTab}
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onSaved={z.refresh}
        initialTab={quickTab}
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
