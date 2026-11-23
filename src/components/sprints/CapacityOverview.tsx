import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import CapacityBar from '@/components/sprints/CapacityBar'
import { formatDateShort } from '@/utils/date'
import { sprintWorkingDays, summarizeMemberCapacity, sprintCapacityHours, formatNumber } from '@/utils/capacity'
import { chronological, localTodayISO } from '@/utils/sprint'
import { Gauge, ChevronLeft, ChevronRight, Info } from 'lucide-react'
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

const stickyCell = 'sticky left-0 z-[1] bg-white dark:bg-slate-900'

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
      <div className="surface">
        <EmptyState
          icon={<Gauge />}
          title={t('capacity.overviewEmpty')}
          description={t('capacity.overviewEmptySubtitle')}
        />
      </div>
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

  const activeCol = (sprint: Sprint) => (sprint.status === 'Aktiv' ? 'bg-indigo-50/40 dark:bg-indigo-500/[0.04]' : '')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
          {activities.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              {a.name}
              {a.countsToSprint && (
                <span className="rounded bg-indigo-50 px-1 py-px text-2xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  {t('capacity.sprintShort')}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Sprint window navigation */}
        {candidates.length > VISIBLE_SPRINTS && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={<ChevronLeft />} onClick={() => setWindowEnd(end - 1)} disabled={start === 0}>
              {t('capacity.olderSprints')}
            </Button>
            <span className="whitespace-nowrap px-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {t('capacity.sprintRange', { from: start + 1, to: end, total: candidates.length })}
            </span>
            <Button variant="ghost" size="sm" iconRight={<ChevronRight />} onClick={() => setWindowEnd(end + 1)} disabled={end >= candidates.length}>
              {t('capacity.newerSprints')}
            </Button>
          </div>
        )}
      </div>

      <div className="surface overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={`${stickyCell} px-4 py-3 text-left align-bottom`}>
                <span className="section-label">{t('sprintDetail.memberColumn')}</span>
              </th>
              {columns.map(({ sprint, workingDays }) => (
                <th key={sprint.id} className={`min-w-[9rem] px-3 py-3 text-left align-top font-normal ${activeCol(sprint)}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/sprints/${sprint.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {sprint.name}
                    </Link>
                    {sprint.status === 'Aktiv' && <Badge label={t('sprintStatus.Aktiv')} variant="indigo" dot />}
                  </div>
                  <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                    {formatDateShort(sprint.startDate)} · {t('capacity.workingDaysShort', { count: workingDays })}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rowMembers.map((member) => (
              <tr key={member.id}>
                <td className={`${stickyCell} px-4 py-3`}>
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{member.name}</span>
                  </div>
                </td>
                {columns.map(({ sprint, cells }) => {
                  const cell = cells.get(member.id)
                  if (!cell) {
                    return <td key={sprint.id} className={`px-3 py-3 text-slate-300 dark:text-slate-600 ${activeCol(sprint)}`}>—</td>
                  }
                  const { capacity, summary } = cell
                  return (
                    <td key={sprint.id} className={`px-3 py-3 align-top ${activeCol(sprint)}`} title={capacity.notes || undefined}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {t('capacity.hoursPerDayShort', { hours: formatNumber(summary.sprintHoursPerDay) })}
                        </span>
                        <span className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatNumber(summary.sprintHours)} h</span>
                      </div>
                      <CapacityBar capacity={capacity} activities={activities} className="mt-2" />
                      {(capacity.daysOff > 0 || summary.unassignedHoursPerDay < 0) && (
                        <p className="mt-1.5 whitespace-nowrap text-xs">
                          {capacity.daysOff > 0 && (
                            <span className="text-amber-700 dark:text-amber-400">{t('capacity.daysOffShort', { days: formatNumber(capacity.daysOff) })}</span>
                          )}
                          {capacity.daysOff > 0 && summary.unassignedHoursPerDay < 0 && ' · '}
                          {summary.unassignedHoursPerDay < 0 && (
                            <span className="font-medium text-red-600 dark:text-red-400">{t('capacity.overbookedHours', { hours: formatNumber(-summary.unassignedHoursPerDay) })}</span>
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
            <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
              <td className="sticky left-0 z-[1] bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="section-label">{t('capacity.sprintCapacity')}</span>
              </td>
              {columns.map(({ sprint }) => (
                <td key={sprint.id} className="whitespace-nowrap px-3 py-3 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatNumber(sprintCapacityHours(sprint, activities, memberIds))} h
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {t('capacity.overviewHint')}
      </p>
    </div>
  )
}
