import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EVENT_RECURRING } from '@/lib/zentrale/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültige Daten.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = String(body.title)
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.place !== undefined) data.place = body.place ? String(body.place) : null
  if (body.note !== undefined) data.note = body.note ? String(body.note) : null
  if (body.priority !== undefined && ['HIGH', 'MEDIUM', 'LOW'].includes(body.priority)) {
    data.priority = body.priority
  }
  if (body.recurring !== undefined && EVENT_RECURRING.includes(body.recurring)) {
    data.recurring = body.recurring
  }

  try {
    const event = await db.event.update({ where: { id }, data })
    return NextResponse.json(event)
  } catch {
    return NextResponse.json({ error: 'Termin nicht gefunden.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await db.event.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Termin nicht gefunden.' }, { status: 404 })
  }
}
