import { db } from '@/lib/db'

export const runtime = 'nodejs'

const RECURRING_LABEL: Record<string, string> = {
  NONE: '',
  DAILY: 'täglich',
  WEEKLY: 'wöchentlich',
  MONTHLY: 'monatlich',
  YEARLY: 'jährlich',
}

/** CSV-Export aller Buchungen (Excel/Numbers-freundlich: Semikolon, BOM, Komma-Dezimaltrenner). */
export async function GET() {
  try {
    const rows = await db.transaction.findMany({ where: { recurring: 'NONE' }, orderBy: { date: 'asc' } })

    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = ['Datum;Titel;Kategorie;Art;Betrag (EUR);Wiederholung']
    for (const t of rows) {
      const d = new Date(t.date)
      const datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const betrag = t.amount.toFixed(2).replace('.', ',')
      const art = t.type === 'INCOME' ? 'Einnahme' : 'Ausgabe'
      lines.push([datum, esc(t.title), esc(t.category), art, betrag, esc(RECURRING_LABEL[t.recurring] ?? '')].join(';'))
    }

    // BOM voranstellen, damit Excel/Numbers die Umlaute korrekt lesen
    const csv = '\uFEFF' + lines.join('\r\n') + '\r\n'
    const stamp = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="zentrale-finanzen-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export/csv]', err)
    return new Response('Export fehlgeschlagen.', { status: 500 })
  }
}
