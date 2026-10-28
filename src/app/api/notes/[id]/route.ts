import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
  if (body.content !== undefined) data.content = String(body.content).slice(0, 4000)
  if (body.pinned !== undefined) data.pinned = Boolean(body.pinned)

  try {
    const note = await db.note.update({ where: { id }, data })
    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: 'Notiz nicht gefunden.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await db.note.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Notiz nicht gefunden.' }, { status: 404 })
  }
}
