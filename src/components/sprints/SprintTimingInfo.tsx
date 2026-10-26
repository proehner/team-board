import { useTranslation } from 'react-i18next'
import { sprintTiming } from '@/utils/sprint'
import { AlertTriangle, Clock } from 'lucide-react'
import type { Sprint } from '@/types'

/** Progress of a running sprint, or a hint when a sprint should be started / closed. */
export default function SprintTimingInfo({ sprint }: { sprint: Sprint }) {
  const { t } = useTranslation()
  const timing = sprintTiming(sprint)

  if (sprint.status === 'Aktiv' && timing.phase === 'running') {
    const pct = timing.workingDays > 0 ? Math.round((timing.elapsedWorkingDays / timing.workingDays) * 100) : 0
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {t('sprintTiming.dayOf', { day: timing.elapsedWorkingDays, total: timing.workingDays })}
          {' · '}
          {t('sprintTiming.remaining', { count: timing.remainingWorkingDays })}
        </span>
      </div>
    )
  }

  if (sprint.status === 'Aktiv' && timing.phase === 'ended') return <Hint warning>{t('sprintTiming.endPassed')}</Hint>
  if (sprint.status === 'Geplant' && timing.phase === 'running') return <Hint warning>{t('sprintTiming.startReached')}</Hint>
  if (sprint.status === 'Geplant' && timing.phase === 'ended') return <Hint warning>{t('sprintTiming.periodOver')}</Hint>
  if ((sprint.status === 'Geplant' || sprint.status === 'Aktiv') && timing.phase === 'upcoming') {
    return <Hint>{t('sprintTiming.startsIn', { count: timing.daysUntilStart })}</Hint>
  }
  return null
}

function Hint({ warning = false, children }: { warning?: boolean; children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs ${warning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
      {warning ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </p>
  )
}
