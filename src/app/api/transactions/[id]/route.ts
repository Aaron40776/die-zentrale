import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeNextDue, nextDueAfterToday } from '../route'
import { advanceDue } from '@/lib/zentrale/finance'
import { startOfDay } from '@/lib/zentrale/date'
import { CATEGORIES } from '@/lib/zentrale/types'

type Params = { params: Promise<{ id: string }> }

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
  if (body.amount !== undefined) {
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Betrag muss eine positive Zahl sein.' }, { status: 400 })
    }
    data.amount = Math.round(amount * 100) / 100
  }
  if (body.type !== undefined && ['INCOME', 'EXPENSE'].includes(body.type)) data.type = body.type
  if (body.category !== undefined && CATEGORIES.includes(body.category)) data.category = String(body.category)
  if (body.date !== undefined) {
    const date = new Date(body.date)
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Ungültiges Datum.' }, { status: 400 })
    data.date = date
  }
  if (body.recurring !== undefined && ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(body.recurring)) {
    data.recurring = body.recurring
  }
  // Nur für das Rückgängigmachen einer Buchen-Aktion: Fälligkeit exakt zurücksetzen.
  const explicitNextDue = body.nextDue !== undefined
  if (explicitNextDue) {
    if (body.nextDue === null) data.nextDue = null
    else {
      const due = new Date(body.nextDue)
      if (Number.isNaN(due.getTime())) {
        return NextResponse.json({ error: 'Ungültige nächste Fälligkeit.' }, { status: 400 })
      }
      data.nextDue = due
    }
  }

  try {
    const existing = await db.transaction.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Buchung nicht gefunden.' }, { status: 404 })

    // Einmalige Buchung in einen Fixposten umwandeln: die Ist-Buchung bleibt
    // erhalten, die wiederkehrende Vorlage kommt separat dazu (kein Doppelzählen).
    const wantsRecurring = typeof data.recurring === 'string' && data.recurring !== 'NONE'
    const finalDate = (data.date as Date) ?? existing.date
    if (existing.recurring === 'NONE' && wantsRecurring && startOfDay(finalDate).getTime() <= startOfDay(new Date()).getTime()) {
      const recurring = data.recurring as string
      const { recurring: _ignored, ...actualData } = data
      const title = (data.title as string) ?? existing.title
      const amount = (data.amount as number) ?? existing.amount
      const type = (data.type as string) ?? existing.type
      const category = (data.category as string) ?? existing.category
      const [actual, template] = await db.$transaction([
        db.transaction.update({
          where: { id },
          data: { ...actualData, recurring: 'NONE', nextDue: null },
        }),
        db.transaction.create({
          data: {
            title,
            amount,
            type,
            category,
            date: finalDate,
            recurring,
            nextDue: nextDueAfterToday(finalDate, recurring, finalDate.getDate()),
          },
        }),
      ])
      return NextResponse.json({ ...template, sourceId: actual.id })
    }

    if (body.advance === true) {
      // Fixposten gebucht: Fälligkeit auf die nächste ZUKÜNFTIGE Ausgabe schieben.
      // (Auch nach längerem Auslassen rückt sie damit aus der Vergangenheit heraus.)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const anchor = new Date(existing.date).getDate()
      let next: Date | null = existing.nextDue
        ? advanceDue(new Date(existing.nextDue), existing.recurring, anchor)
        : computeNextDue(new Date(), existing.recurring, anchor)
      for (let i = 0; i < 500 && next && next.getTime() <= today.getTime(); i++) {
        next = advanceDue(next, existing.recurring, anchor)
      }
      data.nextDue = next
    } else if (!explicitNextDue) {
      const recurring = (data.recurring as string) ?? existing.recurring
      const date = (data.date as Date) ?? existing.date
      const dayOf = (d: Date) => startOfDay(d).getTime()
      const dateMoved = !!(data.date instanceof Date) && dayOf(data.date as Date) !== dayOf(existing.date)
      const recurrenceChanged = data.recurring !== undefined && data.recurring !== existing.recurring
      if (recurring === 'NONE') data.nextDue = null
      // Nur bei echter Änderung neu rechnen – sonst würde jedes Bearbeiten den
      // bereits weitergerückten nextDue-Termin auf die alte Rate zurücksetzen.
      // Vergangene Anker (z. B. Änderung des Rhythmus nach Monaten) nicht als
      // überfällig anzeigen, sondern ab heute weiterzählen.
      else if (dateMoved || recurrenceChanged || !existing.nextDue) {
        data.nextDue =
          startOfDay(date).getTime() > startOfDay(new Date()).getTime()
            ? computeNextDue(date, recurring, date.getDate())
            : nextDueAfterToday(date, recurring, date.getDate())
      }
    }

    const transaction = await db.transaction.update({ where: { id }, data })
    return NextResponse.json(transaction)
  } catch {
    return NextResponse.json({ error: 'Buchung nicht gefunden.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await db.transaction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Buchung nicht gefunden.' }, { status: 404 })
  }
}
