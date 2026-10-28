'use client'

import { useRef, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import type { EditTarget } from '@/lib/zentrale/types'
import { apiSend } from '@/lib/zentrale/useZentrale'
import { EventForm, NoteForm, TaskForm, TransactionForm } from './forms'

const KIND_LABEL: Record<EditTarget['kind'], string> = {
  event: 'Termin',
  task: 'Aufgabe',
  transaction: 'Buchung',
  note: 'Notiz',
}

/** Löschbereich mit zweistufiger Bestätigung; key beim Zielwechsel setzt den Zustand zurück. */
function DeleteFooter({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false)
  if (!confirmDel) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setConfirmDel(true)}
        className="mx-auto text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
        {label} löschen
      </Button>
    )
  }
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" className="flex-1 rounded-xl border-border" onClick={() => setConfirmDel(false)}>
        Abbrechen
      </Button>
      <Button type="button" className="flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={onDelete}>
        Wirklich löschen
      </Button>
    </div>
  )
}

/**
 * Bearbeiten, Duplizieren und Löschen für jedes Element.
 * Löschen läuft über onDeleteTarget (Page): dort wird der Toast mit "Rückgängig" erzeugt.
 */
export function EditSheet({
  target,
  onClose,
  onSaved,
  onDeleteTarget,
}: {
  target: EditTarget | null
  onClose: () => void
  onSaved: () => void
  onDeleteTarget: (t: EditTarget) => void
}) {
  const { toast } = useToast()
  const duplicatingRef = useRef(false)
  const [duplicating, setDuplicating] = useState(false)

  function targetId(t: EditTarget): string {
    switch (t.kind) {
      case 'event':
        return t.event.id
      case 'task':
        return t.task.id
      case 'transaction':
        return t.transaction.id
      case 'note':
        return t.note.id
    }
  }

  /** Kopie anlegen (Titel + " (Kopie)"); bei Aufgaben bleibt die Kopie offen, bei Notizen ungepinnt. */
  async function dup() {
    if (!target || duplicatingRef.current) return
    duplicatingRef.current = true
    setDuplicating(true)
    let ok = false
    if (target.kind === 'event') {
      const e = target.event
      ok = await apiSend('/api/events', 'POST', {
        title: `${e.title} (Kopie)`,
        date: e.date,
        place: e.place,
        note: e.note,
        priority: e.priority,
        recurring: e.recurring,
      })
    } else if (target.kind === 'task') {
      const t = target.task
      ok = await apiSend('/api/tasks', 'POST', {
        title: `${t.title} (Kopie)`,
        dueDate: t.dueDate,
        priority: t.priority,
        recurring: t.recurring,
        recurringAnchor: t.recurringAnchor ?? null,
      })
    } else if (target.kind === 'transaction') {
      const t = target.transaction
      ok = await apiSend('/api/transactions', 'POST', {
        title: `${t.title} (Kopie)`,
        amount: t.amount,
        type: t.type,
        category: t.category,
        date: t.date,
        recurring: t.recurring,
        nextDue: t.nextDue,
      })
    } else {
      const n = target.note
      ok = await apiSend('/api/notes', 'POST', { title: `${n.title} (Kopie)`, content: n.content, pinned: false })
    }
    if (ok) {
      toast({ title: `${KIND_LABEL[target.kind]} dupliziert.` })
      onSaved()
      onClose()
    } else {
      toast({ title: 'Duplizieren fehlgeschlagen.', variant: 'destructive' })
    }
    duplicatingRef.current = false
    setDuplicating(false)
  }

  return (
    <Drawer open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-w-md sm:max-w-lg">
        <DrawerHeader className="pb-1 text-left">
          <DrawerTitle>{target ? `${KIND_LABEL[target.kind]} bearbeiten` : ''}</DrawerTitle>
          <DrawerDescription>Änderungen übernehmen sofort in der Übersicht.</DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[58dvh] overflow-y-auto px-4 pb-2 pt-2">
          {target?.kind === 'event' && <EventForm key={`edit-${target.event.id}`} initial={target.event} onDone={() => { onSaved(); onClose() }} />}
          {target?.kind === 'task' && <TaskForm key={`edit-${target.task.id}`} initial={target.task} onDone={() => { onSaved(); onClose() }} />}
          {target?.kind === 'transaction' && <TransactionForm key={`edit-${target.transaction.id}`} initial={target.transaction} onDone={() => { onSaved(); onClose() }} />}
          {target?.kind === 'note' && <NoteForm key={`edit-${target.note.id}`} initial={target.note} onDone={() => { onSaved(); onClose() }} />}
        </div>
        {target && (
          <DrawerFooter className="border-t border-border/60 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={duplicating}
              onClick={dup}
              className="mx-auto h-9 rounded-xl px-4 text-[13px] font-semibold text-brand hover:bg-brand/10 hover:text-brand"
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              {duplicating ? 'Dupliziert …' : 'Duplizieren'}
            </Button>
            <DeleteFooter key={targetId(target)} label={KIND_LABEL[target.kind]} onDelete={() => target && onDeleteTarget(target)} />
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
