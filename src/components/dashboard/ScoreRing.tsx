interface ScoreRingProps {
  /** 0–100 */
  value: number
  size?: number
  stroke?: number
  tone: 'emerald' | 'amber' | 'red'
  label?: string
}

const toneCls = {
  emerald: { arc: 'stroke-emerald-500 dark:stroke-emerald-400', track: 'stroke-emerald-100 dark:stroke-emerald-500/15' },
  amber:   { arc: 'stroke-amber-500 dark:stroke-amber-400',     track: 'stroke-amber-100 dark:stroke-amber-500/15' },
  red:     { arc: 'stroke-red-500 dark:stroke-red-400',         track: 'stroke-red-100 dark:stroke-red-500/15' },
}

/** Circular gauge with the value in the center. */
export default function ScoreRing({ value, size = 112, stroke = 10, tone, label }: ScoreRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const cls = toneCls[tone]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={cls.track} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={`${cls.arc} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{Math.round(pct)}</span>
        <span className="text-2xs font-medium text-slate-400 dark:text-slate-500">/ 100</span>
      </div>
    </div>
  )
}
