import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nextRecurringDate, startOfDay } from '@/lib/zentrale/date'
import { TASK_RECURRING } from '../route'

type Params = { params: Promise<{ id: string }> }

/** Nächste Fälligkeit einer Routine – lokal gerechnet, Monatsenden klemmen (31.1. -> 28.2.). */
export function nextOccurrence(from: Date, recurring: string, anchorDay = from.getDate()): Date | null {
  return nextRecurringDate(from, recurring, anchorDay)
}

/** Nächste geplante Ausgabe strikt nach heute – übersprungene Runden werden übersprungen. */
function nextFutureOccurrence(base: Date, recurring: string, anchor: number | null | undefined, now: Date): Date | null {
  const today = startOfDay(now)
  let next = nextOccurrence(base, recurring, anchor ?? base.getDate())
  for (let i = 0; next && startOfDay(next).getTime() <= today.getTime() && i < 500; i++) {
    next = nextOccurrence(next, recurring, anchor ?? base.getDate())
  }
  return next
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültige Daten.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120)
    if (!title) return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
    data.title = title
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null) {
      data.dueDate = null
    } else {
      const dueDate = new Date(body.dueDate)
      if (Number.isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: 'Ungültiges Fälligkeitsdatum.' }, { status: 400 })
      }
      data.dueDate = dueDate
    }
  }
  if (body.done !== undefined) {
    data.done = Boolean(body.done)
    data.completedAt = body.done ? new Date() : null
  }
  if (body.priority !== undefined && ['HIGH', 'MEDIUM', 'LOW'].includes(body.priority)) {
    data.priority = body.priority
  }
  if (body.recurring !== undefined && TASK_RECURRING.includes(body.recurring)) {
    data.recurring = body.recurring
  }

  try {
    const existing = await db.task.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Aufgabe nicht gefunden.' }, { status: 404 })

    // Ankertag bleibt der ursprüngliche Monatstag; nur eine bewusst geänderte Frist setzt ihn neu.
    if (data.dueDate === null) data.recurringAnchor = null
    else if (data.dueDate instanceof Date) {
      const moved = !existing.dueDate || startOfDay(existing.dueDate).getTime() !== startOfDay(data.dueDate as Date).getTime()
      const nextRecurring = (data.recurring as string) ?? existing.recurring
      if (moved && nextRecurring !== 'NONE' && body.keepAnchor !== true) {
        data.recurringAnchor = (data.dueDate as Date).getDate()
      }
    }
    if (data.recurring === 'NONE') data.recurringAnchor = null

    // Zwei gleichzeitige Taps auf "erledigt" dürfen bei Routinen nur einen
    // Nachfolger erzeugen: Der erste Schreibvorgang beansprucht den Wechsel.
    if (body.done === true && !existing.done) {
      const claimed = await db.task.updateMany({
        where: { id, done: false },
        data: { done: true, completedAt: new Date() },
      })
      if (claimed.count === 0) {
        const current = await db.task.findUnique({ where: { id } })
        return NextResponse.json(current)
      }
    }

    const task = await db.task.update({ where: { id }, data })

    const recurring = (data.recurring as string) ?? existing.recurring
    const anchor = (data.recurringAnchor as number | null | undefined) ?? existing.recurringAnchor ?? existing.dueDate?.getDate()
    const now = new Date()
    const becameDone = body.done === true && !existing.done
    const becameUndone = body.done === false && existing.done

    if (recurring !== 'NONE' && (becameDone || becameUndone)) {
      // Von der letzten geplanten Frist weiterzählen (nicht ab heute), damit z. B.
      // eine seit Wochen überfällige Wochen-Routine nicht den kommenden Termin überspringt.
      const base = existing.dueDate ?? startOfDay(now)
      const next = nextFutureOccurrence(base, recurring, anchor, now)
      const dayStart = next ? startOfDay(next) : null
      const dayEnd = dayStart ? new Date(dayStart.getTime() + 86400000) : null

      if (becameDone && next && dayStart && dayEnd) {
        // Kein Doppel-Nachfolger, wenn dieselbe Ausgabe bereits offen ist.
        const duplicate = await db.task.findFirst({
          where: {
            id: { not: existing.id },
            title: existing.title,
            recurring,
            done: false,
            dueDate: { gte: dayStart, lt: dayEnd },
          },
        })
        if (!duplicate) {
          await db.task.create({
            data: { title: existing.title, dueDate: next, priority: existing.priority, recurring, recurringAnchor: anchor ?? null },
          })
        }
      }

      if (becameUndone && dayStart && dayEnd) {
        // Rückgängig gemachte Routine: den automatisch erzeugten Nachfolger wieder entfernen.
        const spawned = await db.task.findFirst({
          where: {
            title: existing.title,
            recurring,
            done: false,
            dueDate: { gte: dayStart, lt: dayEnd },
          },
        })
        if (spawned) await db.task.delete({ where: { id: spawned.id } })
      }
    }

    return NextResponse.json(task)
  } catch {
    return NextResponse.json({ error: 'Aufgabe nicht gefunden.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await db.task.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Aufgabe nicht gefunden.' }, { status: 404 })
  }
}
