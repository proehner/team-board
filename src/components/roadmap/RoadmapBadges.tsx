import { useTranslation } from 'react-i18next'
import type { RoadmapFeature, RoadmapStatus, RoadmapPriority } from '@/types'
import Badge from '@/components/ui/Badge'
import { STATUS_META, PRIORITY_META, PLANNING_KEYS, planningScore, planningBarCls } from './roadmapConfig'

/** Colored status pill with icon */
export function RoadmapStatusBadge({ status, size = 'sm', className = '' }: { status: RoadmapStatus; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useTranslation()
  const m = STATUS_META[status]
  const Icon = m.icon
  return <Badge variant={m.badge} size={size} icon={<Icon />} label={t(`roadmap.statusLabels.${status}`)} className={className} />
}

/** Priority as colored dot + label */
export function PriorityIndicator({ priority, className = '' }: { priority: RoadmapPriority; className?: string }) {
  const { t } = useTranslation()
  const m = PRIORITY_META[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${m.text} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.dotCls}`} aria-hidden />
      {t(`roadmap.priorityLabels.${priority}`)}
    </span>
  )
}

/**
 * Planning completeness indicator: one segment per planning section + "x/6" label.
 * Has an accessible label and a native tooltip explaining the numbers.
 */
export function PlanningProgress({
  feature, showLabel = true, className = '',
}: { feature: Partial<RoadmapFeature>; showLabel?: boolean; className?: string }) {
  const { t } = useTranslation()
  const { filled, total } = planningScore(feature)
  const fill = planningBarCls(filled, total)
  const label = t('roadmap.planningTooltip', { filled, total })
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={label} aria-label={label} role="img">
      <span className="flex items-center gap-0.5" aria-hidden>
        {PLANNING_KEYS.map((k, i) => (
          <span key={k} className={`h-1.5 w-2.5 rounded-full ${i < filled ? fill : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </span>
      {showLabel && (
        <span
          aria-hidden
          className={`text-2xs font-medium tabular-nums ${filled === total ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
        >
          {filled}/{total}
        </span>
      )}
    </span>
  )
}
