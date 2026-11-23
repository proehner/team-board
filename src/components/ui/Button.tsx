import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'success'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white border border-indigo-600 shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 hover:border-indigo-500 active:bg-indigo-700 ' +
    'dark:bg-indigo-500 dark:border-indigo-500 dark:hover:bg-indigo-400 dark:hover:border-indigo-400 dark:shadow-none',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 ' +
    'dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-600',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 ' +
    'dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  subtle:
    'bg-indigo-50 text-indigo-700 border border-transparent hover:bg-indigo-100 active:bg-indigo-200 ' +
    'dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20',
  danger:
    'bg-red-600 text-white border border-red-600 shadow-sm shadow-red-600/20 hover:bg-red-500 hover:border-red-500 active:bg-red-700 ' +
    'dark:bg-red-500 dark:border-red-500 dark:hover:bg-red-400 dark:shadow-none',
  success:
    'bg-emerald-600 text-white border border-emerald-600 shadow-sm shadow-emerald-600/20 hover:bg-emerald-500 hover:border-emerald-500 active:bg-emerald-700 ' +
    'dark:bg-emerald-500 dark:border-emerald-500 dark:hover:bg-emerald-400 dark:shadow-none',
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs rounded-md gap-1',
  sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-3.5 text-sm rounded-lg gap-2',
  lg: 'h-11 px-5 text-sm rounded-xl gap-2',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, icon, iconRight, fullWidth, children, className = '', disabled, type = 'button', ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:shrink-0 ${size === 'xs' || size === 'sm' ? '[&_svg]:w-3.5 [&_svg]:h-3.5' : '[&_svg]:w-4 [&_svg]:h-4'} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {loading ? <Loader2 className="animate-spin" /> : icon}
        {children}
        {iconRight}
      </button>
    )
  },
)

Button.displayName = 'Button'
export default Button
