import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EVENT_RECURRING } from '@/lib/zentrale/types'

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
  if (body.date !== undefined) {
    const date = new Date(body.date)
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Ungültiges Datum.' }, { status: 400 })
    data.date = date
  }
  if (body.place !== undefined) data.place = body.place ? String(body.place).trim().slice(0, 120) : null
  if (body.note !== undefined) data.note = body.note ? String(body.note).trim().slice(0, 500) : null
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
