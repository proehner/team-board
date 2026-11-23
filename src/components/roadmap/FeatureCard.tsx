import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calendar, Tag, Layers, ChevronRight } from 'lucide-react'
import type { RoadmapFeature } from '@/types'
import { RoadmapStatusBadge, PriorityIndicator, PlanningProgress } from './RoadmapBadges'
import { STATUS_META, PRIORITY_META } from './roadmapConfig'

function targetLabel(f: RoadmapFeature) {
  const parts: string[] = []
  if (f.targetVersion) parts.push(f.targetVersion)
  if (f.targetYear) parts.push(`${f.targetYear}${f.targetQuarter ? ` Q${f.targetQuarter}` : ''}`)
  return parts.join(' · ')
}

interface FeatureCardProps {
  feature: RoadmapFeature
  /** Hide the status badge (e.g. when cards are already grouped by status) */
  showStatus?: boolean
  className?: string
}

/** Roadmap feature card — the whole card is a link to the detail page. */
export default function FeatureCard({ feature, showStatus = true, className = '' }: FeatureCardProps) {
  const { t } = useTranslation()
  const target = targetLabel(feature)
  return (
    <Link
      to={`/roadmap/${feature.id}`}
      draggable={false}
      className={`group surface-interactive flex h-full flex-col p-4 ${className}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {showStatus && <RoadmapStatusBadge status={feature.status} />}
          <PriorityIndicator priority={feature.priority} />
          {feature.category && (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Layers className="h-3 w-3 shrink-0" />
              <span className="truncate">{feature.category}</span>
            </span>
          )}
        </div>
        <ChevronRight className="-mr-1 h-4 w-4 shrink-0 text-slate-300 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600" />
      </div>

      <h3 className="mt-2.5 text-sm font-semibold leading-snug text-slate-900 transition-colors line-clamp-2 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
        {feature.title}
      </h3>
      {feature.description && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2 dark:text-slate-400">{feature.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3.5 text-xs text-slate-500 dark:text-slate-400">
        {target && (
          <span className="inline-flex items-center gap-1 tabular-nums" title={t('roadmap.target')}>
            <Calendar className="h-3 w-3" />
            {target}
          </span>
        )}
        {feature.tags.length > 0 && (
          <span className="inline-flex min-w-0 items-center gap-1" title={feature.tags.join(', ')}>
            <Tag className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {feature.tags.slice(0, 2).join(', ')}{feature.tags.length > 2 && ` +${feature.tags.length - 2}`}
            </span>
          </span>
        )}
        <PlanningProgress feature={feature} className="ml-auto" />
      </div>
    </Link>
  )
}

/** Small one-line feature link (used for unscheduled items next to the Gantt chart). */
export function CompactFeatureCard({ feature }: { feature: RoadmapFeature }) {
  const sm = STATUS_META[feature.status]
  const pm = PRIORITY_META[feature.priority]
  return (
    <Link
      to={`/roadmap/${feature.id}`}
      draggable={false}
      className={`group surface-interactive flex items-center gap-2.5 border-l-[3px] px-3 py-2.5 ${sm.stripe}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pm.dotCls}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
        {feature.title}
      </span>
      <PlanningProgress feature={feature} showLabel={false} />
    </Link>
  )
}
