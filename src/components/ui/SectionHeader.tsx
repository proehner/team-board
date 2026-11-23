import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: ReactNode
  count?: number
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

/** Small uppercase heading used to group content inside a page. */
export default function SectionHeader({ title, count, icon, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="flex items-center gap-2 section-label [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {title}
        {typeof count === 'number' && (
          <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  )
}
