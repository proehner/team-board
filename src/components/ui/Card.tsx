import type { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** Optional icon rendered left of the title */
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  padding?: boolean
  /** Adds hover elevation — use when the whole card is clickable */
  interactive?: boolean
}

export default function Card({
  title, subtitle, icon, action, children, className = '', bodyClassName = '', padding = true, interactive = false,
}: CardProps) {
  return (
    <section className={`${interactive ? 'surface-interactive' : 'surface'} ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 [&_svg]:w-4 [&_svg]:h-4">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-6">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`${padding ? 'p-5' : ''} ${bodyClassName}`}>{children}</div>
    </section>
  )
}
