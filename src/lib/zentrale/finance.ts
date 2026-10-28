// Finanz-Helfer: Prognose zum Monatsende aus Fixposten (Abos & wiederkehrende Buchungen).
import type { TransactionItem } from './types'

function addMonthsClamped(d: Date, n: number): Date {
  const day = d.getDate()
  const time = d.getHours() * 60 + d.getMinutes()
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const daysInMonth = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, daysInMonth))
  x.setHours(Math.floor(time / 60), time % 60, 0, 0)
  return x
}

function endOfMonth(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Fixposten nach dem Buchen weiterschieben: ab der aktuellen Fälligkeit den
 * nächsten Termin derselben Wiederholung berechnen (Monatsenden klemmen:
 * 31.1. -> 28.2. -> 31.3., kein Drift).
 */
export function advanceDue(from: Date, recurring: string): Date | null {
  if (recurring === 'NONE') return null
  const d = new Date(from)
  if (recurring === 'WEEKLY') d.setDate(d.getDate() + 7)
  else if (recurring === 'MONTHLY') return addMonthsClamped(d, 1)
  else if (recurring === 'YEARLY') return addMonthsClamped(d, 12)
  return d
}

export interface Forecast {
  /** Erwarteter Saldo am Monatsende (aktueller Saldo + geplante Fixposten). */
  forecast: number
  /** Geplante Einnahmen bis Monatsende. */
  plannedIn: number
  /** Geplante Ausgaben bis Monatsende. */
  plannedOut: number
  /** Anzahl der geplanten Bewegungen bis Monatsende. */
  movements: number
}

/**
 * Rechnet aus aktuellen Fixposten die Belastungen bis Monatsende:
 * WEEKLY wird wochenweise durchgestept, MONTHLY/JEARLY fallen einmal an (falls fällig).
 */
export function forecastMonthEnd(transactions: TransactionItem[], balance: number, now: Date = new Date()): Forecast {
  const limit = endOfMonth(now)
  let plannedIn = 0
  let plannedOut = 0
  let movements = 0

  for (const t of transactions) {
    if (t.recurring === 'NONE' || !t.nextDue) continue
    let cursor = new Date(t.nextDue)
    // Bereits vergangene Fälligkeiten bis heute zählen mit (heute fällig = kommt noch).
    let steps = 0
    while (cursor.getTime() <= limit.getTime() && steps < 62) {
      if (t.type === 'INCOME') plannedIn += t.amount
      else plannedOut += t.amount
      movements += 1
      if (t.recurring === 'WEEKLY') cursor.setDate(cursor.getDate() + 7)
      else if (t.recurring === 'MONTHLY') cursor = addMonthsClamped(cursor, 1)
      else if (t.recurring === 'YEARLY') cursor = addMonthsClamped(cursor, 12)
      else break
      steps += 1
    }
  }

  return { forecast: balance + plannedIn - plannedOut, plannedIn, plannedOut, movements }
}

/** Forecast-Chip-Text: "Prognose Monatsende 1.234,56 €". */
export function forecastLabel(f: Forecast): string {
  const sign = f.forecast >= 0 ? '' : '−'
  const abs = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Math.abs(f.forecast))
  return `${sign}${abs}`
}
