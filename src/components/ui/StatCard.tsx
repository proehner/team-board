import type { ReactNode, ComponentType } from 'react'
import { Link } from 'react-router-dom'

export type StatTone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'slate'

const toneCls: Record<StatTone, string> = {
  indigo:  'bg-indigo-50 text-indigo-600 ring-indigo-500/10 dark:bg-indigo-500/10 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber:   'bg-amber-50 text-amber-600 ring-amber-500/10 dark:bg-amber-500/10 dark:text-amber-300',
  rose:    'bg-rose-50 text-rose-600 ring-rose-500/10 dark:bg-rose-500/10 dark:text-rose-300',
  violet:  'bg-violet-50 text-violet-600 ring-violet-500/10 dark:bg-violet-500/10 dark:text-violet-300',
  sky:     'bg-sky-50 text-sky-600 ring-sky-500/10 dark:bg-sky-500/10 dark:text-sky-300',
  slate:   'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300',
}

interface StatCardProps {
  label: ReactNode
  value: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: StatTone
  /** Secondary line below the value */
  hint?: ReactNode
  /** Small element top-right (trend, badge…) */
  aside?: ReactNode
  /** Makes the whole card a link */
  to?: string
  /** Makes the whole card a button (e.g. to switch a tab) */
  onClick?: () => void
  className?: string
}

/** KPI tile used on dashboards and overview pages. */
export default function StatCard({ label, value, icon: Icon, tone = 'indigo', hint, aside, to, onClick, className = '' }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 hyphens-auto [overflow-wrap:anywhere]">{label}</p>
        {Icon ? (
          <div className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneCls[tone]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        ) : aside}
      </div>
      <p
        className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-50 truncate"
        title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
      >
        {value}
      </p>
      {(hint || (Icon && aside)) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">{hint}</span>
          {Icon && aside}
        </div>
      )}
    </>
  )
  const cls = `block p-4 sm:p-5 ${to || onClick ? 'surface-interactive' : 'surface'} ${className}`
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{body}</button>
  return <div className={cls}>{body}</div>
}
