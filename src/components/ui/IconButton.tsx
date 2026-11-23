import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type IconButtonVariant = 'ghost' | 'secondary' | 'danger' | 'primary'
type IconButtonSize = 'xs' | 'sm' | 'md'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode
  /** Accessible label — also shown as native tooltip. Required. */
  label: string
  variant?: IconButtonVariant
  size?: IconButtonSize
  active?: boolean
}

const variantCls: Record<IconButtonVariant, string> = {
  ghost:
    'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800',
  secondary:
    'text-slate-600 bg-white border border-slate-300 shadow-sm hover:bg-slate-50 dark:text-slate-300 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:bg-slate-800',
  danger:
    'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-500/10',
  primary:
    'text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-400',
}

const sizeCls: Record<IconButtonSize, string> = {
  xs: 'w-6 h-6 rounded-md [&_svg]:w-3.5 [&_svg]:h-3.5',
  sm: 'w-8 h-8 rounded-lg [&_svg]:w-4 [&_svg]:h-4',
  md: 'w-9 h-9 rounded-lg [&_svg]:w-[18px] [&_svg]:h-[18px]',
}

/** Square icon-only button with mandatory accessible label. */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = 'ghost', size = 'sm', active, className = '', type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${variantCls[variant]} ${sizeCls[size]} ${active ? '!text-indigo-600 !bg-indigo-50 dark:!text-indigo-300 dark:!bg-indigo-500/15' : ''} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  ),
)

IconButton.displayName = 'IconButton'
export default IconButton
