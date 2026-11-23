export type MeterTone = 'indigo' | 'emerald' | 'amber' | 'red' | 'sky' | 'violet' | 'slate'

/** Fill + matching lighter track of the same hue, so state reads across the whole bar. */
const toneCls: Record<MeterTone, { fill: string; track: string }> = {
  indigo:  { fill: 'bg-indigo-500 dark:bg-indigo-400',   track: 'bg-indigo-100 dark:bg-indigo-500/15' },
  emerald: { fill: 'bg-emerald-500 dark:bg-emerald-400', track: 'bg-emerald-100 dark:bg-emerald-500/15' },
  amber:   { fill: 'bg-amber-500 dark:bg-amber-400',     track: 'bg-amber-100 dark:bg-amber-500/15' },
  red:     { fill: 'bg-red-500 dark:bg-red-400',         track: 'bg-red-100 dark:bg-red-500/15' },
  sky:     { fill: 'bg-sky-500 dark:bg-sky-400',         track: 'bg-sky-100 dark:bg-sky-500/15' },
  violet:  { fill: 'bg-violet-500 dark:bg-violet-400',   track: 'bg-violet-100 dark:bg-violet-500/15' },
  slate:   { fill: 'bg-slate-400 dark:bg-slate-500',     track: 'bg-slate-100 dark:bg-slate-800' },
}

interface MeterProps {
  /** 0–100 */
  value: number
  tone?: MeterTone
  size?: 'xs' | 'sm' | 'md'
  /** Neutral track instead of a tinted one (for comparisons across rows) */
  neutralTrack?: boolean
  /** Optional marker (0–100), e.g. team average */
  marker?: number
  markerLabel?: string
  label?: string
  className?: string
}

/** Thin horizontal progress / meter bar with rounded ends. */
export default function Meter({
  value, tone = 'indigo', size = 'sm', neutralTrack, marker, markerLabel, label, className = '',
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, value))
  const h = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2.5'
  const c = toneCls[tone]
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={`relative w-full overflow-hidden rounded-full ${h} ${neutralTrack ? toneCls.slate.track : c.track} ${className}`}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${c.fill}`}
        style={{ width: `${pct}%` }}
      />
      {marker !== undefined && (
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-slate-700/70 dark:bg-slate-200/70"
          style={{ left: `${Math.max(0, Math.min(100, marker))}%` }}
          title={markerLabel}
          aria-hidden
        />
      )}
    </div>
  )
}
