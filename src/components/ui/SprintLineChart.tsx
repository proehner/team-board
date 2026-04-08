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

export default function SprintLineChart({ series, data, yLabel, height = 260 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (data.length === 0) return null

  const W = 800
  const H = height
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

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
        style={{ minWidth: Math.max(data.length * 60, 320) }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
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

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={xPos(i)}
              y={chartH + 18}
              textAnchor="middle"
              fontSize={11}
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
