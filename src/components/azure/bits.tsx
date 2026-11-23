import { useTranslation } from 'react-i18next'
import type { AzBadge, Level } from './shared'
import { RANK_STYLES, badgeIcon, badgeText, levelStyle } from './shared'

/** Colored pill with the developer's level (Bronze … Diamond). */
export function LevelBadge({ level, size = 'sm', className = '' }: { level: Pick<Level, 'name'>; size?: 'xs' | 'sm'; className?: string }) {
  const s = levelStyle(level.name)
  const Icon = s.icon
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === 'xs' ? 'px-1.5 py-px text-2xs' : 'px-2 py-0.5 text-xs'
      } ${s.badge} ${className}`}
    >
      <Icon className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {level.name}
    </span>
  )
}

/** Thin level progress bar. */
export function LevelProgress({ levelName, pct, className = '', size = 'sm' }: { levelName: string; pct: number; className?: string; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={t('azureRanking.levelProgress')}
      title={`${t('azureRanking.levelProgress')}: ${pct}%`}
      className={`w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${size === 'md' ? 'h-2' : 'h-1.5'} ${className}`}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${levelStyle(levelName).bar}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Rank number; top 3 get gold / silver / bronze chips. */
export function RankChip({ rank, size = 'md' }: { rank: number; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6 text-2xs' : 'h-7 w-7 text-xs'
  if (rank <= 3) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ring-1 ring-inset ${dim} ${RANK_STYLES[rank - 1].chip}`}>
        {rank}
      </span>
    )
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center font-medium tabular-nums text-slate-400 dark:text-slate-500 ${dim}`}>
      {rank}
    </span>
  )
}

/** Achievement icon tile (lucide icon instead of the server-provided emoji). */
export function AchievementIcon({ badge, size = 'sm' }: { badge: AzBadge; size?: 'xs' | 'sm' }) {
  useTranslation() // re-render on language change (badge texts are localized)
  const Icon = badgeIcon(badge.id)
  const { name, desc } = badgeText(badge)
  return (
    <span
      title={`${name}: ${desc}`}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/15 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20 ${
        size === 'xs' ? 'h-5 w-5 [&_svg]:h-3 [&_svg]:w-3' : 'h-6 w-6 [&_svg]:h-3.5 [&_svg]:w-3.5'
      }`}
    >
      <Icon />
    </span>
  )
}

/** Compact row of achievement icons with "+N" overflow. */
export function AchievementStack({ badges, max = 4, size = 'xs', className = '' }: { badges: AzBadge[]; max?: number; size?: 'xs' | 'sm'; className?: string }) {
  useTranslation()
  if (badges.length === 0) return <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
  const shown = badges.slice(0, max)
  const rest  = badges.length - shown.length
  return (
    <div className={`flex items-center gap-1 ${className}`} title={badges.map((b) => badgeText(b).name).join(', ')}>
      {shown.map((b) => <AchievementIcon key={b.id} badge={b} size={size} />)}
      {rest > 0 && (
        <span className="ml-0.5 text-2xs font-medium tabular-nums text-slate-400 dark:text-slate-500">+{rest}</span>
      )}
    </div>
  )
}
