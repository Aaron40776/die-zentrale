'use client'

import { useEffect, useRef } from 'react'
import { fmtEur } from '@/lib/zentrale/date'
import { cn } from '@/lib/utils'

/**
 * Große Geldbeträge zählen bei Änderungen kurz hoch, statt hart zu springen.
 * Der erste Render zeigt immer den echten Wert – wichtig für Hydration und Vertrauen.
 */
export function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const displayed = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const from = displayed.current
    if (from === value) {
      el.textContent = fmtEur(value)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayed.current = value
      el.textContent = fmtEur(value)
      return
    }

    el.textContent = fmtEur(from)
    const start = performance.now()
    const duration = 360
    let raf = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (value - from) * eased
      displayed.current = current
      el.textContent = fmtEur(current)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        displayed.current = value
        el.textContent = fmtEur(value)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <span ref={ref} className={cn('inline-block tabular-nums', className)}>
      {fmtEur(value)}
    </span>
  )
}
