import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import CapacityBar from '@/components/sprints/CapacityBar'
import { formatDateShort } from '@/utils/date'
import { sprintWorkingDays, summarizeMemberCapacity, sprintCapacityHours, formatNumber } from '@/utils/capacity'
import { chronological, localTodayISO } from '@/utils/sprint'
import { Gauge, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Sprint } from '@/types'

const VISIBLE_SPRINTS = 3

/**
 * End index (exclusive) of the default window: the active sprint (or the latest
 * started one) plus the next sprint after it – that's the one being planned –
 * filled up with earlier sprints.
 */
function defaultWindowEnd(list: Sprint[]): number {
  const today = localTodayISO()
  let anchor = list.findIndex((s) => s.status === 'Aktiv')
  if (anchor === -1) {
    for (let i = list.length - 1; i >= 0 && anchor === -1; i--) {
      if (list[i].startDate <= today) anchor = i
    }
  }
  return Math.min(list.length, Math.max(anchor + 2, VISIBLE_SPRINTS))
}

/** Matrix of members × sprints showing who has which capacity in which sprint. */
export default function CapacityOverview() {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const members = useStore((s) => s.members)
  const activities = useStore((s) => s.capacityActivities)
  const [windowEnd, setWindowEnd] = useState<number | null>(null)  // null = default window

  const candidates = chronological(sprints.filter((s) => s.status !== 'Abgebrochen' && s.capacity.length > 0))
  const end = windowEnd ?? defaultWindowEnd(candidates)
  const start = Math.max(0, end - VISIBLE_SPRINTS)
  const shown = candidates.slice(start, end)

  if (shown.length === 0) {
    return (
      <EmptyState
        icon={<Gauge className="w-12 h-12" />}
        title={t('capacity.overviewEmpty')}
        description={t('capacity.overviewEmptySubtitle')}
      />
    )
  }

  const columns = shown.map((sprint) => {
    const workingDays = sprintWorkingDays(sprint)
    const cells = new Map(
      sprint.capacity.map((c) => [c.memberId, { capacity: c, summary: summarizeMemberCapacity(c, activities, workingDays) }]),
    )
    return { sprint, workingDays, cells }
  })
  const rowMembers = members
    .filter((m) => columns.some((col) => col.cells.has(m.id)))
    .sort((a, b) => a.name.localeCompare(b.name))
  const memberIds = new Set(rowMembers.map((m) => m.id))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          {activities.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              {a.name}
              {a.countsToSprint && <span className="text-indigo-600 dark:text-indigo-400 font-medium">({t('capacity.sprintShort')})</span>}
            </span>
          ))}
          <span className="text-slate-400 dark:text-slate-500">{t('capacity.overviewHint')}</span>
        </div>

        {/* Sprint window navigation */}
        {candidates.length > VISIBLE_SPRINTS && (
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setWindowEnd(end - 1)}
              disabled={start === 0}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {t('capacity.olderSprints')}
            </button>
            <span className="px-1 whitespace-nowrap">
              {t('capacity.sprintRange', { from: start + 1, to: end, total: candidates.length })}
            </span>
            <button
              onClick={() => setWindowEnd(end + 1)}
              disabled={end >= candidates.length}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {t('capacity.newerSprints')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('sprintDetail.memberColumn')}
              </th>
              {columns.map(({ sprint, workingDays }) => (
                <th key={sprint.id} className="text-left px-3 py-3 min-w-[8.5rem] align-top">
                  <Link to={`/sprints/${sprint.id}`} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">
                    {sprint.name}
                  </Link>
                  {sprint.status === 'Aktiv' && <span className="ml-1.5"><Badge label={t('sprintStatus.Aktiv')} variant="info" /></span>}
                  <p className="text-xs font-normal text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatDateShort(sprint.startDate)} · {t('capacity.workingDaysShort', { count: workingDays })}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowMembers.map((member) => (
              <tr key={member.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{member.name}</span>
                  </div>
                </td>
                {columns.map(({ sprint, cells }) => {
                  const cell = cells.get(member.id)
                  if (!cell) {
                    return <td key={sprint.id} className="px-3 py-3 text-slate-300 dark:text-slate-600">—</td>
                  }
                  const { capacity, summary } = cell
                  return (
                    <td key={sprint.id} className="px-3 py-3 align-top" title={capacity.notes || undefined}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {t('capacity.hoursPerDayShort', { hours: formatNumber(summary.sprintHoursPerDay) })}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{formatNumber(summary.sprintHours)} h</span>
                      </div>
                      <CapacityBar capacity={capacity} activities={activities} className="mt-1.5" />
                      {(capacity.daysOff > 0 || summary.unassignedHoursPerDay < 0) && (
                        <p className="mt-1 text-xs whitespace-nowrap">
                          {capacity.daysOff > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">{t('capacity.daysOffShort', { days: formatNumber(capacity.daysOff) })}</span>
                          )}
                          {capacity.daysOff > 0 && summary.unassignedHoursPerDay < 0 && ' · '}
                          {summary.unassignedHoursPerDay < 0 && (
                            <span className="text-red-500">{t('capacity.overbookedHours', { hours: formatNumber(-summary.unassignedHoursPerDay) })}</span>
                          )}
                        </p>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
              <td className="px-4 py-3 text-xs uppercase tracking-wide">{t('capacity.sprintCapacity')}</td>
              {columns.map(({ sprint }) => (
                <td key={sprint.id} className="px-3 py-3 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {formatNumber(sprintCapacityHours(sprint, activities, memberIds))} h
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
