// Typen & Konstanten für "Die Zentrale" – inkl. 5-Farben-Logik aus dem Konzept.
// Design: Dark-Only. Töne sind als helle Varianten auf dunklem Grund gewählt.

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TxType = 'INCOME' | 'EXPENSE'
export type Recurring = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type ViewKind = 'heute' | 'termine' | 'finanzen' | 'aufgaben'
export type ItemKind = 'event' | 'task' | 'transaction' | 'note'
export type QuickTab = 'event' | 'task' | 'transaction' | 'note'

export type EditTarget =
  | { kind: 'event'; event: EventItem }
  | { kind: 'task'; task: TaskItem }
  | { kind: 'transaction'; transaction: TransactionItem }
  | { kind: 'note'; note: NoteItem }

export interface EventItem {
  id: string
  title: string
  date: string
  place: string | null
  note: string | null
  priority: Priority
  recurring: Recurring
}

export interface TaskItem {
  id: string
  title: string
  dueDate: string | null
  priority: Priority
  recurring: Recurring
  /** Ursprünglicher Monatstag bei Routinen (verhindert Drift am Monatsende). */
  recurringAnchor?: number | null
  done: boolean
  completedAt: string | null
}

export interface TransactionItem {
  id: string
  title: string
  amount: number
  type: TxType
  category: string
  date: string
  recurring: Recurring
  nextDue: string | null
}

export interface NoteItem {
  id: string
  title: string
  content: string
  pinned: boolean
  updatedAt: string
}

export const CATEGORIES = [
  'Wohnen',
  'Lebensmittel',
  'Abos',
  'Mobilität',
  'Gesundheit',
  'Freizeit',
  'Einkommen',
  'Sonstiges',
] as const

// Kategorie-Farben (für dunklen Grund aufgehellt, Einkommen grün)
export const CATEGORY_COLORS: Record<string, string> = {
  Wohnen: '#a8965f',
  Lebensmittel: '#d4b45a',
  Abos: '#fbbf24',
  Mobilität: '#2dd4bf',
  Gesundheit: '#f87171',
  Freizeit: '#fb923c',
  Einkommen: '#4ade80',
  Sonstiges: '#a8a29e',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: 'Hoch',
  MEDIUM: 'Mittel',
  LOW: 'Niedrig',
}

export const RECURRING_LABELS: Record<Recurring, string> = {
  NONE: 'Nie',
  DAILY: 'Täglich',
  WEEKLY: 'Wöchentlich',
  MONTHLY: 'Monatlich',
  YEARLY: 'Jährlich',
}

/** Wiederholungen, die für Buchungen (Abo/Fixposten) zur Auswahl stehen. */
export const TX_RECURRING: Recurring[] = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY']

/** Wiederholungen für Termine: regelmäßige Termine (Sport, Stammtisch) + Jahrestage. */
export const EVENT_RECURRING: Recurring[] = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY']

// 5-Farben-Logik: rot = dringend, ocker = bald, blau = geplant, grau = ruhend, grün = positiv
export type Tone = 'urgent' | 'soon' | 'planned' | 'static' | 'positive'

export const TONE_CHIP: Record<Tone, string> = {
  urgent: 'bg-red-500/15 text-red-400',
  soon: 'bg-amber-500/15 text-amber-400',
  planned: 'bg-sky-500/15 text-sky-400',
  static: 'bg-zinc-500/15 text-zinc-400',
  positive: 'bg-green-500/15 text-green-400',
}

export const TONE_DOT: Record<Tone, string> = {
  urgent: 'bg-red-500',
  soon: 'bg-amber-500',
  planned: 'bg-sky-500',
  static: 'bg-zinc-500',
  positive: 'bg-green-500',
}

export const TONE_BAR: Record<Tone, string> = {
  urgent: 'bg-red-500',
  soon: 'bg-amber-400',
  planned: 'bg-sky-500',
  static: 'bg-zinc-600',
  positive: 'bg-green-500',
}

// Manuelle Wichtigkeit -> Farbe (Termine & Aufgaben)
export const PRIORITY_TONE: Record<Priority, Tone> = {
  HIGH: 'urgent',
  MEDIUM: 'soon',
  LOW: 'planned',
}

// Ergebnis der lokalen Schnelleingabe
export type ParsedEntry =
  | { kind: 'event'; title: string; date: string; time: string | null; place: string | null; priority: Priority; yearly: boolean; recurring?: Recurring }
  | { kind: 'task'; title: string; dueDate: string | null; priority: Priority; recurring: Recurring }
  | { kind: 'transaction'; title: string; amount: number; type: TxType; category: string; date: string; recurring: Recurring }
  | { kind: 'note'; title: string; content: string }
