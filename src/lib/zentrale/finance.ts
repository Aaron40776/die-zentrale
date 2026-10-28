// Finanz-Helfer: Prognose zum Monatsende aus Fixposten (Abos & wiederkehrende Buchungen).
import { addMonthsClamped, nextRecurringDate, startOfDay } from './date'
import type { TransactionItem } from './types'

function endOfMonth(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Fixposten nach dem Buchen weiterschieben: ab der aktuellen Fälligkeit den
 * nächsten Termin derselben Wiederholung berechnen (Monatsenden klemmen:
 * 31.1. -> 28.2. -> 31.3., kein Drift).
 */
export function advanceDue(from: Date, recurring: string, anchorDay = from.getDate()): Date | null {
  return nextRecurringDate(from, recurring, anchorDay)
}

/**
 * Nicht gebuchte Einträge: Fixposten-Vorlagen zählen nie als Ist-Buchung,
 * einmalige Einträge erst ab ihrem Datum. Die Prognose plant sie separat ein.
 */
export function isPlannedEntry(t: TransactionItem, now: Date = new Date()): boolean {
  if (t.recurring !== 'NONE') return true
  return startOfDay(new Date(t.date)).getTime() > startOfDay(now).getTime()
}

/**
 * Monatliche Grundlast eines Fixpostens (Woche auf Monat, Jahr auf Monat umgelegt).
 */
export function monthlyEquivalent(t: TransactionItem): number {
  if (t.recurring === 'WEEKLY') return (t.amount * 52) / 12
  if (t.recurring === 'YEARLY') return t.amount / 12
  if (t.recurring === 'MONTHLY') return t.amount
  return 0
}

export { addMonthsClamped }

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
 * Rechnet aus aktuellen Fixposten die Belastungen bis Monatsende.
 * Eine überfällige, noch nicht gebuchte Rate zählt genau einmal; ältere
 * verpasste Perioden werden NICHT rückwirkend mitgezählt.
 */
export function forecastMonthEnd(transactions: TransactionItem[], balance: number, now: Date = new Date()): Forecast {
  const limit = endOfMonth(now)
  const startToday = startOfDay(now)
  let plannedIn = 0
  let plannedOut = 0
  let movements = 0

  const count = (t: TransactionItem) => {
    if (t.type === 'INCOME') plannedIn += t.amount
    else plannedOut += t.amount
    movements += 1
  }

  for (const t of transactions) {
    // Einmalige, aber erst später gebuchte Einträge bis Monatsende mitplanen.
    if (t.recurring === 'NONE') {
      const when = new Date(t.date)
      if (startOfDay(when).getTime() > startToday.getTime() && when.getTime() <= limit.getTime()) count(t)
      continue
    }
    if (!t.nextDue) continue
    // Ankertag aus der ursprünglichen Buchung – sonst driftet der 31. nach dem 28. Februar auf den 28.
    const anchorDay = new Date(t.date).getDate()
    let cursor: Date | null = new Date(t.nextDue)
    let steps = 0

    // Überfällig: einmal als "kommt noch" zählen, dann bis heute vorspulen.
    if (cursor.getTime() < startToday.getTime()) {
      count(t)
      while (cursor && cursor.getTime() < startToday.getTime() && steps < 500) {
        cursor = nextRecurringDate(cursor, t.recurring, anchorDay)
        steps += 1
      }
    }

    while (cursor && cursor.getTime() <= limit.getTime() && steps < 520) {
      count(t)
      cursor = nextRecurringDate(cursor, t.recurring, anchorDay)
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
