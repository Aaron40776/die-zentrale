'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getBudget, loadAllData, localRequest } from './localdb'
import { writeRecoverySnapshot } from './recovery'
import type { EventItem, NoteItem, TaskItem, TransactionItem } from './types'

export interface ZentraleData {
  events: EventItem[]
  tasks: TaskItem[]
  transactions: TransactionItem[]
  notes: NoteItem[]
}

const EMPTY: ZentraleData = { events: [], tasks: [], transactions: [], notes: [] }

/** Lädt alle vier Bereiche aus IndexedDB und bietet refresh() nach jeder Änderung. */
export function useZentrale() {
  const [data, setData] = useState<ZentraleData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current
    try {
      const next = await loadAllData()
      if (requestId !== requestRef.current) return
      setData(next)
      setError(null)
      // Automatische lokale Kopie, damit ein Datenbank-Reset rekonstruierbar bleibt.
      const budget = await getBudget().catch(() => null)
      writeRecoverySnapshot(next, budget)
    } catch {
      if (requestId !== requestRef.current) return
      setError('Daten konnten nicht geladen werden. Bitte die App neu öffnen.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // asynchron anstoßen, damit der erste Render nicht durch setState im Effect kaskadiert
    queueMicrotask(() => void refresh())
  }, [refresh])

  useEffect(() => {
    // Persistenz erst nach einer echten Geste anfragen; iOS/Chrome entscheiden dann besser.
    const ask = () => {
      try {
        void navigator.storage?.persist?.()
      } catch {
        /* optional */
      }
    }
    window.addEventListener('pointerdown', ask, { once: true, passive: true })
    return () => window.removeEventListener('pointerdown', ask)
  }, [])

  return { ...data, loading, error, refresh }
}

/** Kleiner Wrapper für lokale Mutationen (behält die bisherigen Aufrufstellen bei). */
export async function apiSend(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<boolean> {
  const result = await localRequest(url, method, body)
  return result.ok
}

/** Wie apiSend, liefert aber den erzeugten Datensatz zurück (für Undo-Wiederherstellung u. ä.). */
export async function apiSendJson<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T | null> {
  const result = await localRequest<T>(url, method, body)
  return result.ok ? result.data : null
}
