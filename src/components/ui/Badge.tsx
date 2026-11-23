import type { ReactNode } from 'react'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'indigo' | 'outline'

interface BadgeProps {
  label: ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
  icon?: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/10',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  danger:  'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  info:    'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  purple:  'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
  indigo:  'bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20',
  outline: 'bg-transparent text-slate-600 ring-slate-300 dark:text-slate-400 dark:ring-slate-700',
}

const dotClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-sky-500',
  purple:  'bg-violet-500',
  indigo:  'bg-indigo-500',
  outline: 'bg-slate-400',
}

export default function Badge({ label, variant = 'default', size = 'sm', dot = false, icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === 'sm' ? 'px-2 py-0.5 text-xs [&_svg]:w-3 [&_svg]:h-3' : 'px-2.5 py-1 text-sm [&_svg]:w-3.5 [&_svg]:h-3.5'
      } ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]}`} />}
      {icon}
      {label}
    </span>
  )
}
