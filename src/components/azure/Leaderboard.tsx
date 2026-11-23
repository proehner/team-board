import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import type { CategoryKey, DevStats } from './shared'
import { RANK_STYLES, ROW_STATS, avatarColor, avatarName, fmt, progressPercent } from './shared'
import { AchievementStack, LevelBadge, LevelProgress, RankChip } from './bits'

interface CommonProps {
  /** Sorted developers; `catRank` = rank in the current ranking (stays stable while searching) */
  devs: (DevStats & { catRank?: number })[]
  category: CategoryKey
  /** Value used for ranking in the current category */
  getValue: (dev: DevStats) => number
  /** Label for the ranking value (e.g. "Punkte", "Kombi-Score") */
  valueLabel: string
  /** Optional secondary line below the ranking value (e.g. total points, active weeks) */
  getHint?: (dev: DevStats) => string | undefined
  onSelect: (dev: DevStats) => void
}

// ─── Podium (top 3) ───────────────────────────────────────────────────────────

const PODIUM_ORDER = ['sm:order-2', 'sm:order-1', 'sm:order-3']

export function Podium({ devs, getValue, valueLabel, getHint, onSelect }: CommonProps) {
  const { t } = useTranslation()
  const top = devs.slice(0, 3)
  return (
    <div className={`grid gap-4 sm:items-end ${top.length === 1 ? 'sm:mx-auto sm:max-w-sm' : top.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
      {top.map((dev, idx) => {
        const rs      = RANK_STYLES[idx]
        const isFirst = idx === 0
        const RankIcon = rs.icon
        return (
          <button
            key={dev.id}
            type="button"
            onClick={() => onSelect(dev)}
            className={`surface-interactive group relative w-full overflow-hidden p-4 text-left sm:px-5 sm:text-center ${
              top.length === 3 ? PODIUM_ORDER[idx] : ''
            } ${isFirst ? 'sm:pb-6 sm:pt-8 ring-1 ring-amber-300/60 dark:ring-amber-400/25' : 'sm:pb-5 sm:pt-6'}`}
          >
            <span aria-hidden className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${rs.accent}`} />
            {isFirst && (
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-50/80 to-transparent dark:from-amber-400/[0.06]" />
            )}

            <div className="relative flex items-center gap-4 sm:flex-col sm:gap-0">
              <div className="relative shrink-0">
                <Avatar
                  name={avatarName(dev.displayName)}
                  color={avatarColor(dev.displayName)}
                  size={isFirst ? 'xl' : 'lg'}
                  className={`ring-[3px] ring-offset-2 ring-offset-white dark:ring-offset-slate-900 max-sm:!h-12 max-sm:!w-12 max-sm:!text-base ${rs.ring}`}
                />
                <span
                  className={`absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-900 ${rs.chip}`}
                  title={`#${idx + 1}`}
                >
                  <RankIcon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="min-w-0 flex-1 sm:mt-4 sm:w-full">
                <p className="flex items-center gap-1.5 sm:justify-center">
                  <span className="text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">#{idx + 1}</span>
                  <span className={`truncate font-semibold text-slate-900 dark:text-slate-50 ${isFirst ? 'sm:text-lg' : ''}`}>{dev.displayName}</span>
                </p>
                <div className="mt-1.5 sm:flex sm:justify-center">
                  <LevelBadge level={dev.level} size="xs" />
                </div>
              </div>

              <div className="shrink-0 text-right sm:mt-4 sm:text-center">
                <p className={`font-semibold tracking-tight tabular-nums leading-none ${rs.value} ${isFirst ? 'text-2xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                  {fmt(getValue(dev))}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{valueLabel}</p>
                {getHint?.(dev) && (
                  <p className="mt-0.5 text-2xs tabular-nums text-slate-400 dark:text-slate-500">{getHint(dev)}</p>
                )}
              </div>
            </div>

            <div className="relative mt-4 hidden grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-3 dark:divide-slate-800 dark:border-slate-800 sm:grid">
              {([
                [t('azureRanking.statMerged'),  dev.prsCompleted],
                [t('azureRanking.statReviews'), dev.prsReviewed],
                [t('azureRanking.statDone'),    dev.workItemsCompleted],
              ] as const).map(([lbl, val]) => (
                <div key={lbl} className="px-1">
                  <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{fmt(val)}</p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">{lbl}</p>
                </div>
              ))}
            </div>

            {dev.badges.length > 0 && (
              <div className="relative mt-3 hidden justify-center sm:flex">
                <AchievementStack badges={dev.badges} max={6} size="sm" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export function Leaderboard({ devs, category, getValue, valueLabel, getHint, onSelect }: CommonProps) {
  const { t } = useTranslation()
  const isCustom = category === 'custom'
  const thCls = 'sticky top-0 z-10 whitespace-nowrap bg-slate-50/95 px-3 py-2.5 text-xs font-medium text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80 dark:bg-slate-900/95 dark:text-slate-400 dark:supports-[backdrop-filter]:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800'

  return (
    <>
      {/* Desktop table */}
      <div className="surface hidden lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${thCls} w-14 rounded-tl-xl pl-5 text-left`}>#</th>
              <th scope="col" className={`${thCls} text-left`}>{t('azureRanking.developer')}</th>
              <th scope="col" className={`${thCls} w-44 text-left`}>{t('azureRanking.level')}</th>
              {ROW_STATS.map((s) => (
                <th
                  key={s.key}
                  scope="col"
                  className={`${thCls} hidden w-[4.5rem] text-right xl:table-cell ${!isCustom && s.key === category ? '!text-indigo-600 dark:!text-indigo-400' : ''}`}
                >
                  {t(`azureRanking.${s.tKey}`)}
                </th>
              ))}
              <th scope="col" className={`${thCls} hidden w-32 text-left min-[1360px]:table-cell`}>{t('azureRanking.achievementsShort')}</th>
              <th scope="col" className={`${thCls} w-32 rounded-tr-xl pr-5 text-right`}>{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {devs.map((dev, idx) => {
              const rank = dev.catRank ?? idx + 1
              const pct  = progressPercent(dev)
              const last = idx === devs.length - 1
              return (
                <tr
                  key={dev.id}
                  onClick={() => onSelect(dev)}
                  className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className={`py-3 pl-5 pr-3 ${last ? 'rounded-bl-xl' : ''}`}>
                    <RankChip rank={rank} />
                  </td>
                  <td className="max-w-0 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={avatarName(dev.displayName)} color={avatarColor(dev.displayName)} size="sm" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSelect(dev) }}
                          className="block max-w-full truncate rounded text-left font-medium text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400"
                          title={dev.displayName}
                        >
                          {dev.displayName}
                        </button>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={dev.uniqueName}>{dev.uniqueName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5">
                      <LevelBadge level={dev.level} size="xs" className="self-start" />
                      <LevelProgress levelName={dev.level.name} pct={pct} className="max-w-[8rem]" />
                    </div>
                  </td>
                  {ROW_STATS.map((s) => {
                    const active = !isCustom && s.key === category
                    return (
                      <td
                        key={s.key}
                        className={`hidden px-3 py-3 text-right tabular-nums xl:table-cell ${
                          active ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {fmt(dev[s.key])}
                      </td>
                    )
                  })}
                  <td className="hidden px-3 py-3 min-[1360px]:table-cell">
                    <AchievementStack badges={dev.badges} max={4} />
                  </td>
                  <td className={`py-3 pl-3 pr-5 text-right ${last ? 'rounded-br-xl' : ''}`}>
                    <p className={`text-base font-semibold tabular-nums ${rank <= 3 ? RANK_STYLES[rank - 1].value : 'text-slate-900 dark:text-slate-100'}`}>
                      {fmt(getValue(dev))}
                    </p>
                    {getHint?.(dev) && (
                      <p className="whitespace-nowrap text-2xs tabular-nums text-slate-400 dark:text-slate-500">{getHint(dev)}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <ul className="space-y-2 lg:hidden">
        {devs.map((dev, idx) => {
          const rank = dev.catRank ?? idx + 1
          const pct  = progressPercent(dev)
          return (
            <li key={dev.id}>
              <button
                type="button"
                onClick={() => onSelect(dev)}
                className={`surface-interactive block w-full p-3.5 text-left ${rank <= 3 ? `border-l-[3px] ${RANK_STYLES[rank - 1].border}` : ''}`}
              >
                <div className="flex items-center gap-3">
                  <RankChip rank={rank} size="sm" />
                  <Avatar name={avatarName(dev.displayName)} color={avatarColor(dev.displayName)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{dev.displayName}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <LevelBadge level={dev.level} size="xs" />
                      {dev.badges.length > 0 && (
                        <span className="hidden sm:block"><AchievementStack badges={dev.badges} max={3} /></span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-semibold tabular-nums ${rank <= 3 ? RANK_STYLES[rank - 1].value : 'text-slate-900 dark:text-slate-100'}`}>
                      {fmt(getValue(dev))}
                    </p>
                    <p className="whitespace-nowrap text-2xs tabular-nums text-slate-400 dark:text-slate-500">
                      {getHint?.(dev) ?? valueLabel}
                    </p>
                  </div>
                </div>
                <LevelProgress levelName={dev.level.name} pct={pct} className="mt-3" />
                <div className="mt-2.5 grid grid-cols-5 gap-1 text-center">
                  {ROW_STATS.map((s) => {
                    const active = !isCustom && s.key === category
                    return (
                      <div key={s.key} className="min-w-0">
                        <p className={`text-sm tabular-nums ${active ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                          {fmt(dev[s.key])}
                        </p>
                        <p className="truncate text-2xs text-slate-400 dark:text-slate-500">{t(`azureRanking.${s.tKey}`)}</p>
                      </div>
                    )
                  })}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
