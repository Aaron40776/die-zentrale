import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const KEY = 'budget_monthly'

/** Monatsbudget lesen: { amount: number | null } */
export async function GET() {
  try {
    const row = await db.setting.findUnique({ where: { key: KEY } })
    const amount = row ? Number(row.value) : null
    return NextResponse.json({ amount: amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null })
  } catch (err) {
    console.error('[budget/GET]', err)
    return NextResponse.json({ amount: null })
  }
}

/** Monatsbudget setzen (Zahl > 0) oder entfernen (amount = null). */
export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { amount?: unknown } | null
    const amount = typeof body?.amount === 'number' && Number.isFinite(body.amount) ? Math.round(body.amount * 100) / 100 : null

    if (amount === null) {
      await db.setting.deleteMany({ where: { key: KEY } })
      return NextResponse.json({ ok: true, amount: null })
    }
    if (amount <= 0) return NextResponse.json({ error: 'Budget muss größer 0 sein.' }, { status: 400 })

    await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: String(amount) }, update: { value: String(amount) } })
    return NextResponse.json({ ok: true, amount })
  } catch (err) {
    console.error('[budget/PUT]', err)
    return NextResponse.json({ error: 'Budget konnte nicht gespeichert werden.' }, { status: 500 })
  }
}
