import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  icon?: ReactNode
  /** Optional colored dot (any CSS color) */
  dotColor?: string
  count?: number
  size?: 'sm' | 'md'
}

/** Toggleable filter chip. Use for multi-select filters (single-select → <Tabs variant="pills"/>). */
export default function Chip({ active, icon, dotColor, count, size = 'sm', children, className = '', type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5 ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      } ${
        active
          ? 'bg-indigo-50 text-indigo-700 ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/40'
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
      } ${className}`}
      {...rest}
    >
      {dotColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
      {icon}
      {children}
      {typeof count === 'number' && (
        <span className={`tabular-nums ${active ? 'text-indigo-500 dark:text-indigo-300' : 'text-slate-400'}`}>{count}</span>
      )}
    </button>
  )
}
