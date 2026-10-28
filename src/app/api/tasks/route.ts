import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW']
export const TASK_RECURRING = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

export async function GET() {
  const tasks = await db.task.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.title) {
    return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
  }
  const title = String(body.title).trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 })
  let dueDate: Date | null = null
  if (body.dueDate) {
    const parsed = new Date(body.dueDate)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Ungültiges Fälligkeitsdatum.' }, { status: 400 })
    }
    dueDate = parsed
  }
  const recurring = TASK_RECURRING.includes(body.recurring) ? body.recurring : 'NONE'
  const done = body.done === true
  const completedAt = done ? (body.completedAt ? new Date(body.completedAt) : new Date()) : null
  if (completedAt && Number.isNaN(completedAt.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Abschlussdatum.' }, { status: 400 })
  }
  const task = await db.task.create({
    data: {
      title,
      dueDate,
      priority: PRIORITIES.includes(body.priority) ? body.priority : 'MEDIUM',
      recurring,
      recurringAnchor:
        recurring !== 'NONE'
          ? typeof body.recurringAnchor === 'number' && body.recurringAnchor >= 1 && body.recurringAnchor <= 31
            ? body.recurringAnchor
            : dueDate
              ? dueDate.getDate()
              : null
          : null,
      done,
      completedAt,
    },
  })
  return NextResponse.json(task, { status: 201 })
}
