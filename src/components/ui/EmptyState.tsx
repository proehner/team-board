import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  /** Smaller paddings for use inside cards / columns */
  compact?: boolean
  className?: string
}

export default function EmptyState({ icon, title, description, action, compact = false, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-16 px-6'} ${className}`}>
      <div
        className={`relative mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200/70 dark:from-slate-800 dark:to-slate-900 dark:text-slate-500 dark:ring-slate-700/60 ${
          compact ? 'h-10 w-10 [&_svg]:w-5 [&_svg]:h-5' : 'h-14 w-14 [&_svg]:w-7 [&_svg]:h-7'
        }`}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
