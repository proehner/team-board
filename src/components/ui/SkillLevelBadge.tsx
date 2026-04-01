import type { SkillLevel } from '@/types'
import { SKILL_LEVEL_LABELS } from '@/types'

interface SkillLevelBadgeProps {
  level: SkillLevel
  showLabel?: boolean
  size?: 'sm' | 'md'
}

const levelColors: Record<SkillLevel, string> = {
  0: 'bg-slate-200 dark:bg-slate-700',
  1: 'bg-blue-200',
  2: 'bg-blue-400',
  3: 'bg-indigo-500',
  4: 'bg-indigo-700',
  5: 'bg-indigo-900',
}

export default function SkillLevelBadge({ level, showLabel = false, size = 'sm' }: SkillLevelBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {([1, 2, 3, 4, 5] as SkillLevel[]).map((l) => (
          <div
            key={l}
            className={`rounded-full transition-colors ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} ${
              l <= level ? levelColors[level] : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-slate-600 dark:text-slate-400">{SKILL_LEVEL_LABELS[level]}</span>
      )}
    </div>
  )
}
