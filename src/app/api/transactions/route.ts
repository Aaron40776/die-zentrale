import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const RECURRING = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
const TYPES = ['INCOME', 'EXPENSE'] as const

export function computeNextDue(from: Date, recurring: string): Date | null {
  if (recurring === 'NONE') return null
  const d = new Date(from)
  // Tagesbasiert: eine Fälligkeit "heute" zählt als fällig (nicht überspringen!)
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  for (let i = 0; i < 80; i++) {
    if (recurring === 'WEEKLY') d.setDate(d.getDate() + 7)
    else if (recurring === 'MONTHLY') d.setMonth(d.getMonth() + 1)
    else if (recurring === 'YEARLY') d.setFullYear(d.getFullYear() + 1)
    if (d.getTime() >= startToday.getTime()) return d
  }
  return null
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
  const recurring = RECURRING.includes(body.recurring) ? body.recurring : 'NONE'
  const date = body.date ? new Date(body.date) : new Date()
  const amount = Number(body.amount)
  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Betrag muss eine positive Zahl sein.' }, { status: 400 })
  }

  const transaction = await db.transaction.create({
    data: {
      title: String(body.title),
      amount,
      type: body.type,
      category: body.category ? String(body.category) : 'Sonstiges',
      date,
      recurring,
      nextDue: computeNextDue(date, recurring),
    },
  })
  return NextResponse.json(transaction, { status: 201 })
}
