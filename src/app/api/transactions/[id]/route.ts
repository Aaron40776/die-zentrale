import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeNextDue } from '../route'
import { advanceDue } from '@/lib/zentrale/finance'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültige Daten.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = String(body.title)
  if (body.amount !== undefined) {
    const amount = Number(body.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Betrag muss eine positive Zahl sein.' }, { status: 400 })
    }
    data.amount = amount
  }
  if (body.type !== undefined && ['INCOME', 'EXPENSE'].includes(body.type)) data.type = body.type
  if (body.category !== undefined) data.category = String(body.category)
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.recurring !== undefined && ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(body.recurring)) {
    data.recurring = body.recurring
  }

  try {
    const existing = await db.transaction.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Buchung nicht gefunden.' }, { status: 404 })

    if (body.advance === true) {
      // Fixposten gebucht: Fälligkeit explizit um eine Periode weiterschieben
      const next = existing.nextDue ? advanceDue(new Date(existing.nextDue), existing.recurring) : null
      data.nextDue = next
    } else {
      const recurring = (data.recurring as string) ?? existing.recurring
      const date = (data.date as Date) ?? existing.date
      data.nextDue = computeNextDue(date, recurring)
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
