import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TASK_RECURRING } from '../route'

type Params = { params: Promise<{ id: string }> }

/** Naechste Fälligkeit einer Routine (UTC-Mitternacht bleibt erhalten). */
export function nextOccurrence(from: Date, recurring: string): Date | null {
  const x = new Date(from)
  switch (recurring) {
    case 'DAILY':
      x.setUTCDate(x.getUTCDate() + 1)
      return x
    case 'WEEKLY':
      x.setUTCDate(x.getUTCDate() + 7)
      return x
    case 'MONTHLY':
      x.setUTCMonth(x.getUTCMonth() + 1)
      return x
    case 'YEARLY':
      x.setUTCFullYear(x.getUTCFullYear() + 1)
      return x
    default:
      return null
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültige Daten.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = String(body.title)
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
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

    const task = await db.task.update({ where: { id }, data })

    // Routine abgehakt -> automatisch die naechste Fälligkeit als neue offene Aufgabe anlegen.
    // Ohne Fälligkeitsdatum läuft die Routine ab jetzt weiter; bei überfälligem Datum ab heute.
    const becameDone = body.done === true && !existing.done
    const recurring = (data.recurring as string) ?? existing.recurring
    if (becameDone && recurring !== 'NONE') {
      const now = new Date()
      const base = existing.dueDate && existing.dueDate.getTime() > now.getTime() ? existing.dueDate : now
      const next = nextOccurrence(base, recurring)
      if (next) {
        await db.task.create({
          data: {
            title: existing.title,
            dueDate: next,
            priority: existing.priority,
            recurring,
          },
        })
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
