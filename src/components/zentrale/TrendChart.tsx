'use client'

import { useMemo } from 'react'
import { dayKey, fmtEur } from '@/lib/zentrale/date'
import { isPlannedEntry } from '@/lib/zentrale/finance'
import type { TransactionItem } from '@/lib/zentrale/types'

interface MonthBucket {
  key: string
  label: string
  inSum: number
  outSum: number
  current: boolean
}

const W = 324
const H = 148
const BASE_Y = 118
const MAX_BAR = 84
const PAD = 10

/** 6-Monats-Verlauf: Einnahmen (grün) vs. Ausgaben (rot) als schlanke SVG-Balken. */
export function TrendChart({ transactions }: { transactions: TransactionItem[] }) {
  const months = useMemo<MonthBucket[]>(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const tx = transactions.filter((t) => dayKey(new Date(t.date)).slice(0, 7) === key && !isPlannedEntry(t))
      return {
        key,
        label: new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(d).replace('.', ''),
        inSum: tx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
        outSum: tx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
        current: i === 5,
      }
    })
  }, [transactions])

  const max = Math.max(1, ...months.map((m) => Math.max(m.inSum, m.outSum)))
  const groupW = (W - PAD * 2) / 6
  const barW = 12
  const gap = 5

  function barHeight(v: number): number {
    return Math.max(v > 0 ? 3 : 0, Math.round((v / max) * MAX_BAR))
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">Verlauf – 6 Monate</p>
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span aria-hidden className="h-2 w-2 rounded-sm bg-green-400" /> ein
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="h-2 w-2 rounded-sm bg-red-400" /> aus
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Balkendiagramm: Einnahmen und Ausgaben der letzten sechs Monate">
        <line x1={PAD} y1={BASE_Y} x2={W - PAD} y2={BASE_Y} stroke="#3a3733" strokeWidth="1" />
        {months.map((m, i) => {
          const cx = PAD + groupW * i + groupW / 2
          const xIn = cx - barW - gap / 2
          const xOut = cx + gap / 2
          const hIn = barHeight(m.inSum)
          const hOut = barHeight(m.outSum)
          return (
            <g key={m.key}>
              {m.inSum > 0 && (
                <rect x={xIn} y={BASE_Y - hIn} width={barW} height={hIn} rx="2.5" fill="#4ade80">
                  <title>{`${m.label}: ${fmtEur(m.inSum)} ein`}</title>
                </rect>
              )}
              {m.outSum > 0 && (
                <rect x={xOut} y={BASE_Y - hOut} width={barW} height={hOut} rx="2.5" fill="#f87171">
                  <title>{`${m.label}: ${fmtEur(m.outSum)} aus`}</title>
                </rect>
              )}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fontWeight={m.current ? '700' : '400'}
                fill={m.current ? '#d6d3d1' : '#78716c'}
              >
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
