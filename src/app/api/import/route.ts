import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CATEGORIES, EVENT_RECURRING, type Recurring } from '@/lib/zentrale/types'
import { computeNextDue } from '../transactions/route'

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW']
const TASK_RECURRING = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
const TX_RECURRING = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY']
const TX_TYPES = ['INCOME', 'EXPENSE']

interface BackupEvent {
  title?: unknown
  date?: unknown
  place?: unknown
  note?: unknown
  priority?: unknown
  recurring?: unknown
}
interface BackupTask {
  title?: unknown
  dueDate?: unknown
  priority?: unknown
  recurring?: unknown
  recurringAnchor?: unknown
  done?: unknown
  completedAt?: unknown
}
interface BackupTx {
  title?: unknown
  amount?: unknown
  type?: unknown
  category?: unknown
  date?: unknown
  recurring?: unknown
  nextDue?: unknown
}
interface BackupNote {
  title?: unknown
  content?: unknown
  pinned?: unknown
  updatedAt?: unknown
}
interface BackupData {
  budget?: unknown
  events?: BackupEvent[]
  tasks?: BackupTask[]
  transactions?: BackupTx[]
  notes?: BackupNote[]
}

function validDate(v: unknown): Date | null {
  if (typeof v !== 'string' && !(v instanceof Date)) return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Backup-Import: "merge" legt alles neu an (IDs werden neu vergeben),
 * "replace" leert vorher alle vier Bereiche und stellt die Backups 1:1 wieder her.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { mode?: string; data?: BackupData } | null
  const data = body?.data
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Keine gültigen Backup-Daten.' }, { status: 400 })
  }
  const replace = body?.mode === 'replace'

  const events = Array.isArray(data.events) ? data.events : []
  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  const notes = Array.isArray(data.notes) ? data.notes : []
  if (events.length === 0 && tasks.length === 0 && transactions.length === 0 && notes.length === 0) {
    return NextResponse.json({ error: 'Das Backup enthält keine verwertbaren Einträge.' }, { status: 400 })
  }

  let counts = { events: 0, tasks: 0, transactions: 0, notes: 0 }

  try {
    await db.$transaction(async (tx) => {
      if (replace) {
        // Budget gehört zum Backup: bei "ersetzen" wird es mit zurückgesetzt.
        await tx.setting.deleteMany({ where: { key: 'budget_monthly' } })
        await tx.event.deleteMany()
        await tx.task.deleteMany()
        await tx.transaction.deleteMany()
        await tx.note.deleteMany()
      }

      for (const e of events) {
        if (typeof e.title !== 'string' || !e.title.trim()) continue
        const date = validDate(e.date)
        if (!date) continue
        await tx.event.create({
          data: {
            title: e.title.trim().slice(0, 120),
            date,
            place: typeof e.place === 'string' && e.place.trim() ? e.place.trim().slice(0, 120) : null,
            note: typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 500) : null,
            priority: PRIORITIES.includes(e.priority as string) ? (e.priority as string) : 'MEDIUM',
            recurring: EVENT_RECURRING.includes(e.recurring as Recurring) ? (e.recurring as Recurring) : 'NONE',
          },
        })
        counts.events += 1
      }

      for (const t of tasks) {
        if (typeof t.title !== 'string' || !t.title.trim()) continue
        const due = t.dueDate ? validDate(t.dueDate) : null
        const done = t.done === true
        const completed = done ? (validDate(t.completedAt) ?? new Date()) : null
        await tx.task.create({
          data: {
            title: t.title.trim().slice(0, 120),
            dueDate: due,
            priority: PRIORITIES.includes(t.priority as string) ? (t.priority as string) : 'MEDIUM',
            recurring: TASK_RECURRING.includes(t.recurring as string) ? (t.recurring as string) : 'NONE',
            recurringAnchor:
              typeof t.recurringAnchor === 'number' && t.recurringAnchor >= 1 && t.recurringAnchor <= 31
                ? t.recurringAnchor
                : due
                  ? due.getDate()
                  : null,
            done,
            completedAt: completed,
          },
        })
        counts.tasks += 1
      }

      for (const t of transactions) {
        if (typeof t.title !== 'string' || !t.title.trim()) continue
        const amount = Number(t.amount)
        if (!Number.isFinite(amount) || amount <= 0) continue
        if (!TX_TYPES.includes(t.type as string)) continue
        const date = validDate(t.date) ?? new Date()
        const recurring = TX_RECURRING.includes(t.recurring as string) ? (t.recurring as string) : 'NONE'
        const storedNext = recurring === 'NONE' ? null : validDate(t.nextDue)
        await tx.transaction.create({
          data: {
            title: t.title.trim().slice(0, 120),
            amount: Math.round(amount * 100) / 100,
            type: t.type as string,
            category: CATEGORIES.includes(t.category as (typeof CATEGORIES)[number]) ? (t.category as string) : 'Sonstiges',
            date,
            recurring,
            nextDue: storedNext ?? computeNextDue(date, recurring, date.getDate()),
          },
        })
        counts.transactions += 1
      }

      const budget = Number(data.budget)
      if (Number.isFinite(budget) && budget > 0) {
        await tx.setting.upsert({
          where: { key: 'budget_monthly' },
          create: { key: 'budget_monthly', value: String(Math.round(budget * 100) / 100) },
          update: { value: String(Math.round(budget * 100) / 100) },
        })
      }

      for (const n of notes) {
        if (typeof n.title !== 'string' || !n.title.trim()) continue
        const updatedAt = validDate(n.updatedAt)
        await tx.note.create({
          data: {
            title: n.title.trim().slice(0, 120),
            content: typeof n.content === 'string' ? n.content.slice(0, 4000) : '',
            pinned: n.pinned === true,
            ...(updatedAt ? { updatedAt } : {}),
          },
        })
        counts.notes += 1
      }

      // Bei "ersetzen" darf eine unbrauchbare Datei nicht die aktuellen Daten leeren.
      const imported = counts.events + counts.tasks + counts.transactions + counts.notes
      if (replace && imported === 0) throw new Error('Keine verwertbaren Einträge.')
    }, { timeout: 30000, maxWait: 5000 })
  } catch {
    return NextResponse.json({ error: 'Import fehlgeschlagen – Daten unverändert gelassen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, counts })
}
