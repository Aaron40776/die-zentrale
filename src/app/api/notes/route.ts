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
  const note = await db.note.create({
    data: {
      title: String(body.title),
      content: body.content ? String(body.content) : '',
      pinned: Boolean(body.pinned),
    },
  })
  return NextResponse.json(note, { status: 201 })
}
