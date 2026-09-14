import { useState } from 'react'

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

const PAD = { top: 16, right: 16, bottom: 48, left: 52 }

const LABEL_FONT_SIZE = 11
/** Rough width of one character at LABEL_FONT_SIZE, used to lay out x labels. */
const LABEL_CHAR_W = 6.2
/** Extra space each label needs next to its neighbour before it looks cramped. */
const LABEL_GAP = 10

export default function SprintLineChart({ series, data, yLabel, height = 260 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (data.length === 0) return null

  const W = 800

  // ─── X-axis label layout ───────────────────────────────────────────────────
  // Sprint names can be long ("2026_38_39"). Horizontal labels are centred
  // under their data point, so the outermost ones need half a label of side
  // padding. When they would still collide, labels are rotated by 45° instead
  // and the bottom padding grows accordingly.
  const labelW = Math.max(...data.map((d) => String(d.sprintName).length)) * LABEL_CHAR_W
  const halfLabel = Math.round(labelW / 2) + 4
  const horizontalChartW = W - Math.max(PAD.left, halfLabel) - Math.max(PAD.right, halfLabel)
  const slotW = data.length > 1 ? horizontalChartW / (data.length - 1) : horizontalChartW
  const rotateLabels = labelW + LABEL_GAP > slotW

  // Rotated labels reach up and to the left of their anchor point.
  const padLeft  = rotateLabels ? Math.max(PAD.left, Math.round(labelW * 0.71) + 6) : Math.max(PAD.left, halfLabel)
  const padRight = rotateLabels ? PAD.right : Math.max(PAD.right, halfLabel)
  const chartW = W - padLeft - padRight

  const bottomPad = rotateLabels
    ? Math.min(Math.round(labelW * 0.71) + 24, 120)
    : PAD.bottom
  // Keep the plot area at the requested height and grow the SVG instead.
  const H = height + bottomPad - PAD.bottom
  const chartH = H - PAD.top - bottomPad

  // Minimum width so labels stay readable – the container scrolls beyond it.
  const minWidth = Math.max(
    data.length * (rotateLabels ? 30 : labelW + LABEL_GAP + 6) + padLeft + padRight,
    320,
  )

  // Collect all numeric values for y-axis
  const allVals: number[] = data.flatMap((d) =>
    series.map((s) => (typeof d[s.key] === 'number' ? (d[s.key] as number) : NaN)).filter((v) => !isNaN(v)),
  )
  const yMin = 0
  const yMax = allVals.length > 0 ? Math.max(...allVals) : 1
  const yRange = yMax - yMin || 1

  // Tick helpers
  const Y_TICKS = 5
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (yRange * i) / Y_TICKS)

  function xPos(i: number) {
    return data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW
  }
  function yPos(v: number) {
    return chartH - ((v - yMin) / yRange) * chartH
  }

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

  const tooltipX = hoveredIdx !== null ? xPos(hoveredIdx) : null

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <g transform={`translate(${padLeft},${PAD.top})`}>
          {/* Grid lines + y-axis labels */}
          {yTicks.map((tick) => {
            const y = yPos(tick)
            return (
              <g key={tick}>
                <line x1={0} y1={y} x2={chartW} y2={y} stroke="currentColor" strokeWidth={0.5} className="text-slate-200 dark:text-slate-700" />
                <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} className="fill-slate-400 dark:fill-slate-500">
                  {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                </text>
              </g>
            )
          })}

          {/* Y-axis label */}
          {yLabel && (
            <text
              transform={`translate(${-38},${chartH / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={11}
              className="fill-slate-400 dark:fill-slate-500"
            >
              {yLabel}
            </text>
          )}

          {/* X-axis labels – rotated when they would otherwise overlap */}
          {data.map((d, i) => (
            <text
              key={i}
              transform={
                rotateLabels
                  ? `translate(${xPos(i).toFixed(1)},${chartH + 16}) rotate(-45)`
                  : `translate(${xPos(i).toFixed(1)},${chartH + 18})`
              }
              textAnchor={rotateLabels ? 'end' : 'middle'}
              dominantBaseline={rotateLabels ? 'middle' : 'auto'}
              fontSize={LABEL_FONT_SIZE}
              className="fill-slate-500 dark:fill-slate-400"
            >
              {d.sprintName}
            </text>
          ))}

          {/* Series lines */}
          {series.map((s) => {
            const path = buildPath(s.key)
            if (!path) return null
            return (
              <path
                key={s.key}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '6 4' : undefined}
                opacity={0.9}
              />
            )
          })}

          {/* Data points + hover target */}
          {data.map((d, i) => (
            <g key={i}>
              {/* invisible wide hit area per column */}
              <rect
                x={xPos(i) - (data.length > 1 ? chartW / (data.length - 1) / 2 : chartW / 2)}
                y={0}
                width={data.length > 1 ? chartW / (data.length - 1) : chartW}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
              />
              {series.map((s) => {
                const v = d[s.key]
                if (typeof v !== 'number') return null
                return (
                  <circle
                    key={s.key}
                    cx={xPos(i)}
                    cy={yPos(v)}
                    r={hoveredIdx === i ? 5 : 3.5}
                    fill={s.color}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                )
              })}
            </g>
          ))}

          {/* Tooltip */}
          {hoveredIdx !== null && tooltipX !== null && (() => {
            const d = data[hoveredIdx]
            const visibleSeries = series.filter((s) => typeof d[s.key] === 'number')
            if (visibleSeries.length === 0) return null

            const lineH = 18
            const ttW = 148
            const ttH = 14 + visibleSeries.length * lineH + 10
            const rawX = tooltipX + 14
            const ttX = rawX + ttW > chartW ? tooltipX - ttW - 14 : rawX
            const ttY = Math.max(0, Math.min(chartH - ttH, yPos(d[visibleSeries[0].key] as number) - ttH / 2))

            return (
              <g>
                {/* vertical rule */}
                <line x1={tooltipX} y1={0} x2={tooltipX} y2={chartH} stroke="currentColor" strokeWidth={1} className="text-slate-300 dark:text-slate-600" strokeDasharray="4 3" />
                {/* box */}
                <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={6} fill="white" className="dark:fill-slate-800" stroke="currentColor" strokeWidth={0.5} opacity={0.97} />
                <text x={ttX + 10} y={ttY + 14} fontSize={11} fontWeight={600} className="fill-slate-700 dark:fill-slate-200">
                  {d.sprintName}
                </text>
                {visibleSeries.map((s, si) => (
                  <g key={s.key}>
                    <circle cx={ttX + 14} cy={ttY + 14 + (si + 1) * lineH + 1} r={4} fill={s.color} />
                    <text x={ttX + 24} y={ttY + 14 + (si + 1) * lineH + 5} fontSize={11} className="fill-slate-600 dark:fill-slate-300">
                      {s.label}: <tspan fontWeight={600}>{typeof d[s.key] === 'number' ? (Number.isInteger(d[s.key]) ? d[s.key] : (d[s.key] as number).toFixed(1)) : '—'}</tspan>
                    </text>
                  </g>
                ))}
              </g>
            )
          })()}
        </g>
      </svg>
    </div>
  )
}
