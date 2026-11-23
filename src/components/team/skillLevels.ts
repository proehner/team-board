import type { SkillLevel } from '@/types'

export const SKILL_LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5]

/**
 * Sequential indigo ramp for skill levels (matrix cells, legend swatches, catalog dots).
 * Light: darker = higher. Dark: brighter = higher.
 */
export const LEVEL_FILL: Record<SkillLevel, string> = {
  0: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  1: 'bg-indigo-50 text-indigo-500 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20',
  2: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200',
  3: 'bg-indigo-300 text-indigo-950 dark:bg-indigo-500/55 dark:text-white',
  4: 'bg-indigo-500 text-white dark:bg-indigo-500 dark:text-white',
  5: 'bg-indigo-700 text-white dark:bg-indigo-300 dark:text-indigo-950',
}

/** Matrix cell variant: level 0 stays quiet so filled cells stand out. */
export const LEVEL_CELL: Record<SkillLevel, string> = {
  ...LEVEL_FILL,
  0: 'bg-transparent text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-800',
}

export type SkillRisk = 'red' | 'orange' | 'yellow' | 'none'

export const RISK_DOT: Record<Exclude<SkillRisk, 'none'>, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-400',
  yellow: 'bg-amber-400',
}

/** Same colors as CSS values (for <Chip dotColor>). */
export const RISK_COLOR: Record<Exclude<SkillRisk, 'none'>, string> = {
  red: '#ef4444',
  orange: '#fb923c',
  yellow: '#fbbf24',
}

export const levelText = (level: SkillLevel) => (level === 0 ? '–' : String(level))
