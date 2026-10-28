/**
 * Lokale Datenbank für "Die Zentrale".
 *
 * Die App läuft vollständig im Browser. Alle Einträge liegen in IndexedDB
 * auf dem Gerät; es gibt keinen Server und keine Cloud-Verbindung.
 */
import { advanceDue } from './finance'
import {
  startOfDay,
  nextRecurringDate,
} from './date'
import {
  CATEGORIES,
  EVENT_RECURRING,
  TX_RECURRING,
  type EventItem,
  type NoteItem,
  type Priority,
  type Recurring,
  type TaskItem,
  type TransactionItem,
  type TxType,
} from './types'

const DB_NAME = 'die-zentrale'
const DB_VERSION = 1
const SETTING_BUDGET = 'budget_monthly'
const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
const TASK_RECURRING: Recurring[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

type StoreName = 'events' | 'tasks' | 'transactions' | 'notes' | 'settings'
type StoredTask = TaskItem & { createdAt?: string }
type StoredEvent = EventItem
type StoredTransaction = TransactionItem
type StoredNote = NoteItem
type SettingRow = { key: string; value: string }

let dbPromise: Promise<IDBDatabase> | null = null
let mutationQueue: Promise<unknown> = Promise.resolve()

function requestResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB-Fehler'))
  })
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB ist auf diesem Gerät nicht verfügbar.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of ['events', 'tasks', 'transactions', 'notes'] as const) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
    }
    req.onsuccess = () => {
      const db = req.result
      // Browser dürfen lokale Daten bei Platzmangel verwerfen. Wenn möglich,
      // um dauerhafte Speicherung bitten – zusätzlich bleibt der JSON-Export.
      try {
        void navigator.storage?.persist?.()
      } catch {
        /* optional */
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error ?? new Error('Datenbank konnte nicht geöffnet werden.'))
  })
  return dbPromise
}

async function all<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  return requestResult(tx.objectStore(storeName).getAll() as IDBRequest<T[]>)
}

async function getOne<T>(storeName: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  return requestResult(tx.objectStore(storeName).get(key) as IDBRequest<T | undefined>)
}

async function put<T>(storeName: StoreName, value: T): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  await requestResult(tx.objectStore(storeName).put(value as unknown as object))
  return value
}

async function remove(storeName: StoreName, key: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  await requestResult(tx.objectStore(storeName).delete(key))
}

async function clear(storeName: StoreName): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  await requestResult(tx.objectStore(storeName).clear())
}

/** Schreibvorgänge serialisieren – verhindert doppelte Nachfolger bei schnellen Taps. */
function mutate<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(fn, fn)
  mutationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* Fallback */
  }
  return `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isoNow(): string {
  return new Date().toISOString()
}

function validDate(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dayTime(value: string): number {
  return startOfDay(new Date(value)).getTime()
}

function nextDueAfterToday(from: string, recurring: Recurring, anchorDay: number): string | null {
  if (recurring === 'NONE') return null
  const today = startOfDay(new Date()).getTime()
  let next = nextRecurringDate(new Date(from), recurring, anchorDay)
  for (let i = 0; next && startOfDay(next).getTime() <= today && i < 500; i++) {
    next = nextRecurringDate(next, recurring, anchorDay)
  }
  return next ? next.toISOString() : null
}

function computeNextDue(from: string, recurring: Recurring, anchorDay = new Date(from).getDate()): string | null {
  if (recurring === 'NONE') return null
  const date = new Date(from)
  if (dayTime(from) > startOfDay(new Date()).getTime()) return date.toISOString()
  return nextDueAfterToday(from, recurring, anchorDay)
}

function nextFutureOccurrence(base: string, recurring: Recurring, anchor: number | null | undefined): string | null {
  if (recurring === 'NONE') return null
  const today = startOfDay(new Date()).getTime()
  const anchorDay = anchor ?? new Date(base).getDate()
  let next = nextRecurringDate(new Date(base), recurring, anchorDay)
  for (let i = 0; next && startOfDay(next).getTime() <= today && i < 500; i++) {
    next = nextRecurringDate(next, recurring, anchorDay)
  }
  return next ? next.toISOString() : null
}

function sameDueDay(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return dayTime(a) === dayTime(b)
}

function normalizePriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : 'MEDIUM'
}

function normalizeRecurring(value: unknown, allowed: Recurring[]): Recurring {
  return allowed.includes(value as Recurring) ? (value as Recurring) : 'NONE'
}

function normalizeCategory(value: unknown): string {
  return CATEGORIES.includes(value as (typeof CATEGORIES)[number]) ? String(value) : 'Sonstiges'
}

function normalizeText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().slice(0, max)
  return text || null
}

// ---------- Lesen ----------

export async function loadAllData() {
  const [events, tasks, transactions, notes] = await Promise.all([
    all<StoredEvent>('events'),
    all<StoredTask>('tasks'),
    all<StoredTransaction>('transactions'),
    all<StoredNote>('notes'),
  ])
  events.sort((a, b) => a.date.localeCompare(b.date))
  tasks.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  transactions.sort((a, b) => b.date.localeCompare(a.date))
  notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { events, tasks, transactions, notes }
}

export async function getBudget(): Promise<number | null> {
  const row = await getOne<SettingRow>('settings', SETTING_BUDGET)
  const amount = row ? Number(row.value) : null
  return amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null
}

export async function setBudget(amount: number | null): Promise<void> {
  if (amount === null) {
    await remove('settings', SETTING_BUDGET)
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Ungültiges Budget.')
  await put<SettingRow>('settings', {
    key: SETTING_BUDGET,
    value: String(Math.round(amount * 100) / 100),
  })
}

// ---------- Termine ----------

function eventFromBody(body: Record<string, unknown>, existing?: EventItem): EventItem | null {
  const title = body.title !== undefined ? normalizeText(body.title, 120) : existing?.title ?? null
  if (!title) return null
  const date = body.date !== undefined ? validDate(body.date) : existing?.date ?? null
  if (!date) return null
  return {
    id: existing?.id ?? uid(),
    title,
    date,
    place:
      body.place !== undefined
        ? normalizeText(body.place, 120)
        : existing?.place ?? null,
    note:
      body.note !== undefined
        ? normalizeText(body.note, 500)
        : existing?.note ?? null,
    priority:
      body.priority !== undefined ? normalizePriority(body.priority) : existing?.priority ?? 'MEDIUM',
    recurring:
      body.recurring !== undefined
        ? normalizeRecurring(body.recurring, EVENT_RECURRING)
        : existing?.recurring ?? 'NONE',
  }
}

async function createEvent(body: Record<string, unknown>) {
  const event = eventFromBody(body)
  if (!event) return { ok: false, error: 'Titel und Datum sind erforderlich.' }
  await put('events', event)
  return { ok: true, data: event }
}

async function updateEvent(id: string, body: Record<string, unknown>) {
  const existing = await getOne<EventItem>('events', id)
  if (!existing) return { ok: false, error: 'Termin nicht gefunden.' }
  const event = eventFromBody(body, existing)
  if (!event) return { ok: false, error: 'Titel und Datum sind erforderlich.' }
  await put('events', event)
  return { ok: true, data: event }
}

async function deleteEvent(id: string) {
  if (!(await getOne<EventItem>('events', id))) return { ok: false, error: 'Termin nicht gefunden.' }
  await remove('events', id)
  return { ok: true, data: { ok: true } }
}

// ---------- Aufgaben ----------

async function createTask(body: Record<string, unknown>) {
  const title = normalizeText(body.title, 120)
  if (!title) return { ok: false, error: 'Titel ist erforderlich.' }
  const dueDate = body.dueDate ? validDate(body.dueDate) : null
  if (body.dueDate && !dueDate) return { ok: false, error: 'Ungültiges Fälligkeitsdatum.' }
  const recurring = normalizeRecurring(body.recurring, TASK_RECURRING)
  const done = body.done === true
  const completedAt = done ? validDate(body.completedAt) ?? isoNow() : null
  if (body.completedAt && !validDate(body.completedAt)) {
    return { ok: false, error: 'Ungültiges Abschlussdatum.' }
  }
  const recurringAnchor =
    recurring !== 'NONE'
      ? typeof body.recurringAnchor === 'number' && body.recurringAnchor >= 1 && body.recurringAnchor <= 31
        ? body.recurringAnchor
        : dueDate
          ? new Date(dueDate).getDate()
          : null
      : null
  const task: StoredTask = {
    id: uid(),
    title,
    dueDate,
    priority: normalizePriority(body.priority),
    recurring,
    recurringAnchor,
    done,
    completedAt,
    createdAt: isoNow(),
  }
  await put('tasks', task)
  return { ok: true, data: task }
}

async function updateTask(id: string, body: Record<string, unknown>) {
  const existing = await getOne<StoredTask>('tasks', id)
  if (!existing) return { ok: false, error: 'Aufgabe nicht gefunden.' }

  const title = body.title !== undefined ? normalizeText(body.title, 120) : existing.title
  if (!title) return { ok: false, error: 'Titel ist erforderlich.' }

  let dueDate = existing.dueDate
  if (body.dueDate !== undefined) {
    dueDate = body.dueDate === null ? null : validDate(body.dueDate)
    if (body.dueDate !== null && !dueDate) return { ok: false, error: 'Ungültiges Fälligkeitsdatum.' }
  }

  const recurring =
    body.recurring !== undefined ? normalizeRecurring(body.recurring, TASK_RECURRING) : existing.recurring
  const priority = body.priority !== undefined ? normalizePriority(body.priority) : existing.priority
  const done = body.done !== undefined ? Boolean(body.done) : existing.done
  const completedAt =
    body.done !== undefined
      ? body.done
        ? existing.done
          ? existing.completedAt
          : isoNow()
        : null
      : existing.completedAt

  let recurringAnchor = existing.recurringAnchor ?? (existing.dueDate ? new Date(existing.dueDate).getDate() : null)
  if (dueDate === null || recurring === 'NONE') {
    recurringAnchor = null
  } else if (body.dueDate !== undefined && body.keepAnchor !== true) {
    const moved = !existing.dueDate || dayTime(existing.dueDate) !== dayTime(dueDate)
    if (moved) recurringAnchor = new Date(dueDate).getDate()
  }

  const updated: StoredTask = {
    ...existing,
    title,
    dueDate,
    priority,
    recurring,
    recurringAnchor,
    done,
    completedAt,
  }
  await put('tasks', updated)

  const becameDone = body.done === true && !existing.done
  const becameUndone = body.done === false && existing.done
  if (recurring !== 'NONE' && (becameDone || becameUndone)) {
    const base = existing.dueDate ?? startOfDay(new Date()).toISOString()
    const next = nextFutureOccurrence(base, recurring, recurringAnchor)
    const tasks = await all<StoredTask>('tasks')
    const spawned = tasks.find(
      (task) =>
        task.id !== existing.id &&
        task.title === updated.title &&
        task.recurring === recurring &&
        !task.done &&
        sameDueDay(task.dueDate, next)
    )
    if (becameDone && next && !spawned) {
      const successor: StoredTask = {
        id: uid(),
        title: updated.title,
        dueDate: next,
        priority: updated.priority,
        recurring,
        recurringAnchor,
        done: false,
        completedAt: null,
        createdAt: isoNow(),
      }
      await put('tasks', successor)
    }
    if (becameUndone && spawned) await remove('tasks', spawned.id)
  }

  return { ok: true, data: updated }
}

async function deleteTask(id: string) {
  if (!(await getOne<StoredTask>('tasks', id))) return { ok: false, error: 'Aufgabe nicht gefunden.' }
  await remove('tasks', id)
  return { ok: true, data: { ok: true } }
}

// ---------- Buchungen ----------

function transactionFromBody(
  body: Record<string, unknown>,
  existing?: TransactionItem
): TransactionItem | null {
  const title = body.title !== undefined ? normalizeText(body.title, 120) : existing?.title ?? null
  if (!title) return null
  let amount = existing?.amount ?? 0
  if (body.amount !== undefined) {
    amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null
  }
  if (!Number.isFinite(amount) || amount <= 0) return null
  const type = (body.type !== undefined ? body.type : existing?.type) as TxType
  if (type !== 'INCOME' && type !== 'EXPENSE') return null
  const date = body.date !== undefined ? validDate(body.date) : existing?.date ?? null
  if (!date) return null
  const recurring =
    body.recurring !== undefined
      ? normalizeRecurring(body.recurring, TX_RECURRING)
      : existing?.recurring ?? 'NONE'
  return {
    id: existing?.id ?? uid(),
    title,
    amount: Math.round(amount * 100) / 100,
    type,
    category: body.category !== undefined ? normalizeCategory(body.category) : existing?.category ?? 'Sonstiges',
    date,
    recurring,
    nextDue: existing?.nextDue ?? null,
  }
}

async function createTransaction(body: Record<string, unknown>) {
  const tx = transactionFromBody(body)
  if (!tx) return { ok: false, error: 'Titel, positiver Betrag, Art und Datum sind erforderlich.' }
  const restoredDue = body.nextDue ? validDate(body.nextDue) : null
  if (body.nextDue && !restoredDue) return { ok: false, error: 'Ungültige nächste Fälligkeit.' }

  if (tx.recurring !== 'NONE' && !restoredDue && dayTime(tx.date) <= startOfDay(new Date()).getTime()) {
    const next = nextDueAfterToday(tx.date, tx.recurring, new Date(tx.date).getDate())
    const booking: TransactionItem = { ...tx, id: uid(), recurring: 'NONE', nextDue: null }
    const template: TransactionItem = { ...tx, id: uid(), nextDue: next }
    await put('transactions', booking)
    await put('transactions', template)
    return { ok: true, data: { ...template, firstBookingId: booking.id } }
  }

  const created: TransactionItem = {
    ...tx,
    nextDue: tx.recurring === 'NONE' ? null : restoredDue ?? computeNextDue(tx.date, tx.recurring),
  }
  await put('transactions', created)
  return { ok: true, data: created }
}

async function updateTransaction(id: string, body: Record<string, unknown>) {
  const existing = await getOne<TransactionItem>('transactions', id)
  if (!existing) return { ok: false, error: 'Buchung nicht gefunden.' }

  const base = transactionFromBody(body, existing)
  if (!base) return { ok: false, error: 'Ungültige Buchungsdaten.' }
  const wantsRecurring = body.recurring !== undefined && body.recurring !== 'NONE'
  const finalDate = base.date

  // Einmalige Buchung in einen Fixposten umwandeln: die Ist-Buchung bleibt bestehen.
  if (existing.recurring === 'NONE' && wantsRecurring && dayTime(finalDate) <= startOfDay(new Date()).getTime()) {
    const actual: TransactionItem = {
      ...base,
      recurring: 'NONE',
      nextDue: null,
    }
    const template: TransactionItem = {
      ...base,
      id: uid(),
      recurring: base.recurring,
      nextDue: nextDueAfterToday(finalDate, base.recurring, new Date(finalDate).getDate()),
    }
    await put('transactions', actual)
    await put('transactions', template)
    return { ok: true, data: { ...template, sourceId: actual.id } }
  }

  const updated: TransactionItem = { ...base }
  const explicitNextDue = body.nextDue !== undefined
  if (explicitNextDue) {
    if (body.nextDue === null) updated.nextDue = null
    else {
      const due = validDate(body.nextDue)
      if (!due) return { ok: false, error: 'Ungültige nächste Fälligkeit.' }
      updated.nextDue = due
    }
  }

  if (body.advance === true) {
    const anchor = new Date(existing.date).getDate()
    let next: Date | null = existing.nextDue
      ? advanceDue(new Date(existing.nextDue), existing.recurring, anchor)
      : nextRecurringDate(new Date(), existing.recurring, anchor)
    const today = startOfDay(new Date())
    for (let i = 0; i < 500 && next && next.getTime() <= today.getTime(); i++) {
      next = advanceDue(next, existing.recurring, anchor)
    }
    updated.nextDue = next ? next.toISOString() : null
  } else if (!explicitNextDue) {
    const recurrenceChanged = body.recurring !== undefined && body.recurring !== existing.recurring
    const dateMoved = body.date !== undefined && dayTime(finalDate) !== dayTime(existing.date)
    if (updated.recurring === 'NONE') updated.nextDue = null
    else if (dateMoved || recurrenceChanged || !existing.nextDue) {
      updated.nextDue =
        dayTime(finalDate) > startOfDay(new Date()).getTime()
          ? computeNextDue(finalDate, updated.recurring, new Date(finalDate).getDate())
          : nextDueAfterToday(finalDate, updated.recurring, new Date(finalDate).getDate())
    }
  }

  await put('transactions', updated)
  return { ok: true, data: updated }
}

async function deleteTransaction(id: string) {
  if (!(await getOne<TransactionItem>('transactions', id))) return { ok: false, error: 'Buchung nicht gefunden.' }
  await remove('transactions', id)
  return { ok: true, data: { ok: true } }
}

async function bookTransaction(id: string) {
  const existing = await getOne<TransactionItem>('transactions', id)
  if (!existing) return { ok: false, error: 'Buchung nicht gefunden.' }
  if (existing.recurring === 'NONE') return { ok: false, error: 'Nur Fixposten können gebucht werden.' }
  const now = new Date()
  const startToday = startOfDay(now)
  const anchor = new Date(existing.date).getDate()
  let next: Date | null = existing.nextDue
    ? advanceDue(new Date(existing.nextDue), existing.recurring, anchor)
    : nextRecurringDate(now, existing.recurring, anchor)
  for (let i = 0; i < 500 && next && next.getTime() <= startToday.getTime(); i++) {
    next = advanceDue(next, existing.recurring, anchor)
  }
  const booked: TransactionItem = {
    id: uid(),
    title: existing.title,
    amount: existing.amount,
    type: existing.type,
    category: existing.category,
    date: now.toISOString(),
    recurring: 'NONE',
    nextDue: null,
  }
  const template: TransactionItem = { ...existing, nextDue: next ? next.toISOString() : null }
  await put('transactions', booked)
  await put('transactions', template)
  return { ok: true, data: { booked, template } }
}

// ---------- Notizen ----------

async function createNote(body: Record<string, unknown>) {
  const title = normalizeText(body.title, 120)
  if (!title) return { ok: false, error: 'Titel ist erforderlich.' }
  const restored = body.updatedAt ? validDate(body.updatedAt) : null
  const note: NoteItem = {
    id: uid(),
    title,
    content: typeof body.content === 'string' ? body.content.slice(0, 4000) : '',
    pinned: body.pinned === true,
    updatedAt: restored ?? isoNow(),
  }
  await put('notes', note)
  return { ok: true, data: note }
}

async function updateNote(id: string, body: Record<string, unknown>) {
  const existing = await getOne<NoteItem>('notes', id)
  if (!existing) return { ok: false, error: 'Notiz nicht gefunden.' }
  const title = body.title !== undefined ? normalizeText(body.title, 120) : existing.title
  if (!title) return { ok: false, error: 'Titel ist erforderlich.' }
  const note: NoteItem = {
    ...existing,
    title,
    content: body.content !== undefined ? String(body.content).slice(0, 4000) : existing.content,
    pinned: body.pinned !== undefined ? Boolean(body.pinned) : existing.pinned,
    updatedAt: isoNow(),
  }
  await put('notes', note)
  return { ok: true, data: note }
}

async function deleteNote(id: string) {
  if (!(await getOne<NoteItem>('notes', id))) return { ok: false, error: 'Notiz nicht gefunden.' }
  await remove('notes', id)
  return { ok: true, data: { ok: true } }
}

// ---------- Import ----------

interface BackupData {
  budget?: unknown
  events?: unknown[]
  tasks?: unknown[]
  transactions?: unknown[]
  notes?: unknown[]
}

async function importBackup(body: Record<string, unknown>) {
  const data = body.data as BackupData | undefined
  if (!data || typeof data !== 'object') return { ok: false, error: 'Keine gültigen Backup-Daten.' }
  const replace = body.mode === 'replace'
  const events = Array.isArray(data.events) ? data.events : []
  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  const notes = Array.isArray(data.notes) ? data.notes : []
  if (events.length + tasks.length + transactions.length + notes.length === 0) {
    return { ok: false, error: 'Das Backup enthält keine verwertbaren Einträge.' }
  }

  const nextEvents: EventItem[] = []
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    if (typeof e.title !== 'string' || !e.title.trim()) continue
    const date = validDate(e.date)
    if (!date) continue
    nextEvents.push({
      id: uid(),
      title: e.title.trim().slice(0, 120),
      date,
      place: typeof e.place === 'string' && e.place.trim() ? e.place.trim().slice(0, 120) : null,
      note: typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 500) : null,
      priority: normalizePriority(e.priority),
      recurring: normalizeRecurring(e.recurring, EVENT_RECURRING),
    })
  }

  const nextTasks: StoredTask[] = []
  for (const raw of tasks) {
    if (!raw || typeof raw !== 'object') continue
    const t = raw as Record<string, unknown>
    if (typeof t.title !== 'string' || !t.title.trim()) continue
    const dueDate = t.dueDate ? validDate(t.dueDate) : null
    const done = t.done === true
    const completedAt = done ? validDate(t.completedAt) ?? isoNow() : null
    const recurring = normalizeRecurring(t.recurring, TASK_RECURRING)
    nextTasks.push({
      id: uid(),
      title: t.title.trim().slice(0, 120),
      dueDate,
      priority: normalizePriority(t.priority),
      recurring,
      recurringAnchor:
        typeof t.recurringAnchor === 'number' && t.recurringAnchor >= 1 && t.recurringAnchor <= 31
          ? t.recurringAnchor
          : dueDate
            ? new Date(dueDate).getDate()
            : null,
      done,
      completedAt,
      createdAt: isoNow(),
    })
  }

  const nextTransactions: TransactionItem[] = []
  for (const raw of transactions) {
    if (!raw || typeof raw !== 'object') continue
    const t = raw as Record<string, unknown>
    if (typeof t.title !== 'string' || !t.title.trim()) continue
    const amount = Number(t.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    if (t.type !== 'INCOME' && t.type !== 'EXPENSE') continue
    const date = validDate(t.date) ?? isoNow()
    const recurring = normalizeRecurring(t.recurring, TX_RECURRING)
    const storedNext = recurring === 'NONE' ? null : validDate(t.nextDue)
    nextTransactions.push({
      id: uid(),
      title: t.title.trim().slice(0, 120),
      amount: Math.round(amount * 100) / 100,
      type: t.type,
      category: normalizeCategory(t.category),
      date,
      recurring,
      nextDue: storedNext ?? computeNextDue(date, recurring, new Date(date).getDate()),
    })
  }

  const nextNotes: NoteItem[] = []
  for (const raw of notes) {
    if (!raw || typeof raw !== 'object') continue
    const n = raw as Record<string, unknown>
    if (typeof n.title !== 'string' || !n.title.trim()) continue
    nextNotes.push({
      id: uid(),
      title: n.title.trim().slice(0, 120),
      content: typeof n.content === 'string' ? n.content.slice(0, 4000) : '',
      pinned: n.pinned === true,
      updatedAt: validDate(n.updatedAt) ?? isoNow(),
    })
  }

  const imported = nextEvents.length + nextTasks.length + nextTransactions.length + nextNotes.length
  if (replace && imported === 0) return { ok: false, error: 'Keine verwertbaren Einträge.' }

  if (replace) {
    await Promise.all([
      clear('events'),
      clear('tasks'),
      clear('transactions'),
      clear('notes'),
      remove('settings', SETTING_BUDGET),
    ])
  }
  for (const event of nextEvents) await put('events', event)
  for (const task of nextTasks) await put('tasks', task)
  for (const transaction of nextTransactions) await put('transactions', transaction)
  for (const note of nextNotes) await put('notes', note)

  const budget = Number(data.budget)
  if (Number.isFinite(budget) && budget > 0) await setBudget(budget)

  return {
    ok: true,
    data: {
      ok: true,
      counts: {
        events: nextEvents.length,
        tasks: nextTasks.length,
        transactions: nextTransactions.length,
        notes: nextNotes.length,
      },
    },
  }
}

// ---------- Lokale API-Fassade ----------

export interface LocalResult<T = unknown> {
  ok: boolean
  data: T | null
  error?: string
}

async function dispatch<T>(url: string, method: string, body?: Record<string, unknown>): Promise<LocalResult<T>> {
  const path = url.split('?')[0].replace(/\/$/, '')
  const segments = path.split('/').filter(Boolean)
  if (segments[0] !== 'api') return { ok: false, data: null, error: 'Unbekannter Pfad.' }
  const [resource, id, action] = segments.slice(1)
  const payload = body ?? {}

  try {
    if (resource === 'events') {
      if (!id && method === 'GET') {
        const { events } = await loadAllData()
        return { ok: true, data: events as T }
      }
      if (!id && method === 'POST') return (await createEvent(payload)) as LocalResult<T>
      if (id && method === 'PATCH') return (await updateEvent(id, payload)) as LocalResult<T>
      if (id && method === 'DELETE') return (await deleteEvent(id)) as LocalResult<T>
    }
    if (resource === 'tasks') {
      if (!id && method === 'GET') {
        const { tasks } = await loadAllData()
        return { ok: true, data: tasks as T }
      }
      if (!id && method === 'POST') return (await createTask(payload)) as LocalResult<T>
      if (id && method === 'PATCH') return (await updateTask(id, payload)) as LocalResult<T>
      if (id && method === 'DELETE') return (await deleteTask(id)) as LocalResult<T>
    }
    if (resource === 'transactions') {
      if (!id && method === 'GET') {
        const { transactions } = await loadAllData()
        return { ok: true, data: transactions as T }
      }
      if (!id && method === 'POST') return (await createTransaction(payload)) as LocalResult<T>
      if (id && action === 'book' && method === 'POST') return (await bookTransaction(id)) as LocalResult<T>
      if (id && method === 'PATCH') return (await updateTransaction(id, payload)) as LocalResult<T>
      if (id && method === 'DELETE') return (await deleteTransaction(id)) as LocalResult<T>
    }
    if (resource === 'notes') {
      if (!id && method === 'GET') {
        const { notes } = await loadAllData()
        return { ok: true, data: notes as T }
      }
      if (!id && method === 'POST') return (await createNote(payload)) as LocalResult<T>
      if (id && method === 'PATCH') return (await updateNote(id, payload)) as LocalResult<T>
      if (id && method === 'DELETE') return (await deleteNote(id)) as LocalResult<T>
    }
    if (resource === 'budget') {
      if (method === 'GET') return { ok: true, data: { amount: await getBudget() } as T }
      if (method === 'PUT') {
        if (payload.amount === undefined) return { ok: false, data: null, error: 'Betrag fehlt.' }
        await setBudget(payload.amount === null ? null : Number(payload.amount))
        return { ok: true, data: { ok: true, amount: payload.amount === null ? null : await getBudget() } as T }
      }
    }
    if (resource === 'import' && method === 'POST') return (await importBackup(payload)) as LocalResult<T>
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : 'Lokaler Fehler.' }
  }
  return { ok: false, data: null, error: 'Unbekannte Aktion.' }
}

/** Entspricht dem früheren /api-Fetch, arbeitet aber vollständig lokal. */
export async function localRequest<T = unknown>(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
  body?: unknown
): Promise<LocalResult<T>> {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined
  if (method === 'GET') return dispatch<T>(url, method, payload)
  return mutate(() => dispatch<T>(url, method, payload))
}

/** CSV-Export als lokaler Download (Semikolon, BOM, deutsches Dezimalkomma). */
export function buildTransactionsCsv(transactions: TransactionItem[]): string {
  const labels: Record<string, string> = {
    NONE: '',
    DAILY: 'täglich',
    WEEKLY: 'wöchentlich',
    MONTHLY: 'monatlich',
    YEARLY: 'jährlich',
  }
  const esc = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = ['Datum;Titel;Kategorie;Art;Betrag (EUR);Wiederholung']
  const rows = transactions
    .filter((transaction) => transaction.recurring === 'NONE')
    .sort((a, b) => a.date.localeCompare(b.date))
  for (const transaction of rows) {
    const date = new Date(transaction.date)
    const datum = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const betrag = transaction.amount.toFixed(2).replace('.', ',')
    const art = transaction.type === 'INCOME' ? 'Einnahme' : 'Ausgabe'
    lines.push(
      [datum, esc(transaction.title), esc(transaction.category), art, betrag, esc(labels[transaction.recurring] ?? '')].join(';')
    )
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

export function downloadCsv(transactions: TransactionItem[]): void {
  const csv = buildTransactionsCsv(transactions)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zentrale-finanzen-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
