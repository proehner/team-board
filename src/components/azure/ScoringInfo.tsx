import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, CircleCheck, Scale } from 'lucide-react'
import type { PeriodData } from './shared'
import { BREAKDOWN_DEFS, METRIC_GROUPS, fmt } from './shared'
import { LevelBadge } from './bits'

/** Fairness rules shown in "So wird gezählt" (azureRanking.fairness.*). */
const FAIRNESS_RULES = ['once', 'weights', 'reviews', 'caps', 'identities', 'perWeek', 'recalc'] as const

interface ScoringInfoProps {
  data: PeriodData
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Collapsible "So wird gezählt" section: points per action (grouped, with caps), fairness rules and level thresholds. */
const ScoringInfo = forwardRef<HTMLDetailsElement, ScoringInfoProps>(function ScoringInfo({ data, open, onOpenChange }, ref) {
  const { t } = useTranslation()

  return (
    <details
      ref={ref}
      id="azure-scoring"
      className="surface group scroll-mt-6"
      open={open}
      onToggle={(e) => onOpenChange((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Scale className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t('azureRanking.howCounted')}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t('azureRanking.howCountedHint')}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-7 border-t border-slate-100 p-5 dark:border-slate-800">
        <div className="grid gap-x-10 gap-y-7 lg:grid-cols-2">
          {/* Points per action, grouped */}
          <div>
            <h3 className="section-label mb-2">{t('azureRanking.pointsPerAction')}</h3>
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr><th>{t('azureRanking.actionLabel')}</th><th>{t('azureRanking.pointsLabel')}</th></tr>
              </thead>
              {METRIC_GROUPS.map((g) => (
                <tbody key={g.key}>
                  <tr>
                    <th colSpan={2} scope="rowgroup" className="pb-1 pt-4 text-left text-xs font-medium text-slate-500 first:pt-2 dark:text-slate-400">
                      {t(`azureRanking.${g.tKey}`)}
                    </th>
                  </tr>
                  {BREAKDOWN_DEFS.filter((b) => b.group === g.key).map((b) => {
                    const Icon  = b.icon
                    const limit = b.limit && (b.limit.key ? data.limits[b.limit.key] : true)
                    return (
                      <tr key={b.field} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Icon className="h-4 w-4 shrink-0" style={{ color: b.color }} />
                            <span>{t(`azureRanking.${b.scoringTKey}`)}</span>
                            {limit && b.limit && (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-px text-2xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20">
                                {t(`azureRanking.${b.limit.tKey}`, { n: typeof limit === 'number' ? limit : undefined })}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="w-14 py-2 text-right align-top font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{fmt(data.scoring[b.scoringKey] ?? 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </div>

          {/* Fairness rules */}
          <div>
            <h3 className="section-label mb-3">{t('azureRanking.fairnessTitle')}</h3>
            <ul className="space-y-3">
              {FAIRNESS_RULES.map((r) => (
                <li key={r} className="flex gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <CircleCheck className="mt-[3px] h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  <span>
                    {t(`azureRanking.fairness.${r}`, {
                      prComments: data.limits.prCommentsPerPr ?? 10,
                      tickets:    data.limits.ticketsPerDay ?? 10,
                      tasks:      data.limits.tasksPerDay ?? 10,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Level thresholds */}
        {data.levels.length > 0 && (
          <div>
            <h3 className="section-label mb-3">
              {t('azureRanking.levelThresholds')}
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                · {t('azureRanking.levelThresholdsFor', { days: data.days })}
              </span>
            </h3>
            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {data.levels.map((l) => (
                <li key={l.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 sm:flex-col sm:items-start sm:gap-1.5 sm:py-2.5 dark:bg-slate-800/50">
                  <LevelBadge level={l} />
                  <span className="whitespace-nowrap text-sm tabular-nums text-slate-600 dark:text-slate-300">
                    {fmt(l.min)}{l.max !== null ? ` – ${fmt(l.max)}` : '+'} <span className="text-xs text-slate-400">{t('azureRanking.ptsLabel')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
})

export default ScoringInfo
