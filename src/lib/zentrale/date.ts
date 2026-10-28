// Datums-Helfer (Client, lokale Zeit) + deutsche Formatierung.

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Ganztägige Differenz in Tagen: negativ = vergangen, 0 = heute. */
export function dayDiff(target: Date, base: Date = new Date()): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(base).getTime()) / 86400000)
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}

export function fmtEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export function fmtLongDate(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
}

export function fmtDayLabel(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(d)
}

export function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date(iso))
}

export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function weekdayShort(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d).replace('.', '')
}

/** 'yyyy-mm-dd' für <input type="date"> aus ISO-String. */
export function toInputDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return dayKey(new Date(iso))
}

/** 'HH:mm' für <input type="time"> aus ISO-String. */
export function toInputTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Datum (+optionale Uhrzeit) aus Eingabefeldern -> ISO-String (lokale Zeit bleibt erhalten). */
export function isoFromInput(dateStr: string, timeStr?: string): string | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  let h = 0
  let mi = 0
  if (timeStr) {
    const parts = timeStr.split(':').map(Number)
    h = parts[0] ?? 0
    mi = parts[1] ?? 0
  }
  return new Date(y, m - 1, d, h, mi, 0, 0).toISOString()
}

/**
 * Monats-Addition mit Klemmung: 31.1. + 1 Monat = 28./29.2., danach wieder 31.3.
 * `anchorDay` bewahrt den ursprünglichen Monatstag über mehrere Sprünge hinweg.
 */
export function addMonthsClamped(d: Date, n: number, anchorDay?: number): Date {
  const day = anchorDay ?? d.getDate()
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), 0, 0)
  const daysInMonth = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, daysInMonth))
  return x
}

/** Nächste Ausgabe einer Wiederholung (lokal gerechnet, damit Sommerzeit keine Tage verschiebt). */
export function nextRecurringDate(from: Date, recurring: string, anchorDay?: number): Date | null {
  const d = new Date(from)
  switch (recurring) {
    case 'DAILY':
      d.setDate(d.getDate() + 1)
      return d
    case 'WEEKLY':
      d.setDate(d.getDate() + 7)
      return d
    case 'MONTHLY':
      return addMonthsClamped(d, 1, anchorDay ?? d.getDate())
    case 'YEARLY':
      return addMonthsClamped(d, 12, anchorDay ?? d.getDate())
    default:
      return null
  }
}

/** k-te Ausgabe ab dem Ursprungsdatum – ohne Drift, weil immer vom Original gerechnet wird. */
function occurrenceAt(base: Date, recurring: string, k: number, anchorDay: number): Date {
  if (k === 0) return new Date(base)
  if (recurring === 'DAILY') {
    const d = new Date(base)
    d.setDate(d.getDate() + k)
    return d
  }
  if (recurring === 'WEEKLY') {
    const d = new Date(base)
    d.setDate(d.getDate() + 7 * k)
    return d
  }
  if (recurring === 'MONTHLY') return addMonthsClamped(base, k, anchorDay)
  if (recurring === 'YEARLY') return addMonthsClamped(base, 12 * k, anchorDay)
  return new Date(base)
}

/**
 * Effektives Termin-Datum: wiederkehrende Termine rollen automatisch auf ihre
 * nächste anstehende Ausgabe, normale Termine bleiben fix.
 */
export function eventDate(e: { date: string; recurring?: string | null }): Date {
  const base = new Date(e.date)
  const recurring = e.recurring ?? 'NONE'
  if (recurring === 'NONE') return base
  const today = startOfDay(new Date())
  if (base >= today) return base
  const anchorDay = base.getDate()
  for (let k = 1; k <= 20000; k++) {
    const occ = occurrenceAt(base, recurring, k, anchorDay)
    if (occ >= today) return occ
  }
  return base
}

/**
 * Alle Ausgaben eines Termins in einem Zeitfenster (Kalender-Monat, 7-Tage-Liste).
 * Nicht wiederkehrende Termine liefern höchstens den einen Termin.
 */
export function eventOccurrences(
  e: { date: string; recurring?: string | null },
  from: Date,
  to: Date
): Date[] {
  const base = new Date(e.date)
  const recurring = e.recurring ?? 'NONE'
  const start = startOfDay(from)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)
  if (recurring === 'NONE') return base >= start && base <= end ? [base] : []
  const anchorDay = base.getDate()
  const out: Date[] = []
  for (let k = 0; k <= 20000; k++) {
    const occ = occurrenceAt(base, recurring, k, anchorDay)
    if (occ.getTime() > end.getTime()) break
    if (occ.getTime() >= start.getTime()) out.push(occ)
  }
  return out
}

/** Fälligkeits-Logik: Farbe + Text (Countdown) für Datum/Task. */
export function dueInfo(
  iso: string | null | undefined,
  done: boolean
): { tone: 'urgent' | 'soon' | 'planned' | 'static'; label: string } {
  if (done) return { tone: 'static', label: 'erledigt' }
  if (!iso) return { tone: 'planned', label: 'ohne Frist' }
  const diff = dayDiff(new Date(iso))
  if (diff < 0) return { tone: 'urgent', label: diff === -1 ? '1 T. überfällig' : `${-diff} T. überfällig` }
  if (diff === 0) return { tone: 'urgent', label: 'heute fällig' }
  if (diff === 1) return { tone: 'soon', label: 'morgen' }
  if (diff <= 7) return { tone: 'soon', label: `in ${diff} Tagen` }
  return { tone: 'planned', label: `in ${diff} Tagen` }
}
