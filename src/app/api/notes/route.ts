import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const notes = await db.note.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.title) {
    return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
  }
  const title = String(body.title).trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
  const restoredUpdatedAt = body.updatedAt ? new Date(body.updatedAt) : null
  const note = await db.note.create({
    data: {
      title,
      content: body.content ? String(body.content).slice(0, 4000) : '',
      pinned: Boolean(body.pinned),
      ...(restoredUpdatedAt && !Number.isNaN(restoredUpdatedAt.getTime()) ? { updatedAt: restoredUpdatedAt } : {}),
    },
  })
  return NextResponse.json(note, { status: 201 })
}
