import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface SprintChartSeries {
  key: string
  label: string
  color: string
  dashed?: boolean
}

export interface SprintChartPoint {
  sprintName: string
  [key: string]: number | string | undefined
}

interface Props {
  series: SprintChartSeries[]
  data: SprintChartPoint[]
  yLabel?: string
  height?: number
}

const PAD = { top: 16, right: 40, bottom: 36, left: 48 }
const MIN_POINT_SPACING = 14

/** Round axis maximum + step to "nice" numbers (1, 2, 2.5, 5 × 10^n). */
function niceScale(max: number, ticks = 5): { max: number; step: number } {
  if (max <= 0) return { max: 1, step: 0.2 }
  const raw = max / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  const step = nice * mag
  return { max: Math.ceil(max / step) * step, step }
}

function fmt(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)
}

/**
 * Multi-series line chart over sprints. Renders at the container's pixel width (crisp text),
 * with a crosshair + tooltip on hover and arrow-key navigation when focused.
 */
export default function SprintLineChart({ series, data, yLabel, height = 260 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(800)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setContainerW(Math.round(entry.contentRect.width)))
    ro.observe(el)
    setContainerW(el.clientWidth || 800)
    return () => ro.disconnect()
  }, [])

  if (data.length === 0) return null

  const minW = Math.max(PAD.left + PAD.right + (data.length - 1) * MIN_POINT_SPACING, 300)
  const W = Math.max(containerW, minW)
  const H = height
  const left = PAD.left + (yLabel ? 16 : 0)
  const chartW = W - left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const allVals: number[] = data.flatMap((d) =>
    series.map((s) => (typeof d[s.key] === 'number' ? (d[s.key] as number) : NaN)).filter((v) => !isNaN(v)),
  )
  const rawMax = allVals.length > 0 ? Math.max(...allVals) : 1
  const { max: yMax, step } = niceScale(rawMax)
  const yTicks: number[] = []
  for (let v = 0; v <= yMax + step / 2; v += step) yTicks.push(Number(v.toFixed(6)))

  const xPos = (i: number) => (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)
  const yPos = (v: number) => chartH - (v / (yMax || 1)) * chartH

  function buildPath(seriesKey: string) {
    const pts = data
      .map((d, i) => {
        const v = d[seriesKey]
        if (typeof v !== 'number') return null
        return `${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`
      })
      .filter(Boolean)
    if (pts.length < 2) return ''
    return `M ${pts.join(' L ')}`
  }

  // Skip x labels when they would collide
  const spacing = data.length > 1 ? chartW / (data.length - 1) : chartW
  const labelEvery = Math.max(1, Math.ceil(84 / spacing))

  const colW = data.length > 1 ? chartW / (data.length - 1) : chartW

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHoveredIdx((i) => (i === null ? 0 : Math.min(data.length - 1, i + 1))) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setHoveredIdx((i) => (i === null ? data.length - 1 : Math.max(0, i - 1))) }
    else if (e.key === 'Escape') setHoveredIdx(null)
  }

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null
  const visibleSeries = hovered ? series.filter((s) => typeof hovered[s.key] === 'number') : []
  const tipX = hoveredIdx !== null ? left + xPos(hoveredIdx) : 0
  // Tooltip: right of the crosshair, else left of it, else clamped inside the chart
  const TT_W = 184
  const tipLeft =
    tipX + 12 + TT_W <= W ? tipX + 12
      : tipX - 12 - TT_W >= 0 ? tipX - 12 - TT_W
        : Math.max(0, Math.min(W - TT_W, tipX - TT_W / 2))

  const single = series.length === 1

  return (
    <div ref={wrapRef} className="relative w-full overflow-x-auto scrollbar-thin">
      <div className="relative" style={{ width: W }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={series.map((s) => s.label).join(', ')}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setHoveredIdx(null)}
          onMouseLeave={() => setHoveredIdx(null)}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          {single && (
            <defs>
              <linearGradient id="slc-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={series[0].color} stopOpacity={0.14} />
                <stop offset="100%" stopColor={series[0].color} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          <g transform={`translate(${left},${PAD.top})`}>
            {/* Grid + y ticks */}
            {yTicks.map((tick) => {
              const y = yPos(tick)
              return (
                <g key={tick}>
                  <line x1={0} y1={y} x2={chartW} y2={y} strokeWidth={1} className={tick === 0 ? 'stroke-slate-300 dark:stroke-slate-700' : 'stroke-slate-100 dark:stroke-slate-800'} />
                  <text x={-10} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} className="fill-slate-400 dark:fill-slate-500 tabular-nums">
                    {fmt(tick)}
                  </text>
                </g>
              )
            })}

            {yLabel && (
              <text transform={`translate(${-left + 12},${chartH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} className="fill-slate-400 dark:fill-slate-500">
                {yLabel}
              </text>
            )}

            {/* X labels */}
            {data.map((d, i) => (data.length - 1 - i) % labelEvery === 0 && (
              <text
                key={i}
                x={xPos(i)}
                y={chartH + 20}
                textAnchor="middle"
                fontSize={11}
                className={hoveredIdx === i ? 'fill-slate-900 dark:fill-slate-100 font-medium' : 'fill-slate-500 dark:fill-slate-400'}
              >
                {d.sprintName}
              </text>
            ))}

            {/* Crosshair */}
            {hoveredIdx !== null && (
              <line x1={xPos(hoveredIdx)} y1={0} x2={xPos(hoveredIdx)} y2={chartH} strokeWidth={1} className="stroke-slate-300 dark:stroke-slate-600" />
            )}

            {/* Area wash for a single series */}
            {single && (() => {
              const path = buildPath(series[0].key)
              if (!path) return null
              const idx = data.map((d, i) => (typeof d[series[0].key] === 'number' ? i : -1)).filter((i) => i >= 0)
              const area = `${path} L ${xPos(idx[idx.length - 1]).toFixed(1)},${chartH} L ${xPos(idx[0]).toFixed(1)},${chartH} Z`
              return <path d={area} fill="url(#slc-area)" />
            })()}

            {/* Lines */}
            {series.map((s) => {
              const path = buildPath(s.key)
              if (!path) return null
              return (
                <path
                  key={s.key}
                  d={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                />
              )
            })}

            {/* Markers (with a ring in the surface color) */}
            {data.map((d, i) => series.map((s) => {
              const v = d[s.key]
              if (typeof v !== 'number') return null
              const active = hoveredIdx === i
              return (
                <circle
                  key={`${s.key}-${i}`}
                  cx={xPos(i)}
                  cy={yPos(v)}
                  r={active ? 5.5 : 4}
                  fill={s.color}
                  strokeWidth={2}
                  className="stroke-white dark:stroke-slate-900 transition-[r] duration-100"
                />
              )
            }))}

            {/* Hit areas */}
            {data.map((_, i) => (
              <rect
                key={i}
                x={xPos(i) - colW / 2}
                y={0}
                width={colW}
                height={chartH + PAD.bottom}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
              />
            ))}
          </g>
        </svg>

        {/* Tooltip */}
        {hovered && visibleSeries.length > 0 && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-popover backdrop-blur animate-fade-in dark:border-slate-700 dark:bg-slate-800/95"
            style={{ top: PAD.top, left: tipLeft, width: TT_W }}
            role="status"
          >
            <p className="mb-1.5 truncate font-semibold text-slate-900 dark:text-slate-100">{hovered.sprintName}</p>
            <ul className="space-y-1">
              {visibleSeries.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">{s.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmt(hovered[s.key] as number)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
