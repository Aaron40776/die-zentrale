import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { advanceDue } from '@/lib/zentrale/finance'
import { computeNextDue } from '../../route'
import { startOfDay } from '@/lib/zentrale/date'

type Params = { params: Promise<{ id: string }> }

/**
 * Fixposten in einem Schritt buchen: echte Buchung + Fälligkeit weiterrücken.
 * Atomar, damit ein Netzwerkfehler nicht zu doppelten Buchungen führt.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const existing = await db.transaction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Buchung nicht gefunden.' }, { status: 404 })
  if (existing.recurring === 'NONE') {
    return NextResponse.json({ error: 'Nur Fixposten können gebucht werden.' }, { status: 400 })
  }

  const now = new Date()
  const startToday = startOfDay(now)
  const anchor = new Date(existing.date).getDate()
  let next: Date | null = existing.nextDue
    ? advanceDue(new Date(existing.nextDue), existing.recurring, anchor)
    : computeNextDue(now, existing.recurring, anchor)
  for (let i = 0; i < 500 && next && next.getTime() <= startToday.getTime(); i++) {
    next = advanceDue(next, existing.recurring, anchor)
  }

  try {
    const { booked, template } = await db.$transaction(async (tx) => {
      // Zwei parallele Taps dürfen nur eine Buchung erzeugen: Der Vergleich auf
      // den gelesenen nextDue-Wert macht den zweiten Schreibvorgang wirkungslos.
      const guard = await tx.transaction.updateMany({
        where: { id, nextDue: existing.nextDue },
        data: { nextDue: next },
      })
      if (guard.count !== 1) throw new Error('already-booked')
      const created = await tx.transaction.create({
        data: {
          title: existing.title,
          amount: existing.amount,
          type: existing.type,
          category: existing.category,
          date: now,
          recurring: 'NONE',
          nextDue: null,
        },
      })
      const current = await tx.transaction.findUniqueOrThrow({ where: { id } })
      return { booked: created, template: current }
    })
    return NextResponse.json({ booked, template }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Buchen fehlgeschlagen.' }, { status: 500 })
  }
}
