import { getInitials } from '@/utils/avatar'

interface AvatarProps {
  name: string
  color: string
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Adds a ring in the page background color — use for overlapping avatar stacks */
  ring?: boolean
  /** Tooltip / accessible name override (defaults to `name`) */
  title?: string
  className?: string
}

const sizeClasses = {
  '2xs': 'w-5 h-5 text-[9px]',
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

export default function Avatar({ name, color, size = 'md', ring = false, title, className = '' }: AvatarProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold tracking-tight text-white shrink-0 select-none shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.15)] ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''} ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
      title={title ?? name}
      aria-label={title ?? name}
    >
      {getInitials(name)}
    </span>
  )
}
