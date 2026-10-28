'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventItem, NoteItem, TaskItem, TransactionItem } from './types'

export interface ZentraleData {
  events: EventItem[]
  tasks: TaskItem[]
  transactions: TransactionItem[]
  notes: NoteItem[]
}

const EMPTY: ZentraleData = { events: [], tasks: [], transactions: [], notes: [] }

/** Lädt alle vier Bereiche und bietet refresh() nach jeder Änderung. */
export function useZentrale() {
  const [data, setData] = useState<ZentraleData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current
    try {
      const [events, tasks, transactions, notes] = await Promise.all(
        (['/api/events', '/api/tasks', '/api/transactions', '/api/notes'] as const).map(async (url) => {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`Fehler bei ${url}`)
          return res.json()
        })
      )
      if (requestId !== requestRef.current) return
      setData({ events, tasks, transactions, notes })
      setError(null)
    } catch {
      if (requestId !== requestRef.current) return
      setError('Daten konnten nicht geladen werden. Bitte Seite neu laden.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // asynchron anstoßen, damit der erste Render nicht durch setState im Effect kaskadiert
    queueMicrotask(() => void refresh())
  }, [refresh])

  return { ...data, loading, error, refresh }
}

/** Kleiner Fetch-Wrapper für Mutationen. */
export async function apiSend(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return res.ok
  } catch {
    return false
  }
}

/** Wie apiSend, liefert aber den erzeugten Datensatz zurück (für Undo-Wiederherstellung u. ä.). */
export async function apiSendJson<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
