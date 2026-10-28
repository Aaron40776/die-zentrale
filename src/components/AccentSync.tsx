'use client'

import { useEffect } from 'react'

const VALID = ['gold', 'kupfer', 'salbei'] as const
type Accent = (typeof VALID)[number]

/** Übernimmt die lokale Akzentwahl früh in das DOM (die App ist rein clientseitig). */
export function AccentSync() {
  useEffect(() => {
    try {
      const current = document.documentElement.getAttribute('data-accent')
      const stored = localStorage.getItem('zentrale-accent')
      const accent: Accent =
        stored && VALID.includes(stored as Accent)
          ? (stored as Accent)
          : current && VALID.includes(current as Accent)
            ? (current as Accent)
            : 'gold'
      if (accent === 'gold') document.documentElement.removeAttribute('data-accent')
      else document.documentElement.setAttribute('data-accent', accent)
    } catch {
      /* Speicher nicht verfügbar */
    }
  }, [])

  return null
}
