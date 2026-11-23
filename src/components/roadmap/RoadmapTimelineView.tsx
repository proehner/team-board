import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, GripVertical, Move, Inbox } from 'lucide-react'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import type { RoadmapFeature } from '@/types'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import FeatureCard from './FeatureCard'
import { STATUS_META, PRIORITY_META, planningScore, planningBarCls } from './roadmapConfig'

// ─── Draggable compact card ───────────────────────────────────────────────────

interface DraggableCardProps {
  feature: RoadmapFeature
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
  draggable: boolean
}

function DraggableCompactCard({ feature, onOpen, onDragStart, onDragEnd, isDragging, draggable }: DraggableCardProps) {
  const { t } = useTranslation()
  const sm = STATUS_META[feature.status]
  const pm = PRIORITY_META[feature.priority]
  const { filled, total } = planningScore(feature)
  const pct = (filled / total) * 100

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', feature.id)
        // Delay so the drag image is captured before opacity changes
        setTimeout(() => onDragStart(), 0)
      }}
      onDragEnd={onDragEnd}
      title={[feature.title, feature.description].filter(Boolean).join('\n')}
      className={`group relative rounded-lg border border-l-[3px] border-slate-200 bg-white shadow-sm transition-[box-shadow,opacity,transform] dark:border-slate-700/80 dark:bg-slate-900 ${sm.stripe} ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'scale-95 opacity-30' : 'hover:shadow-card-hover'}`}
    >
      <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5">
        {draggable && (
          <GripVertical className="-ml-0.5 h-3 w-3 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600 [@media(hover:none)]:hidden" aria-hidden />
        )}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pm.dotCls}`} title={t(`roadmap.priorityLabels.${feature.priority}`)} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          className="min-w-0 flex-1 truncate text-left text-xs font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
        >
          {feature.title}
        </button>
      </div>
      <div className="px-2 pb-1.5" title={t('roadmap.planningTooltip', { filled, total })}>
        <div className="h-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-full rounded-full transition-all ${planningBarCls(filled, total)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Timeline view ────────────────────────────────────────────────────────────

interface TimelineViewProps {
  features: RoadmapFeature[]
  onFeatureClick: (id: string) => void
  canWrite: boolean
}

export default function RoadmapTimelineView({ features, onFeatureClick, canWrite }: TimelineViewProps) {
  const { t } = useTranslation()
  const updateRoadmapFeature = useStore((s) => s.updateRoadmapFeature)
  const roadmapTickets       = useStore((s) => s.roadmapTickets)

  const now          = new Date()
  const todayYear    = now.getFullYear()
  const todayQuarter = Math.ceil((now.getMonth() + 1) / 3)

  const [startYear,    setStartYear]    = useState(todayYear)
  const [draggingId,   setDraggingId]   = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  const years    = [startYear, startYear + 1, startYear + 2]
  const quarters = [1, 2, 3, 4] as const

  const unplanned = features.filter((f) => !f.targetYear)

  const isCurrentSlot = (year: number, q: number) => year === todayYear && q === todayQuarter
  const isPastSlot    = (year: number, q: number) =>
    year < todayYear || (year === todayYear && q < todayQuarter)

  const featuresForSlot     = (year: number, q: number) =>
    features.filter((f) => f.targetYear === year && f.targetQuarter === q)
  const featuresForYearOnly = (year: number) =>
    features.filter((f) => f.targetYear === year && !f.targetQuarter)

  // SP sum for a list of features, using already-loaded ticket data (best-effort)
  const spForList = (list: RoadmapFeature[]) =>
    list.reduce((sum, f) =>
      sum + (roadmapTickets[f.id] ?? []).reduce((s, tk) => s + (tk.storyPoints ?? 0), 0), 0)

  async function persist(id: string, patch: Parameters<typeof updateRoadmapFeature>[1]) {
    try {
      await updateRoadmapFeature(id, patch)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  async function dropOnSlot(year: number, quarter: number) {
    if (!draggingId) return
    const f = features.find((x) => x.id === draggingId)
    if (!f || (f.targetYear === year && f.targetQuarter === quarter)) return
    await persist(draggingId, {
      targetYear:    year    as unknown as number,
      targetQuarter: quarter as unknown as 1,
    })
    setDraggingId(null)
    setDragOverSlot(null)
  }

  async function dropOnUnplanned() {
    if (!draggingId) return
    const f = features.find((x) => x.id === draggingId)
    if (!f || !f.targetYear) return
    await persist(draggingId, {
      targetYear:    null as unknown as number,
      targetQuarter: null as unknown as 1,
    })
    setDraggingId(null)
    setDragOverSlot(null)
  }

  function onCellDragOver(e: React.DragEvent, key: string) {
    if (!canWrite) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverSlot !== key) setDragOverSlot(key)
  }

  function onCellDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSlot(null)
  }

  const isDragging = draggingId !== null
  const endDrag = () => { setDraggingId(null); setDragOverSlot(null) }

  return (
    <div className="space-y-6">
      {/* ── Year navigation ── */}
      <div className="flex flex-wrap items-center gap-2">
        <IconButton variant="secondary" icon={<ChevronLeft />} label={t('roadmap.previousYear')} onClick={() => setStartYear((y) => y - 1)} />
        <span className="min-w-[6.5rem] text-center text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          {startYear} – {startYear + 2}
        </span>
        <IconButton variant="secondary" icon={<ChevronRight />} label={t('roadmap.nextYear')} onClick={() => setStartYear((y) => y + 1)} />
        {startYear !== todayYear && (
          <Button size="sm" variant="ghost" onClick={() => setStartYear(todayYear)}>
            {t('roadmap.timelineJumpToToday')}
          </Button>
        )}
        {canWrite && (
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex dark:text-slate-500">
            <Move className="h-3.5 w-3.5" />
            {t('roadmap.timelineDragHint')}
          </span>
        )}
      </div>

      {/* ── Year blocks ── */}
      {years.map((year) => {
        const yearOnly    = featuresForYearOnly(year)
        const isPastYear  = year < todayYear
        const totalInYear = quarters.reduce((n, q) => n + featuresForSlot(year, q).length, 0) + yearOnly.length

        return (
          <section key={year} className={isPastYear ? 'opacity-60' : ''} aria-label={String(year)}>
            {/* Year header */}
            <div className="mb-3 flex items-center gap-2.5">
              <h3 className={`text-sm font-semibold tabular-nums ${year === todayYear ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
                {year}
              </h3>
              {isPastYear && <Badge label={t('roadmap.timelinePast')} />}
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              {totalInYear > 0 && (
                <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {t('roadmap.featureCount', { count: totalInYear })}
                </span>
              )}
            </div>

            {/* Year-only features (no quarter set) */}
            {yearOnly.length > 0 && (
              <div className="mb-3 flex flex-wrap items-start gap-2">
                <span className="mt-1.5 shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {t('roadmap.timelineYearOnly')}:
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {yearOnly.map((f) => (
                    <div key={f.id} className="w-44">
                      <DraggableCompactCard
                        feature={f}
                        draggable={canWrite}
                        onOpen={() => onFeatureClick(f.id)}
                        onDragStart={() => setDraggingId(f.id)}
                        onDragEnd={endDrag}
                        isDragging={draggingId === f.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quarter grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quarters.map((q) => {
                const items     = featuresForSlot(year, q)
                const isCurrent = isCurrentSlot(year, q)
                const isPast    = isPastSlot(year, q)
                const slotKey   = `${year}-${q}`
                const isOver    = dragOverSlot === slotKey
                const sp        = spForList(items)

                return (
                  <div
                    key={q}
                    onDragOver={(e) => onCellDragOver(e, slotKey)}
                    onDragLeave={onCellDragLeave}
                    onDrop={(e) => { e.preventDefault(); if (canWrite) dropOnSlot(year, q) }}
                    className={`${items.length === 0 && !isDragging ? 'min-h-[2.75rem] sm:min-h-[7rem]' : 'min-h-[5rem] sm:min-h-[7rem]'} rounded-xl border p-2.5 transition-[background-color,border-color,box-shadow] ${
                      isOver
                        ? 'border-indigo-400 bg-indigo-50 shadow-card-hover ring-1 ring-indigo-300 dark:border-indigo-500 dark:bg-indigo-500/10 dark:ring-indigo-500/40'
                        : isCurrent
                          ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/[0.07]'
                          : isPast
                            ? 'border-slate-200/70 bg-transparent dark:border-slate-800/70'
                            : isDragging
                              ? 'border-dashed border-slate-300 bg-slate-100/60 dark:border-slate-700 dark:bg-slate-900/60'
                              : 'border-slate-200/80 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/50'
                    }`}
                  >
                    {/* Cell header */}
                    <div className="mb-2 flex items-center gap-1.5 px-0.5">
                      <span className={`text-xs font-semibold ${
                        isCurrent ? 'text-indigo-600 dark:text-indigo-400'
                        : isPast   ? 'text-slate-400 dark:text-slate-600'
                        : 'text-slate-500 dark:text-slate-400'
                      }`}>Q{q}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-px text-2xs font-medium text-white dark:bg-indigo-500">
                          {t('roadmap.timelineNow')}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {sp > 0 && (
                          <span className="text-2xs font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{sp} SP</span>
                        )}
                        {items.length > 0 && (
                          <span className="min-w-[1.25rem] rounded-full bg-white px-1.5 py-px text-center text-2xs font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                            {items.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Feature cards */}
                    <div className="space-y-1.5">
                      {items.map((f) => (
                        <DraggableCompactCard
                          key={f.id}
                          feature={f}
                          draggable={canWrite}
                          onOpen={() => onFeatureClick(f.id)}
                          onDragStart={() => setDraggingId(f.id)}
                          onDragEnd={endDrag}
                          isDragging={draggingId === f.id}
                        />
                      ))}

                      {isOver && (
                        <div className="rounded-lg border-2 border-dashed border-indigo-300 py-2 text-center dark:border-indigo-500/50">
                          <p className="text-2xs font-medium text-indigo-600 dark:text-indigo-400">{t('roadmap.timelineDropHere')}</p>
                        </div>
                      )}

                      {items.length === 0 && !isOver && isDragging && (
                        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 py-3 dark:border-slate-700">
                          <span className="text-2xs text-slate-400 dark:text-slate-600">+</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* ── Backlog / Unplanned ── */}
      {(unplanned.length > 0 || isDragging) && (
        <section
          onDragOver={(e) => onCellDragOver(e, 'unplanned')}
          onDragLeave={onCellDragLeave}
          onDrop={(e) => { e.preventDefault(); if (canWrite) dropOnUnplanned() }}
          className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
            dragOverSlot === 'unplanned'
              ? 'border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <Inbox className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('roadmap.timelineBacklog')}</h3>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            {unplanned.length > 0 && (
              <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{unplanned.length}</span>
            )}
          </div>

          {dragOverSlot === 'unplanned' && (
            <div className="mb-3 rounded-lg border border-dashed border-amber-300 py-3 text-center dark:border-amber-500/50">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t('roadmap.timelineDropUnschedule')}</p>
            </div>
          )}

          {unplanned.length === 0 && isDragging && dragOverSlot !== 'unplanned' && (
            <p className="py-2 text-center text-xs text-slate-400">{t('roadmap.timelineDropHere')}</p>
          )}

          {unplanned.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {unplanned.map((f) => (
                <div
                  key={f.id}
                  draggable={canWrite}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', f.id)
                    setTimeout(() => setDraggingId(f.id), 0)
                  }}
                  onDragEnd={endDrag}
                  className={`transition-opacity ${canWrite ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingId === f.id ? 'opacity-30' : ''}`}
                >
                  <FeatureCard feature={f} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
