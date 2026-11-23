import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/capacity'
import type { CapacityActivity, SprintMemberCapacity } from '@/types'

interface CapacityBarProps {
  capacity: SprintMemberCapacity
  activities: CapacityActivity[]
  className?: string
}

/** Stacked bar showing how a member's working day is split across activities. */
export default function CapacityBar({ capacity, activities, className = '' }: CapacityBarProps) {
  const { t } = useTranslation()
  const segments = activities
    .map((a) => ({ activity: a, hours: capacity.activities[a.id] ?? 0 }))
    .filter((s) => s.hours > 0)
  const assigned = segments.reduce((sum, s) => sum + s.hours, 0)
  const unassigned = capacity.hoursPerDay - assigned
  const scale = Math.max(capacity.hoursPerDay, assigned)

  const tooltip = [
    ...segments.map((s) => `${s.activity.name}: ${formatNumber(s.hours)} h`),
    unassigned > 0 && t('capacity.unassignedHours', { hours: formatNumber(unassigned) }),
    unassigned < 0 && t('capacity.overbookedHours', { hours: formatNumber(-unassigned) }),
  ].filter(Boolean).join('\n')

  return (
    <div
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className={`flex h-2 gap-px overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${
        unassigned < 0 ? 'ring-2 ring-red-400/80 ring-offset-1 ring-offset-white dark:ring-red-500/80 dark:ring-offset-slate-900' : ''
      } ${className}`}
    >
      {scale > 0 && segments.map((s) => (
        <div
          key={s.activity.id}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${(s.hours / scale) * 100}%`, backgroundColor: s.activity.color }}
        />
      ))}
    </div>
  )
}
