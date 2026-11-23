import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Meter from './Meter'
import { sprintTimeInfo, type SprintTimeInfo } from './sprintTime'

/** Short deadline text: "4 Tage verbleibend" / "endet heute" / "seit 45 Tagen überfällig". */
export function sprintDeadlineLabel(info: SprintTimeInfo, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (info.state) {
    case 'overdue':   return t('overview.sprintOverdue', { count: info.overdueDays })
    case 'endsToday': return t('overview.sprintEndsToday')
    case 'upcoming':  return t('overview.sprintStartsIn', { count: info.daysToStart })
    default:          return t('overview.sprintDaysLeft', { count: info.daysLeft })
  }
}

/** Badge variant for the deadline (amber when overdue / last days). */
export function sprintDeadlineVariant(info: SprintTimeInfo): 'warning' | 'danger' | 'info' | 'default' {
  if (info.state === 'overdue') return 'warning'
  if (info.state === 'endsToday' || info.daysLeft <= 2) return 'danger'
  if (info.daysLeft <= 5) return 'warning'
  return 'info'
}

export function SprintDeadlineBadge({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { t } = useTranslation()
  const info = sprintTimeInfo(startDate, endDate)
  return (
    <Badge
      label={sprintDeadlineLabel(info, t)}
      variant={sprintDeadlineVariant(info)}
      icon={info.state === 'overdue' ? <AlertTriangle /> : <Clock />}
    />
  )
}

interface SprintTimeProgressProps {
  startDate: string
  endDate: string
  /** Show the deadline text on the right (set false when a SprintDeadlineBadge is already visible) */
  showDeadline?: boolean
  className?: string
}

/** Elapsed working days of a sprint as a meter, with an overdue state. */
export default function SprintTimeProgress({ startDate, endDate, showDeadline = true, className = '' }: SprintTimeProgressProps) {
  const { t } = useTranslation()
  const info = sprintTimeInfo(startDate, endDate)
  const overdue = info.state === 'overdue'

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {info.state === 'upcoming'
            ? t('overview.sprintNotStarted')
            : t('overview.sprintDayOf', { day: info.elapsedWorkingDays, total: info.totalWorkingDays })}
        </span>
        {showDeadline ? (
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              overdue ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
            {sprintDeadlineLabel(info, t)}
          </span>
        ) : (
          <span className="font-medium tabular-nums text-slate-500 dark:text-slate-400">{info.pct}%</span>
        )}
      </div>
      <Meter
        value={info.pct}
        tone={overdue ? 'amber' : info.pct >= 80 ? 'amber' : 'indigo'}
        size="md"
        label={t('overview.sprintTime')}
      />
    </div>
  )
}
