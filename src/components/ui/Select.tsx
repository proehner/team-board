import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md'
  /** Optional leading icon */
  icon?: ReactNode
  /** Wrapper class (width etc.) */
  wrapperClassName?: string
}

/** Styled native <select> — keeps native a11y & mobile pickers, matches .form-input. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ size = 'md', icon, className = '', wrapperClassName = '', children, ...rest }, ref) => {
    const sm = size === 'sm'
    if (!icon) {
      return (
        <select ref={ref} className={`form-select ${sm ? 'form-sm' : ''} ${wrapperClassName} ${className}`} {...rest}>
          {children}
        </select>
      )
    }
    return (
      <div className={`relative ${wrapperClassName}`}>
        <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 [&_svg]:h-3.5 [&_svg]:w-3.5 ${sm ? 'left-2.5' : 'left-3'}`}>
          {icon}
        </span>
        <select ref={ref} className={`form-select ${sm ? 'form-sm pl-7' : 'pl-9'} ${className}`} {...rest}>
          {children}
        </select>
      </div>
    )
  },
)
Select.displayName = 'Select'
export default Select
