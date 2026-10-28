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
  const event = await db.event.create({
    data: {
      title: String(body.title),
      date: new Date(body.date),
      place: body.place ? String(body.place) : null,
      note: body.note ? String(body.note) : null,
      priority: ['HIGH', 'MEDIUM', 'LOW'].includes(body.priority) ? body.priority : 'MEDIUM',
      recurring: EVENT_RECURRING.includes(body.recurring) ? body.recurring : 'NONE',
    },
  })
  return NextResponse.json(event, { status: 201 })
}
