import { useTranslation } from 'react-i18next'
import type { SprintGoalMet } from '@/types'
import Badge from '@/components/ui/Badge'

const SEGMENTS: { key: SprintGoalMet; fill: string; dot: string }[] = [
  { key: 'Ja',        fill: 'bg-emerald-500 dark:bg-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  { key: 'Teilweise', fill: 'bg-amber-400 dark:bg-amber-400',     dot: 'bg-amber-400' },
  { key: 'Nein',      fill: 'bg-red-500 dark:bg-red-400',         dot: 'bg-red-500 dark:bg-red-400' },
]

export const GOAL_MET_VARIANT: Record<SprintGoalMet, 'success' | 'warning' | 'danger'> = {
  Ja: 'success',
  Teilweise: 'warning',
  Nein: 'danger',
}

/** Small pill showing whether a sprint goal was met. */
export function GoalMetBadge({ value }: { value: SprintGoalMet }) {
  const { t } = useTranslation()
  return <Badge label={t(`sprintDetail.goalMet_${value}`)} variant={GOAL_MET_VARIANT[value]} dot />
}

interface GoalMetSummaryProps {
  values: (SprintGoalMet | undefined | null)[]
  /** Optional rate (0–100) shown on the right */
  rate?: number | null
  className?: string
}

/** One whole split into parts: share of sprints whose goal was met / partially met / missed. */
export default function GoalMetSummary({ values, rate, className = '' }: GoalMetSummaryProps) {
  const { t } = useTranslation()
  const rated = values.filter(Boolean) as SprintGoalMet[]
  const counts = SEGMENTS.map((s) => ({ ...s, count: rated.filter((v) => v === s.key).length }))
  const total = rated.length

  if (total === 0) return null

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('overview.goalAchievement')}</p>
        {rate !== undefined && rate !== null && (
          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{rate}%</p>
        )}
      </div>
      <div
        className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={counts.map((c) => `${t(`sprintDetail.goalMet_${c.key}`)}: ${c.count}`).join(', ')}
      >
        {counts.filter((c) => c.count > 0).map((c) => (
          <div
            key={c.key}
            className={`h-full first:rounded-l-full last:rounded-r-full ${c.fill}`}
            style={{ width: `${(c.count / total) * 100}%` }}
            title={`${t(`sprintDetail.goalMet_${c.key}`)}: ${c.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {counts.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
            {t(`sprintDetail.goalMet_${c.key}`)}
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{c.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
