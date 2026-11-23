import { useTranslation } from 'react-i18next'
import type { SkillLevel } from '@/types'

interface SkillLevelBadgeProps {
  level: SkillLevel
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** Five-dot meter for a skill level (0–5). Dark-mode aware, labelled for screen readers. */
export default function SkillLevelBadge({ level, showLabel = false, size = 'sm', className = '' }: SkillLevelBadgeProps) {
  const { t } = useTranslation()
  const label = t(`skillLevel.${level}`)
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={`${level}/5 · ${label}`}>
      <span className="flex gap-0.5" role="img" aria-label={`${level}/5 · ${label}`}>
        {([1, 2, 3, 4, 5] as SkillLevel[]).map((l) => (
          <span
            key={l}
            className={`rounded-full transition-colors ${size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'} ${
              l <= level ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </span>
      {showLabel && <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>}
    </span>
  )
}
