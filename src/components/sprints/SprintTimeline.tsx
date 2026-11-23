import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { sprintTiming, localTodayISO } from '@/utils/sprint'
import { formatDate } from '@/utils/date'
import type { Sprint } from '@/types'

type Tone = 'indigo' | 'amber' | 'emerald' | 'slate'

const barCls: Record<Tone, string> = {
  indigo:  'bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400',
  amber:   'bg-amber-500 dark:bg-amber-400',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  slate:   'bg-slate-300 dark:bg-slate-600',
}

/**
 * Progress through the sprint time frame: label (day x of y / overdue / starts in …),
 * progress bar and start / end date.
 */
export default function SprintTimeline({ sprint, className = '' }: { sprint: Sprint; className?: string }) {
  const { t } = useTranslation()
  const timing = sprintTiming(sprint)
  const finished = sprint.status === 'Abgeschlossen' || sprint.status === 'Abgebrochen'

  let pct = 0
  let tone: Tone = 'slate'
  let warning = false
  let label: string
  let aside: string | null = null

  if (finished) {
    pct = 100
    tone = sprint.status === 'Abgeschlossen' ? 'emerald' : 'slate'
    label = `${t(`sprintStatus.${sprint.status}`)} · ${t('sprints.workingDays', { count: timing.workingDays })}`
  } else if (timing.phase === 'upcoming') {
    label = t('sprintTiming.startsIn', { count: timing.daysUntilStart })
    aside = t('sprints.workingDays', { count: timing.workingDays })
  } else if (timing.phase === 'running') {
    pct = timing.workingDays > 0 ? Math.round((timing.elapsedWorkingDays / timing.workingDays) * 100) : 0
    if (sprint.status === 'Aktiv') {
      tone = 'indigo'
      label = `${t('sprintTiming.dayOf', { day: timing.elapsedWorkingDays, total: timing.workingDays })} · ${t('sprintTiming.remaining', { count: timing.remainingWorkingDays })}`
      aside = t('sprintTiming.percent', { pct })
    } else {
      tone = 'amber'
      warning = true
      label = t('sprintTiming.startReached')
    }
  } else {
    pct = 100
    tone = 'amber'
    warning = true
    const overdue = differenceInCalendarDays(parseISO(localTodayISO()), parseISO(sprint.endDate))
    label = sprint.status === 'Aktiv'
      ? t('sprintTiming.overdueBy', { count: overdue })
      : t('sprintTiming.periodOver')
  }

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span
          className={`inline-flex min-w-0 items-start gap-1.5 font-medium [&_svg]:mt-px ${
            warning ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {warning && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          <span>{label}</span>
        </span>
        {aside && <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{aside}</span>}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${barCls[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-2xs tabular-nums text-slate-400 dark:text-slate-500">
        <span>{formatDate(sprint.startDate)}</span>
        <span>{formatDate(sprint.endDate)}</span>
      </div>
    </div>
  )
}
