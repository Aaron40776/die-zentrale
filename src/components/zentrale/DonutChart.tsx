'use client'

import { fmtEur } from '@/lib/zentrale/date'

export interface DonutSlice {
  label: string
  amount: number
  color: string
}

interface DonutSeg extends DonutSlice {
  len: number
  offset: number
  pct: number
}

// Reine Hilfsfunktion (keine Mutation von Render-Variablen)
function buildSegs(slices: DonutSlice[], total: number, circumference: number): DonutSeg[] {
  const segs: DonutSeg[] = []
  let acc = 0
  for (const s of slices) {
    const frac = total > 0 ? s.amount / total : 0
    segs.push({ ...s, len: Math.max(frac * circumference - 2.5, 0.6), offset: acc, pct: Math.round(frac * 100) })
    acc += frac * circumference
  }
  return segs
}

/** Donut-Chart (SVG, ohne Abhängigkeiten) für Ausgaben nach Kategorie. */
export function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, x) => s + x.amount, 0)
  const r = 56
  const C = 2 * Math.PI * r
  const segs = buildSegs(slices, total, C)

  return (
    <div>
      <svg viewBox="0 0 140 140" className="mx-auto h-40 w-40" role="img" aria-label={`Ausgaben nach Kategorie, insgesamt ${fmtEur(total)}`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#2b2823" strokeWidth="20" />
        <g transform="rotate(-90 70 70)">
          {segs.map((s) => (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${s.len} ${C - s.len}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text x="70" y="64" textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
          Ausgaben
        </text>
        <text x="70" y="81" textAnchor="middle" className="fill-foreground text-[14px] font-bold">
          {fmtEur(total)}
        </text>
      </svg>

      <ul className="mt-4 space-y-1.5">
        {segs.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">{fmtEur(s.amount)}</span>
            <span className="w-10 shrink-0 whitespace-nowrap text-right tabular-nums text-stone-500">{s.pct}&thinsp;%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
