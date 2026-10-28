'use client'

import { useSyncExternalStore } from 'react'
import { localRequest } from './localdb'
import type { EventItem, NoteItem, TaskItem, TransactionItem } from './types'

const KEY = 'die-zentrale-recovery-v1'
const EVENT = 'zentrale-recovery-updated'

export interface RecoveryData {
  events: EventItem[]
  tasks: TaskItem[]
  transactions: TransactionItem[]
  notes: NoteItem[]
}

export interface RecoverySnapshot {
  savedAt: number
  data: RecoveryData
  budget: number | null
}

let cachedRaw: string | null = null
let cached: RecoverySnapshot | null = null

function countEntries(data: RecoveryData): number {
  return data.events.length + data.tasks.length + data.transactions.length + data.notes.length
}

function parse(raw: string | null): RecoverySnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RecoverySnapshot>
    const data = parsed.data
    if (
      !data ||
      !Array.isArray(data.events) ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.transactions) ||
      !Array.isArray(data.notes) ||
      typeof parsed.savedAt !== 'number' ||
      countEntries(data) === 0
    ) {
      return null
    }
    return {
      savedAt: parsed.savedAt,
      data,
      budget: typeof parsed.budget === 'number' && parsed.budget > 0 ? parsed.budget : null,
    }
  } catch {
    return null
  }
}

/** Liest die letzte automatische Kopie aus localStorage; gecacht für ruhige Renders. */
export function readRecoverySnapshot(): RecoverySnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === cachedRaw) return cached
    cachedRaw = raw
    cached = parse(raw)
    return cached
  } catch {
    return null
  }
}

function notify() {
  window.dispatchEvent(new Event(EVENT))
}

/** Schreibt bei jeder Änderung eine kompakte, lokale Kopie – ohne Nutzeraktion. */
export function writeRecoverySnapshot(data: RecoveryData, budget: number | null = null): void {
  if (typeof window === 'undefined' || countEntries(data) === 0) return
  try {
    const payload: RecoverySnapshot = { savedAt: Date.now(), data, budget }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
    cachedRaw = null
    notify()
  } catch {
    // Quota voll oder localStorage gesperrt: Die App bleibt nutzbar, der Export bleibt der Fallback.
  }
}

export function clearRecoverySnapshot(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
    cachedRaw = null
    cached = null
    notify()
  } catch {
    /* ignorieren */
  }
}

export async function restoreRecoverySnapshot(): Promise<{ ok: boolean; count: number; error?: string }> {
  const snapshot = readRecoverySnapshot()
  if (!snapshot) return { ok: false, count: 0, error: 'Keine lokale Sicherung gefunden.' }
  const result = await localRequest('/api/import', 'POST', {
    data: { ...snapshot.data, budget: snapshot.budget },
    mode: 'replace',
  })
  if (!result.ok) return { ok: false, count: 0, error: result.error ?? 'Sicherung konnte nicht wiederhergestellt werden.' }
  return { ok: true, count: countEntries(snapshot.data) }
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => onChange()
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function useRecoverySnapshot(): RecoverySnapshot | null {
  return useSyncExternalStore(subscribe, readRecoverySnapshot, () => null)
}

/** Netlify-Branch-/Deploy-Previews haben eine eigene Origin und damit einen eigenen Speicher. */
export function isPreviewOrigin(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('.netlify.app') && window.location.hostname.includes('--')
}

export function recoveryCount(snapshot: RecoverySnapshot | null): number {
  return snapshot ? countEntries(snapshot.data) : 0
}
