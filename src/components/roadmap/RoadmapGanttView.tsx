import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, GanttChartSquare, CalendarOff } from 'lucide-react'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import type { RoadmapFeature, RoadmapQuarter } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import SectionHeader from '@/components/ui/SectionHeader'
import { CompactFeatureCard } from './FeatureCard'
import { ROADMAP_STATUSES, STATUS_META } from './roadmapConfig'

const COL_W  = 80   // px per quarter column
const ROW_H  = 44   // row height
const BAR_H  = 24   // bar height

/** Width of the sticky feature-name column — narrower on phones */
function useLeftWidth() {
  const get = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 240)
  const [w, setW] = useState(get)
  useEffect(() => {
    const onResize = () => setW(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return w
}

interface GanttViewProps {
  features: RoadmapFeature[]
  onFeatureClick: (id: string) => void
  canWrite: boolean
}

export default function RoadmapGanttView({ features, onFeatureClick, canWrite }: GanttViewProps) {
  const { t }                = useTranslation()
  const updateRoadmapFeature = useStore((s) => s.updateRoadmapFeature)
  const LEFT_W               = useLeftWidth()

  const now          = new Date()
  const todayYear    = now.getFullYear()
  const todayQuarter = Math.ceil((now.getMonth() + 1) / 3)
  // fraction (0..1) through current quarter based on day-in-quarter
  const todayFraction = (now.getMonth() % 3) / 3 + now.getDate() / 91

  const [draggingId,  setDraggingId]  = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{
    id: string
    edge: 'start' | 'end'
    currentIdx: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Compute visible year range from all feature dates + ±1 year buffer
  const { minYear, maxYear } = useMemo(() => {
    const years: number[] = [todayYear - 1, todayYear + 1]
    for (const f of features) {
      if (f.startYear)  years.push(f.startYear)
      if (f.targetYear) years.push(f.targetYear)
    }
    return { minYear: Math.min(...years), maxYear: Math.max(...years) }
  }, [features, todayYear])

  const totalCols = (maxYear - minYear + 1) * 4
  const totalW    = totalCols * COL_W

  function colIdxFor(year: number, quarter: number) {
    return (year - minYear) * 4 + (quarter - 1)
  }

  const todayLeft = (colIdxFor(todayYear, todayQuarter) + todayFraction) * COL_W

  // Initially scroll the chart so that the current quarter is in view (esp. on narrow screens)
  const didInitialScroll = useRef(false)
  useEffect(() => {
    const el = containerRef.current
    if (!el || didInitialScroll.current) return
    didInitialScroll.current = true
    el.scrollLeft = Math.max(0, todayLeft - 2 * COL_W)
  }, [todayLeft])

  // Sort key: earliest known quarter index (start preferred; target as fallback)
  function ganttSortKey(f: RoadmapFeature) {
    if (f.startYear && f.startQuarter)   return f.startYear  * 4 + f.startQuarter
    if (f.targetYear && f.targetQuarter) return f.targetYear * 4 + f.targetQuarter
    if (f.targetYear)                    return f.targetYear * 4 + 5  // year-only → after Q4
    return Infinity
  }

  const scheduled = features
    .filter((f) => f.targetYear || f.startYear)
    .slice()
    .sort((a, b) => {
      const d = ganttSortKey(a) - ganttSortKey(b)
      if (d !== 0) return d
      // Secondary: target end date
      const aEnd = a.targetYear && a.targetQuarter ? a.targetYear * 4 + a.targetQuarter : Infinity
      const bEnd = b.targetYear && b.targetQuarter ? b.targetYear * 4 + b.targetQuarter : Infinity
      if (aEnd !== bEnd) return aEnd - bEnd
      return a.title.localeCompare(b.title)
    })
  const unscheduled = features.filter((f) => !f.targetYear && !f.startYear)

  const groups = ROADMAP_STATUSES
    .map((s) => ({ status: s, items: scheduled.filter((f) => f.status === s) }))
    .filter((g) => g.items.length > 0)

  async function persist(id: string, patch: Parameters<typeof updateRoadmapFeature>[1]) {
    try {
      await updateRoadmapFeature(id, patch)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  async function dropOnQuarter(year: number, quarter: number) {
    if (!draggingId) return
    const f = features.find((x) => x.id === draggingId)
    if (!f) return

    // Maintain duration when feature has both start and target
    let patchStartYear: number | null    = f.startYear ?? null
    let patchStartQ: RoadmapQuarter | null = f.startQuarter ?? null

    if (f.startYear && f.startQuarter && f.targetYear && f.targetQuarter) {
      const duration    = colIdxFor(f.targetYear, f.targetQuarter) - colIdxFor(f.startYear, f.startQuarter)
      const newEndIdx   = colIdxFor(year, quarter)
      const newStartIdx = Math.max(0, newEndIdx - duration)
      patchStartYear = minYear + Math.floor(newStartIdx / 4)
      patchStartQ    = ((newStartIdx % 4) + 1) as RoadmapQuarter
    }

    await persist(draggingId, {
      targetYear:    year           as unknown as number,
      targetQuarter: quarter        as unknown as 1,
      startYear:     patchStartYear as unknown as number,
      startQuarter:  patchStartQ    as unknown as 1,
    })
    setDraggingId(null)
    setDragOverCol(null)
  }

  function startResize(e: React.MouseEvent, id: string, edge: 'start' | 'end', currentIdx: number) {
    if (!canWrite) return
    e.preventDefault()
    e.stopPropagation()
    setResizing({ id, edge, currentIdx })
  }

  // Global mouse listeners while a resize is active
  useEffect(() => {
    if (!resizing) return

    function onMouseMove(e: MouseEvent) {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x    = e.clientX - rect.left + containerRef.current.scrollLeft - LEFT_W
      const idx  = Math.max(0, Math.min(totalCols - 1, Math.floor(x / COL_W)))
      setResizing((prev) => prev ? { ...prev, currentIdx: idx } : null)
    }

    async function onMouseUp() {
      if (!resizing) return
      const f = features.find((x) => x.id === resizing.id)
      if (f) {
        const existingStartIdx = f.startYear  && f.startQuarter  ? (f.startYear  - minYear) * 4 + (f.startQuarter  - 1) : null
        const existingEndIdx   = f.targetYear && f.targetQuarter ? (f.targetYear - minYear) * 4 + (f.targetQuarter - 1) : null
        if (resizing.edge === 'start') {
          const clamped = existingEndIdx !== null ? Math.min(resizing.currentIdx, existingEndIdx) : resizing.currentIdx
          const year    = minYear + Math.floor(clamped / 4)
          const quarter = ((clamped % 4) + 1) as RoadmapQuarter
          await persist(resizing.id, { startYear: year as unknown as number, startQuarter: quarter as unknown as 1 })
        } else {
          const clamped = existingStartIdx !== null ? Math.max(resizing.currentIdx, existingStartIdx) : resizing.currentIdx
          const year    = minYear + Math.floor(clamped / 4)
          const quarter = ((clamped % 4) + 1) as RoadmapQuarter
          await persist(resizing.id, { targetYear: year as unknown as number, targetQuarter: quarter as unknown as 1 })
        }
      }
      setResizing(null)
    }

    document.body.style.cursor     = 'ew-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [resizing, features, totalCols, minYear, updateRoadmapFeature, LEFT_W])

  const yearList = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
        {t('roadmap.ganttHint')}
      </p>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin" ref={containerRef}>
          <div style={{ minWidth: LEFT_W + totalW }}>

            {/* ── Header ── */}
            <div className="sticky top-0 z-40 flex border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <div
                style={{ width: LEFT_W, minWidth: LEFT_W }}
                className="sticky left-0 z-30 flex items-end border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="section-label">{t('roadmap.ganttFeature')}</span>
              </div>
              <div className="flex">
                {yearList.map((year) => (
                  <div key={year} style={{ width: 4 * COL_W }} className="border-r border-slate-200 last:border-r-0 dark:border-slate-800">
                    <div className={`border-b border-slate-200 px-2 py-1 text-2xs font-semibold tabular-nums dark:border-slate-800 ${
                      year === todayYear ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {year}
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4].map((q) => {
                        const isCurrent = year === todayYear && q === todayQuarter
                        const isPast    = year < todayYear || (year === todayYear && q < todayQuarter)
                        const key       = `${year}-${q}`
                        return (
                          <div
                            key={q}
                            style={{ width: COL_W }}
                            onDragOver={(e) => { if (!canWrite) return; e.preventDefault(); if (dragOverCol !== key) setDragOverCol(key) }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                            onDrop={(e) => { e.preventDefault(); if (canWrite) dropOnQuarter(year, q) }}
                            className={`relative select-none border-r border-slate-100 py-1.5 text-center text-2xs font-semibold transition-colors last:border-r-0 dark:border-slate-800/70 ${
                              dragOverCol === key
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                                : isCurrent
                                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                                  : isPast
                                    ? 'text-slate-300 dark:text-slate-600'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            Q{q}
                            {isCurrent && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-500" aria-hidden />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Feature rows (grouped by status) ── */}
            {groups.length === 0 ? (
              <div className="flex">
                <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="sticky left-0 z-30 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
                <div style={{ width: totalW }}>
                  <EmptyState compact icon={<CalendarOff />} title={t('roadmap.ganttNoScheduled')} className="items-start sm:items-center" />
                </div>
              </div>
            ) : groups.map(({ status, items }) => {
              const sm   = STATUS_META[status]
              const Icon = sm.icon
              return (
                <div key={status}>
                  {/* Status section header */}
                  <div className="flex border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/30">
                    <div
                      style={{ width: LEFT_W, minWidth: LEFT_W }}
                      className="sticky left-0 z-30 flex items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <Icon className={`h-3 w-3 ${sm.text}`} />
                      <span className={`truncate text-2xs font-semibold uppercase tracking-wider ${sm.text}`}>{t(`roadmap.statusLabels.${status}`)}</span>
                      <span className="text-2xs tabular-nums text-slate-400">{items.length}</span>
                    </div>
                    <div style={{ width: totalW }} className="relative">
                      <div style={{ left: todayLeft, width: 1 }} className="pointer-events-none absolute bottom-0 top-0 bg-indigo-400/25 dark:bg-indigo-500/20" />
                    </div>
                  </div>

                  {/* Feature rows */}
                  {items.map((f) => {
                    let barStartIdx: number | null = null
                    let barEndIdx:   number | null = null
                    let isMilestone = false
                    let isYearOnly  = false

                    if (f.targetYear && f.targetQuarter) {
                      barEndIdx = colIdxFor(f.targetYear, f.targetQuarter)
                      if (f.startYear && f.startQuarter) {
                        barStartIdx = colIdxFor(f.startYear, f.startQuarter)
                        if (barStartIdx > barEndIdx) barStartIdx = barEndIdx
                      } else if (f.startYear) {
                        // startYear but no quarter → start at Q1 of that year
                        barStartIdx = colIdxFor(f.startYear, 1)
                        if (barStartIdx > barEndIdx) barStartIdx = barEndIdx
                      } else {
                        barStartIdx = barEndIdx
                        isMilestone = true
                      }
                    } else if (f.targetYear) {
                      // targetYear without quarter → span Q1-Q4 of that year (approximate)
                      barStartIdx = colIdxFor(f.targetYear, 1)
                      barEndIdx   = colIdxFor(f.targetYear, 4)
                      isYearOnly  = true
                    } else if (f.startYear && f.startQuarter) {
                      barStartIdx = colIdxFor(f.startYear, f.startQuarter)
                      barEndIdx   = barStartIdx
                      isMilestone = true
                    } else if (f.startYear) {
                      // startYear only → span Q1-Q4
                      barStartIdx = colIdxFor(f.startYear, 1)
                      barEndIdx   = colIdxFor(f.startYear, 4)
                      isYearOnly  = true
                    }

                    return (
                      <div
                        key={f.id}
                        style={{ height: ROW_H }}
                        className="group flex border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-800/20"
                      >
                        {/* Left: feature name */}
                        <div
                          style={{ width: LEFT_W, minWidth: LEFT_W }}
                          className="sticky left-0 z-30 flex items-center border-r border-slate-200 bg-white px-3 group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800"
                        >
                          <button
                            type="button"
                            onClick={() => onFeatureClick(f.id)}
                            title={f.title}
                            className="w-full truncate text-left text-xs font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
                          >
                            {f.title}
                          </button>
                        </div>

                        {/* Right: bar area */}
                        <div style={{ width: totalW }} className="relative">
                          {/* Column background stripes */}
                          <div className="pointer-events-none absolute inset-0 flex">
                            {Array.from({ length: totalCols }, (_, i) => {
                              const y = minYear + Math.floor(i / 4)
                              const q = (i % 4) + 1
                              const isCurr = y === todayYear && q === todayQuarter
                              const isPast = y < todayYear || (y === todayYear && q < todayQuarter)
                              return (
                                <div
                                  key={i}
                                  style={{ width: COL_W }}
                                  className={`border-r last:border-r-0 ${q === 4 ? 'border-slate-200 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800/50'} ${
                                    isCurr ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.06]' : isPast ? 'bg-slate-50/60 dark:bg-slate-950/30' : ''
                                  }`}
                                />
                              )
                            })}
                          </div>

                          {/* Today marker line */}
                          <div style={{ left: todayLeft, width: 2 }} className="pointer-events-none absolute bottom-0 top-0 z-10 bg-indigo-400/50 dark:bg-indigo-500/50" />

                          {/* Feature bar */}
                          {barStartIdx !== null && barEndIdx !== null && (() => {
                            const isResizingThis = resizing?.id === f.id
                            let dispStart = barStartIdx
                            let dispEnd   = barEndIdx
                            if (isResizingThis) {
                              if (resizing!.edge === 'start') dispStart = Math.min(resizing!.currentIdx, dispEnd)
                              else                            dispEnd   = Math.max(resizing!.currentIdx, dispStart)
                            }
                            const barLeft  = isMilestone ? dispStart * COL_W + (COL_W - BAR_H) / 2 : dispStart * COL_W + 4
                            const barWidth = isMilestone ? BAR_H : (dispEnd - dispStart + 1) * COL_W - 8
                            return (
                              <div
                                draggable={canWrite && !resizing}
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text/plain', f.id)
                                  setTimeout(() => setDraggingId(f.id), 0)
                                }}
                                onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                                onDoubleClick={() => onFeatureClick(f.id)}
                                title={f.title}
                                style={{ left: barLeft, width: barWidth, top: (ROW_H - BAR_H) / 2, height: BAR_H }}
                                className={`absolute z-20 select-none ${
                                  isResizingThis ? 'cursor-ew-resize'
                                  : draggingId === f.id ? 'cursor-grabbing opacity-30'
                                  : canWrite ? 'cursor-grab hover:brightness-95 dark:hover:brightness-110' : ''
                                } ${isMilestone
                                  ? 'flex items-center justify-center'
                                  : `flex items-center overflow-hidden rounded-md border shadow-sm ${sm.soft} ${sm.border} ${isYearOnly ? 'border-dashed opacity-70' : ''}`
                                }`}
                              >
                                {isMilestone ? (
                                  <div className={`h-full w-full rotate-45 scale-[0.6] rounded-[3px] shadow-sm ring-2 ring-white dark:ring-slate-900 ${sm.dotCls}`} />
                                ) : (
                                  <>
                                    {canWrite && (
                                      <div
                                        onMouseDown={(e) => startResize(e, f.id, 'start', dispStart)}
                                        className="group/lh absolute bottom-0 left-0 top-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center rounded-l-md hover:bg-black/10 dark:hover:bg-white/15"
                                      >
                                        <div className={`h-3.5 w-px rounded-full bg-current opacity-30 transition-opacity group-hover/lh:opacity-80 ${sm.text}`} />
                                      </div>
                                    )}

                                    <span className={`truncate px-3 text-2xs font-medium ${sm.text}`}>{f.title}</span>

                                    {canWrite && (
                                      <div
                                        onMouseDown={(e) => startResize(e, f.id, 'end', dispEnd)}
                                        className="group/rh absolute bottom-0 right-0 top-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center rounded-r-md hover:bg-black/10 dark:hover:bg-white/15"
                                      >
                                        <div className={`h-3.5 w-px rounded-full bg-current opacity-30 transition-opacity group-hover/rh:opacity-80 ${sm.text}`} />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled section */}
      {unscheduled.length > 0 && (
        <section>
          <SectionHeader title={t('roadmap.ganttUnscheduled')} count={unscheduled.length} icon={<GanttChartSquare />} />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {unscheduled.map((f) => (
              <CompactFeatureCard key={f.id} feature={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
