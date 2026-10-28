import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EVENT_RECURRING } from '@/lib/zentrale/types'

export async function GET() {
  const events = await db.event.findMany({ orderBy: { date: 'asc' } })
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.title || !body.date) {
    return NextResponse.json({ error: 'Titel und Datum sind erforderlich.' }, { status: 400 })
  }
  const title = String(body.title).trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
  const date = new Date(body.date)
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum.' }, { status: 400 })
  }
  const event = await db.event.create({
    data: {
      title,
      date,
      place: body.place ? String(body.place).trim().slice(0, 120) : null,
      note: body.note ? String(body.note).trim().slice(0, 500) : null,
      priority: ['HIGH', 'MEDIUM', 'LOW'].includes(body.priority) ? body.priority : 'MEDIUM',
      recurring: EVENT_RECURRING.includes(body.recurring) ? body.recurring : 'NONE',
    },
  })
  return NextResponse.json(event, { status: 201 })
}
