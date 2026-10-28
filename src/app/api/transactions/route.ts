import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nextRecurringDate, startOfDay } from '@/lib/zentrale/date'
import { CATEGORIES } from '@/lib/zentrale/types'

const RECURRING = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
const TYPES = ['INCOME', 'EXPENSE'] as const

/**
 * Nächste Fälligkeit nach der ersten Buchung. Liegt das Startdatum in der
 * Vergangenheit, bleibt die nächste Rate bewusst überfällig sichtbar (nicht
 * stillschweigend überspringen). Monatsenden klemmen über den Ankertag:
 * 31.1. -> 28.2. -> 31.3. (kein Drift).
 */
export function computeNextDue(from: Date, recurring: string, anchorDay = from.getDate()): Date | null {
  if (recurring === 'NONE') return null
  const today = startOfDay(new Date())
  if (startOfDay(from).getTime() > today.getTime()) return new Date(from)
  return nextRecurringDate(from, recurring, anchorDay)
}

/** Erste Fälligkeit, die noch nicht vorbei ist – vergangene Runden werden nicht nachgeholt. */
export function nextDueAfterToday(from: Date, recurring: string, anchorDay: number): Date | null {
  const today = startOfDay(new Date())
  let next = nextRecurringDate(from, recurring, anchorDay)
  for (let i = 0; next && startOfDay(next).getTime() <= today.getTime() && i < 500; i++) {
    next = nextRecurringDate(next, recurring, anchorDay)
  }
  return next
}

export async function GET() {
  const transactions = await db.transaction.findMany({ orderBy: { date: 'desc' } })
  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.title || body.amount === undefined || !body.type) {
    return NextResponse.json({ error: 'Titel, Betrag und Art sind erforderlich.' }, { status: 400 })
  }
  if (!TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Art muss INCOME oder EXPENSE sein.' }, { status: 400 })
  }
  const title = String(body.title).trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
  const recurring = RECURRING.includes(body.recurring) ? body.recurring : 'NONE'
  const date = body.date ? new Date(body.date) : new Date()
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum.' }, { status: 400 })
  }
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Betrag muss eine positive Zahl sein.' }, { status: 400 })
  }
  const category = CATEGORIES.includes(body.category) ? String(body.category) : 'Sonstiges'
  // optional (nur für Undo/Restore): bereits fortgeschrittene Fälligkeit 1:1 zurückholen
  const restoredDue = body.nextDue ? new Date(body.nextDue) : null
  if (restoredDue && Number.isNaN(restoredDue.getTime())) {
    return NextResponse.json({ error: 'Ungültige nächste Fälligkeit.' }, { status: 400 })
  }

  const base = {
    title,
    amount: Math.round(amount * 100) / 100,
    type: body.type as string,
    category,
    date,
  }

  // Neue Fixposten mit Start heute/vergangen: erste Rate sofort als echte Buchung
  // anlegen. Die Vorlage bleibt reine Planung und verfälscht den Saldo nicht.
  if (recurring !== 'NONE' && !restoredDue && startOfDay(date).getTime() <= startOfDay(new Date()).getTime()) {
    const nextDue = nextDueAfterToday(date, recurring, date.getDate())
    const [booking, template] = await db.$transaction([
      db.transaction.create({ data: { ...base, recurring: 'NONE', nextDue: null } }),
      db.transaction.create({ data: { ...base, recurring, nextDue } }),
    ])
    return NextResponse.json({ ...template, firstBookingId: booking.id }, { status: 201 })
  }

  const transaction = await db.transaction.create({
    data: { ...base, recurring, nextDue: recurring === 'NONE' ? null : (restoredDue ?? computeNextDue(date, recurring)) },
  })
  return NextResponse.json(transaction, { status: 201 })
}
