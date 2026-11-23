import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import Tabs from '@/components/ui/Tabs'
import IconButton from '@/components/ui/IconButton'
import { formatDate } from '@/utils/date'
import { assignmentStatus as getStatus } from '@/utils/rotation'
import type { ResponsibilityAssignment, ResponsibilityTypeConfig, Sprint } from '@/types'
import type { MemberLike } from './rotationUi'

const RANGE_PRESETS = [
  { label: '4W',  weeksBack: 1, weeksAhead:  3 },
  { label: '8W',  weeksBack: 2, weeksAhead:  6 },
  { label: '12W', weeksBack: 2, weeksAhead: 10 },
  { label: '6M',  weeksBack: 4, weeksAhead: 22 },
] as const

const BAR_H     = 22  // px height per bar
const BAR_GAP   =  3  // px gap between stacked bars in the same row
const BAR_PAD_V =  6  // px vertical padding above/below all bars
const WEEK_MIN_PX = 52
const LABEL_W_PX = 176

function layoutBars(
  assignments: ResponsibilityAssignment[],
  timelineStart: Date,
  totalDays: number,
): { a: ResponsibilityAssignment; row: number }[] {
  const visible = assignments.filter((a) => {
    const s = differenceInDays(parseISO(a.startDate), timelineStart)
    const e = differenceInDays(parseISO(a.endDate), timelineStart)
    return e >= 0 && s < totalDays
  })
  const sorted = [...visible].sort((x, y) => x.startDate.localeCompare(y.startDate))
  const trackEnds: number[] = []
  return sorted.map((a) => {
    const startDay = differenceInDays(parseISO(a.startDate), timelineStart)
    const endDay   = differenceInDays(parseISO(a.endDate), timelineStart)
    // track is free only if it ended strictly before this bar starts (same-day = overlap)
    let idx = trackEnds.findIndex((e) => e < startDay)
    if (idx === -1) { idx = trackEnds.length; trackEnds.push(endDay) }
    else trackEnds[idx] = endDay
    return { a, row: idx }
  })
}

function sprintColors(status: string) {
  if (status === 'Aktiv')         return { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.40)',  color: '#6366f1' }
  if (status === 'Abgeschlossen') return { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)',  color: '#10b981' }
  if (status === 'Abgebrochen')   return { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444' }
  return                                 { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.30)', color: '#64748b' }
}

export default function RotationTimeline({
  responsibilityTypes, assignments, allMembers, sprints, canWrite, onEdit, onAdd,
}: {
  responsibilityTypes: ResponsibilityTypeConfig[]
  assignments: ResponsibilityAssignment[]
  allMembers: MemberLike[]
  sprints: Sprint[]
  canWrite: boolean
  onEdit: (a: ResponsibilityAssignment) => void
  onAdd: (type: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? enUS : de
  const [rangePreset, setRangePreset] = useState('8W')
  const { weeksBack, weeksAhead } = RANGE_PRESETS.find((p) => p.label === rangePreset) ?? RANGE_PRESETS[1]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const timelineStart = new Date(today)
  timelineStart.setDate(today.getDate() - weeksBack * 7)
  const dow = timelineStart.getDay()
  timelineStart.setDate(timelineStart.getDate() + (dow === 0 ? -6 : 1 - dow))

  const totalWeeks = weeksBack + weeksAhead
  const totalDays  = totalWeeks * 7

  const weeks = Array.from({ length: totalWeeks }, (_, i) => {
    const ws = addDays(timelineStart, i * 7)
    return {
      start: ws,
      label: format(ws, 'd. MMM', { locale }),
      isCurrentWeek: ws <= today && addDays(ws, 6) >= today,
    }
  })

  const todayOffset = differenceInDays(today, timelineStart)
  const todayPct    = (todayOffset / totalDays) * 100

  function barStyle(startISO: string, endISO: string, color: string) {
    const startDay = Math.max(0, differenceInDays(parseISO(startISO), timelineStart))
    const endDay   = Math.min(totalDays - 1, differenceInDays(parseISO(endISO), timelineStart))
    if (endDay < 0 || startDay >= totalDays) return null
    const left  = (startDay / totalDays) * 100
    const width = ((endDay - startDay + 1) / totalDays) * 100
    return { left: `${left}%`, width: `${Math.max(width, 0.5)}%`, backgroundColor: color }
  }

  function sprintPos(startISO: string, endISO: string) {
    const startDay = Math.max(0, differenceInDays(parseISO(startISO), timelineStart))
    const endDay   = Math.min(totalDays - 1, differenceInDays(parseISO(endISO), timelineStart))
    if (endDay < 0 || startDay >= totalDays) return null
    return {
      left:  `${(startDay / totalDays) * 100}%`,
      width: `${Math.max((endDay - startDay + 1) / totalDays * 100, 0.5)}%`,
    }
  }

  const visibleSprints = sprints.filter((s) => sprintPos(s.startDate, s.endDate) !== null)

  if (responsibilityTypes.length === 0) {
    return <div className="surface py-12 text-center text-sm text-slate-400">{t('rotation.noTypes')}</div>
  }

  const gridLines = (highlightCls: string) => (
    <div className="pointer-events-none absolute inset-0 flex">
      {weeks.map((w, i) => (
        <div key={i} className={`flex-1 border-r border-slate-100 last:border-r-0 dark:border-slate-800 ${w.isCurrentWeek ? highlightCls : ''}`} />
      ))}
    </div>
  )

  return (
    <div className="surface overflow-hidden">
      {/* Range selector + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="h-3 w-0.5 rounded-full bg-red-500" />
          {t('rotation.today')} · {format(today, 'd. MMM yyyy', { locale })}
        </div>
        <Tabs
          variant="segmented"
          size="sm"
          value={rangePreset}
          onChange={setRangePreset}
          aria-label={t('rotation.timelineRange')}
          items={RANGE_PRESETS.map((p) => ({ value: p.label, label: p.label }))}
        />
      </div>

      {/* Scrollable chart */}
      <div className="overflow-x-auto scrollbar-thin">
        <div style={{ minWidth: `${LABEL_W_PX + totalWeeks * WEEK_MIN_PX}px` }}>

          {/* Week header */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <div className="sticky left-0 z-20 w-44 shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 section-label dark:border-slate-800 dark:bg-[#162032]">
              {t('rotation.responsibility')}
            </div>
            <div className="flex flex-1 bg-slate-50 dark:bg-[#162032]">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className={`min-w-0 flex-1 border-r border-slate-100 px-1 py-2 text-center text-2xs font-medium tabular-nums last:border-r-0 dark:border-slate-800 ${
                    w.isCurrentWeek ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {w.label}
                </div>
              ))}
            </div>
          </div>

          {/* Sprint band */}
          {visibleSprints.length > 0 && (
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              <div className="sticky left-0 z-20 flex w-44 shrink-0 items-center border-r border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
                <span className="section-label">Sprints</span>
              </div>
              <div className="relative h-8 flex-1 bg-slate-50/50 dark:bg-slate-800/20">
                {gridLines('bg-indigo-50/40 dark:bg-indigo-500/5')}
                <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-red-500/40" style={{ left: `${todayPct}%` }} />
                {visibleSprints.map((s) => {
                  const pos = sprintPos(s.startDate, s.endDate)
                  if (!pos) return null
                  const c = sprintColors(s.status)
                  return (
                    <div
                      key={s.id}
                      className="absolute bottom-1 top-1 flex items-center overflow-hidden rounded px-1.5"
                      style={{ left: pos.left, width: pos.width, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                      title={`${s.name} (${formatDate(s.startDate)} – ${formatDate(s.endDate)})`}
                    >
                      <span className="truncate text-[10px] font-semibold" style={{ color: c.color }}>{s.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rows */}
          {responsibilityTypes.map((rt) => {
            const layout     = layoutBars(assignments.filter((a) => a.type === rt.name), timelineStart, totalDays)
            const numSubRows = layout.length > 0 ? Math.max(...layout.map((l) => l.row)) + 1 : 0
            const rowMinH    = BAR_PAD_V * 2 + Math.max(1, numSubRows) * BAR_H + Math.max(0, numSubRows - 1) * BAR_GAP

            return (
              <div
                key={rt.id}
                className="group flex border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                style={{ minHeight: rowMinH }}
              >
                <div className="sticky left-0 z-20 flex w-44 shrink-0 items-start gap-2 border-r border-slate-200 bg-white py-2 pl-3 pr-1.5 transition-colors group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />
                  <span className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300" title={rt.name}>{rt.name}</span>
                  {canWrite && (
                    <IconButton
                      size="xs"
                      icon={<Plus />}
                      label={t('rotation.newAssignment')}
                      onClick={() => onAdd(rt.name)}
                      className="-my-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    />
                  )}
                </div>
                <div className="relative flex-1 transition-colors group-hover:bg-slate-50/60 dark:group-hover:bg-slate-800/20" style={{ minHeight: rowMinH }}>
                  {gridLines('bg-indigo-50/40 dark:bg-indigo-500/5')}

                  {/* Today line */}
                  <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-red-500" style={{ left: `${todayPct}%` }} />

                  {/* Assignment bars (stacked to avoid overlap) */}
                  {layout.map(({ a, row }) => {
                    const bs = barStyle(a.startDate, a.endDate, rt.color)
                    if (!bs) return null
                    const member = allMembers.find((m) => m.id === a.memberId)
                    const status = getStatus(a)
                    const topPx  = BAR_PAD_V + row * (BAR_H + BAR_GAP)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onEdit(a)}
                        disabled={!canWrite}
                        className={`absolute flex items-center overflow-hidden rounded-md px-2 shadow-sm ${
                          canWrite ? 'hover:ring-2 hover:ring-slate-900/20 hover:ring-offset-1 dark:hover:ring-white/40 dark:hover:ring-offset-slate-900' : 'cursor-default'
                        }`}
                        style={{ ...bs, top: topPx, height: BAR_H, opacity: status === 'ended' ? 0.45 : 1 }}
                        title={`${a.type}: ${member?.name ?? '—'} (${formatDate(a.startDate)} – ${formatDate(a.endDate)})`}
                      >
                        {member && (
                          <span className="truncate text-[11px] font-semibold text-white drop-shadow-sm">{member.name}</span>
                        )}
                      </button>
                    )
                  })}

                  {layout.length === 0 && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
