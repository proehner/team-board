import { useTranslation } from 'react-i18next'
import { sprintTiming } from '@/utils/sprint'
import { AlertTriangle, Clock } from 'lucide-react'
import type { Sprint } from '@/types'

/** Compact one-line hint: progress of a running sprint, or a warning when a sprint should be started / closed. */
export default function SprintTimingInfo({ sprint, className = '' }: { sprint: Sprint; className?: string }) {
  const { t } = useTranslation()
  const timing = sprintTiming(sprint)

  if (sprint.status === 'Aktiv' && timing.phase === 'running') {
    return (
      <Hint className={className}>
        {t('sprintTiming.dayOf', { day: timing.elapsedWorkingDays, total: timing.workingDays })}
        {' · '}
        {t('sprintTiming.remaining', { count: timing.remainingWorkingDays })}
      </Hint>
    )
  }
  if (sprint.status === 'Aktiv' && timing.phase === 'ended') return <Hint warning className={className}>{t('sprintTiming.endPassed')}</Hint>
  if (sprint.status === 'Geplant' && timing.phase === 'running') return <Hint warning className={className}>{t('sprintTiming.startReached')}</Hint>
  if (sprint.status === 'Geplant' && timing.phase === 'ended') return <Hint warning className={className}>{t('sprintTiming.periodOver')}</Hint>
  if ((sprint.status === 'Geplant' || sprint.status === 'Aktiv') && timing.phase === 'upcoming') {
    return <Hint className={className}>{t('sprintTiming.startsIn', { count: timing.daysUntilStart })}</Hint>
  }
  return null
}

function Hint({ warning = false, className = '', children }: { warning?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${
        warning ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
      } ${className}`}
    >
      {warning ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </span>
  )
}
