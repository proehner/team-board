import type { ReactNode } from 'react'

interface PanelProps {
  title: ReactNode
  /** Small icon rendered in a tile left of the title (colored icons keep their color) */
  icon?: ReactNode
  /** Counter pill after the title */
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Body classes; defaults to `p-5` */
  bodyClassName?: string
}

/**
 * Content card for the knowledge pages (Known Errors, meeting topics).
 * Same surface tokens as <Card/>, but with a vertically centered, compact header.
 */
export default function Panel({ title, icon, count, action, children, className = '', bodyClassName = 'p-5' }: PanelProps) {
  return (
    <section className={`surface ${className}`}>
      <header className="flex min-h-[3.25rem] items-center justify-between gap-3 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
        <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </span>
          )}
          <span className="truncate">{title}</span>
          {typeof count === 'number' && count > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {count}
            </span>
          )}
        </h2>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
