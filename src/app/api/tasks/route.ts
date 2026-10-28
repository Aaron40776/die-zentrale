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
  const task = await db.task.create({
    data: {
      title: String(body.title),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      priority: PRIORITIES.includes(body.priority) ? body.priority : 'MEDIUM',
      recurring: TASK_RECURRING.includes(body.recurring) ? body.recurring : 'NONE',
    },
  })
  return NextResponse.json(task, { status: 201 })
}
