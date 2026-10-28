'use client'

import { useSyncExternalStore } from 'react'
import { getLastBackupAt } from './localdb'

/** Ein kleiner Store, damit Heute und Einstellungen nach einem Export sofort aktualisieren. */
function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => onChange()
  window.addEventListener('zentrale-backup-updated', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('zentrale-backup-updated', handler)
    window.removeEventListener('storage', handler)
  }
}

export function useLastBackupAt(): number | null {
  return useSyncExternalStore(subscribe, getLastBackupAt, () => null)
}
