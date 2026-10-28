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
 * Effektives Termin-Datum: jährliche Termine (Geburtstage/Jahrestage) rollen
 * automatisch auf die nächste kommende Ausgabe, normale Termine bleiben fix.
 */
export function eventDate(e: { date: string; recurring?: string | null }): Date {
  const d = new Date(e.date)
  if (e.recurring !== 'YEARLY') return d
  const today = startOfDay(new Date())
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
  let guard = 0
  while (x.getTime() < today.getTime() && guard < 200) {
    x.setFullYear(x.getFullYear() + 1)
    guard += 1
  }
  return x
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
